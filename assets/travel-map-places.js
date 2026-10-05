/* Optional live activities overlay. Projection and all travel interaction belong
   to the map screen; this module only reads current exploration state. */
const CHEST_REOPEN=72*3600*1000;
const clamp=v=>Math.max(0,Math.min(1,v));
const text=v=>String(v||'').replace(/^[^\p{L}\p{N}]+/u,'').trim();

export function drawTravelMapPlaces(ctx,{G,project,zoom=1,width,height}){
 if(!ctx||typeof project!=='function'||!(width>0)||!(height>0))return 0;
 const save=G.save.fresh()||{},tables=G.tables||{},now=Date.now(),rows=[],seen=new Set();
 const add=row=>{
  if(!Number.isFinite(row.x)||!Number.isFinite(row.z))return;
  const p=project(row.x,row.z);if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y))return;
  if(p.x<-12||p.x>width+12||p.y<-12||p.y>height+12)return;
  const alpha=clamp(Number.isFinite(row.alpha)?row.alpha:1);if(!alpha)return;
  const key=[row.x,row.z,row.kind,row.glyph,row.label].join('|');if(seen.has(key))return;seen.add(key);
  rows.push({...row,p,alpha});
 };
 for(const c of tables.CHESTS||[]){
  const at=save.chests?.[c.id],opened=!!at&&now-at<CHEST_REOPEN;
  add({...c,kind:'chest',opened,alpha:opened?.45:1,label:opened?'Opened chest':'Treasure chest'});
 }
 for(const [key,set]of Object.entries(tables.COLL_SETS||{})){
  const found=save.sets?.[key]||[];
  (set.pts||[]).forEach((p,i)=>{if(!found.includes(i))add({x:p[0],z:p[1],kind:'collectible',color:set.col,label:text(set.label)});});
 }
 if(tables.TACK_ROOM)add({...tables.TACK_ROOM,glyph:'🔐',label:'Grandma’s tack room'});
 for(const marker of G.world?.mapMarkers||[]){
  // Hidden callbacks also govern labels, including live seasonal and tracked finds.
  try{if(typeof marker.hidden==='function'&&marker.hidden(save))continue;
   add({...marker,glyph:marker.glyph==null?'•':String(marker.glyph),label:marker.label});
 }catch{/* A single unavailable feature marker must not break the travel screen. */}
 }
 // The original map's Loon Lake fishing spot is independent of feature markers.
 if(!rows.some(r=>r.x===20&&r.z===16&&/🐟|🐠|🎣|fish/i.test(String(r.glyph||'')+' '+String(r.label||''))))
  add({x:20,z:16,glyph:'🐟',label:'Loon Lake fishing'});
 const labels=[],fontSize=zoom>=2?13:11,iconRadius=zoom>=2?8:6.5;
 let count=0;
 ctx.save();
 try{
  ctx.beginPath();ctx.rect(0,0,width,height);ctx.clip();ctx.setLineDash([]);
  ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineWidth=1;
  for(const row of rows){
   const {x,y}=row.p;ctx.globalAlpha=row.alpha;
   if(row.kind==='collectible'){
    const r=zoom>=2?3.8:2.8;ctx.beginPath();ctx.moveTo(x,y-r);ctx.lineTo(x+r,y);ctx.lineTo(x,y+r);ctx.lineTo(x-r,y);ctx.closePath();
    ctx.fillStyle=row.color||'#b59a57';ctx.fill();ctx.strokeStyle='#72674f';ctx.stroke();count++;
   }else if(row.kind==='chest'){
    ctx.fillStyle=row.opened?'#d4c9af':'#bf995b';ctx.strokeStyle='#756144';
    ctx.fillRect(x-4.5,y-3.5,9,7);ctx.strokeRect(x-4.5,y-3.5,9,7);
    ctx.beginPath();ctx.moveTo(x-4.5,y-1);ctx.lineTo(x+4.5,y-1);ctx.moveTo(x,y-3.5);ctx.lineTo(x,y+3.5);ctx.stroke();count++;
   }else if(String(row.glyph||'').trim()){
    ctx.beginPath();ctx.arc(x,y,iconRadius,0,Math.PI*2);ctx.fillStyle='rgba(250,245,229,.90)';ctx.fill();ctx.strokeStyle='rgba(107,110,88,.50)';ctx.stroke();
    ctx.font=fontSize+'px system-ui, sans-serif';ctx.fillStyle='#46574c';ctx.fillText(row.glyph,x,y+.5);count++;
   }
   if(zoom<2||!row.label)continue;
   const caption=text(row.label);if(!caption)continue;
   const label=caption.length>38?caption.slice(0,37)+'…':caption;
   const dz=Number.isFinite(row.labelDz)?row.labelDz:-9,q=project(row.x,row.z+dz);
   const ly=dz>=0?Math.max(q.y,y+16):Math.min(q.y,y-16);
   ctx.font='600 10px system-ui, sans-serif';const w=ctx.measureText(label).width+8;
   labels.push({row,label,x:q.x,y:ly,l:q.x-w/2,r:q.x+w/2,t:ly-7,b:ly+7});
  }
  // Labels stay optional and never obscure another activity or leave the viewport.
  const placed=[];
  for(const box of labels){
   if(box.l<3||box.r>width-3||box.t<3||box.b>height-3)continue;
   if(placed.some(o=>box.l<o.r+3&&box.r>o.l-3&&box.t<o.b+3&&box.b>o.t-3))continue;
   if(rows.some(r=>r!==box.row&&r.p.x>box.l-6&&r.p.x<box.r+6&&r.p.y>box.t-6&&r.p.y<box.b+6))continue;
   ctx.globalAlpha=box.row.alpha;ctx.fillStyle='rgba(248,243,225,.91)';ctx.fillRect(box.l,box.t,box.r-box.l,14);
   ctx.font='600 10px system-ui, sans-serif';ctx.fillStyle='#475449';ctx.fillText(box.label,box.x,box.y);placed.push(box);
   if(!String(box.row.glyph||'').trim()&&!['chest','collectible'].includes(box.row.kind))count++;
  }
 }finally{ctx.restore();}
 return count;
}

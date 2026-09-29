/* Feature package 'hidden-treasures' — golden horseshoes where only a rider on foot can go.

   Getting off the horse used to be a way to stand next to it. Now she can run, jump, climb rock and
   swim (on-foot), and this is what that is for: twelve golden horseshoes hidden round the valley,
   eight on the tops of the meadow outcrops — you have to climb to them — and four out in the water,
   three in the river's deep channel and one in the middle of Loon Lake — you have to get off and
   swim. Each one glints so it can be seen from a way off, pays coins and gems when she picks it up,
   and counts toward an achievement for all twelve. Two more achievements count what the new legs
   are for: the tops of five different rocks, and a hundred metres swum.

   Placement is fixed (the outcrops are seeded; the water spots are the river's deepest near the
   ranch), all of it where a new player may go: nothing inside a region that opens later.

   Owned by this package: this file. Reads on-foot's state (G.onFoot) and the outcrops
   (G.worldOutcrops); pays through G.money; achievements through G.quest.addAch. Nothing runs at
   import time. */
export const id='hidden-treasures';
export function install(G){
 const THREE=G.THREE, W=G.world, H=G.horse, T=G.tables||{};
 if(!THREE||!W||!H||!H.player||!G.scene)return;
 const player=H.player, scene=G.scene;
 const toast=m=>{try{G.toast(m);}catch(e){}};
 const REWARD={c:120,g:2};
 G.save.ensure(s=>{s.treasure=s.treasure||{};const t=s.treasure;t.found=t.found||{};t.climbed=t.climbed||{};if(t.swimM==null)t.swimM=0;});

 /* ---------------------------------------------------------------- where ----------------- */
 const locked=(T.REGIONS||[]).filter(rg=>rg&&rg.unlock&&rg.r<999);
 const inLocked=(x,z)=>locked.some(rg=>Math.hypot(x-rg.x,z-rg.z)<rg.r+6);
 const spots=[];
 /* the tops of the meadow outcrops: the highest point of each rock's own mesh, rocks tall enough to
    need a climb, nearest the ranch first */
 {const O=(G.worldOutcrops&&G.worldOutcrops.group)?G.worldOutcrops.group.children:[];
  const tops=[];
  for(const m of O){const p=m.geometry&&m.geometry.attributes.position;if(!p)continue;
   let best=-1e9,bi=0;for(let i=0;i<p.count;i++){const y=p.getY(i);if(y>best){best=y;bi=i;}}
   const x=m.position.x+p.getX(bi),z=m.position.z+p.getZ(bi),y=m.position.y+best, rise=y-W.groundH(x,z);
   if(rise<1.7||inLocked(x,z))continue;
   tops.push({x,z,y:y+0.28,rise,d:Math.hypot(x,z)});}
  tops.sort((a,b)=>a.d-b.d);
  tops.slice(0,8).forEach((t,i)=>spots.push({id:'rock'+i,kind:'rock',x:t.x,y:t.y,z:t.z,hint:'high on a rock'}));}
 /* the river's deep channel near the ranch (not under the bridge), and the middle of Loon Lake */
 {const F=G.onFoot, waterAt=F&&F.waterAt, pick=[];
  if(waterAt){
   for(const [a,b] of [[-78,-24],[12,40],[44,80]]){let best=null;
    for(let x=a;x<=b;x+=2){const rz=W.riverZ(x);for(let dz=-3;dz<=3;dz+=0.5){const z=rz+dz,w=waterAt(x,z);
     if(!w||w.depth<0.76||inLocked(x,z))continue;if(W.colliders.some(c=>Math.hypot(c.x-x,c.z-z)<c.r+2))continue;
     if(!best||w.depth>best.depth)best={x,z,y:w.surface+0.14,depth:w.depth};}}
    if(best)pick.push(best);}
   pick.forEach((p,i)=>spots.push({id:'river'+i,kind:'water',x:p.x,y:p.y,z:p.z,hint:'out in the river'}));
   const lk=waterAt(20,16);if(lk)spots.push({id:'lake',kind:'water',x:20,y:lk.surface+0.14,z:16,hint:'in the middle of Loon Lake'});
  }}
 const TOTAL=spots.length;

 /* ---------------------------------------------------------------- the horseshoes -------- */
 const shoeGeo=new THREE.TorusGeometry(0.16,0.042,10,30,Math.PI*1.32); shoeGeo.rotateZ(-0.16*Math.PI);   // the gap at the bottom
 const shoeMat=new THREE.MeshStandardMaterial({color:0xffc84a,metalness:0.85,roughness:0.28,emissive:0x7a5200,emissiveIntensity:0.55});
 const glintTex=(()=>{const cv=document.createElement('canvas');cv.width=cv.height=64;const c=cv.getContext('2d');
  const g=c.createRadialGradient(32,32,1,32,32,30);g.addColorStop(0,'rgba(255,248,210,1)');g.addColorStop(0.25,'rgba(255,220,120,0.55)');g.addColorStop(1,'rgba(255,200,80,0)');
  c.fillStyle=g;c.fillRect(0,0,64,64);c.strokeStyle='rgba(255,250,225,0.9)';c.lineWidth=2;c.beginPath();c.moveTo(32,2);c.lineTo(32,62);c.moveTo(2,32);c.lineTo(62,32);c.stroke();
  const t=new THREE.CanvasTexture(cv);t.colorSpace=THREE.SRGBColorSpace;return t;})();
 const glintMat=new THREE.SpriteMaterial({map:glintTex,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending});
 const items=[];
 function place(){
  const s=G.save.fresh()||{}, found=(s.treasure&&s.treasure.found)||{};
  for(const sp of spots){
   const g=new THREE.Group(); g.name='Treasure | golden horseshoe'; g.position.set(sp.x,sp.y,sp.z);
   const shoe=new THREE.Mesh(shoeGeo,shoeMat); shoe.castShadow=true; g.add(shoe);
   const glint=new THREE.Sprite(glintMat.clone()); glint.scale.setScalar(1.1); glint.position.y=0.05; g.add(glint);
   scene.add(g); const it={...sp,g,shoe,glint,found:!!found[sp.id],phase:Math.random()*6,pop:0};
   g.visible=!it.found; items.push(it);
  }
 }
 place();

 /* ---------------------------------------------------------------- the hunt, asked for ---- */
 /* The ☰ Treasures tile and the menu's "Golden horseshoes" button both ask for 'seTreasures', and nothing answered: the
    menu closed and nothing happened. Now they say how many are found and point at the nearest one still out there — its
    hint, how far and which way — and mark it on the big map and the minimap until it is picked up. One at a time, the
    nearest: marking all twelve would turn the hunt into a list. */
 let tracked=null;
 const trackMini={x:0,z:0,col:'#ffd23a',r:3.6,hidden:()=>!tracked||tracked.found};
 const trackMap={x:0,z:0,glyph:'\u25CF',get label(){return tracked&&!tracked.found?'Golden horseshoe':'';},hidden:()=>!tracked||tracked.found};   // the big map prints any label it is given, hidden or not
 try{if(W.miniMarkers)W.miniMarkers.push(trackMini);if(W.mapMarkers)W.mapMarkers.push(trackMap);}catch(e){}
 const COMPASS=['north','north-east','east','south-east','south','south-west','west','north-west'];
 /* the maps put north at the top, which is -z; east is +x */
 const heading=(dx,dz)=>COMPASS[((Math.round(Math.atan2(dx,-dz)/(Math.PI/4))%8)+8)%8];
 function track(){
  const n=items.filter(i=>i.found).length;
  if(!TOTAL){toast('No golden horseshoes hidden in this valley yet.');return null;}
  if(n>=TOTAL){tracked=null;say(n,'You found every one of them! Your prize waits under Achievements in the Journey.');return {found:n,total:TOTAL,next:null};}
  let best=null,bd=1e18;
  for(const it of items){if(it.found)continue;const d=(it.x-player.pos.x)**2+(it.z-player.pos.z)**2;if(d<bd){bd=d;best=it;}}
  tracked=best; trackMini.x=trackMap.x=best.x; trackMini.z=trackMap.z=best.z;
  const d=Math.round(Math.sqrt(bd)), dir=heading(best.x-player.pos.x,best.z-player.pos.z);
  const F=G.onFoot, onFoot=!!(F&&F.on);
  const off=document.body.classList.contains('touch')?'Get off with the walking button':'Get off (F)';
  const how=onFoot?'':(best.kind==='water'?' '+off+' and swim out to it.':' '+off+' and climb up to it.');
  say(n,'The nearest is '+best.hint+', '+d+' m '+dir+'. It is marked on your map.'+how);
  return {found:n,total:TOTAL,next:{id:best.id,kind:best.kind,hint:best.hint,dist:d,dir}};
 }
 /* The answer is a small card, straight away: a toast joins the back of the queue, and at the start of a session that
    queue is several notices long, so a tap on the tile seemed to do nothing for half a minute. */
 function say(n,line){
  const d=document.getElementById('dlg');
  if(!d||d.style.display==='block'){toast('Golden horseshoes: '+n+'/'+TOTAL+' found. '+line);return;}
  d.innerHTML='<b>Golden horseshoes · '+n+'/'+TOTAL+' found</b><p style="margin:8px 0 0">'+line.replace(/&/g,'&amp;').replace(/</g,'&lt;')+'</p>'
   +'<div style="display:flex;gap:6px;margin-top:12px"><button id="dlgBtn" class="claimBtn" data-ht="map">Show the map</button><button data-ht="x">Off I go</button></div>';
  d.style.display='block';
  d.querySelectorAll('[data-ht]').forEach(b=>{b.onclick=e=>{e.stopPropagation();d.style.display='none';if(b.dataset.ht==='map'){const m=document.getElementById('mini');if(m)m.click();}};});
 }
 G.on('seTreasures',()=>track()||true);

 /* ---------------------------------------------------------------- finding one ----------- */
 const told={}; let hinted=false, hintT=0, swimAcc=0, climbCheck=0;
 function collect(it){
  let n=0,first=false;
  G.save.sync(s=>{const t=s.treasure;if(t.found[it.id])return;t.found[it.id]=Date.now();first=true;n=Object.keys(t.found).length;G.money.payReward(s,REWARD);});
  if(!first)return;
  it.found=true; it.pop=0.001;
  if(tracked===it)tracked=null;   // its map mark goes with it; the Treasures tile points at the next
  try{G.money.refreshWallet();}catch(e){}
  try{G.sGem&&G.sGem();}catch(e){}
  toast('✨ Golden horseshoe! '+n+'/'+TOTAL+' · +'+REWARD.c+'🪙 +'+REWARD.g+'💎'+(n>=TOTAL?' — that is all of them! Claim your prize under Achievements.':''));
 }
 G.on('tick',(dt,t)=>{
  dt=Math.min(dt||0.016,0.1);
  const F=G.onFoot, on=!!(F&&F.on), Wk=on&&F.walker?F.walker():null;
  for(const it of items){
   if(it.pop>0){it.pop+=dt;const k=Math.min(1,it.pop/0.6);it.g.position.y=it.y+k*1.2;it.g.scale.setScalar(1+k*0.6);it.glint.material.opacity=1-k;
    if(k>=1){it.g.visible=false;it.pop=0;}continue;}
   if(it.found||!it.g.visible)continue;
   const dx=player.pos.x-it.x,dz=player.pos.z-it.z,d2=dx*dx+dz*dz;
   if(d2>160*160)continue;                                     // far off: nobody is looking
   it.phase+=dt; it.shoe.rotation.y=it.phase*1.3; it.g.position.y=it.y+Math.sin(it.phase*2.1)*0.045;
   it.glint.material.opacity=0.55+0.45*Math.sin(it.phase*3.3); it.glint.scale.setScalar(1.0+0.25*Math.sin(it.phase*2.7));
   if(Wk){const fy=Wk.position.y, dy=it.y-(fy+0.8);
    if(d2<1.1*1.1&&dy>-1.3&&dy<1.3)collect(it);}
   else if(d2<9&&!told[it.id]){told[it.id]=1;toast('🐴 That horseshoe is '+it.hint+' — get off (🚶 or F) to reach it on foot.');}
  }
  /* what the new legs are for: rocks topped, metres swum */
  if(on&&F.state){
   const st=F.state();
   if(st.mode==='swim'){swimAcc+=Math.abs(player.speed||0)*dt;if(swimAcc>=5){const add=swimAcc;swimAcc=0;G.save.sync(s=>{s.treasure.swimM=(s.treasure.swimM||0)+add;});}}
   climbCheck+=dt;
   if(climbCheck>0.5){climbCheck=0;const rk=F.standingOn&&F.standingOn();
    if(rk&&st.feet>=1.5){const key=Math.round(rk.x)+','+Math.round(rk.z);let first=false;
     G.save.sync(s=>{if(!s.treasure.climbed[key]){s.treasure.climbed[key]=1;first=true;}});
     if(first){const n=Object.keys((G.save.fresh().treasure||{}).climbed||{}).length;toast('🧗 On top of the rock! ('+n+' climbed)');}}}
   /* the first time she is on her feet, say what there is to find */
   if(!hinted){hintT+=dt;if(hintT>4){hinted=true;const s=G.save.fresh();
    if(s&&s.treasure&&!s.treasure.hinted){G.save.sync(x=>{x.treasure.hinted=1;});
     toast('✨ '+TOTAL+' golden horseshoes are hidden round the valley — high on rocks and out in the water. Walk into a rock and keep going to climb it; wade in deep to swim.');}}}
  }
 });

 /* ---------------------------------------------------------------- goals ----------------- */
 try{
  G.quest.addAch({id:'treasure12',icon:'✨',label:'Treasure hunter',desc:'Find all '+TOTAL+' golden horseshoes hidden on rocks and in the water',v:s=>Object.keys((s.treasure&&s.treasure.found)||{}).length,goal:TOTAL,r:{g:15,k:3}});
  G.quest.addAch({id:'climb5',icon:'🧗',label:'Mountain goat',desc:'Climb to the top of 5 different rocks on foot',v:s=>Object.keys((s.treasure&&s.treasure.climbed)||{}).length,goal:5,r:{g:4,c:250}});
  G.quest.addAch({id:'swim100',icon:'🏊',label:'Water baby',desc:'Swim 100 metres on foot',v:s=>Math.floor((s.treasure&&s.treasure.swimM)||0),goal:100,r:{c:300,g:2}});
 }catch(e){}
 G.on('state',o=>{const s=G.save.fresh()||{},t=s.treasure||{};o.treasures={found:Object.keys(t.found||{}).length,total:TOTAL,climbed:Object.keys(t.climbed||{}).length,swimM:Math.floor(t.swimM||0)};});
 G.treasures={spots:()=>items.map(i=>({id:i.id,kind:i.kind,x:+i.x.toFixed(2),y:+i.y.toFixed(2),z:+i.z.toFixed(2),found:i.found})),total:TOTAL,collect:id=>{const it=items.find(i=>i.id===id);if(it)collect(it);},
  track,tracked:()=>tracked&&!tracked.found?{id:tracked.id,x:+tracked.x.toFixed(2),z:+tracked.z.toFixed(2)}:null};
}

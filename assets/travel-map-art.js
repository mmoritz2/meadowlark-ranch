/* Static cartography for the travel screen. Coordinates remain world coordinates:
   north is -z, and (-500,-500) is the canvas's top-left corner. */
const SIZE=1200, EXTENT=1000, GRID=301, SCALE=SIZE/EXTENT;
const CACHE=new WeakMap();
const EMPTY=Object.freeze([]);
const flat=()=>0, defaultRiver=x=>120+Math.sin(x*.012)*45;
const defaultStream=z=>118+Math.sin(z*.03)*14+Math.sin(z*.011+3)*8;
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a));return t*t*(3-2*t);};
const px=v=>(v+500)*SCALE;
function hash(x,z){let n=Math.imul(x,374761393)^Math.imul(z,668265263);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967296;}
function noise(x,z){const a=Math.floor(x),b=Math.floor(z),u=smooth(0,1,x-a),v=smooth(0,1,z-b);return (hash(a,b)*(1-u)+hash(a+1,b)*u)*(1-v)+(hash(a,b+1)*(1-u)+hash(a+1,b+1)*u)*v;}
function canvas(w,h=w){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
const PALETTE={meadow:[207,214,183],forest:[172,192,158],farm:[214,207,161],desert:[225,200,166],mountain:[220,226,218],marsh:[176,202,187]};
function biomeFor(r){
 const id=String(r.id||r.name||'').toLowerCase();
 if(/amber/.test(id))return [201,190,151];
 if(/ochre/.test(id))return [218,186,154];
 if(/frost/.test(id))return [224,232,226];
 if(r.biome&&PALETTE[r.biome])return PALETTE[r.biome];
 if(/canyon|desert/.test(id))return PALETTE.desert;
 if(/hollowpeak|falls|tundra/.test(id))return PALETTE.mountain;
 if(/marsh|willow/.test(id))return PALETTE.marsh;
 if(/farm|barley/.test(id))return PALETTE.farm;
 if(/pine|forest|wood/.test(id))return PALETTE.forest;
 return PALETTE.meadow;
}
function validLine(row){
 const pts=Array.isArray(row)?row:row?.pts;
 return Array.isArray(pts)?pts.filter(p=>Array.isArray(p)&&Number.isFinite(p[0])&&Number.isFinite(p[1])):[];
}
function strokeLine(ctx,points,color,width){
 if(points.length<2)return;
 ctx.beginPath();points.forEach((p,i)=>{if(i)ctx.lineTo(px(p[0]),px(p[1]));else ctx.moveTo(px(p[0]),px(p[1]));});
 ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();
}
function smoothHeights(a){
 const b=new Float32Array(a.length);
 for(let z=0;z<GRID;z++)for(let x=0;x<GRID;x++){
  let sum=0,weight=0;
  for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){
   const w=(dx===0?2:1)*(dz===0?2:1);
   sum+=a[clamp(z+dz,0,GRID-1)*GRID+clamp(x+dx,0,GRID-1)]*w;weight+=w;
  }
  b[z*GRID+x]=sum/weight;
 }
 return b;
}

export function createTravelMapArt({groundH=flat,riverZ=defaultRiver,streamX=defaultStream,paths=EMPTY,regions=EMPTY,worldPaths}={}){
 const extended=(typeof worldPaths==='function'?worldPaths():worldPaths)?.tracks||EMPTY;
 const prior=CACHE.get(groundH);
 if(prior&&prior.riverZ===riverZ&&prior.streamX===streamX&&prior.paths===paths&&prior.regions===regions&&prior.extended===extended&&prior.pathCount===paths.length&&prior.regionCount===regions.length&&prior.trackCount===extended.length)return prior.art;
 const out=canvas(SIZE),ctx=out.getContext('2d'),raster=canvas(GRID),rc=raster.getContext('2d');
 if(!ctx||!rc)throw new Error('Travel map needs a 2D canvas context.');
 const step=EXTENT/(GRID-1),heights=new Float32Array(GRID*GRID);
 for(let z=0;z<GRID;z++)for(let x=0;x<GRID;x++){
  const h=groundH(x*step-500,z*step-500);heights[z*GRID+x]=Number.isFinite(h)?h:0;
 }
 // A little averaging removes mesh-sized triangles while retaining the surveyed hills.
 const relief=smoothHeights(heights),img=rc.createImageData(GRID,GRID),d=img.data;
 const washes=regions.filter(r=>Number.isFinite(r.x)&&Number.isFinite(r.z)&&r.r>20&&r.r<400).map(r=>({...r,color:biomeFor(r)}));
 for(let iz=0;iz<GRID;iz++)for(let ix=0;ix<GRID;ix++){
  const x=ix*step-500,z=iz*step-500,i=iz*GRID+ix,h=relief[i];
  const dx=(relief[iz*GRID+Math.min(GRID-1,ix+1)]-relief[iz*GRID+Math.max(0,ix-1)])/(step*2);
  const dz=(relief[Math.min(GRID-1,iz+1)*GRID+ix]-relief[Math.max(0,iz-1)*GRID+ix])/(step*2);
  const n=Math.hypot(dx*2.8,1,dz*2.8),light=(dx*1.344+.76+dz*1.568)/n;
  const broad=noise(x*.010+40,z*.010-7),boundary=(broad-.5)*26;
  let r=PALETTE.meadow[0],g=PALETTE.meadow[1],b=PALETTE.meadow[2];
  for(const region of washes){
   const weight=(1-smooth(region.r*.52,region.r*1.15,Math.hypot(x-region.x,z-region.z)+boundary))*.76;
   r+=(region.color[0]-r)*weight;g+=(region.color[1]-g)*weight;b+=(region.color[2]-b)*weight;
  }
  const shade=clamp((light-.76)*31,-24,18)+clamp(h,0,30)*.13+(broad-.5)*3;
  const grain=(hash(ix+491,iz+719)-.5)*2.4,edge=smooth(438,505,Math.hypot(x,z));
  const o=i*4;
  d[o]=(r+shade)*(1-edge)+239*edge+grain;
  d[o+1]=(g+shade)*(1-edge)+232*edge+grain;
  d[o+2]=(b+shade)*(1-edge)+212*edge+grain;
  d[o+3]=255;
 }
 rc.putImageData(img,0,0);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(raster,0,0,SIZE,SIZE);

 // Fine survey lines stay behind routes and destinations. They are deliberately
 // sparse: a four-metre contour interval, only over the playable basin.
 ctx.save();ctx.beginPath();ctx.arc(SIZE/2,SIZE/2,456*SCALE,0,Math.PI*2);ctx.clip();
 ctx.lineCap='round';ctx.lineJoin='round';
 for(let level=4;level<=40;level+=4){
  ctx.beginPath();
  for(let z=0;z<GRID-1;z++)for(let x=0;x<GRID-1;x++){
   const a=relief[z*GRID+x],b=relief[z*GRID+x+1],c=relief[(z+1)*GRID+x+1],e=relief[(z+1)*GRID+x];
   if(level<Math.min(a,b,c,e)||level>Math.max(a,b,c,e))continue;
   const hits=[],s=SIZE/(GRID-1);
   const edge=(v,w,ax,az,bx,bz)=>{if((v<level)!==(w<level)){const t=(level-v)/(w-v);hits.push([(ax+(bx-ax)*t)*s,(az+(bz-az)*t)*s]);}};
   edge(a,b,x,z,x+1,z);edge(b,c,x+1,z,x+1,z+1);edge(c,e,x+1,z+1,x,z+1);edge(e,a,x,z+1,x,z);
   for(let k=0;k+1<hits.length;k+=2){ctx.moveTo(...hits[k]);ctx.lineTo(...hits[k+1]);}
  }
  ctx.strokeStyle=level%8===0?'rgba(104,110,81,.20)':'rgba(114,119,88,.11)';ctx.lineWidth=level%8===0?1.05:.7;ctx.stroke();
 }
 ctx.restore();

 // Water follows the same channel functions as the riding world.
 const river=[],creek=[];
 for(let x=-500;x<=500;x+=3)river.push([x,riverZ(x)]);
 for(let z=-330;z<=160;z+=2)creek.push([streamX(z),z]);
 ctx.lineCap='round';ctx.lineJoin='round';
 strokeLine(ctx,river,'rgba(243,237,210,.85)',15);
 strokeLine(ctx,river,'#71999b',10);
 strokeLine(ctx,river,'#94b7b4',6.7);
 strokeLine(ctx,river,'rgba(230,245,230,.55)',1.1);
 strokeLine(ctx,creek,'rgba(236,230,201,.88)',7.2);
 strokeLine(ctx,creek,'#71999b',4.2);
 strokeLine(ctx,creek,'#a0bdb8',1.7);
 const lake=regions.find(r=>r.id==='lake'||/loon lake/i.test(r.name||''))||{x:20,z:16};
 ctx.beginPath();ctx.ellipse(px(lake.x),px(lake.z),7.3*SCALE,6.2*SCALE,-.25,0,Math.PI*2);
 ctx.fillStyle='#91b3af';ctx.fill();ctx.strokeStyle='#648d90';ctx.lineWidth=1.2;ctx.stroke();

 // Venue footprints are geographic context; interactive markers are drawn by the UI.
 for(const region of regions){
  const v=region.venue;if(!v||!Number.isFinite(v.x)||!Number.isFinite(v.z))continue;
  const home=region.id==='ranch';ctx.beginPath();ctx.ellipse(px(v.x),px(v.z),(home?23.5:20)*SCALE,(home?18.5:15)*SCALE,0,0,Math.PI*2);
  ctx.fillStyle='rgba(241,225,192,.80)';ctx.fill();ctx.strokeStyle='rgba(118,111,86,.58)';ctx.lineWidth=1.6;ctx.stroke();
  ctx.beginPath();ctx.ellipse(px(v.x),px(v.z),(home?20.5:17)*SCALE,(home?15.5:12)*SCALE,0,0,Math.PI*2);
  ctx.strokeStyle='rgba(142,127,96,.35)';ctx.lineWidth=.8;ctx.stroke();
 }

 const routes=[...paths.map(p=>({pts:validLine(p),major:true})),...extended.map(p=>({pts:validLine(p),major:false}))].filter(r=>r.pts.length>1);
 for(const road of routes)strokeLine(ctx,road.pts,'rgba(122,111,86,.43)',road.major?6.2:4.8);
 for(const road of routes)strokeLine(ctx,road.pts,'#f4ead2',road.major?3.8:2.8);
 // The bridge remains distinguishable from a stretch of dry road over blue ink.
 const rz=riverZ(0);strokeLine(ctx,[[0,rz-7.5],[0,rz+7.5]],'#776b54',7.6);strokeLine(ctx,[[0,rz-7.5],[0,rz+7.5]],'#e4d3af',4.9);

 // Small settlement glyphs, without names or pin-like circles, leave room for the UI.
 const towns=new Set(['ranch','cottonwood','barleyfold','coyote','hollowpeak','amberwood','willowmere','frostpine','ochre']);
 for(const region of regions){
  if(!towns.has(region.id))continue;
  const x=px(region.x),z=px(region.z);
  ctx.save();ctx.translate(x,z);ctx.rotate(region.id==='barleyfold'?.2:-.12);
  ctx.fillStyle='#a7967a';ctx.strokeStyle='#f3ead4';ctx.lineWidth=1;
  for(const [dx,dz,w,h] of [[-12,-10,7,5],[-2,-12,6,8],[8,-7,8,5],[-10,4,6,7],[2,3,9,5]]){ctx.fillRect(dx,dz,w,h);ctx.strokeRect(dx,dz,w,h);}
  ctx.restore();
 }

 // An unobtrusive basin limit and fine border frame the surveyed area.
 ctx.beginPath();ctx.arc(SIZE/2,SIZE/2,455*SCALE,0,Math.PI*2);ctx.setLineDash([2,7]);ctx.strokeStyle='rgba(125,113,85,.25)';ctx.lineWidth=1;ctx.stroke();ctx.setLineDash([]);
 ctx.strokeStyle='rgba(139,121,86,.28)';ctx.lineWidth=1.2;ctx.strokeRect(13,13,SIZE-26,SIZE-26);
 ctx.strokeStyle='rgba(139,121,86,.12)';ctx.strokeRect(18,18,SIZE-36,SIZE-36);

 const art={canvas:out,extent:EXTENT};
 CACHE.set(groundH,{riverZ,streamX,paths,regions,extended,pathCount:paths.length,regionCount:regions.length,trackCount:extended.length,art});
 return art;
}

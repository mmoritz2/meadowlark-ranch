import {createRegionalCoverField,composeRegionalCover,tintRegionalCover} from './regional-cover-composition.mjs?v=regional-cover-2';
import {createCountrysideFieldComposition} from './countryside-field-composition.mjs?v=countryside-fields-1';
import {fieldSwardAt} from './field-sward-bands.mjs?v=field-sward-bands-4';
import {meadowMarginAt} from './pastoral-fields.mjs?v=hollowpeak-cascades-1-commons-landscape-1-connected-landforms-1';
import {coldWoodlandWeights} from './cold-woodland.mjs?v=cold-woodland-1-final-environment-1';
import {coyoteDryWeight} from './biome-weights.mjs?v=dry-foothills-1';

// Submitted pasture composition only. Original placement, growth, flower and
// woodland planning functions never read this late configured field.
export const PASTORAL_COVER_PROFILE='pastoral-open-commons-1';
const clamp=v=>Math.max(0,Math.min(1,v));
const ease=(a,b,v)=>{const t=clamp((v-a)/(b-a));return t*t*t*(t*(t*6-15)+10);};
const ZERO=Object.freeze({cut:0,cap:Infinity});
const STEP=3,MIN_X=-117,MIN_Z=-237,NX=155,NZ=188;
const MAX_X=MIN_X+(NX-1)*STEP,MAX_Z=MIN_Z+(NZ-1)*STEP;
const GROUNDS=Object.freeze([
 Object.freeze({x:-12,z:51,rx:99,rz:91,yaw:-.14}),
 Object.freeze({x:71,z:-122,rx:106,rz:91,yaw:-.20}),
 Object.freeze({x:177,z:38,rx:112,rz:91,yaw:.30}),
 Object.freeze({x:56,z:225,rx:120,rz:82,yaw:-.24}),
 Object.freeze({x:236,z:134,rx:98,rz:79,yaw:.42})
]);
const footprint=(p,x,z)=>{const dx=x-p.x,dz=z-p.z,c=Math.cos(p.yaw),s=Math.sin(p.yaw),u=(dx*c+dz*s)/p.rx,v=(-dx*s+dz*c)/p.rz;return Math.hypot(u,v);};
// One connected submitted glade in the resident grove. These two unequal
// lobes never participate in placement, eligibility, growth or tree planning.
const GROVE_GLADE=Object.freeze([
 Object.freeze({x:160,z:-168,rx:13,rz:22,yaw:.66}),
 Object.freeze({x:182,z:-190,rx:21,rz:30,yaw:.66})
]);
const GLADE_BOUNDS=Object.freeze({minX:143.04675941406035,maxX:206.76981497399163,minZ:-216.97139718580073,maxZ:-148.87965393526443});
const gladeWeight=(x,z)=>{
 if(x<=GLADE_BOUNDS.minX||x>=GLADE_BOUNDS.maxX||z<=GLADE_BOUNDS.minZ||z>=GLADE_BOUNDS.maxZ)return 0;
 // A smooth union keeps the two lobes connected without a max-join crease.
 // The broad 4.5–5.5 m inner fade is compact at the original ellipse bounds.
 const width=5+Math.sin(x*.071+z*.043)*.35+Math.sin(x*.039-z*.067)*.15;
 let remainder=1;for(const p of GROVE_GLADE)remainder*=1-ease(0,width,(1-footprint(p,x,z))*Math.min(p.rx,p.rz));
 return 1-remainder;
};
const positive=(a,o)=>Math.hypot(a[o],a[o+1],a[o+2])+Math.hypot(a[o+4],a[o+5],a[o+6])+Math.hypot(a[o+8],a[o+9],a[o+10])>1e-9;

// Actual final terrain, wet footprints, Chalk down and retired forest list are
// captured once. The numeric raster makes subsequent 47k-root packing bounded:
// four samples, without nearest-tree scans, terrain probes or biome callbacks.
export function createPastoralCoverField({terrainH,riverZ,riverLevel,streamX,wetAt=()=>false,chalkAt=()=>false,forestPoints=[],countrysideTracks=null,regionalLayout=null}){
 if(![terrainH,riverZ,riverLevel,streamX,wetAt,chalkAt].every(f=>typeof f==='function'))throw Error('Actual final pastoral world samplers required');
 const cuts=new Float32Array(NX*NZ),caps=new Float32Array(NX*NZ),shade=new Float32Array(NX*NZ);
 let forestCount=0;
 for(const p of forestPoints){
  if(!Number.isFinite(p.x+p.z)||!Number.isFinite(p.s??1))continue;
  const radius=Math.min(12,6.5+Math.max(0,p.s??1)*2),ix0=Math.max(0,Math.floor((p.x-radius-MIN_X)/STEP)),ix1=Math.min(NX-1,Math.ceil((p.x+radius-MIN_X)/STEP)),iz0=Math.max(0,Math.floor((p.z-radius-MIN_Z)/STEP)),iz1=Math.min(NZ-1,Math.ceil((p.z+radius-MIN_Z)/STEP));
  if(ix0>ix1||iz0>iz1)continue;forestCount++;
  for(let iz=iz0;iz<=iz1;iz++)for(let ix=ix0;ix<=ix1;ix++){const d=Math.hypot(MIN_X+ix*STEP-p.x,MIN_Z+iz*STEP-p.z);if(d<radius)shade[iz*NX+ix]+=1-ease(radius*.22,radius,d);}
 }
 function protectedAt(x,z){
  if(chalkAt(x,z)||wetAt(x,z)||coldWoodlandWeights(x,z).weight>.08||coyoteDryWeight(x,z)>.18)return true;
  if(x>173&&x<263&&z>-153&&z<-57)return true;
  const river=Math.abs(z-riverZ(x));
  if(river<6.6||Math.hypot(x-20,z-16)<7.5||(z<163&&Math.abs(x-streamX(z))<3.7))return true;
  return river<9.6&&terrainH(x,z)<riverLevel(x)+.18;
 }
 function authored(x,z){
  if(protectedAt(x,z))return ZERO;
  // Preserve the actual river/stream wet strip and lake; tall reeds/ferns are
  // different submitted owners and are never shortened by this field.
  const river=Math.abs(z-riverZ(x)),y=terrainH(x,z),water=riverLevel(x);
  if(!Number.isFinite(y+water))throw Error('Nonfinite pastoral terrain');
  const marsh=1-ease(78,119,Math.hypot(x-310,z-300));
  let opening=0;const wiggle=Math.sin(x*.026+z*.039)*.038+Math.sin(x*.057-z*.018)*.024;
  for(const p of GROUNDS)opening=Math.max(opening,1-ease(.57,1.02,footprint(p,x,z)+wiggle));
  if(opening===0)return ZERO;
  const slope=Math.hypot((terrainH(x+.75,z)-terrainH(x-.75,z))/1.5,(terrainH(x,z+.75)-terrainH(x,z-.75))/1.5);
  const band=fieldSwardAt(x,z).cover,margin=meadowMarginAt(x,z);
  const damp=ease(9.6,17,river),grade=1-ease(.37,.82,slope);
  // Broad cropped stands join unequal golden and flower-bank shoulders. Small
  // smooth recovery islands vary grazing without checkerboard root thinning.
  const patch=.5+.5*Math.sin(x*.027+z*.013)*Math.sin(z*.031-x*.009);
  const recovery=ease(.80,.97,.5+.5*Math.sin(x*.045-z*.019)*Math.sin(z*.041+x*.012));
  const cut=opening*(1-.985*band)*(1-.92*margin)*(1-.55*recovery)*(1-marsh)*damp*grade;
  return{cut,cap:.265+.095*patch};
 }
 let covered=0;
 for(let iz=0;iz<NZ;iz++)for(let ix=0;ix<NX;ix++){
  const x=MIN_X+ix*STEP,z=MIN_Z+iz*STEP,i=iz*NX+ix,q=authored(x,z);
  cuts[i]=q.cut*(1-ease(1.05,2.55,shade[i]));caps[i]=q.cut>0?q.cap:0;if(cuts[i]>0)covered++;
 }
 const gladeCuts=new Float32Array(NX*NZ),gladeCaps=new Float32Array(NX*NZ),trunks=new Map();
 const trunkCell=4,trunkKey=(x,z)=>Math.floor(x/trunkCell)+','+Math.floor(z/trunkCell);
 let gladeVertices=0,gladeTrees=0;
 for(const p of forestPoints){
  if(!Number.isFinite(p.x+p.z)||!Number.isFinite(p.s??1)||p.x<GLADE_BOUNDS.minX-2.2||p.x>GLADE_BOUNDS.maxX+2.2||p.z<GLADE_BOUNDS.minZ-2.2||p.z>GLADE_BOUNDS.maxZ+2.2)continue;
  // Actual final tree centres, with a small untended contact skirt. Crown-size
  // forest radii are deliberately not reused as new grazing exclusion discs.
  const tree={x:p.x,z:p.z,inner:.32+.08*Math.min(2,Math.max(0,p.s??1)),outer:1.50+.30*Math.min(2,Math.max(0,p.s??1))},key=trunkKey(p.x,p.z);
  if(!trunks.has(key))trunks.set(key,[]);trunks.get(key).push(tree);gladeTrees++;
 }
 const gx0=Math.max(0,Math.floor((GLADE_BOUNDS.minX-MIN_X)/STEP)),gx1=Math.min(NX-1,Math.ceil((GLADE_BOUNDS.maxX-MIN_X)/STEP)),gz0=Math.max(0,Math.floor((GLADE_BOUNDS.minZ-MIN_Z)/STEP)),gz1=Math.min(NZ-1,Math.ceil((GLADE_BOUNDS.maxZ-MIN_Z)/STEP));
 for(let iz=gz0;iz<=gz1;iz++)for(let ix=gx0;ix<=gx1;ix++){
  const x=MIN_X+ix*STEP,z=MIN_Z+iz*STEP,i=iz*NX+ix,weight=gladeWeight(x,z);if(weight===0||protectedAt(x,z))continue;
  const river=Math.abs(z-riverZ(x)),y=terrainH(x,z),water=riverLevel(x);if(!Number.isFinite(y+water))throw Error('Nonfinite pastoral glade terrain');
  const slope=Math.hypot((terrainH(x+.75,z)-terrainH(x-.75,z))/1.5,(terrainH(x,z+.75)-terrainH(x,z-.75))/1.5);
  const band=fieldSwardAt(x,z).cover,margin=meadowMarginAt(x,z),marsh=1-ease(78,119,Math.hypot(x-310,z-300));
  const cut=weight*(1-.985*band)*(1-.92*margin)*(1-marsh)*ease(9.6,17,river)*(1-ease(.37,.82,slope));
  gladeCuts[i]=cut;gladeCaps[i]=cut>0?.43+.07*(.5+.5*Math.sin(x*.027+z*.013)*Math.sin(z*.031-x*.009)):0;if(cut>0)gladeVertices++;
 }
 const composition=countrysideTracks?createCountrysideFieldComposition({tracks:countrysideTracks,forestPoints,protectedAt,terrainH}):null;
 const regional=regionalLayout?createRegionalCoverField({layout:regionalLayout,terrainH,wetAt:(x,z)=>wetAt(x,z)||Math.abs(z-riverZ(x))<10.5||Math.hypot(x-20,z-16)<9||(z<163&&Math.abs(x-streamX(z))<5.0),chalkAt,preserveAt:(x,z)=>!!composition?.at(x,z).weight,forestPoints}):null;
 function originalAt(x,z){
  if(x<=MIN_X||x>=MAX_X||z<=MIN_Z||z>=MAX_Z)return ZERO;
  const xx=(x-MIN_X)/STEP,zz=(z-MIN_Z)/STEP,ix=Math.floor(xx),iz=Math.floor(zz),fx=ease(0,1,xx-ix),fz=ease(0,1,zz-iz),i=iz*NX+ix;
  const a=(1-fx)*(1-fz),b=fx*(1-fz),c=(1-fx)*fz,d=fx*fz;
  const cut=cuts[i]*a+cuts[i+1]*b+cuts[i+NX]*c+cuts[i+NX+1]*d;if(cut<=1e-7||protectedAt(x,z))return ZERO;
  // A physical ceiling rather than repeated soft multipliers: near, rich,
  // scanned and static grass can safely respond again without compounding.
  const base=caps[i]*a+caps[i+1]*b+caps[i+NX]*c+caps[i+NX+1]*d;return{cut,cap:base/(cut*cut)};
 }
 function gladeAt(x,z){
  const original=originalAt(x,z),weight=gladeWeight(x,z);if(weight===0||protectedAt(x,z))return original;
  const xx=(x-MIN_X)/STEP,zz=(z-MIN_Z)/STEP,ix=Math.floor(xx),iz=Math.floor(zz),fx=ease(0,1,xx-ix),fz=ease(0,1,zz-iz),i=iz*NX+ix;
  const a=(1-fx)*(1-fz),b=fx*(1-fz),c=(1-fx)*fz,d=fx*fz;
  let cut=(gladeCuts[i]*a+gladeCuts[i+1]*b+gladeCuts[i+NX]*c+gladeCuts[i+NX+1]*d)*ease(0,.15,weight);
  if(cut<=1e-7)return original;
  const tx=Math.floor(x/trunkCell),tz=Math.floor(z/trunkCell);let skirt=1;
  for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++)for(const p of trunks.get((tx+dx)+','+(tz+dz))||[])skirt*=ease(p.inner,p.outer,Math.hypot(x-p.x,z-p.z));
  cut*=skirt;if(cut<=1e-7)return original;
  const base=gladeCaps[i]*a+gladeCaps[i+1]*b+gladeCaps[i+NX]*c+gladeCaps[i+NX+1]*d;
  return{cut:Math.max(original.cut,cut),cap:Math.min(original.cap,base/(cut*cut))};
 }
 function originalComposedAt(x,z){
  const original=gladeAt(x,z),q=composition?.at(x,z);if(!q||q.weight===0)return original;
  const w=q.weight,cap=Number.isFinite(original.cap)?original.cap*(1-w)+q.cap*w:q.cap/(w*w);
  return{cut:original.cut*(1-w)+q.cut*w,cap,floor:q.floor*w,bank:q.floor>0?w:0,seed:q.seed*w,compositionWeight:w};
 }
 function at(x,z){const original=originalComposedAt(x,z);return regional?composeRegionalCover(original,regional.at(x,z)):original;}
 function applyGrazingPixels(data,size){
  if(!ArrayBuffer.isView(data)||!Number.isInteger(size)||size<1||data.length!==size*size*4)throw Error('Existing landcover mask required');
  let changed=0;const step=1000/size,ix0=Math.max(0,Math.floor((MIN_X+500)/step)),ix1=Math.min(size-1,Math.ceil((MAX_X+500)/step)),iz0=Math.max(0,Math.floor((MIN_Z+500)/step)),iz1=Math.min(size-1,Math.ceil((MAX_Z+500)/step));
  for(let iz=iz0;iz<=iz1;iz++)for(let ix=ix0;ix<=ix1;ix++){const i=(iz*size+ix)*4+2,x=-500+(ix+.5)*step,z=-500+(iz+.5)*step,q=at(x,z),w=composition?.at(x,z).weight||0,next=Math.round(Math.max(data[i],Math.round(q.cut*255))*(1-w)+Math.round(q.cut*255)*w);if(next!==data[i]){data[i]=next;changed++;}}
  return changed+(regional?.applyGrazingPixels(data,size)||0);
 }
 return Object.freeze({profile:PASTORAL_COVER_PROFILE,bounds:Object.freeze({minX:MIN_X,maxX:MAX_X,minZ:MIN_Z,maxZ:MAX_Z}),stats:Object.freeze({gridVertices:NX*NZ,gridBytes:cuts.byteLength+caps.byteLength,step:STEP,forestCount,coveredVertices:covered,gladeVertices,gladeTrees,gladeGridBytes:gladeCuts.byteLength+gladeCaps.byteLength,gladeBounds:GLADE_BOUNDS,countryside:composition?.stats||null,regional:regional?.stats||null}),composition,regional,originalAt:gladeAt,at,applyGrazingPixels});
}
let current=null,revision=0,renderColorCacheBytes=0;
const cellCache=new WeakMap(),renderColorSources=new WeakMap();
export function configurePastoralCover(options){current=createPastoralCoverField(options);revision++;return current;}
export const getPastoralCoverField=()=>current;
export const getPastoralCoverRevision=()=>revision;
export const getPastoralPresentationStats=()=>({revision,renderColorCacheBytes});
export const pastoralCoverAt=(x,z)=>current?current.at(x,z):ZERO;
export const applyPastoralGrazingPixels=(data,size)=>current?current.applyGrazingPixels(data,size):0;

export function pastoralSourceRows(cell){
 let cached=cellCache.get(cell);if(cached&&cached.version===cell.version&&cached.count===cell.count&&cached.revision===revision)return cached;
 const cuts=new Float32Array(cell.count),caps=new Float32Array(cell.count);
 for(let row=0;row<cell.count;row++){const o=row*16,q=pastoralCoverAt(cell.matrices[o+12],cell.matrices[o+14]);cuts[row]=q.cut;caps[row]=q.cap;}
 cached={version:cell.version,count:cell.count,revision,cuts,caps};cellCache.set(cell,cached);return cached;
}
export function respondPastoralGrassMatrix(a,o,geometry,groundHeight,offsetX=0,offsetZ=0,offsetY=0,q=null){
 if(!current||!positive(a,o))return 1;
 const x=a[o+12]+offsetX,z=a[o+14]+offsetZ,sample=q||current.at(x,z),live=q&&current.composition?current.at(x,z):sample;if((sample.cut===0||!Number.isFinite(sample.cap))&&!live.compositionWeight)return 1;
 if(!geometry.boundingBox)geometry.computeBoundingBox();const b=geometry.boundingBox;
 const h=Math.abs(a[o+1])*(b.max.x-b.min.x)+Math.abs(a[o+5])*(b.max.y-b.min.y)+Math.abs(a[o+9])*(b.max.z-b.min.z);
 if(live.compositionWeight>0){
  const target=Math.max(live.floor||0,Math.min(h,live.cap));
  if(Math.abs(target-h)<=Math.max(1e-7,target*2e-7)||h<=1e-9)return 1;
  const scale=target/h,ground=typeof groundHeight==='function'?groundHeight(x,z):groundHeight;
  if(scale>=8)return 1; // Keep already minute/retired source forms rather than create tall needles.
  if(!Number.isFinite(ground)||!(scale>0))throw Error('Invalid countryside grass contact');
  // Only the world-vertical row changes. Every XZ footprint/yaw stays exact.
  for(const col of[0,4,8])a[o+col+1]*=scale;
  a[o+13]=ground-offsetY+(a[o+13]+offsetY-ground)*scale;return scale;
 }
 if(h<=sample.cap+Math.max(1e-7,sample.cap*2e-7))return 1;
 const scale=sample.cap/h,ground=typeof groundHeight==='function'?groundHeight(x,z):groundHeight;
 if(!Number.isFinite(ground)||!(scale>0&&scale<=1))throw Error('Invalid pastoral cover contact');
 for(const column of[0,4,8])for(let axis=0;axis<3;axis++)a[o+column+axis]*=scale;
 a[o+13]=ground-offsetY+(a[o+13]+offsetY-ground)*scale;return scale;
}
export function respondPastoralGrassColor(color,x,z,offset=0){
 const q=current?.composition?.at(x,z),w=q?q.seed*q.weight:0;
 // The three published field networks retain their exact original arithmetic.
 if(w){if(ArrayBuffer.isView(color)){color[offset]*=1+w*.70;color[offset+1]*=1+w*.22;color[offset+2]*=1-w*.28;}
 else{color.r*=1+w*.70;color.g*=1+w*.22;color.b*=1-w*.28;}}
 return tintRegionalCover(color,current?.regional?.at(x,z),offset)||!!w;
}
export function applyPastoralGrassMesh(mesh,groundHeight,count=mesh.count,offsetX=0,offsetZ=0,offsetY=0){
 if(!current||!mesh)return 0;let changed=0;const a=mesh.instanceMatrix.array;
 for(let row=0;row<count;row++)if(respondPastoralGrassMatrix(a,row*16,mesh.geometry,groundHeight,offsetX,offsetZ,offsetY)!==1)changed++;
 if(changed)mesh.instanceMatrix.needsUpdate=true;
 if(current.composition&&mesh.instanceColor){let source=renderColorSources.get(mesh);if(!source){source=mesh.instanceColor.array.slice();renderColorSources.set(mesh,source);renderColorCacheBytes+=source.byteLength;}let tinted=0;for(let row=0;row<count;row++){const o=row*16;mesh.instanceColor.array.set(source.subarray(row*3,row*3+3),row*3);if(respondPastoralGrassColor(mesh.instanceColor.array,a[o+12]+offsetX,a[o+14]+offsetZ,row*3))tinted++;}if(tinted)mesh.instanceColor.needsUpdate=true;}return changed;
}
export function applyPastoralSourceMesh(mesh,cells,groundHeight,count=mesh.count){
 if(!current)return 0;let row=0,changed=0;const a=mesh.instanceMatrix.array;
 for(const cell of cells){const q=pastoralSourceRows(cell);for(let k=0;k<cell.count&&row<count;k++,row++)if((q.cuts[k]>0||current.composition)&&respondPastoralGrassMatrix(a,row*16,mesh.geometry,groundHeight,0,0,0,{cut:q.cuts[k],cap:q.caps[k]})!==1)changed++;}
 if(changed)mesh.instanceMatrix.needsUpdate=true;
 if(current.composition&&mesh.instanceColor){let row=0,tinted=0;for(const cell of cells)for(let k=0;k<cell.count&&row<count;k++,row++){mesh.instanceColor.array.set(cell.colors.subarray(k*3,k*3+3),row*3);if(respondPastoralGrassColor(mesh.instanceColor.array,cell.matrices[k*16+12],cell.matrices[k*16+14],row*3))tinted++;}if(tinted)mesh.instanceColor.needsUpdate=true;}return changed;
}

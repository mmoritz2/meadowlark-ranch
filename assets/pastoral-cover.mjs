import {fieldSwardAt} from './field-sward-bands.mjs?v=field-sward-bands-4';
import {meadowMarginAt} from './pastoral-fields.mjs?v=hollowpeak-cascades-1-commons-landscape-1';
import {coldWoodlandWeights} from './cold-woodland.mjs?v=cold-woodland-1';
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
const positive=(a,o)=>Math.hypot(a[o],a[o+1],a[o+2])+Math.hypot(a[o+4],a[o+5],a[o+6])+Math.hypot(a[o+8],a[o+9],a[o+10])>1e-9;

// Actual final terrain, wet footprints, Chalk down and retired forest list are
// captured once. The numeric raster makes subsequent 47k-root packing bounded:
// four samples, without nearest-tree scans, terrain probes or biome callbacks.
export function createPastoralCoverField({terrainH,riverZ,riverLevel,streamX,wetAt=()=>false,chalkAt=()=>false,forestPoints=[]}){
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
 function at(x,z){
  if(x<=MIN_X||x>=MAX_X||z<=MIN_Z||z>=MAX_Z)return ZERO;
  const xx=(x-MIN_X)/STEP,zz=(z-MIN_Z)/STEP,ix=Math.floor(xx),iz=Math.floor(zz),fx=ease(0,1,xx-ix),fz=ease(0,1,zz-iz),i=iz*NX+ix;
  const a=(1-fx)*(1-fz),b=fx*(1-fz),c=(1-fx)*fz,d=fx*fz;
  const cut=cuts[i]*a+cuts[i+1]*b+cuts[i+NX]*c+cuts[i+NX+1]*d;if(cut<=1e-7||protectedAt(x,z))return ZERO;
  // A physical ceiling rather than repeated soft multipliers: near, rich,
  // scanned and static grass can safely respond again without compounding.
  const base=caps[i]*a+caps[i+1]*b+caps[i+NX]*c+caps[i+NX+1]*d;return{cut,cap:base/(cut*cut)};
 }
 function applyGrazingPixels(data,size){
  if(!ArrayBuffer.isView(data)||!Number.isInteger(size)||size<1||data.length!==size*size*4)throw Error('Existing landcover mask required');
  let changed=0;const step=1000/size,ix0=Math.max(0,Math.floor((MIN_X+500)/step)),ix1=Math.min(size-1,Math.ceil((MAX_X+500)/step)),iz0=Math.max(0,Math.floor((MIN_Z+500)/step)),iz1=Math.min(size-1,Math.ceil((MAX_Z+500)/step));
  for(let iz=iz0;iz<=iz1;iz++)for(let ix=ix0;ix<=ix1;ix++){const i=(iz*size+ix)*4+2,next=Math.max(data[i],Math.round(at(-500+(ix+.5)*step,-500+(iz+.5)*step).cut*255));if(next>data[i]){data[i]=next;changed++;}}
  return changed;
 }
 return Object.freeze({profile:PASTORAL_COVER_PROFILE,bounds:Object.freeze({minX:MIN_X,maxX:MAX_X,minZ:MIN_Z,maxZ:MAX_Z}),stats:Object.freeze({gridVertices:NX*NZ,gridBytes:cuts.byteLength+caps.byteLength,step:STEP,forestCount,coveredVertices:covered}),at,applyGrazingPixels});
}
let current=null,revision=0;
const cellCache=new WeakMap();
export function configurePastoralCover(options){current=createPastoralCoverField(options);revision++;return current;}
export const getPastoralCoverField=()=>current;
export const getPastoralCoverRevision=()=>revision;
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
 const x=a[o+12]+offsetX,z=a[o+14]+offsetZ,sample=q||current.at(x,z);if(sample.cut===0||!Number.isFinite(sample.cap))return 1;
 if(!geometry.boundingBox)geometry.computeBoundingBox();const b=geometry.boundingBox;
 const h=Math.abs(a[o+1])*(b.max.x-b.min.x)+Math.abs(a[o+5])*(b.max.y-b.min.y)+Math.abs(a[o+9])*(b.max.z-b.min.z);
 if(h<=sample.cap+Math.max(1e-7,sample.cap*2e-7))return 1;
 const scale=sample.cap/h,ground=typeof groundHeight==='function'?groundHeight(x,z):groundHeight;
 if(!Number.isFinite(ground)||!(scale>0&&scale<=1))throw Error('Invalid pastoral cover contact');
 for(const column of[0,4,8])for(let axis=0;axis<3;axis++)a[o+column+axis]*=scale;
 a[o+13]=ground-offsetY+(a[o+13]+offsetY-ground)*scale;return scale;
}
export function applyPastoralGrassMesh(mesh,groundHeight,count=mesh.count,offsetX=0,offsetZ=0,offsetY=0){
 if(!current||!mesh)return 0;let changed=0;const a=mesh.instanceMatrix.array;
 for(let row=0;row<count;row++)if(respondPastoralGrassMatrix(a,row*16,mesh.geometry,groundHeight,offsetX,offsetZ,offsetY)<1)changed++;
 if(changed)mesh.instanceMatrix.needsUpdate=true;return changed;
}
export function applyPastoralSourceMesh(mesh,cells,groundHeight,count=mesh.count){
 if(!current)return 0;let row=0,changed=0;const a=mesh.instanceMatrix.array;
 for(const cell of cells){const q=pastoralSourceRows(cell);for(let k=0;k<cell.count&&row<count;k++,row++)if(q.cuts[k]>0&&respondPastoralGrassMatrix(a,row*16,mesh.geometry,groundHeight,0,0,0,{cut:q.cuts[k],cap:q.caps[k]})<1)changed++;}
 if(changed)mesh.instanceMatrix.needsUpdate=true;return changed;
}

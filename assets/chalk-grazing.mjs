// Pure original cover composition for a surveyed Chalk Mare down.
// This prototype does not install itself, create resources or read world state.
const clamp=v=>Math.max(0,Math.min(1,v));
const ease=(a,b,v)=>{const t=clamp((v-a)/(b-a));return t*t*t*(t*(t*6-15)+10);};
const ZERO=Object.freeze({cut:0,damp:0,uncut:0,flower:1,cap:Infinity});
export const CHALK_GRAZING_PROFILE='chalk-grazed-downland-1';
export function createChalkGrazingField(site){
 if(!site||!['x','z','len','depth','h'].every(k=>Number.isFinite(site[k]))||site.len<=0||site.depth<=0||site.h<=0)throw Error('Finite actual surveyed chalk-down site required');
 const s=Object.freeze({x:site.x,z:site.z,len:site.len,depth:site.depth,h:site.h});
 const face=Math.atan2(s.x,s.z),ax=Math.cos(face),az=-Math.sin(face),ox=Math.sin(face),oz=Math.cos(face);
 const corners=[[-.5,0],[-.5,1],[.5,0],[.5,1]].map(([u,t])=>[s.x+ax*u*s.len+ox*(t-.5)*s.depth,s.z+az*u*s.len+oz*(t-.5)*s.depth]);
 const bounds=Object.freeze({minX:Math.min(...corners.map(p=>p[0])),maxX:Math.max(...corners.map(p=>p[0])),minZ:Math.min(...corners.map(p=>p[1])),maxZ:Math.max(...corners.map(p=>p[1]))});
 const frame=(u,t)=>[s.x+ax*u+ox*(t-.5)*s.depth,s.z+az*u+oz*(t-.5)*s.depth];
 const local=(x,z)=>{const dx=x-s.x,dz=z-s.z;return[dx*ax+dz*az,(dx*ox+dz*oz)/s.depth+.5];};
 function atLocal(u,t){
  const U=u/s.len;if(!Number.isFinite(U+t)||Math.abs(U)>=.5||t<=0||t>=1)return ZERO;
  // The short front follows the whole lower down, not a horse-shaped halo.
  // It is fully short across the galloping panel and open leg spaces, with a
  // broad uneven transition onto two unequal, open-ended uncut shoulders.
  const edge=Math.sin(U*17+t*6)*.012+Math.sin(U*41-t*11)*.005;
  const across=1-ease(.23,.445,Math.abs(U)+edge);
  const front=ease(.008,.065,t)*(1-ease(.58,.83,t));
  const leftCenter=-.355+.060*t,rightCenter=.315-.035*t;
  const left=(1-ease(.25,1,Math.abs(U-leftCenter)/(.058+.025*t)))*ease(.12,.25,t)*(1-ease(.84,.96,t));
  const right=.64*(1-ease(.25,1,Math.abs(U-rightCenter)/(.047+.010*t)))*ease(.17,.31,t)*(1-ease(.69,.86,t));
  const uncut=Math.max(left,right);
  // Toe growth collects in the two existing unequal combes. It denotes a
  // moister sward response, never a new water surface or terrain change.
  const toe=ease(.005,.025,t)*(1-ease(.075,.11,t));
  const leftSwale=1-ease(.35,1,Math.abs(U-(-.27+.16*t))/.16);
  const rightSwale=.68*(1-ease(.30,1,Math.abs(U-(.30-.19*t))/.115));
  const damp=toe*Math.max(leftSwale,rightSwale);
  const cut=across*front*(1-.94*uncut)*(1-.35*damp);
  if(cut===0&&uncut===0&&damp===0)return ZERO;
  const cap=.145+.028*Math.sin(U*12+t*8)*Math.sin(U*19-t*4)+.17*damp;
  return{cut,damp,uncut,flower:1-ease(.28,.78,cut),cap};
 }
 const at=(x,z)=>{if(x<=bounds.minX||x>=bounds.maxX||z<=bounds.minZ||z>=bounds.maxZ)return ZERO;return atLocal(...local(x,z));};
 const heightScale=(x,z,height)=>{if(!Number.isFinite(height)||height<0)throw Error('Finite nonnegative existing height required');if(height===0)return 1;const q=at(x,z);return q.cut===0||height<=q.cap?1:1-q.cut*(1-q.cap/height);};
 // Apply after the original tree skirts. Only cached-mask blue may increase;
 // red/green/alpha and all exterior texels are retained exactly.
 function applyGrazingPixels(data,size){
  if(!ArrayBuffer.isView(data)||!Number.isInteger(size)||size<1||data.length!==size*size*4)throw Error('Valid existing landcover mask required');
  const step=1000/size,ix0=Math.max(0,Math.floor((bounds.minX+500)/step)),ix1=Math.min(size-1,Math.ceil((bounds.maxX+500)/step)),iz0=Math.max(0,Math.floor((bounds.minZ+500)/step)),iz1=Math.min(size-1,Math.ceil((bounds.maxZ+500)/step));let changed=0;
  for(let iz=iz0;iz<=iz1;iz++)for(let ix=ix0;ix<=ix1;ix++){
   const x=-500+(ix+.5)*step,z=-500+(iz+.5)*step,i=(iz*size+ix)*4+2,next=Math.max(data[i],Math.round(at(x,z).cut*255));if(next>data[i]){data[i]=next;changed++;}
  }
  return changed;
 }
 return Object.freeze({profile:CHALK_GRAZING_PROFILE,site:s,bounds,frame,local,atLocal,at,heightScale,applyGrazingPixels});
}

// Site configuration is explicit and late: the surveyed scarp can relocate.
// Imports remain inert; original sequential placement predicates never read it.
let current=null,revision=0;
export function configureChalkGrazing(site){
 if(current&&['x','z','len','depth','h'].every(k=>current.site[k]===site?.[k]))return current;
 current=createChalkGrazingField(site);revision++;return current;
}
export const getChalkGrazingField=()=>current;
export const getChalkGrazingRevision=()=>revision;
export const chalkGrazingAt=(x,z)=>current?current.at(x,z):ZERO;
export const applyChalkGrazingPixels=(data,size)=>current?current.applyGrazingPixels(data,size):0;

// All responses operate on an already accepted source row. They retain x/z,
// yaw, colour, count, source cells and every byte of the unchanged outside path.
const positiveBasis=(a,o)=>Math.hypot(a[o],a[o+1],a[o+2])+Math.hypot(a[o+4],a[o+5],a[o+6])+Math.hypot(a[o+8],a[o+9],a[o+10])>1e-9;
export function respondChalkGrassMatrix(a,o,geometry,groundHeight,offsetX=0,offsetZ=0,offsetY=0){
 if(!current)return 1;
 const x=a[o+12]+offsetX,z=a[o+14]+offsetZ,q=current.at(x,z);
 if(q.cut===0||!positiveBasis(a,o))return 1;
 if(!geometry.boundingBox)geometry.computeBoundingBox();
 const b=geometry.boundingBox,height=Math.abs(a[o+1])*(b.max.x-b.min.x)+Math.abs(a[o+5])*(b.max.y-b.min.y)+Math.abs(a[o+9])*(b.max.z-b.min.z);
 if(height<=q.cap||height<=1e-9)return 1;
 const scale=1-q.cut*(1-q.cap/height),ground=typeof groundHeight==='function'?groundHeight(x,z):groundHeight;
 if(!Number.isFinite(ground)||!(scale>0&&scale<=1))throw Error('Invalid chalk cover contact');
 for(const column of [0,4,8])for(let axis=0;axis<3;axis++)a[o+column+axis]*=scale;
 a[o+13]=ground-offsetY+(a[o+13]+offsetY-ground)*scale;
 return scale;
}
export function respondChalkFlowerMatrix(a,o,offsetX=0,offsetZ=0){
 if(!current||!positiveBasis(a,o))return 1;
 const scale=current.at(a[o+12]+offsetX,a[o+14]+offsetZ).flower;if(scale===1)return 1;
 for(const column of [0,4,8])for(let axis=0;axis<3;axis++)a[o+column+axis]*=scale;
 return scale;
}
export function applyChalkGrassMesh(mesh,groundHeight,count=mesh.count,offsetX=0,offsetZ=0,offsetY=0){
 if(!current)return 0;let changed=0;const a=mesh.instanceMatrix.array;
 for(let row=0;row<count;row++)if(respondChalkGrassMatrix(a,row*16,mesh.geometry,groundHeight,offsetX,offsetZ,offsetY)<1)changed++;
 if(changed)mesh.instanceMatrix.needsUpdate=true;return changed;
}
export function applyChalkFlowerMesh(mesh,count=mesh.count,offsetX=0,offsetZ=0){
 if(!current)return 0;let changed=0;const a=mesh.instanceMatrix.array;
 for(let row=0;row<count;row++)if(respondChalkFlowerMatrix(a,row*16,offsetX,offsetZ)<1)changed++;
 if(changed)mesh.instanceMatrix.needsUpdate=true;return changed;
}

// Seed grass predates the down's walkable overlay. Re-seat only positive
// original rows whose original ground has actually risen; never revive rows
// already zeroed by winter, water, roads or courses. Called once after layout.
export function refreshChalkSeedMesh(mesh,down,world,{flower=false,reseat=true,offsetX=0,offsetZ=0,offsetY=0}={}){
 const stats={examined:0,positive:0,reseated:0,shortened:0,cut:0,alreadyZero:0,maxRise:0};if(!current||!mesh)return stats;
 const a=mesh.instanceMatrix.array;
 for(let row=0;row<mesh.instanceMatrix.count;row++){
  const o=row*16,x=a[o+12]+offsetX,z=a[o+14]+offsetZ,h=down.heightAt(x,z);if(!Number.isFinite(h))continue;
  stats.examined++;if(!positiveBasis(a,o)){stats.alreadyZero++;continue;}stats.positive++;
  const base=world.terrainH(x,z),ground=world.groundH(x,z);
  if(reseat&&h>base+1e-5){const previous=a[o+13]+offsetY;a[o+13]=ground-offsetY+(previous-base);stats.reseated++;stats.maxRise=Math.max(stats.maxRise,ground-base);}
  if(down.isChalk(x,z)){for(const column of [0,4,8])for(let axis=0;axis<3;axis++)a[o+column+axis]=0;stats.cut++;}
  else if((flower?respondChalkFlowerMatrix(a,o,offsetX,offsetZ):respondChalkGrassMatrix(a,o,mesh.geometry,world.groundH,offsetX,offsetZ,offsetY))<1)stats.shortened++;
 }
 if(stats.reseated||stats.shortened||stats.cut){mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere?.();}
 return stats;
}

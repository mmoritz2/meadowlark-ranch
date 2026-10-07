// Authored metre-scale plots: reserve these before scattering scenery. Quest
// stops, the orchard and the ranch-to-Barleyfold riding line stay in place.
export const COTTONWOOD_PLOTS={
 store:{x:34,z:-57,rot:Math.PI/2,width:7,depth:5},
 clubhouse:{x:33,z:-43,rot:Math.PI/2,width:7,depth:5},
 inn:{x:47,z:-66,rot:0,width:12,depth:7.6},
 auction:{x:76,z:-74,rot:0,width:7,depth:5.5},
};
export const COTTONWOOD_COTTAGES=[
 {x:48,z:-35,rot:Math.PI,variant:0},{x:56,z:-36,rot:Math.PI,variant:1},
 {x:33,z:-70,rot:0,variant:2},{x:39,z:-73,rot:0,variant:0},
];
export function villageRect(id,x,z,width,depth,rot=0){
 return {id,x,z,sin:Math.sin(rot),cos:Math.cos(rot),halfX:width/2,minZ:-depth/2,maxZ:depth/2};
}
function lane(id,a,b,width){
 return villageRect(id,(a[0]+b[0])/2,(a[1]+b[1])/2,width,Math.hypot(b[0]-a[0],b[1]-a[1]),Math.atan2(b[0]-a[0],b[1]-a[1]));
}
export const COTTONWOOD_PUBLIC=[
 villageRect('square',48.5,-51,22,20),
 lane('ranch-approach',[28,-30],[46,-48],6.2),
 lane('orchard-road',[53,-57],[82,-65.8],6.3),
 lane('auction-approach',[60,-58],[63,-68],5.2),
 lane('north-street',[63,-68],[76,-68],5.4),
 lane('cottage-approach',[36,-66],[39,-59.4],4),
 villageRect('auction-court',76,-68.5,10,6),
 villageRect('cottage-lane',52,-39,15,4.4),
 villageRect('north-cottages',36,-68.5,11,4),
];
export function villageRectDistance(q,x,z){
 const dx=x-q.x,dz=z-q.z,lx=dx*q.cos-dz*q.sin,lz=dx*q.sin+dz*q.cos;
 const ax=Math.abs(lx)-q.halfX,az=Math.max(q.minZ-lz,lz-q.maxZ);
 return Math.hypot(Math.max(0,ax),Math.max(0,az))+Math.min(0,Math.max(ax,az));
}
const plots=[...Object.values(COTTONWOOD_PLOTS),...COTTONWOOD_COTTAGES.map(p=>({...p,width:3.4,depth:2.8}))]
 .map((p,i)=>villageRect('plot-'+i,p.x,p.z,p.width+3,p.depth+3,p.rot));
const reserved=[...COTTONWOOD_PUBLIC,...plots];
export function cottonwoodReserved(x,z,margin=0){
 if(x<22-margin||x>86+margin||z< -80-margin||z> -25+margin)return false;
 return reserved.some(q=>villageRectDistance(q,x,z)<margin);
}
export const COTTONWOOD_GARDENS=[
 {x:39,z:-61.9,width:3.4,depth:1.15},{x:55.3,z:-61.9,width:3.4,depth:1.15},
 {x:46.5,z:-39.7,width:3.2,depth:1.15},{x:58.6,z:-43,width:1.15,depth:3.4},
];

// Dirt ribbons remain continuous outside town but cannot draw over the stone
// street, even with a negative polygon offset or a lower graphics resolution.
export function clipVillageRoads(material){
 const previous=material.onBeforeCompile,cache=material.customProgramCacheKey;
 const fixed=n=>Number(n).toFixed(6);
 const tests=COTTONWOOD_PUBLIC.map(q=>`{
  vec2 d=villageRoadXZ-vec2(${fixed(q.x)},${fixed(q.z)});
  vec2 p=vec2(d.x*${fixed(q.cos)}-d.y*${fixed(q.sin)},d.x*${fixed(q.sin)}+d.y*${fixed(q.cos)});
  if(abs(p.x)<${fixed(q.halfX-.04)}&&p.y>${fixed(q.minZ+.04)}&&p.y<${fixed(q.maxZ-.04)})discard;
 }`).join('\n');
 material.onBeforeCompile=(shader,renderer)=>{
  previous?.call(material,shader,renderer);
  shader.vertexShader='varying vec2 villageRoadXZ;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\n villageRoadXZ=(modelMatrix*vec4(transformed,1.0)).xz;');
  shader.fragmentShader='varying vec2 villageRoadXZ;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\n if(villageRoadXZ.x>23.0&&villageRoadXZ.x<86.0&&villageRoadXZ.y> -80.0&&villageRoadXZ.y< -25.0){'+tests+'}');
 };
 material.customProgramCacheKey=()=>cache.call(material)+'-village-square-1';
}

export const COTTONWOOD_TREES=[{x:39.4,z:-61.9,height:10.2,yaw:.3},{x:58.6,z:-42.5,height:9.4,yaw:2.1},{x:43.5,z:-37.4,height:8.7,yaw:1.2}];

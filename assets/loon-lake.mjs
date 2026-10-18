// Original Loon Lake profile, bound to the actual home-arena and oak survey.
// This module allocates no renderer resources and never reads an ambient RNG.
const smooth=(a,b,v)=>{const q=Math.max(0,Math.min(1,(v-a)/(b-a)));return q*q*(3-2*q);};
const DRAFT_POINTS=[
 [15.4,15.8],[15.8,14.2],[17.8,12.8],[20.5,11.6],
 [23.6,10.1],[27.7,8.1],[32.8,6.4],[37.8,6.7],[42.7,8.2],
 [46.0,10.8],[47.6,14.2],[46.7,17.1],[43.1,19.8],
 [38.5,21.0],[34.9,23.0],[31.7,23.7],[29.9,22.4],
 [29.3,19.9],[27.6,19.1],[25.1,20.3],[23.0,21.8],
 [20.8,21.7],[18.4,20.2],[16.8,18.1]
];
const points=Object.freeze(DRAFT_POINTS.map(p=>Object.freeze(p)));
// Unequal real island retains the captured mature oak's complete low wood base.
// These exact canonical-node core limits include the .50 m wood band plus .30 m.
const ISLAND_CORE=Object.freeze({minX:35.15625,maxX:41.015625,minZ:13.671875,maxZ:17.578125});
const island=Object.freeze([[34.3,13.7],[35.1,11.9],[37.6,11.3],[40.9,11.8],[42.7,13.5],[43.0,16.0],[41.8,18.8],[39.4,19.5],[36.2,19.1],[34.5,17.1]].reverse().map(p=>Object.freeze(p)));
const contours=Object.freeze([points,island]);
const ROOT_CORE_2=Object.freeze({minX:42.96875,maxX:46.875,minZ:5.859375,maxZ:9.765625});
const bounds=Object.freeze({minX:15.4,maxX:47.6,minZ:6.4,maxZ:23.7});
export const LOON_LAKE=Object.freeze({profile:'loon-lake-4',center:Object.freeze([20,16]),level:0,bounds,shoreWidth:3.5,points,island,protectedRootCores:Object.freeze([ISLAND_CORE,ROOT_CORE_2])});

export function loonLakeFootprintPoints(){return points.map(p=>p.slice());}
export function loonLakeFootprintContours(){return contours.map(c=>c.map(p=>p.slice()));}
function contourDistance(x,z,vertices){
 if(!Number.isFinite(x+z))return Infinity;
 let inside=false,d2=Infinity;
 for(let i=0,j=vertices.length-1;i<vertices.length;j=i++){
  const a=vertices[j],b=vertices[i],dx=b[0]-a[0],dz=b[1]-a[1],len=dx*dx+dz*dz;
  const t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/len));
  d2=Math.min(d2,(x-a[0]-dx*t)**2+(z-a[1]-dz*t)**2);
  if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])inside=!inside;
 }
 const d=Math.sqrt(d2);return inside?-d:d;
}
export function loonLakeShoreDistance(x,z){return Math.max(contourDistance(x,z,points),-contourDistance(x,z,island));}
export function loonLakeContainsWater(x,z,margin=0){
 if(x<bounds.minX-margin||x>bounds.maxX+margin||z<bounds.minZ-margin||z>bounds.maxZ+margin)return false;
 return loonLakeShoreDistance(x,z)<=margin;
}
export function loonLakeDistanceToWater(x,z){return Math.max(0,loonLakeShoreDistance(x,z));}
export function loonLakeDryPoint(x,z,margin=0){
 if(!Number.isFinite(x+z+margin)||margin<0)throw Error('Finite nonnegative Loon shore clearance required');
 if(!loonLakeContainsWater(x,z,margin))return [x,z];
 let best=null,d2=Infinity;
 function consider(px,pz){
  if(loonLakeContainsWater(px,pz,margin))return;
  const d=(px-x)**2+(pz-z)**2;if(d<d2){d2=d;best=[px,pz];}
 }
 for(const contour of contours)for(let i=0;i<contour.length;i++){
   const a=contour[i],b=contour[(i+1)%contour.length],dx=b[0]-a[0],dz=b[1]-a[1],len=dx*dx+dz*dz;
   const t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/len)),px=a[0]+dx*t,pz=a[1]+dz*t,inv=1/Math.sqrt(len);
   consider(px+dz*inv*(margin+.002),pz-dx*inv*(margin+.002));
  }
 // These four candidates are also verified, not assumed safe. They provide a
 // finite outer-bank exit when a large buffer cannot fit on the oak island.
 consider(bounds.minX-margin-.002,z);consider(bounds.maxX+margin+.002,z);
 consider(x,bounds.minZ-margin-.002);consider(x,bounds.maxZ+margin+.002);
 if(!best)throw Error('No verified dry Loon shoreline point');return best;
}

// Applied before Float32 canonical terrain construction. The surrounding terrain
// and its rendered/collision triangles remain the same authority after carving.
export function loonLakeTerrainHeight(x,z,parentHeight){
 const collar=LOON_LAKE.shoreWidth;
 if(x<bounds.minX-collar||x>bounds.maxX+collar||z<bounds.minZ-collar||z>bounds.maxZ+collar)return parentHeight;
 const sd=loonLakeShoreDistance(x,z);if(sd>=collar)return parentHeight;
 // The actual sand oval remains a protected riding surface, including its edge.
 const step=1.953125;
 // Every node of a canonical cell touching the sand oval is protected. Merely
 // preserving analytic points inside the oval still changes its edge triangles.
 let arena=smooth(1,1.06,Math.hypot(Math.max(0,Math.abs(x)-step)/23.5,Math.max(0,Math.abs(z)-step)/18.5));if(arena===0)return parentHeight;
 for(const core of LOON_LAKE.protectedRootCores){const d=Math.hypot(Math.max(core.minX-x,0,x-core.maxX),Math.max(core.minZ-z,0,z-core.maxZ));arena*=smooth(0,1.4,d);}
 if(arena===0)return parentHeight;
 let target;
 if(sd<=0){const d=-sd;target=LOON_LAKE.level-Math.min(1.65,.22*d+.025*d*d);}
 else{const edge=LOON_LAKE.level+.13*sd;target=edge+(parentHeight-edge)*smooth(.6,collar,sd);}
 return parentHeight+(target-parentHeight)*arena;
}

// Historical planning can explicitly retain the pre-lake height without a late
// terrain edit or a second physical floor. It is deliberately an identity.
export const legacyLoonLakeTerrainHeight=(x,z,parentHeight)=>parentHeight;

// Exact wet faces and their welded boundary are derived from the same canonical
// triangles as terrainH. Flat zero-depth terrain is deliberately excluded.
export function buildLoonLakeWetSurface({terrainH,terrainStep=1.953125}){
 const verts=[],faces=[],cells=[],cache=new Map(),step=terrainStep,B=LOON_LAKE.bounds;
 const key=(x,z)=>Math.fround(x)+','+Math.fround(z);
 function vertex(p){const k=key(p.x,p.z);if(cache.has(k))return cache.get(k);const i=verts.length;verts.push({x:Math.fround(p.x),z:Math.fround(p.z),bed:terrainH(Math.fround(p.x),Math.fround(p.z))});cache.set(k,i);return i;}
 function wet(poly){const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],da=LOON_LAKE.level-a.y,db=LOON_LAKE.level-b.y;if(da>=0)out.push(a);if((da>=0)!==(db>=0)){const t=da/(da-db);out.push({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t,y:LOON_LAKE.level});}}return out;}
 const loX=Math.floor((B.minX-6.3+500)/step),hiX=Math.ceil((B.maxX+6.3+500)/step),loZ=Math.floor((B.minZ-6.3+500)/step),hiZ=Math.ceil((B.maxZ+6.3+500)/step);
 for(let iz=loZ;iz<hiZ;iz++)for(let ix=loX;ix<hiX;ix++){
  const x=ix*step-500,z=iz*step-500,v=[[x,z],[x+step,z],[x,z+step],[x+step,z+step]].map(([x,z])=>({x,z,y:terrainH(x,z)}));
  for(let side=0;side<2;side++){
   const tri=side?[v[3],v[2],v[1]]:[v[0],v[1],v[2]];if(!tri.some(p=>p.y<LOON_LAKE.level-1e-9))continue;
   const p=wet(tri);for(let k=1;k<p.length-1;k++){
    const ids=[vertex(p[0]),vertex(p[k+1]),vertex(p[k])],a=verts[ids[0]],b=verts[ids[1]],c=verts[ids[2]];
    if(Math.abs((b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x))<1e-9)continue;
    faces.push(ids);cells.push((iz*512+ix)*2+side);
   }
  }
 }
 const edges=new Map();for(const f of faces)for(let i=0;i<3;i++){const a=f[i],b=f[(i+1)%3],k=Math.min(a,b)+','+Math.max(a,b),prior=edges.get(k);if(prior)prior.count++;else edges.set(k,{a,b,count:1});}
 const boundary=[...edges.values()].filter(e=>e.count===1);if([...edges.values()].some(e=>e.count>2))throw Error('Nonmanifold canonical Loon water');
 const next=new Map();for(const e of boundary){if(next.has(e.a))throw Error('Ambiguous canonical Loon water boundary');next.set(e.a,e.b);}
 const contours=[];while(next.size){const start=next.keys().next().value,loop=[];let v=start;
  do{loop.push([verts[v].x,verts[v].z]);const n=next.get(v);if(n===undefined)throw Error('Open canonical Loon water boundary');next.delete(v);v=n;if(loop.length>boundary.length)throw Error('Cyclic canonical Loon trace');}while(v!==start);
  contours.push(loop);
 }
 const xs=verts.map(p=>p.x),zs=verts.map(p=>p.z),bounds={minX:Math.min(...xs),maxX:Math.max(...xs),minZ:Math.min(...zs),maxZ:Math.max(...zs)};
 return {verts,faces,sourceCells:cells,contours,bounds,level:LOON_LAKE.level};
}

export function createLoonWetQueries(wet){
 const contours=wet.contours,B=wet.bounds;
 function shoreDistance(x,z){let inside=false,d=Infinity;for(const c of contours){const sd=contourDistance(x,z,c);if(sd<0)inside=!inside;d=Math.min(d,Math.abs(sd));}return inside?-d:d;}
 const containsWater=(x,z,margin=0)=>x>=B.minX-margin&&x<=B.maxX+margin&&z>=B.minZ-margin&&z<=B.maxZ+margin&&shoreDistance(x,z)<=margin;
 function dryPoint(x,z,margin=0){
  if(!containsWater(x,z,margin))return[x,z];let best=null,d2=Infinity;
  function candidate(px,pz){if(containsWater(px,pz,margin))return;const d=(px-x)**2+(pz-z)**2;if(d<d2){d2=d;best=[px,pz];}}
  for(const c of contours)for(let i=0;i<c.length;i++){const a=c[i],b=c[(i+1)%c.length],dx=b[0]-a[0],dz=b[1]-a[1],len=dx*dx+dz*dz,t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/len)),px=a[0]+t*dx,pz=a[1]+t*dz,inv=1/Math.sqrt(len);for(const sign of[-1,1])candidate(px+sign*dz*inv*(margin+.002),pz-sign*dx*inv*(margin+.002));}
  candidate(B.minX-margin-.002,z);candidate(B.maxX+margin+.002,z);candidate(x,B.minZ-margin-.002);candidate(x,B.maxZ+margin+.002);if(!best)throw Error('No verified canonical dry shore');return best;
 }
 return{containsWater,shoreDistance,distanceToWater:(x,z)=>Math.max(0,shoreDistance(x,z)),dryPoint,footprintPoints:()=>contours[0].map(p=>p.slice()),footprintContours:()=>contours.map(c=>c.map(p=>p.slice()))};
}

export function createLoonLakeRuntime({terrainH,groundH,planningHeightAt=()=>NaN}){
 if(typeof terrainH!=='function'||typeof groundH!=='function')throw Error('Loon Lake requires actual canonical and physical samplers');
 const wetSurface=buildLoonLakeWetSurface({terrainH}),queries=createLoonWetQueries(wetSurface),containsWater=queries.containsWater;
 function waterAt(x,z){
  if(!containsWater(x,z))return null;
  const bed=terrainH(x,z),floor=groundH(x,z),surface=LOON_LAKE.level;
  if(!Number.isFinite(bed+floor))throw Error('Nonfinite Loon Lake footing');
  // A real deck is dry. A shallow bank below the water remains legitimate wading.
  if(floor>=surface-.005)return null;
  const depth=surface-Math.max(bed,floor);
  return depth>.02?{depth,surface,bed,floor}:null;
 }
 return Object.freeze({...LOON_LAKE,...queries,bounds:wetSurface.bounds,wetSurface,terrainHeight:loonLakeTerrainHeight,planningHeightAt,waterAt});
}

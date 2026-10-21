// Artifact CPU geometry fitter. Actual water is the clipped emitted triangles,
// not an old analytic ribbon or a center-depth witness. No Three/world imports.
export const GRID=Object.freeze({size:513,step:1000/512,origin:-500});
export function sampleCanonical(heights,x,z){
 const {size:N,step,origin}=GRID,gx=(x-origin)/step,gz=(z-origin)/step,ix=Math.max(0,Math.min(N-2,Math.floor(gx))),iz=Math.max(0,Math.min(N-2,Math.floor(gz))),u=gx-ix,v=gz-iz,i=iz*N+ix,a=heights[i],b=heights[i+N],c=heights[i+N+1],d=heights[i+1];
 return u+v<=1?a+(d-a)*u+(b-a)*v:c+(b-c)*(1-u)+(d-c)*(1-v);
}
const area=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
function clip(poly,distance){
 if(!poly.length)return poly;const out=[];let a=poly.at(-1),da=distance(a);
 for(const b of poly){const db=distance(b),ina=da>=-1e-11,inb=db>=-1e-11;
  if(ina!==inb){const t=da/(da-db);out.push(a.map((v,k)=>v+(b[k]-v)*t));}
  if(inb)out.push(b);a=b;da=db;
 }return out;
}
function canonicalTriangle(heights,ix,iz,half){
 const {step:S,size:N,origin:O}=GRID,x=O+ix*S,z=O+iz*S,i=iz*N+ix;
 return half?[[x+S,z,heights[i+1]],[x+S,z+S,heights[i+N+1]],[x,z+S,heights[i+N]]]:[[x,z,heights[i]],[x+S,z,heights[i+1]],[x,z+S,heights[i+N]]];
}
function planeHeight(tri,x,z){const[a,b,c]=tri,den=area(a,b,c),u=((b[0]-x)*(c[1]-z)-(b[1]-z)*(c[0]-x))/den,v=((c[0]-x)*(a[1]-z)-(c[1]-z)*(a[0]-x))/den;return a[2]*u+b[2]*v+c[2]*(1-u-v);}
function packedOwnerXZ(v,ix,iz,half){
 const S=GRID.step,x0=ix*S-500,z0=iz*S-500;let x=Math.fround(Math.max(x0,Math.min(x0+S,v[0]))),z=Math.fround(Math.max(z0,Math.min(z0+S,v[1])));const diagonal=x0+z0+S;
 if((half&&x+z<diagonal)||(!half&&x+z>diagonal)){if(Math.abs(x)<=Math.abs(z))x=Math.fround(diagonal-z);else z=Math.fround(diagonal-x);}
 if(x<x0||x>x0+S||z<z0||z>z0+S||(half?x+z<diagonal:x+z>diagonal))throw Error('Float32 owner containment lost');return[x,z];
}
export function fitWaterTriangles(input,heights,{clearance=.018,kind='water'}={}){
 if(!(heights instanceof Float32Array)||heights.length!==513*513)throw Error('Final packed canonical field required');
 const position=[],index=[],owners=[],sourceFaces=[],S=GRID.step;let originalArea=0,emittedArea=0,minimumGap=Infinity,maximumGap=-Infinity,clippedSources=0;
 for(let f=0;f<input.length;f++){
  let t=input[f].map(v=>[v[0],v[2],v[1]]);if(t.length!==3||!t.flat().every(Number.isFinite))throw Error('Finite water triangles required');if(area(...t)<0)t=[t[0],t[2],t[1]];
  const original=Math.abs(area(...t))*.5;if(original<1e-10)continue;originalArea+=original;let faceArea=0;
  const xs=t.map(v=>v[0]),zs=t.map(v=>v[1]),loX=Math.max(0,Math.floor((Math.min(...xs)+500)/S)),hiX=Math.min(511,Math.floor((Math.max(...xs)+500)/S)),loZ=Math.max(0,Math.floor((Math.min(...zs)+500)/S)),hiZ=Math.min(511,Math.floor((Math.max(...zs)+500)/S));
  for(let iz=loZ;iz<=hiZ;iz++)for(let ix=loX;ix<=hiX;ix++)for(let half=0;half<2;half++){
   const owner=canonicalTriangle(heights,ix,iz,half);let poly=t;
   for(let k=0;k<3&&poly.length;k++){const a=owner[k],b=owner[(k+1)%3];poly=clip(poly,v=>area(a,b,v));}
   poly=clip(poly,v=>v[2]-planeHeight(owner,v[0],v[1])-clearance);if(poly.length<3)continue;
   for(let j=1;j<poly.length-1;j++){
    const vertices=[poly[0],poly[j+1],poly[j]].map(v=>{const[x,z]=packedOwnerXZ(v,ix,iz,half);return[x,z,Math.fround(v[2])];});
    const A=Math.abs(area(...vertices))*.5;if(A<1e-9)continue;
    for(const v of vertices){const gap=v[2]-sampleCanonical(heights,v[0],v[1]);if(gap<clearance-.00008)throw Error('Packed water vertex lost canonical clearance');minimumGap=Math.min(minimumGap,gap);maximumGap=Math.max(maximumGap,gap);position.push(v[0],v[2],v[1]);index.push(index.length);}
    owners.push([ix,iz,half]);sourceFaces.push(f);faceArea+=A;
   }
  }
  emittedArea+=faceArea;if(faceArea<original-.0001)clippedSources++;
 }
 return{kind,position:new Float32Array(position),index:new Uint32Array(index),owners:new Uint16Array(owners.flat()),sourceFaces:new Uint32Array(sourceFaces),stats:{sourceTriangles:input.length,triangles:index.length/3,canonicalOwnerTriangles:owners.length,sourceArea:originalArea,actualVisibleArea:emittedArea,clippedSources,clearance,minimumGap,maximumGap,method:'Water triangles clipped to exact live anti-diagonal terrain triangles, then affine water-minus-terrain clearance; emitted Float32 vertices are checked exactly inside their canonical owner. Gap extrema are vertex extrema on each emitted affine face, subject to documented 0.08 mm rounding tolerance.',fullBodyOrBankAdmission:false}};
}
export function geometryTriangles(geometry){const p=geometry.position,idx=geometry.index,out=[];for(let i=0;i<idx.length;i+=3)out.push([0,1,2].map(k=>Array.from(p.subarray(idx[i+k]*3,idx[i+k]*3+3))));return out;}

// One owned shore overlay, partitioned by the same canonical faces. Positive
// lift is interpolated on each source shore triangle, then added to the exact
// canonical plane. No decorative unregistered second floor is installed here.
export function fitShoreTriangles(input,heights,{clearance=.014,kind='shore',ceiling=Infinity}={}){
 if(!(Number.isFinite(ceiling)||ceiling===Infinity))throw Error('Finite shore ceiling or explicit Infinity required');
 const ceilingPackingGuard=Number.isFinite(ceiling)?.0002:0;
 const position=[],index=[],owners=[],S=GRID.step;let minimumLift=Infinity,maximumLift=-Infinity;
 for(let f=0;f<input.length;f++){
  let t=input[f].map(v=>[v[0],v[2],Math.max(clearance,v[1]-sampleCanonical(heights,v[0],v[2]))]);if(area(...t)<0)t=[t[0],t[2],t[1]];if(Math.abs(area(...t))<1e-10)continue;
  const xs=t.map(v=>v[0]),zs=t.map(v=>v[1]),loX=Math.max(0,Math.floor((Math.min(...xs)+500)/S)),hiX=Math.min(511,Math.floor((Math.max(...xs)+500)/S)),loZ=Math.max(0,Math.floor((Math.min(...zs)+500)/S)),hiZ=Math.min(511,Math.floor((Math.max(...zs)+500)/S));
  for(let iz=loZ;iz<=hiZ;iz++)for(let ix=loX;ix<=hiX;ix++)for(let half=0;half<2;half++){
   const owner=canonicalTriangle(heights,ix,iz,half);let poly=t;for(let k=0;k<3&&poly.length;k++){const a=owner[k],b=owner[(k+1)%3];poly=clip(poly,v=>area(a,b,v));}if(Number.isFinite(ceiling))poly=clip(poly,v=>ceiling-ceilingPackingGuard-(planeHeight(owner,v[0],v[1])+v[2]));if(poly.length<3)continue;
   for(let j=1;j<poly.length-1;j++){
    const vertices=[poly[0],poly[j+1],poly[j]].map(v=>{const[x,z]=packedOwnerXZ(v,ix,iz,half);return[x,z,Math.fround(sampleCanonical(heights,x,z)+Math.max(clearance,v[2]))];});
    if(Math.abs(area(...vertices))<1e-9)continue;for(const v of vertices){const lift=v[2]-sampleCanonical(heights,v[0],v[1]);if(lift<clearance-.00008)throw Error('Shore lost canonical clearance');if(v[2]>ceiling+.00008)throw Error('Shore lost low wet-band ceiling');minimumLift=Math.min(minimumLift,lift);maximumLift=Math.max(maximumLift,lift);position.push(v[0],v[2],v[1]);index.push(index.length);}owners.push([ix,iz,half]);
   }
  }
 }
 return{kind,position:new Float32Array(position),index:new Uint32Array(index),owners:new Uint16Array(owners.flat()),stats:{sourceTriangles:input.length,triangles:index.length/3,minimumLift,maximumLift,clearance,ceiling:Number.isFinite(ceiling)?ceiling:null,ceilingPackingGuard,method:'Optional low wet-band ceiling clips the actual affine canonical-plus-lift surface before Float32 packing. Exact canonical-face partition plus affine nonnegative shore lift; Float32 finer-coordinate owner packing and 0.08 mm tolerance. Data only, not registered/admitted.'}};
}
export function createShoreContact(geometry){
 const p=geometry.position,I=geometry.index,owners=geometry.owners,cells=new Map(),S=GRID.step;
 for(let f=0;f<I.length/3;f++){const key=owners[f*3]+','+owners[f*3+1],list=cells.get(key)||[];list.push(f);cells.set(key,list);}
 // Read the same live source arrays and preserve cell/face order and every
 // barycentric operation. Avoid constructing vertex and query arrays per face.
 const contact=(x,z)=>{
  const gx=(x+500)/S,gz=(z+500)/S,ix=Math.floor(gx),iz=Math.floor(gz),nx=Math.abs(gx-Math.round(gx))<1e-9?2:1,nz=Math.abs(gz-Math.round(gz))<1e-9?2:1;
  let h=-Infinity;
  for(let dx=0;dx<nx;dx++)for(let dz=0;dz<nz;dz++){
   const faces=cells.get((ix-dx)+','+(iz-dz));if(!faces)continue;
   for(const f of faces){
    const ia=I[f*3]*3,ib=I[f*3+1]*3,ic=I[f*3+2]*3,ax=p[ia],az=p[ia+2],ay=p[ia+1],bx=p[ib],bz=p[ib+2],by=p[ib+1],cx=p[ic],cz=p[ic+2],cy=p[ic+1];
    const a=(bx-ax)*(cz-az)-(bz-az)*(cx-ax);if(Math.abs(a)<1e-15)continue;
    const u=((bx-x)*(cz-z)-(bz-z)*(cx-x))/a,w=((x-ax)*(cz-az)-(z-az)*(cx-ax))/a;
    if(Math.min(u,w,1-u-w)>=-1e-7)h=Math.max(h,ay*u+by*w+cy*(1-u-w));
   }
  }
  return h;
 };
 contact.profile='hollowpeak-owned-shore-contact-1';contact.registered=false;contact.physicalAdmissionAccepted=false;return contact;
}

// Remove equal-level channel/tarn overlap from the emitted surface instead of
// offsetting water levels. Parts remain on the original source water plane.
export function subtractCoplanarWater(input,cutters,{levelTolerance=.00008}={}){
 const ccw=t=>{let p=t.map(v=>[v[0],v[2],v[1]]);if(area(...p)<0)p=[p[0],p[2],p[1]];return p;},cs=cutters.map(ccw),out=[];
 const polygonArea=p=>Math.abs(p.reduce((a,v,i)=>a+v[0]*p[(i+1)%p.length][1]-v[1]*p[(i+1)%p.length][0],0))*.5;
 let removedArea=0,overlaps=0,maximumLevelDifference=0;
 for(const tri of input){let pieces=[ccw(tri)];for(const cutter of cs){const next=[];for(const p of pieces){let overlap=p;for(let k=0;k<3&&overlap.length;k++)overlap=clip(overlap,v=>area(cutter[k],cutter[(k+1)%3],v));if(overlap.length<3||polygonArea(overlap)<1e-8){next.push(p);continue;}for(const v of overlap){const d=Math.abs(v[2]-planeHeight(cutter,v[0],v[1]));maximumLevelDifference=Math.max(maximumLevelDifference,d);if(d>levelTolerance)throw Error('Different-level water surfaces overlap at basin join');}removedArea+=polygonArea(overlap);overlaps++;let inside=p;for(let k=0;k<3&&inside.length;k++){const a=cutter[k],b=cutter[(k+1)%3],outside=clip(inside,v=>-area(a,b,v));if(outside.length>=3&&polygonArea(outside)>1e-8)next.push(outside);inside=clip(inside,v=>area(a,b,v));}}pieces=next;}
  for(const p of pieces)for(let j=1;j<p.length-1;j++)if(Math.abs(area(p[0],p[j],p[j+1]))>1e-9)out.push([p[0],p[j+1],p[j]].map(v=>[v[0],v[2],v[1]]));
 }
 return{triangles:out,stats:{inputTriangles:input.length,outputTriangles:out.length,removedCoplanarArea:removedArea,overlapPieces:overlaps,maximumLevelDifference,levelOffsetApplied:false}};
}

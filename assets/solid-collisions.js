// Compact collision proxies are captured before rendering batches merge parts.
// This retains real door openings and avoids a bounding box around an entire building.
export function recordSolidPart(T,owner,geometry,material,matrix){
 if(!material||material.alphaTest>0||(material.transparent&&material.opacity<.85)||/water|flame|foliage|leaf|petal|linen|snow/i.test(material.name||''))return;
 if(/Torus|Tube|Plane|Circle|Ring/.test(geometry.type))return;
 geometry.computeBoundingBox();const b=geometry.boundingBox,s=b.getSize(new T.Vector3());
 if(!Number.isFinite(s.x+s.y+s.z)||s.y<.018||Math.max(s.x,s.z)<.025||s.length()<.14)return;
 (owner.userData.solidParts??=[]).push({min:b.min.toArray(),max:b.max.toArray(),matrix:matrix.toArray()});
}
function hull(points){
 points.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);const cross=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);
 const half=p=>{const h=[];for(const v of p){while(h.length>=2&&cross(h.at(-2),h.at(-1),v)<=1e-8)h.pop();h.push(v);}return h;};
 return half(points).slice(0,-1).concat(half(points.slice().reverse()).slice(0,-1));
}
// Circle against a convex footprint, including the fully enclosed case.
export function circleContact(poly,x,z,radius){
 let inside=true,best=Infinity,px=0,pz=0,nx=0,nz=0;
 for(let i=0;i<poly.length;i++){
  const a=poly[i],b=poly[(i+1)%poly.length],dx=b[0]-a[0],dz=b[1]-a[1],l2=dx*dx+dz*dz;if(l2<1e-12)continue;
  if(dx*(z-a[1])-dz*(x-a[0])<0)inside=false;
  const t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/l2)),cx=a[0]+dx*t,cz=a[1]+dz*t,d2=(x-cx)**2+(z-cz)**2;
  if(d2<best){best=d2;px=cx;pz=cz;const l=Math.sqrt(l2);nx=dz/l;nz=-dx/l;}
 }
 if(!inside&&best>=radius*radius)return null;
 const d=Math.sqrt(best);
 if(!inside&&d>1e-7){nx=(x-px)/d;nz=(z-pz)/d;}
 else if(inside&&d>1e-7){nx=(px-x)/d;nz=(pz-z)/d;}
 const depth=(inside?radius+d:radius-d)+.002;
 return {x:nx*depth,z:nz*depth};
}
// Two-sided static triangle contact helpers. No Three resources/RNG.
const EPS=1e-10;
export function clipTriangleToSlab(triangle,bottom,top){
 let p=triangle.map(v=>v.slice());
 for(const [level,side] of [[bottom,1],[top,-1]]){
  const out=[];
  for(let i=0;i<p.length;i++){
   const a=p[i],b=p[(i+1)%p.length],da=(a[1]-level)*side,db=(b[1]-level)*side;
   if(da>=-EPS)out.push(a);
   if((da>EPS&&db< -EPS)||(da< -EPS&&db>EPS)){
    const t=da/(da-db);out.push(a.map((v,k)=>v+(b[k]-v)*t));
   }
  }
  p=out;if(!p.length)break;
 }
 return p;
}
function projectedHull(points){
 const p=points.map(v=>[v[0],v[2]]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
 const unique=p.filter((v,i)=>!i||Math.hypot(v[0]-p[i-1][0],v[1]-p[i-1][1])>EPS);
 if(unique.length<3)return unique;
 const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
 const half=a=>{const h=[];for(const v of a){while(h.length>1&&cross(h.at(-2),h.at(-1),v)<=EPS)h.pop();h.push(v);}return h;};
 return half(unique).slice(0,-1).concat(half(unique.slice().reverse()).slice(0,-1));
}
// Nonzero triangle footprints use the original convex-circle implementation.
// Vertical faces collapse to a segment and remain a two-sided contact surface.
export function triangleSlabContact(triangle,x,z,radius,bottom,top,circleContact,previous=null){
 const clipped=clipTriangleToSlab(triangle,bottom,top),poly=projectedHull(clipped);
 if(!poly.length)return null;
 if(poly.length>=3){
  const hit=circleContact(poly,x,z,radius);if(!hit)return null;
  const [a,b,c]=triangle,ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2];
  let nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;const length=Math.hypot(nx,nz);
  if(length<=EPS)return hit;
  // Escape across the physical face, not an internal triangulation edge.
  const px=previous?.x??x,pz=previous?.z??z,py=previous?.centerY??(Number.isFinite(previous?.bottom)&&Number.isFinite(previous?.top)?(previous.bottom+previous.top)*.5:(bottom+top)*.5);
  if(nx*(px-a[0])+ny*(py-a[1])+nz*(pz-a[2])<0){nx=-nx;nz=-nz;}
  nx/=length;nz/=length;
  const support=Math.max(...poly.map(v=>v[0]*nx+v[1]*nz));
  const depth=Math.max(0,support+radius+.002-x*nx-z*nz);
  return{x:nx*depth,z:nz*depth};
 }
 const a=poly[0],b=poly.at(-1),dx=b[0]-a[0],dz=b[1]-a[1],l2=dx*dx+dz*dz;
 const t=l2>EPS?Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/l2)):0;
 const px=a[0]+dx*t,pz=a[1]+dz*t,ox=x-px,oz=z-pz,d=Math.hypot(ox,oz);
 if(d>=radius)return null;let nx,nz;
 if(d>EPS){nx=ox/d;nz=oz/d;}
 else if(l2>EPS){
  const l=Math.sqrt(l2);nx=dz/l;nz=-dx/l;
  if(previous&&((previous.x-px)*nx+(previous.z-pz)*nz)<0){nx=-nx;nz=-nz;}
 }else{
  const prior=previous&&Math.hypot(previous.x-px,previous.z-pz);
  nx=prior>EPS?(previous.x-px)/prior:1;nz=prior>EPS?(previous.z-pz)/prior:0;
 }
 return{x:nx*(radius-d+.002),z:nz*(radius-d+.002)};
}
// Exact Y extrema of a triangle intersected with the vertical radius cylinder.
// Candidates: vertices, edge/circle crossings, and the two disk tangencies of
// the triangle's affine Y plane. No max-height fill or watertight-mesh inference.
export function triangleDiskYRange(triangle,x,z,radius){
 const values=[];const rr=radius*radius;
 for(const a of triangle)if((a[0]-x)**2+(a[2]-z)**2<=rr+EPS)values.push(a[1]);
 for(let i=0;i<3;i++){
  const a=triangle[i],b=triangle[(i+1)%3],dx=b[0]-a[0],dz=b[2]-a[2],A=dx*dx+dz*dz;
  if(A<EPS)continue;
  const B=2*((a[0]-x)*dx+(a[2]-z)*dz),C=(a[0]-x)**2+(a[2]-z)**2-rr,D=B*B-4*A*C;
  if(D< -EPS)continue;const d=Math.sqrt(Math.max(0,D));
  for(const t of [(-B-d)/(2*A),(-B+d)/(2*A)])if(t>=-EPS&&t<=1+EPS){const q=Math.max(0,Math.min(1,t));values.push(a[1]+(b[1]-a[1])*q);}
 }
 const [a,b,c]=triangle,den=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);
 if(Math.abs(den)>EPS){
  const sample=(px,pz)=>{
   const u=((b[2]-c[2])*(px-c[0])+(c[0]-b[0])*(pz-c[2]))/den;
   const v=((c[2]-a[2])*(px-c[0])+(a[0]-c[0])*(pz-c[2]))/den,w=1-u-v;
   if(Math.min(u,v,w)>=-EPS)values.push(u*a[1]+v*b[1]+w*c[1]);
  };
  const gx=((b[1]-c[1])*(a[2]-c[2])-(a[1]-c[1])*(b[2]-c[2]))/-den;
  const gz=((b[0]-c[0])*(a[1]-c[1])-(a[0]-c[0])*(b[1]-c[1]))/-den;
  const length=Math.hypot(gx,gz);sample(x,z);
  if(length>EPS){sample(x+radius*gx/length,z+radius*gz/length);sample(x-radius*gx/length,z-radius*gz/length);}
 }
 return values.length?{min:Math.min(...values),max:Math.max(...values)}:null;
}

export function createSolidWorld({THREE:T,cellSize=12}){
 const cells=new Map(),owners=new Map(),moving=new Map(),v=new T.Vector3(),m=new T.Matrix4();let count=0;
 const key=(x,z)=>x+','+z;
 // Explicit static surface ownership is independent of visual range visibility.
 const surfaceCells=new Map(),surfaceOwners=new Map(),surfaceStep=2;
 const surfaceKey=(x,z)=>x+','+z;
 const surfaceKeys=b=>{const out=[];for(let x=Math.floor(b.minX/surfaceStep);x<=Math.floor(b.maxX/surfaceStep);x++)for(let z=Math.floor(b.minZ/surfaceStep);z<=Math.floor(b.maxZ/surfaceStep);z++)out.push(surfaceKey(x,z));return out;};
 function unregisterSurface(root){
  for(const e of surfaceOwners.get(root)||[])for(const k of e.keys){const set=surfaceCells.get(k);set?.delete(e);if(!set?.size)surfaceCells.delete(k);}
  surfaceOwners.delete(root);
 }
 // matrix, when provided, is the COMPLETE WORLD transform (not a second local transform).
 // Static callers must re-register after a transform/geometry change. Visibility is ignored.
 function registerSurface(root,geometry=root.geometry,matrix=null){
  const p=geometry?.attributes?.position,index=geometry?.index;
  if(!root?.updateWorldMatrix||!p||p.itemSize!==3||p.count<3||(index?index.count:p.count)%3)throw Error('Invalid static triangle surface');
  root.updateWorldMatrix(true,false);const transform=matrix||root.matrixWorld;
  if(!transform?.elements||!transform.elements.every(Number.isFinite))throw Error('Invalid static surface world transform');
  const entries=[],n=index?index.count:p.count,point=new T.Vector3();
  for(let i=0;i<n;i+=3){
   const triangle=[];
   for(let k=0;k<3;k++){const j=index?index.getX(i+k):i+k;if(!Number.isInteger(j)||j<0||j>=p.count)throw Error('Invalid surface index');point.fromBufferAttribute(p,j).applyMatrix4(transform);triangle.push(point.toArray());}
   if(!triangle.flat().every(Number.isFinite))throw Error('Nonfinite static surface triangle');
   const [a,b,c]=triangle,ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2];
   if(Math.hypot(uy*vz-uz*vy,uz*vx-ux*vz,ux*vy-uy*vx)<1e-10)continue;
   const e={root,registeredParent:root.parent,triangle,minX:Math.min(...triangle.map(p=>p[0])),maxX:Math.max(...triangle.map(p=>p[0])),minZ:Math.min(...triangle.map(p=>p[2])),maxZ:Math.max(...triangle.map(p=>p[2])),minY:Math.min(...triangle.map(p=>p[1])),maxY:Math.max(...triangle.map(p=>p[1]))};
   e.keys=surfaceKeys(e);entries.push(e);
  }
  unregisterSurface(root);
  for(const e of entries)for(const k of e.keys){if(!surfaceCells.has(k))surfaceCells.set(k,new Set());surfaceCells.get(k).add(e);}
  surfaceOwners.set(root,entries);return entries.length;
 }
 function nearbySurfaces(x,z,r){const out=new Set();for(const k of surfaceKeys({minX:x-r,maxX:x+r,minZ:z-r,maxZ:z+r}))for(const e of surfaceCells.get(k)||[])out.add(e);return out;}
 const activeSurface=e=>!(e.registeredParent&&!e.root.parent&&!e.root.userData.collisionBatched);
 // Highest ACTUAL two-sided vertical triangle hit; no bounding-box/volume fill.
 // Optional owner restricts this to one registered mesh. -Infinity means no hit.
 function surfaceHeight(x,z,owner=null){
  let height=-Infinity;
  for(const e of nearbySurfaces(x,z,0)){
   if(!activeSurface(e)||(owner&&e.root!==owner))continue;
   const [a,b,c]=e.triangle,den=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);
   // A vertical/coplanar ray has no unique supporting top for a vertical face.
   if(Math.abs(den)<1e-10)continue;
   const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/den,v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/den,w=1-u-v;
   if(Math.min(u,v,w)<-1e-10)continue;
   height=Math.max(height,u*a[1]+v*b[1]+w*c[1]);
  }return height;
 }
 function surfaceContacts(position,{bottom,top,radius=.55,previous=null}={}){
  const hits=[];
  for(const e of nearbySurfaces(position.x,position.z,radius)){
   if(!activeSurface(e)||bottom>=e.maxY-.001||top<=e.minY+.001)continue;
   const hit=triangleSlabContact(e.triangle,position.x,position.z,radius,bottom,top,circleContact,previous);
   if(hit)hits.push(hit);
  }return hits;
 }

 const keysFor=b=>{const keys=[];for(let x=Math.floor(b.minX/cellSize);x<=Math.floor(b.maxX/cellSize);x++)for(let z=Math.floor(b.minZ/cellSize);z<=Math.floor(b.maxZ/cellSize);z++)keys.push(key(x,z));return keys;};
 function unregister(root){const entries=owners.get(root);if(!entries)return;for(const e of entries){for(const k of e.keys){const set=cells.get(k);set?.delete(e);if(!set?.size)cells.delete(k);}count--;}owners.delete(root);moving.delete(root);}
 function register(root,{primitives=false}={}){
  unregister(root);root.updateWorldMatrix(true,true);const entries=[];
  function add(owner,part){
   m.fromArray(part.matrix).premultiply(owner.matrixWorld);const pts=[];let minY=Infinity,maxY=-Infinity;
   for(const x of[part.min[0],part.max[0]])for(const y of[part.min[1],part.max[1]])for(const z of[part.min[2],part.max[2]]){
    v.set(x,y,z).applyMatrix4(m);pts.push([v.x,v.z]);minY=Math.min(minY,v.y);maxY=Math.max(maxY,v.y);
   }
   const poly=hull(pts);if(poly.length<3||maxY-minY<.02)return;
   const e={owner,root,registeredParent:root.parent,poly,minY,maxY,minX:Math.min(...pts.map(p=>p[0])),maxX:Math.max(...pts.map(p=>p[0])),minZ:Math.min(...pts.map(p=>p[1])),maxZ:Math.max(...pts.map(p=>p[1]))};
   if(e.maxX-e.minX>120||e.maxZ-e.minZ>120)return;
   e.keys=keysFor(e);for(const k of e.keys){if(!cells.has(k))cells.set(k,new Set());cells.get(k).add(e);}entries.push(e);count++;
  }
  const visit=o=>{
   if(!o.visible||o.userData.collisionIgnore||o.userData.walkable)return;
   if(o.userData.solidParts){for(const p of o.userData.solidParts)add(o,p);}
   else if(primitives&&o.isMesh&&!o.isSkinnedMesh&&!o.isInstancedMesh&&/^(Box|Cylinder|Cone|Sphere|Icosahedron|Dodecahedron)Geometry$/.test(o.geometry.type)){
    const tmp={userData:{}};recordSolidPart(T,tmp,o.geometry,o.material,new T.Matrix4());for(const p of tmp.userData.solidParts||[])add(o,p);
   }
   for(const c of o.children)visit(c);
  };visit(root);owners.set(root,entries);if(/^(rowboat|ferry|balloon)$/.test(root.userData.sceneryArt?.kind||''))moving.set(root,root.matrixWorld.elements.slice());return entries.length;
 }
 function registerParts(root){
  // Use each authored model as an owner so moving/removing one never invalidates its neighbours.
  if(owners.has(root)||root.userData.collisionIgnore||root.userData.walkable||!root.visible)return;
  if(root.userData.solidParts){register(root);return;}
  for(const c of root.children)registerParts(c);
 }
 function nearby(x,z,r){const set=new Set();for(const k of keysFor({minX:x-r,maxX:x+r,minZ:z-r,maxZ:z+r}))for(const e of cells.get(k)||[])set.add(e);return set;}
 function active(e){if(e.registeredParent&&!e.root.parent&&!e.root.userData.collisionBatched)return false;for(let o=e.owner;o;o=o.parent){if(!o.visible)return false;if(o===e.root)break;}return true;}
 function resolve(position,{bottom,top,radius=.55,previous=null}={}){
  // Ground support may rise across a scan edge before the destination body is tested.
  // Sweep only triangle surfaces through that rise; authored box behavior stays unchanged.
  const rising=Number.isFinite(previous?.bottom)&&Number.isFinite(previous?.top)&&bottom>previous.bottom;
  const surfaceBottom=rising?previous.bottom:bottom,surfaceTop=rising?Math.max(previous.top,top):top;
  const requested=previous?Math.hypot(position.x-previous.x,position.z-previous.z):Infinity;let surfaceMoved=false;
  let contacts=0;
  for(let pass=0;pass<4;pass++){
   let changed=false;
   for(const e of nearby(position.x,position.z,radius)){
    if(!active(e)||bottom>=e.maxY-.035||top<=e.minY+.025)continue;
    const hit=circleContact(e.poly,position.x,position.z,radius);if(!hit)continue;
    position.x+=hit.x;position.z+=hit.z;contacts++;changed=true;
   }
   // Largest current surface push avoids repeated tiny internal tessellation edges.
   const hits=surfaceContacts(position,{bottom:surfaceBottom,top:surfaceTop,radius,previous});
   if(hits.length){surfaceMoved=true;const hit=hits.reduce((a,b)=>a.x*a.x+a.z*a.z>=b.x*b.x+b.z*b.z?a:b);position.x+=hit.x;position.z+=hit.z;contacts++;changed=true;}
   if(!changed)break;
  }
  // Rough/open scan seams can produce incompatible local pushes. Keep a
  // certified clear prior substep instead of leaving the rider inside a face.
  // Initial overlap without a clear previous pose remains caller-visible via
  // surfaceContacts; no arbitrary inside-volume or teleport assumption is made.
  const priorBottom=Number.isFinite(previous?.bottom)?previous.bottom:bottom,priorTop=Number.isFinite(previous?.top)?previous.top:top;
  if(previous&&surfaceMoved&&(surfaceContacts(position,{bottom:surfaceBottom,top:surfaceTop,radius}).length||Math.hypot(position.x-previous.x,position.z-previous.z)>requested+.002)&&!surfaceContacts(previous,{bottom:priorBottom,top:priorTop,radius}).length){
   let priorBoxClear=true;
   for(const e of nearby(previous.x,previous.z,radius))if(active(e)&&priorBottom<e.maxY-.035&&priorTop>e.minY+.025&&circleContact(e.poly,previous.x,previous.z,radius)){priorBoxClear=false;break;}
   if(priorBoxClear){position.x=previous.x;position.z=previous.z;}
  }return contacts;
 }
 function limitVertical(x,z,from,to,height,radius=.5){
  let result=to;
  for(const e of nearby(x,z,radius)){
   if(!active(e)||!circleContact(e.poly,x,z,radius))continue;
   if(to<from&&from>=e.maxY-.05&&result<e.maxY)result=e.maxY;
   if(to>from&&from+height<=e.minY+.05&&result+height>e.minY)result=e.minY-height;
  }
  for(const e of nearbySurfaces(x,z,radius)){
   if(!activeSurface(e))continue;const range=triangleDiskYRange(e.triangle,x,z,radius);if(!range)continue;
   if(to<from&&from>=range.max-.001&&result<range.max)result=range.max;
   if(to>from&&from+height<=range.min+.001&&result+height>range.min)result=range.min-height;
  }return result;
 }
 return {register,registerParts,unregister:root=>{unregister(root);unregisterSurface(root);},resolve,limitVertical,
  registerSurface,unregisterSurface,surfaceHeight,surfaceContacts,surfaceStats:()=>({owners:surfaceOwners.size,triangles:[...surfaceOwners.values()].reduce((n,a)=>n+a.length,0),cells:surfaceCells.size}),
  updateDynamic(){for(const [root,last]of [...moving]){root.updateWorldMatrix(true,false);if(root.matrixWorld.elements.some((value,i)=>Math.abs(value-last[i])>.002))register(root);}},
  hasParts:root=>(owners.get(root)?.length||0)>0,refresh(){for(const [root,parts] of [...owners]){if(parts[0]?.registeredParent&&!root.parent&&!root.userData.collisionBatched)unregister(root);else register(root,{primitives:true});}},stats:()=>({parts:count,owners:owners.size,cells:cells.size})};
}

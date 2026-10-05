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
export function createSolidWorld({THREE:T,cellSize=12}){
 const cells=new Map(),owners=new Map(),moving=new Map(),v=new T.Vector3(),m=new T.Matrix4();let count=0;
 const key=(x,z)=>x+','+z;
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
 function resolve(position,{bottom,top,radius=.55}={}){
  let contacts=0;
  for(let pass=0;pass<4;pass++){
   let changed=false;
   for(const e of nearby(position.x,position.z,radius)){
    if(!active(e)||bottom>=e.maxY-.035||top<=e.minY+.025)continue;
    const hit=circleContact(e.poly,position.x,position.z,radius);if(!hit)continue;
    position.x+=hit.x;position.z+=hit.z;contacts++;changed=true;
   }
   if(!changed)break;
  }return contacts;
 }
 function limitVertical(x,z,from,to,height,radius=.5){
  let result=to;
  for(const e of nearby(x,z,radius)){
   if(!active(e)||!circleContact(e.poly,x,z,radius))continue;
   if(to<from&&from>=e.maxY-.05&&result<e.maxY)result=e.maxY;
   if(to>from&&from+height<=e.minY+.05&&result+height>e.minY)result=e.minY-height;
  }return result;
 }
 return {register,registerParts,unregister,resolve,limitVertical,
  updateDynamic(){for(const [root,last]of [...moving]){root.updateWorldMatrix(true,false);if(root.matrixWorld.elements.some((value,i)=>Math.abs(value-last[i])>.002))register(root);}},
  hasParts:root=>(owners.get(root)?.length||0)>0,refresh(){for(const [root,parts] of [...owners]){if(parts[0]?.registeredParent&&!root.parent&&!root.userData.collisionBatched)unregister(root);else register(root,{primitives:true});}},stats:()=>({parts:count,owners:owners.size,cells:cells.size})};
}

// One static windpump camera admission. No scene object, body owner, support
// callback or resource UUID is created. The existing camera copies these OBBs.
export const OCHRE_TOWER_CAMERA_PROFILE='ochre-windmill-camera-1';
export function createOchreTowerCameraAdmission({THREE:T,camera}={}){
 const stats={profile:OCHRE_TOWER_CAMERA_PROFILE,admitted:0,rejected:0,errors:[],records:[]},attempted=new WeakSet();
 const finite=a=>Array.isArray(a)&&a.every(Number.isFinite);
 const fail=message=>{throw Error(message);};
 const reject=(root,reason)=>{stats.rejected++;const r={status:'retained-render-camera-unadmitted',rootUUID:root?.uuid||null,reason,registeredParts:0,rollbackClaimed:false};stats.records.push(r);return r;};
 const materialState=m=>m?[m.uuid,...(m.color?.toArray()||[]),m.opacity,m.transparent,m.roughness,m.metalness,m.side,m.alphaTest,m.map,m.normalMap,m.roughnessMap,m.onBeforeCompile]:[];
 function snapshot(root){const rows=[];root.traverse(o=>{
  const g=o.geometry,arrays=g?[...Object.entries(g.attributes),...(g.index?[['$index',g.index]]:[])].map(([key,a])=>({key,attribute:a,array:a.array,values:a.array.slice()})):[];
  rows.push({o,uuid:o.uuid,parent:o.parent,children:o.children.slice(),position:o.position.toArray(),quaternion:o.quaternion.toArray(),scale:o.scale.toArray(),matrix:o.matrix.elements.slice(),world:o.matrixWorld.elements.slice(),geometry:g,geometryUUID:g?.uuid,material:o.material,materialValues:materialState(o.material),arrays,attributeCount:g?Object.keys(g.attributes).length:0});
 });return rows;}
 function unchanged(rows){return rows.every(r=>r.o.uuid===r.uuid&&r.o.parent===r.parent&&r.o.geometry===r.geometry&&r.geometry?.uuid===r.geometryUUID&&r.o.material===r.material&&materialState(r.material).every((v,i)=>v===r.materialValues[i])&&r.o.children.length===r.children.length&&r.children.every((c,i)=>r.o.children[i]===c)&&['position','quaternion','scale'].every(k=>r.o[k].toArray().every((v,i)=>v===r[k][i]))&&r.o.matrix.elements.every((v,i)=>v===r.matrix[i])&&r.o.matrixWorld.elements.every((v,i)=>v===r.world[i])&&(!r.geometry||Object.keys(r.geometry.attributes).length===r.attributeCount)&&r.arrays.every(a=>(a.key==='$index'?r.geometry.index:r.geometry.attributes[a.key])===a.attribute&&a.attribute.array===a.array&&a.array.length===a.values.length&&a.array.every((v,i)=>v===a.values[i])));}
 const readBounds=(p,start=0,count=p.count,inverse=null)=>{
  const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity],v=new T.Vector3();
  for(let i=start;i<start+count;i++){v.fromBufferAttribute(p,i);if(inverse)v.applyMatrix4(inverse);for(let a=0;a<3;a++){const n=v.getComponent(a);if(!Number.isFinite(n))fail('Nonfinite rendered tower vertex');lo[a]=Math.min(lo[a],n);hi[a]=Math.max(hi[a],n);}}
  if(lo.some((n,i)=>!(hi[i]>n)))fail('Degenerate tower camera part');return{min:lo,max:hi};
 };
 function build({root,bracesRoot,braceParts}={}){
  if(!root?.isGroup||!bracesRoot?.isGroup||bracesRoot.parent!==root||root.children.at(-1)!==bracesRoot||root.children.length!==18)fail('Final windpump tower source required');
  const art=bracesRoot.userData.workshopArt;
  if(art?.profile!=='regional-workshops-1'||art.kind!=='windpump-bracing'||art.triangles!==288||art.draws!==1||bracesRoot.children.length!==1)fail('Final upgraded cross-braces required');
  if(!Array.isArray(braceParts)||braceParts.length!==24)fail('Exactly 24 authored brace records required');
  const original=root.children.slice(0,-1),types=original.map(m=>m.geometry?.type);
  if(original.some(m=>!m.isMesh||m.children.length||Array.isArray(m.material))||types.filter(x=>x==='CylinderGeometry').length!==16||types.filter(x=>x==='BoxGeometry').length!==1)fail('Original 17 tower primitives required');
  for(const m of original){const p=m.geometry.parameters;if(m.geometry.type==='CylinderGeometry'&&(p.radiusTop!==1||p.radiusBottom!==1||p.height!==1||p.radialSegments!==9)||m.geometry.type==='BoxGeometry'&&(p.width!==1||p.height!==1||p.depth!==1))fail('Changed original tower primitive geometry');}
  root.updateWorldMatrix(true,true);
  if(root.matrixWorld.elements.some(n=>!Number.isFinite(n))||Math.abs(root.matrixWorld.determinant())<1e-12)fail('Finite final tower matrix required');
  const parts=original.map(m=>({...readBounds(m.geometry.attributes.position),matrix:m.matrixWorld.toArray()}));
  const mesh=bracesRoot.children[0],p=mesh.geometry?.attributes.position;
  if(!mesh.isMesh||Array.isArray(mesh.material)||!p||p.count!==576||mesh.geometry.index?.count!==864||!mesh.matrix.equals(new T.Matrix4()))fail('Final merged 24-box brace mesh required');
  const seen=new Uint8Array(p.count);
  for(const part of braceParts){
   if(part.material!==mesh.material||part.vertexCount!==24||!Number.isInteger(part.firstVertex)||part.firstVertex<0||part.firstVertex+24>p.count||!finite(part.matrix)||part.matrix.length!==16)fail('Brace provenance range/material changed');
   for(let i=part.firstVertex;i<part.firstVertex+24;i++){if(seen[i]++)fail('Overlapping brace provenance ranges');}
   const local=new T.Matrix4().fromArray(part.matrix),e=local.elements;
   if(Math.abs(local.determinant()-1)>1e-10||e[3]!==0||e[7]!==0||e[11]!==0||e[15]!==1)fail('Rigid authored brace frame required');
   // Bounds come from FINAL Float32 baked vertices in the original box frame,
   // rather than guessed dimensions or the merged batch's enclosing AABB.
   const bounds=readBounds(p,part.firstVertex,24,local.clone().invert()),size=bounds.max.map((v,i)=>v-bounds.min[i]);
   if(Math.abs(size[0]-.055)>2e-6||Math.abs(size[2]-.07)>2e-6||size[1]<2||size[1]>5)fail('Changed final brace cross section');
   parts.push({...bounds,matrix:new T.Matrix4().multiplyMatrices(bracesRoot.matrixWorld,local).toArray()});
  }
  if(seen.some(n=>n!==1)||parts.length!==41)fail('Incomplete final camera geometry');
  for(const part of parts)if(!finite(part.matrix)||Math.abs(new T.Matrix4().fromArray(part.matrix).determinant())<1e-12)fail('Finite nonsingular final timber frame required');
  return{parts,source:snapshot(root)};
 }
 function admit(input){
  const root=input?.root;
  if(!root||typeof root!=='object')return reject(root,'Missing source root');
  if(attempted.has(root))return{status:'already-attempted-no-retry',rootUUID:root.uuid,registeredParts:0};
  if(stats.admitted||stats.errors.length)return reject(root,'One tower admission per installer');
  const register=camera?.registerCameraOnly;
  if(typeof register!=='function'||!Number.isInteger(camera.obstacleCount))return reject(root,'Camera-only registration entry unavailable');
  if(register===camera.register)return reject(root,'Distinct raw camera-only entry required');
  let built;
  try{built=build(input);}catch(error){return reject(root,String(error?.message||error));}
  const before=camera.obstacleCount;
  if(!unchanged(built.source))return reject(root,'Source changed before camera publication');
  attempted.add(root);
  // A plain immutable numeric root has no body parts in the scene. It is never
  // passed to wrapped camera.register or to solidWorld. No source is annotated.
  const proxy={matrixWorld:new T.Matrix4(),userData:{solidParts:built.parts},children:[],updateWorldMatrix(){}};
  let error=null;
  try{register(proxy);}catch(e){error=e;}
  const after=camera.obstacleCount,added=after-before,stable=unchanged(built.source);
  if(error||added!==41||!stable){
   const r={status:added===0?'registration-failed-no-camera-append':'registration-failed-incomplete-no-retry',rootUUID:root.uuid,reason:String(error?.message||(!stable?'Source changed during camera publication':'Unexpected camera obstacle delta')),registeredParts:added,expectedParts:41,rollbackClaimed:false};
   stats.errors.push(r);stats.records.push(r);return r;
  }
  const r={status:'final-static-camera-only',rootUUID:root.uuid,originalParts:17,braceParts:24,registeredParts:41,obstacleCountBefore:before,obstacleCountAfter:after,rootMatrix:root.matrixWorld.toArray(),parts:built.parts.map(p=>({min:p.min.slice(),max:p.max.slice(),matrix:p.matrix.slice()})),bodyRegistration:false,supportCallbacksAdded:0};
  stats.admitted++;stats.records.push(r);return r;
 }
 return{admit,stats};
}

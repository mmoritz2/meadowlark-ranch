// Optional render-only cohorts for the captured fixed regional fence boxes.
// Original meshes remain the physical and camera-registration owners.
export function createWorldFenceRendering({THREE:T,scene,owners,enabled=false}){
 const state={status:enabled?'waiting':'disabled',reason:null,owners:[],install,refresh,dispose,retain};
 const hooks=['onBeforeRender','onAfterRender','onBeforeShadow','onAfterShadow'];
 let closed=false;
 const defaults=o=>hooks.every(k=>o[k]===T.Object3D.prototype[k]);
 const equalArray=(a,b)=>{if(a.constructor!==b.constructor||a.length!==b.length)return false;const x=new Uint8Array(a.buffer,a.byteOffset,a.byteLength),y=new Uint8Array(b.buffer,b.byteOffset,b.byteLength);for(let i=0;i<x.length;i++)if(x[i]!==y[i])return false;return true;};
 function sameGeometry(a,b){
  if(a===b)return true;
  const ka=Object.keys(a.attributes).sort(),kb=Object.keys(b.attributes).sort();
  if(ka.join('|')!==kb.join('|')||a.drawRange.start!==b.drawRange.start||a.drawRange.count!==b.drawRange.count||JSON.stringify(a.groups)!==JSON.stringify(b.groups)||!!a.index!==!!b.index)return false;
  if(a.index&&!equalArray(a.index.array,b.index.array))return false;
  return ka.every(k=>{const x=a.attributes[k],y=b.attributes[k];return x.itemSize===y.itemSize&&x.normalized===y.normalized&&x.gpuType===y.gpuType&&equalArray(x.array,y.array);});
 }
 function release(reason,status='retained-original'){
  if(closed)return state;closed=true;
  for(const owner of state.owners){
   owner.root.removeEventListener('removed',owner.onRemoved);
   owner.group?.removeFromParent();
   for(const b of owner.batches)b.mesh?.dispose();
   for(const s of owner.records)if(s.leased&&s.mesh.layers.mask===0)s.mesh.layers.mask=s.layerMask;
  }
  state.status=status;state.reason=reason;return state;
 }
 function retain(reason){return release(String(reason?.message||reason));}
 function dispose(){return release('disposed','disposed');}
 function geometrySupported(g){
  return g?.isBufferGeometry&&g.type==='BoxGeometry'&&!Object.keys(g.morphAttributes).length&&Object.keys(g.attributes).sort().join('|')==='normal|position|uv'&&Object.values(g.attributes).every(a=>!a.isInterleavedBufferAttribute&&a.array instanceof Float32Array&&a.count===24)&&g.index?.array instanceof Uint16Array&&g.index.count===36;
 }
 function record(mesh,root){
  const g=mesh.geometry,m=mesh.material;
  if(!mesh.isMesh||mesh.isInstancedMesh||mesh.parent!==root||mesh.children.length||!geometrySupported(g)||!m?.isMeshStandardMaterial||m.transparent||m.opacity!==1||m.alphaTest!==0||m.onBeforeCompile!==T.Material.prototype.onBeforeCompile||!defaults(mesh)||mesh.layers.mask===0||mesh.morphTargetInfluences||mesh.scale.x!==1||mesh.scale.y!==1||mesh.scale.z!==1)throw Error('Unsupported fixed fence box');
  const world=mesh.matrixWorld.elements;
  if(world.some(v=>!Number.isFinite(v))||world[3]!==0||world[7]!==0||world[11]!==0||world[15]!==1)throw Error('Unsupported fence frame');
  return {mesh,geometry:g,material:m,layerMask:mesh.layers.mask,castShadow:mesh.castShadow,receiveShadow:mesh.receiveShadow,renderOrder:mesh.renderOrder,frustumCulled:mesh.frustumCulled,customDepthMaterial:mesh.customDepthMaterial,customDistanceMaterial:mesh.customDistanceMaterial,
   matrix:world.slice(),local:mesh.matrix.elements.slice(),attributes:Object.values(g.attributes).map(a=>[a,a.version]),index:g.index,indexVersion:g.index.version,leased:false};
 }
 const sameFlags=(a,b)=>a.material===b.material&&a.layerMask===b.layerMask&&a.castShadow===b.castShadow&&a.receiveShadow===b.receiveShadow&&a.renderOrder===b.renderOrder&&a.frustumCulled===b.frustumCulled&&a.customDepthMaterial===b.customDepthMaterial&&a.customDistanceMaterial===b.customDistanceMaterial;
 function valid(owner,s){
  const m=s.mesh,g=s.geometry;
  return m.parent===owner.root&&m.geometry===g&&m.material===s.material&&m.layers.mask===0&&m.castShadow===s.castShadow&&m.receiveShadow===s.receiveShadow&&m.renderOrder===s.renderOrder&&m.frustumCulled===s.frustumCulled&&m.customDepthMaterial===s.customDepthMaterial&&m.customDistanceMaterial===s.customDistanceMaterial&&defaults(m)&&!m.children.length&&m.matrixWorld.elements.every((v,i)=>v===s.matrix[i])&&m.matrix.elements.every((v,i)=>v===s.local[i])&&Object.values(g.attributes).length===s.attributes.length&&s.attributes.every(([a,v])=>Object.values(g.attributes).includes(a)&&a.version===v)&&g.index===s.index&&g.index.version===s.indexVersion;
 }
 function fill(owner){
  for(const b of owner.batches){
   let n=0;const sphere=new T.Sphere(),p=new T.Vector3();let bound=null;
   for(let i=0;i<b.records.length;i++){
    const s=b.records[i];if(!s.mesh.visible)continue;
    const row=b.mesh.instanceMatrix.array.subarray(n*16,n*16+16);row.set(s.matrix);
    b.sourceIndices[n++]=i;
    // Source box vertices and the actual Float32 instance rows define this bound.
    const e=row,c=b.localSphere.center;
    p.set(e[0]*c.x+e[4]*c.y+e[8]*c.z+e[12],e[1]*c.x+e[5]*c.y+e[9]*c.z+e[13],e[2]*c.x+e[6]*c.y+e[10]*c.z+e[14]);
    const scale=Math.sqrt(e[0]*e[0]+e[1]*e[1]+e[2]*e[2]+e[4]*e[4]+e[5]*e[5]+e[6]*e[6]+e[8]*e[8]+e[9]*e[9]+e[10]*e[10]);
    sphere.center.copy(p);sphere.radius=b.localSphere.radius*scale;
    if(bound)bound.union(sphere);else bound=sphere.clone();
   }
   b.mesh.count=n;b.mesh.visible=n>0;b.mesh.instanceMatrix.needsUpdate=true;b.mesh.boundingSphere=bound||new T.Sphere(new T.Vector3(),0);
  }
 }
 function refresh(){
  if(closed||state.status!=='applied')return false;
  try{
   for(const owner of state.owners){
    if(owner.root.parent!==scene||owner.group.parent!==scene||!scene.matrixWorld.equals(owner.sceneMatrix))throw Error('Fence scene parent changed');
    owner.root.updateWorldMatrix(true,true);
    if(owner.records.some(s=>!valid(owner,s)))throw Error('Fixed fence source changed');
   }
   for(const owner of state.owners)fill(owner);
   return true;
  }catch(error){retain(error);return false;}
 }
 function install(){
  if(closed||!enabled||state.status!=='waiting')return state;
  try{
   scene.updateWorldMatrix(true,false);
   if(scene.parent||!scene.matrixWorld.equals(new T.Matrix4())||owners.length!==6||new Set(owners.map(o=>o.root)).size!==6)throw Error('Unsupported regional fence roots');
   for(const input of owners){
    const {root,sources,id,kind}=input;
    if(root.parent!==scene||sources.length!==(kind==='arena'?57:kind==='sanctuary'?66:-1)||new Set(sources).size!==sources.length)throw Error('Unexpected captured fence set');
    root.updateWorldMatrix(true,true);
    const owner={id,kind,root,sources,records:[],batches:[],group:null,sceneMatrix:scene.matrixWorld.clone(),onRemoved:()=>retain('Fence root removed')};state.owners.push(owner);
    for(const mesh of sources)owner.records.push(record(mesh,root));
    const group=new T.Group();group.name='course rail render view';group.userData.collisionIgnore=true;group.userData.worldFenceRenderOwner=true;owner.group=group;
    let shown=true;Object.defineProperty(group,'visible',{configurable:true,get:()=>shown&&root.visible&&root.parent===scene,set:v=>{shown=v;}});
    group.updateMatrix();group.matrixAutoUpdate=false;
    for(const s of owner.records){
     let b=owner.batches.find(b=>sameFlags(b.records[0],s)&&sameGeometry(b.records[0].geometry,s.geometry));
     if(!b){b={records:[],sources:[],sourceIndices:null,mesh:null,localSphere:null};owner.batches.push(b);}b.records.push(s);b.sources.push(s.mesh);
    }
    for(const b of owner.batches){
     const s=b.records[0],mesh=new T.InstancedMesh(s.geometry,s.material,b.records.length);b.mesh=mesh;b.sourceIndices=new Uint32Array(b.records.length);
     mesh.name='course:fixed fence render view';mesh.userData.worldFenceRenderView=true;mesh.layers.mask=s.layerMask;mesh.castShadow=s.castShadow;mesh.receiveShadow=s.receiveShadow;mesh.frustumCulled=s.frustumCulled;mesh.renderOrder=s.renderOrder;mesh.customDepthMaterial=s.customDepthMaterial;mesh.customDistanceMaterial=s.customDistanceMaterial;mesh.updateMatrix();mesh.matrixAutoUpdate=false;group.add(mesh);
     const attr=s.geometry.attributes.position,box=new T.Box3(),v=new T.Vector3();for(let i=0;i<attr.count;i++)box.expandByPoint(v.fromBufferAttribute(attr,i));const center=box.getCenter(new T.Vector3());let radius=0;for(let i=0;i<attr.count;i++)radius=Math.max(radius,v.fromBufferAttribute(attr,i).distanceTo(center));b.localSphere=new T.Sphere(center,radius);
    }
    fill(owner);
   }
   // Commit together, after all exact cohorts and rows are prepared. No awaits.
   for(const owner of state.owners){for(const s of owner.records){s.mesh.layers.mask=0;s.leased=true;}scene.add(owner.group);owner.root.addEventListener('removed',owner.onRemoved);}
   state.status='applied';return state;
  }catch(error){return retain(error);}
 }
 return state;
}

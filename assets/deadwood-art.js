// Standing deadwood derived from the existing licensed tree scans. A compact
// solid far mesh keeps the same silhouette and footing without facing the camera.
export function installDeadwoodArt(G,{bank,catalog,sources}){
 const {THREE:T,world:W,scene,horse:H,renderer}=G,root=new T.Group();root.name='Regional | weathered deadwood';
 const materials=new Map();for(const source of sources)source.traverse(o=>{if(o.isMesh)for(const m of [].concat(o.material))materials.set(m.name,m);});
 const variants=catalog.variants.map(v=>{
  const levels=v.levels.map(l=>({level:l.level,triangles:l.triangles,parts:l.parts.map(p=>{
   const geo=new T.BufferGeometry();for(const [key,name,n]of[['POSITION','position',3],['NORMAL','normal',3],['TEXCOORD_0','uv',2]])geo.setAttribute(name,new T.Float32BufferAttribute(p.attributes[key],n));
   geo.setIndex(p.index);geo.applyMatrix4(new T.Matrix4().fromArray(p.matrix));geo.computeBoundingBox();
   const material=materials.get(p.material);if(!material)throw Error('Missing deadwood surface '+p.material);
   return {geo,material};
  })}));
  const bounds=new T.Box3();for(const p of levels[0].parts)bounds.union(p.geo.boundingBox);const height=bounds.max.y-bounds.min.y;
  for(const l of levels)for(const p of l.parts){p.geo.translate(0,-bounds.min.y,0);p.geo.scale(1/height,1/height,1/height);p.geo.computeBoundingBox();p.geo.computeBoundingSphere();}
  return {id:v.id,levels};
 });
 const records=[],m=new T.Matrix4(),p=new T.Vector3(),scale=new T.Vector3(),rot=new T.Quaternion(),up=new T.Vector3(0,1,0);
 for(let i=0;i<bank.n;i++){
  bank.im.getMatrixAt(i,m);if(Math.abs(m.determinant())<1e-8)continue;m.decompose(p,rot,scale);
  const variant=variants[i%variants.length],height=scale.y*.92,yaw=new T.Euler().setFromQuaternion(rot,'YXZ').y;
  // Root flare fits the established half-metre trunk collider. Retain each
  // original site and leave high branch spread above the mounted corridor.
  let rootRadius=0;for(const part of variant.levels[0].parts){const v=part.geo.attributes.position;for(let j=0;j<v.count;j++)if(v.getY(j)*height<.7)rootRadius=Math.max(rootRadius,Math.hypot(v.getX(j),v.getZ(j)));}
  const width=Math.min(height*.86,.48/Math.max(rootRadius,.001));
  const matrix=new T.Matrix4().compose(new T.Vector3(p.x,W.groundH(p.x,p.z)-.04,p.z),new T.Quaternion().setFromAxisAngle(up,yaw),new T.Vector3(width,height,width));
  records.push({index:i,x:p.x,z:p.z,height,width,yaw,variant:variant.id,matrix,near:false});
 }
 const groups=[];for(const variant of variants){const at=records.filter(t=>t.variant===variant.id);for(const level of variant.levels){const meshes=level.parts.map(part=>{
  const mesh=new T.InstancedMesh(part.geo,part.material,at.length);mesh.name='Deadwood | '+variant.id+' | '+level.level;mesh.castShadow=mesh.receiveShadow=true;mesh.count=0;mesh.frustumCulled=true;root.add(mesh);return mesh;
 });groups.push({variant:variant.id,level:level.level,triangles:level.triangles,records:at,meshes});}}
 const state={trees:records.length,nearTrees:0,triangles:0,budget:0,variants:variants.map(v=>({id:v.id,levels:v.levels.map(l=>({level:l.level,triangles:l.triangles}))})),records};
 let prior='';
 const update=()=>{
  const tier=G.gfx.get(),nearLimit=tier==='high'?24:tier==='medium'?12:0,range=tier==='high'?65:42;
  const dist=t=>(t.x-H.player.pos.x)**2+(t.z-H.player.pos.z)**2;
  const selected=new Set(records.filter(t=>dist(t)<(range+(t.near?6:0))**2).sort((a,b)=>dist(a)*(a.near?.72:1)-dist(b)*(b.near?.72:1)).slice(0,nearLimit));
  const key=tier+':'+[...selected].map(t=>t.index).sort((a,b)=>a-b).join(',')+':'+renderer.xr.isPresenting;
  if(key===prior)return;prior=key;for(const t of records)t.near=selected.has(t);
  let triangles=0;for(const g of groups){const visible=g.records.filter(t=>t.near===(g.level==='near'));triangles+=visible.length*g.triangles;
   for(const mesh of g.meshes){visible.forEach((t,i)=>mesh.setMatrixAt(i,t.matrix));mesh.count=visible.length;mesh.visible=!!visible.length;mesh.castShadow=!renderer.xr.isPresenting;mesh.instanceMatrix.needsUpdate=true;if(mesh.count)mesh.computeBoundingSphere();}
  }
  state.nearTrees=selected.size;state.triangles=triangles;state.budget=records.length*900+nearLimit*16000;
 };
 // Commit the replacement only once every source and derived mesh is ready.
 scene.add(root);bank.im.visible=false;state.root=root;state.update=update;update();return state;
}

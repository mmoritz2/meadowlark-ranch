import {planHollowpeakSourceFoot,planHollowpeakRebasedSourceFoot,permitsHollowpeakMember} from './hollowpeak-source-foot.mjs?v=hollowpeak-owned-ecology-1';
// Standing deadwood derived from the existing licensed tree scans. A compact
// solid far mesh keeps the same silhouette and footing without facing the camera.
export function installDeadwoodArt(G,{bank,catalog,sources,snagOwners=[]}){
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
  records.push({index:i,x:p.x,z:p.z,height,width,yaw,variant:variant.id,matrix,near:false,
   sourceParts:variant.levels[0].parts,originalMatrix:Array.from(matrix.elements),originalPlacementGround:W.groundH(p.x,p.z)});
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
  // Original near/far selections still spend their original slots; no refill.
  let triangles=0;for(const g of groups){const visible=g.records.filter(t=>t.near===(g.level==='near')&&permitsHollowpeakMember(t));triangles+=visible.length*g.triangles;
   for(const mesh of g.meshes){visible.forEach((t,i)=>mesh.setMatrixAt(i,t.matrix));mesh.count=visible.length;mesh.visible=!!visible.length;mesh.castShadow=!renderer.xr.isPresenting;mesh.instanceMatrix.needsUpdate=true;if(mesh.count)mesh.computeBoundingSphere();}
  }
  state.nearTrees=selected.size;state.activeNearTrees=[...selected].filter(permitsHollowpeakMember).length;state.activeTrees=records.filter(permitsHollowpeakMember).length;state.triangles=triangles;state.budget=records.length*900+nearLimit*16000;
 };
 // Resource capacities and original rows already exist. Queries never change
 // their construction, source selection, original near history or quota.
 state.applyHollowpeakCohort=({commit=true}={})=>{
  const queries=W.fallsLandscape?.ownedQueries;if(!queries)return {status:'awaiting-owned-queries',members:records.length};
  const plans=records.map(t=>planHollowpeakRebasedSourceFoot({id:'deadwood:'+t.index,parts:t.sourceParts,matrix:t.originalMatrix,queries,role:'deadwood',sourceKey:t.variant},t.originalPlacementGround));
  for(let i=0;i<records.length;i++)if(plans[i].action==='fit'&&plans[i].matrix.some((v,j)=>j!==13&&v!==records[i].originalMatrix[j]))throw Error('Deadwood cohort changed source pose');
  const summary={status:commit?'applied':'ready-to-commit',members:records.length,affected:plans.filter(p=>p.affected).length,retired:plans.filter(p=>p.action==='retire').length};
  if(!commit)return {...summary,plans};
  for(let i=0;i<records.length;i++){
   const t=records[i],plan=plans[i];t.hollowpeakCohort=plan;
   if(plan.affected&&plan.action!=='retire')t.matrix.elements[13]=plan.matrix[13];
   else t.matrix.elements[13]=t.originalMatrix[13];
  }
  prior='';update();return state.hollowpeakCohort=summary;
 };
 // Call only after all layout/capture consumers have settled. An exact writer
 // owner, never proximity, authorizes removal of a snag's original circle.
 state.finalizeHollowpeakContacts=({commit=true,cohortPlans=null}={})=>{
  // A caller may preflight contact removal against a dry-run plan before
  // assigning any member plan/matrix. Recompute only if no explicit plan given.
  if(commit&&records.some(t=>!t.hollowpeakCohort))return {status:'blocked',reason:'cohort matrices must commit before physical contacts',removed:0};
  let candidatePlans=cohortPlans;
  if(!candidatePlans){if(records.every(t=>t.hollowpeakCohort))candidatePlans=records.map(t=>t.hollowpeakCohort);else {const preview=state.applyHollowpeakCohort({commit:false});if(preview.status!=='ready-to-commit')return {status:preview.status,removed:0};candidatePlans=preview.plans;}}
  if(!Array.isArray(candidatePlans)||candidatePlans.length!==records.length)throw Error('Complete deadwood cohort plans required');
  if(commit&&candidatePlans.some((p,i)=>p?.action!==records[i].hollowpeakCohort?.action))throw Error('Deadwood physical plan differs from committed source plan');
  const requested=records.filter((t,i)=>candidatePlans[i]?.action==='retire'),plans=[],blocked=[],seenOwners=new Set(),seenContacts=new Set();
  for(const t of requested){
   const matches=snagOwners.filter(o=>o.bank===bank.im&&o.index===t.index),o=matches[0],c=o?.collider;
   if(matches.length!==1||!o||seenOwners.has(o)||seenContacts.has(c)||Math.fround(o.x)!==t.x||Math.fround(o.z)!==t.z||c?.x!==o.x||c?.z!==o.z||c?.r!==.5||c?.height!==o.height||Object.keys(c||{}).some(k=>!['x','z','r','height'].includes(k))||(!o.hollowpeakContactRetired&&W.colliders.filter(v=>v===c).length!==1)||(o.hollowpeakContactRetired&&W.colliders.includes(c)))blocked.push({index:t.index,reason:'missing or duplicate exact snag writer/contact owner'});
   else {plans.push({t,o,c});seenOwners.add(o);seenContacts.add(c);}
  }
  if(blocked.length)return {status:'blocked',blocked,removed:0};
  if(!commit)return {status:'ready-to-commit',requested:requested.length,removed:0};
  let removed=0;for(const {t,o,c} of plans){
   o.hollowpeakCohort=t.hollowpeakCohort;if(o.hollowpeakContactRetired)continue;
   W.colliders.splice(W.colliders.indexOf(c),1);const a=bank.im.instanceMatrix.array,start=t.index*16;a.fill(0,start,start+16);a[start+15]=1;bank.im.instanceMatrix.needsUpdate=true;o.hollowpeakContactRetired=true;removed++;
  }
  return {status:'applied',requested:requested.length,removed};
 };
 // Commit the replacement only once every source and derived mesh is ready.
 scene.add(root);bank.im.visible=false;state.root=root;state.update=update;update();return state;
}

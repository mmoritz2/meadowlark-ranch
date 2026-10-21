import{planHollowpeakSourceFoot,permitsHollowpeakMember}from'./hollowpeak-source-foot.mjs?v=hollowpeak-owned-ecology-1';
import{buildHollowpeakShoreData,createHollowpeakShoreContact}from'./hollowpeak-shore.mjs?v=hollowpeak-shore-2';
export {permitsHollowpeakMember};
const preparedTrees=new WeakMap(),shoreReferences=new WeakMap(),same=(a,b)=>a.length===b.length&&a.every((v,i)=>v===b[i]);

// CURRENT59 canonical decisions plus original live non-Hollowpeak floor owners.
// Old selected shore contributes only once its original installer is ready.
// This does not pretend to restore unrelated owner layouts or global async RNG.
export function hollowpeakSourceDecisionGround(W,x,z){
 if(typeof W.hollowpeakDecisionHeightAt!=='function')return W.groundH(x,z);
 const query=W.fallsLandscape?.ownedQueries;if(!query)throw Error('Owned queries must precede source decisions');
 if(!query.affectsFootprint({x0:x,x1:x,z0:z,z1:z},0))return W.groundH(x,z);
 let h=W.hollowpeakDecisionHeightAt(x,z);const old=W.hollowpeakShore,newContact=W.fallsLandscape?.ownedQueries?.shoreContact;
 for(const fn of W.groundSurfaces||[])if(fn!==old?.contact&&fn!==newContact)h=Math.max(h,fn(x,z));
 if(old?.status==='ready'){
  let contact=shoreReferences.get(old);if(!contact){contact=createHollowpeakShoreContact(buildHollowpeakShoreData(W.hollowpeakDecisionHeightAt).bank);shoreReferences.set(old,contact);}h=Math.max(h,contact(x,z));
 }
 return h;
}
export function hollowpeakSourceDecisionWorld(W){const proxy=Object.create(W);proxy.terrainH=W.hollowpeakDecisionHeightAt??W.terrainH;proxy.groundH=(x,z)=>hollowpeakSourceDecisionGround(W,x,z);return proxy;}
export function prepareHollowpeakDecisionTree(t,W){
 const queries=W.fallsLandscape?.ownedQueries;if(!queries){if(W.hollowpeakDecisionHeightAt)throw Error('Owned queries must precede every original tree construction');return false;}
 if(t.hollowpeakActualNominalMatrix)throw Error('Duplicate tree preparation');
 const plan=planHollowpeakSourceFoot({id:'tree:'+t.x+','+t.z,parts:t.source.parts,matrix:t.matrix,queries,role:'tree',sourceKey:t.source.key});
 if(!plan.affected)return false;
 t.hollowpeakActualNominalMatrix=Array.from(t.matrix.elements);
 t.hollowpeakActualNominalMatrix[13]=queries.ownedSupportHeightAt(t.x,t.z)-t.source.bounds.min.y*t.matrix.elements[5]-.07;
 // Preserve the original source/construction/planner pose through all old
 // allocation and retirement decisions. The actual new pose commits later.
 const sy=t.matrix.elements[5];t.matrix.elements[13]=hollowpeakSourceDecisionGround(W,t.x,t.z)-t.source.bounds.min.y*sy-.07;
 return true;
}
function ownedRefs(t,W){
 if(t.floraOwner)return{kind:'flora',collider:t.floraOwner.collider,forestPoint:t.floraOwner.forestPoint,source:t.floraOwner};
 if(t.hollowpeakCollider||t.hollowpeakForestPoint)return{kind:'authored',collider:t.hollowpeakCollider,forestPoint:t.hollowpeakForestPoint};
 const point=t.stem?.userData?.treePoints?.[t.index];
 if(point){const candidates=W.colliders.filter(c=>c.x===point.x&&c.z===point.z&&c.r===.8&&c.height===point.s*({oak:6.2,birch:6.6,blossom:6.2,pine:7.4,snowpine:7.2}[t.kind])&&Object.keys(c).every(k=>['x','z','r','height'].includes(k)));return{kind:'seed',collider:candidates.length===1?candidates[0]:null,forestPoint:point,source:point,ambiguous:candidates.length!==1};}
 return{kind:'unlinked'};
}
export function applyHollowpeakTreeCohort(G,trees,{commit=true,prepared=null}={}){
 const W=G.world,queries=W.fallsLandscape?.ownedQueries;if(!queries)throw Error('Owned queries must be bound before tree source allocation');
 if(prepared){const pending=preparedTrees.get(prepared);if(!pending||pending.G!==G||pending.trees!==trees)throw Error('Unknown tree cohort preflight');return commitTreeCohort(G,pending.members);}
 const members=[],blocked=[],seenColliders=new Set(),seenPoints=new Set(),seenParts=new Set();
 for(let id=0;id<trees.length;id++){
  const t=trees[id];if(!t.hollowpeakActualNominalMatrix)continue;
  if(t.retiredFallsFlora||t.retiredCountrysideVista){members.push({id,status:'original-retirement-preserved'});continue;}
  if(t.hollowpeakCohort)blocked.push({id,reason:'tree cohort already committed'});
  const nominal=t.hollowpeakActualNominalMatrix,plan=planHollowpeakSourceFoot({id:'tree:'+id,parts:t.source.parts,matrix:nominal,queries,role:'tree',sourceKey:t.source.key}),refs=ownedRefs(t,W),parts=t.hollowpeakSolidParts||[];
  if(plan.action==='retire'&&(!refs.collider||!refs.forestPoint||refs.ambiguous||W.colliders.filter(c=>c===refs.collider).length!==1||W.forestPoints.filter(p=>p===refs.forestPoint).length!==1))blocked.push({id,source:t.source.key,x:t.x,z:t.z,reason:'retirement requires unique exact original collider and forest point',ownerKind:refs.kind});
  if(plan.action==='retire'){if(seenColliders.has(refs.collider)||seenPoints.has(refs.forestPoint))blocked.push({id,reason:'shared collider or forest-point retirement owner'});seenColliders.add(refs.collider);seenPoints.add(refs.forestPoint);}
  for(const link of parts){if(!link.owner.userData.solidParts.includes(link.part)||seenParts.has(link.part))blocked.push({id,reason:'missing or duplicate original registered wood part'});seenParts.add(link.part);}
  members.push({id,t,plan,refs,parts});
 }
 if(blocked.length)return{status:'blocked-before-mutation',blocked,members:members.map(({t,refs,parts,...p})=>p)};
 if(!commit){const result={status:'ready-to-commit',members:members.map(({t,refs,parts,...m})=>m)};preparedTrees.set(result,{G,trees,members});return result;}
 return commitTreeCohort(G,members);
}
function commitTreeCohort(G,members){
 const W=G.world;
 for(const {t,plan,refs,parts}of members){if(!t)continue;if(t.hollowpeakCohort)throw Error('Tree cohort commit must run once');if(plan.action==='retire'&&(W.colliders.filter(c=>c===refs.collider).length!==1||W.forestPoints.filter(p=>p===refs.forestPoint).length!==1))throw Error('Tree physical ownership changed after preflight');for(const link of parts)if(!link.owner.userData.solidParts.includes(link.part))throw Error('Tree wood owner changed after preflight');}
 const owners=new Set();for(const member of members){const{t,plan,refs,parts}=member;if(!t)continue;
  if(t.hollowpeakCohort)throw Error('Tree cohort commit must run once');
  // Numerical view of the exact original matrix, with no extra Three resource.
  t.hollowpeakDecisionMatrix={elements:Array.from(t.matrix.elements)};t.hollowpeakCohort=plan;
  t.matrix.fromArray(plan.matrix);
  for(const link of parts){owners.add(link.owner);if(plan.action==='retire')link.owner.userData.solidParts.splice(link.owner.userData.solidParts.indexOf(link.part),1);else link.part.matrix=t.matrix.toArray();}
  if(plan.action==='retire'){W.colliders.splice(W.colliders.indexOf(refs.collider),1);W.forestPoints.splice(W.forestPoints.indexOf(refs.forestPoint),1);}
 }
 for(const owner of owners){W.solidWorld.unregister(owner);W.solidWorld.register(owner);}
 G.scene.getObjectByName('Pasture terrain')?.material.userData.setTrees?.(W.forestPoints);G.followCam.invalidateTrees();
 return{status:'applied',blocked:[],members:members.map(({t,refs,parts,...m})=>({...m,source:t?.source.key,x:t?.x,z:t?.z,solidParts:parts?.length,ownerKind:refs?.kind})),retired:members.filter(m=>m.plan?.action==='retire').length,fitted:members.filter(m=>m.plan?.action==='fit').length,originalSelectionsRefilled:false,bodyOrFullWorldParityAccepted:false};
}

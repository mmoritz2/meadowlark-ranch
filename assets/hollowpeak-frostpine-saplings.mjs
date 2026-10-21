import {planHollowpeakSourceFoot,planHollowpeakRebasedSourceFoot,permitsHollowpeakMember} from './hollowpeak-source-foot.mjs?v=hollowpeak-owned-ecology-1';
// Exact accepted-placement identities survive the original procedural variant,
// scanned quadrant, and final spatial-cell allocations. No Three constructors,
// original 96-attempt decisions, pose draws, source choices or quotas change.
const same=(a,b)=>a.length===b.length&&a.every((v,i)=>v===b[i]);
const banks=new WeakMap();
export function registerFrostpineSaplingBank(mesh,descriptor){
 banks.set(mesh,descriptor);
 // Keep public row provenance serializable; resident geometry/full-owner refs
 // stay in the private WeakMap rather than creating cyclic scene userData.
 mesh.userData.hollowpeakSaplingBank={kind:descriptor.kind,sourceKey:descriptor.sourceKey,sourceIndices:descriptor.sourceIndices};
}
function capture(mesh){
 const meta=banks.get(mesh);if(!meta||!Array.isArray(meta.parts)||!Array.isArray(meta.sourceIndices))throw Error('Exact Frostpine source-bank metadata required');
 mesh.updateWorldMatrix(true,false);if(!mesh.matrixWorld.elements.every((v,i)=>v===(i%5===0?1:0)))throw Error('Frostpine source banks require their original identity world frame');
 const indices=mesh.userData.sceneryCell?.sourceIndices??Array.from({length:mesh.count},(_,i)=>i);
 if(indices.length!==mesh.count||new Set(indices).size!==indices.length)throw Error('Invalid Frostpine spatial-cell source mapping');
 const rows=indices.map((sourceRow,row)=>{
  const sourceIndex=meta.sourceIndices[sourceRow];if(!Number.isInteger(sourceIndex)||sourceIndex<0)throw Error('Missing Frostpine original placement identity');
  const matrix=Array.from(mesh.instanceMatrix.array.subarray(row*16,row*16+16));if(matrix.length!==16||!matrix.every(Number.isFinite))throw Error('Finite Frostpine source matrix required');
  const originalPlacementGround=meta.placementGrounds?.[sourceRow];if(!Number.isFinite(originalPlacementGround))throw Error('Captured Frostpine original placement ground required');
  return {sourceIndex,sourceRow,matrix,originalPlacementGround,color:mesh.instanceColor?Array.from(mesh.instanceColor.array.subarray(row*3,row*3+3)):null};
 });
 return {mesh,meta,rows};
}
export function createFrostpineSaplingCohort({world:W,procedural=[]}){
 const proceduralBanks=procedural.map(capture);let scannedBanks=[],scannedSources=[];
 const state={profile:'hollowpeak-frostpine-source-cohort-1',proceduralBanks,scannedBanks,sourceOwners:scannedSources,members:[],physicsOwners:0};
 state.setScanned=meshes=>{
  if(state.applied)throw Error('Frostpine sources must finish original allocation before cohort commit');
  scannedBanks=meshes.map(capture);const sourceMeshes=new Set(scannedBanks.map(b=>b.meta.sourceMesh));
  if(sourceMeshes.has(undefined))throw Error('Original full scanned source owner missing');
  scannedSources=[...sourceMeshes].map(capture);state.scannedBanks=scannedBanks;state.sourceOwners=scannedSources;
 };
 state.applyHollowpeakCohort=({commit=true}={})=>{
  if(state.applied)return commit?state.result:{...state.result,status:'ready-to-commit',alreadyApplied:true};
  const queries=W.fallsLandscape?.ownedQueries;if(!queries)return {status:'awaiting-owned-queries',members:0};
  const active=scannedBanks.length?scannedBanks:proceduralBanks,authority=new Map();
  for(const bank of active)for(const row of bank.rows){
   const previous=authority.get(row.sourceIndex);
   if(previous&&!same(previous.originalMatrix,row.matrix))throw Error('Frostpine parts disagree on original source pose');
   if(!previous)authority.set(row.sourceIndex,{id:'frostpine-sapling:'+row.sourceIndex,sourceIndex:row.sourceIndex,sourceKey:bank.meta.sourceKey,parts:bank.meta.parts,originalMatrix:row.matrix,originalPlacementGround:row.originalPlacementGround});
  }
  // Every procedural placement must have the corresponding actual scanned
  // owner when conversion succeeded. A missing cell is not a retirement policy.
  const originalIDs=new Set(proceduralBanks.flatMap(b=>b.rows.map(r=>r.sourceIndex)));
  if(authority.size!==originalIDs.size||[...originalIDs].some(id=>!authority.has(id)))throw Error('Incomplete Frostpine source replacement mapping');
  const members=[...authority.values()].map(t=>({...t,hollowpeakCohort:planHollowpeakRebasedSourceFoot({id:t.id,parts:t.parts,matrix:t.originalMatrix,queries,role:'sapling',sourceKey:t.sourceKey},t.originalPlacementGround)}));
  for(const t of members)if(t.hollowpeakCohort.matrix.some((v,i)=>i!==13&&v!==t.originalMatrix[i]))throw Error('Frostpine cohort changed original source pose');
  const summary={status:commit?'applied':'ready-to-commit',members:members.length,affected:members.filter(t=>t.hollowpeakCohort.affected).length,retired:members.filter(t=>!permitsHollowpeakMember(t)).length,fitted:members.filter(t=>t.hollowpeakCohort.action==='fit').length,originalQuotaRefilled:false,physicsOwners:0,sourceGeometryPolicyAccepted:false};
  if(!commit)return {...summary,plans:members};
  const byID=new Map(members.map(t=>[t.sourceIndex,t]));
  function write(bank,draw){
   const mesh=bank.mesh,p=mesh.instanceMatrix.array,c=mesh.instanceColor?.array;let count=0;
   for(let originalRow=0;originalRow<bank.rows.length;originalRow++){
    const row=bank.rows[originalRow],member=byID.get(row.sourceIndex),plan=member.hollowpeakCohort,allowed=permitsHollowpeakMember(member),target=draw?count:originalRow,start=target*16;
    if(draw&&!allowed)continue;
    if(allowed){p.set(row.matrix,start);if(plan.affected&&plan.action!=='retire')p[start+13]=row.matrix[13]+plan.matrix[13]-member.originalMatrix[13];if(c&&row.color)c.set(row.color,target*3);if(draw)count++;}
    else {p.fill(0,start,start+16);p[start+15]=1;}
   }
   mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
   if(draw){mesh.count=count;mesh.visible=mesh.visible&&count>0;if(count)mesh.computeBoundingBox(),mesh.computeBoundingSphere();}
   mesh.userData.hollowpeakSourceIndices=bank.rows.map(r=>r.sourceIndex);
   mesh.userData.hollowpeakActiveSourceIndices=bank.rows.filter(r=>permitsHollowpeakMember(byID.get(r.sourceIndex))).map(r=>r.sourceIndex);
   mesh.userData.hollowpeakRetiredSourceIndices=bank.rows.filter(r=>!permitsHollowpeakMember(byID.get(r.sourceIndex))).map(r=>r.sourceIndex);
  }
  // Full original scanned rows and superseded procedural rows are explicitly
  // masked too; the final live cell/full banks compact the same allowed IDs.
  if(scannedBanks.length){for(const b of proceduralBanks)write(b,false);for(const b of scannedSources)write(b,false);}
  for(const b of active)write(b,true);
  state.members=members;state.applied=true;
  return state.result=summary;
 };
 return state;
}

import {activeWorldTree} from './countryside-vista-owners.mjs?v=countryside-vista-1';
// Source-derived medium canopy policy. Copies the current numerical crown projection;
// no Three resources, source changes, seeded draws or physical registrations.
export const MEDIUM_WORLD_POLICY_PROFILE='medium-canopy-world-preserved-close-v2';
export const MEDIUM_WORLD_POLICY_LIMITS=Object.freeze({highTriangles:1800000,otherTriangles:750000,minimumRange:40,maximumRange:100,retainedMaximumRange:108,newArea:.0004,retainedArea:.0003,protectedPineArea:.002,retentionMultiplier:1/.72});
function multiplyCrownMatrices(a,b){const out=new Array(16);for(let col=0;col<4;col++)for(let row=0;row<4;row++)out[col*4+row]=a[row]*b[col*4]+a[row+4]*b[col*4+1]+a[row+8]*b[col*4+2]+a[row+12]*b[col*4+3];return out;}
export function crownViewProjection(camera){const p=camera?.projectionMatrix?.elements,v=camera?.matrixWorldInverse?.elements;return p?.length===16&&v?.length===16&&p.every(Number.isFinite)&&v.every(Number.isFinite)?multiplyCrownMatrices(p,v):null;}
export function projectedCrownBenefit(tree,viewProjection){
 if(!viewProjection||!tree.matrix?.elements)return null;
 const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];let surfaces=0;
 for(const part of tree.source.parts||[]){if(!/leaves|twig/.test(part.mat?.name||''))continue;const b=part.bounds;if(!b)continue;surfaces++;for(let i=0;i<3;i++){const key=['x','y','z'][i];min[i]=Math.min(min[i],b.min[key]);max[i]=Math.max(max[i],b.max[key]);}}
 if(!surfaces||![...min,...max].every(Number.isFinite))return null;
 const m=multiplyCrownMatrices(viewProjection,tree.matrix.elements),corners=[];
 for(let i=0;i<8;i++){const x=i&1?max[0]:min[0],y=i&2?max[1]:min[1],z=i&4?max[2]:min[2];corners.push([m[0]*x+m[4]*y+m[8]*z+m[12],m[1]*x+m[5]*y+m[9]*z+m[13],m[2]*x+m[6]*y+m[10]*z+m[14],m[3]*x+m[7]*y+m[11]*z+m[15]]);}
 if(corners.some(c=>!c.every(Number.isFinite)))return null;
 for(let axis=0;axis<3;axis++)for(const sign of[-1,1])if(corners.every(c=>c[3]+sign*c[axis]<0))return{visible:false,area:0};
 // Project only the portion in front of the near plane. Clipping box edges
 // avoids enormous sign-flipped screen rectangles when a crown crosses it.
 const clipped=[];for(const c of corners)if(c[2]+c[3]>=0&&c[3]>0)clipped.push(c);
 for(let i=0;i<8;i++)for(const bit of[1,2,4])if(!(i&bit)){const a=corners[i],b=corners[i|bit],da=a[2]+a[3],db=b[2]+b[3];if((da<0)!==(db<0)){const t=da/(da-db),c=a.map((v,k)=>v+(b[k]-v)*t);if(c[3]>0)clipped.push(c);}}
 if(!clipped.length)return{visible:false,area:0};
 let left=1,right=-1,bottom=1,top=-1;for(const c of clipped){left=Math.min(left,c[0]/c[3]);right=Math.max(right,c[0]/c[3]);bottom=Math.min(bottom,c[1]/c[3]);top=Math.max(top,c[1]/c[3]);}
 left=Math.max(-1,left);right=Math.min(1,right);bottom=Math.max(-1,bottom);top=Math.min(1,top);const area=Math.max(0,right-left)*Math.max(0,top-bottom)*.25;
 return{visible:area>0,area,rect:[left,bottom,right,top]};
}

export function selectMediumCanopyWorld({trees,nearSelection=[],planningMiddleSelection=[],middleSelection=[],camera,player,tier,enabled=true,authoredTriangles=0,mediumTriangleCost=8355,previousMediumSelection=new Set()}){
 const limits=MEDIUM_WORLD_POLICY_LIMITS,triangleBudget=tier==='high'?limits.highTriangles:limits.otherTriangles;
 if(!Number.isFinite(authoredTriangles)||authoredTriangles<0||!Number.isFinite(mediumTriangleCost)||mediumTriangleCost<=0)throw new TypeError('Finite nonnegative authored triangles and positive medium cost required');
 const near=enabled?[...nearSelection]:[],planning=[...planningMiddleSelection],originalMiddle=[...middleSelection],middle=[],medium=[],full=new Set(near),mediumSet=new Set();
 const cost=t=>t?.source?.triangles;
 if(near.some(t=>!Number.isFinite(cost(t))||cost(t)<=0)||full.size!==near.length)throw new TypeError('Original near selection must have unique valid source records');
 let fullTriangles=near.reduce((sum,t)=>sum+cost(t),0),mediumTriangles=0,triangleCount=authoredTriangles+fullTriangles;
 if(triangleCount>triangleBudget)throw new RangeError('Original near selection exceeds original shared triangle cap');
 const projection=crownViewProjection(camera),benefits=new Map(),px=Array.isArray(player)?player[0]:player?.x,pz=Array.isArray(player)?player[2]:player?.z;
 if(enabled&&(!Number.isFinite(px)||!Number.isFinite(pz)))throw new TypeError('Actual player x/z required for medium range');
 const distance=t=>Math.hypot(t.x-px,t.z-pz),benefit=t=>{if(!benefits.has(t))benefits.set(t,projectedCrownBenefit(t,projection));return benefits.get(t);};
 const valid=t=>t&&activeWorldTree(t)&&Number.isFinite(cost(t))&&cost(t)>0;
 const addFull=t=>{if(!valid(t)||full.has(t)||mediumSet.has(t)||triangleCount+cost(t)>triangleBudget)return false;middle.push(t);full.add(t);fullTriangles+=cost(t);triangleCount+=cost(t);return true;};
 if(enabled&&!projection){for(const t of originalMiddle)addFull(t);}
 if(enabled&&projection){
  // Keep all close original full middle choices and meaningful planned full pines.
  // The original near list, planning history and original planner remain untouched.
  for(const t of originalMiddle)if(distance(t)<limits.minimumRange)addFull(t);
  for(const t of planning)if(t.source?.key==='mature-pine'&&benefit(t)?.visible&&benefit(t).area>=limits.protectedPineArea)addFull(t);
  const candidates=projection?trees.filter(t=>{
   if(!valid(t)||t.source.key!=='canopy-broadleaf'||full.has(t))return false;
   const retained=previousMediumSelection.has(t),d=distance(t),b=benefit(t);
   return d>=limits.minimumRange&&d<=(retained?limits.retainedMaximumRange:limits.maximumRange)&&b?.visible&&b.area>=(retained?limits.retainedArea:limits.newArea);
  }):[];
  const score=t=>benefit(t).area/mediumTriangleCost*(previousMediumSelection.has(t)?limits.retentionMultiplier:1);
  candidates.sort((a,b)=>score(b)-score(a));
  for(const t of candidates)if(triangleCount+mediumTriangleCost<=triangleBudget){medium.push(t);mediumSet.add(t);mediumTriangles+=mediumTriangleCost;triangleCount+=mediumTriangleCost;}
  // Other existing full middle choices use the remainder. No arbitrary new full
  // models, blind count cap, or changes to the original planner's private history.
  for(const t of originalMiddle)if(t.source?.key!=='canopy-broadleaf')addFull(t);
 }
 return {profile:MEDIUM_WORLD_POLICY_PROFILE,nearSelection:near,planningMiddleSelection:planning,originalMiddleSelection:originalMiddle,middleSelection:middle,mediumSelection:medium,fullSelection:[...near,...middle],triangleCount,triangleBudget,authoredTriangles,fullTriangles,mediumTriangles,mediumTriangleCost,projectedMedium:medium.map(t=>({tree:t,area:benefit(t).area,distance:distance(t),retained:previousMediumSelection.has(t)}))};
}

const MODEL_SHA='890fd735f290b42683195ea39952507e044fc6ac1f5d8565fee43092ec4c2500';
const requireCondition=(condition,message)=>{if(!condition)throw Error('Island medium canopy: '+message);};
function syncPrivateUUIDs(run){
 // This narrow synchronous resource constructor never encloses a loader await,
 // world update, callback registration or unrelated layout work.
 const original=Math.random;let seed=0x716c45b3;
 Math.random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
 try{return run();}finally{Math.random=original;}
}
function treeIdentity(t){return {source:t.source,x:t.x,z:t.z,height:t.height,matrix:t.matrix,matrixValues:t.matrix.elements.slice(),tint:t.tint,tintValues:t.tint?.toArray()};}
function assertTreeIdentity(t,before){requireCondition(t.source===before.source&&t.x===before.x&&t.z===before.z&&t.height===before.height&&t.matrix===before.matrix&&t.tint===before.tint,'tree source/pose/tint reference changed');requireCondition(t.matrix.elements.every((v,i)=>v===before.matrixValues[i]),'tree matrix values changed');if(t.tint)requireCondition(t.tint.toArray().every((v,i)=>v===before.tintValues[i]),'tree tint values changed');}

export async function installIslandMediumCanopy(G,woodland,{modelURL='./assets/models/world/realism/island_tree_01_medium.glb?v=island-medium-canopy-1',modelSHA256=MODEL_SHA}={}){
 requireCondition(G?.THREE&&G.renderer&&G.horse?.player?.pos,'actual world/controller unavailable');
 requireCondition(woodland?.GLTFLoader&&woodland.configureMaterial&&woodland.originalSelection&&woodland.group,'required existing source context missing');
 const identities=woodland.trees.map(treeIdentity);
 // The complete original world/layout has settled before entry. The late
 // readiness owner is separate from scans.ready. No asynchronous RNG swapping.
 const asset=await new woodland.GLTFLoader().loadAsync(modelURL);
 asset.scene.updateMatrixWorld(true);
 const controller=syncPrivateUUIDs(()=>{
  const T=G.THREE,parts=[],materials=new Set(),sourceBounds=new T.Box3();
  asset.scene.traverse(o=>{
   if(!o.isMesh)return;
   requireCondition(!Array.isArray(o.material),'unexpected multi-material primitive');
   if(o.material.name==='island_tree_01_leaves'){
    const shade=o.geometry.getAttribute('_canopy_shade');
    requireCondition(shade&&o.geometry.getAttribute('tangent'),'target shade or explicit tangents missing');
    o.geometry.setAttribute('canopyShade',shade);
    o.material.color.multiply(new T.Color().setRGB(.82,1,.66));
   }
   o.material.userData.hasCanopyShade=!!o.geometry.getAttribute('canopyShade');
   materials.add(o.material);
  });
  for(const material of materials)woodland.configureMaterial(material,/leaves|twig/.test(material.name));
  asset.scene.traverse(o=>{
   if(!o.isMesh)return;
   const geo=o.geometry.clone().applyMatrix4(o.matrixWorld);geo.computeBoundingBox();geo.computeBoundingSphere();
   const part={geo,mat:o.material,name:o.name||o.material.name,bounds:geo.boundingBox.clone(),triangles:(geo.index?.count||geo.attributes.position.count)/3};
   if(part.mat.name==='island_tree_01_leaves')requireCondition(part.mat.normalScale.toArray().every(v=>Math.abs(v-1)<1e-6),'medium tangent normal scale/sign is not [1,1]');
   parts.push(part);sourceBounds.union(part.bounds);
  });
  requireCondition(parts.length===3,'expected three complete medium primitives');
  const triangles=parts.reduce((n,p)=>n+p.triangles,0);requireCondition(triangles===8355,'unexpected complete medium triangle cost');
  woodland.trees.forEach((t,i)=>assertTreeIdentity(t,identities[i]));
  return createMediumCanopyController(G,woodland,{parts,triangles,bounds:sourceBounds,key:'island-medium-v1',sourceKey:'canopy-broadleaf',modelURL,modelSHA256,sourceHeight:5.0270365215837955});
 });
 woodland.trees.forEach((t,i)=>assertTreeIdentity(t,identities[i]));
 try{controller.update();return controller;}catch(error){controller.dispose();throw error;}
}

// Exported separately for CPU tests with actual Three buffers but no renderer.
export function createMediumCanopyController(G,woodland,mediumSource,{policy=selectMediumCanopyWorld}={}){
 const T=G.THREE,WHITE=new T.Color(0xffffff),trees=woodland.trees,ids=new Map(trees.map((t,i)=>[t,i]));
 const records=trees.filter(t=>t.source.key==='canopy-broadleaf');requireCondition(records.length>0,'no original Island source trees');
 const mediumMeshes=mediumSource.parts.map((part,index)=>{
  const mesh=new T.InstancedMesh(part.geo,part.mat,records.length);
  mesh.name='Medium Island canopy | '+part.mat.name;
  mesh.count=0;mesh.visible=false;mesh.castShadow=true;mesh.receiveShadow=true;
  mesh.customDepthMaterial=part.mat.userData.scanDepth;
  // Establish the same instance-color attribute as the original source banks.
  mesh.setColorAt(0,WHITE);mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);mesh.instanceColor.setUsage(T.DynamicDrawUsage);
  woodland.group.add(mesh);
  return {mesh,records,source:mediumSource,part:index};
 });
 let previousMediumSelection=new Set(),selection={selected:[],near:[],middle:[],planningMiddle:[],medium:[]},ledger=null,updates=0,mode=null;
 const written=new WeakMap();
 function updateBank(row,want,newMode,kind){
  const mesh=row.mesh,last=written.get(mesh),indices=want.map(t=>ids.get(t));
  const externallyChanged=!last||last.matrixVersion!==mesh.instanceMatrix.version||last.colorVersion!==(mesh.instanceColor?.version??null)||last.count!==mesh.count;
  const setChanged=!last||last.ids.length!==indices.length||last.ids.some((id,i)=>id!==indices[i]);
  // The original updater still owns its own history and may have just written
  // this bank. Its version change must trigger restoration even if our actual
  // tier set did not change since the last medium call.
  if(externallyChanged||setChanged||mode!==newMode){
   const foliage=/leaves|twig/.test(mesh.material.name);
   for(let i=0;i<want.length;i++){const t=want[i];mesh.setMatrixAt(i,t.matrix);mesh.setColorAt(i,kind==='far'||foliage?t.tint||WHITE:WHITE);}
   mesh.count=want.length;mesh.visible=want.length>0;mesh.castShadow=!G.renderer.xr.isPresenting;
   mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
   if(want.length)mesh.computeBoundingSphere();
   written.set(mesh,{ids:indices,count:mesh.count,matrixVersion:mesh.instanceMatrix.version,colorVersion:mesh.instanceColor?.version??null});
  }
 }
 function update(){
  const original=woodland.originalSelection(),tier=G.gfx.get(),enabled=!G.renderer.xr.isPresenting,newMode=tier+':'+G.renderer.xr.isPresenting;
  const state=G.photoscans,authoredTriangles=(state.villageEvergreens?.triangles||0)+(state.willows?.triangles||0)+(state.thunderOak?.triangles||0);
  const result=policy({trees,nearSelection:original.near,planningMiddleSelection:original.planningMiddle,middleSelection:original.middle,camera:G.camera,player:G.horse.player.pos,tier,enabled,authoredTriangles,mediumTriangleCost:mediumSource.triangles,previousMediumSelection});
  const full=new Set(result.fullSelection),medium=new Set(result.mediumSelection);
  requireCondition(result.nearSelection.length===original.near.length&&result.nearSelection.every((t,i)=>t===original.near[i]),'original near selection changed');
  requireCondition([...medium].every(t=>t.source.key==='canopy-broadleaf'&&!full.has(t)&&activeWorldTree(t)),'invalid medium source, retirement or overlapping tier');
  requireCondition(result.triangleCount===authoredTriangles+[...full].reduce((n,t)=>n+t.source.triangles,0)+medium.size*mediumSource.triangles,'actual model cost mismatch');
  requireCondition(result.triangleCount<=result.triangleBudget,'unchanged triangle cap exceeded');
  for(const row of woodland.treeMeshes)updateBank(row,row.records.filter(t=>full.has(t)),newMode,'full');
  for(const row of woodland.treeCards)updateBank(row,row.records.filter(t=>activeWorldTree(t)&&!full.has(t)&&!medium.has(t)),newMode,'far');
  for(const row of mediumMeshes)updateBank(row,row.records.filter(t=>medium.has(t)),newMode,'medium');
  const bufferTriangles=rows=>rows.reduce((sum,{mesh})=>sum+(mesh.geometry.index?.count||mesh.geometry.attributes.position.count)/3*mesh.count,0);
  const fullBufferTriangles=bufferTriangles(woodland.treeMeshes),mediumBufferTriangles=bufferTriangles(mediumMeshes),farTriangles=bufferTriangles(woodland.treeCards);
  requireCondition(fullBufferTriangles===result.fullTriangles&&mediumBufferTriangles===result.mediumTriangles,'actual tier buffers disagree with source triangle ledger');
  mode=newMode;previousMediumSelection=medium;
  selection={selected:[...full],near:result.nearSelection.slice(),middle:result.middleSelection.slice(),planningMiddle:result.planningMiddleSelection.slice(),medium:[...medium]};
  ledger={profile:'island-medium-canopy-1',tier,xr:!enabled,triangleCount:result.triangleCount,triangleBudget:result.triangleBudget,authoredTriangles,fullTriangles:result.fullTriangles,mediumTriangles:result.mediumTriangles,fullBufferTriangles,mediumBufferTriangles,farTriangles,totalRenderTriangles:result.triangleCount+farTriangles,mediumTriangleCost:mediumSource.triangles,nearIDs:selection.near.map(t=>ids.get(t)),fullMiddleIDs:selection.middle.map(t=>ids.get(t)),fullIDs:selection.selected.map(t=>ids.get(t)),mediumIDs:selection.medium.map(t=>ids.get(t)),planningMiddleIDs:selection.planningMiddle.map(t=>ids.get(t)),originalMiddleIDs:original.middle.map(t=>ids.get(t)),fullCount:full.size,mediumCount:medium.size,farCount:trees.filter(t=>activeWorldTree(t)&&!full.has(t)&&!medium.has(t)).length,updates:++updates};
  return ledger;
 }
 function dispose(){
  for(const {mesh} of mediumMeshes){mesh.removeFromParent();mesh.count=0;mesh.visible=false;mesh.dispose();}
  const geometries=new Set(mediumSource.parts.map(p=>p.geo)),materials=new Set(mediumSource.parts.map(p=>p.mat)),textures=new Set();
  for(const mat of [...materials])if(mat.userData.scanDepth)materials.add(mat.userData.scanDepth);
  for(const mat of materials)for(const value of Object.values(mat))if(value?.isTexture)textures.add(value);
  for(const geo of geometries)geo.dispose();for(const mat of materials)mat.dispose();for(const texture of textures)texture.dispose();
 }
 function snapshot(){return {...ledger,modelSHA256:mediumSource.modelSHA256,mediumParts:mediumSource.parts.map(p=>({material:p.mat.name,triangles:p.triangles,attributes:Object.keys(p.geo.attributes),alphaTest:p.mat.alphaTest,normalScale:p.mat.normalScale?.toArray(),hasCanopyShade:!!p.mat.userData.hasCanopyShade,color:p.mat.color.toArray()})),banks:mediumMeshes.map(({mesh,records,part})=>({part,name:mesh.name,count:mesh.count,capacity:records.length,visible:mesh.visible,castShadow:mesh.castShadow,receiveShadow:mesh.receiveShadow,depthMatchesMaterial:mesh.customDepthMaterial===mesh.material.userData.scanDepth,activeIDs:records.filter(t=>selection.medium.includes(t)).map(t=>ids.get(t)),matrixVersion:mesh.instanceMatrix.version,colorVersion:mesh.instanceColor?.version}))};}
 return {update,dispose,selection:()=>({...selection,selected:selection.selected.slice(),near:selection.near.slice(),middle:selection.middle.slice(),planningMiddle:selection.planningMiddle.slice(),medium:selection.medium.slice()}),snapshot,mediumMeshes,mediumSource,scope:'Late source-derived canopy tier. Original source-tree/pose/tint/physical/planner histories remain authoritative.'};
}

// These copies are planner diagnostics, not actual submitted-tier counters.
export function originalCanopyPlannerLedger(state,trees,selection){
 return {profile:'original-projected-middle-crowns-2',activeTreeTriangles:state.activeTreeTriangles,treeTriangleBudget:state.treeTriangleBudget,activeTrees:state.activeTrees,activeNearTrees:state.activeNearTrees,activeMiddleTrees:state.activeMiddleTrees,activeRenderedTrees:state.activeRenderedTrees,distantTrees:trees&&selection?trees.filter(t=>activeWorldTree(t)).length-selection.size:state.distantTrees,treeCrownLOD:state.treeCrownLOD};
}
export function publishMediumCanopyLedger(state,controller){
 const actual=controller.snapshot(),selection=controller.selection();
 state.activeTreeTriangles=actual.triangleCount;state.treeTriangleBudget=actual.triangleBudget;
 state.activeTrees=actual.fullCount+actual.mediumCount;state.activeNearTrees=selection.near.length;state.activeMiddleTrees=selection.middle.length+actual.mediumCount;state.activeRenderedTrees=state.activeTrees;state.distantTrees=actual.farCount;
 state.activeFullTrees=actual.fullCount;state.activeMediumTrees=actual.mediumCount;state.activeTreeFullTriangles=actual.fullTriangles;state.activeTreeMediumTriangles=actual.mediumTriangles;state.activeTreeCardTriangles=actual.farTriangles;state.activeTreeRenderTriangles=actual.totalRenderTriangles;
 state.treeCrownLOD={profile:'island-medium-canopy-1',nearTrees:selection.near.length,middleTrees:state.activeMiddleTrees,fullMiddleTrees:selection.middle.length,mediumTrees:actual.mediumCount,planningMiddleTrees:selection.planningMiddle.length,authoredTriangles:actual.authoredTriangles,triangles:actual.triangleCount,triangleBudget:actual.triangleBudget,fullTriangles:actual.fullTriangles,mediumTriangles:actual.mediumTriangles,cardTriangles:actual.farTriangles,middleSites:[...selection.middle.map(t=>({x:t.x,z:t.z,source:t.source.key,renderedTier:'full',triangles:t.source.triangles})),...selection.medium.map(t=>({x:t.x,z:t.z,source:t.source.key,renderedTier:'medium',triangles:actual.mediumTriangleCost}))]};
 return actual;
}
// Layout dependencies are captured after the synchronous installers. Waiting for
// scans.ready here, outside that promise, preserves the existing narrow contract.
export async function waitForMediumCanopyWorld(G,state){
 await Promise.resolve();
 await Promise.all([state.ready,G.worldDetails?.ready,G.undergrowth?.ready,G.world.ranchBuilderArt?.ready,G.worldPkg?.oasisReady,G.quartersPkg?.saplingsReady,G.worldPaths?.roadsideReady,G.world.mixedSward?.ready]);
 await Promise.all([state.floraRetirementReady,G.waterPkg?.ferryBankApproachReady,G.world.pastoralCoverReady,G.world.chalkCoverReady,G.world.outerLandscape?.youngWoodland?.pending,G.world.outerLandscape?.sunShadows?.pending,G.worldPaths?.trailCorridorReady]);
 // Course turf is allocated by the pastoral completion chain, not at startup.
 await G.world.courseTurf?.ready;
 await Promise.resolve();
}

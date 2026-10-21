// Artifact proposal: register actual steep canonical faces with the existing
// solidWorld. No shaded-skin offset, rendered mesh, material or support floor.
export const HOLLOWPEAK_TERRAIN_COLLISION_PROFILE='hollowpeak-terrain-collision-1';
// This is the existing design.barrierCandidates policy (rise/run, ~33 degrees),
// not a claim that one slope threshold certifies a particular horse body.
export const HOLLOWPEAK_TERRAIN_COLLISION_GRADE=.65;
const installed=new WeakMap();
let uuidSeed=0x7ac18e35;
function resources(make){
 const previous=Math.random;
 Math.random=()=>{uuidSeed=(Math.imul(uuidSeed,1664525)+1013904223)>>>0;return uuidSeed/4294967296;};
 try{return make();}finally{Math.random=previous;}
}
const finite=Number.isFinite;
function config({heights,segments,step,originX,originZ,bounds,minimumGrade}){
 if(!(heights instanceof Float32Array)||!Number.isInteger(segments)||segments<1||heights.length!==(segments+1)**2||!(step>0)||!finite(step+originX+originZ)||!bounds||!['x0','x1','z0','z1'].every(k=>finite(bounds[k]))||bounds.x1<=bounds.x0||bounds.z1<=bounds.z0||!(minimumGrade>=0)||!finite(minimumGrade))throw new TypeError('Finite canonical Float32 grid, owned bounds and grade required');
 if(bounds.x0<originX||bounds.z0<originZ||bounds.x1>originX+segments*step||bounds.z1>originZ+segments*step)throw new RangeError('Owned bounds must lie inside the canonical grid');
}
/** Copy a static, indexed subset of the caller's final canonical field.
 * Whole intersecting cells are retained: clipping at a rectangle would invent
 * noncanonical triangles. The physical footprint can include a one-cell halo.
 * Mutating heights later requires dispose/reinstall; registerSurface is static.
 */
export function buildHollowpeakSteepTerrainData({heights,segments,step,originX,originZ,bounds,minimumGrade=HOLLOWPEAK_TERRAIN_COLLISION_GRADE}){
 config({heights,segments,step,originX,originZ,bounds,minimumGrade});
 const size=segments+1,positions=[],indices=[],sourceVertices=[],faces=[],grades=[],local=new Map();
 const ix0=Math.floor((bounds.x0-originX)/step),ix1=Math.min(segments-1,Math.ceil((bounds.x1-originX)/step)-1),iz0=Math.floor((bounds.z0-originZ)/step),iz1=Math.min(segments-1,Math.ceil((bounds.z1-originZ)/step)-1);
 function vertex(id){
  if(local.has(id))return local.get(id);
  const ix=id%size,iz=Math.floor(id/size),j=sourceVertices.length;
  sourceVertices.push(id);positions.push(originX+ix*step,heights[id],originZ+iz*step);local.set(id,j);return j;
 }
 let cells=0;
 for(let iz=iz0;iz<=iz1;iz++)for(let ix=ix0;ix<=ix1;ix++){
  const a=iz*size+ix,b=a+size,d=a+1,c=b+1,ha=heights[a],hb=heights[b],hc=heights[c],hd=heights[d];
  if(!finite(ha+hb+hc+hd))throw new TypeError('Nonfinite owned canonical cell');
  cells++;
  const candidates=[[a,b,d,(hd-ha)/step,(hb-ha)/step],[d,b,c,(hc-hb)/step,(hc-hd)/step]];
  for(let side=0;side<2;side++){
   const t=candidates[side],grade=Math.hypot(t[3],t[4]);if(grade<minimumGrade)continue;
   indices.push(vertex(t[0]),vertex(t[1]),vertex(t[2]));faces.push(2*(iz*segments+ix)+side);grades.push(grade);
  }
 }
 if(!indices.length)throw new RangeError('Owned canonical region has no selected steep faces');
 return{position:new Float32Array(positions),index:new Uint32Array(indices),canonicalVertices:new Uint32Array(sourceVertices),canonicalFaces:new Uint32Array(faces),grades:new Float64Array(grades),cellsExamined:cells};
}
/** Install once per landscape. Existing L.barriers remain intact as planning
 * records. Explicit replaceLegacyBarriers() removes ONLY those exact references
 * from live colliders after the cohort's original construction phase completes.
 */
export function installHollowpeakTerrainCollision({THREE:T,W,landscape=W?.fallsLandscape,heights,segments,step,originX,originZ,bounds,minimumGrade=HOLLOWPEAK_TERRAIN_COLLISION_GRADE,sourceID=''}){
 const solid=W?.solidWorld,colliders=W?.colliders,parent=landscape?.group,barriers=landscape?.barriers;
 if(!T?.Object3D||!T?.BufferGeometry||!T?.BufferAttribute||!T?.Matrix4||!solid?.registerSurface||!solid?.unregisterSurface||!parent?.add||!Array.isArray(colliders)||!Array.isArray(barriers)||!barriers.length)throw new TypeError('Existing solidWorld, landscape owner and exact barrier records required');
 const prior=installed.get(landscape);
 if(prior){
  const a=prior.metadata.grid,b=prior.metadata.bounds;
  if(prior.heights!==heights||prior.solid!==solid||a.segments!==segments||a.step!==step||a.originX!==originX||a.originZ!==originZ||prior.metadata.minimumGrade!==minimumGrade||prior.metadata.sourceID!==sourceID||!['x0','x1','z0','z1'].every(k=>b[k]===bounds?.[k]))throw Error('Dispose the old static terrain surface before rebinding');
  return prior.handle;
 }
 const legacy=barriers.slice(),legacySet=new Set(legacy);
 function validateLegacy(){
  if(landscape.barriers!==barriers||barriers.length!==legacy.length||barriers.some((v,i)=>v!==legacy[i])||legacySet.size!==legacy.length||legacy.some(c=>!c||colliders.filter(v=>v===c).length!==1))throw Error('Unique exact live legacy barrier ownership required');
 }
 validateLegacy();
 const data=buildHollowpeakSteepTerrainData({heights,segments,step,originX,originZ,bounds,minimumGrade});
 let geometry,owner,worldMatrix,disposed=false,replaced=false,originalOrder=null;
 const metadata={profile:HOLLOWPEAK_TERRAIN_COLLISION_PROFILE,sourceID,grid:{segments,step,originX,originZ,diagonal:'u+v<=1'},bounds:{...bounds},minimumGrade,triangles:data.index.length/3,vertices:data.position.length/3,cellsExamined:data.cellsExamined,sourcePlanningBarriers:legacy.length,legacyPhase:'retained-for-source-planning',rendered:false,addsGroundFloor:false,static:true,bodyScope:'Existing caller cylinder/slab approximation; no full-horse or continuous travel certification'};
 try{
  resources(()=>{
   geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(data.position,3));geometry.setIndex(new T.BufferAttribute(data.index,1));
   owner=new T.Object3D();owner.name='Hollowpeak | canonical steep contact';owner.visible=false;owner.userData.hollowpeakTerrainCollision=metadata;worldMatrix=new T.Matrix4();
  });
  parent.add(owner);
  // The copied coordinates are already WORLD coordinates. A parent transform
  // must not be applied again to these canonical vertices.
  const registered=solid.registerSurface(owner,geometry,worldMatrix);
  if(registered!==metadata.triangles)throw Error('Incomplete canonical steep surface registration');
 }catch(error){
  if(owner){solid.unregisterSurface(owner);owner.removeFromParent();}geometry?.dispose();throw error;
 }
 const handle={owner,geometry,metadata,canonicalVertices:data.canonicalVertices,canonicalFaces:data.canonicalFaces,grades:data.grades,sourcePlanningBarriers:Object.freeze(legacy.slice()),
  replaceLegacyBarriers(){
   if(disposed)throw Error('Terrain collision owner is disposed');if(replaced)return 0;
   validateLegacy();originalOrder=colliders.slice();
   for(let i=colliders.length-1;i>=0;i--)if(legacySet.has(colliders[i]))colliders.splice(i,1);
   replaced=true;metadata.legacyPhase='exact-live-references-replaced';return legacy.length;
  },
  dispose(){
   if(disposed)return false;
   // Restore only retired exact owners, keeping all unrelated current references
   // and their order. Newly appended owners are not discarded by a stale copy.
   if(replaced){
    if(legacy.some(c=>colliders.filter(v=>v===c).length>1))throw Error('Ambiguous legacy barrier restoration');
    for(let i=0;i<originalOrder.length;i++){
     const c=originalOrder[i];if(!legacySet.has(c)||colliders.includes(c))continue;
     let at=-1;for(let j=i+1;j<originalOrder.length;j++){at=colliders.indexOf(originalOrder[j]);if(at>=0)break;}
     if(at<0){for(let j=i-1;j>=0;j--){const before=colliders.indexOf(originalOrder[j]);if(before>=0){at=before+1;break;}}}
     colliders.splice(at<0?colliders.length:at,0,c);
    }
   }
   solid.unregisterSurface(owner);owner.removeFromParent();geometry.dispose();installed.delete(landscape);disposed=true;metadata.legacyPhase='disposed-restored';return true;
  },
  get disposed(){return disposed;},get legacyReplaced(){return replaced&&!disposed;},
 };
 installed.set(landscape,{handle,heights,solid,metadata});return handle;
}

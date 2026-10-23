// Optional render view for the one final scanned worldPaths:stone owner.
// Canonical legacy rows remain the course-clear/field-wall authority.
export function createPathStoneRenderView({THREE:T,legacy,enabled=false}){
 if(!enabled)return null;
 const state={status:'retained-original',reason:null,source:legacy,mesh:null,sourceIndices:null,sourceRows:0,renderedRows:0,zeroRows:0,refreshes:0,refresh,dispose};
 let view=null,sourceMatrix=null,sourceColor=null,geometry=null,material=null,layerMask=0,capacity=0,closed=false;
 const hooks=['onBeforeRender','onAfterRender','onBeforeShadow','onAfterShadow'];
 const finiteSphere=s=>s&&Number.isFinite(s.radius)&&s.radius>=0&&Number.isFinite(s.center.x+s.center.y+s.center.z);
 function release(reason,status='retained-original'){
  if(closed)return false;closed=true;
  if(view){view.removeFromParent();view.dispose();}
  if(legacy&&state.status==='applied'&&legacy.layers.mask===0)legacy.layers.mask=layerMask;
  state.status=status;state.reason=reason;state.mesh=null;state.sourceIndices=null;return false;
 }
 function dispose(){return release('disposed','disposed');}
 function refresh(){
  if(closed||!view)return false;
  try{
   if(legacy.geometry!==geometry||legacy.material!==material||legacy.instanceMatrix!==sourceMatrix||legacy.instanceColor!==sourceColor||legacy.count!==capacity||legacy.layers.mask!==0||view.parent!==legacy||legacy.morphTexture||hooks.some(k=>legacy[k]!==T.Object3D.prototype[k]))return release('source changed');
   const a=sourceMatrix.array,c=sourceColor.array,out=view.instanceMatrix.array,colors=view.instanceColor.array;
   if(a.length!==capacity*16||c.length!==capacity*3)return release('source capacity changed');
   let count=0;
   for(let i=0;i<capacity;i++){
    const o=i*16;
    for(let j=0;j<16;j++)if(!Number.isFinite(a[o+j]))return release('nonfinite source row');
    for(let j=0;j<3;j++)if(!Number.isFinite(c[i*3+j]))return release('nonfinite source color');
    if(a[o+3]!==0||a[o+7]!==0||a[o+11]!==0||a[o+15]!==1)return release('nonaffine source row');
    // Omit only an exact point collapse. Singular but nonzero rows stay intact.
    if(a[o]===0&&a[o+1]===0&&a[o+2]===0&&a[o+4]===0&&a[o+5]===0&&a[o+6]===0&&a[o+8]===0&&a[o+9]===0&&a[o+10]===0)continue;
    out.set(a.subarray(o,o+16),count*16);colors.set(c.subarray(i*3,i*3+3),count*3);state.sourceIndices[count++]=i;
   }
   view.count=count;view.visible=count>0;view.instanceMatrix.needsUpdate=true;view.instanceColor.needsUpdate=true;
   // Retain the exact original culling footprint. Current writers only retire
   // rows or restore previously saved original rows; no spatial cutoff is added.
   view.boundingSphere=legacy.boundingSphere;view.boundingBox=legacy.boundingBox;
   state.sourceRows=capacity;state.renderedRows=count;state.zeroRows=capacity-count;state.refreshes++;return true;
  }catch(error){return release(String(error?.message||error));}
 }
 try{
  if(!legacy?.isInstancedMesh||legacy.name!=='worldPaths:stone'||!legacy.parent||legacy.children.length||legacy.morphTexture||!legacy.frustumCulled||!finiteSphere(legacy.boundingSphere)||!Number.isInteger(legacy.count)||legacy.count<=0||hooks.some(k=>legacy[k]!==T.Object3D.prototype[k])){release('unsupported owner');return state;}
  geometry=legacy.geometry;material=legacy.material;sourceMatrix=legacy.instanceMatrix;sourceColor=legacy.instanceColor;capacity=legacy.count;layerMask=legacy.layers.mask;
  if(!geometry?.isBufferGeometry||geometry.attributes.position?.count!==216||geometry.index?.count!==720||!material?.isMeshStandardMaterial||material.name!=='Bridleway | scanned dry stone'||material.customProgramCacheKey()!=='bridleway-stone-v1'||material.transparent||!(sourceMatrix?.array instanceof Float32Array)||sourceMatrix.itemSize!==16||sourceMatrix.count!==capacity||!(sourceColor?.array instanceof Float32Array)||sourceColor.itemSize!==3||sourceColor.count!==capacity||layerMask===0){release('unsupported final scan or attributes');return state;}
  view=new T.InstancedMesh(geometry,material,capacity);
  // The existing gatherInstances excludes names containing course. Only the
  // unchanged canonical parent can identify/clear a physical stone owner.
  view.name='worldPaths:courseStoneRenderView';view.layers.mask=layerMask;view.renderOrder=legacy.renderOrder;
  view.castShadow=legacy.castShadow;view.receiveShadow=legacy.receiveShadow;view.frustumCulled=legacy.frustumCulled;
  view.customDepthMaterial=legacy.customDepthMaterial;view.customDistanceMaterial=legacy.customDistanceMaterial;
  view.instanceColor=new T.InstancedBufferAttribute(new Float32Array(capacity*3),3);
  view.updateMatrix();view.matrixAutoUpdate=false;
  state.sourceIndices=new Uint32Array(capacity);state.mesh=view;
  // An empty layer mask on the carrier suppresses its own color AND shadow draw while
  // Three still visits child layers. Its visible/count/rows remain unchanged.
  legacy.add(view);legacy.layers.mask=0;state.status='applied';
  if(!refresh())return state;
  return state;
 }catch(error){release(String(error?.message||error));return state;}
}

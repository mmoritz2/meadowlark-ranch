// Optional point-row-only view of the one streamed middle pasture bank.
// Canonical rows remain the placement and course-clear authority.
export function createMiddlePastureRenderView({THREE:T,legacy,geometries,enabled=false}={}){
 if(!enabled)return null;
 const state={status:'retained-original',reason:null,source:legacy,mesh:null,sourceIndices:null,sourceRows:0,renderedRows:0,zeroRows:0,refreshes:0,refresh,dispose};
 let view=null,sourceMatrix=null,sourceColor=null,material=null,layerMask=0,capacity=0,closed=false;
 const hooks=['onBeforeRender','onAfterRender','onBeforeShadow','onAfterShadow'];
 const allowed=new Set(Object.values(geometries||{}));
 const ownedGeometry=g=>allowed.has(g)&&g?.isBufferGeometry&&[36,54,72].includes(g.index?.count)&&g.attributes.position?.itemSize===3;
 function release(reason,status='retained-original'){
  if(closed)return false;closed=true;
  legacy?.removeEventListener?.('dispose',onSourceDispose);
  if(view){view.removeFromParent();view.dispose();}
  if(legacy&&state.status==='applied'&&legacy.layers.mask===0)legacy.layers.mask=layerMask;
  state.status=status;state.reason=reason;state.mesh=null;state.sourceIndices=null;return false;
 }
 function onSourceDispose(){release('source disposed','disposed');}
 function dispose(){return release('disposed','disposed');}
 function refresh(){
  if(closed||!view)return false;
  try{
   if(!ownedGeometry(legacy.geometry)||legacy.material!==material||legacy.instanceMatrix!==sourceMatrix||legacy.instanceColor!==sourceColor||legacy.count!==capacity||legacy.layers.mask!==0||view.parent!==legacy||legacy.morphTexture||legacy.frustumCulled!==false||legacy.castShadow!==false||legacy.receiveShadow!==true||hooks.some(k=>legacy[k]!==T.Object3D.prototype[k]))return release('source changed');
   const a=sourceMatrix.array,c=sourceColor.array,out=view.instanceMatrix.array,colors=view.instanceColor.array;
   if(a.length!==capacity*16||c.length!==capacity*3)return release('source capacity changed');
   let count=0;
   for(let i=0;i<capacity;i++){
    const o=i*16;
    for(let j=0;j<16;j++)if(!Number.isFinite(a[o+j]))return release('nonfinite source row');
    for(let j=0;j<3;j++)if(!Number.isFinite(c[i*3+j]))return release('nonfinite source color');
    if(a[o+3]!==0||a[o+7]!==0||a[o+11]!==0||a[o+15]!==1)return release('nonaffine source row');
    // Keep every nonpoint row, including singular rows and shader fade bands.
    if(a[o]===0&&a[o+1]===0&&a[o+2]===0&&a[o+4]===0&&a[o+5]===0&&a[o+6]===0&&a[o+8]===0&&a[o+9]===0&&a[o+10]===0)continue;
    out.set(a.subarray(o,o+16),count*16);colors.set(c.subarray(i*3,i*3+3),count*3);state.sourceIndices[count++]=i;
   }
   view.geometry=legacy.geometry;view.renderOrder=legacy.renderOrder;
   view.customDepthMaterial=legacy.customDepthMaterial;view.customDistanceMaterial=legacy.customDistanceMaterial;
   view.count=count;view.visible=count>0;view.instanceMatrix.needsUpdate=true;view.instanceColor.needsUpdate=true;
   state.sourceRows=capacity;state.renderedRows=count;state.zeroRows=capacity-count;state.refreshes++;return true;
  }catch(error){return release(String(error?.message||error));}
 }
 try{
  if(!legacy?.isInstancedMesh||legacy.name!=='Middle distance pasture'||!legacy.parent||legacy.children.length||legacy.morphTexture||legacy.frustumCulled!==false||legacy.castShadow!==false||legacy.receiveShadow!==true||!Number.isInteger(legacy.count)||legacy.count<=0||hooks.some(k=>legacy[k]!==T.Object3D.prototype[k])){release('unsupported owner');return state;}
  material=legacy.material;sourceMatrix=legacy.instanceMatrix;sourceColor=legacy.instanceColor;capacity=legacy.count;layerMask=legacy.layers.mask;
  if(!ownedGeometry(legacy.geometry)||!material?.isMeshStandardMaterial||material.name!=='Middle distance meadow'||!material.customProgramCacheKey().startsWith('middle-meadow-cover-3')||material.transparent||!(sourceMatrix?.array instanceof Float32Array)||sourceMatrix.itemSize!==16||sourceMatrix.count!==capacity||!(sourceColor?.array instanceof Float32Array)||sourceColor.itemSize!==3||sourceColor.count!==capacity||layerMask===0){release('unsupported middle geometry or attributes');return state;}
  // Allocate only after this cell's existing canonical source rows are complete.
  view=new T.InstancedMesh(legacy.geometry,material,capacity);
  view.name='Middle distance pasture | coursePointRenderView';view.userData.middlePastureRenderView=true;view.layers.mask=layerMask;
  view.castShadow=false;view.receiveShadow=true;view.frustumCulled=false;
  view.instanceColor=new T.InstancedBufferAttribute(new Float32Array(capacity*3),3);
  view.updateMatrix();view.matrixAutoUpdate=false;
  state.sourceIndices=new Uint32Array(capacity);state.mesh=view;
  legacy.add(view);legacy.addEventListener('dispose',onSourceDispose);legacy.layers.mask=0;state.status='applied';
  refresh();return state;
 }catch(error){release(String(error?.message||error));return state;}
}

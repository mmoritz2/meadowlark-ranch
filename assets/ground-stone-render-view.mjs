// Optional point-row-only submission for the final scanned travelling stones.
// The original bank retains every placement ID and course-clear row.
export function createGroundStoneRenderView({THREE:T,legacy,enabled=false,ready=null}={}){
 if(!enabled)return null;
 const state={status:'waiting',reason:null,source:legacy,mesh:null,sourceIndices:null,sourceRows:0,renderedRows:0,zeroRows:0,refreshes:0,refresh,dispose,ready:null};
 const hooks=['onBeforeRender','onAfterRender','onBeforeShadow','onAfterShadow'];
 let view=null,geometry=null,material=null,sourceMatrix=null,sourceColor=null,layerMask=0,capacity=0,flags=null,closed=false;
 const defaults=o=>hooks.every(k=>o[k]===T.Object3D.prototype[k]);
 function release(reason,status='retained-original'){
  if(closed)return false;closed=true;
  legacy?.removeEventListener?.('dispose',onSourceDispose);legacy?.removeEventListener?.('removed',onSourceRemoved);
  if(view){view.removeFromParent();view.dispose();}
  if(legacy&&state.status==='applied'&&legacy.layers.mask===0)legacy.layers.mask=layerMask;
  state.status=status;state.reason=reason;state.mesh=null;state.sourceIndices=null;return false;
 }
 function onSourceDispose(){release('source disposed','disposed');}
 function onSourceRemoved(){release('source removed','disposed');}
 function dispose(){return release('disposed','disposed');}
 function refresh(){
  if(closed||!view)return false;
  try{
   if(legacy.geometry!==geometry||legacy.material!==material||legacy.instanceMatrix!==sourceMatrix||legacy.instanceColor!==sourceColor||legacy.count!==capacity||legacy.layers.mask!==0||view.parent!==legacy||legacy.morphTexture||!defaults(legacy)||legacy.castShadow!==flags.castShadow||legacy.receiveShadow!==flags.receiveShadow||legacy.frustumCulled!==flags.frustumCulled||legacy.customDepthMaterial!==flags.customDepthMaterial||legacy.customDistanceMaterial!==flags.customDistanceMaterial)return release('source changed');
   const a=sourceMatrix.array,c=sourceColor.array,out=view.instanceMatrix.array,colors=view.instanceColor.array;
   if(a.length!==capacity*16||c.length!==capacity*3)return release('source capacity changed');
   let count=0;
   for(let i=0;i<capacity;i++){
    const o=i*16;
    for(let j=0;j<16;j++)if(!Number.isFinite(a[o+j]))return release('nonfinite source row');
    for(let j=0;j<3;j++)if(!Number.isFinite(c[i*3+j]))return release('nonfinite source color');
    if(a[o+3]!==0||a[o+7]!==0||a[o+11]!==0||a[o+15]!==1)return release('nonaffine source row');
    // Only a point has no submitted surface. Keep every other singular row.
    if(a[o]===0&&a[o+1]===0&&a[o+2]===0&&a[o+4]===0&&a[o+5]===0&&a[o+6]===0&&a[o+8]===0&&a[o+9]===0&&a[o+10]===0)continue;
    out.set(a.subarray(o,o+16),count*16);colors.set(c.subarray(i*3,i*3+3),count*3);state.sourceIndices[count++]=i;
   }
   view.renderOrder=legacy.renderOrder;view.count=count;view.visible=count>0;
   view.instanceMatrix.needsUpdate=true;view.instanceColor.needsUpdate=true;
   state.sourceRows=capacity;state.renderedRows=count;state.zeroRows=capacity-count;state.refreshes++;return true;
  }catch(error){return release(String(error?.message||error));}
 }
 function install(){
  if(closed)return state;
  try{
   if(!legacy?.isInstancedMesh||legacy.name!=='Scanned ground stones'||!legacy.parent||legacy.children.length||legacy.morphTexture||legacy.frustumCulled!==false||legacy.receiveShadow!==true||![392,588].includes(legacy.count)||!defaults(legacy)){release('unsupported owner');return state;}
   geometry=legacy.geometry;material=legacy.material;sourceMatrix=legacy.instanceMatrix;sourceColor=legacy.instanceColor;capacity=legacy.count;layerMask=legacy.layers.mask;
   if(!geometry?.isBufferGeometry||geometry.index?.count!==720||geometry.attributes.position?.itemSize!==3||Object.keys(geometry.morphAttributes).length||!material?.isMeshStandardMaterial||material.name!=='Ground cover | scanned moss stone'||!['ground-stone-scan-v1','ground-stone-scan-v1|estate-hardscape-mask-1','ground-stone-scan-v1|estate-hardscape-mask-1|pasture-shelter-floor-1'].includes(material.customProgramCacheKey())||material.transparent||!(sourceMatrix?.array instanceof Float32Array)||sourceMatrix.itemSize!==16||sourceMatrix.count!==capacity||!(sourceColor?.array instanceof Float32Array)||sourceColor.itemSize!==3||sourceColor.count!==capacity||layerMask===0){release('unsupported final stone geometry or attributes');return state;}
   flags={castShadow:legacy.castShadow,receiveShadow:legacy.receiveShadow,frustumCulled:legacy.frustumCulled,customDepthMaterial:legacy.customDepthMaterial,customDistanceMaterial:legacy.customDistanceMaterial};
   view=new T.InstancedMesh(geometry,material,capacity);view.name='Scanned ground stones | coursePointRenderView';view.userData.groundStoneRenderView=true;view.layers.mask=layerMask;
   Object.assign(view,flags);view.renderOrder=legacy.renderOrder;
   view.instanceColor=new T.InstancedBufferAttribute(new Float32Array(capacity*3),3);
   view.updateMatrix();view.matrixAutoUpdate=false;
   state.mesh=view;state.sourceIndices=new Uint32Array(capacity);
   legacy.add(view);legacy.addEventListener('dispose',onSourceDispose);legacy.addEventListener('removed',onSourceRemoved);legacy.layers.mask=0;state.status='applied';refresh();return state;
  }catch(error){release(String(error?.message||error));return state;}
 }
 state.ready=ready?Promise.resolve(ready).then(install,error=>{release(String(error?.message||error));return state;}):Promise.resolve(install());
 return state;
}

export function installGroundStoneRenderView(G){
 const W=G.world,near=W?.nearGroundCover;
 if(!near||W.compactGroundStoneRendering!==true)return null;
 // Capture existing owners after synchronous installation; no startup dependency is added.
 const ready=Promise.resolve().then(()=>Promise.allSettled([G.photoscans?.ready,W.daylightSkyReady,G.courseClear?.ready]));
 return near.groundStoneRenderView=createGroundStoneRenderView({THREE:G.THREE,legacy:near.rock,enabled:true,ready});
}

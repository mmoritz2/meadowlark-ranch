import {withCommonsStandardResources} from './commons-standard-trees.mjs?v=commons-standard-trees-1';

// Optional render views of the source-captured private distant-card owners.
// Canonical rows, visibility, LOD histories and physical tree owners stay intact.
export function createTreeCardRenderBatch({THREE:T,parent,entries,enabled=false}={}){
 let closed=false;
 const state={status:enabled?'waiting':'disabled',reason:null,sources:[],batches:[],refresh,dispose};
 if(!enabled)return state;
 const identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],noPick=()=>{};
 const stock={};for(const k of ['onBeforeRender','onAfterRender','onBeforeShadow','onAfterShadow','updateMatrix','updateMatrixWorld','updateWorldMatrix'])stock[k]=T.Object3D.prototype[k];stock.raycast=T.InstancedMesh.prototype.raycast;
 const same=(a,b)=>{if(a.length!==b.length)return false;for(let i=0;i<a.length;i++)if(a[i]!==b[i])return false;return true;};
 const defaults=o=>o.onBeforeRender===stock.onBeforeRender&&o.onAfterRender===stock.onAfterRender&&o.onBeforeShadow===stock.onBeforeShadow&&o.onAfterShadow===stock.onAfterShadow&&o.updateMatrix===stock.updateMatrix&&o.updateMatrixWorld===stock.updateMatrixWorld&&o.updateWorldMatrix===stock.updateWorldMatrix;
 const frame=o=>o&&defaults(o)&&o.matrixWorldAutoUpdate===true&&o.position.x===0&&o.position.y===0&&o.position.z===0&&o.quaternion.x===0&&o.quaternion.y===0&&o.quaternion.z===0&&o.quaternion.w===1&&o.scale.x===1&&o.scale.y===1&&o.scale.z===1&&same(o.matrix.elements,identity)&&same(o.matrixWorld.elements,identity);
 const materialKeys=['version','onBeforeCompile','customProgramCacheKey','map','alphaMap','displacementMap','clippingPlanes','transparent','opacity','alphaTest','alphaToCoverage','side','depthWrite','depthTest','blending','blendEquation','blendSrc','blendDst','blendEquationAlpha','blendSrcAlpha','blendDstAlpha','premultipliedAlpha','wireframe','flatShading','vertexColors','visible'];
 const materialSnapshot=m=>materialKeys.map(k=>m[k]);
 const materialSame=(m,p)=>materialKeys.every((k,i)=>m[k]===p[i]);
 function supportedMaterial(m,d){
  return m?.isMeshStandardMaterial&&m.map&&m.alphaTest===.22&&m.side===T.DoubleSide&&!m.transparent&&m.opacity===1&&m.depthWrite&&m.depthTest&&m.alphaToCoverage&&m.blending===T.CustomBlending&&m.blendSrc===T.OneFactor&&m.blendDst===T.ZeroFactor&&m.blendSrcAlpha===T.ZeroFactor&&m.blendDstAlpha===T.OneFactor&&!m.displacementMap&&!m.clippingPlanes&&!m.wireframe&&m.onBeforeCompile!==T.Material.prototype.onBeforeCompile&&/^scan-tree-canopy-lighting-v7-(true|false)-living-day-leaf-1-(true|false)$/.test(m.customProgramCacheKey())&&d===m.userData.scanDepth&&d?.isMeshDepthMaterial&&d.map===m.map&&d.alphaTest===.22&&d.side===T.DoubleSide&&d.customProgramCacheKey()==='scan-tree-normal-depth-v2';
 }
 function captureGeometry(g){
  const p=g?.attributes?.position,n=g?.attributes?.normal,u=g?.attributes?.uv;
  if(!g?.isBufferGeometry||g.type!=='PlaneGeometry'||Object.keys(g.attributes).sort().join('|')!=='normal|position|uv'||Object.keys(g.morphAttributes).length||g.groups.length||g.drawRange.start!==0||g.drawRange.count!==Infinity||g.index?.count!==6||![p,n,u].every(a=>a&&!a.isInterleavedBufferAttribute&&a.array instanceof Float32Array&&a.count===4)||p.itemSize!==3||n.itemSize!==3||u.itemSize!==2)throw Error('Unsupported photographed card geometry');
  let radius=0;
  for(let i=0;i<4;i++){
   const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
   if(![x,y,z].every(Number.isFinite)||z!==0||n.getX(i)!==0||n.getY(i)!==0||n.getZ(i)!==1)throw Error('Unsupported photographed card shape');
   radius=Math.max(radius,Math.hypot(x,y));
  }
  if(!(radius>0))throw Error('Empty photographed card shape');
  return {geometry:g,index:g.index,indexArray:g.index.array,indexVersion:g.index.version,attrs:Object.entries(g.attributes).map(([k,a])=>[k,a,a.array,a.version]),radius};
 }
 function geometrySame(p){
  const g=p.geometry;
  return g.index===p.index&&g.index.array===p.indexArray&&g.index.version===p.indexVersion&&g.drawRange.start===0&&g.drawRange.count===Infinity&&!g.groups.length&&Object.keys(g.attributes).length===p.attrs.length&&!Object.keys(g.morphAttributes).length&&p.attrs.every(([k,a,array,v])=>g.attributes[k]===a&&a.array===array&&a.version===v);
 }
 function release(reason,status='retained-original'){
  if(closed)return state;closed=true;
  parent?.removeEventListener('removed',onRemoved);
  for(const o of state.sources){o.mesh.removeEventListener('removed',onRemoved);o.mesh.removeEventListener('dispose',onRemoved);if(o.leased&&o.mesh.layers===o.layers&&o.layers.mask===0)o.layers.mask=o.layerMask;}
  for(const b of state.batches){b.mesh?.removeFromParent();b.mesh?.dispose();}
  state.status=status;state.reason=String(reason?.message||reason);return state;
 }
 function onRemoved(){release('Captured card owner removed or disposed');}
 function dispose(){return release('disposed','disposed');}
 function ownerValid(o){
  const m=o.mesh;
  return m.parent===parent&&!m.children.length&&m.isInstancedMesh&&frame(m)&&m.matrixAutoUpdate===o.matrixAutoUpdate&&m.raycast===stock.raycast&&m.geometry===o.card.geo&&m.geometry===o.geometry&&m.material===o.card.mat&&m.material===o.material&&m.customDepthMaterial===o.depth&&m.customDistanceMaterial===o.distance&&m.layers===o.layers&&m.layers.mask===(o.leased?0:o.layerMask)&&m.receiveShadow===o.receiveShadow&&m.renderOrder===o.renderOrder&&m.frustumCulled===o.frustumCulled&&typeof m.castShadow==='boolean'&&typeof m.visible==='boolean'&&!m.morphTexture&&m.instanceMatrix===o.matrix&&m.instanceColor===o.color&&o.matrix.array===o.matrixArray&&o.color.array===o.colorArray&&o.matrix.count===o.capacity&&o.color.count===o.capacity&&Number.isInteger(m.count)&&m.count>=0&&m.count<=o.capacity;
 }
 function viewValid(b){
  const m=b.mesh,v=b.viewState;
  return m?.parent===parent&&!m.children.length&&frame(m)&&m.matrixAutoUpdate===false&&m.raycast===noPick&&m.geometry===b.geometry&&m.material===b.material&&m.customDepthMaterial===b.depth&&m.customDistanceMaterial===b.distance&&m.layers===b.layers&&m.layers.mask===b.layerMask&&m.receiveShadow===b.receiveShadow&&m.renderOrder===b.renderOrder&&m.frustumCulled===b.frustumCulled&&m.instanceMatrix===b.matrix&&m.instanceColor===b.color&&b.matrix.array===b.matrixArray&&b.color.array===b.colorArray&&v&&m.count===v.count&&m.visible===v.visible&&m.castShadow===v.castShadow&&m.boundingSphere===v.bound&&v.bound.center.x===v.x&&v.bound.center.y===v.y&&v.bound.center.z===v.z&&v.bound.radius===v.radius&&b.matrix.version===v.matrixVersion&&b.color.version===v.colorVersion;
 }
 function fill(b){
  const out=b.matrixArray,rgb=b.colorArray,sphere=new T.Sphere();let bound=null,count=0;
  for(let owner=0;owner<b.sources.length;owner++){
   const o=b.sources[owner],m=o.mesh,a=o.matrixArray,c=o.colorArray;
   if(m.visible)for(let row=0;row<m.count;row++){
    const at=row*16,co=row*3;
    for(let k=0;k<16;k++)if(!Number.isFinite(a[at+k]))throw Error('Nonfinite photographed card row');
    for(let k=0;k<3;k++)if(!Number.isFinite(c[co+k]))throw Error('Nonfinite photographed card color');
    if(a[at+3]!==0||a[at+7]!==0||a[at+11]!==0||a[at+15]!==1)throw Error('Nonaffine photographed card row');
    out.set(a.subarray(at,at+16),count*16);rgb.set(c.subarray(co,co+3),count*3);count++;
    // The shader rotates each plane vertex about local Y, without wind/time
    // displacement. Origin radius encloses every rotation; Frobenius bounds
    // every finite affine instance linear map, including Float32 shear.
    sphere.center.set(a[at+12],a[at+13],a[at+14]);
    sphere.radius=b.shape.radius*Math.hypot(a[at],a[at+1],a[at+2],a[at+4],a[at+5],a[at+6],a[at+8],a[at+9],a[at+10])*(1+1e-6)+.001;
    if(bound)bound.union(sphere);else bound=sphere.clone();
   }
   o.last=[m.count,m.visible,m.castShadow,o.matrix.version,o.color.version];
  }
  b.mesh.count=count;b.mesh.visible=count>0;b.mesh.castShadow=b.sources[0].mesh.castShadow;b.mesh.boundingSphere=bound||new T.Sphere(new T.Vector3(),0);b.matrix.needsUpdate=true;b.color.needsUpdate=true;
  const boundState=b.mesh.boundingSphere;b.viewState={count,visible:b.mesh.visible,castShadow:b.mesh.castShadow,bound:boundState,x:boundState.center.x,y:boundState.center.y,z:boundState.center.z,radius:boundState.radius,matrixVersion:b.matrix.version,colorVersion:b.color.version};
 }
 function refresh(){
  if(closed||state.status!=='applied')return false;
  try{
   if(parent.parent!==scene||scene.parent||!frame(parent)||!frame(scene)||parent.matrixAutoUpdate!==parentAuto||scene.matrixAutoUpdate!==sceneAuto)throw Error('Photographed card identity frame changed');
   for(const o of state.sources)if(!ownerValid(o))throw Error('Captured photographed card owner changed');
   for(const b of state.batches){
    if(!viewValid(b)||!geometrySame(b.shape)||!materialSame(b.material,b.materialState)||!materialSame(b.depth,b.depthState))throw Error('Photographed card render resource or flags changed');
    if(b.sources.some(o=>o.mesh.castShadow!==b.sources[0].mesh.castShadow))throw Error('Photographed card shadow flags diverged');
    if(b.sources.some(o=>!o.last||o.last[0]!==o.mesh.count||o.last[1]!==o.mesh.visible||o.last[2]!==o.mesh.castShadow||o.last[3]!==o.matrix.version||o.last[4]!==o.color.version))fill(b);
   }
   return true;
  }catch(error){release(error);return false;}
 }
 let scene,parentAuto,sceneAuto;
 try{
  scene=parent?.parent;parentAuto=parent?.matrixAutoUpdate;sceneAuto=scene?.matrixAutoUpdate;
  if(!scene?.isScene||scene.parent||!frame(parent)||!frame(scene)||!Array.isArray(entries)||!entries.length||new Set(entries.map(e=>e.mesh)).size!==entries.length)throw Error('Unsupported captured photographed card set');
  for(const entry of entries){
   const m=entry.mesh,card=entry.card;
   if(!m?.isInstancedMesh||!card||m.geometry!==card.geo||m.material!==card.mat||m.parent!==parent||!frame(m)||m.children.length||m.morphTexture||m.layers.mask===0||m.raycast!==stock.raycast||!supportedMaterial(m.material,m.customDepthMaterial)||m.customDistanceMaterial!==undefined||!(m.instanceMatrix?.array instanceof Float32Array)||m.instanceMatrix.itemSize!==16||m.instanceMatrix.isInterleavedBufferAttribute||!(m.instanceColor?.array instanceof Float32Array)||m.instanceColor.itemSize!==3||m.instanceColor.isInterleavedBufferAttribute||m.instanceMatrix.count!==m.instanceColor.count)throw Error('Unsupported captured photographed card owner');
   const o={mesh:m,card,geometry:m.geometry,material:m.material,depth:m.customDepthMaterial,distance:m.customDistanceMaterial,layers:m.layers,layerMask:m.layers.mask,receiveShadow:m.receiveShadow,renderOrder:m.renderOrder,frustumCulled:m.frustumCulled,matrixAutoUpdate:m.matrixAutoUpdate,matrix:m.instanceMatrix,color:m.instanceColor,matrixArray:m.instanceMatrix.array,colorArray:m.instanceColor.array,capacity:m.instanceMatrix.count,leased:false,last:null};state.sources.push(o);
   if(!ownerValid(o))throw Error('Invalid captured photographed card rows');
   let b=state.batches.find(b=>b.geometry===o.geometry&&b.material===o.material&&b.depth===o.depth&&b.distance===o.distance&&b.layerMask===o.layerMask&&b.receiveShadow===o.receiveShadow&&b.renderOrder===o.renderOrder&&b.frustumCulled===o.frustumCulled&&b.castShadow===m.castShadow);
   if(!b){b={geometry:o.geometry,material:o.material,depth:o.depth,distance:o.distance,layerMask:o.layerMask,receiveShadow:o.receiveShadow,renderOrder:o.renderOrder,frustumCulled:o.frustumCulled,castShadow:m.castShadow,shape:captureGeometry(o.geometry),materialState:materialSnapshot(o.material),depthState:materialSnapshot(o.depth),sources:[],capacity:0,mesh:null};state.batches.push(b);}
   b.sources.push(o);b.capacity+=o.capacity;
  }
  // Only added draw resources use the existing guarded synchronous UUID scope.
  // No ambient random call, original resource reorder, texture or material clone.
  withCommonsStandardResources('tree-card-render-batches-1',()=>{
   for(let i=0;i<state.batches.length;i++){
    const b=state.batches[i],m=b.mesh=new T.InstancedMesh(b.geometry,b.material,b.capacity);
    m.name='Scanned distant tree views | courseCardBatch | '+i;m.userData.treeCardRenderBatch=true;m.raycast=noPick;m.layers.mask=b.layerMask;m.castShadow=b.castShadow;m.receiveShadow=b.receiveShadow;m.renderOrder=b.renderOrder;m.frustumCulled=b.frustumCulled;m.customDepthMaterial=b.depth;m.customDistanceMaterial=b.distance;
    m.instanceColor=new T.InstancedBufferAttribute(new Float32Array(b.capacity*3),3);m.updateMatrix();m.matrixAutoUpdate=false;
    b.layers=m.layers;b.matrix=m.instanceMatrix;b.color=m.instanceColor;b.matrixArray=b.matrix.array;b.colorArray=b.color.array;fill(b);
   }
  });
  // Synchronous publication after all cohorts have prepared successfully.
  for(const b of state.batches)parent.add(b.mesh);
  for(const o of state.sources){o.mesh.layers.mask=0;o.leased=true;o.mesh.addEventListener('removed',onRemoved);o.mesh.addEventListener('dispose',onRemoved);}
  parent.addEventListener('removed',onRemoved);state.status='applied';refresh();
 }catch(error){release(error);}
 return state;
}

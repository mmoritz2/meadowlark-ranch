// Partition immutable scenery instances without altering their geometry or
// transforms. Three performs ordinary camera AND shadow-frustum culling using
// each cell's complete geometry bounds; no distance cutoff removes visible art.
// Call only after all source matrices/colors have been assigned. The caller
// retains ownership of geometry/materials and may dispose the source instance
// buffers once it has replaced that source with the returned meshes.
export function partitionStaticInstances(THREE,source,{cellSize=48}={}) {
 if(!source?.isInstancedMesh)throw new TypeError('Expected a static InstancedMesh');
 if(!Number.isFinite(cellSize)||cellSize<=0)throw new RangeError('cellSize must be positive and finite');
 if(source.morphTexture)throw new TypeError('Morphing instances cannot use static scenery cells');
 const bins=new Map(),matrix=new THREE.Matrix4(),color=new THREE.Color();
 for(let i=0;i<source.count;i++){
  source.getMatrixAt(i,matrix);
  const x=matrix.elements[12],z=matrix.elements[14];
  if(!Number.isFinite(x)||!Number.isFinite(z))throw new RangeError('Scenery placement must be finite');
  const key=Math.floor(x/cellSize)+','+Math.floor(z/cellSize);
  if(!bins.has(key))bins.set(key,[]);bins.get(key).push(i);
 }
 return [...bins].map(([key,indices])=>{
  const cell=new THREE.InstancedMesh(source.geometry,source.material,indices.length);
  cell.name=source.name;cell.position.copy(source.position);cell.quaternion.copy(source.quaternion);cell.scale.copy(source.scale);
  cell.matrix.copy(source.matrix);cell.matrixAutoUpdate=source.matrixAutoUpdate;
  cell.layers.mask=source.layers.mask;cell.renderOrder=source.renderOrder;
  cell.visible=source.visible;cell.castShadow=source.castShadow;cell.receiveShadow=source.receiveShadow;
  cell.customDepthMaterial=source.customDepthMaterial;cell.customDistanceMaterial=source.customDistanceMaterial;
  cell.onBeforeRender=source.onBeforeRender;cell.onAfterRender=source.onAfterRender;
  cell.frustumCulled=true;
  cell.userData={...source.userData,sceneryCell:{key,sourceIndices:indices}};
  indices.forEach((original,i)=>{
   source.getMatrixAt(original,matrix);cell.setMatrixAt(i,matrix);
   if(source.instanceColor){source.getColorAt(original,color);cell.setColorAt(i,color);}
  });
  cell.instanceMatrix.needsUpdate=true;
  if(cell.instanceColor)cell.instanceColor.needsUpdate=true;
  // Bounds include every transformed vertex, including canopies that cross a
  // cell border. Never use the grid square itself as a culling volume.
  cell.computeBoundingBox();cell.computeBoundingSphere();
  return cell;
 });
}

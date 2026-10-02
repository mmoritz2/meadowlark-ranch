/* Breed bodies share the approved horse's skeleton and clips. Shape overrides
 * change mesh positions/normals only; each prepared breed owns its geometry. */
export function nativeRosterProfiles(catalog, variants, source) {
 const profiles={};
 for(const [key,entry] of Object.entries(catalog.breeds)){
  const foundation=entry.foundation||entry.file.replace(/\.glb$/,'');
  const variant=(variants.breeds||variants.variants)?.[foundation];
  if(!variant)throw Error('Realistic horse shape missing: '+foundation);
  profiles[key]={...entry,...source,id:key,name:entry.name,label:entry.label||entry.name,
   family:entry.family,foundation,coat:entry.coat,conformation:entry.conformation,
   morphology:entry.morphology,nativeRoster:true,referenceMotion:false,artistBreed:false,
   withersM:variant.withersM,fitScale:variant.actorScale,fitY:0,nativeScale:1,
   nativeVariant:variant,nativeSourceSeat:variant.sourceSeat||source.nativeSourceSeat,
   nativeTranslation:source.nativeTranslation,
   nativeNeutralCoatFile:'./models/native-roster/neutralcoat.png',
   description:'Realistic breed variant with moving mane and tail, walk, trot, canter, collected gallop and jump.',
   sourceBasis:'Breed shape and coat derived from the approved WildMesh 3D horse; original full skeleton and approved movement retained.'};
 }
 return profiles;
}

export function applyNativeRosterShape({THREE,gltf,spec,binary,coat}){
 const meshes=[];gltf.scene.traverse(o=>{if(o.isSkinnedMesh)meshes.push(o);});
 const variant=spec.nativeVariant;
 for(const record of variant.meshes){
  const mesh=meshes.find(o=>o.name===record.name)||meshes[record.meshIndex];
  if(!mesh||mesh.geometry.attributes.position.count!==record.vertexCount)throw Error('Realistic shape topology mismatch: '+spec.id);
  const geometry=mesh.geometry.clone();geometry.userData=JSON.parse(JSON.stringify(mesh.geometry.userData||{}));
  for(const [attribute,field] of [['position','positionDelta'],['normal','normalDelta']]){
   const info=record[field],delta=new Int16Array(binary,info.byteOffset,info.count);
   const values=new Float32Array(mesh.geometry.attributes[attribute].array);
   for(let i=0;i<values.length;i++)values[i]+=delta[i]*info.scale;
   geometry.setAttribute(attribute,new THREE.BufferAttribute(values,3));
  }
  geometry.computeBoundingBox();geometry.computeBoundingSphere();mesh.geometry=geometry;
  geometry.normalizeNormals();
  // Prepared assets have private materials; later instances clone them again.
  mesh.material=Array.isArray(mesh.material)?mesh.material.map(m=>m.clone()):mesh.material.clone();
  if(record.vertexCount===spec.bodyVertexCount){
   mesh.material.map=coat;mesh.material.color.set(0xffffff);mesh.material.needsUpdate=true;
  }
  if(record.vertexCount===spec.hairVertexCount&&variant.coat.hairColorLinear){
   for(const m of Array.isArray(mesh.material)?mesh.material:[mesh.material])m.color.fromArray(variant.coat.hairColorLinear);
  }
 }
 return gltf;
}

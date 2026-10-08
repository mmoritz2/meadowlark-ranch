/* Surface finish for the approved native equines. Run on private actor materials,
 * before fantasy artwork or saved dyes are applied. Source textures, UVs, rig,
 * geometry and original tack materials remain unchanged. */
export const NATIVE_HORSE_MATERIAL_VERSION='native-surface-1';
export const NATIVE_HORSE_MATERIAL_FINISH=Object.freeze({
 body:Object.freeze({roughness:.58,specularIntensity:.70,envMapIntensity:.70,metalness:0}),
 hair:Object.freeze({roughness:.58,specularIntensity:.52,envMapIntensity:.62,metalness:0,alphaCutoff:.45,darkLift:.40}),
 eye:Object.freeze({roughness:.19,specularIntensity:.78,envMapIntensity:.60,metalness:0,color:'#68472b'}),
});
export function nativeHorseMaterialRole(material){
 return material?.name==='M_Body'?'body':material?.name==='M_Hair'?'hair':material?.name==='M_Eye'?'eye':null;
}
export function applyNativeHorseMaterials({THREE,rig,enabled=true}={}){
 if(!enabled||!THREE||!rig?.profile?.nativeBreed||rig.profile.nativeKind!=='horse'||rig.profile.nativeDragon||!rig.scene)return null;
 // The asset cache and every other horse share source maps and geometry, but
 // must never share a mutable material treatment.
 const owned=new Set(rig.materials||[]),seen=new Set(),counts={body:0,hair:0,eye:0};
 rig.scene.traverse(mesh=>{
  if(!mesh.isMesh)return;
  for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material]){
   if(!owned.has(material)||seen.has(material))continue;seen.add(material);
   const role=nativeHorseMaterialRole(material);if(!role||!material.isMeshPhysicalMaterial)continue;
   counts[role]++;if(material.userData.nativeHorseSurfaceVersion===NATIVE_HORSE_MATERIAL_VERSION)continue;
   const finish=NATIVE_HORSE_MATERIAL_FINISH[role];
   material.roughness=finish.roughness;material.specularIntensity=finish.specularIntensity;
   material.envMapIntensity=finish.envMapIntensity;material.metalness=finish.metalness;
   if(role==='hair'){
    // Lift only naturally dark source pigment, without flattening the hair map.
    // Saved mane/tail dyes run later and keep their exact selected colors.
    const luminance=material.color.r*.2126+material.color.g*.7152+material.color.b*.0722;
    material.color.multiplyScalar(1+finish.darkLift*(1-Math.min(1,Math.max(0,luminance)/.25)));
    if(material.alphaTest>0){material.alphaTest=Math.min(material.alphaTest,finish.alphaCutoff);material.alphaToCoverage=true;}
   }else if(role==='eye'){
    // The shared eye atlas is a pale silver iris, not a white sclera. A warm
    // dark tint preserves its radial fibers and horizontal pupil; the small
    // highlight now comes from the light instead of a bright painted ring.
    material.color.set(finish.color);
   }
   // No onBeforeCompile hook: fantasy shaders and saved markings can compose
   // normally, and ordinary clone() copies these PBR properties intact.
   material.userData.nativeHorseSurfaceVersion=NATIVE_HORSE_MATERIAL_VERSION;material.needsUpdate=true;
  }
 });
 const summary={version:NATIVE_HORSE_MATERIAL_VERSION,...counts};rig.nativeMaterialPolish=summary;return summary;
}

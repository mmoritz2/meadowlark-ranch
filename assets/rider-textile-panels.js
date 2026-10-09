// Bind-space fabric panels follow the sewn armhole rather than a vertical x cut.
// All derived attributes are created once on the owned garment geometry.
export function createTextilePanels(THREE, kit) {
 const bones=kit.skin.skeleton.bones, inverse=kit.skin.skeleton.boneInverses;
 const armIds=new Set(bones.flatMap((b,i)=>/^(upperarm|lowerarm|hand)_[lr]$/.test(b.name)?[i]:[]));
 const shoulders=bones.flatMap((b,i)=>/^upperarm_[lr]$/.test(b.name)?[i]:[]);
 if(armIds.size!==6||shoulders.length!==2)throw new Error('Textile panels require the canonical arm joints');
 const shoulderX=shoulders.reduce((sum,i)=>sum+Math.abs(new THREE.Vector3().setFromMatrixPosition(inverse[i].clone().invert()).applyMatrix4(kit.skin.bindMatrixInverse).x),0)/2;
 const patterned=new Set([1,2,5,6,7,11,14,15,16,17,18,19,20,21,22,23]);
 const materials=new WeakSet();
 const legacy=[
  'float sleeveMix=step(uArmTextile.z,abs(vWardrobeBind.x));',
  'vec3 textileBind=vWardrobeBind;',
  'float sleeveAngle=atan(vWardrobeBind.z-uArmTextile.y,vWardrobeBind.y-uArmTextile.x);',
  'textileBind.xy=mix(vWardrobeBind.xy,vec2(sleeveAngle*uArmTextile.w,uZ1.x-max(0.0,abs(vWardrobeBind.x)-uArmTextile.z)),sleeveMix);',
  'diffuseColor.rgb=riderFabric(diffuseColor.rgb,textileBind);'
 ].join('\n');
 function material(material, design) {
  if(!patterned.has(design)||materials.has(material))return;
  materials.add(material);
  const previous=material.onBeforeCompile,key=material.customProgramCacheKey();
  material.onBeforeCompile=shader=>{
   previous(shader);
   if(!shader.fragmentShader.includes(legacy))throw new Error('Textile panel mapping is missing');
   shader.uniforms.uTextileShoulder={value:shoulderX};
   shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute float riderSleevePanel; varying float vSleevePanel;').replace('#include <begin_vertex>','#include <begin_vertex>\nvSleevePanel=riderSleevePanel;');
   shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying float vSleevePanel; uniform float uTextileShoulder;').replace(legacy,`
    float panelAA=max(.0001,fwidth(vSleevePanel));
    float sleeveMix=smoothstep(.5-panelAA,.5+panelAA,vSleevePanel);
    float sleeveAngle=atan(vWardrobeBind.z-uArmTextile.y,vWardrobeBind.y-uArmTextile.x);
    vec3 sleeveTextile=vec3(sleeveAngle*uArmTextile.w,uZ1.x-(abs(vWardrobeBind.x)-uTextileShoulder),vWardrobeBind.z);
    vec3 torsoColor=riderFabric(diffuseColor.rgb,vWardrobeBind);
    vec3 sleeveColor=riderFabric(diffuseColor.rgb,sleeveTextile);
    diffuseColor.rgb=mix(torsoColor,sleeveColor,sleeveMix);
    float seam=1.-smoothstep(panelAA*.8,panelAA*1.8,abs(vSleevePanel-.5));
    diffuseColor.rgb*=1.-.12*seam;
   `);
   material.userData.textilePanels.compiled=true;
  };
  material.customProgramCacheKey=()=>key+'-anatomical-textile-panels6';
  material.userData.textilePanels={version:6,design,shoulderX,compiled:false};
 }
 function geometry(geometry, material) {
  if(!materials.has(material)||geometry.hasAttribute('riderSleevePanel'))return;
  const joints=geometry.attributes.skinIndex,weights=geometry.attributes.skinWeight;
  if(!joints||!weights)throw new Error('Textile panels require garment skin ownership');
  const panel=new Float32Array(joints.count),get=['getX','getY','getZ','getW'];
  for(let i=0;i<joints.count;i++)for(const f of get)if(armIds.has(joints[f](i)))panel[i]+=weights[f](i);
  geometry.setAttribute('riderSleevePanel',new THREE.BufferAttribute(panel,1));
 }
 return {material,geometry,shoulderX};
}

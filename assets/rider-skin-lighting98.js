// A rider-local art response for skin under the existing scene lights.
// Zero incident diffuse remains black; there is no emissive floor or new light.
// The selected skin/eye pigment and physical specular highlights remain inputs.
// This is a deliberate diffuse contrast curve, not a physical SSS simulation.
export function installRiderDiffuseResponse98(material,{kind='skin',strength=1}={}){
 if(material.userData.riderDiffuseResponse98)return;
 const previous=material.onBeforeCompile,previousKey=material.customProgramCacheKey.bind(material);
 material.onBeforeCompile=shader=>{
  previous(shader);
  const token='vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;';
  if(shader.fragmentShader.split(token).length!==2)throw Error('Rider98 diffuse lighting contract changed');
  shader.fragmentShader=shader.fragmentShader.replace(token,token+`
  // Preserve the actual light's direction and fine occlusion while softening
  // deep skin hollows and compressing the bright outdoor diffuse response.
  vec3 rider98Pigment=max(material.diffuseColor,vec3(.0001));
  vec3 rider98Response=totalDiffuse/rider98Pigment;
  float rider98L=max(0.0,dot(rider98Response,vec3(.2126,.7152,.0722)));
  float rider98Mapped=rider98L*(1.0+1.70*exp(-rider98L/.24))/(1.0+.28*rider98L);
  float rider98Chroma=${kind==='skin'?'.75-.28*(1.0-smoothstep(.12,.60,rider98L))':'.90'};
  vec3 rider98Soft=mix(vec3(rider98L),rider98Response,rider98Chroma);
  rider98Soft*=rider98Mapped/max(rider98L,.00001);
  totalDiffuse=mix(totalDiffuse,rider98Pigment*rider98Soft,${Number(strength).toFixed(4)});
  `);
 };
 material.customProgramCacheKey=()=>previousKey()+'-rider-soft-diffuse98-'+kind+'-'+strength;
 material.userData.riderDiffuseResponse98={kind,strength,method:'Selected pigment times compressed scene-lit diffuse response',shadowLift:1.70,shadowFalloff:.24,brightCompression:.28,emissiveFloor:false,specularUnchanged:true};
 material.needsUpdate=true;
}

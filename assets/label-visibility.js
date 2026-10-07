// The CPU label fade can lag behind a fast camera move (and an actor's updated
// matrix). Clip near-camera nameplates using this frame's actual view transform.
// A world-space distance alone cannot catch a wide plate grazing the near plane.
export function guardFloatingLabel(sprite){
 const material=sprite.material;
 if(!material?.isSpriteMaterial||material.userData.cameraSafeLabel)return sprite;
 const wide=sprite.scale.x>=1.6,near=wide?2.6:1.5,far=wide?5.4:3;
 const previous=material.onBeforeCompile,cache=material.customProgramCacheKey();
 material.userData.cameraSafeLabel={near,far};
 material.onBeforeCompile=function(shader,renderer){
  previous.call(this,shader,renderer);
  shader.uniforms.labelNear={value:near};shader.uniforms.labelSafe={value:far};
  shader.vertexShader='varying float labelViewDepth;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <fog_vertex>','#include <fog_vertex>\nlabelViewDepth=-mvPosition.z;');
  shader.fragmentShader='varying float labelViewDepth; uniform float labelNear,labelSafe;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <alphatest_fragment>','if(labelViewDepth<=labelNear)discard; diffuseColor.a*=smoothstep(labelNear,labelSafe,labelViewDepth);\n#include <alphatest_fragment>');
 };
 material.customProgramCacheKey=()=>cache+'|camera-safe-label-1';material.needsUpdate=true;return sprite;
}

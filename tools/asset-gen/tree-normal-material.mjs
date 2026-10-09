// Matched normal atlas: the same sided material normal used by full geometry.
export function createMatchedTreeNormalMaterial(T,old){
 const foliage=/leaves|twig/.test(old.name||'');
 const mat=new T.MeshNormalMaterial({side:T.DoubleSide,normalMap:old.normalMap,normalMapType:old.normalMapType,normalScale:old.normalScale.clone(),bumpMap:old.bumpMap,bumpScale:old.bumpScale});
 if(foliage)mat.normalScale.multiplyScalar(.55);
 if(old.map)old.map.updateMatrix();
 mat.onBeforeCompile=shader=>{
  shader.uniforms.bakeAlbedo={value:old.map};shader.uniforms.bakeCutoff={value:old.alphaTest||0};shader.uniforms.bakeHasMap={value:!!old.map};
  shader.uniforms.bakeAlbedoTransform={value:old.map?old.map.matrix.clone():new T.Matrix3()};
  shader.vertexShader='varying vec2 vBakeAlbedoUv;uniform mat3 bakeAlbedoTransform;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\n vBakeAlbedoUv=(bakeAlbedoTransform*vec3(uv,1.0)).xy;');
  shader.fragmentShader='varying vec2 vBakeAlbedoUv;uniform sampler2D bakeAlbedo;uniform float bakeCutoff;uniform bool bakeHasMap;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_begin>','float bakeAlpha=bakeHasMap?texture2D(bakeAlbedo,vBakeAlbedoUv).a:1.0;\n if(bakeAlpha<bakeCutoff)discard;\n #include <normal_fragment_begin>');
  shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>','#include <normal_fragment_maps>\n '+(foliage?'vec3 canopyUp=normalize(mat3(viewMatrix)*vec3(0.0,1.0,0.0));normal=normalize(mix(normal,canopyUp,.42));':'')+'\n vec3 bakeWorldNormal=normal*mat3(viewMatrix);float bakeNormalLength2=dot(bakeWorldNormal,bakeWorldNormal);bakeWorldNormal=bakeNormalLength2>1e-6?bakeWorldNormal*inversesqrt(bakeNormalLength2):vec3(0.0,1.0,0.0);');
  // Every accepted sample is opaque, as in the albedo bake. MSAA resolves only
  // geometric coverage; leaving raw leaf alpha here corrupts normal RGB during
  // the browser canvas unpremultiply step at partly opaque source pixels.
  shader.fragmentShader=shader.fragmentShader.replace('gl_FragColor = vec4( packNormalToRGB( normal ), opacity );','gl_FragColor = vec4(bakeWorldNormal*.5+.5,1.0);');
 };
 mat.customProgramCacheKey=()=> 'tree-matched-normal-bake-v1-'+foliage;
 return mat;
}
// End matched normal material.

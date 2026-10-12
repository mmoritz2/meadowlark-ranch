// Original exposure model. It reveals the existing ground on snow-bearing
// ledges; it neither authors snow nor changes the climate/water/height fields.
const smooth=(a,b,v)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
export function hollowpeakRockSurface({slope,curvature,relief,wet}) {
  // Curvature is center height minus the mean of neighbors6m away. Convex
  // shoulders scour first; concave shelves retain the underlying ground.
  const scoured=smooth(-.25,.65,curvature),shelter=1-smooth(-.7,.25,curvature);
  const exposure=smooth(.30,.88,slope+.09*scoured-.08*shelter);
  return {
    cover:Math.max(exposure*smooth(.03,.7,relief),wet?.94:0),
    weather:wet?1:shelter*.26+smooth(.8,1.8,slope)*.10,
  };
}

export const HOLLOWPEAK_ROCK_GLSL=/* glsl */`
varying float mountainCover,mountainWeather;
varying vec3 rockWorld,rockNormal;
vec2 hollowRockUV(vec2 p){
  return p/6.8+vec2(sin(p.x*.08+p.y*.045),cos(p.y*.07))*.11;
}
vec3 hollowRockWeights(){vec3 w=pow(abs(normalize(rockNormal)),vec3(6.0));return w/max(dot(w,vec3(1.0)),.00001);}
vec4 hollowRockTri(sampler2D image){
  vec3 w=hollowRockWeights();
  return texture2D(image,hollowRockUV(rockWorld.zy))*w.x+
    texture2D(image,hollowRockUV(rockWorld.xz))*w.y+
    texture2D(image,hollowRockUV(rockWorld.xy))*w.z;
}
vec3 hollowRockProjection(vec2 uv,vec3 mapN,vec3 n,vec2 detailScale){
  // A cotangent frame derived from the actual warped UV Jacobian. A flat
  // normal map returns the geometric normal on every projection, including
  // negative-facing cliffs and almost horizontal ledges.
  vec3 q0=dFdx(rockWorld),q1=dFdy(rockWorld);
  vec2 st0=dFdx(uv),st1=dFdy(uv);
  vec3 q1p=cross(q1,n),q0p=cross(n,q0);
  vec3 tangent=q1p*st0.x+q0p*st1.x,bitangent=q1p*st0.y+q0p*st1.y;
  float frameScale=max(dot(tangent,tangent),dot(bitangent,bitangent));
  float invScale=inversesqrt(max(frameScale,.000000000001));
  mapN.xy*=detailScale;
  return normalize((tangent*mapN.x+bitangent*mapN.y)*invScale+n*max(mapN.z,.08));
}
`;

export function applyHollowpeakRockSurface(material){
  material.onBeforeCompile=sh=>{
    sh.vertexShader='attribute float rockCover; attribute float rockWeather; varying float mountainCover,mountainWeather; varying vec3 rockWorld,rockNormal;\n'+sh.vertexShader;
    sh.vertexShader=sh.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\nmountainCover=rockCover;mountainWeather=rockWeather;rockWorld=(modelMatrix*vec4(position,1.0)).xyz;rockNormal=normalize(mat3(modelMatrix)*normal);');
    sh.fragmentShader=HOLLOWPEAK_ROCK_GLSL+sh.fragmentShader;
    if(material.map){
      sh.fragmentShader=sh.fragmentShader.replace('#include <map_fragment>',`
        vec4 rockColour=hollowRockTri(map);
        // Retain mineral variation while neutralizing the source photograph's
        // strong ochre cast. Value/fracture detail stays photographed.
        float mineralValue=dot(rockColour.rgb,vec3(.2126,.7152,.0722));
        rockColour.rgb=mix(vec3(mineralValue),rockColour.rgb,.42);
        // Broader damp recesses follow measured shelter, not new noise.
        rockColour.rgb*=mix(vec3(1.0),vec3(.82,.87,.91),mountainWeather);
        diffuseColor*=rockColour;`);
      sh.fragmentShader=sh.fragmentShader.replace('#include <roughnessmap_fragment>',`
        vec4 hollowRockARM=hollowRockTri(roughnessMap);
        float roughnessFactor=clamp(roughness*hollowRockARM.g,.72,1.0);`);
      sh.fragmentShader=sh.fragmentShader.replace('#include <normal_fragment_maps>',`
        vec3 rn=normalize(rockNormal),w=hollowRockWeights();
        vec2 uvX=hollowRockUV(rockWorld.zy),uvY=hollowRockUV(rockWorld.xz),uvZ=hollowRockUV(rockWorld.xy);
        vec3 nx=hollowRockProjection(uvX,texture2D(normalMap,uvX).xyz*2.0-1.0,rn,normalScale);
        vec3 ny=hollowRockProjection(uvY,texture2D(normalMap,uvY).xyz*2.0-1.0,rn,normalScale);
        vec3 nz=hollowRockProjection(uvZ,texture2D(normalMap,uvZ).xyz*2.0-1.0,rn,normalScale);
        normal=normalize(mat3(viewMatrix)*normalize(nx*w.x+ny*w.y+nz*w.z));`);
      sh.fragmentShader=sh.fragmentShader.replace('#include <aomap_fragment>',`
        float ambientOcclusion=mix(1.0,hollowRockARM.r,.38);
        reflectedLight.indirectDiffuse*=ambientOcclusion;
        #if defined(USE_ENVMAP) && defined(STANDARD)
          float dotNV=saturate(dot(geometryNormal,geometryViewDir));
          reflectedLight.indirectSpecular*=computeSpecularOcclusion(dotNV,ambientOcclusion,material.roughness);
        #endif`);
    }
    sh.fragmentShader=sh.fragmentShader.replace('#include <alphatest_fragment>',
      'diffuseColor.a*=mountainCover;\n#include <alphatest_fragment>');
  };
  material.customProgramCacheKey=()=> 'hollowpeak-rock-surface-2';
  return material;
}

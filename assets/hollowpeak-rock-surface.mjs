// Original exposure model. It reveals the existing ground on snow-bearing
// ledges; it neither authors snow nor changes the climate/water/height fields.
const smooth=(a,b,v)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
export const HOLLOWPEAK_ROCK_PROFILE='hollowpeak-rock-surface-4';
export function hollowpeakRockSurface({slope,curvature,relief,wet}) {
  // Curvature is center height minus the mean of neighbors 6 m away. Convex
  // shoulders scour first; concave shelves retain the underlying ground.
  const scoured=smooth(-.25,.65,curvature),shelter=1-smooth(-.7,.25,curvature);
  const exposure=smooth(.30,.88,slope+.09*scoured-.08*shelter);
  return {
    cover:Math.max(exposure*smooth(.03,.7,relief),wet?.94:0),
    weather:wet?1:shelter*.26+smooth(.8,1.8,slope)*.10,
    // Dry colluvium belongs to the foot of the actual landform, rather than
    // an arbitrary world-height stripe. Water banks remain exposed marble.
    toe:wet?0:1-smooth(3,11,relief),
    scoured,
  };
}

export const HOLLOWPEAK_ROCK_GLSL=/* glsl */`
varying float mountainCover,mountainWeather;
varying vec2 mountainLandform;
varying vec3 rockWorld,rockNormal;
vec2 hollowRockUV(vec2 p){
  // Poly Haven's photographed marble patch spans 6.8 m. Warping the seams
  // preserves that physical fracture scale; broad weathering is independent.
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
  // The actual warped UV Jacobian aligns the normal on all three projections.
  // A flat map returns the geometric normal even on negative-facing cliffs.
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
    sh.vertexShader='attribute float rockCover; attribute float rockWeather; attribute vec2 rockLandform; varying float mountainCover,mountainWeather; varying vec2 mountainLandform; varying vec3 rockWorld,rockNormal;\n'+sh.vertexShader;
    sh.vertexShader=sh.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\nmountainCover=rockCover;mountainWeather=rockWeather;mountainLandform=rockLandform;rockWorld=(modelMatrix*vec4(position,1.0)).xyz;rockNormal=normalize(mat3(modelMatrix)*normal);');
    sh.fragmentShader=HOLLOWPEAK_ROCK_GLSL+sh.fragmentShader;
    if(material.map){
      sh.fragmentShader=sh.fragmentShader.replace('#include <map_fragment>',`
        vec4 rockColour=hollowRockTri(map);
        float mineralValue=dot(rockColour.rgb,vec3(.2126,.7152,.0722));
        rockColour.rgb=mix(vec3(mineralValue),rockColour.rgb,.32);
        // Keep photographed fractures within the mineral body. Preserve their
        // darker value span so sun-facing stone still separates broad faces.
        rockColour.rgb=rockColour.rgb*.72+vec3(.085);
        float toe=clamp(mountainLandform.x,0.0,1.0);
        float scour=clamp(mountainLandform.y,0.0,1.0);
        float wetRock=smoothstep(.72,.99,mountainWeather);
        float shelter=clamp(mountainWeather/.36,0.0,1.0)*(1.0-wetRock);
        // The exposed mineral bedding follows a broad tilted seam. Unequal
        // face fields interrupt it before it can read as contour-striping.
        float face=.5+.5*sin(rockWorld.x*.053+rockWorld.z*.037+sin(rockWorld.z*.025)*1.6);
        float bedding=.5+.5*sin((rockWorld.y+rockWorld.x*.08+rockWorld.z*.055)*.19+sin(rockWorld.x*.032+rockWorld.z*.025)*.7);
        float mineral=clamp(face*.65+bedding*.35,0.0,1.0);
        rockColour.rgb*=mix(vec3(.93,.97,1.015),vec3(1.065,1.025,.94),mineral);
        rockColour.rgb*=mix(1.0,.91,shelter*(.55+.45*(1.0-face)));
        // Actual low, sheltered feet collect soil and sparse organic staining;
        // scoured shoulders and wet marble keep their own mineral response.
        float deposits=toe*(.28+.52*shelter)*(1.0-.5*scour)*(1.0-wetRock);
        vec3 colluvium=mix(vec3(.30,.275,.21),vec3(.225,.27,.195),shelter);
        rockColour.rgb=mix(rockColour.rgb,colluvium,deposits*.68);
        rockColour.rgb*=mix(vec3(1.0),vec3(.78,.84,.87),wetRock);
        diffuseColor*=rockColour;`);
      sh.fragmentShader=sh.fragmentShader.replace('#include <roughnessmap_fragment>',`
        vec4 hollowRockARM=hollowRockTri(roughnessMap);
        float roughnessFactor=clamp(roughness*hollowRockARM.g,.80-.12*wetRock,1.0);`);
      sh.fragmentShader=sh.fragmentShader.replace('#include <normal_fragment_maps>',`
        vec3 rn=normalize(rockNormal),w=hollowRockWeights();
        vec2 uvX=hollowRockUV(rockWorld.zy),uvY=hollowRockUV(rockWorld.xz),uvZ=hollowRockUV(rockWorld.xy);
        vec2 rockDetail=normalScale*mix(.68,1.0,scour)*(1.0-.18*toe)*(1.0-.20*wetRock);
        vec3 nx=hollowRockProjection(uvX,texture2D(normalMap,uvX).xyz*2.0-1.0,rn,rockDetail);
        vec3 ny=hollowRockProjection(uvY,texture2D(normalMap,uvY).xyz*2.0-1.0,rn,rockDetail);
        vec3 nz=hollowRockProjection(uvZ,texture2D(normalMap,uvZ).xyz*2.0-1.0,rn,rockDetail);
        normal=normalize(mat3(viewMatrix)*normalize(nx*w.x+ny*w.y+nz*w.z));`);
      sh.fragmentShader=sh.fragmentShader.replace('#include <aomap_fragment>',`
        float ambientOcclusion=mix(1.0,hollowRockARM.r,.28);
        reflectedLight.indirectDiffuse*=ambientOcclusion;
        #if defined(USE_ENVMAP) && defined(STANDARD)
          float dotNV=saturate(dot(geometryNormal,geometryViewDir));
          reflectedLight.indirectSpecular*=computeSpecularOcclusion(dotNV,ambientOcclusion,material.roughness);
        #endif`);
    }
    sh.fragmentShader=sh.fragmentShader.replace('#include <alphatest_fragment>',
      'diffuseColor.a*=mountainCover;\n#include <alphatest_fragment>');
  };
  material.customProgramCacheKey=()=>HOLLOWPEAK_ROCK_PROFILE;
  return material;
}

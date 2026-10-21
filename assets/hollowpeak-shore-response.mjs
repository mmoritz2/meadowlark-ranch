// Selected material/coverage response only. Accepted contact positions/index/
// owners stay untouched; no resource, RNG, clock or support owner is created.
export const HOLLOWPEAK_SHORE_RESPONSE_PROFILE='hollowpeak-shore-triplanar-study-1';
export const HOLLOWPEAK_SHORE_HEM_POLICY=Object.freeze({outerWidthM:.45,minimumLiftM:.014,maximumFadeLiftM:.0198,maximumDeclaredLiftM:.020,rockSkinLiftM:.012,alphaTest:.01});
function replaceOnce(source,before,after){if(source.split(before).length!==2)throw Error('Selected Hollowpeak shore shader contract changed');return source.replace(before,after);}
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
export function createHollowpeakShoreWetness(position,{tarn,pool}){
 if(!(position instanceof Float32Array)||position.length%3||![tarn?.x,tarn?.z,tarn?.level,pool?.x,pool?.z,pool?.level].every(Number.isFinite))throw Error('Actual selected shore positions/basins required');
 const wetness=new Float32Array(position.length/3);
 for(let i=0;i<wetness.length;i++){const x=position[i*3],y=position[i*3+1],z=position[i*3+2],basin=Math.hypot(x-tarn.x,z-tarn.z)<Math.hypot(x-pool.x,z-pool.z)?tarn:pool;wetness[i]=1-smooth(0,.28,y-basin.level);}
 return wetness;
}
export function configureHollowpeakShoreResponse(material){
 if(!material?.isMeshStandardMaterial)throw Error('Resident selected wet-bedrock standard clone required');
 // Do not multiply the inherited .51-.59 vertex tint a second time. Its
 // original attribute remains unchanged and may still be read by diagnostics.
 material.vertexColors=false;material.color.set(0xffffff);
 material.transparent=true;material.depthTest=true;material.depthWrite=true;
 material.alphaTest=HOLLOWPEAK_SHORE_HEM_POLICY.alphaTest;
}

// Selected shore only: borrow the established cliff projection algebra and the
// same resident marble's 6.8m scale. No texture/uniform/resource is introduced.
// R of ARM stays unused, G retains roughness multiplication, B remains the
// standard metalness channel only when that standard map is actually enabled.
export const HOLLOWPEAK_SHORE_PROJECTION_GLSL=/* glsl */`varying vec3 shoreWorld,shoreWorldNormal;
vec2 shoreMineralUV(vec2 p){
  // Poly Haven's photographed marble patch spans 6.8 m. Warping the seams
  // preserves that physical fracture scale; broad weathering is independent.
  return p/6.8+vec2(sin(p.x*.08+p.y*.045),cos(p.y*.07))*.11;
}
vec3 shoreMineralWeights(){vec3 w=pow(abs(normalize(shoreWorldNormal)),vec3(6.0));return w/max(dot(w,vec3(1.0)),.00001);}
vec4 shoreMineralTri(sampler2D image){
  vec3 w=shoreMineralWeights();
  return texture2D(image,shoreMineralUV(shoreWorld.zy))*w.x+
    texture2D(image,shoreMineralUV(shoreWorld.xz))*w.y+
    texture2D(image,shoreMineralUV(shoreWorld.xy))*w.z;
}
vec3 shoreMineralProjection(vec2 uv,vec3 mapN,vec3 n,vec2 detailScale){
  // The actual warped UV Jacobian aligns the normal on all three projections.
  // A flat map returns the geometric normal even on negative-facing cliffs.
  vec3 q0=dFdx(shoreWorld),q1=dFdy(shoreWorld);
  vec2 st0=dFdx(uv),st1=dFdy(uv);
  vec3 q1p=cross(q1,n),q0p=cross(n,q0);
  vec3 tangent=q1p*st0.x+q0p*st1.x,bitangent=q1p*st0.y+q0p*st1.y;
  float frameScale=max(dot(tangent,tangent),dot(bitangent,bitangent));
  float invScale=inversesqrt(max(frameScale,.000000000001));
  mapN.xy*=detailScale;
  return normalize((tangent*mapN.x+bitangent*mapN.y)*invScale+n*max(mapN.z,.08));
}
`;
function patchShoreMineralProjection(shader){
 shader.vertexShader='varying vec3 shoreWorld,shoreWorldNormal;\n'+shader.vertexShader;
 shader.vertexShader=replaceOnce(shader.vertexShader,'#include <defaultnormal_vertex>',`#include <defaultnormal_vertex>
 shoreWorldNormal=normalize(transformedNormal*mat3(viewMatrix));`);
 shader.vertexShader=replaceOnce(shader.vertexShader,'#include <project_vertex>',`#include <project_vertex>
 shoreWorld=(modelMatrix*vec4(transformed,1.0)).xyz;`);
 shader.fragmentShader=HOLLOWPEAK_SHORE_PROJECTION_GLSL+shader.fragmentShader;
 shader.fragmentShader=replaceOnce(shader.fragmentShader,'#include <map_fragment>',`#ifdef USE_MAP
	vec4 sampledDiffuseColor = shoreMineralTri(map);
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = vec4( mix( pow( sampledDiffuseColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), sampledDiffuseColor.rgb * 0.0773993808, vec3( lessThanEqual( sampledDiffuseColor.rgb, vec3( 0.04045 ) ) ) ), sampledDiffuseColor.w );
\t
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`);
 shader.fragmentShader=replaceOnce(shader.fragmentShader,'#include <roughnessmap_fragment>',`
 float roughnessFactor=roughness;
 #ifdef USE_ROUGHNESSMAP
  vec4 texelRoughness=shoreMineralTri(roughnessMap);
  roughnessFactor*=texelRoughness.g;
 #endif`);
 shader.fragmentShader=replaceOnce(shader.fragmentShader,'#include <metalnessmap_fragment>',`
 float metalnessFactor=metalness;
 #ifdef USE_METALNESSMAP
  vec4 texelMetalness=shoreMineralTri(metalnessMap);
  metalnessFactor*=texelMetalness.b;
 #endif`);
 shader.fragmentShader=replaceOnce(shader.fragmentShader,'#include <normal_fragment_maps>',`
 #if defined(USE_NORMALMAP_TANGENTSPACE)
  vec3 shoreN=normalize(shoreWorldNormal),shoreW=shoreMineralWeights();
  #ifdef DOUBLE_SIDED
   shoreN*=faceDirection;
  #endif
  vec2 shoreUvX=shoreMineralUV(shoreWorld.zy),shoreUvY=shoreMineralUV(shoreWorld.xz),shoreUvZ=shoreMineralUV(shoreWorld.xy);
  vec3 shoreNx=shoreMineralProjection(shoreUvX,texture2D(normalMap,shoreUvX).xyz*2.0-1.0,shoreN,normalScale);
  vec3 shoreNy=shoreMineralProjection(shoreUvY,texture2D(normalMap,shoreUvY).xyz*2.0-1.0,shoreN,normalScale);
  vec3 shoreNz=shoreMineralProjection(shoreUvZ,texture2D(normalMap,shoreUvZ).xyz*2.0-1.0,shoreN,normalScale);
  normal=normalize(mat3(viewMatrix)*normalize(shoreNx*shoreW.x+shoreNy*shoreW.y+shoreNz*shoreW.z));
 #else
  #include <normal_fragment_maps>
 #endif`);
}

export function patchHollowpeakShoreResponse(shader){
 patchShoreMineralProjection(shader);
 const vary='varying float shoreLiftV,shoreOuterDistanceV,shoreHemEligibleV,shoreWetnessV;\n';
 shader.vertexShader='attribute float shoreCanonicalLift,shoreOuterDistance,shoreHemEligible,shoreWetness;\n'+vary+shader.vertexShader;
 shader.vertexShader=replaceOnce(shader.vertexShader,'#include <begin_vertex>','#include <begin_vertex>\nshoreLiftV=shoreCanonicalLift;shoreOuterDistanceV=shoreOuterDistance;shoreHemEligibleV=shoreHemEligible;shoreWetnessV=shoreWetness;');
 shader.fragmentShader=vary+shader.fragmentShader;
 shader.fragmentShader=replaceOnce(shader.fragmentShader,
  'float shoreGrey=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));diffuseColor.rgb=mix(vec3(shoreGrey),diffuseColor.rgb,.035);diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.10),.25);',
  `float shoreMineralValue=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
   diffuseColor.rgb=mix(vec3(shoreMineralValue),diffuseColor.rgb,.80);
   float shoreWet=clamp(shoreWetnessV,0.0,1.0);
   diffuseColor.rgb*=mix(.96,.78,shoreWet)*vec3(1.015,1.0,.985);`);
 shader.fragmentShader=replaceOnce(shader.fragmentShader,'#include <alphatest_fragment>',
  `// Whole-face eligibility is certified against the actual canonical owner.
   // Uncertain edges/faces stay opaque. No raised bank above20mm may fade.
   float shoreLowHem=(1.0-smoothstep(.014,.0198,shoreLiftV))*step(.999,shoreHemEligibleV);
   float shoreOuterFade=smoothstep(0.0,.45,max(0.0,shoreOuterDistanceV));
   float shoreCoverage=mix(1.0,shoreOuterFade,shoreLowHem);
   diffuseColor.a*=shoreCoverage;
   #include <alphatest_fragment>`);
}

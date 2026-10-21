// Selected material/coverage response only. Accepted contact positions/index/
// owners stay untouched; no resource, RNG, clock or support owner is created.
export const HOLLOWPEAK_SHORE_RESPONSE_PROFILE='hollowpeak-shore-mineral-hem-1';
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
export function patchHollowpeakShoreResponse(shader){
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

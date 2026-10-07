// Original snow accumulation for existing needle surfaces. No geometry, alpha,
// depth, texture, resource, placement, RNG or camera-state changes are made here.
export const SAPLING_SNOW=Object.freeze({
 version:'sapling-snow-v1',
 supportLow:.02,supportHigh:.60,heightLow:.20,heightHigh:.90,heightFloor:.72,
 fieldBase:.50,fieldAmplitudeA:.22,fieldAmplitudeB:.14,
 fieldFrequencyA:Object.freeze([5.1,2.2,3.7]),fieldFrequencyB:Object.freeze([-2.9,-3.6,6.3]),
 patchLow:.30,patchHigh:.66,patchFloor:.72,coverage:.84,
 powderRgbLinear:Object.freeze([.78,.83,.85]),powderDetailFloor:.94,
 roughnessTarget:.97,normalSofteningMaximum:.25
});
const clamp=v=>Math.max(0,Math.min(1,v));
const smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a));return t*t*(3-2*t);};
const S=SAPLING_SNOW;
/** World metres and original geometric world normal Y. heightAboveRoot uses
 * the current mesh/instance origin; it never samples or changes the ground. */
export function saplingSnowCover({x,y,z,normalY,heightAboveRoot}){
 if(![x,y,z,normalY,heightAboveRoot].every(Number.isFinite))throw new TypeError('Sapling snow requires finite world position, normal and root height');
 const support=smooth(S.supportLow,S.supportHigh,normalY),heightFactor=S.heightFloor+(1-S.heightFloor)*smooth(S.heightLow,S.heightHigh,heightAboveRoot);
 const a=S.fieldFrequencyA,b=S.fieldFrequencyB;
 const field=S.fieldBase+S.fieldAmplitudeA*Math.sin(a[0]*x+a[1]*y+a[2]*z)+S.fieldAmplitudeB*Math.sin(b[0]*x+b[1]*y+b[2]*z);
 const patch=smooth(S.patchLow,S.patchHigh,field),amount=S.coverage*support*heightFactor*(S.patchFloor+(1-S.patchFloor)*patch);
 return {amount,support,heightFactor,field,patch,normalSoftening:amount*S.normalSofteningMaximum,roughnessBlend:amount};
}
const number=n=>Number.isInteger(n)?n+'.0':String(n);
const vector=a=>'vec3('+a.map(number).join(', ')+')';
/** Generated from the same constants as the CPU cover. No texture fetches. */
export function saplingSnowShader(){
 return [
  'float saplingSnowCover(vec3 worldMetres, float originalNormalY, float heightAboveRoot) {',
  ' float support = smoothstep('+number(S.supportLow)+', '+number(S.supportHigh)+', originalNormalY);',
  ' float heightFactor = '+number(S.heightFloor)+' + '+number(1-S.heightFloor)+' * smoothstep('+number(S.heightLow)+', '+number(S.heightHigh)+', heightAboveRoot);',
  ' float field = '+number(S.fieldBase)+' + '+number(S.fieldAmplitudeA)+' * sin(dot(worldMetres, '+vector(S.fieldFrequencyA)+'))',
  '  + '+number(S.fieldAmplitudeB)+' * sin(dot(worldMetres, '+vector(S.fieldFrequencyB)+'));',
  ' float snowPatch = smoothstep('+number(S.patchLow)+', '+number(S.patchHigh)+', field);',
  ' return '+number(S.coverage)+' * support * heightFactor * ('+number(S.patchFloor)+' + '+number(1-S.patchFloor)+' * snowPatch);',
  '}'
 ].join('\n');
}
const marker='// sapling-snow-v1';
const vertexDeclarations=marker+'\nvarying vec4 vSaplingSnowWorld;\nvarying float vSaplingSnowNormalY;';
const originalNormal=[
 'vec3 saplingSnowViewNormal = transformedNormal;',
 '#ifdef FLIP_SIDED',
 ' saplingSnowViewNormal = -saplingSnowViewNormal;',
 '#endif',
 'vSaplingSnowNormalY = dot(normalize(saplingSnowViewNormal), normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz));'
].join('\n');
const worldPosition=[
 'vec4 saplingSnowPosition = vec4(transformed, 1.0);',
 'vec4 saplingSnowOrigin = vec4(0.0, 0.0, 0.0, 1.0);',
 '#ifdef USE_BATCHING',
 ' saplingSnowPosition = batchingMatrix * saplingSnowPosition;',
 ' saplingSnowOrigin = batchingMatrix * saplingSnowOrigin;',
 '#endif',
 '#ifdef USE_INSTANCING',
 ' saplingSnowPosition = instanceMatrix * saplingSnowPosition;',
 ' saplingSnowOrigin = instanceMatrix * saplingSnowOrigin;',
 '#endif',
 'saplingSnowPosition = modelMatrix * saplingSnowPosition;',
 'saplingSnowOrigin = modelMatrix * saplingSnowOrigin;',
 'vSaplingSnowWorld = vec4(saplingSnowPosition.xyz, saplingSnowPosition.y - saplingSnowOrigin.y);'
].join('\n');
/** Compose after an existing foliage hook. The remaining includes are retained
 * exactly; the previous hook may already have expanded map_fragment. */
export function patchSaplingSnowShader(shader){
 if(typeof shader?.vertexShader!=='string'||typeof shader?.fragmentShader!=='string')throw new TypeError('Sapling snow requires vertex and fragment shader source');
 const markedVertex=shader.vertexShader.includes(marker),markedFragment=shader.fragmentShader.includes(marker);
 if(markedVertex&&markedFragment)return shader;
 if(markedVertex||markedFragment)throw new Error('Partially patched sapling snow shader');
 const vertexChunks=['common','defaultnormal_vertex','project_vertex'],fragmentChunks=['color_fragment','roughnessmap_fragment','normal_fragment_maps'];
 for(const chunk of vertexChunks)if(!shader.vertexShader.includes('#include <'+chunk+'>'))throw new Error('Sapling snow missing vertex chunk '+chunk);
 for(const chunk of fragmentChunks)if(!shader.fragmentShader.includes('#include <'+chunk+'>'))throw new Error('Sapling snow missing fragment chunk '+chunk);
 let vertex=shader.vertexShader.replace('#include <common>','#include <common>\n'+vertexDeclarations);
 vertex=vertex.replace('#include <defaultnormal_vertex>','#include <defaultnormal_vertex>\n'+originalNormal);
 vertex=vertex.replace('#include <project_vertex>','#include <project_vertex>\n'+worldPosition);
 const color=[
  '#include <color_fragment>',
  'float saplingSnowAmount = saplingSnowCover(vSaplingSnowWorld.xyz, vSaplingSnowNormalY, vSaplingSnowWorld.w);',
  'float saplingSnowDetail = mix('+number(S.powderDetailFloor)+', 1.0, clamp(dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722)), 0.0, 1.0));',
  'diffuseColor.rgb = mix(diffuseColor.rgb, '+vector(S.powderRgbLinear)+' * saplingSnowDetail, saplingSnowAmount);'
 ].join('\n');
 let fragment=marker+'\nvarying vec4 vSaplingSnowWorld;\nvarying float vSaplingSnowNormalY;\n'+saplingSnowShader()+'\n'+shader.fragmentShader;
 fragment=fragment.replace('#include <color_fragment>',color);
 fragment=fragment.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, max(roughnessFactor, '+number(S.roughnessTarget)+'), saplingSnowAmount);');
 fragment=fragment.replace('#include <normal_fragment_maps>','vec3 saplingSnowBaseNormal = normal;\n#include <normal_fragment_maps>\nnormal = normalize(mix(normal, saplingSnowBaseNormal, saplingSnowAmount * '+number(S.normalSofteningMaximum)+'));');
 shader.vertexShader=vertex;shader.fragmentShader=fragment;return shader;
}
const programKey=S.version+'|'+JSON.stringify(S);
/** Changes only compilation hooks/version on this existing material. Calling
 * twice is idempotent. Prior callbacks retain their receiver and renderer. */
export function applySaplingSnowShader(material){
 if(!material||typeof material!=='object')throw new TypeError('Sapling snow requires an existing material');
 if(material.onBeforeCompile?.saplingSnowKey===programKey)return material;
 const previousCompile=material.onBeforeCompile,previousKey=typeof material.customProgramCacheKey==='function'?material.customProgramCacheKey.call(material):'';
 function compile(shader,renderer){if(typeof previousCompile==='function')previousCompile.call(this,shader,renderer);patchSaplingSnowShader(shader);}
 compile.saplingSnowKey=programKey;
 material.onBeforeCompile=compile;material.customProgramCacheKey=()=>previousKey+'|'+programKey;material.needsUpdate=true;return material;
}

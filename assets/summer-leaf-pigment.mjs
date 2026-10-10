// Shared by detailed scanned leaves and the albedo-only tree view bake.
// The input is linear RGB after the original texture/material multiplication.
// Preserve every texel's luminance (including photographed veins and exposure),
// retaining 42% of its original chroma while restoring a living summer pigment.
// No bark/fruit/needle classification is inferred from texture colour.
export const SUMMER_LEAF_MATERIALS=Object.freeze([
  'tree_small_02_leaves','island_tree_01_leaves','jacaranda_tree_leaves',
  'upright_hybrid_tree_small_02_leaves',
]);
export const SUMMER_LEAF_PIGMENT=Object.freeze({strength:.58,ratio:Object.freeze([.35,1,.19]),luma:Object.freeze([.2126,.7152,.0722])});
export const isSummerLeafMaterial=name=>SUMMER_LEAF_MATERIALS.includes(name);
export function summerLeafPigmentLinear(rgb){
  if(!rgb||rgb.length!==3||!Array.from(rgb).every(v=>Number.isFinite(v)&&v>=0&&v<=1))throw new TypeError('Finite linear RGB in [0,1] required');
  const {strength,ratio,luma}=SUMMER_LEAF_PIGMENT;
  const y=rgb.reduce((sum,v,i)=>sum+v*luma[i],0),ratioY=ratio.reduce((sum,v,i)=>sum+v*luma[i],0);
  const chroma=Array.from(rgb,(v,i)=>v+(y*ratio[i]/ratioY-v)*strength-y);
  // Compress toward the same-luminance neutral only when the new chroma would
  // leave the display gamut. Clipping the green channel would destroy detail.
  const hi=Math.max(...chroma),lo=Math.min(...chroma);
  const gamut=Math.min(1,(1-y)/Math.max(hi,1e-6),y/Math.max(-lo,1e-6));
  return chroma.map(v=>Math.max(0,Math.min(1,y+v*gamut)));
}

export const SUMMER_LEAF_GLSL=`
// SUMMER_LEAF_PIGMENT_V1
vec3 summerLeafPigment(vec3 sourceLeaf){
  const vec3 leafLumaWeights=vec3(.2126,.7152,.0722);
  const vec3 leafRatio=vec3(.35,1.0,.19);
  float leafY=dot(sourceLeaf,leafLumaWeights);
  vec3 leafChroma=mix(sourceLeaf,leafY*leafRatio/dot(leafRatio,leafLumaWeights),.58)-vec3(leafY);
  float leafHi=max(leafChroma.r,max(leafChroma.g,leafChroma.b));
  float leafLo=min(leafChroma.r,min(leafChroma.g,leafChroma.b));
  float leafGamut=min(1.0,min((1.0-leafY)/max(leafHi,1e-6),leafY/max(-leafLo,1e-6)));
  return clamp(vec3(leafY)+leafChroma*leafGamut,vec3(0.0),vec3(1.0));
}
`;
export function patchSummerLeafPigment(shader,materialName){
  if(!isSummerLeafMaterial(materialName))return false;
  const source=shader?.fragmentShader,anchor='#include <map_fragment>';
  if(typeof source!=='string')return false;
  if(source.includes('// SUMMER_LEAF_PIGMENT_V1'))return true;
  // Atomic ownership: unsupported shader sources retain their entire old code.
  if(source.split(anchor).length!==2)return false;
  shader.fragmentShader=SUMMER_LEAF_GLSL+source.replace(anchor,anchor+'\n diffuseColor.rgb=summerLeafPigment(diffuseColor.rgb);');
  return true;
}

import assert from 'node:assert/strict';
import test from 'node:test';
import * as T from '../assets/vendor/three/build/three.module.js';
import {SUMMER_LEAF_MATERIALS,SUMMER_LEAF_PIGMENT,SUMMER_LEAF_GLSL,isSummerLeafMaterial,summerLeafPigmentLinear,patchSummerLeafPigment} from '../assets/summer-leaf-pigment.mjs';
import {patchCanopyShade} from '../assets/canopy-shading.js';
import {patchSeasonalFoliage,patchFoliageCoverage} from '../assets/tree-impostors.js';
const luminance=rgb=>rgb.reduce((n,v,i)=>n+v*SUMMER_LEAF_PIGMENT.luma[i],0);
const shader=kind=>({vertexShader:T.ShaderLib[kind].vertexShader,fragmentShader:T.ShaderLib[kind].fragmentShader,uniforms:{}});
const renderer={getContext:()=>({getContextAttributes:()=>({antialias:true})}),getRenderTarget:()=>null,capabilities:{maxSamples:4}};

test('leaf pigment preserves scanned linear luminance and finite RGB throughout the whole colour cube',()=>{
 let altered=0;
 for(let r=0;r<=1;r+=.05)for(let g=0;g<=1;g+=.05)for(let b=0;b<=1;b+=.05){
  const before=[r,g,b],after=summerLeafPigmentLinear(before);
  assert(after.every(v=>Number.isFinite(v)&&v>=0&&v<=1));
  assert(Math.abs(luminance(before)-luminance(after))<8e-16);
  assert.deepEqual(before,[r,g,b],'caller input stays unchanged');
  if(after.some((v,i)=>Math.abs(v-before[i])>.02))altered++;
 }
 assert(altered>5000);assert.deepEqual(summerLeafPigmentLinear([0,0,0]),[0,0,0]);
 assert.deepEqual(summerLeafPigmentLinear([1,1,1]),[1,1,1]);
 for(const bad of [[NaN,0,0],[Infinity,0,0],[-.1,0,0],[0,0,1.1],[]])assert.throws(()=>summerLeafPigmentLinear(bad),/Finite/);
});

test('muted and brown summer leaves gain green pigment while photographic luminance contrast remains exact',()=>{
 for(const sample of [[.17,.115,.065],[.148,.18,.119],[.09,.11,.065]]){
  const result=summerLeafPigmentLinear(sample);assert(result[1]>result[0]*1.3&&result[1]>result[2]*2);
  const dark=sample.map(v=>v*.35),darkResult=summerLeafPigmentLinear(dark);
  assert(Math.abs(luminance(result)/luminance(darkResult)-1/.35)<1e-12);
 }
 const a=summerLeafPigmentLinear([.12,.18,.04]),b=summerLeafPigmentLinear([.12,.18,.08]);
 assert.notDeepEqual(a,b,'original scan colour variation is retained');
});

test('material identity gates pigment strictly to verified broadleaf leaves',()=>{
 assert.equal(SUMMER_LEAF_MATERIALS.length,4);assert(Object.isFrozen(SUMMER_LEAF_MATERIALS));
 for(const name of SUMMER_LEAF_MATERIALS){assert(isSummerLeafMaterial(name));const s=shader('standard');assert(patchSummerLeafPigment(s,name));assert(s.fragmentShader.includes('SUMMER_LEAF_PIGMENT_V1'));}
 for(const name of ['tree_small_02_trunk','tree_small_02_branches','island_tree_01','island_tree_01_branches','jacaranda_tree_trunk','upright_hybrid_tree_small_02_trunk','pine_tree_01_twig','fir_sapling_medium_twigs','apple_skin','unknown_leaves']){
  const s=shader('standard'),before=structuredClone(s);assert(!patchSummerLeafPigment(s,name));assert.deepEqual(s,before,'wood, fruit and other species retain their shader');
 }
});

test('runtime and Basic albedo bake share the exact transform without texture, normal or alpha ownership',()=>{
 const insertion='\n diffuseColor.rgb=summerLeafPigment(diffuseColor.rgb);';
 for(const kind of ['standard','basic']){
  const s=shader(kind),before=structuredClone(s);assert(patchSummerLeafPigment(s,'tree_small_02_leaves'));
  assert.equal(s.vertexShader,before.vertexShader);assert.deepEqual(s.uniforms,before.uniforms);
  assert.equal(s.fragmentShader.replace(SUMMER_LEAF_GLSL,'').replace(insertion,''),before.fragmentShader);
  assert.equal(s.fragmentShader.split('diffuseColor.rgb=summerLeafPigment').length,2);
  assert(s.fragmentShader.indexOf('diffuseColor.rgb=summerLeafPigment')<s.fragmentShader.indexOf('#include <color_fragment>'));
  const once=s.fragmentShader;assert(patchSummerLeafPigment(s,'tree_small_02_leaves'));assert.equal(s.fragmentShader,once,'idempotent compilation');
 }
 assert(!/texture2D|sampler|normal|alpha|outgoingLight|emissive/.test(SUMMER_LEAF_GLSL));
});

test('unsupported shader anchors fail atomically and seasonal, occlusion and coverage hooks still compose',()=>{
 for(const fragmentShader of ['void main(){}','#include <map_fragment>\n#include <map_fragment>']){
  const s={fragmentShader,vertexShader:'untouched',uniforms:{kept:{value:17}}},before=structuredClone(s);assert(!patchSummerLeafPigment(s,'tree_small_02_leaves'));assert.deepEqual(s,before);
 }
 const s=shader('standard');patchSummerLeafPigment(s,'tree_small_02_leaves');patchSeasonalFoliage(s);patchCanopyShade(s);patchFoliageCoverage(s,renderer);
 const f=s.fragmentShader;assert(f.indexOf('diffuseColor.rgb=summerLeafPigment')<f.indexOf('vec3 originalLeaf=diffuseColor.rgb;'));
 assert(f.indexOf('leafLuma*pigment*1.25')<f.indexOf('diffuseColor.rgb*=vCanopyShade;'));
 assert(f.includes('gl_FragColor.a=foliageMultisample?foliageCoverageAlpha:1.0;'));
 assert(f.includes('if(diffuseColor.a<=0.0)discard;'));assert(f.includes('diffuseColor.rgb*=vCanopyShade;'));
 assert.deepEqual(Object.keys(s.uniforms),['foliageMultisample']);
});

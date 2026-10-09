// Dry-turf shader and physical response contracts.
// Run: node --test tools/test-dry-turf.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {join,dirname} from 'node:path';
const ROOT=process.env.QA_DRY_TURF_ROOT||join(dirname(fileURLToPath(import.meta.url)),'..');
const OLD_LINE='        roughnessFactor=mix(roughnessFactor,clamp(groundARM.g,.65,1.0),upClose*(1.0-snow));';
const EXPECTED_BLOCK="        #ifndef OUTER_LANDSCAPE\n          float groundRoughness=clamp(groundARM.g,.65,1.0);\n          // Dry grass keeps the base material's broad, matte response. Fade\n          // back to the sampled substrate at woodland, soil, mineral and\n          // winter edges, before the existing water/rain response below.\n          float dryTurf=(1.0-smoothstep(0.0,1.0,canopy))\n                       *(1.0-smoothstep(0.0,1.0,wear))\n                       *(1.0-smoothstep(0.0,1.0,bank))\n                       *(1.0-smoothstep(0.0,1.0,rocky))\n                       *(1.0-smoothstep(0.0,1.0,canyon))\n                       *(1.0-smoothstep(0.0,1.0,quarters))\n                       *(1.0-smoothstep(0.0,1.0,snow))\n                       *(1.0-smoothstep(0.0,1.0,thawLitter))\n                       *(1.0-smoothstep(0.0,.30,wet*.42))\n                       *(1.0-smoothstep(0.0,.30,rainWet));\n          groundRoughness=mix(groundRoughness,roughnessFactor,dryTurf);\n          roughnessFactor=mix(roughnessFactor,groundRoughness,upClose*(1.0-snow));\n        #else\n          roughnessFactor=mix(roughnessFactor,clamp(groundARM.g,.65,1.0),upClose*(1.0-snow));\n        #endif";

const compact=s=>s.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'').replace(/\s+/g,'');
const filename=join(ROOT,'assets/terrain-realism.js'),current=readFileSync(filename,'utf8');
// Counterfactual removes only this feature from CURRENT source. A whole-file
// historical pin would reject every later independent terrain improvement.
const begin=current.indexOf('        #ifndef OUTER_LANDSCAPE\n          float groundRoughness=');
const finish=current.indexOf('        diffuseColor.rgb*=mix(1.0,groundARM.r,.22*upClose*(1.0-snow));',begin);
assert(begin>=0&&finish>begin,'Current production dry-roughness branch required');
const found=current.slice(begin,finish).trimEnd();
assert.equal(compact(found),compact(EXPECTED_BLOCK),'All reviewed dry-turf substrate gates remain present');
const baseline=current.replace(found,OLD_LINE),active=current;
assert.equal(baseline.replace(OLD_LINE,found),current,'Counterfactual changes only the scoped branch');
const T=await import(pathToFileURL(join(ROOT,'assets/vendor/three/build/three.module.js')).href);
const loadSource=async source=>{
 const resolved=source.replace(/from (['"])(\.\/[^'"]+)\1/g,(_m,_q,p)=>'from '+JSON.stringify(new URL(p,pathToFileURL(filename)).href));
 return import('data:text/javascript;base64,'+Buffer.from(resolved).toString('base64'));
};
const before=await loadSource(baseline),after=await loadSource(active);
function fixture(module,kind='minimal'){
 const oldDoc=globalThis.document,oldRandom=Math.random,paths=[];let draws=0;
 let pixels;const context={createImageData:(width,height)=>({width,height,data:new Uint8ClampedArray(width*height*4)}),putImageData:p=>{pixels=p;},getImageData:()=>pixels,fillRect(){},createRadialGradient:()=>({addColorStop(){}}),beginPath(){},lineTo(){},moveTo(){},stroke(){}};
 globalThis.document={createElement:()=>({getContext:()=>context})};
 Math.random=()=>{draws++;return .125;};
 try{
  const cpu={...T,TextureLoader:class{load(path){paths.push(path);const t=new T.Texture();t.name=path;return t;}}};
  const grass=new T.Texture(),bump=new T.Texture(),surface=module.createTerrainSurface({THREE:cpu,renderer:{capabilities:{getMaxAnisotropy:()=>8}},grass,bump});
  const shader=kind==='minimal'?{vertexShader:'#include <begin_vertex>',fragmentShader:'#include <map_fragment>\n#include <roughnessmap_fragment>\n#include <normal_fragment_maps>\n#include <aomap_fragment>',uniforms:{}}:
   {vertexShader:T.ShaderLib[kind].vertexShader,fragmentShader:T.ShaderLib[kind].fragmentShader,uniforms:{...T.ShaderLib[kind].uniforms}};
  const createdDraws=draws;Math.random=()=>{throw Error('Shader hook must not draw RNG');};surface.material.onBeforeCompile(shader);
  return {surface,shader,paths,draws:createdDraws,grass,bump};
 }finally{Math.random=oldRandom;if(oldDoc===undefined)delete globalThis.document;else globalThis.document=oldDoc;}
}
function preprocess(code,{cheap=false,outer=false}={}){
 const flags={CHEAP_GROUND:cheap,OUTER_LANDSCAPE:outer},stack=[],out=[];let on=true;
 for(const line of code.split('\n')){
  const p=line.trim().match(/^#(ifdef|ifndef) (\w+)$/);
  if(p){assert(p[2] in flags,'Unexpected custom flag '+p[2]);const take=p[1]==='ifdef'?flags[p[2]]:!flags[p[2]];stack.push({on,take});on=on&&take;}
  else if(line.trim()==='#else'){const p=stack.at(-1);assert(p);on=p.on&&!p.take;}
  else if(line.trim()==='#endif'){const p=stack.pop();assert(p);on=p.on;}
  else if(on)out.push(line);
 }
 assert.equal(stack.length,0);return out.join('\n');
}
const original=fixture(before),candidate=fixture(after),src=candidate.shader.fragmentShader;
const roughBlock=s=>s.slice(s.indexOf('#include <roughnessmap_fragment>')+'#include <roughnessmap_fragment>'.length,s.indexOf('#include <normal_fragment_maps>'));
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),mix=(a,b,t)=>a+(b-a)*t;
const smoothstep=(a,b,v)=>{const t=clamp((v-a)/(b-a),0,1);return t*t*(3-2*t);};
const keys=['canopy','wear','bank','rocky','canyon','quarters','snow','thawLitter','wet','rainWet','upClose','armG','roughnessFactor','groundRoughness','dryTurf'];
function expression(s){
 s=s.replaceAll('groundARM.g','armG');
 assert(/^[\w\s.+*(),/-]+$/.test(s),'Scalar expression contains unsupported syntax');
 for(const word of s.match(/[A-Za-z_]\w*/g)||[])assert([...keys,'smoothstep','mix','clamp'].includes(word),'Unknown scalar '+word);
 return Function(...keys,'smoothstep','mix','clamp','"use strict";return ('+s+');');
}
const evalExpr=(fn,v)=>fn(...keys.map(k=>v[k]??0),smoothstep,mix,clamp);
const dryExpression=expression(src.match(/float dryTurf=([\s\S]*?);/)[1]);
const defaultState={canopy:0,wear:0,bank:0,rocky:0,canyon:0,quarters:0,snow:0,thawLitter:0,wet:0,rainWet:0,upClose:1,armG:.263398,roughnessFactor:.96};
const weight=m=>evalExpr(dryExpression,{...defaultState,...m});
function controller(shader,tier){
 const all=preprocess(roughBlock(shader),tier),ops=[];
 // Scope the original dry-roughness response and its wet/snow composition.
 // Later pasture micro-roughness has its own independent contract suite.
 const rain='roughnessFactor=mix(roughnessFactor,.43,clamp(wet*.42+rainWet,0.0,.85));',snow='roughnessFactor=mix(roughnessFactor,.97,snow);';
 const end=all.indexOf(rain);assert(end>=0);
 const code=all.slice(0,end)+rain+(all.includes(snow)?snow:'');
 for(const m of code.matchAll(/(?:\bfloat\s+)?\b(dryTurf|groundRoughness|roughnessFactor)\s*=\s*([^;]+);/g))ops.push([m[1],expression(m[2])]);
 assert(ops.length>=1);
 return input=>{const v={...defaultState,...input};for(const [name,fn]of ops)v[name]=evalExpr(fn,v);return v.roughnessFactor;};
}
const newR=controller(src,{}),oldR=controller(original.shader.fragmentShader,{});
const near=(a,b,e=1e-12)=>assert(Math.abs(a-b)<=e,a+' differs from '+b);
const substrate=['canopy','wear','bank','rocky','canyon','quarters','snow','thawLitter'];

test('actual standard/physical hooks preserve vertex, map/normal/AO, samplers, resources and flags',()=>{
 for(const kind of ['minimal','standard','physical']){
  const a=fixture(before,kind),b=fixture(after,kind),am=a.surface.material,bm=b.surface.material;
  assert.equal(a.shader.vertexShader,b.shader.vertexShader);
  const strip=s=>s.replace(roughBlock(s),'');
  assert.equal(strip(a.shader.fragmentShader),strip(b.shader.fragmentShader));
  assert.deepEqual(a.paths,b.paths);assert.equal(a.paths.length,10);assert.equal(a.draws,b.draws);
  assert.deepEqual(Object.keys(a.shader.uniforms),Object.keys(b.shader.uniforms));
  const samples=s=>s.match(/\btexture2D\s*\(/g)||[];assert.equal(samples(a.shader.fragmentShader).length,samples(b.shader.fragmentShader).length);
  const declarations=s=>s.match(/uniform sampler2D[^;]+;/g);assert.deepEqual(declarations(a.shader.fragmentShader),declarations(b.shader.fragmentShader));
  for(const k of ['roughness','envMapIntensity','bumpScale','metalness','vertexColors','side','transparent','alphaTest','depthWrite','depthTest','premultipliedAlpha'])assert.equal(am[k],bm[k]);
  assert.equal(bm.map,b.grass);assert.equal(bm.bumpMap,b.bump);assert.deepEqual(am.defines,bm.defines);
  assert.deepEqual(Object.keys(am.userData),Object.keys(bm.userData));assert.deepEqual(am.defaultAttributeValues,bm.defaultAttributeValues);
  assert.equal(bm.customProgramCacheKey(),am.customProgramCacheKey());
  const ao='diffuseColor.rgb*=mix(1.0,groundARM.r,.22*upClose*(1.0-snow));';
  assert.equal(b.shader.fragmentShader.split(ao).length,2);
 }
});

test('dry correction leaves CHEAP and hypothetical high OUTER shader tokens unchanged',()=>{
 for(const tier of [{cheap:true,outer:false},{cheap:true,outer:true},{cheap:false,outer:true}]){
  assert.equal(compact(preprocess(src,tier)),compact(preprocess(original.shader.fragmentShader,tier)));
  const a=controller(src,tier),b=controller(original.shader.fragmentShader,tier);
  for(let i=0;i<100;i++)near(a({wet:i/99,rainWet:(99-i)/99,snow:(i%17)/16,armG:(i%23)/22}),b({wet:i/99,rainWet:(99-i)/99,snow:(i%17)/16,armG:(i%23)/22}));
 }
 assert.notEqual(compact(preprocess(src,{})),compact(preprocess(original.shader.fragmentShader,{})));
});

test('dry-roughness branch respects the base material uniform at all detail distances',()=>{
 for(const base of [.70,.82,.91,.96,1])for(const upClose of [0,.05,.5,1])for(const armG of [0,.26,.65,.82,1]){
  near(newR({roughnessFactor:base,upClose,armG}),base);
 }
 near(newR({}),.96);assert.equal(weight({}),1);
 // A hard-coded .96 correction would fail these actual emitted-expression cases.
 near(newR({roughnessFactor:.82}),.82);
});

test('each full substrate and fully wet/rainy field preserves the current uncorrected roughness branch',()=>{
 for(const name of substrate)for(const armG of [.1,.65,.81,1])for(const upClose of [.1,.5,1]){
  const state={[name]:1,armG,upClose};assert.equal(weight(state),0);near(newR(state),oldR(state));
 }
 for(const state of [{wet:1},{rainWet:.30},{rainWet:.72},{rainWet:1},{wet:1,rainWet:.72}]){
  assert.equal(weight(state),0);near(newR(state),oldR(state));
 }
 near(newR({canopy:.5,wear:.5}),.7275);
});

test('decoded cover is finite, bounded and monotone for every substrate and moisture input',()=>{
 const rows=[...substrate.map(name=>[name,1]),['wet',1],['rainWet',1]];
 for(const [name,max]of rows){let previous=1;for(let i=0;i<=1000;i++){const w=weight({[name]:max*i/1000});assert(Number.isFinite(w)&&w>=0&&w<=1);assert(w<=previous+1e-15);previous=w;}}
 for(let i=0;i<2000;i++){
  const state={armG:(Math.sin(i*1.13)+1)/2,upClose:(Math.cos(i*.79)+1)/2};
  for(let k=0;k<substrate.length;k++)state[substrate[k]]=(Math.sin(i*.173+k*1.931)+1)/2;
  state.wet=(Math.cos(i*.317)+1)/2;state.rainWet=(Math.sin(i*.729)+1)/2;
  const w=weight(state),r=newR(state);assert(Number.isFinite(w)&&w>=0&&w<=1);assert(Number.isFinite(r)&&r>=.43-1e-12&&r<=1+1e-12);
 }
});

test('all fade endpoints are continuous with zero endpoint slope; former cutoff has no jump',()=>{
 const eps=1e-5;
 for(const [name,edge]of [...substrate.map(k=>[k,1]),['wet',.30/.42],['rainWet',.30]]){
  for(const x of [0,edge]){
   const left=weight({[name]:x-eps}),at=weight({[name]:x}),right=weight({[name]:x+eps});
   assert(Math.abs(left-at)<1e-7&&Math.abs(right-at)<1e-7);
   assert(Math.abs((right-left)/(2*eps))<.001);
  }
  const a=weight({[name]:.003-eps}),b=weight({[name]:.003+eps});
  assert(Math.abs(a-b)<1e-4);
 }
 for(const x of [.003,.10,.5,.80])assert(Math.abs(newR({wear:x-eps})-newR({wear:x+eps}))<1e-4);
});

test('rain reduces the correction smoothly and retains the original wet/snow order',()=>{
 let last=.96;
 for(let i=0;i<=1000;i++){const r=newR({rainWet:i/1000});assert(r<=last+1e-12);last=r;}
 assert.equal(weight({rainWet:.15}),.5);
 near(newR({rainWet:.15}),mix(mix(.96,.805,1),.43,.15));
 near(newR({snow:1}),.97);near(newR({snow:1}),oldR({snow:1}));
 for(const line of ['roughnessFactor=mix(roughnessFactor,.43,clamp(wet*.42+rainWet,0.0,.85));','roughnessFactor=mix(roughnessFactor,.97,snow);'])assert.equal(src.split(line).length,2);
});

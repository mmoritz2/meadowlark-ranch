import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';

const runtime=path.resolve(process.env.WATERFALL_RUNTIME_ROOT||process.env.RANCH_RUNTIME_ROOT||fileURLToPath(new URL('../',import.meta.url)));
const assetPath=name=>path.join(runtime,'assets',name);
const factoryPath=process.env.WATERFALL_ART_SOURCE||fileURLToPath(new URL('../assets/waterfall-art.js',import.meta.url));
const helperPath=process.env.HOLLOWPEAK_FALLING_WATER_SOURCE||fileURLToPath(new URL('../assets/hollowpeak-falling-water.mjs',import.meta.url));
const fixture=new URL('./fixtures/hollowpeak-falling-water-cde67b8/',import.meta.url);
const meta=JSON.parse(fs.readFileSync(new URL('source-edits.json',fixture),'utf8'));
const oldSource=fs.readFileSync(new URL('waterfall-art.js',fixture),'utf8');
const source=fs.readFileSync(factoryPath,'utf8'),helperSource=fs.readFileSync(helperPath,'utf8');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
assert.equal(sha(oldSource),meta.baselineSourceSHA256,'Current-cohort established owner remains exact');
let recovered=source;
for(const e of [...meta.changes].reverse()){
 assert.equal(recovered.split(e.after).length-1,1,'Each additive selected-material edge occurs once');
 recovered=e.kind==='prepend'?(assert(recovered.startsWith(e.after)),recovered.slice(e.after.length)):recovered.replace(e.after,e.before);
}
assert.equal(recovered,oldSource,'Only the three explicit selected-material edges alter waterfall-art');

const T=await import(pathToFileURL(assetPath('vendor/three/build/three.module.js')));
const cascade=await import(pathToFileURL(assetPath('cascade-flow.mjs')));
const cataract=await import(pathToFileURL(assetPath('hollowpeak-cataract.mjs')));
const {createWaterfallEffects}=await import(pathToFileURL(assetPath('waterfall-effects.js')));
const helper=await import('data:text/javascript;base64,'+Buffer.from(helperSource).toString('base64'));
const dependencies={createHollowpeakFallingWaterMaterial:helper.createHollowpeakFallingWaterMaterial,...cataract,createWaterfallEffects,...cascade};
function factory(text){
 const imports=[...text.matchAll(/^import \{([^}]+)\} from [^\n]+;\n/gm)].flatMap(m=>m[1].split(',').map(s=>s.trim()));
 const body=text.replace(/^import .*;\n/gm,'').replace('export function createWaterfallArt','function createWaterfallArt')+'\nreturn createWaterfallArt;';
 return new Function(...imports,body)(...imports.map(k=>{assert(k in dependencies,k);return dependencies[k];}));
}
const establishedFactory=factory(oldSource),candidateFactory=factory(source);
const flow={x:-150,z:-242.2,top:14.2,bottom:-.06,width:2.45,run:7.8,name:'Hollowpeak Falls',flowProfile:cataract.HOLLOWPEAK_CATARACT_PROFILE};
const ribbon={x:342,z:66.05,top:8.1,bottom:5.3,width:1.35,run:1.85,name:'Ribbon Falls',footHeightAt:(x,z)=>5.225+.01*(x-342),footWidth:1.35};
function buffers(geometry){return Object.fromEntries([...Object.entries(geometry.attributes),['index',geometry.index]].map(([k,a])=>[k,{itemSize:a.itemSize,normalized:a.normalized,count:a.count,type:a.array.constructor.name,bytes:Buffer.from(a.array.buffer,a.array.byteOffset,a.array.byteLength)}]));}
function materialState(material){const j=material.toJSON();for(const key of ['metadata','uuid','name','userData'])delete j[key];return j;}
function compile(material,renderer){const shader={uniforms:{},vertexShader:T.ShaderLib.physical.vertexShader,fragmentShader:T.ShaderLib.physical.fragmentShader};material.onBeforeCompile(shader,renderer);return shader;}
function construct(make,flowTexture=null){
 const previous=Math.random;let seed=83871,calls=0,physicalMaterials=0;
 class Physical extends T.MeshPhysicalMaterial{constructor(...args){super(...args);physicalMaterials++;}}
 Math.random=()=>{calls++;seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 try{
  const art=make({THREE:{...T,MeshPhysicalMaterial:Physical},flowTexture});
  const before=physicalMaterials,rf=art.fall(ribbon),afterRibbon=physicalMaterials;
  const selected=art.fall(flow),afterSelected=physicalMaterials,selectedAgain=art.fall(flow),afterAgain=physicalMaterials;
  const plain=art.fall({...flow,flowProfile:null,name:'Unselected cataract'});
  const fx=art.effects({...flow,name:'Hollowpeak'}),impact=art.impact({x:flow.x,z:flow.z+flow.run,y:flow.bottom,radius:3.8});
  const callsBeforeSuffix=calls,suffix=Array.from({length:8},()=>Math.random());
  return{art,rf,selected,selectedAgain,plain,fx,impact,callsBeforeSuffix,suffix,resources:{before,afterRibbon,afterSelected,afterAgain,physicalMaterials}};
 }finally{Math.random=previous;}
}
const photo={isTexture:true,name:'Existing decoded foam marker'};
const old=construct(establishedFactory),next=construct(candidateFactory),oldPhoto=construct(establishedFactory,photo),nextPhoto=construct(candidateFactory,photo);
const proof={baseline:meta.baselineCommit,baselineOwnerSHA256:sha(oldSource),candidateOwnerSHA256:sha(source),helperSHA256:sha(helperSource),scope:'CPU source/material/math checks only; native shader/GL/motion/art acceptance remains required'};

test('exact current-cohort inverse preserves every established factory path and historic fixture',()=>{
 assert.equal(sha(recovered),meta.baselineSourceSHA256);
 assert.equal(next.art.fall.toString().replace(meta.changes[2].after,meta.changes[2].before),old.art.fall.toString());
 for(const key of ['pool','impact','effects','update'])assert.equal(next.art[key].toString(),old.art[key].toString());
 assert.throws(()=>next.art.fall({...flow,flowProfile:'unknown'}),/Unknown waterfall flow profile/);
 proof.sourceInverse={edges:meta.changes.length,establishedSHA256:sha(recovered),historicalFixturesChanged:false};
});

test('Ribbon, grounded-chute shared owner and unselected shaders/material state remain exact with or without photo',()=>{
 for(const [a,b] of [[old,next],[oldPhoto,nextPhoto]]){
  for(const key of ['rf','plain']){
   assert.deepEqual(buffers(a[key].children[0].geometry),buffers(b[key].children[0].geometry));
   assert.deepEqual(a[key].userData,b[key].userData);
   assert.equal(b[key].children[0].material,b.art.material);
  }
  assert.deepEqual(materialState(a.art.material),materialState(b.art.material));
  assert.deepEqual(a.art.material.defaultAttributeValues,b.art.material.defaultAttributeValues);
  assert.equal(a.art.material.forceSinglePass,b.art.material.forceSinglePass);
  assert.equal(a.art.material.onBeforeCompile.toString(),b.art.material.onBeforeCompile.toString());
  const as=compile(a.art.material),bs=compile(b.art.material);
  assert.equal(as.vertexShader,bs.vertexShader);assert.equal(as.fragmentShader,bs.fragmentShader);
  assert.equal(a.art.material.customProgramCacheKey(),b.art.material.customProgramCacheKey());
 }
 proof.unselectedExact={sharedMaterial:true,fullShader:true,geometryAndMetadata:true,photoAndFallback:true};
});

test('selected owner reuses one additional material with identical full geometry, vertex shader, bounds, clock and photo references',()=>{
 for(const [a,b] of [[old,next],[oldPhoto,nextPhoto]]){
  const am=a.selected.children[0],bm=b.selected.children[0];
  assert.deepEqual(buffers(am.geometry),buffers(bm.geometry));assert.deepEqual(am.geometry.boundingSphere,bm.geometry.boundingSphere);
  assert.deepEqual(a.selected.userData,b.selected.userData);assert.equal(a.selected.children.length,b.selected.children.length);assert.equal(am.renderOrder,bm.renderOrder);
  assert.notEqual(bm.material,b.art.material);assert.equal(bm.material,b.selectedAgain.children[0].material);
  assert.deepEqual(materialState(bm.material),materialState(b.art.material));assert.deepEqual(bm.material.defaultAttributeValues,b.art.material.defaultAttributeValues);
  assert.equal(bm.material.forceSinglePass,b.art.material.forceSinglePass);assert(bm.material.transparent&&!bm.material.depthWrite&&bm.material.side===T.DoubleSide);
  const base=compile(b.art.material),selected=compile(bm.material);
  assert.equal(selected.vertexShader,base.vertexShader);assert.notEqual(selected.fragmentShader,base.fragmentShader);
  assert.equal(selected.uniforms.waterfallTime,b.art.time);assert.equal(base.uniforms.waterfallTime,b.art.time);
  assert.equal(selected.uniforms.waterfallFlowMap?.value,base.uniforms.waterfallFlowMap?.value);
  assert.equal(selected.uniforms.waterfallFlowMap?.value,b===nextPhoto?photo:undefined);
  assert.equal(b.resources.before,1);assert.equal(b.resources.afterRibbon,1);assert.equal(b.resources.afterSelected,2);assert.equal(b.resources.afterAgain,2);assert.equal(b.resources.physicalMaterials,2);
  assert.equal(compile(bm.material).fragmentShader,selected.fragmentShader,'Recompile does not stack patches');
 }
 proof.selected={vertices:next.selected.children[0].geometry.attributes.position.count,triangles:next.selected.children[0].geometry.index.count/3,additionalMaterials:1,newGeometry:0,newTextures:0,vertexShaderExact:true};
});

test('private construction preserves ambient RNG and later particles, and frame updates only change the shared clock',()=>{
 for(const [a,b] of [[old,next],[oldPhoto,nextPhoto]]){
  assert.equal(a.callsBeforeSuffix,b.callsBeforeSuffix);assert.deepEqual(a.suffix,b.suffix);
  assert.deepEqual(a.fx.stats,b.fx.stats);assert.equal(a.fx.meshes.length,b.fx.meshes.length);
  for(let i=0;i<a.fx.meshes.length;i++)assert.deepEqual(buffers(a.fx.meshes[i].geometry),buffers(b.fx.meshes[i].geometry));
  assert.deepEqual(buffers(a.impact.geometry),buffers(b.impact.geometry));assert.deepEqual(materialState(a.impact.material),materialState(b.impact.material));
 }
 const before=buffers(next.selected.children[0].geometry),previous=Math.random;
 Math.random=()=>{throw Error('Frame RNG drift');};
 try{for(const t of [0,.01,.4,.8,1.7,13,59.99,1000])next.art.update(t);}finally{Math.random=previous;}
 assert.deepEqual(before,buffers(next.selected.children[0].geometry));assert.equal(next.art.time.value,1000);
 assert.equal(compile(next.selected.children[0].material).uniforms.waterfallTime.value,1000);
 proof.rng={constructorCallsEqual:true,postConstructorSuffixExact:true,particleSeedsExact:true,frameRandomCalls:0,physicalBuffersStable:true};
});

test('direct clones have unique identities, failure restores RNG, and base material/texture disposal ownership stays independent',()=>{
 const base=candidateFactory({THREE:T,flowTexture:photo}).material,previous=Math.random;let calls=0;
 Math.random=()=>{calls++;return .42;};
 try{
  const a=helper.createHollowpeakFallingWaterMaterial(base,{flowTexture:photo}),b=helper.createHollowpeakFallingWaterMaterial(base,{flowTexture:photo});
  assert.notEqual(a.uuid,b.uuid);assert.notEqual(a.uuid,base.uuid);assert.equal(calls,0);
  const failure={uuid:'failure',onBeforeCompile(){},customProgramCacheKey(){return'failure';},clone(){Math.random();throw Error('Expected clone failure');}};
  const active=Math.random;assert.throws(()=>helper.createHollowpeakFallingWaterMaterial(failure),/Expected clone failure/);assert.equal(Math.random,active);assert.equal(calls,0);
  let sharedDisposed=0;const listener=()=>sharedDisposed++;base.addEventListener('dispose',listener);a.dispose();b.dispose();assert.equal(sharedDisposed,0);base.removeEventListener('dispose',listener);
 }finally{Math.random=previous;}
 assert.equal(Math.random,previous);proof.clone={uniqueUUIDs:true,failureRestoresAmbientGenerator:true,sharedMaterialNotDisposed:true};
});

test('compile forwards base context and renderer once, validates fragment scope, and separates selected/photo/fallback cache identity',()=>{
 const base=candidateFactory({THREE:T}).material,original=base.onBeforeCompile,renderer={marker:'renderer'};let calls=0;
 base.onBeforeCompile=function(sh,r){assert.equal(this,base);assert.equal(r,renderer);calls++;original(sh,r);};
 const selected=helper.createHollowpeakFallingWaterMaterial(base);compile(selected,renderer);assert.equal(calls,1);
 const keys=[next.art.material,nextPhoto.art.material,next.selected.children[0].material,nextPhoto.selected.children[0].material].map(m=>m.customProgramCacheKey());assert.equal(new Set(keys).size,keys.length);
 const broken=candidateFactory({THREE:T}).material,oldCompile=broken.onBeforeCompile;
 broken.onBeforeCompile=sh=>{oldCompile(sh);sh.fragmentShader=sh.fragmentShader.replace('   vec2 fuv=cascadeUV;','   vec2 changedUV=cascadeUV;');};
 assert.throws(()=>compile(helper.createHollowpeakFallingWaterMaterial(broken)),/colour contract changed/);
 const sh=compile(nextPhoto.selected.children[0].material);
 assert(sh.fragmentShader.includes('photoSample.a*dot(photoSample.rgb'),'Photo alpha remains density, hidden RGB is not foam');
 assert(sh.fragmentShader.includes('fwidth('),'Selected subpixel detail has a footprint filter');
 assert(sh.fragmentShader.includes('#include <normal_fragment_maps>')&&sh.fragmentShader.includes('#include <clearcoat_normal_fragment_maps>'));
 proof.cache={distinctKeys:keys.length,baseCompileBoundAndForwardedOnce:true,fragmentContractFailsClosed:true,shaderChecks:'Source injection only, no GLSL compiler claim'};
});

// Evaluate actual emitted scalar colour declarations, not a copied golden field.
// Derivatives are fixed scalar footprint inputs; this proves bounded math/joins
// and advection, not GPU derivative accuracy, sampled image content or pixels.
function colourEvaluator(material,photoMode=false){
 const shader=compile(material),start=shader.fragmentShader.indexOf('   vec2 fuv=cascadeUV;'),end=shader.fragmentShader.indexOf('   diffuseColor.rgb=',start);
 assert(start>=0&&end>start);let body=shader.fragmentShader.slice(start,end);
 assert(!/cascadeLayer|fuv\.x/.test(body),'Selected current field cannot depend on a strip seam coordinate');
 body=body.replace(/\/\/[^\n]*/g,'').replace(/vec2 fuv=cascadeUV;/,'').replace(/vec4 photoSample=[^;]*;float photoDetail=[^;]*;/,'float photoDetail=photo;');
 body=body.replace(/\bfloat\s+/g,'let ').replace(/fuv\.y/g,'v').replace(/cascadeWholeAcross/g,'across').replace(/waterfallTime/g,'time').replace(/cascadeTravelSpeed/g,'rate');
 const alpha=/diffuseColor\.a\*=([^;]+);/.exec(shader.fragmentShader.slice(end));assert(alpha);
 const rough=/roughnessFactor=([^;]+);/.exec(shader.fragmentShader);assert(rough);
 const helpers={sqrt:Math.sqrt,max:Math.max,exp:Math.exp,pow:Math.pow,clamp:(x,a,b)=>Math.max(a,Math.min(b,x)),mix:(a,b,t)=>a+(b-a)*t,smoothstep:(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);},vec2:(a,b)=>[a,b],fallNoise};
 const fn=new Function(...Object.keys(helpers),'across','v','time','rate','photo','footprint',`const fwidth=()=>footprint;${body}\nreturn {bulk,aeration,strand,mist,fine,fallTravel,strandAA,mistAA,alpha:${alpha[1]},roughness:${rough[1]}};`);
 return(across,v,time,rate,photo=.5,footprint=.001)=>fn(...Object.values(helpers),across,v,time,rate,photo,footprint);
}
const fract=x=>x-Math.floor(x);
function fallHash([x,y]){let q=[fract(x*.1031),fract(y*.1031),fract(x*.1031)];const n=q[0]*(q[1]+33.33)+q[1]*(q[2]+33.33)+q[2]*(q[0]+33.33);q=q.map(v=>v+n);return fract((q[0]+q[1])*q[2]);}
function fallNoise([x,y]){const ix=Math.floor(x),iy=Math.floor(y);let fx=fract(x),fy=fract(y);fx=fx*fx*(3-2*fx);fy=fy*fy*(3-2*fy);const mix=(a,b,t)=>a+(b-a)*t;return mix(mix(fallHash([ix,iy]),fallHash([ix+1,iy]),fx),mix(fallHash([ix,iy+1]),fallHash([ix+1,iy+1]),fx),fy);}

test('actual emitted colour field is finite, bounded, connected across every joined mesh boundary and filtered under minification',()=>{
 const rate=cascade.cascadeFlowRate(flow.top,flow.bottom),fallback=colourEvaluator(next.selected.children[0].material),photoEval=colourEvaluator(nextPhoto.selected.children[0].material,true);
 let samples=0,joins=0;
 for(const fn of [fallback,photoEval])for(const t of [0,.37,1.7,17.23,600])for(let row=0;row<=64;row++)for(let col=0;col<=32;col++){
  const across=col/32,v=(row/64)**2,r=fn(across,v,t,rate,(col%3)*.5);
  for(const value of Object.values(r))assert(Number.isFinite(value),JSON.stringify({across,v,t,r}));
  assert(r.alpha>=0&&r.alpha<=.96+1e-12);assert(r.aeration>=0&&r.aeration<=1);assert(r.bulk>=0&&r.bulk<=1);assert(r.roughness>=0&&r.roughness<=1);
  if(col>0&&col<32)assert(r.alpha>.1,'Interior current does not become a permanent black slit');
  samples++;
 }
 const g=next.selected.children[0].geometry;
 for(let b=1;b<9;b++)for(let row=0;row<=64;row++){
  const s=row/64;if(cascade.cascadeBoundaryGap(b,s)!==0)continue;
  const left=(b-1)*65*5+row*5+4,right=b*65*5+row*5;
  const a=[g.attributes.cascadeAcross.getX(left),g.attributes.uv.getY(left)],c=[g.attributes.cascadeAcross.getX(right),g.attributes.uv.getY(right)];
  assert.deepEqual(a,c);
  for(const time of [0,.4,.8,1.7])assert.deepEqual(fallback(...a,time,rate),fallback(...c,time,rate));
  joins++;
 }
 const far=fallback(.31,.5,.7,rate,.5,.1);assert.equal(far.strand,.5);assert.equal(far.mist,.5);assert.equal(far.fine,.5);assert.equal(far.strandAA,0);assert.equal(far.mistAA,0);
 proof.field={samples,joinedBoundaryRows:joins,boundsFinite:true,wholeWidthSeamIndependent:true,minifiedDetailNeutral:true,derivatives:'fixed footprint input, not a GPU approximation'};
});

test('advected current markers follow existing gravity rate continuously without a per-frame phase reset',()=>{
 const fn=colourEvaluator(next.selected.children[0].material),rate=cascade.cascadeFlowRate(flow.top,flow.bottom),h=flow.top-flow.bottom;
 let tracks=0;
 for(const s0 of [.03,.16,.41])for(const dt of [.01,.07,.2]){
  const s1=s0+rate*dt;if(s1>=1)continue;
  const a=fn(.38,s0*s0,0,rate),b=fn(.38,s1*s1,dt,rate);
  for(const key of ['fallTravel','bulk','strand','fine','mist'])assert(Math.abs(a[key]-b[key])<1e-10,key);
  const d=.001,drop=t=>h*(s0+rate*t)**2,acc=(drop(dt+d)-2*drop(dt)+drop(dt-d))/(d*d);assert(Math.abs(acc-9.8)<1e-7);
  tracks++;
 }
 for(const t of [0,1/rate,10/rate,60]){const a=fn(.42,.4,t-1e-7,rate),b=fn(.42,.4,t+1e-7,rate);assert(Math.abs(a.alpha-b.alpha)<1e-5);}
 proof.motion={trackedMarkers:tracks,advection:'s-time*existingRate',worldAcceleration:9.8,noIntegratedFrameState:true,claim:'Scalar field continuity; actual image repeat/GLSL/motion must be inspected natively'};
});

test('bound proof can be exported without changing product or historical source guards',()=>{
 if(process.env.WATERFALL_PROOF_OUTPUT)fs.writeFileSync(process.env.WATERFALL_PROOF_OUTPUT,JSON.stringify(proof,null,2)+'\n');
});

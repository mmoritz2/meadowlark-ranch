import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import crypto from 'node:crypto';
import * as T from '../assets/vendor/three/build/three.module.js';
import {createRanchArchitecture} from '../assets/ranch-architecture.js';
import {createRanchBuilderArt} from '../assets/ranch-builder-art.js';
import {dressTimberBox} from '../assets/ranch-timber-joinery.mjs?v=ranch-timber-joinery-2';
import {setTimberBoxUV,applyTimberGrain} from '../assets/timber-cladding.mjs?v=timber-cladding-1';
import {recordSolidPart,createSolidWorld} from '../assets/solid-collisions.js?v=solid-world-1';
import {mergeGeometries} from '../assets/vendor/three/examples/jsm/utils/BufferGeometryUtils.js';
import {createDeferredLoad} from '../assets/deferred-load.js';
import {applySaplingSnowShader} from '../assets/sapling-snow.mjs?v=nursery-snow-1';
const sha=x=>crypto.createHash('sha256').update(x).digest('hex'),fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/ranch-joinery-b5d22a6.json',import.meta.url)));
function original(file){let s=fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');for(const c of fixture.sourceChanges.filter(c=>c.file===file).reverse()){assert.equal(s.split(c.after).length-1,1);s=s.replace(c.after,c.before);}assert.equal(sha(s),fixture.originalSHA256[file]);return s;}
const oldArchitecture=new Function('setTimberBoxUV','applyTimberGrain','recordSolidPart','return ('+original('assets/ranch-architecture.js').split('export function ')[1].replace(/^createRanchArchitecture/,'function createRanchArchitecture')+');')(setTimberBoxUV,applyTimberGrain,recordSolidPart);
const oldBuilder=new Function('setTimberBoxUV','applyTimberGrain','recordSolidPart','mergeGeometries','createDeferredLoad','applySaplingSnowShader','return ('+original('assets/ranch-builder-art.js').split('export function ')[1].replace(/^createRanchBuilderArt/,'function createRanchBuilderArt')+');')(setTimberBoxUV,applyTimberGrain,recordSolidPart,mergeGeometries,createDeferredLoad,applySaplingSnowShader);
const three={...T,TextureLoader:class{load(){return new T.Texture();}}},GLTFLoader=class{loadAsync(){throw Error('No downloads in the geometry fixture');}};
const seeded=make=>{const old=Math.random;let seed=0x791e9142,calls=0;Math.random=()=>{calls++;seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};try{const result=make(),future=Array.from({length:24},()=>Math.random());return{result,calls:calls-24,future};}finally{Math.random=old;}};
const models=f=>[f.buildBarn(),f.buildOpenStall(),f.buildOutbuilding(),f.buildCottage(),f.buildCoachingInn()];
const measures=g=>{let triangles=0,bytes=0,draws=0;g.traverse(o=>{if(o.isMesh){draws++;triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;bytes+=(o.geometry.index?.array.byteLength||0)+Object.values(o.geometry.attributes).reduce((s,a)=>s+a.array.byteLength,0);}});return{triangles,bytes,draws};};
let paired;
test('full original source bodies retain only the exact post-proxy hooks and surviving shared siding material edit',()=>{for(const f of Object.keys(fixture.originalSHA256))original(f);});
test('physical beveled boards have real separate joints, outward planar normals and exact authored bounds without RNG',()=>{
 for(const spec of[{width:7,height:3.62,depth:.18,x:0},{width:1.81,height:.52,depth:.085,x:0},{width:.038,height:3.4,depth:.029,x:.9},{width:.42,height:.30,depth:.18,x:-1.7},{width:100,height:3.2,depth:.18,x:13.1}]){
  const g=new T.BoxGeometry(spec.width,spec.height,spec.depth),uuid=g.uuid,box=g.boundingBox;const old=Math.random;Math.random=()=>{throw Error('Joinery consumed gameplay RNG');};try{dressTimberBox(T,g,{...spec,siding:true,radius:.003});}finally{Math.random=old;}
  assert.equal(g.uuid,uuid);assert.equal(g.index.count/3,g.userData.ranchTimberJoinery.boards*44);assert.equal(g.attributes.position.count,g.attributes.normal.count);assert.equal(g.attributes.position.count,g.attributes.uv.count);const p=g.attributes.position,n=g.attributes.normal;
  for(const a of Object.values(g.attributes))assert(Array.from(a.array).every(Number.isFinite));assert.equal(g.boundingBox.min.y,Math.fround(-spec.height/2));assert.equal(g.boundingBox.max.y,Math.fround(spec.height/2));
  assert.equal(g.boundingBox.min.x,Math.fround(-spec.width/2));assert.equal(g.boundingBox.max.x,Math.fround(spec.width/2));assert.equal(g.boundingBox.min.z,Math.fround(-spec.depth/2));assert.equal(g.boundingBox.max.z,Math.fround(spec.depth/2));
  for(let i=0;i<g.index.count;i+=3){const ids=[0,1,2].map(k=>g.index.getX(i+k)),a=new T.Vector3().fromBufferAttribute(p,ids[0]),b=new T.Vector3().fromBufferAttribute(p,ids[1]),c=new T.Vector3().fromBufferAttribute(p,ids[2]),face=b.sub(a).cross(c.sub(a));assert(face.length()>1e-9);face.normalize();for(const j of ids)assert(face.dot(new T.Vector3().fromBufferAttribute(n,j))>.9999);}
  assert.equal(g.userData.ranchTimberJoinery.triangles,g.userData.ranchTimberJoinery.boards*44);assert(g.userData.ranchTimberJoinery.boards<=48);if(spec.width>1)assert(g.userData.ranchTimberJoinery.boards>=6);g.dispose();
 }
});
test('actual five building factories retain constructor stream, every solid proxy, door/opening metadata and material/mesh owners',()=>{
 const make=(factory)=>seeded(()=>{const f=factory({THREE:T,loadTextures:false}),g=models(f);return{f,g};});const a=make(oldArchitecture),b=make(createRanchArchitecture);paired={old:a.result,new:b.result};assert.equal(b.calls,a.calls);assert.deepEqual(b.future,a.future);
 for(let i=0;i<a.result.g.length;i++){const x=a.result.g[i],y=b.result.g[i];assert.deepEqual(y.userData.solidParts,x.userData.solidParts);const xm=x.userData.architecture,ym=y.userData.architecture;assert.deepEqual({...ym,triangles:0},{...xm,triangles:0});assert.equal(y.uuid,x.uuid);assert.deepEqual(y.children.map(o=>[o.uuid,o.material.uuid,o.material.name]),x.children.map(o=>[o.uuid,o.material.uuid,o.material.name]));
  for(let k=0;k<x.children.length;k++){const before=x.children[k],after=y.children[k];if(before.material!==a.result.f.sidingMaterial){for(const n of Object.keys(before.geometry.attributes))assert.deepEqual(after.geometry.attributes[n].array,before.geometry.attributes[n].array);assert.deepEqual(after.geometry.index.array,before.geometry.index.array);}}
  const oldBox=new T.Box3().setFromObject(x),newBox=new T.Box3().setFromObject(y);assert.deepEqual(newBox,oldBox);const m=measures(y);assert(m.triangles<15000);assert(m.triangles-measures(x).triangles<10000);
 }
});
test('real builder factory preserves all valid rounded props and shared resources while limed siding survives material adoption',()=>{
 const make=(architecture,builder)=>seeded(()=>{const f=architecture({THREE:three}),b=builder({THREE:three,GLTFLoader,architecture:f,deferModels:true}),g=['wall','door','stall','shelter','fence','floor'].map(k=>b.create(k));return{f,b,g};});const a=make(oldArchitecture,oldBuilder),b=make(createRanchArchitecture,createRanchBuilderArt);assert.equal(b.calls,a.calls);assert.deepEqual(b.future,a.future);assert.equal(b.result.b.loaded,false);assert.equal(b.result.b.materialNames.length,a.result.b.materialNames.length);assert.deepEqual(b.result.b.models,a.result.b.models);
 for(let i=0;i<a.result.g.length;i++){const x=a.result.g[i],y=b.result.g[i];assert.deepEqual(y.userData,x.userData);const xs=[],ys=[];x.traverse(o=>{if(o.isMesh)xs.push(o);});y.traverse(o=>{if(o.isMesh)ys.push(o);});assert.equal(ys.length,xs.length);for(let k=0;k<xs.length;k++){assert.equal(ys[k].uuid,xs[k].uuid);assert.equal(ys[k].geometry.uuid,xs[k].geometry.uuid);assert.equal(ys[k].material.uuid,xs[k].material.uuid);for(const n of Object.keys(xs[k].geometry.attributes))assert.deepEqual(ys[k].geometry.attributes[n].array,xs[k].geometry.attributes[n].array);}}
 const f=b.result.f,old=a.result.f;assert.equal(f.sidingMaterial.map.uuid,old.sidingMaterial.map.uuid);assert.equal(f.sidingMaterial.normalMap.uuid,old.sidingMaterial.normalMap.uuid);assert.deepEqual(f.sidingMaterial.color,old.sidingMaterial.color);assert.equal(f.sidingMaterial.userData.limedTimberFinish.amount,.91);const sh={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};f.sidingMaterial.onBeforeCompile(sh);assert(sh.fragmentShader.includes('ranchCreamPigment'));assert(sh.fragmentShader.includes('diffuseColor.rgb=mix(diffuseColor.rgb,ranchCreamPigment,0.91000)'));assert(sh.fragmentShader.includes('ranchTimberSample( normalMap'));assert(!sh.vertexShader.includes('ranchCream'));const painted=b.result.g[0].children.find(m=>m.material.name==='Builder | limed timber');assert(painted);assert.equal(painted.material.userData.limedTimberFinish.amount,.88);assert.equal(f.sidingMaterial.roughness,old.sidingMaterial.roughness);
 for(const[name,m]of f.materials)if(m!==f.sidingMaterial)assert.deepEqual(m.color,old.materials.get(name).color);
});
test('unchanged solid snapshots retain real controller contacts and open stall access after arbitrary placement',()=>{
 for(let i=0;i<2;i++){const a=paired.old.g[i],b=paired.new.g[i];for(const g of[a,b]){g.position.set(-16,2,-14);g.rotation.y=.31;g.updateMatrixWorld(true);}
  const sa=createSolidWorld({THREE:T}),sb=createSolidWorld({THREE:T});sa.register(a,{primitives:true});sb.register(b,{primitives:true});assert.deepEqual(sb.stats(),sa.stats());
  for(let x=-21;x<-10;x+=.23)for(let z=-20;z<-7;z+=.29){const pa=new T.Vector3(x,2,z),pb=pa.clone();sa.resolve(pa,{radius:.55,bottom:2.38,top:4.65});sb.resolve(pb,{radius:.55,bottom:2.38,top:4.65});assert.deepEqual(pb,pa);}
 }
});
test('actual copied ghost hooks retain cream at original colour and preserve live red/green stock uniform tint',()=>{
 const f=createRanchArchitecture({THREE:three}),b=createRanchBuilderArt({THREE:three,GLTFLoader,architecture:f,deferModels:true});
 const physical=b.create('wall'),ghost=b.create('wall',true),painted=g=>g.children.find(m=>m.material.name==='Builder | limed timber'),p=painted(physical),g=painted(ghost),base=g.material.userData.limedTimberFinish.baseRGB;
 assert.equal(g.geometry,p.geometry);assert.notEqual(g.material,p.material);assert.equal(g.material.onBeforeCompile,p.material.onBeforeCompile);assert.equal(g.material.customProgramCacheKey(),p.material.customProgramCacheKey());assert.equal(g.material.opacity,.48);assert.equal(g.material.depthWrite,false);
 const compile=mat=>{const sh={uniforms:{diffuse:{value:mat.color}},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};mat.onBeforeCompile(sh);assert(sh.fragmentShader.includes('ranchCoatTint=clamp(diffuse/vec3('));assert(sh.fragmentShader.includes('*ranchCoatTint,0.0,1.0)'));return sh;};
 const original=compile(g.material),key=g.material.customProgramCacheKey();
 // Read the exact generated GLSL constants, then evaluate its stock-uniform
 // arithmetic. A regression to fixed pigment fails both tint dominance cases.
 const constants=original.fragmentShader.match(/ranchCoatTint=clamp\(diffuse\/vec3\(([^)]+)\)/)[1].split(',').map(v=>Math.fround(Number(v)));assert.deepEqual(constants,base);
 const pigment=[.78,.74,.65],coat=(diffuse,wear=.4)=>pigment.map((p,i)=>Math.max(0,Math.min(1,p*(.90+.10*Math.sqrt(Math.max(0,Math.min(1,wear*2))))*Math.max(0,Math.min(4,Math.fround(diffuse[i])/constants[i])))));
 const neutral=coat(base);assert(neutral.every((v,i)=>Math.abs(v-pigment[i]*(.90+.10*Math.sqrt(.8)))<1e-8));
 for(const[color,axis]of[[0xff2222,0],[0x22ff22,1]]){g.material.color.set(color);const sh=compile(g.material),rgb=coat(sh.uniforms.diffuse.value.toArray());assert(rgb[axis]>Math.max(...rgb.filter((_,i)=>i!==axis))*8);assert.equal(g.material.customProgramCacheKey(),key);assert.equal(g.material.opacity,.48);}
 // The tint is an existing live uniform. It must not require recompile, new
 // material, altered opacity or a changed preview geometry on mouse movement.
 assert.equal(compile(p.material).fragmentShader,original.fragmentShader);
});

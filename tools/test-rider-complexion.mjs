import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pathToFileURL,fileURLToPath} from 'node:url';
import path from 'node:path';

const runtime=process.env.RIDER_RUNTIME_ROOT||fileURLToPath(new URL('../',import.meta.url));
const owner=process.env.RIDER_COMPLEXION_SOURCE||path.join(runtime,'assets/rider-complexion.mjs');
const T=await import(pathToFileURL(path.join(runtime,'assets/vendor/three/build/three.module.js')));
const {finishRiderComplexion}=await import(pathToFileURL(owner));
const source=readFileSync(owner,'utf8');
const instances=[];
function rigFor(body='f'){
 const geometry=new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute([0,0,0,1,0,0,0,1,0],3));
 const skin=new T.Color('#744c3a'),eye=new T.Color('#8a6a2c');
 const headMaterial=new T.MeshPhysicalMaterial({color:0xffffff,roughness:.62,ior:1.4,specularIntensity:.32});
 const eyeMaterial=new T.MeshPhysicalMaterial({roughness:.25,ior:1.4,specularIntensity:.44,clearcoat:.30,clearcoatRoughness:.15});
 const rig={face:{geometry,material:headMaterial},eyes:{geometry,material:eyeMaterial},kit:{body,headAsset:{config:{target:body==='f'?[.034233,.099,.065]:[.032451,.094,.078],mouth:body==='f'?.0374:.0353}}},u:{uSkin:{value:skin},uEye:{value:eye},uFaceBind:{value:new T.Matrix4()}},mats:[headMaterial,eyeMaterial],dispose(){this.mats.forEach(m=>m.dispose());}};
 instances.push(rig);return rig;
}
function compile(material){const shader={uniforms:{},vertexShader:T.ShaderLib.physical.vertexShader,fragmentShader:T.ShaderLib.physical.fragmentShader};material.onBeforeCompile(shader);return shader;}
const occurrences=(s,x)=>s.split(x).length-1;

test('material adoption keeps the actual rider materials, geometry, ownership and appearance uniforms',()=>{
 const rig=rigFor(),face=rig.face.material,eyes=rig.eyes.material,geometry=rig.face.geometry,positions=geometry.attributes.position.array,mats=rig.mats;
 const materialState={side:face.side,depthTest:face.depthTest,depthWrite:face.depthWrite,transparent:face.transparent,opacity:face.opacity};
 assert.equal(finishRiderComplexion(rig),rig);assert.equal(rig.face.material,face);assert.equal(rig.eyes.material,eyes);
 assert.equal(rig.face.geometry,geometry);assert.equal(rig.eyes.geometry,geometry);assert.equal(geometry.attributes.position.array,positions);assert.equal(rig.mats,mats);
 for(const [key,value]of Object.entries(materialState))assert.equal(face[key],value,key);
 assert.equal(face.roughness,.62);assert.equal(face.ior,1.4);assert.equal(face.specularIntensity,.32,'Lower neck retains the established physical base response');
 for(const material of [face,eyes]){const shader=compile(material);for(const[key,value]of Object.entries(rig.u))assert.equal(shader.uniforms[key],value);}
 const shader=compile(face);rig.u.uSkin.value.set('#e2ae88');assert.equal(shader.uniforms.uSkin.value,rig.u.uSkin.value);
 const eyeShader=compile(eyes);rig.u.uEye.value.set('#4a7ec0');assert.equal(eyeShader.uniforms.uEye.value,rig.u.uEye.value);
});

test('female and male physical shader seams resolve once, preserve skinning and use independent program keys',()=>{
 const keys=[];
 for(const body of ['f','m']){
  const rig=finishRiderComplexion(rigFor(body));
  for(const [part,material]of [['head',rig.face.material],['eyes',rig.eyes.material]]){
   const shader=compile(material);keys.push(material.customProgramCacheKey());
   assert.equal(occurrences(shader.vertexShader,'#include <skinning_vertex>'),1);
   assert.equal(occurrences(shader.vertexShader,'#include <morphtarget_vertex>'),1);
   assert.equal(occurrences(shader.fragmentShader,'#include <map_fragment>'),1);
   assert.equal(occurrences(shader.fragmentShader,'#include <roughnessmap_fragment>'),1);
   assert.equal(occurrences(shader.fragmentShader,'#include <normal_fragment_maps>'),1);
   if(part==='head')assert(!/\bnormal\s*=/.test(source),'The existing authored normal path is untouched');
   assert.equal(occurrences(shader.fragmentShader,part==='head'?'float front=':'float iris='),1);
   assert(!/undefined|NaN|Infinity/.test(shader.vertexShader+shader.fragmentShader));
   assert(!/\btransformed\s*[+*=]|discard\s*;|gl_FragColor|diffuseColor\.a\s*=/.test(source));
  }
 }
 assert.equal(new Set(keys).size,4,'Every changed body/material owns a new cache program');
});

test('material finishing is idempotent, creates no resources, and leaves fallback riders alone',()=>{
 const rig=finishRiderComplexion(rigFor()),headHook=rig.face.material.onBeforeCompile,eyeHook=rig.eyes.material.onBeforeCompile,versions=[rig.face.material.version,rig.eyes.material.version];
 finishRiderComplexion(rig);assert.equal(rig.face.material.onBeforeCompile,headHook);assert.equal(rig.eyes.material.onBeforeCompile,eyeHook);assert.deepEqual([rig.face.material.version,rig.eyes.material.version],versions);
 assert.equal(finishRiderComplexion(null),null);const fallback={u:{}};assert.equal(finishRiderComplexion(fallback),fallback);
 assert(!/new\s+|\.clone\(|\.dispose\(|\.geometry\b|\.skeleton\b|\bfetch\(|texture2D|sampler2D/.test(source),'Finish owns no additional resource or geometry lifetime');
 let disposed=0;for(const material of rig.mats)material.addEventListener('dispose',()=>disposed++);rig.dispose();assert.equal(disposed,2,'The existing rider owns both material lifetimes');
});

test.after(()=>{for(const rig of instances){rig.face.geometry.dispose();rig.mats.forEach(m=>m.dispose());}});

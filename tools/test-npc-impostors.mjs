import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from '../assets/vendor/three/build/three.module.js';
import {createNPCImpostors} from '../assets/npc-impostors.js';
import {npcAppearance} from '../assets/npc-characters.js';
const manifest=JSON.parse(await readFile(new URL('../assets/models/npc-distance/manifest.json',import.meta.url))),settle=()=>new Promise(r=>setTimeout(r,0));
async function fixture(fn,{fail=false}={}){
 const oldFetch=globalThis.fetch,calls=[];globalThis.fetch=async()=>({ok:true,json:async()=>manifest});
 class Loader{async loadAsync(url){calls.push(url);if(fail)throw Error('offline');const tex=new T.Texture();tex.image={width:256,height:256};tex.userData.disposed=false;tex.addEventListener('dispose',()=>tex.userData.disposed=true);return tex;}}
 const system=createNPCImpostors({THREE:{...T,TextureLoader:Loader},maxBytes:700000,onError(){}});await system.ready;
 const create=id=>{const entry={def:{id},g:new T.Group()},h=system.create(entry,npcAppearance(entry.def));return {entry,h};};
 try{await fn({system,create,calls});}finally{system.dispose();globalThis.fetch=oldFetch;}
}
test('lazy paired atlases, deferred reveal, eviction and return do not leave stale pose state',()=>fixture(async({system,create,calls})=>{
 const a=create('wren'),b=create('june');assert.equal(calls.length,0);
 a.h.update(.1,{distance:100,show:true,speed:0});await settle();assert.equal(a.h.ready,true);assert.equal(a.h.root.visible,false);a.h.update(.1,{distance:100,show:true});assert.equal(a.h.root.visible,true);
 const original=a.h.root.children[0].material.map;a.h.update(.1,{distance:300,show:true});
 b.h.update(.1,{distance:100,show:true});await settle();system.endFrame();assert.equal(a.h.ready,false);assert.equal(original.userData.disposed,true);assert.doesNotThrow(()=>a.h.update(.1,{distance:300,show:true}));assert.ok(system.stats().bytes<=700000);
 b.h.update(.1,{distance:300,show:true});a.h.update(.1,{distance:100,show:true});await settle();a.h.update(.1,{distance:100,show:true});assert.equal(a.h.root.visible,true);assert.equal(system.stats().failed.length,0);assert.equal(calls.length,6);
}));
test('missing files fail once and appearance mismatch never loads a different identity',()=>fixture(async({system,create,calls})=>{
 const a=create('wren');a.h.update(.1,{distance:30,show:true});await settle();for(let i=0;i<5;i++)a.h.update(.1,{distance:30,show:true});await settle();assert.equal(calls.length,2);assert.equal(a.h.ready,false);assert.deepEqual(system.stats().failed,['wren']);
 const e={def:{id:'june'},g:new T.Group()},h=system.create(e,{...npcAppearance(e.def),shirt:'#000000'});h.update(.1,{distance:30,show:true});assert.deepEqual(system.stats().mismatched,['june']);assert.equal(calls.length,2);
},{fail:true}));
test('walking views choose both phases and resting residents use the standing row',()=>fixture(async({system})=>{
 const meta=manifest.entries.find(e=>e.poses===3),entry={def:{id:meta.id},g:new T.Group()},h=system.create(entry,meta.appearance);h.update(.1,{distance:70,show:true,speed:1.3});await settle();h.update(.1,{distance:70,show:true,speed:1.3});
 const mesh=h.root.children[0],shader={uniforms:{},vertexShader:'#include <begin_vertex>',fragmentShader:'#include <normal_fragment_maps>\n#include <lights_physical_fragment>\n#include <opaque_fragment>\n#include <alphatest_fragment>'};mesh.material.onBeforeCompile(shader,{getContext:()=>({getContextAttributes:()=>({antialias:false})})});
 const phases=new Set();for(let i=0;i<20;i++){h.update(.1,{distance:70,show:true,speed:1.3});phases.add(shader.uniforms.npcPose.value);}assert.deepEqual([...phases].sort(),[1,2]);h.update(.1,{distance:70,show:true,speed:0});assert.equal(shader.uniforms.npcPose.value,0);assert.equal(mesh.geometry.attributes.position.count,4);assert.equal(mesh.castShadow,false);
}));

test('nearby profiles stay pinned above a small target and unused profiles release immediately',()=>fixture(async({system,create})=>{
 const a=create('wren'),b=create('june');
 for(const x of[a,b])x.h.update(.1,{distance:100,show:true});await settle();system.endFrame();
 assert.equal(a.h.ready,true);assert.equal(b.h.ready,true);assert.ok(system.stats().pinnedBytes>system.stats().maxBytes);assert.equal(system.stats().bytes,system.stats().pinnedBytes);
 a.h.update(.1,{distance:300,show:true});system.endFrame();assert.equal(a.h.ready,false);assert.equal(b.h.ready,true);assert.ok(system.stats().bytes<=system.stats().maxBytes);
}));

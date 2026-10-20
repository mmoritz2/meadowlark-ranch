import test from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';
import * as T from '../assets/vendor/three/build/three.module.js';
import {createRanchArchitecture} from '../assets/ranch-architecture.js';
register(new URL('./fixtures/three-workshop-loader.mjs',import.meta.url));
const {createRanchBuilderArt}=await import('../assets/ranch-builder-art.js');

test('shared grandstand, shelter and stall stay visible in placements and ghosts through actual deferred factory replacement',async()=>{
 globalThis.document={createElement:()=>({getContext:()=>({fillText(){}})})};
 const FakeT={...T,TextureLoader:class{load(){return new T.Texture();}}},architecture=createRanchArchitecture({THREE:FakeT,loadTextures:false});
 const art=createRanchBuilderArt({THREE:FakeT,architecture,deferModels:true,GLTFLoader:class{async loadAsync(){throw Error('No external scans in this fixture');}}});
 const visible=root=>{const out=[];root.traverse(o=>{if(o.isMesh&&o.visible)out.push(o);});return out;};
 const pairs=['grandstand','shelter','stall'].map(type=>({type,placed:art.create(type),ghost:art.create(type,true)}));
 let residentDisposals=0;
 for(const pair of pairs){
  pair.parts=JSON.stringify(pair.placed.userData.solidParts);pair.geometry=visible(pair.placed).map(m=>m.geometry);
  assert.equal(pair.geometry.length,8);
  for(const g of pair.geometry)g.addEventListener('dispose',()=>residentDisposals++);
  for(const [i,m]of visible(pair.ghost).entries()){
   assert.equal(m.geometry,pair.geometry[i]);assert(m.material.transparent&&m.material.opacity<=.48);assert.equal(m.material.depthWrite,false);
   assert.equal(m.material.onBeforeCompile,visible(pair.placed)[i].material.onBeforeCompile);
  }
  assert(pair.ghost.userData.collisionIgnore);
 }
 art.startLoading();await art.ready;await new Promise(resolve=>setTimeout(resolve,20));
 for(const pair of pairs)for(const root of[pair.placed,pair.ghost,art.create(pair.type)]){
  assert.equal(JSON.stringify(root.userData.solidParts),pair.parts);
  assert.equal(visible(root).length,8);
  for(const [i,m]of visible(root).entries()){
   assert.equal(m.geometry,pair.geometry[i]);assert.equal(m.parent,root);
   assert(m.geometry.userData.estateGrandstandResident||m.geometry.userData.estateShelterResident);
  }
 }
 assert.equal(residentDisposals,0,'fallback retirement must not dispose the shared models');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';
import * as T from '../assets/vendor/three/build/three.module.js';
import {createRanchArchitecture} from '../assets/ranch-architecture.js';
register(new URL('./fixtures/three-workshop-loader.mjs',import.meta.url));
const {createRanchBuilderArt}=await import('../assets/ranch-builder-art.js');

test('real builder shares the upgraded stand with placed and preview instances across deferred template retirement',async()=>{
  globalThis.document={createElement:()=>({getContext:()=>({fillText(){}})})};
  const FakeT={...T,TextureLoader:class{load(){return new T.Texture();}}};
  const architecture=createRanchArchitecture({THREE:FakeT,loadTextures:false});
  const art=createRanchBuilderArt({THREE:FakeT,architecture,deferModels:true,
    GLTFLoader:class{async loadAsync(){throw Error('No external scans in this CPU fixture');}}});
  const placed=art.create('grandstand'),preview=art.create('grandstand',true);
  const visible=r=>r.children.filter(c=>c.isMesh&&c.visible);
  const parts=JSON.stringify(placed.userData.solidParts);
  const geometry=visible(placed).map(m=>m.geometry);
  assert.equal(geometry.length,8);
  let residentDisposals=0;geometry.forEach(g=>g.addEventListener('dispose',()=>residentDisposals++));
  for(const [i,mesh]of visible(preview).entries()){
    assert.equal(mesh.geometry,geometry[i]);assert(mesh.material.transparent&&mesh.material.opacity<=.48);
    assert.equal(mesh.material.depthWrite,false);
    assert.equal(mesh.material.onBeforeCompile,visible(placed)[i].material.onBeforeCompile);
  }
  assert.equal(preview.userData.collisionIgnore,true);
  art.startLoading();await art.ready;await new Promise(resolve=>setTimeout(resolve,20));
  const later=art.create('grandstand');
  for(const root of[placed,preview,later]){
    assert.equal(JSON.stringify(root.userData.solidParts),parts);
    assert.equal(root.userData.estateGrandstand.drawCalls,8);
    assert.equal(visible(root).length,8);
    for(const [i,mesh]of visible(root).entries()){
      assert.equal(mesh.geometry,geometry[i]);assert.equal(mesh.parent,root);
      assert.equal(mesh.geometry.userData.estateGrandstandResident,true);
    }
  }
  assert.equal(residentDisposals,0,'deferred retirement must preserve shared replacement geometry');
});

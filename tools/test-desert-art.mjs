import test from 'node:test';import assert from 'node:assert/strict';
import * as THREE from '../assets/vendor/three/build/three.module.js';import {createDesertArt}from '../assets/desert-art.js';
const art=createDesertArt({THREE});
test('all desert models have bounded finite geometry and share cached templates',()=>{
 for(const kind of ['saguaro','barrel','agave','ocotillo','rush'])for(const detail of[false,true]){
  const g=art.geometry(kind,0,detail);assert.equal(g,art.geometry(kind,0,detail));
  for(const a of Object.values(g.attributes))assert([...a.array].every(Number.isFinite));
  assert(g.index.count/3<7000);assert(g.boundingBox.min.y>=-.04);assert(g.boundingBox.max.y>.6&&g.boundingBox.max.y<1.05);
  const n=g.attributes.normal;for(let i=0;i<n.count;i++)assert(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))>.95);
 }
});
test('cactus geometry has outward faces and a closed, rounded crown',()=>{
 const m=art.create('saguaro').children[0];m.material=m.material.clone();m.material.side=THREE.FrontSide;m.updateMatrixWorld(true);
 const face=new THREE.Raycaster(new THREE.Vector3(0,.3,2),new THREE.Vector3(0,0,-1),0,4).intersectObject(m)[0];assert(face&&face.point.z>0&&face.face.normal.z>.3);
 const top=new THREE.Raycaster(new THREE.Vector3(0,2,.025),new THREE.Vector3(0,-1,0),0,3).intersectObject(m)[0];assert(top&&top.point.y>.98&&top.face.normal.y>.5);
});
test('mobile succulent models reduce geometry while retaining full height',()=>{
 for(const kind of['agave','ocotillo']){const hi=art.geometry(kind),lo=art.geometry(kind,0,false);assert(lo.index.count<hi.index.count*.4);assert(Math.abs(hi.boundingBox.max.y-lo.boundingBox.max.y)<.12);}
});
test('models are deterministic and cactus variants have different silhouettes',()=>{
 const other=createDesertArt({THREE});assert.deepEqual(art.geometry('saguaro').attributes.position.array,other.geometry('saguaro').attributes.position.array);
 assert.notDeepEqual(art.geometry('saguaro',0).attributes.position.array,art.geometry('saguaro',1).attributes.position.array);
});

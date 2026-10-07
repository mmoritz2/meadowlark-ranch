import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../assets/vendor/three/build/three.module.js';
import {createRanchArchitecture} from '../assets/ranch-architecture.js';
import {createSolidWorld} from '../assets/solid-collisions.js';
const art=createRanchArchitecture({THREE,loadTextures:false});
const firstHit=(root,x,y,z)=>new THREE.Raycaster(new THREE.Vector3(x,y,z),new THREE.Vector3(0,0,-1)).intersectObject(root,true)[0];

test('all cottage variants have recessed ground and dormer windows without roof occlusion',()=>{
 for(let variant=0;variant<4;variant++){
  const root=art.buildCottage({variant});root.updateMatrixWorld(true);
  for(const [x,y,z,front]of[[1.21,1.8,3,1.4],[variant%2?.67:.15,3.78,3,1.10]]){
   const hit=firstHit(root,x,y,z);
   assert.equal(hit?.object.material.name,'Ranch | window glass',`variant ${variant} window ${y}`);
   assert(hit.point.z<front-.04,'glass must sit behind the wall face');
  }
  const loft=new THREE.Raycaster(new THREE.Vector3(5,3.59,-.08),new THREE.Vector3(-1,0,0)).intersectObject(root,true)[0];
  assert.equal(loft?.object.material.name,'Ranch | window glass','loft opening must be cut through the gable');
  assert(loft.point.x<1.66);
  root.traverse(o=>{if(o.geometry)for(const a of Object.values(o.geometry.attributes))assert(Array.from(a.array).every(Number.isFinite));});
  const a=root.userData.architecture;
  assert(a.triangles<6000&&a.drawCalls<=16,'village detailing remains batched');
  assert(a.windowBoxes.every(b=>Math.abs(b.x)>.9),'planters leave the entrance corridor clear');
 }
});

test('shop facade retains its open door and mounted clearance under the awning',()=>{
 const root=art.buildOutbuilding({exterior:'village',animatedDoorOpening:{width:2.3,height:2.7}});
 root.updateMatrixWorld(true);
 const world=createSolidWorld({THREE});world.register(root);
 const rider={bottom:.38,top:2.65,radius:.55},position={x:0,z:3.8};
 for(let i=0;i<25;i++){position.z-=.12;assert.equal(world.resolve(position,rider),0,`door blocked at z=${position.z}`);}
 assert(position.z<1,'rider crosses the facade');
 const wall={x:1.8,z:1.7};assert(world.resolve(wall,rider)>0,'side of the doorway stays solid');
 // Decorative roofs still stop a flying mount descending onto them.
 const roof=world.limitVertical(0,0,8,2,2.3,.5);assert(roof>4&&roof<5);
});

test('two-storey village landmarks have open glazing, hipped roof coverage and batched detail',()=>{
 for(const [variant,width,depth,store]of[[1,5.4,3.8,true],[2,5,3.6,false],[0,5.8,4.2,false]]){
  const root=art.buildTownhouse({variant,width,depth,store});root.updateMatrixWorld(true);
  for(const [x,y]of[[width*.3+.13,1.92],[width*.3+.13,4.84]]){
   const hit=firstHit(root,x,y,depth/2+4);
   assert.equal(hit?.object.material.name,'Ranch | window glass');
   assert(hit.point.z<depth/2-.04,'windows are recessed into the plaster');
  }
  for(const x of[-width*.4,0,width*.4])for(const z of[-depth*.35,0,depth*.35]){
   const hit=new THREE.Raycaster(new THREE.Vector3(x,15,z),new THREE.Vector3(0,-1,0)).intersectObject(root,true)[0];
   assert(hit&&hit.point.y>=6.2,'roof covers the entire upper floor');
  }
  root.traverse(o=>{if(o.geometry)for(const a of Object.values(o.geometry.attributes))assert(Array.from(a.array).every(Number.isFinite));});
  const a=root.userData.architecture;
  assert(a.triangles<12000&&a.drawCalls<=16,'details stay within the village rendering budget');
  assert.equal(a.storeys,2);assert.equal(a.windowBoxes.length,4);
  const world=createSolidWorld({THREE});world.register(root);
  const body={bottom:.38,top:2.65,radius:.55};
  for(const x of[-width/2-.9,width/2+.9])for(let z=-depth/2-1;z<depth/2+2;z+=.25){
   const p={x,z};assert.equal(world.resolve(p,body),0,'side streets remain rideable');
  }
  if(store){const position={x:0,z:depth/2+2};for(let i=0;i<24;i++){position.z-=.12;assert.equal(world.resolve(position,body),0,'shop door and canopy keep mounted clearance');}}
  const wall={x:width*.3,z:depth/2+.2};assert(world.resolve(wall,body)>0,'facade is solid');
 }
});

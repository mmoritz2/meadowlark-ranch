import assert from 'node:assert/strict';
import test from 'node:test';
import * as T from '../assets/vendor/three/build/three.module.js';
import {createSolidWorld,recordSolidPart,circleContact} from '../assets/solid-collisions.js';
const material=new T.MeshStandardMaterial();
function part(root,w,h,d,x=0,y=h/2,z=0,ry=0){recordSolidPart(T,root,new T.BoxGeometry(w,h,d),material,new T.Matrix4().compose(new T.Vector3(x,y,z),new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),ry),new T.Vector3(1,1,1)));}
const rider={bottom:.38,top:2.65,radius:.55};
test('separate wall parts block the wall but retain a real doorway',()=>{
 const world=createSolidWorld({THREE:T}),root=new T.Group();part(root,3,4,.18,-2.5);part(root,3,4,.18,2.5);part(root,2,1,.18,0,3.5);world.register(root);
 const door={x:0,z:.01};assert.equal(world.resolve(door,rider),0);
 const wall={x:2,z:.3};assert(world.resolve(wall,rider)>0);assert(wall.z>=.64);
 const beam={x:0,z:0};assert(world.resolve(beam,{...rider,bottom:3,top:5})>0);
 assert.equal(world.resolve({x:2,z:0},{...rider,bottom:4.1,top:6.5}),0);
});
test('rotated/scaled pieces, hidden previews, movement and removal do not leave phantom barriers',()=>{
 const world=createSolidWorld({THREE:T}),scene=new T.Group(),root=new T.Group();part(root,4,2,.2);scene.add(root);root.rotation.y=Math.PI/4;root.position.set(12,5,4);root.scale.setScalar(1.4);world.register(root);
 const before=world.stats().parts;world.registerParts(scene);assert.equal(world.stats().parts,before);
 const p={x:12,z:4};assert(world.resolve(p,{bottom:5.4,top:7,radius:.5})>0);
 root.visible=false;assert.equal(world.resolve({x:12,z:4},{bottom:5.4,top:7}),0);root.visible=true;
 root.position.x=25;world.register(root);assert.equal(world.resolve({x:12,z:4},{bottom:5.4,top:7}),0);assert(world.resolve({x:25,z:4},{bottom:5.4,top:7})>0);
 world.unregister(root);assert.equal(world.stats().parts,0);assert.equal(world.resolve({x:25,z:4},{bottom:5.4,top:7}),0);
 root.userData.collisionIgnore=true;world.register(root);assert.equal(world.stats().parts,0);
});
test('high-speed substeps cannot tunnel through a thin panel; a jump clears a low rail',()=>{
 const world=createSolidWorld({THREE:T}),root=new T.Group();part(root,6,1.1,.055);world.register(root);
 const p={x:0,z:3};for(let i=0;i<40;i++){p.z-=.3;world.resolve(p,rider);}assert(p.z>=.577);
 const flying={x:0,z:0};assert.equal(world.resolve(flying,{...rider,bottom:1.45}),0);
});
test('descending and ascending mounts stop at the actual roof and underside',()=>{
 const world=createSolidWorld({THREE:T}),root=new T.Group();part(root,6,.2,5,0,6);world.register(root);
 assert(Math.abs(world.limitVertical(0,0,8,4,2.3)-6.1)<1e-6);
 assert(Math.abs(world.limitVertical(0,0,2,5,2.3)-3.6)<1e-6);
 assert.equal(world.limitVertical(12,0,8,4,2.3),4);
});
test('corner grazing resolves outward and an enclosed centre has a finite escape',()=>{
 const poly=[[-1,-1],[1,-1],[1,1],[-1,1]],corner=circleContact(poly,1.2,1.2,.5);assert(corner.x>0&&corner.z>0);
 const center=circleContact(poly,0,0,.5);assert(Number.isFinite(center.x+center.z));assert(Math.hypot(center.x,center.z)>1.5);
 assert.equal(circleContact(poly,1.6,1.6,.5),null);
});
test('a moving ferry carries its collision to the new location',()=>{
 const world=createSolidWorld({THREE:T}),root=new T.Group();root.userData.sceneryArt={kind:'ferry'};part(root,2,2,4);world.register(root);
 root.position.set(40,2,10);world.updateDynamic();assert.equal(world.resolve({x:0,z:0},rider),0);assert(world.resolve({x:40,z:10},{bottom:2.38,top:4.6,radius:.55})>0);
 world.unregister(root);root.position.x=60;world.updateDynamic();assert.equal(world.stats().parts,0);
});
test('streamed model retirement drops old barriers; render batching retains physical parts',()=>{
 const world=createSolidWorld({THREE:T}),scene=new T.Group(),old=new T.Group();part(old,2,2,2);scene.add(old);world.register(old);scene.remove(old);
 assert.equal(world.resolve({x:0,z:0},rider),0);world.refresh();assert.equal(world.stats().parts,0);
 const batched=new T.Group();part(batched,2,2,2);scene.add(batched);batched.userData.collisionBatched=true;world.register(batched);scene.remove(batched);assert(world.resolve({x:0,z:0},rider)>0);
});

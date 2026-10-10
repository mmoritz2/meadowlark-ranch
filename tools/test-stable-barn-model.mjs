import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../assets/vendor/three/build/three.module.js';
import {createRanchArchitecture} from '../assets/ranch-architecture.js';
import {createSolidWorld} from '../assets/solid-collisions.js';
const build=()=>createRanchArchitecture({THREE,loadTextures:false}).buildBarn();
const mounted={bottom:.38,top:2.65,radius:.55};

test('stable has finite solid surfaces, coherent normals and bounded original footprint/resources',()=>{
 const barn=build();barn.updateMatrixWorld(true);const a=barn.userData.architecture;
 assert.equal(a.kind,'barn');assert.equal(a.width,7);assert.equal(a.depth,5.5);
 assert(a.triangles<=5104);assert.equal(a.drawCalls,12);assert.equal(barn.children.length,12);
 const bounds=new THREE.Box3().setFromObject(barn);
 assert(bounds.min.x>=-3.94501&&bounds.max.x<=3.94501);
 assert(bounds.min.z>=-3.21301&&bounds.max.z<=3.21301);
 assert(bounds.min.y>=-.04001&&bounds.max.y<=6.15);
 let triangles=0;const p0=new THREE.Vector3(),p1=new THREE.Vector3(),p2=new THREE.Vector3(),cross=new THREE.Vector3(),average=new THREE.Vector3(),n=new THREE.Vector3();
 barn.traverse(mesh=>{if(!mesh.isMesh)return;const g=mesh.geometry,p=g.attributes.position,normal=g.attributes.normal;
  for(const attr of Object.values(g.attributes))assert(Array.from(attr.array).every(Number.isFinite));
  for(let i=0;i<normal.count;i++)assert(Math.abs(n.fromBufferAttribute(normal,i).length()-1)<1e-5);
  for(let i=0;i<g.index.count;i+=3){const ids=[0,1,2].map(k=>g.index.getX(i+k));
   p0.fromBufferAttribute(p,ids[0]);p1.fromBufferAttribute(p,ids[1]);p2.fromBufferAttribute(p,ids[2]);
   cross.crossVectors(p1.sub(p0),p2.sub(p0));assert(cross.length()>1e-9,'nondegenerate face');
   average.set(0,0,0);for(const id of ids)average.add(n.fromBufferAttribute(normal,id));
   assert(cross.dot(average)>0,'normal agrees with authored winding');triangles++;
  }
 });assert.equal(triangles,a.triangles);
});

test('all three sheltered bays admit mounted bodies behind the former wall plane',()=>{
 for(const angle of [0,.6]){
  const barn=build();barn.position.set(76,0,-74);barn.rotation.y=angle;barn.updateMatrixWorld(true);
  const world=createSolidWorld({THREE});world.register(barn,{primitives:true});
  const contact=(x,z)=>{const v=barn.localToWorld(new THREE.Vector3(x,0,z)),p={x:v.x,z:v.z};return world.resolve(p,mounted);};
  for(const x of [-2.23,0,2.23])for(let z=3.8;z>=2.449;z-=.05)assert.equal(contact(x,z),0,`clear bay ${x},${z}`);
  for(const x of [-2.23,0,2.23])assert(contact(x,2.05)>0,'actual closed inset frontage blocks');
  for(const x of barn.userData.architecture.porch.postX)assert(contact(x,2.85)>0,'physical post blocks');
  for(const side of [-1,1])assert(contact(side*3.7,-.55)>0,'side wall remains solid');
 }
});

test('front rays find real inset doors/windows, separate posts and an overhead roof',()=>{
 const barn=build();barn.updateMatrixWorld(true);
 const ray=(origin,direction)=>new THREE.Raycaster(new THREE.Vector3(...origin),new THREE.Vector3(...direction)).intersectObject(barn,true)[0];
 const door=ray([.35,1.4,6],[0,0,-1]);assert(door);assert(door.point.z<1.9&&door.point.z>1.60);
 assert.equal(door.object.material.name,'Ranch | oiled oak doors');
 for(const x of [-2.30,2.30]){const opening=ray([x+.06,2.40,6],[0,0,-1]);assert(opening);assert(opening.point.z<1.8&&opening.point.z>1.5);}
 for(const x of [-3.34,-1.12,1.12,3.34]){const post=ray([x,1.5,6],[0,0,-1]);assert(post.point.z>2.77&&post.point.z<2.80);}
 const roof=ray([0,2.8,2.5],[0,1,0]);assert(roof&&roof.point.y>3.45&&roof.point.y<4.1);
});

test('repeat factory builds retain exactly the same model and physical parts',()=>{
 const a=build(),b=build();assert.deepEqual(a.userData,b.userData);
 for(let i=0;i<a.children.length;i++){
  const x=a.children[i],y=b.children[i];assert.equal(x.material.name,y.material.name);
  assert.deepEqual(x.geometry.index.array,y.geometry.index.array);
  for(const key of Object.keys(x.geometry.attributes))assert.deepEqual(x.geometry.attributes[key].array,y.geometry.attributes[key].array);
 }
});

// Three UUIDs consume the same globally seeded source used by late decoration.
test('barn retains the historic UUID random budget for later world decoration',()=>{
 const a=createRanchArchitecture({THREE,loadTextures:false});
 const original=Math.random;let calls=0;Math.random=()=>{calls++;return .5;};
 try{a.buildBarn();assert.equal(calls,1764);}finally{Math.random=original;}
});

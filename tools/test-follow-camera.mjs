import assert from 'node:assert/strict';
import * as THREE from '../assets/vendor/three/build/three.module.js';
import {createFollowCamera} from '../assets/follow-camera.js';
const rig=createFollowCamera({THREE,groundHeight:()=>0}),wall=new THREE.Mesh(new THREE.BoxGeometry(6,5,.2),new THREE.MeshBasicMaterial());
wall.position.set(0,2.5,-3);rig.register(wall);
const subject=new THREE.Vector3(0,1.6,0),desired=new THREE.Vector3(0,2.6,-6),out=new THREE.Vector3();
assert.equal(rig.obstacleCount,1);
rig.resolve(subject,desired,out);assert(out.z>-2.6&&out.z<-2.4,'camera stops before wall with clearance');
const ray=new THREE.Raycaster(subject,out.clone().sub(subject).normalize(),0,subject.distanceTo(out));
assert.equal(ray.intersectObject(wall).length,0,'independent triangle ray does not cross wall');
for(let i=0;i<180;i++)rig.frame(subject,desired,out,1/60);
assert(subject.distanceTo(out)>4.8,'automatic orbit keeps horse framing distance');
ray.set(subject,out.clone().sub(subject).normalize());ray.far=subject.distanceTo(out);
assert.equal(ray.intersectObject(wall).length,0,'orbit sees subject without crossing wall');
for(let i=0;i<180;i++)rig.frame(subject,new THREE.Vector3(0,3,6),out,1/60);
assert(out.distanceTo(new THREE.Vector3(0,3,6))<.002,'camera recovers requested orbit after obstacle');
rig.resolve(subject,new THREE.Vector3(0,-2,2),out);assert(out.y>=.7,'ground clearance');
console.log('Camera wall clearance, independent sightline, orbit framing, recovery and ground clearance passed.');

// Exercise moving subjects, both travel directions, and the same final smoothing
// and collision recheck used in the game. Static wall tests missed corner snaps.
for(const name of ['wall','doorway','corner'])for(const sign of [-1,1]){
 const cameraRig=createFollowCamera({THREE,groundHeight:()=>0}),solids=[];
 const add=(w,h,d,x,y,z)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));mesh.position.set(x*sign,y,z);cameraRig.register(mesh);solids.push(mesh);};
 for(const x of name==='doorway'?[-3,3]:[0])add(name==='doorway'?3:6,5,.2,x,2.5,-3);
 if(name==='corner')add(.2,5,6,3,2.5,-3);
 const p=new THREE.Vector3(),wanted=new THREE.Vector3(),safe=new THREE.Vector3(),actual=new THREE.Vector3(-6*sign,2.6,name==='corner'?-5.2:-6),last=actual.clone();let maxStep=0;
 for(let i=0;i<700;i++){
  p.set((-6+i*.02)*sign,1.6,name==='corner'?.8:0);wanted.set(p.x,2.6,p.z-6);
  cameraRig.frame(p,wanted,safe,1/60);actual.lerp(safe,1-Math.exp(-5/60));cameraRig.resolve(p,actual,actual);
  ray.set(p,actual.clone().sub(p).normalize());ray.far=p.distanceTo(actual);
  assert.equal(ray.intersectObjects(solids).length,0,name+' moving camera keeps an independent clear sightline');
  if(i)maxStep=Math.max(maxStep,actual.distanceTo(last));last.copy(actual);
 }
 assert(maxStep<.45,`${name} direction ${sign} camera snapped ${maxStep.toFixed(3)} m in one frame`);
 console.log(`${name} direction ${sign}: largest camera step ${maxStep.toFixed(3)} m`);
}

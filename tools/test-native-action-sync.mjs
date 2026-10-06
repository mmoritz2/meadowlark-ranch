import test from 'node:test';
import assert from 'node:assert/strict';
import {nativeActionPacket,receiveNativeAction,syncNativeActionEmote,transformNativeActionReference,captureNativeActionSeat,nativeActionSeatRotation} from '../assets/native-action-runtime.mjs';
import * as THREE from '../assets/vendor/three/build/three.module.js';
function fixture(){
 const calls=[],state={action:null,transitioning:false};
 const motion={state,supportedActions:['rear','liedown'],actionDescriptor:t=>t==='rear'?{durationS:4}:t==='liedown'?{durationS:8,dismountedOnly:true}:null,
 startAction(type,{elapsedS=0}={}){calls.push([type,elapsedS]);state.action={type,timeS:elapsedS,durationS:4};return true;},cancelAction(){state.action=null;calls.push(['cancel']);}};
 return {rig:{heroMotion:motion},calls,state};
}
test('peer action starts at its sent elapsed time, repeated packets never restart it',()=>{
 const {rig,calls,state}=fixture();assert.equal(receiveNativeAction(rig,{seq:12,type:'rear',elapsedS:1.2}),true);
 state.action.timeS=1.5;syncNativeActionEmote(rig);assert.equal(rig.emote.t,1.5);
 assert.equal(receiveNativeAction(rig,{seq:12,type:'rear',elapsedS:1.2}),false);assert.equal(calls.length,1);
 assert.equal(receiveNativeAction(rig,{seq:13,type:'rear',elapsedS:0}),true);assert.equal(calls.filter(c=>c[0]==='rear').length,2);
});
test('older finishes and completed same-sequence packets cannot restart or cancel newer actions',()=>{
 const {rig,state}=fixture();receiveNativeAction(rig,{seq:12,type:'rear',elapsedS:0});
 assert.equal(receiveNativeAction(rig,{seq:11,type:null,elapsedS:0}),false);assert.equal(state.action.type,'rear');
 assert.equal(receiveNativeAction(rig,{seq:12,type:null,elapsedS:0}),true);
 assert.equal(receiveNativeAction(rig,{seq:12,type:'rear',elapsedS:1}),false);assert.equal(state.action,null);
});
test('unknown actions, expired clips, invalid clocks and parked-only actions are rejected',()=>{
 for(const patch of [{type:'missing'},{type:'liedown'},{elapsedS:NaN},{elapsedS:-1},{elapsedS:4},{seq:0},{seq:1.1}]){
  const {rig,calls}=fixture();assert.equal(receiveNativeAction(rig,{seq:2,type:'rear',elapsedS:0,...patch}),false);assert.equal(calls.length,0);
 }
});
test('UI follows the controller once and publishes an explicit completion sequence',()=>{
 const {rig,state}=fixture();rig.nativeActionSeq=20;state.action={type:'rear',timeS:2,durationS:4};rig.emote={type:'rear',native:true,t:0};
 assert.equal(syncNativeActionEmote(rig).timeS,2);assert.equal(rig.emote.t,2);assert.deepEqual(nativeActionPacket(rig),{seq:20,type:'rear',elapsedS:2});
 state.action=null;syncNativeActionEmote(rig);assert.equal(rig.emote,null);assert.deepEqual(nativeActionPacket(rig),{seq:20,type:null,elapsedS:0});
});
test('action hands follow their original rider frame at horse and pony scales without adding clearance twice',()=>{
 for(const scale of [.562,.664,1]){
  const home=new THREE.Vector3(.02,1.7*scale+.11,.1*scale-.02),q0=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),.2),local=new THREE.Vector3(.2,.35,.38),hand=local.clone().applyQuaternion(q0).add(home);
  const rider={_handFrame:{position:home,inverseRotation:q0.clone().invert()},g:{position:home.clone(),quaternion:q0.clone()}};
  assert(transformNativeActionReference(rider,hand,new THREE.Vector3()).distanceTo(hand)<1e-12);
  rider.g.position.add(new THREE.Vector3(0,.65,-.12));rider.g.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-.65));
  const expected=local.clone().applyQuaternion(rider.g.quaternion).add(rider.g.position);
  assert(transformNativeActionReference(rider,hand,new THREE.Vector3()).distanceTo(expected)<1e-12);
 }
});
test('seat rotation is relative to the mount at rest, during an action and through its final blend',()=>{
 const mount=new THREE.Group(),scene=new THREE.Group(),spine=new THREE.Bone(),seat=new THREE.Object3D();mount.add(scene);scene.add(spine);spine.add(seat);
 mount.rotation.set(.12,.7,-.02);scene.rotation.y=.5;scene.scale.setScalar(.664);spine.rotation.x=.15;
 const rig={scene,profile:{nativeKind:'horse'},nativeSeatFollower:seat,heroMotion:{state:{action:{type:'rear'},transitioning:false}}};
 captureNativeActionSeat(THREE,rig);rig.nativeActionSeatActive=true;
 const out=new THREE.Quaternion();nativeActionSeatRotation(THREE,rig,mount,out);assert(out.angleTo(new THREE.Quaternion())<1e-7);
 spine.rotation.x-=.6;nativeActionSeatRotation(THREE,rig,mount,out);assert(Math.abs(out.angleTo(new THREE.Quaternion())-.6)<1e-7);
 rig.heroMotion.state={action:null,transitioning:true};nativeActionSeatRotation(THREE,rig,mount,out);assert(rig.nativeActionSeatActive&&out.angleTo(new THREE.Quaternion())>.5);
 rig.heroMotion.state.transitioning=false;nativeActionSeatRotation(THREE,rig,mount,out);assert(!rig.nativeActionSeatActive&&out.angleTo(new THREE.Quaternion())===0);
});

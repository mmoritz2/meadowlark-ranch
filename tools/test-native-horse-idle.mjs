import assert from 'node:assert/strict';
import * as THREE from '../assets/vendor/three/build/three.module.js';
import {loadNativeHorseFixture} from './test-native-horse-actions.mjs';
import {createNativeHorseIdle} from '../assets/native-horse-idle.mjs';
import {createNativeHorseMotion} from '../assets/native-horse-motion.js';

const cases=[['bay-western','bay'],['bay-sporthorse-native','sporthorse']],reports=[];
const V=()=>new THREE.Vector3();
function skins(root){const out=[];root.traverse(o=>{if(o.isSkinnedMesh)out.push(o);});return out;}
function positions(mesh){const p=mesh.geometry.attributes.position;return Array.from({length:p.count},(_,i)=>mesh.applyBoneTransform(i,V().fromBufferAttribute(p,i)).applyMatrix4(mesh.matrixWorld));}
function locals(root){const out=[];root.traverse(o=>out.push([o,...o.position.toArray(),...o.quaternion.toArray(),...o.scale.toArray()]));return out;}
function assertRest(before,label){for(const [o,...values]of before)assert.deepEqual([...o.position.toArray(),...o.quaternion.toArray(),...o.scale.toArray()],values,label+' '+o.name);}
function inputState(root){return JSON.stringify(skins(root).map(m=>({geometry:m.geometry.uuid,attrs:Object.entries(m.geometry.attributes).map(([k,a])=>[k,Buffer.from(a.array.buffer,a.array.byteOffset,a.array.byteLength).toString('base64')]),bones:m.skeleton.bones.map(b=>[b.uuid,b.parent?.uuid]),binds:m.skeleton.boneInverses.map(m=>m.elements),bindMatrix:m.bindMatrix.elements})));}
for(const [id,file]of cases){
 const {root}=loadNativeHorseFixture('review/native-trot-reference-kit/'+file+'/model.glb'),profile={id,nativeBreed:true,nativeKind:'horse',nativeGaits:{},nativeHoofFlex:false},before=locals(root),immutable=inputState(root),bundle=createNativeHorseIdle({THREE,root,profile});
 assert(bundle&&bundle.clip.tracks.length===8,'Eight verified upper-body controls');assertRest(before,'Idle authoring does not move source rest');
 assert(!bundle.clip.tracks.some(t=>/pelvis|spine|clavicle|leg|arm|finger|toe|saddle|tail/i.test(t.name)),'No actor, spine, limb, saddle or body-weighted tail tracks');
 let maxCurveStepDeg=0;
 for(const t of bundle.clip.tracks){const size=t.getValueSize();assert(t.values.every(Number.isFinite));assert.deepEqual(t.values.slice(0,size),t.values.slice(-size),'Exact authored loop pose closure');if(size===4)for(let i=4;i<t.values.length;i+=4)maxCurveStepDeg=Math.max(maxCurveStepDeg,new THREE.Quaternion().fromArray(t.values,i-4).normalize().angleTo(new THREE.Quaternion().fromArray(t.values,i).normalize())*180/Math.PI);}
 assert(maxCurveStepDeg<.5,'Restrained adjacent ear/head changes');
 const meshes=skins(root),baseline=meshes.map(positions),bodyIndex=meshes.findIndex(m=>m.geometry.attributes.position.count===16159),floor=Math.min(...baseline[bodyIndex].map(p=>p.y));
 const protectedBones=root.getObjectByName('saddle_0333').parent.children.filter(b=>b.name==='saddle_0333').concat(['clavicle_l_0203','clavicle_r_0269','upperleg_l_0405','upperleg_r_0474'].map(n=>root.getObjectByName(n))),protectedWorld=protectedBones.map(b=>b.matrixWorld.clone());
 const head=root.getObjectByName('head_019'),headInverse=head.matrixWorld.clone().invert(),mixer=new THREE.AnimationMixer(root),action=mixer.clipAction(bundle.clip);action.play();
 const stats={id,phases:97,soleVertices:baseline[bodyIndex].filter(p=>p.y<floor+.25).length,maxFeetDeltaM:0,maxTreadDeltaM:0,maxSaddleDeltaM:0,maxBodyDeltaM:0,maxBitDeltaM:0,maxBitAttachmentErrorM:0,maxEyeAttachmentErrorM:0,minFloorDeltaM:Infinity,maxCurveStepDeg};
 for(let sample=0;sample<stats.phases;sample++){
  mixer.setTime(sample/(stats.phases-1)*bundle.clip.duration);root.updateMatrixWorld(true);
  protectedBones.forEach((b,i)=>assert.deepEqual(b.matrixWorld.elements,protectedWorld[i].elements,'Saddle/limb root world matrix remains exact'));
  const headDelta=new THREE.Matrix4().multiplyMatrices(head.matrixWorld,headInverse);
  meshes.forEach((mesh,mi)=>{const current=positions(mesh),count=current.length;for(let i=0;i<count;i++){
   const p=current[i],rest=baseline[mi][i],delta=p.distanceTo(rest);assert(p.toArray().every(Number.isFinite),'Full skin remains finite');
   if(mi===bodyIndex){stats.maxBodyDeltaM=Math.max(stats.maxBodyDeltaM,delta);stats.minFloorDeltaM=Math.min(stats.minFloorDeltaM,p.y-floor);if(rest.y<floor+.25)stats.maxFeetDeltaM=Math.max(stats.maxFeetDeltaM,delta);}
   if(count===5092)stats.maxSaddleDeltaM=Math.max(stats.maxSaddleDeltaM,delta);
   if(count===2028)stats.maxEyeAttachmentErrorM=Math.max(stats.maxEyeAttachmentErrorM,p.distanceTo(rest.clone().applyMatrix4(headDelta)));
   if(count===13895){if(i>=2792&&i<=2845||i>=2716&&i<=2769)stats.maxTreadDeltaM=Math.max(stats.maxTreadDeltaM,delta);if(i>=7894&&i<=8124||i>=6954&&i<=7184){stats.maxBitDeltaM=Math.max(stats.maxBitDeltaM,delta);stats.maxBitAttachmentErrorM=Math.max(stats.maxBitAttachmentErrorM,p.distanceTo(rest.clone().applyMatrix4(headDelta)));}}
  }});
 }
 assert.equal(stats.maxFeetDeltaM,0,'Every sampled original low foot vertex remains exact');assert.equal(stats.maxTreadDeltaM,0,'Both actual skinned stirrup treads remain exact');assert(stats.minFloorDeltaM>=-1e-12,'No new floor penetration');
 assert(stats.maxSaddleDeltaM<.002,'Weighted chest breathing keeps original saddle deformation below 2 mm');assert(stats.maxBodyDeltaM>.003&&stats.maxBodyDeltaM<.012,'Expression visibly moves upper skin within a 12 mm bound');assert(stats.maxBitDeltaM<.012,'Moving bridle bit stays within restrained head-motion envelope');assert(stats.maxBitAttachmentErrorM<1e-6,'Original bridle bit follows head without independent contact drift');assert(stats.maxEyeAttachmentErrorM<1e-7,'Eyes follow head exactly without independent drift');
 action.stop();mixer.uncacheRoot(root);assertRest(before,'Direct expression mixer restores exact original values');assert.equal(inputState(root),immutable,'Geometry, weights, hierarchy and inverse binds stay unchanged');

 // Real native controller and groom, with an isolated source gait on the real
 // skin. Its samples must stay byte-identical and its playback must fully own
 // the pose after a stand transition. Existing action authoring is not stubbed.
 const ear=root.getObjectByName('ear_01_l_051'),neck=root.getObjectByName('neck_03_016'),target=neck.quaternion.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),.03));
 const walk=new THREE.AnimationClip('Fixture source gait',1,[new THREE.QuaternionKeyframeTrack(neck.name+'.quaternion',[0,1],[...target.toArray(),...target.toArray()])]),sourceClips=[walk],sourceCopy=JSON.stringify(walk.toJSON());
 const motion=createNativeHorseMotion({THREE,root,clips:sourceClips,profile:{...profile,nativeGaits:{walk:{clip:walk.name,durationS:1,nominalSpeedMps:1}}},deferGroom:true});
 motion.reset();const controllerRest=locals(root);
 assert.equal(motion.hasAmbientIdle,true);assert.equal(motion.state.hasAmbientIdle,true);assert.equal(motion.mode,'rest');assert.equal(motion.clip,null,'Diagnostic rest is not relabeled as an authored idle');
 motion.set('stand');for(let i=0;i<180;i++){motion.update(1/60);motion.finishGroomPose();}assert.equal(motion.mode,'stand');assert.equal(motion.clip,bundle.clip.name);assert(motion.state.groomInertia?.finite);
 const standing=neck.quaternion.clone();motion.set('walk');assert(neck.quaternion.equals(standing),'Selecting gait causes no immediate pose snap');for(let i=0;i<20;i++){motion.update(1/60);motion.finishGroomPose();}
 assert(neck.quaternion.angleTo(target)<1e-6,'Source gait fully owns neck after idle fade');assert(ear.quaternion.toArray().every((v,i)=>Math.abs(v-before.find(r=>r[0]===ear)[i+4])<1e-7),'Ear attention binding restores on gait');assert.equal(motion.state.activeActions,1);
 for(const [name]of [['chestiddleslider_00_0191'],['chestiddleslider_01_r_0194'],['chestiddleslider_02_0197'],['chestiddleslider_01_l_0200']]){const row=before.find(r=>r[0].name===name);assert(root.getObjectByName(name).position.distanceTo(new THREE.Vector3(...row.slice(1,4)))<1e-7,'Breathing binding restored on gait');}
 motion.set('stand');motion.update(.1);motion.startAction('nuzzle');for(let i=0;i<20;i++){motion.update(1/60);motion.finishGroomPose();}assert.equal(motion.action.type,'nuzzle');assert.equal(motion.state.activeActions,1,'Interrupted stand fades entirely into actual one-shot action');
 motion.cancelAction();motion.set('rest');motion.update(.25);motion.finishGroomPose();assert.equal(motion.mode,'rest');assert.equal(motion.clip,null);assert.equal(motion.state.activeActions,1);
 motion.reset();assertRest(controllerRest,'Reset returns the existing Float32 diagnostic rest');motion.set('stand');motion.update(.2);motion.finishGroomPose();motion.dispose();motion.dispose();assertRest(before,'Idempotent dispose restores original skeleton');
 assert.equal(sourceClips.length,1);assert.equal(JSON.stringify(walk.toJSON()),sourceCopy,'Original source clip tracks/times are immutable');assert.equal(inputState(root),immutable);reports.push(stats);
}
const {root}=loadNativeHorseFixture('review/native-trot-reference-kit/white/model.glb');
for(const profile of [{id:'white-western',nativeBreed:true,nativeKind:'horse',nativeIdleClip:'Horse|Horse_Idle'},{id:'bay-western',nativeBreed:true,nativeKind:'horse',nativeIdleClip:'Existing source Idle'},{id:'black-dragon-native',nativeBreed:true,nativeKind:'black-dragon'},{id:'bay',nativeBreed:true,nativeKind:'horse',nativeRoster:true}])assert.equal(createNativeHorseIdle({THREE,root,profile}),null,'Creator-idle, dragon and roster profiles are untouched');
// A supplied source Idle still owns stand on a real horse; a non-horse
// controller takes its unchanged creator-animation branch.
for(const nativeKind of ['horse','black-dragon']){
 const {root:sourceRoot}=loadNativeHorseFixture('review/native-trot-reference-kit/white/model.glb'),bone=sourceRoot.getObjectByName('head_019'),q=bone.quaternion.clone();
 const existing=new THREE.AnimationClip('Existing source Idle',2,[new THREE.QuaternionKeyframeTrack(bone.name+'.quaternion',[0,2],[...q.toArray(),...q.toArray()])]),serial=JSON.stringify(existing.toJSON());
 const motion=createNativeHorseMotion({THREE,root:sourceRoot,clips:[existing],profile:{id:'white-western',nativeBreed:true,nativeKind,nativeIdleClip:existing.name,nativeHoofFlex:false,nativeGaits:{}}});
 assert.equal(motion.hasAmbientIdle,false);motion.set('stand');motion.update(.3);assert.equal(motion.clip,existing.name);assert.equal(JSON.stringify(existing.toJSON()),serial);motion.dispose();
}
assert.equal(createNativeHorseIdle({THREE,root:new THREE.Group(),profile:{id:'bay-western',nativeBreed:true,nativeKind:'horse'}}),null,'Unverified rig fails closed');
console.log(JSON.stringify(reports,null,2));
console.log('PASS native Bay idle: actual full-skin feet/floor/tack checks, immutable source, stand-only playback, interruptions, rest, reset/disposal and excluded profiles');

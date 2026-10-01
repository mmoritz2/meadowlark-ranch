import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {createBreedLibrary} from '../../assets/breed-models.js';
import * as current from '../../assets/native-horse-motion.js?transition-review=1';
import * as before from './before-controller.mjs';
const lib=createBreedLibrary({THREE,GLTFLoader,clone});await lib.manifestReady;
const assets={};for(const key of ['white-western','bay-western','black-dragon-native','european-dragon'])assets[key]=await lib.load(key);
const quaternionStep=(a,b)=>2*Math.acos(Math.min(1,Math.abs(a.dot(b))/Math.sqrt(a.lengthSq()*b.lengthSq())))*180/Math.PI;
function capture(rig,low,motion){
 rig.scene.updateMatrixWorld(true);for(const mesh of low.keys())mesh.skeleton.update();
 const p=new THREE.Vector3();let floor=Infinity;for(const[mesh,ids]of low)for(const id of ids){mesh.getVertexPosition(id,p);p.applyMatrix4(mesh.matrixWorld);floor=Math.min(floor,p.y);}
 return {quaternions:rig.bones.map(b=>b.quaternion.clone()),finite:rig.bones.every(b=>b.matrixWorld.elements.every(Number.isFinite)),floor,seat:rig.nativeSeatFollower.getWorldPosition(new THREE.Vector3()).toArray(),state:motion.snapshot(),clip:motion.clip,actorPosition:rig.scene.position.toArray(),actorQuaternion:rig.scene.quaternion.toArray()};
}
window.transitionRun=async(version,breed,scenario)=>{
 const rig=lib.instantiate(assets[breed]);rig.scene.position.set(4,0,-3);rig.scene.updateMatrixWorld(true);
 const low=new Map(),p=new THREE.Vector3();rig.scene.traverse(mesh=>{if(mesh.isSkinnedMesh){mesh.skeleton.update();const ids=[];for(let i=0;i<mesh.geometry.attributes.position.count;i++){mesh.getVertexPosition(i,p);p.applyMatrix4(mesh.matrixWorld);if(p.y<.25)ids.push(i);}if(ids.length)low.set(mesh,ids);}});
 const module=version==='before'?before:current,motion=module.createNativeHorseMotion({THREE,root:rig.nativeRoot,clips:rig.animations,profile:rig.profile});
 const advance=dt=>version==='before'?motion.update(dt*scenario.rate):motion.update(dt,{rate:scenario.rate});
 motion.set(scenario.from,{lead:scenario.fromLead||'left'});for(let i=0;i<30;i++)advance(.01);
 if(motion.clip){const action=motion.mixer.clipAction(THREE.AnimationClip.findByName(rig.animations,motion.clip));action.time=scenario.phase*action.getClip().duration;motion.mixer.update(0);}
 const start=capture(rig,low,motion),rest=rig.bones.map(b=>[b.position.toArray(),b.quaternion.toArray(),b.scale.toArray()]);
 motion.set(scenario.to,{lead:scenario.toLead||'left'});const switched=capture(rig,low,motion);
 const instantJointStep=Math.max(...start.quaternions.map((q,i)=>quaternionStep(q,switched.quaternions[i]))),rows=[];let last=switched;
 for(let i=1;i<=48;i++){
  if(scenario.interrupt&&i===10)motion.set(scenario.interrupt,{lead:'left'});
  advance(1/120);const row=capture(rig,low,motion);
  rows.push({timeS:i/120,floor:row.floor,maxJointStep:Math.max(...last.quaternions.map((q,j)=>quaternionStep(q,row.quaternions[j]))),finite:row.finite,seat:row.seat,state:row.state,clip:row.clip,actorPosition:row.actorPosition,actorQuaternion:row.actorQuaternion});last=row;
 }
 const summary={version,breed,scenario,sourceSha256:rig.profile.sha256,bones:rig.bones.length,instantJointStep,maxFrameJointStep:Math.max(...rows.map(r=>r.maxJointStep)),minimumFloorM:Math.min(start.floor,switched.floor,...rows.map(r=>r.floor)),finite:rows.every(r=>r.finite),actorUnchanged:rows.every(r=>r.actorPosition.join()===start.actorPosition.join()&&r.actorQuaternion.join()===start.actorQuaternion.join()),transitionFinishS:rows.find(r=>!r.state.transitioning&&r.timeS>=.01)?.timeS||null,final:rows.at(-1),rows};
 motion.reset();summary.resetRestFallback=motion.snapshot().restFallback??true;motion.dispose();return summary;
};
window.transitionReady=true;document.querySelector('#status').textContent='Native transition QA ready: preserved real White/Bay/dragon assets, original tack and seat.';

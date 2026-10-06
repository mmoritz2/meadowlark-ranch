import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import * as THREE from '../assets/vendor/three/build/three.module.js';

// Exercise the real mixer/controller with a tiny skeleton and an isolated clip
// generator dependency. Visual quality of the full 677-joint clips has its own
// asset review; these fixtures make lifecycle failures small and reproducible.
const file=new URL('../assets/native-horse-motion.js',import.meta.url);
let source=await readFile(file,'utf8');
source=source.replace(/import \{createNativeHorseActionClips\} from '[^']+';/,
 'const createNativeHorseActionClips=({profile})=>profile.testActionBundle||{clips:[],actions:{}};');
source=source.replace(/from '(\.\/[^']+)'/g,(_,path)=>`from '${new URL(path,file).href}'`);
const {createNativeHorseMotion,tickNativeHorse,startNativeHorseJump}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));

function fixture(){
 const root=new THREE.Group(),bone=new THREE.Bone();bone.name='TestHorse';root.add(bone);
 const clip=(name,duration,y)=>new THREE.AnimationClip(name,duration,[new THREE.VectorKeyframeTrack('TestHorse.position',[0,duration/2,duration],[0,0,0,0,y,0,0,0,0])]);
 const actionBundle={clips:[clip('Native Rear',1,1),clip('Native Graze',1.4,-.2),clip('Native Lie',2,-.6)],actions:{rear:{clip:'Native Rear',durationS:1,label:'Rear'},graze:{clip:'Native Graze',durationS:1.4},liedown:{clip:'Native Lie',durationS:2,dismountedOnly:true}}};
 const profile={id:'test',nativeBreed:true,nativeKind:'horse',nativeHoofFlex:false,nativeMaxSpeedMps:3,testActionBundle:actionBundle,nativeGaits:{walk:{clip:'Walk',durationS:1,nominalSpeedMps:1},trot:{clip:'Trot',durationS:.72,nominalSpeedMps:2}},nativeJump:{clip:'Jump',durationS:1,flightStartS:.2,flightEndS:.8,actorLiftM:[[0,0],[.5,.5],[1,0]]}};
 const clips=[clip('Walk',1,.01),clip('Trot',.72,.02),clip('Jump',1,.1)];
 const before=JSON.stringify(profile),m=createNativeHorseMotion({THREE,root,clips,profile}),rig={profile,heroMotion:m,scene:root};
 assert.equal(JSON.stringify(profile),before,'Building local action records never mutates the shared profile');
 return{root,bone,m,rig};
}

test('actions are separate from gait modes and descriptors are defensive copies',()=>{
 const {m}=fixture();
 assert.deepEqual(m.supportedActions,['rear','graze','liedown']);
 assert.deepEqual(m.availableModes,['rest','stand','walk','trot','jump']);
 assert.equal(m.supportsAction('rear'),true);assert.equal(m.supportsAction('toString'),false);
 assert.equal(m.actionDescriptor('liedown').dismountedOnly,true);
 const d=m.actionDescriptor('rear');d.durationS=99;assert.equal(m.actionDescriptor('rear').durationS,1);
 assert.equal(m.startAction('unknown'),false);assert.equal(m.startAction('rear',{elapsedS:NaN}),false);
 assert.equal(m.startAction('rear',{elapsedS:1}),false);assert.equal(m.state.action,null);
 m.dispose();
});

test('one-shot actions use wall time, complete once, and recover the standing pose',()=>{
 const {m,rig,bone}=fixture();
 assert.equal(m.startAction('rear'),true);assert.equal(m.startAction('graze'),false);
 assert.equal(m.mode,'action');assert.equal(m.clip,'Native Rear');
 m.update(.4,{rate:0,direction:-1});assert.equal(m.action.timeS,.4);assert.equal(m.action.progress,.4);
 assert(bone.position.y>.79);assert.equal(m.state.grounded,true);
 tickNativeHorse(rig,0,.6);assert.equal(m.action,null);assert.equal(m.mode,'stand');
 assert.equal(rig.heroJumpAge,null);assert.equal(rig.heroJumpExtra,0);
 tickNativeHorse(rig,0,.21);assert.equal(m.state.activeActions,1);assert.equal(m.state.transitioning,false);
 assert(Math.abs(bone.position.y)<1e-8);tickNativeHorse(rig,0,4);assert.equal(m.action,null);
 m.dispose();
});

test('network elapsed time seeks within a one-shot and does not alter the profile',()=>{
 const {m,rig,bone}=fixture();
 assert.equal(m.startAction('rear',{elapsedS:.5}),true);
 tickNativeHorse(rig,0,.2);assert(Math.abs(m.action.timeS-.7)<1e-8);assert(bone.position.y>.59);
 tickNativeHorse(rig,0,.31);assert.equal(m.action,null);assert.equal(m.mode,'stand');
 m.dispose();
});

test('cancellation and retrigger during fade preserve the outgoing pose',()=>{
 const {m,bone}=fixture();
 m.startAction('rear');m.update(.4);const before=bone.position.y;
 assert.equal(m.cancelAction(),true);assert.equal(m.cancelAction(),false);assert.equal(m.action,null);
 m.update(.02);const fading=bone.position.y;assert(Math.abs(fading-before)<.1);
 assert.equal(m.startAction('rear'),true);assert.equal(m.action.timeS,0);
 m.update(0);assert(Math.abs(bone.position.y-fading)<1e-8,'Restarting does not reset the outgoing mixer instance');
 m.update(.2);assert.equal(m.state.activeActions,1);assert(Number.isFinite(bone.position.y));
 m.update(.8);m.update(.21);assert.equal(m.state.activeActions,1);assert(Math.abs(bone.position.y)<1e-8);
 for(let i=0;i<8;i++){m.startAction('rear');m.update(.3);m.cancelAction();m.update(.01);}
 m.update(.21);assert.equal(m.state.activeActions,1);assert.equal(m.mixer.stats.actions.inUse,1);
 m.dispose();
});

test('movement, reverse and flight interrupt stationary actions through the normal gait blend',()=>{
 for(const trigger of ['travel','reverse','flight']){
  const {m,rig}=fixture();m.startAction('graze');tickNativeHorse(rig,0,.3);assert.equal(m.action.type,'graze');
  if(trigger==='reverse')rig.nativeReverse=true;if(trigger==='flight')rig.nativeFlying=true;
  tickNativeHorse(rig,trigger==='travel'?1:0,.05);assert.equal(m.action,null);assert.equal(m.state.transitioning,true);
  assert.equal(m.mode,trigger==='travel'?'walk':'stand');m.dispose();
 }
});

test('jump and horse action cannot run concurrently',()=>{
 const {m,rig}=fixture();m.startAction('rear');
 assert.equal(startNativeHorseJump(rig),false);assert.equal(m.action.type,'rear');
 m.cancelAction();m.update(.21);assert.equal(startNativeHorseJump(rig),true);
 assert.equal(m.startAction('graze'),false);tickNativeHorse(rig,1,1.1);assert.equal(m.action,null);
 assert.equal(m.startAction('graze'),true);m.dispose();
});

test('reset and dispose clear active and fading actions and restore finite rest transforms',()=>{
 const {m,root,bone}=fixture();m.startAction('rear');m.update(.4);m.cancelAction();m.startAction('rear');m.update(.05);
 m.reset();assert.equal(m.action,null);assert.equal(m.mode,'rest');assert.equal(m.state.activeActions,1);assert.equal(bone.position.y,0);
 assert(root.matrixWorld.elements.every(Number.isFinite));assert.equal(m.startAction('rear'),true);
 m.dispose();m.dispose();assert.equal(bone.position.y,0);assert.equal(m.mixer.stats.actions.inUse,0);
 assert.throws(()=>m.startAction('rear'),/disposed/);
});

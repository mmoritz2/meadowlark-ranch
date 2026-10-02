import assert from 'node:assert/strict';
import * as THREE from '../assets/vendor/three/build/three.module.js';
import {createNativeHorseMotion,tickNativeHorse,startNativeHorseJump,sampleNativeJumpLift,getNativeHorseCapabilities} from '../assets/native-horse-motion.js';
const root=new THREE.Group(),bone=new THREE.Bone();bone.name='TestHorse';root.add(bone);
const clip=(name,duration,y=0)=>new THREE.AnimationClip(name,duration,[new THREE.VectorKeyframeTrack('TestHorse.position',[0,duration/2,duration],[0,0,0,0,y,0,0,0,0])]);
const clips=[clip('Trot',.72,.02),clip('CanterL',.64,.03),clip('CanterR',.64,.03),clip('GallopL',.62,.04),clip('GallopR',.62,.04),clip('Jump',1.65,.1)];
const profile={id:'test',nativeBreed:true,nativeKind:'horse',nativeHoofFlex:false,nativeMaxSpeedMps:3,nativeGaits:{trot:{clip:'Trot',durationS:.72,nominalSpeedMps:1.8},canterLeft:{clip:'CanterL',durationS:.64,nominalSpeedMps:2.1},canterRight:{clip:'CanterR',durationS:.64,nominalSpeedMps:2.1},gallopLeft:{clip:'GallopL',durationS:.62,nominalSpeedMps:3},gallopRight:{clip:'GallopR',durationS:.62,nominalSpeedMps:3}},nativeJump:{clip:'Jump',durationS:1.65,flightStartS:.28,flightEndS:1.08,actorLiftM:[[0,0],[.28,0],[.68,.7848],[1.08,0],[1.65,0]]}};
const m=createNativeHorseMotion({THREE,root,clips,profile}),rig={profile,heroMotion:m,scene:root};
assert.deepEqual(m.availableModes,['rest','stand','trot','canter','gallop','jump']);
m.set('gallop',{lead:'right'});m.update(.3);assert.equal(m.clip,'GallopR');assert.equal(m.state.lead,'right');
assert.equal(startNativeHorseJump(rig),true);assert.equal(startNativeHorseJump(rig),false);assert.equal(m.mode,'jump');
tickNativeHorse(rig,3,.68);assert(Math.abs(rig.heroJumpExtra-.7848)<1e-6);assert.equal(m.state.grounded,false);assert.equal(m.state.gait,'jump');assert.equal(m.state.speedMps,3);assert.equal(rig.phase,m.state.phase01);
tickNativeHorse(rig,3,1);assert.equal(m.mode,'gallop');assert.equal(m.state.lead,'right');assert.equal(rig.heroJumpAge,null);assert.equal(rig.heroJumpExtra,0);
// A new press while the previous jump action is fading must restart its clock.
assert.equal(startNativeHorseJump(rig),true);assert.equal(m.time,0);tickNativeHorse(rig,2,.05);assert(m.time<.051);
m.set('stand');m.update(.3);tickNativeHorse(rig,4.5,.3,-.5);assert.equal(m.clip,'GallopR');assert(m.state.activeActions<=2);
const cap=getNativeHorseCapabilities(rig);assert.equal(cap.canGallop,true);assert.equal(cap.canJump,true);
assert.equal(cap.maxSpeedMps,6);assert.equal(rig.heroRate,1.5);assert.equal(m.state.speedMps,4.5);
// Faster travel advances the same stride clock, including actor scale. Source
// measurements stay unchanged instead of being rewritten as gameplay speeds.
const previousTime=m.time;tickNativeHorse(rig,4.5,.1,-.5);
assert(Math.abs((m.time-previousTime+.62)%.62-.15)<1e-7);
assert.equal(profile.nativeGaits.gallopLeft.nominalSpeedMps,3);
root.scale.setScalar(.5);root.updateMatrixWorld(true);tickNativeHorse(rig,2.25,.1);
assert.equal(getNativeHorseCapabilities(rig).maxSpeedMps,3);assert.equal(rig.heroRate,1.5);
root.scale.setScalar(1);root.updateMatrixWorld(true);
rig.nativeRequestedGait='trot';tickNativeHorse(rig,3,.3);assert.equal(m.mode,'trot');assert.equal(rig.heroRate,3/1.8);
rig.nativeRequestedGait='canterLeft';tickNativeHorse(rig,5,.3);assert.equal(m.mode,'gallop'); // Still too fast to drop to canter.
tickNativeHorse(rig,3.8,.3);assert.equal(m.mode,'canter');assert.equal(rig.heroRate,3.8/2.1);
tickNativeHorse(rig,100,.3);assert.equal(m.mode,'gallop');assert.equal(rig.heroRate,2);assert.equal(m.state.speedMps,6);
const dragonCap=getNativeHorseCapabilities({profile:{nativeBreed:true,nativeKind:'european-dragon',nativeMaxSpeedMps:2,nativeGaits:{run:{nominalSpeedMps:2}}},scene:root});
assert.equal(dragonCap.maxSpeedMps,2);assert.equal(dragonCap.cadenceLimit,1);
assert.equal(sampleNativeJumpLift(profile.nativeJump,2),0);assert.equal(sampleNativeJumpLift(profile.nativeJump,-1),0);assert(Math.abs(sampleNativeJumpLift(profile.nativeJump,.48)-.3924)<1e-8);
m.reset();assert.equal(m.mode,'rest');assert.equal(m.state.bodyLiftM,0);assert(root.matrixWorld.elements.every(Number.isFinite));m.dispose();console.log('Native canter/gallop leads, one-shot jump, repeated press, lift clock, recovery and capabilities passed.');

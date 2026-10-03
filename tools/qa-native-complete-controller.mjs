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
m.set('stand');m.update(.3);tickNativeHorse(rig,15,.3,-.5);assert.equal(m.clip,'GallopR');assert(m.state.activeActions<=2);
const cap=getNativeHorseCapabilities(rig);assert.equal(cap.canGallop,true);assert.equal(cap.canJump,true);
assert.equal(cap.maxSpeedMps,20.25);assert.equal(rig.heroRate,1.8);assert.equal(m.state.speedMps,15);
// Faster gameplay travel deliberately keeps a bounded visual cadence. Preserve
// measured source metadata and report the absence of exact contact matching.
assert.equal(cap.contactSpeedMatched,false);
const previousTime=m.time;tickNativeHorse(rig,15,.1,-.5);
assert(Math.abs((m.time-previousTime+.62)%.62-.18)<1e-7);
assert.equal(profile.nativeGaits.gallopLeft.nominalSpeedMps,3);
root.scale.setScalar(.5);root.updateMatrixWorld(true);tickNativeHorse(rig,13.5,.1);
assert(Math.abs(getNativeHorseCapabilities(rig).maxSpeedMps-18.225)<1e-9);assert.equal(rig.heroRate,1.8);
root.scale.setScalar(1);root.updateMatrixWorld(true);
rig.nativeRequestedGait='trot';tickNativeHorse(rig,5,.3);assert.equal(m.mode,'trot');assert.equal(rig.heroRate,5/4.2*1.5);
rig.nativeRequestedGait='canterLeft';tickNativeHorse(rig,15,.3);assert.equal(m.mode,'gallop');
tickNativeHorse(rig,9,.3);assert.equal(m.mode,'canter');assert.equal(rig.heroRate,9/7.5*1.6);
tickNativeHorse(rig,100,.3);assert.equal(m.mode,'gallop');assert.equal(rig.heroRate,2);assert.equal(m.state.speedMps,20.25);
const dragonCap=getNativeHorseCapabilities({profile:{nativeBreed:true,nativeKind:'european-dragon',nativeMaxSpeedMps:2,nativeGaits:{run:{nominalSpeedMps:2}}},scene:root});
assert.equal(dragonCap.maxSpeedMps,2);assert.equal(dragonCap.cadenceLimit,1);
assert.equal(sampleNativeJumpLift(profile.nativeJump,2),0);assert.equal(sampleNativeJumpLift(profile.nativeJump,-1),0);assert(Math.abs(sampleNativeJumpLift(profile.nativeJump,.48)-.3924)<1e-8);
// Equipped stats raise travel limits without speeding animation past its cap.
rig.nativeTravelStatFactor=1.4;rig.nativeRequestedGait='gallopLeft';tickNativeHorse(rig,100,.3);
assert(Math.abs(getNativeHorseCapabilities(rig).maxSpeedMps-28.35)<1e-8);assert.equal(rig.heroRate,2);
// Jump gear lifts the actor while preserving the authored pose and landing.
const sourceLift=JSON.stringify(profile.nativeJump.actorLiftM);
assert(startNativeHorseJump(rig,{heightScale:1.25}));tickNativeHorse(rig,3,.68);
assert(Math.abs(rig.heroJumpExtra-.7848*1.25)<1e-6);assert(Math.abs(m.state.bodyLiftM-.7848)<1e-6);
assert.equal(startNativeHorseJump(rig,{heightScale:1.5}),false);assert.equal(rig.nativeJumpHeightScale,1.25,'A held press cannot change height mid-jump');
tickNativeHorse(rig,3,1);assert.equal(rig.heroJumpExtra,0);assert.equal(rig.heroJumpAge,null);
assert.equal(JSON.stringify(profile.nativeJump.actorLiftM),sourceLift);
m.reset();assert.equal(m.mode,'rest');assert.equal(m.state.bodyLiftM,0);assert(root.matrixWorld.elements.every(Number.isFinite));m.dispose();console.log('Native canter/gallop leads, one-shot jump, repeated press, lift clock, recovery and capabilities passed.');

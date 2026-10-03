import assert from 'node:assert/strict';
import * as THREE from '../assets/vendor/three/build/three.module.js';
import {createNativeHorseMotion,tickNativeHorse,getNativeHorseCapabilities} from '../assets/native-horse-motion.js';
const root=new THREE.Group(),bone=new THREE.Bone();bone.name='Dragon';root.add(bone);
const pose=(name,y)=>new THREE.AnimationClip(name,1,[new THREE.VectorKeyframeTrack('Dragon.position',[0,.5,1],[0,y,0,0,y+.1,0,0,y,0])]);
const clips=[pose('Idle',0),pose('Walk',.1),pose('Run',.2),pose('Fly',2)];
const profile={id:'dragon-test',nativeBreed:true,nativeKind:'european-dragon',nativeCanFly:true,nativeIdleClip:'Idle',nativeMaxSpeedMps:2,nativeTravelSpeeds:{walk:2.6,run:10,fly:20},nativePlaybackRates:{walk:1,run:1.15},nativeFlightRate:1.7,nativeGaits:Object.fromEntries([['walk','Walk',1],['run','Run',2],['fly','Fly',3]].map(([key,clip,nominalSpeedMps])=>[key,{clip,nominalSpeedMps,durationS:1}]))};
const motion=createNativeHorseMotion({THREE,root,clips,profile}),rig={profile,scene:root,heroMotion:motion};
motion.set('stand');motion.update(.4);
const before=bone.position.clone();motion.set('fly');assert.equal(bone.position.distanceTo(before),0,'switch must not snap source pose');
motion.update(.03);assert(bone.position.y<.15,'takeoff pose starts gradually');
// Interrupt a partial transition; it must begin from its current blended pose.
motion.update(.15);const interrupted=bone.position.clone();motion.set('run');assert.equal(bone.position.distanceTo(interrupted),0);
motion.update(.01);assert(bone.position.distanceTo(interrupted)<.1,'interrupted blend stays continuous');
motion.update(.7);assert.equal(motion.state.activeActions,1,'completed fades release outgoing actions');
rig.nativeFlying=true;tickNativeHorse(rig,0,.7);const phase=motion.state.phase01;tickNativeHorse(rig,0,.1);
assert(Math.abs((motion.state.phase01-phase+1)%1-.17)<1e-7,'hover wings advance at full cadence');
assert.equal(motion.mode,'fly');assert.equal(rig.heroRate,1.7);assert.equal(motion.state.grounded,false);
// Only a profile opting into the landing fold may gather before contact.
rig.nativeLanding=true;rig.nativeAltitude=.3;tickNativeHorse(rig,0,.1);assert.equal(motion.mode,'fly','European flight remains unchanged');
profile.nativeLandingBlendHeightM=.45;profile.nativeLandingBlendS=.8;
rig.nativeAltitude=.6;tickNativeHorse(rig,0,.1);assert.equal(motion.mode,'fly','high descent keeps wingbeats');
rig.nativeAltitude=.3;tickNativeHorse(rig,0,.1);assert.equal(motion.mode,'stand');assert(rig.nativeLandingPose&&rig.nativeFlying,'folding must not stop descent physics');assert.equal(motion.state.transitionDurationS,.8);
const landingPose=bone.position.clone();rig.nativeLanding=false;tickNativeHorse(rig,0,0);assert.equal(motion.mode,'fly');assert.equal(bone.position.distanceTo(landingPose),0,'cancel landing preserves the current blend');
tickNativeHorse(rig,0,.7);assert.equal(motion.mode,'fly');assert(!rig.nativeLandingPose,'a low hover keeps moving wings');
rig.nativeFlying=false;rig.nativeRequestedGait='walk';tickNativeHorse(rig,2.2,.7);assert.equal(motion.mode,'walk');
rig.nativeRequestedGait='run';tickNativeHorse(rig,6.8,.4);assert.equal(motion.mode,'run');assert(rig.heroRate<1,'ordinary run stays below sprint cadence');
const cap=getNativeHorseCapabilities(rig);assert.equal(cap.maxSpeedMps,10);assert.equal(cap.flightMaxSpeedMps,20);assert.equal(cap.contactSpeedMatched,false);
// Low-altitude wing clearance follows the actual blend, including reversal,
// without changing the source bone transforms or accumulating root offsets.
const actor=new THREE.Group(),normalization=new THREE.Group();actor.add(normalization);normalization.add(root);rig.scene=actor;rig.nativeRoot=root;
profile.nativeFlightBlendClearanceM=.55;profile.nativeTranslation=[0,.02,0];normalization.position.y=.02;
rig.nativeFlying=true;rig.nativeLanding=false;rig.nativeAltitude=2;tickNativeHorse(rig,0,.7);assert.equal(rig.nativePoseLiftM,0,'clear flight adds no lift');
rig.nativeLanding=true;rig.nativeAltitude=.1;tickNativeHorse(rig,0,.4);assert(rig.nativePoseLiftM>.4,'low landing clears intermediate wing sweep');
const liftedY=normalization.position.y;rig.nativeLanding=false;tickNativeHorse(rig,0,0);assert.equal(normalization.position.y,liftedY,'cancel preserves clearance without a position jump');
tickNativeHorse(rig,0,.7);assert.equal(normalization.position.y,.02,'completed flight releases compensation');
rig.nativeFlying=false;rig.nativeAltitude=0;tickNativeHorse(rig,0,1);assert.equal(normalization.position.y,.02,'settled ground uses original normalization');
assert.throws(()=>motion.update(-1));motion.reset();assert.equal(motion.mode,'rest');assert.equal(bone.position.y,0);motion.dispose();
console.log('Dragon interrupted blends, hover cadence, ground gait selection, travel caps and reset passed.');

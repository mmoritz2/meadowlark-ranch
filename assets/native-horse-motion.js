import {createNativeHorseExpression} from './native-horse-expression.mjs?v=horse-expression-1';
import {createNativeHorseIdle} from './native-horse-idle.mjs?v=horse-polish-20261008';
import {createNativeGroomLayer} from './native-groom-layer.mjs?v=equestrian-style-20261012-native-riding-locks-1';
import {prepareNativeHoofFlex} from './native-hoof-flex.mjs?v=native-roster-1';
import {createNativeHorseActionClips} from './native-horse-actions.mjs?v=horse-life-20261009';
import {NATIVE_GROOM_AUDIT} from './native-groom-controls.mjs?v=native-secondary-1';
import {NATIVE_HOOF_CONTROLS} from './native-hoof-controls.mjs?v=native-hoof-flex-2';

// Only the 129 audited terminal joints of these exact native horse sources.
// Their animated parents and every world-matrix/palette update remain live.
const NATIVE_TERMINAL_SOURCES=new Set(["b188f5ea0c985c673c678daebf5e36daa1147a18693cec15ecc1bca439740a07","611b009fcdd348f8e5ccd58be7d9e3bc6829a54180bf94ef59abeba281272979","feb8e040cfb385eafade0bcfa03e6dcde5b5a5b48589074960a8cba9329d707f"]);
const NATIVE_TERMINAL_PAIRS=`ankle_middleslider_00_out_l_end_end_end_0649 ankle_middleslider_00_out_l_end_end_0434
ankle_middleslider_00_out_r_end_end_end_0663 ankle_middleslider_00_out_r_end_end_0503
ankle_middleslider_01_out_l_end_end_end_0650 ankle_middleslider_01_out_l_end_end_0438
ankle_middleslider_01_out_r_end_end_end_0664 ankle_middleslider_01_out_r_end_end_0506
bottomlip_end_end_end_0550 bottomlip_end_end_026
breeching_end_end_end_0674 breeching_end_end_0545
chestiddleslider_00_end_end_end_0594 chestiddleslider_00_end_end_0193
chestiddleslider_01_l_end_end_end_0597 chestiddleslider_01_l_end_end_0202
chestiddleslider_01_r_end_end_end_0595 chestiddleslider_01_r_end_end_0196
chestiddleslider_02_end_end_end_0596 chestiddleslider_02_end_end_0199
dyn_bounce_tail_08_back_end_end_end_0643 dyn_bounce_tail_08_back_end_end_0404
dyn_bounce_tail_08_front_end_end_end_0622 dyn_bounce_tail_08_front_end_end_0397
dyn_bounce_tail_08_left_end_end_end_0640 dyn_bounce_tail_08_left_end_end_0383
dyn_bounce_tail_08_right_end_end_end_0621 dyn_bounce_tail_08_right_end_end_0390
dyn_head_end_left_03_end_end_end_0552 dyn_head_end_left_03_end_end_037
dyn_head_end_right_03_end_end_end_0551 dyn_head_end_right_03_end_end_032
dyn_new_head_neck_03_end_end_end_0563 dyn_new_head_neck_03_end_end_077
dyn_new_neck_02_04_end_end_end_0585 dyn_new_neck_02_04_end_end_0162
dyn_new_neck_03_04_end_end_end_0584 dyn_new_neck_03_04_end_end_0156
dyn_new_neck_041_04_end_end_end_0576 dyn_new_neck_041_04_end_end_0123
dyn_new_neck_04_04_end_end_end_0578 dyn_new_neck_04_04_end_end_0132
dyn_new_neck_05_03_end_end_end_0573 dyn_new_neck_05_03_end_end_0111
dyn_new_rivet_neck_04_04_end_end_end_0579 dyn_new_rivet_neck_04_04_end_end_0138
dyn_tail_08_end_end_end_0639 dyn_tail_08_end_end_0376
dynamic_sim_space_end_end_end_0589 dynamic_sim_space_end_end_0176
ear_02_l_end_end_end_0557 ear_02_l_end_end_054
ear_02_r_end_end_end_0558 ear_02_r_end_end_058
elbow_middleslider_00_out_l_end_end_end_0603 elbow_middleslider_00_out_l_end_end_0233
elbow_middleslider_00_out_r_end_end_end_0618 elbow_middleslider_00_out_r_end_end_0299
elbow_middleslider_01_out_l_end_end_end_0604 elbow_middleslider_01_out_l_end_end_0237
elbow_middleslider_01_out_r_end_end_end_0619 elbow_middleslider_01_out_r_end_end_0303
eyeend_l_end_end_end_0559 eyeend_l_end_end_062
eyeend_r_end_end_end_0560 eyeend_r_end_end_066
fingers_02_middleslider_00_out_l_end_end_end_0599 fingers_02_middleslider_00_out_l_end_end_0216
fingers_02_middleslider_00_out_r_end_end_end_0614 fingers_02_middleslider_00_out_r_end_end_0282
fingers_02_middleslider_02_out_l_end_end_end_0600 fingers_02_middleslider_02_out_l_end_end_0220
fingers_02_middleslider_02_out_r_end_end_end_0615 fingers_02_middleslider_02_out_r_end_end_0286
fingers_end_l_end_end_end_0598 fingers_end_l_end_end_0211
fingers_end_r_end_end_end_0613 fingers_end_r_end_end_0277
foot_twist_l_end_end_end_0651 foot_twist_l_end_end_0421
foot_twist_r_end_end_end_0665 foot_twist_r_end_end_0509
hand_twist_l_end_end_end_0605 hand_twist_l_end_end_0240
hand_twist_r_end_end_end_0620 hand_twist_r_end_end_0306
head_middleslider_00_end_end_end_0553 head_middleslider_00_end_end_041
head_middleslider_01_l_end_end_end_0556 head_middleslider_01_l_end_end_050
head_middleslider_01_r_end_end_end_0554 head_middleslider_01_r_end_end_044
head_middleslider_02_end_end_end_0555 head_middleslider_02_end_end_047
hip_middleslider_00_out_l_end_end_end_0657 hip_middleslider_00_out_l_end_end_0465
hip_middleslider_00_out_r_end_end_end_0671 hip_middleslider_00_out_r_end_end_0533
hip_middleslider_01_out_l_end_end_end_0658 hip_middleslider_01_out_l_end_end_0469
hip_middleslider_01_out_r_end_end_end_0672 hip_middleslider_01_out_r_end_end_0537
hip_middleslider_02_out_l_end_end_end_0659 hip_middleslider_02_out_l_end_end_0473
hip_middleslider_02_out_r_end_end_end_0673 hip_middleslider_02_out_r_end_end_0542
jaw_end_end_end_end_0549 jaw_end_end_end_023
knee_middleslider_00_out_l_end_end_end_0654 knee_middleslider_00_out_l_end_end_0453
knee_middleslider_00_out_r_end_end_end_0668 knee_middleslider_00_out_r_end_end_0521
knee_middleslider_01_out_l_end_end_end_0653 knee_middleslider_01_out_l_end_end_0449
knee_middleslider_01_out_r_end_end_end_0667 knee_middleslider_01_out_r_end_end_0517
lowerarm_middleslider_00_out_l_end_end_end_0606 lowerarm_middleslider_00_out_l_end_end_0245
lowerarm_middleslider_00_out_r_end_end_end_0601 lowerarm_middleslider_00_out_r_end_end_0311
lowerarm_middleslider_01_out_l_end_end_end_0607 lowerarm_middleslider_01_out_l_end_end_0249
lowerarm_middleslider_01_out_r_end_end_end_0602 lowerarm_middleslider_01_out_r_end_end_0315
lowerarm_twist_01_l_end_end_end_0608 lowerarm_twist_01_l_end_end_0252
lowerarm_twist_01_r_end_end_end_0623 lowerarm_twist_01_r_end_end_0318
lowerarm_twist_02_l_end_end_end_0609 lowerarm_twist_02_l_end_end_0256
lowerarm_twist_02_r_end_end_end_0624 lowerarm_twist_02_r_end_end_0321
lowereyelid_l_end_end_end_0567 lowereyelid_l_end_end_091
lowereyelid_r_end_end_end_0569 lowereyelid_r_end_end_097
lowerleg_twist_l_end_end_end_0652 lowerleg_twist_l_end_end_0444
lowerleg_twist_r_end_end_end_0666 lowerleg_twist_r_end_end_0512
mountpoint_01_end_end_end_0634 mountpoint_01_end_end_0352
mouthcorner_l_end_end_end_0571 mouthcorner_l_end_end_0103
mouthcorner_r_end_end_end_0570 mouthcorner_r_end_end_0100
neckOff_middleslider_00_end_end_end_0593 neckOff_middleslider_00_end_end_0189
neckOff_middleslider_01_l_end_end_end_0591 neckOff_middleslider_01_l_end_end_0183
neckOff_middleslider_01_r_end_end_end_0592 neckOff_middleslider_01_r_end_end_0186
neck_01_middleslider_01_end_end_end_0588 neck_01_middleslider_01_end_end_0173
neck_02_middleslider_02_end_end_end_0590 neck_02_middleslider_02_end_end_0179
neck_03_middleslider_00_end_end_end_0580 neck_03_middleslider_00_end_end_0141
neck_03_middleslider_01_end_end_end_0561 neck_03_middleslider_01_end_end_0144
neck_04_middleslider_01_end_end_end_0577 neck_04_middleslider_01_end_end_0126
outernostril_l_end_end_end_0564 outernostril_l_end_end_081
outernostril_r_end_end_end_0565 outernostril_r_end_end_085
reins_01_inner_l_end_end_end_0629 reins_01_inner_l_end_end_0341
reins_01_inner_r_end_end_end_0631 reins_01_inner_r_end_end_0349
reins_01_outer_l_end_end_end_0587 reins_01_outer_l_end_end_0169
reins_01_outer_r_end_end_end_0586 reins_01_outer_r_end_end_0165
reins_01_posFix_l_end_end_end_0633 reins_01_posFix_l_end_end_05
reins_01_posFix_r_end_end_end_0632 reins_01_posFix_r_end_end_02
reins_02_l_end_end_end_0562 reins_02_l_end_end_0147
reins_02_r_end_end_end_0583 reins_02_r_end_end_0150
reins_03_l_end_end_end_0574 reins_03_l_end_end_0114
reins_03_r_end_end_end_0575 reins_03_r_end_end_0117
reins_04_l_end_end_end_0540 reins_04_l_end_end_069
reins_04_r_end_end_end_0541 reins_04_r_end_end_072
rootmountpoint_01_end_end_end_0675 rootmountpoint_01_end_end_0548
spine_01_middleslider_00_end_end_end_0635 spine_01_middleslider_00_end_end_0356
spine_01_middleslider_01_l_end_end_end_0637 spine_01_middleslider_01_l_end_end_0362
spine_01_middleslider_01_r_end_end_end_0638 spine_01_middleslider_01_r_end_end_0365
spine_01_middleslider_02_end_end_end_0636 spine_01_middleslider_02_end_end_0359
stirrup_02_l_end_end_end_0628 stirrup_02_l_end_end_0337
stirrup_02_r_end_end_end_0630 stirrup_02_r_end_end_0345
toes_01_middleslider_00_out_l_end_end_end_0647 toes_01_middleslider_00_out_l_end_end_0425
toes_01_middleslider_00_out_r_end_end_end_0661 toes_01_middleslider_00_out_r_end_end_0494
toes_01_middleslider_01_out_l_end_end_end_0648 toes_01_middleslider_01_out_l_end_end_0429
toes_01_middleslider_01_out_r_end_end_end_0662 toes_01_middleslider_01_out_r_end_end_0498
toes_02_middleslider_00_out_l_end_end_end_0645 toes_02_middleslider_00_out_l_end_end_0417
toes_02_middleslider_00_out_r_end_end_end_0641 toes_02_middleslider_00_out_r_end_end_0486
toes_02_middleslider_02_out_l_end_end_end_0646 toes_02_middleslider_02_out_l_end_end_0401
toes_02_middleslider_02_out_r_end_end_end_0642 toes_02_middleslider_02_out_r_end_end_0490
toes_end_l_end_end_end_0644 toes_end_l_end_end_0412
toes_end_r_end_end_end_0660 toes_end_r_end_end_0461
upperarm_middleslider_00_out_l_end_end_end_0611 upperarm_middleslider_00_out_l_end_end_0264
upperarm_middleslider_00_out_r_end_end_end_0626 upperarm_middleslider_00_out_r_end_end_0329
upperarm_middleslider_01_out_l_end_end_end_0612 upperarm_middleslider_01_out_l_end_end_0247
upperarm_middleslider_01_out_r_end_end_end_0627 upperarm_middleslider_01_out_r_end_end_0332
upperarm_twist_01_l_end_end_end_0610 upperarm_twist_01_l_end_end_0259
upperarm_twist_01_r_end_end_end_0625 upperarm_twist_01_r_end_end_0324
uppereyelid_l_end_end_end_0566 uppereyelid_l_end_end_088
uppereyelid_r_end_end_end_0568 uppereyelid_r_end_end_094
upperleg_twist_00_l_end_end_end_0656 upperleg_twist_00_l_end_end_0460
upperleg_twist_00_r_end_end_end_0670 upperleg_twist_00_r_end_end_0528
upperleg_twist_01_l_end_end_end_0655 upperleg_twist_01_l_end_end_0457
upperleg_twist_01_r_end_end_end_0669 upperleg_twist_01_r_end_end_0525
upperlip_end_end_end_0572 upperlip_end_end_0106
wrist_middleslider_00_out_l_end_end_end_0582 wrist_middleslider_00_out_l_end_end_0228
wrist_middleslider_00_out_r_end_end_end_0617 wrist_middleslider_00_out_r_end_end_0294
wrist_middleslider_01_out_l_end_end_end_0581 wrist_middleslider_01_out_l_end_end_0224
wrist_middleslider_01_out_r_end_end_end_0616 wrist_middleslider_01_out_r_end_end_0290`.split('\n').map(row=>row.split(' '));
const NATIVE_TERMINAL_WRITERS=new Set([
 ...NATIVE_GROOM_AUDIT.controls.map(c=>c.name),
 ...Object.values(NATIVE_HOOF_CONTROLS).flatMap(p=>Object.values(p).flatMap(c=>c.bones)),
 'ear_01_l_051','ear_01_r_055','uppereyelid_l_086','lowereyelid_l_089','uppereyelid_r_092','lowereyelid_r_095',
 'chestiddleslider_00_0191','chestiddleslider_01_r_0194','chestiddleslider_02_0197','chestiddleslider_01_l_0200'
]);
function holdNativeTerminalLocals({THREE,profile,rest,bindings}){
 const noop=()=>{};
 if(profile.nativeKind!=='horse'||profile.jointCount!==677||profile.bodyVertexCount!==16159||!NATIVE_TERMINAL_SOURCES.has(profile.sha256))return noop;
 const objects=rest.map(r=>r[0]),members=new Set(objects),bodies=objects.filter(o=>o.isSkinnedMesh&&o.geometry?.attributes.position?.count===16159);
 if(bodies.length!==1)return noop;
 const bones=bodies[0].skeleton?.bones;
 if(bones?.length!==677||new Set(bones).size!==677||bones.some(b=>!b.isBone||!members.has(b)))return noop;
 const byName=new Map(bones.map(b=>[b.name,b]));
 if(byName.size!==677||NATIVE_TERMINAL_PAIRS.length!==129)return noop;
 const leaves=NATIVE_TERMINAL_PAIRS.map(([name,parent])=>{const b=byName.get(name);return b?.parent?.isBone&&b.parent.name===parent&&b.children.length===0?b:null;});
 if(leaves.some(b=>!b||b.matrixAutoUpdate!==true||b.matrixWorldAutoUpdate!==true||NATIVE_TERMINAL_WRITERS.has(b.name)))return noop;
 const leafNames=new Set(leaves.map(b=>b.name)),leafTargets=new Set(leaves.flatMap(b=>[b.name,b.uuid]));
 if(objects.some(o=>leafNames.has(o.name)&&byName.get(o.name)!==o))return noop;
 // All live action/idle/gait bindings already collected for the rest target.
 // Reject unfamiliar binding shapes rather than guessing their target owner.
 for(const name of bindings){let p;try{p=THREE.PropertyBinding.parseTrackName(name);}catch{return noop;}
  if(!p.nodeName||p.objectName!==undefined||p.objectIndex!==undefined||p.propertyIndex!==undefined||!['position','quaternion','scale'].includes(p.propertyName)||leafTargets.has(p.nodeName))return noop;
 }
 const saved=leaves.map(b=>[b,b.matrixAutoUpdate]);
 for(const [b]of saved)b.updateMatrix();
 for(const [b]of saved)b.matrixAutoUpdate=false;
 return ()=>{for(const [b,flag]of saved)b.matrixAutoUpdate=flag;};
}
// The Ranch finishes these after all actor travel and terrain transforms.
const pendingHorseGrooms=new Set();
export function finishNativeHorseGrooms(){for(const finish of pendingHorseGrooms)finish();}

// Gameplay travel is independent of the short collected source strides. Keep
// their poses and bounded cadence; these faster speeds are not contact-matched.
const ridingRates={walk:1.35,trot:1.5,canterLeft:1.6,canterRight:1.6,gallopLeft:1.8,gallopRight:1.8};
const ridingSpeeds={walk:2,trot:4.2,canterLeft:7.5,canterRight:7.5,gallopLeft:15,gallopRight:15};
export function nativeHorseSpeedLimits(profile,worldScale=1){
 const paced=profile?.nativeKind==='horse',dragonTravel=!!profile?.nativeTravelSpeeds,cadenceLimit=paced?2:dragonTravel?1.6:1,scale=Math.abs(worldScale);
 // Pony stature remains visible without making travel across the map unusably
 // slow. Stats and temporary boosts still vary speed within each gait.
 const sizeFactor=paced?Math.max(.9,Math.min(1.08,(profile.nativeMaxSpeedMps||3)*scale/3)):1;
 const gaitSpeeds={},gaitMaxSpeeds={},gaitRates={};
 for(const [key,r]of Object.entries(profile?.nativeGaits||{})){
  const speed=r.nominalSpeedMps*scale;
  gaitSpeeds[key]=paced&&ridingSpeeds[key]?ridingSpeeds[key]*sizeFactor:profile.nativeTravelSpeeds?.[key]??speed;
  gaitMaxSpeeds[key]=gaitSpeeds[key]*(paced&&ridingSpeeds[key]?1.35:1);
  gaitRates[key]=paced?(ridingRates[key]||1):(profile.nativePlaybackRates?.[key]||1);
 }
 const maxSpeedMps=paced||dragonTravel?Math.max(0,...Object.entries(gaitMaxSpeeds).filter(([k])=>k!=='fly').map(([,v])=>v)):(profile?.nativeMaxSpeedMps||0)*scale;
 return {paced,dragonTravel,cadenceLimit,gaitSpeeds,gaitMaxSpeeds,gaitRates,maxSpeedMps,sizeFactor,contactSpeedMatched:paced||dragonTravel?false:null};
}

// Pose-only playback of the preserved native clips. The Ranch owns actor travel.
export function createNativeHorseMotion({THREE,root,clips,profile,deferGroom=false}={}){
 if(!THREE||!root||!profile?.nativeBreed)throw new Error('Native motion requires its original root and profile');
 // Dragon actions blend on their original skeleton and preserve their skin weights.
 if(profile.nativeKind!=='horse')return createCreatorMotion({THREE,root,clips,profile});
 const rest=[];root.traverse(o=>rest.push([o,o.position.clone(),o.quaternion.clone(),o.scale.clone()]));
 const actionBundle=createNativeHorseActionClips({THREE,root,profile}),actionRecords=Object.fromEntries(Object.entries(actionBundle.actions||{}).map(([type,record])=>[type,Object.freeze({...record})]));
 const ambientIdle=createNativeHorseIdle({THREE,root,profile});
 clips=[...clips,...actionBundle.clips,...(ambientIdle?[ambientIdle.clip]:[])];
 const hoofBundle=prepareNativeHoofFlex({THREE,root,clips,profile});clips=hoofBundle.clips;const hoofFlex=hoofBundle.layer;
 const mixer=new THREE.AnimationMixer(root),records=profile.nativeGaits||{},actions={},sourceClips={};
 const add=(mode,name,duration)=>{if(!name)return;const clip=THREE.AnimationClip.findByName(clips,name);if(!clip||duration&&Math.abs(clip.duration-duration)>1e-5)throw new Error('Missing or mismatched native clip '+name);sourceClips[mode]=clip;actions[mode]=mixer.clipAction(clip);};
 add('stand',profile.nativeIdleClip||ambientIdle?.clip.name);add('sit',profile.nativeSitClip);
 const jumpRecord=profile.nativeJump;add('jump',jumpRecord?.clip,jumpRecord?.durationS);
 if(actions.jump){actions.jump.setLoop(THREE.LoopOnce,1);actions.jump.clampWhenFinished=true;}
 for(const [key,record]of Object.entries(records)){if(!(record.nominalSpeedMps>0))throw new Error('Invalid native gait reference '+key);if(record.strokeM&&Math.abs(record.nominalSpeedMps-record.strokeM/(record.stanceFraction*record.durationS))>1e-7)throw new Error('Native gait speed/timing mismatch '+key);add(key,record.clip,record.durationS);}
 for(const [type,record]of Object.entries(actionRecords)){
  if(!record.clip||!Number.isFinite(record.durationS)||record.durationS<=0)throw new Error('Invalid native action '+type);
  add('action:'+type,record.clip,record.durationS);
 }
 const supportedActions=Object.freeze(Object.keys(actionRecords));
 const expression=createNativeHorseExpression({THREE,root,profile});
 const actionByClip=new Map(Object.values(actionRecords).map(record=>[record.clip,record]));
 // Use the original default values through the same bindings as the source
 // clips. This is a static rest target, not a fabricated creator idle clip.
 const restTracks=[],bindings=new Set();
 for(const clip of Object.values(sourceClips))for(const track of clip.tracks){
  if(bindings.has(track.name))continue;bindings.add(track.name);
  const cubic=!!track.createInterpolant.isInterpolantFactoryMethodGLTFCubicSpline;
  const size=track.getValueSize()/(cubic?3:1),value=new Float32Array(size);
  const binding=THREE.PropertyBinding.create(root,track.name);binding.bind();binding.getValue(value,0);binding.unbind();
  if(!value.every(Number.isFinite))throw new Error('Invalid native default binding '+track.name);
  restTracks.push(new track.constructor(track.name,[0,1],[...value,...value],THREE.InterpolateLinear));
 }
 const restClip=new THREE.AnimationClip('Native default standing pose',1,restTracks);
 actions.rest=mixer.clipAction(restClip);if(!actions.stand)actions.stand=actions.rest;
 const gaits={stand:{speed:0},rest:{speed:0}};for(const [key,r]of Object.entries(records))gaits[key]={speed:r.nominalSpeedMps,clip:r.clip,duration:r.durationS};for(const family of ['canter','gallop'])if(records[family+'Left'])gaits[family]={speed:records[family+'Left'].nominalSpeedMps};
 const availableModes=['rest','stand',...(profile.nativeSitClip?['sit']:[]),...Object.keys(records).filter(k=>! /^(canter|gallop)/.test(k)),...['canter','gallop'].filter(k=>records[k+'Left']),...(actions.jump?['jump']:[])];
 const fadeSeconds=.20,active=new Map(),transientActions=new Set();
 const groomInertia=createNativeGroomLayer({THREE,rig:{nativeRoot:root,profile}});
 let pendingGroomDt=null;
 function finishGroomPose(){if(pendingGroomDt===null)return;root.updateWorldMatrix(true,true);groomInertia?.afterPose(pendingGroomDt);pendingGroomDt=null;}
 if(groomInertia&&deferGroom)pendingHorseGrooms.add(finishGroomPose);
 let mode='rest',key='rest',lead='left',speedMps=0,turn=0,disposed=false,transition=null,jumpReturn='stand',actionType=null,recoveringAction=null;
 actions.rest.setEffectiveWeight(1).play();active.set(actions.rest,1);mixer.update(0);root.updateMatrixWorld(true);groomInertia?.beforePose();groomInertia?.afterPose(0);
 const releaseTerminalLocals=holdNativeTerminalLocals({THREE,profile,rest,bindings});
 function assertLive(){if(disposed)throw new Error('Native motion disposed');}
 function stopAction(action){action.stop();active.delete(action);if(transientActions.delete(action))mixer.uncacheAction(action.getClip(),root);}
 function restore(){pendingGroomDt=null;expression?.reset();hoofFlex?.reset();groomInertia?.reset();mixer.stopAllAction();for(const action of transientActions)mixer.uncacheAction(action.getClip(),root);transientActions.clear();active.clear();transition=null;actionType=null;recoveringAction=null;for(const[o,p,q,s]of rest){o.position.copy(p);o.quaternion.copy(q);o.scale.copy(s);}root.updateMatrixWorld(true);}
 function phaseOf(action){const duration=action?.getClip().duration;return action?.loop===THREE.LoopOnce?Math.min(1,action.time/duration):duration?((action.time/duration)%1+1)%1:0;}
 function alignedPhase(previous,next){
  const phase=phaseOf(actions[previous]);
  if(!records[previous]||!records[next])return 0;
  // Both lead clips share the torso cycle; preserve it when changing lead.
  if(['canter','gallop'].some(f=>previous.startsWith(f)&&next.startsWith(f)))return phase;
  // Match the anatomical FL touchdown between the authored horse cycles.
  const flOffset=k=>records[k]?.footOffsets?.FL??records[k]?.offsets?.FL??(k==='walk'?.25:k==='trot'?0:k==='canterLeft'?.48:k==='canterRight'?.24:0);
  return profile.nativeKind==='horse'?((phase-flOffset(previous)+flOffset(next))%1+1)%1:phase;
 }
 function set(value,{lead:nextLead=lead,speedMps:nextSpeed}={}){
  assertLive();const byClip=Object.keys(sourceClips).find(k=>!k.startsWith('action:')&&sourceClips[k].name===value);if(byClip)value=byClip;
  nextLead=nextLead==='right'?'right':'left';let nextKey=value;
  if(value==='canter'||value==='gallop')nextKey=value+(nextLead==='right'?'Right':'Left');
  if(/^(canter|gallop)(Left|Right)$/.test(value)){nextLead=value.endsWith('Right')?'right':'left';value=value.replace(/(Left|Right)$/,'');}
  if(!actions[nextKey]||nextKey.startsWith('action:'))throw new Error('Native '+profile.id+' has no '+value+' animation');
  if(nextSpeed!==undefined){if(!Number.isFinite(nextSpeed)||nextSpeed<0)throw new Error('Invalid native speed');speedMps=nextSpeed;}else if(nextKey!=='jump')speedMps=records[nextKey]?.nominalSpeedMps||0;
  if(nextKey===key){lead=nextLead;return;}
  actionType=null;
  const target=actions[nextKey],previous=key;
  if(nextKey==='jump')jumpReturn=key==='jump'||key.startsWith('action:')?'stand':key;
  if(!active.has(target)||nextKey==='jump'){
   target.reset();target.time=alignedPhase(previous,nextKey)*target.getClip().duration;
   if(nextKey==='jump'){target.setLoop(THREE.LoopOnce,1);target.clampWhenFinished=true;}
   target.setEffectiveWeight(0).play();active.set(target,0);
  }
  mode=value;key=nextKey;lead=nextLead;
  // Interrupted blends begin from their current weights, so repeated speed
  // input cannot jump a fading action back to full influence.
  transition={elapsed:0,duration:nextKey==='jump'?.12:fadeSeconds,start:new Map(active),target};
  if(active.size===1&&active.has(target)){target.setEffectiveWeight(1);active.set(target,1);transition=null;}
 }
 function supportsAction(type){return Object.hasOwn(actionRecords,type);}
 function actionDescriptor(type){return supportsAction(type)?{...actionRecords[type]}:null;}
 function startAction(type,{elapsedS=0}={}){
  assertLive();if(!supportsAction(type)||key==='jump'||actionType||recoveringAction||!Number.isFinite(elapsedS))return false;
  const record=actionRecords[type];elapsedS=Math.max(0,elapsedS);if(elapsedS>=record.durationS)return false;
  const nextKey='action:'+type,clip=sourceClips[nextKey];let target=mixer.clipAction(clip);
  // A just-finished action can still be fading out. Preserve its visible pose
  // while a separate playback instance starts the next action from the beginning.
  if(active.has(target)){target=mixer.clipAction(clip.clone());transientActions.add(target);}
  target.reset();target.setLoop(THREE.LoopOnce,1);target.clampWhenFinished=true;
  target.time=elapsedS;target.setEffectiveTimeScale(1).setEffectiveWeight(0).play();active.set(target,0);actions[nextKey]=target;
  key=nextKey;mode='action';actionType=type;recoveringAction=record.dismountedOnly?type:null;speedMps=0;turn=0;
  transition={elapsed:0,duration:fadeSeconds,start:new Map(active),target};
  return true;
 }
 function cancelAction(){assertLive();if(!actionType)return false;set('stand',{speedMps:0});return true;}
 function actionSnapshot(){if(!actionType)return null;const record=actionRecords[actionType],timeS=Math.max(0,Math.min(record.durationS,actions[key].time));return{type:actionType,timeS,durationS:record.durationS,progress:timeS/record.durationS};}
 function update(dt,{rate=1,direction=1}={}){
  assertLive();if(!Number.isFinite(dt)||dt<0)throw new Error('Invalid native motion delta');
  if(!Number.isFinite(rate)||rate<0)throw new Error('Invalid native playback rate');
  const target=actions[key];target.setEffectiveTimeScale(records[key]||key==='jump'?rate*(key==='walk'&&direction<0?-1:1):1);
  if(transition){
   transition.elapsed=Math.min(transition.duration,transition.elapsed+dt);if(transition.duration-transition.elapsed<1e-10)transition.elapsed=transition.duration;
   const t=transition.elapsed/transition.duration,s=t*t*t*(t*(t*6-15)+10);
   for(const[action,start]of transition.start){const weight=start+(action===transition.target?1-start:-start)*s;action.setEffectiveWeight(weight);active.set(action,weight);}
  }
  // Mixer time is wall time. Each gait's own time scale controls its playback.
  finishGroomPose();groomInertia?.beforePose();expression?.beforePose();hoofFlex?.beforePose();mixer.update(dt);root.updateMatrixWorld(true);hoofFlex?.afterPose(active);
  if(expression){
   const standWeight=active.get(actions.stand)||0;let actionWeight=0,groundedWeight=0;
   for(const [action,weight]of active){const record=actionByClip.get(action.getClip().name);if(record){actionWeight+=weight;if(record.dismountedOnly)groundedWeight+=weight;}}
   const expressive=mode==='rest'?0:Math.min(1,standWeight+actionWeight);
   // Creator/Bay idle already owns its ears; the Bay idle also owns breathing.
   // The lie-down body's floor fit is left exact. Blinks touch only eyelid skin.
   expression.afterPose(dt,{blink:mode==='rest'?0:1-expression.authoredBlinkWeight(active),ears:Math.max(0,expressive-((profile.nativeIdleClip||ambientIdle)?standWeight:0)),breathing:Math.max(0,expressive-(ambientIdle?standWeight:0)-groundedWeight)});
  }
  if(groomInertia&&deferGroom&&dt<=.25)pendingGroomDt=dt;else groomInertia?.afterPose(dt);
  if(transition&&transition.elapsed>=transition.duration){for(const action of active.keys())if(action!==target)stopAction(action);target.setEffectiveWeight(1);active.set(target,1);transition=null;}
  if(key==='jump'&&actions.jump.time>=jumpRecord.durationS-1e-6)set(jumpReturn,{lead,speedMps});
  if(actionType&&actions[key].time>=actionRecords[actionType].durationS-1e-6)set('stand',{speedMps:0});
  if(recoveringAction&&!actionType&&!transition)recoveringAction=null;
 }
 function snapshot(){const clip=sourceClips[key],jumpTime=key==='jump'?actions.jump.time:0,lift=key==='jump'?sampleNativeJumpLift(jumpRecord,jumpTime):0;return {gait:mode,hasAmbientIdle:!!ambientIdle,action:actionSnapshot(),blocksTravel:!!recoveringAction,lead,phase01:clip?phaseOf(actions[key]):0,bodyLiftM:lift,jumpTimeS:jumpTime,speedMps,grounded:mode!=='fly'&&(key!=='jump'||jumpTime<jumpRecord.flightStartS||jumpTime>=jumpRecord.flightEndS),intensity:profile.nativeMaxSpeedMps?Math.min(1,speedMps/profile.nativeMaxSpeedMps):0,turn,transitioning:!!transition,transitionElapsedS:transition?.elapsed||0,transitionDurationS:transition?.duration||fadeSeconds,activeActions:active.size,groomInertia:groomInertia?.snapshot()||null,expression:expression?.snapshot()||null,hoofFlex:hoofFlex?.snapshot()||null,restFallback:!clip,transitionsReviewed:false};}
 function reset(){assertLive();restore();mode='rest';key='rest';speedMps=0;actions.rest.reset().setEffectiveWeight(1).play();active.set(actions.rest,1);mixer.update(0);}
 // Explicit approximate far-visual handoff: seek one cyclic source action at
 // dt0, never replay a long interval or advance gameplay. Springs are reseeded.
 function rebaseVisualLoop(next,phase,nextSpeed=0){assertLive();if(!['walk','stand','rest'].includes(next)||!actions[next]||!Number.isFinite(phase)||!Number.isFinite(nextSpeed)||nextSpeed<0)return false;restore();mode=key=next;speedMps=nextSpeed;const target=actions[next];target.reset().setEffectiveWeight(1).play();target.time=((phase%1)+1)%1*target.getClip().duration;active.set(target,1);groomInertia?.beforePose();mixer.update(0);root.updateMatrixWorld(true);groomInertia?.afterPose(0);return true;}
 return {set,update,reset,rebaseVisualLoop,get transitioning(){return !!transition;},snapshot,hasAmbientIdle:!!ambientIdle,gaits,availableModes,supportedModes:availableModes,supportedActions,supportsAction,actionDescriptor,startAction,cancelAction,mixer,groomInertia,expression,hoofFlex,finishGroomPose,get action(){return actionSnapshot();},get blocksTravel(){return !!recoveringAction;},get mode(){return mode;},get state(){return snapshot();},get clip(){return sourceClips[key]?.name||null;},get time(){return sourceClips[key]?actions[key]?.time||0:0;},setTurn(v){turn=Math.max(-1,Math.min(1,Number(v)||0));},dispose(){if(disposed)return;pendingHorseGrooms.delete(finishGroomPose);expression?.dispose();hoofFlex?.dispose();groomInertia?.dispose();releaseTerminalLocals();restore();mixer.uncacheRoot(root);disposed=true;}};

}

function createCreatorMotion({THREE,root,clips,profile}={}){
 if(!THREE||!root||!profile?.nativeBreed)throw new Error('Native motion requires its original root and profile');
 const rest=[];root.traverse(o=>rest.push([o,o.position.clone(),o.quaternion.clone(),o.scale.clone()]));
 const mixer=new THREE.AnimationMixer(root),records=profile.nativeGaits||{},actions={},sourceClips={};
 const add=(mode,name,duration)=>{if(!name)return;const clip=THREE.AnimationClip.findByName(clips,name);if(!clip||duration&&Math.abs(clip.duration-duration)>1e-5)throw new Error('Missing or mismatched native clip '+name);sourceClips[mode]=clip;actions[mode]=mixer.clipAction(clip);};
 add('stand',profile.nativeIdleClip);add('sit',profile.nativeSitClip);
 for(const [key,record]of Object.entries(records)){if(!(record.nominalSpeedMps>0))throw new Error('Invalid native gait reference '+key);if(record.strokeM&&Math.abs(record.nominalSpeedMps-record.strokeM/(record.stanceFraction*record.durationS))>1e-7)throw new Error('Native gait speed/timing mismatch '+key);add(key,record.clip,record.durationS);}
 const gaits={stand:{speed:0},rest:{speed:0}};for(const [key,r]of Object.entries(records))gaits[key]={speed:r.nominalSpeedMps,clip:r.clip,duration:r.durationS};if(records.canterLeft)gaits.canter={speed:records.canterLeft.nominalSpeedMps};
 const availableModes=['rest','stand',...(profile.nativeSitClip?['sit']:[]),...Object.keys(records).filter(k=>!/^canter/.test(k)),...(records.canterLeft?['canter']:[])];
 // Blend through the source bindings, including a proper rest target. Stopping
 // every action at a gait switch used to snap the dragon and its rider.
 const restTracks=[],bindings=new Set();
 for(const clip of Object.values(sourceClips))for(const track of clip.tracks){
  if(bindings.has(track.name))continue;bindings.add(track.name);
  const cubic=!!track.createInterpolant.isInterpolantFactoryMethodGLTFCubicSpline;
  const value=new Float32Array(track.getValueSize()/(cubic?3:1));
  const binding=THREE.PropertyBinding.create(root,track.name);binding.bind();binding.getValue(value,0);binding.unbind();
  if(!value.every(Number.isFinite))throw new Error('Invalid dragon rest binding '+track.name);
  restTracks.push(new track.constructor(track.name,[0,1],[...value,...value],THREE.InterpolateLinear));
 }
 actions.rest=mixer.clipAction(new THREE.AnimationClip('Dragon rest pose',1,restTracks));
 if(!actions.stand)actions.stand=actions.rest;
 const active=new Map();
 let mode='rest',key='rest',lead='left',speedMps=0,turn=0,disposed=false,transition=null;
 actions.rest.setEffectiveWeight(1).play();active.set(actions.rest,1);mixer.update(0);
 function assertLive(){if(disposed)throw new Error('Native motion disposed');}
 function restore(){mixer.stopAllAction();active.clear();transition=null;for(const[o,p,q,s]of rest){o.position.copy(p);o.quaternion.copy(q);o.scale.copy(s);}root.updateMatrixWorld(true);}
 function set(value,{lead:nextLead=lead,speedMps:nextSpeed}={}){
  assertLive();const byClip=Object.keys(sourceClips).find(k=>sourceClips[k].name===value);if(byClip)value=byClip;
  nextLead=nextLead==='right'?'right':'left';let nextKey=value;
  if(value==='canter')nextKey=nextLead==='right'?'canterRight':'canterLeft';
  if(value==='canterLeft'||value==='canterRight'){nextLead=value==='canterRight'?'right':'left';value='canter';}
  if(!actions[nextKey])throw new Error('Native '+profile.id+' has no '+value+' animation');
  if(nextSpeed!==undefined){if(!Number.isFinite(nextSpeed)||nextSpeed<0)throw new Error('Invalid native speed');speedMps=nextSpeed;}else speedMps=records[nextKey]?.nominalSpeedMps||0;
  if(nextKey===key){lead=nextLead;return;}
  const target=actions[nextKey],previous=key,phase=actions[key].time/actions[key].getClip().duration;
  if(!active.has(target)){
   target.reset();
   if(records[key]&&records[nextKey]&&key!=='fly'&&nextKey!=='fly')target.time=(phase%1)*target.getClip().duration;
   target.setEffectiveWeight(0).play();active.set(target,0);
  }
  mode=value;key=nextKey;lead=nextLead;
  transition={elapsed:0,duration:previous==='fly'?(profile.nativeLandingBlendS||.65):nextKey==='fly'?.65:.28,start:new Map(active),target};
 }
 function update(dt,{rate=1,direction=1}={}){
  assertLive();if(!Number.isFinite(rate)||rate<0)throw new Error('Invalid native playback rate');if(!Number.isFinite(dt)||dt<0)throw new Error('Invalid native motion delta');
  const target=actions[key];target.setEffectiveTimeScale(records[key]?rate*(key==='walk'&&direction<0?-1:1):1);
  if(transition){
   transition.elapsed=Math.min(transition.duration,transition.elapsed+dt);
   const t=transition.elapsed/transition.duration,s=t*t*t*(t*(t*6-15)+10);
   for(const[action,start]of transition.start){const weight=start+(action===target?1-start:-start)*s;action.setEffectiveWeight(weight);active.set(action,weight);}
  }
  mixer.update(dt);root.updateMatrixWorld(true);
  if(transition&&transition.elapsed>=transition.duration){for(const action of active.keys())if(action!==target){action.stop();active.delete(action);}target.setEffectiveWeight(1);active.set(target,1);transition=null;}
 }
 function snapshot(){const clip=sourceClips[key];return {gait:mode,lead,phase01:clip?actions[key].time/clip.duration:0,bodyLiftM:0,flightWeight:active.get(actions.fly)||0,speedMps,grounded:mode!=='fly',intensity:profile.nativeMaxSpeedMps?Math.min(1,speedMps/profile.nativeMaxSpeedMps):0,turn,transitioning:!!transition,transitionElapsedS:transition?.elapsed||0,transitionDurationS:transition?.duration||.28,activeActions:active.size,restFallback:!clip,transitionsReviewed:false};}
 function reset(){assertLive();restore();mode='rest';key='rest';speedMps=0;actions.rest.reset().setEffectiveWeight(1).play();active.set(actions.rest,1);mixer.update(0);}
 return {set,update,reset,snapshot,hasAmbientIdle:false,gaits,availableModes,supportedModes:availableModes,mixer,get mode(){return mode;},get state(){return snapshot();},get clip(){return sourceClips[key]?.name||null;},get time(){return actions[key]?.time||0;},setTurn(v){turn=Math.max(-1,Math.min(1,Number(v)||0));},dispose(){if(disposed)return;restore();mixer.uncacheRoot(root);disposed=true;}};
}

export function getNativeHorseCapabilities(rig){
 if(!rig?.profile?.nativeBreed&&!rig?.profile?.referenceMotion)return null;
 const profile=rig.profile,scale=rig.scene?.getWorldScale(rig.scene.position.clone().set(1,1,1)).z||1,referenceFlight=!!((profile.referenceMotion||profile.nativeRoster)&&(rig.nativeCanFly||rig.nativeFantasy?.pair||rig.fantasyAppearance?.wings));
 const limits=nativeHorseSpeedLimits(profile,scale),statFactor=Number.isFinite(rig.nativeTravelStatFactor)?Math.max(1,Math.min(2,rig.nativeTravelStatFactor)):1;
 // Keep the selected gait and bounded cadence, but let equipped stats raise
 // its travel ceiling instead of silently flattening every strong tack set.
 limits.maxSpeedMps*=statFactor;
 limits.gaitMaxSpeeds=Object.fromEntries(Object.entries(limits.gaitMaxSpeeds).map(([k,v])=>[k,v*statFactor]));
 return {native:true,nativeKind:profile.nativeKind,...limits,flightMaxSpeedMps:(referenceFlight?13:profile.nativeTravelSpeeds?.fly??(profile.nativeGaits?.fly?.nominalSpeedMps||0)*Math.abs(scale))*statFactor,nominalMaxSpeedMps:profile.nativeMaxSpeedMps,worldScale:Math.abs(scale),supportedModes:rig.heroMotion?.availableModes||['rest','stand',...Object.keys(profile.nativeGaits||{})],canJump:!!profile.nativeJump,canGallop:!!profile.nativeGaits?.gallopLeft,canFly:!!profile.nativeCanFly||referenceFlight,speedBasis:profile.nativeKind==='horse'?'Gameplay travel with bounded collected animation cadence; not contact-matched':profile.nativeSpeedBasis||'Configured source animation travel reference'};
}

export function tickNativeHorse(rig,speed,dt,turn=0){
 const motion=rig.heroMotion,cap=getNativeHorseCapabilities(rig);if(!motion||!cap)return null;
 if(!Number.isFinite(dt)||dt<0)throw new Error('Invalid native update delta');
 rig.nativeTurningInPlace=false;
 const actual=Math.max(0,Math.min(rig.nativeFlying&&cap.canFly?cap.flightMaxSpeedMps:cap.maxSpeedMps,Math.abs(Number(speed)||0))),gaits=rig.profile.nativeGaits||{};
 if(rig.heroJumpGrace>0)rig.heroJumpGrace=Math.max(0,rig.heroJumpGrace-dt);
 // A grounded full-body action owns its complete get-up and final blend.
 // The actor input guard holds travel; peers and other callers keep the same pose.
 if(motion.blocksTravel){motion.setTurn(0);motion.update(dt);const state=motion.state;rig.phase=state.phase01;rig.heroJumpAge=null;rig.heroJumpExtra=0;rig.heroRate=1;return state;}
 if(motion.action){
  if(actual>.25||rig.nativeFlying||rig.nativeReverse)motion.cancelAction();
  else{motion.setTurn(0);motion.update(dt);const state=motion.state;rig.phase=state.phase01;rig.heroJumpAge=null;rig.heroJumpExtra=0;rig.heroRate=1;return state;}
 }
 if(motion.mode==='jump'){motion.set('jump',{speedMps:actual});motion.setTurn(turn);motion.update(dt,{rate:1});const state=motion.state;rig.phase=state.phase01;rig.heroJumpAge=state.gait==='jump'?state.jumpTimeS:null;rig.heroJumpExtra=state.bodyLiftM*cap.worldScale*(rig.nativeJumpHeightScale||1);rig.heroRate=1;if(state.gait!=='jump')rig.heroJumpGrace=.20;return state;}
 // A slow rein turn must move the feet instead of rotating a standing statue.
 // Travel/score stay at their real measured speed; only the ordinary walk pose steps.
 const turningInPlace=cap.paced&&!rig.nativeFlying&&!rig.nativeReverse&&actual<.18&&Math.abs(turn)>.08;
 rig.nativeTurningInPlace=turningInPlace;
 let gait='stand',rate=1,record=null;
 // Gather the Black Dragon's wings during the last part of a requested
 // landing. Physics stays airborne until contact; a low hover keeps flapping.
 const landingApproach=!!(rig.nativeFlying&&gaits.fly&&rig.profile.nativeLandingBlendHeightM&&rig.nativeLanding&&Number.isFinite(rig.nativeAltitude)&&rig.nativeAltitude<=rig.profile.nativeLandingBlendHeightM);
 rig.nativeLandingPose=landingApproach;
 if(rig.nativeFlying&&gaits.fly&&!landingApproach){gait='fly';record=gaits.fly;}
 else if(actual>.02||turningInPlace){
  const ground=Object.entries(gaits).filter(([key])=>key!=='fly'&&!key.endsWith('Right')).sort((a,b)=>a[1].nominalSpeedMps-b[1].nominalSpeedMps);
  const paceFactor=cap.paced?(rig.nativePaceFactor||1):1;
  let chosen=turningInPlace?ground.find(([key])=>key==='walk'):ground.find(([key])=>actual<=cap.gaitSpeeds[key]*paceFactor+1e-7)||ground.at(-1);
  // A faster trot remains a trot. On slowing down, keep a faster gait until
  // actual travel enters the requested gait's gameplay speed range.
  const requested=ground.find(([key])=>key===rig.nativeRequestedGait);
  if((cap.paced||cap.dragonTravel)&&requested&&chosen&&ground.indexOf(chosen)>ground.indexOf(requested)&&actual<=cap.gaitMaxSpeeds[requested[0]]+1e-7)chosen=requested;
  if(chosen){gait=chosen[0];record=chosen[1];}
 }
 const reversing=!!rig.nativeReverse&&!rig.nativeFlying&&actual>.02&&!!gaits.walk;
 if(reversing){gait='walk';record=gaits.walk;}
 const lead=turn<-.32?'right':turn>-.08?'left':rig.heroLead||'left';rig.heroLead=lead;if(gait.endsWith('Left'))gait=gait.slice(0,-4);
 if(record){const key=gait==='canter'||gait==='gallop'?gait+'Left':gait;rate=(cap.paced||cap.dragonTravel)&&gait!=='fly'?actual/cap.gaitSpeeds[key]*cap.gaitRates[key]:actual/(record.nominalSpeedMps*cap.worldScale);}
 if(turningInPlace)rate=.40+.30*Math.min(1,Math.abs(turn));
 if(gait==='fly')rate=cap.dragonTravel?(rig.profile.nativeFlightRate||1)*(1+.12*actual/Math.max(1,cap.flightMaxSpeedMps)):Math.max(.1,Math.min(1,rate||1));else rate=Math.min(cap.cadenceLimit,Math.max(0,rate));
 motion.set(gait,{lead,speedMps:actual});motion.setTurn(turn);motion.update(dt,{rate,direction:reversing?-1:1});
 // The original long wing fingers sweep below the feet during some blends.
 // Keep the measured clearance envelope above the actor's ground plane. This
 // normalization offset also carries the saddle and follows interrupted fades.
 if(rig.profile.nativeFlightBlendClearanceM&&rig.nativeRoot?.parent){
  const w=motion.state.flightWeight||0,altitude=Math.max(0,rig.nativeAltitude||0)/cap.worldScale;
  const lift=Math.max(0,rig.profile.nativeFlightBlendClearanceM*4*w*(1-w)-altitude);
  rig.nativeRoot.parent.position.y=(rig.profile.nativeTranslation?.[1]||0)+lift;
  rig.nativePoseLiftM=lift*cap.worldScale;
 }
 rig.phase=motion.state.phase01;rig.heroJumpAge=null;rig.heroJumpExtra=0;rig.heroRate=rate;return motion.state;
}

// Actor lift is separate from the skinned jump pose and follows the same clock.
export function sampleNativeJumpLift(record,time){
 const keys=record?.actorLiftM||[];if(!keys.length)return 0;
 if(time<=keys[0][0])return keys[0][1];
 for(let i=1;i<keys.length;i++){if(time<=keys[i][0]){const a=keys[i-1],b=keys[i],t=(time-a[0])/(b[0]-a[0]);return a[1]+(b[1]-a[1])*t;}}
 return keys.at(-1)[1];
}
export function startNativeHorseJump(rig,{heightScale=1}={}){
 const motion=rig?.heroMotion;if(!rig?.profile?.nativeJump||!motion||motion.mode==='jump'||motion.action||motion.blocksTravel)return false;
 rig.nativeJumpHeightScale=Number.isFinite(heightScale)?Math.max(.8,Math.min(1.5,heightScale)):1;
 rig.heroJumpAge=0;rig.heroJumpExtra=0;motion.set('jump');return true;
}

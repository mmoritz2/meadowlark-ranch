import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as THREE from '../assets/vendor/three/build/three.module.js';
import {createMountedSteering} from '../assets/mounted-steering.mjs';
import {createRidingInput} from '../assets/riding-input.js';
import {sampleMountedSeat,mountedHorseBank} from '../assets/horse-riding-pose.mjs';
import {createNativeHorseMotion,tickNativeHorse,getNativeHorseCapabilities,startNativeHorseJump} from '../assets/native-horse-motion.js';
import {NATIVE_BREED_PROFILES} from '../assets/native-breed-profiles.js';
import {loadNativeHorseFixture} from './test-native-horse-actions.mjs';

const root=new URL('../',import.meta.url),read=file=>fs.readFileSync(new URL(file,root),'utf8'),html=read('ranch3d.html');
const plain=value=>JSON.parse(JSON.stringify(value)),near=(a,b,t=1e-10)=>assert.ok(Math.abs(a-b)<=t,`${a} vs ${b}; tolerance ${t}`);
function section(text,start,end){const a=text.indexOf(start);assert.ok(a>=0,'Actual source start: '+start);const b=text.indexOf(end,a+start.length);assert.ok(b>a,'Actual source end: '+end);return text.slice(a,b);}
const input=section(html,' const ridingIntent=ridingInput.resolve(',' const abil=');
const acceleration=section(html,' // A held stop also wins over event boosts',' /* Steering.');
const steering=section(html,' let turn=(left?1:0)-(right?1:0);',' // Fast galloping and slow rendering');
const travelDecl=html.match(/ const travelSteps=Math\.max\(1,Math\.ceil\(Math\.abs\(player\.speed\)\*dt\/\.3\)\),travelDt=dt\/travelSteps;/)?.[0];assert.ok(travelDecl,'Actual short travel-step declaration');
const heading=section(html,' player.heading+=travelDt*yawRate;',' /* The basin runs');
const bank=section(html,' const tPrev=Number.isFinite(player.turnSm)?player.turnSm:0;',' if(player.trick)');
const rider=section(html,'function driveRider(sp,tm,dt){','const _hv=');
const legacySteering17a656b=" let turn=(left?1:0)-(right?1:0);\n if(inVR||touch.analog){\n  // the touch stick can respond faster than VR: no inner ear to upset on a phone\n  const rate=inVR?5:11;\n  player.turnSm=(player.turnSm||0)+(touch.turnA-(player.turnSm||0))*(1-Math.exp(-rate*dt));\n  if(Math.abs(player.turnSm)<0.002)player.turnSm=0;\n  turn=player.turnSm;\n }else player.turnSm=turn;   // stay in sync, so putting the headset on doesn't jerk the horse\n if(freeCam||ridingIntent.locked){turn=0;player.turnSm=0;}\n const yawRate=(1.7+Math.min(1.5,Math.abs(player.speed)*0.1))*(inVR?0.45:1);\n";
const legacyHeading17a656b=" player.heading+=turn*travelDt*yawRate*agMul;\n player.pos.x+=Math.sin(player.heading)*player.speed*travelDt;\n player.pos.z+=Math.cos(player.heading)*player.speed*travelDt;\n";
const script=new vm.Script(`(()=>{${input}${acceleration}${steering}${travelDecl}\nfor(let travelStep=0;travelStep<travelSteps;travelStep++){${heading}}\nconst sp=Math.abs(player.speed);${bank}\nreturn {turn,yawRate,mountedHorse,groundTurn,frame:mountedSteeringFrame};})()`,{filename:'actual-mounted-steering-heading-bank.js'});
const legacyScript=new vm.Script(`(()=>{${input}${legacySteering17a656b}${travelDecl}\nfor(let travelStep=0;travelStep<travelSteps;travelStep++){${legacyHeading17a656b}}\nreturn {turn,yawRate:turn*yawRate*agMul};})()`,{filename:'captured-17a656b-excluded-mode-steering.js'});
function fixture({profile=NATIVE_BREED_PROFILES['white-western'],speed=7.5,inVR=false,onFoot=false,flying=false,swim=false,vehicle=false,agility=1}={}){
 const save=Object.freeze({coins:137,gems:4,story:Object.freeze({idx:5,prog:2}),horseXP:94}),mesh=new THREE.Group();
 const context=vm.createContext({THREE,Math,mountedHorseBank,dt:1/60,inVR,freeCam:false,agMul:agility,acMul:1,target:speed,keys:{KeyW:true},touch:{analog:false,turnA:0},
  player:{speed,pos:{x:0,z:0},heading:0,turnSm:0,y:0,vy:0,onFoot,flying,swim,landing:false,mesh},
  RIG:{profile,modelKey:profile.id,ready:true,attachedTo:mesh,scene:new THREE.Group(),heroMotion:{mode:'stand',state:{gait:'stand',grounded:true}}},
  myHorses:[{id:23,bareback:false}],rideIdx:0,mountedSteering:createMountedSteering(),mountedSteeringFrame:null,ridingInput:createRidingInput(),
  DRILL:{on:false},drillPaused:()=>false,G:{worldPkg:{vehicle:()=>vehicle}},
  syncSave:()=>{throw Error('Steering cannot write a save.');},localStorage:{setItem(){throw Error('Steering cannot write storage.');}},save});
 context.nativeCap=getNativeHorseCapabilities(context.RIG);
 return {context,save,step({dt=1/60,keys={KeyW:true,KeyA:true},touch={analog:false,turnA:0},target,...patch}={},legacy=false){Object.assign(context,patch);context.dt=dt;context.keys=keys;context.touch=touch;context.target=target??context.player.speed;return (legacy?legacyScript:script).runInContext(context);}};
}
function held(f,seconds,inputOptions={}){let result;const hz=inputOptions.hz||60;for(let i=0;i<Math.round(seconds*hz);i++)result=f.step({...inputOptions,dt:1/hz});return result;}
function riderFixture(profile=NATIVE_BREED_PROFILES['white-western']){
 const f=fixture({profile}),R={g:new THREE.Group(),fitG:new THREE.Group(),sk:{by:{neck:new THREE.Object3D(),head:new THREE.Object3D()}},pose:{},_patT:100,_rest(){},_seat(...args){this.lastSeat=args;}};
 const c=f.context;Object.assign(c,{USE_GEN_HORSE:true,USE_GEN_TACK:true,riderSeat:()=>({x:.01,y:1.7,z:.13}),nativeActionSeatRotation:()=>{},RIG:{...c.RIG,phase:.25},TACK:{saddle:{userData:{style:'english'}}},EMOTES:{},emEnv:()=>0,
  getNativeHorseCapabilities,sampleMountedSeat,mountedHorseBank,reinL:new THREE.Group(),reinR:new THREE.Group(),renderer:{xr:{isPresenting:false}},vrCtrls:[],
  _rdQ:new THREE.Quaternion(),_rdF:new THREE.Vector3(),_rdU:new THREE.Vector3(),_rdR:new THREE.Vector3(),trackHead:()=>{},cacheRiderHands:()=>{},riderLegs:()=>{}});
 c.player.rider=R;c.G.mastery={isWild:()=>false};c.G.run=()=>true;vm.runInContext(rider,c);
 return {...f,R,pose(gait,{speed=4.2,dt=.25,western=false,bareback=false,phase=.25,frame={active:true,turn:0,yawRate:0}}={}){c.RIG.heroMotion={mode:gait,state:{gait,grounded:true}};c.RIG.phase=phase;c.TACK.saddle.userData.style=western?'western':'english';c.myHorses[0].bareback=bareback;c.mountedSteeringFrame=frame;c.sp=speed;c.tm=0;c.poseDt=dt;vm.runInContext('driveRider(sp,tm,poseDt)',c);return plain(R.pose);}};
}
// Read the real original motion channels using the bundled loader's exact
// cubic interpolants. The asset, skeleton, profiles and playback are unmodified.
const gltfLoader=read('assets/vendor/three/examples/jsm/loaders/GLTFLoader.js'),cubicSource=section(gltfLoader,'class GLTFCubicSplineInterpolant','/*********************************/');
const cubic=new Function('Interpolant','Quaternion',cubicSource+';return [GLTFCubicSplineInterpolant,GLTFCubicSplineQuaternionInterpolant];')(THREE.Interpolant,THREE.Quaternion);
function clipsFrom(file){
 const b=fs.readFileSync(new URL(file,root)),len=b.readUInt32LE(12),doc=JSON.parse(b.subarray(20,20+len)),bin=b.subarray(28+len);
 function array(i){const a=doc.accessors[i],view=doc.bufferViews[a.bufferView],size={SCALAR:1,VEC3:3,VEC4:4}[a.type],out=new Float32Array(a.count*size);assert.equal(a.componentType,5126);for(let n=0;n<a.count;n++)for(let k=0;k<size;k++)out[n*size+k]=bin.readFloatLE((view.byteOffset||0)+(a.byteOffset||0)+n*(view.byteStride||size*4)+k*4);return out;}
 return(doc.animations||[]).map(a=>new THREE.AnimationClip(a.name,-1,a.channels.map(c=>{const sampler=a.samplers[c.sampler],kind=c.target.path,name=doc.nodes[c.target.node].name,Track=kind==='rotation'?THREE.QuaternionKeyframeTrack:THREE.VectorKeyframeTrack,track=new Track(name+'.'+({rotation:'quaternion',translation:'position',scale:'scale'}[kind]),array(sampler.input),array(sampler.output),sampler.interpolation==='STEP'?THREE.InterpolateDiscrete:THREE.InterpolateLinear);if(sampler.interpolation==='CUBICSPLINE'){track.createInterpolant=function(result){return new cubic[kind==='rotation'?1:0](this.times,this.values,this.getValueSize()/3,result);};track.createInterpolant.isInterpolantFactoryMethodGLTFCubicSpline=true;}return track;})));
}

test('actual mounted steering/heading applies one raw input filter and one agility factor',()=>{
 for(const agility of [.95,1.3]){
  const f=fixture({agility}),expected=createMountedSteering(),result=f.step(),e=expected.update({dt:1/60,input:1,speed:7.5,agility,mountKey:'23|white-western'});
  assert.equal(result.mountedHorse,true);near(f.context.player.heading,e.yawDelta);near(result.yawRate,e.yawRate);near(result.turn,e.turn);near(f.context.player.turnSm,e.turn);near(f.context.player.mesh.rotation.z,-mountedHorseBank({speed:7.5,yawRate:e.yawRate}));
 }
});
test('actual touch and keyboard have equal full-rein onset and displacement',()=>{
 const key=fixture(),touch=fixture();held(key,1);held(touch,1,{keys:{KeyW:true},touch:{analog:true,turnA:1}});
 for(const field of ['heading','speed','turnSm'])near(key.context.player[field],touch.context.player[field]);near(key.context.player.pos.x,touch.context.player.pos.x);near(key.context.player.pos.z,touch.context.player.pos.z);
});
test('actual analog half-rein stays proportional without the old second touch smoother',()=>{
 const key=fixture(),touch=fixture();const a=key.step(),b=touch.step({keys:{KeyW:true},touch:{analog:true,turnA:.5}});near(b.yawRate,a.yawRate/2);near(b.turn,a.turn/2);
});
test('actual world branch uses real horse profiles and excludes both authored dragon models',()=>{
 for(const [id,profile]of Object.entries(NATIVE_BREED_PROFILES))assert.equal(fixture({profile,speed:2}).step().mountedHorse,profile.nativeKind==='horse',id);
 for(const patch of [{inVR:true},{onFoot:true},{flying:true},{vehicle:true}])assert.equal(fixture(patch).step().mountedHorse,false);
});
test('mounted airborne/landing and native jump state stop yaw without stopping signed travel',()=>{
 for(const state of [{y:.3},{landing:true},{nativeGrounded:false}]){
  const f=fixture();held(f,.5);Object.assign(f.context.player,state);if(state.nativeGrounded===false)f.context.RIG.heroMotion.state.grounded=false;
  const before={...f.context.player.pos},heading=f.context.player.heading,result=f.step();assert.equal(result.mountedHorse,true);assert.equal(result.frame.reason,'locked');near(f.context.player.heading,heading);near(f.context.player.speed,7.5);assert.ok(Math.hypot(f.context.player.pos.x-before.x,f.context.player.pos.z-before.z)>.12);
 }
});
test('free-camera and actual riding-input locks clear mounted yaw immediately',()=>{
 for(const mode of ['camera','menu']){const f=fixture();held(f,.5);if(mode==='camera')f.context.freeCam=true;else f.context.ridingInput.lock('menu',true);const before=f.context.player.heading,result=f.step();assert.equal(result.frame.turn,0);near(f.context.player.heading,before);near(f.context.player.turnSm,0);}
});
test('actual mount/model transition discards the old full-lock rein',()=>{
 const f=fixture();held(f,1);f.context.myHorses[0].id=99;const next=f.step();assert.ok(next.turn>0&&next.turn<.12);assert.equal(next.frame.mountKey,'99|white-western');f.context.RIG.modelKey='bay-western';assert.ok(f.step().turn<.12);
});
test('actual releaseAllRidingControls immediately clears held rein and diagnostic state',()=>{
 const f=fixture();held(f,.5);const c=f.context;c.keys={};Object.assign(c,{window:{dispatchEvent(){}},KeyboardEvent:class{},nativeJumpInput:{reset(){}},hoofContacts:{reset(){}},releaseRidingPointer(){},endDrag(){}});
 vm.runInContext(section(html,'function releaseAllRidingControls(){','\n'),c);vm.runInContext('releaseAllRidingControls()',c);
 assert.equal(c.mountedSteering.state().turn,0);assert.equal(c.mountedSteeringFrame,null);assert.equal(c.player.turnSm,0);const heading=c.player.heading;f.step({keys:{}});near(c.player.heading,heading);
});
test('legacy VR, foot, flying, dragon and vehicle steering remain equal to captured actual source',()=>{
 for(const options of [{inVR:true},{onFoot:true},{flying:true},{profile:NATIVE_BREED_PROFILES['black-dragon-native']},{profile:NATIVE_BREED_PROFILES['european-dragon']},{vehicle:true}]){
  for(const analog of [false,true]){
   const actual=fixture({...options,speed:4.2}),legacy=fixture({...options,speed:4.2});
   for(let i=0;i<30;i++){const opts={dt:1/60,keys:{KeyW:true,...(i<15?{KeyA:true}:{KeyD:true})},touch:{analog,turnA:i<15?.7:-.4}};actual.step(opts);legacy.step(opts,true);}
   near(actual.context.player.heading,legacy.context.player.heading);near(actual.context.player.pos.x,legacy.context.player.pos.x);near(actual.context.player.pos.z,legacy.context.player.pos.z);near(actual.context.player.turnSm,legacy.context.player.turnSm);
  }
 }
});
test('a swimming native horse retains the raw preexisting steering and signed travel at the water surface',()=>{
 for(const speed of [2.4,-1.3])for(const analog of [false,true]){
  const actual=fixture({swim:true,speed}),legacy=fixture({swim:true,speed});
  // A negative-speed sample represents an already deliberate rein-back, after
  // the real input owner's brake-before-reverse wait, not its initial stop.
  if(speed<0)for(const f of [actual,legacy])f.context.ridingInput.resolve({keys:{KeyS:true},speed:0,dt:.2});
  assert.equal(actual.context.RIG.profile.nativeKind,'horse');assert.equal(actual.context.RIG.heroMotion.state.grounded,true);assert.equal(actual.context.player.y,0,'Native walk/zero actor lift does not itself prove ground contact while swimming');
  for(let n=0;n<60;n++){
   const opts={dt:1/60,keys:speed<0?{KeyS:true,...(n<30?{KeyA:true}:{KeyD:true})}:{KeyW:true,...(n<30?{KeyA:true}:{KeyD:true})},touch:{analog,turnA:n<30?.75:-.4}};
   const result=actual.step(opts);legacy.step(opts,true);assert.equal(result.mountedHorse,false);assert.equal(result.frame.reason,'inactive');
   near(actual.context.player.heading,legacy.context.player.heading);near(actual.context.player.pos.x,legacy.context.player.pos.x);near(actual.context.player.pos.z,legacy.context.player.pos.z);near(actual.context.player.turnSm,legacy.context.player.turnSm);near(actual.context.player.speed,speed);
  }
 }
});
test('actual heading and travel loop stays consistent at 30/60/120 Hz at every ordinary pace',()=>{
 for(const speed of [2,4.2,7.5,15]){
  const results=[30,60,120].map(hz=>{const f=fixture({speed});held(f,1,{hz});held(f,.5,{hz,keys:{KeyW:true}});held(f,.5,{hz,keys:{KeyW:true,KeyD:true}});return f.context.player;});
  for(const p of results){near(p.heading,results[2].heading,1e-9);near(p.turnSm,results[2].turnSm,1e-9);near(p.speed,speed);assert.ok(Math.hypot(p.pos.x-results[2].pos.x,p.pos.z-results[2].pos.z)<.2,`${speed}m/s travel-loop path differs by less than a collision substep`);}
 }
});
test('actual steering/heading/pose seams cannot mutate wallet, horse XP or saved story',()=>{
 const f=fixture(),before=JSON.stringify(f.save);held(f,2);f.step({keys:{KeyS:true,KeyA:true},target:0});assert.equal(JSON.stringify(f.save),before);assert.equal(f.context.syncSave.name,'syncSave');
 const rider=riderFixture();rider.pose('gallop');assert.equal(JSON.stringify(rider.save),before);
});
test('actual rider follows native gait metadata with seated Western/bareback and English posting',()=>{
 const f=riderFixture();let walk,trot,canter,gallop;
 for(const [gait,set]of [['walk',x=>walk=x],['trot',x=>trot=x],['canterLeft',x=>canter=x],['gallopRight',x=>gallop=x]]){for(let i=0;i<30;i++)set(f.pose(gait));}
 assert.ok(trot.rise>walk.rise+.09);assert.ok(canter.rise<.01&&gallop.rise<.01);assert.ok(gallop.lean>canter.lean&&canter.lean>walk.lean);
 for(const opts of [{western:true},{bareback:true}]){for(let i=0;i<30;i++)f.pose('trot',opts);assert.ok(f.R.pose.rise<.01,'Western/bareback trot stays seated');}
 near(f.R.g.position.x,.01);near(f.R.g.position.y,1.7);near(f.R.g.position.z,.13);
});
test('actual rider and horse bank use actual smoothed turn/yaw, with no idle full-lock lean',()=>{
 const f=riderFixture();for(let i=0;i<20;i++)f.pose('stand',{speed:0,frame:{active:true,turn:1,yawRate:.58}});near(f.R.pose.side,0);assert.ok(f.R.pose.lean<.08);
 for(let i=0;i<20;i++)f.pose('gallopLeft',{speed:15,frame:{active:true,turn:.7,yawRate:.8}});assert.ok(f.R.pose.side>0&&f.R.pose.side<.05);assert.ok(f.R._turn>.69&&f.R._turn<.71);
});
test('a mounted air lock keeps the rider reins with the horse instead of falling back to held raw keys',()=>{
 const f=riderFixture();f.context.keys={KeyA:true};
 f.pose('jump',{speed:7.5,frame:{active:false,reason:'locked',turn:0,yawRate:0}});
 const neutral=riderFixture();neutral.pose('jump',{speed:7.5,frame:{active:false,reason:'locked',turn:0,yawRate:0}});
 near(f.R._turn,0);near(f.R.pose.side,neutral.R.pose.side);
});
test('real native source Walk steps the actual horse at zero measured speed, then settles',()=>{
 const profile=NATIVE_BREED_PROFILES['white-western'],sourceFile='review/native-trot-reference-kit/white/model.glb',{root:skin}=loadNativeHorseFixture(new URL(sourceFile,root));
 const clips=[...clipsFrom(sourceFile),...clipsFrom('assets/'+profile.motionFile.replace(/^\.\//,''))],sourceBefore=JSON.stringify(clips.map(c=>c.toJSON()));
 const scene=new THREE.Group();scene.add(skin);scene.updateMatrixWorld(true);const motion=createNativeHorseMotion({THREE,root:skin,clips,profile}),rig={profile,scene,heroMotion:motion};
 const footBones=[];skin.traverse(o=>{if(o.isBone&&/finger|toe|foot/i.test(o.name))footBones.push(o);});assert.ok(footBones.length>8,'Uses actual authored foot chains');
 tickNativeHorse(rig,0,.25,0);const before=footBones.map(b=>b.getWorldPosition(new THREE.Vector3())),phase=motion.state.phase01;let maxMovement=0;
 for(let i=0;i<60;i++){tickNativeHorse(rig,0,1/60,.8);skin.updateMatrixWorld(true);footBones.forEach((b,j)=>maxMovement=Math.max(maxMovement,b.getWorldPosition(new THREE.Vector3()).distanceTo(before[j])));assert.equal(motion.state.speedMps,0);}
 assert.equal(motion.mode,'walk');assert.equal(motion.clip,profile.nativeGaits.walk.clip);assert.equal(rig.nativeTurningInPlace,true);assert.ok(motion.state.phase01!==phase);assert.ok(maxMovement>.01,'Authored foot bones visibly move while travel remains zero');
 tickNativeHorse(rig,0,.25,0);assert.equal(motion.mode,'stand');assert.equal(rig.nativeTurningInPlace,false);
 tickNativeHorse(rig,0,.2,.8);assert.equal(rig.nativeTurningInPlace,true);assert.equal(startNativeHorseJump(rig),true);tickNativeHorse(rig,0,.1,.8);assert.equal(motion.mode,'jump');assert.equal(rig.nativeTurningInPlace,false,'Jump does not retain the old stepping diagnostic');
 tickNativeHorse(rig,7.5,.2,.8);assert.equal(motion.state.grounded,false,'Actual native jump clock reports airborne');
 const live=fixture({speed:7.5});live.context.RIG=rig;live.context.player.y=rig.heroJumpExtra;const result=live.step();assert.equal(result.mountedHorse,true);assert.equal(result.frame.reason,'locked');near(live.context.player.heading,0);near(live.context.player.speed,7.5);assert.ok(Math.hypot(live.context.player.pos.x,live.context.player.pos.z)>.12,'Real native airborne state keeps ordinary forward displacement');
 assert.equal(JSON.stringify(clips.map(c=>c.toJSON())),sourceBefore,'Actual source clip keyframes stay untouched');motion.dispose();
});

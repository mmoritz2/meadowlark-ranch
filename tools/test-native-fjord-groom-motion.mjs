/* Actual Fjord deformation and native controller/groom regression, no WebGL.
 * Run from the repository: node tools/test-native-fjord-groom-motion.mjs */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import * as THREE from '../assets/vendor/three/build/three.module.js';
import {loadNativeHorseFixture} from './test-native-horse-actions.mjs';
import {createNativeHorseMotion} from '../assets/native-horse-motion.js';
import {applyNativeFjordGroom} from '../assets/native-fjord-groom.js';
import {nativeRosterProfiles} from '../assets/native-roster.js';
import {NATIVE_BREED_PROFILES} from '../assets/native-breed-profiles.js';

const source='review/native-trot-reference-kit/white/model.glb';
const variants=JSON.parse(fs.readFileSync('assets/models/native-roster/manifest.json'));
const profile=nativeRosterProfiles(JSON.parse(fs.readFileSync('assets/models/artist-breeds/manifest.json')),variants,NATIVE_BREED_PROFILES['white-western']).fjord;
const groomSpec=profile.nativeVariant.groom.uprightCrest;
assert(groomSpec?.colorCards?.length===278,'Tests the new 212-card mane and 66-card forelock');
const digest=bytes=>createHash('sha256').update(bytes).digest('hex'),point=new THREE.Vector3(),otherPoint=new THREE.Vector3();
const sourceFiles=[source,'assets/'+profile.nativeVariant.file,'assets/'+profile.motionFile],fileHashes=sourceFiles.map(p=>digest(fs.readFileSync(p)));
function geometryState(meshes){const h=createHash('sha256');for(const m of meshes){for(const [key,a]of Object.entries(m.geometry.attributes)){h.update(key);h.update(Buffer.from(a.array.buffer));}if(m.geometry.index)h.update(Buffer.from(m.geometry.index.array.buffer));h.update(JSON.stringify(m.skeleton.boneInverses.map(b=>b.elements)));}return h.digest('hex');}
function fixture(){
 const {root,body}=loadNativeHorseFixture(source),meshes=[];root.traverse(o=>{if(o.isSkinnedMesh)meshes.push(o);});
 const scene=new THREE.Group(),normalization=new THREE.Group();normalization.position.fromArray(profile.nativeTranslation);normalization.add(root);scene.add(normalization);scene.scale.setScalar(profile.fitScale);const actor=new THREE.Group();actor.add(scene);actor.updateMatrixWorld(true);
 const hair=meshes.find(m=>m.geometry.attributes.position.count===23514),anchors=groomSpec.colorCards.map(card=>{let highest=-Infinity,index=card.start;for(let i=card.start;i<card.start+card.count;i++){hair.getVertexPosition(i,point);hair.localToWorld(point);if(point.y>highest){highest=point.y;index=i;}}return index;});
 const data=fs.readFileSync('assets/'+profile.nativeVariant.file);
 for(const r of profile.nativeVariant.meshes){const m=meshes.find(m=>m.geometry.attributes.position.count===r.vertexCount),a=m.geometry.attributes.position.array,d=r.positionDelta;for(let i=0;i<d.count;i++)a[i]+=data.readInt16LE(d.byteOffset+2*i)*d.scale;}
 hair.material.name='M_Hair';const rig={profile,scene,materials:meshes.map(m=>m.material)};assert.equal(applyNativeFjordGroom({THREE,rig}).cards,278);
 actor.updateMatrixWorld(true);return {root,body,hair,meshes,scene,actor,anchors};
}

// Use the bundled loader's exact cubic interpolation for native gait tracks.
const loader=fs.readFileSync('assets/vendor/three/examples/jsm/loaders/GLTFLoader.js','utf8');
const cubicStart=loader.indexOf('class GLTFCubicSplineInterpolant'),cubicEnd=loader.indexOf('/*********************************/',cubicStart);
const cubic=new Function('Interpolant','Quaternion',loader.slice(cubicStart,cubicEnd)+';return [GLTFCubicSplineInterpolant,GLTFCubicSplineQuaternionInterpolant];')(THREE.Interpolant,THREE.Quaternion);
// Decode only the actual source/motion keyframes. No procedural test poses.
function clipsFrom(file){
 const bytes=fs.readFileSync(file),len=bytes.readUInt32LE(12),d=JSON.parse(bytes.subarray(20,20+len)),bin=bytes.subarray(28+len);
 function array(i){const a=d.accessors[i],view=d.bufferViews[a.bufferView],size={SCALAR:1,VEC3:3,VEC4:4}[a.type],out=new Float32Array(a.count*size);assert.equal(a.componentType,5126);for(let n=0;n<a.count;n++)for(let k=0;k<size;k++)out[n*size+k]=bin.readFloatLE((view.byteOffset||0)+(a.byteOffset||0)+n*(view.byteStride||size*4)+k*4);return out;}
 return d.animations.map(a=>new THREE.AnimationClip(a.name,-1,a.channels.map(c=>{const s=a.samplers[c.sampler],kind=c.target.path,name=d.nodes[c.target.node].name,Track=kind==='rotation'?THREE.QuaternionKeyframeTrack:THREE.VectorKeyframeTrack;assert(['LINEAR','STEP','CUBICSPLINE',undefined].includes(s.interpolation));const track=new Track(name+'.'+({rotation:'quaternion',translation:'position',scale:'scale'}[kind]),array(s.input),array(s.output),s.interpolation==='STEP'?THREE.InterpolateDiscrete:THREE.InterpolateLinear);if(s.interpolation==='CUBICSPLINE'){track.createInterpolant=function(result){return new cubic[kind==='rotation'?1:0](this.times,this.values,this.getValueSize()/3,result);};track.createInterpolant.isInterpolantFactoryMethodGLTFCubicSpline=true;}return track;})));}

// Same production controller, only the inertial-groom factory removed for the
// comparator. Source mixer, authored hoof flex and action paths remain real.
const motionURL=pathToFileURL(process.cwd()+'/assets/native-horse-motion.js');
let plainSource=fs.readFileSync(motionURL,'utf8'),replacements=0;
plainSource=plainSource.replace(/import \{createNativeGroomLayer\} from '[^']+';/,()=>{replacements++;return 'const createNativeGroomLayer=()=>null;';});
assert.equal(replacements,1);plainSource=plainSource.replace(/from '(\.\/[^']+)'/g,(_,s)=>'from '+JSON.stringify(new URL(s,motionURL).href));
const {createNativeHorseMotion:createPlainMotion}=await import('data:text/javascript;base64,'+Buffer.from(plainSource).toString('base64'));
const extra=clipsFrom('assets/'+profile.motionFile),replaced=new Set(extra.map(c=>c.name)),clips=[...clipsFrom(source).filter(c=>!replaced.has(c.name)),...extra];
const clipHash=digest(JSON.stringify(clips.map(c=>c.toJSON())));
const live=fixture(),plain=fixture();
const beforeLive=geometryState(live.meshes),beforePlain=geometryState(plain.meshes);
const sourceLocals=f=>f.body.skeleton.bones.map(b=>({name:b.name,parent:b.parent.name,p:b.position.toArray(),q:b.quaternion.toArray(),s:b.scale.toArray()}));
const initialLocals=sourceLocals(live);
const motion=createNativeHorseMotion({THREE,root:live.root,profile,clips,deferGroom:true}),baseline=createPlainMotion({THREE,root:plain.root,profile,clips,deferGroom:true});
assert.equal(motion.groomInertia.validation.controls,58,'All 58 audited inertial controls stay enabled');assert.equal(baseline.groomInertia,null);
motion.reset();baseline.reset();live.actor.updateMatrixWorld(true);plain.actor.updateMatrixWorld(true);
const crestMask=live.hair.geometry.attributes.nativeFjordCard.array,sourceHair=live.hair.geometry.attributes.position.array.slice();
assert.equal(crestMask.filter(v=>v>0).length,11300);
function world(mesh,index,out){mesh.getVertexPosition(index,out);return mesh.localToWorld(out);}
const cardRadii=groomSpec.colorCards.map((card,n)=>{const a=world(live.hair,live.anchors[n],new THREE.Vector3());let radius=0;for(let i=card.start;i<card.start+card.count;i++)radius=Math.max(radius,world(live.hair,i,point).distanceTo(a));return radius;});
assert(Math.max(...cardRadii)<.19,'Trim begins as a short native-card crest');
const protectedCounts=[16159,2028,13895,5092],report={sourceShape:profile.nativeVariant.sha256,frames:0,sampledPoses:0,verticesPerSample:live.meshes.reduce((n,m)=>n+m.geometry.attributes.position.count,0),maxProtectedDeltaM:0,maxCrestInertiaM:0,maxOtherHairInertiaM:0,maxCrestRadiusM:0,maxCrestStretch:0,maxAddedWorldAngleDeg:0,minHairFloorM:Infinity,minCrestFloorM:Infinity,modes:[]};
const startFeet=[];let originalFloor=Infinity;
for(let i=0;i<live.body.geometry.attributes.position.count;i++){world(live.body,i,point);originalFloor=Math.min(originalFloor,point.y);if(point.y<.20)startFeet.push(i);}
assert(startFeet.length>400);const eyeMask=new Set();for(let i=0;i<crestMask.length;i++)if(!crestMask[i]){world(live.hair,i,point);if(point.z>.8&&point.y>1)eyeMask.add(i);}
let time=0,travel=new THREE.Vector3();
function sample(label){
 const summary=report.modes.find(m=>m.mode===label);report.sampledPoses++;
 const inverseActor=new THREE.Matrix4().copy(live.actor.matrixWorld).invert();
 for(let mi=0;mi<live.meshes.length;mi++){
  const mesh=live.meshes[mi],peer=plain.meshes[mi],count=mesh.geometry.attributes.position.count;
  for(let i=0;i<count;i++){
   world(mesh,i,point);world(peer,i,otherPoint);assert(point.toArray().every(Number.isFinite)&&otherPoint.toArray().every(Number.isFinite),label+' every skinned vertex finite');
   const delta=point.distanceTo(otherPoint);
   if(protectedCounts.includes(count)){report.maxProtectedDeltaM=Math.max(report.maxProtectedDeltaM,delta);assert(delta<1e-10,label+' protected body/eye/tack vertex changed: '+count+'/'+i);}
   else {const crest=crestMask[i]>0;report[crest?'maxCrestInertiaM':'maxOtherHairInertiaM']=Math.max(report[crest?'maxCrestInertiaM':'maxOtherHairInertiaM'],delta);summary.maxHairDeltaM=Math.max(summary.maxHairDeltaM,delta);point.applyMatrix4(inverseActor);report.minHairFloorM=Math.min(report.minHairFloorM,point.y);summary.minHairY=Math.min(summary.minHairY,point.y);if(crest)report.minCrestFloorM=Math.min(report.minCrestFloorM,point.y);assert(point.y>-.004,label+' hair crosses the local ground: '+point.y);}
  }
 }
 for(const i of startFeet){assert(world(live.body,i,point).distanceTo(world(plain.body,i,otherPoint))<1e-10,label+' sole contact unchanged');}
 for(let n=0;n<groomSpec.colorCards.length;n++){
  const card=groomSpec.colorCards[n],anchor=world(live.hair,live.anchors[n],new THREE.Vector3());let radius=0;
  for(let i=card.start;i<card.start+card.count;i++)radius=Math.max(radius,world(live.hair,i,point).distanceTo(anchor));
  report.maxCrestRadiusM=Math.max(report.maxCrestRadiusM,radius);report.maxCrestStretch=Math.max(report.maxCrestStretch,radius/cardRadii[n]);
  assert(radius<.28&&radius/cardRadii[n]<1.8,label+' unreasonable upright-card deformation: '+n+' radius='+radius+' ratio='+radius/cardRadii[n]);
 }
}
const stages=[['rest','rest',2,0],['idle','stand',4,0],['walk','walk',3,2],['trot','trot',2,4.2],['canter-left','canter',2,7.5,'left'],['canter-right','canter',2,7.5,'right'],['gallop-left','gallop',2,15,'left'],['gallop-right','gallop',2,15,'right'],['jump','jump',1.95,7.5],['settle','rest',2,0]];
for(const [label,mode,duration,speed,lead='left']of stages){
 report.modes.push({mode:label,maxHairDeltaM:0,minHairY:Infinity});motion.set(mode,{lead,speedMps:speed});baseline.set(mode,{lead,speedMps:speed});
 for(let frame=0;frame<Math.ceil(duration*60);frame++){
  const dt=1/60;time+=dt;motion.update(dt,{rate:1});baseline.update(dt,{rate:1});
  // Real late-frame finalization after rider travel, turns and jump lift.
  const yaw=.13*Math.sin(time*.7);travel.x+=Math.sin(yaw)*speed*dt;travel.z+=Math.cos(yaw)*speed*dt;
  for(const [f,m]of [[live,motion],[plain,baseline]]){f.actor.position.copy(travel);f.actor.position.y=m.state.bodyLiftM*profile.fitScale;f.actor.rotation.y=yaw;f.actor.updateMatrixWorld(true);m.finishGroomPose();f.actor.updateMatrixWorld(true);}
  const state=motion.groomInertia.snapshot();assert(state.finite);assert.equal(state.sourceControllerUpdatesOwned,0);report.maxAddedWorldAngleDeg=Math.max(report.maxAddedWorldAngleDeg,state.maxAddedWorldAngleDeg);report.frames++;
  if(frame%8===0||frame===Math.ceil(duration*60)-1)sample(label);
 }
}
assert(report.maxProtectedDeltaM<1e-10);assert(report.maxCrestInertiaM>.001&&report.maxCrestInertiaM<.08,'Crest inertia is visible but restrained');assert(report.maxOtherHairInertiaM<.14,'Tail inertia stays bounded');assert(report.maxAddedWorldAngleDeg<=4.00001,'Audited world-angle caps hold');
assert.equal(geometryState(live.meshes),beforeLive);assert.equal(geometryState(plain.meshes),beforePlain);assert.deepEqual(live.hair.geometry.attributes.position.array,sourceHair);assert.equal(digest(JSON.stringify(clips.map(c=>c.toJSON()))),clipHash,'All source gait tracks unchanged');
motion.reset();baseline.reset();live.actor.updateMatrixWorld(true);plain.actor.updateMatrixWorld(true);assert.deepEqual(sourceLocals(live),sourceLocals(plain),'Reset clears every additive groom pose');
motion.dispose();motion.dispose();baseline.dispose();assert.deepEqual(sourceLocals(live),initialLocals,'Disposal restores exact original bone transforms and hierarchy');assert.equal(geometryState(live.meshes),beforeLive,'Disposal leaves packed-derived geometry and bind matrices unchanged');assert.deepEqual(sourceFiles.map(p=>digest(fs.readFileSync(p))),fileHashes,'No source/model/motion file mutation');
console.log(JSON.stringify(report,null,2));console.log('Fjord animated groom: full native clips, late-frame inertia, protected contacts, finite full skin, bounded crest/tail, reset/disposal and immutable assets passed.');

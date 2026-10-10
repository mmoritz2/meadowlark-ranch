import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from '../assets/vendor/three/build/three.module.js';
import {loadNativeHorseFixture} from './test-native-horse-actions.mjs';
import {createNativeHorseExpression,sampleNativeHorseExpression} from '../assets/native-horse-expression.mjs';
import {createNativeHorseMotion} from '../assets/native-horse-motion.js';
const V=()=>new THREE.Vector3(),Q=()=>new THREE.Quaternion(),reports=[];
const skins=root=>{const out=[];root.traverse(o=>{if(o.isSkinnedMesh)out.push(o);});return out;};
const poses=root=>{const out=[];root.traverse(o=>out.push([o,...o.position.toArray(),...o.quaternion.toArray(),...o.scale.toArray()]));return out;};
const exactPose=(rows,label)=>{for(const [o,...rest]of rows)assert.deepEqual([...o.position.toArray(),...o.quaternion.toArray(),...o.scale.toArray()],rest,label+' '+o.name);};
const points=mesh=>Array.from({length:mesh.geometry.attributes.position.count},(_,i)=>mesh.getVertexPosition(i,V()).applyMatrix4(mesh.matrixWorld));
function immutable(root){return JSON.stringify(skins(root).map(m=>({uuid:m.geometry.uuid,attrs:Object.entries(m.geometry.attributes).map(([n,a])=>[n,Buffer.from(a.array.buffer,a.array.byteOffset,a.array.byteLength).toString('base64')]),bind:m.bindMatrix.elements,inverses:m.skeleton.boneInverses.map(b=>b.elements),bones:m.skeleton.bones.map(b=>[b.uuid,b.parent?.uuid])})));}
function fixture(file,variant){
 const {root,body}=loadNativeHorseFixture('review/native-trot-reference-kit/'+file+'/model.glb');
 for(const mesh of skins(root))mesh.normalizeSkinWeights();
 if(variant){const data=JSON.parse(fs.readFileSync('assets/models/native-roster/manifest.json')).breeds[variant],bin=fs.readFileSync('assets/'+data.file),meshes=skins(root);assert(data,variant);for(const rec of data.meshes){const m=meshes.find(m=>m.geometry.attributes.position.count===rec.vertexCount),d=rec.positionDelta;for(let i=0;i<d.count;i++)m.geometry.attributes.position.array[i]+=bin.readInt16LE(d.byteOffset+i*2)*d.scale;}}
 return{root,body};
}
function aperture(root,body,calibration){
 return calibration.map(c=>{const eye=root.getObjectByName(c.side==='l'?'eye_l_059':'eye_r_063'),originalCentre=eye.getWorldPosition(V()),centre=root.getObjectByName('head_019').localToWorld(V().fromArray(c.pivot)),out=eye.children[0].getWorldPosition(V()).sub(originalCentre).normalize(),upSource=new THREE.Vector3(0,1,0).applyQuaternion(root.getWorldQuaternion(Q())),axis=V().crossVectors(out,upSource).normalize(),up=V().crossVectors(axis,out),median=ids=>{const values=ids.map(i=>{const p=body.getVertexPosition(i,V()).applyMatrix4(body.matrixWorld).sub(centre);return Math.atan2(p.dot(up),p.dot(out));}).sort((a,b)=>a-b);return values[Math.floor(values.length/2)];};return(median(c.upper)-median(c.lower))*180/Math.PI;});
}
for(const [id,file,variant]of [['white-western','white'],['bay-western','bay'],['bay-sporthorse-native','sporthorse'],['shire','white','shire'],['welsh','white','welsh']]){
 const {root,body}=fixture(file,variant),profile={id,nativeBreed:true,nativeKind:'horse',...(variant?{nativeVariant:{id:variant}}:{})},before=poses(root),saved=immutable(root),meshes=skins(root),base=meshes.map(points),started=performance.now(),layer=createNativeHorseExpression({THREE,root,profile,seed:0}),creationMs=performance.now()-started;
 assert(layer,id+' verified controls');const info=layer.snapshot();assert.equal(info.controls,10);assert.equal(info.blinkSupported,!variant);assert.equal(info.calibration.length,variant?0:2);exactPose(before,'Preparing expressions is read-only');
 const stats={id,creationMs,blinkSupported:info.blinkSupported,openGapDegrees:aperture(root,body,info.calibration),closedGapDegrees:[],maxFootDeltaM:0,maxStirrupDeltaM:0,maxSaddleDeltaM:0,maxBridleDeltaM:0,maxGlobeDeltaM:0,maxLidRadiusChangeM:0,maxUpperSkinDeltaM:0};
 const controls=new Set(['ear_01_l_051','ear_01_r_055','chestiddleslider_00_0191','chestiddleslider_01_r_0194','chestiddleslider_02_0197','chestiddleslider_01_l_0200']);
 // Eyeball-only points are independent of the eyelid surface in the eye mesh.
 const lidJoints=new Set(body.skeleton.bones.map((b,i)=>/^(upper|lower)eyelid_[lr]_\d+$/.test(b.name)?i:-1));lidJoints.delete(-1);
 const bodyIndex=meshes.indexOf(body),floor=Math.min(...base[bodyIndex].map(p=>p.y)),eyeCentres=info.calibration.map(c=>root.getObjectByName('head_019').localToWorld(V().fromArray(c.pivot)));
 for(let step=0;step<=94;step++){
  layer.beforePose();layer.afterPose(step===0?0:.2,{blink:1,ears:1,breathing:1});root.updateMatrixWorld(true);
  assert(skins(root).every(m=>m.skeleton.bones.every(b=>b.matrixWorld.elements.every(Number.isFinite))));
  meshes.forEach((mesh,mi)=>{const current=points(mesh),n=current.length,a=mesh.geometry.attributes;for(let i=0;i<n;i++){
   const d=current[i].distanceTo(base[mi][i]);assert(current[i].toArray().every(Number.isFinite));
   if(n===16159){stats.maxUpperSkinDeltaM=Math.max(stats.maxUpperSkinDeltaM,d);if(base[mi][i].y<floor+.25)stats.maxFootDeltaM=Math.max(stats.maxFootDeltaM,d);}
   if(n===5092)stats.maxSaddleDeltaM=Math.max(stats.maxSaddleDeltaM,d);
   if(n===13895){stats.maxBridleDeltaM=Math.max(stats.maxBridleDeltaM,d);if(i>=2792&&i<=2845||i>=2716&&i<=2769)stats.maxStirrupDeltaM=Math.max(stats.maxStirrupDeltaM,d);}
   let lidWeight=0;for(let c=0;c<4;c++)if(lidJoints.has(a.skinIndex.getComponent(i,c)))lidWeight+=a.skinWeight.getComponent(i,c);
   if(n===2028&&lidWeight<1e-7)stats.maxGlobeDeltaM=Math.max(stats.maxGlobeDeltaM,d);
   if(lidWeight>.97&&eyeCentres.length){const centre=eyeCentres.reduce((best,p)=>p.distanceToSquared(base[mi][i])<best.distanceToSquared(base[mi][i])?p:best);stats.maxLidRadiusChangeM=Math.max(stats.maxLidRadiusChangeM,Math.abs(current[i].distanceTo(centre)-base[mi][i].distanceTo(centre)));}
  }});
 }
 assert.equal(stats.maxFootDeltaM,0,'Source hoof/floor vertices remain exact');assert.equal(stats.maxStirrupDeltaM,0,'Original stirrup contact remains exact');assert.equal(stats.maxGlobeDeltaM,0,'Eyeballs remain in place while lids and lashes close');
 assert(stats.maxBridleDeltaM<.0015,'Ear/headstall influence is bounded below 1.5mm');assert(stats.maxSaddleDeltaM<.0015,'Corrective breathing stays below 1.5mm at tack');assert(stats.maxLidRadiusChangeM<.0015,'Closing lids retain their existing globe clearance to 1.5mm');assert(stats.maxUpperSkinDeltaM>.005&&stats.maxUpperSkinDeltaM<.032);
 layer.reset();layer.afterPose(2.48,{blink:1});stats.closedGapDegrees=aperture(root,body,info.calibration);
 assert.equal(layer.snapshot().blink,1);assert.equal(layer.snapshot().weights.blink,variant?0:1);for(const gap of stats.closedGapDegrees)assert(Math.abs(gap)<2,'Both fitted lid arcs meet without appreciable central gap or crossing');
 const closed=poses(root);layer.afterPose(0,{blink:1});exactPose(closed,'Repeated sample never compounds expressions');
 layer.beforePose();exactPose(before,'beforePose restores every exact original local transform');
 for(const dt of [0,1/240,1/60,.04,.2,3.4,0,.01]){layer.beforePose();layer.afterPose(dt,{blink:1,ears:1,breathing:1});assert(root.matrixWorld.elements.every(Number.isFinite));}
 layer.reset();exactPose(before,'Reset returns source pose');layer.afterPose(1.8,{ears:1});layer.dispose();layer.dispose();exactPose(before,'Idempotent dispose restores source pose');assert.equal(immutable(root),saved,'Geometry, weights, hierarchy and inverse binds stay byte-identical');reports.push(stats);
}

// Same time produces the same deterministic expression regardless of frame size.
for(const dt of [1/30,1/60,1/144]){let t=0;for(let i=0;i<Math.round(6/dt);i++)t+=dt;const a=sampleNativeHorseExpression(t,.32),b=sampleNativeHorseExpression(6,.32);for(const k in a)assert(Math.abs(a[k]-b[k])<1e-10);}
assert.notDeepEqual(sampleNativeHorseExpression(2.45,0),sampleNativeHorseExpression(2.45,.7),'Different actors need not blink/listen in lockstep');

// Use the bundled loader's exact cubic interpolation for native gait tracks.
const loader=fs.readFileSync('assets/vendor/three/examples/jsm/loaders/GLTFLoader.js','utf8');
const cubicStart=loader.indexOf('class GLTFCubicSplineInterpolant'),cubicEnd=loader.indexOf('/*********************************/',cubicStart);
const cubic=new Function('Interpolant','Quaternion',loader.slice(cubicStart,cubicEnd)+';return [GLTFCubicSplineInterpolant,GLTFCubicSplineQuaternionInterpolant];')(THREE.Interpolant,THREE.Quaternion);
// Decode only the actual source/motion keyframes. No procedural test poses.
function sourceClips(file){
 const bytes=fs.readFileSync(file),len=bytes.readUInt32LE(12),d=JSON.parse(bytes.subarray(20,20+len)),bin=bytes.subarray(28+len);
 function array(i){const a=d.accessors[i],view=d.bufferViews[a.bufferView],size={SCALAR:1,VEC3:3,VEC4:4}[a.type],out=new Float32Array(a.count*size);assert.equal(a.componentType,5126);for(let n=0;n<a.count;n++)for(let k=0;k<size;k++)out[n*size+k]=bin.readFloatLE((view.byteOffset||0)+(a.byteOffset||0)+n*(view.byteStride||size*4)+k*4);return out;}
 return d.animations.map(a=>new THREE.AnimationClip(a.name,-1,a.channels.map(c=>{const s=a.samplers[c.sampler],kind=c.target.path,name=d.nodes[c.target.node].name,Track=kind==='rotation'?THREE.QuaternionKeyframeTrack:THREE.VectorKeyframeTrack;assert(['LINEAR','STEP','CUBICSPLINE',undefined].includes(s.interpolation));const track=new Track(name+'.'+({rotation:'quaternion',translation:'position',scale:'scale'}[kind]),array(s.input),array(s.output),s.interpolation==='STEP'?THREE.InterpolateDiscrete:THREE.InterpolateLinear);if(s.interpolation==='CUBICSPLINE'){track.createInterpolant=function(result){return new cubic[kind==='rotation'?1:0](this.times,this.values,this.getValueSize()/3,result);};track.createInterpolant.isInterpolantFactoryMethodGLTFCubicSpline=true;}return track;})));}

const {root,body}=fixture('white'),clips=sourceClips('review/native-trot-reference-kit/white/model.glb'),serial=JSON.stringify(clips.map(c=>c.toJSON())),initial=poses(root),saved=immutable(root);
const idle=clips.find(c=>c.name==='Horse|Horse_Idle'),walk=clips.find(c=>c.name==='Target Native Walk Rollover'),profile={id:'white-western',nativeBreed:true,nativeKind:'horse',nativeIdleClip:idle.name,nativeHoofFlex:false,nativeGaits:{walk:{clip:walk.name,durationS:walk.duration,nominalSpeedMps:1}}};
const motion=createNativeHorseMotion({THREE,root,clips,profile,deferGroom:true});
assert(motion.expression);motion.set('stand');for(let i=0;i<180;i++){motion.update(1/60);motion.finishGroomPose();}
assert.equal(motion.state.expression.weights.ears,0,'Creator idle retains its own listening ears');assert.equal(motion.state.expression.weights.blink,1,'Creator idle has no native blink to override');
assert(motion.state.groomInertia?.finite);motion.set('walk');for(let i=0;i<30;i++){motion.update(1/60);motion.finishGroomPose();}
assert.equal(motion.state.expression.weights.ears,0);assert.equal(motion.state.expression.weights.breathing,0);assert.equal(motion.state.expression.weights.blink,1,'Gaits retain natural blinking without body/leg edits');
motion.set('stand');motion.update(.3);motion.finishGroomPose();assert(motion.startAction('paw'));for(let i=0;i<30;i++){motion.update(1/60);motion.finishGroomPose();}assert.equal(motion.state.expression.weights.ears,1);assert.equal(motion.state.expression.weights.breathing,1);
motion.cancelAction();motion.update(.3);motion.finishGroomPose();assert(motion.startAction('liedown'));for(let i=0;i<30;i++){motion.update(1/60);motion.finishGroomPose();}assert.equal(motion.state.expression.weights.breathing,0,'Resting floor fit remains untouched');
// Compare diagnostic Rest against the same full controller with the expression
// factory disabled: native groom interpolation has its own floating-point pose.
const motionSource=fs.readFileSync('assets/native-horse-motion.js','utf8').replace(/^import \{createNativeHorseExpression\}[^\n]+/m,'const createNativeHorseExpression=()=>null;').replace(/from '(\.\/[^']+)'/g,(_,relative)=>'from '+JSON.stringify(new URL('../assets/'+relative.slice(2),import.meta.url).href));
const {createNativeHorseMotion:withoutExpressions}=await import('data:text/javascript;base64,'+Buffer.from(motionSource).toString('base64'));
const comparator=fixture('white'),baseline=withoutExpressions({THREE,root:comparator.root,clips,profile,deferGroom:true});
motion.reset();baseline.reset();for(let i=0;i<30;i++){motion.update(.1);motion.finishGroomPose();baseline.update(.1);baseline.finishGroomPose();}
const diagnostic=poses(root),expected=poses(comparator.root);assert.equal(diagnostic.length,expected.length);for(let i=0;i<diagnostic.length;i++)assert.deepEqual(diagnostic[i].slice(1),expected[i].slice(1),'Expressions leave diagnostic Rest identical to the same native controller '+diagnostic[i][0].name);baseline.dispose();assert.equal(motion.state.expression.weights.blink,0);
motion.set('stand');motion.update(.1);motion.finishGroomPose();motion.dispose();motion.dispose();exactPose(initial,'Controller disposal restores original skeleton');assert.equal(immutable(root),saved);assert.equal(JSON.stringify(clips.map(c=>c.toJSON())),serial,'Source clip channels are immutable');

// The layer fails closed on unrelated or incomplete skeletons.
assert.equal(createNativeHorseExpression({THREE,root:new THREE.Group(),profile}),null);
assert.equal(createNativeHorseExpression({THREE,root,profile:{...profile,nativeKind:'black-dragon'}}),null);
assert.equal(createNativeHorseExpression({THREE,root,profile:{...profile,nativeExpressions:false}}),null);
const bad=root.getObjectByName('uppereyelid_l_086'),parent=bad.parent;root.add(bad);assert.equal(createNativeHorseExpression({THREE,root,profile}),null);parent.add(bad);
console.log(JSON.stringify(reports,null,2));
console.log('PASS native expressions: three original lid closures, safe draft/pony opt-out, exact feet/stirrups/eyeballs, bounded skin/tack, immutable sources, real clips/groom, ownership, dt, rest, interruption and disposal');

/* Real native geometry fixture, without WebGL, a browser, or texture downloads. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from '../assets/vendor/three/build/three.module.js';
import {loadNativeHorseFixture} from './test-native-horse-actions.mjs';
import {createNativeDraftFeathers} from '../assets/native-draft-feathers.js';
import {nativeRosterProfiles} from '../assets/native-roster.js';
import {NATIVE_BREED_PROFILES} from '../assets/native-breed-profiles.js';
import {CLUB_HORSE_BREEDS} from '../assets/club-horses.js';
import {EXPANSION_HORSE_BREEDS} from '../assets/expansion-horses.js';
import {ROWS as EXTRA_BREEDS} from '../assets/features/new-breeds.js';
import {prepareNativeHoofFlex} from '../assets/native-hoof-flex.mjs';

const source='review/native-trot-reference-kit/white/model.glb';
const variants=JSON.parse(fs.readFileSync('assets/models/native-roster/manifest.json'));
const profiles=nativeRosterProfiles(JSON.parse(fs.readFileSync('assets/models/artist-breeds/manifest.json')),variants,NATIVE_BREED_PROFILES['white-western']);
const rose=CLUB_HORSE_BREEDS.find(row=>row[0]==='rosebloom');
for(const row of [...EXPANSION_HORSE_BREEDS,...EXTRA_BREEDS,...CLUB_HORSE_BREEDS])if(profiles[row[7].body])profiles[row[0]]={...profiles[row[7].body],id:row[0],family:row[7].family||profiles[row[7].body].family,nativeRosterAppearance:{...row[7],body:row[5],mane:row[6]}};
const foundations=['percheron','shire','clyde','vanner'];
const fileHash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const immutableFiles=new Map([source,...new Set(foundations.map(id=>'assets/'+profiles[id].nativeVariant.file))].map(file=>[file,fileHash(file)]));
// The pose-only fixture omits indices. Restore the actual source topology for
// skinned body raycasts used by the new opaque-hoof occlusion measurement.
const bodyIndices=(()=>{const bytes=fs.readFileSync(source),length=bytes.readUInt32LE(12),doc=JSON.parse(bytes.subarray(20,20+length)),bin=bytes.subarray(28+length),primitive=doc.meshes.find(m=>doc.accessors[m.primitives[0].attributes.POSITION].count===16159).primitives[0],a=doc.accessors[primitive.indices],view=doc.bufferViews[a.bufferView],out=new Uint32Array(a.count),size=a.componentType===5123?2:4;assert([5123,5125].includes(a.componentType));for(let i=0;i<a.count;i++){const offset=(view.byteOffset||0)+(a.byteOffset||0)+i*(view.byteStride||size);out[i]=size===2?bin.readUInt16LE(offset):bin.readUInt32LE(offset);}return out;})();
const v=new THREE.Vector3();
function fixture(id){
 const profile=profiles[id],variant=profile.nativeVariant,{root,body}=loadNativeHorseFixture(source),meshes=[];
 root.traverse(o=>{if(o.isSkinnedMesh)meshes.push(o);});body.geometry.setIndex(new THREE.BufferAttribute(bodyIndices.slice(),1));
 const data=fs.readFileSync('assets/'+variant.file);
 for(const r of variant.meshes){const m=meshes.find(m=>m.geometry.attributes.position.count===r.vertexCount),a=m.geometry.attributes.position.array,d=r.positionDelta;for(let i=0;i<d.count;i++)a[i]+=data.readInt16LE(d.byteOffset+2*i)*d.scale;}
 const scene=new THREE.Group(),normalization=new THREE.Group();normalization.position.fromArray(profile.nativeTranslation);normalization.add(root);scene.add(normalization);scene.scale.setScalar(profile.fitScale);scene.updateMatrixWorld(true);
 return {profile,root,scene,body,meshes};
}
function geometryHash(meshes){const h=createHash('sha256');for(const m of meshes){for(const a of Object.values(m.geometry.attributes))h.update(Buffer.from(a.array.buffer));if(m.geometry.index)h.update(Buffer.from(m.geometry.index.array.buffer));}return h.digest('hex');}
function sourceState(f){return JSON.stringify({geometry:geometryHash(f.meshes),materials:f.meshes.map(m=>m.material.uuid),binds:f.meshes.map(m=>[m.bindMatrix.elements,m.skeleton.boneInverses.map(b=>b.elements)]),bones:f.body.skeleton.bones.map(b=>[b.name,b.parent.name,b.position.toArray(),b.quaternion.toArray(),b.scale.toArray()])});}
function bounds(meshes){const b=new THREE.Box3();for(const m of meshes){const p=m.geometry.attributes.position;for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i);if(m.isSkinnedMesh)m.applyBoneTransform(i,v);m.localToWorld(v);assert(v.toArray().every(Number.isFinite));b.expandByPoint(v);}}return b;}
function add(f){return createNativeDraftFeathers({THREE,scene:f.scene,skin:f.body,profile:f.profile});}
// Software rays include the real alpha mask, so broad transparent cards cannot
// pass this visual-density check merely by having a larger bounding box.
function collarCoverage(f,kit){
 f.scene.updateMatrixWorld(true);const coverage=[];
 for(let leg=0;leg<kit.meshes.length;leg++){
  const mesh=kit.meshes[leg],pivot=kit.anchors[leg].pivot.clone();f.scene.localToWorld(pivot);
  const image=mesh.material.map.image,ray=new THREE.Raycaster(),origin=new THREE.Vector3(),direction=new THREE.Vector3();
  for(const view of ['left','right','front','back']){
   let covered=0;const rows=24,columns=48;
   for(let row=0;row<rows;row++)for(let column=0;column<columns;column++){
    // A fixed 14 x 11 cm patch spans the fetlock collar, including its edges.
    const across=(column+.5)/columns*.14-.07,y=pivot.y-.035+(row+.5)/rows*.11;
    if(view==='left'||view==='right'){const sign=view==='left'?1:-1;origin.set(pivot.x+sign,y,pivot.z+across);direction.set(-sign,0,0);}
    else{const sign=view==='front'?1:-1;origin.set(pivot.x+across,y,pivot.z+sign);direction.set(0,0,-sign);}
    ray.set(origin,direction);
    if(ray.intersectObject(mesh,false).some(hit=>{
     const x=Math.min(image.width-1,Math.max(0,Math.floor(hit.uv.x*image.width))),y=Math.min(image.height-1,Math.max(0,Math.floor(hit.uv.y*image.height)));
     return image.data[(y*image.width+x)*4+3]/255>=mesh.material.alphaTest;
    }))covered++;
   }
   coverage.push({leg:kit.anchors[leg].id,view,fraction:covered/(rows*columns)});
  }
 }
 return coverage;
}
// Trace alpha-visible feather in front of the real skinned hoof. A transparent
// terminal vertex or a back lock hidden behind the hoof cannot fake contact.
function hoofCoverage(f,kit){
 const report=[],ray=new THREE.Raycaster(),origin=new THREE.Vector3(),direction=new THREE.Vector3();
 // Cache the actual posed skin once; repeated rays need no repeated CPU skinning.
 const positions=new Float32Array(f.body.geometry.attributes.position.count*3),point=new THREE.Vector3();
 for(let i=0;i<positions.length/3;i++){f.body.getVertexPosition(i,point);point.toArray(positions,i*3);}
 const bodyGeometry=new THREE.BufferGeometry().setAttribute('position',new THREE.BufferAttribute(positions,3));bodyGeometry.setIndex(f.body.geometry.index);
 const posedBody=new THREE.Mesh(bodyGeometry,f.body.material);posedBody.matrixWorld.copy(f.body.matrixWorld);
 for(let leg=0;leg<kit.meshes.length;leg++)for(const view of ['front','side']){
  const mesh=kit.meshes[leg],a=kit.anchors[leg],image=mesh.material.map.image;
  const lo=view==='front'?a.hoofMinX:a.hoofMinZ,hi=view==='front'?a.hoofMaxX:a.hoofMaxZ;
  const centerX=(a.hoofMinX+a.hoofMaxX)*.5,centerZ=(a.hoofMinZ+a.hoofMaxZ)*.5;
  function fraction(height){let covered=0;const columns=32;
   for(let column=0;column<columns;column++){
    const across=lo+(hi-lo)*(column+.5)/columns;
    if(view==='front'){origin.set(across,height,centerZ+1);direction.set(0,0,-1);}else{origin.set(centerX+1,height,across);direction.set(-1,0,0);}
    f.scene.localToWorld(origin);direction.transformDirection(f.scene.matrixWorld);ray.set(origin,direction);
    const body=ray.intersectObject(posedBody,false)[0],visible=ray.intersectObject(mesh,false).some(hit=>{if(body&&hit.distance>body.distance+1e-5)return false;const x=Math.min(image.width-1,Math.max(0,Math.floor(hit.uv.x*image.width))),y=Math.min(image.height-1,Math.max(0,Math.floor(hit.uv.y*image.height)));return image.data[(y*image.width+x)*4+3]/255>=mesh.material.alphaTest;});if(visible)covered++;
   }return covered/columns;
  }
  const nearGround=[.001,.002,.003].map(height=>({heightM:height*f.profile.fitScale,fraction:fraction(height)})),hoofTop=[.012,.025,.04,.055,.07,.085].map(height=>fraction(height));
  report.push({leg:a.id,view,nearGround,hoofCoverage:hoofTop.reduce((a,b)=>a+b,0)/hoofTop.length});
 }
 bodyGeometry.dispose();return report;
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

// Fit and motion invariants replace brittle geometry hashes. Original source
// and derived body files must remain byte-exact; only private feather meshes
// are authored here. All foundations use their actual runtime hoof-flex layer.
const clipCache=new Map();
function approvedClips(profile){
 if(!clipCache.has(profile.motionFile)){
  const extra=clipsFrom('assets/'+profile.motionFile),replaced=new Set(extra.map(c=>c.name));
  clipCache.set(profile.motionFile,[...clipsFrom(source).filter(c=>!replaced.has(c.name)),...extra]);
 }
 return clipCache.get(profile.motionFile);
}
function checkGeometry(kit,id){
 const stats=kit.inspect();assert.equal(stats.drawCalls,4,id+' uses one private mesh per leg');
 assert(stats.strands>=256&&stats.strands<=448,id+' full but bounded lock count');
 assert(stats.triangles<=12000,id+' bounded feather triangle budget');
 assert(stats.finiteAnchors&&stats.skinSamples.every(n=>n>50),id+' roots fit actual leg skin');
 for(const mesh of kit.meshes){
  const g=mesh.geometry,p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv;
  assert(mesh.parent.isBone&&kit.anchors.some(a=>a.pastern===mesh.parent),id+' exact pastern attachment');
  assert(p&&n&&uv&&p.count===n.count&&p.count===uv.count&&g.index.count%3===0);
  assert(p.array.every(Number.isFinite)&&n.array.every(Number.isFinite)&&uv.array.every(Number.isFinite));
  assert(g.index.array.every(i=>i<p.count),'Bounded feather indices');
  for(let i=0;i<n.count;i++)assert(Math.abs(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))-1)<1e-4,'Unit feather normals');
  const image=mesh.material.map.image,alphas=image.data.filter((_,i)=>i%4===3);
  assert(alphas.some(a=>a>0&&a<255)&&alphas.some(a=>a/255<mesh.material.alphaTest)&&alphas.some(a=>a/255>=mesh.material.alphaTest),'Soft fibers retain transparent edge and opaque core');
 }
 return stats;
}
function featherArrays(kit){return kit.meshes.map(m=>({position:m.geometry.attributes.position.array.slice(),normal:m.geometry.attributes.normal.array.slice()}));}
function assertFeatherPositions(kit,expected,label){for(let m=0;m<kit.meshes.length;m++)assert.deepEqual(kit.meshes[m].geometry.attributes.position.array,expected[m].position,label);}
function assertFeatherArrays(kit,expected,label){for(let m=0;m<kit.meshes.length;m++)for(const key of ['position','normal'])assert.deepEqual(kit.meshes[m].geometry.attributes[key].array,expected[m][key],label);}
function offsets(kit,rest){
 const legs=[],linear=new THREE.Matrix3(),d=new THREE.Vector3();let maximum=0;
 for(let m=0;m<kit.meshes.length;m++){
  const mesh=kit.meshes[m],p=mesh.geometry.attributes.position,uv=mesh.geometry.attributes.uv;assert(mesh.geometry.attributes.normal.array.every(Number.isFinite),'Finite dynamic feather normals');linear.setFromMatrix4(mesh.matrixWorld);let peak=0;
  for(let i=0;i<p.count;i++){
   if(uv.getY(i)===0)for(let c=0;c<3;c++)assert.equal(p.array[i*3+c],rest[m].position[i*3+c],'Growing roots remain attached bit-exact');
   d.set(p.getX(i)-rest[m].position[i*3],p.getY(i)-rest[m].position[i*3+1],p.getZ(i)-rest[m].position[i*3+2]).applyMatrix3(linear);
   assert(d.toArray().every(Number.isFinite),'Finite dynamic feather vertices');peak=Math.max(peak,d.length());
  }
  legs.push(peak);maximum=Math.max(maximum,peak);
 }
 assert(maximum<.045,'Added feather deformation remains below45mm at normal actor scale: '+maximum);return{maximum,legs};
}
function tipOffsets(kit,rest){
 const values=[],linear=new THREE.Matrix3(),d=new THREE.Vector3();
 for(let m=0;m<kit.meshes.length;m++){const mesh=kit.meshes[m],p=mesh.geometry.attributes.position,uv=mesh.geometry.attributes.uv;linear.setFromMatrix4(mesh.matrixWorld);
  for(let i=0;i<p.count;i++)if(uv.getY(i)===1&&uv.getX(i)===.5){d.set(p.getX(i)-rest[m].position[i*3],p.getY(i)-rest[m].position[i*3+1],p.getZ(i)-rest[m].position[i*3+2]).applyMatrix3(linear);values.push(...d.toArray());}
 }return values;
}
function auditSway(f,kit){
 assert.equal(typeof kit.update,'function','Feathers expose leg-driven update');assert.equal(typeof kit.reset,'function','Feathers expose exact reset');
 const before=sourceState(f),rest=featherArrays(kit),geometries=kit.meshes.map(m=>m.geometry);kit.reset();
 for(let i=0;i<60;i++)kit.update(1/60);assertFeatherPositions(kit,rest,'Still horse has no invented periodic hair motion');
 const savedPosition=f.scene.position.clone(),savedRotation=f.scene.quaternion.clone();
 for(let i=1;i<=20;i++){f.scene.position.set(i*.07,.2,-i*.04);f.scene.rotation.y=i*.025;f.scene.updateMatrixWorld(true);kit.update(1/60);}
 assertFeatherPositions(kit,rest,'Actor-only translation/yaw cannot excite scene-local leg sway');f.scene.position.copy(savedPosition);f.scene.quaternion.copy(savedRotation);f.scene.updateMatrixWorld(true);kit.reset();
 // A single-leg diagnostic proves independent inputs. Actual clearance below
 // still uses only the production gait clips, never these controlled rotations.
 const driven=kit.anchors[0].pastern,q=driven.quaternion.clone(),turn=new THREE.Quaternion(),axis=new THREE.Vector3(1,0,0);let singleLegPeak=0;
 kit.update(1/60);
 for(let i=1;i<=24;i++){turn.setFromAxisAngle(axis,.18*Math.sin(i/24*Math.PI*.5));driven.quaternion.copy(q).multiply(turn);f.scene.updateMatrixWorld(true);kit.update(1/60);const delta=offsets(kit,rest);singleLegPeak=Math.max(singleLegPeak,delta.legs[0]);for(let leg=1;leg<4;leg++)assert.equal(delta.legs[leg],0,'Stationary legs cannot inherit another leg spring');}
 assert(singleLegPeak>.0005,'Leg rotation produces measurable tip lag');
 const paused=featherArrays(kit);for(const dt of [0,-1,NaN,undefined]){kit.update(dt);assertFeatherArrays(kit,paused,'No/invalid elapsed time preserves paused arrays');}kit.update(1/60,{paused:true});assertFeatherArrays(kit,paused,'Explicit pause preserves arrays');
 for(let i=0;i<240;i++)kit.update(1/60);const held=featherArrays(kit);kit.reset();kit.update(1/60);const settled=offsets(kit,held).maximum;assert(settled<Math.max(.00025,singleLegPeak*.10),'A held leg damps without sustained flutter');
 kit.update(1000);assertFeatherArrays(kit,rest,'Large frame gap safely reseeds without impulse');kit.reset();assertFeatherArrays(kit,rest,'Reset restores exact authored positions and normals');
 driven.quaternion.copy(q);f.scene.updateMatrixWorld(true);kit.reset();
 function timed(fps){
  const clips=approvedClips(f.profile),prepared=prepareNativeHoofFlex({THREE,root:f.root,clips,profile:f.profile}),mixer=new THREE.AnimationMixer(f.root),clip=THREE.AnimationClip.findByName(prepared.clips,f.profile.nativeGaits.trot.clip),action=mixer.clipAction(clip).play(),samples=[];
  const pose=t=>{prepared.layer?.beforePose();mixer.setTime(t);f.scene.updateMatrixWorld(true);prepared.layer?.afterPose(new Map([[action,1]]));f.scene.updateMatrixWorld(true);};
  pose(0);kit.reset();kit.update(1/fps);
  for(let i=1;i<=fps*1.2;i++){pose(i/fps);kit.update(1/fps);offsets(kit,rest);if(i%(fps/10)===0)samples.push(tipOffsets(kit,rest));}
  prepared.layer?.beforePose();action.stop();prepared.layer?.dispose();mixer.uncacheRoot(f.root);f.scene.updateMatrixWorld(true);kit.reset();return samples;
 }
 const thirty=timed(30),sixty=timed(60),oneTwenty=timed(120),difference=(a,b)=>{assert.equal(a.length,b.length);let max=0;for(let t=0;t<a.length;t++)for(let i=0;i<a[t].length;i+=3)max=Math.max(max,Math.hypot(a[t][i]-b[t][i],a[t][i+1]-b[t][i+1],a[t][i+2]-b[t][i+2]));return max;};
 const rate30vs60=difference(thirty,sixty),rate60vs120=difference(sixty,oneTwenty);assert(rate30vs60<.005,'30/60Hz common-time tips agree within5mm: '+rate30vs60);assert(rate60vs120<.003,'60/120Hz tips agree within3mm: '+rate60vs120);
 assertFeatherArrays(kit,rest,'Repeated gait sampling resets feather arrays exactly');assert(kit.meshes.every((m,i)=>m.geometry===geometries[i]),'Motion reuses its four private geometry buffers');assert.equal(sourceState(f),before,'Sway never changes source rig, mesh, weights, materials or binds');
 return{singleLegPeakM:singleLegPeak,heldLegSettledM:settled,rate30vs60MaxM:rate30vs60,rate60vs120MaxM:rate60vs120};
}
function auditMotion(f,kit){
 const before=sourceState(f),restArrays=featherArrays(kit),clips=approvedClips(f.profile),clipState=JSON.stringify(clips.map(c=>c.toJSON()));
 const prepared=prepareNativeHoofFlex({THREE,root:f.root,clips,profile:f.profile}),mixer=new THREE.AnimationMixer(f.root);
 const wanted=[...new Set([f.profile.nativeIdleClip,...Object.values(f.profile.nativeGaits).map(g=>g.clip),f.profile.nativeJump.clip])];
 const standingFloor=bounds([f.body]).min.y,feet=[];
 for(let i=0;i<f.body.geometry.attributes.position.count;i++){f.body.getVertexPosition(i,v);f.body.localToWorld(v);if(v.y<standingFloor+.25)feet.push(i);}
 assert(feet.length>500,'Actual four-hoof surface coverage');
 const tack=f.meshes.find(m=>m.geometry.attributes.position.count===13895),treadIndices=[2716,2742,2769,2792,2818,2845];
 let minimumRelativeFloor=Infinity,minimumTreadClearance=Infinity,minimumTrotFloor=Infinity,poses=0,maximumAddedTipMotion=0;const legPeaks=[0,0,0,0];
 const byClip=[];
 for(const name of wanted){
  const clip=THREE.AnimationClip.findByName(prepared.clips,name);assert(clip,f.profile.id+' approved clip exists: '+name);
  const action=mixer.clipAction(clip).setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();
  kit.reset();let relative=Infinity,absolute=Infinity;
  for(let sample=0;sample<=40;sample++){
   // Advance actual game-sized frames between measurement checkpoints. Idle
   // lasts14 seconds; a349ms test jump would correctly reset the controller.
   const interval=clip.duration/40,steps=sample===0?1:Math.max(1,Math.ceil(interval*60));
   for(let step=1;step<=steps;step++){
    const time=sample===0?0:(sample-1)*interval+step/steps*interval;
    prepared.layer?.beforePose();mixer.setTime(time);f.scene.updateMatrixWorld(true);
    prepared.layer?.afterPose(new Map([[action,1]]));f.scene.updateMatrixWorld(true);
    if(sample===0)kit.reset();kit.update(sample===0?1/60:interval/steps);
   }
   const sway=offsets(kit,restArrays);maximumAddedTipMotion=Math.max(maximumAddedTipMotion,sway.maximum);for(let leg=0;leg<4;leg++)legPeaks[leg]=Math.max(legPeaks[leg],sway.legs[leg]);
   let sole=Infinity;for(const i of feet){f.body.getVertexPosition(i,v);f.body.localToWorld(v);sole=Math.min(sole,v.y);}
   const b=bounds(kit.meshes);relative=Math.min(relative,b.min.y-sole);absolute=Math.min(absolute,b.min.y);
   if(kit.foundation==='percheron')assert(b.min.y>=sole-.006,f.profile.id+' '+name+' preserves lighter native-sole clearance');
   else assert(b.min.y>=-1e-5,f.profile.id+' '+name+' phase '+sample/40+' ground-brushing hair cannot plunge below ground: '+b.min.y);
   const treads=treadIndices.map(i=>{const p=tack.getVertexPosition(i,new THREE.Vector3());return tack.localToWorld(p);});
   for(const mesh of kit.meshes)for(let i=0;i<mesh.geometry.attributes.position.count;i+=14){mesh.localToWorld(v.fromBufferAttribute(mesh.geometry.attributes.position,i));for(const tread of treads)minimumTreadClearance=Math.min(minimumTreadClearance,v.distanceTo(tread));}
   poses++;
  }
  if(name===f.profile.nativeGaits.trot.clip)minimumTrotFloor=absolute;
  minimumRelativeFloor=Math.min(minimumRelativeFloor,relative);byClip.push({name,minimumRelativeFloorM:relative,minimumAbsoluteFloorM:absolute});
  prepared.layer?.beforePose();action.stop();
 }
 prepared.layer?.dispose();mixer.uncacheRoot(f.root);f.scene.updateMatrixWorld(true);kit.reset();
 assert(legPeaks.every(peak=>peak>.0005),f.profile.id+' each moving leg produces visible extra tip motion');assertFeatherArrays(kit,restArrays,'Final gait reset restores base feather geometry');
 if(kit.foundation==='percheron')assert(minimumTrotFloor>.005,'Lighter Percheron retains5mm Trot gap');else assert(minimumTrotFloor>=-1e-5,'Heavy Trot hair brushes without penetrating ground');
 assert(minimumTreadClearance>.14,f.profile.id+' preserves14cm original stirrup clearance');
 assert.equal(JSON.stringify(clips.map(c=>c.toJSON())),clipState,'Original clips remain immutable');
 assert.equal(sourceState(f),before,'Motion returns exact original bones, geometry, materials and contact transforms');
 return{poses,clips:wanted.length,maximumAddedTipMotionM:maximumAddedTipMotion,perLegPeakMotionM:legPeaks,minimumRelativeFloorM:minimumRelativeFloor,minimumTrotFloorM:minimumTrotFloor,minimumTreadClearanceM:minimumTreadClearance,byClip};
}
const report=[],fitted=new Map(),coverageFailures=[];
for(const id of foundations){
 const f=fixture(id),before=sourceState(f),kit=add(f);assert(kit,id+' has visible feathers');
 const stats=checkGeometry(kit,id);assert.equal(add(f),kit,'Idempotent initialization');assert.equal(sourceState(f),before,'Private installation leaves source unchanged');
 const rest=bounds(kit.meshes),floor=bounds([f.body]).min.y,coverage=collarCoverage(f,kit);
 const minimumCoverage=id==='percheron'?.50:.65; // Light Percheron collar vs full heavy-breed feather.
 for(const view of coverage)if(view.fraction<=minimumCoverage)coverageFailures.push({id,...view,minimumCoverage});
 const heavy=id!=='percheron',hoof=heavy?hoofCoverage(f,kit):null;
 // Explicitly requested ground-reaching heavy feather replaces the hover gap.
 if(!heavy)assert(rest.min.y-floor>.020,'Lighter Percheron keeps its20mm rest margin');
 else{for(const mesh of kit.meshes){const gap=bounds([mesh]).min.y-floor;assert(gap>=-1e-5&&gap<=.002,id+' every hoof has ground-reaching tips: '+gap);}for(const view of hoof){assert(view.nearGround.some(row=>row.fraction>=.12),id+' '+view.leg+' '+view.view+' visible fibers reach the lower3mm band');assert(view.hoofCoverage>.50,id+' '+view.leg+' '+view.view+' hair visibly covers the hoof');}}
 if(id==='vanner')assert(rest.max.y<.32,'Vanner retains its existing32cm lower-cannon limit');
 const cannonClearances=kit.meshes.map((mesh,i)=>{const a=kit.anchors[i],top=f.scene.localToWorld(a.top.clone()).y,pivot=f.scene.localToWorld(a.pivot.clone()).y;return(top+pivot)*.5-bounds([mesh]).max.y;});
 assert(cannonClearances.every(gap=>gap>0),id+' feather stays below anatomical mid-cannon on every leg');
 const naturalColor=kit.meshes[0].material.color.clone();kit.setColors({maneColor:'#000000'});
 assert(kit.meshes[0].material.color.equals(naturalColor),'Natural stocking color is independent of mane paint');
 if(id==='vanner')assert.equal(naturalColor.getHexString(),'f1ede4','Natural Vanner retains soft white stockings');
 const motion=auditMotion(f,kit),sway=auditSway(f,kit);fitted.set(id,{f,kit,before,geometry:geometryHash(kit.meshes)});
 report.push({id,...stats,requiredCollarCoverage:minimumCoverage,minimumCollarCoverage:Math.min(...coverage.map(x=>x.fraction)),coverage,standingSoleClearanceM:rest.min.y-floor,minimumCannonMidpointClearanceM:Math.min(...cannonClearances),hoofCoverage:hoof,...motion,sway});
}
// Every existing alias inherits geometry and motion from the tested foundation,
// including the formerly missing Percheron family. Color stays actor-private.
const aliases=[];
for(const [id,profile]of Object.entries(profiles)){
 if(foundations.includes(id))continue;
 if(!foundations.includes(profile.nativeVariant.id)){
  assert.equal(createNativeDraftFeathers({THREE,scene:new THREE.Group(),skin:{},profile}),null,id+' remains unfeathered');continue;
 }
 const f=fixture(id),before=sourceState(f),kit=add(f),base=fitted.get(profile.nativeVariant.id);
 assert.equal(kit.foundation,profile.nativeVariant.id,id+' correct foundation');
 assert.equal(geometryHash(kit.meshes),base.geometry,id+' identical anatomical feather fit');
 assert.deepEqual(profile.nativeGaits,base.f.profile.nativeGaits,id+' uses tested gait mapping');
 assert.notEqual(kit.meshes[0].material,base.kit.meshes[0].material,id+' owns private material');
 if(id==='rosebloom')assert(kit.meshes[0].material.color.equals(new THREE.Color(rose[6]).lerp(new THREE.Color('#e6e0d4'),.42)),'Fantasy alias starts with its existing approved feather pigment');
 const baseColor=base.kit.meshes[0].material.color.clone();kit.setColors({maneColor:'#548b80'});
 assert(base.kit.meshes[0].material.color.equals(baseColor),'Alias dye never leaks to foundation');
 if(id==='rosebloom')assert(kit.meshes[0].material.color.equals(new THREE.Color('#548b80').lerp(new THREE.Color('#e6e0d4'),.42)),'Fantasy feathers accept approved mane shading');
 kit.dispose();assert.equal(sourceState(f),before,'Alias disposal preserves source');aliases.push({id,foundation:profile.nativeVariant.id});
}
for(const [id,foundation]of [['belgian','percheron'],['suffolk','percheron'],['rosebloom','vanner'],['tempest','clyde']])assert(aliases.some(a=>a.id===id&&a.foundation===foundation),id+' explicit inheritance coverage');
// A translated/yawed/scaled actor has identical local feather fit. Intentionally
// leave transforms dirty: setup must refresh the native skin inverse bind, not
// silently fall back to guessed radii when the horse has moved in the ranch.
{
 const f=fixture('shire'),before=sourceState(f),parent=new THREE.Group();parent.position.set(8,.4,-9);parent.rotation.y=.6;parent.scale.setScalar(1.37);parent.add(f.scene);
 const kit=add(f),base=fitted.get('shire').kit;assert.deepEqual(kit.inspect().skinSamples,base.inspect().skinSamples,'Moved actor still samples the same real leg skin');
 let maxLocalError=0;
 for(let m=0;m<kit.meshes.length;m++)for(const key of ['position','normal','uv','color']){
  const actual=kit.meshes[m].geometry.attributes[key].array,expected=base.meshes[m].geometry.attributes[key].array;assert.equal(actual.length,expected.length);
  for(let i=0;i<actual.length;i++){const error=Math.abs(actual[i]-expected[i]);maxLocalError=Math.max(maxLocalError,error);assert(error<1e-4,'Transformed-parent fit differs only by floating-point roundoff');}
 }
 kit.dispose();assert.equal(sourceState(f),before,'Parent fitting never edits source rig');
 report.find(r=>r.id==='shire').transformedParentMaxLocalError=maxLocalError;
}
assert.equal(createNativeDraftFeathers({THREE,scene:new THREE.Group(),skin:{},profile:{nativeRoster:false,nativeVariant:{id:'percheron'}}}),null,'No feather attachment on unrelated rigs');
assert.equal(createNativeDraftFeathers({THREE,scene:new THREE.Group(),skin:{},profile:profiles.percheron}),null,'Incomplete rig is rejected before authoring');
for(const{id}of report){
 const {f,kit,before}=fitted.get(id),material=kit.meshes[0].material,resources=[...kit.meshes.map(m=>m.geometry),material,material.map],counts=resources.map(()=>0);
 resources.forEach((r,i)=>r.addEventListener('dispose',()=>counts[i]++));kit.dispose();kit.dispose();resources.forEach(r=>r.dispose());
 assert.deepEqual(counts,resources.map(()=>1),id+' resources dispose exactly once');assert(kit.meshes.every(m=>!m.parent));assert.equal(kit.inspect().drawCalls,0);
 assert.equal(sourceState(f),before,'Disposal preserves original source state');
 const replacement=add(f);assert.notEqual(replacement,kit,'Disposed horse can initialize again');replacement.dispose();
}
for(const[file,hash]of immutableFiles)assert.equal(fileHash(file),hash,'Original source/breed binary remains unchanged: '+file);
console.log(JSON.stringify({foundations:report,aliases,totalPoses:report.reduce((n,r)=>n+r.poses,0)},null,2));
assert.deepEqual(coverageFailures,[],'Alpha-visible collar density: '+JSON.stringify(coverageFailures));
console.log('Native feathers: four foundations and aliases; alpha-aware four-view density; real runtime gaits/hoof flex/jump, sole/tack clearance; immutable inputs, actor isolation and disposal passed. Software density is a coverage proxy, not proof of visual hair quality.');

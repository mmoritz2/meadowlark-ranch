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

const source='review/native-trot-reference-kit/white/model.glb';
const variants=JSON.parse(fs.readFileSync('assets/models/native-roster/manifest.json'));
const profiles=nativeRosterProfiles(JSON.parse(fs.readFileSync('assets/models/artist-breeds/manifest.json')),variants,NATIVE_BREED_PROFILES['white-western']);
const rose=CLUB_HORSE_BREEDS.find(row=>row[0]==='rosebloom');
profiles.rosebloom={...profiles[rose[7].body],id:rose[0],family:rose[7].family,nativeRosterAppearance:{...rose[7],body:rose[5],mane:rose[6]}};
const v=new THREE.Vector3();
function fixture(id){
 const profile=profiles[id],variant=profile.nativeVariant,{root,body}=loadNativeHorseFixture(source),meshes=[];
 root.traverse(o=>{if(o.isSkinnedMesh)meshes.push(o);});
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
  for(const view of ['side','front']){
   let covered=0;const rows=24,columns=48;
   for(let row=0;row<rows;row++)for(let column=0;column<columns;column++){
    // A fixed 14 x 11 cm patch spans the fetlock collar, including its edges.
    const across=(column+.5)/columns*.14-.07,y=pivot.y-.035+(row+.5)/rows*.11;
    if(view==='side'){origin.set(pivot.x+1,y,pivot.z+across);direction.set(-1,0,0);}
    else{origin.set(pivot.x+across,y,pivot.z+1);direction.set(0,0,-1);}
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
// Use the bundled loader's exact cubic interpolation for native gait tracks.
const loader=fs.readFileSync('assets/vendor/three/examples/jsm/loaders/GLTFLoader.js','utf8');
const cubicStart=loader.indexOf('class GLTFCubicSplineInterpolant'),cubicEnd=loader.indexOf('/*********************************/',cubicStart);
const cubic=new Function('Interpolant','Quaternion',loader.slice(cubicStart,cubicEnd)+';return [GLTFCubicSplineInterpolant,GLTFCubicSplineQuaternionInterpolant];')(THREE.Interpolant,THREE.Quaternion);
// Decode only the actual source/motion keyframes. No procedural test poses.
function clipsFrom(file){
 const bytes=fs.readFileSync(file),len=bytes.readUInt32LE(12),d=JSON.parse(bytes.subarray(20,20+len)),bin=bytes.subarray(28+len);
 function array(i){const a=d.accessors[i],view=d.bufferViews[a.bufferView],size={SCALAR:1,VEC3:3,VEC4:4}[a.type],out=new Float32Array(a.count*size);assert.equal(a.componentType,5126);for(let n=0;n<a.count;n++)for(let k=0;k<size;k++)out[n*size+k]=bin.readFloatLE((view.byteOffset||0)+(a.byteOffset||0)+n*(view.byteStride||size*4)+k*4);return out;}
 return d.animations.map(a=>new THREE.AnimationClip(a.name,-1,a.channels.map(c=>{const s=a.samplers[c.sampler],kind=c.target.path,name=d.nodes[c.target.node].name,Track=kind==='rotation'?THREE.QuaternionKeyframeTrack:THREE.VectorKeyframeTrack;assert(['LINEAR','STEP','CUBICSPLINE',undefined].includes(s.interpolation));const track=new Track(name+'.'+({rotation:'quaternion',translation:'position',scale:'scale'}[kind]),array(s.input),array(s.output),s.interpolation==='STEP'?THREE.InterpolateDiscrete:THREE.InterpolateLinear);if(s.interpolation==='CUBICSPLINE'){track.createInterpolant=function(result){return new cubic[kind==='rotation'?1:0](this.times,this.values,this.getValueSize()/3,result);};track.createInterpolant.isInterpolantFactoryMethodGLTFCubicSpline=true;}return track;})));}

// Fingerprints captured from the approved helper before the Vanner extension.
const approved={shire:'2c430ceb016f7f3431018894b4d54d9b0b9f982657f39d549576a5803c938f86',clyde:'d323ec957d85e7b618ad8411b95a67aba62cb4860e2d0d7b4f80e0a454649fb4'};
for(const id of ['shire','clyde','tempest']){const f=fixture(id),before=sourceState(f),kit=add(f);assert.equal(geometryHash(kit.meshes),approved[f.profile.nativeVariant.id],id+' approved shape preserved exactly');kit.dispose();assert.equal(sourceState(f),before);}
for(const [id,p] of Object.entries(profiles))if(!['shire','clyde','vanner'].includes(p.nativeVariant.id)){assert.equal(createNativeDraftFeathers({THREE,scene:new THREE.Group(),skin:{},profile:p}),null,id+' remains unfeathered');}
assert.equal(createNativeDraftFeathers({THREE,scene:new THREE.Group(),skin:{},profile:{nativeRoster:false,nativeVariant:{id:'vanner'}}}),null,'No feathers on unrelated rigs');
const f=fixture('vanner'),before=sourceState(f),kit=add(f),stats=kit.inspect();
assert.equal(kit.strands,288);assert.equal(stats.drawCalls,4);assert.equal(stats.triangles,3456);assert(stats.skinSamples.every(n=>n>50),'Fits real lower-leg skin, not fallback radii');
assert.equal(add(f),kit,'Repeat initialization does not duplicate geometry');assert.equal(sourceState(f),before,'Installation preserves source mesh, material, transforms and binds');
const rest=bounds(kit.meshes),floor=bounds([f.body]).min.y;
const coverage=collarCoverage(f,kit);for(const view of coverage)assert(view.fraction>.65,view.leg+' '+view.view+' has full feather coverage rather than separated tassels: '+view.fraction);
assert(rest.min.y-floor>.035,'Feather tips clear the standing soles by at least 35 mm');assert(rest.max.y<.32,'Feathers stay below the lower cannon, away from rider/tack');
assert.equal(kit.meshes[0].material.color.getHexString(),'f1ede4','Natural Vanner has soft white feather, independent of its dark mane');
kit.setColors({maneColor:'#000000'});assert.equal(kit.meshes[0].material.color.getHexString(),'f1ede4','Natural white stockings are not recolored by mane paint');
for(const m of kit.meshes){assert(m.parent.isBone);assert.equal(m.parent.name,kit.anchors.find(a=>a.pastern===m.parent).pastern.name);assert(m.geometry.attributes.uv&&m.material.map.image.data.some((x,i)=>i%4===3&&x>0&&x<255),'Soft alpha strand texture');}

const extraClips=clipsFrom('assets/'+f.profile.motionFile),replaced=new Set(extraClips.map(c=>c.name));
const clips=[...clipsFrom(source).filter(c=>!replaced.has(c.name)),...extraClips];
const wanted=[f.profile.nativeIdleClip,...Object.values(f.profile.nativeGaits).map(g=>g.clip),f.profile.nativeJump.clip];
const clipState=JSON.stringify(clips.map(c=>c.toJSON())),mixer=new THREE.AnimationMixer(f.root);
const sourceGeometry=geometryHash(f.meshes),feet=[];
for(let i=0;i<f.body.geometry.attributes.position.count;i++){f.body.getVertexPosition(i,v);f.body.localToWorld(v);if(v.y<floor+.25)feet.push(i);}
assert(feet.length>500,'Ground checks sample the actual four hooves');
let minimumRelativeFloor=Infinity,minimumTreadClearance=Infinity,poses=0;
const tack=f.meshes.find(m=>m.geometry.attributes.position.count===13895),treadIndices=[2716,2742,2769,2792,2818,2845];
for(const name of wanted){
 const clip=THREE.AnimationClip.findByName(clips,name);assert(clip,'Approved clip exists: '+name);const action=mixer.clipAction(clip).setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();
 for(let sample=0;sample<=40;sample++){
  mixer.setTime(clip.duration*sample/40);f.scene.updateMatrixWorld(true);
  let sole=Infinity;for(const i of feet){f.body.getVertexPosition(i,v);f.body.localToWorld(v);sole=Math.min(sole,v.y);}
  const b=bounds(kit.meshes);minimumRelativeFloor=Math.min(minimumRelativeFloor,b.min.y-sole);
  assert(b.min.y>=sole-.006,name+' feathers preserve native floor clearance: '+(b.min.y-sole));
  const treads=treadIndices.map(i=>{const p=tack.getVertexPosition(i,new THREE.Vector3());return tack.localToWorld(p);});
  for(const m of kit.meshes)for(let i=0;i<m.geometry.attributes.position.count;i+=14){m.localToWorld(v.fromBufferAttribute(m.geometry.attributes.position,i));for(const tread of treads)minimumTreadClearance=Math.min(minimumTreadClearance,v.distanceTo(tread));}
  poses++;
 }
 action.stop();
}
mixer.uncacheRoot(f.root);f.scene.updateMatrixWorld(true);
assert(minimumTreadClearance>.14,'Strands stay over 14 cm from original stirrup tread contacts');assert.equal(geometryHash(f.meshes),sourceGeometry,'Animation does not mutate source geometry or skin weights');assert.equal(JSON.stringify(clips.map(c=>c.toJSON())),clipState,'Source clips remain immutable');assert.equal(sourceState(f),before,'Pose playback returns exact source bone and contact transforms');

const alias=fixture('rosebloom'),other=add(alias),naturalMaterial=kit.meshes[0].material;
assert.equal(other.foundation,'vanner');assert.equal(geometryHash(other.meshes),geometryHash(kit.meshes),'Fantasy Vanner inherits the same fit');assert.notEqual(other.meshes[0].material,naturalMaterial,'Each actor owns private feather materials');
const expected=new THREE.Color(rose[6]).lerp(new THREE.Color('#e6e0d4'),.42);assert(other.meshes[0].material.color.equals(expected),'Rosebloom feathers follow approved plum mane shading');other.setColors({maneColor:'#548b80'});assert(other.meshes[0].material.color.equals(new THREE.Color('#548b80').lerp(new THREE.Color('#e6e0d4'),.42)));assert.equal(naturalMaterial.color.getHexString(),'f1ede4','Paint does not leak between actors');
const resources=[...kit.meshes.map(m=>m.geometry),naturalMaterial,naturalMaterial.map],counts=resources.map(()=>0);resources.forEach((r,i)=>r.addEventListener('dispose',()=>counts[i]++));
kit.dispose();kit.dispose();resources.forEach(r=>r.dispose());assert.deepEqual(counts,resources.map(()=>1),'Every private resource disposes exactly once');assert(kit.meshes.every(m=>!m.parent));assert.equal(sourceState(f),before,'Disposal preserves all source geometry/binds/contact transforms');assert.equal(kit.inspect().drawCalls,0);assert.equal(other.disposed,false,'Disposal does not affect another horse');other.dispose();const replacement=add(f);assert.notEqual(replacement,kit,'A disposed actor can be initialized again');replacement.dispose();
console.log(JSON.stringify({poses,clips:wanted.length,minimumCollarCoverage:Math.min(...coverage.map(view=>view.fraction)),standingSoleClearanceM:rest.min.y-floor,minimumRelativeFloorM:minimumRelativeFloor,minimumTreadClearanceM:minimumTreadClearance,strands:stats.strands,triangles:stats.triangles,drawCalls:stats.drawCalls},null,2));
console.log('Native feathers: Vanner and Rosebloom fit, real gait/hoof/tack clearance, approved draft shapes, exclusions, immutable inputs, actor isolation and disposal passed.');

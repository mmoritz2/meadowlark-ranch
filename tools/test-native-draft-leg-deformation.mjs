/* Actual native Trot skin regression. No browser, synthetic joint poses or
 * edited source weights: compare each shaped leg with the same original pose. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from '../assets/vendor/three/build/three.module.js';
import {loadNativeHorseFixture} from './test-native-horse-actions.mjs';
import {NATIVE_BREED_PROFILES} from '../assets/native-breed-profiles.js';
import {nativeRosterProfiles} from '../assets/native-roster.js';
import {prepareNativeHoofFlex} from '../assets/native-hoof-flex.mjs';
import {EXPANSION_HORSE_BREEDS} from '../assets/expansion-horses.js';
import {ROWS as EXTRA_BREEDS} from '../assets/features/new-breeds.js';

const SOURCE='review/native-trot-reference-kit/white/model.glb';
const variants=JSON.parse(fs.readFileSync('assets/models/native-roster/manifest.json'));
const profiles=nativeRosterProfiles(JSON.parse(fs.readFileSync('assets/models/artist-breeds/manifest.json')),variants,NATIVE_BREED_PROFILES['white-western']);
const digest=data=>createHash('sha256').update(data).digest('hex');
function glb(file){
 const bytes=fs.readFileSync(file),length=bytes.readUInt32LE(12),doc=JSON.parse(bytes.subarray(20,20+length)),bin=bytes.subarray(28+length);
 function accessor(index){const a=doc.accessors[index],view=doc.bufferViews[a.bufferView],size={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16}[a.type],Type={5126:Float32Array,5123:Uint16Array,5125:Uint32Array,5121:Uint8Array}[a.componentType],out=new Type(a.count*size);for(let n=0;n<a.count;n++){const offset=(view.byteOffset||0)+(a.byteOffset||0)+n*(view.byteStride||size*Type.BYTES_PER_ELEMENT);out.set(new Type(bin.buffer.slice(bin.byteOffset+offset,bin.byteOffset+offset+size*Type.BYTES_PER_ELEMENT)),n*size);}return out;}
 return{doc,accessor,hash:digest(bytes)};
}
// Use the vendored loader's exact cubic interpolation, including quaternion
// normalization, rather than linearizing source animation keys in the fixture.
const loader=fs.readFileSync('assets/vendor/three/examples/jsm/loaders/GLTFLoader.js','utf8'),cubicStart=loader.indexOf('class GLTFCubicSplineInterpolant'),cubicEnd=loader.indexOf('/*********************************/',cubicStart);
const cubic=new Function('Interpolant','Quaternion',loader.slice(cubicStart,cubicEnd)+';return [GLTFCubicSplineInterpolant,GLTFCubicSplineQuaternionInterpolant];')(THREE.Interpolant,THREE.Quaternion);
function clipsFrom(file){const {doc,accessor}=glb(file);return doc.animations.map(a=>new THREE.AnimationClip(a.name,-1,a.channels.map(c=>{const sampler=a.samplers[c.sampler],path=c.target.path,Track=path==='rotation'?THREE.QuaternionKeyframeTrack:THREE.VectorKeyframeTrack;assert(['rotation','translation','scale'].includes(path));const track=new Track(doc.nodes[c.target.node].name+'.'+({rotation:'quaternion',translation:'position',scale:'scale'}[path]),accessor(sampler.input),accessor(sampler.output),sampler.interpolation==='STEP'?THREE.InterpolateDiscrete:THREE.InterpolateLinear);if(sampler.interpolation==='CUBICSPLINE'){track.createInterpolant=function(result){return new cubic[path==='rotation'?1:0](this.times,this.values,this.getValueSize()/3,result);};track.createInterpolant.isInterpolantFactoryMethodGLTFCubicSpline=true;}return track;})));}
const source=glb(SOURCE),primitive=source.doc.meshes.find(m=>source.doc.accessors[m.primitives[0].attributes.POSITION].count===16159).primitives[0],indices=source.accessor(primitive.indices);
const sourceFixture=loadNativeHorseFixture(SOURCE),sourceProfile=NATIVE_BREED_PROFILES['white-western'],translation=sourceProfile.nativeTranslation;
const v=new THREE.Vector3();
function posed(body){const p=new Float64Array(body.geometry.attributes.position.count*3);for(let i=0;i<p.length/3;i++){v.fromBufferAttribute(body.geometry.attributes.position,i);body.applyBoneTransform(i,v);body.localToWorld(v);for(let j=0;j<3;j++)p[i*3+j]=v.getComponent(j)+translation[j];}return p;}
const sourceRest=posed(sourceFixture.body);
function area(p,t){const i=indices[t*3]*3,j=indices[t*3+1]*3,k=indices[t*3+2]*3,ax=p[j]-p[i],ay=p[j+1]-p[i+1],az=p[j+2]-p[i+2],bx=p[k]-p[i],by=p[k+1]-p[i+1],bz=p[k+2]-p[i+2];return Math.hypot(ay*bz-az*by,az*bx-ax*bz,ax*by-ay*bx)*.5;}
// Lower limb through the knee/hock, excluding the shared chest/quarter surface.
// A separate diagnostic reports upper-leg pinching without classifying torso
// contour changes as a new lower-leg regression.
const lowerTriangles=[],upperTriangles=[],lowVertices=[];
for(let i=0;i<sourceRest.length/3;i++)if(sourceRest[i*3+1]<.72)lowVertices.push(i);
for(let t=0;t<indices.length/3;t++){const ys=[0,1,2].map(k=>sourceRest[indices[t*3+k]*3+1]);if(area(sourceRest,t)<=1e-7)continue;if(Math.max(...ys)<.72)lowerTriangles.push(t);else if(Math.max(...ys)<1.05)upperTriangles.push(t);}
assert(lowerTriangles.length>2000,'Meaningful actual lower-leg triangle coverage');
const skinHash=f=>digest(Buffer.concat(['skinIndex','skinWeight'].map(k=>Buffer.from(f.body.geometry.attributes[k].array.buffer))));
const originalSkin=skinHash(sourceFixture),originalBinds=JSON.stringify(sourceFixture.body.skeleton.boneInverses.map(m=>m.elements));
function fixture(id,binaryPath){const f=loadNativeHorseFixture(SOURCE),record=variants.breeds[id].meshes.find(m=>m.vertexCount===16159),bytes=fs.readFileSync(binaryPath||'assets/'+variants.breeds[id].file),p=f.body.geometry.attributes.position.array,d=record.positionDelta;for(let i=0;i<d.count;i++)p[i]+=bytes.readInt16LE(d.byteOffset+i*2)*d.scale;return f;}
function prepare(f,profile){const sourceClips=clipsFrom(SOURCE),extra=clipsFrom('assets/'+profile.motionFile),replaced=new Set(extra.map(c=>c.name)),clips=[...sourceClips.filter(c=>!replaced.has(c.name)),...extra],before=JSON.stringify(clips.map(c=>c.toJSON())),kit=prepareNativeHoofFlex({THREE,root:f.root,clips,profile}),clip=kit.clips.find(c=>c.name===profile.nativeGaits.trot.clip),mixer=new THREE.AnimationMixer(f.root),action=mixer.clipAction(clip).setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();return{at(phase){kit.layer?.beforePose();mixer.setTime(phase*clip.duration);f.root.updateMatrixWorld(true);kit.layer?.afterPose(new Map([[action,1]]));f.root.updateMatrixWorld(true);return posed(f.body);},done(){action.stop();kit.layer?.dispose();mixer.uncacheRoot(f.root);assert.equal(JSON.stringify(clips.map(c=>c.toJSON())),before,'Audit never mutates original clip tracks');}};}
const minimum=p=>Math.min(...lowVertices.map(i=>p[i*3+1]));
const sourcePlayback=prepare(sourceFixture,sourceProfile),sourceFrames=Array.from({length:81},(_,i)=>sourcePlayback.at(i/80));sourcePlayback.done();
function collapseMetric(rest,frame,reference,triangles){let minRelative=Infinity,worst=null,count=0;for(const triangle of triangles){const sourceStrain=area(reference,triangle)/area(sourceRest,triangle);if(sourceStrain<.20)continue;const variantStrain=area(frame,triangle)/area(rest,triangle),relative=variantStrain/sourceStrain;if(relative<minRelative){minRelative=relative;worst={triangle,sourceStrain,variantStrain,relative};}if(variantStrain<.10&&relative<.30)count++;}return{count,minRelative,worst};}
function widthBounds(p,ids,axis){let lo=Infinity,hi=-Infinity;for(const i of ids){lo=Math.min(lo,p[i*3+axis]);hi=Math.max(hi,p[i*3+axis]);}return hi-lo;}
const hoofGroups=[];for(const side of [-1,1])for(const front of [false,true])hoofGroups.push(Array.from({length:sourceRest.length/3},(_,i)=>i).filter(i=>sourceRest[i*3+1]<=.14&&sourceRest[i*3]*side>0&&(front?sourceRest[i*3+2]>.1:sourceRest[i*3+2]<-.4)));
function measure(id,binaryPath){const f=fixture(id,binaryPath),profile=profiles[id],rest=posed(f.body),playback=prepare(f,profile);assert.equal(skinHash(f),originalSkin,'Sculpt retains exact original weights/indices');assert.equal(JSON.stringify(f.body.skeleton.boneInverses.map(m=>m.elements)),originalBinds,'Original inverse binds unchanged');let worstFloor=Infinity,worstAddedFloor=Infinity,lowerCollapseSamples=0,upperCollapseSamples=0,worstCollapse=null;for(let k=0;k<sourceFrames.length;k++){const reference=sourceFrames[k],frame=playback.at(k/80);assert(frame.every(Number.isFinite),'Finite actual skinned draft body');const floor=minimum(frame),added=floor-Math.min(0,minimum(reference));worstFloor=Math.min(worstFloor,floor*profile.fitScale);worstAddedFloor=Math.min(worstAddedFloor,added*profile.fitScale);const lower=collapseMetric(rest,frame,reference,lowerTriangles),upper=collapseMetric(rest,frame,reference,upperTriangles);lowerCollapseSamples+=lower.count;upperCollapseSamples+=upper.count;if(!worstCollapse||lower.minRelative<worstCollapse.relative)worstCollapse={...lower.worst,phase:k/80};}playback.done();assert.equal(skinHash(f),originalSkin);const hoofWidths=hoofGroups.map(ids=>widthBounds(rest,ids,0)/widthBounds(sourceRest,ids,0));return{id,lowerCollapseSamples,upperCollapseSamples,worstCollapse,worstFloorM:worstFloor,worstAddedFloorM:worstAddedFloor,hoofWidths};}
const report=[];for(const id of ['percheron','shire','clyde']){const result=measure(id);report.push(result);}
console.log(JSON.stringify({samplesPerTrot:81,lowerTriangles:lowerTriangles.length,upperTriangles:upperTriangles.length,sourceFloorM:Math.min(...sourceFrames.map(minimum)),drafts:report},null,2));
for(const r of report){assert.equal(r.lowerCollapseSamples,0,r.id+' adds severe lower-leg triangle collapse beyond the same source pose');assert(r.worstFloorM>=-.006,r.id+' actual animated hoof skin stays within6mm of floor: '+r.worstFloorM);assert(r.worstAddedFloorM>=-.003,r.id+' shape adds no more than3mm penetration beyond source: '+r.worstAddedFloorM);assert(r.hoofWidths.every(w=>w>=1.25&&w<1.65),r.id+' retains visibly broad draft hooves without blanket thinning');}
for(const [alias,foundation]of [['belgian','percheron'],['suffolk','percheron']]){const row=[...EXPANSION_HORSE_BREEDS,...EXTRA_BREEDS].find(r=>r[0]===alias);assert.equal(row?.[7]?.body,foundation,alias+' uses the tested draft foundation');assert(profiles[foundation].nativeRoster&&profiles[foundation].nativeKind==='horse');}
assert.equal(glb(SOURCE).hash,source.hash,'Source GLB unchanged');
console.log('Draft leg deformation: real runtime Trot, no added lower-leg collapse, animated hoof floor, broad hooves, original weights/binds/clips and Belgian/Suffolk foundation mapping passed. Upper-leg diagnostics still require visual review.');

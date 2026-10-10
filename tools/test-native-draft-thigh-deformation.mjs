/* Visible thigh/forearm junctions under actual runtime gaits. Large connected
 * surface patches matter here, rather than isolated near-degenerate triangles.
 * Source-existing deformation stays visible in the report, never erased. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from '../assets/vendor/three/build/three.module.js';
import {loadNativeHorseFixture} from './test-native-horse-actions.mjs';
import {NATIVE_BREED_PROFILES} from '../assets/native-breed-profiles.js';
import {nativeRosterProfiles} from '../assets/native-roster.js';
import {prepareNativeHoofFlex} from '../assets/native-hoof-flex.mjs';

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
const clipCache=new Map();
function clipsFrom(file){if(clipCache.has(file))return clipCache.get(file);const clips=decodeClips(file);clipCache.set(file,clips);return clips;}
function decodeClips(file){const {doc,accessor}=glb(file);return doc.animations.map(a=>new THREE.AnimationClip(a.name,-1,a.channels.map(c=>{const sampler=a.samplers[c.sampler],path=c.target.path,Track=path==='rotation'?THREE.QuaternionKeyframeTrack:THREE.VectorKeyframeTrack;assert(['rotation','translation','scale'].includes(path));const track=new Track(doc.nodes[c.target.node].name+'.'+({rotation:'quaternion',translation:'position',scale:'scale'}[path]),accessor(sampler.input),accessor(sampler.output),sampler.interpolation==='STEP'?THREE.InterpolateDiscrete:THREE.InterpolateLinear);if(sampler.interpolation==='CUBICSPLINE'){track.createInterpolant=function(result){return new cubic[path==='rotation'?1:0](this.times,this.values,this.getValueSize()/3,result);};track.createInterpolant.isInterpolantFactoryMethodGLTFCubicSpline=true;}return track;})));}
const source=glb(SOURCE),primitive=source.doc.meshes.find(m=>source.doc.accessors[m.primitives[0].attributes.POSITION].count===16159).primitives[0],indices=source.accessor(primitive.indices);
const sourceFixture=loadNativeHorseFixture(SOURCE),sourceProfile=NATIVE_BREED_PROFILES['white-western'],translation=sourceProfile.nativeTranslation;
const v=new THREE.Vector3();
function posed(body){const p=new Float64Array(body.geometry.attributes.position.count*3);for(let i=0;i<p.length/3;i++){v.fromBufferAttribute(body.geometry.attributes.position,i);body.applyBoneTransform(i,v);body.localToWorld(v);for(let j=0;j<3;j++)p[i*3+j]=v.getComponent(j)+translation[j];}return p;}
const sourceRest=posed(sourceFixture.body);
function area(p,t){const i=indices[t*3]*3,j=indices[t*3+1]*3,k=indices[t*3+2]*3,ax=p[j]-p[i],ay=p[j+1]-p[i+1],az=p[j+2]-p[i+2],bx=p[k]-p[i],by=p[k+1]-p[i+1],bz=p[k+2]-p[i+2];return Math.hypot(ay*bz-az*by,az*bx-ax*bz,ax*by-ay*bx)*.5;}
// Opposing normals are a useful folding diagnostic, not an inversion gate:
// a legitimate conformation change may rotate a surface more than 90 degrees.
function normalsOppose(p,q,t){
 const i=indices[t*3]*3,j=indices[t*3+1]*3,k=indices[t*3+2]*3;
 const ax=p[j]-p[i],ay=p[j+1]-p[i+1],az=p[j+2]-p[i+2],bx=p[k]-p[i],by=p[k+1]-p[i+1],bz=p[k+2]-p[i+2];
 const cx=q[j]-q[i],cy=q[j+1]-q[i+1],cz=q[j+2]-q[i+2],dx=q[k]-q[i],dy=q[k+1]-q[i+1],dz=q[k+2]-q[i+2];
 return(ay*bz-az*by)*(cy*dz-cz*dy)+(az*bx-ax*bz)*(cz*dx-cx*dz)+(ax*by-ay*bx)*(cx*dy-cy*dx)<0;
}
const DRAFTS=['percheron','shire','clyde'];
const GAITS=['trot','canterLeft','canterRight','gallopLeft','gallopRight'];
const PHASES=Array.from({length:41},(_,i)=>i/40);
const MIN_TRIANGLE_AREA=1e-5; // 0.1 cm² source surface; discard tiny sliver triangles.
const FORE_SOURCE_Y=[.7,1.4],HIND_SOURCE_Y=[.7,1.75]; // Include the full hip sculpt support and its upper transition.
const MAX_EXTRA_THIGH_PATCH_CM2=5; // Roughly a 2.2 cm square of added severe fold.
// Read each candidate once so a concurrent authoring build cannot mix versions.
const buffers=new Map(DRAFTS.map(id=>[id,fs.readFileSync('assets/'+variants.breeds[id].file)]));
const sourceSkin=digest(Buffer.concat(['skinIndex','skinWeight'].map(k=>Buffer.from(sourceFixture.body.geometry.attributes[k].array.buffer))));
const sourceBinds=JSON.stringify(sourceFixture.body.skeleton.boneInverses.map(m=>m.elements));
function fixture(id){
 const f=loadNativeHorseFixture(SOURCE);if(id==='source')return f;
 const record=variants.breeds[id].meshes.find(m=>m.vertexCount===16159),bytes=buffers.get(id),p=f.body.geometry.attributes.position.array,d=record.positionDelta;
 for(let i=0;i<d.count;i++)p[i]+=bytes.readInt16LE(d.byteOffset+i*2)*d.scale;
 assert.equal(digest(Buffer.concat(['skinIndex','skinWeight'].map(k=>Buffer.from(f.body.geometry.attributes[k].array.buffer)))),sourceSkin,'Draft keeps original skin weights and indices');
 assert.equal(JSON.stringify(f.body.skeleton.boneInverses.map(m=>m.elements)),sourceBinds,'Draft keeps original inverse binds');
 return f;
}
const clipPacks=new Map();
function prepare(f,profile,gait){
 let pack=clipPacks.get(profile.motionFile);
 if(!pack){const originals=clipsFrom(SOURCE),extra=clipsFrom('assets/'+profile.motionFile),replaced=new Set(extra.map(c=>c.name)),clips=[...originals.filter(c=>!replaced.has(c.name)),...extra];pack={clips,hash:digest(JSON.stringify(clips.map(c=>c.toJSON())))};clipPacks.set(profile.motionFile,pack);}
 const kit=prepareNativeHoofFlex({THREE,root:f.root,clips:pack.clips,profile}),clip=kit.clips.find(c=>c.name===profile.nativeGaits[gait].clip);
 assert(clip&&Math.abs(clip.duration-profile.nativeGaits[gait].durationS)<1e-5,'Actual runtime gait clip and duration');
 const mixer=new THREE.AnimationMixer(f.root),action=mixer.clipAction(clip).setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();
 return{at(phase){kit.layer?.beforePose();mixer.setTime(phase*clip.duration);f.root.updateMatrixWorld(true);kit.layer?.afterPose(new Map([[action,1]]));f.root.updateMatrixWorld(true);const p=posed(f.body);assert(p.every(Number.isFinite),'Finite posed body skin');return p;},done(){action.stop();kit.layer?.dispose();mixer.uncacheRoot(f.root);}};
}
const regions={fore:[],hind:[]},restAreas=new Float64Array(indices.length/3),adjacent=new Map(),edges=new Map();
for(let t=0;t<indices.length/3;t++){
 const ids=[indices[t*3],indices[t*3+1],indices[t*3+2]],center=[0,0,0];for(const i of ids)for(let c=0;c<3;c++)center[c]+=sourceRest[i*3+c]/3;
 restAreas[t]=area(sourceRest,t);if(restAreas[t]>=MIN_TRIANGLE_AREA){if(center[2]>.1&&center[1]>=FORE_SOURCE_Y[0]&&center[1]<=FORE_SOURCE_Y[1])regions.fore.push(t);else if(center[2]<-.3&&center[1]>=HIND_SOURCE_Y[0]&&center[1]<=HIND_SOURCE_Y[1])regions.hind.push(t);}
 adjacent.set(t,new Set());for(let k=0;k<3;k++){const edge=[ids[k],ids[(k+1)%3]].sort((a,b)=>a-b).join(','),previous=edges.get(edge)||[];for(const other of previous){adjacent.get(t).add(other);adjacent.get(other).add(t);}previous.push(t);edges.set(edge,previous);}
}
assert(regions.fore.length>500&&regions.hind.length>500,'Broad actual upper-leg/body-junction coverage');
function largestPatch(flagged,rest,frame,reference,phase,scale){
 const remaining=new Set(flagged);let best=null;
 while(remaining.size){
  const queue=[remaining.values().next().value],group=[];remaining.delete(queue[0]);
  while(queue.length){const t=queue.pop();group.push(t);for(const n of adjacent.get(t))if(remaining.delete(n))queue.push(n);}
  const restAreaM2=group.reduce((sum,t)=>sum+area(rest,t),0),areaCm2=restAreaM2*scale*scale*1e4;
  if(best&&best.areaCm2>=areaCm2)continue;
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];let sourceMean=0,variantMean=0,minVariant=Infinity;
  for(const t of group){const a=area(reference,t)/restAreas[t],b=area(frame,t)/area(rest,t),w=area(rest,t);sourceMean+=a*w;variantMean+=b*w;minVariant=Math.min(minVariant,b);for(let k=0;k<3;k++){const i=indices[t*3+k];for(let c=0;c<3;c++){min[c]=Math.min(min[c],sourceRest[i*3+c]);max[c]=Math.max(max[c],sourceRest[i*3+c]);}}}
  best={areaCm2,triangles:group.length,phase,sourceMeanStrain:sourceMean/restAreaM2,variantMeanStrain:variantMean/restAreaM2,minVariantStrain:minVariant,sourceBoundsM:{min,max},triangleIds:group};
 }
 return best;
}
function auditFrame(result,rest,frame,reference,phase,scale){
 for(const[region,triangles]of Object.entries(regions)){
  const flags={compression:[],extraCompression:[],stretch:[],extraStretch:[],opposedNormals:[]};
  for(const t of triangles){const sourceStrain=area(reference,t)/restAreas[t],variantStrain=area(frame,t)/area(rest,t);
   if(variantStrain<.25)flags.compression.push(t);
   // Require the source patch to retain area: inherited collapsed triangles
   // cannot manufacture a draft regression by dividing by almost zero.
   if(sourceStrain>=.35&&variantStrain<.25&&variantStrain/sourceStrain<.5)flags.extraCompression.push(t);
   if(sourceStrain>.2&&normalsOppose(reference,frame,t))flags.opposedNormals.push(t);
   if(variantStrain>3)flags.stretch.push(t);
   if(sourceStrain<2.5&&variantStrain>3&&variantStrain/sourceStrain>1.5)flags.extraStretch.push(t);
  }
  const target=result[region]||={};
  for(const[metric,flagged]of Object.entries(flags)){const samples=(target[metric]?.triangleSamples||0)+flagged.length,patch=largestPatch(flagged,rest,frame,reference,phase,scale);if(patch&&(!target[metric]||patch.areaCm2>target[metric].areaCm2))target[metric]=patch;if(target[metric])target[metric].triangleSamples=samples;}
 }
}
const started=performance.now(),report={thresholds:{foreSourceY:FORE_SOURCE_Y,hindSourceY:HIND_SOURCE_Y,minimumSourceTriangleAreaCm2:MIN_TRIANGLE_AREA*1e4,sourceStrainMinimum:.35,variantStrainMaximum:.25,relativeStrainMaximum:.5,maximumAddedThighPatchCm2:MAX_EXTRA_THIGH_PATCH_CM2},triangles:Object.fromEntries(Object.entries(regions).map(([k,v])=>[k,v.length])),assetHashes:Object.fromEntries([...buffers].map(([id,bytes])=>[id,digest(bytes)])),phasesPerGait:PHASES.length,gaits:{}};
for(const gait of GAITS){
 const original=fixture('source'),playback=prepare(original,sourceProfile,gait),sourceFrames=PHASES.map(p=>playback.at(p));playback.done();
 const result={};
 for(const id of ['source',...DRAFTS]){
  const f=id==='source'?null:fixture(id),rest=f?posed(f.body):sourceRest,motion=f?prepare(f,profiles[id],gait):null,scale=f?profiles[id].fitScale:sourceProfile.fitScale||1;
  result[id]={};for(let k=0;k<PHASES.length;k++)auditFrame(result[id],rest,motion?motion.at(PHASES[k]):sourceFrames[k],sourceFrames[k],PHASES[k],scale);
  motion?.done();
 }
 report.gaits[gait]=result;
}
report.runtimeMs=Math.round(performance.now()-started);
// Keep the diagnostics concise but distinguish source-existing deformation,
// total shaped deformation and the strictly additional connected patches.
const summary={...report,gaits:Object.fromEntries(Object.entries(report.gaits).map(([gait,actors])=>[gait,Object.fromEntries(Object.entries(actors).map(([id,parts])=>[id,Object.fromEntries(Object.entries(parts).map(([region,metrics])=>[region,Object.fromEntries(Object.entries(metrics).map(([key,patch])=>[key,{areaCm2:patch.areaCm2,triangles:patch.triangles,phase:patch.phase,triangleSamples:patch.triangleSamples,sourceMeanStrain:patch.sourceMeanStrain,variantMeanStrain:patch.variantMeanStrain}]))]))]))]))};
console.log(JSON.stringify(summary,null,2));
const failures=[];for(const[gait,actors]of Object.entries(report.gaits))for(const id of DRAFTS){const patch=actors[id].hind?.extraCompression;if(patch?.areaCm2>MAX_EXTRA_THIGH_PATCH_CM2)failures.push({id,gait,...patch});}
for(const pack of clipPacks.values())assert.equal(digest(JSON.stringify(pack.clips.map(c=>c.toJSON()))),pack.hash,'Original clip tracks remain immutable');
assert.equal(glb(SOURCE).hash,source.hash,'Original source GLB unchanged');
assert.equal(failures.length,0,'Visible draft-added thigh collapse patches: '+JSON.stringify(failures));
console.log('Draft thigh deformation: all three drafts across Trot, both Canter and both Gallop leads passed the visible added-fold gate. Source-existing shoulder/thigh strain, forearm strain and source-relative opposing normals remain explicit; this is not a full self-intersection or visual-quality proof.');

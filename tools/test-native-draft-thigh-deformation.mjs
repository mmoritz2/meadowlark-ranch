/* Visible thigh/forearm junctions under actual runtime gaits. Large connected
 * surface patches matter here, rather than isolated near-degenerate triangles.
 * Source-existing deformation stays visible in the report, never erased.
 * Optional fair prior-release comparison:
 * QA_LEG_BASELINE=/tmp/snapshot (manifest.json and <breed>.bin)
 * QA_LEG_REPORT=/tmp/report.json node tools/test-native-draft-thigh-deformation.mjs
 * No rejected candidate report belongs in the repository. */
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
const MIN_TRIANGLE_AREA=1e-5; // 0.1 cm²; reject source slivers, not ordinary source defects.
const FORE_SOURCE_Y=[.7,1.90],FORE_SOURCE_Z=[.1,.90],HIND_SOURCE_Y=[.7,1.75]; // Full shoulder/hip transition support.
const MAX_EXTRA_PATCH_CM2=5;
const baselineDirectory=process.env.QA_LEG_BASELINE;
const baselineManifest=baselineDirectory?JSON.parse(fs.readFileSync(baselineDirectory+'/manifest.json')):null;
const buffers=new Map(DRAFTS.map(id=>[id,fs.readFileSync('assets/'+variants.breeds[id].file)]));
const baselineBuffers=new Map(baselineDirectory?DRAFTS.map(id=>[id,fs.readFileSync(baselineDirectory+'/'+id+'.bin')]):[]);
for(const[id,bytes]of buffers)assert.equal(digest(bytes),variants.breeds[id].sha256,'Stable candidate snapshot '+id);
for(const[id,bytes]of baselineBuffers)assert.equal(digest(bytes),baselineManifest.breeds[id].sha256,'Stable baseline snapshot '+id);
const sourceSkin=digest(Buffer.concat(['skinIndex','skinWeight'].map(k=>Buffer.from(sourceFixture.body.geometry.attributes[k].array.buffer))));
const sourceBinds=JSON.stringify(sourceFixture.body.skeleton.boneInverses.map(m=>m.elements));
function fixture(id,baseline=false){
 const f=loadNativeHorseFixture(SOURCE);if(id==='source')return f;
 const row=(baseline?baselineManifest:variants).breeds[id],record=row.meshes.find(m=>m.vertexCount===16159),bytes=(baseline?baselineBuffers:buffers).get(id),p=f.body.geometry.attributes.position.array,d=record.positionDelta;
 for(let i=0;i<d.count;i++)p[i]+=bytes.readInt16LE(d.byteOffset+i*2)*d.scale;
 assert.equal(digest(Buffer.concat(['skinIndex','skinWeight'].map(k=>Buffer.from(f.body.geometry.attributes[k].array.buffer)))),sourceSkin,'Original skin weights and indices');
 assert.equal(JSON.stringify(f.body.skeleton.boneInverses.map(m=>m.elements)),sourceBinds,'Original inverse binds');return f;
}
const clipPacks=new Map();
function prepare(f,profile,gait){
 let pack=clipPacks.get(profile.motionFile);
 if(!pack){const originals=clipsFrom(SOURCE),extra=clipsFrom('assets/'+profile.motionFile),replaced=new Set(extra.map(c=>c.name)),clips=[...originals.filter(c=>!replaced.has(c.name)),...extra];pack={clips,hash:digest(JSON.stringify(clips.map(c=>c.toJSON())))};clipPacks.set(profile.motionFile,pack);}
 const kit=prepareNativeHoofFlex({THREE,root:f.root,clips:pack.clips,profile}),clip=kit.clips.find(c=>c.name===profile.nativeGaits[gait].clip);
 assert(clip&&Math.abs(clip.duration-profile.nativeGaits[gait].durationS)<1e-5,'Actual runtime gait clip/duration');
 const mixer=new THREE.AnimationMixer(f.root),action=mixer.clipAction(clip).setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();
 return{at(phase){kit.layer?.beforePose();mixer.setTime(phase*clip.duration);f.root.updateMatrixWorld(true);kit.layer?.afterPose(new Map([[action,1]]));f.root.updateMatrixWorld(true);const p=posed(f.body);assert(p.every(Number.isFinite),'Finite posed body');return p;},done(){action.stop();kit.layer?.dispose();mixer.uncacheRoot(f.root);}};
}
// A UV seam is still one anatomical patch. Weld only coincident SOURCE points
// with identical normalized joint ownership; never weld nearby separate skin.
const sourceAttrs=sourceFixture.body.geometry.attributes,weldIds=new Uint32Array(sourceAttrs.position.count),weldKeys=new Map();
for(let i=0;i<weldIds.length;i++){
 const weights=[];let sum=0;for(let c=0;c<4;c++)sum+=sourceAttrs.skinWeight.getComponent(i,c);
 for(let c=0;c<4;c++){const w=sourceAttrs.skinWeight.getComponent(i,c);if(w>0)weights.push([sourceAttrs.skinIndex.getComponent(i,c),Math.round(w/sum*1e7)]);}
 weights.sort((a,b)=>a[0]-b[0]);const key=[...sourceRest.slice(i*3,i*3+3)].map(x=>Math.round(x*1e6)).join(',')+'|'+JSON.stringify(weights);
 if(!weldKeys.has(key))weldKeys.set(key,weldKeys.size);weldIds[i]=weldKeys.get(key);
}
const regions={fore:[],hind:[]},restAreas=new Float64Array(indices.length/3),adjacent=Array.from({length:indices.length/3},()=>new Set()),edges=new Map();
for(let t=0;t<indices.length/3;t++){
 const ids=[indices[t*3],indices[t*3+1],indices[t*3+2]],center=[0,0,0];for(const i of ids)for(let c=0;c<3;c++)center[c]+=sourceRest[i*3+c]/3;
 restAreas[t]=area(sourceRest,t);
 if(restAreas[t]>=MIN_TRIANGLE_AREA){if(center[2]>FORE_SOURCE_Z[0]&&center[2]<FORE_SOURCE_Z[1]&&center[1]>=FORE_SOURCE_Y[0]&&center[1]<=FORE_SOURCE_Y[1])regions.fore.push(t);else if(center[2]<-.3&&center[1]>=HIND_SOURCE_Y[0]&&center[1]<=HIND_SOURCE_Y[1])regions.hind.push(t);}
 for(let k=0;k<3;k++){const edge=[weldIds[ids[k]],weldIds[ids[(k+1)%3]]].sort((a,b)=>a-b).join(','),previous=edges.get(edge)||[];for(const other of previous){adjacent[t].add(other);adjacent[other].add(t);}previous.push(t);edges.set(edge,previous);}
}
assert(regions.fore.length>500&&regions.hind.length>500,'Broad upper-leg/body-junction coverage');
assert(weldKeys.size<weldIds.length,'Actual duplicate source seams joined');
function principal(rest,frame,t){
 const i=indices[t*3]*3,j=indices[t*3+1]*3,k=indices[t*3+2]*3;
 const gram=p=>{const ax=p[j]-p[i],ay=p[j+1]-p[i+1],az=p[j+2]-p[i+2],bx=p[k]-p[i],by=p[k+1]-p[i+1],bz=p[k+2]-p[i+2];return[ax*ax+ay*ay+az*az,ax*bx+ay*by+az*bz,bx*bx+by*by+bz*bz];};
 const[a,b,c]=gram(rest),[d,e,f]=gram(frame),det=a*c-b*b;assert(det>1e-18,'Nondegenerate resting triangle');
 const tr=(c*d+a*f-2*b*e)/det,product=Math.max(0,(d*f-e*e)/det),disc=Math.sqrt(Math.max(0,tr*tr-4*product));
 const lo=Math.sqrt(Math.max(0,(tr-disc)/2)),hi=Math.sqrt(Math.max(0,(tr+disc)/2));return{lo,hi,ratio:hi/Math.max(1e-6,lo)};
}
// Verify the diagnostic itself catches area-preserving directional collapse,
// not just a differently scaled triangle. This is independent of any horse.
{
 const p=new Float64Array(sourceRest.length),q=new Float64Array(sourceRest.length),[i,j,k]=[indices[0]*3,indices[1]*3,indices[2]*3];p[j]=1;p[k+1]=1;q[j]=6;q[k+1]=1/6;
 const identity=principal(p,p,0),distorted=principal(p,q,0);assert(Math.abs(identity.lo-1)<1e-10&&Math.abs(identity.hi-1)<1e-10);assert(Math.abs(area(p,0)-area(q,0))<1e-10&&distorted.ratio>35.99,'Principal strains detect area-hidden directional distortion');
}
// Exemption is exact identity, not closeness or anatomical region. Every
// member vertex must retain the original raw geometry, standing point AND
// current posed point; global fixture checks also require source skin/binds.
function exactSourcePatch(group,rest,frame,reference,sourceVertices){
 return group.every(t=>[0,1,2].every(k=>{const i=indices[t*3+k];return sourceVertices[i]&&[0,1,2].every(c=>rest[i*3+c]===sourceRest[i*3+c]&&frame[i*3+c]===reference[i*3+c]);}));
}
{
 const unchanged=new Uint8Array(sourceAttrs.position.count).fill(1),changed=unchanged.slice();changed[indices[0]]=0;
 assert(exactSourcePatch([0],sourceRest,sourceRest,sourceRest,unchanged));
 assert(!exactSourcePatch([0],sourceRest,sourceRest,sourceRest,changed),'One altered raw vertex prevents source exemption');
 const changedPose=sourceRest.slice();changedPose[indices[0]*3]+=Number.EPSILON;
 assert(!exactSourcePatch([0],sourceRest,changedPose,sourceRest,unchanged),'No positional tolerance in source exemption');
}
function largestPatch(flagged,rest,frame,reference,phase,scale,baseline,sourceVertices,filter='all'){
 const remaining=new Set(flagged);let best=null,samples=0;
 while(remaining.size){
  const queue=[remaining.values().next().value],group=[];remaining.delete(queue[0]);
  while(queue.length){const t=queue.pop();group.push(t);for(const n of adjacent[t])if(remaining.delete(n))queue.push(n);}
  const exactSourceRestoration=exactSourcePatch(group,rest,frame,reference,sourceVertices);
  if(filter==='source'&&!exactSourceRestoration||filter==='nonSource'&&exactSourceRestoration)continue;
  samples+=group.length;
  const restAreaM2=group.reduce((sum,t)=>sum+area(rest,t),0),areaCm2=restAreaM2*scale*scale*1e4;if(best&&best.areaCm2>=areaCm2)continue;
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];let sourceMean=0,variantMean=0,minVariant=Infinity,baselineRestArea=0,baselinePosedArea=0,meanLong=0,meanShort=0;
  for(const t of group){const a=area(reference,t)/restAreas[t],b=area(frame,t)/area(rest,t),w=area(rest,t),sv=principal(rest,frame,t);sourceMean+=a*w;variantMean+=b*w;meanLong+=sv.hi*w;meanShort+=sv.lo*w;minVariant=Math.min(minVariant,b);if(baseline){baselineRestArea+=area(baseline.rest,t);baselinePosedArea+=area(baseline.frame,t);}for(let k=0;k<3;k++){const i=indices[t*3+k];for(let c=0;c<3;c++){min[c]=Math.min(min[c],sourceRest[i*3+c]);max[c]=Math.max(max[c],sourceRest[i*3+c]);}}}
  best={exactSourceRestoration,areaCm2,posedAreaCm2:variantMean*scale*scale*1e4,triangles:group.length,phase,sourceMeanStrain:sourceMean/restAreaM2,variantMeanStrain:variantMean/restAreaM2,minVariantStrain:minVariant,meanPrincipalLong:meanLong/restAreaM2,meanPrincipalShort:meanShort/restAreaM2,...(baseline?{baselineSamePatchMeanStrain:baselinePosedArea/baselineRestArea,baselineSamePatchRestAreaCm2:baselineRestArea*baseline.scale*baseline.scale*1e4,baselineSamePatchPosedAreaCm2:baselinePosedArea*baseline.scale*baseline.scale*1e4}:{}),sourceBoundsM:{min,max},triangleIds:group};
 }
 return{patch:best,samples};
}
function auditFrame(result,rest,frame,reference,phase,scale,baseline,sourceVertices){
 for(const[region,triangles]of Object.entries(regions)){
  const flags={compression:[],extraCompression:[],stretch:[],extraStretch:[],opposedNormals:[],anisotropy:[],areaHiddenAnisotropy:[]};
  for(const t of triangles){const sourceStrain=area(reference,t)/restAreas[t],variantStrain=area(frame,t)/area(rest,t),sv=principal(rest,frame,t);
   if(variantStrain<.25)flags.compression.push(t);
   if(sourceStrain>=.35&&variantStrain<.25&&variantStrain/sourceStrain<.5)flags.extraCompression.push(t);
   if(sourceStrain>.2&&normalsOppose(reference,frame,t))flags.opposedNormals.push(t);
   if(variantStrain>3)flags.stretch.push(t);
   if(sourceStrain<2.5&&variantStrain>3&&variantStrain/sourceStrain>1.5)flags.extraStretch.push(t);
   if(sv.ratio>8){flags.anisotropy.push(t);if(variantStrain>=.25&&variantStrain<=3)flags.areaHiddenAnisotropy.push(t);}
  }
  // Evaluate complete connected patches, never split a mixed changed/source
  // patch to shrink a failure. Keep inherited closures visible independently.
  const target=result[region]||={};
  const entries=[...Object.entries(flags).map(([key,value])=>[key,value,'all']),...['compression','stretch'].flatMap(key=>[['nonSource'+key[0].toUpperCase()+key.slice(1),flags[key],'nonSource'],['inheritedSource'+key[0].toUpperCase()+key.slice(1),flags[key],'source']])];
  for(const[metric,flagged,filter]of entries){const found=largestPatch(flagged,rest,frame,reference,phase,scale,baseline,sourceVertices,filter),samples=(target[metric]?.triangleSamples||0)+found.samples,patch=found.patch;if(patch&&(!target[metric]||patch.areaCm2>target[metric].areaCm2))target[metric]=patch;if(target[metric])target[metric].triangleSamples=samples;}
 }
}
// Cross-sections are sampled from actual triangle/plane intersections, in the
// animated anatomical segment frame. No builder cage/guide data is consulted.
const SEGMENTS=[['foreLeft','upperarm_l_0204','lowerarm_l_0205','hand_l_0206'],['foreRight','upperarm_r_0270','lowerarm_r_0271','hand_r_0272'],['hindLeft','upperleg_l_0405','lowerleg_l_0406','foot_l_0407'],['hindRight','upperleg_r_0474','lowerleg_r_0475','foot_r_0476']];
const sections=[];
for(const[id,top,middle,end]of SEGMENTS){
 const rootBone=sourceFixture.root.getObjectByName(top),jointIds=new Set();rootBone.traverse(b=>{const n=sourceFixture.body.skeleton.bones.indexOf(b);if(n>=0)jointIds.add(n);});
 const ownership=new Float64Array(sourceAttrs.position.count);for(let i=0;i<ownership.length;i++)for(let c=0;c<4;c++)if(jointIds.has(sourceAttrs.skinIndex.getComponent(i,c)))ownership[i]+=sourceAttrs.skinWeight.getComponent(i,c);
 const triangles=[];for(let t=0;t<indices.length/3;t++)if([0,1,2].reduce((sum,k)=>sum+ownership[indices[t*3+k]],0)/3>.30)triangles.push(t);
 for(const[label,a,b]of [['upper',top,middle],['lower',middle,end]])sections.push({id:id+':'+label,start:a,end:b,triangles});
}
const STATIONS=Array.from({length:9},(_,i)=>.1+i*.1);
function crossSections(f,p,scale){
 const point=name=>f.root.getObjectByName(name).getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(...translation));
 return Object.fromEntries(sections.map(section=>{
  const start=point(section.start),end=point(section.end),axis=end.clone().sub(start).normalize(),u=new THREE.Vector3(1,0,0).addScaledVector(axis,-axis.x).normalize(),v=new THREE.Vector3().crossVectors(axis,u),length=start.distanceTo(end),points=[];
  for(const t of section.triangles){const tri=[0,1,2].map(k=>new THREE.Vector3().fromArray(p,indices[t*3+k]*3).sub(start));points.push(tri.map(x=>[x.dot(axis)/length,x.dot(u),x.dot(v)]));}
  const samples=STATIONS.map(at=>{
   let minU=Infinity,maxU=-Infinity,minV=Infinity,maxV=-Infinity,hits=0;
   for(const tri of points){if(Math.min(...tri.map(x=>x[0]))>at||Math.max(...tri.map(x=>x[0]))<at)continue;
    for(let edge=0;edge<3;edge++){const a=tri[edge],b=tri[(edge+1)%3],d=b[0]-a[0];if(Math.abs(d)<1e-10)continue;const t=(at-a[0])/d;if(t<0||t>1)continue;const x=a[1]+(b[1]-a[1])*t,y=a[2]+(b[2]-a[2])*t;minU=Math.min(minU,x);maxU=Math.max(maxU,x);minV=Math.min(minV,y);maxV=Math.max(maxV,y);hits++;}
   }
   return hits>=6?{at,widthM:(maxU-minU)*scale,depthM:(maxV-minV)*scale,centerOffsetM:Math.hypot((maxU+minU)*.5,(maxV+minV)*.5)*scale}:null;
  });
  let minPinch=1,maxBulge=1,maxSecondDifference=0;
  for(let i=1;i<samples.length-1;i++){if(!samples[i-1]||!samples[i]||!samples[i+1])continue;for(const field of ['widthM','depthM']){const a=samples[i-1][field],b=samples[i][field],c=samples[i+1][field],neighbor=(a+c)*.5;if(neighbor<=.002)continue;minPinch=Math.min(minPinch,b/neighbor);maxBulge=Math.max(maxBulge,b/neighbor);maxSecondDifference=Math.max(maxSecondDifference,Math.abs(a-2*b+c)/neighbor);}}
  return[section.id,{segmentLengthM:length*scale,samples,minPinchRatio:minPinch,maxBulgeRatio:maxBulge,maxRelativeSecondDifference:maxSecondDifference}];
 }));
}
function addSectionReport(target,f,p,scale,phase){
 const current=crossSections(f,p,scale);
 for(const[id,value]of Object.entries(current)){
  const prior=target[id];if(!prior)target[id]={rest:null,worstPinch:{phase,...value},worstBulge:{phase,...value}};
  if(value.minPinchRatio<target[id].worstPinch.minPinchRatio)target[id].worstPinch={phase,...value};if(value.maxBulgeRatio>target[id].worstBulge.maxBulgeRatio)target[id].worstBulge={phase,...value};
 }
}
const started=performance.now(),report={thresholds:{foreSourceY:FORE_SOURCE_Y,foreSourceZ:FORE_SOURCE_Z,hindSourceY:HIND_SOURCE_Y,minimumSourceTriangleAreaCm2:MIN_TRIANGLE_AREA*1e4,sourceStrainMinimum:.35,variantStrainMaximum:.25,relativeStrainMaximum:.5,maximumAddedPatchCm2:MAX_EXTRA_PATCH_CM2,principalAxisRatio:8,absolutePriorBudget:{relativeGrowth:1.10,additiveAreaCm2:1,exception:'Only complete connected patches whose every vertex exactly matches original raw geometry, standing and same-phase posed source; original skin/binds unchanged. Inherited source patches remain reported.'}},seams:{sourceVertices:weldIds.length,weldedVertices:weldKeys.size},triangles:Object.fromEntries(Object.entries(regions).map(([k,v])=>[k,v.length])),assetHashes:Object.fromEntries([...buffers].map(([id,bytes])=>[id,digest(bytes)])),baselineHashes:Object.fromEntries([...baselineBuffers].map(([id,bytes])=>[id,digest(bytes)])),phasesPerGait:PHASES.length,gaits:{},sections:{}};
const restCache=new Map();
for(const gait of GAITS){
 const snapshots=new Map(),actors=[['source',false],...DRAFTS.map(id=>[id,false]),...(baselineDirectory?DRAFTS.map(id=>[id,true]):[])];
 // Every source/candidate/baseline gait is evaluated once. Reuse its posed
 // skin for all area/principal metrics and exact same-patch comparisons.
 for(const[id,baseline]of actors){
  const name=baseline?'baseline:'+id:id,f=fixture(id,baseline),rest=posed(f.body),scale=id==='source'?sourceProfile.fitScale||1:(baseline?baselineManifest.breeds[id].actorScale:profiles[id].fitScale);
  if(!restCache.has(name))restCache.set(name,crossSections(f,rest,scale));
  const sourceVertices=Uint8Array.from({length:sourceAttrs.position.count},(_,i)=>[0,1,2].every(c=>f.body.geometry.attributes.position.array[i*3+c]===sourceAttrs.position.array[i*3+c])?1:0);
  const motion=prepare(f,id==='source'?sourceProfile:profiles[id],gait),frames=[],sectionReport={};
  for(let k=0;k<PHASES.length;k++){const frame=motion.at(PHASES[k]);frames.push(frame);if(k%5===0)addSectionReport(sectionReport,f,frame,scale,PHASES[k]);}
  motion.done();snapshots.set(name,{rest,frames,scale,sourceVertices});report.sections[name]||={rest:restCache.get(name),gaits:{}};report.sections[name].gaits[gait]=sectionReport;
 }
 const sourceFrames=snapshots.get('source').frames,result={};
 for(const[name,actor]of snapshots){
  result[name]={};const prior=snapshots.get('baseline:'+name);
  for(let k=0;k<PHASES.length;k++)auditFrame(result[name],actor.rest,actor.frames[k],sourceFrames[k],PHASES[k],actor.scale,prior?{rest:prior.rest,frame:prior.frames[k],scale:prior.scale}:null,actor.sourceVertices);
 }
 report.gaits[gait]=result;
}
report.runtimeMs=Math.round(performance.now()-started);

const compactMetrics=parts=>Object.fromEntries(Object.entries(parts).map(([region,metrics])=>[region,Object.fromEntries(Object.entries(metrics).map(([key,patch])=>[key,{exactSourceRestoration:patch.exactSourceRestoration,areaCm2:patch.areaCm2,triangles:patch.triangles,phase:patch.phase,sourceMeanStrain:patch.sourceMeanStrain,variantMeanStrain:patch.variantMeanStrain,...(patch.baselineSamePatchMeanStrain!==undefined?{baselineSamePatchMeanStrain:patch.baselineSamePatchMeanStrain}:{})}]))]));
console.log(JSON.stringify({thresholds:report.thresholds,seams:report.seams,triangles:report.triangles,assetHashes:report.assetHashes,baselineHashes:report.baselineHashes,runtimeMs:report.runtimeMs,gaits:Object.fromEntries(Object.entries(report.gaits).map(([gait,actors])=>[gait,Object.fromEntries(Object.entries(actors).map(([id,parts])=>[id,compactMetrics(parts)]))]))},null,2));
// This is a release no-regression budget, not an anatomical ideal: a whole
// connected bad patch may grow at most10% plus1cm² against the frozen prior
// mesh. The additive allowance avoids promoting individual0.1cm² triangles
// into an absolute quality claim; the separate5cm² added-fold gate stays fixed.
// Exact source restoration is inherited source deformation, explicitly reported
// and excluded only here; the largest remaining non-source patch is still gated.
const failures=[];
if(baselineDirectory)for(const[gait,actors]of Object.entries(report.gaits))for(const id of DRAFTS)for(const region of ['fore','hind'])for(const metric of ['compression','stretch']){
 const patch=actors[id][region]?.['nonSource'+metric[0].toUpperCase()+metric.slice(1)],prior=actors['baseline:'+id][region]?.[metric],limit=(prior?.areaCm2||0)*1.10+1;
 if(patch?.areaCm2>limit)failures.push({id,gait,region,metric,limitCm2:limit,baselineAreaCm2:prior?.areaCm2||0,...patch});
}
for(const[gait,actors]of Object.entries(report.gaits))for(const id of DRAFTS)for(const region of ['fore','hind']){const patch=actors[id][region]?.extraCompression;if(patch?.areaCm2>MAX_EXTRA_PATCH_CM2)failures.push({id,gait,region,...patch});}
report.failures=failures;
if(process.env.QA_LEG_REPORT)fs.writeFileSync(process.env.QA_LEG_REPORT,JSON.stringify(report,null,2)+'\n');
for(const pack of clipPacks.values())assert.equal(digest(JSON.stringify(pack.clips.map(c=>c.toJSON()))),pack.hash,'Original clip tracks immutable');
assert.equal(glb(SOURCE).hash,source.hash,'Original source GLB unchanged');
assert.equal(failures.length,0,'Visible added fore/hind collapse patches: '+JSON.stringify(failures));
// Only a passing, explicitly requested final run can write a tracked summary.
// Rejected candidate diagnostics remain in the caller's temporary full report.
if(process.env.QA_LEG_ACCEPTED_REPORT){
 assert(baselineDirectory&&/^[a-f0-9]{7,40}$/.test(process.env.QA_LEG_BASELINE_COMMIT||''),'Accepted report requires the frozen baseline and its commit');
 const rounded=x=>Math.round(x*1e4)/1e4;
 const actors=['source',...DRAFTS,...DRAFTS.map(id=>'baseline:'+id)];
 const peak=(id,region,metric)=>Object.entries(report.gaits).map(([gait,rows])=>({gait,...rows[id][region][metric]})).filter(x=>x.areaCm2!==undefined).sort((a,b)=>b.areaCm2-a.areaCm2)[0];
 const metrics=['extraCompression','compression','stretch','anisotropy','areaHiddenAnisotropy','nonSourceCompression','nonSourceStretch','inheritedSourceCompression','inheritedSourceStretch'];
 const peaks=Object.fromEntries(actors.map(id=>[id,Object.fromEntries(['fore','hind'].map(region=>[region,Object.fromEntries(metrics.map(metric=>{const p=peak(id,region,metric);return[metric,p?{areaCm2:rounded(p.areaCm2),gait:p.gait,phase:p.phase,sourceMeanStrain:rounded(p.sourceMeanStrain),variantMeanStrain:rounded(p.variantMeanStrain)}:{areaCm2:0}];}))]))]));
 const exemptions=[];
 for(const[gait,rows]of Object.entries(report.gaits))for(const id of DRAFTS)for(const region of ['fore','hind'])for(const metric of ['compression','stretch']){
  const p=rows[id][region][metric],prior=rows['baseline:'+id][region][metric],limit=(prior?.areaCm2||0)*1.10+1;
  if(p?.areaCm2>limit&&p.exactSourceRestoration)exemptions.push({id,gait,region,metric,phase:p.phase,areaCm2:rounded(p.areaCm2),priorBudgetCm2:rounded(limit),sourceMeanStrain:rounded(p.sourceMeanStrain),triangleIds:p.triangleIds,exactSourceRestoration:true});
 }
 const summary={schema:'native-draft-leg-quality-v1',baselineCommit:process.env.QA_LEG_BASELINE_COMMIT,source:'Original White body geometry under the current approved runtime gait clips and hoof-flex layer, not an assumption of ideal anatomy.',scope:{drafts:DRAFTS,aliases:{belgian:'percheron',suffolk:'percheron'},gaits:GAITS,phasesPerGait:PHASES.length,totalBodyPoses:actors.length*GAITS.length*PHASES.length},thresholds:report.thresholds,seams:report.seams,triangles:report.triangles,assetHashes:report.assetHashes,baselineHashes:report.baselineHashes,results:{sourceRelativeGatesPassed:DRAFTS.length*GAITS.length*2,absolutePriorGatesPassed:DRAFTS.length*GAITS.length*2*2,failures:0,exactSourceExemptions:exemptions},peaks,limitations:['Original source geometry retains connected compression/stretch and directional distortion; inherited patch measurements above are not erased by a passing result.','Only whole connected patches with exact original raw/rest/posed coordinates and unchanged source skin/binds qualify for the absolute-growth exception. Mixed patches remain fully gated.','Checks sample 41 phases per gait and reject source triangles smaller than 0.1 square centimetre. They do not prove every frame or every tiny triangle ideal.','Bone-axis cross-sections are independent diagnostics in the full temporary report; visual review, not an invented scalar threshold, judges anatomical taper and silhouette.','These gates cover the three draft foundations and their stated aliases. They do not certify other roster horses or change original clip/skin behavior.']};
 fs.writeFileSync(process.env.QA_LEG_ACCEPTED_REPORT,JSON.stringify(summary,null,2)+'\n');
}
console.log('Draft legs: welded source seams; fore AND hind connected added-fold gates; absolute source/candidate/baseline strain, principal-axis distortion and anatomical cross-sections reported. Source geometry is not assumed ideal; diagnostics still require visual review.');

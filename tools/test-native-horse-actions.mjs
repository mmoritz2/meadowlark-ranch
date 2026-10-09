import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from '../assets/vendor/three/build/three.module.js';
import {createNativeHorseActionClips} from '../assets/native-horse-actions.mjs';

export function loadNativeHorseFixture(path){
 const data=fs.readFileSync(path),length=data.readUInt32LE(12),doc=JSON.parse(data.subarray(20,20+length)),bin=data.subarray(28+length);
 const sizes={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16},types={5126:Float32Array,5123:Uint16Array,5125:Uint32Array,5121:Uint8Array};
 function access(index){const a=doc.accessors[index],v=doc.bufferViews[a.bufferView],T=types[a.componentType],size=sizes[a.type],out=new T(a.count*size),stride=v.byteStride||size*T.BYTES_PER_ELEMENT;for(let i=0;i<a.count;i++){const start=(v.byteOffset||0)+(a.byteOffset||0)+i*stride;out.set(new T(bin.buffer.slice(bin.byteOffset+start,bin.byteOffset+start+size*T.BYTES_PER_ELEMENT)),i*size);}return out;}
 const jointSet=new Set(doc.skins.flatMap(s=>s.joints));
 const nodes=doc.nodes.map((n,i)=>{let o;if(jointSet.has(i))o=new THREE.Bone();else if(n.mesh!==undefined){const p=doc.meshes[n.mesh].primitives[0],g=new THREE.BufferGeometry();for(const [k,name]of [['POSITION','position'],['JOINTS_0','skinIndex'],['WEIGHTS_0','skinWeight']])if(p.attributes[k]!==undefined)g.setAttribute(name,new THREE.BufferAttribute(access(p.attributes[k]),sizes[doc.accessors[p.attributes[k]].type]));o=new THREE.SkinnedMesh(g,new THREE.MeshBasicMaterial());}else o=new THREE.Group();o.name=n.name||('node_'+i);if(n.translation)o.position.fromArray(n.translation);if(n.rotation)o.quaternion.fromArray(n.rotation);if(n.scale)o.scale.fromArray(n.scale);if(n.matrix){o.matrix.fromArray(n.matrix);o.matrix.decompose(o.position,o.quaternion,o.scale);}return o;});
 doc.nodes.forEach((n,i)=>(n.children||[]).forEach(c=>nodes[i].add(nodes[c])));
 const root=new THREE.Group();doc.scenes[doc.scene||0].nodes.forEach(i=>root.add(nodes[i]));root.updateMatrixWorld(true);
 doc.nodes.forEach((n,i)=>{if(n.skin===undefined)return;const s=doc.skins[n.skin],a=access(s.inverseBindMatrices),skeleton=new THREE.Skeleton(s.joints.map(j=>nodes[j]),s.joints.map((j,k)=>new THREE.Matrix4().fromArray(a,k*16)));nodes[i].bind(skeleton,new THREE.Matrix4());});
 root.updateMatrixWorld(true);return {root,body:nodes.find(o=>o.isSkinnedMesh&&o.geometry.attributes.position.count===16159)};
}
const vec=new THREE.Vector3();
function meshesIn(root){const out=[];root.traverse(o=>{if(o.isSkinnedMesh)out.push(o);});return out;}
function skinMinimum(meshes){let min=Infinity;for(const mesh of meshes){const p=mesh.geometry.attributes.position;for(let i=0;i<p.count;i++){vec.fromBufferAttribute(p,i);mesh.applyBoneTransform(i,vec);vec.applyMatrix4(mesh.matrixWorld);assert(vec.toArray().every(Number.isFinite),'Finite actual skinned vertex');min=Math.min(min,vec.y);}}return min;}
function checkTracks(bundle){
 let biggestStep=0;
 for(const clip of bundle.clips){
  assert(clip.duration>0);assert(clip.tracks.length>20);
  for(const t of clip.tracks){const n=t.getValueSize(),last=t.values.length-n;for(let i=0;i<n;i++)assert(Math.abs(t.values[i]-t.values[last+i])<1e-5,'Exact rest endpoints: '+t.name);
   assert(t.values.every(Number.isFinite));assert.equal(t.times[0],0);assert(Math.abs(t.times.at(-1)-clip.duration)<1e-6);
   if(t.ValueTypeName==='quaternion')for(let i=4;i<t.values.length;i+=4){const a=new THREE.Quaternion().fromArray(t.values,i).normalize(),b=new THREE.Quaternion().fromArray(t.values,i-4).normalize();biggestStep=Math.max(biggestStep,a.angleTo(b)*180/Math.PI);}
  }
 }
 assert(biggestStep<18,'No IK branch flips: '+biggestStep);return biggestStep;
}
function checkActionContactAndHolds(bundle,label=''){
 const graze=bundle.clips.find(c=>c.name===bundle.actions.graze.clip),pelvis=graze.tracks.find(t=>t.name==='pelvis_08.position');
 for(let i=0;i<pelvis.values.length;i++)assert(Math.abs(pelvis.values[i]-pelvis.values[i%3])<1e-8,label+' grazing never lifts or translates the horse to hide a muzzle collision');
 const g=bundle.diagnostics.clips.graze;assert(Number.isFinite(g.minMuzzleY)&&g.minMuzzleY>=bundle.diagnostics.floorY-.0001,label+' posed muzzle stays above its actual sole floor');
 assert(g.maxGrazeNeckReductionDeg>=0&&g.maxGrazeNeckReductionDeg<10,label+' grazing keeps the original pose with only a bounded neck adjustment');
 for(const [type,stats]of Object.entries(bundle.diagnostics.clips))if(stats.maxContactErrorM!==null)assert(stats.maxContactErrorM<.002,label+' '+type+' supporting hooves remain planted');
 for(const type of ['rear','bow','liedown']){
  const clip=bundle.clips.find(c=>c.name===bundle.actions[type].clip),head=clip.tracks.find(t=>t.name==='head_019.quaternion'),p=type==='liedown'?[.46,.64]:[.34,.58];
  const a=new THREE.Quaternion().fromArray(head.createInterpolant().evaluate(p[0]*clip.duration)),b=new THREE.Quaternion().fromArray(head.createInterpolant().evaluate(p[1]*clip.duration)),degrees=a.angleTo(b)*180/Math.PI;
  assert(degrees>.05&&degrees<2,label+' '+type+' held pose has restrained living movement, not a frozen hold or broad sway: '+degrees);
 }
}
function animateBounds(root,bundle,phases,label=''){const mixer=new THREE.AnimationMixer(root),meshes=meshesIn(root),floor=skinMinimum(meshes);let worst=0;
 for(const clip of bundle.clips){const a=mixer.clipAction(clip).setLoop(THREE.LoopOnce,1);a.clampWhenFinished=true;a.play();for(const phase of phases){mixer.setTime(phase*clip.duration);root.updateMatrixWorld(true);const delta=skinMinimum(meshes)-floor;worst=Math.min(worst,delta);assert(delta>-.006,label+' '+clip.name+' full skin floor error '+delta);}a.stop();}mixer.uncacheRoot(root);return worst;
}
function checkLieRecovery(root,bundle){
 const clip=bundle.clips.find(c=>c.name===bundle.actions.liedown.clip),point=name=>root.getObjectByName(name).getWorldPosition(new THREE.Vector3());
 const lengths=()=>({front:point('upperarm_l_0204').distanceTo(point('fingers_02_l_0208')),hind:point('upperleg_l_0405').distanceTo(point('toes_02_l_0409')),chest:point('clavicle_l_0203').y-point('pelvis_08').y,hips:point('pelvis_08').y});
 const body=meshesIn(root).find(m=>m.geometry.attributes.position.count===16159),floor=skinMinimum([body]),soleSamples={};
 for(const [side,name]of [['left','fingers_02_l_0208'],['right','fingers_02_r_0274']]){const toe=point(name),samples=[];for(let i=0;i<body.geometry.attributes.position.count;i++){vec.fromBufferAttribute(body.geometry.attributes.position,i);body.applyBoneTransform(i,vec);vec.applyMatrix4(body.matrixWorld);if(vec.y<floor+.21&&Math.abs(vec.x-toe.x)<.13&&Math.abs(vec.z-toe.z)<.24)samples.push(i);}assert(samples.length>10);soleSamples[side]=samples;}
 const standing=lengths(),mixer=new THREE.AnimationMixer(root),a=mixer.clipAction(clip).setLoop(THREE.LoopOnce,1);a.clampWhenFinished=true;a.play();mixer.setTime(clip.duration*.82);root.updateMatrixWorld(true);const rising=lengths();
 const forefootClearance=Object.entries(soleSamples).map(([side,samples])=>{let min=Infinity;for(const i of samples){vec.fromBufferAttribute(body.geometry.attributes.position,i);body.applyBoneTransform(i,vec);vec.applyMatrix4(body.matrixWorld);min=Math.min(min,vec.y);}assert(min-floor<.08,side+' front hoof stays near ground during staggered rise');assert(min-floor>-.006,side+' front hoof stays above floor');return min-floor;});assert(Math.min(...forefootClearance)<.02,'At least one front hoof supports chest lift');
 assert(rising.front>standing.front*.95,'Forelegs extend first during getting up');
 assert(rising.hind<standing.hind*.60,'Hind legs remain folded until after front extension');
 assert(rising.chest-standing.chest>.20,'Chest lifts before the hindquarters');
 assert(rising.hips<standing.hips-.15,'Hips remain below standing height during chest lift');
 a.stop();mixer.uncacheRoot(root);root.updateMatrixWorld(true);
 return animateBounds(root,{clips:[clip]},Array.from({length:35},(_,i)=>.66+i*.01),'Dense get-up');
}
if(process.argv[1]?.endsWith('test-native-horse-actions.mjs')){
 assert.deepEqual(createNativeHorseActionClips({THREE,root:new THREE.Group(),profile:{nativeBreed:true,nativeKind:'horse'}}),{clips:[],actions:{}});
 const summaries=[];
 for(const [id,file]of [['white-western','review/native-trot-reference-kit/white/model.glb'],['bay-western','review/native-trot-reference-kit/bay/model.glb'],['bay-sporthorse-native','review/native-trot-reference-kit/sporthorse/model.glb']]){
  const {root,body}=loadNativeHorseFixture(file),before=[];root.traverse(o=>before.push([o,...o.position.toArray(),...o.quaternion.toArray(),...o.scale.toArray()]));
  const geometry=Buffer.from(body.geometry.attributes.position.array.buffer).toString('base64'),binds=body.skeleton.boneInverses.map(m=>m.elements.slice());
  const start=performance.now(),profile={id,nativeBreed:true,nativeKind:'horse'},result=createNativeHorseActionClips({THREE,root,profile}),generationMs=performance.now()-start;
  assert.equal(result.clips.length,7);assert.deepEqual(Object.keys(result.actions),['nuzzle','toss','graze','rear','bow','kick','liedown']);assert(result.actions.liedown.dismountedOnly);
  assert.equal(createNativeHorseActionClips({THREE,root,profile}),result,'Reuse a cached immutable prepared geometry');
  assert.deepEqual(createNativeHorseActionClips({THREE,root,profile:{...profile,nativeKind:'black-dragon'}}),{clips:[],actions:{}});
  for(const row of before)assert.deepEqual([...row[0].position.toArray(),...row[0].quaternion.toArray(),...row[0].scale.toArray()],row.slice(1),'Authoring preserves live rest transforms');
  assert.equal(Buffer.from(body.geometry.attributes.position.array.buffer).toString('base64'),geometry);assert.deepEqual(body.skeleton.boneInverses.map(m=>m.elements.slice()),binds);
  for(const stats of Object.values(result.diagnostics.clips))if(stats.maxContactErrorM!==null)assert(stats.maxContactErrorM<.002,'Supporting hoof fit');
  checkActionContactAndHolds(result,id);
  const biggestStepDeg=checkTracks(result),getUpFloorErrorM=checkLieRecovery(root,result),floorErrorM=animateBounds(root,result,Array.from({length:33},(_,i)=>i/32));summaries.push({id,generationMs:Math.round(generationMs),biggestStepDeg,floorErrorM,getUpFloorErrorM});
 }
 const variants=JSON.parse(fs.readFileSync('assets/models/native-roster/manifest.json')).breeds;let worstVariantFloor=0,prior=null;
 for(const [id,variant]of Object.entries(variants)){
  const {root}=loadNativeHorseFixture('review/native-trot-reference-kit/white/model.glb'),meshes=meshesIn(root),binary=fs.readFileSync('assets/'+variant.file);
  for(const record of variant.meshes){const mesh=meshes.find(m=>m.geometry.attributes.position.count===record.vertexCount),p=mesh.geometry.attributes.position,delta=record.positionDelta;for(let i=0;i<delta.count;i++)p.array[i]+=binary.readInt16LE(delta.byteOffset+i*2)*delta.scale;}
  const result=createNativeHorseActionClips({THREE,root,profile:{id,nativeBreed:true,nativeKind:'horse',nativeRoster:true,nativeVariant:variant}});assert.notEqual(result,prior,'Different prepared conformation cannot reuse another mesh contact fit');prior=result;
  checkTracks(result);checkActionContactAndHolds(result,id);
  if(id==='shire')assert(result.diagnostics.clips.graze.maxGrazeNeckReductionDeg>.1,'Shire longer muzzle receives its measured grazing correction');
  worstVariantFloor=Math.min(worstVariantFloor,animateBounds(root,result,[0,.125,.25,.45,.60,.75,.875,1],id));
 }
 console.log(JSON.stringify({nativeProfiles:summaries,conformations:Object.keys(variants).length,worstVariantFloor},null,2));
 console.log('Native horse actions: original binds/meshes, rest endpoints, bounded pose steps, full body/hair/tack clearance, conformation cache isolation and 25 breed appearances passed.');
}

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
function auditMotion(f,kit){
 const before=sourceState(f),clips=approvedClips(f.profile),clipState=JSON.stringify(clips.map(c=>c.toJSON()));
 const prepared=prepareNativeHoofFlex({THREE,root:f.root,clips,profile:f.profile}),mixer=new THREE.AnimationMixer(f.root);
 const wanted=[...new Set([f.profile.nativeIdleClip,...Object.values(f.profile.nativeGaits).map(g=>g.clip),f.profile.nativeJump.clip])];
 const standingFloor=bounds([f.body]).min.y,feet=[];
 for(let i=0;i<f.body.geometry.attributes.position.count;i++){f.body.getVertexPosition(i,v);f.body.localToWorld(v);if(v.y<standingFloor+.25)feet.push(i);}
 assert(feet.length>500,'Actual four-hoof surface coverage');
 const tack=f.meshes.find(m=>m.geometry.attributes.position.count===13895),treadIndices=[2716,2742,2769,2792,2818,2845];
 let minimumRelativeFloor=Infinity,minimumTreadClearance=Infinity,minimumTrotFloor=Infinity,poses=0;
 const byClip=[];
 for(const name of wanted){
  const clip=THREE.AnimationClip.findByName(prepared.clips,name);assert(clip,f.profile.id+' approved clip exists: '+name);
  const action=mixer.clipAction(clip).setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();
  let relative=Infinity,absolute=Infinity;
  for(let sample=0;sample<=40;sample++){
   prepared.layer?.beforePose();mixer.setTime(clip.duration*sample/40);f.scene.updateMatrixWorld(true);
   prepared.layer?.afterPose(new Map([[action,1]]));f.scene.updateMatrixWorld(true);
   let sole=Infinity;for(const i of feet){f.body.getVertexPosition(i,v);f.body.localToWorld(v);sole=Math.min(sole,v.y);}
   const b=bounds(kit.meshes);relative=Math.min(relative,b.min.y-sole);absolute=Math.min(absolute,b.min.y);
   assert(b.min.y>=sole-.006,f.profile.id+' '+name+' phase '+sample/40+' feathers preserve native sole clearance: '+(b.min.y-sole));
   const treads=treadIndices.map(i=>{const p=tack.getVertexPosition(i,new THREE.Vector3());return tack.localToWorld(p);});
   for(const mesh of kit.meshes)for(let i=0;i<mesh.geometry.attributes.position.count;i+=14){mesh.localToWorld(v.fromBufferAttribute(mesh.geometry.attributes.position,i));for(const tread of treads)minimumTreadClearance=Math.min(minimumTreadClearance,v.distanceTo(tread));}
   poses++;
  }
  if(name===f.profile.nativeGaits.trot.clip)minimumTrotFloor=absolute;
  minimumRelativeFloor=Math.min(minimumRelativeFloor,relative);byClip.push({name,minimumRelativeFloorM:relative,minimumAbsoluteFloorM:absolute});
  prepared.layer?.beforePose();action.stop();
 }
 prepared.layer?.dispose();mixer.uncacheRoot(f.root);f.scene.updateMatrixWorld(true);
 assert(minimumTrotFloor>.005,f.profile.id+' Trot feather tips stay at least5mm above world floor: '+minimumTrotFloor);
 assert(minimumTreadClearance>.14,f.profile.id+' preserves14cm original stirrup clearance');
 assert.equal(JSON.stringify(clips.map(c=>c.toJSON())),clipState,'Original clips remain immutable');
 assert.equal(sourceState(f),before,'Motion returns exact original bones, geometry, materials and contact transforms');
 return{poses,clips:wanted.length,minimumRelativeFloorM:minimumRelativeFloor,minimumTrotFloorM:minimumTrotFloor,minimumTreadClearanceM:minimumTreadClearance,byClip};
}
const report=[],fitted=new Map(),coverageFailures=[];
for(const id of foundations){
 const f=fixture(id),before=sourceState(f),kit=add(f);assert(kit,id+' has visible feathers');
 const stats=checkGeometry(kit,id);assert.equal(add(f),kit,'Idempotent initialization');assert.equal(sourceState(f),before,'Private installation leaves source unchanged');
 const rest=bounds(kit.meshes),floor=bounds([f.body]).min.y,coverage=collarCoverage(f,kit);
 const minimumCoverage=id==='percheron'?.50:.65; // Light Percheron collar vs full heavy-breed feather.
 for(const view of coverage)if(view.fraction<=minimumCoverage)coverageFailures.push({id,...view,minimumCoverage});
 assert(rest.min.y-floor>.035,id+' tips clear standing soles by35mm');
 if(id==='vanner')assert(rest.max.y<.32,'Vanner retains its existing32cm lower-cannon limit');
 const cannonClearances=kit.meshes.map((mesh,i)=>{const a=kit.anchors[i],top=f.scene.localToWorld(a.top.clone()).y,pivot=f.scene.localToWorld(a.pivot.clone()).y;return(top+pivot)*.5-bounds([mesh]).max.y;});
 assert(cannonClearances.every(gap=>gap>0),id+' feather stays below anatomical mid-cannon on every leg');
 const naturalColor=kit.meshes[0].material.color.clone();kit.setColors({maneColor:'#000000'});
 assert(kit.meshes[0].material.color.equals(naturalColor),'Natural stocking color is independent of mane paint');
 if(id==='vanner')assert.equal(naturalColor.getHexString(),'f1ede4','Natural Vanner retains soft white stockings');
 const motion=auditMotion(f,kit);fitted.set(id,{f,kit,before,geometry:geometryHash(kit.meshes)});
 report.push({id,...stats,requiredCollarCoverage:minimumCoverage,minimumCollarCoverage:Math.min(...coverage.map(x=>x.fraction)),coverage,standingSoleClearanceM:rest.min.y-floor,minimumCannonMidpointClearanceM:Math.min(...cannonClearances),...motion});
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

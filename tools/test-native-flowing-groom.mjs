/* Real production loader, source clips and native hair controls. No browser,
 * WebGL, network, generated model writes or saved game. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {register} from 'node:module';
const threeURL=new URL('../assets/vendor/three/build/three.module.js',import.meta.url).href;
register('data:text/javascript,'+encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return {url:${JSON.stringify(threeURL)},shortCircuit:true};return n(s,c);}`));
const THREE=await import(threeURL),{GLTFLoader}=await import('../assets/vendor/three/examples/jsm/loaders/GLTFLoader.js'),{clone}=await import('../assets/vendor/three/examples/jsm/utils/SkeletonUtils.js');
const {createBreedLibrary}=await import('../assets/breed-models.js');
const {createNativeFlowingGroom}=await import('../assets/native-flowing-groom.js');
const {createNativeHorseMotion}=await import('../assets/native-horse-motion.js');
const {validateNativeGroomRig}=await import('../assets/native-groom-layer.mjs');
const {configureNativeCustomization}=await import('../assets/native-horse-customization.js');
const {NEW_BREEDS}=await import('../assets/features/horse-roster.js');
const {EXPANSION_HORSE_BREEDS}=await import('../assets/expansion-horses.js');
const root=new URL('../',import.meta.url),hash=data=>createHash('sha256').update(data).digest('hex');
const bytes=a=>Buffer.from(a.buffer,a.byteOffset,a.byteLength);
function geometryHash(g){const h=createHash('sha256');for(const [k,a]of Object.entries(g.attributes)){h.update(k);h.update(bytes(a.array));}if(g.index)h.update(bytes(g.index.array));return h.digest('hex');}
function meshList(scene){const meshes=[];scene.traverse(o=>{if(o.isSkinnedMesh)meshes.push(o);});return meshes;}
const vector=new THREE.Vector3(),other=new THREE.Vector3();
function position(mesh,i,out=new THREE.Vector3()){mesh.getVertexPosition(i,out);return mesh.localToWorld(out);}
function posedPoints(mesh){const out=[];for(let i=0;i<mesh.geometry.attributes.position.count;i++)out.push(position(mesh,i));return out;}
class FileLoader extends GLTFLoader{
 constructor(manager){super(manager);this.register(()=>({name:'CPU_TEXTURES',loadTexture(){return Promise.resolve(new THREE.Texture());}}));}
 async loadAsync(url){const u=new URL(url);assert.equal(u.protocol,'file:');const b=fs.readFileSync(u);return this.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');}
}
const cpuTHREE={...THREE,TextureLoader:class{load(){return new THREE.Texture();}async loadAsync(url){assert.equal(new URL(url).protocol,'file:');return new THREE.Texture();}}};
const originalFetch=global.fetch;global.fetch=async url=>{const u=new URL(url);assert.equal(u.protocol,'file:');const b=fs.readFileSync(u);return {ok:true,json:async()=>JSON.parse(b.toString()),arrayBuffer:async()=>b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength)};};
const library=createBreedLibrary({THREE:cpuTHREE,GLTFLoader:FileLoader,clone});
let checks=0,frames=0;const report=[],failures=[];
function check(ok,label){assert(ok,label);checks++;}
function equal(a,b,label){assert.deepEqual(a,b,label);checks++;}
function roleComponents(mesh,scene){
 const count=mesh.geometry.attributes.position.count,parent=Int32Array.from({length:count},(_,i)=>i),find=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
 const index=mesh.geometry.index.array;
 for(let i=0;i<index.length;i+=3){const a=find(index[i]);parent[find(index[i+1])]=a;parent[find(index[i+2])]=a;}
 const groups=new Map();for(let i=0;i<count;i++){const key=find(i);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(i);}
 const p=posedPoints(mesh).map(v=>scene.worldToLocal(v)),out=[];
 for(const ids of groups.values()){
  const box=new THREE.Box3().setFromPoints(ids.map(i=>p[i])),size=box.getSize(new THREE.Vector3()),zs=ids.map(i=>p[i].z).sort((a,b)=>a-b);
  const role=zs[Math.floor(zs.length/2)]<-.6?'tail':Math.max(size.x,size.y,size.z)<.04?'eyelashes':zs[Math.floor(zs.length/2)]>1.12?'forelock':'mane';
  const anchor=ids.reduce((a,i)=>p[i].y>p[a].y?i:a,ids[0]);out.push({ids,role,anchor});
 }
 return out;
}
function roleMetrics(mesh,roles){
 const points=posedPoints(mesh),out={};
 for(const role of ['mane','forelock','tail']){
  const groups=roles.filter(r=>r.role===role),ids=groups.flatMap(r=>r.ids),box=new THREE.Box3().setFromPoints(ids.map(i=>points[i]));
  const reach=groups.reduce((n,g)=>n+Math.max(...g.ids.map(i=>points[i].distanceTo(points[g.anchor]))),0)/groups.length;
  out[role]={minY:box.min.y,width:box.max.x-box.min.x,reach};
 }
 return out;
}
function snapshotGeometry(meshes){return meshes.map(m=>({mesh:m,geometry:m.geometry,hash:geometryHash(m.geometry),material:m.material,bind:m.bindMatrix.toArray(),inverse:m.skeleton.boneInverses.map(b=>b.toArray()),position:m.geometry.attributes.position.array.slice(),normal:m.geometry.attributes.normal.array.slice()}));}
function arrays(meshes){return meshes.map(m=>({position:m.geometry.attributes.position.array.slice(),normal:m.geometry.attributes.normal.array.slice()}));}
function assertArrays(meshes,expected,label){for(let m=0;m<meshes.length;m++)for(const key of ['position','normal'])assert.deepEqual(meshes[m].geometry.attributes[key].array,expected[m][key],label);checks++;}
function shader(){return {uniforms:{},vertexShader:THREE.ShaderLib.physical.vertexShader,fragmentShader:THREE.ShaderLib.physical.fragmentShader};}
try{
 await library.manifestReady;
 for(const row of [...NEW_BREEDS,...EXPANSION_HORSE_BREEDS])library.register(row);
 const ids=process.env.GROOM_IDS?process.env.GROOM_IDS.split(','):['white-western','bay-western','bay-sporthorse-native','belgian','shire','clyde','vanner','fjord','iceland','rimewalker'];
 for(const id of ids){
  const asset=await library.load(id);check(asset.key===id,id+' resolves to the requested actual model, never fallback');const rig=library.instantiate(asset),peer=library.instantiate(asset);
  // Match expression seeds so intentional per-horse blinking/breathing does
  // not masquerade as a grooming change in the protected-skin comparator.
  peer.nativeRoot.uuid=rig.nativeRoot.uuid;
  // Production installs the source controller before private hair geometry.
  const motion=createNativeHorseMotion({THREE,root:rig.nativeRoot,clips:rig.animations,profile:rig.profile}),plain=createNativeHorseMotion({THREE,root:peer.nativeRoot,clips:peer.animations,profile:peer.profile});
  rig.scene.updateMatrixWorld(true);peer.scene.updateMatrixWorld(true);
  const meshes=meshList(rig.scene),peerMeshes=meshList(peer.scene),hair=meshes.find(m=>m.geometry.attributes.position.count===23514),crest=meshes.find(m=>m.userData.nativeFjordCrest);
  const sourceRows=snapshotGeometry(meshList(asset.scene)),before=snapshotGeometry(meshes),peerBefore=snapshotGeometry(peerMeshes),roles=roleComponents(hair,rig.scene),metricsBefore=roleMetrics(hair,roles);
  const fileURLs=[new URL(rig.profile.file,new URL('../assets/',import.meta.url)),...(rig.profile.nativeVariant?[new URL(rig.profile.nativeVariant.file,new URL('../assets/',import.meta.url))]:[])];
  const sourceFiles=fileURLs.map(url=>[url,hash(fs.readFileSync(url))]);
  const boneBefore=rig.bones.map(b=>[b.name,b.parent?.name,b.position.toArray(),b.quaternion.toArray(),b.scale.toArray()]);
  const started=performance.now(),groom=createNativeFlowingGroom({THREE,scene:rig.scene,skin:rig.skin,profile:rig.profile}),buildMs=performance.now()-started;
  check(!!groom,id+' accepts verified native equine');
  let updateCalls=0,updateTotalMs=0,updateMaxMs=0;const physicalUpdate=groom.update;groom.update=(...args)=>{const start=performance.now();const result=physicalUpdate(...args);if(args[0]>0){const ms=performance.now()-start;updateCalls++;updateTotalMs+=ms;updateMaxMs=Math.max(updateMaxMs,ms);}return result;};
  check(createNativeFlowingGroom({THREE,scene:rig.scene,skin:rig.skin,profile:rig.profile})===groom,id+' repeated creation is idempotent');
  check(validateNativeGroomRig(rig).eligible,id+' enlarged hair retains audited source-only hair inertia eligibility');
  equal(rig.bones.map(b=>[b.name,b.parent?.name,b.position.toArray(),b.quaternion.toArray(),b.scale.toArray()]),boneBefore,id+' authoring leaves all source bone transforms intact');
  const modified=before.filter(row=>row.mesh.geometry!==row.geometry);check(modified.length>0&&modified.every(row=>row.mesh===hair||row.mesh.userData.nativeEquestrianGroom),id+' only source hair/approved locks get private geometry');
  equal(meshList(rig.scene).length,meshes.length,id+' no additional skin/draw calls');
  for(const row of before){
   check(row.mesh.material===row.material,id+' keeps current material and dye shader');equal(row.mesh.bindMatrix.toArray(),row.bind,id+' preserves binds');equal(row.mesh.skeleton.boneInverses.map(b=>b.toArray()),row.inverse,id+' preserves inverse binds');
   if(row.mesh.geometry===row.geometry)check(geometryHash(row.geometry)===row.hash,id+' protected geometry unchanged');
   else{
    const g=row.mesh.geometry;check(g.attributes.position.count===row.geometry.attributes.position.count,id+' vertex topology preserved');
    for(const [key,a]of Object.entries(row.geometry.attributes))if(!['position','normal'].includes(key))equal(g.attributes[key].array,a.array,id+' preserves '+key);
    equal(g.index.array,row.geometry.index.array,id+' index topology preserved');
    for(const key of ['position','normal'])check(g.attributes[key].array.every(Number.isFinite),id+' finite '+key);
    const n=g.attributes.normal;check(Array.from({length:n.count},(_,i)=>Math.hypot(n.getX(i),n.getY(i),n.getZ(i))).every(v=>Math.abs(v-1)<.003),id+' unit smooth normals');
   }
  }
  for(const row of [...sourceRows,...peerBefore])check(geometryHash(row.geometry)===row.hash,id+' shared prepared asset and peer remain immutable');
  const metricsAfter=roleMetrics(hair,roles),oldHair=before.find(r=>r.mesh===hair);
  for(const card of roles){
   if(card.role==='eyelashes'||id==='fjord'&&card.role!=='tail')for(const i of card.ids)for(let c=0;c<3;c++)assert.equal(hair.geometry.attributes.position.array[i*3+c],oldHair.position[i*3+c],id+' preserves lashes and Fjord mane/forelock');
  }checks++;
  if(crest)check(before.find(row=>row.mesh===crest).geometry===crest.geometry,id+' upright crest untouched');
  check(metricsAfter.tail.width>metricsBefore.tail.width*1.05,id+' visibly fuller tail width');
  check(metricsAfter.tail.minY<metricsBefore.tail.minY-.003,id+' longer tail reaches lower');
  if(id!=='fjord')check(metricsAfter.mane.reach>metricsBefore.mane.reach*1.025,id+' longer mane has greater root-to-tip reach');
  const enlarged=arrays(groom.meshes),privateGeometry=groom.meshes.map(m=>m.geometry);
  for(const row of groom.roots){const mesh=groom.meshes.find(m=>m.name===row.mesh),baseline=before.find(b=>b.mesh===mesh);check(!!mesh&&row.ids.length>0,id+' exposes nonempty root attachment');for(const i of row.ids)for(let c=0;c<3;c++)assert.equal(mesh.geometry.attributes.position.array[i*3+c],baseline.position[i*3+c],id+' static roots remain bit-exact');}
  check(!!motion.groomInertia,id+' original hair-only inertia stays enabled');
  const bonesHash=()=>hash(JSON.stringify(rig.bones.map(b=>[b.position.toArray(),b.quaternion.toArray(),b.scale.toArray()])));
  const stateBefore=bonesHash();groom.update(0,motion.state);check(bonesHash()===stateBefore,id+' secondary geometry update cannot modify source bones');
  const scenePosition=rig.scene.position.clone(),sceneRotation=rig.scene.quaternion.clone();
  groom.reset();for(let frame=0;frame<20;frame++){rig.scene.position.set(frame*.06,.15,-frame*.04);rig.scene.rotation.y=frame*.04;rig.scene.updateMatrixWorld(true);groom.update(1/60,motion.state);}
  for(let m=0;m<groom.meshes.length;m++){
   equal(groom.meshes[m].geometry.attributes.position.array,enlarged[m].position,id+' actor-only movement cannot invent hair displacement');
   const n=groom.meshes[m].geometry.attributes.normal.array;check(n.every((v,i)=>Math.abs(v-enlarged[m].normal[i])<1e-6),id+' actor-only normal transport differs by at most float-rounding');
  }
  rig.scene.position.copy(scenePosition);rig.scene.quaternion.copy(sceneRotation);rig.scene.updateMatrixWorld(true);groom.reset();
  let minimumY=Infinity,baselineMinimumY=Infinity,maxProtected=0,maxHairDelta=0,maxAdded=0,maxActualSway=0,minimumPose=null;
  const protectedRows=before.filter(row=>row.mesh!==hair&&!row.mesh.userData.nativeEquestrianGroom&&!row.mesh.userData.nativeFjordCrest);
  function sample(label){
   rig.scene.updateMatrixWorld(true);peer.scene.updateMatrixWorld(true);
   for(const row of protectedRows){const index=meshes.indexOf(row.mesh),comp=peerMeshes[index];for(let i=0;i<row.mesh.geometry.attributes.position.count;i+=113)maxProtected=Math.max(maxProtected,position(row.mesh,i,vector).distanceTo(position(comp,i,other)));}
   for(const mesh of groom.meshes){const index=meshes.indexOf(mesh),comp=peerMeshes[index];for(let i=0;i<mesh.geometry.attributes.position.count;i+=7){position(mesh,i,vector);position(comp,i,other);assert(vector.toArray().every(Number.isFinite),id+' '+label+' finite posed hair');if(vector.y<minimumY){minimumY=vector.y;minimumPose={label,state:motion.state.action||{phase:motion.state.phase01},mesh:mesh.name,vertex:i,baselineY:other.y};}baselineMinimumY=Math.min(baselineMinimumY,other.y);maxHairDelta=Math.max(maxHairDelta,vector.distanceTo(other));}}
   for(const row of groom.roots){const mesh=groom.meshes.find(m=>m.name===row.mesh),baseline=before.find(b=>b.mesh===mesh);for(const i of row.ids)for(let c=0;c<3;c++)assert.equal(mesh.geometry.attributes.position.array[i*3+c],baseline.position[i*3+c],id+' animated roots stay bit-exact');}
   for(let m=0;m<groom.meshes.length;m++){const mesh=groom.meshes[m];for(let i=0;i<mesh.geometry.attributes.position.count;i+=11){position(mesh,i,vector);other.fromArray(enlarged[m].position,i*3);mesh.applyBoneTransform(i,other);mesh.localToWorld(other);maxActualSway=Math.max(maxActualSway,vector.distanceTo(other));}}
   const stats=groom.inspect();assert(stats.finite!==false,id+' '+label+' finite controller state');maxAdded=Math.max(maxAdded,stats.maxTipOffsetM||0);frames++;
  }
  for(const [mode,lead]of [['walk','left'],['trot','left'],['canter','left'],['gallop','right']]){
   motion.reset();plain.reset();groom.reset();motion.set(mode,{lead});plain.set(mode,{lead});
   const record=rig.profile.nativeGaits[mode+(/^canter|gallop$/.test(mode)?(lead==='left'?'Left':'Right'):'')]||rig.profile.nativeGaits[mode],duration=record.durationS,total=Math.ceil(duration*60);
   for(let i=0;i<=total;i++){const dt=i?duration/total:0;motion.update(dt);plain.update(dt);const beforeUpdate=bonesHash();groom.update(dt,motion.state);assert.equal(bonesHash(),beforeUpdate,'hair deformation never moves source bones');if(i%5===0||i===total)sample(mode);}
  }
  // Head and grounded poses stress neckline/dock attachments beyond riding gaits.
  for(const action of ['graze','rear','liedown']){
   if(!motion.supportsAction(action))continue;motion.reset();plain.reset();groom.reset();motion.startAction(action);plain.startAction(action);
   const duration=motion.action.durationS,total=Math.ceil(duration*30);
   for(let i=0;i<=total;i++){const dt=i?duration/total:0;motion.update(dt);plain.update(dt);groom.update(dt,motion.state);if(i%6===0||i===total)sample(action);}
  }
  check(maxProtected<1e-8,id+' body eyes tack and feet are unaffected through real clips/actions ('+maxProtected+')');
  check(maxActualSway>.001&&maxActualSway<.16,id+' actual skinned tip motion is visible and bounded ('+maxActualSway+')');
  check(maxHairDelta>.015,id+' real posed groom remains visibly different from original');
  if(minimumY<Math.min(-.015,baselineMinimumY-.015))failures.push({id,issue:'New hair ground penetration',minimumY,baselineMinimumY,minimumPose});else checks++;
  console.log(JSON.stringify({id,minimumY,baselineMinimumY,minimumPose,maxActualSway,maxProtected}));
  let rateAgreement=null;
  if(['white-western','belgian'].includes(id)){
   function runRate(hz){
    motion.reset();groom.reset();motion.set('trot');groom.update(0,motion.state);
    for(let i=0;i<hz*1.2;i++){motion.update(1/hz);groom.update(1/hz,motion.state);}rig.scene.updateMatrixWorld(true);
    const offsets=[];for(let m=0;m<groom.meshes.length;m++){const mesh=groom.meshes[m];for(let i=0;i<mesh.geometry.attributes.position.count;i+=97){position(mesh,i,vector);other.fromArray(enlarged[m].position,i*3);mesh.applyBoneTransform(i,other);mesh.localToWorld(other);offsets.push(...vector.sub(other).toArray());}}
    return offsets;
   }
   const at30=runRate(30),at60=runRate(60),repeat60=runRate(60),at120=runRate(120);
   equal(repeat60,at60,id+' reset/replay is deterministic at fixed source time');
   const error=a=>Math.max(...a.map((v,i)=>Math.abs(v-at120[i])));rateAgreement={hz30:error(at30),hz60:error(at60)};
   check(rateAgreement.hz30<.018&&rateAgreement.hz60<.010,id+' bounded30/60/120Hz physical agreement '+JSON.stringify(rateAgreement));
  }
  const paused=arrays(groom.meshes);for(const dt of [0,NaN,-1,undefined]){groom.update(dt,motion.state);assertArrays(groom.meshes,paused,id+' pause/invalid time holds visible arrays');}
  groom.update(1/60,{...motion.state,paused:true});assertArrays(groom.meshes,paused,id+' explicit pause holds arrays');
  groom.reset();assertArrays(groom.meshes,enlarged,id+' reset restores enlarged rest exactly');
  motion.reset();plain.reset();groom.reset();for(let i=0;i<240;i++)groom.update(1/60,motion.state);
  check((groom.inspect().maxTipOffsetM||0)<.001,id+' still hair settles without artificial perpetual flutter');
  // Geometry replacement must not lose later dye setup or existing shader seams.
  if(rig.profile.nativeRoster){
   const dyes=configureNativeCustomization({THREE:cpuTHREE,rig,horse:{id:'groom-qa',breed:id,colors:{body:rig.profile.nativeRosterColors?.body||'#a46e42',mane:'#894ad4'},tailCol:'#33b6ab'}});
   check(dyes?.applied.mane&&dyes?.applied.tail,id+' separate saved dyes remain supported');
   for(const entry of dyes.hair)for(const m of entry.materials){const s=shader();m.onBeforeCompile(s);check(s.uniforms.nrManeOn?.value===1&&s.uniforms.nrTailOn?.value===1,id+' compiled dye uniforms retain both channels');}
   dyes.dispose();
  }
  for(const row of [...sourceRows,...peerBefore])check(geometryHash(row.geometry)===row.hash,id+' animation/dyes never mutate shared asset/peer arrays');
  let disposed=0;for(const g of privateGeometry)g.addEventListener('dispose',()=>disposed++);
  groom.dispose();groom.dispose();equal(disposed,privateGeometry.length,id+' each private geometry disposed once');
  for(const row of before)check(row.mesh.geometry===row.geometry,id+' dispose restores original geometry identity');
  motion.dispose();plain.dispose();for(const [url,digest]of sourceFiles)check(hash(fs.readFileSync(url))===digest,id+' source/model bytes stay unchanged');
  report.push({id,buildMs:Math.round(buildMs),updateTiming:{calls:updateCalls,meanMs:updateTotalMs/updateCalls,maxMs:updateMaxMs},before:metricsBefore,after:metricsAfter,minimumHairY:minimumY,baselineMinimumY,minimumPose,maxProtectedDeltaM:maxProtected,maxHairDifferenceM:maxHairDelta,maxAddedTipOffsetM:maxAdded,maxActualSwayM:maxActualSway,rateAgreement,stats:groom.inspect()});
  console.log(`CHECKED ${id}: private geometry, preserved rig/dyes, real clips and lifecycle`);
 }
 check(createNativeFlowingGroom({THREE,scene:new THREE.Group(),profile:{nativeBreed:true,nativeKind:'dragon'}})===null,'non-equine is excluded');
 console.log(JSON.stringify({checks,sampledPoses:frames,report,failures},null,2));assert.equal(failures.length,0,JSON.stringify(failures));console.log(`Native flowing groom: PASS ${checks} checks and ${frames} actual posed samples.`);
}finally{global.fetch=originalFetch;}

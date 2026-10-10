// Geometry-only regression: real GLTFLoader names/skin, no browser or WebGL.
// Texture references are omitted while parsing fixtures; this does not test art.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {register} from 'node:module';
import {createHash} from 'node:crypto';
const threeURL=new URL('../assets/vendor/three/build/three.module.js',import.meta.url).href;
register('data:text/javascript,'+encodeURIComponent(`export async function resolve(specifier,context,next){if(specifier==='three')return {url:${JSON.stringify(threeURL)},shortCircuit:true};return next(specifier,context);}`),import.meta.url);
const CoreTHREE=await import(threeURL);
const THREE={...CoreTHREE,TextureLoader:class{async loadAsync(){return new CoreTHREE.Texture();}}};
const {GLTFLoader}=await import('../assets/vendor/three/examples/jsm/loaders/GLTFLoader.js');
const {clone}=await import('../assets/vendor/three/examples/jsm/utils/SkeletonUtils.js');
const {createBreedLibrary}=await import('../assets/breed-models.js');
const {initGameHero,tickGameHero,startGameHeroJump}=await import('../assets/game-hero-horse.js');
const {createTackCollection,tackDesignFingerprint}=await import('../assets/tack-collection-models.js');
const {TACK_COLLECTIONS,TACK_PIECES,TACK_SLOTS}=await import('../assets/tack-collection.mjs');
const digest=array=>createHash('sha256').update(new Uint8Array(array.buffer,array.byteOffset,array.byteLength)).digest('hex');
const originalFetch=globalThis.fetch;
globalThis.fetch=async url=>{const u=new URL(url);assert.equal(u.protocol,'file:','fixture never accesses the network');let bytes=await readFile(fileURLToPath(u));
 // Compare candidate against the exact released morph prefix even after the
 // production manifest has adopted its optional attachment. Body data stays real.
 if(u.pathname.endsWith('/native-roster/manifest.json')){const d=JSON.parse(bytes);for(const row of Object.values(d.breeds))if(row.tackAttachment){row.sha256=row.tackAttachment.baseMorphSha256;row.byteLength=728256;delete row.tackAttachment;}bytes=Buffer.from(JSON.stringify(d));}
 return new Response(bytes);};
class GeometryLoader extends GLTFLoader{
 async loadAsync(url){
  const bytes=await readFile(fileURLToPath(new URL(url))),length=bytes.readUInt32LE(12),doc=JSON.parse(bytes.subarray(20,20+length));
  doc.materials=(doc.materials||[]).map(m=>({name:m.name,doubleSided:m.doubleSided,pbrMetallicRoughness:{baseColorFactor:[.4,.3,.2,1],roughnessFactor:.7,metallicFactor:0}}));
  delete doc.images;delete doc.textures;delete doc.samplers;doc.extensionsUsed=(doc.extensionsUsed||[]).filter(x=>!x.includes('texture'));doc.extensionsRequired=(doc.extensionsRequired||[]).filter(x=>!x.includes('texture'));
  let json=Buffer.from(JSON.stringify(doc));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);const bin=bytes.subarray(20+length),out=Buffer.alloc(20+json.length+bin.length);
  out.writeUInt32LE(0x46546c67,0);out.writeUInt32LE(2,4);out.writeUInt32LE(out.length,8);out.writeUInt32LE(json.length,12);out.writeUInt32LE(0x4e4f534a,16);json.copy(out,20);bin.copy(out,20+json.length);
  return this.parseAsync(out.buffer.slice(out.byteOffset,out.byteOffset+out.byteLength),'');
 }
}
const library=createBreedLibrary({THREE,GLTFLoader:GeometryLoader,clone});
await library.manifestReady;
const set=id=>Object.fromEntries(TACK_PIECES.filter(p=>p.collectionId===id).map(p=>[p.slot,p]));

// Private collar candidate against two independent real production instances.
const {applyNativeCollarAttachment}=await import('../assets/native-collar-attachment.js');
const {validateNativeGroomRig}=await import('../assets/native-groom-layer.mjs');
const {createNativeTackModes}=await import('../assets/native-rider.js');
const {writeFile}=await import('node:fs/promises');
const candidateDir=process.argv[2]||'review/draft-front-check/attachment-preview';
const horseIds=(process.argv[3]||'shire').split(',');
const reports=[];
const meshesIn=root=>{const out=[];root.traverse(m=>{if(m.isSkinnedMesh)out.push(m);});return out;};
const world=(m,i)=>m.localToWorld(m.getVertexPosition(i,new THREE.Vector3()));
function attrsHash(g){const h=createHash('sha256');for(const [name,a]of Object.entries(g.attributes)){h.update(name);h.update(new Uint8Array(a.array.buffer,a.array.byteOffset,a.array.byteLength));}h.update(new Uint8Array(g.index.array.buffer));return h.digest('hex');}
for(const horse of horseIds){
 const meta=JSON.parse(await readFile(candidateDir+'/'+horse+'.json','utf8')),buffer=await readFile(candidateDir+'/'+horse+'.bin');
 const asset=await library.load(horse),plain=library.instantiate(asset),live=library.instantiate(asset),actor=new THREE.Group(),peerActor=new THREE.Group();actor.add(live.scene);peerActor.add(plain.scene);actor.updateMatrixWorld(true);peerActor.updateMatrixWorld(true);
 assert.equal(live.profile.nativeVariant.sha256,meta.baselineSha256,'Candidate matches loaded baseline');
 const baseline=live.nativeContacts.tack.geometry,hash=attrsHash(baseline),ids=new Set(new Uint16Array(buffer.buffer,buffer.byteOffset+meta.record.vertexIds.byteOffset,meta.record.vertexCount));
 assert.equal(plain.nativeContacts.tack.geometry,baseline,'Instances initially share cached immutable geometry');
 applyNativeCollarAttachment({THREE,mesh:live.nativeContacts.tack,record:meta.record,binary:buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.byteLength),profile:live.profile});
 const changed=live.nativeContacts.tack.geometry;assert.notEqual(changed,baseline);assert.equal(attrsHash(baseline),hash);
 for(const name of Object.keys(baseline.attributes)){const a=baseline.attributes[name],b=changed.attributes[name];for(let i=0;i<a.count;i++)if(!ids.has(i)||!['position','normal','skinIndex','skinWeight'].includes(name))for(let k=0;k<a.itemSize;k++)assert.equal(a.array[i*a.itemSize+k],b.array[i*a.itemSize+k],horse+' protected '+name+'/'+i);}
 assert.deepEqual(changed.index.array,baseline.index.array);
 const report={horse,previewSha256:meta.previewSha256,attachmentVertices:ids.size,poses:0,standingMaxErrorM:0,protectedAnimatedMaxErrorM:0,finiteCollarSamples:0};
 for(const i of ids)report.standingMaxErrorM=Math.max(report.standingMaxErrorM,world(live.nativeContacts.tack,i).distanceTo(world(plain.nativeContacts.tack,i)));
 assert(report.standingMaxErrorM<2e-5,horse+' standing shape preserved');
 for(const rig of [plain,live]){assert(validateNativeGroomRig(rig).eligible);initGameHero(THREE,rig);assert.equal(rig.heroMotion.groomInertia.validation.controls,58);}
 const lm=meshesIn(live.nativeRoot),pm=meshesIn(plain.nativeRoot),protectedIds=Array.from({length:13895},(_,i)=>i).filter(i=>!ids.has(i));
 for(const [mode,lead]of [['rest','left'],['walk','left'],['trot','left'],['canter','left'],['canter','right'],['gallop','left'],['gallop','right'],['jump','left']]){
  for(const rig of [live,plain]){rig.heroMotion.reset();rig.heroMotion.set(mode,{lead});rig.heroMotion.update(.25,{rate:0});}
  const duration=mode==='rest'?0:mode==='jump'?live.profile.nativeJump.durationS:live.profile.nativeGaits[['canter','gallop'].includes(mode)?mode+(lead==='right'?'Right':'Left'):mode].durationS;
  let at=0;
  for(const phase of [0,.125,.25,.5,.75,.95]){
   while(at<duration*phase-1e-9){const dt=Math.min(1/120,duration*phase-at);for(const rig of [live,plain]){rig.heroMotion.update(dt,{rate:1});rig.scene.updateMatrixWorld(true);rig.heroMotion.finishGroomPose();rig.scene.updateMatrixWorld(true);}at+=dt;}
   actor.updateMatrixWorld(true);peerActor.updateMatrixWorld(true);report.poses++;
   for(let mi=0;mi<lm.length;mi++){
    const a=lm[mi],b=pm[mi];assert.equal(a.name,b.name);const count=a.geometry.attributes.position.count;
    const sampleIds=count===13895?protectedIds:Array.from({length:count},(_,i)=>i);
    for(const i of sampleIds){const p=world(a,i),q=world(b,i);assert(p.toArray().every(Number.isFinite));const error=p.distanceTo(q);report.protectedAnimatedMaxErrorM=Math.max(report.protectedAnimatedMaxErrorM,error);assert(error<1e-9,horse+' '+mode+' changed protected '+a.name+'/'+i);}
   }
   for(const i of ids){assert(world(live.nativeContacts.tack,i).toArray().every(Number.isFinite));report.finiteCollarSamples++;}
  }
 }
 // Actual collection partitioning and bareback/wild handling, then exact restore.
 for(const rig of [plain,live]){rig.heroMotion.reset();rig.scene.updateMatrixWorld(true);}
 const classic=set('classic'),kits=[plain,live].map((rig,i)=>createTackCollection({THREE,rig,mount:i?actor:peerActor,equippedDesigns:classic}));
 assert.deepEqual(kits[1].stats.nativeFoundation,kits[0].stats.nativeFoundation,'Attachment preserves source saddle/bridle partition');
 report.nativeFoundation=kits[1].stats.nativeFoundation;
 for(let cycle=0;cycle<2;cycle++)for(const state of [{bareback:true,wild:false},{bareback:false,wild:true},{bareback:false,wild:false}])for(const kit of kits)kit.update(0,state);
 for(const kit of kits)kit.dispose();assert.equal(live.nativeContacts.tack.geometry,changed);assert.equal(plain.nativeContacts.tack.geometry,baseline);
 const modes=createNativeTackModes({THREE,rig:live,mount:actor});const before=attrsHash(changed);modes.setMode('bareback');const visible=new Set(live.nativeContacts.tack.geometry.index.array);assert([...ids].every(i=>!visible.has(i)),'Bareback hides complete corrected collar');modes.setMode('wild');assert.equal(live.nativeContacts.tack.visible,false);modes.setMode('saddled');modes.dispose();assert.equal(live.nativeContacts.tack.geometry,changed);assert.equal(attrsHash(changed),before);assert.equal(attrsHash(baseline),hash);
 for(const rig of [plain,live]){rig.heroMotion.dispose();rig.groom?.dispose();}
 reports.push(report);console.log(JSON.stringify(report));
}
await writeFile(candidateDir+'/runtime-validation.json',JSON.stringify(reports,null,2)+'\n');
globalThis.fetch=originalFetch;

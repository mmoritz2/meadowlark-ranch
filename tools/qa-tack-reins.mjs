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
globalThis.fetch=async url=>{const u=new URL(url);assert.equal(u.protocol,'file:','fixture never accesses the network');return new Response(await readFile(fileURLToPath(u)));};
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


const {createNativeRiderReins}=await import('../assets/native-rider.js');
function originalMeshes(rig){const out=[];rig.scene.traverse(mesh=>{if(mesh.isSkinnedMesh&&/^M_Saddle[12]$/.test(mesh.material.name))out.push(mesh);});return out;}
const findReins=kit=>kit.group.getObjectByName('Resting leather reins');
function sourceIndices(mesh){return Array.from(mesh.geometry.index.array,i=>mesh.userData.sourceVertexIds[i]);}
function exactSkin(privateMesh,sourceMesh){const a=new THREE.Vector3(),b=new THREE.Vector3();let worst=0;for(let i=0;i<privateMesh.geometry.attributes.position.count;i++){privateMesh.getVertexPosition(i,a);privateMesh.localToWorld(a);sourceMesh.getVertexPosition(privateMesh.userData.sourceVertexIds[i],b);sourceMesh.localToWorld(b);assert(a.toArray().every(Number.isFinite));worst=Math.max(worst,a.distanceTo(b));}assert(worst<1e-5,'private reins exactly retain authored pose, clearance and skin: '+worst);return worst;}
function assertMode(kit,mode,visible,extra={}){kit.update(0,{reinsMode:mode,...extra});assert.equal(findReins(kit).visible,visible);assert.equal(kit.stats.restingReins.mode,mode);}
function observeReins(mesh){const disposed=new Set();for(const resource of [mesh.geometry,mesh.material])resource.addEventListener('dispose',()=>disposed.add(resource));return()=>assert.equal(disposed.size,2);}
try{
 for(const horse of ['white-western','bay-western','bay-sporthorse-native']){
  const rig=library.instantiate(await library.load(horse)),mount=new THREE.Group();mount.add(rig.scene);initGameHero(THREE,rig);tickGameHero(rig,0,0);rig.scene.updateMatrixWorld(true);const sourceMesh=rig.nativeContacts.tack,originalGeometry=sourceMesh.geometry,originalMaterial=sourceMesh.material,rawCount=sourceMesh.geometry.index.count,rawVertexHash=digest(sourceMesh.geometry.attributes.position.array),sourceMaterials=originalMeshes(rig).map(m=>[m,m.material]);
  const raw=createTackCollection({THREE,rig,mount,equippedDesigns:set('rosequartz')}),privateMesh=findReins(raw);assert(privateMesh);assert.equal(privateMesh.geometry.index.count,4920);assert.equal(privateMesh.geometry.attributes.position.count,1642);assert.equal(raw.stats.nativeFoundation.hiddenSourceReinTriangles,1640);assert.equal(sourceMesh.geometry.index.count,rawCount,'raw source indices retained');assert.equal(sourceMesh.material[4].visible,false,'original rein draw group always hidden');assert.equal(privateMesh.material.color.getHexString(),new THREE.Color(set('rosequartz').bridle.design.leather).getHexString());assert.equal(privateMesh.skeleton,sourceMesh.skeleton);assert.deepEqual(privateMesh.bindMatrix.toArray(),sourceMesh.bindMatrix.toArray());assert(exactSkin(privateMesh,sourceMesh)<1e-5);const rawIndices=sourceIndices(privateMesh),disposed=observeReins(privateMesh);
  assertMode(raw,'ridden',false);assertMode(raw,'none',false);assertMode(raw,'resting',true);assertMode(raw,'resting',false,{wild:true});assertMode(raw,'resting',true,{bareback:true});
  raw.apply({bridle:set('classicwestern').bridle});disposed();assert(findReins(raw));assert.equal(findReins(raw).material.color.getHexString(),originalMaterial.color.getHexString(),'classic reins preserve original leather');assert.equal(sourceMesh.material[4].visible,false);assert.equal(sourceMesh.material[1].visible,true,'classic headstall remains visible');assert.deepEqual(sourceIndices(findReins(raw)),rawIndices);
  raw.apply({bridle:set('rosequartz').bridle});assert.equal(raw.group.children.length,1,'bridle-only resting look needs no saddle');assertMode(raw,'resting',true);raw.apply({});assert(!findReins(raw));assert.equal(raw.group.children.length,0);assert.equal(sourceMesh.visible,false);raw.dispose();assert.equal(sourceMesh.geometry,originalGeometry);assert.equal(sourceMesh.material,originalMaterial);assert(!sourceMesh.userData.nativeRestingReinIndices,'raw renderer does not mutate source metadata');
  // Player bridge provides the exact same original indices before replacing
  // its display geometry. Controller disposal must precede bridge disposal.
  const bridge=createNativeRiderReins({THREE,scene:mount,tack:sourceMesh,anchors:{},rider:{},contactPoint(){},seatFollower:rig.nativeSeatFollower});assert.deepEqual([...sourceMesh.userData.nativeRestingReinIndices],rawIndices,'bridge metadata matches independently extracted raw triangles');assert.equal(sourceMesh.geometry.index.count,15554*3);const preparedGeometry=sourceMesh.geometry;
  const kit=createTackCollection({THREE,rig,mount,equippedDesigns:{bridle:set('rosequartz').bridle}});assert.equal(kit.stats.nativeFoundation.hiddenSourceReinTriangles,0,'prepared source contains no duplicate rein triangles');assert.deepEqual(sourceIndices(findReins(kit)),rawIndices);const errors=[exactSkin(findReins(kit),sourceMesh)];
  for(const speed of [rig.profile.nativeGaits.walk.nominalSpeedMps,rig.profile.nativeMaxSpeedMps]){for(let i=0;i<40;i++){tickGameHero(rig,speed,1/60);kit.update(1/60,{reinsMode:'resting'});}errors.push(exactSkin(findReins(kit),sourceMesh));}
  assert(startGameHeroJump(rig));for(let i=0;i<22;i++){tickGameHero(rig,1,1/60);kit.update(1/60);}errors.push(exactSkin(findReins(kit),sourceMesh));assertMode(kit,'ridden',false);kit.apply(set('classicwestern'));assert.equal(findReins(kit).visible,false,'equipment swap retains mounted rein mode');assertMode(kit,'resting',true);assert(exactSkin(findReins(kit),sourceMesh)<1e-5);const lastDisposed=observeReins(findReins(kit));kit.dispose();lastDisposed();assert.equal(sourceMesh.geometry,preparedGeometry);bridge.dispose();assert.equal(sourceMesh.geometry,originalGeometry);assert(!sourceMesh.userData.nativeRestingReinIndices,'bridge metadata cleaned up');for(const [mesh,material]of sourceMaterials)assert.equal(mesh.material,material);assert.equal(digest(sourceMesh.geometry.attributes.position.array),rawVertexHash,'source vertex bytes untouched');
  console.log('PASS',horse,'raw/prepared, Rose Quartz/Classic/bridle-only, no duplicate source reins, riding/resting/none/Wild, walk/gallop/jump skin error',Math.max(...errors).toExponential(2),'and exact teardown');
 }
}finally{globalThis.fetch=originalFetch;}

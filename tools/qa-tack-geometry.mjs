// Geometry-only regression: real GLTFLoader names/skin, no browser or WebGL.
// Texture references are omitted while parsing fixtures; this does not test art.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {register} from 'node:module';
import {createHash} from 'node:crypto';
const threeURL=new URL('../assets/vendor/three/build/three.module.js',import.meta.url).href;
register('data:text/javascript,'+encodeURIComponent(`export async function resolve(specifier,context,next){if(specifier==='three')return {url:${JSON.stringify(threeURL)},shortCircuit:true};return next(specifier,context);}`),import.meta.url);
const THREE=await import(threeURL);
const {GLTFLoader}=await import('../assets/vendor/three/examples/jsm/loaders/GLTFLoader.js');
const {clone}=await import('../assets/vendor/three/examples/jsm/utils/SkeletonUtils.js');
const {createBreedLibrary}=await import('../assets/breed-models.js');
const {initGameHero,tickGameHero}=await import('../assets/game-hero-horse.js');
const {createTackCollection,tackDesignFingerprint}=await import('../assets/tack-collection-models.js');
const {TACK_COLLECTIONS,TACK_PIECES,TACK_SLOTS}=await import('../assets/tack-collection.mjs');
const digest=array=>createHash('sha256').update(new Uint8Array(array.buffer,array.byteOffset,array.byteLength)).digest('hex');
const originalFetch=globalThis.fetch;
globalThis.fetch=async url=>{const u=new URL(url);assert.equal(u.protocol,'file:','fixture never accesses the network');return new Response(await readFile(fileURLToPath(u)));};
class GeometryLoader extends GLTFLoader{
 async loadAsync(url){
  const bytes=await readFile(fileURLToPath(new URL(url))),length=bytes.readUInt32LE(12),doc=JSON.parse(bytes.subarray(20,20+length));
  doc.materials=(doc.materials||[]).map(m=>({name:m.name,doubleSided:m.doubleSided,pbrMetallicRoughness:{baseColorFactor:[.4,.3,.2,1],roughnessFactor:.7}}));
  delete doc.images;delete doc.textures;delete doc.samplers;doc.extensionsUsed=(doc.extensionsUsed||[]).filter(x=>!x.includes('texture'));doc.extensionsRequired=(doc.extensionsRequired||[]).filter(x=>!x.includes('texture'));
  let json=Buffer.from(JSON.stringify(doc));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);const bin=bytes.subarray(20+length),out=Buffer.alloc(20+json.length+bin.length);
  out.writeUInt32LE(0x46546c67,0);out.writeUInt32LE(2,4);out.writeUInt32LE(out.length,8);out.writeUInt32LE(json.length,12);out.writeUInt32LE(0x4e4f534a,16);json.copy(out,20);bin.copy(out,20+json.length);
  return this.parseAsync(out.buffer.slice(out.byteOffset,out.byteOffset+out.byteLength),'');
 }
}
const library=createBreedLibrary({THREE,GLTFLoader:GeometryLoader,clone});
await library.manifestReady;
const set=id=>Object.fromEntries(TACK_PIECES.filter(p=>p.collectionId===id).map(p=>[p.slot,p]));
const max={vertices:0,triangles:0,meshes:0},signatures=new Set();
assert.equal(new Set(TACK_PIECES.map(tackDesignFingerprint)).size,TACK_PIECES.length);
function meshesIn(node){const out=[];node.traverse(o=>{if(o.isSkinnedMesh)out.push(o);});return out;}
function checkGeometry(kit){
 assert.equal(kit.stats.legFit.resolvedEndpoints,8,'all leg attachment joints must resolve after GLTFLoader sanitizes names');
 assert.equal(kit.stats.legFit.fallbackSections,0,'supported horse legs must fit measured surfaces');
 const meshes=meshesIn(kit.group);assert.equal(meshes.length,kit.stats.meshes);for(const mesh of meshes){const m=mesh.material;if(!m.map)continue;assert(m.bumpMap,'patterned textile has physical surface relief');assert(m.bumpScale>0&&m.bumpScale<=.01,'relief stays small compared with fit');assert.equal(m.map.minFilter,THREE.LinearMipmapLinearFilter,'textile avoids nearest-neighbor shimmer');assert(m.bumpMap.image.data.some((x,i)=>i%4!==3&&x!==m.bumpMap.image.data[0]),'relief includes actual pattern variation');}assert(kit.stats.meshes<=24,'bounded batched draw count');assert(kit.stats.triangles<=70000,'bounded sculpted four-piece geometry: '+kit.stats.triangles);assert(kit.stats.vertices<=140000,'bounded vertex count: '+kit.stats.vertices);
 for(const key of Object.keys(max))max[key]=Math.max(max[key],kit.stats[key]);
 for(const mesh of meshes){const g=mesh.geometry;for(const key of ['position','normal','uv','skinWeight'])assert(g.attributes[key].array.every(Number.isFinite),'finite '+key);assert.equal(g.attributes.normal.count,g.attributes.position.count,'closed-shell added vertices have normals');const normal=g.attributes.normal,rendered=new Set(),pa=new THREE.Vector3(),pb=new THREE.Vector3(),pc=new THREE.Vector3();for(let i=0;i<(g.index?.count||normal.count);i+=3){const ids=[0,1,2].map(k=>g.index?g.index.getX(i+k):i+k);pa.fromBufferAttribute(g.attributes.position,ids[0]);pb.fromBufferAttribute(g.attributes.position,ids[1]).sub(pa);pc.fromBufferAttribute(g.attributes.position,ids[2]).sub(pa);if(pb.cross(pc).lengthSq()>1e-18)for(const id of ids)rendered.add(id);}for(const i of rendered)assert(Math.hypot(normal.getX(i),normal.getY(i),normal.getZ(i))>.9,'nondegenerate shell vertex must have a unit normal: '+mesh.name+' vertex '+i);const w=g.attributes.skinWeight,j=g.attributes.skinIndex;for(let i=0;i<w.count;i+=11){let sum=0;for(let k=0;k<4;k++){assert(j.getComponent(i,k)<mesh.skeleton.bones.length);sum+=w.getComponent(i,k);}assert(Math.abs(sum-1)<1e-5,'normalized transferred weights');}}
}
function sampledLegwear(kit,mount){const out=[],v=new THREE.Vector3();kit.group.traverse(mesh=>{if(!mesh.isSkinnedMesh||mesh.parent.name!=='Collection shoes')return;for(let i=0;i<mesh.geometry.attributes.position.count;i+=17){mesh.getVertexPosition(i,v);mesh.localToWorld(v);mount.worldToLocal(v);out.push(v.clone());}});return out;}
function checkLegAttachment(kit,rig,mount){
 rig.scene.updateMatrixWorld(true);kit.update(0);const bones=new Map(rig.bones.map(b=>[b.name,b]));
 const segments=kit.stats.legFit.frames.map(f=>['lower','upper'].map(key=>mount.worldToLocal(bones.get(f[key]).getWorldPosition(new THREE.Vector3()))));
 let worst=0;for(const p of sampledLegwear(kit,mount)){let distance=Infinity;for(const [a,b]of segments){const axis=b.clone().sub(a),t=THREE.MathUtils.clamp(p.clone().sub(a).dot(axis)/axis.lengthSq(),-.24,1.15);distance=Math.min(distance,p.distanceTo(a.clone().addScaledVector(axis,t)));}worst=Math.max(worst,distance);}
 assert(worst<.15,'legwear remains on measured cannon segments, maximum radius '+worst.toFixed(4));return worst;
}
try{
 for(const horse of ['weekly_moonstone','bay-sporthorse']){
  const rig=library.instantiate(await library.load(horse)),mount=new THREE.Group();mount.add(rig.scene);initGameHero(THREE,rig);tickGameHero(rig,0,0);
  assert.equal(rig.bones.length,horse==='weekly_moonstone'?100:40);
  if(horse==='bay-sporthorse'){assert(rig.bones.some(b=>b.name==='FLpastern'),'real imported names have reserved dots stripped');assert(!rig.bones.some(b=>b.name==='FL.pastern'));}
  const bodyPosition=digest(rig.skin.geometry.attributes.position.array),bodyWeights=digest(rig.skin.geometry.attributes.skinWeight.array),inverse=rig.skin.skeleton.boneInverses.map(m=>m.toArray()),originalMaterials=new Map();rig.scene.traverse(o=>{if(o.isMesh)originalMaterials.set(o,o.material);});
  const kit=createTackCollection({THREE,rig,mount,equippedDesigns:set('moonpetal')});checkGeometry(kit);const initialRadius=checkLegAttachment(kit,rig,mount),before=sampledLegwear(kit,mount);
  const sameMeshes=meshesIn(kit.group);kit.apply(set('moonpetal'));assert.deepEqual(meshesIn(kit.group),sameMeshes,'applying the same items does not rebuild');
  for(let i=0;i<45;i++){tickGameHero(rig,1.5,1/60);kit.update(1/60);}const after=sampledLegwear(kit,mount);assert(before.some((p,i)=>p.distanceTo(after[i])>.005),'tack actually follows the animated skin');const walkRadius=checkLegAttachment(kit,rig,mount);
  kit.update(0,{bareback:true});assert.equal(kit.group.children.find(o=>o.name==='Collection saddle').visible,false);assert.equal(kit.group.children.find(o=>o.name==='Collection pad').visible,false);assert.equal(kit.group.children.find(o=>o.name==='Collection bridle').visible,true);kit.update(0,{wild:true});assert.equal(kit.group.visible,false);kit.update(0,{bareback:false,wild:false});
  kit.dispose();for(const [mesh,mat]of originalMaterials)assert.equal(mesh.material,mat,'native materials restored');assert(!kit.group.parent);
  const moving=createTackCollection({THREE,rig,mount,equippedDesigns:{shoes:set('moonpetal').shoes}});checkGeometry(moving);checkLegAttachment(moving,rig,mount);moving.dispose();
  if(rig.profile.henryHorse)rig.heroMotion.reset('idle',0);else rig.heroMotion.reset();tickGameHero(rig,0,0);
  const all=createTackCollection({THREE,rig,mount});
  if(horse==='weekly_moonstone')for(const collection of TACK_COLLECTIONS){all.apply(set(collection.id));checkGeometry(all);for(const node of all.group.children){const sha=createHash('sha256');node.traverse(mesh=>{if(mesh.isSkinnedMesh){sha.update(new Uint8Array(mesh.geometry.attributes.position.array.buffer));sha.update(new Uint8Array(mesh.geometry.index.array.buffer));}});signatures.add(node.name+':'+sha.digest('hex'));}}
  all.apply(set('moonpetal'));const own=new Set();all.group.traverse(o=>{if(o.isMesh){own.add(o.geometry);for(const m of(Array.isArray(o.material)?o.material:[o.material])){own.add(m);for(const key of ['map','bumpMap','normalMap','roughnessMap'])if(m[key])own.add(m[key]);}}});const destroyed=new Set();for(const r of own)r.addEventListener('dispose',()=>destroyed.add(r));let bodyDisposed=false;rig.skin.geometry.addEventListener('dispose',()=>bodyDisposed=true);all.dispose();assert.equal(destroyed.size,own.size,'all live collection geometry/materials/textures disposed');assert.equal(bodyDisposed,false,'horse geometry is not disposed by tack');
  if(horse==='bay-sporthorse'){
   const carrier=new THREE.Group(),padMat=new THREE.MeshStandardMaterial(),sourceMap=new THREE.DataTexture(new Uint8Array([110,58,20,255]),1,1),leatherMat=new THREE.MeshStandardMaterial({map:sourceMap}),legacyGeo=new THREE.PlaneGeometry(.2,.2),legacyPad=new THREE.Mesh(legacyGeo,padMat),legacyLeather=new THREE.Mesh(legacyGeo,leatherMat);carrier.add(legacyPad,legacyLeather);carrier.userData.mats={pad:padMat,leather:leatherMat};mount.add(carrier);
   const both={saddle:set('moonpetal').saddle,pad:set('moonpetal').pad},withLegacy=createTackCollection({THREE,rig,mount,tack:{saddle:carrier},equippedDesigns:both});
   assert.equal(carrier.visible,true,'saddle/IK carrier remains visible');assert.equal(legacyPad.visible,false,'collection pad suppresses legacy pad even with a saddle material override');assert.equal(legacyPad.material,padMat,'saddle tint must not capture the pad material');
   assert.equal(legacyLeather.material.map,sourceMap,'authored source UV texture remains private and untouched');assert.equal(legacyLeather.material.color.getHexString(),new THREE.Color(both.saddle.design.leather).getHexString(),'foundation uses actual collection leather color');const shader={fragmentShader:'#include <map_fragment>'};legacyLeather.material.onBeforeCompile(shader);assert(shader.fragmentShader.includes('tackLuminance'),'native source pigment is neutralized before tinting');assert(!shader.fragmentShader.includes('#include <map_fragment>'));let sourceMapDisposed=false;sourceMap.addEventListener('dispose',()=>sourceMapDisposed=true);
   withLegacy.apply({saddle:both.saddle});assert.equal(legacyPad.visible,true,'removing collection pad restores legacy pad');withLegacy.dispose();assert.equal(legacyLeather.material,leatherMat,'legacy leather material restored');assert.equal(sourceMapDisposed,false,'native source map remains alive after collection disposal');carrier.removeFromParent();legacyGeo.dispose();padMat.dispose();leatherMat.dispose();sourceMap.dispose();
  }
  assert.equal(digest(rig.skin.geometry.attributes.position.array),bodyPosition);assert.equal(digest(rig.skin.geometry.attributes.skinWeight.array),bodyWeights);assert.deepEqual(rig.skin.skeleton.boneInverses.map(m=>m.toArray()),inverse,'native bindings remain unchanged');
  console.log('PASS',horse,'8 named leg endpoints; fitted idle/walk/mid-stride; radii',initialRadius.toFixed(3),walkRadius.toFixed(3),'visibility, ownership and cleanup');
 }
 assert.equal(signatures.size,TACK_PIECES.length,'all catalog items produce different geometry, not only different colors');
 console.log('PASS all distinct geometry signatures; maximum full-set budget',JSON.stringify(max));
}finally{globalThis.fetch=originalFetch;}

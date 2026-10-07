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
const {TACK_PIECES,TACK_SLOTS}=await import('../assets/tack-collection.mjs');
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


const {PREMIUM_TACK_SETS}=await import('../assets/premium-tack.mjs');
const {tackPieceSVG}=await import('../assets/tack-collection-art.mjs');
const themes=PREMIUM_TACK_SETS.filter(s=>s.design.premiumTheme),themeIds=new Set(themes.map(s=>s.id));
assert.equal(themes.length,5);const legacy=TACK_PIECES.filter(p=>!themeIds.has(p.collectionId)&&!p.design.nativeOriginal);assert.equal(legacy.length,104);
const legacyArt=createHash('sha256').update(legacy.map(p=>[p.id,tackPieceSVG(p)]).sort(([a],[b])=>a.localeCompare(b)).map(JSON.stringify).join('\n')).digest('hex');
assert.equal(legacyArt,'3141e3a21cb29ef234d71545dcedb25504d9ca064899d6f1a53618943d1646cc','original100 plus Rainbow illustrations remain byte-for-byte unchanged');
const art=new Set();for(const piece of TACK_PIECES.filter(p=>themeIds.has(p.collectionId))){const svg=tackPieceSVG(piece);assert(svg.startsWith('<svg'));assert(!/undefined|NaN|Infinity/.test(svg));assert(svg.includes('viewBox="0 0 320 240"'));assert(svg.includes('aria-label="'+piece.name));art.add(svg);}assert.equal(art.size,20,'all20 new illustrations are distinct');
function meshes(kit){const out=[];kit.group.traverse(o=>{if(o.isSkinnedMesh)out.push(o);});return out;}
function slotHashes(kit){return Object.fromEntries(kit.group.children.map(node=>{const hash=createHash('sha256');node.traverse(o=>{if(o.isSkinnedMesh){hash.update(new Uint8Array(o.geometry.attributes.position.array.buffer));hash.update(new Uint8Array(o.geometry.index.array.buffer));}});return [node.name,hash.digest('hex')];}));}
function validate(kit){assert.equal(kit.stats.legFit.resolvedEndpoints,8);assert.equal(kit.stats.legFit.fallbackSections,0);assert(kit.stats.triangles<=70000,'bounded premium full-set geometry: '+kit.stats.triangles);assert(kit.stats.meshes<=24,'bounded material batches: '+kit.stats.meshes);for(const mesh of meshes(kit)){const g=mesh.geometry;assert.equal(g.attributes.position.count,g.attributes.normal.count);for(const key of ['position','normal','uv','skinWeight'])assert(g.attributes[key].array.every(Number.isFinite));}}
const geometrySignatures=new Set(),buildTimes=[],max={triangles:0,meshes:0,vertices:0};
try{
 for(const id of ['weekly_moonstone','bay-sporthorse']){
  const rig=library.instantiate(await library.load(id)),mount=new THREE.Group();mount.add(rig.scene);initGameHero(THREE,rig);tickGameHero(rig,0,0);const originalPositions=digest(rig.skin.geometry.attributes.position.array),originalWeights=digest(rig.skin.geometry.attributes.skinWeight.array),originalMaterials=new Map();rig.scene.traverse(o=>{if(o.isMesh)originalMaterials.set(o,o.material);});
  const kit=createTackCollection({THREE,rig,mount});
  for(const theme of themes){
   const pieces=set(theme.id);assert.equal(Object.keys(pieces).length,4);const start=performance.now();kit.apply(pieces);buildTimes.push(performance.now()-start);validate(kit);for(const k of Object.keys(max))max[k]=Math.max(max[k],kit.stats[k]);
   const decorated=slotHashes(kit),stable=meshes(kit);kit.apply(pieces);assert.deepEqual(meshes(kit),stable,'same design does not rebuild');if(id==='weekly_moonstone')Object.entries(decorated).forEach(([slot,hash])=>geometrySignatures.add(slot+':'+hash));
   for(const node of kit.group.children)assert(node.children.some(m=>m.name.toLowerCase().includes(theme.id==='blossom'?'cherry blossom':theme.id==='forestguardian'?'forest guardian':theme.id)),'every slot has its actual themed geometry');
   const unadorned=Object.fromEntries(Object.entries(pieces).map(([slot,piece])=>{const design={...piece.design};delete design.premiumTheme;return [slot,{...piece,design}];}));kit.apply(unadorned);const base=slotHashes(kit);for(const slot of Object.keys(decorated))assert.notEqual(decorated[slot],base[slot],theme.id+' '+slot+' adds real geometry rather than only a name/color');
  }
  kit.apply(set('glacier'));const samples=()=>{const out=[],v=new THREE.Vector3();for(const mesh of meshes(kit))for(let i=0;i<mesh.geometry.attributes.position.count;i+=79){mesh.getVertexPosition(i,v);mesh.localToWorld(v);assert(v.toArray().every(Number.isFinite));out.push(v.clone());}return out;};const idle=samples();for(let i=0;i<25;i++){tickGameHero(rig,1.7,1/60);kit.update(1/60);}const walk=samples();assert(walk.some((p,i)=>p.distanceTo(idle[i])>.003));
  kit.update(0,{bareback:true});assert.equal(kit.group.children.find(n=>n.name==='Collection saddle').visible,false);assert.equal(kit.group.children.find(n=>n.name==='Collection pad').visible,false);kit.update(0,{wild:true});assert.equal(kit.group.visible,false);kit.update(0,{wild:false,bareback:false});
  const own=new Set(),disposed=new Set();for(const mesh of meshes(kit)){own.add(mesh.geometry);own.add(mesh.material);for(const key of ['map','bumpMap'])if(mesh.material[key])own.add(mesh.material[key]);}for(const obj of own)obj.addEventListener('dispose',()=>disposed.add(obj));kit.dispose();assert.equal(disposed.size,own.size);for(const [mesh,mat]of originalMaterials)assert.equal(mesh.material,mat);assert.equal(digest(rig.skin.geometry.attributes.position.array),originalPositions);assert.equal(digest(rig.skin.geometry.attributes.skinWeight.array),originalWeights);
  console.log('PASS',id,'all20 premium pieces have additional finite themed geometry; fit, motion, idempotence, visibility, source ownership and disposal');
 }
 assert.equal(geometrySignatures.size,20);assert(Math.max(...buildTimes)<15000,'bounded synchronous full-set builds');console.log('PASS20 unique premium geometries and illustrations; all104 legacy illustrations unchanged; maximum',JSON.stringify(max),'slowest build ms',Math.round(Math.max(...buildTimes)));
}finally{globalThis.fetch=originalFetch;}

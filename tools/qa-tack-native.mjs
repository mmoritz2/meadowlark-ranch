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
const catalogOnly=process.argv.includes('--catalog'),optionalOnly=process.argv.includes('--optional');
const fixtures=process.argv.find(a=>a.startsWith('--horses='))?.slice(9).split(',')||['white-western','bay-western','bay-sporthorse-native','welsh','shire'];
const vec=()=>new THREE.Vector3();
function skinned(root){const out=[];root.traverse(o=>{if(o.isSkinnedMesh)out.push(o);});return out;}
function inspectGeometry(kit){
 assert.equal(kit.stats.sourceJoints,677);assert.equal(kit.stats.legFit.resolvedEndpoints,8);assert.equal(kit.stats.legFit.fallbackSections,0);
 assert.equal(kit.stats.nativeFoundation.meshes,2);assert(kit.stats.nativeFoundation.saddleTriangles>10000);assert(kit.stats.nativeFoundation.bridleTriangles>4500);
 assert(kit.stats.meshes<=24);assert(kit.stats.triangles<70000);assert.equal(skinned(kit.group).length,kit.stats.meshes);
 for(const mesh of skinned(kit.group)){const g=mesh.geometry;for(const field of ['position','normal','skinWeight','uv'])assert(g.attributes[field].array.every(Number.isFinite),field+' finite');assert.equal(g.attributes.normal.count,g.attributes.position.count);assert.equal(mesh.skeleton.bones.length,677);for(let i=0;i<g.attributes.position.count;i+=19){let sum=0;for(let k=0;k<4;k++){sum+=g.attributes.skinWeight.getComponent(i,k);assert(g.attributes.skinIndex.getComponent(i,k)<677);}assert(Math.abs(sum-1)<1e-5,'normalized original mesh skin weights');}}
}
function sample(kit,mount,slot){const out=[],v=vec();for(const mesh of skinned(kit.group)){if(mesh.parent.name!=='Collection '+slot)continue;for(let i=0;i<mesh.geometry.attributes.position.count;i+=31){mesh.getVertexPosition(i,v);out.push(mount.worldToLocal(mesh.localToWorld(v.clone())));}}return out;}
function legRadius(kit,rig,mount){const segments=kit.stats.legFit.frames.map(f=>['lower','upper'].map(k=>mount.worldToLocal(rig.boneMap[f[k]].getWorldPosition(vec()))));let max=0;for(const p of sample(kit,mount,'shoes')){let best=Infinity;for(const [a,b]of segments){const d=b.clone().sub(a),t=THREE.MathUtils.clamp(p.clone().sub(a).dot(d)/d.lengthSq(),-.30,1.18);best=Math.min(best,p.distanceTo(a.clone().addScaledVector(d,t)));}max=Math.max(max,best);}assert(max<.16,'boots remain on current cannon axes: '+max);return max;}
function checkSurfaceEdges(kit,mount){const v=vec();for(const mesh of skinned(kit.group)){if(!/Collection (saddle|pad)/.test(mesh.parent.name))continue;const g=mesh.geometry;let longest=0;for(let i=0;i<g.index.count;i+=3){const points=[0,1,2].map(k=>{mesh.getVertexPosition(g.index.getX(i+k),v);return mount.worldToLocal(mesh.localToWorld(v.clone()));});for(let k=0;k<3;k++)longest=Math.max(longest,points[k].distanceTo(points[(k+1)%3]));}assert(longest<.19,'continuous torso panels must not jump between native saddle islands: '+longest);}}

const roles=['saddle','bridle','saddle','pad','sourceReins'];
function assertSourceSlots(native,designs={},bareback=false,wild=false){for(const mesh of native){assert.equal(mesh.material.length,5);let visible=false;for(let i=0;i<5;i++){const wanted=designs[roles[i]]?.design.nativeOriginal===true&&!wild&&(!bareback||roles[i]==='bridle');assert.equal(mesh.material[i].visible,wanted,'original '+roles[i]+' is explicitly selected');visible ||= wanted&&mesh.geometry.groups[i].count>0;}assert.equal(mesh.visible,visible);}}
function originalState(native){return new Map(native.map(m=>[m,{geometry:m.geometry,material:m.material,count:m.geometry.index.count,index:digest(m.geometry.index.array),position:digest(m.geometry.attributes.position.array),weights:digest(m.geometry.attributes.skinWeight.array)}]));}
function assertPreserved(native,originals){for(const mesh of native){const o=originals.get(mesh);assert.equal(mesh.geometry.index.count,o.count);assert.equal(mesh.geometry.groups.reduce((n,g)=>n+g.count,0),o.count);assert.equal(digest(mesh.geometry.attributes.position.array),o.position);assert.equal(digest(mesh.geometry.attributes.skinWeight.array),o.weights);for(const mat of mesh.material){assert.equal(mat.color.getHexString(),o.material.color.getHexString(),'classic source colors remain unmodified');assert.equal(mat.map,o.material.map,'classic source texture remains unmodified');}}}
function assertRestored(originals){for(const [mesh,o]of originals){assert.equal(mesh.geometry,o.geometry);assert.equal(mesh.material,o.material);assert.equal(digest(mesh.geometry.index.array),o.index);}}
function observeResources(kit,native){const owned=new Set(),disposed=new Set();for(const m of skinned(kit.group)){owned.add(m.geometry);owned.add(m.material);for(const k of ['map','bumpMap'])if(m.material[k])owned.add(m.material[k]);}for(const m of native){owned.add(m.geometry);for(const mat of m.material)owned.add(mat);}for(const r of owned)r.addEventListener('dispose',()=>disposed.add(r));return()=>assert.equal(disposed.size,owned.size,'all private resources disposed without retaining old looks');}
function nativeContact(rig,mount,range,top){const box=new THREE.Box3(),v=vec();for(let i=range[0];i<=range[1];i++){rig.nativeContacts.tack.getVertexPosition(i,v);box.expandByPoint(mount.worldToLocal(rig.nativeContacts.tack.localToWorld(v.clone())));}const p=box.getCenter(vec());if(top)p.y=box.max.y;return p;}
function partContacts(kit,mount,name,top){const out=[],v=vec();for(const mesh of skinned(kit.group))for(const part of mesh.userData.partRanges||[{name:mesh.name,start:0,count:mesh.geometry.attributes.position.count}]){if(part.name!==name)continue;const box=new THREE.Box3();for(let i=part.start;i<part.start+part.count;i++){mesh.getVertexPosition(i,v);box.expandByPoint(mount.worldToLocal(mesh.localToWorld(v.clone())));}const p=box.getCenter(vec());if(top)p.y=box.max.y;out.push(p);}return out;}
function checkSupportContacts(kit,rig,mount){let worst=0;for(const [name,ranges,top]of [['Contact-fitted stirrup tread',rig.nativeContacts.treadRanges,true],['Contact-fitted bit ring',rig.nativeContacts.bitRanges,false]]){const actual=partContacts(kit,mount,name,top);assert.equal(actual.length,2,'new '+name+' replaces original hardware');const expected=['left','right'].map(side=>nativeContact(rig,mount,ranges[side],top));for(let i=0;i<2;i++)worst=Math.max(worst,actual[i].distanceTo(expected[i]));}assert(worst<.025,'new support stays at native contact in motion: '+worst);return worst;}
async function setup(horse){const rig=library.instantiate(await library.load(horse)),mount=new THREE.Group();mount.add(rig.scene);initGameHero(THREE,rig);tickGameHero(rig,0,0);rig.scene.updateMatrixWorld(true);const native=skinned(rig.scene).filter(m=>/^M_Saddle[12]$/.test(m.material.name));assert.equal(native.length,2);const untouched=originalState(native),reins=createNativeRiderReins({THREE,scene:mount,tack:rig.nativeContacts.tack,anchors:{},rider:{},contactPoint(){},seatFollower:rig.nativeSeatFollower}),originals=originalState(native);return{rig,mount,native,originals,untouched,reins};}
try{
 if(!catalogOnly)for(const horse of optionalOnly?fixtures.slice(0,3):fixtures){
  const {rig,mount,native,originals,untouched,reins}=await setup(horse),kit=createTackCollection({THREE,rig,mount}),classic=set('classicwestern'),rainbow=set('rainbow');assert.deepEqual(Object.keys(classic).sort(),['bridle','pad','saddle']);
  assertSourceSlots(native);assert.equal(kit.group.children.length,0);assertPreserved(native,originals);
  // Each original slot is independently optional, including mixed classic/new
  // looks. New accessories never reveal an unselected source strap or blanket.
  for(const slot of ['saddle','pad','bridle']){kit.apply({[slot]:classic[slot]});assertSourceSlots(native,{[slot]:classic[slot]});assert(skinned(kit.group).every(m=>m.userData.restingReins),'classic uses exact original geometry and private source reins');assert(kit.stats.pieces[slot].sourceTriangles>0);kit.apply({[slot]:rainbow[slot]});assertSourceSlots(native);assert.equal(kit.group.children.length,1);inspectGeometry(kit);if(slot==='saddle')assert.equal(partContacts(kit,mount,'Contact-fitted stirrup tread',true).length,2);if(slot==='bridle')assert.equal(partContacts(kit,mount,'Contact-fitted bit ring',false).length,2);const mixed={...rainbow,[slot]:classic[slot]};kit.apply(mixed);assertSourceSlots(native,mixed);assertPreserved(native,originals);}
  kit.apply(classic);assertSourceSlots(native,classic);assert(skinned(kit.group).every(m=>m.userData.restingReins));kit.update(0,{bareback:true});assertSourceSlots(native,classic,true);kit.update(0,{wild:true});assertSourceSlots(native,classic,false,true);kit.update(0,{bareback:false,wild:false});
  kit.apply(rainbow);inspectGeometry(kit);checkSurfaceEdges(kit,mount);assertSourceSlots(native);assertPreserved(native,originals);const radii=[legRadius(kit,rig,mount)],contacts=[checkSupportContacts(kit,rig,mount)],initial=sample(kit,mount,'shoes'),same=skinned(kit.group);kit.apply(rainbow);assert.deepEqual(skinned(kit.group),same);
  for(const speed of [rig.profile.nativeGaits.walk.nominalSpeedMps,rig.profile.nativeMaxSpeedMps]){for(let i=0;i<35;i++){tickGameHero(rig,speed,1/60);kit.update(1/60);}radii.push(legRadius(kit,rig,mount));contacts.push(checkSupportContacts(kit,rig,mount));}
  const moved=sample(kit,mount,'shoes');assert(initial.some((p,i)=>p.distanceTo(moved[i])>.005));assert(startGameHeroJump(rig));for(let i=0;i<22;i++){tickGameHero(rig,1,1/60);kit.update(1/60);}radii.push(legRadius(kit,rig,mount));contacts.push(checkSupportContacts(kit,rig,mount));assertSourceSlots(native);
  kit.update(0,{bareback:true});assert.equal(kit.group.children.find(n=>n.name==='Collection pad').visible,false);assert.equal(kit.group.children.find(n=>n.name==='Collection bridle').visible,true);kit.update(0,{bareback:false,wild:false});
  const disposed=observeResources(kit,native);kit.apply({});disposed();assertSourceSlots(native);assertPreserved(native,originals);kit.dispose();assertRestored(originals);
  const moving=createTackCollection({THREE,rig,mount,equippedDesigns:{shoes:set('glacier').shoes}});inspectGeometry(moving);radii.push(legRadius(moving,rig,mount));assertSourceSlots(native);moving.dispose();assertRestored(originals);reins.dispose();assertRestored(untouched);
  console.log('PASS',horse,'empty/single/classic/mixed/new; 677 joints / 8 endpoints / 0 fallback; walk/gallop/jump; contact errors',contacts.map(x=>x.toFixed(4)).join('/'),'leg radii',radii.map(x=>x.toFixed(3)).join('/'));
 }
 if(!optionalOnly){
  const maxima={vertices:0,triangles:0,meshes:0},signatures=new Set(),generatedCollections=TACK_COLLECTIONS.filter(c=>!c.nativeOriginal);
  for(const horse of ['white-western','bay-western']){
   const {rig,mount,native,originals,reins}=await setup(horse),kit=createTackCollection({THREE,rig,mount}),bodyPosition=digest(rig.skin.geometry.attributes.position.array),bodyWeights=digest(rig.skin.geometry.attributes.skinWeight.array);
   const collections=horse==='white-western'?TACK_COLLECTIONS:[...generatedCollections.slice(0,5),...generatedCollections.slice(25),TACK_COLLECTIONS.find(c=>c.nativeOriginal)],profiles=Object.fromEntries(TACK_SLOTS.map(slot=>[slot,new Set()]));
   for(const [n,collection]of collections.entries()){
    try{
     const pieces=set(collection.id);kit.apply(pieces);inspectGeometry(kit);checkSurfaceEdges(kit,mount);legRadius(kit,rig,mount);assertSourceSlots(native,pieces);assertPreserved(native,originals);
     if(!collection.nativeOriginal)checkSupportContacts(kit,rig,mount);
     for(const [slot,piece]of Object.entries(pieces))profiles[slot].add(piece.design.profile);for(const name of Object.keys(maxima))maxima[name]=Math.max(maxima[name],kit.stats[name]);
     for(const node of kit.group.children){const sha=createHash('sha256');for(const mesh of skinned(node)){sha.update(new Uint8Array(mesh.geometry.attributes.position.array.buffer));sha.update(new Uint8Array(mesh.geometry.index.array.buffer));}if(collection.nativeOriginal)for(const mesh of native)for(const g of mesh.geometry.groups)if(roles[g.materialIndex]===(node.name.replace('Collection ','')))sha.update(new Uint8Array(mesh.geometry.index.array.slice(g.start,g.start+g.count).buffer));if(horse==='white-western')signatures.add(node.name+':'+sha.digest('hex'));}
     const disposed=observeResources(kit,native);kit.apply({});disposed();assertSourceSlots(native);assertPreserved(native,originals);
    }catch(error){throw new Error(horse+' / '+collection.id+': '+error.message,{cause:error});}
    if((n+1)%5===0||n+1===collections.length)console.log('PASS catalog progress',horse,(n+1)+'/'+collections.length);
   }
   for(const slot of TACK_SLOTS)assert.equal(profiles[slot].size,5,horse+' exercises every '+slot+' profile');assert.equal(digest(rig.skin.geometry.attributes.position.array),bodyPosition);assert.equal(digest(rig.skin.geometry.attributes.skinWeight.array),bodyWeights);kit.dispose();assertRestored(originals);reins.dispose();console.log('PASS',horse,collections.length+' sets; all slot profiles, native slots only by explicit selection, complete new supports, source restoration/disposal');
  }
  assert.equal(signatures.size,TACK_PIECES.length,'every piece has distinct actual native geometry');console.log('PASS all '+signatures.size+' native geometry signatures; full-set maximum '+JSON.stringify(maxima));
 }
}finally{globalThis.fetch=originalFetch;}

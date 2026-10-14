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
const {validateNativeGroomRig}=await import('../assets/native-groom-layer.mjs');
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


const {createNativeRidingGroom,verifyNativeRidingGroom,withNativeRidingResources}=await import('../assets/native-riding-groom.mjs');
const {createNativeHorseMotion}=await import('../assets/native-horse-motion.js');
const {configureNativeCustomization}=await import('../assets/native-horse-customization.js');
const canonical=(scene,m,i)=>scene.worldToLocal(position(m,i));
const protectedRows=rig=>meshList(rig.scene).filter(m=>[16159,2028,13895,5092].includes(m.geometry.attributes.position.count)).map(m=>({mesh:m,hash:geometryHash(m.geometry),geometry:m.geometry,material:m.material,bind:m.bindMatrix.toArray(),bones:m.skeleton.bones.slice(),inverses:m.skeleton.boneInverses.map(v=>v.toArray())}));
const checkRows=rows=>{for(const r of rows){assert.equal(geometryHash(r.mesh.geometry),r.hash);assert.equal(r.mesh.geometry,r.geometry);assert.equal(r.mesh.material,r.material);assert.deepEqual(r.mesh.bindMatrix.toArray(),r.bind);assert.deepEqual(r.mesh.skeleton.bones,r.bones);assert.deepEqual(r.mesh.skeleton.boneInverses.map(v=>v.toArray()),r.inverses);}};
const originalFlowing=(await import('data:text/javascript,'+encodeURIComponent(fs.readFileSync(new URL('./fixtures/native-riding-groom-f23e91b/parent-native-flowing-groom.js.txt',import.meta.url),'utf8')))).createNativeFlowingGroom;
const parentMeta=JSON.parse(fs.readFileSync(new URL('./fixtures/native-riding-groom-f23e91b/fixture.json',import.meta.url)));for(const[f,h]of Object.entries(parentMeta.protectedInputs))assert.equal(hash(fs.readFileSync(new URL(f,root))),h,'Pinned real native source '+f);

const {initGameHero,tickGameHero,finishNativeHorseGrooms,disposeMountedRig}=await import('../assets/game-hero-horse.js');
await library.manifestReady;const reports=[];
for(const id of ['bay-sporthorse','grey','fjord','shire']){
 const asset=await library.load(id),rig=library.instantiate(asset);initGameHero(cpuTHREE,rig);
 const expected=['bay-sporthorse','grey'].includes(id),riding=rig.groom.stats.riding;assert.equal(!!riding,expected);
 const extra=meshList(rig.scene).filter(m=>m.userData.nativeRidingGroom);assert.equal(extra.length,expected?1:0);if(expected){assert.equal(riding.triangles,1776);assert.equal(riding.vertices,1036);assert(validateNativeGroomRig(rig).eligible);}
 const before=protectedRows(rig);for(let i=0;i<12;i++){tickGameHero(rig,2+i/10,1/60);finishNativeHorseGrooms();checkRows(before);assert(rig.groom.stats.flowing.finite);}
 const oldScene=rig.scene,oldExtra=extra[0],oldGroom=rig.groom;initGameHero(cpuTHREE,rig);assert.equal(rig.scene,oldScene);assert.notEqual(rig.groom,oldGroom);if(expected){assert(!oldExtra.parent);assert.equal(meshList(rig.scene).filter(m=>m.userData.nativeRidingGroom).length,1);}
 tickGameHero(rig,0,0);finishNativeHorseGrooms();disposeMountedRig(rig);assert.equal(meshList(rig.scene).filter(m=>m.userData.nativeRidingGroom).length,0);reports.push({id,riding:expected,poseFrames:12,reinitializationAndDisposal:true});
}
console.log(JSON.stringify({status:'PASS',reports},null,2));global.fetch=originalFetch;

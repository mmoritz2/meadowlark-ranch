import './rider-legacy98-fixture.mjs?v=character-foundation99-20261021';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {register} from 'node:module';
import {createHash} from 'node:crypto';
const runtime=path.resolve(process.env.RIDER_RUNTIME_ROOT||fileURLToPath(new URL('../',import.meta.url))),root=pathToFileURL(runtime+'/');
const threeURL=new URL('assets/vendor/three/build/three.module.js',root).href,addons=new URL('assets/vendor/three/examples/jsm/',root).href;
register('data:text/javascript,'+encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return {url:${JSON.stringify(threeURL)},shortCircuit:true};if(s.startsWith('three/addons/'))return {url:${JSON.stringify(addons)}+s.slice(13),shortCircuit:true};return n(s,c);}`));
const T=await import(threeURL),{GLTFLoader}=await import(new URL('assets/vendor/three/examples/jsm/loaders/GLTFLoader.js',root)),{clone}=await import(new URL('assets/vendor/three/examples/jsm/utils/SkeletonUtils.js',root));
const {createRiderLibrary}=await import(new URL('assets/rider-model.js',root));
const neckModule=process.env.RIDER_NECK_MODULE_PATH?pathToFileURL(path.resolve(process.env.RIDER_NECK_MODULE_PATH)):new URL('assets/rider-neck-normals.mjs',root);
const {refineRiderNeckNormals}=await import(neckModule);
// CPU-only material IO replaces textures. Geometry, source assets, canonical
// skeleton, neck preparation and all original normal refinements stay production.
class FileLoader extends GLTFLoader{
 constructor(manager){super(manager);this.register(parser=>({name:'CPU_NECK_MATERIALS',loadMaterial(i){const m=new T.MeshStandardMaterial();m.name=parser.json.materials[i].name||'';return Promise.resolve(m);}}));}
 async loadAsync(url){const b=fs.readFileSync(new URL(url));return this.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');}
 load(url,done,_progress,fail){this.loadAsync(url).then(done,fail);}
}
const ambientFetch=globalThis.fetch;
globalThis.fetch=async url=>{const b=fs.readFileSync(new URL(url));return{ok:true,json:async()=>JSON.parse(b.toString()),arrayBuffer:async()=>b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength)};};
const RJ=Function('return '+fs.readFileSync(new URL('ranch3d.html',root),'utf8').match(/const RJ=(\{[\s\S]*?\n\});/)[1])();
const lib=createRiderLibrary({THREE:T,GLTFLoader:FileLoader,clone,RJ}),kits={m:await lib.kit('m'),f:await lib.kit('f')};globalThis.fetch=ambientFetch;
const bytes=a=>Buffer.from(a.buffer,a.byteOffset,a.byteLength),digest=a=>createHash('sha256').update(bytes(a)).digest('hex'),degrees=(a,b)=>a.angleTo(b)*180/Math.PI;
function rigFor(kit){const face=new T.Mesh(kit.headAsset.mesh.geometry,new T.MeshPhysicalMaterial());return{face,kit,disposed:false,disposals:0,dispose(){this.disposed=true;this.disposals++;this.face.material.dispose();}};}
function metrics(kit,geometry){
 const source=kit.headAsset.mesh.geometry,p=source.attributes.position,local=Array.from({length:p.count},(_,i)=>new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(kit.headAsset.inverse)),fan=local.map(()=>new T.Vector3()),toLocal=new T.Matrix3().getNormalMatrix(kit.headAsset.inverse),chart=new Set(source.userData.neck16LiveUpper.chartIDs),edges=new Map();
 for(let f=0;f<source.index.count;f+=3){const ids=[0,1,2].map(k=>source.index.getX(f+k)),cross=local[ids[1]].clone().sub(local[ids[0]]).cross(local[ids[2]].clone().sub(local[ids[0]]));for(const i of ids)fan[i].add(cross);for(let k=0;k<3;k++){const a=ids[k],b=ids[(k+1)%3],key=a<b?a+':'+b:b+':'+a;edges.set(key,[a,b]);}}
 const normals=Array.from({length:p.count},(_,i)=>new T.Vector3().fromBufferAttribute(geometry.attributes.normal,i).applyMatrix3(toLocal).normalize());
 const angles=[];let energy=0;
 for(const[a,b]of edges.values()){if(!chart.has(a)||!chart.has(b))continue;const angle=degrees(normals[a],normals[b]),actual=degrees(fan[a],fan[b]);angles.push(angle);energy+=Math.max(0,angle-actual-5)**2;}
 angles.sort((a,b)=>a-b);return{excessFanEnergy:energy,maxEdgeDeg:angles.at(-1),p95EdgeDeg:angles[Math.floor(angles.length*.95)],edgeCount:angles.length};
}
for(const sex of ['m','f'])test(sex+' actual neck normals reduce isolated strips while all source fields and boundary normals stay exact',()=>{
 const kit=kits[sex],source=kit.headAsset.mesh.geometry,attributeRefs={...source.attributes},before=Object.fromEntries(Object.entries(source.attributes).map(([name,a])=>[name,digest(a.array)])),sourceIndex=source.index,indexHash=digest(source.index.array),rig=rigFor(kit),material=rig.face.material;
 const collarHash=digest(kit.connectedWardrobe.shirtGeometry.attributes.position.array);
 refineRiderNeckNormals(T,rig);const owned=rig.face.geometry;assert.notEqual(owned,source);assert.equal(rig.face.material,material);assert.deepEqual(Object.keys(owned.attributes),Object.keys(source.attributes));
 for(const[name,a]of Object.entries(source.attributes)){assert.equal(a,attributeRefs[name]);assert.equal(digest(a.array),before[name],'Shared source remains untouched '+name);if(name!=='normal')assert.equal(digest(owned.attributes[name].array),before[name],'Exact cloned source field '+name);}
 assert.equal(source.index,sourceIndex);assert.equal(digest(source.index.array),indexHash);assert.equal(digest(owned.index.array),indexHash);assert.equal(digest(kit.connectedWardrobe.shirtGeometry.attributes.position.array),collarHash,'Collar construction unchanged');
 const interior=new Set(source.userData.neck16LiveUpper.chartIDs);let changed=0;
 for(let i=0;i<source.attributes.normal.count;i++){
  const old=new T.Vector3().fromBufferAttribute(source.attributes.normal,i),now=new T.Vector3().fromBufferAttribute(owned.attributes.normal,i);assert(now.toArray().every(Number.isFinite));if(interior.has(i))assert.ok(Math.abs(now.length()-1)<2e-6);
  if(!interior.has(i))assert.deepEqual(now.toArray(),old.toArray(),'Face, upper cut and BODY seam normals stay bit exact');
  if(old.distanceTo(now)>1e-7){assert(interior.has(i));changed++;assert.ok(degrees(old,now)<=15.0001,'Bounded normal cone');}
 }
 assert(changed>source.userData.neck16LiveUpper.chartIDs.length*.75);
 const beforeMetrics=metrics(kit,source),afterMetrics=metrics(kit,owned);
 assert.ok(afterMetrics.excessFanEnergy<beforeMetrics.excessFanEnergy*.75,'Isolated discontinuity against actual face fans improves');
 assert.ok(afterMetrics.maxEdgeDeg<beforeMetrics.maxEdgeDeg*.90,'Worst interior normal step improves');
 assert.ok(afterMetrics.p95EdgeDeg<beforeMetrics.p95EdgeDeg,'Broad interior normal variation improves');
 assert.equal(rig.neckNormals.evidence.positionsUnchanged,true);console.log(JSON.stringify({sex,before:beforeMetrics,after:afterMetrics,evidence:rig.neckNormals.evidence}));rig.dispose();
});
test('shared CPU preparation creates unique owned geometry without consuming the ambient random stream',()=>{
 const kit=kits.m,source=kit.headAsset.mesh.geometry,a=rigFor(kit),b=rigFor(kit),ambient=Math.random;let randomCalls=0;const observer=()=>{randomCalls++;return .37;};Math.random=observer;
 try{refineRiderNeckNormals(T,a);refineRiderNeckNormals(T,b);assert.equal(Math.random,observer);assert.equal(randomCalls,0);assert.equal(a.neckNormals.evidence,b.neckNormals.evidence,'Cached surface preparation reused');assert.notEqual(a.face.geometry,b.face.geometry);assert.notEqual(a.face.geometry.uuid,b.face.geometry.uuid);assert.notEqual(a.face.geometry.uuid,source.uuid);assert.notEqual(a.face.geometry.attributes.normal.array,b.face.geometry.attributes.normal.array);const own=a.face.geometry;refineRiderNeckNormals(T,a);assert.equal(a.face.geometry,own,'Idempotent on a finished rig');assert.equal(randomCalls,0);}finally{Math.random=ambient;}
 const ga=a.face.geometry,gb=b.face.geometry;let sourceDisposals=0,ownDisposals=0;const observeSource=()=>sourceDisposals++;source.addEventListener('dispose',observeSource);ga.addEventListener('dispose',()=>ownDisposals++);
 try{a.dispose();a.dispose();assert.equal(a.disposals,1);assert.equal(ownDisposals,1);assert.equal(sourceDisposals,0);assert.equal(a.face.geometry,source);assert.equal(b.face.geometry,gb);assert.notEqual(gb,ga);b.dispose();assert.equal(sourceDisposals,0);}finally{source.removeEventListener('dispose',observeSource);}
});
test('failed geometry cloning restores ambient randomness and leaves the shared mesh available',()=>{
 const source=kits.f.headAsset.mesh.geometry,rig=rigFor(kits.f),clone=source.clone,ambient=Math.random;let calls=0;const observer=()=>{calls++;return .23;};Math.random=observer;source.clone=function(){assert.notEqual(Math.random,observer);throw Error('intentional clone failure');};
 try{assert.throws(()=>refineRiderNeckNormals(T,rig),/intentional clone failure/);assert.equal(Math.random,observer);assert.equal(calls,0);assert.equal(rig.face.geometry,source);assert.equal(rig.neckNormals,undefined);}finally{source.clone=clone;Math.random=ambient;rig.dispose();}
});
test('rigs without a connected loft stay untouched and invalid source boundaries fail before replacement',()=>{
 const plain={face:{geometry:new T.BufferGeometry()}};assert.equal(refineRiderNeckNormals(T,plain),plain);assert.equal(plain.neckNormals,undefined);
 const source=kits.f.headAsset.mesh.geometry.clone();source.userData.neckBoundary=source.userData.neckBoundary.slice(1);const rig=rigFor(kits.f);rig.face.geometry=source;assert.throws(()=>refineRiderNeckNormals(T,rig),/topology changed/);assert.equal(rig.face.geometry,source);assert.equal(rig.neckNormals,undefined);rig.dispose();source.dispose();
});

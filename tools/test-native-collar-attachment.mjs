/* Real-source sparse collar decoding: transactional failures, shared-geometry
 * isolation, protected attributes and actual Three skin evaluation. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from '../assets/vendor/three/build/three.module.js';
import {loadNativeHorseFixture} from './test-native-horse-actions.mjs';
import {applyNativeCollarAttachment} from '../assets/native-collar-attachment.js';

const source='review/native-trot-reference-kit/white/model.glb',bytes=fs.readFileSync(source);
const sourceSha256=createHash('sha256').update(bytes).digest('hex');
const len=bytes.readUInt32LE(12),doc=JSON.parse(bytes.subarray(20,20+len)),bin=bytes.subarray(28+len);
const sizes={SCALAR:1,VEC2:2,VEC3:3,VEC4:4},types={5126:Float32Array,5123:Uint16Array,5125:Uint32Array,5121:Uint8Array};
function access(i){const a=doc.accessors[i],v=doc.bufferViews[a.bufferView],C=types[a.componentType],size=sizes[a.type],out=new C(a.count*size);for(let n=0;n<a.count;n++){const off=(v.byteOffset||0)+(a.byteOffset||0)+n*(v.byteStride||size*C.BYTES_PER_ELEMENT);out.set(new C(bin.buffer.slice(bin.byteOffset+off,bin.byteOffset+off+size*C.BYTES_PER_ELEMENT)),n*size);}return out;}
const {root}=loadNativeHorseFixture(source),meshes=[];
root.traverse(m=>{if(!m.isSkinnedMesh)return;meshes.push(m);m.normalizeSkinWeights();const node=doc.nodes.find(n=>n.name===m.name),p=doc.meshes[node.mesh].primitives[0];for(const [key,name]of [['NORMAL','normal'],['TEXCOORD_0','uv']]){const a=doc.accessors[p.attributes[key]];m.geometry.setAttribute(name,new THREE.BufferAttribute(access(p.attributes[key]),sizes[a.type],!!a.normalized));}m.geometry.setIndex(new THREE.BufferAttribute(access(p.indices),1));});
const mesh=meshes.find(m=>m.geometry.attributes.position.count===13895),original=mesh.geometry,peer=mesh.clone();
original.userData={source:{label:'immutable test source'}};
const profile={nativeKind:'horse',nativeRoster:true,nativeVariant:{id:'shire'}};
const hash=g=>{const h=createHash('sha256');for(const [key,a]of Object.entries(g.attributes)){h.update(key);h.update(Buffer.from(a.array.buffer,a.array.byteOffset,a.array.byteLength));}h.update(Buffer.from(g.index.array.buffer));h.update(JSON.stringify(g.userData));return h.digest('hex');};
const originalHash=hash(original),skeleton=mesh.skeleton,binds=JSON.stringify(skeleton.boneInverses.map(m=>m.elements)),rootState=JSON.stringify(skeleton.bones.map(b=>[b.position.toArray(),b.quaternion.toArray(),b.scale.toArray()]));
function fixture(){
 const ids=[479,4106],record={version:1,meshIndex:3,sourceSha256,vertexCount:ids.length},parts=[];let offset=728256;
 for(const [name,C,size,values]of [['vertexIds',Uint16Array,1,ids],...['position','normal','skinIndex','skinWeight'].map(name=>{const a=original.attributes[name],values=[];for(const id of ids)for(let k=0;k<a.itemSize;k++)values.push(a.array[id*a.itemSize+k]);if(name==='position')values[0]+=.001; if(name==='normal')for(let i=0;i<values.length;i+=3){const n=Math.hypot(...values.slice(i,i+3));for(let k=0;k<3;k++)values[i+k]/=n;}return [name,name==='skinIndex'?Uint16Array:Float32Array,a.itemSize,values];})]){
  offset=Math.ceil(offset/4)*4;const data=new C(values);record[name]={byteOffset:offset,count:data.length,itemSize:size,componentType:C===Uint16Array?'uint16':'float32'};parts.push([offset,data]);offset+=data.byteLength;
 }
 const binary=new ArrayBuffer(offset);for(const [off,data]of parts)new Uint8Array(binary,off,data.byteLength).set(new Uint8Array(data.buffer));return {record,binary};
}
function run(f,overrides={}){return applyNativeCollarAttachment({THREE,mesh,profile,...f,...overrides});}
assert.equal(run({record:null,binary:null}),null);assert.equal(mesh.geometry,original);
let rejected=0;
function reject(label,mutate){const f=fixture(),overrides={};mutate(f,overrides);assert.throws(()=>run(f,overrides),/Invalid native breastcollar attachment/,label);assert.equal(mesh.geometry,original,label+' pointer');assert.equal(hash(original),originalHash,label+' no partial mutation');rejected++;}
const floats=(f,name)=>new Float32Array(f.binary,f.record[name].byteOffset,f.record[name].count),ints=(f,name)=>new Uint16Array(f.binary,f.record[name].byteOffset,f.record[name].count);
for(const [key,value]of [['version',2],['meshIndex',4],['sourceSha256','wrong'],['vertexCount',0],['vertexCount',2405],['vertexCount',1.5]])reject(key+value,f=>f.record[key]=value);
reject('wrong profile',(f,o)=>o.profile={...profile,nativeVariant:{id:'arabian'}});
reject('wrong topology',(_f,o)=>o.mesh={isSkinnedMesh:true,geometry:original,skeleton:{bones:[]}});
reject('wrong buffer',f=>f.binary=new Uint8Array(f.binary));
for(const [key,value]of [['byteOffset',0],['byteOffset',728257],['byteOffset',Number.MAX_SAFE_INTEGER],['count',5],['itemSize',4],['componentType','int16']])reject('descriptor '+key,f=>f.record.position[key]=value);
reject('overlap',f=>f.record.normal.byteOffset=f.record.position.byteOffset);
reject('duplicate id',f=>ints(f,'vertexIds')[1]=ints(f,'vertexIds')[0]);
reject('protected tread id',f=>ints(f,'vertexIds')[0]=3000);
reject('nonfinite position',f=>floats(f,'position')[0]=NaN);
reject('nonfinite normal',f=>floats(f,'normal')[0]=Infinity);
reject('zero normal',f=>floats(f,'normal').fill(0,0,3));
reject('foreign joint',f=>ints(f,'skinIndex')[0]=677);
reject('negative weight',f=>floats(f,'skinWeight')[0]=-.01);
reject('infinite weight',f=>floats(f,'skinWeight')[0]=Infinity);
reject('weight sum',f=>floats(f,'skinWeight').fill(.1,0,4));
const f=fixture(),beforeWorld=mesh.getVertexPosition(479,new THREE.Vector3()).applyMatrix4(mesh.matrixWorld);
const result=run(f);assert.equal(result.vertices,2);assert.notEqual(mesh.geometry,original);assert.equal(peer.geometry,original);assert.equal(hash(peer.geometry),originalHash);
assert.notEqual(mesh.geometry.userData,original.userData);mesh.geometry.userData.source.label='private metadata';assert.equal(original.userData.source.label,'immutable test source');
for(const [name,old]of Object.entries(original.attributes)){
 const current=mesh.geometry.attributes[name];assert.notEqual(current.array,old.array);assert.equal(current.normalized,old.normalized);assert.equal(current.itemSize,old.itemSize);
 for(let i=0;i<old.count;i++)if(![479,4106].includes(i)||!['position','normal','skinIndex','skinWeight'].includes(name))for(let k=0;k<old.itemSize;k++)assert.equal(current.array[i*old.itemSize+k],old.array[i*old.itemSize+k],name+' protected '+i);
}
assert.deepEqual(mesh.geometry.index.array,original.index.array);assert.equal(mesh.skeleton,skeleton);assert.equal(JSON.stringify(skeleton.boneInverses.map(m=>m.elements)),binds);assert.equal(JSON.stringify(skeleton.bones.map(b=>[b.position.toArray(),b.quaternion.toArray(),b.scale.toArray()])),rootState);
const afterWorld=mesh.getVertexPosition(479,new THREE.Vector3()).applyMatrix4(mesh.matrixWorld);assert(afterWorld.toArray().every(Number.isFinite));assert(afterWorld.distanceTo(beforeWorld)>.00001,'New position reaches actual skinned vertex');
// The source profile remains untouched, and repeating on an independent peer
// yields the identical private attributes without changing its cache geometry.
applyNativeCollarAttachment({THREE,mesh:peer,profile,...f});for(const name of ['position','normal','skinIndex','skinWeight'])assert.deepEqual(peer.geometry.attributes[name].array,mesh.geometry.attributes[name].array);
assert.equal(hash(original),originalHash);assert.equal(createHash('sha256').update(fs.readFileSync(source)).digest('hex'),sourceSha256);
console.log(JSON.stringify({sourceSha256,rejectedMalformedRecords:rejected,sourceVertices:original.attributes.position.count,privateVertices:2,protectedAttributes:'byte-exact',sourceSkeleton:'unchanged',sharedGeometry:'isolated',actualSkinPositionDeltaM:afterWorld.distanceTo(beforeWorld)},null,2));

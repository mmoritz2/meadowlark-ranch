import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from '../assets/vendor/three/build/three.module.js';
import {createNativeTackModes} from '../assets/native-rider.js';

// Use the real connected source topology, rather than a fixture that repeats
// the implementation's component list. No textures, browser or network needed.
const file=fs.readFileSync(new URL('../review/native-horse-kit/model.glb',import.meta.url));
const jsonLength=file.readUInt32LE(12),doc=JSON.parse(file.subarray(20,20+jsonLength).toString());
const binary=file.subarray(28+jsonLength);
function accessor(id){
 const a=doc.accessors[id],view=doc.bufferViews[a.bufferView],components={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type];
 const [ArrayType,read,bytes]={5123:[Uint16Array,'readUInt16LE',2],5125:[Uint32Array,'readUInt32LE',4],5126:[Float32Array,'readFloatLE',4]}[a.componentType];
 const out=new ArrayType(a.count*components),start=(view.byteOffset||0)+(a.byteOffset||0),stride=view.byteStride||components*bytes;
 for(let i=0;i<a.count;i++)for(let c=0;c<components;c++)out[i*components+c]=binary[read](start+i*stride+c*bytes);
 return out;
}
function sourceGeometry(count){
 const primitive=doc.meshes.flatMap(m=>m.primitives).find(p=>doc.accessors[p.attributes.POSITION].count===count);
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(accessor(primitive.attributes.POSITION),3));geo.setIndex(new THREE.BufferAttribute(accessor(primitive.indices),1));return geo;
}
const original=sourceGeometry(13895),saddleSource=sourceGeometry(5092),material=new THREE.MeshStandardMaterial();
const hash=geometry=>createHash('sha256').update(Buffer.from(geometry.index.array.buffer)).update(Buffer.from(geometry.attributes.position.array.buffer)).digest('hex');
function actor(){
 const scene=new THREE.Group(),mount=new THREE.Group(),tack=new THREE.SkinnedMesh(original,material),saddle=new THREE.SkinnedMesh(saddleSource,material);scene.add(tack,saddle);mount.add(scene);
 return {scene,mount,tack,saddle,rig:{scene,profile:{nativeKind:'horse'}}};
}
test('native bareback keeps the real headstall and bit while removing saddle, breastplate and stirrups',()=>{
 const a=actor(),control=createNativeTackModes({THREE,rig:a.rig,mount:a.mount});
 assert.equal(control.inspect().triangles,17194);assert.equal(a.saddle.visible,true);
 control.setLiveReins(true);assert.equal(control.inspect().triangles,15554);
 control.setMode('bareback');const bare=control.inspect();
 assert.equal(bare.triangles,5090);assert.equal(bare.bridleVisible,true);assert.equal(bare.saddleVisible,false);assert.equal(bare.sourceReinsVisible,false);
 // Original bit-ring triangles must survive, while both measured iron treads
 // and saddle body vertices are absent from the visible bareback equipment.
 const shown=new Set(a.tack.geometry.index.array);
 assert.ok(Array.from({length:231},(_,i)=>7894+i).every(i=>shown.has(i)));
 assert.ok(Array.from({length:231},(_,i)=>6954+i).every(i=>shown.has(i)));
 assert.ok(Array.from({length:130},(_,i)=>2716+i).every(i=>!shown.has(i)));
 control.setLiveReins(false);assert.equal(control.inspect().triangles,6730);assert.equal(control.inspect().sourceReinsVisible,true);
 control.setMode('wild');assert.equal(a.tack.visible,false);assert.equal(a.saddle.visible,false);assert.equal(control.inspect().reinsVisible,false);
 control.dispose();
});
test('mode swaps and disposal preserve shared source geometry and independent actors',()=>{
 const before=hash(original),a=actor(),b=actor(),one=createNativeTackModes({THREE,rig:a.rig,mount:a.mount}),two=createNativeTackModes({THREE,rig:b.rig,mount:b.mount});
 let disposed=0,sourceDisposed=0;a.tack.geometry.addEventListener('dispose',()=>disposed++);original.addEventListener('dispose',()=>sourceDisposed++);
 assert.notEqual(a.tack.geometry,b.tack.geometry);assert.notEqual(a.tack.geometry.attributes.position.array,original.attributes.position.array);
 two.setMode('bareback');for(let i=0;i<25;i++)for(const mode of ['wild','bareback','saddled'])assert.equal(one.setMode(mode),true);
 assert.equal(two.inspect().mode,'bareback');assert.equal(two.inspect().saddleVisible,false);assert.equal(one.inspect().triangles,17194);assert.equal(hash(original),before);
 assert.equal(one.setMode('unknown'),false);assert.equal(one.inspect().mode,'saddled');
 one.dispose();one.dispose();assert.equal(disposed,1);assert.equal(sourceDisposed,0);assert.equal(a.tack.geometry,original);assert.equal(a.tack.visible,true);assert.equal(a.saddle.visible,true);
 assert.equal(two.inspect().mode,'bareback');two.dispose();assert.equal(hash(original),before);assert.equal(sourceDisposed,0);
});

import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as T from '../assets/vendor/three/build/three.module.js';

const root=new URL('../',import.meta.url),data=fs.readFileSync(new URL('assets/models/rider/canino-f.glb',root));
assert.equal(data.readUInt32LE(0),0x46546c67);assert.equal(data.readUInt32LE(4),2);assert.equal(data.readUInt32LE(8),data.length);
const size=data.readUInt32LE(12),g=JSON.parse(data.subarray(20,20+size)),bin=data.subarray(28+size);
function accessor(id){const a=g.accessors[id],v=g.bufferViews[a.bufferView],start=(v.byteOffset||0)+(a.byteOffset||0),n={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16}[a.type],C={5123:Uint16Array,5125:Uint32Array,5126:Float32Array}[a.componentType];assert(C);return new C(bin.buffer,bin.byteOffset+start,a.count*n);}
assert.match(g.asset.copyright,/Canino3d Studio/);assert.equal(g.asset.extras.license,'https://creativecommons.org/licenses/by/4.0/');
assert.equal(g.asset.extras.sourceSHA256,'50f27128499cb90fb1ebc309349ffd69bade0133d0b39009d3ad75b775ef5e1c');
for(const extension of ['KHR_materials_specular','KHR_materials_clearcoat'])assert(g.extensionsUsed.includes(extension));
const skin=g.skins[0],head=skin.joints.findIndex(id=>g.nodes[id].name==='Head'),inverse=accessor(skin.inverseBindMatrices);
assert.equal(skin.joints.length,65);assert(head>=0);
for(let i=0;i<skin.joints.length;i++){const m=new T.Matrix4().fromArray(g.nodes[skin.joints[i]].matrix).multiply(new T.Matrix4().fromArray(inverse,i*16));for(let k=0;k<16;k++)assert(Math.abs(m.elements[k]-(k%5===0?1:0))<1e-6,'Invalid inverse bind or unit conversion');}
let vertices=0,triangles=0;
for(const mesh of g.meshes)for(const p of mesh.primitives){
 const a=p.attributes,positions=accessor(a.POSITION),normals=accessor(a.NORMAL),joints=accessor(a.JOINTS_0),weights=accessor(a.WEIGHTS_0),uv=accessor(a.TEXCOORD_0),indices=accessor(p.indices),name=g.materials[p.material].name;
 assert(positions.every(Number.isFinite)&&normals.every(Number.isFinite)&&uv.every(Number.isFinite));
 for(let i=0;i<positions.length/3;i++){let sum=0;for(let k=0;k<4;k++){const n=i*4+k;assert(joints[n]<65);assert(weights[n]>=0&&Number.isFinite(weights[n]));sum+=weights[n];if(['lambert10','Std_Eye_L','Std_Eye_R','Std_Eyelash'].includes(name)&&weights[n]>0)assert.equal(joints[n],head,'Detached hair/face part');}assert(Math.abs(sum-1)<1e-5);const n=Math.hypot(...normals.subarray(i*3,i*3+3));assert(Math.abs(n-1)<1e-4,'Authored normal lost normalization');}
 assert(indices.every(i=>i<positions.length/3));vertices+=positions.length/3;triangles+=indices.length/3;
}
assert.equal(g.meshes.length,20);assert.equal(vertices,48996);assert.equal(triangles,47366);
assert(!g.meshes.some(m=>/Skirt|Panties|Boot_/i.test(m.name)));
const eyes=g.materials.find(m=>m.name==='Std_Eye_R');assert.equal(eyes.pbrMetallicRoughness.baseColorFactor[3],1);assert.equal(eyes.alphaMode,'OPAQUE');
const lashes=g.materials.find(m=>m.name==='Std_Eyelash');assert.equal(lashes.alphaMode,'MASK');
console.log(`PASS: Canino provenance, material repairs, ${vertices} vertices, ${triangles} triangles, 65 inverse binds and attached hair/eyes/lashes.`);

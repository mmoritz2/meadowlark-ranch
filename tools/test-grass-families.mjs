import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as THREE from '../assets/vendor/three/build/three.module.js';
import {createGrassFamilyGeometry,GRASS_FAMILIES} from '../assets/grass-families.mjs';
import {createGrassTuftGeometry} from '../assets/meadow-cover.js';
const evidence=[];
const faces=(g,cb)=>{const p=g.attributes.position;for(let i=0;i<g.index.count;i+=3){const ids=Array.from(g.index.array.subarray(i,i+3));cb(ids,ids.map(j=>new THREE.Vector3().fromBufferAttribute(p,j)));}};
for(let family=0;family<3;family++)test(`${GRASS_FAMILIES[family].name}: finite rooted geometry, valid normal/UV contract and budget`,()=>{
 const g=createGrassFamilyGeometry(THREE,family),p=g.attributes.position,n=g.attributes.normal,c=g.attributes.color,uv=g.attributes.uv;
 assert.equal(g.index.count/3,70);assert.equal(n.count,p.count);assert.equal(c.count,p.count);assert.equal(uv.count,p.count);
 assert(Object.values(g.attributes).every(a=>a.array instanceof Float32Array));
 for(const a of Object.values(g.attributes))assert(Array.from(a.array).every(Number.isFinite));
 assert(Array.from(uv.array).every(v=>v>=0&&v<=1));assert(Array.from(c.array).every(v=>v>0&&v<=1.05));
 assert.equal(g.boundingBox.min.y,0);assert(g.boundingBox.max.y<=.95);assert(g.boundingBox.min.x>-.36&&g.boundingBox.max.x<.36&&g.boundingBox.min.z>-.36&&g.boundingBox.max.z<.36);
 for(let j=0;j<n.count;j++)assert(Math.abs(new THREE.Vector3().fromBufferAttribute(n,j).length()-1)<1e-6);
 let minArea=Infinity,minDot=Infinity,area=0;
 faces(g,(ids,points)=>{assert(ids.every(i=>Number.isInteger(i)&&i>=0&&i<p.count));const[a,b,c]=points,f=new THREE.Vector3().crossVectors(b.sub(a),c.sub(a)),twice=f.length();assert(twice>1e-8);area+=twice*.5;minArea=Math.min(minArea,twice*.5);f.normalize();for(const i of ids)minDot=Math.min(minDot,f.dot(new THREE.Vector3().fromBufferAttribute(n,i)));});
 assert(minDot>0,'Area-weighted vertex normals never reverse the connected surface');
 const before=n.array.slice();g.computeVertexNormals();assert.deepEqual(n.array,before);
 evidence.push({...g.userData.grassFamily,area,minArea,minFaceNormalDot:minDot,geometryBytes:Object.values(g.attributes).reduce((s,a)=>s+a.array.byteLength,0)+g.index.array.byteLength});g.dispose();
});
test('families have different physical silhouettes and repeat deterministically',()=>{
 const geometries=GRASS_FAMILIES.map((_,i)=>createGrassFamilyGeometry(THREE,i));
 try{const hashes=geometries.map(g=>crypto.createHash('sha256').update(Buffer.from(g.attributes.position.array.buffer)).digest('hex'));assert.equal(new Set(hashes).size,3);
  assert(geometries[0].boundingBox.max.y>geometries[1].boundingBox.max.y*2);assert(geometries[2].boundingBox.max.y>geometries[0].boundingBox.max.y*1.3);
  for(let i=0;i<3;i++){const again=createGrassFamilyGeometry(THREE,i);for(const key of Object.keys(again.attributes))assert.deepEqual(again.attributes[key].array,geometries[i].attributes[key].array);assert.deepEqual(again.index.array,geometries[i].index.array);again.dispose();}
  assert.throws(()=>createGrassFamilyGeometry(THREE,-1));assert.throws(()=>createGrassFamilyGeometry(THREE,3));assert.throws(()=>createGrassFamilyGeometry(THREE,.5));
 }finally{geometries.forEach(g=>g.dispose());}
});
test('every leaf grows from paired grounded roots to a narrower falling point',()=>{
 for(let family=0;family<3;family++){const g=createGrassFamilyGeometry(THREE,family),p=g.attributes.position,uv=g.attributes.uv;
  for(let leaf=0;leaf<GRASS_FAMILIES[family].leaves;leaf++){const start=leaf*9,tip=start+8;assert.equal(p.getY(start),0);assert.equal(p.getY(start+1),0);assert.equal(uv.getY(start),0);assert.equal(uv.getY(tip),1);assert.equal(uv.getX(tip),.5);assert(p.getY(start+6)>p.getY(tip),'Final bowed leaf segment falls');assert(p.getY(tip)>0);const widths=[0,2,4,6].map(j=>new THREE.Vector3().fromBufferAttribute(p,start+j).distanceTo(new THREE.Vector3().fromBufferAttribute(p,start+j+1)));assert(widths[3]<widths[1]);}
  g.dispose();
 }
});
test('original geometry adds no texture/material allocation or import-time resources',()=>{
 const source=fs.readFileSync(new URL('../assets/grass-families.mjs',import.meta.url),'utf8');assert(!source.includes('Math.random'));assert(!source.includes('new T.Texture'));assert(!source.includes('Material('));assert(!source.includes('fetch('));
});

test('leafy sward keeps its mass low and roots darker than the blade shoulders',()=>{
 for(let family=0;family<3;family++){const g=createGrassFamilyGeometry(THREE,family),p=g.attributes.position,c=g.attributes.color;
  for(let leaf=0;leaf<GRASS_FAMILIES[family].leaves;leaf++){const k=leaf*9;assert(c.getY(k)<.30);assert(c.getY(k+4)>c.getY(k)*2);const width=new THREE.Vector3().fromBufferAttribute(p,k+2).distanceTo(new THREE.Vector3().fromBufferAttribute(p,k+3));assert(width>.018&&width<.08);}
  g.dispose();
 }
});

test('near and middle leaves retain their budgets and a mix of bowed and emerging forms',()=>{
 for(const [profile,bladeCount,segments] of [['near-folded-v1',8,3],['middle-natural-v1',4,2],['middle-natural-v1',6,2],['middle-natural-v1',8,2]]){
  const g=createGrassTuftGeometry(THREE,{profile,bladeCount,segments}),p=g.attributes.position;
  assert.equal(g.index.count/3,bladeCount*(segments===3?5:3));let bowed=0,emerging=0;
  const stride=segments===3?7:5,shoulder=2,tip=stride-1;
  for(let leaf=0;leaf<bladeCount;leaf++){const i=leaf*stride;assert.equal(p.getY(i),0);assert.equal(p.getY(i+1),0);if(p.getY(i+tip)<p.getY(i+shoulder))bowed++;else emerging++;}
  assert(bowed>=bladeCount/2,'Low leaves fall after the modeled shoulder');assert(emerging>0,'Some unequal narrow leaves still emerge above the low clump');
  for(const a of Object.values(g.attributes))assert(Array.from(a.array).every(Number.isFinite));
  faces(g,(_,points)=>{const[a,b,c]=points;assert(new THREE.Vector3().crossVectors(b.sub(a),c.sub(a)).length()>1e-8);});
  g.dispose();
 }
});

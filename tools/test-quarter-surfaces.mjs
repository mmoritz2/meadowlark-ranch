import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from '../assets/vendor/three/build/three.module.js';
import {quarterSurfaceRole,applyQuarterSurface,setQuarterPrimitiveUV} from '../assets/quarter-surfaces.mjs';
const makeSource=name=>{const m=new T.MeshStandardMaterial({name});m.map=new T.Texture();m.normalMap=new T.Texture();m.roughnessMap=new T.Texture();return m;};
const materials={oak:makeSource('Builder | oiled oak'),aged:makeSource('Builder | weathered timber'),stone:makeSource('Builder | rough limestone')},architecture={roofMaterial:makeSource('Ranch | aged cedar shingles')};

test('regional surface roles cover observed construction while excluding translucent water, ice, snow, leaves and ground',()=>{
 for(const color of ['#a8834e','#c6ab7c','#7a5a3a','#66543a','#c9bda0','#9c8a66'])assert.equal(quarterSurfaceRole(color),'timber');
 for(const color of ['#968d80','#a89d8e','#7a7871'])assert.equal(quarterSurfaceRole(color),'stone');
 assert.equal(quarterSurfaceRole('#8a7a5c'),'roof');assert.equal(quarterSurfaceRole('#8e9296'),'metal');
 for(const color of ['#ffffff','#eef4f8','#e4edf2','#2f4a38','#d2792a','#41564a','#3f6f78','#cfae7c'])assert.equal(quarterSurfaceRole(color),null);
 assert.equal(quarterSurfaceRole('#7a5a3a',{transparent:true}),null);assert.equal(quarterSurfaceRole('#7a5a3a',{opacity:.5}),null);
});

test('finish preserves material identity and shares resident photographs without allocating resources or consuming placement RNG',()=>{
 for(const color of ['#7a5a3a','#a8834e','#968d80','#8a7a5c','#8e9296']){
  const m=new T.MeshStandardMaterial({color,roughness:.92}),uuid=m.uuid,normalScale=m.normalScale;
  const old=Math.random;let draws=0;Math.random=()=>{draws++;throw Error('New resource/random allocation');};
  try{assert(applyQuarterSurface(m,color,null,materials,architecture,T));}finally{Math.random=old;}
  assert.equal(draws,0);assert.equal(m.uuid,uuid);assert.equal(m.normalScale,normalScale);assert.equal(m.transparent,false);assert.equal(m.opacity,1);assert.equal(m.depthWrite,true);
  const role=quarterSurfaceRole(color),source=role==='timber'?(color==='#a8834e'?materials.oak:materials.aged):role==='stone'?materials.stone:architecture.roofMaterial;
  if(role!=='metal'){assert.equal(m.map,source.map);assert.equal(m.normalMap,source.normalMap);assert.equal(m.roughnessMap,source.roughnessMap);assert.equal(m.aoMap,null);}
  m.dispose();
 }
});

test('metric UV writing changes only the existing UV bytes, preserving primitive geometry, topology and allocation',()=>{
 for(const[geometry,scale,role,source]of [[new T.BoxGeometry(1,1,1),new T.Vector3(7.6,3.6,.12),'timber','Builder | oiled oak'],[new T.BoxGeometry(1,1,1),new T.Vector3(4.2,.4,4.2),'stone','Builder | rough limestone'],[new T.CylinderGeometry(1,1,1,9),new T.Vector3(.17,19,.17),'timber','Builder | weathered timber']]){
  const positions=geometry.attributes.position.array.slice(),normals=geometry.attributes.normal.array.slice(),indices=geometry.index.array.slice(),uv=geometry.attributes.uv,oldUV=uv.array.slice(),uuid=geometry.uuid,bytes=Object.values(geometry.attributes).reduce((sum,a)=>sum+a.array.byteLength,0)+indices.byteLength;
  const old=Math.random;Math.random=()=>{throw Error('UV writer allocated a resource');};
  try{assert(setQuarterPrimitiveUV(geometry,scale,new T.Vector3(3,4,-2),{role,source,metres:role==='stone'?1.4:1.8}));}finally{Math.random=old;}
  assert.equal(geometry.uuid,uuid);assert.equal(geometry.attributes.uv,uv);assert.deepEqual(geometry.attributes.position.array,positions);assert.deepEqual(geometry.attributes.normal.array,normals);assert.deepEqual(geometry.index.array,indices);assert.notDeepEqual(uv.array,oldUV);assert(Array.from(uv.array).every(Number.isFinite));
  assert.equal(Object.values(geometry.attributes).reduce((sum,a)=>sum+a.array.byteLength,0)+indices.byteLength,bytes);geometry.dispose();
 }
});

test('large masonry and timber use physical metres instead of stretching one box texture across the entire facade',()=>{
 const g=new T.BoxGeometry(1,1,1),scale=new T.Vector3(7.6,3.6,.12);
 setQuarterPrimitiveUV(g,scale,new T.Vector3(0,0,0),{role:'stone',source:'Builder | rough limestone',metres:1.4});
 const p=g.attributes.position,n=g.attributes.normal,u=g.attributes.uv,front=[];
 for(let i=0;i<p.count;i++)if(n.getZ(i)>.99)front.push([u.getX(i),u.getY(i)]);
 assert(Math.abs(Math.max(...front.map(v=>v[0]))-Math.min(...front.map(v=>v[0]))-7.6/1.4)<1e-6);
 assert(Math.abs(Math.max(...front.map(v=>v[1]))-Math.min(...front.map(v=>v[1]))-3.6/1.4)<1e-6);g.dispose();
});

test('unclassified and incomplete-source materials remain untouched without new resource or RNG calls',()=>{
 const m=new T.MeshStandardMaterial({color:'#ffffff'}),snapshot={color:m.color.toArray(),uuid:m.uuid,map:m.map,version:m.version};
 assert.equal(applyQuarterSurface(m,'#ffffff',null,materials,architecture,T),false);assert.deepEqual({color:m.color.toArray(),uuid:m.uuid,map:m.map,version:m.version},snapshot);
 const noMaps={...materials,aged:{}};assert.equal(applyQuarterSurface(m,'#7a5a3a',null,noMaps,architecture,T),false);assert.deepEqual(m.color.toArray(),snapshot.color);m.dispose();
 const source=fs.readFileSync(new URL('../assets/quarter-surfaces.mjs',import.meta.url),'utf8');assert(!/Math\.random|new\s+.*(?:Geometry|Material|Texture|Mesh)\(|fetch\(/.test(source));
});

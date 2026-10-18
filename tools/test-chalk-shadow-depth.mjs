import {normalizeChalkScourSource,loadPublishedChalkDown} from './chalk-scour-source-guard.cjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as T from '../assets/vendor/three/build/three.module.js';
import {createChalkDown} from '../assets/chalk-down.js';
import {createChalkDown as createBaseline} from './fixtures/chalk-shadow-519f/chalk-down.js';
const fixture=new URL('./fixtures/chalk-shadow-519f/',import.meta.url);
const source=readFileSync(new URL('../assets/chalk-down.js',import.meta.url),'utf8');
const baselineSource=readFileSync(new URL('chalk-down.js',fixture),'utf8');
const pinned=JSON.parse(readFileSync(new URL('receipt.json',fixture)));
const surface=JSON.parse(readFileSync(new URL('chalk-surface-source.json',fixture)));
const gridBytes=readFileSync(new URL('terrain-grid.f32',fixture)),grid=new Float32Array(gridBytes.buffer,gridBytes.byteOffset,gridBytes.byteLength/4);
assert.equal(grid.length,513**2);
const sha=value=>createHash('sha256').update(value).digest('hex');
function terrainH(x,z){const gx=(x+500)/(1000/512),gz=(z+500)/(1000/512),ix=Math.floor(gx),iz=Math.floor(gz),fx=gx-ix,fz=gz-iz,i=iz*513+ix,a=grid[i],b=grid[i+513],c=grid[i+514],d=grid[i+1];return fx+fz<=1?a+(d-a)*fx+(b-a)*fz:c+(b-c)*(1-fx)+(d-c)*(1-fz);}
const realSite={x:-68.98,z:213.41,len:112,depth:76,h:14,crest:.5};
function stream(seed=246813579){let state=seed>>>0;return()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};}
const bytes=a=>sha(Buffer.from(a.array.buffer,a.array.byteOffset,a.array.byteLength));
function snapshot(down,records){const nodes=[];down.root.updateMatrixWorld(true);down.root.traverse(o=>{const row={name:o.name,type:o.type,uuid:o.uuid,matrix:o.matrix.toArray(),world:o.matrixWorld.toArray(),cast:o.castShadow,receive:o.receiveShadow};if(o.isMesh){row.geometry={uuid:o.geometry.uuid,index:o.geometry.index?bytes(o.geometry.index):null,attributes:Object.fromEntries(Object.entries(o.geometry.attributes).map(([k,a])=>[k,{count:a.count,itemSize:a.itemSize,bytes:bytes(a)}]))};row.material={uuid:o.material.uuid,type:o.material.type,name:o.material.name,color:o.material.color.toArray(),roughness:o.material.roughness,side:o.material.side,shadowSide:o.material.shadowSide,maps:['map','normalMap','roughnessMap','bumpMap'].map(k=>o.material[k]?.uuid||null),cache:o.material.customProgramCacheKey()};}nodes.push(row);});
 const samples=[];for(let j=0;j<=20;j++)for(let i=0;i<=20;i++){const a=Math.atan2(down.site.x,down.site.z),u=(i/20-.5)*down.site.len,v=(j/20-.5)*down.site.depth,x=down.site.x+Math.cos(a)*u+Math.sin(a)*v,z=down.site.z-Math.sin(a)*u+Math.cos(a)*v;samples.push([x,z,down.heightAt(x,z),down.reliefAt(x,z),down.planningHeightAt(x,z),down.isChalk(x,z),down.planningIsChalk(x,z),down.contains(x,z)]);}
 return{nodes,samples,stats:down.stats,requests:records.requests};}
function construct(create,{fallback=false,flat=false,failDepth=false}={}){const prior=Math.random,rnd=stream(),records={geometries:[],standard:[],depth:[],textures:[],requests:[],meshes:[],groups:[]};let globalDraws=0;const gameRandom=()=>{globalDraws++;return rnd();};Math.random=gameRandom;
 const THREE={...T,BufferGeometry:class extends T.BufferGeometry{constructor(){super();records.geometries.push(this);}},MeshStandardMaterial:class extends T.MeshStandardMaterial{constructor(p){super(p);records.standard.push(this);}},MeshDepthMaterial:class extends T.MeshDepthMaterial{constructor(p){super(p);records.depth.push(this);if(failDepth)throw Error('fixture depth failure');}},TextureLoader:class{load(path){const t=new T.Texture();records.textures.push(t);records.requests.push(path);return t;}},Mesh:class extends T.Mesh{constructor(...args){super(...args);records.meshes.push(this);}},Group:class extends T.Group{constructor(){super();records.groups.push(this);}}};
 try{const mat=fallback?null:new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,color:'#ffffff'}),down=create({THREE,site:flat?{x:0,z:0,len:112,depth:76,h:14,crest:.5}:realSite,baseHeight:flat?()=>2:terrainH,groundMaterial:mat,groundColorAt:fallback?undefined:(x,z,c)=>c.setRGB(.5+.05*Math.sin(x*.03),.6+.03*Math.cos(z*.03),.4)});const result={down,records,mat,snapshot:snapshot(down,records),draws:globalDraws,future:Array.from({length:20},()=>gameRandom())};assert.equal(Math.random,gameRandom);return result;}finally{Math.random=prior;}}
const {createChalkDown:createPublished}=await loadPublishedChalkDown();
const publishedSource=normalizeChalkScourSource(source,'assets/chalk-down.js'),historicalAfter=construct(createPublished);
const before=construct(createBaseline),after=construct(createChalkDown);
function fnv(array){let h=2166136261;for(const b of new Uint8Array(array.buffer,array.byteOffset,array.byteLength)){h^=b;h=Math.imul(h,16777619);}return(h>>>0).toString(16).padStart(8,'0');}
const actualGround=after.down.root.getObjectByName('vista:chalkscarp');

test('QUALIFIED published d60 constructor recovers exact historical519f native fixture and depth-only source change',()=>{
 for(const[name,expected]of Object.entries(pinned.files))assert.equal(sha(readFileSync(new URL(name,fixture))),expected,name);
 const start=publishedSource.indexOf('// Lower only this hill\'s sun caster;'),end=publishedSource.indexOf('// One sampled surface is shared',start);assert(start>=0&&end>start);
 let normalized=publishedSource.slice(0,start)+publishedSource.slice(end);const addition=" const sunDepth=chalkSunDepth(T);ground.customDepthMaterial=sunDepth;\n const releaseSunDepth=()=>{geometry.removeEventListener('dispose',releaseSunDepth);sunDepth.dispose();};geometry.addEventListener('dispose',releaseSunDepth);\n";assert.equal(normalized.split(addition).length,2);normalized=normalized.replace(addition,'');assert.equal(normalized,baselineSource);
 for(const row of surface.meshes){const mesh=historicalAfter.down.root.getObjectByName(row.name);for(const [name,hash]of Object.entries(row.attributes)){if(row.name==='vista:chalkscarp'&&name==='color')continue;assert.equal(fnv(mesh.geometry.attributes[name].array),hash,row.name+' '+name);}assert.equal(mesh.geometry.index?fnv(mesh.geometry.index.array):null,row.index);}
});
test('QUALIFIED published d60 constructor retains historical519f visible geometry/native samples; current resource population remains exact',()=>{
 assert.deepEqual(historicalAfter.snapshot,before.snapshot);assert.equal(after.mat,actualGround.material);assert(actualGround.castShadow&&actualGround.receiveShadow);
 assert.equal(after.records.geometries.length,before.records.geometries.length);assert.equal(after.records.meshes.length,before.records.meshes.length);assert.equal(after.records.groups.length,before.records.groups.length);assert.equal(after.records.standard.length,before.records.standard.length);assert.equal(after.records.textures.length,before.records.textures.length);
 assert.equal(after.records.depth.length-before.records.depth.length,1);assert.equal(after.records.requests.length,2);
});
test('actual constructor and subsequent gameplay sequence preserve global random draws, including fallback ground material',()=>{
 assert.equal(after.draws,before.draws);assert.deepEqual(after.future,before.future);
 const a=construct(createBaseline,{fallback:true,flat:true}),b=construct(createChalkDown,{fallback:true,flat:true});assert.equal(b.draws,a.draws);assert.deepEqual(b.future,a.future);assert.equal(b.down.root.getObjectByName('vista:chalkscarp').material.isMeshStandardMaterial,true);assert.equal(b.records.requests.length,5);
});
test('one owned RGB packed depth material changes only bundled begin_vertex and needs no texture or geometry allocation',()=>{
 const d=actualGround.customDepthMaterial;assert(d.isMeshDepthMaterial);assert.equal(d.depthPacking,T.RGBADepthPacking);assert.equal(d.side,T.DoubleSide);assert.equal(d.map,null);assert.equal(d.alphaMap,null);assert.equal(d.displacementMap,null);assert.equal(d.customProgramCacheKey(),'chalk-sun-caster-inset-2');
 const shader={vertexShader:T.ShaderLib.depth.vertexShader,fragmentShader:T.ShaderLib.depth.fragmentShader,uniforms:{}};const frag=shader.fragmentShader,prior=Math.random;Math.random=()=>{throw Error('compile hook must not use random');};try{d.onBeforeCompile(shader);}finally{Math.random=prior;}
 assert.equal(shader.vertexShader,T.ShaderLib.depth.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed -= normal * 0.10;'));assert.equal(shader.fragmentShader,frag);assert.deepEqual(shader.uniforms,{});assert.throws(()=>d.onBeforeCompile({vertexShader:'void main() {}'}),/bundled begin_vertex/);
 const three=readFileSync(new URL('../assets/vendor/three/build/three.module.js',import.meta.url),'utf8');assert(three.includes("'attribute vec3 normal;'"));assert(three.includes('object.customDepthMaterial'));assert(three.includes('result.side = ( material.shadowSide !== null ) ? material.shadowSide'));
});
test('all 18,193 actual hill vertices have bounded 10cm inward shadow-only offset, with visible/physical bytes untouched',()=>{
 const p=actualGround.geometry.attributes.position,n=actualGround.geometry.attributes.normal,beforeHash=bytes(p);let min=Infinity,max=0,maxFloat=0,minY=Infinity,maxY=0,maxHoriz=0;
 for(let i=0;i<p.count;i++){const v=[p.getX(i),p.getY(i),p.getZ(i)],nn=[n.getX(i),n.getY(i),n.getZ(i)],s=v.map((q,k)=>q-nn[k]*.10),distance=Math.hypot(...s.map((q,k)=>q-v[k]));assert(nn[1]>0);min=Math.min(min,distance);max=Math.max(max,distance);minY=Math.min(minY,v[1]-s[1]);maxY=Math.max(maxY,v[1]-s[1]);maxHoriz=Math.max(maxHoriz,Math.hypot(s[0]-v[0],s[2]-v[2]));maxFloat=Math.max(maxFloat,Math.abs(Math.hypot(...s.map((q,k)=>Math.fround(q)-v[k]))-.10));}
 assert.equal(p.count,18193);assert(Math.abs(min-.10)<1e-8&&Math.abs(max-.10)<1e-8);assert(maxFloat<2e-5);assert.equal(bytes(p),beforeHash);assert.deepEqual(actualGround.matrixWorld.toArray(),new T.Matrix4().toArray());
 globalThis.chalkShadowDepthProof={vertices:p.count,insetM:.10,minOffsetM:min,maxOffsetM:max,maxFloat32OffsetErrorM:maxFloat,minVerticalInsetM:minY,maxVerticalInsetM:maxY,maxHorizontalInsetM:maxHoriz,globalDraws:after.draws,baselineDraws:before.draws,future20Exact:after.future.every((v,i)=>v===before.future[i]),resources:{before:{geometries:before.records.geometries.length,standardMaterials:before.records.standard.length,depthMaterials:before.records.depth.length,textures:before.records.textures.length,meshes:before.records.meshes.length,groups:before.records.groups.length},after:{geometries:after.records.geometries.length,standardMaterials:after.records.standard.length,depthMaterials:after.records.depth.length,textures:after.records.textures.length,meshes:after.records.meshes.length,groups:after.records.groups.length}},geometryBytes:Object.values(actualGround.geometry.attributes).reduce((s,a)=>s+a.array.byteLength,actualGround.geometry.index.array.byteLength)};
});
test('private depth UUIDs are unique across separate live hills and failure restores the exact caller random function',()=>{
 const second=construct(createChalkDown);assert.notEqual(actualGround.customDepthMaterial.uuid,second.down.root.getObjectByName('vista:chalkscarp').customDepthMaterial.uuid);assert.deepEqual(second.future,before.future);
 const prior=Math.random;assert.throws(()=>construct(createChalkDown,{failDepth:true}),/fixture depth failure/);assert.equal(Math.random,prior);
});
test('geometry retirement disposes the single private depth material once and never disposes the shared main surface',()=>{
 let disposed=0,mainDisposed=0;const g=construct(createChalkDown).down.root.getObjectByName('vista:chalkscarp'),d=g.customDepthMaterial;d.addEventListener('dispose',()=>disposed++);g.material.addEventListener('dispose',()=>mainDisposed++);g.geometry.dispose();g.geometry.dispose();assert.equal(disposed,1);assert.equal(mainDisposed,0);
});
test('depth hook serialization and repeat compilation remain deterministic and do not mutate color shaders',()=>{
 const d=actualGround.customDepthMaterial,shader=()=>({vertexShader:T.ShaderLib.depth.vertexShader,fragmentShader:T.ShaderLib.depth.fragmentShader,uniforms:{}}),a=shader(),b=shader();d.onBeforeCompile(a);d.onBeforeCompile(b);assert.deepEqual(a,b);assert.equal(d.toJSON().type,'MeshDepthMaterial');assert.equal(d.toJSON().userData.chalkCasterInsetM,.10);assert.equal(actualGround.material.customProgramCacheKey(),before.mat.customProgramCacheKey());
 if(process.env.CHALK_SHADOW_AUDIT_OUTPUT){writeFileSync(process.env.CHALK_SHADOW_AUDIT_OUTPUT,JSON.stringify(globalThis.chalkShadowDepthProof,null,2)+'\n');}
});

test('real constructor negative control detects the four gameplay draws from an unisolated added depth material',async()=>{
 const randomLine=source.split('\n').find(line=>line.startsWith(' Math.random=()=>{state='));assert(randomLine);
 const variant=source.replace(randomLine,' // Fixture deliberately omits private UUID randomness.').replace(/'\.\/chalk-downland\.mjs\?v=[^']*'/,JSON.stringify(new URL('../assets/chalk-downland.mjs',import.meta.url).href));
 const module=await import('data:text/javascript;base64,'+Buffer.from(variant).toString('base64'));const bad=construct(module.createChalkDown);assert.equal(bad.draws,before.draws+4);assert.notDeepEqual(bad.future,before.future);
});

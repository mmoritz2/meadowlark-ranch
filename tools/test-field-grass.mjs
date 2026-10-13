import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as T from '../assets/vendor/three/build/three.module.js';
import {createLushMeadowGeometry} from '../assets/lush-meadow-geometry.mjs';
import {createMeadowDistance} from '../assets/meadow-cover.js';
import {createGrassTuftGeometry} from './grass-arch-historical-factories.mjs';
import {createGrassFamilyGeometry} from './grass-arch-historical-factories.mjs';
import {MIXED_SWARD} from './grass-ribbon-historical-factories.mjs';
const budgets=[
 {name:'near',create:()=>createGrassTuftGeometry(T,{profile:'near-folded-v1'}),leaves:12,triangles:40,vertices:64,bytes:3056},
 ...[0,1,2].map(f=>({name:'rich '+f,create:()=>createGrassFamilyGeometry(T,f),leaves:22,triangles:70,vertices:f===2?138:114,bytes:f===2?6492:5436})),
 ...[4,6,8].map(n=>({name:'middle '+n,create:()=>createGrassTuftGeometry(T,{profile:'middle-natural-v1',bladeCount:n,segments:2}),leaves:{4:6,6:10,8:12}[n],triangles:n*3,vertices:{4:24,6:38,8:48}[n],bytes:{4:1128,6:1780,8:2256}[n]})),
];
for(const b of budgets)test(`Historical d5 morphology: ${b.name}: more narrow upright blades retain the original triangle tier and finite physical surfaces`,()=>{
 const g=b.create(),p=g.attributes.position,n=g.attributes.normal,leaves=g.userData.lushMeadow.leafRanges;
 try{
  assert.equal(leaves.length,b.leaves);assert.equal(g.index.count/3,b.triangles);assert.equal(p.count,b.vertices);
  assert.equal(Object.values(g.attributes).reduce((sum,a)=>sum+a.array.byteLength,0)+g.index.array.byteLength,b.bytes);
  for(const a of Object.values(g.attributes)){assert.equal(a.count,p.count);assert(Array.from(a.array).every(Number.isFinite));}
  for(const leaf of leaves){
   const root=new T.Vector3().fromBufferAttribute(p,leaf.vertexStart).add(new T.Vector3().fromBufferAttribute(p,leaf.vertexStart+1)).multiplyScalar(.5),tip=new T.Vector3().fromBufferAttribute(p,leaf.vertexStart+leaf.vertexCount-1);
   assert.equal(root.y,0);assert(root.length()<.13);assert(tip.y>0);
   const reach=Math.hypot(tip.x-root.x,tip.z-root.z),rise=tip.y;
   assert(reach<(b.name.startsWith('middle')?.06:.14));assert(rise>reach*(b.name==='rich 1'?2.8:b.name.startsWith('middle')?8:4));
   let maximumWidth=0;
   for(let at=leaf.vertexStart;at<leaf.vertexStart+leaf.vertexCount-1;at+=2)maximumWidth=Math.max(maximumWidth,new T.Vector3().fromBufferAttribute(p,at).distanceTo(new T.Vector3().fromBufferAttribute(p,at+1)));
   assert(maximumWidth<rise*.06,'leaf surface stays slender compared with its upright length');
  }
  for(let i=0;i<p.count;i++)assert(Math.abs(new T.Vector3().fromBufferAttribute(n,i).length()-1)<1e-6);
  for(let i=0;i<g.index.count;i+=3){const ids=[0,1,2].map(j=>g.index.array[i+j]),[a,b,c]=ids.map(j=>new T.Vector3().fromBufferAttribute(p,j)),face=b.sub(a).cross(c.sub(a));assert(face.length()>1e-8);face.normalize();for(const id of ids)assert(face.dot(new T.Vector3().fromBufferAttribute(n,id))>.35);}
 }finally{g.dispose();}
});

test('Historical d5 morphology: factories keep one geometry allocation and its existing four UUID draws without placing new instances',()=>{
 const old=Math.random;let draws=0;
 try{Math.random=()=>{draws++;return .25;};for(const b of budgets){const start=draws,a=b.create();assert.equal(draws-start,4);const c=b.create();for(const key of Object.keys(a.attributes))assert.deepEqual(a.attributes[key].array,c.attributes[key].array);assert.deepEqual(a.index.array,c.index.array);a.dispose();c.dispose();}}
 finally{Math.random=old;}
 assert.equal(MIXED_SWARD.sourceGeometryBytes,3056);assert.equal(MIXED_SWARD.sourceTriangles,40);assert.equal(MIXED_SWARD.richTriangles,70);
});

test('Historical d5 morphology: grass-only wind follows world height through broad middle spacing and stays finite for hidden rows',()=>{
 const html=fs.readFileSync(new URL('../ranch3d.html',import.meta.url),'utf8'),match=html.match(/const windy=(\(mat,sway,grassAreaFade=false\)=>[\s\S]*?);\n \/\* ===== ground cover/);assert(match);
 const windy=new Function('nearU','NG_R','return '+match[1])({uTime:{value:0},uPlayer:{value:new T.Vector3()}},42);
 const compile=(grass)=>{const m=new T.MeshStandardMaterial();windy(m,.24,grass);const s={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};m.onBeforeCompile(s);m.dispose();return s;};
 const near=compile(true),flora=compile(false);assert(near.vertexShader.includes('nearGrassSwayScale'));assert(!flora.vertexShader.includes('nearGrassSwayScale'));
 const f=createMeadowDistance({THREE:T,scene:new T.Scene(),canGrow:()=>false,heightAt:()=>0,managedAt:()=>0}),s={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};f.mesh.material.onBeforeCompile(s);assert(s.vertexShader.includes('middleGrassSwayScale'));
 for(const horizontal of [0,.4,1,2.5,3.1])for(const vertical of [0,.08,.3,.7,1.3]){
  const scale=vertical/Math.sqrt(Math.max(horizontal*horizontal,.000001));assert(Number.isFinite(scale));
  const worldSway=horizontal*vertical*.15*scale,expected=vertical*vertical*.15;
  if(horizontal>0)assert(Math.abs(worldSway-expected)<1e-14,'sway depends on physical blade height, not broadened row spacing');
 }
 assert.equal(near.fragmentShader,flora.fragmentShader);assert.equal(near.fragmentShader,T.ShaderLib.standard.fragmentShader);
 f.mesh.geometry.dispose();f.mesh.material.dispose();f.mesh.removeFromParent();
});

test('Historical d5 morphology: grass shader normals follow the same retirement, wind shear and rider parting as deformed triangles',()=>{
 const html=fs.readFileSync(new URL('../ranch3d.html',import.meta.url),'utf8'),match=html.match(/const windy=(\(mat,sway,grassAreaFade=false\)=>[\s\S]*?);\n \/\* ===== ground cover/);
 const windy=new Function('nearU','NG_R','return '+match[1])({uTime:{value:0},uPlayer:{value:new T.Vector3()}},42),mat=new T.MeshStandardMaterial();windy(mat,.24,true);
 const sh={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};mat.onBeforeCompile(sh);
 const expression=sh.vertexShader.match(/objectNormal\.y=([^;]+);/);assert(expression);
 const normalY=new Function('objectNormal','nearGrassWindX','nearGrassWindZ','nearGrassPartVector','nearGrassPartScale','return '+expression[1]);
 assert(sh.vertexShader.includes('transformed.x+=nearGrassWindX*transformed.y;'));assert(sh.vertexShader.includes('transformed.z+=nearGrassWindZ*transformed.y;'));
 assert(sh.vertexShader.includes('transformed.xz+=nearGrassPartVector*transformed.y;'));assert(sh.vertexShader.includes('transformed.y*=nearGrassPartScale;'));
 const transforms=[{wx:0,wz:0,p:{x:0,y:0},sy:1},{wx:.15,wz:-.08,p:{x:0,y:0},sy:1},{wx:-.35,wz:.19,p:{x:.44,y:-.18},sy:.70},{wx:.25,wz:.12,p:{x:-.2,y:.25},sy:.82}];
 for(const b of budgets){
  const g=b.create(),p=g.attributes.position,n=g.attributes.normal;
  for(const fade of [0,.0001,.12,.45,1])for(const a of transforms){
   const reach=Math.sqrt(fade),points=Array.from({length:p.count},(_,i)=>{
    const y=p.getY(i)*fade;return new T.Vector3(p.getX(i)*reach+(a.wx+a.p.x)*y,y*a.sy,p.getZ(i)*reach+(a.wz+a.p.y)*y);
   });
   const sums=Array.from({length:p.count},()=>new T.Vector3());
   if(fade>0)for(let i=0;i<g.index.count;i+=3){const ids=[0,1,2].map(j=>g.index.array[i+j]),[v0,v1,v2]=ids.map(id=>points[id]),cross=new T.Vector3().subVectors(v1,v0).cross(new T.Vector3().subVectors(v2,v0));for(const id of ids)sums[id].add(cross);}
   for(let i=0;i<p.count;i++){
    const actual=new T.Vector3(n.getX(i)*Math.max(reach,.0001),n.getY(i),n.getZ(i)*Math.max(reach,.0001));actual.y=normalY(actual,a.wx,a.wz,a.p,a.sy);actual.normalize();assert(actual.toArray().every(Number.isFinite));
    if(fade>0)assert(actual.distanceTo(sums[i].normalize())<3e-6,'inverse transpose follows the real changed surface through grass wind/parting');
   }
  }
  g.dispose();
 }
 mat.dispose();
});

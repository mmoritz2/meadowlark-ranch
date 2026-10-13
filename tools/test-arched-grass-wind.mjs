import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as T from '../assets/vendor/three/build/three.module.js';
import {createLushMeadowGeometry} from '../assets/lush-meadow-geometry.mjs';
import {createGrazedSwardGeometry} from '../assets/grazed-sward.mjs';
import {normalizeGrassArchSource} from './grass-arch-source-guard.cjs';
const forms=[{profile:'near',leafCount:8,segments:3},{profile:'meadow',leafCount:14,segments:3},{profile:'low',leafCount:14,segments:3},{profile:'seeded',leafCount:14,segments:2,seeded:true}];
const make=[...forms.map(o=>()=>createLushMeadowGeometry(T,o)),()=>createGrazedSwardGeometry(T)];
test('actual arched/creased leaf normals follow real wind, retirement and rider-parting triangles',()=>{
 const html=fs.readFileSync(new URL('../ranch3d.html',import.meta.url),'utf8'),match=html.match(/const windy=(\(mat,sway,grassAreaFade=false\)=>[\s\S]*?);\n \/\* ===== ground cover/);assert(match);
 const windy=new Function('nearU','NG_R','return '+match[1])({uTime:{value:0},uPlayer:{value:new T.Vector3()}},42),mat=new T.MeshStandardMaterial();windy(mat,.24,true);
 const sh={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};mat.onBeforeCompile(sh);
 const expression=sh.vertexShader.match(/objectNormal\.y=([^;]+);/);assert(expression);
 const normalY=new Function('objectNormal','nearGrassWindX','nearGrassWindZ','nearGrassPartVector','nearGrassPartScale','return '+expression[1]);
 assert(sh.vertexShader.includes('transformed.x+=nearGrassWindX*transformed.y;'));assert(sh.vertexShader.includes('transformed.z+=nearGrassWindZ*transformed.y;'));
 assert(sh.vertexShader.includes('transformed.xz+=nearGrassPartVector*transformed.y;'));assert(sh.vertexShader.includes('transformed.y*=nearGrassPartScale;'));
 const transforms=[{wx:0,wz:0,p:{x:0,y:0},sy:1},{wx:.15,wz:-.08,p:{x:0,y:0},sy:1},{wx:-.35,wz:.19,p:{x:.44,y:-.18},sy:.70},{wx:.25,wz:.12,p:{x:-.2,y:.25},sy:.82}];
 let checked=0;
 for(const create of make){const g=create(),p=g.attributes.position,n=g.attributes.normal;
  for(const fade of [0,.0001,.12,.45,1])for(const a of transforms){const reach=Math.sqrt(fade),points=Array.from({length:p.count},(_,i)=>{const y=p.getY(i)*fade;return new T.Vector3(p.getX(i)*reach+(a.wx+a.p.x)*y,y*a.sy,p.getZ(i)*reach+(a.wz+a.p.y)*y);}),sums=Array.from({length:p.count},()=>new T.Vector3());
   if(fade>0)for(let i=0;i<g.index.count;i+=3){const ids=[0,1,2].map(j=>g.index.array[i+j]),[v0,v1,v2]=ids.map(id=>points[id]),cross=new T.Vector3().subVectors(v1,v0).cross(new T.Vector3().subVectors(v2,v0));for(const id of ids)sums[id].add(cross);}
   for(let i=0;i<p.count;i++){const actual=new T.Vector3(n.getX(i)*Math.max(reach,.0001),n.getY(i),n.getZ(i)*Math.max(reach,.0001));actual.y=normalY(actual,a.wx,a.wz,a.p,a.sy);actual.normalize();assert(actual.toArray().every(Number.isFinite));if(fade>0)assert(actual.distanceTo(sums[i].normalize())<3e-6,'Retained shader inverse transpose follows actual folded/creased surface');checked++;}
  }g.dispose();
 }assert(checked>10000);mat.dispose();
});
test('actual new factory rejects invalid topology before allocating any Three resource',()=>{
 let calls=0;const fixture={BufferGeometry:class{constructor(){calls++;}}};
 for(const options of [{leafCount:3},{leafCount:15},{leafCount:6.5},{segments:4},{profile:'unknown'}])assert.throws(()=>createLushMeadowGeometry(fixture,options));
 assert.equal(calls,0);
});
test('reviewed leaf reversal pins every full original body and rejects duplicate, malformed or unrelated edits',()=>{
 const preimage=JSON.parse(fs.readFileSync(new URL('./fixtures/grass-arch-d5b9441/preimage-SHA.json',import.meta.url))),sha=s=>crypto.createHash('sha256').update(s).digest('hex');
 for(const[file,hash]of Object.entries(preimage)){
  const source=fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');assert.equal(sha(normalizeGrassArchSource(source,file)),hash,file);
  assert.throws(()=>normalizeGrassArchSource(source+'\n// unreviewed owner drift',file),'Every byte outside an exact approved edit remains pinned');
 }
 const main=fs.readFileSync(new URL('../ranch3d.html',import.meta.url),'utf8'),tag="'./assets/mixed-sward.mjs?v=grass-arch-2'";
 assert.equal(main.split(tag).length,2);assert.throws(()=>normalizeGrassArchSource(main+'\n// duplicate '+tag,'ranch3d.html'));
 assert.throws(()=>normalizeGrassArchSource(main.replace(tag,"'./assets/mixed-sward.mjs?v=unreviewed-arch'"),'ranch3d.html'));
});

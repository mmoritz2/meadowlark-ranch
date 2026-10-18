import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {pathToFileURL,fileURLToPath} from 'node:url';
import path from 'node:path';
import {createLushMeadowGeometry as make} from '../assets/lush-meadow-geometry.mjs';
import {createGrassFamilyGeometry,GRASS_FAMILIES} from '../assets/grass-families.mjs';
const root=process.env.DRY_COVER_REPO_ROOT||fileURLToPath(new URL('../',import.meta.url));
const T=await import(pathToFileURL(path.join(root,'assets/vendor/three/build/three.module.js')).href);
const {createGrazedSwardGeometry,createLowGrazedSwardGeometry}=await import(pathToFileURL(path.join(root,'assets/grazed-sward.mjs')).href);
const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/dry-cover-cd4b62d/actual-owners.json',import.meta.url)));
const recipe=JSON.parse(fs.readFileSync(new URL('./fixtures/dry-cover-cd4b62d/source-edits.json',import.meta.url)));
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const hashGeometry=g=>({attributes:Object.fromEntries(Object.entries(g.attributes).map(([n,a])=>[n,sha(Buffer.from(a.array.buffer,a.array.byteOffset,a.array.byteLength))])),index:sha(Buffer.from(g.index.array.buffer,g.index.array.byteOffset,g.index.array.byteLength)),vertices:g.attributes.position.count,triangles:g.index.count/3});
const v=(a,i)=>new T.Vector3().fromBufferAttribute(a,i);
const budgets={near:[12,40,64,3056],meadow:[22,70,114,5436],low:[22,70,114,5436],seeded:[14,70,122,5788],middle4:[8,12,28,1304],middle6:[10,18,38,1780],middle8:[12,24,48,2256]};
for(const [name,old]of Object.entries(fixture.forms))test(`${name}: actual retained triangle tier, connected finer leaves, physical normals and finite complete attributes`,()=>{
 const g=make(T,old.options),p=g.attributes.position,n=g.attributes.normal,leaves=g.userData.lushMeadow.leafRanges,[count,triangles,vertices,bytes]=budgets[name];
 try{
  assert.equal(leaves.length,count);assert.equal(g.index.count/3,triangles);assert.equal(p.count,vertices);assert.equal(n.count,p.count);
  assert.equal(Object.values(g.attributes).reduce((s,a)=>s+a.array.byteLength,0)+g.index.array.byteLength,bytes);
  for(const a of Object.values(g.attributes)){assert.equal(a.count,p.count);assert([...a.array].every(Number.isFinite));}
  const used=new Set(g.index.array);assert.equal(used.size,p.count,'no hidden extent or unused vertices');
  let directions=new Set(),basal=0,curved=0;
  for(const r of leaves){
   const base=v(p,r.vertexStart).add(v(p,r.vertexStart+1)).multiplyScalar(.5),tip=v(p,r.vertexStart+r.vertexCount-1);assert.equal(base.y,0);assert(Math.abs(base.x-r.root[0])<1e-7&&Math.abs(base.z-r.root[1])<1e-7);assert(tip.y>0);
   assert.equal(r.indexCount/3,r.segments*2-1);for(const id of g.index.array.slice(r.indexStart,r.indexStart+r.indexCount))assert(id>=r.vertexStart&&id<r.vertexStart+r.vertexCount);
   directions.add(Math.floor((Math.atan2(tip.z-base.z,tip.x-base.x)+Math.PI)/(Math.PI/2))%4);
   const maxY=Math.max(...Array.from({length:r.vertexCount},(_,i)=>p.getY(r.vertexStart+i)));if(maxY<.60)basal++;
   if(r.bent){curved++;const shoulder=v(p,r.vertexStart+2).add(v(p,r.vertexStart+3)).multiplyScalar(.5),line=tip.clone().sub(base),t=shoulder.clone().sub(base).dot(line)/line.lengthSq();assert(shoulder.distanceTo(base.clone().addScaledVector(line,t))>.0008,'real bend beyond the straight root-tip chord');}
  }
  assert(directions.size>=3,'leaf headings surround the rooted stand');assert(basal>=2);assert(curved>=2);
  let area=0;const sums=Array.from({length:p.count},()=>new T.Vector3());
  for(let i=0;i<g.index.count;i+=3){const ids=[0,1,2].map(j=>g.index.array[i+j]),[a,b,c]=ids.map(id=>v(p,id)),face=b.sub(a).cross(c.sub(a));assert(face.length()>1e-7);area+=face.length()/2;for(const id of ids)sums[id].add(face);face.normalize();for(const id of ids)assert(face.dot(v(n,id))>.35,'normals face their actual connected surface');}
  for(let i=0;i<p.count;i++){assert(Math.abs(v(n,i).length()-1)<1e-6);assert(v(n,i).distanceTo(sums[i].normalize())<1e-6,'actual area-weighted normals');}
  assert(area>(name==='near'?.075:name.startsWith('middle')?.025:.09));assert.notDeepEqual(hashGeometry(g),{attributes:old.attributes,index:old.index,vertices:old.vertices,triangles:old.triangles});
 }finally{g.dispose();}
});

test('actual rich-family adapter reports the changed leaves/vertices while every form stays at seventy triangles',()=>{
 for(let i=0;i<3;i++){const g=createGrassFamilyGeometry(T,i);try{assert.equal(GRASS_FAMILIES[i].leaves,[22,22,14][i]);assert.equal(g.userData.grassFamily.leaves,g.userData.lushMeadow.leaves);assert.equal(g.userData.grassFamily.vertices,g.attributes.position.count);assert.equal(g.index.count/3,70);}finally{g.dispose();}}
});

test('one original geometry constructor keeps four UUID draws and the next24 global random values exact for all canonical forms',()=>{
 const original=Math.random,stream=()=>{let s=617;return()=>((s=Math.imul(s,1664525)+1013904223)>>>0)/4294967296;};
 try{for(const {options}of Object.values(fixture.forms)){let draws=0,rand=stream();Math.random=()=>{draws++;return rand();};const baseline=new T.BufferGeometry(),future=Array.from({length:24},()=>Math.random());baseline.dispose();rand=stream();draws=0;Math.random=()=>{draws++;return rand();};const a=make(T,options);assert.equal(draws,4);assert.deepEqual(Array.from({length:24},()=>Math.random()),future);const b=make(T,options);assert.deepEqual(hashGeometry(a),hashGeometry(b));a.dispose();b.dispose();}}
 finally{Math.random=original;}
});

test('exported arch appender, grazed70/Low40 actual buffers, noncanonical factories and exact seeded head/stem surfaces are preserved',()=>{
 const source=fs.readFileSync(new URL('../assets/lush-meadow-geometry.mjs',import.meta.url),'utf8'),a=source.indexOf('export function appendArchedMeadowLeaf'),b=source.indexOf('\n\n\n// Original dry-cover',a);assert.equal(sha(source.slice(a,b)),fixture.appendBodyHash);
 const high=createGrazedSwardGeometry(T),low=createLowGrazedSwardGeometry(T,high);try{assert.deepEqual(hashGeometry(high),fixture.grazed.high);assert.deepEqual(hashGeometry(low),fixture.grazed.low);}finally{high.dispose();low.dispose();}
 for(const row of fixture.noncanonical){const g=make(T,row.options);try{const {options,...expected}=row;assert.deepEqual(hashGeometry(g),expected);}finally{g.dispose();}}
 const g=make(T,fixture.forms.seeded.options);try{const r=g.userData.lushMeadow.leafRanges.at(-1),start=r.vertexStart+r.vertexCount,ind=r.indexStart+r.indexCount;for(const[n,a]of Object.entries(g.attributes))assert.deepEqual([...a.array.slice(start*a.itemSize)],fixture.seedHeads.attributes[n]);assert.deepEqual(Array.from(g.index.array.slice(ind),i=>i-start),fixture.seedHeads.index);}finally{g.dispose();}
});

test('existing affine wind/fade/parting normal correction remains valid for the new real leaf surfaces',()=>{
 for(const {options}of Object.values(fixture.forms)){const g=make(T,options),p=g.attributes.position,n=g.attributes.normal;
  try{for(const [xz,y,wx,wz,ps]of [[1,1,.24,.16,1],[.6,.36,-.18,.22,.7],[2.6,.9,.12,-.07,.82],[.01,.0001,.07,.14,1]]){
   const m=new T.Matrix4().set(xz,wx*y,0,0,0,y*ps,0,0,0,wz*y,xz,0,0,0,0,1),nm=new T.Matrix3().getNormalMatrix(m),points=Array.from({length:p.count},(_,i)=>v(p,i).applyMatrix4(m)),sums=Array.from({length:p.count},()=>new T.Vector3());
   for(let i=0;i<g.index.count;i+=3){const ids=[0,1,2].map(j=>g.index.array[i+j]),[a,b,c]=ids.map(j=>points[j]),f=b.clone().sub(a).cross(c.clone().sub(a));for(const id of ids)sums[id].add(f);}
   for(let i=0;i<p.count;i++){const actual=v(n,i).applyMatrix3(nm).normalize();assert(actual.toArray().every(Number.isFinite));assert(actual.distanceTo(sums[i].normalize())<4e-6);}
  }}finally{g.dispose();}
 }
});

test('counted inverse reconstructs exact parent sources; no material/shader/placement/budget-membership edits or resource constructors',()=>{
 for(const[rel,row]of Object.entries(recipe)){let source=fs.readFileSync(new URL('../'+rel,import.meta.url),'utf8');assert.equal(sha(source),row.afterSHA256);for(const c of [...row.changes].reverse()){assert.equal(source.split(c.after).length-1,c.occurrences);source=source.split(c.after).join(c.before);}assert.equal(sha(source),row.beforeSHA256);assert.equal(row.beforeSHA256,fixture.sourceHashes[rel]);}
 const source=fs.readFileSync(new URL('../assets/lush-meadow-geometry.mjs',import.meta.url),'utf8');assert(!/Math\.random|new\s+T\.(?:Mesh|Texture|Material)|fetch\(/.test(source));
 const mixed=fs.readFileSync(new URL('../assets/mixed-sward.mjs',import.meta.url),'utf8');assert(mixed.includes('sourceGeometryBytes:3056'));assert(mixed.includes('maxTriangleRatio:1.20'));assert(mixed.includes('sourceTriangles:40'));assert(mixed.includes('richTriangles:70'));
 assert(fixture.observedOwners.every(o=>o.pass));assert.equal(fixture.observedOwners.length,3);
});

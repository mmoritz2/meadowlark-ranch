import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../assets/vendor/three/build/three.module.js';
import {createLushMeadowGeometry} from '../assets/lush-meadow-geometry.mjs';
import {createGrazedSwardGeometry} from '../assets/grazed-sward.mjs';
const cases=[{profile:'meadow',leafCount:14,segments:3},{profile:'low',leafCount:14,segments:3},{profile:'seeded',leafCount:14,segments:2,seeded:true},{profile:'near',leafCount:8,segments:3},...[4,6,8].map(leafCount=>({profile:'middle',leafCount,segments:2}))];
for(const options of cases)test(`fine ${options.profile} ${options.leafCount}: slim rooted leaves keep heights, budget and valid physical normals`,()=>{
 const g=createLushMeadowGeometry(T,options),p=g.attributes.position,n=g.attributes.normal,ranges=g.userData.lushMeadow.leafRanges;
 try{
  assert.equal(g.index.count/3,options.leafCount*(options.segments===3?5:3)+(options.seeded?28:0));
  for(const a of Object.values(g.attributes)){assert.equal(a.count,p.count);assert(Array.from(a.array).every(Number.isFinite));}
  let bowed=0;for(const r of ranges){const root=new T.Vector3().fromBufferAttribute(p,r.vertexStart).add(new T.Vector3().fromBufferAttribute(p,r.vertexStart+1)).multiplyScalar(.5);assert.equal(root.y,0);assert(root.length()<.13);
   const top=Math.max(...Array.from({length:r.vertexCount},(_,i)=>p.getY(r.vertexStart+i))),tip=r.vertexStart+r.vertexCount-1;
   if(top>p.getY(tip))bowed++;assert(p.getY(tip)>top*.85,'fine tips remain close to the top instead of a deep folded-paper hook');
   for(let i=r.vertexStart;i<tip;i+=2){const w=new T.Vector3().fromBufferAttribute(p,i).distanceTo(new T.Vector3().fromBufferAttribute(p,i+1));assert(w>.004&&w<(options.profile==='middle'?.075:.049),'thin continuous ribbons replace broad paddles');}
   assert(Math.hypot(p.getX(tip),p.getZ(tip))<.60);
  }
  assert(bowed>=ranges.length/2,'most leaves retain a gentle modeled bow');
  for(let i=0;i<p.count;i++)assert(Math.abs(new T.Vector3().fromBufferAttribute(n,i).length()-1)<1e-6);
  for(let i=0;i<g.index.count;i+=3){const ids=[0,1,2].map(j=>g.index.array[i+j]),[a,b,c]=ids.map(j=>new T.Vector3().fromBufferAttribute(p,j)),f=b.sub(a).cross(c.sub(a));assert(f.length()>1e-8);f.normalize();for(const j of ids)assert(f.dot(new T.Vector3().fromBufferAttribute(n,j))>.18,'normal remains on the physical face side through the bend');}
 }finally{g.dispose();}
});
test('grazed growth points hold mostly upright narrow fans instead of low radial spokes',()=>{
 const g=createGrazedSwardGeometry(T),p=g.attributes.position;try{let at=0;
  for(let leaf=0;leaf<46;leaf++){const count=leaf<12?5:3,root=new T.Vector3().fromBufferAttribute(p,at).add(new T.Vector3().fromBufferAttribute(p,at+1)).multiplyScalar(.5),tip=new T.Vector3().fromBufferAttribute(p,at+count-1),reach=Math.hypot(tip.x-root.x,tip.z-root.z);
   assert(reach>.12&&reach<.21);assert(tip.y>reach*1.4,'short leaves retain a visible upright rise');at+=count;
  }
 }finally{g.dispose();}
});
test('all finesse factories retain one geometry allocation, four UUID draws, deterministic data and no placement draws',()=>{
 const original=Math.random;let draws=0;const calls=[...cases.map(o=>()=>createLushMeadowGeometry(T,o)),()=>createGrazedSwardGeometry(T)];
 try{Math.random=()=>{draws++;return .25;};for(const call of calls){const before=draws,a=call();assert.equal(draws-before,4);const b=call();for(const key of Object.keys(a.attributes))assert.deepEqual(a.attributes[key].array,b.attributes[key].array);assert.deepEqual(a.index.array,b.index.array);a.dispose();b.dispose();}}
 finally{Math.random=original;}
});

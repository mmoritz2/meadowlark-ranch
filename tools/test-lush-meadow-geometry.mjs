import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from '../assets/vendor/three/build/three.module.js';
import {createLushMeadowGeometry} from '../assets/lush-meadow-geometry.mjs';

test('long ordinary leaves retain useful height after established pasture scaling',()=>{
 for(const profile of ['meadow','near','middle']){
  const g=createLushMeadowGeometry(T,{profile,leafCount:profile==='meadow'?14:8,segments:profile==='middle'?2:3});
  try{const p=g.attributes.position,ranges=g.userData.lushMeadow.leafRanges;let area=0;
   for(const r of ranges){
    const root=new T.Vector3().fromBufferAttribute(p,r.vertexStart).add(new T.Vector3().fromBufferAttribute(p,r.vertexStart+1)).multiplyScalar(.5);
    assert(root.length()<.13);assert.equal(root.y,0);
    const top=Math.max(...Array.from({length:r.vertexCount},(_,k)=>p.getY(r.vertexStart+k)));
    assert(top*.3>.17&&top*.5<.60,'at existing .3–.5 Y scales an uncut leaf is upright, not a tiny flat fork');
   }
   for(let i=0;i<g.index.count;i+=3){const [a,b,c]=Array.from(g.index.array.slice(i,i+3),j=>new T.Vector3().fromBufferAttribute(p,j));area+=b.sub(a).cross(c.sub(a)).length()*.5;}
   assert(area>(profile==='meadow'?.5:.30),'full ribbon surfaces provide connected leaf mass');
   for(let i=0;i<p.count;i++)assert(Math.hypot(p.getX(i),p.getZ(i))<=.60,'authored reach stays inside the existing richest stand envelope');
  }finally{g.dispose();}
 }
});
test('factory retains one geometry allocation and adds no material, texture, or placement RNG',()=>{
 const source=readFileSync(new URL('../assets/lush-meadow-geometry.mjs',import.meta.url),'utf8');
 assert(!/Math\.random|new\s+T\.(?:Texture|Material|Mesh)|fetch\(/.test(source));
 let geometryCount=0;class Geometry extends T.BufferGeometry{constructor(){super();geometryCount++;}}
 const make=()=>createLushMeadowGeometry({...T,BufferGeometry:Geometry});
 let actualDraws=0,baselineDraws=0;const originalRandom=Math.random;
 try{
  Math.random=()=>{baselineDraws++;return .25;};const baseline=new T.BufferGeometry();baseline.dispose();
  Math.random=()=>{actualDraws++;return .25;};const a=make(),b=make();
  assert.equal(geometryCount,2);assert.equal(actualDraws,baselineDraws*2,'only the existing geometry UUID allocation may consume random values');
  assert.deepEqual(a.index.array,b.index.array);for(const key of Object.keys(a.attributes))assert.deepEqual(a.attributes[key].array,b.attributes[key].array);
  a.dispose();b.dispose();
 }finally{Math.random=originalRandom;}
});
test('invalid topology requests fail before allocating a geometry',()=>{
 let calls=0;const fixture={BufferGeometry:class{constructor(){calls++;}}};
 for(const options of [{leafCount:3},{leafCount:15},{leafCount:6.5},{segments:4},{profile:'unknown'}])assert.throws(()=>createLushMeadowGeometry(fixture,options));
 assert.equal(calls,0);
});

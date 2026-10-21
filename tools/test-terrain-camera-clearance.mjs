import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {canonicalSegmentDistance} from './terrain-camera-distance-reference.mjs';

// Staged tests use the existing repository's Three dependency; installed tests
// resolve the same dependency relative to tools. No generated artifact path is
// part of a published fixture or runtime import.
const here=path.dirname(fileURLToPath(import.meta.url));
const runtime=process.env.TERRAIN_CAMERA_RUNTIME_ROOT||path.resolve(here,'..');
const threeRoot=process.env.TERRAIN_CAMERA_THREE_ROOT||runtime;
const THREE=await import(pathToFileURL(path.join(threeRoot,'assets/vendor/three/build/three.module.js')));
const source=process.env.TERRAIN_CAMERA_CLEARANCE_SOURCE||path.join(runtime,'assets/terrain-camera-clearance.mjs');
const {createTerrainCameraClearance,TERRAIN_CAMERA_CLEARANCE_PROFILE}=await import(pathToFileURL(source));
const v=(x,y,z)=>new THREE.Vector3(x,y,z);
const flat=()=>({THREE,heights:new Float32Array(4),segments:1,step:10,originX:0,originZ:0});
const close=(actual,expected,tolerance=2e-11)=>assert(Math.abs(actual-expected)<=tolerance,`${actual} != ${expected}`);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const distance=(config,a,b,bound=Infinity)=>canonicalSegmentDistance(config,a,b,{candidateBound:bound});

test('finite triangle faces, edge cylinders and vertex caps return their distinct analytic entries',()=>{
 const config=flat(),sweep=createTerrainCameraClearance(config);
 close(sweep.limit(v(5,3,5),v(5,-3,5),1),1/3);
 close(sweep.limit(v(-.6,3,5),v(-.6,-3,5),1),(3-.8)/6);
 close(sweep.limit(v(-.6,3,-.6),v(-.6,-3,-.6),1),(3-Math.sqrt(.28))/6);
 assert.equal(sweep.limit(v(-1.0001,3,5),v(-1.0001,-3,5),1),1,'An infinite edge cylinder must not stand in for a finite edge');
 close(sweep.limit(v(5,3,5),v(5,-3,5),0),.5);
});

test('slopes use the actual anti-diagonal and sphere normal distance, rather than vertical clearance',()=>{
 const config={...flat(),heights:new Float32Array([1,3,7,13])},sweep=createTerrainCameraClearance(config);
 close(sweep.limit(v(2,15,3),v(2,-5,3),.1),(15-(3.2+.1*Math.sqrt(1.4)))/20);
 close(sweep.limit(v(8,18,7),v(8,-2,7),.1),(18-(8.8+.1*Math.sqrt(2.36)))/20);
 const t=sweep.limit(v(2,15,3),v(2,-5,3),.1),end=v(2,15,3).lerp(v(2,-5,3),t);
 close(distance(config,v(2,15,3),end).distance,.1,2e-10);
});

test('a high cell corner and expanded bounds do not become solid boxes',()=>{
 const config={...flat(),heights:new Float32Array([0,0,0,10])},sweep=createTerrainCameraClearance(config);
 assert.equal(sweep.limit(v(.2,2,.2),v(.4,2,.2),.3),1);
 assert.equal(sweep.limit(v(-4,2,-4),v(-2,2,-2),.3),1);
 assert.equal(sweep.limit(v(-2,2,5),v(12,2,5),.3)<1,true,'The real sloped upper triangle is still hit');
});

test('tangent contacts slide across cells and corners while actual penetration still clips',()=>{
 const config={...flat(),segments:4,step:2.5,heights:new Float32Array(25)},sweep=createTerrainCameraClearance(config);
 assert.equal(sweep.limit(v(-2,1,5),v(12,1,5),1),1);
 assert.equal(sweep.limit(v(-2,1,-1),v(12,1,-1),Math.SQRT2),1);
 assert(sweep.limit(v(-2,.999,5),v(12,.999,5),1)<1);
 const t=sweep.limit(v(-2,1,5),v(12,.999,5),1);assert(t>0&&t<1);
});

test('initial contact permits outward/tangent escape and blocks deeper face, edge or underground motion',()=>{
 const config=flat(),sweep=createTerrainCameraClearance(config),a=v(5,.5,5);
 assert.equal(sweep.limit(a,v(5,3,5),1),1);assert.equal(sweep.limit(a,v(9,.5,5),1),1);assert.equal(sweep.limit(a,v(5,0,5),1),0);
 assert.equal(sweep.limit(v(-.5,.5,5),v(0,.5,5),1),0);assert.equal(sweep.limit(v(-.5,.5,5),v(-.5,2,5),1),1);
 assert.equal(sweep.limit(v(5,-.5,5),v(5,2,5),1),1);assert.equal(sweep.limit(v(5,-.5,5),v(5,-2,5),1),0);
 assert.equal(sweep.limit(v(-.5,-.5,5),v(0,-.5,5),1),0,'An underground edge approach is deeper despite zero plane-normal speed');
 assert.equal(sweep.limit(v(5,-3,5),v(5,2,5),1),0,'Fully buried origins are explicitly invalid; this is not a depenetration solver');
 const steep={...flat(),heights:new Float32Array([0,100,0,100])},s=createTerrainCameraClearance(steep);
 assert.equal(s.limit(v(3,28,3),v(3,32,3),.3),1,'Vertical burial is not normal depth on a steep face');
 assert.equal(s.limit(v(5,48,5),v(5,52,5),.3),0,'Initially buried internal-edge overlap remains conservative when a different finite triangle is being approached');
});

test('live late height changes affect the existing helper without replacing any descriptor',()=>{
 const config=flat(),sweep=createTerrainCameraClearance(config),a=v(5,4,5),b=v(5,1,5);
 assert.equal(sweep.limit(a,b,.3),1);config.heights.fill(2);close(sweep.limit(a,b,.3),(4-2.3)/3);
 config.heights.fill(0);assert.equal(sweep.limit(a,b,.3),1);
 config.heights[0]=NaN;assert.equal(sweep.limit(a,b,.3),0,'Nonfinite touched terrain fails closed');
});

test('independent finite-segment distance certifies every returned prefix and detects continuation through terrain',t=>{
 let state=0x58fd35ac;const random=()=>((state=(Math.imul(state,1664525)+1013904223)>>>0)/4294967296);
 let clipped=0,queries=0,worst=Infinity;
 for(let field=0;field<8;field++){
  const config={THREE,heights:Float32Array.from({length:16},()=>random()*8-2),segments:3,step:2,originX:-3,originZ:-3},sweep=createTerrainCameraClearance(config);
  for(let i=0;i<70;i++){
   const a=v(random()*8-4,11+random()*3,random()*8-4),b=v(random()*8-4,random()*10-3,random()*8-4),r=.1+random()*.5,f=sweep.limit(a,b,r),out=a.clone().lerp(b,f);
   assert(f>=0&&f<=1);const d=distance(config,a,out);worst=Math.min(worst,d.distance-r);assert(d.distance>=r-3e-9,'Independent face/endpoint/finite-edge distance detects a penetrating prefix');
   if(f<1){clipped++;const beyond=a.clone().lerp(b,Math.min(1,f+1e-5));assert(distance(config,a,beyond).distance<r+2e-9,'The returned root is a real entering contact');}
   else assert(distance(config,a,b).distance>=r-3e-9);queries++;
  }
 }
 assert(clipped>150);t.diagnostic(JSON.stringify({queries,clipped,worstClearanceRoundoff:worst,reference:'Independent segment/triangle distances, not runtime sweep roots'}));
});

const fixture=JSON.parse(fs.readFileSync(path.join(here,'fixtures/terrain-camera-7039/native-arm.json')));
function nativeFixture(){
 const bytes=Buffer.from(fixture.grid.littleEndianFloat32Base64,'base64');assert.equal(sha(bytes),fixture.grid.bytesSHA256);const heights=new Float32Array(bytes.length/4);for(let i=0;i<heights.length;i++)heights[i]=bytes.readFloatLE(i*4);
 return{THREE,heights,segments:fixture.grid.segments,step:fixture.grid.step,originX:fixture.grid.originX,originZ:fixture.grid.originZ};
}
test('the normally walked actual mounted arm has clear endpoints but requires an early continuous terrain stop',t=>{
 assert.equal(fixture.source.reportSHA256,'83ec3347479af9cf434d096e2700ac8182c51de68ef07ed8bc8a0150c45276f8');assert.equal(fixture.source.canonicalSHA256,'59b9537a0846282f73b5baa5f2fec0b1f6eed2af3fcd865f6a826effdb35ca8d');
 const config=nativeFixture(),a=v(...fixture.arm.origin),b=v(...fixture.arm.end),radius=.3,sweep=createTerrainCameraClearance(config);
 assert(distance(config,a,a).distance>radius);assert(distance(config,b,b).distance>radius);assert(distance(config,a,b).distance<1e-10,'Endpoint-only checks miss the recorded interior crossing');
 const f=sweep.limit(a,b,radius),out=a.clone().lerp(b,f),d=distance(config,a,out);assert(f>0&&f<.12);close(d.distance,radius,3e-10);assert(distance(config,a,a.clone().lerp(b,f+1e-4)).distance<radius);
 // Compact patch is a complete certificate for this arm: every triangle not
 // copied from the native field is farther than radius in X or Z alone.
 const x1=config.originX+config.segments*config.step,z1=config.originZ+config.segments*config.step;
 assert(Math.min(a.x,b.x)-radius>config.originX&&Math.max(a.x,b.x)+radius<x1&&Math.min(a.z,b.z)-radius>config.originZ&&Math.max(a.z,b.z)+radius<z1);
 t.diagnostic(JSON.stringify({fraction:f,wholeArmClearance:d.distance,fixtureBytes:Buffer.from(fixture.grid.littleEndianFloat32Base64,'base64').length,subjectHeight:fixture.producer.actorSubjectHeight}));
});

test('factory and repeated valid queries create no UUID/GPU resources, scratch vectors or ambient random draws',()=>{
 let vectors=0,triangles=0;class Vector3 extends THREE.Vector3{constructor(...args){super(...args);vectors++;}}class Triangle extends THREE.Triangle{constructor(...args){super(...args);triangles++;}}
 const config=nativeFixture(),a=v(...fixture.arm.origin),b=v(...fixture.arm.end),aBefore=a.toArray(),bBefore=b.toArray(),oldRandom=Math.random;
 try{Math.random=()=>{throw Error('Terrain clearance must not draw ambient RNG');};const sweep=createTerrainCameraClearance({...config,THREE:{Vector3,Triangle}}),count=[vectors,triangles];for(let i=0;i<1000;i++)assert(sweep.limit(a,b,.3)>0);assert.deepEqual([vectors,triangles],count);assert.deepEqual(count,[5,1]);}finally{Math.random=oldRandom;}
 assert.deepEqual(a.toArray(),aBefore);assert.deepEqual(b.toArray(),bBefore);assert.equal(TERRAIN_CAMERA_CLEARANCE_PROFILE,'terrain-camera-clearance-1');
});

test('realistic short-arm broadphase remains bounded on the full 512-cell field',t=>{
 const config={THREE,heights:new Float32Array(513*513),segments:512,step:1000/512,originX:-500,originZ:-500},a=v(-142,2,-238),b=v(-139,4,-243),sweep=createTerrainCameraClearance(config);
 for(let i=0;i<1000;i++)sweep.limit(a,b,.3);const begin=performance.now();for(let i=0;i<20000;i++){b.y=i%2?4:1;assert.equal(sweep.limit(a,b,.3),1);}const elapsed=performance.now()-begin;
 assert(elapsed<3000,'Short camera arms must not scan all 524,288 triangles');t.diagnostic(JSON.stringify({queries:20000,elapsedMs:elapsed,fullFieldTriangles:512*512*2}));
});

test('invalid descriptors and nonfinite queries are rejected without touching the terrain',()=>{
 const config=flat();for(const patch of[{segments:0},{step:0},{step:Infinity},{heights:new Float64Array(4)},{heights:new Float32Array(3)},{originX:NaN}])assert.throws(()=>createTerrainCameraClearance({...config,...patch}),TypeError);
 const sweep=createTerrainCameraClearance(config);assert.throws(()=>sweep.limit(v(1,2,3),v(Infinity,2,3),.3),TypeError);assert.throws(()=>sweep.limit(v(1,2,3),v(2,2,3),-.3),TypeError);
});

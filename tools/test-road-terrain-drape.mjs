import test from 'node:test';
import assert from 'node:assert/strict';
import {drapeRoadSurface} from '../assets/road-terrain-drape.mjs';
const step=2,origin=-4,lift=.055;
const corner=(x,z)=>Math.sin(x*.9)*2.5+Math.cos(z*.8)*1.7+Math.sin(x+z);
function terrain(x,z){
 const gx=(x-origin)/step,gz=(z-origin)/step,ix=Math.floor(gx),iz=Math.floor(gz),fx=gx-ix,fz=gz-iz,x0=origin+ix*step,z0=origin+iz*step;
 const a=corner(x0,z0),b=corner(x0,z0+step),c=corner(x0+step,z0+step),d=corner(x0+step,z0);
 return fx+fz<=1?a+(d-a)*fx+(b-a)*fz:c+(b-c)*(1-fx)+(d-c)*(1-fz);
}
function fixture(){
 const points=[[-3.8,-2.9],[-3.1,3.4],[3.7,-2.5],[3.2,3.7]],positions=points.flatMap(([x,z])=>[x,terrain(x,z)+lift,z]);
 return {positions,uv:points.flatMap(([x,z])=>[x*.2+1,z*.1+.5]),colors:points.flatMap(([x,z])=>[.6+x*.04,.5+z*.02,.4,.7+x*.01-z*.02]),strokeMask:[1,1,1,1],indices:[0,1,2,2,1,3],terrainStep:step,origin,heightAt:terrain,lift};
}
const vertex=(mesh,id)=>mesh.positions.slice(id*3,id*3+3);
const area=(a,b,c)=>((b[0]-a[0])*(c[2]-a[2])-(b[2]-a[2])*(c[0]-a[0]))/2;
const triangles=mesh=>Array.from({length:mesh.indices.length/3},(_,i)=>mesh.indices.slice(i*3,i*3+3).map(id=>vertex(mesh,id)));
const near=(a,b,e=2e-5)=>assert.ok(Math.abs(a-b)<e,`${a} differs from ${b}`);
test('every interior road sample retains terrain clearance across cell and diagonal breaks',()=>{
 const source=fixture(),road=drapeRoadSurface(source);let count=0,oldError=0;
 for(const t of triangles(source))for(const w of [[.2,.3,.5],[.6,.2,.2]]){const p=[0,1,2].map(i=>t.reduce((n,v,j)=>n+v[i]*w[j],0));oldError=Math.max(oldError,Math.abs(p[1]-terrain(p[0],p[2])-lift));}
 assert(oldError>.5,'Fixture must reproduce roads cutting through terrain');
 for(const t of triangles(road))for(const w of [[1/3,1/3,1/3],[.1,.4,.5],[.8,.1,.1]]){
  const p=[0,1,2].map(i=>t.reduce((n,v,j)=>n+v[i]*w[j],0));near(p[1]-terrain(p[0],p[2]),lift);count++;
 }
 assert(count>100);
});
test('subdivision preserves projected footprint, winding and affine material attributes',()=>{
 const source=fixture(),road=drapeRoadSurface(source);
 near(triangles(road).reduce((n,t)=>n-area(...t),0),triangles(source).reduce((n,t)=>n-area(...t),0));
 for(const t of triangles(road))assert(area(...t)<0,'Road faces stay upward');
 for(let i=0;i<road.positions.length/3;i++){
  const [x,y,z]=vertex(road,i);near(road.uv[i*2],x*.2+1);near(road.uv[i*2+1],z*.1+.5);
  for(const [k,v]of [.6+x*.04,.5+z*.02,.4,.7+x*.01-z*.02].entries())near(road.colors[i*4+k],v);
  assert.equal(road.strokeMask[i],1);assert(Number.isFinite(y));
 }
});
test('route ranges remain contiguous and shared vertices do not consume random numbers',()=>{
 const f=fixture();f.ranges={first:{indexStart:0,indexCount:3},second:{indexStart:3,indexCount:3}};
 const old=Math.random;Math.random=()=>{throw Error('No random draw permitted');};let road;
 try{road=drapeRoadSurface(f);}finally{Math.random=old;}
 assert.equal(road.ranges.first.indexStart,0);assert.equal(road.ranges.second.indexStart,road.ranges.first.indexCount);
 assert.equal(road.ranges.second.vertexStart,road.ranges.first.vertexCount);
 assert.equal(road.ranges.second.indexStart+road.ranges.second.indexCount,road.indices.length);
 for(const r of Object.values(road.ranges))for(const id of road.indices.slice(r.indexStart,r.indexStart+r.indexCount))assert(id>=r.vertexStart&&id<r.vertexStart+r.vertexCount);
 const flat=drapeRoadSurface(fixture());assert(flat.positions.length/3<flat.indices.length,'Cut vertices are shared within a route');
});
test('canonical grid edge and diagonal triangles keep coverage without zero-area faces',()=>{
 const points=[[-4,-4],[-4,-2],[-2,-4],[-2,-2]];
 const f={...fixture(),positions:points.flatMap(([x,z])=>[x,terrain(x,z)+lift,z])};
 const road=drapeRoadSurface(f);near(triangles(road).reduce((n,t)=>n-area(...t),0),4);
 assert.equal(road.diagnostics.triangles,2);
});
test('invalid geometry and nonfinite terrain fail before emitting corrupt road surfaces',()=>{
 assert.throws(()=>drapeRoadSurface({...fixture(),terrainStep:0}),/sampler/);
 assert.throws(()=>drapeRoadSurface({...fixture(),uv:[]}),/attributes/);
 assert.throws(()=>drapeRoadSurface({...fixture(),heightAt:()=>NaN}),/Nonfinite/);
 assert.throws(()=>drapeRoadSurface({...fixture(),indices:[0,1,500]}),/index/);
 assert.throws(()=>drapeRoadSurface({...fixture(),ranges:{bad:{indexStart:3,indexCount:3}}}),/partition/);
});

test('Float32 clipping never flips a thin valid road sliver',()=>{
 const positions=[-294.2601623535156,0,160.6476593017578,-292.53271484375,0,160.1968536376953,-294.2601623535156,0,160.64764404296875];
 const road=drapeRoadSurface({positions,uv:[0,0,1,0,0,1],colors:Array(12).fill(1),strokeMask:[1,1,1],indices:[0,1,2],terrainStep:1000/512,heightAt:()=>0});
 for(const t of triangles(road))assert(area(...t)<0,'Quantized slivers retain original winding');
 assert.throws(()=>drapeRoadSurface({...fixture(),positions:[Infinity,...fixture().positions.slice(1)]}),/Nonfinite/);
});

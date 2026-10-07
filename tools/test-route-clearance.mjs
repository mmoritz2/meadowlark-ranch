import test from 'node:test';
import assert from 'node:assert/strict';
import {repairRouteClearance} from '../assets/route-clearance.mjs';
const river=x=>120+Math.sin(x*.012)*45;
// Actual overlapping mesa footprints and neighbouring spires from the fixed
// riverwest baseline; independent geometric assertions inspect the whole path.
const mesas=[{x:-191.8227245236306,z:123.56940679465845,r:9.936497785663231},{x:-195.83215084834097,z:125.66595509028143,r:8.406347185221966}];
const nearby=[...mesas,{x:-179.35139523604522,z:127.87522970887497,r:1.2871873571025205},{x:-192.15878691378774,z:130.99680024250225,r:2.245473415749147},{x:-194.13952697635665,z:133.56244292647693,r:1.353468961450271},{x:-184.92810805186593,z:106.31983177290613,r:1.696597412433475}];
const baseline=[[-167.591,120.305],[-169.964,120.49],[-170.97,119.924],[-177.806,119.564],[-178.714,121.157],[-178.956,121.523],[-179.021,121.705],[-179.04,121.578],[-179.287,119.833],[-179.036,120.839],[-178.98,122.016],[-179.11108578737694,123.51466284576354],[-206.70392878487485,129.1169260563309],[-206.818,128.736],[-206.976,128.79],[-207.161,128.919],[-208.695,129.458],[-211.131,130.282],[-213.464,131.086]];
function verify(path,colliders,clearance,isAllowed=()=>true){
 assert(path?.length>=2);
 for(let i=1;i<path.length;i++){
  const a=path[i-1],b=path[i],dx=b[0]-a[0],dz=b[1]-a[1],len2=dx*dx+dz*dz;
  for(const c of colliders){if(c.decor||c.r<=0)continue;const t=Math.max(0,Math.min(1,((c.x-a[0])*dx+(c.z-a[1])*dz)/len2));const gap=Math.hypot(a[0]+dx*t-c.x,a[1]+dz*t-c.z);assert(gap>=c.r+clearance-1e-7,'segment intersects an expanded obstacle');}
  const n=Math.max(1,Math.ceil(Math.sqrt(len2)/.037));for(let k=0;k<=n;k++)assert(isAllowed(a[0]+dx*k/n,a[1]+dz*k/n),'segment crosses disallowed ground');
 }
}
test('overlapping mesa detour clears entire segments, preserves endpoints and input',()=>{
 const copy=structuredClone(baseline),bank=(x,z)=>z-river(x)>=13.85;
 const result=repairRouteClearance(baseline,{colliders:nearby,clearance:3.4,isAllowed:bank});
 assert(result.changed);assert.deepEqual(result.failures,[]);assert.deepEqual(baseline,copy);assert.deepEqual(result.points[0],baseline[0]);assert.deepEqual(result.points.at(-1),baseline.at(-1));verify(result.points,nearby,3.4,bank);
 assert(result.repairedSpans.some(s=>s.startIndex<=11&&s.endIndex>=12),'repair must cover the actual crossed mesa segment');
 for(const span of result.repairedSpans)for(let i=1;i<span.points.length;i++)assert(Math.hypot(span.points[i][0]-span.points[i-1][0],span.points[i][1]-span.points[i-1][1])<=2.6+1e-8);
 assert(result.stats.expanded>0);assert(result.stats.segmentTests>0);assert(result.stats.sampledPoints>0);assert(Number.isFinite(result.stats.elapsedMs)&&result.stats.elapsedMs>=0);
});
test('clear endpoints do not make a segment through a circle passable',()=>{
 const circles=[{x:0,z:0,r:2}],result=repairRouteClearance([[-7,0],[7,0]],{colliders:circles,clearance:1,maxDetour:8});assert(result.changed);verify(result.points,circles,1);
});
test('bank and terrain constraints are checked between grid nodes and shortcut endpoints',()=>{
 const allowed=(x,z)=>z>=1&&!(x>-.15&&x<.15&&z<5),result=repairRouteClearance([[-5,2],[5,2]],{isAllowed:allowed,sampleStep:.1,maxDetour:8});assert(result.changed);verify(result.points,[],0,allowed);
});
test('results are deterministic, including shuffled conservative circle inputs',()=>{
 const options={colliders:nearby,clearance:3.4,isAllowed:(x,z)=>z-river(x)>=13.85};const first=repairRouteClearance(baseline,options);
 const stable=result=>({...result,stats:{...result.stats,elapsedMs:0}});
 assert.deepEqual(stable(repairRouteClearance(baseline,options)),stable(first));assert.deepEqual(stable(repairRouteClearance(baseline,{...options,colliders:nearby.slice().reverse()})),stable(first));
});
test('infeasible constraints and blocked fixed endpoints return no forced route',()=>{
 const wall=(x,z)=>Math.abs(x)>.2;
 const impossible=repairRouteClearance([[-4,0],[4,0]],{isAllowed:wall,sampleStep:.1,maxDetour:6});assert.equal(impossible.points,null);assert.equal(impossible.changed,false);assert.equal(impossible.failures[0].reason,'no-clear-detour');
 const blocked=repairRouteClearance([[0,0],[6,0]],{colliders:[{x:0,z:0,r:1}]});assert.equal(blocked.points,null);assert.equal(blocked.failures[0].reason,'blocked-endpoint');
});
test('bounded search reports exhaustion and clear routes remain exactly unchanged',()=>{
 const clear=[[0,0],[2,1],[5,1],[8,0]],result=repairRouteClearance(clear,{colliders:[{x:4,z:0,r:8,decor:true}]});assert.deepEqual(result.points,clear);assert.equal(result.changed,false);assert.deepEqual(result.repairedSpans,[]);
 const limit=repairRouteClearance([[-8,0],[8,0]],{colliders:[{x:0,z:0,r:3}],maxExpanded:1});assert.equal(limit.points,null);assert.equal(limit.failures[0].reason,'search-limit');
});
test('precise circles remain conservative and caller constraints can reject their real solid extent',()=>{
 const circles=[{x:0,z:0,r:1,precise:true}],allowed=(x,z)=>!(Math.abs(x)<1&&z<4),result=repairRouteClearance([[-6,0],[6,0]],{colliders:circles,clearance:1,isAllowed:allowed,maxDetour:8});assert(result.changed);verify(result.points,circles,1,allowed);
});

test('repair samples honour a caller spacing limit without resampling clear spans',()=>{
 const route=[[-12,0],[-8,0],[8,0],[12,0]],result=repairRouteClearance(route,{colliders:[{x:0,z:0,r:3}],clearance:1,maxSegmentLength:.8});assert(result.changed);assert.deepEqual(result.points.slice(0,2),route.slice(0,2));assert.deepEqual(result.points.at(-1),route.at(-1));
 for(const span of result.repairedSpans)for(let i=1;i<span.points.length;i++)assert(Math.hypot(span.points[i][0]-span.points[i-1][0],span.points[i][1]-span.points[i-1][1])<=.8+1e-8);verify(result.points,[{x:0,z:0,r:3}],1);
});

test('small solid footprints cannot be overlooked between otherwise safe endpoints',()=>{
 const obstacle={x:0,z:0,r:.2},result=repairRouteClearance([[-3,0],[3,0]],{colliders:[obstacle],clearance:.6,maxDetour:3});assert(result.changed);verify(result.points,[obstacle],.6);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {GHOST_LIMIT,createGhostRecording,appendGhostSample,sanitizeGhostRecord,sanitizeGhostSave,interpolateGhost,ghostMatches,acceptGhostFinish,captureGhostPoint,install} from '../assets/features/rush-ghost.js';
const id='rush-pasture',layout='gate:0.0,0.0|gate:30.0,0.0';
function capture(duration=30){const r=createGhostRecording(id,layout);for(let i=0;i<=Math.round(duration*50);i++){const t=i/50;appendGhostSample(r,[t,t*3,0,0,Math.PI/2]);}appendGhostSample(r,[duration,duration*3,0,0,Math.PI/2],true);return r;}
function tape(duration=30){return sanitizeGhostRecord({...capture(duration),time:duration,runId:'genuine-run'});}
function course(){return {ev:{id,rush:true},started:true,idx:2,jumps:[{kind:'gate',x:0,z:0},{kind:'gate',x:30,z:0}]};}
test('a complete physical recording includes the exact finish even after the same tick was observed',()=>{
 const r=createGhostRecording(id,layout);appendGhostSample(r,[0,0,0,0,0]);appendGhostSample(r,[.2,1,0,.7,0]);appendGhostSample(r,[.33,1.6,0,.9,0]);
 assert.equal(r.samples.length,2);appendGhostSample(r,[.33,1.6,0,.9,0],true);
 const result=sanitizeGhostRecord({...r,time:.33,runId:'finish'});assert.ok(result);assert.equal(result.samples.at(-1)[0],.33);assert.equal(result.samples.at(-1)[3],.9);
});
test('long recordings retain the whole journey within the storage cap',()=>{
 const r=capture(1000);assert.ok(r.samples.length<=GHOST_LIMIT);assert.equal(r.samples[0][0],0);assert.equal(r.samples.at(-1)[0],1000);assert.ok(r.step>.2);
 const valid=sanitizeGhostRecord({...r,time:1000,runId:'long'});assert.ok(valid);assert.equal(interpolateGhost(valid,500)[1],1500);
});
test('interpolation preserves jump altitude and takes the short turn across signed pi',()=>{
 const r={time:.2,samples:[[0,0,0,0,Math.PI-.1],[.2,2,4,1.2,-Math.PI+.1]]};
 const p=interpolateGhost(r,.1);assert.deepEqual(p.slice(0,4),[.1,1,2,.6]);assert.ok(Math.abs(Math.abs(p[4])-Math.PI)<1e-9);
 assert.deepEqual(interpolateGhost(r,0),r.samples[0]);assert.deepEqual(interpolateGhost(r,.2),r.samples[1]);assert.equal(interpolateGhost(r,-1),null);assert.equal(interpolateGhost(r,1),null);
});
test('capture follows native rendered jump lift rather than the unrelated generic altitude',()=>{
 const p={pos:{x:1,z:2},y:.1,heading:0,flying:false};
 assert.equal(captureGhostPoint(.2,p,{heroMotion:{},heroJumpExtra:1.4})[3],1.4);
 assert.equal(captureGhostPoint(.2,p,null)[3],.1);
});
test('teleports and reversing the race clock invalidate recording instead of creating a shortcut replay',()=>{
 for(const bad of [[.22,100,0,0,0],[-.01,0,0,0,0],[.2,1,0,Infinity,0]]){
  const r=createGhostRecording(id,layout);appendGhostSample(r,[0,0,0,0,0]);appendGhostSample(r,[.2,1,0,0,0]);appendGhostSample(r,bad);assert.equal(r.invalid,true);
 }
});
test('save loading rejects malformed paths, unsupported IDs, endpoints and excessive data',()=>{
 const valid=tape();assert.ok(valid);
 const cases=[{time:Infinity},{time:-1},{id:'somebody-else'},{layout:''},{step:Infinity},{samples:[]},{samples:Array.from({length:GHOST_LIMIT+1},()=>[0,0,0,0,0])},{samples:[[0,0,0,0,0],[0,1,0,0,0]]},{samples:[[0,0,0,0,0],[30,90,0,0,0]]},{samples:valid.samples.map((p,i)=>i===2?[p[0],NaN,...p.slice(2)]:p)},{samples:valid.samples.slice(0,-1)}];
 for(const change of cases)assert.equal(sanitizeGhostRecord({...valid,...change}),null);
 const saved=sanitizeGhostSave({version:1,enabled:false,records:{[id]:valid,unknown:valid,'rush-river':valid}});
 assert.deepEqual(Object.keys(saved.records),[id]);assert.equal(saved.enabled,false);assert.deepEqual(sanitizeGhostSave({version:99,records:{[id]:valid}}).records,{});
 valid.samples[0][1]=999;assert.equal(saved.records[id].samples[0][1],0,'safe copy never retains externally mutable samples');
});
test('a replay is only usable for its matching actual course layout and current fastest time',()=>{
 const r=tape(),best={layout,bestTime:30};assert.equal(ghostMatches(r,best,layout),true);
 assert.equal(ghostMatches(r,{...best,bestTime:29},layout),false);assert.equal(ghostMatches(r,best,layout+'changed'),false);assert.equal(ghostMatches(r,null,layout),false);
});
test('only the accepted finished course and persisted PB can authorize a new replay',()=>{
 const recording=capture(),c=course(),result={id,layout,runId:'new',time:30,newBestTime:true},context={lastResult:result,course:c,current:c,best:{layout,bestTime:30}};
 assert.ok(acceptGhostFinish(recording,result,context));
 assert.equal(acceptGhostFinish(recording,{...result},context),null,'identical-looking synthetic result is not the accepted object');
 assert.equal(acceptGhostFinish(recording,result,{...context,current:null}),null);
 assert.equal(acceptGhostFinish(recording,result,{...context,current:{...c}}),null);
 assert.equal(acceptGhostFinish(recording,result,{...context,best:{layout,bestTime:20}}),null);
 c.idx=1;assert.equal(acceptGhostFinish(recording,result,context),null);c.idx=2;
 assert.equal(acceptGhostFinish({...recording,invalid:true},result,context),null);
 assert.equal(acceptGhostFinish(recording,null,context),null);
});
test('slower runs cannot overwrite the earlier fastest replay',()=>{
 const original=tape(25),slow=capture(30),c=course(),result={id,layout,runId:'slow',time:30,newBestTime:false};
 assert.equal(acceptGhostFinish(slow,result,{lastResult:result,course:c,current:c,best:{layout,bestTime:25},existing:original}),null);
 const tie={id,layout,runId:'tie',time:25,newBestTime:false};
 assert.equal(acceptGhostFinish(capture(25),tie,{lastResult:tie,course:c,current:c,best:{layout,bestTime:25},existing:original}),null);
 assert.ok(acceptGhostFinish(capture(25),tie,{lastResult:tie,course:c,current:c,best:{layout,bestTime:25}}),'an actual tied PB can fill a missing tape');
});
test('live observer saves once after accepted completion, never per frame; cancellation preserves the tape',()=>{
 const previousDocument=globalThis.document;globalThis.document={body:{classList:{contains:()=>false}}};
 try{
  const hooks={},state={rushGhost:{version:1,enabled:false,records:{}}};let writes=0,c=course(),active={id,elapsed:0},lastResult=null,best={};
  const P={pos:{x:0,z:0},y:0,heading:Math.PI/2},G={THREE:{},horse:{player:P,RIG:()=>null},scene:{remove(){}},save:{fresh:()=>structuredClone(state),ensure:fn=>fn(state),sync:fn=>{writes++;fn(state)}},world:{groundH:()=>0},course:{get:()=>c},on:(name,fn)=>(hooks[name]||=[]).push(fn),ranchRush:{snapshot:()=>({active,records:best}),get lastResult(){return lastResult;}}};
  const emit=(name,...args)=>{for(const fn of hooks[name]||[])fn(...args)};
  install(G);emit('courseStart',c);for(let i=0;i<=500;i++){active.elapsed=i/50;P.pos.x=i*.06;emit('tick');}
  assert.equal(writes,0);assert.equal(G.rushGhost.snapshot().recording,true);
  lastResult={id,layout,runId:'real-observed',time:10,newBestTime:true};best[id]={layout,bestTime:10};active=null;emit('rushFinish',lastResult);
  assert.equal(writes,1);assert.equal(state.rushGhost.records[id].time,10);assert.equal(G.rushGhost.snapshot().recording,false);
  const before=JSON.stringify(state.rushGhost.records);c=course();active={id,elapsed:0};P.pos.x=0;emit('courseStart',c);c=null;emit('tick');
  assert.equal(JSON.stringify(state.rushGhost.records),before);assert.equal(writes,1);assert.equal(G.rushGhost.snapshot().active,null);
  assert.equal(G.rushGhost.setEnabled(false),false);assert.equal(state.rushGhost.enabled,false);
 }finally{globalThis.document=previousDocument;}
});

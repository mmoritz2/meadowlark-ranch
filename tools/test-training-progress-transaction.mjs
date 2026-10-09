import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../ranch3d.html',import.meta.url),'utf8');
const section=(a,b)=>{const start=source.indexOf(a),end=source.indexOf(b,start);assert(start>=0&&end>start);return source.slice(start,end);};
const registry=section('const TRAINING_PROGRESS=new Map();','const MULS={};');
const makeRegistry=()=>{const G={};new Function('G',registry)(G);return G.trainingProgress;};
test('training reducers run on one supplied draft, return summaries, and never auto-confirm',()=>{
 const p=makeRegistry(),save={n:0},receipt={runId:'one'},events=[{type:'cleanjump',value:2}],confirmed=[];
 p.register('first',(s,e,r)=>{assert.equal(s,save);assert.equal(e,events);assert.equal(r,receipt);s.n+=e[0].value;return {n:s.n};},(summary,r)=>confirmed.push([summary.n,r.runId]));
 p.register('second',s=>{s.n++;return {n:s.n};});
 const modules=p.apply(save,events,receipt);assert.equal(save.n,3);assert.deepEqual(modules,{first:{n:2},second:{n:3}});assert.deepEqual(confirmed,[]);
 p.confirmed({...receipt,progress:{modules}});assert.deepEqual(confirmed,[[2,'one']]);
});
test('reducer errors propagate and stop later rewards rather than being swallowed by the event bus',()=>{
 const p=makeRegistry();let reached=false;
 p.register('bad',()=>{throw Error('reward unavailable');});p.register('later',()=>{reached=true;});
 assert.throws(()=>p.apply({},[],{}),/reward unavailable/);assert.equal(reached,false);
 assert.throws(()=>p.register('bad',()=>{}),/Invalid training progress reducer/);
 assert.throws(()=>p.register('missing',null),/Invalid training progress reducer/);
});
const aliases=section('function dailyTypeAliases(type){','const _dailyMemo=');
const daily=section('function todayDailyRoll(ds){','function dailyEvt(type,val){');
const dailyRows=[{type:'cleanjump',goal:5,label:'Five clean jumps'},{type:'sxp',goal:1,label:'Raise a stat'},{type:'gallop',goal:800,label:'Gallop'},{type:'gallop2k',goal:2000,label:'Gallop far'},{type:'feed',goal:3,label:'Feed'},{type:'feed6',goal:6,label:'Feed more'}];
const apply=new Function('DAILYQ','DAILY_N',aliases+daily+'return applyDailyProgress;')(dailyRows,4);
const fixture=()=>({dq:{date:new Date().toDateString(),roll:dailyRows.map(q=>q.type),prog:{},claimed:{}},life:{since:42}});
test('one reducer credits active dailies and lifetime progress without claiming a reward',()=>{
 const s=fixture();assert.deepEqual(apply(s,'cleanjump',2),[]);assert.equal(s.dq.prog.cleanjump,2);assert.equal(s.life.cleanjump,2);
 assert.deepEqual(apply(s,'cleanjump',8),[{type:'cleanjump',label:'Five clean jumps'}]);assert.equal(s.dq.prog.cleanjump,5);assert.equal(s.life.cleanjump,10);assert.deepEqual(s.dq.claimed,{});
 assert.deepEqual(apply(s,'cleanjump',1),[]);assert.equal(s.life.cleanjump,11);assert.equal(s.dq.prog.cleanjump,5);
 assert.deepEqual(apply(s,'sxp',2),[{type:'sxp',label:'Raise a stat'}]);assert.equal(s.dq.prog.sxp,1);assert.equal(s.life.sxp,2);
});
test('claimed goals stay claimed and aliases preserve independent long-haul goals',()=>{
 const s=fixture();s.dq.claimed.gallop=true;s.dq.prog.gallop=800;
 apply(s,'gallop',1000);assert.equal(s.dq.prog.gallop,800);assert.equal(s.dq.prog.gallop2k,1000);assert.equal(s.life.gallop,1000);
 assert.deepEqual(apply(s,'feed',6).map(q=>q.type),['feed','feed6']);assert.equal(s.life.feed,6);
});
test('unselected daily types still count for lifetime while rollovers choose one stable new roll',()=>{
 const s=fixture();s.dq.roll=['feed'];apply(s,'cleanjump',2);assert.equal(s.dq.prog.cleanjump,undefined);assert.equal(s.life.cleanjump,2);
 s.dq.date='old day';apply(s,'drill',1);assert.equal(s.dq.date,new Date().toDateString());assert.equal(s.dq.roll.length,4);assert.deepEqual(s.dq.claimed,{});
 const roll=[...s.dq.roll];apply(s,'drill',1);assert.deepEqual(s.dq.roll,roll);assert.equal(s.life.drill,2);
});

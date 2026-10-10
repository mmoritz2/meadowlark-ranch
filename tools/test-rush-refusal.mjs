import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('../assets/features/events2-disciplines.js',import.meta.url),'utf8');
const start=source.indexOf(' function priceGrades(c){');
const end=source.indexOf(' /* A gate cannot be marked',start);
assert(start>=0&&end>start,'extract the production grade pricing and elimination functions');
const pricingCode=source.slice(start,end);

function fixture({ev={rush:true},current={}}={}){
 const CUR={lastGrades:0,refuseAt:{},fenceFaults:0,xcJump:0,elim:false,...current};
 const c={ev,idx:0,jumps:[{fenceMul:1},{fenceMul:1.5}],ce:{grades:[],lap:1},done:false};
 const trace={coins:[],notices:[],timers:[],cancellations:0,course:c};
 const G={money:{addCoins:n=>trace.coins.push(n)},course:{cancelCourse(){trace.cancellations++;trace.course=null;}}};
 const price=Function('CUR','G','toast','setTimeout',pricingCode+'return priceGrades;')(
  CUR,G,message=>trace.notices.push(message),(callback,delay)=>trace.timers.push({callback,delay}),
 );
 const observe=()=>price(c);
 const append=grade=>{c.ce.grades.push(grade);observe();};
 const flush=()=>{for(const timer of trace.timers.splice(0))timer.callback();};
 return {CUR,c,trace,observe,append,flush};
}

function assertActive(f){
 assert.equal(f.CUR.elim,false);
 assert.equal(f.c.done,false);
 assert.equal(f.trace.course,f.c,'the current course remains playable');
 assert.equal(f.trace.cancellations,0);
 assert.deepEqual(f.trace.coins,[],'Rush refusals never award the formal consolation purse');
 assert.deepEqual(f.trace.notices,[],'Rush must not show the formal elimination message');
 assert.deepEqual(f.trace.timers,[],'no delayed course cancellation is scheduled');
}

test('Rush third and fourth refusals preserve the course while accumulating every penalty',()=>{
 const f=fixture();
 for(const [i,expected] of [[1,[4,20]],[2,[12,60]],[3,[20,100]],[4,[28,140]]]){
  f.append('refusal');
  assert.equal(f.CUR.refuseAt['1:0'],i);
  assert.equal(f.CUR.lastGrades,i);
  assert.equal(f.CUR.fenceFaults,expected[0]);
  assert.equal(f.CUR.xcJump,expected[1]);
  assert.equal(f.c.idx,0,'a refusal does not advance the current obstacle');
  assertActive(f);
  f.flush();assertActive(f);
 }
});

test('observing the same Rush grades again cannot reprice or increment refusals',()=>{
 const f=fixture();
 f.c.ce.grades.push('refusal','refusal','refusal','refusal');f.observe();
 const before=structuredClone(f.CUR);
 for(let i=0;i<5;i++)f.observe();
 assert.deepEqual(f.CUR,before);
 assertActive(f);
});

test('formal third refusal eliminates once, pays exactly 60 coins and cancels asynchronously',()=>{
 const f=fixture({ev:{id:'formal-jumping'}});
 f.append('refusal');f.append('refusal');assertActive(f);
 f.append('refusal');
 assert.equal(f.CUR.elim,true);
 assert.equal(f.CUR.refuseAt['1:0'],3);
 assert.equal(f.CUR.fenceFaults,20);assert.equal(f.CUR.xcJump,100);
 assert.deepEqual(f.trace.coins,[60]);
 assert.equal(f.trace.notices.length,1);assert.match(f.trace.notices[0],/eliminated/);
 assert.equal(f.trace.course,f.c,'cancellation waits for the scheduled callback');
 assert.equal(f.trace.timers.length,1);assert.equal(f.trace.timers[0].delay,0);
 f.observe();f.observe();
 assert.equal(f.CUR.refuseAt['1:0'],3,'duplicate observations cannot count another refusal');
 f.append('refusal');
 assert.equal(f.CUR.refuseAt['1:0'],4);
 assert.equal(f.CUR.fenceFaults,28);assert.equal(f.CUR.xcJump,140);
 assert.deepEqual(f.trace.coins,[60]);assert.equal(f.trace.notices.length,1);
 assert.equal(f.trace.timers.length,1,'later grades cannot schedule a second elimination');
 f.flush();f.flush();
 assert.equal(f.trace.cancellations,1);assert.equal(f.trace.course,null);
});

test('an absent event or explicit false Rush flag keeps the formal elimination rule',()=>{
 for(const ev of [null,{}, {rush:false}]){
  const f=fixture({ev});
  f.c.ce.grades.push('refusal','refusal','refusal');f.observe();f.flush();
  assert.equal(f.CUR.elim,true);assert.deepEqual(f.trace.coins,[60]);
  assert.equal(f.trace.cancellations,1);
 }
});

test('Rush continues pricing scaled rail faults and counts refusals per obstacle and lap',()=>{
 const f=fixture();
 f.append('refusal');f.append('refusal');
 f.c.idx=1;f.append('refusal');
 f.c.ce.lap=2;f.append('refusal');
 assert.deepEqual(f.CUR.refuseAt,{'1:0':2,'1:1':1,'2:1':1});
 assert.equal(f.CUR.fenceFaults,20);assert.equal(f.CUR.xcJump,100);
 // The course engine has already advanced after a rail fault; price the prior fence.
 f.c.idx=0;f.append('fault');
 assert.equal(f.CUR.fenceFaults,26);assert.equal(f.CUR.xcJump,117);
 const before=structuredClone(f.CUR);f.observe();assert.deepEqual(f.CUR,before);
 assertActive(f);
});

test('previously observed grades and existing penalties survive a later Rush refusal',()=>{
 const f=fixture({current:{lastGrades:2,refuseAt:{'1:0':2},fenceFaults:19,xcJump:71}});
 f.c.ce.grades.push('refusal','refusal','refusal');f.observe();
 assert.equal(f.CUR.refuseAt['1:0'],3);
 assert.equal(f.CUR.fenceFaults,27);assert.equal(f.CUR.xcJump,111);
 assert.equal(f.CUR.lastGrades,3);
 f.observe();assert.equal(f.CUR.fenceFaults,27);assert.equal(f.CUR.refuseAt['1:0'],3);
 assertActive(f);
});

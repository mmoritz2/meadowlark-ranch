import test from 'node:test';
import assert from 'node:assert/strict';
import {ROUNDUP_MODES,createRoundupFinish,saveRoundupFinish} from '../assets/roundup-rewards.mjs';

const proof=(overrides={})=>createRoundupFinish({runId:'first-herd',mode:'beginner',penned:3,time:70,remaining:50,at:1000,...overrides});
function fixture(initial={}){
 let stored=JSON.stringify({coins:7,gems:2,keys:1,...initial}),failure=null,readsFail=false,failReads=0;
 const trace={attempts:0,writes:0,applies:0};
 const storage={fresh(){if(readsFail||failReads-->0)throw Error('read unavailable');return JSON.parse(stored);},sync(fn){
  const s=JSON.parse(stored);fn(s);trace.attempts++;
  if(failure==='write')throw Error('storage full');
  stored=JSON.stringify(s);trace.writes++;
  if(failure==='readback')readsFail=true;
  if(failure==='after-write')throw Error('wrapper failed after write');
 }};
 const apply=(s,r)=>{trace.applies++;s.coins+=r.pay;s.gems+=r.gems;s.keys+=r.keys;return {passPoints:r.penned*6,progress:{rounded:r.penned}};};
 return {storage,trace,apply,get save(){return JSON.parse(stored);},get bytes(){return stored;},set failure(v){failure=v;},set readsFail(v){readsFail=v;},failReads(n){failReads=n;},finish(p=proof(),fn=apply){return saveRoundupFinish(storage,{proof:p},fn);}};
}

test('authored modes preserve existing full-herd payouts and clocks',()=>{
 assert.deepEqual(ROUNDUP_MODES,{beginner:{name:'Gentle Roundup',n:3,time:120},full:{name:'Full Herd',n:5,time:150}});
 const easy=proof(),full=proof({mode:'full',penned:5,time:100,remaining:50});
 assert.deepEqual([easy.pay,easy.gems,easy.keys,easy.score,easy.medal],[540,1,0,1150,'gold']);
 assert.deepEqual([full.pay,full.gems,full.keys,full.score,full.medal],[900,2,1,1750,'silver']);
 assert(Object.isFrozen(easy));assert(Object.isFrozen(ROUNDUP_MODES.full));
 assert.throws(()=>{easy.penned=0;},TypeError);
});

test('expired partial and empty rounds earn only their real penned horses',()=>{
 const partial=proof({penned:2,time:120,remaining:0}),empty=proof({penned:0,time:120,remaining:0});
 assert.deepEqual([partial.pay,partial.gems,partial.keys,partial.score,partial.medal],[260,0,0,600,'bronze']);
 assert.deepEqual([empty.pay,empty.gems,empty.keys,empty.score,empty.medal],[0,0,0,0,'none']);
});

test('unfinished, nonfinite, impossible and unknown result proofs are rejected',()=>{
 for(const changes of [{penned:2},{mode:'constructor'},{mode:'missing'},{runId:''},{runId:' '},{runId:'a'.repeat(161)},{penned:-1},{penned:4},{penned:2.5},{time:NaN},{time:Infinity},{time:-1},{time:121},{remaining:Infinity},{remaining:-1},{remaining:121},{time:40},{at:0},{at:NaN}])assert.equal(proof(changes),null,JSON.stringify(changes));
 assert.equal(createRoundupFinish(),null);
});

test('time quantization leaves exact medal boundary authoritative',()=>{
 const silver=proof({time:78.05,remaining:41.95}),gold=proof({time:77.95,remaining:42.05});
 assert.equal(silver.score,1110);assert.equal(gold.score,1110);assert.equal(silver.medal,'silver');assert.equal(gold.medal,'gold');
 const fractional=proof({time:77.95431,remaining:42.04569});assert.equal(fractional.time,77.95);assert.equal(fractional.remaining,42.04569);
 assert.equal(fixture().finish(fractional).ok,true,'rounded proof remains valid on retry');
});

test('one write saves rewards, receipt and best records together without changing unrelated data',()=>{
 const f=fixture({roundupBest:{beginner:{plays:2,score:100,penned:1,time:null,medal:'bronze',extra:'keep'},full:{plays:8,score:1950,penned:5,time:60,medal:'gold'}},claims:{legacy:true}});
 const out=f.finish();assert.equal(out.ok,true);assert.equal(out.result.saved,true);assert.equal(out.result.runId,'first-herd');
 assert.deepEqual([f.save.coins,f.save.gems,f.save.keys],[547,3,1]);assert.equal(f.trace.writes,1);
 assert.deepEqual(f.save.claims,{legacy:true});assert.equal(f.save.roundupBest.full.plays,8);assert.equal(f.save.roundupBest.beginner.extra,'keep');
 assert.equal(f.save.roundupBest.beginner.plays,3);assert.equal(f.save.roundupBest.beginner.lastRunId,'first-herd');
 assert.deepEqual(out.result.progress,{rounded:3});assert.equal(out.result.previousBestMedal,'bronze');assert.equal(out.result.previousBestTime,null);assert.equal(out.result.newBestTime,true);
 assert.deepEqual(out.saved,f.save);
});

test('better medal is stored even when rounded scores tie',()=>{
 const f=fixture();f.finish(proof({runId:'silver',time:78.05,remaining:41.95}));
 const out=f.finish(proof({runId:'gold',time:77.95,remaining:42.05,at:2000}));
 assert.equal(out.ok,true);assert.equal(out.result.newBestScore,false);assert.equal(out.result.newBestMedal,true);assert.equal(out.result.previousBestMedal,'silver');
 assert.equal(f.save.roundupBest.beginner.medal,'gold');assert.equal(f.save.roundupBest.beginner.score,1110);
});

test('later partial results preserve the full-herd medal, fastest time and score',()=>{
 const f=fixture();f.finish();const best=f.save.roundupBest.beginner;
 const out=f.finish(proof({runId:'partial',penned:1,time:120,remaining:0,at:2000}));
 assert.equal(out.result.newBestMedal,false);assert.equal(out.result.newBestScore,false);assert.equal(out.result.newBestTime,false);
 assert.deepEqual({...f.save.roundupBest.beginner,plays:best.plays,lastRunId:best.lastRunId},best);
});

test('a rejected write leaves every saved field unchanged and explicit retry pays once',()=>{
 const f=fixture(),before=f.bytes;f.failure='write';const failed=f.finish();assert.equal(failed.ok,false);assert.match(failed.reason,/storage full/);assert.equal(f.bytes,before);
 f.failure=null;assert.equal(f.finish().ok,true);assert.equal(f.trace.writes,1);assert.equal(f.save.coins,547);assert.equal(f.save.roundupBest.beginner.plays,1);
 const after=f.bytes;assert.equal(f.finish().ok,true);assert.equal(f.bytes,after);assert.equal(f.trace.writes,1);assert.equal(f.trace.applies,2,'failed draft and one committed draft only');
});

test('a throwing storage wrapper after commit still confirms the durable receipt',()=>{
 const f=fixture();f.failure='after-write';const out=f.finish();assert.equal(out.ok,true);assert.equal(f.trace.writes,1);assert.equal(f.trace.applies,1);assert.equal(f.save.coins,547);
 assert.equal(f.finish().ok,true);assert.equal(f.trace.writes,1);
});

test('unreadable confirmation stays pending then recovers without a second payment',()=>{
 const f=fixture();f.failure='readback';assert.equal(f.finish().ok,false);const committed=f.bytes;
 assert.equal(f.save.coins,547);assert.equal(f.trace.writes,1);
 f.failure=null;f.readsFail=false;assert.equal(f.finish().ok,true);assert.equal(f.bytes,committed);assert.equal(f.trace.applies,1);assert.equal(f.trace.writes,1);
});

test('failed first receipt read cannot bypass transaction-level duplicate protection',()=>{
 const f=fixture();f.finish();const committed=f.bytes;f.failReads(1);
 assert.equal(f.finish().ok,true);assert.equal(f.bytes,committed);assert.equal(f.trace.applies,1);assert.equal(f.save.roundupBest.beginner.plays,1);
});

test('old run receipts stay acknowledged after many later rounds',()=>{
 const f=fixture();f.finish();for(let i=0;i<30;i++)assert.equal(f.finish(proof({runId:'next-'+i,at:2000+i})).ok,true);
 const after=f.bytes,count=f.trace.writes;assert.equal(f.finish().ok,true);assert.equal(f.bytes,after);assert.equal(f.trace.writes,count);assert.equal(Object.keys(f.save.roundupRewards.receipts).length,31);
});

test('conflicting receipt identities reject payment rather than overwrite a completed run',()=>{
 const f=fixture();f.finish();const before=f.bytes;
 const other=proof({time:80,remaining:40});const out=f.finish(other);assert.equal(out.ok,false);assert.match(out.reason,/different saved result/);assert.equal(f.bytes,before);assert.equal(f.trace.applies,1);
});

test('recomputed proof refuses mutated payout, count, medal and time fields',()=>{
 for(const changes of [{pay:9999},{gems:10},{keys:10},{total:100},{score:1234},{medal:'silver'},{time:70.0001}]){
  const f=fixture(),out=f.finish({...proof(),...changes});assert.equal(out.ok,false);assert.equal(f.trace.applies,0);assert.equal(f.trace.writes,0);
 }
});

test('reward callback cannot replace proof identity and receipt is detached from live details',()=>{
 const f=fixture(),details={runId:'forged',penned:0,pay:9000,saved:false,progress:{rounded:3}};
 const out=f.finish(proof(),(s,r)=>{f.apply(s,r);return details;});
 assert.equal(out.ok,true);assert.equal(out.result.runId,'first-herd');assert.equal(out.result.pay,540);assert.equal(out.result.saved,true);
 details.progress.rounded=90;assert.equal(out.result.progress.rounded,3);assert.equal(f.save.roundupRewards.lastResult.progress.rounded,3);
});

test('missing or throwing reward reducer rolls the whole draft back',()=>{
 for(const callback of [()=>null,(s)=>{s.coins+=500;throw Error('progress unavailable');},()=>{const a={};a.self=a;return a;}]){
  const f=fixture(),before=f.bytes;assert.equal(f.finish(proof(),callback).ok,false);assert.equal(f.bytes,before);assert.equal(f.trace.writes,0);
 }
});

test('malformed legacy records normalize without losing separate claimed data',()=>{
 const f=fixture({roundupBest:{beginner:{plays:-4,score:'wrong',penned:NaN,time:-2,medal:'mythic'}},roundupRewards:{receipts:[],legacyClaim:true}});
 assert.equal(f.finish().ok,true);assert.equal(f.save.roundupBest.beginner.plays,1);assert.equal(f.save.roundupBest.beginner.medal,'gold');assert.equal(f.save.roundupRewards.legacyClaim,true);
});

test('special run identifiers become own receipt keys without prototype mutation',()=>{
 const f=fixture();for(const runId of ['__proto__','constructor'])assert.equal(f.finish(proof({runId})).ok,true);
 const records=f.save.roundupRewards.receipts;assert(Object.hasOwn(records,'__proto__'));assert(Object.hasOwn(records,'constructor'));assert.equal(records.__proto__.runId,'__proto__');assert.equal({}.saved,undefined);
});

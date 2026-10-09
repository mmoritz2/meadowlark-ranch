import test from 'node:test';
import assert from 'node:assert/strict';
import {saveWildTaming,wildTamingInteraction} from '../assets/features/wild-taming-rules.mjs';
const clone=v=>structuredClone(v);
function fixture(mode=null){
 let stored={horses:[],nextId:1,coins:10,gems:0,pass:{pts:0},stats:{tamedWild:0},story:{prog:0},life:{tame:0},sanctuary:[]},calls=0,writes=0,reads=0,readFail=false;
 const storage={fresh(){reads++;if(readFail)throw Error('cannot read');return clone(stored);},sync(fn){try{
  const draft=clone(stored);fn(draft);if(mode==='write')throw Error('quota');stored=draft;writes++;
  if(mode==='readback')readFail=true;if(mode==='after-write')throw Error('wrapper error');
 }catch{}}};
 const apply=(s,p)=>{calls++;s.stats.tamedWild++;s.life.tame++;s.story.prog++;s.pass.pts+=40;s.gems++;
  if(p.choice==='home'){const horse={id:s.nextId++,name:'Misty'};s.horses.push(horse);return {horseId:horse.id,name:horse.name,pay:{g:1,p:40}};}
  s.coins+=150;if(p.choice==='sanctuary')s.sanctuary.push({name:'Misty'});return {pay:{c:150,g:1,p:40}};};
 return {storage,apply,get saved(){return clone(stored);},get calls(){return calls;},get writes(){return writes;},get reads(){return reads;},set mode(v){mode=v;},set readFail(v){readFail=v;}};
}
const pending=(runId='wild-one',choice='home')=>({runId,choice});

test('trust must reach100 and the rider must stop within the actual5.5m reach',()=>{
 const ready={trust:100,distance:5.5,speed:1.19};assert.equal(wildTamingInteraction(ready).eligible,true);
 for(const patch of [{trust:99.99},{distance:5.5001},{distance:-1},{speed:1.2},{speed:-1.2},{blocked:true},{flee:true},{trust:NaN},{distance:Infinity},{speed:NaN}])assert.equal(wildTamingInteraction({...ready,...patch}).eligible,false,JSON.stringify(patch));
 assert.equal(wildTamingInteraction({...ready,speed:-1.19}).eligible,true);assert.equal(wildTamingInteraction({trust:60,distance:2,speed:0}).status,'trust');
 assert.equal(wildTamingInteraction(ready).label,'Choose a home');assert.equal(wildTamingInteraction().eligible,false);
});
test('an earned home choice saves horse, reward, progress and receipt together',()=>{
 const f=fixture(),p=pending(),r=saveWildTaming(f.storage,p,f.apply);
 assert.equal(r.ok,true);assert.equal(f.calls,1);assert.equal(f.writes,1);assert.equal(r.result.saved,true);assert.equal(r.result.runId,p.runId);assert.equal(r.result.choice,'home');
 assert.equal(r.result.horseId,1);assert.equal(p.horseId,1);assert.equal(f.saved.horses.length,1);assert.equal(f.saved.stats.tamedWild,1);assert.equal(f.saved.life.tame,1);assert.equal(f.saved.story.prog,1);assert.equal(f.saved.pass.pts,40);
 assert.deepEqual(r.saved,f.saved);assert.deepEqual(p.result,r.result);assert.deepEqual(f.saved.wildTaming.receipts[p.runId],r.result);
});
test('a failed write keeps all persisted values untouched and remains retryable',()=>{
 const f=fixture('write'),p=pending(),before=f.saved;
 const failed=saveWildTaming(f.storage,p,f.apply);assert.equal(failed.ok,false);assert.deepEqual(f.saved,before);assert.equal(f.writes,0);assert.equal(p.result.saved,false);assert.equal(p.lockedChoice,'home');
 f.mode=null;const r=saveWildTaming(f.storage,p,f.apply);assert.equal(r.ok,true);assert.equal(f.writes,1);assert.equal(f.saved.horses.length,1);assert.equal(f.saved.nextId,2);assert.equal(f.saved.pass.pts,40);assert.equal(f.saved.story.prog,1);
});
test('a wrapper throwing after writing succeeds only through persisted readback',()=>{
 const f=fixture('after-write'),p=pending();const r=saveWildTaming(f.storage,p,f.apply);
 assert.equal(r.ok,true);assert.equal(f.calls,1);assert.equal(f.writes,1);assert.equal(r.result.horseId,1);
 const saved=f.saved;saveWildTaming(f.storage,p,f.apply);assert.equal(f.calls,1);assert.equal(f.writes,1);assert.deepEqual(f.saved,saved);
});
test('unconfirmed readback followed by recovery acknowledges once without regranting',()=>{
 const f=fixture('readback'),p=pending();assert.equal(saveWildTaming(f.storage,p,f.apply).ok,false);
 const saved=f.saved;assert.equal(saved.horses.length,1);assert.equal(p.result.saved,false);
 f.mode=null;f.readFail=false;const result=saveWildTaming(f.storage,p,f.apply);
 assert.equal(result.ok,true);assert.equal(f.calls,1);assert.equal(f.writes,1);assert.deepEqual(f.saved,saved);assert.equal(p.result.saved,true);
});
test('an old run replay after another encounter never creates a second horse or reward',()=>{
 const f=fixture(),one=pending('one'),two=pending('two','sanctuary');
 saveWildTaming(f.storage,one,f.apply);saveWildTaming(f.storage,two,f.apply);const saved=f.saved;
 const r=saveWildTaming(f.storage,pending('one'),f.apply);
 assert.equal(r.ok,true);assert.equal(r.result.horseId,1);assert.equal(f.calls,2);assert.equal(f.writes,2);assert.deepEqual(f.saved,saved);assert.equal(f.saved.wildTaming.lastResult.runId,'two');
});
test('choice stays locked after a failed attempt and cannot change on a saved replay',()=>{
 const f=fixture('write'),p=pending();saveWildTaming(f.storage,p,f.apply);p.choice='sanctuary';
 assert.equal(saveWildTaming(f.storage,p,f.apply).ok,false);assert.equal(f.calls,1);assert.equal(f.saved.stats.tamedWild,0);
 p.choice='home';f.mode=null;assert.equal(saveWildTaming(f.storage,p,f.apply).ok,true);const saved=f.saved;
 assert.equal(saveWildTaming(f.storage,pending('wild-one','sanctuary'),f.apply).ok,false);assert.deepEqual(f.saved,saved);assert.equal(f.calls,2);
});
test('canceling before choosing neither locks the encounter nor calls storage',()=>{
 const f=fixture();for(const p of [null,{}, {runId:'one'},pending('','home'),pending('one','cancel')])assert.equal(saveWildTaming(f.storage,p,f.apply).ok,false);
 assert.equal(f.calls,0);assert.equal(f.writes,0);assert.equal(f.reads,0);
 const p={runId:'one',choice:null};saveWildTaming(f.storage,p,f.apply);assert.equal(p.lockedChoice,undefined);p.choice='sanctuary';assert.equal(saveWildTaming(f.storage,p,f.apply).ok,true);
});
test('throwing, absent or unserializable callback receipts abort the whole draft',()=>{
 for(const apply of [s=>{s.coins+=99;throw Error('grant failed');},s=>{s.coins+=99;return null;},s=>{s.coins+=99;const r={};r.self=r;return r;},s=>{s.coins+=99;return {horseId:999};}]){
  const f=fixture(),before=f.saved;assert.equal(saveWildTaming(f.storage,pending(),apply).ok,false);assert.deepEqual(f.saved,before);assert.equal(f.writes,0);
 }
});
test('sanctuary and helper receipts are independent durable outcomes',()=>{
 const f=fixture();const sanctuary=saveWildTaming(f.storage,pending('sanctuary','sanctuary'),f.apply),helper=saveWildTaming(f.storage,pending('helper','helper'),f.apply);
 assert.equal(sanctuary.ok,true);assert.equal(helper.ok,true);assert.equal(f.saved.horses.length,0);assert.equal(f.saved.sanctuary.length,1);assert.equal(f.saved.stats.tamedWild,2);assert.equal(f.saved.coins,310);assert.equal(f.saved.pass.pts,80);
 saveWildTaming(f.storage,pending('helper','helper'),f.apply);assert.equal(f.calls,2);
});
test('receipt identity cannot be overwritten by callback fields or inherited object properties',()=>{
 const f=fixture();const p=pending('__proto__','sanctuary');const r=saveWildTaming(f.storage,p,s=>{s.coins++;return {runId:'wrong',choice:'home',saved:false};});
 assert.equal(r.ok,true);assert.equal(r.result.runId,'__proto__');assert.equal(r.result.choice,'sanctuary');assert.equal(r.result.saved,true);
 assert.equal(Object.hasOwn(f.saved.wildTaming.receipts,'__proto__'),true);
 assert.equal(saveWildTaming(f.storage,pending('__proto__','sanctuary'),()=>{throw Error('duplicate');}).ok,true);
});

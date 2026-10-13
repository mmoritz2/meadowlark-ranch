import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createSaveStore,encodeSnapshot} from '../mobile/src/save-store.mjs';
import {confirmGameSave} from '../mobile/src/save-confirmation.mjs';

// Execute the actual feature handlers. Storage, UI and audio boundaries are
// observers; the native cases use the production store and confirmation adapter.
const read=name=>fs.readFileSync(new URL('../assets/features/'+name,import.meta.url),'utf8');
function section(source,start,end){const a=source.indexOf(start),b=source.indexOf(end,a);assert(a>=0&&b>a,start);return source.slice(a,b);}
const sideCode=section(read('story-quests.js'),' function turnInSide(',' const pend=');
const bookCode=section(read('season-quests.js'),' function claimEntry(',' /* Closing a book');
const KEY='starRanchFable_v1',clone=v=>structuredClone(v);
const initial=()=>({coins:30,side:{active:{jump:{p:2},prior:{p:3}},done:{old:true},n:1},stats:{side:1},seasonQ:{idx:0,prog:2,claimed:{},unlocked:false},story:{idx:9,prog:2,name:'Luna'}});
function memory(save){let current=clone(save);return {getItem:()=>JSON.stringify(current),setItem:(_,raw)=>{current=JSON.parse(raw);}};}
function fixture(storage=memory(initial()),{api=true,pending=false}={}){
 const state={pending},trace={reads:0,writes:0,flushes:0,pays:0,wallet:0,tack:0,sounds:0,daily:[],toasts:[],cursors:0,credits:0,finishes:0,repaints:0};
 const dlg={style:{display:'block'}},readSave=()=>{trace.reads++;return JSON.parse(storage.getItem(KEY));};
 let beforeDraft=()=>{};
 const S={sync(fn){const draft=readSave();beforeDraft();fn(draft);trace.writes++;storage.setItem(KEY,JSON.stringify(draft));}};
 const G={...(api?{trainingProgress:{pending:()=>state.pending}}:{}),time:{weekKey:()=> 'week-current'},sGem:()=>trace.sounds++};
 const M={payReward(s,reward){trace.pays++;s.coins+=reward.c;},refreshWallet:()=>trace.wallet++,rewardLabel:r=>r.c+' coins'};
 const SIDE_BY={jump:{id:'jump',type:'cleanjump',label:'Clean jumps',goal:3,reward:{c:40}},prior:{id:'prior',type:'cleanjump',label:'Earlier jumps',goal:3,reward:{c:20}}};
 const side=new Function('G','S','SIDE_BY','toast','M','H','$','Q',sideCode+'return turnInSide;')(
  G,S,SIDE_BY,m=>trace.toasts.push(m),M,{refreshTack:()=>trace.tack++},()=>dlg,{dailyEvt:(...a)=>trace.daily.push(a)});
 const B={entries:[{evt:'cleanjump',goal:3,label:'Three clean jumps',reward:{c:50}},{evt:'pet',goal:2,label:'A gentle hand',reward:{c:10}}]};
 const bookState=()=>{const s=readSave(),i=s.seasonQ.idx,cur=B.entries[i];return {B,i,cur,done:!cur,prog:s.seasonQ.prog};};
 const book=new Function('G','toast','flushQ','bookState','S','M','credit','syncCur','finishBook','repaint',bookCode+'return claimEntry;')(
  G,m=>trace.toasts.push(m),()=>trace.flushes++,bookState,S,M,()=>trace.credits++,()=>trace.cursors++,()=>trace.finishes++,()=>trace.repaints++);
 return {state,trace,side,book,dlg,get save(){return JSON.parse(storage.getItem(KEY));},edit(fn){const s=this.save;fn(s);storage.setItem(KEY,JSON.stringify(s));},beforeDraft(fn){beforeDraft=fn;}};
}
function noReward(f){assert.equal(f.trace.pays,0);assert.equal(f.trace.wallet,0);assert.equal(f.trace.sounds,0);assert.equal(f.trace.tack,0);assert.deepEqual(f.trace.daily,[]);assert.equal(f.trace.cursors,0);assert.equal(f.trace.credits,0);assert.equal(f.trace.finishes,0);}

for(const kind of ['side','book']){
 test(kind+' claim rejects native pending before any mirror read, write or almanac flush',()=>{
  const f=fixture(undefined,{pending:true});f.edit(s=>{s.side.active.jump.p=3;s.seasonQ.prog=3;});const before=f.save;
  assert.equal(f[kind]('jump'),false);assert.deepEqual(f.save,before);assert.equal(f.trace.reads,0);assert.equal(f.trace.writes,0);assert.equal(f.trace.flushes,0);assert.equal(f.dlg.style.display,'block');noReward(f);assert.match(f.trace.toasts[0],/Retry saving your training/);
 });
 test(kind+' claim rechecks pending status inside the actual reward transaction',()=>{
  const f=fixture();f.edit(s=>{s.side.active.jump.p=3;s.seasonQ.prog=3;});const before=f.save;f.beforeDraft(()=>f.state.pending=true);
  assert.notEqual(f[kind]('jump'),true);assert.deepEqual(f.save,before);noReward(f);
 });
 test(kind+' preserves web behavior with the pending provider absent or false',()=>{
  for(const api of [false,true]){const f=fixture(undefined,{api});f.edit(s=>{s.side.active.jump.p=3;s.seasonQ.prog=3;});const originalStory=clone(f.save.story);f[kind]('jump');
   assert.equal(f.trace.pays,1);assert.equal(f.trace.wallet,1);assert.equal(f.trace.sounds,1);assert.deepEqual(f.save.story,originalStory);
   f[kind]('jump');assert.equal(f.trace.pays,1,'existing claim ledger/cursor prevents a second payout');
   if(kind==='side'){assert.equal(f.save.side.done.jump,true);assert.equal(f.save.side.n,2);assert.equal(f.save.stats.side,2);assert.deepEqual(f.trace.daily,[['side',1]]);}
   else{assert.equal(f.save.seasonQ.idx,1);assert.equal(f.save.seasonQ.prog,0);assert.equal(f.save.seasonQ.claimed['0'],1);}
  }
 });
}

test('already-earned side objective remains untouched during pending training and claimable after confirmation',()=>{
 const f=fixture(undefined,{pending:true}),before=f.save;
 assert.equal(f.side('prior'),false);assert.deepEqual(f.save,before);noReward(f);
 f.state.pending=false;f.side('prior');assert.equal(f.save.coins,50);assert.equal(f.save.side.done.prior,true);assert.equal(f.save.side.active.jump.p,2);
});
test('unfinished objectives cannot claim when the native pending gate opens',()=>{
 const f=fixture();f.side('jump');assert.equal(f.book(),false);assert.equal(f.save.coins,30);noReward(f);
});

for(const failure of ['write','readback'])test('actual native '+failure+' failure keeps staged training-fed claims blocked until verified retry',async()=>{
 const original=initial(),files={a:encodeSnapshot(4,{[KEY]:JSON.stringify(original)})};let fail=true;
 const backend={async read(slot){if(fail&&failure==='readback'&&slot==='b'&&files.b)throw Error('readback unavailable');return files[slot]??null;},async write(slot,value){if(fail&&failure==='write')throw Error('disk full');files[slot]=value;}};
 const native=await createSaveStore({backend,delay:60000});
 try{
  const f=fixture(native,{pending:true}),staged=clone(original);staged.side.active.jump.p=3;staged.seasonQ.prog=3;staged.lastTraining={runId:'same-training',saved:true};native.setItem(KEY,JSON.stringify(staged));
  assert.equal(f.save.lastTraining.saved,true,'working mirror alone advertises a saved receipt');
  let acknowledge=async()=>{const verified=await confirmGameSave({native:true,storage:native},KEY);assert.equal(verified.lastTraining?.runId,'same-training');assert.equal(verified.lastTraining.saved,true);f.state.pending=false;return verified;};
  await assert.rejects(acknowledge(),/disk full|readback unavailable/);
  assert.equal(f.side('jump'),false);assert.equal(f.book(),false);assert.deepEqual(f.save,staged);assert.deepEqual(JSON.parse(native.getDurableItem(KEY)),original);noReward(f);
  fail=false;assert.deepEqual(await acknowledge(),staged);assert.equal(f.trace.writes,0,'confirmation does not replay training or write a quest');
  f.side('jump');assert.equal(f.book(),true);assert.equal(f.save.coins,120);assert.equal(f.trace.pays,2);assert.deepEqual(f.save.lastTraining,staged.lastTraining);f.side('jump');assert.equal(f.book(),false);assert.equal(f.trace.pays,2);
  await confirmGameSave({native:true,storage:native},KEY);
  const reopened=await createSaveStore({backend});try{const after=fixture(reopened);after.side('jump');assert.equal(after.book(),false);assert.equal(after.save.coins,120);noReward(after);}finally{reopened.dispose();}
 }finally{native.dispose();}
});

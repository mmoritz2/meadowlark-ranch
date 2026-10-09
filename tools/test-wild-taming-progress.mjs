import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {saveWildTaming} from '../assets/features/wild-taming-rules.mjs';
const source=fs.readFileSync(new URL('../ranch3d.html',import.meta.url),'utf8');
const read=name=>fs.readFileSync(new URL('../assets/features/'+name,import.meta.url),'utf8');
function cut(text,a,b){const start=text.indexOf(a),end=text.indexOf(b,start);assert(start>=0&&end>start,a);return text.slice(start,end);}
const section=(a,b)=>cut(source,a,b);
const registry=section('const TRAINING_PROGRESS=new Map();','const MULS={};');
const progress=section('function creditTamingProgress(s,receipt){','function retryDrillSave(){');
const cursor=section('let trainingStorySyncedRunId=null;','function storyText(t){');
const events=section('function questEvt(type,val){','function npcShort(def){');
const claim=section(" $('dlgBtn').onclick=()=>{\n  syncPendingTrainingStory();",'\n };\n}\nfunction makeNPC(def){');
const daily=section('function dailyTypeAliases(type){','const _dailyMemo=')+section('function todayDailyRoll(ds){','function dailyEvt(type,val){');
const pass=section('function passAmount(n,s){','function passAdd(n){');
const sideCode=cut(read('story-quests.js'),' function applySideProgress(',' function openSideTab(');
const bookCode=cut(read('season-quests.js'),' function applyBookProgress(',' function claimEntry(');
const bookCursor=cut(read('season-quests.js'),' function syncCur(',' function bookState(');
const clone=x=>structuredClone(x);
function fixture(options={}){
 const DAILYQ=[{type:'tame',goal:1,label:'Tame a wild horse'},{type:'photo',goal:2,label:'Two pictures'}];
 const STORY=[{type:options.storyType||'tame',goal:options.goal||2,label:'Wild partnership',npc:'wren',reward:{c:999}},{type:'photo',goal:1,npc:'wren'}];
 let live={coins:0,gems:0,nextId:1,horses:[],sanctuary:[],stats:{},pass:{pts:5},vip:!!options.vip,
  story:{idx:0,prog:options.before||0,clues:['keep']},dq:{date:new Date().toDateString(),roll:['tame','photo'],prog:{},claimed:options.claimed?{tame:true}:{}},life:{since:12},
  side:{active:{herd:{p:0},other:{p:0}},done:{old:true}},seasonQ:{key:'current',idx:0,prog:0,claimed:{old:true}}};
 const trace={reads:0,writes:0,apply:0,claims:0,toasts:[],hooks:[],confirmations:0};
 let failWrite=false,readBackFailure=false,unreadable=false,failReads=0,moduleFailure=false;
 const pending=[];const G={worldPkg:{pendingTaming:()=>pending},on(){},run:(name,...args)=>trace.hooks.push([name,...args])};
 new Function('G',registry)(G);
 function fresh(){trace.reads++;if(unreadable||failReads-->0)return null;return clone(live);}
 function sync(fn){try{if(unreadable)throw Error('unreadable');const s=clone(live);fn(s);if(failWrite)throw Error('quota');live=clone(s);trace.writes++;if(readBackFailure)unreadable=true;}catch{}}
 const toast=t=>trace.toasts.push(t),S={sync};
 new Function('G','S','fresh','toast','SIDE_BY','npcShort',sideCode)(G,S,fresh,toast,
  {herd:{type:'tame',goal:2,label:'Meet the herd',npc:'bea'},other:{type:'photo',goal:2,label:'Pictures',npc:'wren'}},x=>x);
 const CUR={},book={entries:[{evt:'tame',goal:2,label:'Meet two horses'}]};
 new Function('G','S','fresh','toast','book','SKEY','CUR',bookCursor+bookCode+'syncCur();')(G,S,fresh,toast,()=>book,'current',CUR);
 G.trainingProgress.register('failure-check',()=>{if(moduleFailure)throw Error('progress reducer failed');return {};},()=>trace.confirmations++);
 const hud={style:{}};
 const bindings={G,STORY,DAILYQ,DAILY_N:2,DRILL:{},QUEST_TYPES:{},NPC_DEFS:[{id:'wren',name:'Wren'}],storyIdx:0,storyProg:options.before||0,_dailyMemo:{key:'cached'},
  freshSave:fresh,syncSave:sync,toast,VIPON:!!options.cachedVip,VIP_PASS:1.5,isVIP:s=>s.vip===true,$:()=>hud,
  payReward:()=>trace.claims++,refreshWallet(){},refreshTack(){},reloadHorses(){},sGem(){},mulOf:()=>1,npcShort:x=>x.name};
 const api=new Function(...Object.keys(bindings),daily+pass+progress+cursor+events+`return {creditTamingProgress,confirmTamingProgress,passAmount,questEvt,saveStory,missionDone,
  makeClaim(m,openedIdx,mine,def){${claim}\n };return $('dlgBtn').onclick;},
  state:()=>({storyIdx,storyProg,dailyKey:_dailyMemo.key})};`)(...Object.values(bindings));
 const storage={fresh,sync};
 function apply(s,p){
  trace.apply++;const receipt={runId:p.runId,choice:p.lockedChoice};
  if(receipt.choice==='home'){const h={id:s.nextId++,name:'Misty'};s.horses.push(h);receipt.horseId=h.id;}
  if(receipt.choice==='sanctuary')s.sanctuary.push({id:p.runId,name:'Misty'});
  s.gems++;if(receipt.choice==='sanctuary')s.coins+=150;
  receipt.pay={g:1,p:api.passAmount(40,s)};s.pass.pts+=receipt.pay.p;
  receipt.progress=api.creditTamingProgress(s,receipt);return receipt;
 }
 function start(runId='wild-one',choice='home'){const p={runId,choice};pending.push(p);return p;}
 return {api,G,STORY,CUR,trace,pending,start,apply,storage,finish:p=>saveWildTaming(storage,p,apply),get save(){return clone(live);},
  persistStory:s=>{live.story=clone(s);},persistReceipt:r=>{live.wildTaming={receipts:{[r.runId]:r}};},
  set failWrite(v){failWrite=v;},set readBackFailure(v){readBackFailure=v;},set unreadable(v){unreadable=v;},set failReads(v){failReads=v;},set moduleFailure(v){moduleFailure=v;}};
}

test('one home save credits actual tame story, daily, lifetime, side and almanac with its horse',()=>{
 const f=fixture({before:1,vip:true}),p=f.start(),r=f.finish(p),s=f.save;
 assert(r.ok);assert.equal(f.trace.writes,1);assert.equal(s.horses.length,1);assert.equal(s.pass.pts,65);
 assert.deepEqual(s.story,{idx:0,prog:2,clues:['keep']});assert.equal(s.dq.prog.tame,1);assert.equal(s.life.tame,1);assert.equal(s.life.since,12);
 assert.equal(s.side.active.herd.p,1);assert.equal(s.side.active.other.p,0);assert.deepEqual(s.side.done,{old:true});
 assert.equal(s.seasonQ.prog,1);assert.deepEqual(s.seasonQ.claimed,{old:true});assert.deepEqual(s.dq.claimed,{});
 assert.equal(r.result.progress.tamed,1);assert.deepEqual(r.result.progress.story,{idx:0,label:'Wild partnership',before:1,after:2,goal:2,npc:'wren'});
 assert.deepEqual(f.trace.toasts,[]);assert.deepEqual(f.trace.hooks,[]);assert.equal(f.api.state().storyProg,1,'the draft cannot change live story');
 const writes=f.trace.writes;assert(f.api.confirmTamingProgress(r.result,r.saved));assert.equal(f.api.state().storyProg,2);assert.equal(f.api.state().dailyKey,'');
 assert.equal(f.trace.writes,writes);assert.equal(f.trace.toasts.length,2);assert.equal(f.trace.confirmations,1);
 assert.equal(f.api.confirmTamingProgress(r.result,r.saved),false);assert.equal(f.trace.toasts.length,2);
 assert(f.finish(p).ok);assert.equal(f.trace.writes,1);assert.equal(f.trace.apply,1,'the permanent receipt prevents repeated progress and grants');
});

test('sanctuary counts the main tame and helper preserves its daily-only main-story semantics',()=>{
 for(const choice of ['sanctuary','helper']){
  const f=fixture({claimed:true}),r=f.finish(f.start('wild-'+choice,choice));assert(r.ok);
  assert.equal(f.save.story.prog,choice==='helper'?0:1);assert.equal(r.result.progress.story===null,choice==='helper');
  assert.equal(f.save.life.tame,1);assert.equal(f.save.dq.prog.tame,undefined);assert.equal(f.save.dq.claimed.tame,true);
  assert.equal(f.save.side.active.herd.p,1);assert.equal(f.save.seasonQ.prog,1);assert.equal(f.save.horses.length,0);
 }
});

test('wrong or finished main mission is not changed or auto-claimed',()=>{
 for(const options of [{storyType:'photo'},{before:2}]){
  const f=fixture(options),before=f.save.story,r=f.finish(f.start());assert(r.ok);assert.deepEqual(f.save.story,before);
  assert.equal(r.result.progress.story,null);assert.equal(f.trace.claims,0);assert.deepEqual(f.save.side.done,{old:true});
 }
});

test('failed write and throwing reducer leave all durable progress and rewards untouched',()=>{
 for(const mode of ['write','module']){
  const f=fixture(),p=f.start(),before=f.save;if(mode==='write')f.failWrite=true;else f.moduleFailure=true;
  const r=f.finish(p);assert.equal(r.ok,false);assert.deepEqual(f.save,before);assert.equal(f.trace.writes,0);assert.deepEqual(f.trace.toasts,[]);
  assert.equal(f.api.state().storyProg,0);assert.equal(f.api.confirmTamingProgress(p.result),false);
  f.failWrite=false;f.moduleFailure=false;assert(f.finish(p).ok);assert.equal(f.save.life.tame,1);assert.equal(f.save.horses.length,1);
 }
});

test('missing progress registry aborts the transaction rather than silently dropping related goals',()=>{
 const f=fixture(),p=f.start(),before=f.save;f.G.trainingProgress=null;
 assert.equal(f.finish(p).ok,false);assert.deepEqual(f.save,before);assert.equal(f.trace.writes,0);
});

test('confirmed save can refresh story from its verified draft even if another read now fails',()=>{
 const f=fixture({before:1}),r=f.finish(f.start());f.unreadable=true;const reads=f.trace.reads;
 assert(f.api.confirmTamingProgress(r.result,r.saved));assert.equal(f.trace.reads,reads,'story and almanac confirmation reuse the verified save');assert.equal(f.api.state().storyProg,2);assert.equal(f.api.state().dailyKey,'');
 assert(f.trace.toasts.some(t=>/Ride back and tell Wren/.test(t)));assert.equal(f.trace.writes,1);
});

test('successful write with unreadable verification resyncs before another ordinary tame event',()=>{
 const f=fixture({goal:3}),p=f.start();f.readBackFailure=true;assert.equal(f.finish(p).ok,false);
 assert.equal(f.save.story.prog,1);assert.equal(f.api.state().storyProg,0);f.readBackFailure=false;f.unreadable=false;
 f.api.questEvt('tame',1);assert.equal(f.save.story.prog,2);assert.equal(f.api.state().storyProg,2);assert.equal(f.trace.confirmations,0);
 const reads=f.trace.reads;for(let i=0;i<5;i++)f.api.missionDone();assert.equal(f.trace.reads,reads,'acknowledged pending receipts do not reread every frame');
 assert(f.finish(p).ok);assert.equal(f.trace.apply,1);assert.equal(f.save.story.prog,2);assert.equal(f.save.life.tame,1);
});

test('save-time recovery adds only the new tame delta, never overwriting its durable predecessor',()=>{
 const f=fixture({goal:3}),p=f.start();f.readBackFailure=true;f.finish(p);f.readBackFailure=false;f.unreadable=false;f.failReads=1;
 f.api.questEvt('tame',1);assert.equal(f.save.story.prog,2);assert.equal(f.api.state().storyProg,2);
 f.api.questEvt('tame',1);assert.equal(f.save.story.prog,3);assert.equal(f.trace.apply,1);
});

test('direct stale save and old claim cannot rewind an already claimed successor',()=>{
 const f=fixture({goal:1}),p=f.start();f.readBackFailure=true;f.finish(p);f.readBackFailure=false;f.unreadable=false;
 f.persistStory({idx:1,prog:0,clues:['next']});const callback=f.api.makeClaim(f.STORY[0],0,true,{id:'wren'});
 callback();assert.equal(f.trace.claims,0);assert.deepEqual(f.api.state(),{storyIdx:1,storyProg:0,dailyKey:'cached'});
 f.api.saveStory();assert.deepEqual(f.save.story,{idx:1,prog:0,clues:['next']});assert(f.finish(p).ok);
 f.api.confirmTamingProgress(p.result,f.save);assert.equal(f.trace.toasts.some(t=>/Ride back and tell/.test(t)),false);
});

test('unreadable pending cursor blocks the actual stale claim callback until recovery',()=>{
 const f=fixture({goal:1,before:1}),p=f.start();f.readBackFailure=true;f.finish(p);f.persistStory({idx:1,prog:1});
 const callback=f.api.makeClaim(f.STORY[0],0,true,{id:'wren'});callback();assert.equal(f.trace.claims,0);
 f.readBackFailure=false;f.unreadable=false;callback();assert.equal(f.trace.claims,0);assert.equal(f.api.state().storyIdx,1);
});

test('multiple pending runs acknowledge independently and never replay old receipt story',()=>{
 const f=fixture({goal:4}),one=f.start('one');f.readBackFailure=true;f.finish(one);f.readBackFailure=false;f.unreadable=false;
 f.api.missionDone();assert.equal(f.api.state().storyProg,1);
 const two=f.start('two');f.readBackFailure=true;f.finish(two);f.readBackFailure=false;f.unreadable=false;
 f.api.saveStory();assert.equal(f.save.story.prog,2);assert.equal(f.api.state().storyProg,2);
 f.persistStory({idx:1,prog:0});const reads=f.trace.reads;f.api.missionDone();assert.equal(f.trace.reads,reads,'old acknowledgements remain stable');
 assert(f.finish(one).ok);assert(f.finish(two).ok);assert.equal(f.save.story.idx,1);assert.equal(f.trace.apply,2);
});

test('a receipt with a different choice cannot authorize a pending story resync',()=>{
 const f=fixture();f.start('one','home');f.persistStory({idx:1,prog:1});f.persistReceipt({runId:'one',choice:'sanctuary',saved:true});
 f.api.missionDone();assert.equal(f.api.state().storyIdx,0);
});

test('passAmount is draft-only and uses the supplied VIP entitlement instead of stale live cache',()=>{
 const f=fixture({cachedVip:true}),before=f.save,writes=f.trace.writes;
 assert.equal(f.api.passAmount(40,{vip:false}),40);assert.equal(f.api.passAmount(41,{vip:true}),62);assert.equal(f.api.passAmount(40),60);
 assert.deepEqual(f.save,before);assert.equal(f.trace.writes,writes);
});

test('all three registered module filters admit tame without admitting unrelated events',()=>{
 for(const [file,key,end]of [['story-quests.js','side-quests',' function openSideTab('],['seasons.js','season-challenges'," G.on('weekRoll'"],['season-quests.js','season-almanac',' function claimEntry(']]){
  const text=read(file),snippet=cut(text," G.trainingProgress?.register('"+key+"'",end),calls=[];
  let reduce;const G={trainingProgress:{register(id,fn){assert.equal(id,key);reduce=fn;}}};
  new Function('G','applySideProgress','notifySideProgress','applyChallengeEvents','payTrainingChallenge','notifyChallengeProgress','applyBookProgress','syncCur','notifyBookProgress',snippet)(
   G,(s,type,n)=>{calls.push([type,n]);return [];},()=>{},(s,ev)=>{calls.push(...ev.map(e=>[e.type,e.value]));return {};},()=>{},()=>{},(s,type,n)=>{calls.push([type,n]);return null;},()=>{},()=>{});
  reduce({},[{type:'tame',value:1},{type:'photo',value:1}]);assert.deepEqual(calls,[['tame',1]],file);
 }
});

test('public seams are exposed without broadcasting a second legacy daily or quest event',()=>{
 assert.match(source,/xp:\{[^\n]*passAmount/);assert.match(source,/quest:\{[^\n]*creditTamingProgress,confirmTamingProgress/);
 const f=fixture(),draft=f.save;assert.throws(()=>f.api.creditTamingProgress(draft,{runId:'',choice:'home'}),/Invalid/);
 assert.deepEqual(draft,f.save);assert.deepEqual(f.trace.hooks,[]);
});

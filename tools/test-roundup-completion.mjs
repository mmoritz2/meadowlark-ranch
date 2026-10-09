import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as rewards from '../assets/roundup-rewards.mjs';
import {journeyMetrics} from '../assets/features/rider-journey-rules.mjs';

// Run production completion, retry, finish gates and pen cleanup against an
// isolated string store. These synthetic run fixtures are not riding proof.
const source=fs.readFileSync(new URL('../ranch3d.html',import.meta.url),'utf8');
function section(start,end){const a=source.indexOf(start),b=source.indexOf(end,a);assert(a>=0&&b>a,'production boundary: '+start);return source.slice(a,b);}
const roundup=section('const ROUND_MODES=','/* ===== Training drills');
const pass=section('function passAmount(n,s){','function passAdd(n){');
const progress=section('function creditRoundupProgress(s,receipt){','function creditTamingProgress(s,receipt){');
const daily=section('function dailyTypeAliases(type){','const _dailyMemo=')+section('function todayDailyRoll(ds){','function dailyEvt(type,val){');
const stars=section('function ensureWeek(s){','function weeklyFeatured(){');
const cursor=section('let trainingStorySyncedRunId=null;','function storyText(t){');
const quest=section('function questEvt(type,val){','function npcShort(def){');
const confirmation=section('function confirmTrainingProgress(receipt,verifiedSave){','function retryDrillSave(){');
const claim=section(" $('dlgBtn').onclick=()=>{\n  syncPendingTrainingStory();",'\n };\n}\nfunction makeNPC(def){');
const copy=v=>structuredClone(v);
function vector(x=0,y=0,z=0){return {x,y,z,set(x,y,z){Object.assign(this,{x,y,z});return this;},distanceTo(v){return Math.hypot(this.x-v.x,this.y-v.y,this.z-v.z);}};}
function fixture(options={}){
 const trace={claims:0,finishRefs:[],reads:0,writes:0,attempts:0,events:[],removed:[],undressed:[],disposed:0,toasts:[],sounds:0,wallet:0,confirmed:[]};
 let blocked=false,failed=options.failure||null,unreadable=false,week='2026-W41',vip=!!options.vip;
 const initial={coins:100,gems:4,keys:2,stats:{rounded:10,earned:7},horses:[{id:1,name:'Willow'}],pass:{pts:5},story:{idx:0,prog:0,rbase:10},roundupBest:copy(options.records||{}),vip,
  wk:{week,sp:0,events:2,days:1,lastDay:new Date().toDateString()},sp:{week,pts:9}};
 let stored=JSON.stringify(initial);const key='isolated-roundup-completion';
 const localStorage={getItem(k){assert.equal(k,key);trace.reads++;if(unreadable)throw Error('readback unavailable');return stored;},setItem(k,v){assert.equal(k,key);trace.attempts++;if(failed==='write')throw Error('storage full');stored=v;trace.writes++;if(failed==='readback')unreadable=true;if(failed==='after-write')throw Error('wrapper threw after commit');}};
 const freshSave=()=>{try{return JSON.parse(localStorage.getItem(key));}catch{return null;}};
 const syncSave=fn=>{try{const s=JSON.parse(localStorage.getItem(key));fn(s);localStorage.setItem(key,JSON.stringify(s));}catch{}};
 const document={hidden:false};
 const hud={style:{display:'block'},textContent:''},hooks=new Map(),player={pos:vector(-100,0,0),heading:0,speed:0,y:0};
 const G={input:{blocked:()=>blocked},riding:{releaseAll(){}},world:{avoid:(_h,a)=>a,pushOut(){}},worldPkg:{pendingTaming:()=>[],findClear:(x,z)=>[x,z]},on(name,fn){const list=hooks.get(name)||[];list.push(fn);hooks.set(name,list);},run(name,...args){
  if(name==='roundupFinish')trace.finishRefs.push(args[0]);
  trace.events.push({name,result:args[0]&&typeof args[0]==='object'?copy(args[0]):args[0]});for(const fn of hooks.get(name)||[])fn(...args);
 },trainingProgress:{apply(){return {};},confirmed:r=>trace.confirmed.push(copy(r))}};
 const STORY=[{type:'roundup',label:'Pen five runaways',goal:5,npc:'wren'},{type:'photo',goal:1,npc:'wren'}];
 const bindings={...rewards,G,player,scene:{remove:g=>trace.removed.push(g)},nameSprites:[],$:()=>hud,undressRig:h=>trace.undressed.push(h),
  freshSave,syncSave,localStorage,SAVE_KEY:key,VIPON:!vip,VIP_PASS:1.5,isVIP:s=>s.vip===true,weekKey:()=>week,
  DAILYQ:[{type:'photo',goal:2,label:'Take photographs'}],DAILY_N:1,QUEST_TYPES:{},STORY,storyIdx:0,storyProg:0,NPC_DEFS:[{id:'wren',name:'Wren'}],_dailyMemo:{key:'cached'},
  payReward:()=>trace.claims++,refreshTack(){},reloadHorses(){},sGem(){},mulOf:()=>1,
  logEarn:(s,n)=>{s.stats.earned=(s.stats.earned||0)+n;},refreshWallet:()=>trace.wallet++,sChime:()=>trace.sounds++,toast:s=>trace.toasts.push(s),
  passAdd(){throw Error('pass must be in the completion draft');},weekBump(){throw Error('week progress must be in the completion draft');},questEvt(){throw Error('story progress must be in the completion draft');},
  course:null,DRILL:{},document,freeCam:false,groundH:()=>0,animateHorse(){},dressWithRig(){},tickRig(){},GAITS:{walk:{},trot:{}},PAST:{x1:-120,x2:-30,z1:-40,z2:30}};
 const api=Function(...Object.keys(bindings),pass+stars+daily+progress+confirmation+roundup+cursor+quest+'\nreturn {ROUND,endRoundup,retryRoundupSave,roundupState,tickRoundup,startRoundup,questEvt,saveStory,missionDone,liveStory:()=>({idx:storyIdx,prog:storyProg}),makeClaimCallback(m,openedIdx,mine,def){'+claim+'\n };return $(\'dlgBtn\').onclick;},setFreeCam:v=>{freeCam=v;}};')(...Object.values(bindings));
 G.roundup={pending:()=>api.ROUND.pending?.proof||null,state:api.roundupState};
 const mode=options.mode||'full',total=mode==='full'?5:3;
 const actors=Array.from({length:total},(_,i)=>{
  const group={position:vector(-80+i,0,-10),rotation:{y:0}};
  return {name:'Horse '+i,parts:{group},pos:vector(-80+i,0,-10),heading:0,phase:0,penned:i<(options.penned??total),rest:2,anchor:{x:-80+i,z:-10},wb:{breed:'bay',body:'#654321',mane:'#321000'},ownedGeometry:[{dispose(){trace.disposed++;}}],ownedMaterial:[],tag:{removeFromParent(){}}};
 });
 Object.assign(api.ROUND,{on:true,t:options.remaining??90,elapsed:options.elapsed??60,cd:0,mode,total,penned:options.penned??total,horses:actors,grp:{visible:true},ring:null,runId:options.runId||'round-one',lastResult:null,pending:null});
 return {api,G,STORY,trace,actors,hud,player,get save(){return JSON.parse(stored);},get stored(){return stored;},set failure(v){failed=v;},set unreadable(v){unreadable=v;},set week(v){week=v;},set blocked(v){blocked=v;},set hidden(v){document.hidden=v;},editSave(fn){const s=JSON.parse(stored);fn(s);stored=JSON.stringify(s);},finish:()=>api.endRoundup(false)};
}
const events=(f,name)=>f.trace.events.filter(e=>e.name===name);

test('finish gate rejects an unfinished clock and herd without touching save or scene',()=>{
 const f=fixture({penned:4}),before=f.stored;assert.equal(f.finish(),false);assert.equal(f.api.ROUND.on,true);assert.equal(f.stored,before);assert.equal(f.trace.removed.length,0);assert.equal(f.api.ROUND.pending,null);assert.equal(events(f,'roundupFinish').length,0);
});

test('full gold saves rewards, bests, story, pass and week before one successful finish',()=>{
 const f=fixture({vip:true});assert.equal(f.finish(),true);const s=f.save,r=f.api.ROUND.lastResult;
 assert.equal(f.trace.writes,1);assert.equal(s.coins,1000);assert.equal(s.gems,6);assert.equal(s.keys,3);assert.equal(s.stats.rounded,15);assert.equal(s.stats.earned,907);assert.equal(s.sp.pts,29);assert.equal(s.pass.pts,50);assert.equal(s.wk.events,3);
 assert.equal(s.life.roundup,5);assert.equal(s.dq.prog.photo,undefined);assert.equal(s.story.prog,5);assert.equal(s.story.rbase,10);assert.equal(s.roundupBest.full.plays,1);assert.equal(s.roundupBest.full.medal,'gold');assert.equal(journeyMetrics(s).fullGold,1);
 assert.equal(r.saved,true);assert.equal(r.runId,'round-one');assert.equal(f.api.ROUND.pending,null);assert.equal(f.api.ROUND.on,false);assert.equal(f.trace.removed.length,5);assert.equal(f.trace.disposed,5);assert.equal(events(f,'roundupFinish').length,1);assert.equal(f.trace.finishRefs[0],r,'finish listeners receive the identical current saved result');assert.equal(events(f,'roundupSavePending').length,0);
 assert.equal(f.api.retryRoundupSave(),false);assert.equal(f.finish(),false);assert.equal(f.trace.writes,1);assert.equal(events(f,'roundupFinish').length,1);
});

test('rejected write preserves earned run and actors without success, then retries exactly once',()=>{
 const f=fixture({failure:'write'}),before=f.stored;assert.equal(f.finish(),false);
 assert.equal(f.stored,before);assert.equal(f.trace.removed.length,0);assert.equal(f.trace.disposed,0);assert.equal(f.api.ROUND.grp.visible,true);assert.equal(f.trace.sounds,0);assert.equal(f.trace.wallet,0);assert.equal(events(f,'roundupFinish').length,0);assert.equal(events(f,'roundupSavePending').length,1);
 assert.equal(f.api.roundupState().pending.runId,'round-one');assert.equal(f.api.roundupState().pending.saved,false);assert.equal(journeyMetrics(f.save).fullGold,0);
 const frozen={t:f.api.ROUND.t,elapsed:f.api.ROUND.elapsed,penned:f.api.ROUND.penned,positions:f.actors.map(h=>[h.pos.x,h.pos.z])};f.api.tickRoundup(20,100);
 assert.deepEqual({t:f.api.ROUND.t,elapsed:f.api.ROUND.elapsed,penned:f.api.ROUND.penned,positions:f.actors.map(h=>[h.pos.x,h.pos.z])},frozen);
 assert.equal(f.api.startRoundup('beginner'),false,'another run cannot replace the pending proof');assert.equal(f.api.ROUND.runId,'round-one');
 assert.equal(f.api.endRoundup(true),false,'cancel cannot discard an earned pending result');assert.equal(events(f,'roundupCancel').length,0);
 f.failure=null;assert.equal(f.api.retryRoundupSave(),true);assert.equal(f.save.coins,1000);assert.equal(f.save.stats.rounded,15);assert.equal(f.save.roundupBest.full.plays,1);assert.equal(f.save.wk.events,3);assert.equal(f.save.pass.pts,35);assert.equal(journeyMetrics(f.save).fullGold,1);assert.equal(f.trace.removed.length,5);assert.equal(events(f,'roundupFinish').length,1);
 const saved=f.stored;assert.equal(f.api.retryRoundupSave(),false);assert.equal(f.stored,saved);assert.equal(f.trace.writes,1);
});

test('write wrapper failure after commit is acknowledged by durable readback',()=>{
 const f=fixture({failure:'after-write'});assert.equal(f.finish(),true);assert.equal(f.trace.writes,1);assert.equal(f.save.roundupBest.full.plays,1);assert.equal(events(f,'roundupFinish').length,1);assert.equal(f.api.ROUND.pending,null);assert.equal(f.api.retryRoundupSave(),false);
});

test('unreadable post-write confirmation retains scene and acknowledges same receipt without regrant',()=>{
 const f=fixture({failure:'readback'});assert.equal(f.finish(),false);const committed=f.stored;
 assert.equal(f.save.coins,1000);assert.equal(f.save.roundupBest.full.plays,1);assert.equal(f.trace.removed.length,0);assert.equal(events(f,'roundupFinish').length,0);assert.equal(f.api.roundupState().pending.saved,false);
 f.failure=null;f.unreadable=false;assert.equal(f.api.retryRoundupSave(),true);assert.equal(f.stored,committed);assert.equal(f.trace.writes,1);assert.equal(f.trace.removed.length,5);assert.equal(events(f,'roundupFinish').length,1);
});

test('partial clock expiry pays only the penned horses and never grants a full-herd Journey goal',()=>{
 const f=fixture({penned:2,remaining:0,elapsed:150});assert.equal(f.finish(),true);const s=f.save,r=f.api.ROUND.lastResult;
 assert.equal(r.penned,2);assert.equal(r.medal,'bronze');assert.equal(s.coins,360);assert.equal(s.gems,4);assert.equal(s.keys,2);assert.equal(s.pass.pts,17);assert.equal(s.sp.pts,17);assert.equal(s.wk.events,3);assert.equal(s.stats.rounded,12);assert.equal(s.story.prog,2);assert.equal(journeyMetrics(s).fullGold,0);assert.equal(journeyMetrics(s).fullPenned,2);
});

test('an explicit cancellation cleans up without paying or recording a result',()=>{
 const f=fixture({penned:2}),before=f.stored;assert.equal(f.api.endRoundup(true),true);assert.equal(f.stored,before);assert.equal(f.trace.writes,0);assert.equal(f.trace.removed.length,5);assert.equal(f.api.ROUND.on,false);assert.equal(f.api.ROUND.pending,null);assert.equal(events(f,'roundupCancel').length,1);assert.equal(events(f,'roundupFinish').length,0);
});

test('production pen crossing reaches completion but cannot dispose the final actor before save',()=>{
 const f=fixture({penned:4,failure:'write'}),last=f.actors.at(-1);last.pos.set(-44,0,-8);last.anchor={x:-44,z:-8};f.api.tickRoundup(.01,1);
 assert.equal(f.api.ROUND.penned,5);assert.equal(events(f,'roundupPen').length,1);assert.equal(events(f,'roundupSavePending').length,1);assert.equal(f.trace.removed.length,0);assert.equal(f.trace.disposed,0);assert.equal(events(f,'roundupFinish').length,0);
});

test('gold medal is retained independently of a tied rounded score',()=>{
 const f=fixture({mode:'beginner',remaining:42.05,elapsed:77.95,records:{beginner:{plays:1,score:1110,penned:3,time:78.05,medal:'silver',lastRunId:'prior'}}});
 assert.equal(f.finish(),true);assert.equal(f.api.ROUND.lastResult.score,1110);assert.equal(f.api.ROUND.lastResult.medal,'gold');assert.equal(f.save.roundupBest.beginner.medal,'gold');assert.equal(f.save.roundupBest.beginner.score,1110);assert.equal(f.save.roundupBest.beginner.time,77.95);
});

test('a later partial round never erases saved full gold or its Journey credit',()=>{
 const f=fixture({penned:1,remaining:0,elapsed:150,records:{full:{plays:1,score:1950,penned:5,time:60,medal:'gold',lastRunId:'older-gold'}}});assert.equal(f.finish(),true);
 assert.equal(f.save.roundupBest.full.medal,'gold');assert.equal(f.save.roundupBest.full.penned,5);assert.equal(f.save.roundupBest.full.score,1950);assert.equal(f.save.roundupBest.full.time,60);assert.equal(journeyMetrics(f.save).fullGold,1);
});


test('a recovered first write targets the current saved week, VIP and objective exactly once',()=>{
 const f=fixture({failure:'write'});assert.equal(f.finish(),false);
 f.week='2026-W42';f.editSave(s=>{s.vip=true;s.story={idx:1,prog:0,rbase:10};});f.failure=null;
 assert.equal(f.api.retryRoundupSave(),true);const s=f.save;
 assert.equal(s.pass.pts,50,'current persisted VIP applies, rather than stale live cache');assert.equal(s.wk.week,'2026-W42');assert.equal(s.wk.events,1);assert.equal(s.wk.sp,20);assert.equal(s.sp.week,'2026-W42');assert.equal(s.sp.pts,20);
 assert.deepEqual(s.story,{idx:1,prog:0,rbase:10},'retry does not rewind or claim the previous roundup objective');assert.equal(s.life.roundup,5);assert.equal(s.stats.rounded,15);assert.equal(f.trace.writes,1);
 assert.equal(f.api.retryRoundupSave(),false);assert.equal(f.save.wk.events,1);assert.equal(f.save.pass.pts,50);
});

test('menus, background tabs and free camera freeze actual roundup countdown and horse movement',()=>{
 for(const kind of ['menu','hidden','freeCam']){
  const f=fixture({penned:0,remaining:150,elapsed:0});
  const pause=value=>{if(kind==='menu')f.blocked=value;else if(kind==='hidden')f.hidden=value;else f.api.setFreeCam(value);};
  const state=()=>({t:f.api.ROUND.t,elapsed:f.api.ROUND.elapsed,cd:f.api.ROUND.cd,penned:f.api.ROUND.penned,positions:f.actors.map(h=>[h.pos.x,h.pos.z])});
  pause(true);f.api.ROUND.cd=3;let before=state();f.api.tickRoundup(2,100);assert.deepEqual(state(),before,kind+' pauses countdown');
  f.api.ROUND.cd=0;before=state();f.api.tickRoundup(2,102);assert.deepEqual(state(),before,kind+' pauses active herding');assert.equal(f.trace.writes,0);assert.equal(events(f,'roundupPen').length,0);
  pause(false);f.api.tickRoundup(.1,102.1);assert.equal(f.api.ROUND.elapsed,.1,kind+' resumes ordinary simulation');
 }
});


test('a committed but unreadable finish reconciles its story before an unrelated quest or stale save',()=>{
 const f=fixture({failure:'readback'});assert.equal(f.finish(),false);assert.equal(f.save.story.prog,5);assert.deepEqual(f.api.liveStory(),{idx:0,prog:0});
 f.failure=null;f.unreadable=false;f.api.questEvt('photo',1);assert.deepEqual(f.api.liveStory(),{idx:0,prog:5});f.api.saveStory();assert.equal(f.save.story.prog,5);
 const reads=f.trace.reads;for(let i=0;i<5;i++)f.api.missionDone();assert.equal(f.trace.reads,reads,'an acknowledged pending receipt does not poll storage each frame');
 assert.equal(f.api.retryRoundupSave(),true);assert.equal(f.save.story.prog,5);assert.equal(f.save.stats.rounded,15);assert.equal(f.save.roundupBest.full.plays,1);assert.equal(f.save.coins,1000);assert.equal(f.trace.claims,0);
});

test('a claimed successor is never rewound or reannounced by the old pending roundup receipt',()=>{
 const f=fixture({failure:'readback'});assert.equal(f.finish(),false);const callback=f.api.makeClaimCallback(f.STORY[0],0,true,{id:'wren'});
 f.editSave(s=>{s.story={idx:1,prog:0,rbase:15,claimed:'roundup'};});callback();assert.equal(f.trace.claims,0,'unreadable pending storage cannot authorize an old claim');
 f.failure=null;f.unreadable=false;callback();assert.equal(f.trace.claims,0);assert.deepEqual(f.api.liveStory(),{idx:1,prog:0});f.api.saveStory();assert.deepEqual(f.save.story,{idx:1,prog:0,rbase:15,claimed:'roundup'});
 assert.equal(f.api.retryRoundupSave(),true);assert.deepEqual(f.save.story,{idx:1,prog:0,rbase:15,claimed:'roundup'});assert.equal(f.trace.toasts.some(s=>s.includes('Ride back and tell')),false);assert.equal(f.save.stats.rounded,15);assert.equal(f.save.roundupBest.full.plays,1);assert.equal(f.trace.claims,0);
});

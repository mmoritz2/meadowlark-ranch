import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// Execute the actual completion/save functions and shared stat-XP calculation.
// No browser, live player save, WebGL scene, or replacement reward implementation.
const source=fs.readFileSync(new URL('../ranch3d.html',import.meta.url),'utf8');
function section(start,end){
 const a=source.indexOf(start),b=source.indexOf(end,a);
 assert(a>=0&&b>a,'production function boundary: '+start);
 return source.slice(a,b);
}
const completion=section('function endDrill(done){','function tickDrill(dt,t){');
const grant=section('function grantStatXp(s,h,k,xp,why){','/* Tack as gear.');
const levelLoop=section('function applyXp(s,h,n){','/* XP for the horse being ridden.');
const daily=section('function dailyTypeAliases(type){','const _dailyMemo=')+
 section('function todayDailyRoll(ds){','function dailyEvt(type,val){');
const levelCap=Function(section('function statCap(h){','function statCeil(h,k){')+'return statCap;')();
const storyCursor=section('let trainingStorySyncedRunId=null;','function storyText(t){');
const storyEvent=section('function questEvt(type,val){','function npcShort(def){');
const dialogueClaim=section(" $('dlgBtn').onclick=()=>{\n  syncPendingTrainingStory();",'\n };\n}\nfunction makeNPC(def){');
const keys=['speed','stamina','jump','accel','agility'];
function fixture(options={}){
 const horse={id:'trained',name:'Willow',level:1,xp:0,stats:{speed:2,jump:2},sxp:{speed:0,jump:0},...options.horse};
 const dailyRows=[{type:'cleanjump',label:'Clear practice jumps',goal:100},{type:'sxp',label:'Raise horse stats',goal:100},{type:'drill',label:'Complete training',goal:100}].map(row=>({...row,goal:options.dailyGoals?.[row.type]??row.goal}));
 let stored=JSON.stringify({coins:100,stats:{drills:2,earned:0},pass:{pts:5},
  dq:{date:new Date().toDateString(),roll:dailyRows.map(row=>row.type),prog:{},claimed:{}},
  story:{idx:0,prog:options.storyBefore??0},
  horses:[horse,{id:'other',name:'Fern',level:1,xp:0,stats:{speed:1},sxp:{speed:0}}]});
 const trace={reads:0,claims:0,events:[],toasts:[],writes:0,refresh:0,reload:0,chime:0,coin:0,removed:0,geometry:0,material:0,texture:0,sharedGeometry:0,unrelatedMaterial:0,cleared:0,practice:[],clinicCalls:[],multiplied:[],draftApplications:0,confirmations:[]};
 const clinic={misses:2,cleared:8,...options.clinic};
 let failure=options.failure,readsFail=false,readFailures=0,moduleFailure=options.moduleFailure;
 const cone={isMesh:true,geometry:{dispose(){trace.geometry++;}},material:{dispose(){trace.material++;}}};
 const spriteGeometry={dispose(){trace.sharedGeometry++;}};
 const numberSprite={isSprite:true,geometry:spriteGeometry,material:{map:{dispose(){trace.texture++;}},dispose(){trace.material++;}}};
 const unrelatedSprite={isSprite:true,geometry:spriteGeometry,material:{dispose(){trace.unrelatedMaterial++;}}};
 const nameSprites=[unrelatedSprite,numberSprite];
 const group={children:[cone,numberSprite],traverse(fn){fn(this);this.children.forEach(fn);},clear(){trace.cleared++;this.children.forEach(o=>o.parent=null);this.children=[];}};
 cone.parent=group;numberSprite.parent=group;
 const DRILL={on:true,idx:8,t:10,elapsed:45,stat:'speed',runId:'run-one',horseId:'trained',horseName:'Willow',cones:[{}],grp:group,...options.drill};
 const hud={style:{display:'block'}},arrow={visible:true};
 const localStorage={setItem(key,value){
  if(failure==='write')throw Error('storage full');
  stored=value;trace.writes++;
  if(failure==='readback')readsFail=true;
  if(failure==='after-write')throw Error('wrapper failed after write');
 },getItem(){trace.reads++;if(readFailures>0){readFailures--;throw Error('read unavailable');}if(readsFail)throw Error('read unavailable');return stored;}};
 const freshSave=()=>{try{return JSON.parse(localStorage.getItem());}catch{return null;}};
 const bindings={QUEST_TYPES:{},syncSave(fn){try{const draft=JSON.parse(localStorage.getItem());fn(draft);localStorage.setItem('isolated-fixture',JSON.stringify(draft));}catch{}},payReward:()=>trace.claims++,setPracticeJumps:on=>trace.practice.push(on),DRILL,DRILL_N:8,DRILL_TIME:55,nameSprites,scene:{remove(){trace.removed++;}},$:()=>hud,course:null,arrow,
  myHorses:JSON.parse(stored).horses,rideIdx:options.rideIdx??0,STAT_LBL:{speed:'💨 Speed',jump:'⤴️ Jump'},
  VIPON:!!options.vip,VIP_PASS:1.5,freshSave,localStorage,SAVE_KEY:'isolated-fixture',
  MAX_LEVEL:50,STAT_KEYS:keys,Math:Object.assign(Object.create(Math),{random:()=>options.random??0}),
  ensureStats:h=>{h.sxp??={};},statCap:options.dynamicCaps?levelCap:()=>options.cap??4,statCeil:()=>options.breedCap??options.cap??4,
  DAILYQ:dailyRows,DAILY_N:3,STORY:[{type:options.storyType??'cleanjump',label:'A clean jumping partnership',goal:options.storyGoal??100,npc:'wren'},{type:'photo',goal:1,npc:'wren'}],
  NPC_DEFS:[{id:'wren',name:'Wren'}],storyIdx:0,storyProg:options.storyBefore??0,_dailyMemo:{key:'cached',list:null},
  statNeed:v=>20+10*v,mulOf:(type,s,h)=>{trace.multiplied.push({type,horseId:h?.id});return type==='xp'?options.horseMultiplier??1:options.multiplier??1;},addSP:(s,n)=>{s.starPoints=(s.starPoints||0)+n;},
  logEarn:(s,n)=>{s.stats.earned+=n;},refreshWallet:()=>trace.refresh++,reloadHorses:()=>trace.reload++,
  sChime:()=>trace.chime++,sCoin:()=>trace.coin++,toast:m=>trace.toasts.push(m),
  G:{trainingProgress:{apply(s,events){
   trace.draftApplications++;s.moduleProgress??={};
   for(const event of events)s.moduleProgress[event.type]=(s.moduleProgress[event.type]||0)+event.value;
   if(moduleFailure)throw Error('draft progress unavailable');
   return {fixture:{events:structuredClone(events)}};
  },confirmed(receipt){trace.confirmations.push(structuredClone(receipt));}},jumpTraining:{snapshot(){trace.clinicCalls.push('snapshot');return structuredClone(clinic);},stop(){trace.clinicCalls.push('stop');Object.assign(clinic,{misses:0,cleared:0});}},run:(name,result)=>trace.events.push({name,result:structuredClone(result)})}};
 const api=new Function(...Object.keys(bindings),grant+levelLoop+daily+completion+storyCursor+storyEvent+'return {endDrill,retryDrillSave,questEvt,saveStory,missionDone,makeClaimCallback(m,openedIdx,mine,def){'+dialogueClaim+'\n };return $(\'dlgBtn\').onclick;},liveProgress(){return {storyIdx,storyProg,dailyKey:_dailyMemo.key};}};')(...Object.values(bindings));
 return {api,DRILL,trace,clinic,hud,arrow,nameSprites,numberSprite,unrelatedSprite,group,get save(){return JSON.parse(stored);},set failure(v){failure=v;},set readsFail(v){readsFail=v;},set moduleFailure(v){moduleFailure=v;},failNextReads(n){readFailures=n;},persistStory(story){const s=JSON.parse(stored);s.story=story;stored=JSON.stringify(s);},reorder(){const s=JSON.parse(stored);s.horses.reverse();stored=JSON.stringify(s);},
  removeHorse(){const s=JSON.parse(stored);s.horses=s.horses.filter(h=>h.id!==horse.id);stored=JSON.stringify(s);}};
}

test('a completed drill saves stat XP, coins, drill count and pass points together',()=>{
 const f=fixture();assert.equal(f.api.endDrill(true),true);
 const s=f.save,h=s.horses[0],r=s.lastTraining;
 assert.equal(f.trace.writes,1);assert.equal(h.stats.speed,3);assert.equal(h.sxp.speed,6);
 assert.equal(s.coins,164);assert.equal(s.stats.drills,3);assert.equal(s.stats.earned,64);assert.equal(s.pass.pts,17);
 assert.deepEqual(r.before,{value:2,xp:0,cap:4});assert.deepEqual(r.after,{value:3,xp:6,cap:4});
 assert.equal(r.statXp,46);assert.equal(r.statRaised,1);assert.equal(r.saved,true);assert.equal(r.horseId,'trained');
 assert.match(f.trace.toasts[0],/Clear round!.*\+46 Speed XP.*\+64 coins.*Speed → 3/);
 assert.equal(f.trace.chime,1);assert.deepEqual(f.trace.events.map(e=>e.name),['drillFinish']);
 assert.equal(f.DRILL.pending,null);assert.equal(f.DRILL.on,false);assert.equal(f.arrow.visible,false);
 assert.deepEqual(f.trace.practice,[true]);assert.equal(f.hud.style.display,'none');assert.equal(f.trace.removed,1);
 assert.deepEqual([f.trace.geometry,f.trace.material,f.trace.texture],[1,2,1],'unique cone and label resources are disposed');
});

test('cleanup removes only training labels and preserves shared sprite geometry',()=>{
 const f=fixture();f.api.endDrill(true);
 assert.deepEqual(f.nameSprites,[f.unrelatedSprite],'the unrelated world label remains registered');
 assert.equal(f.numberSprite.parent,null);assert.deepEqual(f.group.children,[]);
 assert.equal(f.trace.cleared,1);assert.equal(f.trace.sharedGeometry,0);
 assert.equal(f.trace.unrelatedMaterial,0);
 assert.deepEqual([f.trace.geometry,f.trace.material,f.trace.texture],[1,2,1]);
 f.api.endDrill(true);
 assert.deepEqual([f.trace.geometry,f.trace.material,f.trace.texture,f.trace.cleared],[1,2,1,1],'repeated completion does not dispose again');
});

test('partial practice pays only crossed cones and gives no completion or false stat-up message',()=>{
 const f=fixture({drill:{idx:3,t:0,elapsed:55}});assert.equal(f.api.endDrill(false),true);
 const s=f.save;assert.equal(s.horses[0].sxp.speed,9);assert.equal(s.coins,124);
 assert.equal(s.stats.drills,2);assert.equal(s.pass.pts,9);assert.equal(s.lastTraining.completed,false);
 assert.match(f.trace.toasts[0],/3\/8.*\+9 Speed XP.*\+24 coins/);assert(!f.trace.toasts[0].includes('→'));
 assert.equal(f.trace.chime,0);assert.equal(f.trace.coin,1);
});

test('the starting horse receives rewards even if the selected horse changes',()=>{
 const f=fixture({rideIdx:1});f.api.endDrill(true);
 assert.equal(f.save.horses[0].stats.speed,3);assert.equal(f.save.horses[1].stats.speed,1);
 assert.equal(f.save.horses[1].sxp.speed,0);assert.equal(f.save.lastTraining.horseName,'Willow');
});

test('actual retained XP reflects multipliers and discards cap overflow',()=>{
 const boosted=fixture({multiplier:2});boosted.api.endDrill(true);
 assert.equal(boosted.save.lastTraining.statXp,90,'40 + 50 XP reach the cap; overflow is not claimed');
 assert.equal(boosted.save.lastTraining.statRaised,2);assert.equal(boosted.save.horses[0].sxp.speed,0);
 const nearCap=fixture({horse:{stats:{speed:3},sxp:{speed:45}}});nearCap.api.endDrill(true);
 assert.equal(nearCap.save.lastTraining.statXp,5);assert.equal(nearCap.save.lastTraining.after.value,4);
 const capped=fixture({horse:{stats:{speed:4},sxp:{speed:0}}});capped.api.endDrill(true);
 assert.equal(capped.save.lastTraining.statXp,0);assert.equal(capped.save.lastTraining.statRaised,0);
 assert.equal(capped.save.coins,164,'riding the cones still earns its actual coin reward');
});

test('failed storage preserves the earned proof and emits no paid result or success sound',()=>{
 const f=fixture({failure:'write'});assert.equal(f.api.endDrill(true),false);
 assert.equal(f.save.coins,100);assert.equal(f.save.horses[0].stats.speed,2);assert.equal(f.save.pass.pts,5);
 assert.equal(f.DRILL.pending.runId,'run-one');assert.equal(f.DRILL.pending.baseXp,46);
 assert.equal(f.DRILL.pending.saved,false);assert.equal(f.DRILL.pending.reason,'storage full');
 assert.deepEqual(f.trace.events.map(e=>e.name),['drillSavePending']);assert.equal(f.trace.chime+f.trace.coin,0);
 assert(!f.trace.toasts.some(t=>t.includes('Clear round')));
 f.failure=null;assert.equal(f.api.retryDrillSave(),true);
 assert.equal(f.save.coins,164);assert.equal(f.save.stats.drills,3);assert.equal(f.save.pass.pts,17);
 assert.equal(f.DRILL.pending,null);assert.deepEqual(f.trace.events.map(e=>e.name),['drillSavePending','drillFinish']);
 assert.equal(f.api.retryDrillSave(),false);assert.equal(f.trace.writes,1);
});

test('retry acknowledges a saved run after a wrapper throws without double payment',()=>{
 const f=fixture({failure:'after-write'});assert.equal(f.api.endDrill(true),false);
 assert.equal(f.save.coins,164);assert.equal(f.DRILL.pending.saved,false);assert.equal(f.trace.writes,1);
 f.failure=null;assert.equal(f.api.retryDrillSave(),true);
 assert.equal(f.trace.writes,1);assert.equal(f.save.coins,164);assert.equal(f.save.pass.pts,17);
 assert.equal(f.save.stats.drills,3);assert.equal(f.trace.events.filter(e=>e.name==='drillFinish').length,1);
});

test('missing horse or unavailable save never redirects rewards to another horse',()=>{
 const missing=fixture();missing.removeHorse();assert.equal(missing.api.endDrill(true),false);
 assert.equal(missing.save.coins,100);assert.equal(missing.save.horses[0].id,'other');assert.equal(missing.save.horses[0].sxp.speed,0);
 assert.match(missing.DRILL.pending.reason,/horse.*unavailable/);assert.equal(missing.trace.writes,0);
 const unreadable=fixture();unreadable.readsFail=true;assert.equal(unreadable.api.endDrill(true),false);
 assert.match(unreadable.DRILL.pending.reason,/save is unavailable/);assert.equal(unreadable.trace.writes,0);
});

test('zero-cone cancellation and repeated completion cannot claim rewards',()=>{
 const cancelled=fixture({drill:{idx:0}});cancelled.api.endDrill(false);
 assert.equal(cancelled.trace.writes,0);assert.equal(cancelled.DRILL.pending,undefined);assert.equal(cancelled.trace.events.length,0);
 const completed=fixture({vip:true});completed.api.endDrill(true);completed.api.endDrill(true);
 assert.equal(completed.trace.writes,1);assert.equal(completed.save.pass.pts,23);assert.equal(completed.trace.events.length,1);
});

test('the 120-second clinic keeps the 55-second slalom XP budget at equal remaining fractions',()=>{
 for(const [fraction,xp]of [[0,42],[.5,54],[1,65]]){
  const slalom=fixture({cap:9,drill:{timeLimit:55,t:55*fraction,elapsed:55*(1-fraction)}});
  const jump=fixture({cap:9,drill:{stat:'jump',timeLimit:120,t:120*fraction,elapsed:120*(1-fraction),grp:null,cones:[]}});
  assert.equal(slalom.api.endDrill(true),true);assert.equal(jump.api.endDrill(true),true);
  assert.equal(jump.save.lastTraining.baseXp,xp);assert.equal(slalom.save.lastTraining.baseXp,xp);
  assert.equal(jump.save.lastTraining.statXp,xp);assert.equal(jump.save.coins,164);assert.equal(jump.save.pass.pts,17);
  assert.equal(jump.save.lastTraining.activity,'jump');assert.equal(jump.save.lastTraining.unit,'jumps');
  assert.deepEqual(jump.trace.clinicCalls,['snapshot','stop']);assert.equal(jump.trace.removed,0);
 }
 const nearEnd=fixture({drill:{stat:'jump',timeLimit:120,t:10,elapsed:110,grp:null,cones:[]}});nearEnd.api.endDrill(true);
 assert.equal(nearEnd.save.lastTraining.baseXp,44,'ten seconds left on the longer clock is not worth ten seconds of slalom time');
});

test('jump receipt and miss count survive failed-save cleanup and retry without paying twice',()=>{
 const f=fixture({failure:'write',clinic:{misses:3},drill:{stat:'jump',timeLimit:120,t:60,elapsed:60,grp:null,cones:[]}});
 assert.equal(f.api.endDrill(true),false);assert.deepEqual(f.trace.clinicCalls,['snapshot','stop']);
 const proof=f.DRILL.pending;assert.equal(proof.activity,'jump');assert.equal(proof.unit,'jumps');
 assert.equal(proof.cleared,8);assert.equal(proof.total,8);assert.equal(proof.timeRemaining,60);assert.equal(proof.elapsed,60);
 assert.equal(proof.baseXp,54);assert.deepEqual(proof.clinic,{misses:3,clean:8});
 assert.equal(f.clinic.misses,0,'runtime is disposed before retry');assert.equal(f.save.coins,100);assert.equal(f.save.horses[0].sxp.jump,0);
 f.failure=null;assert.equal(f.api.retryDrillSave(),true);
 const r=f.save.lastTraining;assert.equal(r.saved,true);assert.equal(r.activity,'jump');assert.equal(r.unit,'jumps');
 assert.deepEqual(r.clinic,{misses:3,clean:8});assert.equal(r.statXp,54);assert.equal(r.statRaised,1);
 assert.equal(f.save.horses[0].stats.jump,3);assert.equal(f.save.horses[0].sxp.jump,14);
 assert.equal(f.save.coins,164);assert.equal(f.save.pass.pts,17);assert.equal(f.save.stats.drills,3);
 assert.equal(f.api.retryDrillSave(),false);assert.equal(f.trace.writes,1);assert.deepEqual(f.trace.clinicCalls,['snapshot','stop']);
 assert.deepEqual(f.trace.events.map(e=>e.name),['drillSavePending','drillFinish']);
});

test('capped jump practice honestly pays zero stat XP while retaining its earned riding reward',()=>{
 const f=fixture({horse:{stats:{speed:2,jump:4},sxp:{speed:0,jump:0}},drill:{stat:'jump',timeLimit:120,t:60,elapsed:60,grp:null,cones:[]}});
 assert.equal(f.api.endDrill(true),true);const r=f.save.lastTraining;
 assert.deepEqual(r.before,{value:4,xp:0,cap:4});assert.deepEqual(r.after,r.before);
 assert.equal(r.statXp,0);assert.equal(r.statRaised,0);assert.equal(r.activity,'jump');
 assert.equal(f.save.coins,164);assert.equal(f.save.pass.pts,17);assert.equal(f.trace.chime,0);
 assert.match(f.trace.toasts[0],/\+0 Jump XP/);assert(!f.trace.toasts[0].includes('→'));
});

test('partial and empty jump sessions dispose the clinic and only pay landed jumps',()=>{
 const partial=fixture({clinic:{misses:4},drill:{stat:'jump',idx:3,timeLimit:120,t:0,elapsed:120,grp:null,cones:[]}});
 assert.equal(partial.api.endDrill(false),true);const r=partial.save.lastTraining;
 assert.equal(r.completed,false);assert.equal(r.cleared,3);assert.equal(r.baseXp,9);assert.equal(r.statXp,9);
 assert.deepEqual(r.clinic,{misses:4,clean:3});assert.equal(partial.save.coins,124);assert.equal(partial.save.pass.pts,9);assert.equal(partial.save.stats.drills,2);
 assert.deepEqual(partial.trace.clinicCalls,['snapshot','stop']);
 const empty=fixture({drill:{stat:'jump',idx:0,timeLimit:120,t:110,elapsed:10,grp:null,cones:[]}});empty.api.endDrill(false);empty.api.endDrill(false);
 assert.deepEqual(empty.trace.clinicCalls,['snapshot','stop']);assert.equal(empty.trace.writes,0);assert.equal(empty.DRILL.pending,undefined);assert.equal(empty.trace.events.length,0);
});


test('horse XP and actual clean-jump quest credit commit with rewards in one write',()=>{
 const f=fixture({dailyGoals:{cleanjump:5,sxp:1,drill:1},storyGoal:5,
  drill:{stat:'jump',timeLimit:120,t:60,elapsed:60,grp:null,cones:[]}});
 assert.equal(f.api.endDrill(true),true);const s=f.save,r=s.lastTraining,h=s.horses[0];
 assert.equal(f.trace.writes,1);assert.equal(h.xp,24);assert.equal(h.level,1);
 assert.deepEqual(r.growth.before,{level:1,xp:0});assert.deepEqual(r.growth.after,{level:1,xp:24});
 assert.equal(r.growth.horseXp,24);assert.equal(r.growth.levels,0);assert.deepEqual(r.growth.statGains,{});
 assert.equal(r.growth.nextTrainingLevel,null);assert.equal(r.growth.breedCap,4);assert.equal(r.growth.nextLevelXp,100);
 assert.equal(r.progress.cleanJumps,8);assert.equal(r.progress.statsRaised,1);assert.equal(s.stats.jumps,8);
 assert.deepEqual(s.dq.prog,{cleanjump:5,sxp:1,drill:1});assert.equal(s.story.prog,5);
 assert.deepEqual(s.moduleProgress,{cleanjump:8,sxp:1,drill:1});
 assert.equal(f.trace.draftApplications,1);assert.equal(f.trace.confirmations.length,1);
 assert.deepEqual(f.api.liveProgress(),{storyIdx:0,storyProg:5,dailyKey:''});
 assert.equal(r.progress.dailyDone.length,3);assert.equal(r.progress.story.after,5);
 assert(f.trace.toasts.some(message=>message.includes('Daily quest done')));
 assert(f.trace.toasts.some(message=>message.includes('Ride back and tell Wren')));
});
test('horse XP multipliers apply to the original horse despite selection and persisted reorder',()=>{
 const f=fixture({rideIdx:1,horseMultiplier:1.5});f.reorder();assert.equal(f.api.endDrill(true),true);
 const target=f.save.horses.find(h=>h.id==='trained'),other=f.save.horses.find(h=>h.id==='other');
 assert.equal(target.xp,36);assert.equal(other.xp,0);assert.equal(f.save.lastTraining.growth.horseXp,36);
 assert(f.trace.multiplied.some(row=>row.type==='xp'&&row.horseId==='trained'));
 assert.equal(f.trace.multiplied.some(row=>row.horseId==='other'),false);assert.equal(f.trace.writes,1);
});
test('pre-write failure persists no horse XP or quest progress and emits no confirmation',()=>{
 const f=fixture({failure:'write',dailyGoals:{cleanjump:1,sxp:1,drill:1},storyGoal:1,
  drill:{stat:'jump',timeLimit:120,t:60,elapsed:60,grp:null,cones:[]}}),before=f.save;
 assert.equal(f.api.endDrill(true),false);assert.deepEqual(f.save,before);assert.equal(f.trace.writes,0);
 assert.equal(f.trace.confirmations.length,0);assert.equal(f.api.liveProgress().dailyKey,'cached');
 assert.equal(f.trace.toasts.some(message=>/Daily quest done|Ride back and tell/.test(message)),false);
 f.failure=null;assert.equal(f.api.retryDrillSave(),true);const saved=f.save;
 assert.equal(saved.horses[0].xp,24);assert.equal(saved.stats.jumps,8);assert.equal(saved.story.prog,1);
 assert.deepEqual(saved.moduleProgress,{cleanjump:8,sxp:1,drill:1});assert.equal(f.trace.confirmations.length,1);assert.equal(f.trace.writes,1);
 assert.equal(f.api.retryDrillSave(),false);assert.deepEqual(f.save,saved);
});
test('post-write failure and repeated acknowledgement never double horse XP or quest credit',()=>{
 const f=fixture({failure:'after-write',dailyGoals:{cleanjump:1,sxp:1,drill:1},storyGoal:1,
  drill:{stat:'jump',timeLimit:120,t:60,elapsed:60,grp:null,cones:[]}});
 assert.equal(f.api.endDrill(true),false);const saved=f.save;
 assert.equal(saved.horses[0].xp,24);assert.equal(saved.stats.jumps,8);assert.equal(saved.story.prog,1);
 assert.equal(f.trace.confirmations.length,0);assert.equal(f.trace.draftApplications,1);assert.equal(f.trace.writes,1);
 f.failure=null;assert.equal(f.api.retryDrillSave(),true);assert.deepEqual(f.save,saved);
 assert.equal(f.trace.draftApplications,1);assert.equal(f.trace.confirmations.length,1);assert.equal(f.trace.writes,1);
 assert.equal(f.api.retryDrillSave(),false);f.api.endDrill(true);assert.deepEqual(f.save,saved);assert.equal(f.trace.confirmations.length,1);
});
test('a throwing draft progress reducer aborts the full reward transaction and remains retryable',()=>{
 const f=fixture({moduleFailure:true,drill:{stat:'jump',timeLimit:120,t:60,grp:null,cones:[]}}),before=f.save;
 assert.equal(f.api.endDrill(true),false);assert.deepEqual(f.save,before);assert.equal(f.trace.writes,0);assert.equal(f.trace.confirmations.length,0);
 assert.match(f.DRILL.pending.reason,/draft progress unavailable/);f.moduleFailure=false;
 assert.equal(f.api.retryDrillSave(),true);assert.equal(f.trace.writes,1);assert.equal(f.save.horses[0].xp,24);assert.equal(f.save.stats.jumps,8);
});
test('capped level-four jump practice earns horse XP and opens the level-five stat cap',()=>{
 const f=fixture({dynamicCaps:true,breedCap:8,horse:{level:4,xp:249,stats:{speed:4,stamina:4,jump:4,accel:4,agility:4},sxp:{jump:0}},
  drill:{stat:'jump',timeLimit:120,t:60,elapsed:60,grp:null,cones:[]}});
 assert.equal(f.api.endDrill(true),true);const r=f.save.lastTraining,h=f.save.horses[0];
 assert.deepEqual(r.before,{value:4,xp:0,cap:4});assert.deepEqual(r.after,{value:4,xp:0,cap:5});
 assert.equal(r.statXp,0);assert.equal(r.statRaised,0);assert.equal(r.growth.horseXp,24);assert.equal(r.growth.levels,1);
 assert.deepEqual(r.growth.before,{level:4,xp:249});assert.deepEqual(r.growth.after,{level:5,xp:23});
 assert.equal(h.level,5);assert.equal(h.xp,23);assert(h.stats.jump<r.after.cap,'this horse can now train Jump');
 assert.deepEqual(r.growth.statGains,{speed:1});assert.equal(r.progress.statsRaised,1);
 assert.equal(r.growth.nextTrainingLevel,10);assert.equal(r.growth.nextLevelXp,300);assert.equal(f.trace.writes,1);
});
test('level bonus stat gains count for progress without inflating drill stat XP or raises',()=>{
 const f=fixture({horse:{xp:99,stats:{speed:2,stamina:4,jump:4,accel:4,agility:4},sxp:{speed:0}},dailyGoals:{sxp:2}});
 assert.equal(f.api.endDrill(true),true);const r=f.save.lastTraining;
 assert.equal(r.statXp,46);assert.equal(r.statRaised,1);assert.equal(r.after.value,4);
 assert.deepEqual(r.growth.statGains,{speed:1});assert.equal(r.growth.horseXp,24);assert.equal(r.growth.after.level,2);assert.equal(r.growth.after.xp,23);
 assert.equal(r.progress.statsRaised,2);assert.equal(f.save.dq.prog.sxp,2);assert.equal(f.save.life.sxp,2);
 assert.equal(r.progress.cleanJumps,0);assert.equal(f.save.stats.jumps,undefined);assert.equal(f.save.story.prog,0);
});
test('MAX_LEVEL practice retains zero horse XP and no false leveling or future cap promise',()=>{
 const f=fixture({dynamicCaps:true,breedCap:10,horse:{level:50,xp:0,stats:{speed:10,stamina:10,jump:10,accel:10,agility:10},sxp:{jump:0}},
  drill:{stat:'jump',timeLimit:120,t:60,grp:null,cones:[]}});
 assert.equal(f.api.endDrill(true),true);const r=f.save.lastTraining;
 assert.equal(r.growth.horseXp,0);assert.equal(r.growth.levels,0);assert.deepEqual(r.growth.before,r.growth.after);
 assert.equal(r.growth.nextTrainingLevel,null);assert.deepEqual(r.growth.statGains,{});assert.equal(r.statXp,0);assert.equal(r.statRaised,0);
 assert.equal(f.save.horses[0].xp,0);assert.equal(f.save.stats.jumps,8);assert.equal(f.save.coins,164);assert.equal(f.trace.writes,1);
});
test('a jump session reaching MAX_LEVEL reports only horse XP retained before its ceiling',()=>{
 const f=fixture({dynamicCaps:true,breedCap:10,horse:{level:49,xp:2495,stats:{speed:10,stamina:10,jump:10,accel:10,agility:10},sxp:{jump:0}},
  drill:{stat:'jump',timeLimit:120,t:60,grp:null,cones:[]}});
 assert.equal(f.api.endDrill(true),true);const r=f.save.lastTraining;
 assert.equal(r.growth.horseXp,5);assert.equal(r.growth.levels,1);assert.deepEqual(r.growth.after,{level:50,xp:0});assert.equal(r.growth.nextTrainingLevel,null);
});
test('partial training credits only landed jumps and actual stat gains, never a completed drill',()=>{
 const f=fixture({drill:{stat:'jump',idx:3,timeLimit:120,t:0,grp:null,cones:[]},storyGoal:20});
 assert.equal(f.api.endDrill(false),true);const s=f.save,r=s.lastTraining;
 assert.equal(r.growth.horseXp,9);assert.equal(s.horses[0].xp,9);assert.equal(s.stats.jumps,3);assert.equal(s.story.prog,3);
 assert.deepEqual(s.moduleProgress,{cleanjump:3});assert.equal(s.life.cleanjump,3);assert.equal(s.life.drill,undefined);
 assert.equal(s.dq.prog.drill,undefined);assert.equal(s.stats.drills,2);assert.equal(r.progress.statsRaised,0);assert.equal(f.trace.writes,1);
});


test('a persisted clinic receipt reconciles story before later riding after a post-write throw',()=>{
 const f=fixture({failure:'after-write',storyGoal:20,drill:{stat:'jump',timeLimit:120,t:60,grp:null,cones:[]}});
 assert.equal(f.api.endDrill(true),false);assert.equal(f.save.story.prog,8);assert.equal(f.api.liveProgress().storyProg,0);
 f.failure=null;f.api.questEvt('cleanjump',1);
 assert.equal(f.save.story.prog,9);assert.equal(f.api.liveProgress().storyProg,9);assert.equal(f.trace.confirmations.length,0);
 assert.equal(f.trace.claims,0);assert.equal(f.trace.toasts.some(m=>/Daily quest done|Ride back and tell/.test(m)),false);
 const reads=f.trace.reads;for(let n=0;n<5;n++)f.api.missionDone();assert.equal(f.trace.reads,reads,'a reconciled pending run does not read storage every frame');
 assert.equal(f.api.retryDrillSave(),true);assert.equal(f.save.story.prog,9);assert.equal(f.save.lastTraining.progress.story.after,8);assert.equal(f.save.horses[0].xp,24);
});

test('failed initial receipt readback recovers silently when storage becomes readable before questEvt',()=>{
 const f=fixture({failure:'readback',storyGoal:20,drill:{stat:'jump',timeLimit:120,t:60,grp:null,cones:[]}});
 assert.equal(f.api.endDrill(true),false);assert.equal(f.save.story.prog,8);assert.equal(f.api.liveProgress().storyProg,0);
 f.failure=null;f.readsFail=false;f.api.questEvt('cleanjump',1);
 assert.equal(f.save.story.prog,9);assert.equal(f.api.liveProgress().storyProg,9);assert.equal(f.trace.confirmations.length,0);
 assert.equal(f.api.retryDrillSave(),true);assert.equal(f.save.story.prog,9);assert.equal(f.trace.claims,0);
});

test('recovery between questEvt entry read and save rebases its one new jump onto the durable cursor',()=>{
 const f=fixture({failure:'after-write',storyGoal:20,drill:{stat:'jump',timeLimit:120,t:60,grp:null,cones:[]}});
 f.api.endDrill(true);f.failure=null;f.failNextReads(1);f.api.questEvt('cleanjump',1);
 assert.equal(f.save.story.prog,9);assert.equal(f.api.liveProgress().storyProg,9);assert.equal(f.trace.claims,0);assert.equal(f.trace.confirmations.length,0);
 f.api.questEvt('cleanjump',1);assert.equal(f.save.story.prog,10,'new riding progress is counted once after reconciliation');
});

test('direct stale story writes cannot erase durable clinic credit',()=>{
 const f=fixture({failure:'after-write',storyGoal:20,drill:{stat:'jump',timeLimit:120,t:60,grp:null,cones:[]}});
 f.api.endDrill(true);f.failure=null;f.api.saveStory();
 assert.equal(f.save.story.prog,8);assert.equal(f.api.liveProgress().storyProg,8);assert.equal(f.trace.claims,0);assert.equal(f.trace.confirmations.length,0);
});

test('pending recovery reads an already claimed successor instead of replaying the receipt mission',()=>{
 const f=fixture({failure:'after-write',storyGoal:5,drill:{stat:'jump',timeLimit:120,t:60,grp:null,cones:[]}});
 f.api.endDrill(true);f.failure=null;f.persistStory({idx:1,prog:0,clues:['keep']});
 const oldMission={type:'cleanjump',goal:5,npc:'wren',reward:{c:999}},callback=f.api.makeClaimCallback(oldMission,0,true,{id:'wren'});
 callback();assert.equal(f.trace.claims,0,'the actual captured dialogue callback cannot pay the old mission');
 assert.deepEqual(f.save.story,{idx:1,prog:0,clues:['keep']});assert.deepEqual(f.api.liveProgress(),{storyIdx:1,storyProg:0,dailyKey:'cached'});
 f.api.questEvt('cleanjump',1);assert.equal(f.save.story.prog,0);assert.equal(f.api.retryDrillSave(),true);assert.equal(f.save.story.idx,1);assert.equal(f.save.story.prog,0);
 assert.equal(f.trace.toasts.some(m=>m.includes('Ride back and tell')),false,'retry must not announce an already claimed receipt mission');
 f.api.questEvt('photo',1);assert.equal(f.save.story.prog,1,'normal successor progress remains usable');
});

test('save-time recovery cannot rewind a successor when the entry read was unavailable',()=>{
 const f=fixture({failure:'after-write',storyGoal:20,drill:{stat:'jump',timeLimit:120,t:60,grp:null,cones:[]}});
 f.api.endDrill(true);f.failure=null;f.persistStory({idx:1,prog:0});f.failNextReads(1);f.api.questEvt('cleanjump',1);
 assert.deepEqual(f.save.story,{idx:1,prog:0});assert.equal(f.api.liveProgress().storyIdx,1);assert.equal(f.trace.claims,0);
 assert.equal(f.trace.toasts.some(m=>m.includes('Ride back and tell')),false);
});


test('an old dialogue cannot claim while all cursor reads fail or recover to a completed successor',()=>{
 const f=fixture({failure:'after-write',storyBefore:5,storyGoal:5,drill:{stat:'jump',timeLimit:120,t:60,grp:null,cones:[]}});
 f.api.endDrill(true);f.failure=null;f.persistStory({idx:1,prog:1});
 const callback=f.api.makeClaimCallback({type:'cleanjump',goal:5,npc:'wren',reward:{c:999}},0,true,{id:'wren'});
 f.failNextReads(2);callback();assert.equal(f.trace.claims,0);assert.deepEqual(f.save.story,{idx:1,prog:1});
 callback();assert.equal(f.trace.claims,0);assert.equal(f.api.liveProgress().storyIdx,1);assert.deepEqual(f.save.story,{idx:1,prog:1});
});

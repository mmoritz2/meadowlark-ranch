import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {horseProgressSnapshot,horseFinishGrowth,nextHorseChallenge} from '../assets/event-horse-growth.mjs';
const copy=structuredClone;
const before=horseProgressSnapshot({id:1,name:'Bramble',level:2,xp:73,bond:40});
const snap=h=>horseProgressSnapshot({id:1,name:'Bramble',level:2,xp:73,bond:40,...h});
test('saved level-two XP is separate from racing points and shows the actual remaining threshold',()=>{
 const growth=horseFinishGrowth(before,snap({xp:96,bond:49}));
 assert.equal(growth.horseXp,23);assert.equal(growth.levels,0);assert.equal(growth.nextLevelXp,150);assert.equal(growth.remaining,54);assert.equal(growth.bondGain,9);assert(Object.isFrozen(growth));assert(Object.isFrozen(growth.after));
});
test('level rollover, multiple levels and the maximum ceiling count only retained XP',()=>{
 const g=horseFinishGrowth(snap({xp:149}),snap({level:3,xp:22}));assert.equal(g.horseXp,23);assert.equal(g.remaining,178);assert.equal(g.levels,1);
 assert.equal(horseFinishGrowth(before,snap({level:4,xp:40})).horseXp,317);
 const end=horseFinishGrowth(snap({level:49,xp:2490}),snap({level:50,xp:0}));assert.equal(end.horseXp,10);assert.equal(end.atMax,true);assert.equal(end.remaining,0);assert.equal(end.nextLevelXp,0);
 assert.equal(horseFinishGrowth(snap({level:50,xp:0}),snap({level:50,xp:0})).horseXp,0);
});
test('missing, mismatched, decreasing or malformed saved snapshots cannot claim horse growth',()=>{
 for(const h of [null,{id:1,level:2,xp:150},{id:1,level:2,xp:NaN},{id:1,level:-1,xp:0},{id:1,level:50,xp:1},{id:{},level:2,xp:0}])assert.equal(horseProgressSnapshot(h),null);
 for(const after of [null,snap({id:2}),snap({xp:72}),snap({level:1,xp:10}),{...before,xp:Infinity}])assert.equal(horseFinishGrowth(before,after),null);
});
test('pure next challenge requires authoritative readiness and never mutates observations',()=>{
 const ev={id:'pp',name:'Pasture Pony Dash',race:true,lvl:1},diffs=[{k:'novice',label:'Novice'},{k:'open',label:'Open'},{k:'elite',label:'Elite'}],h={id:1,name:'Bramble',level:3};
 const input={event:ev,difficulty:'open',events:[ev],difficulties:diffs,horse:h,ready:(_,di)=>di===2},initial=copy({ev,diffs,h});
 assert.deepEqual(nextHorseChallenge(input),{eventId:'pp',difficulty:2,label:'Try Elite Pasture Pony Dash',harder:true});assert.deepEqual({ev,diffs,h},initial);
 assert.equal(nextHorseChallenge({...input,ready:()=>{throw Error('gate unavailable');}}),null);
 assert.equal(nextHorseChallenge({...input,event:{...ev,friendly:true}}),null);
 assert.equal(nextHorseChallenge({...input,difficulty:'unknown'}),null);
});

const ladder=fs.readFileSync(new URL('../assets/features/events2-ladder.js',import.meta.url),'utf8');
const core=fs.readFileSync(new URL('../ranch3d.html',import.meta.url),'utf8');
function section(source,a,b){const start=source.indexOf(a),end=source.indexOf(b,start+a.length);assert(start>=0&&end>start,'Actual production source boundary: '+a);return source.slice(start,end);}
const growthSource=section(ladder,' const courseHorseIds=new WeakMap();',' /* ================================================================= data');
const ribbonHook=section(ladder,' let lastRB=null, preFinish=null;',' const goldOf=');
const startHook=section(ladder," G.on('courseStart',c=>{"," G.on('courseTick',(c,dt,t)=>{");
const finishSource=section(ladder,' let LAST=null, cardT=null;',' /* ================================================================= the result card');
const lockSource=section(ladder,' function entryLock(ev,s,h){'," G.ui.panel({id:'resultPanel'");
const rankSource=section(ladder,' function rankBlock(L,s){',' function previewCard(');
const resultSource=section(ladder," G.ui.panel({id:'resultPanel'",' /* ================================================================= the ladder tab');
const actionSource=section(ladder," G.ui.action('lad',(a)=>{",' /* ================================================================= the event rows');
const xpSource=section(core,'function applyXp(s,h,n){','/* ================= terrain height');
function fixture({horse={},event={},diff='open'}={}){
 let disk={horses:[{id:1,name:'Bramble',breed:'bay-sporthorse',level:2,xp:73,bond:40,stats:{speed:4,stamina:4,jump:4,accel:4,agility:4},sxp:{},...horse},{id:2,name:'Clover',level:2,xp:100,bond:58,stats:{speed:4},sxp:{}}],coins:300,gems:2,keys:0,ridingHorseId:1,racing:{pts:255,claimed:{}},evDiff:1,lad:{rib:{total:0,byEv:{}},wk:{times:{},gold:{},score:{}},titles:[]},weekly:{gold:{}}};
 const flags={failWrite:false,failRead:false,throwRead:false,gate:true,region:true,mul:1,resume:null},trace={toasts:[],starts:[],opens:[],care:[],writes:0},events={},timers=[],panels={},actions={};
 const ev={id:'pp',name:'Pasture Pony Dash',town:'Meadowlark Ranch',race:true,lvl:1,reward:180,...event};
 const c={ev,t:24,par:30,started:true,race:true,jumps:[{x:0,z:0}],faults:0,rb:{acc:.9,diff},ce:{diff:{k:diff,label:diff},timeAllowed:42,grades:[],lineOff:0}};
 let active=c;
 const myHorses=copy(disk.horses),player={onFoot:false,flying:false,y:0,mesh:{}},rig={ready:true,loadingBreed:false,attachedTo:player.mesh,modelKey:'bay-sporthorse',requestedBreed:'bay-sporthorse',heroJumpAge:null};
 const G={xp:{MAX_LEVEL:50},horse:{ridden:()=>myHorses[ctx.rideIdx],RIG:()=>rig,breedModels:{resolve:breed=>breed}},save:{fresh(){if(flags.throwRead)throw Error('readback failed');return flags.failRead?null:copy(disk);},sync(fn){const draft=copy(disk);fn(draft);trace.writes++;if(!flags.failWrite)disk=draft;}},
  course:{get:()=>active,drillActive:()=>false,startCourse:(ev,di)=>trace.starts.push({event:ev.id,di}),eventOk:(ev,h)=>({ok:flags.gate&&h.level>=(ev.lvl||1),missing:flags.gate?[]:[ ['speed',7,h.stats?.speed||0] ]})},
  worldPkg:{regionUnlocked:()=>flags.region},ui:{panel:p=>panels[p.id]=p,action:(id,fn)=>actions[id]=fn,open:id=>trace.opens.push(id),rerender(){},renderLB(){},openEvents(){}},
  money:{rewardLabel:r=>Object.entries(r).map(([key,value])=>value+' '+key).join(' · ')},
  on:(name,fn)=>(events[name]??=[]).push(fn),toast:s=>trace.toasts.push(s),seCare:{open:tab=>trace.care.push(tab)},hidePanels(){},events2:{result:()=>null},sGem(){},sChime(){}};
 const diffs=[{k:'novice',label:'Novice',icon:'🌱',lvlAdd:0},{k:'open',label:'Open',icon:'🏇',lvlAdd:0},{k:'elite',label:'Elite',icon:'🔥',lvlAdd:2}];
 const RR=[{label:'Paddock Pony',icon:'🐴',at:0,r:{}},{label:'Bronze Bit',icon:'🥉',at:100,r:{c:300}},{label:'Silver Stirrup',icon:'🥈',at:300,r:{g:5}}];
 const E=()=>({RACE_RANKS:RR,rankIdx:pts=>pts>=300?2:pts>=100?1:0,tix:()=>0});
 const T={EVENTS3:[ev],REGIONS:[],RACE_ITEMS:{}};
 const ctx=vm.createContext({G,T,player,horseProgressSnapshot,horseFinishGrowth,nextHorseChallenge,DIFFS:()=>diffs,diffOf:k=>diffs.find(d=>d.k===k),E,evById:id=>T.EVENTS3.find(e=>e.id===id),ridden:G.horse.ridden,
  toast:G.toast,$:()=>null,clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),esc:s=>String(s??'').replace(/[&<>"]/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[x])),s1:v=>Number(v).toFixed(1),pc:v=>Math.round(v*100),
  setTimeout(fn){timers.push(fn);return timers.length;},clearTimeout(){},console,
  capture:null,captureAt:0,wasGold:false,FIELD:null,cardT:null,pendingRematch:null,
  resumeContext:()=>flags.resume,newRunId:()=>'actual-course-id',clearField(){},spawnField(){},goldOf:(_,rb)=>rb?.saved!==false&&rb?.gold===true,
  placeIn:()=>1,judgedOfWeek:()=>null,writeWeekly:()=>({best:null}),judgedRows:()=>[],champPath:()=>({ok:true}),seasonKey:()=>'frost',finalStandings:()=>[],
  tallyRibbons:()=>3,stripResidue(){},clearRun(){},fieldBlock:()=>'',scoreSheet:()=>'',previewCard:()=>'',featuredNow:()=>[],nextVenueHint:()=>'',weekLeft:()=>'1d',bandLabel:()=>'',claimRibTier(){},resumeRun(){},dropRun(){},
  MAX_LEVEL:50,STAT_KEYS:['speed','stamina','jump','accel','agility'],myHorses,rideIdx:0,syncSave:G.save.sync,freshSave:G.save.fresh,
  addSP(){},ensureStats(){},statCap:h=>Math.min(10,4+Math.floor((h.level||1)/5)),statCeil:()=>10,mulOf:()=>flags.mul,
  refreshWallet(){},sGem(){},sNeigh(){},reloadHorses(){}});
 vm.runInContext('let CARD={mode:"result"};\n'+growthSource+'\n'+ribbonHook+'\n'+startHook+'\n'+finishSource+'\n'+lockSource+'\n'+rankSource+'\n'+resultSource+'\n'+actionSource+'\n'+xpSource+'\nthis.API={last:()=>LAST,openCard,horseGrowthBlock,horseChallenge,rideHorseChallenge,addXp3D};',ctx);
 const run=(name,payload)=>events[name]?.forEach(fn=>fn(payload));
 return {ctx,G,flags,trace,T,ev,c,myHorses,player,rig,get disk(){return disk;},edit:fn=>fn(disk),choose:id=>{ctx.rideIdx=myHorses.findIndex(h=>h.id===id);},
  begin(){run('courseStart',c);},ribbons(){run('ribbons',{ev,rib:3,stars:3,gold:false,acc:.9,diff});},
  finish(){run('courseFinish',{c,ev,stars:3,RB:{rib:3,featured:false,gold:false,saved:true},pay:180,dressage:!!ev.dressage});active=null;},
  reward(n=23){ctx.API.addXp3D(n);},flush(){while(timers.length)timers.shift()();},render:()=>panels.resultPanel.render(null,copy(disk)),
  action:kind=>actions.lad([kind]),run,api:ctx.API};
}
function finish(f,{xp=23,bond=9}={}){f.begin();f.ribbons();f.finish();f.reward(xp);f.edit(s=>s.horses.find(h=>h.id===1).bond+=bond);f.flush();return f;}

test('actual finish listener waits for production XP award then result displays saved horse and independent rank',()=>{
 const f=fixture();f.begin();f.ribbons();f.finish();assert.equal(f.api.last().horseGrowth,null);assert.deepEqual(f.trace.opens,[]);
 f.reward();f.edit(s=>s.horses[0].bond=49);f.flush();const g=f.api.last().horseGrowth,html=f.render();assert.equal(g.horseXp,23);assert.equal(g.after.xp,96);
 assert.match(html,/Bramble · Horse level 2/);assert.match(html,/\+23 horse XP this ride/);assert.match(html,/96 \/ 150 horse XP · 54 XP to Lv 3/);assert.match(html,/\+9 bond this ride/);
 assert.match(html,/255 racing points/);assert.match(html,/Claim Bronze Bit/);assert.doesNotMatch(html,/255 horse XP|Horse level 255/);assert.match(html,/lad:horse-next/);
});
test('real applyXp rollover exposes level three and actual eligible Elite with explicit difficulty retention',()=>{
 const f=finish(fixture({horse:{xp:149}}));const html=f.render();assert.match(html,/Horse level 2 → 3/);assert.match(html,/22 \/ 200 horse XP · 178 XP to Lv 4/);assert.match(html,/Try Elite Pasture Pony Dash/);
 f.edit(s=>s.evDiff=0);f.action('horse-next');assert.deepEqual(f.trace.starts,[{event:'pp',di:2}]);
});
test('actual saved multiplier is displayed rather than a listed or guessed race reward',()=>{
 const f=fixture();f.flags.mul=1.5;finish(f);assert.equal(f.api.last().horseGrowth.horseXp,35);assert.match(f.render(),/\+35 horse XP this ride/);
});
test('saved rename and reorder keep the horse that finished, even when the selected horse changes before display',()=>{
 const f=fixture();f.begin();f.ribbons();f.finish();f.reward();f.edit(s=>{s.horses[0].name='Bramble Rose';s.horses.reverse();});f.choose(2);f.flush();assert.equal(f.api.last().horseGrowth.horseId,1);assert.match(f.render(),/Bramble Rose · Horse level 2/);assert.doesNotMatch(f.render(),/Clover · Horse level/);
 f.action('horse-next');assert.deepEqual(f.trace.starts,[]);assert.deepEqual(f.trace.care,['myhorses']);assert.match(f.trace.toasts.at(-1),/Choose Bramble Rose/);
});
test('missing horse, failed write, stale readback or unavailable readback never invent saved growth',()=>{
 const write=fixture({horse:{xp:149}});write.begin();write.ribbons();write.finish();write.flags.failWrite=true;write.reward();write.ctx.capture=['🏵️ Magnificent ribbon! +9 bond','🎉 Bramble trained up to level 3!'];write.flush();assert.equal(write.api.last().horseGrowth.horseXp,0);assert.equal(write.api.last().horseGrowth.after.level,2);assert.doesNotMatch(write.render(),/XP this ride|bond this ride|→ 3|trained up|\+9 bond/);
 const stale=fixture();stale.begin();stale.ribbons();stale.finish();stale.flush();assert.doesNotMatch(stale.render(),/XP this ride|bond this ride/);stale.reward();stale.api.openCard();assert.equal(stale.api.last().horseGrowth.horseXp,0,'reopening a past card cannot capture later XP');
 for(const mode of ['missing','unavailable']){const f=fixture();f.begin();f.ribbons();f.finish();if(mode==='missing')f.edit(s=>s.horses=s.horses.filter(h=>h.id!==1));else f.flags.failRead=true;f.flush();assert.equal(f.api.last().horseGrowth,null);assert.match(f.render(),/Saved horse progress is unavailable/);assert.doesNotMatch(f.render(),/XP this ride|bond this ride|lad:horse-next/);}
});
test('invalid/decreasing saved horse values and stale course baselines withhold the progress claim',()=>{
 for(const mutate of [h=>h.xp=NaN,h=>h.xp=72,h=>h.level=1]){const f=fixture();f.begin();f.ribbons();f.finish();f.edit(s=>mutate(s.horses[0]));f.flush();assert.equal(f.api.last().horseGrowth,null);assert.doesNotMatch(f.render(),/XP this ride/);}
 const f=fixture();f.begin();f.ribbons();f.c.ladRunId='different-run';f.finish();f.reward();f.flush();assert.equal(f.api.last().horseGrowth,null);
});
test('MAX_LEVEL uses production cap and cannot promise discarded XP or a level fifty-one',()=>{
 const f=finish(fixture({horse:{level:50,xp:0}}));assert.equal(f.api.last().horseGrowth.horseXp,0);assert.match(f.render(),/Maximum horse level reached/);assert.doesNotMatch(f.render(),/XP saved|XP to Lv 51/);
 const end=finish(fixture({horse:{level:49,xp:2490}}));assert.equal(end.api.last().horseGrowth.horseXp,10);assert.match(end.render(),/\+10 horse XP this ride/);assert.match(end.render(),/Horse level 49 → 50/);
});
test('next ride excludes locked stats and regions and rechecks them at the actual button action',()=>{
 const f=finish(fixture({horse:{xp:149}}));f.T.REGIONS=[{name:'Meadowlark Ranch scenery'},{name:'Meadowlark Ranch venue',venue:true,unlock:'ribbon'}];f.flags.region=false;assert.doesNotMatch(f.render(),/lad:horse-next/);f.action('horse-next');assert.deepEqual(f.trace.starts,[]);
 f.flags.region=true;f.flags.gate=false;assert.doesNotMatch(f.render(),/lad:horse-next/);assert.match(f.render(),/lad:horse-prepare/);f.action('horse-next');assert.deepEqual(f.trace.starts,[]);
});
test('a genuinely available higher event retains the completed grade; reserved or judged-mismatch events are excluded',()=>{
 const f=finish(fixture({horse:{level:5,xp:0},diff:'elite'}));f.T.EVENTS3.push({id:'r1',name:'Kestrel Grand Loop',town:'Kestrel Basin',race:true,lvl:3},{id:'fake',name:'Do not enter',race:true,lvl:2,friendly:true});
 assert.match(f.render(),/Ride Kestrel Grand Loop/);f.action('horse-next');assert.deepEqual(f.trace.starts,[{event:'r1',di:2}]);
});
test('friendly/reserved/Rush scopes remain outside horse-growth presentation; dressage still reads saved XP',()=>{
 for(const event of [{friendly:true},{id:'fr'},{id:'dance'}]){const f=finish(fixture({event}));assert.doesNotMatch(f.render(),/ladHorseGrowth|XP saved|lad:horse-next/);}
 const rush=fixture({event:{rush:true}});rush.begin();rush.ribbons();rush.finish();rush.flush();assert.equal(rush.api.last(),null);
 const dressage=finish(fixture({event:{dressage:true,race:false}}));assert.match(dressage.render(),/\+23 horse XP this ride/);
});

test('next-event button requires the same saved mount, attached ready model and a grounded horse',()=>{
 for(const change of [f=>f.edit(s=>s.ridingHorseId=2),f=>f.rig.ready=false,f=>f.rig.loadingBreed=true,f=>f.rig.attachedTo={},f=>f.rig.modelKey='wrong-model',f=>f.rig.requestedBreed='pinto',f=>f.player.onFoot=true,f=>f.player.flying=true,f=>f.rig.heroJumpAge=.4]){
  const f=finish(fixture({horse:{xp:149}}));change(f);f.action('horse-next');assert.deepEqual(f.trace.starts,[]);assert(f.trace.toasts.length>0);
 }
});

test('actual course-start baseline includes eight riding XP before the finish reward, with confirmed full-ride bond',()=>{
 const f=fixture({horse:{xp:97,bond:40}});f.begin();f.reward(8);f.edit(s=>s.horses[0].bond=42);f.ribbons();f.finish();
 assert.equal(f.api.last().horseBefore.xp,97);assert.equal(f.api.last().finishHorseBefore.xp,105);assert(Object.isFrozen(f.api.last().horseBefore));
 f.reward(24);f.edit(s=>s.horses[0].bond=51);f.flush();assert.equal(f.api.last().horseGrowth.horseXp,32);assert.equal(f.api.last().horseGrowth.bondGain,11);
 const html=f.render();assert.match(html,/\+32 horse XP this ride/);assert.match(html,/129 \/ 150 horse XP · 21 XP to Lv 3/);assert.match(html,/\+11 bond this ride/);
});
test('a level-up earned while riding remains visible in the finish growth recap',()=>{
 const f=fixture({horse:{xp:147}});f.begin();f.reward(8);f.ribbons();f.finish();assert.equal(f.api.last().finishHorseBefore.level,3);
 f.reward(24);f.flush();const g=f.api.last().horseGrowth;assert.equal(g.levels,1);assert.equal(g.horseXp,32);assert.equal(g.after.level,3);assert.equal(g.after.xp,29);
 assert.match(f.render(),/Horse level 2 → 3/);assert.match(f.render(),/\+32 horse XP this ride/);assert.match(f.render(),/Try Elite/);
});
test('a resumed course reports only its observed saved segment, without inventing the unobserved earlier start',()=>{
 const f=fixture({horse:{xp:105}});f.flags.resume={runId:'resumed-course-id'};f.begin();f.reward(8);f.ribbons();f.finish();f.reward(24);f.flush();
 assert.equal(f.api.last().horseGrowth.horseXp,32);assert.equal(f.api.last().horseBefore.xp,105);assert.match(f.render(),/\+32 horse XP since resuming/);assert.doesNotMatch(f.render(),/horse XP this ride/);
});
test('missing start readback cannot use a later finish snapshot to claim full-ride growth',()=>{
 const f=fixture();f.flags.failRead=true;f.begin();f.flags.failRead=false;f.reward(8);f.ribbons();f.finish();f.reward(24);f.flush();
 assert.equal(f.api.last().horseBefore,null);assert.equal(f.api.last().finishHorseBefore.xp,81);assert.equal(f.api.last().horseGrowth,null);assert.doesNotMatch(f.render(),/horse XP this ride|bond this ride/);
});
test('a failed finish XP write retains only actually saved riding gains in the full-ride recap',()=>{
 const f=fixture({horse:{xp:97}});f.begin();f.reward(8);f.ribbons();f.finish();f.flags.failWrite=true;f.reward(24);f.flush();
 assert.equal(f.api.last().horseGrowth.horseXp,8);assert.match(f.render(),/\+8 horse XP this ride/);assert.doesNotMatch(f.render(),/\+32 horse XP this ride|\+24 horse XP this ride/);
});

test('saved capped bond remains visible without an invented positive gain or perk',()=>{
 const f=fixture({horse:{bond:100}});f.begin();f.ribbons();f.finish();f.reward();f.flush();assert.equal(f.api.last().horseGrowth.bondGain,0);
 const html=f.render();assert.match(html,/Bond 100 \/ 100/);assert.doesNotMatch(html,/\+\d+ bond this ride|6% pace/);
 const unknown=fixture({horse:{bond:undefined}});unknown.begin();unknown.ribbons();unknown.finish();unknown.reward();unknown.flush();assert.doesNotMatch(unknown.render(),/Bond .* \/ 100/);
});

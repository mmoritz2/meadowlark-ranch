import test from 'node:test';
import assert from 'node:assert/strict';
import {blankRallyCounts,rallyCounts,rallyPoints,mergeRallyCounts,creditRallyRun,sanitizeRallySave,mergeRallyParticipant,applyRallyClaim,rallyView} from '../assets/features/club-rally-rules.mjs';
import {install} from '../assets/features/club-rally.js';
const copy=v=>JSON.parse(JSON.stringify(v)),WEEK='2026-10-05';
const counts=delta=>({...blankRallyCounts(),...delta});
const context={code:'club-a',clubName:'Pine Riders',week:WEEK,id:'rider-a',joined:true,connected:false};
const pay=(s,r)=>{s.coins=(s.coins||0)+r.c;s.gems=(s.gems||0)+r.g;};
function initial(pid='rider-a'){
 return {pid,ridingClub:'club-a',coins:100,gems:0,clubRecords:{'club-a':{meta:{name:'Pine Riders',founder:'Avery',founderId:'rider-a'},members:{}}},stats:{trails:0}};
}
function harness(seed=initial()){
 let saved=copy(seed),fail=false,wk=WEEK,course=null,rushActive=null,rushLast=null,rescueActive=null,rescueLast=null,roundActive=null,roundLast=null,trail=null;
 const hooks=new Map(),events=[],packets=[],subscribed=[],starts=[];
 const G={
  save:{ensure(){},fresh:()=>copy(saved),sync:fn=>{const next=copy(saved);fn(next);if(!fail)saved=next;}},
  on:(k,fn)=>{if(!hooks.has(k))hooks.set(k,[]);hooks.get(k).push(fn);},run:(k,...args)=>{events.push({k,args});for(const fn of hooks.get(k)||[])fn(...args);},
  time:{isoWeekKey:()=>wk},
  clubs:{identity(s=saved){const code=s.ridingClub||'',r=s.clubRecords?.[code],m=r?.meta||{};return {code,...m,canCreate:!m.founder&&!r?.pendingJoin,pendingJoin:!!r?.pendingJoin};}},
  net:{net:{id:seed.pid||'rider-a',club:'meadowlark-commons',client:{connected:false}},myName:()=>seed.pid==='rider-b'?'Bailey':'Avery',subscribe:t=>subscribed.push(t),publish:(t,m,o)=>{packets.push({t,m:{id:seed.pid||'rider-a',n:seed.pid==='rider-b'?'Bailey':'Avery',...m},o});return true;}},
  money:{payReward:pay,refreshWallet(){}},horse:{player:{y:0},RIG:()=>({ready:true})},
  course:{get:()=>course,drillActive:()=>false},
  ranchRush:{snapshot:()=>({active:rushActive,lastResult:rushLast}),get lastResult(){return rushLast;},start(id){course={ev:{id,rush:true}};rushActive={id,elapsed:0};rushLast=null;starts.push(['rush',id]);G.run('rushStart',rushActive);return true;}},
  rescueRide:{snapshot:()=>({active:rescueActive,lastResult:rescueLast}),start(){rescueActive={id:'clover',stage:'find',clues:0,elapsed:0};rescueLast=null;starts.push(['rescue']);G.run('rescueStart',rescueActive);return true;}},
  roundup:{state:()=>({active:!!roundActive,...roundActive,lastResult:roundLast}),start(mode){roundActive={mode,elapsed:0,countdown:3};roundLast=null;starts.push(['roundup',mode]);G.run('roundupStart',{active:true,...roundActive});return true;}},
  trail:{get ride(){return trail;},start(pts,by,opts){trail={pts,idx:0,t:0,...opts};starts.push(['trail',opts.exped]);G.run('trailStart',trail);return true;}},
  social:{EXPEDITIONS:[{id:'basin',name:'Basin Loop',stops:[['A',0,0],['B',100,0]]}]},
  worldPkg:{vehicle:()=>false,lockedRegionsAt:()=>[]},hidePanels(){},seFrame:{settle(){}}
 };
 install(G);
 const update=fn=>{fn(saved);};
 function finishRush(runId='rush-1',medal='gold'){
  const id=rushActive?.id||'rush-pasture',r=Object.freeze({id,runId,medal,name:'Pasture Dash'});
  update(s=>{s.ranchRush??={version:1,records:{}};const old=s.ranchRush.records[id];s.ranchRush.records[id]={plays:(old?.plays||0)+1,lastRunId:runId};});
  rushActive=null;rushLast=r;course=null;G.run('rushFinish',r);return r;
 }
 function finishRescue(runId='rescue-1',persist=true){
  const r=Object.freeze({id:'clover',runId,name:'Bring Clover Home'});
  if(persist)update(s=>{s.rescueRides={completions:(s.rescueRides?.completions||0)+1,lastRunId:runId};});rescueActive=null;rescueLast=r;G.run('rescueFinish',r);return r;
 }
 function finishRoundup(runId='round-1',penned=3){
  const mode=roundActive?.mode||'beginner',r=Object.freeze({mode,runId,penned,total:mode==='full'?5:3,name:'Roundup'});
  update(s=>{s.roundupBest??={};s.roundupBest[mode]={plays:(s.roundupBest[mode]?.plays||0)+1,lastRunId:runId};});roundActive=null;roundLast=r;G.run('roundupFinish',r);return r;
 }
 function finishTrail(){const r=trail;r.idx=r.pts.length;r.t=30;update(s=>s.stats.trails++);G.run('trailDone',r);trail=null;return r;}
 return {G,events,packets,subscribed,starts,update,finishRush,finishRescue,finishRoundup,finishTrail,get save(){return copy(saved);},fail(v=true){fail=v;},setWeek(v){wk=v;},receive(p){G.run('message',p.t,p.m);}};
}
test('rally scoring derives points from exact activity and medal counters',()=>{
 assert.equal(rallyPoints(counts({rush:4,bronze:1,silver:1,gold:1,rescue:1,penned:5,trails:1})),140);
 for(const bad of [null,[],{},counts({rush:'1'}),counts({rush:Infinity}),counts({rush:-1}),counts({rush:0,gold:1}),counts({trails:10001})])assert.equal(rallyCounts(bad),null);
 assert.equal(mergeRallyCounts(counts({rush:1,gold:1}),counts({rush:1,silver:1})),null);
});
test('accepted run IDs are deduplicated across reload; malformed and empty roundup results pay no points',()=>{
 const args={...context,name:'Avery',kind:'rush',runId:'genuine-1',result:{medal:'silver'},at:1};
 const first=creditRallyRun(null,args);assert.equal(first.receipt.points,20);
 const second=creditRallyRun(copy(first.save),args);assert.equal(second.receipt,null);assert.equal(rallyView(second.save,context).mine,20);
 for(const extra of [{runId:'../bad'},{kind:'roundup',result:{penned:0}},{kind:'roundup',result:{penned:6}},{kind:'rush',result:{medal:'platinum'}}])assert.equal(creditRallyRun(first.save,{...args,...extra}).receipt,null);
});
test('cumulative peer snapshots use component maxima and never replay packet increments',()=>{
 const p={...context,name:'Bailey',id:'rider-b',counts:counts({rush:2,gold:1,rescue:1})};
 const first=mergeRallyParticipant(null,p);assert.equal(rallyView(first.save,context).total,60);
 const repeated=mergeRallyParticipant(first.save,p);assert.equal(repeated.changed,false);
 const older=mergeRallyParticipant(repeated.save,{...p,counts:counts({rush:1,gold:1})});assert.equal(older.changed,false);
 const newer=mergeRallyParticipant(older.save,{...p,counts:counts({rush:3,gold:2,rescue:1})});assert.equal(rallyView(newer.save,context).total,85);
});
test('rewards require own participation and persist once per tier and week across clubs',()=>{
 const s=initial();s.clubRally=mergeRallyParticipant(null,{...context,id:'rider-b',name:'Bailey',counts:counts({rescue:20})}).save;
 assert.equal(applyRallyClaim(s,'bronze',context,pay).ok,false);
 s.clubRally=mergeRallyParticipant(s.clubRally,{...context,name:'Avery',counts:counts({rush:1})}).save;
 for(const tier of ['bronze','silver','gold'])assert.equal(applyRallyClaim(s,tier,context,pay,2).ok,true);
 assert.equal(s.coins,1550);assert.equal(s.gems,9);assert.equal(s.clubRally.claims[WEEK],7);
 for(const tier of ['bronze','silver','gold'])assert.equal(applyRallyClaim(s,tier,context,pay).ok,false);
 const other={...context,code:'club-b'};s.clubRally=mergeRallyParticipant(s.clubRally,{...other,name:'Avery',counts:counts({rescue:20})}).save;
 assert.equal(applyRallyClaim(s,'gold',other,pay).ok,false);assert.equal(s.coins,1550);
 const next={...context,week:'2026-10-12'};s.clubRally=mergeRallyParticipant(s.clubRally,{...next,name:'Avery',counts:counts({rescue:20})}).save;
 assert.equal(applyRallyClaim(s,'gold',next,pay).ok,true);
});
test('trophy display is bounded while old claim masks remain permanent',()=>{
 const s=initial();
 for(let i=0;i<20;i++){
  const date=new Date(WEEK+'T00:00:00Z');date.setUTCDate(date.getUTCDate()+7*i);const c={...context,week:date.toISOString().slice(0,10)};
  s.clubRally=mergeRallyParticipant(s.clubRally,{...c,name:'Avery',counts:counts({rescue:20})}).save;
  assert.equal(applyRallyClaim(s,'gold',c,pay,i).ok,true);
 }
 const saved=sanitizeRallySave(copy(s.clubRally));assert.equal(saved.trophies.length,12);assert.equal(Object.keys(saved.claims).length,20);assert.equal(saved.claims[WEEK],4);
 assert.equal(rallyView(saved,context).lifetime.trophies,20);assert.equal(rallyView(saved,context).lifetime.bestTier,'gold');
});
test('forged finish hooks and unjoined or pending clubs receive no credit',()=>{
 const h=harness();
 h.G.run('rushFinish',{id:'rush-pasture',runId:'fake',medal:'gold'});h.G.run('rescueFinish',{id:'clover',runId:'fake'});h.G.run('roundupFinish',{mode:'full',runId:'fake',penned:5});
 assert.equal(h.G.clubRally.snapshot().mine,0);
 for(const seed of [{...initial(),ridingClub:''},{...initial(),clubRecords:{'club-a':{pendingJoin:true,meta:{}}}},{...initial(),clubRecords:{}}]){
  const empty=harness(seed);assert.equal(empty.G.clubRally.snapshot().joined,false);assert.equal(empty.G.clubRally.start('rush').ok,false);assert.equal(empty.G.clubRally.claim('bronze').ok,false);
 }
});
test('actual Rush, rescue, roundup and trail finishes earn points once and emit receipts',()=>{
 const h=harness();assert.equal(h.G.clubRally.start('rush').ok,true);const rush=h.finishRush();assert.equal(h.G.clubRally.snapshot().mine,25);
 h.G.run('rushFinish',rush);assert.equal(h.G.clubRally.snapshot().mine,25);
 assert.equal(h.G.clubRally.start('rescue').ok,true);const rescue=h.finishRescue();assert.equal(h.G.clubRally.snapshot().mine,50);h.G.run('rescueFinish',rescue);
 assert.equal(h.G.clubRally.start('roundup','full').ok,true);h.finishRoundup('full-1',5);assert.equal(h.G.clubRally.snapshot().mine,75);
 assert.equal(h.G.clubRally.start('trail').ok,true);const trail=h.finishTrail();assert.equal(h.G.clubRally.snapshot().mine,95);h.G.run('trailDone',trail);
 assert.equal(h.G.clubRally.snapshot().mine,95);assert.equal(h.events.filter(e=>e.k==='clubRallyContribution').length,4);
 assert.deepEqual(h.G.clubRally.snapshot().counts,counts({rush:1,gold:1,rescue:1,penned:5,trails:1}));
 const loaded=harness(h.save);assert.equal(loaded.G.clubRally.snapshot().mine,95);assert.equal(loaded.G.clubRally.snapshot().milestones[0].ready,true);
});
test('finish object identity and persisted activity record both must verify',()=>{
 const h=harness();h.G.clubRally.start('rush');
 const fake={id:'rush-pasture',runId:'fake',medal:'gold'};h.update(s=>{s.ranchRush={records:{'rush-pasture':{plays:1,lastRunId:'fake'}}};});h.G.run('rushFinish',fake);
 assert.equal(h.G.clubRally.snapshot().mine,0);
 h.finishRush('real');assert.equal(h.G.clubRally.snapshot().mine,25);
 const noSaved=harness();noSaved.G.clubRally.start('rescue');noSaved.finishRescue('unsaved',false);assert.equal(noSaved.G.clubRally.snapshot().mine,0);
 const failedCredit=harness();failedCredit.G.clubRally.start('rescue');failedCredit.fail();failedCredit.finishRescue();assert.equal(failedCredit.G.clubRally.snapshot().mine,0);assert.equal(failedCredit.events.filter(e=>e.k==='clubRallyContribution').length,0);
});
test('membership changes and weekly rollover invalidate started activities',()=>{
 const h=harness();h.G.clubRally.start('rescue');h.update(s=>{s.ridingClub='club-b';s.clubRecords['club-b']={meta:{name:'Birch',founder:'Avery',founderId:'rider-a'}};});h.G.run('clubChanged','club-b','club-a');h.finishRescue();assert.equal(h.G.clubRally.snapshot().mine,0);
 h.G.clubRally.start('rush');h.setWeek('2026-10-12');h.finishRush();assert.equal(h.G.clubRally.snapshot().mine,0);
 h.setWeek(WEEK);h.update(s=>s.ridingClub='club-a');h.G.run('clubChanged','club-a');assert.equal(h.G.clubRally.snapshot().mine,0);
});
test('fake peer transport waits for accepted member metadata and rejects wrong scopes or malformed snapshots',()=>{
 const a=harness(),b=harness(initial('rider-b'));b.G.clubRally.start('rescue');b.finishRescue();
 const packet=b.packets.at(-1);assert.equal(packet.t,`srf1/club-a/clubrally/${WEEK}/rider-b`);assert.equal(packet.o.retain,true);
 a.receive(packet);assert.equal(a.G.clubRally.snapshot().total,0);
 a.update(s=>s.clubRecords['club-a'].members['rider-b']={n:'Bailey',wk:WEEK,left:false});a.G.run('message','srf1/club-a/members/rider-b',{id:'rider-b'});
 assert.equal(a.G.clubRally.snapshot().total,25);assert.equal(a.G.clubRally.snapshot().mine,0);a.receive(packet);assert.equal(a.G.clubRally.snapshot().total,25);
 for(const p of [{...packet,t:packet.t.replace('club-a','club-b')},{...packet,m:{...packet.m,week:'2026-09-28'}},{...packet,m:{...packet.m,id:'rider-c'}},{...packet,m:{...packet.m,counts:counts({rush:Infinity})}},{...packet,m:{...packet.m,counts:counts({rush:0,gold:5})}}])a.receive(p);
 assert.equal(a.G.clubRally.snapshot().total,25);
 a.update(s=>s.clubRecords['club-a'].members['rider-b'].left=true);a.receive({...packet,m:{...packet.m,counts:counts({rescue:20})}});assert.equal(a.G.clubRally.snapshot().total,25);
});
test('pending snapshots retain maxima when an older packet arrives before member metadata',()=>{
 const h=harness(),packet=n=>({t:`srf1/club-a/clubrally/${WEEK}/rider-b`,m:{id:'rider-b',week:WEEK,counts:counts({rescue:n})}});
 h.receive(packet(3));h.receive(packet(1));assert.equal(h.G.clubRally.snapshot().total,0);
 h.update(s=>s.clubRecords['club-a'].members['rider-b']={n:'Bailey',wk:WEEK,left:false});h.G.run('message','srf1/club-a/members/rider-b',{id:'rider-b'});
 assert.equal(h.G.clubRally.snapshot().total,75);h.receive(packet(1));assert.equal(h.G.clubRally.snapshot().total,75);
 const quiet=harness();quiet.receive(packet(3));quiet.update(s=>s.clubRecords['club-a'].members['rider-b']={n:'Bailey',wk:WEEK,left:false});quiet.receive(packet(1));
 assert.equal(quiet.G.clubRally.snapshot().total,75);
});
test('repeated pending snapshots do not extend their original metadata wait expiry',t=>{
 let clock=1000;t.mock.method(Date,'now',()=>clock);
 const h=harness(),packet=n=>({t:`srf1/club-a/clubrally/${WEEK}/rider-b`,m:{id:'rider-b',week:WEEK,counts:counts({rescue:n})}});
 h.receive(packet(3));clock=100000;h.receive(packet(1));clock=121001;
 h.update(s=>s.clubRecords['club-a'].members['rider-b']={n:'Bailey',wk:WEEK,left:false});h.G.run('message','srf1/club-a/members/rider-b',{id:'rider-b'});
 assert.equal(h.G.clubRally.snapshot().total,0);
 h.receive(packet(2));assert.equal(h.G.clubRally.snapshot().total,50);
});
test('only exact authored expedition trails earn rally credit, including live club routes',()=>{
 const attempts=[
  {pts:[['A',0,0],['B',0,0]],opts:{name:'Custom'}},
  {pts:[['A',0,0],['B',0,0]],opts:{name:'Counterfeit',exped:'basin'}},
  {pts:[['A',0,0],['B',100,0]],opts:{name:'Custom matching pins'}},
  {pts:[['A',0,0],['B',100,0],['C',0,0]],opts:{exped:'basin'}},
  {pts:[['A',0,0],['B',100,0]],opts:{exped:'unknown'}}
 ];
 for(const a of attempts){const h=harness();h.G.trail.start(a.pts,'Avery',a.opts);h.finishTrail();assert.equal(h.G.clubRally.snapshot().mine,0);}
 const changed=harness();changed.G.clubRally.start('trail');changed.G.trail.ride.pts[1][1]=0;changed.finishTrail();assert.equal(changed.G.clubRally.snapshot().mine,0);
 const live=harness();live.G.trail.start(copy(live.G.social.EXPEDITIONS[0].stops),'Bailey',{name:'Club morning ride',exped:'basin',clubRideId:'live-basin'});live.finishTrail();assert.equal(live.G.clubRally.snapshot().mine,20);
});
test('storage failure does not announce a claim and retry/reload cannot duplicate payment',()=>{
 const h=harness();h.update(s=>{s.clubRally=mergeRallyParticipant(null,{...context,name:'Avery',counts:counts({rescue:20})}).save;});
 h.fail();assert.equal(h.G.clubRally.claim('bronze').ok,false);assert.equal(h.save.coins,100);assert.equal(h.events.filter(e=>e.k==='clubRallyClaim').length,0);
 h.fail(false);assert.equal(h.G.clubRally.claim('bronze').ok,true);assert.equal(h.save.coins,300);assert.equal(h.save.gems,1);assert.equal(h.G.clubRally.claim('bronze').ok,false);
 const loaded=harness(h.save);assert.equal(loaded.G.clubRally.claim('bronze').ok,false);assert.equal(loaded.save.coins,300);
});
test('activity entry rejects existing activities, flight and locked trails without replacing them',()=>{
 const h=harness();assert.equal(h.G.clubRally.start('rush','rush-river').ok,true);assert.equal(h.G.clubRally.start('rescue').ok,false);assert.equal(h.starts.length,1);h.finishRush();
 h.G.horse.player.flying=true;assert.equal(h.G.clubRally.start('roundup').ok,false);h.G.horse.player.flying=false;
 h.G.worldPkg.lockedRegionsAt=()=>['highlands'];assert.equal(h.G.clubRally.start('trail').ok,false);assert.equal(h.starts.length,1);
});
test('malformed saves sanitize without prototype keys, invalid weeks or unbounded display rows',()=>{
 const bad=JSON.parse('{"claims":{"2026-10-05":7,"2026-10-06":7,"constructor":7,"2026-02-30":7},"clubs":{"__proto__":{"weeks":{}},"valid":{"weeks":{"2026-10-05":{"riders":{"constructor":{"name":"Oops","counts":{}},"valid":{"counts":null}},"seen":["rush:valid","rush:../bad"],"latestContribution":null}}}},"trophies":[null,{},7]}');
 const s=sanitizeRallySave(bad);assert.deepEqual(Object.keys(s.claims),[WEEK]);assert.deepEqual(Object.keys(s.clubs),['valid']);assert.deepEqual(s.clubs.valid.weeks[WEEK].riders,{});assert.deepEqual(s.clubs.valid.weeks[WEEK].seen,['rush:valid']);assert.deepEqual(s.trophies,[]);
});

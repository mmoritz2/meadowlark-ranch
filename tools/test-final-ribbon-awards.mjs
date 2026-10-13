/* Actual awardRibbons and ordered package hooks, with actual race score and
 * bounded receipt helpers. Storage/audio/NPC outputs are the only mocks. */
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import {createHash} from 'node:crypto';
import {createRibbonAward,recordRibbonAward,verifiedRibbonAward} from '../assets/ribbon-awards.mjs';
import {normalizeRibbonAwardSource} from './ribbon-award-source-guard.cjs';
import {normalizeRidingDistanceSource} from './riding-distance-source-guard.cjs';
import {normalizeStarterTackSource,normalizePublishedCacheSource} from './starter-tack-source-guard.cjs';
const read=name=>fs.readFileSync(new URL('../'+name,import.meta.url),'utf8'),core=read('ranch3d.html'),engine=read('assets/features/course-engine.js'),disc=read('assets/features/events2-disciplines.js'),breeding=read('assets/features/breeding.js');
function section(text,a,b){const i=text.indexOf(a),j=text.indexOf(b,i);assert(i>=0&&j>i,a);return text.slice(i,j);}
const award=section(core,'function awardRibbons(ev,t,faults,extra){','/* Judging a fence.'),engineHooks=section(engine," G.on('ribbons',RB=>{",' G.quest.types.ribbons='),raceHook=section(disc," G.on('ribbons',RB=>{",' /* Every finish used to put up two cards'),raceScore=section(disc,' function commitGate(){'," G.on('courseTick'");
function fixture({gate=.63,seed={},kind='race',runId='actual-course-1',withBreeding=false}={}){
 let saved=structuredClone(seed),mode='normal',freshBlocked=false,writes=0;const emitted=[],hooks=new Map(),ev={id:'pp',name:'Pasture Pony Dash'},course={ev,started:true,t:22.6,par:41,ladRunId:runId,ce:{kind,grades:[],lineOff:0},rb:{acc:1}};
 const weekKey=stamp=>{const d=new Date(stamp||Date.now()),day=(d.getUTCDay()+6)%7;return new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()-day)).toISOString().slice(0,10);};
 const G={time:{isoWeekKey:weekKey},on(n,fn){if(!hooks.has(n))hooks.set(n,[]);hooks.get(n).push(fn);},run(n,...args){if(n==='ribbonsAwarded')emitted.push({kind:'receipt',receipt:args[0]});for(const f of hooks.get(n)||[])f(...args);},save:{fresh:()=>freshBlocked?null:structuredClone(saved)},course:{get:()=>course},quest:{questEvt:(type,val)=>emitted.push({kind:'quest',type,val}),dailyEvt:(type,val)=>emitted.push({kind:'daily',type,val})}};
 function syncSave(fn){const draft=structuredClone(saved);fn(draft);writes++;if(mode==='before-failure')return;saved=draft;if(mode==='after-failure')return;}
 G.save.sync=syncSave;
 const ctx=vm.createContext({G,course,createRibbonAward,recordRibbonAward,verifiedRibbonAward,freshSave:G.save.fresh,fresh:G.save.fresh,syncSave,sync:syncSave,Date,Math,setTimeout:()=>0,toast:()=>{},clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),priceGrades(){},CUR:{gateN:6,gateSum:(1-gate)*4.6*6,watch:null,hazHits:0,goldBefore:!!seed.ribbonGold?.pp},eventPar:()=>41,weeklyFeatured:()=>[],ensureWeek(s){s.ribbons=s.ribbons||{};s.weekly=s.weekly||{rib:{}};},addSP:(s,n)=>{s.sp=s.sp||{pts:0};s.sp.pts+=n;}});
 vm.runInContext(raceScore+engineHooks+raceHook+award,ctx);
 if(withBreeding)vm.runInContext(section(breeding," G.on('ribbonsAwarded',receipt=>{"," G.on('passClaim'"),ctx);
 return {ctx,G,course,ev,emitted,get saved(){return saved;},get writes(){return writes;},mode:v=>{mode=v;},blockFresh:v=>{freshBlocked=v;},finish:(extra={})=>ctx.awardRibbons(ev,22.6,0,{acc:1,diff:'open',...extra})};
}
const events=(f,type)=>f.emitted.filter(e=>e.type===type),receipt=f=>f.emitted.find(e=>e.kind==='receipt')?.receipt;

test('the reproduced89% race stores only three final ribbons and never advances a gold goal',()=>{
 const f=fixture(),r=f.finish();assert.equal(r.rib,3);assert.equal(r.gold,false);assert.equal(r.saved,true);assert.equal(f.saved.ribbons.pp,3);assert.equal(f.saved.ribbonsBy['pp:open'],3);assert.equal(f.saved.ribbonGold.pp,undefined);assert.equal(f.saved.ribbonAwards.byDifficulty['pp:open'].bestRib,3);assert.equal(f.saved.ribbonAwards.byDifficulty['pp:open'].bestGold,false);assert.equal(receipt(f).accuracy,.889);assert.equal(events(f,'gold').length,0);assert.equal(events(f,'ribbons').length,1);assert.equal(events(f,'ribbons')[0].val,3);assert.equal(f.writes,1);
});
test('raw grading hooks are pure: provisional gold does not write ribbons or progress',()=>{
 const f=fixture(),rb={ev:f.ev,t:22.6,stars:3,rib:4,acc:1,faults:0,diff:'open'};f.G.run('ribbons',rb);assert.equal(rb.rib,3);assert.equal(rb.gold,false);assert.equal(f.writes,0);assert.deepEqual(f.saved,{});assert.deepEqual(f.emitted,[]);
});
test('a genuinely tidy race saves four ribbons and posts its gold only after the confirmed write',()=>{
 const f=fixture({gate:.97}),r=f.finish();assert.equal(r.rib,4);assert.equal(r.gold,true);assert.equal(f.saved.ribbonGold.pp,true);assert.equal(f.saved.ribbonsBy['pp:open'],4);assert.equal(f.saved.ribbonAwards.byDifficulty['pp:open'].bestGold,true);assert.equal(events(f,'ribbons')[0].val,4);assert.equal(events(f,'gold').filter(e=>e.kind==='quest').length,1);assert.equal(events(f,'gold').filter(e=>e.kind==='daily').length,1);assert(Object.isFrozen(receipt(f)));assert(Object.isFrozen(receipt(f).ev));assert.equal(f.writes,1);
});
test('the same actual course and cloned post-signal cannot pay ribbon totals, Star Points or gold twice',()=>{
 const f=fixture({gate:.97}),first=f.finish(),state=JSON.stringify(f.saved),signal=receipt(f),count=f.emitted.length;
 const retry=f.finish();assert.equal(retry.receipt.id,first.receipt.id);assert.equal(JSON.stringify(f.saved),state);assert.equal(f.writes,1);assert.equal(f.emitted.length,count);f.G.run('ribbonsAwarded',{...signal});assert.equal(events(f,'ribbons').length,1);assert.equal(events(f,'gold').length,2);
});
test('before-write failure and missing readback cannot publish finalized ribbon progress',()=>{
 const f=fixture({gate:.97});f.mode('before-failure');const failed=f.finish();assert.equal(failed.saved,false);assert.equal(failed.rib,0);assert.equal(receipt(f),undefined);assert.deepEqual(f.saved,{});assert.equal(events(f,'ribbons').length,0);assert.equal(events(f,'gold').length,0);f.mode('normal');const retried=f.finish();assert.equal(retried.saved,true);assert.equal(retried.gold,true);assert.equal(events(f,'ribbons').length,1);
 const missing=fixture({gate:.97});missing.blockFresh(true);assert.equal(missing.finish().saved,false);assert.equal(events(missing,'ribbons').length,0);assert.equal(events(missing,'gold').length,0);
});
test('a confirmed write remains valid when the save wrapper reports an ambiguous post-write failure',()=>{
 const f=fixture({gate:.97});f.mode('after-failure');const r=f.finish();assert.equal(r.saved,true);assert.equal(events(f,'ribbons').length,1);assert.equal(events(f,'gold').length,2);f.finish();assert.equal(events(f,'ribbons').length,1);
});
test('unconfirmed, changed or stale receipts cannot create progress through the public final signal',()=>{
 const f=fixture({gate:.97});f.G.run('ribbonsAwarded',{saved:true,id:'invented',eventId:'pp',diff:'open',rib:4,gold:true,accuracy:1});assert.equal(events(f,'gold').length,0);f.finish();const real=receipt(f);for(const patch of [{saved:false},{time:999},{rib:3},{gold:false},{faults:1},{diff:'elite'},{id:'invented'}])f.G.run('ribbonsAwarded',{...real,...patch});assert.equal(events(f,'ribbons').length,1);assert.equal(events(f,'gold').length,2);
});
test('a later weaker round preserves both genuine old gold and confirmed best data',()=>{
 const best=createRibbonAward({ev:{id:'pp'},diff:'open',rib:4,stars:3,gold:true,acc:.99,t:20},{id:'previous-true-gold',at:1}),seed={ribbons:{pp:4},ribbonsBy:{'pp:open':4},ribbonGold:{pp:true}};recordRibbonAward(seed,best);
 const f=fixture({seed}),r=f.finish();assert.equal(r.rib,3);assert.equal(r.gold,false);assert.equal(f.saved.ribbonGold.pp,true);assert.equal(f.saved.ribbonsBy['pp:open'],4);assert.equal(f.saved.ribbonAwards.byDifficulty['pp:open'].bestRib,4);assert.equal(f.saved.ribbonAwards.byDifficulty['pp:open'].bestGold,true);assert.equal(f.saved.ribbonAwards.byDifficulty['pp:open'].last.gold,false);assert.equal(events(f,'gold').length,0);
});
test('old phantom fourth records and already-paid progress are retained without being revalidated or revoked',()=>{
 const seed={ribbons:{pp:3},ribbonsBy:{'pp:open':4},ribbonGold:{},life:{gold:5},dq:{prog:{gold:1}}},f=fixture({seed});f.finish();assert.equal(f.saved.ribbonsBy['pp:open'],4);assert.equal(f.saved.ribbons.pp,3);assert.equal(f.saved.life.gold,5);assert.equal(f.saved.dq.prog.gold,1);assert.equal(f.saved.ribbonAwards.byDifficulty['pp:open'].bestRib,3);assert.equal(f.saved.ribbonAwards.byDifficulty['pp:open'].bestGold,false);
});
test('only the latest record per difficulty is kept while confirmed bests survive new runs',()=>{
 const s={};for(let i=1;i<=100;i++)recordRibbonAward(s,createRibbonAward({ev:{id:'pp'},diff:'open',rib:i===1?4:3,stars:3,gold:i===1,acc:i===1?.99:.89,t:20},{id:'run-'+i,at:i}));assert.equal(Object.keys(s.ribbonAwards.byDifficulty).length,1);assert.equal(s.ribbonAwards.byDifficulty['pp:open'].last.id,'run-100');assert.equal(s.ribbonAwards.byDifficulty['pp:open'].bestRib,4);assert.equal(s.ribbonAwards.byDifficulty['pp:open'].bestGold,true);
 const malformed={ribbonAwards:{version:1,byDifficulty:{'pp:open':{last:{saved:false},bestRib:999,bestGold:true}}}};recordRibbonAward(malformed,createRibbonAward({ev:{id:'pp'},diff:'open',rib:3,stars:3,gold:false,acc:.89,t:20},{id:'good',at:1}));assert.equal(malformed.ribbonAwards.byDifficulty['pp:open'].bestGold,false);
});
test('jump and judged-class grades retain the existing final gold criteria',()=>{
 for(const kind of ['jump','dressage']){const f=fixture({kind});if(kind==='dressage')f.course.ce.dressage=true;const r=f.finish({acc:.99});assert.equal(r.rib,4);assert.equal(r.gold,true);assert.equal(events(f,'gold').length,2);}
});
test('the separate two-literal repair adapter preserves all six distance edits and original protected sources',()=>{
 const changes=JSON.parse(read('tools/fixtures/ribbon-award-8733008/source-changes.json')),contract=JSON.parse(read('tools/fixtures/ribbon-award-8733008/contract.json')),distance=JSON.parse(read('tools/fixtures/riding-distance-8733008/source-changes.json'));assert.equal(changes.length,2);assert.equal(contract.approvedSourceLiterals,2);const sha=v=>createHash('sha256').update(v).digest('hex');assert.equal(sha(changes[1].before),contract.beforeAwardSHA256);
 const normalized=normalizeRibbonAwardSource(core,'ranch3d.html');for(const c of distance)assert.equal(normalized.split(c.after).length-1,1,'Physical-distance literal remains intact');assert.equal(normalizeStarterTackSource(core,'ranch3d.html'),read('tools/fixtures/starter-tack-2986289/ranch3d.html'));
 for(const c of changes){assert.throws(()=>normalizeRibbonAwardSource(core+'\n// duplicate '+c.after,'ranch3d.html'));assert.throws(()=>normalizeRibbonAwardSource(core.replace(c.after,c.after.replace('createRibbonAward','inventedAward')),'ranch3d.html'));}
 assert.throws(()=>normalizeRibbonAwardSource(core.replace('ribbon-awards.mjs?v=final-ribbon-1','ribbon-awards.mjs?v=unreviewed'),'ranch3d.html'));assert.throws(()=>normalizeStarterTackSource(core+'\n// unrelated rider/auth/gear mutation','ranch3d.html'));
});

test('breeding weekly ribbons count final three rather than provisional four, with persisted duplicate protection',()=>{
 const f=fixture({withBreeding:true});f.finish();assert.equal(f.saved.brw.n,3);const signal=receipt(f);f.G.run('ribbonsAwarded',{...signal});assert.equal(f.saved.brw.n,3);
 // Reinstall only the actual consumer to model a reload: its saved receipt ID
 // still prevents another weekly credit even though runtime memory is fresh.
 const hooks=new Map(),G={...f.G,on(n,fn){hooks.set(n,fn);}};const ctx=vm.createContext({G,fresh:G.save.fresh,sync:G.save.sync,verifiedRibbonAward,setTimeout:()=>0,toast:()=>{}});vm.runInContext(section(breeding," G.on('ribbonsAwarded',receipt=>{"," G.on('passClaim'"),ctx);hooks.get('ribbonsAwarded')({...signal});assert.equal(f.saved.brw.n,3);
});
test('breeding eight-ribbon weekly reward and rollover remain unchanged',()=>{
 const f=fixture({withBreeding:true,seed:{brw:{wk:'old',n:5},items:{}}});const week=f.G.time.isoWeekKey();f.mode('normal');f.finish();assert.equal(f.saved.brw.wk,week);assert.equal(f.saved.brw.n,3);
 const s={brw:{wk:week,n:8},items:{},btok:1};const hooks=new Map(),G={time:f.G.time,on(n,fn){hooks.set(n,fn);}};vm.runInContext(section(breeding," G.on('ribbonsAwarded',receipt=>{"," G.on('passClaim'"),vm.createContext({G,verifiedRibbonAward,fresh:()=>s,sync:fn=>fn(s),setTimeout:()=>0,toast:()=>{}}));hooks.get('weekRoll')(s);assert.equal(s.btok,3);assert.equal(s.items.pot_mirror,1);assert.equal(s.brw.n,0);assert.equal(s.brw.wk,week);
 const small={brw:{n:7},items:{},btok:1};hooks.get('weekRoll')(small);assert.equal(small.btok,1);assert.equal(small.items.pot_mirror,undefined);
});
test('breeding cannot count unverified awards, failed ribbon saves or previous-week replay',()=>{
 const f=fixture({withBreeding:true});f.mode('before-failure');f.finish();assert.equal(f.saved.brw,undefined);f.G.run('ribbonsAwarded',{saved:true,eventId:'pp',diff:'open',id:'made-up',rib:4,at:Date.now()});assert.equal(f.saved.brw,undefined);
 const at=Date.now()-8*86400000,old=createRibbonAward({ev:{id:'pp'},diff:'open',rib:4,stars:3,gold:true,acc:.99,t:20},{id:'old-week',at}),seed={};recordRibbonAward(seed,old);const replay=fixture({seed,withBreeding:true});replay.G.run('ribbonsAwarded',old);assert.equal(replay.saved.brw,undefined);
});

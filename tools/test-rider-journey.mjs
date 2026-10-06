import test from 'node:test';
import assert from 'node:assert/strict';
import {JOURNEY_CHAPTERS,journeyGearId,sanitizeJourneySave,journeyMetrics,journeySnapshot,applyJourneyClaim,equipJourneyReward} from '../assets/features/rider-journey-rules.mjs';
import {install} from '../assets/features/rider-journey.js';
const copy=o=>JSON.parse(JSON.stringify(o));
function history(){return {coins:100,tack:[],horses:[{id:1,name:'Juniper',gear:{saddle:'old-saddle'}},{id:2,name:'Clover',gear:{}}],
 ranchRush:{version:1,records:Object.fromEntries(['rush-pasture','rush-river','rush-trail'].map(id=>[id,{plays:2,medal:'gold',bestCombo:7}]))},
 rescueRides:{completions:1},roundupBest:{beginner:{plays:1,penned:3,medal:'gold'},full:{plays:1,penned:5,medal:'gold'}}};}
const makeGear=g=>({id:'generated',name:g.name,rarity:g.rarity,set:g.set,slot:g.slot,style:g.style,bonus:{...g.bonus},lvl:1});
const payReward=(s,r)=>{s.coins+=r.c;};
const claim=(s,id,now=123)=>applyJourneyClaim(s,id,{makeGear,payReward,now});
test('old rescue, Rush and roundup records retroactively credit every goal without mutating history',()=>{
 const s=history(),before=copy(s),view=journeySnapshot(s,1);
 assert.equal(view.chapters.length,5);assert.equal(view.current.id,'first-partners');assert.equal(view.current.status,'ready');
 assert(view.chapters.every(c=>c.goals.every(g=>g.done)));assert(view.chapters.slice(1).every(c=>c.status==='locked'));
 assert.deepEqual(view.nextAction,{kind:'claim',id:'first-partners'});assert.deepEqual(s,before);
});
test('exact chapter rewards are fixed, sequential and once-only',()=>{
 const s=history();assert.equal(claim(s,'meadowlark-champion'),null);let earned=0;
 for(const c of JOURNEY_CHAPTERS){
  const before=s.coins,r=claim(s,c.id);assert.equal(r.id,c.id);assert.equal(s.coins-before,c.reward.coins);earned+=c.reward.coins;
  const item=s.tack.find(i=>i.id===journeyGearId(c.id));assert.deepEqual(item.bonus,c.reward.gear.bonus);assert.equal(item.style,'western');assert.equal(item.rarity,c.reward.gear.rarity);assert.equal(item.set,c.reward.gear.set);
  assert.equal(claim(s,c.id),null);assert.equal(s.coins-before,c.reward.coins);
 }
 assert.equal(s.coins,100+earned);assert.equal(earned,1700);assert.equal(s.tack.length,5);
 const view=journeySnapshot(s,1);assert.equal(view.claimedCount,5);assert.equal(view.complete,true);assert.equal(view.title,'Meadowlark Champion');assert.equal(view.current,null);assert.equal(view.nextAction,null);
 assert.equal(s.horses[0].gear.saddle,'old-saddle');assert.equal(s.horses[0].gear.pad,undefined);
});
test('selling or merging a reward cannot reopen its permanent claim',()=>{
 const s=history();claim(s,'first-partners');const coins=s.coins;s.tack=[];
 assert.equal(journeySnapshot(s).chapters[0].status,'claimed');assert.equal(journeySnapshot(s).chapters[0].owned,false);
 assert.equal(claim(s,'first-partners'),null);assert.equal(s.coins,coins);assert.equal(equipJourneyReward(s,'first-partners',1),null);
});
test('explicit equip targets the chosen horse, preserves replaced gear and moves only the awarded item',()=>{
 const s=history();claim(s,'first-partners');s.tack.push({id:'old-pad',slot:'pad'},{id:'old-saddle',slot:'saddle'});
 s.horses[0].gear.pad='old-pad';s.horses[1].gear={pad:journeyGearId('first-partners'),bridle:'other-bridle'};
 const r=equipJourneyReward(s,'first-partners',1);assert.equal(r.horseId,1);assert.equal(s.horses[0].gear.pad,r.gearId);
 assert.equal(s.horses[0].gear.saddle,'old-saddle');assert.equal(s.horses[1].gear.pad,undefined);assert.equal(s.horses[1].gear.bridle,'other-bridle');assert(s.tack.some(i=>i.id==='old-pad'));
 assert.equal(journeySnapshot(s,1).chapters[0].equipped,true);assert.equal(journeySnapshot(s,2).chapters[0].equipped,false);
 assert.equal(equipJourneyReward(s,'first-partners',999),null);assert.equal(equipJourneyReward(s,'steady-hands',1),null);
});
test('each unfinished goal routes to the real activity and medal quality matters',()=>{
 const s={coins:0,tack:[],horses:[]};assert.deepEqual(journeySnapshot(s).nextAction,{kind:'rescue',id:'clover'});
 s.rescueRides={completions:1};assert.deepEqual(journeySnapshot(s).nextAction,{kind:'rush',id:'rush-pasture'});
 const all=history();all.ranchRush.records['rush-river'].medal='bronze';all.roundupBest.full.medal='silver';
 assert.equal(journeyMetrics(all).riverGold,0);assert.equal(journeyMetrics(all).fullGold,0);
 all.ranchRush.records['rush-river'].plays=0;assert.equal(journeyMetrics(all).riverPlays,0);
 all.roundupBest.beginner.penned=2;assert.equal(journeyMetrics(all).beginnerPenned,2);
});
test('malformed saves cannot create earned progress, crash the journey, or forge a claim',()=>{
 for(const s of [null,[],{}, {tack:{},horses:[null,4],riderJourney:{lastClaimId:'constructor',claimed:{'first-partners':true}},ranchRush:{version:1,records:{'rush-pasture':{plays:NaN,bestCombo:Infinity,medal:'constructor'}}},rescueRides:{completions:'1'},roundupBest:{beginner:{plays:1,penned:'3'}}}]){
  const view=journeySnapshot(s);assert.equal(view.claimedCount,0);assert.equal(view.complete,false);assert.equal(view.current.status,'active');assert.equal(view.lastClaim,null);
 }
 assert.equal(sanitizeJourneySave({claimed:{'first-partners':{at:1,gearId:'random'}}}).claimed['first-partners'],undefined);
});
function harness(initial=history()){
 let saved=copy(initial),failWrites=false;const events=[],hooks=new Map(),counts={tack:0,attach:0,dress:0};
 const G={save:{ensure(){},fresh:()=>copy(saved),sync:fn=>{const next=copy(saved);fn(next);if(!failWrites)saved=next;}},
  horse:{ridden:()=>({id:1}),genGear:(rarity,slot,opts)=>makeGear(JOURNEY_CHAPTERS.find(c=>c.reward.gear.rarity===rarity&&c.reward.gear.slot===slot&&c.reward.gear.set===opts.set).reward.gear),refreshTack(){counts.tack++;},attachTack(){counts.attach++;},dressSaddle(){counts.dress++;}},
  money:{payReward,refreshWallet(){}},toast(){},on:(k,fn)=>{if(!hooks.has(k))hooks.set(k,[]);hooks.get(k).push(fn);},run:(k,...args)=>{events.push(k);for(const fn of hooks.get(k)||[])fn(...args);}};
 install(G);return {G,events,counts,get save(){return saved;},fail:()=>{failWrites=true;}};
}
test('runtime verifies persisted claims and does not announce failed storage writes',()=>{
 const h=harness();h.fail();assert.equal(h.G.riderJourney.claim('first-partners'),null);assert.equal(h.G.riderJourney.snapshot().claimedCount,0);
 assert.equal(h.counts.tack,0);assert(!h.events.includes('journeyClaim'));
});
test('runtime claim and explicit equip survive reload and forged finish events award nothing',()=>{
 const h=harness(),r=h.G.riderJourney.claim('first-partners');assert.equal(r.gearId,'journey-first-partners');assert.equal(h.counts.attach,0);
 assert.equal(h.G.riderJourney.claim('first-partners'),null);assert.equal(h.G.riderJourney.equip('first-partners'),true);assert.equal(h.counts.attach,1);assert.equal(h.counts.dress,1);
 const loaded=harness(h.save);assert.equal(loaded.G.riderJourney.snapshot().claimedCount,1);assert.equal(loaded.G.riderJourney.claim('first-partners'),null);
 const fresh=harness({coins:10,tack:[],horses:[{id:1}]});fresh.G.run('rushFinish',{id:'rush-pasture',medal:'gold'});fresh.G.run('rescueFinish',{id:'clover'});
 assert.equal(fresh.G.riderJourney.claim('first-partners'),null);assert.equal(fresh.save.coins,10);assert.equal(fresh.save.tack.length,0);
});

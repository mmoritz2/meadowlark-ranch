import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {eventPreparation} from '../assets/features/event-preparation.js';

const base={event:{id:'h1',lvl:1,reward:250,req:{jump:4}},horse:{name:'Clover',level:1},difficulty:{label:'Open',lvlAdd:0,rewMul:1},stats:{base:{jump:3},tack:{jump:1},total:{jump:4}},gate:{ok:true,missing:[]}};
test('effective tack meets the actual event requirement without changing the horse',()=>{
 const fixture=structuredClone(base),before=structuredClone(fixture),p=eventPreparation(fixture);
 assert.equal(p.ready,true);assert.equal(p.reason,'');assert.deepEqual(p.requirements[1],{key:'jump',have:4,need:4,base:3,tack:1,met:true});
 assert.deepEqual(fixture,before);
});
test('missing effective stats direct preparation to equipment and do not add a care gate',()=>{
 const p=eventPreparation({...base,stats:{base:{jump:3},total:{jump:3},tack:{}},gate:{ok:false,missing:[['jump',4,3]]},entryLock:'Needs Jump 4 (have 3)'});
 assert.equal(p.ready,false);assert.equal(p.reason,'Needs Jump 4 (have 3)');assert.equal(p.prepareTab,'equipment');
 assert.match(p.prepareHint,/tack and trained stats/);
 const ready=eventPreparation({...base,horse:{...base.horse,bond:0,needs:{hunger:0,thirst:0,clean:0,happy:0}}});
 assert.equal(ready.ready,true,'bond and retired needs must not introduce event entry requirements');
});
test('selected difficulty adds the real Elite level requirement',()=>{
 const p=eventPreparation({...base,difficulty:{label:'Elite',lvlAdd:2,rewMul:1.5}});
 assert.equal(p.ready,false);assert.equal(p.requirements[0].need,3);assert.equal(p.reason,'Elite opens at Lv 3');assert.equal(p.prepareTab,'horse');
 assert.equal(eventPreparation({...base,horse:{level:3},difficulty:{label:'Elite',lvlAdd:2,rewMul:1.5}}).ready,true);
});
test('venue and authoritative championship locks remain blocking at sufficient horse stats',()=>{
 const entryLock='The Final takes qualified riders only — 2 of 4 venues signed off.';
 assert.equal(eventPreparation({...base,entryLock}).reason,entryLock);
 const p=eventPreparation({...base,entryLock,venueLock:'Finish Wren’s quest to open Cottonwood.'});
 assert.equal(p.ready,false);assert.equal(p.reason,'Finish Wren’s quest to open Cottonwood.');
 assert.equal(eventPreparation({...base,gate:{ok:false,missing:[]}}).ready,false);
});
test('listed purse follows event reward, selected difficulty, and the existing weekly multiplier',()=>{
 assert.equal(eventPreparation(base).purse,250);
 assert.equal(eventPreparation({...base,difficulty:{rewMul:.7},featured:true}).purse,263);
 assert.equal(eventPreparation({...base,difficulty:{rewMul:1.5},featured:true}).purse,563);
 assert.equal(eventPreparation({...base,event:{lvl:1,reward:0}}).purse,0);
});
test('judged disciplines use percentage presentation while timed events keep their clock',()=>{
 assert.equal(eventPreparation(base).judged,false);
 assert.equal(eventPreparation({...base,event:{...base.event,dressage:true}}).judged,true);
 assert.equal(eventPreparation({...base,event:{...base.event,kind:'show'}}).judged,true);
});

test('trainable deficits account for equipped tack instead of training the full effective requirement',()=>{
 const fixture={...base,stats:{base:{jump:2},tack:{jump:1},total:{jump:3}},trainingCaps:{jump:{level:4,breed:8}},gate:{ok:false,missing:[['jump',4,3]]}};
 const before=structuredClone(fixture),p=eventPreparation(fixture),plan=p.training[0];
 assert.equal(plan.target,3);assert.equal(plan.cap,4);assert.equal(plan.canTrain,true);assert.equal(plan.canMeet,true);
 assert.match(plan.hint,/from 2 toward 3/);assert.match(plan.hint,/Base 3 \+ 1 equipped tack meets this stat requirement/);
 assert.equal(p.ready,false,'training suggestion never bypasses current entry');assert.deepEqual(fixture,before);
});
test('a level cap explains the remaining gap and stops zero-growth training at that cap',()=>{
 const p=eventPreparation({...base,event:{lvl:4,req:{jump:5}},horse:{level:4},stats:{base:{jump:4},total:{jump:4},tack:{}},trainingCaps:{jump:{level:4,breed:8}}});
 const plan=p.training[0];assert.equal(plan.canTrain,false);assert.equal(plan.canMeet,false);assert.equal(plan.cap,4);
 assert.match(plan.hint,/At Lv 4, the training cap is 4/);assert.match(plan.hint,/needs base 5/);assert.match(plan.hint,/Raise the horse’s level/);
});
test('partial training room remains useful without claiming it reaches an unattainable requirement',()=>{
 const p=eventPreparation({...base,event:{lvl:4,req:{jump:5}},horse:{level:4},stats:{base:{jump:2},total:{jump:2},tack:{}},trainingCaps:{jump:{level:4,breed:8}}});
 assert.equal(p.training[0].canTrain,true);assert.equal(p.training[0].canMeet,false);
 assert.match(p.training[0].hint,/from 2 toward 4/);assert.match(p.training[0].hint,/needs base 5/);assert.doesNotMatch(p.training[0].hint,/meets this stat requirement/);
});
test('breed ceiling is distinguished from a level cap and tack can bridge that ceiling',()=>{
 const fixture={...base,event:{lvl:8,req:{jump:7}},horse:{level:30},stats:{base:{jump:6},total:{jump:6},tack:{}},trainingCaps:{jump:{level:10,breed:6}}};
 const p=eventPreparation(fixture);assert.equal(p.training[0].canTrain,false);
 assert.match(p.training[0].hint,/breed’s Jump ceiling is 6/);assert.match(p.training[0].hint,/more horse levels cannot reach base 7/);
 const ready=eventPreparation({...fixture,stats:{base:{jump:6},total:{jump:7},tack:{jump:1}},gate:{ok:true}});
 assert.equal(ready.ready,true);assert.deepEqual(ready.training,[]);
});
test('a separate selected-difficulty level gate is explained even when its missing stat is trainable',()=>{
 const p=eventPreparation({...base,horse:{level:1},difficulty:{label:'Elite',lvlAdd:2},stats:{base:{jump:2},total:{jump:2}},trainingCaps:{jump:{level:4,breed:8}}});
 assert.equal(p.training[0].canTrain,true);assert.equal(p.levelMissing,true);assert.equal(p.ready,false);
 assert.match(p.levelHint,/horse Lv 3/);assert.match(p.levelHint,/Stat drills do not remove that level requirement/);
});
test('unknown or malformed training caps never advertise available training',()=>{
 for(const limits of [{},{level:NaN,breed:8},{level:4,breed:Infinity},{level:'4',breed:8}]){
  const p=eventPreparation({...base,stats:{base:{jump:2},total:{jump:2}},trainingCaps:{jump:limits}});
  assert.equal(p.training[0].canTrain,false);assert.equal(p.training[0].cap,null);
 }
});
test('each missing stat uses its own breed ceiling and met stats do not offer training',()=>{
 const p=eventPreparation({...base,event:{lvl:1,req:{speed:5,jump:5,agility:3}},stats:{base:{speed:3,jump:4,agility:2},total:{speed:3,jump:4,agility:3},tack:{agility:1}},trainingCaps:{speed:{level:6,breed:4},jump:{level:6,breed:8},agility:{level:6,breed:8}}});
 assert.deepEqual(p.training.map(p=>[p.key,p.cap,p.canMeet]),[['speed',4,false],['jump',6,true]]);
});

// Execute the real navigation and fresh-plan adapters, not replacement routes.
const source=readFileSync(new URL('../assets/features/se-events.js',import.meta.url),'utf8');
const start=source.indexOf(' function eventReturn('),end=source.indexOf(' function ride(ev,di){',start);
assert(start>0&&end>start);
const navigate=new Function('G','evById','st','$','root','paintPage','setTimeout','clamp','DIFFS','preparationFor',source.slice(start,end)+'return {prepareHorse,trainForEvent};');
const prepStart=source.indexOf(' function preparationFor('),prepEnd=source.indexOf(' function ribbonsOf(',prepStart);
assert(prepStart>0&&prepEnd>prepStart);
const freshPlan=new Function('G','ridden','S','DIFFS','clamp','gate','townLock','needText','featured','eventPreparation',source.slice(prepStart,prepEnd)+'return preparationFor;');
function navigationFixture(){
 const st={on:true,page:'a1',diff:2},ev={id:'a1',name:'Barleyfold Farm Derby',lvl:3,req:{jump:3}},diffs=[{label:'Novice',lvlAdd:0},{label:'Open',lvlAdd:0},{label:'Elite',lvlAdd:2}];
 const horse={id:'willow',level:5,stats:{jump:2},tackBonus:0},save={evDiff:2},trace={painted:0,focused:0,clicks:0,opened:null,starts:[],accept:true};
 const main={scrollTop:123},control={focus(){trace.focused++;}},page={querySelector:selector=>selector==='.sev-main'?main:control};
 const button={click(){trace.clicks++;st.on=true;st.diff=1;}},root={classList:{add(c){assert.equal(c,'page');}}};
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const G={xp:{statCap:()=>4,statCeil:()=>8,statBreakdown:h=>({base:h.stats,tack:{jump:h.tackBonus},total:{jump:h.stats.jump+h.tackBonus}})},
  seCare:{open(tab,options){trace.opened={tab,...options};st.on=false;st.page=null;}},
  trainingDrills:{startForEvent(stat,context){trace.starts.push({stat,context});if(trace.accept){st.on=false;st.page=null;}return trace.accept;}}};
 const gate=()=>({ok:horse.level>=ev.lvl&&horse.stats.jump+horse.tackBonus>=3,missing:[['jump',3,horse.stats.jump+horse.tackBonus]]});
 const preparationFor=freshPlan(G,()=>horse,()=>save,()=>diffs,clamp,gate,()=>'',()=>'',()=>[],eventPreparation);
 const api=navigate(G,id=>id===ev.id?ev:null,st,id=>id==='eventsBtn'?button:page,root,()=>{trace.painted++;main.scrollTop=0;},fn=>fn(),clamp,()=>diffs,preparationFor);
 return {api,G,st,horse,save,trace,main,preparationFor,ev};
}
test('Prepare horse returns to the same event and difficulty with freshly painted horse stats',()=>{
 const f=navigationFixture();f.api.prepareHorse('equipment');
 assert.equal(f.trace.opened.tab,'equipment');assert.equal(f.trace.opened.label,'Back to Barleyfold Farm Derby');assert.equal(f.trace.painted,0);
 f.trace.opened.onBack();assert.equal(f.st.page,'a1');assert.equal(f.st.diff,2);assert.equal(f.trace.painted,1);assert.equal(f.main.scrollTop,123);assert.equal(f.trace.focused,1);
});
test('training launches the authoritative bridge with a stable event target and rechecked readiness on return',()=>{
 const f=navigationFixture(),before=structuredClone(f.save);
 assert.equal(f.api.trainForEvent('jump'),true);assert.equal(f.trace.starts.length,1);
 const {stat,context}=f.trace.starts[0];assert.equal(stat,'jump');assert.equal(context.eventId,'a1');assert.equal(context.eventName,f.ev.name);assert.equal(context.difficulty,2);
 f.horse.stats.jump=3;context.onBack();assert.equal(f.st.page,'a1');assert.equal(f.st.diff,2);assert.equal(f.trace.painted,1);
 assert.equal(f.preparationFor(f.ev,2).ready,true);assert.deepEqual(f.save,before,'navigation does not alter saves or rewards');
 context.onBack();assert.equal(f.trace.clicks,1,'return callback does not toggle an already open Events screen closed');
});
test('stale training controls cannot train an already-met stat, a capped horse, or an unrelated stat',()=>{
 for(const change of [f=>f.horse.tackBonus=1,f=>f.horse.stats.jump=4,f=>f.G.xp.statCeil=()=>2]){
  const f=navigationFixture();change(f);assert.equal(f.api.trainForEvent('jump'),false);assert.equal(f.trace.starts.length,0);assert.equal(f.st.page,'a1');
 }
 const f=navigationFixture();assert.equal(f.api.trainForEvent('speed'),false);assert.equal(f.trace.starts.length,0);
});
test('a refused drill start leaves the event page available, and return rechecks a changed horse',()=>{
 const f=navigationFixture();f.trace.accept=false;assert.equal(f.api.trainForEvent('jump'),false);assert.equal(f.st.on,true);assert.equal(f.st.page,'a1');
 f.trace.accept=true;assert.equal(f.api.trainForEvent('jump'),true);
 f.horse.id='fern';f.horse.level=1;f.horse.stats.jump=3;f.trace.starts.at(-1).context.onBack();
 const p=f.preparationFor(f.ev,2);assert.equal(p.ready,false);assert.equal(p.levelMissing,true);assert.equal(f.st.diff,2);
});
test('preparation navigation ignores a missing event or unavailable overview/bridge',()=>{
 const f=navigationFixture();f.st.page='gone';assert.equal(f.api.trainForEvent('jump'),false);assert.doesNotThrow(()=>f.api.prepareHorse('horse'));
 f.st.page='a1';delete f.G.seCare;delete f.G.trainingDrills;assert.equal(f.api.trainForEvent('jump'),false);assert.doesNotThrow(()=>f.api.prepareHorse('horse'));
 assert.equal(f.trace.starts.length,0);assert.equal(f.trace.opened,null);
});

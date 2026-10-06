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

// Exercise the real navigation adapter without a browser, DOM layout, or game save.
const source=readFileSync(new URL('../assets/features/se-events.js',import.meta.url),'utf8');
const start=source.indexOf(' function prepareHorse(tab){'),end=source.indexOf(' function ride(ev,di){',start);
assert(start>0&&end>start);
const navigate=new Function('G','evById','st','$','root','paintPage','setTimeout',source.slice(start,end)+'return prepareHorse;');
test('Prepare horse returns to the same event and difficulty with freshly painted horse stats',()=>{
 const st={on:true,page:'h1',diff:2},ev={id:'h1',name:'Welcome Jump'};let opened,painted=0,focused=0;
 const main={scrollTop:123},prepare={focus(){focused++;}},page={querySelector:selector=>selector==='.sev-main'?main:prepare};
 const G={seCare:{open(tab,options){opened={tab,...options};st.on=false;st.page=null;}}};
 const button={click(){st.on=true;st.diff=1;}},root={classList:{add(c){assert.equal(c,'page');}}};
 const fn=navigate(G,id=>id==='h1'?ev:null,st,id=>id==='eventsBtn'?button:page,root,()=>{painted++;main.scrollTop=0;},fn=>fn());
 fn('equipment');assert.equal(opened.tab,'equipment');assert.equal(opened.label,'Back to Welcome Jump');assert.equal(painted,0);
 opened.onBack();assert.equal(st.page,'h1');assert.equal(st.diff,2);assert.equal(painted,1);assert.equal(main.scrollTop,123);assert.equal(focused,1);
});
test('preparation navigation ignores a missing event or unavailable overview',()=>{
 const fn=navigate({},()=>null,{page:null},()=>null,{},()=>assert.fail('unexpected paint'),()=>{});
 assert.doesNotThrow(()=>fn('horse'));
});

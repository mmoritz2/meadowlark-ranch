import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createParkedHorseActions} from '../assets/features/on-foot.js';

function motion(){
 const state={action:null,transitioning:false},calls=[];
 return {state,calls,mode:'stand',supportsAction:type=>['nuzzle','graze','liedown'].includes(type),
  startAction(type){calls.push(type);if(state.action)return false;state.action={type,timeS:0,durationS:4,progress:0};return true;},
  cancelAction(){assert.fail('A parked action must finish its authored return before departure');}};
}
function fixture({loading=false,on=true}={}){
 const data={on,id:1,e:{id:1,rig:loading?null:{heroMotion:motion()},speed:2,graze:1},notices:[],departures:[],dismounts:0};
 const q=createParkedHorseActions({horse:()=>data.on?data.e:null,currentId:()=>data.id,ensureOnFoot(){data.dismounts++;data.on=true;return true;},notify:message=>data.notices.push(message),depart:(...args)=>data.departures.push(args)});
 return {data,q};
}
test('ready parked action starts once and exposes the native clock without legacy transforms',()=>{
 const {data,q}=fixture();let started=0;
 assert.equal(q.request('nuzzle',{onStarted(rig,action){started++;assert.equal(rig,data.e.rig);assert.equal(action.type,'nuzzle');}}),true);
 assert.equal(started,1);assert.equal(data.e.speed,0);assert.equal(data.e.graze,0);
 Object.assign(data.e.rig.heroMotion.state.action,{timeS:1,progress:.25});q.afterTick();
 assert.deepEqual(data.e.rig.emote,{type:'nuzzle',t:1,dur:4,native:true});assert.equal(q.snapshot().action.progress,.25);
 assert.equal(q.request('graze'),false);assert.deepEqual(data.e.rig.heroMotion.calls,['nuzzle']);
 data.e.rig.heroMotion.state.action=null;q.afterTick();assert.equal(data.e.rig.emote,null);
});
test('newly dismounted loading actor queues without firing the success callback early',()=>{
 const {data,q}=fixture({loading:true,on:false});let started=0;
 assert.equal(q.request('liedown',{onStarted(){started++;}}),true);assert.equal(data.dismounts,1);
 assert.equal(q.target(),null);assert.equal(q.snapshot().pending,'liedown');assert.equal(started,0);
 q.beforeTick(.1);assert.equal(started,0);
 data.e.rig={heroMotion:motion()};q.beforeTick(.1);assert.equal(started,1);assert.equal(q.snapshot().pending,null);
 q.beforeTick(.1);assert.equal(started,1);
});
test('only the parked controller can confirm support, and a stand-in does not perform an action',()=>{
 const {data,q}=fixture();assert.equal(q.request('unsupported'),false);
 data.e.rigStandIn='still-loading-breed';assert.equal(q.target(),null);
 assert.equal(q.request('graze'),true);q.beforeTick(.1);assert.deepEqual(data.e.rig.heroMotion.calls,[]);
 const old=data.e;data.e={...old,rig:{heroMotion:motion()},rigStandIn:null};q.beforeTick(.1);
 assert.equal(q.snapshot().pending,null);assert.deepEqual(data.e.rig.heroMotion.calls,[],'replacement actors cannot inherit queued actions');
});
test('unsupported eventual rig fails without awarding an action',()=>{
 const {data,q}=fixture({loading:true});let started=0;q.request('liedown',{onStarted(){started++;}});
 data.e.rig={heroMotion:{supportsAction:()=>false}};q.beforeTick(.1);
 assert.equal(started,0);assert.equal(q.snapshot().pending,null);assert.match(data.notices[0],/cannot perform/);
});
test('mount waits through lying, authored get-up and final transition without canceling',()=>{
 const {data,q}=fixture();q.request('liedown');const m=data.e.rig.heroMotion;
 assert.equal(q.deferDeparture('mount',{here:true}),true);assert.equal(q.snapshot().departure,'mount');assert.match(data.notices[0],/finishing its rest/);
 q.afterTick();assert.deepEqual(data.departures,[]);assert.equal(q.beforeTick(.1),true);
 m.state.action=null;m.state.transitioning=true;q.afterTick();assert.deepEqual(data.departures,[]);
 m.state.transitioning=false;q.afterTick();assert.deepEqual(data.departures,[['mount',{here:true}]]);
 q.afterTick();assert.equal(data.departures.length,1);
});
test('call intent stays parked during the action and resumes once at its end',()=>{
 const {data,q}=fixture();q.request('nuzzle');assert.equal(q.deferDeparture('call',true),true);
 assert.equal(q.request('graze'),false);q.afterTick();assert.equal(data.departures.length,0);
 data.e.rig.heroMotion.state.action=null;q.afterTick();assert.deepEqual(data.departures,[['call',true]]);
});
test('mount requested during the final return blend also waits for the settled pose',()=>{
 const {data,q}=fixture();data.e.rig.heroMotion.state.transitioning=true;
 assert.equal(q.deferDeparture('mount'),true);q.afterTick();assert.equal(data.departures.length,0);
 data.e.rig.heroMotion.state.transitioning=false;q.afterTick();assert.equal(data.departures.length,1);
});
test('mount during loading cancels the pending action instead of starting it after mounting',()=>{
 const {data,q}=fixture({loading:true});let started=0;q.request('liedown',{onStarted(){started++;}});
 assert.equal(q.deferDeparture('mount'),false);assert.equal(q.snapshot().pending,null);
 data.e.rig={heroMotion:motion()};q.beforeTick(.1);assert.equal(started,0);
});
test('horse changes, rebuilds and explicit drops cancel queued work and departures',()=>{
 for(const cancel of [(d,q)=>{d.id=2;},(d,q)=>{d.e={...d.e,id:1};},(d,q)=>q.clear(),(d,q)=>{d.on=false;}]){
  const {data,q}=fixture({loading:true});let started=0;q.request('graze',{onStarted(){started++;}});cancel(data,q);
  data.e.rig={heroMotion:motion()};q.beforeTick(.1);assert.equal(started,0);assert.equal(q.snapshot().pending,null);
 }
 const {data,q}=fixture();q.request('liedown');q.deferDeparture('mount');data.e.rig={heroMotion:motion()};q.afterTick();assert.equal(data.departures.length,0);
});
test('a failed load expires without a late action or success callback',()=>{
 const {data,q}=fixture({loading:true});let started=0;q.request('graze',{onStarted(){started++;}});
 q.beforeTick(15.1);assert.equal(q.snapshot().pending,null);assert.match(data.notices[0],/still loading/);
 data.e.rig={heroMotion:motion()};q.beforeTick(.1);assert.equal(started,0);
});
test('course entry waits for a queued action, its authored return and final blend',()=>{
 const {data,q}=fixture({loading:true});q.request('liedown');
 assert.equal(q.courseGate(),true);assert.match(data.notices.at(-1),/preparing its action/);
 assert.equal(q.snapshot().pending,'liedown','refused entry must not cancel the requested action');
 data.e.rig={heroMotion:motion()};q.beforeTick(.1);
 assert.equal(q.courseGate(),true);assert.match(data.notices.at(-1),/get back up/);
 data.e.rig.heroMotion.state.action=null;data.e.rig.heroMotion.state.transitioning=true;q.afterTick();
 assert.equal(q.courseGate(),true,'the final return blend still needs the parked actor');
 data.e.rig.heroMotion.state.transitioning=false;q.afterTick();
 assert.equal(q.courseGate(),false);
});
test('course entry remains available when mounted, idle, changing horse or normally blending gaits',()=>{
 const {data,q}=fixture();
 assert.equal(q.courseGate(),false);
 data.e.rig.heroMotion.state.transitioning=true;assert.equal(q.courseGate(),false);
 data.e.rig.heroMotion.state.transitioning=false;q.request('nuzzle');data.on=false;
 assert.equal(q.courseGate(),false,'a hidden parked actor cannot lock mounted event entry');
 data.on=true;data.id=2;assert.equal(q.courseGate(),false,'a previous horse cannot lock the selected horse');
 const loading=fixture({loading:true});assert.equal(loading.q.courseGate(),false,'loading without a requested action does not block entry');
 assert.deepEqual(data.notices,[]);
});

// Run the production parked tick adapter without WebGL. The real native
// controller has its own skeleton tests; this fixture proves the adapter feeds
// its zero-speed tick instead of translating or canceling an active action.
const source=readFileSync(new URL('../assets/features/on-foot.js',import.meta.url),'utf8');
test('production courseGate hook delegates before course entry without mounting or clearing actions',()=>{
 const {data,q}=fixture();q.request('liedown');
 const hookLine=source.split('\n').find(line=>line.includes("G.on('courseGate'"));
 assert.ok(hookLine,'on-foot installs the core pre-entry hook');
 let hook;new Function('G','horseActions',hookLine)({on(event,callback){assert.equal(event,'courseGate');hook=callback;}},q);
 assert.equal(hook({id:'jump'},0),true);assert.equal(data.departures.length,0);assert.equal(q.snapshot().action.type,'liedown');
 data.e.rig.heroMotion.state.action=null;q.afterTick();assert.equal(hook({id:'jump'},0),false);
});
const start=source.indexOf(' function tickHorse(dt,t){'),end=source.indexOf(' /* ---------------------------------------------------------------- the camera',start);
assert(start>0&&end>start);
const adapter=new Function('ST','horseActions','player','angDiff','crossWall','mount','toast','name','Wd','clamp','G','RS','placeHorseCols',source.slice(start,end)+'return tickHorse;');
test('parked tick keeps the native action in place, advances its clock, and resumes calling afterward',()=>{
 const {data,q}=fixture();Object.assign(data.e,{x:0,z:0,heading:0,phase:0,grazeT:0,sc:1,parts:{group:{position:{set(){}},rotation:{}}}});
 q.request('liedown');const ST={horse:data.e,call:{t:40}},speeds=[],player={pos:{x:0,z:20}};
 const G={anim:{gaitFor:()=>({len:2.5,amp:1}),animateHorse(){},tickRig(e,speed,dt){speeds.push(speed);const a=e.rig.heroMotion.state.action;if(a){a.timeS+=dt;a.progress=a.timeS/a.durationS;}}}};
 const tick=adapter(ST,q,player,x=>x,()=>false,()=>{},()=>{},()=> 'Clover',{colliders:[],walls:[],groundH:()=>0},(v,a,b)=>Math.max(a,Math.min(b,v)),G,{},()=>{});
 tick(.1,1);assert.equal(data.e.x,0);assert.equal(data.e.z,0);assert.equal(data.e.speed,0);assert.equal(ST.call.t,40);
 assert.deepEqual(speeds,[0]);assert.equal(data.e.rig.emote.t,.1);assert.equal(data.e.parts.group.rotation.x,undefined);
 data.e.rig.heroMotion.state.action=null;tick(.1,1.1);assert.ok(data.e.z>0);assert.ok(speeds[1]>0);assert.ok(ST.call.t<40);
});

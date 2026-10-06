import test from 'node:test';
import assert from 'node:assert/strict';
import {RUSH_DEFINITIONS,RUSH_ROUTE_OVERRIDES,sanitizeRushSave,createRushRun,scoreRushCrossing,scoreRushRefusal,finishRushRun,recordRushResult,medalForScore,nextRushMedal} from '../assets/features/ranch-rush-rules.mjs';
import {install} from '../assets/features/ranch-rush.js';

const pasture=RUSH_DEFINITIONS[0];
function ride({id=pasture.id,time=30,runId='one',layout='route-v1',best=null,dirty=false}={}){
  const def=RUSH_DEFINITIONS.find(d=>d.id===id);
  let run=createRushRun(id,{runId,layout,total:def.obstacles,best});
  const legs=[];
  for(let i=0;i<def.obstacles-def.fences;i++){
    legs.push('gate');if(def.fenceLegs.includes(i))legs.push('fence');
  }
  for(const [i,kind] of legs.entries())run=scoreRushCrossing(run,{kind,grade:dirty?'fault':'perfect',clean:!dirty,time:time*(i+1)/legs.length});
  run.elapsed=time;
  return {run,result:finishRushRun(run,{pay:Math.round(def.reward*.7)})};
}
test('three fixed challenges award reachable medals through actual progress, not retries',()=>{
  assert.equal(RUSH_DEFINITIONS.length,3);
  for(const def of RUSH_DEFINITIONS){
    const {run,result}=ride({id:def.id,time:def.targetTime});
    assert.equal(run.completed,def.obstacles);
    assert.equal(result.medal,'gold');
    assert.equal(result.perfectJumps,def.fences);
    assert.equal(result.gates,def.obstacles-def.fences);
    assert.equal(result.timeBonus,400);
    assert.equal(nextRushMedal(def,result.score),null);
    assert(Object.isFrozen(def));
  }
});
test('the pasture route and its early-turn corner pass clear of the permanent hay bales',()=>{
  const points=RUSH_ROUTE_OVERRIDES[pasture.route];
  assert.equal(points.length,6);
  const start=[points[2][0],points[2][1]+4.6],end=points[3];
  const distance=([x,z])=>{
    const dx=end[0]-start[0],dz=end[1]-start[1],t=Math.max(0,Math.min(1,((x-start[0])*dx+(z-start[1])*dz)/(dx*dx+dz*dz)));
    return Math.hypot(start[0]+t*dx-x,start[1]+t*dz-z);
  };
  assert(distance([-90,-35])>3);assert(distance([-88.6,-33.8])>3);
  assert(points.every(p=>p[0]>-110&&p[0]<-33&&p[1]>-45&&p[1]<25));
});
test('a clean gate chain grows points; wide gates reset it without preventing a finish',()=>{
  let run=createRushRun(pasture.id,{total:6});
  run=scoreRushCrossing(run,{time:1});
  run=scoreRushCrossing(run,{time:2});
  assert.equal(run.score,225);assert.equal(run.combo,2);
  run=scoreRushCrossing(run,{clean:false,time:3});
  assert.equal(run.score,275);assert.equal(run.combo,0);assert.equal(run.penalties,1);
  run=scoreRushCrossing(run,{time:4});
  assert.equal(run.score,375);assert.equal(run.combo,1);assert.equal(run.bestCombo,2);
});
test('jump grades come from the course engine and refusals never advance a split',()=>{
  let run=createRushRun('rush-river',{total:8});
  run=scoreRushCrossing(run,{time:1});
  run=scoreRushRefusal(run);
  assert.equal(run.completed,1);assert.equal(run.splits.length,1);assert.equal(run.combo,0);
  run=scoreRushCrossing(run,{kind:'fence',grade:'perfect',time:3});
  assert.equal(run.score,300);assert.equal(run.perfectJumps,1);assert.equal(run.cleanJumps,1);
  run=scoreRushCrossing(run,{kind:'fence',grade:'good',time:4});
  assert.equal(run.score,488);assert.equal(run.cleanJumps,2);
  run=scoreRushCrossing(run,{kind:'fence',grade:'late',time:5});
  assert.equal(run.combo,0);assert.equal(run.penalties,2);assert.equal(run.cleanJumps,2);
});
test('a completed slow ride still earns skill points, with bounded time bonus',()=>{
  const fast=ride({time:15}).result,normal=ride({time:30}).result,slow=ride({time:90}).result;
  assert.equal(fast.timeBonus,400);assert.equal(normal.timeBonus,400);assert.equal(slow.timeBonus,0);
  assert.equal(slow.score,950);assert.equal(slow.medal,'silver');
  assert.equal(medalForScore(pasture,299),'none');
  assert.deepEqual(nextRushMedal(pasture,950),{key:'gold',target:1200,remaining:250});
});
test('unfinished or invalid runs never record a result',()=>{
  const run=createRushRun(pasture.id,{total:6,runId:'unfinished'});
  assert.equal(finishRushRun(run,{time:12}),null);
  const complete=ride().run;
  for(const time of [0,-1,NaN,Infinity,3601])assert.equal(finishRushRun(complete,{time}),null);
  assert.equal(createRushRun('unknown'),null);
});
test('duplicate crossing observations at completion cannot farm chain points',()=>{
  const {run}=ride();
  assert.equal(scoreRushCrossing(run,{kind:'fence',grade:'perfect',time:40}),run);
  assert.equal(run.completed,6);assert.equal(run.score,950);
});
test('replay updates plays once and stores no second purse',()=>{
  const {result}=ride();
  let outcome=recordRushResult(undefined,result);
  assert.equal(outcome.recorded,true);assert.equal(outcome.save.records[pasture.id].plays,1);
  assert(!('pay' in outcome.save.records[pasture.id]));
  outcome=recordRushResult(outcome.save,result);
  assert.equal(outcome.recorded,false);assert.equal(outcome.save.records[pasture.id].plays,1);
  const second=ride({time:38,runId:'second',best:outcome.save.records[pasture.id]}).result;
  outcome=recordRushResult(outcome.save,second);
  assert.equal(outcome.save.records[pasture.id].plays,2);
  assert.equal(outcome.save.records[pasture.id].bestTime,30);
  assert.equal(outcome.save.records[pasture.id].bestScore,1350);
});
test('fastest splits and highest score belong to their own runs',()=>{
  let {save}=recordRushResult(null,ride({time:30}).result);
  const first=save.records[pasture.id];
  const fast=ride({time:24,runId:'fast-wide',dirty:true,best:first}).result;
  assert.equal(fast.newBestTime,true);assert.equal(fast.newBestScore,false);
  assert.equal(fast.splitDelta,-6);assert.equal(fast.previousBestTime,30);
  ({save}=recordRushResult(save,fast));
  assert.equal(save.records[pasture.id].bestScore,1350);
  assert.equal(save.records[pasture.id].bestTime,24);
  assert.deepEqual(save.records[pasture.id].splits,[4,8,12,16,20,24]);
});
test('route changes retire incomparable PBs without erasing replay count',()=>{
  let {save}=recordRushResult(null,ride().result);
  const previous=save.records[pasture.id];
  const {result}=ride({runId:'new-route',layout:'route-v2',time:40,best:previous});
  assert.equal(result.newBestScore,true);assert.equal(result.previousBestTime,null);assert.equal(result.splitDelta,null);
  ({save}=recordRushResult(save,result));
  assert.equal(save.records[pasture.id].bestTime,40);assert.equal(save.records[pasture.id].plays,2);
});
test('malformed persisted data is finite, bounded, namespaced and has no invented medal',()=>{
  for(const bad of [null,undefined,5,'oops',[],{version:0,records:{}}])assert.deepEqual(sanitizeRushSave(bad),{version:1,records:{}});
  const clean=sanitizeRushSave({version:1,records:{
    [pasture.id]:{plays:Infinity,bestScore:NaN,bestTime:-40,medal:'gold',bestCombo:-8,splits:[1,NaN],layout:[],lastRunId:{}},
    'made-up':{bestScore:9999},
  }});
  assert.deepEqual(Object.keys(clean.records),[pasture.id]);
  assert.deepEqual(clean.records[pasture.id],{plays:0,bestScore:0,bestTime:null,medal:'none',bestCombo:0,splits:[],layout:'',lastRunId:''});
  assert(!JSON.stringify(clean).includes('null,null'));
});
test('nonmonotonic saved splits and invalid finish payloads cannot corrupt records',()=>{
  const saved=sanitizeRushSave({version:1,records:{[pasture.id]:{splits:[1,8,4],bestTime:12,bestScore:900}}});
  assert.deepEqual(saved.records[pasture.id].splits,[]);
  for(const result of [null,{}, {id:pasture.id,runId:'bad',score:NaN,time:4}, {id:pasture.id,runId:'bad',score:12,time:Infinity}]){
    const out=recordRushResult(saved,result);assert.equal(out.recorded,false);assert.deepEqual(out.save,saved);
  }
});

function fixture(){
  const hooks={},data={course:null,save:{},starts:0,mounts:0,receipts:[],notices:[],items:[],removed:[]};
  const player={pos:{x:0,z:0},heading:0,y:0,flying:false};
  const G={THREE:{},tables:{EVENTS3:[]},world:{},horse:{player},
    scene:{remove(mesh){data.removed.push(mesh);}},nameSprite(){return {position:{y:0},scale:{set(){}}};},
    save:{ensure(fn){fn(data.save);},fresh:()=>data.save,sync(fn){fn(data.save);}},
    money:new Proxy({},{get(){assert.fail('Rush must not pay its own second purse');}}),
    toast:message=>data.notices.push(message),hidePanels(){},
    on(name,fn){(hooks[name]??=[]).push(fn);},
    run(name,...args){let result;for(const fn of hooks[name]||[]){const r=fn(...args);if(r&&!result)result=r;}return result;},
    onFoot:{on:false,mount(options){assert.deepEqual(options,{here:true});data.mounts++;this.on=false;}},
    course:{get:()=>data.course,startCourse(ev,diff){
      if(G.run('courseGate',ev,diff))return;
      data.starts++;
      const jumps=Array.from({length:6},(_,i)=>({x:0,z:i*12,rotY:0,kind:'gate',g:{children:[],add(){},remove(){}}}));
      data.course={ev,jumps,items:data.items.slice(),ce:{grades:[]},cd:3,idx:0,started:false};
      G.run('courseStart',data.course);
    }},
  };
  G.on('rushFinish',r=>data.receipts.push(r));
  install(G);
  return {G,data,player};
}
test('entry preserves an existing formal round and refuses airborne/vehicle entry',()=>{
  const {G,data,player}=fixture();
  const formal=data.course={ev:{id:'h1'}};
  assert.equal(G.ranchRush.start(pasture.id),false);assert.equal(data.course,formal);
  data.course=null;player.flying=true;
  assert.equal(G.ranchRush.start(pasture.id),false);
  player.flying=false;G.worldPkg={vehicle:()=>({kind:'ferry'})};
  assert.equal(G.ranchRush.start(pasture.id),false);assert.equal(data.starts,0);
});
test('Rush courses do not enter the formal difficulty, PvP or qualification catalogs',()=>{
  const {G,data}=fixture();
  assert.deepEqual(G.tables.EVENTS3,[]);
  assert.equal(G.tables.RACE_ROUTES['rush-pp'].length,6);
  assert.equal(G.ranchRush.start(pasture.id),true);
  assert.equal(data.course.ev.rush,true);assert.equal(data.course.ev.lvl,1);
  assert.equal(data.course.ev.req,undefined);
  assert.deepEqual(G.tables.EVENTS3,[]);
});
test('native action guards run before mounting and a refused restart is not reported as started',()=>{
  const {G,data}=fixture();G.onFoot.on=true;
  let blocked=true;G.on('courseGate',()=>blocked);
  assert.equal(G.ranchRush.start(pasture.id),false);assert.equal(data.mounts,0);
  blocked=false;assert.equal(G.ranchRush.start(pasture.id),true);assert.equal(data.mounts,1);
  const current=data.course;blocked=true;
  assert.equal(G.ranchRush.start(pasture.id),false);assert.equal(data.course,current);
});
test('post-engine observations update live chain; a final crossing flushes once without its own payment',()=>{
  const {G,data,player}=fixture();
  assert.equal(G.ranchRush.start(pasture.id),true);
  const c=data.course;c.started=true;
  for(let i=0;i<5;i++){
    G.run('ride',{},5);player.pos.z=c.jumps[i].z-4;c.idx=i+1;
    G.run('tick');
    assert.equal(G.ranchRush.snapshot().active.completed,i+1);
    assert.equal(G.ranchRush.snapshot().active.elapsed,(i+1)*5);
  }
  G.run('ride',{},5);player.pos.z=c.jumps[5].z-4;c.idx=6;
  // The engine finishes inside its tick, before the next ordinary tick observer can run.
  G.run('courseFinish',{c,ev:c.ev,pay:105});
  G.run('courseFinish',{c,ev:c.ev,pay:105});
  assert.equal(data.receipts.length,1);assert.equal(data.receipts[0].score,1350);
  assert.equal(data.receipts[0].pay,105);assert.equal(data.receipts[0].time,30);
  assert.equal(data.save.ranchRush.records[pasture.id].plays,1);
  assert.equal(G.ranchRush.snapshot().active,null);
});
test('abandoning a challenge discards its chain without saving a false completion',()=>{
  const {G,data}=fixture();G.ranchRush.start(pasture.id);
  data.course.started=true;G.run('ride',{},4);data.course.idx=1;G.run('tick');
  assert.equal(G.ranchRush.snapshot().active.completed,1);
  data.course=null;G.run('tick');
  assert.equal(G.ranchRush.snapshot().active,null);assert.equal(data.receipts.length,0);
  assert.deepEqual(data.save.ranchRush.records,{});
});
test('real-time challenges remove ineffective clock pickups while keeping useful items and pads',()=>{
  const {G,data}=fixture();let geometryDisposals=0,materialDisposals=0;
  const clock={type:'time',m:{geometry:{dispose(){geometryDisposals++;}},material:{dispose(){materialDisposals++;}}}};
  const boost={type:'boost',m:{}},stamina={type:'clover',m:{}},pad={type:'pad',pad:true,m:{}};
  data.items=[boost,clock,stamina,pad];
  assert.equal(G.ranchRush.start(pasture.id),true);
  assert.deepEqual(data.course.items,[boost,stamina,pad]);
  assert.deepEqual(data.removed,[clock.m]);
  assert.equal(geometryDisposals,1);assert.equal(materialDisposals,1);
});

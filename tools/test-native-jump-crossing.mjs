import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createNativeJumpCrossingSampler} from '../assets/native-jump-crossing.mjs';

// Exercise the real native grader, advance function and courseTick crossing branch.
// Only scene/UI effects are stubbed; the test supplies sampled rider motion.
const source=fs.readFileSync(new URL('../assets/features/course-engine.js',import.meta.url),'utf8');
function section(from,to){const a=source.indexOf(from),b=source.indexOf(to,a);assert(a>=0&&b>a,from);return source.slice(a,b);}
const grading=section(' const nativeCrossing=', ' function segDist(');
const advance=section(' function advance(c,S){', " G.on('courseTick'");
const crossing=section(" G.on('courseTick',(c,dt,t)=>{", '  /* the line between obstacles */')+'return true;\n });';
const gradeData=section(' const GRADE={',' const GRADE_KEYS=');
const startReset=section(" G.on('courseStart',c=>{", '  if(!c||c.dressage').split('=>{')[1];
function fixture({rush=true,native=true,reference=false,rotY=0}={}){
 const j={kind:'fence',x:0,z:0,rotY,prevSide:0,refuseCd:0,approached:false};
 const c={started:true,ev:{rush},idx:0,t:20,par:40,faults:0,items:[],jumps:[j,{kind:'gate',x:50,z:50}],ce:{lap:1,laps:1,refusals:0,grades:[],insp:0,off:0}};
 const player={pos:{x:0,z:-1},speed:4,y:.8,vy:0,stam:.5,flying:false,onFoot:false};
 let currentRig={profile:{nativeBreed:native,referenceMotion:reference},heroMotion:{},heroJumpAge:1,ready:true};
 const trace={jumps:0,pass:0,finished:0,finalized:0,notices:[]},hooks={};
 const G={on:(k,f)=>{hooks[k]=f;},beep(){},sCoin(){},sChime(){},money:{statBump:(k,n)=>{assert.equal(k,'jumps');trace.jumps+=n;}},xp:{passAdd:n=>{trace.pass+=n;}},course:{finishCourse:()=>trace.finished++}};
 const api=Function('G','player','rig','createNativeJumpCrossingSampler','document','flash','toast','finalize',`
 const R={};const jumpingNow=()=>{const r=rig();return(r.heroMotion&&r.heroJumpAge!==null)||player.y>.05||player.vy>0;};
 ${gradeData}${grading}${advance}${crossing}
 return {grade:gradeCrossing,reset:()=>{${startReset}},sample:()=>nativeCrossing.age};
 `)(G,player,()=>currentRig,createNativeJumpCrossingSampler,{body:{classList:{contains:()=>false}}},()=>{},n=>trace.notices.push(n),()=>trace.finalized++);
 return {c,j,player,trace,api,get rig(){return currentRig;},set rig(r){currentRig=r;},tick:(dt,t)=>hooks.courseTick(c,dt,t)};
}
function at(f,age,crossAt,speed=4,lateral=0){
 const across=speed*(age-crossAt),sn=Math.sin(f.j.rotY),cs=Math.cos(f.j.rotY);
 f.player.pos.x=f.j.x+across*sn+lateral*cs;f.player.pos.z=f.j.z+across*cs-lateral*sn;f.player.speed=speed;f.rig.heroJumpAge=age;
}
function ride(crossAt,steps,opts={}){
 const f=fixture(opts);let age=Math.max(.05,crossAt-.31);at(f,age,crossAt);f.tick(.01,age);
 for(let i=0;i<300&&f.c.idx===0;i++){const dt=steps[i%steps.length];age+=dt;at(f,age,crossAt);f.tick(dt,age);}
 assert.equal(f.c.idx,1,'actual forward crossing advances once');
 return f;
}
const near=(actual,expected)=>assert(Math.abs(actual-expected)<1e-10,`${actual} ≈ ${expected}`);

test('same real native rail time keeps its grade at fine, coarse and varying frame durations',()=>{
 for(const [age,grade] of [[.41,'late'],[.50,'good'],[.75,'perfect'],[1.10,'good'],[1.121,'early']]){
  for(const dt of [[1/120],[1/30],[.20],[.07,.13,.18]]){
   const f=ride(age,dt);assert.deepEqual(f.c.ce.grades,[grade],`${age}s at ${dt}`);near(f.api.sample(),age);
   assert.equal(f.trace.jumps,1);assert.equal(f.trace.pass,grade==='perfect'?2:0);assert.equal(f.c.ce.refusals,0);
  }
 }
 const coarse=ride(1.10,[.20]);assert(coarse.rig.heroJumpAge>1.12,'old current-frame age would wrongly be Early');
 assert.equal(coarse.c.ce.lastGrade,'good');
});

test('credited fences expose immutable timing evidence and distinguish fallback',()=>{
 const interpolated=ride(1.1,[.20]);
 assert.deepEqual(interpolated.c.ce.lastJumpTiming,{fenceIndex:0,lap:1,grade:'good',frameAge:interpolated.rig.heroJumpAge,railAge:1.1,interpolated:true});
 assert(Object.isFrozen(interpolated.c.ce.lastJumpTiming));
 const fallback=ride(1.1,[.20],{native:false});
 assert.deepEqual(fallback.c.ce.lastJumpTiming,{fenceIndex:0,lap:1,grade:'early',frameAge:fallback.rig.heroJumpAge,railAge:null,interpolated:false});
 const prior=interpolated.c.ce.lastJumpTiming;interpolated.tick(.1,interpolated.rig.heroJumpAge+.1);
 assert.equal(interpolated.c.ce.lastJumpTiming,prior,'ordinary ticks retain the last actually credited fence');
 const refused=fixture();refused.player.y=0;refused.rig.heroJumpAge=null;refused.tick(.1,1);
 assert.equal(refused.c.ce.lastJumpTiming,undefined,'refusals cannot masquerade as credited crossings');
});

test('recorded Trailblazer boundary remains Early at the interpolated rail plane',()=>{
 const f=fixture({rotY:2.616796881939686});f.j.x=329;f.j.z=-65;f.j.prevSide=-1;
 const before={x:328.77362276493125,z:-65.08850345989202,age:1.1125,t:14.731500000000006,speed:4.394006581902673};
 const after={x:329.12217309061054,z:-65.55540393879473,age:1.245100000023842,t:14.864100000023848,speed:4.394081128902964};
 for(const [p,dt] of [[before,.1],[after,after.t-before.t]]){Object.assign(f.player.pos,{x:p.x,z:p.z});f.player.speed=p.speed;f.rig.heroJumpAge=p.age;f.tick(dt,p.t);}
 assert.equal(f.c.ce.lastGrade,'early');assert(f.api.sample()>1.12&&f.api.sample()<1.122);
 assert.equal(f.trace.pass,0,'the measured near-boundary jump is not upgraded by widening the window');
});

test('rotated fences and reference-motion horses use the same crossing plane',()=>{
 for(const rotY of [Math.PI/2,Math.PI,-.7]){const f=ride(1.10,[.20],{rotY,native:false,reference:true});near(f.api.sample(),1.10);assert.equal(f.c.ce.lastGrade,'good');}
});

test('an exact-plane sample preserves its age on the following forward credit',()=>{
 const f=fixture();at(f,.7,.8);f.tick(.1,.7);at(f,.8,.8);f.tick(.1,.8);
 assert.equal(f.c.idx,0,'the existing positive-side rule remains strict');
 at(f,.9,.8);f.tick(.1,.9);near(f.api.sample(),.8);assert.deepEqual(f.c.ce.grades,['perfect']);
});

test('all native thresholds and height fallback retain their original inclusive meaning',()=>{
 const f=fixture();for(const [age,grade] of [[.42-1e-8,'late'],[.42,'good'],[.58-1e-8,'good'],[.58,'perfect'],[.96,'perfect'],[.96+1e-8,'good'],[1.12,'good'],[1.12+1e-8,'early'],[1.25,'early'],[1.25+1e-8,'good'],[null,'good']]){
  f.api.reset();f.rig.heroJumpAge=age;assert.equal(f.api.grade(),grade,String(age));
 }
 f.player.y=.4;f.rig.heroJumpAge=null;assert.equal(f.api.grade(),'fault');
});

test('interpolated inclusive boundaries are stable at 30Hz without widening their windows',()=>{
 const dt=1/30;
 for(const [edge,below,exact,above] of [[.42,'late','good','good'],[.58,'good','perfect','perfect'],[.96,'perfect','perfect','good'],[1.12,'good','good','early'],[1.25,'early','early','good']]){
  for(const [offset,grade] of [[-1e-9,below],[0,exact],[1e-9,above]]){
   const f=fixture(),crossAt=edge+offset,previous=crossAt-dt/2;
   at(f,previous,crossAt,5);f.tick(dt,previous);at(f,previous+dt,crossAt,5);f.tick(dt,previous+dt);
   assert.equal(f.c.ce.lastGrade,grade,`${edge} + ${offset}`);near(f.api.sample(),crossAt);
  }
 }
});

test('artist and procedural grading are unchanged',()=>{
 const f=ride(1.1,[.20],{native:false});assert.equal(f.api.sample(),null);assert.equal(f.c.ce.lastGrade,'early');
 f.api.reset();f.rig.heroMotion=null;
 for(const [height,vy,grade] of [[.4,0,'fault'],[1,0,'perfect'],[.7,0,'good'],[.5,-1,'early'],[.5,1,'late']]){f.player.y=height;f.player.vy=vy;assert.equal(f.api.grade(),grade);}
});

function pair(change=()=>{}){
 const f=fixture();f.j.prevSide=-1;at(f,1,1.1);f.tick(.1,1);
 at(f,1.2,1.1);let args={dt:.2,t:1.2};change(f,args);f.tick(args.dt,args.t);return f;
}
for(const [name,mutate] of Object.entries({
 'completed course':f=>{f.c.done=true;},
 'countdown restarted':f=>{f.c.started=false;},
 'unready rig':f=>{f.rig.ready=false;},
 'non-finite native age':f=>{f.rig.heroJumpAge=NaN;},
 'new course state':f=>{f.c.ce={...f.c.ce};},
 'new target':f=>{f.c.jumps[0]={...f.j};},
 'new lap':f=>{f.c.ce.lap++;},
 'resume resetting obstacle side':f=>{f.j.prevSide=0;},
 'refusal repositioning':f=>{f.c.ce.refusals++;},
 'new mounted rig':f=>{f.rig={...f.rig};},
 'new motion on reused rig':f=>{f.rig.heroMotion={};},
 'new profile on reused rig':f=>{f.rig.profile={...f.rig.profile};},
 'edited obstacle pose':f=>{f.j.x+=.01;},
 'clock reset':(f,a)=>{a.t=.2;},
 'missed or paused simulation sample':(f,a)=>{a.t=2;},
 'non-finite time':(f,a)=>{a.t=NaN;},
 'zero dt':(f,a)=>{a.dt=0;},
 'negative dt':(f,a)=>{a.dt=-.2;},
 'unbounded dt':(f,a)=>{a.dt=.3;a.t=1.3;f.rig.heroJumpAge=1.3;},
 'jump age reset':f=>{f.rig.heroJumpAge=.1;},
 'accelerated jump clock':f=>{f.rig.heroJumpAge=1.24;},
 'landing or action interruption':f=>{f.rig.heroJumpAge=null;},
 'teleported lateral distance':f=>{f.player.pos.x=10;},
 'mounted load pending':f=>{f.rig.loadingBreed='pinto';},
 'flying':f=>{f.player.flying=true;},
 'dismounted':f=>{f.player.onFoot=true;},
})){test(`discontinuous samples fall back without interpolation: ${name}`,()=>{const f=pair(mutate);assert.equal(f.api.sample(),null);});}

test('takeoff without a prior native age and a completed/reset course cannot reuse history',()=>{
 const f=fixture();f.j.prevSide=-1;at(f,1,1.1);f.rig.heroJumpAge=null;f.player.y=.8;f.tick(.1,1);
 at(f,1.2,1.1);f.tick(.2,1.2);assert.equal(f.api.sample(),null);assert.equal(f.c.ce.lastGrade,'early');
 const sampler=createNativeJumpCrossingSampler(),g=fixture();g.j.prevSide=-1;at(g,1,1.1);sampler.sample(g.c,g.player,g.rig,.1,1);
 at(g,1.2,1.1);assert.equal(sampler.sample({...g.c},g.player,g.rig,.2,1.2),null,'new course object cannot inherit history');
 sampler.reset();assert.equal(sampler.age,null);assert.equal(sampler.sample(g.c,g.player,g.rig,.2,1.2),null);
});

test('backward, lateral and grounded refusal paths keep actual course credit and penalties',()=>{
 const b=fixture();b.j.prevSide=1;at(b,1.2,1.1);b.tick(.1,1.2);at(b,1.4,1.5);b.tick(.2,1.4);
 assert.equal(b.c.idx,0);assert.deepEqual(b.c.ce.grades,[]);assert.equal(b.trace.jumps,0);
 const lateral=fixture();at(lateral,1,1.1,4,2);lateral.tick(.1,1);at(lateral,1.2,1.1,4,2);lateral.tick(.2,1.2);
 assert.equal(lateral.c.idx,0);assert.deepEqual(lateral.c.ce.grades,[]);
 const refusal=fixture();refusal.player.pos.z=-1;refusal.player.y=0;refusal.rig.heroJumpAge=null;refusal.tick(.1,1);
 assert.equal(refusal.c.ce.refusals,1);assert.deepEqual(refusal.c.ce.grades,['refusal']);assert.equal(refusal.player.pos.z,-1.7);assert.equal(refusal.player.speed,0);assert.equal(refusal.c.idx,0);assert.equal(refusal.trace.jumps,0);
 const ground=fixture();ground.j.prevSide=-1;ground.player.pos.z=.2;ground.player.y=0;ground.rig.heroJumpAge=null;ground.tick(.1,1);
 assert.equal(ground.c.idx,1);assert.equal(ground.c.faults,1);assert.deepEqual(ground.c.ce.grades,['fault']);assert.equal(ground.trace.jumps,0);
});

test('formal and Rush courses share timing correction with all existing perfect/offline effects intact',()=>{
 for(const rush of [false,true]){
  const f=ride(.75,[.20],{rush});assert.equal(f.c.ce.insp,1);assert.equal(f.trace.pass,2);assert.equal(f.trace.jumps,1);
  assert.equal(f.c.ce.off,1,'fixture starts inside the unchanged approach zone');near(f.c.t,20-.8+1);near(f.player.stam,.68);
  f.tick(.1,f.rig.heroJumpAge+.1);assert.equal(f.trace.pass,2);assert.equal(f.trace.jumps,1,'the next obstacle cannot replay this reward');
 }
});

test('sampling is transient and leaves saved course/horse shapes unchanged',()=>{
 const f=fixture(),sampler=createNativeJumpCrossingSampler();f.j.prevSide=-1;at(f,1,1.1);
 const first=JSON.stringify([f.c,f.player,f.rig]);sampler.sample(f.c,f.player,f.rig,.1,1);assert.equal(JSON.stringify([f.c,f.player,f.rig]),first);
 at(f,1.2,1.1);const second=JSON.stringify([f.c,f.player,f.rig]);near(sampler.sample(f.c,f.player,f.rig,.2,1.2),1.1);assert.equal(JSON.stringify([f.c,f.player,f.rig]),second);
});

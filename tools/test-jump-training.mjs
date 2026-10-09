import test from 'node:test';
import assert from 'node:assert/strict';
import {JUMP_TRAINING as layout,createJumpAttempt,observeJumpAttempt,getJumpObstacle,getJumpGuide,jumpTrainingCue} from '../assets/features/jump-training-rules.mjs';
const local=(rail,d,u=0)=>({x:rail.x+Math.sin(rail.heading)*d+Math.cos(rail.heading)*u,z:rail.z+Math.cos(rail.heading)*d-Math.sin(rail.heading)*u});
const observe=(a,d,{u=0,height=0,jumpActive=false,grounded=height<=.03&&!jumpActive,dt=.25,speed=12,paused=false}={})=>observeJumpAttempt(a,{position:local(getJumpObstacle(a.index),d,u),height,jumpActive,grounded,dt,speed,paused});
function ready(index=0){const a=createJumpAttempt(index);observe(a,-5.5);assert.equal(a.armed,true);return a;}
function jump(a){observe(a,-2,{height:.35,jumpActive:true});const crossed=observe(a,1,{height:.7,jumpActive:true});assert.equal(crossed.credited,false);assert.equal(a.phase,'landing');return crossed;}

test('layout has four frozen arena rails, authored turns and eight jumps',()=>{
 assert(Object.isFrozen(layout));assert(Object.isFrozen(layout.checkpoints));assert.equal(layout.total,8);assert.equal(layout.timeLimit,120);assert.equal(layout.railHeight,.3);
 for(let i=0;i<8;i++){const r=getJumpObstacle(i);assert(Object.isFrozen(r));assert.equal(r.id,i%4);assert.equal(r.width,4.8);for(const p of [r,r.approach,r.landing,...r.guide]){assert(p.x>=-25&&p.x<=25);assert(p.z>=-20&&p.z<=20);assert(Object.isFrozen(p));}}
 assert.equal(getJumpObstacle(8),null);assert.throws(()=>createJumpAttempt(8),RangeError);
});
test('all eight checkpoints credit only after their actual grounded exit landing',()=>{
 for(let i=0;i<8;i++){const a=ready(i),crossed=jump(a);assert(crossed.crossing.height>=.2);assert.equal(a.completed,false);
  assert.equal(observe(a,2,{height:.2,jumpActive:true}).credited,false);
  assert.equal(observe(a,3,{height:0,jumpActive:true,grounded:false}).credited,false,'landing animation still active');
  assert.equal(observe(a,3,{height:0,jumpActive:false,grounded:true}).credited,true);
  assert.equal(a.phase,'complete');assert.equal(observe(a,4).credited,false);assert.equal(a.misses,0);}
});
test('grounded pass misses once, then can reapproach and retry',()=>{
 const a=ready();observe(a,-1);assert.equal(observe(a,1).missed,true);assert.equal(a.misses,1);assert.equal(observe(a,2).missed,false);assert.equal(observe(a,1).missed,false);
 observe(a,-1);observe(a,-4);assert(a.armed);jump(a);assert.equal(observe(a,3).credited,true);assert.equal(a.misses,1);
});
test('lift without active jump and active jump without enough lift cannot score',()=>{
 const a=ready();observe(a,-1,{height:.7,grounded:false});assert.equal(observe(a,1,{height:.7,grounded:false}).missed,true);
 const b=ready();observe(b,-1,{height:.1,jumpActive:true});assert.equal(observe(b,1,{height:.1,jumpActive:true}).missed,true);
});
test('span is evaluated at the swept crossing rather than the frame endpoint',()=>{
 const a=ready();observe(a,-2,{u:0,height:.5,jumpActive:true});assert.equal(observe(a,2,{u:4,height:.5,jumpActive:true,speed:30}).missed,false);assert.equal(a.phase,'landing');assert.equal(observe(a,3,{u:4}).credited,true);
 const b=ready();observe(b,-2,{u:3,height:.5,jumpActive:true});assert.equal(observe(b,2,{u:3,height:.5,jumpActive:true,speed:30}).missed,true);
});
test('short approach, reverse crossing and returning before landing cannot credit',()=>{
 const a=createJumpAttempt();observe(a,-2,{height:.5,jumpActive:true});assert.equal(observe(a,1,{height:.7,jumpActive:true}).missed,true);
 const b=createJumpAttempt();observe(b,2);assert.equal(observe(b,-2,{height:.7,jumpActive:true}).credited,false);
 const c=ready();jump(c);assert.equal(observe(c,-1,{height:.2,jumpActive:true}).missed,true);assert.equal(observe(c,1).credited,false);
});
test('paused stationary flight preserves proof without time or credit',()=>{
 const a=ready();jump(a);const elapsed=a.elapsed;
 const r=observe(a,1,{height:.7,jumpActive:true,paused:true});assert.equal(r.credited,false);assert.equal(a.elapsed,elapsed);assert.equal(a.phase,'landing');
 observe(a,1,{height:.7,jumpActive:true,paused:true});assert.equal(a.elapsed,elapsed);assert.equal(observe(a,3).credited,true);
});
test('moving while paused clears proof and cannot score a hidden crossing or landing',()=>{
 const a=ready();const elapsed=a.elapsed;assert.equal(observe(a,1,{height:.7,jumpActive:true,paused:true}).credited,false);assert.equal(a.elapsed,elapsed);assert.equal(a.armed,false);assert.equal(observe(a,2).credited,false);
 const b=ready();jump(b);observe(b,3,{paused:true});assert.equal(b.pending,null);assert.equal(observe(b,3).credited,false);
});
test('teleports, zero-time movement and invalid coordinates update history without credit',()=>{
 const a=ready();const t=a.elapsed;assert.equal(observe(a,20,{height:.6,jumpActive:true,speed:8,dt:.016}).invalid,true);assert.equal(a.elapsed,t);assert.equal(a.pending,null);assert.equal(observe(a,21).credited,false);
 const b=ready();assert.equal(observe(b,1,{height:.6,jumpActive:true,dt:0}).invalid,true);assert.equal(observe(b,2).credited,false);
 const c=ready();assert.equal(observeJumpAttempt(c,{position:{x:NaN,z:0},height:.5,speed:12,dt:.1,jumpActive:true}).invalid,true);assert.equal(c.previous,null);
});
test('height is interpolated at the plane and high-speed continuous steps work',()=>{
 const a=ready();observe(a,-1,{height:.05,jumpActive:true});assert.equal(observe(a,4,{height:.25,jumpActive:true,speed:40}).missed,true,'crossing occurs before lift reaches .2');
 const b=ready();observe(b,-2,{height:.7,jumpActive:true,speed:40});assert.equal(observe(b,2,{height:.6,jumpActive:true,speed:40}).missed,false);assert.equal(observe(b,5,{speed:40}).credited,true);
});
test('a continuous airborne crossing followed by ground within one step can finish',()=>{
 const a=ready();observe(a,-1,{height:.6,jumpActive:true});assert.equal(observe(a,1,{grounded:true,jumpActive:false,height:0}).credited,true);
});
test('retry guides go around a standard and snapshots never mutate guide progress',()=>{
 const a=ready();observe(a,-1);observe(a,1);const before=JSON.stringify(a),p=getJumpGuide(0,a,local(getJumpObstacle(0),1));assert.equal(JSON.stringify(a),before);
 const r=getJumpObstacle(0),side=(p.x-r.x)*Math.cos(r.heading)-(p.z-r.z)*Math.sin(r.heading);assert(Math.abs(side)>r.width/2);assert.match(jumpTrainingCue(a),/Go around/);
});

test('25ms continuous trajectories work at several speeds and every heading',()=>{
 for(const speed of [4,8,16,26])for(let index=0;index<4;index++){
  const a=createJumpAttempt(index),dt=.025,start=-Math.max(5.5,speed*.95);
  observe(a,start,{speed,dt});assert(a.armed);
  let credits=0,clearedAt=null;
  // Native jump-like timing: initial animation windup, airborne arc, then landing recovery.
  for(let frame=1;frame<=72;frame++){
   const t=frame*dt,flight=Math.max(0,Math.min(1,(t-.38)/1.22));
   const height=t>.38&&t<1.6?.8*Math.sin(Math.PI*flight):0;
   const jumpActive=t<1.7,grounded=!jumpActive;
   const r=observe(a,start+speed*t,{speed,dt,height,jumpActive,grounded});
   assert.equal(r.invalid,false,`speed ${speed}, rail ${index}, frame ${frame}`);
   if(r.credited){credits++;clearedAt=t;}
  }
  assert.equal(credits,1,`speed ${speed}, rail ${index}`);
  assert(clearedAt>=1.7,'credit waits for landing recovery to end');
 }
});
test('arming survives a stationary menu pause and guides advance only on observation',()=>{
 const a=ready(1),r=getJumpObstacle(1),guide=getJumpGuide(1,a);
 const before=JSON.stringify(a);getJumpGuide(1,a,r.guide[0]);assert.equal(JSON.stringify(a),before);
 observe(a,-5.5,{paused:true});assert(a.armed);assert.equal(a.phase,'ready');
 assert.deepEqual(getJumpGuide(1,a),guide);
 const b=createJumpAttempt(1);observeJumpAttempt(b,{position:r.guide[0],dt:.1,speed:10,height:0,jumpActive:false,grounded:true});
 assert.equal(b.guideIndex,1);
});
test('retry routes stay inside the arena on either side of every rail',()=>{
 for(let index=0;index<4;index++)for(const u of [-3,3]){
  const a=ready(index);observe(a,-1,{u,height:.6,jumpActive:true});observe(a,1,{u,height:.6,jumpActive:true});
  assert.equal(a.phase,'retry');assert.equal(a.misses,1);
  for(const p of a.retryGuide){assert(p.x>=-25&&p.x<=25);assert(p.z>=-20&&p.z<=20);}
 }
});
test('crossing at the rail-span edge is accepted for all orientations',()=>{
 for(let index=0;index<4;index++)for(const u of [-2.4,2.4]){
  const a=ready(index);observe(a,-1,{u,height:.6,jumpActive:true});
  const r=observe(a,1,{u,height:.6,jumpActive:true});assert.equal(r.missed,false,`rail ${index}, lateral ${u}`);
  assert.equal(a.phase,'landing');assert.equal(observe(a,3,{u}).credited,true);
 }
});


test('paused native animation may finish its landing without losing prior crossing proof',()=>{
 const a=ready();jump(a);const elapsed=a.elapsed;
 const paused=observe(a,1,{paused:true,height:0,jumpActive:false,grounded:true});
 assert.equal(paused.credited,false);assert.equal(a.phase,'landing');assert.equal(a.elapsed,elapsed);
 assert.equal(observe(a,1,{dt:0}).credited,false);assert.equal(a.phase,'landing');assert.equal(a.elapsed,elapsed);
 assert.equal(observe(a,1).credited,true);
});
test('zero-time stationary frames preserve arming and ignore credit',()=>{
 const a=ready(),elapsed=a.elapsed;
 const r=observe(a,-5.5,{dt:0});assert.equal(r.invalid,false);assert.equal(a.armed,true);assert.equal(a.elapsed,elapsed);
 jump(a);assert.equal(observe(a,1,{dt:0,height:0,grounded:true}).credited,false);
 assert.equal(a.phase,'landing');assert.equal(observe(a,1).credited,true);
});

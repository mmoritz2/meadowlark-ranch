import test from 'node:test';
import assert from 'node:assert/strict';
import {updateRoundupGuidance} from '../assets/roundup-guidance.mjs';
import {roundupRiderLegClear} from '../assets/roundup-approach.mjs';

const wall={x1:-17,z1:-5,x2:-17,z2:5};
const base=(extra={})=>({key:'Juniper',horse:{x:0,z:0},pen:{x:20,z:0},rider:{x:-24,z:0},bounds:{x1:-30,x2:30,z1:-20,z2:20},colliders:[],walls:[],...extra});
function fixture(extra={}){
 const trace={clockCalls:0},options=base(extra);
 options.clock=()=>trace.clockCalls++;
 return {options,trace,update:(previous,now)=>updateRoundupGuidance(previous,options,now)};
}
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
function safe(state,o){
 assert(state&&Object.isFrozen(state),'guidance publishes immutable state');
 assert.equal(state.key,o.key);
 assert.equal(typeof state.blocked,'boolean');
 assert(Number.isInteger(state.cursor)&&state.cursor>=0);
 assert(Number.isFinite(state.plannedAt)&&Number.isFinite(state.planMs)&&state.planMs>=0);
 assert(['detour','pressure'].includes(state.phase));
 if(state.blocked){assert.equal(state.target,null);assert.equal(state.route,null);return state;}
 assert(state.route&&Object.isFrozen(state.route));
 assert(state.target&&Object.isFrozen(state.target));
 assert(state.pressurePoint&&Object.isFrozen(state.pressurePoint));
 assert.equal(roundupRiderLegClear({from:o.rider,to:state.target,horse:o.horse,bounds:o.bounds,colliders:o.colliders,walls:o.walls,clearPoint:o.clearPoint}),true,'every public target passes the actual physical leg validator');
 return state;
}

test('direct guidance keeps its 180ms refresh interval and samples the clock only while planning',()=>{
 const f=fixture(),a=safe(f.update(null,1000),f.options);
 assert.equal(a.phase,'pressure');assert.equal(a.blocked,false);assert.equal(a.plannedAt,1000);assert.equal(a.planMs,1);
 assert.equal(f.trace.clockCalls,2);
 const b=safe(f.update(a,1179),f.options);
 assert.equal(f.trace.clockCalls,2);assert.equal(b.plannedAt,1000);
 const c=safe(f.update(b,1180),f.options);
 assert.equal(f.trace.clockCalls,4);assert.equal(c.plannedAt,1180);
});

test('a safe detour keeps the same next marker while a rider makes tiny movements',()=>{
 const f=fixture({walls:[wall]});let state=safe(f.update(null,1000),f.options);
 assert.equal(state.phase,'detour');const first=state.target,route=state.route;
 for(let i=1;i<=8;i++){
  f.options.rider.x+=.025;f.options.rider.z-=.01;
  state=safe(f.update(state,1000+i*250),f.options);
  assert.deepEqual(state.target,first,'the marker must not jump sides during the approach');
  assert.equal(state.route,route);assert.equal(state.cursor,0);assert.equal(state.plannedAt,1000);
 }
 assert.equal(f.trace.clockCalls,2,'a stable detour does not repeat full search every HUD tick');
});

test('reaching a detour waypoint advances the cached route to its next leg',()=>{
 const f=fixture({walls:[wall]}),a=safe(f.update(null,1000),f.options);
 assert(a.route.waypoints.length>=2);Object.assign(f.options.rider,a.target);
 const b=safe(f.update(a,1010),f.options);
 assert(b.cursor>a.cursor,'the already reached waypoint is consumed');
 assert.notDeepEqual(b.target,a.target);assert.equal(b.phase,'pressure');
 assert.deepEqual(b.target,{x:b.pressurePoint.x,z:b.pressurePoint.z});
});

test('an obstacle added to the same collider array invalidates the next leg immediately',()=>{
 const f=fixture({walls:[wall]}),a=safe(f.update(null,1000),f.options),target=a.target;
 const colliders=f.options.colliders;
 colliders.push({x:(f.options.rider.x+target.x)/2,z:(f.options.rider.z+target.z)/2,r:1});
 assert.equal(roundupRiderLegClear({from:f.options.rider,to:target,...f.options}),false);
 const b=safe(f.update(a,1010),f.options);
 assert.equal(f.options.colliders,colliders,'the invalidation must not rely on array replacement');
 assert.equal(f.trace.clockCalls,4);assert.equal(b.plannedAt,1010);assert.notDeepEqual(b.target,target);
});

test('a changed solid callback result invalidates an unsafe cached leg even with the same callback',()=>{
 let blocker=null;const clearPoint=(x,z)=>!blocker||Math.hypot(x-blocker.x,z-blocker.z)>1;
 const f=fixture({walls:[wall],clearPoint}),a=safe(f.update(null,1000),f.options);
 blocker={x:(f.options.rider.x+a.target.x)/2,z:(f.options.rider.z+a.target.z)/2};
 const b=safe(f.update(a,1010),f.options);
 assert.equal(f.trace.clockCalls,4);assert.notDeepEqual(b.target,a.target);
});

test('a changed key or scenery reference starts a new plan without waiting for its age',()=>{
 for(const change of [o=>{o.key='Maple';},o=>{o.walls=[];},o=>{o.colliders=o.colliders.slice();},o=>{o.bounds={...o.bounds};}]){
  const f=fixture({walls:[wall]}),a=safe(f.update(null,1000),f.options);change(f.options);
  const b=safe(f.update(a,1010),f.options);
  assert.equal(f.trace.clockCalls,4);assert.equal(b.plannedAt,1010);
 }
});

test('horse movement invalidates a cached leg entering its spook bubble',()=>{
 const f=fixture({walls:[wall]}),a=safe(f.update(null,1000),f.options),old=a.target;
 Object.assign(f.options.horse,{x:(f.options.rider.x+old.x)/2,z:(f.options.rider.z+old.z)/2});
 assert.equal(roundupRiderLegClear({from:f.options.rider,to:old,...f.options}),false);
 const b=safe(f.update(a,1010),f.options);
 assert.equal(f.trace.clockCalls,4);assert.equal(b.plannedAt,1010);
});

test('more than two metres of horse drift replans even when the current detour leg stays clear',()=>{
 const f=fixture({walls:[wall]}),a=safe(f.update(null,1000),f.options);
 f.options.horse.z=2.1;
 assert.equal(roundupRiderLegClear({from:f.options.rider,to:a.target,...f.options}),true,'movement threshold is independent of immediate leg safety');
 const b=safe(f.update(a,1010),f.options);
 assert.equal(f.trace.clockCalls,4);assert.equal(b.plannedAt,1010);
});

test('near the final leg a moving horse cannot leave a stale pressure point behind',()=>{
 const f=fixture({walls:[wall]}),a=safe(f.update(null,1000),f.options);
 Object.assign(f.options.rider,a.target);const b=safe(f.update(a,1010),f.options);
 assert.equal(b.phase,'pressure');const priorTarget=b.target,priorPlans=f.trace.clockCalls;
 // Less than the detour drift threshold, but this old far-edge marker is now
 // outside the horse's twelve-metre flight zone.
 f.options.horse.x+=1.9;
 assert(distance(priorTarget,f.options.horse)>12);
 const c=safe(f.update(b,1020),f.options);
 assert.equal(f.trace.clockCalls,priorPlans+2);assert.notDeepEqual(c.target,priorTarget);
 assert(distance(c.pressurePoint,f.options.horse)<=10.5+1e-8);
});

test('an unchanged blocked route retries after 250ms without spinning every frame',()=>{
 const f=fixture({walls:[{x1:-17,z1:-20,x2:-17,z2:20}]}),a=safe(f.update(null,1000),f.options);
 assert.equal(a.blocked,true);assert.equal(f.trace.clockCalls,2);
 let state=a;
 for(const now of [1010,1100,1249]){state=safe(f.update(state,now),f.options);assert.equal(state.blocked,true);assert.equal(f.trace.clockCalls,2);}
 const b=safe(f.update(state,1250),f.options);assert.equal(b.blocked,true);assert.equal(f.trace.clockCalls,4);assert.equal(b.plannedAt,1250);
});

test('meaningful rider movement or a scenery replacement can retry blocked guidance immediately',()=>{
 for(const change of [o=>{o.rider.z+=4;},o=>{o.horse.z+=.6;},o=>{o.walls=[];}]){
  const f=fixture({walls:[{x1:-17,z1:-20,x2:-17,z2:20}]}),a=safe(f.update(null,1000),f.options);
  assert.equal(a.blocked,true);f.options.rider.z+=.01;
  const held=safe(f.update(a,1010),f.options);assert.equal(f.trace.clockCalls,2);
  change(f.options);const b=safe(f.update(held,1020),f.options);
  assert.equal(f.trace.clockCalls,4);assert.equal(b.plannedAt,1020);
 }
});

test('guidance snapshots expose no enumerable cache internals or mutable route data',()=>{
 const f=fixture({walls:[wall]}),inputBefore=structuredClone({...f.options,clock:undefined});
 const a=safe(f.update(null,1000),f.options),snapshot=JSON.stringify(a);
 assert.deepEqual(Object.keys(a).sort(),['key','route','target','pressurePoint','phase','blocked','plannedAt','planMs','cursor'].sort());
 assert(Object.isFrozen(a.route.waypoints));assert(a.route.waypoints.every(Object.isFrozen));
 assert.deepEqual({...f.options,clock:undefined},inputBefore);
 f.options.rider.x+=.01;const b=safe(f.update(a,1200),f.options);
 assert.equal(JSON.stringify(a),snapshot,'later updates do not mutate old public state');
 assert.equal(b.route,a.route);
});

test('malformed guidance options fail closed with a frozen blocked snapshot',()=>{
 for(const options of [{key:'bad'},base({horse:{x:Infinity,z:0}}),base({rider:{x:NaN,z:0}}),base({bounds:null}),base({bounds:{x1:30,x2:-30,z1:-20,z2:20}}),base({pressureRadius:0})]){
  const state=updateRoundupGuidance(null,options,1000);
  assert(state&&Object.isFrozen(state));assert.equal(state.blocked,true);assert.equal(state.target,null);assert.equal(state.route,null);
 }
});


test('small horse drift refreshes pressure metadata without replacing a still safe detour',()=>{
 const f=fixture({walls:[wall]}),a=safe(f.update(null,1000),f.options),original=JSON.stringify(a.route);
 f.options.horse.x+=.4;
 const b=safe(f.update(a,1010),f.options);
 assert.equal(f.trace.clockCalls,2);assert.equal(b.route,a.route);assert.deepEqual(b.target,a.target);
 const p=b.pressurePoint,dx=f.options.pen.x-f.options.horse.x,dz=f.options.pen.z-f.options.horse.z;
 const d=distance(p,f.options.horse),alignment=((f.options.horse.x-p.x)*dx+(f.options.horse.z-p.z)*dz)/(d*Math.hypot(dx,dz));
 assert(Math.abs(p.distance-d)<1e-8);assert(Math.abs(p.alignment-alignment)<1e-8);
 assert.notEqual(p.distance,a.pressurePoint.distance);assert.equal(JSON.stringify(a.route),original);
});

test('without an explicit timing callback planning exposes zero measured time',()=>{
 const options=base({walls:[wall]}),state=safe(updateRoundupGuidance(null,options,1000),options);
 assert.equal(state.planMs,0);
});

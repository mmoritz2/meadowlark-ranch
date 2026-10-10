import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as approach from '../assets/roundup-approach.mjs';
import * as pressure from '../assets/roundup-pressure.mjs';
import {ROUNDUP_MODES} from '../assets/roundup-rewards.mjs';
import {sharedHerdPressure} from '../assets/shared-herd-physics.mjs';
const {chooseRoundupEscape,roundupPathClear,chooseRoundupApproach}=approach;
const source=fs.readFileSync(new URL('../ranch3d.html',import.meta.url),'utf8'),world=fs.readFileSync(new URL('../assets/features/world.js',import.meta.url),'utf8');
function cut(s,a,b){const i=s.indexOf(a),j=s.indexOf(b,i);assert(i>=0&&j>i);return s.slice(i,j);}
const tickCode=cut(source,'function tickRoundup(dt,t){','/* ===== Training drills');
const stateCode=cut(source,'function roundupTarget(){','function clearRoundupHorse(h){');
const pushCode=cut(world,' function pushOut(a,pad){',' /* Nudge a heading');
const bounds={x1:-110,x2:-33,z1:-45,z2:25},pen={x:-44,z:-8,r:7.5};
const circles=[{x:-55.55569395015032,z:-7.142431218077665,r:.8},{x:-63.27824152441758,z:-13.467313716182591,r:.8},{x:-61.68972893396367,z:-16.573103005421377,r:.8},{x:-59,z:-19,r:3.4},{x:-50.7,z:-17.5,r:1.4}];
const clone=v=>structuredClone(v),vector=(x,z)=>({x,z,set(x,y,z){this.x=x;this.z=z;},distanceTo(p){return Math.hypot(this.x-p.x,this.z-p.z);}});
function fixture({colliders=circles,walls=[],horse={x:-63.09743935866264,z:-18.855118316953764},rider={x:-71.06463164009824,z:-22.952011056459792},heading=1.5,mode='beginner',solidWorld,shared=null}={}){
 const player={pos:clone(rider)},pos=vector(horse.x,horse.z),h={pos,heading,parts:{group:{position:vector(horse.x,horse.z),rotation:{}}},phase:0,rest:1,anchor:clone(horse),wb:{},penned:false,name:'Maple'};
 const W={colliders:clone(colliders),walls:clone(walls),solidWorld},G={input:{blocked:()=>false},world:W,run(){}};W.pushOut=Function('W',pushCode+'return pushOut;')(W);
 const ROUND={on:true,pending:null,cd:0,t:ROUNDUP_MODES[mode].time,elapsed:0,horses:[h],mode,penned:0,total:1,ring:null,shared};
 const trace={finished:0,motion:[]},bindings={...approach,...pressure,G,ROUND,PAST:bounds,ROUND_PEN:pen,player,sharedHerdPressure,freeCam:false,document:{hidden:false},Date,ROUND_MODES:ROUNDUP_MODES,freshSave:()=>({}),groundH:()=>0,GAITS:{walk:{},trot:{}},animateHorse(){},dressWithRig(){},tickRig:(h,s)=>trace.motion.push(s),$:()=>({}),sChime(){},endRoundup(){ROUND.on=false;trace.finished++;}};
 const api=Function(...Object.keys(bindings),stateCode+tickCode+'return {tick:tickRoundup,state:roundupState};')(...Object.values(bindings));
 const {tick,state}=api;
 return {tick,state,ROUND,h,player,W,trace};
}
function gap(p,c){return Math.hypot(p.x-c.x,p.z-c.z)-c.r;}

test('captured shelter position turns clear and physically escapes while rider holds pressure',()=>{
 const f=fixture(),initial=({x:f.h.pos.x,z:f.h.pos.z}),startDistance=Math.hypot(initial.x-pen.x,initial.z-pen.z);let travelled=0;
 for(let i=0;i<120;i++){
  const before=({x:f.h.pos.x,z:f.h.pos.z});f.tick(1/60,i/60);const step=Math.hypot(f.h.pos.x-before.x,f.h.pos.z-before.z);travelled+=step;
  assert(step<=2.1/60+.0002,'gentle pressure remains at a walkable pace');
  for(const c of circles)assert(gap(f.h.pos,c)>=.6998,'no collider penetration');
 }
 assert(Math.hypot(f.h.pos.x-initial.x,f.h.pos.z-initial.z)>2,'escape cannot remain pinned at the original shelter contact');
 assert(travelled>2);assert(Math.hypot(f.h.pos.x-pen.x,f.h.pos.z-pen.z)<startDistance-.5,'escape makes actual homeward progress');
});

test('actual tick rides around the shelter/tree cluster with a walking rider continuing pressure',()=>{
 const f=fixture(),samples=[],initial=({x:f.h.pos.x,z:f.h.pos.z});let maxStep=0;
 for(let i=0;i<1800&&f.ROUND.on;i++){
  // Synthetic rider follows clear pressure markers at normal walking speed.
  // Only this fixture drives the rider; production tick owns all loose-horse movement.
  const marker=chooseRoundupApproach({horse:f.h.pos,rider:f.player.pos,pen,bounds,colliders:f.W.colliders,walls:f.W.walls});
  if(marker){const dx=marker.x-f.player.pos.x,dz=marker.z-f.player.pos.z,d=Math.hypot(dx,dz),n=Math.min(d,2.1415/60);if(d>.2){const next={x:f.player.pos.x+dx/d*n,z:f.player.pos.z+dz/d*n};if(roundupPathClear({from:f.player.pos,to:next,bounds,colliders:f.W.colliders,walls:f.W.walls,pad:.55}))Object.assign(f.player.pos,next);}}
  const before=({x:f.h.pos.x,z:f.h.pos.z});f.tick(1/60,i/60);maxStep=Math.max(maxStep,Math.hypot(f.h.pos.x-before.x,f.h.pos.z-before.z));
  for(const c of circles)assert(gap(f.h.pos,c)>=.6998,'path stays outside real .7m collider footprint');
  if(i%60===0)samples.push({x:f.h.pos.x,z:f.h.pos.z,d:Math.hypot(f.h.pos.x-pen.x,f.h.pos.z-pen.z)});
 }
 assert(maxStep<=2.1/60+.0002,'no position jumps or hidden catch-up sprint');
 assert.equal(f.ROUND.penned,1,JSON.stringify({initial,horse:f.h.pos,rider:f.player.pos,samples}));assert.equal(f.trace.finished,1);
});

test('gentle open-ground pressure uses the shared walkable speed and original turn integration',()=>{
 const f=fixture({colliders:[],horse:{x:-80,z:0},rider:{x:-89,z:0},heading:1.3});const dt=.02,away=Math.PI/2,expected=1.3+(away-1.3)*dt*4.5;
 f.tick(dt,0);assert.equal(f.h.heading,expected);assert(Math.abs(f.h.pos.x-(-80+Math.sin(expected)*1.65*dt))<1e-10);assert(Math.abs(f.h.pos.z-Math.cos(expected)*1.65*dt)<1e-10);
});

test('candidate detours stay in the away-facing half plane and prefer a consistent bypass side',()=>{
 const horse={x:-63.09743935866264,z:-18.855118316953764},rider={x:-71.06463164009824,z:-22.952011056459792},o={horse,rider,pen,bounds,colliders:circles};
 const a=chooseRoundupEscape(o);assert(a?.detour);const raw=Math.atan2(horse.x-rider.x,horse.z-rider.z);assert(Math.cos(a.heading-raw)>=-1e-10);
 const b=chooseRoundupEscape({...o,side:a.side});assert.equal(b.side,a.side);
});

test('blocked walls and actual solid geometry cannot be bypassed by weakened contacts',()=>{
 const f=fixture({horse:{x:-90.7,z:-8},rider:{x:-99.7,z:-8},heading:Math.PI/2,colliders:[],walls:[{x1:-90,z1:-45,x2:-90,z2:25}]});
 for(let i=0;i<120;i++){f.tick(1/60,i/60);assert(f.h.pos.x<=-90.6998);if(f.h.roundupBlocked)assert.equal(f.state().target.pressure,'blocked','actual wall contact cannot be described as guiding');}
 let calls=0;const escape=chooseRoundupEscape({horse:{x:-80,z:0},rider:{x:-89,z:0},pen,bounds,clearPoint(){calls++;return false;}});assert.equal(escape,null);assert(calls<=37,'bounded headings and look distances');
});


test('actual state warning and actual tick speed agree across beginner pressure boundaries',()=>{
 for(const [distance,status,speed] of [[3,'too close',2.85],[6,'guiding',2.1],[9,'guiding',1.65],[12,'out of range',.35]]){
  const f=fixture({colliders:[],horse:{x:-80,z:-8},rider:{x:-80-distance,z:-8},heading:Math.PI/2});
  assert.equal(f.state().target.pressure,status,`state at ${distance}m`);
  const before={x:f.h.pos.x,z:f.h.pos.z};f.tick(.01,0);
  assert(Math.abs(f.trace.motion.at(-1)-speed)<1e-9,`real native speed at ${distance}m`);
  assert(Math.abs(Math.hypot(f.h.pos.x-before.x,f.h.pos.z-before.z)-speed*.01)<1e-9,`physical step at ${distance}m`);
 }
});

test('beginner warning changes at six metres without a movement-speed discontinuity',()=>{
 const fixtures=[5.999,6,6.001].map(distance=>fixture({colliders:[],horse:{x:-80,z:-8},rider:{x:-80-distance,z:-8},heading:Math.PI/2}));
 assert.deepEqual(fixtures.map(f=>f.state().target.pressure),['too close','guiding','guiding']);
 for(const f of fixtures)f.tick(.001,0);
 const speeds=fixtures.map(f=>f.trace.motion.at(-1));assert(Math.max(...speeds)-Math.min(...speeds)<.001);
});

test('being on the wrong side never shows guiding and actually sends the horse away from the pen',()=>{
 const f=fixture({colliders:[],horse:{x:-80,z:-8},rider:{x:-71,z:-8},heading:-Math.PI/2});
 assert.equal(f.state().target.pressure,'circle behind');f.tick(.02,0);assert(f.h.pos.x< -80);
 assert(Math.abs(f.trace.motion.at(-1)-1.65)<1e-10);
});

test('turning and solid-blocked horses never show a false green guiding state',()=>{
 const turn=fixture({colliders:[],horse:{x:-80,z:-8},rider:{x:-89,z:-8},heading:-Math.PI/2});assert.equal(turn.state().target.pressure,'turning');
 const f=fixture({colliders:[],horse:{x:-80,z:-8},rider:{x:-89,z:-8},heading:Math.PI/2,solidWorld:{resolve(p){p.x+=1;}}});
 const before={x:f.h.pos.x,z:f.h.pos.z};f.tick(.02,0);
 assert.deepEqual({x:f.h.pos.x,z:f.h.pos.z},before);assert.equal(f.trace.motion.at(-1),0);
 assert.equal(f.state().target.pressure,'blocked');assert.equal(f.state().target.approachBlocked,true);
});

test('full solo and shared herds retain their original open-ground speeds',()=>{
 for(const shared of [null,{host:true,finished:false,startupWaiting:false,riders:[]}])for(const [distance,speed] of [[3,6],[9,4.8]]){
  const f=fixture({mode:'full',shared,colliders:[],horse:{x:-80,z:-8},rider:{x:-80-distance,z:-8},heading:Math.PI/2});
  f.tick(.01,0);assert.equal(f.trace.motion.at(-1),speed);assert(Math.abs(f.h.pos.x-(-80+speed*.01))<1e-9);
 }
});

test('beginner target stays identifiable until penned and then hands control to the next horse',()=>{
 const f=fixture({colliders:[],horse:{x:-80,z:-8},rider:{x:-89,z:-8},heading:Math.PI/2});
 const other={...f.h,name:'Juniper',pos:vector(-60,-8),anchor:{x:-60,z:-8},parts:{group:{position:vector(-60,-8),rotation:{}}}};
 f.ROUND.horses.push(other);f.ROUND.total=2;assert.equal(f.state().target.name,'Maple');
 f.player.pos={x:-69,z:-8};assert.equal(f.state().target.name,'Maple','proximity cannot silently switch the taught target');
 const before=other.pos.x;f.tick(.01,0);assert(Math.abs(other.pos.x-before-.0035)<1e-9,'unselected horse remains in grazing mode');
 f.h.penned=true;f.ROUND.penned=1;assert.equal(f.state().target.name,'Juniper');
 const next=other.pos.x;f.tick(.01,.01);assert(other.pos.x-next>.012,'new target now responds to real pressure');
});

test('walking behind a horse sustains gentle pressure without repeated sprint-and-release cycles',()=>{
 const f=fixture({colliders:[],horse:{x:-95,z:-8},rider:{x:-104,z:-8},heading:Math.PI/2});
 let released=0,maxSpeed=0;
 for(let i=0;i<900&&f.ROUND.on;i++){
  const marker=f.state().target,dx=marker.standX-f.player.pos.x,dz=marker.standZ-f.player.pos.z,d=Math.hypot(dx,dz);
  if(d>.2){const step=Math.min(d,2.1415/60);f.player.pos.x+=dx/d*step;f.player.pos.z+=dz/d*step;}
  const status=f.state().target.pressure;if(status==='out of range')released++;
  f.tick(1/60,i/60);maxSpeed=Math.max(maxSpeed,f.trace.motion.at(-1));
 }
 assert.equal(released,0);assert(maxSpeed<=2.1);assert(f.h.pos.x> -72,'ordinary walking produces meaningful homeward progress');
});

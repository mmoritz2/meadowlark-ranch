import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chooseRoundupEscape,roundupPathClear,chooseRoundupApproach} from '../assets/roundup-approach.mjs';
const source=fs.readFileSync(new URL('../ranch3d.html',import.meta.url),'utf8'),world=fs.readFileSync(new URL('../assets/features/world.js',import.meta.url),'utf8');
function cut(s,a,b){const i=s.indexOf(a),j=s.indexOf(b,i);assert(i>=0&&j>i);return s.slice(i,j);}
const tickCode=cut(source,'function tickRoundup(dt,t){','/* ===== Training drills');
const pointCode=cut(source,'function roundupPointClear(','function roundupApproach(');
const pushCode=cut(world,' function pushOut(a,pad){',' /* Nudge a heading');
const bounds={x1:-110,x2:-33,z1:-45,z2:25},pen={x:-44,z:-8,r:7.5};
const circles=[{x:-55.55569395015032,z:-7.142431218077665,r:.8},{x:-63.27824152441758,z:-13.467313716182591,r:.8},{x:-61.68972893396367,z:-16.573103005421377,r:.8},{x:-59,z:-19,r:3.4},{x:-50.7,z:-17.5,r:1.4}];
const clone=v=>structuredClone(v),vector=(x,z)=>({x,z,set(x,y,z){this.x=x;this.z=z;}});
function fixture({colliders=circles,walls=[],horse={x:-63.09743935866264,z:-18.855118316953764},rider={x:-71.06463164009824,z:-22.952011056459792},heading=1.5,mode='beginner',solidWorld}={}){
 const player={pos:clone(rider)},pos=vector(horse.x,horse.z),h={pos,heading,parts:{group:{position:vector(horse.x,horse.z),rotation:{}}},phase:0,rest:1,anchor:clone(horse),wb:{},penned:false,name:'Maple'};
 const W={colliders:clone(colliders),walls:clone(walls),solidWorld},G={world:W,run(){}};W.pushOut=Function('W',pushCode+'return pushOut;')(W);
 const ROUND={on:true,pending:null,cd:0,t:120,elapsed:0,horses:[h],mode,penned:0,total:1,ring:null};
 const trace={finished:0,motion:[]},bindings={G,ROUND,PAST:bounds,ROUND_PEN:pen,player,roundupPaused:()=>false,roundupTarget:()=>h,chooseRoundupEscape,roundupPathClear,groundH:()=>0,GAITS:{walk:{},trot:{}},animateHorse(){},dressWithRig(){},tickRig:(h,s)=>trace.motion.push(s),$:()=>({}),sChime(){},endRoundup(){ROUND.on=false;trace.finished++;}};
 const tick=Function(...Object.keys(bindings),pointCode+tickCode+'return tickRoundup;')(...Object.values(bindings));
 return {tick,ROUND,h,player,W,trace};
}
function gap(p,c){return Math.hypot(p.x-c.x,p.z-c.z)-c.r;}

test('captured shelter position turns clear and physically escapes while rider holds pressure',()=>{
 const f=fixture(),initial=({x:f.h.pos.x,z:f.h.pos.z}),startDistance=Math.hypot(initial.x-pen.x,initial.z-pen.z);let travelled=0;
 for(let i=0;i<120;i++){
  const before=({x:f.h.pos.x,z:f.h.pos.z});f.tick(1/60,i/60);const step=Math.hypot(f.h.pos.x-before.x,f.h.pos.z-before.z);travelled+=step;
  assert(step<=3.8/60+.0002,'movement remains bounded by existing speed');
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
 assert(maxStep<=3.8/60+.0002,'no position jumps');
 assert.equal(f.ROUND.penned,1,JSON.stringify({initial,horse:f.h.pos,rider:f.player.pos,samples}));assert.equal(f.trace.finished,1);
});

test('unobstructed pressure preserves production speed and turn integration',()=>{
 const f=fixture({colliders:[],horse:{x:-80,z:0},rider:{x:-89,z:0},heading:1.3});const dt=.02,away=Math.PI/2,expected=1.3+(away-1.3)*dt*4.5;
 f.tick(dt,0);assert.equal(f.h.heading,expected);assert(Math.abs(f.h.pos.x-(-80+Math.sin(expected)*3.8*dt))<1e-10);assert(Math.abs(f.h.pos.z-Math.cos(expected)*3.8*dt)<1e-10);
});

test('candidate detours stay in the away-facing half plane and prefer a consistent bypass side',()=>{
 const horse={x:-63.09743935866264,z:-18.855118316953764},rider={x:-71.06463164009824,z:-22.952011056459792},o={horse,rider,pen,bounds,colliders:circles};
 const a=chooseRoundupEscape(o);assert(a?.detour);const raw=Math.atan2(horse.x-rider.x,horse.z-rider.z);assert(Math.cos(a.heading-raw)>=-1e-10);
 const b=chooseRoundupEscape({...o,side:a.side});assert.equal(b.side,a.side);
});

test('blocked walls and actual solid geometry cannot be bypassed by weakened contacts',()=>{
 const f=fixture({horse:{x:-90.7,z:-8},rider:{x:-99.7,z:-8},heading:Math.PI/2,colliders:[],walls:[{x1:-90,z1:-45,x2:-90,z2:25}]});
 for(let i=0;i<120;i++){f.tick(1/60,i/60);assert(f.h.pos.x<=-90.6998);}
 let calls=0;const escape=chooseRoundupEscape({horse:{x:-80,z:0},rider:{x:-89,z:0},pen,bounds,clearPoint(){calls++;return false;}});assert.equal(escape,null);assert(calls<=37,'bounded headings and look distances');
});

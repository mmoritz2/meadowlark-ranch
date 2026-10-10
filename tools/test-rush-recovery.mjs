import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRushFenceRecovery,rushRecoverySegmentClear} from '../assets/features/course-guide.js';
const fence=(extra={})=>({kind:'fence',x:0,z:0,rotY:0,prevSide:0,refuseCd:0,...extra});
const rider=(x=0,z=4,heading=Math.PI)=>({pos:{x,z},heading,speed:2,y:0,vy:0,flying:false});
const course=j=>({ev:{rush:true},idx:0,jumps:[j],ce:{refusals:0,grades:[]}});
const make=(world={})=>createRushFenceRecovery({clearSegment:(a,b,c,j)=>rushRecoverySegmentClear(a,b,{world,course:c,skip:j})});
function distances(a,b,j){const sn=Math.sin(j.rotY),cs=Math.cos(j.rotY);const result=[];for(let i=0;i<=80;i++){const t=i/80,x=a.x+(b.x-a.x)*t-j.x,z=a.z+(b.z-a.z)*t-j.z;result.push(Math.hypot(Math.max(0,Math.abs(x*cs-z*sn)-1.8),x*sn+z*cs));}return result;}
test('wrong side gets a clear path around a log end, never backward through it',()=>{
 const j=fence(),c=course(j),p=rider(),r=make(),s=r.update(c,p,0);
 assert.equal(s.phase,'around');assert(Math.abs(s.target.x)>=3.5);assert(s.target.z>=2.7);
 let prev=p.pos;for(const next of r.path){assert(Math.min(...distances(prev,next,j))>=.999);prev=next;}
 assert.equal(prev.x,0);assert(prev.z<=-8);assert.equal(c.idx,0);assert.deepEqual(c.ce.grades,[]);
});
test('sideways missed approaches and post-skimming positions remain recoverable',()=>{
 for(const [x,z] of [[3,-1],[2,0],[-2,0],[4,1]]){
  const r=make(),s=r.update(course(fence()),rider(x,z,Math.PI/2),0);
  assert(s?.target,`${x},${z} should have an outward route`);assert.notEqual(s.phase,'blocked');
 }
});
test('gradual side-skimming accumulates movement and replaces a stale route across the log',()=>{
 const j=fence(),c=course(j),p=rider(3,-1,0);let calls=0;
 const r=createRushFenceRecovery({clearSegment:(a,b,owner,skip)=>{calls++;return rushRecoverySegmentClear(a,b,{course:owner,skip});}});
 assert.deepEqual(r.update(c,p,0).target,{x:0,z:-8});const initialCalls=calls;
 // Each step is below the1.2m threshold, but the total movement reaches the
 // far side beside the log. Resetting the anchor on every poll misses this.
 for(let i=1;i<=10;i++){p.pos.z=-1+i*.5;r.update(c,p,i*350);}
 assert(calls>initialCalls,'slow riding must eventually validate the current segment');
 const state=r.snapshot();assert.equal(state.phase,'around');assert(state.target.x>=3.5);
 let prev=p.pos;for(const next of r.path.slice(r.cursor)){assert(Math.min(...distances(prev,next,j))>=.999,'the revised route must go around the rail');prev=next;}
 assert.equal(c.idx,0);assert.deepEqual(c.ce.grades,[]);
});
test('recovery persists through corner waypoints, asks rider to face forward, then releases',()=>{
 const j=fence(),c=course(j),p=rider(),r=make();r.update(c,p,0);
 const path=r.path.map(p=>({...p}));let t=0;
 for(const point of path){p.pos={...point};const s=r.update(c,p,t+=350);assert(s,'recovery must not vanish while facing back');}
 const s=r.snapshot();assert.equal(s.phase,'lineup');assert.deepEqual(s.target,{x:0,z:0});
 p.heading=0;assert.equal(r.update(c,p,t+10),null);assert.equal(c.idx,0);
});

test('changing to face-the-log guidance invalidates the cached chevron spine immediately',()=>{
 const r=make(),c=course(fence()),p=rider();r.update(c,p,0);const before=r.revision;
 p.pos={x:0,z:-8};p.heading=Math.PI;assert.equal(r.update(c,p,350).phase,'lineup');
 assert(r.revision>before,'the actual guide keys its spine to this revision');
 const current=r.revision;r.update(c,p,360);assert.equal(r.revision,current,'unchanged guidance stays cached');
});
test('a refusal near the correct side creates space to rebuild the approach',()=>{
 const j=fence(),c=course(j),p=rider(0,-5,0),r=make();assert.equal(r.update(c,p,0),null);
 p.pos.z=-1.7;c.ce.refusals=1;const s=r.update(c,p,20);
 assert.equal(s.phase,'approach');assert(s.target.z<=-8);
 p.pos.z=-3;assert(r.update(c,p,350),'getting a few metres behind is not enough');
 p.pos.z=-7;p.heading=0;assert.equal(r.update(c,p,700),null);
});
test('ordinary forward jumps do not trigger recovery at or after the plane',()=>{
 for(const z of [-.15,0,.2,1]){const p=rider(0,z,0);p.y=.8;assert.equal(make().update(course(fence()),p,0),null);}
 const p=rider(0,-.1,0);const r=createRushFenceRecovery({isJumping:()=>true});assert.equal(r.update(course(fence()),p,0),null);
});
test('formal fences and gates retain their current guide, course/target changes clear recovery',()=>{
 const j=fence(),c=course(j),r=make(),p=rider();assert(r.update(c,p,0));
 c.idx=1;c.jumps.push({kind:'gate',x:0,z:15});assert.equal(r.update(c,p,10),null);
 assert.equal(r.update({...course(j),ev:{rush:false}},p,20),null);assert.equal(r.update(null,p,30),null);
 const other=course(fence({z:40}));p.pos.z=20;assert.equal(r.update(other,p,40),null);
});
test('rotated logs preserve the correct approach side',()=>{
 for(const yaw of [.7,Math.PI/2,Math.PI,-1.2]){
  const j=fence({x:50,z:50,rotY:yaw}),c=course(j),p=rider(j.x+Math.sin(yaw)*4,j.z+Math.cos(yaw)*4,yaw+Math.PI),r=make();assert(r.update(c,p,0)?.target);
  const goal=r.path.at(-1),dx=goal.x-j.x,dz=goal.z-j.z;assert(Math.abs(dx*Math.cos(yaw)-dz*Math.sin(yaw))<1e-8);assert(dx*Math.sin(yaw)+dz*Math.cos(yaw)<-6);
 }
});
test('collider or wall on one side chooses the other, a sealed approach gives no false arrow',()=>{
 for(const world of [{colliders:[{x:3.5,z:1,r:2}]},{walls:[{x1:2.9,z1:-15,x2:2.9,z2:8}]}]){
  const r=make(world),p=rider();const s=r.update(course(fence()),p,0);assert(s?.target);assert(s.target.x<0);
 }
 const r=make({walls:[{x1:-30,z1:-4,x2:30,z2:-4}]}),s=r.update(course(fence()),rider(),0);assert.equal(s.phase,'blocked');assert.equal(s.target,null);assert.equal(r.path.length,0);
});
test('world clearance respects precise solid parts, bounds, water and steep ground',()=>{
 const clear=world=>rushRecoverySegmentClear({x:0,z:20},{x:0,z:25},{world});
 assert.equal(clear({}),true);assert.equal(clear({walls:[{x1:-1,z1:22,x2:1,z2:22}]}),false);
 assert.equal(clear({solidWorld:{resolve(p){if(p.z>21)p.x+=.2;}}}),false);
 assert.equal(clear({groundH:(x,z)=>z>22?3:0}),false);
 assert.equal(clear({groundH:()=>0,terrainH:()=>0,riverZ:()=>23,riverLevel:()=>1}),false);
 assert.equal(rushRecoverySegmentClear({x:453,z:0},{x:455,z:0}),false);
 assert.equal(rushRecoverySegmentClear({x:20,z:15},{x:20,z:18}),false);
 assert.equal(clear({colliders:[{x:0,z:23,r:5,precise:true}],solidWorld:{resolve(){}}}),true,'precise art uses actual geometry');
});
test('planning is cached, blocked forward checks are bounded, and snapshots are read-only',()=>{
 let calls=0;const r=createRushFenceRecovery({clearSegment:()=>{calls++;return true;}}),c=course(fence()),p=rider();const first=r.update(c,p,0),count=calls;
 for(let t=1;t<900;t+=16)assert.equal(r.update(c,p,t),first);
 assert.equal(calls,count,'a stationary rider does not rebuild routes');assert(Object.isFrozen(first));assert(Object.isFrozen(first.target));
 p.pos={x:0,z:-8};p.heading=Math.PI;r.update(c,p,1000);const checked=calls;
 for(let t=1001;t<1299;t+=16)r.update(c,p,t);assert.equal(calls,checked);
 r.update(c,p,1301);assert.equal(calls,checked+1);
});
// Exercise the actual production crossing branch after the guide's route. Test rider
// coordinates are fixture inputs; neither the planner nor the crossing is replaced.
const engine=fs.readFileSync(new URL('../assets/features/course-engine.js',import.meta.url),'utf8');
const crossing=engine.slice(engine.indexOf('  const j=c.jumps[c.idx];',engine.indexOf("G.on('courseTick'")),engine.indexOf('  /* the line between obstacles */'));
assert(crossing.includes('j.prevSide'));
const tick=new Function('c','player','jumping','G','GRADE','document','flash','toast',`const S=c.ce,dt=.1,t=0,R={};const jumpingNow=()=>jumping;const gradeCrossing=()=>jumping?'good':'fault';const advance=(c)=>{c.idx++;return c.idx===c.jumps.length;};${crossing}`);
test('following recovery backward does not count; a real forward jump then advances exactly once',()=>{
 const j=fence(),c=course(j),p=rider(),r=make();c.faults=0;const G={beep(){},money:{statBump(){}},sChime(){}};const grade={good:{icon:'',text:''},fault:{icon:'',text:''}};
 const step=(jumping=false)=>tick(c,p,jumping,G,grade,{body:{classList:{contains:()=>false}}},()=>{},()=>{});
 r.update(c,p,0);const route=r.path.map(p=>({...p}));let now=0;
 step();for(const to of route){const from={...p.pos},n=Math.ceil(Math.hypot(to.x-from.x,to.z-from.z)/.3);for(let i=1;i<=n;i++){p.pos={x:from.x+(to.x-from.x)*i/n,z:from.z+(to.z-from.z)*i/n};r.update(c,p,now+=100);step();assert.equal(c.idx,0);}}
 p.heading=0;r.update(c,p,now+=100);assert.equal(r.snapshot(),null);
 while(p.pos.z<.1){p.pos.z+=.2;p.y=.8;step(true);if(c.idx)break;}
 assert.equal(c.idx,1);assert.deepEqual(c.ce.grades,['good']);assert.equal(c.ce.refusals,0);
});

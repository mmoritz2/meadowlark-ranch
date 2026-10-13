import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {formalFenceEligible,createFormalFenceGuidance} from '../assets/formal-fence-guidance.mjs';
import {jumpCue,createRushFenceRecovery,rushRecoverySegmentClear} from '../assets/features/course-guide.js';
import {createFlatRaceGuidance,flatRaceSegmentClear} from '../assets/flat-race-guidance.mjs';

const point=(x,z)=>({x,z});
const fence=(extra={})=>({kind:'fence',x:0,z:-40,rotY:0,prevSide:0,refuseCd:0,...extra});
const course=(j=fence())=>({started:true,ev:{id:'h1',name:'Cottonwood Schooling'},idx:0,jumps:[j],ce:{kind:'jump',lap:1,laps:1,refusals:0,grades:[],off:0,insp:0},faults:0,t:12});
const rider=(x=0,z=-48,heading=0)=>({pos:point(x,z),heading,speed:0,y:0,vy:0,landT:0,flying:false,onFoot:false});
const world=()=>({groundH:()=>0,colliders:[],walls:[]});
const make=(w=world(),options={})=>createFormalFenceGuidance({clearSegment:(a,b,c,j)=>flatRaceSegmentClear(a,b,{world:w})&&rushRecoverySegmentClear(a,b,{world:w,course:c,skip:j}),...options});
const freeze=value=>{if(value&&typeof value==='object'){Object.freeze(value);for(const x of Object.values(value))freeze(x);}return value;};
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
function local(p,j){const dx=p.x-j.x,dz=p.z-j.z;return point(dx*Math.cos(j.rotY)-dz*Math.sin(j.rotY),dx*Math.sin(j.rotY)+dz*Math.cos(j.rotY));}
function worldPoint(x,z,j){return point(j.x+x*Math.cos(j.rotY)+z*Math.sin(j.rotY),j.z-x*Math.sin(j.rotY)+z*Math.cos(j.rotY));}
function railDistance(p,j){const q=local(p,j);return Math.hypot(Math.max(0,Math.abs(q.x)-1.8),q.z);}
// Independent dense check of every published segment, including current-rail
// clearance (the shared world probe intentionally skips that current fence).
function proveRoute(p,s,c,w){
 assert(s.target&&s.waypoints.length);let from=p.pos;
 for(const to of s.waypoints){
  assert.equal(flatRaceSegmentClear(from,to,{world:w}),true);assert.equal(rushRecoverySegmentClear(from,to,{world:w,course:c,skip:c.jumps[c.idx]}),true);
  const initial=railDistance(from,c.jumps[c.idx]),margin=Math.min(initial,1)-.001,n=Math.max(1,Math.ceil(distance(from,to)/.03));
  for(let i=0;i<=n;i++)assert(railDistance(point(from.x+(to.x-from.x)*i/n,from.z+(to.z-from.z)*i/n),c.jumps[c.idx])>=margin-1e-8,'published segment crosses or approaches the rail');
  from=to;
 }
 const entry=worldPoint(0,-1.15,c.jumps[c.idx]);assert.equal(flatRaceSegmentClear(s.waypoints.at(-1),entry,{world:w}),true);assert.equal(rushRecoverySegmentClear(s.waypoints.at(-1),entry,{world:w,course:c,skip:c.jumps[c.idx]}),true,'the last marker has a clear forward run-in');
}

test('eligibility only covers actual unscored ordinary formal fences, including no first-leg bypass',()=>{
 assert.equal(formalFenceEligible(course()),true);
 const bad=[c=>c.done=true,c=>c.dressage=true,c=>c.race=true,c=>c.rush=true,c=>c.xc=true,c=>c.ev.dressage=true,c=>c.ev.race=true,c=>c.ev.rush=true,c=>c.ev.xc=true,c=>c.ev.gauntlet=true,c=>c.ev.kind='custom',c=>c.ev.line=true,c=>c.ce.line=[],c=>c.ce.kind='race',c=>c.ev.id='',c=>c.ev.id=9,c=>c.idx=.5,c=>c.idx=-1,c=>c.ce.lap=0,c=>c.ce.lap=1.5,c=>c.jumps[0].kind='gate',c=>c.jumps[0].x=NaN,c=>c.jumps[0].rotY=Infinity,c=>c.jumps=[]];
 for(const mutate of bad){const c=course();mutate(c);assert.equal(formalFenceEligible(c),false,mutate.toString());assert.equal(make().update(c,rider(),0),null);}
 for(const c of [null,undefined,{},[]])assert.equal(formalFenceEligible(c),false);
});

test('the captured stopped second-fence mismatch gets a safe rear marker without mutating gameplay',()=>{
 const j=fence({x:-7.200294928206159,z:-105.5386615675625,rotY:-1.635246092380191}),raw=course(fence({x:20,z:-130}));raw.jumps.push(j);raw.idx=1;
 const c=freeze(raw),p=freeze(rider(.08348645888110474,-107.86519981495137,-1.7951380267106793)),w=freeze(world()),before=JSON.stringify({c,p,w}),r=make(w),s=r.update(c,p,1000);
 assert.equal(jumpCue(j,p),'');assert.equal(s.phase,'approach');assert.equal(s.index,1);assert.equal(s.lap,1);assert.equal(s.courseId,'h1');assert.deepEqual(s.fence,{x:j.x,z:j.z,rotY:j.rotY,kind:'fence'});
 const rear=local(s.target,j);assert(Math.abs(rear.x)<1e-8);assert(rear.z<=-6);assert.notDeepEqual(s.target,point(j.x,j.z));proveRoute(p,s,c,w);assert.equal(JSON.stringify({c,p,w}),before);
 for(const value of [s,s.target,s.fence,s.waypoints,...s.waypoints])assert(Object.isFrozen(value));assert.throws(()=>s.target.x=99,TypeError);
});

test('stopped facing advice persists until the projected crossing is genuinely aligned',()=>{
 const c=course(),p=rider(0,-48,Math.PI),r=make();const s=r.update(c,p,0);assert.equal(s.phase,'lineup');assert.deepEqual(s.target,point(0,-40));assert.match(s.hint,/Face fence/);
 assert.equal(r.update(c,p,20),s);p.heading=.36;assert.equal(r.update(c,p,30).phase,'lineup','a forward cosine alone would send this rider beside the rail');
 p.heading=.1;const ready=r.update(c,p,40);assert.equal(ready.phase,'run-in');assert.deepEqual(ready.target,point(0,-40));assert.equal(jumpCue(c.jumps[0],p),'','the original cue still requires riding speed');
 p.speed=10;assert.equal(jumpCue(c.jumps[0],p),'perfect');assert.equal(r.update(c,p,50),ready);
});

test('the live six-metre-marker arrival hands off naturally and retains facing guidance while stopped',()=>{
 const j=fence({x:-7.200294928206159,z:-105.5386615675625,rotY:-1.635246092380191}),c=course(fence({x:20,z:-130}));c.jumps.push(j);c.idx=1;c.ce.grades=['good'];
 // Actual normal-play frame from formal-approach-marker-pilot.json. Its centre
 // is only .625m from the validated six-metre marker, on the fence's rear side.
 const p=rider(-1.8357942075129363,-105.11009116268423,-5.739567306678453),before=JSON.stringify({c,p}),r=make();
 const s=r.update(c,p,1000);assert.equal(s.phase,'lineup');assert.deepEqual(s.target,point(j.x,j.z));assert.match(s.hint,/Face fence/);const revision=s.revision;
 for(let now=1016;now<=1800;now+=16){assert.equal(r.update(c,p,now),s);assert.equal(r.revision,revision,'remaining stopped in the arrival zone cannot rechoose its marker');}
 assert.equal(JSON.stringify({c,p}),before);p.heading=j.rotY;const run=r.update(c,p,1801);assert.equal(run.phase,'run-in');assert.deepEqual(run.target,point(j.x,j.z));assert.equal(c.idx,1);assert.deepEqual(c.ce.grades,['good']);
});

test('ordinary incremental walking reaches Face fence within the marker radius and can turn into the run-in',()=>{
 const j=fence({x:-7.2,z:-105.5,rotY:-1.635}),c=course(j),p=rider(),r=make();p.pos=worldPoint(2.8,-3.7,j);let now=0,s=r.update(c,p,now);assert.equal(s.phase,'approach');
 const marker={...s.target},initial=distance(p.pos,marker);assert(initial>.9);p.heading=Math.atan2(marker.x-p.pos.x,marker.z-p.pos.z);p.speed=2;
 while(distance(p.pos,marker)>.75){const d=distance(p.pos,marker),step=Math.min(.12,d-.75);p.pos=point(p.pos.x+(marker.x-p.pos.x)*step/d,p.pos.z+(marker.z-p.pos.z)*step/d);s=r.update(c,p,now+=60);assert.equal(c.idx,0);}
 assert.equal(s.phase,'lineup');p.speed=0;const stopped={...p.pos},facing=s;
 for(let i=0;i<15;i++){const angle=Math.atan2(Math.sin(j.rotY-p.heading),Math.cos(j.rotY-p.heading));if(Math.abs(angle)>.1)p.heading+=Math.sign(angle)*.1;s=r.update(c,p,now+=60);assert.deepEqual(p.pos,stopped);assert(['lineup','run-in'].includes(s.phase));}
 p.heading=j.rotY;s=r.update(c,p,now+=60);assert.equal(s.phase,'run-in');assert.deepEqual(s.target,point(j.x,j.z));assert.equal(c.idx,0);assert.deepEqual(c.ce.grades,[]);assert.equal(facing.hint,'Face fence');
});

test('arrival handoff needs real rear space and a clear run-in, and never releases a wrong projected heading',()=>{
 for(const [x,z] of [[0,-44.4],[1.5,-45.5],[0,-42]]){const s=make().update(course(),rider(x,z,0),0);assert.equal(s.phase,'approach');assert.notEqual(s.target.z,-40);}
 const c=course(),p=rider(0,-45.3,Math.PI),f=actualFixture(c,p);f.tickReticle(.016,1);assert.equal(f.formalGuide.snapshot().phase,'lineup');assert.deepEqual(f.cues(),{toGrade:'',toCue:'',visible:false});
 p.heading=.35;p.speed=8;f.tickReticle(.016,1);assert.equal(f.formalGuide.snapshot().phase,'lineup','the short arrival zone retains the real projected crossing band');assert.deepEqual(f.cues(),{toGrade:'',toCue:'',visible:false});
 p.heading=0;f.tickReticle(.016,1);assert.equal(f.formalGuide.snapshot().phase,'run-in');assert.equal(f.cues().toCue,'perfect');
 const blocked=actualFixture(c,rider(0,-45.3,Math.PI),{...world(),solidWorld:{resolve(){return 1;}}});assert.equal(blocked.plan(c).ok,false);assert.equal(blocked.formalGuide.snapshot().phase,'blocked');assert.equal(blocked.formalGuide.snapshot().target,null);
});

test('off-angle, refusal and post-skimming positions get only outward clear reapproaches',()=>{
 for(const [x,z] of [[3,-41],[2,-40],[-2,-40],[4,-39],[0,-41.7],[.2,-42]]){
  const c=course(),p=rider(x,z,Math.PI/2),r=make(),s=r.update(c,p,0);assert(s.target,`${x},${z} has room to recover`);assert.notEqual(s.phase,'run-in');proveRoute(p,s,c,world());
 }
 const c=course(),p=rider(),r=make();assert.equal(r.update(c,p,0).phase,'run-in');p.pos.z=-41.7;c.ce.refusals=1;const s=r.update(c,p,20);assert.equal(s.phase,'approach');assert(s.target.z<=-46);assert.equal(c.idx,0);assert.deepEqual(c.ce.grades,[]);
});

test('wrong-side routes go around the actual rail, retain corners, and then publish Face fence',()=>{
 const c=course(),p=rider(0,-36,Math.PI),r=make(),w=world();let s=r.update(c,p,0);assert.equal(s.phase,'around');assert(Math.abs(s.target.x)>=3.5);proveRoute(p,s,c,w);
 let now=0,steps=0;while(s.phase!=='lineup'&&steps++<8){p.pos={...s.target};s=r.update(c,p,now+=350);assert(s?.target);}
 assert.equal(s.phase,'lineup');assert.deepEqual(s.target,point(0,-40));p.heading=0;assert.equal(r.update(c,p,now+1).phase,'run-in');assert.equal(c.idx,0);
});

test('rotated fences preserve the true normal and a safe around-end route',()=>{
 for(const yaw of [.7,Math.PI/2,Math.PI,-1.2]){
  const j=fence({x:50,z:-80,rotY:yaw}),c=course(j),p=rider();p.pos=worldPoint(0,4,j);p.heading=yaw+Math.PI;const w=world(),s=make(w).update(c,p,0);assert.equal(s.phase,'around');proveRoute(p,s,c,w);
  const last=local(s.waypoints.at(-1),j);assert(Math.abs(last.x)<1e-8);assert(last.z<=-6+1e-8);
  const guide=make(w);p.pos={...s.waypoints.at(-1)};p.heading=yaw+Math.PI;assert.equal(guide.update(c,p,1).phase,'lineup','rotated six-metre markers must not require a second approach due to rounding');
 }
});

test('world props and other rails choose a clear alternative or report an honest blocked state',()=>{
 for(const w of [{...world(),colliders:[{x:3.5,z:-39,r:2}]},{...world(),walls:[{x1:2.9,z1:-55,x2:2.9,z2:-32}]}]){
  const c=course(),p=rider(0,-36,Math.PI),s=make(w).update(c,p,0);assert(s.target);assert(s.target.x<0);proveRoute(p,s,c,w);
 }
 const c=course();c.jumps.push(fence({z:-44}));const p=rider(0,-36,Math.PI),w=world(),s=make(w).update(c,p,0);assert.equal(s.phase,'blocked');assert.equal(s.target,null,'another fence seals the final forward approach; never promise its crossing');
 for(const blocked of [{...world(),walls:[{x1:-30,z1:-44,x2:30,z2:-44}]},{...world(),solidWorld:{resolve(p){p.x+=.2;}}},{...world(),groundH:()=>NaN}]){
  const r=make(blocked),s=r.update(course(),rider(0,-36,Math.PI),0);assert.equal(s.phase,'blocked');assert.equal(s.target,null);assert.equal(r.path.length,0);
 }
});

test('uncertain clearance fails closed and callback arguments cannot mutate rider observations',()=>{
 for(const options of [{},{clearSegment:()=>false},{clearSegment:()=>{throw Error('unavailable');}},{clearSegment:()=>1}]){
  const r=createFormalFenceGuidance(options),s=r.update(course(),rider(3,-47),0);assert.equal(s.phase,'blocked');assert.equal(s.target,null);
 }
 const c=freeze(course()),p=freeze(rider(3,-47)),before=JSON.stringify({c,p});let calls=0;
 const r=createFormalFenceGuidance({clearSegment:(a,b,owner,j)=>{calls++;assert(Object.isFrozen(a)&&Object.isFrozen(b));assert.equal(owner,c);assert.equal(j,c.jumps[0]);assert.throws(()=>a.x=9,TypeError);return true;}});
 assert(r.update(c,p,0).target);assert(calls>0);assert.equal(JSON.stringify({c,p}),before);
});

test('bounds, lake water, river water and steep ground cannot produce a ground route',()=>{
 for(const [j,p,w] of [
  [fence({x:455}),rider(455,-48),world()],
  [fence({x:20,z:16}),rider(20,8),world()],
  [fence(),rider(),{...world(),terrainH:()=>0,riverZ:()=>-44,riverLevel:()=>1}],
  [fence(),rider(),{...world(),groundH:(x,z)=>z>-44?3:0}],
 ]){const s=make(w).update(course(j),p,0);assert.equal(s.phase,'blocked');assert.equal(s.target,null);}
});

test('every airborne, native landing and on-foot state withdraws ground guidance without probing',()=>{
 const changes=[p=>p.y=.2,p=>p.vy=-.2,p=>p.landT=.01,p=>p.flying=true,p=>p.landing=true,p=>p.onFoot=true];
 for(const mutate of changes){let calls=0;const r=createFormalFenceGuidance({clearSegment:()=>{calls++;return true;}}),c=course(),p=rider(3,-47);assert(r.update(c,p,0).target);mutate(p);const before=calls,s=r.update(c,p,1000);assert.equal(s.phase,p.onFoot?'paused':'landing');assert.equal(s.target,null);assert.equal(s.waypoints.length,0);assert.equal(r.path.length,0);assert.equal(calls,before);}
 let nativeJump=true,calls=0;const r=createFormalFenceGuidance({clearSegment:()=>{calls++;return true;},isJumping:()=>nativeJump}),c=course(),p=rider();assert.equal(r.update(c,p,0).phase,'landing');assert.equal(calls,0);nativeJump=false;assert.equal(r.update(c,p,1).phase,'run-in');assert(calls>0);
});

test('nonfinite actor or time observations publish no fabricated target',()=>{
 for(const mutate of [p=>p.pos.x=NaN,p=>p.pos.z=Infinity,p=>p.heading=NaN,p=>p.y=NaN,p=>p.vy=Infinity,p=>p.landT=NaN]){const c=course(),p=rider();mutate(p);let calls=0;const r=createFormalFenceGuidance({clearSegment:()=>{calls++;return true;}});assert.equal(r.update(c,p,0).phase,'blocked');assert.equal(calls,0);}
 for(const now of [NaN,Infinity,-1])assert.equal(make().update(course(),rider(),now).phase,'blocked');
});

test('revalidation is bounded, idempotent within a frame, and includes the last forward run-in',()=>{
 let calls=0,blocked=false;const c=course(),p=rider(3,-47),r=createFormalFenceGuidance({clearSegment:(a,b)=>{calls++;return !(blocked&&b.z===-41.15);}}),first=r.update(c,p,1000),initial=calls;
 assert.equal(first.phase,'approach');assert.equal(r.update(c,p,1000),first);for(let t=1001;t<1300;t+=16)assert.equal(r.update(c,p,t),first);assert.equal(calls,initial);
 r.update(c,p,1300);assert(calls>initial);const after=calls;blocked=true;assert.equal(r.update(c,p,1400),first);assert.equal(calls,after);
 const state=r.update(c,p,1600);assert.equal(state.phase,'blocked');assert.equal(state.target,null);const failed=calls;r.update(c,p,1600);r.update(c,p,1700);assert.equal(calls,failed,'blocked routes do not rebuild every frame');
 blocked=false;assert(r.update(c,p,1900).target);
});

test('a blocked run-in retries at the bounded cadence instead of oscillating with lineup',()=>{
 let calls=0,clear=false;const r=createFormalFenceGuidance({clearSegment:()=>{calls++;return clear;}}),c=course(),p=rider();assert.equal(r.update(c,p,0).phase,'blocked');const first=calls;
 for(let t=1;t<300;t+=16)assert.equal(r.update(c,p,t).phase,'blocked');assert.equal(calls,first);clear=true;assert.equal(r.update(c,p,300).phase,'run-in');assert.equal(calls,first+1);
});

test('all course/fence/lap/pose/refusal changes invalidate cached identity immediately',()=>{
 for(const mutate of [c=>c.idx=1,c=>c.ce.lap=2,c=>c.jumps[0]={...c.jumps[0]},c=>c.jumps[0].x+=1,c=>c.jumps[0].z-=1,c=>c.jumps[0].rotY=.1,c=>c.ce.refusals++]){
  const c=course(),p=rider(3,-47);c.jumps.push(fence({x:1,z:-41}));let calls=0;const r=createFormalFenceGuidance({clearSegment:()=>{calls++;return true;}}),s=r.update(c,p,1000),n=calls;mutate(c);const next=r.update(c,p,1001);assert(calls>n,mutate.toString());assert(next.revision>s.revision);assert.equal(next.index,c.idx);assert.equal(next.lap,c.ce.lap);assert.equal(next.fence.x,c.jumps[c.idx].x);
 }
 const p=rider(3,-47),r=make(),a=course(),first=r.update(a,p,1000),b=course();b.ev.id='h2';assert.equal(r.update(b,p,1001).courseId,'h2');assert(r.revision>first.revision);const prior=r.revision;r.update(b,p,10);assert(r.revision>prior,'restarted clocks invalidate cadence');
 b.done=true;assert.equal(r.update(b,p,11),null);assert.equal(r.snapshot(),null);r.reset();assert.equal(r.snapshot(),null);
});

test('gradual side-skimming never retains a now-unsafe ray through the current fence',()=>{
 const c=course(),p=rider(3,-41),r=make();r.update(c,p,0);
 for(let i=1;i<=10;i++){p.pos.z=-41+i*.5;const s=r.update(c,p,i*350);if(s.target)proveRoute(p,s,c,world());}
 assert.equal(r.snapshot().phase,'around');assert.equal(c.idx,0);assert.deepEqual(c.ce.grades,[]);
});

const source=readFileSync(new URL('../assets/features/course-guide.js',import.meta.url),'utf8');
function section(start,end){const a=source.indexOf(start),b=source.indexOf(end,a+start.length);assert(a>=0&&b>a,`missing production boundary ${start}`);return source.slice(a,b);}
const planSource=section(' const PL={',' /* ---------------------------------------------------------------- per frame');
const reticleSource=section(' function tickReticle(dt,t){',' /* ---------------------------------------------------------------- the readout');
const hideSource=section(' function hide(){'," G.on('tick',(dt,t)=>{");
const waitSource=section('   const formal=formalGuide.snapshot();','   // Never fade');
const publicTarget=source.split('\n').find(line=>line.trim().startsWith('target:()=>tx===null?'));assert(publicTarget);
function actualFixture(c,p,w=world()){
 let current=c,now=1000,native={heroJumpAge:null,heroJumpGrace:0};const events=new Map(),G={course:{get:()=>current,ARENA_LETTERS:{A:[0,-18],X:[0,0]}},horse:{RIG:()=>native},on:(name,fn)=>events.set(name,fn)};
 // Execute the actual installation seam, so native grace/landing tests cover
 // production wiring as well as the pure controller's suspension contract.
 const binding=source.split('\n').find(line=>line.trim().startsWith('const formalGuide=createFormalFenceGuidance'));assert(binding);
 const formalGuide=Function('createFormalFenceGuidance','rushRecoverySegmentClear','flatRaceSegmentClear','W','G',binding+'return formalGuide;')(createFormalFenceGuidance,rushRecoverySegmentClear,flatRaceSegmentClear,w,G);
 const flatGuide=createFlatRaceGuidance({world:w}),fenceRecovery=createRushFenceRecovery({clearSegment:(a,b,owner,j)=>rushRecoverySegmentClear(a,b,{world:w,course:owner,skip:j})});
 const reticle={visible:true,scale:{set(){}},position:{set(){}}},reticleMat={color:{setHex(){}},opacity:1};
 const api=Function('G','player','flatGuide','fenceRecovery','formalGuide','performance','CIRC','jumpCue','reticle','reticleMat','groundH',`"use strict";let enabled=true,closing=false,toGrade='perfect',toCue='perfect';const C_PERFECT=1,C_GOOD=2,C_MISS=3;${planSource}${reticleSource}return {plan,PL,tickReticle,cues:()=>({toGrade,toCue,visible:reticle.visible}),enabled(v){enabled=v;},closing(v){closing=v;}};`)(G,p,flatGuide,fenceRecovery,formalGuide,{now:()=>now},{r:6.5,inset:3.7},jumpCue,reticle,reticleMat,w.groundH);
 return {...api,G,p,w,formalGuide,flatGuide,fenceRecovery,events,setNow:value=>now=value,setCourse:value=>current=value,setNative:value=>native=value};
}
const plannedPoints=P=>P.pts.slice(0,P.n).map(([x,z])=>point(x,z));

test('actual plan publishes the safe waypoint with current fence identity and keeps legacy run-in centre',()=>{
 const c=course(),p=rider(3,-47),before=JSON.stringify({c,p}),f=actualFixture(c,p),P=f.plan(c),s=f.formalGuide.snapshot();assert.equal(P.ok,true);assert.equal(P.mode,7);assert.equal(P.scored,false);assert.deepEqual(point(P.tx,P.tz),s.target);assert.deepEqual(plannedPoints(P),[p.pos,...s.waypoints]);assert.notDeepEqual(s.target,point(0,-40));assert.equal(JSON.stringify({c,p}),before);
 p.pos=point(0,-48);p.heading=0;const Q=f.plan(c);assert.equal(f.formalGuide.snapshot().phase,'run-in');assert.equal(Q.mode,2);assert.deepEqual(point(Q.tx,Q.tz),point(0,-40));assert.equal(c.idx,0);
});

test('actual plan preserves scored first/next legs, Rush recovery, flat and judged guidance',()=>{
 const p=rider(0,-36,Math.PI),lineCourse=course();lineCourse.ev.line=true;lineCourse.ce.line=[null,{x1:-6,z1:-44,x2:0,z2:-46}];lineCourse.jumps.push(fence());const f=actualFixture(lineCourse,p);
 assert.equal(f.plan(lineCourse).mode,2);assert.equal(f.formalGuide.snapshot(),null,'scored events keep their original first-leg policy');lineCourse.idx=1;let P=f.plan(lineCourse);assert.equal(P.mode,1);assert.equal(P.scored,true);assert.deepEqual(plannedPoints(P),[point(-6,-44),point(0,-46),point(0,-40)]);
 const rush=course();rush.ev.rush=true;P=f.plan(rush);assert.equal(P.mode,5);assert.equal(f.formalGuide.snapshot(),null);assert.equal(f.fenceRecovery.snapshot().phase,'around');
 const flat={race:true,started:true,ev:{id:'a1',race:true,disc:'race'},idx:0,ce:{kind:'race'},jumps:[{kind:'gate',x:10,z:-40}]};P=f.plan(flat);assert.equal(P.mode,6);assert.equal(f.formalGuide.snapshot(),null);assert.deepEqual(point(P.tx,P.tz),point(10,-40));
 const judged={dressage:true,done:false,fi:0,figs:[{at:'A'}]};P=f.plan(judged);assert.equal(P.ok,true);assert.deepEqual(point(P.tx,P.tz),point(0,-18));
});

test('actual formal installation rejects real solid contacts even with no net resolve displacement',()=>{
 const c=course(),p=rider(),w={...world(),solidWorld:{resolve(){return 1;}}};
 assert.equal(rushRecoverySegmentClear(p.pos,point(0,-41.15),{world:w,course:c,skip:c.jumps[0]}),true,'the historical Rush probe alone cannot detect a zero-displacement contact');
 assert.equal(flatRaceSegmentClear(p.pos,point(0,-41.15),{world:w}),false);
 const f=actualFixture(c,p,w);assert.equal(f.plan(c).ok,false);assert.equal(f.formalGuide.snapshot().phase,'blocked');assert.equal(f.formalGuide.snapshot().target,null);p.speed=10;f.tickReticle(.016,1);assert.deepEqual(f.cues(),{toGrade:'',toCue:'',visible:false});
 const clear=actualFixture(c,p,{...world(),solidWorld:{resolve(){return 0;}}});assert.equal(clear.plan(c).ok,true);assert.equal(clear.formalGuide.snapshot().phase,'run-in');
});

test('actual reticle never publishes Jump during approach, lineup, blocked or landing',()=>{
 const c=course(),p=rider(0,-43),f=actualFixture(c,p);p.speed=5;assert.equal(jumpCue(c.jumps[0],p),'perfect','the old direct cue would invite a short approach');
 f.tickReticle(.016,1);assert.equal(f.formalGuide.snapshot().phase,'approach');assert.deepEqual(f.cues(),{toGrade:'',toCue:'',visible:false});
 p.pos=point(0,-48);p.heading=.36;f.setNow(1400);f.tickReticle(.016,2);assert.equal(f.formalGuide.snapshot().phase,'lineup');assert.deepEqual(f.cues(),{toGrade:'',toCue:'',visible:false});
 p.heading=0;p.speed=10;f.tickReticle(.016,3);assert.equal(f.formalGuide.snapshot().phase,'run-in');assert.deepEqual(f.cues(),{toGrade:'perfect',toCue:'perfect',visible:true});
 for(const native of [{heroJumpAge:.8,heroJumpGrace:0},{heroJumpAge:null,heroJumpGrace:.01}]){f.setNative(native);f.tickReticle(.016,4);assert.equal(f.formalGuide.snapshot().phase,'landing');assert.deepEqual(f.cues(),{toGrade:'',toCue:'',visible:false});}
 const blocked=actualFixture(c,p,{...world(),walls:[{x1:-20,z1:-44,x2:20,z2:-44}]});blocked.tickReticle(.016,1);assert.equal(blocked.formalGuide.snapshot().phase,'blocked');assert.deepEqual(blocked.cues(),{toGrade:'',toCue:'',visible:false});
 f.enabled(false);f.tickReticle(.016,1);assert.equal(f.formalGuide.snapshot(),null);assert.deepEqual(f.cues(),{toGrade:'',toCue:'',visible:false});
});

test('actual plan and immediate hide withdraw prior lines, target and cues during landing or blockage',()=>{
 for(const mutate of [p=>p.landT=.01,p=>p.y=.2,p=>p.onFoot=true]){
  const c=course(),p=rider(),f=actualFixture(c,p);f.plan(c);mutate(p);assert.equal(f.plan(c).ok,false);const expected=f.formalGuide.snapshot();assert(['landing','paused'].includes(expected.phase));
  const view=Function('formalGuide',`let fade=1,tx=0,tz=-40,circ={},toGrade='perfect',toCue='perfect',closing=false;const core={count:20,visible:true},rim={count:20,visible:true},ring={visible:true},bigRing={visible:true},reticle={visible:true},distEl={style:{display:''},textContent:'stale'};${hideSource}return {tick(c){${waitSource}return 'continued';},${publicTarget}snapshot:()=>({fade,core,rim,ring,bigRing,reticle,toGrade,toCue,circ,distEl})};`)(f.formalGuide);
  assert.equal(view.tick(c),undefined);assert.equal(view.target(),null);const s=view.snapshot();assert.equal(s.fade,0);assert.equal(s.core.count,0);assert.equal(s.rim.count,0);for(const key of ['core','rim','ring','bigRing','reticle'])assert.equal(s[key].visible,false);assert.equal(s.toGrade,'');assert.equal(s.toCue,'');assert.equal(s.circ,null);assert.equal(s.distEl.textContent,'· '+expected.hint);assert.equal(s.distEl.style.display,'');
 }
 const c=course(),p=rider(),f=actualFixture(c,p,{...world(),walls:[{x1:-20,z1:-44,x2:20,z2:-44}]});assert.equal(f.plan(c).ok,false);assert.equal(f.formalGuide.snapshot().phase,'blocked');
});

test('the actual public snapshot and state diagnostic withdraw while disabled/finishing and reset only current finish',()=>{
 const f=actualFixture(course(),rider()),c=f.G.course.get();f.plan(c);const expected=f.formalGuide.snapshot();assert(expected);
 const a=source.indexOf('formalApproach:()=>enabled'),b=source.indexOf(',gateGuide:',a);assert(a>=0&&b>a);const expr=source.slice(a+'formalApproach:'.length,b);
 const api=Function('formalGuide',`let enabled=true,closing=false;const formalApproach=${expr};return {formalApproach,set(a,b){enabled=a;closing=b;}};`)(f.formalGuide);assert.equal(api.formalApproach(),expected);api.set(false,false);assert.equal(api.formalApproach(),null);api.set(true,true);assert.equal(api.formalApproach(),null);
 const eventHooks=section(" G.on('courseStart',",' function hide(){');const events=new Map();let closing;
 const hooks=Function('G','formalGuide','flatGuide','fenceRecovery',`let closing=false;const SP={},STATS={};${eventHooks}return {closing:()=>closing,SP,STATS};`)({...f.G,on:(k,fn)=>events.set(k,fn)},f.formalGuide,f.flatGuide,f.fenceRecovery);
 events.get('courseFinish')({c:course()});assert.equal(hooks.closing(),false);assert.equal(f.formalGuide.snapshot(),expected);events.get('courseFinish')({c});assert.equal(hooks.closing(),true);assert.equal(f.formalGuide.snapshot(),null);events.get('courseStart')();assert.equal(hooks.closing(),false);assert.equal(hooks.SP.mode,-1);assert.equal(hooks.STATS.lays,0);
 const diagnostic=source.split('\n').find(line=>line.includes('formalApproach:enabled&&!closing?'));assert(diagnostic,'state must expose the same formal snapshot, not privately guessed waypoints');
});

// This executes the real production crossing and grade branches. The test moves
// fixture observations; the advisory controller never moves a horse or earns XP.
const engine=readFileSync(new URL('../assets/features/course-engine.js',import.meta.url),'utf8');
const crossing=engine.slice(engine.indexOf('  const j=c.jumps[c.idx];',engine.indexOf("G.on('courseTick'")),engine.indexOf('  /* the line between obstacles */'));assert(crossing.includes('j.prevSide'));
const grade=engine.slice(engine.indexOf(' function gradeCrossing(){'),engine.indexOf(' function segDist('));assert(grade.includes('nativeCrossing.age'));
const actualCrossing=Function('c','player','jumping','age','G',`const S=c.ce,dt=.1,t=0,R={},nativeCrossing={age};const rig=()=>({heroMotion:true,heroJumpAge:age});const jumpingNow=()=>jumping;const advance=c=>{c.idx++;return c.idx===c.jumps.length;};const document={body:{classList:{contains:()=>false}}},flash=()=>{},toast=()=>{},GRADE={good:{icon:'',text:''},fault:{icon:'',text:''}};${grade}${crossing}`);
test('advisory around/reapproach yields no crossing credit; real forward native Good jump advances once',()=>{
 const c=course(),p=rider(0,-36,Math.PI),r=make(),G={beep(){},money:{statBump(){}},sChime(){},xp:{passAdd(){throw Error('Good fixture must not invent perfect XP');}}};
 const step=(jumping=false)=>actualCrossing(c,p,jumping,jumping?1.06:null,G);let s=r.update(c,p,0),now=0;step();const route=s.waypoints.map(p=>({...p}));
 for(const to of route){const from={...p.pos},n=Math.ceil(distance(from,to)/.15);for(let i=1;i<=n;i++){p.pos=point(from.x+(to.x-from.x)*i/n,from.z+(to.z-from.z)*i/n);s=r.update(c,p,now+=50);step();assert.equal(c.idx,0);assert.deepEqual(c.ce.grades,[]);}}
 p.heading=0;p.speed=10;assert.equal(r.update(c,p,now+1).phase,'run-in');assert.equal(jumpCue(c.jumps[0],p),'perfect');
 p.y=.8;p.vy=.1;while(p.pos.z< -39.9){p.pos.z+=.15;r.update(c,p,now+=50);step(true);if(c.idx)break;}
 assert.equal(c.idx,1);assert.deepEqual(c.ce.grades,['good']);assert.equal(c.ce.refusals,0);assert.equal(c.ce.lastJumpTiming.fenceIndex,0);assert.equal(c.ce.lastJumpTiming.lap,1);assert.equal(c.ce.lastJumpTiming.railAge,1.06);
});

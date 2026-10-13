import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {register} from 'node:module';
import * as T from '../assets/vendor/three/build/three.module.js';
import {createRanchArchitecture} from '../assets/ranch-architecture.js';
import {createSolidWorld} from '../assets/solid-collisions.js';
import {flatRaceEligible,flatRaceSegmentClear,planFlatRaceRoute,createFlatRaceGuidance} from '../assets/flat-race-guidance.mjs';

const threeURL=new URL('../assets/vendor/three/build/three.module.js',import.meta.url).href;
register('data:text/javascript,'+encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return {url:${JSON.stringify(threeURL)},shortCircuit:true};return n(s,c);}`),import.meta.url);
const {createRanchBuilderArt}=await import('../assets/ranch-builder-art.js');
const copy=structuredClone;
const point=(x,z)=>({x,z});
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const flatWorld=()=>({colliders:[],walls:[],groundH:()=>0});
const race=()=>({race:true,started:true,idx:0,cd:0,t:12,ev:{id:'river-run',race:true,disc:'race'},ce:{kind:'race',line:null},jumps:[{kind:'gate',x:10,z:-40},{kind:'gate',x:25,z:-45}]});
const rider=(x=-10,z=-40)=>({pos:{x,z},heading:Math.PI/2,speed:6,y:0,onFoot:false,flying:false});
const deepFreeze=value=>{if(value&&typeof value==='object'){Object.freeze(value);for(const x of Object.values(value))deepFreeze(x);}return value;};
function segmentDistance(p,a,b){const x=b.x-a.x,z=b.z-a.z,q=x*x+z*z,t=q?Math.max(0,Math.min(1,((p.x-a.x)*x+(p.z-a.z)*z)/q)):0;return Math.hypot(p.x-a.x-t*x,p.z-a.z-t*z);}
// Independent dense physical checks: these do not reuse the guide's own validator.
function proveRoute(from,to,path,world){
 assert(Array.isArray(path)&&path.length,'a usable route must have a target');assert.deepEqual(path.at(-1),to,'the real numbered gate stays the final destination');
 let a=from;
 for(const b of path){
  assert([b.x,b.z].every(Number.isFinite));const n=Math.max(1,Math.ceil(distance(a,b)/.08));
  for(let i=0;i<=n;i++){
   const p=point(a.x+(b.x-a.x)*i/n,a.z+(b.z-a.z)*i/n);assert(Math.hypot(p.x,p.z)<=454);
   for(const c of world.colliders||[])if(!c.precise||!world.solidWorld)assert(distance(p,c)>=c.r+.55-1e-7,'route enters a physical circle');
   for(const w of world.walls||[])assert(segmentDistance(p,point(w.x1,w.z1),point(w.x2,w.z2))>=.65-1e-7,'route enters a physical wall');
   if(world.solidWorld){const before={...p},y=world.groundH?.(p.x,p.z)??0;assert.equal(world.solidWorld.resolve(p,{bottom:y+.38,top:y+2.65,radius:.55}),0,'route intersects actual registered solid geometry');assert.deepEqual(p,before);}
  }
  a=b;
 }
}
function realHayWorld(){
 const THREE={...T,TextureLoader:class{load(){return new T.Texture();}}},GLTFLoader=class{loadAsync(){throw Error('The fixture must not request optional assets');}};
 const architecture=createRanchArchitecture({THREE,loadTextures:false}),builder=createRanchBuilderArt({THREE,GLTFLoader,architecture,deferModels:true}),scene=new T.Group(),solidWorld=createSolidWorld({THREE:T});
 const source=readFileSync(new URL('../ranch3d.html',import.meta.url),'utf8');
 // Execute the actual authored placements against real builder art, rather than
 // approximating the bales with guessed boxes or circles.
 const lines=source.split('\n').filter(line=>/^\s*placeRanchProp\('haybale',-(?:90|88\.6),/.test(line));assert.equal(lines.length,2);
 const roots=[];const placeRanchProp=(kind,x,z,ry=0,scale=1)=>{const root=builder.create(kind);root.position.set(x,0,z);root.rotation.y=ry;root.scale.setScalar(scale);scene.add(root);root.updateMatrixWorld(true);solidWorld.register(root);roots.push(root);};
 Function('placeRanchProp',lines.join('\n'))(placeRanchProp);assert(solidWorld.stats().parts>=2);
 return {...flatWorld(),solidWorld,roots};
}

test('eligibility is limited to genuine all-gate unscored flat races',()=>{
 assert.equal(flatRaceEligible(race()),true);
 const invalid=[c=>{c.race=false;},c=>{c.race=1;},c=>{c.ev.race=false;},c=>{c.ev.id='';},c=>{c.ev.id=7;},c=>{c.rush=true;},c=>{c.ev.rush=true;},c=>{c.xc=true;},c=>{c.ev.xc=true;},c=>{c.dressage=true;},c=>{c.ev.dressage=true;},c=>{c.ev.gauntlet=true;},c=>{c.ev.kind='custom';},c=>{c.ev.disc='jump';},c=>{c.ce.kind='jump';},c=>{c.ev.line=true;},c=>{c.ce.line={a:point(0,0),b:point(1,1)};},c=>{c.jumps[1].kind='fence';},c=>{c.jumps[1].x=NaN;},c=>{c.jumps=[];},c=>{c.jumps=new Array(2);},c=>{c.jumps=[null];}];
 for(const mutate of invalid){const c=race();mutate(c);assert.equal(flatRaceEligible(c),false,mutate.toString());assert.equal(createFlatRaceGuidance({world:flatWorld()}).update(c,rider(),1000),null);}
 for(const c of [null,{},[],undefined])assert.equal(flatRaceEligible(c),false);
});

test('a clear route remains direct and never changes player, course or world observations',()=>{
 const from=point(-10,-40),to=point(10,-40),world=deepFreeze(flatWorld()),c=deepFreeze(race()),p=deepFreeze(rider()),before=JSON.stringify({c,p,world});
 assert.equal(flatRaceSegmentClear(from,to,{world}),true);assert.deepEqual(planFlatRaceRoute({from,to,world}),[to]);
 const guide=createFlatRaceGuidance({world}),s=guide.update(c,p,1000);assert.equal(s.phase,'direct');assert.deepEqual(s.target,to);assert.deepEqual(s.gate,to);assert.equal(s.gateIndex,0);assert.deepEqual(s.waypoints,[to]);assert.deepEqual(guide.snapshot(),s);assert.equal(JSON.stringify({c,p,world}),before);
});

test('the actual rotated and scaled race hay blocks the early gate-three ray and its detour is physically clear',()=>{
 const world=realHayWorld(),from=point(-102,-31.5),to=point(-70,-38),before=world.roots.map(r=>r.toJSON()),stats=copy(world.solidWorld.stats());
 assert.equal(flatRaceSegmentClear(from,to,{world}),false,'this is the captured early gate-three approach');
 const path=planFlatRaceRoute({from,to,world});assert(path?.length>1,'the blocked ray requires a detour');proveRoute(from,to,path,world);assert.deepEqual(planFlatRaceRoute({from,to,world}),path,'planning is deterministic');
 assert.deepEqual(world.roots.map(r=>r.toJSON()),before);assert.deepEqual(world.solidWorld.stats(),stats);
 const clearFrom=point(-102,-40),clearTo=point(-70,-40);assert.equal(flatRaceSegmentClear(clearFrom,clearTo,{world}),true);assert.deepEqual(planFlatRaceRoute({from:clearFrom,to:clearTo,world}),[clearTo]);
});

test('finite walls and multiple circle obstacles require real clearance along every segment',()=>{
 for(const world of [{...flatWorld(),walls:[{x1:0,z1:-45,x2:0,z2:-35}]},{...flatWorld(),colliders:[{x:-2,z:-40,r:2},{x:3,z:-38,r:2},{x:4,z:-43,r:1.3}]}]){
  const from=point(-10,-40),to=point(10,-40),before=copy({colliders:world.colliders,walls:world.walls});assert.equal(flatRaceSegmentClear(from,to,{world}),false);const path=planFlatRaceRoute({from,to,world});assert(path?.length>1);proveRoute(from,to,path,world);assert.deepEqual({colliders:world.colliders,walls:world.walls},before);
 }
});

test('sealed destinations and riders inside a real solid are honestly blocked',()=>{
 const world={...flatWorld(),walls:[{x1:-2,z1:-42,x2:2,z2:-42},{x1:2,z1:-42,x2:2,z2:-38},{x1:2,z1:-38,x2:-2,z2:-38},{x1:-2,z1:-38,x2:-2,z2:-42}]};
 assert.equal(planFlatRaceRoute({from:point(-10,-40),to:point(0,-40),world}),null);
 const c=race();Object.assign(c.jumps[0],{x:0,z:-40});const state=createFlatRaceGuidance({world}).update(c,rider(),1000);assert.equal(state.phase,'blocked');assert.equal(state.target,null);assert.deepEqual(state.gate,point(0,-40));
 const hay=realHayWorld();assert.equal(planFlatRaceRoute({from:point(-90,-35),to:point(-70,-38),world:hay}),null);
});

test('invalid geometry, nonfinite terrain and out-of-world travel fail closed',()=>{
 const from=point(-10,-40),to=point(10,-40);
 for(const value of [null,undefined,point(NaN,-40),point(0,Infinity),point('1',-40),point(455,0)]){assert.equal(flatRaceSegmentClear(value,to,{world:flatWorld()}),false);assert.equal(planFlatRaceRoute({from:value,to,world:flatWorld()}),null);assert.equal(planFlatRaceRoute({from,to:value,world:flatWorld()}),null);}
 for(const world of [{...flatWorld(),groundH:()=>NaN},{...flatWorld(),groundH(){throw Error('terrain unavailable');}},{...flatWorld(),solidWorld:{resolve(){throw Error('collision unavailable');}}}]){assert.equal(flatRaceSegmentClear(from,to,{world}),false);assert.equal(planFlatRaceRoute({from,to,world}),null);}
});

test('stable detours reuse their route, retain a waypoint until reached and reset for another course',()=>{
 let probes=0;const world={...flatWorld(),groundH(){probes++;return 0;},walls:[{x1:0,z1:-45,x2:0,z2:-35}]},c=race(),p=rider(),guide=createFlatRaceGuidance({world});
 const initial=guide.update(c,p,1000);assert.equal(initial.phase,'detour');assert(initial.waypoints.length>1);const first={...initial.target},revision=initial.revision,firstProbes=probes;assert(firstProbes>0);
 const cached=guide.update(c,p,1100);assert.deepEqual(cached.target,first);assert.equal(cached.revision,revision);assert.equal(probes,firstProbes,'an unchanged frame within 300 ms does not run the planner');
 let now=1100;while(distance(p.pos,first)>1.2+1e-9){const ray=distance(p.pos,first),step=Math.min(.6,ray-1.2);p.pos=point(p.pos.x+(first.x-p.pos.x)*step/ray,p.pos.z+(first.z-p.pos.z)*step/ray);now+=100;assert.deepEqual(guide.update(c,p,now).target,first,'ordinary approach retains the unreached waypoint');}
 assert(distance(p.pos,first)>.8);assert.deepEqual(guide.snapshot().target,first,'1.2 m is still outside the .8 m waypoint');
 p.pos=point(p.pos.x+(first.x-p.pos.x)*.5/1.2,p.pos.z+(first.z-p.pos.z)*.5/1.2);now+=100;const advanced=guide.update(c,p,now);assert.notDeepEqual(advanced.target,first);assert(advanced.revision>revision);assert.deepEqual(advanced.gate,point(10,-40));
 const next=race();next.ev.id='another-race';Object.assign(next.jumps[0],{x:p.pos.x-5,z:p.pos.z});const replaced=guide.update(next,p,now+100);assert.deepEqual(replaced.gate,point(next.jumps[0].x,next.jumps[0].z));assert.equal(replaced.gateIndex,0);guide.reset();assert.equal(guide.snapshot(),null);
});

test('gate changes and newly blocked cached legs never publish the stale unsafe target',()=>{
 const world=flatWorld(),c=race(),p=rider(),guide=createFlatRaceGuidance({world}),first=guide.update(c,p,1000);assert.equal(first.phase,'direct');
 world.colliders.push({x:0,z:-40,r:3});const rerouted=guide.update(c,p,1400);assert.equal(rerouted.phase,'detour');assert.notDeepEqual(rerouted.target,first.target);proveRoute(p.pos,point(10,-40),rerouted.waypoints,world);
 c.idx=1;const next=guide.update(c,p,1800);assert.equal(next.gateIndex,1);assert.deepEqual(next.gate,point(25,-45));assert.deepEqual(next.waypoints.at(-1),point(25,-45));
 c.jumps[1].kind='fence';assert.equal(guide.update(c,p,1900),null);assert.equal(guide.snapshot(),null);
});

const courseGuideSource=readFileSync(new URL('../assets/features/course-guide.js',import.meta.url),'utf8');
function sourceSection(start,end){const a=courseGuideSource.indexOf(start),b=courseGuideSource.indexOf(end,a+start.length);assert(a>=0&&b>a,`missing actual course-guide boundary: ${start}`);return courseGuideSource.slice(a,b);}
const actualPlanSource=sourceSection(' const PL={',' /* ---------------------------------------------------------------- per frame');
function actualPlanFixture(world,player){
 let now=1000;const flatGuide=createFlatRaceGuidance({world}),G={course:{ARENA_LETTERS:{A:[0,-18],X:[0,0]}}},fenceRecovery={update:()=>null,reset(){},snapshot:()=>null};
 const api=Function('G','player','flatGuide','fenceRecovery','performance','CIRC','"use strict";\n'+actualPlanSource+'\nreturn {plan,PL};')(G,player,flatGuide,fenceRecovery,{now:()=>now},{r:6.5,inset:3.7});
 return {...api,flatGuide,G,setNow:value=>{now=value;}};
}
const plannedPoints=plan=>plan.pts.slice(0,plan.n).map(([x,z])=>point(x,z));

test('actual course-guide plan displays the real hay detour and follows only externally changed gate indices',()=>{
 const world=realHayWorld(),p=deepFreeze(rider(-102,-31.5));let idx=0;const raw=race();Object.defineProperty(raw,'idx',{enumerable:true,get:()=>idx});Object.assign(raw.jumps[0],{x:-70,z:-38});Object.assign(raw.jumps[1],{x:-65,z:-45});const c=deepFreeze(raw),before=JSON.stringify({c,p}),f=actualPlanFixture(world,p);
 const P=f.plan(c),s=f.flatGuide.snapshot();assert.equal(P.ok,true);assert.equal(s.phase,'detour');assert.equal(P.mode,6);assert.equal(P.scored,false);assert.deepEqual(point(P.tx,P.tz),s.target);assert.deepEqual(plannedPoints(P),[p.pos,...s.waypoints.slice(0,4)]);proveRoute(p.pos,plannedPoints(P).at(-1),plannedPoints(P).slice(1),world);assert.equal(c.idx,0);assert.equal(JSON.stringify({c,p}),before);
 const firstTarget={x:P.tx,z:P.tz};f.setNow(1100);assert.deepEqual(point(f.plan(c).tx,P.tz),firstTarget);assert.equal(c.idx,0,'neither plan nor helper advances a numbered gate');
 idx=1;const changedBefore=JSON.stringify({c,p});f.setNow(1500);const Q=f.plan(c),next=f.flatGuide.snapshot();assert.equal(Q.ok,true);assert.equal(c.idx,1);assert.equal(next.gateIndex,1);assert.deepEqual(next.gate,point(-65,-45));assert.deepEqual(point(Q.tx,Q.tz),next.target);assert.deepEqual(next.waypoints.at(-1),point(-65,-45));assert.equal(JSON.stringify({c,p}),changedBefore);
});

test('actual formal scored-line plan preserves the exact scored segment without consulting detour geometry',()=>{
 let probes=0;const world={...flatWorld(),groundH(){probes++;throw Error('Formal scored guidance must not plan a detour');}},p=deepFreeze(rider()),raw=race();raw.idx=1;raw.ev.line=true;raw.ce.line=[null,{x1:-6,z1:-44,x2:19,z2:-45}];const c=deepFreeze(raw),before=JSON.stringify({c,p}),f=actualPlanFixture(world,p),P=f.plan(c);
 assert.equal(P.ok,true);assert.equal(P.scored,true);assert.equal(P.mode,1);assert.deepEqual(plannedPoints(P),[point(-6,-44),point(19,-45),point(25,-45)]);assert.deepEqual(point(P.tx,P.tz),point(25,-45));assert.equal(probes,0);assert.equal(f.flatGuide.snapshot(),null);assert.equal(JSON.stringify({c,p}),before);
});

test('an actual blocked plan cannot leave the old public target or rendered unsafe line visible',()=>{
 const world={...flatWorld(),colliders:[{x:10,z:-40,r:2}]},p=deepFreeze(rider()),c=deepFreeze(race()),f=actualPlanFixture(world,p),before=JSON.stringify({c,p});assert.equal(f.plan(c).ok,false);assert.equal(f.flatGuide.snapshot().phase,'blocked');
 const hideSource=sourceSection(' function hide(){'," G.on('tick',(dt,t)=>{");
 const blockedSource=sourceSection("   if(c&&!closing&&flatGuide.snapshot()?.phase==='blocked'){",'   const want=');
 const publicTarget=courseGuideSource.split('\n').find(line=>line.trim().startsWith('target:()=>tx===null?'));assert(publicTarget,'production public target accessor must exist');
 const render=Function('flatGuide','"use strict";let fade=1,tx=-90,tz=-35,circ={},toGrade="perfect",toCue="perfect",closing=false;const core={count:20,visible:true},rim={count:20,visible:true},ring={visible:true},bigRing={visible:true},reticle={visible:true},distEl={style:{display:""},textContent:"stale route"};\n'+hideSource+'\nreturn {tick(c){'+blockedSource+'return "continued";},'+publicTarget+' snapshot:()=>({fade,core,rim,ring,bigRing,reticle,toGrade,toCue,circ,distEl})};')(f.flatGuide);
 assert.deepEqual(render.target(),[-90,-35]);assert.equal(render.tick(c),undefined);assert.equal(render.target(),null);const s=render.snapshot();assert.equal(s.fade,0);assert.equal(s.core.count,0);assert.equal(s.rim.count,0);for(const key of ['core','rim','ring','bigRing','reticle'])assert.equal(s[key].visible,false);assert.equal(s.toGrade,'');assert.equal(s.toCue,'');assert.equal(s.circ,null);assert.match(s.distEl.textContent,/clear way to the gate/);assert.equal(s.distEl.style.display,'');assert.equal(JSON.stringify({c,p}),before);
});

test('actual plan clears old flat-race state when the current scope becomes a judged class or ends',()=>{
 const world={...flatWorld(),colliders:[{x:10,z:-40,r:2}]},p=deepFreeze(rider()),c=deepFreeze(race()),f=actualPlanFixture(world,p);assert.equal(f.plan(c).ok,false);assert.equal(f.flatGuide.snapshot().phase,'blocked');
 const judged=deepFreeze({dressage:true,done:false,fi:0,figs:[{at:'A'}]});const P=f.plan(judged);assert.equal(P.ok,true);assert.deepEqual(point(P.tx,P.tz),point(0,-18));assert.equal(f.flatGuide.snapshot(),null,'a blocked flat race must not hide a later dressage guide');
 assert.equal(f.plan(c).ok,false);assert.equal(f.flatGuide.snapshot().phase,'blocked');assert.equal(f.plan(null).ok,false);assert.equal(f.flatGuide.snapshot(),null);
});

test('the actual public gate-guide handle withdraws its target while disabled or finishing',()=>{
 const f=actualPlanFixture(flatWorld(),deepFreeze(rider())),c=deepFreeze(race());f.plan(c);const expected=f.flatGuide.snapshot();assert(expected?.target);
 const at=courseGuideSource.indexOf('gateGuide:()=>enabled'),end=courseGuideSource.indexOf(',TO_PERFECT',at);assert(at>=0&&end>at);const expression=courseGuideSource.slice(at+'gateGuide:'.length,end);
 const publicApi=Function('flatGuide','"use strict";let enabled=true,closing=false;const gateGuide='+expression+';return {gateGuide,enabled(v){enabled=v;},closing(v){closing=v;}};')(f.flatGuide);
 assert.equal(publicApi.gateGuide(),expected);publicApi.enabled(false);assert.equal(publicApi.gateGuide(),null);publicApi.enabled(true);assert.equal(publicApi.gateGuide(),expected);publicApi.closing(true);assert.equal(publicApi.gateGuide(),null);publicApi.closing(false);assert.equal(publicApi.gateGuide(),expected);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import * as T from '../assets/vendor/three/build/three.module.js';
import {createSolidWorld} from '../assets/solid-collisions.js';
import {STORY_FILLY_FOOTPRINT as F,fillyPoseClear,stepStoryFillyNavigation as step} from '../assets/story-filly-navigation.mjs';
const root=new URL('../',import.meta.url),read=path=>readFileSync(new URL(path,root));
const oldSource=execFileSync('git',['show','4fdc662:assets/features/story-quests.js'],{cwd:root,encoding:'utf8'}),currentSource=read('assets/features/story-quests.js').toString();
function controller(source,{x=0,z=-6,heading=0,idx=0,bolt=0,away=false,world={}}={}){
 const rig={profile:{withersM:1.6}},position={x,y:0,z,set(x,y,z){Object.assign(this,{x,y,z});}},scale={x:.8606896551724138,setScalar(v){this.x=v;}};
 const group={position,rotation:{y:heading},scale,visible:true},actor={x,z,heading,phase:0,bolt,away,rig,sized:rig,group,parts:{group,legs:[0,1,2,3].map(()=>({rotation:{x:0}}))}};
 const calls={speeds:[],removed:0,avoid:0,push:0},state={idx,course:null};
 const W={colliders:[],walls:[],groundH:()=>0,avoid(){calls.avoid++;},pushOut(){calls.push++;},...world};
 const H={player:{pos:{x:-2.8,z:5},heading:0},dressWithRig(){}};
 const G={course:{get:()=>state.course},anim:{tickRig(_f,speed){calls.speeds.push(speed);}},scene:{remove(){calls.removed++;}}};
 const start=source.indexOf(' let foal=null;'),end=source.indexOf(' /* The storm:',start);assert.ok(start>0&&end>start);
 const body=source.slice(start+' let foal=null;'.length,end);
 const q=new Function('initial','H','W','G','idx','PRO_N','stepStoryFillyNavigation','fallsAllowsHorse',`let foal=initial;\n${body}\nreturn {tick:tickFoal,current:()=>foal};`)(actor,H,W,G,()=>state.idx,6,step,()=>true);
 return {q,actor,H,W,G,calls,state,tick(dt=.016,t=1){q.tick(dt,t);},snapshot(){const f=q.current();return f?{x:f.x,z:f.z,heading:f.heading,phase:f.phase,bolt:f.bolt,away:f.away,visible:f.group.visible,position:{x:f.group.position.x,y:f.group.position.y,z:f.group.position.z},legs:f.parts.legs.map(l=>l.rotation.x)}:null;}};
}
const circleWorld=(x=0,z=0,r=.85)=>({groundH:()=>0,colliders:[{x,z,r}],walls:[]});
function solidWorld(parts){const solid=createSolidWorld({THREE:T}),owner=new T.Group();owner.userData.solidParts=parts.map(p=>({min:p.min,max:p.max,matrix:new T.Matrix4().toArray()}));solid.register(owner);return {solid,owner,world:{groundH:()=>0,colliders:[],walls:[],resolveSolid:(p,o)=>solid.resolve(p,o)}};}
const box=(min,max)=>({min,max});
function finite(p){assert.ok([p.x,p.z,p.heading,p.speed].every(Number.isFinite));}
function greyRestPoints(){
 const b=read('review/native-trot-reference-kit/white/model.glb'),length=b.readUInt32LE(12),j=JSON.parse(b.subarray(20,20+length)),bin=20+length+8;
 const width={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16},bytes={5121:1,5123:2,5126:4};
 const data=index=>{const a=j.accessors[index],v=j.bufferViews[a.bufferView],n=width[a.type],size=bytes[a.componentType],offset=bin+(v.byteOffset||0)+(a.byteOffset||0),stride=v.byteStride||n*size;return Array.from({length:a.count},(_,i)=>Array.from({length:n},(_,k)=>{const at=offset+i*stride+k*size;return a.componentType===5126?b.readFloatLE(at):a.componentType===5123?b.readUInt16LE(at):b.readUInt8(at);}));};
 const parents=new Map(),cache=new Map();j.nodes.forEach((n,i)=>(n.children||[]).forEach(c=>parents.set(c,i)));
 const world=i=>{if(cache.has(i))return cache.get(i);const n=j.nodes[i],m=n.matrix?new T.Matrix4().fromArray(n.matrix):new T.Matrix4().compose(new T.Vector3(...(n.translation||[0,0,0])),new T.Quaternion(...(n.rotation||[0,0,0,1])),new T.Vector3(...(n.scale||[1,1,1])));if(parents.has(i))m.premultiply(world(parents.get(i)));cache.set(i,m);return m;};
 const skin=j.skins[0],inverse=data(skin.inverseBindMatrices),operators=skin.joints.map((node,i)=>world(node).clone().multiply(new T.Matrix4().fromArray(inverse[i])));
 const variant=JSON.parse(read('assets/models/native-roster/manifest.json')).breeds.grey,record=variant.meshes[0],delta=read('assets/models/native-roster/grey.bin'),attributes=j.meshes[record.meshIndex].primitives[0].attributes;
 const positions=data(attributes.POSITION),joints=data(attributes.JOINTS_0),weights=data(attributes.WEIGHTS_0),scale=variant.actorScale*variant.withersM/1.45*.78;
 const points=positions.map((p,i)=>{const raw=p.map((v,k)=>v+delta.readInt16LE(record.positionDelta.byteOffset+(i*3+k)*2)*record.positionDelta.scale),v=new T.Vector3();for(let k=0;k<4;k++)v.addScaledVector(new T.Vector3(...raw).applyMatrix4(operators[joints[i][k]]),weights[i][k]);return v.add(new T.Vector3(...variant.sourceTranslation)).multiplyScalar(scale).toArray();});
 return {points,variant,scale};
}
test('body probes cover every actual grey skinned bind vertex at unchanged yearling scale',()=>{
 const {points,variant,scale}=greyRestPoints();assert.equal(points.length,16159);assert.equal(variant.withersM,1.6);assert.ok(Math.abs(scale-.7562747919688282)<1e-14);
 const radial=points.map(p=>Math.min(...F.probes.map(q=>Math.hypot(p[0]-q.x,p[2]-q.z))));const maximum=Math.max(...radial);
 assert.ok(maximum>.34&&maximum<.343);assert.equal(F.radius,.46);assert.ok(F.radius-maximum>.117,'retain the measured bind margin');
 const animatedMaximum=.421061,insideSlabMaximum=.420816;
 assert.ok(F.radius-animatedMaximum>.0389,'retain measured animated-hoof margin');assert.ok(F.radius>insideSlabMaximum);
 const stormHoof=[.18984,.07983,-.975837];
 assert.ok(Math.min(...F.probes.map(q=>Math.hypot(stormHoof[0]-q.x,stormHoof[2]-q.z)))<F.radius);
 for(const p of points)assert.ok(p[1]>=-1e-8&&p[1]<F.top);
});
test('pinned real old tick crosses a blocked root fixture without calling collision APIs',()=>{
 const f=controller(oldSource,{world:circleWorld()});let min=Infinity,overlaps=0;
 for(let i=0;i<180;i++){f.tick(1/60,i/60);min=Math.min(min,Math.hypot(f.actor.x,f.actor.z));if(!fillyPoseClear(f.actor,f.W,F))overlaps++;}
 assert.ok(min<.2);assert.ok(overlaps>10);assert.equal(f.calls.avoid,0);assert.equal(f.calls.push,0);
});
test('real new tick preserves old open-field trajectory, gait speeds, phases and course visibility',()=>{
 const a=controller(oldSource),b=controller(currentSource);
 for(let i=0;i<220;i++){
  for(const f of[a,b]){f.H.player.pos.x=-2.8+Math.sin(i*.019)*2;f.H.player.pos.z=5+i*.035;f.H.player.heading=Math.sin(i*.013)*.4;f.tick([1/60,.027,.011][i%3],i/60);}
  assert.deepEqual(b.snapshot(),a.snapshot());
 }
 assert.deepEqual(b.calls.speeds,a.calls.speeds);
 for(const f of[a,b]){f.state.course={};f.tick();}assert.deepEqual(b.snapshot(),a.snapshot());
 for(const f of[a,b]){f.state.course=null;f.tick();}assert.deepEqual(b.snapshot(),a.snapshot());
});
test('all eight sustained circle approaches reach a clear target without freezing or tunneling',()=>{
 const W=circleWorld(),target={x:0,z:4,heading:0};
 for(let k=0;k<8;k++){
  const angle=k*Math.PI/4;let actor={x:Math.sin(angle)*7,z:Math.cos(angle)*7,heading:angle+Math.PI},nav={},moving=0;
  for(let i=0;i<900;i++){const result=step(actor,target,1/60,W,nav);finite(result);assert.equal(result.safe,true);assert.equal(fillyPoseClear(result,W,F),true);moving+=result.speed>0;actor=result;nav=result.nav;}
  assert.ok(Math.hypot(actor.x-target.x,actor.z-target.z)<=1.21,`approach ${k} did not settle: ${JSON.stringify(actor)}`);assert.ok(moving>0);
 }
});
test('precise door opening and vertically separated solids remain usable; actual parts block the whole body',()=>{
 const {world,solid}=solidWorld([box([-1.5,0,-.10],[-.55,2,.10]),box([.55,0,-.10],[1.5,2,.10]),box([-.55,1.95,-.10],[.55,2.2,.10])]);world.colliders.push({x:0,z:0,r:4,precise:true});
 assert.equal(fillyPoseClear({x:0,z:0,heading:0},world),true);
 assert.equal(fillyPoseClear({x:.55,z:-.4,heading:0},world),false);
 const stats=solid.stats();for(let i=0;i<20;i++)step({x:0,z:-2,heading:0},{x:0,z:3,heading:0},.016,world);assert.deepEqual(solid.stats(),stats);
 const high=solidWorld([box([-2,2.0,-.1],[2,2.2,.1])]);assert.equal(fillyPoseClear({x:0,z:0,heading:0},high.world),true);
});
test('walls, zero-length walls, thin solids and long dt cannot tunnel a body',()=>{
 for(const W of[{groundH:()=>0,colliders:[],walls:[{x1:-5,z1:0,x2:5,z2:0}]},{groundH:()=>0,colliders:[],walls:[{x1:0,z1:0,x2:0,z2:0}]},solidWorld([box([-5,0,-.005],[5,2,.005])]).world]){
  const start={x:0,z:-2,heading:0},target={x:0,z:3,heading:0};
  for(const dt of[.016,.1,.25,1,10]){const result=step(start,target,dt,W);finite(result);assert.equal(fillyPoseClear(result,W),true);if(result.stats.budgetExhausted)assert.deepEqual([result.x,result.z],[start.x,start.z]);}
 }
});
test('blocked shoulder target remains fixed through actor turning and resamples when rider actually moves',()=>{
 const W=circleWorld(),target={x:0,z:0,heading:0};let actor={x:-4,z:0,heading:Math.PI/2},nav={},selected;
 for(let i=0;i<100;i++){const result=step(actor,target,.016,W,nav);assert.equal(result.safe,true);if(!selected)selected=result.target;else assert.deepEqual(result.target,selected);actor=result;nav=result.nav;}
 const moved={...target,z:1.3},next=step(actor,moved,.016,W,nav);assert.deepEqual(next.nav.requested,moved);
 const open={groundH:()=>0,colliders:[],walls:[]};actor={x:0,z:0,heading:0};nav={};for(let i=0;i<20;i++){const t={x:0,z:5+i*.05,heading:0},r=step(actor,t,.016,open,nav);assert.deepEqual(r.target,t);actor=r;nav=r.nav;}
});
test('idle overlap, course reentry and 90m catchup repair safely without changing gates',()=>{
 const W=circleWorld(0,5.4,.8);
 const late=controller(currentSource,{x:0,z:5.4,idx:3,world:W});late.tick();assert.equal(fillyPoseClear(late.actor,late.W),true);assert.equal(late.calls.speeds.at(-1),0);
 for(const options of[{x:0,z:-100},{x:0,z:-4,away:true}]){const f=controller(currentSource,{...options,world:W});f.tick();assert.equal(fillyPoseClear(f.actor,f.W),true);assert.ok(Math.hypot(f.actor.x,f.actor.z-5.4)>.8);}
 const parkedOld=controller(oldSource,{x:5,z:4,idx:3}),parkedNew=controller(currentSource,{x:5,z:4,idx:3});parkedOld.tick();parkedNew.tick();assert.deepEqual(parkedNew.snapshot(),parkedOld.snapshot());
});
test('real controller recovers deep initial overlap to the validated rider shoulder',()=>{
 const W=circleWorld(0,0,4),f=controller(currentSource,{x:0,z:0,heading:0,world:W});
 f.H.player.pos={x:7.2,z:-.4};f.tick();
 assert.equal(fillyPoseClear(f.actor,f.W),true);assert.deepEqual([f.actor.x,f.actor.z],[10,0]);
 assert.deepEqual(f.actor.navigation.lastSafe,{x:10,z:0,heading:0});
 assert.deepEqual([f.actor.group.position.x,f.actor.group.position.z],[10,0]);assert.equal(f.calls.speeds.at(-1),0);
});
test('idle revalidates last-safe recovery and changed remote obstacles before committing fallback',()=>{
 const W=circleWorld(0,0,4),f=controller(currentSource,{x:100,z:0,heading:.3,idx:3,world:W});f.tick();
 const previous=structuredClone(f.actor.navigation.lastSafe);assert.deepEqual(previous,{x:100,z:0,heading:.3});
 f.actor.x=0;f.actor.z=0;f.tick();assert.deepEqual([f.actor.x,f.actor.z,f.actor.heading],[100,0,.3]);assert.equal(fillyPoseClear(f.actor,f.W),true);
 W.colliders.push({x:100,z:0,r:4});
 const a={x:0,z:0,heading:0},nav={lastSafe:previous,target:{x:100,z:0,heading:.3}},target={x:10,z:0,heading:0};
 const before=JSON.stringify({a,nav,target,W});const r=step(a,target,.016,W,nav,{mode:'idle'});
 assert.equal(r.safe,true);assert.equal(r.relocated,true);assert.deepEqual([r.x,r.z,r.heading],[10,0,0]);
 assert.equal(r.stats.circleScans,2);assert.equal(r.stats.circles,2,'remote fallback obstacles must enter broadphase');
 assert.equal(fillyPoseClear(r,W),true);assert.deepEqual(r.nav.lastSafe,{x:10,z:0,heading:0});assert.notEqual(r.nav.lastSafe,nav.lastSafe);
 assert.equal(JSON.stringify({a,nav,target,W}),before);
 const denied=step(a,target,.016,W,nav,{maxProbeTests:10});assert.equal(denied.safe,false);assert.equal(denied.stats.budgetExhausted,true);
 assert.deepEqual([denied.x,denied.z],[0,0]);assert.deepEqual(denied.nav.lastSafe,previous,'uncertified candidates never replace lastSafe');
 const blocked={...W,colliders:[...W.colliders,{x:10,z:0,r:4}]};
 const noLanding=step(a,target,.016,blocked,nav,{mode:'idle'});assert.equal(noLanding.safe,false);assert.deepEqual([noLanding.x,noLanding.z],[0,0]);assert.deepEqual(noLanding.nav.lastSafe,previous);
});
test('an uncertifiable enclosed start waits out of sight and retries without moving to an unsafe candidate',()=>{
 const f=controller(currentSource,{x:0,z:0,world:circleWorld(0,0,400)});
 f.tick();assert.equal(f.actor.navigationSafe,false);assert.equal(f.actor.group.visible,false);
 assert.deepEqual([f.actor.x,f.actor.z],[0,0]);assert.equal(f.actor.navigation.lastSafe,undefined);
 assert.equal(f.calls.speeds.at(-1),0);
 f.W.colliders.length=0;f.tick();assert.equal(f.actor.navigationSafe,true);assert.equal(f.actor.group.visible,true);
 assert.equal(fillyPoseClear(f.actor,f.W),true);assert.ok(f.actor.navigation.lastSafe);
});
test('bolt clock, straight open-field phase and removal are exact while blocked bolt remains safe',()=>{
 const a=controller(oldSource,{bolt:4}),b=controller(currentSource,{bolt:4});for(let i=0;i<45;i++){a.tick(.1,i*.1);b.tick(.1,i*.1);assert.deepEqual(b.snapshot(),a.snapshot());}assert.equal(a.calls.removed,1);assert.equal(b.calls.removed,1);
 const f=controller(currentSource,{z:-4,bolt:4,world:circleWorld()});for(let i=0;i<45;i++){f.tick(.1,i*.1);if(f.q.current())assert.equal(fillyPoseClear(f.actor,f.W),true);}assert.equal(f.calls.removed,1);
});
test('single broad scan, finite rejection and exhausted budgets preserve arrays, actor, nav and registries',()=>{
 const colliders=Array.from({length:4300},(_,i)=>({x:200+i%60,z:200+Math.floor(i/60),r:.3})),walls=[{x1:150,z1:200,x2:151,z2:200}],W={groundH:()=>0,colliders,walls},a={x:0,z:0,heading:0},target={x:0,z:4,heading:0},nav={};
 const before=JSON.stringify({colliders,walls,a,nav});const random=Math.random;Math.random=()=>assert.fail('Navigation must not consume RNG');
 try{const result=step(a,target,.016,W,nav);assert.equal(result.stats.circleScans,4300);assert.equal(result.stats.wallScans,1);assert.equal(result.stats.circles,0);assert.equal(JSON.stringify({colliders,walls,a,nav}),before);
  const denied=step(a,target,1,W,nav,{maxSubsteps:0});assert.equal(denied.stats.budgetExhausted,true);assert.deepEqual([denied.x,denied.z],[0,0]);assert.equal(denied.speed,0);
  const exhausted=step(a,target,.1,W,nav,{maxProbeTests:0});assert.equal(exhausted.stats.budgetExhausted,true);assert.deepEqual([exhausted.x,exhausted.z],[0,0]);assert.equal(exhausted.safe,false);
  for(const dt of[NaN,Infinity,-1])assert.throws(()=>step(a,target,dt,W),/finite/);finite(step({...a,heading:1e14},target,.016,W));
 }finally{Math.random=random;}
 const source=read('assets/story-filly-navigation.mjs').toString();assert.doesNotMatch(source,/import|Math\.random|new (?:THREE|Texture|Mesh|Geometry)|\.register\(/);
});

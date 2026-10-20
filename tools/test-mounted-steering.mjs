import test from 'node:test';
import assert from 'node:assert/strict';
import {createMountedSteering} from '../assets/mounted-steering.mjs';

const near=(a,b,tolerance=1e-10)=>assert.ok(Math.abs(a-b)<=tolerance,`${a} vs ${b} (tolerance ${tolerance})`);
function hold(controller,seconds,{hz=120,...sample}={}){
 let angle=0,elapsed=0,result=controller.state();
 while(elapsed<seconds-1e-10){const dt=Math.min(1/hz,seconds-elapsed);result=controller.update({dt,mountKey:'Bramble',...sample});angle+=result.yawDelta;elapsed+=dt;}
 return {angle,result};
}
// Match the game's short-distance travel loop: integrate heading first, then
// translate the existing signed speed. This is an unobstructed model, not a
// claim that terrain/collision or the published integration has been tested.
function travel(p,speed,seconds,yawDelta){
 const steps=Math.max(1,Math.ceil(Math.abs(speed)*seconds/.3));
 for(let i=0;i<steps;i++){p.heading+=yawDelta/steps;p.x+=Math.sin(p.heading)*speed*seconds/steps;p.z+=Math.cos(p.heading)*speed*seconds/steps;}
}
function quarterTurn(speed,agility=1,hz=120){
 const control=createMountedSteering();hold(control,4,{speed,agility,input:1,hz});
 const p={x:0,z:0,heading:0};let elapsed=0,distance=0;
 while(p.heading<Math.PI/2-1e-10&&elapsed<20){
  const dt=Math.min(1/hz,(Math.PI/2-p.heading)/control.state().maxYawRate);
  const step=control.update({dt,input:1,speed,agility,mountKey:'Bramble'});travel(p,speed,dt,step.yawDelta);elapsed+=dt;distance+=Math.abs(speed)*dt;
 }
 assert.ok(elapsed<20,'the ordinary rein command completes a quarter turn');
 return {...p,time:elapsed,distance,radius:distance/(Math.PI/2)};
}
function ride(hz){
 const control=createMountedSteering(),p={x:0,z:0,heading:0};let elapsed=0;
 const phases=[{duration:.8,input:1},{duration:.4,input:0},{duration:1.2,input:-.65},{duration:.6,input:0}];
 for(const phase of phases){let phaseElapsed=0;while(phaseElapsed<phase.duration-1e-10){const dt=Math.min(1/hz,phase.duration-phaseElapsed),sample=control.update({dt,input:phase.input,speed:7.5,agility:1.1,mountKey:'Bramble'});travel(p,7.5,dt,sample.yawDelta);phaseElapsed+=dt;elapsed+=dt;}}
 return {...p,elapsed,turn:control.state().turn};
}

test('a keyboard press eases into the rein instead of applying full lock',()=>{
 const control=createMountedSteering(),first=control.update({dt:1/60,input:1,speed:7.5,mountKey:'Bramble'});
 assert.ok(first.turn>0&&first.turn<.12);assert.ok(first.yawRate>0&&first.yawRate<.06);
 const held=hold(control,.6,{input:1,speed:7.5});assert.ok(held.result.turn>.98&&held.result.turn<1);
 assert.ok(first.yawRate<held.result.yawRate*.08,'first frame has only a small fraction of sustained yaw');
});

test('released reins settle promptly and monotonically without a snap or extra full-lock frame',()=>{
 const control=createMountedSteering();hold(control,1,{input:1,speed:4.2});
 let previous=control.state().turn;
 for(let i=0;i<30;i++){const step=control.update({dt:1/60,input:0,speed:4.2,mountKey:'Bramble'});assert.ok(step.turn>=0&&step.turn<previous);assert.ok(step.yawRate>=0);previous=step.turn;}
 assert.ok(previous<.007,'less than one percent of the rein remains after half a second');
});

test('counter-reining passes smoothly through neutral without overshoot',()=>{
 const control=createMountedSteering();hold(control,1,{input:1,speed:7.5});
 let previous=1,changes=0,sign=1;
 for(let i=0;i<90;i++){const step=control.update({dt:1/120,input:-1,speed:7.5,mountKey:'Bramble'});assert.ok(step.turn<=previous&&step.turn>=-1);const next=Math.sign(step.turn);if(next!==sign){changes++;sign=next;}previous=step.turn;}
 assert.equal(changes,1);assert.ok(previous<-.98);
});

test('analog input retains proportional authority after the same onset',()=>{
 const full=createMountedSteering(),half=createMountedSteering();
 const a=hold(full,1,{input:1,speed:4.2}),b=hold(half,1,{input:.5,speed:4.2});
 near(b.angle,a.angle*.5);near(b.result.turn,a.result.turn*.5);
 const bounded=full.update({dt:.1,input:20,speed:4.2});assert.equal(bounded.input,1);assert.ok(bounded.turn<=1);
});

test('actual 90 degree travel arcs widen from walk to gallop without reducing speed',()=>{
 const cases=[[2,1.9,2.2],[4.2,4,4.5],[7.5,7.8,8.6],[15,18.5,21]];
 let lastRadius=0;
 for(const [speed,minimum,maximum] of cases){
  const arc=quarterTurn(speed);near(arc.heading,Math.PI/2,1e-8);near(arc.distance,speed*arc.time,1e-8);
  assert.ok(arc.radius>=minimum&&arc.radius<=maximum,`${speed}m/s quarter-turn radius ${arc.radius}m`);assert.ok(arc.radius>lastRadius);lastRadius=arc.radius;
  near(arc.x,arc.radius,.08);near(arc.z,arc.radius,.08);
  // Previous keyboard yaw was (1.7+min(1.5,abs(speed)*.1))*agility.
  const formerRadius=speed/(1.7+Math.min(1.5,speed*.1));assert.ok(arc.radius>formerRadius*1.8,'sustained arcs are visibly broader than the former fast pivot');
 }
});

test('standstill collection remains useful but cannot spin at the former rate',()=>{
 const control=createMountedSteering(),first=hold(control,.5,{input:1,speed:0});
 assert.ok(first.angle>.15&&first.angle<.23,'half-second fine turn remains manageable');
 near(control.state().maxYawRate,.58);assert.equal(control.state().turnRadius,null);
 const full=hold(createMountedSteering(),3,{input:1,speed:0});assert.ok(full.angle>Math.PI/2&&full.angle<Math.PI*.6,'about three seconds turns a standing horse by a quarter turn');
});

test('agility improves the same horse-speed arc without reintroducing instant pivots',()=>{
 const ordinary=quarterTurn(15,.95),nimble=quarterTurn(15,1.3);
 assert.ok(nimble.radius<ordinary.radius*.9);assert.ok(nimble.radius>ordinary.radius*.8);
 near(ordinary.distance/ordinary.time,15);near(nimble.distance/nimble.time,15);
 const extreme=hold(createMountedSteering(),1,{speed:0,input:1,agility:1e9});assert.ok(extreme.result.maxYawRate<.85);
});

test('rein-back reverses yaw and preserves a bounded gradual change near zero',()=>{
 const forward=hold(createMountedSteering(),1,{speed:1.3,input:1}),reverse=hold(createMountedSteering(),1,{speed:-1.3,input:1});
 near(reverse.angle,-forward.angle);assert.equal(reverse.result.reverse,true);assert.equal(reverse.result.direction,-1);
 const samples=[0,-.001,-.01,-.1,-.175,-.25,-.35,-1.3].map(speed=>hold(createMountedSteering(),1,{speed,input:1}).result);
 near(samples[0].direction,1);assert.ok(samples[1].direction>.999);near(samples[4].direction,0);near(samples.at(-1).direction,-1);
 for(let i=1;i<samples.length;i++)assert.ok(samples[i].direction<=samples[i-1].direction);
 const right=hold(createMountedSteering(),1,{speed:-1.3,input:-1});near(right.angle,forward.angle);
});

test('30, 60 and 120 Hz preserve heading, rein state and a close ordinary travel path',()=>{
 const runs=[30,60,120].map(ride),baseline=runs.at(-1);
 for(const result of runs){near(result.elapsed,3,1e-10);near(result.heading,baseline.heading,1e-10);near(result.turn,baseline.turn,1e-10);assert.ok(Math.hypot(result.x-baseline.x,result.z-baseline.z)<.16,'translation difference stays below the collision substep size');}
});

test('an exact interval average also preserves a variable frame schedule',()=>{
 const fixed=hold(createMountedSteering(),1,{input:1,speed:7.5}),varied=createMountedSteering();let angle=0;
 for(const dt of [.003,.017,.11,.02,.25,.1,.2,.15,.15])angle+=varied.update({dt,input:1,speed:7.5,mountKey:'Bramble'}).yawDelta;
 near(angle,fixed.angle);near(varied.state().turn,fixed.result.turn);
});

test('a lock clears residual rein immediately and unlock begins with fresh onset',()=>{
 const control=createMountedSteering();hold(control,.8,{input:1,speed:15});
 const blocked=control.update({dt:.1,input:1,speed:15,locked:true,mountKey:'Bramble'});assert.equal(blocked.turn,0);assert.equal(blocked.yawDelta,0);assert.equal(blocked.active,false);assert.equal(blocked.reason,'locked');
 const resumed=control.update({dt:1/60,input:1,speed:15,mountKey:'Bramble'});assert.ok(resumed.turn<.12&&resumed.yawRate<.05);
});

test('leaving the mounted-ground branch clears stale rein before foot, flight or VR returns',()=>{
 const control=createMountedSteering();hold(control,.8,{input:-1,speed:7.5});
 for(const excluded of ['foot','flight','VR','jump','vehicle']){
  const stopped=control.update({dt:.1,input:-1,speed:7.5,active:false,mountKey:excluded});assert.equal(stopped.yawDelta,0);assert.equal(stopped.turn,0);
 }
 const ground=control.update({dt:1/60,input:0,speed:7.5,mountKey:'Bramble'});assert.equal(ground.turn,0);assert.equal(ground.yawDelta,0);
});

test('changing mounts cannot transfer the previous horse full-lock rein',()=>{
 const control=createMountedSteering();hold(control,1,{input:1,speed:7.5});
 const neutral=control.update({dt:1/60,input:0,speed:7.5,mountKey:'Clover'});assert.equal(neutral.turn,0);assert.equal(neutral.mountKey,'Clover');
 hold(control,1,{input:-1,speed:7.5,mountKey:'Clover'});
 const held=control.update({dt:1/60,input:1,speed:7.5,mountKey:'Luna'});assert.ok(held.turn>0&&held.turn<.12);assert.ok(held.yawRate>0);
});

test('release/reset cancels steering independently of the next keyboard sample',()=>{
 const control=createMountedSteering();hold(control,1,{input:1,speed:15});
 assert.equal(control.reset().yawDelta,0);assert.equal(control.state().mountKey,null);
 const explicit=control.update({dt:.1,input:1,speed:15,reset:true});assert.equal(explicit.turn,0);assert.equal(explicit.yawDelta,0);
 const neutral=control.update({dt:.1,input:0,speed:15});assert.equal(neutral.yawDelta,0);
});

test('paused and negative intervals cannot advance steering; long stalls are bounded',()=>{
 const control=createMountedSteering();hold(control,.2,{input:1,speed:4.2});const before=control.state().turn;
 for(const dt of [0,-.1]){const step=control.update({dt,input:-1,speed:4.2,mountKey:'Bramble'});near(step.turn,before);assert.equal(step.yawDelta,0);assert.equal(step.dt,0);}
 const stalled=control.update({dt:30,input:1,speed:4.2,mountKey:'Bramble'});assert.equal(stalled.dt,.25);assert.ok(Math.abs(stalled.yawDelta)<=stalled.maxYawRate*.25);
});

test('malformed numeric samples fail closed and diagnostics never contain NaN or Infinity',()=>{
 for(const bad of [{dt:NaN},{input:Infinity},{speed:NaN},{agility:NaN}]){
  const control=createMountedSteering();hold(control,1,{input:1,speed:15});const step=control.update({dt:.1,input:1,speed:15,...bad});assert.equal(step.reason,'invalid');assert.equal(step.turn,0);assert.equal(step.yawDelta,0);
  for(const v of Object.values(step))if(typeof v==='number')assert.ok(Number.isFinite(v));
 }
 for(const speed of [-100,0,.00001,20.25,100])for(const agility of [-10,.45,1,2.1,100]){
  const sample=hold(createMountedSteering(),1,{speed,agility,input:1}).result;assert.ok(sample.maxYawRate>0&&sample.maxYawRate<=1.67);assert.ok(Math.abs(sample.yawRate)<=sample.maxYawRate+1e-12);assert.ok(Math.abs(sample.turn)<=1);
 }
});

test('samples and returned diagnostics are immutable and hold no world/save references',()=>{
 const control=createMountedSteering(),sample=Object.freeze({dt:.1,input:1,speed:15,agility:1,mountKey:42});
 const before=JSON.stringify(sample),step=control.update(sample);assert.equal(JSON.stringify(sample),before);assert.ok(Object.isFrozen(step));assert.throws(()=>{step.yawRate=99;},TypeError);assert.equal(control.state(),step);assert.ok(Object.isFrozen(control));
 assert.deepEqual(Object.keys(control).sort(),['reset','state','update']);
});

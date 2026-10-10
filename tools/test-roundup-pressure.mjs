import test from 'node:test';
import assert from 'node:assert/strict';
import {roundupPressure} from '../assets/roundup-pressure.mjs';

const behind = (distance, overrides = {}) => roundupPressure({horse:{x:0,z:0}, rider:{x:-distance,z:0}, pen:{x:50,z:0}, ...overrides});
const close = (a, b, epsilon = 1e-10) => assert(Math.abs(a-b) <= epsilon, `${a} differs from ${b}`);

test('a walking rider can keep a calm horse moving home from the safe pressure marker', () => {
  const horse = {x:0,z:0}, rider = {x:-9,z:0}, pen = {x:50,z:0};
  const walkSpeed = 2.1415, dt = 1 / 60;
  let guidingFrames = 0, furthest = 0;
  for (let step = 0; step < 1200; step++) {
    const pressure = roundupPressure({horse,rider,pen});
    assert.equal(pressure.status, 'guiding');
    assert(pressure.speed >= 1.2 && pressure.speed <= 2.1);
    assert(pressure.speed < walkSpeed, 'normal walking can follow the calm herd');
    // Use the existing away-from-rider steering direction. Walk towards the
    // moving nine-metre pressure marker without teleporting or overshooting it.
    const dx = horse.x-rider.x, dz = horse.z-rider.z, distance = Math.hypot(dx,dz);
    horse.x += dx / distance * pressure.speed * dt;
    horse.z += dz / distance * pressure.speed * dt;
    const marker = {x:horse.x-9,z:horse.z};
    const mx = marker.x-rider.x, mz = marker.z-rider.z, toMarker = Math.hypot(mx,mz);
    const stride = Math.min(walkSpeed*dt,toMarker);
    if (toMarker) { rider.x += mx/toMarker*stride; rider.z += mz/toMarker*stride; }
    guidingFrames++;furthest = Math.max(furthest,horse.x);
  }
  assert.equal(guidingFrames,1200);
  assert(furthest > 30, 'sustained walking pressure advances more than30m in20s');
  assert(Math.hypot(horse.x-rider.x,horse.z-rider.z) >= 6);
  assert(Math.hypot(pen.x-horse.x,pen.z-horse.z) < 20, 'distance to home meaningfully decreases');
});

test('closing too quickly produces the too-close warning before a faster escape', () => {
  assert.equal(behind(6.01).status,'guiding');
  const warning = behind(5.99), fleeing = behind(1.5);
  assert.equal(warning.active,true);assert.equal(warning.alignment,1);
  assert.equal(warning.status,'too close', 'good angle cannot hide the orange warning');
  assert(warning.speed < 2.101, 'warning starts before a large speed increase');
  assert.equal(fleeing.status,'too close');assert(fleeing.speed > 3.3);
  assert(fleeing.speed > warning.speed);
});

test('the beginner response is smooth at6m and bounded throughout both bands', () => {
  close(behind(0).speed,3.6);close(behind(3).speed,2.85);
  close(behind(6).speed,2.1);close(behind(9).speed,1.65);
  const near = [behind(6-1e-5),behind(6),behind(6+1e-5)];
  assert.equal(near[0].status,'too close');assert.equal(near[1].status,'guiding');
  close(near[0].speed,near[1].speed,1e-10);close(near[2].speed,near[1].speed,1e-10);
  let previous = Infinity;
  for (let d = 0; d < 12; d += .05) {
    const p = behind(d);assert.equal(p.active,true);
    assert(p.speed <= previous+1e-12);assert(p.speed >= 1.2 && p.speed <= 3.6);
    if (d >= 6) assert(p.speed <= 2.1);
    previous=p.speed;
  }
});

test('a rider on the wrong side moves the horse away but never receives a guiding cue', () => {
  const p = behind(9,{rider:{x:9,z:0}});
  assert.equal(p.active,true);assert.equal(p.alignment,-1);
  assert.equal(p.status,'circle behind');close(p.speed,1.65);
  const flank=behind(9,{rider:{x:0,z:-9}});
  assert.equal(flank.alignment,0);assert.equal(flank.status,'circle behind');
  const closeWrong = behind(3,{rider:{x:3,z:0}});
  assert.equal(closeWrong.status,'too close');
});

test('guiding requires strictly greater than one-half directional alignment', () => {
  const horse={x:0,z:0},rider={x:-9,z:0};
  assert.equal(roundupPressure({horse,rider,pen:{x:1,z:Math.sqrt(3)}}).status,'circle behind');
  assert.equal(roundupPressure({horse,rider,pen:{x:1.01,z:Math.sqrt(3)}}).status,'guiding');
  assert.equal(roundupPressure({horse,rider,pen:horse}).status,'circle behind');
});

test('the pressure radius is exclusive and a disabled target cannot guide or spook', () => {
  assert.equal(behind(11.999).active,true);assert.equal(behind(12).active,false);
  assert.equal(behind(12).status,'out of range');assert.equal(behind(12).speed,0);
  for (const d of [0,3,9,30]) {
    const p=behind(d,{enabled:false});assert.equal(p.active,false);
    assert.equal(p.status,'inactive');assert.equal(p.speed,0);assert.equal(p.distance,d);
  }
});

test('full mode retains exact fourteen-metre pressure and6/4.8 movement speeds', () => {
  const full={mode:'full'};
  close(behind(0,full).speed,6);close(behind(5.999,full).speed,6);
  close(behind(6,full).speed,4.8);close(behind(13.999,full).speed,4.8);
  assert.equal(behind(5.999,full).status,'too close');assert.equal(behind(6,full).status,'guiding');
  assert.equal(behind(14,full).active,false);assert.equal(behind(14,full).speed,0);
  assert.equal(behind(9,full).radius,14);
});

test('invalid input cannot activate pressure or leak NaN into movement/HUD', () => {
  const valid={horse:{x:0,z:0},rider:{x:-9,z:0},pen:{x:50,z:0}};
  const inputs=[null,[],false,{}, {...valid,horse:{x:NaN,z:0}}, {...valid,rider:{x:Infinity,z:0}},
    {...valid,pen:{x:'50',z:0}}, {...valid,mode:'shared'}, {...valid,mode:'FULL'},
    {...valid,enabled:1}, {...valid,horse:{x:1e308,z:0},rider:{x:-1e308,z:0}}];
  for(const input of inputs) assert.deepEqual(roundupPressure(input),{
    active:false,status:'invalid',distance:null,alignment:null,speed:0,radius:null});
});

test('large finite points retain a finite normalized alignment and inputs stay untouched', () => {
  const options={horse:{x:0,z:0},rider:{x:-1e200,z:0},pen:{x:1e200,z:0}};
  const before=structuredClone(options),p=roundupPressure(options);
  assert.equal(p.alignment,1);assert.equal(p.distance,1e200);assert.equal(p.active,false);
  assert.deepEqual(options,before);assert.equal(p.speed,0);
});

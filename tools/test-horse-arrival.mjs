import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../assets/horse-arrival.js',import.meta.url),'utf8');
const {createHorseArrival}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const flush=async()=>{await Promise.resolve();await Promise.resolve();};
function fixture(){
 const callbacks=[],gate=createHorseArrival(fn=>callbacks.push(fn));
 let outcome;
 gate.ready.then(value=>{outcome=value;});
 return {gate,callbacks,get outcome(){return outcome;}};
}

test('optional consumers stay pending before and during the first horse request',async()=>{
 const f=fixture();let sceneryCalls=0;
 f.gate.ready.then(()=>sceneryCalls++);
 await flush();assert.equal(f.gate.settled,false);assert.equal(sceneryCalls,0);
 f.gate.begin(1);await flush();
 assert.equal(f.gate.settled,false);assert.equal(sceneryCalls,0);assert.equal(f.outcome,undefined);
 assert.equal(f.callbacks.length,0,'pending fetch has no timer or frame release scheduled');
});

test('default scheduling gives the current screen two animation-frame opportunities',async()=>{
 const previous=globalThis.requestAnimationFrame,frames=[];
 globalThis.requestAnimationFrame=fn=>frames.push(fn);
 try{
  const gate=createHorseArrival();gate.begin(1);
  assert.equal(gate.mounted(1,()=>true),true);
  assert.equal(gate.settled,false);assert.equal(frames.length,1);
  frames.shift()();await flush();assert.equal(gate.settled,false);assert.equal(frames.length,1);
  frames.shift()();assert.deepEqual(await gate.ready,{status:'ready'});
 }finally{
  if(previous===undefined)delete globalThis.requestAnimationFrame;
  else globalThis.requestAnimationFrame=previous;
 }
});

test('a rig that is not the current attached selection cannot schedule arrival',async()=>{
 const f=fixture();f.gate.begin(2);
 assert.equal(f.gate.mounted(2,()=>false),false);
 assert.equal(f.gate.mounted(1,()=>true),false);
 await flush();assert.equal(f.callbacks.length,0);assert.equal(f.outcome,undefined);
});

test('a newer breed request invalidates a previously scheduled ready callback',async()=>{
 const f=fixture();f.gate.begin(1);f.gate.mounted(1,()=>true);
 f.gate.begin(2);f.callbacks.shift()();await flush();
 assert.equal(f.gate.settled,false);assert.equal(f.outcome,undefined);
 assert.equal(f.gate.failed(1),false,'late failure from the previous breed is also ignored');
 f.gate.mounted(2,()=>true);f.callbacks.shift()();
 assert.deepEqual(await f.gate.ready,{status:'ready'});
});

test('attachment or selection changes during the frame delay require a new valid signal',async()=>{
 const f=fixture();let current=true;f.gate.begin(1);f.gate.mounted(1,()=>current);
 current=false;f.callbacks.shift()();await flush();assert.equal(f.gate.settled,false);
 current=true;assert.equal(f.gate.mounted(1,()=>current),true);f.callbacks.shift()();
 assert.deepEqual(await f.gate.ready,{status:'ready'});
});

test('an explicit current failure resolves every scenery waiter instead of rejecting',async()=>{
 const f=fixture();f.gate.begin(1);
 const scans=f.gate.ready.then(outcome=>({edge:[],status:outcome.status}));
 const details=f.gate.ready.then(async()=>({woodland:await scans}));
 const plants=f.gate.ready.then(async()=>({yard:await details}));
 assert.equal(f.gate.failed(1),true);
 assert.deepEqual(await f.gate.ready,{status:'failed'});
 assert.deepEqual(await plants,{yard:{woodland:{edge:[],status:'failed'}}});
 assert.equal(f.gate.settled,true);
});

test('a post-fetch installation failure wins over an already scheduled success',async()=>{
 const f=fixture();f.gate.begin(3);f.gate.mounted(3,()=>true);
 assert.equal(f.gate.failed(3),true);f.callbacks.shift()();
 assert.deepEqual(await f.gate.ready,{status:'failed'});
 assert.equal(f.gate.failed(3),false,'failure settlement is idempotent');
});

test('startup settlement is sticky and later breed changes do not rerun scenery',async()=>{
 const f=fixture();let loads=0;f.gate.ready.then(()=>loads++);
 f.gate.begin(1);f.gate.mounted(1,()=>true);f.callbacks.shift()();await flush();
 f.gate.begin(2);assert.equal(f.gate.mounted(2,()=>true),false);assert.equal(f.gate.failed(2),false);
 await flush();assert.equal(loads,1);assert.deepEqual(f.outcome,{status:'ready'});
});

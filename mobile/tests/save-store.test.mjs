import test from 'node:test';
import assert from 'node:assert/strict';
import {createSaveStore,decodeSnapshot,encodeSnapshot} from '../src/save-store.mjs';
const KEY='starRanchFable_v1';
function backend(initial={}){return {files:{...initial},async read(name){return this.files[name]??null;},async write(name,value){this.files[name]=value;}};}
test('hydrates the newest verified save before reads and preserves all registered keys',async()=>{
 const disk=backend({a:encodeSnapshot(4,{[KEY]:'old'}),b:encodeSnapshot(5,{[KEY]:'current',mk_sjy:'journey'})});
 const store=await createSaveStore({backend:disk});assert.equal(store.getItem(KEY),'current');assert.equal(store.getItem('mk_sjy'),'journey');store.dispose();
});
test('a torn latest write recovers the intact older slot without overwriting it',async()=>{
 const good=encodeSnapshot(3,{[KEY]:'safe'}),disk=backend({a:good,b:'{"body":'});
 const store=await createSaveStore({backend:disk});assert.equal(store.getItem(KEY),'safe');assert.equal(disk.files.a,good);store.dispose();
});
test('unreadable existing saves fail closed and are never replaced by a new ranch',async()=>{
 const disk=backend({a:'broken',b:'also broken'});await assert.rejects(createSaveStore({backend:disk}),/preserved/);assert.deepEqual(disk.files,{a:'broken',b:'also broken'});
 const denied={async read(){throw Error('permission error');}};await assert.rejects(createSaveStore({backend:denied}),/permission error/);
});
test('updates during a slow flush finish in order and survive a new process',async()=>{
 const disk=backend();let release;const original=disk.write.bind(disk);let first=true;
 disk.write=async(name,value)=>{if(first){first=false;await new Promise(r=>{release=r;});}await original(name,value);};
 const store=await createSaveStore({backend:disk});store.setItem(KEY,'one');const flush=store.flush();store.setItem(KEY,'two');release();await flush;store.dispose();
 const reopened=await createSaveStore({backend:disk});assert.equal(reopened.getItem(KEY),'two');reopened.dispose();
});
test('save failure remains retryable and does not report false success',async()=>{
 const disk=backend();let fail=true;const original=disk.write.bind(disk),states=[];
 disk.write=async(name,value)=>{if(fail)throw Error('disk full');await original(name,value);};
 const store=await createSaveStore({backend:disk,onStatus:s=>states.push(s.state)});store.setItem(KEY,'progress');await assert.rejects(store.flush(),/disk full/);assert.equal(states.at(-1),'error');
 fail=false;await store.flush();assert.equal(states.at(-1),'saved');assert.equal(decodeSnapshot(disk.files.a).values[KEY],'progress');store.dispose();
});
test('confirmed reset clears recovery copies and retries a failed second slot',async()=>{
 const disk=backend({a:encodeSnapshot(1,{[KEY]:'personal',starRanchFable_photos_v1:'photo'})});let fail=true;const original=disk.write.bind(disk);
 disk.write=async(name,value)=>{if(name==='a'&&fail)throw Error('reset interrupted');await original(name,value);};
 const store=await createSaveStore({backend:disk});store.clear();await assert.rejects(store.flush(),/reset interrupted/);fail=false;await store.flush();store.dispose();
 for(const value of Object.values(disk.files))assert.deepEqual(decodeSnapshot(value).values,{});
 const reopened=await createSaveStore({backend:disk});assert.equal(reopened.getItem(KEY),null);assert.equal(reopened.getItem('starRanchFable_photos_v1'),null);reopened.dispose();
});
test('save migration is durable and unknown keys cannot leak into game snapshots',async()=>{
 const disk=backend(),store=await createSaveStore({backend:disk,seed:{[KEY]:'migrated',foreign:'not mine'}});
 assert.equal(store.getItem(KEY),'migrated');assert.equal(store.getItem('foreign'),null);assert.throws(()=>store.setItem('foreign','value'),/Unregistered/);store.dispose();
});
test('reset during an in-flight older save erases both recovery copies before resolving',async()=>{
 const disk=backend();let release;const original=disk.write.bind(disk);let first=true;
 disk.write=async(name,value)=>{if(first){first=false;await new Promise(r=>{release=r;});}await original(name,value);};
 const store=await createSaveStore({backend:disk});store.setItem(KEY,'personal');const flush=store.flush();store.clear();release();await flush;store.dispose();
 for(const value of Object.values(disk.files))assert.deepEqual(decodeSnapshot(value).values,{});
});

function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}
const nextTurn=()=>new Promise(resolve=>setImmediate(resolve));
async function managedStore(t,options){const store=await createSaveStore({delay:60_000,...options});t.after(()=>store.dispose());return store;}

test('durability barrier waits for the write and verified readback, not the synchronous mirror',async t=>{
 const disk=backend(),writeGate=deferred(),readGate=deferred(),readStarted=deferred();
 const write=disk.write.bind(disk),read=disk.read.bind(disk);let checking=false;
 disk.write=async(name,value)=>{await writeGate.promise;await write(name,value);checking=true;};
 disk.read=async name=>{if(checking){readStarted.resolve();await readGate.promise;}return read(name);};
 const store=await managedStore(t,{backend:disk});assert.equal(store.setItem(KEY,'receipt'),undefined);
 const target=store.checkpoint();let settled=false;
 const pending=store.whenDurable(target).then(result=>{settled=true;return result;});
 assert.equal(store.getItem(KEY),'receipt');assert.equal(store.getDurableItem(KEY),null);assert.equal(settled,false);
 assert.equal(store.status().inFlight,true);writeGate.resolve();await readStarted.promise;await nextTurn();
 assert.equal(settled,false);assert.equal(store.getDurableItem(KEY),null);
 readGate.resolve();const ack=await pending;
 assert.deepEqual(ack,{targetVersion:1,durableVersion:1,revision:1,values:{[KEY]:'receipt'}});
 assert.ok(Object.isFrozen(ack)&&Object.isFrozen(ack.values));assert.equal(store.getDurableItem(KEY),'receipt');
 assert.throws(()=>{ack.values[KEY]='different';},TypeError);await store.flush();
});

test('a rejected device write leaves mirror progress pending and retry acknowledges only persisted data',async t=>{
 const disk=backend();let fail=true;const write=disk.write.bind(disk);
 disk.write=async(name,value)=>{if(fail)throw Error('disk full');await write(name,value);};
 const store=await managedStore(t,{backend:disk});store.setItem(KEY,JSON.stringify({receipt:'run-1'}));
 const target=store.checkpoint();await assert.rejects(store.whenDurable(target),error=>{
  assert.equal(error.name,'SaveDurabilityError');assert.equal(error.code,'NATIVE_SAVE_NOT_DURABLE');
  assert.equal(error.targetVersion,1);assert.equal(error.durableVersion,0);assert.equal(error.retryable,true);return /disk full/.test(error.message);
 });
 assert.equal(store.getItem(KEY),'{"receipt":"run-1"}');assert.equal(store.getDurableItem(KEY),null);assert.deepEqual(disk.files,{});
 assert.equal(store.status().state,'error');assert.equal(store.status().pending,true);assert.equal(store.status().inFlight,false);
 fail=false;const ack=await store.retry();assert.equal(ack.values[KEY],store.getItem(KEY));assert.equal(ack.targetVersion,target);
 const reopened=await managedStore(t,{backend:disk});assert.equal(reopened.getItem(KEY),ack.values[KEY]);assert.equal(reopened.getDurableItem(KEY),ack.values[KEY]);
});

test('torn readback rejects the barrier while the older verified slot remains recoverable',async t=>{
 const prior=encodeSnapshot(7,{[KEY]:'prior'}),disk=backend({a:prior});let torn=true;const write=disk.write.bind(disk);
 disk.write=async(name,value)=>{if(torn){disk.files[name]='torn snapshot';return;}await write(name,value);};
 const store=await managedStore(t,{backend:disk});store.setItem(KEY,'new receipt');await assert.rejects(store.whenDurable(),/verification failed/);
 assert.equal(store.getDurableItem(KEY),'prior');assert.equal((await store.whenDurable(0)).revision,7);
 const recovered=await managedStore(t,{backend:disk});assert.equal(recovered.getItem(KEY),'prior');assert.equal(disk.files.a,prior);
 torn=false;const ack=await store.retry();assert.equal(ack.values[KEY],'new receipt');assert.equal(ack.revision,8);
});

test('a read failure after a device write still rejects confirmation and permits a verified retry',async t=>{
 const disk=backend(),store=await managedStore(t,{backend:disk});const read=disk.read.bind(disk);let fail=true;
 disk.read=async name=>{if(fail&&disk.files[name])throw Error('readback unavailable');return read(name);};
 store.setItem(KEY,'written but unconfirmed');await assert.rejects(store.whenDurable(),/readback unavailable/);
 assert.equal(store.getDurableItem(KEY),null);assert.equal(store.status().durableVersion,0);
 assert.equal(decodeSnapshot(disk.files.a).values[KEY],'written but unconfirmed');
 fail=false;const ack=await store.retry();assert.equal(ack.values[KEY],'written but unconfirmed');assert.equal(ack.durableVersion,1);
});

test('an earlier verified checkpoint resolves even when a later write in the same flush fails',async t=>{
 const disk=backend(),firstGate=deferred();let writes=0;const write=disk.write.bind(disk);
 disk.write=async(name,value)=>{writes++;if(writes===1)await firstGate.promise;else throw Error('later write rejected');await write(name,value);};
 const store=await managedStore(t,{backend:disk});store.setItem(KEY,'first');const first=store.whenDurable();
 store.setItem(KEY,'second');const second=assert.rejects(store.whenDurable(),error=>error.targetVersion===2&&/later write/.test(error.message));
 firstGate.resolve();const ack=await first;await second;
 assert.equal(ack.targetVersion,1);assert.equal(ack.durableVersion,1);assert.equal(ack.values[KEY],'first');
 assert.equal(store.getItem(KEY),'second');assert.equal(store.getDurableItem(KEY),'first');
 assert.equal((await store.whenDurable(1)).values[KEY],'first');assert.equal(store.status().pending,true);
 const reopened=await managedStore(t,{backend:disk});assert.equal(reopened.getItem(KEY),'first');
});

test('later writes are serialized and each in-flight checkpoint receives its verified snapshot',async t=>{
 const disk=backend(),firstGate=deferred(),secondGate=deferred(),secondStarted=deferred();
 let writes=0,active=0,maxActive=0;const write=disk.write.bind(disk);
 disk.write=async(name,value)=>{
  active++;maxActive=Math.max(maxActive,active);writes++;
  if(writes===1)await firstGate.promise;else {secondStarted.resolve();await secondGate.promise;}
  await write(name,value);active--;
 };
 const store=await managedStore(t,{backend:disk});store.setItem(KEY,'first');const first=store.whenDurable();
 const running=store.flush();assert.equal(store.flush(),running);
 store.setItem(KEY,'second');let secondDone=false;const second=store.whenDurable().then(ack=>{secondDone=true;return ack;});
 firstGate.resolve();const firstAck=await first;await secondStarted.promise;
 assert.equal(firstAck.values[KEY],'first');assert.equal(secondDone,false);assert.equal(store.getDurableItem(KEY),'first');
 secondGate.resolve();const secondAck=await second;await running;
 assert.equal(secondAck.values[KEY],'second');assert.equal(firstAck.values[KEY],'first');assert.equal(writes,2);assert.equal(maxActive,1);
 assert.equal(secondAck.revision,2);const reopened=await managedStore(t,{backend:disk});assert.equal(reopened.getItem(KEY),'second');
});

test('coalesced checkpoints acknowledge the actual later snapshot, never invent the earlier receipt',async t=>{
 const disk=backend(),store=await managedStore(t,{backend:disk});store.setItem(KEY,'old receipt');const old=store.checkpoint();
 store.setItem(KEY,'superseding receipt');const ack=await store.whenDurable(old);
 assert.equal(ack.targetVersion,1);assert.equal(ack.durableVersion,2);assert.equal(ack.values[KEY],'superseding receipt');
 assert.equal(decodeSnapshot(disk.files.a).revision,1);assert.equal(Object.keys(disk.files).length,1);
});

test('all waiting checkpoints reject a failed attempt and a later retry does not deadlock',async t=>{
 const disk=backend(),gate=deferred();let fail=true;const write=disk.write.bind(disk);
 disk.write=async(name,value)=>{await gate.promise;if(fail)throw Error('device offline');await write(name,value);};
 const store=await managedStore(t,{backend:disk});store.setItem(KEY,'one');const first=assert.rejects(store.whenDurable(),e=>e.targetVersion===1);
 store.setItem(KEY,'two');const second=assert.rejects(store.whenDurable(),e=>e.targetVersion===2);
 gate.resolve();await Promise.all([first,second]);assert.equal(store.status().inFlight,false);
 fail=false;const ack=await store.retry();assert.equal(ack.targetVersion,2);assert.equal(ack.values[KEY],'two');
});

test('invalid and future checkpoints fail without creating a backend write',async t=>{
 const disk=backend();let writes=0;const write=disk.write.bind(disk);disk.write=async(...args)=>{writes++;return write(...args);};
 const store=await managedStore(t,{backend:disk});
 for(const invalid of [-1,1,.5,NaN,Infinity,'0',null])await assert.rejects(store.whenDurable(invalid),e=>e.code==='INVALID_SAVE_CHECKPOINT'&&e.retryable===false);
 assert.equal(writes,0);assert.deepEqual(await store.whenDurable(),{targetVersion:0,durableVersion:0,revision:0,values:{}});
});

test('a reset barrier cannot resolve until the second recovery slot is verified',async t=>{
 const disk=backend({a:encodeSnapshot(3,{[KEY]:'personal'})}),gate=deferred(),secondStarted=deferred();const write=disk.write.bind(disk);
 disk.write=async(name,value)=>{if(name==='a'){secondStarted.resolve();await gate.promise;}return write(name,value);};
 const store=await managedStore(t,{backend:disk});store.clear();let complete=false;const pending=store.whenDurable().then(ack=>{complete=true;return ack;});
 await secondStarted.promise;await nextTurn();assert.equal(complete,false);assert.equal(store.getItem(KEY),null);assert.equal(store.getDurableItem(KEY),'personal');
 assert.equal(store.status().durableVersion,0);gate.resolve();const ack=await pending;assert.deepEqual(ack.values,{});
 for(const text of Object.values(disk.files))assert.deepEqual(decodeSnapshot(text).values,{});
 const reopened=await managedStore(t,{backend:disk});assert.equal(reopened.getItem(KEY),null);
});

test('failed reset cleanup stays unacknowledged and retries both slots before reporting durable',async t=>{
 const disk=backend({a:encodeSnapshot(3,{[KEY]:'personal'})});let fail=true;const write=disk.write.bind(disk);
 disk.write=async(name,value)=>{if(name==='a'&&fail)throw Error('cleanup failed');await write(name,value);};
 const store=await managedStore(t,{backend:disk});store.clear();await assert.rejects(store.whenDurable(),/cleanup failed/);
 assert.equal(store.status().pending,true);assert.equal(store.status().durableVersion,0);assert.equal(store.getDurableItem(KEY),'personal');
 assert.equal((await store.whenDurable(0)).values[KEY],'personal');fail=false;const ack=await store.retry();assert.deepEqual(ack.values,{});
 for(const text of Object.values(disk.files))assert.deepEqual(decodeSnapshot(text).values,{});
});

test('reset and a new write arriving during an older flush remain distinct durable checkpoints',async t=>{
 const disk=backend(),firstGate=deferred(),cleanupGate=deferred(),cleanupStarted=deferred();let writes=0;const write=disk.write.bind(disk);
 disk.write=async(name,value)=>{writes++;if(writes===1)await firstGate.promise;if(writes===3){cleanupStarted.resolve();await cleanupGate.promise;}await write(name,value);};
 const store=await managedStore(t,{backend:disk});store.setItem(KEY,'old personal');const old=store.whenDurable();
 store.clear();const reset=store.whenDurable();firstGate.resolve();const oldAck=await old;await cleanupStarted.promise;
 assert.equal(oldAck.values[KEY],'old personal');store.setItem('mlrHudGoalExpanded','1');const after=store.whenDurable();
 cleanupGate.resolve();const resetAck=await reset,afterAck=await after;
 assert.deepEqual(resetAck.values,{});assert.equal(resetAck.targetVersion,2);assert.equal(afterAck.values.mlrHudGoalExpanded,'1');assert.equal(afterAck.targetVersion,3);
 const reopened=await managedStore(t,{backend:disk});assert.equal(reopened.getItem(KEY),null);assert.equal(reopened.getItem('mlrHudGoalExpanded'),'1');
 for(const text of Object.values(disk.files))assert.equal(decodeSnapshot(text).values[KEY],undefined);
});

test('the HUD goal expansion preference survives native migration, mutation and boot',async t=>{
 const disk=backend(),store=await managedStore(t,{backend:disk,seed:{[KEY]:'ranch',mlrHudGoalExpanded:'1',foreign:'private'}});
 assert.equal(store.getDurableItem('mlrHudGoalExpanded'),'1');assert.equal(store.getItem('foreign'),null);
 store.setItem('mlrHudGoalExpanded','0');const ack=await store.whenDurable();assert.equal(ack.values.mlrHudGoalExpanded,'0');
 const reopened=await managedStore(t,{backend:disk});assert.equal(reopened.getItem('mlrHudGoalExpanded'),'0');
 assert.throws(()=>reopened.setItem('foreign','private'),/Unregistered/);
});

test('no-op changes do not advance checkpoints or write duplicate snapshots',async t=>{
 const disk=backend({a:encodeSnapshot(2,{[KEY]:'same'})});let writes=0;const write=disk.write.bind(disk);disk.write=async(...args)=>{writes++;return write(...args);};
 const store=await managedStore(t,{backend:disk});store.setItem(KEY,'same');store.removeItem('absent');
 assert.equal(store.checkpoint(),0);assert.equal((await store.retry()).revision,2);await store.flush();assert.equal(writes,0);
 store.removeItem(KEY);assert.equal(store.checkpoint(),1);assert.equal((await store.whenDurable()).values[KEY],undefined);
});

test('status snapshots are immutable, bounded and never expose mirror save contents',async t=>{
 const disk=backend(),events=[];disk.write=async()=>{throw Error('x'.repeat(400));};
 const store=await managedStore(t,{backend:disk,onStatus:s=>events.push(s)});store.setItem(KEY,'private receipt');
 await assert.rejects(store.whenDurable(),e=>e.message.length===240);const status=store.status();
 assert.ok(Object.isFrozen(status)&&Object.isFrozen(status.error));assert.equal(status.error.message.length,240);
 assert.equal(status.error.code,'NATIVE_SAVE_NOT_DURABLE');assert.equal(status.version,1);assert.equal(status.revision,0);
 assert.equal(JSON.stringify(status).includes('private receipt'),false);assert.equal(status.values,undefined);
 assert.ok(events.every(Object.isFrozen));assert.equal(events.at(-1).state,'error');
});

test('a write requested by the saved status observer receives its own durability acknowledgement',async t=>{
 const disk=backend();let store,nextAck,once=false;
 store=await managedStore(t,{backend:disk,onStatus:s=>{if(s.state==='saved'&&store&&!once){once=true;store.setItem(KEY,'observer write');nextAck=store.whenDurable();}}});
 store.setItem(KEY,'first');const first=await store.flush();assert.equal(first.values[KEY],'first');
 assert.equal((await nextAck).values[KEY],'observer write');await store.flush();assert.equal(store.status().pending,false);
});


test('a mutation after an earlier checkpoint resolves cannot emit saved status for pending data',async t=>{
 const disk=backend(),events=[],store=await managedStore(t,{backend:disk,onStatus:s=>events.push(s)});
 store.setItem(KEY,'first');const first=store.whenDurable();const run=store.flush();
 await first;store.setItem(KEY,'later');await run;
 assert.equal(store.status().pending,true);assert.equal(store.status().state,'saving');
 assert.equal(events.at(-1).state,'saving');assert.equal(store.getDurableItem(KEY),'first');
 const ack=await store.retry();assert.equal(ack.values[KEY],'later');
});

test('background flush failure reports pending durability even while synchronous rereads see the receipt',async t=>{
 const disk=backend(),failed=deferred();disk.write=async()=>{throw Error('background device rejection');};
 const store=await managedStore(t,{backend:disk,delay:0,onStatus:s=>{if(s.state==='error')failed.resolve(s);}});
 store.setItem(KEY,'mirror-only receipt');const reported=await failed.promise;
 assert.equal(store.getItem(KEY),'mirror-only receipt');assert.equal(store.getDurableItem(KEY),null);assert.deepEqual(disk.files,{});
 assert.equal(reported.pending,true);assert.equal(reported.durableVersion,0);assert.equal(reported.inFlight,false);
 await assert.rejects(store.whenDurable(),/background device rejection/);
});

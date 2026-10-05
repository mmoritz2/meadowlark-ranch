import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
// The static site has no root package type; load this standalone ESM helper directly.
const source=await readFile(new URL('../assets/deferred-load.js',import.meta.url),'utf8');
const {createDeferredLoad}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));

test('optional work waits for start while existing consumers can await ready',async()=>{
 let calls=0;
 const load=createDeferredLoad(async()=>{calls++;return 'the same authored asset';});
 await Promise.resolve();assert.equal(calls,0);assert.equal(load.started,false);
 const ready=load.ready;assert.equal(load.start(),ready);
 assert.equal(calls,1,'explicit start preserves eager invocation semantics');
 assert.equal(await ready,'the same authored asset');assert.equal(calls,1);
});
test('mount-ready and timeout fallback share one in-flight asset batch',async()=>{
 let calls=0,finish;
 const load=createDeferredLoad(()=>{calls++;return new Promise(resolve=>{finish=resolve;});});
 const first=load.start(),second=load.start();assert.equal(first,second);
 await Promise.resolve();assert.equal(calls,1);finish('loaded');await first;
 assert.equal(load.start(),first);assert.equal(calls,1);
});
test('synchronous and asynchronous errors reach the waiting consumer',async()=>{
 const sync=createDeferredLoad(()=>{throw Error('decode failed');});
 await assert.rejects(sync.start(),/decode failed/);
 const async=createDeferredLoad(async()=>{throw Error('fetch failed');});
 await assert.rejects(async.start(),/fetch failed/);
});

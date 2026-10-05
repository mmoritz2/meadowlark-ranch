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

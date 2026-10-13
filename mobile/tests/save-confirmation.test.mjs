import test from 'node:test';
import assert from 'node:assert/strict';
import {createSaveStore,encodeSnapshot} from '../src/save-store.mjs';
import {confirmGameSave} from '../src/save-confirmation.mjs';
const KEY='starRanchFable_v1';
const ranch=receipt=>({coins:550,cottonwoodPost:{receipts:[{runId:receipt}]}});
function backend(files={}){return {files:{...files},async read(slot){return this.files[slot]??null;},async write(slot,value){this.files[slot]=value;}};}

test('explicit browser preview confirms its actual browser record; ambiguous or unsupported native mode cannot use the mirror',async()=>{
 const storage={getItem:()=>JSON.stringify(ranch('browser'))};
 assert.deepEqual(await confirmGameSave({native:false,storage},KEY),ranch('browser'));
 for(const native of [undefined,null,true])await assert.rejects(confirmGameSave({native,storage},KEY),/could not be confirmed/);
 await assert.rejects(confirmGameSave({native:false,storage},'unknown-other-app-key'),/could not be confirmed/);
});
test('a failed real backend write cannot confirm the staged receipt; retry confirms the same reward and survives reopening',async()=>{
 const disk=backend();let failed=true;const write=disk.write.bind(disk);
 disk.write=async(...args)=>{if(failed)throw Error('disk full');return write(...args);};
 const storage=await createSaveStore({backend:disk});
 try{
  storage.setItem(KEY,JSON.stringify(ranch('same-delivery')));
  assert.deepEqual(JSON.parse(storage.getItem(KEY)),ranch('same-delivery'),'This working mirror alone is not durable evidence');
  await assert.rejects(confirmGameSave({native:true,storage},KEY),/disk full|not durable/);
  assert.equal(Object.keys(disk.files).length,0);
  failed=false;assert.deepEqual(await confirmGameSave({native:true,storage},KEY),ranch('same-delivery'));
  const reopened=await createSaveStore({backend:disk});
  try{assert.deepEqual(JSON.parse(reopened.getItem(KEY)),ranch('same-delivery'));}finally{reopened.dispose();}
 }finally{storage.dispose();}
});
test('native confirmation stays pending until the real write and readback and never calls getItem',async()=>{
 const disk=backend();let release,started;const entered=new Promise(resolve=>started=resolve),write=disk.write.bind(disk);
 disk.write=async(...args)=>{started();await new Promise(resolve=>release=resolve);return write(...args);};
 const storage=await createSaveStore({backend:disk});
 try{
  storage.setItem(KEY,JSON.stringify(ranch('delayed')));
  storage.getItem=()=>{throw Error('Working mirror was incorrectly trusted');};
  let settled=false;const confirmation=confirmGameSave({native:true,storage},KEY).then(value=>{settled=true;return value;});
  await entered;assert.equal(settled,false);assert.equal(Object.keys(disk.files).length,0);
  release();assert.deepEqual(await confirmation,ranch('delayed'));assert.equal(settled,true);
 }finally{storage.dispose();}
});
test('a newer failing request cannot borrow an older durable receipt',async()=>{
 const disk=backend({a:encodeSnapshot(3,{[KEY]:JSON.stringify(ranch('old'))})});
 disk.write=async()=>{throw Error('new write failed');};
 const storage=await createSaveStore({backend:disk});
 try{
  storage.setItem(KEY,JSON.stringify(ranch('new')));
  await assert.rejects(confirmGameSave({native:true,storage},KEY),/new write failed|not durable/);
  assert.deepEqual(JSON.parse(storage.getDurableItem(KEY)),ranch('old'));
 }finally{storage.dispose();}
});
test('wrong-target, partial, malformed and absent acknowledgements cannot confirm any reward',async()=>{
 const good={targetVersion:4,durableVersion:4,revision:3,values:{[KEY]:JSON.stringify(ranch('verified'))}};
 const bad=[null,{...good,targetVersion:3},{...good,durableVersion:3},{...good,revision:-1},
  {...good,values:{}},{...good,values:[]},{...good,values:{[KEY]:'broken'}},
  {...good,values:{[KEY]:'[]'}},{...good,values:{[KEY]:'null'}}];
 for(const ack of bad){const storage={checkpoint:()=>4,whenDurable:async()=>ack,getItem:()=>JSON.stringify(ranch('fake-mirror'))};await assert.rejects(confirmGameSave({native:true,storage},KEY),/could not be confirmed/);}
});
test('the consumer receives acknowledged receipt data even when a later working mirror is different',async()=>{
 const saved=ranch('disk'),storage={checkpoint:()=>8,whenDurable:async()=>({targetVersion:8,durableVersion:9,revision:12,values:{[KEY]:JSON.stringify(saved)}}),getItem:()=>JSON.stringify(ranch('unverified-later'))};
 assert.deepEqual(await confirmGameSave({native:true,storage},KEY),saved);
});

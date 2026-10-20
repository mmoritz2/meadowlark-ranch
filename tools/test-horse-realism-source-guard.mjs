import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {normalizeHorseRealismSource as inverse,assertHorseRealismCurrent as current,normalizeHorseRealismFixtureChanges as filter} from './horse-realism-source-guard.cjs';
import {normalizeFinalEnvironmentSource as environment,assertFinalEnvironmentCurrent} from './final-environment-source-guard.cjs';
import {normalizeNativeRidingGroomAuditSource as riding} from './native-riding-groom-source-guard.cjs';
const root=new URL('../',import.meta.url),read=file=>fs.readFileSync(new URL(file,root)),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const fixture='tools/fixtures/horse-realism-579b5cf/source-contract.json',contract=JSON.parse(read(fixture));
test('current reviewed appearance and complete parent/import bodies are raw-bound; all old fixtures remain unchanged',()=>{
 assert(current(read));assert.equal(Object.keys(contract.files).length,15);assert(Object.keys(contract.parentFixtureSHA256).length>=304);
 for(const file of ['assets/native-horse-materials.js','assets/native-flowing-groom.js','assets/native-equestrian-groom.js','assets/native-draft-feathers.js'])assert(contract.files[file]);
});
test('counted appearance inverses recover exact incoming bodies and preserve historical authority outcomes',()=>{
 const outcome=(fn,source,file)=>{try{return{ok:true,hash:sha(fn(source,file))};}catch(e){return{ok:false,code:e.code,message:e.message};}};
 for(const [file,row]of Object.entries({...contract.files,...contract.observers})){
  const raw=read(file),parent=inverse(raw,file);assert.equal(sha(parent),row.beforeSHA256,file);assert.equal(inverse(parent,file),parent);
  assert.deepEqual(outcome(environment,raw,file),outcome(environment,parent,file),file);assert.deepEqual(outcome(riding,raw,file),outcome(riding,parent,file),file);
  assert.throws(()=>current(f=>f===file?parent:read(f)));
 }
});
test('unknown versions, removed approved chunks, duplicates and body drift never certify',()=>{
 for(const [file,row]of Object.entries({...contract.files,...contract.observers})){
  const raw=read(file).toString();
  for(const bad of [raw+'\n// unreviewed drift',raw.replace(row.changes[0].after,''),raw+'\n'+row.changes[0].after]){
   assert.throws(()=>current(f=>f===file?bad:read(f)),file);
   assert.throws(()=>assert.equal(sha(inverse(bad,file)),row.beforeSHA256),file);
  }
 }
 const raw=read('ranch3d.html').toString().replaceAll(contract.release,'horse-realism-unreviewed');assert.throws(()=>current(f=>f==='ranch3d.html'?raw:read(f)));
 assert.throws(()=>assert.equal(sha(environment(raw,'ranch3d.html')),contract.files['ranch3d.html'].beforeSHA256));
});
test('source/rig binaries are not normalized; only exact new fixture paths filter',()=>{
 const binary=Buffer.from([0,255,192,128]);for(const file of ['unknown.glb','assets/models/native-roster/percheron.bin'])assert.equal(inverse(binary,file),binary);
 assert.equal(inverse('unrelated historical owner','ranch3d.html'),'unrelated historical owner');
 for(const file of [fixture,...Object.keys(contract.newFixtureSHA256)])assert.equal(filter(file+'\n'),'');
 assert.equal(filter('tools/fixtures/unknown.bin\n'),'tools/fixtures/unknown.bin\n');assert.throws(()=>filter(fixture+'\n'+fixture+'\n'));
});
test('new inverse is a builtin-only leaf and never runs in production',()=>{
 const source=read('tools/horse-realism-source-guard.cjs').toString();assert.deepEqual([...source.matchAll(/require\('([^']+)'\)/g)].map(m=>m[1]),['node:fs','node:path','node:assert/strict','node:crypto']);
 for(const file of Object.keys(contract.files))assert(!read(file).includes(Buffer.from('horse-realism-source-guard')));
 assert.equal(sha(inverse(read('tools/final-environment-source-guard.cjs'),'tools/final-environment-source-guard.cjs')),contract.observers['tools/final-environment-source-guard.cjs'].beforeSHA256);
});

test('incoming estate-era Ranch drift remains rejected by the older environment authority',()=>{
 const parent=inverse(read('ranch3d.html'),'ranch3d.html');
 assert.equal(sha(parent),'1c1199977c1d0310316d07eb984298ca62af4c9262355b993d832b8cc44637e7');
 const prior=JSON.parse(read('tools/fixtures/final-environment-a129adc/source-contract.json'));assert.equal(prior.files['ranch3d.html'].afterSHA256,'6118a23923dd3813dfa4795fba560c06fd620c88cf91c40b9abf436e5f46190c');
 assert.throws(()=>environment(parent,'ranch3d.html'),/Whole approved Final environment owner ranch3d.html/);
 assert.throws(()=>assertFinalEnvironmentCurrent(read),/Actual raw Final environment owner ranch3d.html/);
});

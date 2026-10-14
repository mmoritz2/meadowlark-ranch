import {normalizeFormalTurfFormalAuditSource} from './formal-turf-composition-source-guard.cjs';
import {normalizeFormalApproachResumeAuditSource} from './formal-approach-resume-source-guard.cjs';
import {normalizeProgrammeRegroupAuditSource} from './programme-regroup-source-guard.cjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {normalizeHorseTrainingSource,normalizeHorseTrainingObserverSource,normalizeHorseTrainingAuditSource,assertHorseTrainingCurrentSource,normalizeHorseTrainingFixtureChanges} from './horse-training-source-guard.cjs';
import {normalizeActivityIncomingSource,normalizeActivityParentSource,normalizeActivityIncomingObserverSource,normalizeActivityFixtureChanges} from './activity-landscape-source-guard.cjs';
import {normalizeReviewedWorldSource} from './reviewed-riding-source-guard.cjs';
import {normalizeStarterTackSource} from './starter-tack-source-guard.cjs';
const root=new URL('../',import.meta.url),read=file=>normalizeProgrammeRegroupAuditSource(normalizeFormalApproachResumeAuditSource(normalizeFormalTurfFormalAuditSource(fs.readFileSync(new URL(file,root),'utf8'),file),file),file);
const fixture='tools/fixtures/horse-training-dc405f3/contract.json',contract=JSON.parse(read(fixture));
const sha=value=>createHash('sha256').update(value).digest('hex');
const git=file=>execFileSync('git',['show',contract.baseline+':'+file],{cwd:root,encoding:'utf8'});

function rejectsCurrent(source,file,normalize,rows){
 assert.throws(()=>assertHorseTrainingCurrentSource(source,file));
 if(rows.some(c=>c.file===file&&source.includes(c.after)))assert.throws(()=>normalize(source,file));
 else{
  // Earlier states without this layer's additions retain downstream hashes.
  // Pass-through cannot strip the damage or become the pinned original body.
  assert.equal(normalize(source,file),source);
  const row=contract.files[file]||contract.observers[file];assert.notEqual(sha(source),row.beforeSHA256);
 }
}
function authored(before,changes){
 for(const c of changes){assert.equal(c.occurrences,1);assert.equal(before.split(c.before).length-1,1,'Unique independently authored old literal');before=before.replace(c.before,c.after);}
 return before;
}
test('all eight current product owners are independently authored from complete dc405f3 sources',()=>{
 assert.equal(contract.baseline,'dc405f3fe1e0b408ab97bc623b2e4fc3d4a7cf3d');
 assert.equal(Object.keys(contract.files).length,8);
 for(const [file,row] of Object.entries(contract.files)){
  const before=git(file),live=read(file);assert.equal(sha(before),row.beforeSHA256);assert.equal(sha(live),row.afterSHA256);
  assert.equal(authored(before,contract.changes.filter(c=>c.file===file)),live,'Raw Git forward construction is independent of the projection oracle');
  assert.equal(normalizeHorseTrainingSource(live,file),before);assert.equal(normalizeHorseTrainingSource(before,file),before);
  assert.equal(assertHorseTrainingCurrentSource(live,file),true);
 }
});
test('all seven cache imports have one exact owner and reject unknown, mixed, deleted and duplicated current states',()=>{
 const caches=contract.changes.filter(c=>c.kind==='cache');assert.equal(caches.length,7);
 const expectedOwners=new Set(['ranch3d.html:FEATURES','assets/features/index.js:trainingDrills','assets/features/index.js:story','assets/features/index.js:seasonQuests','assets/features/index.js:seEvents','assets/features/index.js:storyGuidance','assets/features/se-events.js:eventPreparation']);
 for(const c of caches){
  const owner=c.after.match(/import \{(\w+)\}|import \* as (\w+)/);assert(expectedOwners.delete(c.file+':'+(owner[1]||owner[2])));
  assert(c.after.includes('?v=horse-training-plan-1'));const live=read(c.file);
  for(const bad of [live.replace(c.after,''),live+'\n'+c.after,live+'\n'+c.before,live.replace(c.after,c.after.replace(/\?v=[^']+/,'?v=unknown-next')),live.replace(c.after,c.after.replace(owner[1]||owner[2],'unknownOwner'))]){
   assert.throws(()=>assertHorseTrainingCurrentSource(bad,c.file));
   assert.throws(()=>normalizeHorseTrainingSource(bad,c.file));
   if(c.file==='ranch3d.html'||c.file==='assets/features/index.js'){
    assert.throws(()=>normalizeReviewedWorldSource(bad,c.file));assert.throws(()=>normalizeStarterTackSource(bad,c.file));
   }
  }
 }
 assert.equal(expectedOwners.size,0);
});
test('partial runtime groups and unrelated reward, identity, model, geography or authorization drift cannot be stripped',()=>{
 for(const c of contract.changes.filter(c=>c.kind==='runtime')){
  const live=read(c.file);
  for(const bad of [live.replace(c.after,''),live+'\n'+c.after,live.replace(c.after,c.after+'/* unknown behavior */')]){
   rejectsCurrent(bad,c.file,normalizeHorseTrainingSource,contract.changes);
  }
 }
 for(const file of Object.keys(contract.files)){
  const bad=read(file)+'\n// unrelated actor/auth/currency/rig/rider/world change';
  assert.throws(()=>normalizeHorseTrainingSource(bad,file));assert.throws(()=>assertHorseTrainingCurrentSource(bad,file));
 }
});
test('the old complete-source and both landscape parent views receive exact dc405f3 inputs',()=>{
 for(const file of ['ranch3d.html','assets/features/index.js','assets/features/story-quests.js']){
  const live=read(file),before=git(file);
  assert.equal(normalizeActivityIncomingSource(live,file),normalizeActivityIncomingSource(before,file));
  assert.equal(normalizeActivityParentSource(live,file),normalizeActivityParentSource(before,file));
  assert.equal(normalizeReviewedWorldSource(live,file),normalizeReviewedWorldSource(before,file));
  assert.equal(normalizeStarterTackSource(live,file),normalizeStarterTackSource(before,file));
 }
});
test('each declared observer restores its complete dc405f3 assertions, not just selected pin literals',()=>{
 for(const [file,row] of Object.entries(contract.observers)){
  const live=read(file),before=git(file);assert.equal(sha(live),row.afterSHA256);assert.equal(sha(before),row.beforeSHA256);
  assert.equal(authored(before,row.changes),live);assert.equal(normalizeHorseTrainingObserverSource(live,file),before);
  assert.equal(normalizeHorseTrainingObserverSource(before,file),before);
  assert.equal(normalizeActivityIncomingObserverSource(live,file),normalizeActivityIncomingObserverSource(before,file));
  for(const bad of [live+'\n// altered old assertion',live.replace(row.changes[0].after,''),live+'\n'+row.changes[0].after]){
   rejectsCurrent(bad,file,normalizeHorseTrainingObserverSource,row.changes);
  }
 }
 for(const file of ['tools/coyote-crag-composition-source-guard.cjs','tools/published-world-import-source-guard.cjs','tools/authored-camera-source-guard.cjs','tools/riding-distance-source-guard.cjs','tools/ribbon-award-source-guard.cjs','tools/grass-arch-source-guard.cjs'])assert.equal(read(file),git(file),file+' original body untouched');
});
test('all164 existing fixture blobs remain byte-exact and only the named, verified new contract leaves old fixture assertions',()=>{
 const rows=execFileSync('git',['ls-tree','-r','--format=%(objectname) %(path)',contract.baseline,'tools/fixtures'],{cwd:root,encoding:'utf8'}).trim().split('\n');
 assert.equal(rows.length,164);assert.equal(contract.unchangedFixtureCount,164);
 for(const row of rows){const at=row.indexOf(' '),expected=row.slice(0,at),file=row.slice(at+1),bytes=fs.readFileSync(new URL(file,root));assert.equal(createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex'),expected,file+' raw fixture blob');}
 assert.equal(normalizeHorseTrainingFixtureChanges(fixture+'\n'),'');
 assert.equal(normalizeActivityFixtureChanges(fixture+'\n','df065bd26a6a0e097306262e689678cb9e439c7d'),'');
 for(const unknown of ['tools/fixtures/new-unreviewed/contract.json','tools/fixtures/activity-landscape-6a82f3f/contract.json'])assert.equal(normalizeHorseTrainingFixtureChanges(unknown+'\n'),unknown+'\n');
 assert.throws(()=>normalizeHorseTrainingFixtureChanges(fixture+'\n'+fixture+'\n'));
});
test('the exact new fixture pin rejects edits or absence without repinning any earlier contract',()=>{
 const leaf=read('tools/horse-training-source-guard.cjs'),moduleDir=path.join(fileURLToPath(root),'tools');
 function load(data){const module={exports:{}};new Function('require','module','exports','__dirname',leaf)(name=>name==='node:fs'?{...fs,readFileSync(file,...args){if(String(file).endsWith(fixture)){if(data===null)throw Error('Missing declared contract');return data;}return fs.readFileSync(file,...args);}}:name==='node:path'?path:name==='node:assert/strict'?assert:name==='node:crypto'?{createHash}:null,module,module.exports,moduleDir);return module.exports;}
 assert.doesNotThrow(()=>load(read(fixture)));
 assert.throws(()=>load(read(fixture)+'\n'),/Exact reviewed horse-training contract/);
 assert.throws(()=>load(read(fixture).replace('dc405f3','unknown')),/Exact reviewed horse-training contract/);
 assert.throws(()=>load(null),/Missing declared contract/);
});
test('historical runner composes training before region copies and only the new layer leaf dependency is added',()=>{
 const runner=read('tools/run-reviewed-world-guards.mjs');assert(runner.includes("normalizeActivityRuntimeSource(normalizeHorseTrainingSource(readFileSync(src,'utf8'),name),name)"));
 assert.equal(normalizeHorseTrainingAuditSource(runner,'tools/run-reviewed-world-guards.mjs'),git('tools/run-reviewed-world-guards.mjs'));
 const leaf=read('tools/horse-training-source-guard.cjs'),required=[...leaf.matchAll(/require\('([^']+)'\)/g)].map(m=>m[1]);assert.deepEqual(required,['node:fs','node:path','node:assert/strict','node:crypto']);
 const previous=normalizeHorseTrainingObserverSource(read('tools/activity-landscape-source-guard.cjs'),'tools/activity-landscape-source-guard.cjs');assert.equal(previous,git('tools/activity-landscape-source-guard.cjs'));
 assert.equal(normalizeHorseTrainingSource('Unchanged standalone actor','assets/game-hero-horse.js'),'Unchanged standalone actor');
 assert.equal(normalizeHorseTrainingObserverSource('Unchanged native store','mobile/src/save-store.mjs'),'Unchanged native store');
});
test('new behavioral tests remain live files and are explicitly named/hash-pinned',()=>{
 assert(Object.hasOwn(contract.addedFiles,'tools/test-event-horse-xp-preparation.mjs'));
 assert(Object.hasOwn(contract.addedFiles,'tools/test-training-quest-claims.mjs'));
 for(const [file,hash]of Object.entries(contract.addedFiles)){assert.equal(sha(fs.readFileSync(new URL(file,root))),hash,file+' actual new behavioral test');assert.equal(normalizeHorseTrainingAuditSource(read(file),file),read(file),'new tests are never projected as old assertions');}
});

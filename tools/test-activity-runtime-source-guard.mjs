import {normalizeActivityParentSource,normalizeActivityParentObserverSource,normalizeActivityFixtureChanges} from './activity-landscape-source-guard.cjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {normalizeActivityRuntimeSource,normalizeActivityObserverSource} from './activity-runtime-source-guard.cjs';
import {normalizeReviewedWorldSource} from './reviewed-riding-source-guard.cjs';
import {normalizeStarterTackSource} from './starter-tack-source-guard.cjs';
const root=new URL('../',import.meta.url),read=file=>normalizeActivityParentObserverSource(normalizeActivityParentSource(fs.readFileSync(new URL(file,root),'utf8'),file),file);
const contract=JSON.parse(read('tools/fixtures/activity-runtime-df065bd/contract.json'));
const sha=source=>createHash('sha256').update(source).digest('hex');
const git=file=>execFileSync('git',['show',contract.baseline+':'+file],{cwd:root,encoding:'utf8'});

test('all four complete current owners reconstruct independently pinned df065bd bytes through exactly eleven literals',()=>{
 assert.equal(contract.changes.filter(c=>c.kind==='cache').length,6);assert.equal(contract.changes.filter(c=>c.kind==='runtime').length,5);
 for(const [file,row]of Object.entries(contract.files)){
  const original=git(file),live=read(file);assert.equal(sha(original),row.beforeSHA256);assert.equal(sha(live),row.afterSHA256);
  let authored=original;
  for(const c of contract.changes.filter(c=>c.file===file)){
   assert.equal(c.occurrences,1);if(c.before)assert.equal(authored.split(c.before).length-1,1);authored=authored.replace(c.before,c.after);
   assert.equal(live.split(c.after).length-1,1);
  }
  assert.equal(authored,live,'The exact current source is independently authored from the Git preimage');
  assert.equal(normalizeActivityRuntimeSource(live,file),original);assert.equal(normalizeActivityRuntimeSource(original,file),original);
  assert.equal(normalizeReviewedWorldSource(live,file),normalizeReviewedWorldSource(original,file));
  assert.equal(normalizeStarterTackSource(live,file),normalizeStarterTackSource(original,file));
 }
});

test('all six activity cache edges reject unknown, duplicate, deleted, renamed and mixed imports through the original complete-source chain',()=>{
 for(const c of contract.changes.filter(c=>c.kind==='cache')){
  const live=read(c.file);
  for(const bad of [live.replace(c.after,c.after.replace(/\?v=[^']+/,'?v=unknown-next')),live+'\n// duplicate '+c.after,live+'\n// mixed '+c.before,live.replace(c.after,''),live.replace(c.after,c.after.replace(/FEATURES|storyGuidance|story |world |social |cottonwoodPost/,'unknownOwner'))]){
   assert.throws(()=>normalizeReviewedWorldSource(bad,c.file));assert.throws(()=>normalizeStarterTackSource(bad,c.file));
  }
 }
});

test('region import, gate and fallback reversals require the complete reviewed group and retain every other world/story byte',()=>{
 for(const c of contract.changes.filter(c=>c.kind==='runtime')){
  const live=read(c.file);
  const bad=[live.replace(c.after,''),live+'\n'+c.after,live.replace(c.after,c.after+'/* unreviewed */'),live+'\n// unrelated region/wild-taming change'];
  if(c.before)bad.push(live.replace(c.after,c.before),live+'\n'+c.before);
  for(const subject of bad)assert.throws(()=>normalizeActivityRuntimeSource(subject,c.file));
 }
});

test('activity compatibility cannot erase rider, authorization, gear, XP, terrain or grass body drift',()=>{
 for(const file of ['ranch3d.html','assets/features/index.js']){
  const live=read(file),drift=live+'\n// unauthorized rider/auth/gear/XP/world mutation';
  assert(normalizeActivityRuntimeSource(drift,file).endsWith('// unauthorized rider/auth/gear/XP/world mutation'));
  assert.throws(()=>normalizeReviewedWorldSource(drift,file));assert.throws(()=>normalizeStarterTackSource(drift,file));
 }
 assert.equal(normalizeActivityRuntimeSource('unchanged live behavior','assets/features/cottonwood-post.js'),'unchanged live behavior');
 assert.equal(normalizeActivityRuntimeSource('unchanged native save code','mobile/src/save-store.mjs'),'unchanged native save code');
});

test('every outer observer adapter restores its exact df body with all old assertions and fixture references intact',()=>{
 for(const [file,row]of Object.entries(contract.observers)){
  const original=git(file),live=read(file);assert.equal(sha(original),row.beforeSHA256);assert.equal(sha(live),row.afterSHA256);
  assert.equal(normalizeActivityObserverSource(live,file),original);assert.equal(normalizeActivityObserverSource(original,file),original);
  assert.throws(()=>normalizeActivityObserverSource(live+'\n// weaken old assertion',file));
  for(const c of contract.observerChanges.filter(c=>c.file===file)){
   assert.throws(()=>normalizeActivityObserverSource(live.replace(c.after,''),file));assert.throws(()=>normalizeActivityObserverSource(live+'\n'+c.after,file));
  }
 }
 assert.equal(normalizeActivityObserverSource('untouched original assertion','tools/test-basic-riding-tack.mjs'),'untouched original assertion');
});

test('the historical runner projects only the reviewed world/story seams and all older fixture pins remain byte exact',()=>{
 const runner=read('tools/run-reviewed-world-guards.mjs');
 assert(runner.includes("else if(name==='assets/features/world.js'||name==='assets/features/story-quests.js')writeFileSync(dest,normalizeActivityRuntimeSource(readFileSync(src,'utf8'),name));"));
 assert.equal(normalizeActivityFixtureChanges(execFileSync('git',['diff','--name-only',contract.baseline,'--','tools/fixtures'],{cwd:root,encoding:'utf8'}),contract.baseline),'','No tracked original fixture changed');
 for(const file of ['tools/grass-arch-source-guard.cjs','tools/published-world-import-source-guard.cjs','tools/authored-camera-source-guard.cjs','tools/coyote-crag-composition-source-guard.cjs','tools/fieldstone-wall-cache-source-guard.cjs','tools/riding-distance-source-guard.cjs','tools/ribbon-award-source-guard.cjs','tools/reviewed-riding-source-guard.cjs','tools/progression-grass-source-guard.cjs'])assert.equal(read(file),git(file),file+' source assertions remain unchanged');
});

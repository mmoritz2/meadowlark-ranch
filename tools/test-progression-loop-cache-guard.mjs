import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {normalizeProgressionLoopCacheSource} from './progression-loop-cache-source-guard.cjs';
import {normalizeProgressionHintsSource} from './progression-hints-source-guard.cjs';
import {normalizeReviewedRuntimeSource,normalizeReviewedWorldSource} from './reviewed-riding-source-guard.cjs';
import {normalizeStarterTackSource} from './starter-tack-source-guard.cjs';
import {normalizeGrassRibbonOwnSource} from './grass-ribbon-source-guard.cjs';
const root=new URL('../',import.meta.url),read=file=>fs.readFileSync(new URL(file,root),'utf8');
const contract=JSON.parse(read('tools/fixtures/progression-loop-243dbfb/contract.json'));
const sha=s=>createHash('sha256').update(s).digest('hex');
const original=file=>execFileSync('git',['show',contract.baseline+':'+file],{cwd:root,encoding:'utf8'});

test('five exact live cache imports preserve the complete independently pinned243dbfb owners',()=>{
 assert.equal(contract.changes.length,5);
 for(const [file,hash] of Object.entries(contract.beforeSHA256)){
  const before=original(file),live=normalizeGrassRibbonOwnSource(read(file),file);assert.equal(sha(before),hash);
  let expected=before;
  for(const c of contract.changes.filter(c=>c.file===file)){
   assert.equal(c.occurrences,1);assert.equal(expected.split(c.before).length-1,1);expected=expected.replace(c.before,c.after);
   assert.equal(live.split(c.after).length-1,1);assert.equal(live.split(c.before).length-1,0);
  }
  // The one approved eligibility predicate is a separate runtime change.
  assert.equal(normalizeProgressionHintsSource(live,file),expected);
  assert.equal(normalizeProgressionHintsSource(normalizeProgressionLoopCacheSource(live,file),file),before);
  assert.equal(normalizeProgressionLoopCacheSource(before,file),before);
 }
});
test('unknown, renamed, deleted, duplicate and mixed cache imports still fail the complete preservation chain',()=>{
 for(const c of contract.changes){
  const live=read(c.file);
  const bad=[live.replace(c.after,c.after.replace(/\?v=[^']+/,'?v=unreviewed-next')),live.replace(c.after,c.after.replace(/FEATURES|events|ev2disc|ev2ladder|seJourney/,'unreviewedOwner')),live.replace(c.after,''),live+'\n// duplicate '+c.after,live+'\n// mixed '+c.before];
  for(const subject of bad){assert.throws(()=>normalizeReviewedWorldSource(subject,c.file));assert.throws(()=>normalizeStarterTackSource(subject,c.file));}
  for(const subject of bad.slice(-2))assert.throws(()=>normalizeProgressionLoopCacheSource(subject,c.file));
 }
});
test('cache compatibility cannot strip an unknown version, suppress body drift, or alter unrelated modules',()=>{
 for(const file of Object.keys(contract.beforeSHA256)){
  const live=read(file),c=contract.changes.find(c=>c.file===file),unknown=c.after.replace(/\?v=[^']+/,'?v=unknown-next');
  assert(normalizeProgressionLoopCacheSource(live.replace(c.after,unknown),file).includes(unknown));
  const drift=live+'\n// unauthorized runtime behavior';
  assert(normalizeProgressionLoopCacheSource(drift,file).endsWith('// unauthorized runtime behavior'));
  assert.throws(()=>normalizeReviewedWorldSource(drift,file));assert.throws(()=>normalizeStarterTackSource(drift,file));
  assert.equal(normalizeReviewedRuntimeSource(normalizeGrassRibbonOwnSource(live,file),file),execFileSync('git',['show','04ba300:'+file],{cwd:root,encoding:'utf8'}));
 }
 assert.equal(normalizeProgressionLoopCacheSource('unchanged body','assets/features/course-engine.js'),'unchanged body');
});
test('existing cache fixtures and source pins retain their original bytes',()=>{
 for(const file of ['tools/fixtures/reviewed-riding-4e346b2/cache-changes.json','tools/fixtures/reviewed-riding-4e346b2/contract.json','tools/fixtures/reviewed-riding-4e346b2/observer-changes.json','tools/fixtures/published-world-885e882/import-changes.json','tools/fixtures/fieldstone-wall-a78ed79/contract.json','tools/fixtures/grass-arch-d5b9441/preimage-SHA.json'])assert.equal(read(file),original(file));
});

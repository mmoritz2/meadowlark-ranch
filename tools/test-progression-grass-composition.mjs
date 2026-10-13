import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {normalizeLashCacheSource,normalizeLashObserverSource} from './lash-cache-source-guard.cjs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {normalizeProgressionSource,normalizeProgressionGuardSource} from './progression-grass-source-guard.cjs';
import {normalizeReviewedWorldSource} from './reviewed-riding-source-guard.cjs';
import {normalizeGrassRibbonSource} from './grass-ribbon-source-guard.cjs';
import {normalizeMeadowReliefWallSource,normalizeMeadowReliefWallTestSource} from './meadow-relief-wall-source-guard.cjs';
const root=new URL('../',import.meta.url),directory=new URL('./fixtures/progression-grass-9c9ae98/',import.meta.url);
const read=file=>normalizeLashObserverSource(normalizeLashCacheSource(normalizeMeadowReliefWallTestSource(normalizeMeadowReliefWallSource(fs.readFileSync(new URL(file,root),'utf8'),file),file),file),file),sha=s=>createHash('sha256').update(s).digest('hex');
const contract=JSON.parse(fs.readFileSync(new URL('contract.json',directory))),changes=JSON.parse(fs.readFileSync(new URL('observer-changes.json',directory)));
const caches=JSON.parse(fs.readFileSync(new URL('./fixtures/progression-loop-243dbfb/contract.json',import.meta.url))).changes;
const hint=JSON.parse(fs.readFileSync(new URL('./fixtures/progression-hints-243dbfb/contract.json',import.meta.url))).change;
const grass=JSON.parse(fs.readFileSync(new URL('./fixtures/grass-ribbon-d9b168e/contract.json',import.meta.url)));
const git=file=>execFileSync('git',['show',contract.grassCommit+':'+file],{cwd:root,encoding:'utf8'});
test('merged runtime preserves every incoming grass/verge owner byte except the declared progression hint and five cache imports',()=>{
 assert.equal(caches.length,5);
 for(const file of ['ranch3d.html','assets/features/index.js'])assert.equal(normalizeProgressionSource(read(file),file),git(file));
 for(const c of caches)assert.equal(read(c.file).split(c.after).length-1,1,'Live progression owner: '+c.after);
 assert.equal(read('ranch3d.html').split(hint.after).length-1,1,'Actual modern race hints remain installed');
 for(const file of Object.keys(grass.files)){
  const current=read(file);assert.equal(sha(normalizeProgressionSource(current,file)),grass.files[file].candidateSHA256,'Incoming accepted six-file graph remains exact '+file);
  assert.doesNotThrow(()=>normalizeReviewedWorldSource(current,file));
 }
});
test('every compatibility observer reconstructs its exact incoming complete body and preserves all original assertions',()=>{
 for(const [file,hash]of Object.entries(contract.preimageSHA256)){
  const source=read(file),old=normalizeProgressionGuardSource(source,file);assert.equal(sha(old),hash);assert.equal(old,git(file));assert.equal(normalizeProgressionGuardSource(old,file),old);
  assert.throws(()=>normalizeProgressionGuardSource(source+'\n// unauthorized assertion change',file));
  for(const c of changes.filter(c=>c.file===file)){
   assert.throws(()=>normalizeProgressionGuardSource(source.replace(c.after,''),file));
   assert.throws(()=>normalizeProgressionGuardSource(source+'\n'+c.after,file));
  }
 }
});
test('all fixed incoming dependency SHA and old fixture bytes remain authoritative through exact observer projection',()=>{
 for(const [file,hash]of Object.entries(grass.dependencySHA256))assert.equal(sha(normalizeProgressionGuardSource(read(file),file)),hash,'Exact original dependency: '+file);
 for(const file of ['tools/fixtures/grass-ribbon-d9b168e/contract.json','tools/fixtures/grass-ribbon-d9b168e/source-changes.json','tools/fixtures/grass-ribbon-d9b168e/test-adapter-changes.json','tools/fixtures/fieldstone-wall-a78ed79/contract.json','tools/fixtures/reviewed-riding-4e346b2/contract.json','tools/fixtures/grass-arch-d5b9441/preimage-SHA.json'])assert.equal(read(file),git(file),file);
});
test('unknown, duplicate, mixed cache declarations and changed import owners cannot pass the combined whole-body guards',()=>{
 for(const c of caches){const source=read(c.file);for(const bad of [
  source.replace(c.after,c.after.replace(/\?v=[^']+/,'?v=unreviewed-next')),
  source+'\n// duplicate '+c.after,source+'\n// mixed '+c.before,
  source.replace(c.after,c.after.replace(/FEATURES|events |ev2ladder|seJourney|ev2disc/,'unreviewedOwner')),
 ])assert.throws(()=>normalizeReviewedWorldSource(bad,c.file));}
});
test('approved progression compatibility cannot normalize body drift, wrong hint logic or malformed grass literals',()=>{
 const source=read('ranch3d.html');
 for(const bad of [source+'\n// unexpected rider/auth/XP mutation',source.replace(hint.after,hint.after+'/* unreviewed */'),source.replace('grass-ribbon-3','grass-ribbon-unreviewed'),source+'\n'+hint.after])assert.throws(()=>normalizeReviewedWorldSource(bad,'ranch3d.html'));
 assert.equal(normalizeProgressionSource('untouched source','assets/native-horse-motion.js'),'untouched source');
 assert.equal(normalizeProgressionGuardSource('untouched source','assets/native-horse-motion.js'),'untouched source');
});

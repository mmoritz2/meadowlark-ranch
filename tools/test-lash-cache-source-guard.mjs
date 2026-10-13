import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {normalizeMeadowReliefWallSource,normalizeMeadowReliefWallTestSource} from './meadow-relief-wall-source-guard.cjs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {normalizeLashCacheSource,normalizeLashObserverSource} from './lash-cache-source-guard.cjs';
import {normalizeReviewedWorldSource} from './reviewed-riding-source-guard.cjs';
const root=new URL('../',import.meta.url),read=file=>normalizeMeadowReliefWallTestSource(normalizeMeadowReliefWallSource(fs.readFileSync(new URL(file,root),'utf8'),file),file);
const contract=JSON.parse(read('tools/fixtures/lash-cache-df065bd/contract.json'));
const git=file=>execFileSync('git',['show',contract.baseline+':'+file],{cwd:root,encoding:'utf8'});
const sha=source=>createHash('sha256').update(source).digest('hex');
test('live lash cache owners retain every independently pinned df065bd byte after three exact import reversals',()=>{
 assert.equal(contract.changes.length,3);
 for(const [file,hash]of Object.entries(contract.ownerBeforeSHA256)){
  const original=git(file),live=read(file);assert.equal(sha(original),hash);assert.equal(sha(live),contract.ownerAfterSHA256[file]);
  for(const c of contract.changes.filter(c=>c.file===file)){assert.equal(live.split(c.after).length-1,1);assert.equal(live.split(c.before).length-1,0);}
  assert.equal(normalizeLashCacheSource(live,file),original);assert.equal(normalizeLashCacheSource(original,file),original);
  assert.equal(normalizeReviewedWorldSource(live,file),normalizeReviewedWorldSource(original,file));
 }
});
test('unknown, renamed, missing, duplicate, mixed and extended cache declarations cannot pass complete body preservation',()=>{
 for(const c of contract.changes){const source=read(c.file);for(const bad of [
  source.replace(c.after,c.after.replace(contract.version,'unreviewed-lash-cache')),
  source.replace(c.after,c.after.replace(/createRiderLibrary|FEATURES|tack from/,'unreviewedOwner')),
  source.replace(c.after,''),source+'\n// duplicate '+c.after,source+'\n// mixed '+c.before,
  source.replace(c.after,c.after.replace("';","&extra=1';")),
 ])assert.throws(()=>normalizeReviewedWorldSource(bad,c.file));}
 for(const file of Object.keys(contract.ownerBeforeSHA256))assert.throws(()=>normalizeLashCacheSource(read(file)+'\n// unrelated runtime edit',file));
});
test('new compatibility seams preserve complete old guards and all old assertions',()=>{
 for(const [file,hash]of Object.entries(contract.observerBeforeSHA256)){
  const original=git(file),live=read(file);assert.equal(sha(original),hash);assert.equal(sha(live),contract.observerAfterSHA256[file]);
  assert.equal(normalizeLashObserverSource(live,file),original);assert.equal(normalizeLashObserverSource(original,file),original);
  assert.throws(()=>normalizeLashObserverSource(live+'\n// changed assertion',file));
 }
});

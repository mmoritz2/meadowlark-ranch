import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
import {fileURLToPath} from 'node:url';import {createHash} from 'node:crypto';import {execFileSync} from 'node:child_process';
import {normalizeCharacterCacheSource as inverse,assertCharacterCacheCurrent as current,characterCacheRead} from './character-cache-source-guard.cjs';
const packageRoot=fileURLToPath(new URL('../',import.meta.url)),root=process.env.CHARACTER_CACHE_TEST_ROOT||packageRoot,gitRoot=process.env.CHARACTER_CACHE_GIT_ROOT||root;
const contract=JSON.parse(fs.readFileSync(new URL('./fixtures/character-cache-a0f3837/contract.json',import.meta.url),'utf8'));
const read=f=>fs.readFileSync(path.join(root,f)),git=f=>execFileSync('git',['show',contract.baseline+':'+f],{cwd:gitRoot}),sha=s=>createHash('sha256').update(s).digest('hex');
test('three exact cache imports restore both complete independently pinned a0f3837 owners',()=>{
 assert.equal(contract.changes.length,3);
 for(const f of Object.keys(contract.ownerBeforeSHA256)){
  const before=git(f),after=read(f);assert.equal(sha(before),contract.ownerBeforeSHA256[f]);assert.equal(sha(after),contract.ownerAfterSHA256[f]);
  assert(current(after,f));assert.deepEqual(inverse(after,f),before);assert.deepEqual(inverse(before,f),before);
  assert.deepEqual(characterCacheRead(read)(f),before);
 }
});
test('missing, renamed, unknown, duplicate, mixed, partial and extended import groups reject current certification',()=>{
 for(const c of contract.changes){const source=read(c.file).toString();for(const bad of[
  source.replace(c.after,''),source.replace(c.after,c.after.replace(contract.version,'unknown-character-cache')),
  source.replace(c.after,c.after.replace(/createRiderLibrary|FEATURES|tack from/,'unreviewedOwner')),
  source+'\n// duplicate '+c.after,source+'\n// mixed '+c.before,
  source.replace(c.after,c.after.replace("';","&extra=1';")),source+'\n// unrelated runtime edit',
 ]){assert.throws(()=>current(bad,c.file));if(bad.includes(contract.version))assert.throws(()=>inverse(bad,c.file));}}
});
test('only exact owner routes participate and no historical query is stripped',()=>{
 const history="import {FEATURES} from './assets/features/index.js?v=older-owner';";
 assert.equal(inverse(history,'ranch3d.html'),history);assert.equal(inverse(history,'unowned.js'),history);
 const buffer=Buffer.from([255,0,128]);assert.equal(inverse(buffer,'unowned.bin'),buffer);
 assert.throws(()=>current(history,'ranch3d.html'));assert.throws(()=>current(history,'unowned.js'));
});

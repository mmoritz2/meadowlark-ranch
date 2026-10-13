import {normalizeActivityIncomingSource,normalizeActivityIncomingObserverSource} from './activity-landscape-source-guard.cjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {normalizeMeadowReliefWallSource,normalizeMeadowReliefWallTestSource} from './meadow-relief-wall-source-guard.cjs';
import {normalizeReviewedWorldSource} from './reviewed-riding-source-guard.cjs';
const fixture=new URL('./fixtures/meadow-relief-wall-b1a73b1/',import.meta.url),load=file=>JSON.parse(fs.readFileSync(new URL(file,fixture)));
const contract=load('contract.json'),changes=load('source-changes.json'),adapters=load('test-adapter-changes.json'),functions=load('prior-projection-functions.json');
const read=file=>normalizeActivityIncomingObserverSource(normalizeActivityIncomingSource(fs.readFileSync(new URL('../'+file,import.meta.url),'utf8'),file),file),sha=s=>createHash('sha256').update(s).digest('hex');
for(const[file,row]of Object.entries(contract.files))test(`${file}: actual new owner is exact and only approved blocks restore the full228 body`,()=>{
 const source=read(file);assert.equal(sha(source),row.candidateSHA256);
 const before=normalizeMeadowReliefWallSource(source,file);assert.equal(sha(before),row.rawSHA256);
 assert.equal(normalizeMeadowReliefWallSource(before,file),before);
 for(const input of[source+'\n// unreviewed body',before+'\n// unreviewed original body'])assert.throws(()=>normalizeMeadowReliefWallSource(input,file));
 for(const c of changes.filter(c=>c.file===file)){
  assert.equal(source.split(c.after).length,2);
  for(const input of[source.replace(c.after,''),source+'\n'+c.after,source+'\n'+c.before,source.replace(c.after,c.after+'/* unreviewed */')])assert.throws(()=>normalizeMeadowReliefWallSource(input,file));
 }
});
test('five actual parent/child cache edges are live once and reject unknown versions or changed owners',()=>{
 const edges=changes.filter(c=>c.before.includes('?v='));assert.equal(edges.length,5);assert.equal(changes.length,18);
 for(const c of edges){const source=read(c.file);assert.equal(source.split(c.after).length,2);assert.equal(source.split(c.before).length,1);
  assert.throws(()=>normalizeMeadowReliefWallSource(source.replace(c.after,c.after.replace('?v=','?v=unknown-')),c.file));
  const first=source.split('\n').find(line=>line.includes(c.after));assert(first?.startsWith('import '));
  assert.throws(()=>normalizeMeadowReliefWallSource(source.replace(first,first.replace('import ','import /* owner drift */ ')),c.file));
 }
});
test('new observer reversals retain all complete228 bodies and previous14/38 fixture bytes',()=>{
 for(const[file,hash]of Object.entries(contract.testAdapterPreimages)){
  const source=read(file),prior=normalizeMeadowReliefWallTestSource(source,file);assert.equal(sha(prior),hash);
  assert.equal(normalizeMeadowReliefWallTestSource(prior,file),prior);
  assert.throws(()=>normalizeMeadowReliefWallTestSource(source+'\n// changed assertion',file));
  assert.throws(()=>normalizeMeadowReliefWallTestSource(prior+'\n// changed original assertion',file));
 }
 const old=JSON.parse(read('tools/fixtures/grass-ribbon-d9b168e/contract.json'));
 assert.equal(Object.keys(old.testAdapterPreimages).length,14);
 assert.equal(JSON.parse(read('tools/fixtures/grass-ribbon-d9b168e/test-adapter-changes.json')).length,38);
 assert.equal(adapters.length,56);
});
test('pure compatibility functions retain actual preceding cache/literal code without eager module cycles',()=>{
 const reviewed=normalizeMeadowReliefWallTestSource(read('tools/reviewed-riding-source-guard.cjs'),'tools/reviewed-riding-source-guard.cjs');
 const ribbon=normalizeMeadowReliefWallTestSource(read('tools/grass-ribbon-source-guard.cjs'),'tools/grass-ribbon-source-guard.cjs');
 assert.equal(functions.cache,reviewed.slice(reviewed.indexOf('function normalizeReviewedCacheSource('),reviewed.indexOf('function normalizeReviewedRuntimeSource(')));
 assert.equal(functions.reverse,ribbon.slice(ribbon.indexOf('function reverseExactGroup('),ribbon.indexOf('// This projection')));
 for(const file of ['ranch3d.html','assets/features/index.js']){
  assert.doesNotThrow(()=>normalizeReviewedWorldSource(read(file),file));
  assert.throws(()=>normalizeReviewedWorldSource(read(file)+'\n// unreviewed rider/controller/auth drift',file));
 }
});

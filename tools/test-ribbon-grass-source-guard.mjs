import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {normalizeGrassRibbonSource as normalizePriorRibbonSource,normalizeGrassRibbonTestSource} from './grass-ribbon-source-guard.cjs';
import {normalizeMeadowReliefWallSource} from './meadow-relief-wall-source-guard.cjs';
const normalizeGrassRibbonSource=(source,file)=>normalizePriorRibbonSource(normalizeMeadowReliefWallSource(source,file),file);
import {normalizeGrassArchSource} from './grass-arch-source-guard.cjs';
import {normalizeProgressionSource,normalizeProgressionGuardSource} from './progression-grass-source-guard.cjs';
const directory=new URL('./fixtures/grass-ribbon-d9b168e/',import.meta.url);
const contract=JSON.parse(fs.readFileSync(new URL('contract.json',directory)));
const changes=JSON.parse(fs.readFileSync(new URL('source-changes.json',directory)));
const read=file=>normalizeProgressionGuardSource(normalizeProgressionSource(normalizeMeadowReliefWallSource(fs.readFileSync(new URL('../'+file,import.meta.url),'utf8'),file),file),file);
const sha=source=>createHash('sha256').update(source).digest('hex');
for(const [file,row]of Object.entries(contract.files))test(`${file}: actual accepted ribbon graph restores the complete d9 body before unchanged earlier guards`,()=>{
 const source=read(file);assert.equal(sha(source),row.candidateSHA256,'Actual source matches the accepted six-file runtime');
 const old=normalizeGrassRibbonSource(source,file);assert.equal(sha(old),row.rawSHA256,'Whole original d9 owner byte is preserved');
 assert.equal(normalizeGrassRibbonSource(old,file),old,'Complete original state is retained exactly');
 assert.throws(()=>normalizeGrassRibbonSource(source+'\n// unreviewed owner drift',file));
 assert.throws(()=>normalizeGrassRibbonSource(old+'\n// unreviewed original drift',file));
 for(const c of changes.filter(c=>c.file===file)){
  assert.equal(source.split(c.after).length,2);
  for(const [reason,candidate]of [
   ['missing accepted literal',source.replace(c.after,'')],
   ['duplicate accepted literal',source+'\n'+c.after],
   ['mixed original and accepted literal',source+'\n'+c.before],
   ['changed accepted literal',source.replace(c.after,c.after+'/*unreviewed*/')],
  ])assert.throws(()=>normalizeGrassRibbonSource(candidate,file),reason);
 }
 const group=changes.filter(c=>c.file===file);
 if(group.length>1)assert.throws(()=>normalizeGrassRibbonSource(source.replace(group[0].after,group[0].before),file),'Partly changed owner group rejected');
});
test('actual parent and six child cache declarations are present once, with no stale or unknown ribbon edge',()=>{
 const imports=changes.filter(c=>c.after.startsWith('import '));assert.equal(imports.length,7);
 for(const c of imports){const source=read(c.file);assert.equal(source.split(c.after).length,2);assert.equal(source.split(c.before).length,1);assert.throws(()=>normalizeGrassRibbonSource(source.replace(c.after,c.after.replace('grass-ribbon-3','unreviewed-ribbon')),c.file));}
});
test('all previously accepted native and camera states preserve every original d5 body hash',()=>{
 const file='ranch3d.html',source=read(file),current="'./assets/game-hero-horse.js?v=fine-hair-20261013c'";
 const d5=JSON.parse(fs.readFileSync(new URL('./fixtures/grass-arch-d5b9441/preimage-SHA.json',import.meta.url)));
 for(const version of ['fine-hair-20261013c','full-groom-20261013c','feather-sway-20261013a','draft-feathers-20261013d']){
  const candidate=source.replace(current,"'./assets/game-hero-horse.js?v="+version+"'");
  assert.equal(sha(normalizeGrassArchSource(candidate,file)),d5[file]);
 }
 const before="'./assets/follow-camera.js?v=riding-stability-1'",after="'./assets/follow-camera.js?v=camera-authored-parts-4'";
 assert.equal(sha(normalizeGrassArchSource(source.replace(after,before),file)),d5[file]);
 for(const [owner,hash]of Object.entries(d5))assert.equal(sha(normalizeGrassArchSource(read(owner),owner)),hash,owner);
});
test('every observer adapter preserves its full d9 source, every old assertion and all old hashes',()=>{
 for(const [file,hash]of Object.entries(contract.testAdapterPreimages)){
  const actual=read(file),original=normalizeGrassRibbonTestSource(actual,file);
  assert.equal(sha(original),hash);assert.equal(normalizeGrassRibbonTestSource(original,file),original);
  assert.throws(()=>normalizeGrassRibbonTestSource(actual+'\n// unrelated assertion drift',file));
  assert.throws(()=>normalizeGrassRibbonTestSource(original+'\n// unrelated original assertion drift',file));
 }
});

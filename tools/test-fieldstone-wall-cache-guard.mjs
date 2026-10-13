import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {normalizeFieldstoneWallCacheSource as normalizeFieldstoneWallSource} from './fieldstone-wall-cache-source-guard.cjs';
import {normalizeGrassRibbonSource,normalizeGrassRibbonTestSource} from './grass-ribbon-source-guard.cjs';
const normalizeFieldstoneWallCacheSource=(source,file)=>normalizeFieldstoneWallSource(normalizeGrassRibbonSource(source,file),file);
import {normalizeGrassArchSource} from './grass-arch-source-guard.cjs';
import {normalizeStarterTackSource} from './starter-tack-source-guard.cjs';
import {normalizeReviewedObserverSource,normalizeReviewedRuntimeSource} from './reviewed-riding-source-guard.cjs';
const contract=JSON.parse(fs.readFileSync(new URL('./fixtures/fieldstone-wall-a78ed79/contract.json',import.meta.url),'utf8'));
const read=file=>normalizeReviewedRuntimeSource(fs.readFileSync(new URL('../'+file,import.meta.url),'utf8'),file);
const sha=source=>createHash('sha256').update(source).digest('hex');
// Keep the complete a78 raw snapshot and six historical published-edge subjects.
// The live source is first checked by the unchanged strict fieldstone guard;
// only these two independently tested, explicitly reviewed cache literals differ.
const priorHairImports=source=>source
 .replace("'./assets/game-hero-horse.js?v=fine-hair-20261013c'","'./assets/game-hero-horse.js?v=full-groom-20261013c'")
 .replace("'./assets/breed-models.js?v=fine-hair-20261013c'","'./assets/breed-models.js?v=world-presentations-1'");
for(const [file,row]of Object.entries(contract.files))test(`${file}: exactly one live fieldstone import reverses to the complete a78 body`,()=>{
 const source=read(file),c=row.change;
 assert.equal(source.split(c.after).length-1,1,'Actual parent/child cache edge is live once');
 assert.equal(source.split(c.before).length-1,0,'No mixed original declaration');
 const original=normalizeFieldstoneWallCacheSource(source,file);
 assert.equal(sha(priorHairImports(original)),row.a78RawSHA256,'Every original a78 owner byte is retained');
 assert.equal(normalizeFieldstoneWallCacheSource(original,file),original,'Exact original state is accepted');
});
for(const [file,row]of Object.entries(contract.files))test(`${file}: unknown, missing, duplicate, mixed, owner and unrelated body changes are rejected`,()=>{
 const source=read(file),c=row.change;
 const unreviewed=c.after.replace(/\?v=[^']+/,'?v=unreviewed-fieldstone-version');
 const otherOwner=c.after.replace(/installCoursedFieldWalls|wPaths|FEATURES/,'unreviewedFieldOwner');
 for(const [reason,candidate]of [
  ['unknown version',source.replace(c.after,unreviewed)],
  ['missing import',source.replace(c.after,'')],
  ['duplicate current import',source+'\n// '+c.after],
  ['mixed original/current import',source+'\n// '+c.before],
  ['changed import owner',source.replace(c.after,otherOwner)],
  ['unrelated owner body drift',source+'\n// unreviewed fieldstone owner body drift'],
 ])assert.throws(()=>normalizeFieldstoneWallCacheSource(candidate,file),reason);
});
test('fieldstone cache normalization preserves the existing four native cache states and exact historical camera state',()=>{
 const file='ranch3d.html',source=read(file),baseline=normalizeFieldstoneWallCacheSource(source,file);
 const current="'./assets/game-hero-horse.js?v=fine-hair-20261013c'";
 const fixture=fs.readFileSync(new URL('./fixtures/starter-tack-2986289/ranch3d.html',import.meta.url),'utf8');
 for(const version of ['fine-hair-20261013c','full-groom-20261013c','feather-sway-20261013a','draft-feathers-20261013d']){
  const literal="'./assets/game-hero-horse.js?v="+version+"'",candidate=source.replace(current,literal);
  assert.equal(normalizeFieldstoneWallCacheSource(candidate,file),baseline.replace(current,literal),'Earlier approved native import survives exactly');
  assert.equal(normalizeStarterTackSource(candidate,file),fixture,'Complete original298 body still restores');
 }
 const after="'./assets/follow-camera.js?v=camera-authored-parts-4'",before="'./assets/follow-camera.js?v=riding-stability-1'";
 assert.equal(source.split(after).length,2);
 assert.equal(normalizeFieldstoneWallCacheSource(source.replace(after,before),file),baseline.replace(after,before));
 const d5=JSON.parse(fs.readFileSync(new URL('./fixtures/grass-arch-d5b9441/preimage-SHA.json',import.meta.url),'utf8'));
 assert.equal(sha(normalizeGrassArchSource(source.replace(after,before),file)),d5[file]);
});
test('new parent suffix preserves all six existing published cache positive and malformed-import contracts',()=>{
 const published=JSON.parse(fs.readFileSync(new URL('./fixtures/published-world-885e882/import-changes.json',import.meta.url),'utf8'));
 for(const c of published.currentChanges){
  // The independent fieldstone gate verifies the actual live source first.
  // Existing six-edge assertions then keep their pre-wall subject verbatim.
  const source=priorHairImports(normalizeFieldstoneWallCacheSource(read(c.file),c.file));
  const expected=fs.readFileSync(new URL('./fixtures/starter-tack-2986289/'+c.file.split('/').at(-1),import.meta.url),'utf8');
  assert.equal(source.split(c.after).length,2);
  assert.equal(normalizeStarterTackSource(source.replace(c.after,c.before),c.file),expected);
  for(const candidate of [source.replace(c.after,c.after.replace(/\?v=[^']+/,'?v=unreviewed-published-version')),source+'\n// '+c.after,source+'\n// '+c.before])assert.throws(()=>normalizeStarterTackSource(candidate,c.file));
 }
});
test('new wall-cache adapter keeps every six d5 grass body hash and four original298 body hash',()=>{
 const d5=JSON.parse(fs.readFileSync(new URL('./fixtures/grass-arch-d5b9441/preimage-SHA.json',import.meta.url),'utf8'));
 for(const [file,hash]of Object.entries(d5))assert.equal(sha(normalizeGrassArchSource(read(file),file)),hash,file);
 for(const file of ['ranch3d.html','assets/features/index.js','assets/tack-collection-models.js','assets/features/on-foot.js']){
  const expected=fs.readFileSync(new URL('./fixtures/starter-tack-2986289/'+file.split('/').at(-1),import.meta.url),'utf8');
  assert.equal(normalizeStarterTackSource(read(file),file),expected,file);
 }
});

test('all current test/guard adapters reverse exactly to their complete a78 source with every original assertion and hash retained',()=>{
 const changes=JSON.parse(fs.readFileSync(new URL('./fixtures/fieldstone-wall-a78ed79/test-adapter-changes.json',import.meta.url),'utf8'));
 for(const [file,hash]of Object.entries(contract.testAdapterPreimages)){
  let source=normalizeReviewedObserverSource(normalizeGrassRibbonTestSource(read(file),file),file);
  for(const c of changes.toReversed().filter(c=>c.file===file)){
   assert.equal(source.split(c.after).length,2,'Only the exact reviewed adapter '+file);
   source=source.replace(c.after,c.before);
  }
  assert.equal(sha(source),hash,'Whole original a78 observer body restored '+file);
 }
});

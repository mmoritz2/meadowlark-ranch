import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {normalizePublishedCacheSource} from './published-world-import-source-guard.cjs';
import {normalizeFieldstoneWallCacheSource} from './fieldstone-wall-cache-source-guard.cjs';
import {normalizeGrassRibbonSource} from './grass-ribbon-source-guard.cjs';
import {normalizeStarterTackSource} from './starter-tack-source-guard.cjs';
const file='ranch3d.html';
const source=normalizeGrassRibbonSource(fs.readFileSync(new URL('../ranch3d.html',import.meta.url),'utf8'),'ranch3d.html');
const expected=fs.readFileSync(new URL('./fixtures/starter-tack-2986289/ranch3d.html',import.meta.url),'utf8');
const hero="'./assets/game-hero-horse.js?v=fine-hair-20261013c'",breed="'./assets/breed-models.js?v=fine-hair-20261013c'";
const heroVersions=['fine-hair-20261013c','full-groom-20261013c','feather-sway-20261013a','draft-feathers-20261013d'];
const breedVersions=['fine-hair-20261013c','world-presentations-1'];
test('both exact fine-hair imports are live once and restore the unchanged complete world preimage',()=>{
 for(const literal of [hero,breed])assert.equal(source.split(literal).length-1,1,literal);
 assert.equal(normalizeStarterTackSource(source,file),expected);
});
test('all eight reviewed controller/library cache combinations retain the same complete source body',()=>{
 for(const h of heroVersions)for(const b of breedVersions){
  const candidate=source.replace(hero,"'./assets/game-hero-horse.js?v="+h+"'").replace(breed,"'./assets/breed-models.js?v="+b+"'");
  assert.doesNotThrow(()=>normalizeFieldstoneWallCacheSource(candidate,file));
  assert.equal(normalizeStarterTackSource(candidate,file),expected,h+' / '+b);
 }
});
test('each fine-hair cache rejects missing, unknown, duplicate and mixed approved literals',()=>{
 for(const [current,path,versions]of [[hero,'game-hero-horse.js',heroVersions],[breed,'breed-models.js',breedVersions]]){
  const unknown=current.replace('fine-hair-20261013c','fine-hair-unreviewed');
  for(const candidate of [source.replace(current,''),source.replace(current,unknown),source+'\n// duplicate '+current]){
   assert.throws(()=>normalizePublishedCacheSource(candidate,file));
   assert.throws(()=>normalizeStarterTackSource(candidate,file));
  }
  for(const version of versions.filter(v=>v!=='fine-hair-20261013c')){
   const candidate=source+'\n// mixed '+"'./assets/"+path+'?v='+version+"'";
   assert.throws(()=>normalizePublishedCacheSource(candidate,file));
   assert.throws(()=>normalizeStarterTackSource(candidate,file));
  }
 }
});
test('cache approval cannot hide a changed owner, unrelated source, or a new query suffix',()=>{
 for(const candidate of [
  source.replace('import {createBreedLibrary}', 'import {createUnreviewedBreedLibrary}'),
  source.replace('import {initGameHero,artistGroomFacade','import {unreviewedGameHero,artistGroomFacade'),
  source+'\n// unrelated world source change',
  source.replace(breed,breed.slice(0,-1)+"&extra=1'"),
 ])assert.throws(()=>normalizeStarterTackSource(candidate,file));
});

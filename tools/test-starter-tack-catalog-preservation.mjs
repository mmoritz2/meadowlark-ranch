import {normalizeReviewedRuntimeSource} from './reviewed-riding-source-guard.cjs';
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createHash} from 'node:crypto';
import {T,ROOT,nativeActor,stream} from './native-starter-tack-fixture.mjs';
import {createTackCollection} from '../assets/tack-collection-models.js';
import {TACK_PIECES,getTackPiece} from '../assets/tack-collection.mjs';
import {normalizeStarterTackSource} from './starter-tack-source-guard.cjs';
import {normalizeFieldstoneWallCacheSource as normalizeFieldstoneWallSource} from './fieldstone-wall-cache-source-guard.cjs';
import {normalizeGrassRibbonSource,normalizeGrassRibbonTestSource} from './grass-ribbon-source-guard.cjs';
const normalizeFieldstoneWallCacheSource=(source,file)=>normalizeFieldstoneWallSource(normalizeGrassRibbonSource(source,file),file);
const fixture=new URL('./fixtures/starter-tack-2986289/',import.meta.url),originalText=fs.readFileSync(new URL('tack-collection-models.js',fixture),'utf8'),sha=x=>createHash('sha256').update(x).digest('hex'),original=await import('data:text/javascript;base64,'+Buffer.from(originalText.replace("'./native-rider.js?v=tack-store-live-20261007'",JSON.stringify(new URL('../assets/native-rider.js?v=tack-store-live-20261007',import.meta.url).href))).toString('base64'));
const snapshot=kit=>{const rows=[];kit.group.traverse(m=>{if(!m.isMesh)return;rows.push({name:m.name,uuid:m.uuid,geometryUUID:m.geometry.uuid,attributes:Object.fromEntries(Object.entries(m.geometry.attributes).map(([key,a])=>[key,sha(Buffer.from(a.array.buffer,a.array.byteOffset,a.array.byteLength))])),index:sha(Buffer.from(m.geometry.index.array.buffer)),material:{uuid:m.material.uuid,color:m.material.color.toArray(),roughness:m.material.roughness,metalness:m.material.metalness,key:m.material.customProgramCacheKey(),maps:['map','bumpMap'].map(k=>m.material[k]?sha(m.material[k].image.data):null)}});});return{rows,stats:structuredClone(kit.stats)};};
test('already-equipped original catalog collections retain exact geometry, maps, UUIDs, costs and future random stream',()=>{
 for(const theme of ['moonpetal','classicwestern']){const designs=Object.fromEntries(TACK_PIECES.filter(p=>p.collectionId===theme).map(p=>[p.slot,p])),a=nativeActor(),b=nativeActor(),before=stream(()=>original.createTackCollection({THREE:T,rig:a.rig,mount:a.mount,equippedDesigns:designs})),after=stream(()=>createTackCollection({THREE:T,rig:b.rig,mount:b.mount,equippedDesigns:designs}));assert.equal(after.calls,before.calls,theme);assert.deepEqual(after.future,before.future,theme);assert.deepEqual(snapshot(after.value),snapshot(before.value),theme);before.value.dispose();after.value.dispose();}
});
test('source preimage adapters keep prior explicit-equipment contracts meaningful and reject any unrelated change',()=>{
 for(const file of ['ranch3d.html','assets/tack-collection-models.js','assets/features/on-foot.js','assets/features/index.js']){const source=fs.readFileSync(ROOT+'/'+file,'utf8'),expected=fs.readFileSync(new URL(file.split('/').at(-1),fixture),'utf8');assert.equal(normalizeStarterTackSource(source,file),expected);assert.throws(()=>normalizeStarterTackSource(source+'\n// unreviewed drift',file),/Entire original298 body/);}
 assert.equal(getTackPiece('ranch_basic_saddle'),null);assert.equal(getTackPiece('ranch_basic_pad'),null);assert.equal(getTackPiece('ranch_basic_bridle'),null);
});

// Each declared cache is checked independently of the adapter's table. A version
// change may pass only if all remaining source bytes restore the pinned fixture.
test('only exact reviewed cache edges are accepted; unknown, duplicate, mixed and import-owner mutations fail',()=>{
 const edges=[
  ['ranch3d.html',"'./assets/game-hero-horse.js?v=fine-hair-20261013c'","'./assets/game-hero-horse.js?v=draft-feathers-20261013d'"],
  ['ranch3d.html',"import {FEATURES} from './assets/features/index.js?v=story-events-1-starter-tack-2';","import {FEATURES} from './assets/features/index.js?v=starter-tack-2';"],
  ['assets/features/index.js',"import * as storyGuidance from './story-guidance.js?v=story-witness-1';","import * as storyGuidance from './story-guidance.js?v=ranch-rush-1';"],
  ['assets/features/index.js',"import * as seFrame from './se-frame.js?v=story-events-20261013';","import * as seFrame from './se-frame.js?v=horse-actions-20261009';"],
  ['assets/features/index.js',"import * as seEvents from './se-events.js?v=horse-choice-1';","import * as seEvents from './se-events.js?v=event-training-1';"],
  ['assets/features/index.js',"import * as riderJourneyUI from './rider-journey-ui.js?v=journey-story-1';","import * as riderJourneyUI from './rider-journey-ui.js?v=rider-journey-1';"]
 ];
 for(const [file,after,before]of edges){
  const source=normalizeFieldstoneWallCacheSource(normalizeReviewedRuntimeSource(fs.readFileSync(ROOT+'/'+file,'utf8'),file),file),expected=fs.readFileSync(new URL(file.split('/').at(-1),fixture),'utf8');
  assert.equal(source.split(after).length-1,1,'Live reviewed import exists: '+after);
  assert.equal(normalizeStarterTackSource(source.replace(after,before),file),expected,'The historical cache also retains the same original body');
  assert.throws(()=>normalizeStarterTackSource(source.replace(after,after.replace(/\?v=[^']+/,'?v=unreviewed-version')),file),'Unknown cache is not stripped');
  assert.throws(()=>normalizeStarterTackSource(source+'\n// duplicate '+after,file),'Duplicate approved import cannot be normalized');
  assert.throws(()=>normalizeStarterTackSource(source+'\n// mixed '+before,file),'Mixed version declarations cannot be normalized');
  if(after.startsWith('import '))assert.throws(()=>normalizeStarterTackSource(source.replace(after,after.replace(/FEATURES|storyGuidance|seFrame|seEvents|riderJourneyUI/,'unreviewedOwner')),file),'Changing an import owner is not a cache edge');
 }
});

test('published native-groom cache chain accepts all four reviewed states and rejects an unknown next version or mixed history',()=>{
 const file='ranch3d.html',source=normalizeFieldstoneWallCacheSource(normalizeReviewedRuntimeSource(fs.readFileSync(ROOT+'/'+file,'utf8'),file),file),expected=fs.readFileSync(new URL(file,fixture),'utf8');
 const latest="'./assets/game-hero-horse.js?v=fine-hair-20261013c'",versions=['fine-hair-20261013c','full-groom-20261013c','feather-sway-20261013a','draft-feathers-20261013d'];
 assert.equal(source.split(latest).length-1,1);
 for(const version of versions){
  const literal="'./assets/game-hero-horse.js?v="+version+"'",candidate=source.replace(latest,literal);
  assert.equal(normalizeStarterTackSource(candidate,file),expected,'Known exact native cache '+version);
  for(const other of versions.filter(v=>v!==version))assert.throws(()=>normalizeStarterTackSource(candidate+"\n// mixed './assets/game-hero-horse.js?v="+other+"'",file),'Mixed reviewed native versions fail before whole-body comparison');
 }
 assert.throws(()=>normalizeStarterTackSource(source.replace(latest,"'./assets/game-hero-horse.js?v=full-groom-20261013d'"),file),'The next unreviewed cache cannot inherit approval');
});

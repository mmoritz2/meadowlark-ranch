import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {normalizeProgrammeRegroupSource,normalizeProgrammeRegroupObserverSource,normalizeProgrammeRegroupAuditSource,assertProgrammeRegroupCurrentSource,normalizeProgrammeRegroupFixtureChanges} from './programme-regroup-source-guard.cjs';
import {normalizeHorseTrainingSource,normalizeHorseTrainingObserverSource} from './horse-training-source-guard.cjs';
import {normalizeActivityIncomingSource,normalizeActivityParentSource,normalizeActivityIncomingObserverSource,normalizeActivityFixtureChanges} from './activity-landscape-source-guard.cjs';
import {normalizeReviewedWorldSource} from './reviewed-riding-source-guard.cjs';
import {normalizeStarterTackSource} from './starter-tack-source-guard.cjs';
const root=new URL('../',import.meta.url),read=file=>fs.readFileSync(new URL(file,root),'utf8');
const fixture='tools/fixtures/programme-regroup-05421c6/contract.json',contract=JSON.parse(read(fixture));
const sha=value=>createHash('sha256').update(value).digest('hex');
const git=file=>execFileSync('git',['show',contract.baseline+':'+file],{cwd:root,encoding:'utf8'});
function authored(before,changes){for(const c of changes){assert.equal(c.occurrences,1);assert.equal(before.split(c.before).length-1,1,'Unique independently authored old literal');before=before.replace(c.before,c.after);}return before;}
function rejectsCurrent(source,file,normalize,rows){
 assert.throws(()=>assertProgrammeRegroupCurrentSource(source,file));
 if(rows.some(c=>c.file===file&&source.includes(c.after)))assert.throws(()=>normalize(source,file));
 else{
  // The no-marker historical path does not approve current malformed input.
  // It neither strips that damage nor becomes the exact supported old source.
  assert.equal(normalize(source,file),source);
  assert.notEqual(sha(source),(contract.files[file]||contract.observers[file]).beforeSHA256);
 }
}
test('all ten current owners are independently authored from complete05421 Git sources',()=>{
 assert.equal(contract.baseline,'05421c6a68a0f0914607ee4b50d5490dff3fa4de');assert.equal(Object.keys(contract.files).length,10);
 for(const [file,row]of Object.entries(contract.files)){
  const before=git(file),live=read(file);assert.equal(sha(before),row.beforeSHA256);assert.equal(sha(live),row.afterSHA256);
  assert.equal(authored(before,contract.changes.filter(c=>c.file===file)),live,'Raw Git forward construction is independent of the projection oracle');
  assert.equal(normalizeProgrammeRegroupSource(live,file),before);assert.equal(normalizeProgrammeRegroupSource(before,file),before);assert.equal(assertProgrammeRegroupCurrentSource(live,file),true);
 }
});
test('exact nine cache owners preserve the published import graph and reject unknown/mixed/duplicate/deleted imports',()=>{
 const caches=contract.changes.filter(c=>c.kind==='cache');assert.equal(caches.length,9);
 const owners=new Set(['ranch3d.html:FEATURES','assets/features/index.js:course','assets/features/index.js:ev2disc','assets/features/index.js:ev2ladder','assets/features/index.js:ui2compete','assets/features/index.js:seEvents','assets/features/index.js:clubRides','assets/features/index.js:clubhouseUI','assets/features/clubhouse-ui.js:createClubSocialView']);
 for(const c of caches){
  const match=c.after.match(/import \{(\w+)\}|import \* as (\w+)/);assert(match);assert(owners.delete(c.file+':'+(match[1]||match[2])),c.after);assert(c.after.includes('?v=programme-club-regroup-1'));
  const live=read(c.file);
  for(const bad of [live.replace(c.after,''),live+'\n'+c.after,live+'\n'+c.before,live.replace(c.after,c.after.replace(/\?v=[^']+/,'?v=unknown-next')),live.replace(c.after,c.after.replace(match[1]||match[2],'unknownOwner'))]){
   rejectsCurrent(bad,c.file,normalizeProgrammeRegroupSource,contract.changes);
   if(c.file==='ranch3d.html'||c.file==='assets/features/index.js'){assert.throws(()=>normalizeReviewedWorldSource(bad,c.file));assert.throws(()=>normalizeStarterTackSource(bad,c.file));}
  }
 }
 assert.equal(owners.size,0);
 const rides=read('assets/features/club-rides.js'),view=read('assets/club-social-view.js');
 assert.match(rides,/import \{REGROUP_MODE,REGROUP_ROUTE,isRegroupRoute,regroupState\} from '\.\.\/club-regroup-rules\.mjs\?v=club-regroup-1'/);assert.match(rides,/from '\.\.\/club-regroup\.mjs\?v=club-regroup-1'/);assert.match(view,/assets\/club-regroup\.css\?v=club-regroup-1/);
});
test('partial preparation/regroup changes and unrelated identity, rewards, actor or world drift cannot become approved source',()=>{
 assert.equal(contract.changes.filter(c=>c.kind==='runtime').length,27);
 for(const c of contract.changes.filter(c=>c.kind==='runtime')){
  const live=read(c.file);for(const bad of [live.replace(c.after,''),live+'\n'+c.after,live.replace(c.after,c.after+'/* unauthorized */')])rejectsCurrent(bad,c.file,normalizeProgrammeRegroupSource,contract.changes);
 }
 for(const file of Object.keys(contract.files)){
  const bad=read(file)+'\n// unrelated authorization/horse/rig/currency/geography change';assert.throws(()=>assertProgrammeRegroupCurrentSource(bad,file));assert.throws(()=>normalizeProgrammeRegroupSource(bad,file));
 }
});
test('all prior training, landscape, starter-tack and whole-world views receive exact05421 inputs',()=>{
 for(const file of ['ranch3d.html','assets/features/index.js','assets/features/se-events.js']){
  const live=read(file),before=git(file);assert.equal(normalizeHorseTrainingSource(normalizeProgrammeRegroupSource(live,file),file),normalizeHorseTrainingSource(before,file));
  assert.equal(normalizeActivityIncomingSource(live,file),normalizeActivityIncomingSource(before,file));assert.equal(normalizeActivityParentSource(live,file),normalizeActivityParentSource(before,file));
  assert.equal(normalizeReviewedWorldSource(live,file),normalizeReviewedWorldSource(before,file));assert.equal(normalizeStarterTackSource(live,file),normalizeStarterTackSource(before,file));
 }
});
test('three read adapters restore complete original observer assertions instead of repinning selected literals',()=>{
 assert.equal(Object.keys(contract.observers).length,3);
 for(const [file,row]of Object.entries(contract.observers)){
  const before=git(file),live=read(file);assert.equal(sha(before),row.beforeSHA256);assert.equal(sha(live),row.afterSHA256);
  assert.equal(authored(before,row.changes),live);assert.equal(normalizeProgrammeRegroupObserverSource(live,file),before);assert.equal(normalizeProgrammeRegroupObserverSource(before,file),before);
  assert.equal(normalizeHorseTrainingObserverSource(normalizeProgrammeRegroupObserverSource(live,file),file),normalizeHorseTrainingObserverSource(before,file));
  assert.equal(normalizeActivityIncomingObserverSource(live,file),normalizeActivityIncomingObserverSource(before,file));
  for(const bad of [live+'\n// altered old assertion',live.replace(row.changes[0].after,''),live+'\n'+row.changes[0].after])rejectsCurrent(bad,file,normalizeProgrammeRegroupObserverSource,row.changes);
 }
 for(const file of ['tools/horse-training-source-guard.cjs','tools/run-reviewed-world-guards.mjs','tools/coyote-crag-composition-source-guard.cjs','tools/published-world-import-source-guard.cjs','tools/authored-camera-source-guard.cjs','tools/riding-distance-source-guard.cjs','tools/ribbon-award-source-guard.cjs','tools/grass-arch-source-guard.cjs'])assert.equal(read(file),git(file),file+' entire prior body unchanged');
});
test('all165 old fixture blobs remain raw byte-exact; only the exact named new declaration leaves older fixture assertions',()=>{
 const rows=execFileSync('git',['ls-tree','-r','--format=%(objectname) %(path)',contract.baseline,'tools/fixtures'],{cwd:root,encoding:'utf8'}).trim().split('\n');assert.equal(rows.length,165);assert.equal(contract.unchangedFixtureCount,165);
 for(const row of rows){const at=row.indexOf(' '),expected=row.slice(0,at),file=row.slice(at+1),bytes=fs.readFileSync(new URL(file,root));assert.equal(createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex'),expected,file+' raw fixture blob');}
 assert.equal(normalizeProgrammeRegroupFixtureChanges(fixture+'\n'),'');assert.equal(normalizeActivityFixtureChanges(fixture+'\n','df065bd26a6a0e097306262e689678cb9e439c7d'),'');
 for(const unknown of ['tools/fixtures/unreviewed/contract.json','tools/fixtures/horse-training-dc405f3/contract.json'])assert.equal(normalizeProgrammeRegroupFixtureChanges(unknown+'\n'),unknown+'\n');
 assert.throws(()=>normalizeProgrammeRegroupFixtureChanges(fixture+'\n'+fixture+'\n'));
});
test('new helper/CSS and live behavior tests are exact strict additions, not older behavior projections',()=>{
 const product=['assets/club-regroup-rules.mjs','assets/club-regroup.mjs','assets/club-regroup.css'];
 const behavior=['tools/test-club-regroup.mjs','tools/test-club-regroup-ui.mjs','tools/test-programme-horse-preparation.mjs','tools/test-first-rides-h1-input.mjs'];
 assert.deepEqual(Object.keys(contract.addedFiles),[...product,...behavior]);
 for(const [file,row]of Object.entries(contract.addedFiles)){
  const source=read(file);assert.equal(row.kind,product.includes(file)?'product':'behavior');assert.equal(sha(source),row.sha256);assert.equal(assertProgrammeRegroupCurrentSource(source,file),true);assert.throws(()=>assertProgrammeRegroupCurrentSource(source+'\n// drift',file));
  assert.equal(normalizeProgrammeRegroupAuditSource(source,file),source,'new behavior executes live source');
  assert.equal(execFileSync('git',['ls-tree','-r','--name-only',contract.baseline,file],{cwd:root,encoding:'utf8'}),'','addition was absent at baseline');
 }
});
test('new fixture edits or absence are rejected without altering any earlier contract pin',()=>{
 const leaf=read('tools/programme-regroup-source-guard.cjs'),moduleDir=path.join(fileURLToPath(root),'tools');
 function load(data){const module={exports:{}};new Function('require','module','exports','__dirname',leaf)(name=>name==='node:fs'?{...fs,readFileSync(file,...args){if(String(file).endsWith(fixture)){if(data===null)throw Error('Missing declaration');return data;}return fs.readFileSync(file,...args);}}:name==='node:path'?path:name==='node:assert/strict'?assert:name==='node:crypto'?{createHash}:null,module,module.exports,moduleDir);return module.exports;}
 assert.doesNotThrow(()=>load(read(fixture)));assert.throws(()=>load(read(fixture)+'\n'),/Exact reviewed/);assert.throws(()=>load(read(fixture).replace('05421c6','unknown')),/Exact reviewed/);assert.throws(()=>load(null),/Missing declaration/);
 const leafRequire=[...leaf.matchAll(/require\('([^']+)'\)/g)].map(m=>m[1]);assert.deepEqual(leafRequire,['node:fs','node:path','node:assert/strict','node:crypto']);
 const adapted=read('tools/activity-landscape-source-guard.cjs');assert(adapted.indexOf('source=normalizeProgrammeRegroupSource')<adapted.indexOf('source=normalizeHorseTrainingSource'));
 assert.equal(normalizeProgrammeRegroupAuditSource('untouched horse/model','assets/game-hero-horse.js'),'untouched horse/model');assert.equal(normalizeProgrammeRegroupAuditSource('native store','mobile/src/save-store.mjs'),'native store');
});

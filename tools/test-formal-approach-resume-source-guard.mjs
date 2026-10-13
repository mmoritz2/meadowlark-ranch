import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {normalizeFormalApproachResumeSource,normalizeFormalApproachResumeObserverSource,normalizeFormalApproachResumeAuditSource,assertFormalApproachResumeCurrentSource,normalizeFormalApproachResumeFixtureChanges} from './formal-approach-resume-source-guard.cjs';
import {normalizeProgrammeRegroupSource,normalizeProgrammeRegroupObserverSource} from './programme-regroup-source-guard.cjs';
import {normalizeActivityIncomingSource,normalizeActivityParentSource,normalizeActivityIncomingObserverSource,normalizeActivityFixtureChanges} from './activity-landscape-source-guard.cjs';
import {normalizeReviewedWorldSource,normalizeReviewedGuideSource} from './reviewed-riding-source-guard.cjs';
import {normalizeStarterTackSource} from './starter-tack-source-guard.cjs';
const root=new URL('../',import.meta.url),read=file=>fs.readFileSync(new URL(file,root),'utf8');
const fixture='tools/fixtures/formal-approach-resume-5e173bf/contract.json',contract=JSON.parse(read(fixture));
const sha=value=>createHash('sha256').update(value).digest('hex');
const git=file=>execFileSync('git',['show',contract.baseline+':'+file],{cwd:root,encoding:'utf8'});
function authored(before,changes){for(const c of changes){assert.equal(c.occurrences,1);assert.equal(before.split(c.before).length-1,1,'Unique raw Git old literal');before=before.replace(c.before,c.after);}return before;}
function rejectsCurrent(source,file,normalize,rows){
 assert.throws(()=>assertFormalApproachResumeCurrentSource(source,file));
 if(rows.some(c=>c.file===file&&source.includes(c.after)))assert.throws(()=>normalize(source,file));
 else{assert.equal(normalize(source,file),source,'historical no-marker path does not strip current damage');assert.notEqual(sha(source),(contract.files[file]||contract.observers[file]).beforeSHA256);}
}
test('four product and three QA owners are independently authored from whole5e173 Git preimages',()=>{
 assert.equal(contract.baseline,'5e173bf0e0077058c96e9b6c147b25cdcdcd0ffa');assert.equal(Object.keys(contract.files).length,7);assert.equal(Object.values(contract.files).filter(r=>r.kind==='product').length,4);
 for(const [file,row]of Object.entries(contract.files)){
  const before=git(file),live=read(file);assert.equal(sha(before),row.beforeSHA256);assert.equal(sha(live),row.afterSHA256);
  assert.equal(authored(before,contract.changes.filter(c=>c.file===file)),live,'Forward expected source is independent of projection');assert.equal(normalizeFormalApproachResumeSource(live,file),before);assert.equal(normalizeFormalApproachResumeSource(before,file),before);assert.equal(assertFormalApproachResumeCurrentSource(live,file),true);
 }
});
test('only three product cache edges change and unknown, mixed, duplicate or absent versions cannot pass',()=>{
 const edges=contract.changes.filter(c=>c.kind==='cache');assert.equal(edges.length,3);const owners=new Set(['ranch3d.html:FEATURES','assets/features/index.js:clubRides','assets/features/index.js:courseGuide']);
 for(const c of edges){const m=c.after.match(/import \{(\w+)\}|import \* as (\w+)/);assert(m);assert(owners.delete(c.file+':'+(m[1]||m[2])));assert(c.after.includes('?v=formal-approach-resume-1'));
  const live=read(c.file);for(const bad of [live.replace(c.after,''),live+'\n'+c.after,live+'\n'+c.before,live.replace(c.after,c.after.replace(/\?v=[^']+/,'?v=unknown-next')),live.replace(c.after,c.after.replace(m[1]||m[2],'unknownOwner'))]){
   rejectsCurrent(bad,c.file,normalizeFormalApproachResumeSource,contract.changes);assert.throws(()=>normalizeReviewedWorldSource(bad,c.file));assert.throws(()=>normalizeStarterTackSource(bad,c.file));
  }
 }
 assert.equal(owners.size,0);
 for(const file of ['ranch3d.html','assets/features/index.js']){assert.equal(authored(git(file),edges.filter(c=>c.file===file)),read(file),'Core/world/horse/reward/feature bodies unchanged beyond the three precise imports');assert.equal(contract.changes.filter(c=>c.file===file&&c.kind!=='cache').length,0);}
});
test('partial formal, reconnect or QA changes cannot erase unrelated actor, identity, reward or geometry drift',()=>{
 assert.equal(contract.changes.filter(c=>c.kind==='runtime').length,13);assert.equal(contract.changes.filter(c=>c.kind==='qa').length,5);
 for(const c of contract.changes.filter(c=>c.kind!=='cache')){const live=read(c.file);for(const bad of [live.replace(c.after,''),live+'\n'+c.after,live.replace(c.after,c.after+'/* unauthorized */')])rejectsCurrent(bad,c.file,normalizeFormalApproachResumeSource,contract.changes);}
 for(const file of Object.keys(contract.files))assert.throws(()=>assertFormalApproachResumeCurrentSource(read(file)+'\n// unrelated source change',file));
});
test('all older programme, landscape, world, tack and guide checks receive exact5e173 inputs',()=>{
 for(const file of ['ranch3d.html','assets/features/index.js','assets/features/club-rides.js']){
  const live=read(file),before=git(file);assert.equal(normalizeProgrammeRegroupSource(normalizeFormalApproachResumeSource(live,file),file),normalizeProgrammeRegroupSource(before,file));assert.equal(normalizeActivityIncomingSource(live,file),normalizeActivityIncomingSource(before,file));assert.equal(normalizeActivityParentSource(live,file),normalizeActivityParentSource(before,file));assert.equal(normalizeReviewedWorldSource(live,file),normalizeReviewedWorldSource(before,file));assert.equal(normalizeStarterTackSource(live,file),normalizeStarterTackSource(before,file));
 }
 const file='assets/features/course-guide.js';assert.equal(normalizeReviewedGuideSource(normalizeFormalApproachResumeSource(read(file),file),file),normalizeReviewedGuideSource(git(file),file),'Original camera/flat-guide full-body pin still decides unchanged prior source');
});
test('nine exact observer/behavior-metadata maps preserve old assertion bodies and strict current live hashes',()=>{
 assert.equal(Object.keys(contract.observers).length,9);
 for(const [file,row]of Object.entries(contract.observers)){
  const live=read(file),before=git(file);assert.equal(sha(live),row.afterSHA256);assert.equal(sha(before),row.beforeSHA256);assert.equal(authored(before,row.changes),live);assert.equal(normalizeFormalApproachResumeObserverSource(live,file),before);assert.equal(normalizeFormalApproachResumeObserverSource(before,file),before);assert.equal(assertFormalApproachResumeCurrentSource(live,file),true);
  assert.equal(normalizeProgrammeRegroupObserverSource(normalizeFormalApproachResumeObserverSource(live,file),file),normalizeProgrammeRegroupObserverSource(before,file));assert.equal(normalizeActivityIncomingObserverSource(live,file),normalizeActivityIncomingObserverSource(before,file));
  for(const bad of [live+'\n// changed assertion',live.replace(row.changes[0].after,''),live+'\n'+row.changes[0].after])rejectsCurrent(bad,file,normalizeFormalApproachResumeObserverSource,row.changes);
 }
 for(const file of ['tools/programme-regroup-source-guard.cjs','tools/horse-training-source-guard.cjs','tools/reviewed-riding-source-guard.cjs','tools/coyote-crag-composition-source-guard.cjs','tools/published-world-import-source-guard.cjs','tools/authored-camera-source-guard.cjs','tools/riding-distance-source-guard.cjs','tools/ribbon-award-source-guard.cjs','tools/grass-arch-source-guard.cjs'])assert.equal(read(file),git(file),file+' entire older pinned guard unchanged');
});
test('166 raw old fixture blobs are unchanged and only the exact one new fixture leaves older diff assertions',()=>{
 const rows=execFileSync('git',['ls-tree','-r','--format=%(objectname) %(path)',contract.baseline,'tools/fixtures'],{cwd:root,encoding:'utf8'}).trim().split('\n');assert.equal(rows.length,166);assert.equal(contract.unchangedFixtureCount,166);
 for(const row of rows){const at=row.indexOf(' '),expected=row.slice(0,at),file=row.slice(at+1),bytes=fs.readFileSync(new URL(file,root));assert.equal(createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex'),expected,file+' raw Git fixture blob');}
 assert.equal(normalizeFormalApproachResumeFixtureChanges(fixture+'\n'),'');assert.equal(normalizeActivityFixtureChanges(fixture+'\n','df065bd26a6a0e097306262e689678cb9e439c7d'),'');
 for(const file of ['tools/fixtures/unknown/contract.json','tools/fixtures/programme-regroup-05421c6/contract.json'])assert.equal(normalizeFormalApproachResumeFixtureChanges(file+'\n'),file+'\n');assert.throws(()=>normalizeFormalApproachResumeFixtureChanges(fixture+'\n'+fixture+'\n'));
});
test('new helper/test stay live exact additions; updated live behavior and fixture dependency retain all prior assertions',()=>{
 assert.deepEqual(Object.keys(contract.addedFiles),['assets/formal-fence-guidance.mjs','tools/test-formal-fence-guidance.mjs']);
 for(const [file,row]of Object.entries(contract.addedFiles)){const live=read(file);assert.equal(sha(live),row.sha256);assert.equal(assertFormalApproachResumeCurrentSource(live,file),true);assert.throws(()=>assertFormalApproachResumeCurrentSource(live+'\n// drift',file));assert.equal(normalizeFormalApproachResumeAuditSource(live,file),live);assert.equal(execFileSync('git',['ls-tree','-r','--name-only',contract.baseline,file],{cwd:root,encoding:'utf8'}),'');}
 const live=['tools/test-flat-race-guidance.mjs','tools/test-club-regroup.mjs','tools/test-first-rides-h1-input.mjs'];assert.deepEqual(Object.entries(contract.observers).filter(([,v])=>v.kind==='live-behavior').map(([k])=>k),live);
 // Only older preservation metadata readers see those full preimages. The
 // actual test modules have no tools projection import and run live production.
 for(const file of live)assert.doesNotMatch(read(file),/import .*source-guard|normalizeFormalApproachResume/);
 const flat=read(live[0]),before=git(live[0]),assertions=s=>s.split('\n').filter(line=>/\bassert[.(]/.test(line));assert.deepEqual(assertions(flat),assertions(before),'Every original flat-guidance assertion is byte-exact');assert(flat.includes('binding+\'return formalGuide;\''));assert(flat.includes("Function('G','player','flatGuide','fenceRecovery','formalGuide'"));
 for(const page of ['review/first-rides/index.html','review/first-rides/native-preview.html'])assert(read(page).includes('review.js?v=h1-formal-input-3'));
});
test('fixture CRC, leaf architecture, old-runner guide copy and projection order retain all prior hash authorities',()=>{
 const leaf=read('tools/formal-approach-resume-source-guard.cjs'),dir=path.join(fileURLToPath(root),'tools');
 function load(data){const module={exports:{}};new Function('require','module','exports','__dirname',leaf)(name=>name==='node:fs'?{...fs,readFileSync(file,...args){if(String(file).endsWith(fixture)){if(data===null)throw Error('Missing declaration');return data;}return fs.readFileSync(file,...args);}}:name==='node:path'?path:name==='node:assert/strict'?assert:name==='node:crypto'?{createHash}:null,module,module.exports,dir);return module.exports;}
 assert.doesNotThrow(()=>load(read(fixture)));assert.throws(()=>load(read(fixture)+'\n'),/Exact reviewed/);assert.throws(()=>load(null),/Missing declaration/);assert.deepEqual([...leaf.matchAll(/require\('([^']+)'\)/g)].map(m=>m[1]),['node:fs','node:path','node:assert/strict','node:crypto']);
 const adapted=read('tools/activity-landscape-source-guard.cjs');assert(adapted.indexOf('source=normalizeFormalApproachResumeSource')<adapted.indexOf('source=normalizeProgrammeRegroupSource'));assert(read('tools/run-reviewed-world-guards.mjs').includes("normalizeReviewedGuideSource(normalizeFormalApproachResumeSource(readFileSync(src,'utf8'),name),name)"));
 assert.equal(normalizeFormalApproachResumeAuditSource('untouched skeleton','assets/native-horse-motion.js'),'untouched skeleton');
});

import {normalizeFormalTurfFormalAuditSource} from './formal-turf-composition-source-guard.cjs';
import {normalizeFormalApproachResumeAuditSource} from './formal-approach-resume-source-guard.cjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {normalizeLashCacheSource} from './lash-cache-source-guard.cjs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {normalizeReviewedRuntimeSource,normalizeReviewedWorldSource,normalizeReviewedObserverSource,normalizeReviewedGuideSource} from './reviewed-riding-source-guard.cjs';
import {normalizeProgressionLoopCacheSource} from './progression-loop-cache-source-guard.cjs';
import {normalizeStarterTackSource} from './starter-tack-source-guard.cjs';
import {normalizeGrassRibbonOwnSource as normalizePriorRibbonOwnSource,normalizeGrassRibbonTestSource} from './grass-ribbon-source-guard.cjs';
import {normalizeMeadowReliefWallSource} from './meadow-relief-wall-source-guard.cjs';
const normalizeGrassRibbonOwnSource=(source,file)=>normalizePriorRibbonOwnSource(normalizeMeadowReliefWallSource(source,file),file);
const root=new URL('../',import.meta.url),fixture=new URL('./fixtures/reviewed-riding-4e346b2/',import.meta.url);
const read=file=>{const source=normalizeLashCacheSource(normalizeMeadowReliefWallSource(normalizeFormalApproachResumeAuditSource(normalizeFormalTurfFormalAuditSource(fs.readFileSync(new URL(file,root),'utf8'),file),file),file),file);return file==='ranch3d.html'||file==='assets/features/index.js'?normalizeGrassRibbonOwnSource(source,file):normalizeGrassRibbonTestSource(source,file);},sha=s=>createHash('sha256').update(s).digest('hex');
const contract=JSON.parse(fs.readFileSync(new URL('contract.json',fixture))),edges=JSON.parse(fs.readFileSync(new URL('cache-changes.json',fixture)));
const git=(ref,file)=>execFileSync('git',['show',ref+':'+file],{cwd:root,encoding:'utf8'});

test('merged live runtime projects to every exact incoming world owner byte with native hair, grass, camera and fieldstone imports retained',()=>{
 for(const file of ['ranch3d.html','assets/features/index.js'])assert.equal(normalizeReviewedRuntimeSource(read(file),file),git(contract.incomingCommit,file));
 const current=normalizeProgressionLoopCacheSource(read('ranch3d.html'),'ranch3d.html');for(const tag of ['fine-hair-20261013c','grass-arch-2','camera-authored-parts-4','physical-ride-2-starter-tack-2-fieldstone-walls-3'])assert(current.includes(tag));
});
test('original pinned landscape/camera/crag guards remain exact, without dependency fixture or legacy source changes',()=>{
 for(const [file,hash]of Object.entries(contract.protectedGuardSHA256)){assert.equal(sha(read(file)),hash);assert.equal(read(file),git(contract.incomingCommit,file));}
 const files=['tools/fixtures/fieldstone-wall-a78ed79/contract.json','tools/fixtures/fieldstone-wall-a78ed79/test-adapter-changes.json','tools/fixtures/grass-arch-d5b9441/preimage-SHA.json','tools/fixtures/published-world-885e882/import-changes.json','tools/fixtures/coyote-crag-7009c41/source-changes.json','tools/fixtures/starter-tack-2986289/preimage-SHA.json'];
 for(const file of files)assert.equal(read(file),git(contract.incomingCommit,file));
});
test('each exact new cache edge and its original subject retain the same complete old source body',()=>{
 for(const edge of edges){
  // Start from the actual merged body, then test the declared cache subject in
  // isolation. For the shared FEATURES owner choose the matching suffix shape.
  let subject=normalizeProgressionLoopCacheSource(read(edge.file),edge.file);
  if(edge.file==='ranch3d.html')subject=subject.replace("import {FEATURES} from './assets/features/index.js?v=physical-ride-2-starter-tack-2-fieldstone-walls-3';",edge.after);
  assert.equal(subject.split(edge.after).length-1,1);
  assert.equal(normalizeStarterTackSource(subject,edge.file),normalizeStarterTackSource(subject.replace(edge.after,edge.before),edge.file));
  for(const bad of [subject.replace(edge.after,edge.after.replace(/\?v=[^']+/,'?v=unreviewed-next')),subject+'\n// duplicate '+edge.after,subject+'\n// mixed '+edge.before,subject.replace(edge.after,edge.after.replace(/FEATURES|courseGuide|course|breeding|ev2disc|ev2ladder|bond|seEvents/,'unreviewedOwner'))])assert.throws(()=>normalizeStarterTackSource(bad,edge.file));
 }
});
test('unknown own edges and cache projections cannot erase unrelated rider, authorization, gear or world body drift',()=>{
 for(const file of ['ranch3d.html','assets/features/index.js']){
  const source=read(file);assert.throws(()=>normalizeReviewedWorldSource(source+'\n// unauthorized body change',file));
  assert.throws(()=>normalizeStarterTackSource(source+'\n// unauthorized body change',file));
 }
 const source=read('ranch3d.html');for(const tag of ['riding-distance.mjs?v=physical-ride-1','ribbon-awards.mjs?v=final-ribbon-1'])assert.throws(()=>normalizeReviewedRuntimeSource(source.replace(tag,tag+'-unreviewed'),'ranch3d.html'));
});
test('merged preservation observers reverse only exact compatibility calls and retain every incoming assertion and complete pinned body',()=>{
 for(const [file,hash]of Object.entries(contract.observerSHA256)){
  const source=read(file),projected=normalizeReviewedObserverSource(source,file);assert.equal(sha(projected),hash);assert.equal(projected,git(contract.incomingCommit,file));
  assert.throws(()=>normalizeReviewedObserverSource(source+'\n// altered observer assertion',file));
  assert.throws(()=>normalizeReviewedObserverSource(source.replace('assert.equal(','assert.notEqual('),file));
 }
});
test('camera guide compatibility restores only reviewed collision-aware guidance, with unchanged legacy whole-body hash',()=>{
 const file='assets/features/course-guide.js',source=read(file);assert.equal(sha(source),contract.guideAfterSHA256);assert.equal(normalizeReviewedGuideSource(source,file),git('8733008',file));
 assert.equal(sha(normalizeReviewedGuideSource(source,file)),contract.guideBeforeSHA256);
 assert.throws(()=>normalizeReviewedGuideSource(source+'\n// unrelated jump or scored-line change',file));
 assert.throws(()=>normalizeReviewedGuideSource(source.replace('flatGuide.reset()','flatGuide.unreviewedReset()'),file));
 assert.equal(normalizeReviewedGuideSource('unrelated module','assets/solid-collisions.js'),'unrelated module');
});

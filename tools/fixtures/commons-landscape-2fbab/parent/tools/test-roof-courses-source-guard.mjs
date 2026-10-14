import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import * as Roof from './roof-courses-source-guard.cjs';
import * as Clearance from './leaf-camera-clearance-source-guard.cjs';
import * as Canopy from './canopy-depth-source-guard.cjs';
import * as Joint from './north-formal-composition-source-guard.cjs';
import {normalizeRanchModelSource} from './ranch-model-source-guard.mjs';
const root=new URL('../',import.meta.url),fixture='tools/fixtures/roof-courses-efded6f/contract.json',raw=f=>fs.readFileSync(new URL(f,root),'utf8'),sha=s=>crypto.createHash('sha256').update(s).digest('hex'),contract=JSON.parse(raw(fixture));
const prior=f=>execFileSync('git',['show',contract.baseline+':'+f],{cwd:root,encoding:'utf8'});
function authored(before,changes){for(const c of changes){assert.equal(c.occurrences,1);assert.equal(before.split(c.before).length-1,1);before=before.replace(c.before,c.after);}return before;}
test('two raw runtime owners and five narrow observer fronts restore whole exact efded6f parent bodies',()=>{
 assert.equal(contract.baseline,'efded6f128a25050c07008bcd359f646b439f93a');assert.equal(contract.releaseScope,'cedar-only');assert.deepEqual(contract.roofMaterialsAllowed,['Ranch | aged cedar shingles']);assert.deepEqual(Object.keys(contract.files),['assets/ranch-architecture.js','ranch3d.html']);assert.equal(Object.keys(contract.observers).length,5);
 for(const [f,row]of Object.entries({...contract.files,...contract.observers})){const before=prior(f),current=raw(f);assert.equal(sha(before),row.beforeSHA256);assert.equal(sha(current),row.afterSHA256);assert.equal(authored(before,row.changes),current);assert.equal(Roof.normalizeRoofCoursesAuditSource(current,f),before);assert.equal(Roof.normalizeRoofCoursesAuditSource(before,f),before);assert(Roof.assertRoofCoursesCurrent(current,f));assert.throws(()=>Roof.assertRoofCoursesCurrent(before,f));}
});
test('the source delta is one post-proxy covering hook, one dependency import and one root import cache query',()=>{
 const owner=raw('assets/ranch-architecture.js'),restored=Roof.normalizeRoofCoursesSource(owner,'assets/ranch-architecture.js'),main=raw('ranch3d.html');
 assert.equal(owner.split("import {dressRoofCoverBox} from './ranch-roof-courses.mjs?v=ranch-roof-courses-3';").length-1,1);
 assert.equal(owner.split('const receipt=dressRoofCoverBox(').length-1,1);const hook=owner.slice(owner.indexOf('      // Cedar-only adoption'),owner.indexOf('      if(m===siding&&g.userData.ranchTimberBox)'));assert(hook.includes("if(solid&&m===roof&&g.type==='BoxGeometry')"));assert(hook.includes("style:'cedar'"));assert(hook.includes("scope:'cedar-only'"));assert(!hook.includes('m===slate'));
 assert(owner.indexOf('if(solid)recordSolidPart(')<owner.indexOf('const receipt=dressRoofCoverBox('));assert(owner.indexOf('const receipt=dressRoofCoverBox(')<owner.indexOf('      g.applyMatrix4(matrix);'));
 assert.equal(main.split('./assets/ranch-architecture.js?v=ranch-roof-courses-3').length-1,1);assert.equal(main.split('./assets/ranch-builder-art.js?v=ranch-models-1').length-1,1);
 assert.equal(owner.slice(owner.indexOf('  function shellWall(')),restored.slice(restored.indexOf('  function shellWall(')));
 assert.equal(owner.slice(owner.indexOf('    box(')),restored.slice(restored.indexOf('    box(')));
});
test('existing leaf, canopy, joint, ranch and source physics authorities still receive complete approved bodies',()=>{
 for(const f of ['ranch3d.html','assets/world-photoscans.js']){assert(Clearance.assertLeafCameraClearanceCurrent(raw(f),f));assert(Canopy.assertCanopyDepthCurrent(raw(f),f));}
 const joint=JSON.parse(raw('tools/fixtures/north-formal-7a6bacd/contract.json'));for(const kind of ['files','observers'])for(const [f,row]of Object.entries(joint[kind])){assert(Joint.assertNorthFormalCurrent(raw(f),f));for(const side of ['North','Formal'])assert.equal(sha(Joint['normalizeNorthFormal'+side+(kind==='files'?'Source':'Observer')](raw(f),f)),row[side.toLowerCase()+'SHA256']);}
 for(const f of ['assets/ranch-architecture.js','ranch3d.html'])assert.equal(normalizeRanchModelSource(raw(f),f),normalizeRanchModelSource(prior(f),f));
 for(const [f,h]of Object.entries({...contract.protectedExistingFixtureSHA256,...contract.protectedSourceSHA256}))assert.equal(sha(fs.readFileSync(new URL(f,root))),h,f);
});
test('mixed, missing, duplicate, unknown cache, helper and unrelated body edits fail whole-file acceptance',()=>{
 for(const [f,row]of Object.entries({...contract.files,...contract.observers})){const current=raw(f);for(const c of row.changes)for(const bad of [current.replace(c.after,''),current+'\n'+c.after,current+'\n'+c.before,current.replace(c.after,c.after+'/* unreviewed roof change */'),current+'\n// unrelated controller or assertion drift']){assert.throws(()=>Roof.assertRoofCoursesCurrent(bad,f));assert.throws(()=>assert.equal(sha(Roof.normalizeRoofCoursesAuditSource(bad,f)),row.beforeSHA256));}}
 for(const f of Object.keys(contract.files)){const bad=raw(f).replace('?v=ranch-roof-courses-3','?v=unknown-roof-2');assert.throws(()=>Roof.assertRoofCoursesCurrent(bad,f));}
 assert.deepEqual(Object.keys(contract.addedFiles),['assets/ranch-roof-courses.mjs','tools/test-roof-courses.mjs']);for(const [f,row]of Object.entries(contract.addedFiles)){assert.equal(sha(raw(f)),row.sha256);assert(Roof.assertRoofCoursesCurrent(raw(f),f));assert.throws(()=>Roof.assertRoofCoursesCurrent(raw(f)+'\n// helper drift',f));}
 assert.doesNotMatch(raw('tools/test-roof-courses.mjs'),/source-guard|normalizeRoof/);assert(raw('tools/test-roof-courses.mjs').includes("import {createRanchArchitecture} from '../assets/ranch-architecture.js';"));assert.throws(()=>Roof.assertRoofCoursesCurrent('anything','unknown.js'));assert.equal(Roof.normalizeRoofCoursesAuditSource('unknown historical source','unknown.js'),'unknown historical source');
});
test('built-in-only leaf declaration and exact named fixture filter reject corrupt, missing and duplicate declarations',()=>{
 const leaf=raw('tools/roof-courses-source-guard.cjs'),text=raw(fixture);assert.deepEqual([...leaf.matchAll(/require\('([^']+)'\)/g)].map(m=>m[1]),['node:fs','node:path','node:assert/strict','node:crypto']);assert.equal(Roof.normalizeRoofCoursesFixtureChanges(fixture+'\n'),'');assert.equal(Roof.normalizeRoofCoursesFixtureChanges('tools/fixtures/unknown/future.json\n'),'tools/fixtures/unknown/future.json\n');assert.throws(()=>Roof.normalizeRoofCoursesFixtureChanges(fixture+'\n'+fixture+'\n'));
 const parentFixture='tools/fixtures/roof-courses-efded6f/ranch-architecture.js';assert.equal(Roof.normalizeRoofCoursesFixtureChanges(parentFixture+'\n'),'');assert.equal(sha(raw(parentFixture)),contract.addedFixtureSHA256[parentFixture]);assert.equal(raw(parentFixture),prior('assets/ranch-architecture.js'));assert.equal(Clearance.normalizeLeafCameraClearanceFixtureChanges(fixture+'\n'+parentFixture+'\n'+'tools/fixtures/leaf-camera-clearance-0f9cd99/contract.json\n'),'');
 function load(value){const module={exports:{}};new Function('require','module','exports','__dirname',leaf)(name=>name==='node:fs'?{...fs,readFileSync(file,...args){if(String(file).endsWith(fixture)){if(value===null)throw Error('Missing roof declaration');return value;}return fs.readFileSync(file,...args);}}:name==='node:path'?path:name==='node:assert/strict'?assert:name==='node:crypto'?crypto:null,module,module.exports,new URL('tools/',root).pathname);return module.exports;}
 assert.doesNotThrow(()=>load(text));assert.throws(()=>load(text+'\n'),/Exact approved dimensional roof/);assert.throws(()=>load(null),/Missing roof/);
});

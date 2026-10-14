import {normalizeGrazedNaturalAuditSource} from './grazed-natural-source-guard.cjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import * as Commons from './commons-landscape-source-guard.cjs';
import * as Roof from './roof-courses-source-guard.cjs';
import * as Clearance from './leaf-camera-clearance-source-guard.cjs';
import * as Canopy from './canopy-depth-source-guard.cjs';
const root=new URL('../',import.meta.url),fixture='tools/fixtures/commons-landscape-2fbab/contract.json',raw=f=>normalizeGrazedNaturalAuditSource(fs.readFileSync(new URL(f,root),'utf8'),f),sha=s=>crypto.createHash('sha256').update(s).digest('hex'),contract=JSON.parse(raw(fixture));
const prior=f=>execFileSync('git',['show',contract.baseline+':'+f],{cwd:root,encoding:'utf8'});
function authored(before,changes){for(const c of changes){assert.equal(before.split(c.before).length-1,c.occurrences);before=before.replace(c.before,c.after);}return before;}
test('all fourteen current runtime owners and narrow observer fronts restore their complete frozen 2fbab parent bodies',()=>{
 assert.equal(contract.baseline,'2fbab480a14a5356722bc2efaad31bd31cea4290');assert.equal(Object.keys(contract.files).length,14);assert.equal(Object.keys(contract.observers).length,8);assert.equal(contract.releaseScope,'four-real-standards-and-two-sward-banks');
 for(const [f,row]of Object.entries({...contract.files,...contract.observers})){const before=prior(f),current=raw(f);assert.equal(sha(before),row.beforeSHA256);assert.equal(raw(row.parentFixture),before);assert.equal(sha(current),row.afterSHA256);assert.equal(authored(before,row.changes),current);assert.equal(Commons.normalizeCommonsLandscapeAuditSource(current,f),before);assert.equal(Commons.normalizeCommonsLandscapeAuditSource(before,f),before);assert(Commons.assertCommonsLandscapeCurrent(current,f));assert.throws(()=>Commons.assertCommonsLandscapeCurrent(before,f));}
});
test('runtime adoption is exactly four real managed standards, two data rows and coherent full cache-parent closure without rejected shrub code',()=>{
 const photo=raw('assets/world-photoscans.js'),main=raw('ranch3d.html'),bands=raw('assets/field-sward-bands.mjs');assert.equal(photo.split("./commons-standard-trees.mjs?v=commons-standard-trees-1").length-1,1);assert(photo.includes('settlementFootRejection(site,source,ride.fullRadius,ride)'));assert(photo.includes('authoredWoodlandEdge:true,authoredCommonsStandard:true'));assert(bands.includes('north-commons-west-bank')&&bands.includes('north-commons-east-bank'));assert.doesNotMatch(main,/pastoral-field-margins|commonsMarginsReady|installCommonsFieldMargins/);
 assert.equal(contract.cacheEdges.length,27);for(const edge of contract.cacheEdges){const count=value=>["'",'"'].reduce((n,quote)=>n+raw(edge.file).split(quote+value+quote).length-1,0);assert.equal(count(edge.after),1);assert.equal(count(edge.before),0);assert(edge.after.includes(edge.child==='assets/field-sward-bands.mjs'?'?v=field-sward-bands-4':'commons-landscape-1'));}
 assert.equal(sha(Commons.normalizeCommonsLandscapeSource(main,'ranch3d.html')),sha(prior('ranch3d.html')));assert.equal(sha(Commons.normalizeCommonsLandscapeSource(photo,'assets/world-photoscans.js')),sha(prior('assets/world-photoscans.js')));
});
test('roof, leaf and canopy authorities still bind exact complete source and unchanged historical fixtures and physics owners',()=>{
 for(const f of ['ranch3d.html','assets/world-photoscans.js']){assert(Clearance.assertLeafCameraClearanceCurrent(raw(f),f));assert(Canopy.assertCanopyDepthCurrent(raw(f),f));}for(const f of ['ranch3d.html','assets/ranch-architecture.js'])assert(Roof.assertRoofCoursesCurrent(raw(f),f));
 for(const [f,h]of Object.entries(contract.protectedExistingFixtureSHA256))assert.equal(sha(fs.readFileSync(new URL(f,root))),h,f);for(const [f,h]of Object.entries(contract.protectedSourceSHA256))assert.equal(sha(fs.readFileSync(new URL(f,root))),h,f);
 for(const f of ['tools/test-commons-standard-trees.mjs','tools/test-commons-sward.mjs']){assert.doesNotMatch(raw(f),/source-guard|normalizeCommons|normalizeRoof/);assert(raw(f).includes("../assets/"));}
 assert(raw('tools/test-commons-standard-trees.mjs').includes("../assets/world-photoscans.js"));assert(raw('tools/test-commons-sward.mjs').includes("../assets/field-sward-bands.mjs"));
});
test('missing mixed duplicated unknown-cache and unrelated runtime or observer edits fail whole-file acceptance',()=>{
 for(const [f,row]of Object.entries({...contract.files,...contract.observers})){const current=raw(f);for(const c of row.changes)for(const bad of [current.replace(c.after,''),current+'\n'+c.after,current+'\n'+c.before,current.replace(c.after,c.after+'/* unknown commons edit */'),current+'\n// unrelated assertion or controller drift']){assert.throws(()=>Commons.assertCommonsLandscapeCurrent(bad,f));assert.throws(()=>assert.equal(sha(Commons.normalizeCommonsLandscapeAuditSource(bad,f)),row.beforeSHA256));}}
 for(const [f,row]of Object.entries(contract.addedFiles)){assert.equal(sha(raw(f)),row.sha256);assert(Commons.assertCommonsLandscapeCurrent(raw(f),f));assert.throws(()=>Commons.assertCommonsLandscapeCurrent(raw(f)+'\n// unreviewed helper change',f));}assert.throws(()=>Commons.assertCommonsLandscapeCurrent('anything','unknown.js'));assert.equal(Commons.normalizeCommonsLandscapeAuditSource('unknown historical body','unknown.js'),'unknown historical body');
});
test('the built-in-only inverse leaf and exact named fixture filter reject corrupted missing or duplicate declarations',()=>{
 const leaf=raw('tools/commons-landscape-source-guard.cjs'),text=raw(fixture);assert.deepEqual([...leaf.matchAll(/require\('([^']+)'\)/g)].map(m=>m[1]),['node:fs','node:path','node:assert/strict','node:crypto']);assert(leaf.includes(sha(text)));assert.equal(Commons.normalizeCommonsLandscapeFixtureChanges(fixture+'\n'),'');assert.equal(Commons.normalizeCommonsLandscapeFixtureChanges('tools/fixtures/unknown/future.json\n'),'tools/fixtures/unknown/future.json\n');assert.throws(()=>Commons.normalizeCommonsLandscapeFixtureChanges(fixture+'\n'+fixture+'\n'));for(const [f,h]of Object.entries(contract.addedFixtureSHA256)){assert.equal(sha(raw(f)),h);assert.equal(Commons.normalizeCommonsLandscapeFixtureChanges(f+'\n'),'');}assert.equal(Roof.normalizeRoofCoursesFixtureChanges(fixture+'\n'),'');
 function load(value){const module={exports:{}};new Function('require','module','exports','__dirname',leaf)(name=>name==='node:fs'?{...fs,readFileSync(file,...args){if(String(file).endsWith(fixture)){if(value===null)throw Error('Missing commons declaration');return value;}return fs.readFileSync(file,...args);}}:name==='node:path'?path:name==='node:assert/strict'?assert:name==='node:crypto'?crypto:null,module,module.exports,new URL('tools/',root).pathname);return module.exports;}
 assert.doesNotThrow(()=>load(text));assert.throws(()=>load(text+'\n'),/Exact approved commons landscape/);assert.throws(()=>load(null),/Missing commons/);
});

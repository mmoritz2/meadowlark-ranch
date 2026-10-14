// Complete source/history contracts only. Runtime selector tests read raw source.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import * as Clearance from './leaf-camera-clearance-source-guard.cjs';
import * as Canopy from './canopy-depth-source-guard.cjs';
import * as Joint from './north-formal-composition-source-guard.cjs';
const root=new URL('../',import.meta.url),fixture='tools/fixtures/canopy-depth-8f5ad05/contract.json',raw=f=>Clearance.normalizeLeafCameraClearanceAuditSource(fs.readFileSync(new URL(f,root),'utf8'),f),contract=JSON.parse(raw(fixture)),sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const prior=f=>execFileSync('git',['show',contract.baseline+':'+f],{cwd:root,encoding:'utf8'});
function authored(before,rows){for(const c of rows){assert.equal(c.occurrences,1);assert.equal(before.split(c.before).length-1,c.occurrences);before=before.replace(c.before,c.after);}return before;}
test('two exact raw owners retain complete8f5 preimages and only the approved updater/cache changes',()=>{
 assert.equal(contract.baseline,'8f5ad0597241018b9357d8739d6e5c79aa09243f');assert.equal(Object.keys(contract.files).length,2);
 for(const [f,row]of Object.entries(contract.files)){const before=prior(f),current=raw(f);assert.equal(sha(before),row.beforeSHA256);assert.equal(sha(current),row.afterSHA256);assert.equal(authored(before,row.changes),current);assert.equal(Canopy.normalizeCanopyDepthSource(current,f),before);assert.equal(Canopy.normalizeCanopyDepthSource(before,f),before);assert(Canopy.assertCanopyDepthCurrent(current,f));assert.throws(()=>Canopy.assertCanopyDepthCurrent(before,f));}
 const photo=raw('assets/world-photoscans.js'),main=raw('ranch3d.html');assert.equal(photo.split("profile:'volumetric-middle-pines-1'").length-1,1);assert.equal(main.split('world-photoscans.js?v=volumetric-middle-pines-1').length-1,1);assert(!main.includes('world-photoscans.js?v=coyote-scan-composition-4'));
});
test('five complete observer fronts remain exact declared edits and historical assertions retain their full old bodies',()=>{
 assert.equal(Object.keys(contract.observers).length,5);
 for(const [f,row]of Object.entries(contract.observers)){const before=prior(f),current=raw(f);assert.equal(sha(before),row.beforeSHA256);assert.equal(authored(before,row.changes),current);assert(Canopy.assertCanopyDepthCurrent(current,f));assert.equal(Canopy.normalizeCanopyDepthObserver(current,f),before);}
 const historical=Canopy.normalizeCanopyDepthAuditSource(raw('tools/north-formal-composition-source-guard.cjs'),'tools/north-formal-composition-source-guard.cjs');assert.deepEqual([...historical.matchAll(/require\('([^']+)'\)/g)].map(m=>m[1]),['node:fs','node:path','node:assert/strict','node:crypto']);
});
test('whole source and observer bounds reject mixed, duplicate, missing, unknown and unrelated drift',()=>{
 for(const [f,row]of Object.entries({...contract.files,...contract.observers})){const current=raw(f);for(const c of row.changes){const bads=[current.replace(c.after,''),current+'\n'+c.after,current+'\n'+c.before,current.replace(c.after,c.after+'/* unknown canopy edit */'),current+'\n// unrelated source/assertion drift'];for(const bad of bads){assert.throws(()=>Canopy.assertCanopyDepthCurrent(bad,f));assert.throws(()=>assert.equal(sha(Canopy.normalizeCanopyDepthAuditSource(bad,f)),row.beforeSHA256));}}}
 assert.throws(()=>Canopy.assertCanopyDepthCurrent('anything','unknown.js'));assert.equal(Canopy.normalizeCanopyDepthAuditSource('unknown historical source','unknown.js'),'unknown historical source');
});
test('both complete Joint parent source/observer authorities survive unchanged before their old assertions run',()=>{
 const joint=JSON.parse(raw('tools/fixtures/north-formal-7a6bacd/contract.json'));
 for(const [f,row]of Object.entries(joint.files)){const current=raw(f);assert(Joint.assertNorthFormalCurrent(current,f));for(const side of ['North','Formal']){const fn=Joint['normalizeNorthFormal'+side+'Source'];assert.equal(sha(fn(current,f)),row[side.toLowerCase()+'SHA256']);}}
 for(const [f,row]of Object.entries(joint.observers)){const current=raw(f);assert(Joint.assertNorthFormalCurrent(current,f));for(const side of ['North','Formal'])assert.equal(sha(Joint['normalizeNorthFormal'+side+'Observer'](current,f)),row[side.toLowerCase()+'SHA256']);}
});
test('all22 North fixture blobs, formal/pasture contracts and strict runtime behavior owners remain raw unchanged',()=>{
 assert.equal(Object.keys(contract.protectedExistingFixtureSHA256).filter(f=>f.startsWith('tools/fixtures/north-rim-planar-22b72cc/')).length,22);
 for(const [f,h]of Object.entries(contract.protectedExistingFixtureSHA256))assert.equal(sha(fs.readFileSync(new URL(f,root))),h,f);
 for(const section of ['strictFormalRuntimeSHA256','strictPassageRuntimeSHA256'])for(const [f,h]of Object.entries(contract[section]))assert.equal(sha(raw(f)),h,f);
});
test('new actual selector tests bind whole files and never receive historical source projection',()=>{
 assert.equal(Object.keys(contract.addedFiles).length,2);for(const [f,row]of Object.entries(contract.addedFiles)){assert.equal(sha(raw(f)),row.sha256);assert(Canopy.assertCanopyDepthCurrent(raw(f),f));assert.throws(()=>Canopy.assertCanopyDepthCurrent(raw(f)+'\n// drift',f));}
 const actual=raw('tools/test-middle-tree-detail.cjs'),low=raw('tools/test-low-tree-detail.mjs'),retirement=raw('tools/test-steep-flora-roots.mjs');assert.doesNotMatch(actual,/source-guard|normalizeCanopy/);assert.doesNotMatch(low,/source-guard|normalizeCanopy/);assert(actual.includes("'/../assets/world-photoscans.js'"));assert(low.includes("construct(T,H,G,renderer"));assert(retirement.includes("const body=actualPhoto.slice(actualPhoto.indexOf('  let previousSelection=new Set()')"));
});
test('built-in-only leaf and exact one-fixture filter fail closed on corrupt or missing declarations',()=>{
 const leaf=raw('tools/canopy-depth-source-guard.cjs'),text=raw(fixture);assert.deepEqual([...leaf.matchAll(/require\('([^']+)'\)/g)].map(m=>m[1]),['node:fs','node:path','node:assert/strict','node:crypto']);
 assert.equal(Canopy.normalizeCanopyDepthFixtureChanges(fixture+'\n'),'');const unknown='tools/fixtures/unknown/future.json\n';assert.equal(Canopy.normalizeCanopyDepthFixtureChanges(unknown),unknown);assert.equal(Canopy.normalizeCanopyDepthFixtureChanges('tools/fixtures/north-formal-7a6bacd/contract.json\n'),'tools/fixtures/north-formal-7a6bacd/contract.json\n');assert.throws(()=>Canopy.normalizeCanopyDepthFixtureChanges(fixture+'\n'+fixture+'\n'));assert.equal(Joint.normalizeNorthFormalFixtureChanges(fixture+'\n'+'tools/fixtures/north-formal-7a6bacd/contract.json\n'),'');
 function load(value){const module={exports:{}};new Function('require','module','exports','__dirname',leaf)(name=>name==='node:fs'?{...fs,readFileSync(file,...args){if(String(file).endsWith(fixture)){if(value===null)throw Error('Missing canopy declaration');return value;}return fs.readFileSync(file,...args);}}:name==='node:path'?path:name==='node:assert/strict'?assert:name==='node:crypto'?crypto:null,module,module.exports,new URL('tools/',root).pathname);return module.exports;}
 assert.doesNotThrow(()=>load(text));assert.throws(()=>load(text+'\n'),/Exact approved canopy/);assert.throws(()=>load(null),/Missing canopy/);
});

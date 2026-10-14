import {normalizeRoofCoursesAuditSource} from './roof-courses-source-guard.cjs';
// Explicit7a11 parent bytes for protected historical owners; currentnormal tests remain raw.
import {normalizeIslandNormalAuditSource} from './island-normal-source-guard.cjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import * as Clearance from './leaf-camera-clearance-source-guard.cjs';
import * as Canopy from './canopy-depth-source-guard.cjs';
import * as Joint from './north-formal-composition-source-guard.cjs';
const root=new URL('../',import.meta.url),fixture='tools/fixtures/leaf-camera-clearance-0f9cd99/contract.json',raw=f=>normalizeRoofCoursesAuditSource(fs.readFileSync(new URL(f,root),'utf8'),f),sha=s=>crypto.createHash('sha256').update(s).digest('hex'),contract=JSON.parse(raw(fixture));
function authored(before,changes){for(const c of changes){assert.equal(c.occurrences,1);assert.equal(before.split(c.before).length-1,1);before=before.replace(c.before,c.after);}return before;}
test('two actual source owners and two observer fronts invert exactly to their complete approved parent bodies',()=>{
 assert.equal(contract.baseline,'0f9cd990ca5fadade7d561e366713ba255a09997');assert.equal(Object.keys(contract.files).length,2);assert.equal(Object.keys(contract.observers).length,2);
 for(const [f,row]of Object.entries({...contract.files,...contract.observers})){const current=raw(f),before=Clearance.normalizeLeafCameraClearanceAuditSource(current,f);assert.equal(sha(current),row.afterSHA256);assert.equal(sha(before),row.beforeSHA256);assert.equal(authored(before,row.changes),current);assert.equal(Clearance.normalizeLeafCameraClearanceAuditSource(before,f),before);assert(Clearance.assertLeafCameraClearanceCurrent(current,f));assert.throws(()=>Clearance.assertLeafCameraClearanceCurrent(before,f));}
});
test('the historical canopy and both Joint parent authorities still receive exact full source and observer bodies',()=>{
 const canopy=JSON.parse(raw('tools/fixtures/canopy-depth-8f5ad05/contract.json'));for(const [f,row]of Object.entries(canopy.files)){assert(Canopy.assertCanopyDepthCurrent(raw(f),f));assert.equal(sha(Canopy.normalizeCanopyDepthAuditSource(raw(f),f)),row.beforeSHA256);}
 const joint=JSON.parse(raw('tools/fixtures/north-formal-7a6bacd/contract.json'));for(const kind of ['files','observers'])for(const [f,row]of Object.entries(joint[kind])){assert(Joint.assertNorthFormalCurrent(raw(f),f));for(const side of ['North','Formal'])assert.equal(sha(Joint['normalizeNorthFormal'+side+(kind==='files'?'Source':'Observer')](raw(f),f)),row[side.toLowerCase()+'SHA256']);}
});
test('raw selector, material policy, depth, scan, wood, atlases, baker and every prior fixture stay unchanged',()=>{
 assert.equal(Object.keys(contract.protectedExistingFixtureSHA256).filter(f=>f.startsWith('tools/fixtures/north-rim-planar-22b72cc/')).length,22);for(const [f,h]of Object.entries({...contract.protectedExistingFixtureSHA256,...contract.protectedSourceSHA256}))assert.equal(sha(normalizeIslandNormalAuditSource(fs.readFileSync(new URL(f,root)),f)),h,f);
 const f='assets/world-photoscans.js',current=raw(f),before=Clearance.normalizeLeafCameraClearanceSource(current,f),start='  let previousSelection=new Set()';assert(current.includes(start));assert.equal(current.slice(current.indexOf(start)),before.slice(before.indexOf(start)));
 assert.equal(current.match(/mat\.normalScale\.multiplyScalar\(\.55\)/g).length,1);assert.equal(current.match(/normal=normalize\(mix\(normal,canopyUp,\.42\)\);/g).length,1);assert.equal(current.match(/mat\.alphaTest=\.22;/g).length,1);assert(current.includes('tree-impostors.json?v=pine-photo-island-1'));assert(!current.includes('applyIslandLeafCurvature'));
 const depth='    const depth=new THREE.MeshDepthMaterial(',tail='  async function load(id){';assert.equal(current.slice(current.indexOf(depth),current.indexOf(tail)),before.slice(before.indexOf(depth),before.indexOf(tail)));
});
test('every changed and added body is whole-file bounded and rejects mixed, missing, duplicate or unrelated edits',()=>{
 for(const [f,row]of Object.entries({...contract.files,...contract.observers})){const current=raw(f);for(const c of row.changes)for(const bad of [current.replace(c.after,''),current+'\n'+c.after,current+'\n'+c.before,current.replace(c.after,c.after+'/* unknown clearance edit */'),current+'\n// unrelated source/assertion drift']){assert.throws(()=>Clearance.assertLeafCameraClearanceCurrent(bad,f));assert.throws(()=>assert.equal(sha(Clearance.normalizeLeafCameraClearanceAuditSource(bad,f)),row.beforeSHA256));}}
 assert.equal(Object.keys(contract.addedFiles).length,3);for(const [f,row]of Object.entries(contract.addedFiles)){assert.equal(sha(raw(f)),row.sha256);assert(Clearance.assertLeafCameraClearanceCurrent(raw(f),f));assert.throws(()=>Clearance.assertLeafCameraClearanceCurrent(raw(f)+'\n// drift',f));}
 assert.throws(()=>Clearance.assertLeafCameraClearanceCurrent('anything','unknown.js'));assert.equal(Clearance.normalizeLeafCameraClearanceAuditSource('unknown historical source','unknown.js'),'unknown historical source');
});
test('the built-in-only source leaf filters only its exact fixture and rejects corrupt or missing declarations',()=>{
 const leaf=raw('tools/leaf-camera-clearance-source-guard.cjs'),text=raw(fixture);assert.deepEqual([...leaf.matchAll(/require\('([^']+)'\)/g)].map(m=>m[1]),['node:fs','node:path','node:assert/strict','node:crypto']);assert.equal(Clearance.normalizeLeafCameraClearanceFixtureChanges(fixture+'\n'),'');assert.equal(Clearance.normalizeLeafCameraClearanceFixtureChanges('tools/fixtures/unknown/future.json\n'),'tools/fixtures/unknown/future.json\n');assert.throws(()=>Clearance.normalizeLeafCameraClearanceFixtureChanges(fixture+'\n'+fixture+'\n'));assert.equal(Joint.normalizeNorthFormalFixtureChanges(fixture+'\n'+'tools/fixtures/canopy-depth-8f5ad05/contract.json\n'+'tools/fixtures/north-formal-7a6bacd/contract.json\n'),'');
 function load(value){const module={exports:{}};new Function('require','module','exports','__dirname',leaf)(name=>name==='node:fs'?{...fs,readFileSync(file,...args){if(String(file).endsWith(fixture)){if(value===null)throw Error('Missing clearance declaration');return value;}return fs.readFileSync(file,...args);}}:name==='node:path'?path:name==='node:assert/strict'?assert:name==='node:crypto'?crypto:null,module,module.exports,new URL('tools/',root).pathname);return module.exports;}
 assert.doesNotThrow(()=>load(text));assert.throws(()=>load(text+'\n'),/Exact approved leaf/);assert.throws(()=>load(null),/Missing clearance/);
});

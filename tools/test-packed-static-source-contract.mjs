import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url),read=rel=>fs.readFileSync(new URL(rel,root),'utf8'),bytes=rel=>fs.readFileSync(new URL(rel,root)),sha=value=>createHash('sha256').update(value).digest('hex');
const contract=JSON.parse(read('tools/fixtures/packed-static-source-contract.json'));
const html=read('ranch3d.html'),engine=read('assets/solid-collisions.js'),helper=read('assets/packed-static-surfaces.mjs');
function importMap(source){const matches=[...source.matchAll(/<script\s+type="importmap">([\s\S]*?)<\/script>/g)];assert.equal(matches.length,1);return JSON.parse(matches[0][1]).imports;}
const map=importMap(html),origin='https://portable.invalid/',documentURL=origin+'ranch3d.html';
const normalized=new Map(Object.entries(map).map(([k,v])=>[new URL(k,documentURL).href,new URL(v,documentURL).href]));
function resolved(specifier,referrer){const url=new URL(specifier,referrer).href;return normalized.get(url)||url;}
const target=new URL('./assets/solid-collisions.js?v=packed-static-backend-1',documentURL).href;
test('production engine inverse import normalization is exactly the executed native visitor source; helper unchanged',()=>{
 const {before,after}=contract.normalization;assert.equal(engine.split(after).length,2);assert.equal(engine.split(before).length,1);assert.equal(sha(engine.replace(after,before)),contract.nativeEngineSHA256);assert.equal(sha(helper),contract.nativeHelperSHA256);assert.equal(sha(bytes('tools/fixtures/packed-static-legacy.mjs')),contract.legacyEngineSHA256);
 assert(!/\/Users\/|Desktop\/|current-native-hoof|output\//.test(engine+helper));
});
test('three cache aliases target one fresh URL directly without chaining or main source3 spelling changes',()=>{
 for(const[k,v]of Object.entries(contract.importMapAliases)){assert.equal(map[k],v);assert.equal(new URL(v,documentURL).href,target);assert(!normalized.has(target),'Target must not be another alias key');}
 assert(html.includes("import {createSolidWorld} from './assets/solid-collisions.js?v=snowpeak-boulder-contact-1';"));
});
test('reviewed grounds and quarter-sign cache aliases resolve directly',()=>{
 for(const[k,v]of Object.entries({...contract.sceneryImportMapAliases,...contract.quarterSignImportMapAliases})){assert.equal(map[k],v,k);const target=new URL(v,documentURL).href;assert(!normalized.has(target),'Scenery target must not chain through another map key');assert.equal(resolved(k,documentURL),target);}
 const quarterAliases=Object.entries(contract.quarterSignImportMapAliases);assert.equal(quarterAliases.length,2);assert(quarterAliases.every(([,v])=>v===quarterAliases[0][1]));
 const q=contract.quarterSignHelperImport;assert(read(q.path).includes("from '"+q.specifier+"'"));assert.equal(resolved(q.specifier,new URL(q.path,origin).href),new URL(q.resolved,documentURL).href);assert(!normalized.has(new URL(q.resolved,documentURL).href));
 assert.equal(resolved('./ranch-grounds.mjs?v=ranch-actors-2',origin+'assets/meadow-cover.js'),new URL('./assets/ranch-grounds.mjs?v=barleyfold-arrival-grounds-1',documentURL).href);
});
test('all eight current live static browser collision imports resolve once to the same product module',()=>{
 const actual=[];function visit(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){if(entry.name==='vendor')continue;const q=path.join(dir,entry.name);if(fs.statSync(q).isDirectory())visit(q);else if(/\.(mjs|js)$/.test(q))collect(q);}}
 function collect(file){const text=fs.readFileSync(file,'utf8'),relative=path.relative(fileURLToPath(root),file).split(path.sep).join('/');for(const m of text.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*)['"]([^'"]*solid-collisions\.js[^'"]*)['"]/g))actual.push({path:relative,line:text.slice(0,m.index).split('\n').length,specifier:m[1]});}
 for(const name of fs.readdirSync(root))if(/\.html$/.test(name))collect(fileURLToPath(new URL(name,root)));visit(fileURLToPath(new URL('assets/',root)));const ordered=rows=>rows.map(({path,specifier})=>({path,specifier})).sort((a,b)=>(a.path+':'+a.specifier).localeCompare(b.path+':'+b.specifier));assert.deepEqual(ordered(actual),ordered(contract.liveBrowserStaticEdges),'New browser edges require an explicit cache contract');assert.equal(contract.liveBrowserStaticEdges.length,8);assert.equal(actual.length,contract.liveBrowserStaticEdges.length);
 for(const row of actual)assert.equal(resolved(row.specifier,new URL(row.path,origin).href),target,row.path);
});
test('all current QA browser dynamic collision imports use covered direct aliases',()=>{
 const actual=[];for(const name of fs.readdirSync(new URL('tools/',root))){if(!/^qa-.*\.cjs$/.test(name))continue;const text=read('tools/'+name);for(const m of text.matchAll(/\bimport\s*\(\s*['"]([^'"]*solid-collisions\.js[^'"]*)['"]/g))actual.push({path:'tools/'+name,line:text.slice(0,m.index).split('\n').length,specifier:m[1]});}
 const ordered=rows=>rows.slice().sort((a,b)=>(a.path+':'+a.specifier).localeCompare(b.path+':'+b.specifier));assert.deepEqual(ordered(actual),ordered(contract.qaBrowserDynamicEdges));assert.equal(actual.length,4);
 // These imports execute inside page.evaluate in the main Ranch document,
 // therefore use its URL rather than the Node QA script's filesystem path.
 for(const row of actual)assert.equal(resolved(row.specifier,documentURL),target,row.path);
});
test('original raw28/source3 construction, exact runtime bridge, callback and course clear remain unchanged',()=>{
 const start=html.indexOf('let snowpeakBoulderSource=null;'),end=html.indexOf('/* procedurally carved river, bridge, reeds & wheat field */',start);assert(start>=0&&end>start);assert.equal(sha(html.slice(start,end)),contract.rawBoulderConstructorSHA256);
 for(const[rel,pin]of Object.entries(contract.source3BridgeFiles))assert.equal(sha(bytes(rel)),pin,rel);
 assert(!/packed-boulder-support|authored-boulder-catalog|raw-boulder-batch/.test(engine+helper));
});
test('test oracles remain fixture only and recorded component scope is explicit',()=>{
 assert.equal(contract.fixtureScope.optionalNumericSupport,'Prepared/index query API remains tested; no shared callback adapter is staged or claimed.');assert.match(contract.fixtureScope.recordedPoses,/canonical patch authenticated,exterior nodes synthetic/);
 const tests=read('tools/test-packed-static-surfaces.mjs'),fixture=read('tools/packed-static-fixture.mjs');assert(tests.includes("from '../assets/solid-collisions.js'"));assert(fixture.includes("from '../assets/solid-collisions.js'"));assert(tests.includes("from './fixtures/packed-static-legacy.mjs'"));assert(!tests.includes('createPackedBoulderSupport'));assert.equal(contract.omittedPrototypeTests.length,4);
});

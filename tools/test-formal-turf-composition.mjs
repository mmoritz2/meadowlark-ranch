import {normalizePasturePassageAuditSource} from './pasture-passage-source-guard.cjs';
import {normalizeNorthFormalFormalAuditSource} from './north-formal-composition-source-guard.cjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import * as Merge from './formal-turf-composition-source-guard.cjs';
import {normalizeFormalApproachResumeSource} from './formal-approach-resume-source-guard.cjs';
import {normalizeActivityIncomingSource} from './activity-landscape-source-guard.cjs';
import {normalizeCourseTurfBladesSource} from './course-turf-blades-source-guard.cjs';
const root=new URL('../',import.meta.url),read=file=>normalizePasturePassageAuditSource(normalizeNorthFormalFormalAuditSource(fs.readFileSync(new URL(file,root),'utf8'),file),file);
const fixture='tools/fixtures/formal-turf-ff10ddd/contract.json',contract=JSON.parse(read(fixture));
const sha=s=>createHash('sha256').update(s).digest('hex');
const git=(ref,file)=>execFileSync('git',['show',ref+':'+file],{cwd:root,encoding:'utf8'});
function forward(before,rows){for(const c of rows){assert.equal(before.split(c.before).length-1,c.occurrences,'Unique independent parent literal');before=before.replace(c.before,c.after);}return before;}
const views={formal:{parent:contract.formalParent,source:Merge.normalizeFormalTurfFormalSource,observer:Merge.normalizeFormalTurfFormalObserver,fixture:Merge.normalizeFormalTurfFormalFixtures,groups:contract.toFormal},incoming:{parent:contract.incomingParent,source:Merge.normalizeFormalTurfIncomingSource,observer:Merge.normalizeFormalTurfIncomingObserver,fixture:Merge.normalizeFormalTurfIncomingFixtures,groups:contract.toIncoming}};
test('Historical7a6 both whole owner views independently reconstruct raw Git parents and exact merged imports',()=>{
 assert.equal(contract.formalParent,'ff10ddd21d0b57c40dd05b8eb188462e18ba9258');assert.equal(contract.incomingParent,'22b72cc2d182c921b5605f5d1fc00edac7f5d4ee');assert.equal(Object.keys(contract.files).length,2);assert.equal(contract.toFormal.length,7);assert.equal(contract.toIncoming.length,3);
 for(const [file,row]of Object.entries(contract.files)){const live=read(file);assert.equal(sha(live),row.mergedSHA256);assert.equal(Merge.assertFormalTurfCurrent(live,file),true);
  for(const[name,v]of Object.entries(views)){const before=git(v.parent,file);assert.equal(sha(before),row[name+'SHA256']);assert.equal(forward(before,v.groups.filter(c=>c.file===file)),live);assert.equal(v.source(live,file),before);assert.equal(v.source(before,file),before);}
 }
 const line=read('ranch3d.html').split('\n').find(l=>l.startsWith('import {FEATURES}'));assert(line.includes('formal-approach-resume-1-programme-club-regroup-1'));assert(line.endsWith("fieldstone-walls-4-mown-course-turf-4';"));
});
test('Historical7a6 26 whole observer views retain exact independent parent assertions and reject edited current metadata',()=>{
 assert.equal(Object.keys(contract.observers).length,21);let n=0;
 for(const[file,row]of Object.entries(contract.observers))for(const[name,entry]of Object.entries(row)){n++;const live=read(file),before=git(views[name].parent,file);assert.equal(sha(before),entry.beforeSHA256);assert.equal(sha(live),entry.afterSHA256);assert.equal(forward(before,entry.changes),live);assert.equal(views[name].observer(live,file),before);assert.equal(views[name].observer(before,file),before);assert.equal(Merge.assertFormalTurfCurrent(live,file),true);assert.throws(()=>views[name].observer(live+'\n// assertion drift',file));}
 assert.equal(n,26);
});
test('both parent gameplay and terrain remain raw unchanged outside overlapping import owners',()=>{
 for(const[name,files]of [['formal',contract.strictFormalFiles],['incoming',contract.strictIncomingFiles]]){assert.equal(Object.keys(files).length,7);for(const[file,hash]of Object.entries(files)){const live=read(file);assert.equal(live,git(views[name].parent,file));assert.equal(sha(live),hash);assert.equal(Merge.assertFormalTurfCurrent(live,file),true);assert.throws(()=>Merge.assertFormalTurfCurrent(live+'\n// mutation',file));}}
});
test('unknown runtime, import, duplicate, mixed and missing groups are not approved',()=>{
 for(const[file,row]of Object.entries(contract.files)){const live=read(file);for(const bad of [live+'\n// unrelated runtime',live.replace("?v=formal-approach-resume-1","?v=unknown-version")]){assert.throws(()=>Merge.assertFormalTurfCurrent(bad,file));for(const v of Object.values(views)){if(v.groups.some(c=>c.file===file&&bad.includes(c.after)))assert.throws(()=>v.source(bad,file));else assert.equal(v.source(bad,file),bad,'No exact marker does not approve a changed current body');}assert.throws(()=>normalizeActivityIncomingSource(bad,file));assert.throws(()=>normalizeCourseTurfBladesSource(bad,file));}}
 for(const[name,v]of Object.entries(views))for(const c of v.groups){const live=read(c.file);for(const bad of [live.replace(c.after,''),live+'\n'+c.after,live+'\n'+c.before]){assert.throws(()=>Merge.assertFormalTurfCurrent(bad,c.file));if(v.groups.some(r=>r.file===c.file&&bad.includes(r.after)))assert.throws(()=>v.source(bad,c.file));else assert.equal(v.source(bad,c.file),bad,'No-marker pass-through is never current approval');}}
});
test('173 original fixture blobs are raw Git-identical across both parents',()=>{
 const union=new Set();for(const[name,v]of Object.entries(views)){const rows=execFileSync('git',['ls-tree','-r','--format=%(objectname) %(path)',v.parent,'tools/fixtures'],{cwd:root,encoding:'utf8'}).trim().split('\n');assert.equal(rows.length,contract.fixtureCounts[name]);for(const row of rows){const at=row.indexOf(' '),file=row.slice(at+1),bytes=fs.readFileSync(new URL(file,root));union.add(file);assert.equal(createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex'),row.slice(0,at),file);}}
 assert.equal(union.size,173);assert.equal(contract.fixtureCounts.union,173);
});
test('fixture filters remove only exact other-parent declarations and retain unknown paths',()=>{
 for(const[name,v]of Object.entries(views)){const allowed=Object.keys(contract.approvedAddedByView[name]);assert.equal(allowed.length,name==='formal'?6:1);for(const file of allowed){assert.equal(sha(read(file)),contract.approvedAddedByView[name][file]);assert.equal(v.fixture(file+'\n',contract.fixtureBaseline),'');}assert.equal(v.fixture(fixture+'\n',contract.fixtureBaseline),'');const unknown='tools/fixtures/unknown/future.json\n';assert.equal(v.fixture(unknown,contract.fixtureBaseline),unknown);assert.throws(()=>v.fixture(fixture+'\n'+fixture+'\n',contract.fixtureBaseline));assert.throws(()=>v.fixture('', 'unknown-baseline'));}
});
test('old and incoming guards initialize independently and retain original full-body authorities',()=>{
 const require=createRequire(import.meta.url);for(const file of ['activity-landscape-source-guard.cjs','course-turf-blades-source-guard.cjs'])assert.doesNotThrow(()=>execFileSync(process.execPath,['-e',`require('./tools/${file}')`],{cwd:root}));
 for(const file of Object.keys(contract.files)){const raw=read(file),formal=git(contract.formalParent,file),incoming=git(contract.incomingParent,file);assert.equal(normalizeActivityIncomingSource(raw,file),normalizeActivityIncomingSource(formal,file));assert.equal(normalizeFormalApproachResumeSource(Merge.normalizeFormalTurfFormalSource(raw,file),file),normalizeFormalApproachResumeSource(formal,file));assert.equal(normalizeCourseTurfBladesSource(raw,file),normalizeCourseTurfBladesSource(incoming,file));}
 assert.equal(require('./formal-turf-composition-source-guard.cjs').assertFormalTurfCurrent(read('ranch3d.html'),'ranch3d.html'),true);
});
test('leaf is built-in-only and corrupt/missing declarations fail before old guard initialization',()=>{
 const leaf=read('tools/formal-turf-composition-source-guard.cjs');assert.deepEqual([...leaf.matchAll(/require\('([^']+)'\)/g)].map(m=>m[1]),['node:fs','node:path','node:assert/strict','node:crypto']);
 function load(value){const module={exports:{}};new Function('require','module','exports','__dirname',leaf)(name=>name==='node:fs'?{...fs,readFileSync(f,...args){if(String(f).endsWith(fixture)){if(value===null)throw Error('Missing approved declaration');return value;}return fs.readFileSync(f,...args);}}:name==='node:path'?path:name==='node:assert/strict'?assert:name==='node:crypto'?{createHash}:null,module,module.exports,new URL('tools/',root).pathname);return module.exports;}
 assert.doesNotThrow(()=>load(read(fixture)));assert.throws(()=>load(read(fixture)+'\n'),/Exact approved/);assert.throws(()=>load(null),/Missing approved/);assert.equal(Merge.normalizeFormalTurfFormalAuditSource('unchanged skeleton','assets/native-horse-motion.js'),'unchanged skeleton');
});

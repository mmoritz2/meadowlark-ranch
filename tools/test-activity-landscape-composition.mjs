import {normalizeFormalApproachResumeAuditSource} from './formal-approach-resume-source-guard.cjs';
import {normalizeProgrammeRegroupAuditSource} from './programme-regroup-source-guard.cjs';
import {normalizeHorseTrainingAuditSource} from './horse-training-source-guard.cjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {normalizeActivityIncomingSource,normalizeActivityParentSource,normalizeActivityIncomingObserverSource,normalizeActivityParentObserverSource,normalizeActivityFixtureChanges} from './activity-landscape-source-guard.cjs';
import {normalizeReviewedWorldSource} from './reviewed-riding-source-guard.cjs';
const root=new URL('../',import.meta.url),read=file=>normalizeHorseTrainingAuditSource(normalizeProgrammeRegroupAuditSource(normalizeFormalApproachResumeAuditSource(fs.readFileSync(new URL(file,root),'utf8'),file),file),file),sha=s=>createHash('sha256').update(s).digest('hex');
const contract=JSON.parse(read('tools/fixtures/activity-landscape-6a82f3f/contract.json'));
const git=(rev,file)=>execFileSync('git',['show',rev+':'+file],{cwd:root,encoding:'utf8'});
const names=(rev,folder)=>execFileSync('git',['ls-tree','-r','--name-only',rev,folder],{cwd:root,encoding:'utf8'}).trim().split('\n');
const wall=JSON.parse(read('tools/fixtures/meadow-relief-wall-b1a73b1/contract.json'));
const lash=JSON.parse(read('tools/fixtures/lash-cache-df065bd/contract.json'));

test('all merged owners are independently reproducible from BOTH full Git parents, including the exact combined FEATURES edge',()=>{
 assert.equal(contract.toIncoming.length,11);assert.equal(contract.toActivity.length,5);
 for(const [file,row]of Object.entries(contract.files)){
  const live=read(file);assert.equal(sha(live),row.mergedSHA256);
  for(const [view,rev,changes,normalize]of [
   ['incoming',contract.incomingParent,contract.toIncoming,normalizeActivityIncomingSource],
   ['activity',contract.activityParent,contract.toActivity,normalizeActivityParentSource],
  ]){
   const parent=git(rev,file);assert.equal(sha(parent),row[view+'SHA256']);
   let authored=parent;
   for(const c of changes.filter(c=>c.file===file)){if(c.before)assert.equal(authored.split(c.before).length-1,1);authored=authored.replace(c.before,c.after);}
   assert.equal(authored,live,'The exact merged bytes are authored from '+view+' without using the projection as expected oracle');
   assert.equal(normalize(live,file),parent);
  }
 }
});

test('incoming wall, relief and rider bodies remain direct byte-exact production sources',()=>{
 const incoming=execFileSync('git',['diff','--name-only',contract.baseline,contract.incomingParent,'--','assets'],{cwd:root,encoding:'utf8'}).trim().split('\n');
 assert(incoming.includes('assets/coursed-field-wall.mjs')&&incoming.includes('assets/rider-face.js'));
 for(const file of incoming)if(!contract.files[file])assert.equal(read(file),git(contract.incomingParent,file),file+' production retains incoming geometry/material/rig behavior');
});

test('unknown, duplicate, deleted, extended, mixed or changed activity imports cannot pass the combined original source chain',()=>{
 for(const c of contract.toIncoming){
  const live=read(c.file),bad=[live.replace(c.after,''),live+'\n'+c.after,live.replace(c.after,c.after+'/* unauthorized */')];
  if(c.before)bad.push(live+'\n'+c.before);
  if(c.kind==='cache')bad.push(live.replace(c.after,c.after.replace(/\?v=[^']+/,'?v=unknown-next')));
  for(const source of bad)assert.throws(()=>normalizeReviewedWorldSource(source,c.file));
 }
 for(const file of Object.keys(contract.files))assert.throws(()=>normalizeReviewedWorldSource(read(file)+'\n// unauthorized rider/auth/XP/body change',file));
});

test('both observer maps independently reconstruct complete parent assertions; changed or partial adapters cannot pass',()=>{
 for(const [file,views]of Object.entries(contract.observers))for(const [view,row]of Object.entries(views)){
  const live=read(file),rev=view==='incoming'?contract.incomingParent:contract.activityParent,parent=git(rev,file);
  assert.equal(sha(parent),row.beforeSHA256);assert.equal(sha(live),row.afterSHA256);
  let authored=parent;for(const c of row.changes){assert.equal(authored.split(c.before).length-1,1);authored=authored.replace(c.before,c.after);}
  assert.equal(authored,live,'Only the exact declared observer additions differ');
  const normalize=view==='incoming'?normalizeActivityIncomingObserverSource:normalizeActivityParentObserverSource;
  assert.equal(normalize(live,file),parent);
  for(const bad of [live+'\n// altered assertion',live.replace(row.changes[0].after,''),live+'\n'+row.changes[0].after])assert.throws(()=>normalize(bad,file));
 }
});

test('every allowed historical observer SHA comes from an existing fixed contract or complete Git parent',()=>{
 for(const [file,hashes]of Object.entries(contract.historicalObserverSHA256)){
  const expected=new Set([...(wall.historicalTestSHA256[file]||[]),...(lash.observerApprovedPreimageSHA256[file]||[]),wall.testAdapterPreimages[file],lash.observerBeforeSHA256[file]].filter(Boolean));
  for(const rev of [contract.baseline,contract.activityParent,contract.incomingParent]){try{expected.add(sha(git(rev,file)));}catch{}}
  assert.deepEqual(new Set(hashes),expected,file+' has no arbitrary source bypass');
 }
});

test('all original155 and incoming8 fixture bytes remain exactly pinned; only declared added fixture rows leave the old assertion input',()=>{
 const original=names(contract.activityParent,'tools/fixtures'),incoming=names(contract.incomingParent,'tools/fixtures');
 assert.equal(original.length,155);assert.equal(incoming.filter(file=>!original.includes(file)).length,8);
 for(const rev of [contract.activityParent,contract.incomingParent]){
  const blobs=execFileSync('git',['ls-tree','-r','--format=%(objectname) %(path)',rev,'tools/fixtures'],{cwd:root,encoding:'utf8'}).trim().split('\n');
  for(const row of blobs){const split=row.indexOf(' '),expected=row.slice(0,split),file=row.slice(split+1),data=fs.readFileSync(new URL(file,root));
   const actual=createHash('sha1').update('blob '+data.length+'\0').update(data).digest('hex');assert.equal(actual,expected,file+' raw fixture bytes');
  }
 }
 assert.equal(normalizeActivityFixtureChanges(Object.keys(contract.approvedAddedFixtures).join('\n')+'\n',contract.baseline),'');
 const old='tools/fixtures/progression-loop-243dbfb/contract.json\n';assert.equal(normalizeActivityFixtureChanges(old,contract.baseline),old);
 const unknown='tools/fixtures/unknown-bypass/contract.json\n';assert.equal(normalizeActivityFixtureChanges(unknown,contract.baseline),unknown);
 assert.throws(()=>normalizeActivityFixtureChanges(unknown+unknown,contract.baseline));
 assert.throws(()=>normalizeActivityFixtureChanges('',contract.activityParent));
});

test('incoming raw dependency pins are unchanged and the outer layer remains leaf-only',()=>{
 for(const [file,hash]of Object.entries(wall.dependencySHA256))assert.equal(sha(normalizeActivityIncomingObserverSource(read(file),file)),hash,file+' retains incoming expected SHA');
 const source=read('tools/activity-landscape-source-guard.cjs'),required=[...source.matchAll(/require\('([^']+)'\)/g)].map(m=>m[1]);
 assert.deepEqual(required,['node:fs','node:path','node:assert/strict','node:crypto']);
 assert.equal(normalizeActivityIncomingSource('live reward behavior','assets/features/cottonwood-post.js'),'live reward behavior');
});

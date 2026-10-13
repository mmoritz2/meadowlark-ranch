import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {normalizeMeadowReliefWallSource} from './meadow-relief-wall-source-guard.cjs';
import {normalizeLashCacheSource} from './lash-cache-source-guard.cjs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {normalizeProgressionLoopCacheSource} from './progression-loop-cache-source-guard.cjs';
import {normalizeProgressionHintsSource} from './progression-hints-source-guard.cjs';
import {normalizeReviewedRuntimeSource,normalizeReviewedWorldSource} from './reviewed-riding-source-guard.cjs';
import {normalizeStarterTackSource} from './starter-tack-source-guard.cjs';
import {normalizeGrassRibbonOwnSource} from './grass-ribbon-source-guard.cjs';
const root=new URL('../',import.meta.url),read=file=>normalizeLashCacheSource(normalizeMeadowReliefWallSource(fs.readFileSync(new URL(file,root),'utf8'),file),file);
const source=read('ranch3d.html'),contract=JSON.parse(read('tools/fixtures/progression-hints-243dbfb/contract.json'));
const sha=value=>createHash('sha256').update(value).digest('hex');
const method=source.match(/ui:\{(canAnnounce\(\)\{[^\n]+?\}),panel:uiPanel/)[1];
const call=Function('freshSave','$','document','G','course','return ({'+method+'}).canAnnounce();');
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
function fixture(save,{loading=false,menu=false,dialogue=false,course=null}={}){
 const frozen=freeze(structuredClone(save)),before=JSON.stringify(frozen);let reads=0;
 const freshSave=()=>{reads++;return frozen;};
 const $=id=>{assert.equal(id,'load');return loading?{}:null;};
 const document={body:{classList:{contains(name){assert.equal(name,'se-screen-open');return menu;}}}};
 return {run:()=>call(freshSave,$,document,{dialogue:{active:dialogue}},course),verify(){assert.equal(JSON.stringify(frozen),before);assert(reads>0);}};
}
const saved=(races=1,totalRaces=0)=>({story:{era:2,idx:14,prog:2},racing:{races,pts:255,claimed:{1:1}},totalRaces,coins:800,gems:9,horses:[{id:1,name:'Bramble',level:2,xp:70}]});

test('actual announcement gate accepts modern completed races even with a zero or missing legacy counter',()=>{
 for(const totalRaces of [0,undefined]){const f=fixture(saved(2,totalRaces));for(let i=0;i<3;i++)assert.equal(f.run(),true);f.verify();}
});
test('positive legacy race history stays compatible with absent or zero modern ledger',()=>{
 for(const racing of [undefined,{races:0}]){const f=fixture({...saved(0,3),racing});assert.equal(f.run(),true);f.verify();}
});
test('points, placings, best times and ribbons alone do not invent a completed race',()=>{
 for(const s of [saved(0,0),{...saved(0,0),racing:{pts:255},lad:{races:3},ribbons:{pp:4},bestTimes:{pp:22.6}},{story:{era:2}},{...saved(),racing:{races:-1},totalRaces:-1}]){const f=fixture(s);assert.equal(f.run(),false);f.verify();}
});
test('missing saves and pre-era-two stories remain quiet despite modern or legacy completions',()=>{
 for(const s of [null,{}, {...saved(),story:undefined},{...saved(),story:{era:1}},{...saved(0,10),story:{era:1}},{...saved(),story:{era:'2'}}]){const f=fixture(s);assert.equal(f.run(),false);f.verify();}
});
test('loading, menu, dialogue and active-course suppression are unchanged for both ledgers',()=>{
 for(const s of [saved(),saved(0,3)])for(const options of [{loading:true},{menu:true},{dialogue:true},{course:{ev:{id:'pp'},t:2}}]){const f=fixture(s,options);assert.equal(f.run(),false);f.verify();}
});
test('the real gate reads fresh progress every time without mutating it or writing rewards',()=>{
 let state=freeze(saved(0,0)),reads=0;const fresh=()=>{reads++;return state;};
 const args=[fresh,()=>null,{body:{classList:{contains:()=>false}}},{},null];
 assert.equal(call(...args),false);state=freeze(saved(1,0));assert.equal(call(...args),true);assert.equal(reads,2);assert.equal(state.totalRaces,0);assert.equal(state.racing.races,1);assert.equal(state.coins,800);
});
test('first-rides diagnostics expose real independent ledgers while preserving the legacy observation',()=>{
 const review=read('review/first-rides/review.js'),expression=review.match(/saveSummary:s\?(\{[^\n]+\}):null\};/)[1];
 const summarize=Function('s','return '+expression+';');
 const s=freeze({...saved(4,0),racing:{races:4,pts:255,wins:0,pvp:0},lad:{races:4,wins:2,podiums:2,rib:{total:8}},ribbonTotal:8});
 const before=JSON.stringify(s),out=summarize(s);assert.deepEqual(out.racing,{races:4,points:255,wins:0,pvp:0});assert.deepEqual(out.fieldRacing,{races:4,wins:2,podiums:2});assert.equal(out.totalRaces,0);assert.equal(out.ribbonTotal,8);assert.equal(out.ladderRibbonTotal,8);assert.equal(JSON.stringify(s),before);
 assert.deepEqual(summarize({}).racing,{races:0,points:0,wins:0,pvp:0});assert.deepEqual(summarize({}).fieldRacing,{races:0,wins:0,podiums:0});
});
test('exactly one approved predicate reconstructs the independently pinned243dbfb complete body',()=>{
 const original=execFileSync('git',['show',contract.baseline+':ranch3d.html'],{cwd:root,encoding:'utf8'}),{change}=contract;
 assert.equal(sha(original),contract.beforeSHA256);assert.equal(change.occurrences,1);assert.equal(original.split(change.before).length-1,1);
 assert.equal(sha(original.replace(change.before,change.after)),contract.afterSHA256);
 const projected=normalizeProgressionLoopCacheSource(normalizeGrassRibbonOwnSource(source,'ranch3d.html'),'ranch3d.html');
 assert.equal(projected,original.replace(change.before,change.after));assert.equal(normalizeProgressionHintsSource(projected,'ranch3d.html'),original);assert.equal(normalizeProgressionHintsSource(original,'ranch3d.html'),original);
});
test('unknown, duplicate, deleted and mixed eligibility changes cannot pass the exact adapter',()=>{
 const {before,after}=contract.change;
 for(const bad of [source.replace(after,after.replace('s.racing?.races>0','s.racing?.pts>0')),source.replace(after,after.replace('era===2','era>=1')),source.replace(after,''),source+'\n// '+after,source+'\n// '+before])assert.throws(()=>normalizeProgressionHintsSource(bad,'ranch3d.html'));
 assert.equal(normalizeProgressionHintsSource('unrelated module','assets/features/course-engine.js'),'unrelated module');
});
test('existing complete-body guards still reject unrelated runtime/cache drift after the narrow reversal',()=>{
 const incoming=execFileSync('git',['show','04ba300:ranch3d.html'],{cwd:root,encoding:'utf8'});
 assert.equal(normalizeReviewedRuntimeSource(normalizeGrassRibbonOwnSource(source,'ranch3d.html'),'ranch3d.html'),incoming);
 const projected=normalizeProgressionLoopCacheSource(normalizeGrassRibbonOwnSource(source,'ranch3d.html'),'ranch3d.html');
 for(const bad of [source+'\n// unrelated runtime edit',projected.replace('physical-ride-2-starter-tack-2-fieldstone-walls-3','unknown-cache'),source.replace('!G.dialogue?.active&&!course','!G.dialogue?.active')]){
  assert.throws(()=>normalizeReviewedWorldSource(bad,'ranch3d.html'));assert.throws(()=>normalizeStarterTackSource(bad,'ranch3d.html'));
 }
});

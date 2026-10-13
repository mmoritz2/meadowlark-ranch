import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {eventRibbonProgress} from '../assets/event-ribbon-progress.mjs';
const diffs=[{k:'novice'},{k:'open'},{k:'elite'}];
const copy=value=>structuredClone(value);
function record({rib=3,bestRib=rib,gold=false,bestGold=gold,diff='open'}={}){return {last:{id:'pp-run-one',eventId:'pp',diff,rib,stars:3,gold,accuracy:.89,time:22.6,faults:0,refusals:0,lineOff:0,at:1791912000000,saved:true},bestRib,bestGold};}
function save(rec){return {ribbons:{pp:3},ribbonGold:{},ribbonsBy:{'pp:open':4},ribbonAwards:{version:1,byDifficulty:{'pp:open':rec}}};}

test('the observed old fourth-ribbon conflict cannot appear as a gold or confirmed full set',()=>{
 const s={ribbons:{pp:3},ribbonGold:{},ribbonsBy:{'pp:open':4}},before=copy(s),r=eventRibbonProgress(s,'pp',diffs);
 assert.deepEqual(r.per,[0,3,0]);assert.deepEqual(r.perGold,[false,false,false]);assert.equal(r.golds,0);assert.equal(r.gold,false);assert.equal(r.historical[1],true);assert.deepEqual(s,before);
});
test('a saved final nongold receipt overrides an unverified fourth without granting or revoking save rewards',()=>{
 const s=save(record()),before=copy(s),r=eventRibbonProgress(s,'pp',diffs);
 assert.equal(r.per[1],3);assert.equal(r.golds,0);assert.equal(r.historical[1],false);assert.deepEqual(s,before);
});
test('a genuine confirmed gold and a lower later result preserve the best award',()=>{
 const s=save(record({rib:1,bestRib:4,gold:false,bestGold:true}));s.ribbons.pp=4;
 const r=eventRibbonProgress(s,'pp',diffs);assert.equal(r.per[1],4);assert.equal(r.golds,1);assert.equal(r.perGold[1],true);
});
test('a historical global gold remains visible after a later nongold round without inventing its difficulty',()=>{
 const s=save(record());s.ribbons.pp=4;s.ribbonGold.pp=true;const before=copy(s),r=eventRibbonProgress(s,'pp',diffs);
 assert.equal(r.per[1],4);assert.equal(r.golds,1);assert.deepEqual(r.perGold,[false,false,false]);assert.deepEqual(s,before);
});
test('confirmed golds are counted by difficulty without adding an extra global gold',()=>{
 const s=save(record({rib:4,gold:true}));s.ribbons.pp=4;s.ribbonGold.pp=true;s.ribbonAwards.byDifficulty['pp:elite']=record({rib:4,gold:true,diff:'elite'});
 assert.equal(eventRibbonProgress(s,'pp',diffs).golds,2);
});
test('empty, aggregate-only, malformed and unconfirmed saved records remain read-only and cannot fabricate a gold',()=>{
 assert.deepEqual(eventRibbonProgress(null,'pp',diffs).per,[0,0,0]);assert.deepEqual(eventRibbonProgress({ribbons:{pp:2}},'pp',diffs).per,[0,2,0]);
 for(const mutate of [r=>{r.last.saved=false;},r=>{r.last.id='';},r=>{r.last.eventId='other';},r=>{r.last.diff='elite';},r=>{r.last.rib=NaN;},r=>{r.bestRib=Infinity;},r=>{r.bestGold='true';}]){
  const rec=record({rib:4,gold:true});mutate(rec);const s=save(rec),before=copy(s),r=eventRibbonProgress(s,'pp',diffs);assert.equal(r.golds,0);assert.equal(r.per[1],3);assert.deepEqual(s,before);
 }
});
test('the actual event card ribbon resolver reads the final judged helper',()=>{
 const source=fs.readFileSync(new URL('../assets/features/se-events.js',import.meta.url),'utf8'),start=source.indexOf(' function ribbonsOf('),end=source.indexOf(' const statLbl=',start);
 assert(start>=0&&end>start);const resolver=new Function('eventRibbonProgress','DIFFS',source.slice(start,end)+'return ribbonsOf;')(eventRibbonProgress,()=>diffs);
 assert.equal(resolver({id:'pp'},save(record())).golds,0);assert.equal(resolver({id:'pp'},save(record())).per[1],3);assert.match(source,/rb\.historical\[di\]/);assert.match(source,/k===3&&rb\.perGold\[i\]/);
});


test('the actual ladder cannot display unsaved gold from its provisional cached grade',()=>{
 const source=fs.readFileSync(new URL('../assets/features/events2-ladder.js',import.meta.url),'utf8'),line=source.split('\n').find(l=>l.startsWith(' const goldOf='));assert(line);
 const goldOf=new Function('lastRB',line+'return goldOf;')({id:'pp',gold:true});
 assert.equal(goldOf({id:'pp'},{saved:false,gold:false}),false);assert.equal(goldOf({id:'pp'},{saved:false,gold:true}),false);assert.equal(goldOf({id:'pp'},{saved:true,gold:true}),true);assert.equal(goldOf({id:'pp'},{}),true,'Legacy callers preserve their existing cached-grade fallback');
});

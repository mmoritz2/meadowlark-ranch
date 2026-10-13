import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {eventRibbonProgress} from '../assets/event-ribbon-progress.mjs';

// Execute the Journey screen's production figures and card action. Only DOM
// presentation and the event gate inputs are scoped; judging and saves stay pure.
const source=fs.readFileSync(new URL('../assets/features/se-journey.js',import.meta.url),'utf8');
const diffs=[{k:'novice'},{k:'open'},{k:'elite'}];
const figuresStart=source.indexOf(' const ribbonsOf='),figuresEnd=source.indexOf(' F.race=',figuresStart);
assert(figuresStart>0&&figuresEnd>figuresStart);
assert.match(source,/import \{eventRibbonProgress\} from '\.\.\/event-ribbon-progress\.mjs\?v=final-ribbon-1';/);
const makeFigures=new Function('eventRibbonProgress','G','T','DISC_T','clampPct','nx',
 'const F={};'+source.slice(figuresStart,figuresEnd)+'return {ribbonsOf,discipline:F.disc};');
const labels={race:'Racing',jump:'Show Jumping',xc:'Cross Country',dressage:'Dressage',show:'Showmanship'};
const discOf=ev=>ev.disc||(ev.race?'race':ev.dressage?'dressage':'jump');
const pp={id:'pp',name:'Pasture Pony Dash',town:'Meadowlark Ranch',lvl:1,race:true};
function figures({events=[pp],difficulties=diffs,ready=()=>true}={}){
 const G={horse:{ridden:()=>({id:1,name:'Bramble',level:2})},course:{DIFFS:difficulties,eventOk:ev=>({ok:ready(ev)})},events2:{discOf:ev=>({k:discOf(ev)})}};
 return makeFigures(eventRibbonProgress,G,{EVENTS3:events},labels,v=>Math.max(0,Math.min(100,Math.round(v))),v=>String(v));
}
const record=({rib=3,bestRib=rib,gold=false,bestGold=gold,diff='open',id='pp-run-one'}={})=>({
 last:{id,eventId:'pp',diff,rib,stars:3,gold,accuracy:.89,time:22.6,faults:0,refusals:0,lineOff:0,at:1791912000000,saved:true},bestRib,bestGold});
const legacy=()=>({ribbons:{pp:3},ribbonGold:{},ribbonsBy:{'pp:open':4}});
const saved=rec=>({...legacy(),ribbonAwards:{version:1,byDifficulty:{'pp:open':rec}}});
function inspect(s,options){const before=structuredClone(s),f=figures(options),r=f.ribbonsOf(pp,s),d=f.discipline(s,'race');assert.deepEqual(s,before);return {r,d};}

test('the observed contradictory legacy fourth ribbon displays 3/12 in Journey, matching Riding Events',()=>{
 const {r,d}=inspect(legacy());assert.deepEqual(r.per,[0,3,0]);assert.equal(r.sum,3);assert.equal(r.golds,0);assert.equal(r.gold,false);
 assert.equal(d.x,3);assert.equal(d.y,12);assert.equal(d.pct,25);assert.match(d.status,/3 of 12 ribbons/);
 assert.equal(r.historical[1],true);
});
test('the actual accepted final race receipt stays authoritative after reload without touching its older record',()=>{
 const evidence=JSON.parse(fs.readFileSync(new URL('../review/first-rides/physical-riding-20261013/final-integrated-race.json',import.meta.url),'utf8'));
 const {ribbons,ribbonsBy,ribbonGold,ribbonAwards}=evidence.report.saveSummary,s={ribbons,ribbonsBy,ribbonGold,ribbonAwards};
 assert.equal(s.ribbonsBy['pp:open'],4);assert.equal(s.ribbonAwards.byDifficulty['pp:open'].last.rib,3);
 const {r,d}=inspect(s);assert.equal(r.sum,3);assert.equal(r.golds,0);assert.equal(d.x,3);assert.equal(d.pct,25);
 assert.deepEqual(r,eventRibbonProgress(s,'pp',diffs));assert.equal(s.ribbonsBy['pp:open'],4);
});
test('a confirmed gold survives a weaker later ride and is counted in its earned difficulty',()=>{
 const s=saved(record({rib:1,bestRib:4,bestGold:true}));s.ribbons.pp=4;
 const {r,d}=inspect(s);assert.deepEqual(r.per,[0,4,0]);assert.deepEqual(r.perGold,[false,true,false]);assert.equal(r.golds,1);assert.equal(r.gold,true);assert.equal(d.x,4);
});
test('a legitimate older global gold remains visible without inventing the difficulty or changing saved rewards',()=>{
 for(const s of [{ribbons:{pp:4},ribbonsBy:{'pp:open':4},ribbonGold:{pp:true}},saved(record())]){
  s.ribbons.pp=4;s.ribbonGold.pp=true;const {r,d}=inspect(s);
  assert.equal(r.sum,4);assert.equal(r.golds,1);assert.deepEqual(r.perGold,[false,false,false]);assert.equal(d.x,4);
 }
});
test('malformed and unconfirmed award receipts cannot give Journey a false gold or fourth ribbon',()=>{
 for(const mutate of [r=>{r.last.saved=false;},r=>{r.last.id='';},r=>{r.last.eventId='other';},r=>{r.last.diff='elite';},r=>{r.last.rib=NaN;},r=>{r.bestRib=Infinity;},r=>{r.bestGold='true';}]){
  const rec=record({rib:4,gold:true});mutate(rec);const {r,d}=inspect(saved(rec));
  assert.equal(r.sum,3);assert.equal(r.golds,0);assert.equal(d.x,3);assert.equal(d.pct,25);
 }
});
test('every configured difficulty uses the same confirmed and historical sources as event cards',()=>{
 const s=saved(record());s.ribbons.pp=4;s.ribbonsBy['pp:novice']=2;s.ribbonsBy['pp:elite']=4;
 s.ribbonAwards.byDifficulty['pp:elite']=record({rib:4,gold:true,diff:'elite',id:'pp-elite'});
 const {r,d}=inspect(s);assert.deepEqual(r.per,[2,3,4]);assert.deepEqual(r.perGold,[false,false,true]);assert.equal(r.golds,1);assert.equal(d.x,9);assert.equal(d.y,12);assert.equal(d.pct,75);
 const reordered=[diffs[2],diffs[0],diffs[1]],other=inspect(s,{difficulties:reordered});assert.deepEqual(other.r.per,[4,2,3]);assert.equal(other.d.x,9);
 assert.deepEqual(other.r,eventRibbonProgress(s,'pp',reordered));
});
test('aggregate-only older progress lands in the actual Open difficulty while empty saves remain empty',()=>{
 const reordered=[diffs[2],diffs[0],diffs[1]];
 assert.deepEqual(inspect({ribbons:{pp:2}},{difficulties:reordered}).r.per,[0,0,2]);
 assert.equal(inspect({}).d.x,0);assert.equal(inspect({}).r.golds,0);
});
test('the real Journey card action still opens its accessible next event without starting a ride or altering the save',()=>{
 const rr={id:'rr',name:'River Run',town:'Kestrel Basin',lvl:1,race:true},locked={id:'r1',name:'Grand Loop',town:'Kestrel Basin',lvl:3,race:true};
 const s=saved(record()),before=structuredClone(s),f=figures({events:[pp,locked,rr],ready:ev=>ev.id!=='r1'}),state=f.discipline(s,'race');
 assert.equal(state.next,'rr');assert.match(state.sub,/Next: River Run/);
 const calls=[],G={hidePanels:()=>calls.push(['hide'])},K={setBack:(id)=>calls.push(['back',id])},EV={open:()=>calls.push(['events']),openPage:id=>calls.push(['page',id])};
 const begin=source.indexOf(' function openEvents('),end=source.indexOf(' function openLadder(',begin);assert(begin>0&&end>begin);
 const openEvents=new Function('G','K','EV','reopen','setTimeout','$',source.slice(begin,end)+'return openEvents;')(G,K,EV,()=>{},fn=>fn(),()=>null);
 const goBegin=source.indexOf(' function go('),goEnd=source.indexOf(" root.addEventListener('click'",goBegin);assert(goBegin>0&&goEnd>goBegin);
 const go=new Function('CARD','st','rail','markSeen','openEvents','openLadder','openBuild','SPECIAL_GO','openTab','G',source.slice(goBegin,goEnd)+'return go;')(
  {race:{disc:'race'}},{figs:{race:state}},{scrollLeft:0,scrollTop:0},()=>{},openEvents,()=>assert.fail('No rank claim is ready.'),()=>assert.fail('Not a builder card.'),{},()=>assert.fail('Not a quest tab.'),G);
 go('race');assert.deepEqual(calls,[['hide'],['back','eventsPanel'],['events'],['page','rr']]);assert.deepEqual(s,before);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {decorBuilderPoints,ranchProgress} from '../assets/ranch-progress.mjs';

// Exercise the production region rules against the production story's actual
// insertion order, live catalogue, land-building points and core ranch level.
// These isolated saves never touch a browser or grant progress to a real rider.
const read=name=>fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');
const core=read('ranch3d.html'),world=read('assets/features/world.js'),story=read('assets/features/story-quests.js');
const ranch=read('assets/features/ranch.js'),tack=read('assets/features/tack-wardrobe.js'),breed=read('assets/features/breeding.js'),pvp=read('assets/features/events-pvp.js');
function section(source,a,b){const i=source.indexOf(a),j=source.indexOf(b,i);assert(i>=0&&j>i,a);return source.slice(i,j);}
function actualFunction(source,name){
 const match=new RegExp('(?:^|\\n) ?function '+name+'\\(').exec(source);assert(match,name);
 const start=match.index,open=source.indexOf('{',start);let depth=0;
 for(let i=open;i<source.length;i++){if(source[i]==='{')depth++;else if(source[i]==='}'&&--depth===0)return source.slice(start,i+1);}
 assert.fail('Function boundary: '+name);
}
function actualStory(){
 const ctx=vm.createContext({BREED_BOND:40});
 vm.runInContext(section(core,'const STORY=[','let storyIdx='),ctx);
 ctx.STORY=vm.runInContext('STORY',ctx);
 const Q={STORY:ctx.STORY,story:{insertBefore(index,rows){ctx.STORY.splice(index,0,...rows);}}};
 ctx.G={quest:Q};ctx.Q=Q;
 vm.runInContext(section(tack,' const M1=',' G.world.addNPC('),ctx);
 vm.runInContext(section(story," const PRO='Prologue:",' /* Reward bundles:'),ctx);
 vm.runInContext(section(breed,' {const ST=G.quest.STORY, tame=','\n\n /* ---- 14.'),ctx);
 return ctx.STORY;
}
function catalogue(){
 const ctx=vm.createContext({});
 vm.runInContext(section(core,'const DECOR_CAT={','const RANCH_PERKS='),ctx);
 ctx.DC=vm.runInContext('DECOR_CAT',ctx);
 vm.runInContext(section(ranch,' const NEW={','\n /* ================= 4.'),ctx);
 return {catalog:ctx.DC,levels:vm.runInContext('RANCH_LEVELS',ctx)};
}
const landCtx=vm.createContext({});
vm.runInContext(section(ranch,' const RANCHES=[',' /* Matching pieces pay a bonus'),landCtx);
vm.runInContext(actualFunction(ranch,'buildingsOf')+actualFunction(ranch,'extraPts'),landCtx);
const actualLandPoints=landCtx.extraPts;
const copy=value=>structuredClone(value);
const storyLevel=actualFunction(story,'ranchLevelOf');
const corePoints=[actualFunction(core,'decorPts'),actualFunction(core,'ranchPts'),actualFunction(core,'ranchLevel')].join('\n');
const regionRules=section(world,' const REGION_META={','\n /* Jumping events are laid');
const champSource=section(pvp,' const CHAMP_VENUES=',' /* --- showmanship')+actualFunction(pvp,'champVenue')+actualFunction(pvp,'champQualified');
function fixture({save={},index=1,progress=0,authority=true,land=true,season={n:0,day:8,def:{}}}={}){
 const state=copy({story:{idx:index,prog:progress},decor:[],builderBonus:0,ribbons:{},ribbonGold:{},...save});
 const {catalog,levels}=catalogue(),missions=actualStory(),refs=missions.slice(),trace={writes:0,pass:[],toasts:[],refresh:0,authoritative:0};
 const T={DECOR_CAT:catalog,RANCH_LEVELS:levels,REGIONS:[{name:'🏜️ Coyote Canyon',x:-220,z:130,r:120},{name:'🌾 Barleyfold Farms',x:215,z:-105,r:90},{name:'💦 Hollowpeak Falls',x:-150,z:-232,r:26},{name:'🏔️ Hollowpeak Heights',x:-160,z:-210,r:120}],EVENTS3:vm.runInNewContext(section(core,'const EVENTS3=[','/* Every route is surveyed')+'\nEVENTS3')};
 const Q={STORY:missions,storyIdx:()=>state.story.idx};
 const G={tables:T,quest:Q,time:{seasonNow:()=>season},save:{fresh:()=>state,sync(fn){trace.writes++;fn(state);}},xp:{passAdd:n=>trace.pass.push(n)}};
 if(land)G.ranch={extraPts:actualLandPoints};
 const canonical=vm.createContext({G,DECOR_CAT:catalog,RANCH_LEVELS:levels,Math,decorBuilderPoints,ranchProgress});
 vm.runInContext(corePoints,canonical);
 if(authority)G.ranchSys={ranchLevel(s){trace.authoritative++;return canonical.ranchLevel(s);}};
 const P={},ctx=vm.createContext({G,Q,T,P,S:G.save,Math,Date,ranchProgress,hyp:(a,b,x,z)=>Math.hypot(a-x,b-z),toast:s=>trace.toasts.push(s),refreshFtLocks:()=>trace.refresh++});
 vm.runInContext(regionRules+storyLevel+champSource,ctx);
 return {state,T,Q,refs,trace,G,P,core:canonical,storyLevel:ctx.ranchLevelOf,champ:ctx.champQualified,
  region:id=>P.regionById(id),open:id=>P.regionUnlocked(P.regionById(id),state),
  at(label,prog=0){const i=missions.findIndex(m=>m.label===label);assert(i>=0,label);state.story.idx=i;state.story.prog=prog;return i;},
  extra:()=>G.ranch?.extraPts?.(state)||0};
}

// Values cover the defect's three separate sources: earned quest rewards,
// price-derived decor added by ranch.js, and buildings saved on authored plots.
const mixed={decor:[{t:'fence'},{t:'lamp'},{t:'dragon_banner'},{t:'unknown-removed-piece'}],builderBonus:72,land:{b:{l1:{t:'paddock'}}}};
test('pure points match actual core across every threshold and every live catalogue piece',()=>{
 const f=fixture();
 for(const bonus of [0,59,60,159,160,319,320,559,560,899,900,1800]){
  const s={decor:[],builderBonus:bonus};
  assert.equal(ranchProgress(s,f.T.DECOR_CAT,f.T.RANCH_LEVELS).points,f.core.ranchPts(s));
  assert.equal(ranchProgress(s,f.T.DECOR_CAT,f.T.RANCH_LEVELS).level,f.core.ranchLevel(s));
 }
 for(const [type,piece] of Object.entries(f.T.DECOR_CAT)){
  const s={decor:[{t:type}],builderBonus:0};
  assert.equal(decorBuilderPoints(piece),f.core.decorPts(piece),type);
  assert.equal(ranchProgress(s,f.T.DECOR_CAT,f.T.RANCH_LEVELS).points,f.core.ranchPts(s),type);
 }
});
test('actual world and story delegate to the live canonical level without caching their own',()=>{
 const f=fixture({save:mixed});
 assert.equal(f.core.ranchPts(f.state),170);assert.equal(f.core.ranchLevel(f.state),3);
 assert.equal(f.P.ranchLevel(f.state),3);assert.equal(f.storyLevel(f.state),3);assert.equal(f.trace.authoritative,2);
 f.state.land.b={};assert.equal(f.P.ranchLevel(f.state),2);assert.equal(f.storyLevel(f.state),2);
 f.state.builderBonus=0;assert.equal(f.P.ranchLevel(f.state),1);assert.equal(f.storyLevel(f.state),1);
});
test('isolated world and story fallback include the same earned, price-derived and land points',()=>{
 const f=fixture({save:mixed,authority:false});
 assert.equal(f.P.ranchLevel(f.state),3);assert.equal(f.storyLevel(f.state),3);
 assert.equal(ranchProgress(f.state,f.T.DECOR_CAT,f.T.RANCH_LEVELS,f.extra()).points,170);
 f.state.land.b.l2={t:'house'};assert.equal(f.P.ranchLevel(f.state),4);assert.equal(f.storyLevel(f.state),4);
});
test('fallback works before land installation and reads it live after the module is available',()=>{
 const f=fixture({save:mixed,authority:false,land:false});
 assert.equal(f.P.ranchLevel(f.state),2);assert.equal(f.storyLevel(f.state),2);
 f.G.ranch={extraPts:actualLandPoints};assert.equal(f.P.ranchLevel(f.state),3);assert.equal(f.storyLevel(f.state),3);
});
test('four genuinely paid builder rewards count toward regional ranch level',()=>{
 const missions=actualStory().filter(m=>m.ridingAlternative),earned=missions.reduce((n,m)=>n+(m.reward.pts||0),0);
 assert.equal(earned,82);
 const f=fixture({save:{builderBonus:earned}});
 assert.equal(f.P.ranchLevel(f.state),2);assert.equal(f.core.ranchLevel(f.state),2);
 assert.equal(f.open('barleyfold'),true);assert.equal(f.open('coyote'),false,'Lv2 does not open the Lv3 alternative');
});
test('earned ranch Lv3 opens the pre-existing level alternative for the displayed level',()=>{
 const f=fixture({save:{builderBonus:82,land:{b:{l1:{t:'paddock'}}}}});
 assert.equal(f.core.ranchLevel(f.state),3);assert.equal(f.P.ranchLevel(f.state),3);
 for(const id of ['coyote','barleyfold','hollowpeak','falls'])assert.equal(f.open(id),true,id);
});
test('invalid removed decor and unrecognized land plots do not invent builder points',()=>{
 const f=fixture({save:{decor:[{t:'removed'}],land:{b:{bogus:{t:'stable'},l1:{t:'removed'}}}},authority:false});
 assert.equal(f.extra(),0);assert.deepEqual(ranchProgress(f.state,f.T.DECOR_CAT,f.T.RANCH_LEVELS,f.extra()),{points:0,level:1});
 assert.equal(f.open('coyote'),false);
});
test('region and story progress reads never change saved balances, ribbons, horse progress or cursors',()=>{
 for(const authority of [true,false]){
  const f=fixture({save:{...mixed,coins:321,horses:[{id:3,level:3,xp:131}],unlocked:{barleyfold:123},ribbons:{h1:3}},authority});
  const bytes=JSON.stringify(f.state),missions=JSON.stringify(f.Q.STORY);
  for(const rg of f.T.REGIONS){f.P.regionUnlocked(rg,f.state);f.P.ruleTrue(rg,f.state);f.P.lockText(rg);}
  f.P.ranchLevel(f.state);f.storyLevel(f.state);
  assert.equal(JSON.stringify(f.state),bytes);assert.equal(JSON.stringify(f.Q.STORY),missions);assert.equal(f.trace.writes,0);
 }
});
test('Coyote anchor follows the claimed five-ribbon mission and precedes Championship Final',()=>{
 const f=fixture(),rule=f.region('coyote').unlock.story;
 const at=f.Q.STORY.findIndex(m=>m.label===rule[0]),previous=f.Q.STORY[at-1],final=f.Q.STORY.findIndex(m=>m.ev==='w2');
 assert.equal(rule[0],'Earn 15 ribbons of any kind');assert.equal(at,23);assert(at<final);
 assert.equal(previous.type,'ribbons');assert.equal(previous.disc,'jump');assert.equal(previous.goal,5);
 assert.equal(f.open('coyote'),false,'new prologue riders stay gated');
 f.state.story.idx=at-1;f.state.story.prog=previous.goal;
 assert.equal(f.open('coyote'),false,'finished but unclaimed prior mission does not bypass turn-in');
 f.state.story.idx=at;f.state.story.prog=0;assert.equal(f.open('coyote'),true);
 assert.match(f.P.lockText(f.region('coyote')),/first five show-jumping ribbons/);
});
test('qualification-stage story unlock opens Coyote alone rather than opening the mountain early',()=>{
 const f=fixture();f.at('Earn 15 ribbons of any kind');
 assert.equal(f.open('coyote'),true);assert.equal(f.open('barleyfold'),true,'the unchanged earlier Welcome Jump anchor already opened this region');
 assert.equal(f.open('hollowpeak'),false);assert.equal(f.open('falls'),false);
 f.at('Win the Championship Final');assert.equal(f.open('coyote'),true);assert.equal(f.open('hollowpeak'),true);
});
test('earlier story insertion retains the semantic anchor and does not move saved progress itself',()=>{
 const f=fixture();const current=f.at('Earn 15 ribbons of any kind');
 f.Q.STORY.splice(0,0,{label:'A future prologue',type:'talk',goal:1});
 assert.equal(f.state.story.idx,current);assert.equal(f.open('coyote'),false,'a stale numeric cursor is not silently advanced');
 f.state.story.idx=current+1;assert.equal(f.open('coyote'),true,'existing migration may move the cursor without changing this rule');
});
test('all existing mission objects, goals and saved counters survive unlock recording',()=>{
 const f=fixture({save:{story:{idx:23,prog:7},coins:333,ribbons:{h1:3},ribbonGold:{h1:false},builderBonus:82}});
 const before=copy(f.state),missions=JSON.stringify(f.Q.STORY);f.P.ensureUnlocks();
 assert.equal(f.Q.STORY.length,f.refs.length);f.refs.forEach((m,i)=>assert.equal(f.Q.STORY[i],m));
 assert.equal(JSON.stringify(f.Q.STORY),missions);assert.deepEqual(f.state.story,before.story);
 for(const key of ['coins','ribbons','ribbonGold','builderBonus'])assert.deepEqual(f.state[key],before[key]);
 assert(f.state.unlocked.coyote);assert.equal(f.state.unlocked.hollowpeak,undefined);
});
test('permanent unlock history stays open below present requirements and retains timestamps',()=>{
 const f=fixture({save:{unlocked:{coyote:12345,hollowpeak:34567,falls:45678}}});
 assert.equal(f.open('coyote'),true);assert.equal(f.open('hollowpeak'),true);assert.equal(f.open('falls'),true);
 f.P.ensureUnlocks();assert.deepEqual(f.state.unlocked,{coyote:12345,hollowpeak:34567,falls:45678});assert.deepEqual(f.trace.pass,[]);
});
test('seasonal rotation and explicit open weeks still open temporarily without minting permanent access',()=>{
 for(const season of [{n:0,day:1,def:{}},{n:1,day:20,def:{openRegion:'coyote'}},{n:1,day:20,def:{openRegions:['coyote']}}]){
  const f=fixture({season});assert.equal(f.open('coyote'),true);assert.equal(f.P.ruleTrue(f.region('coyote'),f.state),false);
  f.P.ensureUnlocks();assert.equal(f.state.unlocked.coyote,undefined);assert.deepEqual(f.trace.pass,[]);
 }
 const f=fixture({season:{n:0,day:8,def:{}}});assert.equal(f.open('coyote'),false);
});
test('earned permanent unlock is recorded once with the original discovery reward, never ribbons',()=>{
 const f=fixture({save:{unlocked:{barleyfold:123}}});f.at('Earn 15 ribbons of any kind');
 const bytes=JSON.stringify(f.state.ribbons);assert.equal(f.P.ensureUnlocks().length,1);const when=f.state.unlocked.coyote;
 assert.deepEqual(f.trace.pass,[50]);assert.equal(f.P.ensureUnlocks().length,0);assert.equal(f.state.unlocked.coyote,when);assert.deepEqual(f.trace.pass,[50]);assert.equal(JSON.stringify(f.state.ribbons),bytes);
});
test('opening Coyote does not qualify its venue or bypass the actual four-venue Championship rules',()=>{
 const f=fixture();f.at('Win the Championship Final');assert.equal(f.open('coyote'),true);assert.equal(f.champ(f.state).ok,false);assert.equal(f.champ(f.state).n,0);
 f.state.ribbons={h1:2,a1:2,wt:2};assert.equal(f.champ(f.state).ok,false);assert.equal(f.champ(f.state).n,3);assert.equal(f.champ(f.state).venues.Coyote,false);
 f.state.ribbons.bd=1;assert.equal(f.champ(f.state).ok,false);
 f.state.ribbons.bd=2;assert.equal(f.champ(f.state).ok,true);assert.equal(f.champ(f.state).n,4);
 delete f.state.ribbons.bd;f.state.ribbonGold.bd=true;assert.equal(f.champ(f.state).ok,true,'the original legitimate gold alternative is preserved');
});

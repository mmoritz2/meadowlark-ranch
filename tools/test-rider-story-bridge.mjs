import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {install as installJourney} from '../assets/features/rider-journey.js';
import {install as installGuidance} from '../assets/features/story-guidance.js';
import {JOURNEY_CHAPTERS} from '../assets/features/rider-journey-rules.mjs';

// The actual UI installer runs with scoped DOM globals. Panels retain their real
// render functions and actions; neither claims nor guidance are replaced.
const uiSource=fs.readFileSync(new URL('../assets/features/rider-journey-ui.js',import.meta.url),'utf8').replace(/^export /gm,'');
const copy=value=>structuredClone(value);
function readySave(){return {coins:100,gems:4,keys:2,tack:[],horses:[{id:1,name:'Juniper',gear:{saddle:'old-saddle'}}],items:{carrot:3},
 rescueRides:{completions:1},ranchRush:{version:1,records:{'rush-pasture':{plays:1,medal:'bronze',bestCombo:2}}},
 story:{idx:0,prog:0,era:2,name:'Silver Fern',clues:[]}};}
function fixture(initial=readySave()){
 let saved=copy(initial),failWrite=false,failRead=false,failReadAfterWrite=false;
 const live={idx:saved.story?.idx??0,prog:saved.story?.prog??0},activity={course:null,drill:false,rescue:false,roundup:false,vehicle:null};
 const hooks=new Map(),actions=new Map(),panels=new Map(),nodes=new Map(),trace={events:[],effects:[],toasts:[],payments:[],writes:0};
 const node=tag=>({tagName:tag,id:'',style:{display:'none'},attributes:{},innerHTML:'',textContent:'',setAttribute(key,value){this.attributes[key]=String(value);}});
 const document={head:{appendChild(){}},createElement:node,getElementById:id=>nodes.get(id)||null};
 const missions=[
  {type:'talk',npc:'wren',talk:'mia',label:'Ask Mia about {name}',goal:1,reward:{c:20}},
  {type:'gallop',npc:'wren',label:'Ride with {name}',goal:100,reward:{c:25}},
  {type:'feed',npc:'wren',label:'Give {name} a treat',goal:1,reward:{c:30}},
 ];
 const G={
  save:{ensure(fn){fn(saved);},fresh(){return failRead?null:copy(saved);},sync(fn){const next=copy(saved);fn(next);if(!failWrite){saved=next;trace.writes++;if(failReadAfterWrite)failRead=true;}}},
  horse:{player:{pos:{x:0,z:0},speed:0},ridden:()=>copy(saved.horses?.[0]||{id:1}),genGear(rarity,slot,opts){const gear=JOURNEY_CHAPTERS.find(c=>c.reward.gear.rarity===rarity&&c.reward.gear.slot===slot&&c.reward.gear.set===opts.set).reward.gear;return {...copy(gear),id:'generated',lvl:1};},refreshTack(){},attachTack(){},dressSaddle(){}},
  quest:{STORY:missions,NPC_DEFS:[{id:'wren',name:'Grandpa Wren'},{id:'mia',name:'Mia'},{id:'theo',name:'Theo'}],storyIdx:()=>live.idx,storyProg:()=>live.prog},
  world:{groundH:()=>0,npcList:[{def:{id:'wren'},g:{visible:true,position:{x:-11,y:0,z:-15.8}}},{def:{id:'mia'},g:{visible:true,position:{x:7,y:0,z:4}}},{def:{id:'theo'},g:{visible:true,position:{x:12,y:0,z:9}}}]},
  money:{payReward(s,reward){s.coins+=reward.c;trace.payments.push(reward.c);},refreshWallet(){},rewardLabel:r=>r?.c?`${r.c} coins`:''},
  tables:{DECOR_CAT:{},FOODS3:{},STAT_LBL:{}},mul:()=>1,$:()=>null,
  course:{get:()=>activity.course,drillActive:()=>activity.drill},rescueRide:{snapshot:()=>({active:activity.rescue})},roundup:{state:()=>({active:activity.roundup})},trail:{ride:null},worldPkg:{vehicle:()=>activity.vehicle},
  riding:{selectGait:gait=>trace.effects.push(['gait',gait])},seCare:{open:tab=>trace.effects.push(['care',tab])},
  toast:message=>trace.toasts.push(message),hidePanels(){trace.effects.push(['hide']);for(const n of nodes.values())n.style.display='none';},
  seFrame:{screens:new Set(),settle(){}},on(event,fn){const list=hooks.get(event)||[];list.push(fn);hooks.set(event,list);},run(event,...args){trace.events.push({event,args:copy(args)});for(const fn of hooks.get(event)||[])fn(...args);},
  ui:{action:(name,fn)=>actions.set(name,fn),panel(def){panels.set(def.id,def);const n=node('div');n.id=def.id;nodes.set(def.id,n);},rerender(id){nodes.get(id).innerHTML=panels.get(id).render();},open(id){this.rerender(id);nodes.get(id).style.display='flex';},openEvents:()=>trace.effects.push(['events']),openCare:()=>trace.effects.push(['legacy-care'])},
 };
 installJourney(G);installGuidance(G);
 const installUI=Function('document','MutationObserver',uiSource+';return install;')(document,class{observe(){}});installUI(G);
 return {G,trace,activity,live,missions,document,get save(){return copy(saved);},set failWrite(value){failWrite=value;},set failRead(value){failRead=value;},set failReadAfterWrite(value){failReadAfterWrite=value;},edit(fn){fn(saved);},cursor(idx,prog=0){live.idx=idx;live.prog=prog;saved.story={...saved.story,idx,prog};},act:(action,arg)=>actions.get('journey')([action,arg]),render:()=>panels.get('riderJourneyPanel').render(),summary:()=>G.riderJourneyUI.summary()};
}
const card=html=>html.match(/<section class="journey-strip jr-story">[\s\S]*?<\/section>/)?.[0]||'';
const bridgePresent=f=>{for(const html of [f.render(),f.summary()])assert.match(card(html),/data-fx="journey:story"/);};
const bridgeAbsent=f=>{assert.equal(card(f.render()),'');assert.equal(card(f.summary()),'');};
function claimed(){const f=fixture();f.act('claim','first-partners');assert.equal(f.G.riderJourney.snapshot().chapters[0].status,'claimed');return f;}
const escaped=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

test('confirmed First Partners claim exposes the optional real story action in panel and summary without auto-starting it',()=>{
 const f=fixture(),story=copy(f.save.story),horse=copy(f.G.horse.player);assert.equal(f.G.riderJourney.snapshot().current.status,'ready');bridgeAbsent(f);f.act('story');assert.deepEqual(f.trace.effects,[]);
 f.act('claim','first-partners');bridgePresent(f);assert.equal(f.save.coins,250);assert.equal(f.save.tack.length,1);assert.equal(f.save.tack[0].id,'journey-first-partners');assert.equal(f.trace.events.filter(e=>e.event==='journeyClaim').length,1);assert.equal(f.G.riderJourneyUI.state().receiptId,'first-partners');assert.deepEqual(f.trace.effects,[]);assert.deepEqual(f.save.story,story);
 const step=f.G.storyGuidance.describe();for(const html of [f.render(),f.summary()]){assert.match(card(html),/Optional · Story/);assert(card(html).includes(`>${escaped(step.label)}</button>`));assert(card(html).includes(escaped(step.hint)));assert.match(card(html),/Silver Fern/);}
 const before=f.save;f.act('story');assert.deepEqual(f.trace.effects,[['hide']]);assert.deepEqual(f.save,before);assert.deepEqual(f.G.horse.player,horse);assert.equal(f.trace.events.filter(e=>e.event==='missionClaim').length,0);
 f.act('claim','first-partners');assert.equal(f.save.coins,250);assert.equal(f.save.tack.length,1);assert.equal(f.trace.events.filter(e=>e.event==='journeyClaim').length,1);
});

test('failed claim writes and forged claim notifications never expose the bridge',()=>{
 const f=fixture(),before=f.save;f.failWrite=true;f.act('claim','first-partners');assert.deepEqual(f.save,before);assert.equal(f.G.riderJourneyUI.state().receiptId,null);assert.equal(f.trace.events.some(e=>e.event==='journeyClaim'),false);bridgeAbsent(f);
 f.G.run('journeyClaim',{id:'first-partners',gearId:'journey-first-partners',coins:150});bridgeAbsent(f);f.act('story');assert.deepEqual(f.trace.effects,[]);assert.deepEqual(f.save,before);
});

test('a committed claim with failed readback recovers its bridge from saved state and reload without a second payment',()=>{
 const f=fixture(),story=copy(f.save.story);f.failReadAfterWrite=true;f.act('claim','first-partners');assert.equal(f.save.coins,250);assert.equal(f.save.tack.length,1);assert.equal(f.G.riderJourneyUI.state().receiptId,null);assert.equal(f.trace.events.some(e=>e.event==='journeyClaim'),false);bridgeAbsent(f);f.act('story');assert.deepEqual(f.trace.effects,[]);
 f.failReadAfterWrite=false;f.failRead=false;bridgePresent(f);const before=f.save;f.act('claim','first-partners');assert.deepEqual(f.save,before);assert.deepEqual(f.save.story,story);assert.deepEqual(f.trace.effects,[]);
 const reloaded=fixture(f.save);bridgePresent(reloaded);assert.equal(reloaded.G.riderJourneyUI.state().receiptId,null);reloaded.act('claim','first-partners');assert.equal(reloaded.save.coins,250);assert.equal(reloaded.save.tack.length,1);assert.deepEqual(reloaded.trace.payments,[]);const reloadBefore=reloaded.save;reloaded.act('story');assert.deepEqual(reloaded.trace.effects,[['hide']]);assert.deepEqual(reloaded.save,reloadBefore);
});

test('the story button resolves the latest mission at click time instead of its rendered action',()=>{
 const f=claimed();assert.match(card(f.render()),/>Find Mia<\/button>/);f.cursor(1,0);const before=f.save;f.act('story');assert.deepEqual(f.trace.effects,[['hide'],['gait','gallop']]);assert.deepEqual(f.save,before);
 assert.match(card(f.render()),/>Select Gallop<\/button>/);f.cursor(2,0);f.trace.effects.length=0;const second=f.save;f.act('story');assert.deepEqual(f.trace.effects,[['care','feeding']]);assert.deepEqual(f.save,second);
});

test('missing, malformed, unreadable and live-mismatched story saves expose no action',()=>{
 const cases=[
  f=>f.edit(s=>{delete s.story;}),f=>{f.failRead=true;},
  f=>f.edit(s=>{s.story.idx='0';}),f=>f.edit(s=>{s.story.idx=-1;}),f=>f.edit(s=>{s.story.idx=.5;}),
  f=>f.edit(s=>{s.story.prog='0';}),f=>f.edit(s=>{s.story.prog=-1;}),f=>f.edit(s=>{s.story.prog=NaN;}),
  f=>{f.live.idx=1;},f=>{f.live.prog=1;},f=>{delete f.G.storyGuidance;},
 ];
 for(const alter of cases){const f=claimed();alter(f);const before=f.save;bridgeAbsent(f);f.act('story');assert.deepEqual(f.trace.effects,[]);assert.deepEqual(f.save,before);assert.match(f.trace.toasts.at(-1),/unavailable|save is ready/);}
});

test('a completed story has no bridge even when the Journey claim remains permanently earned',()=>{
 const f=claimed();f.cursor(f.missions.length,0);const before=f.save;bridgeAbsent(f);f.act('story');assert.deepEqual(f.trace.effects,[]);assert.deepEqual(f.save,before);assert.equal(f.G.riderJourney.snapshot().chapters[0].status,'claimed');
});

test('renamed mares are read fresh and escaped, while the prologue bridge avoids later plot claims',()=>{
 const f=claimed();f.edit(s=>{s.story.name='Moon <img> & "Rain"';});for(const html of [f.render(),f.summary()]){const actual=card(html);assert.match(actual,/Moon &lt;img&gt; &amp; &quot;Rain&quot;/);assert(!actual.includes('<img>'));assert(!actual.includes('Silver Fern'));}
 f.edit(s=>{s.story.name='';s.story.era=1;});f.missions[0]={type:'name',npc:'wren',book:'Prologue',label:'Name the grey foal',goal:1,reward:{c:10}};const before=f.save;
 for(const html of [f.render(),f.summary()]){const actual=card(html);assert.match(actual,/grey foal/);assert.match(actual,/Clover is the pinto you rescued/);assert.doesNotMatch(actual,/missing|lost|storm|two summers|search for|disappeared/i);}
 f.act('story');assert.deepEqual(f.trace.effects,[['hide']]);assert.deepEqual(f.save,before);
});

test('busy rides and vehicles block the bridge without closing screens or changing progress',()=>{
 for(const kind of ['course','drill','rescue','roundup','trail','vehicle']){const f=claimed();bridgePresent(f);if(kind==='trail')f.G.trail.ride={managed:'some-ride'};else f.activity[kind]=kind==='course'||kind==='vehicle'?{}:true;const before=f.save;f.act('story');assert.deepEqual(f.trace.effects,[],kind);assert.deepEqual(f.save,before);assert.match(f.trace.toasts.at(-1),/Finish or leave your current ride/);}
});


test('the real panel keeps its earned receipt and current riding action before the optional story, with collection in the second column',()=>{
 const f=claimed(),before=f.save,html=f.render();
 const earned=html.indexOf('class="jr-earned"'),layout=html.indexOf('class="jr-layout"'),column=html.indexOf('class="jr-primary-column"'),current=html.indexOf('class="jr-current"'),primary=html.indexOf('id="followJourney"'),story=html.indexOf('class="journey-strip jr-story"'),collection=html.indexOf('class="jr-collection"');
 assert(earned>=0&&earned<layout&&layout<column&&column<current&&current<primary&&primary<story&&story<collection);
 assert.match(html.slice(story,collection),/<\/section><\/div><aside $/);
 assert.equal((html.match(/data-fx="journey:story"/g)||[]).length,1);
 const summary=f.summary();assert(summary.indexOf('data-fx="journey:start"')<summary.indexOf('data-fx="journey:story"'),'the result summary continues to put the riding action first');
 assert.deepEqual(f.save,before);assert.deepEqual(f.trace.effects,[]);
 f.edit(s=>{delete s.story;});const withoutStory=f.render();assert.match(withoutStory,/<div class="jr-primary-column"><section class="jr-current">/);assert.equal(card(withoutStory),'');assert(withoutStory.indexOf('id="followJourney"')<withoutStory.indexOf('class="jr-collection"'));
});

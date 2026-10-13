import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {eventPreparation,horseLevelPreparation} from '../assets/features/event-preparation.js';
import {eventHorseById} from '../assets/features/event-horse-comparison.mjs';

const source=readFileSync(new URL('../assets/features/se-events.js',import.meta.url),'utf8');
const core=readFileSync(new URL('../ranch3d.html',import.meta.url),'utf8');
const section=(text,a,b)=>{const start=text.indexOf(a),end=text.indexOf(b,start);assert(start>=0&&end>start,`Source section ${a}`);return text.slice(start,end);};
const statSource=section(core,'const MAX_LEVEL=','function ensureStats(');
const coreRules=new Function('BREED_CEIL','BREEDS3','TIER_BASE',statSource+'return {MAX_LEVEL,statCap,statCeil,statNeed};')({bay:{all:8,jump:8,stamina:8},pinto:{all:8,jump:8,stamina:8}},[['bay','Bay',1],['pinto','Pinto',1]],{1:3});
const capAt=level=>coreRules.statCap({level});
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>Number(n).toLocaleString('en-US');
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const diffs=[{label:'Novice',lvlAdd:0,rewMul:.7},{label:'Open',lvlAdd:0,rewMul:1},{label:'Elite',lvlAdd:2,rewMul:1.5}];
const planFactory=new Function('G','ridden','S','DIFFS','clamp','gate','townLock','needText','featured','eventPreparation','eventHorseById','mountSelection','esc','fmt',
 section(source,' function preparationFor(',' function ribbonsOf(')+'return {preparationFor,xpClinicReady,horseGrowthMarkup,horseXpButton,drillProgressLabel};');
const navigationFactory=new Function('G','evById','st','$','root','paintPage','setTimeout','clamp','DIFFS','preparationFor','mountSelection','S','ridden','eventHorseById','xpClinicReady',
 section(source,' function eventReturn(',' function ride(ev,di){')+'return {growForEvent,eventReturn};');
const preparationMarkup=new Function('G','mountSelection','prep','h','ev','di','d','D','disc','document','tA','comparison','esc','fmt','favourLine','partnership','bestS','best','tBest','horseGrowthMarkup','horseXpButton','xpClinicReady','s','req','tSec',
 "let main='';"+section(source,'   const selection=mountSelection.state(),why=','   me.fns.push(()=>drawCourse(ev,mv));')+'return main;');
function renderPreparation(f,di=1){
 const prep=f.preparationFor(f.ev,di);
 return preparationMarkup(f.G,f.mountSelection,prep,f.horse,f.ev,di,diffs[di],{t:'Cross country'},'xc',{body:{classList:{contains:()=>false}}},120,{},esc,fmt,()=>'',()=>'',null,null,String,f.horseGrowthMarkup,f.horseXpButton,f.xpClinicReady,f.save,'',n=>n+'s');
}

function fixture(){
 const horse={id:1,name:'Bramble',breed:'bay',level:4,xp:125,stats:{speed:4,stamina:4,jump:4,accel:4,agility:4},sxp:{jump:0}};
 const other={id:2,name:'Clover',breed:'pinto',level:2,xp:20,stats:{speed:4,stamina:4,jump:4,accel:4,agility:4}};
 const save={ridingHorseId:1,horses:[horse,other],tack:{},evDiff:1};
 const ev={id:'a2',name:'Cottonwood Cross Country',town:'Cottonwood',lvl:4,req:{jump:5,stamina:5},reward:550};
 const second={id:'h1',name:'Welcome Jump',town:'Meadowlark Ranch',lvl:1,req:{jump:3},reward:250};
 const st={on:true,page:ev.id,diff:1,compare:false},trace={starts:[],painted:0,focused:0,opened:0,toasts:[],accept:true,paintedPrep:null};
 let live=horse;const player={mesh:{},y:0},rig={ready:true,loadingBreed:false,attachedTo:player.mesh,modelKey:'native-bay',requestedBreed:'bay',profile:{nativeBreed:true,nativeJump:{}}};
 const mountSelection={state:()=>({blocked:false})};
 const main={scrollTop:87},control={focus(){trace.focused++;}},page={querySelector:selector=>selector==='.sev-main'?main:control};
 const eventsBtn={click(){trace.opened++;st.on=true;st.diff=1;}};
 const G={xp:{...coreRules,statBreakdown(h,tack){const base=h.stats,t=tack?.[h.id]||{},total={};for(const key of Object.keys(base))total[key]=base[key]+(t[key]||0);return {base,tack:t,total};}},
  horse:{player,RIG:()=>rig,ridden:()=>live,breedModels:{resolve:breed=>'native-'+breed}},
  course:{get:()=>null,drillActive:()=>false,drillState:()=>({})},worldPkg:{vehicle:()=>false},
  toast:message=>trace.toasts.push(message),trainingDrills:{startForEvent(stat,context){trace.starts.push({stat,context});if(trace.accept){st.on=false;st.page=null;}return trace.accept;}}};
 // Exercise the real clinic compatibility gate, including native rig and fantasy restrictions.
 G.jumpTraining={canStart:new Function('H',section(readFileSync(new URL('../assets/features/jump-training.js',import.meta.url),'utf8'),' function canStart(){',' function label(')+'return canStart;')(G.horse)};
 const gate=(event,h)=>{const stats=G.xp.statBreakdown(h,save.tack).total,missing=[];if(h.level<event.lvl)missing.push(['level',event.lvl,h.level]);for(const [key,need]of Object.entries(event.req||{}))if(stats[key]<need)missing.push([key,need,stats[key]]);return {ok:!missing.length,missing};};
 const plans=planFactory(G,()=>live,()=>save,()=>diffs,clamp,gate,()=>'',missing=>missing.map(row=>row[0]).join(','),()=>[],eventPreparation,eventHorseById,mountSelection,esc,fmt);
 const events=[ev,second],evById=id=>events.find(e=>e.id===id)||null;
 const paintPage=()=>{trace.painted++;main.scrollTop=0;trace.paintedPrep=plans.preparationFor(evById(st.page),st.diff);};
 const api=navigationFactory(G,evById,st,id=>id==='eventsBtn'?eventsBtn:page,{classList:{add:c=>assert.equal(c,'page')}},paintPage,fn=>fn(),clamp,()=>diffs,plans.preparationFor,mountSelection,()=>save,()=>live,eventHorseById,plans.xpClinicReady);
 const button=()=>({dataset:{horseId:JSON.stringify(horse.id),eventId:ev.id,difficulty:String(st.diff)}});
 return {G,api,...plans,horse,other,save,ev,second,events,st,trace,player,rig,mountSelection,main,button,setLive:h=>{live=h;}};
}

test('level-cap preparation gives the exact next useful XP using current production stat caps',()=>{
 const f=fixture(),before=structuredClone(f.save),p=f.preparationFor(f.ev,1);
 assert.equal(p.ready,false);assert.equal(p.hasReadyAlternative,false);
 assert.deepEqual(p.growth,{horseId:1,level:4,xp:125,xpNeed:250,nextLevel:5,nextXp:125,targetLevel:5,targetXp:125,capStats:['Jump','Stamina'],breedBlocked:[]});
 assert.equal(p.training.every(row=>row.canTrain===false),true);
 assert.doesNotMatch(p.prepareHint+' '+p.levelHint+' '+p.training.map(row=>row.hint).join(' '),/choose a qualifying horse/i);
 assert.deepEqual(f.save,before,'the suggestion writes no XP, gate or save progress');
});
test('Elite preserves its actual level requirement and gives the complete multi-level XP total',()=>{
 const f=fixture(),p=f.preparationFor(f.ev,2),html=f.horseGrowthMarkup(p,f.horse);
 assert.equal(p.requirements[0].need,6);assert.equal(p.growth.nextLevel,5);assert.equal(p.growth.targetLevel,6);assert.equal(p.growth.nextXp,125);assert.equal(p.growth.targetXp,425);
 assert.match(html,/125 horse XP to Lv 5/);assert.match(html,/425 horse XP to Lv 6/);assert.match(html,/missing stats may still need training or tack/);assert.match(html,/does not qualify you automatically/);
 assert.equal(p.ready,false);
});
test('future stat room is a useful milestone rather than a one-clinic promise',()=>{
 const f=fixture();f.ev.lvl=10;f.ev.req={jump:8};const p=f.preparationFor(f.ev,1);
 assert.equal(p.growth.nextLevel,5);assert.equal(p.growth.targetLevel,20);assert.equal(p.growth.targetXp,9875);
 assert.match(f.horseGrowthMarkup(p,f.horse),/Repeat as needed/);assert.doesNotMatch(f.horseGrowthMarkup(p,f.horse),/one (clinic|session)|automatically ready/i);
});
test('tack can remove a cap gap while useful trainable deficits keep their ordinary stat route',()=>{
 const f=fixture();f.save.tack[1]={jump:1,stamina:1};assert.equal(f.preparationFor(f.ev,1).ready,true);assert.equal(f.preparationFor(f.ev,1).growth,null);
 f.horse.stats.jump=2;const p=f.preparationFor(f.ev,1);assert.equal(p.growth,null);assert.equal(p.training[0].canTrain,true);assert.equal(p.training[0].target,4);
 f.ev.lvl=6;assert.equal(f.preparationFor(f.ev,1).growth.targetLevel,6,'tack cannot remove the independent horse-level requirement');
});
test('breed ceilings stay explicit and are never projected as reachable through levels',()=>{
 const f=fixture();f.ev.lvl=6;f.ev.req={jump:9};const p=f.preparationFor(f.ev,1),html=f.horseGrowthMarkup(p,f.horse);
 assert.deepEqual(p.growth.capStats,[]);assert.deepEqual(p.growth.breedBlocked,['Jump']);assert.equal(p.growth.targetLevel,6);
 assert.match(html,/Leveling cannot cover this breed’s Jump ceiling/);assert.doesNotMatch(html,/training room for the requirements shown/);
 f.ev.lvl=4;assert.equal(f.preparationFor(f.ev,1).growth,null,'an unfixable breed stat gap does not recommend XP as its solution');
});
test('a genuinely ready saved adult alternative is considered without inventing one',()=>{
 const f=fixture();f.other.level=6;f.other.stats.jump=5;f.other.stats.stamina=5;assert.equal(f.preparationFor(f.ev,2).hasReadyAlternative,true);
 f.other.foal=true;assert.equal(f.preparationFor(f.ev,2).hasReadyAlternative,false);
 f.other.foal=false;f.save.horses.push(structuredClone(f.other));assert.equal(f.preparationFor(f.ev,2).hasReadyAlternative,false,'ambiguous saved IDs are not offered as an alternative');
});
test('malformed level/XP projections and unknown caps never advertise horse XP advancement',()=>{
 const input={horse:{id:1,level:4,xp:125},entryLevel:5,training:[],statCapAtLevel:capAt};
 for(const horse of [{level:0,xp:0},{level:4.5,xp:0},{level:'4',xp:0},{level:4},{level:4,xp:-1},{level:4,xp:250},{level:4,xp:NaN},{level:4,xp:Infinity},{level:50,xp:0}])assert.equal(horseLevelPreparation({...input,horse}),null);
 for(const statCapAtLevel of [()=>NaN,()=>Infinity,()=>{throw Error('unknown');}])assert.equal(horseLevelPreparation({...input,entryLevel:4,training:[{key:'jump',label:'Jump',target:5}],trainingCaps:{jump:{level:4,breed:8}},statCapAtLevel}),null);
 const before={...input,horse:structuredClone(input.horse),training:structuredClone(input.training)};assert.equal(horseLevelPreparation(input).nextXp,125);assert.deepEqual(input,before);
});
test('maximum-level drill wording advertises practice rather than nonexistent horse XP',()=>{
 const f=fixture();assert.match(f.drillProgressLabel('jump',4,4,0,60,f.horse),/clean jumps still earn horse XP/);
 assert.match(f.drillProgressLabel('jump',8,8,0,100,{level:50}),/maximum horse level · practice only/);
 assert.doesNotMatch(f.drillProgressLabel('jump',8,8,0,100,{level:50}),/earn horse XP/);
 assert.equal(f.drillProgressLabel('stamina',2,4,13,40,f.horse),'13 / 40 XP to 3');
});
test('new preparation and button markup escape saved names and bound IDs',()=>{
 const f=fixture();f.horse.name='<img src=x onerror=alert(1)>';f.horse.id='horse" ><svg onload=alert(1)>';
 const p=f.preparationFor(f.ev,1),html=f.horseGrowthMarkup(p,f.horse),button=f.horseXpButton(f.ev,2,f.horse,false);
 assert.match(html,/&lt;img/);assert.doesNotMatch(html,/<img/);assert.match(button,/disabled/);assert.doesNotMatch(button,/<svg/);assert.match(button,/data-difficulty="2"/);
});
test('the actual event preparation footer offers XP while retaining locked entry and useful tack/stat actions',()=>{
 const f=fixture();f.G.seCare={open(){}};f.horse.stats.jump=2;
 const html=renderPreparation(f,2);
 assert.match(html,/data-sev="xp" data-event-id="a2" data-difficulty="2" data-horse-id="1">Jump clinic · horse XP/);
 assert.match(html,/data-sev="ride" disabled/);assert.match(html,/data-sev="train:jump">Train Jump/);assert.match(html,/data-sev="prepare:equipment">Compare tack/);
 assert.doesNotMatch(html,/Choose a ready horse/,'neither saved horse is qualified');assert.equal(f.trace.starts.length,0);
 f.other.level=6;f.other.stats.jump=5;f.other.stats.stamina=5;assert.match(renderPreparation(f,2),/Choose a ready horse/);
});
test('the actual event footer changes back to authoritative entry after the same horse earns the requirements',()=>{
 const f=fixture();f.horse.level=5;f.horse.xp=22;f.horse.stats.jump=5;f.horse.stats.stamina=5;
 const html=renderPreparation(f,1);assert.doesNotMatch(html,/data-sev="xp"/);assert.match(html,/data-sev="ride">Enter event/);assert.equal(f.trace.starts.length,0);
 const elite=renderPreparation(f,2);assert.match(elite,/278 horse XP to Lv 6/);assert.match(elite,/data-sev="ride" disabled/);
});
test('the explicit XP action starts the real clinic bridge with the same saved horse and exact event context',()=>{
 const f=fixture(),before=structuredClone(f.save);
 assert.equal(f.xpClinicReady(f.horse,f.save),true);assert.equal(f.trace.starts.length,0,'displaying the plan starts no ride');
 assert.equal(f.api.growForEvent(f.button()),true);assert.equal(f.trace.starts.length,1);
 const {stat,context}=f.trace.starts[0];assert.equal(stat,'jump');assert.equal(context.eventId,f.ev.id);assert.equal(context.eventName,f.ev.name);assert.equal(context.difficulty,1);assert.equal(typeof context.onBack,'function');
 assert.equal(f.G.horse.ridden().id,1);assert.deepEqual(f.save,before,'navigation grants no XP or progress');
});
test('stale event, difficulty, horse and readiness controls are rejected before a clinic can start',()=>{
 for(const change of [f=>f.st.page=f.second.id,f=>f.st.diff=2,f=>f.st.on=false,f=>f.save.ridingHorseId=2,f=>f.setLive(f.other),f=>f.horse.level=5,f=>f.save.tack[1]={jump:1,stamina:1}]){
  const f=fixture(),button=f.button();change(f);assert.equal(f.api.growForEvent(button),false);assert.equal(f.trace.starts.length,0);
 }
 for(const change of [b=>b.dataset.horseId='not JSON',b=>b.dataset.horseId='null',b=>b.dataset.horseId='"1"',b=>b.dataset.eventId='gone',b=>b.dataset.difficulty='NaN']){
  const f=fixture(),button=f.button();change(button);assert.equal(f.api.growForEvent(button),false);assert.equal(f.trace.starts.length,0);
 }
});
test('XP entry requires a unique adult saved horse and its ready attached native model',()=>{
 for(const change of [f=>f.save.horses=[],f=>f.save.horses.push(structuredClone(f.horse)),f=>f.horse.foal=true,f=>f.horse.egg=true,f=>f.rig.ready=false,f=>f.rig.loadingBreed=true,f=>f.rig.attachedTo={},f=>f.rig.modelKey='native-pinto',f=>f.rig.requestedBreed='pinto',f=>f.setLive({...f.horse,breed:'pinto'}),f=>f.mountSelection.state=()=>({blocked:true})]){
  const f=fixture();change(f);assert.equal(f.api.growForEvent(f.button()),false);assert.equal(f.trace.starts.length,0);
 }
});
test('unsupported flying/fantasy rigs and busy, jumping, saving or returning horses are not offered an XP start',()=>{
 for(const change of [f=>f.horse.wings=true,f=>f.rig.profile.nativeCanFly=true,f=>f.rig.nativeFantasy={pair:{}},f=>f.rig.profile.nativeJump=null,f=>f.player.flying=true,f=>f.player.landing=true,f=>f.player.y=.2,f=>f.rig.heroJumpAge=0,f=>f.rig.emote={},f=>f.rig.heroMotion={state:{action:'rear'}},f=>f.rig.heroMotion={state:{transitioning:true}},f=>f.G.course.get=()=>({}),f=>f.G.course.drillActive=()=>true,f=>f.G.course.drillState=()=>({pending:{}}),f=>f.G.course.drillState=()=>({saving:true}),f=>f.G.trail={ride:{}},f=>f.G.worldPkg.vehicle=()=>({}),f=>f.G.roundup={state:()=>({active:true})},f=>f.G.rescueRide={snapshot:()=>({active:true})},f=>f.G.photoPause=true,f=>f.G.cam={isFree:()=>true},f=>f.G.social={spectate:true},f=>f.G.social={tour:true}]){
  const f=fixture();change(f);assert.equal(f.xpClinicReady(f.horse,f.save),false);assert.equal(f.api.growForEvent(f.button()),false);assert.equal(f.trace.starts.length,0);
 }
});
test('a rejected core start retains the requested event and difficulty without changing the save',()=>{
 const f=fixture(),before=structuredClone(f.save);f.st.diff=2;f.trace.accept=false;
 assert.equal(f.api.growForEvent(f.button()),false);assert.equal(f.st.on,true);assert.equal(f.st.page,f.ev.id);assert.equal(f.st.diff,2);assert.deepEqual(f.save,before);
});
test('confirmed return refreshes the original event and difficulty with current horse XP/stats and no auto-entry',()=>{
 const f=fixture();f.st.diff=2;assert.equal(f.api.growForEvent(f.button()),true);
 f.horse.level=5;f.horse.xp=22;f.horse.stats.jump=5;f.horse.stats.stamina=5;const before=structuredClone(f.save);
 f.trace.starts[0].context.onBack();assert.equal(f.st.page,f.ev.id);assert.equal(f.st.diff,2);assert.equal(f.st.compare,false);assert.equal(f.trace.painted,1);assert.equal(f.main.scrollTop,87);assert.equal(f.trace.focused,1);
 assert.equal(f.trace.paintedPrep.requirements[0].need,6);assert.equal(f.trace.paintedPrep.growth.nextXp,278);assert.equal(f.trace.paintedPrep.ready,false,'Elite remains locked until Lv6');
 f.trace.starts[0].context.onBack();assert.equal(f.trace.opened,1);assert.equal(f.trace.starts.length,1,'return never automatically enters another ride');assert.deepEqual(f.save,before);
});
test('return after a horse change preserves the original target and asks for that horse without silently selecting it',()=>{
 const f=fixture();f.st.diff=2;assert.equal(f.api.growForEvent(f.button()),true);
 f.save.ridingHorseId=2;f.setLive(f.other);f.trace.starts[0].context.onBack();
 assert.equal(f.st.page,f.ev.id);assert.equal(f.st.diff,2);assert.equal(f.st.compare,true);assert.equal(f.save.ridingHorseId,2);assert.equal(f.G.horse.ridden().id,2);assert.match(f.trace.toasts[0],/Choose Bramble/);assert.equal(f.trace.starts.length,1);
});
test('a deleted original horse or removed event cannot silently redirect preparation',()=>{
 const f=fixture();assert.equal(f.api.growForEvent(f.button()),true);f.save.horses.shift();f.save.ridingHorseId=2;f.setLive(f.other);f.trace.starts[0].context.onBack();assert.equal(f.st.compare,true);assert.match(f.trace.toasts[0],/no longer available/);
 const g=fixture();assert.equal(g.api.growForEvent(g.button()),true);g.events.shift();g.trace.starts[0].context.onBack();assert.equal(g.trace.starts.length,1);assert.equal(g.trace.painted,0);
});

// The displayed projection is checked against the actual level/reward loops,
// independently of the UI fixture. The clinic still owns legitimate jump proof.
const xpCode=section(core,'function applyXp(s,h,n){','/* XP for the horse being ridden.');
const growthCode=section(core,'function trainingGrowth(s,h,stat,cleared){','function creditTrainingProgress(');
const applyRules=new Function('MAX_LEVEL','STAT_KEYS','statCap','statCeil','mulOf','addSP','ensureStats',xpCode+growthCode+'return {applyXp,trainingGrowth};')(
 coreRules.MAX_LEVEL,['speed','stamina','jump','accel','agility'],coreRules.statCap,coreRules.statCeil,()=>1,()=>{},h=>{h.stats=h.stats||{};});
test('the quoted XP reaches exactly the displayed level through the actual production applyXp loop',()=>{
 for(const diff of [1,2]){
  const f=fixture(),p=f.preparationFor(f.ev,diff),h=structuredClone(f.horse),s={horses:[h]};
  applyRules.applyXp(s,h,p.growth.targetXp-1);assert.equal(h.level,p.growth.targetLevel-1);
  applyRules.applyXp(s,h,1);assert.equal(h.level,p.growth.targetLevel);assert.equal(h.xp,0);
 }
});
test('actual capped clean-jump reward retains horse XP, can open Lv5 stat room, and stops at max level',()=>{
 const f=fixture(),s=structuredClone(f.save),h=s.horses[0];h.xp=248;
 const growth=applyRules.trainingGrowth(s,h,'jump',8);assert.equal(growth.horseXp,24);assert.equal(h.level,5);assert.equal(h.xp,22);assert.equal(coreRules.statCap(h),5);assert.equal(growth.before.level,4);assert.equal(growth.after.level,5);
 assert.equal(s.horses[1].xp,20,'clinic growth belongs to the supplied horse');
 h.level=50;h.xp=0;assert.equal(applyRules.trainingGrowth(s,h,'jump',8).horseXp,0);
});

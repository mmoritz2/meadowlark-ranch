import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {eventHorseComparison,eventHorseById,createEventHorseSelection} from '../assets/features/event-horse-comparison.mjs';
import {eventPreparation} from '../assets/features/event-preparation.js';
import {tackStatTotals} from '../assets/tack-stats.js';
const source=readFileSync(new URL('../assets/features/se-events.js',import.meta.url),'utf8');
const core=readFileSync(new URL('../ranch3d.html',import.meta.url),'utf8');
const bondSource=readFileSync(new URL('../assets/features/bond-personality-emotes.js',import.meta.url),'utf8');
const racingSource=readFileSync(new URL('../assets/features/events-pvp.js',import.meta.url),'utf8');
const courseSource=readFileSync(new URL('../assets/features/course-engine.js',import.meta.url),'utf8');
const personality=new Function(core.slice(core.indexOf('const PERS={'),core.indexOf('/* ---- seasons,',core.indexOf('const PERS={')))+'return {PERS,persMul};')();
const fill=new Function(bondSource.slice(bondSource.indexOf('const PERS_DEFAULT='),bondSource.indexOf('const BOND_LEVELS='))+'return {PERS_DEFAULT,PERS_FILL};')();
for(const [id,row]of Object.entries(fill.PERS_FILL))Object.assign(personality.PERS[id],row);
const bondGain=new Function('PERS',core.slice(core.indexOf('function bondGain('),core.indexOf('\n',core.indexOf('function bondGain(')))+'return bondGain;')(personality.PERS);
const bondLevel=h=>Math.min(5,Math.max(0,Math.floor((h.bond||0)/20)));
const diffs=[{label:'Novice',lvlAdd:0,rewMul:.7},{label:'Open',lvlAdd:0,rewMul:1},{label:'Elite',lvlAdd:2,rewMul:1.5}];
const keys=['speed','stamina','jump','accel','agility'],horse=(id,extra={})=>({id,name:'Same name',breed:'bay-sporthorse',level:5,bond:35,pers:'challenging',stats:Object.fromEntries(keys.map(k=>[k,3])),sxp:{},gear:{},...extra});
function preparationFixture({horses=[horse(1),horse(2)],inventory=[],venue='',champion=false}={}){
 const save={horses,tack:inventory,evDiff:2},calls=[];
 const stats=h=>tackStatTotals(h,save.tack);
 const G={xp:{statBreakdown:(h,items)=>{assert.equal(items,save.tack);return stats(h);},effStats:h=>stats(h).total,statCap:h=>Math.min(10,4+Math.floor((h.level||1)/5)),statCeil:()=>8},course:{},ladder:{entryLock(ev,s,h){calls.push({kind:'ladder',id:h.id,diff:s.evDiff});return champion?'Qualify at four venues first.':null;}}};
 const eventOk=new Function('G','ridden',courseSource.slice(courseSource.indexOf(' function eventOk('),courseSource.indexOf(' const missingText=',courseSource.indexOf(' function eventOk(')))+'return eventOk;')(G,()=>horses[0]);
 G.course.eventOk=(ev,h)=>{calls.push({kind:'gate',id:h.id});return eventOk(ev,h);};
 const begin=source.indexOf(' function gate('),end=source.indexOf(' function ribbonsOf(',begin);
 const adapters=new Function('G','ridden','S','DIFFS','clamp','townLock','needText','featured','eventPreparation',source.slice(begin,end)+'return {gate,preparationFor};')(G,()=>horses[0],()=>save,()=>diffs,(v,a,b)=>Math.max(a,Math.min(b,v)),()=>venue,m=>m.map(([k,n])=>k+' '+n).join(', '),()=>[],eventPreparation);
 const traitStart=racingSource.indexOf(' function traitMatches('),traitEnd=racingSource.indexOf(' /* ================================================================= race tickets',traitStart);
 const races=new Function('G','TRAIT_MATCH_AT',racingSource.slice(traitStart,traitEnd)+'return {traitMatches,raceTraitMul};')(G,Number(racingSource.match(/const TRAIT_MATCH_AT=(\d+)/)[1]));
 function plan(h,ev={id:'a1',lvl:3,req:{jump:5},reward:100},di=1){const p=adapters.preparationFor(ev,di,h,save);return eventHorseComparison({horse:h,event:ev,preparation:p,stats:stats(h),personality:{...fill.PERS_DEFAULT,...personality.PERS[h.pers]},personalityMultipliers:personality.persMul(h),bondLevel:bondLevel(h),bondGain,racePace:races.raceTraitMul(ev,h),raceMatches:races.traitMatches(ev,h)});}
 return {G,save,calls,stats,plan,...adapters};
}

test('candidate gate and selected difficulty are evaluated for that horse, not the ridden one',()=>{
 const ridden=horse(1,{level:1}),candidate=horse(2,{stats:{speed:4,stamina:4,jump:5,accel:4,agility:4}}),f=preparationFixture({horses:[ridden,candidate]});
 assert.equal(f.plan(ridden,undefined,2).ready,false);const plan=f.plan(candidate,undefined,2);assert.equal(plan.ready,true);assert.equal(plan.requirements[0].need,5);
 assert.deepEqual(f.calls.filter(c=>c.kind==='gate').map(c=>c.id),[1,2]);assert.deepEqual(f.calls.filter(c=>c.kind==='ladder').map(c=>[c.id,c.diff]),[[1,2],[2,2]]);
});
test('candidate equipped inventory bridges a real requirement and never leaks the ridden horse gear',()=>{
 const a=horse(1),b=horse(2,{gear:{shoes:'shoe-b'}}),f=preparationFixture({horses:[a,b],inventory:[{id:'shoe-b',slot:'shoes',primary:'jump',bonus:{jump:2}}]});
 const before=structuredClone(f.save),pa=f.plan(a),pb=f.plan(b);assert.equal(pa.ready,false);assert.equal(pb.ready,true);
 assert.deepEqual(pb.rows.find(r=>r.key==='jump'),{key:'jump',label:'Jump',base:3,tack:2,total:5,need:5,met:true});assert.deepEqual(f.save,before);
});
test('venue and championship locks remain blocking for a fully qualified candidate',()=>{
 const h=horse(2,{stats:{jump:8}});assert.match(preparationFixture({horses:[h],venue:'Finish Wren’s quest.'}).plan(h).reason,/Wren/);
 const plan=preparationFixture({horses:[h],champion:true}).plan(h);assert.equal(plan.ready,false);assert.match(plan.reason,/four venues/);
});
test('a real missing stat uses its actual trainable cap, while tack can remove the deficit',()=>{
 const h=horse(2,{level:4,stats:{jump:3}}),f=preparationFixture({horses:[h]});const p=f.plan(h);assert.equal(p.training[0].canTrain,true);assert.equal(p.training[0].cap,4);assert.equal(p.training[0].canMeet,false);assert.match(p.training[0].hint,/current cap|training cap/);
});
test('personality effects and milestones agree with production persMul at all thresholds',()=>{
 for(const [pers,bond]of [['challenging',35],['challenging',49],['challenging',50],['challenging',80],['aloof',79],['aloof',80],['energetic',25],['alert',25]]){
  const h=horse(2,{pers,bond}),p=preparationFixture({horses:[h]}).plan(h),m=personality.persMul(h);
  for(const [k,label]of [['sp','Pace'],['ac','Acceleration'],['ag','Turning']]){const n=Math.round((m[k]-1)*10000)/100;assert.equal(p.personality.effects.includes(label+' '+(n>0?'+':'')+n+'%'),n!==0);}
  if(pers==='challenging')assert.equal(p.personality.milestones.some(s=>s.includes('50 bond')),m.ag<1);if(pers==='aloof')assert.equal(p.personality.milestones.some(s=>s.includes('80 bond')),m.sp===1);
 }
});
test('bond preparation shows existing stamina savings and actual preferred care gains without entry gates',()=>{
 const h=horse(2,{pers:'relaxed',bond:39,stats:{jump:5}}),f=preparationFixture({horses:[h]}),p=f.plan(h);
 assert.equal(p.bond.staminaSaving,2);assert.equal(p.bond.actions.find(a=>a.id==='groom').gain,bondGain(h,3,'groom'));assert.equal(p.bond.actions.find(a=>a.id==='groom').gain,6);assert.match(p.bond.preference,/grooming/);
 assert.equal(f.plan({...h,bond:0}).ready,true);assert.equal(f.plan({...h,bond:100}).bond.staminaSaving,10);
});
test('favoured numeric stats use real race helpers, including fractional bonuses below the match threshold',()=>{
 const h=horse(2,{stats:{speed:6,stamina:7,jump:3,accel:3,agility:3},traits:['nimble']}),f=preparationFixture({horses:[h]}),p=f.plan(h,{id:'r1',race:true,traits:['speed','stamina'],lvl:1});
 assert.deepEqual(p.favours.map(r=>[r.key,r.value,r.matched]),[['speed',6,false],['stamina',7,true]]);assert.equal(p.paceBonus,4.5);
 assert.equal(f.plan(h,{id:'rush-pasture',race:true,rush:true,traits:['speed'],lvl:1}).favours.length,0);
 assert.equal(f.plan(h,{id:'h1',traits:['speed'],lvl:1}).favours.length,0);
});
test('showmanship displays supplied production turnout/manners without claiming a final score',()=>{
 const p=eventHorseComparison({horse:horse(2),event:{kind:'show'},turnout:{total:.727,parts:[{p:{k:'manner'},v:.35}]}});assert.deepEqual(p.turnout,{percent:72.7,manners:35});assert.equal(eventHorseComparison({horse:horse(2),event:{kind:'race'},turnout:{total:.727}}).turnout,null);
});
test('stable identity resolver rejects duplicate IDs, foals and eggs, while duplicate names stay valid',()=>{
 const a=horse(1),b=horse('quoted"id'),s={horses:[a,b]};assert.equal(eventHorseById(s,b.id),b);assert.equal(eventHorseById(s,1),a);assert.equal(eventHorseById({horses:[a,{...a}]},1),null);
 for(const patch of [{foal:true},{egg:true}])assert.equal(eventHorseById({horses:[{...a,...patch}]},1),null);assert.equal(eventHorseById(s,'1'),null);
});

function selectionFixture({save= {horses:[horse(1),horse(2)],ridingHorseId:1},loadAfter=0,timeoutMs=1000,savedFailure=false,detached=false,wrongModel=false,onDelay=null}={}){
 const disk=structuredClone(save),live=structuredClone(save.horses),player={mesh:{},y:0,onFoot:false,flying:false},events=[],notices=[];let index=live.findIndex(h=>h.id===disk.ridingHorseId),clock=0;
 const model=breed=>'native:'+breed,rig={ready:true,loadingBreed:false,requestedBreed:live[index].breed,modelKey:model(live[index].breed),attachedTo:player.mesh};
 const input={value:String(index),onchange(){events.push({kind:'select',index:Number(input.value),id:live[Number(input.value)].id});index=Number(input.value);if(!savedFailure)disk.ridingHorseId=live[index].id;rig.requestedBreed=live[index].breed;rig.modelKey=wrongModel?'wrong-model':model(live[index].breed);rig.attachedTo=detached?{}:player.mesh;rig.ready=loadAfter===0;rig.loadingBreed=loadAfter!==0;}};
 const G={save:{fresh:()=>structuredClone(disk)},horse:{player,myHorses:live,ridden:()=>live[index],RIG:()=>rig,breedModels:{resolve:model}},riding:{releaseAll(){events.push({kind:'release'});}},course:{get:()=>null,drillActive:()=>false}};
 const selection=createEventHorseSelection(G,{selector:()=>input,now:()=>clock,timeoutMs,delay:async ms=>{clock+=ms;onDelay?.({disk,live,rig,G,index});if(clock>=loadAfter){rig.ready=true;rig.loadingBreed=false;}},changed:s=>notices.push(s)});
 return {selection,disk,live,player,rig,input,G,events,notices,setFailure(value){savedFailure=value;}};
}
test('selection resolves the fresh saved ID after a reorder and ignores duplicate names',async()=>{
 const f=selectionFixture({save:{horses:[horse(2),horse(1)],ridingHorseId:1}});const r=await f.selection.choose(2);assert.equal(r.ok,true);assert.equal(f.events.find(e=>e.kind==='select').index,0);assert.equal(f.disk.ridingHorseId,2);assert.equal(f.G.horse.ridden().id,2);assert.equal(f.selection.state().blocked,false);
});
test('selection remains pending until the exact selected model is attached and saved',async()=>{
 const f=selectionFixture({loadAfter:300}),promise=f.selection.choose(2);assert.equal(f.selection.state().pending,true);assert.equal(f.selection.state().blocked,true);
 const r=await promise;assert.equal(r.ok,true);assert.equal(f.selection.state().pending,false);assert.equal(f.selection.state().blocked,false);assert.ok(f.notices.some(s=>s.pending));assert.equal(f.notices.at(-1).blocked,false);
});
test('same pending choice is deduplicated; another ID cannot masquerade as its result',async()=>{
 const f=selectionFixture({loadAfter:200}),p=f.selection.choose(2);assert.equal(f.selection.choose(2),p);const other=await f.selection.choose(1);assert.equal(other.ok,false);assert.equal(other.horseId,1);assert.equal((await p).horseId,2);assert.equal(f.events.filter(e=>e.kind==='select').length,1);
});
test('swallowed selection save failure keeps entry blocked and an ordinary retry can confirm it',async()=>{
 const f=selectionFixture({savedFailure:true});const first=await f.selection.choose(2);assert.equal(first.ok,false);assert.match(first.reason,/could not be saved/);assert.equal(f.selection.state().blocked,true);assert.equal(f.disk.ridingHorseId,1);
 f.setFailure(false);assert.equal((await f.selection.choose(2)).ok,true);assert.equal(f.selection.state().blocked,false);
});
test('sold or duplicate IDs and a mismatched parallel roster never select an index',async()=>{
 for(const edit of [f=>f.disk.horses.pop(),f=>f.disk.horses.push({...f.disk.horses[1]}),f=>f.live.reverse()]){const f=selectionFixture();edit(f);assert.equal((await f.selection.choose(2)).ok,false);assert.equal(f.events.filter(e=>e.kind==='select').length,0);}
});
test('detached or wrong model cannot announce a prepared horse, and timeout leaves entry blocked',async()=>{
 for(const options of [{detached:true},{wrongModel:true},{loadAfter:Infinity}]){const f=selectionFixture({...options,timeoutMs:250});const r=await f.selection.choose(2);assert.equal(r.ok,false);assert.equal(f.selection.state().pending,false);assert.equal(f.selection.state().blocked,true);}
});
test('changing horse identity during an async load aborts without a success claim',async()=>{
 const f=selectionFixture({loadAfter:300,onDelay:({disk})=>{disk.horses[1].breed='changed-breed';}});assert.equal((await f.selection.choose(2)).ok,false);
});
test('active ride, flight, pre-lift jump and action gates prevent normal selector dispatch',async()=>{
 for(const edit of [f=>f.G.course.get=()=>({}),f=>f.G.trail={ride:{}},f=>f.player.flying=true,f=>f.rig.heroJumpAge=0,f=>f.rig.heroMotion={state:{action:{type:'bow'}}}]){const f=selectionFixture();edit(f);const r=await f.selection.choose(2);assert.equal(r.ok,false);assert.equal(f.events.length,0);}
});
test('an already saved/attached candidate does not rebuild or grant anything',async()=>{
 const f=selectionFixture(),before=structuredClone(f.disk);assert.equal((await f.selection.choose(1)).ok,true);assert.equal(f.events.length,0);assert.deepEqual(f.disk,before);
});

const selectionStart=source.indexOf(' async function selectEventHorse('),selectionEnd=source.indexOf(' /* ---- the event page ----',selectionStart);
const navStart=source.indexOf(' function eventReturn('),navEnd=source.indexOf(' function ride(ev,di)',navStart);
function navigationFixture({selectionDelay=false,selectionOk=true}={}){
 const st={on:true,page:'a1',diff:2,compare:true,context:10},h=horse(2),save={horses:[h]},ev={id:'a1',name:'Farm Derby'},log={painted:0,focused:0,opened:null,trained:null,chosen:null};let resolveChoice;
 const choice=selectionDelay?new Promise(resolve=>resolveChoice=resolve):Promise.resolve({ok:selectionOk,horseId:h.id});
 const mountSelection={choose:id=>{log.chosen=id;return choice;},state:()=>({blocked:false})};
 const main={scrollTop:80},control={focus:()=>log.focused++},page={querySelector:q=>q==='.sev-main'?main:control};
 const button={click(){st.on=true;st.page=null;st.diff=1;}};
 const G={seCare:{open(tab,options){log.opened={tab,...options};st.on=false;st.page=null;st.context++;}},trainingDrills:{startForEvent(stat,options){log.trained={stat,...options};st.on=false;st.page=null;return true;}}};
 const factory=new Function('G','st','S','evById','mountSelection','eventHorseById','$','root','paintPage','setTimeout','clamp','DIFFS','preparationFor',source.slice(selectionStart,selectionEnd)+source.slice(navStart,navEnd)+'return {selectEventHorse,prepareHorse};');
 const api=factory(G,st,()=>save,id=>id===ev.id?ev:null,mountSelection,eventHorseById,id=>id==='eventsBtn'?button:page,{classList:{add(){}}},()=>log.painted++,fn=>fn(),(v,a,b)=>Math.max(a,Math.min(b,v)),()=>diffs,()=>({training:[{key:'jump',canTrain:true}]}));
 return {api,st,log,h,resolveChoice,main};
}
test('normal selection keeps event/difficulty, and Bond/tack return to that same context',async()=>{
 for(const action of ['select','bond','tack']){const f=navigationFixture();assert.equal(await f.api.selectEventHorse(2,action),true);assert.equal(f.log.chosen,2);assert.equal(f.st.diff,2);
  if(action==='select'){assert.equal(f.st.page,'a1');assert.equal(f.st.compare,false);assert.equal(f.log.opened,null);}else{assert.equal(f.log.opened.tab,action==='bond'?'feeding':'equipment');assert.equal(f.log.opened.label,'Back to Farm Derby');f.log.opened.onBack();assert.equal(f.st.page,'a1');assert.equal(f.st.diff,2);assert.equal(f.main.scrollTop,80);}}
});
test('a deliberate candidate Train action uses the existing real bridge and same event return',async()=>{
 const f=navigationFixture();await f.api.selectEventHorse(2,'train','jump');assert.equal(f.log.trained.stat,'jump');assert.equal(f.log.trained.eventId,'a1');assert.equal(f.log.trained.difficulty,2);f.log.trained.onBack();assert.equal(f.st.page,'a1');assert.equal(f.st.diff,2);
});
test('closing/navigating during selection cannot reopen care or a stale event',async()=>{
 const f=navigationFixture({selectionDelay:true}),pending=f.api.selectEventHorse(2,'bond');f.st.context++;f.st.on=false;f.st.page=null;f.resolveChoice({ok:true,horseId:2});await pending;assert.equal(f.log.opened,null);assert.equal(f.log.painted,0);
});
test('failed selection cannot open preparation or start a drill',async()=>{
 for(const action of ['bond','tack','train']){const f=navigationFixture({selectionOk:false});assert.equal(await f.api.selectEventHorse(2,action,'jump'),false);assert.equal(f.log.opened,null);assert.equal(f.log.trained,null);assert.equal(f.st.compare,true);}
});


test('a tack change recomputes the same saved candidate entry without caching a previous deficit',()=>{
 const h=horse(2,{gear:{shoes:'earned-shoes'}}),f=preparationFixture({horses:[h]});assert.equal(f.plan(h).ready,false);
 f.save.tack.push({id:'earned-shoes',slot:'shoes',bonus:{jump:2},primary:'jump'});const updated=f.plan(h);assert.equal(updated.ready,true);assert.equal(updated.rows.find(r=>r.key==='jump').tack,2);assert.equal(h.stats.jump,3);
});
test('displayed bond stamina savings track the actual installed drain hook',()=>{
 const line=bondSource.split('\n').find(s=>s.includes("G.addMul('stamDrain'"));let hook;new Function('G','bondLevel','ridden',line)({addMul:(name,fn)=>hook=fn},bondLevel,()=>null);
 for(const bond of [0,19,20,39,40,79,80,100]){const h=horse(2,{bond}),p=preparationFixture({horses:[h]}).plan(h);assert.equal(p.bond.staminaSaving,Math.round((1-hook(null,h))*100));}
});
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function renderComparison(f,{pending=false,thumb=(breed,{size})=>'<span class="mk-thumb" data-test-size="'+size+'"><img src="assets/breed-thumbnails/'+esc(breed)+'.webp"></span>'}={}){
 const begin=source.indexOf(' function partnership('),end=source.indexOf(' async function selectEventHorse(',begin);
 const factory=new Function('DIFFS','mountSelection','eventHorseById','ridden','esc','comparisonFor','G','K','statLbl','statNumber',source.slice(begin,end)+'return comparisonMarkup;');
 return factory(()=>diffs,{state:()=>({pending})},eventHorseById,()=>f.save.horses[0],esc,(ev,di,h)=>f.plan(h,ev,di),{horse:{breedLabel:b=>b},trainingDrills:{startForEvent(){}},ui:{k:{thumb}}},{thumb:()=>{throw Error('The seFrame kit has no portrait API.');}},key=>key,n=>String(n))({id:'a1',name:'Farm Derby',lvl:3,req:{jump:5}},2,f.save);
}
test('actual comparison renderer binds escaped stable IDs and states deficits rather than a match percentage',()=>{
 const h=horse('quoted"id',{name:'<img src=x onerror=alert(1)>',stats:{jump:5}}),f=preparationFixture({horses:[horse(1),h,horse(3,{foal:true})]}),html=renderComparison(f);
 assert.equal((html.match(/data-event-horse-id=/g)||[]).length,2);assert.ok(html.includes('data-horse-id="&quot;quoted\\&quot;id&quot;"'));assert.ok(html.includes('&lt;img'));assert.ok(!html.includes('<img src=x'));assert.ok(html.includes('Equipped total'));assert.ok(html.includes('3 trained + 0 tack'));assert.ok(html.includes('Turning -10%'));assert.ok(html.includes('Groom gives +3 bond'));assert.ok(!html.includes('match percentage'));
});
test('pending comparison disables all horse-changing/care/training controls while retaining Back',()=>{
 const f=preparationFixture(),html=renderComparison(f,{pending:true});const buttons=html.match(/<button[^>]+data-sev="horse:[^>]+>/g)||[];assert.ok(buttons.length>=6);assert.ok(buttons.every(button=>button.includes(' disabled')));assert.ok(!html.match(/data-sev="horses:back"[^>]*disabled/));assert.ok(html.includes('Preparing your selected horse'));
});


test('race preparation omits a zero pace bonus and explains the existing reward threshold plainly',()=>{
 const begin=source.indexOf(' function favourLine('),end=source.indexOf(' function comparisonMarkup(',begin);
 const line=new Function('esc','statNumber',source.slice(begin,end)+'return favourLine;')(esc,String);
 const plan={favours:[{key:'speed',label:'Speed',value:4,matched:false}],paceBonus:0},zero=line(plan);
 assert.ok(zero.includes('Speed 4'));assert.ok(!zero.includes('+0%'));assert.ok(zero.includes('At 7 or higher'));assert.ok(zero.includes('race rewards'));assert.ok(!zero.includes('inherited traits'));
 const bonus=line({...plan,paceBonus:2.25});assert.ok(bonus.includes('+2.25% race pace bonus'));assert.equal(line({favours:[],paceBonus:0}),'');
});


test('comparison portrait uses the real UI kit API rather than the seFrame kit',()=>{
 const f=preparationFixture(),calls=[],html=renderComparison(f,{thumb:(breed,options)=>{calls.push({breed,size:options.size});return '<span class="mk-thumb"><img src="assets/breed-thumbnails/'+breed+'.webp"></span>';}});
 assert.deepEqual(calls,[{breed:'bay-sporthorse',size:72},{breed:'bay-sporthorse',size:72}]);assert.equal((html.match(/class="mk-thumb"/g)||[]).length,2);assert.ok(html.includes('breed-thumbnails/bay-sporthorse.webp'));assert.ok(!html.includes('sev-horse-fallback'));
});
test('missing portrait API renders a deliberately sized fallback inside the same picture box',()=>{
 const html=renderComparison(preparationFixture(),{thumb:null});assert.equal((html.match(/class="sev-horse-fallback"/g)||[]).length,2);const css=readFileSync(new URL('../assets/event-horse-comparison.css',import.meta.url),'utf8');assert.match(css,/#seEv \.sev-horse-fallback\{[^}]*font-size:44px/);assert.match(css,/#seEv \.sev-horse-picture\{[^}]*align-items:center;justify-content:center/);
});

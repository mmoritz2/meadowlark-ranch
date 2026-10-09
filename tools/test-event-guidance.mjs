import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=process.argv[2]||path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const guide=fs.readFileSync(root+'/assets/features/course-guide.js','utf8');
const {jumpCue}=await import('data:text/javascript;base64,'+Buffer.from(guide).toString('base64'));
const fence={kind:'fence',x:0,z:0,rotY:0};
const rider=(z=-5.6,extra={})=>({pos:{x:0,z},heading:0,speed:7,y:0,...extra});
assert.equal(jumpCue(fence,rider()),'perfect');
assert.equal(jumpCue(fence,rider(-3.5)),'good');
assert.equal(jumpCue(fence,rider(-10)),'early');
assert.equal(jumpCue(fence,rider(-2)),'late');
assert.equal(jumpCue(fence,rider(-18)),'');
assert.equal(jumpCue({...fence,kind:'gate'},rider()),'');
assert.equal(jumpCue({...fence,kind:undefined},rider()),'');
assert.equal(jumpCue(fence,rider(-5.6,{speed:-7})),'');
assert.equal(jumpCue(fence,rider(-5.6,{speed:0})),'');
assert.equal(jumpCue(fence,rider(-5.6,{heading:Math.PI})),'lineup');
assert.equal(jumpCue(fence,rider(-5.6,{heading:Math.PI/2})),'lineup');
assert.equal(jumpCue(fence,rider(5.6)),'lineup');
assert.equal(jumpCue(fence,rider(-5.6,{pos:{x:2,z:-5.6}})),'lineup');
assert.equal(jumpCue(fence,rider(-5.6,{pos:{x:1.8,z:-5.6}})),'lineup');
assert.equal(jumpCue(fence,rider(-5.6,{pos:{x:1.79,z:-5.6}})),'perfect');
assert.equal(jumpCue(fence,rider(-5.6,{pos:{x:-5.6,z:-5.6},heading:Math.PI/4,speed:7*Math.SQRT2})),'perfect');
assert.equal(jumpCue(fence,rider(-5.6,{heading:Math.PI/6})),'lineup');
assert.equal(jumpCue(fence,rider(-5.6,{y:0.1})),'');
assert.equal(jumpCue(fence,rider(-5.6,{flying:true})),'');
assert.equal(jumpCue(null,rider()),'');
for(const rot of [0,.7,Math.PI/2,Math.PI,-1.4]){
 const j={...fence,x:20,z:-9,rotY:rot};
 const p=rider(-5.6,{pos:{x:j.x-Math.sin(rot)*5.6,z:j.z-Math.cos(rot)*5.6},heading:rot});
 assert.equal(jumpCue(j,p),'perfect','timing must be invariant under course rotation');
}

// Execute the production entry lock and recommendation block with a small
// course/save fixture, without loading WebGL or completing a player save.
const src=fs.readFileSync(root+'/assets/features/events2-ladder.js','utf8');
const lockSource=src.slice(src.indexOf(' function entryLock('),src.indexOf(" G.ui.panel({id:'resultPanel'"));
const selectionStart=src.indexOf('{const feat=featuredNow().filter(e=>e.id!==L.ev.id');
assert(selectionStart>0);
const selectionEnd=src.indexOf("  h+='<div class=\"ladGrid\" style=\"margin-top:6px\">'",selectionStart);
assert(selectionEnd>selectionStart);
const selection=src.slice(selectionStart,selectionEnd);
const render=new Function('featuredNow','L','s','ridden','G','T','DIFFS','champPath','nextVenueHint','weekLeft','esc',
 lockSource+' let h=""; '+selection+' return h;');
const diffs=[{label:'Novice',lvlAdd:0},{label:'Open',lvlAdd:0},{label:'Elite',lvlAdd:2}];
const good={id:'good',name:'Meadow Loop',lvl:1};
const high={id:'high',name:'High Jump',lvl:3};
const final={id:'final',name:'Basin Final',lvl:1,champ:true};
const locked={id:'locked',name:'Locked Stats',lvl:1,locked:true};
const horse={level:3};
const G={course:{eventOk:(ev,h)=>({ok:!ev.locked&&h.level>=ev.lvl,missing:[['level',ev.lvl,h.level]]})}};
const esc=v=>String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const result=(events,s={evDiff:2},champ=false)=>render(()=>events,{ev:{id:'last'}},s,()=>horse,G,{STAT_LBL:{}},()=>diffs,()=>({ok:champ,n:champ?4:0}),()=>'',()=> '2d',esc);
let html=result([high,final,locked,good]);
assert.match(html,/lad:again:good/);
for(const id of ['high','final','locked'])assert(!html.includes('lad:again:'+id));
html=result([high,final,locked]);
assert.match(html,/No other featured event is ready at this difficulty/);
assert.match(html,/data-fx="lad:events"/);
assert(!html.includes('lad:again:'));
assert.match(result([high],{evDiff:1}),/lad:again:high/);
assert.match(result([final],{evDiff:2},true),/lad:again:final/);
assert.match(result([{...good,id:'last'},high]),/lad:events/);
assert.match(result([good,{...good,id:'new',name:'New Loop'}],{evDiff:2,weekly:{gold:{good:true}}}),/lad:again:new/);

const eventsSource=fs.readFileSync(root+'/assets/features/se-events.js','utf8');
const preflightStart=eventsSource.indexOf('   const met=prep.requirements.filter');
const preflightEnd=eventsSource.indexOf('   me.fns.push(',preflightStart);
assert(preflightStart>0&&preflightEnd>preflightStart);
const renderPreflight=new Function('prep','why','disc','h','d','D','req','scoring','bestS','best','esc','fmt','tBest','document','G',
 'let main="";'+eventsSource.slice(preflightStart,preflightEnd)+'return main;');
const preflight=(why,disc,touch=true)=>renderPreflight({ready:!why,prepareHint:'Review your horse.',purse:250,prepareTab:'horse',requirements:[{met:!why}],training:[]},why,disc,{name:'Willow & Fern'},{label:'Elite'},{t:'Show jumping'},'','1:30 allowed',null,null,esc,String,String,{body:{classList:{contains:name=>{assert.equal(name,'touch');return touch;}}}},{seCare:{open(){}}});
let intro=preflight('Elite opens at Lv 3','jump');
assert.match(intro,/Follow the trail to each fence\. Tap Jump when the ring turns green\./);
assert.match(intro,/class="sev-preparation" aria-label="Event preparation"/);
assert.match(intro,/Willow &amp; Fern/);
assert.match(intro,/Current \/ required, including tack/);
assert.match(intro,/role="status">Elite opens at Lv 3/);
assert.match(intro,/data-sev="prepare:myhorses">Choose horse/);
assert.match(intro,/data-sev="ride" disabled/);
intro=preflight('','race');
assert(!intro.includes('Before you ride:'));
assert(!intro.includes('Tap Jump'));
assert.match(intro,/Your horse is ready for this event/);
assert.match(intro,/data-sev="ride">Enter event/);
intro=preflight('Finish Wren\'s quest','xc');
assert.match(intro,/through gates and over fences/);
assert.match(intro,/role="status">Finish Wren's quest/);
assert.match(preflight('','jump',false),/Press Space when the ring turns green/);
const {eventPreparation}=await import(root+'/assets/features/event-preparation.js');
const trainingPrep=eventPreparation({event:{lvl:3,req:{jump:3},reward:320},horse:{level:3},difficulty:{label:'Open'},stats:{base:{jump:2},tack:{},total:{jump:2}},trainingCaps:{jump:{level:4,breed:8}},gate:{ok:false}});
function prepHtml(prep){return renderPreflight(prep,prep.reason,'jump',{name:'Willow'},{label:'Open'},{t:'Show jumping'},'','1:30 allowed',null,null,esc,String,String,{body:{classList:{contains:()=>false}}},{seCare:{open(){}},trainingDrills:{startForEvent(){}}});}
intro=prepHtml(trainingPrep);assert.match(intro,/data-sev="train:jump">Train Jump/);assert.match(intro,/Train base Jump from 2 toward 3/);
assert.equal((intro.match(/data-sev="train:jump"/g)||[]).length,1,'first training action occurs once');
assert.match(intro.slice(intro.indexOf('class="sev-pbar sev-entry-actions"')),/data-sev="train:jump">Train Jump/,'first training action is in the sticky footer');

assert.match(intro,/data-sev="prepare:equipment"/);assert.match(intro,/data-sev="prepare:myhorses"/);assert.match(intro,/data-sev="ride" disabled/);
const capPrep=eventPreparation({event:{lvl:4,req:{jump:5}},horse:{level:4},stats:{base:{jump:4},total:{jump:4}},trainingCaps:{jump:{level:4,breed:8}},gate:{ok:false}});
intro=prepHtml(capPrep);assert(!intro.includes('data-sev="train:jump"'));assert.match(intro,/training cap is 4/);assert.match(intro,/Choose horse/);assert.match(intro,/Compare tack/);
assert.equal((intro.match(/data-sev="prepare:myhorses"/g)||[]).length,1,'capped horse selection occurs once');
assert.match(intro.slice(intro.indexOf('class="sev-pbar sev-entry-actions"')),/data-sev="prepare:myhorses">Choose horse/);
assert(!intro.slice(intro.indexOf('class="sev-pbar sev-entry-actions"')).includes('prepare:equipment'),'capped footer does not route back to tack');
const several=eventPreparation({event:{lvl:3,req:{jump:3,agility:3}},horse:{level:3},stats:{base:{jump:2,agility:2},total:{jump:2,agility:2}},trainingCaps:{jump:{level:4,breed:8},agility:{level:4,breed:8}},gate:{ok:false}});
intro=prepHtml(several);const footerAt=intro.indexOf('class="sev-pbar sev-entry-actions"');
assert.equal((intro.match(/data-sev="train:jump"/g)||[]).length,1);assert.equal((intro.match(/data-sev="train:agility"/g)||[]).length,1);
assert(intro.indexOf('data-sev="train:agility"')<footerAt,'secondary training action remains in readiness details');
assert(intro.indexOf('data-sev="train:jump"')>footerAt,'first training action stays reachable in footer');
const levelOnly=eventPreparation({event:{lvl:5},horse:{level:3},stats:{},gate:{ok:false}});
intro=prepHtml(levelOnly);assert.equal((intro.match(/data-sev="prepare:myhorses"/g)||[]).length,1);
assert.match(intro.slice(intro.indexOf('class="sev-pbar sev-entry-actions"')),/data-sev="prepare:myhorses">Choose horse/);
assert(!intro.includes('Compare tack'),'equipment is not offered as a solution for a pure level gate');
intro=preflight('','race');assert.match(intro.slice(intro.indexOf('class="sev-pbar sev-entry-actions"')),/data-sev="prepare:horse">Prepare horse/,'ready events retain their existing preparation route');



// A final crossing calls finish before the next discipline tick. Exercise the
// production hooks in that order, including a repeated flush, so the final rail
// cannot earn the clean-round achievement or vanish from the score sheet.
const disciplines=fs.readFileSync(root+'/assets/features/events2-disciplines.js','utf8');
const priceSource=disciplines.slice(disciplines.indexOf(' function priceGrades(c){'),disciplines.indexOf(' function eliminate(c){'));
const ribbonSource=disciplines.slice(disciplines.indexOf(" G.on('ribbons',RB=>{"),disciplines.indexOf(' /* Every finish used to put up two cards:'));
const finishStart=disciplines.indexOf(" G.on('courseFinish',({c,ev,stars,RB,pay,dressage,pct})=>{");
const finishSource=disciplines.slice(finishStart,disciplines.indexOf(' /* ================================================================= per frame',finishStart));
assert(priceSource&&ribbonSource&&finishSource);
function finishFixture(grade,{replay=false,xc=false}={}){
 const CUR={lastGrades:1,fenceFaults:0,xcJump:0,xcTime:0,refuseAt:{},elim:false};
 const c={idx:grade==='refusal'?1:2,jumps:[{}, {fenceMul:1.25}],ce:{kind:xc?'xc':'jump',grades:['perfect',grade],refusals:grade==='refusal'?1:0,xcModel:xc},ev:{id:'h1',name:'Welcome'}};
 const saved={},dailies=[],hooks={};
 const G={course:{get:()=>c},on:(k,fn)=>hooks[k]=fn,save:{sync:fn=>fn(saved)},quest:{dailyEvt:k=>dailies.push(k)}};
 const price=new Function('CUR','eliminate',priceSource+'return priceGrades;')(CUR,()=>{CUR.elim=true;});
 new Function('G','CUR','priceGrades',ribbonSource)(G,CUR,price);
 new Function('G','CUR','priceGrades','toast','showResult',finishSource)(G,CUR,price,()=>{},()=>{});
 const RB={ev:c.ev,rib:1,gold:false};
 if(!replay){hooks.ribbons(RB);hooks.ribbons(RB);}
 hooks.courseFinish({c,ev:c.ev,RB,dressage:false});
 price(c);
 return {CUR,RB,saved,dailies};
}
let f=finishFixture('fault');
assert.equal(f.CUR.fenceFaults,5,'final oxer must charge once, including through repeated hook flushes');
assert.equal(f.RB.faultPoints,5,'ribbon payload must see the final rail');
assert(!f.saved.ev2?.clean&&!f.dailies.includes('ev2clear'),'a final rail is not a clean round');
f=finishFixture('refusal');
assert.equal(f.CUR.fenceFaults,4);
assert.equal(f.RB.faultPoints,4);
assert(!f.saved.ev2?.clean&&!f.dailies.includes('ev2clear'),'a final refusal is not a clean round');
f=finishFixture('fault',{replay:true});
assert.equal(f.CUR.fenceFaults,5,'finish without a ribbons hook must still flush');
assert(!f.saved.ev2?.clean);
f=finishFixture('fault',{xc:true});
assert.equal(f.RB.xcJump,14,'cross-country final rail is included before score snapshot');
assert.equal(f.RB.xcTotal,14);
f=finishFixture('perfect');
assert.equal(f.CUR.fenceFaults,0);
assert.equal(f.saved.ev2.clean,1,'a genuinely clear round still earns progress');

// Render the real combined score sheet: refusal is described once and fence
// points are distinguished from the independent overtime penalty.
const scoreSource=src.slice(src.indexOf(' function gradeLine(L){'),src.indexOf(' function fieldBlock(L){'));
const score=new Function('GR','esc','pc','clamp',scoreSource+'return scoreSheet;')(
 ()=>({perfect:{icon:'✨',text:'Perfect!'},fault:{icon:'💥',text:'Rails down'},refusal:{icon:'🛑',text:'Refusal'}}),
 esc,v=>Math.round(v*100),(v,a,b)=>Math.max(a,Math.min(b,v)));
const sheet=score({ev:{},disc:{label:'Show jumping',rows:[['Fence faults','34']]},acc:.1,
 grades:['perfect','refusal','fault','refusal','fault','refusal','fault','refusal','fault'],refusals:4,timeFaults:42});
assert.equal((sheet.match(/Refusals? ×4/g)||[]).length,1);
assert.match(sheet,/Fence faults/);
assert.match(sheet,/Time faults 42/);
assert(!sheet.includes('Over time +'));
assert(disciplines.includes("rows.push(['Fence faults',String(CUR.fenceFaults)"));
const engine=fs.readFileSync(root+'/assets/features/course-engine.js','utf8');
const refusalLine=engine.split('\n').find(l=>l.includes("toast('🛑 Refusal — "));
const refusalText=new Function('document','toast',refusalLine.slice(refusalLine.indexOf("toast('🛑 Refusal — ")));
for(const [touch,label] of [[true,'Tap Jump'],[false,'Press Space']]){
 let text='';refusalText({body:{classList:{contains:()=>touch}}},s=>text=s);
 assert(text.includes(label));
}
console.log('Event guidance: approach geometry, entry locks, touch preflight, final-fence accounting and result clarity passed.');

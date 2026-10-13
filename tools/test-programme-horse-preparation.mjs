import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=file=>readFileSync(new URL('../assets/features/'+file,import.meta.url),'utf8');
const events=read('se-events.js'),engine=read('course-engine.js'),disciplines=read('events2-disciplines.js'),ladder=read('events2-ladder.js'),frame=read('se-frame.js');
const core=readFileSync(new URL('../ranch3d.html',import.meta.url),'utf8'),compete=read('ui2-compete.js');
const section=(source,a,b)=>{const start=source.indexOf(a),end=source.indexOf(b,start);assert(start>=0&&end>start,`Source section ${a}`);return source.slice(start,end);};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const diffs=[{k:'novice',label:'Novice',lvlAdd:0,rewMul:.7,icon:'🌱'},{k:'open',label:'Open',lvlAdd:0,rewMul:1,icon:'🏇'},{k:'elite',label:'Elite',lvlAdd:2,rewMul:1.5,icon:'🔥'}];
const labels={jump:'Jump',stamina:'Stamina'};
function node(){const classes=new Set(),attrs=new Map();return {style:{display:'none'},inert:false,classList:{add:(...c)=>c.forEach(x=>classes.add(x)),remove:(...c)=>c.forEach(x=>classes.delete(x)),contains:c=>classes.has(c)},getAttribute:k=>attrs.get(k)??null,setAttribute:(k,v)=>attrs.set(k,v),removeAttribute:k=>attrs.delete(k),querySelector:()=>null,querySelectorAll:()=>[]};}

function fixture({classic=true,card=false}={}){
 const ev={id:'a2',town:'Barleyfold',name:'Barleyfold Cross Country',lvl:4,req:{jump:5,stamina:5},xc:true,race:true,reward:430},other={id:'h1',town:'Cottonwood',name:'Welcome Jump',lvl:1,reward:150};
 const T={EVENTS3:[other,ev],STAT_LBL:labels},horse={id:1,name:'Bramble',breed:'bay',level:4,xp:125,stats:{jump:4,stamina:4}},save={horses:[horse],ridingHorseId:1,evDiff:1};
 const st={on:false,context:0,compare:false,page:null,diff:null,cur:{}},trace={hide:0,open:0,painted:[],focused:0,framed:0,backTaken:0,starts:0};
 const panel=node();panel.id='eventsPanel';const scoring=node();scoring.id='ev2CardPanel';const root=node();root.contains=()=>false;
 const page=node();page.querySelector=()=>({focus(){trace.focused++;}});
 const panels={eventsPanel:panel,ev2CardPanel:scoring,sevPage:page},$=id=>panels[id]||null;
 const COVERS={},backTo={};
 const frameApi=new Function('COVERS','FRAMED','$','isOpen','frame','unframe','settle','MutationObserver','setTimeout','G','backTo',
  section(frame,' const coveredState=new WeakMap();',' /* ---------------------------------------------------------------- the main menu')+'return {cover,classic,setBack,takeBack};')(
  COVERS,{},$,p=>p.style.display!=='none',()=>{trace.framed++;},()=>{},()=>{},class {observe(){}},()=>{}, {on(){}},backTo);
 const K={...frameApi,settle(){}};
 const actualShowHide=new Function('st','root','K','paint',section(events,' function show(){',' K.screens.add(')+'return {show,hide};')(st,root,K,()=>{});
 const eventsCover=K.cover('eventsPanel',actualShowHide);
 if(classic){panel.style.display='flex';K.classic('eventsPanel',()=>{trace.backTaken++;});}
 if(card){panel.style.display='none';scoring.style.display='flex';}
 const TW=[{name:'Cottonwood',evs:[other]},{name:'Barleyfold',evs:[ev]}];
 const actions={},errors=[];
 const dispatcher=new Function('UI_ACTIONS','console',section(core,'function uiAction(name,fn){','function addTab(')+'return {action:uiAction,dispatch:uiDispatch,bindFx};')(actions,{error:(...args)=>errors.push(args)});
 const G={xp:{effStats:h=>h.stats},course:{},ui:{...dispatcher,openEvents(){trace.open++;if(panel.style.display==='flex'){panel.style.display='none';return;}panel.style.display='flex';}},hidePanels(){trace.hide++;for(const p of [panel,scoring])p.style.display='none';}};
 const api=new Function('S','DIFFS','esc','root','document','st','paintPage','specials','T','$','G','K','TW',
  section(events,' function preparationDifficulty(',' function paintPage(){')+'return {preparationControl,prepareEvent};')(
  ()=>save,()=>diffs,esc,root,{activeElement:null},st,()=>trace.painted.push({id:st.page,diff:st.diff,horseId:save.ridingHorseId}),()=>[{id:'__drill',special:'drill'}],T,$,G,K,TW);
 G.seEvents=api;
 const actionStart=events.indexOf(" G.ui.action('sev',"),actionEnd=events.indexOf('\n',actionStart);assert(actionStart>0&&actionEnd>actionStart);
 new Function('G','prepareEvent',events.slice(actionStart,actionEnd))(G,api.prepareEvent);
 const eventOk=new Function('G','ridden',section(engine,' function eventOk(',' const missingText=')+'return eventOk;')(G,()=>horse);
 G.course.eventOk=eventOk;
 const hooks={};new Function('G','eventOk','missingText','T',section(engine," G.on('eventGate',"," G.on('eventEnter',"))(
  {...G,on:(key,fn)=>hooks[key]=fn},eventOk,m=>m.map(([k,n])=>k+' '+n).join(', '),T);
 return {G,K,T,ev,other,horse,save,st,trace,api,actions,errors,panel,scoring,cover:()=>COVERS.eventsPanel,gate:(h=horse)=>hooks.eventGate(ev,h),eventOk};
}

// Minimal DOM node semantics for this extracted skin branch: appendChild moves
// existing nodes; innerHTML clones content and does not copy onclick handlers.
// That distinction is the actual locked-programme regression from browser QA.
const htmlTrees=new Map();let htmlSerial=0;
class UiNode {
 constructor(tag='span',text=''){this.tagName=tag.toUpperCase();this.dataset={};this.childNodes=[];this.parentNode=null;this.style={};this.onclick=null;this.className='';if(text)this.textContent=text;}
 appendChild(child){if(child.parentNode){const siblings=child.parentNode.childNodes;siblings.splice(siblings.indexOf(child),1);}this.childNodes.push(child);child.parentNode=this;return child;}
 replaceWith(other){if(!this.parentNode)return;const parent=this.parentNode,index=parent.childNodes.indexOf(this);parent.childNodes[index]=other;other.parentNode=parent;this.parentNode=null;}
 set textContent(text){for(const child of this.childNodes)child.parentNode=null;this.childNodes=[];this.text=String(text);}
 get textContent(){return this.text||this.childNodes.map(child=>child.textContent).join('');}
 clone(){const copy=new UiNode(this.tagName,this.text);copy.dataset={...this.dataset};copy.className=this.className;for(const child of this.childNodes)copy.appendChild(child.clone());return copy;}
 get innerHTML(){const token='fixture-html-'+(++htmlSerial);htmlTrees.set(token,this.childNodes.map(child=>child.clone()));return token;}
 set innerHTML(html){this.textContent='';const children=htmlTrees.get(html);if(children)children.forEach(child=>this.appendChild(child.clone()));else this.textContent=html;}
 querySelectorAll(selector){const key=selector.includes('data-fxin')?'fxin':selector.includes('data-fx')?'fx':selector.includes('data-drill')?'drill':selector.includes('data-ev')?'ev':null,result=[];const visit=node=>{for(const child of node.childNodes){if(key&&Object.hasOwn(child.dataset,key))result.push(child);visit(child);}};visit(this);return result;}
 click(){return this.onclick?.();}
}
const el=(tag,cls,text)=>{const n=new UiNode(tag,text);n.className=cls;return n;};
const restyleAction=new Function('el','act','lock','evBtns','ev','won','purse','isF',section(compete,"    const actWrap=el('div','c2-evAct');","    row.textContent='';")+'return actWrap;');
test('an actual bound programme Prepare click survives the real skin pass and reaches the requested preparation page',()=>{
 const f=fixture(),host=new UiNode('div'),lock=new UiNode('span'),button=new UiNode('button','Prepare horse');
 const rendered=f.gate().html;button.dataset.fx=rendered.match(/data-fx="([^"]+)"/)[1];lock.appendChild(new UiNode('span','Needs Jump 5'));lock.appendChild(button);host.appendChild(lock);
 f.G.ui.bindFx(host);assert.equal(typeof button.onclick,'function');assert.equal(f.trace.painted.length,0);
 const skin=restyleAction(el,lock,lock,[],f.ev,false,430,false),visible=skin.querySelectorAll('[data-fx]')[0];
 assert.equal(visible,button,'the visible button must retain its original core binding');visible.click();
 assert.deepEqual(f.trace.painted,[{id:'a2',diff:1,horseId:1}]);assert.equal(f.st.page,'a2');assert.equal(f.cover().classic,false);assert.equal(f.panel.inert,true);assert.deepEqual(f.errors,[]);
});
test('locked-row restyling also preserves original core Drill handlers rather than recreating controls with no action',()=>{
 const host=new UiNode('div'),lock=new UiNode('span'),button=new UiNode('button','Drill'),trace=[];button.dataset.drill='jump';lock.appendChild(button);host.appendChild(lock);
 const bindDrill=section(core," p.querySelectorAll('button[data-drill]')"," p.querySelectorAll('button[data-ev]')");
 new Function('p','startDrill',bindDrill)(host,stat=>trace.push(stat));
 const visible=restyleAction(el,lock,lock,[],{lvl:4},false,430,false).querySelectorAll('button[data-drill]')[0];visible.click();assert.deepEqual(trace,['jump']);assert.equal(host.style.display,'none');assert.equal(visible,button);
});
test('the existing ready-event action keeps its production core binding and label after the same skin pass',()=>{
 const host=new UiNode('div'),button=new UiNode('button','Open'),ev={id:'a2',lvl:4},trace=[];button.dataset.ev='0:2';host.appendChild(button);
 new Function('p','startCourse','EVENTS3',section(core," p.querySelectorAll('button[data-ev]')"," p.querySelectorAll('button[data-wk]')"))(host,(event,diff)=>trace.push({event,diff}),[ev]);
 const visible=restyleAction(el,button,null,[button],ev,false,430,false).querySelectorAll('button[data-ev]')[0];assert.equal(visible.textContent,'Enter');visible.click();assert.deepEqual(trace,[{event:ev,diff:2}]);assert.equal(visible,button);
});

test('locked programme controls connect to preparation with their actual gate intact, including level-only gaps',()=>{
 const f=fixture(),before=structuredClone(f.save),g=f.gate();
 assert.equal(g.ok,false);assert.deepEqual(g.missing,[['jump',5,4],['stamina',5,4]]);assert.match(g.html,/data-fx="sev:prepare:a2:1"/);assert.match(g.html,/>Prepare horse</);assert.doesNotMatch(g.html,/data-drill/);
 f.horse.level=2;f.horse.stats={jump:5,stamina:5};const level=f.gate();assert.equal(level.ok,false);assert.deepEqual(level.missing,[['level',4,2]]);assert.match(level.html,/sev:prepare:a2:1/);
 f.horse.level=4;assert.equal(f.gate().ok,true);assert.equal(f.gate().html,'');
 assert.equal(f.trace.starts,0);assert.deepEqual(before,{horses:[{id:1,name:'Bramble',breed:'bay',level:4,xp:125,stats:{jump:4,stamina:4}}],ridingHorseId:1,evDiff:1});
});
test('an isolated course engine without the preparation package retains its existing Drill fallback',()=>{
 const f=fixture();delete f.G.seEvents;
 const hooks={};new Function('G','eventOk','missingText','T',section(engine," G.on('eventGate',"," G.on('eventEnter',"))({...f.G,on:(k,fn)=>hooks[k]=fn},f.eventOk,()=>'',f.T);
 assert.match(hooks.eventGate(f.ev,f.horse).html,/data-drill="jump"/);assert.doesNotMatch(hooks.eventGate(f.ev,{level:1,stats:{jump:5,stamina:5}}).html,/data-drill/);
});
test('the programme action restores the real Events cover and opens its displayed event/difficulty rather than the remembered carousel card',()=>{
 const f=fixture(),before=structuredClone(f.save);f.st.page='h1';f.st.diff=0;f.st.cur.Cottonwood=0;
 assert.equal(f.cover().classic,true);assert.equal(f.panel.inert,false);
 assert.equal(f.actions.sev(['prepare','a2','2']),true);
 assert.equal(f.trace.hide,1);assert.equal(f.trace.open,1);assert.equal(f.panel.style.display,'flex');assert.equal(f.cover().classic,false);assert.equal(f.cover().on,true);assert.equal(f.panel.inert,true);assert.equal(f.panel.getAttribute('aria-hidden'),'true');assert.equal(f.st.on,true);assert.equal(f.st.page,'a2');assert.equal(f.st.diff,2);assert.equal(f.st.townName,'Barleyfold');assert.equal(f.st.cur.Barleyfold,0);assert.equal(f.st.compare,false);assert.equal(f.trace.focused,1);
 assert.deepEqual(f.trace.painted,[{id:'a2',diff:2,horseId:1}]);assert.equal(f.K.takeBack('eventsPanel'),null,'the redundant classic-return callback cannot trap Back in Events');assert.deepEqual(f.save,before,'opening the readiness page earns no horse XP or event progress');
});
test('both scoring and reward-card preparation use the same route and close their card without starting an event',()=>{
 for(const diff of [0,1,2]){
  const f=fixture({card:true}),before=structuredClone(f.save);assert.equal(f.api.prepareEvent('a2',diff),true);
  assert.equal(f.scoring.style.display,'none');assert.equal(f.panel.style.display,'flex');assert.equal(f.st.page,'a2');assert.equal(f.st.diff,diff);assert.equal(f.trace.starts,0);assert.deepEqual(f.save,before);
 }
});
test('repeated programme transitions inspect the current cover state instead of retaining an obsolete cover object',()=>{
 const f=fixture();assert.equal(f.api.prepareEvent('a2',2),true);f.K.classic('eventsPanel',()=>{});assert.equal(f.cover().classic,true);
 assert.equal(f.api.prepareEvent('a2',0),true);assert.equal(f.cover().classic,false);assert.equal(f.cover().on,true);assert.equal(f.st.on,true);assert.equal(f.st.diff,0);assert.equal(f.K.takeBack('eventsPanel'),null);assert.equal(f.trace.hide,2);assert.equal(f.trace.open,2);assert.equal(f.trace.starts,0);
});
test('an ordinary Events caller retains its existing Journey return route',()=>{
 const f=fixture({classic:false}),back=()=>{};f.K.setBack('eventsPanel',back);
 assert.equal(f.api.prepareEvent('a2',1),true);assert.equal(f.K.takeBack('eventsPanel'),back);assert.equal(f.st.diff,1);assert.equal(f.trace.starts,0);
});
test('a stale rendered action uses the current selected saved horse without reselecting or inventing readiness',()=>{
 const f=fixture(),control=f.api.preparationControl(f.ev,2);assert.match(control,/sev:prepare:a2:2/);
 f.save.ridingHorseId=2;f.save.horses.push({id:2,name:'Clover',level:2,xp:20,stats:{jump:4,stamina:4}});
 assert.equal(f.actions.sev(['prepare','a2','2']),true);assert.deepEqual(f.trace.painted,[{id:'a2',diff:2,horseId:2}]);assert.equal(f.save.ridingHorseId,2);
});
test('unknown events, special activities and malformed difficulties are rejected before closing a player panel',()=>{
 for(const [id,diff]of [['gone',1],['__drill',1],['a2',-1],['a2',3],['a2',1.5],['a2',NaN],['a2',Infinity],['a2','2']]){
  const f=fixture();assert.equal(f.api.prepareEvent(id,diff),false);assert.equal(f.trace.hide,0);assert.equal(f.trace.open,0);assert.equal(f.cover().classic,true);assert.deepEqual(f.trace.painted,[]);
 }
 const f=fixture();delete f.G.ui.openEvents;assert.equal(f.api.prepareEvent('a2',1),false);assert.equal(f.trace.hide,0);
 assert.equal(f.actions.sev(['other','a2','2']),false);assert.equal(f.actions.sev(['prepare','a2','not-a-difficulty']),false);
});
test('controls bind the rendered difficulty, validate real event identity, escape labels and keep a phone-sized hit target',()=>{
 const f=fixture();f.save.evDiff=2;assert.match(f.api.preparationControl(f.ev),/sev:prepare:a2:2/);assert.match(f.api.preparationControl(f.ev,0),/sev:prepare:a2:0/);assert.match(f.api.preparationControl(f.ev,1,'<Ready & ride>'),/>&lt;Ready &amp; ride&gt;</);assert.match(f.api.preparationControl(f.ev),/min-height:44px/);
 for(const [event,diff]of [[{id:'gone'},1],[{id:'__drill'},1],[f.ev,-1],[f.ev,3],[f.ev,NaN]])assert.equal(f.api.preparationControl(event,diff),'');
 const malicious={...f.ev,id:'unsafe"<x>'};f.T.EVENTS3.push(malicious);assert.match(f.api.preparationControl(malicious,1),/unsafe&quot;&lt;x&gt;:1/);assert.doesNotMatch(f.api.preparationControl(malicious,1),/<x>/);
});

function programmeRow(f){
 let render;const G={...f.G,ui:{eventRow:fn=>render=fn}};
 new Function('G','discOf','discDetail','SCORE_BANDS','allowedLine',section(disciplines," G.ui.eventRow((ev,s,h)=>{\n  const d=discOf(ev);",' let FILTER=null;'))(G,()=>({k:'xc',icon:'🌲',label:'Cross country',sub:'Eventing'}),()=> '8 fences','75/90',()=> '120s');
 return render(f.ev,f.save,f.horse);
}
test('the real programme row keeps one scoring Full card and avoids duplicating the blocked preparation control',()=>{
 const f=fixture(),blocked=f.gate().html+programmeRow(f);assert.equal((blocked.match(/sev:prepare:a2:1/g)||[]).length,1);assert.match(blocked,/data-fx="ev2:card:a2"/);assert.match(blocked,/Full card/);
 f.horse.stats={jump:5,stamina:5};const ready=programmeRow(f);assert.match(ready,/sev:prepare:a2:1/);assert.match(ready,/ev2:card:a2/);
});
function scoringCard(f){
 const ev=f.ev,d={k:'xc',icon:'🌲',label:'Cross country',sub:'Eventing',stats:['jump','stamina']};
 return new Function('cardFor','G','ridden','DI_OPEN','discOf','discDetail','T','SCORE_BANDS','allowedLine','fmtT','reqLine','tackLine','rewardLine','DIFFS','diffAt',
  section(disciplines,' function cardHtml(){'," G.ui.panel({id:'ev2CardPanel'")+'return cardHtml();')(
  ev,{...f.G,save:{fresh:()=>f.save}},()=>f.horse,1,()=>d,()=> '8 fences',f.T,'75% / 90%',()=> '2:00',String,()=> 'Needs Jump 5',()=> 'Jump 4 trained',()=> '430 coins',diffs,i=>diffs[i]);
}
test('the actual scoring Full card retains rules, stat gates, tack and purse beside its new preparation link',()=>{
 const f=fixture();f.save.evDiff=2;const html=scoringCard(f);assert.match(html,/Cross country is scored the eventing way/);assert.match(html,/Needs Jump 5/);assert.match(html,/Jump 4 trained/);assert.match(html,/What it pays · Elite/);assert.match(html,/430 coins/);assert.match(html,/sev:prepare:a2:2/);assert.match(html,/close:ev2CardPanel/);
});
function rewardCard(f,lock){
 const G={...f.G,course:{...f.G.course,eventTimeAllowed:()=>120}};
 return new Function('DIFFS','featuredNow','G','E','lad','T','FIELD_N','esc','s1','pc','entryLock',section(ladder,' function previewCard('," /* The Enter button used to ask")+'return previewCard;')(
  ()=>diffs,()=>[],G,()=>({}),()=>({rib:{byEv:{}}}),f.T,{open:3,elite:4},esc,String,v=>Math.round(v*100),()=>lock)(f.ev,f.save,f.horse);
}
test('the actual rewards card keeps the authoritative lock and ready Enter behavior while connecting either state to preparation',()=>{
 const f=fixture();f.save.evDiff=2;const locked=rewardCard(f,'Elite opens at Lv 6');assert.match(locked,/Elite opens at Lv 6/);assert.doesNotMatch(locked,/lad:again:a2/);assert.match(locked,/sev:prepare:a2:2/);assert.match(locked,/What it pays/);assert.match(locked,/Your record here/);
 const ready=rewardCard(f,'');assert.match(ready,/lad:again:a2/);assert.match(ready,/sev:prepare:a2:2/);
});
test('the second programme card changes only its label; scoring and rewards remain distinct existing routes',()=>{
 let render;const f=fixture();
 new Function('G','lad','DIFFS','FIELD_N','featuredNow','E','esc','bandLabel','judgedOfWeek',section(ladder," G.ui.eventRow((ev,s,h)=>{\n  s=s||{};",' /* the Events panel:'))(
  {...f.G,ui:{eventRow:fn=>render=fn}},()=>({rib:{byEv:{}}}),()=>diffs,{open:3},()=>[],()=>({}),esc,()=>'',()=>null);
 const html=render(f.ev,f.save,f.horse);assert.match(html,/data-fx="lad:why:a2"/);assert.match(html,/Rewards &amp; record/);assert.doesNotMatch(html,/Full card/);assert.match(programmeRow(f),/data-fx="ev2:card:a2"/);
});

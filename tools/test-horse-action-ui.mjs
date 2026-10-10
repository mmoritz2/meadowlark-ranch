import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {horseActionReadiness,performHorsePanelAction} from '../assets/features/bond-personality-emotes.js';

const html=await readFile(new URL('../breeds.html',import.meta.url),'utf8');
const source=await readFile(new URL('../assets/features/bond-personality-emotes.js',import.meta.url),'utf8');
const studioCode=html.split('// Studio action controls keep')[1].split('// End Studio action controls.')[0];
const studioBody=studioCode.slice(studioCode.indexOf('\n')+1);
function element(id){return {id,value:'',textContent:'',hidden:false,disabled:false,title:'',attrs:{},listeners:{},options:[],setAttribute(k,v){this.attrs[k]=v;},getAttribute(k){return this.attrs[k];},addEventListener(k,v){this.listeners[k]=v;},focus(){this.focused=true;}};}
function studio(){
 const ids=['action','action-controls','replay-action','stop-action','action-state','action-status','action-time','action-progress','motion','pause','lead','view-toggle','view-options','action-description','repeat-action'];
 const elements=Object.fromEntries(ids.map(id=>[id,element(id)])),calls=[];
 elements.motion.options=['stand','walk','canter'].map(value=>({value,textContent:value==='stand'?'Idle':value}));elements.motion.value='stand';elements.lead.value='left';elements['view-options'].hidden=true;
 const motion={supportedActions:['rear','graze','liedown'],mode:'stand',action:null,blocksTravel:false,state:{blocksTravel:false},supportsAction:type=>['rear','graze','liedown'].includes(type),actionDescriptor:type=>({label:{rear:'Rear',graze:'Graze',liedown:'Lie down'}[type]}),
  cancelAction(){calls.push('cancel');this.action=null;},set(mode){calls.push(mode);this.mode=mode;},startAction(type){calls.push(type);if(this.blocksTravel)return false;this.action={type,timeS:0,durationS:4,progress:0};this.mode='action';if(type==='liedown')this.blocksTravel=true;return true;}};
 const context=vm.createContext({$:id=>elements[id],motion,paused:false,loading:false,headView:false,fitBodyCamera:()=>calls.push('frame'),camera:{position:{clone:()=>({sub:()=>({})})}},controls:{target:{}}});
 vm.runInContext(studioBody,context);
 return{elements,motion,calls,context,run:code=>vm.runInContext(code,context)};
}
test('Studio selection plays, restarts, survives completion and replays the same action',()=>{
 const f=studio(),e=f.elements;e.action.value='rear';e.action.onchange();assert.equal(f.motion.action.type,'rear');assert.equal(e['replay-action'].textContent,'Restart');
 f.motion.action.timeS=2;f.motion.action.progress=.5;f.run('updateStudioActionUI()');assert.equal(e['action-progress'].value,.5);assert.equal(e['action-time'].textContent,'2.0 / 4.0 s');
 e['replay-action'].onclick();assert.equal(f.motion.action.timeS,0);assert.equal(e.action.value,'rear');
 f.motion.action=null;f.motion.mode='stand';f.run('updateStudioActionUI()');assert.equal(e.action.value,'rear');assert.equal(e['replay-action'].textContent,'Play again');assert.equal(e['action-status'].textContent,'Rear finished');assert.equal(e['action-progress'].hidden,true);
 e['replay-action'].onclick();assert.equal(f.motion.action.type,'rear');
});
test('Studio stopping preserves selection; changing movement resumes a paused preview',()=>{
 const f=studio(),e=f.elements;e.action.value='graze';e.action.onchange();e.pause.onclick();assert.equal(f.context.paused,true);assert.match(e['action-status'].textContent,/Paused/);
 e['stop-action'].onclick();assert.equal(f.motion.action,null);assert.equal(f.motion.mode,'stand');assert.equal(e.action.value,'graze');assert.equal(f.context.paused,false);assert.equal(e['stop-action'].disabled,true);
 e.action.onchange();e.pause.onclick();e.motion.value='walk';e.motion.onchange();assert.equal(f.motion.mode,'walk');assert.equal(f.context.paused,false);assert.equal(e.action.value,'graze');
 e.action.value='';e.action.onchange();assert.equal(f.motion.action,null);assert.equal(e['replay-action'].disabled,true);
});
test('Studio protected lie-down finishes its get-up before replay, movement or stop',()=>{
 const f=studio(),e=f.elements;e.action.value='liedown';e.action.onchange();const calls=f.calls.length;
 assert.equal(e.action.disabled,true);assert.equal(e.motion.disabled,true);assert.equal(e['stop-action'].disabled,true);assert.match(e['action-status'].textContent,/includes getting up/);
 e['stop-action'].onclick();e['replay-action'].onclick();e.motion.onchange();assert.equal(f.calls.length,calls,'protected action is never directly cancelled or retriggered');
 f.motion.action=null;f.run('updateStudioActionUI()');assert.match(e['action-status'].textContent,/Returning to idle/);assert.equal(e['replay-action'].disabled,true);assert.equal(e.action.value,'liedown');
 f.motion.blocksTravel=false;f.motion.mode='stand';f.run('updateStudioActionUI()');assert.equal(e.action.disabled,false);assert.equal(e['replay-action'].disabled,false);assert.equal(e.action.value,'liedown');
});
test('Loading gates actions and View opens/closes without losing selection or keyboard focus',()=>{
 const f=studio(),e=f.elements;e.action.value='rear';f.context.loading=true;f.run('updateStudioActionUI()');assert.equal(e.action.disabled,true);assert.equal(e['replay-action'].disabled,true);assert.equal(e.pause.disabled,true);assert.equal(e['replay-action'].onclick(),false);assert.equal(f.calls.length,0);
 e['view-toggle'].onclick();assert.equal(e['view-options'].hidden,false);assert.equal(e['view-toggle'].attrs['aria-expanded'],'true');let stopped=false;e['view-options'].listeners.keydown({key:'Escape',stopPropagation(){stopped=true;}});assert(stopped);assert.equal(e['view-options'].hidden,true);assert.equal(e['view-toggle'].focused,true);assert.equal(e.action.value,'rear');
});
test('Studio markup keeps unique action IDs, compact View contents and measured framing',()=>{
 for(const id of ['action','motion','replay-action','stop-action','view-options','action-status','action-progress'])assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1,id);
 const view=html.indexOf('id="view-options"');assert(view<html.indexOf('id="surface"'));assert(view<html.indexOf('id="side"'));assert(view<html.indexOf('Drag to orbit'));assert.match(html,/observe\(document\.querySelector\('\.controls'\)\)/);assert.match(html,/min-height:44px/);
 assert(!html.includes("$('action').value=action?.type||''"),'animation ticks do not overwrite the selected option');
});
test('Repeat waits for complete action, recovery, transition and an unpaused idle beat',()=>{
 const f=studio(),e=f.elements;e.action.value='liedown';e.action.onchange();e['repeat-action'].onclick();
 assert.equal(e['repeat-action'].getAttribute('aria-pressed'),'true');const count=()=>f.calls.filter(c=>c==='liedown').length;
 f.run('tickStudioRepeat(3)');assert.equal(count(),1);f.motion.action=null;f.run('tickStudioRepeat(3)');assert.equal(count(),1,'get-up blend still blocks repeat');
 f.motion.blocksTravel=false;f.motion.state.transitioning=true;f.run('tickStudioRepeat(3)');assert.equal(count(),1);
 f.motion.state.transitioning=false;f.context.paused=true;f.run('tickStudioRepeat(3)');assert.equal(count(),1);
 f.context.paused=false;f.run('tickStudioRepeat(.5)');assert.equal(count(),1);f.run('tickStudioRepeat(.41)');assert.equal(count(),2);
});
test('Stop and movement cancel scheduled repeat without clearing the user preference',()=>{
 const f=studio(),e=f.elements;e.action.value='rear';e.action.onchange();e['repeat-action'].onclick();e['stop-action'].onclick();const calls=f.calls.length;f.run('tickStudioRepeat(10)');assert.equal(f.calls.length,calls);assert.equal(e['repeat-action'].getAttribute('aria-pressed'),'true');
 e.action.onchange();e.motion.value='walk';e.motion.onchange();const moved=f.calls.length;f.run('tickStudioRepeat(10)');assert.equal(f.calls.length,moved);
});
test('Enabling Repeat after completion starts a new full preview, rather than staying armed forever',()=>{
 const f=studio(),e=f.elements;e.action.value='rear';e.action.onchange();f.motion.action=null;f.motion.mode='stand';f.run('updateStudioActionUI()');e['repeat-action'].onclick();f.run('tickStudioRepeat(.91)');assert.equal(f.motion.action.type,'rear');assert.equal(f.calls.filter(c=>c==='rear').length,2);
});
function studioFrames(){
 const code=html.split('// Studio frame clock uses')[1]?.split('// End Studio frame clock.')[0];
 assert(code,'production animation loop is available');
 let frame,visibility,draws=0;const deltas=[];
 const document={hidden:false,addEventListener(name,fn){assert.equal(name,'visibilitychange');visibility=fn;}};
 const ctx=vm.createContext({performance:{now(){throw new Error('Do not mix event time with frame timestamps');}},document,renderer:{setAnimationLoop(fn){frame=fn;}},paused:false,
  simulate(dt){assert(Number.isFinite(dt)&&dt>0&&dt<=.1,'native motion receives a finite positive bounded delta');deltas.push(dt);},draw(){draws++;}});
 vm.runInContext('// Studio frame clock uses'+code,ctx);
 return{frame,document,ctx,deltas,get draws(){return draws;},visibility(){visibility();}};
}
test('Hidden tabs freeze preview/repeat time without changing the manual pause choice',()=>{
 const f=studioFrames();f.frame(100);f.frame(116);assert.deepEqual(f.deltas,[.016]);
 f.document.hidden=true;f.visibility();f.frame(5000);assert.deepEqual(f.deltas,[.016]);assert.equal(f.draws,2);assert.equal(f.ctx.paused,false);
 f.document.hidden=false;f.visibility();f.frame(6000);f.frame(6016);assert.deepEqual(f.deltas,[.016,.016],'first visible frame primes the clock without hidden elapsed-time catch-up');
 f.ctx.paused=true;f.frame(6032);f.frame(20000);assert.deepEqual(f.deltas,[.016,.016]);assert.equal(f.ctx.paused,true);
 f.ctx.paused=false;f.frame(20016);assert.deepEqual(f.deltas,[.016,.016,.016],'paused elapsed time never reaches the next playback frame');
 assert.match(html,/loading=true;studioRepeatArmed=false;studioRepeatClock=0;updateStudioActionUI/,'horse selection immediately clears repeat intent, including failed loads');
});
test('A queued frame older than a visibility event cannot create the observed negative native delta',()=>{
 const f=studioFrames();f.frame(100);f.frame(116);
 // The event may run at performance.now()=130 while a frame stamped 128 is queued.
 // Resetting to that event time used to feed -0.002 into native motion.update().
 f.visibility();f.frame(128);assert.deepEqual(f.deltas,[.016]);f.frame(144);assert.deepEqual(f.deltas,[.016,.016]);
 assert.equal(f.draws,4,'the newly visible scene still draws immediately');
});
test('Duplicate and out-of-order frames do not rewind the clock or advance the action',()=>{
 const f=studioFrames();f.frame(100);f.frame(116);f.frame(116);f.frame(110);f.frame(-10);
 assert.deepEqual(f.deltas,[.016]);f.frame(132);assert.deepEqual(f.deltas,[.016,.016],'a stale timestamp cannot inflate the next update');
 f.frame(5000);assert.equal(f.deltas.at(-1),.1,'long visible stalls keep the existing 100 ms cap');
 f.frame(5016);assert.equal(f.deltas.at(-1),.016);
});
test('Nonfinite frame timestamps cannot poison later playback and rendering continues',()=>{
 const f=studioFrames();f.frame(100);f.frame(116);
 for(const invalid of [NaN,Infinity,-Infinity,undefined]){
  f.frame(invalid);f.frame(200);assert.equal(f.deltas.length,1,'invalid time clears the clock; the next valid frame only primes it');
 }
 f.frame(216);assert.deepEqual(f.deltas,[.016,.016]);assert.equal(f.draws,11);
});
test('Selected-action help comes from the actual descriptor',()=>{
 const f=studio(),e=f.elements;f.motion.actionDescriptor=()=>({label:'Rear',description:'A measured lift, then a soft landing.'});e.action.value='rear';f.run('updateStudioActionUI()');assert.equal(e['action-description'].hidden,false);assert.equal(e['action-description'].textContent,'A measured lift, then a soft landing.');e.action.value='';f.run('updateStudioActionUI()');assert.equal(e['action-description'].hidden,true);
});
function ranch(){
 const rig={ready:true,profile:{nativeBreed:true},heroMotion:{supportedActions:['rear','liedown'],state:{action:null},actionDescriptor:type=>({label:type==='rear'?'Rear':'Lie down'})}};
 const G={horse:{RIG:()=>rig,player:{onFoot:false,speed:0,y:0},rideIdx:()=>0},tables:{EMOTES:{rear:{label:'Rear'},liedown:{label:'Lie down',lockHint:'Bond level 2'},graze:{label:'Graze'}}},mastery:{isWild:()=>false},onFoot:{on:false,state:()=>({horse:null}),horseActionTarget:()=>null},hidePanels(){this.closed=(this.closed||0)+1;}};
 return{G,rig};
}
test('Ranch readiness resolves actual parked action support and loading, pending and departure states',()=>{
 const {G,rig}=ranch();assert.equal(horseActionReadiness(G).blocked,false);G.horse.player.onFoot=true;
 assert.equal(horseActionReadiness(G).status,'Preparing your horse…');assert.deepEqual(horseActionReadiness(G).supported,['rear','liedown']);
 const parked={profile:{nativeBreed:true},heroMotion:{supportedActions:['graze'],state:{action:null},actionDescriptor:()=>({label:'Graze'})}};G.onFoot.horseActionTarget=()=>parked;
 assert.equal(horseActionReadiness(G).target,parked);assert.deepEqual(horseActionReadiness(G).supported,['graze']);assert.equal(horseActionReadiness(G).blocked,false);
 G.onFoot.state=()=>({horse:{pending:'graze'}});assert.equal(horseActionReadiness(G).blocked,true);
 G.onFoot.state=()=>({horse:{departure:'mount'}});assert.match(horseActionReadiness(G).status,/getting ready/);
 G.onFoot.state=()=>({horse:{}});parked.heroMotion.state.action={type:'graze',progress:.5};assert.match(horseActionReadiness(G).status,/Graze.*in progress/);assert.equal(rig.heroMotion.state.action,null);
});
test('Ranch live readiness blocks travel, active actions and return blend without cancelling',()=>{
 const {G,rig}=ranch();G.horse.player.speed=1;assert.match(horseActionReadiness(G).status,/halt/);G.horse.player.speed=0;rig.heroMotion.state.action={type:'liedown'};assert.match(horseActionReadiness(G).status,/resting and getting up/);
 rig.heroMotion.state.action=null;rig.heroMotion.state.blocksTravel=true;assert.equal(horseActionReadiness(G).blocked,true);rig.heroMotion.state.blocksTravel=false;assert.equal(horseActionReadiness(G).blocked,false);
 rig.heroMotion.supportedActions=[];assert.match(horseActionReadiness(G).status,/no actions/);rig.ready=false;assert.match(horseActionReadiness(G).status,/Preparing/);
});
test('Ranch closes only accepted actions; failed or throwing requests retain the panel',()=>{
 const {G}=ranch();let received;G.horse.horseEmote=type=>{received=type;return false;};assert.equal(performHorsePanelAction(G,'rear'),false);assert.equal(received,'rear');assert.equal(G.closed,undefined);
 G.horse.horseEmote=()=>{throw new Error('Loading');};assert.throws(()=>performHorsePanelAction(G,'rear'),/Loading/);assert.equal(G.closed,undefined);
 G.horse.horseEmote=()=>true;assert.equal(performHorsePanelAction(G,'rear'),true);assert.equal(G.closed,1);
});
test('Production panel renders horse-first, escapes names, preserves locks and uses parked capabilities',()=>{
 const {G,rig}=ranch();const events={};G.ui={panel:def=>G.panel=def,rerender:()=>{}};G.on=(name,fn)=>events[name]=fn;G.key=()=> 'KeyE';
 G.horse.player.onFoot=true;G.onFoot.horseActionTarget=()=>({profile:{nativeBreed:true},heroMotion:{supportedActions:['graze','liedown'],state:{action:null},actionDescriptor:type=>({dismountedOnly:type==='liedown'})}});
 const document={createElement:()=>({}),head:{appendChild(){}}};const context=vm.createContext({G,document,$:()=>null,horseActionReadiness,EMOTES:G.tables.EMOTES,RIDER_EMOTES:{wave:{label:'Wave'}},emoteOwned:()=>true,emoteUnlocked:(_,k)=>k!=='liedown',bondLevel:()=>1});
 const block=source.slice(source.indexOf(" const actionCss=document.createElement('style')"),source.indexOf(' /* ---- Care / Stable surfaces'));
 vm.runInContext(block,context);const panel={dataset:{}},markup=G.panel.render(panel,{horses:[{name:'<Misty & Clover>'}]});
 assert.equal(G.panel.title,'Horse actions');assert(markup.indexOf('bpe:hem:graze')<markup.indexOf('Rider emotes'));assert(!markup.includes('bpe:hem:rear'));assert(markup.includes('&lt;Misty &amp; Clover&gt;'));assert.match(markup,/data-horse-action="liedown" data-locked="true" disabled/);assert.match(markup,/<details class="rider-actions">/);assert.equal(panel.dataset.horseActionOptions,'graze|liedown');assert.equal(typeof events.tick,'function');assert.equal(rig.heroMotion.state.action,null);
});

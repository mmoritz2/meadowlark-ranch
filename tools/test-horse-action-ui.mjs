import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {horseActionReadiness,performHorsePanelAction} from '../assets/features/bond-personality-emotes.js';

const html=await readFile(new URL('../breeds.html',import.meta.url),'utf8');
const source=await readFile(new URL('../assets/features/bond-personality-emotes.js',import.meta.url),'utf8');
const studioCode=html.split('// Studio action controls keep')[1].split('// End Studio action controls.')[0];
const studioBody=studioCode.slice(studioCode.indexOf('\n')+1);
function element(id){return {id,value:'',textContent:'',hidden:false,disabled:false,title:'',attrs:{},listeners:{},options:[],setAttribute(k,v){this.attrs[k]=v;},addEventListener(k,v){this.listeners[k]=v;},focus(){this.focused=true;}};}
function studio(){
 const ids=['action','action-controls','replay-action','stop-action','action-state','action-status','action-time','action-progress','motion','pause','lead','view-toggle','view-options'];
 const elements=Object.fromEntries(ids.map(id=>[id,element(id)])),calls=[];
 elements.motion.options=['stand','walk','canter'].map(value=>({value,textContent:value==='stand'?'Idle':value}));elements.motion.value='stand';elements.lead.value='left';elements['view-options'].hidden=true;
 const motion={mode:'stand',action:null,blocksTravel:false,state:{blocksTravel:false},supportsAction:type=>['rear','graze','liedown'].includes(type),actionDescriptor:type=>({label:{rear:'Rear',graze:'Graze',liedown:'Lie down'}[type]}),
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

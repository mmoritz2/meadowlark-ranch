import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {journeySnapshot} from '../assets/features/rider-journey-rules.mjs';
import {sanitizeRescueSave,canAdoptClover} from '../assets/features/rescue-rules.mjs';
import {RUSH_DEFINITIONS} from '../assets/features/ranch-rush-rules.mjs';

// Use the established lightweight DOM model, then execute the complete real
// installer. The fixture replaces only browser plumbing and gameplay providers.
const original=fs.readFileSync(new URL('./test-roundup-hud.mjs',import.meta.url),'utf8');
let domSource=original.slice(original.indexOf('function dom(){'),original.indexOf('function fixture(){'));
domSource=domSource.replace("n.classList={", "n.addEventListener=()=>{};n.classList={");
domSource=domSource.replace("stack.at(-1).appendChild(child);", "if(/\\sdisabled(?:\\s|>)/.test(value))child.disabled=true;stack.at(-1).appendChild(child);");
domSource=domSource.replace("text._text=value;", "text._text=value.replace(/&(amp|lt|gt|quot|#39);/g,(_,x)=>({amp:'&',lt:'<',gt:'>',quot:'\"','#39':\"'\"}[x]));");
const makeDOM=Function(domSource+'return dom;')();
const source=fs.readFileSync(new URL('../assets/features/ride-hub.js',import.meta.url),'utf8').replace(/^export /gm,'');
const clone=v=>structuredClone(v);
function fixture({adopted=false,name='Clover',sold=false}={}){
 const document=makeDOM(),hooks=new Map(),actions=new Map(),panels=new Map(),timers=new Map();let timer=0,resolveMount=null;
 const save={horses:[{id:1,name:'Bramble',breed:'bay-sporthorse'}],rescueRides:{version:1,completions:1,bestTime:80,lastRunId:'real-rescue',adopted,adoptedHorseId:adopted?2:null},stats:{rounded:0}};
 if(adopted&&!sold)save.horses.push({id:2,name,breed:'pinto',rescueClover:true});
 const mount={available:adopted&&!sold,name,horseId:adopted&&!sold?2:null,selected:false,ready:false,loading:false,error:null};
 const calls={mount:0,adopt:0,hide:0,render:0,open:[],next:[],rush:0,roundup:0,stable:0,toasts:[]};
 let active=null;
 const G={save:{fresh:()=>clone(save)},horse:{player:{pos:{x:0,z:0},heading:0}},
  rescueRide:{snapshot:()=>({records:{...sanitizeRescueSave(save.rescueRides),canAdopt:canAdoptClover(save.rescueRides)},active,lastResult:null}),adoptedMount:()=>({...mount}),
   rideAdopted(){calls.mount++;mount.loading=true;return new Promise(resolve=>{resolveMount=ok=>{mount.loading=false;mount.selected=true;mount.ready=ok;mount.error=ok?null:'Clover could not finish loading. Try riding her again.';resolve(ok);};});},
   adopt(){calls.adopt++;save.rescueRides.adopted=true;save.rescueRides.adoptedHorseId=2;mount.available=true;mount.horseId=2;return true;},start:()=>false,cancel(){},reassure(){},retrySave(){}},
  course:{get:()=>null,drillActive:()=>false},roundup:{state:()=>({active:false}),start(){calls.roundup++;return true;}},trail:{ride:null},
  ranchRush:{definitions:RUSH_DEFINITIONS,snapshot:()=>({records:save.ranchRush?.records||{}})},
  ranchRushUI:{setQuickAction(v){calls.quick=v;},open(){calls.rush++;}},riderJourney:{snapshot:()=>journeySnapshot(save)},
  riderJourneyUI:{summary:()=>'<p>Existing journey summary</p>',start(){calls.next.push(journeySnapshot(save).nextAction);}},
  on(k,fn){const list=hooks.get(k)||[];list.push(fn);hooks.set(k,list);},run(k,...args){for(const fn of hooks.get(k)||[])fn(...args);},toast:m=>calls.toasts.push(m),
  hidePanels(){calls.hide++;for(const id of panels.keys())document.getElementById(id).style.display='none';},seFrame:{screens:new Set(),settle(){}},
  ui:{panel(def){panels.set(def.id,def);const n=document.createElement('section');n.id=def.id;n.style.display='none';document.body.append(n);},action:(k,fn)=>actions.set(k,fn),
   rerender(id){calls.render++;document.getElementById(id).innerHTML=panels.get(id).render();},open(id){G.hidePanels();this.rerender(id);document.getElementById(id).style.display='flex';calls.open.push(id);},openStable(){calls.stable++;}}};
 const install=Function('document','window','MutationObserver','setTimeout','clearTimeout',source+'\nreturn install;')(
  document,{addEventListener(){}},class{observe(){}},fn=>{timers.set(++timer,fn);return timer;},id=>timers.delete(id));
 install(G);const panel=document.getElementById('rideHubPanel');
 const act=(action,...args)=>actions.get('adventure')([action,...args]);
 const button=action=>panel.querySelectorAll('button').find(n=>n.getAttribute('data-fx')==='adventure:'+action)||null;
 function click(action){const node=button(action);assert(node,'Rendered button exists: '+action);if(node.disabled)return Promise.resolve();const [prefix,...parts]=node.getAttribute('data-fx').split(':');return actions.get(prefix)(parts,node);}
 function homecoming(overrides={}){G.run('rescueFinish',{runId:'real-rescue',pay:{c:180,xp:60},firstCompletion:true,...overrides});for(const [id,fn]of timers){timers.delete(id);fn();}}
 return {G,save,mount,calls,panel,document,act,button,click,homecoming,finishMount:ok=>{assert(resolveMount,'A real mount request must precede resolution');resolveMount(ok);},set active(v){active=v;}};
}
test('rescue homecoming promotes actual Pasture Dash goal and chapter reward, without Roundup diversion',()=>{
 const f=fixture();f.homecoming();assert.equal(f.panel.style.display,'flex');assert.match(f.panel.textContent,/Clover is home/);assert.match(f.panel.textContent,/Pasture Dash/);assert.match(f.panel.textContent,/six glowing gates/);assert.match(f.panel.textContent,/150 coins and your Silver pad/);
 assert.equal(f.button('next').textContent,'Ride Pasture Dash');assert.equal(f.button('roundup:beginner'),null);assert.equal(f.panel.querySelectorAll('.journey-strip').length,1);assert(f.button('adopt'));assert.equal(f.calls.next.length,0);
});
test('already completed first chapter offers claim entry rather than replaying Pasture Dash',async()=>{
 const f=fixture();f.save.ranchRush={version:1,records:{'rush-pasture':{plays:1,medal:'bronze'}}};f.homecoming();assert.equal(f.button('next').textContent,'Collect your reward');assert.match(f.panel.textContent,/Your chapter is complete/);assert.doesNotMatch(f.panel.textContent,/Follow six glowing gates/);
 await f.click('next');assert.deepEqual(f.calls.next,[{kind:'claim',id:'first-partners'}]);assert.equal(f.calls.rush,0);assert.equal(f.calls.roundup,0);
});
test('renamed adopted horse uses real escaped name and sold horse has no Ride action',()=>{
 const f=fixture({adopted:true,name:'Star <Moon> & Co'});f.homecoming();assert.equal(f.button('ride-clover').textContent,'Ride Star <Moon> & Co');assert.match(f.panel.innerHTML,/Star &lt;Moon&gt; &amp; Co/);assert.equal(f.button('adopt'),null);
 const sold=fixture({adopted:true,sold:true});sold.homecoming();assert.equal(sold.button('ride-clover'),null);assert.equal(sold.button('adopt'),null);assert(sold.button('next'));
});
test('async preparation disables Ride, Stable and next while success closes without starting a course',async()=>{
 const f=fixture({adopted:true});f.homecoming();const pending=f.click('ride-clover');
 assert.equal(f.calls.mount,1);assert.equal(f.button('ride-clover').disabled,true);assert.equal(f.button('stable').disabled,true);assert.equal(f.button('next').disabled,true);assert.match(f.panel.textContent,/Saddling up/);
 await f.click('next');await f.act('next');await f.act('roundup','beginner');assert.equal(f.calls.next.length,0);assert.equal(f.calls.roundup,0);
 f.finishMount(true);await pending;assert.equal(f.panel.style.display,'none');assert.equal(f.calls.next.length,0);assert.equal(f.calls.rush,0);assert.equal(f.calls.roundup,0);
});
test('failed preparation keeps homecoming open with a retry and does not advertise an unready model',async()=>{
 const f=fixture({adopted:true});f.homecoming();const pending=f.click('ride-clover');f.finishMount(false);await pending;
 assert.equal(f.panel.style.display,'flex');assert.equal(f.button('ride-clover').disabled,undefined);assert.equal(f.button('ride-clover').textContent,'Retry riding Clover');assert.match(f.panel.textContent,/could not finish loading/);assert.equal(f.button('next').disabled,true);
 await f.act('next');assert.equal(f.calls.next.length,0);
 const retry=f.click('ride-clover');assert.equal(f.calls.mount,2);f.finishMount(true);await retry;assert.equal(f.panel.style.display,'none');assert.equal(f.calls.next.length,0);
});
test('closing during preparation stays closed after either success or failure',async()=>{
 for(const success of [true,false]){const f=fixture({adopted:true});f.homecoming();const pending=f.click('ride-clover');await f.click('close');const opens=f.calls.open.length,renders=f.calls.render;assert.equal(f.panel.style.display,'none');
  f.finishMount(success);await pending;assert.equal(f.panel.style.display,'none');assert.equal(f.calls.open.length,opens);assert.equal(f.calls.render,renders);assert.equal(f.calls.next.length,0);}
});
test('next action uses current journey state, never the goal previously rendered',async()=>{
 const f=fixture({adopted:true});f.mount.selected=true;f.mount.ready=true;f.homecoming();assert.equal(f.button('next').textContent,'Ride Pasture Dash');
 f.save.ranchRush={version:1,records:{'rush-pasture':{plays:1,medal:'bronze'}}};await f.click('next');assert.deepEqual(f.calls.next,[{kind:'claim',id:'first-partners'}]);assert.equal(f.calls.mount,0);
});
test('handler rejects an unready selected model even if its button was rendered enabled',async()=>{
 const f=fixture({adopted:true});f.mount.selected=true;f.mount.ready=true;f.homecoming();assert.equal(f.button('next').disabled,undefined);
 f.mount.ready=false;await f.click('next');assert.equal(f.calls.next.length,0);assert.match(f.calls.toasts.at(-1),/Wait until your horse is ready/);
 f.mount.ready=true;await f.click('next');assert.deepEqual(f.calls.next,[{kind:'rush',id:'rush-pasture'}]);
});
test('already-ready partner offers riding return instead of another switch and explicit next stays separate',async()=>{
 const f=fixture({adopted:true,name:'Starfall'});f.mount.selected=true;f.mount.ready=true;f.homecoming();assert.equal(f.button('ride-clover'),null);assert.match(f.panel.textContent,/Starfall is ready for your next ride/);assert.equal(f.button('next').disabled,undefined);
 await f.click('next');assert.deepEqual(f.calls.next,[{kind:'rush',id:'rush-pasture'}]);assert.equal(f.calls.mount,0);
});
test('closing and reopening Activities preserves the adopted partner action',async()=>{
 const f=fixture({adopted:true,name:'Starfall'});f.homecoming();await f.click('close');f.G.rideHub.open();assert.equal(f.G.rideHub.state().mode,'choose');assert.equal(f.button('ride-clover').textContent,'Ride Starfall');assert.equal(f.button('adopt'),null);
});

test('successful old mount request refreshes rather than closes Activities reopened during loading',async()=>{
 const f=fixture({adopted:true});f.homecoming();const pending=f.click('ride-clover');await f.click('close');
 assert.equal(f.G.rideHub.open(),true);assert.equal(f.G.rideHub.state().mode,'choose');assert.equal(f.panel.style.display,'flex');assert.match(f.panel.textContent,/Saddling up/);
 const opens=f.calls.open.length,hides=f.calls.hide;f.finishMount(true);await pending;
 assert.equal(f.panel.style.display,'flex');assert.equal(f.G.rideHub.state().mode,'choose');assert.equal(f.calls.open.length,opens);assert.equal(f.calls.hide,hides);
 assert.match(f.panel.textContent,/Clover is ready for your next ride/);assert.doesNotMatch(f.panel.textContent,/Saddling up/);assert.equal(f.calls.next.length,0);
});
test('later Pasture Dash recommendation explains its real combo goal without promising a reward for merely finishing',async()=>{
 const f=fixture({adopted:true});f.save.riderJourney={version:1,claimed:{'first-partners':{at:1,gearId:'journey-first-partners'}},lastClaimId:'first-partners'};
 f.save.ranchRush={version:1,records:{'rush-pasture':{plays:1,medal:'bronze',bestCombo:2}}};f.save.roundupBest={beginner:{plays:1,penned:3}};
 f.homecoming({firstCompletion:false});assert.equal(f.G.riderJourney.snapshot().current.id,'steady-hands');const next=f.panel.querySelector('.journey-strip');
 assert.match(next.textContent,/Build a 4-obstacle chain in any Ranch Rush/);assert.doesNotMatch(next.textContent,/Finish to earn|Follow six glowing gates|Your chapter is complete/);
 assert.equal(f.button('next').textContent,'Ride Pasture Dash');await f.click('next');assert.deepEqual(f.calls.next,[{kind:'rush',id:'rush-pasture'}]);
});
test('first rescue headline survives adoption while repeat rescue uses the familiar-friend headline',async()=>{
 const f=fixture();f.homecoming();await f.click('adopt');assert.equal(f.panel.querySelector('h1').textContent,'Clover is home.');
 f.homecoming({firstCompletion:false});assert.equal(f.panel.querySelector('h1').textContent,'A familiar friend, safely home.');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const shared=fs.readFileSync(new URL('./test-roundup-hud.mjs',import.meta.url),'utf8');
const makeDOM=Function(shared.slice(shared.indexOf('function dom(){'),shared.indexOf('function fixture(){'))+'return dom;')();
const source=fs.readFileSync(new URL('../assets/club-social-view.js',import.meta.url),'utf8').replace(/^export /gm,'');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function fixture(){
 const document=makeDOM(),hooks=new Map(),calls=[],toasts=[],opens=[];
 const s={connected:true,routes:[{id:'basin',name:'Basin Loop',canRegroup:true,points:[['Home',0,5],['Pines',-30,-58]],stops:4,distance:180,blurb:'Explore together.'},{id:'cottonwood',name:'Cottonwood Post Run',points:[['Home',0,5],['Ada',39,-39]],stops:4,distance:190,blurb:'Follow the trail. For pouch handovers, choose the Post Relay.'}],lobbies:[],current:null};
 const G={net:{net:{id:'host'}},horse:{player:{pos:{x:0,z:5}}},clubRides:{snapshot:()=>structuredClone(s),readyAtStop(){calls.push('ready');return{ok:true};},continueTogether(){calls.push('continue');return{ok:true};}},on(k,f){const list=hooks.get(k)||[];list.push(f);hooks.set(k,list);},run(k,...a){for(const f of hooks.get(k)||[])f(...a);},toast:m=>toasts.push(m),clubHub:{open:x=>opens.push(x)}};
 const create=Function('document',source+'return createClubSocialView;')(document);
 const view=create(G,{esc,button:(key,label,attrs='',cls='')=>'<button data-chub="'+key+'" class="'+cls+'" '+attrs+'>'+esc(label)+'</button>',icon:()=>'<i></i>',crest:()=>'',bar:()=>'',fmt:String});
 const current=()=>({id:'session',routeId:'basin',routeName:'Basin Loop',title:'Basin Loop',host:'Mae',canHost:true,canStart:false,status:'riding',roster:[{id:'host',name:'Mae',ready:true},{id:'guest',name:'Jess & <pony>',ready:true}],riding:true,progress:0,totalStops:4,finished:false,regroup:{stop:'Home Pasture',reason:'Choose Ready for next leg when you are settled.',canReady:true,canContinue:false,ready:false,people:[{id:'host',name:'Mae',me:true,arrived:true,ready:false,online:true},{id:'guest',name:'Jess & <pony>',me:false,arrived:false,ready:false,online:true,position:{x:30,z:5}}]}});
 return{G,s,view,calls,toasts,opens,document,current,paint:()=>G.run('tick',.35),hud:document.getElementById('clubRegroupHud')};
}
test('Basin opt-in and ordinary trails remain distinct, with truthful Cottonwood copy',()=>{
 const f=fixture(),html=f.view.activities();assert.match(html,/data-chub="social-host-regroup"[^>]*data-route="basin"/);assert.equal((html.match(/data-chub="social-host-regroup"/g)||[]).length,1);assert.match(html,/Host ordinary trail/);assert.match(html,/Host this ride/);assert.match(html,/pouch handovers, choose the Post Relay/);assert.match(html,/Untimed\. Stop together/);
 f.s.connected=false;assert.match(f.view.activities(),/data-chub="social-host-regroup"[^>]*disabled/);
});
test('regroup HUD retains actual focused action nodes while real partner readiness and distance change',()=>{
 const f=fixture();f.s.current=f.current();f.paint();assert.equal(f.hud.hidden,false);assert.match(f.hud.textContent,/Jess & <pony> · 30 m away/);
 const ready=f.document.getElementById('clubRegroupReady'),cont=f.document.getElementById('clubRegroupContinue');ready.focus();
 for(let i=0;i<6;i++){f.s.current.regroup.people[1].position.x=30-i;f.paint();assert.equal(f.document.getElementById('clubRegroupReady'),ready);assert.equal(f.document.activeElement,ready);}
 assert.equal(ready.disabled,false);assert.equal(cont.disabled,true);ready.click();assert.deepEqual(f.calls,['ready']);
 f.s.current.regroup.ready=true;f.s.current.regroup.canReady=false;f.s.current.regroup.canContinue=true;f.s.current.regroup.people[1].ready=true;f.paint();assert.equal(ready.disabled,true);assert.equal(ready.textContent,'You’re ready');assert.equal(cont.disabled,false);assert.match(f.hud.textContent,/Jess & <pony> · ready/);cont.click();assert.deepEqual(f.calls,['ready','continue']);
});
test('guest cannot see a host Continue control; stale partner evidence is reported without invented positions',()=>{
 const f=fixture();f.s.current=f.current();f.s.current.canHost=false;f.s.current.regroup.people[1].online=false;f.s.current.regroup.people[1].position=null;f.paint();assert.equal(f.document.getElementById('clubRegroupContinue').hidden,true);assert.match(f.hud.textContent,/connection lost/);assert.doesNotMatch(f.hud.textContent,/m away/);
 f.document.getElementById('clubRegroupOpen').click();assert.deepEqual(f.opens,['activities']);
});
test('cancelled or disconnected active group exposes Continue alone rather than promising more group progress',()=>{
 const f=fixture();f.s.current=f.current();f.s.current.status='cancelled';f.s.current.regroup.reason='The group ride ended. Continue alone or leave the trail.';f.s.connected=false;const html=f.view.activities();assert.match(html,/data-chub="social-alone"/);assert.match(html,/The group ride ended/);assert.match(html,/Every rider earns their own usual trail reward/);assert.doesNotMatch(html,/group bonus|double rewards/i);
});
test('controller refusals explain the action and ordinary ride status returns when regroup ends',()=>{
 const f=fixture();f.s.current=f.current();f.G.clubRides.readyAtStop=()=>({ok:false,reason:'Stop by the marker first.'});f.paint();f.document.getElementById('clubRegroupReady').click();assert.deepEqual(f.toasts,['Stop by the marker first.']);
 delete f.s.current.regroup;f.paint();assert.equal(f.hud.hidden,true);assert.equal(f.document.getElementById('clubRideStatus').hidden,false);assert.match(f.document.getElementById('clubRideStatus').textContent,/0 \/ 4 stops/);f.s.current=null;f.paint();assert.equal(f.document.getElementById('clubRideStatus').hidden,true);
});
test('actual clubhouse dispatcher chooses the opt-in mode and closes only after successful Continue alone',()=>{
 const file=fs.readFileSync(new URL('../assets/features/clubhouse-ui.js',import.meta.url),'utf8'),start=file.indexOf("  if(k.startsWith('social-')){"),end=file.indexOf("  if(k==='close')",start),body=file.slice(start,end);
 const calls=[],state={tab:'activities'},trace={closed:0,refresh:0},R={host:(...args)=>{calls.push(['host',...args]);return{ok:true};},continueAlone:()=>{calls.push(['alone']);return{ok:true};}};
 const dispatch=Function('k','b','G','st','close','notify','refresh','U','S','identity',body);
 const run=(k,dataset)=>dispatch('social-'+k,{dataset},{clubRides:R},state,()=>trace.closed++,()=>{},()=>trace.refresh++,{}, {},()=>({}));
 run('host-regroup',{route:'basin'});assert.deepEqual(calls,[['host','basin',{regroup:true}]]);assert.equal(trace.closed,0);run('alone',{});assert.equal(trace.closed,1);R.continueAlone=()=>({ok:false});run('alone',{});assert.equal(trace.closed,1);assert.equal(trace.refresh,2);
});

test('started regroup lobbies disable late joining while ordinary rides and admitted resume remain available',()=>{
 const f=fixture(),group={...f.current(),mode:'regroup-v1',id:'other-group'};f.s.lobbies=[group];
 const join=html=>html.match(/<button data-chub="social-join"[^>]*>[^<]*<\/button>/)?.[0];
 let control=join(f.view.activities());assert.match(control,/disabled/);assert.match(control,/>Ride started</);assert.match(control,/data-ride="other-group"/);
 f.s.lobbies=[{...group,mode:null,regroup:null,id:'ordinary-trail'}];control=join(f.view.activities());assert.doesNotMatch(control,/disabled/);assert.match(control,/>Join ride</);assert.match(control,/data-ride="ordinary-trail"/);
 f.s.lobbies=[{...group,status:'waiting'}];control=join(f.view.activities());assert.doesNotMatch(control,/disabled/);assert.match(control,/>Join ride</);
 f.s.current={...group,riding:false};f.s.lobbies=[f.s.current];const html=f.view.activities();assert.match(html,/<button data-chub="social-resume"[^>]*>Join the ride<\/button>/);assert.doesNotMatch(html,/>Ride started</);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Execute the production module in an isolated context. Only browser rendering,
// course start/finish signals and scheduled callbacks are inert fixtures.
const source=fs.readFileSync(new URL('../assets/features/training-drills.js',import.meta.url),'utf8');
assert.match(source,/export function install\(G\)/);
const production=source.replace(/^export /gm,'');
function fixture(){
 const handlers=new Map(),actions=new Map(),renders=new Map(),nodes=new Map(),timers=new Map();
 const trace={starts:[],opens:[],eventPages:[],backs:0,retries:0,settles:0,cancellations:0};
 const state={active:false,pending:null,lastResult:null,points:[],stat:null,cleared:0,total:8};
 let timerId=0,run=0,startResult=true;
 let horse={id:'willow',name:'Willow',stats:{speed:2,jump:2,stamina:2}};
 const node=id=>{
  if(!nodes.has(id))nodes.set(id,{id,style:{display:'none'},textContent:'',innerHTML:'',hidden:false,
   setAttribute(){},addEventListener(){},contains(){return false;},querySelector(){return null;},querySelectorAll(){return [];}});
  return nodes.get(id);
 };
 const emit=(name,...args)=>{for(const fn of handlers.get(name)||[])fn(...args);};
 const G={THREE:{},scene:{remove(){}},world:{groundH:()=>0},horse:{ridden:()=>horse,player:{pos:{x:0,z:0}}},
  xp:{statCap:()=>9,statCeil:()=>9,statNeed:()=>40},seFrame:{screens:new Set(),settle(){trace.settles++;}},
  seEvents:{openPage:page=>trace.eventPages.push(page)},
  on(name,fn){if(!handlers.has(name))handlers.set(name,[]);handlers.get(name).push(fn);},
  ui:{panel({id,render}){node(id);renders.set(id,render);},action(name,fn){actions.set(name,fn);},
   open(id){trace.opens.push(id);node(id).style.display='flex';},openEvents(){trace.opens.push('events');}},
  course:{drillState:()=>state,startDrill(stat){
   trace.starts.push(stat);if(startResult instanceof Error)throw startResult;if(!startResult)return false;
   Object.assign(state,{active:true,pending:null,lastResult:null,stat,horseId:horse.id,horseName:horse.name,runId:'run-'+(++run),cleared:0,points:[]});
   emit('drillStart');return true;
  },retryDrillSave(){trace.retries++;},cancelDrill(){trace.cancellations++;state.active=false;}}
 };
 const document={getElementById:node,createElement:()=>node('style'),head:{appendChild(){}},
  body:{classList:{toggle(){}}},activeElement:null};
 vm.runInNewContext(production+'\ninstall(G);',{G,document,
  MutationObserver:class{observe(){}},
  setTimeout(fn){const id=++timerId;timers.set(id,fn);return id;},clearTimeout(id){timers.delete(id);}},
  {filename:'assets/features/training-drills.js'});
 function flush(){let count=0;while(timers.size){assert(count++<30,'scheduled callbacks settle');const [id,fn]=timers.entries().next().value;timers.delete(id);fn();}}
 const target=(overrides={})=>({eventId:'meadow-cup',eventName:'Meadow Cup',difficulty:2,onBack(){trace.backs++;},...overrides});
 function finish(saved=true,overrides={}){
  const r={runId:state.runId,stat:state.stat,horseId:state.horseId,horseName:state.horseName,saved,cleared:3,total:8,
   elapsed:12,before:{value:2,xp:0,cap:9},after:{value:2,xp:9,cap:9},statXp:9,coins:24,...overrides};
  Object.assign(state,{active:false,pending:saved?null:r,lastResult:saved?r:null});emit(saved?'drillFinish':'drillSavePending',r);return r;
 }
 function snapshot(){const s={};emit('state',s);return JSON.parse(JSON.stringify(s.trainingUI));}
 return {G,state,trace,flush,target,finish,snapshot,timers,nodes,
  action:name=>actions.get('training')([name]),markup:()=>renders.get('trainingResultPanel')(),
  get startResult(){return startResult;},set startResult(v){startResult=v;},
  get horse(){return horse;},set horse(v){horse=v;},emit};
}
function start(f,stat='speed',target=f.target()){
 assert.equal(f.G.trainingDrills.startForEvent(stat,target),true);assert.equal(f.state.active,true);
 assert.deepEqual(f.snapshot().eventTarget,{eventId:target.eventId,difficulty:target.difficulty,stat});
}

test('valid event training starts with its destination and horse captured',()=>{
 const f=fixture();start(f);assert.deepEqual(f.trace.starts,['speed']);assert.match(f.nodes.get('trainingHudHorse').textContent,/Willow.*Preparing for Meadow Cup/);
 assert.equal(f.G.trainingDrills.returnToEvent(),false,'active training cannot return');assert.equal(f.trace.backs,0);
});
test('invalid, active, pending and refused starts attach no destination',()=>{
 const invalid=[['bogus',{}],['speed',null],['speed',{eventId:'cup',eventName:'Cup'}],['speed',{eventId:'',eventName:'Cup',onBack(){}}],['speed',{eventId:'cup',eventName:'',onBack(){}}]];
 for(const [stat,target] of invalid){const f=fixture();assert.equal(f.G.trainingDrills.startForEvent(stat,target),false);assert.equal(f.trace.starts.length,0);assert.equal(f.snapshot().eventTarget,null);}
 for(const field of ['active','pending']){const f=fixture();f.state[field]=field==='active'?true:{runId:'unsaved'};assert.equal(f.G.trainingDrills.startForEvent('speed',f.target()),false);assert.equal(f.trace.starts.length,0);assert.equal(f.snapshot().eventTarget,null);}
 const f=fixture();f.startResult=false;assert.equal(f.G.trainingDrills.startForEvent('speed',f.target()),false);assert.equal(f.snapshot().eventTarget,null);assert.equal(f.G.trainingDrills.returnToEvent(),false);
});
test('a thrown start cannot leave a launch destination on later free practice',()=>{
 const f=fixture();f.startResult=new Error('start refused');assert.throws(()=>f.G.trainingDrills.startForEvent('speed',f.target()),/start refused/);
 f.startResult=true;f.G.course.startDrill('stamina');assert.equal(f.snapshot().eventTarget,null);
});
test('pending save hides event return and blocks return, repeat and choosing',()=>{
 const f=fixture();start(f);f.finish(false);f.flush();const starts=f.trace.starts.length;
 assert.equal(f.G.trainingDrills.returnToEvent(),false);f.action('event');f.action('again');f.action('choose');
 assert.equal(f.trace.backs,0);assert.equal(f.trace.starts.length,starts);assert.equal(f.trace.opens.includes('events'),false);
 assert.equal(f.snapshot().eventTarget.eventId,'meadow-cup');assert.doesNotMatch(f.markup(),/data-fx="training:event"/);
 f.action('retry-save');assert.equal(f.trace.retries,1);
 // A stale state adapter cannot bypass the receipt's own unsaved proof.
 f.state.pending=null;assert.equal(f.G.trainingDrills.returnToEvent(),false);assert.equal(f.trace.backs,0);
});
test('saved result returns to the captured event exactly once after a pending retry',()=>{
 const f=fixture();start(f);f.finish(false);f.flush();f.finish(true);f.flush();
 assert.match(f.markup(),/data-fx="training:event"/);assert.match(f.markup(),/Back to Meadow Cup/);
 assert.equal(f.G.trainingDrills.returnToEvent(),true);assert.equal(f.trace.backs,1);assert.equal(f.snapshot().eventTarget,null);
 assert.equal(f.G.trainingDrills.returnToEvent(),false);f.action('event');f.flush();assert.equal(f.trace.backs,1);
});
test('repeat retains destination, captures the current horse and binds the new run',()=>{
 const f=fixture();start(f);const first=f.finish();f.flush();f.horse={id:'fern',name:'Fern',stats:{speed:2}};
 f.action('again');assert.equal(f.state.active,true);assert.notEqual(f.state.runId,first.runId);assert.equal(f.state.horseId,'fern');
 assert.deepEqual(f.trace.starts,['speed','speed']);assert.equal(f.snapshot().eventTarget.eventId,'meadow-cup');
 f.finish();f.flush();assert.equal(f.G.trainingDrills.returnToEvent(),true);assert.equal(f.trace.backs,1);
});
test('failed repeat keeps the saved result and its event destination',()=>{
 const f=fixture();start(f);f.finish();f.flush();f.startResult=false;f.action('again');
 assert.equal(f.state.active,false);assert.equal(f.snapshot().resultOpen,true);assert.equal(f.snapshot().eventTarget.eventId,'meadow-cup');
 assert.equal(f.G.trainingDrills.returnToEvent(),true);assert.equal(f.trace.backs,1);
});
test('unrelated generic drillStart clears destination even when the same stat is chosen',()=>{
 for(const stat of ['stamina','speed']){const f=fixture();start(f);f.finish();f.flush();f.G.course.startDrill(stat);
  assert.equal(f.snapshot().eventTarget,null);f.finish();f.flush();assert.equal(f.G.trainingDrills.returnToEvent(),false);assert.equal(f.trace.backs,0);}
});
test('choose another stat clears destination and opens the drill selection page',()=>{
 const f=fixture();start(f);f.finish();f.flush();f.action('choose');assert.equal(f.snapshot().eventTarget,null);
 assert.equal(f.snapshot().resultOpen,false);assert.equal(f.trace.opens.at(-1),'events');f.flush();assert.deepEqual(f.trace.eventPages,['__drill']);
 assert.equal(f.G.trainingDrills.returnToEvent(),false);assert.equal(f.trace.backs,0);
});
test('a result for another stat, horse or already-bound run cannot inherit a destination',()=>{
 for(const changed of [{stat:'stamina'},{horseId:'other'}]){const f=fixture();start(f);f.finish(true,changed);f.flush();assert.equal(f.snapshot().eventTarget,null);assert.equal(f.G.trainingDrills.returnToEvent(),false);}
 const f=fixture();start(f);f.finish(false);f.flush();f.finish(true,{runId:'unrelated-run'});f.flush();assert.equal(f.snapshot().eventTarget,null);
});
test('zero-clear cancellation and timeout schedule a return only after leaving active training',()=>{
 for(const reason of ['cancel','timeout']){
  const f=fixture();start(f);assert.equal(f.trace.backs,0);
  if(reason==='cancel')f.nodes.get('trainingEnd').onclick();
  else{f.state.active=false;f.state.timeRemaining=0;f.G.trainingDrills.refresh();}
  assert.equal(f.trace.backs,0,'return is deferred until paint settles');
  assert(f.timers.size>0);f.G.trainingDrills.refresh();f.flush();assert.equal(f.trace.backs,1);assert.equal(f.snapshot().eventTarget,null);
  f.G.trainingDrills.refresh();f.flush();assert.equal(f.trace.backs,1);
 }
});
test('a deferred zero-clear return cannot interrupt a newly started unrelated session',()=>{
 const f=fixture();start(f);f.G.course.cancelDrill();f.G.trainingDrills.refresh();assert(f.timers.size>0);
 f.G.course.startDrill('jump');f.flush();assert.equal(f.trace.backs,0);assert.equal(f.state.active,true);assert.equal(f.snapshot().eventTarget,null);
});
test('completed receipt wins over a stale scheduled zero-clear return',()=>{
 const f=fixture();start(f);f.state.active=false;f.G.trainingDrills.refresh();f.finish(true);f.flush();
 assert.equal(f.trace.backs,0);assert.equal(f.snapshot().resultOpen,true);assert.equal(f.snapshot().eventTarget.eventId,'meadow-cup');
});
test('event destination names are escaped in the production result markup',()=>{
 const f=fixture();start(f,'speed',f.target({eventName:'Cup <img src=x onerror=bad()> & Friends'}));f.finish();f.flush();
 assert.match(f.markup(),/Cup &lt;img src=x onerror=bad\(\)&gt; &amp; Friends/);assert.doesNotMatch(f.markup(),/<img src=x/);
});

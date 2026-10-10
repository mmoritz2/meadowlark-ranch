import test from 'node:test';
import assert from 'node:assert/strict';
import {install as installRescue} from '../assets/features/rescue-rides.js';
import {resolveAdoptedRescueHorse,createAdoptedRescueMount} from '../assets/features/rescue-adopted-mount.mjs';
const copy=v=>JSON.parse(JSON.stringify(v));
function harness(){
 let saved={horses:[{id:1,name:'Clover',breed:'bay-sporthorse'},{id:2,name:'Clover',breed:'pinto',rescueClover:true}],ridingHorseId:1,rescueRides:{adopted:true,adoptedHorseId:2,completions:1}},index=0,clock=0,requestActive=false,pendingAdoption=false;
 const mode={failWrite:false,failRead:false,failReadAfterWrite:false},calls={writes:0,rebuild:0,release:0,mount:0,grants:0},notices=[],events=[],hooks=new Map();
 const rig={requestedBreed:'bay-sporthorse',modelKey:'bay-sporthorse',ready:true,loadingBreed:false,heroMotion:{state:{}}},player={mesh:{},speed:3,y:0,vy:0,onFoot:false};rig.attachedTo=player.mesh;
 let readFailures=0,onDelay=()=>{},onRebuild=()=>ready();
 const G={save:{fresh(){if(mode.failRead||readFailures){if(readFailures)readFailures--;return null;}return copy(saved);},sync(fn){try{const draft=copy(saved);fn(draft);if(mode.failWrite)throw Error('write failed');saved=draft;calls.writes++;if(mode.failReadAfterWrite)readFailures++;}catch(_){}}},
  horse:{player,myHorses:copy(saved.horses),ridden:()=>G.horse.myHorses[index],RIG:()=>rig,breedModels:{resolve:b=>b},rebuildAll(){calls.rebuild++;G.save.sync(s=>{s.ridingHorseId=G.horse.ridden().id;});player.mesh={};rig.requestedBreed=G.horse.ridden().breed;rig.loadingBreed=true;onRebuild();}},
  ranchSys:{setRideIdx(i){index=i;}},riding:{releaseAll(){calls.release++;}},toast:m=>notices.push(m),run:(...args)=>events.push(args),on:(event,fn)=>hooks.set(event,fn),
  course:{get:()=>null,drillActive:()=>false},roundup:{state:()=>({active:false})},trail:{ride:null},worldPkg:{vehicle:()=>null},cam:{isFree:()=>false},
  onFoot:{on:false,state:()=>({horse:{}}),mount(opts){assert.deepEqual(opts,{here:true});calls.mount++;G.onFoot.on=false;player.onFoot=false;return true;}}};
 function ready(){rig.requestedBreed=G.horse.ridden().breed;rig.modelKey=rig.requestedBreed;rig.ready=true;rig.loadingBreed=false;rig.attachedTo=player.mesh;}
 const api=createAdoptedRescueMount(G,{active:()=>requestActive,adoptionPending:()=>pendingAdoption,now:()=>clock,timeoutMs:400,delay:async ms=>{clock+=ms;await onDelay();}});
 return {G,api,rig,player,calls,mode,notices,events,hooks,ready,get saved(){return copy(saved);},set saved(s){saved=copy(s);},set active(v){requestActive=v;},set pendingAdoption(v){pendingAdoption=v;},set onDelay(fn){onDelay=fn;},set onRebuild(fn){onRebuild=fn;},set index(i){index=i;}};
}
test('resolution uses durable exact ID and marker, not either horse’s name',()=>{
 const h=harness();assert.equal(resolveAdoptedRescueHorse(h.saved).id,2);
 const s=h.saved;s.horses[1].name='Starfall';h.saved=s;assert.equal(h.api.adoptedMount().name,'Starfall');
 for(const patch of [s=>s.rescueRides.adoptedHorseId=1,s=>s.rescueRides.adopted=false,s=>s.rescueRides.completions=0,s=>s.horses[1].rescueClover=false,s=>s.horses.splice(1,1),s=>s.horses.push(copy(s.horses[1])),s=>s.horses[1].foal=true]){const bad=h.saved;patch(bad);assert.equal(resolveAdoptedRescueHorse(bad),null);}
 assert.equal(resolveAdoptedRescueHorse(null),null);
});
test('saved selection precedes real rebuild; no grants, rewards, course starts or adoption edits',async()=>{
 const h=harness(),before=h.saved;h.onRebuild=()=>{assert.equal(h.saved.ridingHorseId,2);h.ready();};
 assert.equal(await h.api.rideAdopted(),true);assert.equal(h.G.horse.ridden().id,2);assert.equal(h.calls.rebuild,1);assert.equal(h.calls.release,1);
 assert.deepEqual(h.saved,{...before,ridingHorseId:2});assert.deepEqual(h.api.adoptedMount(),{available:true,name:'Clover',horseId:2,selected:true,ready:true,loading:false,error:null});assert.deepEqual(h.events,[]);
});
test('delayed model cannot succeed with the old ready rig, wrong key, or detached new rig',async()=>{
 const h=harness();h.onRebuild=()=>{};let ticks=0;
 h.onDelay=()=>{ticks++;assert.equal(h.api.adoptedMount().loading,true);assert.equal(h.api.adoptedMount().ready,false);
  if(ticks===1){h.rig.loadingBreed=false;h.rig.requestedBreed='pinto';}
  if(ticks===2)h.rig.modelKey='pinto';
  if(ticks===3)h.rig.attachedTo=h.player.mesh;
 };
 assert.equal(await h.api.rideAdopted(),true);assert.equal(ticks,3);assert.equal(h.api.adoptedMount().ready,true);
});
test('rapid double click shares one preparation and bounded timeout remains retryable',async()=>{
 const h=harness();h.onRebuild=()=>{};
 const a=h.api.rideAdopted(),b=h.api.rideAdopted();assert.equal(a,b);assert.equal(await a,false);assert.equal(await b,false);assert.equal(h.calls.rebuild,1);
 assert.equal(h.api.adoptedMount().loading,false);assert.match(h.api.adoptedMount().error,/longer to load/);
 h.onRebuild=()=>h.ready();assert.equal(await h.api.rideAdopted(),true);assert.equal(h.api.adoptedMount().error,null);
});
test('explicit load failure returns false and retries the same saved horse',async()=>{
 const h=harness();h.onRebuild=()=>{h.rig.requestedBreed=null;h.rig.loadingBreed=false;};
 assert.equal(await h.api.rideAdopted(),false);assert.match(h.api.adoptedMount().error,/could not finish loading/);assert.equal(h.saved.horses.length,2);
 h.onRebuild=()=>h.ready();assert.equal(await h.api.rideAdopted(),true);assert.equal(h.saved.rescueRides.adoptedHorseId,2);
});
test('failed or unreadable selection writes do not switch the live horse',async()=>{
 for(const setting of ['failWrite','failRead','failReadAfterWrite']){const h=harness();h.mode[setting]=true;assert.equal(await h.api.rideAdopted(),false,setting);assert.equal(h.calls.rebuild,0);assert.equal(h.G.horse.ridden().id,1);assert.equal(h.api.adoptedMount().loading,false);
  h.mode[setting]=false;assert.equal(await h.api.rideAdopted(),true);assert.equal(h.saved.horses.length,2);}
});
test('unconfirmed adoption remains a Welcome retry even if its write already committed',async()=>{
 const h=harness();h.pendingAdoption=true;assert.equal(h.api.adoptedMount().available,false);assert.equal(await h.api.rideAdopted(),false);assert.equal(h.calls.writes,0);assert.equal(h.calls.rebuild,0);
 h.pendingAdoption=false;assert.equal(await h.api.rideAdopted(),true);
});
test('rename resolves the same horse and sale or stale ledger never creates a substitute',async()=>{
 const h=harness(),s=h.saved;s.horses[1].name='Starfall';h.saved=s;h.G.horse.myHorses[1].name='Starfall';assert.equal(await h.api.rideAdopted(),true);assert.equal(h.api.adoptedMount().name,'Starfall');
 const sold=h.saved;sold.horses.splice(1,1);sold.ridingHorseId=1;h.saved=sold;assert.equal(h.api.adoptedMount().available,false);assert.equal(await h.api.rideAdopted(),false);assert.equal(h.saved.horses.length,1);
});
test('selection changed during load is respected instead of switching back or announcing success',async()=>{
 const h=harness();h.onRebuild=()=>{};h.onDelay=()=>{h.index=0;const s=h.saved;s.ridingHorseId=1;h.saved=s;};
 assert.equal(await h.api.rideAdopted(),false);assert.equal(h.G.horse.ridden().id,1);assert.equal(h.saved.ridingHorseId,1);assert.equal(h.calls.rebuild,1);assert.match(h.api.adoptedMount().error,/selected horse changed/);
});
test('activities, flight, vehicles and native actions reject before selection writes',async()=>{
 const cases=[h=>h.active=true,h=>h.G.course.get=()=>({}),h=>h.G.course.drillActive=()=>true,h=>h.G.roundup.state=()=>({active:true}),h=>h.G.trail.ride={},h=>h.player.flying=true,h=>h.player.y=1,h=>h.G.worldPkg.vehicle=()=>({}),h=>h.G.photoPause=true,h=>h.G.cam.isFree=()=>true,h=>h.rig.heroMotion.state.action='lie',h=>h.rig.emote={},h=>h.G.onFoot.state=()=>({horse:{pending:'lay'}}),h=>h.G.onFoot.state=()=>({horse:{departure:'mount'}})];
 for(const setup of cases){const h=harness();setup(h);assert.equal(await h.api.rideAdopted(),false);assert.equal(h.calls.writes,0);assert.equal(h.calls.rebuild,0);}
});
test('settled on-foot rider mounts through existing mount API and cannot succeed still on foot',async()=>{
 const h=harness();h.G.onFoot.on=true;h.player.onFoot=true;assert.equal(await h.api.rideAdopted(),true);assert.equal(h.calls.mount,1);assert.equal(h.player.onFoot,false);
 const stuck=harness();stuck.G.onFoot.on=true;stuck.player.onFoot=true;stuck.G.onFoot.mount=()=>false;assert.equal(await stuck.api.rideAdopted(),false);assert.equal(stuck.api.adoptedMount().ready,false);
});
test('an activity started while loading stops the handoff without cancelling that activity',async()=>{
 const h=harness();h.onRebuild=()=>{};h.onDelay=()=>{h.G.course.get=()=>({id:'player-chosen-event'});};assert.equal(await h.api.rideAdopted(),false);assert.equal(h.G.course.get().id,'player-chosen-event');assert.equal(h.calls.rebuild,1);
});
test('production rescue installer exposes the asynchronous rider handoff',async()=>{
 const h=harness();h.G.THREE={};h.G.world={mapMarkers:[],miniMarkers:[]};h.G.save.ensure=()=>{};
 installRescue(h.G);assert.equal(typeof h.G.rescueRide.rideAdopted,'function');assert.equal(h.G.rescueRide.adoptedMount().selected,false);
 assert.equal(await h.G.rescueRide.rideAdopted(),true);assert.equal(h.G.rescueRide.adoptedMount().ready,true);assert.equal(h.calls.rebuild,1);
 assert.deepEqual(h.saved.rescueRides,{adopted:true,adoptedHorseId:2,completions:1});
});

test('stale or reordered live roster refuses before writing or rebuilding',async()=>{
 for(const edit of [h=>h.G.horse.myHorses.pop(),h=>h.G.horse.myHorses.reverse(),h=>h.G.horse.myHorses[1].rescueClover=false]){
  const h=harness();edit(h);const before=h.saved;assert.equal(await h.api.rideAdopted(),false);assert.equal(h.calls.writes,0);assert.equal(h.calls.rebuild,0);assert.deepEqual(h.saved,before);assert.match(h.api.adoptedMount().error,/stable changed/);
 }
});
test('in-flight mount blocks all activity/course/travel entry hooks and keeps timed-out models gated',async()=>{
 for(const success of [false,true]){
  const h=harness();h.onRebuild=()=>{};
  const promise=h.api.rideAdopted();for(const event of ['activityGate','courseGate','travelGate'])assert.equal(h.hooks.get(event)(),true);
  h.onDelay=()=>{for(const event of ['activityGate','courseGate','travelGate'])assert.equal(h.hooks.get(event)(),true);if(success)h.ready();};
  assert.equal(await promise,success);for(const event of ['activityGate','courseGate','travelGate'])assert.equal(h.hooks.get(event)(),success?undefined:true);
  h.ready();for(const event of ['activityGate','courseGate','travelGate'])assert.equal(h.hooks.get(event)(),undefined);
 }
});

test('already riding the confirmed ready horse is a no-op',async()=>{
 const h=harness();assert.equal(await h.api.rideAdopted(),true);const before={...h.calls};assert.equal(await h.api.rideAdopted(),true);assert.deepEqual(h.calls,before);
});
test('a roster reordered during the write is rejected before any live switch',async()=>{
 const h=harness(),sync=h.G.save.sync;h.G.save.sync=fn=>sync(s=>{fn(s);s.horses.reverse();});
 assert.equal(await h.api.rideAdopted(),false);assert.equal(h.calls.rebuild,0);assert.equal(h.G.horse.ridden().id,1);assert.match(h.api.adoptedMount().error,/stable changed/);
});

test('timeout cannot start a course on the old ready model; matching detached and loading models also remain gated',async()=>{
 const h=harness();h.onRebuild=()=>{};assert.equal(await h.api.rideAdopted(),false);assert.equal(h.api.adoptedMount().loading,false);
 assert.equal(h.rig.ready,true);assert.equal(h.hooks.get('courseGate')(),true);
 h.rig.loadingBreed=false;assert.equal(h.hooks.get('courseGate')(),true,'old model still does not match selected breed');
 h.rig.modelKey='pinto';assert.equal(h.hooks.get('courseGate')(),true,'correct model must actually attach to the new player mesh');
 h.rig.attachedTo=h.player.mesh;assert.equal(h.hooks.get('courseGate')(),undefined);
 h.rig.loadingBreed=true;assert.equal(h.hooks.get('courseGate')(),true);h.ready();assert.equal(h.hooks.get('courseGate')(),undefined);
});
test('a fully loaded adopted horse on foot can still use ordinary course entry mounting',async()=>{
 const h=harness();assert.equal(await h.api.rideAdopted(),true);h.player.onFoot=true;h.G.onFoot.on=true;assert.equal(h.api.adoptedMount().ready,false);
 for(const event of ['activityGate','courseGate','travelGate'])assert.equal(h.hooks.get(event)(),undefined);
});
test('changing to another horse releases a timed-out rescue-model gate',async()=>{
 const h=harness();h.onRebuild=()=>{};assert.equal(await h.api.rideAdopted(),false);assert.equal(h.hooks.get('courseGate')(),true);
 h.index=0;for(const event of ['activityGate','courseGate','travelGate'])assert.equal(h.hooks.get(event)(),undefined);
});

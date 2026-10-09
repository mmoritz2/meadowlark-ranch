import test from 'node:test';
import assert from 'node:assert/strict';
import {RESCUE_DEFINITION,RESCUE_APPROACH,sanitizeRescueSave,recordRescueFinish,canAdoptClover,pendingRescueFinish,saveRescueFinish,saveCloverAdoption,mirrorRescueHorseXp,calmAfter,isTravelJump,rescueInteraction,rescueRetreatCandidates,insideRescueRetreat} from '../assets/features/rescue-rules.mjs';
import {install} from '../assets/features/rescue-rides.js';

const finish=(overrides={})=>({runId:'actual-ride',stage:'escort',clues:2,returnStep:3,elapsed:140,...overrides});
test('a physical completed escort unlocks one adoption and records a best time',()=>{
 const first=recordRescueFinish(null,finish());
 assert.equal(first.recorded,true);assert.equal(first.save.completions,1);assert.equal(first.save.bestTime,140);
 assert.equal(first.result.firstCompletion,true);assert.deepEqual(first.result.pay,{c:180,xp:60});assert.equal(canAdoptClover(first.save),true);
 const next=recordRescueFinish({...first.save,adopted:true},finish({runId:'second',elapsed:120}));
 assert.equal(next.save.completions,2);assert.equal(next.save.bestTime,120);assert.equal(next.result.firstCompletion,false);assert.equal(next.result.canAdopt,false);
 assert.equal(canAdoptClover({...first.save,adopted:true}),false);
});
test('duplicate callbacks, cancellations and skipped route steps do not earn rewards',()=>{
 const first=recordRescueFinish(null,finish());
 assert.equal(recordRescueFinish(first.save,finish()).recorded,false);
 for(const change of [{stage:'find'},{stage:'calm'},{clues:1},{returnStep:2},{returnStep:4},{elapsed:0},{elapsed:NaN},{runId:''}])assert.equal(recordRescueFinish(null,finish(change)).recorded,false);
 assert.equal(canAdoptClover(null),false);
});
test('patient proximity can calm Clover but never passively completes trust',()=>{
 let calm=0;for(let i=0;i<6000;i++)calm=calmAfter(calm,{distance:4,speed:0,dt:.1});assert.equal(calm,60);
 assert(calmAfter(50,{distance:4,speed:8,dt:.1})<50);
 assert(calmAfter(50,{distance:12,speed:0,dt:.1})<50);
 assert(calmAfter(50,{distance:4,speed:2,dt:.1})<50);
 assert.equal(calmAfter(50,{distance:4,speed:0,dt:10}),50);
});
test('one explicit reassurance requires actual settled proximity and a stopped rider',()=>{
 const ready={distance:4,speed:0,settling:0};
 assert.equal(rescueInteraction(ready).eligible,true);
 assert.equal(rescueInteraction(ready).inReach,true);
 for(const distance of [RESCUE_APPROACH.reach,9,Infinity,NaN])assert.equal(rescueInteraction({...ready,distance}).inReach,false);
 assert.equal(rescueInteraction({...ready,blocked:true}).inReach,true,'reach is independent of whether interaction is paused');
 for(const [patch,status] of [[{distance:RESCUE_APPROACH.reach},'far'],[{distance:Infinity},'far'],[{speed:6},'too-fast'],[{speed:NaN},'too-fast'],[{speed:RESCUE_APPROACH.stopSpeed},'moving'],[{speed:-2},'moving'],[{retreating:true},'retreating'],[{settling:.01},'settling'],[{blocked:true},'paused']]){
  const i=rescueInteraction({...ready,...patch});assert.equal(i.eligible,false,status);assert.equal(i.status,status);assert(i.reason.length>10);
 }
 assert.equal(rescueInteraction({...ready,retreating:true,distance:8}).status,'retreating','do not tell the rider to chase while Clover is retreating');
 assert.equal(rescueInteraction({...ready,settling:.4}).cooldown,.4);
 assert.equal(rescueInteraction({...ready,blocked:true,retreating:true}).status,'paused');
});
test('retreat choices move away from pressure and stay in the nearby fenced pasture',()=>{
 const anchor={x:-70,z:-41};
 for(const horse of [anchor,{x:-70,z:-33},{x:-80,z:-36},{x:-57,z:-40}])for(const [dx,dz] of [[-3,0],[3,0],[0,-3],[0,3],[0,0]]){
  const rider={x:horse.x+dx,z:horse.z+dz},candidates=rescueRetreatCandidates(horse,rider,anchor),before=Math.hypot(dx,dz);
  for(const target of candidates){
   assert(insideRescueRetreat(target,anchor));assert(Math.hypot(target.x-rider.x,target.z-rider.z)>before+.5);
   for(let i=0;i<=40;i++){
    const t=i/40,x=horse.x+(target.x-horse.x)*t,z=horse.z+(target.z-horse.z)*t;
    assert(Math.hypot(x-rider.x,z-rider.z)>=before-1e-9,'every escape segment stays at least as far from the rider as its starting point');
   }
  }
 }
 assert(rescueRetreatCandidates(anchor,{x:-70,z:-38},anchor).length>0,'south-side fence still leaves a bounded sideways escape');
 assert.equal(insideRescueRetreat({x:-70,z:-44},anchor),false,'never choose the pasture boundary fence');
 assert.equal(insideRescueRetreat({x:-70,z:-20},anchor),false,'do not send the mission horse across the whole pasture');
 assert.deepEqual(rescueRetreatCandidates({x:NaN,z:0},{x:0,z:0},anchor),[]);
});
test('fast travel is rejected while continuous galloping and dismount steps are allowed',()=>{
 assert.equal(isTravelJump(50,.016,0),true);
 assert.equal(isTravelJump(20,.016,40),true);
 assert.equal(isTravelJump(.8,.016,50),false);
 assert.equal(isTravelJump(1.5,.016,0),false);
 assert.equal(isTravelJump(NaN,.016,0),true);
});
test('save fields are bounded and the permanent hay bales and trough stay clear of the rescue route',()=>{
 assert.deepEqual(sanitizeRescueSave({completions:NaN,bestTime:Infinity,lastRunId:5}),{version:1,completions:0,bestTime:null,adopted:false,lastRunId:'',adoptedHorseId:null});
 assert.equal(sanitizeRescueSave({completions:-3,bestTime:20}).bestTime,null);
 for(let i=1;i<RESCUE_DEFINITION.route.length;i++){
  const a=RESCUE_DEFINITION.route[i-1],b=RESCUE_DEFINITION.route[i];
  for(const [x,z] of [[-90,-35],[-88.6,-33.8],[-100,-10]]){
   const dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz)));
   assert(Math.hypot(a[0]+dx*t-x,a[1]+dz*t-z)>3);
  }
 }
});

const clone=v=>JSON.parse(JSON.stringify(v));
function storageHarness(initial={coins:20,horses:[{id:1,xp:0},{id:2,xp:0}],nextId:3}){
 let saved=clone(initial),readFailures=0;const mode={failWrite:false,failRead:false,failReadAfterWrite:false};
 const storage={ensure(){},fresh(){if(mode.failRead||readFailures){if(readFailures)readFailures--;return null;}return clone(saved);},sync(fn){
  // Match syncSave: callback runs against a fresh draft; failed writes are swallowed.
  try{if(mode.failRead)return;const draft=clone(saved);fn(draft);if(mode.failWrite)throw Error('QuotaExceededError');saved=clone(draft);if(mode.failReadAfterWrite)readFailures++;}catch(_){}
 }};
 return {storage,mode,get saved(){return clone(saved);}};
}
const pay=(s,reward,id)=>{s.coins+=reward.c;s.horses.find(h=>h.id===id).xp+=reward.xp;};
test('failed completion writes retain a frozen proof; retry pays the original horse once',()=>{
 const h=storageHarness(),run=finish(),pending=pendingRescueFinish(run,1),before=h.saved;
 h.mode.failWrite=true;assert.equal(saveRescueFinish(h.storage,pending,pay).ok,false);assert.deepEqual(h.saved,before);
 run.elapsed=900;run.returnStep=4;assert.equal(pending.run.elapsed,140);assert.equal(pending.run.returnStep,3);assert(Object.isFrozen(pending.run));
 assert.equal(saveRescueFinish(h.storage,pending,pay).ok,false);assert.deepEqual(h.saved,before);
 h.mode.failWrite=false;const result=saveRescueFinish(h.storage,pending,pay);
 assert.equal(result.ok,true);assert.equal(result.result.time,140);assert.equal(h.saved.coins,200);assert.equal(h.saved.horses[0].xp,60);assert.equal(h.saved.horses[1].xp,0);assert.equal(h.saved.rescueRides.completions,1);
 const paid=h.saved;assert.equal(saveRescueFinish(h.storage,pending,pay).ok,true);assert.deepEqual(h.saved,paid);
 assert.equal(pendingRescueFinish(finish({returnStep:2}),1),null);assert.equal(pendingRescueFinish(finish(),null),null);
});
test('write succeeded but read-back failed: retry confirms the existing run without paying twice',()=>{
 const h=storageHarness(),pending=pendingRescueFinish(finish(),1);h.mode.failReadAfterWrite=true;
 assert.equal(saveRescueFinish(h.storage,pending,pay).ok,false);assert.equal(h.saved.coins,200);assert.equal(h.saved.rescueRides.completions,1);
 h.mode.failReadAfterWrite=false;const paid=h.saved;assert.equal(saveRescueFinish(h.storage,pending,pay).ok,true);assert.deepEqual(h.saved,paid);
});
test('completion mirrors the original horse by ID even after switching mounts',()=>{
 const live=[{id:2,level:2,xp:7,stats:{jump:4}},{id:1,level:1,xp:90,stats:{jump:2}}],beforeOther=clone(live[0]);
 const saved={horses:[{id:1,level:2,xp:50,stats:{jump:3}},{id:2,level:2,xp:7,stats:{jump:4}}]};
 assert.equal(mirrorRescueHorseXp(live,saved,1),true);assert.deepEqual(live[0],beforeOther);assert.deepEqual(live[1],saved.horses[0]);
 live[1].stats.jump=9;assert.equal(saved.horses[0].stats.jump,3,'live stats must not alias the verified receipt');
 assert.equal(mirrorRescueHorseXp(live,saved,9),false);
});
test('missing saves and missing finishing horses never create a paid receipt',()=>{
 for(const initial of [null,{coins:20,horses:[]},{coins:20,horses:{}}]){
  const h=storageHarness(initial),before=h.saved;assert.equal(saveRescueFinish(h.storage,pendingRescueFinish(finish(),1),pay).ok,false);assert.deepEqual(h.saved,before);
 }
 const h=storageHarness();h.mode.failRead=true;assert.equal(saveRescueFinish(h.storage,pendingRescueFinish(finish(),1),pay).ok,false);assert.equal(h.saved.coins,20);
});
function adoptionHarness(){
 const h=storageHarness({coins:20,nextId:2,horses:[{id:1,name:'Rider horse'}],rescueRides:recordRescueFinish(null,finish()).save});
 const notices=[],events=[],counts={reload:0,chime:0,grant:0,naming:0};
 const G={save:h.storage,THREE:{},world:{mapMarkers:[],miniMarkers:[]},horse:{player:{},grantHorse(s,breed,opts){
  counts.grant++;const horse={id:s.nextId++,breed,name:opts.name,...opts.extra};s.horses.push(horse);
  G.toast('Pinto mastery unlocked');if(!opts.noName)counts.naming++;return horse;
 },reloadHorses(){counts.reload++;}},toast:(...args)=>notices.push(args),sChime(){counts.chime++;},on(){},run:(name,payload)=>events.push({name,payload})};
 install(G);return {...h,G,notices,events,counts,get saved(){return h.saved;}};
}
test('adoption failure has no success, naming or mastery notices; retry creates one saved Clover',()=>{
 const h=adoptionHarness(),before=h.saved,originalToast=h.G.toast;h.mode.failWrite=true;
 assert.equal(h.G.rescueRide.adopt(),false);assert.deepEqual(h.saved,before);assert.equal(h.G.toast,originalToast);
 assert.equal(h.counts.reload,0);assert.equal(h.counts.chime,0);assert.equal(h.counts.naming,0);assert.equal(h.events.length,0);
 assert.equal(h.notices.length,1);assert.match(h.notices[0][0],/could not be saved/);assert(!h.notices.some(args=>args[0].includes('mastery')));
 h.mode.failWrite=false;assert.equal(h.G.rescueRide.adopt(),true);assert.equal(h.saved.horses.filter(x=>x.rescueClover).length,1);assert.equal(h.saved.nextId,3);
 assert.equal(h.counts.reload,1);assert.equal(h.counts.chime,1);assert.equal(h.events.filter(e=>e.name==='rescueAdopt').length,1);
 assert.equal(h.notices.filter(args=>args[0].includes('mastery')).length,1);
 const paid=h.saved;assert.equal(h.G.rescueRide.adopt(),false);assert.deepEqual(h.saved,paid);assert.equal(h.counts.reload,1);
});
test('adoption retries after a failed read do not grant twice or repeat success',()=>{
 const h=adoptionHarness();h.mode.failReadAfterWrite=true;
 assert.equal(h.G.rescueRide.adopt(),false);assert.equal(h.saved.horses.filter(x=>x.rescueClover).length,1);assert.equal(h.counts.grant,1);assert.equal(h.events.length,0);
 assert.equal(h.G.rescueRide.snapshot().records.canAdopt,true,'reopening Activities must still offer the unconfirmed adoption retry');
 assert.equal(h.G.rescueRide.snapshot().records.adopted,false);
 h.mode.failReadAfterWrite=false;assert.equal(h.G.rescueRide.adopt(),true);assert.equal(h.counts.grant,1);assert.equal(h.events.length,1);
 assert.equal(h.G.rescueRide.snapshot().records.adopted,true);assert.equal(h.G.rescueRide.snapshot().records.canAdopt,false);
 assert.equal(h.G.rescueRide.adopt(),false);assert.equal(h.events.length,1);
});
test('a verified adoption refresh uses that verified save without another fallible read',()=>{
 const h=adoptionHarness(),fresh=h.G.save.fresh;let reads=0;
 h.G.save.fresh=()=>{reads++;return reads===1?fresh():null;};
 assert.equal(h.G.rescueRide.adopt(),true);assert.equal(reads,1);assert.equal(h.G.rescueRide.snapshot().records.adopted,true);assert.equal(h.G.rescueRide.snapshot().records.canAdopt,false);
});
test('adoption verification requires both its saved ledger and actual horse',()=>{
 for(const initial of [null,{rescueRides:{completions:1,adopted:true,adoptedHorseId:8},horses:[]},{rescueRides:{completions:1,adopted:true,adoptedHorseId:8},horses:{}},{rescueRides:{completions:1,adopted:true,adoptedHorseId:9},horses:[{id:8,rescueClover:true}]}]){
  const h=storageHarness(initial);assert.equal(saveCloverAdoption(h.storage,{horseId:8},()=>{throw Error('unexpected grant');}).ok,false);
 }
 const h=storageHarness({rescueRides:{completions:1},horses:[{id:8,rescueClover:true}]});
 const result=saveCloverAdoption(h.storage,{horseId:null},()=>{throw Error('existing Clover must be reused');});
 assert.equal(result.ok,true);assert.equal(h.saved.rescueRides.adoptedHorseId,8);assert.equal(h.saved.horses.length,1);
});

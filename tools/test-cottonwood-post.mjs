import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../assets/vendor/three/build/three.module.js';
import {POST_DEFINITION as D,isSoloPostRide,createPostRun,createPostGuide,advancePostGuide,postInteraction,observePostRun,actOnPostRun,postFinishProof,sanitizePostSave,savePostFinish} from '../assets/features/cottonwood-post-rules.mjs';
import {install} from '../assets/features/cottonwood-post.js';
const copy=x=>JSON.parse(JSON.stringify(x));
const route=()=>({exped:'cottonwood',soloExpedition:true,pts:D.stops.map((p,i)=>['Stop '+i,...p]),idx:0,t:0});
const newRun=(extra={})=>createPostRun({id:'post-run',at:1000,position:{x:-11,z:-15.8},horseId:1,horseName:'Juniper',...extra});
const stopped={distance:2,speed:0};
function move(run,to,extra={}){const from={...run.previous},len=Math.hypot(to.x-from.x,to.z-from.z),steps=Math.max(1,Math.ceil(len));for(let n=1;n<=steps;n++)observePostRun(run,{position:{x:from.x+(to.x-from.x)*n/steps,z:from.z+(to.z-from.z)*n/steps},dt:.1,speed:10,...extra});}
function finishedRun(){const r=newRun();actOnPostRun(r,stopped);move(r,D.pines);move(r,{x:39,z:-39});actOnPostRun(r,stopped);move(r,{x:-11,z:-15.8});actOnPostRun(r,stopped);return r;}
test('only the exact solo expedition is managed; club, offer and counterfeit routes retain legacy handling',()=>{
 assert.equal(isSoloPostRide(route()),true);
 for(const patch of [{soloExpedition:false},{soloExpedition:undefined},{clubRideId:'club-run'},{exped:'basin'},{pts:route().pts.slice(1)}])assert.equal(isSoloPostRide({...route(),...patch}),false);
 const r=route();r.pts[1][1]+=.01;assert.equal(isSoloPostRide(r),false);assert.equal(isSoloPostRide(null),false);
});
test('explicit stopped, nearby, mounted handoffs are required at collection, exchange and return',()=>{
 const r=newRun();for(let i=0;i<100;i++)observePostRun(r,{position:r.previous,dt:.1,speed:0});assert.equal(r.stage,'collect');assert.equal(r.picked,false);
 for(const patch of [{distance:D.reach},{distance:Infinity},{speed:D.stopSpeed},{speed:NaN},{blocked:true},{ready:false}])assert.equal(actOnPostRun(r,{...stopped,...patch}),false);
 assert.equal(actOnPostRun(r,stopped),true);assert.equal(r.stage,'pines');assert.equal(r.elapsed,0);assert.equal(actOnPostRun(r,stopped),false);
 move(r,D.pines);assert.equal(r.stage,'deliver');assert.equal(r.exchanged,false);
 for(let i=0;i<100;i++)observePostRun(r,{position:r.previous,dt:.1,speed:0});assert.equal(r.stage,'deliver');
 assert.equal(actOnPostRun(r,stopped),true);assert.equal(r.stage,'return');assert.equal(r.returned,false);
 assert.equal(postInteraction(r,{...stopped,speed:5}).status,'moving');assert.equal(postInteraction(r,{...stopped,blocked:true}).inReach,true);
 assert.equal(actOnPostRun(r,stopped),true);assert.equal(r.stage,'savePending');
});
test('paused and unmounted movement does not accumulate time, distance, or the pines checkpoint',()=>{
 const r=newRun();actOnPostRun(r,stopped);move(r,D.pines,{paused:true});assert.equal(r.stage,'pines');assert.equal(r.elapsed,0);assert.equal(r.distance,0);
 observePostRun(r,{position:r.previous,dt:.1,ready:false});assert.equal(r.stage,'pines');
 observePostRun(r,{position:r.previous,dt:.1});assert.equal(r.stage,'deliver');assert.equal(r.elapsed,.1);assert.equal(r.distance,0,'resume does not credit menu/background movement');
});
test('teleport and invalid coordinates reject a run while continuous fast riding is permitted',()=>{
 const r=newRun();assert.equal(observePostRun(r,{position:{x:90,z:90},dt:.016,speed:0}).invalid,true);
 assert.equal(observePostRun(newRun(),{position:{x:NaN,z:0},dt:.1}).invalid,true);
 const fast=newRun();assert.equal(observePostRun(fast,{position:{x:-10,z:-15.8},dt:.016,speed:50}).invalid,undefined);
});
test('completion needs the full observed route and freezes elapsed time and distance for retries',()=>{
 const r=finishedRun(),proof=postFinishProof(r);assert(proof);assert(Object.isFrozen(proof));assert(proof.distance>140);
 observePostRun(r,{position:{x:900,z:900},dt:999,speed:0});assert.equal(r.elapsed.toFixed(2),proof.time.toFixed(2));assert.equal(r.distance.toFixed(2),proof.distance.toFixed(2));
 for(const change of [{stage:'return'},{picked:false},{pines:false},{exchanged:false},{returned:false},{elapsed:0},{distance:99},{distance:Infinity}])assert.equal(postFinishProof({...r,...change}),null);
 assert(postFinishProof({...r,elapsed:7}),'a fast, correctly completed delivery has no arbitrary minimum time');
});
function storage(initial={coins:20,gems:1,pass:{pts:5},stats:{trails:4,expeditions:3,earned:9},expDone:{cottonwood:2,lakes:7}}){
 let value=copy(initial),readFailures=0;const mode={write:false,read:false,readAfterWrite:false};
 return {mode,get value(){return copy(value);},ensure(){},fresh(){if(mode.read||readFailures){if(readFailures)readFailures--;return null;}return copy(value);},sync(fn){try{if(mode.read)return;const next=copy(value);fn(next);if(mode.write)throw Error('quota');value=next;if(mode.readAfterWrite)readFailures++;}catch(_){}}};
}
const pay=(s,r,sp)=>{s.coins+=r.c;s.gems+=r.g;s.pass.pts+=r.p;s.sp=(s.sp||0)+sp;};
test('one atomic receipt preserves historical progression and grants the exact reward once',()=>{
 const s=storage(),proof=postFinishProof(finishedRun());const out=savePostFinish(s,proof,pay);assert(out.ok);assert(out.result.newBest);assert.equal(out.result.completions,1);
 assert.equal(s.value.coins,470);assert.equal(s.value.gems,3);assert.equal(s.value.pass.pts,33);assert.equal(s.value.sp,6);
 assert.deepEqual(s.value.stats,{trails:5,expeditions:4,earned:9});assert.deepEqual(s.value.expDone,{cottonwood:3,lakes:7});
 const paid=s.value;assert(savePostFinish(s,proof,pay).ok);assert.deepEqual(s.value,paid);
 const next={...proof,runId:'second',at:2000,time:proof.time+2};assert(savePostFinish(s,next,pay).ok);assert.equal(s.value.cottonwoodPost.bestTime,proof.time);
});
test('swallowed write failures cannot report success or lose retry identity',()=>{
 const s=storage(),proof=postFinishProof(finishedRun()),before=s.value;s.mode.write=true;
 assert.equal(savePostFinish(s,proof,pay).ok,false);assert.deepEqual(s.value,before);assert.equal(savePostFinish(s,proof,pay).ok,false);
 s.mode.write=false;assert(savePostFinish(s,proof,pay).ok);assert.equal(s.value.cottonwoodPost.completions,1);assert.equal(s.value.coins,470);
});
test('a successful write with failed readback is confirmed on retry without duplicate payout',()=>{
 const s=storage(),proof=postFinishProof(finishedRun());s.mode.readAfterWrite=true;
 assert.equal(savePostFinish(s,proof,pay).ok,false);assert.equal(s.value.coins,470);const paid=s.value;
 s.mode.readAfterWrite=false;assert.equal(savePostFinish(s,proof,pay).ok,true);assert.deepEqual(s.value,paid);
});
test('bounded receipts retain a permanent watermark so evicted deliveries cannot repay',()=>{
 const s=storage(),base=postFinishProof(finishedRun());
 for(let n=1;n<=25;n++)assert(savePostFinish(s,{...base,runId:'run-'+n,at:n*1000},pay).ok);
 assert.equal(s.value.cottonwoodPost.receipts.length,16);assert.equal(s.value.cottonwoodPost.completions,25);assert.equal(s.value.cottonwoodPost.closedBefore,9000);
 const paid=s.value;assert.equal(savePostFinish(s,{...base,runId:'run-1',at:1000},pay).ok,false);assert.deepEqual(s.value,paid);
});
test('malformed records and missing saves cannot fabricate valid receipts',()=>{
 for(const value of [null,[],{completions:NaN,bestTime:Infinity,receipts:[{runId:'x',at:1,time:9,distance:NaN}]}])assert.deepEqual(sanitizePostSave(value),{version:1,completions:0,bestTime:null,closedBefore:0,receipts:[]});
 assert.equal(savePostFinish(storage(null),postFinishProof(finishedRun()),pay).ok,false);
 const s=storage();s.mode.read=true;assert.equal(savePostFinish(s,postFinishProof(finishedRun()),pay).ok,false);assert.equal(s.value.coins,20);
});

function gameHarness(){
 const elements=new Map(),classes=new Set();
 class Element{constructor(){this.style={};this.dataset={};this.textContent='';}setAttribute(){}appendChild(){}addEventListener(){}set innerHTML(text){for(const [,id] of text.matchAll(/id="([^"]+)"/g))elements.set(id,new Element());}}
 globalThis.document={hidden:false,head:new Element(),body:new Element(),createElement:()=>new Element(),getElementById:id=>elements.get(id)};
 document.body.classList={contains:c=>classes.has(c),toggle:(c,on)=>on?classes.add(c):classes.delete(c)};
 const S=storage(),hooks=new Map(),events=[],P={pos:{x:-11,z:-15.8},speed:0,heading:0,y:0},rig={ready:true,heroMotion:{state:{}}},scene=new THREE.Scene();let current=null,blocked=false;
 const G={save:S,THREE,scene,world:{walls:[],mapMarkers:[],miniMarkers:[],npcList:[{def:{id:'wren'},g:{position:{x:-11,z:-15.8}}},{def:{id:'ada'},g:{position:{x:39,z:-39}}}],groundH:()=>0},horse:{player:P,RIG:()=>rig,ridden:()=>({id:1,name:'Juniper'})},input:{blocked:()=>blocked},money:{payReward:(s,r)=>{s.coins+=r.c;s.gems+=r.g;s.pass.pts+=r.p;},refreshWallet(){}},xp:{addSP:(s,n)=>{s.sp=(s.sp||0)+n;}},quest:{dailyEvt(){}},toast(){},
  on(k,f){if(!hooks.has(k))hooks.set(k,[]);hooks.get(k).push(f);},run(k,...args){events.push(k);let out;for(const fn of hooks.get(k)||[]){const r=fn(...args);if(r&&!out)out=r;}return out;}};
 G.trail={arrow:new THREE.Object3D(),get ride(){return current;},start(r){current=r;G.run('trailStart',r);},stop(){if(G.run('trailCancel',current)===true)return false;current=null;return true;},finishManaged(r){if(r!==current||r.finishNotified||r.idx!==r.pts.length||G.run('trailFinishReady',r)!==true)return false;r.finishNotified=true;G.run('trailDone',r);current=null;return true;}};
 install(G);
 const tick=(x,z,extra={})=>{Object.assign(P,extra);P.pos.x=x;P.pos.z=z;G.run('trailTick',current,.1);};
 const ride=to=>{const from={...P.pos},steps=Math.ceil(Math.hypot(to.x-from.x,to.z-from.z));for(let n=1;n<=steps;n++)tick(from.x+(to.x-from.x)*n/steps,from.z+(to.z-from.z)*n/steps,{speed:10});P.speed=0;};
 return {G,S,P,rig,events,elements,scene,ride,tick,get current(){return current;},block:v=>{blocked=v;}};
}
test('actual controller preserves pending mission and emits finish only after confirmed reward; panel pause and repeated actions are safe',()=>{
 const h=gameHarness(),{G,S}=h;G.trail.start(route());assert.equal(G.cottonwoodPost.snapshot().active.stage,'collect');
 assert.equal(G.cottonwoodPost.interact(),true);h.ride(D.pines);assert.equal(G.cottonwoodPost.snapshot().active.stage,'deliver');h.ride({x:39,z:-39});
 h.block(true);assert.equal(G.cottonwoodPost.interact(),false);h.block(false);assert.equal(G.cottonwoodPost.interact(),true);
 h.ride({x:-11,z:-15.8});S.mode.write=true;const before=S.value;assert.equal(G.cottonwoodPost.interact(),false);
 const pending=G.cottonwoodPost.snapshot().active;assert(pending.savePending);assert.equal(h.current.idx,4);assert.deepEqual(S.value,before);assert.equal(h.events.filter(x=>x==='trailDone').length,0);assert.equal(G.cottonwoodPost.cancel(),false);assert.equal(G.trail.stop(),false);
 h.tick(-11,-15.8);assert.equal(G.cottonwoodPost.snapshot().active.elapsed,pending.elapsed);assert.equal(G.cottonwoodPost.snapshot().active.runId,pending.runId);
 h.block(true);S.mode.write=false;assert.equal(G.cottonwoodPost.retrySave(),false);h.block(false);
 assert.equal(G.cottonwoodPost.retrySave(),true);assert.equal(G.cottonwoodPost.snapshot().active,null);assert.equal(h.current,null);assert.equal(h.events.filter(x=>x==='trailDone').length,1);assert.equal(h.events.filter(x=>x==='postFinish').length,1);assert.equal(S.value.coins,470);assert.equal(h.scene.children.length,0);
 assert.equal(G.cottonwoodPost.retrySave(),false);assert.equal(G.cottonwoodPost.interact(),false);assert.equal(S.value.coins,470);
});
test('actual controller uses live NPC positions and counts ordinary jump/gait transitions without permitting airborne handoffs',()=>{
 const h=gameHarness();h.G.world.npcList[0].g.position.x=-10;h.P.pos.x=-10;h.G.trail.start(route());assert.equal(h.G.cottonwoodPost.snapshot().active.target.x,-10);h.G.cottonwoodPost.interact();
 h.rig.heroMotion.state.transitioning=true;h.tick(-10,-16.8,{y:1});const s=h.G.cottonwoodPost.snapshot();assert.equal(s.active.elapsed,.1);assert.equal(s.active.distance,1);assert.equal(s.active.paused,false);
 h.ride(D.pines);h.ride({x:39,z:-39});assert.equal(h.G.cottonwoodPost.interact(),false);h.P.y=0;h.rig.heroMotion.state.transitioning=false;assert.equal(h.G.cottonwoodPost.interact(),true);
});
test('controller never manages shared rides and cancels invalid movement without reward or leaked art',()=>{
 const h=gameHarness();h.G.trail.start({...route(),clubRideId:'team'});assert.equal(h.G.cottonwoodPost.snapshot().active,null);assert.equal(h.current.managed,undefined);
 h.G.trail.start(route());h.G.cottonwoodPost.interact();h.tick(99,99);assert.equal(h.G.cottonwoodPost.snapshot().active,null);assert.equal(h.current,null);assert.equal(h.S.value.coins,20);assert.equal(h.scene.children.length,0);
});
test('controller refuses concurrent events and unready, unmounted, flying or vehicle entry but permits menu-launched rides',()=>{
 for(const change of [h=>{h.G.course={get:()=>({event:true})};},h=>{h.G.course={drillActive:()=>true};},h=>{h.P.onFoot=true;},h=>{h.P.flying=true;},h=>{h.rig.ready=false;},h=>{h.G.worldPkg={vehicle:()=>({})};}]){
  const h=gameHarness();change(h);h.G.trail.start(route());assert.equal(h.current,null);assert.equal(h.G.cottonwoodPost.snapshot().active,null);assert.equal(h.scene.children.length,0);
 }
 const h=gameHarness();h.block(true);h.G.trail.start(route());assert.equal(h.G.cottonwoodPost.snapshot().active.stage,'collect');
});
test('optional guide pins pause with menus and advance separately from actual delivery destinations',()=>{
 const points=[{x:0,z:0,radius:1},{x:4,z:0,radius:2}],guide=createPostGuide(points);points[0].x=999;
 assert.equal(advancePostGuide(guide,{x:0,z:0},{paused:true}),false);assert.equal(guide.index,0);
 assert.equal(advancePostGuide(guide,{x:0,z:0},{ready:false}),false);
 assert.equal(advancePostGuide(guide,{x:0,z:0}),true);assert.equal(guide.index,1);assert.equal(advancePostGuide(guide,{x:4,z:0}),true);assert.equal(guide.index,2);
 const h=gameHarness();h.G.trail.start(route());h.G.cottonwoodPost.interact();const s=h.G.cottonwoodPost.snapshot().active;
 assert.deepEqual(s.target,{...D.pines});assert.notDeepEqual(s.guide,s.target);
 h.ride(D.pines);h.ride({x:39,z:-39});assert.equal(h.G.cottonwoodPost.interact(),true,'handoff is based on Ada proximity even if optional guide pins were skipped');
});
test('woodland choice creates one physical jumpable wall and removes it on road choice, cancellation or exchange',()=>{
 const h=gameHarness(),keep={x1:100,z1:0,x2:100,z2:4};h.G.world.walls.push(keep);h.G.trail.start(route());assert.equal(h.G.cottonwoodPost.setRoute('woodland'),false);
 h.G.cottonwoodPost.interact();h.ride(D.pines);assert.equal(h.G.cottonwoodPost.snapshot().active.route,'road');assert.equal(h.G.world.walls.length,1);
 h.block(true);assert.equal(h.G.cottonwoodPost.setRoute('woodland'),false);h.block(false);
 assert.equal(h.G.cottonwoodPost.setRoute('woodland'),true);assert.equal(h.G.cottonwoodPost.snapshot().active.route,'woodland');assert.equal(h.G.world.walls.length,2);
 assert.deepEqual(h.G.world.walls[1],{x1:-7,z1:-54.7,x2:-7,z2:-51.3,courier:true});
 assert.equal(h.G.cottonwoodPost.setRoute('woodland'),true);h.tick(-30,-58);assert.equal(h.G.world.walls.length,2,'repainting never duplicates the obstacle');
 assert.equal(h.G.cottonwoodPost.setRoute('road'),true);assert.deepEqual(h.G.world.walls,[keep]);
 h.G.cottonwoodPost.setRoute('woodland');h.ride({x:39,z:-39});h.G.cottonwoodPost.interact();assert.deepEqual(h.G.world.walls,[keep],'reply stage releases the optional jump obstacle');
 h.G.cottonwoodPost.cancel();assert.equal(h.scene.children.length,0);assert.deepEqual(h.G.world.walls,[keep]);
 const other=gameHarness();other.G.trail.start(route());other.G.cottonwoodPost.interact();other.ride(D.pines);other.G.cottonwoodPost.setRoute('woodland');other.G.cottonwoodPost.cancel();assert.deepEqual(other.G.world.walls,[]);
});
test('mounts whose jump button starts flight stay on the clear road, including mid-ride mount switches',()=>{
 const h=gameHarness();h.G.trail.start(route());h.G.cottonwoodPost.interact();h.ride(D.pines);
 h.rig.profile={nativeBreed:true,nativeJump:{clip:'jump'}};assert.equal(h.G.cottonwoodPost.setRoute('woodland'),true);
 h.rig.profile.nativeCanFly=true;assert.equal(h.G.cottonwoodPost.setRoute('woodland'),false);h.tick(-30,-58);assert.equal(h.G.cottonwoodPost.snapshot().active.route,'road');assert.deepEqual(h.G.world.walls,[]);assert.equal(h.G.cottonwoodPost.snapshot().active.woodlandAvailable,false);
 h.rig.profile={nativeBreed:true,nativeJump:null};assert.equal(h.G.cottonwoodPost.setRoute('woodland'),false);
 h.rig.profile={nativeBreed:true,nativeRoster:true,nativeJump:{clip:'jump'}};h.rig.nativeFantasy={pair:{}};assert.equal(h.G.cottonwoodPost.setRoute('woodland'),false);
});
test('Adventures start clones the canonical solo expedition and uses the real trail start gate without broadcasting',()=>{
 const h=gameHarness(),stops=route().pts;let calls=0;h.G.social={EXPEDITIONS:[{id:'cottonwood',stops}]};h.G.net={myName:()=> 'Rider',publish(){throw Error('must not broadcast');}};
 const realStart=h.G.trail.start.bind(h.G.trail);h.G.trail.start=(pts,by,opts)=>{calls++;assert.notEqual(pts,stops);assert.notEqual(pts[0],stops[0]);assert.equal(by,'Rider');assert.equal(opts.soloExpedition,true);assert.equal(opts.exped,'cottonwood');realStart({...opts,pts,idx:0,t:0});return !!h.current;};
 assert.equal(h.G.cottonwoodPost.start(),true);assert.equal(calls,1);assert.equal(h.G.cottonwoodPost.snapshot().active.stage,'collect');
});
test('pointer route selection releases button focus for the next riding jump while keyboard selection keeps accessible focus',()=>{
 const h=gameHarness();h.G.trail.start(route());h.G.cottonwoodPost.interact();h.ride(D.pines);const button=h.elements.get('postWoodland');let blurred=0;button.blur=()=>{blurred++;};
 button.onclick({detail:1,currentTarget:button});assert.equal(blurred,1);assert.equal(h.G.cottonwoodPost.snapshot().active.route,'woodland');
 button.onclick({detail:0,currentTarget:button});assert.equal(blurred,1,'keyboard activation retains focus');
});

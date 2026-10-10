import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as rewards from '../assets/roundup-rewards.mjs';
import * as approach from '../assets/roundup-approach.mjs';
import * as shared from '../assets/shared-herd-physics.mjs';
const source=fs.readFileSync(new URL('../ranch3d.html',import.meta.url),'utf8');
const begin=source.indexOf('const ROUND_MODES='),end=source.indexOf('/* ===== Training drills',begin);
assert(begin>0&&end>begin);const core=source.slice(begin,end);
const bounds={x1:-110,x2:-33,z1:-45,z2:25};
function vector(x=0,y=0,z=0){return {x,y,z,set(x,y,z){Object.assign(this,{x,y,z});return this;},distanceTo(p){return Math.hypot(this.x-p.x,this.y-p.y,this.z-p.z);}};}
function fixture(){
 const trace={events:[],writes:0,removed:0,disposed:0,release:0,pushes:0},document={hidden:false};let blocked=false;
 const player={pos:vector(-102,0,16),mesh:{position:vector(),rotation:{}},heading:0,speed:0,y:0};
 const RIG={ready:true,heroMotion:{state:{}}};
 const G={net:{net:{id:'local'}},input:{blocked:()=>blocked},riding:{releaseAll(){trace.release++;},selectGait(){}},world:{colliders:[],walls:[],pushOut(){trace.pushes++;}},worldPkg:{findClear(x,z,pad,radius,inside){return inside(x,z)?[x,z]:null;}},run:(name,data)=>trace.events.push({name,data}),onFoot:{on:false,state:()=>({})}};
 function makeHorse(){const group={position:vector(),rotation:{},visible:true,add(){},traverse(){}};return {group,legs:[],shadowM:{material:{dispose(){trace.disposed++;}}}};}
 const bindings={...rewards,...approach,...shared,G,player,RIG,DRILL:{},course:null,document,freeCam:false,PAST:{...bounds},THREE:{Vector3:vector},WILD_BREEDS:[{breed:'bay',body:'#654321',mane:'#321000'}],SPH:{},nameSprites:[],scene:{add(){},remove(){trace.removed++;}},makeHorse,nameSprite:()=>({position:vector(),removeFromParent(){}}),groundH:()=>0,$:()=>({style:{}}),toast(){},hidePanels(){blocked=false;},sNeigh(){},sChime(){},undressRig(){},dressWithRig(){},tickRig(){},animateHorse(){},GAITS:{walk:{},trot:{}},freshSave:()=>({roundupBest:{}}),syncSave(){trace.writes++;throw Error('shared session must never save');},refreshWallet(){throw Error('shared session must never pay');},confirmTrainingProgress(){throw Error('shared session must never credit');}};
 const api=Function(...Object.keys(bindings),core+`;buildPen=()=>{ROUND.grp={visible:true};ROUND.ring=null;};return {ROUND,startSharedRoundup,sharedRoundupState,setSharedRoundupStartupWaiting,setSharedRoundupRiders,applySharedRoundupSnapshot,stopSharedRoundup,tickRoundup,startRoundup,endRoundup,retryRoundupSave,roundupState,setFreeCam:v=>{freeCam=v;}};`)(...Object.values(bindings));
 return {api,G,player,RIG,trace,document,bindings,set blocked(v){blocked=v;},start:(host=true,slot=0)=>api.startSharedRoundup({sessionId:'team-one',host,slot}),tick:(dt=.02,t=1)=>api.tickRoundup(dt,t)};
}
function place(h,x,z,heading=Math.PI/2){h.pos.set(x,0,z);h.heading=heading;h.anchor={x,z};}
function snapshot(f){return structuredClone(f.api.sharedRoundupState());}
function go(f){if(f.api.ROUND.shared?.host)f.api.setSharedRoundupStartupWaiting(false);f.api.ROUND.cd=0;}
const soloEvent=e=>['roundupStart','roundupPen','roundupFinish','roundupCancel','roundupSavePending'].includes(e.name);

test('shared startup reuses five actors in four distinct pasture slots without a solo start or write',()=>{
 const positions=[];
 for(let slot=0;slot<4;slot++){
  const f=fixture();assert.equal(f.start(true,slot),true);const s=f.api.sharedRoundupState();
  assert.equal(s.total,5);assert.equal(s.countdown,3);assert.equal(s.host,true);assert.equal(s.sessionId,'team-one');assert.equal(s.finished,false);assert.equal(s.horses.length,5);
  assert.deepEqual(f.api.roundupState().shared,{sessionId:'team-one',host:true});assert.equal(f.trace.events.filter(soloEvent).length,0);assert.equal(f.trace.writes,0);positions.push([f.player.pos.x,f.player.pos.z]);
 }
 assert.equal(new Set(positions.map(JSON.stringify)).size,4);
});

test('a flank rider changes the same horse motion through production combined-pressure physics',()=>{
 const alone=fixture(),team=fixture();alone.start();team.start();go(alone);go(team);
 for(const f of [alone,team]){f.player.pos.set(-89,0,0);place(f.api.ROUND.horses[0],-80,0);}
 assert.equal(team.api.setSharedRoundupRiders([{id:'flank',x:-80,z:-9}]),true);
 for(let i=0;i<30;i++){alone.tick();team.tick();}
 const a=alone.api.ROUND.horses[0],b=team.api.ROUND.horses[0];assert(a.pos.x>-80);assert(b.pos.x>-80);assert(b.pos.z>a.pos.z+.4,'flank pressure visibly turns the shared horse');
 assert.equal(team.trace.writes,0);assert.equal(team.trace.events.filter(soloEvent).length,0);
});

test('remote roster is detached, deduplicated, finite, bounded and capped at three plus local',()=>{
 const f=fixture();f.start();const rows=[{id:'local',x:-90,z:0},{id:'a',x:-91,z:0},{id:'a',x:-90,z:0},{id:'nan',x:NaN,z:0},{id:'outside',x:500,z:0},{id:'b',x:-92,z:0},{id:'c',x:-93,z:0},{id:'d',x:-94,z:0}];
 assert.equal(f.api.setSharedRoundupRiders(rows),true);assert.deepEqual(f.api.ROUND.shared.riders.map(r=>r.id),['a','b','c']);rows[1].x=100;assert.equal(f.api.ROUND.shared.riders[0].x,-91);
 assert.equal(f.api.setSharedRoundupRiders(null),false);assert.equal(f.api.ROUND.shared.riders.length,3);
});

test('guest never advances clock, runs avoidance, pens a horse or pays locally',()=>{
 const f=fixture();f.start(false);go(f);place(f.api.ROUND.horses[0],-44,-8);f.player.pos.set(-53,0,-8);
 const before=snapshot(f);for(let i=0;i<10;i++)f.tick(.1,i/10);
 assert.deepEqual(snapshot(f),before);assert.equal(f.trace.pushes,0);assert.equal(f.trace.writes,0);assert.equal(f.trace.events.filter(soloEvent).length,0);
 assert.equal(f.api.setSharedRoundupRiders([{id:'other',x:-50,z:0}]),false);
});

test('valid guest snapshots interpolate detached host positions even while a local menu is open',()=>{
 const host=fixture(),guest=fixture();host.start();guest.start(false);go(host);go(guest);
 const first=snapshot(host);assert.equal(guest.api.applySharedRoundupSnapshot(first),true);const before=guest.api.ROUND.horses[0].pos.x;
 const second=structuredClone(first);second.elapsed=1;second.horses[0].x+=2;assert.equal(guest.api.applySharedRoundupSnapshot(second),true);second.horses[0].x=500;
 guest.blocked=true;guest.tick(.05);const x=guest.api.ROUND.horses[0].pos.x;assert(x>before&&x<before+2);assert.equal(guest.api.sharedRoundupState().paused,false,'local menu cannot claim the host paused');assert.equal(guest.api.ROUND.elapsed,1);assert.equal(guest.trace.pushes,0);
 assert.equal(guest.api.applySharedRoundupSnapshot({...first,elapsed:.5}),false,'older elapsed state rejected');
});

test('malformed, cross-session, reverse-clock, impossible-pen and out-of-bounds snapshots are rejected atomically',()=>{
 const host=fixture(),guest=fixture();host.start();guest.start(false);const good=snapshot(host);assert.equal(guest.api.applySharedRoundupSnapshot(good),true);
 for(const mutate of [s=>s.sessionId='other',s=>s.host=false,s=>s.horses.pop(),s=>s.horses[0].x=Infinity,s=>s.horses[0].x=-200,s=>s.horses[1].name=s.horses[0].name,s=>s.horses[0].heading=NaN,s=>s.horses[0].phase=Infinity,s=>s.finished=true,s=>s.penned=1,s=>{s.penned=1;s.horses[0].penned=true;},s=>s.countdown=4,s=>{s.countdown=3;s.elapsed=1;}]){
  const bad=structuredClone(good);mutate(bad);const before=snapshot(guest);assert.equal(guest.api.applySharedRoundupSnapshot(bad),false);assert.deepEqual(snapshot(guest),before);
 }
 assert.equal(host.api.applySharedRoundupSnapshot(good),false,'host never accepts guest simulation');
});

test('host and guest finish exactly once, retain actors, and never touch solo rewards or records',()=>{
 const host=fixture(),guest=fixture();host.start();guest.start(false);go(host);go(guest);host.player.pos.set(-102,0,16);
 for(const h of host.api.ROUND.horses)place(h,-44,-8);
 host.tick(.02);const s=snapshot(host);assert.equal(s.finished,true);assert.equal(s.penned,5);assert.equal(s.active,true);assert.equal(host.api.ROUND.horses.length,5);assert.equal(host.trace.removed,0);
 assert.equal(guest.api.applySharedRoundupSnapshot(s),true);assert.equal(guest.api.applySharedRoundupSnapshot(s),true);
 const frozen=snapshot(host);host.tick(10);assert.deepEqual(snapshot(host),frozen);assert.equal(host.api.endRoundup(false),false);assert.equal(host.api.retryRoundupSave(),false);
 for(const f of [host,guest]){assert.equal(f.trace.events.filter(e=>e.name==='sharedRoundupFinish').length,1);assert.equal(f.trace.events.filter(soloEvent).length,0);assert.equal(f.trace.writes,0);assert.equal(f.api.ROUND.lastResult,null);}
 assert.equal(host.api.stopSharedRoundup('completed'),true);assert.equal(host.api.sharedRoundupState(),null);assert.equal(host.trace.removed,5);assert.equal(host.api.stopSharedRoundup('again'),false);
});

test('host menu, free camera, photo pause and background freeze the shared stopwatch and physics',()=>{
 for(const kind of ['menu','freecam','photo','hidden']){
  const f=fixture();f.start();go(f);if(kind==='menu')f.blocked=true;if(kind==='freecam')f.api.setFreeCam(true);if(kind==='photo')f.G.photoPause=true;if(kind==='hidden')f.document.hidden=true;
  const before=snapshot(f);f.tick(2);assert.deepEqual(snapshot(f),before);assert.equal(f.api.sharedRoundupState().paused,true);assert.equal(f.trace.pushes,0);
 }
});

test('shared completion has no solo deadline and cannot override a pending or active solo round',()=>{
 const f=fixture();f.start();go(f);f.player.pos.set(-110,0,25);f.api.ROUND.elapsed=200;f.api.ROUND.t=-5;f.tick(.02);assert.equal(f.api.ROUND.on,true);assert.equal(f.api.ROUND.shared.finished,false);assert.equal(f.trace.writes,0);
 const p=fixture();p.api.ROUND.pending={proof:{runId:'saved-later'}};assert.equal(p.start(),false);assert.equal(p.api.ROUND.pending.proof.runId,'saved-later');assert.equal(p.trace.removed,0);
 const a=fixture();a.api.ROUND.on=true;assert.equal(a.start(),false);assert.equal(a.api.ROUND.shared,null);
 for(const args of [{sessionId:'',host:true},{sessionId:'ok',host:'yes'},{sessionId:'ok',host:true,slot:4},{sessionId:'ok',host:true,slot:1.5}])assert.equal(fixture().api.startSharedRoundup(args),false);
});

test('normal cancellation of a shared session releases only shared actors and stop hook',()=>{
 const f=fixture();f.start();assert.equal(f.api.endRoundup(true),true);assert.equal(f.api.ROUND.on,false);assert.equal(f.api.ROUND.shared,null);assert.equal(f.trace.removed,5);assert.equal(f.trace.events.filter(e=>e.name==='sharedRoundupStop').length,1);assert.equal(f.trace.events.filter(soloEvent).length,0);assert.equal(f.trace.writes,0);
});

test('source exposes the narrow shared interface alongside unchanged solo entry points',()=>{
 assert(source.includes('shared:{start:startSharedRoundup,state:sharedRoundupState,setStartupWaiting:setSharedRoundupStartupWaiting,setRiders:setSharedRoundupRiders,applySnapshot:applySharedRoundupSnapshot,stop:stopSharedRoundup}'));
});


test('a blocked shared spawn fails without moving the rider or constructing the herd',()=>{
 const f=fixture();f.G.world.colliders=[{x:-102,z:16,r:4}];const before=[f.player.pos.x,f.player.pos.z];
 assert.equal(f.start(),false);assert.deepEqual([f.player.pos.x,f.player.pos.z],before);assert.equal(f.api.ROUND.horses.length,0);assert.equal(f.api.ROUND.on,false);assert.equal(f.trace.events.length,0);
});

test('guest final state retains authoritative pen coordinates and rejects horses leaving it',()=>{
 const h=fixture(),g=fixture();h.start();g.start(false);go(h);for(const horse of h.api.ROUND.horses)place(horse,-44,-8);h.tick(.02);
 const done=snapshot(h);assert.equal(g.api.applySharedRoundupSnapshot(done),true);assert.deepEqual(snapshot(g).horses,done.horses);
 const rollback=structuredClone(done);rollback.elapsed+=1;rollback.horses[0].penned=false;rollback.penned=4;rollback.finished=false;assert.equal(g.api.applySharedRoundupSnapshot(rollback),false);
});


test('startup rendezvous holds the real countdown, all horse physics and elapsed time until one-way host release',()=>{
 const f=fixture();f.start();const before=snapshot(f);for(let i=0;i<30;i++)f.tick(.1,i/10);assert.deepEqual(snapshot(f),before);assert.equal(before.startupWaiting,true);assert.equal(before.paused,true);assert.equal(f.trace.pushes,0);
 assert.equal(f.api.setSharedRoundupStartupWaiting(false),true);f.tick(.1);assert(f.api.ROUND.cd<3);assert.equal(f.api.ROUND.elapsed,0);assert.equal(f.api.setSharedRoundupStartupWaiting(true),false);assert.equal(f.api.sharedRoundupState().startupWaiting,false);
 const guest=fixture();guest.start(false);assert.equal(guest.api.setSharedRoundupStartupWaiting(false),false);assert.equal(guest.api.sharedRoundupState().startupWaiting,true);
});

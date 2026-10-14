import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {install} from '../assets/features/club-rides.js';
import {EXPEDITIONS} from '../assets/expeditions.mjs';
import {REGROUP_MODE,REGROUP_ROUTE,regroupState,regroupInput,isRegroupRoute} from '../assets/club-regroup-rules.mjs';
const copy=v=>structuredClone(v),core=fs.readFileSync(new URL('../ranch3d.html',import.meta.url),'utf8');
const trailCore=core.slice(core.indexOf('function startTrail(pts,by,opts){'),core.indexOf('let party=null',core.indexOf('function startTrail(pts,by,opts){')));
const social=fs.readFileSync(new URL('../assets/features/social-play.js',import.meta.url),'utf8');
const payout=social.slice(social.indexOf(" G.on('trailDone',r=>{"),social.indexOf(' /* ======================= 10.',social.indexOf(" G.on('trailDone',r=>{")));
function fixture(t){
 const old=Date.now;let clock=1900000000000;Date.now=()=>clock;t.after(()=>{Date.now=old;});
 const clients=[],queue=[],sent=[],retained=new Map();
 function flush(){let n=0;while(queue.length){assert(++n<1000,'finite packet exchange');const p=queue.shift();for(const c of clients)if(c!==p.from&&c.G.net.net.client.connected&&c.G.net.net.club===p.topic.split('/')[1])c.emit('message',p.topic,copy(p.m));}}
 function client(id='guest',name=id,initial={}){
  const members=Object.fromEntries(['host','guest','third','fourth','fifth'].map(id=>[id,{n:id,left:false}]));
  let save={club:'club-a',ridingClub:'club-a',clubRecords:{'club-a':{members}},coins:0,gems:0,pass:0,sp:0,stats:{},...copy(initial)};
  let blocked=false;const hooks=new Map(),ensures=[],rewards=[],events=[];
  const c={id,data:()=>copy(save),rewards,events,blocked(v){blocked=v;},emit(k,...args){events.push(k);let result;for(const f of hooks.get(k)||[]){const v=f(...args);if(v&&result===undefined)result=v;}return result;}};
  const player={pos:{x:0,z:5},y:0,speed:0,heading:0,onFoot:false,flying:false,landing:false},rig={ready:true,heroMotion:{state:{grounded:true}}};
  const G=c.G={on(k,f){const a=hooks.get(k)||[];a.push(f);hooks.set(k,a);},run:(...a)=>c.emit(...a),save:{ensure(f){ensures.push(f);f(save);},fresh:()=>copy(save),sync(f){const s=copy(save);ensures.forEach(f=>f(s));f(s);save=s;}},clubs:{identity:(s=save)=>({code:s.club,founder:'Host',founderId:'host',canCreate:false,pendingJoin:false}),memberRows:()=>Object.entries(save.clubRecords?.[save.club]?.members||{}).filter(([,v])=>!v.left).map(([id,v])=>({id,name:v.n}))},
   net:{net:{id,club:'club-a',client:{connected:true}},myName:()=>name,subscribe(){},publish(topic,obj,options){if(!G.net.net.client.connected)return false;const p={from:c,topic,m:{id,n:name,...copy(obj)}};sent.push(p);queue.push(p);if(options?.retain)retained.set(topic,p);return true;}},
   social:{EXPEDITIONS},course:{get:()=>null,drillActive:()=>false},worldPkg:{lockedRegionsAt:()=>[],vehicle:()=>null},world:{groundH:()=>0},horse:{player,RIG:()=>rig},input:{blocked:()=>blocked},riding:{releaseAll(){}},hidePanels(){blocked=false;},toast(){},sGem(){},money:{payReward(s,r){rewards.push(copy(r));s.coins+=r.c||0;s.gems+=r.g||0;s.pass+=r.p||0;},refreshWallet(){}},xp:{addSP(s,n){s.sp+=n;}},quests:{dailyEvt(){}}};
  const arrow={visible:false,position:{set(x,y,z){this.x=x;this.y=y;this.z=z;}}},bindings={G,player,arrow,groundH:()=>0,myName:()=>name,toast(){},sChime(){},sCoin(){},sGem(){},addCoins(){throw Error('unexpected fallback reward');},passAdd(){throw Error('unexpected fallback pass');},syncSave:G.save.sync,addSP:G.xp.addSP,dailyEvt(){},releaseAllRidingControls(){},net:{client:null},TRAIL_STOPS:[]};
  c.tick=Function(...Object.keys(bindings),'let trailRide=null,trailDraft=[],trailOffer=null,course=null;'+trailCore+'return tickTrail;')(...Object.values(bindings));
  const routeLen=pts=>pts.slice(1).reduce((n,p,i)=>n+Math.hypot(p[1]-pts[i][1],p[2]-pts[i][2]),0);
  G.money.rewardLabel=()=>'';
  Function('G','S','M','X','Q','EXPEDITIONS','routeLen','toast','ping',payout)(G,G.save,G.money,G.xp,G.quests,EXPEDITIONS,routeLen,()=>{},()=>{});
  install(G);c.api=G.clubRides;c.player=player;c.rig=rig;c.step=(dt=.05)=>{c.tick(dt);c.emit('tick',dt);};c.receive=p=>c.emit('message',p.topic,copy(p.m));c.position=(x,z)=>{player.pos.x=x;player.pos.z=z;};clients.push(c);return c;
 }
 function setup(){const a=client('host'),b=client('guest');const s=a.api.host('basin',{regroup:true});assert(s.ok);flush();assert(b.api.join(s.id).ok);flush();assert(b.api.ready().ok);flush();assert(a.api.start().ok);flush();assert.equal(b.G.trail.ride,null);assert(b.api.rejoin().ok);flush();return {a,b,id:s.id};}
 function arrive(a,b,index){clock+=400;for(const c of [a,b]){const p=EXPEDITIONS[0].stops[index];c.position(p[1],p[2]);c.player.speed=0;c.step();}flush();}
 function depart(a,b){assert(a.api.readyAtStop().ok);assert(b.api.readyAtStop().ok);flush();assert(a.api.snapshot().current.regroup.canContinue);assert(a.api.continueTogether().ok);flush();a.step();b.step();flush();}
 return {client,setup,arrive,depart,flush,queue,sent,retained,advance(ms){clock+=ms;},now:()=>clock};
}

test('opt-in requires real club metadata and canonical Basin; legacy hosting stays available',t=>{
 const f=fixture(t),a=f.client('host');assert(a.api.host('cottonwood',{regroup:true}).ok===false);
 a.G.clubs.identity=()=>({code:'club-a',canCreate:true,pendingJoin:false});assert.equal(a.api.host('basin',{regroup:true}).ok,false);assert(a.api.host('basin').ok);
 const other=f.client('unknown');assert.equal(other.api.host('basin',{regroup:true}).ok,true,'self in a genuinely joined club may host');
 assert.equal(isRegroupRoute({...EXPEDITIONS[0],stops:[['fake',0,0],['fake',1,1]]}),false);
});
test('two explicit lobby consents and voluntary guest start precede any real trail progress',t=>{
 const f=fixture(t),a=f.client('host'),b=f.client('guest'),r=a.api.host('basin',{regroup:true});f.flush();assert.equal(a.api.snapshot().current.canStart,false);assert.equal(a.api.start().ok,false);
 assert(b.api.join(r.id).ok);f.flush();assert.equal(a.api.start().ok,false);assert(b.api.ready().ok);f.flush();assert(a.api.start().ok);f.flush();assert.equal(b.G.trail.ride,null);assert(b.api.rejoin().ok);f.flush();a.step();b.step();
 assert.equal(a.G.trail.ride.idx,0);assert.equal(b.G.trail.ride.idx,0);assert.equal(a.rewards.length,0);assert.equal(b.rewards.length,0);
});
test('actual stock trail loop credits each stop only after both stopped Ready and host Continue',t=>{
 const f=fixture(t),{a,b}=f.setup();a.step();b.step();assert(a.api.readyAtStop().ok);f.flush();assert.equal(a.api.continueTogether().ok,false);a.step();assert.equal(a.G.trail.ride.idx,0);
 assert(b.api.readyAtStop().ok);f.flush();assert(a.api.continueTogether().ok);f.flush();assert.equal(a.G.trail.ride.idx,0,'host packet itself has no progression side effect');
 a.step();b.step();f.flush();assert.equal(a.G.trail.ride.idx,1);assert.equal(b.G.trail.ride.idx,1);assert.equal(a.events.filter(e=>e==='trailStop').length,1);assert.equal(a.rewards.length,0);
 a.step();b.step();assert.equal(a.G.trail.ride.idx,1);
});
test('moving after host departure invalidates local proof; a fresh explicit Ready recovers without replay credit',t=>{
 const f=fixture(t),{a,b}=f.setup();a.api.readyAtStop();b.api.readyAtStop();f.flush();assert(a.api.continueTogether().ok);b.position(11,5);f.flush();b.step();assert.equal(b.G.trail.ride.idx,0);
 a.step();f.flush();b.position(0,5);b.step();assert.equal(b.G.trail.ride.idx,0);assert(b.api.readyAtStop().ok);f.flush();b.step();f.flush();assert.equal(b.G.trail.ride.idx,1);assert.equal(a.G.trail.ride.idx,1);
});
test('four physical stops use real social payout exactly once, without shared economy or records',t=>{
 const f=fixture(t),{a,b}=f.setup();
 for(let index=0;index<4;index++){f.arrive(a,b,index);assert.equal(a.G.trail.ride.idx,index);f.depart(a,b);}
 for(const c of [a,b]){assert.equal(c.G.trail.ride,null);assert.equal(c.rewards.length,1);assert.deepEqual(c.rewards[0],EXPEDITIONS[0].r);assert.equal(c.data().stats.trails,1);assert.equal(c.data().expDone.basin,1);assert.equal(c.data().coins,300);assert.equal(c.data().gems,1);assert.equal(c.data().pass,20);assert.equal(c.data().sp,6);assert.equal(c.events.filter(e=>e==='trailDone').length,1);assert.equal(c.api.snapshot().current.finished,true);}
 for(const p of f.sent.filter(p=>p.topic.includes('/session/')).slice(-4)){a.receive(p);b.receive(p);}a.step();b.step();assert.equal(a.rewards.length,1);assert.equal(b.rewards.length,1);
});
test('menus, flight, native returning poses and actual movement cannot ready or consume a departure',t=>{
 const f=fixture(t),{a,b}=f.setup();
 for(const [on,off]of [[()=>b.blocked(true),()=>b.blocked(false)],[()=>b.player.flying=true,()=>b.player.flying=false],[()=>b.player.onFoot=true,()=>b.player.onFoot=false],[()=>b.rig.heroMotion.state.transitioning=true,()=>b.rig.heroMotion.state.transitioning=false],[()=>b.player.speed=1.2,()=>b.player.speed=0]]){on();assert.equal(b.api.readyAtStop().ok,false);b.step();assert.equal(b.G.trail.ride.idx,0);off();}
 a.api.readyAtStop();b.api.readyAtStop();f.flush();a.api.continueTogether();f.flush();b.blocked(true);b.step();assert.equal(b.G.trail.ride.idx,0);b.blocked(false);b.step();assert.equal(b.G.trail.ride.idx,0,'a menu invalidates the previous Ready');assert(b.api.readyAtStop().ok);f.flush();b.step();assert.equal(b.G.trail.ride.idx,1);
});
test('stale position and replayed readiness cannot authorize a departure',t=>{
 const f=fixture(t),{a,b}=f.setup();a.api.readyAtStop();b.api.readyAtStop();f.flush();const packet=f.sent.filter(p=>p.from===b&&p.topic.includes('/position/')).at(-1);f.advance(2300);assert.equal(a.api.continueTogether().ok,false);a.receive(packet);assert.equal(a.api.continueTogether().ok,false);assert.equal(a.G.trail.ride.idx,0);
 b.player.speed=4;b.step();f.flush();assert.equal(a.api.continueTogether().ok,false);
});
test('wrong route, room, nonmember and unknown modes cannot participate or alter personal progress',t=>{
 const f=fixture(t),{a,b,id}=f.setup(),x=f.client('outsider');const session=f.sent.find(p=>p.topic.includes('/session/'));
 x.receive({...session,m:{...session.m,mode:'another-mode',rev:999}});assert.equal(x.api.snapshot().lobbies.length,0);
 assert.equal(x.api.join(id).ok,false);a.api.readyAtStop();b.api.readyAtStop();f.flush();const packet=f.sent.filter(p=>p.from===b&&p.topic.includes('/position/')).at(-1);
 a.receive({...packet,m:{...packet.m,route:'cottonwood-v1',rev:packet.m.rev+1000}});a.receive({...packet,topic:packet.topic.replace('club-a','other')});assert.equal(a.G.trail.ride.idx,0);
 const before=copy(b.player);b.receive({...session,m:{...session.m,rev:999,regroup:{route:REGROUP_ROUTE,crew:['host','guest'],departures:[]},mode:'unknown'}});assert.deepEqual(b.player,before);
});
test('Continue alone detaches only coordination and retains actual already-earned personal stops',t=>{
 const f=fixture(t),{a,b}=f.setup();f.depart(a,b);const r=b.G.trail.ride;assert(b.api.continueAlone().ok);f.flush();assert.equal(b.G.trail.ride,r);assert.equal(r.idx,1);assert.equal(r.clubRideId,undefined);assert.equal(r.clubRegroup,undefined);assert.equal(b.api.snapshot().current,null);assert.equal(a.api.continueTogether().ok,false);
 for(let i=1;i<4;i++){const p=EXPEDITIONS[0].stops[i];b.position(p[1],p[2]);b.step();}assert.equal(b.rewards.length,1);assert.equal(a.rewards.length,0);
});
test('expired host or cancelled group holds credits but offers explicit continue-alone instead of stranding a trail',t=>{
 const f=fixture(t),{a,b}=f.setup();const r=b.G.trail.ride;assert(a.api.cancel().ok);f.flush();assert(b.api.snapshot().current);b.step();assert.equal(r.idx,0);assert.equal(b.api.readyAtStop().ok,false);assert(b.api.continueAlone().ok);assert.equal(b.G.trail.ride,r);b.step();assert.equal(r.idx,1);
 const f2=f.setup(),r2=f2.b.G.trail.ride;f.advance(180001);const state=f2.b.api.snapshot();assert(state.current);assert.match(state.current.regroup.reason,/ended/);f2.b.step();assert.equal(r2.idx,0);assert(f2.b.api.continueAlone().ok);
});
test('reload preserves earned stop but requires renewed readiness and accepts fresh observation sequence',t=>{
 const f=fixture(t),{a,b}=f.setup();f.depart(a,b);const saved=b.data();b.G.net.net.client.connected=false;f.advance(1000);const fresh=f.client('guest','guest',saved);for(const p of f.retained.values())if(p.m.id!=='guest')fresh.receive(p);assert(fresh.api.rejoin().ok);assert.equal(fresh.G.trail.ride.idx,1);
 f.arrive(a,fresh,1);assert.equal(fresh.G.trail.ride.idx,1);f.depart(a,fresh);assert.equal(fresh.G.trail.ride.idx,2);
});
test('group entry blocks conflicting activity and travel only until explicit leave',t=>{
 const f=fixture(t),{a,b}=f.setup();for(const k of ['activityGate','courseGate','travelGate'])assert.equal(b.emit(k,'test'),true);assert(b.api.leave().ok);f.flush();for(const k of ['activityGate','courseGate','travelGate'])assert.equal(b.emit(k,'test'),undefined);assert.equal(b.rewards.length,0);
});
test('club Cottonwood describes a trail, while solo expedition keeps its real parcel description',t=>{
 const f=fixture(t),a=f.client('host');assert.match(a.api.snapshot().routes.find(r=>r.id==='cottonwood').blurb,/Post Relay/);assert.doesNotMatch(a.api.snapshot().routes.find(r=>r.id==='cottonwood').blurb,/Collect Wren/);assert.match(EXPEDITIONS.find(r=>r.id==='cottonwood').blurb,/Collect Wren/);
});
test('protocol bounds reject rollback, substituted crew and malformed arrivals',()=>{
 const state={route:REGROUP_ROUTE,crew:['host','guest'],departures:[{index:0,token:'d1',at:1,ready:{host:'h1',guest:'g1'}}]};assert(regroupState(state,{status:'riding',hostId:'host'}));assert.equal(regroupState({...state,departures:[]},{status:'riding',hostId:'host',previous:state}),null);assert.equal(regroupState({...state,crew:['host','third']},{status:'riding',hostId:'host',previous:state}),null);
 const input={id:'guest',sid:'run',mode:REGROUP_MODE,route:REGROUP_ROUTE,rev:1,at:1000,x:0,z:5,speed:0,index:0,active:true,mounted:true,grounded:true,nonce:'ready'};assert(regroupInput(input,{sid:'run',memberId:'guest',now:1000}));for(const patch of [{x:NaN},{index:4},{at:99999},{nonce:'constructor'},{mode:'other'},{grounded:1}])assert.equal(regroupInput({...input,...patch},{sid:'run',memberId:'guest',now:1000}),null);
});

 test('ending or expiring a lobby without an active trail releases it for both riders',t=>{
 const f=fixture(t),a=f.client('host'),b=f.client('guest'),r=a.api.host('basin',{regroup:true});f.flush();b.api.join(r.id);f.flush();
 assert.match(a.api.snapshot().current.regroup.reason,/host start/);assert(a.api.cancel().ok);f.flush();assert.equal(a.api.snapshot().current,null);assert.equal(b.api.snapshot().current,null);
 assert(a.api.host('basin',{regroup:true}).ok);f.flush();f.advance(180001);assert.equal(a.api.snapshot().current,null);assert(a.api.host('basin',{regroup:true}).ok);assert.equal(a.rewards.length,0);
 });

test('viewing another live regroup lobby cannot erase the current rider Ready proof',t=>{
 const f=fixture(t),{a,b}=f.setup();assert(a.api.readyAtStop().ok);assert(b.api.readyAtStop().ok);f.flush();
 const other=f.client('third');assert(other.api.host('basin',{regroup:true}).ok);f.flush();
 for(let i=0;i<4;i++){assert.equal(a.api.snapshot().lobbies.length,2);assert.equal(a.api.snapshot().current.regroup.ready,true);assert.equal(b.api.snapshot().current.regroup.ready,true);}
 assert(a.api.continueTogether().ok);f.flush();a.step();b.step();assert.equal(a.G.trail.ride.idx,1);assert.equal(b.G.trail.ride.idx,1);
});

test('four-rider crew waits for all four, excludes fifth and permits a voluntary lobby replacement',t=>{
 const f=fixture(t),a=f.client('host'),b=f.client('guest'),c=f.client('third'),d=f.client('fourth'),e=f.client('fifth'),r=a.api.host('basin',{regroup:true});f.flush();
 for(const p of [b,c,d]){assert(p.api.join(r.id).ok);f.flush();assert(p.api.ready().ok);f.flush();}
 assert.equal(e.api.join(r.id).ok,false);assert(d.api.leave().ok);f.flush();assert(e.api.join(r.id).ok);f.flush();assert(e.api.ready().ok);f.flush();assert.equal(d.api.join(r.id).ok,false,'a former member cannot create a fifth active place');
 assert(a.api.start().ok);f.flush();for(const p of [b,c,e])assert(p.api.rejoin().ok);f.flush();
 for(const p of [a,b,c]){assert(p.api.readyAtStop().ok);f.flush();}assert.equal(a.api.continueTogether().ok,false);assert(e.api.readyAtStop().ok);f.flush();assert(a.api.continueTogether().ok);f.flush();
 for(const p of [a,b,c,e]){p.step();assert.equal(p.G.trail.ride.idx,1);}assert.equal(d.G.trail.ride,null);assert.equal(e.rewards.length,0);
});

test('lake-shore stops inside 8m can regroup, while ordinary 12m proximity alone cannot credit',t=>{
 const f=fixture(t),{a,b}=f.setup();f.depart(a,b);f.advance(1000);
 for(const c of [a,b]){c.position(30.5,16);c.step();assert.equal(c.G.trail.ride.idx,1);assert.equal(c.api.readyAtStop().ok,false);}
 for(const c of [a,b]){c.position(26.5,16);c.step();assert.equal(c.G.trail.ride.idx,1);assert.equal(c.api.snapshot().current.regroup.target.radius,8);}
 f.depart(a,b);assert.equal(a.G.trail.ride.idx,2);assert.equal(b.G.trail.ride.idx,2);assert.equal(a.rewards.length,0);
});

test('low-lift native jump frames cannot ready or consume an accepted departure',t=>{
 const f=fixture(t),{a,b}=f.setup();
 for(const [age,grounded,y]of [[0,true,0],[.95,false,.08],[null,false,.08]]){b.rig.heroJumpAge=age;b.rig.heroMotion.state.grounded=grounded;b.player.y=y;assert.equal(b.api.readyAtStop().ok,false);b.step();assert.equal(b.G.trail.ride.idx,0);}
 b.rig.heroJumpAge=null;b.rig.heroMotion.state.grounded=true;b.player.y=0;assert(a.api.readyAtStop().ok);assert(b.api.readyAtStop().ok);f.flush();assert(a.api.continueTogether().ok);f.flush();
 b.rig.heroJumpAge=.95;b.rig.heroMotion.state.grounded=false;b.player.y=.08;b.step();assert.equal(b.G.trail.ride.idx,0);a.step();
 b.rig.heroJumpAge=null;b.rig.heroMotion.state.grounded=true;b.player.y=0;b.step();assert.equal(b.G.trail.ride.idx,0,'landing does not restore expired Ready proof');assert(b.api.readyAtStop().ok);f.flush();b.step();assert.equal(b.G.trail.ride.idx,1);
});

function expiredGuest(f,{departAhead=false}={}){
 const {a,b,id}=f.setup();for(let i=0;i<2;i++){f.arrive(a,b,i);f.depart(a,b);}
 const packet=()=>{const p=f.retained.get('srf1/club-a/clubride2/session/'+id);return {topic:p.topic,m:copy(p.m)};};
 const saved=b.data(),oldPacket=packet();
 if(departAhead){f.arrive(a,b,2);assert(a.api.readyAtStop().ok);assert(b.api.readyAtStop().ok);f.flush();assert(a.api.continueTogether().ok);f.flush();a.step();f.flush();assert.equal(a.G.trail.ride.idx,3);assert.equal(b.G.trail.ride.idx,2);}
 b.G.net.net.client.connected=false;
 for(let i=0;i<91;i++){f.advance(2000);a.step(2);f.flush();}
 const livePacket=packet();
 assert(saved.clubRideResume.session.expiresAt<f.now());assert(livePacket.m.expiresAt>f.now());
 return {a,b,id,saved,oldPacket,livePacket};
}

test('expired saved lobby resumes only after fresh matching host evidence and an explicit local trail start',t=>{
 const f=fixture(t),{a,id,saved,oldPacket,livePacket}=expiredGuest(f),c=f.client('guest','guest',saved),spawn=copy(c.player);
 assert.equal(c.api.snapshot().current,null);c.receive(oldPacket);assert.equal(c.api.snapshot().current,null);assert.equal(c.api.rejoin().ok,false);
 const lowRevision=copy(livePacket);lowRevision.m.rev=saved.clubRideResume.session.rev-1;c.receive(lowRevision);assert.equal(c.api.snapshot().current,null);
 c.receive(livePacket);assert.equal(c.api.snapshot().current.id,id);assert.equal(c.api.snapshot().current.progress,2);assert.equal(c.api.snapshot().current.regroup.ready,false);assert.equal(c.G.trail.ride,null);assert.deepEqual(c.player,spawn);assert.equal(c.rewards.length,0);
 assert(c.api.rejoin().ok);assert.equal(c.G.trail.ride.idx,2);c.step();assert.equal(c.G.trail.ride.idx,2,'spawn proximity cannot replay the first two earned stops');assert.equal(c.api.readyAtStop().ok,false);
 f.flush();for(let i=2;i<4;i++){f.arrive(a,c,i);f.depart(a,c);}
 assert.equal(c.rewards.length,1);assert.equal(c.events.filter(e=>e==='trailStop').length,1);assert.equal(c.events.filter(e=>e==='trailDone').length,1);assert.equal(c.data().stats.trails,1);assert.equal(c.data().coins,300);
 const done=c.data();c.G.net.net.client.connected=false;const again=f.client('guest','guest',done);again.receive(livePacket);assert.equal(again.api.rejoin().ok,false);assert.equal(again.G.trail.ride,null);assert.equal(again.rewards.length,0);assert.equal(again.data().stats.trails,1);
});

test('stale-session resume rejects changed identity, crew, route, departure proof, finished and left history',t=>{
 const f=fixture(t),{saved,livePacket,id}=expiredGuest(f),mutations=[
  s=>s.clubRideResume.code='other',s=>s.clubRideResume.id='host-other',s=>s.clubRideResume.session.hostId='third',
  s=>s.clubRideResume.session.routeId='cottonwood',s=>s.clubRideResume.session.mode='unknown',s=>s.clubRideResume.session.createdAt--,
  s=>s.clubRideResume.session.planId='another-plan',s=>s.clubRideResume.session.regroup.crew.push('third'),
  s=>s.clubRideResume.session.regroup.departures[0].token='different-departure',
  s=>delete s.clubRideResume.session.regroup.departures[0].ready.guest,
  s=>{s.clubRideResume.participant.progress=3;s.clubRideHistory['club-a|'+id].progress=3;},
  s=>s.clubRideResume.participant.left=true,s=>s.clubRideResume.participant.finished=true,
  s=>s.clubRideHistory['club-a|'+id].finished=true,s=>s.clubRideHistory['club-a|'+id].progress=3
 ];
 for(const mutate of mutations){const initial=copy(saved);mutate(initial);const c=f.client('guest','guest',initial);c.receive(livePacket);assert.equal(c.api.snapshot().current,null,mutate.toString());assert.equal(c.api.rejoin().ok,false);assert.equal(c.G.trail.ride,null);assert.equal(c.rewards.length,0);c.G.net.net.client.connected=false;}
 const late=f.client('third');late.receive(livePacket);assert.equal(late.api.join(id).ok,false,'a genuinely new late joiner is still rejected');assert.equal(late.G.trail.ride,null);
});

test('a cancelled or wrong-room retained session cannot restore an expired saved participant',t=>{
 const f=fixture(t),{saved,livePacket}=expiredGuest(f),c=f.client('guest','guest',saved);
 c.receive({...livePacket,topic:livePacket.topic.replace('club-a','other')});assert.equal(c.api.snapshot().current,null);
 c.receive({...livePacket,m:{...livePacket.m,status:'cancelled'}});assert.equal(c.api.snapshot().current,null);assert.equal(c.api.rejoin().ok,false);assert.equal(c.G.trail.ride,null);assert.equal(c.rewards.length,0);
});

test('resumed saved progress behind the latest departure needs a fresh physical Ready acknowledgment',t=>{
 const f=fixture(t),{a,saved,livePacket}=expiredGuest(f,{departAhead:true}),c=f.client('guest','guest',saved);c.receive(livePacket);f.flush();assert(c.api.rejoin().ok);assert.equal(c.G.trail.ride.idx,2);assert.equal(a.G.trail.ride.idx,3);
 const p=EXPEDITIONS[0].stops[2];c.position(p[1],p[2]);c.step();f.flush();assert.equal(c.G.trail.ride.idx,2);assert.equal(c.api.snapshot().current.regroup.ready,false);assert.equal(c.rewards.length,0);
 assert(c.api.readyAtStop().ok);assert.equal(c.G.trail.ride.idx,2);c.step();assert.equal(c.G.trail.ride.idx,2,'local Ready alone cannot consume the stale saved nonce');
 f.flush();c.step();f.flush();assert.equal(c.G.trail.ride.idx,3);assert.equal(a.G.trail.ride.idx,3);assert.equal(c.events.filter(e=>e==='trailStop').length,1);assert.equal(c.rewards.length,0);c.step();assert.equal(c.G.trail.ride.idx,3);
});


test('a hydrated lobby that expires during disconnection keeps only its dormant resume proof',t=>{
 const f=fixture(t),{a,b,id}=f.setup();for(let i=0;i<2;i++){f.arrive(a,b,i);f.depart(a,b);}
 const saved=b.data();b.G.net.net.client.connected=false;f.advance(1000);const c=f.client('guest','guest',saved);assert.equal(c.api.snapshot().current.progress,2);assert.equal(c.G.trail.ride,null);c.G.net.net.client.connected=false;
 for(let i=0;i<91;i++){f.advance(2000);a.step(2);f.flush();}
 assert.equal(c.api.snapshot().current,null);assert.equal(c.api.rejoin().ok,false);assert.equal(c.G.trail.ride,null);assert.equal(c.data().clubRideResume.participant.progress,2);assert.equal(c.rewards.length,0);
 c.G.net.net.client.connected=true;c.emit('connect');assert.equal(c.api.snapshot().current,null);c.receive(f.retained.get('srf1/club-a/clubride2/session/'+id));assert.equal(c.api.snapshot().current.progress,2);assert.equal(c.G.trail.ride,null);assert(c.api.rejoin().ok);assert.equal(c.G.trail.ride.idx,2);assert.equal(c.api.snapshot().current.regroup.ready,false);assert.equal(c.rewards.length,0);
 assert(c.api.leave().ok);assert.equal(c.data().clubRideResume,null);assert.equal(c.G.trail.ride,null);c.receive(f.retained.get('srf1/club-a/clubride2/session/'+id));assert.equal(c.api.snapshot().current,null,'explicit leave cannot be undone by host heartbeat');
});

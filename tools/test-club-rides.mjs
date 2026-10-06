// Disposable local relay: no broker, browser, or real player save.
import assert from 'node:assert/strict';
import {install} from '../assets/features/club-rides.js';
import {install as installActivities} from '../assets/features/club-activities.js';
const copy=v=>JSON.parse(JSON.stringify(v));
let clock=1900000000000;const realNow=Date.now;Date.now=()=>clock;
const checks=[];
function check(label,fn){fn();checks.push(label);console.log('PASS '+label);}
function relay(){
 const clients=[],queue=[],retained=new Map(),sent=[];
 function flush(){let guard=0;while(queue.length){assert(++guard<1000,'relay settled');const {from,t,m}=queue.shift();for(const c of clients)if(c!==from&&c.G.net.net.client.connected&&c.G.net.net.club===t.split('/')[1])c.emit('message',t,copy(m));}}
 function client(pid,name,initial={}){
  let data={club:'club-a',blocked:{},...copy(initial)},starts=0;const hooks={},ensures=[];
  const c={pid,emit(k,...a){let result;for(const f of hooks[k]||[]){const v=f(...a);if(v&&result===undefined)result=v;}return result;},data:()=>copy(data)};
  const G={on(k,f){(hooks[k]||=[]).push(f);},run:(...args)=>c.emit(...args),save:{ensure(f){ensures.push(f);f(data);},fresh:()=>copy(data),sync(f){const s=copy(data);ensures.forEach(e=>e(s));f(s);data=s;}},
   clubs:{identity:s=>({code:(s||data).club}),canManage:()=>true,canManageName:()=>true},net:{net:{id:pid,club:data.club,client:{connected:true}},myName:()=>name,subscribe(){},publish(t,obj,opts){if(!G.net.net.client.connected)return false;const m={id:pid,n:name,...copy(obj)};sent.push({from:c,t,m});queue.push({from:c,t,m});if(opts?.retain)retained.set(t,{t,m});return true;}},
   social:{EXPEDITIONS:[{id:'basin',name:'Basin Circuit',blurb:'A shared morning ride.',stops:[['Ranch',0,0],['Lake',100,0],['Pasture',200,0]]},{id:'locked',name:'Mountain',stops:[['Ranch',0,0],['Summit',900,900]]}]},
   time:{isoWeekKey:()=> '2030-03-17'},money:{payReward(){throw Error('A lobby must never pay rewards');},refreshWallet(){}},toast(){},
   worldPkg:{lockedRegionsAt:(x)=>x>500?[{name:'Mountain'}]:[],lockText:()=> 'Unlock Mountain first.',vehicle:()=>null},
   horse:{player:{pos:{x:7,z:4},onFoot:false}},course:{get:()=>null},trail:{ride:null,arrow:{visible:false},start(pts,by,opts){starts++;this.ride={pts,by,idx:0,...opts};return true;}},hidePanels(){},riding:{releaseAll(){}},
  };c.G=G;c.api=()=>G.clubRides;c.starts=()=>starts;
  c.deliver=()=>{for(const {t,m}of retained.values())if(m.id!==pid&&t.split('/')[1]===G.net.net.club)c.emit('message',t,copy(m));};
  c.stopAt=n=>{assert(G.trail.ride);G.trail.ride.idx=n;c.emit(n===G.trail.ride.pts.length?'trailDone':'trailStop',G.trail.ride);if(n===G.trail.ride.pts.length)G.trail.ride=null;};
  installActivities(G);install(G);clients.push(c);return c;
 }
 return {client,flush,sent,queue,retained};
}
try{
 const bus=relay(),a=bus.client('pa','Alice'),b=bus.client('pb','Bob');let sid;
 check('Host publishes a real waiting session with intact sender identity',()=>{
  const r=a.api().host('basin');assert(r.ok);sid=r.id;bus.flush();
  assert.equal(b.api().snapshot().lobbies[0].id,sid);assert.equal(a.starts(),0);
  const packet=bus.sent.find(p=>p.t.includes('/session/'));assert.equal(packet.m.id,'pa');assert.equal(packet.m.hostId,'pa');
 });
 check('Join, ready and host start synchronize without moving or auto-starting guests',()=>{
  const pos=copy(b.G.horse.player.pos);assert(b.api().join(sid).ok);bus.flush();assert.equal(a.api().snapshot().current.canStart,false);
  assert.equal(a.api().start(sid).ok,false);assert(b.api().ready(true).ok);bus.flush();assert(a.api().start(sid).ok);bus.flush();
  assert.equal(a.starts(),1);assert.equal(b.starts(),0);assert.deepEqual(b.G.horse.player.pos,pos);assert.equal(b.api().snapshot().current.status,'riding');
  assert(b.api().rejoin().ok);assert.equal(b.starts(),1);assert.equal(b.G.trail.ride.exped,'basin');assert.equal(b.G.trail.ride.clubRideId,sid);
 });
 check('Real stops update independent progress; another ride packet cannot alter it',()=>{
  a.stopAt(1);bus.flush();const state=b.api().snapshot().current;
  assert.equal(state.progress,0);assert.equal(state.roster.find(p=>p.id==='pa').progress,1);
  b.emit('message','srf1/club-a/clubride2/rider/another-session/pa',{id:'pa',n:'Alice',rev:999,at:clock,progress:3,finished:true,ready:true,left:false});
  assert.equal(b.api().snapshot().current.roster.find(p=>p.id==='pa').progress,1);
 });
 check('Late rider receives retained session and voluntarily begins full route',()=>{
  const c=bus.client('pc','Cara');c.deliver();assert.equal(c.starts(),0);assert(c.api().join(sid).ok);bus.flush();
  assert.equal(c.starts(),1);assert.equal(c.api().snapshot().current.progress,0);assert.equal(a.api().snapshot().current.roster.length,3);
 });
 check('Duplicate and older participant revisions cannot roll progress backward',()=>{
  b.stopAt(2);bus.flush();const p=[...bus.sent].reverse().find(p=>p.from===b&&p.t.includes('/rider/'));
  a.emit('message',p.t,p.m);a.emit('message',p.t,{...p.m,rev:p.m.rev-1,progress:0});
  assert.equal(a.api().snapshot().current.roster.find(p=>p.id==='pb').progress,2);
  const s=bus.sent.find(p=>p.t.includes('/session/'));b.emit('message',s.t,s.m);assert.equal(b.api().snapshot().current.status,'riding');
 });
 check('Resume restores earned stop, and finish is durable across leave/reload',()=>{
  b.G.trail.ride=null;assert(b.api().rejoin().ok);assert.equal(b.G.trail.ride.idx,2);
  b.stopAt(3);bus.flush();assert(b.api().snapshot().current.finished);assert.equal(b.api().rejoin().ok,false);
  assert(b.api().leave().ok);bus.flush();const saved=b.data();b.G.net.net.client.connected=false;
  const reload=bus.client('pb','Bob',saved);reload.deliver();assert.equal(reload.api().join(sid).ok,false);assert.equal(reload.starts(),0);
 });
 check('Packets cannot finish or award the local rider',()=>{
  const p=[...bus.sent].reverse().find(p=>p.t.includes('/rider/'));
  a.emit('message',p.t.replace(/\/[^/]+$/,'/pa'),{...p.m,id:'pa',n:'Alice',rev:999,progress:3,finished:true});
  assert.equal(a.api().snapshot().current.progress,1);assert.equal(a.api().snapshot().current.finished,false);
 });
 check('Course, vehicle, unrelated trail and region unlock guards explain rejection',()=>{
  const x=bus.client('px','X');assert.match(x.api().host('locked').reason,/Mountain/);
  x.G.course.get=()=>({});assert.match(x.api().host('basin').reason,/event/);x.G.course.get=()=>null;
  x.G.worldPkg.vehicle=()=>({});assert.match(x.api().host('basin').reason,/vehicle/);x.G.worldPkg.vehicle=()=>null;
  x.G.trail.ride={idx:0};assert.match(x.api().host('basin').reason,/trail/);x.G.trail.ride=null;
  x.G.horse.player.onFoot=true;assert.match(x.api().host('basin').reason,/Mount/);
 });
 check('Offline and another room are never presented as connected club play',()=>{
  const x=bus.client('po','Offline');x.G.net.net.client.connected=false;assert(!x.api().snapshot().connected);assert.match(x.api().host('basin').reason,/Connect/);
  x.G.net.net.client.connected=true;x.G.net.net.club='meadowlark-commons';assert(!x.api().snapshot().connected);assert.match(x.api().host('basin').reason,/club room/);
 });
 check('Disconnect/reconnect preserves trail progress and refreshes presence',()=>{
  a.G.net.net.client.connected=false;assert(!a.api().snapshot().connected);a.stopAt(2);
  clock+=20000;a.G.net.net.client.connected=true;a.emit('connect');bus.flush();assert.equal(a.api().snapshot().current.progress,2);assert(a.api().snapshot().connected);
  const saved=a.data();assert(saved.clubRideResume.session.expiresAt>clock);
 });
 check('Club switch stops only the associated trail and rejects old-club packets',()=>{
  const old=bus.sent.find(p=>p.t.includes('/session/'));a.G.save.sync(s=>s.club='club-b');a.G.net.net.club='club-b';a.emit('clubChanged');
  assert.equal(a.G.trail.ride,null);a.emit('message',old.t,{...old.m,rev:999,at:clock,expiresAt:clock+180000});assert.equal(a.api().snapshot().lobbies.length,0);
 });
 check('Blocked host is hidden and expired host ends stale lobby without payouts',()=>{
  const x=bus.client('px2','Extra');x.deliver();x.G.save.sync(s=>s.blocked.Alice=true);assert.equal(x.api().snapshot().lobbies.length,0);
  const c=bus.client('pc2','Late');c.deliver();assert(c.api().join(sid).ok);clock+=180001;c.emit('tick',1);assert.equal(c.api().snapshot().current,null);assert.equal(c.G.trail.ride,null);
 });
 check('Host cancellation ends every joined client and old state cannot resurrect it',()=>{
  const b2=relay(),h=b2.client('ph','Host'),g=b2.client('pg','Guest'),r=h.api().host('basin');b2.flush();assert(g.api().join(r.id).ok);b2.flush();
  const old=b2.sent.find(p=>p.t.includes('/session/'));assert(h.api().cancel(r.id).ok);b2.flush();assert.equal(g.api().snapshot().current,null);
  g.emit('message',old.t,{...old.m,rev:999,at:clock,expiresAt:clock+180000});assert.equal(g.api().snapshot().lobbies.length,0);
 });
 check('Participant snapshots arriving first retain newest revision',()=>{
  const b2=relay(),h=b2.client('ph2','Host'),g=b2.client('pg2','Guest'),r=h.api().host('basin');const packets=b2.queue.splice(0),s=packets.find(p=>p.t.includes('/session/')),p=packets.find(p=>p.t.includes('/rider/'));
  g.emit('message',p.t,{...p.m,rev:3,ready:false});g.emit('message',p.t,{...p.m,rev:2,ready:true});g.emit('message',s.t,s.m);
  assert.equal(g.api().snapshot().lobbies[0].roster[0].ready,false);
 });
 check('Leave and reload preserves revision so peers immediately accept a rejoin',()=>{
  const b2=relay(),h=b2.client('ph3','Host'),g=b2.client('pg3','Guest'),r=h.api().host('basin');b2.flush();g.api().join(r.id);b2.flush();
  for(let n=0;n<8;n++)g.api().ready(n%2===0);b2.flush();g.api().leave();b2.flush();
  const before=g.data().clubRideHistory['club-a|'+r.id].rev;g.G.net.net.client.connected=false;
  const again=b2.client('pg3','Guest',g.data());again.deliver();assert(again.api().join(r.id).ok);assert(again.api().ready(true).ok);b2.flush();
  assert(again.data().clubRideHistory['club-a|'+r.id].rev>before);assert(h.api().snapshot().current.roster.find(p=>p.id==='pg3').ready);
 });
 check('Offline host cancellation is published on reconnect',()=>{
  const b2=relay(),h=b2.client('ph4','Host'),g=b2.client('pg4','Guest'),r=h.api().host('basin');b2.flush();g.api().join(r.id);b2.flush();
  h.G.net.net.client.connected=false;assert(h.api().cancel(r.id).ok);assert(g.api().snapshot().current);
  h.G.net.net.client.connected=true;h.emit('connect');b2.flush();assert.equal(g.api().snapshot().current,null);
 });
 check('Scheduled route and RSVP lead to a real waiting lobby and voluntary guest start',()=>{
  const b=relay(),h=b.client('plan-host','Host'),g=b.client('plan-guest','Guest');
  const p=h.G.clubActivities.schedule({title:'Sunset at the lake',startsAt:clock+60000,meetingPoint:'Ranch gate',routeId:'basin'});assert(p.ok);b.flush();
  const plan=g.G.clubActivities.snapshot().rides[0];assert.equal(plan.routeId,'basin');assert.equal(plan.routeName,'Basin Circuit');assert.equal(plan.creator,'plan-host');
  assert(g.G.clubActivities.rsvp(p.id).ok);b.flush();assert.equal(h.G.clubActivities.snapshot().rides[0].count,1);
  assert.equal(g.api().launchPlan(p.id).ok,false);const launch=h.api().launchPlan(p.id);assert(launch.ok);b.flush();
  assert.equal(g.api().forPlan(p.id).id,launch.id);assert.equal(g.api().forPlan(p.id).title,'Sunset at the lake');assert.equal(h.starts(),0);assert.equal(g.starts(),0);
  assert.equal(h.api().launchPlan(p.id).id,launch.id);assert.equal(h.api().snapshot().lobbies.length,1);
  assert(g.api().join(launch.id).ok);assert(g.api().ready().ok);b.flush();assert(h.api().start().ok);b.flush();assert.equal(g.starts(),0);
  assert(g.api().rejoin().ok);assert.equal(g.G.trail.ride.clubRideId,launch.id);assert.equal(g.G.trail.ride.name,'Sunset at the lake');
 });
 check('Linked lobby survives reload, cancel permits relaunch, and old packets cannot revive it',()=>{
  const b=relay(),h=b.client('reload-host','Host'),g=b.client('reload-guest','Guest');
  const p=h.G.clubActivities.schedule({title:'Basin plan',startsAt:clock+60000,meetingPoint:'Gate',routeId:'basin'});b.flush();const launch=h.api().launchPlan(p.id);b.flush();
  const first=b.sent.find(p=>p.t.includes('/session/'));h.G.net.net.client.connected=false;
  const again=b.client('reload-host','Host',h.data());assert.equal(again.api().forPlan(p.id).id,launch.id);assert.equal(again.api().launchPlan(p.id).id,launch.id);assert.equal(again.api().snapshot().lobbies.length,1);
  assert(again.api().cancel(launch.id).ok);b.flush();assert.equal(g.api().forPlan(p.id),null);
  g.emit('message',first.t,{...first.m,rev:999});assert.equal(g.api().forPlan(p.id),null);
  const next=again.api().launchPlan(p.id);assert(next.ok);assert.notEqual(next.id,launch.id);b.flush();assert.equal(g.api().forPlan(p.id).id,next.id);
  assert(g.api().join(next.id).ok);b.flush();assert(again.G.clubActivities.cancel(p.id).ok);b.flush();assert.equal(again.api().launchPlan(p.id).ok,false);
  assert(again.api().cancel(next.id).ok);b.flush();assert.equal(g.api().snapshot().current,null,'calendar cancellation must not hide a later live-lobby cancellation');
 });
 check('Plan route validation preserves free-text plans and handles retained delivery order',()=>{
  const b=relay(),h=b.client('ordered-host','Host'),g=b.client('ordered-guest','Guest');
  assert.equal(h.G.clubActivities.schedule({title:'Bad route',startsAt:clock+60000,meetingPoint:'Gate',routeId:'missing'}).ok,false);
  const free=h.G.clubActivities.schedule({title:'Old free-text ride',startsAt:clock+60000,meetingPoint:'Gate'});assert(free.ok);assert.equal(h.api().launchPlan(free.id).ok,false);
  const p=h.G.clubActivities.schedule({title:'Planned trail',startsAt:clock+60000,meetingPoint:'Gate',routeId:'basin'});assert(p.ok);
  const launch=h.api().launchPlan(p.id);assert(launch.ok);const queued=b.queue.splice(0),session=queued.find(p=>p.t.includes('/session/')),planned=queued.find(q=>q.t.endsWith('/clubrides/'+p.id));
  g.emit('message',session.t,session.m);assert.equal(g.api().forPlan(p.id),null);g.emit('message',planned.t,planned.m);assert.equal(g.api().forPlan(p.id).id,launch.id);
  const before=g.G.clubActivities.snapshot().rides[0];g.emit('message',planned.t,{...planned.m,revision:99,routeId:'missing'});assert.deepEqual(g.G.clubActivities.snapshot().rides[0],before);
  g.emit('message',session.t,{...session.m,rev:99,planId:'constructor'});assert.equal(g.api().forPlan(p.id).id,launch.id);
  g.emit('message',session.t.replace(launch.id,'imposter-session'),{...session.m,id:'imposter',hostId:'imposter'});assert.equal(g.api().snapshot().lobbies.length,1);
  assert(h.G.clubActivities.schedule({id:p.id,title:'Updated plan',startsAt:clock+120000,meetingPoint:'Gate'}).ok);assert.equal(h.G.clubActivities.snapshot().rides.find(r=>r.id===p.id).routeId,'basin');
 });
 check('Live adventures, drill, flight and locked routes reject launch before lobby mutation',()=>{
  const b=relay(),h=b.client('busy-host','Host'),p=h.G.clubActivities.schedule({title:'Later',startsAt:clock+60000,meetingPoint:'Gate',routeId:'basin'});assert(p.ok);
  const guards=[['rescue',()=>h.G.rescueRide={snapshot:()=>({active:{}})},()=>h.G.rescueRide=null],['roundup',()=>h.G.roundup={state:()=>({active:true})},()=>h.G.roundup=null],['drill',()=>h.G.course.drillActive=()=>true,()=>h.G.course.drillActive=()=>false],['Land',()=>h.G.horse.player.flying=true,()=>h.G.horse.player.flying=false],['trail',()=>h.G.trail.ride={idx:0},()=>h.G.trail.ride=null]];
  for(const [reason,on,off]of guards){on();const r=h.api().launchPlan(p.id);assert.equal(r.ok,false);assert.match(r.reason,new RegExp(reason));assert.equal(h.api().host('basin').ok,false);assert.equal(h.api().snapshot().lobbies.length,0);off();}
  h.G.worldPkg.lockedRegionsAt=()=>[{}];assert.equal(h.api().launchPlan(p.id).ok,false);assert.equal(h.api().snapshot().lobbies.length,0);
 });
 console.log('\n'+checks.length+' club ride checks passed.');
}finally{Date.now=realNow;}

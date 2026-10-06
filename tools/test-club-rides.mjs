// Disposable local relay: no broker, browser, or real player save.
import assert from 'node:assert/strict';
import {install} from '../assets/features/club-rides.js';
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
   clubs:{identity:s=>({code:(s||data).club})},net:{net:{id:pid,club:data.club,client:{connected:true}},myName:()=>name,subscribe(){},publish(t,obj,opts){if(!G.net.net.client.connected)return false;const m={id:pid,n:name,...copy(obj)};sent.push({from:c,t,m});queue.push({from:c,t,m});if(opts?.retain)retained.set(t,{t,m});return true;}},
   social:{EXPEDITIONS:[{id:'basin',name:'Basin Circuit',blurb:'A shared morning ride.',stops:[['Ranch',0,0],['Lake',100,0],['Pasture',200,0]]},{id:'locked',name:'Mountain',stops:[['Ranch',0,0],['Summit',900,900]]}]},
   worldPkg:{lockedRegionsAt:(x)=>x>500?[{name:'Mountain'}]:[],lockText:()=> 'Unlock Mountain first.',vehicle:()=>null},
   horse:{player:{pos:{x:7,z:4},onFoot:false}},course:{get:()=>null},trail:{ride:null,arrow:{visible:false},start(pts,by,opts){starts++;this.ride={pts,by,idx:0,...opts};return true;}},hidePanels(){},riding:{releaseAll(){}},
  };c.G=G;c.api=()=>G.clubRides;c.starts=()=>starts;
  c.deliver=()=>{for(const {t,m}of retained.values())if(m.id!==pid&&t.split('/')[1]===G.net.net.club)c.emit('message',t,copy(m));};
  c.stopAt=n=>{assert(G.trail.ride);G.trail.ride.idx=n;c.emit(n===G.trail.ride.pts.length?'trailDone':'trailStop',G.trail.ride);if(n===G.trail.ride.pts.length)G.trail.ride=null;};
  install(G);clients.push(c);return c;
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
 console.log('\n'+checks.length+' club ride checks passed.');
}finally{Date.now=realNow;}

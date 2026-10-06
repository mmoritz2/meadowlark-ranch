import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {install,friendInteractionCheck,friendJoinPlan,validFriendName,socialActivityReason} from '../assets/features/club-friends.js';

// Exercise the actual social handshake functions with a fake transport. No
// browser, public broker, account, or real rider is contacted by this test.
const source=readFileSync(new URL('../assets/features/social-play.js',import.meta.url),'utf8');
const handshake=source.slice(source.indexOf(' function sendFriend('),source.indexOf(' /* ======================= 7.'));
function rider(name='Ada',id='ada'){
 const save={friends:{},friendReq:{in:{},out:{}},blocked:{},tempMute:{}},events=new Map(),outbox=[],toasts=[];
 const state={course:null,vehicle:null,locked:false,water:false,solid:false,released:0,reset:0,traveled:0,changed:0,members:[]};
 const G={save:{fresh:()=>structuredClone(save),sync:fn=>fn(save)},net:{SOCIAL:true,net:{id,club:'riding-room',client:{connected:true}},remotes:{},myName:()=>name},
  world:{groundH:()=>0,regionAt:()=>({id:'meadow',name:'Home Meadow'}),colliders:[],walls:[],solidWorld:{updateDynamic(){},resolve:()=>state.solid?1:0}},
  worldPkg:{vehicle:()=>state.vehicle,lockedRegionsAt:()=>state.locked?[{id:'locked'}]:[],regionUnlocked:()=>!state.locked,lockText:()=> 'Unlock this region first.'},
  onFoot:{waterAt:()=>state.water?{depth:1}:null},horse:{player:{pos:{x:0,y:0,z:0,set(x,y,z){Object.assign(this,{x,y,z});}},speed:5,y:0,vy:0}},
  course:{get:()=>state.course,drillActive:()=>state.drill},rescueRide:{snapshot:()=>({active:state.rescue})},roundup:{state:()=>({active:state.roundup})},trail:{ride:null},riding:{releaseAll(){state.released++;}},followCam:{reset(){state.reset++;}},
  clubs:{memberRows:()=>state.members},sChime(){},toast:t=>toasts.push(t),quest:{dailyEvt(){state.traveled++;}},
  on(key,fn){if(!events.has(key))events.set(key,[]);events.get(key).push(fn);return fn;},
  run(key,...args){if(key==='clubFriendsChanged')state.changed++;for(const fn of events.get(key)||[])fn(...args);},
 };
 G.net.publish=(_topic,extra)=>{if(!G.net.net.client.connected)return false;outbox.push({id,n:name,...structuredClone(extra)});return true;};
 const api=new Function('G','S','N','H','Q','toast','me','ping','friendsOf','FRIEND_MAX','refreshOnline','now','nm14','isMuted','regionName','validFriendName','friendInteractionCheck','friendJoinPlan',handshake+'\nreturn {sendFriend,declineFriend,gotoFriend,onFriendMsg};')(
  G,G.save,G.net,G.horse,G.quest,G.toast,()=>name,extra=>G.net.publish('chat',extra),s=>Object.keys(s.friends||{}),50,()=>{},Date.now,v=>String(v||'').slice(0,14),(s,n)=>!!s.blocked[n]||s.tempMute[n]>Date.now(),()=> 'Home Meadow',validFriendName,friendInteractionCheck,friendJoinPlan);
 G.social={...api,FRIEND_MAX:50};install(G);
 function see(other,x=10,z=10){const remote={name:other.name,x,z,lastSeen:0,heading:0,y:0};G.net.remotes[other.id]=remote;G.run('remote',{},remote);return remote;}
 return {name,id,G,save,state,outbox,toasts,see,receive:m=>api.onFriendMsg(m,m.n)};
}
function pair(){const a=rider(),b=rider('Bea','bea');a.see(b);b.see(a);return {a,b};}

test('two real handshake endpoints request, accept, remove through the helper',()=>{
 const {a,b}=pair();assert.deepEqual(a.G.clubFriends.request('Bea'),{ok:true});
 assert.ok(a.save.friendReq.out.Bea);assert.equal(a.save.friends.Bea,undefined);
 b.receive(a.outbox.shift());assert.ok(b.save.friendReq.in.Ada);
 assert.deepEqual(b.G.clubFriends.accept('Ada'),{ok:true});a.receive(b.outbox.shift());
 assert.equal(a.save.friends.Bea,true);assert.equal(b.save.friends.Ada,true);
 assert.equal(a.save.friendReq.out.Bea,undefined);assert.equal(b.save.friendReq.in.Ada,undefined);
 assert.deepEqual(a.G.clubFriends.remove('Bea'),{ok:true});b.receive(a.outbox.shift());
 assert.equal(a.save.friends.Bea,undefined);assert.equal(b.save.friends.Ada,undefined);
});
test('unsolicited acceptance and acceptance with no request do not create friendships',()=>{
 const {a}=pair();a.receive({n:'Bea',fr:{k:'acc',to:'Ada'}});
 assert.equal(a.save.friends.Bea,undefined);assert.equal(a.G.clubFriends.accept('Bea').ok,false);assert.equal(a.outbox.length,0);
});
test('offline acceptance preserves the pending request instead of claiming delivery',()=>{
 const {a}=pair();a.save.friendReq.in.Bea=Date.now();a.G.net.net.client.connected=false;
 assert.equal(a.G.clubFriends.accept('Bea').ok,false);assert.ok(a.save.friendReq.in.Bea);assert.equal(a.save.friends.Bea,undefined);assert.equal(a.outbox.length,0);
 assert.equal(a.G.clubFriends.decline('Bea').ok,true);assert.equal(a.save.friendReq.in.Bea,undefined);
});
test('blocked and muted riders cannot request, accept, or join',()=>{
 const {a}=pair();a.save.friendReq.in.Bea=Date.now();a.save.blocked.Bea=1;
 for(const op of ['request','accept','join'])assert.equal(a.G.clubFriends[op]('Bea').ok,false);
 delete a.save.blocked.Bea;a.save.tempMute.Bea=Date.now()+60000;
 for(const op of ['request','accept','join'])assert.equal(a.G.clubFriends[op]('Bea').ok,false);
 assert.equal(a.outbox.length,0);assert.equal(a.state.traveled,0);
});
test('capacity is enforced for outgoing and incoming acceptance',()=>{
 const {a}=pair();for(let i=0;i<50;i++)a.save.friends['Rider'+i]=true;a.save.friendReq.in.Bea=Date.now();
 assert.equal(a.G.clubFriends.accept('Bea').ok,false);assert.equal(a.G.clubFriends.request('Bea').ok,false);
 a.save.friendReq.out.Bea=Date.now();a.receive({n:'Bea',fr:{k:'acc',to:'Ada'}});
 assert.equal(Object.keys(a.save.friends).length,50);assert.equal(a.save.friends.Bea,undefined);
});
test('stale and disconnected remotes are not shown as online or joinable',()=>{
 const {a}=pair();a.save.friends.Bea=true;
 a.state.members=[{id:'bea',name:'Bea',online:true,last:Date.now()}];a.G.net.remotes.bea.lastSeen=7;
 let row=a.G.clubFriends.snapshot().friends[0];assert.equal(row.online,false);assert.equal(row.canJoin,false);
 assert.equal(a.G.clubFriends.snapshot().clubmates[0].online,false);
 a.G.net.remotes.bea.lastSeen=0;a.G.net.net.client.connected=false;
 assert.equal(a.G.clubFriends.snapshot().connected,false);assert.equal(a.G.clubFriends.join('Bea').ok,false);
});
test('wall clock expiry handles paused game ticks, and a fresh packet restores presence',()=>{
 const original=Date.now;let now=original();Date.now=()=>now;
 try{const {a}=pair();a.save.friends.Bea=true;assert.equal(a.G.clubFriends.snapshot().friends[0].online,true);now+=7100;
  assert.equal(a.G.clubFriends.snapshot().friends[0].online,false);
  a.G.run('remote',{},a.G.net.remotes.bea);assert.equal(a.G.clubFriends.snapshot().friends[0].online,true);
 }finally{Date.now=original;}
});
test('room changes cannot reuse presence from the previous club',()=>{
 const {a}=pair();a.save.friends.Bea=true;a.G.net.net.club='other-room';
 assert.equal(a.G.clubFriends.snapshot().friends[0].online,false);assert.equal(a.G.clubFriends.join('Bea').ok,false);
});
test('duplicate live names and mismatching roster IDs never select a rider by accident',()=>{
 const {a}=pair();a.save.friends.Bea=true;a.see({id:'imposter',name:'Bea'});
 assert.equal(a.G.clubFriends.join('Bea').ok,false);assert.equal(a.G.clubFriends.request('Bea').ok,false);
 assert.equal(a.G.clubFriends.snapshot().friends[0].online,false);
 delete a.G.net.remotes.imposter;a.state.members=[{id:'other-id',name:'Bea'}];
 assert.equal(a.G.clubFriends.snapshot().clubmates[0].online,false);
});
test('join rejects locked regions, courses, vehicles and airborne riders',()=>{
 const {a}=pair(),p=a.G.horse.player,before={...p.pos};
 for(const prop of ['course','vehicle','locked']){a.state[prop]=true;assert.equal(a.G.clubFriends.join('Bea').ok,false);a.state[prop]=false;}
 p.flying=true;assert.equal(a.G.clubFriends.join('Bea').ok,false);p.flying=false;
 a.G.net.remotes.bea.crs=['Event'];assert.equal(a.G.clubFriends.join('Bea').ok,false);a.G.net.remotes.bea.crs=null;
 a.G.net.remotes.bea.fly=true;assert.equal(a.G.clubFriends.join('Bea').ok,false);
 assert.equal(p.pos.x,before.x);assert.equal(p.pos.z,before.z);assert.equal(a.state.traveled,0);
});
test('join tests clear dry ground before moving, then releases controls and resets camera',()=>{
 const {a}=pair();a.G.world.colliders=[{x:10,z:13,r:2}];
 assert.equal(a.G.clubFriends.join('Bea').ok,true);const p=a.G.horse.player;
 assert.ok(Math.hypot(p.pos.x-10,p.pos.z-13)>=3);assert.equal(p.speed,0);
 assert.equal(a.state.released,1);assert.equal(a.state.reset,1);assert.equal(a.state.traveled,1);
});
test('spectating and ranch tours prevent joining until their camera activity ends',()=>{
 const {a}=pair();a.save.friends.Bea=true;a.G.run('tick',1);
 for(const mode of ['spectate','tour']){
  const before=a.state.changed;a.G.social[mode]={};a.G.run('tick',1);
  assert.ok(a.state.changed>before);
  assert.equal(a.G.clubFriends.snapshot().friends[0].canJoin,false);
  assert.deepEqual(a.G.clubFriends.join('Bea'),{ok:false,reason:'Leave spectating or the ranch tour first.'});
  assert.equal(a.G.horse.player.pos.x,0);assert.equal(a.G.horse.player.pos.z,0);assert.equal(a.state.traveled,0);
  delete a.G.social[mode];const during=a.state.changed;a.G.run('tick',1);
  assert.ok(a.state.changed>during);assert.equal(a.G.clubFriends.snapshot().friends[0].canJoin,true);
 }
 assert.equal(a.G.clubFriends.join('Bea').ok,true);
});
test('no water, wall, solid geometry, steep terrain or non-finite destination is accepted',()=>{
 const {a}=pair();a.state.water=true;assert.equal(a.G.clubFriends.join('Bea').ok,false);a.state.water=false;
 a.state.solid=true;assert.equal(a.G.clubFriends.join('Bea').ok,false);a.state.solid=false;
 a.G.world.groundH=(x,z)=>x*2;assert.equal(a.G.clubFriends.join('Bea').ok,false);a.G.world.groundH=()=>0;
 a.G.world.walls=Array.from({length:21},(_,i)=>({x1:0,z1:i,x2:20,z2:i}));assert.equal(a.G.clubFriends.join('Bea').ok,false);a.G.world.walls=[];
 a.G.net.remotes.bea.x=NaN;assert.equal(a.G.clubFriends.join('Bea').ok,false);assert.equal(a.state.traveled,0);
});
test('invalid identities and self requests do not write or publish',()=>{
 const {a}=pair();for(const name of ['Ada','__proto__','constructor',' Bea','Bea\n','a'.repeat(15)])assert.equal(a.G.clubFriends.request(name).ok,false);
 assert.equal(a.outbox.length,0);assert.deepEqual(a.save.friendReq,{in:{},out:{}});
});
test('request and presence changes emit UI refresh events without publishing automatically',()=>{
 const {a}=pair();a.G.run('tick',1);const before=a.state.changed;a.G.net.net.client.connected=false;a.G.run('tick',1);
 assert.ok(a.state.changed>before);assert.equal(a.outbox.length,0);
});

test('active adventures disable friend travel visibly and cannot be interrupted',()=>{
 const {a}=pair();a.save.friends.Bea=true;
 for(const activity of ['rescue','roundup','drill','trail']){
  if(activity==='trail')a.G.trail.ride={clubRideId:'real-party'};else a.state[activity]=true;
  const before=a.state.changed;a.G.run('tick',1);assert(a.state.changed>before);
  const row=a.G.clubFriends.snapshot().friends[0];assert.equal(row.canJoin,false);assert.match(row.reason,new RegExp(activity));
  assert.equal(a.G.clubFriends.join('Bea').ok,false);assert.equal(a.G.social.gotoFriend('Bea').ok,false);assert.equal(a.state.traveled,0);assert.equal(a.G.horse.player.pos.x,0);
  if(activity==='trail')a.G.trail.ride=null;else a.state[activity]=false;
 }
 assert.equal(a.G.clubFriends.snapshot().friends[0].canJoin,true);
});
test('spectate and ranch tour guard actual entry functions before camera or position mutations',()=>{
 const {a}=pair(),G=a.G;
 const spec=source.slice(source.indexOf(' function startSpectate('),source.indexOf(' function stopSpectate('));
 const tour=source.slice(source.indexOf(' function startTour('),source.indexOf(' function endTour('));
 let touched=0;const player={get speed(){return 0;},set speed(v){touched++;},pos:{x:0,z:0}};
 const W={buildDecorMesh(){touched++;throw Error('tour should have been blocked');}};
 const startSpec=Function('G','H','toast','socialActivityReason','N','drawSpecHud','stat','Q','let spec;'+spec+';return startSpectate;')(G,{player},()=>{},socialActivityReason,{},()=>touched++,()=>touched++,{dailyEvt:()=>touched++});
 const startTour=Function('G','H','W','ranchData','toast','socialActivityReason','endTour','TOUR',tour+';return startTour;')(G,{player},W,{Bea:{d:[[1]]}},()=>{},socialActivityReason,()=>touched++,[0,0]);
 for(const activity of ['rescue','roundup','drill','trail']){
  if(activity==='trail')G.trail.ride={clubRideId:'party'};else a.state[activity]=true;
  startSpec('bea');startTour('Bea');assert.equal(touched,0);
  if(activity==='trail')G.trail.ride=null;else a.state[activity]=false;
 }
});

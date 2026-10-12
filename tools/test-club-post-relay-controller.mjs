import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as protocol from '../assets/club-post-relay-protocol.mjs';
import {COTTONWOOD_ROUTES} from '../assets/cottonwood-routes.mjs';

// Exercise installed production hooks with independent clients, clocks and saves.
// Only transport, player observations, storage and the managed trail surface are fake.
const source=fs.readFileSync(new URL('../assets/features/club-post-relay.js',import.meta.url),'utf8');
const production=source.replace(/^import .*;\n/gm,'').replace('export const id=','const id=').replace('export function install(G)','function install(G)');
const clone=v=>structuredClone(v),startTime=1791569000000;
const WREN={x:-11,z:-15.8},PINES={x:-30,z:-58},ADA={x:39,z:-39};
function relay(){
 let now=startTime;const clients=new Map(),queue=[],packets=[],retained=new Map();
 const matches=(topic,filter)=>filter.endsWith('/#')?topic.startsWith(filter.slice(0,-1)):topic===filter;
 const bus={clients,queue,packets,retained,get now(){return now;},advance(ms){now+=ms;},flush(){let count=0;while(queue.length){assert(++count<1000,'queued messages must settle');const packet=queue.shift();if(packet.to.G.net.net.client.connected&&!bus.drop?.(packet))bus.deliver(packet.to,packet.topic,packet.payload);}},deliver(to,topic,payload){to.G.run('message',topic,clone(payload));}};
 bus.client=(id,{code='CLUB',joined=true,known=true,seedSave=null}={})=>{
  const trace={events:[],starts:[],stops:[],writes:0,release:0,subscriptionRequests:[],managedFinishes:0},hooks=new Map(),subscriptions=new Set(),classes=new Set();
  let course=null,writeFailure=false,readFailure=false,readAfterWrite=false;
  let saved=seedSave?clone(seedSave):{coins:100,gems:7,keys:2,pass:{pts:20},xp:31,level:4,inventory:{apple:3},trailBest:{cottonwood:12},clubPostRelayRecords:{},clubRecords:{[code]:{members:{}}}};
  const identity={code,founder:'Host rider',founderId:'host',pendingJoin:false,canCreate:!joined};if(!joined)identity.founder='';
  const fresh=()=>readFailure?null:clone(saved);
  const document={hidden:false,body:{classList:{contains:key=>classes.has(key)}}};
  const rig={ready:true,heroMotion:{state:{}},profile:{nativeBreed:true,nativeJump:true}};
  const G={save:{ensure(fn){fn(saved);},fresh,sync(fn){const next=clone(saved);fn(next);if(!writeFailure){saved=next;trace.writes++;if(readAfterWrite)readFailure=true;}}},
   clubs:{identity:()=>identity,memberRows:()=>Object.entries(saved.clubRecords[identity.code]?.members||{}).filter(([,r])=>!r.left).map(([id])=>({id}))},
   net:{net:{id,club:code,client:{connected:true}},myName:()=>id,
    subscribe(topic){trace.subscriptionRequests.push(topic);subscriptions.add(topic);for(const [t,payload]of retained)if(matches(t,topic))queue.push({to:client,topic:t,payload:clone(payload)});},
    publish(topic,payload,options){if(!G.net.net.client.connected)return false;const data={id,n:id,...clone(payload)};packets.push({from:id,topic,payload:clone(data),options:clone(options||{})});if(options?.retain)retained.set(topic,clone(data));for(const c of clients.values())if([...c.subscriptions].some(f=>matches(topic,f)))queue.push({to:c,topic,payload:clone(data)});return true;}},
   on(event,fn){const list=hooks.get(event)||[];list.push(fn);hooks.set(event,list);},
   run(event,...args){trace.events.push({event,args:clone(args)});let result;for(const fn of hooks.get(event)||[]){const r=fn(...args);if(r!==undefined)result=r;}return result;},
   horse:{player:{pos:{...WREN},speed:0,onFoot:false,flying:false,landing:false,y:0},RIG:()=>rig},course:{get:()=>course,drillActive:()=>false},rescueRide:{snapshot:()=>({active:false})},roundup:{state:()=>({active:false})},clubHerd:{snapshot:()=>({current:null})},clubRides:{snapshot:()=>({current:null})},worldPkg:{vehicle:()=>null},world:{npcList:[]},
   social:{EXPEDITIONS:[{id:'cottonwood',stops:[['Wren',WREN.x,WREN.z],['Pines',PINES.x,PINES.z],['Ada',ADA.x,ADA.z]]}]},
   cam:{isFree:()=>classes.has('freecam')},input:{blocked:()=>false},riding:{releaseAll(){trace.release++;}},hidePanels(){},seFrame:{settle(){}},toast(){}};
  G.trail={ride:null,start(pts,by,opts){if(G.run('activityGate','trail')||!pts||pts.length<2)return false;if(this.ride&&!this.stop())return false;const r={pts:clone(pts),idx:0,by,t:0,roster:{},...clone(opts)};this.ride=r;trace.starts.push(clone(r));G.run('trailStart',r);return this.ride===r;},
   stop(){const r=this.ride;if(!r)return true;trace.stops.push(clone(r));if(G.run('trailCancel',r)===true)return false;if(this.ride===r)this.ride=null;return true;},
   finishUnrewardedManaged(r){if(!r||r!==this.ride||r.managed!=='club-post-relay'||!r.clubPostRelayId||r.finishNotified||r.idx!==r.pts.length||G.run('unrewardedTrailFinishReady',r)!==true)return false;r.finishNotified=true;G.riding.releaseAll();this.ride=null;trace.managedFinishes++;G.run('unrewardedTrailFinished',r);return true;}};
  const client={id,G,rig,trace,document,classes,subscriptions,identity,get save(){return clone(saved);},set busy(v){course=v?{}:null;},set writeFailure(v){writeFailure=v;},set readFailure(v){readFailure=v;},set readAfterWrite(v){readAfterWrite=v;},edit(fn){fn(saved);},tick(){G.run('tick',.15);},snapshot(){return G.clubPostRelay.snapshot();},current(){return this.snapshot().current;}};
  clients.set(id,client);if(known)for(const c of clients.values()){c.edit(s=>{s.clubRecords[code]??={members:{}};s.clubRecords[code].members[id]={name:id};});client.edit(s=>{for(const other of clients.keys())s.clubRecords[code].members[other]={name:other};});}
  const Clock=class extends Date{static now(){return now;}};
  const install=Function(...Object.keys(protocol),'COTTONWOOD_ROUTES','Date','document',production+';return install;')(...Object.values(protocol),COTTONWOOD_ROUTES,Clock,document);install(G);return client;
 };
 return bus;
}
function pair(){const b=relay(),h=b.client('host'),g=b.client('guest');return {b,h,g};}
function lobby(f){assert.equal(f.h.G.clubPostRelay.host().ok,true);f.b.flush();const sid=f.h.current().id;assert.equal(f.g.G.clubPostRelay.join(sid).ok,true);f.b.flush();return sid;}
function riding(f,{firstId='host'}={}){const sid=lobby(f);assert.equal(f.g.G.clubPostRelay.ready().ok,true);f.b.flush();assert.equal(f.h.G.clubPostRelay.start({firstId}).ok,true);f.b.flush();return sid;}
function tickBoth(f,ms=151){f.b.advance(ms);f.g.tick();f.b.flush();f.h.tick();f.b.flush();}
function gathered(f){tickBoth(f);assert.equal(f.h.current().startupWaiting,false);assert.equal(f.g.current().startupWaiting,false);}
const currentStage=(f,stage)=>{assert.equal(f.h.current()?.stage,stage,'host stage');assert.equal(f.g.current()?.stage,stage,'guest stage');};
function action(f,c,expected){const context=c.G.clubPostRelay.context();assert.equal(context?.action,expected,JSON.stringify(context));assert.equal(context.eligible,true,JSON.stringify(context));const result=c.G.clubPostRelay.interact();assert.equal(result.ok,true,JSON.stringify(result));f.b.flush();}
// Continuous observation steps never exceed 3 m per 151 ms, inside production
// continuity thresholds. The public API determines every stage and handoff.
function move(f,riders,to){const starts=riders.map(c=>({...c.G.horse.player.pos}));const steps=Math.max(1,...starts.map(p=>Math.ceil(Math.hypot(to.x-p.x,to.z-p.z)/3)));for(let i=1;i<=steps;i++){riders.forEach((c,j)=>{c.G.horse.player.pos={x:starts[j].x+(to.x-starts[j].x)*i/steps,z:starts[j].z+(to.z-starts[j].z)*i/steps};c.G.horse.player.speed=18;});tickBoth(f);}for(const c of riders)c.G.horse.player.speed=0;tickBoth(f);}
function path(f,riders,points){for(const [x,z]of points)move(f,riders,{x,z});}
function firstAndOther(f){return f.h.current().firstId===f.h.id?[f.h,f.g]:[f.g,f.h];}
function atFirstHandoff(f){gathered(f);const [first]=firstAndOther(f);action(f,first,'collect');currentStage(f,'outbound');path(f,[f.h,f.g],COTTONWOOD_ROUTES.out);currentStage(f,'passPost');}
function firstHandoff(f){const [first,other]=firstAndOther(f);action(f,first,'offer');assert.equal(f.h.current().handoffs,0);currentStage(f,'passPost');action(f,other,'accept');currentStage(f,'deliver');assert.equal(f.h.current().handoffs,1);}
function beforeHome(f){atFirstHandoff(f);firstHandoff(f);const [first,other]=firstAndOther(f);path(f,[other],COTTONWOOD_ROUTES.road);action(f,other,'exchange');currentStage(f,'backToPines');path(f,[other],[...COTTONWOOD_ROUTES.road].reverse());currentStage(f,'passReply');action(f,other,'offer');action(f,first,'accept');currentStage(f,'home');assert.equal(f.h.current().handoffs,2);}
function beforeFinish(f){beforeHome(f);const [first]=firstAndOther(f);path(f,[first],[...COTTONWOOD_ROUTES.out].reverse());move(f,[first],WREN);}
function complete(f){beforeFinish(f);action(f,firstAndOther(f)[0],'return');currentStage(f,'finished');}
const protectedSave=s=>Object.fromEntries(Object.entries(s).filter(([key])=>key!=='clubPostRelayRecords'));
const forbidden=c=>c.trace.events.filter(e=>['trailDone','postFinish','expeditionDone','rallyCredit'].includes(e.event));

test('two riders explicitly ready and start; the host waits for fresh guest observations before collection',()=>{
 const f=pair();lobby(f);assert.equal(f.h.trace.starts.length,0);assert.equal(f.g.trace.starts.length,0);assert.equal(f.h.G.clubPostRelay.start().ok,false);assert.equal(f.g.G.clubPostRelay.ready().ok,true);f.b.flush();assert.equal(f.h.G.clubPostRelay.start().ok,true);f.b.flush();
 for(const c of [f.h,f.g]){assert.equal(c.trace.starts.length,1);assert.equal(c.G.trail.ride.managed,'club-post-relay');assert.equal(c.current().startupWaiting,true);assert.equal(c.G.clubPostRelay.interact().ok,false);}
 f.h.tick();f.b.flush();assert.equal(f.h.current().startupWaiting,true);assert.equal(f.h.current().stage,'collect');gathered(f);assert.equal(f.h.G.clubPostRelay.context().eligible,true);
});

test('real ride completes two explicit handoffs and both couriers record once with no economy or solo hooks',()=>{
 for(const firstId of ['host','guest']){const f=pair();const sid=riding(f,{firstId}),before=[protectedSave(f.h.save),protectedSave(f.g.save)];complete(f);
  for(const [i,c]of [f.h,f.g].entries()){const result=c.snapshot().lastResult;assert.equal(result?.saved,true,JSON.stringify(c.snapshot()));assert.equal(result.firstId,firstId);assert.equal(result.otherId,firstId==='host'?'guest':'host');assert.equal(result.runId,sid);assert.equal(result.at,startTime);assert.equal(result.handoffs,2);assert(result.elapsed>0);assert(result.distance>=150);assert.equal(c.save.clubPostRelayRecords.plays,1);assert.equal(Object.keys(c.save.clubPostRelayRecords.receipts).length,1);assert.deepEqual(protectedSave(c.save),before[i]);assert.equal(forbidden(c).length,0);assert.equal(c.trace.managedFinishes,1);assert.equal(c.G.trail.ride,null);assert.equal(c.trace.events.filter(e=>e.event==='clubPostRelayFinish').length,1);}
  assert.deepEqual(f.h.snapshot().lastResult,f.g.snapshot().lastResult);const final=f.b.packets.filter(p=>p.payload.kind==='frame'&&p.payload.state.finished).at(-1);assert.equal(final.options.retain,true);assert.equal(final.options.qos,1);f.b.deliver(f.g,final.topic,final.payload);assert.equal(f.g.save.clubPostRelayRecords.plays,1);assert.equal(f.g.trace.managedFinishes,1);
 }
});

test('handoffs require an offered pouch, both nearby stopped riders, and grounded horses',()=>{
 const f=pair();riding(f);atFirstHandoff(f);assert.equal(f.g.G.clubPostRelay.context().action,null);assert.equal(f.g.G.clubPostRelay.interact().ok,false);assert.equal(f.h.current().handoffs,0);
 f.g.G.horse.player.speed=3;tickBoth(f);assert.equal(f.h.G.clubPostRelay.interact().ok,false);assert.equal(f.h.current().offer,null);f.g.G.horse.player.speed=0;tickBoth(f);
 move(f,[f.g],{x:PINES.x+7,z:PINES.z});assert.equal(f.h.G.clubPostRelay.interact().ok,false);move(f,[f.g],PINES);
 f.g.G.horse.player.y=1.1;tickBoth(f);assert.equal(f.h.current().paused,false,'ordinary jumps do not pause the ride');assert.equal(f.h.G.clubPostRelay.interact().ok,false);assert.equal(f.h.current().partner.grounded,false);f.g.G.horse.player.y=0;tickBoth(f);
 action(f,f.h,'offer');const offered=f.h.current().offer;assert(offered);assert.equal(f.g.G.clubPostRelay.context().action,'accept');
 // An accepted input arriving ahead of the queued accept invalidates the offer.
 assert.equal(f.g.G.clubPostRelay.interact().ok,true);f.g.G.horse.player.speed=3;f.b.advance(151);f.g.tick();const moving=f.b.queue.findLast(p=>p.to===f.h&&p.payload.kind==='input');assert(moving);f.b.deliver(f.h,moving.topic,moving.payload);f.b.flush();currentStage(f,'passPost');assert.equal(f.h.current().handoffs,0);assert.equal(f.h.current().offer,null);
 f.g.G.horse.player.speed=0;tickBoth(f);action(f,f.h,'offer');action(f,f.g,'accept');currentStage(f,'deliver');assert.equal(f.h.current().handoffs,1);
});

test('stale, replayed and impossible position inputs cannot contribute distance or poison the next real input',()=>{
 const f=pair();riding(f,{firstId:'guest'});gathered(f);action(f,f.g,'collect');const packet=f.b.packets.filter(p=>p.from==='guest'&&p.payload.kind==='input').at(-1),base=clone(packet.payload),before=f.h.current();
 for(const patch of [{seq:base.seq+1,x:base.x+40,speed:0},{seq:base.seq},{seq:base.seq-1},{seq:base.seq+1,at:f.b.now-1801,x:base.x+1},{seq:base.seq+1,x:NaN},{seq:base.seq+1,id:'outsider'}]){f.b.deliver(f.h,packet.topic,{...base,...patch});assert.equal(f.h.current().distance,before.distance);assert.equal(f.h.current().partner.seq,base.seq);}
 move(f,[f.g],{x:WREN.x+3,z:WREN.z});assert(f.h.current().distance>=3);assert.equal(f.h.current().partner.x,WREN.x+3);const frame=f.b.packets.filter(p=>p.payload.kind==='frame').at(-1),guestBefore=f.g.current();f.b.deliver(f.g,frame.topic,frame.payload);assert.equal(f.g.current().distance,guestBefore.distance);const earlier=f.b.packets.find(p=>p.payload.kind==='frame');f.b.deliver(f.g,earlier.topic,earlier.payload);assert.equal(f.g.current().stage,guestBefore.stage);assert.equal(f.g.current().distance,guestBefore.distance);
});

test('an actual local fast travel observation ends the unfinished relay without recording',()=>{
 const f=pair();riding(f);gathered(f);f.g.G.horse.player.pos={x:WREN.x+45,z:WREN.z};tickBoth(f);assert.equal(f.h.current(),null);assert.equal(f.g.current(),null);for(const c of [f.h,f.g]){assert.equal(c.G.trail.ride,null);assert.equal(c.save.clubPostRelayRecords.plays,undefined);assert.equal(forbidden(c).length,0);}
});

test('stale partner observations pause elapsed time and the returning fresh rider can resume',()=>{
 const f=pair();riding(f);gathered(f);action(f,f.h,'collect');tickBoth(f);const before=f.h.current().elapsed;f.b.advance(1900);f.h.tick();f.b.flush();assert.equal(f.h.current().paused,true);assert.equal(f.g.current().paused,true);assert.equal(f.h.current().elapsed,before);assert.equal(f.h.G.clubPostRelay.interact().ok,false);tickBoth(f);assert.equal(f.h.current().paused,false);assert(f.h.current().elapsed>before);
});

test('optional woodland route supports ordinary jumping but exchange waits for landing and locks the return choice',()=>{
 const f=pair();riding(f);atFirstHandoff(f);firstHandoff(f);assert.equal(f.h.G.clubPostRelay.setRoute('woodland').ok,false,'only the courier selects');f.g.rig.profile.nativeJump=false;assert.equal(f.g.G.clubPostRelay.setRoute('woodland').ok,false);f.g.rig.profile.nativeJump=true;
 f.g.G.horse.player.speed=18;assert.equal(f.g.G.clubPostRelay.setRoute('woodland').ok,true);f.b.flush();assert.equal(f.h.current().route,'woodland');f.g.G.horse.player.y=1.1;tickBoth(f);assert.equal(f.h.current().paused,false);assert.equal(f.g.current().paused,false);path(f,[f.g],COTTONWOOD_ROUTES.woodland);assert.equal(f.g.G.clubPostRelay.interact().ok,false,'cannot exchange in midair');f.g.G.horse.player.y=0;tickBoth(f);action(f,f.g,'exchange');currentStage(f,'backToPines');assert.equal(f.h.current().returnRoute,'woodland');assert.equal(f.g.G.clubPostRelay.setRoute('road').ok,false);assert.equal(f.h.current().route,'woodland');
});

test('failed writes and unreadable committed receipts stay pending until explicit verified retry, exactly once',()=>{
 for(const failure of ['write','readback']){const f=pair();riding(f);beforeFinish(f);const before=protectedSave(f.g.save);if(failure==='write')f.g.writeFailure=true;else f.g.readAfterWrite=true;action(f,f.h,'return');assert.equal(f.h.snapshot().lastResult.saved,true);assert.equal(f.g.snapshot().lastResult.saved,false);assert.equal(f.g.current().savePending,true);assert(f.g.G.trail.ride);assert.equal(f.g.trace.managedFinishes,0);assert.equal(f.g.G.clubPostRelay.again().ok,false);assert.equal(f.g.G.clubPostRelay.retrySave().ok,false);assert.equal(f.g.save.clubPostRelayRecords.plays,failure==='readback'?1:undefined);
  f.g.writeFailure=false;f.g.readAfterWrite=false;f.g.readFailure=false;assert.equal(f.g.G.clubPostRelay.retrySave().ok,true);assert.equal(f.g.G.clubPostRelay.retrySave().ok,true);assert.equal(f.g.snapshot().lastResult.saved,true);assert.equal(f.g.save.clubPostRelayRecords.plays,1);assert.equal(f.g.trace.managedFinishes,1);assert.equal(f.g.trace.events.filter(e=>e.event==='clubPostRelayFinish').length,1);assert.equal(f.g.G.trail.ride,null);assert.deepEqual(protectedSave(f.g.save),before);assert.equal(forbidden(f.g).length,0);
 }
});

test('a completed frame can arrive before the terminal session and a late session cannot repeat the receipt',()=>{
 const f=pair();riding(f);beforeFinish(f);f.b.drop=p=>p.to===f.g&&p.payload.kind==='session'&&p.payload.status==='finished';action(f,f.h,'return');assert.equal(f.g.snapshot().lastResult.saved,true);assert.equal(f.g.save.clubPostRelayRecords.plays,1);const terminal=f.b.packets.filter(p=>p.payload.kind==='session'&&p.payload.status==='finished').at(-1);assert(terminal);f.b.drop=null;f.b.deliver(f.g,terminal.topic,terminal.payload);f.b.flush();assert.equal(f.g.save.clubPostRelayRecords.plays,1);assert.equal(f.g.trace.managedFinishes,1);
});

test('retained final proof survives host departure and lets a guest recover its missing completion',()=>{
 const f=pair();riding(f);beforeFinish(f);f.b.drop=p=>p.to===f.g&&p.payload.kind==='frame'&&p.payload.state.finished;assert.equal(f.h.G.clubPostRelay.interact().ok,true);f.b.flush();assert.equal(f.g.current().status,'finished');assert.equal(f.g.current().stage,'home');assert.equal(f.g.save.clubPostRelayRecords.plays,undefined);assert.equal(f.h.G.clubPostRelay.leave().ok,true);f.b.flush();assert.equal(f.h.current(),null);assert.equal(f.g.save.clubPostRelayRecords.plays,undefined);
 f.b.drop=null;f.b.advance(2001);f.g.tick();f.b.flush();assert.equal(f.g.snapshot().lastResult.saved,true);assert.equal(f.g.save.clubPostRelayRecords.plays,1);assert.equal(f.g.trace.managedFinishes,1);assert.deepEqual(f.g.snapshot().lastResult,f.h.snapshot().lastResult);
});

test('missing final proof has bounded recovery and never invents a completion',()=>{
 const f=pair();riding(f);beforeFinish(f);f.b.drop=p=>p.to===f.g&&p.payload.kind==='frame'&&p.payload.state.finished;assert.equal(f.h.G.clubPostRelay.interact().ok,true);f.b.flush();f.h.G.clubPostRelay.leave();f.b.flush();for(let i=0;i<4;i++){f.b.advance(2001);f.g.tick();f.b.flush();}assert.equal(f.g.current(),null);assert.equal(f.g.save.clubPostRelayRecords.plays,undefined);assert.equal(f.g.trace.subscriptionRequests.filter(t=>t.includes('/frame/')).length,4);assert.equal(f.g.trace.managedFinishes,0);assert.equal(forbidden(f.g).length,0);
});

test('leaving, trail cancellation and transport disconnect stop both unfinished couriers without rewards',()=>{
 for(const cause of ['host','guest','trail','disconnect']){const f=pair();riding(f);gathered(f);action(f,f.h,'collect');const before=[protectedSave(f.h.save),protectedSave(f.g.save)];if(cause==='disconnect'){f.g.G.net.net.client.connected=false;f.g.tick();f.b.advance(6100);f.h.tick();}else if(cause==='trail')f.g.G.trail.stop();else f[cause==='host'?'h':'g'].G.clubPostRelay.leave();f.b.flush();for(const [i,c]of [f.h,f.g].entries()){assert.equal(c.current(),null,cause);assert.equal(c.G.trail.ride,null,cause);assert.equal(c.save.clubPostRelayRecords.plays,undefined);assert.deepEqual(protectedSave(c.save),before[i]);assert.equal(forbidden(c).length,0);}}
});

test('unknown riders, other rooms, unjoined riders and busy riders cannot form a relay',()=>{
 const f=pair();f.h.busy=true;assert.equal(f.h.G.clubPostRelay.host().ok,false);f.h.busy=false;f.h.G.net.net.club='OTHER';assert.equal(f.h.G.clubPostRelay.host().ok,false);f.h.G.net.net.club='CLUB';const u=f.b.client('unjoined',{joined:false});assert.equal(u.G.clubPostRelay.host().ok,false);const sid=lobby(f),packet=f.b.packets.find(p=>p.payload.kind==='session');
 const stranger=f.b.client('stranger',{known:false});stranger.edit(s=>{s.clubRecords.CLUB.members={};});stranger.identity.founderId='someone-else';f.b.deliver(stranger,packet.topic,packet.payload);assert.equal(stranger.snapshot().lobbies.length,0);assert.equal(stranger.G.clubPostRelay.join(sid).ok,false);
 const roster=f.h.current().roster;for(const code of ['OTHER','CLUB'])f.b.deliver(f.h,`srf1/${code}/postrelay/member/${sid}/intruder`,{kind:'member',id:'intruder',n:'Intruder',sid,rev:1,at:f.b.now,ready:true,left:false});assert.deepEqual(f.h.current().roster,roster);assert.equal(f.h.trace.starts.length,0);assert.equal(f.g.trace.starts.length,0);
});

test('a delayed accept cannot spend an old offer and a fresh accept succeeds only once',()=>{
 const f=pair();riding(f);atFirstHandoff(f);action(f,f.h,'offer');assert.equal(f.g.G.clubPostRelay.interact().ok,true);const index=f.b.queue.findIndex(p=>p.to===f.h&&p.payload.kind==='action');assert(index>=0);const delayed=f.b.queue.splice(index,1)[0];f.b.flush();for(let i=0;i<13;i++)tickBoth(f);f.b.deliver(f.h,delayed.topic,delayed.payload);f.b.flush();currentStage(f,'passPost');assert.equal(f.h.current().handoffs,0);assert(f.h.current().offer);action(f,f.g,'accept');currentStage(f,'deliver');const accepted=f.b.packets.filter(p=>p.payload.kind==='action'&&p.payload.action==='accept').at(-1);f.b.deliver(f.h,accepted.topic,accepted.payload);f.b.flush();assert.equal(f.h.current().handoffs,1);currentStage(f,'deliver');
});

test('guest interaction pauses after stale host frames and ends if the host never returns',()=>{
 const f=pair();riding(f);atFirstHandoff(f);action(f,f.h,'offer');assert.equal(f.g.G.clubPostRelay.context().eligible,true);const released=f.g.trace.release;f.b.drop=p=>p.to===f.g&&p.payload.kind==='frame';f.b.advance(1901);f.g.tick();f.b.flush();assert.equal(f.g.current().waitingForHost,true);assert.equal(f.g.current().paused,true);assert.equal(f.g.G.clubPostRelay.context().eligible,false);assert.equal(f.g.G.clubPostRelay.interact().ok,false);assert(f.g.trace.release>released);assert.equal(f.g.current().handoffs,0);f.b.advance(4200);f.g.tick();f.b.flush();assert.equal(f.g.current(),null);assert.equal(f.h.current(),null);assert.equal(f.g.save.clubPostRelayRecords.plays,undefined);
});

test('a committed receipt awaiting readback remains retryable after cancellation or changing club rooms',()=>{
 for(const cause of ['leave','club']){const f=pair();riding(f);beforeFinish(f);f.g.readAfterWrite=true;action(f,f.h,'return');const sid=f.g.current().id;assert.equal(f.g.save.clubPostRelayRecords.plays,1);assert.equal(f.g.snapshot().lastResult.saved,false);if(cause==='leave')f.g.G.clubPostRelay.leave();else{f.g.identity.code='OTHER';f.g.G.net.net.club='OTHER';f.g.G.run('clubChanged');}f.b.flush();assert.equal(f.g.current(),null);assert.equal(f.g.snapshot().lastResult.saved,false);assert.equal(f.g.G.clubPostRelay.host().ok,false,'pending completion must be retried first');f.g.readAfterWrite=false;f.g.readFailure=false;assert.equal(f.g.G.clubPostRelay.retrySave().ok,true);assert.equal(f.g.snapshot().lastResult.runId,sid);assert.equal(f.g.snapshot().lastResult.saved,true);assert.equal(f.g.save.clubPostRelayRecords.plays,1);assert.equal(f.g.trace.events.filter(e=>e.event==='clubPostRelayFinish').length,1);assert.equal(forbidden(f.g).length,0);}
});

test('a rider who becomes busy after Ready declines the start and the partner stops cleanly',()=>{
 const f=pair();lobby(f);assert.equal(f.g.G.clubPostRelay.ready().ok,true);f.b.flush();f.g.busy=true;assert.equal(f.h.G.clubPostRelay.start().ok,true);f.b.flush();assert.equal(f.g.trace.starts.length,0);assert.equal(f.h.current(),null);assert.equal(f.g.current(),null);assert.equal(f.h.G.trail.ride,null);assert.equal(f.h.save.clubPostRelayRecords.plays,undefined);
});

const guideAt=(c,point,message)=>{const guide=c.current().guide;assert.deepEqual([guide.x,guide.z],point,message);return guide;};
test('outbound guidance retains the north gate corner until close enough, then advances at the captured nearby pose',()=>{
 const f=pair();riding(f);gathered(f);action(f,f.h,'collect');guideAt(f.h,[-8,-15.5]);move(f,[f.h],{x:-9.8,z:-14.5});const guide=guideAt(f.h,[-8,-15.5],'2.06m proximity must not cut the first gate corner');assert.equal(guide.radius,.8);
 // This captured pose is 0.529m from the corner, so it proves reaching the
 // corner advances. The preceding farther pose distinguishes the old 3m skip.
 const reached={x:-7.632,z:-15.120};assert(Math.hypot(reached.x+8,reached.z+15.5)<guide.radius);move(f,[f.h],reached);guideAt(f.h,[-3,-16]);assert.equal(f.h.current().stage,'outbound');
});

test('every narrow gate corner requires its advertised radius outbound and on the actual reply trip home',()=>{
 const critical=[{p:[-8,-15.5],radius:.8},{p:[-3,-16],radius:.8},{p:[-3,-22],radius:.8},{p:[1,-22],radius:.8},{p:[2,-31],radius:.8}];
 for(const phase of ['outbound','home']){const f=pair();riding(f,{firstId:phase==='home'?'guest':'host'});let previous,points,after;
  if(phase==='outbound'){gathered(f);action(f,f.h,'collect');previous=[WREN.x,WREN.z];points=critical;after=[-14,-41];}
  else{beforeHome(f);const [courier]=firstAndOther(f);move(f,[courier],{x:-14,z:-41});guideAt(courier,[2,-31]);previous=[-14,-41];points=[...critical].reverse();after=[WREN.x,WREN.z];}
  const [courier]=firstAndOther(f);
  for(let i=0;i<points.length;i++){const {p,radius}=points[i],dx=previous[0]-p[0],dz=previous[1]-p[1],length=Math.hypot(dx,dz),approach=d=>({x:p[0]+dx/length*d,z:p[1]+dz/length*d});
   move(f,[courier],approach(radius+.05));const guide=guideAt(courier,p,`${phase}: retain ${p} just outside the required approach`);assert.equal(guide.radius,radius,`${phase}: ${p} advertises its actual reach threshold`);
   move(f,[courier],approach(radius-.05));guideAt(courier,points[i+1]?.p||after,`${phase}: reaching ${p} permits the next segment`);assert.equal(courier.current().stage,phase);previous=p;
  }
 }
});

function probeRidingPins(f,courier,riders,points,{phase,target,thenHandoff}={}){
 for(let i=0;i<points.length;i++){const p=points[i];assert.equal(courier.current().stage,phase);assert.equal(guideAt(courier,p).radius,.8,`${phase}: surveyed pin ${p} advertises .8m`);
  if(i===points.length-1&&thenHandoff){
   // Pines has a separate 6m handoff zone. Its authored riding pin still uses
   // .8m, but entering the station changes stage before that pin is reached.
   move(f,riders,{x:p[0]+1.2,z:p[1]});currentStage(f,thenHandoff);assert.equal(courier.current().guide.radius,undefined);return;
  }
  const from=courier.G.horse.player.pos,dx=from.x-p[0],dz=from.z-p[1],length=Math.hypot(dx,dz);assert(length>0,'approach must start outside this pin');const pose=d=>({x:p[0]+dx/length*d,z:p[1]+dz/length*d});
  move(f,riders,pose(1.2));assert.equal(guideAt(courier,p,`${phase}: do not cut the ${p} bend at 1.2m`).radius,.8);
  move(f,riders,pose(.75));const next=points[i+1];if(next)guideAt(courier,next,`${phase}: advance past ${p} only after reaching its .8m circle`);else{guideAt(courier,target);assert.equal(courier.current().guide.radius,undefined,'all riding pins are consumed and the station is next');}
 }
}
test('all surveyed route pins hold at 1.2m and advance inside .8m on road and woodland round trips',()=>{
 for(const route of ['road','woodland']){const f=pair();riding(f);gathered(f);action(f,f.h,'collect');probeRidingPins(f,f.h,[f.h,f.g],COTTONWOOD_ROUTES.out,{phase:'outbound',thenHandoff:'passPost'});firstHandoff(f);
  if(route==='woodland'){assert.equal(f.g.G.clubPostRelay.setRoute(route).ok,true);f.b.flush();}
  probeRidingPins(f,f.g,[f.g],COTTONWOOD_ROUTES[route],{phase:'deliver',target:[ADA.x,ADA.z]});move(f,[f.g],{x:ADA.x+1.2,z:ADA.z});action(f,f.g,'exchange');currentStage(f,'backToPines');
  probeRidingPins(f,f.g,[f.g],[...COTTONWOOD_ROUTES[route]].reverse(),{phase:'backToPines',thenHandoff:'passReply'});action(f,f.g,'offer');action(f,f.h,'accept');currentStage(f,'home');
  probeRidingPins(f,f.h,[f.h],[...COTTONWOOD_ROUTES.out].reverse(),{phase:'home',target:[WREN.x,WREN.z]});move(f,[f.h],WREN);action(f,f.h,'return');currentStage(f,'finished');assert.equal(f.h.snapshot().lastResult.handoffs,2);assert.equal(f.g.snapshot().lastResult.saved,true);
 }
});

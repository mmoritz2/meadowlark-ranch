import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as protocol from '../assets/club-herd-protocol.mjs';
import {validateSharedHerdSnapshot} from '../assets/shared-herd-physics.mjs';
const file=fs.readFileSync(new URL('../assets/features/club-herd.js',import.meta.url),'utf8');
const production=file.replace(/^import .*;\n/,'').replace('export const id=','const id=').replace('export function install(G)','function install(G)');
const clone=v=>structuredClone(v),startTime=1791569000000;
function relay(){
 let now=startTime;const clients=new Map(),queue=[],packets=[],retained=new Map();
 const matches=(topic,filter)=>filter.endsWith('/#')?topic.startsWith(filter.slice(0,-1)):topic===filter;
 const bus={clients,queue,packets,get now(){return now;},advance(ms){now+=ms;},flush(){let count=0;while(queue.length){assert(++count<1000,'relay must settle without a publication loop');const {to,topic,payload}=queue.shift();if(to.G.net.net.client.connected&&!bus.drop?.({to,topic,payload}))to.G.run('message',topic,clone(payload));}},deliver(to,topic,payload){to.G.run('message',topic,clone(payload));}};
 bus.client=(id,{code='CLUB',joined=true,known=true,seedSave=null}={})=>{
  const trace={events:[],starts:[],stops:[],sources:[],frames:[],writes:0,release:0,subscriptionRequests:[]},hooks=new Map(),subscriptions=new Set(),classes=new Set();
  let course=null,state=null,writeFailure=false,readFailure=false,readAfterWrite=false;
  let saved=seedSave?clone(seedSave):{coins:100,gems:7,keys:2,pass:{pts:20},roundupBest:{full:{plays:3,medal:'gold'}},clubHerdRecords:{},clubRecords:{[code]:{members:{}}}};
  const identity={code,founder:'Host rider',founderId:'host',pendingJoin:false,canCreate:!joined};if(!joined)identity.founder='';
  const fresh=()=>readFailure?null:clone(saved);
  const document={hidden:false,body:{classList:{contains:key=>classes.has(key)}}};
  const G={save:{ensure(fn){fn(saved);},fresh,sync(fn){const next=clone(saved);fn(next);if(!writeFailure){saved=next;trace.writes++;if(readAfterWrite)readFailure=true;}}},clubs:{identity:()=>identity,memberRows:()=>Object.entries(saved.clubRecords[identity.code]?.members||{}).filter(([,r])=>!r.left).map(([id])=>({id}))},
   net:{net:{id,club:code,client:{connected:true}},myName:()=>id,subscribe(topic){trace.subscriptionRequests.push(topic);subscriptions.add(topic);for(const [t,payload]of retained)if(matches(t,topic))queue.push({to:client,topic:t,payload:clone(payload)});},publish(topic,payload,options){if(!G.net.net.client.connected)return false;const data={id,n:id,...clone(payload)};packets.push({from:id,topic,payload:clone(data),options:clone(options||{})});if(options?.retain)retained.set(topic,clone(data));for(const c of clients.values())if([...c.subscriptions].some(f=>matches(topic,f)))queue.push({to:c,topic,payload:clone(data)});return true;}},
   on(event,fn){const list=hooks.get(event)||[];list.push(fn);hooks.set(event,list);},run(event,...args){trace.events.push({event,args:clone(args)});let result;for(const fn of hooks.get(event)||[]){const r=fn(...args);if(r!==undefined)result=r;}return result;},
   horse:{player:{pos:{x:-95,z:0},onFoot:false,flying:false,y:0},RIG:()=>({ready:true,heroMotion:{state:{}}})},course:{get:()=>course,drillActive:()=>false},rescueRide:{snapshot:()=>({active:false})},trail:{ride:null},clubRides:{snapshot:()=>({current:null})},worldPkg:{vehicle:()=>null},cam:{isFree:()=>classes.has('freecam')},input:{blocked:()=>false},riding:{releaseAll(){trace.release++;}},hidePanels(){},seFrame:{settle(){}},toast(){}};
  const core={state:()=>state&&clone(state),start(args){if(state)return false;trace.starts.push(clone(args));state={...args,active:true,countdown:3,elapsed:0,penned:0,total:5,finished:false,paused:true,startupWaiting:true,pen:{...protocol.HERD_PEN},bounds:{...protocol.HERD_BOUNDS},horses:protocol.HERD_NAMES.map((name,i)=>({name,x:-83-i*2,z:8-i*3,heading:Math.PI/2,phase:i,penned:false}))};return true;},setStartupWaiting(waiting){if(!state?.host)return false;state.startupWaiting=waiting;state.paused=waiting;return true;},setRiders(rows){trace.sources.push(clone(rows));return !!state?.host;},applySnapshot(s){if(!state||state.host)return false;const valid=validateSharedHerdSnapshot(s,{sessionId:state.sessionId,bounds:protocol.HERD_BOUNDS,pen:protocol.HERD_PEN,names:protocol.HERD_NAMES,previous:state.received});if(!valid)return false;const wasFinished=state.finished;state={...state,...clone(valid),host:false,received:clone(valid)};trace.frames.push(clone(s));if(state.finished&&!wasFinished)G.run('sharedRoundupFinish',core.state());return true;},stop(reason){if(!state)return false;trace.stops.push(reason);const old=state;state=null;G.run('sharedRoundupStop',{...old,active:false,reason});return true;}};
  G.roundup={shared:core,state:()=>({active:!!state,target:state?{name:'Juniper',x:-83,z:8}:null})};
  const client={id,G,core,trace,document,classes,subscriptions,identity,get save(){return clone(saved);},get state(){return state;},set busy(v){course=v?{}:null;},set writeFailure(v){writeFailure=v;},set readFailure(v){readFailure=v;},set readAfterWrite(v){readAfterWrite=v;},edit(fn){fn(saved);},tick(){G.run('tick',.15);},complete(elapsed=45){assert(state?.host);state.startupWaiting=false;state.paused=false;state.countdown=0;state.elapsed=elapsed;state.penned=5;state.finished=true;for(const h of state.horses){h.x=-44;h.z=-8;h.penned=true;}G.run('sharedRoundupFinish',core.state());}};
  clients.set(id,client);if(known)for(const c of clients.values()){c.edit(s=>{s.clubRecords[code]??={members:{}};s.clubRecords[code].members[id]={name:id};});client.edit(s=>{for(const other of clients.keys())s.clubRecords[code].members[other]={name:other};});}
  const Clock=class extends Date{static now(){return now;}};
  const install=Function(...Object.keys(protocol),'Date','document',production+';return install;')(...Object.values(protocol),Clock,document);install(G);return client;
 };
 return bus;
}
function pair(){const b=relay(),h=b.client('host'),g=b.client('guest');return {b,h,g};}
function lobby(f){const {b,h,g}=f;assert.equal(h.G.clubHerd.host().ok,true);b.flush();const sid=h.G.clubHerd.snapshot().current.id;assert.equal(g.G.clubHerd.join(sid).ok,true);b.flush();return sid;}
function riding(f){const sid=lobby(f);assert.equal(f.g.G.clubHerd.ready().ok,true);f.b.flush();assert.equal(f.h.G.clubHerd.start().ok,true);f.b.flush();return sid;}
const money=s=>({coins:s.coins,gems:s.gems,keys:s.keys,pass:s.pass,roundupBest:s.roundupBest});
function stage(f){f.g.tick();f.b.flush();f.h.tick();f.b.flush();assert.equal(f.h.state.startupWaiting,false);assert.equal(f.g.state.startupWaiting,false);}
const soloHooks=c=>c.trace.events.filter(e=>['roundupStart','roundupPen','roundupFinish','roundupSavePending'].includes(e.event));

test('two-client lobby admits known riders but starts neither core until explicit Ready and host Start',()=>{
 const f=pair(),sid=lobby(f);assert.equal(f.h.trace.starts.length,0);assert.equal(f.g.trace.starts.length,0);assert.equal(f.h.G.clubHerd.start().ok,false);assert.equal(f.h.trace.starts.length,0);
 assert.equal(f.g.G.clubHerd.ready().ok,true);f.b.flush();assert.equal(f.h.G.clubHerd.snapshot().current.canStart,true);assert.equal(f.h.G.clubHerd.start().ok,true);f.b.flush();
 assert.deepEqual(f.h.trace.starts,[{sessionId:sid,host:true,slot:0}]);assert.deepEqual(f.g.trace.starts,[{sessionId:sid,host:false,slot:1}]);
});

test('the first host tick allows time for the admitted guest to send its first real input',()=>{
 const f=pair();riding(f);f.h.tick();f.b.flush();assert(f.h.state,'newly started host must not immediately time out');assert(f.g.state,'guest must get a chance to send its first input');
 f.g.tick();f.b.flush();f.b.advance(151);f.h.tick();f.b.flush();const sources=f.h.trace.sources.at(-1);assert(sources.some(r=>r.id==='guest'));assert(sources.some(r=>r.id==='host'));
});

test('real input packets reach host pressure and host frames reach guest with monotonic validation',()=>{
 const f=pair();riding(f);f.g.G.horse.player.pos={x:-90,z:-4};f.g.tick();f.b.flush();f.h.tick();f.b.flush();
 assert(f.h.trace.sources.at(-1).some(r=>r.id==='guest'&&r.x===-90&&r.z===-4));assert.equal(f.g.trace.frames.length>0,true);
 const last=f.b.packets.filter(p=>p.topic.includes('/frame/')).at(-1),count=f.g.trace.frames.length;f.b.deliver(f.g,last.topic,last.payload);assert.equal(f.g.trace.frames.length,count);
 const backwards=clone(last.payload);backwards.seq++;backwards.state.elapsed=-1;f.b.deliver(f.g,last.topic,backwards);assert.equal(f.g.trace.frames.length,count);
});

test('one shared completion records each rider once and never pays currency or solo hooks',()=>{
 const f=pair();riding(f);const before=[money(f.h.save),money(f.g.save)];f.h.complete();f.b.flush();
 for(const [i,c]of [f.h,f.g].entries()){const s=c.save;assert.equal(s.clubHerdRecords.plays,1);assert.equal(s.clubHerdRecords.bestTime,45);assert.equal(Object.keys(s.clubHerdRecords.receipts).length,1);assert.deepEqual(money(s),before[i]);assert.equal(soloHooks(c).length,0);assert.equal(c.G.clubHerd.snapshot().lastResult.saved,true);}
 const last=f.b.packets.filter(p=>p.topic.includes('/frame/')).at(-1);f.b.deliver(f.g,last.topic,last.payload);f.h.G.run('sharedRoundupFinish',f.h.core.state());assert.equal(f.h.save.clubHerdRecords.plays,1);assert.equal(f.g.save.clubHerdRecords.plays,1);
});

test('failed record write stays pending, explicit retry records once, and never changes the wallet',()=>{
 const f=pair();riding(f);f.g.writeFailure=true;const before=money(f.g.save);f.h.complete(51);f.b.flush();assert.equal(f.g.G.clubHerd.snapshot().lastResult.saved,false);assert.equal(f.g.save.clubHerdRecords.plays,undefined);assert.equal(f.g.G.clubHerd.again().ok,false);
 f.g.writeFailure=false;assert.equal(f.g.G.clubHerd.retrySave().ok,true);assert.equal(f.g.save.clubHerdRecords.plays,1);assert.equal(f.g.G.clubHerd.retrySave().ok,true);assert.equal(f.g.save.clubHerdRecords.plays,1);assert.deepEqual(money(f.g.save),before);
});

test('stale guest inputs stop contributing before the host cancels a disconnected two-rider session',()=>{
 const f=pair();riding(f);f.g.tick();f.b.flush();f.h.tick();f.b.flush();f.b.advance(1900);f.h.tick();f.b.flush();assert(f.h.state);assert.equal(f.h.trace.sources.at(-1).some(r=>r.id==='guest'),false);
 f.b.advance(4200);f.h.tick();f.b.flush();assert.equal(f.h.state,null);assert.equal(f.g.state,null);assert.equal(f.h.save.clubHerdRecords.plays,undefined);assert.equal(f.g.save.clubHerdRecords.plays,undefined);
});

test('host leave, guest leave, and transport disconnect stop both sessions without recording a finish',()=>{
 for(const cause of ['host','guest','connection']){const f=pair();riding(f);stage(f);if(cause==='connection'){f.g.G.net.net.client.connected=false;f.g.tick();f.b.advance(6100);f.h.tick();}else f[cause==='host'?'h':'g'].G.clubHerd.leave();f.b.flush();assert.equal(f.h.state,null,cause);assert.equal(f.g.state,null,cause);for(const c of [f.h,f.g]){assert.equal(c.save.clubHerdRecords.plays,undefined);assert.equal(soloHooks(c).length,0);}}
});

test('busy, wrong-room, unjoined and unknown-member attempts cannot enter a simulation',()=>{
 const f=pair();f.h.busy=true;assert.equal(f.h.G.clubHerd.host().ok,false);f.h.busy=false;f.h.G.net.net.club='OTHER';assert.equal(f.h.G.clubHerd.host().ok,false);f.h.G.net.net.club='CLUB';
 const u=f.b.client('outsider',{joined:false});assert.equal(u.G.clubHerd.host().ok,false);const sid=lobby(f);const packet=f.b.packets.find(p=>p.topic.includes('/session/'));
 const stranger=f.b.client('stranger',{known:false});stranger.edit(s=>{s.clubRecords.CLUB.members={};});stranger.identity.founderId='somebody-else';f.b.deliver(stranger,packet.topic,packet.payload);assert.equal(stranger.G.clubHerd.snapshot().lobbies.length,0);
 const count=f.h.G.clubHerd.snapshot().current.roster.length;f.b.deliver(f.h,`srf1/OTHER/herddrive/member/${sid}/intruder`,{kind:'member',id:'intruder',n:'Intruder',sid,rev:1,at:f.b.now,ready:true,left:false});f.b.deliver(f.h,`srf1/CLUB/herddrive/member/${sid}/intruder`,{kind:'member',id:'intruder',n:'Intruder',sid,rev:1,at:f.b.now,ready:true,left:false});assert.equal(f.h.G.clubHerd.snapshot().current.roster.length,count);assert.equal(stranger.trace.starts.length,0);
});

test('a rider who becomes busy after Ready refuses the incoming start without teleporting',()=>{
 const f=pair();lobby(f);f.g.G.clubHerd.ready();f.b.flush();f.g.busy=true;assert.equal(f.h.G.clubHerd.start().ok,true);f.b.flush();assert.equal(f.g.trace.starts.length,0);assert.equal(f.h.state,null,'the sole remaining host stops');
});

test('all valid long network IDs can host a lobby accepted by another known club rider',()=>{
 const b=relay(),h=b.client('host_rider_abcdefghijklmnopqrstuvwxyz'),g=b.client('guest');h.identity.founderId=h.id;g.identity.founderId=h.id;assert.equal(h.G.clubHerd.host().ok,true);b.flush();assert.equal(g.G.clubHerd.snapshot().lobbies.length,1);
});

test('a guest in free camera sends no active pressure to the host',()=>{
 const f=pair();riding(f);f.g.classes.add('freecam');f.g.tick();f.b.flush();f.h.tick();f.b.flush();assert.equal(f.h.trace.sources.at(-1).some(r=>r.id==='guest'),false);
});


test('an unreadable committed record stays pending until readback confirms it without a second completion',()=>{
 const f=pair();riding(f);f.g.readAfterWrite=true;f.h.complete(56);f.b.flush();assert.equal(f.g.save.clubHerdRecords.plays,1);assert.equal(f.g.G.clubHerd.snapshot().lastResult.saved,false);
 f.g.readAfterWrite=false;f.g.readFailure=false;assert.equal(f.g.G.clubHerd.retrySave().ok,true);assert.equal(f.g.save.clubHerdRecords.plays,1);assert.equal(f.g.G.clubHerd.snapshot().lastResult.saved,true);
});

test('a conflicting already-saved receipt is not overwritten or presented as this completed ride',()=>{
 const f=pair(),sid=riding(f);const old=protocol.herdRecordResult({}, {runId:sid,elapsed:99,total:5,penned:5,participants:['host','guest'],at:f.b.now});f.g.edit(s=>{s.clubHerdRecords=old.save;});
 f.h.complete(45);f.b.flush();assert.equal(f.g.G.clubHerd.snapshot().lastResult.saved,false);assert.equal(f.g.save.clubHerdRecords.plays,1);assert.equal(f.g.save.clubHerdRecords.receipts[sid].elapsed,99);assert.equal(f.g.G.clubHerd.retrySave().ok,false);assert.equal(f.g.save.clubHerdRecords.plays,1);
});

test('a matching unsaved receipt cannot confirm a failed write',()=>{
 const f=pair(),sid=riding(f);f.g.edit(s=>{s.clubHerdRecords={plays:0,receipts:{[sid]:{runId:sid,elapsed:45,total:5,penned:5,participants:['host','guest'],at:f.b.now,saved:false}}};});f.g.writeFailure=true;
 f.h.complete(45);f.b.flush();assert.equal(f.g.G.clubHerd.snapshot().lastResult.saved,false);assert.equal(f.g.save.clubHerdRecords.plays,0);assert.equal(f.g.G.clubHerd.retrySave().ok,false);
});

test('a guest stops after the host stops sending frames, without counting an incomplete session',()=>{
 const f=pair();riding(f);stage(f);f.b.advance(6100);f.g.tick();f.b.flush();assert.equal(f.g.state,null);assert.equal(f.g.G.clubHerd.snapshot().current,null);assert.equal(f.g.save.clubHerdRecords.plays,undefined);
});

test('hosting rejects overlong IDs instead of publishing an invalid session',()=>{
 const b=relay(),h=b.client('r'.repeat(65));assert.equal(h.G.clubHerd.host().ok,false);assert.equal(b.packets.length,0);assert.equal(h.trace.starts.length,0);
});

test('a four-rider lobby reserves unique slots, rejects a fifth, and can continue after one guest leaves',()=>{
 const b=relay(),h=b.client('host'),guests=['guest','third','fourth','fifth'].map(id=>b.client(id));assert.equal(h.G.clubHerd.host().ok,true);b.flush();const sid=h.G.clubHerd.snapshot().current.id;
 for(const g of guests.slice(0,3)){assert.equal(g.G.clubHerd.join(sid).ok,true);b.flush();assert.equal(g.G.clubHerd.ready().ok,true);b.flush();}
 assert.equal(guests[3].G.clubHerd.join(sid).ok,false);assert.deepEqual(h.G.clubHerd.snapshot().current.roster.map(r=>r.slot),[0,1,2,3]);assert.equal(h.G.clubHerd.start().ok,true);b.flush();
 for(const [index,c]of [h,...guests.slice(0,3)].entries()){assert.equal(c.trace.starts.length,1);assert.equal(c.trace.starts[0].slot,index);}
 assert.equal(guests[2].G.clubHerd.leave().ok,true);b.flush();assert(h.state);assert.equal(h.G.clubHerd.snapshot().current.roster.length,3);assert.equal(guests[2].state,null);assert.equal(guests[3].trace.starts.length,0);
});


test('changing club rooms retains an unsaved personal completion and its explicit retry',()=>{
 const f=pair();riding(f);f.g.writeFailure=true;f.h.complete(58);f.b.flush();const pending=f.g.G.clubHerd.snapshot().lastResult;
 assert.equal(pending.saved,false);f.g.identity.code='OTHER';f.g.G.net.net.club='OTHER';f.g.G.run('clubChanged');
 const after=f.g.G.clubHerd.snapshot();assert.equal(after.current,null);assert.equal(after.lastResult.runId,pending.runId);assert.equal(after.lastResult.saved,false);assert.equal(f.g.G.clubHerd.host().ok,false,'new rides must not replace the pending personal record');
 f.g.writeFailure=false;assert.equal(f.g.G.clubHerd.retrySave().ok,true);assert.equal(f.g.save.clubHerdRecords.plays,1);assert.equal(f.g.G.clubHerd.snapshot().lastResult.saved,true);
});

test('reload hydrates a verified personal completion without writing or counting the ride again',()=>{
 const f=pair();riding(f);f.h.complete(61);f.b.flush();const saved=f.g.save,receipt=f.g.G.clubHerd.snapshot().lastResult;
 const b=relay(),reloaded=b.client('guest',{seedSave:saved});const result=reloaded.G.clubHerd.snapshot().lastResult;
 assert.equal(result.saved,true);assert.equal(result.runId,receipt.runId);assert.equal(result.elapsed,61);assert.deepEqual(result.participants,receipt.participants);assert.equal(reloaded.save.clubHerdRecords.plays,1);assert.equal(reloaded.trace.writes,0);assert.equal(reloaded.G.clubHerd.retrySave().ok,true);assert.equal(reloaded.trace.writes,0);assert.equal(reloaded.G.clubHerd.snapshot().current,null);
});

test('reload does not present malformed or unverified local records as a completed drive',()=>{
 const f=pair();riding(f);f.h.complete(63);f.b.flush();const saved=f.g.save,sid=saved.clubHerdRecords.lastRunId;
 for(const corrupt of [r=>r.saved=false,r=>r.penned=4,r=>r.elapsed=NaN,r=>r.participants=[]]){
  const bad=clone(saved);corrupt(bad.clubHerdRecords.receipts[sid]);const b=relay(),reloaded=b.client('guest',{seedSave:bad});assert.equal(reloaded.G.clubHerd.snapshot().lastResult,null);assert.equal(reloaded.trace.writes,0);
 }
});

test('a finished host frame arriving before its terminal session still exits through the real Free ride action',()=>{
 const f=pair();riding(f);f.h.complete(47);
 const delayed=f.b.queue.filter(q=>q.to===f.g&&q.topic.includes('/session/')&&q.payload.status==='finished');assert.equal(delayed.length,1);
 for(let i=f.b.queue.length-1;i>=0;i--)if(delayed.includes(f.b.queue[i]))f.b.queue.splice(i,1);
 f.b.flush();const s=f.g.G.clubHerd.snapshot();assert.equal(s.lastResult.saved,true);assert.equal(s.current.status,'finished');assert.equal(s.current.riding,false);
 const ui=fs.readFileSync(new URL('../assets/features/club-herd-ui.js',import.meta.url),'utf8'),a=ui.indexOf(' function command(action,el){'),b=ui.indexOf(' U.action(',a);assert(a>=0&&b>a);
 const command=Function('G','H','snapshot','paint','showResult','clearTimeout','resultTimer',ui.slice(a,b)+';return command;')(f.g.G,f.g.G.clubHerd,()=>f.g.G.clubHerd.snapshot(),()=>{},()=>{},()=>{},0);
 command('close');assert.equal(f.g.state,null,'Free ride must release the held completed core');assert.equal(f.g.G.clubHerd.snapshot().current,null);
 for(const q of delayed)f.b.deliver(f.g,q.topic,q.payload);assert.equal(f.g.state,null);assert.equal(f.g.G.clubHerd.snapshot().current,null);assert.equal(f.g.save.clubHerdRecords.plays,1);
});


test('a lost terminal frame is recovered from retention after the host has already left',()=>{
 const f=pair(),sid=riding(f);f.h.complete(46);
 const terminal=f.b.packets.filter(p=>p.topic.includes('/frame/')&&p.payload.state.finished).at(-1);assert.deepEqual(terminal.options,{retain:true,qos:1});
 for(let i=f.b.queue.length-1;i>=0;i--)if(f.b.queue[i].to===f.g&&f.b.queue[i].topic.includes('/frame/'))f.b.queue.splice(i,1);
 f.h.G.clubHerd.leave();f.b.flush();assert.equal(f.h.state,null);assert.equal(f.g.state.finished,true);assert.equal(f.g.G.clubHerd.snapshot().lastResult.saved,true);assert.equal(f.g.save.clubHerdRecords.plays,1);
 assert(f.g.trace.subscriptionRequests.includes(`srf1/CLUB/herddrive/frame/${sid}`));
 f.g.G.net.subscribe(terminal.topic);f.b.flush();assert.equal(f.g.save.clubHerdRecords.plays,1);assert.equal(f.g.trace.events.filter(e=>e.event==='clubHerdFinish').length,1);
});

test('unrecoverable terminal data releases the guest after four bounded requests without recording a result',()=>{
 const f=pair(),sid=riding(f);f.b.drop=q=>q.to===f.g&&q.topic.includes('/frame/')&&q.payload.state.finished;
 f.h.complete(49);f.h.G.clubHerd.leave();f.b.flush();assert.equal(f.g.state.finished,false);assert.equal(f.g.G.clubHerd.snapshot().current.status,'finished');
 for(let i=0;i<4;i++){f.b.advance(2000);f.g.tick();f.b.flush();}
 assert.equal(f.g.state,null);assert.equal(f.g.G.clubHerd.snapshot().current,null);assert.match(f.g.G.clubHerd.snapshot().notice,/final herd result.*not recorded/i);assert.equal(f.g.save.clubHerdRecords.plays,undefined);assert.equal(f.g.G.clubHerd.snapshot().lastResult,null);
 assert.equal(f.g.trace.subscriptionRequests.filter(t=>t===`srf1/CLUB/herddrive/frame/${sid}`).length,4);
});

test('repeated retained finished sessions cannot reset the final-frame recovery deadline',()=>{
 const f=pair(),sid=riding(f);f.b.drop=q=>q.to===f.g&&q.topic.includes('/frame/')&&q.payload.state.finished;
 f.h.complete(53);f.b.flush();
 for(let i=0;i<4;i++){f.b.advance(2000);f.h.tick();f.b.flush();f.g.tick();f.b.flush();}
 assert.equal(f.g.state,null);assert.equal(f.g.save.clubHerdRecords.plays,undefined);assert.equal(f.g.trace.subscriptionRequests.filter(t=>t===`srf1/CLUB/herddrive/frame/${sid}`).length,4);
});


test('terminal recovery cannot bypass removal from the admitted roster',()=>{
 const f=pair();riding(f);f.h.complete(54);
 for(const q of f.b.queue)if(q.to===f.g&&q.topic.includes('/session/')&&q.payload.status==='finished')q.payload.roster=q.payload.roster.filter(r=>r.id!=='guest');
 f.b.flush();assert.equal(f.g.state,null);assert.equal(f.g.G.clubHerd.snapshot().current,null);assert.equal(f.g.save.clubHerdRecords.plays,undefined);assert.equal(f.g.trace.subscriptionRequests.some(t=>t.includes('/frame/')),false);
});


test('a twelve-second guest renderer stall holds countdown and allows inactive first input to complete staging',()=>{
 const f=pair();riding(f);f.h.tick();f.b.flush();assert.equal(f.h.G.clubHerd.snapshot().current.waitingForRiders,true);assert.deepEqual(f.h.G.clubHerd.snapshot().current.waitingNames,['guest']);
 f.b.advance(12000);f.h.tick();f.b.flush();assert(f.h.state);assert(f.g.state);assert.equal(f.h.state.startupWaiting,true);assert.equal(f.h.state.elapsed,0);assert.equal(f.h.state.countdown,3);assert.equal(f.g.G.clubHerd.snapshot().current.waitingForRiders,true);
 f.g.G.input.blocked=()=>true;f.g.tick();f.b.flush();f.h.tick();f.b.flush();assert.equal(f.h.state.startupWaiting,false);assert.equal(f.g.state.startupWaiting,false);assert.equal(f.h.G.clubHerd.snapshot().current.waitingForRiders,false);assert.equal(f.h.trace.sources.at(-1).some(r=>r.id==='guest'),false,'inactive staging packet is not active pressure');
});

test('startup waits for every admitted guest and cannot use stale or unadmitted inputs as acknowledgements',()=>{
 const b=relay(),h=b.client('host'),g=b.client('guest'),third=b.client('third');h.G.clubHerd.host();b.flush();const sid=h.G.clubHerd.snapshot().current.id;
 for(const rider of [g,third]){rider.G.clubHerd.join(sid);b.flush();rider.G.clubHerd.ready();b.flush();}h.G.clubHerd.start();b.flush();g.tick();b.flush();h.tick();b.flush();assert.equal(h.state.startupWaiting,true);assert.deepEqual(h.G.clubHerd.snapshot().current.waitingNames,['third']);
 b.deliver(h,`srf1/CLUB/herddrive/input/${sid}/third`,{kind:'input',id:'third',n:'third',sid,seq:1,at:b.now-2000,x:-95,z:0,active:false});h.tick();assert.equal(h.state.startupWaiting,true);
 third.tick();b.flush();h.tick();b.flush();assert.equal(h.state.startupWaiting,false);assert.equal(g.state.startupWaiting,false);assert.equal(third.state.startupWaiting,false);
});

test('thirty-second staging timeout cancels an unready team without a record or simulated time',()=>{
 const f=pair();riding(f);f.b.advance(29999);f.h.tick();f.b.flush();assert(f.h.state);assert.equal(f.h.state.elapsed,0);f.b.advance(1);f.h.tick();f.b.flush();assert.equal(f.h.state,null);assert.equal(f.g.state,null);assert.match(f.h.G.clubHerd.snapshot().notice,/did not finish loading/);assert.equal(f.h.save.clubHerdRecords.plays,undefined);assert.equal(f.g.save.clubHerdRecords.plays,undefined);
});

test('established six-second timeout begins after a late startup release instead of the original invitation time',()=>{
 const f=pair();riding(f);f.b.advance(29000);f.h.tick();f.b.flush();stage(f);assert.equal(f.h.state.startupWaiting,false);
 f.b.advance(5000);f.h.tick();f.b.flush();assert(f.h.state);f.b.advance(2100);f.h.tick();f.b.flush();assert.equal(f.h.state,null);assert.equal(f.g.state,null);assert.equal(f.h.save.clubHerdRecords.plays,undefined);
});

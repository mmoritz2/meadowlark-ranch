import test from 'node:test';
import assert from 'node:assert/strict';
import {safeHerdId,cleanHerdName,validateHerdSession,validateHerdMember,validateHerdFrame,
 validateHerdInput,herdPressureSources,canStartHerd,herdRecordResult,
 HERD_TTL,HERD_LIFETIME,HERD_BOUNDS,HERD_PEN,HERD_NAMES} from '../assets/club-herd-protocol.mjs';
const NOW=1000000, SID='host-drive-1', CODE='meadow-club';
const copy=v=>JSON.parse(JSON.stringify(v));
const roster=(n=2)=>Array.from({length:n},(_,slot)=>({id:slot?'guest'+slot:'host',name:slot?'Guest '+slot:'Host',ready:true,slot}));
const session=(extra={})=>({kind:'session',id:'host',n:'Host',hostId:'host',code:CODE,sid:SID,
 rev:1,at:NOW,createdAt:NOW-2000,expiresAt:NOW+HERD_TTL,status:'waiting',roster:roster(),...extra});
const member=(id='guest1',extra={})=>({kind:'member',id,n:id==='host'?'Host':'Guest',sid:SID,
 rev:1,at:NOW,ready:true,left:false,...extra});
const riding=(extra={})=>session({status:'riding',startAt:NOW-1000,...extra});
const input=(id='guest1',extra={})=>({kind:'input',id,n:id==='host'?'Host':'Guest',sid:SID,
 seq:1,at:NOW,x:id==='host'?-91:-83,z:8,active:true,...extra});
const frame=(extra={})=>({kind:'frame',id:'host',n:'Host',sid:SID,seq:1,at:NOW,state:{
 host:true,sessionId:SID,active:true,countdown:0,elapsed:1,penned:0,total:5,finished:false,paused:false,
 horses:HERD_NAMES.map((name,i)=>({name,x:-83+i*2,z:8,heading:1.5,phase:i,penned:false})),
 pen:{...HERD_PEN},bounds:{...HERD_BOUNDS}},...extra});
const sessionOptions=(extra={})=>({now:NOW,code:CODE,...extra});
const options=(extra={})=>({now:NOW,session:riding(),...extra});
const proof=(extra={})=>({runId:SID,elapsed:75,total:5,penned:5,participants:['Host','Guest'],at:NOW,...extra});
const pennedFrame=(count=5)=>{const m=frame();m.state.penned=count;m.state.finished=count===5;
 for(let i=0;i<count;i++)Object.assign(m.state.horses[i],{x:-44,z:-8,penned:true});return m;};

test('IDs exclude path separators, inherited keys and unbounded envelopes; names sanitize control text',()=>{
 assert.equal(safeHerdId(SID),true);
 for(const id of ['','__proto__','constructor','prototype','host/pos','x'.repeat(97),null,12])assert.equal(safeHerdId(id),false);
 assert.equal(cleanHerdName('  Guest\n One\u0000  ',14),'Guest  One');
 assert.equal(cleanHerdName('01234567890123456'),'01234567890123');
 assert.equal(cleanHerdName(9),'');
});

test('waiting session admits a detached host/guest roster without claiming authentication',()=>{
 const original=session(),valid=validateHerdSession(SID,original,sessionOptions());
 assert.ok(valid);assert.equal(valid.runId,SID);assert.equal(valid.roster.length,2);
 valid.roster[1].ready=false;assert.equal(original.roster[1].ready,true);
 assert.equal(Object.hasOwn(valid,'authenticated'),false);
});

test('wrong club, topic session, host envelope and kind are rejected',()=>{
 for(const change of [{code:'other-club'},{sid:'host-other'},{id:'guest1'},{hostId:'guest1'},{kind:'frame'},{runId:'other-run'}])
  assert.equal(validateHerdSession(SID,session(change),sessionOptions()),null);
 assert.equal(validateHerdSession('other-topic',session(),sessionOptions()),null);
});

test('session expiry, stale packets, future timestamps and45minute lifetime are bounded',()=>{
 for(const change of [{at:NOW-HERD_TTL-1},{at:NOW+2001},{expiresAt:NOW},{expiresAt:NOW+HERD_TTL+1},
  {createdAt:NOW-HERD_LIFETIME-1},{createdAt:NOW+1},{expiresAt:Infinity},{rev:0}])
  assert.equal(validateHerdSession(SID,session(change),sessionOptions()),null);
 assert.ok(validateHerdSession(SID,session({at:NOW+2000,expiresAt:NOW+HERD_TTL}),sessionOptions()));
});

test('roster rejects excess riders, duplicate IDs/slots, missing host and reassigned host slot',()=>{
 const bad=[roster(5),[...roster(),{id:'guest1',name:'Again',ready:true,slot:2}],
  [{...roster()[0]}, {...roster()[1],slot:0}], [{id:'guest1',name:'Guest',ready:true,slot:0}],
  [{id:'host',name:'Host',ready:true,slot:1}]];
 for(const r of bad)assert.equal(validateHerdSession(SID,session({roster:r}),sessionOptions()),null);
 assert.ok(validateHerdSession(SID,session({roster:roster(4)}),sessionOptions()));
});

test('revision replay, ownership changes and session-state regression cannot replace a known session',()=>{
 const known=validateHerdSession(SID,riding(),sessionOptions());
 assert.equal(validateHerdSession(SID,riding(),sessionOptions({known})),null);
 assert.equal(validateHerdSession(SID,session({rev:2}),sessionOptions({known})),null);
 assert.equal(validateHerdSession(SID,riding({rev:2,createdAt:NOW-1999}),sessionOptions({known})),null);
 assert.equal(validateHerdSession(SID,riding({rev:2,startAt:NOW-900}),sessionOptions({known})),null);
 const done=validateHerdSession(SID,riding({rev:2,status:'finished'}),sessionOptions({known}));assert.ok(done);
 assert.equal(validateHerdSession(SID,riding({rev:3}),sessionOptions({known:done})),null);
});

test('running roster can lose a rider but cannot substitute a new rider into their slot',()=>{
 const known=validateHerdSession(SID,riding(),sessionOptions());
 assert.ok(validateHerdSession(SID,riding({rev:2,roster:roster(1)}),sessionOptions({known})));
 const r=roster();r[1]={id:'replacement',name:'Replacement',slot:1,ready:true};
 assert.equal(validateHerdSession(SID,riding({rev:2,roster:r}),sessionOptions({known})),null);
});

test('a waiting join request is validated before admission but cannot yet affect the herd',()=>{
 const s=session({roster:roster(1)}),m=member();
 assert.ok(validateHerdMember(m,{now:NOW,session:s}));
 assert.equal(validateHerdInput(input(),{now:NOW,session:riding({roster:roster(1)})}),null);
 assert.deepEqual(herdPressureSources([input()],{now:NOW,roster:s.roster,selfId:'host'}),[]);
});

test('member requests reject full waiting rosters, running outsiders, malformed booleans and stale messages',()=>{
 assert.equal(validateHerdMember(member('guest4'),{now:NOW,session:session({roster:roster(4)})}),null);
 assert.equal(validateHerdMember(member('outsider'),options()),null);
 for(const change of [{ready:1},{left:true,ready:true},{at:NOW-HERD_TTL-1},{sid:'other'}, {kind:'input'}])
  assert.equal(validateHerdMember(member('guest1',change),options()),null);
});

test('member revisions and timestamp order reject replay but permit voluntary readiness changes',()=>{
 const known=validateHerdMember(member(),options());assert.ok(known);
 assert.equal(validateHerdMember(member(),options({known})),null);
 assert.equal(validateHerdMember(member('guest1',{rev:2,at:NOW-1}),options({known})),null);
 assert.ok(validateHerdMember(member('guest1',{rev:2,ready:false}),options({known})));
 assert.ok(validateHerdMember(member('guest1',{rev:2,ready:false,left:true}),options({known})));
});

test('host frame preserves host flag, exact pen/bounds and detaches arrays',()=>{
 const m=frame(),v=validateHerdFrame(m,options());assert.ok(v);
 assert.equal(v.state.host,true);assert.deepEqual(v.state.bounds,HERD_BOUNDS);assert.deepEqual(v.state.pen,HERD_PEN);
 v.state.horses[0].x=-90;assert.equal(m.state.horses[0].x,-83);
 const noBounds=frame();delete noBounds.state.bounds;assert.ok(validateHerdFrame(noBounds,options()));
});

test('guest cannot publish a herd frame; wrong session, wrong room, stale and reordered frames are rejected',()=>{
 for(const change of [{id:'guest1'},{sid:'other'},{code:'other-club'},{at:NOW-HERD_TTL-1},{seq:0},{kind:'session'}])
  assert.equal(validateHerdFrame(frame(change),options()),null);
 assert.equal(validateHerdFrame(frame(),options({lastSeq:1})),null);
 assert.equal(validateHerdFrame(frame(),options({lastSeq:NaN})),null);
 assert.equal(validateHerdFrame(frame(),{now:NOW,session:session()}),null);
});

test('frame requires exactly the five known horses and finite pasture positions',()=>{
 const variants=[];
 let m=frame();m.state.horses[0].name='Invented';variants.push(m);
 m=frame();m.state.horses[1].name=m.state.horses[0].name;variants.push(m);
 m=frame();m.state.horses.pop();variants.push(m);
 m=frame();m.state.horses[0].x=HERD_BOUNDS.x1-.01;variants.push(m);
 m=frame();m.state.horses[0].heading=Infinity;variants.push(m);
 m=frame();m.state.horses[0].phase=NaN;variants.push(m);
 m=frame();m.state.host=false;variants.push(m);
 m=frame();m.state.pen.r=8;variants.push(m);
 m=frame();m.state.bounds.x1=-1000;variants.push(m);
 for(const v of variants)assert.equal(validateHerdFrame(v,options()),null);
});

test('pen count matches flags and each penned horse has crossed into the actual pen',()=>{
 assert.ok(validateHerdFrame(pennedFrame(1),options()));
 const mismatched=frame();mismatched.state.penned=1;assert.equal(validateHerdFrame(mismatched,options()),null);
 const outside=frame();outside.state.penned=1;outside.state.horses[0].penned=true;
 assert.equal(validateHerdFrame(outside,options()),null);
 const all=pennedFrame();all.state.finished=false;assert.equal(validateHerdFrame(all,options()),null);
 assert.ok(validateHerdFrame(pennedFrame(),options()));
});

test('elapsed and individual pen flags stay monotonic even if count remains unchanged',()=>{
 const first=pennedFrame(1),known=validateHerdFrame(first,options());assert.ok(known);
 const second=copy(first);second.seq=2;second.state.elapsed=2;assert.ok(validateHerdFrame(second,options({lastSeq:1,known})));
 second.state.elapsed=.9;assert.equal(validateHerdFrame(second,options({lastSeq:1,known})),null);
 second.state.elapsed=2;second.state.horses[0].penned=false;Object.assign(second.state.horses[1],{penned:true,x:-44,z:-8});
 assert.equal(validateHerdFrame(second,options({lastSeq:1,known})),null);
});

test('finished snapshot cannot reopen; partial timeout may display but cannot record a completed herd',()=>{
 const done=pennedFrame();done.state.active=false;const known=validateHerdFrame(done,options());assert.ok(known);
 const reopened=frame({seq:2});reopened.state.elapsed=2;assert.equal(validateHerdFrame(reopened,options({known,lastSeq:1})),null);
 const partial=pennedFrame(2);partial.state.finished=true;partial.state.active=false;
 assert.ok(validateHerdFrame(partial,options({session:riding({status:'finished'})})));
 assert.equal(herdRecordResult({},proof({penned:2})),null);
});

test('only admitted ready riders can submit fresh active or inactive inputs',()=>{
 assert.ok(validateHerdInput(input(),options()));
 assert.ok(validateHerdInput(input('guest1',{active:false}),options()));
 assert.equal(validateHerdInput(input('outsider'),options()),null);
 const r=roster();r[1].ready=false;assert.equal(validateHerdInput(input(),options({session:riding({roster:r})})),null);
});

test('inputs reject stale/reordered/wrong-room packets and implausible coordinates',()=>{
 for(const change of [{at:NOW-1801},{at:NOW+2001},{seq:0},{sid:'other'},{code:'other-club'},
  {x:NaN},{z:Infinity},{x:HERD_BOUNDS.x1-12.01},{active:1}])
  assert.equal(validateHerdInput(input('guest1',change),options()),null);
 assert.equal(validateHerdInput(input(),options({lastSeq:1})),null);
 assert.equal(validateHerdInput(input(),options({session:riding({status:'finished'})})),null);
 assert.ok(validateHerdInput(input('guest1',{x:HERD_BOUNDS.x1-12}),options()));
});

test('two admitted client inputs provide two independent pressure sources without synthesized riders',()=>{
 const host=validateHerdInput(input('host'),options()),guest=validateHerdInput(input(),options());
 const sources=herdPressureSources(new Map([['host',host],['guest1',guest]]),{now:NOW,roster:roster(),selfId:'host'});
 assert.deepEqual(sources,[{id:'host',x:-91,z:8,slot:0},{id:'guest1',x:-83,z:8,slot:1}]);
 assert.deepEqual(herdPressureSources(new Map([['host',host]]),{now:NOW,roster:roster(),selfId:'host'}),sources.slice(0,1));
 assert.deepEqual(herdPressureSources([],{now:NOW,roster:roster(),selfId:'host'}),[]);
});

test('pressure excludes unadmitted/unready/stale/inactive input and never substitutes a duplicate ID',()=>{
 const r=roster(3);r[2].ready=false;
 const inputs=[input('host'),input(),input('guest2'),input('outsider'),input('guest1',{seq:2,x:-88}),input('host',{seq:2,active:false})];
 assert.deepEqual(herdPressureSources(inputs,{now:NOW,roster:r,selfId:'host'}),[{id:'guest1',x:-88,z:8,slot:1}]);
 assert.deepEqual(herdPressureSources([input('host',{at:NOW-1801})],{now:NOW,roster:r,selfId:'host'}),[]);
 assert.deepEqual(herdPressureSources(inputs,{now:NOW,roster:r,selfId:'outsider'}),[]);
});

test('a newer stale or paused observation cannot fall back to older active pressure',()=>{
 const older=input('guest1',{seq:1}),newer=input('guest1',{seq:2,active:false});
 assert.deepEqual(herdPressureSources([older,newer],{now:NOW,roster:roster(),selfId:'host'}),[]);
 newer.active=true;newer.at=NOW-1801;
 assert.deepEqual(herdPressureSources([older,newer],{now:NOW,roster:roster(),selfId:'host'}),[]);
});

test('start needs2–4 admitted ready fresh riders including the host; only host may start',()=>{
 const s=session(),members=new Map([['host',member('host')],['guest1',member()]]);
 assert.equal(canStartHerd(s,members,{now:NOW,selfId:'host'}),true);
 assert.equal(canStartHerd(s,members,{now:NOW,selfId:'guest1'}),false);
 assert.equal(canStartHerd(session({roster:roster(1)}),members,{now:NOW,selfId:'host'}),false);
 const four=session({roster:roster(4)});
 assert.equal(canStartHerd(four,roster(4).map(p=>member(p.id)),{now:NOW,selfId:'host'}),true);
});

test('start cannot use stale/left/unready/missing members, readiness replay or a terminal session',()=>{
 const s=session(),good=[member('host'),member()];
 for(const change of [{at:NOW-HERD_TTL-1},{left:true},{ready:false},{sid:'other'},{rev:0}])
  assert.equal(canStartHerd(s,[good[0],member('guest1',change)],{now:NOW,selfId:'host'}),false);
 assert.equal(canStartHerd(s,[good[0]],{now:NOW,selfId:'host'}),false);
 assert.equal(canStartHerd(s,[...good,member('guest1',{rev:2,ready:false})],{now:NOW,selfId:'host'}),false);
 assert.equal(canStartHerd(riding(),good,{now:NOW,selfId:'host'}),false);
 const noHost=session({roster:[{id:'guest1',name:'Guest1',slot:1,ready:true},{id:'guest2',name:'Guest2',slot:2,ready:true}]});
 assert.equal(canStartHerd(noHost,good,{now:NOW,selfId:'host'}),false);
});

test('first completed shared practice records only a personal time receipt',()=>{
 const result=herdRecordResult(null,proof());assert.ok(result);
 assert.deepEqual(Object.keys(result.save).sort(),['bestTime','lastRunId','plays','receipts']);
 assert.equal(result.save.plays,1);assert.equal(result.save.bestTime,75);assert.equal(result.deduped,false);
 assert.equal(result.receipt.saved,true);assert.equal(result.receipt.newBest,true);
 for(const key of ['coins','gems','keys','pay','score','medal','roundupBest','clubRally'])assert.equal(Object.hasOwn(result.receipt,key),false);
});

test('repeated finish returns the exact original receipt and never adds a play or a best time',()=>{
 const first=herdRecordResult({},proof());
 const second=herdRecordResult(first.save,proof({at:NOW+1}));
 assert.equal(second.deduped,true);assert.equal(second.save.plays,1);assert.equal(second.save.bestTime,75);
 assert.deepEqual(second.receipt,first.receipt);
});

test('best time remains separate from the most recent attempt; a faster next run improves it',()=>{
 const first=herdRecordResult({},proof());
 const slower=herdRecordResult(first.save,proof({runId:'host-drive-2',elapsed:90,at:NOW+1}));
 assert.equal(slower.save.plays,2);assert.equal(slower.receipt.newBest,false);assert.equal(slower.receipt.bestTime,75);
 const faster=herdRecordResult(slower.save,proof({runId:'host-drive-3',elapsed:60,at:NOW+2}));
 assert.equal(faster.save.plays,3);assert.equal(faster.save.bestTime,60);assert.equal(faster.receipt.newBest,true);
});

test('partial, malformed, solo and excess-player results cannot become a shared finish receipt',()=>{
 for(const change of [{penned:4},{total:3},{runId:'bad/run'},{elapsed:0},{elapsed:NaN},{elapsed:HERD_LIFETIME/1000+1},
  {participants:['Solo']},{participants:['A','B','C','D','E']},{participants:['Host','']},{at:0}])
  assert.equal(herdRecordResult({},proof(change)),null);
 // Names are presentation, not authenticated identity: two real clients may use the same name.
 assert.ok(herdRecordResult({},proof({participants:['Rider','Rider']})));
});

test('record receipts stay bounded at100 while retaining the new receipt despite clock movement',()=>{
 let record={};for(let i=0;i<102;i++)record=herdRecordResult(record,proof({runId:'host-attempt-'+i,at:NOW+i})).save;
 assert.equal(record.plays,102);assert.equal(Object.keys(record.receipts).length,100);
 assert.equal(Object.hasOwn(record.receipts,'host-attempt-0'),false);
 const next=herdRecordResult(record,proof({runId:'host-clock-change',at:1}));
 assert.equal(Object.keys(next.save.receipts).length,100);assert.equal(next.save.lastRunId,'host-clock-change');
 assert.ok(next.save.receipts['host-clock-change']);
});

test('recording never mutates the game wallet, solo records, rally state, input or returned prior record',()=>{
 const ranch={coins:123,gems:7,roundupBest:{full:{plays:3}},clubRally:{points:100},clubHerdRecords:{}};
 const before=JSON.stringify(ranch),p=Object.freeze({...proof(),participants:Object.freeze(['Host','Guest'])});
 const first=herdRecordResult(ranch.clubHerdRecords,p);assert.equal(JSON.stringify(ranch),before);
 const savedBefore=JSON.stringify(first.save),second=herdRecordResult(first.save,proof({runId:'host-next'}));
 assert.equal(JSON.stringify(first.save),savedBefore);
 second.receipt.participants[0]='Edited';assert.equal(second.save.receipts['host-next'].participants[0],'Host');
});


test('two-second member heartbeats expire for starting after6seconds even while session remains live',()=>{
 const s=session(),host=member('host');
 assert.equal(canStartHerd(s,[host,member('guest1',{at:NOW-6000})],{now:NOW,selfId:'host'}),true);
 assert.equal(canStartHerd(s,[host,member('guest1',{at:NOW-6001})],{now:NOW,selfId:'host'}),false);
});

test('penned positions tolerate at most1cm of snapshot rounding at the actual pen edge',()=>{
 const m=pennedFrame(1);m.state.horses[0].x=HERD_PEN.x+HERD_PEN.r+.005;
 assert.ok(validateHerdFrame(m,options()));
 m.state.horses[0].x=HERD_PEN.x+HERD_PEN.r+.011;
 assert.equal(validateHerdFrame(m,options()),null);
});

test('same-run conflicting result cannot replace or reuse an incompatible practice receipt',()=>{
 const first=herdRecordResult({},proof()),before=JSON.stringify(first.save);
 for(const change of [{elapsed:74},{participants:['Other','Guest']},{participants:['Guest','Host']},{total:3},{penned:4}])
  assert.equal(herdRecordResult(first.save,proof(change)),null);
 assert.equal(JSON.stringify(first.save),before);
});


test('legacy shared frames default startup hold to false without mutating source state',()=>{
 const m=frame(),before=JSON.stringify(m),v=validateHerdFrame(m,options());assert.ok(v);
 assert.equal(v.state.startupWaiting,false);assert.equal(JSON.stringify(m),before);
 m.state.startupWaiting=false;assert.equal(validateHerdFrame(m,options()).state.startupWaiting,false);
});

test('startup hold preserves initial3second countdown and zero progress including while paused',()=>{
 const m=frame();Object.assign(m.state,{startupWaiting:true,countdown:3,elapsed:0});
 const v=validateHerdFrame(m,options());assert.ok(v);assert.equal(v.state.startupWaiting,true);
 assert.equal(v.state.countdown,3);assert.equal(v.state.elapsed,0);assert.equal(v.state.penned,0);
 m.state.paused=true;assert.ok(validateHerdFrame(m,options()));
 const again=copy(m);again.seq=2;
 assert.ok(validateHerdFrame(again,options({known:v,lastSeq:1})));
});

test('startupWaiting accepts only an optional boolean',()=>{
 for(const flag of [null,0,1,'true',{},[]]){
  const m=frame();Object.assign(m.state,{startupWaiting:flag,countdown:3,elapsed:0});
  assert.equal(validateHerdFrame(m,options()),null);
 }
});

test('startup hold cannot claim advancing time, partial countdown, penned horses or a finished drive',()=>{
 for(const change of [{elapsed:.001},{countdown:2.9},{countdown:0},{countdown:4},{finished:true},{active:false}]){
  const m=frame();Object.assign(m.state,{startupWaiting:true,countdown:3,elapsed:0,...change});
  assert.equal(validateHerdFrame(m,options()),null);
 }
 const penned=pennedFrame(1);Object.assign(penned.state,{startupWaiting:true,countdown:3,elapsed:0});
 assert.equal(validateHerdFrame(penned,options()),null);
});

test('released startup countdown cannot be re-entered or rewound by a later frame',()=>{
 const held=frame();Object.assign(held.state,{startupWaiting:true,countdown:3,elapsed:0});
 const known=validateHerdFrame(held,options());assert.ok(known);
 const release=copy(held);release.seq=2;release.state.startupWaiting=false;release.state.countdown=2.85;
 const released=validateHerdFrame(release,options({known,lastSeq:1}));assert.ok(released);
 const rehold=copy(held);rehold.seq=3;
 assert.equal(validateHerdFrame(rehold,options({known:released,lastSeq:2})),null);
 const legacy=copy(release);delete legacy.state.startupWaiting;
 const legacyKnown=validateHerdFrame(legacy,options({known,lastSeq:1}));assert.ok(legacyKnown);
 assert.equal(legacyKnown.state.startupWaiting,false);
 assert.equal(validateHerdFrame(rehold,options({known:legacyKnown,lastSeq:2})),null);
});

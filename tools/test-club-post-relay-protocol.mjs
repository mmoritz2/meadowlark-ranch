import test from 'node:test';
import assert from 'node:assert/strict';
import {safeRelayId,cleanRelayName,validateRelaySession,validateRelayMember,validateRelayInput,validateRelayAction,validateRelayFrame,canStartRelay,relayRecordResult,RELAY_TTL,RELAY_LIFETIME,RELAY_INPUT_MAX_AGE,RELAY_MEMBER_MAX_AGE,RELAY_BOUNDS} from '../assets/club-post-relay-protocol.mjs';
const NOW=1000000,CREATED=NOW-200000,CODE='ranch-club',SID=`host-${CREATED.toString(36)}-abc12`;
const copy=v=>structuredClone(v);
const roster=()=>[{id:'host',name:'Host',ready:true,slot:0},{id:'guest',name:'Guest',ready:true,slot:1}];
const session=(extra={})=>({kind:'session',id:'host',n:'Host',hostId:'host',code:CODE,sid:SID,runId:SID,rev:1,at:NOW,createdAt:CREATED,expiresAt:NOW+RELAY_TTL,status:'waiting',firstId:'host',roster:roster(),...extra});
const riding=(extra={})=>session({status:'riding',startAt:NOW-150000,...extra});
const opts=(extra={})=>({now:NOW,session:riding(),...extra});
const member=(id='guest',extra={})=>({kind:'member',id,n:id,sid:SID,rev:1,at:NOW,ready:true,left:false,...extra});
const input=(id='guest',extra={})=>({kind:'input',id,n:id,sid:SID,seq:1,at:NOW,x:0,z:-20,speed:4,active:true,ready:true,grounded:true,canJump:true,...extra});
const action=(extra={})=>({kind:'action',id:'guest',n:'Guest',sid:SID,seq:1,at:NOW,action:'offer',stateRev:1,inputSeq:1,...extra});
const stages=['collect','outbound','passPost','deliver','backToPines','passReply','home','finished'];
function frame(stage='collect',extra={}){
 const i=stages.indexOf(stage),values=[[0,0,0,0],[10,0,0,0],[30,0,0,0],[30,20,0,0],[30,45,20,0],[30,45,45,0],[30,45,45,15],[30,45,45,30]][i];
 return {kind:'frame',id:'host',n:'Host',sid:SID,seq:i+1,at:NOW,inputs:[input('host'),input()],state:{sessionId:SID,stage,carrierId:i===0||i===7?null:i<=2||i===6?'host':'guest',firstId:'host',otherId:'guest',route:'road',returnRoute:'road',rev:i+1,
  elapsed:i*15,distance:values.reduce((a,b)=>a+b,0),handoffs:i<=2?0:i<=5?1:2,offer:null,startupWaiting:i===0,paused:i===0,finished:i===7,legs:Object.fromEntries(['outbound','deliver','backToPines','home'].map((k,j)=>[k,values[j]])),completedAt:i===7?NOW:null},...extra};
}
const proof=(extra={})=>({runId:SID,elapsed:100,distance:170,participants:[{id:'host',name:'Host'},{id:'guest',name:'Guest'}],firstId:'host',otherId:'guest',handoffs:2,at:CREATED,...extra});
const validSession=(m,known)=>validateRelaySession(SID,m,{now:NOW,code:CODE,known});

test('identifiers reject unsafe keys and names remove control characters',()=>{
 assert(safeRelayId(SID));for(const id of ['',null,2,'__proto__','constructor','prototype','a/b','x'.repeat(97)])assert.equal(safeRelayId(id),false);
 assert.equal(cleanRelayName('  A\nB\u0000  '),'A B');assert.equal(cleanRelayName(7),'');assert.equal(cleanRelayName('x'.repeat(20)).length,14);
});
test('waiting sessions have one or two unique slots and running sessions require exact crew and roles',()=>{
 const one=roster().slice(0,1);assert(validSession(session({roster:one})));
 assert(validSession(riding()));
 for(const m of [riding({roster:one}),riding({firstId:'outsider'}),riding({startAt:null}),session({roster:[...roster(),{id:'third',name:'Third',slot:2,ready:true}]}),session({roster:[roster()[0],{...roster()[1],slot:0}]}),session({roster:[roster()[0],{...roster()[1],id:'host'}]})])assert.equal(validSession(m),null);
 const source=session(),valid=validSession(source);valid.roster[0].name='Different';assert.equal(source.roster[0].name,'Host');
});
test('session ownership, code, expiry, lifetime and revision order are enforced',()=>{
 for(const patch of [{id:'guest'},{code:'other'},{sid:'wrong'},{hostId:'guest'},{rev:0},{at:NOW-RELAY_TTL-1},{at:NOW+2001},{expiresAt:NOW},{expiresAt:NOW+RELAY_TTL+1},{createdAt:NOW-RELAY_LIFETIME-1}])assert.equal(validSession(session(patch)),null);
 const known=validSession(riding());assert.equal(validSession(riding(),known),null);
 for(const patch of [{status:'waiting'},{firstId:'guest'},{startAt:known.startAt+1},{roster:roster().slice(0,1)},{roster:[roster()[0],{...roster()[1],id:'replacement'}]}])assert.equal(validSession(riding({rev:2,...patch}),known),null);
 const ended=validSession(riding({status:'finished',rev:2}),known);assert(ended);assert.equal(validSession(riding({rev:3}),ended),null);
});
test('waiting member admission is limited to the second rider and updates cannot replay',()=>{
 assert(validateRelayMember(member(),opts({session:session({roster:roster().slice(0,1)})})));
 assert.equal(validateRelayMember(member('third'),opts({session:session()})),null);
 assert.equal(validateRelayMember(member('third'),opts()),null);
 const known=validateRelayMember(member(),opts());assert(known);
 assert.equal(validateRelayMember(member(),opts({known})),null);
 assert.equal(validateRelayMember(member('guest',{rev:2,at:NOW-1}),opts({known})),null);
 assert(validateRelayMember(member('guest',{rev:2,ready:false,left:true}),opts({known})));
 assert.equal(validateRelayMember(member('guest',{left:true}),opts()),null);
});
test('only a host with exactly two fresh independently ready members can start',()=>{
 const s=session(),members=[member('host'),member()];assert.equal(canStartRelay(s,members,{now:NOW,selfId:'host'}),true);
 assert.equal(canStartRelay(s,members,{now:NOW,selfId:'guest'}),false);
 assert.equal(canStartRelay(s,[member('host')],{now:NOW,selfId:'host'}),false);
 for(const bad of [member('guest',{at:NOW-RELAY_MEMBER_MAX_AGE-1}),member('guest',{ready:false}),member('guest',{ready:false,left:true})])assert.equal(canStartRelay(s,[member('host'),bad],{now:NOW,selfId:'host'}),false);
 assert.equal(canStartRelay(s,[...members,member('guest',{rev:2,ready:false})],{now:NOW,selfId:'host'}),false,'newer unready packet cannot fall back to old ready data');
});
test('inputs enforce the real area, finite speed, admitted crew, booleans and short freshness',()=>{
 assert(validateRelayInput(input(),opts()));assert(validateRelayInput(input(),opts({session:session()})));
 for(const patch of [{id:'other'},{seq:0},{x:RELAY_BOUNDS.x1-.01},{z:RELAY_BOUNDS.z2+.01},{x:NaN},{speed:50.01},{speed:-50.01},{active:1},{grounded:1},{canJump:null},{ready:'yes'},{at:NOW-RELAY_INPUT_MAX_AGE-1},{at:NOW+2001},{sid:'other'}])assert.equal(validateRelayInput(input('guest',patch),opts()),null);
 assert(validateRelayInput(input('guest',{speed:-50,x:-60,z:-85}),opts()));
});
test('input continuity rejects replay, clock reversal and large jumps with a capped time allowance',()=>{
 const known=input('guest',{at:NOW-100,x:0,speed:4});
 assert(validateRelayInput(input('guest',{seq:2,x:8}),opts({known})));
 assert.equal(validateRelayInput(input('guest',{seq:2,x:8.01}),opts({known})),null);
 assert.equal(validateRelayInput(input('guest',{seq:1}),opts({known})),null);
 assert.equal(validateRelayInput(input('guest',{seq:2,at:known.at-1}),opts({known})),null);
 const fast=input('guest',{at:NOW-1000,x:-30,speed:50});
 assert(validateRelayInput(input('guest',{seq:2,x:32,speed:50}),opts({known:fast})));
 assert.equal(validateRelayInput(input('guest',{seq:2,x:32.01,speed:50}),opts({known:fast})),null,'long gaps are capped to half a second of position allowance');
});
test('actions require admitted riders, exact context counters and explicit accept/route payloads',()=>{
 for(const kind of ['collect','offer','exchange','return'])assert(validateRelayAction(action({action:kind}),opts()));
 assert(validateRelayAction(action({action:'accept',offerId:'offer-1'}),opts()));assert(validateRelayAction(action({action:'route',route:'woodland'}),opts()));
 for(const patch of [{id:'outsider'},{action:'reward'},{action:'accept'},{action:'route'},{route:'shortcut'},{offerId:'../x'},{stateRev:0},{inputSeq:0},{seq:0},{at:NOW-1801}])assert.equal(validateRelayAction(action(patch),opts()),null);
 assert.equal(validateRelayAction(action(),opts({lastSeq:1})),null);assert.equal(validateRelayAction(action(),opts({session:session()})),null);
});
test('all relay stages admit only their real carrier, two handoffs and minimum ridden legs',()=>{
 let known;for(const stage of stages){const m=frame(stage),valid=validateRelayFrame(m,opts({known}));assert(valid,stage);known=valid;
  for(const key of ['carrierId','handoffs']){const bad=copy(m);bad.state[key]=key==='carrierId'?'outsider':3;assert.equal(validateRelayFrame(bad,opts()),null);}}
 for(const [stage,key] of [['passPost','outbound'],['backToPines','deliver'],['passReply','backToPines'],['finished','home']]){const m=frame(stage);m.state.legs[key]-=.01;assert.equal(validateRelayFrame(m,opts()),null);}
});
test('frames enforce host ownership, packet order, finite totals and immutable completed outcomes',()=>{
 for(const patch of [{id:'guest'},{seq:0},{sid:'wrong'},{at:NOW-8001}])assert.equal(validateRelayFrame(frame('outbound',patch),opts()),null);
 const known=validateRelayFrame(frame('home'),opts());assert(known);
 assert.equal(validateRelayFrame(frame('home'),opts({known})),null);
 const back=frame('deliver',{seq:9});back.state.rev=9;assert.equal(validateRelayFrame(back,opts({known})),null);
 const done=validateRelayFrame(frame('finished'),opts({known}));assert(done);
 const changed=frame('finished',{seq:9});changed.state.completedAt--;assert.equal(validateRelayFrame(changed,opts({known:done})),null);
 for(const patch of [{elapsed:NaN},{distance:Infinity},{finished:true},{startupWaiting:true},{completedAt:NOW}]){const m=frame('outbound');Object.assign(m.state,patch);assert.equal(validateRelayFrame(m,opts()),null);}
});
test('offer packets require the actual passing stage, sender, receiver, revision and kind',()=>{
 for(const [stage,from,to,kind] of [['passPost','host','guest','post'],['passReply','guest','host','reply']]){
  const m=frame(stage);m.state.offer={id:'offer-1',from,to,kind,at:NOW-100,rev:m.state.rev};assert(validateRelayFrame(m,opts()));
  for(const patch of [{from:to},{to:from},{rev:99},{kind:'other'},{at:NOW+1}]){const bad=copy(m);Object.assign(bad.state.offer,patch);assert.equal(validateRelayFrame(bad,opts()),null);}
 }
 const wrong=frame('outbound');wrong.state.offer={id:'offer',from:'host',to:'guest',kind:'post',at:NOW,rev:wrong.state.rev};assert.equal(validateRelayFrame(wrong,opts()),null);
});
test('route choices tolerate skipped deliver frames but become fixed at the exchange',()=>{
 const start=validateRelayFrame(frame('outbound'),opts()),change=frame('backToPines');change.state.route='woodland';change.state.returnRoute='woodland';
 const accepted=validateRelayFrame(change,opts({known:start}));assert(accepted);
 const wrong=frame('passReply');wrong.state.route='road';wrong.state.returnRoute='road';assert.equal(validateRelayFrame(wrong,opts({known:accepted})),null);
 const mismatched=frame('backToPines');mismatched.state.returnRoute='woodland';assert.equal(validateRelayFrame(mismatched,opts()),null);
});
test('frame telemetry is detached, admitted, bounded, unique and may remain stale while paused',()=>{
 const m=frame('passPost');m.inputs[1].at=NOW-30000;const accepted=validateRelayFrame(m,opts());assert(accepted);assert.equal(accepted.inputs[1].at,NOW-30000);
 accepted.inputs[1].x=17;assert.equal(m.inputs[1].x,0);
 for(const list of [[input(),input()], [input('other')], [input('guest',{x:66})], [input('guest',{at:CREATED-1})], [input('guest',{at:NOW+2001})], [input('guest',{speed:Infinity})], [input('guest',{grounded:null})]])assert.equal(validateRelayFrame(frame('passPost',{inputs:list}),opts()),null);
});
test('finished session arriving before its frame permits only the matching completed snapshot',()=>{
 assert(validateRelayFrame(frame('finished'),opts({session:riding({status:'finished'})})));
 assert.equal(validateRelayFrame(frame('home'),opts({session:riding({status:'finished'})})),null);
 const expired=riding({status:'finished',at:NOW-1000,expiresAt:NOW-100});assert(validateRelayFrame(frame('finished'),opts({session:expired})));
 assert.equal(validateRelayFrame(frame('finished'),opts({session:{...expired,expiresAt:NOW-8001}})),null);
});
test('completion records contain only two real roles and a stable timestamp-bound run identity',()=>{
 const out=relayRecordResult(null,proof());assert(out);assert.equal(out.save.plays,1);assert.equal(out.receipt.saved,true);assert.equal(out.receipt.handoffs,2);
 for(const patch of [{handoffs:1},{distance:149.99},{elapsed:0},{elapsed:Infinity},{at:CREATED+1},{firstId:'guest',otherId:'guest'},{participants:[{id:'host',name:'Host'}]},{participants:[{id:'host',name:'A'},{id:'host',name:'B'}]},{runId:'unbound-run'}])assert.equal(relayRecordResult(null,proof(patch)),null);
 assert.equal(Object.hasOwn(out.save,'coins'),false);assert.equal(Object.hasOwn(out.receipt,'reward'),false);
});
test('exact completion replay is idempotent and conflicts in time, roles, names or order reject',()=>{
 const first=relayRecordResult(null,proof()),saved=copy(first.save),again=relayRecordResult(saved,proof());assert.equal(again.deduped,true);assert.equal(again.save.plays,1);assert.deepEqual(saved,first.save);
 for(const patch of [{elapsed:101},{distance:171},{firstId:'guest',otherId:'host'},{participants:[{id:'host',name:'Changed'},{id:'guest',name:'Guest'}]},{participants:proof().participants.slice().reverse()},{at:CREATED+1}])assert.equal(relayRecordResult(saved,proof(patch)),null);
 again.receipt.participants[0].name='Mutation';assert.equal(saved.receipts[SID].participants[0].name,'Host');
});
test('32 receipts plus a creation-time watermark permanently prevent pruned completion replay',()=>{
 let saved=null;const proofs=[];
 for(let i=0;i<40;i++){const at=CREATED+i,p=proof({runId:`host-${at.toString(36)}-abc12`,at,elapsed:100-i});proofs.push(p);const out=relayRecordResult(saved,p);assert(out);saved=out.save;assert(Object.keys(saved.receipts).length<=32);}
 assert.equal(saved.plays,40);assert.equal(saved.bestTime,61);assert(saved.closedBefore>=proofs[7].at);
 assert.equal(relayRecordResult(saved,proofs[0]),null);
 assert.equal(relayRecordResult(saved,{...proofs[0],at:CREATED+1000}),null,'changing the date cannot revive a pruned stable run ID');
 assert.equal(relayRecordResult(saved,proofs[39]).deduped,true);
});


test('recovered oversized ledgers are bounded even on duplicate returns and carry no unrelated save fields',()=>{
 const old={plays:37,coins:9000,stats:{wins:99},receipts:{}};let last;
 for(let i=0;i<37;i++){const at=CREATED+i,p=proof({runId:`host-${at.toString(36)}-abc12`,at});old.receipts[p.runId]=relayRecordResult(null,p).receipt;last=p;}
 const snapshot=copy(old),out=relayRecordResult(old,last);assert(out.deduped);assert.equal(Object.keys(out.save.receipts).length,32);assert(out.save.closedBefore>=CREATED+4);
 assert.equal(Object.hasOwn(out.save,'coins'),false);assert.equal(Object.hasOwn(out.save,'stats'),false);assert.deepEqual(old,snapshot);
 assert.equal(relayRecordResult(out.save,proof()),null);
});

test('airborne telemetry remains usable while preserving a strict grounded flag for handoffs',()=>{
 const airborne=input('guest',{grounded:false});assert.equal(validateRelayInput(airborne,opts()).grounded,false);
 const accepted=validateRelayFrame(frame('passPost',{inputs:[airborne]}),opts());assert.equal(accepted.inputs[0].grounded,false);
});

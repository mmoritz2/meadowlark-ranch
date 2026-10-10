import {safeHerdId,cleanHerdName,validateHerdSession,validateHerdMember,validateHerdFrame,validateHerdInput,herdPressureSources,canStartHerd,herdRecordResult} from '../club-herd-protocol.mjs?v=club-herd-1';
// One volunteered host simulates the herd. This uses the game's existing
// friends-room transport; shared times never award solo medals or currency.
export const id='club-herd';
export function install(G){
 const N=G.net,S=G.save,core=G.roundup?.shared;if(!N||!core)return;
 const now=()=>Date.now(),me=()=>N.net.id,name=()=>cleanHerdName(N.myName())||'Rider';
 const sessions=new Map(),members=new Map(),inputs=new Map(),frames=new Map(),terminal=new Map();
 let scope='',currentId=null,self=null,seq=0,frameSeq=0,lastBeat=0,lastSend=0,lastNotice=0,notice='',lastResult=null,pendingResult=null;
 S.ensure(s=>{s.clubHerdRecords=s.clubHerdRecords||{};});
 try{const record=S.fresh()?.clubHerdRecords,r=record?.receipts?.[record.lastRunId],loaded=r?.saved===true&&herdRecordResult(record,r);if(loaded?.deduped)lastResult={...loaded.receipt,bestTime:loaded.save.bestTime};}catch{}
 const fail=reason=>({ok:false,reason}),copy=v=>JSON.parse(JSON.stringify(v));
 function context(){const c=G.clubs?.identity()||{};return {code:safeHerdId(c.code)?c.code:'',joined:!!c.founder&&!c.pendingJoin&&!c.canCreate};}
 const connected=()=>context().joined&&scope===context().code&&N.net.club===scope&&!!N.net.client?.connected;
 const topic=(kind,sid,pid)=>'srf1/'+scope+'/herddrive/'+kind+'/'+sid+(pid?'/'+pid:'');
 const rows=sid=>{if(!members.has(sid))members.set(sid,new Map());return members.get(sid);};
 const blocked=label=>{const s=S.fresh()||{};return !!s.blocked?.[label]||(s.tempMute?.[label]||0)>now();};
 function memberAllowed(pid){const c=G.clubs?.identity()||{},r=S.fresh()?.clubRecords?.[scope]?.members?.[pid];return pid===me()||c.founderId===pid||!!r&&!r.left||!!G.clubs?.memberRows?.().some(r=>r.id===pid);}
 function connectionReason(){if(!context().joined)return 'Join or create a club first.';if(N.net.club!==scope)return 'Connect to your club room to ride together.';if(!N.net.client?.connected)return 'Connect to your club to start a herd drive.';return '';}
 function busy(){
  const p=G.horse?.player,r=G.roundup.state(),rig=G.horse?.RIG?.();
  if(r.active||G.course?.get()||G.course?.drillActive?.()||G.rescueRide?.snapshot?.().active||G.trail?.ride)return 'Finish or leave your current activity first.';
  if(G.clubRides?.snapshot?.().current)return 'Leave your current riding party first.';
  if(p?.onFoot||G.onFoot?.on)return 'Mount your horse first.';
  if(p?.flying||p?.landing||(p?.y||0)>.15||G.worldPkg?.vehicle?.())return 'Land and finish your journey first.';
  if(G.social?.spectate||G.social?.tour)return 'Leave spectating or the ranch tour first.';
  if(rig&&(!rig.ready||rig.loadingBreed||rig.emote||rig.heroMotion?.state?.action))return 'Let your horse finish getting ready first.';
  return '';
 }
 function emit(){G.run('clubHerdChanged');}
 function publishSession(s){return N.publish(topic('session',s.sid),s,{retain:true});}
 function revise(s,patch={}){Object.assign(s,patch,{rev:s.rev+1,at:now(),expiresAt:Math.min(now()+45000,s.createdAt+2700000)});publishSession(s);}
 function publishSelf(){const s=sessions.get(currentId);if(!s||!self)return;self={...self,rev:self.rev+1,at:now()};rows(s.sid).set(me(),copy(self));N.publish(topic('member',s.sid,me()),self);}
 function disconnectLocal(reason){
  const s=sessions.get(currentId);if(s&&s.hostId===me()&&s.status!=='finished'){
   revise(s,{status:'cancelled'});terminal.set(s.sid,copy(s));
  }else if(s&&self){self={...self,left:true,ready:false};publishSelf();terminal.set(s.sid+'/'+me(),{...self,code:scope});}
  currentId=null;self=null;inputs.clear();core.stop(reason);notice=reason;emit();return {ok:true};
 }
 function scopeCheck(){const next=context().code;if(next===scope)return;if(currentId)disconnectLocal('You left this club’s herd drive.');sessions.clear();members.clear();inputs.clear();frames.clear();terminal.clear();scope=next;lastBeat=0;if(scope)N.subscribe('srf1/'+scope+'/herddrive/#');}
 function expire(){
  for(const [sid,s]of sessions)if(s.expiresAt<=now()||blocked(s.n)){if(currentId===sid)disconnectLocal('This herd drive has ended. Gather your club for another ride.');sessions.delete(sid);members.delete(sid);frames.delete(sid);}
 }
 function lobby(s){
  const current=currentId===s.sid,state=current?core.state():null,map=rows(s.sid),roster=s.roster.map(r=>({...r,online:r.id===me()?connected():now()-(map.get(r.id)?.at||frames.get(s.sid)?.receivedAt*(r.id===s.hostId?1:0)||s.at)<6000}));
  return {id:s.sid,hostId:s.hostId,host:s.n,status:s.status,roster,canJoin:s.status==='waiting'&&roster.length<4&&!currentId&&connected(),hosted:s.hostId===me(),ready:current&&!!self?.ready,
   canStart:current&&connected()&&canStartHerd(s,map,{now:now(),selfId:me()}),riding:!!state&&!state.finished,paused:!!state?.paused,waitingForHost:!!state&&s.hostId!==me()&&now()-(frames.get(s.sid)?.receivedAt||s.at)>1800,
   elapsed:state?.elapsed||0,penned:state?.penned||0,total:5,guide:state?G.roundup.state().target:null};
 }
 function snapshot(){scopeCheck();const s=sessions.get(currentId);return {connected:connected(),code:scope,reason:connectionReason(),notice,lobbies:[...sessions.values()].filter(s=>s.expiresAt>now()&&s.status==='waiting'&&!blocked(s.n)).map(lobby),current:s?lobby(s):null,lastResult:copy(lastResult),records:S.fresh()?.clubHerdRecords||{}};}
 function host(){
  scopeCheck();expire();const reason=connectionReason()||busy();if(reason)return fail(reason);if(currentId)return fail('Leave your current herd drive first.');if(pendingResult)return fail('Save your completed herd time first.');if(!safeHerdId(me())||me().length>64)return fail('Your rider identity is unavailable.');
  const at=now(),sid=me()+'-'+at.toString(36)+'-'+Math.random().toString(36).slice(2,7);
  const s={kind:'session',id:me(),n:name(),code:scope,sid,hostId:me(),rev:1,at,createdAt:at,expiresAt:at+45000,status:'waiting',roster:[{id:me(),name:name(),slot:0,ready:true}]};
  sessions.set(sid,s);currentId=sid;self={kind:'member',id:me(),n:name(),sid,rev:0,at,ready:true,left:false};notice='';lastResult=null;publishSession(s);publishSelf();emit();return {ok:true,id:sid};
 }
 function join(sid){
  scopeCheck();expire();const reason=connectionReason()||busy();if(reason)return fail(reason);if(currentId)return fail('Leave your current herd drive first.');if(pendingResult)return fail('Save your completed herd time first.');
  const s=sessions.get(sid);if(!s||s.status!=='waiting'||s.roster.length>=4)return fail('This herd drive is no longer taking riders.');if(blocked(s.n)||!memberAllowed(s.hostId))return fail('Wait for your club’s member list to reconnect.');
  currentId=sid;self={kind:'member',id:me(),n:name(),sid,rev:0,at:now(),ready:false,left:false};lastResult=null;notice='Waiting for the host to add you to the herd drive.';publishSelf();emit();return {ok:true};
 }
 function ready(on=true){
  const s=sessions.get(currentId);if(!s||s.status!=='waiting')return fail('Join a waiting herd drive first.');const reason=connectionReason()||(on?busy():'');if(reason)return fail(reason);if(!s.roster.some(r=>r.id===me()))return fail('Wait for the host to add you first.');self.ready=!!on;publishSelf();if(s.hostId===me()){s.roster.find(r=>r.id===me()).ready=!!on;revise(s);}notice='';emit();return {ok:true};
 }
 function begin(s){
  if(!self?.ready||self.left||!s.roster.some(r=>r.id===me()&&r.ready))return fail('Mark Ready before entering the herd drive.');
  const reason=connectionReason()||busy();if(reason)return fail(reason);
  if(!core.start({sessionId:s.sid,host:s.hostId===me(),slot:s.roster.find(r=>r.id===me()).slot}))return fail('The herd drive could not start.');
  seq=0;frameSeq=0;inputs.clear();frames.delete(s.sid);lastSend=0;notice='';G.hidePanels?.();G.riding?.releaseAll?.();G.seFrame?.settle?.();return {ok:true};
 }
 function start(){
  const s=sessions.get(currentId);if(!s||s.hostId!==me())return fail('Only the host can start the herd drive.');if(s.status!=='waiting'||!canStartHerd(s,rows(s.sid),{now:now(),selfId:me()}))return fail('Gather at least two riders and wait for everyone to mark Ready.');
  const result=begin(s);if(!result.ok)return result;revise(s,{status:'riding',startAt:now()});sendFrame();emit();return {ok:true};
 }
 function leave(){return currentId?disconnectLocal('You left the herd drive.'):fail('You are not in a herd drive.');}
 function saveResult(){
  if(!pendingResult)return {ok:true};const desired=pendingResult;
  try{S.sync(s=>{const r=herdRecordResult(s.clubHerdRecords,desired);if(!r)throw Error('Invalid shared result');s.clubHerdRecords=r.save;});}catch{}
  let saved;try{saved=S.fresh()?.clubHerdRecords;}catch{}const receipt=saved?.receipts?.[desired.runId];
  if(!receipt||receipt.saved!==true||receipt.runId!==desired.runId||receipt.elapsed!==desired.elapsed||receipt.total!==5||receipt.penned!==5||JSON.stringify(receipt.participants)!==JSON.stringify(desired.participants)){lastResult={...desired,saved:false,reason:'Your shared time could not be saved. Keep this tab open and retry.'};emit();return fail(lastResult.reason);}
  lastResult={...receipt,saved:true,bestTime:saved.bestTime};pendingResult=null;emit();return {ok:true};
 }
 function finish(state){
  const s=sessions.get(currentId);if(!s||state.sessionId!==s.sid||!state.finished||state.penned!==5||lastResult?.runId===s.sid)return;
  pendingResult={runId:s.sid,elapsed:Math.round(state.elapsed*100)/100,total:5,penned:5,participants:s.roster.map(r=>r.name),at:now()};
  if(s.hostId===me()){revise(s,{status:'finished'});sendFrame();}else s.status='finished';saveResult();G.run('clubHerdFinish',copy(lastResult));
 }
 function again(){if(pendingResult)return fail('Save your shared time first.');const own=sessions.get(currentId)?.hostId===me();if(currentId)disconnectLocal('Gather your club for another herd drive.');if(own)return host();G.clubHub?.open?.('activities');return {ok:true};}
 function acceptSession(sid,m){
  const old=sessions.get(sid),s=validateHerdSession(sid,m,{now:now(),code:scope,known:old});if(!s||blocked(s.n)||!memberAllowed(s.hostId)||!old&&sessions.size>=12)return;
  sessions.set(sid,s);if(currentId===sid){
   if(s.status==='cancelled'){core.stop('The host ended this herd drive.');currentId=null;self=null;notice='The host ended this herd drive.';}
   else if(s.status==='riding'&&old?.status==='waiting'&&self?.ready){const result=begin(s);if(!result.ok)disconnectLocal(result.reason);}
   else if(!s.roster.some(r=>r.id===me())&&old?.roster.some(r=>r.id===me()))disconnectLocal('You are no longer in this herd drive.');
   else if(s.roster.some(r=>r.id===me()))notice='';
  }emit();
 }
 function acceptMember(s,m){
  const map=rows(s.sid),r=validateHerdMember(m,{now:now(),session:s,known:map.get(m.id)});if(!r||blocked(r.n)||!memberAllowed(r.id))return;
  map.set(r.id,r);if(s.hostId!==me())return;
  const index=s.roster.findIndex(p=>p.id===r.id);if(r.left){if(index>=0){s.roster.splice(index,1);inputs.delete(r.id);if(s.status==='riding'&&s.roster.length<2){disconnectLocal('Your teammate left. Gather at least two riders for a new drive.');return;}revise(s);}return;}
  if(index<0&&s.status==='waiting'&&s.roster.length<4){const slot=[0,1,2,3].find(k=>!s.roster.some(p=>p.slot===k));s.roster.push({id:r.id,name:r.n,slot,ready:r.ready});revise(s);}
  else if(index>=0&&s.roster[index].ready!==r.ready&&s.status==='waiting'){s.roster[index].ready=r.ready;revise(s);}emit();
 }
 function receive(t,m){
  if(typeof t!=='string'||!m||typeof m!=='object')return;const p=t.split('/');if(p[2]!=='herddrive')return;
  if(p[0]!=='srf1'||p[1]!==scope||!connected()||m.id===me()||!safeHerdId(p[4])||m.sid!==p[4])return true;
  if(p[3]==='session'&&p.length===5){acceptSession(p[4],m);return true;}
  const s=sessions.get(p[4]);if(!s)return true;
  if(p[3]==='member'&&p.length===6&&p[5]===m.id){acceptMember(s,m);return true;}
  if(currentId!==s.sid||!core.state())return true;
  if(p[3]==='input'&&p.length===6&&p[5]===m.id&&s.hostId===me()){
   const v=validateHerdInput(m,{now:now(),session:s,lastSeq:inputs.get(m.id)?.seq||0});if(v&&!blocked(v.n))inputs.set(v.id,v);return true;
  }
  if(p[3]==='frame'&&p.length===5&&s.hostId!==me()){
   const last=frames.get(s.sid),v=validateHerdFrame(m,{now:now(),session:s,lastSeq:last?.seq||0,known:last});if(v&&core.applySnapshot(v.state)){frames.set(s.sid,{...v,receivedAt:now()});if(v.state.finished)finish(v.state);}return true;
  }return true;
 }
 function sendFrame(){const s=sessions.get(currentId),state=core.state();if(!s||s.hostId!==me()||!state||!connected())return;N.publish(topic('frame',s.sid),{kind:'frame',sid:s.sid,seq:++frameSeq,at:now(),state});}
 function sendInput(){
  const s=sessions.get(currentId);if(!s||!core.state())return;const p=G.horse.player;
  const input={kind:'input',id:me(),n:name(),sid:s.sid,seq:++seq,at:now(),x:p.pos.x,z:p.pos.z,active:!G.input?.blocked?.()&&!G.photoPause&&!G.cam?.isFree?.()&&!document.hidden&&!p.onFoot&&!p.flying};
  if(s.hostId===me())inputs.set(me(),input);else N.publish(topic('input',s.sid,me()),input);
 }
 function tick(){
  scopeCheck();expire();const s=sessions.get(currentId);if(!s)return;
  if(!connected()){disconnectLocal('Connection lost. This herd drive has ended; reconnect to ride again.');return;}
  const state=core.state();if(s.status==='riding'&&state){
   if(s.hostId!==me()&&now()-(frames.get(s.sid)?.receivedAt||s.startAt||s.at)>6000){disconnectLocal('The host stopped sending the herd. Reconnect for another drive.');return;}
   if(now()-lastSend>=150){lastSend=now();sendInput();if(s.hostId===me()){const sources=herdPressureSources(inputs,{now:now(),roster:s.roster,selfId:me()});core.setRiders(sources);sendFrame();}}
  }
  if(now()-lastBeat>=2000){lastBeat=now();publishSelf();if(s.hostId===me()){
   if(s.status==='waiting'){const fresh=s.roster.filter(r=>r.id===me()||now()-(rows(s.sid).get(r.id)?.at||0)<10000);if(fresh.length!==s.roster.length)s.roster=fresh;}
   if(s.status==='riding'&&now()-(s.startAt||s.at)>6000&&s.roster.filter(r=>r.id===me()||now()-(inputs.get(r.id)?.at||0)<6000).length<2){disconnectLocal('Your teammates disconnected. Gather your club for another drive.');return;}
   revise(s);if(s.status==='finished')sendFrame();
  }}
  if(now()-lastNotice>=500){lastNotice=now();emit();}
 }
 G.on('message',receive);G.on('tick',tick);G.on('sharedRoundupFinish',finish);
 G.on('sharedRoundupStop',()=>{if(core.state()||!currentId)return;const s=sessions.get(currentId);if(s?.status==='riding')disconnectLocal('The herd drive ended.');});
 G.on('clubChanged',()=>{scopeCheck();emit();});G.on('connect',()=>{scopeCheck();if(scope)N.subscribe('srf1/'+scope+'/herddrive/#');for(const [key,m]of terminal){if(m.code&&m.code!==scope)continue;N.publish(topic(key.includes('/')?'member':'session',m.sid,key.includes('/')?me():null),m,{retain:!key.includes('/')});terminal.delete(key);}emit();});
 const gate=()=>{if(core.state()){G.toast('Finish or leave your shared herd drive first.');return true;}};
 G.on('activityGate',gate);G.on('travelGate',gate);
 G.clubHerd={snapshot,host,join,ready,start,leave,stop:leave,again,retrySave:saveResult};scopeCheck();
}

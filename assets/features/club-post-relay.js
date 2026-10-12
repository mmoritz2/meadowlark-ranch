import {safeRelayId,cleanRelayName,validateRelaySession,validateRelayMember,validateRelayInput,validateRelayAction,validateRelayFrame,canStartRelay,relayRecordResult} from '../club-post-relay-protocol.mjs?v=club-post-relay-1';
import {COTTONWOOD_ROUTES} from '../cottonwood-routes.mjs?v=cottonwood-post-1';
// Voluntary two-rider practice on the existing club transport. The host owns
// the one parcel; packets never move a player or grant solo/economic rewards.
export const id='club-post-relay';
export function install(G){
 if(G.clubPostRelay||!G.net)return;
 const N=G.net,S=G.save,H=G.horse,P=H.player,now=()=>Date.now(),me=()=>N.net.id,name=()=>cleanRelayName(N.myName())||'Rider';
 const sessions=new Map(),members=new Map(),inputs=new Map(),frames=new Map(),actions=new Map(),terminal=new Map(),announced=new Set();
 const STAGES=['collect','outbound','passPost','deliver','backToPines','passReply','home','finished'];
 const MIN_LEG={outbound:30,deliver:45,backToPines:45,home:30},MANAGED='club-post-relay';
 let scope='',currentId=null,self=null,ride=null,state=null,seq=0,actionSeq=0,frameSeq=0,lastSend=0,lastBeat=0,lastTick=0,lastNotice=0;
 let notice='',lastResult=null,pendingResult=null,confirmed=null,closing=false,starting=false,startup=null,playStartedAt=0,finalRecovery=null,lastOwnInput=null,guide=null,hostWaiting=false;
 const copy=v=>v==null?v:JSON.parse(JSON.stringify(v)),fail=reason=>({ok:false,reason}),distance=(a,b)=>a&&b?Math.hypot(a.x-b.x,a.z-b.z):Infinity;
 S.ensure(s=>{s.clubPostRelayRecords=s.clubPostRelayRecords||{};});
 const fresh=()=>{try{return S.fresh();}catch{return null;}};
 try{const records=fresh()?.clubPostRelayRecords,r=records?.receipts?.[records.lastRunId],loaded=r?.saved===true&&relayRecordResult(records,r);if(loaded?.deduped)lastResult=copy(loaded.receipt);}catch{}
 function club(){const c=G.clubs?.identity()||{};return {code:safeRelayId(c.code)?c.code:'',joined:!!c.founder&&!c.pendingJoin&&!c.canCreate};}
 const connected=()=>club().joined&&scope===club().code&&N.net.club===scope&&!!N.net.client?.connected;
 const topic=(kind,sid,pid)=>'srf1/'+scope+'/postrelay/'+kind+'/'+sid+(pid?'/'+pid:'');
 const rows=sid=>{if(!members.has(sid))members.set(sid,new Map());return members.get(sid);};
 const blocked=label=>{const s=fresh()||{};return !!s.blocked?.[label]||(s.tempMute?.[label]||0)>now();};
 function memberAllowed(pid){const c=G.clubs?.identity()||{},r=fresh()?.clubRecords?.[scope]?.members?.[pid];return pid===me()||c.founderId===pid||!!r&&!r.left||!!G.clubs?.memberRows?.().some(r=>r.id===pid);}
 function connectionReason(){if(!club().joined)return 'Join or create a club first.';if(N.net.club!==scope)return 'Connect to your club room to ride together.';if(!N.net.client?.connected)return 'Connect to your club to ride the post relay.';return '';}
 function readyHorse(){const r=H.RIG?.();return !P.onFoot&&!G.onFoot?.on&&!P.flying&&!G.worldPkg?.vehicle?.()&&!!r?.ready&&!r.loadingBreed&&!r.emote&&!r.heroMotion?.state?.action;}
 function canJump(){const r=H.RIG?.(),p=r?.profile;if(p?.nativeBreed||p?.referenceMotion)return !!p.nativeJump&&!p.nativeCanFly&&!r.nativeCanFly&&!r.nativeFantasy?.pair&&!r.fantasyAppearance?.wings;return true;}
 const waitingForHost=()=>!!state&&!state.finished&&sessions.get(currentId)?.hostId!==me()&&now()-(frames.get(currentId)?.receivedAt||sessions.get(currentId)?.startAt||now())>1800;
 const localActive=()=>!G.input?.blocked?.()&&!G.photoPause&&!G.cam?.isFree?.()&&!document.hidden&&!document.body.classList.contains('freecam')&&!document.body.classList.contains('posing');
 function busy(){
  if(!G.trail?.start||!G.trail?.stop||!G.trail?.finishUnrewardedManaged)return 'The relay trail is unavailable.';
  if(G.course?.get?.()||G.course?.drillActive?.()||G.rescueRide?.snapshot?.().active||G.roundup?.state?.().active||G.trail.ride)return 'Finish or leave your current activity first.';
  if(G.clubHerd?.snapshot?.().current||G.clubRides?.snapshot?.().current)return 'Leave your current riding party first.';
  if(G.social?.spectate||G.social?.tour)return 'Leave spectating or the ranch tour first.';
  if(!readyHorse()||P.landing||(P.y||0)>.15||H.RIG?.()?.heroMotion?.state?.transitioning)return 'Mount your horse, land, and let it finish getting ready first.';
  return '';
 }
 function emit(){G.run('clubPostRelayChanged');}
 function npc(id,fallback){const n=G.world?.npcList?.find(n=>n.def?.id===id),p=n?.g?.position||n?.def;return p&&Number.isFinite(p.x)&&Number.isFinite(p.z)?{...fallback,x:p.x,z:p.z}:{...fallback};}
 const stations=()=>({wren:npc('wren',{x:-11,z:-15.8,label:'Grandpa Wren'}),pines:{x:-30,z:-58,label:'Hollowpeak Pines'},ada:npc('ada',{x:39,z:-39,label:'Ada · Cottonwood'})});
 const timely=i=>!!i&&now()-i.at<=1800&&i.at<=now()+2000;
 const usable=i=>timely(i)&&i.ready&&i.active;
 const stopped=i=>usable(i)&&i.grounded===true&&Number.isFinite(i.speed)&&Math.abs(i.speed)<1.2;
 function localObservation(){return {id:me(),n:name(),sid:currentId,seq:lastOwnInput?.seq||0,at:now(),x:P.pos.x,z:P.pos.z,speed:Number.isFinite(P.speed)?P.speed:0,active:localActive(),ready:readyHorse(),grounded:!P.landing&&(P.y||0)<.15&&!H.RIG?.()?.heroMotion?.state?.transitioning,canJump:canJump()};}
 function inputFor(pid,live=false){return live&&pid===me()?localObservation():inputs.get(pid);}
 function pairReason(live=false){
  if(!state||state.startupWaiting)return 'Wait for both riders to finish gathering.';
  const a=inputFor(state.firstId,live),b=inputFor(state.otherId,live),s=stations();
  if(!timely(a)||!timely(b))return 'Wait for your partner to reconnect nearby.';
  if(!usable(a)||!usable(b))return 'Both riders must be mounted and back in the world.';
  if(!stopped(a)||!stopped(b))return 'Both riders must stop to hand over the pouch.';
  if(distance(a,s.pines)>=6||distance(b,s.pines)>=6)return 'Meet beside the Hollowpeak Pines marker.';
  if(distance(a,b)>=4.5)return 'Ride closer to your partner, then stop beside them.';
  return '';
 }
 function context(){
  const s=sessions.get(currentId);if(!s||!state||s.status==='waiting')return null;
  if(state.finished){const pending=!!pendingResult;return {action:pending?'save':null,label:pending?'Retry save':'Relay complete',inReach:false,eligible:pending&&localActive(),status:pending?'savePending':'finished',reason:pending?'Your relay is complete. Retry saving your shared time.':'Your shared ride is recorded.'};}
  const st=stations(),local=inputFor(me(),true),isCarrier=state.carrierId===me(),at=target(),handoff=['passPost','passReply'].includes(state.stage),offer=state.offer;
  let action=null,label='',reason='',inReach=false;
  if(state.stage==='collect'&&me()===state.firstId){action='collect';label='Collect post';inReach=distance(local,st.wren)<4.5;}
  else if(state.stage==='deliver'&&isCarrier){action='exchange';label='Exchange post';inReach=distance(local,st.ada)<4.5;}
  else if(state.stage==='home'&&isCarrier){action='return';label='Deliver reply';inReach=distance(local,st.wren)<4.5;}
  else if(handoff){
   const partner=inputFor(me()===state.firstId?state.otherId:state.firstId);
   inReach=distance(local,st.pines)<6&&timely(partner)&&distance(local,partner)<4.5;
   if(isCarrier&&!offer){action='offer';label=state.stage==='passPost'?'Offer post':'Offer reply';}
   else if(offer?.to===me()){action='accept';label=state.stage==='passPost'?'Accept post':'Accept reply';}
   else reason=isCarrier?'Your partner can now accept the pouch.':'Wait for your partner to offer the pouch.';
  }
  if(!localActive())reason='Return to riding to continue the relay.';
  else if(state.startupWaiting)reason='Gathering both riders…';
  else if(waitingForHost())reason='Waiting for the host to confirm the relay.';
  else if(!readyHorse())reason='Mount your horse, land, and let it get ready.';
  else if(handoff)reason=pairReason(true)||reason;
  else if(state.paused)reason='Wait for both riders to return to the ride.';
  else if(action&&!inReach)reason='Ride to '+at.label+' and stop beside the marker.';
  else if(action&&!stopped(local))reason='Come to a gentle stop to hand over the post.';
  else if(action==='exchange'&&state.legs.deliver<MIN_LEG.deliver||action==='return'&&state.legs.home<MIN_LEG.home)reason='Ride the whole marked delivery leg with the pouch.';
  const eligible=!!action&&!reason;
  if(!reason)reason=action==='offer'?'Offer the pouch to your stopped partner.':action==='accept'?'Accept the pouch your partner is holding.':action?'Stop beside the post station and hand over the pouch.':state.stage==='outbound'?'Ride together to the pines.':state.stage==='backToPines'?'Bring Ada’s reply back to your partner at the pines.':'Follow the courier and the marked trail.';
  return {action,label:label||'Follow the relay',inReach,eligible,status:eligible?'ready':state.paused?'paused':handoff?'handoff':'riding',reason,offerId:offer?.id||null};
 }
 function target(){const st=stations();if(state&&['deliver','backToPines'].includes(state.stage)&&me()!==state.carrierId)return st.pines;return !state||['collect','home','finished'].includes(state.stage)?st.wren:['outbound','passPost','backToPines','passReply'].includes(state.stage)?st.pines:st.ada;}
 function guidePoint(){
  if(!state)return null;const key=state.stage+':'+state.route+':'+state.returnRoute,at=target();
  if(guide?.key!==key){const waitingAtPines=['deliver','backToPines'].includes(state.stage)&&me()!==state.carrierId;let points=waitingAtPines?[]:state.stage==='outbound'?COTTONWOOD_ROUTES.out:state.stage==='deliver'?COTTONWOOD_ROUTES[state.route]:state.stage==='backToPines'?[...COTTONWOOD_ROUTES[state.returnRoute]].reverse():state.stage==='home'?[...COTTONWOOD_ROUTES.out].reverse():[];
   // Reach every surveyed bend before turning; broad arrival circles cut across rails, props and tree-lined trail corners.
   guide={key,index:0,points:points.map(([x,z])=>({x,z,label:state.stage==='deliver'&&state.route==='woodland'&&x===-12?'Low log approach':'Relay trail',radius:.8}))};}
  if(localActive()&&readyHorse())while(guide.index<guide.points.length&&distance(P.pos,guide.points[guide.index])<guide.points[guide.index].radius)guide.index++;
  return {...(guide.points[guide.index]||at)};
 }
 function rosterView(s){return s.roster.map(r=>({...r,online:r.id===me()?connected():now()-(rows(s.sid).get(r.id)?.at||s.at)<6000}));}
 function lobby(s){const current=s.sid===currentId,a=current?state:null,roster=rosterView(s),partner=s.roster.find(r=>r.id!==me()),pi=partner?inputFor(partner.id):null;
  return {id:s.sid,hostId:s.hostId,host:s.n,hosted:s.hostId===me(),localId:me(),status:s.status,roster,ready:current&&!!self?.ready,canJoin:s.status==='waiting'&&s.roster.length<2&&!currentId&&connected(),canStart:current&&connected()&&canStartRelay(s,rows(s.sid),{now:now(),selfId:me()}),
   firstId:a?.firstId||s.firstId||s.hostId,otherId:a?.otherId||s.roster.find(r=>r.id!==(s.firstId||s.hostId))?.id||null,stage:a?.stage||null,carrierId:a?.carrierId||null,cargo:a?.carrierId?(['backToPines','passReply','home'].includes(a.stage)?'reply':'post'):null,route:a?.route||'road',returnRoute:a?.returnRoute||'road',guide:a?guidePoint():null,target:a?target():null,stations:stations(),interaction:current?context():null,
   paused:!!a?.paused||(current&&waitingForHost()),waitingForHost:current&&waitingForHost(),startupWaiting:!!a?.startupWaiting,waitingForRiders:!!a?.startupWaiting,waitingNames:startup?s.roster.filter(r=>!inputs.has(r.id)).map(r=>r.name):[],elapsed:a?.elapsed||0,distance:a?.distance||0,handoffs:a?.handoffs||0,stateRev:a?.rev||0,offer:copy(a?.offer||null),partner:partner?{...partner,...copy(pi||{}),online:timely(pi)}:null,woodlandAvailable:!!a&&a.carrierId===me()&&canJump(),savePending:!!pendingResult,riding:!!a&&!a.finished};
 }
 function snapshot(){scopeCheck();const s=sessions.get(currentId);return {me:me(),connected:connected(),code:scope,reason:connectionReason(),notice,lobbies:[...sessions.values()].filter(s=>s.expiresAt>now()&&s.status==='waiting'&&!blocked(s.n)).map(lobby),current:s?lobby(s):null,lastResult:copy(lastResult),records:copy(fresh()?.clubPostRelayRecords||{})};}
 function publishSession(s){return N.publish(topic('session',s.sid),s,{retain:true});}
 function revise(s,patch={}){Object.assign(s,patch,{rev:s.rev+1,at:now(),expiresAt:Math.min(now()+45000,s.createdAt+2700000)});publishSession(s);}
 function publishSelf(){const s=sessions.get(currentId);if(!s||!self)return;self={...self,rev:self.rev+1,at:now()};rows(s.sid).set(me(),copy(self));N.publish(topic('member',s.sid,me()),self);}
 function clearLocal(reason){const old=ride;closing=true;if(old&&G.trail.ride===old)G.trail.stop();closing=false;ride=null;state=null;currentId=null;self=null;startup=null;finalRecovery=null;lastOwnInput=null;guide=null;hostWaiting=false;inputs.clear();notice=reason;G.riding?.releaseAll?.();emit();}
 function disconnectLocal(reason){const s=sessions.get(currentId);if(s){if(s.hostId===me()&&s.status!=='finished'){revise(s,{status:'cancelled'});terminal.set(s.sid,copy(s));}else if(self&&s.status!=='finished'){self={...self,left:true,ready:false};publishSelf();terminal.set(s.sid+'/'+me(),{...self,code:scope});}}clearLocal(reason);return {ok:true};}
 function scopeCheck(){const next=club().code;if(next===scope)return;if(currentId)disconnectLocal('You left this club’s post relay.');sessions.clear();members.clear();inputs.clear();frames.clear();actions.clear();terminal.clear();scope=next;lastBeat=0;if(scope)N.subscribe('srf1/'+scope+'/postrelay/#');}
 function expire(){for(const [sid,s]of sessions)if(s.expiresAt<=now()||blocked(s.n)){if(currentId===sid)disconnectLocal('This relay has ended. Gather your partner for another ride.');sessions.delete(sid);members.delete(sid);frames.delete(sid);}}
 function host(){scopeCheck();expire();const reason=connectionReason()||busy();if(reason)return fail(reason);if(currentId)return fail('Leave your current relay first.');if(pendingResult)return fail('Save your completed relay time first.');if(!safeRelayId(me())||me().length>64)return fail('Your rider identity is unavailable.');
  const at=now(),sid=me()+'-'+at.toString(36)+'-'+Math.random().toString(36).slice(2,7).padEnd(5,'0'),s={kind:'session',id:me(),n:name(),code:scope,sid,hostId:me(),rev:1,at,createdAt:at,expiresAt:at+45000,status:'waiting',roster:[{id:me(),name:name(),slot:0,ready:true}]};
  sessions.set(sid,s);currentId=sid;self={kind:'member',id:me(),n:name(),sid,rev:0,at,ready:true,left:false};notice='';lastResult=null;publishSession(s);publishSelf();emit();return {ok:true,id:sid};
 }
 function join(sid){scopeCheck();expire();const reason=connectionReason()||busy();if(reason)return fail(reason);if(currentId)return fail('Leave your current relay first.');if(pendingResult)return fail('Save your completed relay time first.');const s=sessions.get(sid);if(!s||s.status!=='waiting'||s.roster.length>=2||!memberAllowed(s.hostId)||blocked(s.n))return fail('This relay is unavailable. Wait for the club member list to reconnect.');
  currentId=sid;self={kind:'member',id:me(),n:name(),sid,rev:0,at:now(),ready:false,left:false};lastResult=null;notice='Waiting for the host to add you.';publishSelf();emit();return {ok:true};
 }
 function ready(on=true){const s=sessions.get(currentId);if(!s||s.status!=='waiting')return fail('Join a waiting relay first.');const reason=connectionReason()||(on?busy():'');if(reason)return fail(reason);if(!s.roster.some(r=>r.id===me()))return fail('Wait for the host to add you first.');self.ready=!!on;publishSelf();if(s.hostId===me()){s.roster.find(r=>r.id===me()).ready=!!on;revise(s);}emit();return {ok:true};}
 function initial(s){const first=s.firstId,other=s.roster.find(r=>r.id!==first)?.id;return {sessionId:s.sid,stage:'collect',carrierId:null,firstId:first,otherId:other,route:'road',returnRoute:'road',rev:1,elapsed:0,distance:0,handoffs:0,offer:null,startupWaiting:true,paused:true,finished:false,legs:{outbound:0,deliver:0,backToPines:0,home:0},completedAt:null};}
 function begin(s){if(!self?.ready||!s.roster.some(r=>r.id===me()&&r.ready))return fail('Mark Ready before starting.');const reason=connectionReason()||busy();if(reason)return fail(reason);
  const expedition=G.social?.EXPEDITIONS?.find(e=>e.id==='cottonwood');if(!expedition?.stops)return fail('The Cottonwood route is unavailable.');
  starting=true;const okay=G.trail.start(expedition.stops.map(p=>p.slice()),s.n,{name:'Cottonwood Post Relay',exped:'cottonwood',clubPostRelayId:s.sid,managed:MANAGED});starting=false;
  if(!okay||G.trail.ride?.clubPostRelayId!==s.sid)return fail('The relay trail could not start.');
  ride=G.trail.ride;state=initial(s);seq=0;actionSeq=0;frameSeq=0;inputs.clear();actions.clear();frames.delete(s.sid);lastOwnInput=null;confirmed=null;guide=null;hostWaiting=false;lastSend=0;lastTick=now();playStartedAt=0;finalRecovery=null;notice='';startup={startedAt:now()};G.hidePanels?.();G.riding?.releaseAll?.();G.seFrame?.settle?.();return {ok:true};
 }
 function start(options={}){const s=sessions.get(currentId);if(!s||s.hostId!==me())return fail('Only the host can start the relay.');if(s.status!=='waiting'||!canStartRelay(s,rows(s.sid),{now:now(),selfId:me()}))return fail('Gather two riders and wait for both to mark Ready.');const firstId=options.firstId??s.hostId;if(!s.roster.some(r=>r.id===firstId))return fail('Choose one of the two riders to collect the post.');s.firstId=firstId;
  const result=begin(s);if(!result.ok){delete s.firstId;return result;}revise(s,{status:'riding',startAt:now()});sendInput();sendFrame();emit();return {ok:true};
 }
 function change(patch){Object.assign(state,patch,{rev:state.rev+1});guide=null;emit();}
 function updatePaused(){if(!state||state.finished)return;const pause=state.startupWaiting||!usable(inputs.get(state.firstId))||!usable(inputs.get(state.otherId));if(state.paused!==pause){state.paused=pause;if(pause)G.riding?.releaseAll?.();}}
 function acceptInput(s,m){const previous=inputs.get(m.id),v=validateRelayInput(m,{now:now(),session:s,known:previous});if(!v)return false;inputs.set(v.id,v);updatePaused();
  if(state&&!state.startupWaiting&&!state.paused&&state.carrierId===v.id&&MIN_LEG[state.stage]&&usable(previous)&&usable(v)){
   const d=distance(previous,v);state.distance+=d;state.legs[state.stage]+=d;
   if(['outbound','backToPines'].includes(state.stage)&&state.legs[state.stage]>=MIN_LEG[state.stage]&&distance(v,stations().pines)<6)change({stage:state.stage==='outbound'?'passPost':'passReply'});
  }
  if(state?.offer&&(now()-state.offer.at>10000||pairReason()))change({offer:null});return true;
 }
 function sendInput(){const s=sessions.get(currentId);if(!s||s.status!=='riding'||!state||state.finished)return;const m={kind:'input',...localObservation(),sid:s.sid,seq:++seq,at:now()};const v=validateRelayInput(m,{now:now(),session:s,known:lastOwnInput});
  if(!v){disconnectLocal('The relay ended after leaving its riding route or fast travel. Gather your partner to try again.');return;}lastOwnInput=v;
  if(s.hostId===me())acceptInput(s,v);else N.publish(topic('input',s.sid,me()),v);
 }
 function applyAction(s,m){const action=validateRelayAction(m,{now:now(),session:s,lastSeq:actions.get(m.id)||0});if(!action||!state||state.finished)return fail('That relay action is no longer available.');actions.set(m.id,action.seq);
  const actor=inputs.get(m.id);if(state.startupWaiting||state.paused||!(action.action==='route'?usable(actor):stopped(actor))||actor.seq<action.inputSeq||action.stateRev!==state.rev)return fail('Stop and wait for the current relay step.');const st=stations();
  if(action.action==='route'){
   if(state.stage!=='deliver'||state.carrierId!==m.id||!['road','woodland'].includes(action.route)||action.route==='woodland'&&!actor.canJump)return fail('This courier cannot take that route.');change({route:action.route});return {ok:true};
  }
  if(action.action==='collect'&&state.stage==='collect'&&m.id===state.firstId&&distance(actor,st.wren)<4.5){change({stage:'outbound',carrierId:state.firstId});return {ok:true};}
  if(action.action==='exchange'&&state.stage==='deliver'&&m.id===state.carrierId&&distance(actor,st.ada)<4.5&&state.legs.deliver>=MIN_LEG.deliver){change({stage:'backToPines',returnRoute:state.route});return {ok:true};}
  if(action.action==='return'&&state.stage==='home'&&m.id===state.carrierId&&distance(actor,st.wren)<4.5&&state.legs.home>=MIN_LEG.home){change({stage:'finished',carrierId:null,finished:true,offer:null,paused:false,completedAt:now()});finish();return {ok:true};}
  if(['passPost','passReply'].includes(state.stage)&&!pairReason()){
   if(action.action==='offer'&&m.id===state.carrierId&&!state.offer){const to=m.id===state.firstId?state.otherId:state.firstId,rev=state.rev+1;change({offer:{id:s.sid+'_'+rev+'_'+action.seq,from:m.id,to,at:now(),rev,kind:state.stage==='passPost'?'post':'reply'}});return {ok:true};}
   const o=state.offer;if(action.action==='accept'&&o&&o.to===m.id&&action.offerId===o.id&&o.rev===state.rev&&now()-o.at<=10000){change({stage:state.stage==='passPost'?'deliver':'home',carrierId:m.id,handoffs:state.handoffs+1,offer:null});return {ok:true};}
  }
  return fail('Ride to the current relay marker and stop beside your partner.');
 }
 function request(action,extra={}){const s=sessions.get(currentId);if(!s||!state)return fail('Join a relay first.');sendInput();if(!state||!currentId)return fail('This relay has ended.');const m={kind:'action',id:me(),n:name(),sid:s.sid,seq:++actionSeq,at:now(),action,stateRev:state.rev,inputSeq:lastOwnInput?.seq||0,...extra};
  if(s.hostId===me()){const result=applyAction(s,m);if(!result.ok)notice=result.reason;sendFrame();emit();return result;}
  if(!N.publish(topic('action',s.sid,me()),m))return fail('The relay action could not be sent.');notice='Waiting for your partner’s relay acknowledgement…';emit();return {ok:true,pending:true};
 }
 function interact(){const i=context();if(!i?.eligible)return fail(i?.reason||'The relay action is unavailable.');if(i.action==='save')return saveResult();return request(i.action,i.action==='accept'?{offerId:i.offerId}:{});}
 function setRoute(route){if(!state||state.stage!=='deliver'||state.carrierId!==me()||!localActive()||!readyHorse())return fail('Only the current courier can choose this leg’s route.');if(route==='woodland'&&!canJump())return fail('This horse cannot jump the woodland log. Take the Meadow road.');return request('route',{route});}
 function finishLocalTrail(){if(!ride||G.trail.ride!==ride)return true;ride.idx=ride.pts.length;ride.t=state?.elapsed||confirmed?.elapsed||0;return G.trail.finishUnrewardedManaged(ride)===true;}
 function saveResult(){if(!pendingResult)return {ok:true};const desired=pendingResult;
  try{S.sync(s=>{const r=relayRecordResult(s.clubPostRelayRecords,desired);if(!r)throw Error('Invalid relay result');s.clubPostRelayRecords=r.save;});}catch{}
  const saved=fresh()?.clubPostRelayRecords,verified=relayRecordResult(saved,desired);if(!verified?.deduped){lastResult={...copy(desired),saved:false,reason:'Your relay time could not be saved. Keep this tab open and retry.'};emit();return fail(lastResult.reason);}
  confirmed=copy(verified.receipt);lastResult=copy(confirmed);pendingResult=null;finishLocalTrail();if(!announced.has(desired.runId)){announced.add(desired.runId);G.run('clubPostRelayFinish',copy(lastResult));}emit();return {ok:true};
 }
 function finish(){const s=sessions.get(currentId);if(!s||!state?.finished||state.handoffs!==2||pendingResult?.runId===s.sid||lastResult?.runId===s.sid)return;
  finalRecovery=null;pendingResult={runId:s.sid,elapsed:Math.round(state.elapsed*100)/100,distance:Math.round(state.distance*100)/100,participants:s.roster.map(r=>({id:r.id,name:r.name})),firstId:state.firstId,otherId:state.otherId,handoffs:2,at:s.createdAt};
  if(s.hostId===me()){revise(s,{status:'finished'});sendFrame();}else s.status='finished';saveResult();
 }
 function leave(){return currentId?disconnectLocal('You left the post relay.'):fail('You are not in a relay.');}
 function again(){if(pendingResult)return fail('Save your relay time first.');const own=sessions.get(currentId)?.hostId===me();if(currentId)disconnectLocal('Gather your partner for another post ride.');if(own)return host();G.clubHub?.open?.('activities');return {ok:true};}
 function recoverFinal(s){if(s.hostId===me()||!state||state.finished)return;if(finalRecovery?.sid!==s.sid)finalRecovery={sid:s.sid,startedAt:now(),lastRequest:null,attempts:0};if(finalRecovery.attempts<4&&(finalRecovery.lastRequest===null||now()-finalRecovery.lastRequest>=2000)){finalRecovery.lastRequest=now();finalRecovery.attempts++;N.subscribe(topic('frame',s.sid));}}
 function acceptSession(sid,m){const old=sessions.get(sid),s=validateRelaySession(sid,m,{now:now(),code:scope,known:old});if(!s||blocked(s.n)||!memberAllowed(s.hostId)||!old&&sessions.size>=12)return;sessions.set(sid,s);
  if(currentId===sid){if(s.status==='cancelled'){clearLocal('The host ended this post relay.');return;}if(!s.roster.some(r=>r.id===me())&&old?.roster.some(r=>r.id===me())){disconnectLocal('You are no longer in this relay.');return;}
   if(s.status==='riding'&&old?.status==='waiting'&&self?.ready){const r=begin(s);if(!r.ok)disconnectLocal(r.reason);}
   else if(s.status==='finished'&&state&&!state.finished)recoverFinal(s);else if(s.roster.some(r=>r.id===me()))notice='';
  }emit();
 }
 function acceptMember(s,m){const map=rows(s.sid),r=validateRelayMember(m,{now:now(),session:s,known:map.get(m.id)});if(!r||blocked(r.n)||!memberAllowed(r.id))return;map.set(r.id,r);if(s.hostId!==me())return;
  const i=s.roster.findIndex(p=>p.id===r.id);if(r.left){if(i>=0){if(s.status==='riding'){disconnectLocal('Your partner left. Gather two riders for another relay.');return;}s.roster.splice(i,1);revise(s);}return;}
  if(i<0&&s.status==='waiting'&&s.roster.length<2){s.roster.push({id:r.id,name:r.n,slot:1,ready:r.ready});revise(s);}else if(i>=0&&s.status==='waiting'&&s.roster[i].ready!==r.ready){s.roster[i].ready=r.ready;revise(s);}emit();
 }
 function receive(t,m){if(typeof t!=='string'||!m||typeof m!=='object')return;const p=t.split('/');if(p[2]!=='postrelay')return;if(p[0]!=='srf1'||p[1]!==scope||!connected()||m.id===me()||!safeRelayId(p[4])||m.sid!==p[4])return true;
  if(p[3]==='session'&&p.length===5){acceptSession(p[4],m);return true;}const s=sessions.get(p[4]);if(!s)return true;
  if(p[3]==='member'&&p.length===6&&p[5]===m.id){acceptMember(s,m);return true;}if(currentId!==s.sid||!state)return true;
  if(p[3]==='input'&&p.length===6&&p[5]===m.id&&s.hostId===me()){acceptInput(s,m);return true;}
  if(p[3]==='action'&&p.length===6&&p[5]===m.id&&s.hostId===me()){const result=applyAction(s,m);if(!result.ok)notice=result.reason;sendFrame();emit();return true;}
  if(p[3]==='frame'&&p.length===5&&s.hostId!==me()){
   const known=frames.get(s.sid),v=validateRelayFrame(m,{now:now(),session:s,known});if(v){frames.set(s.sid,{...v,receivedAt:now()});state=copy(v.state);for(const i of v.inputs||[])inputs.set(i.id,i);if(!state.startupWaiting)startup=null;notice='';if(state.finished)finish();emit();}return true;
  }return true;
 }
 function sendFrame(){const s=sessions.get(currentId);if(!s||s.hostId!==me()||!state||!connected())return;N.publish(topic('frame',s.sid),{kind:'frame',sid:s.sid,seq:++frameSeq,at:now(),state:copy(state),inputs:[...inputs.values()].map(copy)},state.finished?{retain:true,qos:1}:undefined);}
 function tick(){scopeCheck();expire();const s=sessions.get(currentId);if(!s)return;if(!connected()){disconnectLocal('Connection lost. The relay ended; gather your partner to ride again.');return;}
  if(state){
   const waiting=waitingForHost();if(waiting&&!hostWaiting)G.riding?.releaseAll?.();hostWaiting=waiting;
   if(!state.finished&&G.trail.ride!==ride){disconnectLocal('Your relay trail has ended.');return;}
   if(now()-lastSend>=150&&!state.finished){lastSend=now();sendInput();if(!state)return;}
   if(s.hostId===me()){
    if(startup){if(s.roster.every(r=>timely(inputs.get(r.id)))){state.startupWaiting=false;startup=null;playStartedAt=now();lastTick=now();updatePaused();sendFrame();}else if(now()-startup.startedAt>=30000){disconnectLocal('A rider did not finish gathering in time. No relay was recorded.');return;}}
    if(!state.finished&&!startup&&now()-playStartedAt>6000&&s.roster.some(r=>now()-(inputs.get(r.id)?.at||0)>6000)){disconnectLocal('Your partner disconnected. This unfinished relay was not recorded.');return;}
    updatePaused();const dt=Math.max(0,Math.min(.25,(now()-lastTick)/1000));lastTick=now();if(!state.startupWaiting&&!state.paused&&state.stage!=='collect'&&!state.finished)state.elapsed+=dt;
    if(state.offer&&(now()-state.offer.at>10000||pairReason()))change({offer:null});
    if(now()-lastNotice>=150)sendFrame();
   }else if(s.status==='finished'&&!state.finished){recoverFinal(s);if(finalRecovery&&now()-finalRecovery.startedAt>=8000){disconnectLocal('The final relay proof could not be received. This ride was not recorded.');return;}}
   else if(!state.finished){const age=now()-(frames.get(s.sid)?.receivedAt||s.startAt||s.at);if(state.startupWaiting?now()-(s.startAt||s.at)>30000:age>6000){disconnectLocal('The host stopped sending the relay. Reconnect to ride again.');return;}}
  }
  if(now()-lastBeat>=2000){lastBeat=now();publishSelf();if(s.hostId===me()){
   if(s.status==='waiting'){s.roster=s.roster.filter(r=>r.id===me()||now()-(rows(s.sid).get(r.id)?.at||0)<10000);}
   revise(s);if(state?.finished)sendFrame();
  }}
  if(now()-lastNotice>=150){lastNotice=now();emit();}
 }
 G.on('message',receive);G.on('tick',tick);G.on('clubChanged',()=>{scopeCheck();emit();});
 G.on('connect',()=>{scopeCheck();if(scope)N.subscribe('srf1/'+scope+'/postrelay/#');for(const [key,m]of terminal){if(m.code&&m.code!==scope)continue;N.publish(topic(key.includes('/')?'member':'session',m.sid,key.includes('/')?me():null),m,{retain:!key.includes('/')});terminal.delete(key);}emit();});
 G.on('trailTick',r=>r?.managed===MANAGED?true:undefined);
 G.on('trailStart',r=>{if(r?.managed===MANAGED&&!starting&&r!==ride)G.trail.stop();});
 G.on('trailCancel',r=>{if(r!==ride||closing)return false;disconnectLocal('You ended the post relay.');return false;});
 G.on('unrewardedTrailFinishReady',r=>r===ride&&r===G.trail.ride&&r.managed===MANAGED&&r.clubPostRelayId===currentId&&state?.finished&&confirmed?.saved===true&&confirmed.runId===currentId);
 const gate=()=>{if(ride&&G.trail.ride===ride&&!starting){G.toast('Finish or leave your post relay first.');return true;}};
 G.on('activityGate',gate);G.on('travelGate',gate);G.on('state',s=>{s.clubPostRelay=snapshot();});
 G.clubPostRelay={snapshot,host,join,ready,start,context,interact,leave,again,retrySave:saveResult,setRoute};scopeCheck();
}

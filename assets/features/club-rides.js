/* Live club rides coordinate voluntary trail starts. Packets never move a rider,
   award a reward, or replace an existing activity. The normal trail owns play. */
export const id='club-rides';
const TTL=180000, ONLINE=45000, HEARTBEAT=15000, LIFETIME=6*3600000;
const safe=v=>typeof v==='string'&&/^[a-zA-Z0-9_-]{1,64}$/.test(v)&&v!=='prototype'&&!Object.prototype.hasOwnProperty.call(Object.prototype,v);
const clean=(v,n=48)=>String(v??'').replace(/[\x00-\x1f\x7f]/g,' ').trim().slice(0,n);
const copy=v=>JSON.parse(JSON.stringify(v));
const fail=reason=>({ok:false,reason});

export function install(G){
 const N=G.net,S=G.save,now=()=>Date.now(),me=()=>N.net.id,name=()=>clean(N.myName(),14)||'Rider';
 const sessions=new Map(),members=new Map(),pending=new Map(),pendingPlans=new Map();
 let currentId=null,scope='',elapsed=0,lastBeat=0,lastConnected=false,lastNotice='';
 S.ensure(s=>{s.clubRideResume=s.clubRideResume||null;s.clubRideHistory=s.clubRideHistory||{};});
 const code=()=>G.clubs?.identity(S.fresh())?.code||'';
 const connected=()=>!!N.net.client?.connected&&!!code()&&N.net.club===code();
 const blocked=n=>{const s=S.fresh()||{};return !!s.blocked?.[n]||(s.tempMute?.[n]||0)>now();};
 const routes=()=>G.social?.EXPEDITIONS||[];
 const route=id=>routes().find(r=>r.id===id);
 const plan=id=>G.clubActivities?.snapshot().rides.find(r=>r.id===id);
 const topic=(kind,sid,pid)=>'srf1/'+scope+'/clubride2/'+kind+'/'+sid+(pid?'/'+pid:'');
 const notify=()=>G.run('clubRideChanged');
 function connectionReason(){if(!safe(code()))return 'Join a club first.';if(N.net.club!==code())return 'Connect to your club room to ride together.';if(!N.net.client?.connected)return 'Connect to your club to host or join a live ride.';return '';}
 function routeReason(r){
  if(!r||!Array.isArray(r.stops)||r.stops.length<2)return 'This route is unavailable.';
  for(const p of r.stops){
   if(!Array.isArray(p)||!Number.isFinite(p[1])||!Number.isFinite(p[2]))return 'This route is unavailable.';
   const locked=G.worldPkg?.lockedRegionsAt?.(p[1],p[2])||[];
   if(locked.length)return G.worldPkg.lockText?.(locked[0])||'Unlock the route’s region first.';
  }
  return '';
 }
 function playReason(sid){
  if(G.course?.get())return 'Finish your event before joining a club ride.';
  if(G.course?.drillActive?.())return 'Finish your drill before joining a club ride.';
  if(G.rescueRide?.snapshot?.().active)return 'Finish or end your rescue before joining a club ride.';
  if(G.roundup?.state?.().active)return 'Finish or end your roundup before joining a club ride.';
  if(G.horse?.player?.flying||G.horse?.player?.landing||(G.horse?.player?.y||0)>.1)return 'Land before joining a club ride.';
  if(G.worldPkg?.vehicle?.())return 'Leave the vehicle before joining a club ride.';
  if(G.horse?.player?.onFoot||G.onFoot?.on)return 'Mount your horse before joining a club ride.';
  if(G.social?.spectate||G.social?.tour)return 'Leave spectating or the ranch tour first.';
  if(G.trail?.ride&&G.trail.ride.clubRideId!==sid)return 'Finish or stop your current trail ride first.';
  if(!G.trail?.start)return 'Trail rides are unavailable.';
  return '';
 }
 function roster(sid){if(!members.has(sid))members.set(sid,new Map());return members.get(sid);}
 function storeResume(){
  const s=sessions.get(currentId),p=s&&roster(s.id).get(me());
  S.sync(v=>{v.clubRideResume=s&&p?{code:scope,id:s.id,session:copy(s),participant:copy(p)}:null;
   if(s&&p)v.clubRideHistory[scope+'|'+s.id]={progress:p.progress,finished:p.finished,rev:p.rev,at:now()};
   for(const [k,h]of Object.entries(v.clubRideHistory))if(now()-h.at>86400000)delete v.clubRideHistory[k];
  });
 }
 function stopTrail(sid){if(G.trail?.ride?.clubRideId===sid){G.trail.ride=null;if(G.trail.arrow)G.trail.arrow.visible=false;}}
 function publishSession(s){const {id,...wire}=s;return N.publish(topic('session',id),wire,{retain:true});}
 function publishMember(sid,p){return N.publish(topic('rider',sid,me()),p,{retain:true});}
 function setSelf(sid,changes,save=true){
  const old=roster(sid).get(me())||S.fresh()?.clubRideHistory?.[scope+'|'+sid]||{},p={name:name(),ready:false,progress:0,finished:false,left:false,...old,...changes,rev:(old.rev||0)+1,at:now()};
  roster(sid).set(me(),p);if(connected())publishMember(sid,p);if(save)storeResume();notify();return p;
 }
 function hydrate(){
  const saved=S.fresh()?.clubRideResume;
  if(!saved||saved.code!==scope||!safe(saved.id)||saved.session?.id!==saved.id||saved.session.expiresAt<=now()||!route(saved.session.routeId))return;
  const s=saved.session,p=saved.participant;if(!p||!Number.isInteger(p.progress))return;
  sessions.set(s.id,copy(s));roster(s.id).set(me(),copy(p));currentId=s.id;
 }
 function changeScope(){
  const next=code();if(next===scope)return;
  stopTrail(currentId);sessions.clear();members.clear();pending.clear();pendingPlans.clear();currentId=null;scope=safe(next)?next:'';hydrate();notify();
 }
 function validSession(sid){
  const s=sessions.get(sid);return s&&s.status!=='cancelled'&&s.expiresAt>now()&&!blocked(s.host)?s:null;
 }
 function expire(){
  let changed=false;
  for(const [sid,s]of sessions)if(s.expiresAt<=now()||blocked(s.host)){
   if(sid===currentId){stopTrail(sid);currentId=null;lastNotice='This club ride has ended or its host is no longer connected.';storeResume();}
   sessions.delete(sid);members.delete(sid);changed=true;
  }
  for(const [key,p]of pending)if(now()-p.at>TTL)pending.delete(key);
  for(const [key,p]of pendingPlans)if(now()-p.at>TTL)pendingPlans.delete(key);
  if(changed)notify();
 }
 function row(s){
  const r=route(s.routeId),p=roster(s.id).get(me()),total=r.stops.length;
  const people=[...roster(s.id)].filter(([,v])=>!v.left&&!blocked(v.name)).map(([pid,v])=>({id:pid,name:v.name,ready:!!v.ready,online:pid===me()?connected():now()-v.at<ONLINE,progress:v.progress,finished:!!v.finished}));
  const joined=currentId===s.id&&!!p&&!p.left;
  return {id:s.id,title:s.title,planId:s.planId||null,routeId:s.routeId,routeName:r.name,host:s.host,status:s.status,roster:people,canHost:s.hostId===me(),canStart:s.hostId===me()&&s.status==='waiting'&&joined&&connected()&&people.filter(v=>v.online).every(v=>v.ready),joined,
   nextStop:r.stops[Math.min(p?.progress||0,total-1)][0],totalStops:total,progress:p?.progress||0,finished:!!p?.finished,riding:G.trail?.ride?.clubRideId===s.id};
 }
 function snapshot(){
  changeScope();expire();
  const list=[...sessions.values()].filter(s=>validSession(s.id)&&route(s.routeId)).sort((a,b)=>b.createdAt-a.createdAt).map(row);
  return {connected:connected(),code:scope,reason:connectionReason()||lastNotice,routes:routes().map(r=>{const reason=routeReason(r);return {id:r.id,name:r.name,blurb:r.blurb,stops:r.stops.length,points:copy(r.stops),distance:r.stops.slice(1).reduce((d,p,i)=>d+Math.hypot(p[1]-r.stops[i][1],p[2]-r.stops[i][2]),0),locked:!!reason,reason};}),lobbies:list,current:list.find(s=>s.id===currentId)||null};
 }
 function begin(s){
  const reason=connectionReason()||routeReason(route(s.routeId))||playReason(s.id);if(reason)return fail(reason);
  const p=roster(s.id).get(me());if(!p||p.left)return fail('Join this ride first.');if(p.finished)return fail('You have already finished this ride.');
  if(G.trail.ride?.clubRideId===s.id)return {ok:true};
  const r=route(s.routeId);
  if(!G.trail.start(copy(r.stops),s.host,{name:s.title,exped:r.id,clubRideId:s.id}))return fail('The trail could not be started.');
  G.trail.ride.idx=Math.min(p.progress,r.stops.length-1);setSelf(s.id,{ready:true,left:false});
  G.riding?.releaseAll?.();G.hidePanels?.();return {ok:true};
 }
 function forPlan(planId){
  changeScope();expire();const p=plan(planId);if(!p?.routeId)return null;
  const s=[...sessions.values()].filter(s=>validSession(s.id)&&s.planId===planId&&s.hostId===p.creator&&s.routeId===p.routeId).sort((a,b)=>b.createdAt-a.createdAt)[0];
  return s?row(s):null;
 }
 function host(routeId,options={}){
  changeScope();expire();
  if(!options||typeof options!=='object')return fail('This ride setup is unavailable.');
  const p=options.planId?plan(options.planId):null;
  if(options.planId&&(!safe(options.planId)||!p||p.creator!==me()||p.routeId!==routeId))return fail('Only this scheduled ride’s host can launch its selected route.');
  if(options.planId&&forPlan(options.planId))return fail('This scheduled ride already has a live lobby. Open it instead.');
  const reason=connectionReason()||routeReason(route(routeId))||playReason(null);if(reason)return fail(reason);
  if(currentId)return fail('Leave your current club ride before hosting another.');
  if([...sessions.values()].some(s=>s.hostId===me()&&validSession(s.id)))return fail('You already have a live ride. Join it or cancel it first.');
  if(!safe(me()))return fail('Your rider identity is unavailable.');
  const id=me()+'-'+now().toString(36)+'-'+Math.random().toString(36).slice(2,6),r=route(routeId);
  const s={id,hostId:me(),host:name(),routeId,planId:p?.id||null,title:p?.title||clean(options.title)||r.name,status:'waiting',rev:1,createdAt:now(),at:now(),expiresAt:now()+TTL};
  sessions.set(id,s);currentId=id;lastNotice='';publishSession(s);setSelf(id,{ready:true});return {ok:true,id};
 }
 function launchPlan(planId){
  changeScope();expire();const p=plan(planId);
  if(!safe(planId)||!p?.routeId)return fail('This scheduled ride does not have an available route.');
  if(p.creator!==me())return fail('Only the scheduled ride’s host can launch it.');
  const existing=forPlan(planId),reason=connectionReason()||routeReason(route(p.routeId))||playReason(existing?.id);if(reason)return fail(reason);
  if(!existing)return host(p.routeId,{planId,title:p.title});
  if(currentId&&currentId!==existing.id)return fail('Leave your current club ride before opening another.');
  currentId=existing.id;const self=roster(existing.id).get(me());
  if(!self?.finished)setSelf(existing.id,{left:false,ready:true});else storeResume();
  if(existing.status==='riding'&&!self?.finished){const result=begin(sessions.get(existing.id));if(!result.ok)return result;}
  notify();return {ok:true,id:existing.id,existing:true};
 }
 function join(sid){
  changeScope();expire();const s=validSession(sid);if(!s)return fail('This club ride is no longer available.');
  const reason=connectionReason()||routeReason(route(s.routeId))||playReason(sid);if(reason)return fail(reason);
  if(currentId&&currentId!==sid)return fail('Leave your current club ride before joining another.');
  if(roster(sid).get(me())?.finished||S.fresh()?.clubRideHistory?.[scope+'|'+sid]?.finished)return fail('You have already finished this ride.');
  if(roster(sid).size>=24&&!roster(sid).has(me()))return fail('This ride already has 24 riders.');
  currentId=sid;lastNotice='';setSelf(sid,{left:false});return s.status==='riding'?begin(s):{ok:true};
 }
 function ready(on=true){changeScope();const s=validSession(currentId);const reason=connectionReason();if(reason)return fail(reason);if(!s||s.status!=='waiting')return fail('Join a waiting ride first.');setSelf(s.id,{ready:!!on});return {ok:true};}
 function start(sid=currentId){
  changeScope();
  const s=validSession(sid);if(!s||s.hostId!==me())return fail('Only the host can start this ride.');
  const reason=connectionReason()||routeReason(route(s.routeId))||playReason(sid);if(reason)return fail(reason);
  if(s.status!=='waiting')return fail('This ride has already started.');
  if(!row(s).canStart)return fail('Wait for the riders who are online to mark Ready.');
  const result=begin(s);if(!result.ok)return result;
  Object.assign(s,{status:'riding',rev:s.rev+1,at:now(),expiresAt:now()+TTL});publishSession(s);storeResume();notify();return {ok:true};
 }
 function leave(){
  changeScope();
  const s=sessions.get(currentId);if(!s)return fail('You are not in a club ride.');
  if(s.hostId===me())return cancel(s.id);
  stopTrail(s.id);setSelf(s.id,{left:true,ready:false});currentId=null;storeResume();notify();return {ok:true};
 }
 function cancel(sid=currentId){
  changeScope();
  const s=sessions.get(sid);if(!s||s.hostId!==me())return fail('Only the host can end this ride.');
  Object.assign(s,{status:'cancelled',rev:s.rev+1,at:now(),expiresAt:now()+TTL});if(connected())publishSession(s);
  stopTrail(sid);if(currentId===sid){setSelf(sid,{left:true});currentId=null;storeResume();}notify();return {ok:true};
 }
 function rejoin(){changeScope();const s=validSession(currentId);if(!s)return fail('Join a live club ride first.');if(s.status!=='riding')return fail('The host has not started this ride yet.');return begin(s);}
 function acceptMember(sid,pid,m){
  const s=validSession(sid);if(!s)return false;const total=route(s.routeId)?.stops.length;
  if(!total||!Number.isInteger(m.progress)||m.progress<0||m.progress>total||typeof m.ready!=='boolean'||typeof m.left!=='boolean'||typeof m.finished!=='boolean'||m.finished!==(m.progress===total))return false;
  const rows=roster(sid),old=rows.get(pid);if((old&&m.rev<=old.rev)||(!old&&rows.size>=24))return false;
  rows.set(pid,{name:clean(m.n,14)||'Rider',ready:m.ready,left:m.left,finished:!!old?.finished||m.finished,progress:Math.max(old?.progress||0,m.progress),rev:m.rev,at:m.at});return true;
 }
 function acceptSession(sid,m,queue=true){
  if(N.net.club!==scope||scope!==code()||m.expiresAt<=now()||m.at<now()-TTL||blocked(clean(m.n,14)))return;
  if(m.planId!=null&&!safe(m.planId))return;
  const old=sessions.get(sid);
  if(old&&(old.hostId!==m.hostId||old.routeId!==m.routeId||(old.planId||null)!==(m.planId||null)||old.rev>=m.rev||(old.status==='cancelled'&&m.status!=='cancelled')||(old.status==='riding'&&m.status==='waiting')))return;
  if(m.planId&&!old){
   const p=plan(m.planId);
   // Retained lobby and calendar packets may arrive in either order. Validate
   // the calendar's creator and route before exposing a newly linked lobby.
   if(!p){const queued=pendingPlans.get(sid);if(queue&&(queued||pendingPlans.size<24)&&(!queued||m.rev>queued.m.rev))pendingPlans.set(sid,{m:copy(m),at:now()});return;}
   if(p.creator!==m.hostId||p.routeId!==m.routeId)return;
  }
  // An already validated lobby may still end after its calendar plan is deleted.
  if(!old&&sessions.size>=24)return;
  const s={id:sid,hostId:m.hostId,host:clean(m.n,14)||'Rider',routeId:m.routeId,planId:m.planId||null,title:clean(m.title)||route(m.routeId).name,status:m.status,rev:m.rev,createdAt:m.createdAt,at:m.at,expiresAt:m.expiresAt};sessions.set(sid,s);
  for(const [key,v]of pending)if(v.sid===sid){acceptMember(sid,v.pid,v.m);pending.delete(key);}
  if(s.status==='cancelled'&&currentId===sid){stopTrail(sid);currentId=null;lastNotice='The host ended this club ride.';storeResume();}
  pendingPlans.delete(sid);notify();
 }
 G.on('clubActivityChanged',()=>{expire();for(const [sid,p]of pendingPlans)acceptSession(sid,p.m,false);});
 G.on('message',(t,m)=>{
  if(typeof t!=='string'||!m||typeof m!=='object')return;
  const p=t.split('/');if(p[0]!=='srf1'||p[2]!=='clubride2')return;
  if(p[1]!==scope||p[1]!==code()||N.net.club!==scope||!safe(m.id)||m.id===me()||blocked(clean(m.n,14))||!Number.isInteger(m.rev)||m.rev<1||!Number.isFinite(m.at)||m.at>now()+30000||m.at<now()-TTL)return true;
  const sid=p[4];if(!safe(sid))return true;
  if(p[3]==='session'&&p.length===5){
   // Session identity is in the topic; envelope id always identifies its host.
   if(m.hostId!==m.id||!sid.startsWith(m.hostId+'-')||!route(m.routeId)||!['waiting','riding','cancelled'].includes(m.status)||!Number.isFinite(m.expiresAt)||m.expiresAt<=now()||m.expiresAt>m.at+TTL||!Number.isFinite(m.createdAt)||m.createdAt>m.at||now()-m.createdAt>LIFETIME)return true;
   acceptSession(sid,m);return true;
  }
  if(p[3]==='rider'&&p.length===6&&safe(p[5])&&m.id===p[5]){
   if(!sessions.has(sid)){const key=sid+'/'+p[5],old=pending.get(key);if((old||pending.size<128)&&(!old||m.rev>old.m.rev))pending.set(key,{sid,pid:p[5],m:copy(m),at:now()});}
   else if(acceptMember(sid,p[5],m))notify();return true;
  }
  return true;
 });
 function progress(r,finished=false){
  if(!r||r.clubRideId!==currentId)return;
  const s=validSession(currentId),old=s&&roster(s.id).get(me());if(!s||!old||old.finished)return;
  const n=Math.min(route(s.routeId).stops.length,Math.max(old.progress,r.idx|0));
  if(finished||n!==old.progress)setSelf(s.id,{progress:n,finished:finished&&n===route(s.routeId).stops.length});
 }
 G.on('trailStop',r=>progress(r));G.on('trailDone',r=>progress(r,true));
 G.on('courseStart',()=>{if(currentId){progress(G.trail?.ride);stopTrail(currentId);notify();}});
 function subscribe(){changeScope();if(scope)N.subscribe('srf1/'+scope+'/clubride2/#');}
 function heartbeat(){
  changeScope();expire();if(!connected())return;
  const s=validSession(currentId);if(!s)return;
  if(s.hostId===me()){Object.assign(s,{rev:s.rev+1,at:now(),expiresAt:Math.min(now()+TTL,s.createdAt+LIFETIME)});publishSession(s);}
  const p=roster(s.id).get(me());if(p&&!p.left)setSelf(s.id,{},false);storeResume();
 }
 G.on('connect',()=>{
  subscribe();
  // A voluntary leave made offline still reaches the group after reconnection.
  if(connected())for(const s of sessions.values())if(s.expiresAt>now()){
   if(s.hostId===me()&&s.status==='cancelled')publishSession(s);
   const p=roster(s.id).get(me());if(p?.left)publishMember(s.id,p);
  }
  heartbeat();notify();
 });
 G.on('clubChanged',()=>{changeScope();subscribe();});
 G.on('clubRoom',(room)=>{if(room!==scope){progress(G.trail?.ride);stopTrail(currentId);notify();}});
 G.on('tick',dt=>{
  elapsed+=dt;if(elapsed<1)return;elapsed=0;changeScope();expire();
  const on=connected();if(on!==lastConnected){lastConnected=on;notify();}
  if(G.trail?.ride?.clubRideId===currentId){progress(G.trail.ride);if(G.worldPkg?.vehicle?.())stopTrail(currentId);}
  if(now()-lastBeat>=HEARTBEAT){lastBeat=now();heartbeat();}
 });
 G.on('state',o=>{const s=snapshot();o.clubRide={connected:s.connected,code:s.code,lobbies:s.lobbies.length,current:s.current};});
 G.clubRides={snapshot,host,join,ready,start,leave,cancel,rejoin,forPlan,launchPlan};subscribe();
}

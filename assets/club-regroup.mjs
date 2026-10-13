import {REGROUP_MODE,REGROUP_ROUTE,REGROUP_FRESH_MS,REGROUP_RADIUS,regroupInput,regroupAtStop,sameRegroupTrail} from './club-regroup-rules.mjs?v=club-regroup-1';
/* A narrow gate before tickTrail's existing local proximity crossing. This
   coordinator neither assigns trail.idx nor calls any reward/finish method. */
export function createClubRegroup(G,A){
 const {now,me,session,roster,route,connected,memberAllowed,publish,publishSession,changed}=A;
 const observations=new Map();let ticket=null,sequence=0,nonce=0,lastSend=0,lastPosition=null,ownedRide=null,released=null;
 const isMode=s=>s?.mode===REGROUP_MODE;
 const current=()=>session();
 const localActive=()=>!G.input?.blocked?.()&&!G.photoPause&&!G.cam?.isFree?.()&&!(typeof document!=='undefined'&&(document.hidden||document.body?.classList?.contains('freecam')||document.body?.classList?.contains('posing')));
 function mounted(){const p=G.horse.player,r=G.horse.RIG?.();return !p.onFoot&&!G.onFoot?.on&&!p.flying&&!p.landing&&!G.worldPkg?.vehicle?.()&&!!r?.ready&&!r.loadingBreed&&!r.emote&&!r.heroMotion?.state?.action&&!r.heroMotion?.state?.transitioning;}
 function rideFor(s){const r=G.trail?.ride;return isMode(s)&&r===ownedRide&&r?.clubRideId===s.id&&r.clubRegroup===REGROUP_MODE&&sameRegroupTrail(r,route(s.routeId))?r:null;}
 function local(s){const r=rideFor(s),p=G.horse.player,at=now(),rig=G.horse.RIG?.(),motion=rig?.heroMotion?.state;return {id:me(),sid:s?.id,route:REGROUP_ROUTE,mode:REGROUP_MODE,rev:sequence,at,receivedAt:at,x:p.pos.x,z:p.pos.z,speed:p.speed,index:r?.idx??-1,active:localActive(),mounted:mounted(),grounded:!p.flying&&!p.landing&&Number.isFinite(p.y)&&p.y<.1&&rig?.heroJumpAge==null&&(!motion||motion.grounded===true),nonce:ticket?.nonce||null};}
 function sample(s){
  const o=local(s),p=lastPosition;lastPosition={sid:s.id,x:o.x,z:o.z,at:o.at};
  const discontinuity=p?.sid===s.id&&Math.hypot(o.x-p.x,o.z-p.z)>Math.max(4,45*Math.max(0,(o.at-p.at)/1000));
  const stop=route(s.routeId)?.stops[o.index];
  if(ticket&&(ticket.sid!==s.id||ticket.index!==o.index||discontinuity||!regroupAtStop(o,stop,o.index,now())))ticket=null;
  o.nonce=ticket?.nonce||null;return o;
 }
 function observation(s,id){return id===me()?(s.id===current()?.id?sample(s):null):observations.get(s.id+'/'+id);}
 function valid(s,id,index,needNonce=true){const o=observation(s,id);return memberAllowed(id)&&regroupAtStop(o,route(s.routeId)?.stops[index],index,now())&&(!needNonce||!!o.nonce)?o:null;}
 function members(s){return s.regroup.crew.filter(id=>!roster(s.id).get(id)?.left);}
 function available(s){return isMode(s)&&s.status==='riding'&&s.expiresAt>now()&&connected();}
 function send(){
  const s=current(),r=rideFor(s);if(!s||!r||r.idx>=r.pts.length||!connected())return;
  const o=sample(s);o.rev=sequence=Math.max(sequence+1,now());observations.set(s.id+'/'+me(),o);publish(s.id,me(),o);lastSend=now();if(available(s)&&s.hostId===me())acknowledge(s,me(),o);
 }
 function acknowledge(s,id,o){
  const d=s.regroup.departures[o.index];if(s.hostId!==me()||!d||!s.regroup.crew.includes(id)||roster(s.id).get(id)?.left||!valid(s,id,o.index)||d.ready[id]===o.nonce)return;
  // A rider who moved before consuming Continue must explicitly ready again.
  // Acknowledging that fresh nonce never advances their local trail.
  d.ready[id]=o.nonce;revise(s);
 }
 function revise(s){s.rev++;s.at=now();s.expiresAt=Math.min(now()+180000,s.createdAt+6*3600000);publishSession(s);changed();}
 function receive(s,id,m){
  if(!isMode(s)||!s.regroup.crew.includes(id)||!memberAllowed(id)||roster(s.id).get(id)?.left)return false;
  const key=s.id+'/'+id,old=observations.get(key),o=regroupInput(m,{sid:s.id,memberId:id,now:now(),previous:old});if(!o)return false;
  // Don't let replays of the pre-jump ready nonce regain eligibility.
  if(o.jump) o.rejectedNonce=m.nonce;
  else if(old?.rejectedNonce&&m.nonce===old.rejectedNonce){o.nonce=null;o.rejectedNonce=old.rejectedNonce;}
  observations.set(key,o);if(available(s))acknowledge(s,id,o);changed();return true;
 }
 function begin(s,r){ownedRide=r;ticket=null;released=null;lastPosition=null;sequence=0;lastSend=0;observations.clear();r.clubRegroup=REGROUP_MODE;}
 function clear(){ticket=null;ownedRide=null;released=null;lastPosition=null;observations.clear();}
 function readyAtStop(){
  const s=current(),r=rideFor(s);if(!available(s)||!r)return {ok:false,reason:'Join the group trail in your club room first.'};
  const o=sample(s);if(!regroupAtStop(o,r.pts[r.idx],r.idx,now()))return {ok:false,reason:'Ride to the meeting marker, then stop on your mounted horse.'};
  ticket={sid:s.id,index:r.idx,nonce:'ready-'+now().toString(36)+'-'+(++nonce).toString(36)};send();if(s.hostId===me())acknowledge(s,me(),local(s));changed();return {ok:true};
 }
 function continueTogether(){
  const s=current(),r=rideFor(s);if(!available(s)||!r||s.hostId!==me())return {ok:false,reason:'The host continues the group from the meeting marker.'};
  if(s.regroup.departures.length!==r.idx)return {ok:false,reason:'Follow the route to the next meeting stop.'};
  const ids=members(s);if(ids.length<2)return {ok:false,reason:'Wait for a partner, or choose Continue alone.'};
  const ready=Object.fromEntries(ids.map(id=>[id,valid(s,id,r.idx)?.nonce]));if(Object.values(ready).some(v=>!v))return {ok:false,reason:'Wait for every rider to stop here and choose Ready for next leg.'};
  s.regroup.departures.push({index:r.idx,token:'depart-'+now().toString(36)+'-'+(++nonce).toString(36),at:now(),ready});revise(s);return {ok:true};
 }
 function tickTrail(r){
  if(r?.clubRegroup!==REGROUP_MODE)return;
  const s=current();if(!isMode(s)||!rideFor(s))return true;
  const arrow=G.trail?.arrow,stop=r.pts[r.idx];if(arrow&&Array.isArray(stop)){arrow.visible=true;arrow.position?.set?.(stop[1],(G.world?.groundH?.(stop[1],stop[2])||0)+3.2,stop[2]);}
  const o=sample(s),at=regroupAtStop(o,r.pts[r.idx],r.idx,now());
  const d=s.regroup.departures[r.idx];
  if(at&&ticket&&d?.ready[me()]===ticket.nonce&&d.index===r.idx&&available(s)){released={ride:r,index:r.idx};return false;}
  // Away from a stop, preserve the ordinary arrow and elapsed riding time.
  // All actual credits remain held, including flying/menu/invalid observations.
  return !(Number.isFinite(o.x)&&Number.isFinite(o.z)&&Array.isArray(r.pts[r.idx])&&Math.hypot(o.x-r.pts[r.idx][1],o.z-r.pts[r.idx][2])>=12);
 }
 function progress(r){if(r===ownedRide&&released?.ride===r&&r.idx===released.index+1){ticket=null;released=null;send();changed();}}
 function view(s){
  if(!isMode(s))return null;
  const r=rideFor(s),index=r?.idx??roster(s.id).get(me())?.progress??0,total=route(s.routeId).stops.length;
  const ids=s.regroup.crew.length?s.regroup.crew:[...roster(s.id)].filter(([,p])=>!p.left).map(([id])=>id);
  const at=!!r&&!!valid(s,me(),index,false),ready=!!r&&!!valid(s,me(),index),d=s.regroup.departures[index];
  const people=ids.map(id=>{const o=observation(s,id),fresh=!!o&&now()-o.receivedAt<=REGROUP_FRESH_MS&&now()-o.at<=REGROUP_FRESH_MS;return {id,name:roster(s.id).get(id)?.name||'Rider',me:id===me(),left:!!roster(s.id).get(id)?.left,online:id===me()?connected():fresh,arrived:!!valid(s,id,index,false),ready:!!valid(s,id,index),position:fresh?{x:o.x,z:o.z}:null};});
  const waiting=people.filter(p=>!p.left&&!p.ready),canContinue=available(s)&&s.hostId===me()&&!!r&&s.regroup.departures.length===index&&people.filter(p=>!p.left).length>=2&&!waiting.length;
  let reason=s.status==='waiting'?'Gather your riders, mark Ready, then let the host start the untimed trail.':!connected()?'Connection lost. Reconnect or continue alone.':s.status==='cancelled'||s.expiresAt<=now()?'The group ride ended. Continue alone or leave the trail.':!r&&index<total?'Choose Join the ride to start your own trail.':!localActive()?'Return to riding to meet your group.':!at?'Follow the golden marker and stop with your group.':!ready?'Choose Ready for next leg when you are settled.':d?'The group has continued. Waiting for your ready confirmation.':canContinue?'Everyone is here. Continue together when you are ready.':'Waiting for '+(waiting.map(p=>p.name).join(', ')||'the host')+'.';
  if(index>=total)reason='Your trail is complete. Your partners finish and earn their own usual rewards.';
  return {mode:REGROUP_MODE,radius:REGROUP_RADIUS,stopIndex:index,phase:index>=total?'finished':at?'gathering':'riding',arrived:at,ready,canReady:available(s)&&!!r&&at&&!ready,canContinue,waiting,people,stop:route(s.routeId).stops[Math.min(index,total-1)][0],reason,target:r&&r.pts[index]?{x:r.pts[index][1],z:r.pts[index][2],radius:REGROUP_RADIUS}:null};
 }
 function tick(){const s=current();if(!isMode(s))return;if(rideFor(s)){sample(s);if(now()-lastSend>=350)send();}}
 return {begin,clear,receive,readyAtStop,continueTogether,tickTrail,progress,view,tick};
}

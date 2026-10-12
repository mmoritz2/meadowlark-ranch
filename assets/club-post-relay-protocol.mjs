// Packet hygiene for a voluntary two-rider relay. Client messages are not
// authenticated authority and this protocol grants no money, items or stats.
export const RELAY_TTL=45000;
export const RELAY_LIFETIME=45*60*1000;
export const RELAY_INPUT_MAX_AGE=1800;
export const RELAY_MEMBER_MAX_AGE=6000;
export const RELAY_FINISH_RECOVERY=8000;
export const RELAY_BOUNDS=Object.freeze({x1:-60,x2:65,z1:-85,z2:20});
const FUTURE_SKEW=2000;
const STAGES=['collect','outbound','passPost','deliver','backToPines','passReply','home','finished'];
const LEGS=['outbound','deliver','backToPines','home'];
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const integer=v=>Number.isSafeInteger(v)&&v>=0;
const positive=v=>integer(v)&&v>0;
const same=(a,b,keys)=>keys.every(k=>a?.[k]===b?.[k]);
const fresh=(at,now,maxAge=RELAY_TTL)=>finite(now)&&now>0&&finite(at)&&at>0&&at<=now+FUTURE_SKEW&&now-at<=maxAge;
const rows=v=>v instanceof Map?[...v.values()]:Array.isArray(v)?v:object(v)?Object.values(v):[];
const inside=(x,z)=>finite(x)&&finite(z)&&x>=RELAY_BOUNDS.x1&&x<=RELAY_BOUNDS.x2&&z>=RELAY_BOUNDS.z1&&z<=RELAY_BOUNDS.z2;
export const safeRelayId=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,96}$/.test(v)&&!['__proto__','prototype','constructor'].includes(v);
export function cleanRelayName(v,n=14){return typeof v==='string'?v.replace(/[\x00-\x1f\x7f]/g,' ').trim().slice(0,Number.isInteger(n)&&n>0?Math.min(n,96):14):'';}
function rosterOf(value){
 if(!Array.isArray(value)||value.length<1||value.length>2)return null;
 const ids=new Set(),slots=new Set(),roster=[];
 for(const p of value){if(!object(p)||!safeRelayId(p.id)||!cleanRelayName(p.name)||typeof p.ready!=='boolean'||!integer(p.slot)||p.slot>1||ids.has(p.id)||slots.has(p.slot))return null;
  ids.add(p.id);slots.add(p.slot);roster.push({id:p.id,name:cleanRelayName(p.name),ready:p.ready,slot:p.slot});}
 return roster.sort((a,b)=>a.slot-b.slot);
}
function context(session,now,states,{recovery=false}={}){
 if(!object(session)||!safeRelayId(session.sid)||!safeRelayId(session.hostId)||!safeRelayId(session.code)||!states.includes(session.status)||!finite(session.expiresAt))return null;
 const grace=recovery&&session.status==='finished'?RELAY_FINISH_RECOVERY:0;
 if(session.expiresAt+grace<=now||!fresh(session.at,now,RELAY_TTL+grace))return null;
 const roster=rosterOf(session.roster);if(!roster?.some(p=>p.id===session.hostId&&p.slot===0))return null;
 if(session.status!=='waiting'&&(roster.length!==2||!roster.some(p=>p.id===session.firstId)||!finite(session.startAt)))return null;
 return roster;
}
function envelope(m,kind,session,now,maxAge=RELAY_TTL){return object(m)&&m.kind===kind&&safeRelayId(m.id)&&m.sid===session.sid&&(m.code==null||m.code===session.code)&&fresh(m.at,now,maxAge);}

export function validateRelaySession(sid,m,{now,code,known}={}){
 if(!object(m)||m.kind!=='session'||!safeRelayId(sid)||m.sid!==sid||!safeRelayId(code)||m.code!==code||!safeRelayId(m.hostId)||m.id!==m.hostId||!sid.startsWith(m.hostId+'-')||!cleanRelayName(m.n)||!positive(m.rev)||!fresh(m.at,now))return null;
 if(!positive(m.createdAt)||m.createdAt>m.at||now-m.createdAt>RELAY_LIFETIME||!finite(m.expiresAt)||m.expiresAt<=now||m.expiresAt<=m.at||m.expiresAt>m.at+RELAY_TTL||m.expiresAt>m.createdAt+RELAY_LIFETIME)return null;
 if(!['waiting','riding','finished','cancelled'].includes(m.status)||m.runId!=null&&m.runId!==sid)return null;
 const roster=rosterOf(m.roster);if(!roster||!roster.some(p=>p.id===m.hostId&&p.slot===0))return null;
 const started=m.status==='riding'||m.status==='finished'||m.startAt!=null;
 if(m.firstId!=null&&!roster.some(p=>p.id===m.firstId))return null;
 if(m.startAt!=null&&(!finite(m.startAt)||m.startAt<m.createdAt||m.startAt>m.expiresAt))return null;
 if(started&&(roster.length!==2||!safeRelayId(m.firstId)||m.startAt==null))return null;
 if(known){
  if(!same(m,known,['sid','hostId','code','createdAt'])||m.rev<=known.rev||m.at<known.at)return null;
  if(['finished','cancelled'].includes(known.status)&&m.status!==known.status||known.status==='riding'&&m.status==='waiting')return null;
  if(known.startAt!=null&&(m.startAt!==known.startAt||m.firstId!==known.firstId))return null;
  if(known.status!=='waiting'||known.startAt!=null){
   if(roster.length!==known.roster?.length||roster.some(p=>!known.roster.some(old=>same(p,old,['id','slot']))))return null;
  }
 }
 return {kind:'session',id:m.id,n:cleanRelayName(m.n),hostId:m.hostId,code,sid,runId:sid,rev:m.rev,at:m.at,createdAt:m.createdAt,expiresAt:m.expiresAt,status:m.status,roster,
  ...(m.firstId==null?{}:{firstId:m.firstId}),...(m.startAt==null?{}:{startAt:m.startAt})};
}
export function validateRelayMember(m,{now,session,known}={}){
 const roster=context(session,now,['waiting','riding']);
 if(!roster||!envelope(m,'member',session,now)||!cleanRelayName(m.n)||!positive(m.rev)||typeof m.ready!=='boolean'||typeof m.left!=='boolean'||m.left&&m.ready)return null;
 if(!roster.some(p=>p.id===m.id)&&(session.status!=='waiting'||roster.length>=2))return null;
 if(known&&(!same(m,known,['id','sid'])||m.rev<=known.rev||m.at<known.at))return null;
 return {kind:'member',id:m.id,n:cleanRelayName(m.n),sid:m.sid,rev:m.rev,at:m.at,ready:m.ready,left:m.left};
}
export function validateRelayInput(m,{now,session,known}={}){
 const roster=context(session,now,['waiting','riding']);
 if(!roster||!envelope(m,'input',session,now,RELAY_INPUT_MAX_AGE)||!cleanRelayName(m.n)||!positive(m.seq)||!inside(m.x,m.z)||!finite(m.speed)||Math.abs(m.speed)>50||
  !['active','ready','grounded','canJump'].every(k=>typeof m[k]==='boolean')||!roster.some(p=>p.id===m.id))return null;
 if(known){
  if(!same(m,known,['id','sid'])||m.seq<=known.seq||m.at<known.at||!inside(known.x,known.z)||!finite(known.speed)||!finite(known.at))return null;
  const seconds=Math.max(0,Math.min(.5,(m.at-known.at)/1000)),limit=Math.max(8,(Math.max(Math.abs(m.speed),Math.abs(known.speed))+12)*seconds*2);
  if(Math.hypot(m.x-known.x,m.z-known.z)>limit)return null;
 }
 return {kind:'input',id:m.id,n:cleanRelayName(m.n),sid:m.sid,seq:m.seq,at:m.at,x:m.x,z:m.z,speed:m.speed,active:m.active,ready:m.ready,grounded:m.grounded,canJump:m.canJump};
}
export function validateRelayAction(m,{now,session,lastSeq=0}={}){
 const roster=context(session,now,['riding']);
 if(!roster||!envelope(m,'action',session,now,RELAY_INPUT_MAX_AGE)||!cleanRelayName(m.n)||!positive(m.seq)||!integer(lastSeq)||m.seq<=lastSeq||!positive(m.stateRev)||!positive(m.inputSeq)||
  !['collect','offer','accept','exchange','return','route'].includes(m.action)||!roster.some(p=>p.id===m.id))return null;
 if(m.offerId!=null&&!safeRelayId(m.offerId)||m.route!=null&&!['road','woodland'].includes(m.route)||m.action==='accept'&&!safeRelayId(m.offerId)||m.action==='route'&&!['road','woodland'].includes(m.route))return null;
 return {kind:'action',id:m.id,n:cleanRelayName(m.n),sid:m.sid,seq:m.seq,at:m.at,action:m.action,stateRev:m.stateRev,inputSeq:m.inputSeq,
  ...(m.offerId==null?{}:{offerId:m.offerId}),...(m.route==null?{}:{route:m.route})};
}
export function canStartRelay(session,members,{now,selfId}={}){
 const roster=context(session,now,['waiting']);if(!roster||roster.length!==2||selfId!==session.hostId)return false;
 const latest=new Map();for(const m of rows(members)){
  if(!object(m)||!safeRelayId(m.id)||m.sid!==session.sid||!positive(m.rev))continue;
  const old=latest.get(m.id);if(!old||m.rev>old.rev||m.rev===old.rev&&m.at>old.at)latest.set(m.id,m);
 }
 return roster.every(p=>{const m=latest.get(p.id);return p.ready&&m?.ready===true&&m.left===false&&fresh(m.at,now,RELAY_MEMBER_MAX_AGE);});
}

export function validateRelayFrame(m,{now,session,known}={}){
 const roster=context(session,now,['riding','finished'],{recovery:true});
 if(!roster||!envelope(m,'frame',session,now,RELAY_FINISH_RECOVERY)||m.id!==session.hostId||!positive(m.seq)||!object(m.state))return null;
 if(known&&(!same(m,known,['sid','id'])||m.seq<=known.seq||m.at<known.at))return null;
 const s=m.state,index=STAGES.indexOf(s.stage),first=session.firstId,other=roster.find(p=>p.id!==first)?.id;
 if(s.sessionId!==session.sid||index<0||s.firstId!==first||s.otherId!==other||!positive(s.rev)||!finite(s.elapsed)||s.elapsed<0||s.elapsed>RELAY_LIFETIME/1000||!finite(s.distance)||s.distance<0||s.distance>50*RELAY_LIFETIME/1000||
  !['road','woodland'].includes(s.route)||!['road','woodland'].includes(s.returnRoute)||!['startupWaiting','paused','finished'].every(k=>typeof s[k]==='boolean')||!object(s.legs)||!LEGS.every(k=>finite(s.legs[k])&&s.legs[k]>=0&&s.legs[k]<=s.distance))return null;
 const carrier=index===0||index===7?null:index<=2||index===6?first:other,handoffs=index<=2?0:index<=5?1:2;
 if(s.carrierId!==carrier||s.handoffs!==handoffs||s.finished!==(index===7)||session.status==='finished'&&!s.finished)return null;
 if(s.startupWaiting&&(index!==0||s.rev!==1||s.elapsed!==0||s.distance!==0||LEGS.some(k=>s.legs[k]!==0)))return null;
 if(index===0&&(s.elapsed!==0||s.distance!==0||LEGS.some(k=>s.legs[k]!==0)))return null;
 if(index>=2&&s.legs.outbound<30||index>=4&&s.legs.deliver<45||index>=5&&s.legs.backToPines<45||index>=7&&s.legs.home<30)return null;
 if(index>=4&&s.returnRoute!==s.route)return null;
 if(s.finished?(!finite(s.completedAt)||s.completedAt<session.startAt||s.completedAt>m.at||s.startupWaiting||s.elapsed<=0||s.distance<150):s.completedAt!==null)return null;
 let offer=null;
 if(s.offer!==null){const p=s.offer,receiver=carrier===first?other:first;
  if(!object(p)||![2,5].includes(index)||!safeRelayId(p.id)||p.from!==carrier||p.to!==receiver||p.rev!==s.rev||p.kind!==(index===2?'post':'reply')||!finite(p.at)||p.at<session.startAt||p.at>m.at)return null;
  offer={id:p.id,from:p.from,to:p.to,at:p.at,rev:p.rev,kind:p.kind};
 }
 const inputs=[],inputIds=new Set();
 if(m.inputs!=null&&!Array.isArray(m.inputs)||m.inputs?.length>2)return null;
 for(const p of m.inputs||[]){
  if(!object(p)||p.kind!=='input'||!safeRelayId(p.id)||inputIds.has(p.id)||!roster.some(r=>r.id===p.id)||p.sid!==session.sid||p.code!=null&&p.code!==session.code||!cleanRelayName(p.n)||!positive(p.seq)||!finite(p.at)||p.at<session.createdAt||p.at>m.at+FUTURE_SKEW||!inside(p.x,p.z)||!finite(p.speed)||Math.abs(p.speed)>50||!['active','ready','grounded','canJump'].every(k=>typeof p[k]==='boolean'))return null;
  inputIds.add(p.id);inputs.push({kind:'input',id:p.id,n:cleanRelayName(p.n),sid:p.sid,seq:p.seq,at:p.at,x:p.x,z:p.z,speed:p.speed,active:p.active,ready:p.ready,grounded:p.grounded,canJump:p.canJump});
 }
 const prior=known?.state;
 if(prior){
  const oldIndex=STAGES.indexOf(prior.stage);
  if(index<oldIndex||s.rev<prior.rev||s.elapsed<prior.elapsed||s.distance<prior.distance||s.handoffs<prior.handoffs||LEGS.some(k=>s.legs[k]<prior.legs[k])||prior.finished&&!s.finished||!prior.startupWaiting&&s.startupWaiting)return null;
  if(oldIndex>=4&&(s.route!==prior.route||s.returnRoute!==prior.returnRoute))return null;
  if(s.route!==prior.route&&index<3)return null;
  if(prior.completedAt!=null&&s.completedAt!==prior.completedAt)return null;
  if(s.rev===prior.rev&&!same(s,prior,['stage','carrierId','firstId','otherId','route','returnRoute','handoffs','completedAt']))return null;
  if(s.rev===prior.rev&&JSON.stringify(offer)!==JSON.stringify(prior.offer))return null;
 }
 return {kind:'frame',id:m.id,n:cleanRelayName(m.n)||session.n,sid:m.sid,seq:m.seq,at:m.at,inputs,state:{sessionId:s.sessionId,stage:s.stage,carrierId:carrier,firstId:first,otherId:other,route:s.route,returnRoute:s.returnRoute,rev:s.rev,
  elapsed:s.elapsed,distance:s.distance,handoffs,offer,startupWaiting:s.startupWaiting,paused:s.paused,finished:s.finished,legs:Object.fromEntries(LEGS.map(k=>[k,s.legs[k]])),completedAt:s.completedAt}};
}

function resultProof(v){
 if(!object(v)||!safeRelayId(v.runId)||!finite(v.elapsed)||v.elapsed<=0||v.elapsed>RELAY_LIFETIME/1000||!finite(v.distance)||v.distance<150||v.distance>50*RELAY_LIFETIME/1000||v.handoffs!==2||!positive(v.at)||!Array.isArray(v.participants)||v.participants.length!==2||!safeRelayId(v.firstId)||!safeRelayId(v.otherId)||v.firstId===v.otherId)return null;
 const participants=[];for(const p of v.participants){if(!object(p)||!safeRelayId(p.id)||!cleanRelayName(p.name)||participants.some(q=>q.id===p.id))return null;participants.push({id:p.id,name:cleanRelayName(p.name)});}
 if(!participants.some(p=>p.id===v.firstId)||!participants.some(p=>p.id===v.otherId))return null;
 // The stable run identifier binds the session creation timestamp. A pruned
 // receipt cannot be replayed with a newer date to evade the closed watermark.
 if(!participants.some(p=>{const prefix=p.id+'-'+v.at.toString(36)+'-';return v.runId.startsWith(prefix)&&/^[a-z0-9]{5}$/.test(v.runId.slice(prefix.length));}))return null;
 return {runId:v.runId,elapsed:v.elapsed,distance:v.distance,participants,firstId:v.firstId,otherId:v.otherId,handoffs:2,at:v.at};
}
const cloneProof=v=>({...v,participants:v.participants.map(p=>({...p}))});
/** Reads/writes only s.clubPostRelayRecords; the caller persists save atomically. */
export function relayRecordResult(saved,result){
 const proof=resultProof(result);if(!proof)return null;
 const old=object(saved)?saved:{},receipts={};let closedBefore=integer(old.closedBefore)?old.closedBefore:0;
 for(const [id,r] of Object.entries(object(old.receipts)?old.receipts:{})){
  const p=resultProof(r);if(safeRelayId(id)&&p?.runId===id&&r.saved===true&&typeof r.newBest==='boolean'&&finite(r.bestTime)&&r.bestTime>0&&r.bestTime<=p.elapsed)receipts[id]={...p,newBest:r.newBest,bestTime:r.bestTime,saved:true};
 }
 // A recovered or malformed oversized ledger is bounded before either the
 // duplicate-return path or a new write; evicted creation times stay closed.
 const retained=Object.entries(receipts).sort((a,b)=>b[1].at-a[1].at||a[0].localeCompare(b[0]));
 for(const [id,r] of retained.slice(32)){closedBefore=Math.max(closedBefore,r.at);delete receipts[id];}
 const save={plays:integer(old.plays)?Math.min(old.plays,Number.MAX_SAFE_INTEGER-1):0,bestTime:finite(old.bestTime)&&old.bestTime>0&&old.bestTime<=RELAY_LIFETIME/1000?old.bestTime:null,lastRunId:safeRelayId(old.lastRunId)?old.lastRunId:null,receipts,closedBefore};
 if(Object.hasOwn(receipts,proof.runId)){
  const prior=receipts[proof.runId];if(!same(prior,proof,['elapsed','distance','firstId','otherId','handoffs','at'])||JSON.stringify(prior.participants)!==JSON.stringify(proof.participants))return null;
  return {save,receipt:cloneProof(prior),deduped:true};
 }
 if(proof.at<=closedBefore)return null;
 const newBest=save.bestTime===null||proof.elapsed<save.bestTime,bestTime=newBest?proof.elapsed:save.bestTime;
 const receipt={...proof,newBest,bestTime,saved:true};save.plays++;save.bestTime=bestTime;save.lastRunId=proof.runId;receipts[proof.runId]=receipt;
 let entries=Object.entries(receipts).sort((a,b)=>b[1].at-a[1].at||a[0].localeCompare(b[0]));
 if(entries.length>32){let keep=entries.slice(0,32);if(!keep.some(([id])=>id===proof.runId))keep[31]=[proof.runId,receipt];const ids=new Set(keep.map(([id])=>id));for(const [id,r] of entries)if(!ids.has(id))closedBefore=Math.max(closedBefore,r.at);entries=keep;}
 save.receipts=Object.fromEntries(entries);save.closedBefore=closedBefore;
 return {save,receipt:cloneProof(receipt),deduped:false};
}

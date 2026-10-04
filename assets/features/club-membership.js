/* Public club applications. Decisions create invitations; only an explicit
 * Join changes membership. Uses the existing honour-system broker, not auth. */
import {clubCode,cleanClubMeta,acceptClubMeta,CLUB_COMMONS} from '../club-state.js?v=clubhouse-2';
export const id='club-membership';
export const CLUB_CAPACITY=20,MAX_APPLICATIONS=5;
const safeId=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,64}$/.test(v)&&v!=='prototype'&&!Object.prototype.hasOwnProperty.call(Object.prototype,v);
const clean=(v,n)=>String(v??'').replace(/[\x00-\x1f\x7f]/g,' ').trim().slice(0,n);
const validCode=v=>typeof v==='string'&&clubCode(v)===v&&v!==CLUB_COMMONS&&!!v;
const active=row=>row&&['pending','accepted'].includes(row.status)&&Date.now()-(row.decidedAt||row.createdAt)<=AGE;
const copy=v=>JSON.parse(JSON.stringify(v));
const AGE=7*86400000;

export function install(G){
 const S=G.save,N=G.net,C=G.clubs,now=()=>Date.now(),me=()=>N.net.id,name=()=>clean(N.myName(),14),code=()=>C.identity().code||'';
 function ensure(s){s.clubMembership=s.clubMembership||{};for(const k of ['outgoing','incoming','contacts'])s.clubMembership[k]=s.clubMembership[k]||{};}
 S.ensure(ensure);
 const state=()=>{const s=S.fresh();ensure(s);return s.clubMembership;};
 const changed=()=>G.run('clubMembershipChanged');
 const publicRow=c=>C.clubDir?.[c];
 function foreignSave(c,meta){return {ridingClub:c,clubRecords:{[c]:{meta:cleanClubMeta(meta)}}};}
 function authorized(c,m){const meta=state().contacts[c]?.meta;return !!meta?.founder&&C.canManageName(m.n,m.id,foreignSave(c,meta));}
 function appRow(row){return {...copy(row),status:['pending','accepted'].includes(row.status)&&!active(row)?'expired':row.status,id:row.applicantId,name:row.name||row.applicantId,at:row.createdAt};}
 function applications(){const s=state(),c=code();return{incoming:C.canManage()?Object.values(s.incoming[c]||{}).filter(r=>r.status==='pending'&&now()-r.createdAt<=AGE).sort((a,b)=>a.createdAt-b.createdAt).map(appRow):[],outgoing:Object.values(s.outgoing).sort((a,b)=>b.createdAt-a.createdAt).map(appRow),capacity:CLUB_CAPACITY,maxApplications:MAX_APPLICATIONS};}
 function search(query=''){
  const s=state(),q=clean(query,64).toLowerCase(),mine=code();
  return Object.entries(C.clubDir||{}).filter(([c,r])=>validCode(c)&&r&&r.wk===C.CW()&&(!q||(String(r.n||r.name||'')+' '+c).toLowerCase().includes(q))).map(([c,r])=>{
   const contact=s.contacts[c]||{},memberCount=Math.max(0,Math.floor(Number(r.mem)||0)),out=s.outgoing[c],status=out?appRow(out).status:'none',full=memberCount>=CLUB_CAPACITY;
   return{code:c,name:clean(r.n||r.name||c,24),crest:r.crest||contact.meta?.crest||'horse',color:r.color||contact.meta?.color||'#497657',level:Number.isFinite(r.level)?r.level:null,memberCount,capacity:CLUB_CAPACITY,full,status,canApply:c!==mine&&!full&&!active(out),starPoints:Math.max(0,Number(r.v)||0)};
  }).sort((a,b)=>b.starPoints-a.starPoints||a.name.localeCompare(b.name));
 }
 function subscribe(){
  const c=code();if(c){N.subscribe('srf1/'+c+'/clubapply/#');N.subscribe('srf1/'+c+'/clubdecision/#');}
  for(const row of Object.values(state().outgoing))if(active(row)){N.subscribe('srf1/'+row.code+'/meta');N.subscribe('srf1/'+row.code+'/clubdecision/'+me());}
 }
 function publishApplication(row){
  const sent=N.publish('srf1/'+row.code+'/clubapply/'+me(),{req:row.requestId,status:row.status,rev:row.revision,at:row.updatedAt,createdAt:row.createdAt},{retain:true})===true,delivery=sent?'sent':'queued';
  if(state().outgoing[row.code]?.delivery!==delivery)S.sync(s=>{const r=s.clubMembership.outgoing[row.code];if(r?.requestId===row.requestId&&r.revision===row.revision)r.delivery=delivery;});return sent;
 }
 function apply(c){
  if(!validCode(c)||!safeId(me()))return{ok:false,reason:'Choose a valid listed club.'};
  const listing=search().find(r=>r.code===c);if(!listing)return{ok:false,reason:'That club is not currently listed.'};
  if(c===code())return{ok:false,reason:'You already belong to this club.'};if(listing.full)return{ok:false,reason:'This club is full.'};
  const old=state().outgoing[c];if(active(old))return{ok:false,reason:old.status==='accepted'?'You already have an invitation.':'Your application is already pending.'};
  if(Object.values(state().outgoing).filter(active).length>=MAX_APPLICATIONS)return{ok:false,reason:'You can have up to '+MAX_APPLICATIONS+' outstanding applications.'};
  const at=Math.max(now(),(old?.updatedAt||0)+1),row={code:c,clubName:listing.name,applicantId:me(),name:name(),requestId:me().slice(0,24)+'-'+at.toString(36)+'-'+Math.random().toString(36).slice(2,7),status:'pending',revision:1,createdAt:at,updatedAt:at};
  S.sync(s=>{ensure(s);s.clubMembership.outgoing[c]=row;const history=Object.values(s.clubMembership.outgoing).filter(r=>!active(r)).sort((a,b)=>b.createdAt-a.createdAt);for(const r of history.slice(30))delete s.clubMembership.outgoing[r.code];});subscribe();publishApplication(row);changed();return{ok:true};
 }
 function cancelApplication(c){
  const row=state().outgoing[c];if(!row||!active(row))return{ok:false,reason:'No outstanding application to cancel.'};
  const next={...row,status:'cancelled',revision:row.revision+1,updatedAt:Math.max(now(),row.updatedAt+1)};delete next.pendingDecision;
  S.sync(s=>{s.clubMembership.outgoing[c]=next;});publishApplication(next);changed();return{ok:true};
 }
 function roomIncoming(c){return state().incoming[c]||{};}
 function occupied(){const memberIds=new Set(C.memberRows().map(r=>r.id));const reserved=Object.values(roomIncoming(code())).filter(r=>['accepted','joined'].includes(r.status)&&!memberIds.has(r.applicantId)&&now()-(r.decidedAt||r.updatedAt)<=AGE).length;return memberIds.size+reserved;}
 function review(applicantId,accept){
  const c=code(),row=roomIncoming(c)[applicantId];if(!c||!C.canManage())return{ok:false,reason:'Only the club leader or an officer can review applications.'};
  if(!row||row.status!=='pending'||now()-row.createdAt>AGE)return{ok:false,reason:'This application is no longer pending.'};
  if(accept&&occupied()>=CLUB_CAPACITY)return{ok:false,reason:'This club has no available places.'};
  const decision={to:applicantId,req:row.requestId,appRevision:row.revision,status:accept?'accepted':'rejected',at:Math.max(now(),row.updatedAt)};
  S.sync(s=>{const r=s.clubMembership.incoming[c][applicantId];r.status=decision.status;r.decidedAt=decision.at;r.decidedBy=me();});
  N.publish('srf1/'+c+'/clubdecision/'+applicantId,decision,{retain:true});changed();return{ok:true};
 }
 function receiveDecision(c,m){
  const current=state().outgoing[c];if(!current||m.to!==me()||current.requestId!==m.req||current.revision!==m.appRevision||!active(current)||now()-current.createdAt>AGE)return;
  if(!authorized(c,m)){
   // A retained decision can arrive before its founder/role metadata.
   S.sync(s=>{const row=s.clubMembership.outgoing[c];if(!row.pendingDecision||row.pendingDecision.at<m.at)row.pendingDecision={id:m.id,n:clean(m.n,14),to:m.to,req:m.req,appRevision:m.appRevision,status:m.status,at:m.at};});return;
  }
  if((current.decidedAt||0)>=m.at)return;
  S.sync(s=>{const row=s.clubMembership.outgoing[c];row.status=m.status;row.decidedAt=m.at;row.decidedBy=m.id;row.decidedByName=clean(m.n,14);delete row.pendingDecision;});changed();
 }
 function join(c){
  const row=state().outgoing[c];if(!row||row.status!=='accepted'||now()-row.decidedAt>AGE)return{ok:false,reason:'An accepted application is required.'};
  if(!authorized(c,{id:row.decidedBy,n:row.decidedByName}))return{ok:false,reason:'Reconnect to verify this invitation.'};
  const listing=publicRow(c);if(listing&&Number(listing.mem)>=CLUB_CAPACITY)return{ok:false,reason:'This club is now full.'};
  if(C.joinClub(c)!==true)return{ok:false,reason:'The club could not be joined.'};
  const next={...row,status:'joined',revision:row.revision+1,updatedAt:Math.max(now(),row.updatedAt+1)};
  S.sync(s=>{s.clubMembership.outgoing[c]=next;});publishApplication(next);changed();return{ok:true};
 }
 const waitingDecisions=new Map();
 function queueDecision(c,m){const key=c+'/'+m.to,old=waitingDecisions.get(key);if(old&&old.m.at>=m.at)return;if(!old&&waitingDecisions.size>=100)return;waitingDecisions.set(key,{c,m:copy(m),until:now()+120000});}
 function replayDecisions(){
  for(const [key,entry] of waitingDecisions){const {c,m}=entry;if(entry.until<now()||c!==code()){waitingDecisions.delete(key);continue;}if(!C.canManageName(m.n,m.id))continue;
   const row=roomIncoming(c)[m.to];if(!row)continue;waitingDecisions.delete(key);if(row.status!=='pending'||row.requestId!==m.req||row.revision!==m.appRevision)continue;
   S.sync(s=>{const r=s.clubMembership.incoming[c][m.to];r.status=m.status;r.decidedAt=m.at;r.decidedBy=m.id;});changed();
  }
 }
 function readMeta(c,m){
  const s=state(),out=s.outgoing[c];if(!active(out))return;
  const current=s.contacts[c]?.meta||cleanClubMeta({founderId:s.contacts[c]?.founderId||'',founder:s.contacts[c]?.founder||''});
  const meta=acceptClubMeta(current,{name:m.nm,founder:m.f,founderId:m.fid,motto:m.mo,created:m.at,pub:m.pub,crest:m.crest,color:m.color,revision:m.rev,roles:m.roles,roleIds:m.roleIds,roleOwners:m.roleOwners,senderId:m.id,senderName:m.n});
  if(!meta)return;S.sync(v=>{v.clubMembership.contacts[c]={...(v.clubMembership.contacts[c]||{}),meta};});
  const pending=state().outgoing[c]?.pendingDecision;if(pending)receiveDecision(c,pending);changed();
 }
 G.on('message',(topic,m)=>{
  if(typeof topic!=='string'||!m||typeof m!=='object')return;const t=topic.split('/'),c=t[1],kind=t[2];if(t[0]!=='srf1')return;
  if(c==='dir'&&t.length===3&&validCode(kind)&&m.wk===C.CW()&&safeId(m.id)&&(!m.fid||m.fid===m.id)){
   // Directory data anchors the founder ID before subscribing to foreign meta.
   const prior=state().contacts[kind];if(prior?.founderId&&prior.founderId!==m.id)return;
   if(!publicRow(kind))return;S.sync(s=>{const old=s.clubMembership.contacts[kind];if(!old&&Object.keys(s.clubMembership.contacts).length>=100)return;s.clubMembership.contacts[kind]={...(old||{}),founderId:m.fid||old?.founderId||m.id,founder:clean(m.f,14),seenAt:now()};});return;
  }
  if(!validCode(c))return;
  if(kind==='meta'){readMeta(c,m);replayDecisions();return;}
  if(kind==='clubapply'){
   if(t.length!==4||c!==code()||!safeId(m.id)||m.id!==t[3]||m.id===me()||!safeId(m.req)||!['pending','cancelled','joined'].includes(m.status)||!Number.isInteger(m.rev)||m.rev<1||!Number.isFinite(m.at)||m.at>now()+60000||!Number.isFinite(m.createdAt)||m.createdAt>m.at||now()-m.createdAt>AGE)return true;
   S.sync(s=>{const incoming=s.clubMembership.incoming[c]||(s.clubMembership.incoming[c]={});for(const [pid,r] of Object.entries(incoming))if(now()-(r.decidedAt||r.updatedAt||r.createdAt)>AGE)delete incoming[pid];const old=incoming[m.id];if(old&&(old.updatedAt>m.at||(old.requestId===m.req&&old.revision>=m.rev)))return;if(!old&&Object.keys(incoming).length>=100)return;if(m.status==='joined'&&(!old||old.requestId!==m.req||!['accepted','joined'].includes(old.status)))return;
    incoming[m.id]={code:c,clubName:C.identity(s).name,applicantId:m.id,name:clean(m.n,14),requestId:m.req,status:m.status,revision:m.rev,createdAt:m.createdAt,updatedAt:m.at,...(m.status==='joined'?{decidedAt:old.decidedAt,decidedBy:old.decidedBy}:{})};});replayDecisions();changed();return true;
  }
  if(kind==='clubdecision'){
   if(t.length!==4||!safeId(m.id)||!safeId(m.to)||t[3]!==m.to||!safeId(m.req)||!['accepted','rejected'].includes(m.status)||!Number.isInteger(m.appRevision)||m.appRevision<1||!Number.isFinite(m.at)||m.at>now()+60000||now()-m.at>AGE)return true;
   if(c===code()){queueDecision(c,{id:m.id,n:clean(m.n,14),to:m.to,req:m.req,appRevision:m.appRevision,status:m.status,at:m.at});replayDecisions();}
   if(m.to===me())receiveDecision(c,m);return true;
  }
 });
 function sync(){subscribe();for(const row of Object.values(state().outgoing))if(now()-row.createdAt<=AGE)publishApplication(row);const c=code();if(c&&C.canManage())for(const r of Object.values(roomIncoming(c)))if(['accepted','rejected'].includes(r.status)&&r.decidedBy===me()&&now()-r.decidedAt<=AGE)N.publish('srf1/'+c+'/clubdecision/'+r.applicantId,{to:r.applicantId,req:r.requestId,appRevision:r.revision,status:r.status,at:r.decidedAt},{retain:true});}
 G.on('connect',sync);G.on('clubChanged',()=>{waitingDecisions.clear();sync();changed();});G.on('boot',sync);
 G.clubMembership={search,apply,cancelApplication,applications,review,join,capacity:CLUB_CAPACITY,maxApplications:MAX_APPLICATIONS};subscribe();
}

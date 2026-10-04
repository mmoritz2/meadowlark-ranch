/* Client-side club records. Roles are an honour-system protocol, not authentication. */
export const CLUB_COMMONS='meadowlark-commons';
export const CLUB_CRESTS=['horse','horseshoe','star','leaf','mountain','crown'];
export const CLUB_COLORS=['#497657','#436b99','#885da6','#b35d69','#b38438','#526475'];
export const clubCode=v=>{const code=String(v||'').toLowerCase().replace(/[^a-z0-9-]/g,'').slice(0,24);return ['constructor','prototype','clubs','dir'].includes(code)?'':code;};
const copy=v=>JSON.parse(JSON.stringify(v));
export function cleanClubMeta(m={}){
 const safeRoles=(input,max)=>{const out=Object.create(null);for(const [n,r] of Object.entries(input||{}).slice(0,100))if(r==='officer'&&!['__proto__','prototype','constructor'].includes(n))out[String(n).slice(0,max)]='officer';return out;};
 const roles=safeRoles(m.roles,14),roleIds=safeRoles(m.roleIds,64),roleOwners=Object.create(null);
 for(const [name,id] of Object.entries(m.roleOwners||{}).slice(0,100))if(!['__proto__','prototype','constructor'].includes(name)&&typeof id==='string'&&Object.hasOwn(roleIds,id))roleOwners[name.slice(0,14)]=id.slice(0,64);
 return {name:String(m.name||'').slice(0,24),motto:String(m.motto||'').slice(0,90),founder:String(m.founder||'').slice(0,14),founderId:String(m.founderId||'').slice(0,64),created:Math.max(0,+m.created||0),pub:!!m.pub,crest:CLUB_CRESTS.includes(m.crest)?m.crest:'horse',color:CLUB_COLORS.includes(m.color)?m.color:CLUB_COLORS[0],revision:Math.max(0,Math.floor(+m.revision||0)),roles,roleIds,roleOwners};
}
function blank(week){return {pendingJoin:true,meta:cleanClubMeta(),notice:{t:'',by:'',at:0},seen:0,log:[],members:{},claims:{},points:{week,pts:0},allTime:0,week:{week,total:0,ownSP:0,rewardPolicy:2,rank:0,n:1},last:null};}
export function ensureClubState(s,week,personalWeek){
 s.clubRecords=Object.assign(Object.create(null),s.clubRecords||{});
 if(s.ridingClub===undefined){
  const code=clubCode(s.pubWorld?s.clubPriv:s.club);s.ridingClub=code===CLUB_COMMONS?'':code;
  if(s.ridingClub&&!s.clubRecords[s.ridingClub]){
   const r=blank(week);r.meta=cleanClubMeta(s.clubMeta);r.pendingJoin=!r.meta.founder&&!/^mr-[a-z0-9]+$/.test(s.ridingClub);r.notice=copy(s.clubNotice||r.notice);r.seen=s.clubSeen||0;r.log=copy(s.chatLog||[]);
   if(s.clubWeek)r.week=copy(s.clubWeek);if(s.clubWeekLast)r.last=copy(s.clubWeekLast);
   if(s.sp?.week===personalWeek)r.points.pts=Math.max(0,+s.sp.pts||0);r.allTime=r.points.pts;
   s.clubRecords[s.ridingClub]=r;
  }
 }
 const code=clubCode(s.ridingClub);s.ridingClub=code===CLUB_COMMONS?'':code;
 if(s.ridingClub){const r=s.clubRecords[s.ridingClub]||(s.clubRecords[s.ridingClub]=blank(week));r.meta=cleanClubMeta(r.meta);r.members=Object.assign(Object.create(null),r.members||{});r.claims=r.claims||{};r.points=r.points||{week,pts:0};if(!Number.isFinite(r.allTime))r.allTime=Math.max(0,+r.points.pts||0);return r;}
 return null;
}
export function activateClub(s,code,week,personalWeek){
 stashClub(s);s.ridingClub=clubCode(code);if(s.ridingClub===CLUB_COMMONS)s.ridingClub='';
 const r=ensureClubState(s,week,personalWeek);loadClub(s,r,week);return r;
}
export function loadClub(s,r,week){
 s.clubMeta=copy(r?.meta||cleanClubMeta());s.clubNotice=copy(r?.notice||{t:'',by:'',at:0});s.clubSeen=r?.seen||0;s.chatLog=copy(r?.log||[]);s.clubWeek=copy(r?.week||{week,total:0,ownSP:0,rewardPolicy:2,rank:0,n:0});s.clubWeekLast=copy(r?.last||null);
}
export function stashClub(s){
 const r=s.clubRecords?.[s.ridingClub];if(!r)return;
 r.meta=cleanClubMeta(s.clubMeta||r.meta);r.notice=copy(s.clubNotice||r.notice);r.seen=s.clubSeen||0;r.log=copy(s.chatLog||[]);r.week=copy(s.clubWeek||r.week);r.last=copy(s.clubWeekLast||null);
}
export function creditClubPoints(s,n,week,personalWeek){
 const r=ensureClubState(s,week,personalWeek);if(!r||!Number.isFinite(n)||n<=0)return;
 if(r.points.week!==week)r.points={week,pts:0};r.points.pts+=n;r.allTime=Math.min(1e12,r.allTime+n);
}
export function ownClubPoints(s,week){const p=s.clubRecords?.[s.ridingClub]?.points;return p?.week===week?Math.max(0,+p.pts||0):0;}
export function acceptClubMeta(current,packet){
 const incoming=cleanClubMeta(packet);if(!incoming.founder)return null;
 if(current.founderId&&packet.senderId!==current.founderId)return null;
 if(!current.founderId&&current.founder&&packet.senderName!==current.founder)return null;
 if(!current.founder&&!incoming.founderId&&incoming.founder!==packet.senderName)return null;
 if(!current.founderId&&current.founder&&incoming.founder!==current.founder)return null;
 if(incoming.founderId&&incoming.founderId!==packet.senderId)return null;
 if(current.founder&&incoming.revision<=current.revision)return null;
 return incoming;
}

/* Leaving a club resets this week's personal club score, not earned rewards. */
export function clearCurrentClubContribution(s,week){
 const r=s.clubRecords?.[s.ridingClub];if(!r)return;
 const before=r.points?.week===week?Math.max(0,+r.points.pts||0):0;
 r.points={week,pts:0};
 if(s.clubWeek?.week===week){s.clubWeek.total=Math.max(0,(s.clubWeek.total||0)-before);s.clubWeek.ownSP=0;s.clubWeek.rewardPolicy=2;}
 stashClub(s);
}

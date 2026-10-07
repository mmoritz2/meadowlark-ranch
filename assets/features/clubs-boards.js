/* Feature package 'clubs-boards' — the clubhouse and the boards.
   Named clubs you create and join by code, a club roster built from retained presence cards, a
   pinned notice board, a scrollable chat log with a mute list, the weekly club ladder on Star
   Points (Monday 00:00 UTC), club chests with published odds, Champions chests for the top
   50 clubs with a 100-SP personal minimum, four club-only prize horses, the weekly event leaderboard with rank-band rewards, the
   monthly photo contest series with real club entries and a past-winners archive, and photo mode
   proper: six film looks, a world freeze and the free camera.

   Everything runs inside install(G); nothing at import time. Two tiny inline hooks in
   ranch3d.html belong to this package: `if(G.photoPause)dt=0;` at the top of tick(), and
   `G.cam={toggleFree,isFree}` beside tickFreeCam. See assets/features/index.js for the contract.

   The broker is public and unauthenticated: club names, notices, presence and chat are all
   honour-system. Every remote string is truncated here, the own-echo guard upstream is left
   alone, and nothing about a save is ever published. */
import {CLUB_COMMONS,CLUB_CRESTS,CLUB_COLORS,clubCode,cleanClubMeta,ensureClubState,activateClub,loadClub,stashClub,creditClubPoints,ownClubPoints,acceptClubMeta,clearCurrentClubContribution} from '../club-state.js?v=clubhouse-2';
import {CLUB_HORSE_BREEDS,CLUB_HORSE_REWARDS} from '../club-horses.js?v=club-horses-1';
export const id='clubs-boards';
const NEW_BREEDS=[
 ...CLUB_HORSE_BREEDS,
 ['larksong','Larksong Unicorn','Mythic',0,0,'#f4e9ff','#ffd6f0',
  {exclusive:'photo',prize:true,horn:true,glow:true,coat:'aurora',mark:'dapple',markCol:'#ffe6f6',body:'unicorn',src:'photo'}],
];
// Preview the same reward-horse identities without installing club or network hooks.
export function registerClubHorsePreviews(library){
 for(const row of NEW_BREEDS)library?.alias?.(row[0],row[7].body,row);
 return NEW_BREEDS.map(row=>[...row.slice(0,7),{...row[7]}]);
}

export function install(G){
 const {$,toast}=G, S=G.save, M=G.money, T=G.tables, U=G.ui, N=G.net;
 const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 /* fnv-1a, imul so it stays a 32-bit int — the same trap the boards' bhash documents. */
 function hsh(str){let h=0x811c9dc5|0;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,0x01000193);}return ((h>>>8)&0xffff)/0xffff;}
 const CHAT_MAX=120, LOG_MAX=80, LOG_SAVE=30, NOTICE_MAX=1000, NAME_MAX=24;

 /* =============================== 1. Tables =============================== */
 /* The club week is the ISO week that starts Monday 00:00 UTC, so every club in the Basin
    closes its books at the same instant wherever the riders are. The personal week
    (weekKey) is a local Jan-1 bucket and is deliberately left alone. */
 const CW=()=>G.time.isoWeekKey();
 const previousWeek=()=>new Date(Date.parse(CW()+'T00:00:00Z')-7*864e5).toISOString().slice(0,10);
 const points=v=>Number.isFinite(+v)?clamp(+v,0,1e12):0;
 function lastMemberSP(s,id,row){const last=record(s)?.last;if(last?.week===previousWeek()){if(id===N.net.id&&Number.isFinite(last.ownSP))return last.ownSP;const v=last.members?.[id];if(Number.isFinite(v))return v;}if(row?.lastWeek?.week===previousWeek())return row.lastWeek.sp;if(row?.wk===previousWeek())return points(row.sp);return null;}
 function snapshotMembers(s){return Object.fromEntries(memberRows(s).map(r=>[r.id,r.sp]));}
 function syncClub(fn){return S.sync(s=>{fn(s);stashClub(s);});}

 /* Meadowlark's existing chest thresholds are retained; the reference's full economy
    is not verified. A hard solo week reaches tier 3 and a real club can reach tier 5. */
 const CLUB_CHEST_TIERS=[{sp:0,t:1},{sp:120,t:2},{sp:300,t:3},{sp:700,t:4},{sp:1500,t:5}];
 /* Published odds, in the panel as well as here. Percentages per tier sum to 100. */
 const CLUB_CHEST_LOOT={
  1:[{p:30,r:{k:1}},{p:30,r:{gear:'Rare'}},{p:18,r:{g:2}},{p:10,r:{items:{carrot:6,apple:3}}},{p:10,r:{dust:15}},{p:2,r:{gear:'Epic'}}],
  2:[{p:30,r:{k:2}},{p:26,r:{gear:'Rare'}},{p:18,r:{g:3}},{p:12,r:{c:400}},{p:10,r:{dust:25}},{p:4,r:{gear:'Epic'}}],
  3:[{p:32,r:{k:3}},{p:26,r:{gear:'Epic'}},{p:18,r:{g:5}},{p:12,r:{c:700}},{p:8,r:{dust:40}},{p:4,r:{btok:1}}],
  4:[{p:36,r:{k:4}},{p:25,r:{gear:'Epic'}},{p:19,r:{g:6}},{p:11,r:{c:1000}},{p:6,r:{btok:1}},{p:3,r:{gear:'Legendary'}}],
  5:[{p:40,r:{k:5}},{p:25,r:{gear:'Epic'}},{p:20,r:{g:8}},{p:10,r:{c:1500}},{p:5,r:{gear:'Legendary'}}],
 };
 /* Verified club-reward screen: top 50 clubs; each recipient contributes 100 SP. */
 const CHAMPION_CHESTS=[{rank:50,n:1}], CHAMPION_MIN_SP=100, CLUB_CHEST_ROLLS=4;
 const CHAMPION_LOOT=[{p:35,r:{btok:1}},{p:25,r:{gear:'Legendary'}},{p:20,r:{g:15}},{p:15,r:{k:5}},{p:5,r:{},clubHorse:1}];
 /* The other clubs in the Basin. Their weeks are worked out from the club week and their own
    name, so they hold still for seven days instead of shuffling every time the panel opens,
    and a club of two or three really can finish first. */
 const RIVAL_CLUBS=[
  ['Hollowpeak Highriders',1.32],['Cottonwood Saddle Club',1.08],['Barleyfold Harvesters',0.92],
  ['Coyote Canyon Wranglers',1.18],['Loon Lake Larks',0.74],['Riverside Crossing Club',1.00],
  ['Home Pasture Pony Club',0.62],['Kestrel Basin Rangers',1.24],
 ];
 const RIVAL_BASE=700;
 /* Weekly event board reward bands. Star Equestrian ranks the top 1,000 riders; the Basin
    fields a valley's worth, so the bands are named by placing rather than by a round number. */
 const WEEK_RANK_REWARDS=[
  {rank:1,label:'🥇 Winner',r:{g:6,k:2,p:80}},
  {rank:3,label:'🥈 Podium',r:{g:3,k:1,p:50}},
  {rank:10,label:'🏅 Top ten',r:{c:400,p:30}},
  {rank:999,label:'🎗️ Placed',r:{c:150,p:10}},
 ];
 /* The photo contest series: one named contest a month, running on the month's first club
    week, with a prize that is not on sale anywhere. */
 const PHOTO_CONTESTS=[
  {m:0, name:'Winter Light',      theme:'snow',   sub:'Hollowpeak under a low sun'},
  {m:1, name:'Still Water',       theme:'bridge', sub:'The river from the crossing'},
  {m:2, name:'First Gallop',      theme:'gallop', sub:'Flat out across the Home Pasture'},
  {m:3, name:'Village Morning',   theme:'village',sub:'Cottonwood before the shutters open'},
  {m:4, name:'After The Rain',    theme:'rainbow',sub:'A rainbow over Kestrel Basin'},
  {m:5, name:'Long Shadows',      theme:'desert', sub:'Coyote Canyon at the golden hour'},
  {m:6, name:'Loon Lake Summer',  theme:'turtle', sub:'Anything that lives by the water'},
  {m:7, name:'Harvest Run',       theme:'gallop', sub:'The Barleyfold gallop, dust and all'},
  {m:8, name:'The Crossing',      theme:'bridge', sub:'Hooves on the bridge deck'},
  {m:9, name:'Lantern Light',     theme:'village',sub:'Cottonwood after dark'},
  {m:10,name:'Basin Wildlife',    theme:'turtle', sub:'Share the frame with the valley'},
  {m:11,name:'The Long Winter',   theme:'snow',   sub:'Snow, and a horse that does not mind'},
 ];
 /* What winning a contest is worth. Cumulative wins, claimed once each. */
 const PHOTO_PRIZES=[
  {n:1, id:'frame', label:'🖼️ Golden frame',      sub:'A gold border on your stable portraits'},
  {n:2, id:'dust',  label:'✨ 120 cosmetic dust',  sub:'Dyes and the wardrobe',          r:{dust:120}},
  {n:3, id:'horse', label:'🦄 The Larksong Unicorn',sub:'The contest exclusive — yours to keep'},
  {n:5, id:'tack',  label:'🧰 Legendary tack',     sub:'Straight to the locker',         r:{gear:'Legendary'}},
  {n:8, id:'gems',  label:'💎 20 gems + 2 keys',   sub:'For the shutterbug of the Basin',r:{g:20,k:2}},
 ];
 /* Photo mode's film looks. Applied as a composer pass, so they are in the saved PNG and not
    just on screen (a CSS filter on the canvas would not survive toDataURL). */
 const PHOTO_FILTERS=[
  {id:'none',   label:'🚫 None',      sat:1,    tint:[1,1,1],          con:1,    vig:0},
  {id:'warm',   label:'🌅 Golden',    sat:1.16, tint:[1.07,1.00,0.88], con:1.05, vig:0.10},
  {id:'sepia',  label:'📜 Almanac',   sat:0.18, tint:[1.14,0.98,0.76], con:1.06, vig:0.22},
  {id:'noir',   label:'🖤 Ink',       sat:0.00, tint:[1,1,1],          con:1.28, vig:0.30},
  {id:'dream',  label:'🌸 Meadow',    sat:1.10, tint:[1.03,0.99,1.06], con:0.92, vig:0.05},
  {id:'frost',  label:'❄️ Hollowpeak',sat:0.88, tint:[0.92,0.99,1.12], con:1.10, vig:0.16},
 ];
 /* Horses that exist only as rewards. None are for sale: breedSrc reads `exclusive`,
    so the shop, the market and the summoning stall all skip them on their own. Each maps
    onto an authored body through breedModels.alias so dressWithRig has a model to fit. */
 const CLUB_HORSE='emberfriesian', PHOTO_HORSE='larksong';
 const clubHorseKeys=new Set(CLUB_HORSE_REWARDS.map(h=>h.id));
 /* Their stat profiles are fixed, not rolled: a leaderboard horse is a known quantity. */
 const EXCLUSIVE_STATS={...Object.fromEntries(CLUB_HORSE_REWARDS.map(h=>[h.id,h.stats])),
                        larksong:{speed:7,stamina:9,jump:7,accel:8,agility:7}};

 /* =============================== 2. Save =============================== */
 S.ensure(s=>{
  s.clubMeta=s.clubMeta||{name:'',founder:'',motto:'',created:0,pub:false};
  s.clubNotice=s.clubNotice||{t:'',by:'',at:0};
  s.clubSeen=s.clubSeen||0;                                  // the notice you have already read
  s.chatLog=s.chatLog||[];
  s.muteList=s.muteList||{};
  s.clubWeek=s.clubWeek||{week:CW(),total:0,rank:0,n:1};
  if(s.clubWeekLast===undefined)s.clubWeekLast=null;
  s.clubHorseVoucher=s.clubHorseVoucher||0;
  s.photoWins=s.photoWins||0;
  s.photoHist=s.photoHist||[];
  s.photoClaims=s.photoClaims||{};
  s.photoFrame=!!s.photoFrame;
  s.stats=s.stats||{};
  const first=s.ridingClub===undefined;const record=ensureClubState(s,CW(),G.time.weekKey());
  if(first&&record&&!record.meta.founder&&typeof location!=='undefined'&&new URLSearchParams(location.search).has('club'))record.pendingJoin=true;
  loadClub(s,record,CW());
 });

 /* =============================== 3. Breeds =============================== */
 (function(){
  for(const row of NEW_BREEDS)if(!T.BREEDS3.some(b=>b[0]===row[0]))T.BREEDS3.push(row);
  try{for(const row of NEW_BREEDS){const o=row[7]||{};if(o.body&&G.horse.breedModels&&G.horse.breedModels.alias)G.horse.breedModels.alias(row[0],o.body,row);}}catch(e){}
 })();
 /* Belt and braces on top of breedSrc: never offer prizes from normal acquisition pools. */
 G.horse.sourceRule((ctx,b)=>{if(b&&b[0]&&(clubHorseKeys.has(b[0])||b[0]===PHOTO_HORSE))return false;});
 function grantExclusive(s,key,why){
  const h=G.horse.grantHorse(s,key,{stats:Object.assign({},EXCLUSIVE_STATS[key]),bond:25,src:why||'club'});
  return h;
 }

 /* =============================== 4. Club identity & the net =============================== */
 const clubMeta={}, clubMembers={}, clubBoard={}, clubDir={}, dirVersions={}, clubDepartures={}, photoData={};
 let clubCardClock=0;
 function cardTime(){clubCardClock=Math.max(Date.now(),clubCardClock+1);return clubCardClock;}
 function invalidateDeparture(code,at){clubDepartures[code]=Math.max(clubDepartures[code]||0,at);if(clubDir[code]&&(clubDir[code].at||0)<=clubDepartures[code])delete clubDir[code];}
 const clubLog=[];                                           // the chat log, newest last
 let pendingNotice=null;
 let clubDirOpen=false;                                      // the 'Find a club' drawer in 🌐 Club
 function record(s){s=s||S.fresh()||{};return s.clubRecords?.[s.ridingClub]||null;}
 function identity(s){s=s||S.fresh()||{};const r=record(s),m=cleanClubMeta(r?.meta||s.clubMeta);return {code:s.ridingClub||'',...m,pendingJoin:!!r?.pendingJoin&&!m.founder,canCreate:!m.founder&&!r?.pendingJoin};}
 function meta(s){return identity(s);}
 function clubName(s){return identity(s).name;}
 function isLeader(s){const m=identity(s);return !!m.founder&&(m.founderId?m.founderId===N.net.id:m.founder===N.myName());}
 function canManage(s){return isLeader(s)||roleOf(N.myName(),s,N.net.id)==='officer';}
 function canManageName(name,id,s){return ['founder','officer'].includes(roleOf(name,s,id));}
 const isFounder=isLeader;
 function online(){return !!(N.net.client&&N.net.client.connected);}
 function roleOf(name,s,id){
  const m=identity(s);if(m.founderId?id===m.founderId:name===m.founder)return 'founder';
  if(id&&Object.hasOwn(m.roleIds,id))return m.roleIds[id];
  // A name attached to an ID-backed appointment never grants a different ID that role.
  if(Object.hasOwn(m.roleOwners,name))return 'member';
  if(Object.entries(record(s)?.members||{}).some(([key,r])=>r.n===name&&Object.hasOwn(m.roleIds,key)))return 'member';
  return Object.hasOwn(m.roles,name)?m.roles[name]:'member';
 }
 function memberRows(s){
  s=s||S.fresh()||{};if(!identity(s).code)return [];
  const rows=new Map(),now=Date.now();
  for(const [id,r] of Object.entries(record(s)?.members||{})){
   if(r.left||id===N.net.id||r.n===N.myName())continue;
   const row={name:r.n,sp:r.wk===CW()?Math.max(0,+r.sp||0):0,lastSP:lastMemberSP(s,id,r),role:roleOf(r.n,s,id),id,online:now-r.last<150000,last:r.last||0,me:false};
   if(!rows.has(row.name)||rows.get(row.name).last<row.last)rows.set(row.name,row);
  }
  rows.set(N.myName(),{name:N.myName(),sp:spOf(s),lastSP:lastMemberSP(s,N.net.id),role:roleOf(N.myName(),s,N.net.id),id:N.net.id,online:online(),last:now,me:true});
  return [...rows.values()].sort((a,b)=>b.sp-a.sp||a.name.localeCompare(b.name));
 }
 function hydrateClub(){
  const s=S.fresh()||{};
  for(const code of Object.keys(clubDir))if(clubDir[code].wk!==CW())delete clubDir[code];
  for(const k of Object.keys(clubMeta))delete clubMeta[k];Object.assign(clubMeta,identity(s));
  for(const k of Object.keys(clubMembers))delete clubMembers[k];
  for(const r of memberRows(s))if(!r.me)clubMembers[r.name]={n:r.name,sp:r.sp,last:r.last};
  clubLog.length=0;for(const r of (s.chatLog||[]))clubLog.push({n:r.n,t:r.t,at:r.at,mine:!!r.m});
 }
 function subscribeClub(code){if(!code)return;for(const topic of ['meta','notice','members/#','photo/#'])N.subscribe('srf1/'+code+'/'+topic);}
 function publishToClub(topic,data,opts={retain:true}){const code=identity().code;return code?N.publish('srf1/'+code+'/'+topic,data,opts):false;}
 function changeClub(code){
  code=clubCode(code);if(code===CLUB_COMMONS)return false;
  const previous=identity().code;if(code===previous)return true;
  if(previous&&online()){
   const at=cardTime();invalidateDeparture(previous,at);
   // A departing client cannot safely rewrite an aggregate from its stale view of peers.
   // Invalidate the old score separately; a remaining member publishes the fresh total.
   N.publish('srf1/clubs/'+previous+'/departures/'+encodeURIComponent(N.net.id),{wk:CW(),at},{retain:true});
   N.publish('srf1/'+previous+'/members/'+encodeURIComponent(N.net.id),{n:N.myName(),left:true,last:at,wk:CW(),sp:0,allTime:record()?.allTime||0},{retain:true});
  }
  syncClub(s=>{clearCurrentClubContribution(s,CW());activateClub(s,code,CW(),G.time.weekKey());});
  // The inline boards are room-scoped and must not leak between memberships.
  for(const k of Object.keys(N.lbData||{}))delete N.lbData[k];
  for(const k of Object.keys(photoData))delete photoData[k];pendingNotice=null;hydrateClub();subscribeClub(code);
  G.run('clubChanged',code,previous);return true;
 }
 function joinClub(code){
  code=clubCode(code);if(!code||code===CLUB_COMMONS)return false;
  changeClub(code);syncClub(s=>{s.club=code;s.pubWorld=false;s.clubPriv=code;});
  if(online())N.netConnect();else toast('Club joined. Connect to ride with its members.');
  U.rerender('onlinePanel');return true;
 }
 function leaveClub(){
  const old=identity().code;if(!old)return false;changeClub('');
  syncClub(s=>{s.club='';s.clubPriv='';s.pubWorld=false;});
  if(N.net.client){try{N.net.client.end(true);}catch(e){}N.net.client=null;}
  U.rerender('onlinePanel');toast('You left the club. Your horses and rewards stay with you.');return true;
 }
 function createClub(patch={}){
  if(!String(patch.name||'').trim()){toast('Give your club a name first.');return false;}
  const code='mr-'+String(N.net.id||'rider').replace(/[^a-z0-9]/gi,'').slice(-10).toLowerCase()+'-'+Math.random().toString(36).slice(2,7);
  changeClub(code);syncClub(s=>{record(s).pendingJoin=false;s.club=code;s.pubWorld=false;s.clubPriv=code;});
  const ok=updateIdentity(patch);if(online())N.netConnect();return ok;
 }
 function updateIdentity(patch={}){
  let m=identity();if(m.founder&&!isLeader()){toast('Only the founder can edit club identity.');return false;}
  if(!m.code)return createClub(patch);
  if(m.pendingJoin){toast('Waiting for this club’s founder details. Connect to load them.');return false;}
  const next=cleanClubMeta({...m,...patch,founder:N.myName(),founderId:m.founderId||N.net.id,created:m.created||Date.now(),revision:m.revision+1,roles:m.roles,roleIds:m.roleIds,roleOwners:m.roleOwners});
  syncClub(s=>{s.clubMeta=next;record(s).pendingJoin=false;});hydrateClub();publishClubCard();U.rerender('onlinePanel');return true;
 }
 function setRole(name,role){
  name=String(name||'').slice(0,14);if(!isLeader()||!name||name===identity().founder||!['officer','member'].includes(role)||!memberRows().some(r=>r.name===name))return false;
  const id=memberRows().find(r=>r.name===name)?.id;
  if(['__proto__','prototype','constructor'].includes(name)||['__proto__','prototype','constructor'].includes(id))return false;
  syncClub(s=>{
   const m=s.clubMeta;m.roles=m.roles||{};m.roleIds=m.roleIds||{};m.roleOwners=m.roleOwners||{};
   // Clear old display-name aliases for this same rider before replacing the appointment.
   if(id)for(const [oldName,owner] of Object.entries(m.roleOwners))if(owner===id){delete m.roles[oldName];delete m.roleOwners[oldName];}
   if(role==='officer'){m.roles[name]='officer';if(id){m.roleIds[id]='officer';m.roleOwners[name]=id;}}
   else{delete m.roles[name];delete m.roleOwners[name];if(id)delete m.roleIds[id];}m.revision++;
  });
  hydrateClub();publishClubCard();U.rerender('onlinePanel');return true;
 }
 N.subscribe('srf1/clubs/#');N.subscribe('srf1/dir/#');
 function publishClubCard(){
  const s=S.fresh();if(!s||!online())return false;const m=identity(s);if(!m.code)return false;
  if(isLeader(s))publishToClub('meta',{nm:m.name,f:m.founder,fid:m.founderId,mo:m.motto,at:m.created,pub:m.pub,crest:m.crest,color:m.color,rev:m.revision,roles:m.roles,roleIds:m.roleIds,roleOwners:m.roleOwners});
  const settled=s.clubWeekLast;
  publishToClub('members/'+encodeURIComponent(N.net.id),{sp:spOf(s),wk:CW(),last:Date.now(),allTime:record(s)?.allTime||0,lastWeek:settled&&Number.isFinite(settled.ownSP)?{week:settled.week,sp:settled.ownSP}:null,h:(s.horses||[]).length});
  const level=clamp(Math.floor(G.clubActivities?.snapshot?.().level||1),1,50);
  const card={at:cardTime(),nm:m.name||m.code,sp:clubTotal(s),allTime:clubAllTime(s),lastWeek:settled?{week:settled.week,total:settled.total}:null,level,mem:memberCount(),wk:CW(),crest:m.crest,color:m.color};
  N.publish('srf1/clubs/'+m.code,card,{retain:true});
  if(isLeader(s))N.publish('srf1/dir/'+m.code,{...card,pub:m.pub,rev:m.revision,f:m.founder,fid:m.founderId},{retain:true});
  return true;
 }
 function saveNotice(text){
  if(!canManage()){toast('Only the founder or an officer can pin a notice.');return false;}
  const t=String(text||'').slice(0,NOTICE_MAX),at=Date.now(),by=N.myName();
  syncClub(s=>{s.clubNotice={t,by,at};s.clubSeen=at;});publishToClub('notice',{t,at});U.rerender('onlinePanel');return true;
 }
 function pinNotice(text){return saveNotice(text)?String(text||'').slice(0,NOTICE_MAX):false;}
 function receiveNotice(m,queue=true){
  const by=String(m.n||'Rider').slice(0,14),at=clamp(+m.at||0,0,Date.now()+30000);
  if(!canManageName(by,m.id)){
   if(queue&&(!pendingNotice||pendingNotice.at<=at))pendingNotice={id:String(m.id||'').slice(0,64),n:by,t:String(m.t||'').slice(0,NOTICE_MAX),at};
   return;
  }
  if(at<(S.fresh()?.clubNotice?.at||0))return;
  syncClub(s=>{s.clubNotice={t:String(m.t).slice(0,NOTICE_MAX),by,at};});U.rerender('onlinePanel');
 }

 G.on('starPoints',(s,n)=>{
  creditClubPoints(s,n,CW(),G.time.weekKey());
  if(identity(s).code&&s.clubWeek?.week===CW()){const rank=myClubRank(s);s.clubWeek.total=clubTotal(s);s.clubWeek.ownSP=spOf(s);s.clubWeek.rewardPolicy=2;s.clubWeek.rank=rank.rank;s.clubWeek.n=memberRows(s).length;s.clubWeek.members=snapshotMembers(s);stashClub(s);}
 });
 G.on('clubRoom',(room,previous)=>{
  // Commons is a world room; visiting it never changes club membership.
  if(room!==CLUB_COMMONS&&clubCode(room)!==identity().code)changeClub(room);
  subscribeClub(identity().code);
 });
 G.on('message',(topic,m)=>{
  const parts=topic.split('/'),club=identity().code,scope=parts[1],kind=parts[2];
  if(scope==='clubs'){
   const code=clubCode(kind);
   if(parts[3]==='departures'){
    if(!code||m.wk!==CW()||parts[4]!==encodeURIComponent(String(m.id||'')))return true;
    const at=clamp(+m.at||0,0,Date.now()+30000);if(!at)return true;
    invalidateDeparture(code,at);clubCardClock=Math.max(clubCardClock,at);return true;
   }
   if(!code||code===club||!/^\d{4}-\d{2}-\d{2}$/.test(String(m.wk||''))||m.wk>CW())return true;
   const prior=clubBoard[code],card={code,at:clamp(+m.at||0,0,Date.now()+30000),n:String(m.nm||code).slice(0,NAME_MAX),v:clamp(+m.sp||0,0,999999),mem:clamp(+m.mem||1,1,99),wk:String(m.wk),level:clamp(Math.floor(+m.level||1),1,50),crest:CLUB_CRESTS.includes(m.crest)?m.crest:'horse',color:CLUB_COLORS.includes(m.color)?m.color:CLUB_COLORS[0]};
   clubCardClock=Math.max(clubCardClock,card.at);
   card.allTime=Number.isFinite(m.allTime)?Math.max(points(m.allTime),prior?.allTime||0):prior?.allTime;
   card.lastWeek=m.lastWeek?.week===previousWeek()&&Number.isFinite(m.lastWeek.total)?{week:m.lastWeek.week,total:points(m.lastWeek.total)}:prior?.lastWeek?.week===previousWeek()?prior.lastWeek:undefined;
   if(prior?.wk===previousWeek()&&!card.lastWeek)card.lastWeek={week:prior.wk,total:prior.v};
   if(prior&&(prior.wk>card.wk||(prior.wk===card.wk&&(prior.at||0)>card.at))){if(card.wk===previousWeek()&&prior.lastWeek?.week!==previousWeek())prior.lastWeek={week:card.wk,total:card.v};if(card.allTime!==undefined)prior.allTime=card.allTime;return true;}
   clubBoard[code]=card;return true;
  }
  if(scope==='dir'){
   const code=clubCode(kind);if(!code)return true;
   const version=dirVersions[code],rev=Math.max(0,+m.rev||0);
   if((version&&rev<version.rev)||(version?.fid&&version.fid!==m.id)||(m.fid&&m.fid!==m.id))return true;
   if(m.pub===false){dirVersions[code]={rev,fid:m.fid||version?.fid||''};delete clubDir[code];return true;}
   if(m.wk!==CW()||(clubDepartures[code]&&(+m.at||0)<=clubDepartures[code]))return true;dirVersions[code]={rev,fid:m.fid||version?.fid||''};
   if(code)clubDir[code]={code,at:clamp(+m.at||0,0,Date.now()+30000),n:String(m.nm||'').slice(0,NAME_MAX),mem:clamp(+m.mem||1,1,99),v:clamp(+m.sp||0,0,999999),wk:String(m.wk||''),level:clamp(Math.floor(+m.level||1),1,50),allTime:Number.isFinite(m.allTime)?points(m.allTime):undefined};return true;
  }
  if(['meta','notice','members','photo'].includes(kind)&&(!club||scope!==club))return true;
  if(scope!==club||!club)return false;
  if(kind==='meta'){
   const current=identity(),incoming=acceptClubMeta(current,{name:m.nm,founder:m.f,founderId:m.fid,motto:m.mo,created:m.at,pub:m.pub,crest:m.crest,color:m.color,revision:m.rev,roles:m.roles,roleIds:m.roleIds,roleOwners:m.roleOwners,senderId:m.id,senderName:m.n});
   if(incoming){syncClub(s=>{s.clubMeta=incoming;record(s).pendingJoin=false;});hydrateClub();if(pendingNotice){const notice=pendingNotice;pendingNotice=null;receiveNotice(notice,false);}U.rerender('onlinePanel');}return true;
  }
  if(kind==='members'){
   const nm=String(m.n||'Rider').slice(0,14),id=String(m.id||parts[3]||nm).slice(0,64),last=clamp(+m.last||0,0,Date.now()+30000);
   if(['__proto__','prototype','constructor'].includes(id))return true;
   // Untagged legacy packets cannot contribute to a Monday-aligned week.
   if(!/^\d{4}-\d{2}-\d{2}$/.test(String(m.wk||''))||m.wk>CW())return true;
   syncClub(s=>{const r=record(s),prior=r.members[id];if(prior&&((prior.last||0)>last||(prior.wk===CW()&&m.wk!==CW())))return;const lastWeek=m.lastWeek?.week===previousWeek()&&Number.isFinite(m.lastWeek.sp)?{week:m.lastWeek.week,sp:points(m.lastWeek.sp)}:prior?.wk===previousWeek()?{week:prior.wk,sp:points(prior.sp)}:prior?.lastWeek;
    const knownAllTime=points(prior?.allTime??prior?.sp),delta=prior?(m.wk===prior.wk?Math.max(0,points(m.sp)-points(prior.sp)):m.wk>prior.wk?points(m.sp):0):points(m.sp);
    const allTime=Number.isFinite(m.allTime)?Math.max(points(m.allTime),knownAllTime):Math.min(1e12,knownAllTime+delta);clubCardClock=Math.max(clubCardClock,last);
    r.members[id]={n:nm,sp:clamp(+m.sp||0,0,999999),wk:m.wk,last,allTime,lastWeek,h:clamp(+m.h||0,0,999),left:!!m.left};if(s.clubWeek?.week===CW()){const rank=myClubRank(s);s.clubWeek.total=clubTotal(s);s.clubWeek.ownSP=spOf(s);s.clubWeek.rewardPolicy=2;s.clubWeek.rank=rank.rank;s.clubWeek.n=memberRows(s).length;s.clubWeek.members=snapshotMembers(s);}});hydrateClub();if(m.left&&m.wk===CW())publishClubCard();return true;
  }
  if(kind==='notice'&&typeof m.t==='string'){receiveNotice(m);return true;}
  if(kind==='photo'){
   const wk=parts[3]||'',nm=String(m.n||parts[4]||'Rider').slice(0,14);if(!wk)return true;
   photoData[wk]=photoData[wk]||{};photoData[wk][nm]={n:nm,v:clamp(+m.v||0,0,200),th:(typeof m.th==='string'&&m.th.slice(0,12)==='data:image/')?m.th.slice(0,24000):null};return true;
  }
  return false;
 });
 G.on('connect',()=>{subscribeClub(identity().code);setTimeout(()=>{publishClubCard();publishMyPhoto();},1800);});
 hydrateClub();subscribeClub(identity().code);

 /* =============================== 5. The weekly club ladder =============================== */
 function spOf(s){return ownClubPoints(s||S.fresh()||{},CW());}
 function memberCount(){return memberRows().length;}
 function clubTotal(s){s=s||S.fresh()||{};let total=spOf(s);for(const [id,r] of Object.entries(record(s)?.members||{}))if(id!==N.net.id&&r.n!==N.myName()&&!r.left&&r.wk===CW())total+=Math.max(0,+r.sp||0);return Math.round(total);}
 function clubAllTime(s){s=s||S.fresh()||{};let total=points(record(s)?.allTime);for(const [id,r] of Object.entries(record(s)?.members||{}))if(id!==N.net.id)total+=points(r.allTime??r.sp);return Math.round(total);}
 function rivalRows(){
  const wk=CW();
  return RIVAL_CLUBS.map(([nm,str])=>({n:nm,v:Math.round(RIVAL_BASE*str*(0.6+0.8*hsh('club'+wk+nm))),mem:2+Math.round(4*hsh('mem'+wk+nm)),rival:true}));
 }
 function clubRows(s,period='week'){
  s=s||S.fresh()||{};period=period==='all'?'all':period==='last'?'last':'week';
  const wk=CW(),prev=previousWeek(),rows=[],own=identity(s);
  for(const [code,c] of Object.entries(clubBoard)){
   if(code===own.code)continue;
   const v=period==='all'?c.allTime:period==='last'?(c.lastWeek?.week===prev?c.lastWeek.total:c.wk===prev?c.v:null):c.wk===wk&&(!clubDepartures[code]||(c.at||0)>clubDepartures[code])?c.v:null;
   if(!Number.isFinite(v))continue;rows.push({code,n:c.n||code,v,mem:c.mem,level:c.level||1,crest:c.crest,color:c.color,club:true});
  }
  if(own.code){const last=s.clubWeekLast,v=period==='all'?clubAllTime(s):period==='last'?(last?.week===prev?last.total:null):clubTotal(s);
   if(Number.isFinite(v))rows.push({code:own.code,n:clubName(s)||'Your club',v,mem:memberRows(s).length,level:clamp(Math.floor(G.clubActivities?.snapshot?.().level||1),1,50),crest:own.crest,color:own.color,me:true});}
  rows.sort((a,b)=>b.v-a.v||a.code.localeCompare(b.code));return rows;
 }
 function myClubRank(s,period='week'){const rows=clubRows(s,period);const i=rows.findIndex(r=>r.me);return {rank:i+1,of:rows.length,rows};}
 function chestTier(total){let t=1;for(const x of CLUB_CHEST_TIERS)if((total||0)>=x.sp)t=x.t;return t;}
 function nextTier(total){for(const x of CLUB_CHEST_TIERS)if((total||0)<x.sp)return x;return null;}
 function championCount(rank,ownSP=0){return Number.isInteger(rank)&&rank>=1&&rank<=50&&Number.isFinite(ownSP)&&ownSP>=CHAMPION_MIN_SP?1:0;}
 function championsForWeek(last){
  if(!last)return 0;
  // Existing unclaimed awards retain the rules under which they were earned.
  if(last.rewardPolicy!==2&&last.ownSP===undefined)return last.rank===1?2:last.rank>=2&&last.rank<=3?1:0;
  return championCount(last.rank||0,last.ownSP||0);
 }

 function msToMonday(){
  const now=new Date(), day=(now.getUTCDay()+6)%7;
  const mon=Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()-day)+7*864e5;
  return Math.max(0,mon-now.getTime());
 }
 function fmtLeft(ms){const d=Math.floor(ms/864e5),h=Math.floor(ms/36e5)%24,mi=Math.floor(ms/6e4)%60;return d?d+'d '+h+'h':h?h+'h '+mi+'m':mi+'m';}
 /* Keep the club's running total and its rank on the save so a week that closes while you
    are away still knows where you finished. */
 function touchClubWeek(){
  const s=S.fresh(); if(!s)return;
  const wk=CW(), tot=clubTotal(s), r=myClubRank(s);
  const ranks=weeklyRanks(s);
  syncClub(sv=>{
   sv.clubWeek=sv.clubWeek||{week:wk,total:0,rank:0,n:1};
   sv.wkRanks={week:G.time.weekKey(),ranks};                       // live placings, banked when the week turns
   if(sv.clubWeek.week!==wk)return;                                // the roll below owns that
   sv.clubWeek.total=tot; sv.clubWeek.ownSP=spOf(sv);sv.clubWeek.rewardPolicy=2;sv.clubWeek.rank=r.rank; sv.clubWeek.n=memberCount();sv.clubWeek.members=snapshotMembers(sv);
  });
 }
 /* Monday 00:00 UTC: the books close, last week is put aside to be claimed, a fresh one starts. */
 function clubWeekRoll(){
  const wk=CW(); let closed=null;if(!identity().code)return null;
  syncClub(sv=>{
   sv.clubWeek=sv.clubWeek||{week:wk,total:0,rank:0,n:1};
   if(sv.clubWeek.week===wk)return;
   closed=Object.assign({},sv.clubWeek);
   sv.clubWeekLast=Object.assign({},closed,{claimed:!!record(sv).claims[closed.week],champClaimed:!!record(sv).claims[closed.week]});
   sv.clubWeek={week:wk,total:0,ownSP:0,rewardPolicy:2,rank:0,n:1};
  });
  if(closed)try{toast('🏇 The club week is settled — '+(closed.total||0)+'⭐, rank #'+(closed.rank||'—')+'. Collect the chest in 🏅 → Club.');}catch(e){}
  return closed;
 }

 /* =============================== 6. Chests =============================== */
 function pick(list,rnd){
  const total=list.reduce((a,x)=>a+x.p,0);
  let r=(rnd||Math.random)()*total;
  for(const x of list){r-=x.p;if(r<=0)return x;}
  return list[list.length-1];
 }
 function rollClubChest(tier,rnd){return pick(CLUB_CHEST_LOOT[clamp(tier||1,1,5)]||CLUB_CHEST_LOOT[1],rnd);}
 function rollChampion(rnd){return pick(CHAMPION_LOOT,rnd);}
 function oddsHtml(tier){
  const rows=CLUB_CHEST_LOOT[clamp(tier||1,1,5)]||CLUB_CHEST_LOOT[1];
  return '<div class="crow" style="gap:4px;flex-wrap:wrap;margin-top:3px">'
   +rows.map(x=>'<span class="bE">'+x.p+'% '+esc(M.rewardLabel(x.r)||'—')+'</span>').join('')+'</div>';
 }
 function claimClubChest(){
  const s=S.fresh(); if(!s||!identity(s).code||!s.clubWeekLast||s.clubWeekLast.claimed||record(s)?.claims?.[s.clubWeekLast.week]){toast('Nothing to collect yet.');return false;}
  const L=s.clubWeekLast, tier=chestTier(L.total||0), lines=[];
  const won=Array.from({length:CLUB_CHEST_ROLLS},()=>rollClubChest(tier));
  let horses=0;
  syncClub(sv=>{
   if(!sv.clubWeekLast||sv.clubWeekLast.claimed||record(sv)?.claims?.[sv.clubWeekLast.week])return;
   for(const item of won){M.payReward(sv,item.r);lines.push('📦 Tier '+tier+': '+(M.rewardLabel(item.r)||'—'));}
   const champs=championsForWeek(L);
   for(let i=0;i<champs;i++){
    const c=rollChampion();
    if(c.clubHorse){sv.clubHorseVoucher=(sv.clubHorseVoucher||0)+1;horses++;lines.push('🏆 Champions chest: a CLUB HORSE token!');}
    else{M.payReward(sv,c.r);lines.push('🏆 Champions chest: '+(M.rewardLabel(c.r)||'—'));}
   }
   sv.stats=sv.stats||{};
   sv.stats.clubChests=(sv.stats.clubChests||0)+1;
   if(champs)sv.stats.clubChamp=(sv.stats.clubChamp||0)+1;
   sv.clubWeekLast.claimed=true; sv.clubWeekLast.champClaimed=true; sv.clubWeekLast.tier=tier;sv.clubWeekLast.rewards=won.map(x=>x.r);record(sv).claims[sv.clubWeekLast.week]=true;
  });
  M.refreshWallet(); try{G.horse.refreshTack();}catch(e){}
  try{G.sGem();}catch(e){}
  for(const l of lines)toast(l);
  if(horses)toast('🐴 A club horse token — choose one of four exclusive horses in Clubs → Rewards.');
  U.rerender('lbPanel'); try{G.ui.renderLB();}catch(e){}
  return true;
 }
 let claimingHorse=false;
 function claimClubHorse(key=CLUB_HORSE){
  const prize=CLUB_HORSE_REWARDS.find(h=>h.id===key);
  if(!prize){toast('Choose a horse from the club rewards collection.');return false;}
  if(claimingHorse)return false;
  const s=S.fresh(); if(!s||(s.clubHorseVoucher||0)<1){toast('You need a club horse token — earn a Champions chest with at least 100 personal SP in a top-50 club.');return false;}
  let receipt=null;claimingHorse=true;
  try{
   syncClub(sv=>{
    if(!Number.isSafeInteger(sv.clubHorseVoucher)||sv.clubHorseVoucher<1)return;
    // Grant into a draft so a failed grant cannot persist a partial horse or
    // consume a token. syncSave writes the horse and payment in one operation.
    const draft=JSON.parse(JSON.stringify(sv)),before=draft.clubHorseVoucher;
    const h=grantExclusive(draft,key,'club');
    if(!h||h.breed!==key||h.id==null||!(draft.horses||[]).includes(h)||sv.horses?.some(old=>old.id===h.id))return;
    draft.clubHorseVoucher=before-1;
    Object.assign(sv,draft);receipt={id:h.id,name:h.name,tokens:before-1};
   });
   const saved=S.fresh();
   if(!receipt||saved?.clubHorseVoucher!==receipt.tokens||!(saved.horses||[]).some(h=>h.id===receipt.id&&h.breed===key)){
    toast('Your club horse could not be saved. Please try again.');return false;
   }
  }catch(e){toast('Your club horse could not be saved. Please try again.');return false;}
  finally{claimingHorse=false;}
  try{G.horse.reloadHorses();}catch(e){}
  try{G.sNeigh();}catch(e){}
  toast('🐴 '+receipt.name+' the '+prize.name+' walks into your barn — your club prize is yours to keep.');
  try{G.ui.renderLB();}catch(e){}
  G.run('clubHorseClaimed',{id:receipt.id,breed:key});
  return true;
 }

 /* =============================== 7. Chat log & mute =============================== */
 function logPush(n,t,mine){
  if(!identity().code||(N.net.club&&N.net.club!==identity().code))return;
  clubLog.push({n:String(n||'Rider').slice(0,14),t:String(t||'').slice(0,CHAT_MAX),at:Date.now(),mine:!!mine});
  while(clubLog.length>LOG_MAX)clubLog.shift();
  syncClub(sv=>{sv.chatLog=clubLog.slice(-LOG_SAVE).map(x=>({n:x.n,t:x.t,at:x.at,m:x.mine?1:0}));});
 }
 /* Every line that reaches the HUD ticker, whoever sent it, arrives as one child of
    #chatFeed — watching that catches your own lines and remote ones alike, exactly once,
    without wrapping a single inline function. */
 (function(){
  (S.fresh()||{}).chatLog && (S.fresh().chatLog||[]).forEach(x=>clubLog.push({n:x.n,t:x.t,at:x.at,mine:!!x.m}));
  const feed=$('chatFeed'); if(!feed||typeof MutationObserver!=='function')return;
  new MutationObserver(recs=>{
   for(const r of recs)for(const nd of r.addedNodes){
    if(!nd||nd.nodeType!==1)continue;
    const txt=String(nd.textContent||''), i=txt.indexOf(': ');
    if(i<0)continue;
    const n=txt.slice(0,i), t=txt.slice(i+2);
    logPush(n,t,n===N.myName());
   }
  }).observe(feed,{childList:true});
 })();
 function isMuted(nm){const s=S.fresh();return !!(s&&s.muteList&&s.muteList[nm]);}
 G.on('chat',(m,nm2)=>{ if(isMuted(nm2))return true; });   // muted: no ticker line, no bubble, no trail or party invite
 function toggleMute(nm){
  syncClub(sv=>{sv.muteList=sv.muteList||{};if(sv.muteList[nm])delete sv.muteList[nm];else sv.muteList[nm]=1;});
  toast(isMuted(nm)?'🔇 '+nm+' muted in club chat.':'🔊 '+nm+' unmuted.');
  U.rerender('onlinePanel');
 }
 function chatLogHtml(s){
  if(!clubLog.length)return '<span style="font-size:11.5px;color:#8c7a63">Nothing said yet. Open 💬 and say hello — the last '+LOG_SAVE+' lines are kept for when you come back.</span>';
  const hh=t=>{const d=new Date(t);return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');};
  return '<div class="clubChatLog">'+clubLog.slice(-40).map(x=>'<div class="cl'+(x.mine?' mine':'')+'"><span class="ct">'+hh(x.at)+'</span> <b>'+esc(x.n)+'</b> '+esc(x.t)+'</div>').join('')+'</div>';
 }

 /* =============================== 8. Photo contests =============================== */
 const PHOTO_KEY='starRanchFable_photos_v1';
 function loadPhotos(){try{const o=JSON.parse(localStorage.getItem(PHOTO_KEY));if(o&&o.week===G.time.weekKey())return o;}catch(e){}return {week:G.time.weekKey(),shots:[],entry:null};}
 function savePhotos(o){try{localStorage.setItem(PHOTO_KEY,JSON.stringify(o));}catch(e){}}
 const THEME_LBL={turtle:'a turtle 🐢',rainbow:'a rainbow 🌈',gallop:'a full gallop 💨',bridge:'the river bridge 🌉',village:'Cottonwood Village 🏘️',snow:'the Hollowpeak snow ❄️',desert:'Coyote Canyon 🏜️'};
 /* The month's contest runs on that month's first club week; the rest of the month keeps the
    game's own rotating weekly theme. */
 function contestNow(t){
  const d=new Date(t||Date.now());
  const first=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),1));
  const wkNow=CW(), wkFirst=G.time.isoWeekKey(first.getTime());
  const c=PHOTO_CONTESTS.find(x=>x.m===d.getUTCMonth());
  return (c&&wkNow===wkFirst)?c:null;
 }
 function themeLabel(){const c=contestNow();return c?(THEME_LBL[c.theme]||c.theme):null;}
 /* The same six-part judgement the gallery already uses, plus a point for framing the shot
    through one of the film looks. */
 function scoreShot(m){
  m=m||{};
  const golden=Math.max(0,1-Math.min(Math.abs((m.day||0)-0.26),Math.abs((m.day||0)-0.74))/0.10);
  const parts=[
   ['📷 The shot',6],
   ['📸 On theme',m.theme?34:0],
   ['🦌 Wildlife',Math.min(21,(m.wild||0)*7)],
   ['🌅 Golden hour',Math.round(golden*18)],
   ['💨 Action',Math.min(14,Math.round((m.spd||0)*1.2))],
   ['🌦️ Weather',(m.wx&&m.wx!=='clear')?9:3],
   ['🎞️ Film look',(m.filter&&m.filter!=='none')?5:0],
  ];
  return {parts,total:parts.reduce((a,x)=>a+x[1],0)};
 }
 function valleyEntries(){
  const wk=G.time.weekKey();
  return T.NEIGHBOURS.map(([nm,str])=>({n:nm,v:Math.round(17+43*hsh('photo'+wk+nm)*Math.min(1.15,str))}));
 }
 function standings(){
  const ph=loadPhotos(), mine=ph.shots.find(x=>x.id===ph.entry);
  const wk=G.time.weekKey(), me=N.myName();
  const rows=valleyEntries(), seen={};
  const club=photoData[wk]||{};
  for(const nm of Object.keys(club)){if(nm===me||seen[nm])continue;seen[nm]=1;rows.push({n:nm,v:club[nm].v,th:club[nm].th,club:true});}
  rows.push({n:'You',v:mine?scoreShot(mine.m).total:0,me:true,entered:!!mine,th:mine?mine.thumb:null});
  rows.sort((a,b)=>b.v-a.v);
  return rows;
 }
 function publishMyPhoto(){
  if(!online())return false;
  const ph=loadPhotos(), mine=ph.shots.find(x=>x.id===ph.entry);
  if(!mine)return false;
  return publishToClub('photo/'+G.time.weekKey()+'/'+encodeURIComponent(N.net.id),{v:scoreShot(mine.m).total,th:String(mine.thumb||'').slice(0,24000)},{retain:true});
 }
 function enterPhoto(pid){
  const ph=loadPhotos(); if(!ph.shots.some(x=>x.id===pid))return false;
  ph.entry=pid; savePhotos(ph);
  const st=standings(), mi=st.findIndex(r=>r.me);
  syncClub(sv=>{sv.wk=sv.wk||{week:G.time.weekKey()};sv.wk.place=(mi>=0&&mi<3)?mi+1:0;});
  publishMyPhoto();
  try{G.sChime();}catch(e){}
  try{G.ui.renderLB();}catch(e){}
  return true;
 }
 /* takePhoto stores the shot straight after it reports the daily quest, so a task queued
    here lands just behind it — which is where the film look gets stamped on. */
 G.on('dailyEvt',(type)=>{ if(type!=='photo')return; setTimeout(()=>{
  try{const ph=loadPhotos(); if(!ph.shots.length)return;
   ph.shots[0].m=ph.shots[0].m||{}; ph.shots[0].m.filter=photoFilter;
   const c=contestNow(); if(c)ph.shots[0].m.contest=c.name;
   savePhotos(ph); publishMyPhoto();
  }catch(e){} },0); });
 function photoPrizeReady(s){return PHOTO_PRIZES.filter(p=>(s.photoWins||0)>=p.n&&!(s.photoClaims||{})[p.id]).length;}
 function claimPhotoPrize(pid){
  const s=S.fresh(), p=PHOTO_PRIZES.find(x=>x.id===pid);
  if(!s||!p)return false;
  if((s.photoWins||0)<p.n||(s.photoClaims||{})[p.id]){toast('Not yet — win '+p.n+' contest'+(p.n>1?'s':'')+' first.');return false;}
  let horse='';
  syncClub(sv=>{
   sv.photoClaims=sv.photoClaims||{};
   if(sv.photoClaims[p.id])return;
   sv.photoClaims[p.id]=Date.now();
   if(p.r)M.payReward(sv,p.r);
   if(p.id==='frame')sv.photoFrame=true;
   if(p.id==='horse'){const h=grantExclusive(sv,PHOTO_HORSE,'photo');horse=h.name;}
  });
  M.refreshWallet(); try{G.horse.refreshTack();}catch(e){}
  if(horse){try{G.horse.reloadHorses();G.sNeigh();}catch(e){}toast('🦄 '+horse+' the Larksong Unicorn is yours — contest exclusive.');}
  else toast('🏆 Claimed: '+p.label);
  try{G.ui.renderLB();}catch(e){}
  return true;
 }
 /* When the personal week closes, record the contest placing and count a win. The closed week
    is handed to us either by the weekRoll hook (a roll inside a session) or, far more often, by
    BOOT_INFO.wkClosed — weekRoll runs during module evaluation, long before this file installs,
    so the boot pass has to replay it. A flag keyed on the week makes that idempotent. */
 function closeWeek(closed){
  if(!closed)return false;
  let did=false;
  syncClub(sv=>{
   if(!S.flag(sv,'clubpw-'+(closed.week||'?')))return;
   did=true;
   const c=PHOTO_CONTESTS.find(x=>x.m===new Date().getUTCMonth());
   if(closed.place){
    sv.photoHist=sv.photoHist||[];
    sv.photoHist.unshift({week:closed.week||'',place:closed.place,theme:(c&&c.name)||'Weekly theme',score:closed.photos||0});
    while(sv.photoHist.length>8)sv.photoHist.pop();
    if(closed.place===1)sv.photoWins=(sv.photoWins||0)+1;
   }
   /* the weekly event board's rank snapshot travels with the closed week */
   const snap=sv.wkRanks&&sv.wkRanks.week===closed.week?sv.wkRanks:{week:closed.week||'',ranks:weeklyRanks(sv)};
   sv.wkRanksLast={week:snap.week,ranks:snap.ranks||{}};
   sv.wkRanks={week:G.time.weekKey(),ranks:{}};
  });
  if(did&&closed.place===1)try{toast('🏆📸 You won the photo contest — collect the prize in 🏅 → 📸 Photos.');}catch(e){}
  return did;
 }
 G.on('weekRoll',s=>{ setTimeout(()=>closeWeek(Object.assign({},s.wk||{})),0); });

 /* =============================== 9. The weekly event board =============================== */
 function evRows(ev,s){
  const wk=G.time.weekKey(), par=(G.course.eventPar?G.course.eventPar(ev):0)||(ev.n?ev.n*9:45);
  const rows=T.NEIGHBOURS.map(([nm,str])=>({n:nm,v:+(par*(1.42-0.40*hsh(wk+ev.id+nm))/Math.min(1.25,str)).toFixed(2)}));
  const club=(N.lbData&&N.lbData['ev_'+ev.id+((G.course&&G.course.routeRev&&G.course.routeRev(ev))||'')])||{};   // the board of this course as it is drawn now
  for(const nm of Object.keys(club)){if(nm===N.myName())continue;rows.push({n:nm,v:+club[nm]||0,club:true});}
  const mine=+((s.bestTimes||{})[ev.id]||0);
  rows.push({n:'You',v:mine,me:true});
  rows.sort((a,b)=>{const A=a.v>0?a.v:1e9,B=b.v>0?b.v:1e9;return A-B;});
  return rows;
 }
 function weeklyRanks(s){
  const out={};
  try{for(const ev of G.course.weeklyFeatured()){const rows=evRows(ev,s);const i=rows.findIndex(r=>r.me);if(i>=0&&rows[i].v>0)out[ev.id]=i+1;}}catch(e){}
  return out;
 }
 function bandFor(rank){for(const b of WEEK_RANK_REWARDS)if(rank&&rank<=b.rank)return b;return null;}
 function claimWeekRank(evId){
  const s=S.fresh(); if(!s)return false;
  const snap=s.wkRanksLast||{ranks:{}}, rank=(snap.ranks||{})[evId]||0, key='wr_'+(snap.week||'')+'_'+evId;
  const band=bandFor(rank);
  if(!band||(s.lbClaims||{})[key]){toast('Nothing to claim on that board.');return false;}
  syncClub(sv=>{sv.lbClaims=sv.lbClaims||{};if(sv.lbClaims[key])return;sv.lbClaims[key]=Date.now();M.payReward(sv,band.r);});
  M.refreshWallet(); try{G.sGem();}catch(e){}
  toast('🏅 '+band.label+' — '+(M.rewardLabel(band.r)||''));
  try{G.ui.renderLB();}catch(e){}
  return true;
 }

 /* =============================== 10. Photo mode: looks, freeze, free camera ============== */
 let photoFilter='none', photoPause=false, freeCamByUs=false, filterPass=null;
 function filterDef(id){return PHOTO_FILTERS.find(f=>f.id===id)||PHOTO_FILTERS[0];}
 function buildPass(){
  const THREE=G.THREE;
  const mat=new THREE.ShaderMaterial({
   uniforms:{tDiffuse:{value:null},uSat:{value:1},uTint:{value:new THREE.Vector3(1,1,1)},uCon:{value:1},uVig:{value:0}},
   vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}',
   fragmentShader:'uniform sampler2D tDiffuse;uniform float uSat;uniform float uCon;uniform float uVig;uniform vec3 uTint;varying vec2 vUv;'
    +'void main(){vec4 c=texture2D(tDiffuse,vUv);float l=dot(c.rgb,vec3(0.2126,0.7152,0.0722));'
    +'vec3 o=mix(vec3(l),c.rgb,uSat)*uTint;o=(o-0.5)*uCon+0.5;'
    +'float d=distance(vUv,vec2(0.5));o*=1.0-uVig*smoothstep(0.30,0.78,d);'
    +'gl_FragColor=vec4(clamp(o,0.0,1.0),c.a);}'
  });
  const sc=new THREE.Scene(), cam=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute([-1,3,0,-1,-1,0,3,-1,0],3));
  geo.setAttribute('uv',new THREE.Float32BufferAttribute([0,2,0,0,2,0],2));
  sc.add(new THREE.Mesh(geo,mat));
  return {isPass:true,enabled:false,needsSwap:true,clear:false,renderToScreen:false,mat,
   setSize(){},dispose(){try{geo.dispose();mat.dispose();}catch(e){}},
   render(renderer,writeBuffer,readBuffer){
    mat.uniforms.tDiffuse.value=readBuffer.texture;
    renderer.setRenderTarget(this.renderToScreen?null:writeBuffer);
    if(this.clear)renderer.clear();
    renderer.render(sc,cam);
   }};
 }
 function applyFilter(id){
  photoFilter=filterDef(id).id;
  const f=filterDef(photoFilter);
  try{
   if(!filterPass){
    filterPass=buildPass();
    const ps=G.composer.passes;
    ps.splice(Math.max(0,ps.length-1),0,filterPass);          // before the OutputPass, so tone mapping still runs last
   }
   filterPass.enabled=photoFilter!=='none';
   filterPass.mat.uniforms.uSat.value=f.sat;
   filterPass.mat.uniforms.uCon.value=f.con;
   filterPass.mat.uniforms.uVig.value=f.vig;
   filterPass.mat.uniforms.uTint.value.set(f.tint[0],f.tint[1],f.tint[2]);
  }catch(e){console.error('photo filter',e);}
  paintPoseBar();
 }
 function setPause(on){
  photoPause=!!on; G.photoPause=photoPause;
  paintPoseBar();
  toast(photoPause?'⏸️ World frozen — frame the shot.':'▶️ The valley is moving again.');
 }
 function paintPoseBar(){
  const bar=$('poseBar'); if(!bar)return;
  bar.querySelectorAll('[data-pf]').forEach(b=>{b.className=(b.dataset.pf===photoFilter)?'claimBtn':'';});
  const pb=$('photoPause'); if(pb){pb.textContent=photoPause?'▶️ Play':'⏸️ Freeze';pb.className=photoPause?'claimBtn':'';}
 }
 (function installPoseBar(){
  const bar=$('poseBar'); if(!bar||$('photoPause'))return;
  const anchor=$('shotTimer');
  const mk=html=>{const d=document.createElement('span');d.innerHTML=html;const n=d.firstElementChild;bar.insertBefore(n,anchor||null);return n;};
  mk('<span class="pl">Look</span>');
  for(const f of PHOTO_FILTERS)mk('<button data-pf="'+f.id+'" title="'+esc(f.label)+'">'+esc(f.label)+'</button>');
  const pause=mk('<button id="photoPause" title="Freeze the world (the camera still moves)">⏸️ Freeze</button>');
  pause.onclick=()=>setPause(!photoPause);
  bar.querySelectorAll('[data-pf]').forEach(b=>{b.onclick=()=>applyFilter(b.dataset.pf);});
  paintPoseBar();
 })();
 /* Photo mode is entered from the 📷 button, the pose bar's ✖ and Escape. Watching the body
    class catches all three without touching any of them. */
 (function watchPosing(){
  if(typeof MutationObserver!=='function')return;
  let was=document.body.classList.contains('posing');
  new MutationObserver(()=>{
   const now=document.body.classList.contains('posing');
   if(now===was)return; was=now;
   if(now){
    if(G.cam&&!G.cam.isFree()){try{G.cam.toggleFree();freeCamByUs=true;}catch(e){}}
    toast('🎬 Photo mode — WASD flies the camera, a look along the bar, ⏸️ to freeze the valley.');
   }else{
    if(photoPause)setPause(false);
    if(freeCamByUs&&G.cam&&G.cam.isFree()){try{G.cam.toggleFree();}catch(e){}}
    freeCamByUs=false;
   }
  }).observe(document.body,{attributes:true,attributeFilter:['class']});
 })();
 G.on('state',o=>{o.photo={posing:document.body.classList.contains('posing'),paused:photoPause,filter:photoFilter};
  const s=S.fresh()||{};o.club={name:clubName(s),total:(s.clubWeek&&s.clubWeek.total)||0,rank:(s.clubWeek&&s.clubWeek.rank)||0,tier:chestTier((s.clubWeek&&s.clubWeek.total)||0),notice:(s.clubNotice&&s.clubNotice.t)||'',log:clubLog.length};});

 /* =============================== 11. Styles =============================== */
 (function(){
  const st=document.createElement('style');
  st.textContent=[
   '.clubChatLog{max-height:170px;overflow-y:auto;display:flex;flex-direction:column;gap:2px;background:rgba(255,255,255,.55);border:1px solid var(--line,#e0d6c4);border-radius:10px;padding:6px 8px;margin-top:4px}',
   '.clubChatLog .cl{font-size:11.5px;color:#4a3526;line-height:1.35}',
   '.clubChatLog .cl.mine{color:#3f5f2c}',
   '.clubChatLog .ct{font-size:10px;color:#a8987c}',
   '.noticeCard{background:linear-gradient(180deg,#fff8e4,#ffeec9);border:1px solid #e8d39a;border-radius:12px;padding:8px 10px;margin-top:4px}',
   '.noticeCard .nt{font-size:13px;font-weight:700;color:#4a3526;white-space:pre-wrap}',
   '.noticeCard .nb{font-size:10.5px;color:#8c7a63;margin-top:3px}',
   '#noticeIn{width:100%;box-sizing:border-box;font-size:12px;border:1px solid var(--line-2,#d8ccb4);border-radius:9px;padding:5px 7px;height:48px;resize:vertical}',
   '.clubRow{display:flex;align-items:center;gap:6px;font-size:12px;padding:3px 7px;border-radius:8px}',
   '.clubRow.me{background:#eaf6dd;font-weight:700}',
   '.clubRow .cv{margin-left:auto;color:#6b5a42}',
   '.photoWin{display:flex;gap:6px;align-items:center;font-size:11.5px;color:#6b5a42}',
  ].join('\n');
  document.head.appendChild(st);
 })();

 /* =============================== 12. The club panel section =============================== */
 U.onlineSection(s=>{
  s=s||S.fresh()||{};
  const m=meta(s), nt=s.clubNotice||{t:'',by:'',at:0}, nm=clubName(s);
  const mem=Object.keys(clubMembers).filter(x=>x!==N.myName()).sort((a,b)=>(clubMembers[b].sp||0)-(clubMembers[a].sp||0));
  const rank=myClubRank(s);
  let h='<b style="font-size:13px;margin-top:8px">🏛️ '+(nm?esc(nm):'Your club')+'</b>';
  /* -- identity ------------------------------------------------------------------- */
  h+='<div class="crow"><span class="lbl">Club name</span><input id="clubNameIn" maxlength="'+NAME_MAX+'" value="'+esc(m.name||'')+'" placeholder="Name your club"><button data-fx="clubs:name">'+(m.name?'Rename':'Create')+'</button></div>';
  h+='<div class="crow"><span class="lbl">Motto</span><input id="clubMottoIn" maxlength="90" value="'+esc(m.motto||'')+'" placeholder="A line for the gate sign"><button data-fx="clubs:motto">Save</button></div>';
  h+='<span style="font-size:11px;color:#8c7a63">'+(m.founder?'Founded by '+esc(m.founder)+(m.created?' · '+new Date(m.created).toLocaleDateString():''):'Creating a club is free here, for everyone — no membership required.')
   +' Share the code to invite riders. The founder manages the club; officers can pin notices.</span>';
  h+='<div class="crow" style="gap:6px"><button data-fx="clubs:pub">'+(m.pub?'🌍 Listed in the club directory':'🔒 Private — not listed')+'</button><button data-fx="clubs:find">🔍 Find a club</button></div>';
  if(clubDirOpen){
   const list=Object.values(clubDir).filter(c=>c.wk===CW()&&c.code!==(N.net.club||'')).sort((a,b)=>b.v-a.v).slice(0,12);
   h+='<div class="passCard" style="margin-top:4px"><div class="ph"><b>🔍 Public clubs</b><span style="font-size:11px;color:#8c7a63">'+list.length+' listed</span></div>'
    +(list.length?list.map(c=>'<div class="clubRow">🏛️ <b>'+esc(c.n||c.code)+'</b><span style="font-size:11px;color:#8c7a63">'+c.mem+' riders · '+c.v+'⭐</span><span class="cv"><button data-fx="clubs:join:'+esc(c.code)+'">Join</button></span></div>').join('')
      :'<span style="font-size:11.5px;color:#8c7a63">Nobody has listed a club yet. Tick the directory above to list yours — it publishes the club name and its weekly total, nothing else.</span>')
    +'</div>';
  }
  /* -- notice board ---------------------------------------------------------------- */
  h+='<b style="font-size:13px;margin-top:8px">📌 Notice board</b>';
  h+=nt.t?'<div class="noticeCard"><div class="nt">'+esc(nt.t)+'</div><div class="nb">pinned by '+esc(nt.by||'a rider')+(nt.at?' · '+new Date(nt.at).toLocaleString():'')+'</div></div>'
        :'<span style="font-size:11.5px;color:#8c7a63">The board is empty. Pin the week\'s ride time, a rule, a welcome — it stays up for everyone who joins, long after the chat has scrolled away.</span>';
  if(canManage(s))h+='<textarea id="noticeIn" maxlength="'+NOTICE_MAX+'" placeholder="Pin a notice (up to '+NOTICE_MAX+' characters)"></textarea>'
   +'<div class="crow" style="gap:6px"><button data-fx="clubs:pin" class="claimBtn">📌 Pin it</button><button data-fx="clubs:unpin">Clear</button></div>';
  else h+='<span style="font-size:11px;color:#8c7a63">The founder and officers can pin here.</span>';
  /* -- roster ---------------------------------------------------------------------- */
  h+='<b style="font-size:13px;margin-top:8px">👥 Roster ('+memberCount()+')</b>';
  h+='<div class="clubRow me">🐴 <b>'+esc(N.myName())+'</b><span style="font-size:11px;color:#8c7a63">you'+(m.founder===N.myName()?' · founder':'')+'</span><span class="cv">'+spOf(s)+'⭐</span></div>';
  h+=mem.length?mem.slice(0,16).map(x=>{const r=clubMembers[x];const mu=isMuted(x);
    return '<div class="clubRow">'+(mu?'🔇':'🐴')+' <b>'+esc(x)+'</b><span style="font-size:11px;color:#8c7a63">'+Math.max(0,Math.round((Date.now()-r.last)/6e4))+'m ago</span>'
     +'<span class="cv">'+(r.sp||0)+'⭐ <button data-fx="clubs:prof:'+esc(x)+'" style="font-size:11px;padding:2px 7px">👤</button> <button data-fx="clubs:mute:'+esc(x)+'" style="font-size:11px;padding:2px 7px">'+(mu?'🔊':'🔇')+'</button></span></div>';}).join('')
   :'<span style="font-size:11.5px;color:#8c7a63">No club mates have checked in yet. Everyone who connects with your code publishes a presence card, and they show up here even when they are offline.</span>';
  /* -- the week -------------------------------------------------------------------- */
  h+='<div class="passCard" style="margin-top:6px"><div class="ph"><b>🏇 This club week</b><span style="font-size:11px;color:#8c7a63">closes in '+fmtLeft(msToMonday())+'</span></div>'
   +'<div class="crow" style="gap:5px;flex-wrap:wrap;margin-top:3px"><span class="bE me">⭐ '+clubTotal(s)+' club star points</span><span class="bE">#'+rank.rank+' of '+rank.of+'</span><span class="bE">📦 chest tier '+chestTier(clubTotal(s))+'</span></div>'
   +'<div class="sub" style="margin-top:4px">The full ladder, the chest odds and the Champions chests are in 🏅 → 🏇 Club.</div>'
   +'<button data-fx="open:lbPanel" style="margin-top:5px">🏅 Open the club board</button></div>';
  /* -- chat log --------------------------------------------------------------------- */
  h+='<b style="font-size:13px;margin-top:8px">💬 Chat log</b>'+chatLogHtml(s)
   +'<span style="font-size:11px;color:#8c7a63">The last '+LOG_SAVE+' lines are kept on this ranch so you can scroll back; nothing is stored on the broker. 🔇 mutes a rider everywhere — chat, bubbles, trail and party invites.</span>';
  return h;
 });

 U.action('clubs',(a,el)=>{
  const s=S.fresh()||{};
  if(a[0]==='name'){
   const v=String(($('clubNameIn')||{}).value||'').trim().slice(0,NAME_MAX);
   if(!v){toast('Type a club name first.');return;}
   if(!updateIdentity({name:v}))return;
   publishClubCard(); toast('🏛️ Your club is "'+v+'".'); U.rerender('onlinePanel'); try{G.ui.openOnline();G.ui.openOnline();}catch(e){}
   return;
  }
  if(a[0]==='motto'){
   const v=String(($('clubMottoIn')||{}).value||'').trim().slice(0,90);
   if(!updateIdentity({motto:v}))return;
   publishClubCard(); toast('🪧 Motto saved.'); U.rerender('onlinePanel');
   return;
  }
  if(a[0]==='pub'){if(!updateIdentity({pub:!meta(s).pub}))return;publishClubCard();U.rerender('onlinePanel');
   toast((S.fresh().clubMeta.pub)?'🌍 Listed — riders browsing the directory can find you.':'🔒 Unlisted.');return;}
  if(a[0]==='find'){clubDirOpen=!clubDirOpen;U.rerender('onlinePanel');if(clubDirOpen&&!online())toast('🌐 Connect first — the directory is read from the broker.');return;}
  if(a[0]==='join'){
   const code=String(a[1]||'').toLowerCase().replace(/[^a-z0-9-]/g,'').slice(0,24);
   if(!code)return;
   U.confirm({title:'Join club "'+code+'"?',body:'You leave your own room and ride with them. Your ranch, horses and money all stay yours.',
    onYes(){joinClub(code);}});
   return;
  }
  if(a[0]==='pin'){
   const v=String(($('noticeIn')||{}).value||'').trim();
   if(!v){toast('Write the notice first.');return;}
   if(!saveNotice(v))return; toast('📌 Pinned for the club.'); U.rerender('onlinePanel'); try{G.ui.openOnline();G.ui.openOnline();}catch(e){}
   return;
  }
  if(a[0]==='unpin'){if(!saveNotice(''))return;toast('📌 Board cleared.');U.rerender('onlinePanel');try{G.ui.openOnline();G.ui.openOnline();}catch(e){}return;}
  if(a[0]==='mute'){toggleMute(a[1]);try{G.ui.openOnline();G.ui.openOnline();}catch(e){}return;}
  if(a[0]==='prof'){try{N.openProfile(a[1]);}catch(e){}return;}
  if(a[0]==='claim'){claimClubChest();return;}
  if(a[0]==='horse'){claimClubHorse(a[1]||CLUB_HORSE);return;}
  if(a[0]==='photo'){enterPhoto(a[1]);return;}
  if(a[0]==='pprize'){claimPhotoPrize(a[1]);return;}
  if(a[0]==='wrank'){claimWeekRank(a[1]);return;}
  if(a[0]==='refresh'){touchClubWeek();publishClubCard();try{G.ui.renderLB();}catch(e){}return;}
 });

 /* =============================== 13. 🏅 Club tab =============================== */
 U.lbTab({id:'club',label:'🏇 Club',pos:1,render(s){
  if(!s)return '';
  touchClubWeek();
  const tot=clubTotal(s), r=myClubRank(s), tier=chestTier(tot), nx=nextTier(tot), L=s.clubWeekLast;
  const nm=clubName(s)||('club "'+(N.net.club||s.club||'—')+'"');
  let h='<div class="passCard"><div class="ph"><b>🏇 '+esc(nm)+'</b><span style="font-size:11px;color:#8c7a63">club week closes Monday 00:00 UTC · '+fmtLeft(msToMonday())+'</span></div>'
   +'<div class="crow" style="gap:5px;flex-wrap:wrap;margin-top:3px"><span class="bE me">⭐ '+tot+' star points</span><span class="bE">👥 '+memberCount()+' riders</span><span class="bE">#'+r.rank+' of '+r.of+'</span><span class="bE">📦 tier '+tier+'</span></div>'
   +(nx?'<div class="cbar" style="margin:6px 0 2px"><div class="cfill" style="width:'+Math.min(100,Math.round(tot/nx.sp*100))+'%;background:#c98a3c"></div></div><div class="sub">'+(nx.sp-tot)+' more club star points for a tier '+nx.t+' chest.</div>'
        :'<div class="sub" style="margin-top:5px">Tier 5 — the best chest in the game. Nothing above this.</div>')
   +'<div class="sub" style="margin-top:4px">Every member\'s Star Points add up here. Rankings finalise Monday 00:00 UTC, the same instant for every club in the Basin, and the chest lands in this tab.</div></div>';
  /* the collect card */
  if(L&&!L.claimed){
   const lt=chestTier(L.total||0), champs=championsForWeek(L);
   h+='<div class="passCard" style="margin-top:6px;background:linear-gradient(180deg,#fff6e2,#ffe9c4)"><div class="ph"><b>📦 Last club week is settled</b><span style="font-size:11px;color:#4a3526">'+(L.total||0)+'⭐ · rank #'+(L.rank||'—')+'</span></div>'
    +'<div class="sub">Tier '+lt+' club chest'+(champs?' + '+champs+' Champions chest'+(champs>1?'s':''):'')+'. The odds, in full:</div>'
    +oddsHtml(lt)
    +(champs?'<div class="sub" style="margin-top:5px"><b>🏆 Champions chest ×'+champs+'</b> — eligible club members:</div><div class="crow" style="gap:4px;flex-wrap:wrap;margin-top:3px">'
      +CHAMPION_LOOT.map(x=>'<span class="bE">'+x.p+'% '+esc(x.clubHorse?'🔥 a club horse token':(M.rewardLabel(x.r)||'—'))+'</span>').join('')+'</div>':'')
    +'<button data-fx="clubs:claim" class="claimBtn" style="margin-top:6px">Collect the chest'+(champs?'s':'')+'</button></div>';
  }else if(L&&L.claimed){
   h+='<div class="evrow">✅ <b>Last week collected</b><span>tier '+(L.tier||chestTier(L.total||0))+' · rank #'+(L.rank||'—')+' · '+(L.total||0)+'⭐</span></div>';
  }
  /* Real club standings; synthetic valley rivals stay on their separate board. */
  h+='<div class="bGroup">The Basin club ladder</div>'
   +'<div style="font-size:11px;color:#8c7a63;margin-bottom:3px">This board contains real clubs whose current weekly score cards have been received. NPC neighbours do not affect club ranks or Champions rewards.</div>';
  h+=r.rows.slice(0,12).map((row,i)=>'<div class="clubRow'+(row.me?' me':'')+'">'+(i===0?'👑':i===1?'🥈':i===2?'🥉':'#'+(i+1))+' <b>'+esc(row.n)+'</b>'
   +'<span style="font-size:11px;color:#8c7a63">'+(row.mem||1)+' rider'+((row.mem||1)===1?'':'s')+(row.club?' · club':'')+'</span><span class="cv">'+row.v+'⭐</span></div>').join('');
  if(r.rank>12)h+='<div class="clubRow me">#'+r.rank+' <b>'+esc(nm)+'</b><span class="cv">'+tot+'⭐</span></div>';
  /* per-member breakdown */
  const mem=Object.keys(clubMembers).filter(x=>x!==N.myName());
  h+='<div class="bGroup">Who put the points in</div>'
   +'<div class="clubRow me">🐴 <b>'+esc(N.myName())+'</b><span class="cv">'+spOf(s)+'⭐</span></div>'
   +(mem.length?mem.map(x=>'<div class="clubRow">🐴 <b>'+esc(x)+'</b><span class="cv">'+(clubMembers[x].sp||0)+'⭐</span></div>').join('')
     :'<span style="font-size:11.5px;color:#8c7a63">Just you this week. Share your club code from 🌐 Club — every rider who joins adds their week to this total.</span>');
  /* the chest odds for the tier in progress */
  /* (Design note: the tiers are the reference game's 20k/50k/100k rescaled to this ranch's economy.) */
  h+='<div class="bGroup">This week\'s chest — tier '+tier+'</div>'+oddsHtml(tier)
   +'<div class="sub" style="margin-top:3px">Tiers at '+CLUB_CHEST_TIERS.map(x=>x.sp+'⭐→T'+x.t).join(' · ')+'. A champion week on your own is about 550⭐, so every rider who joins moves the chest up.</div>';
  const vouchers=s.clubHorseVoucher||0;
  h+='<div class="bGroup">Club horse collection</div><div class="sub">One token, your choice of four Legendary horses. Earn at least 100 personal SP in a top-50 club to receive a Champions chest; each chest has a 5% chance of a horse token. '+vouchers+' token'+(vouchers===1?'':'s')+' available.</div>';
  for(const prize of CLUB_HORSE_REWARDS){
   const owns=(s.horses||[]).some(x=>x.breed===prize.id),st=prize.stats;
   h+='<div class="passCard" style="background:linear-gradient(180deg,#211d32,#3c304c);color:#f3e8ff">'
    +'<div class="ph"><b>'+esc(prize.name)+(owns?' — in your barn':'')+'</b><span style="font-size:11px">Legendary · '+st.speed+' speed / '+st.stamina+' stamina / '+st.jump+' jump / '+st.accel+' accel / '+st.agility+' agility</span></div>'
    +'<div class="sub" style="color:#e9d7ee">'+esc(prize.description)+' <a href="breeds.html?horse='+prize.id+'&v=club-horses-1" target="_blank" rel="noopener" style="color:#ffdc95">Meet '+esc(prize.name)+' in 3D</a>.</div>'
    +(vouchers?'<button data-fx="clubs:horse:'+prize.id+'" class="claimBtn" style="margin-top:6px">Choose '+esc(prize.name)+' · 1 token</button>':'')+'</div>';
  }
  return h;
 }});

 /* =============================== 14. 🏅 Weekly event board =============================== */
 U.lbTab({id:'weekly',label:'📅 Weekly',pos:2,render(s){
  if(!s)return '';
  let evs=[]; try{evs=G.course.weeklyFeatured()||[];}catch(e){}
  const snap=s.wkRanksLast||{week:'',ranks:{}};
  let h='<div class="passCard"><div class="ph"><b>📅 This week\'s featured events</b><span style="font-size:11px;color:#8c7a63">'+evs.length+' boards · resets Monday</span></div>'
   +'<div class="sub">Four events are featured every week and pay half as much again. These are the boards for them: your best time against the valley and against everyone riding with your club code. Where you finish when the week closes pays a rank reward.</div>'
   +'<div class="crow" style="gap:4px;flex-wrap:wrap;margin-top:5px">'+WEEK_RANK_REWARDS.map(b=>'<span class="bE">'+esc(b.label)+' → '+esc(M.rewardLabel(b.r))+'</span>').join('')+'</div></div>';
  for(const ev of evs){
   const rows=evRows(ev,s), mi=rows.findIndex(r=>r.me), mine=rows[mi]&&rows[mi].v>0;
   const medal=i=>i===0?'👑':i===1?'🥈':i===2?'🥉':'#'+(i+1);
   let list=rows.slice(0,3).map((r2,i)=>'<span class="bE'+(r2.me?' me':'')+(r2.club?' club':'')+'">'+medal(i)+' '+esc(r2.n)+' '+(r2.v>0?r2.v+'s':'—')+'</span>').join('');
   if(mi>2)list+='<span class="bE me">#'+(mi+1)+' You '+(mine?rows[mi].v+'s':'not ridden')+'</span>';
   h+='<div class="bRow"><div class="bHead"><span>'+esc(ev.name)+'</span><span class="rk">'+(mine?'#'+(mi+1)+' of '+rows.length:'unridden')+'</span></div><div class="bList">'+list+'</div></div>';
  }
  /* last week's rank rewards */
  const ids=Object.keys(snap.ranks||{});
  h+='<div class="bGroup">Last week\'s placings</div>';
  if(!ids.length)h+='<span style="font-size:11.5px;color:#8c7a63">Nothing banked yet — ride a featured event and your placing is recorded when the week turns on Monday.</span>';
  else h+=ids.map(evId=>{
   const ev=T.EVENTS3.find(e=>e.id===evId)||{name:evId};
   const rank=snap.ranks[evId], band=bandFor(rank), key='wr_'+(snap.week||'')+'_'+evId, done=!!(s.lbClaims||{})[key];
   return '<div class="evrow"><b>'+esc(ev.name)+'</b><span>finished #'+rank+'</span>'
    +(done?'<span style="font-size:11px;color:#8c7a63">✅ collected</span>'
      :band?'<button data-fx="clubs:wrank:'+esc(evId)+'" class="claimBtn">'+esc(band.label)+' · '+esc(M.rewardLabel(band.r))+'</button>'
      :'<span style="font-size:11px;color:#b8a98a">no band</span>')+'</div>';
  }).join('');
  return h;
 }});

 /* =============================== 15. 🏅 Photos tab (contest series) =============================== */
 U.lbTab({id:'photos',label:'📸 Photos',pos:3,render(s){
  if(!s)return '';
  const ph=loadPhotos(), mine=ph.shots.find(x=>x.id===ph.entry), stand=standings(), mi=stand.findIndex(r=>r.me);
  const c=contestNow(), th=themeLabel();
  const clubN=Object.keys(photoData[G.time.weekKey()]||{}).length;
  let h='<div class="passCard"><div class="ph"><b>📸 '+(c?esc(c.name):'Weekly photo competition')+'</b><span style="font-size:11px;color:#8c7a63">'+stand.length+' entries'+(clubN?' · '+clubN+' from your club':'')+'</span></div>';
  h+=c?'<div class="sub"><b>'+esc(c.sub)+'</b> — this month\'s contest. Photograph '+esc(th||c.theme)+'. Contests run on the first club week of every month; the rest of the month keeps the rotating weekly theme.</div>'
     :'<div class="sub">A rotating weekly theme between the monthly contests. Every photo you take with 📷 lands here — pick the one to enter, and it is judged on what the game can actually see.</div>';
  if(!ph.shots.length)h+='<div class="sub" style="margin:6px 0 0">No photos yet this week. Press 📷 (or P) while you are riding — 🎬 opens photo mode with the film looks.</div>';
  else{
   h+='<div class="shotRow">'+ph.shots.map(x=>'<div class="shot'+(x.id===ph.entry?' pick':'')+'" data-fx="clubs:photo:'+esc(x.id)+'"><img src="'+x.thumb+'" alt="photo"><span class="sc">'+scoreShot(x.m).total+'</span>'+(x.id===ph.entry?'<span class="ent">entered</span>':'')+'</div>').join('')+'</div>'
    +'<div class="sub" style="margin:5px 0 0">Tap a photo to enter it instead — entering publishes it to your club\'s board.</div>';
   if(mine){const sc=scoreShot(mine.m);
    h+='<div class="ph" style="margin-top:7px"><b>Your entry — '+sc.total+' points</b><span style="font-size:11px;color:#8c7a63">'+(mi>=0?'placed #'+(mi+1)+' of '+stand.length:'')+'</span></div>'
     +'<div class="bList">'+sc.parts.map(p=>'<span class="bE'+(p[1]>0?' me':'')+'">'+p[0]+' '+p[1]+'</span>').join('')+'</div>';}
  }
  h+='</div>';
  h+='<div class="bGroup">This week\'s standings</div>'
   +stand.slice(0,6).map((r,i)=>'<div class="evrow"><b>'+(i===0?'👑':i===1?'🥈':i===2?'🥉':'#'+(i+1))+' '+esc(r.n)+(r.club?' <span style="font-size:10px;color:#3f5f2c">club</span>':'')+'</b><span>'+r.v+' pts</span></div>').join('');
  if(mi>5)h+='<div class="evrow"><b>#'+(mi+1)+' You</b><span>'+stand[mi].v+' pts</span></div>';
  h+='<div class="sub" style="margin:5px 0 0">Placing in the top three pays a bonus with Monday\'s wages. Club mates\' entries are real and arrive over your club topic; the rest are the valley\'s own ranch families.</div>';
  /* prizes */
  h+='<div class="bGroup">🏆 Contest prizes — '+(s.photoWins||0)+' win'+((s.photoWins||0)===1?'':'s')+'</div>';
  h+=PHOTO_PRIZES.map(p=>{
   const got=!!(s.photoClaims||{})[p.id], ready=(s.photoWins||0)>=p.n;
   return '<div class="evrow"><b>'+esc(p.label)+'</b><span>'+esc(p.sub)+' · '+p.n+' win'+(p.n>1?'s':'')+'</span>'
    +(got?'<span style="font-size:11px;color:#8c7a63">✅</span>':ready?'<button data-fx="clubs:pprize:'+p.id+'" class="claimBtn">Claim</button>':'<span style="font-size:11px;color:#b8a98a">🔒</span>')+'</div>';
  }).join('');
  h+='<div class="sub" style="margin:4px 0 0">The Larksong Unicorn is a contest exclusive: not in the shop, not in the market, not in the stall.</div>';
  /* past winners */
  h+='<div class="bGroup">📜 Past winners</div>';
  h+=(s.photoHist&&s.photoHist.length)?s.photoHist.map(w=>'<div class="photoWin">'+(w.place===1?'👑':w.place===2?'🥈':'🥉')+' <b>#'+w.place+'</b> · '+esc(w.theme)+' · week '+esc(w.week)+'</div>').join('')
   :'<span style="font-size:11.5px;color:#8c7a63">No finished contests yet. Your placing is recorded every Monday when the week closes.</span>';
  return h;
 }});

 /* =============================== 16. Achievements =============================== */
 G.quest.addAch({id:'club1',icon:'🏛️',label:'Founding member',desc:'Name your club',social:true,v:s=>(s.clubMeta&&s.clubMeta.name)?1:0,goal:1,r:{c:150,sp:5}});
 G.quest.addAch({id:'clubnotice',icon:'📌',label:'Notice given',desc:'Pin a club notice',social:true,v:s=>(s.clubNotice&&s.clubNotice.t)?1:0,goal:1,r:{c:120}});
 G.quest.addAch({id:'clubchest5',icon:'📦',label:'Club treasurer',desc:'Collect five club chests',social:true,v:s=>(s.stats&&s.stats.clubChests)||0,goal:5,r:{g:5,k:1}});
 G.quest.addAch({id:'clubchamp',icon:'🏆',label:'Champions',desc:'Earn a Champions chest for a top-50 club week',social:true,v:s=>(s.stats&&s.stats.clubChamp)||0,goal:1,r:{g:10,k:2}});
 G.quest.addAch({id:'clubhorse',icon:'🔥',label:'Ember rider',desc:'Ride the club-exclusive Ember Friesian',social:true,v:s=>(s.horses||[]).some(h=>h.breed===CLUB_HORSE)?1:0,goal:1,r:{g:5}});
 G.quest.addAch({id:'photo1st',icon:'🖼️',label:'Shutterbug champion',desc:'Win the weekly photo competition',v:s=>s.photoWins||0,goal:1,r:{g:3}});

 /* =============================== 17. Boot & upkeep =============================== */
 G.on('boot',(bs,BOOT)=>{
  clubWeekRoll();
  try{closeWeek((BOOT&&BOOT.wkClosed)||null);}catch(e){}
  touchClubWeek();
  const s=S.fresh()||{};
  const nt=s.clubNotice||{};
  if(nt.t&&nt.at&&nt.at>(s.clubSeen||0)){
   setTimeout(()=>{try{toast('📌 '+(clubName(s)||'Club')+' notice from '+(nt.by||'a rider')+': '+String(nt.t).slice(0,60));}catch(e){}},4200);
   syncClub(sv=>{sv.clubSeen=nt.at;});
  }
  if(s.clubWeekLast&&!s.clubWeekLast.claimed)setTimeout(()=>{try{toast('📦 A club chest is waiting in 🏅 → 🏇 Club.');}catch(e){}},6200);
 });
 let pubT=0;
 G.on('interval30',(s,now)=>{
  if(identity(s).code){
   if(s.clubWeek.week!==CW()){s.clubWeekLast={...s.clubWeek,claimed:!!record(s).claims[s.clubWeek.week],champClaimed:!!record(s).claims[s.clubWeek.week]};s.clubWeek={week:CW(),total:0,ownSP:0,rewardPolicy:2,rank:0,n:1};}
   const rank=myClubRank(s);s.clubWeek.total=clubTotal(s);s.clubWeek.ownSP=spOf(s);s.clubWeek.rewardPolicy=2;s.clubWeek.rank=rank.rank;s.clubWeek.n=memberRows(s).length;s.clubWeek.members=snapshotMembers(s);stashClub(s);
  }
  hydrateClub();
  if(online()&&now-pubT>120000){pubT=now;publishClubCard();}
 });

 /* =============================== 18. QA surface =============================== */
 G.clubs={npcClubRows:rivalRows,championsForWeek,CLUB_CHEST_ROLLS,CHAMPION_MIN_SP,identity,createClub,memberRows,isLeader,canManage,canManageName,updateIdentity,setRole,joinClub,leaveClub,spOf,saveNotice,CLUB_CRESTS,CLUB_COLORS,CW,clubTotal,clubAllTime,clubRows,myClubRank,chestTier,nextTier,championCount,rollClubChest,rollChampion,
  claimClubChest,claimClubHorse,clubWeekRoll,touchClubWeek,pinNotice,publishClubCard,publishMyPhoto,
  clubMeta,clubMembers,clubBoard,clubDir,photoData,clubLog,isMuted,toggleMute,memberCount,msToMonday,
  scoreShot,standings,enterPhoto,contestNow,claimPhotoPrize,loadPhotos,savePhotos,evRows,weeklyRanks,bandFor,claimWeekRank,
  applyFilter,setPause,filters:PHOTO_FILTERS,filter:()=>photoFilter,paused:()=>photoPause,
  CLUB_CHEST_TIERS,CLUB_CHEST_LOOT,CHAMPION_LOOT,CHAMPION_CHESTS,RIVAL_CLUBS,PHOTO_CONTESTS,PHOTO_PRIZES,WEEK_RANK_REWARDS,
  CLUB_HORSE,CLUB_HORSE_BREEDS,CLUB_HORSE_REWARDS,PHOTO_HORSE};
}

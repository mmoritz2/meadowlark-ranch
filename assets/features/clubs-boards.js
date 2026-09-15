/* Feature package 'clubs-boards' — the clubhouse and the boards.
   Named clubs you create and join by code, a club roster built from retained presence cards, a
   pinned notice board, a scrollable chat log with a mute list, the weekly club ladder on Star
   Points (Monday 00:00 UTC), club chests with published odds, Champions chests for the top
   three, the club-only Ember Friesian, the weekly event leaderboard with rank-band rewards, the
   monthly photo contest series with real club entries and a past-winners archive, and photo mode
   proper: six film looks, a world freeze and the free camera.

   Everything runs inside install(G); nothing at import time. Two tiny inline hooks in
   ranch3d.html belong to this package: `if(G.photoPause)dt=0;` at the top of tick(), and
   `G.cam={toggleFree,isFree}` beside tickFreeCam. See assets/features/index.js for the contract.

   The broker is public and unauthenticated: club names, notices, presence and chat are all
   honour-system. Every remote string is truncated here, the own-echo guard upstream is left
   alone, and nothing about a save is ever published. */
export const id='clubs-boards';
export function install(G){
 const {$,toast}=G, S=G.save, M=G.money, T=G.tables, U=G.ui, N=G.net;
 const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 /* fnv-1a, imul so it stays a 32-bit int — the same trap the boards' bhash documents. */
 function hsh(str){let h=0x811c9dc5|0;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,0x01000193);}return ((h>>>8)&0xffff)/0xffff;}
 const CHAT_MAX=120, LOG_MAX=80, LOG_SAVE=30, NOTICE_MAX=200, NAME_MAX=24;

 /* =============================== 1. Tables =============================== */
 /* The club week is the ISO week that starts Monday 00:00 UTC, so every club in the Basin
    closes its books at the same instant wherever the riders are. The personal week
    (weekKey) is a local Jan-1 bucket and is deliberately left alone. */
 const CW=()=>G.time.isoWeekKey();

 /* Star Point thresholds for the club chest. Star Equestrian puts tier 3 at 20,000, tier 4
    at 50,000 and tier 5 at 100,000 — numbers from an economy roughly sixty times this one,
    where a solo champion week here is 550 SP (WAGE_TIERS). Divided through by ~66 so the
    ladder means the same thing: a hard solo week reaches tier 3, a real club reaches 5. */
 const CLUB_CHEST_TIERS=[{sp:0,t:1},{sp:120,t:2},{sp:300,t:3},{sp:700,t:4},{sp:1500,t:5}];
 /* Published odds, in the panel as well as here. Percentages per tier sum to 100. */
 const CLUB_CHEST_LOOT={
  1:[{p:30,r:{k:1}},{p:30,r:{gear:'Rare'}},{p:18,r:{g:2}},{p:10,r:{items:{carrot:6,apple:3}}},{p:10,r:{dust:15}},{p:2,r:{gear:'Epic'}}],
  2:[{p:30,r:{k:2}},{p:26,r:{gear:'Rare'}},{p:18,r:{g:3}},{p:12,r:{c:400}},{p:10,r:{dust:25}},{p:4,r:{gear:'Epic'}}],
  3:[{p:32,r:{k:3}},{p:26,r:{gear:'Epic'}},{p:18,r:{g:5}},{p:12,r:{c:700}},{p:8,r:{dust:40}},{p:4,r:{btok:1}}],
  4:[{p:36,r:{k:4}},{p:25,r:{gear:'Epic'}},{p:19,r:{g:6}},{p:11,r:{c:1000}},{p:6,r:{btok:1}},{p:3,r:{gear:'Legendary'}}],
  5:[{p:40,r:{k:5}},{p:25,r:{gear:'Epic'}},{p:20,r:{g:8}},{p:10,r:{c:1500}},{p:5,r:{gear:'Legendary'}}],
 };
 /* The top club takes two Champions chests, the rest of the top three take one. */
 const CHAMPION_CHESTS=[{rank:1,n:2},{rank:3,n:1}];
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
 /* Two horses that exist only as rewards. Neither is for sale: breedSrc reads `exclusive`,
    so the shop, the market and the summoning stall all skip them on their own. Each maps
    onto an authored body through breedModels.alias so dressWithRig has a model to fit. */
 const CLUB_HORSE='emberfriesian', PHOTO_HORSE='larksong';
 const NEW_BREEDS=[
  ['emberfriesian','Ember Friesian','Legendary',0,0,'#1a1412','#ff7a2a',
   {exclusive:'club',club:true,coat:'fire',glow:true,size:1.08,mark:'sooty',markCol:'#ff9a3a',body:'black',src:'club'}],
  ['larksong','Larksong Unicorn','Mythic',0,0,'#f4e9ff','#ffd6f0',
   {exclusive:'photo',prize:true,horn:true,glow:true,coat:'aurora',mark:'dapple',markCol:'#ffe6f6',body:'unicorn',src:'photo'}],
 ];
 /* Their stat profiles are fixed, not rolled: a leaderboard horse is a known quantity. */
 const EXCLUSIVE_STATS={emberfriesian:{speed:9,stamina:8,jump:6,accel:9,agility:5},
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
 });

 /* =============================== 3. Breeds =============================== */
 (function(){
  for(const row of NEW_BREEDS)if(!T.BREEDS3.some(b=>b[0]===row[0]))T.BREEDS3.push(row);
  try{for(const row of NEW_BREEDS){const o=row[7]||{};if(o.body&&G.horse.breedModels&&G.horse.breedModels.alias)G.horse.breedModels.alias(row[0],o.body);}}catch(e){}
 })();
 /* Belt and braces on top of breedSrc: never offer these two from any source. */
 G.horse.sourceRule((ctx,b)=>{if(b&&b[0]&&(b[0]===CLUB_HORSE||b[0]===PHOTO_HORSE))return false;});
 function grantExclusive(s,key,why){
  const h=G.horse.grantHorse(s,key,{stats:Object.assign({},EXCLUSIVE_STATS[key]),bond:25,src:why||'club'});
  return h;
 }

 /* =============================== 4. Club identity & the net =============================== */
 const clubMeta={}, clubMembers={}, clubBoard={}, clubDir={}, photoData={};
 const clubLog=[];                                           // the chat log, newest last
 let clubDirOpen=false;                                      // the 'Find a club' drawer in 🌐 Club
 function meta(s){return (s&&s.clubMeta)||{name:'',founder:'',motto:'',created:0,pub:false};}
 function clubName(s){const m=meta(s);return m.name||clubMeta.name||'';}
 function isFounder(s){const m=meta(s);return !m.founder||m.founder===N.myName();}
 function online(){return !!(N.net.client&&N.net.client.connected);}

 N.subscribe('meta');
 N.subscribe('notice');
 N.subscribe('srf1/{club}/members/#');
 N.subscribe('srf1/{club}/photo/#');
 N.subscribe('srf1/clubs/#');
 N.subscribe('srf1/dir/#');

 function publishClubCard(){
  const s=S.fresh(); if(!s||!online())return false;
  const m=meta(s);
  N.publish('meta',{nm:String(m.name||'').slice(0,NAME_MAX),f:String(m.founder||'').slice(0,14),mo:String(m.motto||'').slice(0,90),at:m.created||Date.now()},{retain:true});
  N.publish('srf1/{club}/members/'+N.myName(),{sp:spOf(s),last:Date.now(),h:(s.horses||[]).length},{retain:true});
  const tot=clubTotal(s), n=memberCount();
  N.publish('srf1/clubs/'+(N.net.club||''),{nm:String(m.name||N.net.club||'').slice(0,NAME_MAX),sp:tot,mem:n,wk:CW()},{retain:true});
  if(m.pub)N.publish('srf1/dir/'+(N.net.club||''),{nm:String(m.name||'').slice(0,NAME_MAX),mem:n,sp:tot,wk:CW()},{retain:true});
  return true;
 }
 function pinNotice(text){
  const t=String(text||'').slice(0,NOTICE_MAX), at=Date.now(), by=N.myName();
  S.sync(sv=>{sv.clubNotice={t,by,at};sv.clubSeen=at;});
  N.publish('notice',{t,at},{retain:true});
  return t;
 }
 G.on('message',(topic,m)=>{
  const club=N.net.club||'';
  if(topic.endsWith('/meta')&&topic.indexOf('/'+club+'/')>=0){
   clubMeta.name=String(m.nm||'').slice(0,NAME_MAX); clubMeta.founder=String(m.f||'').slice(0,14);
   clubMeta.motto=String(m.mo||'').slice(0,90); clubMeta.created=+m.at||Date.now();
   S.sync(sv=>{sv.clubMeta=sv.clubMeta||{};
    if(clubMeta.name&&!sv.clubMeta.name)sv.clubMeta.name=clubMeta.name;
    if(clubMeta.founder&&!sv.clubMeta.founder)sv.clubMeta.founder=clubMeta.founder;
    if(clubMeta.motto&&!sv.clubMeta.motto)sv.clubMeta.motto=clubMeta.motto;});
   return true;
  }
  if(topic.indexOf('/members/')>=0){
   const nm=String(m.n||topic.split('/').pop()||'Rider').slice(0,14);
   clubMembers[nm]={n:nm,sp:clamp(+m.sp||0,0,999999),last:+m.last||Date.now(),h:clamp(+m.h||0,0,999)};
   return true;
  }
  if(topic.endsWith('/notice')&&typeof m.t==='string'){
   const t=String(m.t).slice(0,NOTICE_MAX), by=String(m.n||'Rider').slice(0,14), at=+m.at||Date.now();
   S.sync(sv=>{sv.clubNotice={t,by,at};});
   if(t)toast('📌 Club notice from '+by+': '+t.slice(0,60));
   try{U.rerender('onlinePanel');}catch(e){}
   return true;
  }
  if(topic.startsWith('srf1/clubs/')){
   const code=topic.split('/')[2]||'';
   if(code&&code!==club)clubBoard[code]={code,n:String(m.nm||code).slice(0,NAME_MAX),v:clamp(+m.sp||0,0,999999),mem:clamp(+m.mem||1,1,99),wk:String(m.wk||'').slice(0,10)};
   return true;
  }
  if(topic.startsWith('srf1/dir/')){
   const code=topic.split('/')[2]||'';
   if(code)clubDir[code]={code,n:String(m.nm||'').slice(0,NAME_MAX),mem:clamp(+m.mem||1,1,99),v:clamp(+m.sp||0,0,999999),wk:String(m.wk||'').slice(0,10)};
   return true;
  }
  if(topic.indexOf('/photo/')>=0){
   const tp=topic.split('/'), wk=tp[3]||'', nm=String(m.n||tp[4]||'Rider').slice(0,14);
   if(!wk)return true;
   photoData[wk]=photoData[wk]||{};
   photoData[wk][nm]={n:nm,v:clamp(+m.v||0,0,200),th:(typeof m.th==='string'&&m.th.slice(0,12)==='data:image/')?m.th.slice(0,24000):null};
   return true;
  }
  return false;
 });
 G.on('connect',()=>{setTimeout(()=>{publishClubCard();publishMyPhoto();},1800);});

 /* =============================== 5. The weekly club ladder =============================== */
 function spOf(s){return (s&&s.sp&&s.sp.week===G.time.weekKey())?(s.sp.pts||0):0;}
 function memberCount(){return 1+Object.keys(clubMembers).filter(n=>n!==N.myName()).length;}
 /* The club's week: your Star Points plus every club mate's, read off the retained sp board
    the game already publishes (and the presence cards, whichever is fresher). */
 function clubTotal(s){
  s=s||S.fresh()||{};
  let tot=spOf(s);
  const me=N.myName(), board=(N.lbData&&N.lbData.sp)||{}, seen={};
  for(const nm of Object.keys(board)){if(nm===me)continue;seen[nm]=Math.max(seen[nm]||0,+board[nm]||0);}
  for(const nm of Object.keys(clubMembers)){if(nm===me)continue;seen[nm]=Math.max(seen[nm]||0,clubMembers[nm].sp||0);}
  for(const nm of Object.keys(seen))tot+=seen[nm];
  return Math.round(tot);
 }
 function rivalRows(){
  const wk=CW();
  return RIVAL_CLUBS.map(([nm,str])=>({n:nm,v:Math.round(RIVAL_BASE*str*(0.6+0.8*hsh('club'+wk+nm))),mem:2+Math.round(4*hsh('mem'+wk+nm)),rival:true}));
 }
 function clubRows(s){
  s=s||S.fresh()||{};
  const wk=CW(), rows=rivalRows();
  for(const code of Object.keys(clubBoard)){const c=clubBoard[code];if(c.wk&&c.wk!==wk)continue;rows.push({n:c.n||code,v:c.v,mem:c.mem,club:true});}
  rows.push({n:clubName(s)||('Your club'),v:clubTotal(s),mem:memberCount(),me:true});
  rows.sort((a,b)=>b.v-a.v);
  return rows;
 }
 function myClubRank(s){const rows=clubRows(s);const i=rows.findIndex(r=>r.me);return {rank:i+1,of:rows.length,rows};}
 function chestTier(total){let t=1;for(const x of CLUB_CHEST_TIERS)if((total||0)>=x.sp)t=x.t;return t;}
 function nextTier(total){for(const x of CLUB_CHEST_TIERS)if((total||0)<x.sp)return x;return null;}
 function championCount(rank){let n=0;for(const c of CHAMPION_CHESTS)if(rank&&rank<=c.rank)n=Math.max(n,c.n);return n;}
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
  S.sync(sv=>{
   sv.clubWeek=sv.clubWeek||{week:wk,total:0,rank:0,n:1};
   sv.wkRanks={week:G.time.weekKey(),ranks};                       // live placings, banked when the week turns
   if(sv.clubWeek.week!==wk)return;                                // the roll below owns that
   sv.clubWeek.total=tot; sv.clubWeek.rank=r.rank; sv.clubWeek.n=memberCount();
  });
 }
 /* Monday 00:00 UTC: the books close, last week is put aside to be claimed, a fresh one starts. */
 function clubWeekRoll(){
  const wk=CW(); let closed=null;
  S.sync(sv=>{
   sv.clubWeek=sv.clubWeek||{week:wk,total:0,rank:0,n:1};
   if(sv.clubWeek.week===wk)return;
   closed=Object.assign({},sv.clubWeek);
   sv.clubWeekLast=Object.assign({},closed,{claimed:false,champClaimed:false});
   sv.clubWeek={week:wk,total:0,rank:0,n:1};
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
  const s=S.fresh(); if(!s||!s.clubWeekLast||s.clubWeekLast.claimed){toast('Nothing to collect yet.');return false;}
  const L=s.clubWeekLast, tier=chestTier(L.total||0), lines=[];
  const won=rollClubChest(tier);
  let horses=0;
  S.sync(sv=>{
   if(!sv.clubWeekLast||sv.clubWeekLast.claimed)return;
   M.payReward(sv,won.r); lines.push('📦 Tier '+tier+': '+(M.rewardLabel(won.r)||'—'));
   const champs=championCount(L.rank||0);
   for(let i=0;i<champs;i++){
    const c=rollChampion();
    if(c.clubHorse){sv.clubHorseVoucher=(sv.clubHorseVoucher||0)+1;horses++;lines.push('🏆 Champions chest: a CLUB HORSE token!');}
    else{M.payReward(sv,c.r);lines.push('🏆 Champions chest: '+(M.rewardLabel(c.r)||'—'));}
   }
   sv.stats=sv.stats||{};
   sv.stats.clubChests=(sv.stats.clubChests||0)+1;
   if(champs)sv.stats.clubChamp=(sv.stats.clubChamp||0)+1;
   sv.clubWeekLast.claimed=true; sv.clubWeekLast.champClaimed=true; sv.clubWeekLast.tier=tier;
  });
  M.refreshWallet(); try{G.horse.refreshTack();}catch(e){}
  try{G.sGem();}catch(e){}
  for(const l of lines)toast(l);
  if(horses)toast('🐴 A club horse token — claim the Ember Friesian in 🏅 → Club.');
  U.rerender('lbPanel'); try{G.ui.renderLB();}catch(e){}
  return true;
 }
 function claimClubHorse(){
  const s=S.fresh(); if(!s||(s.clubHorseVoucher||0)<1){toast('You need a club horse token — finish in the top three.');return false;}
  let name='';
  S.sync(sv=>{
   if((sv.clubHorseVoucher||0)<1)return;
   sv.clubHorseVoucher--;
   const h=grantExclusive(sv,CLUB_HORSE,'club'); name=h.name;
  });
  if(!name)return false;
  try{G.horse.reloadHorses();}catch(e){}
  try{G.sNeigh();}catch(e){}
  toast('🔥 '+name+' the Ember Friesian walks into your barn — club champions only.');
  try{G.ui.renderLB();}catch(e){}
  return true;
 }

 /* =============================== 7. Chat log & mute =============================== */
 function logPush(n,t,mine){
  clubLog.push({n:String(n||'Rider').slice(0,14),t:String(t||'').slice(0,CHAT_MAX),at:Date.now(),mine:!!mine});
  while(clubLog.length>LOG_MAX)clubLog.shift();
  S.sync(sv=>{sv.chatLog=clubLog.slice(-LOG_SAVE).map(x=>({n:x.n,t:x.t,at:x.at,m:x.mine?1:0}));});
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
  S.sync(sv=>{sv.muteList=sv.muteList||{};if(sv.muteList[nm])delete sv.muteList[nm];else sv.muteList[nm]=1;});
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
  return N.publish('srf1/{club}/photo/'+G.time.weekKey()+'/'+N.myName(),{v:scoreShot(mine.m).total,th:String(mine.thumb||'').slice(0,24000)},{retain:true});
 }
 function enterPhoto(pid){
  const ph=loadPhotos(); if(!ph.shots.some(x=>x.id===pid))return false;
  ph.entry=pid; savePhotos(ph);
  const st=standings(), mi=st.findIndex(r=>r.me);
  S.sync(sv=>{sv.wk=sv.wk||{week:G.time.weekKey()};sv.wk.place=(mi>=0&&mi<3)?mi+1:0;});
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
  S.sync(sv=>{
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
  S.sync(sv=>{
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
  const club=(N.lbData&&N.lbData['ev_'+ev.id])||{};
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
  S.sync(sv=>{sv.lbClaims=sv.lbClaims||{};if(sv.lbClaims[key])return;sv.lbClaims[key]=Date.now();M.payReward(sv,band.r);});
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
   +' Your club code above is still the password: anyone who has it can ride in, read the chat and pin a notice.</span>';
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
  if(isFounder(s))h+='<textarea id="noticeIn" maxlength="'+NOTICE_MAX+'" placeholder="Pin a notice (up to '+NOTICE_MAX+' characters)"></textarea>'
   +'<div class="crow" style="gap:6px"><button data-fx="clubs:pin" class="claimBtn">📌 Pin it</button><button data-fx="clubs:unpin">Clear</button></div>';
  else h+='<span style="font-size:11px;color:#8c7a63">Only '+esc(m.founder)+' can pin here.</span>';
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
   if(!isFounder(s)){toast('Only '+meta(s).founder+' can rename this club.');return;}
   S.sync(sv=>{sv.clubMeta=sv.clubMeta||{};sv.clubMeta.name=v;if(!sv.clubMeta.founder)sv.clubMeta.founder=N.myName();if(!sv.clubMeta.created)sv.clubMeta.created=Date.now();});
   publishClubCard(); toast('🏛️ Your club is "'+v+'".'); U.rerender('onlinePanel'); try{G.ui.openOnline();G.ui.openOnline();}catch(e){}
   return;
  }
  if(a[0]==='motto'){
   const v=String(($('clubMottoIn')||{}).value||'').trim().slice(0,90);
   S.sync(sv=>{sv.clubMeta=sv.clubMeta||{};sv.clubMeta.motto=v;});
   publishClubCard(); toast('🪧 Motto saved.'); U.rerender('onlinePanel');
   return;
  }
  if(a[0]==='pub'){S.sync(sv=>{sv.clubMeta=sv.clubMeta||{};sv.clubMeta.pub=!sv.clubMeta.pub;});publishClubCard();U.rerender('onlinePanel');
   toast((S.fresh().clubMeta.pub)?'🌍 Listed — riders browsing the directory can find you.':'🔒 Unlisted.');return;}
  if(a[0]==='find'){clubDirOpen=!clubDirOpen;U.rerender('onlinePanel');if(clubDirOpen&&!online())toast('🌐 Connect first — the directory is read from the broker.');return;}
  if(a[0]==='join'){
   const code=String(a[1]||'').toLowerCase().replace(/[^a-z0-9-]/g,'').slice(0,24);
   if(!code)return;
   U.confirm({title:'Join club "'+code+'"?',body:'You leave your own room and ride with them. Your ranch, horses and money all stay yours.',
    onYes(){S.sync(sv=>{sv.club=code;sv.clubMeta={name:'',founder:'',motto:'',created:0,pub:false};});
     for(const k of Object.keys(clubMembers))delete clubMembers[k];
     toast('🎟️ Joining "'+code+'" — press 🟢 Connect.'); U.rerender('onlinePanel');}});
   return;
  }
  if(a[0]==='pin'){
   const v=String(($('noticeIn')||{}).value||'').trim();
   if(!v){toast('Write the notice first.');return;}
   pinNotice(v); toast('📌 Pinned for the club.'); U.rerender('onlinePanel'); try{G.ui.openOnline();G.ui.openOnline();}catch(e){}
   return;
  }
  if(a[0]==='unpin'){pinNotice('');toast('📌 Board cleared.');U.rerender('onlinePanel');try{G.ui.openOnline();G.ui.openOnline();}catch(e){}return;}
  if(a[0]==='mute'){toggleMute(a[1]);try{G.ui.openOnline();G.ui.openOnline();}catch(e){}return;}
  if(a[0]==='prof'){try{N.openProfile(a[1]);}catch(e){}return;}
  if(a[0]==='claim'){claimClubChest();return;}
  if(a[0]==='horse'){claimClubHorse();return;}
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
   const lt=chestTier(L.total||0), champs=championCount(L.rank||0);
   h+='<div class="passCard" style="margin-top:6px;background:linear-gradient(180deg,#fff6e2,#ffe9c4)"><div class="ph"><b>📦 Last club week is settled</b><span style="font-size:11px;color:#4a3526">'+(L.total||0)+'⭐ · rank #'+(L.rank||'—')+'</span></div>'
    +'<div class="sub">Tier '+lt+' club chest'+(champs?' + '+champs+' Champions chest'+(champs>1?'s':''):'')+'. The odds, in full:</div>'
    +oddsHtml(lt)
    +(champs?'<div class="sub" style="margin-top:5px"><b>🏆 Champions chest ×'+champs+'</b> — top three only:</div><div class="crow" style="gap:4px;flex-wrap:wrap;margin-top:3px">'
      +CHAMPION_LOOT.map(x=>'<span class="bE">'+x.p+'% '+esc(x.clubHorse?'🔥 a club horse token':(M.rewardLabel(x.r)||'—'))+'</span>').join('')+'</div>':'')
    +'<button data-fx="clubs:claim" class="claimBtn" style="margin-top:6px">Collect the chest'+(champs?'s':'')+'</button></div>';
  }else if(L&&L.claimed){
   h+='<div class="evrow">✅ <b>Last week collected</b><span>tier '+(L.tier||chestTier(L.total||0))+' · rank #'+(L.rank||'—')+' · '+(L.total||0)+'⭐</span></div>';
  }
  /* the ladder */
  h+='<div class="bGroup">The Basin club ladder</div>'
   +'<div style="font-size:11px;color:#8c7a63;margin-bottom:3px">Star Equestrian pays chests to the top hundred clubs; the Basin has a valley\'s worth, so every club on this board is in the running. The other clubs are the valley\'s own — their weeks are fixed on Monday and do not move again until the next one, so a club of two really can finish first.</div>';
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
  h+='<div class="bGroup">This week\'s chest — tier '+tier+'</div>'+oddsHtml(tier)
   +'<div class="sub" style="margin-top:3px">Tiers at '+CLUB_CHEST_TIERS.map(x=>x.sp+'⭐→T'+x.t).join(' · ')+'. Rescaled from Star Equestrian\'s 20k/50k/100k to this ranch\'s economy, where a champion week on your own is 550⭐.</div>';
  /* the club horse */
  const owns=(s.horses||[]).some(x=>x.breed===CLUB_HORSE), vouchers=s.clubHorseVoucher||0;
  h+='<div class="bGroup">🔥 The Ember Friesian</div>'
   +'<div class="passCard" style="background:linear-gradient(180deg,#2a1c18,#4a2a14);color:#ffd9a8">'
   +'<div class="ph"><b style="color:#ffb45a">'+(owns?'🔥 Ember Friesian — in your barn':vouchers?'🔥 Ember Friesian — a token is waiting':'🔒 Ember Friesian')+'</b><span style="font-size:11px;color:#e0a96a">Legendary · 9 speed / 8 stamina / 6 jump / 9 accel / 5 agility</span></div>'
   +'<div class="sub" style="color:#e8c79a">A black Friesian with fire in its coat. It is not in the shop, not in the market, not in the summoning stall and it never will be — the only way to one is a Champions chest, and those go to the top three clubs of the week.</div>'
   +(vouchers?'<button data-fx="clubs:horse" class="claimBtn" style="margin-top:6px">Claim your Ember Friesian ('+vouchers+' token'+(vouchers>1?'s':'')+')</button>':'')
   +'</div>';
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
 G.quest.addAch({id:'clubchamp',icon:'🏆',label:'Champions',desc:'Finish a club week in the top three',social:true,v:s=>(s.stats&&s.stats.clubChamp)||0,goal:1,r:{g:10,k:2}});
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
   S.sync(sv=>{sv.clubSeen=nt.at;});
  }
  if(s.clubWeekLast&&!s.clubWeekLast.claimed)setTimeout(()=>{try{toast('📦 A club chest is waiting in 🏅 → 🏇 Club.');}catch(e){}},6200);
 });
 let pubT=0;
 G.on('interval30',(s,now)=>{
  clubWeekRoll();
  touchClubWeek();
  if(online()&&now-pubT>120000){pubT=now;publishClubCard();}
 });

 /* =============================== 18. QA surface =============================== */
 G.clubs={CW,clubTotal,clubRows,myClubRank,chestTier,nextTier,championCount,rollClubChest,rollChampion,
  claimClubChest,claimClubHorse,clubWeekRoll,touchClubWeek,pinNotice,publishClubCard,publishMyPhoto,
  clubMeta,clubMembers,clubBoard,clubDir,photoData,clubLog,isMuted,toggleMute,memberCount,msToMonday,
  scoreShot,standings,enterPhoto,contestNow,claimPhotoPrize,loadPhotos,savePhotos,evRows,weeklyRanks,bandFor,claimWeekRank,
  applyFilter,setPause,filters:PHOTO_FILTERS,filter:()=>photoFilter,paused:()=>photoPause,
  CLUB_CHEST_TIERS,CLUB_CHEST_LOOT,CHAMPION_LOOT,CHAMPION_CHESTS,RIVAL_CLUBS,PHOTO_CONTESTS,PHOTO_PRIZES,WEEK_RANK_REWARDS,
  CLUB_HORSE,PHOTO_HORSE};
}

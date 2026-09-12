/* Feature package 'account-economy' — the account and meta layer.
   Player ID + save transfer, gift codes, the inbox and news feed, the settings screen (audio,
   graphics, controls remap, accessibility, codes, account), the touch emote strip, the Enter
   hotkey for chat, the currency overview and free-income telemetry, race tickets, the gem
   exchange, double-gem weekends, the first-week welcome track, the Ranch Prestige track (the
   free version of a paid membership) with its shop and event bonus, and every Star Point source
   the club ladder promises. Everything runs inside install(G); nothing at import time.
   See assets/features/index.js for the contract this file is written against. */
export const id='account-economy';
export function install(G){
 const {$,toast}=G, S=G.save, M=G.money, T=G.tables, U=G.ui, X=G.xp;
 const BUILD=S.build;
 const day=()=>G.time.dateKey();
 const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const PASS_STEP=150, PASS_TIERS=30;

 /* =============================== 1. Tables =============================== */
 /* Gift codes. Exact case, one use per ranch. The game is client-side, so this is the honour
    system like everything else — the point is the ritual, not the lock. */
 const GIFT_CODES={
  'MEADOWLARK':   {r:{c:500,g:5},note:'The ranch sign, freshly painted. Welcome home.'},
  'KESTREL-BASIN':{r:{g:20,k:1},note:'For riders who know every trail in the Basin.'},
  'CLOVER':       {r:{c:250,items:{carrot:5,apple:3}},note:'Clover says thank you. With her mouth full.'},
  'GRANDPA-WREN': {r:{k:2},note:'"Keys open more than doors, kiddo." — Wren'},
  'LOON-LAKE':    {r:{g:10,dust:20},note:'Something glittering from the lake bed.'},
  'HOLLOWPEAK':   {r:{c:800,g:8,k:1},note:'A pocketful of the mountain.'},
  'BARLEYFOLD':   {r:{c:150,items:{hay:5,carrot:10}},note:'A bale from the Barleyfold harvest.'},
  'FIRST-RIDE':   {r:{g:5,tickets:2},note:'Two tickets for the Basin Championship.'},
  'COTTONWOOD':   {r:{c:200,gear:'Rare'},note:'Ada left a parcel at the Cottonwood post.'},
  'COYOTE':       {r:{btok:1,g:4},note:'Something howled at the canyon rim. It left a token.'},
 };
 /* In-game news, newest first. A reward turns the note into an inbox delivery on the first
    boot of that build — the free-game version of "compensation". Static on purpose: nothing
    is pushed over the public broker. */
 const NEWS=[
  {v:'2026.09.11',icon:'📬',title:'The inbox, the settings and nine currencies',reward:{c:150,g:3},
   body:'Every delivery now lands in one place: 📬 in the dock. Settings (⚙️) has sound, graphics, controls you can remap, accessibility options and a place to type gift codes. The money screen lists all nine currencies, and the Prestige track hands out what a paid membership would — for riding.'},
  {v:'2026.09.04',icon:'🎖️',title:'Ranch Prestige',
   body:'Builder points, ribbons, breed mastery and trophies now add up to a Prestige level. Ten levels, nine perks: extra gems on the daily gift, bigger pastures, a bonus on event pay, the gold pass track and a shop of its own.'},
  {v:'2026.08.28',icon:'🎫',title:'Race tickets and double stakes',
   body:'One race ticket a day with the daily gift. Spend it in 🏆 Events to double the coins on your next round — and a gem on top.'},
  {v:'2026.08.21',icon:'✨',title:'Double-gem weekends',
   body:'The second and fourth weekend of every season pays double gems on everything you earn. The next one is listed under 📰 News and on the season pass.'},
  {v:'2026.08.14',icon:'🎁',title:'A welcome week for new riders',
   body:'Seven days of gifts for a new ranch: coins, gems, keys and three pieces of tack. Find it in 📜 Quests → Welcome.'},
 ];
 /* Double-gem weekends: season days 13/14 and 27/28. SEASON_EPOCH is a Monday, so these are
    the Saturday and Sunday of the second and fourth week. */
 const BONUS_DAYS=[13,14,27,28];
 function gemMul(t){const sn=G.time.seasonNow(t);return BONUS_DAYS.includes(sn.day)?2:1;}
 function nextBonus(t){const now=t||Date.now();const sn=G.time.seasonNow(now);for(const d of BONUS_DAYS){const st=sn.start+(d-1)*864e5;if(st+864e5>now)return st;}return sn.end+(BONUS_DAYS[0]-1)*864e5;}
 /* Income tuning targets. Generosity is deliberately above a paid game's baseline. */
 const ECON={gemsPerDay:18,keyGems:8};
 /* The gem exchange — the sinks a premium currency is for, rescaled to this economy. */
 const GEM_SHOP=[
  {id:'key',g:ECON.keyGems,label:'🗝️ Silver Key',sub:'Opens a tack chest at the shop',r:{k:1}},
  {id:'btok',g:12,label:'🧬 Breeding token',sub:'One breeding at the barn',r:{btok:1}},
  {id:'ticket',g:3,label:'🎫 Race ticket',sub:'Double stakes on one event',r:{tickets:1}},
  {id:'dust',g:5,label:'✨ 25 cosmetic dust',sub:'Dyes and the wardrobe',r:{dust:25}},
  {id:'picnic',g:4,label:'🧺 Picnic basket',sub:'10 carrots, 5 apples, 3 hay',r:{items:{carrot:10,apple:5,hay:3}}},
 ];
 /* Ranch Prestige: the membership perk set as a free progression track. */
 const P_LEVELS=[0,80,200,400,700,1100,1600,2200,3000,4000];
 const P_TITLES=['Stable hand','Rider','Trail hand','Ribbon rider','Ranch keeper','Basin champion','Head of the ranch','Kestrel warden','Legend of the Basin','Meadowlark elder'];
 const P_PERKS={2:['gem','Daily gift pays +1💎'],3:['ev10','Events pay 10% more'],4:['pasture10','Ten horses out in the pasture'],5:['gold','The gold season-pass track'],6:['ev25','Events pay 25% more'],7:['shop','The Prestige shop opens'],8:['pasture12','Twelve horses out to grass'],9:['badge','A 🎖️ badge and a title by your name'],10:['xp','Horses earn 10% more XP']};
 const PRESTIGE_SHOP=[
  {id:'gildedHelmet',lvl:7,c:900,kind:'outfit',slot:'helmet',val:'#ffd166',label:'Gilded helmet',sub:'Gold on the crown, worn at once'},
  {id:'meadowJacket',lvl:7,c:1200,kind:'outfit',slot:'shirt',val:'#7fb069',label:'Meadow-green jacket',sub:'The ranch colours'},
  {id:'duskBreeches',lvl:7,c:1000,kind:'outfit',slot:'pants',val:'#4a3a6e',label:'Dusk riding breeches',sub:'Hollowpeak at nightfall'},
  {id:'auroraTint',lvl:7,g:6,kind:'tint',val:'#b48cff',label:'Aurora saddle tint',sub:'A tack tint for the locker'},
  {id:'gildedTrough',lvl:8,c:400,kind:'decor',decor:'gildedTrough',label:'Gilded trough',sub:'A ranch piece only Prestige can place'},
  {id:'roseTint',lvl:8,g:8,kind:'tint',val:'#e88aa8',label:'Wild-rose saddle tint',sub:'A second tack tint'},
  {id:'nameBadge',lvl:9,c:0,kind:'badge',label:'🎖️ Name badge',sub:'Your title shows to the club and on profiles'},
  {id:'elderTitle',lvl:10,c:2500,kind:'title',val:'Meadowlark elder',label:'Title: Meadowlark elder',sub:'The last word in the Basin'},
 ];
 const WELCOME=[{c:100,g:2},{g:3},{gear:'Uncommon'},{k:1},{g:4},{c:250,gear:'Uncommon'},{g:6,k:1,gear:'Rare'}];
 const FORAGE_SP={lettuce:1,pumpkin:2,orange:3,truffle:4};      // trader and picnic food gives none
 const KEY_LABELS={care:'🐴 Care',shop:'🛍️ Shop',events:'🏆 Events',stable:'🐎 Stable',quests:'📜 Quests',club:'🌐 Club',boards:'🏅 Boards',chat:'💬 Chat',pet:'🐶 Call the pet',whistle:'🎶 Whistle',slide:'🛑 Sliding stop',wild:'🌿 Wild mode',firstPerson:'👁️ First person',emoteBar:'🦄 Emote bar',kick:'🦵 Kick emote',brush:'🧹 Brush emote',guitar:'🎸 Guitar',sprint:'💨 Sprint'};
 const PANEL_KEYS={care:'openCare',shop:'openShop',events:'openEvents',stable:'openStable',quests:'openQuests',club:'openOnline',boards:'openLB'};
 const FIXED_KEYS=[['W / ↑','Ride forward'],['S / ↓','Slow, back up'],['A / D','Steer'],['Shift','Gallop'],['Space','Jump'],['Ctrl','Collect to a walk'],['E','Talk, open, mount'],['M','World map'],['C','Free camera'],['P','Photo'],['F','Fly (a winged horse)'],['Q / R / V','Tricks in the air'],['1 – 5','Horse emotes'],['Esc','Close everything']];

 /* =============================== 2. Save shape =============================== */
 S.ensure(s=>{
  if(s.tickets==null)s.tickets=0;
  if(s.stake==null)s.stake=false;
  if(s.sfxVol==null)s.sfxVol=1;
  const p=s.prestige=s.prestige||{lvl:1,pts:0,owned:{},tints:{},title:''};
  p.owned=p.owned||{}; p.tints=p.tints||{}; if(p.pts==null)p.pts=0; if(p.lvl==null)p.lvl=1; if(p.title==null)p.title='';
  if(!s.welcome){const vet=(Date.now()-(s.founded||Date.now()))>7*864e5;s.welcome=vet?{day:7,last:'',claimed:{0:1,1:1,2:1,3:1,4:1,5:1,6:1},vet:true}:{day:0,last:'',claimed:{}};}
  s.newsRead=s.newsRead||{};
  s.ww=s.ww||{g:s.gems||0,k:s.keys||0,gacc:0,d:'',gt:0,kt:0,hist:[],tk:null,it:null,dqd:'',dqn:0,umb:false,wk:'',tkd:''};
  const a=s.a11y; if(a.contrast==null)a.contrast=false; if(a.motion==null)a.motion=false; if(a.textScale==null)a.textScale=1; if(!a.cb)a.cb='none';
 });

 /* =============================== 3. Helpers =============================== */
 function isVIP(s){return !!(s&&s.vip&&s.vip.until>Date.now());}
 function ranchPts(s){return (s.decor||[]).reduce((a,d)=>a+((T.DECOR_CAT[d.t]||{}).pts||0),0);}
 function prestigeParts(s){const m=s.mastery||{};let ms=0;for(const k in m)ms+=Math.min(10,m[k]||0);return {ranch:ranchPts(s),rib:3*(s.ribbonTotal||0),mast:10*ms,troph:25*Object.keys(s.trophies||{}).length,extra:(s.prestige&&s.prestige.pts)||0};}
 function prestigePts(s){const p=prestigeParts(s);return p.ranch+p.rib+p.mast+p.troph+p.extra;}
 function prestigeLevel(s){const p=prestigePts(s);let l=1;for(let i=1;i<P_LEVELS.length;i++)if(p>=P_LEVELS[i])l=i+1;return l;}
 function titleOf(s){if(!s)return '';if(s.prestige&&s.prestige.title)return s.prestige.title;return P_TITLES[Math.min(P_TITLES.length,prestigeLevel(s))-1];}
 function hasPerk(s,k){if(!s)return false;if(isVIP(s))return true;const L=prestigeLevel(s);for(const lv in P_PERKS)if(P_PERKS[lv][0]===k)return L>=+lv;return false;}
 function eventMul(s){return 1+(hasPerk(s,'ev25')?0.25:hasPerk(s,'ev10')?0.10:0);}
 let PL=1;                                                  // cached prestige level for the per-frame paths
 function addSPx(s,n,why){if(!n)return;X.addSP(s,n,why);s.sp.src=s.sp.src||{};s.sp.src[why]=(s.sp.src[why]||0)+n;}
 /* The wallet watch: a ledger that turns things other systems already do into the Star
    Points and telemetry this package promises, without editing any of them. Gems that go
    down were spent (1 SP per 10), gems and keys that go up are today's income, a new daily
    claim is 10 SP, the umbrella 40, a tack level gained is one SP per rarity star. Runs on
    every wallet refresh and every 30 s save pass; it is a handful of comparisons. */
 function walletWatch(s){
  const w=s.ww; const ds=day();
  if(w.d!==ds){if(w.d)w.hist=(w.hist||[]).concat([{d:w.d,g:w.gt||0,k:w.kt||0}]).slice(-7);w.d=ds;w.gt=0;w.kt=0;}
  const g=s.gems||0,k=s.keys||0;
  if(g>w.g)w.gt+=g-w.g; else if(g<w.g){w.gacc=(w.gacc||0)+(w.g-g);const n=Math.floor(w.gacc/10);if(n>0){w.gacc-=n*10;addSPx(s,n,'gems');}}
  if(k>w.k)w.kt+=k-w.k;
  w.g=g; w.k=k;
  if(s.dq){const n=Object.keys(s.dq.claimed||{}).length;if(w.dqd!==s.dq.date){w.dqd=s.dq.date;w.dqn=0;w.umb=false;}
   if(n>w.dqn){addSPx(s,10*(n-w.dqn),'daily');s.prestige.pts+=5*(n-w.dqn);w.dqn=n;}
   if(s.dq.umbrella&&!w.umb){w.umb=true;addSPx(s,40,'umbrella');}}
  const R=T.RARITIES; const sc=(s.tack||[]).reduce((a,t)=>a+((t.lvl||1)-1)*(Math.max(0,R.indexOf(t.rarity))+1),0);
  if(w.tk==null)w.tk=sc; else if(sc>w.tk)addSPx(s,sc-w.tk,'tack'); w.tk=sc;
  if(s.wkLast&&s.wkLast.claimed&&w.wk!==s.wkLast.week){w.wk=s.wkLast.week;s.prestige.pts+=25;}
  forageWatch(s,false);
 }
 function forageWatch(s,award){
  const w=s.ww; if(!w.it){w.it={};award=false;}
  for(const k in FORAGE_SP){const n=(s.items&&s.items[k])||0;const had=w.it[k]||0;if(award&&n>had)addSPx(s,FORAGE_SP[k]*(n-had),'forage');w.it[k]=n;}
 }
 /* Inbox */
 function inboxPush(s,e){
  s.inbox=s.inbox||[]; if(e.id&&s.inbox.some(x=>x.id===e.id))return null;
  const row=Object.assign({id:e.id||('m'+Date.now().toString(36)+Math.random().toString(36).slice(2,5)),t:Date.now(),from:'Meadowlark Ranch',title:'',body:'',r:null,open:null,claimed:false},e);
  s.inbox.push(row);
  if(s.inbox.length>60)s.inbox=s.inbox.filter(x=>!x.claimed).concat(s.inbox.filter(x=>x.claimed).slice(-30));
  return row;
 }
 function inboxUnclaimed(s){return (s.inbox||[]).filter(x=>!x.claimed&&x.r).length;}
 function inboxClaim(id){
  let row=null,r=null;
  S.sync(s=>{row=(s.inbox||[]).find(x=>x.id===id);if(!row||row.claimed)return;row.claimed=Date.now();if(row.r){M.payReward(s,row.r);r=row.r;}});
  if(!row)return;
  M.refreshWallet(); try{G.horse.refreshTack();}catch(e){}
  if(r){G.sGem();toast('📬 '+row.title+': +'+M.rewardLabel(r));}
  U.rerender('inboxPanel');
 }
 function readyElsewhere(s){
  const out=[];
  if(s.wkLast&&!s.wkLast.claimed)out.push({icon:'📅',title:'Last week\'s wages',sub:'Grandpa Wren has the envelope ready',open:'lbPanel'});
  try{const dq=s.dq||{prog:{},claimed:{}};const n=G.quest.todayDaily().filter(q=>(dq.prog[q.type]||0)>=q.goal&&!dq.claimed[q.type]).length;if(n)out.push({icon:'📋',title:n+' daily quest'+(n>1?'s':'')+' done',sub:'Claim them in Quests',open:'questPanel'});}catch(e){}
  try{const ac=s.achClaims||{};const n=G.quest.ACHS.filter(a=>!ac[a.id]&&a.v(s)>=a.goal).length;if(n)out.push({icon:'🏅',title:n+' achievement'+(n>1?'s':'')+' earned',sub:'Claim them in Quests → Achievements',open:'questPanel'});}catch(e){}
  const pts=(s.pass&&s.pass.pts)||0,tier=Math.min(PASS_TIERS,Math.floor(pts/PASS_STEP)),cl=(s.pass&&s.pass.claims)||{};let pr=0;for(let i=0;i<tier;i++)if(!cl[i])pr++;
  if(pr)out.push({icon:'🎟️',title:pr+' season-pass tier'+(pr>1?'s':'')+' ready',sub:'Claim them in 🏅 → Season Pass',open:'lbPanel'});
  if(s.cal&&s.cal.m===G.time.calMonth()){let n=0;for(let i=0;i<(s.cal.i||0);i++)if(!(s.cal.claimed||{})[i])n++;if(n)out.push({icon:'🗓️',title:n+' calendar day'+(n>1?'s':'')+' open',sub:'Collect in 🏅 → Week',open:'lbPanel'});}
  const wl=welcomeReady(s); if(wl)out.push({icon:'🎁',title:'Welcome week: '+wl+' gift'+(wl>1?'s':'')+' waiting',sub:'Quests → Welcome',open:'questPanel'});
  return out;
 }
 /* News */
 function newsItems(s){
  const out=[]; const sn=G.time.seasonNow();
  out.push({id:'season-'+sn.key,icon:sn.def.emoji,t:sn.start,title:sn.def.name+' — day '+sn.day,body:sn.def.desc+' '+sn.daysLeft+' days left in the season.'});
  try{const f=G.course.weeklyFeatured();if(f&&f.length)out.push({id:'feat-'+G.time.weekKey(),icon:'🏆',t:Date.now()-864e5,title:'Featured this week: '+f.map(e=>e.name).join(', '),body:'Featured events pay half again on coins and ribbons count double toward the weekly tiers.'});}catch(e){}
  const nb=nextBonus(); out.push({id:'x2-'+new Date(nb).toDateString(),icon:'✨',t:nb-3*864e5,title:gemMul()>1?'Double-gem weekend is ON':'Next double-gem weekend: '+new Date(nb).toLocaleDateString(undefined,{weekday:'long',month:'short',day:'numeric'}),body:'Every gem earned on the second and fourth weekend of a season counts twice — dailies, events, chests, the daily gift, all of it.'});
  if(s.cal&&s.cal.m===G.time.calMonth())out.push({id:'cal-'+s.cal.m,icon:'🗓️',t:Date.now()-2*864e5,title:'Month calendar: day '+(s.cal.i||0)+' of 28 open',body:'A gift a day for turning up; the big ones on days 7, 14, 21 and 28. Collect in 🏅 → Week.'});
  for(const n of NEWS)out.push({id:'news-'+n.v,icon:n.icon,t:Date.parse(n.v.replace(/\./g,'-')),title:n.title,body:n.body,v:n.v,reward:n.reward});
  out.sort((a,b)=>(b.t||0)-(a.t||0));
  return out;
 }
 function unreadNews(s){const r=s.newsRead||{};return newsItems(s).filter(n=>!r[n.id]).length;}
 /* Welcome week */
 function welcomeAdvance(s){const w=s.welcome;const ds=day();if(w.last===ds||w.day>=7)return false;w.last=ds;w.day++;return true;}
 function welcomeReady(s){const w=s.welcome;if(!w)return 0;let n=0;for(let i=0;i<w.day;i++)if(!w.claimed[i])n++;return n;}
 function welcomeDone(s){const w=s.welcome;return !!w&&Object.keys(w.claimed).length>=7;}
 function welcomeClaim(i){
  let r=null;
  S.sync(s=>{const w=s.welcome;if(i>=w.day||w.claimed[i])return;w.claimed[i]=1;r=WELCOME[i];M.payReward(s,r);s.prestige.pts+=10;});
  if(!r)return;
  M.refreshWallet(); try{G.horse.refreshTack();}catch(e){} G.sGem();
  toast('🎁 Welcome day '+(i+1)+': +'+M.rewardLabel(r));
  U.renderQuests();
 }
 /* Codes */
 function redeemCode(raw){
  raw=String(raw||'').trim(); let msg='',ok=false;
  if(!raw){toast('Type a code first.');return false;}
  S.sync(s=>{const c=GIFT_CODES[raw];if(!c){msg='That code is not valid — codes are case-sensitive.';return;}
   if(s.codes[raw]){msg='That code has already been used on this ranch.';return;}
   s.codes[raw]=Date.now(); s.prestige.pts+=10;
   inboxPush(s,{id:'code-'+raw,from:'Meadowlark Ranch',title:'🎁 Gift code '+raw,body:c.note,r:c.r}); ok=true;
   msg='🎁 Code accepted — '+M.rewardLabel(c.r)+' is waiting in your 📬 inbox.';});
  M.refreshWallet(); if(ok)G.sGem(); toast(msg); return ok;
 }
 /* Save transfer. The save never holds photos (they live under their own key), so the blob
    stays small enough to paste. Nothing goes over the broker. */
 function exportBlob(){const s=S.fresh();if(!s)return '';const o=Object.assign({},s);delete o.ww;return btoa(unescape(encodeURIComponent(JSON.stringify(o))));}
 function importBlob(txt){
  let o=null; try{o=JSON.parse(decodeURIComponent(escape(atob(String(txt||'').trim()))));}catch(e){}
  if(!o||typeof o.v!=='number'||!Array.isArray(o.horses)||!o.horses.length){toast('That is not a Meadowlark save.');return false;}
  U.confirm({title:'Load this ranch?',body:'It replaces the ranch saved in THIS browser ('+(o.horses.length)+' horses, '+Math.floor(o.coins||0)+' coins, ID '+(o.pid||'?')+').',
   onYes(){try{localStorage.setItem(S.KEY,JSON.stringify(o));}catch(e){}location.replace(location.pathname);}});
  return true;
 }
 function copyText(txt,done){if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(txt).then(done,()=>{try{prompt('Copy this:',txt);}catch(e){}});else{try{prompt('Copy this:',txt);}catch(e){}}}
 /* Accessibility */
 function applyA11y(a){
  a=a||{}; const b=document.body;
  b.classList.remove('cb-deutan','cb-protan','cb-tritan'); if(a.cb&&a.cb!=='none')b.classList.add('cb-'+a.cb);
  b.classList.toggle('hi-contrast',!!a.contrast); b.classList.toggle('reduce-motion',!!a.motion);
  document.documentElement.style.setProperty('--ui-scale',String(a.textScale||1));
 }
 /* Key map: live copy of the player's overrides; panel hotkeys rebound on the spot, the rest on the next visit. */
 let liveMap=Object.assign({},T.KEYMAP,(S.fresh()||{}).keymap||{});
 let pendingRemap=null;
 function rebindPanel(name,oldCode,newCode){const fn=U[PANEL_KEYS[name]];if(!fn)return;if(oldCode)U.hotkey(oldCode,null);if(newCode)U.hotkey(newCode,()=>fn());}
 function remapKey(name,code){
  const clash=Object.keys(liveMap).find(k=>k!==name&&liveMap[k]===code);
  if(clash){toast('⌨️ '+code.replace(/^Key|^Digit/,'')+' already does '+(KEY_LABELS[clash]||clash)+'.');return false;}
  const old=liveMap[name]; liveMap[name]=code;
  S.sync(s=>{s.keymap=s.keymap||{};if(code===T.KEYMAP[name])delete s.keymap[name];else s.keymap[name]=code;});
  if(PANEL_KEYS[name])rebindPanel(name,old,code); else if(name==='chat')bindChat(old,code);
  toast('⌨️ '+(KEY_LABELS[name]||name)+' is now '+code.replace(/^Key|^Digit/,'')+(PANEL_KEYS[name]||name==='chat'?'':' — from your next visit'));
  return true;
 }
 function bindChat(old,code){if(old)U.hotkey(old,null);if(code&&G.net.SOCIAL)U.hotkey(code,()=>{const b=$('chatBar');if(!b)return;b.style.display='flex';const i=$('chatIn');if(i)i.focus();});}

 /* =============================== 4. Hooks =============================== */
 G.addMul('gem',()=>gemMul());
 G.addMul('xp',s=>{const sv=s||S.fresh();return hasPerk(sv,'xp')?1.1:1;});
 G.on('goldPass',s=>hasPerk(s,'gold'));
 G.on('pastureMax',s=>hasPerk(s,'pasture12')?12:hasPerk(s,'pasture10')?10:0);
 G.on('netPos',(payload,s)=>{if(s&&hasPerk(s,'badge')&&s.prestige&&s.prestige.owned.nameBadge){payload.pb=1;payload.pt=String(titleOf(s)).slice(0,20);}});
 G.on('remote',(m,r)=>{if(!m||!r)return;r.pb=m.pb?1:0;r.pt=m.pt?String(m.pt).slice(0,20):'';});
 G.on('dailyEvt',type=>{if(type==='carrots')S.sync(s=>forageWatch(s,true));});
 G.on('interval30',s=>{walletWatch(s);});
 G.on('key',e=>{
  if(!pendingRemap)return;
  const name=pendingRemap; pendingRemap=null;
  if(e.code!=='Escape'&&!/^(Shift|Control|Alt|Meta)(Left|Right)$/.test(e.code)||name==='sprint')remapKey(name,e.code); else toast('Remap cancelled.');
  U.rerender('settingsPanel'); e.preventDefault(); return true;
 });
 G.on('courseFinish',({ev,pay})=>{
  const s=S.fresh(); if(!s)return;
  const em=eventMul(s); let extra=0; const why=[];
  if(em>1){extra+=Math.round(pay*(em-1));why.push('🎖️ Prestige +'+Math.round((em-1)*100)+'%');}
  let staked=false; S.sync(sv=>{if(sv.stake&&(sv.tickets||0)>0){sv.tickets--;staked=true;}sv.stake=false;sv.prestige.pts+=10;});
  if(staked){extra+=pay;why.push('🎫 double stakes');M.addGems(1);}
  if(extra>0){M.addCoins(extra);setTimeout(()=>{try{toast('🏆 Event bonus: +'+extra+'🪙 · '+why.join(' · '));}catch(e){}},700);}
  M.refreshWallet();
 });
 G.on('wallet',s=>{
  S.sync(sv=>{walletWatch(sv);});
  const w=S.fresh()||s;
  U.hud.stat('dustEl',(w.dust||0)>0?'<i>✨</i><b>'+w.dust+'</b>':'');
  U.hud.stat('btokEl',(w.btok||0)>0?'<i>🧬</i><b>'+w.btok+'</b>':'');
  U.hud.stat('ticketEl',(w.tickets||0)>0?'<i>🎫</i><b>'+w.tickets+'</b>':'');
  const ge=$('gemEl'); if(ge&&ge.parentElement){let pill=ge.parentElement.querySelector('.gemx2');if(gemMul()>1){if(!pill){pill=document.createElement('em');pill.className='gemx2';pill.textContent='×2';pill.title='Double-gem weekend';ge.parentElement.appendChild(pill);}}else if(pill)pill.remove();}
  const wr=welcomeReady(w); if(wr)U.hud.badge('questBtn',wr);
  const L=prestigeLevel(w);
  if(L!==PL){const up=L>PL;PL=L;S.sync(sv=>{sv.prestige.lvl=L;});if(up&&w.prestige.lvl<L){G.sGem();try{toast('🎖️ Prestige '+L+' — '+P_TITLES[L-1]+'!'+(P_PERKS[L]?' '+P_PERKS[L][1]:''));}catch(e){}}}
 });
 G.on('state',o=>{
  const s=S.fresh()||{};
  o.wallet=o.wallet||{}; o.wallet.gemMul=gemMul(); o.wallet.sp=(s.sp&&s.sp.pts)||0; o.wallet.tickets=s.tickets||0; o.wallet.spSrc=(s.sp&&s.sp.src)||{};
  o.prestige={lvl:prestigeLevel(s),pts:prestigePts(s),title:titleOf(s),eventMul:eventMul(s)};
  o.inbox={unclaimed:inboxUnclaimed(s),unreadNews:unreadNews(s),letters:(s.inbox||[]).length,ready:readyElsewhere(s).length};
  o.welcome={day:(s.welcome||{}).day||0,claimed:Object.keys((s.welcome||{}).claimed||{}).length};
  o.a11y=s.a11y||null; o.keymap=s.keymap||{}; o.seenBuild=s.seenBuild||'';
 });
 G.on('boot',(s0,info)=>{
  const ds=day(); const msgs=[];
  S.sync(s=>{
   walletWatch(s);
   if(welcomeAdvance(s))msgs.push('🎁 Welcome week: day '+s.welcome.day+' is open in 📜 Quests → 🎁 Welcome.');
   if(s.seenBuild!==BUILD){s.seenBuild=BUILD;const n=NEWS[0];inboxPush(s,{id:'news-'+n.v,from:'The Meadowlark team',title:'📰 '+n.title,body:n.body,r:n.reward||null});msgs.push('📰 What\'s new in Meadowlark — a note'+(n.reward?' and a gift':'')+' in your 📬 inbox.');}
   if(s.ww.tkd!==ds){
    s.ww.tkd=ds; s.tickets=(s.tickets||0)+1;
    if(gemMul()>1){const extra=isVIP(s)?6:3;s.gems+=extra;msgs.push('✨ Double-gem weekend: the daily gift pays twice — +'+extra+'💎 more.');}
    if(hasPerk(s,'gem')&&!isVIP(s)){s.gems+=1;msgs.push('🎖️ Prestige: +1💎 on the daily gift.');}
    msgs.push('🎫 A race ticket for today — double stakes on one event in 🏆 Events.');
   }
   if(info&&info.wkClosed){const w=info.wkClosed;inboxPush(s,{id:'week-'+w.week,from:'Grandpa Wren',title:'📅 Your week is in',body:(w.sp||0)+' Star Points over '+(w.days||0)+' day'+(w.days===1?'':'s')+'. The wages are in the 🏅 panel under Week.',open:'lbPanel'});}
   if(gemMul()>1&&s.flags['x2-'+ds]==null){s.flags['x2-'+ds]=1;msgs.unshift('✨ Double-gem weekend is on — every gem you earn today counts twice!');}
  });
  msgs.forEach((m,i)=>setTimeout(()=>{try{toast(m);}catch(e){}},5200+i*2200));
  const s=S.fresh(); PL=s?prestigeLevel(s):1; if(s){applyA11y(s.a11y);try{if(G.audio)G.audio.setVol(s.sfxVol==null?1:s.sfxVol);}catch(e){}}
  M.refreshWallet();
  /* phone → laptop hand-off: ?import=<blob> */
  try{const imp=new URLSearchParams(location.search).get('import');if(imp){history.replaceState(null,'',location.pathname);setTimeout(()=>importBlob(imp),800);}}catch(e){}
 });

 /* =============================== 5. UI =============================== */
 const style=document.createElement('style');
 style.textContent=[
  '#hud,#dock,#statusCard,#toasts,#hint,#ctx,#questTrack,#dlg,#courseHud,.fpanel,#eventsPanel,#carePanel,#shopPanel,#onlinePanel,#lbPanel,#moneyPanel,#summonPanel,#buildPanel,#stablePanel,#questPanel,#profilePanel,#chatBar,#chatFeed{zoom:var(--ui-scale,1)}',
  '.gemx2{font-style:normal;font-size:10px;font-weight:800;background:#e05a3c;color:#fff;border-radius:8px;padding:1px 5px;margin-left:3px;vertical-align:top}',
  '.setTabs{display:flex;gap:5px;flex-wrap:wrap;margin:2px 0 4px}.setTabs button{font-size:12px;padding:5px 9px}.setTabs button.on{background:linear-gradient(#ffe7a6,#e9bb52);border-color:var(--gold-2)}',
  '.setRow{display:flex;align-items:center;gap:8px;font-size:13px;border:1px solid var(--line);border-radius:12px;padding:8px 11px;background:#fff}.setRow .lbl{flex:1;font-weight:700}.setRow .sub{display:block;font-size:11px;color:var(--ink-2);font-weight:600}.setRow input[type=range]{width:120px}.setRow kbd{font-family:var(--font);font-size:11px;font-weight:800;background:#f7f2e6;border:1px solid var(--line-2);border-radius:6px;padding:2px 7px;min-width:22px;text-align:center}',
  '.curGrid{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:6px}.curRow{display:flex;align-items:center;gap:7px;border:1px solid var(--line);border-radius:11px;padding:6px 9px;background:#fff;font-size:12px}.curRow i{font-style:normal;font-size:18px}.curRow b{font-size:14px}.curRow small{display:block;color:var(--ink-2);font-weight:600;font-size:10.5px}',
  '.inboxRow{align-items:flex-start}.inboxRow .qmain span{font-weight:600;font-size:12px;color:var(--ink-2);white-space:normal}.inboxRow .meta{font-size:10.5px;color:var(--ink-3)}.newsDot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#e05a3c;margin-right:5px}',
  '#saveBlob,#saveImport{width:100%;box-sizing:border-box;font-size:10px;font-family:monospace;height:64px;border:1px solid var(--line-2);border-radius:9px;padding:6px}',
  'body.touch #touch{grid-template-columns:repeat(4,var(--tb))}#tEmoteBar{display:none;position:fixed;right:calc(14px + env(safe-area-inset-right));bottom:calc(14px + env(safe-area-inset-bottom) + var(--tb,64px) + 16px);z-index:7;gap:6px;flex-wrap:wrap;justify-content:flex-end;max-width:60vw}#tEmoteBar.on{display:flex}#tEmoteBar button{font-size:13px;padding:8px 10px}',
  'body.cb-deutan{--red:#d55e00;--green:#0072b2;--green-2:#005a8f;--gold:#e69f00;--gold-2:#b57b00;--rose:#cc79a7}body.cb-protan{--red:#cc79a7;--green:#0072b2;--green-2:#005a8f;--gold:#f0e442;--gold-2:#b8ab1c;--rose:#e6a3c6}body.cb-tritan{--red:#d62828;--green:#009e73;--green-2:#00755a;--sky:#f0e442;--rose:#e88aa8}',
  'body.hi-contrast{--ink:#000;--ink-2:#222;--ink-3:#333;--line:#333;--line-2:#000;--glass:rgba(255,255,255,.97);--dark:rgba(0,0,0,.95)}body.hi-contrast .fpanel,body.hi-contrast #eventsPanel,body.hi-contrast #carePanel,body.hi-contrast #shopPanel,body.hi-contrast #onlinePanel,body.hi-contrast #lbPanel,body.hi-contrast #moneyPanel,body.hi-contrast #buildPanel,body.hi-contrast #stablePanel,body.hi-contrast #questPanel,body.hi-contrast #profilePanel{background:#fff;border:2px solid #000}body.hi-contrast .toast{border:2px solid #fff}',
  'body.reduce-motion *{animation:none!important;transition:none!important}',
 ].join('\n');
 document.head.appendChild(style);
 /* a ticket counter in the wallet, beside dust and breeding tokens */
 (function(){const w=$('wallet');if(w&&!$('ticketEl')){const sp=document.createElement('span');sp.className='w';sp.id='ticketEl';sp.title='Race tickets — double stakes on one event';sp.style.display='none';w.appendChild(sp);}})();

 /* ---- 5a. Inbox & news ------------------------------------------------------------- */
 let inboxTab='mail';
 U.panel({id:'inboxPanel',title:'📬 Inbox',dock:{label:'📬',after:'questBtn',title:'Inbox & news',pip:()=>{const s=S.fresh();return s?inboxUnclaimed(s)+readyElsewhere(s).length:0;}},
  render(p,s){
   if(!s)return '';
   const un=unreadNews(s);
   let h='<div class="ph panelHeader"><b>📬 Inbox</b><span class="chip" style="font-size:11px;padding:3px 9px" title="Your Player ID">🪪 '+esc(s.pid)+'</span><button class="panelClose" data-fx="close:inboxPanel" aria-label="Close inbox">Close ×</button></div>';
   h+='<div class="setTabs"><button data-fx="acct:itab:mail" class="'+(inboxTab==='mail'?'on':'')+'">✉️ Mail'+(inboxUnclaimed(s)?'<span class="pip">'+inboxUnclaimed(s)+'</span>':'')+'</button><button data-fx="acct:itab:news" class="'+(inboxTab==='news'?'on':'')+'">📰 News'+(un?'<span class="pip">'+un+'</span>':'')+'</button></div>';
   if(inboxTab==='news'){
    const items=newsItems(s); const read=s.newsRead||{};
    h+='<span style="font-size:11px;color:#8c7a63">Meadowlark build '+esc(BUILD)+' · seasons, events and what changed. Nothing here is pushed from a server — it ships with the game.</span>';
    h+=items.map(n=>'<div class="qrow inboxRow"><span class="qico">'+n.icon+'</span><div class="qmain"><b>'+(read[n.id]?'':'<i class="newsDot"></i>')+esc(n.title)+'</b><span>'+esc(n.body)+'</span><span class="meta">'+(n.v?'build '+n.v:new Date(n.t||Date.now()).toLocaleDateString())+'</span></div></div>').join('');
    if(items.some(n=>!read[n.id]))setTimeout(()=>{S.sync(sv=>{sv.newsRead=sv.newsRead||{};for(const n of items)sv.newsRead[n.id]=Date.now();});M.refreshWallet();},0);
   }else{
    const letters=(s.inbox||[]).slice().sort((a,b)=>(a.claimed?1:0)-(b.claimed?1:0)||(b.t||0)-(a.t||0));
    const ready=readyElsewhere(s);
    if(ready.length){h+='<b style="font-size:13px">✅ Ready to collect</b>'+ready.map(r=>'<div class="qrow inboxRow"><span class="qico">'+r.icon+'</span><div class="qmain"><b>'+esc(r.title)+'</b><span>'+esc(r.sub)+'</span></div><button data-fx="open:'+r.open+'">Open</button></div>').join('');}
    h+='<b style="font-size:13px">✉️ Deliveries</b>';
    if(!letters.length)h+='<span style="font-size:12px;color:#8c7a63">Nothing yet. Gift codes, prizes, wages and news gifts land here, addressed to '+esc(s.pid)+'.</span>';
    h+=letters.slice(0,40).map(l=>'<div class="qrow inboxRow'+(l.claimed?' claimed':'')+'"><span class="qico">'+(l.claimed?'✅':l.r?'🎁':'📨')+'</span><div class="qmain"><b>'+esc(l.title)+'</b><span>'+esc(l.body)+'</span><span class="meta">from '+esc(l.from)+' · '+new Date(l.t||Date.now()).toLocaleDateString()+(l.r?' · '+esc(M.rewardLabel(l.r)):'')+'</span></div>'
     +(l.claimed?'':l.r?'<button class="claimBtn" data-fx="inbox:claim:'+esc(l.id)+'">Claim</button>':l.open?'<button data-fx="open:'+esc(l.open)+'">Open</button>':'<button data-fx="inbox:claim:'+esc(l.id)+'">Read</button>')+'</div>').join('');
   }
   return h;
  },
  vr:{tab:'inbox',label:'Inbox',build(rows,sv){return 'Inbox: '+inboxUnclaimed(sv)+' to claim, '+readyElsewhere(sv).length+' ready elsewhere. Open 📬 on a flat screen to collect.';}}});
 U.action('inbox',a=>{if(a[0]==='claim')inboxClaim(a[1]);});

 /* ---- 5b. Settings ----------------------------------------------------------------- */
 let setTab='audio';
 U.panel({id:'settingsPanel',title:'⚙️ Settings',sys:{label:'⚙️',title:'Settings — sound, graphics, controls, accessibility, codes'},
  render(p,s){
   if(!s)return '';
   let h='<div class="ph panelHeader"><b>⚙️ Settings</b><button class="panelClose" data-fx="close:settingsPanel" aria-label="Close settings">Close ×</button></div>';
   const tabs=[['audio','🔊 Audio'],['gfx','🎚️ Graphics'],['controls','⌨️ Controls'],['access','♿ Accessibility'],['codes','🎁 Codes'],['account','🪪 Account']];
   h+='<div class="setTabs">'+tabs.map(([k,l])=>'<button data-fx="acct:stab:'+k+'" class="'+(setTab===k?'on':'')+'">'+l+'</button>').join('')+'</div>';
   const A=G.audio||{muted:()=>false,vol:()=>1}, Q=G.gfx||null;
   if(setTab==='audio'){
    h+='<div class="setRow"><span class="lbl">Sound<span class="sub">Hoofbeats, chimes and the birds</span></span><button data-fx="acct:mute">'+(A.muted()?'🔇 Muted — turn on':'🔊 On — mute')+'</button></div>'
     +'<div class="setRow"><span class="lbl">Volume<span class="sub">'+Math.round((s.sfxVol==null?1:s.sfxVol)*100)+'%</span></span><input type="range" min="0" max="100" value="'+Math.round((s.sfxVol==null?1:s.sfxVol)*100)+'" data-fxin="acct:vol"><button data-fx="acct:testSound">🔔 Test</button></div>';
   }else if(setTab==='gfx'){
    const q=Q?Q.get():(s.quality||'high');
    h+='<div class="setRow"><span class="lbl">Quality<span class="sub">Low is smoothest, High is prettiest</span></span>'+['low','medium','high'].map(k=>'<button data-fx="acct:quality:'+k+'" class="'+(q===k?'claimBtn':'')+'">'+k[0].toUpperCase()+k.slice(1)+'</button>').join('')+'</div>'
     +'<div class="setRow"><span class="lbl">Glow (bloom)<span class="sub">Sunlight through the dust; off on Low</span></span><button data-fx="acct:bloom">'+(Q&&Q.bloom()?'✨ On — turn off':'Off — turn on')+'</button></div>'
     +'<div class="setRow"><span class="lbl">Auto-adjust<span class="sub">Step down a tier when the frame rate drops</span></span><button data-fx="acct:autoq">'+(s.qualityLocked?'Off — turn on':'✅ On — keep my choice')+'</button></div>';
   }else if(setTab==='controls'){
    h+='<span style="font-size:11px;color:#8c7a63">Tap Remap, then press the key you want. Panel keys change at once; the rest apply on your next visit. Riding keys are fixed.</span>';
    h+=Object.keys(KEY_LABELS).map(k=>{const code=liveMap[k]||'';const def=code===T.KEYMAP[k];return '<div class="setRow"><span class="lbl">'+KEY_LABELS[k]+'</span><kbd>'+esc(String(code).replace(/^Key|^Digit/,'').replace('ShiftLeft','Shift').replace('Enter','↵'))+'</kbd><button data-fx="acct:remap:'+k+'" '+(pendingRemap===k?'class="claimBtn"':'')+'>'+(pendingRemap===k?'Press a key…':'Remap')+'</button>'+(def?'':'<button data-fx="acct:unmap:'+k+'" title="Back to default">↺</button>')+'</div>';}).join('');
    h+='<div class="crow" style="gap:6px"><button data-fx="acct:resetKeys">↺ Reset every key</button></div>';
    h+='<b style="font-size:13px;margin-top:4px">Riding</b>'+FIXED_KEYS.map(([k,l])=>'<div class="setRow" style="padding:5px 11px"><span class="lbl" style="font-weight:600">'+esc(l)+'</span><kbd>'+esc(k)+'</kbd></div>').join('');
    h+='<b style="font-size:13px;margin-top:4px">Mouse & touch</b><span style="font-size:11.5px;color:#8c7a63">Drag to look around, wheel to zoom. On a touch screen: drag bottom-left to ride, drag the right side to look, 💨 gallop, ⤴ jump, 🌀 trick, 🦄 emotes.</span>';
   }else if(setTab==='access'){
    const a=s.a11y||{};
    h+='<div class="setRow"><span class="lbl">Text size<span class="sub">Scales the panels and the HUD</span></span>'+[[0.9,'S'],[1,'M'],[1.15,'L'],[1.3,'XL']].map(([v,l])=>'<button data-fx="acct:textScale:'+v+'" class="'+((a.textScale||1)===v?'claimBtn':'')+'">'+l+'</button>').join('')+'</div>'
     +'<div class="setRow"><span class="lbl">Colour vision<span class="sub">Swaps the reds, greens and golds</span></span>'+[['none','Off'],['deutan','Deutan'],['protan','Protan'],['tritan','Tritan']].map(([v,l])=>'<button data-fx="acct:cb:'+v+'" class="'+((a.cb||'none')===v?'claimBtn':'')+'">'+l+'</button>').join('')+'</div>'
     +'<div class="setRow"><span class="lbl">High contrast<span class="sub">Black text on white panels</span></span><button data-fx="acct:contrast">'+(a.contrast?'✅ On — turn off':'Off — turn on')+'</button></div>'
     +'<div class="setRow"><span class="lbl">Reduce motion<span class="sub">No panel slides or toast pops</span></span><button data-fx="acct:motion">'+(a.motion?'✅ On — turn off':'Off — turn on')+'</button></div>';
   }else if(setTab==='codes'){
    const used=Object.keys(s.codes||{});
    h+='<span style="font-size:11.5px;color:#8c7a63">Gift codes come from the ranch\'s own channels and friends. They are case-sensitive and work once per ranch; the gift lands in 📬.</span>'
     +'<div class="crow"><input id="codeIn" maxlength="24" placeholder="Enter a gift code" autocomplete="off" autocapitalize="characters"><button class="claimBtn" data-fx="acct:redeem">Redeem</button></div>'
     +(used.length?'<span style="font-size:11px;color:#8c7a63">Used: '+used.map(esc).join(', ')+'</span>':'');
   }else if(setTab==='account'){
    h+='<div class="setRow"><span class="lbl">🪪 Player ID<span class="sub">Quote it for prizes and support. It is what your friends and the club see behind your name.</span></span><b id="pidEl">'+esc(s.pid)+'</b><button data-fx="acct:copyPid">📋</button></div>'
     +'<div class="setRow"><span class="lbl">Title<span class="sub">'+esc(titleOf(s))+' · Prestige '+prestigeLevel(s)+'</span></span><span style="font-size:11px;color:#8c7a63">v'+esc(BUILD)+'</span></div>'
     +'<div class="passCard"><div class="ph"><b>⬆️ Take this ranch to another device</b></div><div class="sub">Export makes a code of your whole save (no photos). Paste it into Import on the other device, or send yourself the link.</div>'
     +'<div class="crow" style="gap:6px"><button data-fx="acct:export" id="saveExport">⬆️ Export save</button><button data-fx="acct:exportLink">🔗 Copy hand-off link</button></div><textarea id="saveBlob" readonly placeholder="Your save code appears here"></textarea></div>'
     +'<div class="passCard"><div class="ph"><b>⬇️ Load a ranch from a code</b></div><textarea id="saveImport" placeholder="Paste a save code"></textarea><div class="crow" style="gap:6px"><button data-fx="acct:import" id="saveImportGo" class="claimBtn">⬇️ Import save</button><button data-fx="acct:reset" style="margin-left:auto">🗑️ Start over</button></div></div>';
   }
   return h;
  },
  vr:{tab:'settings',label:'Settings',build(rows,sv){return 'Settings live on the flat screen: sound, graphics, controls, accessibility, gift codes and your Player ID '+(sv.pid||'')+'.';}}});
 U.action('acct',(a,el)=>{
  const op=a[0],arg=a[1];
  const rr=()=>U.rerender('settingsPanel');
  if(op==='stab'){setTab=arg;rr();}
  else if(op==='itab'){inboxTab=arg;U.rerender('inboxPanel');}
  else if(op==='mute'){if(G.audio)G.audio.setMuted(!G.audio.muted());rr();}
  else if(op==='vol'){const v=Math.max(0,Math.min(1,(+el.value||0)/100));S.sync(s=>{s.sfxVol=v;});if(G.audio)G.audio.setVol(v);rr();if(G.audio&&v>0)G.sChime();}
  else if(op==='testSound'){G.sChime();G.sCoin();}
  else if(op==='quality'){if(G.gfx)G.gfx.apply(arg);S.sync(s=>{s.quality=arg;s.qualityLocked=true;});rr();toast((G.gfx&&G.gfx.labels[arg])||('🎚️ Graphics: '+arg));}
  else if(op==='bloom'){if(G.gfx)G.gfx.setBloom(!G.gfx.bloom());rr();}
  else if(op==='autoq'){S.sync(s=>{s.qualityLocked=!s.qualityLocked;});rr();}
  else if(op==='remap'){pendingRemap=arg;rr();toast('⌨️ Press the key for '+(KEY_LABELS[arg]||arg)+' — Esc to cancel');}
  else if(op==='unmap'){remapKey(arg,T.KEYMAP[arg]);rr();}
  else if(op==='resetKeys'){for(const k of Object.keys(KEY_LABELS)){const old=liveMap[k];if(old!==T.KEYMAP[k]){liveMap[k]=T.KEYMAP[k];if(PANEL_KEYS[k])rebindPanel(k,old,T.KEYMAP[k]);else if(k==='chat')bindChat(old,T.KEYMAP[k]);}}S.sync(s=>{s.keymap={};});rr();toast('⌨️ Keys back to default.');}
  else if(op==='textScale'||op==='cb'||op==='contrast'||op==='motion'){let a=null;S.sync(s=>{if(op==='textScale')s.a11y.textScale=+arg;else if(op==='cb')s.a11y.cb=arg;else s.a11y[op]=!s.a11y[op];a=s.a11y;});if(a)applyA11y(a);rr();}
  else if(op==='redeem'){const i=$('codeIn');if(!i)return;const ok=redeemCode(i.value);if(ok){i.value='';rr();}}
  else if(op==='copyPid'){const s=S.fresh();copyText(s.pid,()=>toast('🪪 Player ID copied: '+s.pid));}
  else if(op==='export'){const b=exportBlob();const ta=$('saveBlob');if(ta)ta.value=b;copyText(b,()=>toast('⬆️ Save code copied — paste it into Import on the other device.'));}
  else if(op==='exportLink'){const url=location.origin+location.pathname+'?import='+encodeURIComponent(exportBlob());copyText(url,()=>toast('🔗 Hand-off link copied — open it on the other device.'));}
  else if(op==='import'){const ta=$('saveImport');if(ta)importBlob(ta.value);}
  else if(op==='reset'){U.confirm({title:'Start a brand-new ranch?',body:'This erases the ranch saved in THIS browser. Export it first if you want it back.',onYes(){try{localStorage.removeItem(S.KEY);}catch(e){}location.replace(location.pathname);}});}
  else if(op==='welcome'){welcomeClaim(+arg);}
  else if(op==='stake'){S.sync(s=>{if(s.stake)s.stake=false;else if((s.tickets||0)>0)s.stake=true;else toast('No race tickets — one comes with each daily gift, or trade gems for one.');});U.openEvents();U.openEvents();}
  else if(op==='gem'){buyGem(arg);}
  else if(op==='pbuy'){buyPrestige(arg);}
  else if(op==='title'){S.sync(s=>{s.prestige.title=arg==='auto'?'':arg;});U.renderLB();}
 });
 bindChat(null,liveMap.chat);
 for(const k in PANEL_KEYS)if(liveMap[k]!==T.KEYMAP[k])rebindPanel(k,T.KEYMAP[k],liveMap[k]);   // a saved remap of a panel key applies at once

 /* ---- 5c. Touch emote strip -------------------------------------------------------- */
 (function(){
  const tb=$('touch'); if(!tb||$('tEmote'))return;
  const b=document.createElement('button'); b.id='tEmote'; b.textContent='🦄'; b.title='Emotes'; tb.appendChild(b);
  const strip=document.createElement('div'); strip.id='tEmoteBar';
  strip.innerHTML=[['rear','🦄 Rear'],['bow','🙇 Bow'],['liedown','😴 Lie down'],['nuzzle','💕 Nuzzle'],['toss','🌀 Toss']].map(([k,l])=>'<button data-emo="'+k+'">'+l+'</button>').join('');
  document.body.appendChild(strip);
  b.addEventListener('pointerdown',e=>{e.preventDefault();strip.classList.toggle('on');});
  strip.querySelectorAll('[data-emo]').forEach(x=>{x.onclick=()=>{try{G.horse.horseEmote(x.dataset.emo);}catch(e){}strip.classList.remove('on');};});
 })();

 /* ---- 5d. Online panel: Player ID, version, title --------------------------------- */
 U.onlineSection(s=>'<div class="crow"><span class="lbl">🪪 Player ID</span><b id="pidOnline">'+esc(s.pid)+'</b><button data-fx="acct:copyPid" title="Copy">📋</button></div>'
  +'<span style="font-size:11px;color:#8c7a63">'+esc(titleOf(s))+' · Prestige '+prestigeLevel(s)+(hasPerk(s,'badge')&&s.prestige.owned.nameBadge?' 🎖️':'')+' · Meadowlark v'+esc(BUILD)+' · export or import this ranch under ⚙️ → Account.</span>');
 U.profileSection((name,r)=>r&&r.pb?'<div class="evrow">🎖️ <b>'+esc(r.pt||'Prestige rider')+'</b><span>a Prestige title, earned in the Basin</span></div>':'');

 /* ---- 5e. Money panel: the nine currencies and the free-income baseline ----------- */
 U.moneyRow(s=>{
  const pts=(s.pass&&s.pass.pts)||0, tier=Math.min(PASS_TIERS,Math.floor(pts/PASS_STEP));
  const rp=ranchPts(s); let rl=1; for(let i=1;i<T.RANCH_LEVELS.length;i++)if(rp>=T.RANCH_LEVELS[i])rl=i+1;
  const w=s.ww||{}; const gToday=w.d===day()?(w.gt||0):0, kToday=w.d===day()?(w.kt||0):0;
  const hist=(w.hist||[]); const gWeek=hist.reduce((a,r)=>a+(r.g||0),0)+gToday, kWeek=hist.reduce((a,r)=>a+(r.k||0),0)+kToday;
  const days=Math.max(1,hist.length+1); const gPerDay=gWeek/days; const keyDays=gPerDay>0?(ECON.keyGems/gPerDay):null;
  const cur=[['🪙',Math.floor(s.coins),'Coins','events, trails, chores'],['💎',s.gems||0,'Gems','dailies, events, chests'+(gemMul()>1?' · ×2 today':'')],['🗝️',s.keys||0,'Silver Keys','open tack chests'],['⭐',(s.sp&&s.sp.pts)||0,'Star Points','this week, for the club'],
   ['🎟️',pts,'Pass points','tier '+tier+' of '+PASS_TIERS],['🏗️',rp,'Builder points','ranch level '+rl],['🧬',s.btok||0,'Breeding tokens','one per foal'],['✨',s.dust||0,'Cosmetic dust','dyes and the wardrobe'],['🎖️',prestigePts(s),'Prestige','level '+prestigeLevel(s)+' · '+esc(titleOf(s))],['🎫',s.tickets||0,'Race tickets','double stakes']];
  return '<div class="passCard" style="margin-top:6px"><div class="ph"><b>👛 Every currency</b><span style="font-size:11px;color:#8c7a63">nine kinds, one ranch</span></div><div class="curGrid">'
   +cur.map(([i,v,l,sub])=>'<div class="curRow"><i>'+i+'</i><div><b>'+v+'</b> '+l+'<small>'+sub+'</small></div></div>').join('')+'</div>'
   +'<div class="crow" style="gap:6px;margin-top:8px"><button data-fx="shop:gems">💎 Gem exchange</button><button data-fx="open:inboxPanel">📬 Inbox</button></div></div>'
   +'<div class="passCard" style="margin-top:6px"><div class="ph"><b>💎 Free income</b><span style="font-size:11px;color:#8c7a63">target ~'+ECON.gemsPerDay+' gems a day</span></div>'
   +'<div class="evrow" style="margin-top:4px"><b>Gems today</b><span>'+gToday+'💎 · '+gWeek+'💎 this week</span></div>'
   +'<div class="evrow"><b>Keys this week</b><span>'+kWeek+'🗝️ (+'+kToday+' today)</span></div>'
   +'<div class="sub" style="margin:5px 0 0">A Silver Key is '+ECON.keyGems+'💎 at the exchange'+(keyDays!=null?' — about '+(keyDays<1?'half a day':keyDays.toFixed(1)+' days')+' of play at your pace':'')+'. Dailies pay ~'+ECON.gemsPerDay+'💎 a day with the gift and the umbrella; the double-gem weekend '+(gemMul()>1?'is on now':'is next on '+new Date(nextBonus()).toLocaleDateString())+'.</div></div>';
 });

 /* ---- 5f. Events: the bonus line and double stakes -------------------------------- */
 U.eventCard(s=>{
  const em=eventMul(s); const n=s.tickets||0;
  return '<div class="evrow" style="flex-wrap:wrap">🎫 <b>Race tickets: '+n+'</b><span>'+(s.stake?'Double stakes are ON for your next event: twice the coins and +1💎.':'Spend one to double the next event\'s coins, with a gem on top. One a day with the daily gift.')+'</span><button data-fx="acct:stake" '+(!s.stake&&n<=0?'disabled':'')+' class="'+(s.stake?'':'claimBtn')+'">'+(s.stake?'Cancel':'Double stakes')+'</button></div>'
   +(em>1?'<div class="evrow">🎖️ <b>Prestige bonus</b><span>events pay +'+Math.round((em-1)*100)+'% coins'+(isVIP(s)?' (VIP)':' at Prestige '+prestigeLevel(s))+'</span></div>':'');
 });

 /* ---- 5g. Shop: the gem exchange and the Prestige shop ---------------------------- */
 function buyGem(idk){
  const it=GEM_SHOP.find(x=>x.id===idk); if(!it)return; let ok=false;
  S.sync(s=>{if((s.gems||0)<it.g){toast('Not enough gems — that is '+it.g+'💎.');return;}s.gems-=it.g;M.payReward(s,it.r);ok=true;});
  if(ok){M.refreshWallet();G.sGem();toast('💎 '+it.label+' — yours. '+M.rewardLabel(it.r));U.openShop('gems');}
 }
 U.shopTab({id:'gems',label:'💎 Exchange',render(s){
  return '<span style="font-size:11.5px;color:#8c7a63">Gems are earned, never bought. Trade them here for the things a key, a token or a ticket does — every 10💎 spent is a Star Point for the club.</span>'
   +GEM_SHOP.map(it=>'<div class="evrow"><b>'+it.label+'</b><span>'+esc(it.sub)+'</span><button data-fx="acct:gem:'+it.id+'" '+((s.gems||0)<it.g?'disabled':'class="claimBtn"')+'>'+it.g+'💎</button></div>').join('')
   +'<span style="font-size:11px;color:#8c7a63">You have '+(s.gems||0)+'💎 · '+(s.keys||0)+'🗝️ · '+(s.btok||0)+'🧬 · '+(s.tickets||0)+'🎫 · '+(s.dust||0)+'✨</span>';
 }});
 function ensureDecorPiece(){if(!T.DECOR_CAT.gildedTrough)T.DECOR_CAT.gildedTrough={label:'Gilded trough',emoji:'✨',price:400,pts:35,prop:'trough',r:0.8,prestige:8};}
 (function(){const s=S.fresh();if(s&&s.prestige&&s.prestige.owned.gildedTrough)ensureDecorPiece();})();
 function buyPrestige(idk){
  const it=PRESTIGE_SHOP.find(x=>x.id===idk); if(!it)return; let ok=false,msg='';
  S.sync(s=>{
   if(!hasPerk(s,'shop')){msg='The Prestige shop opens at Prestige 7.';return;}
   if(prestigeLevel(s)<it.lvl&&!isVIP(s)){msg='That one waits for Prestige '+it.lvl+'.';return;}
   if(s.prestige.owned[it.id]&&it.kind!=='outfit'&&it.kind!=='title'){msg='Already yours.';return;}
   if(s.coins<(it.c||0)){msg='Not enough coins — '+it.c+'🪙.';return;} if((s.gems||0)<(it.g||0)){msg='Not enough gems — '+it.g+'💎.';return;}
   s.coins-=(it.c||0); s.gems-=(it.g||0); const first=!s.prestige.owned[it.id]; s.prestige.owned[it.id]=1;
   if(it.kind==='outfit'){s.rider=s.rider||{};s.rider[it.slot]=it.val;msg=it.label+' — worn.';}
   else if(it.kind==='tint'){s.prestige.tints[it.val]=1;s.seasonTack=s.seasonTack||{};s.seasonTack['prestige-'+it.id]=1;msg=it.label+' is in the tack locker.';}
   else if(it.kind==='decor'){msg=it.label+' is in 🏗️ Build now.';}
   else if(it.kind==='badge'){msg='🎖️ Your title shows by your name now.';}
   else if(it.kind==='title'){s.prestige.title=it.val;msg='You are '+it.val+' now.';}
   if(!first&&(it.kind==='outfit'||it.kind==='title'))msg='Worn again: '+it.label;
   ok=true;
  });
  if(ok){if(it.kind==='decor')ensureDecorPiece();M.refreshWallet();G.sGem();try{if(it.kind==='outfit')G.horse.rebuildAll();}catch(e){}}
  toast(msg); U.openShop('prestige');
 }
 U.shopTab({id:'prestige',label:'🎖️ Prestige',render(s){
  const L=prestigeLevel(s), open=hasPerk(s,'shop');
  if(!open)return '<div class="passCard"><div class="ph"><b>🔒 The Prestige shop</b></div><div class="sub">Opens at Prestige 7 — you are level '+L+' with '+prestigePts(s)+' points; the next level is at '+(P_LEVELS[L]||P_LEVELS[9])+'. Build, win ribbons, master breeds and collect trophies. See 🏅 → Prestige.</div></div>';
  return '<span style="font-size:11.5px;color:#8c7a63">Exclusive pieces for '+esc(titleOf(s))+' (Prestige '+L+'). Titles and outfit pieces can be put on again for free once owned.</span>'
   +PRESTIGE_SHOP.map(it=>{const own=!!s.prestige.owned[it.id];const locked=L<it.lvl&&!isVIP(s);const price=(it.c?it.c+'🪙':'')+(it.g?' '+it.g+'💎':'')||'free';
    return '<div class="evrow"><b>'+esc(it.label)+'</b><span>'+esc(it.sub)+' · Prestige '+it.lvl+(own?' · owned':'')+'</span><button data-fx="acct:pbuy:'+it.id+'" '+(locked||(own&&it.kind!=='outfit'&&it.kind!=='title')?'disabled':'class="claimBtn"')+'>'+(locked?'🔒':own?(it.kind==='outfit'?'Wear':it.kind==='title'?'Use':'✅'):price)+'</button></div>';}).join('');
 }});

 /* ---- 5h. Leaderboard panel: the Prestige tab and the Star Point breakdown -------- */
 U.lbTab({id:'prestige',label:'🎖️ Prestige',render(s){
  const L=prestigeLevel(s), pts=prestigePts(s), parts=prestigeParts(s), vip=isVIP(s);
  const next=L<10?P_LEVELS[L]:null, prev=P_LEVELS[L-1]; const pct=next?Math.min(100,Math.round((pts-prev)/(next-prev)*100)):100;
  let h='<div class="passCard"><div class="ph"><b>🎖️ Ranch Prestige '+L+' — '+esc(titleOf(s))+'</b><span style="font-size:11px;color:#8c7a63">'+pts+' points</span></div>'
   +'<div class="cbar" style="margin:5px 0 6px"><div class="cfill" style="width:'+pct+'%;background:#e0a93c"></div></div>'
   +'<div class="sub">'+(next?(next-pts)+' to Prestige '+(L+1)+' — '+(P_PERKS[L+1]?P_PERKS[L+1][1]:''):'The top of the track. Every perk is yours.')+'</div>'
   +'<div class="crow" style="gap:5px;flex-wrap:wrap"><span class="bE">🏗️ builder '+parts.ranch+'</span><span class="bE">🎀 ribbons ×3 = '+parts.rib+'</span><span class="bE">🐎 mastery ×10 = '+parts.mast+'</span><span class="bE">🏆 trophies ×25 = '+parts.troph+'</span><span class="bE">✨ deeds '+parts.extra+'</span></div>'
   +'<div class="sub" style="margin-top:5px">What a paid membership sells elsewhere, this ranch hands out for riding. Deeds: events +10, daily quests +5, wages +25, welcome gifts and codes +10.'+(vip?' 👑 VIP has every perk while it lasts.':'')+'</div></div>';
  h+='<div class="passCard" style="margin-top:6px"><b>Perks</b>'+Object.keys(P_PERKS).map(lv=>{const [k,l]=P_PERKS[lv];const on=hasPerk(s,k);return '<div class="evrow" style="margin-top:4px">'+(on?'✅':'🔒')+' <b>Prestige '+lv+'</b><span>'+l+'</span></div>';}).join('')+'</div>';
  if(hasPerk(s,'badge')){const opts=[['auto','Level title']].concat(P_TITLES.slice(0,L).map(t=>[t,t]));if(s.prestige.owned.elderTitle)opts.push(['Meadowlark elder','Meadowlark elder']);
   h+='<div class="passCard" style="margin-top:6px"><b>🎖️ Your title</b><div class="crow" style="gap:5px;flex-wrap:wrap;margin-top:4px">'+opts.map(([v,l])=>'<button data-fx="acct:title:'+esc(v)+'" class="'+(((s.prestige.title||'')===(v==='auto'?'':v))?'claimBtn':'')+'" style="font-size:12px;padding:4px 9px">'+esc(l)+'</button>').join('')+'</div></div>';}
  return h;
 }});
 U.lbWeekSection(s=>{
  const src=(s.sp&&s.sp.src)||{}; const pts=(s.sp&&s.sp.pts)||0; const known=Object.values(src).reduce((a,b)=>a+b,0);
  const lbl={daily:'📋 dailies',umbrella:'🌂 umbrella',forage:'🌿 foraging',tack:'🧰 tack',gems:'💎 gems spent'};
  const chips=Object.keys(src).filter(k=>src[k]).map(k=>'<span class="bE">'+(lbl[k]||k)+' '+src[k]+'</span>');
  if(pts-known>0)chips.push('<span class="bE">🏇 ribbons, levels, stats, drills, building '+(pts-known)+'</span>');
  return '<div class="passCard" style="margin-top:6px"><div class="ph"><b>⭐ Where the Star Points came from</b><span style="font-size:11px;color:#8c7a63">'+pts+' this week</span></div>'
   +'<div class="crow" style="gap:5px;flex-wrap:wrap;margin-top:4px">'+(chips.length?chips.join(''):'<span class="bE">none yet this week</span>')+'</div>'
   +'<div class="sub" style="margin-top:5px">A horse level is worth twice the new level; a stat rise, the value reached; a daily quest 10 and the umbrella 40; forage 1–4 by rarity (shop food none); a tack level, one per rarity star; a ribbon, one each (four a race); every 10💎 spent, one.</div></div>';
 });
 U.passRow(s=>{const nb=nextBonus();return '<div class="evrow">✨ <b>Double-gem weekend</b><span>'+(gemMul()>1?'on now — every gem counts twice':'next on '+new Date(nb).toLocaleDateString(undefined,{weekday:'long',month:'short',day:'numeric'})+' (season days 13–14 and 27–28)')+'</span></div>';});

 /* ---- 5i. Quests: the welcome week --------------------------------------------------- */
 (function(){
  const s=S.fresh(); if(!s||welcomeDone(s))return;
  U.questTab({id:'welcome',label:'🎁 Welcome',pos:1,render(sv){
   const w=sv.welcome; if(welcomeDone(sv))return '<div class="passCard"><div class="ph"><b>🎁 Your first week</b></div><div class="sub">All seven gifts collected. Welcome to the Basin, for good.</div></div>';
   return '<div class="passCard"><div class="ph"><b>🎁 Your first week</b><span style="font-size:11px;color:#8c7a63">day '+w.day+' of 7</span></div><div class="sub">A gift for each of your first seven days on the ranch — tap an open day to collect it. Tack goes to the locker.</div>'
    +'<div class="calGrid">'+WELCOME.map((r,i)=>{const cl=!!w.claimed[i],open=i<w.day&&!cl;return '<div class="calDay'+(cl?' done':open?' open':'')+(i===6?' big':'')+'" '+(open?'data-fx="acct:welcome:'+i+'"':'')+'><span class="dn">DAY '+(i+1)+'</span><span class="rw">'+(cl?'✅':esc(M.rewardLabel(r)))+'</span></div>';}).join('')+'</div></div>';
  }});
 })();

 /* ---- 5j. QA / other packages ------------------------------------------------------ */
 G.inbox={push:inboxPush,claim:inboxClaim,unclaimed:inboxUnclaimed,ready:readyElsewhere,news:newsItems};
 G.account={redeemCode,GIFT_CODES,NEWS,gemMul,nextBonus,hasPerk,prestigeLevel,prestigePts,titleOf,eventMul,welcomeClaim,welcomeReady,exportBlob,importBlob,applyA11y,remapKey,buyGem,buyPrestige,walletWatch:()=>S.sync(s=>walletWatch(s)),GEM_SHOP,PRESTIGE_SHOP,P_LEVELS,P_PERKS,WELCOME,ECON,BONUS_DAYS};
}

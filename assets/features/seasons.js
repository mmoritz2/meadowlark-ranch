/* Feature package 'seasons' — the spine the other two season packages hang off.
   Owned by this package: this file only. Nothing runs at import time. See index.js for the
   contract; see the sibling packages 'season-hunts' and 'season-quests' for the two halves
   that plug into the seams this file opens.

   What lives here:

     the override    ?season=bloom|sun|ember|frost (or a season number) re-phases the clock so
                     every season can be looked at today instead of in twenty-eight days. It
                     replaces G.time.seasonNow, so every package that asks G for the season
                     agrees with it; the ten inline sites in ranch3d.html call their own
                     module-scope seasonNow and cannot be made to follow — see the note there
     the pass        each of the four seasons now lays its OWN rewards over PASS_FREE/PASS_GOLD
                     (season tokens, instant XP, breeding tokens in the foal season) instead of
                     all four paying the same thirty tiers, and the headline horse sits on the
                     last tier of each track
     the free path   finish this season's weekly challenges and the gold row opens without a
                     gem. This is the whole pitch of the game — nothing behind a wall you can
                     only climb by paying — and it is one 'goldPass' listener plus a screen
                     that draws the gold slots by the same predicate the claim uses
     challenges      three per season, fed by the 'dailyEvt' hook everything already reports
                     through, banked per ISO week, counted per season
     tokens          🎟️ is a real currency now: it is painted in the wallet, it is paid by the
                     pass and by the challenges, and it is spent in
     the store       a shop shelf whose stock is this season's and whose purchases are forever —
                     an outfit that changes your rider, a tack set, a saddle tint, a piece of
                     ranch decor that turns up in build mode, and a bundle
     the slot        one card at the top of the Events panel naming this season's headline
                     activity, which asks 'specialStatus' / 'specialStart' so the hunts and
                     questline packages can own their own seasons without either of us
                     knowing what the other built
     the screen      the 🏅 panel's Season Pass tab, rewritten: the thirty tiers with every
                     reward kind legible, the week's challenges, the days left, the horses on
                     offer and what is coming back */
export const id='seasons';
export function install(G){
 const $=G.$, T=G.tables, S=G.save, M=G.money, U=G.ui;
 const toast=(...a)=>G.toast(...a);                                  // through G so a QA run can listen in
 const esc=v=>String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
 const clamp=(v,a,b)=>v<a?a:v>b?b:v;
 const P={}; G.seasons=P;                                            // this package's seam, for QA and for siblings
 const DAY=864e5, SEASON_MS=28*DAY, TIERS=30, STEP=150;

 /* ================= 1. the season override =================
    seasonNow at ranch3d.html:750 is a module-scope function declaration that ten inline sites
    call directly, so a package can never make THOSE agree with an override — the boot toast,
    the tint reward's key and the built-in pass card will keep naming the real season. What a
    package CAN do is own G.time.seasonNow, which is what every package (this one, the store in
    tack-wardrobe, the banner in market, the calendar in horse-roster) actually asks. Re-phasing
    there is enough to look at any season today, and it is the only way in without an inline
    edit, so it is the way.

    It re-PHASES rather than jumps: the real clock is shifted by whole seasons until SEASONS[n%4]
    is the one asked for, which keeps n, key, start, end, day and daysLeft all internally
    consistent — a synthetic season object with a made-up day count would be worse than no
    override at all. Bookkeeping (see realKey below) stays on the real key regardless, so a
    debug flag in the URL can never wipe a player's tokens or their banked weeks. */
 const RAW=G.time.seasonNow;
 let OVERRIDE=null;
 try{const m=/[?&]season=([a-z0-9]+)/i.exec(String(location.search||''));if(m)OVERRIDE=String(m[1]).toLowerCase();}catch(e){}
 function ovIdx(){
  if(!OVERRIDE)return -1;
  const i=T.SEASONS.findIndex(d=>d&&d.id===OVERRIDE);
  if(i>=0)return i;
  const n=parseInt(OVERRIDE,10);                                     // ?season=2 is the season index, for a sweep loop
  return isFinite(n)?((n%T.SEASONS.length)+T.SEASONS.length)%T.SEASONS.length:-1;
 }
 function sn(t){
  try{
   const real=RAW(t), i=ovIdx();
   if(i<0)return real;
   const L=T.SEASONS.length, k=real.n+(((i-(real.n%L))+L)%L);
   return k===real.n?real:RAW((t||Date.now())+(k-real.n)*SEASON_MS);
  }catch(e){ try{return RAW(t);}catch(e2){return {n:0,key:'S0',def:T.SEASONS[0]||{id:'bloom',name:'Season',emoji:'🌸',tint:'#f2a0c8',desc:''},start:0,end:0,day:1,daysLeft:28}; } }
 }
 G.time.seasonNow=sn;
 const realKey=()=>{try{return RAW().key;}catch(e){return 'S0';}};
 const sid=()=>{const d=sn().def;return (d&&d.id)||'bloom';};
 const nextDef=()=>T.SEASONS[(sn().n+1)%T.SEASONS.length]||T.SEASONS[0];
 function setOverride(v){ OVERRIDE=v?String(v).toLowerCase():null; applyPassLayer(); try{M.refreshWallet();}catch(e){} return sn(); }

 /* ================= 2. the season's own character =================
    SEASONS has five fields and no theme, and every plan in the gap file assumed one. Adding it
    here is legal, cheap and read-only for everybody else: the hunts package asks for it to
    decide which season its eggs belong to, and the questline package to pick its visitor. */
 const THEME={bloom:'breed',sun:'western',ember:'harvest',frost:'trial'};
 for(const d of T.SEASONS)if(d&&!d.theme)d.theme=THEME[d.id]||'ride';

 /* ================= 3. save shape =================
    s.tokens exists in ensureCore but a brand-new save carries key:'' — seasonRoll's first-run
    branch returns before it ever stamps one. Stamping a missing key is right; WIPING on a
    mismatch would rob a fresh player of the tokens they earned in their first hour, so the
    wipe stays where it belongs, in seasonRoll's turnover branch, and this only ever fills a
    blank. This package owns that stamp; the hunts and questline packages mint tokens through
    payReward and never touch s.tokens themselves. */
 S.ensure(s=>{
  s.tokens=s.tokens||{key:'',n:0};
  if(!s.tokens.key)s.tokens.key=realKey();
  const st=s.sn=s.sn||{};
  if(st.key==null)st.key=''; if(st.wk==null)st.wk=''; if(st.weeks==null)st.weeks=0;
  st.prog=st.prog||{}; st.paid=st.paid||{}; st.store=st.store||{};
  rollState(st); rollWeek(st);
 });
 /* A new season: the week's challenge progress and the banked weeks go, everything bought
    stays. Keyed off the REAL season so the override cannot destroy anything. */
 function rollState(st){ const k=realKey(); if(st.key===k)return false; st.key=k; st.weeks=0; st.wk=''; st.prog={}; st.paid={}; return true; }
 function rollWeek(st){ let w=''; try{w=G.time.isoWeekKey();}catch(e){return false;} if(st.wk===w)return false; st.wk=w; st.prog={}; st.paid={}; return true; }

 /* ================= 4. the weekly challenges =================
    Three a week, drawn from what the season is actually about, all of them fed by moments the
    game already reports through dailyEvt — so nothing new has to be instrumented and a player
    who simply plays the season finishes them. Finishing all three banks the week, which is
    what opens the gold row (section 6). */
 const CHALLENGES={
  bloom:[
   {id:'bl-groom',type:'groom',goal:10,icon:'🧼',label:'Groom ten horses',r:{tok:8,p:40}},
   {id:'bl-carrot',type:'carrots',goal:20,icon:'🥕',label:'Hand out twenty carrots',r:{tok:8,p:40}},
   {id:'bl-foal',type:'foalplay',goal:3,icon:'🍼',label:'Play with a foal three times',r:{tok:12,p:60}}],
  sun:[
   {id:'su-gallop',type:'gallop',goal:12,icon:'💨',label:'Twelve good gallops',r:{tok:8,p:40}},
   {id:'su-trail',type:'trail',goal:2,icon:'🥾',label:'Ride two trails out of the valley',r:{tok:8,p:40}},
   {id:'su-event',type:'event',goal:4,icon:'🏆',label:'Take four ribbons',r:{tok:12,p:60}}],
  ember:[
   {id:'em-forage',type:'forage',goal:15,icon:'🌿',label:'Forage fifteen times',r:{tok:8,p:40}},
   {id:'em-photo',type:'photo',goal:4,icon:'📷',label:'Take four photographs',r:{tok:8,p:40}},
   {id:'em-emote',type:'emote',goal:6,icon:'🎭',label:'Play six emotes for company',r:{tok:12,p:60}}],
  frost:[
   {id:'fr-train',type:'train',goal:10,icon:'🎯',label:'Ten training drills',r:{tok:8,p:40}},
   {id:'fr-care',type:'brush',goal:12,icon:'🧽',label:'Brush a horse twelve times',r:{tok:8,p:40}},
   {id:'fr-xc',type:'xc',goal:2,icon:'🌲',label:'Finish two cross-country runs',r:{tok:12,p:60}}],
 };
 const WEEK_BONUS={tok:20,p:80,g:1};
 const chalOf=()=>CHALLENGES[sid()]||CHALLENGES.bloom;
 const chalDone=(s,c)=>!!(s&&s.sn&&s.sn.paid&&s.sn.paid[c.id]);
 const chalProg=(s,c)=>Math.min(c.goal,(s&&s.sn&&s.sn.prog&&s.sn.prog[c.id])||0);
 const weekDone=s=>chalOf().every(c=>chalDone(s,c));
 /* dailyEvt fires on nearly every action in the game, so the cheap test comes first and the
    save is only opened when this season actually cares about the thing that happened. */
 G.on('dailyEvt',(type,val)=>{
  const list=chalOf();
  if(!list.some(c=>c.type===type))return;
  let crossed=null, banked=false;
  S.sync(s=>{
   const st=s.sn=s.sn||{prog:{},paid:{},store:{},weeks:0,key:'',wk:''};
   rollState(st); rollWeek(st);
   for(const c of list){
    if(c.type!==type||st.paid[c.id])continue;
    st.prog[c.id]=Math.min(c.goal,(st.prog[c.id]||0)+(val||1));
    if(st.prog[c.id]>=c.goal){ st.paid[c.id]=1; M.payReward(s,c.r); crossed=c; }
   }
   const wkTag='week:'+st.wk;
   if(crossed&&list.every(c=>st.paid[c.id])&&!st.paid[wkTag]){ st.paid[wkTag]=1; st.weeks=(st.weeks||0)+1; M.payReward(s,WEEK_BONUS); banked=true; }
  });
  if(!crossed)return;
  try{M.refreshWallet();}catch(e){}
  try{G.sChime();}catch(e){}
  toast(crossed.icon+' Seasonal challenge done: '+crossed.label+' — '+M.rewardLabel(crossed.r));
  if(banked){
   try{G.sGem();}catch(e){}
   setTimeout(()=>{try{toast('🏅 Every challenge this week — the 👑 gold track is open for the rest of '+sn().def.name+', no gems needed. '+M.rewardLabel(WEEK_BONUS));}catch(e){}},900);
  }
  rerender();
 });
 G.on('weekRoll',s=>{ if(s&&s.sn)rollWeek(s.sn); });
 G.on('seasonRoll',s=>{ if(s&&s.sn)rollState(s.sn); applyPassLayer(); });

 /* ================= 5. the pass, one table per season =================
    The thirty tiers were the same four currencies every season since the pass existed. These
    layers are laid over them at boot and re-laid when the season turns: only keys nobody else
    has claimed are written (market owns free 13 and gold 18, bond owns free 19, horse-roster
    owns free 30 and gold 20, and breeding pays its own breeding tokens on free 9/19/29 and
    gold 4/14/24 from the 'passClaim' hook), and only keys this package wrote are stripped
    again, so two packages can lay claim to the same ladder without ever fighting over a slot. */
 const PASS_LAYER={
  /* the foal season: the lightest token layer, and the only one that pays breeding tokens —
     on tiers breeding.js has not already claimed for its own passClaim listener */
  bloom:{free:[[1,{tok:4}],[4,{btok:1}],[6,{tok:6}],[11,{tok:8}],[14,{btok:1}],[16,{tok:8}],[21,{tok:10}],[24,{btok:1}],[26,{tok:12}]],
         gold:[[2,{tok:8}],[7,{tok:10}],[12,{xp:250}],[16,{tok:14}],[22,{tok:16}],[27,{tok:20}]]},
  /* the long sun: the training season, so the free track pays instant XP where the others pay coins */
  sun:{free:[[2,{tok:5}],[5,{xp:120}],[8,{tok:7}],[12,{xp:200}],[15,{tok:9}],[18,{xp:280}],[22,{tok:11}],[25,{xp:360}],[28,{tok:14}]],
       gold:[[1,{tok:9}],[6,{xp:300}],[11,{tok:12}],[15,{xp:420}],[21,{tok:16}],[26,{tok:22}]]},
  /* the festival: the store season, so this is where the tokens actually are */
  ember:{free:[[0,{tok:6}],[3,{tok:8}],[7,{tok:8}],[10,{tok:10}],[13,{tok:10}],[17,{tok:12}],[20,{tok:14}],[23,{tok:14}],[27,{tok:18}]],
         gold:[[0,{tok:10}],[5,{tok:14}],[10,{tok:16}],[14,{tok:18}],[20,{tok:22}],[25,{tok:28}]]},
  /* the trials: fewer, bigger payouts, and stat XP at the top of the gold track */
  frost:{free:[[3,{tok:7}],[8,{tok:9}],[13,{tok:11}],[18,{xp:300}],[23,{tok:14}],[28,{tok:18}]],
         gold:[[3,{tok:12}],[9,{tok:16}],[13,{xp:500}],[18,{tok:20}],[23,{sxp:{jump:400,agility:400}}],[28,{tok:26}]]},
 };
 let stamped=[];                                                     // [row,key] pairs this package wrote, so only they are stripped
 function stamp(arr,i,r){ const row=arr&&arr[i]; if(!row)return; for(const k in r){ if(row[k]==null){ row[k]=r[k]; stamped.push([row,k]); } } }
 function applyPassLayer(){
  for(const [row,k] of stamped){ try{delete row[k];}catch(e){} }
  stamped=[];
  const L=PASS_LAYER[sid()]||PASS_LAYER.bloom;
  for(const [i,r] of L.free)stamp(T.PASS_FREE,i,r);
  for(const [i,r] of L.gold)stamp(T.PASS_GOLD,i,r);
  /* The headline horses. horse-roster registered the 'seasonHorse' reward kind and already put
     the pass horse on free 30 and the deluxe on gold 20 — the guard below is what keeps this
     package honest about that rather than shipping a second copy. What was missing was a
     headline on the TOP of the gold track, which is the hardest thing in a season to reach:
     gold 30 now pays the season's limited banner horse. grantSeasonHorse routes through
     grantExclusive, which keeps one copy per horse per season key, so a player who already
     pulled it from the Season Call is not handed a duplicate — the tier simply pays its gems. */
  if((T.REWARD_KINDS||{}).seasonHorse){
   if(T.PASS_FREE[TIERS-1]&&T.PASS_FREE[TIERS-1].seasonHorse==null)T.PASS_FREE[TIERS-1].seasonHorse='pass';
   if(T.PASS_GOLD[TIERS-1]&&T.PASS_GOLD[TIERS-1].seasonHorse==null)T.PASS_GOLD[TIERS-1].seasonHorse='banner';
  }
 }
 applyPassLayer();
 /* A claimed tier that carried a horse has to put it in the pasture, not just in the save. The
    hook fires inside claimPassTier's own syncSave, so both of these are deferred a tick rather
    than reading localStorage back through the write that is still open. */
 G.on('passClaim',(sv,r)=>{
  if(!r)return;
  const horse=!!r.seasonHorse, wallet=!!(r.tok||r.btok||r.xp);
  if(!horse&&!wallet)return;
  setTimeout(()=>{try{if(horse)G.horse.reloadHorses();if(wallet)M.refreshWallet();}catch(e){}},0);
 });

 /* ================= 6. the free path to the gold row =================
    passClaim asks G.run('goldPass',sv) and takes the first truthy answer, so this composes with
    account-economy's Ranch Prestige perk rather than replacing it. What it CANNOT express is
    "eight gold tiers per completed week": the hook is handed the save and nothing else, no tier
    index, so the gate is all-or-nothing. Coarse and honest beats a half-drawn ladder. */
 const goldFree=s=>!!(s&&s.sn&&(s.sn.weeks||0)>0);
 const isVIP=s=>!!(s&&s.vip&&s.vip.until>Date.now());
 const goldOpen=s=>isVIP(s)||goldFree(s);
 G.on('goldPass',s=>goldFree(s));

 /* ================= 7. season tokens in the wallet =================
    #tokEl has been sitting in the HUD since the pass shipped and nothing has ever painted it.
    The chip is written in the house shape so ui2-hud's wallet normaliser leaves it alone, and
    it hides itself again when a player has neither tokens nor anything bought with them. */
 G.on('wallet',s=>{
  const n=(s&&s.tokens&&s.tokens.n)||0;
  const held=n>0||Object.keys((s&&s.sn&&s.sn.store)||{}).length>0;
  U.hud.stat('tokEl',held?'<i>🎟️</i><b>'+n+'</b>':'');
 });

 /* ================= 8. the season store =================
    tack-wardrobe already sells this season's clothes for tokens and has done since it shipped —
    what it never had was any way to EARN one. This shelf is the rest of the shop rather than a
    second copy of that one: the things it does not sell, plus a link to it. Everything here is
    bought once and kept for good, which is the point of a store whose stock disappears. */
 const IceMk=(g,gh,H)=>{ const {box,THREE}=H; box(1.0,0.12,1.0,'#dbeaf4',0,0.06,0,g);
  const mat=new THREE.MeshStandardMaterial({color:0x9fd8f2,roughness:0.12,metalness:0.1,transparent:true,opacity:0.72});
  for(const [sx,sy,sz,y] of [[0.44,0.52,0.44,0.44],[0.31,0.44,0.31,0.96],[0.2,0.34,0.2,1.36]]){
   const m=new THREE.Mesh(new THREE.IcosahedronGeometry(1,0),mat); m.scale.set(sx,sy,sz); m.position.y=y; g.add(m); } };
 const PoleMk=(g,gh,H)=>{ const {box,tube,blob}=H; tube(0.07,0.09,2.6,'#efe6d2',0,1.3,0,g); blob(0.15,0.15,0.15,'#ffd166',0,2.7,0,g);
  ['#f2a0c8','#ffd166','#9fd8f2','#b8e08a','#e08ac8','#fff0f6'].forEach((c,i,a)=>{
   const ang=i/a.length*Math.PI*2, rb=box(0.06,1.9,0.03,c,Math.cos(ang)*0.42,1.22,Math.sin(ang)*0.42,g);
   rb.rotation.y=-ang; rb.rotation.z=Math.cos(ang)*0.17; rb.rotation.x=-Math.sin(ang)*0.17; }); };
 const AwningMk=(g,gh,H)=>{ const {box,tube}=H;
  for(const x of [-1.15,1.15])for(const z of [-0.9,0.9])tube(0.05,0.065,2.1,'#8a6a45',x,1.05,z,g);
  const top=box(2.6,0.1,2.15,'#e8c070',0,2.14,0,g); top.rotation.z=0.05;
  box(2.7,0.07,0.26,'#c85a3a',0,2.2,-1.02,g); box(2.7,0.07,0.26,'#c85a3a',0,2.2,1.02,g); };
 const ArchMk=(g,gh,H)=>{ const {box,tube,THREE}=H;
  for(const x of [-0.95,0.95])tube(0.06,0.085,2.3,'#3a2a1d',x,1.15,0,g);
  box(2.2,0.13,0.15,'#3a2a1d',0,2.33,0,g);
  for(const x of [-0.6,0,0.6]){ box(0.22,0.26,0.22,'#5a3a20',x,2.02,0,g);
   if(!gh){ const m=new THREE.Mesh(new THREE.SphereGeometry(0.09,10,8),new THREE.MeshStandardMaterial({color:0xffb347,emissive:0xff7a1a,emissiveIntensity:1.7,roughness:0.5})); m.position.set(x,2.0,0); g.add(m); } } };

 const STORE={
  bloom:[
   {id:'bloom-silks',kind:'outfit',slot:'shirt',col:'#e86aa6',cost:26,label:'Orchard racing silks',blurb:'a shirt cut for the blossom meets'},
   {id:'bloom-tint',kind:'tint',cost:40,label:'Blossom saddle paint',blurb:'the season colour, free on every saddle from now on'},
   {id:'bloom-maypole',kind:'decor',cost:55,label:'Ribbon maypole',emoji:'🎀',pts:14,r:0.8,mk:PoleMk,blurb:'a pole and six ribbons for the yard'},
   {id:'bloom-set',kind:'tack',set:'Petalfall',cost:120,label:'Petalfall tack set',blurb:'four Epic pieces — jump and agility'},
   {id:'bloom-btok',kind:'pay',r:{btok:2},cost:35,label:'Two breeding tokens',blurb:'a free pairing each at Marta\'s barn'}],
  sun:[
   {id:'sun-duster',kind:'outfit',slot:'pants',col:'#8a5a2b',cost:26,label:'Trail duster breeches',blurb:'canvas, and the dust does not show'},
   {id:'sun-tint',kind:'tint',cost:40,label:'Long Sun saddle paint',blurb:'the season colour, free on every saddle from now on'},
   {id:'sun-awning',kind:'decor',cost:55,label:'Shade awning',emoji:'⛱️',pts:14,r:1.2,mk:AwningMk,blurb:'somewhere out of the sun for the yard'},
   {id:'sun-set',kind:'tack',set:'Longsun',style:'western',cost:120,label:'Longsun tack set',blurb:'four Epic Western pieces — speed and stamina'},
   {id:'sun-tix',kind:'pay',r:{tickets:3},cost:30,label:'Three race tickets',blurb:'stake a race for double, three times over'}],
  ember:[
   {id:'ember-cloak',kind:'outfit',slot:'shirt',col:'#8f2b1f',cost:26,label:'Festival cloak',blurb:'for standing about the braziers'},
   {id:'ember-tint',kind:'tint',cost:40,label:'Ember saddle paint',blurb:'the season colour, free on every saddle from now on'},
   {id:'ember-arch',kind:'decor',cost:55,label:'Lantern arch',emoji:'🏮',pts:16,r:1.1,mk:ArchMk,blurb:'three lit lanterns over a gateway'},
   {id:'ember-set',kind:'tack',set:'Emberfall',cost:120,label:'Emberfall tack set',blurb:'four Epic pieces — acceleration and speed'},
   {id:'ember-keys',kind:'pay',r:{k:2,dust:60},cost:32,label:'Two keys and a purse of dust',blurb:'for the loot doors and the wardrobe'}],
  frost:[
   {id:'frost-parka',kind:'outfit',slot:'helmet',col:'#5b8fb8',cost:26,label:'Frostpine hood',blurb:'lined, and it fits over a helmet'},
   {id:'frost-tint',kind:'tint',cost:40,label:'Frost saddle paint',blurb:'the season colour, free on every saddle from now on'},
   {id:'frost-ice',kind:'decor',cost:55,label:'Ice sculpture',emoji:'🧊',pts:16,r:0.7,mk:IceMk,blurb:'it does not melt; this is a video game'},
   {id:'frost-set',kind:'tack',set:'Rimewalk',cost:120,label:'Rimewalk tack set',blurb:'four Epic pieces — jump and stamina'},
   {id:'frost-sp',kind:'pay',r:{sp:60,g:2},cost:30,label:'A purse of star points',blurb:'sixty for the club board, and two gems'}],
 };
 const ALL_ITEMS=[].concat(...Object.keys(STORE).map(k=>STORE[k]));
 const itemById=id=>ALL_ITEMS.find(i=>i.id===id)||null;
 const inSeason=it=>(STORE[sid()]||[]).indexOf(it)>=0;
 /* Each season's tack set is a real set: the saddle takes its tint, and two or four pieces pay
    the same bonus every Epic set in the game pays. SET_KEYS is inline and private so these do
    not appear in the Tack tab's "Epic: …" list — gearSet() reads item.set and finds them. */
 const SET_STATS={Petalfall:['jump','agility'],Longsun:['speed','stamina'],Emberfall:['accel','speed'],Rimewalk:['jump','stamina']};
 for(const k in SET_STATS){
  if(T.TACK_SETS[k])continue;
  const st=SET_STATS[k], d=T.SEASONS.find(x=>x.id===({Petalfall:'bloom',Longsun:'sun',Emberfall:'ember',Rimewalk:'frost'})[k]);
  T.TACK_SETS[k]={rarity:'Epic',stats:st,primary:st[0],secondary:st[1],tertiary:null,style:k,tint:(d&&d.tint)||'#c9b083',
   two:{[st[0]]:2},four:{[st[0]]:3,[st[1]]:2},blurb:'the season\'s own leather',western:k==='Longsun'};
 }
 /* A piece of decor becomes a catalogue entry the moment it is BOUGHT, never before: the Build
    panel prices from the catalogue, and a piece already paid for in tokens must not then ask a
    player for coins. It lands on the Yard shelf rather than the Seasonal one on purpose —
    ranch.js hides an out-of-season seasonal piece you have not placed yet, and "what you bought
    stays yours" has to survive the turn of the season with the piece still in the list. */
 const decorKey=it=>'sn_'+String(it.id).replace(/-/g,'_');
 function registerDecor(it){
  const k=decorKey(it);
  if(!T.DECOR_CAT[k])T.DECOR_CAT[k]={label:it.label,emoji:it.emoji||'🎀',price:0,pts:it.pts||12,r:it.r||0.6,cat:'yard',mk:it.mk,season:null};
  return k;
 }
 function registerOwnedDecor(s){
  const owned=(s&&s.sn&&s.sn.store)||{};
  for(const id in owned){const it=itemById(id);if(it&&it.kind==='decor')registerDecor(it);}
 }
 const owns=(s,it)=>!!(s&&s.sn&&s.sn.store&&s.sn.store[it.id]);
 function buy(id){
  const it=itemById(id); if(!it)return false;
  let msg='', ok=false, touched='';
  S.sync(s=>{
   const st=s.sn=s.sn||{prog:{},paid:{},store:{},weeks:0,key:'',wk:''};
   rollState(st); rollWeek(st);
   if(st.store[it.id]){msg='Already yours — and yours it stays.';return;}
   if(!inSeason(it)){msg='🔒 That shelf belongs to another season.';return;}
   s.tokens=s.tokens||{key:'',n:0};
   if((s.tokens.n||0)<it.cost){msg='Not enough season tokens — '+it.cost+'🎟️ needed, you have '+(s.tokens.n||0)+'. They come from the pass and the weekly challenges.';return;}
   s.tokens.n-=it.cost; st.store[it.id]=Date.now();
   if(it.kind==='outfit'){
    s.wardrobe=s.wardrobe||{owned:{},worn:{}}; s.wardrobe.owned=s.wardrobe.owned||{};
    s.wardrobe.owned['sn:'+it.id]=1;                                 // namespaced so it can never collide with tack-wardrobe's ids
    s.rider=s.rider||{}; s.rider[it.slot]=it.col; touched='rider';
   }else if(it.kind==='tint'){
    s.seasonTack=s.seasonTack||{}; s.seasonTack[sid()]=1;            // the same unlock gold tier 30 pays: the colour is free in the Tack tab for ever
    const h=(s.horses||[])[G.horse.rideIdx()]; if(h)h.tack=sn().def.tint;
    touched='tack';
   }else if(it.kind==='tack'){
    s.tack=s.tack||[];
    for(const sl of T.GEAR_SLOTS)s.tack.push(G.horse.genGear('Epic',sl,{set:it.set,style:it.style||'english'}));
    touched='gear';
   }else if(it.kind==='pay'){ M.payReward(s,it.r); }
   ok=true; msg='🛍️ '+it.label+' — yours to keep.';
  });
  if(ok){
   if(it.kind==='decor'){registerDecor(it);msg+=' It is on the 🪵 Yard shelf in the Build panel.';}
   try{
    if(touched==='rider'){const R=G.horse.player.rider;if(!(R&&G.wardrobe&&G.wardrobe.applyRiderLook&&G.wardrobe.applyRiderLook(R,G.wardrobe.fitOf(S.fresh()))))G.horse.reloadHorses();}
    if(touched==='tack'){G.horse.dressSaddle();G.horse.reloadHorses();}
    if(touched==='gear')G.horse.refreshTack();
   }catch(e){}
   try{M.refreshWallet();G.sGem();}catch(e){}
  }
  if(msg)toast(msg);
  rerender();
  return ok;
 }
 function storeHtml(s){
  const now=sn(), d=now.def, items=STORE[d.id]||[], tok=(s.tokens&&s.tokens.n)||0;
  let html='<div class="evrow">'+d.emoji+' <b>'+esc(d.name)+' · store</b><span style="font-size:11px">'+esc(d.desc)+' The shelf changes when the season does in '+now.daysLeft+' day'+(now.daysLeft===1?'':'s')+'; what you buy never does.</span><span style="flex:none">🎟️ <b>'+tok+'</b></span></div>';
  html+=items.map(it=>{
   const own=owns(s,it), afford=tok>=it.cost;
   const swatch=it.kind==='outfit'||it.kind==='tint'
    ? '<span style="flex:none;width:14px;height:14px;border-radius:50%;background:'+(it.col||d.tint)+'"></span> '
    : (it.emoji?it.emoji+' ':it.kind==='tack'?'🐎 ':'🎁 ');
   return '<div class="evrow'+(own?' done':'')+'">'+swatch+'<b>'+esc(it.label)+'</b><span style="font-size:11px">'+esc(it.blurb)+'</span>'
    +'<span style="flex:none">'+(own?'<span style="font-size:11px;color:#8c7a63">owned ✓</span>'
      :'<button data-fx="sn:buy:'+esc(it.id)+'"'+(afford?' class="claimBtn"':' disabled')+'>'+it.cost+' 🎟️</button>')+'</span></div>';
  }).join('');
  html+='<div class="crow" style="gap:6px;margin-top:6px;flex-wrap:wrap">'
   +'<button data-fx="sn:outfits">🛍️ '+d.emoji+' Season clothes</button>'
   +'<button data-fx="sn:track">🗓️ Season track</button>'
   +'<span style="font-size:11px;color:#8c7a63">🎟️ comes from pass tiers, the three weekly challenges and season activities.</span></div>';
  const bought=Object.keys((s.sn&&s.sn.store)||{}).length;
  if(bought)html+='<div style="font-size:11px;color:#8c7a63;margin-top:4px">'+bought+' thing'+(bought===1?'':'s')+' bought across every season so far — all of it still yours.</div>';
  return html;
 }
 U.shopTab({id:'season',label:'🎟️ Season',pos:4,render(s){return storeHtml(s);}});

 /* ================= 9. the special-event slot =================
    One card at the top of the Events panel — sect('eventCard') splices above the week tiers,
    the roundup and the drills, and the hoist below takes it past the sections events-pvp
    registered first. It names what this season is FOR. The hunts package and the questline
    package own the activities themselves, so this card asks rather than knows:
    G.run('specialStatus',id,s) for a line and G.run('specialStart',id) for the button. Nobody
    answering is the normal case in a tree where only this package has landed, and the fallback
    below has to be worth pressing on its own. */
 const SPECIAL={
  bloom:{id:'bloom-foals',icon:'🌸',label:'The Foal Festival',blurb:'the low field is full of foals, and Marta is pairing for anyone who asks',
   go(){U.openShop('breed');return '💞 Marta\'s foaling barn is open.';},
   status(s){const n=(s.life&&s.life.breed)||0;return n?'🍼 '+n+' foal'+(n===1?'':'s')+' raised here so far.':'🍼 No foals yet — two horses at 60 bond is all it takes.';}},
  sun:{id:'sun-roundup',icon:'☀️',label:'The Long Sun Roundup',blurb:'loose horses on the flats and the canyon herd carrying coats you will not see again',
   go(){try{G.course.startRoundup();return '🤠 Bring them in!';}catch(e){U.openEvents();return '';}},
   status(s){const n=(s.stats&&s.stats.tamedWild)||0;return n?'🐎 '+n+' wild horse'+(n===1?'':'s')+' gentled.':'🐎 No wild horses gentled yet — carrots, and patience.';}},
  ember:{id:'ember-festival',icon:'🍂',label:'The Harmony Festival',blurb:'lanterns down the valley, a visitor with something to ask, and everybody dancing at once',
   go(){U.openQuests();return '📜 See what the festival wants of you.';},
   status(s){const n=(s.life&&s.life.emote)||0;return n>=6?'🎭 You have played your part in the festival.':'🎭 '+n+' of 6 emotes played for company this season.';}},
  frost:{id:'frost-trials',icon:'❄️',label:'The Dragon Trials',blurb:'one mixed gauntlet against the clock, and four houses arguing over who rides it best',
   go(){const ev=(T.EVENTS3||[]).find(e=>e.id==='gt');if(ev){try{G.course.startCourse(ev);return '🐉 '+ev.name+' — ride!';}catch(e){}}U.openEvents();return '';},
   status(s){const rb=(s.ribbons&&s.ribbons.gt)||0;return rb?'🎀 '+rb+' ribbon'+(rb===1?'':'s')+' from the gauntlet.':'🎀 The gauntlet is waiting — no ribbons from it yet.';}},
 };
 P.specialStarts=0; P.specialHandled=0;
 const specialOf=()=>SPECIAL[sid()]||SPECIAL.bloom;
 function startSpecial(){
  const sp=specialOf(); P.specialStarts++;
  let taken=null;
  try{taken=G.run('specialStart',sp.id);}catch(e){}
  if(taken){P.specialHandled++;G.hidePanels();return true;}
  let msg=''; try{G.hidePanels();msg=sp.go()||'';}catch(e){}
  if(msg)toast(msg);
  return false;
 }
 function specialStatus(s){
  let line=null;
  try{line=G.run('specialStatus',specialOf().id,s);}catch(e){}
  if(typeof line==='string'&&line)return line;
  try{return specialOf().status(s)||'';}catch(e){return '';}
 }
 U.eventCard((s)=>{
  try{
   const now=sn(), d=now.def, sp=specialOf(), nx=nextDef();
   return '<div class="passCard" id="snSpecialCard">'
    +'<div class="ph"><b>'+sp.icon+' '+esc(sp.label)+'</b><span style="font-size:11px;color:#8c7a63">'+d.emoji+' day '+now.day+' of 28 · '+now.daysLeft+' left</span></div>'
    +'<div class="sub">'+esc(sp.blurb)+'</div>'
    +'<div class="sub" style="margin:3px 0 0;color:#4a3526">'+specialStatus(s)+'</div>'
    +'<div class="crow" style="gap:6px;margin-top:5px;flex-wrap:wrap"><button data-fx="sn:special" class="claimBtn">'+sp.icon+' Take part</button>'
    +'<button data-fx="sn:track">🗓️ Season track</button><button data-fx="sn:shop">🎟️ Store</button></div>'
    +'<div class="sub" style="margin:4px 0 0">Next: '+nx.emoji+' <b>'+esc(nx.name)+'</b> in '+now.daysLeft+' day'+(now.daysLeft===1?'':'s')+'.</div>'
    +'</div>';
  }catch(e){return '';}
 });
 /* The eventCard slot is spliced above the week tiers, the roundup and the drills — but six
    sections from events-pvp were registered into it before this package was installed, and a
    registry that concatenates in install order has no way to say "before you". The card is
    hoisted after the fact instead: one observer, one move per render, no move when it is
    already in place, and it gives up quietly if the panel is not shaped as expected. */
 (function hoistSpecialCard(){
  const p=$('eventsPanel'); if(!p||typeof MutationObserver!=='function')return;
  let moving=false;
  const hoist=()=>{
   if(moving)return;
   const card=p.querySelector('#snSpecialCard'); if(!card)return;
   const head=p.firstElementChild;
   if(!head||head===card||card.previousElementSibling===head)return;
   moving=true; try{head.after(card);}catch(e){} moving=false;
  };
  try{new MutationObserver(hoist).observe(p,{childList:true});}catch(e){}
 })();

 /* ================= 10. the season track screen =================
    This OVERRIDES the built-in 'pass' tab rather than adding a row above it, and it does so for
    one reason: the built-in strip draws a gold slot as claimable only when isVIP, so a player
    who earned the gold row by finishing their challenges would be looking at thirty padlocks
    over a claim that would in fact have gone through. Two screens disagreeing about what you
    are allowed to do is worse than one screen nobody redesigned.

    What that costs: sect('passRow',s) is inside the !xl branch, so overriding drops it, and the
    only registered passRow today is account-economy's double-gem weekend line. It is re-drawn
    below from that package's own exported accessors rather than reimplemented — if the package
    is not there, the row is not there, and nothing throws.

    The claim buttons are the engine's: renderLB binds [data-pass] and [data-gold] after the
    tab renders, unconditionally, so emitting the same attributes keeps every claim path,
    including the toast and the re-render, exactly as it was. */
 const passPts=s=>(s&&s.pass&&s.pass.pts)||0;
 const passTier=s=>clamp(Math.floor(passPts(s)/STEP),0,TIERS);
 function tierLabel(r){
  if(!r)return '—';
  let out='';
  try{out=M.rewardLabel(r)||'';}catch(e){}
  if(r.tack)out+=' ✨golden tack';
  if(r.tint)out+=' '+sn().def.emoji+' tack tint';
  out=out.trim();
  return out||'—';
 }
 function challengeCard(s){
  const list=chalOf(), done=list.filter(c=>chalDone(s,c)).length, weeks=(s.sn&&s.sn.weeks)||0, open=goldOpen(s);
  return '<div class="passCard" style="margin-top:6px">'
   +'<div class="ph"><b>🗒️ This week\'s challenges</b><span style="font-size:11px;color:#8c7a63">'+done+' of '+list.length+' done · '+weeks+' week'+(weeks===1?'':'s')+' banked this season</span></div>'
   +list.map(c=>{
     const p=chalProg(s,c), ok=chalDone(s,c);
     return '<div class="evrow'+(ok?' done':'')+'">'+(ok?'✅':c.icon)+' <b>'+esc(c.label)+'</b>'
      +'<span>'+p+' / '+c.goal+' · '+esc(M.rewardLabel(c.r))+'</span>'
      +'<span style="flex:none;width:92px"><span class="cbar" style="display:block"><span class="cfill" style="display:block;height:100%;width:'+Math.round(p/c.goal*100)+'%;background:'+sn().def.tint+'"></span></span></span></div>';
    }).join('')
   +'<div class="sub" style="margin:4px 0 0;color:'+(open?'#3a7a3a':'#8c7a63')+'"><b>'+(open?'👑 The gold track is open.':'👑 The gold track is shut.')+'</b> '
   +(isVIP(s)?'Your VIP membership opens it.'
     :goldFree(s)?'You finished a week of challenges, so it is open for the rest of '+esc(sn().def.name)+' — no gems went anywhere near it.'
     :'Finish all three challenges in any one week and it opens for the rest of the season. That is the whole price; VIP is the shortcut, not the gate.')+'</div>'
   +'<div class="sub" style="margin:3px 0 0">Finishing the week also pays '+esc(M.rewardLabel(WEEK_BONUS))+'.</div>'
   +'</div>';
 }
 function horsesCard(s){
  const R=G.horse&&G.horse.roster;
  if(!R||!R.seasonHorses)return '';
  let html='', now=sn();
  try{
   const SH=R.seasonHorses(now.def.id)||{}, owned=k=>(s.horses||[]).some(h=>h.breed===k);
   const lbl=k=>{try{return G.horse.breedLabel(k)||k;}catch(e){return k;}};
   const rows=[['pass','🎟️ free track · tier 30',SH.pass],['deluxe','👑 gold track · tier 20',SH.deluxe],['banner','👑 gold track · tier 30, or the Season Call',SH.banner]]
    .filter(r=>r[2]);
   if(!rows.length)return '';
   html='<div class="passCard" style="margin-top:6px"><div class="ph"><b>🐴 '+esc(now.def.name)+' horses</b><span style="font-size:11px;color:#8c7a63">three a season, every one of them earned</span></div>'
    +rows.map(([role,how,k])=>'<div class="evrow'+(owned(k)?' done':'')+'">'+(owned(k)?'✅':'🐴')+' <b>'+esc(lbl(k))+'</b><span>'+how+(owned(k)?' · yours':'')+'</span></div>').join('');
   /* What is coming back. horse-roster runs the encore pool; this only says so out loud. */
   const back=returningHorses(s);
   if(back.length)html+='<div class="sub" style="margin:4px 0 0">Returning this season: <b>'+back.map(b=>esc(lbl(b.key))).join(', ')+'</b> — missed banner horses from an earlier season, back in the Season Call at 40%.</div>';
   html+='</div>';
  }catch(e){return '';}
  return html;
 }
 /* Banner horses from the last three seasons that this save never got. horse-roster's seasonCall
    already draws from exactly this pool; the player was simply never told. */
 function returningHorses(s){
  const R=G.horse&&G.horse.roster; if(!R||!R.seasonInfo)return [];
  const out=[], now=sn(), ex=(s&&s.roster&&s.roster.exclusives)||{}, mine=s&&s.horses||[];
  for(let n=Math.max(0,now.n-3);n<now.n;n++){
   let I=null; try{I=R.seasonInfo(n);}catch(e){continue;}
   const k=I&&I.horses&&I.horses.banner; if(!k||out.some(o=>o.key===k))continue;
   if(mine.some(h=>h.breed===k))continue;
   if(Object.keys(ex).some(t=>t.indexOf(k+':')===0))continue;
   out.push({key:k,n});
  }
  return out;
 }
 function gemWeekendRow(){
  /* account-economy's passRow, redrawn from its own seam because overriding this tab drops the
     section it was spliced into. No package, no row. */
  try{
   const A=G.account; if(!A||!A.gemMul||!A.nextBonus)return '';
   const on=A.gemMul()>1, nb=A.nextBonus();
   return '<div class="evrow">✨ <b>Double-gem weekend</b><span>'+(on?'on now — every gem counts twice'
    :'next on '+new Date(nb).toLocaleDateString(undefined,{weekday:'long',month:'short',day:'numeric'})+' (season days 13–14 and 27–28)')+'</span></div>';
  }catch(e){return '';}
 }
 function trackHtml(s){
  const now=sn(), d=now.def, pts=passPts(s), tier=passTier(s);
  const claims=(s.pass&&s.pass.claims)||{}, golds=(s.pass&&s.pass.gold)||{};
  const open=goldOpen(s), tok=(s.tokens&&s.tokens.n)||0, nx=nextDef();
  let html=gemWeekendRow();
  html+='<div class="passCard">'
   +'<div class="ph"><b>'+d.emoji+' '+esc(d.name)+'</b><span style="font-size:11px;color:#8c7a63">day '+now.day+' of 28 · '+now.daysLeft+' day'+(now.daysLeft===1?'':'s')+' left · 🎟️ '+tok+'</span></div>'
   +'<div class="sub">'+esc(d.desc)+'</div>'
   +'<div class="ph" style="margin-top:4px"><b>🎟️ Season Pass — tier '+tier+'/'+TIERS+'</b><span style="font-size:11px;color:#8c7a63">'+pts+' pts · '+(STEP-(pts%STEP))+' to tier '+Math.min(TIERS,tier+1)+'</span></div>'
   +'<div class="cbar" style="margin:5px 0 2px"><div class="cfill" style="width:'+Math.min(100,(pts%STEP)/STEP*100)+'%;background:'+d.tint+'"></div></div>'
   +'<div class="passStrip">'+T.PASS_FREE.map((r,i)=>{
     const gr=T.PASS_GOLD[i], up=tier>=i+1;
     const fs=claims[i]?'<div class="tslot done">✅</div>'
       :up?'<div class="tslot free"><button data-pass="'+i+'">'+tierLabel(r)+'</button></div>'
          :'<div class="tslot free lock">'+tierLabel(r)+'</div>';
     const gs=golds[i]?'<div class="tslot done">✅</div>'
       :(open&&up)?'<div class="tslot gold"><button data-gold="'+i+'">'+tierLabel(gr)+'</button></div>'
          :'<div class="tslot gold lock">'+(open?'':'🔒')+tierLabel(gr)+'</div>';
     return '<div class="tierCard'+(i===tier?' now':'')+'"><div class="tierNo">TIER '+(i+1)+'</div>'+fs+gs+'</div>';
    }).join('')+'</div>'
   +'<div class="sub" style="margin:2px 0 0">Top row free · bottom row 👑 gold'+(open?' — open to you':' — finish a week of challenges to open it')+'. '
   +esc(d.name)+' pays its own tiers: no two seasons run the same thirty.</div>'
   +'<div class="crow" style="gap:6px;margin-top:5px;flex-wrap:wrap"><button data-fx="sn:shop">🎟️ Season store</button><button data-fx="sn:events">'+specialOf().icon+' '+esc(specialOf().label)+'</button></div>'
   +'</div>';
  html+=challengeCard(s);
  html+=horsesCard(s);
  const prev=s.pass&&s.pass.prev;
  html+='<div class="sub" style="margin:6px 0 0">'
   +(prev?'Last season you finished '+esc(prev.key)+' on tier '+(prev.tier||0)+' with '+(prev.pts||0)+' points. ':'')
   +'Next season is '+nx.emoji+' <b>'+esc(nx.name)+'</b>. Points reset when it turns; tokens do too — spend them.</div>';
  return html;
 }
 U.lbTab({id:'pass',label:'🎟️ Season Pass',render(s){try{return trackHtml(s);}catch(e){console.error('season track',e);return '<div class="sub">The season screen could not be drawn just now.</div>';}}});

 /* A panel of its own, so the screen has somewhere to live that is not a tab — and so the
    headset has a season page at all. drawVRList dispatches vrPage==='pass' to the inline
    buildVRPass BEFORE it consults VR_BUILDERS, and vrListRow/vrButton/c0 are module-private,
    so the built-in VR pass page cannot be repainted from here; what it CAN do is say the true
    state of the gold track on a page of this package's own. */
 U.panel({id:'seasonPanel',title:'🗓️ Season',render(p,s){
   return '<div class="ph"><b style="font-size:16px">🗓️ '+esc(sn().def.name)+'</b><button data-fx="close:seasonPanel" style="margin-left:auto">✖</button></div>'+trackHtml(s);
  },
  vr:{tab:'season',label:'Season',build(rows,sv){
   try{
    const now=sn(), s=sv||{}, list=chalOf(), done=list.filter(c=>chalDone(s,c)).length;
    return now.def.emoji+' '+now.def.name+' — day '+now.day+' of 28, '+now.daysLeft+' left\n'
     +'Tier '+passTier(s)+' of '+TIERS+'   ·   '+passPts(s)+' points   ·   '+((s.tokens&&s.tokens.n)||0)+' season tokens\n'
     +'Weekly challenges: '+done+' of '+list.length+' done, '+((s.sn&&s.sn.weeks)||0)+' week(s) banked\n'
     +(goldOpen(s)?'The gold track is OPEN'+(isVIP(s)?' (VIP).':' — you earned it with the challenges.')
        :'The gold track is shut — finish a week of challenges to open it.')+'\n'
     +'Claim tiers on the flat 🏅 panel; the headset pass page still reads VIP only.';
   }catch(e){return 'Season information is not available just now.';}
  }}});

 /* ================= 11. actions ================= */
 function rerender(){
  try{const lp=$('lbPanel'); if(lp&&lp.style.display==='flex')U.renderLB();}catch(e){}
  try{const sp=$('shopPanel'); if(sp&&sp.style.display==='flex'&&sp.querySelector('[data-fx^="sn:buy:"]'))U.openShop('season');}catch(e){}
  try{const p=$('seasonPanel'); if(p&&p.style.display==='flex')U.rerender('seasonPanel');}catch(e){}
 }
 function openTrack(){ G.hidePanels(); U.open('seasonPanel'); }
 U.action('sn',(a)=>{
  const op=a[0];
  if(op==='buy')buy(a.slice(1).join(':'));
  else if(op==='special')startSpecial();
  else if(op==='track')openTrack();
  else if(op==='shop')U.openShop('season');
  else if(op==='events')U.openEvents();
  else if(op==='outfits'){
   /* tack-wardrobe's clothes shelf is an LB tab, not a shop tab; this is the one route to it. */
   G.hidePanels(); U.openLB();
   try{const b=$('lbPanel')&&$('lbPanel').querySelector('[data-lbtab="store"]'); if(b)b.click(); else toast('The season clothes shelf is not installed.');}catch(e){}
  }
 });

 /* ================= 12. boot, the encore notice and the state dump ================= */
 G.on('boot',s=>{
  applyPassLayer();
  try{S.sync(sv=>{const st=sv.sn=sv.sn||{prog:{},paid:{},store:{},weeks:0,key:'',wk:''};rollState(st);rollWeek(st);});}catch(e){}
  try{registerOwnedDecor(S.fresh());}catch(e){}
  try{M.refreshWallet();}catch(e){}
  /* A horse you missed is back in the pool this season — say so once, and only once. */
  try{
   const back=returningHorses(S.fresh()||{});
   if(!back.length)return;
   let tell=false;
   S.sync(sv=>{tell=S.flag(sv,'encore-'+back[0].key+'-'+sn().key);});
   if(tell)setTimeout(()=>{try{
    const names=back.map(b=>{try{return G.horse.breedLabel(b.key);}catch(e){return b.key;}});
    toast('✨ Back in the Season Call this season: '+names.join(', ')+' — a horse you never got.');
   }catch(e){}},2600);
  }catch(e){}
 });
 G.on('state',o=>{
  try{
   const s=S.fresh()||{}, now=sn(), list=chalOf();
   o.season={id:now.def.id,key:now.key,n:now.n,day:now.day,daysLeft:now.daysLeft,override:OVERRIDE||null,
    tier:passTier(s),pts:passPts(s),tokens:(s.tokens&&s.tokens.n)||0,tokenKey:(s.tokens&&s.tokens.key)||'',
    weeks:(s.sn&&s.sn.weeks)||0,weekDone:weekDone(s),goldOpen:goldOpen(s),goldFree:goldFree(s),
    bought:Object.keys((s.sn&&s.sn.store)||{}).length,
    challenges:list.map(c=>({id:c.id,prog:chalProg(s,c),goal:c.goal,done:chalDone(s,c)}))};
  }catch(e){}
 });

 /* ================= 13. the seam ================= */
 Object.assign(P,{now:sn,raw:RAW,realKey,override:setOverride,overrideId:()=>OVERRIDE,
  CHALLENGES,challenges:chalOf,progress:chalProg,challengeDone:chalDone,weekDone,WEEK_BONUS,
  goldOpen,goldFree,PASS_LAYER,applyPassLayer,tierLabel,
  STORE,items:()=>STORE[sid()]||[],item:itemById,owns:it=>owns(S.fresh()||{},typeof it==='string'?{id:it}:it),buy,decorKey,
  SPECIAL,special:specialOf,startSpecial,specialStatus,
  trackHtml,storeHtml,openTrack,returning:()=>returningHorses(S.fresh()||{})});
}

/* Feature package 'market-summon-keys-pets' — how a horse, a pet or a piece of finery
   actually reaches you.

   What lives here:
     · the Market hub — the shop grows a ✨ Summon tab, a 📖 Catalogue tab, a 🔐 Doors tab
       and a 🎁 Free & Wallet tab (the Basin Exchange, the free weekly key, membership,
       furniture and the ranch, all one click from the dock);
     · seven summoning stables — the three basin calls plus the Winged, Mystic, Majestic,
       Dragonfire and Painted stables and a seasonal limited banner — every one of them with
       printed odds, a visible pity counter, a rate-up horse and the first-thirty no-repeat
       promise;
     · the Painted Stable: a four-star statline in a coat rolled for that horse alone;
     · Pets of the Basin — twelve companions, a pet call with its own published odds, pets
       on the pass and in the collectible sets, and three horse-and-pet pairs that light each
       other up when they stand side by side;
     · five Silver Key doors across Kestrel Basin, each with its loot table printed before
       you spend the key, and the ✨ cosmetic dust they pay out;
     · the dust economy: doors and chests make it, the wardrobe and the style room spend it,
       and every 10 dust spent is a Star Point for the club.

   Owned by this package: this file, SUMMON_TIERS/summonPool/startSummon's draw hooks, the
   key-door things, PETS3 and the shop tabs listed above. Nothing runs at import time. */
export const id='market-summon-keys-pets';

/* ---------------------------------------------------------------------------------------
   DATA
   --------------------------------------------------------------------------------------- */
const NODUP=30;                        // the first thirty calls at a basin stable never repeat a breed

/* The seven stables. pool(b) narrows the rarity draw to a themed stable; featured is the
   rate-up horse the pity counter guarantees. */
const BANNERS=[
 {id:'winged',label:'The Winged Stable',emoji:'🪽',gems:18,pity:20,featured:'aurora',
  odds:{Common:0,Uncommon:0,Rare:0,Epic:0,Legendary:100},
  pool:b=>!!(b[7].wings&&!b[7].dragon),
  blurb:'Hooves that never touch the grass. Only winged horses answer this one.'},
 {id:'mystic',label:'The Mystic Stable',emoji:'🔮',gems:16,pity:20,featured:'celestial',
  odds:{Common:0,Uncommon:0,Rare:0,Epic:0,Legendary:100},
  pool:b=>!!(b[7].coat&&!b[7].wings&&!b[7].dragon),
  blurb:'Coats made of weather and night sky. Nothing here has an ordinary colour.'},
 {id:'majestic',label:'The Majestic Stable',emoji:'👑',gems:13,pity:15,featured:'akhal',
  odds:{Common:0,Uncommon:0,Rare:25,Epic:60,Legendary:15},
  pool:b=>!b[7].coat&&!b[7].wings&&!b[7].dragon,
  blurb:'The great show horses of the basin — real breeds, at their very best.'},
 {id:'dragon',label:'The Dragonfire Stable',emoji:'🐉',gems:30,pity:25,featured:'emberdrake',
  odds:{Common:0,Uncommon:0,Rare:0,Epic:0,Legendary:100},
  pool:b=>!!b[7].dragon,
  blurb:'Five dragons walk out of this door and nothing else ever does.'},
 {id:'painted',label:'The Painted Stable',emoji:'🎨',gems:7,painted:true,
  odds:{Common:0,Uncommon:0,Rare:100,Epic:0,Legendary:0},
  breeds:['bay','pinto','appaloosa','palomino','stock','knab','marwari'],
  blurb:'Seven honest breeds, a four-star statline and a coat nobody has ever seen.'},
 {id:'pets',label:'Pets of the Basin',emoji:'🐾',gems:6,custom:true,btn:'Whistle',
  odds:{Common:60,Uncommon:0,Rare:30,Epic:10,Legendary:0},
  blurb:'Somebody small is waiting behind the door. Pets only — your stable stays as it is.'},
];
/* One limited banner a season, gated to its own four weeks. */
const SEASON_BANNER={id:'limited',emoji:'🌟',gems:22,pity:10,
 odds:{Common:0,Uncommon:0,Rare:0,Epic:0,Legendary:100}};
const SEASON_BANNER_DEF={
 bloom:{label:'The Blossom Banner',featured:'meadowlight',blurb:'Four weeks only — the orchard wind carries something green and quick.'},
 sun:  {label:'The Long Sun Banner',featured:'sunspear', blurb:'Four weeks only — heat shimmer at the canyon mouth, and a horse inside it.'},
 ember:{label:'The Ember Banner',   featured:'phoenix',  blurb:'Four weeks only — the stall smells of woodsmoke and the light is orange.'},
 frost:{label:'The Frost Banner',   featured:'glacier',  blurb:'Four weeks only — the door is rimed shut and something breathes behind it.'},
};

/* The Painted Stable's palette: whatever the grooming parlour can mix, rolled at birth. */
const PAINT_TAIL=0.55;                 // how often a painted horse gets a tail of its own colour

/* Twelve companions. ear/tail/body/belly are read straight by makePet. */
const NEW_PETS=[
 {key:'corgi',   name:'Barn Corgi',       emoji:'🐕',price:400,body:'#d9a441',belly:'#f6e7c8',ear:'point',tail:'puff',rar:'Rare',   src:'shop',  note:'Herds the chickens whether they like it or not.'},
 {key:'duck',    name:'Loon Lake Duckling',emoji:'🦆',price:0,  body:'#f2d98a',belly:'#fff6d8',ear:'point',tail:'puff',rar:'Common', src:'summon',note:'Follows you all the way to the lake and no further.'},
 {key:'chick',   name:'Barnyard Chick',    emoji:'🐤',price:0,  body:'#f7e07a',belly:'#fff8d0',ear:'point',tail:'puff',rar:'Common', src:'summon',note:'Grandma counts them twice a day and always gets a different answer.'},
 {key:'piglet',  name:'Barleyfold Piglet', emoji:'🐷',price:0,  body:'#eab7b7',belly:'#f9dede',ear:'flop', tail:'curl',rar:'Rare',   src:'summon',note:'Theo swears it can open gates.'},
 {key:'goat',    name:'Barleyfold Kid',   emoji:'🐐',price:500,body:'#cfc3b0',belly:'#f2ece0',ear:'long', tail:'curl',rar:'Rare',   src:'shop',  note:'Eats fence posts. Ada says she is sorry.'},
 {key:'raccoon', name:'Cottonwood Raccoon',emoji:'🦝',price:0, body:'#8a8f98',belly:'#dfe3ea',ear:'point',tail:'bush',rar:'Rare',   src:'summon',note:'Turned up at the feed store and stayed.'},
 {key:'fennec',  name:'Canyon Fennec',    emoji:'🦊',price:0,  body:'#e3c089',belly:'#fbf3e2',ear:'long', tail:'bush',rar:'Epic',   src:'summon',note:'All ears, out of Coyote Canyon.'},
 {key:'snowhare',name:'Hollowpeak Hare',  emoji:'🐇',price:0,  body:'#eef3ff',belly:'#ffffff',ear:'long', tail:'puff',rar:'Epic',   src:'summon',pairs:'frost',note:'White on white; you only see it move.'},
 {key:'owl',     name:'Barn Owl',         emoji:'🦉',price:0,  body:'#b99a72',belly:'#f0e6d2',ear:'point',tail:'puff',rar:'Epic',   src:'pass',  pairs:'pegasus',note:'Rides the rafters, then the wind.'},
 {key:'lamb',    name:'Meadow Lamb',      emoji:'🐑',price:0,  body:'#f2ece0',belly:'#ffffff',ear:'flop', tail:'puff',rar:'Common', src:'set:jars',note:'Grandma raised it on a bottle.'},
 {key:'glimmerfox',name:'Glimmer Fox',    emoji:'🦊',price:0,  body:'#c9f0ff',belly:'#ffffff',ear:'point',tail:'bush',rar:'Epic',   src:'summon',pairs:'lumen',glow:'#8fe8ff',note:'Cold blue light, and it knows exactly what it is.'},
];
/* horse breed key → the pet that answers it. Both must be out at once. */
const PET_PAIRS={lumen:'glimmerfox',pegasus:'owl',frost:'snowhare'};
const PET_ODDS={Common:60,Rare:30,Epic:10};
const PET_PITY=10;                     // ten calls without an Epic and the next one is Epic
const PET_DUP_DUST=15;

/* The Luminous Spirit: the horse half of the pair. */
const LUMEN=['lumen','Luminous Spirit','Mythic',0,0,'#dfe9f7','#9fe4ff',
 {coat:'moonlit',glow:true,ability:'glow',src:'summon',body:'lipiz',size:1.02,pairPet:'glimmerfox'}];

/* Every loot a door can pay, and what each one is worth. */
const LOOT={
 tack:     {lbl:'a Rare piece of tack',       icon:'🎁'},
 tackEpic: {lbl:'an Epic piece of tack',      icon:'🎁'},
 tackLeg:  {lbl:'a Legendary piece of tack',  icon:'🏆'},
 gems3:    {lbl:'3 gems',                     icon:'💎'},
 gems6:    {lbl:'6 gems',                     icon:'💎'},
 gems10:   {lbl:'10 gems',                    icon:'💎'},
 keys2:    {lbl:'2 more Silver Keys',         icon:'🗝️'},
 dust25:   {lbl:'25 cosmetic dust',           icon:'✨'},
 dust40:   {lbl:'40 cosmetic dust',           icon:'✨'},
 dust60:   {lbl:'60 cosmetic dust',           icon:'✨'},
 coins250: {lbl:'250 coins',                  icon:'🪙'},
 horse:    {lbl:'a painted horse',            icon:'🐴'},
};
/* Five doors. Weights are percentages and they are printed before you spend the key. */
const KEY_DOORS=[
 {id:'tackroom',x:-24,z:-26,inline:true,label:"Grandma's tack room",region:'Meadowlark Ranch',
  loot:[['tack',70],['tackEpic',25],['tackLeg',5]],always:'100🪙, a Tack Toolkit II and 12-24✨ dust'},
 {id:'cottonwood',x:40,z:-46,label:'The Cottonwood auction door',region:'Cottonwood Village',
  loot:[['horse',10],['tackEpic',20],['gems6',25],['dust40',30],['keys2',15]]},
 {id:'barleyfold',x:205,z:-100,label:'The Barleyfold grain cellar',region:'Barleyfold Farms',
  loot:[['coins250',25],['dust25',30],['gems3',20],['tack',15],['keys2',10]]},
 {id:'canyon',x:-208,z:118,label:'The Coyote outpost strongbox',region:'Coyote Canyon',
  loot:[['dust40',30],['gems6',25],['tackEpic',20],['keys2',15],['horse',10]]},
 {id:'hollowpeak',x:-150,z:-200,label:'The Hollowpeak icehouse vault',region:'Hollowpeak',
  loot:[['horse',15],['tackLeg',15],['gems10',30],['dust60',25],['keys2',15]]},
];
/* The Basin Exchange. Coins into gems is capped at three trades a day so riding stays the
   real source; gems into coins is the other way and always open. */
const GEM_EXCHANGE=[{c:600,g:1},{c:2800,g:5},{c:6500,g:12}];
const GEMX_CAP=3, GEM_TO_COIN=260;
const DUST_SP=10;                      // 10 ✨ spent = 1 ⭐ Star Point for the club

/* ---------------------------------------------------------------------------------------
   INSTALL
   --------------------------------------------------------------------------------------- */
export function install(G){
 const {$,toast,THREE}=G, T=G.tables, S=G.save, M=G.money, U=G.ui;
 const SUMMON_TIERS=T.SUMMON_TIERS, BREEDS3=T.BREEDS3, PETS3=T.PETS3;
 const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
 const byKey=k=>BREEDS3.find(b=>b[0]===k);
 const pct=n=>Math.round(n)+'%';

 /* ---- 1. save shape ------------------------------------------------------------------- */
 S.ensure(s=>{
  const m=s.mk=s.mk||{};
  m.pity=m.pity||{}; m.draws=m.draws||{}; m.seen=m.seen||{};
  if(m.petPity==null)m.petPity=0;
  if(m.dustSeen==null)m.dustSeen=s.dust||0;
  if(m.dustSpent==null)m.dustSpent=0;
  if(m.dustEarned==null)m.dustEarned=0;
  if(m.doors==null)m.doors=0;
  if(m.combos==null)m.combos=0;
  m.gemx=m.gemx||{d:'',n:0};
  s.doors=s.doors||{};
  s.petList=s.petList||[];
  if(s.keyWeek==null)s.keyWeek='';
 });
 S.ensureHorse(h=>{ if(h.painted===undefined)h.painted=false; });

 /* ---- 2. the roster rows this package brings ------------------------------------------ */
 if(!byKey('lumen')){
  BREEDS3.push(LUMEN);
  try{if(G.horse.breedModels&&G.horse.breedModels.alias)G.horse.breedModels.alias('lumen','lipiz');}catch(e){}
 }
 /* the pet half of every pair, and the rest of the menagerie */
 for(const p of NEW_PETS) if(!PETS3.some(x=>x.key===p.key))PETS3.push(p);
 for(const p of PETS3){ if(!p.rar)p.rar='Common'; if(!p.src)p.src='shop'; if(!p.note)p.note='A loyal little friend.'; }
 for(const k in PET_PAIRS){const p=PETS3.find(x=>x.key===PET_PAIRS[k]); if(p)p.pairs=k;}
 const petCfg=k=>PETS3.find(p=>p.key===k)||PETS3[0];
 const petName=k=>{const p=PETS3.find(x=>x.key===k);return p?p.emoji+' '+p.name:k;};

 /* a pet is a reward kind now, so the pass, the sets and the doors can all pay one */
 M.rewardKind('pet',(s,v)=>{s.petList=s.petList||[];if(!s.petList.includes(v))s.petList.push(v);},v=>petName(v));
 if(T.PASS_FREE[13]&&!T.PASS_FREE[13].pet)T.PASS_FREE[13].pet='owl';          // free track, tier 14
 if(T.PASS_GOLD[18]&&!T.PASS_GOLD[18].pet)T.PASS_GOLD[18].pet='fennec';       // gold track, tier 19
 if(T.COLL_SETS.jars&&!T.COLL_SETS.jars.reward.pet)T.COLL_SETS.jars.reward.pet='lamb';

 /* ---- 3. the stables ------------------------------------------------------------------ */
 for(const b of BANNERS) if(!SUMMON_TIERS.some(t=>t.id===b.id))SUMMON_TIERS.push(b);
 {/* the limited banner: one per season, rebuilt from the season table so it always names
     the season it belongs to */
  const row=Object.assign({},SEASON_BANNER,{
   label:'Seasonal Banner',featured:null,blurb:'',
   when:()=>!!seasonBanner(),
   pool:b=>{const f=seasonBanner();if(!f)return false;const fb=byKey(f.featured);
    return b[0]===f.featured||!!(fb&&b[7].coat&&b[7].coat===fb[7].coat);}});
  if(!SUMMON_TIERS.some(t=>t.id==='limited'))SUMMON_TIERS.push(row);
  G.on('boot',()=>refreshSeasonBanner());
  G.on('seasonRoll',()=>refreshSeasonBanner());
  function refreshSeasonBanner(){
   const f=seasonBanner(), t=SUMMON_TIERS.find(x=>x.id==='limited'); if(!t)return;
   if(f){t.label=f.label;t.featured=f.featured;t.blurb=f.blurb;}
  }
  refreshSeasonBanner();
 }
 /* Every stable that hands out a horse keeps the first-thirty no-repeat promise, and every
    one of them has a pity counter: a named rate-up horse where the banner has one, a rarity
    floor where it does not. */
 for(const t of SUMMON_TIERS){
  if(t.custom||t.painted)continue;
  if(t.nodup===undefined)t.nodup=NODUP;
  if(!t.pity){t.pity=t.id==='starfall'?10:t.id==='basin'?25:40;t.floor=t.id==='starfall'?'Legendary':'Epic';}
 }
 function seasonBanner(){
  let sid=null; try{sid=G.time.seasonNow().def.id;}catch(e){}
  const d=sid&&SEASON_BANNER_DEF[sid]; if(!d||!byKey(d.featured))return null;
  return {season:sid,label:d.label,featured:d.featured,blurb:d.blurb};
 }
 const tierOf=id=>SUMMON_TIERS.find(t=>t.id===id);
 const pityOf=(s,t)=>((s.mk&&s.mk.pity)||{})[t.id]||0;
 const drawsOf=(s,t)=>((s.mk&&s.mk.draws)||{})[t.id]||0;

 /* the draw itself: pity first, then the no-repeat promise, then the painted coats */
 G.on('summonDraw',(D,s)=>{
  const t=D.tier;
  if(t.painted){                                   // a four-star statline in a one-off coat
   const p=rollPainted();
   D.breed=byKey(p.breed)||BREEDS3[0]; D.rar='Rare'; D.stats=p.stats; D.colors=p.colors;
   Object.assign(D.extra,{painted:true,tailCol:p.tailCol,markCol:p.markCol,mark2:p.mark2});
   return;
  }
  const pity=pityOf(s,t)+1;
  if(t.featured&&t.pity&&pity>=t.pity){            // the rate-up horse, guaranteed
   const b=byKey(t.featured);
   if(b){D.breed=b;D.rar=rarityToSummon(b[2]);D.extra.pity=1;return;}
  }
  if(t.floor&&t.pity&&pity>=t.pity){               // a floor instead of a named horse
   const oi=G.summon.ORDER.indexOf(D.rar), fi=G.summon.ORDER.indexOf(t.floor);
   if(fi>oi&&(t.odds[t.floor]||0)>=0){D.rar=t.floor;D.extra.pity=1;}
  }
  if(t.nodup&&drawsOf(s,t)<t.nodup){               // the first thirty never repeat
   const owned=new Set(s.horses.map(h=>h.breed));
   const pool=G.summon.pool(D.rar,t).filter(b=>!owned.has(b[0]));
   if(pool.length){D.breed=pool[Math.floor(Math.random()*pool.length)];D.extra.nodup=1;}
  }
  /* a rate-up horse is three times as likely inside its own rarity even before pity */
  if(!D.breed&&t.featured){
   const b=byKey(t.featured);
   if(b&&rarityToSummon(b[2])===D.rar&&Math.random()<0.34){D.breed=b;D.extra.rateup=1;}
  }
 });
 function rarityToSummon(tier){
  for(const k in T.SUMMON_POOL) if((T.SUMMON_POOL[k]||[]).indexOf(tier)>=0)return k;
  return 'Common';
 }
 function rollPainted(){
  const t=tierOf('painted')||{breeds:['bay']};
  const breed=t.breeds[Math.floor(Math.random()*t.breeds.length)];
  const pick=L=>L[Math.floor(Math.random()*L.length)];
  const st=()=>6+Math.floor(Math.random()*2);      // Epic-grade: a four-star statline
  return {breed,
   stats:{speed:st(),stamina:st(),jump:st(),accel:st(),agility:st()},
   colors:{body:pick(T.DYE_BODY)[0],mane:pick(T.DYE_HAIR)[0]},
   tailCol:Math.random()<PAINT_TAIL?pick(T.DYE_HAIR)[0]:null,
   markCol:pick(T.DYE_MARK)[0],
   mark2:pick(['none','blaze','star','snip','socks','stockings'])};
 }
 /* stamp the extras grantHorse cannot carry, and keep the counters */
 G.on('grantHorse',(s,h,opts)=>{
  const e=opts&&opts.extra; if(!e)return;
  if(e.painted){h.painted=true;h.variant=null;if(e.tailCol)h.tailCol=e.tailCol;if(e.markCol)h.markCol=e.markCol;if(e.mark2)h.mark2=e.mark2;}
 });
 G.on('summonPaid',(sv,D)=>{
  const t=D.tier, m=sv.mk=sv.mk||{pity:{},draws:{},seen:{}};
  m.pity=m.pity||{}; m.draws=m.draws||{}; m.seen=m.seen||{};
  m.draws[t.id]=(m.draws[t.id]||0)+1;
  m.pity[t.id]=(D.extra&&D.extra.pity)?0:(m.pity[t.id]||0)+1;
  D.dup=(sv.horses.filter(h=>h.breed===D.breed[0]).length>1);
  m.seen[D.breed[0]]=(m.seen[D.breed[0]]||0)+1;
 });
 G.on('summonDone',(sv,D,h)=>{
  if(!D)return;
  const t=D.tier;
  if(D.extra&&D.extra.painted&&h){toast('🎨 '+h.name+' came out in a coat nobody else has — a painted '+G.horse.breedLabel(h.breed)+'.');}
  if(D.dup&&h){const lvl=G.xp.masteryOf(sv,h.breed);toast('🐎 Another '+G.horse.breedLabel(h.breed)+' — mastery '+lvl+'.');}
  if(D.extra&&D.extra.pity)toast('⭐ The '+t.label+' kept its promise.');
  if(D.extra&&D.extra.nodup)toast('🆕 A breed you had never owned — the no-repeat promise holds for your first '+t.nodup+' calls here.');
  if(t.featured&&t.pity){const left=Math.max(0,t.pity-pityOf(sv,t));if(left<=3&&left>0)toast('✨ '+left+' call'+(left===1?'':'s')+' to a guaranteed '+G.horse.breedLabel(t.featured)+'.');}
  G.quest.dailyEvt('summon',1);
  const sp=$('shopPanel'); if(sp&&sp.style.display==='flex')U.openShop('summon');
 });

 /* the chips under a banner's odds: the horses in the pool with their real chances, the
    rate-up, the pity counter and the no-repeat promise. One renderer, spliced into the
    Summoning Stall's own card and reused by the Market's Summon tab. */
 const RATEUP=0.34;                                      // the featured horse's extra weight inside its rarity
 function breedOdds(t){
  if(t.custom||t.painted||!t.pool)return '';
  const rar=G.summon.ORDER.filter(k=>(t.odds[k]||0)>0);
  if(rar.length!==1)return '';
  const pool=G.summon.pool(rar[0],t); if(!pool.length||pool.length>12)return '';
  const n=pool.length, fe=t.featured&&pool.some(b=>b[0]===t.featured);
  return pool.map(b=>{
   const base=(fe?(1-RATEUP):1)/n, p=(fe&&b[0]===t.featured)?base+RATEUP:base;
   return '<span class="sumOdd" style="background:#f3ead8;color:#4a3526">'+esc(b[1])+' '+(p*100).toFixed(1)+'%</span>';
  }).join('');
 }
 function chipsFor(t,s){
  const bits=[];
  if(t.featured){const b=byKey(t.featured);if(b)bits.push('<span class="sumOdd" style="background:#ffe6a8;color:#4a3526">⭐ Rate-up: '+esc(b[1])+'</span>');}
  if(t.pity&&(t.featured||t.floor)){const p=pityOf(s,t);
   bits.push('<span class="sumOdd" style="background:#e8dcff;color:#3a2a4a">Pity '+p+'/'+t.pity+' · guaranteed '+(t.featured?esc((byKey(t.featured)||[])[1]||t.featured):t.floor+'+')+'</span>');}
  if(t.nodup){const d=drawsOf(s,t);if(d<t.nodup)bits.push('<span class="sumOdd" style="background:#d8f0d8;color:#24401f">No repeats for '+(t.nodup-d)+' more call'+((t.nodup-d)===1?'':'s')+'</span>');}
  if(t.painted)bits.push('<span class="sumOdd" style="background:#ffd9e8;color:#5a2340">Four-star statline · a coat rolled for this horse alone</span>');
  if(t.id==='pets'){
   bits.push('<span class="sumOdd" style="background:#e8dcff;color:#3a2a4a">Pity '+((s.mk&&s.mk.petPity)||0)+'/'+PET_PITY+' · guaranteed Epic pet</span>');
   for(const k of ['Common','Rare','Epic'])bits.push('<span class="sumOdd" style="background:#f3ead8;color:#4a3526">'+k+' pet '+PET_ODDS[k]+'%</span>');
  }
  const bo=breedOdds(t); if(bo)bits.push(bo);
  return bits.length?'<div class="odds">'+bits.join('')+'</div>':'';
 }
 U.section('summonCard',(t,s)=>chipsFor(t,s));

 /* ---- 4. Pets of the Basin: the pet call ---------------------------------------------- */
 const petPool=rar=>PETS3.filter(p=>p.src==='summon'&&(p.rar||'Common')===rar);
 function rollPetRarity(force){
  if(force)return 'Epic';
  let tot=0; for(const k in PET_ODDS)tot+=PET_ODDS[k];
  let x=Math.random()*tot;
  for(const k of ['Common','Rare','Epic']){x-=PET_ODDS[k]||0;if(x<=0)return k;}
  return 'Common';
 }
 G.on('summonCustom',(tier,s)=>{
  if(tier.id!=='pets')return;
  const forced=((s.mk&&s.mk.petPity)||0)+1>=PET_PITY;
  let rar=rollPetRarity(forced);
  let pool=petPool(rar);
  if(!pool.length)for(const k of ['Epic','Rare','Common']){if(petPool(k).length){rar=k;pool=petPool(k);break;}}
  if(!pool.length){toast('The pet stall is empty today.');return;}
  const pick=pool[Math.floor(Math.random()*pool.length)];
  let dup=false, ok=false;
  S.sync(sv=>{
   if((sv.gems||0)<tier.gems)return;
   sv.gems-=tier.gems; ok=true;
   sv.mk=sv.mk||{}; sv.mk.petPity=(rar==='Epic')?0:((sv.mk.petPity||0)+1);
   sv.mk.draws=sv.mk.draws||{}; sv.mk.draws.pets=(sv.mk.draws.pets||0)+1;
   sv.petList=sv.petList||[];
   if(sv.petList.includes(pick.key)){dup=true;sv.dust=(sv.dust||0)+PET_DUP_DUST;}
   else sv.petList.push(pick.key);
   sv.stats=sv.stats||{}; sv.stats.petcalls=(sv.stats.petcalls||0)+1;
  });
  if(!ok){toast('Not enough gems yet.');return;}
  M.refreshWallet(); G.sGem();
  if(dup)toast('🐾 '+pick.name+' again — the pair of you shake off '+PET_DUP_DUST+'✨ dust.');
  else{
   toast('🐾 '+rar+'! '+pick.emoji+' '+pick.name+' trots out of the stall — 🛍️ Shop → 🐾 Pets to take it with you.');
   try{G.pets.setActive(pick.key);}catch(e){}
  }
  G.quest.dailyEvt('summon',1);
  if(shopCall)U.openShop('summon');                       // called from the Market: put the banners back
 });

 /* ---- 5. the Market's Summon tab ------------------------------------------------------ */
 let shopCall=false;                                      // a call started from the shop comes back to the shop
 function bannerCards(s,fx){
  let html='';
  for(const t of SUMMON_TIERS){
   if(typeof t.when==='function'&&!t.when(s))continue;
   const can=(s.gems||0)>=t.gems;
   html+='<div class="sumTier"><div class="ph"><b>'+t.emoji+' '+esc(t.label)+'</b><span style="font-size:11px;color:#8c7a63">'+t.gems+'💎</span></div>'
    +'<div style="font-size:11.5px;color:#4a3526">'+esc(t.blurb||'')+'</div>'
    +'<div class="odds">'+G.summon.ORDER.filter(k=>t.odds[k]>0).map(k=>
      '<span class="sumOdd" style="background:'+G.summon.COL[k]+(k==='Common'?';color:#4a3526':'')+'">'+k+' '+t.odds[k]+'%</span>').join('')+'</div>'
    +chipsFor(t,s)
    +'<div style="margin-top:7px"><button data-fx="'+fx+':'+t.id+'"'+(can?' class="claimBtn"':' disabled')+'>'+(t.btn||'Call')+' · '+t.gems+'💎</button></div></div>';
  }
  return html;
 }
 U.shopTab({id:'summon',label:'✨ Summon',pos:2,render(s){
  return '<span style="font-size:11.5px;color:#8c7a63">Every stable prints its odds and its pity counter. Gems are earned by riding — nothing here costs real money, and the Summoning Stall itself stands west of the barn if you would rather walk.</span>'
   +bannerCards(s,'mk:call')
   +'<span style="font-size:11px;color:#8c7a63">You have '+(s.gems||0)+'💎. A call takes you to the stall for the reveal and puts you back where you were standing.</span>';
 }});

 /* ---- 6. the Catalogue tab: what exists, what you have, where it comes from ------------ */
 let catFilter='all';
 const STARS=k=>(T.TIER_STARS&&T.TIER_STARS[k])||2;
 function sourceOf(b){
  const src=G.horse.breedSrc(b), o=b[7]||{};
  if(o.story)return '📜 The story';
  if(o.exclusive)return '🎁 '+o.exclusive;
  if(src==='breed')return '💞 Breeding only';
  if(src==='season')return '🗓️ The season track';
  if(o.hero)return '🏡 Your first horse';
  const out=[];
  if(G.horse.breedAvailable(b,'shop')&&(b[3]||b[4]))out.push('🛍️ Shop · '+(b[3]?b[3]+'🪙':b[4]+'💎'));
  if(G.horse.breedAvailable(b,'summon')){
   const rar=rarityToSummon(b[2]);
   const banners=SUMMON_TIERS.filter(t=>!t.custom&&(t.odds[rar]||0)>0&&(!t.pool||(()=>{try{return !!t.pool(b);}catch(e){return false;}})())&&(!t.painted||(t.breeds||[]).indexOf(b[0])>=0));
   if(banners.length)out.push('✨ '+banners.map(t=>esc(t.label)).join(', '));
  }
  if((T.WILD_BREEDS||[]).some(w=>w.breed===b[0]))out.push('🐎 Tamed in the wild');
  if(KEY_DOORS.some(d=>(d.loot||[]).some(l=>l[0]==='horse'))&&(tierOf('painted')||{breeds:[]}).breeds.indexOf(b[0])>=0)out.push('🔐 Key doors');
  return out.length?out.join(' · '):'🤝 Turns up in the market';
 }
 function catalogHtml(s){
  const own=k=>s.horses.filter(h=>h.breed===k).length;
  const total=BREEDS3.length, have=BREEDS3.filter(b=>own(b[0])>0).length;
  const chips=[['all','All'],['own','✅ Owned'],['miss','🔒 Missing'],['2','⭐⭐'],['3','⭐⭐⭐'],['4','⭐⭐⭐⭐'],['5','⭐⭐⭐⭐⭐'],['6','⭐×6']];
  let html='<div class="passCard"><div class="ph"><b>📖 The Kestrel Basin catalogue</b><span style="font-size:11px;color:#8c7a63">'+have+'/'+total+' breeds collected</span></div>'
   +'<div class="cbar" style="margin:5px 0 4px"><div class="cfill" style="width:'+Math.round(have/total*100)+'%;background:#e0a93c"></div></div>'
   +'<div class="sub">Every horse in the game, where it comes from and what its statline starts at. A horse you have never owned is greyed out with a 🔒.</div></div>'
   +'<div class="crow" style="gap:4px;flex-wrap:wrap">'+chips.map(c=>'<button class="tabbtn'+(catFilter===c[0]?' on':'')+'" data-fx="mk:catf:'+c[0]+'" style="padding:3px 9px">'+c[1]+'</button>').join('')+'</div>';
  const rows=BREEDS3.filter(b=>{
   const n=own(b[0]);
   if(catFilter==='own')return n>0;
   if(catFilter==='miss')return n===0;
   if(/^\d$/.test(catFilter))return STARS(b[2])===+catFilter;
   return true;
  });
  html+='<div style="font-size:12px;color:#8c7a63;margin:6px 0 2px">'+rows.length+' horse'+(rows.length===1?'':'s')+' shown</div>';
  html+=rows.map(b=>{
   const n=own(b[0]), base=(T.TIER_BASE&&T.TIER_BASE[b[2]])||3, mast=n?G.xp.masteryOf(s,b[0]):0;
   const ico=b[7].dragon?'🐉':b[7].horn?'🦄':b[7].wings?'🪽':(b[7].coat||b[7].glow)?'✨':'🐴';
   return '<div class="evrow catRow'+(n?' done':' catLock')+'"'+(n?'':' style="opacity:.72"')+'>'+ico+' <b>'+esc(b[1])+'</b>'
    +'<span><span style="color:#d9a520;letter-spacing:-2px">'+'⭐'.repeat(STARS(b[2]))+'</span> '+b[2]+' · stats start ~'+base
    +' · '+sourceOf(b)+(n?' · ✅ owned ×'+n+' · mastery '+mast:' · 🔒 not yet owned')+'</span></div>';
  }).join('');
  return html;
 }
 U.shopTab({id:'catalog',label:'📖 Catalog',pos:3,render(s){return catalogHtml(s);}});

 /* ---- 7. the Pets tab ------------------------------------------------------------------ */
 const SRC_LBL={shop:'🛍️ On the shelf',summon:'🐾 Pets of the Basin call',pass:'🎟️ Trail Pass'};
 function petSrcLabel(p){
  if(p.src&&p.src.startsWith('set:')){const k=p.src.slice(4);return '🫙 '+((T.COLL_SETS[k]&&T.COLL_SETS[k].label)||k)+' set';}
  return SRC_LBL[p.src]||'🛍️ On the shelf';
 }
 U.shopTab({id:'pets',label:'🐾 Pets',render(s){
  const owned=s.petList||[], active=(()=>{try{return G.pets.active();}catch(e){return null;}})();
  let html='<span style="font-size:12px;color:#8c7a63">Adopt a companion — one follows you at a time, and a pet that matches your horse makes them both glow. 🐾 '+owned.length+'/'+PETS3.length+' found.</span>';
  html+=PETS3.map(P=>{
   const have=owned.includes(P.key), on=active===P.key;
   const pair=P.pairs&&byKey(P.pairs);
   const note=esc(P.note||'')+(pair?' · 💞 pairs with '+esc(pair[1]):'');
   let btn;
   if(have)btn='<button data-petfollow="'+P.key+'"'+(on?' class="claimBtn"':'')+'>'+(on?'🐾 Following':'🐾 Follow')+'</button>';
   else if(P.src==='shop'&&P.price)btn='<button data-buypet="'+P.key+'"'+(s.coins<P.price?' disabled':'')+'>'+P.price+' 🪙</button>';
   else if(P.src==='summon')btn='<button data-fx="shop:summon">'+petCfg(P.key).rar+' · call</button>';
   else btn='<span style="font-size:11px;color:#8c7a63">'+petSrcLabel(P)+'</span>';
   return '<div class="evrow'+(have?' done':'')+'">'+P.emoji+' <b>'+esc(P.name)+'</b><span>'+(have?(on?'· following you ✓ · ':'· owned · ')+note:note+' · '+petSrcLabel(P))+'</span>'+btn+'</div>';
  }).join('');
  html+='<div style="font-size:12px;color:#8c7a63;margin:8px 0 2px">💞 Pairs</div>'
   +Object.keys(PET_PAIRS).map(k=>{const b=byKey(k),p=PETS3.find(x=>x.key===PET_PAIRS[k]);if(!b||!p)return '';
     const got=s.horses.some(h=>h.breed===k)&&(s.petList||[]).includes(p.key);
     return '<div class="evrow'+(got?' done':'')+'">'+p.emoji+' <b>'+esc(p.name)+' + '+esc(b[1])+'</b><span>'+(got?'ride the one with the other beside you and both of them light up':'find both and they transform side by side')+'</span></div>';}).join('')
   +'<span style="font-size:11px;color:#8c7a63">A paired pet also makes your horse bond 15% faster while it is out.</span>';
  return html;
 }});

 /* ---- 8. Silver Key doors -------------------------------------------------------------- */
 const doorOddsText=d=>(d.loot||[]).map(l=>(LOOT[l[0]]?LOOT[l[0]].icon:'•')+l[1]+'%').join(' ');
 const doorOddsRows=d=>(d.loot||[]).map(l=>'<span class="sumOdd" style="background:#f3ead8;color:#4a3526">'+(LOOT[l[0]]?LOOT[l[0]].icon+' '+LOOT[l[0]].lbl:l[0])+' '+l[1]+'%</span>').join('');
 function rollLoot(d){
  let tot=0; for(const l of d.loot)tot+=l[1];
  let x=Math.random()*tot;
  for(const l of d.loot){x-=l[1];if(x<=0)return l[0];}
  return d.loot[0][0];
 }
 function makePainted(sv){
  const p=rollPainted();
  const h=G.horse.grantHorse(sv,p.breed,{stats:p.stats,colors:p.colors,src:'door',
   extra:{painted:true,tailCol:p.tailCol,markCol:p.markCol,mark2:p.mark2}});
  return h;
 }
 /* one switch, so every door and every future key sink pays the same way */
 function applyLoot(sv,kind){
  const gear=r=>{sv.tack=sv.tack||[];const g=G.horse.genGear(r);sv.tack.push(g);return r+' tack — '+g.name;};
  switch(kind){
   case 'tack':     return gear('Rare');
   case 'tackEpic': return gear('Epic');
   case 'tackLeg':  return gear('Legendary');
   case 'gems3':    M.grantGems(sv,3); return '3💎';
   case 'gems6':    M.grantGems(sv,6); return '6💎';
   case 'gems10':   M.grantGems(sv,10);return '10💎';
   case 'keys2':    sv.keys=(sv.keys||0)+2; return '2🗝️ more keys';
   case 'dust25':   sv.dust=(sv.dust||0)+25; return '25✨ dust';
   case 'dust40':   sv.dust=(sv.dust||0)+40; return '40✨ dust';
   case 'dust60':   sv.dust=(sv.dust||0)+60; return '60✨ dust';
   case 'coins250': sv.coins+=250; M.logEarn(sv,250); return '250🪙';
   case 'horse':    {const h=makePainted(sv);return '🐴 '+h.name+', a painted '+G.horse.breedLabel(h.breed);}
  }
  return '';
 }
 /* the doors themselves */
 const W=G.world, mats=W.mats;
 function mkDoor(d){
  const g=new THREE.Group(), x=d.x, z=d.z;
  let labelY=3;
  try{
   const shell=W.ranchArchitecture.buildOutbuilding({width:3.2,depth:2.6,height:2.6,animatedDoorOpening:{width:1.0,height:1.9}});
   g.add(shell); labelY=(shell.userData&&shell.userData.architecture&&shell.userData.architecture.suggestedLabelY)||3;
  }catch(e){ W.box(3.2,2.6,2.6,mats.plankBrownMat,0,1.3,0,g); }
  const door=W.box(1.0,1.9,0.09,mats.plankBrownMat,0,0.95,1.32,g);
  for(const y of [0.45,1.45])W.box(0.9,0.09,0.05,mats.plankBrownMat,0,y,1.38,g);
  W.box(0.06,0.17,0.07,'#d8b24a',0.33,1.0,1.39,g);                       // the lock plate
  const glowMat=new THREE.MeshBasicMaterial({color:0xffd27a,transparent:true,opacity:0,depthWrite:false});
  const glow=new THREE.Mesh(new THREE.PlaneGeometry(1.0,0.28),glowMat); glow.position.set(0,0.16,1.40); g.add(glow);
  const light=new THREE.PointLight(0xffd27a,0,9); light.position.set(0,1.2,2.0); g.add(light);
  g.position.set(x,W.groundH(x,z),z); g.rotation.y=Math.atan2(-x,-z)+Math.PI;
  g.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
  G.scene.add(g);
  W.colliders.push({x,z,r:2.0});
  try{const sp=G.nameSprite('🔐 '+d.label);sp.position.y=labelY;g.add(sp);}catch(e){}
  try{W.followCamera.register(g);}catch(e){}
  return {kind:'keydoor',id:d.id,def:d,g,door,glow,light,x,z,reach:5.2,anim:0,
   label:t=>doorLabel(t),use:t=>openDoor(t),tick:(dt,t)=>doorTick(dt,t)};
 }
 function doorLabel(t){
  const sv=S.fresh(); const used=sv&&sv.doors&&sv.doors[t.id]===G.time.isoWeekKey();
  if(used)return '🔐 '+t.def.label+' — opens again Monday';
  return '🔐 '+t.def.label+' · 1🗝️ · '+doorOddsText(t.def)+' (E)';
 }
 function doorTick(dt,t){
  if(!t.anim)return;
  t.anim=Math.max(0,t.anim-dt);
  const a=t.anim;
  t.door.rotation.y=-Math.min(1.35,(2.6-a)*1.1);
  t.glow.material.opacity=Math.max(0,Math.min(0.9,a*0.5))*(0.6+0.4*Math.sin(a*16));
  t.light.intensity=Math.max(0,a*9);
  if(t.anim<=0){t.door.rotation.y=-1.3;t.glow.material.opacity=0;t.light.intensity=0;}
 }
 function openDoor(t){
  const d=t.def, wk=G.time.isoWeekKey();
  let ok=false, got='', kind='';
  S.sync(sv=>{
   sv.doors=sv.doors||{};
   if(sv.doors[t.id]===wk)return;
   if((sv.keys||0)<1)return;
   sv.keys--; sv.doors[t.id]=wk;
   kind=rollLoot(d); got=applyLoot(sv,kind);
   sv.mk=sv.mk||{}; sv.mk.doors=(sv.mk.doors||0)+1;
   sv.stats=sv.stats||{}; sv.stats.doors=(sv.stats.doors||0)+1;
   ok=true;
  });
  if(!ok){
   const sv=S.fresh();
   toast(sv&&sv.doors&&sv.doors[t.id]===wk?'🔐 '+d.label+' opens again on Monday.':'You need a Silver Key — dailies, the boards, chests and the free weekly claim all pay one.');
   return;
  }
  t.anim=2.6;
  M.refreshWallet(); try{G.horse.refreshTack();}catch(e){} try{G.horse.reloadHorses();}catch(e){}
  G.sGem(); try{G.xp.passAdd(8);}catch(e){}
  toast('🔐 '+d.label+' swings open — '+got+'.');
  G.quest.dailyEvt('door',1);
 }
 const doorThings=[];
 for(const d of KEY_DOORS){
  if(d.inline)continue;                                   // the tack room is already in the world
  const t=mkDoor(d); W.addThing(t); doorThings.push(t);
  W.mapMarkers.push({x:d.x,z:d.z,glyph:'🔐',label:d.label});
  W.miniMarkers.push({x:d.x,z:d.z,col:'#ffd27a'});
 }
 U.shopTab({id:'doors',label:'🔐 Doors',pos:10,render(s){
  const wk=G.time.isoWeekKey();
  let html='<span style="font-size:11.5px;color:#8c7a63">Five locked doors across the basin. One Silver Key each, one open per door per week, and the odds are printed before you spend anything. Keys are never sold for gems — they come from dailies, the boards, chests, the season pass and the free weekly claim.</span>'
   +'<div class="evrow">🗝️ <b>Silver Keys: '+(s.keys||0)+'</b><span>'+(KEY_DOORS.filter(d=>(s.doors||{})[d.id]!==(d.inline?G.time.weekKey():wk)).length)+' of 5 doors are shut and waiting</span>'
   +(s.keyWeek!==wk?'<button data-tk="freekey" class="claimBtn">🎁 Free weekly key</button>':'<span style="font-size:11px;color:#8c7a63">weekly key claimed</span>')+'</div>';
  html+=KEY_DOORS.map(d=>{
   const used=(s.doors||{})[d.id]===(d.inline?G.time.weekKey():wk);
   return '<div class="passCard" style="margin-top:6px"><div class="ph"><b>🔐 '+esc(d.label)+'</b><span style="font-size:11px;color:#8c7a63">'+esc(d.region)+(used?' · opened this week':'')+'</span></div>'
    +'<div class="odds">'+doorOddsRows(d)+'</div>'
    +(d.always?'<div class="sub">Every time: '+esc(d.always)+'.</div>':'')
    +'<div class="sub">Ride to '+Math.round(d.x)+', '+Math.round(d.z)+' — it is on the map as 🔐.</div></div>';
  }).join('');
  return html;
 }});

 /* ---- 9. dust: what it is, and the Star Points it feeds -------------------------------- */
 /* Dust is made here and spent by the wardrobe and the style room, so the ledger is kept
    by watching the balance move: every 10 ✨ spent is a Star Point for the club, exactly as
    the spec asks, without either of those packages having to know about it. Nothing is
    written until the number actually changes. */
 let dustLast=null, dustPend=0;
 function auditDust(){
  if(!dustPend)return;
  const spent=dustPend; dustPend=0;
  let sp=0;
  S.sync(s=>{
   s.mk=s.mk||{};
   const before=s.mk.dustSpent||0, after=before+spent;
   s.mk.dustSpent=after;
   sp=Math.floor(after/DUST_SP)-Math.floor(before/DUST_SP);
   if(sp>0)G.xp.addSP(s,sp,'dust');
  });
  if(sp>0){toast('⭐ +'+sp+' Star Point'+(sp===1?'':'s')+' for the club — spending ✨ dust counts.');try{M.refreshWallet();}catch(e){}}
 }
 G.on('wallet',s=>{
  try{U.hud.badge('shopBtn',(s.keyWeek!==G.time.isoWeekKey())?true:0);}catch(e){}   // the unclaimed weekly key
  const now=s.dust||0;
  if(dustLast==null){dustLast=now;return;}
  if(now<dustLast)dustPend+=dustLast-now;
  else if(now>dustLast){const got=now-dustLast;S.sync(sv=>{sv.mk=sv.mk||{};sv.mk.dustEarned=(sv.mk.dustEarned||0)+got;});}
  dustLast=now;
 });

 /* ---- 10. the Free & Wallet tab -------------------------------------------------------- */
 function daysToMonday(){
  const d=new Date(), day=(d.getDay()+6)%7;
  return 7-day;
 }
 function gemxLeft(s){const g=(s.mk&&s.mk.gemx)||{d:'',n:0};return g.d===G.time.dateKey()?Math.max(0,GEMX_CAP-(g.n||0)):GEMX_CAP;}
 U.shopTab({id:'wallet',label:'🎁 Free',pos:11,render(s){
  const wk=G.time.isoWeekKey(), freeKey=s.keyWeek!==wk, left=gemxLeft(s);
  let html='<div class="passCard"><div class="ph"><b>👛 Your wallet</b><span style="font-size:11px;color:#8c7a63">everything is earned in play</span></div>'
   +'<div class="odds"><span class="sumOdd" style="background:#f3ead8;color:#4a3526">🪙 '+Math.floor(s.coins)+'</span>'
   +'<span class="sumOdd" style="background:#dbe9ff;color:#23385a">💎 '+(s.gems||0)+'</span>'
   +'<span class="sumOdd" style="background:#e8e2d2;color:#4a3526">🗝️ '+(s.keys||0)+'</span>'
   +'<span class="sumOdd" style="background:#ece0ff;color:#3a2a4a">✨ '+(s.dust||0)+' dust</span></div></div>';
  html+='<div class="passCard" style="margin-top:6px"><div class="ph"><b>🎁 Free this week</b><span style="font-size:11px;color:#8c7a63">resets Monday · '+daysToMonday()+' day'+(daysToMonday()===1?'':'s')+' left</span></div>'
   +'<div class="evrow">🗝️ <b>Weekly Silver Key</b><span>'+(freeKey?'waiting for you — one a week, free, forever':'claimed; the next one is on Monday')+'</span>'
   +(freeKey?'<button data-tk="freekey" class="claimBtn">Claim 🗝️</button>':'<span style="font-size:11px;color:#8c7a63">✓ claimed</span>')+'</div>'
   +'<div class="evrow">🧰 <b>Weekly toolkit</b><span>Bo leaves one in the Tack tab</span><button data-fx="shop:tack">🐎 Tack</button></div>'
   +'<div class="evrow">📅 <b>Daily gift &amp; quests</b><span>gems, coins and a key most days</span><button data-fx="open:questPanel">📋 Quests</button></div>'
   +'<div class="evrow">🏅 <b>Week wages &amp; boards</b><span>Star Points pay coins, gems and keys on Monday</span><button data-fx="open:lbPanel">🏅 Boards</button></div></div>';
  html+='<div class="passCard" style="margin-top:6px"><div class="ph"><b>🔁 The Basin Exchange</b><span style="font-size:11px;color:#8c7a63">'+left+' of '+GEMX_CAP+' trades left today</span></div>'
   +'<div class="sub">Coins into gems, three trades a day — riding is still the real source. Gems back into coins any time you like.</div>'
   +GEM_EXCHANGE.map((x,i)=>'<div class="evrow">💎 <b>'+x.g+' gems</b><span>for '+x.c+'🪙</span><button data-fx="mk:gemx:'+i+'"'+((s.coins<x.c||left<=0)?' disabled':' class="claimBtn"')+'>'+x.c+' 🪙</button></div>').join('')
   +'<div class="evrow">🪙 <b>'+GEM_TO_COIN+' coins</b><span>for 1💎 · the old way round</span><button data-fx="mk:coinx:1"'+((s.gems||0)<1?' disabled':'')+'>1 💎</button></div></div>';
  html+='<div class="passCard" style="margin-top:6px"><div class="ph"><b>🏪 The rest of the market</b></div>'
   +'<div class="evrow">👑 <b>Trail Pass membership</b><span>the gold track, wage bonus and stable perks</span><button data-fx="open:lbPanel">👑 Membership</button></div>'
   +'<div class="evrow">🏗️ <b>Furniture &amp; ranch pieces</b><span>fences, lanterns, troughs — placed on your own land</span><button data-fx="mk:build">🏗️ Build</button></div>'
   +'<div class="evrow">🐴 <b>Horses for sale today</b><span>four every day, and somebody will buy yours</span><button data-fx="shop:market">🤝 Market</button></div>'
   +'<div class="evrow">💎 <b>Gem exchange</b><span>keys, breeding tokens and race tickets</span><button data-fx="shop:gems">💎 Exchange</button></div></div>';
  return html;
 }});

 /* ---- 11. actions ---------------------------------------------------------------------- */
 U.action('mk',(a)=>{
  const op=a[0];
  if(op==='call'){
   const t=tierOf(a[1]); if(!t)return;
   const p=$('shopPanel'); if(p)p.style.display='none';
   shopCall=true;
   try{G.summon.start(t);}catch(e){console.error('summon',e);}
   shopCall=false;
   return;
  }
  if(op==='catf'){catFilter=a[1];U.openShop('catalog');return;}
  if(op==='build'){try{U.openBuild();}catch(e){}return;}
  if(op==='gemx'){
   const x=GEM_EXCHANGE[+a[1]]; if(!x)return;
   let msg='',ok=false;
   S.sync(s=>{
    s.mk=s.mk||{}; const g=s.mk.gemx=s.mk.gemx||{d:'',n:0};
    if(g.d!==G.time.dateKey()){g.d=G.time.dateKey();g.n=0;}
    if(g.n>=GEMX_CAP){msg='The exchange only trades three times a day — come back tomorrow.';return;}
    if(s.coins<x.c){msg='Not enough coins — that trade is '+x.c+'🪙.';return;}
    s.coins-=x.c; M.grantGems(s,x.g); g.n++; ok=true;
   });
   if(ok){M.refreshWallet();G.sGem();msg='🔁 '+x.c+'🪙 → '+x.g+'💎.';}
   toast(msg); U.openShop('wallet'); return;
  }
  if(op==='coinx'){
   let ok=false,msg='';
   S.sync(s=>{ if((s.gems||0)<1){msg='You have no gems to change.';return;} s.gems--; s.coins+=GEM_TO_COIN; M.logEarn(s,GEM_TO_COIN); ok=true; });
   if(ok){M.refreshWallet();G.sCoin();msg='🔁 1💎 → '+GEM_TO_COIN+'🪙.';}
   toast(msg); U.openShop('wallet'); return;
  }
 });

 /* ---- 12. the pair that lights up ------------------------------------------------------ */
 let aura=null, ring=null, comboT=0, toldCombo=false;
 function mkAura(){
  const g=new THREE.Group();
  const m=new THREE.MeshBasicMaterial({color:0x8fe8ff,transparent:true,opacity:0,depthWrite:false});
  const s1=new THREE.Mesh(new THREE.SphereGeometry(0.42,12,10),m); s1.position.y=0.34; g.add(s1);
  return {group:g,mat:m};
 }
 function mkRing(){
  const m=new THREE.MeshBasicMaterial({color:0x8fe8ff,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide});
  const r=new THREE.Mesh(new THREE.RingGeometry(0.9,1.6,24),m); r.rotation.x=-Math.PI/2;
  G.scene.add(r); return {mesh:r,mat:m};
 }
 let dustAcc=0;
 G.on('tick',dt=>{
  dustAcc+=dt; if(dustAcc>1){dustAcc=0;auditDust();}      // pays the Star Points a dust spend earned
  let P=null; try{P=G.pets.comp();}catch(e){}
  const h=G.horse.ridden();
  const want=P&&h&&PET_PAIRS[h.breed]===P.key;
  if(!P){ if(aura&&aura.group.parent)aura.group.parent.remove(aura.group); if(ring)ring.mat.opacity=0; toldCombo=false; return; }
  if(!want&&(!P.combo||P.combo<0.01)){ if(ring)ring.mat.opacity=0; if(aura)aura.mat.opacity=0; return; }
  const px=G.horse.player.pos, d=Math.hypot(px.x-P.pos.x,px.z-P.pos.z);
  const near=want&&d<3.4?1:0;
  P.combo=(P.combo||0)+(near-(P.combo||0))*Math.min(1,dt*2.2);
  comboT+=dt;
  if(!aura)aura=mkAura();
  if(aura.group.parent!==P.parts.group){try{P.parts.group.add(aura.group);}catch(e){}}
  const pulse=0.6+0.4*Math.sin(comboT*3.2);
  aura.mat.opacity=P.combo*0.55*pulse;
  aura.mat.color.set((petCfg(P.key).glow)||'#8fe8ff');
  if(!ring)ring=mkRing();
  ring.mat.opacity=P.combo*0.42*pulse;
  ring.mesh.position.set(px.x,G.world.groundH(px.x,px.z)+0.06,px.z);
  if(P.combo>0.85&&!toldCombo){
   toldCombo=true;
   const b=byKey(h.breed);
   toast('✨ '+petCfg(P.key).name+' and '+h.name+' light each other up — the '+((b&&b[1])||h.breed)+' pair is awake.');
   S.sync(s=>{s.mk=s.mk||{};s.mk.combos=(s.mk.combos||0)+1;s.stats=s.stats||{};s.stats.combos=(s.stats.combos||0)+1;});
   try{G.sChime();}catch(e){}
  }
  if(P.combo<0.2)toldCombo=false;
 });
 /* a paired pet gentles the horse faster */
 G.addMul('bond',(s,h)=>{
  if(!h)return 1;
  let a=null; try{a=G.pets.active();}catch(e){}
  return (a&&PET_PAIRS[h.breed]===a)?1.15:1;
 });
 /* riding with a companion is a daily */
 let petAcc=0;
 G.on('tick',dt=>{
  let a=null; try{a=G.pets.active();}catch(e){}
  if(!a)return;
  petAcc+=dt; if(petAcc<10)return; petAcc=0;
  G.quest.dailyEvt('compan',10);   // 'pet' is already the daily for petting a horse
 });

 /* ---- 13. quests, achievements, the stall keeper --------------------------------------- */
 G.quest.addDaily({type:'door',icon:'🔐',label:'Open a Silver Key door',goal:1,r:{c:180,g:2,p:20}});
 G.quest.addDaily({type:'compan',icon:'🐾',label:'Ride with a companion for 2 minutes',goal:120,r:{c:120,g:1,p:12}});
 G.quest.addAch({id:'summon25',icon:'✨',label:'Called down the stars',desc:'Answer 25 calls at the stables',v:s=>(s.stats&&s.stats.summons)||0,goal:25,r:{g:4}});
 G.quest.addAch({id:'painted1',icon:'🎨',label:'One of a kind',desc:'Own a painted horse',v:s=>s.horses.filter(h=>h.painted).length,goal:1,r:{g:2}});
 G.quest.addAch({id:'doors10',icon:'🔐',label:'Key collector',desc:'Open 10 key doors',v:s=>(s.mk&&s.mk.doors)||0,goal:10,r:{k:1,g:2}});
 G.quest.addAch({id:'pets6',icon:'🐾',label:'Menagerie',desc:'Find 6 companions',v:s=>(s.petList||[]).length,goal:6,r:{g:3}});
 G.quest.addAch({id:'combo1',icon:'✨',label:'Side by side',desc:'Ride a horse with the pet that matches it',v:s=>(s.mk&&s.mk.combos)||0,goal:1,r:{g:3}});
 G.quest.addAch({id:'dust500',icon:'✨',label:'Dust to dresses',desc:'Collect 500 cosmetic dust',v:s=>(s.mk&&s.mk.dustEarned)||0,goal:500,r:{c:400}});
 G.quest.addAch({id:'breeds20',icon:'📖',label:'Basin collector',desc:'Own 20 different breeds',v:s=>new Set(s.horses.map(h=>h.breed)).size,goal:20,r:{g:5}});
 G.world.addNPC({id:'stallkeep',name:'Wynn the Stall-keeper',icon:'✨',x:-30,z:-2,hat:'#3a2e48',shirt:'#6a5a8a',
  idle:'The odds are on the board, same as always. Pity counts up whether you watch it or not, and the first thirty calls at a basin stable will never hand you a horse you already own.',
  role:{open:'summon',label:'✨ The stables'}});
 G.world.mapMarkers.push({x:-27.5,z:-4.5,glyph:'✨',label:'The Summoning Stall'});

 /* ---- 14. boot: tell the player what is waiting ----------------------------------------- */
 G.on('boot',s=>{
  if(!s)return;
  try{ if(s.keyWeek!==G.time.isoWeekKey())setTimeout(()=>toast('🎁 Your free Silver Key is waiting — 🛍️ Shop → 🎁 Free.'),4200); }catch(e){}
  try{U.hud.badge('shopBtn',(s.keyWeek!==G.time.isoWeekKey())?true:0);}catch(e){}
 });
 G.on('state',o=>{
  const s=S.fresh()||{}; const m=s.mk||{};
  let P=null; try{P=G.pets.comp();}catch(e){}
  o.market={
   banners:SUMMON_TIERS.length,
   pity:Object.assign({},m.pity||{}),
   draws:Object.assign({},m.draws||{}),
   petPity:m.petPity||0,
   doors:{total:KEY_DOORS.length,opened:m.doors||0,open:doorThings.length},
   dust:{have:s.dust||0,earned:m.dustEarned||0,spent:m.dustSpent||0},
   pets:{owned:(s.petList||[]).length,total:PETS3.length,active:(()=>{try{return G.pets.active();}catch(e){return null;}})(),combo:P?Number((P.combo||0).toFixed(3)):0},
   painted:s.horses?s.horses.filter(h=>h.painted).length:0,
   breeds:{owned:s.horses?new Set(s.horses.map(h=>h.breed)).size:0,total:BREEDS3.length},
   keyWeek:s.keyWeek||'',freeKey:s.keyWeek!==G.time.isoWeekKey(),
  };
 });

 /* ---- handles for QA -------------------------------------------------------------------- */
 G.market={BANNERS,KEY_DOORS,LOOT,PET_PAIRS,PET_ODDS,PET_PITY,GEM_EXCHANGE,GEMX_CAP,GEM_TO_COIN,NODUP,DUST_SP,NEW_PETS,
  applyLoot,rollLoot,rollPainted,makePainted,doorThings,doorOddsText,catalogHtml,seasonBanner,tierOf,pityOf,drawsOf,
  petPool,rollPetRarity,auditDust,sourceOf};
}

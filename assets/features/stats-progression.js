/* Feature package 'stats-progression' — horse stats, XP, foods, foraging and fishing.
   Owned by this package: this file plus the inline hot spots it was assigned (statCap/MAX_LEVEL,
   applyXp, grantStatXp, updateShoes, the forage spawner, the pickup loop, claimDaily/claimAch/dlgBtn
   extras, chest feed bags, the care-panel stat bars). See index.js for the contract.
   Nothing runs at import time.

   What lives here:
     1. Per-breed stat ceilings (BREED_CEIL) for every BREEDS3 row, clamped on new horses.
     2. Horse level to 50: level/XP readout in Care and the Stable, XP from quests and dailies.
     3. Feed bags: five rarities of horse-XP consumable, dropped by events, chests, dailies, achievements.
     4. The stat-food table: four tiers × five stats, fixed XP per tier, a rewritten shop shelf.
     5. World foraging: orchard trees, hives, field rows and bushes across every region, SP by rarity.
     6. Resource traders: five town stalls with regional stock, reached through the NPC dialogue.
     7. Stat XP from events and races (every event lists what it trains).
     8. Stackable XP multipliers (bond, tack, mastery, breed traits, achievement perks) with a breakdown.
     9. Region-specific wildlife (coyotes, mountain goats) that can spook a galloping horse.
    10. Golden horseshoes pay XP (inline).
    11. Fishing at four waters with species by spot, a rod and bobber, fish to sell or barter. */
export const id='stats-progression';

/* ---------------------------------------------------------------- data ---------------------------------------------------------------- */
/* Five ceilings per breed on the 1-10 scale, Star-Equestrian style: sprinters, jumpers and stayers instead of one tier number.
   Order: speed, stamina, jump, accel, agility. Missing keys fall back to the tier formula in statCeil. */
const CEIL_ROWS={
 'bay-sporthorse':[8,8,8,8,8], bay:[8,6,6,10,7], chestnut:[5,8,6,6,8], iceland:[6,9,5,6,7], welsh:[6,7,8,7,8],
 palomino:[8,9,7,8,7], haflinger:[7,9,7,7,8], grey:[7,7,8,8,10], stock:[7,9,9,7,8], fjord:[6,10,6,7,8], morgan:[8,8,7,9,8],
 black:[7,10,9,8,10], pinto:[8,6,6,10,8], appaloosa:[8,9,8,8,10], thoro:[10,8,7,9,7], knab:[7,8,10,7,9], vanner:[6,10,8,7,8], marwari:[8,9,7,8,10],
 sunset:[8,10,8,7,9], lipiz:[7,8,9,8,10], sport:[10,8,7,10,9], akhal:[10,10,7,8,8],
 percheron:[6,10,7,6,7], shire:[6,10,10,6,7], clyde:[7,10,8,7,8],
 unicorn:[9,9,10,9,10], pegasus:[10,9,10,8,9], kestrel:[10,10,9,9,10],
 aether:[10,10,8,10,9], sunspear:[10,10,8,9,10], meadowlight:[9,8,10,10,9], tempest:[9,10,10,8,9], eclipse:[10,9,8,10,9], glacier:[8,10,10,8,9],
 celestial:[9,10,10,9,10], ember:[10,9,8,10,9], frost:[8,10,10,8,9], aurora:[10,10,9,9,10], phoenix:[10,9,10,10,9], shadowmare:[10,9,8,10,10],
 frostdrake:[9,10,10,9,10], emberdrake:[10,9,10,10,9], amethyst:[10,10,9,10,10], stormdrake:[10,10,10,9,10], verdant:[9,10,10,10,10],
};
/* Breed learning traits: a stat this breed picks up faster (stat-XP multiplier). */
const BREED_SXP={bay:{accel:1.25},thoro:{speed:1.2},black:{agility:1.15},sunset:{stamina:1.2},grey:{agility:1.15},shire:{jump:1.2},
 palomino:{stamina:1.15},akhal:{speed:1.15},knab:{jump:1.15},fjord:{stamina:1.2},stock:{jump:1.15},sport:{accel:1.15},morgan:{accel:1.1},
 meadowlight:{jump:1.2},aether:{speed:1.2},tempest:{jump:1.2},eclipse:{speed:1.2},unicorn:{agility:1.15},pegasus:{jump:1.15}};
const TRAIT_LBL={bay:'Quick Learner',thoro:'Born to Run',black:'Dancer',sunset:'Desert Heart',grey:'Ballet Blood',shire:'Mighty Spring',palomino:'Range Tough',
 akhal:'Golden Stride',knab:'Spotted Spring',fjord:'Fjord Lungs',stock:'Stockman\'s Leap',sport:'Arena Bred',morgan:'Willing',meadowlight:'Aurora Leap',
 aether:'Starlight Stride',tempest:'Storm Spring',eclipse:'Night Runner',unicorn:'Moonlit Grace',pegasus:'Sky Bound'};

/* Feed bags: a fixed chunk of horse XP, five rarities. */
const FEED_BAGS={
 bag1:{label:'Meadow Feed Bag',rar:'Common',xp:40,emoji:'🛍️',price:60},
 bag2:{label:'Barley Feed Bag',rar:'Uncommon',xp:200,emoji:'🛍️',price:250},
 bag3:{label:'Canyon Feed Bag',rar:'Rare',xp:500,emoji:'🎒',price:0},
 bag4:{label:'Alpine Feed Bag',rar:'Epic',xp:1000,emoji:'🎒',price:0},
 bag5:{label:'Kestrel Feed Bag',rar:'Legendary',xp:2000,emoji:'👝',price:0},
};
const FEED_TIER_SXP={1:6,2:12,3:24,4:48};   // 1:2:4:8 like the original, scaled to statNeed 20+10v
/* The stat foods. Existing rows are re-tiered to the table; new rows fill every tier × stat.
   shop:false means only a trader or the world has it. `where` is the region it grows in. */
const FOOD_ROWS={
 carrot:{tier:1,stat:'speed',price:5},
 apple:{tier:1,stat:'stamina',price:12,where:'the Cottonwood orchard'},
 lettuce:{tier:1,stat:'agility',price:9,where:'the home meadow'},
 pumpkin:{tier:1,stat:'accel',price:14,where:'Barleyfold'},
 sweetpea:{tier:1,stat:'jump',price:10,where:'the ranch garden',row:{hunger:10,bond:2,happy:4,xp:5,emoji:'🫛',label:'Sweet Peas'}},
 hay:{tier:1,price:8},
 berries:{tier:2,stat:'speed',price:18,where:'under the pines',row:{hunger:8,bond:3,happy:8,xp:6,emoji:'🫐',label:'Huckleberries'}},
 orange:{tier:2,stat:'accel',price:16,where:'Coyote Canyon'},
 cress:{tier:2,stat:'agility',price:15,where:'the banks at Otter Ford',row:{hunger:8,bond:2,happy:5,xp:5,emoji:'🌿',label:'Watercress'}},
 watermelon:{tier:2,stat:'jump',price:20,where:'the Barleyfold fields',row:{hunger:22,bond:4,happy:10,xp:7,emoji:'🍉',label:'Watermelon'}},
 strawberry:{tier:2,stat:'stamina',price:16,where:'the Cottonwood gardens',row:{hunger:8,bond:4,happy:9,xp:6,emoji:'🍓',label:'Strawberries'}},
 honey:{tier:3,stat:'speed',price:34,shop:false,where:'the Loon Lake hives',trader:'nell',row:{hunger:10,bond:5,happy:10,xp:8,emoji:'🍯',label:'Wild Honey'}},
 pricklypear:{tier:3,stat:'accel',price:30,shop:false,where:'the canyon floor',trader:'rosa',row:{hunger:12,bond:3,happy:6,xp:8,emoji:'🌵',label:'Prickly Pear'}},
 truffle:{tier:3,stat:'jump',price:36,where:'under the pines',trader:'tomas'},
 corn:{tier:3,stat:'stamina',price:28,shop:false,where:'the Barleyfold rows',trader:'hollis',row:{hunger:28,bond:3,happy:6,xp:8,emoji:'🌽',label:'Sweetcorn'}},
 snowmoss:{tier:3,stat:'agility',price:32,shop:false,where:'the Hollowpeak snowline',trader:'tomas',row:{hunger:6,bond:4,happy:5,xp:8,emoji:'🪴',label:'Snow Moss'}},
 oats:{tier:3,stat:'speed',price:30},
 grapes:{tier:4,stat:'stamina',price:70,shop:false,where:'the Loon Lake terraces',trader:'nell',row:{hunger:12,bond:6,happy:12,xp:10,emoji:'🍇',label:'Lake Grapes'}},
 daikon:{tier:4,stat:'agility',price:75,shop:false,where:'inside the Barleyfold fences',trader:'hollis',row:{hunger:18,bond:4,happy:6,xp:10,emoji:'🫚',label:'Daikon Radish'}},
 chestnut:{tier:4,stat:'jump',price:70,shop:false,where:'the Hollowpeak groves',trader:'tomas',row:{hunger:14,bond:5,happy:8,xp:10,emoji:'🌰',label:'Sweet Chestnut'}},
 zucchini:{tier:4,stat:'accel',price:65,shop:false,where:'the Barleyfold walled garden',trader:'hollis',row:{hunger:16,bond:4,happy:6,xp:10,emoji:'🥒',label:'Zucchini'}},
 royaljelly:{tier:4,stat:'speed',price:90,shop:false,where:'the Loon Lake hives (rare)',trader:'nell',row:{hunger:6,bond:8,happy:14,xp:12,emoji:'🐝',label:'Royal Jelly'}},
};
const TIER_LBL={1:'🧺 Everyday feed · +6 stat XP',2:'🌾 Foraged — grows out in the regions · +12 stat XP',3:'✨ Good feed · +24 stat XP',4:'💎 Rare finds · +48 stat XP'};

/* Fish: sold for coins or bartered at Nell's stall; a horse will not eat them. */
const FISH={
 bass:{label:'Loon Bass',emoji:'🐟',sell:40,tier:1},
 chub:{label:'Otter Chub',emoji:'🐟',sell:45,tier:1},
 trout:{label:'Basin Trout',emoji:'🐠',sell:70,tier:2},
 char:{label:'Falls Char',emoji:'🐠',sell:110,tier:3},
 goldperch:{label:'Golden Loon Perch',emoji:'🐡',sell:150,tier:3,gem:1},
};
/* Where to fish, and what bites there. Odds are cumulative rolls; 'bottle' is a message bottle. */
const FISH_SPOTS=[
 {id:'lake',name:'Loon Lake',x:20,z:16,odds:[['bottle',0.05],['goldperch',0.15],['trout',0.45],['bass',1]]},
 {id:'ford',name:'Otter Ford',x:14,z:null,odds:[['bottle',0.05],['bass',0.2],['trout',0.5],['chub',1]]},
 {id:'falls',name:'Hollowpeak Falls',x:-146,z:-218,odds:[['bottle',0.05],['goldperch',0.15],['trout',0.55],['char',1]]},
 {id:'creek',name:'Canyon Creek',x:null,z:150,odds:[['bottle',0.05],['char',0.15],['bass',0.45],['chub',1]]},
];

/* The traders. Each stall carries its region's food; every stall sells supplements. */
const TRADERS=[
 {id:'marta',name:'Marta',icon:'🧺',town:'Cottonwood',x:58,z:-44,hat:'#7fae5e',shirt:'#e0c48a',idle:'Fresh from the orchard and the gardens — apples, strawberries, peas. Have a look at the stall.',stock:['apple','strawberry','sweetpea','lettuce','carrot','hay','bag1']},
 {id:'hollis',name:'Hollis',icon:'🌽',town:'Barleyfold',x:222,z:-104,hat:'#a8783a',shirt:'#c9a24a',idle:'Barleyfold grows the odd stuff the valley can\'t: daikon, zucchini, the sweetest corn. Priced fair.',stock:['pumpkin','watermelon','corn','daikon','zucchini','hay','bag1','bag2']},
 {id:'rosa',name:'Rosa',icon:'🌵',town:'Coyote Canyon',x:-216,z:134,hat:'#c94f3a',shirt:'#e8a05a',idle:'Prickly pear takes patience to pick. Buy it here and keep your hands whole, partner.',stock:['orange','pricklypear','oats','carrot','hay','bag1','bag2']},
 {id:'tomas',name:'Tomas',icon:'🌲',town:'Hollowpeak',x:-156,z:-192,hat:'#4a6a4a',shirt:'#8aa0b8',idle:'Truffles, huckleberries, chestnuts and the moss that grows where the snow stops. Mountain food for a mountain horse.',stock:['berries','truffle','snowmoss','chestnut','apple','bag1','bag2']},
 {id:'nell',name:'Nell',icon:'🎣',town:'Loon Lake',x:30,z:28,hat:'#3b6fd6',shirt:'#f0e6d2',idle:'I keep the hives and buy whatever you pull out of the lake. Three fish for a jar of honey — that\'s the going rate.',stock:['honey','grapes','royaljelly','cress','strawberry','bag1'],buysFish:true},
];
/* What each built-in event trains. Rows from other packages get a default by kind. */
const EVENT_TRAINS={h1:['jump','agility'],h2:['jump','agility'],a1:['jump','agility'],a2:['stamina','jump'],b1:['jump','agility'],b2:['jump','agility'],
 w1:['jump','agility'],w2:['jump','agility'],tc:['jump','agility'],rr:['speed','stamina'],r1:['speed','stamina'],r2:['speed','stamina'],pp:['speed','accel'],
 bd:['speed','accel'],wt:['speed','stamina'],d1:['agility','accel'],d2:['agility','accel']};

/* ------------------------------------------------------------- install ------------------------------------------------------------- */
export function install(G){
 const {THREE,toast,$}=G, T=G.tables, W=G.world, X=G.xp, S=G.save, M=G.money, Q=G.quest;
 const STAT_KEYS=T.STAT_KEYS, STAT_LBL=T.STAT_LBL, FOODS3=T.FOODS3, EVENTS3=T.EVENTS3, BREEDS3=T.BREEDS3;
 const short=k=>STAT_LBL[k].slice(STAT_LBL[k].indexOf(' ')+1);
 const glyph=k=>STAT_LBL[k].slice(0,STAT_LBL[k].indexOf(' '));
 const rideIdx=()=>G.horse.rideIdx();
 const dist=(x,z)=>Math.hypot(G.horse.player.pos.x-x,G.horse.player.pos.z-z);
 T.FEED_BAGS=FEED_BAGS; T.FISH=FISH; T.FISH_SPOTS=FISH_SPOTS; T.TRADERS=TRADERS; T.BREED_SXP=BREED_SXP; T.FEED_TIER_SXP=FEED_TIER_SXP;

 /* ---- save shape ---- */
 S.ensure(s=>{
  s.items=s.items||{};
  s.fish=s.fish||{n:0,bottles:0}; if(!s.fish.spots)s.fish.spots={};
  s.traders=s.traders||{};
  s.perks=s.perks||{};
  s.life=s.life||{since:Date.now()};
 });

 /* ================= 1. per-breed ceilings ================= */
 for(const k in CEIL_ROWS){const r=CEIL_ROWS[k];T.BREED_CEIL[k]={speed:r[0],stamina:r[1],jump:r[2],accel:r[3],agility:r[4]};}
 for(const b of BREEDS3)if(!T.BREED_CEIL[b[0]]){const v=Math.min(10,(T.TIER_BASE[b[2]]||4)+5);T.BREED_CEIL[b[0]]={speed:v,stamina:v,jump:v,accel:v,agility:v};}   // a package's new breed: tier value until it sets its own
 const clampToCeil=(s,h)=>{if(!h||!h.stats)return;for(const k of STAT_KEYS){const c=X.statCeil(h,k);if(h.stats[k]>c)h.stats[k]=c;}};
 G.on('grantHorse',(s,h)=>{clampToCeil(s,h);});
 G.on('foal',(s,foal)=>{clampToCeil(s,foal);});
 const ceilStrip=(h)=>STAT_KEYS.map(k=>glyph(k)+X.statCeil(h,k)).join(' ');
 G.ui.section('shopHorseRow',(b,s)=>' · <span title="Breed ceilings: speed · stamina · jump · acceleration · agility" style="white-space:nowrap">'+ceilStrip({breed:b[0]})+'</span>');
 G.ui.stableRow((h,i)=>'<span title="Lv '+(h.level||1)+'/'+X.MAX_LEVEL+' · breed ceilings" style="font-size:11px;color:#8c7a63;white-space:nowrap">'+ceilStrip(h)+'</span>');

 /* ================= 2. level & XP readout, quest XP ================= */
 const xpNeed=h=>50+(h.level||1)*50;
 const xpFactors=(s,h)=>{                    // every 'xp' factor with a name, for the breakdown line
  const out=[];const push=(lbl,v)=>{if(Math.abs(v-1)>0.001)out.push([lbl,v]);};
  const L=G.mul('xp',s,h);
  push('ranch level',(function(){try{return G.mul('xp',null,null);}catch(e){return 1;}})());
  if(h){ push('bond',bondMul(h)); push('tack',tackMul(s,h)); push('breed mastery',X.masteryOf(s,h.breed)>=10?1.1:1); }
  push('achievement perk',(s.perks&&s.perks.xp)?1.10:1);
  return {total:L,parts:out};
 };
 G.ui.careHeader((s,h)=>{
  const f=xpFactors(s,h), pct=Math.round((f.total-1)*100);
  const atMax=(h.level||1)>=X.MAX_LEVEL;
  return '<div style="font-size:12px;margin:2px 0 4px">📈 <b>Level '+(h.level||1)+' / '+X.MAX_LEVEL+'</b> · '+(atMax?'full potential reached':(h.xp||0)+' / '+xpNeed(h)+' XP to Lv '+((h.level||1)+1))
   +' · <span title="'+(f.parts.length?f.parts.map(p=>p[0]+' ×'+p[1].toFixed(2)).join(', '):'no bonuses yet — bond, tack, mastery and achievements all add up')+'">✨ XP bonus +'+Math.max(0,pct)+'%</span>'
   +(f.parts.length?' <span style="color:#8c7a63">('+f.parts.map(p=>p[0]+' +'+Math.round((p[1]-1)*100)+'%').join(', ')+')</span>':'')+'</div>';
 });
 /* dailies and story hand out horse XP now (paid through the reward kinds registered in ranch3d) */
 for(const q of Q.DAILYQ){ if(q.type==='event')q.r.bag=q.r.bag||'bag2'; if(q.type==='gallop2k')q.r.bag=q.r.bag||'bag3'; if(q.type==='cleanjump')q.r.xp=q.r.xp||30; if(q.type==='tame')q.r.xp=q.r.xp||60; if(q.type==='fish')q.label='Catch 2 fish at any water'; }
 for(const m of Q.STORY){ if(m.reward&&!m.reward.xp&&m.reward.c)m.reward.xp=Math.max(10,Math.round(m.reward.c/5)); }   // roughly a fifth of the coin value as horse XP

 /* ================= 3. feed bags ================= */
 M.rewardKind('bag',(s,v)=>{s.items=s.items||{};if(typeof v==='string')s.items[v]=(s.items[v]||0)+1;else if(v&&typeof v==='object')for(const k in v)s.items[k]=(s.items[k]||0)+v[k];},
  v=>typeof v==='string'?(FEED_BAGS[v]?FEED_BAGS[v].emoji+' '+FEED_BAGS[v].label:'feed bag'):Object.keys(v).map(k=>v[k]+'× '+(FEED_BAGS[k]?FEED_BAGS[k].label:k)).join(' '));
 M.rewardKind('perk',(s,v)=>{s.perks=s.perks||{};s.perks[v]=true;},v=>({xp:'+10% horse XP perk',sxp:'+10% stat XP perk'})[v]||v+' perk');
 const bagsOwned=s=>Object.keys(FEED_BAGS).filter(k=>(s.items[k]||0)>0);
 G.ui.careSection((s,h)=>{
  const own=bagsOwned(s);
  return '<div class="crow" style="gap:6px;flex-wrap:wrap;margin-top:4px"><span class="lbl" style="font-size:11px" title="Feed bags give a fixed chunk of horse XP. They drop from events, chests, daily quests and achievements.">🛍️ Feed bags</span>'
   +(own.length?own.map(k=>'<button data-fx="sp:bag:'+k+'" title="'+FEED_BAGS[k].label+' · '+FEED_BAGS[k].rar+' · +'+FEED_BAGS[k].xp+' horse XP" style="border-left:4px solid '+T.RAR_COL[FEED_BAGS[k].rar]+'">'+FEED_BAGS[k].emoji+' '+FEED_BAGS[k].label.replace(' Feed Bag','')+' ×'+s.items[k]+' <span style="color:#8c7a63;font-size:11px">+'+FEED_BAGS[k].xp+' XP</span></button>').join('')
    :'<span style="font-size:11px;color:#8c7a63">none yet — win events, open chests, finish dailies</span>')+'</div>';
 });
 G.ui.action('sp',(args)=>{
  const what=args[0];
  if(what==='bag')useBag(args[1]);
  else if(what==='buy')buyFood(args[1],+args[2]||1);
  else if(what==='sell')sellFish(args[1],+args[2]||1);
  else if(what==='barter')barterFish();
  else if(what==='trader'){shopTrader=args[1];const d=$('dlg');if(d)d.style.display='none';G.ui.openShop('food');}
  else if(what==='shelf'){shopTrader=null;G.ui.openShop('food');}
  else if(what==='supp'){/* handled by the built-in data-supp binding */}
 });
 function useBag(k){
  const B=FEED_BAGS[k]; if(!B)return;
  let ok=false,name='';
  S.sync(s=>{const h=s.horses[rideIdx()];if(!h)return;if((s.items[k]||0)<=0)return;if((h.level||1)>=X.MAX_LEVEL){name='max';return;}s.items[k]--;name=h.name;ok=true;});
  if(name==='max'){toast('This horse is already at level '+X.MAX_LEVEL+' — save the bag for a younger one.');return;}
  if(!ok){toast('No '+B.label+' left.');return;}
  X.addXp3D(B.xp);
  G.sChime(); toast(B.emoji+' '+name+' ate the '+B.label+' · +'+B.xp+' horse XP (before bonuses)');
  Q.dailyEvt('bag',1); G.xp.passAdd(3);
  G.ui.renderCare();
 }
 G.on('courseFinish',({ev,stars,RB,dressage})=>{
  /* a feed bag for a good round, one rarity better when the event is featured */
  const r=Math.random(); let bag=null;
  if(stars>=3&&r<0.4)bag='bag2'; else if(r<0.25)bag='bag1';
  if(bag&&RB&&RB.featured)bag='bag'+Math.min(5,+bag.slice(3)+1);
  if(bag){S.sync(s=>{s.items[bag]=(s.items[bag]||0)+1;});toast('🛍️ Prize: a '+FEED_BAGS[bag].label+' ('+FEED_BAGS[bag].rar+')');}
 });

 /* ================= 4. the stat-food table & the shop shelf ================= */
 for(const k in FOOD_ROWS){
  const d=FOOD_ROWS[k];
  if(!FOODS3[k])FOODS3[k]=Object.assign({price:d.price,emoji:'🧺',label:k},d.row||{});
  const f=FOODS3[k];
  f.tier=d.tier; if(d.stat){f.stat=d.stat;f.sxp=FEED_TIER_SXP[d.tier];} else {delete f.stat;delete f.sxp;}
  if(d.price)f.price=d.price; if(d.where)f.where=d.where; if(d.shop===false)f.shop=false; if(d.trader)f.trader=d.trader;
 }
 Object.assign(T.FEED_TIER_LBL,TIER_LBL);
 const foodsOfTier=t=>Object.keys(FOODS3).filter(k=>(FOODS3[k].tier||1)===t);
 const traderOf=k=>TRADERS.find(t=>t.stock.includes(k));
 let shopTrader=null;
 function buyFood(k,n){
  const f=FOODS3[k]||FEED_BAGS[k]; if(!f)return;
  const tr=shopTrader&&TRADERS.find(t=>t.id===shopTrader);
  if(!tr&&FOODS3[k]&&FOODS3[k].shop===false){toast('Only '+(traderOf(k)?traderOf(k).name+' in '+traderOf(k).town:'the wild')+' has '+f.label+'.');return;}
  if(!tr&&FEED_BAGS[k]&&!FEED_BAGS[k].price){toast(f.label+'s are prizes — win events and open chests.');return;}
  if(tr&&!tr.stock.includes(k)){toast(tr.name+' does not stock that.');return;}
  const price=(f.price||0)*n; let ok=false;
  S.sync(s=>{if(s.coins<price)return;s.coins-=price;s.items[k]=(s.items[k]||0)+n;if(tr)s.traders[tr.id]=(s.traders[tr.id]||0)+1;ok=true;});
  if(!ok){toast('Not enough coins!');return;}
  G.sCoin(); M.refreshWallet(); G.ui.openShop('food');
 }
 function sellFish(k,n){
  const F=FISH[k]; if(!F)return; let sold=0;
  S.sync(s=>{const have=s.items[k]||0;sold=Math.min(have,n);if(!sold)return;s.items[k]=have-sold;s.coins+=F.sell*sold;s.stats=s.stats||{};s.stats.earned=(s.stats.earned||0)+F.sell*sold;M.logEarn(s,F.sell*sold);s.life.fishSold=(s.life.fishSold||0)+sold;});
  if(!sold){toast('Nothing to sell.');return;}
  G.sCoin(); M.refreshWallet(); toast('💰 Sold '+sold+' '+F.emoji+' '+F.label+' for '+(F.sell*sold)+'🪙'); G.ui.openShop('food');
 }
 function barterFish(){
  let ok=false;
  S.sync(s=>{const keys=Object.keys(FISH).filter(k=>(s.items[k]||0)>0);let n=keys.reduce((a,k)=>a+s.items[k],0);if(n<3)return;let need=3;for(const k of keys){const take=Math.min(need,s.items[k]);s.items[k]-=take;need-=take;if(!need)break;}s.items.honey=(s.items.honey||0)+1;s.traders.nell=(s.traders.nell||0)+1;ok=true;});
  toast(ok?'🍯 Nell trades three fish for a jar of Wild Honey.':'Nell wants three fish for a jar of honey.');
  if(ok){G.sChime();G.ui.openShop('food');}
 }
 const foodRow=(s,k,price,buyable,note)=>{const f=FOODS3[k];return '<div class="evrow">'+f.emoji+' <b>'+f.label+'</b><span>'+(price?price+' 🪙 each · ':'')+'you have '+(s.items[k]||0)+(f.stat?' · trains '+STAT_LBL[f.stat]+' +'+f.sxp+' XP':' · fills the belly')+(f.where?' · grows in '+f.where:'')+(note?' · '+note:'')+'</span>'
  +(buyable?'<button data-fx="sp:buy:'+k+':1">+1</button><button data-fx="sp:buy:'+k+':5">+5</button>':'')+'</div>';};
 const bagRow=(s,k,buyable)=>{const B=FEED_BAGS[k];return '<div class="evrow" style="border-left:4px solid '+T.RAR_COL[B.rar]+'">'+B.emoji+' <b>'+B.label+'</b><span>'+B.rar+' · +'+B.xp+' horse XP · you have '+(s.items[k]||0)+(buyable?' · '+B.price+' 🪙':' · a prize from events, chests and quests')+'</span>'+(buyable?'<button data-fx="sp:buy:'+k+':1">+1</button>':'')+'</div>';};
 const suppRows=(s,h)=>{const SUPPS=T.SUPPS||{};return '<div style="font-size:12px;color:#8c7a63;margin:10px 0 2px">💊 Supplements · straight onto '+(h?h.name:'your horse')+'</div>'
  +Object.keys(SUPPS).map(k=>{const Sp=SUPPS[k],at=h&&h.stats?h.stats[k]:0,cap=h?Math.min(X.statCap(h),X.statCeil(h,k)):10,maxed=at>=cap;
   return '<div class="evrow"'+(maxed?' style="opacity:.5"':'')+'>'+Sp.emoji+' <b>'+Sp.label+'</b><span>+'+Sp.sxp+' '+short(k)+' XP · now '+at+'/'+cap+'</span>'+(maxed?'<span style="font-size:11px;color:#8c7a63">at its ceiling</span>':'<button data-supp="'+k+'"'+(s.coins<Sp.price?' disabled':'')+'>'+Sp.price+' 🪙</button>')+'</div>';}).join('')
  +'<div style="font-size:11px;color:#8c7a63">A stat cannot go past its cap — level the horse up, and mind the breed ceiling.</div>';};
 const fishRows=s=>{const own=Object.keys(FISH).filter(k=>(s.items[k]||0)>0);if(!own.length)return '';
  return '<div style="font-size:12px;color:#8c7a63;margin:10px 0 2px">🎣 Your catch · sells for coins</div>'+own.map(k=>'<div class="evrow">'+FISH[k].emoji+' <b>'+FISH[k].label+'</b><span>'+FISH[k].sell+' 🪙 each · you have '+s.items[k]+'</span><button data-fx="sp:sell:'+k+':1">Sell 1</button><button data-fx="sp:sell:'+k+':'+s.items[k]+'">Sell all</button></div>').join('');};
 G.ui.shopTab({id:'food',label:'🧺 Food',render(s,h){
  if(shopTrader){const tr=TRADERS.find(t=>t.id===shopTrader);if(!tr||dist(tr.x,tr.z)>16)shopTrader=null;}
  const tr=shopTrader&&TRADERS.find(t=>t.id===shopTrader);
  let html='';
  if(tr){
   html+='<div class="ph" style="font-size:14px">'+tr.icon+' '+tr.name+'\'s stall · '+tr.town+' <button data-fx="sp:shelf" style="margin-left:auto;font-size:11px">🛍️ the ranch shelf</button></div>'
    +'<div style="font-size:11px;color:#8c7a63;margin-bottom:4px">A resource trader: buy stat food for coins if you would rather not forage. Only wild-picked food earns club ⭐.</div>'
    +tr.stock.filter(k=>FOODS3[k]).map(k=>foodRow(s,k,FOODS3[k].price,true)).join('')
    +tr.stock.filter(k=>FEED_BAGS[k]).map(k=>bagRow(s,k,true)).join('')
    +(tr.buysFish?'<div style="font-size:12px;color:#8c7a63;margin:10px 0 2px">🎣 Nell buys fish · or trades 3 of any fish for 🍯 Wild Honey</div>'+(fishRows(s)||'<span style="font-size:11px;color:#8c7a63">Bring her something from the lake or the river.</span>')+'<div class="evrow">🍯 <b>Three fish for a jar of honey</b><span>any species</span><button data-fx="sp:barter">Trade</button></div>':'')
    +suppRows(s,h);
   return html;
  }
  html+=[1,2,3,4].map(t=>'<div style="font-size:12px;color:#8c7a63;margin:8px 0 2px">'+T.FEED_TIER_LBL[t]+'</div>'
   +foodsOfTier(t).map(k=>{const f=FOODS3[k],onShelf=f.shop!==false,trd=traderOf(k);return foodRow(s,k,onShelf?f.price:0,onShelf,onShelf?'':(trd?'sold by '+trd.name+' in '+trd.town:'forage only'));}).join('')).join('')
   +'<div style="font-size:12px;color:#8c7a63;margin:8px 0 2px">🛍️ Feed bags · a fixed chunk of horse XP</div>'
   +Object.keys(FEED_BAGS).map(k=>bagRow(s,k,!!FEED_BAGS[k].price)).join('')
   +fishRows(s)
   +suppRows(s,h)
   +'<div class="evrow">🎁 <b>Food Hamper</b><span>15🥕 + 8🍎 + 8🌾 (save 36🪙)</span><button data-bundle="hamper">99 🪙</button></div>'
   +'<div class="evrow">🎀 <b>Breeder\'s Package</b><span>one FREE breeding + 10🍎</span><button data-bundle="breeder">350 🪙</button></div>';
  return html;
 }});
 /* the daily 'forage' quest and its achievement counterpart */
 Q.addDaily({type:'forage',icon:'🧺',label:'Forage 4 wild foods',goal:4,r:{c:120,g:1,p:10,bag:'bag1'}});
 Q.addDaily({type:'bag',icon:'🛍️',label:'Feed a horse a feed bag',goal:1,r:{c:100,g:1,p:10,xp:20}});
 Q.addDaily({type:'sxp',icon:'📈',label:'Raise any stat by a point',goal:1,r:{c:120,g:1,p:10}});

 /* ================= 5. foraging in the world ================= */
 const blob=W.blob, tube=W.tube;
 const mk={
  sweetpea:()=>{const g=new THREE.Group();tube(0.02,0.02,0.5,'#5f9a4a',0,0.25,0,g);[[0.05,0.28],[-0.06,0.38],[0.04,0.46]].forEach(q=>blob(0.05,0.12,0.04,'#8ccf6a',q[0],q[1],0,g).rotation.z=0.5);return g;},
  berries:()=>{const g=new THREE.Group();blob(0.28,0.22,0.28,'#3f6f3a',0,0.2,0,g);[[0.1,0.3,0.1],[-0.12,0.28,0.06],[0.02,0.36,-0.12],[-0.04,0.24,0.16]].forEach(q=>blob(0.05,0.05,0.05,'#4a3f9a',q[0],q[1],q[2],g));return g;},
  cress:()=>{const g=new THREE.Group();blob(0.22,0.1,0.22,'#4f9a5a',0,0.08,0,g);blob(0.14,0.1,0.14,'#7ccf7a',0.06,0.16,0.04,g);return g;},
  watermelon:()=>{const g=new THREE.Group();const m=blob(0.3,0.22,0.24,'#3f7d3a',0,0.2,0,g);blob(0.3,0.22,0.24,'#5a9a4a',0,0.2,0,g).scale.set(0.97,1.01,0.97);return g;},
  strawberry:()=>{const g=new THREE.Group();blob(0.2,0.12,0.2,'#5aa04a',0,0.1,0,g);[[0.06,0.16,0.04],[-0.07,0.15,-0.03]].forEach(q=>blob(0.06,0.07,0.06,'#d63a3a',q[0],q[1],q[2],g));return g;},
  apple:()=>{const g=new THREE.Group();blob(0.09,0.09,0.09,'#d6403a',0,0.1,0,g);blob(0.07,0.07,0.07,'#c8342f',0.16,0.08,0.06,g);return g;},
  honey:()=>{const g=new THREE.Group();blob(0.1,0.12,0.1,'#e8b04a',0,0.12,0,g);tube(0.02,0.02,0.1,'#6a4a2a',0,0.26,0,g);return g;},
  pricklypear:()=>{const g=new THREE.Group();blob(0.16,0.28,0.06,'#4f8a4a',0,0.28,0,g);blob(0.12,0.2,0.05,'#5a9a52',0.14,0.5,0,g);blob(0.06,0.07,0.06,'#c94f6a',0.14,0.7,0,g);blob(0.05,0.06,0.05,'#c94f6a',-0.1,0.56,0,g);return g;},
  corn:()=>{const g=new THREE.Group();tube(0.03,0.04,1.4,'#7aa04a',0,0.7,0,g);blob(0.06,0.18,0.06,'#e8c84a',0.07,0.8,0,g);blob(0.04,0.3,0.03,'#8cbf5a',-0.08,1.1,0.02,g).rotation.z=-0.5;return g;},
  snowmoss:()=>{const g=new THREE.Group();blob(0.26,0.08,0.24,'#a9d8c0',0,0.06,0,g);blob(0.14,0.06,0.14,'#dff3ea',0.08,0.12,0.05,g);return g;},
  grapes:()=>{const g=new THREE.Group();tube(0.02,0.03,0.9,'#6a4a2a',0,0.45,0,g);blob(0.14,0.2,0.1,'#6a3f8a',0,0.5,0.08,g);blob(0.1,0.14,0.08,'#7a4f9a',0.06,0.36,0.1,g);blob(0.12,0.05,0.12,'#5f9a4a',0,0.9,0,g);return g;},
  daikon:()=>{const g=new THREE.Group();blob(0.07,0.22,0.07,'#f2efe4',0,0.12,0,g);blob(0.1,0.12,0.1,'#6aa04a',0,0.36,0,g);return g;},
  chestnut:()=>{const g=new THREE.Group();blob(0.12,0.12,0.12,'#7aa04a',0,0.12,0,g);blob(0.08,0.07,0.08,'#6a3f22',0.12,0.07,0.06,g);return g;},
  zucchini:()=>{const g=new THREE.Group();blob(0.3,0.1,0.3,'#4f8a4a',0,0.08,0,g);const z=blob(0.06,0.06,0.2,'#2f6a3a',0.1,0.1,0.08,g);z.rotation.y=0.6;return g;},
  royaljelly:()=>{const g=new THREE.Group();blob(0.12,0.16,0.12,'#f0c84a',0,0.16,0,g);blob(0.05,0.05,0.05,'#3a2a1a',0.05,0.28,0.05,g);return g;},
 };
 /* orchard trees at Cottonwood, hives by the lake, corn rows and a walled garden at Barleyfold */
 const orchardTrees=[[62,-48],[66,-54],[71,-46],[75,-53],[64,-60],[70,-61],[78,-59],[60,-40],[68,-38],[76,-42],[82,-50],[58,-66]];
 const hives=[[38,32],[42,28],[36,38]];
 const cornRows=[[198,-92],[201,-92],[204,-92],[207,-92],[198,-88],[201,-88],[204,-88],[207,-88]];
 const smat=c=>new THREE.MeshStandardMaterial({color:c,roughness:0.85});
 const decor=new THREE.Group(); decor.name='Forage decor';
 for(const p of orchardTrees){const t=new THREE.Group();const trunk=new THREE.Mesh(new THREE.CylinderGeometry(0.14,0.2,1.6,7),smat('#5a3d22'));trunk.position.y=0.8;trunk.castShadow=true;t.add(trunk);
  const crown=new THREE.Mesh(new THREE.SphereGeometry(1.35,9,7),smat('#4f8a3f'));crown.position.y=2.2;crown.scale.set(1,0.85,1);crown.castShadow=true;t.add(crown);
  for(let i=0;i<3;i++){const a=new THREE.Mesh(new THREE.SphereGeometry(0.09,6,5),smat('#d6403a'));a.position.set(Math.cos(i*2.1)*1.0,1.9+i*0.25,Math.sin(i*2.1)*1.0);t.add(a);}
  t.position.set(p[0],W.groundH(p[0],p[1]),p[1]);decor.add(t);W.colliders.push({x:p[0],z:p[1],r:0.5});}
 for(const p of hives){const b=new THREE.Mesh(new THREE.BoxGeometry(0.5,0.6,0.5),smat('#e8dcc0'));b.position.set(p[0],W.groundH(p[0],p[1])+0.5,p[1]);b.castShadow=true;decor.add(b);const lid=new THREE.Mesh(new THREE.BoxGeometry(0.6,0.08,0.6),smat('#8a5a2a'));lid.position.set(p[0],W.groundH(p[0],p[1])+0.84,p[1]);decor.add(lid);}
 G.scene.add(decor);
 const spots={
  sweetpea:[0,5,26,48,6], berries:[-30,-58,6,30,8], cress:[8,118,6,30,7], watermelon:[232,-122,8,40,6], strawberry:[54,-38,6,26,7],
  apple:{at:orchardTrees,count:14,jitter:1.4}, honey:{at:hives,count:3,jitter:1.0}, pricklypear:[-228,142,16,100,6],
  corn:{at:cornRows,count:6,jitter:0.6}, snowmoss:[-160,-210,12,70,5], grapes:[46,12,8,26,3], daikon:[215,-105,3,22,4],
  chestnut:[-150,-190,10,60,3], zucchini:[240,-80,5,30,3], royaljelly:{at:hives,count:1,jitter:0.8},
 };
 for(const k in spots)W.addForageSpot(k,spots[k],mk[k]);
 W.mapMarkers.push({x:68,z:-52,glyph:'🍎',label:'🍎 Cottonwood orchard'},{x:40,z:32,glyph:'🍯'},{x:203,z:-90,glyph:'🌽'},{x:-30,z:-58,glyph:'🫐'},{x:-228,z:142,glyph:'🌵'},{x:-160,z:-210,glyph:'🪴'});
 /* wildlife by region: coyotes on the canyon floor, goats on the Hollowpeak scree */
 if(W.CRITTER_DEFS&&!W.CRITTER_DEFS.coyote){
  W.CRITTER_DEFS.coyote={size:0.9,gait:'walk4',speed:1.9,fleeR:11,fleeSpeed:9.5,dusky:true,detail:3,spook:true,
   body:[{x:0,y:0.52,z:0,r:0.2,sz:1.35,sy:0.85,c:'#b9a07a'},{x:0,y:0.53,z:-0.2,r:0.17,c:'#a8916c'},{x:0,y:0.46,z:0,r:0.15,sz:1.2,c:'#e2d4b4'},
    {x:0,y:0.6,z:0.24,r:0.14,c:'#b9a07a'},{x:0,y:0.72,z:0.36,r:0.1,sz:1.4,c:'#b9a07a'},{x:0,y:0.7,z:0.5,r:0.05,c:'#3a2e24'},
    {x:-0.08,y:0.84,z:0.3,r:0.045,sy:1.9,c:'#a8916c'},{x:0.08,y:0.84,z:0.3,r:0.045,sy:1.9,c:'#a8916c'}],
   eyes:[[-0.055,0.76,0.44],[0.055,0.76,0.44]],eyeR:0.018,
   tail:{x:0,y:0.5,z:-0.42,r:0.07,c:'#8a7658'},
   legs:{n:4,len:0.42,r:0.028,c:'#a8916c',pts:[[-0.09,0.15],[0.09,0.15],[-0.09,-0.16],[0.09,-0.16]]}};
  W.CRITTER_DEFS.goat={size:0.95,gait:'walk4',speed:1.3,fleeR:8,fleeSpeed:7.5,detail:3,spook:true,
   body:[{x:0,y:0.56,z:0,r:0.21,sz:1.25,sy:0.9,c:'#ece6d8'},{x:0,y:0.58,z:-0.18,r:0.18,c:'#e2dccc'},{x:0,y:0.68,z:0.26,r:0.12,sy:1.3,c:'#ece6d8'},
    {x:0,y:0.86,z:0.36,r:0.1,c:'#ece6d8'},{x:0,y:0.82,z:0.48,r:0.05,c:'#c9bfae'},
    {x:-0.07,y:1.0,z:0.3,r:0.03,sy:2.4,c:'#5a4a3a'},{x:0.07,y:1.0,z:0.3,r:0.03,sy:2.4,c:'#5a4a3a'},{x:0,y:0.66,z:0.5,r:0.04,sy:1.6,c:'#e2dccc'}],
   eyes:[[-0.06,0.88,0.42],[0.06,0.88,0.42]],eyeR:0.02,
   tail:{x:0,y:0.6,z:-0.36,r:0.05,c:'#e2dccc'},
   legs:{n:4,len:0.5,r:0.03,c:'#5a4a3a',pts:[[-0.1,0.16],[0.1,0.16],[-0.1,-0.16],[0.1,-0.16]]}};
  try{for(let i=0;i<3;i++)W.spawnCritter('coyote',-214,146,36);for(let i=0;i<3;i++)W.spawnCritter('goat',-168,-206,30);}catch(e){console.error('critters',e);}
 }
 let spookCd=0, spookT=0;
 G.on('ride',(RIDE,dt)=>{
  spookCd=Math.max(0,spookCd-dt);
  if(spookT>0){spookT-=dt;RIDE.spMul*=0.55;}
  if(spookCd>0||!W.critters||Math.abs(G.horse.player.speed)<4)return;
  const p=G.horse.player.pos;
  for(const c of W.critters){
   const D=c.def; if(!D||!(D.spook||c.key==='deer')||c.mode!=='flee')continue;
   if(Math.hypot(c.x-p.x,c.z-p.z)>3)continue;
   const h=G.horse.ridden(); if(h&&(h.bond||0)>=80){spookCd=6;return;}   // a well-bonded horse trusts you and holds its line
   G.horse.player.speed*=0.6; spookT=1.2; spookCd=8;
   G.beep(140,60,0.16,'square',0.12); toast('🐴 '+(h?h.name:'Your horse')+' spooked at a '+(c.key==='goat'?'mountain goat':c.key)+'! (bond ❤️ 80+ steadies a horse)');
   return;
  }
 });

 /* ================= 6. resource traders ================= */
 for(const tr of TRADERS){
  W.addNPC({id:tr.id,name:tr.name,icon:tr.icon,x:tr.x,z:tr.z,hat:tr.hat,shirt:tr.shirt,idle:tr.idle,trader:true,
   extraHtml:(s)=>'<button data-fx="sp:trader:'+tr.id+'" style="margin-right:6px">'+tr.icon+' Browse '+tr.name+'\'s stall</button>'});
  W.mapMarkers.push({x:tr.x,z:tr.z,glyph:'🧺',labelDz:9});
 }

 /* ================= 7. stat XP from events and races ================= */
 const trainsOf=ev=>ev.trains||EVENT_TRAINS[ev.id]||(ev.dressage?['agility','accel']:ev.race?['speed','stamina']:['jump','agility']);
 for(const ev of EVENTS3)if(!ev.trains)ev.trains=trainsOf(ev);
 G.ui.eventRow((ev)=>' · <span title="Stat XP on finishing">trains '+trainsOf(ev).map(k=>glyph(k)).join('')+'</span>');
 G.on('courseFinish',({ev,stars,RB,dressage,pct})=>{
  const keys=trainsOf(ev);
  let amt=Math.round((ev.reward||100)/10*(stars>=3?1.2:stars>=2?1:0.7));
  if(dressage)amt=Math.round(amt*Math.max(0.3,pct||0.5));
  if(RB&&RB.featured)amt=Math.round(amt*1.5);
  const parts=[]; let ups=0;
  S.sync(s=>{const h=s.horses[rideIdx()];if(!h)return;for(const k of keys){const R=X.grantStatXp(s,h,k,amt,'event');parts.push(R.capped?short(k)+' at cap':'+'+amt+' '+short(k)+' XP'+(R.up?' → '+h.stats[k]+'!':''));if(R.up)ups++;}});
  const fs=S.fresh(); const hh=fs&&fs.horses[rideIdx()], local=G.horse.myHorses[rideIdx()];
  if(hh&&local){local.stats=hh.stats;local.sxp=hh.sxp;}
  if(parts.length)setTimeout(()=>toast('📈 '+parts.join(' · ')+(RB&&RB.featured?' (featured ×1.5)':'')),400);
  if(ups){Q.dailyEvt('sxp',ups);Q.questEvt('train',ups);}
 });

 /* ================= 8. stackable XP multipliers ================= */
 function bondMul(h){const b=(h&&h.bond)||0;return b>=100?1.15:b>=80?1.10:b>=50?1.05:1;}
 function tackMul(s,h){
  if(!s||!h||!h.gear||!s.tack)return 1;
  const worn=T.GEAR_SLOTS.map(sl=>s.tack.find(t=>t.id===h.gear[sl]));
  if(worn.some(t=>!t))return 1;
  return worn.every(t=>T.RARITIES.indexOf(t.rarity)>=2)?1.05:1;   // four pieces, all Rare or better
 }
 G.addMul('xp',(s,h)=>h?bondMul(h):1);
 G.addMul('xp',(s,h)=>tackMul(s,h));
 G.addMul('xp',(s)=>(s&&s.perks&&s.perks.xp)?1.10:1);
 G.addMul('sxp',(s,h)=>(!G.mastery&&s&&h&&X.masteryOf(s,h.breed)>=5)?1.05:1);   // placeholder rung: the mastery-style ladder (G.mastery) replaces it with breed perks
 G.addMul('sxp',(s,h)=>(h&&(h.bond||0)>=80)?1.05:1);
 G.addMul('sxp',(s,h,k)=>(h&&BREED_SXP[h.breed]&&BREED_SXP[h.breed][k])||1);
 G.addMul('sxp',(s)=>(s&&s.perks&&s.perks.sxp)?1.10:1);
 if(!T.MASTERY_UNLOCKS[5])T.MASTERY_UNLOCKS[5]='+5% stat XP for this breed';
 G.ui.careSection((s,h)=>{
  const tr=BREED_SXP[h.breed]; const bits=[];
  if(tr)for(const k in tr)bits.push('🧬 '+(TRAIT_LBL[h.breed]||'Breed trait')+': +'+Math.round((tr[k]-1)*100)+'% '+short(k)+' XP');
  if(!G.mastery&&X.masteryOf(s,h.breed)>=5)bits.push('🎖️ mastery 5: +5% stat XP');
  if((h.bond||0)>=80)bits.push('❤️ bond 80+: +5% stat XP, steady around wildlife');
  if(s.perks&&s.perks.sxp)bits.push('🏅 Scholar perk: +10% stat XP');
  if(s.perks&&s.perks.xp)bits.push('🏅 Quick study perk: +10% horse XP');
  return bits.length?'<div style="font-size:11px;color:#5a4a3a;margin-top:4px">'+bits.join(' · ')+'</div>':'';
 });
 const maxLevel=s=>s.horses.reduce((a,h)=>Math.max(a,h.level||1),1);
 Q.addAch({id:'lvl10',icon:'📈',label:'Quick study',desc:'Raise a horse to level 10 (+10% horse XP forever)',v:maxLevel,goal:10,r:{c:300,perk:'xp'}});
 Q.addAch({id:'lvl25',icon:'📚',label:'Scholar of the Basin',desc:'Raise a horse to level 25 (+10% stat XP forever)',v:maxLevel,goal:25,r:{g:5,perk:'sxp'}});
 Q.addAch({id:'lvl50',icon:'🏔️',label:'Full potential',desc:'Raise a horse to level 50',v:maxLevel,goal:50,r:{g:10,k:2,bag:'bag5'}});
 Q.addAch({id:'forage50',icon:'🧺',label:'Gatherer',desc:'Forage 50 wild foods',v:s=>(s.life&&s.life.forage)||0,goal:50,r:{c:300,bag:'bag2'}});
 Q.addAch({id:'bags10',icon:'🛍️',label:'Well fed',desc:'Use 10 feed bags',v:s=>(s.life&&s.life.bag)||0,goal:10,r:{c:250,bag:'bag3'}});
 Q.addAch({id:'trader5',icon:'🧺',label:'Regular customer',desc:'Buy from all five traders',v:s=>Object.keys(s.traders||{}).length,goal:5,r:{g:3,bag:'bag2'}});
 Q.addAch({id:'maxstat',icon:'⛰️',label:'At the ceiling',desc:'Train any stat to its breed ceiling',v:s=>s.horses.some(h=>h.stats&&STAT_KEYS.some(k=>h.stats[k]>=X.statCeil(h,k)))?1:0,goal:1,r:{c:500,g:2}});
 Q.addAch({id:'fish25',icon:'🎣',label:'River angler',desc:'Catch 25 fish',v:s=>(s.fish&&s.fish.n)||0,goal:25,r:{c:400,k:1}});
 Q.addAch({id:'fishspots',icon:'🗺️',label:'Every water in the Basin',desc:'Catch a fish at all four fishing spots',v:s=>Object.keys((s.fish&&s.fish.spots)||{}).length,goal:4,r:{g:3,bag:'bag3'}});

 /* ================= 11. fishing ================= */
 {const i=W.things.findIndex(t=>t.kind==='fish'&&t.id==='lake');if(i>=0)W.things.splice(i,1);}   // the one built-in spot becomes four
 for(const sp of FISH_SPOTS){ if(sp.z==null)sp.z=W.riverZ(sp.x)+8.5; if(sp.x==null)sp.x=W.streamX(sp.z)+4.5; }
 let fs=null;               // {spot,t,bit,win}
 const rod=new THREE.Group(); rod.visible=false; G.scene.add(rod);
 const rodMesh=new THREE.Mesh(new THREE.CylinderGeometry(0.012,0.02,2.2,6),smat('#5a3d22')); rodMesh.position.set(0,1.1,0); rod.add(rodMesh);
 const lineGeo=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,2.2,0),new THREE.Vector3(0,0,3)]);
 const line=new THREE.Line(lineGeo,new THREE.LineBasicMaterial({color:0xf2efe4})); rod.add(line);
 const bobber=new THREE.Mesh(new THREE.SphereGeometry(0.09,8,6),new THREE.MeshStandardMaterial({color:0xd63a3a,roughness:0.4})); bobber.position.set(0,0,3); rod.add(bobber);
 const post=(x,z)=>{const g=new THREE.Group();const m=new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.08,1.1,6),smat('#6a4a2a'));m.position.y=0.55;m.castShadow=true;g.add(m);const sign=new THREE.Mesh(new THREE.BoxGeometry(0.5,0.3,0.05),smat('#e8dcc0'));sign.position.y=1.0;g.add(sign);g.position.set(x,W.groundH(x,z),z);return g;};
 const endFishing=(msg)=>{fs=null;rod.visible=false;if(msg)toast(msg);};
 for(const sp of FISH_SPOTS){
  const g=post(sp.x,sp.z); const sprite=G.nameSprite('🎣 '+sp.name); sprite.position.y=1.9; g.add(sprite);
  W.addThing({kind:'fishspot',id:sp.id,spot:sp,x:sp.x,z:sp.z,g,reach:8,
   label:()=>fs&&fs.spot.id===sp.id?(fs.bit?'❗ BITE — reel in (E)!':'🎣 Waiting for a bite…'):'🎣 Fish at '+sp.name+' (E)',
   use:()=>{
    if(!fs){fs={spot:sp,t:2+Math.random()*4,bit:false,win:0};rod.visible=true;toast('🎣 Cast into '+sp.name+'… keep still and wait for the bite');return;}
    if(fs.spot.id!==sp.id)return;
    if(!fs.bit){toast('Patience — nothing has bitten yet.');return;}
    let r=Math.random(), kind='bass'; for(const [k,p] of sp.odds){if(r<p){kind=k;break;}}
    let msg='';
    S.sync(s=>{
     s.fish=s.fish||{n:0,bottles:0}; s.fish.spots=s.fish.spots||{}; s.fish.n++; s.fish.spots[sp.id]=(s.fish.spots[sp.id]||0)+1;
     if(kind==='bottle'){s.fish.bottles++;s.coins+=60;s.keys=(s.keys||0)+1;msg='🍾 A bottle with a note! +60🪙 +1🗝️';return;}
     const F=FISH[kind]; s.items=s.items||{}; s.items[kind]=(s.items[kind]||0)+1; if(F.gem)M.grantGems(s,F.gem);
     msg=F.emoji+' Caught a '+F.label+'! (sells for '+F.sell+'🪙'+(F.gem?', +1💎':'')+') · you have '+s.items[kind];
    });
    M.refreshWallet(); G.sChime(); if(kind==='bottle'||kind==='goldperch')G.sGem();
    endFishing(msg); Q.dailyEvt('fish',1); X.passAdd(3);
   },
   tick:(dt,t,d)=>{
    if(!fs||fs.spot.id!==sp.id)return;
    const p=G.horse.player;
    if(Math.abs(p.speed)>0.6||d>8){endFishing('The line went slack.');return;}
    rod.position.set(p.pos.x,W.groundH(p.pos.x,p.pos.z)+1.0,p.pos.z); rod.rotation.y=p.heading; rodMesh.rotation.x=-0.6;
    bobber.position.y=(fs.bit?-0.35+Math.sin(performance.now()/60)*0.1:Math.sin(performance.now()/500)*0.05)-0.7; bobber.position.z=3;
    line.geometry.setFromPoints([new THREE.Vector3(0,2.0,0.4),bobber.position.clone()]);
    if(!fs.bit){fs.t-=dt;if(fs.t<=0){fs.bit=true;fs.win=1.2;G.sChime();toast('❗ Bite! Press E');}}
    else{fs.win-=dt;if(fs.win<=0)endFishing('It got away…');}
   }});
  W.mapMarkers.push({x:sp.x,z:sp.z,glyph:'🎣'});
 }

 /* ================= state / QA ================= */
 G.on('state',o=>{
  const s=S.fresh()||{}; const h=G.horse.ridden()||{};
  o.progression={level:h.level||1,xp:h.xp||0,maxLevel:X.MAX_LEVEL,statCap:h.level?X.statCap(h):null,
   ceilings:h.breed?Object.fromEntries(STAT_KEYS.map(k=>[k,X.statCeil(h,k)])):null,
   xpMul:Number(G.mul('xp',s,s.horses&&s.horses[rideIdx()]).toFixed(3)),
   fish:(s.fish&&s.fish.n)||0,bags:Object.keys(FEED_BAGS).reduce((a,k)=>a+((s.items&&s.items[k])||0),0),
   foods:Object.keys(FOODS3).length,forageKinds:Object.keys(W.FORAGE_SPOTS).length,fishing:fs?(fs.bit?'bite':'waiting'):null};
 });
 G.stats2={FEED_BAGS,FISH,FISH_SPOTS,TRADERS,FOOD_ROWS,EVENT_TRAINS,BREED_SXP,fishing:()=>fs,forceBite(){if(fs){fs.t=0;}},trader:()=>shopTrader,useBag,buyFood,sellFish};
}

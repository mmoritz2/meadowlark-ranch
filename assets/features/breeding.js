/* Feature package 'breeding' — the foaling barn and everything born in it.
   Marta's foaling barn by the pasture gate (a stallion, a mare, a wait, a foal); breeding
   tokens; cost by the parents' rarity; three classes of inheritable trait and the rules that
   pass them down; bloodline purity and the family tree; breeding potions; the foal stage
   (follows you, played with, grows up, cannot be ridden); coat genetics for real-breed foals;
   the fantasy recipe catalogue; eggs that want warming; wild-caught coats; the foal
   questline; and the horse sheet that shows all of it for any horse in the stable.

   Owned by this package: this file, the breed3 delegation, the foal ride gate in renderStable
   and horseSel, and the companion sync in reloadHorses. Nothing runs at import time. */
export const id='breeding';

/* ---------------------------------------------------------------------------------------
   DATA
   --------------------------------------------------------------------------------------- */
const BREED_BOND=40;                                     // a parent must trust you this much
const WILD_BREED_MS=72*3600e3;                           // a tamed horse passes its wild coat for three days
const EGG_HATCH_MS=24*3600e3, EGG_WARMS=5, EGG_WARM_GAP=20*60e3;
const TUTORIAL_MS=90e3;                                  // the very first foal comes quickly
/* Cost by the higher parent's rarity: coins, breeding tokens, or play-earned gems. */
const BREED_COST={Common:{c:300,t:1},Draft:{c:300,t:1},Uncommon:{c:450,t:1},Rare:{c:700,t:2},Epic:{c:1100,t:3},Legendary:{c:1600,t:4},Mythic:{c:1600,t:4},Dragon:{c:2200,t:5},Ascendant:{c:2600,t:5}};
const GEST_MIN={Common:8,Draft:8,Uncommon:10,Rare:14,Epic:18,Legendary:22,Mythic:22,Dragon:28,Ascendant:32};
const RAR_ORDER=['Common','Draft','Uncommon','Rare','Epic','Legendary','Mythic','Dragon','Ascendant'];

/* Class traits. Purebred = raw stat points per level; Crossbreed = stamina or XP boosts per
   level; Prestige = rare, any bloodline, sits in its own slot and stacks with either. */
const CLASS_TRAITS={
 truebred:{cls:'pure',label:'True Bred',icon:'🏵️',desc:'+1 to every stat per level',all:1},
 ironheart:{cls:'pure',label:'Iron Heart',icon:'🫀',desc:'+2 stamina per level',stamina:2},
 quickstart:{cls:'pure',label:'Quick Start',icon:'🚀',desc:'+2 acceleration per level',accel:2},
 highstep:{cls:'pure',label:'High Step',icon:'🦵',desc:'+2 jump per level',jump:2},
 longstride:{cls:'pure',label:'Long Stride',icon:'💨',desc:'+2 speed per level',speed:2},
 catfoot:{cls:'pure',label:'Cat Foot',icon:'🐾',desc:'+2 agility per level',agility:2},
 extraagility:{cls:'cross',label:'Extra Agility',icon:'🌀',desc:'+15% agility XP per level, once grown',sxp:{agility:.15}},
 longwind:{cls:'cross',label:'Long Wind',icon:'🌬️',desc:'The gallop drains 12% less stamina per level',drain:.12},
 quicklearner:{cls:'cross',label:'Quick Learner',icon:'📚',desc:'+10% XP per level',xp:.10},
 secondwind:{cls:'cross',label:'Second Wind',icon:'🔁',desc:'Stamina comes back 15% faster per level',regen:.15},
 hardy:{cls:'cross',label:'Hardy',icon:'🌿',desc:'+10% to every stat\'s XP per level',sxp:{all:.10}},
 sprintheart:{cls:'cross',label:'Sprint Heart',icon:'❤️‍🔥',desc:'+20% speed and acceleration XP per level',sxp:{speed:.2,accel:.2}},
 /* combinations: two different traits can fuse into one of these */
 steadyburst:{cls:'pure',label:'Steady Burst',icon:'⚡',desc:'+1 stamina and +1 acceleration per level',stamina:1,accel:1,combo:true},
 springheel:{cls:'pure',label:'Spring Heel',icon:'🦘',desc:'+1 agility and +1 jump per level',agility:1,jump:1,combo:true},
 thoroughline:{cls:'pure',label:'Thorough Line',icon:'📜',desc:'+1 to every stat and +1 speed per level',all:1,speed:1,combo:true},
 brightfoot:{cls:'cross',label:'Bright Foot',icon:'✨',desc:'+8% agility XP and +5% XP per level',sxp:{agility:.08},xp:.05,combo:true},
 deepbreath:{cls:'cross',label:'Deep Breath',icon:'🫧',desc:'Drains 8% less and recovers 8% faster per level',drain:.08,regen:.08,combo:true},
 keenstudent:{cls:'cross',label:'Keen Student',icon:'🎓',desc:'+6% XP and +6% to every stat\'s XP per level',xp:.06,sxp:{all:.06},combo:true},
 /* prestige */
 starborn:{cls:'prestige',label:'Starborn',icon:'🌟',desc:'+1 to every stat and +10% XP per level',all:1,xp:.10},
 meadowblessed:{cls:'prestige',label:'Meadow-Blessed',icon:'🌼',desc:'+2 stamina and the gallop drains 10% less per level',stamina:2,drain:.10},
 kestrelkin:{cls:'prestige',label:'Kestrel Kin',icon:'🪶',desc:'+2 speed and stamina comes back 10% faster per level',speed:2,regen:.10},
 basinlegend:{cls:'prestige',label:'Basin Legend',icon:'🏔️',desc:'+1 to every stat, +1 jump and +8% to every stat\'s XP per level',all:1,jump:1,sxp:{all:.08}},
};
const TRAIT_COMBOS={'ironheart+quickstart':'steadyburst','catfoot+highstep':'springheel','longstride+truebred':'thoroughline',
 'extraagility+quicklearner':'brightfoot','longwind+secondwind':'deepbreath','hardy+quicklearner':'keenstudent','extraagility+hardy':'keenstudent'};
const TRAIT_MAX_LVL=3, PRESTIGE_CHANCE=0.06;

/* Breeding potions. Consumed on one breeding; they drop from events, the week and the foal
   questline, and Marta sells them for coins — never gems. */
const POTIONS={
 mirror:{emoji:'🧪',label:'Mirror Draught',desc:'The foal copies one parent\'s coat, colours and markings exactly',price:600},
 hornbud:{emoji:'🦄',label:'Hornbud Tonic',desc:'The foal is born with a horn',price:900},
 starlight:{emoji:'✨',label:'Starlight Elixir',desc:'A glow and a rainbow flourish',price:750},
 prestige:{emoji:'👑',label:'Prestige Essence',desc:'Guarantees a Prestige trait, or raises the inherited one a level',price:1500},
};
const POT_KEYS=Object.keys(POTIONS);

/* Coat genetics for real breeds. Nine loci: extension and agouti make chestnut, bay or
   black; cream, dun and silver dilute; grey, roan, tobiano and leopard pattern. One allele
   from each parent per locus, so a foal can wear a coat neither parent showed. */
const LOCI=['E','A','Cr','D','G','Rn','To','Lp','Z'];
const DOM={E:'E',A:'A',Cr:'Cr',D:'D',G:'G',Rn:'Rn',To:'To',Lp:'Lp',Z:'Z'};
const REC={E:'e',A:'a',Cr:'n',D:'n',G:'n',Rn:'n',To:'n',Lp:'n',Z:'n'};
const BREED_GENES={
 'bay-sporthorse':{E:'Ee',A:'Aa'},bay:{E:'Ee',A:'Aa'},chestnut:{E:'ee',A:'AA'},palomino:{E:'ee',A:'Aa',Cr:'nCr'},haflinger:{E:'ee',A:'AA'},
 grey:{E:'Ee',A:'Aa',G:'nG'},black:{E:'EE',A:'aa'},pinto:{E:'Ee',A:'Aa',To:'nTo'},appaloosa:{E:'Ee',A:'Aa',Lp:'nLp'},sunset:{E:'ee',A:'Aa'},
 iceland:{E:'Ee',A:'Aa',Rn:'nRn'},welsh:{E:'Ee',A:'Aa'},stock:{E:'Ee',A:'Aa',Rn:'nRn'},fjord:{E:'Ee',A:'AA',D:'DD'},morgan:{E:'Ee',A:'Aa'},
 thoro:{E:'Ee',A:'Aa'},knab:{E:'Ee',A:'Aa',Lp:'nLp'},vanner:{E:'EE',A:'aa',To:'nTo'},marwari:{E:'Ee',A:'Aa',To:'nTo'},lipiz:{E:'Ee',A:'Aa',G:'GG'},
 sport:{E:'EE',A:'aa'},akhal:{E:'ee',A:'Aa',Cr:'nCr'},percheron:{E:'Ee',A:'aa',G:'nG'},shire:{E:'EE',A:'aa',Rn:'nRn'},clyde:{E:'Ee',A:'Aa',To:'nTo'},
};
const BASE_HEX={
 chestnut:['#9c4f23','#6e3617','none'],bay:['#8a5a2b','#332214','points','#241a12'],black:['#26262e','#101015','sooty'],
 palomino:['#d9a85c','#f4e6c5','none'],buckskin:['#c2a06a','#2a1f16','points','#241a12'],smokyblack:['#2e2a2a','#171515','sooty'],
 cremello:['#f2e8d0','#fbf5e6','none'],perlino:['#efe0c8','#e8d8b8','none'],smokycream:['#e8e0d8','#d8d0c8','none'],
 reddun:['#c48a5a','#8a5230','dun','#6a3a1e'],baydun:['#c2a06a','#3a3428','dun','#3a3024'],grulla:['#7d7a70','#2a2622','dun','#3a3024'],
 silverbay:['#7a5a3a','#d8d0c8','points','#4a3a2a'],silverblack:['#5a4a48','#d8d0c8','dapple'],
 grey:['#b9bec6','#787f8a','dapple'],
};
const BASE_LABEL={chestnut:'Chestnut',bay:'Bay',black:'Black',palomino:'Palomino',buckskin:'Buckskin',smokyblack:'Smoky Black',cremello:'Cremello',perlino:'Perlino',smokycream:'Smoky Cream',
 reddun:'Red Dun',baydun:'Bay Dun',grulla:'Grulla',silverbay:'Silver Bay',silverblack:'Silver Dapple',grey:'Grey'};

/* Rare wild coats: what a tamed horse brings out of the hills, and passes on for three days. */
const WILD_COATS={
 bay:{label:'Grulla Dun',body:'#6b3f1f',mane:'#1a120c',mark:'dun',markCol:'#2a1e14'},
 palomino:{label:'Brindle Gold',body:'#c89a4a',mane:'#3a2a12',mark:'roan',markCol:'#4a3418'},
 haflinger:{label:'Silver Dapple',body:'#5a4a48',mane:'#d8d0c8',mark:'dapple'},
 grey:{label:'Ghost Grey',body:'#dfe3ea',mane:'#8a8e96',mark:'leopard',markCol:'#6a6e78'},
 pinto:{label:'Sabino Splash',body:'#7d4f24',mane:'#fff8ee',mark:'pinto',markCol:'#fff8ee'},
 black:{label:'Smoky Brindle',body:'#2e2a2a',mane:'#8a8a94',mark:'roan',markCol:'#6a6a74'},
 _any:{label:'Mountain Dun',body:'#a08a5a',mane:'#2a2218',mark:'dun',markCol:'#3a3024'},
};
const WILD_COAT_CHANCE=0.6;

/* Fantasy recipes with a chance: the five-star pairings. The dragon line and the six-star
   pairings are the roster's (deterministic) and are listed in the same catalogue. */
const FANTASY_RECIPES=[
 {child:'celestial',parents:['unicorn','aether'],chance:0.5},
 {child:'aurora',parents:['pegasus','meadowlight'],chance:0.5},
 {child:'phoenix',parents:['pegasus','sunspear'],chance:0.5},
 {child:'ember',parents:['sunspear','thoro'],chance:0.45},
 {child:'frost',parents:['glacier','iceland'],chance:0.45},
 {child:'shadowmare',parents:['tempest','black'],chance:0.45},
 {child:'emberdrake',parents:['phoenix','tempest'],chance:0.3},
 {child:'verdant',parents:['meadowlight','aurora'],chance:0.3},
];

/* The foal questline: six steps, unlocked for everyone the day their first foal is born. */
const FOAL_STORY=[
 {label:'Meet your foal',text:'Go and say hello — walk up to the newborn out in the pasture.',type:'foalnear',goal:1,reward:{c:100}},
 {label:'Give the foal a treat',text:'A carrot or an apple, from your hand. Use the 🍼 buttons in 🐴 Care, or press E beside it.',type:'foalfeed',goal:1,reward:{c:120}},
 {label:'Groom the foal',text:'Foals roll in everything. A quick brush teaches it to stand for you.',type:'foalgroom',goal:1,reward:{c:120}},
 {label:'Take it for a 300 m walk',text:'Ride slowly and let it trot along behind — 300 metres with the foal at your side.',type:'foalwalk',goal:300,reward:{c:150,g:1}},
 {label:'Play with it twice',text:'Play builds a bond nothing else does. Twice, and it will follow you anywhere.',type:'foalplay',goal:2,reward:{c:150,items:{pot_mirror:1}}},
 {label:'Watch it grow up',text:'Train it to level 3, or give it a day. Then it is a horse, and yours to ride.',type:'foalgrow',goal:1,reward:{c:400,g:3,k:1,btok:1}},
];
const FOAL_NAMES=['Bramble','Tansy','Fennel','Wisp','Cricket','Marigold','Sorrel','Puddle','Thistle','Nutmeg','Poppy','Rowan','Clove','Dandy','Pip','Sable','Tundra','Fable','Quill','Barley'];

/* ---------------------------------------------------------------------------------------
   INSTALL
   --------------------------------------------------------------------------------------- */
export function install(G){
 const {THREE,$,toast}=G, T=G.tables, BREEDS3=T.BREEDS3, STAT_KEYS=T.STAT_KEYS, STAT_LBL=T.STAT_LBL, TRAITS=T.TRAITS;
 const fresh=G.save.fresh, sync=G.save.sync, player=G.horse.player;
 const R=()=>G.horse.roster||null;
 const byKey=k=>BREEDS3.find(b=>b[0]===k);
 const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
 const lbl=k=>G.horse.breedLabel(k);
 const rarityOf=h=>{const b=h&&byKey(h.breed);return b?b[2]:'Common';};
 const starsOf=h=>{const r=R();return r?r.starsOf(h):'';};
 const starsOfBreed=b=>{const r=R();return r?r.starsOfBreed(b):3;};
 const mins=ms=>{ms=Math.max(0,ms);const m=Math.floor(ms/60e3),s=Math.floor((ms%60e3)/1e3);return m>=60?Math.floor(m/60)+'h '+(m%60)+'m':m+'m '+String(s).padStart(2,'0')+'s';};
 const byId=(s,id)=>s.horses.find(h=>h.id===id)||null;
 const idxOf=(s,id)=>s.horses.findIndex(h=>h.id===id);
 function lcg(seed){let x=(seed*2654435761+12345)>>>0;return()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296;};}
 function jitterHex(hex,rnd,hueDeg,lightPct){const c=new THREE.Color(hex),hsl={};c.getHSL(hsl);hsl.h=(hsl.h+(rnd()*2-1)*hueDeg/360+1)%1;hsl.l=Math.max(0.03,Math.min(0.97,hsl.l*(1+(rnd()*2-1)*lightPct)));c.setHSL(hsl.h,hsl.s,hsl.l);return '#'+c.getHexString();}

 /* ---- 1. registries and save shape ---------------------------------------------------- */
 for(const k in CLASS_TRAITS){ if(!TRAITS[k])TRAITS[k]=Object.assign({breeding:true},CLASS_TRAITS[k]); }
 const traitDef=k=>k&&TRAITS[k]&&TRAITS[k].breeding?TRAITS[k]:null;
 function ensureBreedHorse(h){
  if(h.prestige===undefined)h.prestige=null;
  if(typeof h.wild==='string')h.wild={since:h.born||Date.now(),breed:h.wild,coat:null};
  if(!h.genes)h.genes=deriveGenes(h);
 }
 G.save.ensure(s=>{ if(s.breeding===undefined)s.breeding=null; if(s.foalq===undefined)s.foalq=null; s.coatsFound=s.coatsFound||{};
  if(s.horses)for(const h of s.horses)if(h.prestige===undefined||!h.genes||typeof h.wild==='string')ensureBreedHorse(h); });   // fresh() runs the save pass only; per-horse ensures wait for ensureStats
 G.save.ensureHorse(ensureBreedHorse);

 /* ---- 2. bloodlines ------------------------------------------------------------------ */
 function bloodOf(h){return (h&&h.blood&&Object.keys(h.blood).length)?h.blood:{[(h&&h.breed)||'bay']:100};}
 function mixBlood(a,b){const o={};for(const k in bloodOf(a))o[k]=(o[k]||0)+bloodOf(a)[k]/2;for(const k in bloodOf(b))o[k]=(o[k]||0)+bloodOf(b)[k]/2;for(const k in o)o[k]=Math.round(o[k]*100)/100;return o;}
 function dominantBreed(blood){return Object.entries(blood).sort((x,y)=>y[1]-x[1])[0][0];}
 function purityOf(h){const bl=bloodOf(h);return Math.max(...Object.values(bl));}
 function bloodLine(h,n){const bl=bloodOf(h);return Object.entries(bl).sort((x,y)=>y[1]-x[1]).slice(0,n||3).map(([k,v])=>esc(lbl(k))+' '+Math.round(v)+'%').join(' · ');}
 function isPurePair(a,b){return dominantBreed(bloodOf(a))===dominantBreed(bloodOf(b))&&purityOf(a)>=75&&purityOf(b)>=75;}

 /* ---- 3. traits: inheritance, effects ------------------------------------------------- */
 const traitsByCls=cls=>Object.keys(CLASS_TRAITS).filter(k=>CLASS_TRAITS[k].cls===cls&&!CLASS_TRAITS[k].combo);
 const pickTrait=cls=>{const L=traitsByCls(cls);return L[Math.floor(Math.random()*L.length)];};
 const clsOf=t=>t&&CLASS_TRAITS[t.id]?CLASS_TRAITS[t.id].cls:null;
 function inheritTrait(a,b,pure){
  const cls=pure?'pure':'cross', ta=a.trait&&CLASS_TRAITS[a.trait.id]?a.trait:null, tb=b.trait&&CLASS_TRAITS[b.trait.id]?b.trait:null;
  let out=null, how='fresh';
  if(ta&&tb&&ta.id===tb.id){out={id:ta.id,lvl:Math.min(TRAIT_MAX_LVL,Math.max(ta.lvl||1,tb.lvl||1)+1)};how='levelled';}
  else if(ta&&tb){
   const combo=TRAIT_COMBOS[[ta.id,tb.id].sort().join('+')];
   if(combo&&Math.random()<0.35){out={id:combo,lvl:1};how='mutated';}
   else if(Math.random()<0.6){const p=Math.random()<0.5?ta:tb;out={id:p.id,lvl:p.lvl||1};how='inherited';}
  }else if(ta||tb){const p=ta||tb;if(Math.random()<0.5){out={id:p.id,lvl:p.lvl||1};how='inherited';}}
  if(!out||clsOf(out)!==cls){out={id:pickTrait(cls),lvl:1};how='fresh';}   // the class rule wins: crossbreeds get a crossbreed trait, purebreds a purebred one
  return {trait:out,how,cls};
 }
 function inheritPrestige(a,b,forced){
  const pa=a.prestige&&CLASS_TRAITS[a.prestige.id]?a.prestige:null, pb=b.prestige&&CLASS_TRAITS[b.prestige.id]?b.prestige:null;
  let out=null;
  if(pa&&pb&&pa.id===pb.id)out={id:pa.id,lvl:Math.min(TRAIT_MAX_LVL,Math.max(pa.lvl||1,pb.lvl||1)+1)};
  else if((pa||pb)&&Math.random()<0.3){const p=pa&&pb?(Math.random()<0.5?pa:pb):(pa||pb);out={id:p.id,lvl:p.lvl||1};}
  else if(Math.random()<PRESTIGE_CHANCE)out={id:pickTrait('prestige'),lvl:1};
  if(forced){ if(!out&&(pa||pb)){const p=pa&&pb?(Math.random()<0.5?pa:pb):(pa||pb);out={id:p.id,lvl:p.lvl||1};}   // the essence: the parents' prestige comes through, a level stronger
   if(out)out.lvl=Math.min(TRAIT_MAX_LVL,out.lvl+1); else out={id:pickTrait('prestige'),lvl:1}; }
  return out;
 }
 /* The numbers a grown horse's class trait and prestige add up to. */
 function traitFx(h){
  const o={pts:{},xp:0,drain:0,regen:0,sxp:{}}; if(!h||h.foal)return o;
  for(const t of [h.trait,h.prestige]){const d=t&&CLASS_TRAITS[t.id];if(!d)continue;const L=t.lvl||1;
   for(const k of STAT_KEYS)if(d[k])o.pts[k]=(o.pts[k]||0)+d[k]*L;
   if(d.all)for(const k of STAT_KEYS)o.pts[k]=(o.pts[k]||0)+d.all*L;
   if(d.xp)o.xp+=d.xp*L; if(d.drain)o.drain+=d.drain*L; if(d.regen)o.regen+=d.regen*L;
   if(d.sxp)for(const k in d.sxp)o.sxp[k]=(o.sxp[k]||0)+d.sxp[k]*L;}
  return o;
 }
 function chip(t){const d=t&&CLASS_TRAITS[t.id];if(!d)return '';const col=d.cls==='prestige'?'#fff0c8;border-color:#e0b040':d.cls==='pure'?'#e8f0ff;border-color:#a0b8e0':'#eaf6e0;border-color:#a8d090';
  return '<span title="'+esc(d.desc)+'" style="background:'+col+';border:1px solid;border-radius:8px;padding:0 6px;font-size:11px;font-weight:700;white-space:nowrap">'+d.icon+' '+esc(d.label)+' '+'I'.repeat(Math.min(3,t.lvl||1))+'</span>';}
 const CLS_LABEL={pure:'Purebred',cross:'Crossbreed',prestige:'Prestige'};
 const SLOT_LBL={saddle:'🐎 Saddle',pad:'🟦 Saddle Pad',bridle:'🪢 Bridle',shoes:'🍀 Horseshoes'};
 const statShort=k=>STAT_LBL[k].slice(STAT_LBL[k].indexOf(' ')+1);
 G.addMul('xp',(s,h)=>1+traitFx(h).xp);
 G.addMul('sxp',(s,h,k)=>{const f=traitFx(h).sxp;return 1+(f.all||0)+(f[k]||0);});
 G.addMul('stamDrain',(s,h)=>Math.max(0.4,1-traitFx(h).drain));
 G.addMul('stamRegen',(s,h)=>1+traitFx(h).regen);
 const rideCache={h:null,fx:null};
 G.on('ride',(Rd)=>{
  const h=G.horse.ridden(); if(h!==rideCache.h){rideCache.h=h;rideCache.fx=traitFx(h);}
  const fx=rideCache.fx; if(!fx||!h)return; const HS=Rd.HS||{}, PM=Rd.PM||{sp:1,ac:1,ag:1}, p=fx.pts;
  if(p.speed){const s0=HS.speed||3;Rd.target*=(0.82+0.036*(s0+p.speed))/(0.82+0.036*s0);}
  if(p.accel)Rd.acMul+=0.06*p.accel*(PM.ac||1); if(p.agility)Rd.agMul+=0.05*p.agility*(PM.ag||1);
  if(p.jump)Rd.jpMul*=1+0.016*p.jump/(0.92+0.016*(HS.jump||3)); if(p.stamina)Rd.drain*=Math.max(0.4,1-0.06*p.stamina);
 });
 G.on('rebuild',()=>{rideCache.h=null;});

 /* ---- 4. coat genetics ---------------------------------------------------------------- */
 function pair(str){if(Array.isArray(str))return str.slice(0,2);if(!str)return null;const m=str.match(/Cr|Rn|To|Lp|[EAeaDGZn]/g);return m&&m.length===2?m:null;}
 function normLocus(L,arr){const d=DOM[L];return arr.slice().sort((x,y)=>(x===d?0:1)-(y===d?0:1));}
 function deriveGenes(h){
  const base=Object.assign({},BREED_GENES[h.breed]||{E:'Ee',A:'Aa'});
  const v=(R()&&R().variantLabel(h))||'', vl=v.toLowerCase();
  if(vl){
   if(/black|raven|jet|mohawk|braided/.test(vl)){base.E='EE';base.A='aa';}
   if(/chestnut|sorrel|flaxen|liver|red /.test(vl)||vl==='red'){base.E='ee';}
   if(/palomino|golden|gold|cream|champagne/.test(vl)){base.E='ee';base.Cr='nCr';}
   if(/buckskin/.test(vl)){base.E='Ee';base.A='Aa';base.Cr='nCr';}
   if(/cremello/.test(vl)){base.E='ee';base.Cr='CrCr';}
   if(/smoky/.test(vl)){base.E='EE';base.A='aa';base.Cr='nCr';}
   if(/grey|gray|white|pearl|lightning|chimera/.test(vl))base.G='nG';
   if(/roan|snowflake|flea|brindle/.test(vl))base.Rn='nRn';
   if(/pinto|tobiano|overo|piebald|skewbald|paint|blagdon|medicine|sabino/.test(vl))base.To='nTo';
   if(/leopard|blanket|appaloosa|few-spot|fewspot/.test(vl))base.Lp=/leopard|few/.test(vl)?'LpLp':'nLp';
   if(/dun|grulla/.test(vl))base.D='nD';
   if(/silver/.test(vl)){base.Z='nZ';}
  }else if(h.mark){ if(h.mark==='roan')base.Rn='nRn'; if(h.mark==='pinto')base.To='nTo'; if(h.mark==='appaloosa')base.Lp='nLp'; if(h.mark==='leopard')base.Lp='LpLp'; if(h.mark==='dun')base.D='nD'; }
  const rnd=lcg((h.id||0)*17+9), g={};
  for(const L of LOCI){let p=pair(base[L])||[REC[L],REC[L]];
   if(L==='E'&&p.join('')==='Ee'&&rnd()<0.3)p=['E','E']; if(L==='A'&&p.join('')==='Aa'&&rnd()<0.3)p=['A','A'];
   g[L]=normLocus(L,p);}
  return g;
 }
 function genesOf(h){if(!h)return null;if(!h.genes)h.genes=deriveGenes(h);return h.genes;}
 function mixGenes(ga,gb){const g={};for(const L of LOCI){const a=ga[L]||[REC[L],REC[L]],b=gb[L]||[REC[L],REC[L]];g[L]=normLocus(L,[a[Math.floor(Math.random()*2)],b[Math.floor(Math.random()*2)]]);}return g;}
 function phenotype(genes,seed){
  const has=L=>genes[L]&&genes[L].some(x=>x===DOM[L]), cnt=L=>genes[L]?genes[L].filter(x=>x===DOM[L]).length:0;
  let base=!has('E')?'chestnut':has('A')?'bay':'black';
  const cr=cnt('Cr');
  if(cr>=2)base={chestnut:'cremello',bay:'perlino',black:'smokycream'}[base];
  else if(cr===1)base={chestnut:'palomino',bay:'buckskin',black:'smokyblack'}[base];
  else if(has('D'))base={chestnut:'reddun',bay:'baydun',black:'grulla'}[base];
  else if(has('Z')&&base!=='chestnut')base=base==='bay'?'silverbay':'silverblack';
  const grey=has('G'), hx=grey?BASE_HEX.grey:BASE_HEX[base];
  let mark=hx[2]||'none', markCol=hx[3]||null;
  const parts=[grey?'Grey':BASE_LABEL[base]];
  if(has('To')){mark='pinto';markCol='#f4efe4';parts.push('Tobiano');}
  else if(cnt('Lp')>=2){mark='leopard';markCol=grey?'#6a6e78':'#3a2a1e';parts.push('Leopard');}
  else if(has('Lp')){mark='appaloosa';markCol='#f2ece0';parts.push('Blanket');}
  else if(has('Rn')){mark='roan';markCol=grey?'#8a8e96':'#e8dcc8';parts.push('Roan');}
  const rnd=lcg((seed||1)*29+5);
  return {body:jitterHex(hx[0],rnd,4,0.06),mane:jitterHex(hx[1],rnd,3,0.05),mark,markCol,label:parts.join(' '),key:parts.join(' ').toLowerCase().replace(/\s+/g,'-')};
 }
 function genotypeStr(g){if(!g)return '';return LOCI.map(L=>g[L]?g[L].join('/'):'').filter(Boolean).join(' ');}
 function likelyCoats(a,b,n){const tally={};for(let i=0;i<40;i++){const l=phenotype(mixGenes(genesOf(a),genesOf(b)),1).label;tally[l]=(tally[l]||0)+1;}return Object.entries(tally).sort((x,y)=>y[1]-x[1]).slice(0,n||3).map(([l,c])=>l+' '+Math.round(c*2.5)+'%');}
 const isFantasy=h=>!!(h&&(h.coat||h.wings||h.dragon||h.horn||(byKey(h.breed)||[])[7]&&(byKey(h.breed)[7].coat||byKey(h.breed)[7].wings||byKey(h.breed)[7].horn)));
 function noteCoat(s,label){s.coatsFound=s.coatsFound||{};const first=!s.coatsFound[label];s.coatsFound[label]=(s.coatsFound[label]||0)+1;return first;}

 /* ---- 5. cost, gestation, wild windows ----------------------------------------------- */
 function breedCost(a,b){const ra=RAR_ORDER.indexOf(rarityOf(a)),rb=RAR_ORDER.indexOf(rarityOf(b));const r=RAR_ORDER[Math.max(ra,rb,0)];const c=BREED_COST[r]||BREED_COST.Common;return {c:c.c,t:c.t,g:Math.round(c.c/40),rarity:r,gestMs:(GEST_MIN[r]||10)*60e3};}
 function wildWindow(h){return !!(h&&h.wild&&typeof h.wild==='object'&&h.wild.since&&Date.now()-h.wild.since<WILD_BREED_MS);}
 function wildLeft(h){return wildWindow(h)?WILD_BREED_MS-(Date.now()-h.wild.since):0;}
 function eligible(s){return s.horses.map((h,i)=>({h,i})).filter(e=>!e.h.foal&&!e.h.egg&&(e.h.bond||0)>=BREED_BOND);}
 function sexOf(h){return h.sex==='f'?'f':'m';}
 function sexGlyph(h){return h.foal?(sexOf(h)==='f'?'♀ filly':'♂ colt'):(sexOf(h)==='f'?'♀ mare':'♂ stallion');}

 /* ---- 6. the foal: everything the hook decides ---------------------------------------- */
 function uniqueName(s,name){const taken=n=>s.horses.some(h=>h.name===n);if(!taken(name))return name;const pool=FOAL_NAMES.concat(T.NAMES3||[]).filter(n=>!taken(n));if(pool.length)return pool[Math.floor(Math.random()*pool.length)];let k=2;while(taken(name+' '+k))k++;return name+' '+k;}
 function copyLook(foal,p){foal.colors={body:p.colors.body,mane:p.colors.mane};if(p.mark)foal.mark=p.mark;else delete foal.mark;if(p.markCol)foal.markCol=p.markCol;else delete foal.markCol;foal.variant=p.variant||null;foal.mark2=p.mark2||null;if(p.genes)foal.genes=JSON.parse(JSON.stringify(p.genes));if(p.coat!==undefined)foal.coat=p.coat||null;}
 function clampStats(foal){for(const k of STAT_KEYS)foal.stats[k]=Math.max(1,Math.min(foal.stats[k],G.xp.statCeil(foal,k)));}
 function rebuildAs(foal,key){const cb=byKey(key);if(!cb)return false;const co=cb[7]||{};
  foal.breed=key;foal.coat=co.coat||null;foal.colors={body:cb[5],mane:cb[6]};foal.horn=!!co.horn;foal.wings=!!co.wings;foal.dragon=!!co.dragon;foal.rainbow=!!co.rainbow;foal.glow=!!co.glow;foal.ability=co.ability||foal.ability||null;
  delete foal.mark;delete foal.markCol;foal.mark2=null;foal.variant=null;if(co.egg)foal.egg=true;return true;}
 function recipeFor(a,b){const da=dominantBreed(bloodOf(a)),db=dominantBreed(bloodOf(b));return FANTASY_RECIPES.find(r=>(r.parents[0]===da&&r.parents[1]===db)||(r.parents[0]===db&&r.parents[1]===da))||null;}
 G.on('foal',(s,foal,a,b,opts)=>{
  opts=opts||{}; const club=!!opts.club, pots=opts.pot||[];
  const A=a, B=club?Object.assign({blood:{[b.breed||a.breed]:100},stats:{},lineage:{gen:0}},b):b;
  foal.name=uniqueName(s,foal.name);
  /* blood and breed */
  const rosterHit=foal.variantFound!==undefined;                       // the roster already made this a recipe child
  foal.blood=mixBlood(A,B);
  if(rosterHit||foal.breed!==A.breed&&foal.breed!==B.breed)foal.blood={[foal.breed]:100};   // a new line starts pure
  else{
   const rc=recipeFor(A,B);
   if(!opts.noRecipe&&rc&&byKey(rc.child)&&Math.random()<rc.chance){rebuildAs(foal,rc.child);foal.blood={[rc.child]:100};foal.recipeHit=rc.child;
    s.stats=s.stats||{};s.stats.recipes=(s.stats.recipes||0)+1;
    setTimeout(()=>{try{toast('🦄 The pairing took: '+lbl(rc.child)+'!');}catch(e){}},700);}
   else if(!foal.wings&&!foal.dragon&&!foal.coat){const dom=dominantBreed(foal.blood);if(byKey(dom))foal.breed=dom;}
  }
  const pure=isPurePair(A,B);
  foal.lineage=Object.assign(foal.lineage||{},{sireName:A.name,damName:B.name||(opts.rider?opts.rider+"'s horse":'a club horse'),sireBreed:A.breed,damBreed:B.breed||A.breed,purity:purityOf(foal),cls:pure?'pure':'cross'});
  /* class trait and prestige */
  const it=inheritTrait(A,B,pure); foal.trait=it.trait; foal.traitHow=it.how;
  foal.prestige=inheritPrestige(A,B,pots.includes('prestige'));
  /* coat */
  const wildP=[A,B].find(p=>wildWindow(p));
  if(pots.includes('mirror')){const src=opts.mirror==='b'?B:A;copyLook(foal,src);foal.coatHow='mirror';}
  else if(wildP&&!isFantasy(foal)&&Math.random()<0.7){copyLook(foal,wildP);foal.coatHow='wild';wildP.wild.bred=true;s.stats=s.stats||{};s.stats.wildFoals=(s.stats.wildFoals||0)+1;}
  else if(!isFantasy(foal)&&!foal.recipeHit&&!rosterHit&&!foal.mutant){
   foal.genes=mixGenes(genesOf(A),genesOf(B));
   let ph=phenotype(foal.genes,foal.id);
   /* duplicate protection: a full sibling born within a day with the same coat is re-mixed once */
   const twin=s.horses.some(h=>h!==foal&&h.lineage&&h.lineage.sire===foal.lineage.sire&&h.lineage.dam===foal.lineage.dam&&Date.now()-(h.born||0)<864e5&&h.coatLabel===ph.label);
   if(twin){foal.genes=mixGenes(genesOf(A),genesOf(B));ph=phenotype(foal.genes,foal.id+1);}
   foal.colors={body:ph.body,mane:ph.mane};if(ph.mark&&ph.mark!=='none'){foal.mark=ph.mark;if(ph.markCol)foal.markCol=ph.markCol;else delete foal.markCol;}else{delete foal.mark;delete foal.markCol;}
   foal.variant=null;foal.coatLabel=ph.label;foal.coatHow='genes';
   if(noteCoat(s,ph.label)){foal.newCoat=true;setTimeout(()=>{try{toast('🎨 New coat discovered: '+ph.label+'!');}catch(e){}},1100);}
  }else if(!foal.genes)foal.genes=mixGenes(genesOf(A),genesOf(B));
  if(pots.includes('hornbud'))foal.horn=true;
  if(pots.includes('starlight')){foal.glow=true;foal.rainbow=true;}
  if(foal.egg){foal.eggLaid=Date.now();foal.eggWarm=0;}
  clampStats(foal);
  s.stats=s.stats||{};s.stats.foals=(s.stats.foals||0)+1;
  if(!s.foalq&&!foal.egg)s.foalq={idx:0,prog:0,active:foal.id,started:Date.now()};
  if(!s.companion&&!foal.egg)s.companion=foal.id;
  G.save.flag(s,'bredOnce');
 });

 /* ---- 7. wild coats on taming ------------------------------------------------------- */
 G.on('grantHorse',(s,h,opts)=>{
  opts=opts||{}; if(opts.src!=='wild'||h.breed==='kestrel')return;
  h.wild=Object.assign({since:Date.now(),breed:h.breed,coat:null},typeof h.wild==='object'?h.wild:{});
  if(Math.random()<WILD_COAT_CHANCE){const wc=WILD_COATS[h.breed]||WILD_COATS._any;h.colors={body:wc.body,mane:wc.mane};h.mark=wc.mark;if(wc.markCol)h.markCol=wc.markCol;else delete h.markCol;h.variant=null;h.wild.coat=wc.label;h.genes=deriveGenes(h);
   setTimeout(()=>{try{toast('🌿 '+h.name+' wears a rare wild coat: '+wc.label+' — breed within 3 days to pass it on!');}catch(e){}},1200);}
 });

 /* ---- 8. tokens: sources and the wallet ---------------------------------------------- */
 function addBtok(n,why){let v=0;sync(s=>{s.btok=(s.btok||0)+n;v=s.btok;});G.money.refreshWallet();if(n>0)toast('💞 +'+n+' breeding token'+(n>1?'s':'')+(why?' — '+why:'')+' ('+v+')');}
 G.on('courseFinish',({ev,stars,RB})=>{
  if(!ev)return; let n=0,why=[];
  let first=false; try{const s=fresh();first=!!(s&&!(s.trophies&&s.trophies[ev.id]));}catch(e){}
  if(ev.race&&stars>=2){n++;why.push('race');} if(!ev.race&&stars>=3){n++;why.push('clean round');}
  if(first){n++;why.push('first win');} if(RB&&RB.featured){n++;why.push('featured');}
  if(n)setTimeout(()=>addBtok(n,why.join(' + ')),900);
  if(stars>=3&&Math.random()<(RB&&RB.featured?0.4:0.2)){const k=POT_KEYS[Math.floor(Math.random()*POT_KEYS.length)];sync(s=>{s.items['pot_'+k]=(s.items['pot_'+k]||0)+1;});setTimeout(()=>{try{toast(POTIONS[k].emoji+' A '+POTIONS[k].label+' for the foaling barn!');}catch(e){}},1600);}
 });
 G.on('ribbons',RB0=>{ sync(s=>{const wk=G.time.isoWeekKey();s.brw=(s.brw&&s.brw.wk===wk)?s.brw:{wk,n:0};s.brw.n+=(RB0&&RB0.rib)||1;}); });
 G.on('weekRoll',s=>{ const n=(s.brw&&s.brw.n)||0; if(n>=8){s.btok=(s.btok||0)+2;s.items=s.items||{};s.items.pot_mirror=(s.items.pot_mirror||0)+1;setTimeout(()=>{try{toast('📅 A ribbon-rich week: +2 💞 breeding tokens and a Mirror Draught!');}catch(e){}},2000);} s.brw={wk:G.time.isoWeekKey(),n:0}; });
 G.on('passClaim',(sv,r,i,gold)=>{ if(!gold&&[9,19,29].includes(i)){sv.btok=(sv.btok||0)+1;} if(gold&&[4,14,24].includes(i)){sv.btok=(sv.btok||0)+1;} });
 G.on('wallet',s=>{ const n=s.btok||0; G.ui.hud.stat('btokEl',(n||(s.flags&&s.flags.bredOnce))?'<span title="Breeding tokens — earned from races, clean rounds, the week, dailies and the pass">💞 '+n+'</span>':''); });
 {const row=G.quest.DAILYQ.find(r=>r.type==='breed');if(row&&row.r&&!row.r.btok)row.r.btok=1;}

 /* ---- 9. the pairing: start, hurry, birth --------------------------------------------- */
 const ui={a:null,b:null,pot:{},mirror:'a',confirm:null,rec:'all',tab:'breed'};
 function potCount(s,k){return (s.items&&s.items['pot_'+k])||0;}
 function startPairing(mode){
  let msg='',ok=false;
  sync(s=>{
   if(s.breeding){msg='The barn is busy — a foal is on the way.';return;}
   const a=byId(s,ui.a),b=byId(s,ui.b); if(!a||!b||a===b){msg='Pick a stallion and a mare.';return;}
   if(a.foal||b.foal||(a.bond||0)<BREED_BOND||(b.bond||0)<BREED_BOND){msg='Both parents must be grown and trust you (❤️ '+BREED_BOND+'+).';return;}
   const cost=breedCost(a,b);
   if(mode==='t'){if((s.btok||0)<cost.t){msg='You need '+cost.t+' 💞 breeding token'+(cost.t>1?'s':'')+'.';return;}s.btok-=cost.t;}
   else if(mode==='g'){if((s.gems||0)<cost.g){msg='You need '+cost.g+' 💎.';return;}s.gems-=cost.g;}
   else{if((s.coins||0)<cost.c){msg='Breeding these two costs '+cost.c+' 🪙.';return;}s.coins-=cost.c;}
   const pots=POT_KEYS.filter(k=>ui.pot[k]&&potCount(s,k)>0); for(const k of pots)s.items['pot_'+k]--;
   const firstEver=!(s.stats&&s.stats.foals);
   s.breeding={a:a.id,b:b.id,since:Date.now(),ms:firstEver?TUTORIAL_MS:cost.gestMs,pot:pots,mirror:ui.mirror,mode,cost:cost[mode==='t'?'t':mode==='g'?'g':'c'],names:[a.name,b.name]};
   s.stats=s.stats||{};s.stats.pairings=(s.stats.pairings||0)+1;
   msg='💞 '+a.name+' and '+b.name+' — a foal is due in '+mins(s.breeding.ms)+'. Marta will keep watch.'; ok=true;
  });
  toast(msg); if(ok){ui.pot={};ui.confirm=null;try{G.sChime();}catch(e){}G.money.refreshWallet();} refreshUI();
 }
 function hurryCost(br){return Math.max(1,Math.ceil((br.ms-(Date.now()-br.since))/(5*60e3)));}
 function hurry(){let msg='',ok=false;sync(s=>{const br=s.breeding;if(!br)return;const g=hurryCost(br);if((s.gems||0)<g){msg='You need '+g+' 💎 to hurry the foal along.';return;}s.gems-=g;br.since=Date.now()-br.ms;msg='⏩ Marta hums a lullaby… the foal is here!';ok=true;});toast(msg);if(ok){G.money.refreshWallet();checkBirth();}else refreshUI();}
 function checkBirth(){
  let born=null,note='';
  sync(s=>{
   const br=s.breeding; if(!br||Date.now()-br.since<br.ms)return;
   const a=byId(s,br.a),b=byId(s,br.b);
   if(!a||!b){s.breeding=null;s.coins=(s.coins||0)+Math.round((br.mode==='c'?br.cost:0)*0.5);note='A parent left the ranch before the foal came — Marta refunds what she can.';return;}
   const foal=G.horse.makeFoal(s,a,b,{src:'breed',pot:br.pot||[],mirror:br.mirror||'a'});
   s.breeding=null; born=foal;
  });
  if(note)toast(note);
  if(born){
   const d=born.trait&&CLASS_TRAITS[born.trait.id];
   toast('🍼 '+born.name+' is born! '+(born.egg?'…as an egg! Warm it at the nest.':'A '+(born.lineage.cls==='pure'?'purebred':'crossbred')+' '+lbl(born.breed)+(d?' with '+d.label:'')+(born.prestige?' — and a Prestige trait!':'')+(born.wings?' 🪽':'')+(born.horn?' 🦄':'')));
   try{G.sGem();}catch(e){} G.money.refreshWallet(); G.horse.reloadHorses();
   G.quest.questEvt('breed',1); G.quest.dailyEvt('breed',1); try{G.xp.passAdd(25);}catch(e){}
   refreshUI();
  }
 }
 function refreshUI(){ try{ if($('breedPanel')&&$('breedPanel').style.display==='flex')G.ui.rerender('breedPanel'); else if($('shopPanel').style.display==='flex'&&/data-fx="breed:/.test($('shopPanel').innerHTML))G.ui.openShop('breed'); }catch(e){} G.ui.hud.pips(); }
 G.on('interval30',()=>{setTimeout(()=>{checkBirth();hatchCheck();},10);});
 let birthT=0; G.on('tick',(dt)=>{birthT+=dt;if(birthT>4){birthT=0;const s=fresh();if(s&&s.breeding&&Date.now()-s.breeding.since>=s.breeding.ms)checkBirth();}});
 G.on('breed3',()=>{ const A=$('mateA3'),B=$('mateB3'); if(A&&B){const s=fresh();const a=s.horses[+A.value],b=s.horses[+B.value];if(a&&b){ui.a=a.id;ui.b=b.id;ui.confirm='c';startPairing('c');return true;}} G.ui.open('breedPanel'); return true; });

 /* ---- 10. foal stage: companion play, walk, growth ---------------------------------- */
 function companionFoal(s){const c=s.companion&&byId(s,s.companion);if(c&&c.foal&&!c.egg)return c;return s.horses.filter(h=>h.foal&&!h.egg).sort((x,y)=>(y.born||0)-(x.born||0))[0]||null;}
 function foalEntity(id){for(const e of G.horse.herd()){const h=G.horse.myHorses[e.idx];if(h&&h.id===id)return e;}return null;}
 const gambol={id:null,t:0,ang:0};
 function foalAct(act){
  let msg='',ok=false,fid=null;
  sync(s=>{
   const f=companionFoal(s); if(!f){msg='No foal to play with yet — Marta\'s barn is by the pasture gate.';return;} fid=f.id;
   const N=f.needs=f.needs||{hunger:90,thirst:90,clean:90,happy:90};
   if(act==='treat'){const k=['carrot','apple','lettuce','pumpkin','orange'].find(k=>(s.items[k]||0)>0);if(!k){msg='No treats in your bag — the 🛍️ Shop has carrots.';return;}s.items[k]--;N.hunger=Math.min(100,N.hunger+25);N.happy=Math.min(100,N.happy+8);const bg=G.horse.bondGain(f,3,'feed');f.bond=Math.min(100,(f.bond||0)+bg);G.xp.applyXp(s,f,6);msg=f.name+' snaffles the '+k+' and nudges you for more 🍼 +'+bg+' bond';ok='foalfeed';}
   else if(act==='groom'){if(N.clean>=98){msg=f.name+' is already spotless.';return;}N.clean=Math.min(100,N.clean+40);N.happy=Math.min(100,N.happy+5);const bg=G.horse.bondGain(f,3,'groom');f.bond=Math.min(100,(f.bond||0)+bg);G.xp.applyXp(s,f,5);msg=f.name+' leans into the brush 🧼 +'+bg+' bond';ok='foalgroom';}
   else if(act==='play'){N.happy=Math.min(100,N.happy+15);const bg=G.horse.bondGain(f,4,'pet');f.bond=Math.min(100,(f.bond||0)+bg);G.xp.applyXp(s,f,8);msg=f.name+' bucks and gambols around you 🎉 +'+bg+' bond';ok='foalplay';s.stats=s.stats||{};s.stats.foalPlays=(s.stats.foalPlays||0)+1;}
   else if(act==='call'){msg=f.name+' comes trotting over!';ok='call';}
  });
  toast(msg);
  if(ok){
   try{G.sChime();}catch(e){}
   if(ok==='foalplay'){gambol.id=fid;gambol.t=4;G.quest.dailyEvt('foalplay',1);foalEvt('foalplay',1);}
   if(ok==='foalfeed'){G.quest.dailyEvt('feed',1);foalEvt('foalfeed',1);}
   if(ok==='foalgroom'){G.quest.dailyEvt('groom',1);foalEvt('foalgroom',1);}
   if(ok==='call'){const e=foalEntity(fid);if(e){e.pos.x=player.pos.x+2;e.pos.z=player.pos.z+2;e.rest=0;}}
   try{G.xp.passAdd(3);}catch(e){}
   G.horse.reloadHorses();
   if($('carePanel').style.display==='flex')G.ui.renderCare();
  }
 }
 const walk={acc:0,near:false,t:0,growSeen:{}};
 G.on('tick',(dt,t)=>{
  if(gambol.t>0){const e=foalEntity(gambol.id);gambol.t-=dt;if(e){gambol.ang+=dt*2.2;e.rest=0;e.tx=player.pos.x+Math.cos(gambol.ang)*3.1;e.tz=player.pos.z+Math.sin(gambol.ang)*3.1;}}
  walk.t+=dt; if(walk.t<0.5)return; const step=walk.t; walk.t=0;
  const s0=G.horse.myHorses; let f=null; const cid=(window.__cachedCompanion||0);
  for(const h of s0)if(h.foal&&!h.egg&&(h.id===cid||!f))f=h;
  if(!f)return; const e=foalEntity(f.id); if(!e)return;
  const d=Math.hypot(player.pos.x-e.pos.x,player.pos.z-e.pos.z);
  if(d<6){ if(!walk.near){walk.near=true;foalEvt('foalnear',1);} if(Math.abs(player.speed)>0.5){walk.acc+=Math.abs(player.speed)*step;if(walk.acc>=5){const m=Math.floor(walk.acc);walk.acc-=m;foalEvt('foalwalk',m);}} }
  else if(d>12)walk.near=false;
 });
 G.on('rebuild',()=>{try{window.__cachedCompanion=(fresh()||{}).companion||0;}catch(e){}});
 /* growth: the 30 s pass and level 3 both clear foal:true; the questline notices either way */
 function growthCheck(s){ if(!s.foalq||s.foalq.idx>=FOAL_STORY.length)return; const f=byId(s,s.foalq.active); if(f&&!f.foal&&!walk.growSeen[f.id]){walk.growSeen[f.id]=1;setTimeout(()=>foalEvt('foalgrow',1),50);} }
 G.on('interval30',s=>growthCheck(s));
 let growT=0; G.on('tick',dt=>{growT+=dt;if(growT>2){growT=0;const s=fresh();if(s)growthCheck(s);}});
 /* care actions for the foal (the Care panel buttons and the E prompt) */
 G.on('careAct',k=>{ if(!/^foal:/.test(k))return false; foalAct(k.slice(5)); return true; });
 G.world.addThing({kind:'foalplay',id:'foalplay',x:1e6,z:1e6,g:null,reach:3.5,
  tick(dt,t){const s=G.horse.myHorses;const cid=window.__cachedCompanion||0;let f=null;for(const h of s)if(h.foal&&!h.egg&&(h.id===cid||!f))f=h;const e=f&&foalEntity(f.id);if(e){t.x=e.pos.x;t.z=e.pos.z;t.foal=f;}else{t.x=1e6;t.z=1e6;t.foal=null;}},
  label(t){return t.foal?'🍼 Play with '+t.foal.name+' (E)':'';},use(){foalAct('play');}});
 G.ui.careSection((s,h)=>{
  const f=companionFoal(s); if(!f)return '';
  const hearts=Math.max(0,Math.min(5,Math.round((f.bond||0)/20)));
  return '<div class="evrow" style="margin-top:6px"><b>🍼 '+esc(f.name)+'</b><span>'+esc(lbl(f.breed))+' foal · '+sexGlyph(f)+' · Lv '+(f.level||1)+' · '+'❤️'.repeat(hearts)+'🤍'.repeat(5-hearts)+(f.trait&&CLASS_TRAITS[f.trait.id]?' · '+chip(f.trait):'')+'</span>'
   +'<span style="flex:none;display:flex;gap:4px;flex-wrap:wrap"><button data-care="foal:treat" title="A treat from your bag">🥕 Treat</button><button data-care="foal:groom">🧼 Groom</button><button data-care="foal:play">🎉 Play</button><button data-care="foal:call" title="Call it to your side">📣 Call</button><button data-fx="breed:sheet:'+idxOf(s,f.id)+'">📋</button></span></div>'
   +(s.foalq&&s.foalq.idx<FOAL_STORY.length&&s.foalq.active===f.id?'<div style="font-size:11.5px;color:#8c7a63">🍼 Foal\'s first steps · '+esc(FOAL_STORY[s.foalq.idx].label)+(FOAL_STORY[s.foalq.idx].goal>1?' ('+Math.floor(s.foalq.prog)+'/'+FOAL_STORY[s.foalq.idx].goal+')':'')+'</div>':'');
 });
 G.quest.addDaily({type:'foalplay',icon:'🍼',label:'Play with your foal twice',goal:2,r:{c:80,g:1,p:10}});
 G.quest.addDaily({type:'egg',icon:'🥚',label:'Warm a dragon egg',goal:1,r:{c:120,g:1,p:10,btok:1}});

 /* ---- 11. the foal questline --------------------------------------------------------- */
 function foalEvt(type,val){
  let done=null,next=null;
  sync(s=>{
   const q=s.foalq; if(!q||q.idx>=FOAL_STORY.length)return; const m=FOAL_STORY[q.idx]; if(m.type!==type)return;
   q.prog=Math.min(m.goal,(q.prog||0)+(typeof val==='number'?val:1));
   if(q.prog>=m.goal){G.money.payReward(s,m.reward);done=m;q.idx++;q.prog=0;next=FOAL_STORY[q.idx]||null;if(!next)q.done=Date.now();}
  });
  if(done){try{G.sGem();}catch(e){}G.money.refreshWallet();toast('🍼 '+done.label+' — done! '+G.money.rewardLabel(done.reward)+(next?' · Next: '+next.label:' · Foal\'s first steps complete! 🏆'));}
 }
 function foalqHtml(s){
  const q=s.foalq;
  let html='<span style="font-size:12px;color:#8c7a63">🍼 <b>Foal\'s First Steps</b> — a short questline about raising your first foal. '+(q?'':'It begins the day your first foal is born at Marta\'s barn.')+'</span>';
  html+=FOAL_STORY.map((m,i)=>{const st=!q?'locked':i<q.idx?'done':i===q.idx?'active':'locked';const f=q&&byId(s,q.active);
   return '<div class="qrow'+(st==='done'?' claimed':st==='active'?' done':'')+'"><span class="qico">'+(st==='done'?'✅':st==='active'?'🍼':'🔒')+'</span><span class="qmain"><b>'+esc(m.label)+'</b><span style="font-size:11px;color:#8c7a63;font-weight:600">'+esc(m.text)+(st==='active'&&m.goal>1?' · '+Math.floor(q.prog)+'/'+m.goal:'')+(st==='active'&&f?' · with '+esc(f.name):'')+'</span></span><span style="font-size:11px;white-space:nowrap">'+G.money.rewardLabel(m.reward)+'</span></div>';}).join('');
  return html;
 }
 G.ui.questTab({id:'foal',label:'🍼 Foal',render(s){return foalqHtml(s);}});

 /* ---- 12. eggs ----------------------------------------------------------------------- */
 function eggs(s){return s.horses.filter(h=>h.egg&&h.foal);}
 function hatchCheck(){
  let hatched=[];
  sync(s=>{for(const h of eggs(s)){if((h.eggWarm||0)>=EGG_WARMS||Date.now()-(h.eggLaid||h.born||Date.now())>EGG_HATCH_MS){delete h.egg;h.born=Date.now();h.hatched=Date.now();hatched.push(h.name+' the '+lbl(h.breed));s.stats=s.stats||{};s.stats.hatched=(s.stats.hatched||0)+1;if(!s.foalq)s.foalq={idx:0,prog:0,active:h.id,started:Date.now()};if(!s.companion)s.companion=h.id;s.items=s.items||{};s.items.pot_prestige=(s.items.pot_prestige||0)+1;}}});
  if(hatched.length){try{G.sGem();}catch(e){}toast('🐣 '+hatched.join(', ')+' hatched! A Prestige Essence was in the shell.');G.horse.reloadHorses();refreshUI();}
 }
 function eggEntity(){for(const e of G.horse.herd()){const h=G.horse.myHorses[e.idx];if(h&&h.egg&&h.foal)return {e,h};}return null;}
 function warmEgg(){
  let msg='',ok=false;
  sync(s=>{const L=eggs(s);if(!L.length){msg='No egg to warm.';return;}const h=L.sort((x,y)=>(x.eggWarmAt||0)-(y.eggWarmAt||0))[0];
   if(h.eggWarmAt&&Date.now()-h.eggWarmAt<EGG_WARM_GAP){msg='🥚 The egg is warm enough for now — come back in '+mins(EGG_WARM_GAP-(Date.now()-h.eggWarmAt))+'.';return;}
   h.eggWarm=(h.eggWarm||0)+1;h.eggWarmAt=Date.now();msg='🥚 You cup your hands around the egg… something stirs inside ('+h.eggWarm+'/'+EGG_WARMS+').';ok=true;});
  toast(msg); if(ok){try{G.sChime();}catch(e){}G.quest.dailyEvt('egg',1);try{G.xp.passAdd(3);}catch(e){}hatchCheck();G.ui.hud.pips();}
 }
 G.world.addThing({kind:'egg',id:'eggnest',x:1e6,z:1e6,g:null,reach:3.5,
  tick(dt,t){const x=eggEntity();if(x){t.x=x.e.pos.x;t.z=x.e.pos.z;t.h=x.h;}else{t.x=1e6;t.z=1e6;t.h=null;}},
  label(t){return t.h?'🥚 Warm the egg (E) · '+(t.h.eggWarm||0)+'/'+EGG_WARMS:'';},use(){warmEgg();}});
 G.ui.stableHeader(s=>{const L=eggs(s);if(!L.length)return '';return '<div class="ph" style="font-size:14px">🥚 Eggs</div>'+L.map(h=>'<div class="evrow">🥚 <b>'+esc(h.name)+'</b><span>'+esc(lbl(h.breed))+' · warmed '+(h.eggWarm||0)+'/'+EGG_WARMS+' · hatches on its own in '+mins(EGG_HATCH_MS-(Date.now()-(h.eggLaid||h.born||Date.now())))+' · find it in the pasture and press E</span><button data-fx="breed:warm">🤲 Warm</button></div>').join('');});

 /* ---- 13. the tutorial, Marta, the barn ---------------------------------------------- */
 G.world.addNPC({id:'marta',name:'Marta',icon:'🧑‍⚕️',x:-27,z:-33,hat:'#5a7a4a',shirt:'#c9a24a',idle:'Every foal is a surprise, even to me. Bring me a stallion and a mare who trust you, and we\'ll see what the Basin gives us.',
  role:{open:'breed',label:'💞 Breeding'}});
 G.on('dlg',(def,s)=>{ if(!def||def.id!=='marta')return; const br=s&&s.breeding; const q=s&&s.foalq;
  return '<div style="font-size:12px;color:#5a4a3a;margin:4px 0">'+(br?'🍼 '+esc(br.names[0])+' × '+esc(br.names[1])+' — due in '+mins(br.ms-(Date.now()-br.since)):'💞 Tokens: '+(s.btok||0)+' · potions: '+POT_KEYS.reduce((n,k)=>n+potCount(s,k),0))+(q&&q.idx<FOAL_STORY.length?' · 🍼 '+esc(FOAL_STORY[q.idx].label):'')+'</div>'
   +'<button data-fx="breed:open" style="margin-right:6px">🍼 Foaling barn</button><button data-fx="breed:recipes" style="margin-right:6px">📖 Recipes</button>'; });
 G.world.addBuilding({x:-31,z:-38,rot:0.55,r:2.6,label:'🍼 Marta\'s Foaling Barn',build:()=>G.world.ranchArchitecture.buildOutbuilding({width:4.2,depth:3.2,height:2.9,animatedDoorOpening:{width:1.3,height:2.0}})});
 G.world.addThing({kind:'foalbarn',id:'foalbarn',x:-29,z:-35,g:null,reach:5.5,label(){const s=fresh();const br=s&&s.breeding;return br?(Date.now()-br.since>=br.ms?'🍼 A foal is here! (E)':'🍼 Foaling barn — due in '+mins(br.ms-(Date.now()-br.since))+' (E)'):'🍼 Foaling barn — breed (E)';},use(){checkBirth();G.ui.open('breedPanel');}});
 G.world.mapMarkers.push({x:-31,z:-38,glyph:'🍼',label:'Foaling barn'}); G.world.miniMarkers.push({x:-31,z:-38,col:'#e8a0c8'});
 G.quest.story.insertBefore(7,[{npc:'marta',label:'Breed your first foal',text:'You\'ve tamed a wild one — now let\'s raise one. Pick a stallion and a mare who trust you (❤️ '+BREED_BOND+'+), and I\'ll see the foal safely born. Everything a foal is, it gets from its parents: coat, stats, and a trait of its own.',type:'breed',goal:1,reward:{c:500,g:5,items:{pot_mirror:1}}}],'breeding-tutorial');

 /* ---- 14. the breeding panel --------------------------------------------------------- */
 function optRow(s,e){const h=e.h;return '<option value="'+h.id+'">'+esc(h.name)+' · '+esc(lbl(h.breed))+' · ❤️'+Math.round(h.bond||0)+(wildWindow(h)?' · 🌿 wild '+mins(wildLeft(h)):'')+'</option>';}
 function previewHtml(s,a,b){
  const pure=isPurePair(a,b), cost=breedCost(a,b), blood=mixBlood(a,b), rc=recipeFor(a,b), rr=R()&&R().resolveVariant(a,b), wildP=[a,b].find(p=>wildWindow(p));
  const rng=STAT_KEYS.map(k=>{const lo=Math.max(1,Math.min(10,Math.round((((a.stats&&a.stats[k])||3)+((b.stats&&b.stats[k])||3))/2)));return statShort(k)+' '+lo+'–'+Math.min(10,lo+1);}).join(' · ');
  const fant=isFantasy(a)||isFantasy(b);
  const coats=fant?[(a.coat||b.coat)?'a themed coat':'a blended coat']:likelyCoats(a,b,3);
  const tcand=[a.trait,b.trait].filter(t=>t&&CLASS_TRAITS[t.id]);
  const twant=pure?'pure':'cross';
  let tline='';
  if(tcand.length===2&&tcand[0].id===tcand[1].id)tline=chip({id:tcand[0].id,lvl:Math.min(3,Math.max(tcand[0].lvl||1,tcand[1].lvl||1)+1)})+' (both parents — a level up)';
  else if(tcand.length===2){const combo=TRAIT_COMBOS[[tcand[0].id,tcand[1].id].sort().join('+')];tline=tcand.map(t=>chip(t)).join(' or ')+(combo?' or a mutation into '+chip({id:combo,lvl:1}):'')+' — or a fresh '+CLS_LABEL[twant]+' trait';}
  else if(tcand.length===1)tline=chip(tcand[0])+' (50%) or a fresh '+CLS_LABEL[twant]+' trait';
  else tline='a fresh '+CLS_LABEL[twant]+' trait';
  if(a.prestige||b.prestige)tline+=' · 👑 30% to pass the Prestige trait'; else tline+=' · 👑 '+Math.round(PRESTIGE_CHANCE*100)+'% Prestige';
  return '<div id="breedPreview" style="font-size:12px;border:1px dashed #d8c8a8;border-radius:12px;padding:8px 10px;background:#fffdf7">'
   +'<div><b>'+(pure?'🏵️ Purebred':'🔀 Crossbreed')+' '+esc(lbl(rr?rr.child:rc?rc.child:dominantBreed(blood)))+'</b>'+(rr?' — the pairing always gives this'+(rr.egg?' (as an egg 🥚)':''):rc?' — '+Math.round(rc.chance*100)+'% chance, else a '+esc(lbl(dominantBreed(blood))):'')+'</div>'
   +'<div>🩸 Purity: '+Object.entries(blood).sort((x,y)=>y[1]-x[1]).slice(0,4).map(([k,v])=>esc(lbl(k))+' '+Math.round(v)+'%').join(' · ')+'</div>'
   +'<div>📊 '+rng+'</div>'
   +'<div>🎨 Likely coat: '+esc(coats.join(', '))+(wildP?' · 🌿 70% copies '+esc(wildP.name)+'\'s wild coat':'')+(ui.pot.mirror?' · 🧪 Mirror: copies '+esc((ui.mirror==='b'?b:a).name):'')+'</div>'
   +'<div>✦ Trait: '+tline+'</div>'
   +'<div>'+(a.wings||b.wings?'🪽 Wings pass every generation':'')+((a.horn||b.horn)&&!ui.pot.hornbud?' · 🦄 Horn 60%':'')+(ui.pot.hornbud?' · 🦄 Horn guaranteed':'')+(ui.pot.starlight?' · ✨ Glow + rainbow guaranteed':'')+'</div>'
   +'<div style="color:#8c7a63">⏳ Gestation '+((s.stats&&s.stats.foals)?mins(cost.gestMs):'90 s for your first foal')+' · rarity '+cost.rarity+'</div></div>';
 }
 function gestationHtml(s){
  const br=s.breeding; const due=Date.now()-br.since>=br.ms;
  return '<div class="evrow'+(due?' done':'')+'"><b>'+(due?'🍼 The foal is here!':'⏳ A foal on the way')+'</b><span>'+esc(br.names[0])+' × '+esc(br.names[1])+(br.pot&&br.pot.length?' · potions: '+br.pot.map(k=>POTIONS[k]?POTIONS[k].emoji:'').join(''):'')+' · '+(due?'come and meet it':'due in '+mins(br.ms-(Date.now()-br.since)))+'</span>'
   +'<span style="flex:none;display:flex;gap:4px">'+(due?'<button data-fx="breed:collect" class="claimBtn">🍼 Meet the foal</button>':'<button data-fx="breed:hurry" title="Play-earned gems only">⏩ Hurry · '+hurryCost(br)+' 💎</button>')+'</span></div>';
 }
 function breedHtml(s){
  let html='<div style="font-size:12px;color:#8c7a63">💞 Tokens: <b>'+(s.btok||0)+'</b> · 🧪 Potions: '+POT_KEYS.map(k=>POTIONS[k].emoji+potCount(s,k)).join(' ')+' · <button data-fx="breed:recipes" style="padding:2px 8px">📖 Recipes</button> <button data-fx="breed:pots" style="padding:2px 8px">🧪 Marta\'s stall</button></div>';
  if(s.breeding)return html+gestationHtml(s)+'<span style="font-size:11px;color:#8c7a63">One foal at a time — Marta\'s rule.</span>';
  const el=eligible(s); if(el.length<2)return html+'<span style="font-size:13px">You need two grown horses who trust you (<b>❤️ '+BREED_BOND+'+</b>) — feed, groom and ride to get there. Eligible now: '+el.length+'</span>';
  let st=el.filter(e=>sexOf(e.h)==='m'), ma=el.filter(e=>sexOf(e.h)==='f'); const swap=!st.length||!ma.length; if(swap){st=el;ma=el;}
  if(!ui.a||!st.some(e=>e.h.id===ui.a))ui.a=st[0].h.id; if(!ui.b||!ma.some(e=>e.h.id===ui.b)||ui.b===ui.a)ui.b=(ma.find(e=>e.h.id!==ui.a)||ma[0]).h.id;
  const a=byId(s,ui.a),b=byId(s,ui.b);
  html+='<div class="crow"><span class="lbl">♂ Stallion</span><select data-fxin="breed:pick:a">'+st.map(e=>optRow(s,e).replace('value="'+e.h.id+'"','value="'+e.h.id+'"'+(e.h.id===ui.a?' selected':''))).join('')+'</select></div>'
   +'<div class="crow"><span class="lbl">♀ Mare</span><select data-fxin="breed:pick:b">'+ma.map(e=>optRow(s,e).replace('value="'+e.h.id+'"','value="'+e.h.id+'"'+(e.h.id===ui.b?' selected':''))).join('')+'</select></div>'
   +(swap?'<span style="font-size:11px;color:#8c7a63">Only one sex is ready today, so Marta will pair any two grown horses.</span>':'');
  if(!a||!b||a===b)return html+'<span>Pick two different horses.</span>';
  html+=previewHtml(s,a,b);
  html+='<div class="crow" style="gap:6px;flex-wrap:wrap"><span class="lbl">🧪 Potions</span>'+POT_KEYS.map(k=>{const n=potCount(s,k);return '<label title="'+esc(POTIONS[k].desc)+'" style="font-size:12px;'+(n?'':'opacity:.5')+'"><input type="checkbox" data-fxin="breed:pot:'+k+'" '+(ui.pot[k]?'checked':'')+(n?'':' disabled')+'> '+POTIONS[k].emoji+' '+esc(POTIONS[k].label)+' ×'+n+'</label>';}).join('')
   +(ui.pot.mirror?'<select data-fxin="breed:mirror"><option value="a"'+(ui.mirror==='a'?' selected':'')+'>copy '+esc(a.name)+'</option><option value="b"'+(ui.mirror==='b'?' selected':'')+'>copy '+esc(b.name)+'</option></select>':'')+'</div>';
  const cost=breedCost(a,b);
  if(ui.confirm){const m=ui.confirm;const price=m==='t'?cost.t+' 💞 token'+(cost.t>1?'s':''):m==='g'?cost.g+' 💎':cost.c+' 🪙';
   html+='<div class="evrow done"><b>Confirm</b><span>'+esc(a.name)+' × '+esc(b.name)+' for <b>'+price+'</b>'+(POT_KEYS.some(k=>ui.pot[k])?' · potions used up: '+POT_KEYS.filter(k=>ui.pot[k]).map(k=>POTIONS[k].emoji).join(''):'')+'</span><span style="flex:none;display:flex;gap:4px"><button data-fx="breed:confirm" class="claimBtn">💞 Breed</button><button data-fx="breed:back">Back</button></span></div>';}
  else html+='<div class="crow" style="gap:6px;flex-wrap:wrap"><span class="lbl">Pay</span><button data-fx="breed:go:c" '+((s.coins||0)>=cost.c?'':'disabled')+'>'+cost.c+' 🪙</button><button data-fx="breed:go:t" '+((s.btok||0)>=cost.t?'':'disabled')+' title="Breeding tokens">'+cost.t+' 💞</button><button data-fx="breed:go:g" '+((s.gems||0)>=cost.g?'':'disabled')+' title="Play-earned gems">'+cost.g+' 💎</button><span style="font-size:11px;color:#8c7a63">cost rises with the parents\' rarity ('+cost.rarity+')</span></div>';
  return html;
 }
 function potsHtml(s){return '<div style="font-size:12px;color:#8c7a63">🧪 Marta\'s stall — potions also drop from clean rounds, a ribbon-rich week and the foal questline. Coins only, never gems.</div>'
  +POT_KEYS.map(k=>'<div class="evrow">'+POTIONS[k].emoji+' <b>'+esc(POTIONS[k].label)+'</b><span>'+esc(POTIONS[k].desc)+' · owned ×'+potCount(s,k)+'</span><button data-fx="breed:buypot:'+k+'" '+((s.coins||0)>=POTIONS[k].price?'':'disabled')+'>'+POTIONS[k].price+' 🪙</button></div>').join('')+'<button data-fx="breed:tab:breed">← Back to the barn</button>';}
 function allRecipes(){const out=FANTASY_RECIPES.map(r=>({child:r.child,a:r.parents[0],b:r.parents[1],chance:r.chance,egg:false}));const rr=R();if(rr)for(const r of rr.VARIANT_RECIPES){out.push({child:r.child,a:r.a,b:r.b.breed?r.b.breed:null,bHint:r.hint,chance:1,egg:!!r.egg});}return out;}
 function recipesHtml(s){
  const rows=allRecipes().map(r=>{const cb=byKey(r.child);if(!cb)return null;const stars=starsOfBreed(cb);const have=s.horses.some(h=>h.breed===r.child)||(s.roster&&s.roster.variantsFound&&s.roster.variantsFound[r.child]);const ownA=s.horses.some(h=>!h.foal&&h.breed===r.a),ownB=r.b?s.horses.some(h=>!h.foal&&h.breed===r.b):false;return {r,cb,stars,have,ownA,ownB};}).filter(Boolean).filter(x=>ui.rec==='all'||x.stars===+ui.rec);
  return '<div class="crow" style="gap:4px"><span class="lbl" style="font-size:11px">Stars</span>'+['all','5','6'].map(f=>'<button class="tabbtn'+(ui.rec===f?' on':'')+'" data-fx="breed:recfilter:'+f+'" style="padding:3px 9px">'+(f==='all'?'All':'⭐'.repeat(+f))+'</button>').join('')+'</div>'
   +'<div style="font-size:12px;color:#8c7a63">📖 Fantasy horses you can breed for. Dominant bloodlines count: a half-Unicorn foal is still a Unicorn in the barn.</div>'
   +rows.map(({r,cb,stars,have,ownA,ownB})=>'<div class="evrow'+(have?' done':'')+'">'+(have?'✅':'🔒')+' <b>'+esc(cb[1])+'</b><span><span style="color:#d9a520;letter-spacing:-2px">'+'⭐'.repeat(stars)+'</span> '+cb[2]+' · needs '+(ownA?'✅ ':'')+esc(lbl(r.a))+' × '+(r.b?(ownB?'✅ ':'')+esc(lbl(r.b)):esc(r.bHint||'?'))+' · '+(r.chance>=1?'always':Math.round(r.chance*100)+'%')+(r.egg?' · 🥚 hatches from an egg':'')+'</span></div>').join('')
   +'<button data-fx="breed:tab:breed">← Back to the barn</button>';
 }
 G.ui.panel({id:'breedPanel',title:'💞 Foaling barn',dock:{label:'🍼',after:'stableBtn',title:'Marta\'s foaling barn — breeding',pip:()=>{const s=fresh();return s&&s.breeding&&Date.now()-s.breeding.since>=s.breeding.ms?true:0;}},
  render(p,s){return '<div class="ph">🍼 Marta\'s Foaling Barn <span style="color:#8c7a63;font-size:12px;font-weight:600">by the pasture gate</span><button data-fx="close:breedPanel" style="margin-left:auto">✖</button></div>'+(ui.tab==='pots'?potsHtml(s):ui.tab==='recipes'?recipesHtml(s):breedHtml(s));}});
 G.ui.shopTab({id:'breed',label:'💞 Breed',render(s){return '<div class="ph" style="font-size:14px">🍼 Marta\'s Foaling Barn</div>'+breedHtml(s);}});
 G.ui.shopTab({id:'recipes',label:'📖 Recipes',render(s){return recipesHtml(s);}});
 G.ui.action('breed',(args,el)=>{
  const what=args[0], val=args[1];
  if(what==='pick'){ui[val]=+el.value;ui.confirm=null;refreshUI();return;}
  if(what==='pot'){ui.pot[val]=!!el.checked;ui.confirm=null;refreshUI();return;}
  if(what==='mirror'){ui.mirror=el.value;refreshUI();return;}
  if(what==='go'){ui.confirm=val||'c';refreshUI();return;}
  if(what==='back'){ui.confirm=null;refreshUI();return;}
  if(what==='confirm'){startPairing(ui.confirm||'c');return;}
  if(what==='hurry'){hurry();return;}
  if(what==='collect'){checkBirth();return;}
  if(what==='open'){const d=$('dlg');if(d)d.style.display='none';ui.tab='breed';G.ui.open('breedPanel');return;}
  if(what==='tab'){ui.tab=val;refreshUI();return;}
  if(what==='pots'){ui.tab='pots';if($('shopPanel').style.display==='flex'){G.ui.open('breedPanel');}else refreshUI();return;}
  if(what==='recipes'){const d=$('dlg');if(d)d.style.display='none';if($('shopPanel').style.display==='flex'){G.ui.openShop('recipes');}else{ui.tab='recipes';G.ui.open('breedPanel');}return;}
  if(what==='recfilter'){ui.rec=val;refreshUI();if($('shopPanel').style.display==='flex')G.ui.openShop('recipes');return;}
  if(what==='buypot'){let ok=false;sync(s=>{const P=POTIONS[val];if(!P||(s.coins||0)<P.price)return;s.coins-=P.price;s.items['pot_'+val]=(s.items['pot_'+val]||0)+1;ok=true;});toast(ok?POTIONS[val].emoji+' '+POTIONS[val].label+' bought!':'Not enough coins.');if(ok){G.money.refreshWallet();try{G.sCoin();}catch(e){}}refreshUI();return;}
  if(what==='warm'){warmEgg();G.ui.renderStable();return;}
  if(what==='sheet'){openSheet(+val);return;}
  if(what==='tree'){openTree(+val);return;}
  if(what==='ride'){const sel=$('horseSel');if(sel){sel.value=String(+val);sel.onchange();G.hidePanels();}return;}
 });
 G.on('rideFoal',h=>{toast('🍼 '+h.name+' is still a foal — ride it when it grows up (level 3, or a day).');return true;});

 /* ---- 15. the horse sheet and the family tree ---------------------------------------- */
 function statsBlock(h){
  G.xp.ensureStats(h); const lc=G.xp.statCap(h), fx=traitFx(h);
  return '<div style="font-size:11px;color:#8c7a63;margin-top:4px">Stats · level cap '+lc+' at Lv '+(h.level||1)+' · breed ceilings apply · feed to train</div>'
   +STAT_KEYS.map(k=>{const v=h.stats[k],need=G.xp.statNeed(v),bc=G.xp.statCeil(h,k),cap=Math.min(lc,bc),px=v>=cap?100:Math.round(100*Math.min(1,(h.sxp[k]||0)/need));
    return '<div class="crow"><span class="lbl">'+STAT_LBL[k]+'</span><div class="cbar" title="'+(v>=cap?'at cap · breed ceiling '+bc:(h.sxp[k]||0)+' / '+need+' XP to '+(v+1)+' · breed ceiling '+bc)+'"><div class="cfill" style="width:'+px+'%;background:'+(v>=cap?'#c9b27a':'#7fb0e0')+'"></div></div><b style="width:52px;text-align:right;white-space:nowrap">'+v+'<span style="color:#8c7a63;font-weight:600;font-size:11px">/'+cap+'</span>'+(fx.pts[k]?'<span style="color:#3b8bd6;font-size:11px"> +'+fx.pts[k]+'</span>':'')+'</b></div>';}).join('');
 }
 function sheetHtml(s,i){
  const h=s.horses[i]; if(!h)return '<span>No such horse.</span>'; G.xp.ensureStats(h);
  const P=T.PERS[h.pers]||T.PERS.relaxed, hearts=Math.max(0,Math.min(5,Math.round((h.bond||0)/20))), M=G.xp.masteryOf(s,h.breed), mx=(R()?R().mxOf(h.breed):10);
  const rt=R()?R().traitsOf(h):[]; const inv=s.tack||[]; const riding=i===G.horse.rideIdx();
  const age=h.foal?(h.egg?'🥚 an egg · warmed '+(h.eggWarm||0)+'/'+EGG_WARMS:'🍼 foal · grows up in '+mins(86400000-(Date.now()-(h.born||Date.now()))))+' or at Lv 3':'grown';
  const ln=h.lineage||{}; const sire=ln.sire!=null&&byId(s,ln.sire), dam=ln.dam!=null&&byId(s,ln.dam);
  const ph=(!isFantasy(h)&&h.genes)?phenotype(h.genes,h.id):null;
  let html='<div class="ph">📋 '+esc(h.name)+' '+starsOf(h)+'<span style="color:#8c7a63;font-size:12px;font-weight:600">'+esc(lbl(h.breed))+' · '+sexGlyph(h)+' · '+rarityOf(h)+'</span><button data-fx="close:sheetPanel" style="margin-left:auto">✖</button></div>'
   +'<div style="font-size:13px"><b>Lv '+(h.level||1)+'</b> · '+'❤️'.repeat(hearts)+'🤍'.repeat(5-hearts)+' bond '+Math.round(h.bond||0)+' · '+age+(riding?' · <span class="badge">RIDING</span>':'')+'</div>'
   +'<div class="crow"><span class="lbl">✨ XP</span><div class="cbar"><div class="cfill" style="width:'+Math.round(100*(h.xp||0)/(50+(h.level||1)*50))+'%;background:#f3b73d"></div></div></div>'
   +statsBlock(h)
   +'<div style="font-size:12px;margin-top:6px">'+P.emoji+' <b>'+esc(P.label)+'</b> — '+esc(P.desc)+'</div>'
   +'<div style="font-size:12px;margin-top:6px">✦ <b>Traits</b> · '+(h.trait&&CLASS_TRAITS[h.trait.id]?chip(h.trait)+' <span style="color:#8c7a63">'+CLS_LABEL[CLASS_TRAITS[h.trait.id].cls]+' · '+esc(CLASS_TRAITS[h.trait.id].desc)+(h.foal?' (once grown)':'')+'</span>':'<span style="color:#8c7a63">no bloodline trait — bought, won and tamed horses carry none; foals inherit one</span>')
   +(h.prestige&&CLASS_TRAITS[h.prestige.id]?'<br>👑 '+chip(h.prestige)+' <span style="color:#8c7a63">Prestige · '+esc(CLASS_TRAITS[h.prestige.id].desc)+'</span>':'')
   +(rt.length?'<br>🎯 '+rt.map(k=>'<span style="background:#fff3d6;border:1px solid #e8d2a0;border-radius:8px;padding:0 6px;font-size:11px;font-weight:700" title="'+esc(TRAITS[k].desc||'')+'">'+(TRAITS[k].icon||'✦')+' '+esc(TRAITS[k].label)+'</span>').join(' '):'')+'</div>'
   +'<div style="font-size:12px;margin-top:6px">🩸 <b>Bloodline</b> · '+bloodLine(h,4)+(purityOf(h)>=100?' <span class="badge">PUREBRED</span>':purityOf(h)>=75?' <span style="color:#8c7a63">(purebred line)</span>':' <span style="color:#8c7a63">(crossbred)</span>')+' · gen '+(ln.gen||0)
   +'<br>🌳 Sire: '+(sire?esc(sire.name):ln.sireName?esc(ln.sireName)+' (gone)':'unknown')+' · Dam: '+(dam?esc(dam.name):ln.damName?esc(ln.damName)+' (gone)':'unknown')+' <button data-fx="breed:tree:'+i+'" style="padding:2px 8px">🌳 Family tree</button></div>'
   +'<div style="font-size:12px;margin-top:6px">🎨 <b>Coat</b> · '+(h.coat?'themed coat: '+esc(h.coat):ph?esc(ph.label)+(h.coatLabel&&h.coatLabel!==ph.label?' ('+esc(h.coatLabel)+')':'')+' <span style="color:#8c7a63" title="genotype">'+esc(genotypeStr(h.genes))+'</span>':esc((R()&&R().variantLabel(h))||'breed colours'))
   +(h.wild&&h.wild.coat?' · 🌿 wild coat <b>'+esc(h.wild.coat)+'</b>':'')+(wildWindow(h)?' · passes on for '+mins(wildLeft(h)):'')+(h.newCoat?' · 🆕 first of its kind':'')+'</div>'
   +'<div style="font-size:12px;margin-top:6px">🐎 <b>Tack</b> · '+T.GEAR_SLOTS.map(sl=>{const it=h.gear&&inv.find(t=>t.id===h.gear[sl]);const b=it?G.horse.gearBonus(it):{};return '<span style="white-space:nowrap">'+(it?'<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:'+(T.RAR_COL[it.rarity]||'#ccc')+'"></span> '+esc(it.name)+' Lv'+(it.lvl||1)+(Object.keys(b).length?' ('+Object.keys(b).map(k=>'+'+b[k]+' '+k).join(', ')+')':''):esc(SLOT_LBL[sl]||sl)+': none')+'</span>';}).join(' · ')+(riding?' <button data-fx="shop:tack" style="padding:2px 8px">Manage</button>':'')+'</div>'
   +'<div style="font-size:12px;margin-top:6px">🎖️ <b>'+esc(lbl(h.breed))+' mastery '+M+'/'+mx+'</b></div>'
   +'<div class="crow" style="gap:6px;margin-top:8px">'+(riding||h.foal?'':'<button data-fx="breed:ride:'+i+'">🏇 Ride</button>')+'<button data-fx="open:stablePanel">🐎 Stable</button>'+(!h.foal&&(h.bond||0)>=BREED_BOND?'<button data-fx="breed:open">💞 Breed</button>':'')+'</div>';
  return html;
 }
 G.ui.panel({id:'sheetPanel',title:'📋 Horse sheet',render(p,s){return sheetHtml(s,ui.sheet||0);}});
 function openSheet(i){ui.sheet=i;G.ui.open('sheetPanel');}
 function node(s,h,role){if(!h)return '<div class="evrow" style="opacity:.6"><b>'+role+'</b><span>unknown</span></div>';
  return '<div class="evrow"><span style="width:22px;height:22px;border-radius:50%;background:'+((h.colors&&h.colors.body)||'#8a5a2b')+';display:inline-block;flex:none;border:2px solid #fff"></span><b>'+esc(h.name)+'</b><span>'+role+' · '+esc(lbl(h.breed))+' '+starsOf(h)+' · '+bloodLine(h,2)+(h.trait&&CLASS_TRAITS[h.trait.id]?' · '+chip(h.trait):'')+(h.prestige&&CLASS_TRAITS[h.prestige.id]?' '+chip(h.prestige):'')+'</span><button data-fx="breed:sheet:'+idxOf(s,h.id)+'" style="padding:2px 8px">📋</button></div>';}
 function ghost(name,breed,role){return '<div class="evrow" style="opacity:.7"><b>'+esc(name)+'</b><span>'+role+' · '+esc(lbl(breed))+' · no longer on the ranch</span></div>';}
 function treeHtml(s,i){
  const h=s.horses[i]; if(!h)return '<span>No such horse.</span>'; const ln=h.lineage||{};
  const par=(x,role)=>{const L=x&&x.lineage||{};const p=L[role]!=null&&byId(s,L[role]);if(p)return node(s,p,role==='sire'?'Sire':'Dam');if(L[role+'Name'])return ghost(L[role+'Name'],L[role+'Breed']||x.breed,role==='sire'?'Sire':'Dam');return node(s,null,role==='sire'?'Sire':'Dam');};
  const sire=ln.sire!=null&&byId(s,ln.sire), dam=ln.dam!=null&&byId(s,ln.dam);
  const kids=s.horses.filter(x=>x.lineage&&(x.lineage.sire===h.id||x.lineage.dam===h.id));
  const grand=[].concat(...kids.map(k=>s.horses.filter(x=>x.lineage&&(x.lineage.sire===k.id||x.lineage.dam===k.id))));
  let html='<div class="ph">🌳 Bloodlines · '+esc(h.name)+'<button data-fx="close:treePanel" style="margin-left:auto">✖</button></div>'
   +'<div style="font-size:12px;color:#8c7a63">Purity: '+bloodLine(h,4)+' · generation '+(ln.gen||0)+(ln.cls?' · born a '+(ln.cls==='pure'?'purebred':'crossbreed'):'')+'</div>'
   +'<div class="ph" style="font-size:13px">Grandparents</div>'+(sire?par(sire,'sire')+par(sire,'dam'):'<span style="font-size:12px;color:#8c7a63">— sire\'s side unknown</span>')+(dam?par(dam,'sire')+par(dam,'dam'):'<span style="font-size:12px;color:#8c7a63">— dam\'s side unknown</span>')
   +'<div class="ph" style="font-size:13px">Parents</div>'+par(h,'sire')+par(h,'dam')
   +'<div class="ph" style="font-size:13px">This horse</div>'+node(s,h,'')
   +'<div class="ph" style="font-size:13px">Descendants</div>'+(kids.length?kids.map(k=>node(s,k,'Foal')).join('')+grand.map(k=>node(s,k,'Grandfoal')).join(''):'<span style="font-size:12px;color:#8c7a63">none yet — pair '+esc(h.name)+' at Marta\'s barn</span>');
  return html;
 }
 G.ui.panel({id:'treePanel',title:'🌳 Bloodlines',render(p,s){return treeHtml(s,ui.tree||0);}});
 function openTree(i){ui.tree=i;G.ui.open('treePanel');}
 G.ui.careHeader((s,h)=>'<div style="font-size:11.5px;margin:2px 0"><button data-fx="breed:sheet:'+G.horse.rideIdx()+'" style="padding:2px 8px">📋 Full sheet</button> '+sexGlyph(h)+(h.trait&&CLASS_TRAITS[h.trait.id]?' · '+chip(h.trait):'')+(h.prestige&&CLASS_TRAITS[h.prestige.id]?' '+chip(h.prestige):'')+' · 🩸 '+bloodLine(h,2)+'</div>');
 G.ui.stableRow((h,i)=>'<span style="font-size:11px;color:#8c7a63;flex-basis:100%;display:flex;gap:6px;flex-wrap:wrap;align-items:center">'+sexGlyph(h)+(h.trait&&CLASS_TRAITS[h.trait.id]?chip(h.trait):'')+(h.prestige&&CLASS_TRAITS[h.prestige.id]?chip(h.prestige):'')+'<span>🩸 '+bloodLine(h,1)+(purityOf(h)>=100?'':' +')+'</span>'+(wildWindow(h)?'<span>🌿 wild '+mins(wildLeft(h))+'</span>':'')+(h.egg?'<span>🥚 '+(h.eggWarm||0)+'/'+EGG_WARMS+'</span>':'')+'<button data-fx="breed:sheet:'+i+'" style="padding:1px 7px">📋</button><button data-fx="breed:tree:'+i+'" style="padding:1px 7px">🌳</button></span>');

 /* ---- 16. achievements, state, exports ------------------------------------------------ */
 G.quest.addAch({id:'foal1',icon:'🍼',label:'First foal',desc:'Breed a foal at Marta\'s barn',v:s=>(s.stats&&s.stats.foals)||0,goal:1,r:{c:200,btok:1}});
 G.quest.addAch({id:'foal5',icon:'🍼',label:'Foaling season',desc:'Breed 5 foals',v:s=>(s.stats&&s.stats.foals)||0,goal:5,r:{g:3,btok:2}});
 G.quest.addAch({id:'foalq',icon:'👣',label:'Foal\'s first steps',desc:'Finish the foal questline',v:s=>(s.foalq&&s.foalq.idx)||0,goal:FOAL_STORY.length,r:{g:3}});
 G.quest.addAch({id:'coats10',icon:'🎨',label:'Colour breeder',desc:'Discover 10 coats through breeding',v:s=>Object.keys(s.coatsFound||{}).length,goal:10,r:{g:3}});
 G.quest.addAch({id:'hatch1',icon:'🐣',label:'Hatchling',desc:'Hatch a dragon egg',v:s=>(s.stats&&s.stats.hatched)||0,goal:1,r:{g:4}});
 G.quest.addAch({id:'wildfoal1',icon:'🌿',label:'Wild blood',desc:'Breed a foal that carries a wild coat',v:s=>(s.stats&&s.stats.wildFoals)||0,goal:1,r:{c:250}});
 G.quest.addAch({id:'prestige1',icon:'👑',label:'Prestige line',desc:'Own a horse with a Prestige trait',v:s=>s.horses.filter(h=>h.prestige&&CLASS_TRAITS[h.prestige.id]).length,goal:1,r:{g:3}});
 G.quest.addAch({id:'trait3',icon:'✦',label:'Bred true',desc:'Raise a bloodline trait to level 3',v:s=>Math.max(0,...s.horses.map(h=>(h.trait&&h.trait.lvl)||0)),goal:3,r:{g:4,btok:1}});
 G.quest.addAch({id:'recipe1',icon:'📖',label:'By the book',desc:'Breed a fantasy horse from a recipe',v:s=>(s.stats&&s.stats.recipes)||0,goal:1,r:{g:3}});
 G.on('state',o=>{const s=fresh()||{};o.breeding={pairing:s.breeding?{names:s.breeding.names,dueMs:Math.max(0,s.breeding.ms-(Date.now()-s.breeding.since)),mode:s.breeding.mode}:null,btok:s.btok||0,foals:(s.stats&&s.stats.foals)||0,foalq:s.foalq?{idx:s.foalq.idx,prog:s.foalq.prog}:null,eggs:(s.horses||[]).filter(h=>h.egg).length,companion:s.companion||null,coatsFound:Object.keys(s.coatsFound||{}).length};});
 G.on('boot',()=>{try{window.__cachedCompanion=(fresh()||{}).companion||0;}catch(e){}setTimeout(()=>{checkBirth();hatchCheck();},2500);});

 G.breeding={CLASS_TRAITS,TRAIT_COMBOS,POTIONS,BREED_COST,GEST_MIN,FOAL_STORY,FANTASY_RECIPES,WILD_COATS,BREED_GENES,LOCI,BREED_BOND,WILD_BREED_MS,EGG_WARMS,EGG_HATCH_MS,
  breedCost,inheritTrait,inheritPrestige,traitFx,mixBlood,dominantBreed,purityOf,isPurePair,deriveGenes,mixGenes,phenotype,likelyCoats,recipeFor,wildWindow,eligible,
  startPairing,hurry,checkBirth,hatchCheck,warmEgg,foalAct,foalEvt,addBtok,openSheet,openTree,ui,allRecipes,companionFoal};
}

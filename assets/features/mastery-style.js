/* Feature package 'mastery-style' — the breed mastery ladder and everything it pays out.

   One ladder, read by six features. A real breed climbs ten rungs (one per horse of that breed
   you have ever owned; a named coat variant counts toward its base breed), a fantasy horse
   climbs five and counts only duplicates of itself. The rungs unlock, in order: a breed perk,
   the natural hair dyes, a second perk, the first tier of mane and tail styles, a third perk,
   the bold dyes, a fourth perk, the second tier of styles, bareback riding, and the master
   perk. Fantasy horses get exclusive effect accessories (icicle manes, phantom masks, rainbow
   horns) instead of dyes, and Wild Mode — riding as the horse, no rider — at the top.

   Perks are exposed only as G.addMul factors and the 'ride' hook, so the movement code, the
   course engine and the stat system never see them. Looks are rendered by
   assets/horse-style.js on the mount, the pasture herd and club mates' horses alike.

   Owned by that package: edit only this file and the inline hot spots assigned to it
   (masteryOf, the mastery block of renderCare, riderSeat's bareback line, riderLegs' saddle
   test, grantStatXp's 'sxp' factor). See index.js for the contract. Nothing runs at import. */
import {createHorseStyle} from '../horse-style.js';
export const id='mastery-style';
export function install(G){
 const {THREE,$}=G, T=G.tables, player=G.horse.player;
 let lastToast=''; const toast=m=>{lastToast=String(m);try{G.toast(m);}catch(e){}};   // recorded, so a headless check can read what the player was told
 const fresh=()=>G.save.fresh(), sync=fn=>G.save.sync(fn);
 const rideIdx=()=>G.horse.rideIdx(), ridden=()=>G.horse.ridden(), RIG=()=>G.horse.RIG(), TACK=()=>G.horse.TACK();
 const breedRow=b=>T.BREEDS3.find(x=>x[0]===b), breedLabel=b=>G.horse.breedLabel(b);
 const HS=createHorseStyle({THREE});
 const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

 /* ===== 1. The ladder ================================================================== */
 const FANTASY_TIERS={Mythic:1,Dragon:1,Legendary:1};
 function isFantasy(b){const r=breedRow(b);if(!r)return false;const o=r[7]||{};return !!(FANTASY_TIERS[r[2]]||o.coat||o.horn||o.wings||o.dragon);}
 function maxOf(b){return isFantasy(b)?5:10;}
 G.masteryMax=maxOf;                                        // masteryOf clamps to this
 const masteryOf=(s,b)=>G.xp.masteryOf(s,b);
 const LADDER={
  1:{id:'perk1',label:'Breed perk I',icon:'🎯'},2:{id:'dye1',label:'Natural hair dyes',icon:'🎨'},
  3:{id:'perk2',label:'Breed perk II',icon:'🎯'},4:{id:'style1',label:'Mane & tail styles I · browband studs',icon:'💇'},
  5:{id:'perk3',label:'Breed perk III',icon:'🎯'},6:{id:'dye2',label:'Bold hair dyes · sparkle trail',icon:'🌈'},
  7:{id:'perk4',label:'Breed perk IV',icon:'🎯'},8:{id:'style2',label:'Mane & tail styles II · stable badge 🎖️',icon:'💇'},
  9:{id:'bare',label:'Bareback riding',icon:'🐎'},10:{id:'perk5',label:'Master perk · +10% XP',icon:'👑'}};
 const LADDER_F={1:{id:'perk1',label:'Breed perk I',icon:'🎯'},2:{id:'acc1',label:'Exclusive accessory I · styles I',icon:'✨'},
  3:{id:'perk2',label:'Breed perk II',icon:'🎯'},4:{id:'acc2',label:'Exclusive accessory II · styles II · bold dyes',icon:'✨'},
  5:{id:'wild',label:'Wild Mode · master perk',icon:'🐎'}};
 function ladderOf(b){ if(isFantasy(b))return LADDER_F; const r=breedRow(b); if(r&&r[2]==='Epic'){const L=Object.assign({},LADDER);L[9]={id:'bare',label:'Bareback riding · Wild Mode',icon:'🐎'};return L;} return LADDER; }
 Object.assign(T.MASTERY_UNLOCKS,{1:'Breed perk',2:'Natural hair dyes',3:'Breed perk II',4:'Mane & tail styles I + browband studs',5:'Breed perk III',6:'Bold hair dyes + sparkle trail',7:'Breed perk IV',8:'Mane & tail styles II + stable badge 🎖️',9:'Bareback riding',10:'Master perk + 10% XP'});
 /* what each cosmetic needs, by ladder */
 const NEED={styleT1:b=>isFantasy(b)?2:4, styleT2:b=>isFantasy(b)?4:8, dye1:b=>2, dye2:b=>isFantasy(b)?4:6, studs:b=>isFantasy(b)?2:4, trail:b=>isFantasy(b)?3:6, bare:b=>isFantasy(b)?5:9};
 function canWild(s,h){ if(!h)return false; const M=masteryOf(s,h.breed); if(isFantasy(h.breed))return M>=5; const r=breedRow(h.breed); return !!r&&r[2]==='Epic'&&M>=9; }

 /* ===== 2. Perks ======================================================================= */
 /* fx keys: accel speed agility jump flySpeed (multipliers) · drain regen (stamina multipliers)
    · blownAt (recover from blown above this) · boostMul (race boost length) · xp (+fraction)
    · sxp{stat:+fraction} · evXp{race|jump|dressage:+fraction} · coin bond (multipliers)
    · momentum (drain falls the longer you gallop) · perTack{regen|xp} per Epic+ tack piece
    · worthy (XP +15% at bond 80+) */
 const PERKS={
  quickStart:{label:'Quick off the Mark',desc:'+15% acceleration',fx:{accel:1.15}},
  topGear:{label:'Top Gear',desc:'+6% top speed',fx:{speed:1.06}},
  surefoot:{label:'Surefooted',desc:'+10% agility in the turns',fx:{agility:1.10}},
  springHeels:{label:'Spring Heels',desc:'+12% jump',fx:{jump:1.12}},
  secondWind:{label:'Second Wind',desc:'recovers from a blown gallop sooner',fx:{blownAt:.22}},
  durableDash:{label:'Durable Dash',desc:'race boosts last half as long again',fx:{boostMul:1.5}},
  momentum:{label:'Forward Momentum',desc:'the longer the gallop, the less it costs (to −30%)',fx:{momentum:1}},
  freeRunner:{label:'Free Runner',desc:'−25% stamina at the gallop',fx:{drain:.75}},
  steadyHeart:{label:'Steady Heart',desc:'+15% stamina recovery',fx:{regen:1.15}},
  ironLungs:{label:'Iron Lungs',desc:'−15% stamina at the gallop',fx:{drain:.85}},
  quickLearner:{label:'Quick Learner',desc:'+25% acceleration XP from food',fx:{sxp:{accel:.25}}},
  keenStudent:{label:'Keen Student',desc:'+25% agility XP from food',fx:{sxp:{agility:.25}}},
  strongBack:{label:'Strong Back',desc:'+25% stamina XP from food',fx:{sxp:{stamina:.25}}},
  fleetStudy:{label:'Fleet Study',desc:'+25% speed XP from food',fx:{sxp:{speed:.25}}},
  bigJumper:{label:'Big Jumper',desc:'+25% jump XP from food',fx:{sxp:{jump:.25}}},
  xcCompetitor:{label:'Cross-Country Competitor',desc:'+30% XP from races',fx:{evXp:{race:.3}}},
  showJumper:{label:'Show Jumper',desc:'+30% XP from jumping courses',fx:{evXp:{jump:.3}}},
  dressageMind:{label:'Dressage Mind',desc:'+30% XP from dressage tests',fx:{evXp:{dressage:.3}}},
  stylishRecovery:{label:'Stylish Recovery',desc:'+10% stamina recovery per Epic or better tack piece',fx:{perTack:{regen:.10}}},
  topOfClass:{label:'Top of the Class',desc:'+7.5% XP per Epic or better tack piece',fx:{perTack:{xp:.075}}},
  quickStudy:{label:'Quick Study',desc:'+10% XP',fx:{xp:.10}},
  flyingLeap:{label:'Flying Leap',desc:'+12% jump',fx:{jump:1.12}},
  aerialAcrobat:{label:'Aerial Acrobat',desc:'+10% speed in the air',fx:{flySpeed:1.10}},
  soaringSpeed:{label:'Soaring Speed',desc:'+20% speed in the air',fx:{flySpeed:1.20}},
  prizePurse:{label:'Prize Purse',desc:'+5% coins while riding this breed',fx:{coin:1.05}},
  trueBond:{label:'True Bond',desc:'+15% bond from care',fx:{bond:1.15}},
  ponyPower:{label:'Pony Power',desc:'+10% acceleration, −8% stamina cost',fx:{accel:1.10,drain:.92}},
  heavyHaul:{label:'Heavy Haul',desc:'race boosts last a quarter longer',fx:{boostMul:1.25}},
  worthyOnly:{label:'Only the Worthy',desc:'+15% XP once the bond is 80 or better',fx:{worthy:.15}},
  battleBond:{label:'Battle-tested Bond',desc:'+25% bond from care',fx:{bond:1.25}},
 };
 /* per breed: rungs [1,3,5,7,10] for a real breed, [1,3,5] for a fantasy one */
 const BREED_PERKS={
  'bay-sporthorse':['steadyHeart','secondWind','quickStudy','durableDash','topGear'],
  bay:['quickStart','secondWind','quickLearner','durableDash','topGear'],
  chestnut:['ponyPower','secondWind','keenStudent','momentum','trueBond'],
  palomino:['xcCompetitor','freeRunner','secondWind','durableDash','momentum'],
  haflinger:['strongBack','steadyHeart','ponyPower','momentum','trueBond'],
  grey:['dressageMind','surefoot','keenStudent','secondWind','topGear'],
  black:['stylishRecovery','topOfClass','secondWind','durableDash','momentum'],
  pinto:['surefoot','secondWind','keenStudent','durableDash','prizePurse'],
  appaloosa:['xcCompetitor','ironLungs','fleetStudy','momentum','topGear'],
  sunset:['topGear','secondWind','fleetStudy','durableDash','quickStudy'],
  iceland:['ironLungs','steadyHeart','strongBack','momentum','surefoot'],
  welsh:['ponyPower','springHeels','bigJumper','secondWind','showJumper'],
  stock:['quickStart','surefoot','keenStudent','durableDash','momentum'],
  fjord:['strongBack','steadyHeart','ironLungs','momentum','trueBond'],
  morgan:['quickStart','steadyHeart','fleetStudy','durableDash','prizePurse'],
  thoro:['topGear','xcCompetitor','fleetStudy','durableDash','momentum'],
  knab:['showJumper','springHeels','bigJumper','secondWind','surefoot'],
  vanner:['trueBond','steadyHeart','strongBack','momentum','prizePurse'],
  marwari:['surefoot','secondWind','keenStudent','durableDash','quickStudy'],
  lipiz:['dressageMind','surefoot','keenStudent','springHeels','quickStudy'],
  sport:['showJumper','springHeels','bigJumper','stylishRecovery','topOfClass'],
  akhal:['topGear','ironLungs','fleetStudy','durableDash','momentum'],
  percheron:['heavyHaul','strongBack','ironLungs','momentum','trueBond'],
  shire:['heavyHaul','strongBack','steadyHeart','momentum','trueBond'],
  clyde:['heavyHaul','ironLungs','strongBack','momentum','prizePurse'],
  aether:['stylishRecovery','topOfClass','worthyOnly'],
  sunspear:['topGear','freeRunner','worthyOnly'],
  meadowlight:['quickStart','quickLearner','worthyOnly'],
  tempest:['heavyHaul','ironLungs','battleBond'],
  eclipse:['topGear','xcCompetitor','worthyOnly'],
  glacier:['heavyHaul','steadyHeart','battleBond'],
  unicorn:['trueBond','steadyHeart','quickStudy'],
  pegasus:['flyingLeap','aerialAcrobat','soaringSpeed'],
  celestial:['trueBond','quickStudy','worthyOnly'],
  ember:['quickStart','freeRunner','topGear'],
  frost:['springHeels','ironLungs','surefoot'],
  aurora:['flyingLeap','aerialAcrobat','soaringSpeed'],
  phoenix:['aerialAcrobat','freeRunner','soaringSpeed'],
  frostdrake:['flyingLeap','ironLungs','soaringSpeed'],
  emberdrake:['aerialAcrobat','freeRunner','soaringSpeed'],
  amethyst:['flyingLeap','worthyOnly','soaringSpeed'],
  stormdrake:['aerialAcrobat','battleBond','soaringSpeed'],
  verdant:['flyingLeap','steadyHeart','soaringSpeed'],
  shadowmare:['topGear','secondWind','worthyOnly'],
  kestrel:['surefoot','quickStudy','trueBond'],
  _default:['quickStart','secondWind','durableDash','momentum','topGear'],
  _fantasy:['quickStart','secondWind','worthyOnly'],
 };
 const PERK_RUNGS=[1,3,5,7,10], PERK_RUNGS_F=[1,3,5];
 function perkRows(b){ const f=isFantasy(b); const ids=BREED_PERKS[b]||(f?BREED_PERKS._fantasy:BREED_PERKS._default); const rungs=f?PERK_RUNGS_F:PERK_RUNGS; return rungs.map((r,i)=>({rung:r,id:ids[i],def:PERKS[ids[i]]})).filter(x=>x.def); }
 function epicTack(s,h){ let n=0; const g=h&&h.gear||{}; for(const k in g){ const it=(s.tack||[]).find(x=>x.id===g[k]); if(it&&T.RARITIES.indexOf(it.rarity)>=3)n++; } return n; }
 function computePerks(s,h){
  const P={accel:1,speed:1,agility:1,jump:1,flySpeed:1,drain:1,regen:1,blownAt:.35,boostMul:1,xp:0,sxp:{},evXp:{},coin:1,bond:1,momentum:0,worthy:0,ids:[],hid:h?h.id:null,M:0};
  if(!s||!h)return P;
  const M=masteryOf(s,h.breed); P.M=M; const nt=epicTack(s,h);
  for(const row of perkRows(h.breed)){ if(M<row.rung)continue; P.ids.push(row.id); const f=row.def.fx;
   for(const k in f){ const v=f[k];
    if(k==='sxp'||k==='evXp'){for(const j in v)P[k][j]=(P[k][j]||0)+v[j];}
    else if(k==='perTack'){ if(v.regen)P.regen*=1+v.regen*nt; if(v.xp)P.xp+=v.xp*nt; }
    else if(k==='xp'||k==='momentum'||k==='worthy')P[k]+=v;
    else if(k==='blownAt')P.blownAt=Math.min(P.blownAt,v);
    else P[k]*=v; } }
  if(P.worthy&&(h.bond||0)>=80)P.xp+=P.worthy;
  return P;
 }
 let PK=computePerks(null,null), gallopT=0;
 function refreshPerks(s){ s=s||fresh(); const h=s&&s.horses[rideIdx()]; PK=computePerks(s,h); return PK; }
 function perksFor(s,h){ if(h&&PK&&PK.hid===h.id&&PK.hid!=null)return PK; if(!h)return PK; return computePerks(s||fresh(),h); }
 G.addMul('xp',(s,h)=>1+perksFor(s,h).xp);
 G.addMul('sxp',(s,h,k)=>{const p=perksFor(s,h);return 1+((p.sxp&&p.sxp[k])||0);});
 G.addMul('stamDrain',(s,h)=>PK.drain*(PK.momentum?1-Math.min(.3,gallopT*.03):1));
 G.addMul('stamRegen',()=>PK.regen);
 G.addMul('coin',()=>PK.coin);
 G.addMul('bond',()=>PK.bond);
 G.on('ride',(R,dt)=>{ if(!PK)return; R.target*=player.flying?PK.flySpeed:PK.speed; R.acMul*=PK.accel; R.agMul*=PK.agility; R.jpMul*=PK.jump;
  if(R.gallop&&R.fwd&&Math.abs(player.speed)>6.5)gallopT+=dt; else gallopT=Math.max(0,gallopT-dt*2); });
 let prevBoost=0;
 G.on('courseFinish',({ev,dressage})=>{ if(!PK||!ev)return; const kind=ev.race?'race':dressage?'dressage':'jump'; const b=PK.evXp[kind]||0; if(b>0)G.xp.addXp3D(Math.round((ev.reward||100)/8*b)); });
 for(const hk of ['boot','rebuild','attachTack','grantHorse','foal','interval30'])G.on(hk,()=>{try{refreshPerks();}catch(e){}});
 G.on('wallet',s=>{try{refreshPerks(s);}catch(e){}});

 /* ===== 3. Mastery-up toasts and save fields ========================================== */
 G.save.ensure(s=>{ s.accInv=s.accInv||{}; if(s.wildMode==null)s.wildMode=false; s.masteryLv=s.masteryLv||{}; });
 function masteryBump(s,h){ if(!s||!h||!h.breed)return; const keys=[h.breed]; const base=BREED_FAMILY_BASE(h.breed); if(base&&base!==h.breed)keys.push(base);
  for(const b of keys){ const M=masteryOf(s,b); const prev=s.masteryLv[b]||0; if(M>prev){ s.masteryLv[b]=M; const L=ladderOf(b)[M]; if(L)toast('🎖️ '+breedLabel(b)+' mastery '+M+'/'+maxOf(b)+' — '+L.label+'!'); } } }
 function BREED_FAMILY_BASE(b){ return (G.xp.masteryBreed?G.xp.masteryBreed(b):b); }
 G.on('grantHorse',(s,h)=>masteryBump(s,h)); G.on('foal',(s,f)=>masteryBump(s,f));

 /* ===== 4. Looks: styles, dyes, accessories, fantasy effects ============================ */
 const MANE=[{id:'natural',lbl:'Natural',t:0,len:1},{id:'flowing',lbl:'Flowing',t:1,len:1.25},{id:'roached',lbl:'Roached',t:1,len:.35},{id:'trim',lbl:'Show trim',t:1,len:.7},
  {id:'braid',lbl:'Running braid',t:2,len:.55,decor:'braid'},{id:'banded',lbl:'Banded',t:2,len:.8,decor:'bands'},{id:'ribbons',lbl:'Ribbon plaits',t:2,len:.6,decor:'ribbons'}];
 const TAIL=[{id:'natural',lbl:'Natural',t:0,len:1},{id:'full',lbl:'Full & flowing',t:1,len:1.2},{id:'banged',lbl:'Banged',t:1,len:.7},
  {id:'plait',lbl:'Plaited dock',t:2,len:.9,decor:'braid'},{id:'mudknot',lbl:'Mud knot',t:2,len:.45,decor:'knot'},{id:'bow',lbl:'Ribbon bow',t:2,len:1,decor:'bow'}];
 T.HAIR_STYLES.mane.splice(0,T.HAIR_STYLES.mane.length,...MANE); T.HAIR_STYLES.tail.splice(0,T.HAIR_STYLES.tail.length,...TAIL);
 const styleDef=(part,id)=>(part==='mane'?MANE:TAIL).find(x=>x.id===id)||(part==='mane'?MANE:TAIL)[0];
 const DYE_NATURAL=[['#151515','Black'],['#f4e6c5','Flaxen'],['#8a4a25','Chestnut'],['#5a3a24','Liver'],['#efe6d2','Cream'],['#d8dde3','Silver'],['#6b4a2b','Bay brown'],['#b9bec6','Grey']];
 const DYE_BOLD=[['#5affc8','Aurora mint'],['#ff7a2e','Ember'],['#9a6cff','Violet'],['#ffb6c1','Rose gold'],['#1b2a6b','Midnight'],['#c0f0ff','Glacier'],['#b8860b','Copper'],['#ffffff','Snow white']];
 const RIBBON_COLS=[['#e8a0b8','Rose'],['#3b6fd6','Lake blue'],['#ffd166','Gold'],['#f4efe4','White'],['#1e8449','Meadow green'],['#7d3c98','Plum']];
 const ACC_SLOTS=[['mask','🎭 Face'],['legs','🧦 Legs'],['tail','🎀 Tail'],['neck','📿 Neck'],['blanket','🧣 Back'],['brow','💫 Brow']];
 const ACC=[
  {id:'flymask-blue',slot:'mask',lbl:'Fly mask',desc:'Cotton mesh in Meadowlark blue',c:300,col:'#3b6fd6',col2:'#f4efe4'},
  {id:'flymask-rose',slot:'mask',lbl:'Rose fly mask',desc:'For the show ring at Cottonwood',c:300,col:'#e8a0b8',col2:'#ffffff'},
  {id:'wraps-white',slot:'legs',lbl:'Polo wraps',desc:'Clean white, blue ties',c:250,col:'#f4efe4',col2:'#3b6fd6'},
  {id:'wraps-plum',slot:'legs',lbl:'Plum polo wraps',desc:'Gold ties',c:250,col:'#7d3c98',col2:'#ffd97a'},
  {id:'tailbow-rose',slot:'tail',lbl:'Tail bow',desc:'A rose ribbon at the dock',c:150,col:'#e8a0b8'},
  {id:'tailbow-gold',slot:'tail',lbl:'Show-ring bow',desc:'Gold, for a champion',g:2,col:'#ffd166'},
  {id:'collar-bell',slot:'neck',lbl:'Bell collar',desc:'Grandpa Wren\'s old sleigh bell',c:200,col:'#c0392b',col2:'#d8b24a'},
  {id:'sheet-green',slot:'blanket',lbl:'Quarter sheet',desc:'Meadow green wool',c:400,col:'#1e8449',col2:'#f4efe4'},
  {id:'browcharm-gold',slot:'brow',lbl:'Gold brow charm',desc:'From the Riverside Crossing jeweller',dust:60,col:'#ffd97a'},
  {id:'bloom-mask',slot:'mask',lbl:'Blossom mask',desc:'Seasonal Store · Season of Bloom',season:'bloom',dust:80,col:'#f2a0c8',col2:'#ffffff'},
  {id:'sun-wraps',slot:'legs',lbl:'Long Sun wraps',desc:'Seasonal Store · Season of the Long Sun',season:'sun',dust:80,col:'#ffd166',col2:'#e07a3c'},
  {id:'ember-sheet',slot:'blanket',lbl:'Ember sheet',desc:'Seasonal Store · Season of Embers',season:'ember',dust:100,col:'#e07a3c',col2:'#3a2418'},
  {id:'frost-wraps',slot:'legs',lbl:'Frost wraps',desc:'Seasonal Store · Season of Frost',season:'frost',dust:80,col:'#cfe9f6',col2:'#3b6fd6',glow:'#6fb8ff'},
  {id:'frost-collar',slot:'neck',lbl:'Frost bell collar',desc:'Seasonal Store · Season of Frost',season:'frost',dust:60,col:'#9fd8f2',col2:'#f4ffff'},
  {id:'canyon-collar',slot:'neck',lbl:'Canyon breast collar',desc:'Coyote Canyon western set · needs a western saddle',c:600,west:true,col:'#7a583a',col2:'#d8b24a'},
  {id:'canyon-wraps',slot:'legs',lbl:'Rodeo boots',desc:'Coyote Canyon western set · needs a western saddle',c:450,west:true,col:'#5a3a24',col2:'#d8b24a'},
  {id:'canyon-sheet',slot:'blanket',lbl:'Canyon serape',desc:'Coyote Canyon western set · needs a western saddle',c:650,west:true,col:'#c0392b',col2:'#ffd166'},
  {id:'drake-mask',slot:'mask',lbl:'Drake war mask',desc:'Hollowpeak dragon set · dragons only',g:8,dragon:true,col:'#2a2230',col2:'#ff7a2e',glow:'#ff5a1a'},
  {id:'drake-wraps',slot:'legs',lbl:'Drake greaves',desc:'Hollowpeak dragon set · dragons only',g:6,dragon:true,col:'#1b1b24',col2:'#b48cff',glow:'#7a4aff'},
 ];
 const accDef=id=>ACC.find(a=>a.id===id);
 /* exclusive fantasy accessories: fx kinds mane|tail|hair (both)|horn|mask */
 const FA=(id,lbl,fx,theme,extra)=>Object.assign({id,lbl,fx,theme},extra||{});
 const FANTASY_ACC={
  aether:[FA('stardust-mane','Stardust Mane','mane','galaxy'),FA('comet-tail','Comet Tail','tail','galaxy')],
  celestial:[FA('rainbow-hair','Rainbow Mane & Tail','hair','rainbow'),FA('rainbow-horn','Rainbow Horn','horn','rainbow')],
  unicorn:[FA('rainbow-hair','Rainbow Mane & Tail','hair','rainbow'),FA('rainbow-horn','Rainbow Horn','horn','rainbow')],
  amethyst:[FA('stardust-mane','Stardust Mane','mane','galaxy'),FA('nebula-mask','Nebula Mask','mask','galaxy',{col:'#2a1a5a',col2:'#d8c0ff',glow:'#9a6cff'})],
  sunspear:[FA('lava-mane','Lava Mane','mane','fire'),FA('cinder-mask','Cinder Mask','mask','fire',{col:'#3a1410',col2:'#ffd257',glow:'#ff5a1a'})],
  ember:[FA('lava-mane','Lava Mane','mane','fire'),FA('ember-tail','Ember Tail','tail','fire')],
  emberdrake:[FA('lava-mane','Lava Mane','mane','fire'),FA('cinder-mask','Cinder Mask','mask','fire',{col:'#3a1410',col2:'#ffd257',glow:'#ff5a1a'})],
  phoenix:[FA('lava-mane','Lava Mane','mane','fire'),FA('ember-tail','Ember Tail','tail','fire')],
  glacier:[FA('icicle-mane','Icicle Mane','mane','ice'),FA('frost-mask','Frost Mask','mask','ice',{col:'#cfe9f6',col2:'#ffffff',glow:'#8fd0ff'})],
  frost:[FA('icicle-mane','Icicle Mane','mane','ice'),FA('icicle-tail','Icicle Tail','tail','ice')],
  frostdrake:[FA('icicle-mane','Icicle Mane','mane','ice'),FA('frost-mask','Frost Mask','mask','ice',{col:'#cfe9f6',col2:'#ffffff',glow:'#8fd0ff'})],
  tempest:[FA('phantom-mask',"Phantom's Mask",'mask','shadow',{col:'#170f2a',col2:'#b48cff',glow:'#7a4aff'}),FA('shadow-mane','Shadow Mane','mane','shadow')],
  shadowmare:[FA('phantom-mask',"Phantom's Mask",'mask','shadow',{col:'#170f2a',col2:'#b48cff',glow:'#7a4aff'}),FA('shadow-mane','Shadow Mane','mane','shadow')],
  stormdrake:[FA('phantom-mask',"Phantom's Mask",'mask','shadow',{col:'#170f2a',col2:'#b48cff',glow:'#7a4aff'}),FA('shadow-mane','Shadow Mane','mane','shadow')],
  meadowlight:[FA('aurora-mane','Aurora Mane','mane','aurora'),FA('aurora-tail','Aurora Tail','tail','aurora')],
  aurora:[FA('aurora-mane','Aurora Mane','mane','aurora'),FA('aurora-tail','Aurora Tail','tail','aurora')],
  verdant:[FA('aurora-mane','Aurora Mane','mane','aurora'),FA('verdant-mask','Verdant Mask','mask','aurora',{col:'#143038',col2:'#b8ffe8',glow:'#5affc8'})],
  eclipse:[FA('corona-mane','Corona Mane','mane','corona'),FA('eclipse-mask','Eclipse Mask','mask','corona',{col:'#0c0b12',col2:'#ffb44a',glow:'#ff9a2a'})],
  pegasus:[FA('cloud-mane','Cloud Mane','mane','cloud'),FA('silver-halo','Silver Halo','brow',null,{col:'#e8f0ff',glow:'#cfe0ff'})],
  kestrel:[FA('kestrel-sheen','Kestrel Sheen','hair','sheen'),FA('silver-halo','Silver Halo','brow',null,{col:'#e8f0ff',glow:'#cfe0ff'})],
  _default:[FA('stardust-mane','Stardust Mane','mane','galaxy'),FA('halo-brow','Halo Browband','brow',null,{col:'#ffd97a',glow:'#ffe7a6'})],
 };
 const FX_RUNGS=[2,4];
 function fantasyAcc(b){ return (FANTASY_ACC[b]||FANTASY_ACC._default).map((d,i)=>Object.assign({m:FX_RUNGS[i]||4},d)); }
 const fxDef=(b,id)=>fantasyAcc(b).find(d=>d.id===id)||Object.values(FANTASY_ACC).flat().find(d=>d.id===id);

 /* --- applying a look to a rig ------------------------------------------------------ */
 /* LOOKS: WeakMap rig -> {key, decor[], acc[], fxAcc[]} */
 const LOOKS=new WeakMap();
 function lookKey(h,rig){ if(!h)return ''; return JSON.stringify([h.id,h.hair,h.fx,h.acc,h.horn,rig&&rig.skin&&rig.skin.uuid,(rig&&HS.hairMeshes(rig,null).length)||0]); }
 function applyLook(rig,mount,h,force){
  if(!rig||!rig.skin||!mount||!h)return null;
  const key=lookKey(h,rig); let L=LOOKS.get(rig);
  if(L&&L.key===key&&!force)return L;
  if(L){ for(const d of L.decor)try{d.dispose();}catch(e){} for(const a of L.acc)try{a.dispose();}catch(e){} }
  L={key,decor:[],acc:[],hair:null}; LOOKS.set(rig,L);
  const hair=h.hair||{mane:'natural',tail:'natural'}, fx=h.fx||{}, acc=h.acc||{};
  const md=styleDef('mane',hair.mane), td=styleDef('tail',hair.tail);
  let theme=null, mask=3;
  const fm=fx.mane&&fxDef(h.breed,fx.mane), ft=fx.tail&&fxDef(h.breed,fx.tail), fh=fx.hair&&fxDef(h.breed,fx.hair);
  if(fh){theme=fh.theme;mask=3;} else if(fm&&ft){theme=fm.theme;mask=3;} else if(fm){theme=fm.theme;mask=1;} else if(ft){theme=ft.theme;mask=2;}
  try{ L.hair=HS.hair(rig,mount,{maneLen:md.len,tailLen:td.len,fx:theme,fxMask:mask}); }catch(e){console.warn('hair style',e);}
  const rib=(h.hairCol&&h.hairCol.ribbon)||'#e8a0b8';
  if(md.decor){const d=HS.decor(rig,mount,'mane',md.decor,md.decor==='ribbons'?rib:md.decor==='braid'?'#f2ece0':'#3a2a1a');if(d)L.decor.push(d);}
  if(td.decor){const d=HS.decor(rig,mount,'tail',td.decor,td.decor==='bow'?rib:td.decor==='knot'?'#3a2a1a':'#f2ece0');if(d)L.decor.push(d);}
  for(const slot in acc){ const def=accDef(acc[slot]); if(!def||def.slot!==slot)continue; const a=HS.accessory(def,rig,mount); if(a)L.acc.push(a); }
  const fmask=fx.mask&&fxDef(h.breed,fx.mask); if(fmask&&!acc.mask){const a=HS.accessory({slot:'mask',col:fmask.col,col2:fmask.col2,glow:fmask.glow},rig,mount);if(a)L.acc.push(a);}
  const fbrow=fx.brow&&fxDef(h.breed,fx.brow); if(fbrow&&!acc.brow){const a=HS.accessory({slot:'brow',col:fbrow.col,glow:fbrow.glow},rig,mount);if(a)L.acc.push(a);}
  return L;
 }
 function applyPlayerLook(force){ const rig=RIG(), h=ridden(); if(!rig||!rig.ready||!rig.skin||!player.mesh||!h)return null; const L=applyLook(rig,player.mesh,h,force);
  try{ const horn=player.parts&&player.parts.horn; if(horn)HS.horn(horn,!!(h.fx&&h.fx.horn)); }catch(e){} return L; }
 G.on('attachTack',()=>{applyPlayerLook();applyWild();});
 G.on('coat',()=>{applyPlayerLook();});
 G.on('rebuild',()=>{applyPlayerLook();});
 let herdT=0, lookT=0;
 G.on('tick',(dt,t)=>{
  HS.tick(t);
  /* the hero groom loads after the mount does: look again once a second until the hair is in */
  lookT+=dt; if(lookT>1){lookT=0;applyPlayerLook();}
  herdT+=dt; if(herdT>1.5){herdT=0; const herd=G.horse.herd()||[]; for(const e of herd){ if(!e.rig||!e.rig.skin||!e.parts)continue; const h=G.horse.myHorses[e.idx]; if(!h)continue; try{applyLook(e.rig,e.parts.group,h);}catch(err){} } }
  /* perks with per-frame state */
  if(PK){ if(player.blown&&player.stam>PK.blownAt)player.blown=false;
   if(PK.boostMul>1&&player.boostT>prevBoost+0.5)player.boostT*=PK.boostMul; prevBoost=player.boostT||0; }
  if(wild)enforceWild();
 });

 /* ===== 5. Wild Mode and bareback ==================================================== */
 let wild=false, reins=null;
 function findReins(){ if(reins)return reins; reins=[]; for(const o of G.scene.children){ if(o.isMesh&&o.geometry&&o.geometry.boundingSphere&&o.geometry.boundingSphere.radius===1e4)reins.push(o); } return reins; }
 function applyWild(){ const R=player.rider; if(R&&R.g)R.g.visible=!wild; const TK=TACK(); const h=ridden()||{};
  if(TK.saddle)TK.saddle.visible=!wild&&!h.bareback; if(TK.bridle)TK.bridle.visible=!wild; for(const r of findReins())if(wild)r.visible=false;
  try{document.body.classList.toggle('wildmode',wild);}catch(e){} }
 function enforceWild(){ const R=player.rider; if(R&&R.g&&R.g.visible)R.g.visible=false; const TK=TACK(); if(TK.saddle&&TK.saddle.visible)TK.saddle.visible=false; if(TK.bridle&&TK.bridle.visible)TK.bridle.visible=false; for(const r of findReins())if(r.visible)r.visible=false; }
 function toggleWild(){
  if(G.renderer.xr.isPresenting){toast('🐎 Wild Mode is for the flat game.');return false;}
  if(G.course.get()){toast('🏁 Finish the course first!');return false;}
  const s=fresh(), h=s&&s.horses[rideIdx()];
  if(!wild&&!canWild(s,h)){ toast('🐎 Wild Mode needs '+(h&&isFantasy(h.breed)?breedLabel(h.breed)+' mastery 5':'an Epic breed at mastery 9')+'.'); return false; }
  wild=!wild; sync(x=>{x.wildMode=wild;}); applyWild();
  if(wild){G.quest.dailyEvt('wild',1);toast('🐎 Wild Mode — you are the horse. '+keyLabel(G.key('wild'))+' to saddle up.');}
  else toast('🏇 Saddled up.');
  return true;
 }
 const keyLabel=c=>String(c||'').replace(/^Key|^Digit/,'');
 G.on('key',e=>{ if(e.code===G.key('wild')&&!e.repeat){toggleWild();return true;} });
 G.on('courseStart',()=>{ if(wild){wild=false;sync(x=>{x.wildMode=false;});applyWild();toast('🏇 Saddled up for the course.');} });
 G.on('boot',s=>{ sync(x=>{for(const h of x.horses)masteryOf(x,h.breed);});   // the ladder on disk, for the boards and the state dump
  s=fresh(); wild=!!(s&&s.wildMode); if(wild){const h=s.horses[rideIdx()]; if(!canWild(s,h)){wild=false;sync(x=>{x.wildMode=false;});}} applyWild(); refreshPerks(s); applyPlayerLook(); });
 G.on('remote',(m,r)=>{
  if(!r)return; const key=JSON.stringify([m.hs,m.fx,m.ac,m.bb,m.wm]); if(r._styleKey===key)return; r._styleKey=key;
  if(r.rig&&r.rig.saddle)r.rig.saddle.visible=!m.bb&&!m.wm; if(r.rider&&r.rider.g)r.rider.g.visible=!m.wm; if(r.bridle)r.bridle.visible=!m.wm;
  if(r.rig&&r.rig.skin)try{applyLook(r.rig,r.parts.group,{id:m.id,breed:r.breed,hair:m.hs||null,fx:m.fx||null,acc:m.ac||null},true);}catch(e){}
 });
 G.on('netPos',(p,s,h)=>{ if(!h)return; if(h.hair&&(h.hair.mane!=='natural'||h.hair.tail!=='natural'))p.hs=h.hair; if(h.fx&&Object.keys(h.fx).length)p.fx=h.fx; if(h.acc&&Object.keys(h.acc).length)p.ac=h.acc; if(h.bareback)p.bb=1; if(wild)p.wm=1; });

 /* ===== 6. Actions ==================================================================== */
 function mirror(){ const fs=fresh(); const hh=fs&&fs.horses[rideIdx()], mh=G.horse.myHorses[rideIdx()]; if(hh&&mh){mh.hair=hh.hair;mh.acc=hh.acc;mh.fx=hh.fx;mh.colors=hh.colors;mh.tailCol=hh.tailCol;mh.bareback=hh.bareback;mh.hairCol=hh.hairCol;} }
 function refreshLook(){ mirror(); try{G.horse.applyCoat();}catch(e){} try{G.horse.hairColour();}catch(e){} applyPlayerLook(true); }
 function setHair(part,styleId){
  let msg=null; sync(s=>{ const h=s.horses[rideIdx()]; if(!h)return; const d=styleDef(part,styleId); const M=masteryOf(s,h.breed); const need=d.t===2?NEED.styleT2(h.breed):d.t===1?NEED.styleT1(h.breed):0;
   if(M<need){msg='🔒 '+d.lbl+' needs '+breedLabel(h.breed)+' mastery '+need+'.';return;} h.hair=h.hair||{mane:'natural',tail:'natural'}; h.hair[part]=d.id; msg='💇 '+h.name+' wears a '+d.lbl.toLowerCase()+' '+part+'.'; });
  const ok=!!msg&&!msg.startsWith('🔒'); if(ok){refreshLook();G.sChime();G.quest.dailyEvt('style',1);} if(msg)toast(msg); return ok;
 }
 function setDye(part,hex){
  let ok=false,msg=''; sync(s=>{ const h=s.horses[rideIdx()]; if(!h)return; if(h.breed==='bay-sporthorse'){msg='This horse keeps its natural bay hair.';return;} const M=masteryOf(s,h.breed);
   const bold=DYE_BOLD.some(c=>c[0]===hex), nat=DYE_NATURAL.some(c=>c[0]===hex)||hex==='none';
   if(!bold&&!nat){msg='Not a mastery dye.';return;}
   const need=bold?NEED.dye2(h.breed):NEED.dye1(h.breed); if(M<need){msg='🔒 '+(bold?'Bold':'Natural')+' dyes need '+breedLabel(h.breed)+' mastery '+need+'.';return;}
   h.colors=h.colors||{}; if(part==='mane')h.colors.mane=hex==='none'?(breedRow(h.breed)||[])[6]||h.colors.mane:hex; else h.tailCol=hex==='none'?null:hex; ok=true; msg='🎨 '+h.name+' looks lovely.'; });
  if(ok){refreshLook();G.sChime();} if(msg)toast(msg); return ok;
 }
 function setRibbon(hex){ sync(s=>{const h=s.horses[rideIdx()];if(h){h.hairCol=h.hairCol||{};h.hairCol.ribbon=hex;}}); refreshLook(); }
 function accAvailable(s,h,def){ if(def.season&&G.time.seasonNow().def.id!==def.season)return {ok:false,why:'back in '+(T.SEASONS.find(x=>x.id===def.season)||{}).name}; if(def.west&&h.saddleStyle!=='western')return {ok:false,why:'needs a western saddle'}; if(def.dragon&&!h.dragon)return {ok:false,why:'dragons only'}; return {ok:true}; }
 function buyAcc(id){
  const def=accDef(id); if(!def)return false; let ok=false,msg='';
  sync(s=>{ const h=s.horses[rideIdx()]; if(!h){msg='No horse to dress.';return;} if(s.accInv[id]){msg='Already owned.';return;} const av=accAvailable(s,h,def); if(!av.ok){msg='🔒 '+def.lbl+' — '+av.why+'.';return;}
   if(def.c){if((s.coins||0)<def.c){msg='Not enough coins!';return;}s.coins-=def.c;} if(def.g){if((s.gems||0)<def.g){msg='Not enough gems!';return;}s.gems-=def.g;} if(def.dust){if((s.dust||0)<def.dust){msg='Not enough ✨ dust — the market doors drop it.';return;}s.dust-=def.dust;}
   s.accInv[id]=true; h.acc=h.acc||{}; h.acc[def.slot]=id; ok=true; msg='🎀 '+h.name+' wears the '+def.lbl+'!'; });
  if(ok){G.money.refreshWallet();refreshLook();G.sCoin();G.quest.dailyEvt('style',1);} toast(msg); return ok;
 }
 function wearAcc(slot,id){ let ok=false; sync(s=>{ const h=s.horses[rideIdx()]; if(!h)return; h.acc=h.acc||{}; if(!id||id==='off'){delete h.acc[slot];ok=true;return;} const def=accDef(id); if(!def||def.slot!==slot||!s.accInv[id])return; h.acc[slot]=id; ok=true; }); if(ok){refreshLook();G.sChime();} return ok; }
 function setFx(kind,id){
  let msg=''; let ok=false; sync(s=>{ const h=s.horses[rideIdx()]; if(!h)return; h.fx=h.fx||{};
   if(!id||id==='off'){delete h.fx[kind];ok=true;return;} const def=fantasyAcc(h.breed).find(d=>d.id===id&&d.fx===kind); if(!def){msg='Not this horse\'s accessory.';return;}
   const M=masteryOf(s,h.breed); if(M<def.m){msg='🔒 '+def.lbl+' needs '+breedLabel(h.breed)+' mastery '+def.m+'.';return;}
   if(kind==='hair'){delete h.fx.mane;delete h.fx.tail;} if(kind==='mane'||kind==='tail')delete h.fx.hair;
   h.fx[kind]=id; ok=true; msg='✨ '+def.lbl+' on.'; });
  if(ok){refreshLook();G.sGem();} if(msg)toast(msg); return ok;
 }
 G.on('careAct',(k)=>{
  if(k==='wild:toggle'){toggleWild();G.ui.renderCare();return true;}
  if(k==='style:open'){G.ui.open('stylePanel');return true;}
  if(k.startsWith('hair:')){const [,p,id]=k.split(':');setHair(p,id);G.ui.renderCare();return true;}
  if(k.startsWith('fx:')){const [,kind,id]=k.split(':');setFx(kind,id);G.ui.renderCare();return true;}
  return false;
 });

 /* ===== 7. UI: Care block, Style panel, Mastery tab, stable chips ====================== */
 const btn=(fx,label,o)=>'<button data-fx="'+fx+'"'+((o&&o.on)?' class="claimBtn"':'')+((o&&o.dis)?' disabled':'')+(o&&o.title?' title="'+esc(o.title)+'"':'')+(o&&o.style?' style="'+o.style+'"':'')+'>'+label+'</button>';
 const dot=c=>'<span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:'+c+';vertical-align:middle;border:1px solid rgba(0,0,0,.2)"></span>';
 const chip=(txt,ok)=>'<span style="display:inline-block;font-size:11px;padding:2px 7px;border-radius:999px;margin:2px 3px 0 0;background:'+(ok?'#e6f4d8':'#f0ebe1')+';color:'+(ok?'#2f5d1e':'#8c7a63')+'">'+txt+'</span>';
 function perkChips(s,h){ const M=masteryOf(s,h.breed); return perkRows(h.breed).map(r=>chip((M>=r.rung?'✅ ':'🔒 L'+r.rung+' ')+r.def.label,M>=r.rung)).join(''); }
 G.on('careMastery',(s,h)=>{
  const M=masteryOf(s,h.breed), mx=maxOf(h.breed), L=ladderOf(h.breed); const nextR=Object.keys(L).map(Number).find(k=>k>M);
  let x='<div style="font-size:12px;margin-top:6px">🎖️ <b>'+esc(breedLabel(h.breed))+' mastery '+M+'/'+mx+'</b>'+(nextR?' · next at '+nextR+': '+L[nextR].label:' · complete')+' <span style="color:#8c7a63">('+(isFantasy(h.breed)?'own more of this exact horse':'own more '+esc(breedLabel(h.breed))+'s')+' to raise it)</span></div>';
  x+='<div style="margin-top:3px">'+perkChips(s,h)+'</div>';
  x+='<div class="crow" style="gap:4px;flex-wrap:wrap;margin-top:4px"><span class="lbl" style="font-size:11px">Looks</span><button data-care="style:open">🎀 Style — mane, tail, dyes & accessories</button></div>';
  if(M>=NEED.studs(h.breed))x+='<div class="crow" style="gap:4px;flex-wrap:wrap"><span class="lbl" style="font-size:11px">Studs</span>'+T.STUD_COLS.map(c=>'<button data-care="stud:'+c[0]+'" title="'+c[1]+'"'+(h.studCol===c[0]?' class="claimBtn"':'')+'>'+dot(c[0])+' '+c[1]+'</button>').join('')+'</div>';
  if(M>=NEED.trail(h.breed))x+='<div class="crow" style="gap:4px"><span class="lbl" style="font-size:11px">Trail</span><button data-care="trail:'+(h.trail?'off':'on')+'">'+(h.trail?'✨ Sparkle trail on':'Sparkle trail off')+'</button></div>';
  if(M>=NEED.bare(h.breed))x+='<div class="crow" style="gap:4px"><span class="lbl" style="font-size:11px">Saddle</span><button data-care="bare:'+(h.bareback?'off':'on')+'">'+(h.bareback?'🐎 Bareback':'Saddled')+'</button></div>';
  if(canWild(s,h))x+='<div class="crow" style="gap:4px"><span class="lbl" style="font-size:11px">Wild Mode</span><button data-care="wild:toggle"'+(wild?' class="claimBtn"':'')+'>'+(wild?'🐎 You are the horse · saddle up':'🐎 Ride as '+esc(h.name)+' ('+keyLabel(G.key('wild'))+')')+'</button></div>';
  return x;
 });
 let styleTab='hair';
 function renderStyle(p,s){
  const h=s&&s.horses[rideIdx()]; if(!h)return '<div class="ph">🎀 Style</div><span>No horse to dress.</span>';
  const M=masteryOf(s,h.breed), fan=isFantasy(h.breed), hair=h.hair||{mane:'natural',tail:'natural'}, acc=h.acc||{}, fx=h.fx||{};
  const tabs=[['hair','💇 Hair'],['dye','🎨 Dyes'],['acc','🎀 Accessories'],['fx','✨ Fantasy']];
  let x='<div class="ph">🎀 Style · '+esc(h.name)+' <span class="chip" style="font-size:12px;padding:3px 10px">🎖️ '+esc(breedLabel(h.breed))+' '+M+'/'+maxOf(h.breed)+'</span><button data-fx="close:stylePanel" style="margin-left:auto">✖</button></div>';
  x+='<div class="crow" style="gap:6px;flex-wrap:wrap">'+tabs.map(t=>'<button class="tabbtn '+(styleTab===t[0]?'on':'')+'" data-fx="style:tab:'+t[0]+'">'+t[1]+'</button>').join('')+'</div>';
  if(styleTab==='hair'){
   const t1=NEED.styleT1(h.breed), t2=NEED.styleT2(h.breed);
   x+='<div style="font-size:12px;color:#8c7a63">Mane and tail styles come with mastery: tier I at '+t1+', tier II at '+t2+'. Mix any mane with any tail and any dye.</div>';
   for(const [part,list] of [['mane',MANE],['tail',TAIL]]){
    x+='<div class="crow" style="gap:4px;flex-wrap:wrap"><span class="lbl" style="font-size:11px">'+(part==='mane'?'💇 Mane':'🎀 Tail')+'</span>'+list.map(d=>{const need=d.t===2?t2:d.t===1?t1:0;const lock=M<need;return btn('style:'+part+':'+d.id,(lock?'🔒 ':'')+d.lbl,{on:hair[part]===d.id,dis:lock,title:lock?'Tier '+d.t+' — '+breedLabel(h.breed)+' mastery '+need:d.lbl});}).join('')+'</div>';
   }
   x+='<div class="crow" style="gap:4px;flex-wrap:wrap"><span class="lbl" style="font-size:11px">Ribbon</span>'+RIBBON_COLS.map(c=>btn('style:ribbon:'+c[0],dot(c[0]),{on:(h.hairCol&&h.hairCol.ribbon)===c[0],title:c[1]})).join('')+'<span style="font-size:11px;color:#8c7a63">for plaits and bows</span></div>';
  }else if(styleTab==='dye'){
   const n1=NEED.dye1(h.breed), n2=NEED.dye2(h.breed);
   x+='<div style="font-size:12px;color:#8c7a63">Mastery dyes are free. Natural shades at '+n1+', bold shades at '+n2+'. The paid palette stays in the 🛍️ Shop.</div>';
   for(const [part,cur] of [['mane',h.colors&&h.colors.mane],['tail',h.tailCol]]){
    x+='<div class="crow" style="gap:4px;flex-wrap:wrap"><span class="lbl" style="font-size:11px">'+(part==='mane'?'💇 Mane':'🎀 Tail')+' · natural</span>'+DYE_NATURAL.map(c=>btn('style:dye:'+part+':'+c[0],dot(c[0]),{on:cur===c[0],dis:M<n1,title:c[1]+(M<n1?' — mastery '+n1:'')})).join('')+btn('style:dye:'+part+':none','natural',{dis:M<n1})+'</div>';
    x+='<div class="crow" style="gap:4px;flex-wrap:wrap"><span class="lbl" style="font-size:11px">'+(part==='mane'?'💇 Mane':'🎀 Tail')+' · bold</span>'+DYE_BOLD.map(c=>btn('style:dye:'+part+':'+c[0],dot(c[0]),{on:cur===c[0],dis:M<n2,title:c[1]+(M<n2?' — mastery '+n2:'')})).join('')+'</div>';
   }
  }else if(styleTab==='acc'){
   const season=G.time.seasonNow().def;
   x+='<div style="font-size:12px;color:#8c7a63">Wallet: '+(s.coins||0)+'🪙 · '+(s.gems||0)+'💎 · '+(s.dust||0)+'✨ dust. Seasonal pieces are in the Seasonal Store only during their season ('+season.emoji+' '+season.name+' now); once bought they are yours for good.</div>';
   for(const [slot,lbl] of ACC_SLOTS){
    const worn=acc[slot]; const rows=ACC.filter(a=>a.slot===slot);
    x+='<div class="crow" style="gap:4px;flex-wrap:wrap"><span class="lbl" style="font-size:11px">'+lbl+'</span>'+btn('style:off:'+slot,'none',{on:!worn})+rows.map(a=>{ const own=!!s.accInv[a.id]; const av=accAvailable(s,h,a);
     if(own)return btn('style:wear:'+slot+':'+a.id,dot(a.col)+' '+a.lbl,{on:worn===a.id,title:a.desc});
     const price=a.c?a.c+'🪙':a.g?a.g+'💎':a.dust+'✨'; return btn('style:buy:'+a.id,dot(a.col)+' '+a.lbl+' · '+price,{dis:!av.ok,title:a.desc+(av.ok?'':' — '+av.why)}); }).join('')+'</div>';
   }
   x+='<div style="font-size:11px;color:#8c7a63">Western pieces need a western saddle (🛍️ Tack). Dragon pieces fit dragons. Everything here is cosmetic.</div>';
  }else{
   if(!fan)x+='<div style="font-size:12px;color:#8c7a63">Exclusive effect accessories belong to fantasy horses — a Glacier Percheron\'s icicle mane, a Shadow Mare\'s phantom mask, a unicorn\'s rainbow horn. They come with that horse\'s own five-rung mastery.</div>';
   else{
    x+='<div style="font-size:12px;color:#8c7a63">'+esc(breedLabel(h.breed))+' climbs five rungs, counting only duplicates of this exact horse. Rung 2 and 4 pay an exclusive accessory; rung 5 opens Wild Mode.</div>';
    for(const d of fantasyAcc(h.breed)){ const on=fx[d.fx]===d.id, lock=M<d.m;
     x+='<div class="evrow"><b>'+esc(d.lbl)+'</b><span>'+(d.fx==='hair'?'mane & tail':d.fx)+' · '+(lock?'unlocks at mastery '+d.m:'mastery '+d.m)+'</span>'+btn('style:fx:'+d.fx+':'+(on?'off':d.id),lock?'🔒':on?'✨ On':'Wear',{on,dis:lock})+'</div>'; }
    x+='<div class="evrow"><b>🐎 Wild Mode</b><span>ride as the horse, no rider · mastery 5</span>'+btn('style:wild',M>=5?(wild?'Saddle up':'Go wild'):'🔒',{dis:M<5,on:wild})+'</div>';
   }
  }
  return x;
 }
 G.ui.panel({id:'stylePanel',title:'🎀 Style',dock:{label:'🎀 Style',after:'stableBtn',title:'Mane, tail, dyes & accessories'},render:renderStyle,
  vr:{tab:'style',label:'Style',build(rows,sv){const h=sv&&sv.horses[rideIdx()];if(!h)return 'No horse';const hair=h.hair||{};rows.push?.(['Mane: '+(styleDef('mane',hair.mane).lbl),'Tail: '+(styleDef('tail',hair.tail).lbl)]);return 'Style is set from the flat game.';}}});
 G.ui.action('style',(a)=>{
  const op=a[0];
  if(op==='tab'){styleTab=a[1];G.ui.rerender('stylePanel');return;}
  if(op==='open'){G.ui.open('stylePanel');return;}
  if(op==='mane'||op==='tail')setHair(op,a[1]);
  else if(op==='ribbon')setRibbon(a[1]);
  else if(op==='dye')setDye(a[1],a[2]);
  else if(op==='buy')buyAcc(a[1]);
  else if(op==='wear')wearAcc(a[1],a[2]);
  else if(op==='off')wearAcc(a[1],null);
  else if(op==='fx')setFx(a[1],a[2]);
  else if(op==='wild')toggleWild();
  G.ui.rerender('stylePanel');
 });
 /* the mastery tab of 📜 Quests: every breed, its rungs, what is next */
 G.ui.questTab({id:'mastery',label:'🎖️ Mastery',render(s){
  const rows=T.BREEDS3.filter(b=>!(b[7]&&b[7].story)||s.horses.some(h=>h.breed===b[0])).map(b=>{const M=masteryOf(s,b[0]);return {b,M,mx:maxOf(b[0]),own:s.horses.filter(h=>h.breed===b[0]).length};});
  rows.sort((p,q)=>(q.M-p.M)||(q.own-p.own)||p.b[1].localeCompare(q.b[1]));
  const done=rows.filter(r=>r.M>=r.mx).length;
  let x='<span style="font-size:12px;color:#8c7a63">One rung per horse of a breed you have ever owned. Real breeds climb ten rungs (a named coat variant counts toward its base breed); fantasy horses climb five and count only themselves. '+done+' of '+rows.length+' mastered.</span>';
  for(const r of rows){ const L=ladderOf(r.b[0]); const nextR=Object.keys(L).map(Number).find(k=>k>r.M); const col=T.RAR_COL&&T.RAR_COL[r.b[2]]||'#8c7a63';
   x+='<div class="qrow'+(r.M>=r.mx?' claimed':r.M>0?' done':'')+'" data-mastery="'+r.b[0]+'"><span class="qico" style="background:'+r.b[5]+';border-radius:50%;width:26px;height:26px;display:inline-flex;align-items:center;justify-content:center">'+(r.b[7]&&r.b[7].horn?'🦄':r.b[7]&&r.b[7].wings?'🪽':r.b[7]&&r.b[7].coat?'✨':'🐴')+'</span><span class="qmain"><b>'+esc(r.b[1])+'</b> <span style="font-size:10px;color:'+col+';font-weight:700">'+r.b[2]+'</span><span class="qbar"><span class="qfill" style="width:'+Math.round(100*r.M/r.mx)+'%"></span></span><span style="font-size:11px;color:#8c7a63;font-weight:600">'+r.M+'/'+r.mx+' · '+r.own+' owned'+(nextR?' · next: '+L[nextR].label:' · mastered 👑')+'</span></span></div>'; }
  return x;
 }});
 G.ui.stableRow((h,i)=>{ const s=fresh(); if(!s)return ''; const M=masteryOf(s,h.breed); return M>0?'<span class="badge" title="'+esc(breedLabel(h.breed))+' mastery">🎖️'+M+'/'+maxOf(h.breed)+'</span>':''; });

 /* ===== 8. Quests, achievements, state, QA ============================================ */
 G.quest.addDaily({type:'style',icon:'🎀',label:'Change a mane, tail or accessory',goal:1,r:{c:60,p:10}});
 G.quest.addAch({id:'style3',icon:'🎀',label:'Dressed up',desc:'Own 3 horse accessories',v:s=>Object.keys(s.accInv||{}).length,goal:3,r:{c:200}});
 G.quest.addAch({id:'hair1',icon:'💇',label:'New do',desc:'Give a horse a mane or tail style',v:s=>s.horses.some(h=>h.hair&&(h.hair.mane!=='natural'||h.hair.tail!=='natural'))?1:0,goal:1,r:{c:100}});
 G.quest.addAch({id:'fx1',icon:'✨',label:'Enchanted',desc:'Wear a fantasy accessory',v:s=>s.horses.some(h=>h.fx&&Object.values(h.fx).some(Boolean))?1:0,goal:1,r:{g:2}});
 G.quest.addAch({id:'bare1',icon:'🐎',label:'Bareback',desc:'Ride a horse bareback',v:s=>s.horses.some(h=>h.bareback)?1:0,goal:1,r:{c:200}});
 G.quest.addAch({id:'wild1',icon:'🐎',label:'Born free',desc:'Ride as your horse in Wild Mode',v:s=>(s.life&&s.life.wild)||0,goal:1,r:{g:5}});
 G.quest.addAch({id:'mastery10',icon:'👑',label:'Breed master',desc:'Master a breed to the top of its ladder',v:s=>Object.keys(s.mastery||{}).filter(b=>(s.mastery[b]||0)>=maxOf(b)).length,goal:1,r:{g:10,k:1}});
 G.quest.addAch({id:'mastery5',icon:'🎖️',label:'Stable of stables',desc:'Reach mastery 5 with three breeds',v:s=>Object.keys(s.mastery||{}).filter(b=>(s.mastery[b]||0)>=5).length,goal:3,r:{c:600,g:3}});
 G.on('state',o=>{ const sv=fresh()||{}; const h=ridden()||{}; const rig=RIG(); const L=rig&&LOOKS.get(rig);
  o.mastery=Object.assign({},sv.mastery||{}); o.ridingMastery=h.breed?masteryOf(sv,h.breed):0; o.masteryMax=h.breed?maxOf(h.breed):10;
  o.perks=PK?PK.ids.slice():[]; o.hair=h.hair||null; o.acc=h.acc||null; o.fx=h.fx||null; o.bareback=!!h.bareback; o.wild=wild;
  o.style={hairMeshes:L&&L.hair?L.hair.meshes.length:0,decor:L?L.decor.length:0,acc:L?L.acc.reduce((n,a)=>n+a.handles.length,0):0}; });
 G.mastery={isFantasy,maxOf,ladderOf,perkRows,PERKS,BREED_PERKS,computePerks,refreshPerks,perks:()=>PK,canWild,toggleWild,isWild:()=>wild,setHair,setDye,setRibbon,buyAcc,wearAcc,setFx,applyPlayerLook,applyLook,LOOKS,ACC,FANTASY_ACC,fantasyAcc,MANE,TAIL,DYE_NATURAL,DYE_BOLD,NEED,HS,masteryBump,accAvailable,lastToast:()=>lastToast,renderStyle:()=>G.ui.rerender('stylePanel')};
}

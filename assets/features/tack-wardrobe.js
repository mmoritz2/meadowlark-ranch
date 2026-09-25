/* Feature package 'tack-wardrobe'. Owned by that package: edit only this file and the inline hot spots
   assigned to it (the tack data block, the Tack tab, riderSeat / driveRider / attachTack / riderMaterial).
   See index.js for the contract. Nothing runs at import time.

   What lives here: the rider creator (body, name, hairstyle, skin, starter clothes), the Outfit tab
   as a wardrobe (clothing unlocked with ✨ dust, live recolour without a rebuild, helmet off, boots,
   hairstyles as real meshes on the head bone), the Season Store (outfits and a Western tack set for
   🎟️ season tokens), the prestige set with a 👑 badge other riders see, Bo the Saddler with the two
   tack tutorial missions, the tack dailies and achievements, and the /pos fields that let club mates
   see all of it, plus the week's top Star Points milestone (a Legendary piece: the leaderboard
   exclusive). The tack economy itself (rarity patterns, names, 26 sets, upgrades, toolkits, merge
   and strip, market stall, English/Western saddles and headstalls) is inline in ranch3d.html
   because the boot pass pays tack rewards before any package installs. */
import {buildHair} from '../rider-hair.js';   // the old sculpt's hair, for the fallback rider only
import {RIDER_HAIR,RIDER_OUTFITS,RIDER_EYES,riderHairId} from '../rider-model.js?v=rider-1';
export const id='tack-wardrobe';
export function install(G){
 const {$,toast,THREE}=G;
 const DEF_SHIRT='#3d4a6e', DEF_PANTS='#cfc6ae';
 /* ---- wardrobe: every wearable colour, free or unlocked with dust ---------------------- */
 const WARDROBE=[
  {id:'shirt_tan',slot:'shirt',label:'Tan work shirt',col:'#c98c5a',cost:0},{id:'shirt_red',slot:'shirt',label:'Barn red shirt',col:'#b34a4a',cost:0},
  {id:'shirt_blue',slot:'shirt',label:'Creek blue shirt',col:'#4a7ab3',cost:0},{id:'shirt_green',slot:'shirt',label:'Meadow green shirt',col:'#5a9a5a',cost:0},
  {id:'shirt_plum',slot:'shirt',label:'Plum shirt',col:'#8a5ab3',cost:0},{id:'shirt_cream',slot:'shirt',label:'Cream show shirt',col:'#e8d9b8',cost:0},
  {id:'shirt_rose',slot:'shirt',label:'Rose show shirt',col:'#d9527a',cost:3},{id:'shirt_forest',slot:'shirt',label:'Forest hunt coat',col:'#2f5d3a',cost:3},
  {id:'shirt_sun',slot:'shirt',label:'Sunflower blouse',col:'#f2c14e',cost:4},{id:'shirt_night',slot:'shirt',label:'Midnight tailcoat',col:'#1b1f3a',cost:5},
  {id:'shirt_plaid',slot:'shirt',label:'Ranch-hand plaid',col:'#b5651d',cost:4},
  {id:'pants_brown',slot:'pants',label:'Brown breeches',col:'#4a4338',cost:0},{id:'pants_navy',slot:'pants',label:'Navy breeches',col:'#2e3a52',cost:0},
  {id:'pants_tan',slot:'pants',label:'Tan jeans',col:'#6b4a2e',cost:0},{id:'pants_char',slot:'pants',label:'Charcoal breeches',col:'#3a3a3a',cost:0},
  {id:'pants_white',slot:'pants',label:'White show breeches',col:'#f0ece0',cost:4},{id:'pants_chaps',slot:'pants',label:'Canyon chaps',col:'#5a3b22',cost:4},
  {id:'pants_sky',slot:'pants',label:'Sky breeches',col:'#7fa7d6',cost:5},
  {id:'helm_black',slot:'helmet',label:'Black velvet helmet',col:'#2e2e38',cost:0},{id:'helm_purple',slot:'helmet',label:'Plum helmet',col:'#7d3c98',cost:0},
  {id:'helm_rust',slot:'helmet',label:'Rust helmet',col:'#b3622f',cost:0},{id:'helm_white',slot:'helmet',label:'White helmet',col:'#e8e8e8',cost:0},
  {id:'helm_blue',slot:'helmet',label:'Lake blue helmet',col:'#2e86c1',cost:0},{id:'helm_none',slot:'helmet',label:'Bare head',col:'none',cost:0},
  {id:'helm_gold',slot:'helmet',label:'Gold helmet',col:'#d4af37',cost:6},{id:'helm_rose',slot:'helmet',label:'Rose helmet',col:'#e8a0c8',cost:3},
  {id:'skin_1',slot:'skin',label:'Fair',col:'#f0c8a8',cost:0},{id:'skin_2',slot:'skin',label:'Warm',col:'#e3a37d',cost:0},{id:'skin_3',slot:'skin',label:'Tan',col:'#c98a62',cost:0},
  {id:'skin_4',slot:'skin',label:'Brown',col:'#a06a48',cost:0},{id:'skin_5',slot:'skin',label:'Deep',col:'#6b4530',cost:0},
  {id:'hair_black',slot:'hair',label:'Black',col:'#1e140e',cost:0},{id:'hair_brown',slot:'hair',label:'Brown',col:'#4a2e1c',cost:0},{id:'hair_auburn',slot:'hair',label:'Auburn',col:'#8a4a25',cost:0},
  {id:'hair_blonde',slot:'hair',label:'Blonde',col:'#d9a85c',cost:0},{id:'hair_red',slot:'hair',label:'Red',col:'#b3402a',cost:0},{id:'hair_grey',slot:'hair',label:'Grey',col:'#c8c8d0',cost:0},
  {id:'hair_pink',slot:'hair',label:'Pink',col:'#e8a0c8',cost:0},{id:'hair_blue',slot:'hair',label:'Blue',col:'#6a8fd0',cost:0},
  {id:'hair_silver',slot:'hair',label:'Silver',col:'#dfe3ea',cost:5},{id:'hair_copper',slot:'hair',label:'Copper',col:'#c8642a',cost:3},{id:'hair_lilac',slot:'hair',label:'Lilac',col:'#b892d6',cost:4},
  {id:'boot_tan',slot:'boots',label:'Tan field boots',col:'#8a5a2b',cost:0},{id:'boot_black',slot:'boots',label:'Black dress boots',col:'#1a1a1a',cost:2},
  {id:'boot_red',slot:'boots',label:'Red cowgirl boots',col:'#a8322a',cost:4},{id:'boot_ox',slot:'boots',label:'Oxblood boots',col:'#5a1e1e',cost:3},{id:'boot_cream',slot:'boots',label:'Cream boots',col:'#e6dcc6',cost:3},
 ];
 const SLOT_LBL={shirt:'👕 Shirt',pants:'👖 Pants',helmet:'⛑️ Helmet',boots:'👢 Boots',hair:'💇 Hair colour',skin:'🖐️ Skin'};
 const SLOTS=['shirt','pants','helmet','boots','hair','skin'];
 /* the rider's hairstyles (assets/rider-model.js): the pack's own, plus the drawn-back styles and curls built
    there for her head */
 const HAIRSTYLES=RIDER_HAIR.map(h=>({id:h.id,label:h.label,body:h.body}));
 const OUTFITS=RIDER_OUTFITS, EYES=RIDER_EYES;
 const BODIES=[['f','👧 Cowgirl'],['m','👦 Cowboy']];
 const RIDER_NAMES=['Wren','Juniper','Sage','Rowan','Hazel','Finch','Marlow','Tess','Cody','Ellis','Piper','Lark','Reed','Quinn','Bryn','Ash','Fern','Milo','Nell','Otis',
  'Rosa','Sam','Tally','Indie','Jesse','Kit','Lou','Mack','Nico','Opal','Pip','Remy','Sky','Toby','Una','Vale','Wyatt','Ziggy','Clem','Dune'];
 /* ---- season store: themed outfits per season, priced in 🎟️ tokens ------------------- */
 const SEASON_OUTFITS={
  bloom:[{id:'bloom_shirt',slot:'shirt',label:'Blossom blouse',col:'#f2a0c8',cost:30},{id:'bloom_pants',slot:'pants',label:'Petal breeches',col:'#7a4f6a',cost:35},{id:'bloom_helmet',slot:'helmet',label:'Blossom helmet',col:'#ffd6e8',cost:45},{id:'bloom_boots',slot:'boots',label:'Orchard boots',col:'#c9d6a3',cost:25}],
  sun:[{id:'sun_shirt',slot:'shirt',label:'Ranch-hand shirt',col:'#b5651d',cost:30},{id:'sun_pants',slot:'pants',label:'Long-sun chaps',col:'#5a3b22',cost:35},{id:'sun_helmet',slot:'helmet',label:'Straw-hat helmet',col:'#c9a066',cost:45},{id:'sun_boots',slot:'boots',label:'Coyote boots',col:'#a8322a',cost:25},
       {id:'sun_ranger',kind:'tack',label:'Ranger Western tack set · 4 Epic pieces',col:'#6b4a2e',cost:120,set:'Ranger'}],
  ember:[{id:'ember_shirt',slot:'shirt',label:'Ember scale jacket',col:'#8f2b1f',cost:30},{id:'ember_pants',slot:'pants',label:'Ash breeches',col:'#3a1a1a',cost:35},{id:'ember_helmet',slot:'helmet',label:'Dragon-crest helmet',col:'#2b0f0f',cost:45},{id:'ember_boots',slot:'boots',label:'Cinder boots',col:'#e07a3c',cost:25}],
  frost:[{id:'frost_shirt',slot:'shirt',label:'Hollowpeak parka',col:'#9fd8f2',cost:30},{id:'frost_pants',slot:'pants',label:'Snowline breeches',col:'#e8eef4',cost:35},{id:'frost_helmet',slot:'helmet',label:'Frost helmet',col:'#5b8fb8',cost:45},{id:'frost_boots',slot:'boots',label:'Loon-lake boots',col:'#2f4a5e',cost:25}],
 };
 const SEASON_ITEMS=[].concat(...Object.values(SEASON_OUTFITS));
 const PRESTIGE_SET={helmet:'#d4af37',shirt:'#2b1d3a',pants:'#1a1a1a',boots:'#3b2a14',badge:'👑'};
 const ALL_ITEMS=WARDROBE.concat(SEASON_ITEMS.filter(i=>i.slot));
 const itemById=id=>ALL_ITEMS.find(i=>i.id===id)||SEASON_ITEMS.find(i=>i.id===id);
 /* ---- save shape -------------------------------------------------------------------------- */
 G.save.ensure(s=>{
  if(s.parts==null)s.parts=0;
  s.tw=s.tw||{};
  s.wardrobe=s.wardrobe||{owned:{},worn:{}}; s.wardrobe.owned=s.wardrobe.owned||{};
  const r=s.rider=s.rider||{shirt:DEF_SHIRT,pants:DEF_PANTS,helmet:null,skin:null,hair:null};
  if(r.body==null)r.body='f'; if(r.boots===undefined)r.boots=null; if(r.made==null)r.made=false;
  r.hairStyle=riderHairId(r.hairStyle,r.body);   // 'loose' and 'quiff' were the old sculpt's names
  if(!r.outfit)r.outfit='riding'; if(!r.eyes)r.eyes='brown';
 });
 const isVIP=s=>!!(s&&s.vip&&s.vip.until>Date.now());
 function prestigeOwned(s){return isVIP(s)||!!(s.achClaims&&(s.achClaims.saddler8||s.achClaims.legendset))||!!(s.wardrobe&&s.wardrobe.owned.prestige);}
 function allowed(s,it){return !it.cost||!!(s.wardrobe&&s.wardrobe.owned[it.id]);}
 function wearing(s,slot,val){const cur=s.rider[slot];return (cur==null&&val==null)||(String(cur||'').toLowerCase()===String(val||'').toLowerCase());}
 function fitOf(s){const r=s.rider||{},body=r.body||'f';return {shirt:r.shirt||DEF_SHIRT,pants:r.pants||DEF_PANTS,hair:r.hair||null,skin:r.skin||null,helmet:r.helmet||null,boots:r.boots||null,hairStyle:riderHairId(r.hairStyle,body),body,outfit:r.outfit||'riding',eyes:r.eyes||'brown'};}
 const lookKey=f=>[f.shirt,f.pants,f.hair,f.skin,f.helmet,f.boots,f.hairStyle,f.body,f.outfit,f.eyes].join('|');
 /* ---- the look, applied to a rider without rebuilding the herd ---------------------------- */
 function hairMeshes(R,fit){
  const head=R.sk&&R.sk.by&&R.sk.by.head; if(!head)return;
  if(R._twHair){head.remove(R._twHair);try{R._twHairKit&&R._twHairKit.dispose();}catch(e){}R._twHair=null;R._twHairKit=null;}
  /* real hairstyles on the head bone (assets/rider-hair.js): a cap and a fringe over a bare head,
     and whatever falls from it, long, curly, bobbed, tied up or braided */
  const OLD={long:'loose',buns:'bun',short:'quiff',beard:'crop'};   // the character's style names, in the old builder's words
  const kit=buildHair(THREE,OLD[fit.hairStyle]||fit.hairStyle||'loose',fit.hair||'#4a2e1c',{helmet:fit.helmet!=='none'});
  head.add(kit.group); R._twHair=kit.group; R._twHairKit=kit;
 }
 function bodyScale(R,fit){
  if(!R._twFitWrapped){const f=R._fit;R._fit=()=>{f();if(R._twBody==='m')R.fitG.scale.x*=1.08;};R._twFitWrapped=true;}
  const b=fit.body||'f'; if(R._twBody!==b){R._twBody=b;R._fit();}
 }
 function applyRiderLook(R,fit){
  if(!R)return false;
  /* the character dresses herself (assets/rider-model.js); another body is another rider, so say no and
     let the caller rebuild */
  if(R.setLook){if(R.rig&&R.rig.kit.body!==(fit.body==='m'?'m':'f'))return false;R.setLook(fit);R._twLook=lookKey(fit);return true;}
  const u=R.mesh&&R.mesh.material&&R.mesh.material.userData&&R.mesh.material.userData.u; if(!u)return false;
  const same=(a,b)=>String(a||'').toLowerCase()===b;
  u.uShirt.value.set(fit.shirt||DEF_SHIRT); u.uShirtW.value=fit.shirt&&!same(fit.shirt,DEF_SHIRT)?1:0;
  u.uPants.value.set(fit.pants||DEF_PANTS); u.uPantsW.value=fit.pants&&!same(fit.pants,DEF_PANTS)?1:0;
  u.uSkin.value.set(fit.skin||'#f0c8a8'); u.uSkinW.value=fit.skin?1:0;
  u.uHair.value.set(fit.hair||'#4a2e1c'); u.uHairW.value=fit.hair?1:0;
  const bare=fit.helmet==='none';
  u.uHelm.value.set(!bare&&fit.helmet?fit.helmet:'#2e2e38'); u.uHelmW.value=!bare&&fit.helmet&&!same(fit.helmet,'#2e2e38')?1:0;
  if(u.uBoot){u.uBoot.value.set(fit.boots||'#3b2a14');u.uBootW.value=fit.boots?1:0;u.uHelmHide.value=bare?1:0;}
  hairMeshes(R,fit); bodyScale(R,fit);
  R._twLook=lookKey(fit);
  return true;
 }
 let localFit=null, localLook='';
 function refreshLocal(s){s=s||G.save.fresh();if(!s)return;localFit=fitOf(s);localLook=lookKey(localFit);}
 function applyLocal(){refreshLocal();const R=G.horse.player.rider;if(!(R&&applyRiderLook(R,localFit)))G.horse.reloadHorses();}
 /* ---- Outfit tab: the wardrobe ------------------------------------------------------------ */
 const sw=(fx,col,on,title,lock)=>'<button data-fx="'+fx+'" title="'+title+'" '+(on?'class="claimBtn"':'')+' style="width:26px;height:26px;border-radius:50%;padding:0;background:'+(col==='none'?'#fff':col)+';font-size:11px;line-height:24px;color:#fff;text-shadow:0 0 3px #000">'+(lock?'🔒':col==='none'?'🚫':(on?'✓':''))+'</button>';
 function slotRow(s,slot,onlyFree){
  const items=ALL_ITEMS.filter(i=>i.slot===slot&&(onlyFree?!i.cost:(!i.cost||s.wardrobe.owned[i.id]||!SEASON_ITEMS.includes(i))));
  return '<div class="crow" style="flex-wrap:wrap"><span class="lbl">'+SLOT_LBL[slot]+'</span>'+items.map(i=>allowed(s,i)
   ?sw('wd:wear:'+slot+':'+i.col,i.col,wearing(s,slot,i.col),i.label)
   :sw('wd:unlock:'+i.id,i.col,false,i.label+' · '+i.cost+'✨ dust',true)).join('')+'</div>';
 }
 function hairRow(s){
  const body=s.rider.body||'f';
  const cur=riderHairId(s.rider.hairStyle,body);
  return '<div class="crow" style="flex-wrap:wrap"><span class="lbl">💇 Hairstyle</span>'+HAIRSTYLES.filter(h=>!h.body||h.body.includes(body)).map(h=>'<button data-fx="wd:hair:'+h.id+'" '+(cur===h.id?'class="claimBtn"':'')+' style="font-size:11px;padding:3px 8px">'+h.label+'</button>').join('')+'</div>';
 }
 function kitRow(s){
  const cur=s.rider.outfit||'riding', eye=s.rider.eyes||'brown';
  return '<div class="crow" style="flex-wrap:wrap"><span class="lbl">🧥 Outfit</span>'+OUTFITS.map(o=>'<button data-fx="wd:outfit:'+o.id+'" '+(cur===o.id?'class="claimBtn"':'')+' style="font-size:11px;padding:3px 8px">'+o.icon+' '+o.label+'</button>').join('')+'</div>'
   +'<div class="crow" style="flex-wrap:wrap"><span class="lbl">👁️ Eyes</span>'+EYES.map(e=>sw('wd:eyes:'+e.id,e.col,eye===e.id,e.label)).join('')+'</div>';
 }
 G.ui.shopTab({id:'outfit',label:'🧢 Outfit',render(s,h){
  const owned=Object.keys(s.wardrobe.owned).length, tok=(s.tokens&&s.tokens.n)||0, pres=prestigeOwned(s);
  let html='<div class="crow" style="flex-wrap:wrap;gap:6px"><span style="font-size:12px;color:#8c7a63">✨ <b>'+(s.dust||0)+'</b> dust · 🎟️ <b>'+tok+'</b> season tokens · '+owned+' unlocked</span><button data-fx="wd:creator" style="font-size:11px">🧑 Rider</button><button data-fx="wd:store" style="font-size:11px">🛍️ Season Store</button></div>'
   +'<span style="font-size:12px;color:#8c7a63">Dress your rider — picks apply instantly and your club mates see them. 🔒 pieces unlock with ✨ dust from loot doors.</span>'
   +kitRow(s)+hairRow(s)+SLOTS.map(sl=>slotRow(s,sl,false)).join('');
  const wornSet=['helmet','shirt','pants','boots'].every(k=>wearing(s,k,PRESTIGE_SET[k]));
  html+='<div class="evrow">👑 <b>Prestige set</b><span style="font-size:11px">'+(pres?'Gold helmet, midnight jacket, black breeches, saddle-brown boots — and a 👑 badge over your name.':'Reach it by raising a piece of tack to Lv 8, wearing a full Legendary set, or holding a Trail Pass membership.')+'</span>'
   +(pres?'<button data-fx="wd:set:prestige" '+(wornSet?'class="claimBtn"':'')+'>'+(wornSet?'Wearing ✓':'Wear the set')+'</button>':'<span style="font-size:11px;color:#b8a888">🔒</span>')+'</div>';
  return html;
 }});
 /* ---- rider creator ------------------------------------------------------------------------ */
 G.ui.panel({id:'riderPanel',title:'🧑 Your Rider',render(p,s){
  const r=s.rider, body=r.body||'f';
  return '<div class="ph"><b style="font-size:16px">🧑 Your rider</b><span style="font-size:11px;color:#8c7a63">'+(r.made?'change anything, any time':'welcome to Kestrel Basin — who is riding?')+'</span></div>'
   +'<div class="crow"><span class="lbl">Name</span><input data-fxin="wd:name" maxlength="14" value="'+String(s.playerName||'').replace(/"/g,'')+'" placeholder="Rider" style="flex:1;min-width:0"><button data-fx="wd:dice" title="Random name">🎲</button></div>'
   +'<div class="crow"><span class="lbl">Body</span>'+BODIES.map(b=>'<button data-fx="wd:body:'+b[0]+'" '+(body===b[0]?'class="claimBtn"':'')+'>'+b[1]+'</button>').join('')+'</div>'
   +hairRow(s)+['hair','skin','shirt','pants','boots','helmet'].map(sl=>slotRow(s,sl,true)).join('')
   +'<span style="font-size:11px;color:#8c7a63">More clothes and colours unlock later with ✨ dust — 🛍️ Shop → 🧢 Outfit.</span>'
   +'<button data-fx="wd:done" class="claimBtn">'+(r.made?'Done':'Saddle up! 🐴')+'</button>';
 }});
 /* Done (the old panel) and SAVE (the Character screen) finish the same way: a name if there is
 none, the rider marked made, and on the first time Grandma's old saddle on the horse. */
 function finishCreator(v){let first=false;
  G.save.sync(s=>{s.playerName=v||s.playerName||RIDER_NAMES[Math.floor(Math.random()*RIDER_NAMES.length)];if(!s.rider.made)first=true;s.rider.made=true;
   if(!s.tw.starter){s.tw.starter=1;s.tack=s.tack||[];const g=G.horse.genGear('Common','saddle',{style:'english'});g.name='Grandma\'s Old Saddle';s.tack.push(g);const h=s.horses[G.horse.rideIdx()];if(h){h.gear=h.gear||{};if(!h.gear.saddle)h.gear.saddle=g.id;}}});
  G.horse.refreshTack();G.horse.attachTack();G.horse.dressSaddle();applyLocal();G.hidePanels();G.sChime();
  toast(first?'🐴 Welcome, '+(G.net.myName())+'! Grandma\'s old saddle is on your horse — the Tack tab will show you more.':'Saved. 🧢');
 }
 /* ---- the Character screen ---------------------------------------------------------------
    The riding game this one is modelled on dresses its rider on one full screen: the rider
    standing in the middle on a deep blue backdrop, a few round tools beside her (zoom, a dice,
    the body switch, turn), and down the right a grid of choices under a strip of category
    icons, appearance and outfit, with SAVE at the foot. Ours was a column of colour dots in a
    cream card. This is that screen, drawn our own way: the rider in the middle is a real one
    (the same builder as the rider in the saddle, stood up by the on-foot package's pose), in
    her own little scene with its own renderer, turning under your finger, and every pick shows
    on her at once. Nothing is kept until SAVE; close it and she is as she was.
    The old creator panel is still there under it (G.ui.open('riderPanel')). */
 const CH={open:false,draft:null,tab:'style',renderer:null,scene:null,cam:null,stage:null,R:null,spin:0.45,zoom:false,raf:0,drag:null,thumbs:{},thumbKey:'',t0:0};
 const SVGI=p=>'<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">'+p+'</svg>';
 const ICO={
  style:'<path d="M7 20c-1.6-2.2-2.2-5-1.6-8C6.3 7 9 4.5 12.4 4.6c3.6.1 6.2 2.9 6.4 6.6.2 3.4-.8 6.4-2.4 8.8"/><path d="M8.2 11.5c1.8-.4 4.4-2.1 5.6-4.2.9 1.9 2.6 3.2 4.6 3.6"/><path d="M9.5 15.5c.8.7 1.6 1 2.5 1s1.7-.3 2.5-1"/>',
  hair:'<path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.4 0 2-1 1.6-2.1-.5-1.3.4-2.4 1.8-2.4H18a2.5 2.5 0 0 0 2.5-2.6C20.4 8 16.6 3.5 12 3.5z"/><circle cx="7.6" cy="11.4" r="1.2"/><circle cx="10.4" cy="7.6" r="1.2"/><circle cx="14.8" cy="7.9" r="1.2"/>',
  skin:'<path d="M8 20v-5.5L5.6 11.8a1.5 1.5 0 0 1 2.3-1.9L9 11.2V5.5a1.4 1.4 0 0 1 2.8 0V10V4.4a1.4 1.4 0 0 1 2.8 0V10V5.6a1.4 1.4 0 0 1 2.8 0v8.2c0 3-1.6 5-4 6.2"/>',
  helmet:'<path d="M4 15.5c0-5 3.6-9 8.3-9 4.4 0 7.7 3.4 7.7 8v1H4z"/><path d="M13 6.6v8.9M4 15.5h-.8M20 15.5c.6 0 1.3.4 1.3 1.1"/>',
  shirt:'<path d="M9 4l3 2.5L15 4l4.5 2-1.6 4.4-2.4-.9V20h-7V9.5l-2.4.9L4.5 6z"/><path d="M12 6.5v6"/>',
  pants:'<path d="M7 4h10l1 16h-4l-2-9.5L10 20H6z"/><path d="M7 7h10"/>',
  boots:'<path d="M8 3.5h5.5v9.5l5.4 2.6c1 .5 1.6 1.4 1.6 2.5V20H7.6c-.9 0-1.4-.6-1.3-1.5l.7-5.8z"/><path d="M7.4 16.5h13"/>',
  zoom:'<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5M10.5 8v5M8 10.5h5"/>',
  dice:'<rect x="4" y="4" width="16" height="16" rx="3.2"/><circle cx="8.6" cy="8.6" r="1.1" fill="currentColor"/><circle cx="15.4" cy="15.4" r="1.1" fill="currentColor"/><circle cx="12" cy="12" r="1.1" fill="currentColor"/><circle cx="15.4" cy="8.6" r="1.1" fill="currentColor"/><circle cx="8.6" cy="15.4" r="1.1" fill="currentColor"/>',
  body:'<circle cx="9" cy="9.5" r="4"/><path d="M9 13.5V21M6.2 18h5.6"/><circle cx="16.2" cy="12.6" r="3.6"/><path d="M18.8 10l2.6-2.6M18.2 7.4h3.2v3.2"/>',
  turn:'<path d="M19.4 12A7.4 7.4 0 1 1 17 6.6"/><path d="M17.8 3.6l-.6 3.4 3.4.4"/>',
  bare:'<circle cx="12" cy="10" r="5.4"/><path d="M6 21c.8-3.4 3.3-5.3 6-5.3s5.2 1.9 6 5.3"/><path d="M4 4l16 16"/>',
  eyes:'<path d="M2.8 12c2.3-3.9 5.5-5.9 9.2-5.9s6.9 2 9.2 5.9c-2.3 3.9-5.5 5.9-9.2 5.9S5.1 15.9 2.8 12z"/><circle cx="12" cy="12" r="3.1"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
  outfit:'<path d="M8.5 3.8h7l1.2 3.4 3.3 1.3-1.7 5.2-2.3-.6V20H8V13.1l-2.3.6L4 8.5l3.3-1.3z"/><path d="M8.5 3.8c.7 1.7 1.9 2.6 3.5 2.6s2.8-.9 3.5-2.6M12 6.4V20M9.3 11h1.5M9.3 14h1.5"/>'
 };
 const CATS=[['style','Hair style','appearance'],['hair','Hair colour','appearance'],['eyes','Eyes','appearance'],['skin','Skin colour','appearance'],
  ['outfit','Outfit','outfit'],['helmet','Helmet','outfit'],['shirt','Jacket','outfit'],['pants','Breeches','outfit'],['boots','Boots','outfit']];
 if(!$('seCharCss')){
  const st=document.createElement('style'); st.id='seCharCss';
  st.textContent=`
#seChar{position:fixed;inset:0;z-index:45;display:none;font-family:Nunito,system-ui,sans-serif;color:#fff;background:#141a4a}
#seChar.on{display:block}
#seChar button{font-family:inherit;cursor:pointer;border:0;box-shadow:none}
#seChar .ch-top{position:absolute;left:0;right:0;top:0;height:clamp(50px,8.5vh,64px);display:flex;align-items:center;gap:12px;padding:0 14px;z-index:2;
 background:linear-gradient(180deg,rgba(30,24,38,.96),rgba(22,18,30,.92));box-shadow:0 3px 12px rgba(0,0,0,.35)}
#seChar .ch-circ{width:clamp(38px,6vh,46px);height:clamp(38px,6vh,46px);border-radius:50%;flex:none;display:flex;align-items:center;justify-content:center;
 background:radial-gradient(circle at 35% 30%,#3a5da3,#1c2d5a);border:3px solid #dfe6f5!important;color:#fff;font-size:22px;font-weight:900;line-height:1}
#seChar .ch-title{font-size:clamp(19px,3.4vh,27px);font-weight:900;white-space:nowrap;text-shadow:0 2px 0 rgba(0,0,0,.35)}
#seChar .ch-sp{flex:1}
#seChar .ch-pill{display:flex;align-items:center;gap:8px;height:clamp(30px,4.8vh,36px);padding:0 14px 0 8px;border-radius:18px;background:rgba(40,34,52,.95);
 border:2px solid rgba(255,255,255,.28);font-weight:900;font-size:clamp(14px,2.3vh,18px);min-width:clamp(70px,8vw,100px);justify-content:space-between}
#seChar .ch-stage{position:absolute;left:0;top:clamp(50px,8.5vh,64px);bottom:0;right:clamp(330px,36vw,500px)}
#seChar .ch-stage canvas{display:block;width:100%!important;height:100%!important;cursor:grab;touch-action:none}
#seChar .ch-tools{position:absolute;right:clamp(14px,4vw,64px);top:12%;display:flex;flex-direction:column;gap:14px}
#seChar .ch-tool{width:clamp(44px,6.6vh,54px);height:clamp(44px,6.6vh,54px);border-radius:50%;padding:11px;color:#fff;background:rgba(40,40,90,.55);border:2.5px solid rgba(255,255,255,.85)!important}
#seChar .ch-tool.on{background:rgba(245,214,61,.35)}
#seChar .ch-name{position:absolute;left:50%;transform:translateX(-50%);bottom:18px;display:flex;align-items:center;gap:8px;padding:6px 8px 6px 16px;border-radius:24px;background:rgba(20,18,40,.72)}
#seChar .ch-name span{font-weight:900;font-size:14px;color:#cfd3ff;text-transform:uppercase;letter-spacing:.4px}
#seChar .ch-name input{width:150px;font:inherit;font-weight:900;font-size:18px;color:#fff;background:transparent;border:0;border-bottom:2px solid rgba(255,255,255,.4);outline:none;padding:2px 4px}
#seChar .ch-name button{width:36px;height:36px;border-radius:50%;padding:7px;color:#fff;background:rgba(255,255,255,.14)}
#seChar .ch-panel{position:absolute;right:0;top:clamp(50px,8.5vh,64px);bottom:0;width:clamp(330px,36vw,500px);display:flex;background:linear-gradient(180deg,#3b3170,#2b2458);box-shadow:-4px 0 14px rgba(0,0,0,.35)}
#seChar .ch-main{flex:1;min-width:0;display:flex;flex-direction:column}
#seChar .ch-head{padding:12px 10px 8px;text-align:center;font-weight:900;font-size:clamp(15px,2.4vh,19px);letter-spacing:.8px;text-transform:uppercase;background:rgba(0,0,0,.18)}
#seChar .ch-grid{flex:1;overflow-y:auto;padding:12px;display:grid;grid-template-columns:repeat(3,1fr);gap:10px;align-content:start}
#seChar .ch-grid::-webkit-scrollbar{width:8px}#seChar .ch-grid::-webkit-scrollbar-thumb{background:rgba(255,255,255,.25);border-radius:8px}
#seChar .ch-card{position:relative;aspect-ratio:1/1.12;border-radius:10px;padding:6px 4px 4px;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:4px;
 background:linear-gradient(180deg,#d8c79d,#b69a63);color:#3a2a12;font-weight:900;font-size:12px;border:3px solid rgba(255,255,255,.0)!important;overflow:hidden}
#seChar .ch-card.sel{border-color:#fff!important;box-shadow:0 0 0 2px #f5d63d,0 0 14px rgba(245,214,61,.55)!important}
#seChar .ch-card .sw{flex:1;width:78%;border-radius:50%;margin:4px auto 0;aspect-ratio:1;max-height:62%;box-shadow:inset 0 -4px 0 rgba(0,0,0,.18),0 2px 4px rgba(0,0,0,.25)}
#seChar .ch-card img{position:absolute;inset:0;width:100%;height:78%;object-fit:cover;border-radius:7px 7px 0 0}
#seChar .ch-card .ic{flex:1;width:60%;color:#5a4526;display:flex;align-items:center}
#seChar .ch-card .lb{position:relative;z-index:1;width:100%;text-align:center;line-height:1.1;background:rgba(255,255,255,.55);border-radius:6px;padding:2px 2px}
#seChar .ch-card .lock{position:absolute;left:4px;right:4px;bottom:4px;z-index:2;background:#241f4d;color:#fff;border-radius:6px;padding:2px;font-size:12px}
#seChar .ch-foot{display:flex;gap:10px;padding:10px 12px 12px;background:rgba(0,0,0,.18)}
#seChar .ch-btn{flex:1;min-height:clamp(42px,6.6vh,52px);border-radius:10px;font-weight:900;font-size:clamp(15px,2.3vh,19px);letter-spacing:.4px;text-transform:uppercase}
#seChar .ch-undo{background:linear-gradient(180deg,#f1ead8,#d9ceb0);color:#3a2a12}
#seChar .ch-save{background:linear-gradient(180deg,#f3de80,#d9b43d);color:#2a2340}
#seChar .ch-strip{width:clamp(96px,9vw,112px);display:grid;grid-template-columns:1fr 1fr;align-content:start;background:#221c49}
#seChar .ch-cat{aspect-ratio:1;padding:22%;color:#f3e6c8;background:transparent;border-bottom:1px solid rgba(255,255,255,.06)!important}
#seChar .ch-cat.outfit{background:rgba(255,255,255,.05)}
#seChar .ch-cat.on{background:linear-gradient(180deg,#e6c27a,#b98c3e);color:#3a2a12}
#seChar .ch-sep{grid-column:1/-1;height:6px;background:rgba(0,0,0,.25)}
@media (max-width:760px){#seChar .ch-stage{right:0;bottom:52%}#seChar .ch-panel{top:48%;width:100%}#seChar .ch-pill{display:none}
 #seChar .ch-strip{width:86px}#seChar .ch-grid{grid-template-columns:repeat(3,1fr);gap:8px;padding:8px}#seChar .ch-name{bottom:8px}#seChar .ch-name input{width:110px;font-size:16px}
 #seChar .ch-tools{right:10px;top:10px;gap:8px}}`;
  document.head.appendChild(st);
 }
 const chRoot=document.createElement('div'); chRoot.id='seChar';
 chRoot.innerHTML='<div class="ch-top"><button class="ch-circ" data-ch="close" title="Back">↩</button><div class="ch-title">🧑 Character</div><div class="ch-sp"></div>'
  +'<div class="ch-pill" title="Dust"><b>✨</b><span id="chDust">0</span></div><div class="ch-pill" title="Coins"><b>🪙</b><span id="chCoins">0</span></div>'
  +'<button class="ch-circ" data-ch="close" title="Close">✕</button></div>'
  +'<div class="ch-stage" id="chStage">'
  +'<div class="ch-tools"><button class="ch-tool" data-ch="zoom" title="Zoom">'+SVGI(ICO.zoom)+'</button><button class="ch-tool" data-ch="dice" title="Surprise me">'+SVGI(ICO.dice)+'</button>'
  +'<button class="ch-tool" data-ch="body" title="Switch body">'+SVGI(ICO.body)+'</button><button class="ch-tool" data-ch="turn" title="Turn">'+SVGI(ICO.turn)+'</button></div>'
  +'<div class="ch-name"><span>Name</span><input id="chName" maxlength="14" placeholder="Rider"><button data-ch="rname" title="Random name">'+SVGI(ICO.dice)+'</button></div></div>'
  +'<div class="ch-panel"><div class="ch-main"><div class="ch-head" id="chHead"></div><div class="ch-grid" id="chGrid"></div>'
  +'<div class="ch-foot"><button class="ch-btn ch-undo" data-ch="undo">Undo</button><button class="ch-btn ch-save" data-ch="save" id="chSave">Save</button></div></div>'
  +'<div class="ch-strip" id="chStrip"></div></div>';
 document.body.appendChild(chRoot);
 /* the strip: appearance, then outfit */
 {let h='',grp='';for(const c of CATS){if(grp&&grp!==c[2])h+='<div class="ch-sep"></div>';grp=c[2];h+='<button class="ch-cat '+c[2]+'" data-ch="tab:'+c[0]+'" title="'+c[1]+'">'+SVGI(ICO[c[0]])+'</button>';}$('chStrip').innerHTML=h;}

 /* ---- her little stage --------------------------------------------------------------- */
 function gradientTex(){
  const cv=document.createElement('canvas');cv.width=8;cv.height=256;const c=cv.getContext('2d');
  const g=c.createLinearGradient(0,0,0,256);g.addColorStop(0,'#10154a');g.addColorStop(0.55,'#2a36a6');g.addColorStop(0.8,'#3643b8');g.addColorStop(1,'#1c2270');
  c.fillStyle=g;c.fillRect(0,0,8,256);const t=new THREE.CanvasTexture(cv);t.colorSpace=THREE.SRGBColorSpace;return t;
 }
 function buildStage(){
  /* a fresh canvas every time: closing gives its GL context back, and a lost context cannot be had again */
  const stage=$('chStage'), canvas=document.createElement('canvas'); canvas.id='chCanvas'; stage.insertBefore(canvas,stage.firstChild);
  canvas.addEventListener('pointerdown',e=>{CH.drag={x:e.clientX,s:CH.spin};try{canvas.setPointerCapture(e.pointerId);}catch(err){}});
  canvas.addEventListener('pointermove',e=>{if(CH.drag)CH.spin=CH.drag.s+(e.clientX-CH.drag.x)*0.012;});
  const up=()=>{CH.drag=null;}; canvas.addEventListener('pointerup',up); canvas.addEventListener('pointercancel',up);
  const r=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});
  r.setPixelRatio(Math.min(2,window.devicePixelRatio||1)); r.outputColorSpace=THREE.SRGBColorSpace;
  r.toneMapping=THREE.ACESFilmicToneMapping; r.toneMappingExposure=1.05; r.shadowMap.enabled=true;
  const sc=new THREE.Scene(); sc.background=gradientTex();
  sc.add(new THREE.HemisphereLight(0xe4ebff,0x4a3e7a,1.35));
  const key=new THREE.DirectionalLight(0xfff2e2,2.3);key.position.set(1.6,3.2,3.0);key.castShadow=true;key.shadow.mapSize.set(1024,1024);
  Object.assign(key.shadow.camera,{left:-1.2,right:1.2,top:2.2,bottom:-0.2,near:0.5,far:9});key.shadow.bias=-0.0006;key.shadow.normalBias=0.012;sc.add(key);   // no acne on her clothes
  const rim=new THREE.DirectionalLight(0xa9b8ff,1.3);rim.position.set(-2,2.6,-2.6);sc.add(rim);
  /* a pool of light on the floor, and her shadow in it */
  const fc=document.createElement('canvas');fc.width=fc.height=128;const f=fc.getContext('2d');const rg=f.createRadialGradient(64,64,4,64,64,64);
  rg.addColorStop(0,'rgba(120,140,255,0.55)');rg.addColorStop(0.7,'rgba(70,80,200,0.18)');rg.addColorStop(1,'rgba(40,50,160,0)');f.fillStyle=rg;f.fillRect(0,0,128,128);
  const floorTex=new THREE.CanvasTexture(fc);
  const floor=new THREE.Mesh(new THREE.CircleGeometry(1.25,48),new THREE.MeshBasicMaterial({map:floorTex,transparent:true,depthWrite:false}));floor.rotation.x=-Math.PI/2;sc.add(floor);
  const shadow=new THREE.Mesh(new THREE.CircleGeometry(1.2,48),new THREE.ShadowMaterial({opacity:0.35}));shadow.rotation.x=-Math.PI/2;shadow.position.y=0.002;shadow.receiveShadow=true;sc.add(shadow);
  const holder=new THREE.Group(); holder.scale.setScalar(0.91); sc.add(holder);
  const cam=new THREE.PerspectiveCamera(30,1,0.05,50);
  CH.renderer=r; CH.scene=sc; CH.cam=cam; CH.stage=stage; CH.holder=holder; CH.disp=[floorTex,floor.geometry,floor.material,shadow.geometry,shadow.material,sc.background];
  sizeStage();
 }
 function sizeStage(){
  if(!CH.renderer)return; const st=CH.stage, w=Math.max(10,st.clientWidth), h=Math.max(10,st.clientHeight);
  CH.renderer.setSize(w,h,false); CH.cam.aspect=w/h; CH.cam.updateProjectionMatrix();
 }
 function stageRider(){
  if(CH.R){CH.holder.remove(CH.R.g);dropRider(CH.R);CH.R=null;}
  if(!G.horse.makeRider)return;
  const R=G.horse.makeRider(Object.assign({},CH.draft)); CH.holder.add(R.g); CH.R=R;
  R.g.traverse(o=>{if(o.isMesh){o.castShadow=true;}});
  applyRiderLook(R,CH.draft);
 }
 function dropRider(R){R._dead=true;try{if(R._dispose)R._dispose();if(R._twHairKit)R._twHairKit.dispose();if(!R.rig&&R.mesh&&R.mesh.material)R.mesh.material.dispose();}catch(e){}}
 /* stand her up: the character plays her idle; the old sculpt is stood by the on-foot package's pose */
 function standUp(R,dt,tt,look){
  if(R.locomote){CH.holder.scale.setScalar(R.walkScale||1);R.locomote(dt,{speed:0,look});return;}
  CH.holder.scale.setScalar(0.91);
  if(G.onFoot&&G.onFoot.pose)G.onFoot.pose(R,0,0,0,tt,look);
 }
 function frame(t){
  if(!CH.open||!CH.renderer)return;
  CH.raf=requestAnimationFrame(frame);
  const R=CH.R; if(!R||!R.sk){if(CH.R&&!CH.R._looked&&CH.R.mesh){applyRiderLook(CH.R,CH.draft);CH.R._looked=true;}CH.renderer.render(CH.scene,CH.cam);return;}
  const tt=(t||0)/1000, dt=CH.lastT?Math.min(0.1,tt-CH.lastT):0.016; CH.lastT=tt;
  /* she can arrive after the screen opened (her files still loading on a first launch): the busts want her */
  if(CH.tab==='style'&&!CH.thumbKey){renderChar();}
  standUp(R,dt,tt,Math.sin(tt*0.45)*0.25);
  if(!CH.drag)CH.spin+=0;                          // she holds still unless turned
  CH.holder.rotation.y=CH.spin;
  if(CH.zoom){CH.cam.position.set(0,1.40,1.35);CH.cam.lookAt(0,1.36,0);}
  else{CH.cam.position.set(0,1.00,4.1);CH.cam.lookAt(0,0.80,0);}
  CH.renderer.render(CH.scene,CH.cam);
 }
 /* Hair-style thumbnails, rendered off her own head, in her own hair colour: the reference
    shows each style as a little bust and a word is a poor substitute. */
 function makeThumbs(){
  const R=CH.R; if(!R||!R.sk||!CH.renderer)return;
  const key=String(CH.draft.body||'f');                                    // clay busts: only the body changes them
  if(CH.thumbKey===key&&Object.keys(CH.thumbs).length)return;
  CH.thumbKey=key; CH.thumbs={};
  const S=192, rt=new THREE.WebGLRenderTarget(S,S), buf=new Uint8Array(S*S*4);
  const LUT=new Uint8Array(256); for(let i=0;i<256;i++){const c=Math.min(1,i/255*1.15);LUT[i]=Math.round(255*(c<=0.0031308?12.92*c:1.055*Math.pow(c,1/2.4)-0.055));}
  const cv=document.createElement('canvas');cv.width=cv.height=S;const c2=cv.getContext('2d'),img=c2.createImageData(S,S);
  const cam=new THREE.PerspectiveCamera(30,1,0.05,20), spin0=CH.holder.rotation.y, style0=CH.draft.hairStyle, bg0=CH.scene.background;
  /* from behind her shoulder, three-quarters, on light card: what tells one style from another is the back of the head */
  CH.holder.rotation.y=1.8; CH.scene.background=new THREE.Color('#e9dcbc');
  const fill=new THREE.DirectionalLight(0xfff6ea,2.4); fill.position.set(0.8,1.8,2.2); CH.scene.add(fill);   // lit from the camera's side, not silhouetted
  const body=CH.draft.body||'f';
  for(const hs of HAIRSTYLES.filter(x=>!x.body||x.body.includes(body))){
   /* on a clay bust, as the reference does: in her own dark hair on a navy coat the shape is lost */
   applyRiderLook(R,Object.assign({},CH.draft,{hairStyle:hs.id,helmet:'none',hair:'#cfc8bc',skin:'#ddd6cb',shirt:'#a19c95',pants:'#cfcac2',boots:'#8d8781',outfit:'riding',eyes:'brown'}));
   standUp(R,0,0,0);
   if(R.rig){ /* the character's head, wherever her height puts it */
    CH.holder.updateMatrixWorld(true); const hp=R.rig.bones.Head.getWorldPosition(new THREE.Vector3()); hp.y+=0.085;
    cam.position.set(hp.x+0.07,hp.y+0.10,hp.z+0.64); cam.lookAt(hp.x,hp.y-0.01,hp.z);
   }else{cam.position.set(0.10,1.50,1.02); cam.lookAt(0,1.33,0);}
   CH.renderer.setRenderTarget(rt); CH.renderer.render(CH.scene,cam); CH.renderer.readRenderTargetPixels(rt,0,0,S,S,buf); CH.renderer.setRenderTarget(null);
   /* GL rows run bottom up; and a render target gets neither the tone map nor the sRGB encode the
      screen does, so the linear values are encoded here or every bust comes out half as bright */
   for(let y=0;y<S;y++){const src=(S-1-y)*S*4,dst=y*S*4;for(let x=0;x<S*4;x+=4){img.data[dst+x]=LUT[buf[src+x]];img.data[dst+x+1]=LUT[buf[src+x+1]];img.data[dst+x+2]=LUT[buf[src+x+2]];img.data[dst+x+3]=255;}}
   c2.putImageData(img,0,0); CH.thumbs[hs.id]=cv.toDataURL('image/jpeg',0.86);
  }
  rt.dispose(); CH.holder.rotation.y=spin0; CH.scene.background=bg0; CH.scene.remove(fill); fill.dispose();
  applyRiderLook(R,Object.assign({},CH.draft,{hairStyle:style0}));
 }

 /* ---- the grid ---------------------------------------------------------------------- */
 function renderChar(){
  if(!CH.open)return;
  const s=G.save.fresh(); if(!s)return;
  const d=CH.draft, cat=CATS.find(c=>c[0]===CH.tab)||CATS[0];
  chRoot.querySelectorAll('.ch-cat').forEach(b=>b.classList.toggle('on',b.dataset.ch==='tab:'+CH.tab));
  $('chHead').textContent=cat[1];
  let h='';
  if(CH.tab==='style'){
   if(CH.R&&CH.R.sk)makeThumbs();
   const cur=riderHairId(d.hairStyle,d.body);
   for(const hs of HAIRSTYLES.filter(x=>!x.body||x.body.includes(d.body||'f'))){
    const th=CH.thumbs[hs.id];
    h+='<button class="ch-card'+(cur===hs.id?' sel':'')+'" data-ch="style:'+hs.id+'">'+(th?'<img alt="" src="'+th+'">':'<span class="ic">'+SVGI(ICO.style)+'</span>')+'<span class="lb">'+esc(hs.label)+'</span></button>';
   }
  }else if(CH.tab==='outfit'){
   for(const o of OUTFITS)h+='<button class="ch-card'+((d.outfit||'riding')===o.id?' sel':'')+'" data-ch="outfit:'+o.id+'"><span class="ic" style="font-size:34px;justify-content:center">'+o.icon+'</span><span class="lb">'+esc(o.label)+'</span></button>';
  }else if(CH.tab==='eyes'){
   for(const e of EYES)h+='<button class="ch-card'+((d.eyes||'brown')===e.id?' sel':'')+'" data-ch="eyes:'+e.id+'"><span class="sw" style="background:radial-gradient(circle,#111 0 22%,'+e.col+' 24% 62%,#f4f1ea 64%)"></span><span class="lb">'+esc(e.label)+'</span></button>';
  }else{
   if((d.outfit||'riding')!=='riding'&&['shirt','pants','boots'].includes(CH.tab))h+='<div style="grid-column:1/-1;font-size:12px;font-weight:800;color:#e9e3ff;background:rgba(0,0,0,.22);border-radius:8px;padding:6px 8px">These colours dress the 🏇 Riding kit — pick it under Outfit to see them.</div>';
   const items=ALL_ITEMS.filter(i=>i.slot===CH.tab&&(!i.cost||s.wardrobe.owned[i.id]||!SEASON_ITEMS.includes(i)));
   for(const it of items){
    const on=String(d[CH.tab]||'').toLowerCase()===String(it.col).toLowerCase()||(d[CH.tab]==null&&CH.tab==='helmet'&&false);
    const locked=!allowed(s,it);
    const face=it.col==='none'?'<span class="ic">'+SVGI(ICO.bare)+'</span>':'<span class="sw" style="background:'+it.col+'"></span>';
    h+='<button class="ch-card'+(on?' sel':'')+'" data-ch="'+(locked?'unlock:'+it.id:'pick:'+CH.tab+':'+it.col)+'" title="'+esc(it.label)+'">'+face+'<span class="lb">'+esc(it.label)+'</span>'+(locked?'<span class="lock">✨ '+it.cost+'</span>':'')+'</button>';
   }
  }
  $('chGrid').innerHTML=h;
  $('chDust').textContent=String(s.dust||0); $('chCoins').textContent=String(s.coins|0);
  chRoot.querySelector('[data-ch="zoom"]').classList.toggle('on',CH.zoom);
  $('chSave').textContent=s.rider&&s.rider.made?'Save':'Saddle up!';
 }
 const esc=v=>String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
 function setDraft(patch){
  Object.assign(CH.draft,patch);
  CH.draft.hairStyle=riderHairId(CH.draft.hairStyle,CH.draft.body);
  /* a character of the other body is another character: build her; otherwise just dress this one */
  if(CH.R){if(CH.R.rig&&CH.R.rig.kit.body!==(CH.draft.body==='m'?'m':'f')){stageRider();CH.thumbKey='';setTimeout(()=>{if(CH.open&&CH.tab==='style')renderChar();},400);}else applyRiderLook(CH.R,CH.draft);}
  renderChar();
 }
 function surprise(){
  const s=G.save.fresh(); if(!s)return;
  const pick=slot=>{const L=ALL_ITEMS.filter(i=>i.slot===slot&&allowed(s,i));return L.length?L[Math.floor(Math.random()*L.length)].col:null;};
  const styles=HAIRSTYLES.filter(x=>!x.body||x.body.includes(CH.draft.body||'f'));
  setDraft({hairStyle:styles[Math.floor(Math.random()*styles.length)].id,hair:pick('hair'),skin:pick('skin'),shirt:pick('shirt'),pants:pick('pants'),boots:pick('boots'),
   helmet:Math.random()<0.5?'none':pick('helmet'),eyes:EYES[Math.floor(Math.random()*EYES.length)].id,
   outfit:Math.random()<0.7?'riding':OUTFITS[1+Math.floor(Math.random()*(OUTFITS.length-1))].id});
 }

 /* ---- open, close, save ------------------------------------------------------------- */
 function openChar(tab){
  const s=G.save.fresh(); if(!s)return;
  try{G.hidePanels();}catch(e){}
  CH.draft=fitOf(s); if(tab)CH.tab=tab;
  CH.open=true; chRoot.classList.add('on'); document.body.classList.add('se-char-open');
  $('chName').value=String(s.playerName||'');
  if(!CH.renderer)buildStage(); else sizeStage();
  stageRider();
  CH.thumbKey=''; renderChar();
  cancelAnimationFrame(CH.raf); CH.raf=requestAnimationFrame(frame);
  /* the thumbnails want her skeleton; draw the grid again once it is in */
  setTimeout(()=>{if(CH.open&&CH.tab==='style')renderChar();},250);
 }
 function closeChar(){
  if(!CH.open)return;
  CH.open=false; chRoot.classList.remove('on'); document.body.classList.remove('se-char-open');
  cancelAnimationFrame(CH.raf);
  if(CH.R){CH.holder.remove(CH.R.g);dropRider(CH.R);CH.R=null;}
  /* a second GL context is not free: give it back */
  try{for(const d of CH.disp||[])d.dispose();CH.renderer.dispose();CH.renderer.forceContextLoss();}catch(e){}
  try{const cv=$('chCanvas');if(cv)cv.remove();}catch(e){}
  CH.renderer=null; CH.scene=null; CH.thumbs={}; CH.thumbKey='';
 }
 function saveChar(){
  const d=CH.draft, name=String($('chName').value||'').trim().slice(0,14);
  G.save.sync(s=>{Object.assign(s.rider,{shirt:d.shirt,pants:d.pants,hair:d.hair,skin:d.skin,helmet:d.helmet,boots:d.boots,hairStyle:d.hairStyle,body:d.body,outfit:d.outfit||'riding',eyes:d.eyes||'brown'});if(name)s.playerName=name;});
  closeChar();
  finishCreator(name);
 }
 chRoot.addEventListener('click',e=>{
  const b=e.target.closest&&e.target.closest('[data-ch]'); if(!b)return;
  const [op,a1,a2]=b.dataset.ch.split(':');
  if(op==='close')closeChar();
  else if(op==='save')saveChar();
  else if(op==='undo'){const s=G.save.fresh();if(s)setDraft(fitOf(s));}
  else if(op==='tab'){CH.tab=a1;renderChar();}
  else if(op==='style')setDraft({hairStyle:a1});
  else if(op==='outfit')setDraft({outfit:a1});
  else if(op==='eyes')setDraft({eyes:a1});
  else if(op==='pick')setDraft({[a1]:b.dataset.ch.split(':').slice(2).join(':')});
  else if(op==='unlock'){G.ui.dispatch('wd:unlock:'+a1);const it=itemById(a1),s=G.save.fresh();if(it&&s&&s.wardrobe.owned[it.id])setDraft({[it.slot]:it.col});else renderChar();}
  else if(op==='zoom'){CH.zoom=!CH.zoom;renderChar();}
  else if(op==='dice')surprise();
  else if(op==='body')setDraft({body:CH.draft.body==='m'?'f':'m'});
  else if(op==='turn')CH.spin+=Math.PI/2;
  else if(op==='rname'){$('chName').value=RIDER_NAMES[Math.floor(Math.random()*RIDER_NAMES.length)];}
 });
 addEventListener('resize',()=>{if(CH.open)sizeStage();});
 G.on('escape',()=>{if(CH.open){closeChar();return true;}return false;});
 /* while it is up the horse holds still and the keys belong to the name field */
 window.addEventListener('keydown',e=>{
  if(!CH.open)return;
  if(document.activeElement&&document.activeElement.id==='chName'){if(e.code==='Enter')saveChar();return;}
  if(e.code==='Escape'){closeChar();e.preventDefault();}
  e.stopImmediatePropagation();
 },true);
 G.on('tick',()=>{if(CH.open){const p=G.horse.player;if(p)p.speed=0;}});
 /* ---- Season Store ---------------------------------------------------------------------- */
 function seasonStoreHtml(s){
  const sn=G.time.seasonNow(), def=sn.def, items=SEASON_OUTFITS[def.id]||[], tok=(s.tokens&&s.tokens.n)||0;
  const days=Math.max(0,Math.ceil((sn.end-Date.now())/864e5));
  return '<div class="evrow">'+def.emoji+' <b>'+def.name+' · Season Store</b><span style="font-size:11px">'+def.desc+' Closes in '+days+' day'+(days===1?'':'s')+'; what you buy stays yours.</span><span style="flex:none">🎟️ <b>'+tok+'</b></span></div>'
   +items.map(it=>{const own=!!s.wardrobe.owned[it.id];
    return '<div class="evrow"><span style="flex:none;width:14px;height:14px;border-radius:50%;background:'+it.col+'"></span> <b>'+it.label+'</b><span style="font-size:11px">'+(it.kind==='tack'?'🤠 Western · Epic Ranger set: saddle, pad, bridle, shoes':SLOT_LBL[it.slot])+'</span>'
     +'<span style="flex:none">'+(own?'<span style="font-size:11px;color:#8c7a63">owned ✓</span>':'<button data-fx="wd:season:'+it.id+'" '+(tok>=it.cost?'':'disabled')+'>'+it.cost+' 🎟️</button>')+'</span></div>';}).join('')
   +'<span style="font-size:11px;color:#8c7a63">Season tokens come from the Trail Pass as the season goes on. Outfits you own are worn from 🛍️ Shop → 🧢 Outfit.</span>';
 }
 G.ui.lbTab({id:'store',label:'🛍️ Season Store',render(s){return seasonStoreHtml(s);}});
 function openStore(){G.hidePanels();G.ui.openLB();const b=$('lbPanel')&&$('lbPanel').querySelector('[data-lbtab="store"]');if(b)b.click();}
 /* ---- actions ------------------------------------------------------------------------------ */
 const rerenderOutfit=()=>{const sp=$('shopPanel');if(sp&&sp.style.display==='flex')G.ui.openShop('outfit');const rp=$('riderPanel');if(rp&&rp.style.display==='flex')G.ui.rerender('riderPanel');};
 G.ui.action('wd',(a,el)=>{
  const op=a[0]; let msg='',ok=false;
  if(op==='wear'){const slot=a[1],val=a.slice(2).join(':');const it=ALL_ITEMS.find(i=>i.slot===slot&&i.col.toLowerCase()===val.toLowerCase());
   G.save.sync(s=>{if(it&&!allowed(s,it)){msg='That one is still locked — '+it.cost+'✨ dust.';return;}s.rider[slot]=val;ok=true;});
   if(ok){applyLocal();msg=it?it.label+' — looking sharp! 🧢':'Looking sharp! 🧢';}}
  else if(op==='unlock'){const it=itemById(a[1]);if(!it)return;
   G.save.sync(s=>{if(s.wardrobe.owned[it.id])return;if((s.dust||0)<it.cost){msg='Not enough dust — '+it.cost+'✨ needed, you have '+(s.dust||0)+'.';return;}s.dust-=it.cost;s.wardrobe.owned[it.id]=1;s.rider[it.slot]=it.col;ok=true;});
   if(ok){applyLocal();G.sChime();msg='✨ Unlocked the '+it.label+'!';}}
  else if(op==='set'&&a[1]==='prestige'){G.save.sync(s=>{if(!prestigeOwned(s)){msg='The prestige set is not yours yet.';return;}Object.assign(s.rider,{helmet:PRESTIGE_SET.helmet,shirt:PRESTIGE_SET.shirt,pants:PRESTIGE_SET.pants,boots:PRESTIGE_SET.boots});ok=true;});if(ok){applyLocal();G.sGem();msg='👑 Dressed to the nines.';}}
  else if(op==='hair'){const hs=HAIRSTYLES.find(h=>h.id===a[1]);if(!hs)return;G.save.sync(s=>{if(hs.body&&!hs.body.includes(s.rider.body||'f')){msg='That style does not suit this body.';return;}s.rider.hairStyle=hs.id;ok=true;});if(ok){applyLocal();msg='💇 '+hs.label+'.';}}
  else if(op==='body'){G.save.sync(s=>{s.rider.body=a[1]==='m'?'m':'f';s.rider.hairStyle=riderHairId(s.rider.hairStyle,s.rider.body);ok=true;});applyLocal();msg=a[1]==='m'?'👦 Cowboy.':'👧 Cowgirl.';}
  else if(op==='outfit'){const o=OUTFITS.find(x=>x.id===a[1]);if(!o)return;G.save.sync(s=>{s.rider.outfit=o.id;ok=true;});applyLocal();msg=o.icon+' '+o.label+'.';}
  else if(op==='eyes'){const e=EYES.find(x=>x.id===a[1]);if(!e)return;G.save.sync(s=>{s.rider.eyes=e.id;ok=true;});applyLocal();msg='👁️ '+e.label+' eyes.';}
  else if(op==='name'){const v=String(el&&el.value||'').trim().slice(0,14);G.save.sync(s=>{s.playerName=v||s.playerName;});return;}
  else if(op==='dice'){const nm=RIDER_NAMES[Math.floor(Math.random()*RIDER_NAMES.length)];G.save.sync(s=>{s.playerName=nm;});const inp=$('riderPanel')&&$('riderPanel').querySelector('[data-fxin="wd:name"]');if(inp)inp.value=nm;msg='🎲 '+nm+' it is.';toast(msg);return;}
  else if(op==='done'){const inp=$('riderPanel')&&$('riderPanel').querySelector('[data-fxin="wd:name"]');finishCreator(inp?String(inp.value||'').trim().slice(0,14):'');return;}
  else if(op==='creator'){openChar();return;}
  else if(op==='store'){openStore();return;}
  else if(op==='season'){const it=SEASON_ITEMS.find(i=>i.id===a[1]);if(!it)return;const sn=G.time.seasonNow();
   G.save.sync(s=>{if(s.wardrobe.owned[it.id]){msg='Already yours.';return;}if(!(SEASON_OUTFITS[sn.def.id]||[]).includes(it)){msg='That outfit is out of season.';return;}
    s.tokens=s.tokens||{key:'',n:0};if((s.tokens.n||0)<it.cost){msg='Not enough season tokens — '+it.cost+'🎟️ needed.';return;}s.tokens.n-=it.cost;s.wardrobe.owned[it.id]=1;
    if(it.kind==='tack'){s.tack=s.tack||[];for(const sl of G.tables.GEAR_SLOTS)s.tack.push(G.horse.genGear('Epic',sl,{set:it.set,style:'western'}));}else s.rider[it.slot]=it.col;ok=true;});
   if(ok){if(it.kind==='tack'){G.horse.refreshTack();}else applyLocal();G.money.refreshWallet();G.sGem();msg='🛍️ '+it.label+(it.kind==='tack'?' — four Epic pieces in your locker!':' — yours to keep.');const lp=$('lbPanel');if(lp&&lp.style.display==='flex')openStore();}}
  if(msg)toast(msg);
  if(ok){G.money.refreshWallet();rerenderOutfit();}
 });
 G.ui.careHeader((s,h)=>'<button data-fx="wd:creator" style="font-size:11px">🧑 Rider</button>');
 /* ---- what club mates see ---------------------------------------------------------------- */
 G.on('netPos',(payload,s,h)=>{const r=(s&&s.rider)||{};payload.hs=r.hairStyle||'long';payload.bt=r.boots||null;payload.bo=r.body||'f';payload.of=r.outfit||'riding';payload.ey=r.eyes||'brown';payload.bd=prestigeOwned(s)?1:0;payload.ss=G.horse.TACK()&&G.horse.TACK().saddle&&G.horse.TACK().saddle.userData.style==='western'?'western':'english';});
 G.on('remote',(m,r)=>{
  if(!r||!r.rider)return;
  const bo=m.bo==='m'?'m':'f';
  const fit={shirt:m.s||DEF_SHIRT,pants:m.p||DEF_PANTS,hair:m.hr||null,skin:m.sk||null,helmet:m.hm||null,boots:m.bt||null,hairStyle:riderHairId(String(m.hs||'long').slice(0,10),bo),body:bo,
   outfit:OUTFITS.some(o=>o.id===m.of)?m.of:'riding',eyes:EYES.some(e=>e.id===m.ey)?m.ey:'brown'};
  const k=lookKey(fit);
  if(r.rider._twLook!==k&&!applyRiderLook(r.rider,fit)&&r.rider.setLook&&G.horse.makeRider){   // false until she is in; tries again next packet
   /* the character said no: another body is another rider, so build that one where this one sits */
   const old=r.rider,par=old.g.parent,nr=G.horse.makeRider(fit);
   if(par){nr.g.position.copy(old.g.position);nr.g.rotation.copy(old.g.rotation);nr.g.scale.copy(old.g.scale);par.remove(old.g);par.add(nr.g);}
   old._dead=true;try{old._dispose&&old._dispose();}catch(e){}
   r.rider=nr; applyRiderLook(nr,fit);
  }
  const badge=!!m.bd; if(badge!==!!r.badge){r.badge=badge;
   try{const grp=r.parts&&r.parts.group;const old=grp&&grp.children.find(o=>o.isSprite&&Math.abs(o.position.y-3.15)<1e-3);if(old){grp.remove(old);}
    const tag=G.nameSprite((badge?'👑':'')+(G.net.isFriend(r.name)?'💚':'🌐')+r.name);tag.position.y=3.15;grp.add(tag);}catch(e){}}
 });
 G.ui.profileSection((name,r)=>r&&r.badge?'<div style="font-size:12px"><span style="background:#d4af37;color:#3a2a10;border-radius:8px;padding:1px 8px;font-weight:800">👑 PRESTIGE</span></div>':'');
 G.on('wallet',s=>{G.ui.hud.stat('dustEl','✨ '+(s.dust||0));});
 G.on('state',o=>{const s=G.save.fresh()||{};const r=s.rider||{};const inv=s.tack||[];
  o.rider={shirt:r.shirt||null,pants:r.pants||null,helmet:r.helmet||null,skin:r.skin||null,hair:r.hair||null,boots:r.boots||null,hairStyle:r.hairStyle||null,body:r.body||null,outfit:r.outfit||null,eyes:r.eyes||null,made:!!r.made,name:s.playerName||null,dust:s.dust||0,tokens:(s.tokens&&s.tokens.n)||0,owned:Object.keys((s.wardrobe&&s.wardrobe.owned)||{}).length,prestige:prestigeOwned(s)};
  const T=G.horse.TACK();
  o.tack={n:inv.length,maxLvl:inv.reduce((m,t)=>Math.max(m,t.lvl||1),0),parts:s.parts||0,kits:{kit1:(s.items&&s.items.kit1)||0,kit2:(s.items&&s.items.kit2)||0,kit3:(s.items&&s.items.kit3)||0},saddleStyle:T&&T.saddle?T.saddle.userData.style||null:null,sets:Object.keys(G.tables.TACK_SETS).length};});
 /* ---- Bo the Saddler, the tack missions, dailies and achievements ------------------------ */
 G.quest.types.tacklvl=(m,val,prog)=>Math.max(prog,typeof val==='number'?val:0);   // snapshot: the highest level any piece has reached
 const M1={ch:'Upgrade Your Tack!',npc:'saddler',label:'Raise a piece of tack to Lv 2',text:'Bo here. That saddle of yours will do more with a bit of work: open 🛍️ Shop → 🐎 Tack, buy a Toolkit I from me (or take the free weekly one), and press ⬆ on any piece. Bring it to Lv 2.',type:'tacklvl',goal:2,reward:{c:200,xp:40},twKit:'kit1'};
 const M2={ch:'Tack Technician',npc:'saddler',label:'Raise a piece of tack to Lv 8',text:'You have the hands for it. Take one piece all the way to Lv 8 — Toolkit II from Lv 4, Toolkit III for the last step. Chests, my stall and stripped spares will get you the kits.',type:'tacklvl',goal:8,reward:{c:600,g:3,xp:120},twKit:'kit3'};
 G.quest.story.insertBefore(Math.min(4,G.quest.STORY.length),[M1],'tw-m1');
 G.quest.story.insertBefore(Math.min(14,G.quest.STORY.length),[M2],'tw-m2');
 G.world.addNPC({id:'saddler',name:'Bo the Saddler',icon:'🧰',x:56,z:-42,hat:'#5a3d22',shirt:'#8a6a45',idle:'Leather wants oil and a saddle wants a rider. Show me what you are sitting on and I will make it better.',role:{open:'tack',label:'🧰 Saddlery'}});
 G.world.mapMarkers.push({x:56,z:-42,glyph:'🧰',label:"Bo's Saddlery"});
 G.quest.addDaily({type:'tackup',icon:'🧰',label:'Upgrade or merge a piece of tack',goal:1,r:{c:120,g:2,p:15}});
 const maxLvl=s=>(s.tack||[]).reduce((m,t)=>Math.max(m,t.lvl||1),0);
 const legendFull=s=>{const inv=s.tack||[];return s.horses.some(h=>{const c={};for(const sl of G.tables.GEAR_SLOTS){const it=h.gear&&inv.find(t=>t.id===h.gear[sl]);const st=it&&G.horse.gearSet(it);if(st&&G.tables.TACK_SETS[st].rarity==='Legendary')c[st]=(c[st]||0)+1;}return Object.values(c).some(n=>n>=4);})?1:0;};
 /* leaderboard exclusive: the top rung of the weekly Star Points ladder is a Legendary piece */
 {const sp=G.tables.MILES&&G.tables.MILES.sp;if(sp&&!sp.tiers.some(t=>t[0]===800))sp.tiers.push([800,{g:12,k:2,gear:'Legendary'}]);}
 G.quest.addAch({id:'tack10',icon:'🐎',label:'Well stocked',desc:'Own 10 pieces of tack',v:s=>(s.tack||[]).length,goal:10,r:{k:1}});
 G.quest.addAch({id:'merge5',icon:'🔀',label:'Saddler\'s apprentice',desc:'Merge tack 5 times',v:s=>(s.stats&&s.stats.merges)||0,goal:5,r:{c:300}});
 G.quest.addAch({id:'saddler8',icon:'🧰',label:'Master Saddler',desc:'Raise a piece of tack to Lv 8 (unlocks the 👑 prestige set)',v:maxLvl,goal:8,r:{g:3}});
 G.quest.addAch({id:'legendset',icon:'✨',label:'Legend in leather',desc:'Wear all four pieces of one Legendary set (unlocks the 👑 prestige set)',v:legendFull,goal:1,r:{g:5}});
 G.quest.addAch({id:'season3',icon:'🛍️',label:'Dressed for the season',desc:'Buy 3 seasonal outfits',v:s=>Object.keys((s.wardrobe&&s.wardrobe.owned)||{}).filter(k=>SEASON_ITEMS.some(i=>i.id===k)).length,goal:3,r:{g:2}});
 /* ---- per frame: apply the look once the sculpt is in, pay mission kits, open the creator */
 let lastIdx=-1, acc=0, creatorChecked=false;
 const autoCreator=!(location.search.includes('qa=')&&!location.search.includes('qa=tack'));
 G.on('tick',(dt,t)=>{
  const R=G.horse.player.rider;
  if(R&&R.mesh&&R._twLook!==localLook){if(!localFit)refreshLocal();
   /* the character says no to another body: rebuild her, once per look */
   if(localFit&&!applyRiderLook(R,localFit)&&R.setLook&&R._twReload!==localLook){R._twReload=localLook;G.horse.reloadHorses();}}
  acc+=dt; if(acc<0.5)return; acc=0;
  const idx=G.quest.storyIdx();
  if(idx!==lastIdx){lastIdx=idx;
   for(const m of [M1,M2]){const at=G.quest.STORY.indexOf(m);if(at>=0&&at<idx){let paid=false;G.save.sync(s=>{s.mig=s.mig||{};const tag='tw-kit-'+m.twKit+'-'+m.goal;if(s.mig[tag])return;s.mig[tag]=1;s.items=s.items||{};s.items[m.twKit]=(s.items[m.twKit]||0)+1;paid=true;});
    if(paid)toast('🧰 Bo tucks a Tack Toolkit '+({kit1:'I',kit2:'II',kit3:'III'})[m.twKit]+' into your saddlebag.');}}}
  if(!creatorChecked&&!$('load')){creatorChecked=true;const s=G.save.fresh();if(s&&autoCreator&&!(s.rider&&s.rider.made))openChar();}   // the Character screen, the first time
 });
 G.on('rebuild',()=>{refreshLocal();});
 G.on('boot',s=>{refreshLocal(s);});
 /* handles for QA */
 G.wardrobe={WARDROBE,HAIRSTYLES,SEASON_OUTFITS,PRESTIGE_SET,RIDER_NAMES,applyRiderLook,prestigeOwned,fitOf,missions:[M1,M2],openChar,closeChar,charState:()=>({open:CH.open,tab:CH.tab,draft:CH.draft&&Object.assign({},CH.draft),rider:!!CH.R,thumbs:Object.keys(CH.thumbs).length})};
}

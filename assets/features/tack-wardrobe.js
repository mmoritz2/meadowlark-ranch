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
 const HAIRSTYLES=[{id:'loose',label:'Loose',body:null},{id:'bun',label:'Bun',body:null},{id:'ponytail',label:'Ponytail',body:null},
  {id:'braid',label:'Braid',body:['f']},{id:'pigtails',label:'Pigtails',body:['f']},{id:'crop',label:'Crop',body:['m']},{id:'quiff',label:'Quiff',body:['m']}];
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
  if(r.body==null)r.body='f'; if(r.hairStyle==null)r.hairStyle='loose'; if(r.boots===undefined)r.boots=null; if(r.made==null)r.made=false;
 });
 const isVIP=s=>!!(s&&s.vip&&s.vip.until>Date.now());
 function prestigeOwned(s){return isVIP(s)||!!(s.achClaims&&(s.achClaims.saddler8||s.achClaims.legendset))||!!(s.wardrobe&&s.wardrobe.owned.prestige);}
 function allowed(s,it){return !it.cost||!!(s.wardrobe&&s.wardrobe.owned[it.id]);}
 function wearing(s,slot,val){const cur=s.rider[slot];return (cur==null&&val==null)||(String(cur||'').toLowerCase()===String(val||'').toLowerCase());}
 function fitOf(s){const r=s.rider||{};return {shirt:r.shirt||DEF_SHIRT,pants:r.pants||DEF_PANTS,hair:r.hair||null,skin:r.skin||null,helmet:r.helmet||null,boots:r.boots||null,hairStyle:r.hairStyle||'loose',body:r.body||'f'};}
 const lookKey=f=>[f.shirt,f.pants,f.hair,f.skin,f.helmet,f.boots,f.hairStyle,f.body].join('|');
 /* ---- the look, applied to a rider without rebuilding the herd ---------------------------- */
 function hairMeshes(R,fit){
  const head=R.sk&&R.sk.by&&R.sk.by.head; if(!head)return;
  if(R._twHair){head.remove(R._twHair);R._twHair.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material)o.material.dispose();});R._twHair=null;}
  const st=fit.hairStyle||'loose', g=new THREE.Group(); g.name='hair-'+st;
  const mat=new THREE.MeshStandardMaterial({color:new THREE.Color(fit.hair||'#4a2e1c'),roughness:.85});
  const put=(geo,x,y,z,sx,sy,sz)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);if(sx)m.scale.set(sx,sy,sz);m.castShadow=true;m.frustumCulled=false;g.add(m);return m;};
  const sph=r=>new THREE.SphereGeometry(r,12,9), cap=(r,l)=>new THREE.CapsuleGeometry(r,l,4,8);
  if(fit.helmet==='none'){const c=put(new THREE.SphereGeometry(.19,16,10,0,Math.PI*2,0,Math.PI*.55),0,.20,-.03);c.name='haircap';}   // a bare head shows the hair
  if(st==='bun')put(sph(.085),0,.26,-.16);
  else if(st==='ponytail'){const m=put(cap(.05,.24),0,.08,-.22);m.rotation.x=.35;}
  else if(st==='braid'){put(sph(.05),0,.16,-.20);put(sph(.05),0,.05,-.25);put(sph(.05),0,-.06,-.29);}
  else if(st==='pigtails'){for(const s of[-1,1]){const m=put(cap(.04,.18),s*.16,.10,-.12);m.rotation.z=s*.3;}}
  else if(st==='quiff')put(sph(.07),0,.36,.06,1.3,.8,1);
  else if(st==='loose')put(sph(.11),0,.06,-.20,1,1.4,.7);
  head.add(g); R._twHair=g;
 }
 function bodyScale(R,fit){
  if(!R._twFitWrapped){const f=R._fit;R._fit=()=>{f();if(R._twBody==='m')R.fitG.scale.x*=1.08;};R._twFitWrapped=true;}
  const b=fit.body||'f'; if(R._twBody!==b){R._twBody=b;R._fit();}
 }
 function applyRiderLook(R,fit){
  if(!R)return false;
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
  return '<div class="crow" style="flex-wrap:wrap"><span class="lbl">💇 Hairstyle</span>'+HAIRSTYLES.filter(h=>!h.body||h.body.includes(body)).map(h=>'<button data-fx="wd:hair:'+h.id+'" '+((s.rider.hairStyle||'loose')===h.id?'class="claimBtn"':'')+' style="font-size:11px;padding:3px 8px">'+h.label+'</button>').join('')+'</div>';
 }
 G.ui.shopTab({id:'outfit',label:'🧢 Outfit',render(s,h){
  const owned=Object.keys(s.wardrobe.owned).length, tok=(s.tokens&&s.tokens.n)||0, pres=prestigeOwned(s);
  let html='<div class="crow" style="flex-wrap:wrap;gap:6px"><span style="font-size:12px;color:#8c7a63">✨ <b>'+(s.dust||0)+'</b> dust · 🎟️ <b>'+tok+'</b> season tokens · '+owned+' unlocked</span><button data-fx="wd:creator" style="font-size:11px">🧑 Rider</button><button data-fx="wd:store" style="font-size:11px">🛍️ Season Store</button></div>'
   +'<span style="font-size:12px;color:#8c7a63">Dress your rider — picks apply instantly and your club mates see them. 🔒 pieces unlock with ✨ dust from loot doors.</span>'
   +hairRow(s)+SLOTS.map(sl=>slotRow(s,sl,false)).join('');
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
  else if(op==='body'){G.save.sync(s=>{s.rider.body=a[1]==='m'?'m':'f';const hs=HAIRSTYLES.find(h=>h.id===s.rider.hairStyle);if(hs&&hs.body&&!hs.body.includes(s.rider.body))s.rider.hairStyle='loose';ok=true;});applyLocal();msg=a[1]==='m'?'👦 Cowboy.':'👧 Cowgirl.';}
  else if(op==='name'){const v=String(el&&el.value||'').trim().slice(0,14);G.save.sync(s=>{s.playerName=v||s.playerName;});return;}
  else if(op==='dice'){const nm=RIDER_NAMES[Math.floor(Math.random()*RIDER_NAMES.length)];G.save.sync(s=>{s.playerName=nm;});const inp=$('riderPanel')&&$('riderPanel').querySelector('[data-fxin="wd:name"]');if(inp)inp.value=nm;msg='🎲 '+nm+' it is.';toast(msg);return;}
  else if(op==='done'){const inp=$('riderPanel')&&$('riderPanel').querySelector('[data-fxin="wd:name"]');const v=inp?String(inp.value||'').trim().slice(0,14):'';let first=false;
   G.save.sync(s=>{s.playerName=v||s.playerName||RIDER_NAMES[Math.floor(Math.random()*RIDER_NAMES.length)];if(!s.rider.made)first=true;s.rider.made=true;
    if(!s.tw.starter){s.tw.starter=1;s.tack=s.tack||[];const g=G.horse.genGear('Common','saddle',{style:'english'});g.name='Grandma\'s Old Saddle';s.tack.push(g);const h=s.horses[G.horse.rideIdx()];if(h){h.gear=h.gear||{};if(!h.gear.saddle)h.gear.saddle=g.id;}}});
   G.horse.refreshTack();G.horse.attachTack();G.horse.dressSaddle();applyLocal();G.hidePanels();G.sChime();
   toast(first?'🐴 Welcome, '+(G.net.myName())+'! Grandma\'s old saddle is on your horse — the Tack tab will show you more.':'Saved. 🧢');return;}
  else if(op==='creator'){G.ui.open('riderPanel');return;}
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
 G.on('netPos',(payload,s,h)=>{const r=(s&&s.rider)||{};payload.hs=r.hairStyle||'loose';payload.bt=r.boots||null;payload.bo=r.body||'f';payload.bd=prestigeOwned(s)?1:0;payload.ss=G.horse.TACK()&&G.horse.TACK().saddle&&G.horse.TACK().saddle.userData.style==='western'?'western':'english';});
 G.on('remote',(m,r)=>{
  if(!r||!r.rider)return;
  const fit={shirt:m.s||DEF_SHIRT,pants:m.p||DEF_PANTS,hair:m.hr||null,skin:m.sk||null,helmet:m.hm||null,boots:m.bt||null,hairStyle:String(m.hs||'loose').slice(0,10),body:m.bo==='m'?'m':'f'};
  const k=lookKey(fit); if(r.rider._twLook!==k)applyRiderLook(r.rider,fit);       // returns false until the sculpt is in; tries again next packet
  const badge=!!m.bd; if(badge!==!!r.badge){r.badge=badge;
   try{const grp=r.parts&&r.parts.group;const old=grp&&grp.children.find(o=>o.isSprite&&Math.abs(o.position.y-3.15)<1e-3);if(old){grp.remove(old);}
    const tag=G.nameSprite((badge?'👑':'')+(G.net.isFriend(r.name)?'💚':'🌐')+r.name);tag.position.y=3.15;grp.add(tag);}catch(e){}}
 });
 G.ui.profileSection((name,r)=>r&&r.badge?'<div style="font-size:12px"><span style="background:#d4af37;color:#3a2a10;border-radius:8px;padding:1px 8px;font-weight:800">👑 PRESTIGE</span></div>':'');
 G.on('wallet',s=>{G.ui.hud.stat('dustEl','✨ '+(s.dust||0));});
 G.on('state',o=>{const s=G.save.fresh()||{};const r=s.rider||{};const inv=s.tack||[];
  o.rider={shirt:r.shirt||null,pants:r.pants||null,helmet:r.helmet||null,skin:r.skin||null,hair:r.hair||null,boots:r.boots||null,hairStyle:r.hairStyle||null,body:r.body||null,made:!!r.made,name:s.playerName||null,dust:s.dust||0,tokens:(s.tokens&&s.tokens.n)||0,owned:Object.keys((s.wardrobe&&s.wardrobe.owned)||{}).length,prestige:prestigeOwned(s)};
  const T=G.horse.TACK();
  o.tack={n:inv.length,maxLvl:inv.reduce((m,t)=>Math.max(m,t.lvl||1),0),parts:s.parts||0,kits:{kit1:(s.items&&s.items.kit1)||0,kit2:(s.items&&s.items.kit2)||0,kit3:(s.items&&s.items.kit3)||0},saddleStyle:T&&T.saddle?T.saddle.userData.style||null:null,sets:Object.keys(G.tables.TACK_SETS).length};});
 /* ---- Bo the Saddler, the tack missions, dailies and achievements ------------------------ */
 G.quest.types.tacklvl=(m,val,prog)=>Math.max(prog,typeof val==='number'?val:0);   // snapshot: the highest level any piece has reached
 const M1={ch:'Upgrade Your Tack!',npc:'saddler',label:'Raise a piece of tack to Lv 2',text:'Bo here. That saddle of yours will do more with a bit of work: open 🛍️ Shop → 🐎 Tack, buy a Toolkit I from me (or take the free weekly one), and press ⬆ on any piece. Bring it to Lv 2.',type:'tacklvl',goal:2,reward:{c:200},twKit:'kit1'};
 const M2={ch:'Tack Technician',npc:'saddler',label:'Raise a piece of tack to Lv 8',text:'You have the hands for it. Take one piece all the way to Lv 8 — Toolkit II from Lv 4, Toolkit III for the last step. Chests, my stall and stripped spares will get you the kits.',type:'tacklvl',goal:8,reward:{c:600,g:3},twKit:'kit3'};
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
  if(R&&R.mesh&&R._twLook!==localLook){if(!localFit)refreshLocal();if(localFit)applyRiderLook(R,localFit);}
  acc+=dt; if(acc<0.5)return; acc=0;
  const idx=G.quest.storyIdx();
  if(idx!==lastIdx){lastIdx=idx;
   for(const m of [M1,M2]){const at=G.quest.STORY.indexOf(m);if(at>=0&&at<idx){let paid=false;G.save.sync(s=>{s.mig=s.mig||{};const tag='tw-kit-'+m.twKit+'-'+m.goal;if(s.mig[tag])return;s.mig[tag]=1;s.items=s.items||{};s.items[m.twKit]=(s.items[m.twKit]||0)+1;paid=true;});
    if(paid)toast('🧰 Bo tucks a Tack Toolkit '+({kit1:'I',kit2:'II',kit3:'III'})[m.twKit]+' into your saddlebag.');}}}
  if(!creatorChecked&&!$('load')){creatorChecked=true;const s=G.save.fresh();if(s&&autoCreator&&!(s.rider&&s.rider.made))G.ui.open('riderPanel');}
 });
 G.on('rebuild',()=>{refreshLocal();});
 G.on('boot',s=>{refreshLocal(s);});
 /* handles for QA */
 G.wardrobe={WARDROBE,HAIRSTYLES,SEASON_OUTFITS,PRESTIGE_SET,RIDER_NAMES,applyRiderLook,prestigeOwned,fitOf,missions:[M1,M2]};
}

/* Feature package 'se-care' — the Horse Overview.

   The riding game this one is modelled on runs its whole horse screen as one full-screen view:
   the horse itself standing in the middle, a column of tabs down the left (Horse, Mastery,
   Equipment, Style, Feeding, Bloodlines, My Horses), the stats on a card beside them, and the
   horse's name, breed, stars and personality on the right over a big RIDE button. Switching
   horses lives in there too, under My Horses, which is the first place a player looks for it.
   Ours was a small cream card in the middle of the screen, a picture of the horse in a box, and
   switching horses was in a different panel altogether.

   This package is that screen, drawn with our own art and our own data. The middle of it is not
   a picture: the camera swings round to the horse's mane side and frames the real horse, with
   the rider stepped down out of shot, so whatever she is wearing and however her mane has been
   styled is what is on screen. The care button on the HUD opens it.

   It adds a screen; it takes nothing away. Every action goes through the game's own code
   (G.ui.careAct for feeding, grooming, petting and renaming, the horse selector for switching,
   each package's own action for style, tack and breeding), and the old care panel is still
   there under "More", with every section the other packages put into it. G.ui.openCare still
   opens that panel, which is what the rest of the game and every test that reads it expect.

   Nothing runs at import time. */
import {bondingPlan,foodTrainingPlan,careReceipt} from './care-presentation.js?v=bonding-1';
import {overviewHorseGroups,createOverviewVisibility} from './care-visibility.js?v=overview-1';
export const id='se-care';
export function install(G){
 const THREE=G.THREE, T=G.tables||{};
 if(!THREE||!G.ui||!G.horse)return;
 const $=id=>document.getElementById(id);
 const esc=v=>String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
 const clamp=(v,a,b)=>v<a?a:v>b?b:v;
 const TABS=[['horse','Horse','🐴'],['mastery','Mastery','🎖️'],['equipment','Equipment','🏇'],['style','Style','✂️'],
  ['feeding','Bond & Feed','🥕'],['bloodlines','Bloodlines','🧬'],['myhorses','My Horses','🏠']];
 /* The reference's order, which puts the two that a rider reads first at the top. */
 const STATS=[['speed','Speed','⚡'],['agility','Agility','🌀'],['jump','Jump','🪜'],['accel','Accelerate','⏩'],['stamina','Stamina','💗']];
 const ST={open:false,tab:'horse',fov:null,rider:null,heading:null,snap:false,foodStat:'all',receipt:null,onBack:null,backLabel:'Back'};
 const overviewVisibility=createOverviewVisibility();
 function clearHorseView(){
  const p=G.horse.player;if(!p)return;
  const parked=G.onFoot?.on?G.onFoot.horse?.():null;
  overviewVisibility.update(overviewHorseGroups(G),{
   x:parked?.x??p.pos.x,z:parked?.z??p.pos.z,
   protectedGroups:[p.mesh,parked?.group]
  });
 }

 /* ---------------------------------------------------------------- look ------------------ */
 if(!$('seCareCss')){
  const st=document.createElement('link'); st.id='seCareCss';
  st.rel='stylesheet';st.href=new URL('../menu-care.css?v=menus-polish-20261008',import.meta.url).href;
  document.head.appendChild(st);
 }

 /* ---------------------------------------------------------------- the frame -------------- */
 const root=document.createElement('div'); root.id='seOv';
 root.innerHTML='<div class="sv-top"><button class="sv-circ" data-se="close" data-care-back="true" title="Back" aria-label="Back">↩</button>'
  +'<div class="sv-title"><i>🐎</i>Horse Overview</div><div class="sv-sp"></div>'
  +'<div class="sv-pill" title="Coins"><b>🪙</b><span id="seOvCoins">0</span></div>'
  +'<div class="sv-pill" title="Gems"><b>💎</b><span id="seOvGems">0</span></div>'
  +'<button class="sv-circ" data-se="close" title="Close">✕</button></div>'
  +'<div class="sv-rail">'+TABS.map(t=>'<button class="sv-tab" data-se="tab:'+t[0]+'"><span>'+t[2]+'</span>'+t[1]+'</button>').join('')+'</div>'
  +'<div class="sv-card"><div class="sv-scroll" id="seOvBody"></div><div class="sv-btns" id="seOvBtns"></div></div>'
  +'<div class="sv-right" id="seOvRight"></div>'
  +'<button class="sv-arrow" id="seOvPrev" data-se="cycle:-1" title="Previous horse"><svg viewBox="0 0 24 24" width="55%" height="55%" aria-hidden="true"><polyline points="15,5 8,12 15,19" fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>'
  +'<button class="sv-arrow" id="seOvNext" data-se="cycle:1" title="Next horse"><svg viewBox="0 0 24 24" width="55%" height="55%" aria-hidden="true"><polyline points="9,5 16,12 9,19" fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>'
  +'<div class="sv-count" id="seOvCount"></div><div class="sv-care-only" id="seCareAnnounce" aria-live="polite" aria-atomic="true"></div>';
 document.body.appendChild(root);

 /* ---------------------------------------------------------------- data ------------------- */
 const fresh=()=>{try{return G.save.fresh();}catch(e){return null;}};
 const breedLabel=k=>{try{return G.horse.breedLabel(k);}catch(e){return k;}};
 const starsOf=h=>{let n=h.stars;if(!n){const b=(T.BREEDS3||[]).find(r=>r[0]===h.breed);n=b?((T.TIER_STARS||{})[b[2]]||2):2;}return clamp(n|0,1,6);};
 function effective(h){try{return G.xp.effStats(h)||{};}catch(e){return h.stats||{};}}
 const statNumber=v=>Number.isFinite(Number(v))?Number(Number(v).toFixed(2)):0;
 function statBreakdown(s,h){
  try{if(G.xp.statBreakdown)return G.xp.statBreakdown(h,s.tack||[]);}catch(e){}
  const base=h.stats||{},total=effective(h),tack={},gear={},sets={};
  for(const [k] of STATS){tack[k]=statNumber(total[k])-statNumber(base[k]);gear[k]=tack[k];sets[k]=0;}
  return {base,total,tack,gear,sets};
 }

 function horseTab(s,h){
  try{G.xp.ensureStats(h);}catch(e){}
  const lvl=h.level||1, cap=50+lvl*50, xp=Math.round(h.xp||0), bond=clamp(Math.round(h.bond||0),0,100);
  let bl=null;try{bl=G.horse.bondLevel?G.horse.bondLevel(h):null;}catch(e){}
  const stats=statBreakdown(s,h);
  let x='<div class="sv-lvl"><div class="sv-shield">'+lvl+'</div>'
   +'<div class="sv-meter"><div class="lb"><span>Horse level</span><small>'+xp+'/'+cap+'</small></div><div class="sv-bar"><i style="width:'+clamp(100*xp/cap,0,100).toFixed(1)+'%"></i></div></div>'
   +'<div class="sv-meter sv-bond"><div class="lb"><span>💗 Bond'+(bl!=null?' · Lv '+esc(bl):'')+'</span><small>'+bond+'/100</small></div><div class="sv-bar"><i style="width:'+bond+'%"></i></div></div></div>';
  x+='<div class="sv-head">Horse stats</div><p class="sv-p">Base + tack = effective stats. Equipped bonuses help event entry and riding performance.</p>';
  for(const [k,label,ic] of STATS){
   const v=statNumber(stats.base[k]),e=statNumber(stats.total[k]),bonus=statNumber(stats.tack[k]);
   let ceil=10,need=1;try{ceil=G.xp.statCeil(h,k);need=G.xp.statNeed(v)||1;}catch(err){}
   let capN=ceil;try{capN=Math.min(G.xp.statCap(h),ceil);}catch(err){}
   const prog=v>=capN?100:clamp(100*((h.sxp&&h.sxp[k])||0)/need,0,100);
   x+='<div class="sv-stat" data-stat="'+k+'" aria-label="'+esc(label+': '+v+' base + '+bonus+' tack = '+e+' effective')+'" title="'+esc((v>=capN?'Base stat is at its training cap for now':((h.sxp&&h.sxp[k])||0)+' / '+need+' XP to base '+(v+1))+'. Breed ceiling: '+ceil+'. Tack includes matching-set bonuses and can exceed training caps.')+'">'
    +'<span class="ic">'+ic+'</span><div><div class="nm">'+label+'</div><div class="eq">Base '+v+' + '+bonus+' tack</div><div class="mx">Training cap '+capN+'</div></div>'
    +'<div><div class="v'+(bonus>0?' up':'')+'">'+e+'</div><div class="bn">effective</div></div>'
    +'<div class="tr"><i style="width:'+prog.toFixed(1)+'%"></i></div></div>';
  }
  return {body:x,btns:'<button class="sv-b" data-se="tab:feeding">Bond &amp; feed</button><button class="sv-b" data-se="open:modes">Riding modes</button>'};
 }
 function feedingTab(s,h){
  // Care is optional time together. It never creates needs or daily chores.
  const P=G.horse.persOf?.(h)||{},B=bondingPlan(h,{personality:P,bondGain:G.horse.bondGain,names:G.horse.BOND_NAMES});
  let x='<section class="sv-bond-card" aria-label="Bond with '+esc(h.name)+'"><div class="sv-kicker">'+esc(P.label||h.pers||'Your horse')+' · Time together</div><h3>Bond with '+esc(h.name)+'</h3>'
   +'<div class="sv-bond-line"><span>'+esc(B.name)+'</span><span>'+B.bond+' / 100</span></div><div class="sv-bar" role="progressbar" aria-label="Bond" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+B.bond+'"><i style="width:'+B.bond+'%"></i></div>'
   +'<p class="sv-bond-note">'+esc(B.preference)+'</p><p class="sv-bond-next">'+(B.next===null?esc(B.nextBenefit):'<b>'+B.remaining+' to '+esc(B.nextName)+'</b><br>'+esc(B.nextBenefit))+'</p>'
   +'<div class="sv-care-actions">'+B.actions.map(a=>'<button class="sv-care-action" data-se="care:'+a.id+'">'+a.label+'<small>'+(a.gain?'+'+a.gain+' bond':'Time together')+'</small></button>').join('')+'</div></section>';
  if(G.horse.RIG()?.heroMotion?.supportedActions?.length)x+='<button class="sv-b" data-se="open:actions" style="width:100%;margin-bottom:12px;min-height:44px">Actions &amp; tricks</button>';
  const F=T.FOODS3||{}, items=s.items||{};
  const keys=Object.keys(F).filter(k=>((items[k]|0)>0||['carrot','apple','hay'].includes(k))&&(ST.foodStat==='all'||F[k].stat===ST.foodStat));
  x+='<div class="sv-head">Training treats</div><div class="sv-food-filters" aria-label="Choose training stat">'+[['all','All'],...STATS.map(([k,l])=>[k,l])].map(([k,l])=>'<button data-se="foodstat:'+k+'" class="'+(ST.foodStat===k?'on':'')+'" aria-pressed="'+(ST.foodStat===k)+'">'+l+'</button>').join('')+'</div>';
  x+=keys.map(k=>{const f=F[k],n=items[k]|0,label=STATS.find(([key])=>key===f.stat)?.[1]||f.stat;
   const p=foodTrainingPlan(h,f,{...G.xp,bondGain:G.horse.bondGain,multiplier:(fed,stat)=>G.mul('sxp',s,fed,stat),have:n});
   const bg=Math.min(100-B.bond,G.horse.bondGain(h,f.bond||0,'feed'));
   const benefit=p?(p.capped?label+' is at its current cap ('+p.cap+').':label+' '+p.value+' → '+(p.value+1)+' · '+p.progress+' / '+p.need+' XP'):'';
   const detail=p&&!p.capped?(p.gain?'<strong>+'+p.gain+' '+esc(label)+' XP</strong> per treat · about '+p.count+' more to raise it.':'No training XP from this treat.'):(bg?'+'+bg+' bond'+(p?.capped?' · Feed for bond and horse XP.':''):'A treat to share.');
   return '<article class="sv-food"><h4>'+esc(f.label||k)+'<small>'+n+' in your bag'+(bg&&p&&!p.capped?' · +'+bg+' bond':'')+'</small></h4><button data-se="care:'+esc(k)+'" '+(n<=0?'disabled':'')+' aria-label="Feed '+esc(f.label||k)+' to '+esc(h.name)+'">Feed</button>'
    +'<div class="sv-food-plan">'+esc(benefit)+(p&&!p.capped?'<div class="sv-bar"><i style="width:'+p.percent+'%"></i></div>':'')+'<div>'+detail+'</div></div></article>';
  }).join('');
  if(!keys.length)x+='<p class="sv-care-empty">No treats for this stat in your bag. Find food around the Basin or browse the Market.</p>';
  x+='<p class="sv-bond-note">Care whenever you like. Treats train your horse; rides and events build your partnership too.</p>';
  return {body:x,btns:'<button class="sv-b" data-se="open:shop">🛍️ Market</button>'};
 }
 function myHorsesTab(s){
  const ri=G.horse.rideIdx(), H=s.horses||[];
  let x='<div class="sv-head">My horses · '+H.length+'</div>';
  x+=H.map((h,i)=>{
   let th='🐴';try{th=G.ui.k&&G.ui.k.thumb?G.ui.k.thumb(h.breed,{size:64}):th;}catch(e){}
   const cur=i===ri;
   return '<div class="sv-horse'+(cur?' cur':'')+'"><div class="th">'+th+'</div>'
    +'<div class="n">'+esc(h.name)+(cur?'<em>RIDING</em>':'')+'</div>'
    +'<div class="m">'+esc(breedLabel(h.breed))+' · Lv '+(h.level||1)+' · '+'★'.repeat(starsOf(h))+(h.foal?' · 🌱 foal':'')+'</div>'
    +'<div class="a">'+(cur?'':h.foal?'':'<button data-se="ride:'+i+'">RIDE</button>')+'</div></div>';
  }).join('');
  return {body:x,btns:'<button class="sv-b" data-se="open:stable">🏠 Stable &amp; barn</button>'};
 }
 function masteryTab(s,h){
  let M=0;try{M=G.xp.masteryOf(s,h.breed);}catch(e){}
  const U=T.MASTERY_UNLOCKS||{};
  let x='<div class="sv-head">'+esc(breedLabel(h.breed))+' mastery</div>'
   +'<div class="sv-meter" style="margin-bottom:12px"><div class="lb"><span>Level '+M+'</span><small>'+M+'/10</small></div><div class="sv-bar"><i style="width:'+(M*10)+'%"></i></div></div>';
  x+=Object.keys(U).map(Number).sort((a,b)=>a-b).map(k=>'<div class="sv-row'+(k>M?' lock':'')+'"><span>'+(k>M?'🔒':'✅')+' Level '+k+'</span><span style="text-align:right">'+esc(U[k])+'</span></div>').join('');
  x+='<p class="sv-p" style="margin-top:10px">Collecting more horses of this breed increases mastery. Riding builds this horse’s level and bond. The full mastery ladder is on the care page.</p>';
  return {body:x,btns:'<button class="sv-b" data-se="open:care">📋 Tricks &amp; perks</button>'};
 }
 function equipmentTab(s,h){
  const stats=statBreakdown(s,h);
  let x='<button class="sv-b" data-se="open:modes" style="width:100%;margin-bottom:14px;min-height:44px">Saddled · Bareback · Wild</button><div class="sv-head">Tack bonuses</div><table class="sv-stat-table"><thead><tr><th scope="col">Stat</th><th scope="col">Base</th><th scope="col">+ Tack</th><th scope="col">Effective</th></tr></thead><tbody>';
  x+=STATS.map(([k,label,ic])=>'<tr data-stat="'+k+'"><th scope="row">'+ic+' '+label+'</th><td>'+statNumber(stats.base[k])+'</td><td>+'+statNumber(stats.tack[k])+'</td><td>'+statNumber(stats.total[k])+'</td></tr>').join('');
  x+='</tbody></table>';
  const sets=STATS.filter(([k])=>stats.sets[k]>0).map(([k,label])=>'+'+statNumber(stats.sets[k])+' '+label).join(', ');
  x+='<p class="sv-p" style="margin-top:10px">Tack includes equipped pieces'+(sets?' and matching-set bonuses: '+sets:'. Wear matching pieces to unlock set bonuses')+'. These effective stats help event entry and riding performance.</p>';
  x+='<p class="sv-p">Saddles, pads, bridles and horseshoes add stats beyond training caps. Change what '+esc(h.name)+' wears in the tack room; preview each upgrade or swap there.</p>';
  return {body:x,btns:'<button class="sv-b go" data-se="open:tack">🐎 Tack room</button><button class="sv-b" data-se="open:wardrobe">🧑 Rider</button>'};
 }
 function styleTab(s,h){
  let x='<div class="sv-head">Style</div>'
   +'<p class="sv-p">Mane and tail styles, dyes, ribbons and accessories. New looks unlock as '+esc(breedLabel(h.breed))+' mastery climbs.</p>';
  if(h.tailCol)x+='<div class="sv-row"><span>Tail colour</span><span><i style="display:inline-block;width:16px;height:16px;border-radius:50%;vertical-align:middle;background:'+esc(h.tailCol)+'"></i></span></div>';
  return {body:x,btns:'<button class="sv-b go" data-se="open:style">✂️ Open style</button>'};
 }
 function bloodTab(s,h){
  const P=(T.PERS||{})[h.pers];
  let x='<div class="sv-head">Bloodlines</div>'
   +'<div class="sv-row"><span>Breed</span><span>'+esc(breedLabel(h.breed))+'</span></div>'
   +(h.sex?'<div class="sv-row"><span>Sex</span><span>'+esc(h.sex)+'</span></div>':'')
   +(P?'<div class="sv-row"><span>Personality</span><span>'+esc(P.emoji+' '+P.label)+'</span></div>':'')
   +(Array.isArray(h.traits)&&h.traits.length?'<div class="sv-row"><span>Traits</span><span>'+h.traits.map(k=>{const t=(T.TRAITS||{})[k];return t?esc((t.icon||'')+' '+(t.label||k)):esc(k);}).join(', ')+'</span></div>':'')
   +'<p class="sv-p" style="margin-top:10px">Foals inherit coat, stats and traits from both parents. The breeding barn shows who pairs well.</p>';
  return {body:x,btns:'<button class="sv-b go" data-se="open:breed">🧬 Breeding barn</button>'};
 }
 function rightColumn(s,h){
  let M=0;try{M=G.xp.masteryOf(s,h.breed);}catch(e){}
  const P=(T.PERS||{})[h.pers];
  const cards=[];
  if(P)cards.push([P.emoji||'😌',P.label||h.pers]);
  if(Array.isArray(h.traits))for(const k of h.traits.slice(0,2)){const t=(T.TRAITS||{})[k];if(t)cards.push([t.icon||'✨',t.label||k]);}
  return '<div class="sv-name">'+esc(h.name)+'<button class="sv-pen" data-se="care:rename" title="Rename">✎</button></div>'
   +'<div class="sv-breed">'+esc(breedLabel(h.breed))+(h.foal?' foal':'')+'</div>'
   +'<div class="sv-stars">'+'★'.repeat(starsOf(h))+'</div>'
   +'<div class="sv-mast"><b>'+M+'</b>Mastery</div>'
   +'<div class="sv-traits">'+(cards.length?'<h4>Personality / traits</h4><div class="sv-cards">'+cards.map(c=>'<div class="sv-tc"><span>'+c[0]+'</span>'+esc(c[1])+'</div>').join('')+'</div>':'')
   +'<div class="sv-go"><button class="sv-heart" data-se="care:pet" title="Pet">♥</button><button class="sv-ride" data-se="ride">RIDE</button></div>'
   +'<button class="sv-more" data-se="open:care">More care…</button></div>';
 }
 const RENDER={horse:horseTab,mastery:masteryTab,equipment:equipmentTab,style:styleTab,feeding:feedingTab,bloodlines:bloodTab,myhorses:(s)=>myHorsesTab(s)};
 function render(){
  if(!ST.open)return;
  const s=fresh(); if(!s)return;
  const h=(s.horses||[])[G.horse.rideIdx()]; if(!h)return;
  root.querySelectorAll('.sv-tab').forEach(b=>b.classList.toggle('on',b.dataset.se==='tab:'+ST.tab));
  const out=(RENDER[ST.tab]||horseTab)(s,h);
  const body=$('seOvBody'),top=body.scrollTop;
  /* On an upright phone the RIDE button moves down into the card's own row, off the horse. */
  const btns=(innerWidth<=760?'<button class="sv-b go" data-se="ride">Ride</button>':'')+(out.btns||'');
  const receipt=ST.receipt?.horseId===h.id?ST.receipt:null;
  body.innerHTML=(receipt?'<section class="sv-care-receipt"><strong>'+esc(receipt.title)+'</strong><div class="sv-care-gains">'+receipt.gains.map(g=>'<span>'+esc(g)+'</span>').join('')+'</div></section>':'')+out.body; $('seOvBtns').innerHTML=btns; $('seOvBtns').style.display=btns?'':'none';
  body.scrollTop=top;
  $('seOvRight').innerHTML=rightColumn(s,h);
  $('seOvCoins').textContent=String(s.coins|0); $('seOvGems').textContent=String(s.gems|0);
  try{placeArrows();}catch(e){}
 }

 /* ---------------------------------------------------------------- open, close ------------ */
 function open(tab,options={}){
  if(ST.tab!==tab&&tab)ST.tab=tab;
  try{G.hidePanels();}catch(e){}
  ST.onBack=typeof options.onBack==='function'?options.onBack:null;ST.backLabel=options.label||'Back';
  const back=root.querySelector('[data-care-back]');back.setAttribute('aria-label',ST.backLabel);
  if(tab==='feeding')ST.foodStat='all';
  const p=G.horse.player;
  ST.open=true; ST.snap=true; ST.side=null; ST.heading=p?p.heading:null;
  ST.fov=G.camera?G.camera.fov:null;
  try{if(p&&p.rider&&p.rider.g){ST.rider=p.rider.g.visible;p.rider.g.visible=false;}}catch(e){}
  document.body.classList.add('se-ov-open'); root.classList.add('on');
  clearHorseView();
  render(); measureGap(); placeArrows();
 }
 function close(){
  if(!ST.open)return;
  ST.open=false;ST.onBack=null; root.classList.remove('on'); document.body.classList.remove('se-ov-open');
  overviewVisibility.restore();
  try{const p=G.horse.player;if(p&&p.rider&&p.rider.g&&ST.rider!=null)p.rider.g.visible=ST.rider;}catch(e){}
  try{if(G.camera&&ST.fov){G.camera.fov=ST.fov;G.camera.updateProjectionMatrix();}}catch(e){}
 }
 const later=()=>{render();setTimeout(render,350);setTimeout(render,1200);};
 let pendingCare=null;
 G.on('careDone',(action,ok)=>{
  const pending=pendingCare;if(!pending||pending.action!==action)return;
  if(!ok){ST.receipt=null;return;}
  const after=fresh()?.horses?.find(h=>h.id===pending.before.id);
  ST.receipt=careReceipt(pending.before,after,{action,food:T.FOODS3?.[action],statLabels:T.STAT_LBL,maxLevel:G.xp.MAX_LEVEL});
  if(ST.receipt)$('seCareAnnounce').textContent=ST.receipt.title+'. '+ST.receipt.gains.join(', ');
 });
 function performCare(action){
  const h=fresh()?.horses?.[G.horse.rideIdx()],tracked=!!T.FOODS3?.[action]||['groom','pet','water'].includes(action);
  pendingCare=tracked&&h?{action,before:JSON.parse(JSON.stringify(h))}:null;
  try{G.ui.careAct(action);}finally{pendingCare=null;}
 }
 function openOther(what){
  const i=G.horse.rideIdx(), h=(fresh()?.horses||[])[i], horseId=h&&h.id, tab=ST.tab, scroll=$('seOvBody').scrollTop;
  const returnOptions={onBack:ST.onBack,label:ST.backLabel};
  const returnOverview=()=>{
   // Find the same horse by identity: breeding or stable actions can reorder the herd.
   const horses=fresh()?.horses||[], index=horses.findIndex(h=>h.id===horseId);
   if(index>=0&&index!==G.horse.rideIdx()&&!horses[index].foal){const sel=$('horseSel');if(sel&&sel.onchange){sel.value=String(index);sel.onchange();}}
   open(tab,returnOptions); $('seOvBody').scrollTop=scroll;
  };
  close();
  const panel={care:'carePanel',stable:'stablePanel',style:'stylePanel',breed:'breedPanel',actions:'emotePanel',modes:'rideModePanel'}[what];
  if(panel&&G.seFrame&&what!=='modes')G.seFrame.setBack(panel,returnOverview);
  if((what==='tack'||what==='shop')&&G.seMarket?.setBack)G.seMarket.setBack(returnOverview,'horse overview');
  try{
   if(what==='care')G.ui.openCare();
   else if(what==='modes')G.ridingModes?.open({onBack:returnOverview});
   else if(what==='actions')G.ui.dispatch('open:emotePanel');
   else if(what==='stable')G.ui.openStable();
   else if(what==='style')G.ui.dispatch('style:open');
   else if(what==='breed')G.ui.dispatch('breed:open');
   else if(what==='tack')G.ui.dispatch('ranch:tack:'+i);
   else if(what==='wardrobe'){if(G.wardrobe?.openChar)G.wardrobe.openChar(undefined,{onBack:returnOverview});else G.ui.dispatch('wd:creator');}
   else if(what==='shop')G.ui.openShop();
  }catch(e){if(panel&&G.seFrame)G.seFrame.setBack(panel,null);if(what==='tack'||what==='shop')G.seMarket?.setBack?.(null);console.error('se-care open '+what,e);}
 }
 function rideHorse(i){
  const sel=$('horseSel'); if(!sel||!sel.onchange)return;
  sel.value=String(i); sel.onchange();
  try{const p=G.horse.player;if(p&&p.rider&&p.rider.g)p.rider.g.visible=false;}catch(e){}
  ST.snap=true; ST.side=null; ST.tab='horse'; later();
 }
 root.addEventListener('click',e=>{
  const b=e.target.closest&&e.target.closest('[data-se]'); if(!b)return;
  const [op,arg]=b.dataset.se.split(':');
  // Preserve the stable screen's established Back selector while supporting an explicit caller.
  if(op==='close'){const back=b.dataset.careBack?ST.onBack:null;close();back?.();return;}
  if(op==='tab'){ST.tab=arg;render();return;}
  if(op==='foodstat'){ST.foodStat=arg;render();return;}
  if(op==='ride'){if(arg!=null)rideHorse(+arg);else{try{if(G.onFoot&&G.onFoot.on)G.onFoot.mount();}catch(err){}close();}return;}
  if(op==='cycle'){cycle(+arg||1);return;}
  if(op==='open'){openOther(arg);return;}
  if(op==='care'){try{performCare(arg);}catch(err){console.error('se-care care '+arg,err);}later();return;}
 });
 /* The care button on the HUD opens this screen. Caught on the way down, before the button's
    own handler, so the old panel does not flash open underneath. */
 document.addEventListener('click',e=>{
  const t=e.target; if(!t||!t.closest||!t.closest('#careBtn'))return;
  e.stopPropagation(); e.preventDefault();
  if(ST.open)close(); else open('horse');
 },true);
 /* While it is up, the keyboard belongs to it: Escape closes, and nothing else reaches the
    horse. Only key-downs are held back, so a key already down when it opened still lets go. */
 window.addEventListener('keydown',e=>{
  if(!ST.open)return;
  if(e.code==='Tab')return; // Shared menu focus owns keyboard traversal.
  const tag=document.activeElement&&document.activeElement.tagName;
  if(tag==='INPUT'||tag==='TEXTAREA')return;
  if(e.code==='Escape'){close();}
  else if(e.code==='ArrowLeft'||e.code==='ArrowRight'){e.preventDefault();if(!e.repeat)cycle(e.code==='ArrowLeft'?-1:1);}
  e.stopImmediatePropagation();
 },true);

 /* ---------------------------------------------------------------- the horse on camera ---- */
 const _eye=new THREE.Vector3(),_at=new THREE.Vector3(),_alt=new THREE.Vector3();
 G.on('tick',()=>{
  if(!ST.open)return;
  const p=G.horse.player; if(!p)return;
  p.speed=0; if(ST.heading!=null)p.heading=ST.heading;
  try{if(p.rider&&p.rider.g)p.rider.g.visible=false;}catch(e){}
  const pn=$('seOvCoins'); if(pn&&!root.matches(':hover')){const s=fresh();if(s){pn.textContent=String(s.coins|0);$('seOvGems').textContent=String(s.gems|0);}}
 });
 /* Where the gap between the stats card and the right-hand column falls on screen, measured off
    the page whenever it is drawn, so the horse is framed into the space that is actually free at
    this window size rather than into the middle of a screen the card is covering half of. */
 const GAP={l:0.42,r:0.86,t:0.09,b:0.98};
 function measureGap(){try{const W=innerWidth||1,H=innerHeight||1,c=root.querySelector('.sv-card').getBoundingClientRect(),
   rail=root.querySelector('.sv-rail').getBoundingClientRect(),top=root.querySelector('.sv-top').getBoundingClientRect();
  if(W<=760){GAP.l=rail.right/W;GAP.r=0.98;GAP.t=top.bottom/H+0.06;GAP.b=clamp(c.top/H,0.3,0.9);}   // upright phone: the space above the card
  else{GAP.l=clamp(c.right/W,0.2,0.7);GAP.r=0.86;GAP.t=top.bottom/H;GAP.b=0.98;}}catch(e){}}
 /* The arrows either side of her: previous and next horse, flipped through in stable order with
    foals skipped (a foal is not ridden until she grows up). They sit at the edges of the free
    gap the horse is framed into, so they flank her at every window size, and they only show
    when there is somebody to flip to. */
 const rideable=s=>(s&&s.horses||[]).map((h,i)=>h&&!h.foal?i:-1).filter(i=>i>=0);
 function placeArrows(){
  const s=fresh(),R=rideable(s),W=innerWidth||1,H=innerHeight||1,ri=G.horse.rideIdx();
  const prev=$('seOvPrev'),next=$('seOvNext'),cnt=$('seOvCount'); if(!prev||!next||!cnt)return;
  const many=R.length>1;
  prev.classList.toggle('show',many); next.classList.toggle('show',many); cnt.classList.toggle('show',many);
  if(!many)return;
  /* Low, at leg height: the ends of a standing horse are narrowest there, so the arrows flank her
     instead of sitting on her chest and quarters. */
  const size=prev.offsetWidth||52,y=(GAP.t+(GAP.b-GAP.t)*0.68)*H;
  prev.style.left=(GAP.l*W+8)+'px'; prev.style.top=y+'px';
  next.style.left=(GAP.r*W-(W<=760?8:44)-size)+'px'; next.style.top=y+'px';   // clear of the traits heading on the right
  const at=Math.max(0,R.indexOf(ri)),H2=s.horses;
  const nm=k=>{const h=H2[R[(at+k+R.length)%R.length]];return h?h.name:'';};
  prev.title='Ride '+nm(-1); next.title='Ride '+nm(1);
  cnt.textContent=(at+1)+' / '+R.length; cnt.style.left=(((GAP.l+GAP.r)/2)*W)+'px'; cnt.style.top=(GAP.b*H-(W<=760?36:48))+'px';
 }
 function cycle(dir){
  const s=fresh(),R=rideable(s); if(R.length<2)return;
  const at=R.indexOf(G.horse.rideIdx()),to=R[((at<0?0:at)+dir+R.length)%R.length];
  rideHorse(to);
 }
 addEventListener('resize',()=>{if(ST.open){measureGap();render();}});
 G.on('camera',c=>{
  if(!ST.open)return false;
  const p=G.horse.player, cam=G.camera; if(!p||!cam)return false;
  clearHorseView();
  /* On foot (on-foot package) the horse on show is the one she left standing, not the hidden mount. */
  let sx=p.pos.x,sz=p.pos.z,h=p.heading,sy=p.y||0,sc=(p.mesh&&p.mesh.scale&&p.mesh.scale.x)||1;
  try{const e=G.onFoot&&G.onFoot.on&&G.onFoot.horse();if(e){sx=e.x;sz=e.z;h=e.heading;sy=0;sc=e.sc||sc;}}catch(err){}
  const gy=G.world.groundH(sx,sz)+sy;
  const vf=36*Math.PI/180, hf=2*Math.atan(Math.tan(vf/2)*(cam.aspect||1.33)), w=Math.max(0.18,GAP.r-GAP.l), cx=(GAP.l+GAP.r)/2;
  const hh=Math.max(0.2,GAP.b-GAP.t), cy=(GAP.t+GAP.b)/2;
  /* Far enough back that her whole length fits the free gap and her whole height fits the frame,
     from her right, which is the side the mane falls on, and a touch ahead of square. */
  const d=Math.max(2.3*sc/(2*0.86*w*Math.tan(hf/2)),2.15*sc/(2*0.80*hh*Math.tan(vf/2)));
  const Fx=Math.sin(h),Fz=Math.cos(h);
  _at.set(sx,gy+0.95*sc,sz);
  /* Her right is the side the mane falls on, so that is the side to stand; but a fence or a wall
     behind that spot would pull the camera in until she fills the screen, so if the right side
     has no room the left side is used instead, and the choice is kept for as long as it is open
     so the view does not flip from one side to the other between frames. */
  const place=(side,out)=>{const Sx=-Math.cos(h)*side,Sz=Math.sin(h)*side;
   out.set(sx+Sx*d+Fx*0.30*d,gy+1.15*sc+0.05*d,sz+Sz*d+Fz*0.30*d);
   try{G.world.followCamera.resolve(_at,out,out);}catch(e){}
   return out.distanceTo(_at);};
  if(ST.side==null){const want=Math.hypot(d,0.30*d);const r=place(1,_eye),l=place(-1,_alt);ST.side=(r>=0.9*want||r>=l)?1:-1;}
  place(ST.side,_eye);
  /* Smoothed on its own copy, then written outright: lerping the live camera would be tugging
     against anything else that moved it this frame and settle wherever the two agreed. */
  if(ST.snap||!ST.cam){ST.cam=_eye.clone();ST.snap=false;}else ST.cam.lerp(_eye,1-Math.exp(-6*(c.dt||0.016)));
  cam.position.copy(ST.cam);
  cam.lookAt(_at);
  cam.rotateY(Math.atan((cx-0.5)*2*Math.tan(hf/2)));  // turn so she sits in the middle of the gap, not of the screen
  cam.rotateX(Math.atan((cy-0.5)*2*Math.tan(vf/2)));  // and tip, when the free space is above or below the middle
  if(Math.abs(cam.fov-36)>0.05){cam.fov=36;cam.updateProjectionMatrix();}
  return true;
 });

 /* ?overview in the address opens straight into this screen once her model is standing there,
    so a link can go directly to the horse. */
 if(/[?&#]overview\b/i.test(String(location.search)+String(location.hash))){
  let waited=0,done=false;
  G.on('tick',dt=>{if(done||ST.open)return;waited+=dt||0.016;let ready=false;
   try{ready=!!(G.horse.RIG().ready&&G.horse.player.mesh);}catch(e){}
   if(ready&&waited>1.5){done=true;open('horse');}});
 }
 G.seCare={open,close,render,state:()=>({open:ST.open,tab:ST.tab,foodStat:ST.foodStat,receipt:ST.receipt})};
 G.on('state',o=>{o.seCare=G.seCare.state();});
}

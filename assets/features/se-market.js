/* Market presentation: preserve the game's shop renderers and purchase handlers while
   keeping navigation readable. Desktop shows one department at a time; phones use a
   grouped picker so the catalog can use the full screen width. */
export const id='se-market';
export function install(G){
 const $=id=>document.getElementById(id);
 const P=$('shopPanel'); if(!P||!G.ui)return;
 const GROUPS=[
  ['offers','Offers',['wallet','season','race','doors']],
  ['horses','Horses',['horses','summon','market','breed']],
  ['tack','Tack',['tackcollection','tacksummon','tack']],
  ['catalog','Catalog',['catalog','pets','food','style','recipes']],
  ['character','Rider',['@character','outfit','prestige']],
  ['ranches','Ranches',['ranches','furniture']],
  ['currencies','Store',['purchases','gems']],
 ];
 /* no item shares its group's name: a heading and an entry both reading HORSES read as a mistake */
 const LBL={wallet:'Free gifts',season:'Season store',race:'Race tickets',doors:'Loot doors',horses:'Breeds',summon:'Summon',
  market:'Horse market',breed:'Breeding',catalog:'Collection',tackcollection:'Tack boutique',tacksummon:'Tack Summoning Stall',tack:'Tack locker',pets:'Pets',food:'Food',style:'Horse style',recipes:'Recipes',
  '@character':'Character',outfit:'Outfits',prestige:'Prestige',ranches:'Land',furniture:'Furniture',gems:'Exchange',purchases:'Ranch store'};
 const INTRO={horses:'Find the next horse for your herd.',market:'Meet the horses available today.',summon:'Choose a call and discover a new companion.',
  tacksummon:'Spend 200 earned coins to discover one tack piece you do not own.',tack:'Equip your horses for the trail ahead.',pets:'Find a little company for life at the ranch.',food:'Keep your horses fed and ready to ride.',
  style:'Give your horse a look of its own.',catalog:'Explore the breeds in your collection.',recipes:'Discover what you can create.',
  furniture:'Make your ranch feel like home.',ranches:'Find room for your growing herd.',outfit:'Dress for your next adventure.',
  purchases:G.commerce?.isStaticStore?'Browse tack pictures, gem packs and VIP plans. Online preview; checkout is not available here.':'Tack collections, gem packs and VIP passes for your ranch account.',wallet:'Your latest gifts and rewards.',breed:'Plan the next generation of your herd.'};

 /* ---------------------------------------------------------------- look ------------------ */
 /* Destination layout lives in assets/menu-destinations.css. */

 /* ---------------------------------------------------------------- the top bar ----------- */
 let marketReturn=null;
 const top=document.createElement('div'); top.id='seMkTop';
 top.innerHTML='<div class="mt-title">Market <span class="mt-section" id="seMkSection"></span></div>'
  +'<div class="mt-wallet" aria-label="Game wallet">'
  +'<div class="mt-pill" title="Coins" aria-label="Coins"><b aria-hidden="true">🪙</b><span id="seMkCoins">0</span></div>'
  +'<div class="mt-pill" title="Earned gems" aria-label="Earned gems"><b aria-hidden="true">💎</b><span id="seMkGems">0</span></div>'
  +'<div class="mt-pill" title="Keys" aria-label="Keys"><b aria-hidden="true">🗝️</b><span id="seMkKeys">0</span></div></div>'
  +'<button type="button" class="mt-back" data-mt="close" title="Close Market and return to the ranch">← Back to ranch</button>';
 document.body.appendChild(top);
 top.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('[data-mt]');if(b&&b.dataset.mt==='close'){
  const route=marketReturn;marketReturn=null;
  try{G.hidePanels();}catch(err){P.style.display='none';}
  if(route)setTimeout(()=>{try{route.callback();}catch(err){console.error('se-market return',err);}},0);
 }});
 function wallet(){const s=G.save.fresh&&G.save.fresh();if(!s)return;
  $('seMkCoins').textContent=Number(s.coins||0).toLocaleString('en-US');$('seMkGems').textContent=Number(s.gems||0).toLocaleString('en-US');$('seMkKeys').textContent=String(s.keys||0);}
 function backLabel(){
  const horses=G.seHorses&&G.seHorses.state, toHorses=!!(horses&&horses.away&&horses.away.to==='market');
  const b=top.querySelector('[data-mt="close"]');
  if(marketReturn){b.textContent='← Back to '+marketReturn.label;b.title='Return to '+marketReturn.label;return;}
  b.textContent=toHorses?'← Back to horses':'← Back to ranch';
  /* se-horses captures this exact Back title before our close handler, then restores
     the selected horse. Keep that contract while giving the visible label context. */
  b.title=toHorses?'Back':'Close Market and return to the ranch';
 }

 /* ---------------------------------------------------------------- the left column ------- */
 let lastTab='horses', backTo=null, expandedGroup=null, focusTab=null, focusPicker=false, focusRarity=false;
 const filters=new Map();
 const activeId=()=>{const b=P.querySelector('[data-shoptab].on');return b?b.dataset.shoptab:null;};
 function catalog(){
  if(P.querySelector(':scope>.se-mk-catalog'))return;
  const tab=activeId(), selected=P.querySelector('[data-shoptab].on');
  const label=LBL[tab]||(selected&&selected.dataset.seLbl)||'Browse';
  const group=GROUPS.find(g=>g[2].includes(tab));
  const rows=[...P.querySelectorAll('.s2-row')];
  /* Horse-roster's star tiers include limited variants. Reuse those exact source
     actions instead of stacking a second, incompatible rarity filter above them. */
  const nativeButtons=[...P.querySelectorAll('[data-fx^="roster:stars:"]')];
  const nativeValue=(nativeButtons.find(b=>b.classList.contains('on'))?.dataset.fx||'roster:stars:0').split(':').pop();
  for(const b of nativeButtons){const row=b.closest('.crow');if(row)row.classList.add('se-mk-native-filter');}
  const canSearch=rows.length>=4||nativeButtons.length>0;
  const rarityOrder=G.ui2shop&&G.ui2shop.order||[];
  const rarities=[...new Set(rows.map(r=>r.dataset.s2rar).filter(Boolean))].sort((a,b)=>rarityOrder.indexOf(a)-rarityOrder.indexOf(b));
  const state=filters.get(tab)||{query:'',rarity:''};filters.set(tab,state);
  if(nativeButtons.length)state.rarity='';
  if(state.rarity&&!rarities.includes(state.rarity))state.rarity='';
  if(!canSearch){state.query='';state.rarity='';}
  const header=document.createElement('header');header.className='se-mk-catalog';
  const crumb=document.createElement('span');crumb.className='se-mk-crumb';crumb.textContent='Market / '+(group?group[1]:'More');header.appendChild(crumb);
  const heading=document.createElement('div');heading.className='se-mk-heading';
  const title=document.createElement('h1');title.textContent=label;heading.appendChild(title);
  const summary=document.createElement('span');summary.className='se-mk-results';summary.setAttribute('role','status');summary.setAttribute('aria-live','polite');heading.appendChild(summary);header.appendChild(heading);
  if(INTRO[tab]){const intro=document.createElement('p');intro.className='se-mk-intro';intro.textContent=INTRO[tab];header.appendChild(intro);}
  let search=null,rarity=null;
  const empty=document.createElement('section');empty.className='se-mk-empty';empty.hidden=true;
  empty.innerHTML='<strong>No items found</strong><p>Try another name or reset your filters to see the full selection.</p><button type="button">Reset filters</button>';
  const reset=()=>{
   state.query='';state.rarity='';if(search)search.value='';
   const all=nativeButtons.find(b=>b.dataset.fx==='roster:stars:0');
   if(all&&nativeValue!=='0'){focusRarity=true;all.click();return;}
   if(rarity&&!nativeButtons.length)rarity.value='';apply();if(search)search.focus({preventScroll:true});
  };
  const clear=document.createElement('button');clear.type='button';clear.className='se-mk-clear';clear.textContent='Reset';clear.hidden=true;clear.addEventListener('click',reset);
  function apply(){
   const words=state.query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
   P.classList.toggle('se-mk-filter-active',!!(state.query||state.rarity));
   let shown=0;
   for(const row of rows){
    const text=row.textContent.toLocaleLowerCase();
    const show=(!state.rarity||row.dataset.s2rar===state.rarity)&&words.every(w=>text.includes(w));
    row.classList.toggle('se-mk-filtered',!show);if(show)shown++;
   }
   for(const h of P.querySelectorAll(':scope>.s2-head')){
    let next=h.nextElementSibling,visible=false;
    while(next&&!next.classList.contains('s2-head')){if(next.classList.contains('s2-row')&&!next.classList.contains('se-mk-filtered'))visible=true;next=next.nextElementSibling;}
    h.classList.toggle('se-mk-filtered',!visible);
   }
   summary.textContent=rows.length?(shown===rows.length?rows.length+' items':shown+' of '+rows.length):(canSearch?'0 items':'');
   summary.appendChild(clear);clear.hidden=!(state.query||state.rarity||nativeValue!=='0');empty.hidden=!canSearch||shown>0;
  }
  if(canSearch){
   const controls=document.createElement('div');controls.className='se-mk-filters';
   const searchWrap=document.createElement('label');searchWrap.className='se-mk-search';
   search=document.createElement('input');search.id='seMkSearch';search.type='search';search.placeholder='Search '+label.toLocaleLowerCase()+'…';search.setAttribute('aria-label','Search '+label);search.autocomplete='off';search.value=state.query;
   search.addEventListener('input',()=>{state.query=search.value;apply();});searchWrap.appendChild(search);controls.appendChild(searchWrap);
   if(nativeButtons.length||rarities.length>1){
    const rarityWrap=document.createElement('label');rarityWrap.className='se-mk-rarity';
    const caption=document.createElement('span');caption.className='se-mk-filter-label';caption.textContent='Rarity';rarityWrap.appendChild(caption);
    rarity=document.createElement('select');rarity.id='seMkRarity';rarity.setAttribute('aria-label','Filter by rarity');
    if(nativeButtons.length){
     for(const b of nativeButtons){const n=b.dataset.fx.split(':').pop(),o=document.createElement('option');o.value=n;o.textContent=n==='0'?'All rarities':n+' stars';o.selected=b.classList.contains('on');rarity.appendChild(o);}
     rarity.addEventListener('change',()=>{const b=nativeButtons.find(b=>b.dataset.fx.endsWith(':'+rarity.value));if(b){focusRarity=true;b.click();}});
    }else{
     for(const r of ['',...rarities]){const o=document.createElement('option');o.value=r;o.textContent=r||'All rarities';rarity.appendChild(o);}
     rarity.value=state.rarity;rarity.addEventListener('change',()=>{state.rarity=rarity.value;apply();});
    }
    rarityWrap.appendChild(rarity);controls.appendChild(rarityWrap);
   }
   header.appendChild(controls);
  }
  empty.querySelector('button').addEventListener('click',reset);
  const strip=P.querySelector(':scope>.se-mk-side');P.insertBefore(header,strip?strip.nextSibling:P.firstChild);header.after(empty);apply();
  if(focusRarity&&rarity){focusRarity=false;rarity.focus({preventScroll:true});}
 }
 function expand(strip,gid){
  expandedGroup=gid;
  for(const h of strip.querySelectorAll('[data-se-group-toggle]'))h.setAttribute('aria-expanded',String(h.dataset.seGroupToggle===gid));
  for(const b of strip.querySelectorAll('[data-se-group]'))b.hidden=b.dataset.seGroup!==gid;
 }
 function arrange(){
  const strip=[...P.children].find(c=>c.classList&&c.classList.contains('crow')&&c.querySelector('[data-shoptab]'));
  if(!strip||strip.dataset.semk==='1')return;
  const btn={}; for(const b of strip.querySelectorAll('[data-shoptab]'))btn[b.dataset.shoptab]=b;
  const act=activeId(); if(act){if(act!==lastTab)P.scrollTop=0;lastTab=act;}
  const frag=document.createDocumentFragment();
  const pickerLabel=document.createElement('label');pickerLabel.className='se-mk-mobile';pickerLabel.textContent='Browse';
  const picker=document.createElement('select');picker.id='seMkBrowse';picker.setAttribute('aria-label','Browse market departments');pickerLabel.appendChild(picker);frag.appendChild(pickerLabel);
  const groups=GROUPS.map(([gid,label,ids])=>[gid,label,ids.filter(t=>t==='@character'?!!(G.wardrobe&&G.wardrobe.openChar):!!btn[t])]).filter(g=>g[2].length);
  const rest=Object.keys(btn).filter(t=>t!=='close'&&!GROUPS.some(g=>g[2].includes(t)));
  if(rest.length)groups.push(['more','More',rest]);
  const currentGroup=groups.find(g=>g[2].includes(act));
  expandedGroup=currentGroup?currentGroup[0]:(expandedGroup||groups[0]?.[0]);
  for(const [gid,label,ids] of groups){
   const h=document.createElement('button');h.type='button';h.className='se-mk-gh';h.dataset.seGroupToggle=gid;h.textContent=label;
   h.setAttribute('aria-expanded',String(gid===expandedGroup));h.addEventListener('click',()=>expand(strip,expandedGroup===gid?null:gid));frag.appendChild(h);
   const opts=document.createElement('optgroup');opts.label=label;picker.appendChild(opts);
   const controlled=[];
   for(const t of ids){
    let b;
    if(t==='@character'){
     b=document.createElement('button');b.type='button';b.className='se-mk-char';b.dataset.semk='character';b.textContent='Character';b.title='Dress your rider';
    }else{b=btn[t];}
    const label=LBL[t]||b.textContent.replace(/^[^\w]+/,'').trim();
    b.dataset.seLbl=label;b.dataset.seGroup=gid;b.id=b.id||'seMkTab-'+t.replace('@','');b.hidden=gid!==expandedGroup;b.setAttribute('aria-label',label);
    if(t===act)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');
    controlled.push(b.id);frag.appendChild(b);
    const o=document.createElement('option');o.value=t;o.textContent=label;o.selected=t===act;opts.appendChild(o);
   }
   h.setAttribute('aria-controls',controlled.join(' '));
  }
  if(btn.close){btn.close.hidden=true;frag.appendChild(btn.close);}
  strip.classList.add('se-mk-side');strip.setAttribute('role','navigation');strip.setAttribute('aria-label','Market departments');strip.appendChild(frag);strip.dataset.semk='1';
  picker.addEventListener('change',()=>{
   const target=picker.value==='@character'?strip.querySelector('[data-semk="character"]'):btn[picker.value];
   if(target){focusPicker=true;target.click();}
  });
  $('seMkSection').textContent=LBL[act]||(btn[act]&&btn[act].dataset.seLbl)||'';
  if(focusPicker){focusPicker=false;picker.focus({preventScroll:true});}
  else if(focusTab&&btn[focusTab])btn[focusTab].focus({preventScroll:true});
  focusTab=null;
 }
 P.addEventListener('click',e=>{
  const b=e.target.closest&&e.target.closest('[data-shoptab]');
  if(b&&b.dataset.shoptab!=='close'&&!focusPicker)focusTab=b.dataset.shoptab;
 },true);
 P.addEventListener('click',e=>{
  const c=e.target.closest&&e.target.closest('[data-semk="character"]'); if(!c)return;
  e.preventDefault(); e.stopPropagation();
  backTo=lastTab||activeId()||'horses';
  try{G.wardrobe.openChar();}catch(err){console.error('se-market character',err);backTo=null;}
 },true);
 /* coming back from the Character screen lands in the Market where you left it */
 const ch=()=>$('seChar');
 function watchChar(){const el=ch(); if(!el||el.dataset.semkWatch)return; el.dataset.semkWatch='1';
  new MutationObserver(()=>{if(backTo&&!el.classList.contains('on')){const t=backTo;backTo=null;setTimeout(()=>{try{G.ui.openShop(t);}catch(e){}},0);}})
   .observe(el,{attributes:true,attributeFilter:['class']});}

 /* ---------------------------------------------------------------- open, shut ------------- */
 function sync(){
  const open=P.style.display==='flex';
  P.classList.toggle('se-mk',open); document.body.classList.toggle('se-market-open',open);
  if(open){arrange();catalog();wallet();backLabel();watchChar();}
  else if(!backTo)marketReturn=null;
 }
 new MutationObserver(sync).observe(P,{childList:true,attributes:true,attributeFilter:['style']});
 G.on('wallet',()=>{if(P.classList.contains('se-mk'))wallet();});
 sync();

 /* ---------------------------------------------------------------- the ☰ menu tile ------- */
 /* The Character screen from anywhere: a button in the dock, which the HUD gathers into the ☰
    menu with the others (and which a game without that HUD shows in the dock itself). */
 if(!$('charBtn')){
  const b=document.createElement('button'); b.id='charBtn'; b.type='button'; b.textContent='🧑 Character'; b.title='Dress your rider';
  b.onclick=()=>{try{G.wardrobe&&G.wardrobe.openChar&&G.wardrobe.openChar();}catch(e){}};
  const dock=$('dock'); if(dock)dock.appendChild(b);
 }

 G.seMarket={open:()=>G.ui.openShop(lastTab),setBack(callback,label='previous screen'){
  marketReturn=typeof callback==='function'?{callback,label}:null;if(P.classList.contains('se-mk'))backLabel();
 },state:()=>({open:P.classList.contains('se-mk'),tab:activeId(),groups:[...P.querySelectorAll('.se-mk-gh')].map(h=>h.textContent)})};
 G.on('state',o=>{o.seMarket=G.seMarket.state();});
}

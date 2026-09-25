/* Feature package 'se-market' — the Market, laid out the way the riding game this one is modelled
   on lays out its own.

   Its Market is a full screen: a bar across the top (back, the Market sign, the currencies, close),
   a purple column down the left listing every department under a few headings (Offers, Summon,
   Catalog, Character, Ranches, Currencies), and the rest of the screen a grid of big cards, each a
   picture of the thing with its name, its stars and a button under it. Character sits in that
   column as a department of its own, one tap from anywhere in the Market. Ours was a narrow cream
   card in the middle of the screen with nineteen tabs on one line that scrolled off its edge.

   This package does not rebuild a single shop tab. The game's own renderer (openShop) and the
   ui2-shop pass over it still draw every row, price and button, and every handler they bound still
   fires. What changes is where things sit:
     - the panel goes full screen on a deep blue-purple ground, and its rows become a grid of cards,
       the picture on top, the price button along the bottom;
     - the tab strip becomes the left column: the game's own tab buttons, moved into groups under
       headings, so a click on one is still the game's click (and a test's page.click still finds
       it: nothing is collapsed out of view);
     - a Character entry at the head of the Character group opens the Character screen, and closing
       that screen comes back to the Market where you left it;
     - a bar across the top carries the title, the coins, gems and keys, and close.
   The Character screen is also a tile in the ☰ menu now, for when you are not in the Market.

   Nothing runs at import time. */
export const id='se-market';
export function install(G){
 const $=id=>document.getElementById(id);
 const P=$('shopPanel'); if(!P||!G.ui)return;
 const esc=v=>String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
 const GROUPS=[
  ['offers','Offers',['wallet','season','race','doors']],
  ['horses','Horses',['horses','summon','market','breed']],
  ['catalog','Catalog',['catalog','tack','pets','food','style','recipes']],
  ['character','Rider',['@character','outfit','prestige']],
  ['ranches','Ranches',['ranches','furniture']],
  ['currencies','Currencies',['gems']],
 ];
 /* no item shares its group's name: a heading and an entry both reading HORSES read as a mistake */
 const LBL={wallet:'Free gifts',season:'Season store',race:'Race tickets',doors:'Loot doors',horses:'Breeds',summon:'Summon',
  market:'Horse market',breed:'Breeding',catalog:'Collection',tack:'Tack',pets:'Pets',food:'Food',style:'Horse style',recipes:'Recipes',
  '@character':'Character',outfit:'Outfits',prestige:'Prestige',ranches:'Land',furniture:'Furniture',gems:'Exchange'};
 const TOP='clamp(50px,8.5vh,64px)', SIDE='clamp(150px,15vw,208px)';

 /* ---------------------------------------------------------------- look ------------------ */
 if(!$('seMarketCss')){
  const st=document.createElement('style'); st.id='seMarketCss';
  st.textContent=`
#shopPanel.se-mk{position:fixed!important;inset:0!important;left:0!important;top:0!important;right:0!important;bottom:0!important;transform:none!important;
 width:auto!important;max-width:none!important;height:auto!important;max-height:none!important;margin:0!important;border:0!important;border-radius:0!important;
 display:grid!important;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));grid-auto-flow:row;align-content:start;gap:14px!important;
 grid-template-rows:none!important;grid-auto-rows:max-content!important;   /* in a fixed-height scroller, auto rows over overflow:hidden cards squeeze to a sliver */
 padding:calc(${TOP} + 18px) 22px 26px calc(${SIDE} + 22px)!important;overflow-y:auto!important;
 background:radial-gradient(120% 90% at 62% 8%,#4043a8 0%,#2b2c7c 46%,#1b1c52 100%)!important;box-shadow:none!important;animation:seMkIn .18s ease!important;color:#fff}
@keyframes seMkIn{from{opacity:0}to{opacity:1}}
#shopPanel.se-mk::before{display:none!important}
#shopPanel.se-mk>*{grid-column:1/-1;margin:0!important;min-width:0}
#shopPanel.se-mk>.s2-wallet,#shopPanel.se-mk>.mk-x,#shopPanel.se-mk [data-shoptab="close"]{display:none!important}
/* ---- the left column: the game's own tab buttons, in groups ---- */
#shopPanel.se-mk>.crow.se-mk-side{position:fixed!important;left:0;top:${TOP};bottom:0;width:${SIDE};z-index:3;display:flex!important;flex-direction:column!important;
 flex-wrap:nowrap!important;align-items:stretch;gap:0!important;margin:0!important;padding:0 0 18px!important;overflow-x:hidden!important;overflow-y:auto!important;
 background:linear-gradient(180deg,#30276e,#221c52)!important;box-shadow:3px 0 12px rgba(0,0,0,.35);scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.25) transparent;
 -webkit-mask-image:none!important;mask-image:none!important;border-radius:0!important}   /* the one-line strip faded its right edge and rounded its ends */
#shopPanel.se-mk>.se-mk-side .se-mk-gh{position:relative;display:flex;align-items:center;justify-content:flex-end;gap:8px;min-height:36px;padding:0 16px 0 28px;margin-top:2px;
 font:900 13.5px/1 Nunito,system-ui,sans-serif;letter-spacing:.6px;text-transform:uppercase;color:#cfc8ff;border-bottom:1px solid rgba(255,255,255,.06)}
#shopPanel.se-mk>.se-mk-side .se-mk-gh::before{content:'›';position:absolute;left:12px;top:50%;transform:translateY(-54%);font-size:20px;color:#a89df0}
#shopPanel.se-mk>.se-mk-side .se-mk-gh.on{color:#ffd97a;background:linear-gradient(90deg,#5b3a9e,#7a3fb2);box-shadow:inset -4px 0 0 #b28cff}
#shopPanel.se-mk>.se-mk-side .se-mk-gh.on::before{content:'⌄';transform:translateY(-70%);color:#ffd97a}
#shopPanel.se-mk>.se-mk-side>button{position:relative;flex:0 0 auto;display:block!important;width:100%!important;min-height:31px!important;height:auto!important;margin:0!important;
 padding:0 16px 0 30px!important;border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;text-align:right;
 font-size:0!important;color:transparent!important;white-space:nowrap}
#shopPanel.se-mk>.se-mk-side>button::after{content:attr(data-se-lbl);font:800 12.5px/31px Nunito,system-ui,sans-serif;letter-spacing:.5px;text-transform:uppercase;color:#f1eeff}
#shopPanel.se-mk>.se-mk-side>button:hover{background:rgba(255,255,255,.07)!important}
#shopPanel.se-mk>.se-mk-side>button.on{background:linear-gradient(90deg,rgba(255,255,255,.04),rgba(255,255,255,.16))!important;box-shadow:inset -4px 0 0 #ffd97a!important}
#shopPanel.se-mk>.se-mk-side>button.on::after{color:#ffd97a}
#shopPanel.se-mk>.se-mk-side>button.on::before{content:'✦';position:absolute;left:12px;top:50%;transform:translateY(-50%);font-size:13px;color:#ffd97a}
#shopPanel.se-mk>.se-mk-side>button.se-mk-char::after{color:#9fe3ff}
/* ---- the ground: headings and notes in light ink ---- */
#shopPanel.se-mk>.s2-head{border-color:rgba(255,255,255,.18)!important}
#shopPanel.se-mk>.s2-head .s2-h-name{color:#fff!important;font-size:16px!important;letter-spacing:.4px}
#shopPanel.se-mk>.s2-head .s2-h-n{color:#cfc8ff!important}
#shopPanel.se-mk>.s2-sub,#shopPanel.se-mk>.s2-foot,#shopPanel.se-mk>span,#shopPanel.se-mk>div:not([class]){color:#dcd6ff!important}
#shopPanel.se-mk>.s2-foot:not(.passCard),#shopPanel.se-mk>span{background:rgba(255,255,255,.08)!important;border:0!important;border-radius:10px!important;
 padding:8px 12px!important;color:#ece8ff!important;font-size:13px!important;line-height:1.4;box-shadow:none!important}
#shopPanel.se-mk>.s2-sub{font:900 15px/1.2 Nunito,system-ui,sans-serif!important;letter-spacing:.5px;text-transform:uppercase;color:#fff!important;
 display:flex;align-items:center;gap:12px;margin-top:6px!important}
#shopPanel.se-mk>.s2-sub::after{content:'';flex:1;height:2px;background:linear-gradient(90deg,rgba(255,255,255,.35),transparent)}
/* ---- the cards: picture on top, price along the bottom ---- */
#shopPanel.se-mk>.s2-row{grid-column:auto;flex-direction:column!important;align-items:stretch!important;flex-wrap:nowrap!important;gap:8px!important;
 padding:10px 10px 12px!important;min-height:0!important;text-align:center;border:0!important;border-radius:14px!important;
 background:linear-gradient(180deg,#f6f3ff,#e7e0fb)!important;box-shadow:0 4px 12px rgba(10,6,40,.35)!important;overflow:hidden}
#shopPanel.se-mk>.s2-row::before{left:0!important;right:0!important;top:0!important;bottom:auto!important;width:auto!important;height:5px!important;border-radius:0!important}
#shopPanel.se-mk>.s2-row .mk-thumb,#shopPanel.se-mk>.s2-row .s2-glyph{width:100%!important;height:auto!important;min-width:0!important;min-height:0!important;aspect-ratio:3/2;
 border-radius:10px!important;box-shadow:inset 0 0 0 2px var(--rar)!important;background:radial-gradient(circle at 50% 40%,#fff,#dcd3f5)!important;font-size:58px!important}
#shopPanel.se-mk>.s2-row .s2-copy{align-items:center!important;flex:1 1 auto!important;min-width:0!important}
#shopPanel.se-mk>.s2-row .s2-title{justify-content:center!important;font-size:15px!important;color:#2a2046!important}
#shopPanel.se-mk>.s2-row .s2-meta{color:#5b4f7c!important}
#shopPanel.se-mk>.s2-row .s2-trail{flex:0 0 auto!important;max-width:none!important;margin:0!important;align-items:stretch!important;justify-content:center!important}
#shopPanel.se-mk>.s2-row .s2-trail-row{justify-content:center!important}
#shopPanel.se-mk>.s2-row .s2-trail button{min-height:38px;padding:6px 14px;border:0!important;border-radius:10px!important;font-weight:900!important;
 background:linear-gradient(180deg,#8fd35c,#58a53b)!important;color:#fff!important;text-shadow:0 1px 0 rgba(0,0,0,.25);box-shadow:inset 0 -3px 0 rgba(0,0,0,.18)!important;flex:1 1 auto;
 white-space:normal!important;line-height:1.15}   /* a long label wraps inside a narrow card instead of running off it */
#shopPanel.se-mk>.s2-row .s2-trail button:disabled{background:linear-gradient(180deg,#aaa3c4,#8a83a6)!important;opacity:1!important}
#shopPanel.se-mk>.s2-row .s2-trail button.claimBtn{background:linear-gradient(180deg,#f3de80,#d9b43d)!important;color:#2a2340!important;text-shadow:none}
#shopPanel.se-mk>.s2-row .s2-trail span{color:#5b4f7c!important}
#shopPanel.se-mk>.s2-row.s2-locked,#shopPanel.se-mk>.s2-row.s2-cant{background:linear-gradient(180deg,#e7e3f4,#d6cfea)!important}
#shopPanel.se-mk>.s2-banner{grid-column:span 2}
#shopPanel.se-mk>.passCard{grid-column:span 2;background:linear-gradient(180deg,#f6f3ff,#e7e0fb)!important;border:0!important;box-shadow:0 4px 12px rgba(10,6,40,.35)!important}
#shopPanel.se-mk>.passCard.s2-foot{grid-column:1/-1}
/* ---- the bar across the top ---- */
#seMkTop{position:fixed;left:0;right:0;top:0;height:${TOP};z-index:10;display:none;align-items:center;gap:12px;padding:0 14px;font-family:Nunito,system-ui,sans-serif;color:#fff;
 background:linear-gradient(180deg,rgba(30,24,38,.97),rgba(22,18,30,.94));box-shadow:0 3px 12px rgba(0,0,0,.35)}
body.se-market-open #seMkTop{display:flex}
#seMkTop button{font-family:inherit;cursor:pointer;border:0;box-shadow:none}
#seMkTop .mt-circ{width:clamp(38px,6vh,46px);height:clamp(38px,6vh,46px);border-radius:50%;flex:none;display:flex;align-items:center;justify-content:center;
 background:radial-gradient(circle at 35% 30%,#3a5da3,#1c2d5a);border:3px solid #dfe6f5!important;color:#fff;font-size:22px;font-weight:900;line-height:1;padding:0}
#seMkTop .mt-title{font-size:clamp(19px,3.4vh,27px);font-weight:900;white-space:nowrap;text-shadow:0 2px 0 rgba(0,0,0,.35);display:flex;align-items:center;gap:8px}
#seMkTop .mt-sp{flex:1}
#seMkTop .mt-pill{display:flex;align-items:center;gap:8px;height:clamp(30px,4.8vh,36px);padding:0 14px 0 8px;border-radius:18px;background:rgba(40,34,52,.95);
 border:2px solid rgba(255,255,255,.28);font-weight:900;font-size:clamp(14px,2.3vh,18px);min-width:clamp(70px,8vw,104px);justify-content:space-between}
body.se-market-open #seHudRoot,body.se-market-open #seWay,body.se-market-open #seMarketLbl,body.se-market-open #stickZone,body.se-market-open #seMount,
body.se-market-open #questTrack,body.se-market-open #ctx,body.se-market-open #mini{display:none!important}
body.se-market-open #toasts{z-index:12!important}
@media (max-width:760px){
 #shopPanel.se-mk{grid-template-columns:repeat(auto-fill,minmax(128px,1fr));gap:10px!important;padding:calc(${TOP} + 12px) 10px 18px calc(122px + 10px)!important}
 #shopPanel.se-mk>.crow.se-mk-side{width:122px}
 #shopPanel.se-mk>.se-mk-side>button{padding:0 8px 0 18px!important}
 #shopPanel.se-mk>.se-mk-side>button::after{font-size:10px;letter-spacing:.2px}
 #shopPanel.se-mk>.se-mk-side>button.on::before{left:6px;font-size:11px}
 #shopPanel.se-mk>.se-mk-side .se-mk-gh{font-size:10.5px;padding:0 8px 0 20px}
 #shopPanel.se-mk>.se-mk-side .se-mk-gh::before{left:6px}
 #shopPanel.se-mk>.s2-row .s2-title{font-size:13px!important}
 #shopPanel.se-mk>.s2-row .mk-thumb,#shopPanel.se-mk>.s2-row .s2-glyph{font-size:40px!important}
 #shopPanel.se-mk>.s2-banner,#shopPanel.se-mk>.passCard{grid-column:1/-1}
 #seMkTop{gap:8px;padding:0 8px}
 #seMkTop .mt-circ[title="Back"],#seMkTop .mt-pill:nth-of-type(3){display:none}
 #seMkTop .mt-title{font-size:18px}
 #seMkTop .mt-pill{min-width:0;padding:0 10px 0 6px;font-size:14px}}`;
  document.head.appendChild(st);
 }

 /* ---------------------------------------------------------------- the top bar ----------- */
 const top=document.createElement('div'); top.id='seMkTop';
 top.innerHTML='<button class="mt-circ" data-mt="close" title="Back">↩</button><div class="mt-title">🏪 Market</div><div class="mt-sp"></div>'
  +'<div class="mt-pill" title="Keys"><b>🗝️</b><span id="seMkKeys">0</span></div>'
  +'<div class="mt-pill" title="Coins"><b>🪙</b><span id="seMkCoins">0</span></div>'
  +'<div class="mt-pill" title="Gems"><b>💎</b><span id="seMkGems">0</span></div>'
  +'<button class="mt-circ" data-mt="close" title="Close">✕</button>';
 document.body.appendChild(top);
 top.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('[data-mt]');if(b&&b.dataset.mt==='close'){try{G.hidePanels();}catch(err){P.style.display='none';}}});
 function wallet(){const s=G.save.fresh&&G.save.fresh();if(!s)return;
  $('seMkCoins').textContent=Number(s.coins||0).toLocaleString('en-US');$('seMkGems').textContent=Number(s.gems||0).toLocaleString('en-US');$('seMkKeys').textContent=String(s.keys||0);}

 /* ---------------------------------------------------------------- the left column ------- */
 let lastTab='horses', backTo=null;
 const activeId=()=>{const b=P.querySelector('[data-shoptab].on');return b?b.dataset.shoptab:null;};
 function arrange(){
  const strip=[...P.children].find(c=>c.classList&&c.classList.contains('crow')&&c.querySelector('[data-shoptab]'));
  if(!strip||strip.dataset.semk==='1')return;
  const btn={}; for(const b of strip.querySelectorAll('[data-shoptab]'))btn[b.dataset.shoptab]=b;
  const act=activeId(); if(act)lastTab=act;
  const frag=document.createDocumentFragment(), used=new Set(['close']);
  const head=(label,on)=>{const h=document.createElement('div');h.className='se-mk-gh'+(on?' on':'');h.textContent=label;frag.appendChild(h);};
  for(const [gid,label,ids] of GROUPS){
   const have=ids.filter(t=>t==='@character'?!!(G.wardrobe&&G.wardrobe.openChar):!!btn[t]); if(!have.length)continue;
   head(label,have.includes(act));
   for(const t of have){
    if(t==='@character'){
     const c=document.createElement('button'); c.type='button'; c.className='se-mk-char'; c.dataset.semk='character'; c.dataset.seLbl=LBL[t];
     c.textContent='🧑 Character'; c.title='Dress your rider'; frag.appendChild(c);
    }else{const b=btn[t]; b.dataset.seLbl=LBL[t]||b.textContent.replace(/^[^\w]+/,'').trim(); frag.appendChild(b); used.add(t);}
   }
  }
  /* a department some later package adds still gets a place, under More */
  const rest=Object.keys(btn).filter(t=>!used.has(t)&&!GROUPS.some(g=>g[2].includes(t)));
  if(rest.length){head('More',rest.includes(act));for(const t of rest){const b=btn[t];b.dataset.seLbl=b.textContent.replace(/^[^\w]+/,'').trim();frag.appendChild(b);}}
  if(btn.close)frag.appendChild(btn.close);
  strip.classList.add('se-mk-side'); strip.appendChild(frag); strip.dataset.semk='1';
  /* keep the active one in view when the list is taller than the screen */
  const on=strip.querySelector('[data-shoptab].on'); if(on&&on.scrollIntoView)try{on.scrollIntoView({block:'nearest'});}catch(e){}
 }
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
  if(open){arrange();wallet();watchChar();}
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

 G.seMarket={open:()=>G.ui.openShop(lastTab),state:()=>({open:P.classList.contains('se-mk'),tab:activeId(),groups:[...P.querySelectorAll('.se-mk-gh')].map(h=>h.textContent)})};
 G.on('state',o=>{o.seMarket=G.seMarket.state();});
}

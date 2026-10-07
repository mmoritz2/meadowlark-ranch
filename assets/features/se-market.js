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
  ['tack','Tack',['tackcollection','tack']],
  ['catalog','Catalog',['catalog','pets','food','style','recipes']],
  ['character','Rider',['@character','outfit','prestige']],
  ['ranches','Ranches',['ranches','furniture']],
  ['currencies','Store',['purchases','gems']],
 ];
 /* no item shares its group's name: a heading and an entry both reading HORSES read as a mistake */
 const LBL={wallet:'Free gifts',season:'Season store',race:'Race tickets',doors:'Loot doors',horses:'Breeds',summon:'Summon',
  market:'Horse market',breed:'Breeding',catalog:'Collection',tackcollection:'Tack boutique',tack:'Tack locker',pets:'Pets',food:'Food',style:'Horse style',recipes:'Recipes',
  '@character':'Character',outfit:'Outfits',prestige:'Prestige',ranches:'Land',furniture:'Furniture',gems:'Exchange',purchases:'Ranch store'};
 const INTRO={horses:'Find the next horse for your herd.',market:'Meet the horses available today.',summon:'Choose a call and discover a new companion.',
  tack:'Equip your horses for the trail ahead.',pets:'Find a little company for life at the ranch.',food:'Keep your horses fed and ready to ride.',
  style:'Give your horse a look of its own.',catalog:'Explore the breeds in your collection.',recipes:'Discover what you can create.',
  furniture:'Make your ranch feel like home.',ranches:'Find room for your growing herd.',outfit:'Dress for your next adventure.',
  purchases:G.commerce?.isStaticStore?'Browse tack pictures, gem packs and VIP plans. Online preview; checkout is not available here.':'Tack collections, gem packs and VIP passes for your ranch account.',wallet:'Your latest gifts and rewards.',breed:'Plan the next generation of your herd.'};
 const TOP='68px', SIDE='210px';

 /* ---------------------------------------------------------------- look ------------------ */
 if(!$('seMarketCss')){
  const st=document.createElement('style'); st.id='seMarketCss';
  st.textContent=`
#shopPanel.se-mk{position:fixed!important;inset:0!important;transform:none!important;
 width:auto!important;max-width:none!important;height:auto!important;max-height:none!important;margin:0!important;border:0!important;border-radius:0!important;
 display:grid!important;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));grid-auto-flow:row;align-content:start;gap:22px!important;
 grid-template-rows:none!important;grid-auto-rows:max-content!important;
 padding:calc(${TOP} + 24px) 28px 32px calc(${SIDE} + 28px)!important;overflow-x:hidden!important;overflow-y:auto!important;
 background:#f5f3ea!important;box-shadow:none!important;color:#263c31;overscroll-behavior:contain;scroll-behavior:auto!important;overflow-anchor:none;scrollbar-color:#adb8a8 #f5f3ea}
#shopPanel.se-mk::before{display:none!important}
#shopPanel.se-mk>*{grid-column:1/-1;margin:0!important;min-width:0}
#shopPanel.se-mk>.s2-wallet,#shopPanel.se-mk>.mk-x,#shopPanel.se-mk [data-shoptab="close"]{display:none!important}
/* Keep the original tab buttons (and their handlers) within a compact department list. */
#shopPanel.se-mk>.crow.se-mk-side{grid-column:auto!important;grid-row:auto!important;position:fixed!important;left:0;top:${TOP};bottom:0;width:${SIDE};z-index:3;display:flex!important;flex-direction:column!important;
 flex-wrap:nowrap!important;align-items:stretch;gap:3px!important;margin:0!important;padding:20px 12px!important;overflow-x:hidden!important;overflow-y:auto!important;
 background:#eaece2!important;box-shadow:none!important;border-right:1px solid #d4dbce;scrollbar-width:thin;scrollbar-color:#b8c2b1 transparent;
 -webkit-mask-image:none!important;mask-image:none!important;border-radius:0!important}
#shopPanel.se-mk>.se-mk-side>button{position:relative;flex:0 0 auto;display:block!important;width:100%!important;min-height:42px!important;height:auto!important;margin:0!important;
 padding:10px 12px 10px 22px!important;border:0!important;border-radius:8px!important;background:transparent!important;box-shadow:none!important;text-align:left;
 font-size:0!important;color:transparent!important;white-space:normal!important;cursor:pointer}
#shopPanel.se-mk>.se-mk-side>button::after{content:attr(data-se-lbl);font:700 14px/1.4 Nunito,system-ui,sans-serif;color:#425a49}
#shopPanel.se-mk>.se-mk-side>button:hover{background:#dde3d5!important}
#shopPanel.se-mk>.se-mk-side>button.on{background:#fffdf6!important;box-shadow:inset 3px 0 0 #2f5c41!important}
#shopPanel.se-mk>.se-mk-side>button.on::after{color:#24472f}
#shopPanel.se-mk>.se-mk-side>button[hidden]{display:none!important}
#shopPanel.se-mk>.se-mk-side>button.se-mk-gh{display:flex!important;align-items:center;justify-content:space-between;min-height:46px!important;
 padding:10px 12px!important;margin-top:4px!important;font:800 14px/1.4 Nunito,system-ui,sans-serif!important;color:#263c31!important;background:transparent!important}
#shopPanel.se-mk>.se-mk-side>button.se-mk-gh::after{content:'⌄';font-size:17px;color:#65785e;transform:rotate(-90deg);transition:transform .15s}
#shopPanel.se-mk>.se-mk-side>button.se-mk-gh[aria-expanded="true"]::after{transform:none}
#shopPanel.se-mk>.se-mk-side>button.se-mk-gh:hover{background:#dde3d5!important}
#shopPanel.se-mk>.se-mk-side .se-mk-mobile{display:none!important}
#shopPanel.se-mk button:focus-visible,#seMkTop button:focus-visible,#shopPanel.se-mk select:focus-visible,#shopPanel.se-mk input:focus-visible{outline:3px solid #6c8c47!important;outline-offset:2px}
/* A real catalog header keeps location, discovery and results together. */
#shopPanel.se-mk>.se-mk-catalog{display:block;padding:4px 0 7px!important;font-family:Nunito,system-ui,sans-serif}
#shopPanel.se-mk .se-mk-crumb{display:block;margin:0 0 10px;font-size:12px;line-height:1.4;font-weight:700;color:#6b7967}
#shopPanel.se-mk .se-mk-heading{display:flex;align-items:baseline;justify-content:space-between;gap:14px;min-width:0}
#shopPanel.se-mk .se-mk-heading h1{margin:0;color:#243c2e;font:500 34px/1.15 Georgia,serif;letter-spacing:-.6px;overflow-wrap:anywhere}
#shopPanel.se-mk .se-mk-results{flex:none;color:#657360;font-size:12px;font-weight:700;font-variant-numeric:tabular-nums}
#shopPanel.se-mk .se-mk-intro{margin:10px 0 0;color:#5d6e57;font-size:14px;line-height:1.55}
#shopPanel.se-mk .se-mk-filters{display:flex;align-items:flex-end;gap:12px;margin-top:22px}
#shopPanel.se-mk .se-mk-search{flex:1;min-width:0;position:relative}
#shopPanel.se-mk .se-mk-search input{display:block;width:100%;height:46px;padding:10px 14px 10px 42px;background:#fffdf8;border:1px solid #cbd3c3;border-radius:10px;box-shadow:none;color:#2c4735;font:600 15px/1.4 Nunito,system-ui,sans-serif}
#shopPanel.se-mk .se-mk-search input::placeholder{color:#7b8775;font-weight:500}
#shopPanel.se-mk .se-mk-search::before{content:'';position:absolute;left:16px;bottom:17px;width:12px;height:12px;border:1.6px solid #7b8775;border-radius:50%;pointer-events:none}
#shopPanel.se-mk .se-mk-search::after{content:'';position:absolute;left:27px;bottom:14px;width:6px;height:1.6px;background:#7b8775;transform:rotate(45deg);pointer-events:none}
#shopPanel.se-mk .se-mk-filter-label{display:block;font-size:11px;font-weight:800;line-height:1.4;color:#657360;margin-bottom:6px}
#shopPanel.se-mk .se-mk-rarity{flex:0 1 178px;min-width:130px}
#shopPanel.se-mk .se-mk-rarity select{width:100%;height:46px;padding:9px 12px;background:#fffdf8;border:1px solid #cbd3c3;border-radius:10px;box-shadow:none;color:#34533c;font:700 14px/1.4 Nunito,system-ui,sans-serif}
#shopPanel.se-mk .se-mk-clear{border:0;background:transparent;box-shadow:none;color:#456542;font:800 12px Nunito,system-ui,sans-serif;padding:0;min-height:0;white-space:nowrap;text-decoration:underline;text-underline-offset:3px;margin-left:10px}
#shopPanel.se-mk .se-mk-empty{grid-column:1/-1;padding:36px 22px;text-align:center;border:1px dashed #c3ceb9;border-radius:14px;background:#edf0e5}
#shopPanel.se-mk .se-mk-empty strong{display:block;color:#314e38;font-size:18px}
#shopPanel.se-mk .se-mk-empty p{color:#63755b;font-size:13px;line-height:1.5;margin:9px 0 16px}
#shopPanel.se-mk .se-mk-empty button{padding:10px 16px;border-radius:8px;background:#34583e;color:#fff;border:0;box-shadow:none;font-size:13px;font-weight:800}
#shopPanel.se-mk .se-mk-filtered,#shopPanel.se-mk .se-mk-native-filter,#shopPanel.se-mk .se-mk-catalog [hidden],#shopPanel.se-mk .se-mk-empty[hidden]{display:none!important}
/* Cards remain generous and quiet; rarity stays in the small accent stripe. */
#shopPanel.se-mk>.s2-head{border-color:#d4dbce!important;padding-top:6px}
#shopPanel.se-mk>.s2-head .s2-h-name{color:#263c31!important;font-size:17px!important;letter-spacing:0}
#shopPanel.se-mk>.s2-head .s2-h-n{color:#63745d!important}
#shopPanel.se-mk>.s2-head .s2-h-n b{color:#315d3f!important}
#shopPanel.se-mk.se-mk-filter-active>.s2-head .s2-h-n{display:none}
#shopPanel.se-mk>.s2-sub,#shopPanel.se-mk>.s2-foot,#shopPanel.se-mk>span,#shopPanel.se-mk>div:not([class]){color:#54644f!important}
#shopPanel.se-mk>.s2-foot:not(.passCard),#shopPanel.se-mk>span{background:#e9eddf!important;border:0!important;border-radius:10px!important;
 padding:12px 14px!important;color:#4d604b!important;font-size:13px!important;line-height:1.5;box-shadow:none!important}
#shopPanel.se-mk>.s2-sub{font:800 16px/1.4 Nunito,system-ui,sans-serif!important;letter-spacing:0;text-transform:none;color:#263c31!important;
 display:flex;align-items:center;gap:12px;padding-top:6px!important}
#shopPanel.se-mk>.s2-sub::after{content:'';flex:1;height:1px;background:#d4dbce}
#shopPanel.se-mk>.s2-row{grid-column:auto;flex-direction:column!important;align-items:stretch!important;flex-wrap:nowrap!important;gap:12px!important;
 padding:16px!important;min-height:0!important;text-align:left;border:1px solid #dce0d2!important;border-radius:14px!important;
 background:#fffdf7!important;box-shadow:0 2px 5px rgba(37,56,31,.05)!important;overflow:hidden}
#shopPanel.se-mk>.s2-row::before{left:0!important;right:0!important;top:0!important;bottom:auto!important;width:auto!important;height:3px!important;border-radius:0!important}
#shopPanel.se-mk>.s2-row .mk-thumb,#shopPanel.se-mk>.s2-row .s2-glyph{width:100%!important;height:auto!important;min-width:0!important;min-height:0!important;aspect-ratio:3/2;
 border-radius:9px!important;box-shadow:none!important;background:#eef0e5!important;font-size:54px!important}
#shopPanel.se-mk>.s2-row .mk-thumb-img{object-fit:contain!important;object-position:center!important;width:100%!important;height:100%!important}
#shopPanel.se-mk>.s2-row .s2-copy{align-items:flex-start!important;flex:1 1 auto!important;min-width:0!important;gap:8px!important}
#shopPanel.se-mk>.s2-row .s2-title{justify-content:flex-start!important;font-size:16px!important;line-height:1.4!important;color:#263c31!important;gap:7px!important}
#shopPanel.se-mk>.s2-row .s2-title>b{flex:1 1 100%;overflow-wrap:anywhere}
#shopPanel.se-mk>.s2-row .s2-rar{border:0!important;background:transparent!important;padding:0!important;font-size:10px!important;letter-spacing:.04em!important}
#shopPanel.se-mk>.s2-row .s2-meta{color:#586750!important;font-size:12px!important;line-height:1.45!important}
#shopPanel.se-mk>.s2-row .s2-trail{flex:0 0 auto!important;max-width:none!important;margin:0!important;align-items:stretch!important;justify-content:center!important;gap:7px!important}
#shopPanel.se-mk>.s2-row .s2-trail-row{justify-content:flex-start!important;width:100%;gap:7px!important}
#shopPanel.se-mk>.s2-row .s2-trail button{min-height:44px;padding:10px 14px;border:0!important;border-radius:8px!important;font-weight:800!important;font-size:13px!important;
 background:#315b40!important;color:#fff!important;text-shadow:none!important;box-shadow:none!important;flex:1 1 auto!important;
 white-space:normal!important;line-height:1.35!important}
#shopPanel.se-mk>.s2-row .s2-trail button:disabled{background:#dde2d6!important;color:#69715f!important;opacity:1!important}
#shopPanel.se-mk>.s2-row .s2-trail button.claimBtn{background:#dfeccd!important;color:#2f5130!important}
#shopPanel.se-mk>.s2-row .s2-trail span{color:#586750!important;white-space:normal!important;overflow-wrap:anywhere;line-height:1.4}
#shopPanel.se-mk>.s2-row.s2-locked,#shopPanel.se-mk>.s2-row.s2-cant{background:#f0f1e8!important;opacity:1!important}
#shopPanel.se-mk>.crow>span,#shopPanel.se-mk>.crow .lbl,#shopPanel.se-mk>.crow>b,#shopPanel.se-mk>.mk-panel-body>div{color:#435b45!important}
#shopPanel.se-mk>.s2-banner{grid-column:span 2}
#shopPanel.se-mk>.passCard{grid-column:span 2;background:#fffdf7!important;border:1px solid #dce0d2!important;box-shadow:none!important;color:#263c31!important;padding:20px!important;line-height:1.5}
#shopPanel.se-mk>.passCard.s2-foot{grid-column:1/-1}
/* One clear exit; all three balances remain visible even on a small phone. */
#seMkTop{position:fixed;left:0;right:0;top:0;height:${TOP};z-index:10;display:none;align-items:center;gap:18px;padding:0 24px;font-family:Nunito,system-ui,sans-serif;color:#fbfcf4;
 background:#213e2f;box-shadow:0 1px 0 rgba(0,0,0,.16)}
body.se-market-open #seMkTop{display:flex}
#seMkTop button{font-family:inherit;cursor:pointer;border:0;box-shadow:none}
#seMkTop .mt-back{min-height:42px;flex:none;border-radius:8px;padding:9px 12px;background:#375440;color:#fff;font-size:13px;font-weight:800;white-space:nowrap}
#seMkTop .mt-back:hover{background:#45644d}
#seMkTop .mt-title{font-size:23px;font-weight:800;white-space:nowrap;line-height:1.2;display:flex;align-items:baseline;gap:14px}
#seMkTop .mt-section{font-size:14px;font-weight:600;color:#c8d6bd}
#seMkTop .mt-wallet{display:flex;align-items:center;gap:12px;margin-left:auto;min-width:0;font-variant-numeric:tabular-nums}
#seMkTop .mt-pill{display:flex;align-items:center;gap:6px;padding:6px 8px;font-weight:800;font-size:14px;white-space:nowrap}
#seMkTop .mt-pill b{font-size:16px;font-weight:400}
body.se-market-open #seHudRoot,body.se-market-open #seWay,body.se-market-open #seMarketLbl,body.se-market-open #stickZone,body.se-market-open #seMount,
body.se-market-open #questTrack,body.se-market-open #ctx,body.se-market-open #mini{display:none!important}
body.se-market-open #toasts{z-index:12!important}
@media (max-width:900px){#seMkTop .mt-section{display:none}#seMkTop{gap:12px;padding:0 16px}#seMkTop .mt-wallet{gap:4px}}
@media (max-width:760px){
 #shopPanel.se-mk{grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:16px!important;padding:180px 18px 28px!important}
 #shopPanel.se-mk>.crow.se-mk-side{top:104px;bottom:auto;width:100%;height:56px;padding:8px 14px!important;border-right:0;border-bottom:1px solid #d4dbce;overflow:visible!important}
 #shopPanel.se-mk>.se-mk-side>button{display:none!important}
 #shopPanel.se-mk>.se-mk-side>button.se-mk-gh{display:none!important}
 #shopPanel.se-mk>.se-mk-side .se-mk-mobile{display:flex!important;align-items:center;gap:12px;width:100%;min-width:0;color:#425a49;font:800 13px Nunito,system-ui,sans-serif}
 #shopPanel.se-mk>.se-mk-side .se-mk-mobile select{flex:1;min-width:0;width:100%;height:40px;border:1px solid #bac7b1;border-radius:8px;background:#fffdf7;color:#263c31;padding:0 10px;font:700 16px Nunito,system-ui,sans-serif}
 #shopPanel.se-mk>.s2-row{padding:14px!important;gap:12px!important}
 #shopPanel.se-mk>.s2-row .s2-title{font-size:15px!important}
 #shopPanel.se-mk>.s2-row .mk-thumb,#shopPanel.se-mk>.s2-row .s2-glyph{font-size:42px!important}
 #shopPanel.se-mk>.s2-banner,#shopPanel.se-mk>.passCard{grid-column:1/-1}
 #seMkTop{height:104px;display:none;flex-wrap:wrap;align-content:center;gap:4px 12px;padding:8px 14px}
 #seMkTop .mt-title{font-size:22px;order:0}
 #seMkTop .mt-back{order:1;margin-left:auto;min-height:40px;font-size:12px}
 #seMkTop .mt-wallet{order:2;flex-basis:100%;margin:0;justify-content:space-between;gap:2px}
 #seMkTop .mt-pill{padding:5px 0;font-size:13px;gap:5px}
}
@media(max-width:560px){
 #shopPanel.se-mk{grid-template-columns:minmax(0,1fr);padding-top:172px!important;gap:12px!important}
 #shopPanel.se-mk .se-mk-heading h1{font-size:27px}
 #shopPanel.se-mk .se-mk-intro,#shopPanel.se-mk .se-mk-crumb{display:none}
 #shopPanel.se-mk .se-mk-results{font-size:11px}
 #shopPanel.se-mk .se-mk-filters{gap:8px;flex-wrap:nowrap;margin-top:12px}
 #shopPanel.se-mk .se-mk-search input{height:42px}
 #shopPanel.se-mk .se-mk-search::before{bottom:15px}
 #shopPanel.se-mk .se-mk-search::after{bottom:12px}
 #shopPanel.se-mk .se-mk-search{flex:1;min-width:0}
 #shopPanel.se-mk .se-mk-rarity{flex:0 0 126px;min-width:0}
 #shopPanel.se-mk .se-mk-rarity .se-mk-filter-label{display:none}
 #shopPanel.se-mk .se-mk-rarity select{min-width:0;height:42px;font-size:13px;padding:9px 8px}
 #shopPanel.se-mk>.s2-row{display:grid!important;grid-template-columns:92px minmax(0,1fr);grid-template-areas:'image copy' 'trail trail';align-items:start!important;gap:14px!important}
 #shopPanel.se-mk>.s2-row .mk-thumb,#shopPanel.se-mk>.s2-row .s2-glyph{grid-area:image;width:92px!important;height:92px!important;aspect-ratio:1;align-self:start}
 #shopPanel.se-mk>.s2-row .s2-copy{grid-area:copy;align-self:center}
 #shopPanel.se-mk>.s2-row .s2-trail{grid-area:trail;padding-top:12px;border-top:1px solid #e5e8dd;width:100%}
 #shopPanel.se-mk>.s2-row .s2-trail button{font-size:14px!important;min-height:46px}
 #shopPanel.se-mk>.s2-head{flex-wrap:wrap;gap:5px!important}
 #shopPanel.se-mk>.s2-head .s2-h-name{font-size:15px!important}
 #shopPanel.se-mk>.s2-head .s2-h-n{font-size:10px!important}
}
@media (max-width:350px){#shopPanel.se-mk{grid-template-columns:minmax(0,1fr)}#seMkTop .mt-pill{font-size:12px}}
@media (prefers-reduced-motion:reduce){#shopPanel.se-mk *,#seMkTop *{transition:none!important;animation:none!important}}`;
  document.head.appendChild(st);
 }

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

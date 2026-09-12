/* Feature package 'ui2-shop' — the shop, the market and the summoning stall, redesigned.

   What was wrong: every list was a stack of .evrow strips flush against the sheet with no
   gutter and no rhythm, every price looked the same whether it was 55🪙 or 24💎, nothing on
   screen told you what you could actually afford, and the summon was three grey cards whose
   odds were five identical pills.

   What this does, without touching a single renderer in ranch3d.html:

   1. RARITY IS A LANGUAGE.  One ramp (Common → Dragon) drives a row's left edge, its portrait
      ring, its rarity word and its price pill.  A Legendary row is unmistakable at arm's
      length; a Common one stays quiet.
   2. GUTTERS AND RHYTHM.  Rows are cards with real padding inside a padded list, grouped under
      rarity section headers that count the group and say how many of it you can afford.
   3. AFFORDABILITY IS DRAWN.  The wallet sits at the top of every tab in tabular figures, a
      price you cannot meet dims its whole row and states the shortfall ("need 320 more"), and
      money you would RECEIVE is green rather than brass.
   4. THE SUMMON IS A CEREMONY.  Each banner states its odds as one stacked meter plus a chip
      per rarity, marks its best chance, and prices itself against your gems.  During the call
      a rarity LADDER rides over the 3D reveal: five rungs, each carrying its own percentage,
      lighting one at a time as the stall light climbs — so you can see exactly what you were
      hoping for and exactly where it stopped.  The result lands on a plaque that names the
      rarity and the odds you just beat.

   Everything is a presentation pass over the DOM the built-in renderers produce: the original
   <button> nodes are MOVED, never rebuilt, so every onclick the game bound still fires and
   every data- attribute, element id and QA selector (including .evrow, which buyHorse3 uses
   for its flash) survives.  Reduced motion is honoured throughout. */
export const id='ui2-shop';
export function install(G){
 const T=G.tables||{}, K=(G.ui&&G.ui.k)||{};
 const $=G.$;

 /* ========================= 0. the ramp ========================= */
 const RAR_ORDER=['Common','Draft','Uncommon','Rare','Epic','Legendary','Mythic','Dragon','Ascendant'];
 const RAR_COL={Common:'#9a8770',Draft:'#b98a3e',Uncommon:'#5fa86b',Rare:'#4a8fd4',
                Epic:'#9a6ae0',Legendary:'#e0a93c',Mythic:'#e0559a',Dragon:'#e2703a',Ascendant:'#b06ae0'};
 const RAR_INK={Common:'#5c4c3a',Draft:'#6b4a15',Uncommon:'#2e6b39',Rare:'#215a92',
                Epic:'#5f3aa0',Legendary:'#8a6110',Mythic:'#9b2f63',Dragon:'#94401a',Ascendant:'#6d33a8'};
 const RAR_GLYPH={Common:'•',Draft:'◆',Uncommon:'◆',Rare:'◆◆',Epic:'★',Legendary:'★★',Mythic:'✦',Dragon:'🐉',Ascendant:'👑'};
 const colOf=r=>RAR_COL[r]||RAR_COL.Common;
 const inkOf=r=>RAR_INK[r]||RAR_INK.Common;
 const esc=v=>String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
 const num=n=>Number(n||0).toLocaleString('en-US');

 /* ========================= 1. stylesheet ========================= */
 const CSS=`
#shopPanel,#summonPanel{width:min(500px,94vw);padding-bottom:calc(var(--panel-pad) + 10px);gap:0}

/* The panel is a flex column, so anything that must keep its own height has to say so:
   without this a card full of odds is squeezed to its head and the rest is clipped. */
#shopPanel>*,#summonPanel>*,#summonPanel .mk-panel-body>*{flex:0 0 auto}
.s2-wallet,.s2-head,.s2-banner,#shopPanel .s2-row{flex:0 0 auto}

/* --- the tab strip: one line, scrolls sideways, never four rows on a phone --- */
#shopPanel>.crow.s2-tabs{flex-wrap:nowrap;overflow-x:auto;overflow-y:hidden;gap:6px;
 scrollbar-width:none;-ms-overflow-style:none;padding:2px 0 10px;margin:0 calc(-1*var(--panel-pad));
 padding-left:var(--panel-pad);padding-right:var(--panel-pad);
 position:sticky;top:-2px;z-index:4;background:linear-gradient(180deg,#fffdf7 72%,rgba(255,253,247,0))}
#shopPanel>.crow.s2-tabs::-webkit-scrollbar{display:none}
#shopPanel>.crow.s2-tabs>button{flex:0 0 auto;white-space:nowrap}

/* --- the wallet: what you have, in tabular figures, above everything you could spend it on --- */
.s2-wallet{display:flex;align-items:center;gap:8px;flex-wrap:wrap;
 margin:0 0 12px;padding:9px 11px;border-radius:14px;
 background:linear-gradient(180deg,#fdf4e0,#f8ead0);border:1px solid var(--line);box-shadow:var(--e0)}
.s2-wallet-lbl{font-family:var(--display);font-size:12px;font-weight:600;color:var(--ink-3);
 letter-spacing:.08em;text-transform:uppercase;margin-right:auto}
.s2-coin{display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:999px;
 background:#fffdf7;border:1px solid var(--line-2);font-weight:800;font-size:13px;
 font-variant-numeric:tabular-nums;color:var(--ink)}
.s2-coin i{font-style:normal;font-size:13px}

/* --- section headers: rarity name, how many, how many you can afford --- */
.s2-head{display:flex;align-items:baseline;gap:8px;margin:16px 2px 8px;padding:0 0 5px;
 border-bottom:1px solid var(--line)}
.s2-head:first-child{margin-top:2px}
.s2-head .s2-h-name{font-family:var(--display);font-size:14px;font-weight:600;color:var(--ink);
 display:inline-flex;align-items:center;gap:7px}
.s2-head .s2-h-dot{width:9px;height:9px;border-radius:50%;background:var(--rar);
 box-shadow:0 0 0 3px color-mix(in srgb,var(--rar) 22%,transparent)}
.s2-head .s2-h-n{margin-left:auto;font-size:11px;font-weight:800;color:var(--ink-3);
 font-variant-numeric:tabular-nums;letter-spacing:.02em}
.s2-head .s2-h-n b{color:var(--good);font-weight:800}

/* --- the row --- */
#shopPanel .s2-row{--rar:${RAR_COL.Common};--rar-ink:${RAR_INK.Common};
 position:relative;display:flex;align-items:center;gap:11px;flex-wrap:nowrap;
 margin:0 0 8px;padding:10px 12px 10px 16px;border-radius:16px;
 border:1px solid var(--line);border-left:none;overflow:hidden;
 background:linear-gradient(180deg,#fff,#fffbf2);box-shadow:var(--e0);min-height:62px}
#shopPanel .s2-row::before{content:'';position:absolute;left:0;top:0;bottom:0;width:5px;
 background:var(--rar);border-radius:5px 0 0 5px}
#shopPanel .s2-row.s2-hi{background:linear-gradient(180deg,#fff,color-mix(in srgb,var(--rar) 9%,#fffbf2));
 border-color:color-mix(in srgb,var(--rar) 40%,var(--line))}
#shopPanel .s2-row:hover{transform:none;box-shadow:var(--e1);border-color:color-mix(in srgb,var(--rar) 55%,var(--line))}
#shopPanel .s2-row .mk-thumb,#shopPanel .s2-row .s2-glyph{flex:0 0 auto;width:46px;height:46px;
 border-radius:13px;box-shadow:0 0 0 2px var(--rar),0 1px 3px rgba(50,32,10,.2)}
#shopPanel .s2-row .s2-glyph{display:inline-flex;align-items:center;justify-content:center;
 font-size:24px;line-height:1;background:radial-gradient(circle at 50% 35%,#fff,#f1e6cf)}
#shopPanel .s2-row .s2-copy{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:3px}
/* The text column must never be squeezed to nothing. A trailing block that refuses to shrink
   (a wide button plus its label) used to take the whole row and leave the copy at 18px, which
   wraps a sentence one or two characters per line — the Tack tab was a tall column of single
   letters. The copy now holds a floor and the trailing block yields; on a narrow panel the
   trailing block drops to its own line instead of fighting for width. */
#shopPanel .s2-row{flex-wrap:wrap}
#shopPanel .s2-row .s2-copy{min-width:min(100%,9rem)}
#shopPanel .s2-row .s2-trail{flex-wrap:wrap;justify-content:flex-end}
@media (max-width:560px){
 #shopPanel .s2-row .s2-trail{max-width:none;flex:1 1 100%;margin-left:0;justify-content:flex-start}
 #shopPanel .s2-row .s2-copy{flex:1 1 100%}
}
#shopPanel .s2-row .s2-title{display:flex;align-items:center;gap:7px;flex-wrap:wrap;
 font-family:var(--display);font-size:14.5px;font-weight:600;color:var(--ink);line-height:1.15}
#shopPanel .s2-row .s2-title b{font-weight:600;font-family:inherit}
#shopPanel .s2-row .s2-rar{flex:none;font-size:9.5px;font-weight:800;letter-spacing:.1em;
 text-transform:uppercase;color:var(--rar-ink);background:color-mix(in srgb,var(--rar) 17%,#fff);
 border:1px solid color-mix(in srgb,var(--rar) 45%,transparent);border-radius:999px;padding:2px 7px;
 display:inline-flex;align-items:center;gap:4px;white-space:nowrap}
#shopPanel .s2-row .s2-meta{font-size:11.5px;font-weight:600;color:var(--ink-2);line-height:1.3;
 overflow-wrap:break-word}
#shopPanel .s2-row .s2-meta em{font-style:normal;color:var(--ink-3)}
#shopPanel .s2-row .s2-trail{flex:0 1 auto;min-width:0;max-width:60%;margin-left:auto;display:flex;align-items:flex-end;
 flex-direction:column;gap:4px}
#shopPanel .s2-row .s2-trail-row{display:flex;align-items:center;gap:5px;flex-wrap:wrap;justify-content:flex-end;max-width:100%;min-width:0}
/* Buttons keep their own text on one line, but the ROW of them must wrap, or a second
   button simply hangs off the right edge of the sheet. */
#shopPanel .s2-row .s2-trail button{max-width:100%}
/* The kit buttons sit in an unclassed wrapper inside the trailing block. It had no width
   limit, so it grew to 574px inside a 365px sheet and the first two buttons were pushed out
   of sight. It now fits the row and wraps onto a second line. */
/* The wrapper is a SPAN carrying an inline flex:none, so it neither matched a div rule nor
   agreed to shrink; both have to be overridden for the buttons to stay inside the sheet. */
#shopPanel .s2-trail-row>*{max-width:100%;min-width:0;flex-wrap:wrap;flex:0 1 auto!important}
/* A label sitting beside a control in a scrolling control row (the 'Dressing' line) kept
   white-space:nowrap, so its sentence ran off the edge instead of wrapping. */
#shopPanel .crow>span{white-space:normal;min-width:0;overflow-wrap:anywhere}
/* A control row wraps rather than scrolling its label out of sight — except the tab
   strip, which is meant to scroll. */
#shopPanel .crow:not(:has(>.tabbtn)){flex-wrap:wrap;overflow-x:visible}
/* Loose text beside a control (the 'Dressing' line) wraps rather than running off. */
#shopPanel .evrow>span:not(.s2-glyph):not(.mk-thumb){min-width:0;overflow-wrap:anywhere;white-space:normal}

/* --- the price: a pill that carries its rarity, tabular, never on a second line --- */
#shopPanel .s2-row .s2-trail button{margin:0;white-space:nowrap;font-variant-numeric:tabular-nums;
 font-weight:800;font-size:12.5px;border-radius:999px;padding:9px 14px;min-height:40px;
 border:1px solid color-mix(in srgb,var(--rar) 55%,var(--line-2));
 background:linear-gradient(180deg,#fff,color-mix(in srgb,var(--rar) 13%,#fff));
 color:var(--rar-ink);box-shadow:var(--e0);transition:transform .1s,box-shadow .15s,filter .15s}
#shopPanel .s2-row .s2-trail button:hover:not(:disabled){filter:brightness(1.04);box-shadow:var(--e1)}
#shopPanel .s2-row .s2-trail button:active:not(:disabled){transform:translateY(1px);box-shadow:none}
#shopPanel .s2-row .s2-trail button:disabled{opacity:.55;filter:grayscale(.5)}
#shopPanel .s2-row .s2-trail button.claimBtn{background:linear-gradient(180deg,#eaf7e2,#d4eec3);
 border-color:#9ecb85;color:#2e6b39}
#shopPanel .s2-row.s2-sell .s2-trail button{border-color:#9ecb85;color:#2e6b39;
 background:linear-gradient(180deg,#fff,#eaf7e2)}
#shopPanel .s2-row .s2-trail span{font-size:11px;color:var(--ink-3);font-weight:700}

/* --- what you cannot buy, drawn rather than left to guess --- */
#shopPanel .s2-row.s2-cant{opacity:.72;background:linear-gradient(180deg,#fdfaf3,#f7f1e4)}
#shopPanel .s2-row.s2-cant .mk-thumb,#shopPanel .s2-row.s2-cant .s2-glyph{filter:saturate(.45)}
#shopPanel .s2-row.s2-cant::before{background:repeating-linear-gradient(135deg,
 var(--rar) 0 4px,color-mix(in srgb,var(--rar) 35%,#fff) 4px 8px)}
/* --- locked: on the shelf it is not, and the row says so quietly --- */
#shopPanel .s2-row.s2-locked{background:repeating-linear-gradient(135deg,#fdfaf3 0 9px,#f8f2e5 9px 18px);
 border-style:dashed;opacity:.9}
#shopPanel .s2-row.s2-locked .mk-thumb,#shopPanel .s2-row.s2-locked .s2-glyph{filter:saturate(.3) brightness(1.03)}
#shopPanel .s2-row.s2-locked::before{background:color-mix(in srgb,var(--rar) 45%,#e8dcc3)}
#shopPanel .s2-row.s2-locked .s2-title::after{content:'🔒';font-size:11px;opacity:.5;margin-left:2px}
.s2-need{display:inline-flex;align-items:center;gap:4px;font-size:10.5px;font-weight:800;
 color:var(--bad);background:var(--bad-bg);border:1px solid #f0c9c6;border-radius:999px;
 padding:2px 7px;white-space:nowrap;font-variant-numeric:tabular-nums}
.s2-owned{display:inline-flex;align-items:center;gap:4px;font-size:10.5px;font-weight:800;
 color:var(--good);background:var(--good-bg);border:1px solid #c3e0ab;border-radius:999px;padding:2px 7px}

/* --- the leftovers of the old renderers, given a voice --- */
#shopPanel>div.s2-sub{font-family:var(--display);font-size:13px;font-weight:600;color:var(--ink);
 margin:16px 2px 8px;padding-bottom:5px;border-bottom:1px solid var(--line)}
#shopPanel>div.s2-sub:first-of-type{margin-top:2px}
#shopPanel>span.s2-foot,#shopPanel>div.s2-foot{display:block;font-size:11px;line-height:1.45;
 color:var(--ink-3);margin:4px 2px 10px;padding:8px 11px;border-radius:12px;
 background:#faf3e4;border:1px dashed var(--line-2)}
#shopPanel>.crow{gap:6px;overflow-x:auto;scrollbar-width:none;padding-bottom:2px}
#shopPanel>.crow::-webkit-scrollbar{display:none}
#shopPanel>.crow>*{flex:0 0 auto}
#shopPanel>.crow.s2-tabs{-webkit-mask-image:linear-gradient(90deg,#000 0,#000 calc(100% - 22px),transparent 100%);
 mask-image:linear-gradient(90deg,#000 0,#000 calc(100% - 22px),transparent 100%)}

/* ========================= the summoning stall ========================= */
#summonPanel .s2-banner,#shopPanel .s2-banner{position:relative;overflow:hidden;margin:0 0 12px;padding:13px 14px 12px;
 border-radius:18px;border:1px solid color-mix(in srgb,var(--rar) 38%,var(--line));
 background:linear-gradient(180deg,#fff,color-mix(in srgb,var(--rar) 8%,#fffbf2));
 box-shadow:var(--e0)}
#summonPanel .s2-banner,#shopPanel .s2-banner::before{content:'';position:absolute;left:0;right:0;top:0;height:4px;background:var(--rar)}
#summonPanel .s2-b-head,#shopPanel .s2-b-head{display:flex;align-items:center;gap:9px;margin-bottom:3px}
#summonPanel .s2-b-name,#shopPanel .s2-b-name{font-family:var(--display);font-size:16px;font-weight:600;color:var(--ink)}
#summonPanel .s2-b-cost,#shopPanel .s2-b-cost{margin-left:auto;display:inline-flex;align-items:center;gap:4px;
 font-size:13px;font-weight:800;font-variant-numeric:tabular-nums;padding:4px 10px;border-radius:999px;
 background:linear-gradient(180deg,#fff,#f3e6fb);border:1px solid #cdb2e6;color:#5f3aa0}
#summonPanel .s2-b-cost,#shopPanel .s2-b-cost.s2-cant-cost{background:var(--bad-bg);border-color:#f0c9c6;color:var(--bad)}
#summonPanel .s2-b-blurb,#shopPanel .s2-b-blurb{font-size:12px;color:var(--ink-2);line-height:1.35;margin-bottom:9px}
#summonPanel .s2-meter,#shopPanel .s2-meter{display:flex;height:12px;border-radius:999px;overflow:hidden;
 border:1px solid var(--line);background:#efe6d2;margin-bottom:7px}
#summonPanel .s2-meter,#shopPanel .s2-meter i{display:block;height:100%}
#summonPanel .s2-odd,#shopPanel .s2-odds,#shopPanel .s2-odds{display:flex;flex-wrap:wrap;gap:5px}
#summonPanel .s2-odd,#shopPanel .s2-odd{display:inline-flex;align-items:center;gap:5px;font-size:10.5px;font-weight:800;
 border-radius:999px;padding:3px 8px;font-variant-numeric:tabular-nums;
 color:var(--oi);background:color-mix(in srgb,var(--oc) 16%,#fff);
 border:1px solid color-mix(in srgb,var(--oc) 45%,transparent)}
#summonPanel .s2-odd,#shopPanel .s2-odd.s2-odd-best{box-shadow:0 0 0 2px color-mix(in srgb,var(--oc) 35%,transparent)}
#summonPanel .s2-odd,#shopPanel .s2-odd u{text-decoration:none;opacity:.7;font-weight:700}
#summonPanel .s2-b-foot,#shopPanel .s2-b-foot{display:flex;align-items:center;gap:8px;margin-top:10px}
#summonPanel .s2-b-foot,#shopPanel .s2-b-foot button{flex:1 1 auto;margin:0;min-height:46px;border-radius:14px;
 font-family:var(--display);font-size:14px;font-weight:600;
 border:1px solid color-mix(in srgb,var(--rar) 50%,var(--line-2));
 background:linear-gradient(180deg,#fff,color-mix(in srgb,var(--rar) 16%,#fff));color:var(--rar-ink)}
#summonPanel .s2-b-foot,#shopPanel .s2-b-foot button:disabled{opacity:.5;filter:grayscale(.55)}
#summonPanel .s2-b-foot,#shopPanel .s2-b-foot button.claimBtn{background:linear-gradient(180deg,#fff7e2,#f6e3b4);
 border-color:var(--brass-2);color:#6b4a15}

/* ========================= the reveal ========================= */
/* the ceremony owns the screen: a sheet left open behind it would sit on the reveal */
body.summoning #shopPanel,body.summoning #summonPanel{display:none!important}
#s2Ladder{position:absolute;left:50%;transform:translateX(-50%);bottom:11%;z-index:2;
 display:none;flex-direction:column;gap:9px;padding:11px 16px 13px;border-radius:20px;
 background:rgba(28,20,12,.55);backdrop-filter:blur(7px);border:1px solid rgba(255,255,255,.16);
 box-shadow:0 18px 50px rgba(0,0,0,.45)}
body.summoning #s2Ladder.on{display:flex}
#s2Ladder .s2-rungs{display:flex;gap:10px;align-items:flex-end}
#s2Ladder .s2-rung{display:flex;flex-direction:column;align-items:center;gap:5px;min-width:62px;
 opacity:.34;transition:opacity .25s ease,transform .25s ease}
#s2Ladder .s2-rung.lit{opacity:1;transform:translateY(-3px)}
#s2Ladder .s2-rung .s2-pct{font-size:14px;font-weight:800;color:#fff8ea;
 font-variant-numeric:tabular-nums;text-shadow:0 1px 6px rgba(0,0,0,.7)}
#s2Ladder .s2-rung .s2-lamp{width:100%;height:7px;border-radius:999px;background:var(--rc);
 box-shadow:none;transition:box-shadow .25s ease}
#s2Ladder .s2-rung.lit .s2-lamp{box-shadow:0 0 14px 2px var(--rc)}
#s2Ladder .s2-rung .s2-rn{font-size:9.5px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;
 color:rgba(255,248,234,.85)}
#s2Ladder .s2-cap{text-align:center;font-size:10.5px;font-weight:800;letter-spacing:.16em;
 text-transform:uppercase;color:rgba(255,248,234,.78);padding-bottom:2px;
 border-bottom:1px solid rgba(255,255,255,.16)}
#s2Plaque{position:absolute;left:50%;transform:translateX(-50%);top:31.5%;z-index:2;display:none;
 padding:7px 16px;border-radius:999px;background:rgba(28,20,12,.58);backdrop-filter:blur(6px);
 border:1px solid rgba(255,255,255,.2);font-size:12px;font-weight:800;color:#fff8ea;
 font-variant-numeric:tabular-nums;letter-spacing:.02em;white-space:nowrap;
 box-shadow:0 10px 34px rgba(0,0,0,.4)}
#s2Plaque.on{display:block;animation:s2pop .45s cubic-bezier(.2,1.4,.4,1)}
@keyframes s2pop{from{opacity:0;transform:translateX(-50%) scale(.88)}to{opacity:1;transform:translateX(-50%) scale(1)}}
#s2Vig{position:absolute;inset:0;z-index:0;pointer-events:none;opacity:0;transition:opacity .5s ease;
 background:radial-gradient(ellipse at 50% 58%,transparent 34%,var(--rc,#000) 128%)}
body.summoning #s2Vig.on{opacity:.42}

@media (max-width:560px){
 #s2Ladder{bottom:15%;gap:7px;padding:9px 11px 11px}
 #s2Ladder .s2-rungs{gap:6px}
 #s2Ladder .s2-rung{min-width:46px}
 #s2Ladder .s2-rung .s2-pct{font-size:11px}
 #shopPanel .s2-row{padding:9px 10px 9px 14px;gap:9px;min-height:58px}
 #shopPanel .s2-row .mk-thumb,#shopPanel .s2-row .s2-glyph{width:42px;height:42px}
 #shopPanel .s2-row .s2-title{font-size:13.5px}
}
@media (prefers-reduced-motion:reduce){
 #s2Plaque.on{animation:none}
 #s2Ladder .s2-rung{transition:none}
 #shopPanel .s2-row .s2-trail button{transition:none}
}`;
 try{
  if(!document.getElementById('s2ShopCss')){
   const st=document.createElement('style'); st.id='s2ShopCss'; st.textContent=CSS;
   (document.head||document.documentElement).appendChild(st);
  }
 }catch(e){}

 /* ========================= 2. helpers ========================= */
 const BREEDS=()=>T.BREEDS3||[];
 function breedByLabel(lbl){
  const l=String(lbl||'').trim().toLowerCase(); if(!l)return null;
  return BREEDS().find(b=>String(b[1]).toLowerCase()===l)||null;
 }
 function thumbFor(key,rar,glyph){
  if(key&&K.thumb){try{return K.thumb(key,{size:46,rarity:rar,emoji:glyph||'🐴'});}catch(e){}}
  return '<span class="s2-glyph">'+esc(glyph||'🐴')+'</span>';
 }
 /* Money a row asks for, read off the button the game already drew. */
 function costOf(trail){
  for(const el of trail){
   const t=el.textContent||'';
   if(/free/i.test(t))return null;
   let m=/([\d,]+)\s*🪙/.exec(t); if(m)return {n:+m[1].replace(/,/g,''),cur:'coins',ico:'🪙'};
   m=/([\d,]+)\s*💎/.exec(t); if(m)return {n:+m[1].replace(/,/g,''),cur:'gems',ico:'💎'};
  }
  return null;
 }

 /* ========================= 3. the shop upgrade ========================= */
 let busy=false;

 function upgradeShop(p){
  const s=G.save.fresh()||{};
  /* tab strip */
  const tabs=p.querySelector(':scope > .crow'); if(tabs)tabs.classList.add('s2-tabs');
  /* wallet */
  if(!p.querySelector('.s2-wallet')){
   const w=document.createElement('div'); w.className='s2-wallet';
   const on=p.querySelector('.s2-tabs button.on'), lbl=on?(on.textContent||'').trim():'Shop';
   w.innerHTML='<span class="s2-wallet-lbl">'+esc(lbl)+'</span>'
    +'<span class="s2-coin"><i>🪙</i>'+num(s.coins)+'</span>'
    +'<span class="s2-coin"><i>💎</i>'+num(s.gems)+'</span>'
    +((s.keys||0)?'<span class="s2-coin"><i>🔑</i>'+num(s.keys)+'</span>':'');
   if(tabs&&tabs.nextSibling)p.insertBefore(w,tabs.nextSibling); else p.insertBefore(w,p.firstChild);
  }
  /* the prose the old renderers left lying about */
  Array.from(p.children).forEach(el=>{
   if(el.classList.contains('evrow')||el.classList.contains('crow')||el.classList.contains('s2-wallet'))return;
   if(el.querySelector&&el.querySelector('.evrow,button,select'))return;
   const fs=parseFloat(el.style&&el.style.fontSize)||0;
   if(el.tagName==='DIV'&&fs>=12)el.classList.add('s2-sub');
   else if(el.tagName==='SPAN'||el.tagName==='DIV')el.classList.add('s2-foot');
  });
  /* every row */
  const rows=Array.from(p.querySelectorAll('.evrow'));
  for(const row of rows){ try{ if(!row.dataset.s2)rebuild(row,s); }catch(e){} }
  /* the summon tab lives in here too */
  const TIERS=T.SUMMON_TIERS||[];
  for(const card of Array.from(p.querySelectorAll('.sumTier'))){
   if(card.dataset.s2)continue;
   try{ banner(card,TIERS,s); }catch(e){}
  }
  /* the horses tab: group by rarity, with a header that counts what you can afford */
  try{ group(p,s); }catch(e){}
 }

 function rebuild(row,s){
  const kids=Array.from(row.childNodes);
  let lead='', titleEl=null, badges=[], meta=[], trail=[];
  for(const n of kids){
   if(n.nodeType===3){ if(!titleEl)lead+=n.textContent; else if(String(n.textContent).trim())meta.push(n); continue; }
   if(n.nodeType!==1)continue;
   const tag=n.tagName;
   if(tag==='B'&&!titleEl){titleEl=n;continue;}
   if(tag==='BUTTON'||tag==='SELECT'||tag==='INPUT'){trail.push(n);continue;}
   if(tag==='SPAN'){
    if(!meta.length&&n.style&&n.style.background){badges.push(n);continue;}
    if(!meta.length){meta.push(n);continue;}
    trail.push(n);continue;
   }
   trail.push(n);
  }
  if(!titleEl&&!meta.length&&!trail.length)return;

  const glyph=(lead.match(/\S/)?lead.trim():'')||'';
  /* who is this row about? */
  let key=null, rar=null;
  const buy=row.querySelector('[data-buyh]');
  const sell=row.querySelector('[data-mktsell]');
  const mbuy=row.querySelector('[data-mktbuy]');
  if(buy){const b=BREEDS()[+buy.dataset.buyh]; if(b){key=b[0];rar=b[2];}}
  else if(sell){
   const h=(s.horses||[])[+sell.dataset.mktsell];
   if(h){key=h.breed; const b=BREEDS().find(x=>x[0]===h.breed); if(b)rar=b[2];}
  }else if(mbuy||/·\s*Lv\s*\d/.test(row.textContent)){
   const txt=meta.length?(meta[0].textContent||''):'';
   const b=breedByLabel(txt.split('·')[0]);
   if(b){key=b[0];rar=b[2];}
  }
  const isHorse=!!key;
  if(!rar)rar=isHorse?'Common':null;

  const cost=costOf(trail);
  const have=cost?(cost.cur==='gems'?(s.gems||0):(s.coins||0)):0;
  const short=cost&&have<cost.n?cost.n-have:0;
  const disabled=trail.some(t=>t.tagName==='BUTTON'&&t.disabled);

  const wrap=document.createElement('div'); wrap.className='s2-copy';
  const ttl=document.createElement('div'); ttl.className='s2-title';
  if(titleEl)ttl.appendChild(titleEl);
  else{const b=document.createElement('b'); b.textContent=glyph?'':''; ttl.appendChild(b);}
  if(rar){
   const pill=document.createElement('span'); pill.className='s2-rar';
   pill.innerHTML='<span aria-hidden="true">'+(RAR_GLYPH[rar]||'•')+'</span>'+esc(rar);
   ttl.appendChild(pill);
  }
  /* the pill already says the rarity — a legacy gradient badge that says it again goes */
  badges.forEach(b=>{
   const txt=(b.textContent||'').replace(/[^a-z]/gi,'').toLowerCase();
   if(rar&&txt===String(rar).toLowerCase())return;
   ttl.appendChild(b);
  });
  wrap.appendChild(ttl);
  if(meta.length){
   const m=document.createElement('div'); m.className='s2-meta';
   meta.forEach(x=>m.appendChild(x));
   if(rar)stripRarity(m,rar);
   wrap.appendChild(m);
  }

  const tr=document.createElement('div'); tr.className='s2-trail';
  const tRow=document.createElement('div'); tRow.className='s2-trail-row';
  trail.forEach(x=>tRow.appendChild(x));
  tr.appendChild(tRow);
  if(short){
   const n=document.createElement('span'); n.className='s2-need';
   n.textContent='need '+num(short)+' more '+cost.ico;
   tr.appendChild(n);
  }

  row.textContent='';
  row.classList.add('s2-row');
  row.style.setProperty('--rar',colOf(rar||'Common'));
  row.style.setProperty('--rar-ink',inkOf(rar||'Common'));
  if(rar&&RAR_ORDER.indexOf(rar)>=4)row.classList.add('s2-hi');
  const locked=!trail.length;
  if(locked)row.classList.add('s2-locked');
  else if(short||disabled)row.classList.add('s2-cant');
  if(sell)row.classList.add('s2-sell');
  if(row.style.opacity){row.style.opacity='';if(locked)row.classList.add('s2-locked');}

  const th=document.createElement('div');
  th.innerHTML=isHorse?thumbFor(key,rar,glyph||'🐴')
                      :'<span class="s2-glyph">'+esc(glyph||'🎁')+'</span>';
  const thumb=th.firstElementChild; if(thumb)row.appendChild(thumb);
  row.appendChild(wrap);
  row.appendChild(tr);
  row.dataset.s2='1';
  row.dataset.s2rar=rar||'';
 }

 /* The row's meta used to open by repeating the rarity word the pill now carries. */
 function stripRarity(el,rar){
  try{
   const re=new RegExp('^\\s*(?:·\\s*)?'+rar+'\\s*(?:·\\s*)?','i');
   const walk=document.createTreeWalker(el,NodeFilter.SHOW_TEXT,null);
   while(walk.nextNode()){
    const n=walk.currentNode;
    const v=String(n.nodeValue);
    if(!v.trim())continue;
    if(/^[\s\u2b50\u2605\u2606\u00b7]+$/.test(v.trim()))continue;   // the star run is not the word
    const cut=v.replace(re,' ');          // keep the space the stars need
    if(cut!==v)n.nodeValue=cut;
    return;                                   // only the first worded run may open with it
   }
  }catch(e){}
 }

 /* Rarity sections, only where a list is genuinely a catalogue of horses. */
 function group(p,s){
  const rows=Array.from(p.querySelectorAll('.evrow[data-s2]')).filter(r=>r.querySelector('[data-buyh]'));
  if(rows.length<4||p.querySelector('.s2-head'))return;
  const by={};
  rows.forEach(r=>{const k=r.dataset.s2rar||'Common';(by[k]=by[k]||[]).push(r);});
  /* a marker holds the place BEFORE the rows are lifted out of the document */
  const mark=document.createComment('s2-groups');
  rows[0].parentNode.insertBefore(mark,rows[0]);
  const frag=document.createDocumentFragment();
  for(const rar of RAR_ORDER){
   const list=by[rar]; if(!list||!list.length)continue;
   const afford=list.filter(r=>!r.classList.contains('s2-cant')).length;
   const h=document.createElement('div'); h.className='s2-head';
   h.style.setProperty('--rar',colOf(rar));
   h.innerHTML='<span class="s2-h-name"><i class="s2-h-dot"></i>'+esc(rar)+'</span>'
    +'<span class="s2-h-n">'+list.length+' breed'+(list.length===1?'':'s')+' · '
    +(afford?'<b>'+afford+' affordable</b>':'none affordable yet')+'</span>';
   frag.appendChild(h);
   list.forEach(r=>frag.appendChild(r));
  }
  if(mark.parentNode)mark.parentNode.insertBefore(frag,mark);
  if(mark.parentNode)mark.parentNode.removeChild(mark);
 }

 /* ========================= 4. the summoning stall ========================= */
 const S_ORDER=(G.summon&&G.summon.ORDER)||['Common','Uncommon','Rare','Epic','Legendary'];
 let lastTier=null;

 function upgradeSummon(p){
  const s=G.save.fresh()||{};
  const tiers=Array.from(p.querySelectorAll('.sumTier'));
  if(!tiers.length)return;
  /* the wallet line, so a price has something to be measured against */
  if(!p.querySelector('.s2-wallet')){
   const head=p.querySelector('.panelHeader,.ph');
   const w=document.createElement('div'); w.className='s2-wallet';
   w.innerHTML='<span class="s2-wallet-lbl">Your gems</span>'
    +'<span class="s2-coin"><i>💎</i>'+num(s.gems)+'</span>'
    +((s.keys||0)?'<span class="s2-coin"><i>🔑</i>'+num(s.keys)+'</span>':'');
   const host=(head&&head.parentNode)||p;
   if(head&&head.nextSibling)host.insertBefore(w,head.nextSibling); else host.insertBefore(w,host.firstChild);
  }
  const TIERS=T.SUMMON_TIERS||[];
  for(const card of tiers){
   if(card.dataset.s2)continue;
   try{ banner(card,TIERS,s); }catch(e){}
  }
 }

 function banner(card,TIERS,s){
  const btn=card.querySelector('[data-summon],[data-fx]');
  let tid=btn&&btn.dataset?(btn.dataset.summon||''):'';
  if(!tid&&btn&&btn.dataset&&btn.dataset.fx){const f=btn.dataset.fx.split(':');tid=f[f.length-1];}
  const t=tid?TIERS.find(x=>x.id===tid):null;
  if(!t){card.dataset.s2='1';return;}
  const odds=t.odds||{};
  const keys=S_ORDER.filter(k=>(odds[k]||0)>0);
  const total=keys.reduce((a,k)=>a+odds[k],0)||100;
  let best=keys[0]; for(const k of keys)if(S_ORDER.indexOf(k)>S_ORDER.indexOf(best))best=k;
  /* the card's colour is the banner's HEADLINE — the best rarity you have a real (>=10%)
     chance at — so the three calls read as a ladder instead of all wearing their long shot */
  let lead=keys[0];
  for(const k of keys)if(odds[k]>=10&&S_ORDER.indexOf(k)>S_ORDER.indexOf(lead))lead=k;
  const top=colOf(lead);
  const cost=+t.gems||0, gems=s.gems||0, short=gems<cost?cost-gems:0;
  const extra=card.querySelector('.summonCardSect,[data-sect]');   // whatever a package spliced in

  const meter=keys.map(k=>'<i style="width:'+(odds[k]/total*100).toFixed(2)+'%;background:'+colOf(k)+'"></i>').join('');
  const chips=keys.map(k=>'<span class="s2-odd'+(k===best?' s2-odd-best':'')+'" style="--oc:'+colOf(k)+';--oi:'+inkOf(k)+'">'
    +esc(k)+' <u>'+odds[k]+'%</u></span>').join('');

  const head=document.createElement('div'); head.className='s2-b-head';
  head.innerHTML='<span aria-hidden="true" style="font-size:20px;line-height:1">'+esc(t.emoji||'✨')+'</span>'
   +'<span class="s2-b-name">'+esc(t.label||'Call')+'</span>'
   +'<span class="s2-b-cost'+(short?' s2-cant-cost':'')+'">💎 '+num(cost)+'</span>';
  const blurb=document.createElement('div'); blurb.className='s2-b-blurb'; blurb.textContent=t.blurb||'';
  const mt=document.createElement('div'); mt.className='s2-meter'; mt.innerHTML=meter;
  mt.setAttribute('role','img');
  mt.setAttribute('aria-label',keys.map(k=>k+' '+odds[k]+' percent').join(', '));
  const od=document.createElement('div'); od.className='s2-odds'; od.innerHTML=chips;
  const foot=document.createElement('div'); foot.className='s2-b-foot';

  card.textContent='';
  card.classList.add('s2-banner');
  card.style.setProperty('--rar',top);
  card.style.setProperty('--rar-ink',inkOf(lead));
  card.appendChild(head); if(t.blurb)card.appendChild(blurb);
  card.appendChild(mt); card.appendChild(od);
  if(extra)card.appendChild(extra);
  foot.appendChild(btn);
  if(short){
   const n=document.createElement('span'); n.className='s2-need';
   n.textContent='need '+num(short)+' more 💎';
   foot.appendChild(n);
  }
  card.appendChild(foot);
  card.dataset.s2='1';
  /* remember which banner was called, so the reveal can quote its odds */
  btn.addEventListener('click',()=>{lastTier=t;},true);
 }

 /* ---- the reveal: a ladder of rungs that lights as the stall light climbs ---- */
 let ladder=null, plaque=null, vig=null, builtFor=null, litAt=-2, wasOn=false;
 function fx(){ return document.getElementById('summonFx'); }
 function ensureFx(){
  const host=fx(); if(!host)return false;
  if(!vig||!vig.isConnected){vig=document.createElement('div');vig.id='s2Vig';host.insertBefore(vig,host.firstChild);}
  if(!ladder||!ladder.isConnected){ladder=document.createElement('div');ladder.id='s2Ladder';host.appendChild(ladder);}
  if(!plaque||!plaque.isConnected){plaque=document.createElement('div');plaque.id='s2Plaque';host.appendChild(plaque);}
  return true;
 }
 function buildLadder(t){
  const odds=(t&&t.odds)||{};
  const keys=S_ORDER.filter(k=>(odds[k]||0)>0);
  const use=keys.length?keys:S_ORDER;
  ladder.innerHTML='<span class="s2-cap">'+esc((t&&t.label)||'The call')+' · your odds</span>'
   +'<span class="s2-rungs">'+use.map(k=>'<span class="s2-rung" data-r="'+esc(k)+'" style="--rc:'+colOf(k)+'">'
     +'<span class="s2-pct">'+(odds[k]!=null?odds[k]+'%':'—')+'</span>'
     +'<span class="s2-lamp"></span>'
     +'<span class="s2-rn">'+esc(k)+'</span></span>').join('')+'</span>';
  builtFor=t;
 }
 function tickFx(){
  const st=G.summon&&G.summon.state; if(!st)return;
  if(!st.on){
   if(wasOn){ wasOn=false; litAt=-2;
    if(ladder)ladder.classList.remove('on');
    if(plaque)plaque.classList.remove('on');
    if(vig)vig.classList.remove('on'); }
   return;
  }
  if(!ensureFx())return;
  const t=st.tier||lastTier;
  if(!wasOn||builtFor!==t){ wasOn=true; litAt=-2; buildLadder(t); ladder.classList.add('on');
   plaque.classList.remove('on'); vig.classList.remove('on'); }
  const shown=st.shown||'Common';
  const step=st.step==null?-1:st.step;
  if(step===litAt)return;
  litAt=step;
  const rungs=ladder.querySelectorAll('.s2-rung');
  const idx=S_ORDER.indexOf(shown);
  rungs.forEach(r=>{ r.classList.toggle('lit', step>=0 && S_ORDER.indexOf(r.dataset.r)<=idx); });
  const col=colOf(shown);
  vig.style.setProperty('--rc',col);
  if(step>=0)vig.classList.add('on');
  /* the answer, the instant it stops climbing */
  const rar=st.rar;
  if(rar&&shown===rar&&step>=0){
   const pct=t&&t.odds?t.odds[rar]:null;
   plaque.style.color='#fff8ea';
   plaque.innerHTML='<span style="color:'+col+'">'+esc(rar)+'</span> · '
    +(pct!=null?esc(pct)+'% chance on the '+esc((t&&t.label)||'call'):'a rare answer');
   plaque.classList.add('on');
  }
 }
 G.on('tick',()=>{ try{ tickFx(); }catch(e){} });

 /* ========================= 5. wiring ========================= */
 function run(p,fn){
  if(!p||busy)return;
  busy=true;
  try{ fn(p); }catch(e){ console.error('ui2-shop',e); }
  setTimeout(()=>{busy=false;},0);
 }
 function watch(pid,fn){
  const p=document.getElementById(pid); if(!p)return;
  try{
   new MutationObserver(()=>{ run(p,fn); }).observe(p,{childList:true});
  }catch(e){}
  if(p.children.length)run(p,fn);
 }
 watch('shopPanel',upgradeShop);
 watch('summonPanel',upgradeSummon);

 /* Headless checks read this. */
 G.ui2shop={ramp:RAR_COL,order:RAR_ORDER,
  rows:()=>document.querySelectorAll('#shopPanel .s2-row').length,
  banners:()=>document.querySelectorAll('#summonPanel .s2-banner,#shopPanel .s2-banner').length};
}

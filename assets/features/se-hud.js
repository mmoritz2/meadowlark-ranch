/* Feature package 'se-hud' — the dashboard laid out the way a mobile riding game lays it out.

   The owner asked for one thing above everything else: that this game LOOK like Star Equestrian.
   The first thing anybody sees is the HUD, and ours was the part that looked least like it — a
   web app's cream tab bar across the bottom of the screen, a white horse card in one corner, a
   white strip of currencies in the other, a minimap in the wrong corner and a line of keyboard
   hints under everything. The riding game it is measured against has none of that. It floats a
   handful of dark glass controls over the world and lets the world be the screen:

     top left      a round ☰, a large circular map with a north tick, and a cluster of hexagon
                   shortcuts wrapped round it — journal, club, ranks, stable, horse, events
     top right     two dark currency pills with big coin and gem discs, and a gold hexagon for
                   the market beneath them
     left edge     the current objective, with a "!" tab
     bottom left   a thumbstick
     bottom right  a big diamond for the main action, and round buttons for emote, whistle,
                   photo

   Everything here is original: the icons are drawn below as plain line art, the layout is a
   genre convention rather than anybody's artwork, and nothing is named or branded after the
   game it takes its cue from.

   HOW. This file owns presentation only, from the outside, in the same spirit as ui2-hud (which
   it installs after and builds on). Every real control is MOVED, never rebuilt: #questBtn,
   #shopBtn, #stableBtn and the rest keep their ids, their onclick handlers and their
   notification pips, so the game, every package and every QA script that clicks them by id go
   on working. The bottom dock is emptied into the ☰ menu and the hex cluster, then hidden.
   Photo mode, free camera and the summoning cut-scene hide all of it, as they hid the dock.
   Each step is its own try/catch: a shape this file did not expect is left alone. */
export const id='se-hud';
export function install(G){
 const $=id=>document.getElementById(id);
 if(!document.body||!$('hud'))return;

 /* ---------------------------------------------------------------- icons (original) ------ */
 const INK='#f6ecd2', GLASS='rgba(18,22,36,0.46)', RIM='rgba(246,236,210,0.82)';
 const I={
  journal:'<path d="M4 5.5c2.6-1.1 5.2-.9 8 1v12c-2.8-1.9-5.4-2.1-8-1zM20 5.5c-2.6-1.1-5.2-.9-8 1v12c2.8-1.9 5.4-2.1 8-1z"/>',
  club:'<circle cx="9" cy="8" r="3"/><path d="M3.5 19c.6-3.1 2.8-4.6 5.5-4.6s4.9 1.5 5.5 4.6M15.8 5.4a2.6 2.6 0 0 1 0 5.2M17 14.4c2.1.4 3.4 1.9 3.9 4.4"/>',
  ranks:'<path d="M8 4h8v4.5a4 4 0 0 1-8 0zM8 6H5.2a2.8 2.8 0 0 0 3.1 3.9M16 6h2.8a2.8 2.8 0 0 1-3.1 3.9M12 12.5V16M9 20h6M10 16h4v4h-4z"/>',
  stable:'<path d="M3 11l9-6 9 6M5 10v10h14V10M9 20v-6h6v6M9 14l6 6M15 14l-6 6"/>',
  horse:'<path d="M8.5 20v-4.6C6.4 14.2 5.4 12 6 9.6L7.3 5l1.9 1.8 1.9-2.6c3.1.6 5.8 3.1 6.4 6.6l1.6 3.1-2.1 1.5-2-1.1c-1 .9-2.1 1.4-3.1 1.4V20"/><path d="M11.5 9.3h.01"/>',
  events:'<path d="M4 6v14M20 6v14M4 10.5h16M4 15h16M3 6h2M19 6h2"/>',
  market:'<path d="M4 9h16l-1.6-4H5.6zM4 9c0 1.5 1.2 2.6 2.7 2.6S9.3 10.5 9.3 9c0 1.5 1.2 2.6 2.7 2.6s2.7-1.1 2.7-2.6c0 1.5 1.2 2.6 2.6 2.6S20 10.5 20 9M5.6 11.6V20h12.8v-8.4M10 20v-5h4v5"/>',
  emote:'<circle cx="12" cy="12" r="8.6"/><path d="M8 13.6c1 1.6 2.3 2.4 4 2.4s3-.8 4-2.4"/><circle cx="9.1" cy="9.8" r=".9" fill="'+INK+'"/><circle cx="14.9" cy="9.8" r=".9" fill="'+INK+'"/>',
  whistle:'<path d="M3 13.2a5 5 0 0 0 9.6 2L21 11.2V8H9.6A5 5 0 0 0 3 13.2zM14.2 8V5.6h3.2"/><circle cx="8" cy="13.2" r="1.1" fill="'+INK+'"/>',
  photo:'<path d="M4 8h3.2l1.5-2h6.6L16.8 8H20v11H4z"/><circle cx="12" cy="13.4" r="3.4"/>',
  jump:'<path d="M4.5 20v-5.5M19.5 20v-5.5M4.5 16h15M5.5 11.5c2.3-5.4 10.7-5.4 13 0"/><path d="M16.2 9.3l2.3 2.2 2.6-1.3"/>',
  fly:'<path d="M12 14c-3.5-5-7.5-6-9-6 1 4.5 4 7 9 7s8-2.5 9-7c-1.5 0-5.5 1-9 6zM12 15v5"/>',
  breathe:'<path d="M12 21c-3.7 0-6-2.6-6-5.8 0-3.5 3-5 3.8-9.2 1.8 1.4 2.4 3.2 2.2 5 1-.8 1.7-2.1 1.8-3.6 2.3 1.9 4.2 4.6 4.2 7.8 0 3.2-2.3 5.8-6 5.8z"/>'
 };
 const g=(p,dx,dy,s,sw,col)=>'<g transform="translate('+dx+' '+dy+') scale('+s+')" fill="none" stroke="'+(col||INK)+'" stroke-width="'+sw+'" stroke-linecap="round" stroke-linejoin="round">'+p+'</g>';
 const uri=svg=>'url("data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg)+'")';
 const HEX='M15 2H45L58 26L45 50H15L2 26Z';
 const hexSvg=k=>uri('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 52"><path d="'+HEX+'" fill="'+GLASS+'" stroke="'+RIM+'" stroke-width="2"/>'+g(I[k],18,14,1,1.85)+'</svg>');
 const marketSvg=uri('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 52"><defs><linearGradient id="a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f7d97a"/><stop offset=".55" stop-color="#e2ad37"/><stop offset="1" stop-color="#b87e1c"/></linearGradient></defs><path d="'+HEX+'" fill="url(#a)" stroke="#6b430d" stroke-width="2.4"/><path d="M17 6H43L54 26L43 46H17L6 26Z" fill="none" stroke="rgba(255,244,210,.55)" stroke-width="1.2"/>'+g(I.market,17,12.5,1.08,2,'#5a3708')+'</svg>');
 const roundSvg=(k,s)=>uri('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><circle cx="24" cy="24" r="22" fill="'+GLASS+'" stroke="'+RIM+'" stroke-width="2"/>'+g(I[k],24-12*s,24-12*s,s,1.9/s*1.05)+'</svg>');
 const diamondSvg=k=>uri('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><path d="M60 4L116 60L60 116L4 60Z" fill="'+GLASS+'" stroke="'+RIM+'" stroke-width="2.6"/><path d="M60 13L107 60L60 107L13 60Z" fill="none" stroke="rgba(246,236,210,.38)" stroke-width="1.4"/>'+g(I[k],60-12*2.1,60-12*2.1,2.1,1.55)+'</svg>');

 /* ---------------------------------------------------------------- the look ------------- */
 const css=document.createElement('style'); css.id='seHudCss';
 css.textContent=`
body.se-hud{--se-ink:${INK};--se-glass:${GLASS};--se-rim:${RIM};--se-gold:#e6b544}
/* the old furniture steps out of the way */
body.se-hud #dock,body.se-hud #hint{display:none!important}
body.se-hud #statusCard{display:none!important}
body.se-hud #sysBtns{display:none!important}
body.se-hud #hud{position:fixed;top:calc(14px + env(safe-area-inset-top));right:calc(16px + env(safe-area-inset-right));left:auto;
 background:none!important;border:0!important;box-shadow:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;padding:0!important;gap:0!important}
body.se-hud #hud::before,body.se-hud #hud::after{display:none!important}
/* currency: dark glass pills, the disc sitting proud of the left end */
body.se-hud #wallet{display:flex!important;gap:12px!important;background:none!important;border:0!important;box-shadow:none!important;padding:0!important;backdrop-filter:none!important}
body.se-hud #wallet .w{position:relative;display:flex!important;align-items:center;height:28px;min-width:98px;padding:0 14px 0 30px!important;margin-left:14px;
 border-radius:14px!important;background:rgba(20,20,30,.58)!important;border:1.5px solid rgba(255,255,255,.55)!important;box-shadow:0 2px 8px rgba(0,0,0,.25)!important;
 color:#fff!important;font:800 15px/1 Nunito,system-ui,sans-serif!important;letter-spacing:.2px}
body.se-hud #wallet .w>b{margin-left:auto;font-variant-numeric:tabular-nums;color:#fff!important}
body.se-hud #wallet .w>i{position:absolute;left:-15px;top:50%;transform:translateY(-50%);width:38px;height:38px;border-radius:50%;
 display:flex!important;align-items:center;justify-content:center;font-style:normal;font-size:22px;
 background:radial-gradient(circle at 35% 30%,#fff3c4,#f0bf45 45%,#b77d17);border:2px solid #7a4d10;box-shadow:0 2px 6px rgba(0,0,0,.35)}
body.se-hud #wallet .w:nth-child(2)>i{background:radial-gradient(circle at 35% 30%,#ffd9ee,#e2549a 50%,#8f1d57);border-color:#5e1038}
body.se-hud #wallet .w.mk-w-empty{display:none!important}
body.se-hud #wallet .w:not(:nth-child(1)):not(:nth-child(2)){display:none!important}
/* the map: a big clear disc with a north tick, top left */
body.se-hud #mkMiniPlate,body.se-hud #mini{position:fixed!important;left:calc(58px + env(safe-area-inset-left))!important;top:calc(20px + env(safe-area-inset-top))!important;right:auto!important;bottom:auto!important}
body.se-hud #mkMiniPlate{width:130px!important;height:130px!important;padding:0!important;border-radius:50%!important;background:none!important;border:0!important;box-shadow:none!important}
body.se-hud #mini{width:130px!important;height:130px!important;border-radius:50%!important;border:4px solid #efe6cf!important;box-shadow:0 3px 12px rgba(0,0,0,.35),inset 0 0 0 1px rgba(0,0,0,.25)!important}
body.se-hud #mkMiniPlate #mini{left:0!important;top:0!important;position:relative!important}
body.se-hud #seNorth{position:fixed;left:calc(58px + 65px - 9px + env(safe-area-inset-left));top:calc(20px - 9px + env(safe-area-inset-top));width:18px;height:18px;border-radius:50%;
 background:#efe6cf;color:#3a2a12;font:900 11px/18px Nunito,system-ui,sans-serif;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,.35);z-index:7;pointer-events:none}
body.se-hud #vrBtn{display:none!important}
body.se-hud #toasts{top:calc(96px + env(safe-area-inset-top))!important;bottom:auto!important;left:50%!important;right:auto!important;transform:translateX(-50%);align-items:center!important;width:min(420px,calc(100vw - 32px))!important}
/* the root every floating control hangs off */
/* the layers the old HUD used: the dock sat at 6 and every panel (10) and dialog (11) covered it,
   so a panel opened over the controls hides them instead of wearing a hexagon on its corner */
#seHudRoot{position:fixed;inset:0;pointer-events:none;z-index:6}
#seHudRoot>*{pointer-events:auto}
/* round ☰ */
#seMenuBtn{position:fixed;left:calc(12px + env(safe-area-inset-left));top:calc(14px + env(safe-area-inset-top));width:46px;height:46px;border-radius:50%!important;box-shadow:0 2px 6px rgba(0,0,0,.3)!important;min-width:0!important;
 border:2px solid var(--se-rim);background:var(--se-glass);cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0}
#seMenuBtn i{display:block;width:20px;height:2.6px;border-radius:2px;background:var(--se-ink);box-shadow:0 -6.5px 0 var(--se-ink),0 6.5px 0 var(--se-ink)}
#seMenuBtn .se-pip{position:absolute;top:-3px;right:-3px}
/* hexagon shortcuts. The real button IS the hexagon: its words go, its pip stays. */
.se-hexbtn{position:fixed!important;width:54px!important;height:47px!important;min-width:0!important;min-height:0!important;padding:0!important;margin:0!important;
 border:0!important;border-radius:0!important;background-color:transparent!important;background-position:center!important;background-size:contain!important;background-repeat:no-repeat!important;box-shadow:none!important;
 font-size:0!important;color:transparent!important;cursor:pointer;filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))}
.se-hexbtn::before,.se-hexbtn::after{content:none!important;display:none!important}
.se-hexbtn:hover{filter:drop-shadow(0 2px 3px rgba(0,0,0,.35)) brightness(1.18)}
.se-hexbtn:focus-visible{outline:2px solid var(--se-gold);outline-offset:2px}
.se-hexbtn .pip,.se-hexbtn .badge,.se-pip{position:absolute!important;top:-2px!important;right:2px!important;min-width:19px;height:19px;padding:0 5px;border-radius:10px;
 background:#e0332f!important;color:#fff!important;border:1.5px solid #fff!important;font:900 11px/16px Nunito,system-ui,sans-serif!important;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,.4)}
.se-hexbtn .pip:empty{min-width:12px;width:12px;height:12px;padding:0}
.se-lvl{position:absolute;left:-2px;bottom:-4px;width:22px;height:25px;font:900 12px/24px Nunito,system-ui,sans-serif;color:#fff;text-align:center;
 background:center/contain no-repeat url("data:image/svg+xml;charset=utf-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 22 25"><path d="M11 1L20.5 4.5V12c0 6-4.2 9.8-9.5 12C5.7 21.8 1.5 18 1.5 12V4.5z" fill="#3f63b8" stroke="#e9eefc" stroke-width="1.6"/></svg>')}");text-shadow:0 1px 1px rgba(0,0,0,.45)}
.se-hexbtn.se-alert::after{content:""!important;display:block!important;position:absolute;top:0;right:4px;width:13px;height:13px;border-radius:50%;background:#e0332f;border:1.5px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.4)}
/* the market: gold, a size up, with its name beneath */
.se-market{width:66px!important;height:57px!important;filter:drop-shadow(0 3px 5px rgba(0,0,0,.45))!important}
#seMarketLbl{position:fixed;width:84px;text-align:center;font:900 12px/1 Nunito,system-ui,sans-serif;color:#f3cf6a;letter-spacing:.6px;background:rgba(20,20,30,.66);border-radius:8px;padding:3px 0;
 text-shadow:0 1px 0 #5a3708,0 0 3px rgba(0,0,0,.65);pointer-events:none;z-index:6}
/* the objective on the left edge */
body.se-hud #questTrack:empty{display:none!important}
body.se-hud #questTrack{display:block!important;position:fixed!important;left:0!important;right:auto!important;top:calc(236px + env(safe-area-inset-top))!important;transform:none!important;
 max-width:min(300px,42vw)!important;height:auto!important;min-height:0!important;padding:7px 14px 7px 30px!important;margin:0!important;
 border:0!important;border-radius:0 8px 8px 0!important;background:linear-gradient(90deg,rgba(15,18,30,.62),rgba(15,18,30,.34))!important;box-shadow:none!important;
 color:#fff!important;font:800 15px/1.2 Nunito,system-ui,sans-serif!important;white-space:normal!important;text-align:left!important;
 text-shadow:0 1px 2px rgba(0,0,0,.6);opacity:1!important}
body.se-hud #questTrack::before{content:"!";position:absolute;left:0;top:0;bottom:0;width:20px;display:flex;align-items:center;justify-content:center;
 background:rgba(15,18,30,.8);color:#f3cf6a;font:900 16px/1 Nunito,system-ui,sans-serif}
/* the thumbstick: always there, bottom left, and only as big as it looks */
body.se-hud #stickZone{display:block!important;left:0!important;bottom:0!important;width:300px!important;height:300px!important;z-index:6!important}
body.se-hud #stickBase{left:150px;top:150px;width:206px!important;height:206px!important;margin:-103px 0 0 -103px!important;opacity:.92!important;
 border:2.5px solid rgba(246,236,210,.7)!important;background:rgba(18,22,36,.18)!important;box-shadow:none!important}
body.se-hud #stickBase::before,body.se-hud #stickBase::after{content:"";position:absolute;left:50%;top:50%;width:8px;height:8px;margin:-4px;border-radius:50%;background:rgba(246,236,210,.75)}
body.se-hud #stickBase::before{transform:translate(0,-92px);box-shadow:0 184px 0 rgba(246,236,210,.75)}
body.se-hud #stickBase::after{transform:translate(-92px,0);box-shadow:184px 0 0 rgba(246,236,210,.75)}
body.se-hud #stickKnob{left:150px;top:150px;width:90px!important;height:90px!important;margin:-45px 0 0 -45px!important;opacity:.95!important;
 border:0!important;background:radial-gradient(circle at 42% 36%,#f3f3f3,#c9c9c9 70%,#a9a9a9)!important;box-shadow:0 4px 10px rgba(0,0,0,.35)!important}
/* actions, bottom right */
.se-act{position:fixed;border:0!important;padding:0!important;min-width:0!important;min-height:0!important;box-shadow:none!important;border-radius:0!important;outline:none;background-color:transparent!important;background-position:center!important;background-size:contain!important;background-repeat:no-repeat!important;cursor:pointer;filter:drop-shadow(0 2px 4px rgba(0,0,0,.35));touch-action:none;-webkit-user-select:none;user-select:none}
.se-act:hover{filter:drop-shadow(0 2px 4px rgba(0,0,0,.35)) brightness(1.15)}
.se-act:active{transform:scale(.94)}
#seJump{width:150px;height:150px;right:calc(128px + env(safe-area-inset-right));bottom:calc(112px + env(safe-area-inset-bottom))}
#seEmote{width:56px;height:56px;right:calc(276px + env(safe-area-inset-right));bottom:calc(72px + env(safe-area-inset-bottom))}
#seWhistle{width:70px;height:70px;right:calc(66px + env(safe-area-inset-right));bottom:calc(66px + env(safe-area-inset-bottom))}
body.se-hud #photoBtn.se-act{width:38px!important;height:38px!important;min-width:0!important;right:calc(64px + env(safe-area-inset-right));bottom:calc(18px + env(safe-area-inset-bottom));
 font-size:0!important;border:0!important;box-shadow:none!important;border-radius:50%!important}
body.se-hud #flyBtn.se-act,body.se-hud #breathBtn.se-act{width:60px!important;height:60px!important;min-width:0!important;right:calc(292px + env(safe-area-inset-right));
 font-size:0!important;border:0!important;box-shadow:none!important;border-radius:50%!important;padding:0!important}
body.se-hud #flyBtn.se-act{bottom:calc(150px + env(safe-area-inset-bottom))}
body.se-hud #breathBtn.se-act{bottom:calc(222px + env(safe-area-inset-bottom))}
/* ☰ opens the game's main menu: a sheet of parchment tiles under a purple bar */
#seMenu{position:fixed;inset:0;display:none;align-items:center;justify-content:center;z-index:60;background:rgba(8,6,20,.55);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px)}
#seMenu.on{display:flex}
#seMenu .se-sheet{width:min(940px,94vw);max-height:88vh;display:flex;flex-direction:column;border-radius:14px;overflow:hidden;
 box-shadow:0 18px 60px rgba(0,0,0,.55);background:#2b1f57}
#seMenu .se-bar{display:flex;align-items:center;gap:12px;padding:10px 14px;background:linear-gradient(180deg,#5c3fa8,#3e2a82);border-bottom:2px solid #c9a24a}
#seMenu .se-bar b{font:900 19px/1 Nunito,system-ui,sans-serif;color:#fff;letter-spacing:.3px}
#seMenu .se-bar small{font:700 12px/1 Nunito,system-ui,sans-serif;color:#d9ccff}
#seMenu .se-x{margin-left:auto;width:38px;height:38px;border-radius:50%;border:2px solid #fff;background:#3b2a77;color:#fff;font:900 18px/1 system-ui;cursor:pointer}
#seMenu .se-tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;padding:16px;overflow:auto;
 background:linear-gradient(180deg,#3a2877,#2a1d5a)}
#seMenu .se-tiles>button{position:relative;display:flex!important;flex-direction:column;align-items:center;justify-content:center;gap:8px;height:118px!important;min-height:0!important;width:auto!important;
 padding:10px 8px!important;border-radius:10px!important;border:2px solid #c9a86a!important;cursor:pointer;
 background:linear-gradient(180deg,#f6ecd3,#e7d6b1)!important;box-shadow:inset 0 0 0 1px rgba(255,255,255,.6),0 3px 0 #9c7b43!important;
 color:#5a3b17!important;font:900 42px/1 Nunito,system-ui,sans-serif!important;text-align:center}
/* the bare emoji is the tile's picture; the label under it is set small, in caps */
#seMenu .se-tiles>button .mk-dk-lbl,#seMenu .se-tiles>button[data-se-lbl]::after{display:block!important;font:900 14.5px/1.15 Nunito,system-ui,sans-serif!important;
 text-transform:uppercase;letter-spacing:.35px;color:#5a3b17;white-space:normal}
#seMenu .se-tiles>button[data-se-lbl]::after{content:attr(data-se-lbl)!important;position:static!important}
#seMenu .se-tiles>button:hover{background:linear-gradient(180deg,#fff6df,#efe0bd)!important}
#seMenu .se-tiles>button.mk-dk-raw{font-size:0!important}
#seMenu .se-tiles>button.mk-dk-raw::before{content:attr(data-mk-glyph)!important;font-size:34px!important;line-height:1!important;display:block!important}
#seMenu .se-tiles>button.mk-dk-raw::after{content:attr(data-mk-label)!important;font:900 15px/1.1 Nunito,system-ui,sans-serif!important;display:block!important;position:static!important}
#seMenu .se-tiles>button .pip,#seMenu .se-tiles>button .badge{position:absolute!important;top:6px!important;right:6px!important;min-width:20px;height:20px;border-radius:10px;
 background:#e0332f!important;color:#fff!important;border:1.5px solid #fff!important;font:900 11px/17px Nunito,system-ui,sans-serif!important}
#seMenu .se-tiles>button[style*="display: none"],#seMenu .se-tiles>button[style*="display:none"]{display:none!important}
/* riding an event: the reference keeps the view clear — the course readout, the map, the stick and the jump button, and
   nothing else. The menus, the market, the wallet, the quest line and the side buttons step out of the way, and
   messages drop below the horse instead of lying across the course readout at the top */
body.se-course .se-hexbtn,body.se-course #seMenuBtn,body.se-course #seMarketLbl,body.se-course #hud,body.se-course #questTrack,body.se-course #seEmote,
body.se-course #seWhistle,body.se-course #seMount,body.se-course #photoBtn,body.se-course #seWay,body.se-course #ctx,body.se-course #chatBar,body.se-course #chatTabs{display:none!important}
/* the chat line sat on the thumbstick (bottom 110px, right over the knob). It goes above the stick's zone, gets a close of
   its own (and Escape, below), and steps out of the way of an event like everything else above */
body.se-hud #chatBar{bottom:calc(318px + env(safe-area-inset-bottom))!important;align-items:center;width:min(420px,calc(100vw - 32px))!important}
body.se-hud #chatBar input{min-width:0}
body.se-hud #chatTabs{bottom:calc(360px + env(safe-area-inset-bottom))!important}
#seChatX{flex:none;width:34px!important;height:34px!important;min-width:0!important;min-height:0!important;padding:7px!important;border-radius:50%!important;display:flex;align-items:center;justify-content:center;
 background:var(--se-glass)!important;border:2px solid var(--se-rim)!important;color:var(--se-ink)!important;box-shadow:0 2px 6px rgba(0,0,0,.3)!important;cursor:pointer}
#seChatX svg{width:100%;height:100%;display:block}
/* the old touch row (gallop, sprint, trick, jump, emote) was a grid laid over the new jump, emote and whistle. The two it
   duplicates go; the three toggles only a touch screen has stand in one column up the right edge, clear of everything */
body.se-hud #tJump,body.se-hud #tEmote,body.se-hud #tEmoteBar{display:none!important}
body.se-hud.touch:not(.freecam):not(.summoning):not(.posing) #touch{display:flex!important;flex-direction:column-reverse;gap:10px;left:auto!important;top:auto!important;right:calc(18px + env(safe-area-inset-right))!important;bottom:calc(292px + env(safe-area-inset-bottom))!important}
body.se-hud #touch button{width:52px!important;height:52px!important;min-width:0!important;padding:0!important;font-size:20px!important;border:2px solid var(--se-rim)!important;
 background:var(--se-glass)!important;color:var(--se-ink)!important;box-shadow:0 2px 6px rgba(0,0,0,.3)!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}
body.se-course.se-hud #toasts{top:calc(170px + env(safe-area-inset-top))!important;bottom:auto!important;left:calc(14px + env(safe-area-inset-left))!important;transform:none!important;align-items:flex-start!important;width:min(300px,calc(100vw - 32px))!important;opacity:.94}
/* A phone held upright has the course readout at 212 px, straight under where that lane puts a message, so a two-line one
   lay across the readout (and the top of gate one's ring behind it). On a phone the messages go up into the empty sky right
   of the map instead, the same strip the countdown call uses; the frame hook drops them just under the call while it is up */
@media (max-width:720px){body.se-course.se-hud #toasts{top:calc(20px + env(safe-area-inset-top))!important;left:calc(164px + env(safe-area-inset-left))!important;right:calc(8px + env(safe-area-inset-right))!important;width:auto!important;align-items:stretch!important}}
/* The course readout on a phone. With the camera up over her head, gate one stands higher in the picture, and the old
   places for the readout (212 px upright, 154-196 px on its side) lay straight across its ring and the arrow over it.
   Upright it goes up under the map, in the band between the map and the sky over the gate, a size smaller; on its side it
   goes up under the call in the top strip; and the messages on a short screen go to the foot of the screen between the
   stick and the jump button, over the horse's quarters, instead of dropping onto the joystick or the jump button. */
@media (max-width:720px){body.se-course.se-hud #courseHud{top:calc(128px + env(safe-area-inset-top))!important;font-size:12.5px!important;padding:6px 12px!important;gap:8px!important}
 body.se-course.se-hud #stamWrap{width:96px!important}}
@media (max-height:500px) and (min-width:721px){body.se-course.se-hud #courseHud{top:calc(46px + env(safe-area-inset-top))!important;left:50%!important;transform:translateX(-50%)!important;font-size:12.5px!important;padding:5px 12px!important;gap:8px!important}
 body.se-course.se-hud #toasts{top:auto!important;bottom:calc(10px + env(safe-area-inset-bottom))!important;left:50%!important;right:auto!important;transform:translateX(-50%)!important;width:min(340px,40vw)!important;align-items:stretch!important}}
/* the objective marker: a white arrow over the distance, floating toward whoever the mission
   wants you to see next, pinned to the screen edge when they are behind you or out of shot */
#seWay{position:fixed;left:0;top:0;display:none;flex-direction:column;align-items:center;gap:1px;pointer-events:none;z-index:5;
 transform:translate(-50%,-50%);will-change:transform}
#seWay.on{display:flex}
#seWay i{display:block;width:0;height:0;border-left:11px solid transparent;border-right:11px solid transparent;border-bottom:15px solid #fff;
 filter:drop-shadow(0 1px 1.5px rgba(0,0,0,.6));transform-origin:50% 60%}
#seWay b{font:900 20px/1 Nunito,system-ui,sans-serif;color:#fff;letter-spacing:.3px;text-shadow:0 1px 0 rgba(0,0,0,.55),0 0 4px rgba(0,0,0,.55),0 0 10px rgba(0,0,0,.25)}
body.posing #seWay,body.freecam #seWay,body.summoning #seWay{display:none!important}
/* every state that hid the dock hides this */
body.posing #seHudRoot,body.freecam #seHudRoot,body.summoning #seHudRoot,
body.posing #stickZone,body.summoning #seNorth,body.freecam #seNorth,body.posing #seNorth,
body.posing #seMarketLbl,body.freecam #seMarketLbl,body.summoning #seMarketLbl{display:none!important}
/* a phone: the same layout, a notch smaller, and the stick and actions tucked in */
@media (max-width:760px){body.se-hud:not(.se-course) #toasts{top:calc(138px + env(safe-area-inset-top))!important}}
@media (max-width:760px){
 /* A phone is too narrow for the desktop layout shrunk: the wallet ran over the journal, club and market hexagons, and a
    300px stick zone took most of the bottom edge, so the jump and the emote sat inside the stick's ring and a thumb on
    the stick pressed them. Here the stick keeps the bottom-left and nothing else is in its reach; the jump, emote,
    whistle and photo go to the right half, the touch toggles above them; the two pills stack under the top-right
    corner with the market beneath, and the journal, club and ranks hexagons sit between them and the map. */
 #seMenuBtn{width:40px;height:40px}
 body.se-hud #mkMiniPlate,body.se-hud #mini{left:calc(50px + env(safe-area-inset-left))!important}
 body.se-hud #mkMiniPlate,body.se-hud #mini{width:104px!important;height:104px!important}
 body.se-hud #seNorth{left:calc(50px + 52px - 9px + env(safe-area-inset-left))}
 .se-hexbtn{width:44px!important;height:38px!important}
 #questBtn.se-hexbtn{left:calc(160px + env(safe-area-inset-left))!important;top:calc(16px + env(safe-area-inset-top))!important}
 #netBtn.se-hexbtn{left:calc(210px + env(safe-area-inset-left))!important;top:calc(16px + env(safe-area-inset-top))!important}
 #lbBtn.se-hexbtn{left:calc(185px + env(safe-area-inset-left))!important;top:calc(58px + env(safe-area-inset-top))!important}
 body.se-hud #wallet{flex-direction:column!important;align-items:flex-end!important;gap:6px!important}
 body.se-hud #wallet .w{min-width:78px;height:26px;margin-left:14px;font-size:13px!important}
 body.se-hud #wallet .w>i{width:32px;height:32px;left:-13px;font-size:18px}
 #shopBtn.se-market{top:calc(82px + env(safe-area-inset-top))!important}
 body.se-hud #stickZone{width:min(208px,52vw)!important;height:282px!important}
 body.se-hud #stickBase{left:min(104px,26vw);top:176px;width:150px!important;height:150px!important;margin:-75px 0 0 -75px!important}
 body.se-hud #stickBase::before{transform:translate(0,-65px);box-shadow:0 130px 0 rgba(246,236,210,.75)}
 body.se-hud #stickBase::after{transform:translate(-65px,0);box-shadow:130px 0 0 rgba(246,236,210,.75)}
 body.se-hud #stickKnob{left:min(104px,26vw);top:176px;width:66px!important;height:66px!important;margin:-33px 0 0 -33px!important}
 #seJump{width:108px;height:108px;right:calc(10px + env(safe-area-inset-right));bottom:calc(100px + env(safe-area-inset-bottom))}
 #seWhistle{width:56px;height:56px;right:calc(16px + env(safe-area-inset-right));bottom:calc(30px + env(safe-area-inset-bottom))}
 #seEmote{width:48px;height:48px;right:calc(84px + env(safe-area-inset-right));bottom:calc(34px + env(safe-area-inset-bottom))}
 body.se-hud #photoBtn.se-act{right:calc(142px + env(safe-area-inset-right));bottom:calc(39px + env(safe-area-inset-bottom))}
 body.se-hud #flyBtn.se-act,body.se-hud #breathBtn.se-act{width:50px!important;height:50px!important;right:calc(128px + env(safe-area-inset-right))}
 body.se-hud #flyBtn.se-act{bottom:calc(158px + env(safe-area-inset-bottom))}
 body.se-hud #breathBtn.se-act{bottom:calc(214px + env(safe-area-inset-bottom))}
 body.se-hud.touch #touch{gap:8px;right:calc(16px + env(safe-area-inset-right))!important;bottom:calc(222px + env(safe-area-inset-bottom))!important}
 body.se-hud #touch button{width:48px!important;height:48px!important;font-size:18px!important}
 /* the bar is narrower than the phone (the touch toggles keep the right edge), so its quick emotes drop to a second row
    under the words, send and close */
 body.se-hud #chatBar{bottom:calc(296px + env(safe-area-inset-bottom))!important;width:calc(100vw - 96px)!important;flex-wrap:wrap;row-gap:6px}
 body.se-hud #chatBar input{flex:1 1 calc(100% - 96px)!important}   /* wide enough that only send and close share its row */
 body.se-hud #chatBar #chatSend{order:1}body.se-hud #chatBar #seChatX{order:2}body.se-hud #chatBar [data-emote]{order:3}
 body.se-hud #chatTabs{bottom:calc(384px + env(safe-area-inset-bottom))!important;width:calc(100vw - 96px)!important}
}`;
 /* Riding controls stay small until the player asks for more. */
 css.textContent+=`
body.se-hud{--se-glass:rgba(27,49,38,.9);--se-rim:rgba(233,240,221,.72)}
body.se-hud #netBtn.se-hexbtn,body.se-hud #lbBtn.se-hexbtn,body.se-hud #careBtn.se-hexbtn,
body.se-hud #shopBtn.se-market,body.se-hud #seMarketLbl,body.se-hud #seEmote,body.se-hud #seWhistle,
body.se-hud #photoBtn.se-act{display:none!important}
#seNavPlate{position:fixed;left:calc(14px + env(safe-area-inset-left));top:calc(14px + env(safe-area-inset-top));width:196px;height:112px;
 border:1px solid rgba(242,240,221,.18);border-radius:18px;background:rgba(24,42,33,.55);box-shadow:0 5px 22px rgba(0,0,0,.12);pointer-events:none!important}
body.se-hud #mkMiniPlate,body.se-hud #mini{left:calc(26px + env(safe-area-inset-left))!important;top:calc(38px + env(safe-area-inset-top))!important;width:60px!important;height:60px!important}
body.se-hud #mkMiniPlate::after{display:none!important}
body.se-hud #mini{border:2px solid rgba(241,245,228,.82)!important;box-shadow:none!important;cursor:pointer}
body.se-hud #seNorth{left:calc(47px + env(safe-area-inset-left));top:calc(29px + env(safe-area-inset-top));background:#e9eedf;color:#294333;box-shadow:none;font-size:10px}
body.se-hud #seMenuBtn,#seQuickToggle{position:fixed;left:calc(98px + env(safe-area-inset-left));width:100px;height:44px;min-height:44px;min-width:0;padding:0 8px;
 border-radius:10px!important;border:1px solid rgba(233,240,221,.25);background:rgba(233,240,221,.1);color:#fff;box-shadow:none!important;cursor:pointer;
 display:flex;align-items:center;justify-content:center;gap:6px;font:800 12px/1 Nunito,system-ui,sans-serif}
body.se-hud #seMenuBtn{top:calc(22px + env(safe-area-inset-top));background:rgba(245,241,221,.94);color:#294333;border-color:transparent}
body.se-hud #seMenuBtn i{width:13px;height:2px;background:#294333;box-shadow:0 -4px 0 #294333,0 4px 0 #294333}
body.se-hud #seMenuBtn::after{content:none!important}
body.se-hud #seMenuBtn .se-pip{position:static!important;display:flex;align-items:center;justify-content:center;min-width:18px;height:18px;padding:0 4px;border:0!important;border-radius:6px;
 background:#d5b86e!important;color:#352c12!important;box-shadow:none;font:900 10px/1 Nunito,system-ui,sans-serif!important}
#seQuickToggle{top:calc(74px + env(safe-area-inset-top));font-weight:700;color:#e6eadf;background:transparent}
#seQuickToggle::after,#seGoalToggle::after{content:'⌄';font:700 17px/1 system-ui;margin-left:auto}
#seQuickToggle[aria-expanded="true"]::after,#seGoalToggle[aria-expanded="true"]::after{content:'⌃'}
#seQuickToggle:hover,#seQuickToggle[aria-expanded="true"]{background:rgba(233,240,221,.14)}
#seQuickPanel{position:fixed;left:calc(14px + env(safe-area-inset-left));top:calc(134px + env(safe-area-inset-top));display:flex;gap:6px;padding:7px;width:292px;
 border:1px solid rgba(233,240,221,.25);border-radius:12px;background:rgba(27,49,38,.95);box-shadow:0 5px 16px rgba(0,0,0,.15)}
#seQuickPanel[hidden]{display:none!important}
body.se-hud #seQuickPanel>.se-hexbtn{position:relative!important;inset:auto!important;flex:1;width:auto!important;height:44px!important;min-height:44px!important;
 border:1px solid rgba(233,240,221,.2)!important;border-radius:8px!important;background-color:rgba(233,240,221,.08)!important;
 background-size:26px 24px!important;background-position:4px center!important;filter:none!important;box-shadow:none!important}
body.se-hud #seQuickPanel>.se-hexbtn::after{display:block!important;position:absolute;left:32px;right:3px;top:0;height:42px;color:#fff;font:800 11px/42px Nunito,system-ui,sans-serif!important;letter-spacing:0;text-transform:none}
body.se-hud #stableBtn.se-hexbtn::after{content:'Horses'!important}
body.se-hud #questBtn.se-hexbtn::after{content:'Journey'!important}
body.se-hud #eventsBtn.se-hexbtn::after{content:'Events'!important}
body.se-hud .se-hexbtn .mk-dk-lbl{display:none!important}
body.se-hud .se-hexbtn .pip,body.se-hud .se-hexbtn .badge{top:-5px!important;right:-4px!important;min-width:16px;height:16px;padding:0 4px;font-size:10px!important;line-height:13px!important;box-shadow:none!important}
#seGoal{position:fixed;left:calc(14px + env(safe-area-inset-left));top:calc(134px + env(safe-area-inset-top));width:min(286px,calc(100vw - 28px));pointer-events:none!important}
#seGoal[hidden]{display:none!important}
body.se-shortcuts-open #seGoal{top:calc(200px + env(safe-area-inset-top))}
#seGoalToggle{display:flex;align-items:center;gap:10px;width:196px;min-height:44px;padding:0 13px;border:1px solid rgba(233,240,221,.22);border-radius:11px;
 background:rgba(27,49,38,.78);color:#e9eedf;font:700 12px/1 Nunito,system-ui,sans-serif;box-shadow:none;cursor:pointer;pointer-events:auto}
#seGoalToggle[aria-expanded="true"]{width:100%;border-radius:11px 11px 0 0;border-bottom-color:rgba(233,240,221,.12);color:#fff}
body.se-hud #seGoal #questTrack{position:static!important;inset:auto!important;transform:none!important;max-width:none!important;width:100%;padding:11px 13px 13px!important;
 margin:0!important;border:1px solid rgba(233,240,221,.22)!important;border-top:0!important;border-radius:0 0 11px 11px!important;
 background:rgba(27,49,38,.9)!important;color:#f3f2e7;font:600 12px/1.55 Nunito,system-ui,sans-serif!important;text-align:left!important;text-shadow:none!important;
 white-space:normal!important;overflow:visible!important;box-shadow:none!important;pointer-events:auto}
body.se-hud #seGoal #questTrack::before{display:none!important}
body.se-hud #seGoal #questTrack[hidden]{display:none!important}
#seHudRoot :is(button,canvas):focus-visible,body.se-hud #mini:focus-visible{outline:3px solid #f4d990!important;outline-offset:3px}
body.se-hud #hud{top:calc(20px + env(safe-area-inset-top));right:calc(16px + env(safe-area-inset-right))}
body.se-hud #wallet{flex-direction:row!important;gap:7px!important;align-items:center!important}
body.se-hud #wallet .w{height:32px;min-width:76px;margin-left:0;padding:0 10px!important;gap:6px;border-radius:9px!important;
 background:rgba(27,49,38,.8)!important;border:1px solid rgba(233,240,221,.25)!important;box-shadow:none!important;font-size:13px!important;letter-spacing:0}
body.se-hud #wallet .w>i{position:static;left:auto;top:auto;transform:none;width:18px;height:18px;flex:none;font-size:16px;background:none!important;border:0!important;box-shadow:none!important}
body.se-hud:not(.touch) #stickZone,body.se-hud:not(.touch) #seJump{display:none!important}
body.se-hud.touch #stickZone{left:calc(6px + env(safe-area-inset-left))!important;bottom:calc(8px + env(safe-area-inset-bottom))!important;width:160px!important;height:160px!important}
body.se-hud.touch #stickBase{left:80px;top:80px;width:132px!important;height:132px!important;margin:-66px 0 0 -66px!important;
 border:2px solid rgba(233,240,221,.55)!important;background:rgba(29,53,39,.17)!important;opacity:.72!important}
body.se-hud.touch #stickBase::before,body.se-hud.touch #stickBase::after{display:none}
body.se-hud.touch #stickKnob{left:80px;top:80px;width:56px!important;height:56px!important;margin:-28px 0 0 -28px!important;
 background:rgba(232,238,222,.9)!important;box-shadow:0 2px 6px rgba(0,0,0,.2)!important}
body.se-hud.touch #seJump{width:80px;height:80px;right:calc(16px + env(safe-area-inset-right));bottom:calc(18px + env(safe-area-inset-bottom));filter:none}
body.se-hud #seMount{width:50px;height:50px;right:calc(16px + env(safe-area-inset-right));bottom:calc(20px + env(safe-area-inset-bottom))}
body.se-hud #flyBtn.se-act,body.se-hud #breathBtn.se-act{width:46px!important;height:46px!important;bottom:calc(22px + env(safe-area-inset-bottom));filter:none}
body.se-hud #flyBtn.se-act{right:calc(80px + env(safe-area-inset-right))}
body.se-hud #breathBtn.se-act{right:calc(140px + env(safe-area-inset-right))}
body.se-hud.touch #seMount{bottom:calc(168px + env(safe-area-inset-bottom))}
body.se-hud.touch #flyBtn.se-act{right:calc(76px + env(safe-area-inset-right));bottom:calc(170px + env(safe-area-inset-bottom))}
body.se-hud.touch #breathBtn.se-act{right:calc(132px + env(safe-area-inset-right));bottom:calc(170px + env(safe-area-inset-bottom))}
body.se-hud.touch:not(.freecam):not(.summoning):not(.posing) #touch{flex-direction:row;gap:7px;right:calc(16px + env(safe-area-inset-right))!important;bottom:calc(112px + env(safe-area-inset-bottom))!important}
body.se-hud #touch button{width:44px!important;height:44px!important;font-size:18px!important;border-width:1px!important;box-shadow:none!important}
body.se-hud:not(.se-course) #toasts{top:calc(64px + env(safe-area-inset-top))!important;bottom:auto!important;left:auto!important;right:calc(16px + env(safe-area-inset-right))!important;
 transform:none!important;width:min(340px,calc(100vw - 32px))!important;align-items:stretch!important}
body.se-hud .toast{font-size:12px!important;line-height:1.45!important;padding:10px 12px!important;border-radius:12px!important;box-shadow:0 4px 18px rgba(0,0,0,.16)!important}
body.se-hud .toast .mk-toast-ico{width:22px;height:22px;font-size:13px}
body.se-hud .toast.se-passive-notice{display:none!important}
body.se-hud #chatBar{bottom:calc(238px + env(safe-area-inset-bottom))!important}
body.se-hud #chatTabs{bottom:calc(282px + env(safe-area-inset-bottom))!important}
body.se-hud #seChatX{width:44px!important;height:44px!important}
body.se-hud:is(.freecam,.summoning,.posing) #stickZone{display:none!important}
body.se-course :is(#seNavPlate,#seQuickToggle,#seQuickPanel,#seGoal){display:none!important}
@media(max-width:760px){
 body.se-hud #wallet{flex-direction:column!important;align-items:flex-end!important;gap:6px!important}
 body.se-hud #wallet .w{min-width:76px;height:30px;padding:0 8px!important;font-size:12px!important}
 body.se-hud:not(.se-course) #toasts{top:auto!important;bottom:calc(234px + env(safe-area-inset-bottom))!important;left:14px!important;right:14px!important;width:auto!important;max-width:none}
}
@media(max-height:500px) and (min-width:600px){
 body.se-hud:not(.se-course) #toasts{top:auto!important;bottom:calc(10px + env(safe-area-inset-bottom))!important;left:50%!important;right:auto!important;transform:translateX(-50%)!important;width:min(340px,40vw)!important}
}
body.se-hud:is(.se-screen-open,.se-market-open,.se-ov-open) #toasts{top:auto!important;bottom:calc(16px + env(safe-area-inset-bottom))!important;left:50%!important;right:auto!important;transform:translateX(-50%)!important;width:min(360px,calc(100vw - 32px))!important;max-width:none}
`;
 css.textContent+=`/* Pace is a choice, independent of the thumbstick. Touch targets stay at least 44 px. */
#seRidePace{position:fixed;left:50%;bottom:calc(18px + env(safe-area-inset-bottom));transform:translateX(-50%);display:flex;align-items:center;gap:4px;padding:4px;border:1px solid rgba(246,236,210,.55);border-radius:16px;background:rgba(18,22,36,.8);color:var(--se-ink);font:800 12px/1.2 system-ui;touch-action:none}
#seRidePace button{min-width:44px;height:44px;padding:0 10px;border:0;border-radius:10px;background:rgba(255,255,255,.08);color:var(--se-ink);font:800 17px/1 system-ui;cursor:pointer;touch-action:none}
#seRidePace button:active,#seRidePace button[aria-pressed="true"]{background:#e6b544;color:#201b12}
#seRidePace #seGaitLabel{width:98px;font-size:15px;display:flex;flex-direction:column;justify-content:center;gap:3px;text-transform:capitalize}
#seGaitLabel small{font:600 10px/1 system-ui;opacity:.8;text-transform:none}
#seRidePace #seStop{font-size:12px;margin-left:4px}
#seGaitChoices{position:absolute;bottom:calc(100% + 8px);left:0;right:0;display:none;grid-template-columns:1fr 1fr;gap:4px;padding:5px;border-radius:12px;background:rgba(18,22,36,.94)}
#seGaitChoices.on{display:grid}#seGaitChoices button{font-size:14px}
#seGaitChoices{border:1px solid #b8c8ad;background:#213d33;box-shadow:0 8px 24px #12251b40}
#seGaitChoices button[aria-pressed="true"]{background:#e7d7a6;color:#263f32}
#seRidePace button:focus-visible{outline:3px solid #f4d990;outline-offset:2px}
#seHudRoot:has(#seGaitChoices.on){z-index:9}
body.se-hud #tGal{display:none!important}
body.se-riding-flight #tGal,body.se-riding-foot #tGal{display:block!important}
body.se-riding-flight #seRidePace,body.se-riding-foot #seRidePace{display:none}

/* Leave room for the live pace/STOP strip beneath the riding controls. */
@media(max-width:760px){
 body.se-hud.touch #stickZone{bottom:calc(78px + env(safe-area-inset-bottom))!important}
 body.se-hud.touch #seJump{bottom:calc(80px + env(safe-area-inset-bottom))}
 body.se-hud.touch:not(.freecam):not(.summoning):not(.posing) #touch{bottom:calc(232px + env(safe-area-inset-bottom))!important}
 #seRidePace{bottom:calc(8px + env(safe-area-inset-bottom))}
}
@media(max-height:520px) and (min-width:561px){
 body.se-hud.touch #stickZone{bottom:calc(8px + env(safe-area-inset-bottom))!important}
 body.se-hud.touch #seJump{bottom:calc(18px + env(safe-area-inset-bottom))}
 body.se-hud.touch #seMount{width:48px!important;height:48px!important;right:calc(112px + env(safe-area-inset-right))!important;bottom:calc(24px + env(safe-area-inset-bottom))!important}
 body.se-hud.touch #flyBtn.se-act{right:calc(18px + env(safe-area-inset-right));bottom:calc(110px + env(safe-area-inset-bottom))}
 body.se-hud.touch #breathBtn.se-act{right:calc(72px + env(safe-area-inset-right));bottom:calc(110px + env(safe-area-inset-bottom))}
 body.se-hud.touch #touch{bottom:calc(166px + env(safe-area-inset-bottom))!important}
 body.se-hud.touch #tSpr,body.se-hud.touch #tTrick{display:none!important}
}
`;
 document.head.appendChild(css);
 document.body.classList.add('se-hud');

 /* ---------------------------------------------------------------- the floating layer ---- */
 const root=document.createElement('div'); root.id='seHudRoot'; document.body.appendChild(root);
 const north=document.createElement('div'); north.id='seNorth'; north.textContent='N'; document.body.appendChild(north);

 /* ☰ and the sheet it opens */
 const menuBtn=document.createElement('button'); menuBtn.id='seMenuBtn'; menuBtn.title='Menu'; menuBtn.setAttribute('aria-label','Menu');
 menuBtn.type='button';menuBtn.innerHTML='<i aria-hidden="true"></i><span>Menu</span>'; root.appendChild(menuBtn);
 const menu=document.createElement('div'); menu.id='seMenu'; menu.setAttribute('role','dialog'); menu.setAttribute('aria-label','Menu');
 menu.innerHTML='<div class="se-sheet"><div class="se-bar"><span><b id="seMenuName">Menu</b><br><small id="seMenuSub"></small></span><button class="se-x" aria-label="Close">✕</button></div><div class="se-tiles" id="seTiles"></div></div>';
 document.body.appendChild(menu);
 const tiles=menu.querySelector('#seTiles');
 menu.tabIndex=-1;
 menu.setAttribute('aria-modal','true');
 menuBtn.setAttribute('aria-controls','seMenu');
 menuBtn.setAttribute('aria-expanded','false');
 let menuFocus=null;
 const menuBackground=new Map();
 function restoreBackground(){
  for(const [el,wasInert] of menuBackground)el.inert=wasInert;
  menuBackground.clear();
 }
 function closeMenu(restoreFocus=true){
  if(!menu.classList.contains('on'))return;
  menu.classList.remove('on');
  document.body.classList.remove('se-menu-open');
  menuBtn.setAttribute('aria-expanded','false');
  restoreBackground();
  if(restoreFocus){const target=menuFocus?.isConnected&&!menuFocus.closest('[inert]')&&menuFocus.checkVisibility()?menuFocus:menuBtn;target.focus({preventScroll:true});}
 }
 function openMenu(){
  if(menu.classList.contains('on'))return;
  menuFocus=document.activeElement;
  G.menuDialogFocus?.suspend(); // release shared menu leases before this modal snapshots inert state
  setQuick(false);
  G.hidePanels();G.input?.reset();paintMenuHead();
  for(const el of document.body.children){
   if(el!==menu&&!el.matches('script,style,link')&&el.checkVisibility()){menuBackground.set(el,el.inert);el.inert=true;}
  }
  menu.classList.add('on');document.body.classList.add('se-menu-open');
  menuBtn.setAttribute('aria-expanded','true');
  menu.focus({preventScroll:true});
 }
 menuBtn.onclick=()=>menu.classList.contains('on')?closeMenu():openMenu();
 menu.querySelector('.se-x').onclick=()=>closeMenu();
 menu.addEventListener('click',e=>{if(e.target===menu)closeMenu();});
 menu.addEventListener('keydown',e=>{
  if(!menu.classList.contains('on'))return;
  e.stopPropagation();
  if(e.key==='Escape'){e.preventDefault();closeMenu();return;}
  if(e.key==='Tab'){
   const focusable=[...menu.querySelectorAll('button,input,select,a[href],[tabindex]')].filter(el=>el.tabIndex>=0&&!el.disabled&&!el.closest('[inert]')&&el.checkVisibility());
   const first=focusable[0],last=focusable.at(-1),active=document.activeElement;
   if(!first){e.preventDefault();menu.focus();}
   else if(e.shiftKey&&(active===first||active===menu)){e.preventDefault();last.focus();}
   else if(!e.shiftKey&&(active===last||active===menu)){e.preventDefault();first.focus();}
  }
 });
 function paintMenuHead(){
  try{
   const s=G.save.fresh()||{}, h=(s.horses||[])[G.horse.rideIdx()]||{};
   $('seMenuName').textContent=(s.name||s.playerName||'Your ranch');
   $('seMenuSub').textContent=h.name?('with '+h.name+' · Lv '+(h.level||1)):'';
  }catch(e){}
 }

 /* A small home for navigation, with extra destinations one tap away. These are still the
    game's original buttons, so their click handlers and notification counts stay live. */
 const navPlate=document.createElement('div');navPlate.id='seNavPlate';navPlate.setAttribute('aria-hidden','true');root.prepend(navPlate);
 const quickToggle=document.createElement('button');quickToggle.id='seQuickToggle';quickToggle.type='button';quickToggle.textContent='Shortcuts';
 quickToggle.setAttribute('aria-controls','seQuickPanel');quickToggle.setAttribute('aria-expanded','false');root.appendChild(quickToggle);
 const quickPanel=document.createElement('div');quickPanel.id='seQuickPanel';quickPanel.hidden=true;quickPanel.setAttribute('role','group');quickPanel.setAttribute('aria-label','Quick destinations');root.appendChild(quickPanel);
 let quickOpen=false;
 function setQuick(on,restoreFocus=false){
  quickOpen=!!on;quickPanel.hidden=!quickOpen;quickToggle.setAttribute('aria-expanded',String(quickOpen));
  document.body.classList.toggle('se-shortcuts-open',quickOpen);
  if(restoreFocus)quickToggle.focus({preventScroll:true});
 }
 quickToggle.onclick=()=>setQuick(!quickOpen);
 quickPanel.addEventListener('click',e=>{if(e.target.closest('button'))setQuick(false);},true);
 for(const el of[quickToggle,quickPanel])el.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&quickOpen){e.preventDefault();e.stopPropagation();setQuick(false,true);}
  else if(e.key==='Enter'||e.key===' ')e.stopPropagation();
 });
 G.on('escape',()=>{if(quickOpen){setQuick(false,true);return true;}});
 const blockedClasses=['se-screen-open','se-market-open','se-ov-open','se-char-open','se-menu-open','se-course','freecam','posing','summoning'];
 new MutationObserver(()=>{if(quickOpen&&blockedClasses.some(c=>document.body.classList.contains(c)))setQuick(false);}).observe(document.body,{attributes:true,attributeFilter:['class']});
 const mini=$('mini');
 if(mini){mini.tabIndex=0;mini.setAttribute('role','button');mini.setAttribute('aria-label','Open world map');mini.title='Open world map';
  mini.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();mini.click();}});
 }

 /* Keep the live quest text intact; only its disclosure state belongs to this presentation. */
 const goal=document.createElement('div');goal.id='seGoal';
 const goalToggle=document.createElement('button');goalToggle.id='seGoalToggle';goalToggle.type='button';goalToggle.textContent='Current goal';goalToggle.setAttribute('aria-controls','questTrack');
 const track=$('questTrack');goal.appendChild(goalToggle);if(track)goal.appendChild(track);root.appendChild(goal);
 let goalExpanded=false;
 try{goalExpanded=localStorage.getItem('mlrHudGoalExpanded')==='1';}catch(e){}
 function setGoalExpanded(on,persist=false){
  goalExpanded=!!on;goalToggle.setAttribute('aria-expanded',String(goalExpanded));goalToggle.title=goalExpanded?'Hide current goal':'Show current goal';
  if(track)track.hidden=!goalExpanded;
  if(persist)try{localStorage.setItem('mlrHudGoalExpanded',goalExpanded?'1':'0');}catch(e){}
 }
 goalToggle.onclick=()=>setGoalExpanded(!goalExpanded,true);
 goalToggle.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' ')e.stopPropagation();});
 setGoalExpanded(goalExpanded);

 /* Only known background announcements are quieted. Purchases, rewards and every player
    action keep their full message, including long errors; no generic length filter is used. */
 function quietNotice(el){
  const text=(el.querySelector('.mk-toast-txt')?.textContent||el.textContent||'').replace(/^[^\p{L}\p{N}]+/u,'').trim();
  if(/^(Back in the Season Call this season:|New in the club: friends with requests,|Kestrel Basin has grown:)/.test(text)||/^Double-gem weekend is on — every gem you earn today counts twice!?$/.test(text)){
   el.classList.add('se-passive-notice');el.setAttribute('aria-hidden','true');
  }
 }
 const toastBox=$('toasts');
 if(toastBox){toastBox.querySelectorAll('.toast').forEach(quietNotice);new MutationObserver(records=>{
  for(const record of records)for(const node of record.addedNodes)if(node.nodeType===1&&node.matches('.toast'))quietNotice(node);
 }).observe(toastBox,{childList:true});}

 /* the gold market label */
 const mLbl=document.createElement('div'); mLbl.id='seMarketLbl'; mLbl.textContent='MARKET'; document.body.appendChild(mLbl);

 /* ---------------------------------------------------------------- where each thing goes -- */
 /* Positions are the hex cluster wrapped round the map: two to its right on the top row, one
    below those, and three along the bottom edge of the map. Left/top in px from the corner. */
 const HEXES={
  questBtn: {icon:'journal',x:196,y:18},
  netBtn:   {icon:'club',   x:258,y:18},
  lbBtn:    {icon:'ranks',  x:204,y:84},
  stableBtn:{icon:'stable', x:12, y:152},
  careBtn:  {icon:'horse',  x:72, y:176},
  eventsBtn:{icon:'events', x:146,y:156}
 };
 const ACTS={flyBtn:'fly',breathBtn:'breathe',photoBtn:'photo'};
 const QUICK={stableBtn:'Horses',questBtn:'Journey',eventsBtn:'Events'};
 const placed=new Set();
 function hexify(el,spec){
  el.classList.add('se-hexbtn');
  el.style.setProperty('background-image',hexSvg(spec.icon),'important');
  el.style.left='calc('+spec.x+'px + env(safe-area-inset-left))';
  el.style.top='calc('+spec.y+'px + env(safe-area-inset-top))';
  (QUICK[el.id]?quickPanel:root).appendChild(el);
  if(QUICK[el.id]){el.setAttribute('aria-label',QUICK[el.id]);el.title=QUICK[el.id];}
 }
 function place(){
  /* the hexes and the market: move the real buttons */
  for(const idn in HEXES){ try{ const el=$(idn); if(el&&el.parentElement!==(QUICK[idn]?quickPanel:root)){hexify(el,HEXES[idn]);placed.add(idn);} }catch(e){} }
  try{
   const sb=$('shopBtn');
   if(sb&&!sb.classList.contains('se-market')){
    sb.classList.add('se-hexbtn','se-market'); sb.style.setProperty('background-image',marketSvg,'important');
    sb.style.right='calc(20px + env(safe-area-inset-right))'; sb.style.left='auto';
    sb.style.top='calc(58px + env(safe-area-inset-top))';
    root.appendChild(sb); placed.add('shopBtn');
   }
   if(sb){const r=sb.getBoundingClientRect(); if(r.width){mLbl.style.left=(r.left+r.width/2-42)+'px'; mLbl.style.top=(r.bottom+2)+'px';}}
  }catch(e){}
  /* the round actions that already exist: photo, fly, breathe */
  for(const idn in ACTS){ try{ const el=$(idn); if(el&&!el.classList.contains('se-act')){ el.classList.add('se-act'); el.style.setProperty('background-image',roundSvg(ACTS[idn],1.15),'important'); el.style.setProperty('background-color','transparent','important'); root.appendChild(el); placed.add(idn);} }catch(e){} }
  /* everything else that lived in the dock, the More menu or the system strip goes in the sheet */
  try{
   const pool=[...document.querySelectorAll('#dock button, #mkDockMenu button, #sysBtns button')];
   for(const b of pool){
    if(!b.id||placed.has(b.id)||b.classList.contains('mk-dk-more'))continue;
    if(HEXES[b.id]||ACTS[b.id]||b.id==='shopBtn')continue;
    tiles.appendChild(b); placed.add(b.id);
    /* a system button is a bare pictogram with its name only in a tooltip; a tile needs words */
    const L={poseBtn:'Photo mode',qualBtn:'Graphics',muteBtn:'Sound',settingsBtn:'Settings'}[b.id];
    if(L)b.dataset.seLbl=L;
   }
  }catch(e){}
  /* Count meaningful badges on original controls once, never duplicate menu tiles or empty dots. */
  try{
   let count=0;
   for(const idn of placed){
    const button=$(idn);if(!button||button.hidden||button.style.display==='none')continue;
    let n=0;
    for(const p of button.querySelectorAll('.pip,.badge')){
     if(p.hidden||p.style.display==='none')continue;
     const text=p.textContent.trim();n=Math.max(n,/^\d+\+?$/.test(text)?Number.parseInt(text,10):text==='!'?1:0);
    }
    count+=n;
   }
   let mp=menuBtn.querySelector('.se-pip');
   if(count){if(!mp){mp=document.createElement('span');mp.className='se-pip';mp.setAttribute('aria-hidden','true');menuBtn.appendChild(mp);}mp.textContent=count>99?'99+':String(count);}
   else if(mp)mp.remove();
   const label=count?'Menu, '+count+' update'+(count===1?'':'s'):'Menu';menuBtn.setAttribute('aria-label',label);menuBtn.title=label;
  }catch(e){}
 }

 /* ---------------------------------------------------------------- the actions ----------- */
 const key=(code,down)=>{ try{ window.dispatchEvent(new KeyboardEvent(down?'keydown':'keyup',{code,key:code==='Space'?' ':code,bubbles:true})); }catch(e){} };
 const act=(idn,icon,svgFn,title)=>{ const b=document.createElement('button'); b.id=idn; b.className='se-act'; b.title=title; b.setAttribute('aria-label',title);
  b.style.setProperty('background-image',svgFn(icon),'important'); root.appendChild(b); return b; };
 /* the big diamond is jump — held, not tapped, so a buffered press reads exactly like Space */
 const jumpB=act('seJump','jump',diamondSvg,'Jump (Space)');
 const press=e=>{ e.preventDefault(); key('Space',true); };
 const lift=()=>key('Space',false);
 jumpB.addEventListener('pointerdown',press); jumpB.addEventListener('pointerup',lift); jumpB.addEventListener('pointerleave',lift); jumpB.addEventListener('pointercancel',lift);
 act('seWhistle','whistle',k=>roundSvg(k,1.25),'Whistle for your horse').onclick=()=>{ try{ G.ui.dispatch('bpe:whistle'); }catch(e){} };
 act('seEmote','emote',k=>roundSvg(k,1.2),'Emotes').onclick=()=>{ try{ G.ui.open('emotePanel'); }catch(e){} };

 /* Explicit pace and a held brake use the same intent as the keyboard. */
 const pace=document.createElement('div');pace.id='seRidePace';pace.setAttribute('role','group');pace.setAttribute('aria-label','Riding pace');
 pace.innerHTML='<button id="seGaitDown" aria-label="Slower gait" title="Slower gait ([)">−</button><button id="seGaitLabel" aria-haspopup="true" aria-controls="seGaitChoices" aria-expanded="false"><b>Canter</b><small>Select gait</small></button><button id="seGaitUp" aria-label="Faster gait" title="Faster gait (])">+</button><button id="seStop" aria-label="Hold to stop">STOP</button><div id="seGaitChoices" role="group" aria-label="Choose riding gait">'+['walk','trot','canter','gallop'].map(g=>'<button data-gait="'+g+'">'+g[0].toUpperCase()+g.slice(1)+'</button>').join('')+'</div>';
 root.appendChild(pace);
 const choices=$('seGaitChoices'),gaitLabel=$('seGaitLabel');
 $('seGaitDown').onclick=()=>G.riding?.shiftGait(-1);$('seGaitUp').onclick=()=>G.riding?.shiftGait(1);
 function closeGaits(restore=false){choices.classList.remove('on');gaitLabel.setAttribute('aria-expanded','false');if(restore)gaitLabel.focus({preventScroll:true});}
 function openGaits(){choices.classList.add('on');gaitLabel.setAttribute('aria-expanded','true');const selected=choices.querySelector('[aria-pressed="true"]:not([hidden])')||[...choices.children].find(b=>!b.hidden);selected?.focus({preventScroll:true});}
 gaitLabel.onclick=()=>choices.classList.contains('on')?closeGaits(true):openGaits();
 choices.onclick=e=>{const g=e.target.closest('[data-gait]')?.dataset.gait;if(g){G.riding?.selectGait(g);closeGaits(true);}};
 pace.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&!choices.classList.contains('on'))return;
  if(e.key==='Escape'&&choices.classList.contains('on')){e.preventDefault();closeGaits(true);}
  else if(choices.classList.contains('on')&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(e.key)){
   const list=[...choices.children].filter(b=>!b.hidden&&!b.disabled),index=list.indexOf(document.activeElement);let next;
   if(e.key==='Home')next=list[0];else if(e.key==='End')next=list.at(-1);else{const step=['ArrowLeft','ArrowUp'].includes(e.key)?-1:1;next=list[(Math.max(0,index)+step+list.length)%list.length];}
   e.preventDefault();next?.focus({preventScroll:true});
  }
  // Keep native Enter/Space button clicks, but never send them to riding/jump.
  e.stopPropagation();
 });
 pace.addEventListener('keyup',e=>e.stopPropagation());
 pace.addEventListener('focusout',()=>queueMicrotask(()=>{if(!pace.contains(document.activeElement))closeGaits();}));
 document.addEventListener('pointerdown',e=>{if(!pace.contains(e.target))closeGaits();},true);
 G.on('escape',()=>{if(choices.classList.contains('on')){closeGaits(true);return true;}return false;});
 const stop=$('seStop');stop.addEventListener('pointerdown',e=>{e.preventDefault();try{stop.setPointerCapture(e.pointerId);}catch(_){}G.riding?.brake(true);});
 for(const ev of ['pointerup','pointercancel','lostpointercapture'])stop.addEventListener(ev,()=>G.riding?.brake(false));
 stop.addEventListener('keydown',e=>{if(['Space','Enter'].includes(e.code)){e.preventDefault();e.stopPropagation();G.riding?.brake(true);}});
 stop.addEventListener('keyup',e=>{if(['Space','Enter'].includes(e.code)){e.preventDefault();e.stopPropagation();G.riding?.brake(false);}});stop.addEventListener('blur',()=>G.riding?.brake(false));
 // Less frequent actions remain available in Menu on a short screen.
 for(const [target,label,glyph] of [['tSpr','Sprint','⚡'],['tTrick','Trick','↻'],['seWhistle','Whistle','♪'],['seEmote','Emotes','☺'],['photoBtn','Take photo','▣']]){
  const b=document.createElement('button');b.dataset.seLbl=label;b.textContent=glyph;b.setAttribute('aria-label',label);b.onclick=()=>{closeMenu(false);if(target==='tSpr')G.riding?.selectGait('gallop');$(target)?.click();};tiles.appendChild(b);
 }
 let paceKey='';
 function syncPace(){
  const st=G.riding?.state();if(!st)return;
  const key=[st.selected,st.requested,st.actual,st.braking,st.dragon,st.sprint].join(':');if(key===paceKey)return;paceKey=key;
  document.body.classList.toggle('se-riding-flight',st.actual==='fly');document.body.classList.toggle('se-riding-foot',st.actual==='on foot');
  const label=g=>st.dragon?({trot:'Run',canter:'Run',gallop:'Fast run',walk:'Walk',run:'Run'}[g]||g):g;
  gaitLabel.querySelector('b').textContent=label(st.requested);gaitLabel.querySelector('small').textContent=st.braking?'Stopping':st.actual==='reverse'?'Backing up':st.actual==='halt'?'Halted':st.sprint&&st.requested==='gallop'?'Sprint selected':label(st.actual)===label(st.requested)?'Select gait':label(st.actual)+' → '+label(st.requested);
  for(const b of choices.children){b.hidden=st.dragon&&b.dataset.gait==='trot';b.textContent=label(b.dataset.gait);b.setAttribute('aria-pressed',String(b.dataset.gait===st.selected));}stop.setAttribute('aria-pressed',String(st.braking));
  const t=$('tGal');if(t)t.title=st.actual==='fly'?'Descend':'Run';
 }
 G.on('tick',syncPace);syncPace();

 /* ---------------------------------------------------------------- the chat line --------- */
 /* ranch3d's chat input swallows every key (so typing never steers the horse), Escape included, and the bar had no close:
    once opened it stayed up until the ☰ Chat tile was found again. A capture listener on the input itself runs before
    that one: Escape shuts the bar and gives the keys back to the game. */
 try{
  const cb=$('chatBar'), ci=$('chatIn');
  if(cb&&ci&&!$('seChatX')){
   const shutChat=()=>{cb.style.display='none';const t=$('chatTabs');if(t)t.style.display='none';try{ci.blur();}catch(e){}};
   ci.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();shutChat();}},true);
   const x=document.createElement('button'); x.id='seChatX'; x.type='button'; x.title='Close chat'; x.setAttribute('aria-label','Close chat');
   x.innerHTML='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg>';
   x.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();shutChat();});
   cb.appendChild(x);
  }
 }catch(e){}

 /* ---------------------------------------------------------------- the thumbstick -------- */
 /* ranch3d's stick floats to wherever the thumb lands and lives on after release at that spot.
    Here it has a home to go back to, because a control you can see is a control you can find. */
 try{
  const zone=$('stickZone'),base=$('stickBase'),knob=$('stickKnob');
  const home=()=>{ for(const el of[base,knob])if(el){el.style.left='';el.style.top='';} };
  if(zone){ for(const ev of['pointerup','pointercancel','lostpointercapture'])zone.addEventListener(ev,()=>setTimeout(home,0)); }
 }catch(e){}

 /* ---------------------------------------------------------------- keeping it true ------- */
 function sync(){
  place();
  goal.hidden=!track?.textContent.trim();
  try{document.body.classList.toggle('se-course',!!(G.course&&G.course.get&&G.course.get()));}catch(e){}
  /* the horse hexagon wears the ridden horse's level, and a red dot when she needs you */
  try{
   const cb=$('careBtn');
   if(cb){
    let lv=cb.querySelector('.se-lvl'); if(!lv){lv=document.createElement('span');lv.className='se-lvl';cb.appendChild(lv);}
    const s=G.save.fresh()||{}, h=(s.horses||[])[G.horse.rideIdx()]||{};
    const t=String(h.level||1); if(lv.textContent!==t)lv.textContent=t;
    const card=$('statusCard'); cb.classList.toggle('se-alert',!!(card&&card.classList.contains('mk-sc-alert')));
   }
  }catch(e){}
  /* the old dock must stay down even if a package adds a button to it later */
  try{ const d=$('dock'); if(d&&d.style.display!=='none')d.style.display='none'; }catch(e){}
 }
 sync();
 G.on('boot',()=>setTimeout(sync,0));
 setInterval(sync,700);
 window.addEventListener('resize',()=>setTimeout(place,50));

 /* ---------------------------------------------------------------- the objective marker -- */
 /* Who does the current mission want you to go and see? The story records it in so many words:
    a 'talk' mission names the person, a 'clues' mission lists the people to ask and the save
    records who has already been asked, and every mission has a giver to hand in to. So: the
    giver once it is done, otherwise the named person or the next unasked witness, otherwise the
    giver. Nothing is guessed from the text. */
 const way=document.createElement('div'); way.id='seWay'; way.innerHTML='<i></i><b></b>'; document.body.appendChild(way);
 const wayArrow=way.querySelector('i'), wayTxt=way.querySelector('b');
 let wayNpc=null, wayKey='';
 const wayPlace={position:new G.THREE.Vector3()};   // a spot on the ground, for a mission that names a place
 function wayTarget(){
  try{
   const Q=G.quest, m=Q&&Q.STORY&&Q.STORY[Q.storyIdx()]; if(!m)return null;
   const s=G.save.fresh()||{}, done=Q.storyProg()>=(m.goal||1);
   const guided=G.storyGuidance?.target?.(m,s,done);if(guided!==undefined){wayKey=guided?.id||'';return guided;}
   /* a mission to open a door or to ride somewhere is about the place, not the person who set it: 'Open the old stall'
      pointed back at Grandpa Wren (and vanished beside him) while the stall stood out past the arena fence */
   if(!done&&m.type==='door'&&m.door){
    const th=((G.world&&G.world.things)||[]).find(t=>t&&t.kind==='sqdoor'&&t.id===m.door);
    if(th&&th.g){wayKey='door:'+m.door;return th.g;}
   }
   if(!done&&m.type==='visit'&&m.x!=null&&m.z!=null){
    wayKey='visit:'+m.x+','+m.z; let gy=0; try{gy=G.world.groundH(m.x,m.z);}catch(e){}
    wayPlace.position.set(m.x,gy,m.z); return wayPlace;
   }
   let id=m.npc||'wren';
   if(!done){
    if(m.talk)id=m.talk;
    else if(m.clues&&m.clues.length){ const had=(s.story&&s.story.clues)||[]; const nx=m.clues.find(c=>!had.includes(c.npc)); if(nx)id=nx.npc; }
   }
   if(id!==wayKey){ wayKey=id; wayNpc=((G.world&&G.world.npcList)||[]).find(q=>q.def&&q.def.id===id)||null; }
   return wayNpc&&wayNpc.g;
  }catch(e){ return null; }
 }
 const _wv=new G.THREE.Vector3();
 function tickWay(){
  const tg=wayTarget(), cam=G.camera, p=G.horse&&G.horse.player;
  let show=!!(tg&&cam&&p)&&!(G.course&&G.course.get&&G.course.get())&&!menu.classList.contains('on');
  if(show){
   const d=Math.hypot(tg.position.x-p.pos.x,tg.position.z-p.pos.z);
   if(d<(tg.arrivalDistance??6))show=false;
   else{
    _wv.set(tg.position.x,tg.position.y+3.1,tg.position.z).project(cam);
    const W=innerWidth,H=innerHeight, behind=_wv.z>1;
    let nx=behind?-_wv.x:_wv.x, ny=behind?-_wv.y:_wv.y;
    /* on screen and in front: sit over their head. Otherwise pin to an inset edge, in the
       direction they actually are, so a marker is always a heading you can ride toward */
    const IX=0.80, IY=0.70, off=behind||Math.abs(nx)>IX||Math.abs(ny)>IY;
    if(off){
     const k=Math.min(IX/Math.max(Math.abs(nx),1e-4),IY/Math.max(Math.abs(ny),1e-4)); nx*=k; ny*=k;
     if(behind&&ny>-0.2)ny=-0.50;
     /* the bottom corners are the thumbstick and the action buttons: along the bottom edge the
        marker keeps to the clear lane between them, and it never drops into the controls band */
     if(ny<-0.30){ nx=Math.max(-0.42,Math.min(0.42,nx)); ny=Math.max(-0.50,ny); }
     /* the top-left is the map and its hexagons, the top-right the wallet and market */
     if(ny>0.45)nx=Math.max(-0.50,Math.min(0.55,nx));
    }
    const sx=(nx*0.5+0.5)*W;let sy=(-ny*0.5+0.5)*H;
    // Keep the direction marker legible when a phone's quest card crosses its path.
    const quest=$('questTrack')?.getBoundingClientRect();
    if(quest?.height&&sx+24>quest.left&&sx-24<quest.right&&sy+24>quest.top&&sy-24<quest.bottom)sy=quest.bottom+28;
    way.style.transform='translate('+sx.toFixed(1)+'px,'+sy.toFixed(1)+'px) translate(-50%,-50%)';
    const ang=off?Math.atan2(nx,ny):0;          // up when they are ahead of you, round toward them when not
    wayArrow.style.transform='rotate('+ang.toFixed(3)+'rad)';
    const t=Math.round(d)+'m'; if(wayTxt.textContent!==t)wayTxt.textContent=t;
   }
  }
  way.classList.toggle('on',show);
 }
 G.on('tick',tickWay);

 /* ---------------------------------------------------------------- messages on a course -- */
 /* On a course a message has one rule: it never lies across the course readout, the countdown call or the count. The
    lanes above keep it clear on the layouts we know, but three packages move the readout and the call follows it (a
    phone on its side has the readout down at 154-196 px, right where the lane is), so every few frames the message box
    is measured against them and, if it would cover one, it drops to just under it. */
 const lane={t:0,base:null,key:''};
 function toastLane(dt){
  const box=$('toasts'); if(!box)return;
  const on=document.body.classList.contains('se-course')&&!document.body.classList.contains('se-screen-open');
  const sw=$('stamWrap');
  if(!on){ if(lane.base!=null){ box.style.removeProperty('top'); lane.base=null; } if(lane.sunk){ lane.sunk=false; box.style.opacity=''; } if(sw)sw.style.removeProperty('top'); return; }
  lane.t-=dt||0; if(lane.t>0)return; lane.t=0.1;
  const key=innerWidth+'x'+innerHeight;
  if(lane.base==null||lane.key!==key){ box.style.removeProperty('top'); lane.base=box.getBoundingClientRect().top; lane.key=key; }
  /* the stamina bar hangs just under the readout, however many lines the readout has come to (a figure's name, a phone) */
  { const hr=$('courseHud')&&$('courseHud').getBoundingClientRect(); if(sw&&hr&&hr.height>0)sw.style.setProperty('top',Math.round(hr.bottom+5)+'px','important'); }
  const b=box.getBoundingClientRect(), H=Math.max(b.height,40), obs=[];
  for(const id of ['courseHud','ev2Call','countdown']){
   const e=$(id); if(!e)continue; const cs=getComputedStyle(e); if(cs.display==='none'||+cs.opacity<0.05)continue;
   const r=e.getBoundingClientRect(); if(r.width>0&&r.height>0)obs.push(r);
  }
  let top=lane.base;
  for(let k=0;k<4;k++){ let moved=false; for(const r of obs)if(r.right>b.left&&r.left<b.right&&r.bottom>top&&r.top<top+H){ top=r.bottom+6; moved=true; } if(!moved)break; }
  if(Math.abs(top-lane.base)<1)box.style.removeProperty('top'); else box.style.setProperty('top',Math.round(top)+'px','important');
  /* pushed down past the readout, a message would be lying over the track itself (on an upright phone that is gate one):
     it waits out of sight instead, and comes back the moment the band above has room for it again */
  const sunk=top>lane.base+1&&top>innerHeight*0.18;
  if(sunk!==!!lane.sunk){lane.sunk=sunk;box.style.transition=sunk?'none':'opacity .2s';box.style.opacity=sunk?'0':'';}   // gone at once, back gently
 }
 G.on('tick',dt=>toastLane(dt));
 try{ new MutationObserver(()=>{lane.t=0;}).observe($('toasts'),{childList:true}); }catch(e){}   // a new message is placed the frame it arrives
 G.on('courseStart',()=>document.body.classList.add('se-course'));
 G.on('courseFinish',()=>setTimeout(sync,0));

 /* QA */
 G.seHud={root,menu,open:openMenu,close:closeMenu,HEXES,sync,way,wayTarget:()=>{const t=wayTarget();return t?{id:wayKey,x:t.position.x,z:t.position.z}:null;}};
}

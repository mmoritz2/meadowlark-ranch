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
 background:#efe6cf;color:#3a2a12;font:900 11px/18px Nunito,system-ui,sans-serif;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,.35);z-index:21;pointer-events:none}
body.se-hud #vrBtn{display:none!important}
body.se-hud #toasts{top:calc(96px + env(safe-area-inset-top))!important;bottom:auto!important;left:50%!important;right:auto!important;transform:translateX(-50%);align-items:center!important;width:min(420px,calc(100vw - 32px))!important}
/* the root every floating control hangs off */
#seHudRoot{position:fixed;inset:0;pointer-events:none;z-index:20}
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
#seMarketLbl{position:fixed;width:84px;text-align:center;font:900 12px/1 Nunito,system-ui,sans-serif;color:#f3cf6a;letter-spacing:.6px;
 text-shadow:0 1px 0 #5a3708,0 0 3px rgba(0,0,0,.65);pointer-events:none}
/* the objective on the left edge */
body.se-hud #questTrack{position:fixed!important;left:0!important;right:auto!important;top:calc(236px + env(safe-area-inset-top))!important;transform:none!important;
 max-width:min(300px,42vw)!important;height:auto!important;min-height:0!important;padding:7px 14px 7px 30px!important;margin:0!important;
 border:0!important;border-radius:0 8px 8px 0!important;background:linear-gradient(90deg,rgba(15,18,30,.62),rgba(15,18,30,.34))!important;box-shadow:none!important;
 color:#fff!important;font:800 15px/1.2 Nunito,system-ui,sans-serif!important;white-space:normal!important;text-align:left!important;
 text-shadow:0 1px 2px rgba(0,0,0,.6);opacity:1!important}
body.se-hud #questTrack::before{content:"!";position:absolute;left:0;top:0;bottom:0;width:20px;display:flex;align-items:center;justify-content:center;
 background:rgba(15,18,30,.8);color:#f3cf6a;font:900 16px/1 Nunito,system-ui,sans-serif}
/* the thumbstick: always there, bottom left, and only as big as it looks */
body.se-hud #stickZone{display:block!important;left:0!important;bottom:0!important;width:300px!important;height:300px!important;z-index:19!important}
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
/* every state that hid the dock hides this */
body.posing #seHudRoot,body.freecam #seHudRoot,body.summoning #seHudRoot,
body.posing #stickZone,body.summoning #seNorth,body.freecam #seNorth,body.posing #seNorth,
body.posing #seMarketLbl,body.freecam #seMarketLbl,body.summoning #seMarketLbl{display:none!important}
/* a phone: the same layout, a notch smaller, and the stick and actions tucked in */
@media (max-width:760px){
 #seMenuBtn{width:40px;height:40px}
 body.se-hud #mkMiniPlate,body.se-hud #mini{left:calc(50px + env(safe-area-inset-left))!important}
 body.se-hud #mkMiniPlate,body.se-hud #mini{width:104px!important;height:104px!important}
 body.se-hud #seNorth{left:calc(50px + 52px - 9px + env(safe-area-inset-left))}
 .se-hexbtn{width:44px!important;height:38px!important}
 body.se-hud #wallet .w{min-width:74px;font-size:13px!important}
 #seJump{width:118px;height:118px;right:calc(92px + env(safe-area-inset-right));bottom:calc(92px + env(safe-area-inset-bottom))}
 #seEmote{right:calc(212px + env(safe-area-inset-right))}
 body.se-hud #stickBase{width:160px!important;height:160px!important;margin:-80px 0 0 -80px!important}
 body.se-hud #stickBase::before{transform:translate(0,-70px);box-shadow:0 140px 0 rgba(246,236,210,.75)}
 body.se-hud #stickBase::after{transform:translate(-70px,0);box-shadow:140px 0 0 rgba(246,236,210,.75)}
 body.se-hud #stickKnob{width:72px!important;height:72px!important;margin:-36px 0 0 -36px!important}
}`;
 document.head.appendChild(css);
 document.body.classList.add('se-hud');

 /* ---------------------------------------------------------------- the floating layer ---- */
 const root=document.createElement('div'); root.id='seHudRoot'; document.body.appendChild(root);
 const north=document.createElement('div'); north.id='seNorth'; north.textContent='N'; document.body.appendChild(north);

 /* ☰ and the sheet it opens */
 const menuBtn=document.createElement('button'); menuBtn.id='seMenuBtn'; menuBtn.title='Menu'; menuBtn.setAttribute('aria-label','Menu');
 menuBtn.innerHTML='<i></i>'; root.appendChild(menuBtn);
 const menu=document.createElement('div'); menu.id='seMenu'; menu.setAttribute('role','dialog'); menu.setAttribute('aria-label','Menu');
 menu.innerHTML='<div class="se-sheet"><div class="se-bar"><span><b id="seMenuName">Menu</b><br><small id="seMenuSub"></small></span><button class="se-x" aria-label="Close">✕</button></div><div class="se-tiles" id="seTiles"></div></div>';
 document.body.appendChild(menu);
 const tiles=menu.querySelector('#seTiles');
 const closeMenu=()=>menu.classList.remove('on');
 menuBtn.onclick=()=>{ paintMenuHead(); menu.classList.toggle('on'); };
 menu.querySelector('.se-x').onclick=closeMenu;
 menu.addEventListener('click',e=>{ if(e.target===menu)closeMenu(); else if(e.target.closest('.se-tiles>button'))setTimeout(closeMenu,0); });
 document.addEventListener('keydown',e=>{ if(e.key==='Escape'&&menu.classList.contains('on'))closeMenu(); });
 function paintMenuHead(){
  try{
   const s=G.save.fresh()||{}, h=(s.horses||[])[G.horse.rideIdx()]||{};
   $('seMenuName').textContent=(s.name||s.playerName||'Your ranch');
   $('seMenuSub').textContent=h.name?('with '+h.name+' · Lv '+(h.level||1)):'';
  }catch(e){}
 }

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
 const placed=new Set();
 function hexify(el,spec){
  el.classList.add('se-hexbtn');
  el.style.setProperty('background-image',hexSvg(spec.icon),'important');
  el.style.left='calc('+spec.x+'px + env(safe-area-inset-left))';
  el.style.top='calc('+spec.y+'px + env(safe-area-inset-top))';
  root.appendChild(el);
 }
 function place(){
  /* the hexes and the market: move the real buttons */
  for(const idn in HEXES){ try{ const el=$(idn); if(el&&el.parentElement!==root){hexify(el,HEXES[idn]);placed.add(idn);} }catch(e){} }
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
  /* the ☰ carries a pip when anything inside it does */
  try{
   const any=[...tiles.querySelectorAll('.pip,.badge')].some(p=>p.offsetParent!==null||p.textContent.trim());
   let mp=menuBtn.querySelector('.se-pip');
   if(any&&!mp){mp=document.createElement('span');mp.className='se-pip';menuBtn.appendChild(mp);} else if(!any&&mp)mp.remove();
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

 /* QA */
 G.seHud={root,menu,open:()=>{paintMenuHead();menu.classList.add('on');},close:closeMenu,HEXES,sync};
}

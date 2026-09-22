/* Feature package 'ui2-hud' — the rider's dashboard.

   Everything a rider needs mid-gallop lives in four corners of the screen, and until now
   each corner was built by a different hand: the status card showed four unlabelled colour
   bars, the wallet crammed five currencies (plus a VIP badge) into one undifferentiated
   row, the quest pill wrapped or clipped, the minimap was a bare canvas on green grass and
   toasts were a plain dark slab whatever they said.

   This package owns the presentation of all of it, and it owns it from the outside: the
   game keeps writing exactly the elements it always wrote ($('scbH').style.width,
   $('scName').textContent, $('coinEl').textContent, $('questTrack').textContent,
   .toast), and every id, every element and the VR mirror (vrPct/vrTxt read those same
   nodes) survive untouched.  What changes is the frame around them.

   1. STATUS CARD.  The four needs become labelled compact meters — icon, name, percentage,
      track — with state colour (good / warn / crit) instead of four decorative hues, and
      the XP bar carries its level.  The name line is parsed out of #scName ("Clover · Lv 4
      ❤️❤️❤️") into a display name, a brass level chip and five heart pips, so the card has a
      hierarchy instead of one long string.  #scName itself keeps its text for VR and the
      updater; it is simply no longer the thing you read.
   2. WALLET.  One chip shape for every currency — coin, gem, key, dust, tokens, VIP — with
      tabular figures, thousands separators, a minimum width so the number does not dance,
      and a badge slot that sits beside the figure instead of on top of it.  Empty
      currencies collapse.
   3. QUEST PILL.  Fixed height, one line, ellipsis, a full-text tooltip, and a progress
      fraction that is allowed to shrink last.
   4. MINIMAP.  A brass-ringed porthole on a leather plate with a compass tick, so it reads
      against grass instead of dissolving into it.
   5. TOASTS + REWARD MOMENT.  One treatment: the leading emoji becomes an icon disc, the
      body sets in Nunito, and the accent is chosen from the message (reward / good / warn /
      bad).  A reward toast lands with the same small celebratory beat everywhere, honoured
      by prefers-reduced-motion.

   ---- the second pass: how much of the screen the furniture is allowed to have ----

   All of the above made each corner handsome.  None of it asked whether the corner should be
   there at all, and a screenshot of the open world answers that: six things compete for the
   eye before the horse gets a look in, and on a 390px phone the chrome owns the top 500px of
   an 844px screen.  So:

   6. ONE TOP BAR.  The wallet and the system buttons were two glass slabs 8px apart in the
      same corner doing the same job.  #hud itself becomes the glass and the two groups become
      its contents, divided by a hairline — one object where there were two.  The headset
      button, which announces itself at full strength to the overwhelming majority of players
      who have no headset, drops to a half-tone offer that comes up on hover.
   7. THE DOCK.  Seventeen buttons, 1348px of them, six of which were a bare emoji with no
      word attached, and the last two scrolled off the right-hand edge of a 1440px screen
      behind a mask that hid the fact.  It becomes six labelled destinations and one door:
      Care, Stable, Events, Shop, Quests, Club, then ⋯ More, which opens a small grouped menu
      holding everything else under a heading that says what it is for.  Every button in it,
      wherever it ends up, is normalised to glyph + label, so the phone can stack the two and
      the menu can lay them out in a row, and so nothing is ever a naked pictogram again.
      The buttons are MOVED, never rebuilt: each keeps its id, its onclick and its pip.
   8. THE CARE CARD EARNS ITS SPACE.  Four meters, a dropdown, an XP bar and four buttons sat
      open at all times to say a horse was 90% fed.  It now shows the portrait, the name, the
      level and the bond while all is well, and opens itself — with a line saying which need
      and how badly — the moment one falls.  Hover, keyboard focus or a tap opens it anyway.
      A phone answers a low need with that ONE line and stays small, because an open card there
      is 250px tall over a corner 176px wide and it lands on top of the first three items of
      the nav bar; the tap still opens the rest.
   9. THE HINT STRIP LEAVES.  "W/↑ ride · A/D steer …" is true for about a minute and then it
      is a black bar across the bottom of every screenshot for the rest of the session, sitting
      4px from where the "Talk to Wren (E)" prompt wants to be.  Two and a bit seconds of
      actual riding is proof the player has the controls, and it fades.
  10. THE QUEST PILL STOPS SHOUTING.  Two bright pills at the same height at the top of the
      frame is one too many; the objective keeps its place and gives up its weight, so the
      wallet is unambiguously the brighter of the two.

   No behaviour, no ids, no ranch3d.html: the CSS is injected from here and the DOM work is
   additive wrappers and moves, each in its own try/catch, so a shape this file did not expect
   is left exactly as it was. */
export const id='ui2-hud';
export function install(G){
 const $=id=>document.getElementById(id);

 /* ================= 1. stylesheet ================= */
 try{
  if(!document.getElementById('mkHud2Css')){
   const st=document.createElement('style'); st.id='mkHud2Css';
   st.textContent=`
/* ---------- shared HUD language ---------- */
#statusCard,#wallet,#questTrack,.toast,#mkMiniPlate{--hud-ink:var(--ink);--hud-line:rgba(255,255,255,.72)}

/* ---------- 1. status card ---------- */
#statusCard{width:264px;padding:11px 12px 10px;gap:9px;box-shadow:var(--e2);border-radius:22px}
#statusCard #scTop{align-items:flex-start;gap:11px}
#statusCard #scPortrait{width:56px;height:56px;border:3px solid #fffaf1;box-shadow:0 0 0 2px var(--brass),0 3px 10px rgba(50,32,10,.28)}
.mk-sc-port{position:relative;flex:none;display:block}
.mk-sc-port .mk-sc-img{position:absolute;left:3px;top:3px;right:3px;bottom:3px;width:calc(100% - 6px);height:calc(100% - 6px);
 border-radius:50%;object-fit:cover;display:block;pointer-events:none}
#statusCard #gaitEl{left:38px;top:38px;width:23px;height:23px;font-size:12px;box-shadow:0 2px 5px rgba(50,32,10,.28)}
#statusCard #scInfo{gap:6px}
#scName{display:none!important}
.mk-hud-name{display:flex;align-items:baseline;gap:6px;min-width:0}
.mk-hud-name b{font-family:var(--display);font-weight:600;font-size:16px;line-height:1.1;color:var(--ink);
 white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;flex:1}
.mk-hud-lvl{flex:none;font-family:var(--display);font-weight:600;font-size:11px;line-height:16px;padding:0 7px;
 border-radius:var(--r-full);background:linear-gradient(#ffe7a6,#e9bb52);color:#4a3210;
 box-shadow:inset 0 1px 0 rgba(255,255,255,.7);font-variant-numeric:tabular-nums}
.mk-hud-hearts{display:flex;gap:2px;align-items:center;line-height:1;margin-top:1px}
.mk-hud-hearts i{width:8px;height:8px;border-radius:50%;background:rgba(59,42,30,.16);display:block}
.mk-hud-hearts i.on{background:linear-gradient(160deg,#f08aa6,#d9534f);box-shadow:0 1px 2px rgba(160,50,60,.35)}
#statusCard #horseSel{font-family:var(--font);font-weight:700;font-size:12px;padding:4px 10px;min-height:28px}

/* the four needs — labelled compact meters, state colour not decoration */
#statusCard .scbars{display:grid;grid-template-columns:1fr 1fr;gap:5px 10px;margin-top:1px}
#statusCard .scb{height:auto;background:none;border-radius:0;overflow:visible;
 display:grid;grid-template-columns:13px 1fr auto;align-items:center;column-gap:4px;row-gap:3px}
#statusCard .scb::before{content:attr(data-ico);font-size:11px;line-height:13px;grid-row:1;grid-column:1;text-align:center}
#statusCard .scb .mk-scb-lbl,#statusCard .scb .mk-scb-val{grid-row:1;font-size:9.5px;font-weight:800;
 letter-spacing:.04em;text-transform:uppercase;color:var(--ink-3);line-height:13px}
#statusCard .scb .mk-scb-lbl{grid-column:2;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#statusCard .scb .mk-scb-val{grid-column:3;font-variant-numeric:tabular-nums;color:var(--ink-2)}
/* the game keeps writing i{width:NN%}; the fill simply gains a track to live inside */
#statusCard .scb .mk-track{grid-column:1/4;grid-row:2;height:6px;border-radius:4px;background:rgba(59,42,30,.14);overflow:hidden;display:block}
#statusCard .scb .mk-track>i{height:6px;border-radius:4px;display:block;background:var(--meadow);transition:width .35s ease}
#statusCard .scb[data-state="crit"]{animation:mkNeedPulse 1.6s ease-in-out infinite}
@keyframes mkNeedPulse{0%,100%{opacity:1}50%{opacity:.6}}
@media(prefers-reduced-motion:reduce){#statusCard .scb[data-state="crit"]{animation:none}}
#statusCard .scb[data-state="crit"] .mk-scb-val,#statusCard .scb[data-state="crit"] .mk-scb-lbl{color:var(--bad)}
#statusCard .scb[data-state="warn"] .mk-scb-val{color:var(--warn)}

#statusCard .mk-xp{display:grid;grid-template-columns:1fr auto;align-items:center;gap:4px;margin-top:2px}
#statusCard .mk-xp-lbl{grid-column:1/3;font-size:9.5px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;
 color:var(--ink-3);display:flex;justify-content:space-between;gap:8px;font-variant-numeric:tabular-nums}
#statusCard #scXp{grid-column:1/3;height:6px;border-radius:4px;background:rgba(59,42,30,.14)}
#statusCard #scXp i{border-radius:4px;transition:width .35s ease}
#statusCard #scBtns{gap:6px;margin-top:1px}
#statusCard #scBtns button{height:40px;min-height:40px;border-radius:12px;font-size:17px}

/* ---------- 1b. the card at rest ----------
   A contented horse is a portrait, a name, a level and five hearts; the meters, the picker,
   the XP line and the four care buttons are the answer to a question nobody asked while every
   need sits at 90%.  Everything hangs off one class, and off :hover / :focus-within, so the
   full card is always one gesture away and a keyboard never loses the controls inside it. */
#statusCard{transition:width .2s ease,padding .2s ease}
#statusCard.mk-sc-lean:not(:hover):not(:focus-within){width:auto;max-width:244px;padding:9px 15px 9px 10px;gap:0;cursor:pointer}
#statusCard.mk-sc-lean:not(:hover):not(:focus-within) #horseSel,
#statusCard.mk-sc-lean:not(:hover):not(:focus-within) .scbars,
#statusCard.mk-sc-lean:not(:hover):not(:focus-within) .mk-xp,
#statusCard.mk-sc-lean:not(:hover):not(:focus-within) #scBtns{display:none}
#statusCard.mk-sc-lean:not(:hover):not(:focus-within) #scInfo{gap:4px}
#statusCard.mk-sc-lean:not(:hover):not(:focus-within) #scPortrait{width:46px;height:46px;font-size:23px}
#statusCard.mk-sc-lean:not(:hover):not(:focus-within) #gaitEl{left:30px;top:30px;width:20px;height:20px;font-size:10px}
/* the lid.  It is the only affordance a touch player has, so it is a real 22px target, and it
   points the way the next tap will go.  Which way that is has to be decided by exactly the
   selectors that do the collapsing, or it ends up promising "close" on a card that is already
   shut — as it did on a phone, where an alert collapses the card but does not un-lean it. */
.mk-sc-tog{flex:none;width:22px;height:22px;margin:-3px -4px -3px 0;border-radius:50%;cursor:pointer;
 display:flex;align-items:center;justify-content:center;font-style:normal;font-size:11px;line-height:1;
 color:var(--ink-3);transition:transform .2s ease,background .15s;transform:rotate(180deg)}
.mk-sc-tog:hover{background:rgba(59,42,30,.09);color:var(--ink-2)}
#statusCard.mk-sc-lean:not(:hover):not(:focus-within) .mk-sc-tog{transform:none}
/* When the card opens itself it says why, in words, above the meter that caused it.  A block
   and not a flex row: text-overflow has no inline box to trim inside a flex container, so an
   ellipsis there is a promise the browser never keeps.  The space in the string is the gap. */
.mk-sc-cue{display:block;font-size:10.5px;font-weight:800;letter-spacing:.02em;
 padding:4px 8px;border-radius:9px;line-height:1.4;background:var(--warn-bg);color:#8a5a12;
 white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mk-sc-cue[data-state="crit"]{background:var(--bad-bg);color:var(--bad)}
#statusCard:not(.mk-sc-alert) .mk-sc-cue{display:none}

/* ---------- 2. wallet ---------- */
/* No slab of its own any more: #hud is the glass and the wallet is the left half of it. */
#wallet{gap:6px;padding:0 2px 0 7px;flex-wrap:nowrap;background:none;box-shadow:none;border:0;
 backdrop-filter:none;-webkit-backdrop-filter:none}
#wallet .w{gap:5px;padding:3px 10px 3px 7px;border-radius:var(--r-full);background:rgba(255,255,255,.55);
 box-shadow:inset 0 0 0 1px rgba(255,255,255,.6);font-size:14px;line-height:20px;white-space:nowrap}
#wallet .w i,#wallet .w>span>i{font-size:14px;line-height:1;font-style:normal;flex:none}
#wallet .w b,#wallet .w>span>b{font-variant-numeric:tabular-nums;font-weight:700;min-width:1.6em;text-align:right;
 letter-spacing:.01em}
#wallet .w.mk-w-empty{display:none}
#wallet .w[data-cur="coin"]{background:rgba(255,236,193,.7)}
#wallet .w[data-cur="gem"]{background:rgba(219,233,255,.72)}
#wallet .w[data-cur="key"]{background:rgba(236,232,222,.72)}
#wallet #vipEl{background:linear-gradient(#ffe7a6,#e9bb52);color:#4a3210;box-shadow:inset 0 1px 0 rgba(255,255,255,.7);
 font-family:var(--display);font-weight:600;gap:4px}
#wallet #vipEl b{min-width:0;font-size:12px}
/* the double-gem weekend badge: beside the figure, never on top of it */
#wallet .gemx2{vertical-align:middle;margin-left:5px;font-size:9.5px;line-height:15px;padding:0 6px;
 border-radius:var(--r-full);background:var(--barn);color:#fff;box-shadow:0 1px 3px rgba(120,40,36,.4);letter-spacing:.02em}
/* any multiplier badge a package paints keeps its own breathing room */
#wallet .mk-mult{flex:none;margin-left:2px;font-size:10px;font-weight:800;line-height:14px;padding:0 5px;border-radius:var(--r-full);
 background:var(--ink);color:var(--ink-inv);font-variant-numeric:tabular-nums}

/* ---------- 2b. the top bar: the wallet and the buttons are one object ----------
   #hud already held both of them 8px apart; it simply had no surface of its own, so the eye
   counted two.  Giving the container the glass and taking it off the contents costs nothing
   and removes a focal point.  #hud keeps pointer-events:none, so the new padding is not a
   strip of dead screen — clicks fall through it to the world. */
#hud{background:var(--glass);backdrop-filter:blur(16px) saturate(1.25);-webkit-backdrop-filter:blur(16px) saturate(1.25);
 border:1px solid var(--glass-line);border-radius:var(--r-full);padding:5px 6px;gap:5px;
 box-shadow:var(--e2),inset 0 1px 0 rgba(255,255,255,.85)}
#sysBtns{gap:3px;padding-left:9px;position:relative}
#sysBtns::before{content:"";position:absolute;left:2px;top:7px;bottom:7px;width:1px;background:var(--line)}
#sysBtns button.ico{width:31px;height:31px;font-size:14.5px;background:rgba(255,255,255,.5);
 border:1px solid transparent;box-shadow:none;backdrop-filter:none;-webkit-backdrop-filter:none}
#sysBtns button.ico:hover{background:rgba(224,178,90,.24);border-color:rgba(224,178,90,.4)}
/* The headset is an offer, not an announcement: almost nobody looking at this screen owns
   one, and at full strength it was the third object in a corner that should hold one. */
#vrBtn{opacity:.45!important;font-size:11.5px!important;font-weight:700!important;padding:5px 12px!important;
 transition:opacity .18s ease!important}
#vrBtn:hover,#vrBtn:focus-visible{opacity:1!important}

/* ---------- 3. quest pill ---------- */
/* Centred on the wallet's row the pill had 330px before it hit the coin chip, which turns
   every mission into an ellipsis.  It gets its own line under the top chrome instead — and
   it gives up its weight there, because two cream pills of equal brightness at the top of the
   frame is one more than the eye can rank.  The objective is the quieter of the two. */
#questTrack{top:calc(58px + env(safe-area-inset-top));display:flex;align-items:center;gap:0;min-height:30px;
 padding:0 14px;font-family:var(--font);color:var(--ink-2);
 font-weight:600;font-size:12.5px;line-height:30px;max-width:min(42vw,470px);
 background:rgba(255,250,241,.62);border-color:rgba(255,255,255,.5);
 box-shadow:0 2px 9px rgba(40,25,5,.13);
 white-space:nowrap;overflow:hidden;text-overflow:ellipsis;border-left-width:1px}
#questTrack:empty{display:none}

/* ---------- 4. minimap ---------- */
#mkMiniPlate{position:fixed;bottom:calc(16px + env(safe-area-inset-bottom));left:calc(16px + env(safe-area-inset-left));
 z-index:6;width:148px;height:148px;border-radius:50%;pointer-events:none;
 background:radial-gradient(circle at 50% 46%,rgba(255,250,241,.35),rgba(74,50,32,.55));
 box-shadow:0 0 0 1px rgba(74,50,32,.35),0 8px 22px rgba(30,18,6,.42)}
#mkMiniPlate::after{content:"N";position:absolute;top:-11px;left:50%;transform:translateX(-50%);
 font-family:var(--display);font-weight:600;font-size:10px;color:#4a3210;line-height:15px;width:19px;text-align:center;
 border-radius:var(--r-full);background:linear-gradient(#ffe7a6,#e0b25a);box-shadow:0 2px 5px rgba(30,18,6,.4)}
#mini{border:3px solid rgba(255,250,241,.95);
 box-shadow:0 0 0 2px var(--brass-2),0 0 0 5px rgba(74,50,32,.35),0 8px 22px rgba(30,18,6,.35);
 background:rgba(74,50,32,.25)}
body.posing #mkMiniPlate,body.freecam #mkMiniPlate,body.summoning #mkMiniPlate{display:none!important}

/* ---------- 5. toasts + the reward moment ---------- */
#toasts{gap:8px}
.toast{display:flex;align-items:center;gap:10px;width:auto;max-width:100%;margin-left:auto;
 background:var(--dark);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);
 color:var(--ink-inv);padding:9px 14px 9px 10px;border-radius:16px;border-left:3px solid var(--brass);
 box-shadow:var(--e2);font-family:var(--font);font-weight:700;font-size:13px;line-height:1.35;
 animation:mkToastIn .26s cubic-bezier(.2,.9,.3,1.2)}
.toast .mk-toast-ico{flex:none;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;
 font-size:15px;background:rgba(255,250,241,.16);box-shadow:inset 0 0 0 1px rgba(255,250,241,.22)}
.toast .mk-toast-txt{min-width:0;overflow-wrap:anywhere}
.toast.mk-t-good{border-left-color:var(--meadow)}
.toast.mk-t-good .mk-toast-ico{background:rgba(95,181,106,.26)}
.toast.mk-t-warn{border-left-color:var(--warn)}
.toast.mk-t-warn .mk-toast-ico{background:rgba(217,144,47,.28)}
.toast.mk-t-bad{border-left-color:var(--barn)}
.toast.mk-t-bad .mk-toast-ico{background:rgba(217,83,79,.3)}
.toast.mk-t-reward{border-left-color:var(--brass);
 background:linear-gradient(100deg,rgba(74,50,32,.92),rgba(43,30,20,.9));
 box-shadow:var(--e2),0 0 0 1px rgba(224,178,90,.45),0 0 26px rgba(224,178,90,.28);
 animation:mkRewardIn .4s cubic-bezier(.2,.9,.3,1.25)}
.toast.mk-t-reward .mk-toast-ico{background:linear-gradient(#ffe7a6,#e0b25a);color:#4a3210;
 box-shadow:0 0 0 1px rgba(255,240,194,.5),0 0 12px rgba(224,178,90,.5)}
@keyframes mkToastIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@keyframes mkRewardIn{0%{opacity:0;transform:translateY(12px) scale(.94)}60%{opacity:1;transform:translateY(0) scale(1.03)}100%{transform:scale(1)}}
@media(prefers-reduced-motion:reduce){
 .toast{animation:none!important}
}

/* ---------- 6. the dock ----------
   Seventeen buttons came to 1348px on a 1440px screen, so the last two lived off the right
   edge behind a mask whose whole job was to make that look deliberate.  Six destinations and
   a door fit in half the band with room to spare, and the mask goes: there is nothing left
   off-screen to hint at.  overflow:visible is what lets the menu hang out of the bar, and it
   is safe precisely because the bar no longer overflows. */
#dock{gap:3px;padding:5px;border-radius:20px;overflow:visible;
 flex-wrap:wrap;justify-content:center;
 -webkit-mask-image:none;mask-image:none}
/* The bar was anchored to the band right of the minimap because at 1348px wide a
   viewport-centred dock slid its first item under the map.  At 665px it does not, so above
   1180px the band is made symmetric and the bar lands on the middle of the screen, where a
   nav belongs.  Below that the left inset still does the avoiding, and flex-wrap above is the
   net: if a bar ever outgrows its band again it takes a second row, where every item stays
   readable, rather than sliding off the edge behind a gradient. */
@media(min-width:1180px){#dock{right:calc(186px + env(safe-area-inset-right))}}
#dock button{position:relative;border-radius:13px;gap:6px;padding:0 12px;font-size:13px}
#dock button:focus-visible{outline:2px solid var(--brass-2);outline-offset:1px}
#dock .mk-dk-lbl{white-space:nowrap}
/* the buttons whose insides belong to someone else (see labelise) */
#dock button.mk-dk-raw{font-size:0}
#dock button.mk-dk-raw::before{content:attr(data-mk-glyph);font-size:13px;line-height:1}
#dock button.mk-dk-raw::after{content:attr(data-mk-label);font-size:13px;font-weight:700;line-height:1;white-space:nowrap}
#dock button.mk-dk-raw .pip,#dock button.mk-dk-raw .badge{font-size:10px;line-height:15px}
/* the door, and the hairline that says the rest is behind it */
#dock .mk-dk-more{margin-left:6px;font-weight:700}
#dock .mk-dk-more::before{content:"";position:absolute;left:-5px;top:9px;bottom:9px;width:1px;background:var(--line)}
#dock.mk-dk-open .mk-dk-more{background:var(--ink);color:var(--ink-inv);border-color:var(--ink)}
/* The menu is a CHILD of the dock on purpose: it inherits the accessibility zoom
   account-economy paints onto #dock, it is hidden by every body.posing / .freecam /
   .summoning rule that already hides the dock, and it needs no javascript to stay anchored
   to the button that opens it. */
/* Two columns, because eleven items and four headings in one stack is 740px of a 900px
   screen — a menu that covers the game it is a menu for.  Multi-column rather than grid:
   the groups are different heights and column balancing sorts that out by itself. */
#mkDockMenu{position:absolute;right:2px;bottom:calc(100% + 9px);z-index:2;width:430px;
 display:none;column-count:2;column-gap:14px;padding:12px 12px 2px;border-radius:18px;text-align:left;
 background:var(--paper);border:1px solid var(--line);box-shadow:0 14px 40px rgba(30,18,6,.34);
 animation:mkDkIn .16s cubic-bezier(.2,.9,.3,1.1)}
#dock.mk-dk-open #mkDockMenu{display:block}
@keyframes mkDkIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@media(prefers-reduced-motion:reduce){#mkDockMenu{animation:none}}
.mk-dk-grp{display:flex;flex-direction:column;gap:2px;break-inside:avoid;margin-bottom:11px}
.mk-dk-grp.mk-dk-off{display:none}
.mk-dk-h{font-size:9.5px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:var(--ink-3);
 padding:0 9px 3px}
.mk-dk-items{display:flex;flex-direction:column;gap:1px}
#dock .mk-dk-items button{justify-content:flex-start;width:100%;height:36px;min-height:36px;
 padding:0 9px;font-size:13.5px;border-radius:10px;font-weight:700;gap:9px}
/* and the menu's own font-size must not undo the 0 that hides a raw button's text: same
   specificity as the rule above, so it has to come after it */
#dock .mk-dk-items button.mk-dk-raw{font-size:0}
#dock .mk-dk-items button.mk-dk-raw::before,
#dock .mk-dk-items button.mk-dk-raw::after{font-size:13.5px}
#dock .mk-dk-items button .pip{margin-left:auto}

/* ---------- 7. the hint strip ----------
   True for about a minute, then a black bar across the bottom of every screenshot for the
   rest of the session — and 4px from where the "Talk to Wren (E)" prompt wants to stand. */
#hint{font-size:12px;font-weight:600;padding:6px 15px;background:rgba(43,30,20,.72);
 border-color:rgba(255,248,234,.12);transition:opacity .55s ease}
#hint.mk-hint-done{opacity:0!important}

/* ---------- narrow desktop / tablet ----------
   Below ~1100px the centred pill would run under the horse card, so it goes back to the
   right-hand slot the tablet layout already keeps for it. */
@media(max-width:1100px){
 #questTrack{top:calc(104px + env(safe-area-inset-top));left:auto;right:calc(12px + env(safe-area-inset-right));
  transform:none;max-width:calc(100vw - 300px)}
}

/* ---------- phone ---------- */
@media(max-width:760px){
 /* the dock has moved up to 140px (see below); the pill takes the first clear line beneath it
    and finally gets the full width of the screen to truncate inside */
 #questTrack{top:calc(202px + env(safe-area-inset-top));left:12px;right:auto;transform:none;
  max-width:calc(100vw - 24px)}
 /* narrow enough that the 📷 button behind it stays reachable once the wallet wraps */
 #statusCard{width:calc(45vw - 8px);max-width:176px;padding:8px 9px;gap:6px}
 /* At rest the card is content-width, so it needs its own ceiling here or it walks straight
    into the wallet: 48vw each, 4vw of air between them. */
 #statusCard.mk-sc-lean:not(:hover):not(:focus-within),
 #statusCard.mk-sc-alert:not(.mk-sc-open):not(:hover):not(:focus-within){max-width:calc(48vw - 8px);padding:7px 11px 7px 7px;
  width:auto;gap:0;cursor:pointer}
 #statusCard.mk-sc-lean:not(:hover):not(:focus-within) #scPortrait,
 #statusCard.mk-sc-alert:not(.mk-sc-open):not(:hover):not(:focus-within) #scPortrait{width:38px;height:38px;font-size:19px}
 #statusCard.mk-sc-lean:not(:hover):not(:focus-within) #gaitEl,
 #statusCard.mk-sc-alert:not(.mk-sc-open):not(:hover):not(:focus-within) #gaitEl{left:25px;top:24px;width:17px;height:17px;font-size:9px}
 /* The phone answers a low need with ONE extra line, not with the whole card: an expanded
    card here is 250px tall over a 176px-wide screen corner and it lands on top of the first
    three items of the nav bar.  The cue says what is wrong; a tap (.mk-sc-open) or a focus
    opens the rest. */
 #statusCard.mk-sc-alert:not(.mk-sc-open):not(:hover):not(:focus-within) #horseSel,
 #statusCard.mk-sc-alert:not(.mk-sc-open):not(:hover):not(:focus-within) .scbars,
 #statusCard.mk-sc-alert:not(.mk-sc-open):not(:hover):not(:focus-within) .mk-xp,
 #statusCard.mk-sc-alert:not(.mk-sc-open):not(:hover):not(:focus-within) #scBtns{display:none}
 #statusCard.mk-sc-alert:not(.mk-sc-open):not(:hover):not(:focus-within) #scInfo{gap:4px}
 /* and the lid points at the shut card, not away from it */
 #statusCard.mk-sc-alert:not(.mk-sc-open):not(:hover):not(:focus-within) .mk-sc-tog{transform:none}
 /* 176px of card, and the lid was eating the name's last two letters */
 .mk-sc-tog{width:18px;height:18px;font-size:10px;margin:-2px -3px -2px 0}
 .mk-hud-lvl{font-size:10px;padding:0 5px}
 .mk-sc-cue{font-size:10px;padding:3px 7px}
 #statusCard #scPortrait{width:42px;height:42px;font-size:22px}
 .mk-sc-port .mk-sc-img{left:2px;top:2px;width:calc(100% - 4px);height:calc(100% - 4px)}
 #statusCard #gaitEl{left:28px;top:26px;width:19px;height:19px;font-size:10px}
 .mk-hud-name b{font-size:14px}
 /* four meters abreast: the icon carries the name, the figure is never the part that
    gets cut */
 /* Two abreast, not four: four meters in a 176px card leave 35px each, which shows "9"
    where the reading is "90%".  minmax(0,·) keeps the tracks shrinkable whatever happens,
    and the icon carries the name the word used to. */
 #statusCard .scbars{grid-template-columns:repeat(2,minmax(0,1fr));gap:4px 8px}
 #statusCard .scb{grid-template-columns:12px minmax(0,1fr);column-gap:4px;min-width:0;row-gap:2px}
 #statusCard .scb::before{font-size:10.5px;line-height:12px}
 #statusCard .scb .mk-scb-lbl{display:none}
 #statusCard .scb .mk-scb-val{grid-column:2;font-size:9.5px;line-height:12px;letter-spacing:.02em;
  white-space:nowrap;overflow:hidden;min-width:0}
 /* the card has ~150px of headroom before the dock: the XP caption is the line that goes,
    since the bar keeps the reading in its tooltip */
 #statusCard .mk-xp-lbl{display:none}
 #statusCard .scb .mk-track,#statusCard .scb .mk-track>i{height:5px}
 #statusCard .mk-xp-lbl{font-size:9px}
 /* The top bar was three stacked objects — a wrapped wallet, a row of 38px discs and the
    headset — pinned to a column half the screen wide.  The card beside it is lean now, so the
    bar gets the width back, keeps its two rows and reads as one thing with a rule across it.
    align-items:stretch matters more than it looks: flex-end sizes each row to its own content
    and lets it hang out of the container to the LEFT, straight across the horse card, instead
    of wrapping inside it — which is exactly what a four-chip wallet did. */
 #hud{width:auto;max-width:calc(48vw - 12px);padding:4px 5px;gap:3px;align-items:stretch}
 #sysBtns{padding-left:0;padding-top:4px;gap:4px;justify-content:flex-end}
 #sysBtns::before{left:5px;right:0;top:0;bottom:auto;width:auto;height:1px}
 #sysBtns button.ico{width:28px;height:28px;font-size:13px;flex:none}
 /* the wallet wraps before it clips: a coin count you cannot see is worse than two rows */
 #wallet{gap:3px;padding:0 1px;flex-wrap:wrap;justify-content:flex-end;row-gap:4px}
 #wallet .w{font-size:11.5px;line-height:17px;padding:2px 5px 2px 4px;gap:3px}
 #wallet .w i,#wallet .w>span>i{font-size:11.5px}
 #wallet .w b,#wallet .w>span>b{min-width:1em}
 #wallet .gemx2{margin-left:3px;font-size:9px;line-height:13px;padding:0 4px}
 #questTrack{min-height:28px;line-height:28px;font-size:12px;padding:0 12px}
 #mkMiniPlate{width:104px;height:104px;left:12px;z-index:7}
 #mkMiniPlate::after{font-size:9px;line-height:13px;width:16px;top:-9px}
 #mini{width:96px;height:96px}
 .toast{font-size:12.5px;padding:8px 12px 8px 9px}
 .toast .mk-toast-ico{width:25px;height:25px;font-size:13px}
}

/* ---------- the phone dock ----------
   720px is the width at which the scaffold moves the dock to the TOP of the screen, clear of
   the joystick that owns the bottom-left 46vw and the button pad that owns the bottom-right,
   so this block has to match that breakpoint exactly and not the 760px one above.  Six labels
   in a row do not fit in 390px; six labels UNDER their glyphs do, which is why every button
   was normalised to glyph + span in the first place.  The menu opens downward here, because
   the bar it hangs off is at the top. */
@media(max-width:720px){
 /* The top bar is two rows now rather than three-and-a-wrap, so 156px of dead sky can come
    down to 140 and the world gets the difference.  Not further: the headset offer sits at
    110px on the right and the horse card can reach 104px on the left when it is carrying a
    cue line, and a nav bar that lands on either of them is a worse trade than 16px of sky.
    The offer itself shrinks — on a phone it is the least likely button on the screen. */
 #dock{top:calc(140px + env(safe-area-inset-top));padding:4px;gap:2px;justify-content:space-between;border-radius:18px}
 #vrBtn{font-size:10.5px!important;padding:4px 10px!important}
 #dock button{flex:1 1 0;min-width:0;height:46px;min-height:46px;padding:0 3px;
  flex-direction:column;gap:1px;font-size:15px;line-height:1.05}
 #dock .mk-dk-lbl{font-size:9px;font-weight:800;max-width:100%;overflow:hidden;text-overflow:ellipsis}
 #dock button.mk-dk-raw::before{font-size:15px}
 #dock button.mk-dk-raw::after{font-size:9px;font-weight:800}
 #dock .mk-dk-items button.mk-dk-raw::before,
 #dock .mk-dk-items button.mk-dk-raw::after{font-size:13.5px;font-weight:700}
 /* a column has no room for the pip in the flow, so it goes to the corner of the tile */
 #dock button .pip{position:absolute;top:2px;right:2px;margin:0}
 #dock .mk-dk-more{margin-left:2px}
 #dock .mk-dk-more::before{display:none}
 /* A sheet the width of the screen, hanging off the bottom of the bar.  No max-height and no
    overflow here on purpose: a multi-column box with a capped height does not scroll, it lays
    the overflow out in MORE columns off to the side, and overflow-y:auto drags overflow-x
    along with it — so the cap that looked like a safety net would be a sideways scroller with
    items hidden in it.  Four groups and eleven items come to ~450px in the ~650px below the
    bar; a fifth group would need this thought about again. */
 #mkDockMenu{top:calc(100% + 8px);bottom:auto;left:0;right:0;width:auto}
 /* inside the menu there is width for a proper row again */
 #dock .mk-dk-items button{flex-direction:row;height:40px;min-height:40px;font-size:14px;gap:9px;padding:0 10px}
 #dock .mk-dk-items button .pip{position:static;margin-left:auto}
 #dock .mk-dk-items .mk-dk-lbl{font-size:13px;font-weight:700}
}`;
   (document.head||document.documentElement).appendChild(st);
  }
 }catch(e){}

 /* ================= 2. status card ================= */
 /* The needs the game paints, in the order it paints them, with the label the care panel
    uses.  Each one keeps its own <i id="scbX"> — the element the updater and the VR mirror
    both write — and simply gains a track to live in and a caption above it. */
 const NEEDS=[['scbH','🥕','Food'],['scbT','💧','Water'],['scbC','🧼','Clean'],['scbY','💗','Happy']];
 /* What the card says when it opens itself, per need, at the two levels of trouble.  The
    wording is the rider's, not the meter's: "Thirsty" is a thing you act on, "water 31%" is a
    thing a spreadsheet says.  The horse's name is on the line directly above, so it is not
    repeated here — which also keeps the line inside a 176px card on a phone. */
 const CUE={scbH:['🥕','Getting hungry','Hungry'],scbT:['💧','Getting thirsty','Thirsty'],
  scbC:['🧼','Could use a brush','Needs a groom'],scbY:['💗','Getting bored','Unhappy']};
 let nameEl=null, lvlEl=null, heartEls=[], xpLbl=null, xpVal=null, portImg=null, lastBreed=null;
 let cueEl=null, togEl=null;

 function buildCard(){
  const card=$('statusCard'); if(!card||card.dataset.mkHud)return;
  /* --- the four meters --- */
  for(const [id,ico,lbl] of NEEDS){
   const fill=$(id); if(!fill)continue;
   const scb=fill.parentElement; if(!scb||!scb.classList.contains('scb'))continue;
   scb.setAttribute('data-ico',ico); scb.setAttribute('title',lbl);
   if(!scb.querySelector('.mk-track')){
    const cap=document.createElement('span'); cap.className='mk-scb-lbl'; cap.textContent=lbl;
    const val=document.createElement('span'); val.className='mk-scb-val'; val.textContent='—';
    const tr=document.createElement('span'); tr.className='mk-track';
    scb.insertBefore(cap,fill); scb.insertBefore(val,fill);
    scb.insertBefore(tr,fill); tr.appendChild(fill);          // the fill keeps its id and its style.width
   }
  }
  /* --- name / level / bond, read out of the string the game writes --- */
  const info=$('scInfo'), sn=$('scName');
  if(info&&sn&&!info.querySelector('.mk-hud-name')){
   const line=document.createElement('div'); line.className='mk-hud-name';
   nameEl=document.createElement('b'); lvlEl=document.createElement('span'); lvlEl.className='mk-hud-lvl';
   /* The lid.  On a desktop the card opens on hover and this is only a signpost; on a phone
      there is no hover and it is the whole mechanism, so it is a real target with a title. */
   togEl=document.createElement('i'); togEl.className='mk-sc-tog'; togEl.textContent='⌄';
   togEl.setAttribute('title','Show or hide the details'); togEl.setAttribute('role','button');
   togEl.setAttribute('tabindex','0'); togEl.setAttribute('aria-label','Show or hide the details');
   line.appendChild(nameEl); line.appendChild(lvlEl); line.appendChild(togEl);
   const hearts=document.createElement('div'); hearts.className='mk-hud-hearts';
   hearts.setAttribute('title','Bond'); heartEls=[];
   for(let i=0;i<5;i++){const p=document.createElement('i');hearts.appendChild(p);heartEls.push(p);}
   cueEl=document.createElement('div'); cueEl.className='mk-sc-cue';
   info.insertBefore(line,sn); info.insertBefore(hearts,sn); info.insertBefore(cueEl,sn);
  }
  /* --- XP gains a caption --- */
  const xp=$('scXp');
  if(xp&&!card.querySelector('.mk-xp')){
   const wrap=document.createElement('div'); wrap.className='mk-xp';
   const lbl=document.createElement('div'); lbl.className='mk-xp-lbl';
   xpLbl=document.createElement('span'); xpLbl.textContent='Experience';
   xpVal=document.createElement('span'); xpVal.textContent='';
   lbl.appendChild(xpLbl); lbl.appendChild(xpVal);
   xp.parentElement.insertBefore(wrap,xp); wrap.appendChild(lbl); wrap.appendChild(xp);
  }
  /* --- the real painting instead of 🐴 ---
     updateStatusCard() rewrites #scPortrait.textContent every frame, so the image cannot
     live inside it.  It lives in a wrapper on top of it: the coloured disc and the emoji
     stay underneath as the fallback the moment a breed has no file. */
  const port=$('scPortrait');
  if(port&&!port.parentElement.classList.contains('mk-sc-port')){
   const wrap=document.createElement('span'); wrap.className='mk-sc-port';
   port.parentElement.insertBefore(wrap,port); wrap.appendChild(port);
   portImg=document.createElement('img'); portImg.className='mk-sc-img'; portImg.alt=''; portImg.loading='lazy';
   portImg.decoding='async'; portImg.style.display='none';
   portImg.onerror=()=>{portImg.style.display='none';};
   wrap.appendChild(portImg);
  }
  /* One handler for the whole card: anything that is not already a control pins it open or
     lets it close again.  The four care buttons and the horse picker keep their own clicks. */
  card.addEventListener('click',e=>{
   try{if(e.target.closest('button,select,input,a,option'))return;pinned=!pinned;leanCard();}catch(err){}
  });
  /* stopPropagation, not just preventDefault: the game listens for keys on the window, and it
     only excuses INPUT and SELECT from that — so Space on a focused <i> would open the card
     AND put the horse over a jump.  Stopping it at the card is what keeps the two apart. */
  card.addEventListener('keydown',e=>{
   try{if((e.key===' '||e.key==='Enter')&&e.target===togEl){
    e.preventDefault(); e.stopPropagation(); pinned=!pinned; leanCard();}}catch(err){}
  });
  card.dataset.mkHud='1';
  paintCard(); paintPortrait();
 }

 /* Is the card allowed to be small?  Only while every need is comfortable.  The two
    thresholds are deliberately apart: a need sitting exactly on the line would otherwise open
    and shut the card every time it ticked past 45, which is worse than either state. */
 let needAlert=false, pinned=false, worstId=null, worstV=100, worstSt='good';
 function leanCard(){
  try{
   const card=$('statusCard'); if(!card)return;
   if(!needAlert&&worstV<=45)needAlert=true; else if(needAlert&&worstV>=54)needAlert=false;
   card.classList.toggle('mk-sc-alert',needAlert);
   card.classList.toggle('mk-sc-lean',!needAlert&&!pinned);
   /* A separate class from the absence of 'lean', because a phone answers an alert by adding
      one line to the small card rather than opening the whole thing over the nav bar — and
      then a deliberate tap still has to be able to open it. */
   card.classList.toggle('mk-sc-open',pinned);
   if(cueEl&&needAlert&&worstId){
    const c=CUE[worstId]||['🐴','Needs you','Needs you'];
    const txt=c[0]+' '+(worstSt==='crit'?c[2]:c[1]);
    if(cueEl.textContent!==txt)cueEl.textContent=txt;
    if(cueEl.getAttribute('data-state')!==worstSt)cueEl.setAttribute('data-state',worstSt);
   }
  }catch(e){}
 }

 const pct=el=>{try{const w=parseFloat(el.style.width);return isFinite(w)?Math.max(0,Math.min(100,w)):0;}catch(e){return 0;}};
 function paintCard(){
  try{
   let lo=101, loId=null, loSt='good';
   for(const [id] of NEEDS){
    const fill=$(id); if(!fill)continue;
    const scb=fill.closest('.scb'); if(!scb)continue;
    const v=Math.round(pct(fill));
    const val=scb.querySelector('.mk-scb-val');
    if(val&&val.textContent!==v+'%')val.textContent=v+'%';
    const st=v<=20?'crit':v<=45?'warn':'good';
    if(v<lo){lo=v;loId=id;loSt=st;}
    if(scb.getAttribute('data-state')!==st){
     scb.setAttribute('data-state',st);
     /* The need's own hue is painted inline by the game, so state has to be painted the
        same way.  The hue is remembered once and handed back the moment the need is fine
        again: a full water bar is blue, a nearly empty one is barn red. */
     if(fill.dataset.mkHue==null)fill.dataset.mkHue=fill.style.background||'';
     fill.style.background=st==='crit'?'linear-gradient(90deg,#a33b37,#e8827e)'
      :st==='warn'?'linear-gradient(90deg,#c47f1d,#eab55a)':fill.dataset.mkHue;
    }
   }
   /* Before the name block, which returns early whenever the name has not changed. */
   if(loId){worstId=loId;worstV=lo;worstSt=loSt;}
   leanCard();
  }catch(e){}
  try{
   const sn=$('scName'); if(!sn||!nameEl)return;
   const raw=sn.textContent||'';
   if(sn.dataset.mkLast===raw)return; sn.dataset.mkLast=raw;
   /* "Clover · Lv 4 ❤️❤️❤️" → name, level, three of five hearts. */
   const m=/^(.*?)\s*·\s*Lv\s*(\d+)\s*(.*)$/.exec(raw);
   const nm=m?m[1]:raw.replace(/❤️/g,'').trim();
   const lv=m?m[2]:'';
   const hearts=((m?m[3]:raw).match(/❤️/g)||[]).length;
   nameEl.textContent=nm||'Your horse';
   nameEl.title=nm||'';
   lvlEl.textContent=lv?'Lv '+lv:'';
   lvlEl.style.display=lv?'':'none';
   heartEls.forEach((p,i)=>p.classList.toggle('on',i<hearts));
   const hr=$('mk-hearts');
   if(xpVal){
    const v=Math.round(pct($('scXp').firstElementChild||$('scbX')));
    xpVal.textContent=v+'%';
    const w=xpVal.closest('.mk-xp'); if(w)w.title='Experience '+v+'% to the next level';
   }
   if(hr)hr.title='Bond '+hearts+'/5';
  }catch(e){}
 }

 /* ================= 3. wallet ================= */
 /* The portrait: ask the kit for this breed's painting and borrow the URL it resolved. */
 function paintPortrait(){
  try{
   if(!portImg||!G.ui||!G.ui.k||!G.ui.k.thumb)return;
   const s=G.save.fresh(); if(!s||!s.horses)return;
   let i=0; try{i=G.horse.rideIdx();}catch(e){}
   const h=s.horses[i]||s.horses[0]; if(!h)return;
   const key=h.breed||'';
   if(key===lastBreed)return; lastBreed=key;
   const holder=document.createElement('div');
   holder.innerHTML=G.ui.k.thumb(key,{size:56});
   const img=holder.querySelector('img');
   if(img&&img.getAttribute('src')){portImg.style.display='';portImg.src=img.getAttribute('src');}
   else portImg.style.display='none';
  }catch(e){}
 }

 const NUM=/(-?\d[\d,]*)/;
 const group=n=>String(n).replace(/\B(?=(\d{3})+(?!\d))/g,',');
 function paintWallet(){
  try{
   const w=$('wallet'); if(!w)return;
   /* tag the three built-ins once so each gets its own tint */
   if(!w.dataset.mkTag){
    const tag=(id,cur)=>{const e=$(id);if(e&&e.parentElement&&e.parentElement.classList.contains('w'))e.parentElement.setAttribute('data-cur',cur);};
    tag('coinEl','coin'); tag('gemEl','gem'); tag('keyEl','key');
    w.dataset.mkTag='1';
   }
   /* thousands separators on the three numeric built-ins, without touching the value the
      game reads back (it never reads these nodes — it writes them from the save). */
   for(const id of ['coinEl','gemEl','keyEl']){
    const e=$(id); if(!e)continue;
    const t=(e.textContent||'').trim();
    if(/^\d+$/.test(t)){const g=group(t);if(g!==t)e.textContent=g;}
   }
   /* collapse whatever is empty, and give a package's own chip the same shape */
   w.querySelectorAll('.w').forEach(el=>{
    const txt=(el.textContent||'').replace(/\s/g,'');
    const empty=!txt&&!el.querySelector('img');
    el.classList.toggle('mk-w-empty',empty);
    if(empty)return;
    if(el.style.display==='none'&&el.id&&el.id!=='vipEl')el.style.display='';
    /* a bare "✨ 250" chip (no <i>/<b>) becomes icon + figure so it lines up with the rest */
    if(!el.querySelector('i,b')&&!el.dataset.mkSplit){
     const m=/^\s*(\D{1,3})\s*([\d,]+)\s*$/.exec(el.textContent||'');
     if(m){el.innerHTML='<i>'+m[1].trim()+'</i><b>'+group(m[2].replace(/,/g,''))+'</b>';el.dataset.mkSplit='1';}
    }
    /* a multiplier a package appends ("x2", "×2") gets its own badge instead of colliding */
    el.querySelectorAll('b').forEach(b=>{
     const t=b.textContent||'';
     const mm=/^(.*?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*$/i.exec(t);
     if(mm&&mm[1].trim()){
      b.textContent=mm[1].trim();
      const badge=document.createElement('span'); badge.className='mk-mult'; badge.textContent='×'+mm[2];
      badge.title='Active multiplier';
      b.after(badge);
     }
    });
   });
  }catch(e){}
 }

 /* ================= 4. quest pill ================= */
 function paintQuest(){
  try{
   const q=$('questTrack'); if(!q)return;
   const t=(q.textContent||'').trim();
   if(q.dataset.mkLast===t)return; q.dataset.mkLast=t;
   if(t)q.title=t; else q.removeAttribute('title');
  }catch(e){}
 }

 /* ================= 5. minimap plate ================= */
 function buildMini(){
  try{
   const mini=$('mini'); if(!mini||$('mkMiniPlate'))return;
   const plate=document.createElement('div'); plate.id='mkMiniPlate'; plate.setAttribute('aria-hidden','true');
   mini.parentNode.insertBefore(plate,mini);
  }catch(e){}
 }

 /* ================= 6. toasts ================= */
 const REWARD=/[+][\d,]+\s*(🪙|💎|🗝️|✨|💞|🎟️)|🎉|🏆|🏅|🎁|⭐|📈|💎|🪙/;
 const BAD=/⚠️|❌|🚫|not enough|too tired|cannot|can't|failed|lost/i;
 const WARN=/hungry|thirsty|dirty|tired|low|soon|expire/i;
 const GOOD=/✅|✨|💚|clean|complete|done|joined|saved|unlocked/i;
 function dressToast(t){
  try{
   if(!t||t.dataset.mkT)return; t.dataset.mkT='1';
   const raw=(t.textContent||'').trim();
   /* the leading emoji becomes the icon disc; everything else is the body */
   const m=/^(\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic}|️)*)\s*(.*)$/su.exec(raw);
   const ico=m?m[1]:'🐴', body=m?m[2]:raw;
   t.textContent='';
   const i=document.createElement('span'); i.className='mk-toast-ico'; i.setAttribute('aria-hidden','true'); i.textContent=ico;
   const b=document.createElement('span'); b.className='mk-toast-txt'; b.textContent=body||raw;
   t.appendChild(i); t.appendChild(b);
   const cls=REWARD.test(raw)?'mk-t-reward':BAD.test(raw)?'mk-t-bad':WARN.test(raw)?'mk-t-warn':GOOD.test(raw)?'mk-t-good':'';
   if(cls)t.classList.add(cls);
  }catch(e){}
 }
 function watchToasts(){
  try{
   const box=$('toasts'); if(!box)return;
   box.childNodes.forEach(n=>{if(n.nodeType===1&&n.classList.contains('toast'))dressToast(n);});
   new MutationObserver(ms=>{
    for(const m of ms)m.addedNodes&&m.addedNodes.forEach(n=>{
     if(n.nodeType===1&&n.classList&&n.classList.contains('toast'))dressToast(n);
    });
   }).observe(box,{childList:true});
  }catch(e){}
 }

 /* ================= 7. the dock =================
    Six destinations and a door.  Everything here MOVES the buttons the game and the packages
    already built — appendChild on a live node keeps its id, its onclick, its title and the
    .pip the badge painter hangs on it — because rebuilding them would mean re-deriving every
    handler, and a handler this file guessed wrong about is a button that silently does
    nothing.  Nothing is ever deleted, so a package that goes looking for its own button by id
    still finds it. */
 const PRIMARY=['careBtn','stableBtn','eventsBtn','shopBtn','questBtn','netBtn','flyBtn','breathBtn'];
 /* fly/breathe are at the end on purpose: they are display:none until the horse has wings or
    a dragon's throat, and when that happens they belong under the rider's thumb, not in a
    menu two clicks away. */
 const GROUPS=[
  ['Your horses',['styleBtn','catalogBtn','breedBtn','whistleBtn','breedStudioBtn']],
  ['Competing',['pvpBtn','lbBtn']],
  ['The ranch',['buildBtn','inboxBtn']],
  ['Club',['chatBtn','emoteBtn']],
  ['Also here',[]],                                    // the catch-all for a package we do not know
 ];
 /* The word each button gets in the menu.  Six of these had no word at all — a checkered
    flag, a baby bottle, a music note, a book, a postbox and a mask — which is fine for a
    player who already knows the game and useless for one who does not.
    #netBtn is deliberately absent: the game rewrites it to "🟢 <your club's name>" when the
    club connects, and a curated name here would overwrite that with the word "Club" forever. */
 const DOCK_NAMES={careBtn:'Care',stableBtn:'Stable',eventsBtn:'Events',shopBtn:'Shop',questBtn:'Quests',
  styleBtn:'Style',catalogBtn:'Catalogue',breedBtn:'Foaling barn',whistleBtn:'Whistle',
  breedStudioBtn:'Breed Studio',pvpBtn:'Race Club',lbBtn:'Ranks',buildBtn:'Build',inboxBtn:'Inbox',
  chatBtn:'Chat',emoteBtn:'Emotes',flyBtn:'Fly',breathBtn:'Breathe'};
 const GRP_OF={}; GROUPS.forEach(([h,ids],i)=>ids.forEach(id=>{GRP_OF[id]=i;}));

 let moreBtn=null, dockMenu=null, dkBusy=false, dkPending=0;

 /* A button's own words, if it has any: everything from the first letter on.  "🏁" has none,
    "🔬 Breed Studio ↗" has "Breed Studio ↗" — which is why the curated name wins where there
    is one, and the button's own text only fills the gaps. */
 function dkSplit(b){
  let raw=''; for(const n of b.childNodes)if(n.nodeType===3)raw+=n.nodeValue;
  raw=raw.trim();
  const m=/^([^\p{L}\p{N}]*)\s*(.*)$/u.exec(raw);
  return {glyph:(m?m[1]:raw).trim(), words:(m?m[2]:'').trim()};
 }
 function dkTitle(t){
  const s=String(t||'').split(/[—(,]/)[0].trim();
  return s&&s.length<=18?s:'';
 }
 /* glyph + <span>label</span>, always, so the phone can stack the two and the menu can lay
    them side by side.  Idempotent, and it re-runs when something rewrites the button under
    us — #netBtn's text becomes "🟢 <club name>" the moment the club connects.

    And when the thing rewriting it will not stop: #questBtn's innerHTML is rebuilt from a
    string literal on EVERY status update, so a span put there survives about sixteen
    milliseconds.  Arguing with that sixty times a second is not a fight worth having, so a
    button that has had to be repaired three times gives up its insides: the glyph and the
    label move into ::before / ::after, where no innerHTML can reach them, and the text goes to
    font-size 0.  Three and not one, because a button whose words change ONCE — #netBtn, which
    becomes the club's name on connect — should keep telling the truth rather than be frozen
    into a picture of whatever it said the first time.  The pip and the badge the game hangs on
    the button keep their own size and their place either way. */
 function labelise(b){
  try{
   if(b.dataset.mkDkMode==='css')return;
   const {glyph,words}=dkSplit(b);
   if(b.dataset.mkDkMode==='span'&&b.dataset.mkDkRaw===glyph&&!words)return;
   const label=DOCK_NAMES[b.id]||words||dkTitle(b.title);
   if(b.dataset.mkDkMode==='span'){
    const n=(+b.dataset.mkDkFix||0)+1; b.dataset.mkDkFix=String(n);
    if(n>=3){
     b.dataset.mkGlyph=glyph; b.dataset.mkLabel=label||'';
     if(label&&!b.getAttribute('aria-label'))b.setAttribute('aria-label',label);
     if(label&&!b.title)b.title=label;
     b.classList.add('mk-dk-raw'); b.dataset.mkDkMode='css';
     return;
    }
   }
   for(const n of Array.from(b.childNodes)){
    if(n.nodeType===3)n.remove();
    else if(n.nodeType===1&&n.classList.contains('mk-dk-lbl'))n.remove();
   }
   if(glyph)b.insertBefore(document.createTextNode(glyph),b.firstChild);
   if(label){
    const s=document.createElement('span'); s.className='mk-dk-lbl'; s.textContent=label;
    const pip=b.querySelector('.pip');
    if(pip)b.insertBefore(s,pip); else b.appendChild(s);
    if(!b.title)b.title=label;
   }
   b.dataset.mkDkMode='span'; b.dataset.mkDkRaw=glyph;
  }catch(e){}
 }
 /* Every button, five times a second: cheap, and it is the only way to notice that something
    has taken a button's insides back. */
 function relabelDock(){
  try{const d=$('dock'); if(!d)return; d.querySelectorAll('button').forEach(b=>{if(b!==moreBtn)labelise(b);});}catch(e){}
 }

 function buildDock(){
  const dock=$('dock'); if(!dock||moreBtn)return;
  dockMenu=document.createElement('div'); dockMenu.id='mkDockMenu'; dockMenu.setAttribute('role','menu');
  for(const [head] of GROUPS){
   const g=document.createElement('div'); g.className='mk-dk-grp';
   const h=document.createElement('span'); h.className='mk-dk-h'; h.textContent=head;
   const items=document.createElement('div'); items.className='mk-dk-items';
   g.appendChild(h); g.appendChild(items); dockMenu.appendChild(g);
  }
  moreBtn=document.createElement('button'); moreBtn.id='mkDockMore'; moreBtn.className='mk-dk-more';
  moreBtn.title='Everything else'; moreBtn.setAttribute('aria-haspopup','true');
  moreBtn.setAttribute('aria-expanded','false');
  moreBtn.appendChild(document.createTextNode('⋯'));
  const ml=document.createElement('span'); ml.className='mk-dk-lbl'; ml.textContent='More';
  moreBtn.appendChild(ml);
  moreBtn.onclick=e=>{e.stopPropagation();openMenu(!dock.classList.contains('mk-dk-open'));};
  dock.appendChild(moreBtn); dock.appendChild(dockMenu);
  /* Any click inside the menu is a click on a destination, so the menu's work is done —
     this fires after the button's own onclick, which is what opens the panel. */
  dockMenu.addEventListener('click',()=>{openMenu(false);});
 }

 function outside(e){
  try{if(dockMenu&&!dockMenu.contains(e.target)&&e.target!==moreBtn&&!moreBtn.contains(e.target))openMenu(false);}catch(err){}
 }
 function openMenu(on){
  try{
   const dock=$('dock'); if(!dock||!moreBtn)return;
   dock.classList.toggle('mk-dk-open',!!on);
   moreBtn.setAttribute('aria-expanded',on?'true':'false');
   document.removeEventListener('pointerdown',outside,true);
   if(on)document.addEventListener('pointerdown',outside,true);
  }catch(e){}
 }
 const menuOpen=()=>{try{return $('dock').classList.contains('mk-dk-open');}catch(e){return false;}};

 /* Idempotent on purpose.  Every move below is guarded by a check that the node is not
    already where it is going, because insertBefore on a node that is already in place is
    still a mutation record, and the observer that calls this function would then call it
    forever. */
 function arrangeDock(){
  /* se-hud lays the controls out itself: it hides this bar and takes every button out of it —
     the primary six into its hexagon cluster and market, the rest into its menu. Arranging
     them back into a bar nobody can see would pull them out of that layout every time the
     dock observer fired, which is exactly what happened: two packages, one set of buttons,
     and the one that ran more often won. So when that package owns the HUD this one stands
     down, and the first pass (which runs before it installs, and builds the drawers it reads)
     is the only one. */
  if(document.body&&document.body.classList.contains('se-hud'))return;
  const dock=$('dock'); if(!dock)return;
  dkBusy=true;
  try{
   buildDock();
   const boxes=dockMenu?Array.from(dockMenu.querySelectorAll('.mk-dk-items')):[];
   if(!boxes.length){dkBusy=false;return;}
   const all=[];
   dock.querySelectorAll('button').forEach(b=>{if(b!==moreBtn)all.push(b);});
   /* the primary six (plus the two contextual ones), in my order, ahead of the door */
   let ref=moreBtn;
   for(let i=PRIMARY.length-1;i>=0;i--){
    const b=$(PRIMARY[i]); if(!b)continue;
    labelise(b);
    if(b.parentNode!==dock||b.nextSibling!==ref)dock.insertBefore(b,ref);
    ref=b;
   }
   /* everything else into the drawer it belongs in */
   for(const b of all){
    if(!b.id||PRIMARY.indexOf(b.id)>=0)continue;
    labelise(b);
    const box=boxes[GRP_OF[b.id]!=null?GRP_OF[b.id]:boxes.length-1];
    if(box&&b.parentNode!==box)box.appendChild(b);
   }
   /* a heading with nothing under it is worse than no heading */
   boxes.forEach(box=>{
    const g=box.parentElement; if(!g)return;
    g.classList.toggle('mk-dk-off',!box.querySelector('button'));
   });
  }catch(e){}
  dkBusy=false;
 }
 function arrangeSoon(){
  if(dkPending)return;
  dkPending=requestAnimationFrame(()=>{dkPending=0;arrangeDock();});
 }

 /* A pip on something hidden in a drawer is a pip nobody sees, so the door carries the sum. */
 function paintMorePip(){
  try{
   if(!moreBtn||!dockMenu)return;
   let n=0, bang=false;
   dockMenu.querySelectorAll('button .pip').forEach(p=>{
    const t=(p.textContent||'').trim();
    if(/^\d+$/.test(t))n+=+t; else if(t)bang=true;
   });
   let pip=moreBtn.querySelector('.pip');
   const txt=n?String(n):bang?'!':'';
   if(!txt){if(pip)pip.remove();return;}
   if(!pip){pip=document.createElement('span');pip.className='pip';moreBtn.appendChild(pip);}
   if(pip.textContent!==txt)pip.textContent=txt;
  }catch(e){}
 }

 function watchDock(){
  try{
   const dock=$('dock'); if(!dock||dock.dataset.mkDkObs)return;
   dock.dataset.mkDkObs='1';
   /* childList only, and not the subtree: the badge painter rewrites .pip inside a button on
      every refreshWallet, and there is no reason to re-sort the bar for that. */
   new MutationObserver(()=>{if(!dkBusy)arrangeSoon();}).observe(dock,{childList:true});
  }catch(e){}
 }

 /* ================= 8. the hint strip =================
    The game fades it after nine seconds, or after twenty-eight on a first visit, whichever
    tour it decided to play.  Neither number knows anything about the player.  Two and a half
    seconds of actually moving the horse does: they have the controls, and the strip can go.
    A visitor who never touches a key still gets the whole tour.

    The clock is the game's own dt, not the wall, so this is two and a half seconds of RIDING
    and not of sitting still — and on a machine dropping frames it is longer in real terms,
    because dt is clamped at 50ms a frame.  That is the right way round: a player on a slow
    machine has had less riding done for the same wall time. */
 let ridden=0, hintGone=false;
 function hintTick(R,dt){
  if(hintGone||!R)return;
  if(R.fwd||R.back||R.gallop)ridden+=(+dt||0);
  if(ridden<2.5)return;
  hintGone=true;
  try{const h=$('hint'); if(h)h.classList.add('mk-hint-done');}catch(e){}
 }

 /* ================= 9. wiring =================
    The game repaints the card and the pill every frame and the wallet on every refresh.
    Reading four inline widths and one string is cheap, but there is no reason to do it at
    60 Hz: five times a second is faster than the eye needs for a meter. */
 let last=0;
 function boot(){
  try{buildCard();}catch(e){}
  try{buildMini();}catch(e){}
  try{paintWallet();}catch(e){}
  try{watchToasts();}catch(e){}
  try{arrangeDock();}catch(e){}
  try{watchDock();}catch(e){}
 }
 boot();
 G.on('boot',()=>{boot();paintCard();paintWallet();paintQuest();});
 setTimeout(boot,1500);                                  // the card exists at parse time; the plate may not
 /* One more pass well after the loop has started, for a package that registers a dock button
    from a timer of its own rather than from install. */
 setTimeout(()=>{try{arrangeDock();}catch(e){}},5000);
 G.on('tick',(dt,t)=>{
  const now=t||performance.now()/1000;
  if(now-last<0.2)return; last=now;
  if(!$('statusCard')||!$('statusCard').dataset.mkHud)buildCard();
  paintCard(); paintQuest(); paintPortrait();
  relabelDock(); paintMorePip();
 });
 /* The ride hook is read, never written: it is handed round to every package that wants to
    change how the horse moves, and this one only wants to know whether it did. */
 G.on('ride',(R,dt)=>{hintTick(R,dt);});
 /* Escape closes the drawer.  It has to be the 'escape' hook and not 'key': the keydown
    listener answers Escape in a branch of its own and returns long before it ever reaches
    G.run('key'), so a package that waits for Escape there waits forever.  social-play owns
    this hook too (it eats Escape while you are spectating); G.run calls every handler and
    keeps the first truthy answer, so both still get their turn.  Returning true only while
    the drawer was actually open leaves every other Escape exactly as it was. */
 G.on('escape',()=>{
  try{if(menuOpen()){openMenu(false);return true;}}catch(err){}
 });
 G.on('wallet',()=>{try{paintWallet();paintMorePip();}catch(e){}});
 G.on('grantHorse',()=>{lastBreed=null;});
 G.on('rebuild',()=>{lastBreed=null;});
}

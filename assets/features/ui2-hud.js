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

   No behaviour, no ids, no ranch3d.html: the CSS is injected from here and the DOM work is
   additive wrappers, each in its own try/catch, so a shape this file did not expect is left
   exactly as it was. */
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

/* ---------- 2. wallet ---------- */
#wallet{gap:6px;padding:6px 8px;box-shadow:var(--e2);flex-wrap:nowrap}
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

/* ---------- 3. quest pill ---------- */
/* Centred on the wallet's row the pill had 330px before it hit the coin chip, which turns
   every mission into an ellipsis.  It gets its own line under the top chrome instead. */
#questTrack{top:calc(58px + env(safe-area-inset-top));display:flex;align-items:center;gap:0;min-height:32px;
 padding:0 15px;font-family:var(--font);
 font-weight:700;font-size:13px;line-height:32px;box-shadow:var(--e2);max-width:min(46vw,520px);
 white-space:nowrap;overflow:hidden;text-overflow:ellipsis;border-left:3px solid var(--brass)}
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

/* ---------- narrow desktop / tablet ----------
   Below ~1100px the centred pill would run under the horse card, so it goes back to the
   right-hand slot the tablet layout already keeps for it. */
@media(max-width:1100px){
 #questTrack{top:calc(104px + env(safe-area-inset-top));left:auto;right:calc(12px + env(safe-area-inset-right));
  transform:none;max-width:calc(100vw - 300px)}
}

/* ---------- phone ---------- */
@media(max-width:760px){
 /* the dock sits at 156px on a phone; the pill takes the first clear line beneath it and
    finally gets the full width of the screen to truncate inside */
 #questTrack{top:calc(212px + env(safe-area-inset-top));left:12px;right:auto;transform:none;
  max-width:calc(100vw - 24px)}
 /* narrow enough that the 📷 button behind it stays reachable once the wallet wraps */
 #statusCard{width:calc(45vw - 8px);max-width:176px;padding:8px 9px;gap:6px}
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
 /* the wallet wraps before it clips: a coin count you cannot see is worse than two rows */
 #wallet{gap:4px;padding:4px 5px;flex-wrap:wrap;justify-content:flex-end;row-gap:4px}
 #wallet .w{font-size:12px;line-height:18px;padding:2px 7px 2px 6px;gap:4px}
 #wallet .w i,#wallet .w>span>i{font-size:12px}
 #wallet .w b,#wallet .w>span>b{min-width:1.2em}
 #wallet .gemx2{margin-left:3px;font-size:9px;line-height:13px;padding:0 4px}
 #questTrack{min-height:28px;line-height:28px;font-size:12px;padding:0 12px}
 #mkMiniPlate{width:104px;height:104px;left:12px;z-index:7}
 #mkMiniPlate::after{font-size:9px;line-height:13px;width:16px;top:-9px}
 #mini{width:96px;height:96px}
 .toast{font-size:12.5px;padding:8px 12px 8px 9px}
 .toast .mk-toast-ico{width:25px;height:25px;font-size:13px}
}`;
   (document.head||document.documentElement).appendChild(st);
  }
 }catch(e){}

 /* ================= 2. status card ================= */
 /* The needs the game paints, in the order it paints them, with the label the care panel
    uses.  Each one keeps its own <i id="scbX"> — the element the updater and the VR mirror
    both write — and simply gains a track to live in and a caption above it. */
 const NEEDS=[['scbH','🥕','Food'],['scbT','💧','Water'],['scbC','🧼','Clean'],['scbY','💗','Happy']];
 let nameEl=null, lvlEl=null, heartEls=[], xpLbl=null, xpVal=null, portImg=null, lastBreed=null;

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
   line.appendChild(nameEl); line.appendChild(lvlEl);
   const hearts=document.createElement('div'); hearts.className='mk-hud-hearts';
   hearts.setAttribute('title','Bond'); heartEls=[];
   for(let i=0;i<5;i++){const p=document.createElement('i');hearts.appendChild(p);heartEls.push(p);}
   info.insertBefore(line,sn); info.insertBefore(hearts,sn);
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
  card.dataset.mkHud='1';
  paintCard(); paintPortrait();
 }

 const pct=el=>{try{const w=parseFloat(el.style.width);return isFinite(w)?Math.max(0,Math.min(100,w)):0;}catch(e){return 0;}};
 function paintCard(){
  try{
   for(const [id] of NEEDS){
    const fill=$(id); if(!fill)continue;
    const scb=fill.closest('.scb'); if(!scb)continue;
    const v=Math.round(pct(fill));
    const val=scb.querySelector('.mk-scb-val');
    if(val&&val.textContent!==v+'%')val.textContent=v+'%';
    const st=v<=20?'crit':v<=45?'warn':'good';
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

 /* ================= 7. wiring =================
    The game repaints the card and the pill every frame and the wallet on every refresh.
    Reading four inline widths and one string is cheap, but there is no reason to do it at
    60 Hz: five times a second is faster than the eye needs for a meter. */
 let last=0;
 function boot(){
  try{buildCard();}catch(e){}
  try{buildMini();}catch(e){}
  try{paintWallet();}catch(e){}
  try{watchToasts();}catch(e){}
 }
 boot();
 G.on('boot',()=>{boot();paintCard();paintWallet();paintQuest();});
 setTimeout(boot,1500);                                  // the card exists at parse time; the plate may not
 G.on('tick',(dt,t)=>{
  const now=t||performance.now()/1000;
  if(now-last<0.2)return; last=now;
  if(!$('statusCard')||!$('statusCard').dataset.mkHud)buildCard();
  paintCard(); paintQuest(); paintPortrait();
 });
 G.on('wallet',()=>{try{paintWallet();}catch(e){}});
 G.on('grantHorse',()=>{lastBreed=null;});
 G.on('rebuild',()=>{lastBreed=null;});
}

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
export const id='se-care';
export function install(G){
 const THREE=G.THREE, T=G.tables||{};
 if(!THREE||!G.ui||!G.horse)return;
 const $=id=>document.getElementById(id);
 const esc=v=>String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
 const clamp=(v,a,b)=>v<a?a:v>b?b:v;
 const TABS=[['horse','Horse','🐴'],['mastery','Mastery','🎖️'],['equipment','Equipment','🏇'],['style','Style','✂️'],
  ['feeding','Feeding','🥕'],['bloodlines','Bloodlines','🧬'],['myhorses','My Horses','🏠']];
 /* The reference's order, which puts the two that a rider reads first at the top. */
 const STATS=[['speed','Speed','⚡'],['agility','Agility','🌀'],['jump','Jump','🪜'],['accel','Accelerate','⏩'],['stamina','Stamina','💗']];
 const ST={open:false,tab:'horse',fov:null,rider:null,heading:null,snap:false};

 /* ---------------------------------------------------------------- look ------------------ */
 if(!$('seCareCss')){
  const st=document.createElement('style'); st.id='seCareCss';
  st.textContent=`
#seOv{position:fixed;inset:0;z-index:40;display:none;font-family:Nunito,system-ui,sans-serif;color:#fff;pointer-events:none}
#seOv.on{display:block}
#seOv button{font-family:inherit;cursor:pointer;border:0;box-shadow:none}
#seOv .sv-top,#seOv .sv-rail,#seOv .sv-card,#seOv .sv-right>*{pointer-events:auto}
#seOv .sv-top{position:absolute;left:0;right:0;top:0;height:clamp(50px,8.5vh,64px);display:flex;align-items:center;gap:12px;padding:0 14px;
 background:linear-gradient(180deg,rgba(30,24,38,.94),rgba(22,18,30,.9));border-bottom:2px solid rgba(255,255,255,.06);box-shadow:0 3px 12px rgba(0,0,0,.35)}
#seOv .sv-circ{width:clamp(38px,6vh,46px);height:clamp(38px,6vh,46px);border-radius:50%;flex:none;display:flex;align-items:center;justify-content:center;
 background:radial-gradient(circle at 35% 30%,#3a5da3,#1c2d5a);border:3px solid #dfe6f5!important;color:#fff;font-size:22px;font-weight:900;line-height:1}
#seOv .sv-title{font-size:clamp(19px,3.4vh,27px);font-weight:900;letter-spacing:.2px;text-shadow:0 2px 0 rgba(0,0,0,.35);white-space:nowrap}
#seOv .sv-title i{font-style:normal;margin-right:8px}
#seOv .sv-sp{flex:1}
#seOv .sv-pill{display:flex;align-items:center;gap:8px;height:clamp(30px,4.8vh,36px);padding:0 14px 0 6px;border-radius:18px;background:rgba(40,34,52,.95);
 border:2px solid rgba(255,255,255,.28);font-weight:900;font-size:clamp(15px,2.4vh,19px);min-width:clamp(80px,9vw,110px);justify-content:space-between}
#seOv .sv-pill b{font-size:22px;line-height:1}
#seOv .sv-rail{position:absolute;left:0;top:clamp(50px,8.5vh,64px);bottom:0;width:clamp(72px,8.5vw,112px);background:linear-gradient(180deg,#352f72,#26225a);
 display:flex;flex-direction:column;overflow-y:auto;box-shadow:3px 0 10px rgba(0,0,0,.3)}
#seOv .sv-tab{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;min-height:clamp(60px,11vh,92px);flex:1 0 auto;max-height:118px;
 background:transparent;color:#fff;font-size:clamp(11px,1.9vh,15px);font-weight:900;border-bottom:1px solid rgba(255,255,255,.07)!important;text-shadow:0 1px 0 rgba(0,0,0,.4)}
#seOv .sv-tab span{font-size:clamp(24px,4.4vh,34px);line-height:1;filter:drop-shadow(0 2px 0 rgba(0,0,0,.35))}
#seOv .sv-tab.on{background:linear-gradient(180deg,#f3ead7,#e2d5b8);color:#3c2d1a;text-shadow:none}
#seOv .sv-card{position:absolute;left:calc(clamp(72px,8.5vw,112px) + 10px);top:calc(clamp(50px,8.5vh,64px) + 10px);bottom:12px;width:clamp(250px,27vw,420px);
 border-radius:14px;background:rgba(66,50,34,.9);box-shadow:0 6px 18px rgba(0,0,0,.35),inset 0 0 0 2px rgba(255,236,200,.08);
 display:flex;flex-direction:column;overflow:hidden}
#seOv .sv-scroll{flex:1;overflow-y:auto;padding:12px}
#seOv .sv-scroll::-webkit-scrollbar{width:8px}#seOv .sv-scroll::-webkit-scrollbar-thumb{background:rgba(255,236,200,.25);border-radius:8px}
#seOv .sv-head{display:flex;align-items:center;justify-content:center;gap:10px;margin:4px 0 8px;font-size:clamp(15px,2.5vh,20px);font-weight:900;color:#f3e6c8;letter-spacing:.5px;text-transform:uppercase}
#seOv .sv-head::before,#seOv .sv-head::after{content:'';flex:1;height:2px;background:linear-gradient(90deg,transparent,rgba(243,230,200,.45),transparent)}
#seOv .sv-lvl{display:grid;grid-template-columns:clamp(54px,8vh,78px) 1fr;gap:6px 12px;align-items:center;margin-bottom:6px}
#seOv .sv-shield{width:clamp(48px,7.2vh,70px);height:clamp(54px,8vh,78px);display:flex;align-items:center;justify-content:center;font-size:clamp(24px,4.4vh,36px);font-weight:900;color:#fff;
 background:linear-gradient(180deg,#5a63b9,#3b3f86);clip-path:polygon(50% 0,100% 14%,100% 62%,50% 100%,0 62%,0 14%);text-shadow:0 2px 0 rgba(0,0,0,.35);grid-row:span 2}
#seOv .sv-meter .lb{display:flex;justify-content:space-between;font-size:clamp(12px,1.9vh,15px);font-weight:900;text-transform:uppercase;letter-spacing:.4px}
#seOv .sv-meter .lb small{font-size:13px;opacity:.85;text-transform:none;letter-spacing:0}
#seOv .sv-bar{height:9px;border-radius:5px;background:rgba(0,0,0,.35);overflow:hidden;margin-top:3px}
#seOv .sv-bar i{display:block;height:100%;border-radius:5px;background:linear-gradient(90deg,#b8b2ff,#8f86f0)}
#seOv .sv-bond .lb{color:#ff9fc4}#seOv .sv-bond .sv-bar i{background:linear-gradient(90deg,#ffd257,#ffb23a)}
#seOv .sv-stat{position:relative;display:grid;grid-template-columns:1fr auto;align-items:end;min-height:clamp(50px,8.6vh,76px);margin-bottom:5px;padding:clamp(6px,1.1vh,10px) 12px clamp(10px,1.6vh,14px) clamp(46px,5vw,64px);
 border-radius:8px;background:linear-gradient(180deg,rgba(96,76,54,.95),rgba(78,60,42,.95));box-shadow:inset 0 -1px 0 rgba(0,0,0,.25)}
#seOv .sv-stat .ic{position:absolute;left:10px;top:50%;transform:translateY(-50%);font-size:clamp(22px,3.8vh,34px);opacity:.55;filter:grayscale(.3)}
#seOv .sv-stat .nm{font-size:clamp(14px,2.3vh,19px);font-weight:900;text-transform:uppercase;letter-spacing:.4px;color:#fff5e2}
#seOv .sv-stat .mx{font-size:clamp(11px,1.7vh,14px);font-weight:900;color:#78bbff;margin-top:4px}
#seOv .sv-stat .v{font-size:clamp(20px,3.6vh,30px);font-weight:900;text-align:right;line-height:1}
#seOv .sv-stat .v.up{color:#a6e86a}
#seOv .sv-stat .bn{font-size:14px;font-weight:900;color:#a6e86a;text-align:right;margin-top:6px}
#seOv .sv-stat .tr{position:absolute;left:12px;right:12px;bottom:6px;height:4px;border-radius:2px;background:rgba(0,0,0,.35);overflow:hidden}
#seOv .sv-stat .tr i{display:block;height:100%;background:#78bbff}
#seOv .sv-btns{display:flex;gap:10px;padding:10px 12px 12px}
#seOv .sv-b{flex:1;display:flex;align-items:center;justify-content:center;gap:8px;min-height:clamp(40px,6.4vh,52px);border-radius:10px;font-size:clamp(13px,2.1vh,17px);font-weight:900;color:#fff;
 background:linear-gradient(180deg,#7a6446,#5e4a32);text-transform:uppercase;letter-spacing:.3px;box-shadow:inset 0 0 0 2px rgba(255,236,200,.18)!important}
#seOv .sv-b.go{background:linear-gradient(180deg,#5aa845,#3f8431)}
#seOv .sv-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(118px,1fr));gap:8px}
#seOv .sv-item{display:flex;flex-direction:column;align-items:center;gap:3px;padding:10px 6px;border-radius:10px;background:rgba(96,76,54,.95);color:#fff5e2;font-weight:900;font-size:14px;text-align:center}
#seOv .sv-item big{font-size:32px;line-height:1.1}
#seOv .sv-item small{font-size:12px;opacity:.85;font-weight:800}
#seOv .sv-item.none{opacity:.5}
#seOv .sv-need{display:grid;grid-template-columns:1fr 1fr;gap:8px 14px;margin-bottom:10px}
#seOv .sv-need .sv-bar i{background:var(--c)}
#seOv .sv-horse{display:grid;grid-template-columns:64px 1fr;gap:4px 10px;align-items:center;padding:10px;border-radius:10px;background:rgba(96,76,54,.95);margin-bottom:8px}
#seOv .sv-horse.cur{box-shadow:inset 0 0 0 3px #f5d63d}
#seOv .sv-horse .th{grid-row:span 3;width:64px;height:64px;border-radius:10px;overflow:hidden;display:flex;align-items:center;justify-content:center;font-size:36px;background:#e9dfc9}
#seOv .sv-horse .th .mk-thumb{--mk-thumb:64px}
#seOv .sv-horse .n{font-size:18px;font-weight:900;color:#fff5e2;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
#seOv .sv-horse .n em{font-style:normal;font-size:11px;padding:2px 8px;border-radius:9px;background:#f5d63d;color:#2a2340}
#seOv .sv-horse .m{font-size:13px;color:#e8d8b8;font-weight:800}
#seOv .sv-horse .a{display:flex;gap:8px;justify-content:flex-end}
#seOv .sv-horse .a button{padding:6px 16px;border-radius:9px;font-weight:900;font-size:14px;background:linear-gradient(180deg,#f8dd52,#e6bf22);color:#2a2340}
#seOv .sv-p{font-size:14px;line-height:1.45;color:#f0e2c4;font-weight:700;margin:0 0 10px}
#seOv .sv-row{display:flex;justify-content:space-between;gap:10px;padding:8px 10px;border-radius:8px;background:rgba(96,76,54,.9);margin-bottom:6px;font-weight:800;font-size:14px;color:#fff5e2}
#seOv .sv-row.lock{opacity:.55}
#seOv .sv-row>span:first-child{flex:none;white-space:nowrap}
#seOv .sv-right{position:absolute;right:16px;top:calc(clamp(50px,8.5vh,64px) + 10px);bottom:12px;width:min(340px,30vw);display:flex;flex-direction:column;align-items:flex-end;text-align:right;pointer-events:none}
#seOv .sv-name{display:flex;align-items:center;gap:10px;font-size:clamp(26px,3.2vw,40px);font-weight:900;text-shadow:0 2px 0 rgba(0,0,0,.45),0 0 12px rgba(0,0,0,.35)}
#seOv .sv-pen{width:34px;height:34px;border-radius:50%;background:rgba(255,255,255,.85);color:#3a2a12;font-size:16px;display:flex;align-items:center;justify-content:center}
#seOv .sv-breed{font-size:clamp(17px,2vw,24px);font-weight:900;color:#5fd3ff;text-shadow:0 2px 0 rgba(0,0,0,.4);margin-top:2px}
#seOv .sv-stars{font-size:clamp(20px,3.4vh,28px);color:#ffc93a;letter-spacing:2px;text-shadow:0 2px 0 rgba(120,70,0,.5);margin-top:2px}
#seOv .sv-mast{display:flex;align-items:center;gap:8px;margin-top:10px;padding:5px 14px 5px 5px;border-radius:20px;background:rgba(40,34,52,.75);font-weight:900;font-size:16px;color:#e9dcc0}
#seOv .sv-mast b{width:30px;height:32px;display:flex;align-items:center;justify-content:center;background:linear-gradient(180deg,#3a3446,#23202c);
 clip-path:polygon(50% 0,100% 18%,100% 64%,50% 100%,0 64%,0 18%);color:#ffd257;font-size:16px}
#seOv .sv-traits{margin-top:auto;width:100%}
#seOv .sv-traits h4{margin:0 0 8px;font-size:17px;font-weight:900;text-transform:uppercase;text-shadow:0 2px 0 rgba(0,0,0,.45)}
#seOv .sv-cards{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap}
#seOv .sv-tc{position:relative;width:clamp(76px,8.4vw,96px);padding:18px 4px 8px;border-radius:9px;background:linear-gradient(180deg,#f3ead7,#e0d3b6);color:#3a2a14;text-align:center;
 font-size:12px;font-weight:900;text-transform:uppercase;box-shadow:0 3px 8px rgba(0,0,0,.3)}
#seOv .sv-tc::before,#seOv .sv-tc::after{content:'';position:absolute;top:5px;width:8px;height:8px;border-radius:50%;background:#8a7a64}
#seOv .sv-tc::before{left:12px}#seOv .sv-tc::after{right:12px}
#seOv .sv-tc span{display:flex;align-items:center;justify-content:center;width:50px;height:50px;margin:0 auto 6px;border-radius:50%;
 background:radial-gradient(circle at 35% 30%,#6cb4ff,#2d5fbf);font-size:26px;box-shadow:inset 0 -3px 0 rgba(0,0,0,.2)}
#seOv .sv-go{display:flex;gap:10px;margin-top:12px;width:100%;justify-content:flex-end}
#seOv .sv-heart{width:clamp(66px,8vw,92px);height:clamp(48px,7.6vh,62px);border-radius:12px;background:linear-gradient(180deg,#d45470,#a83550);color:#fff;font-size:30px}
#seOv .sv-ride{flex:1;max-width:240px;height:clamp(48px,7.6vh,62px);border-radius:12px;background:linear-gradient(180deg,#fbe36a,#eec52d);color:#1f2350;font-size:clamp(22px,3.6vh,30px);font-weight:900;letter-spacing:.5px}
#seOv .sv-arrow{position:absolute;width:clamp(44px,6.4vh,56px);height:clamp(44px,6.4vh,56px);margin-top:calc(clamp(44px,6.4vh,56px) / -2);border-radius:50%;
 display:none;align-items:center;justify-content:center;pointer-events:auto;padding:0;
 background:radial-gradient(circle at 35% 30%,rgba(58,93,163,.94),rgba(28,45,90,.94));border:3px solid #dfe6f5!important;color:#fff;font-size:clamp(28px,4.4vh,36px);font-weight:900;line-height:1;
 box-shadow:0 4px 12px rgba(0,0,0,.35)!important}
#seOv .sv-arrow.show{display:flex}
#seOv .sv-arrow:hover{filter:brightness(1.18)}
#seOv .sv-arrow:active{transform:scale(.94)}
#seOv .sv-count{position:absolute;transform:translateX(-50%);display:none;padding:4px 14px;border-radius:14px;background:rgba(30,24,38,.8);
 font-weight:900;font-size:clamp(13px,2vh,16px);pointer-events:none;white-space:nowrap;text-shadow:0 1px 0 rgba(0,0,0,.4)}
#seOv .sv-count.show{display:block}
#seOv .sv-more{margin-top:8px;background:none;color:#f3e6c8;font-weight:900;font-size:14px;text-decoration:underline;text-shadow:0 1px 2px rgba(0,0,0,.6)}
body.se-ov-open #hud,body.se-ov-open #mini,body.se-ov-open #hint,body.se-ov-open #ftBar,body.se-ov-open #questTrack,body.se-ov-open #ctx,
body.se-ov-open #statusCard,body.se-ov-open #stamWrap,body.se-ov-open #fcHint,body.se-ov-open #chatFeed,body.se-ov-open #chatBar,
body.se-ov-open #seHudRoot,body.se-ov-open #seWay,body.se-ov-open #seMarketLbl,body.se-ov-open #stickZone,body.se-ov-open #dock,
body.se-ov-open #tameHud,body.se-ov-open #roundHud,body.se-ov-open #drillHud,body.se-ov-open #poseBar{display:none!important}
/* A phone held upright: the horse in the top half, the card in the bottom half, and of the right-hand
   column only her name and the RIDE button, which is all there is room for. */
@media (max-width:760px){#seOv .sv-pill{display:none}#seOv .sv-title{font-size:19px}
 #seOv .sv-card{top:50%;left:calc(clamp(72px,8.5vw,112px) + 8px);right:8px;width:auto}
 #seOv .sv-right{bottom:auto;right:10px;width:calc(100vw - clamp(72px,8.5vw,112px) - 24px)}
 #seOv .sv-mast,#seOv .sv-traits h4,#seOv .sv-cards,#seOv .sv-more{display:none}#seOv .sv-traits{margin-top:6px}
 #seOv .sv-go{display:none}}`;
  document.head.appendChild(st);
 }

 /* ---------------------------------------------------------------- the frame -------------- */
 const root=document.createElement('div'); root.id='seOv';
 root.innerHTML='<div class="sv-top"><button class="sv-circ" data-se="close" title="Back">↩</button>'
  +'<div class="sv-title"><i>🐎</i>Horse Overview</div><div class="sv-sp"></div>'
  +'<div class="sv-pill" title="Coins"><b>🪙</b><span id="seOvCoins">0</span></div>'
  +'<div class="sv-pill" title="Gems"><b>💎</b><span id="seOvGems">0</span></div>'
  +'<button class="sv-circ" data-se="close" title="Close">✕</button></div>'
  +'<div class="sv-rail">'+TABS.map(t=>'<button class="sv-tab" data-se="tab:'+t[0]+'"><span>'+t[2]+'</span>'+t[1]+'</button>').join('')+'</div>'
  +'<div class="sv-card"><div class="sv-scroll" id="seOvBody"></div><div class="sv-btns" id="seOvBtns"></div></div>'
  +'<div class="sv-right" id="seOvRight"></div>'
  +'<button class="sv-arrow" id="seOvPrev" data-se="cycle:-1" title="Previous horse"><svg viewBox="0 0 24 24" width="55%" height="55%" aria-hidden="true"><polyline points="15,5 8,12 15,19" fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>'
  +'<button class="sv-arrow" id="seOvNext" data-se="cycle:1" title="Next horse"><svg viewBox="0 0 24 24" width="55%" height="55%" aria-hidden="true"><polyline points="9,5 16,12 9,19" fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>'
  +'<div class="sv-count" id="seOvCount"></div>';
 document.body.appendChild(root);

 /* ---------------------------------------------------------------- data ------------------- */
 const fresh=()=>{try{return G.save.fresh();}catch(e){return null;}};
 const breedLabel=k=>{try{return G.horse.breedLabel(k);}catch(e){return k;}};
 const starsOf=h=>{let n=h.stars;if(!n){const b=(T.BREEDS3||[]).find(r=>r[0]===h.breed);n=b?((T.TIER_STARS||{})[b[2]]||2):2;}return clamp(n|0,1,6);};
 function effective(h){try{return G.xp.effStats(h)||{};}catch(e){return h.stats||{};}}

 function horseTab(s,h){
  try{G.xp.ensureStats(h);}catch(e){}
  const lvl=h.level||1, cap=50+lvl*50, xp=Math.round(h.xp||0), bond=clamp(Math.round(h.bond||0),0,100);
  let bl=null;try{bl=G.horse.bondLevel?G.horse.bondLevel(h):null;}catch(e){}
  const eff=effective(h);
  let x='<div class="sv-lvl"><div class="sv-shield">'+lvl+'</div>'
   +'<div class="sv-meter"><div class="lb"><span>Horse level</span><small>'+xp+'/'+cap+'</small></div><div class="sv-bar"><i style="width:'+clamp(100*xp/cap,0,100).toFixed(1)+'%"></i></div></div>'
   +'<div class="sv-meter sv-bond"><div class="lb"><span>💗 Bond'+(bl!=null?' · Lv '+esc(bl):'')+'</span><small>'+bond+'/100</small></div><div class="sv-bar"><i style="width:'+bond+'%"></i></div></div></div>';
  x+='<div class="sv-head">Horse stats</div>';
  for(const [k,label,ic] of STATS){
   const v=(h.stats&&h.stats[k])|0, e=eff[k]!=null?eff[k]|0:v, bonus=e-v;
   let ceil=10,need=1;try{ceil=G.xp.statCeil(h,k);need=G.xp.statNeed(v)||1;}catch(err){}
   let capN=ceil;try{capN=Math.min(G.xp.statCap(h),ceil);}catch(err){}
   const prog=v>=capN?100:clamp(100*((h.sxp&&h.sxp[k])||0)/need,0,100);
   x+='<div class="sv-stat" title="'+esc(v>=capN?'At its cap for now':((h.sxp&&h.sxp[k])||0)+' / '+need+' XP to '+(v+1))+'">'
    +'<span class="ic">'+ic+'</span><div><div class="nm">'+label+'</div><div class="mx">MAX '+ceil+'</div></div>'
    +'<div><div class="v'+(bonus>0?' up':'')+'">'+e+'</div>'+(bonus>0?'<div class="bn">🐎 +'+bonus+'</div>':'')+'</div>'
    +'<div class="tr"><i style="width:'+prog.toFixed(1)+'%"></i></div></div>';
  }
  return {body:x,btns:'<button class="sv-b" data-se="open:stable">🏠 Stable</button><button class="sv-b" data-se="open:tack">🐎 Tack</button>'};
 }
 function feedingTab(s,h){
  const N=h.needs||{};
  const needs=[['Fed','hunger','#f0a040'],['Water','thirst','#52b4ee'],['Clean','clean','#a596f5'],['Happy','happy','#72cc72']];
  let x='<div class="sv-head">Needs</div><div class="sv-need">'+needs.map(n=>{const v=clamp(Math.round(N[n[1]]||0),0,100);
   return '<div class="sv-meter" style="--c:'+n[2]+'"><div class="lb"><span>'+n[0]+'</span><small>'+v+'/100</small></div><div class="sv-bar"><i style="width:'+v+'%"></i></div></div>';}).join('')+'</div>';
  x+='<div class="sv-grid" style="margin-bottom:10px">'
   +'<button class="sv-item" data-se="care:water"><big>💧</big>Water</button>'
   +'<button class="sv-item" data-se="care:groom"><big>🧼</big>Groom</button>'
   +'<button class="sv-item" data-se="care:pet"><big>💗</big>Pet</button></div>';
  const F=T.FOODS3||{}, items=s.items||{};
  const keys=Object.keys(F).filter(k=>(items[k]|0)>0||['carrot','apple','hay'].includes(k));
  x+='<div class="sv-head">Food</div><div class="sv-grid">'+keys.map(k=>{const f=F[k],n=items[k]|0;
   const trains=f.stat?((T.STAT_LBL||{})[f.stat]||f.stat).replace(/^\S+\s/,''):'';
   return '<button class="sv-item'+(n?'':' none')+'" data-se="care:'+esc(k)+'" title="'+esc(f.label||k)+'"><big>'+(f.emoji||'🥕')+'</big>'+esc(f.label||k)+'<small>×'+n+(trains?' · '+esc(trains):'')+'</small></button>';}).join('')+'</div>';
  x+='<p class="sv-p" style="margin-top:10px">Each food trains one stat. Forage grows all over the Basin, and the Market sells the rest.</p>';
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
  x+='<p class="sv-p" style="margin-top:10px">Mastery rises as you own and ride more '+esc(breedLabel(h.breed))+'s. Tricks, perks and the full ladder are on the care page.</p>';
  return {body:x,btns:'<button class="sv-b" data-se="open:care">📋 Tricks &amp; perks</button>'};
 }
 function equipmentTab(s,h){
  const eff=effective(h);
  let x='<div class="sv-head">Tack bonuses</div>';
  x+=STATS.map(([k,label,ic])=>{const b=((eff[k]|0)-((h.stats&&h.stats[k])|0));
   return '<div class="sv-row"><span>'+ic+' '+label+'</span><span style="color:'+(b>0?'#a6e86a':'#e8d8b8')+'">'+(b>0?'+'+b:'—')+'</span></div>';}).join('');
  x+='<p class="sv-p" style="margin-top:10px">Saddles, bridles and boots each add to a stat. Change what '+esc(h.name)+' wears in the tack room.</p>';
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
  body.innerHTML=out.body; $('seOvBtns').innerHTML=btns; $('seOvBtns').style.display=btns?'':'none';
  body.scrollTop=top;
  $('seOvRight').innerHTML=rightColumn(s,h);
  $('seOvCoins').textContent=String(s.coins|0); $('seOvGems').textContent=String(s.gems|0);
  try{placeArrows();}catch(e){}
 }

 /* ---------------------------------------------------------------- open, close ------------ */
 function open(tab){
  if(ST.tab!==tab&&tab)ST.tab=tab;
  try{G.hidePanels();}catch(e){}
  const p=G.horse.player;
  ST.open=true; ST.snap=true; ST.side=null; ST.heading=p?p.heading:null;
  ST.fov=G.camera?G.camera.fov:null;
  try{if(p&&p.rider&&p.rider.g){ST.rider=p.rider.g.visible;p.rider.g.visible=false;}}catch(e){}
  document.body.classList.add('se-ov-open'); root.classList.add('on');
  render(); measureGap(); placeArrows();
 }
 function close(){
  if(!ST.open)return;
  ST.open=false; root.classList.remove('on'); document.body.classList.remove('se-ov-open');
  try{const p=G.horse.player;if(p&&p.rider&&p.rider.g&&ST.rider!=null)p.rider.g.visible=ST.rider;}catch(e){}
  try{if(G.camera&&ST.fov){G.camera.fov=ST.fov;G.camera.updateProjectionMatrix();}}catch(e){}
 }
 const later=()=>{render();setTimeout(render,350);setTimeout(render,1200);};
 function openOther(what){
  const i=G.horse.rideIdx(); close();
  try{
   if(what==='care')G.ui.openCare();
   else if(what==='stable')G.ui.openStable();
   else if(what==='style')G.ui.dispatch('style:open');
   else if(what==='breed')G.ui.dispatch('breed:open');
   else if(what==='tack')G.ui.dispatch('ranch:tack:'+i);
   else if(what==='wardrobe')G.ui.dispatch('wd:creator');
   else if(what==='shop')G.ui.openShop();
  }catch(e){console.error('se-care open '+what,e);}
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
  if(op==='close'){close();return;}
  if(op==='tab'){ST.tab=arg;render();return;}
  if(op==='ride'){if(arg!=null)rideHorse(+arg);else close();return;}
  if(op==='cycle'){cycle(+arg||1);return;}
  if(op==='open'){openOther(arg);return;}
  if(op==='care'){try{G.ui.careAct(arg);}catch(err){console.error('se-care care '+arg,err);}later();return;}
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
  const h=p.heading, gy=G.world.groundH(p.pos.x,p.pos.z)+(p.y||0), sc=(p.mesh&&p.mesh.scale&&p.mesh.scale.x)||1;
  const vf=36*Math.PI/180, hf=2*Math.atan(Math.tan(vf/2)*(cam.aspect||1.33)), w=Math.max(0.18,GAP.r-GAP.l), cx=(GAP.l+GAP.r)/2;
  const hh=Math.max(0.2,GAP.b-GAP.t), cy=(GAP.t+GAP.b)/2;
  /* Far enough back that her whole length fits the free gap and her whole height fits the frame,
     from her right, which is the side the mane falls on, and a touch ahead of square. */
  const d=Math.max(2.3*sc/(2*0.86*w*Math.tan(hf/2)),2.15*sc/(2*0.80*hh*Math.tan(vf/2)));
  const Fx=Math.sin(h),Fz=Math.cos(h);
  _at.set(p.pos.x,gy+0.95*sc,p.pos.z);
  /* Her right is the side the mane falls on, so that is the side to stand; but a fence or a wall
     behind that spot would pull the camera in until she fills the screen, so if the right side
     has no room the left side is used instead, and the choice is kept for as long as it is open
     so the view does not flip from one side to the other between frames. */
  const place=(side,out)=>{const Sx=-Math.cos(h)*side,Sz=Math.sin(h)*side;
   out.set(p.pos.x+Sx*d+Fx*0.30*d,gy+1.15*sc+0.05*d,p.pos.z+Sz*d+Fz*0.30*d);
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
 G.seCare={open,close,render,state:()=>({open:ST.open,tab:ST.tab})};
 G.on('state',o=>{o.seCare={open:ST.open,tab:ST.tab};});
}

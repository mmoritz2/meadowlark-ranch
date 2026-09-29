/* Feature package 'se-horses' — My Horses, laid out the way the riding game this one is modelled on
   lays out its own.

   Its My Horses is one tall screen over the dimmed world. Favourites come first, under a heart and a
   ruled line; then every breed you own, its name in serif capitals with its mastery beside it in pale
   gold, a track of ten round nodes (five for a fantasy breed) with a shield on the level you have
   reached, and a row of portrait cards. Each card is that horse's own head, rendered from the game's
   own model in its own coat, markings, horn or dragon crest, on a ground coloured by its stars (green,
   blue, purple, gold, rose); its level in a crest at the top right, its stars along the bottom, its
   name on an indigo plate. The last card of every breed is Get Horse. A magnifier at the top right
   finds a horse by name, breed or coat.
   Tap a card and a panel slides in from the right (a sheet from the bottom on a phone) with that horse:
   its stars, a big picture, breed and mastery, level and XP, bond hearts, where it is, whether it needs
   care, a tile for everything the old list could do to it (favourite, pasture, take along, tack,
   whistle, sheet, family tree, hitch, and anything a package adds later), and two buttons at the foot:
   Ride and Details for a grown horse, Follow me for a foal, Warm egg for an egg. Along the bottom of
   the screen: how many are out in the pasture and in the barn, Pets, the Full list, Breed Studio, and
   the gold "Ride Bay sporthorse" the old list always had.
   Ours was a long list of rows in a narrow card.

   Everything is read from the save as it stands, and every action goes through the game's own
   buttons: the stable panel is still rendered underneath (se-frame's cover()), so Pasture clicks the
   row's own Pasture button, Ride its Ride, Rename its pen, and so on; nothing about riding, turnout,
   hitching or breeding changes. The one thing this screen adds to the save is a favourite flag on the
   horse (h.fav). The full old list is still one tap away, framed like every other menu.

   The pictures: each head is the game's own rigged horse, built in a private scene and rendered inside
   a tick onto the game's canvas, then copied off before the frame's own render (se-frame's snap trick),
   one horse at a time and only for the cards in view; a drawn bust in the horse's colours stands in
   until it arrives and whenever the graphics are on Low. Every other drawing here is this package's
   own. Nothing runs at import time. */
export const id='se-horses';
export function install(G){
 const K=G.seFrame, T=G.tables;
 if(!K||!T||!T.BREEDS3||!document.body||!document.getElementById('stablePanel')||document.getElementById('seHs'))return;
 const $=id=>document.getElementById(id), esc=K.esc;
 const S=()=>G.save.fresh()||{horses:[]};
 const nx=s=>{try{return window.__noEmoji.clean(String(s==null?'':s),true);}catch(e){return String(s==null?'':s);}};
 const P=()=>$('stablePanel');
 const via=sel=>{const p=P(),x=p&&p.querySelector(sel);if(x){x.click();return true;}return false;};
 const has=sel=>{const p=P();return !!(p&&p.querySelector(sel));};
 const idxOf=(s,id)=>(s.horses||[]).findIndex(h=>h.id===id);   // never cache an index across paints
 const rowOf=i=>{const b=P()&&P().querySelector('[data-st="rn:'+i+'"]');return b?b.closest('.evrow'):null;};   // every horse row has a pen; ui2-horse moves the buttons but keeps the row
 const hash=str=>{let h=2166136261;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;};
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const starsOf=h=>{let n=2;try{n=G.horse.roster?G.horse.roster.starsN(h):((T.TIER_STARS||{})[(T.BREEDS3.find(b=>b[0]===h.breed)||[])[2]]||2);}catch(e){}return clamp(n|0||2,1,6);};
 const label=b=>nx(G.horse.breedLabel?G.horse.breedLabel(b):b);
 const variantOf=h=>{try{return G.horse.roster&&G.horse.roster.variantLabel?nx(G.horse.roster.variantLabel(h)).trim():'';}catch(e){return '';}};
 const isEgg=h=>!!(h.egg&&h.foal), isFoal=h=>!!(h.foal&&!h.egg);
 const lowNeeds=h=>!!(h.needs&&Object.values(h.needs).some(v=>v<35));
 const BOND=['Stranger','Acquaintance','Companion','Partner','Kindred','Heart-bonded'];   // bond-personality-emotes' names (not exported)
 const EGGW=()=>(G.breeding&&G.breeding.EGG_WARMS)||5, EGGMS=()=>(G.breeding&&G.breeding.EGG_HATCH_MS)||864e5;
 const hrs=ms=>Math.max(1,Math.ceil(ms/3600000));
 const maxOf=b=>{try{return G.mastery&&G.mastery.maxOf?G.mastery.maxOf(b):10;}catch(e){return 10;}};
 const masteryM=(s,b)=>{let M=1;try{M=G.xp.masteryOf(s,b)||1;}catch(e){}return clamp(M,1,maxOf(b));};   // mutates s.mastery: only ever the fresh copy
 const ladder=b=>{try{if(G.mastery&&G.mastery.ladderOf)return G.mastery.ladderOf(b);}catch(e){}return T.MASTERY_UNLOCKS||{};};
 const rung=(L,k)=>nx(L&&L[k]!=null?(L[k].label||L[k]):'').trim();
 const sexOf=h=>{const f=h.sex==='f'||h.sex==='mare'||h.sex==='filly';return h.foal?(f?'Filly':'Colt'):(f?'Mare':'Stallion');};
 const safeCol=c=>/^[#\w(),.\s%-]{1,60}$/.test(String(c||''))?String(c):'';
 let uid=0;   // unique gradient ids for the mastery shields

 /* ---------------------------------------------------------------- drawings --------------- */
 const STAR='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.6l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17l-5.6 3 1.1-6.3-4.6-4.4 6.3-.9z" fill="#f6bd3b" stroke="#9c6410" stroke-width="1.3" stroke-linejoin="round"/><path d="M12 5.4l1.9 3.9" stroke="#fff3c4" stroke-width="1.2" stroke-linecap="round" opacity=".8"/></svg>';
 const HEARTP='M12 20.5s-8-4.9-8-11.2A4.5 4.5 0 0 1 12 6.5a4.5 4.5 0 0 1 8 2.8c0 6.3-8 11.2-8 11.2z';
 const HEART_F=c=>'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="'+HEARTP+'" fill="'+c+'"/></svg>';
 const HEART_O='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="'+HEARTP+'" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="1.8"/></svg>';
 const LV=n=>'<svg viewBox="0 0 40 46" aria-hidden="true"><path d="M20 2.5 36.5 8.5V24c0 10-7.4 16.6-16.5 19.8C10.9 40.6 3.5 34 3.5 24V8.5z" fill="#454585" stroke="#fdeabc" stroke-width="2.6" stroke-linejoin="round"/>'
  +'<text x="20" y="30" text-anchor="middle" font-family="Nunito,system-ui,sans-serif" font-weight="900" font-size="'+(n>9?16:19)+'" fill="#fff">'+n+'</text></svg>';
 const SHIELD=n=>{const id='shg'+(++uid);return '<svg viewBox="0 0 44 50" aria-hidden="true"><defs><linearGradient id="'+id+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6b4521"/><stop offset="1" stop-color="#2e1d0c"/></linearGradient></defs>'
  +'<path d="M22 2.5 40.5 9V26c0 11.5-8.3 18.8-18.5 22C11.8 44.8 3.5 37.5 3.5 26V9z" fill="url(#'+id+')" stroke="#f6dfab" stroke-width="3" stroke-linejoin="round"/>'
  +'<text x="22" y="32.5" text-anchor="middle" font-family="Georgia,serif" font-weight="800" font-size="'+(n>9?17:20)+'" fill="#fff">'+n+'</text></svg>';};
 /* Get Horse: a pale head facing right on an arched neck, ears up, an eye, a nostril and a cheek line;
    three locks of mane flow back from the crest, set off from the neck by a groove in the card's grey;
    a plus in a white disc at the lower left */
 const GET_ICON='<svg viewBox="0 0 48 48" aria-hidden="true"><g transform="translate(1.2 1.6)">'
  +'<path fill="#e2e0de" d="M27 10.5C21 9 14.5 11.5 10 18.5c3.2-1.9 6.4-2.5 9.6-2.1-2.6 1.6-4.6 4-5.8 7.2 3-3 6.4-4.4 9.8-4.6z"/>'
  +'<path fill="#e2e0de" d="M23 18.5c-6.2.5-11.2 4.5-13.8 11.1 2.4-2 5.2-3 8.2-3-2.2 2-3.6 4.6-4 7.6 2.2-3.2 5-5 8.2-5.8z"/>'
  +'<path fill="#e2e0de" d="M19.8 26.4c-4 1.2-6.9 3.8-8.4 7.6 2-1.3 4.2-1.9 6.6-1.8-1.4 1.4-2.3 3.2-2.6 5.3 1.5-2 3.4-3.2 5.6-3.7z"/>'
  +'<path fill="none" stroke="#57524f" stroke-width="2.6" d="M16.7 39C17.2 31.5 19.6 24 24 17c1.5-2.2 2.5-4.2 3-6.5"/>'
  +'<path fill="#cfcbc8" d="M25.4 12.6c-.8-3-.5-5.8.6-8 1.4 2.2 2 4.6 1.8 7.4z"/>'
  +'<path fill="#e2e0de" d="M16 46C15.5 36 18 26 24 17c1.5-2.5 2.5-4.5 3-6.5.1-3 .7-5.2 1.9-7.1 1.4 2.1 2.3 4.6 2.4 7.7 2.9.8 5.7 2.9 8 5.8 1.2 1.5 2 3 2.5 4.1 1.8 2.6 2 5.6.2 7.2-1.4 1.2-3.4 1.3-5.2.4-1.4-.3-2.7-.3-3.6.3-.6.5-1 1.2-1.1 2 .4 5.3.9 10.2 3 16.1z"/>'
  +'<path d="M29.6 18.2c.6 3.4 1.8 6 3.8 7.8" fill="none" stroke="#bab6b3" stroke-width=".9" stroke-linecap="round"/>'
  +'<ellipse cx="33.8" cy="15.6" rx="1.55" ry="1.15" fill="#3f3a38" transform="rotate(-18 33.8 15.6)"/>'
  +'<path d="M40.4 23.4c.7-.2 1.3.1 1.5.7" fill="none" stroke="#6b6563" stroke-width="1" stroke-linecap="round"/>'
  +'<path d="M38.4 27c.9.4 1.9.4 2.8-.1" fill="none" stroke="#8a8481" stroke-width=".8" stroke-linecap="round"/></g>'
  +'<circle cx="10" cy="41.2" r="6.6" fill="#fff" stroke="#3e3937" stroke-width="1.4"/><path d="M10 37.6v7.2M6.4 41.2h7.2" stroke="#3e3937" stroke-width="2.3" stroke-linecap="round"/></svg>';
 const ICON={
  leaf:'<path d="M5 19c0-8.5 6-14 15-14 0 8.5-6 14-15 14z"/><path d="M5 19l9-9"/>',
  follow:'<path d="M4 18c3-5 6-7 10-7h6"/><path d="M16 7l4 4-4 4"/>',
  saddle:'<path d="M3 10.5c2.5 0 4-2.5 9-2.5s6.5 2.5 9 2.5"/><path d="M5 10.8c.8 3 3.5 4.4 7 4.4s6.2-1.4 7-4.4"/><path d="M12 15.2V19"/><path d="M9.5 19.5h5"/>',
  whistle:'<path d="M14 7.5h7V11l-8.2 3.2A4.8 4.8 0 1 1 9 8.3"/><circle cx="8" cy="13" r="1.4"/><path d="M11 7.5h3"/>',
  tree:'<circle cx="12" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="19" r="2"/><path d="M12 7v5M6 17v-3h12v3"/>',
  hitch:'<path d="M8 21V5M5 5h6"/><circle cx="14.5" cy="11" r="3"/><path d="M8 11h3.5"/>',
  pen:'<path d="M4 20l1-4L16 5l3 3L8 19z"/><path d="M14 7l3 3"/>'};
 const ic=(k,col,sw)=>ICON[k]?'<svg viewBox="0 0 24 24" fill="none" stroke="'+(col||'currentColor')+'" stroke-width="'+(sw||2.1)+'" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+ICON[k]+'</svg>':K.line(k,col,sw);
 /* the placeholder bust, in the horse's own colours, facing left: shown until the portrait arrives, and
    the picture itself while portraits are off. Face white (a blaze, star or snip) is h.mark2; h.mark is a
    body pattern (dapple, pinto, roan …) and draws nothing on a head this small. */
 const shade=(hex,f)=>{const m=/^#?([0-9a-f]{6})$/i.exec(String(hex||''));if(!m)return '#6b4a2e';const n=parseInt(m[1],16);
  return '#'+[n>>16,n>>8&255,n&255].map(v=>Math.max(0,Math.min(255,Math.round(v*f))).toString(16).padStart(2,'0')).join('');};
 function BUST(h){ const c=h.colors||{}, b=/^#[0-9a-f]{6}$/i.test(c.body)?c.body:'#8a5a2b', m=/^#[0-9a-f]{6}$/i.test(c.mane)?c.mane:shade(b,.55), d=shade(b,.72), w='#f4efe6';
  return '<svg class="shs-fb" viewBox="0 0 100 125" preserveAspectRatio="xMidYMax slice" aria-hidden="true">'
  +(h.wings?'<path d="M86 64c10-18 12-34 8-50-9 9-17 22-20 38z" fill="'+shade(b,1.15)+'" opacity=".6"/>':'')
  +'<path d="M100 125V80C97 60 86 42 66 29c-4-2.6-7.6-4.6-10.8-5.6L50 24C42 31 30 45 20 58c-4 5.2-6 10-3 13.6 3 3.6 9.6 4.2 15.4 1.6L44 67c4-2.8 7.8-5.4 10.8-4.6C57 72 56 98 58 125z" fill="'+b+'"/>'
  +'<path d="M44 67c4-2.8 7.8-5.4 10.8-4.6C57 72 56 98 58 125h9c-3-26-4-50-6.4-64.6z" fill="'+d+'" opacity=".55"/>'
  +'<path d="M58.5 25.5l7.2-14 2.6 16z" fill="'+d+'"/><path d="M51 24.5l4.6-16.5 7 15.5z" fill="'+b+'"/><path d="M53.6 21.5l2-7.4 3 7z" fill="'+d+'" opacity=".6"/>'
  +(h.mark2==='blaze'?'<path d="M47.5 28c-6.5 9-15.5 21-24.5 32l4 2.6c8-11.4 17-23.4 23-32.6z" fill="'+w+'" opacity=".95"/>'
   :h.mark2==='star'?'<path d="M46 29.5l2.2 3.4-3.6 1.8-.6-3.9z" fill="'+w+'" opacity=".95"/>'
   :h.mark2==='snip'?'<path d="M24.5 60.5c1.8-2.6 4.2-4.3 6.5-4.6l-1.2 4.8c-1.8.6-3.6 1.1-5.3-.2z" fill="'+w+'" opacity=".9"/>':'')
  +(h.dragon?'<path d="M60 26l6-12 1 13zM70 33l8-10-1 13zM79 43l9-7-3 12z" fill="'+shade(b,.6)+'"/>':'')
  +'<path d="M57 23c18 5 34 22 43 42v26C92 70 79 51 62 38z" fill="'+m+'"/><path d="M50.5 24.5c-4.5 5-7 10-6.5 16 3.5-5.2 6.8-10 10.4-14.4z" fill="'+m+'"/>'
  +'<circle cx="42" cy="39" r="2.8" fill="#1b0f08"/><circle cx="41.1" cy="38.1" r=".9" fill="#fff" opacity=".85"/>'
  +'<ellipse cx="21.5" cy="64.5" rx="2.2" ry="1.5" fill="#1b0f08" opacity=".55" transform="rotate(-30 21.5 64.5)"/><path d="M18.5 71.5c3.5 1.2 7.5 1.2 11 0" stroke="#1b0f08" stroke-width="1.1" fill="none" opacity=".45"/>'
  +(h.horn?'<path d="M49 23.5 40.5 3 53.5 20.5z" fill="#f1dfa1" stroke="#b99a45" stroke-width=".8"/><path d="M44 12l5 2.4M42.4 8.6l4.2 2" stroke="#b99a45" stroke-width=".8"/>':'')
  +'</svg>'; }
 /* an egg: speckled in the colours the foal will have */
 function EGG(h){ const c=h.colors||{}, s1=/^#[0-9a-f]{6}$/i.test(c.body)?c.body:'#b98a4a', s2=/^#[0-9a-f]{6}$/i.test(c.mane)?c.mane:'#6b4a2e', R=((+h.id||1)*9301+49297)%233280;
  const dots=[[40,62,3.4],[58,56,2.6],[63,78,3.8],[45,88,2.8],[55,97,3.2],[36,79,2.2],[66,95,2.4]].map((p,i)=>'<circle cx="'+(p[0]+((R>>i)&3)-1.5)+'" cy="'+p[1]+'" r="'+p[2]+'" fill="'+(i%2?s2:s1)+'" opacity=".75"/>').join('');
  return '<svg class="shs-fb" viewBox="0 0 100 125" aria-hidden="true"><ellipse cx="50" cy="114" rx="28" ry="5.5" fill="rgba(0,0,0,.2)"/>'
  +'<path d="M50 30c-17 0-31 30-31 52a31 31 0 0 0 62 0c0-22-14-52-31-52z" fill="#f6ecd4" stroke="#cbb88f" stroke-width="1.5"/>'+dots
  +'<path d="M36 54c3-8 8-14 13-16" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".7" fill="none"/></svg>'; }
 /* card colours by stars: photo top, photo bottom, rim (green, blue, purple, gold, rose) */
 const RAMP={2:['#cfe9b3','#5b8a45','#9cc58a'],3:['#b4d6f5','#56769a','#96b8d8'],4:['#dac7f2','#62478f','#b39ad6'],5:['#f7de8e','#97701f','#e2c06a'],6:['#f9cbd6','#973a58','#e59ab0']};
 const rampOf=n=>RAMP[n]||(n<2?RAMP[2]:RAMP[6]);

 /* ---------------------------------------------------------------- the look -------------- */
 if(!$('seHsCss')){const css=document.createElement('style');css.id='seHsCss';css.textContent=`
#seHs{position:fixed;inset:0;z-index:10;display:none;font-family:Nunito,system-ui,sans-serif;color:#fff;overflow:clip;user-select:none;-webkit-user-select:none;
 --shs-dw:clamp(260px,24vw,330px);--shs-foot:clamp(46px,7vh,58px);--shs-ch:clamp(118px,16.4vh,164px);--shs-rad:clamp(5px,.75vh,8px)}
#seHs.on{display:block}
#seHs .shs-dim{position:absolute;inset:0;background:rgba(14,14,24,.48);backdrop-filter:blur(3px) saturate(.55) brightness(.74);-webkit-backdrop-filter:blur(3px) saturate(.55) brightness(.74)}
#seHs .se-strip{position:absolute}
#seHs button{font-family:inherit}
#seHs :focus-visible{outline:3px solid #ffd970;outline-offset:2px}
/* the list */
#seHs .shs-main{position:absolute;left:0;right:0;top:var(--sef-top);bottom:var(--shs-foot);overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;
 scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.35) transparent;padding:clamp(10px,2.2vh,20px) 0 calc(clamp(18px,3vh,28px) + 56px);box-sizing:border-box;transition:right .22s}   /* room to scroll the last row clear of a toast */
#seHs .shs-main::-webkit-scrollbar{width:8px}
#seHs .shs-main::-webkit-scrollbar-thumb{background:rgba(255,255,255,.35);border-radius:4px}
#seHs.dr .shs-main,#seHs.dr .shs-foot{right:var(--shs-dw)}
#seHs .shs-col{position:relative;width:min(1380px,72vw,calc(100% - 48px));margin:0 auto}
@media (max-width:1099px){#seHs .shs-col{width:calc(100% - 64px)}}
/* the pinned bar: the magnifier on a desktop; the counts and the magnifier on a phone */
#seHs .shs-bar2{position:absolute;top:calc(var(--sef-top) + clamp(8px,1.8vh,16px));right:clamp(12px,1.6vw,22px);z-index:3;display:flex;align-items:center;gap:8px;transition:right .22s}
#seHs.dr .shs-bar2{right:calc(var(--shs-dw) + 14px)}
#seHs .shs-bar2 .sp{flex:1}
#seHs .shs-cnt{display:none}
#seHs .shs-sbtn{background:radial-gradient(circle at 38% 30%,#7d6ac8,#4b3b8e)!important;border-color:rgba(255,255,255,.45)!important}
#seHs .shs-q{display:none;width:min(300px,34vw);height:clamp(32px,4.6vh,38px);box-sizing:border-box;padding:0 14px;border-radius:19px;border:2px solid #d6c298;background:#fbf5e6;color:#3b2a17;
 font:700 clamp(13px,1.9vh,15px)/1 Nunito,system-ui,sans-serif;user-select:text;-webkit-user-select:text}
#seHs .shs-q::placeholder{color:#6b5a40}
#seHs .shs-q::-webkit-search-cancel-button{-webkit-appearance:none;appearance:none;display:none}   /* the magnifier clears it */
#seHs.q .shs-q{display:block}
/* banners at the top of the list */
#seHs .shs-coat{display:flex;align-items:center;flex-wrap:wrap;gap:8px 14px;margin:0 0 clamp(12px,2.4vh,20px);padding:10px 14px;border-radius:10px;background:linear-gradient(180deg,#f7f0de,#ece0c3);
 border:1.5px solid #d6c298;box-shadow:0 3px 8px rgba(0,0,0,.28);color:#3b2a17}
#seHs .shs-coat b{font:800 clamp(14px,2.1vh,17px)/1.2 var(--sef-serif)}
#seHs .shs-coat span{font:700 13px/1.3 Nunito,system-ui,sans-serif;color:#5a4630}
#seHs .shs-coat .sp{flex:1}
#seHs .shs-coat button{display:flex;align-items:center;gap:6px;padding:7px 12px!important;font-size:13px!important}
#seHs .shs-coat i{width:14px;height:14px;border-radius:50%;border:2px solid;display:inline-block;box-sizing:border-box}
#seHs .shs-note{display:flex;align-items:center;gap:8px;margin:0 auto clamp(12px,2.4vh,20px);max-width:640px;padding:8px 12px;border-radius:8px;background:rgba(22,20,44,.86);color:#f1ecff;
 font:700 clamp(12.5px,1.9vh,14.5px)/1.35 Nunito,system-ui,sans-serif;box-shadow:0 2px 6px rgba(0,0,0,.3)}
#seHs .shs-note svg{width:18px;height:18px;flex:none}
#seHs .shs-hint{margin:0 auto;max-width:520px;text-align:center;background:rgba(22,20,44,.8);border-radius:8px;padding:7px 12px;font:700 clamp(12px,1.8vh,14px)/1.3 Nunito,system-ui,sans-serif;color:#f1ecff}
/* sections and headings */
#seHs .shs-sec{margin-top:clamp(16px,3.4vh,32px)}
#seHs .shs-sec:first-of-type{margin-top:0}
#seHs .shs-col>:first-child{margin-top:var(--shs-sqt,0px)}   /* below the pinned magnifier when the column runs under it, so every heading stays centred */
#seHs .shs-h{display:flex;align-items:center;justify-content:center;gap:.4em;font:800 clamp(15px,2.7vh,22px)/1.1 var(--sef-serif);letter-spacing:.06em;text-transform:uppercase;color:#fff;
 text-shadow:0 1px 2px rgba(0,0,0,.65),0 0 12px rgba(0,0,0,.35)}
#seHs .shs-h svg{width:1em;height:1em;flex:none;filter:drop-shadow(0 1px 1px rgba(0,0,0,.5))}
#seHs .shs-rule{position:relative;height:2px;margin:clamp(6px,1.2vh,10px) 5px clamp(10px,2vh,16px);background:rgba(232,233,230,.85);box-shadow:0 1px 2px rgba(0,0,0,.35)}
#seHs .shs-rule::before,#seHs .shs-rule::after{content:'';position:absolute;top:50%;width:7px;height:7px;background:rgba(240,241,238,.95);transform:translate(-50%,-50%) rotate(45deg)}
#seHs .shs-rule::before{left:0}
#seHs .shs-rule::after{left:100%}
#seHs .shs-bh{text-align:center;font:800 clamp(18px,3.4vh,28px)/1.15 var(--sef-serif);letter-spacing:.03em;text-transform:uppercase;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.7),0 0 14px rgba(0,0,0,.35)}
#seHs .shs-bh small{font:800 clamp(13px,2.3vh,19px)/1 Nunito,system-ui,sans-serif;text-transform:none;letter-spacing:0;color:#f8e2ab;margin-left:.55em;vertical-align:.08em}
/* the mastery track */
#seHs .shs-track{position:relative;height:clamp(34px,5.4vh,46px);margin:clamp(6px,1.4vh,12px) 0 clamp(10px,2.2vh,18px);--r:clamp(15px,2.5vh,21px)}
#seHs .shs-bar{position:absolute;left:var(--r);right:var(--r);top:50%;height:clamp(6px,.9vh,8px);transform:translateY(-50%);border-radius:99px;background:#514741;box-shadow:inset 0 0 0 1px rgba(170,165,158,.95),0 1px 3px rgba(0,0,0,.4)}
#seHs .shs-fill{position:absolute;left:0;top:0;bottom:0;border-radius:99px;background:linear-gradient(180deg,#f6dc85,#c99a33);box-shadow:inset 0 0 0 1px rgba(255,243,201,.8)}
#seHs .shs-node{position:absolute;top:50%;width:clamp(12px,2vh,18px);height:clamp(12px,2vh,18px);transform:translate(-50%,-50%);border-radius:50%;padding:0;margin:0;cursor:pointer;
 background:#514741;border:2px solid #a39f99;box-shadow:0 1px 3px rgba(0,0,0,.45)}
#seHs .shs-node::before{content:'';position:absolute;inset:-10px}
#seHs .shs-node.got{background:#f3d27c;border-color:#fff3c9}
#seHs .shs-shield{position:absolute;top:50%;width:calc(var(--r) * 2);transform:translate(-50%,-50%);filter:drop-shadow(0 2px 3px rgba(0,0,0,.5));cursor:pointer;padding:0;border:0;background:none}
#seHs .shs-shield svg{display:block;width:100%;height:auto}
#seHs .shs-pop{position:absolute;z-index:5;width:max-content;max-width:min(240px,calc(100% - 16px));box-sizing:border-box;padding:7px 10px;border-radius:8px;background:rgba(22,20,44,.95);border:1px solid rgba(255,255,255,.22);box-shadow:0 4px 12px rgba(0,0,0,.45);
 font:700 12.5px/1.35 Nunito,system-ui,sans-serif;color:#f1ecff;pointer-events:none;transform:translateX(-50%)}
#seHs .shs-pop b{color:#f8e2ab}
/* cards */
#seHs .shs-grid{display:flex;flex-wrap:wrap;gap:clamp(10px,1.2vw,18px)}
#seHs .shs-card{position:relative;flex:none;width:calc(var(--shs-ch) * .773);height:var(--shs-ch);padding:0;margin:0;border:0;cursor:pointer;display:flex;flex-direction:column;
 border-radius:var(--shs-rad);background:var(--rim);box-shadow:0 0 0 1px rgba(0,0,0,.45),0 3px 8px rgba(0,0,0,.35);color:#fff;transition:transform .12s,filter .12s,box-shadow .12s}
@media (hover:hover){#seHs .shs-card:hover{transform:translateY(-2px);filter:brightness(1.06)}}
#seHs .shs-card:active{transform:scale(.97)}
#seHs .shs-card.sel{box-shadow:0 0 0 3px #fff,0 0 16px 5px rgba(255,255,255,.55)}
#seHs .shs-ph{position:relative;flex:1 1 auto;margin:3px 3px 0;border-radius:calc(var(--shs-rad) - 2px) calc(var(--shs-rad) - 2px) 0 0;overflow:hidden;background:linear-gradient(180deg,var(--top),var(--bot))}
#seHs .shs-ph>svg.shs-fb,#seHs .shs-ph>img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
#seHs .shs-ph>img{object-position:50% 18%}   /* the card is wider than the picture: crop it from the neck, so a horn stays in */
#seHs .shs-img{opacity:0;transition:opacity .3s}
#seHs .shs-img.got{opacity:1}
#seHs .shs-lv{position:absolute;top:5%;right:6%;width:24%}
#seHs .shs-lv svg,#seHs .shs-stars svg{display:block;width:100%;height:auto}
#seHs .shs-stars{position:absolute;left:0;right:0;bottom:4%;display:flex;justify-content:center;gap:1px;filter:drop-shadow(0 1px 1px rgba(0,0,0,.5))}
#seHs .shs-stars i{display:block;width:15%}
#seHs .shs-stars.s6 i{width:13%}
#seHs .shs-ic{position:absolute;top:6%;left:0;display:flex;flex-direction:column;align-items:flex-start;gap:3px}
#seHs .shs-tag{padding:2px 6px 2px 5px;border-radius:0 4px 4px 0;font:900 clamp(10px,1.3vh,11px)/1 Nunito,system-ui,sans-serif;letter-spacing:.05em;box-shadow:0 1px 2px rgba(0,0,0,.35)}
#seHs .shs-tag.ride{background:linear-gradient(180deg,#ffe38a,#e9b52c);color:#3a2a10}
#seHs .shs-tag.foal{background:linear-gradient(180deg,#d4f0bf,#8fca70);color:#17340d}
#seHs .shs-tag.egg{background:linear-gradient(180deg,#fdf5df,#e8d6aa);color:#4a3512}
#seHs .shs-loc{margin-left:5px;width:clamp(16px,2.4vh,20px);height:clamp(16px,2.4vh,20px);border-radius:50%;background:rgba(20,18,36,.74);border:1px solid rgba(255,255,255,.6);display:flex;align-items:center;justify-content:center;box-sizing:border-box;padding:2px}
#seHs .shs-loc svg{width:100%;height:100%}
#seHs .shs-pip{position:absolute;top:-4px;left:-4px;width:12px;height:12px;border-radius:50%;background:#e43a33;box-shadow:0 0 0 2px #fff;z-index:2}
#seHs .shs-warm{position:absolute;left:10%;right:10%;bottom:21%;height:5px;border-radius:3px;background:rgba(0,0,0,.35);overflow:hidden}
#seHs .shs-warm i{display:block;height:100%;background:linear-gradient(90deg,#ffd27a,#f08a3c)}
#seHs .shs-nm{flex:0 0 19%;display:flex;align-items:center;justify-content:center;min-width:0;padding:0 6px;border-radius:0 0 calc(var(--shs-rad) - 1px) calc(var(--shs-rad) - 1px);
 background:linear-gradient(180deg,#524f8e,#423e77);font:800 clamp(12px,1.65vh,14px)/1 Nunito,system-ui,sans-serif}
#seHs .shs-nm span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#seHs .shs-nm.fit{font-size:clamp(10.5px,1.45vh,12.5px);letter-spacing:-.02em;padding:0 3px}   /* a long name a size down (fitNames), the ellipsis only as a last resort */
#seHs .shs-nm.fit2{font-size:clamp(9.5px,1.3vh,11px);letter-spacing:-.03em;padding:0 2px}
#seHs .shs-card.get{--rim:#77726f;--top:#6d6866;--bot:#3e3937}
#seHs .shs-card.get .shs-ph svg{position:absolute;left:18%;top:14%;width:64%;height:auto}
/* the drawer (a column on the right on a desktop; a sheet from the bottom on a phone) */
#seHs .shs-dr{position:absolute;top:var(--sef-top);right:0;bottom:0;width:var(--shs-dw);display:flex;flex-direction:column;box-sizing:border-box;z-index:4;
 background:linear-gradient(180deg,rgba(78,72,106,.97),rgba(50,45,74,.97));border-left:2px solid rgba(255,255,255,.18);box-shadow:-6px 0 18px rgba(0,0,0,.4);
 transform:translateX(100%);visibility:hidden;transition:transform .22s,visibility 0s .22s}
#seHs.dr .shs-dr{transform:none;visibility:visible;transition:transform .22s}
#seHs .shs-sheetdim{display:none}
#seHs .shs-dr-body{flex:1 1 auto;overflow-y:auto;scrollbar-width:thin;padding:12px 14px 8px}
#seHs .shs-dr-h{display:flex;align-items:center;gap:8px}
#seHs .shs-dr-h b{flex:1;min-width:0;font:800 clamp(15px,2.4vh,19px)/1.1 var(--sef-serif);letter-spacing:.04em;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#seHs .shs-dr-h b.fit{font-size:clamp(13.5px,2.1vh,16.5px);letter-spacing:.01em}   /* a long name a size down, then on two lines (fitDrawerName) */
#seHs .shs-dr-h b.wrap{white-space:normal;overflow-wrap:break-word;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;line-height:1.12}
#seHs .shs-mini{position:relative;width:30px!important;height:30px!important;padding:6px!important;border-width:2px!important}
#seHs .shs-mini::after{content:'';position:absolute;inset:-7px}
#seHs .shs-dr-stars{display:flex;gap:2px;margin:4px 0 8px}
#seHs .shs-dr-stars i{width:17px;display:block}
#seHs .shs-dr-stars svg{display:block;width:100%}
#seHs .shs-dr-pic{position:relative;display:block;width:clamp(120px,calc((100vh - 520px) * .8),100%);aspect-ratio:4/5;margin:0 auto 8px;border-radius:8px;overflow:hidden;border:3px solid var(--rim);background:linear-gradient(180deg,var(--top),var(--bot));
 box-shadow:0 3px 8px rgba(0,0,0,.35);cursor:pointer;box-sizing:border-box;padding:0}
#seHs .shs-dr-pic>img,#seHs .shs-dr-pic>svg.shs-fb{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
#seHs .shs-dr-pic .shs-lv{width:18%}
#seHs .shs-line{display:flex;align-items:center;flex-wrap:wrap;gap:6px;margin:5px 0;font:700 clamp(12px,1.8vh,14px)/1.3 Nunito,system-ui,sans-serif;color:#eeeaff}
#seHs .shs-line svg{width:16px;height:16px;flex:none}
#seHs .shs-line>.t{flex:1 1 0;min-width:0}   /* the words wrap beside their icon, not under it */
#seHs .shs-line .g{color:#f8e2ab}
#seHs .shs-line.warn{color:#ffc4b8}
#seHs .shs-line button{padding:4px 10px!important;font-size:12px!important}
#seHs .shs-xp{flex:1;min-width:60px;height:8px;border-radius:4px;background:rgba(0,0,0,.35);overflow:hidden}
#seHs .shs-xp i{display:block;height:100%;background:linear-gradient(90deg,#7ee07e,#3fae5a);border-radius:4px}
#seHs .shs-hearts{display:flex;gap:2px}
#seHs .shs-hearts svg{width:15px;height:15px}
#seHs .shs-acts{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:10px}
#seHs .shs-chip{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;min-height:clamp(52px,7.5vh,62px);padding:5px 2px;border-radius:8px;cursor:pointer;box-sizing:border-box;
 background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.24);color:#fff;font:800 clamp(10.5px,1.45vh,11.5px)/1.1 Nunito,system-ui,sans-serif;text-align:center;min-width:0;overflow-wrap:anywhere}
#seHs .shs-chip svg{width:22px;height:22px;flex:none}
#seHs .shs-chip.on{background:linear-gradient(180deg,var(--sef-cream),var(--sef-cream2));color:#3b2a17;border-color:#d6c298}
#seHs .shs-chip:disabled{opacity:.45;cursor:default}
#seHs .shs-dr-foot{flex:none;display:flex;gap:8px;padding:10px 14px 14px;border-top:1px solid rgba(255,255,255,.12)}
#seHs .shs-dr-foot button{flex:1;padding:10px 8px!important;font-size:clamp(12px,1.9vh,15px)!important;white-space:nowrap}
/* the foot */
#seHs .shs-foot{position:absolute;left:0;right:0;bottom:0;height:var(--shs-foot);display:flex;align-items:center;gap:10px;padding:0 clamp(12px,2vw,24px);box-sizing:border-box;
 background:linear-gradient(0deg,rgba(20,18,36,.9),rgba(20,18,36,.6));border-top:1px solid rgba(255,255,255,.12);transition:right .22s}
#seHs .shs-sum{display:block;flex:1 1 auto;min-width:0;font:700 clamp(11.5px,1.8vh,14px)/1.2 Nunito,system-ui,sans-serif;color:#e9e4ff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#seHs .shs-sum svg{width:16px;height:16px;vertical-align:-3px;margin-right:4px}
#seHs .shs-sum>.s,#seHs.sums .shs-sum>.l{display:none}
#seHs.sums .shs-sum>.s{display:inline}   /* the short form when the long one would be cut (fitTight) */
#seHs .shs-foot button{flex:none;display:flex;align-items:center;gap:6px;padding:8px 13px!important;font-size:clamp(11.5px,1.8vh,14px)!important;white-space:nowrap}
#seHs .shs-foot button svg{width:16px;height:16px;flex:none}
#seHs .shs-foot .more{display:none}
#seHs .shs-foot .shs-hero{min-width:0}
#seHs .shs-foot .shs-hero span{overflow:hidden;text-overflow:ellipsis}
#seHs.tight .shs-foot .opt,#seHs.tight .shs-sum{display:none}
#seHs.tight .shs-foot .more{display:flex}
#seHs.tight .shs-foot .shs-hero{flex:0 1 auto;min-width:0;justify-content:center;margin-left:auto}
/* modals (Pets, More, how to get a breed) */
#seHs .shs-mdim{position:absolute;inset:0;z-index:6;background:rgba(8,8,16,.5);display:none}
#seHs .shs-modal{position:absolute;left:50%;top:50%;z-index:7;transform:translate(-50%,-50%);width:min(400px,92vw);max-height:80vh;overflow-y:auto;display:none;box-sizing:border-box;padding:14px 16px 16px;border-radius:12px;
 background:linear-gradient(180deg,rgba(78,72,106,.98),rgba(50,45,74,.98));border:2px solid rgba(255,255,255,.2);box-shadow:0 10px 30px rgba(0,0,0,.5)}
#seHs.m .shs-mdim,#seHs.m .shs-modal{display:block}
#seHs .shs-modal h3{margin:0 40px 10px 0;font:800 clamp(15px,2.4vh,19px)/1.15 var(--sef-serif);letter-spacing:.04em;text-transform:uppercase}
#seHs .shs-modal .x{position:absolute;top:10px;right:10px}
#seHs .shs-modal p{margin:0 0 12px;font:700 14px/1.4 Nunito,system-ui,sans-serif;color:#eeeaff}
#seHs .shs-mrow{display:flex;align-items:center;gap:10px;padding:8px 0;border-top:1px solid rgba(255,255,255,.12);font:700 14px/1.3 Nunito,system-ui,sans-serif;color:#eeeaff}
#seHs .shs-mrow svg{width:20px;height:20px;flex:none}
#seHs .shs-mrow .sp{flex:1}
#seHs .shs-mrow small{display:block;font:700 12.5px/1.3 Nunito,system-ui,sans-serif;color:#d8d2ee}
#seHs .shs-mrow button{padding:7px 12px!important;font-size:13px!important}
#seHs .shs-pet{width:30px;height:30px;flex:none;display:flex;align-items:center;justify-content:center;border-radius:50%;background:rgba(255,255,255,.1);overflow:hidden}
#seHs .shs-pet svg{width:100%;height:100%}
#seHs .shs-mact{display:flex;gap:8px;justify-content:flex-end;margin-top:4px}
/* toasts sit above the foot while this screen is up, and at the top while a phone's sheet is open */
html body.se-screen-open.shs-open #toasts{top:auto!important;bottom:calc(clamp(46px,7vh,58px) + 12px + env(safe-area-inset-bottom))!important}
html body.se-screen-open.shs-open.shs-sheet #toasts,html body.se-screen-open.shs-open.shs-msheet #toasts{top:calc(var(--sef-top) + 8px)!important;bottom:auto!important}
@media (min-width:761px){html body.se-screen-open.shs-open.shs-msheet #toasts{top:calc(4px + env(safe-area-inset-top))!important}}   /* a short landscape screen: a modal fills the middle, so a toast covers the strip for a moment instead of a button */
html body.se-screen-open.shs-open.shs-drw #toasts{left:calc((100vw - clamp(260px,24vw,330px)) / 2)!important;right:auto!important;transform:translateX(-50%)!important}   /* over the list, not the drawer */
@media (prefers-reduced-motion:reduce){#seHs,#seHs *{transition:none!important}}
/* ---------------- landscape phone: a wider panel, the picture beside the facts and the stars left to the
   selected card, so the first row of tiles is in view without scrolling ---------------- */
@media (min-width:761px) and (max-height:520px){
 #seHs{--shs-dw:clamp(260px,38vw,340px)}
 #seHs .shs-dr-body{padding-top:8px}
 #seHs .shs-dr-stars{display:none}
 #seHs .shs-dr-top{display:grid;grid-template-columns:30% 1fr;gap:10px;align-items:start;margin-top:6px}
 #seHs .shs-dr-pic{width:100%;margin:0}
 #seHs .shs-line{margin:3px 0}
 #seHs .shs-acts{margin-top:8px}
 #seHs .shs-chip{min-height:48px}
 html body.se-screen-open.shs-open.shs-drw #toasts{left:calc((100vw - clamp(260px,38vw,340px)) / 2)!important}
}
/* ---------------- phone ---------------- */
@media (max-width:760px){
 #seHs .se-strip .se-ttl>svg{display:none}
 #seHs .se-strip .se-ttl b{font-size:19px}
 #seHs.tt .se-strip .se-ttl b{font-size:16px}
 #seHs.tt2 .se-strip .se-ttl b{font-size:14px}
 #seHs.tt3 .se-strip .se-ttl>span{display:none}
 #seHs.tt3 .se-strip .se-ttl>svg{display:block}   /* a very big purse: the barn alone, never "My …" */
 #seHs .shs-bar2{top:var(--sef-top);left:0;right:0;height:54px;padding:0 12px;box-sizing:border-box;background:linear-gradient(180deg,rgba(20,18,36,.55),rgba(20,18,36,0))}
 #seHs.dr .shs-bar2{right:0}
 #seHs .shs-cnt{display:flex;align-items:center;gap:6px;background:rgba(22,20,44,.82);border-radius:14px;padding:6px 12px;font:800 13px/1 Nunito,system-ui,sans-serif;color:#f1ecff;white-space:nowrap}
 #seHs .shs-cnt svg{width:15px;height:15px}
 #seHs.q .shs-cnt{display:none}
 #seHs.q .shs-q{flex:1;width:auto}
 #seHs.q .shs-bar2 .sp{display:none}
 #seHs .shs-bar2 .se-circ{width:40px!important;height:40px!important}
 #seHs .shs-main{top:calc(var(--sef-top) + 54px);bottom:calc(var(--shs-foot) + env(safe-area-inset-bottom))}
 #seHs .shs-col{width:calc(100% - 24px)}
 #seHs .shs-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
 #seHs .shs-card{width:auto;height:auto;aspect-ratio:.773}
 #seHs .shs-nm{font-size:13px}
 #seHs .shs-track{--r:17px}
 #seHs .shs-bh{font-size:20px}
 #seHs .shs-bh small{display:block;margin:4px 0 0;font-size:14px}
 #seHs.dr .shs-main,#seHs.dr .shs-foot{right:0}
 #seHs .shs-dr{top:auto;left:0;width:auto;max-height:84vh;border-left:0;border-top:2px solid rgba(255,255,255,.22);border-radius:14px 14px 0 0;transform:translateY(100%);box-shadow:0 -6px 18px rgba(0,0,0,.45);z-index:5}
 #seHs.dr .shs-dr{transform:none}
 #seHs .shs-dr-foot{padding-bottom:calc(14px + env(safe-area-inset-bottom))}
 #seHs .shs-dr-foot button,#seHs .shs-foot button{min-height:44px!important}
 #seHs .shs-sheetdim{position:absolute;inset:0;background:rgba(8,8,16,.45);z-index:4;display:none}
 #seHs.dr .shs-sheetdim{display:block}
 #seHs .shs-dr-top{display:grid;grid-template-columns:38% 1fr;gap:12px;align-items:start}
 #seHs .shs-dr-pic{width:100%;margin:0}
 #seHs .shs-chip{min-height:56px}
 #seHs .shs-foot{height:calc(var(--shs-foot) + env(safe-area-inset-bottom));padding-bottom:env(safe-area-inset-bottom)}
 #seHs.tight .shs-foot .shs-hero{flex:1 1 auto;margin-left:0}
 #seHs .shs-modal{left:0;right:0;top:auto;bottom:0;transform:none;width:auto;border-radius:14px 14px 0 0;max-height:84vh;padding-bottom:calc(16px + env(safe-area-inset-bottom))}
}`;document.head.appendChild(css);}

 /* ---------------------------------------------------------------- the screen ------------ */
 const root=document.createElement('div'); root.id='seHs'; root.setAttribute('role','dialog'); root.setAttribute('aria-label','My Horses');
 root.innerHTML='<div class="shs-dim"></div>'
  +'<div class="shs-bar2"><span class="shs-cnt" id="shsCnt"></span><span class="shs-cnt" id="shsOut"></span><span class="sp"></span>'
  +'<input class="shs-q" id="shsQ" type="search" placeholder="Search your horses" aria-label="Search your horses" autocomplete="off" spellcheck="false">'
  +'<button class="se-circ shs-sbtn" data-shs="search" title="Search" aria-label="Search">'+K.line('search','#fff',2.4)+'</button></div>'
  +'<div class="shs-main" id="shsMain"><div class="shs-col" id="shsCol"></div></div>'
  +'<div class="shs-sheetdim" data-shs="drclose"></div>'
  +'<aside class="shs-dr" id="shsDr" aria-label="Horse"></aside>'
  +'<div class="shs-foot" id="shsFoot"></div>'
  +'<div class="shs-mdim" data-shs="mclose"></div><div class="shs-modal" id="shsModal" role="dialog" aria-modal="true"></div>';
 document.body.insertBefore(root,P());   // before the panel: a real pointer click on [data-st="hero"] takes the first one in the page, and that is ours
 const strip=K.bar({icon:'horses',title:'My Horses',back:()=>back(),close:()=>closeAll()});
 root.insertBefore(strip,root.children[1]);
 const main=$('shsMain'), col=$('shsCol'), qIn=$('shsQ');
 const st={on:false,sel:null,drawer:false,q:'',modal:null,pop:null,away:null,pendingSel:null,leftScroll:0,restore:false,lastOutline:null,sig:'',drHtml:'',footHtml:'',rr:0};

 /* ---------------------------------------------------------------- portraits -------------
    Each card's head is the horse itself: built with the game's own makeHorse + dressWithRig in a scene
    of our own, framed on its head and neck bones, rendered in a tick into a 240x300 corner of the game
    canvas and copied off before the frame's own render covers it. One at a time, one every 250 ms,
    only for the selected horse and the cards within 200 px of view; kept in memory by a key of
    everything that changes the look, so a new coat or a dye gives a new picture. */
 const PORT={cache:new Map(),fail:new Set(),job:null,last:0,gap:250,slow:0,paused:false,prio:null,vis:new Set(),done:0,ms:[],log:[]};
 const lookKey=h=>h.id+':'+hash(JSON.stringify([h.breed,h.colors||null,h.coat||null,h.variant||null,h.mark==null?null:h.mark,h.markCol||null,h.mark2||null,
  h.tailCol||null,!!h.horn,!!h.wings,!!h.dragon,!!h.foal,h.hair||null,h.acc||null,h.fx||null,!!h.painted,h.glow||null]));
 let PS=null;
 function studio(){ if(PS)return PS; const THREE=G.THREE, scene=new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff,0x9a8a70,2.1));
  const key=new THREE.DirectionalLight(0xfff4e0,2.2), fill=new THREE.DirectionalLight(0xe8f0ff,1.3);   // a key from above and in front, a fill from the camera: dark coats still read
  scene.add(key,key.target,fill,fill.target);
  return PS={scene,key,fill,cam:new THREE.PerspectiveCamera(22,0.8,0.05,60),bg:{},v:new THREE.Vector3(),n:new THREE.Vector3()}; }
 function bgTex(n){ const THREE=G.THREE; if(PS.bg[n])return PS.bg[n];
  const r=rampOf(n), c=document.createElement('canvas'); c.width=240; c.height=300;
  const x=c.getContext('2d'), g=x.createLinearGradient(0,0,0,300); g.addColorStop(0,r[0]); g.addColorStop(1,r[1]); x.fillStyle=g; x.fillRect(0,0,240,300);
  const f=x.createLinearGradient(0,0,0,160); f.addColorStop(0,'rgba(255,255,255,.24)'); f.addColorStop(1,'rgba(255,255,255,0)');
  x.strokeStyle=f; x.lineWidth=1.2; x.beginPath();
  for(let k=-120;k<=360;k+=18){x.moveTo(k,0);x.lineTo(k+96,160);x.moveTo(k,0);x.lineTo(k-96,160);}   // a diamond lattice of our own, fading down
  x.stroke();
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; return PS.bg[n]=t; }   // an sRGB background is not tone-mapped: the card colour stays true
 function portraitsOff(){ return PORT.paused||!G.THREE||!G.renderer||!G.horse.makeHorse||!G.horse.dressWithRig||(G.gfx&&G.gfx.get&&G.gfx.get()==='low')||!!(G.renderer&&G.renderer.xr&&G.renderer.xr.isPresenting); }
 function nextWanted(){ const s=S(), order=[];
  if(PORT.prio!=null)order.push(PORT.prio);
  root.querySelectorAll('.shs-card[data-hid]').forEach(c=>{if(!PORT.vis.has(c))return;const h=(s.horses||[]).find(x=>String(x.id)===c.dataset.hid);if(h&&!order.includes(h.id))order.push(h.id);});
  for(const id of order){const h=(s.horses||[]).find(x=>x.id===id);if(!h||isEgg(h))continue;const k=lookKey(h);if(!PORT.cache.has(k)&&!PORT.fail.has(k))return {h,k};}
  return null; }
 async function pump(){
  if(!st.on||PORT.job||document.hidden||portraitsOff())return;
  let ready=false; try{ready=!!(G.horse.RIG&&G.horse.RIG().ready);}catch(e){}
  if(!ready){setTimeout(pump,500);return;}
  const w=nextWanted(); if(!w)return;
  const job=PORT.job={h:w.h,k:w.k,stage:'build',t0:performance.now()}; const ps=studio(), h=w.h;
  try{
   const parts=G.horse.makeHorse({colors:h.colors,horn:h.horn,wings:h.wings,dragon:h.dragon,coat:h.coat,tack:null,seed:h.id,breed:h.breed});
   ps.scene.add(parts.group);                                   // before dressWithRig: its async path dresses only a group that has a parent
   const ent={parts}; job.ent=ent;
   G.horse.dressWithRig(ent,parts,h.colors,{breed:h.breed,mine:true,foal:h.foal,coat:h.coat,dragon:h.dragon,tailCol:h.tailCol,mark:h.mark,markCol:h.markCol,mark2:h.mark2,seed:h.id});
   job.tb=performance.now();
   for(let t=0;!ent.rig&&ent.rigPending&&t<8000;t+=50)await new Promise(r=>setTimeout(r,50));   // a breed's model may still be loading
   if(job.dead){finish(job);return;}                            // the screen closed meanwhile (put away here, never under a compile)
   job.tr=performance.now();
   try{if(ent.rig&&G.mastery&&G.mastery.applyLook)G.mastery.applyLook(ent.rig,parts.group,h);}catch(e){}   // mane styles and accessories
   ps.scene.background=bgTex(starsOf(h));
   frameShot(job);
   if(G.renderer.compileAsync){try{await G.renderer.compileAsync(ps.scene,ps.cam);}catch(e){}}   // compile the shaders off the tick, so the shot itself stays short
   if(job.dead){finish(job);return;}
   job.tc=performance.now(); job.stage='ready';                 // the tick takes it from here
  }catch(e){ if(!job.dead)PORT.fail.add(job.k); finish(job); if(st.on)setTimeout(pump,0); }
 }
 function frameShot(job){ const ps=PS, THREE=G.THREE, parts=job.ent.parts, ent=job.ent; ps.scene.updateMatrixWorld(true);
  let head=null,neck=null;
  if(ent.rig){const B=ent.rig.bones||[];const hb=B.find(b=>b.name==='head'),nb=B.find(b=>b.name==='neckupper');
   if(hb){hb.getWorldPosition(ps.v);head=ps.v.clone();} if(nb){nb.getWorldPosition(ps.n);neck=ps.n.clone();}}
  if(!head||!neck){const bx=new THREE.Box3().setFromObject(parts.group);head=new THREE.Vector3(0,bx.max.y-0.3,bx.max.z-0.3);neck=head.clone().add(new THREE.Vector3(0,-0.25,-0.25));}
  const k=Math.max(0.2,head.distanceTo(neck)/0.36);            // about 0.86-1.06 for a grown horse, 0.38 for a foal: foals and ponies framed the same way
  const horn=!!job.h.horn, at=head.clone().lerp(neck,0.55); at.y+=(horn?0.08:-0.02)*k;   // a horned head sits lower, a touch further off: the horn's tip clear of the top edge and the level crest
  const fwd=head.clone().sub(neck).setY(0); if(fwd.lengthSq()<1e-6)fwd.set(0,0,1); fwd.normalize();
  const left=new THREE.Vector3(fwd.z,0,-fwd.x), dist=3.5*k*(horn?1.08:1);
  ps.cam.position.copy(at).addScaledVector(fwd,dist*0.5).addScaledVector(left,dist*0.86); ps.cam.position.y+=0.3*k;   // the face turned to the left, the mane behind
  ps.cam.lookAt(at);
  ps.key.position.copy(at).add(new THREE.Vector3(3,4,4)); ps.key.target.position.copy(at);
  ps.fill.position.copy(ps.cam.position); ps.fill.target.position.copy(at); }
 G.on('tick',()=>{ const job=PORT.job; if(!job||job.stage!=='ready'||!st.on||document.hidden)return;
  const now=performance.now(); if(now-PORT.last<PORT.gap)return; PORT.last=now; job.stage='shot';
  const THREE=G.THREE, r=G.renderer, cv=r.domElement, dpr=r.getPixelRatio();
  let W=Math.min(240,Math.floor(cv.width/dpr)), H=Math.min(300,Math.floor(cv.height/dpr)); if(H<W*1.25)W=Math.floor(H/1.25); else H=Math.round(W*1.25);
  const vp=new THREE.Vector4(), sc=new THREE.Vector4(); r.getViewport(vp); r.getScissor(sc); const scT=r.getScissorTest(), ac=r.autoClear, rt=r.getRenderTarget();
  const out=document.createElement('canvas'); out.width=240; out.height=300; const t0=performance.now();
  try{
   r.setRenderTarget(null); r.setViewport(0,0,W,H); r.setScissor(0,0,W,H); r.setScissorTest(true); r.autoClear=true;   // only a small corner is drawn, not the whole canvas
   PS.cam.aspect=W/H; PS.cam.updateProjectionMatrix();
   r.render(PS.scene,PS.cam);
   out.getContext('2d').drawImage(cv,0,cv.height-H*dpr,W*dpr,H*dpr,0,0,240,300);   // the GL origin is bottom-left; the frame's own render follows in this animation frame and covers the corner
  }catch(e){PORT.fail.add(job.k);}
  finally{ r.setViewport(vp); r.setScissor(sc); r.setScissorTest(scT); r.autoClear=ac; r.setRenderTarget(rt); }
  const ms=performance.now()-t0; PORT.ms.push(Math.round(ms)); if(PORT.ms.length>40)PORT.ms.shift();
  /* the next shot waits longer after a slow one. The frame watchdog steps the graphics down after two
     2-second stretches in a row averaging over 45 ms a frame, and skips frames over half a second; spacing
     slow shots out to nine times their length (the slowest counted, about 460 ms, to one every four
     seconds) keeps the pictures from tipping it over on their own. A quick shot (the usual case) keeps
     the 250 ms pace. */
  PORT.gap=ms<100?250:ms<520?Math.min(4200,Math.round(ms*9)):400;
  PORT.log.push([Math.round(job.tb-job.t0),Math.round(job.tr-job.tb),Math.round(job.tc-job.tr),Math.round(t0-job.tc),Math.round(ms)]); if(PORT.log.length>12)PORT.log.shift();   // build, model wait, compile, wait for the tick, shot
  PORT.slow=ms>600?PORT.slow+1:0; if(PORT.slow>=3&&!PORT.paused){PORT.paused=true;console.info('se-horses: portraits paused (slow machine)');}
  const done=url=>{ if(url){PORT.cache.set(job.k,url);PORT.done++;trim();paintPic(job.k,url);} finish(job); setTimeout(pump,0); };
  if(PORT.fail.has(job.k)){done(null);return;}
  setTimeout(()=>{   // encoded straight after the frame, not by toBlob: that waits for the browser to be idle, which a running game seldom is (a second or more a picture)
   let url=null; try{const d=out.toDataURL('image/jpeg',0.86), b=atob(d.slice(d.indexOf(',')+1)), a=new Uint8Array(b.length); for(let i=0;i<b.length;i++)a[i]=b.charCodeAt(i); url=URL.createObjectURL(new Blob([a],{type:'image/jpeg'}));}catch(e){}
   done(url); },0);
 });
 function finish(job){ try{if(PS&&job.ent)PS.scene.remove(job.ent.parts.group);}catch(e){} try{if(job.ent&&G.ranchSys&&G.ranchSys.disposeHorseEnt)G.ranchSys.disposeHorseEnt(job.ent);}catch(e){} if(PORT.job===job)PORT.job=null; }
    // disposeHorseEnt hands back the world rig budget dressWithRig took and frees the rig; its scene.remove on the game scene does nothing to ours
 function paintPic(k,url){ root.querySelectorAll('img.shs-img').forEach(im=>{if(im.dataset.key!==k)return;if(im.getAttribute('src')!==url)im.src=url;im.classList.add('got');}); }
 function trim(){ while(PORT.cache.size>150){const [k,u]=PORT.cache.entries().next().value;PORT.cache.delete(k);try{URL.revokeObjectURL(u);}catch(e){}} }
 const io=('IntersectionObserver' in window)?new IntersectionObserver(ents=>{for(const e of ents){if(e.isIntersecting)PORT.vis.add(e.target);else PORT.vis.delete(e.target);}pump();},{root:main,rootMargin:'200px 0px'}):null;
 function observeCards(){ if(!io)return; io.disconnect(); PORT.vis.clear(); root.querySelectorAll('.shs-card[data-hid]').forEach(c=>io.observe(c)); }

 /* ---------------------------------------------------------------- what the panel says ------ */
 function pasture(s,ri){
  const p=P(), t=nx((p&&p.textContent)||'');
  let m=/(\d+) of (\d+)\s*out in the pasture/.exec(t);
  const out=m?+m[1]:(s.horses||[]).filter(h=>h.out).length, max=m?m[2]:'?';
  m=/(\d+) in the barn/.exec(t);
  const barn=m?+m[1]:(s.horses||[]).filter((h,i)=>!h.out&&!h.hitch&&i!==ri).length;
  let head='';
  if(p){const d=[...p.querySelectorAll('div')].filter(e=>/\d+ in the barn/.test(e.textContent)&&!e.querySelector('.evrow')&&!e.closest('.evrow')).sort((a,b)=>a.textContent.length-b.textContent.length)[0];
   if(d)head=nx(d.textContent).replace(/\s+/g,' ').trim();}
  return {out,max,barn,head};
 }
 function coatInfo(){
  const p=P(); if(!p)return null; const bs=[...p.querySelectorAll('[data-fx^="sq:coat:"]')]; if(!bs.length)return null;
  const row=bs[0].closest('.evrow')||bs[0].parentElement, b=row&&row.querySelector('b');
  const sp=row?[...row.querySelectorAll(':scope>span')].find(x=>!x.querySelector('button')&&nx(x.textContent).trim()):null;   // the row's own line, not the hidden span no-emoji wraps round its paintbrush
  let line=sp?nx(sp.textContent).trim():''; if(line&&!/[.:!?]$/.test(line))line+=':';   // "… comes in three:" leads into the buttons
  return {title:nx(b?b.textContent:'Choose a coat').trim(),line,
   btns:bs.map(x=>{const sw=x.querySelector('span');return {id:x.dataset.fx.slice(8),label:nx(x.textContent).trim(),bg:sw?safeCol(sw.style.backgroundColor||sw.style.background):'',bd:sw?safeCol(sw.style.borderColor):''};})};
 }
 function noteText(){ const p=P(), n=p&&p.querySelector(':scope>[role="status"],:scope>.mk-panel-body>[role="status"]'); return n?nx(n.textContent).trim():''; }
 function heroLabel(){ const p=P(), b=p&&p.querySelector('[data-st="hero"]'); return b?nx(b.textContent).replace(/\s+/g,' ').trim():''; }
 function studioHref(){ const p=P(), a=p&&p.querySelector('a[href*="breeds.html"]'); return (a&&a.getAttribute('href'))||'breeds.html?v=artist-study-1'; }

 /* ---------------------------------------------------------------- the list --------------- */
 function locOf(h,i,s,ri){
  if(i===ri||isEgg(h))return null;
  if(s.companion===h.id)return ['follow','Following you'];
  if(h.hitch)return ['hitch','Hitched at a post'];
  if(h.out)return ['leaf','Out in the pasture'];
  return ['horses','In the barn'];
 }
 function card(h,i,s,ri){
  const n=starsOf(h), r=rampOf(n), egg=isEgg(h), foal=isFoal(h), ride=i===ri, low=!egg&&lowNeeds(h), lv=h.level||1, nm=nx(h.name).trim()||'Horse';
  const k=lookKey(h), url=egg?null:PORT.cache.get(k), loc=locOf(h,i,s,ri);
  const tag=ride?'<span class="shs-tag ride">RIDING</span>':egg?'<span class="shs-tag egg">EGG</span>':foal?'<span class="shs-tag foal">FOAL</span>':'';
  return '<button class="shs-card'+(h.id===st.sel?' sel':'')+'" data-hid="'+esc(h.id)+'" style="--rim:'+r[2]+';--top:'+r[0]+';--bot:'+r[1]+'" aria-label="'+esc(nm+', level '+lv+', '+n+' stars'+(ride?', riding':'')+(egg?', egg':foal?', foal':'')+(low?', needs care':''))+'">'
   +(low?'<i class="shs-pip" title="Needs care"></i>':'')
   +'<span class="shs-ph">'+(egg?EGG(h):BUST(h)+'<img class="shs-img'+(url?' got':'')+'" data-key="'+esc(k)+'" alt=""'+(url?' src="'+url+'"':'')+'><span class="shs-lv">'+LV(lv)+'</span>')
   +'<span class="shs-ic">'+tag+(loc?'<span class="shs-loc" title="'+loc[1]+'">'+ic(loc[0],'#fff',2.2)+'</span>':'')+'</span>'
   +(egg?'<span class="shs-warm"><i style="width:'+Math.round(100*clamp((h.eggWarm||0)/EGGW(),0,1))+'%"></i></span>':'')
   +'<span class="shs-stars'+(n>5?' s6':'')+'">'+('<i>'+STAR+'</i>').repeat(n)+'</span></span>'
   +'<span class="shs-nm"><span>'+esc(nm)+'</span></span></button>';
 }
 function track(b,M,N,L){
  const pos=k=>'calc(var(--r) + (100% - var(--r) * 2) * '+(N>1?(k-1)/(N-1):0).toFixed(4)+')';
  let o='<div class="shs-track"><div class="shs-bar"><i class="shs-fill" style="width:'+(N>1?(M-1)/(N-1)*100:0).toFixed(2)+'%"></i></div>';
  for(let k=1;k<=N;k++)if(k!==M)o+='<button class="shs-node'+(k<M?' got':'')+'" style="left:'+pos(k)+'" data-shs="node:'+esc(b)+':'+k+'" aria-label="'+esc('Mastery '+k+': '+rung(L,k))+'"></button>';
  return o+'<button class="shs-shield" style="left:'+pos(M)+'" data-shs="node:'+esc(b)+':'+M+'" data-m="'+M+'" aria-label="'+esc('Mastery '+M+' of '+N)+'">'+SHIELD(M)+'</button></div>';
 }
 function listHtml(s,ri){
  const H=s.horses||[], q=st.q.trim().toLowerCase();
  const hit=h=>!q||(nx(h.name)+' '+label(h.breed)+' '+variantOf(h)).toLowerCase().includes(q);
  let o='';
  const coat=coatInfo(), note=noteText();
  if(coat)o+='<div class="shs-coat"><b>'+esc(coat.title)+'</b>'+(coat.line?'<span>'+esc(coat.line)+'</span>':'')+'<span class="sp"></span>'
   +coat.btns.map(c=>'<button class="se-cream" data-shs="coat:'+esc(c.id)+'"><i style="background:'+esc(c.bg||'#8a5a2b')+';border-color:'+esc(c.bd||'#fff')+'"></i>'+esc(c.label)+'</button>').join('')+'</div>';
  if(note)o+='<div class="shs-note" aria-live="polite">'+K.line('info','#f1ecff',2.2)+'<span>'+esc(note)+'</span></div>';
  if(!q){const fav=H.map((h,i)=>[h,i]).filter(x=>x[0].fav);
   o+='<section class="shs-sec fav"><div class="shs-h">'+HEART_F('#fff')+'<span>Favourites</span></div><div class="shs-rule"></div>'
    +(fav.length?'<div class="shs-grid">'+fav.map(x=>card(x[0],x[1],s,ri)).join('')+'</div>':'<p class="shs-hint">Tap a horse, then the heart, to keep it up here.</p>')+'</section>';}
  const order=[]; for(const h of H)if(!order.includes(h.breed))order.push(h.breed);
  let any=false;
  for(const b of order){
   const L=H.map((h,i)=>[h,i]).filter(x=>x[0].breed===b&&hit(x[0])); if(q&&!L.length)continue; any=any||L.length>0;
   const N=maxOf(b), M=masteryM(s,b);
   o+='<section class="shs-sec" data-breed="'+esc(b)+'"><div class="shs-bh">'+esc(label(b))+'<small>(Mastery '+M+')</small></div>'+track(b,M,N,ladder(b))
    +'<div class="shs-grid">'+L.map(x=>card(x[0],x[1],s,ri)).join('')
    +(q?'':'<button class="shs-card get" data-shs="get:'+esc(b)+'" aria-label="'+esc('Get another '+label(b))+'"><span class="shs-ph">'+GET_ICON+'</span><span class="shs-nm"><span>Get Horse</span></span></button>')+'</div></section>';
  }
  if(q&&!any)o+='<p class="shs-hint">No horse matches “'+esc(st.q.trim())+'”.</p>';
  return o;
 }

 /* ---------------------------------------------------------------- paint ----------------- */
 function paint(){
  if(!st.on)return;
  /* A horse that arrives (or leaves) while this is open does not re-render the old list underneath, and its
     row buttons are what the tiles forward to: when the rows and the horses disagree, the list is drawn
     again, once. That settles it, so it cannot loop. */
  {const p=P(), n0=(S().horses||[]).length; if(p&&K.isOpen(p)&&p.querySelectorAll('[data-st^="rn:"]').length!==n0&&Date.now()-st.rr>400){st.rr=Date.now();try{G.ui.renderStable();}catch(e){}}}
  const s=S(), H=s.horses||[], n=H.length, ri=G.horse.rideIdx(), phone=innerWidth<=760, pas=pasture(s,ri);
  strip.setTitle(phone?'My Horses':'My Horses ('+n+' total)',''); strip.paint();
  fitTitle();
  const cnt=K.line('horses','#f1ecff',2.2)+n+(n===1?' horse':' horses'), out=ic('leaf','#f1ecff',2.2)+pas.out+' of '+pas.max+' out';
  if($('shsCnt').dataset.h!==cnt){$('shsCnt').dataset.h=cnt;$('shsCnt').innerHTML=cnt;}
  if($('shsOut').dataset.h!==out){$('shsOut').dataset.h=out;$('shsOut').innerHTML=out;}
  const coat=coatInfo();
  const sig=JSON.stringify([phone,st.q,ri,s.companion||null,s.whistleHorse||null,coat,noteText(),H.map(h=>[h.id,h.name,h.breed,h.level||1,h.xp||0,!!h.fav,!!h.out,h.hitch||null,!!h.foal,!!h.egg,h.eggWarm||0,h.bond||0,lookKey(h),lowNeeds(h),starsOf(h)]),
   [...new Set(H.map(h=>h.breed))].map(b=>masteryM(s,b))]);
  if(sig!==st.sig){ st.sig=sig; const top=main.scrollTop; hidePop(); col.innerHTML=listHtml(s,ri); fitNames(); main.scrollTop=top; observeCards(); }
  paintFoot(s,pas);
  if(st.drawer)paintDrawer();
  markSel(); fitTight(); pump();
 }
 /* the magnifier is pinned at the top right; when the column runs under it (the drawer open, a narrow
    window, the search box out) the list starts below it, so every heading and track keeps its width */
 function clearSearch(){ if(!st.on)return; let dy=0;
  if(innerWidth>760&&col.firstElementChild){const sb=root.querySelector('.shs-bar2').getBoundingClientRect(),cr=col.getBoundingClientRect();
   if(cr.right>sb.left-10){const top=main.getBoundingClientRect().top+(parseFloat(getComputedStyle(main).paddingTop)||0);dy=Math.max(0,Math.ceil(sb.bottom+8-top));}}
  const v=dy+'px'; if(col.style.getPropertyValue('--shs-sqt')!==v)col.style.setProperty('--shs-sqt',v); }
 let csT=0; function clearSoon(){ clearSearch(); clearTimeout(csT); csT=setTimeout(clearSearch,260); }   // again once the drawer's slide has finished
 function fitTitle(){   // a big purse on a phone: the title a size down, then another, then the barn alone; never an ellipsis
  const tb=strip.querySelector('.se-ttl-b'); root.classList.remove('tt','tt2','tt3'); if(innerWidth>760||!tb)return;
  for(const c of ['tt','tt2','tt3']){if(tb.scrollWidth<=tb.clientWidth+1)break;root.classList.add(c);} }
 /* a name too long for its plate goes a size down, then another; the ellipsis is the last resort. All the
    reads first, then the writes, so it costs two layouts however many cards there are. */
 function fitNames(){ const nm=[...col.querySelectorAll('.shs-nm')]; nm.forEach(n=>n.classList.remove('fit','fit2'));
  const over=n=>{const x=n.firstElementChild;return !!x&&x.scrollWidth>x.clientWidth+1;};
  const a=nm.filter(over); a.forEach(n=>n.classList.add('fit')); a.filter(over).forEach(n=>n.classList.add('fit2')); }
 function fitDrawerName(){ const b=$('shsDr').querySelector('.shs-dr-h b'); if(!b)return; b.classList.remove('fit','wrap');
  if(b.scrollWidth>b.clientWidth+1){b.classList.add('fit');if(b.scrollWidth>b.clientWidth+1)b.classList.add('wrap');} }   // a size down, then two lines
 function markSel(){ root.querySelectorAll('.shs-card[data-hid]').forEach(c=>c.classList.toggle('sel',st.sel!=null&&c.dataset.hid===String(st.sel))); }
 /* the foot: the long summary if it fits beside the buttons, else the short one, else the tight foot (the gold
    button and More). Measured against the foot's final width, so the drawer's slide does not fool it. */
 function fitTight(){ const w=innerWidth, dw=st.drawer&&w>760?($('shsDr').offsetWidth||Math.min(330,Math.max(260,w*0.24))):0;
  let t=w<=760||(w-dw)<900, sh=false; const f=$('shsFoot'), sm=f&&f.querySelector('.shs-sum');
  if(!t&&st.on&&sm&&sm.querySelector('.l')){ root.classList.remove('tight','sums');
   const cs=getComputedStyle(f), gap=parseFloat(cs.columnGap)||10; let used=(parseFloat(cs.paddingLeft)||0)+(parseFloat(cs.paddingRight)||0);
   for(const e of f.children)if(e!==sm&&e.getClientRects().length)used+=e.getBoundingClientRect().width+gap;
   const room=w-dw-used;
   if(sm.querySelector('.l').getBoundingClientRect().width>room){ root.classList.add('sums'); sh=true; if(sm.querySelector('.s').getBoundingClientRect().width>room)t=true; } }
  root.classList.toggle('tight',t); root.classList.toggle('sums',sh&&!t); clearSoon(); }
 function paintFoot(s,pas){
  const hero=heroLabel();
  const lf=ic('leaf','#cfe9b3',2.2), bn=K.line('horses','#e9e4ff',2.2);
  const html='<span class="shs-sum" title="'+esc(pas.head)+'"><span class="l">'+lf+pas.out+' of '+pas.max+' out in the pasture · '+bn+pas.barn+' in the barn</span>'
   +'<span class="s">'+lf+pas.out+' of '+pas.max+' out · '+bn+pas.barn+' in the barn</span></span>'
   +'<button class="se-cream opt" data-shs="pets">'+K.line('paw','#3b2a17',2.2)+'<span>Pets</span></button>'
   +'<button class="se-cream opt" data-shs="classic">'+K.line('list','#3b2a17',2.2)+'<span>Full list</span></button>'
   +'<button class="se-cream opt" data-shs="studio">'+K.line('studio','#3b2a17',2.2)+'<span>Breed Studio</span></button>'
   +'<button class="se-gold shs-hero" data-st="hero" title="'+esc(hero)+'"'+(hero?'':' style="display:none"')+'><span>'+esc(hero)+'</span></button>'
   +'<button class="se-cream more" data-shs="more">'+K.line('list','#3b2a17',2.2)+'<span>More</span></button>';
  if(html!==st.footHtml){st.footHtml=html;$('shsFoot').innerHTML=html;}
 }

 /* ---------------------------------------------------------------- the drawer ------------ */
 function select(id,o){
  st.sel=id; st.drawer=true; root.classList.add('dr'); document.body.classList.add(innerWidth<=760?'shs-sheet':'shs-drw');
  paintDrawer(); markSel(); PORT.prio=id; pump(); fitTight();
  if(o&&o.scroll){const c=[...root.querySelectorAll('.shs-sec[data-breed] .shs-card[data-hid]')].find(x=>x.dataset.hid===String(id));if(c)c.scrollIntoView({block:o.block||'center'});}
 }
 function closeDrawer(){ st.drawer=false; st.sel=null; st.drHtml=''; PORT.prio=null; root.classList.remove('dr'); document.body.classList.remove('shs-sheet','shs-drw'); markSel(); fitTight(); }
 function stateOf(h,i,ri){ return isEgg(h)?'egg':isFoal(h)?'foal':i===ri?'ridden':'adult'; }
 function chipsOf(h,i,s,ri){
  const row=rowOf(i), c=[], rowTxt=row?row.textContent:'', egg=isEgg(h);   // an egg has no pasture, tack, whistle or hitching post; the Full list keeps its old buttons
  c.push({k:'fav',on:!!h.fav,l:'Favourite',t:'Keep at the top of My Horses',svg:on=>on?HEART_F('#b3334f'):K.line('heart','#fff',2.1)});
  if(!egg&&has('[data-st="out:'+i+'"]'))c.push({k:'out',on:!!h.out,l:'Pasture',t:'Out to pasture or back to the barn',i:'leaf'});
  if(!h.foal&&!egg&&has('[data-st="eq:'+i+'"]'))c.push({k:'eq',on:s.companion===h.id,l:'Take along',t:'Walks along behind you on the trails',i:'follow'});
  if(!egg&&has('[data-fx="ranch:tack:'+i+'"]'))c.push({k:'tack',on:false,l:'Tack',t:'Tack and un-tack',i:'saddle'});
  if(!egg&&has('[data-fx="bpe:whistleHorse:'+h.id+'"]'))c.push({k:'whistle',on:s.whistleHorse===h.id,l:'Whistle',t:'The horse your whistle calls',i:'whistle'});
  const brd=!!G.breeding;   // ui2-horse flattens the breeding line into text and drops its two buttons with it, so the package being there is the test
  if(brd||has('[data-fx="breed:sheet:'+i+'"]'))c.push({k:'sheet',on:false,l:'Sheet',t:'Horse sheet',i:'collection'});
  if(brd||has('[data-fx="breed:tree:'+i+'"]'))c.push({k:'tree',on:false,l:'Family tree',t:'Family tree',i:'tree'});
  const un=has('[data-fx="ranch:unhitch:'+i+'"]');
  if(!egg&&(un||has('[data-fx="ranch:hitch:'+i+'"]')))c.push({k:'hitch',on:un,l:un?'Hitched':'Hitch',t:'Tie up at a free hitching post',i:'hitch'});
  if(row){   // anything else a package puts in the row later
   [...row.querySelectorAll('button')].forEach((b,N)=>{const sd=b.dataset.st||'', fx=b.dataset.fx||'';
    if(/^(ride|rn|out|eq):/.test(sd)||/^(ranch:(tack|hitch|unhitch)|bpe:whistleHorse|breed:(sheet|tree)):/.test(fx))return;
    const t=nx(b.title||b.textContent).replace(/\s+/g,' ').trim();
    c.push({k:'gen:'+N,on:b.classList.contains('claimBtn'),l:t.slice(0,18)||'More',t:t||'More',i:'sparkle'});});
  }
  return {chips:c,hint:/turn out to take along/i.test(rowTxt)};
 }
 function paintDrawer(){
  const dr=$('shsDr'); if(!st.drawer)return;
  const s=S(), i=idxOf(s,st.sel); if(i<0){closeDrawer();return;}
  const h=s.horses[i], ri=G.horse.rideIdx(), n=starsOf(h), r=rampOf(n), egg=isEgg(h), foal=isFoal(h), ride=i===ri, state=stateOf(h,i,ri);
  const nm=nx(h.name).trim()||'Horse', lv=h.level||1, k=lookKey(h), url=egg?null:PORT.cache.get(k), N=maxOf(h.breed), M=masteryM(s,h.breed);
  const maxL=(G.xp&&G.xp.MAX_LEVEL)||50, need=50+50*lv, xp=h.xp||0, hearts=clamp(Math.round((h.bond||0)/20),0,5), bond=BOND[Math.min(5,Math.floor((h.bond||0)/20))];
  const {chips,hint}=chipsOf(h,i,s,ri), v=variantOf(h), loc=locOf(h,i,s,ri);
  const where=ride?'Riding now':h.hitch?'Hitched at a post':h.out?'Out in the pasture':'In the barn';
  const tag=ride?'<span class="shs-tag ride">RIDING</span>':egg?'<span class="shs-tag egg">EGG</span>':foal?'<span class="shs-tag foal">FOAL</span>':'';
  let lines='<div class="shs-line"><b>'+esc(label(h.breed))+'</b><span class="g">Mastery '+M+'/'+N+'</span></div>';
  if(!egg)lines+='<div class="shs-line">Level '+lv+(lv>=maxL?'<span class="g">Max level</span>':'<span class="shs-xp"><i style="width:'+Math.round(100*clamp(xp/need,0,1))+'%"></i></span><span>'+Math.floor(xp)+'/'+need+'</span>')+'</div>'
   +'<div class="shs-line"><span class="shs-hearts">'+HEART_F('#ff7a98').repeat(hearts)+HEART_O.repeat(5-hearts)+'</span>'+bond+'</div>';
  lines+='<div class="shs-line">'+esc([v,sexOf(h)].filter(Boolean).join(' · '))+'</div>';
  if(egg){const left=EGGMS()-(Date.now()-(h.eggLaid||h.born||Date.now()));lines+='<div class="shs-line">'+K.line('egg','#cfe9b3',2.2)+'<span class="t">Warmed '+(h.eggWarm||0)+'/'+EGGW()+' · hatches in '+hrs(left)+'h</span></div>';}
  else{
   lines+='<div class="shs-line">'+ic(ride?'horses':(loc?loc[0]:'horses'),'#cfe9b3',2.2)+'<span class="t">'+where+(s.companion===h.id?' · following you':'')+(hint&&!foal?' · turn out to take along':'')+'</span></div>';
   if(foal)lines+='<div class="shs-line">'+K.line('clock','#cfe9b3',2.2)+'<span class="t">Grows up in '+hrs(86400000-(Date.now()-(h.born||Date.now())))+'h, or at level 3</span></div>';
   if(lowNeeds(h))lines+='<div class="shs-line warn">'+K.line('care','#ffc4b8',2.2)+'<span class="t">Needs care</span>'+(foal?'':' <button class="se-cream" data-shs="care">Care</button>')+'</div>';
  }
  const acts=chips.map(c=>'<button class="shs-chip'+(c.on?' on':'')+'" data-shs="act:'+c.k+'" aria-pressed="'+(c.on?'true':'false')+'" title="'+esc(c.t)+'">'
   +(c.svg?c.svg(c.on):ic(c.i,c.on?'#4a3519':'#fff',2.1))+'<span>'+esc(c.l)+'</span></button>').join('');
  const [sec,pri]=state==='ridden'?['Care','Details']:state==='adult'?['Details','Ride']:state==='foal'?['Details',s.companion===h.id?'Following':'Follow me']:['Details','Warm egg'];
  const html='<div class="shs-dr-body">'
   +'<div class="shs-dr-h"><b>'+esc(nm)+'</b><button class="se-circ shs-mini" data-shs="rename" title="Rename" aria-label="Rename">'+ic('pen','#fff',2.3)+'</button>'
   +'<button class="se-circ shs-mini" data-shs="drclose" title="Close" aria-label="Close">'+K.line('close','#fff',2.8)+'</button></div>'
   +'<div class="shs-dr-stars">'+('<i>'+STAR+'</i>').repeat(n)+'</div>'
   +'<div class="shs-dr-top"><button class="shs-dr-pic" data-shs="secondary" aria-label="Details">'
   +(egg?EGG(h):BUST(h)+'<img class="shs-img'+(url?' got':'')+'" data-key="'+esc(k)+'" alt=""'+(url?' src="'+url+'"':'')+'><span class="shs-lv">'+LV(lv)+'</span>')
   +(tag?'<span class="shs-ic">'+tag+'</span>':'')+'</button><div>'+lines+'</div></div>'
   +'<div class="shs-acts">'+acts+'</div></div>'
   +'<div class="shs-dr-foot"><button class="se-cream" data-shs="secondary">'+sec+'</button><button class="se-gold" data-shs="primary">'+pri+'</button></div>';
  if(html!==st.drHtml){st.drHtml=html;dr.innerHTML=html;}
  fitDrawerName();
  dr.style.setProperty('--rim',r[2]); dr.style.setProperty('--top',r[0]); dr.style.setProperty('--bot',r[1]);
 }
 function toggleFav(id){
  let now=false;
  G.save.sync(s=>{const x=(s.horses||[]).find(y=>y.id===id);if(!x)return;if(x.fav)delete x.fav;else x.fav=true;now=!!x.fav;});
  const live=(G.horse.myHorses||[]).find(y=>y.id===id); if(live){if(now)live.fav=true;else delete live.fav;}   // the live array in step, as the stable's own Pasture does
  paint();
 }
 function openOverview(id,tab){
  const s=S(), i=idxOf(s,id); if(i<0)return;
  st.away={to:'overview',id}; st.leftScroll=main.scrollTop;
  if(i!==G.horse.rideIdx()){const sel=$('horseSel');if(sel&&sel.onchange){sel.value=String(i);sel.onchange();}}   // the Overview shows only the ridden horse; se-care's own arrows switch the same way
  try{G.seCare.open(tab);}catch(e){console.error('se-horses overview',e);}   // open() hides the panels, and so this screen
 }
 function openSheet(id){ const i=idxOf(S(),id); if(i<0)return; K.setBack('sheetPanel',()=>reopen(id)); G.ui.dispatch('breed:sheet:'+i); }
 function doPrimary(which){
  const s=S(), i=idxOf(s,st.sel); if(i<0)return; const h=s.horses[i], id=h.id, state=stateOf(h,i,G.horse.rideIdx());
  if(which==='secondary'){ if(state==='ridden')openOverview(id,'feeding'); else if(state==='adult')openOverview(id,'horse'); else openSheet(id); return; }
  if(state==='ridden')openOverview(id,'horse');
  else if(state==='adult'){ if(!via('[data-st="ride:'+i+'"]')){const sel=$('horseSel');if(sel&&sel.onchange){sel.value=String(i);sel.onchange();}} setTimeout(()=>G.hidePanels(),0); }   // riding puts you on the horse and closes the menu, like the Overview's RIDE
  else if(state==='foal')via('[data-st="eq:'+i+'"]');
  else via('[data-fx="breed:warm"]');                            // warms the oldest egg, the game's own rule; it says so when it is too soon
 }
 function doChip(key){
  const s=S(), i=idxOf(s,st.sel); if(i<0)return; const h=s.horses[i], id=h.id;
  if(key==='fav')toggleFav(id);
  else if(key==='out')via('[data-st="out:'+i+'"]');
  else if(key==='eq')via('[data-st="eq:'+i+'"]');
  else if(key==='tack'){st.away={to:'market',id};st.leftScroll=main.scrollTop;via('[data-fx="ranch:tack:'+i+'"]');}
  else if(key==='whistle')via('[data-fx="bpe:whistleHorse:'+h.id+'"]');
  else if(key==='sheet'){K.setBack('sheetPanel',()=>reopen(id));if(!via('[data-fx="breed:sheet:'+i+'"]'))G.ui.dispatch('breed:sheet:'+i);}
  else if(key==='tree'){K.setBack('treePanel',()=>reopen(id));if(!via('[data-fx="breed:tree:'+i+'"]'))G.ui.dispatch('breed:tree:'+i);}
  else if(key==='hitch'){if(!via('[data-fx="ranch:unhitch:'+i+'"]'))via('[data-fx="ranch:hitch:'+i+'"]');}
  else if(/^gen:\d+$/.test(key)){const row=rowOf(i),b=row&&row.querySelectorAll('button')[+key.slice(4)];if(b)b.click();}
  setTimeout(()=>{if(st.on)paint();},120);
 }

 /* ---------------------------------------------------------------- mastery popover -------- */
 let popT=0;
 function hidePop(){ clearTimeout(popT); if(st.pop){try{st.pop.remove();}catch(e){}} st.pop=null; }
 function showPop(btn){
  hidePop();
  const v=btn.dataset.shs, j=v.lastIndexOf(':'), b=v.slice(5,j), k=+v.slice(j+1), s=S(), M=masteryM(s,b), L=ladder(b);
  const tr=btn.closest('.shs-track'); if(!tr)return;
  const cr=col.getBoundingClientRect(), br=btn.getBoundingClientRect(), trr=tr.getBoundingClientRect();
  const el=document.createElement('div'); el.className='shs-pop';
  el.innerHTML='<b>Mastery '+k+'</b>'+(rung(L,k)?' · '+esc(rung(L,k)):'')+'<br>'+(k<=M?'Unlocked':'Unlocks when you have owned '+k+' of this breed');
  el.style.top=(trr.bottom-cr.top+4).toFixed(0)+'px';
  col.appendChild(el); st.pop=el; popT=setTimeout(hidePop,3000);
  const w=el.offsetWidth; el.style.left=clamp(br.left+br.width/2-cr.left,w/2+4,cr.width-w/2-4).toFixed(0)+'px';   // centred on the node, kept inside the column at its own width
 }

 /* ---------------------------------------------------------------- search ---------------- */
 function openSearch(){ root.classList.add('q'); clearSoon(); setTimeout(()=>{try{qIn.focus();}catch(e){}},0); }
 function closeSearch(){ qIn.value=''; st.q=''; root.classList.remove('q'); try{qIn.blur();}catch(e){} paint(); }
 qIn.addEventListener('input',()=>{st.q=qIn.value;paint();});

 /* ---------------------------------------------------------------- modals ---------------- */
 const modal=$('shsModal');
 const msheet=()=>document.body.classList.toggle('shs-msheet',!!st.modal&&(innerWidth<=760||innerHeight<560));   // a phone's sheet or a short screen's modal: toasts go to the top, off its rows
 function openModal(kind,title,body){ st.modal=kind; root.classList.add('m'); msheet();
  modal.innerHTML='<h3>'+esc(title)+'</h3><button class="se-circ shs-mini x" data-shs="mclose" title="Close" aria-label="Close">'+K.line('close','#fff',2.8)+'</button>'+body; }
 function closeModal(){ st.modal=null; root.classList.remove('m'); modal.innerHTML=''; msheet(); }
 function petPic(k){ try{if(G.petArt&&typeof G.petArt.svg==='function'){const v=String(G.petArt.svg(k,30)||'');if(/^\s*<svg[\s>]/i.test(v)&&!/<script|on\w+=/i.test(v))return v;}}catch(e){} return K.line('paw','#f1ecff',2.1); }
 function petsModal(){
  const s=S(), L=s.petList||[]; let act=null; try{act=G.pets&&G.pets.active?G.pets.active():s.activePet;}catch(e){}
  if(!L.length){openModal('pets','Pets','<p>No pets yet. Adopt one in the Market.</p><div class="shs-mact"><button class="se-gold" data-shs="petmarket">Market</button></div>');return;}
  openModal('pets','Pets',L.map(k=>{let nm=k;try{nm=G.pets.cfg(k).name;}catch(e){}const on=act===k;
   return '<div class="shs-mrow"><span class="shs-pet">'+petPic(k)+'</span><span class="sp"><b>'+esc(nx(nm).trim()||'Pet')+'</b><small>'+(on?'Following you':'At the ranch')+'</small></span>'
    +'<button class="'+(on?'se-gold':'se-cream')+'" data-shs="pet:'+esc(k)+'">'+(on?'Following':'Follow')+'</button></div>';}).join(''));
 }
 function moreModal(){
  const s=S(), pas=pasture(s,G.horse.rideIdx());
  openModal('more','More','<p>'+ic('leaf','#cfe9b3',2.2).replace('<svg ','<svg style="width:16px;height:16px;vertical-align:-3px;margin-right:4px" ')+pas.out+' of '+pas.max+' out in the pasture · '+pas.barn+' in the barn'+(pas.head?'<br><small>'+esc(pas.head)+'</small>':'')+'</p>'
   +'<div class="shs-mrow">'+K.line('paw','#f1ecff',2.1)+'<span class="sp">Pets</span><button class="se-cream" data-shs="pets">Pets</button></div>'
   +'<div class="shs-mrow">'+K.line('list','#f1ecff',2.1)+'<span class="sp">Every horse as the old list</span><button class="se-cream" data-shs="classic">Full list</button></div>'
   +'<div class="shs-mrow">'+K.line('studio','#f1ecff',2.1)+'<span class="sp">Design a horse</span><button class="se-cream" data-shs="studio">Breed Studio</button></div>');
 }
 const textOf=html=>{const d=document.createElement('div');d.innerHTML=String(html||'');return d.textContent||'';};
 function getHorse(b){
  const idx=T.BREEDS3.findIndex(r=>r[0]===b), row=T.BREEDS3[idx]; let src='shop'; try{src=row?G.horse.breedSrc(row):'shop';}catch(e){}
  if(src==='shop'){
   st.away={to:'market',id:null}; st.leftScroll=main.scrollTop;
   try{G.ui.dispatch('roster:stars:0');}catch(e){}             // the star filter back to All (the shop is closed, so it only re-renders the closed catalogue)
   G.ui.openShop('horses');
   requestAnimationFrame(()=>{const sp=$('shopPanel'),btn=sp&&sp.querySelector('[data-buyh="'+idx+'"]'),r=btn&&btn.closest('.evrow');if(r){r.style.outline='2px solid #ffd970';r.style.outlineOffset='2px';r.scrollIntoView({block:'center'});}});   // inspectBreedAtRanch's own way
   return;
  }
  if(src==='summon'){st.away={to:'market',id:null};st.leftScroll=main.scrollTop;G.ui.openShop('summon');return;}
  if(src==='breed'){st.away={to:'market',id:null};st.leftScroll=main.scrollTop;G.ui.openShop('recipes');return;}
  if(src==='story'){openModal('info',label(b),'<p>'+esc(label(b))+' is earned in the story. Keep going in My Journey to meet one.</p><div class="shs-mact"><button class="se-gold" data-shs="journey">My Journey</button></div>');return;}   // the roster's own words for it are just "The story"
  let how=''; try{how=nx(textOf(G.horse.roster.howToGet(row))).replace(/\s+/g,' ').trim();}catch(e){}
  if(!how||how.toLowerCase()===String(src).toLowerCase()){const o=(row&&row[7])||{};how=typeof o.exclusive==='string'?nx(o.exclusive).trim():'';}   // a source the roster has no words for yet shows its own key: say how in the breed's own terms, or the plain line below
  if(src==='season')openModal('info',label(b),'<p>'+esc(how||'A season horse')+'</p><div class="shs-mact"><button class="se-gold" data-shs="season">Season Pass</button></div>');
  else openModal('info',label(b),'<p>'+esc(how||'Not sold in the shop: it comes as a special reward.')+'</p><div class="shs-mact"><button class="se-cream" data-shs="mclose">OK</button></div>');
 }
 function classic(){ const id=st.sel; closeModal(); K.classic('stablePanel',()=>{st.pendingSel=id;st.restore=true;G.ui.openStable();}); }
 function openStudio(){ closeModal(); try{window.open(studioHref(),'_blank','noopener');}catch(e){} }

 /* ---------------------------------------------------------------- input ----------------- */
 root.addEventListener('click',e=>{
  const t=e.target; if(!t||!t.closest)return;
  const hb=t.closest('button.shs-hero'); if(hb&&root.contains(hb)){hidePop();via('[data-st="hero"]');return;}   // the old list's own hero button: adopts or rides the Bay sporthorse, the same one each time
  const b=t.closest('[data-shs],.shs-card[data-hid]');
  if(st.pop&&!(b&&/^node:/.test(b.dataset.shs||'')))hidePop();
  if(!b||!root.contains(b))return;
  if(b.dataset.hid!=null&&!b.dataset.shs){const s=S(),h=(s.horses||[]).find(x=>String(x.id)===b.dataset.hid);if(h)select(h.id);return;}
  const v=b.dataset.shs, k=v.split(':')[0], a=v.slice(k.length+1);
  if(k==='search'){if(root.classList.contains('q'))closeSearch();else openSearch();}
  else if(k==='drclose')closeDrawer();
  else if(k==='mclose')closeModal();
  else if(k==='rename'){const i=idxOf(S(),st.sel);if(i>=0)via('[data-st="rn:'+i+'"]');}
  else if(k==='primary'||k==='secondary')doPrimary(k);
  else if(k==='care'){if(st.sel!=null)openOverview(st.sel,'feeding');}
  else if(k==='act')doChip(a);
  else if(k==='node')showPop(b);
  else if(k==='get')getHorse(a);
  else if(k==='coat')via('[data-fx="sq:coat:'+a+'"]');
  else if(k==='pets')petsModal();
  else if(k==='more')moreModal();
  else if(k==='classic')classic();
  else if(k==='studio')openStudio();
  else if(k==='pet'){if(!via('[data-pet="'+a+'"]')){try{G.pets.setActive(a);G.ui.renderStable();}catch(err){}}petsModal();}
  else if(k==='petmarket'){st.away={to:'market',id:null};closeModal();G.ui.openShop('pets');}
  else if(k==='journey'){closeAll();setTimeout(()=>{const q=$('questBtn');if(q)q.click();},30);}   // the ☰ menu's own way to My Journey
  else if(k==='season'){closeAll();setTimeout(()=>{const q=$('questBtn');if(q)q.click();setTimeout(()=>{const tb=document.querySelector('#questPanel [data-q="tab:season"]');if(tb)tb.click();},80);},30);}   // the ☰ menu's own way to the Season Pass
 });

 /* ---------------------------------------------------------------- standing in for the panel */
 function closeAll(){ closeModal(); G.hidePanels(); }            // hiding the panel -> se-frame's sync -> hide()
 function back(){
  if(st.modal){closeModal();return;} if(st.drawer){closeDrawer();return;} if(root.classList.contains('q')){closeSearch();return;}
  const f=K.takeBack('stablePanel'); closeAll(); if(f)setTimeout(f,0);   // a caller that registered a way back gets it
 }
 function outlinedRow(p){ return p&&p.querySelector('.evrow[style*="outline"]'); }
 function outlinedIndex(p){ const ev=outlinedRow(p), b=ev&&ev.querySelector('[data-st^="rn:"]'); return b?+b.dataset.st.split(':')[1]:null; }
 function show(p){
  st.on=true; root.classList.add('on'); document.body.classList.add('shs-open'); K.settle(); PORT.paused=false; PORT.slow=0; st.away=null; watchOthers();
  if(PORT.job&&PORT.job.dead)PORT.job.dead=false;               // back before a half-made picture was put away: it carries on
  const ev0=outlinedRow(p), hadOutline=(ev0&&ev0!==st.lastOutline)?outlinedIndex(p):null; st.lastOutline=ev0;   // a barn stall's highlight, read before any re-render wipes it; one already used is an old visit (openCard always re-renders, so a new visit is a new row)
  const rows=p.querySelectorAll('[data-st^="rn:"]').length; if(rows!==(S().horses||[]).length){try{G.ui.renderStable();}catch(e){}}   // opened by open:stablePanel over a stale or empty panel: once, never from refresh
  st.sig=''; paint();
  const want=st.pendingSel!=null?st.pendingSel:(hadOutline!=null?((S().horses||[])[hadOutline]||{}).id:null); st.pendingSel=null;
  if(want!=null&&idxOf(S(),want)>=0)select(want,{scroll:true});
  else main.scrollTop=st.restore?st.leftScroll:0;
  st.restore=false;
 }
 function hide(){
  st.on=false; st.leftScroll=main.scrollTop; hidePop(); closeModal();
  {const j=PORT.job; if(j&&j.stage==='ready'){j.dead=true;finish(j);}else if(j&&j.stage==='build')j.dead=true;}   // a picture half made is put away (a building one at its next step: disposing it under three.js's compileAsync would throw), so it does not hold one of the world's rigged horses while the screen is shut
  root.classList.remove('on','dr','q','tight','sums'); document.body.classList.remove('shs-open','shs-sheet','shs-drw','shs-msheet');
  st.drawer=false; st.sel=null; st.drHtml=''; PORT.prio=null; st.q=''; qIn.value=''; K.settle();
 }
 let pend=0;
 function refresh(){ if(!st.on)return; clearTimeout(pend); pend=setTimeout(()=>{ if(!st.on)return; paint();
  const ev=outlinedRow(P()); if(ev&&ev!==st.lastOutline){st.lastOutline=ev;const i=outlinedIndex(P()),h=i!=null&&(S().horses||[])[i];if(h)select(h.id,{scroll:true});} },60); }   // reads the hidden panel, never re-renders it
 K.screens.add(()=>st.on);
 K.cover('stablePanel',{show,hide,refresh});
 /* another menu opening closes this one. Every opener but one hides the panels first; the Events panel
    (its hotkey) opens over whatever is open, and would leave this screen up underneath it. */
 const others=new MutationObserver(ms=>{ if(!st.on)return; for(const m of ms){const t=m.target;if(t.id!=='stablePanel'&&K.isOpen(t)){const p=P();if(p&&K.isOpen(p))p.style.display='none';return;}} });
 function watchOthers(){ for(const id of (G.ui.panels||[]))if(id!=='stablePanel'){const el=$(id);if(el)others.observe(el,{attributes:true,attributeFilter:['style']});} }
 watchOthers();

 /* leaving for another screen and coming back: se-frame's own Back for a framed panel (the sheet, the
    family tree, the full list); a watch on the Back button for the Overview and the Market, which have
    no way back of their own. Their Back and Close look alike and differ only in the title. */
 function reopen(id){
  if(st.on)return;
  if(document.querySelector('.se-fr')||($('seOv')&&$('seOv').classList.contains('on'))||($('shopPanel')&&$('shopPanel').style.display==='flex')||document.body.classList.contains('se-course'))return;
  st.pendingSel=id; st.restore=true; if(!K.isOpen(P()))G.ui.openStable();
 }
 document.addEventListener('click',e=>{
  if(!st.away)return;
  const b=e.target&&e.target.closest&&e.target.closest('#seOv [data-se="close"],#seMkTop [data-mt="close"]'); if(!b)return;
  const a=st.away; st.away=null;
  if(b.title==='Back')setTimeout(()=>reopen(a.id),80);          // Close means close
 },true);                                                        // caught on the way down, before the button's own handler
 {let tO=0,tS=0;   // an Overview or Market that closed some other way (Escape) forgets the way back, or a later Back would bring this screen up unasked
  const ov=$('seOv'); if(ov)new MutationObserver(()=>{if(!ov.classList.contains('on')){clearTimeout(tO);tO=setTimeout(()=>{if(st.away&&st.away.to==='overview'&&!ov.classList.contains('on'))st.away=null;},200);}}).observe(ov,{attributes:true,attributeFilter:['class']});
  const sp=$('shopPanel'); if(sp)new MutationObserver(()=>{if(sp.style.display!=='flex'){clearTimeout(tS);tS=setTimeout(()=>{if(st.away&&st.away.to==='market'&&sp.style.display!=='flex')st.away=null;},200);}}).observe(sp,{attributes:true,attributeFilter:['style']});}

 /* ---------------------------------------------------------------- keys and hooks -------- */
 function step(d){
  const a=document.activeElement; if(a&&a!==qIn&&root.contains(a)&&a.blur)a.blur();   // a clicked card or tile gives up the focus, so Enter reaches the drawer's gold button
  const cards=[...root.querySelectorAll('.shs-sec[data-breed] .shs-card[data-hid]')]; if(!cards.length)return;
  let j=cards.findIndex(c=>st.sel!=null&&c.dataset.hid===String(st.sel));
  j=j<0?0:clamp(j+d,0,cards.length-1);
  const s=S(), h=(s.horses||[]).find(x=>String(x.id)===cards[j].dataset.hid); if(h)select(h.id,{scroll:true,block:'nearest'});
 }
 G.on('escape',()=>{ if(!st.on)return false;
  const dlg=$('dlg'); if(dlg&&dlg.style.display&&dlg.style.display!=='none'){dlg.style.display='none';return true;}   // the rename dialog closes; the screen stays
  if(st.modal){closeModal();return true;}
  if(root.classList.contains('q')){closeSearch();return true;}
  if(st.pop){hidePop();return true;}
  if(st.drawer){closeDrawer();return true;}
  return false; });                                              // false: the game hides the panels, and so this screen
 G.on('key',e=>{ if(!st.on)return false; const c=e.code;
  if(st.modal)return ['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','Enter'].includes(c);
  if(c==='ArrowLeft'||c==='KeyA'){step(-1);return true;}
  if(c==='ArrowRight'||c==='KeyD'){step(1);return true;}
  if(c==='ArrowUp'||c==='KeyW'){main.scrollBy({top:-140,behavior:'smooth'});return true;}
  if(c==='ArrowDown'||c==='KeyS'){main.scrollBy({top:140,behavior:'smooth'});return true;}
  if(c==='Enter'||c==='Space'){const f=document.activeElement;if(f&&f.tagName==='BUTTON'&&root.contains(f))return true;}   // a focused button answers Enter and Space itself
  if(c==='Enter'){if(st.drawer){const b=root.querySelector('#shsDr [data-shs="primary"]');if(b)b.click();}else step(1);return true;}
  if(c==='Space')return true;
  return false; });                                              // never N (the toggle) or the other panel hotkeys
 G.on('wallet',()=>{if(st.on){strip.paint();fitTitle();}});
 G.on('courseStart',()=>{if(st.on){closeModal();const p=P();if(p)p.style.display='none';}});   // startCourse hides only the events panel
 for(const hk of ['grantHorse','foal','rebuild','coat','interval30'])G.on(hk,()=>{if(st.on)refresh();});
 {let rt=0;addEventListener('resize',()=>{if(!st.on)return;clearTimeout(rt);rt=setTimeout(()=>{if(!st.on)return;if(st.drawer){document.body.classList.toggle('shs-sheet',innerWidth<=760);document.body.classList.toggle('shs-drw',innerWidth>760);}msheet();fitTight();paint();fitNames();},100);});}
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&st.on)pump();});

 /* ---------------------------------------------------------------- QA + export ----------- */
 G.on('state',o=>{o.seHorses={on:st.on,sel:st.sel,drawer:st.drawer,search:st.q,modal:st.modal,title:strip.querySelector('.se-ttl-b').textContent,
  sections:[...root.querySelectorAll('.shs-sec[data-breed]')].map(x=>({breed:x.dataset.breed,M:+((x.querySelector('.shs-shield')||{dataset:{}}).dataset.m||0),max:x.querySelectorAll('.shs-node,.shs-shield').length,cards:x.querySelectorAll('.shs-card[data-hid]').length})),
  favs:root.querySelectorAll('.shs-sec.fav .shs-card[data-hid]').length,cards:root.querySelectorAll('.shs-sec[data-breed] .shs-card[data-hid]').length,
  portraits:{done:PORT.done,cached:PORT.cache.size,failed:PORT.fail.size,busy:!!PORT.job,off:portraitsOff(),ms:PORT.ms.slice(-12),log:PORT.log.slice()}};});
 G.seHorses={open(){if(st.on)return;if(K.isOpen(P()))G.hidePanels();G.ui.openStable();},close(){if(st.on)G.hidePanels();},
  select:id=>select(id,{scroll:true}),paint,portrait:id=>{const h=(S().horses||[]).find(x=>x.id===id);return h?(PORT.cache.get(lookKey(h))||null):null;},state:st};
}

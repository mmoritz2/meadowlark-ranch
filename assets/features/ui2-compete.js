/* Feature package 'ui2-compete' — the competition screens: Events, Quests, Leaderboards.

   These three panels were the last places in the game that still read as prose.  An event was
   a sentence ("Cottonwood · 🏁 race · 6 gates · Lv 2 · 🎀🎀"), a leaderboard was a wrapped bag
   of pills where the rank, the name and the number all ran together in the same 11px, and a
   quest row told you a number but never what it paid or whether the thing was finished.

   This package does not rewrite the inline renderers — it cannot; it owns one file.  Instead
   it re-reads what they produced and lays it out again:

   1. EVENTS become programme entries.  Discipline and level as a labelled spec grid, the two
      stats the discipline actually asks of your horse shown against their ceiling, the time
      allowed, your personal best, the purse, and four ribbon pips (three green + the gold)
      so "ribbons won out of four" is a picture rather than a repeated emoji.  The enter /
      locked control is MOVED, never rebuilt, so its click handler and data-ev survive.
   2. LEADERBOARDS become tables.  Rank, name and value in three aligned columns with
      tabular figures, your own row flagged with a brass rail and a YOU tag.
   3. QUESTS get designed states.  active / complete / claimable / claimed each have a pill
      and a card treatment, the bar carries its value, and the reward is one line.

   Long rules paragraphs inside the event blocks collapse into a "How this works" note.
   Everything is idempotent (data-c2 marks a transformed node), wrapped in try/catch per row,
   and re-runs after any of the three renderers and on panel mutation. */
export const id='ui2-compete';
export function install(G){
 const S=G.save, T=G.tables||{}, K=(G.ui&&G.ui.k)||{};
 const EVENTS=T.EVENTS3||[], ROUTES=T.RACE_ROUTES||{}, STAT_LBL=T.STAT_LBL||{};

 /* ================= 0. stylesheet ================= */
 try{
  if(!document.getElementById('mkCompeteCss')){
   const st=document.createElement('style'); st.id='mkCompeteCss';
   st.textContent=`
/* ---------- shared ---------- */
.c2-k{font-size:9.5px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:var(--ink-3,#9a8770);line-height:1.3;white-space:nowrap}
.c2-v{font-size:13px;font-weight:800;color:var(--ink,#3b2a1e);line-height:1.25;font-variant-numeric:tabular-nums;
 white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.c2-v.good{color:var(--good,#3f8f4c)} .c2-v.bad{color:var(--bad,#a33b37)} .c2-v.dim{color:var(--ink-3,#9a8770)}
.c2-note{margin:2px 0 0;width:100%}
.c2-note>summary{cursor:pointer;list-style:none;font-size:11px;font-weight:800;color:var(--ink-2,#6b5a49);
 padding:3px 0;display:flex;align-items:center;gap:5px}
.c2-note>summary::-webkit-details-marker{display:none}
.c2-note>summary::before{content:"›";display:inline-block;transition:transform .15s;font-weight:800;color:var(--ink-3,#9a8770)}
.c2-note[open]>summary::before{transform:rotate(90deg)}
.c2-note .c2-noteBody{font-size:11.5px;line-height:1.5;color:var(--ink-2,#6b5a49);padding-bottom:2px}

/* ---------- events: a programme entry ---------- */
.evrow.c2-ev{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;flex:0 0 auto;
 column-gap:var(--sp-3,12px);row-gap:6px;flex-wrap:wrap;padding:10px 12px;position:relative;overflow:hidden}
.evrow.c2-ev::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--line-2,#d4bf93)}
.evrow.c2-ev.is-feat::before{background:var(--brass,#e0b25a)}
.evrow.c2-ev.is-feat{border-color:#e8cf8a;background:linear-gradient(180deg,#fffdf5,#fff8e6)}
.evrow.c2-ev.is-lock::before{background:var(--line,#e6d6b8)}
.evrow.c2-ev.is-lock .c2-evTitle{color:var(--ink-2,#6b5a49)}
.evrow.c2-ev.is-won::before{background:var(--meadow,#5fb56a)}
.c2-evMain{grid-column:1;min-width:0;display:flex;flex-direction:column;gap:5px}
.c2-evTop{display:flex;align-items:center;gap:7px;flex-wrap:wrap;min-width:0}
.c2-evDisc{flex:none;width:30px;height:30px;border-radius:9px;display:inline-flex;align-items:center;justify-content:center;
 font-size:16px;line-height:1;background:var(--paper-2,#f6ecd9);box-shadow:inset 0 0 0 1px var(--line,#e6d6b8)}
.c2-ev.is-feat .c2-evDisc{background:var(--brass-3,#fff0c2);box-shadow:inset 0 0 0 1px #e8cf8a}
.c2-evTitle{font-family:var(--display,inherit);font-size:14.5px;font-weight:600;color:var(--ink,#3b2a1e);
 line-height:1.15;min-width:0;overflow-wrap:anywhere}
.c2-evTag{flex:none;font-size:9px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;
 border-radius:999px;padding:2px 7px;background:var(--brass-3,#fff0c2);color:#7a5a13;box-shadow:inset 0 0 0 1px #e8cf8a}
.c2-evTag.won{background:var(--meadow-3,#eaf5dc);color:#3f5f2c;box-shadow:inset 0 0 0 1px #bfe0a4}
.c2-evWhere{font-size:11px;font-weight:700;color:var(--ink-2,#6b5a49)}
.c2-specs{display:grid;grid-template-columns:repeat(auto-fit,minmax(74px,1fr));gap:4px 10px;
 border-top:1px dashed var(--line,#e6d6b8);padding-top:6px}
.c2-spec{display:flex;flex-direction:column;gap:1px;min-width:0}
.c2-reqBar{display:block;height:4px;border-radius:99px;background:var(--paper-3,#efe1c6);overflow:hidden;margin-top:3px}
.c2-reqBar>i{display:block;height:100%;background:var(--leather,#6b4a2f);border-radius:99px}
.c2-ribs{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.c2-pips{display:inline-flex;gap:3px}
.c2-pip{width:16px;height:16px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;
 font-size:9px;line-height:1;background:var(--paper-3,#efe1c6);box-shadow:inset 0 0 0 1px var(--line-2,#d4bf93);color:transparent}
.c2-pip.on{background:var(--meadow-3,#eaf5dc);box-shadow:inset 0 0 0 1.5px var(--meadow-2,#3f8f4c);color:#3f8f4c}
.c2-pip.gold.on{background:var(--brass-3,#fff0c2);box-shadow:inset 0 0 0 1.5px var(--brass-2,#c8952f);color:#8a6413}
.c2-evAct{grid-column:2;justify-self:end;align-self:center;display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex:none;white-space:nowrap}
.c2-evAct>button{width:100%}
.c2-evAct>button{min-height:38px}
.c2-evAct .c2-purse{font-size:10.5px;font-weight:800;color:var(--ink-3,#9a8770);font-variant-numeric:tabular-nums}
.c2-lockNote{font-size:11px;font-weight:800;color:var(--ink-3,#9a8770);display:flex;align-items:center;gap:4px}
.c2-evExtra{grid-column:1/-1;display:flex;flex-wrap:wrap;gap:3px 8px;align-items:center;font-size:10.5px;
 font-weight:700;color:var(--ink-3,#9a8770);border-top:1px dashed var(--line,#e6d6b8);padding-top:5px}
.c2-evExtra>*{min-width:0}
.evrow.c2-blk{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;column-gap:10px;row-gap:5px;
 flex:0 0 auto;padding:9px 12px}
.evrow.c2-blk>b{grid-column:1;grid-row:1;width:auto!important;font-family:var(--display,inherit);font-size:13.5px;font-weight:600;min-width:0}
.evrow.c2-blk>*{grid-column:1/-1;min-width:0}
.evrow.c2-blk>b~*{grid-column:1/-1}
.evrow.c2-blk>button{grid-column:2;grid-row:1;justify-self:end;align-self:center;flex:none;white-space:nowrap}
.evrow.c2-blk>span{width:auto!important}
.c2-sechead{display:flex;align-items:center;gap:8px;flex:0 0 auto;margin:6px 2px 0;
 font-family:var(--display,inherit);font-size:12px;font-weight:600;letter-spacing:.04em;color:var(--ink-2,#6b5a49)}
.c2-sechead::after{content:"";flex:1;height:1px;background:var(--line,#e6d6b8)}

/* ---------- leaderboards: rank | name | value ---------- */
.c2-lb{display:flex;flex-direction:column;gap:2px;margin-top:5px}
.c2-lbRow{display:grid;grid-template-columns:26px minmax(0,1fr) auto;align-items:center;column-gap:9px;
 padding:4px 7px;border-radius:8px;font-size:12px;position:relative}
.c2-lbRow:nth-child(odd){background:var(--paper-2,#f6ecd9)}
.c2-lbRk{font-size:11px;font-weight:800;color:var(--ink-3,#9a8770);font-variant-numeric:tabular-nums;text-align:center}
.c2-lbNm{font-weight:700;color:var(--ink-2,#6b5a49);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.c2-lbV{font-weight:800;color:var(--ink,#3b2a1e);font-variant-numeric:tabular-nums;text-align:right;white-space:nowrap}
.c2-lbRow.me{background:var(--meadow-3,#eaf5dc);box-shadow:inset 2px 0 0 var(--meadow-2,#3f8f4c)}
.c2-lbRow.me .c2-lbNm,.c2-lbRow.me .c2-lbV,.c2-lbRow.me .c2-lbRk{color:#33562a}
.c2-lbRow.club{background:#e7f1fa;box-shadow:inset 2px 0 0 #24506e}
.c2-lbYou{flex:none;font-size:8.5px;font-weight:800;letter-spacing:.09em;border-radius:999px;padding:1px 5px;
 background:var(--meadow-2,#3f8f4c);color:#fff;margin-left:6px;vertical-align:1px}
.c2-lbGap{text-align:center;font-size:10px;color:var(--ink-3,#9a8770);letter-spacing:.3em;line-height:1}

/* ---------- quests: designed states ---------- */
.qrow.c2-q{display:grid;grid-template-columns:34px minmax(0,1fr) auto;align-items:center;column-gap:11px;flex:0 0 auto;
 border:1px solid var(--line,#e6d6b8);border-radius:13px;padding:8px 11px;background:var(--paper-raised,#fff);
 box-shadow:var(--e0,0 1px 2px rgba(50,32,10,.06));position:relative;overflow:hidden}
.qrow.c2-q::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--line-2,#d4bf93)}
.qrow.c2-q.st-ready{border-color:#bfe0a4;background:linear-gradient(180deg,#fff,var(--good-bg,#eaf5dc))}
.qrow.c2-q.st-ready::before{background:var(--meadow-2,#3f8f4c)}
.qrow.c2-q.st-done{opacity:.72}
.qrow.c2-q.st-done::before{background:var(--meadow,#5fb56a)}
.qrow.c2-q>.qico{grid-column:1;width:34px;height:34px;border-radius:10px;display:inline-flex;align-items:center;
 justify-content:center;font-size:18px;background:var(--paper-2,#f6ecd9);box-shadow:inset 0 0 0 1px var(--line,#e6d6b8)}
.qrow.c2-q.st-ready>.qico{background:#fff;box-shadow:inset 0 0 0 1px #bfe0a4}
.c2-qMain{grid-column:2;min-width:0;display:flex;flex-direction:column;gap:4px}
.c2-qTitle{font-size:13px;font-weight:800;color:var(--ink,#3b2a1e);line-height:1.25;overflow-wrap:anywhere}
.c2-qTitle b{font-weight:800}
.c2-qDesc{font-size:11px;font-weight:600;color:var(--ink-2,#6b5a49);line-height:1.35}
.c2-qMeter{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;column-gap:8px}
.c2-qTrack{display:block;height:6px;border-radius:99px;background:var(--paper-3,#efe1c6);overflow:hidden}
.c2-qFill{display:block;height:100%;border-radius:99px;background:var(--leather,#6b4a2f);transition:width .3s}
.st-ready .c2-qFill,.st-done .c2-qFill{background:var(--meadow-2,#3f8f4c)}
.c2-qNum{font-size:10.5px;font-weight:800;color:var(--ink-2,#6b5a49);font-variant-numeric:tabular-nums;white-space:nowrap}
.c2-qRew{display:flex;align-items:center;gap:5px;font-size:10.5px;font-weight:800;color:var(--ink-3,#9a8770);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.c2-qRew .c2-rewTag{font-size:8.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-3,#9a8770)}
.c2-qRew .c2-rewVal{color:var(--ink,#3b2a1e);font-variant-numeric:tabular-nums}
.st-ready .c2-qRew .c2-rewVal{color:var(--good,#3f8f4c)}
.c2-qEnd{grid-column:3;justify-self:end;display:flex;flex-direction:column;align-items:flex-end;gap:3px;flex:none;white-space:nowrap}
.c2-qEnd>button{min-height:36px}
.c2-state{font-size:9px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;border-radius:999px;padding:2px 7px;
 background:var(--paper-2,#f6ecd9);color:var(--ink-3,#9a8770);box-shadow:inset 0 0 0 1px var(--line,#e6d6b8)}
.c2-state.done{background:var(--meadow-3,#eaf5dc);color:#3f5f2c;box-shadow:inset 0 0 0 1px #bfe0a4}

@media (max-width:560px){
 .evrow.c2-ev{grid-template-columns:minmax(0,1fr)}
 .c2-evAct{grid-column:1;justify-self:stretch;flex-direction:row;align-items:center;justify-content:space-between;
  gap:8px;border-top:1px dashed var(--line,#e6d6b8);padding-top:7px}
 .c2-evAct>button{flex:1}
 .qrow.c2-q{column-gap:9px}
 .c2-qRew{font-size:9.5px;gap:4px}
 .c2-qTitle{font-size:12.5px}
}
@media (prefers-reduced-motion:reduce){.c2-qFill{transition:none}}`;
   (document.head||document.documentElement).appendChild(st);
  }
 }catch(e){}

 /* ================= 1. helpers ================= */
 const esc=v=>String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
 const txt=n=>((n&&n.textContent)||'').replace(/\s+/g,' ').trim();
 const el=(tag,cls,html)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(html!=null)e.innerHTML=html;return e;};
 const spec=(k,v,cls,extra)=>'<div class="c2-spec"><span class="c2-k">'+k+'</span>'
   +'<span class="c2-v'+(cls?' '+cls:'')+'">'+v+'</span>'+(extra||'')+'</div>';

 /* What the discipline is, and what it asks of a horse. Two stats, not five: a spec panel
    that lists everything tells you nothing. */
 function disc(ev){
  if(ev.dressage)return {icon:'🎽',label:'Dressage',stats:['agility','stamina'],
   detail:((T.DRESSAGE_TESTS||G.course&&G.course.DRESSAGE_TESTS||{})[ev.id]||[]).length+' figures'};
  if(ev.xc)return {icon:'🌲',label:'Cross country',stats:['stamina','jump'],
   detail:((ROUTES[ev.route]||[]).length||0)+' fences'};
  if(ev.race)return {icon:'🏁',label:'Race',stats:['speed','stamina'],
   detail:((ROUTES[ev.route]||[]).length||0)+' gates'+(ev.rev?' · reversed':'')};
  return {icon:'⤴️',label:'Show jumping',stats:['jump','agility'],
   detail:(ev.n||0)+' fences'+(ev.laps>1?' × '+ev.laps+' laps':'')};
 }
 function allowed(ev){
  try{
   if(ev.dressage)return Math.round(ev.par||0)+'s';
   const par=(G.course&&G.course.eventPar)?G.course.eventPar(ev):(ev.n?ev.n*9:40);
   return Math.round(ev.time||par*1.4)+'s';
  }catch(e){return '—';}
 }
 function best(ev,s){
  if(ev.dressage){const v=s&&s.bestScore&&s.bestScore[ev.id];return v?Math.round(v*100)+'%':null;}
  const v=s&&s.bestTimes&&s.bestTimes[ev.id];return v?v+'s':null;
 }
 function statOf(h,k){
  let at=0,cap=10;
  try{at=(h&&h.stats&&h.stats[k])||0;}catch(e){}
  try{if(G.xp&&G.xp.statCap)cap=Math.min(G.xp.statCap(h),G.xp.statCeil?G.xp.statCeil(h,k):10);}catch(e){}
  if(!(cap>0))cap=10;
  return {at:Math.round(at*10)/10,cap};
 }
 /* Four ribbons: three green, then the gold for a clean 95% round. */
 function pips(r,gold){
  const green=Math.max(0,Math.min(3,(r|0)-(gold?1:0)));
  let h='<span class="c2-pips" role="img" aria-label="'+((gold?green+1:green))+' of 4 ribbons">';
  for(let i=0;i<3;i++)h+='<span class="c2-pip'+(i<green?' on':'')+'">🎀</span>';
  h+='<span class="c2-pip gold'+(gold?' on':'')+'">★</span></span>';
  return h;
 }

 /* A long grey paragraph inside a block row becomes a collapsed note. */
 function foldNote(row,title){
  try{
   row.querySelectorAll(':scope > span').forEach(sp=>{
    if(sp.dataset.c2)return;
    const t=txt(sp);
    if(t.length<90||sp.querySelector('button,input,select')||/display\s*:\s*flex/.test(sp.getAttribute('style')||''))return;
    const d=el('details','c2-note'); d.dataset.c2='1';
    d.innerHTML='<summary>'+esc(title||'How this works')+'</summary><div class="c2-noteBody">'+sp.innerHTML+'</div>';
    sp.replaceWith(d);
   });
  }catch(e){}
 }

 /* ================= 2. events ================= */
 const byName=new Map(); EVENTS.forEach((ev,i)=>byName.set(ev.name,{ev,i}));

 function doEvents(){
  const p=document.getElementById('eventsPanel'); if(!p||p.style.display==='none')return;
  let s=null; try{s=S.fresh()||{};}catch(e){s={};}
  const wk=(s.weekly&&s.weekly.rib)||{}, rb=s.ribbons||{}, gold=s.ribbonGold||{}, tr=s.trophies||{};
  let h=null; try{h=(G.horse&&G.horse.ridden&&G.horse.ridden())||null;}catch(e){}
  const lvl=(h&&h.level)||1;

  p.querySelectorAll('.evrow').forEach(row=>{
   try{
    if(row.dataset.c2)return;
    const b=row.querySelector(':scope > b');
    const hit=b?byName.get(txt(b)):null;
    if(!hit){                                              // a block row (weekly, roundup, drills, footer)
     row.dataset.c2='blk'; row.classList.add('c2-blk');
     foldNote(row,b?'How this works':'About the courses');
     return;
    }
    const {ev}=hit, d=disc(ev);
    const spans=Array.from(row.querySelectorAll(':scope > span'));
    const badge=row.querySelector(':scope > .badge');
    const lock=spans.find(x=>/flex\s*:\s*none/.test(x.getAttribute('style')||''));
    const evBtns=Array.from(row.querySelectorAll('button[data-ev]'));
    const act=evBtns[0]||lock;
    const meta=spans.find(x=>x!==badge&&x!==lock&&!x.classList.contains('badge'));
    const extras=Array.from(row.children).filter(n=>n!==b&&n!==badge&&n!==meta&&n!==act&&evBtns.indexOf(n)<0);
    const isF=!!badge, won=!!tr[ev.id], ok=!lock;
    const wr=wk[ev.id]|0, r=rb[ev.id]|0, gd=!!gold[ev.id];
    const pb=best(ev,s), purse=isF?Math.round(ev.reward*1.5):ev.reward;

    /* spec grid: what it is, what it asks, what you have done here before */
    let sp=spec('Level','Lv '+ev.lvl,lvl>=ev.lvl?'good':'bad',
        '<span class="c2-k" style="letter-spacing:.02em;text-transform:none">you Lv '+lvl+'</span>');
    d.stats.forEach(k=>{
     const st=statOf(h,k), lbl=(STAT_LBL[k]||k);
     sp+=spec(lbl.replace(/^\S+\s/,''),st.at+' / '+st.cap,st.at>=st.cap?'good':'',
      '<span class="c2-reqBar"><i style="width:'+Math.max(4,Math.round(100*st.at/st.cap))+'%"></i></span>');
    });
    sp+=spec(ev.dressage?'Score to beat':'Time allowed',allowed(ev))
      +spec('Your best',pb||'—',pb?'':'dim');

    const main=el('div','c2-evMain');
    main.innerHTML='<div class="c2-evTop"><span class="c2-evDisc" aria-hidden="true">'+d.icon+'</span>'
      +'<span class="c2-evTitle">'+esc(ev.name)+'</span>'
      +(isF?'<span class="c2-evTag">Featured</span>':'')
      +(won?'<span class="c2-evTag won">🏆 Won</span>':'')+'</div>'
     +'<div class="c2-evWhere">📍 '+esc(ev.town)+' · '+d.label+' · '+d.detail+'</div>'
     +'<div class="c2-specs">'+sp+'</div>'
     +'<div class="c2-ribs">'+pips(r,gd)+'<span class="c2-k" style="letter-spacing:.02em;text-transform:none">'
       +'Ribbons '+Math.min(4,r)+'/4'+(isF?' · '+wr+'/4 this week':'')+'</span></div>';

    const actWrap=el('div','c2-evAct');
    if(act){
     if(act===lock){
      const inner=lock.innerHTML;
      const note=el('span','c2-lockNote'); note.innerHTML=inner||'🔒';
      lock.replaceWith(note); actWrap.appendChild(note);
      actWrap.appendChild(el('span','c2-purse','Unlocks at Lv '+ev.lvl));
     }else{
      evBtns.forEach((bt,bi)=>{
       if(evBtns.length===1)bt.textContent=won?'Ride again':'Enter';
       actWrap.appendChild(bt);
      });
      actWrap.appendChild(el('span','c2-purse','Purse '+purse+'🪙'+(isF?' ×1.5':'')));
     }
    }
    row.textContent='';
    row.className='evrow c2-ev'+(isF?' is-feat':'')+(ok?'':' is-lock')+(won&&ok?' is-won':'');
    row.dataset.c2='ev';
    row.appendChild(main);
    if(actWrap.childNodes.length)row.appendChild(actWrap);
    if(extras.length){const ex=el('div','c2-evExtra');extras.forEach(n=>ex.appendChild(n));row.appendChild(ex);}
    if(meta)meta.remove();
   }catch(e){try{row.dataset.c2='err';}catch(e2){}}
  });

  /* The panel is called Events, so the events come first — after the one block that is
     genuinely headline news (this week's ribbon count), and before the drills and the rules. */
  try{
   const first=p.querySelector('.evrow'); const host=first&&first.parentNode; if(!host)return;
   const kids=()=>Array.from(host.children);
   const evs=kids().filter(n=>n.dataset&&n.dataset.c2==='ev');
   if(!evs.length||!evs.some(n=>!n.dataset.c2ord))return;
   const week=kids().find(n=>n.dataset&&n.dataset.c2==='blk'&&/this week/i.test(txt(n.querySelector('b'))));
   const anchor=week?week.nextSibling:host.firstChild;
   let head=host.querySelector('.c2-sechead');
   if(!head){head=el('div','c2-sechead','🏇 Competition programme');head.dataset.c2='hd';}
   host.insertBefore(head,anchor);
   evs.forEach(n=>{n.dataset.c2ord='1';host.insertBefore(n,anchor);});
  }catch(e){}
 }

 /* ================= 3. leaderboards ================= */
 const RK=/^(👑|🥈|🥉|#\d+)$/u;
 function doBoards(){
  const p=document.getElementById('lbPanel'); if(!p||p.style.display==='none')return;
  p.querySelectorAll('.bList').forEach(list=>{
   try{
    if(list.dataset.c2)return;
    const ents=Array.from(list.querySelectorAll('.bE'));
    if(!ents.length){list.dataset.c2='0';return;}
    const wrap=el('div','c2-lb'); let lastRank=0;
    ents.forEach(e2=>{
     const t=txt(e2);
     const m=/^(\S+)\s+([\s\S]*?)\s+(\S+)$/.exec(t)||[null,'',t,''];
     let rank=m[1], name=m[2], val=m[3];
     if(!RK.test(rank)){rank='';name=t;val='';}
     const n=+String(rank).replace(/[^\d]/g,'')||(rank==='👑'?1:rank==='🥈'?2:rank==='🥉'?3:0);
     if(n&&lastRank&&n>lastRank+1)wrap.appendChild(el('div','c2-lbGap','···'));
     if(n)lastRank=n;
     const me=e2.classList.contains('me');
     const row=el('div','c2-lbRow'+(me?' me':'')+(e2.classList.contains('club')?' club':''));
     row.innerHTML='<span class="c2-lbRk">'+esc(rank||'—')+'</span>'
      +'<span class="c2-lbNm">'+esc(name)+(me&&!/^you$/i.test(name)?'<span class="c2-lbYou">YOU</span>':'')+'</span>'
      +'<span class="c2-lbV">'+esc(val)+'</span>';
     wrap.appendChild(row);
    });
    list.textContent=''; list.dataset.c2='1'; list.appendChild(wrap);
    list.style.display='block'; list.style.marginTop='0';
   }catch(e){try{list.dataset.c2='err';}catch(e2){}}
  });

  /* the Times sub-tab: "you: 61.2s · 👑 Rowan 55s" becomes two columns */
  p.querySelectorAll('.evrow').forEach(row=>{
   try{
    if(row.dataset.c2)return;
    const b=row.querySelector(':scope > b'), sp=row.querySelector(':scope > span');
    if(!b||!sp||row.querySelector('button')){row.dataset.c2='0';foldNote(row);return;}
    const t=txt(sp);
    const mine=/you:\s*([^·]+)/i.exec(t), top=/👑\s*([\s\S]*?)\s+(\S+)$/u.exec(t);
    if(!mine){row.dataset.c2='0';return;}
    const main=el('div','c2-evMain');
    main.innerHTML='<div class="c2-evTop"><span class="c2-evTitle">'+esc(txt(b))+'</span></div>'
     +'<div class="c2-specs" style="border-top:0;padding-top:0">'
     +spec('Your best',esc((mine[1]||'').trim()),/—/.test(mine[1])?'dim':'good')
     +(top?spec('👑 '+esc(top[1]),esc(top[2])):spec('Leader','—','dim'))+'</div>';
    row.textContent=''; row.className='evrow c2-ev'; row.dataset.c2='time'; row.appendChild(main);
   }catch(e){try{row.dataset.c2='err';}catch(e2){}}
  });
 }

 /* ================= 4. quests ================= */
 const NUM=/^\s*([\d.,]+k?)\s*\/\s*([\d.,]+k?)\s*$/i;
 function doQuests(){
  const p=document.getElementById('questPanel'); if(!p||p.style.display==='none')return;
  p.querySelectorAll('.qrow').forEach(row=>{
   try{
    if(row.dataset.c2)return;
    const ico=row.querySelector(':scope > .qico');
    const main=row.querySelector(':scope > .qmain');
    if(!main){row.dataset.c2='0';return;}
    const btn=row.querySelector(':scope > button');
    const kids=Array.from(row.children).filter(n=>n!==ico&&n!==main&&n!==btn);
    let num=null, rew=null, tick=false;
    kids.forEach(n=>{
     const t=txt(n);
     if(t==='✅'){tick=true;return;}
     if(!num&&NUM.test(t)){num=t;return;}
     if(!rew&&t)rew=n.innerHTML;
    });
    /* the bar lives inside .qmain; pull its width, then rebuild the copy stack */
    const bar=main.querySelector('.qbar'), fill=main.querySelector('.qfill');
    let pct=null;
    if(fill&&fill.style&&fill.style.width)pct=parseFloat(fill.style.width);
    if(bar)bar.remove();
    const strong=main.querySelector('b');
    const title=strong?strong.innerHTML:'';
    const restNodes=Array.from(main.childNodes).filter(n=>n!==strong);
    let head=title, desc='';
    if(strong){desc=restNodes.map(n=>n.nodeType===1?n.innerHTML:(n.nodeValue||'')).join(' ').trim();}
    else head=restNodes.map(n=>n.nodeType===1?n.innerHTML:(n.nodeValue||'')).join(' ').trim();

    const ready=!!btn, done=tick||row.classList.contains('claimed'),
          full=pct!=null?pct>=99.5:done;
    if(pct==null)pct=done?100:0;

    const stack=el('div','c2-qMain');
    stack.innerHTML='<span class="c2-qTitle">'+(head||'Quest')+'</span>'
     +(desc?'<span class="c2-qDesc">'+desc+'</span>':'')
     +'<div class="c2-qMeter"><span class="c2-qTrack"><i class="c2-qFill" style="width:'+Math.max(0,Math.min(100,pct))+'%"></i></span>'
     +'<span class="c2-qNum">'+esc(num||(full?'complete':''))+'</span></div>'
     +(rew?'<div class="c2-qRew"><span class="c2-rewTag">Reward</span><span class="c2-rewVal">'+rew+'</span></div>':'');

    const end=el('div','c2-qEnd');
    if(btn){btn.textContent='Claim';end.appendChild(btn);}
    else end.appendChild(el('span','c2-state'+(done?' done':''),done?'✅ Claimed':full?'Complete':'Active'));

    row.textContent='';
    row.className='qrow c2-q '+(ready?'st-ready':done?'st-done':full?'st-full':'st-open');
    row.dataset.c2='q';
    if(ico)row.appendChild(ico); else row.appendChild(el('span','qico','📋'));
    row.appendChild(stack); row.appendChild(end);
   }catch(e){try{row.dataset.c2='err';}catch(e2){}}
  });
 }

 /* ================= 5. run it ================= */
 let pending=0;
 function pass(){
  pending=0;
  try{doEvents();}catch(e){}
  try{doBoards();}catch(e){}
  try{doQuests();}catch(e){}
 }
 function soon(){ if(pending)return; pending=requestAnimationFrame(pass); }

 try{
  for(const name of ['openEvents','openQuests','renderQuests','openLB','renderLB','open','toggle','rerender']){
   const fn=G.ui&&G.ui[name]; if(typeof fn!=='function')continue;
   G.ui[name]=function(...a){const r=fn.apply(this,a);soon();return r;};
  }
 }catch(e){}
 try{
  const obs=new MutationObserver(ms=>{for(const m of ms){if(m.addedNodes&&m.addedNodes.length){soon();return;}}});
  const watch=()=>{for(const idn of ['eventsPanel','questPanel','lbPanel']){
   const p=document.getElementById(idn); if(p)try{obs.observe(p,{childList:true,subtree:true});}catch(e){}}};
  watch(); G.on('boot',()=>{watch();soon();}); setTimeout(watch,4000);
 }catch(e){}
 soon();
}

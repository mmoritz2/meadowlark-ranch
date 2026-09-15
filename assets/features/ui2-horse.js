/* Feature package 'ui2-horse' — the horse screens: care and stable.

   The care panel used to open with three paragraphs of rules before the player reached a
   single control, and it drew the horse as a 🐴.  This package rebuilds it around the animal:
   a real breed portrait at portrait size, name / level / rarity as identity, the four needs as
   labelled meters that carry their value, the five stats drawn against the breed ceiling, the
   care actions as one action row, and every rule sentence folded into a "How care works" note.

   It cannot edit the inline renderer (renderCare / renderStable live in ranch3d.html and other
   packages splice sections into them), so it works the way a good CSS-and-DOM pass works: it
   watches the panel, and the moment the inline renderer has written its markup it RESTRUCTURES
   the result.  Nodes are MOVED, never re-created, so every onclick the renderer just bound —
   careAct, data-st, data-fx — keeps working untouched.  Anything it does not recognise is kept
   and shown below the fold rather than thrown away, so a package that adds a care section in
   the future still appears. */
export const id='ui2-horse';
export function install(G){
 const T=G.tables||{}, K=()=>(G.ui&&G.ui.k)||null;
 const $=id=>document.getElementById(id);
 const esc=v=>String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
 const clamp=(v,a,b)=>v<a?a:v>b?b:v;

 /* ---------------------------------------------------------------- 1. stylesheet */
 try{
  if(!$('ui2HorseCss')){
   const st=document.createElement('style'); st.id='ui2HorseCss';
   st.textContent=`
#carePanel .ui2-hero{display:flex;gap:var(--sp-3);align-items:flex-start;padding:var(--sp-3);
 border:1px solid var(--line);border-radius:var(--r);background:var(--paper-raised);box-shadow:var(--e0);
 border-left:5px solid var(--rarity)}
#carePanel .ui2-port{position:relative;flex:none;width:112px;height:112px;border-radius:var(--r-s);overflow:hidden;
 background:#fff;box-shadow:inset 0 0 0 2px #fff,0 2px 8px rgba(50,32,10,.18);
 display:flex;align-items:center;justify-content:center;font-size:56px;line-height:1}
#carePanel .ui2-port .mk-thumb{width:100%!important;height:100%!important;min-width:0!important;min-height:0!important;
 border-radius:var(--r-s);box-shadow:none;background:#fff;--mk-thumb:112px}
#carePanel .ui2-port img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
#carePanel .ui2-id{flex:1;min-width:0;display:flex;flex-direction:column;gap:5px}
#carePanel .ui2-name{font-family:var(--display);font-size:var(--fs-2xl);line-height:1.1;color:var(--ink);
 overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#carePanel .ui2-sub{display:flex;flex-wrap:wrap;gap:5px;align-items:center}
.ui2-chip{display:inline-flex;align-items:center;gap:4px;font-size:var(--fs-xs);font-weight:800;
 padding:2px 8px;border-radius:var(--r-full);background:var(--paper-2);color:var(--ink-2);
 border:1px solid var(--line);font-variant-numeric:tabular-nums;white-space:nowrap}
.ui2-chip.rar{background:color-mix(in srgb,var(--rarity) 16%,#fff);border-color:color-mix(in srgb,var(--rarity) 45%,#fff);
 color:color-mix(in srgb,var(--rarity) 72%,#3b2a1e)}
#carePanel .ui2-bond{display:flex;align-items:center;gap:6px;font-size:var(--fs-sm);color:var(--ink-2);font-weight:700}
#carePanel .ui2-bond .h{font-size:13px;letter-spacing:1px}
#carePanel .ui2-xp{display:flex;align-items:center;gap:var(--sp-2);font-size:var(--fs-xs);color:var(--ink-2);font-weight:700}
#carePanel .ui2-xp .cbar{flex:1;height:8px}
.ui2-sec{display:flex;align-items:center;gap:var(--sp-2);margin:var(--sp-3) 0 2px;
 font-family:var(--display);font-size:var(--fs-md);color:var(--ink);letter-spacing:.01em}
.ui2-sec:after{content:"";flex:1;height:1px;background:var(--line)}
.ui2-sec .hint{font-family:var(--font);font-size:var(--fs-xs);font-weight:700;color:var(--ink-3)}
#carePanel .ui2-needs{display:grid;grid-template-columns:1fr 1fr;gap:var(--sp-2) var(--sp-3)}
#carePanel .ui2-meter{display:grid;grid-template-columns:1fr auto;gap:2px var(--sp-2);align-items:center}
#carePanel .ui2-meter .k{font-size:var(--fs-xs);font-weight:800;color:var(--ink-2)}
#carePanel .ui2-meter .v{font-size:var(--fs-xs);font-weight:800;font-variant-numeric:tabular-nums;color:var(--ink-2)}
#carePanel .ui2-meter .trk{grid-column:1/3;position:relative;height:9px;border-radius:var(--r-full);
 background:rgba(59,42,30,.1);overflow:hidden;box-shadow:inset 0 1px 2px rgba(50,32,10,.1)}
#carePanel .ui2-meter .trk i{display:block;height:100%;border-radius:var(--r-full);transition:width .3s}
#carePanel .ui2-meter.good .v{color:var(--good)}
#carePanel .ui2-meter.warn .v{color:var(--warn)}
#carePanel .ui2-meter.crit .v{color:var(--bad)}
#carePanel .ui2-stat{display:grid;grid-template-columns:94px 1fr 58px;gap:var(--sp-2);align-items:center;min-height:26px}
#carePanel .ui2-stat .k{font-size:var(--fs-xs);font-weight:800;color:var(--ink-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#carePanel .ui2-stat .trk{position:relative;height:10px;border-radius:var(--r-full);background:rgba(59,42,30,.09);
 overflow:hidden;box-shadow:inset 0 1px 2px rgba(50,32,10,.1)}
#carePanel .ui2-stat .trk .locked{position:absolute;top:0;bottom:0;right:0;background:repeating-linear-gradient(135deg,rgba(59,42,30,.16) 0 3px,rgba(59,42,30,.06) 3px 6px)}
#carePanel .ui2-stat .trk .fill{position:absolute;top:0;bottom:0;left:0;border-radius:var(--r-full);
 background:linear-gradient(90deg,var(--leather),#b98d54)}
#carePanel .ui2-stat .trk .tick{position:absolute;top:-1px;bottom:-1px;width:2px;background:var(--brass-2);opacity:.85}
#carePanel .ui2-stat .n{font-size:var(--fs-sm);font-weight:800;text-align:right;font-variant-numeric:tabular-nums;color:var(--ink)}
#carePanel .ui2-stat .n small{color:var(--ink-3);font-weight:700;font-size:var(--fs-xs)}
#carePanel .ui2-stat.max .trk .fill{background:linear-gradient(90deg,var(--brass-2),var(--brass))}
#carePanel .ui2-acts{display:flex;flex-wrap:wrap;gap:6px}
#carePanel .ui2-acts button{display:inline-flex;align-items:center;gap:6px;min-height:42px;padding:6px 12px;
 border-radius:var(--r-s);font-weight:800;font-size:var(--fs-sm)}
#carePanel .ui2-acts button .n{font-variant-numeric:tabular-nums;color:var(--ink-3);font-weight:800}
#carePanel .ui2-acts button.hero{background:linear-gradient(180deg,#fff5df,#f3dfb2);border-color:var(--line-2)}
#carePanel .ui2-mini{display:flex;flex-wrap:wrap;gap:5px;align-items:center}
#carePanel .ui2-mini .lbl{font-size:var(--fs-xs);font-weight:800;color:var(--ink-3);min-width:0}
#carePanel .ui2-extras{display:flex;flex-direction:column;gap:6px}
#carePanel .ui2-extras .crow{flex-wrap:wrap}
#carePanel details.ui2-note{border:1px solid var(--line);border-radius:var(--r-s);background:var(--paper-2);padding:0}
#carePanel details.ui2-note>summary{cursor:pointer;list-style:none;padding:9px 12px;font-weight:800;
 font-size:var(--fs-sm);color:var(--ink-2)}
#carePanel details.ui2-note>summary::-webkit-details-marker{display:none}
#carePanel details.ui2-note>summary:before{content:"▸ ";color:var(--ink-3)}
#carePanel details.ui2-note[open]>summary:before{content:"▾ "}
#carePanel details.ui2-note .bd{padding:0 12px 10px;font-size:var(--fs-xs);line-height:var(--lh);color:var(--ink-2);
 display:flex;flex-direction:column;gap:5px}
#carePanel .ui2-headline{display:flex;align-items:center;gap:var(--sp-2);width:100%}
#carePanel .ui2-headline .grow{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#carePanel .ui2-headline button{flex:none;min-height:38px;padding:6px 11px;font-size:var(--fs-sm)}

/* ---- stable rows ---- */
#stablePanel .evrow.ui2-srow{display:flex;flex-wrap:nowrap;align-items:flex-start;gap:var(--sp-3);
 border-left:4px solid var(--rarity);padding-left:10px}
#stablePanel .ui2-srow .ui2-smeta{row-gap:4px}
#stablePanel .ui2-srow .ui2-sport{flex:none;width:52px;height:52px;border-radius:14px;overflow:hidden;position:relative;
 background:var(--paper-3);display:flex;align-items:center;justify-content:center;font-size:26px;
 box-shadow:0 0 0 2px #fff,0 0 0 4px color-mix(in srgb,var(--rarity) 60%,#fff),0 2px 6px rgba(50,32,10,.2)}
#stablePanel .ui2-srow .ui2-sport .mk-thumb{width:100%!important;height:100%!important;min-width:0!important;
 min-height:0!important;border-radius:14px;box-shadow:none;--mk-thumb:52px}
#stablePanel .ui2-srow .ui2-sport img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
#stablePanel .ui2-srow .ui2-scopy{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:3px}
#stablePanel .ui2-srow .ui2-smeta>*{flex:0 0 auto!important;max-width:100%;min-width:0}
#stablePanel .ui2-srow .ui2-sname>*{flex:0 0 auto!important}
#stablePanel .ui2-srow .ui2-chip{font-size:10.5px;padding:2px 7px}
#stablePanel .ui2-srow .ui2-sname{display:flex;align-items:center;gap:5px;flex-wrap:nowrap;overflow:hidden}
#stablePanel .ui2-srow .ui2-sname b{font-size:var(--fs-lg);font-family:var(--display);font-weight:600;
 overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#stablePanel .ui2-srow .ui2-smeta{display:flex;align-items:center;gap:6px;flex-wrap:wrap;
 font-size:var(--fs-xs);color:var(--ink-2);font-weight:700}
#stablePanel .ui2-srow .ui2-sact{flex:none;display:flex;align-items:center;gap:5px;margin-left:auto;
 align-self:center}
#stablePanel .ui2-srow .ui2-sact button{min-height:38px;padding:6px 10px;font-size:var(--fs-xs);white-space:nowrap}
#stablePanel .ui2-srow .ui2-sact button.icon{padding:6px 9px}
@media(max-width:560px){
 #carePanel .ui2-port{width:88px;height:88px;font-size:44px}
 #carePanel .ui2-port .mk-thumb{--mk-thumb:88px}
 #carePanel .ui2-name{font-size:var(--fs-xl)}
 #carePanel .ui2-needs{grid-template-columns:1fr}
 #carePanel .ui2-stat{grid-template-columns:84px 1fr 54px}
 #stablePanel .evrow.ui2-srow{flex-wrap:wrap;row-gap:var(--sp-2)}
 #stablePanel .ui2-srow .ui2-sact{width:100%;margin-left:0;flex-wrap:wrap}
}
@media(prefers-reduced-motion:reduce){#carePanel .ui2-meter .trk i,#carePanel .ui2-stat .trk .fill{transition:none}}
`;
   (document.head||document.documentElement).appendChild(st);
  }
 }catch(e){}

 /* ---------------------------------------------------------------- 2. small helpers */
 const RARCOL={common:'--rar-common',uncommon:'--rar-uncommon',rare:'--rar-rare',epic:'--rar-epic',
  legendary:'--rar-legendary',mythic:'--rar-mythic'};
 function breedRow(key){try{return (T.BREEDS3||[]).find(b=>b[0]===key)||null;}catch(e){return null;}}
 function rarityOf(h){
  const b=breedRow(h&&h.breed);
  let r=b&&b[2]; if(h&&(h.horn||h.wings||h.dragon))r=r||'Mythic';
  const k=(G.ui&&G.ui.k&&G.ui.k.rarity)?G.ui.k.rarity(r):String(r||'common').toLowerCase();
  return {key:k,label:String(r||'Common'),css:'var('+(RARCOL[k]||'--rar-common')+')'};
 }
 function glyphOf(h){return h&&h.horn?'🦄':h&&h.wings?'🪽':h&&h.dragon?'🐉':h&&h.foal?'🐎':'🐴';}
 function portraitHtml(h,size){
  const r=rarityOf(h), k=K();
  if(k&&k.thumb)return k.thumb(h&&h.breed,{size,rarity:r.key,emoji:glyphOf(h),alt:(h&&h.name)||''});
  return '<span>'+glyphOf(h)+'</span>';
 }
 const NEEDS=[['hunger','🥕 Fed','#e8943a'],['thirst','💧 Water','#4fa8e0'],
              ['clean','🧼 Clean','#9b8cf0'],['happy','😊 Happy','#6bc46d']];
 function needState(v){return v>=60?'good':v>=35?'warn':'crit';}
 function meter(label,val,col){
  const v=clamp(Math.round(+val||0),0,100), st=needState(v);
  const fill=st==='crit'?'var(--bad)':st==='warn'?'var(--warn)':col;
  return '<div class="ui2-meter '+st+'"><span class="k">'+label+'</span><span class="v">'+v+' / 100</span>'
   +'<span class="trk"><i style="width:'+v+'%;background:'+fill+'"></i></span></div>';
 }

 /* ---------------------------------------------------------------- 3. the care panel */
 const CARE_MARK='ui2CareHero';
 function classify(v){
  if(!v)return 'other';
  if(/^em:/.test(v))return 'trick';
  if(/^(tail|stud|trail|bare):/.test(v))return 'look';
  if(v==='close')return 'close';
  if(v==='rename')return 'rename';
  if(v==='water'||v==='groom'||v==='pet')return 'act';
  if((T.FOODS3||{})[v])return 'food';
  return 'act';
 }
 function rebuildCare(){
  const p=$('carePanel'); if(!p||p.querySelector('#'+CARE_MARK))return;
  if(!p.querySelector('[data-care]'))return;                       // not rendered yet
  let s=null,h=null;
  try{s=G.save.fresh(); h=s&&s.horses[G.horse.rideIdx()];}catch(e){}
  if(!s||!h)return;

  /* --- harvest the renderer's own nodes (moved, never rebuilt, so handlers survive) --- */
  const host=p.querySelector(':scope > .mk-panel-body')||p;
  const kids=Array.from(host.children);
  const buckets={food:[],act:[],trick:[],look:[],close:[],rename:[]};
  const keep=[], prose=[];
  const NEEDLBL=new Set(NEEDS.map(n=>n[1].slice(n[1].indexOf(' ')+1)));
  const STATLBL=new Set(Object.values(T.STAT_LBL||{}));
  kids.forEach((el,i)=>{
   try{
    if(i===0&&el.tagName==='B')return;                             // the old title line
    const cares=el.querySelectorAll?el.querySelectorAll('[data-care]'):[];
    if(cares.length){
     cares.forEach(b=>{const c=classify(b.dataset.care);(buckets[c]||buckets.act).push(b);});
     if(el.classList&&el.classList.contains('crow')&&!el.querySelector('.cbar'))return; // shell, drop
    }
    if(el.classList&&el.classList.contains('crow')){
     const lbl=(el.querySelector('.lbl')||{}).textContent||'';
     const t=lbl.trim();
     if(t==='✨ XP'||NEEDLBL.has(t.slice(t.indexOf(' ')+1))||STATLBL.has(t)||/^[🥕💧🧼😊]/u.test(t))return;
    }
    const txt=(el.textContent||'').trim();
    if(/^Stats · level cap/.test(txt))return;
    if(!el.querySelector||(!el.querySelector('button,input,select,a')&&txt.length>54)){prose.push(el);return;}
    if(txt||el.children.length)keep.push(el);
   }catch(e){}
  });

  /* --- numbers --- */
  const rar=rarityOf(h);
  const lvl=h.level||1, xpCap=50+lvl*50, xp=Math.round(h.xp||0);
  const bond=clamp(Math.round(h.bond||0),0,100), hearts=clamp(Math.round(bond/20),0,5);
  let statHtml='';
  try{
   G.xp.ensureStats(h);
   const lc=G.xp.statCap(h);
   statHtml=(T.STAT_KEYS||[]).map(k=>{
    const v=h.stats[k]|0, bc=G.xp.statCeil(h,k), cap=Math.min(lc,bc);
    const need=G.xp.statNeed(v), prog=v>=cap?1:clamp((h.sxp&&h.sxp[k]||0)/(need||1),0,1);
    const prog2=v>=cap?0:prog;
    const fill=100*Math.min(v+prog2,bc)/bc;
    const ttl=v>=cap?(v>=bc?'At the breed ceiling ('+bc+')':'Capped at Lv '+lvl+' · breed ceiling '+bc)
                    :((h.sxp&&h.sxp[k]||0)+' / '+need+' XP to '+(v+1)+' · breed ceiling '+bc);
    return '<div class="ui2-stat'+(v>=cap?' max':'')+'" title="'+esc(ttl)+'">'
     +'<span class="k">'+esc((T.STAT_LBL||{})[k]||k)+'</span>'
     +'<span class="trk">'+(cap<bc?'<i class="locked" style="width:'+(100*(bc-cap)/bc).toFixed(1)+'%"></i>':'')
       +'<i class="fill" style="width:'+fill.toFixed(1)+'%"></i>'
       +(cap<bc?'<i class="tick" style="left:calc('+(100*cap/bc).toFixed(1)+'% - 1px)"></i>':'')+'</span>'
     +'<span class="n">'+v+'<small>/'+bc+'</small></span></div>';
   }).join('');
   var capNote='Each bar runs to this breed\u2019s ceiling. The tick is your Lv '+lvl+' cap of '+lc
     +(lc<10?' — it rises at Lv '+(Math.floor(lvl/5)+1)*5:'')+'; the hatched tail is still locked.';
  }catch(e){statHtml='';var capNote='';}

  /* --- write the new shell --- */
  const head=document.createElement('b');
  head.innerHTML='<span class="ui2-headline"><span class="grow">🐎 '+esc(h.name)+'</span></span>';
  const hero=document.createElement('div');
  hero.id=CARE_MARK; hero.className='ui2-hero'; hero.style.setProperty('--rarity',rar.css);
  hero.innerHTML='<div class="ui2-port">'+portraitHtml(h,112)+'</div>'
   +'<div class="ui2-id">'
   +'<div class="ui2-name">'+esc(h.name)+'</div>'
   +'<div class="ui2-sub"><span class="ui2-chip">Lv '+lvl+'</span>'
     +'<span class="ui2-chip rar">'+esc(rar.label)+'</span>'
     +'<span class="ui2-chip">'+esc((G.horse.breedLabel?G.horse.breedLabel(h.breed):h.breed)||'')+'</span>'
     +(h.foal?'<span class="ui2-chip">🌱 Foal</span>':'')+'</div>'
   +'<div class="ui2-bond"><span class="h">'+'❤️'.repeat(hearts)+'🤍'.repeat(5-hearts)+'</span>'
     +'<span>Bond '+bond+' / 100</span></div>'
   +'<div class="ui2-xp"><span>✨ XP</span><div class="cbar"><div class="cfill" style="width:'
     +clamp(Math.round(100*xp/xpCap),0,100)+'%"></div></div><span>'+xp+' / '+xpCap+'</span></div>'
   +'</div>';

  const frag=document.createDocumentFragment();
  const mk=(cls,html)=>{const d=document.createElement('div');d.className=cls;if(html!=null)d.innerHTML=html;return d;};
  frag.appendChild(hero);

  frag.appendChild(mk('ui2-sec','<span>Needs</span><span class="hint">now / full</span>'));
  frag.appendChild(mk('ui2-needs',NEEDS.map(n=>meter(n[1],(h.needs||{})[n[0]],n[2])).join('')));

  if(statHtml){
   frag.appendChild(mk('ui2-sec','<span>Stats</span>'));
   const box=mk('',statHtml); box.className='ui2-stats'; frag.appendChild(box);
   if(capNote){const cn=mk('');cn.style.cssText='font-size:var(--fs-xs);color:var(--ink-3);font-weight:700';
    cn.textContent=capNote;frag.appendChild(cn);}
  }

  /* the action row — the renderer's own buttons, relabelled */
  const acts=mk('ui2-acts');
  buckets.food.forEach(b=>{
   const k=b.dataset.care, f=(T.FOODS3||{})[k]||{}, n=(s.items&&s.items[k])|0;
   b.innerHTML='<span>'+(f.emoji||'🥕')+'</span><span>'+esc(f.label||k)+'</span><span class="n">×'+n+'</span>';
   if(!b.title)b.title=(f.label||k)+(f.stat?' · trains '+((T.STAT_LBL||{})[f.stat]||f.stat):'');
   if(n<=0)b.style.opacity='.55';
   acts.appendChild(b);
  });
  const ACTLBL={water:['💧','Water'],groom:['🧼','Groom'],pet:['💗','Pet']};
  buckets.act.forEach(b=>{
   const a=ACTLBL[b.dataset.care];
   if(a)b.innerHTML='<span>'+a[0]+'</span><span>'+a[1]+'</span>';
   b.classList.add('hero');
   acts.appendChild(b);
  });
  if(acts.children.length){
   frag.appendChild(mk('ui2-sec','<span>Care</span><span class="hint">builds bond and XP</span>'));
   frag.appendChild(acts);
  }

  if(buckets.trick.length){
   frag.appendChild(mk('ui2-sec','<span>Tricks</span><span class="hint">keys 1–5 at a halt</span>'));
   const row=mk('ui2-mini'); buckets.trick.forEach(b=>row.appendChild(b)); frag.appendChild(row);
  }
  if(buckets.look.length){
   frag.appendChild(mk('ui2-sec','<span>Looks</span>'));
   const row=mk('ui2-mini'); buckets.look.forEach(b=>row.appendChild(b)); frag.appendChild(row);
  }
  if(keep.length){
   const box=mk('ui2-extras'); keep.forEach(el=>box.appendChild(el)); frag.appendChild(box);
  }
  if(prose.length){
   const d=document.createElement('details'); d.className='ui2-note';
   d.innerHTML='<summary>How care works</summary>';
   const bd=mk('bd'); prose.forEach(el=>bd.appendChild(el)); d.appendChild(bd); frag.appendChild(d);
  }

  /* rename and close ride in the header, where a panel's chrome belongs */
  const line=head.querySelector('.ui2-headline');
  buckets.rename.forEach(b=>{b.textContent='✏️ Rename';line.appendChild(b);});
  buckets.close.forEach(b=>{b.textContent='✖';b.title='Close';line.appendChild(b);});

  try{
   p.innerHTML='';
   p.appendChild(head);
   p.appendChild(frag);
   if(G.ui&&G.ui.bindFx)G.ui.bindFx(p);
  }catch(e){}
 }

 /* ---------------------------------------------------------------- 4. stable rows */
 function rebuildStable(){
  const p=$('stablePanel'); if(!p)return;
  let s=null; try{s=G.save.fresh();}catch(e){}
  if(!s)return;
  const horses=s.horses||[], ride=G.horse.rideIdx();
  p.querySelectorAll('.evrow').forEach(row=>{
   try{
    if(row.dataset.ui2==='1')return;
    const st=row.querySelector('[data-st]');
    const m=st&&/:(\d+)$/.exec(st.dataset.st||'');
    if(!m){row.dataset.ui2='1';return;}                       // the adopt row and the pet rows stay as they are
    const i=+m[1], h=horses[i]; if(!h){row.dataset.ui2='1';return;}
    const rar=rarityOf(h);
    row.classList.add('ui2-srow'); row.style.setProperty('--rarity',rar.css);

    /* portrait: replace the coloured disc (or the kit's small thumb) with a ringed painting */
    const port=document.createElement('span'); port.className='ui2-sport';
    port.innerHTML=portraitHtml(h,52);
    const first=row.firstElementChild;
    if(first&&(first.classList.contains('mk-thumb')||(first.tagName==='SPAN'&&!first.querySelector('button'))))
     first.replaceWith(port);
    else row.insertBefore(port,row.firstChild);

    /* copy column: the name line and a meta line, built from the row's own nodes */
    const copy=document.createElement('div'); copy.className='ui2-scopy';
    const nameLine=document.createElement('div'); nameLine.className='ui2-sname';
    const meta=document.createElement('div'); meta.className='ui2-smeta';
    const acts=document.createElement('div'); acts.className='ui2-sact';
    Array.from(row.childNodes).forEach(n=>{
     if(n===port)return;
     if(n.nodeType===1&&n.tagName==='BUTTON'){acts.appendChild(n);return;}
     if(n.nodeType===1&&(n.tagName==='B'||(n.classList&&n.classList.contains('badge')))){nameLine.appendChild(n);return;}
     if(n.nodeType===3&&!(n.nodeValue||'').trim()){n.remove();return;}
     meta.appendChild(n);
    });
    /* the meta line reads as chips, not a sentence */
    const bond=clamp(Math.round(h.bond||0),0,100), hearts=clamp(Math.round(bond/20),0,5);
    const low=h.needs&&Object.values(h.needs).some(v=>v<35);
    meta.querySelectorAll('span').forEach(sp=>{
     const t=(sp.textContent||'').trim();
     if(!t){sp.remove();return;}
     sp.className='ui2-chip'; sp.textContent=t.replace(/^[·•]\s*/,'').replace(/\s+/g,' ');
    });
    meta.insertBefore(Object.assign(document.createElement('span'),
      {className:'ui2-chip rar',textContent:rar.label}),meta.firstChild);
    const saysBond=/bond/i.test(meta.textContent||'');
    if(!saysBond)meta.appendChild(Object.assign(document.createElement('span'),
      {className:'ui2-chip',textContent:'❤️ '+bond+' bond'}));
    if(low)meta.appendChild(Object.assign(document.createElement('span'),
      {className:'ui2-chip',textContent:'⚠️ needs care'}));
    copy.appendChild(nameLine); copy.appendChild(meta);
    row.appendChild(copy); row.appendChild(acts);
    /* the right-hand action: one clear primary, the rest quiet */
    acts.querySelectorAll('button').forEach(b=>{
     const k=(b.dataset.st||'').split(':')[0];
     if(k==='rn'){b.classList.add('icon');b.textContent='✏️';b.title='Rename';}
     if(k==='ride')b.className='claimBtn';
    });
    if(i===ride&&!nameLine.querySelector('.badge')){
     const bg=document.createElement('span'); bg.className='badge'; bg.textContent='RIDING';
     nameLine.appendChild(bg);
    }
    row.dataset.ui2='1';
   }catch(e){try{row.dataset.ui2='1';}catch(e2){}}
  });
 }

 /* ---------------------------------------------------------------- 5. keep it applied */
 let q=0;
 function soon(){
  if(q)return;
  q=requestAnimationFrame(()=>{q=0;try{rebuildCare();}catch(e){}try{rebuildStable();}catch(e){}});
 }
 try{
  for(const name of ['openCare','renderCare','openStable','renderStable','open','toggle','rerender']){
   const fn=G.ui[name]; if(typeof fn!=='function')continue;
   G.ui[name]=function(...a){const r=fn.apply(this,a);soon();return r;};
  }
 }catch(e){}
 try{
  const obs=new MutationObserver(()=>soon());
  const watch=()=>{for(const id of ['carePanel','stablePanel']){const p=$(id);if(p)obs.observe(p,{childList:true});}};
  watch(); G.on('boot',()=>{watch();soon();}); setTimeout(watch,3000);
 }catch(e){}
 G.on('careDone',()=>soon());
 soon();
}

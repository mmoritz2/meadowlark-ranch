/* Feature package 'uikit' — the runtime half of the Meadowlark interface kit.
   The design lead owns the .mk-* stylesheet in ranch3d.html; this file owns everything that
   has to happen at runtime, and it touches no other file.  Three jobs:

   1. PORTRAITS.  assets/breed-thumbnails/ holds 47 .webp paintings and an index.json of the
      keys.  Until now only breeds.html used them and every horse in every list was the same
      🐴.  G.ui.k.thumb(breedKey,{size,rarity}) resolves a breed key to its portrait — exact
      key, then an alias, then a prefix/token match — and returns markup with loading="lazy",
      a rarity ring class and the emoji painted underneath, so a missing file degrades to the
      old glyph instead of a broken image.  It never throws: an unknown breed, a null key or
      an index that failed to load all come back as the emoji.

   2. RENDERERS.  G.ui.k.row/chip/bar/tabs/btn/empty/note return HTML strings built from the
      agreed .mk-* component classes, so panels stop hand-rolling inline styles.  They are
      string builders on purpose — every existing renderer concatenates html.

   3. UPGRADE PASS.  A defensive DOM sweep (install, after every panel render, and on any
      panel mutation) that improves panels nobody has rewritten yet: it gives each panel a
      .mk-panel-head / .mk-panel-body pair so the CSS chrome can scroll the body, and swaps
      the leading 🐴 in a horse row for the real portrait wherever a breed key is discoverable
      from the row's own data attributes (data-buyh → BREEDS3, data-st/data-mktsell → the
      save's horses).  Every step is wrapped: a panel that does not match is left alone. */
export const id='uikit';
export function install(G){
 const S=G.save, T=G.tables||{};
 const DIR='assets/breed-thumbnails/', VER='?v=artist-breeds-1';
 const EMOJI_FALLBACK='🐴';

 /* ================= 0. baseline css =================
    The design lead's stylesheet is the authority on every .mk-* class.  These rules exist
    only so the kit is not naked if it renders before that CSS lands; :where() gives them
    zero specificity, so any real rule — theirs or an author's — wins without !important. */
 try{
  if(!document.getElementById('mkKitBase')){
   const st=document.createElement('style'); st.id='mkKitBase';
   st.textContent=
    ':where(.mk-panel-body){display:flex;flex-direction:column;gap:8px;min-height:0;flex:1 1 auto;overflow:auto}'+
    /* A scrolling body is a flex COLUMN, so by default every child may be compressed toward
       its minimum height before the body agrees to scroll. That is how a row of trail-ride
       stops 140px tall was squashed into its 30px min-height and spilled over the controls
       beneath it, and how the summon banners collapsed. Nothing in a panel body shrinks. */
    '.mk-panel-body>*{flex-shrink:0}'
   +':where(.mk-panel-head){flex:0 0 auto}'
   +':where(.mk-thumb){position:relative;flex:none;display:inline-flex;align-items:center;justify-content:center;'
     +'width:var(--mk-thumb,40px);height:var(--mk-thumb,40px);border-radius:12px;overflow:hidden;'
     +'background:#e9dfc9;font-size:calc(var(--mk-thumb,40px)*.55);line-height:1;box-shadow:0 1px 3px rgba(50,32,10,.18)}'
   +':where(.mk-thumb-img){position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}'
   +':where(.mk-row){display:flex;align-items:center;gap:9px}'
   +':where(.mk-row-copy){display:grid;gap:1px;flex:1;min-width:0}'
   +':where(.mk-row-trail){display:flex;align-items:center;gap:6px;flex:none;margin-left:auto}'
   +':where(.mk-bar-track){display:block;height:8px;border-radius:99px;background:#e5dcc7;overflow:hidden}'
   +':where(.mk-bar-fill){display:block;height:100%;background:#8a6a3a}'
   +':where(.mk-tabs){display:flex;gap:6px;overflow-x:auto}';
   (document.head||document.documentElement).appendChild(st);
  }
 }catch(e){}

 /* ================= 1. helpers ================= */
 const esc=v=>String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
 const slug=v=>String(v==null?'':v).trim().toLowerCase().replace(/[\s_]+/g,'-').replace(/[^a-z0-9-]/g,'');
 const clamp=(v,a,b)=>v<a?a:v>b?b:v;

 /* The rarity ramp, one name per class.  Anything the game calls a tier lands on one of
    these six so a ring colour never depends on the exact spelling of a table cell. */
 const RAR={common:'common',uncommon:'uncommon',rare:'rare',epic:'epic',legendary:'legendary',mythic:'mythic',
  draft:'uncommon',light:'common',pony:'common',sport:'rare',gaited:'rare',exotic:'epic',
  dragon:'mythic',fantasy:'mythic',myth:'mythic',unique:'legendary',hero:'legendary',special:'epic'};
 const rarKey=v=>RAR[slug(v)]||(slug(v)?'common':'common');

 /* Breed keys the game uses that are spelled differently in the thumbnail set, plus the
    common long forms a caller might hand us. */
 const ALIAS={thoroughbred:'thoro',thorobred:'thoro',clydesdale:'clyde',gypsy:'vanner','gypsy-vanner':'vanner',
  'akhal-teke':'akhal',lipizzaner:'lipiz','icelandic':'iceland','icelandic-horse':'iceland',
  'quarter-horse':'stock','shetland':'chestnut','shetland-pony':'chestnut','sport-horse':'sport',
  'bay-sport':'bay-sporthorse','starter':'bay-sporthorse','hero':'bay-sporthorse',
  unicorn3:'unicorn',pegasus3:'pegasus','dapple-grey':'grey','grey-andalusian':'grey'};

 let KEYS=null;                       // Set of index.json keys, or null until it loads
 const CACHE=new Map();               // resolved breed key -> file key | '' (known-missing)

 function resolve(key){
  const k=slug(key); if(!k)return '';
  if(CACHE.has(k))return CACHE.get(k);
  let hit='';
  if(!KEYS)hit=ALIAS[k]||k;                                    // optimistic before the index lands
  else if(KEYS.has(k))hit=k;
  else if(ALIAS[k]&&KEYS.has(ALIAS[k]))hit=ALIAS[k];
  else{
   let best='';
   for(const c of KEYS){                                       // prefix either way, longest wins
    if((k.startsWith(c)||c.startsWith(k))&&c.length>best.length)best=c;
   }
   if(!best){const head=k.split('-')[0];if(head&&KEYS.has(head))best=head;}
   hit=best;
  }
  if(KEYS)CACHE.set(k,hit);                                    // only cache once the index is truth
  return hit;
 }

 /* index.json once, then repaint whatever is already on screen. */
 try{
  fetch(DIR+'index.json',{cache:'force-cache'}).then(r=>r.json()).then(list=>{
   if(Array.isArray(list)){KEYS=new Set(list.map(slug));CACHE.clear();sweepSoon();}
  }).catch(()=>{});
 }catch(e){}

 /* ================= 2. the kit ================= */
 const K={
  rarity:rarKey,
  /* A breed portrait. Never throws; an unknown breed is the emoji in a rarity ring. */
  thumb(breedKey,o){
   try{
    o=o||{};
    const size=clamp(+o.size||40,20,160);
    const glyph=o.emoji||EMOJI_FALLBACK;
    const file=resolve(breedKey);
    const cls='mk-thumb mk-rar-'+rarKey(o.rarity)+(o.className?' '+o.className:'');
    /* flex:none and the min-width go inline on purpose: a portrait dropped into an old
       .evrow inherits `.evrow span{flex:1}` from the legacy sheet, which collapses it to
       0px.  Size and shape stay the stylesheet's business — this only stops the collapse. */
    const head='<span class="'+cls+'" style="--mk-thumb:'+size+'px;flex:0 0 auto;'
      +'min-width:var(--mk-thumb);min-height:var(--mk-thumb)"'
      +(breedKey?' data-mkbreed="'+esc(slug(breedKey))+'"':'')+'>'
      +'<i class="mk-thumb-fb" aria-hidden="true">'+glyph+'</i>';
    if(!file)return head+'</span>';
    return head+'<img class="mk-thumb-img" loading="lazy" decoding="async" alt="'+esc(o.alt||'')+'"'
      +' src="'+DIR+encodeURIComponent(file)+'.webp'+VER+'" onerror="this.remove()">'
      +'</span>';
   }catch(e){
    return '<span class="mk-thumb mk-rar-common"><i class="mk-thumb-fb">'+EMOJI_FALLBACK+'</i></span>';
   }
  },
  /* One list row: portrait, a title/meta stack, and whatever goes on the right. */
  row(o){
   o=o||{};
   return '<div class="mk-row'+(o.className?' '+o.className:'')+'"'+(o.attrs||'')+'>'
    +(o.thumb||'')
    +'<div class="mk-row-copy"><span class="mk-row-title">'+(o.title||'')+'</span>'
    +(o.meta?'<span class="mk-row-meta">'+o.meta+'</span>':'')+'</div>'
    +(o.trailing?'<div class="mk-row-trail">'+o.trailing+'</div>':'')
    +'</div>';
  },
  chip(icon,value,o){
   o=o||{};
   return '<span class="mk-chip'+(o.state?' mk-is-'+slug(o.state):'')+(o.className?' '+o.className:'')+'"'
    +(o.title?' title="'+esc(o.title)+'"':'')+'>'
    +(icon?'<span class="mk-chip-ico" aria-hidden="true">'+icon+'</span>':'')
    +'<span class="mk-chip-val">'+(value==null?'':value)+'</span></span>';
  },
  /* A value against its ceiling. state: good | warn | crit (colour encodes state, not brand). */
  bar(o){
   o=o||{};
   const max=+o.max>0?+o.max:100, val=clamp(+o.value||0,0,max);
   const pct=Math.round(val/max*100);
   return '<div class="mk-bar'+(o.state?' mk-is-'+slug(o.state):'')+'" role="img"'
    +' aria-label="'+esc((o.label||'')+' '+val+' of '+max)+'">'
    +(o.label?'<span class="mk-bar-label">'+o.label+'</span>':'')
    +'<span class="mk-bar-track"><i class="mk-bar-fill" style="width:'+pct+'%"></i></span>'
    +'<span class="mk-bar-val">'+(o.text!=null?o.text:val+' / '+max)+'</span></div>';
  },
  /* A horizontally scrolling tab strip. items: [{id,label,fx?}] */
  tabs(items,activeId){
   const list=Array.isArray(items)?items:[];
   return '<div class="mk-tabs" role="tablist">'+list.map(t=>{
    const tid=t&&(t.id!=null?t.id:t[0]), lbl=t&&(t.label!=null?t.label:t[1]);
    const on=String(tid)===String(activeId);
    return '<button class="mk-tab'+(on?' is-active':'')+'" role="tab" aria-selected="'+(on?'true':'false')+'"'
     +(t&&t.fx?' data-fx="'+esc(t.fx)+'"':'')+' data-mktab="'+esc(tid)+'">'+(lbl==null?'':lbl)+'</button>';
   }).join('')+'</div>';
  },
  btn(label,o){
   o=o||{};
   const kind=slug(o.kind)||'secondary';
   return '<button class="mk-btn mk-btn-'+kind+(o.className?' '+o.className:'')+'"'
    +(o.fx?' data-fx="'+esc(o.fx)+'"':'')+(o.title?' title="'+esc(o.title)+'"':'')
    +(o.disabled?' disabled':'')+(o.attrs||'')+'>'+(label==null?'':label)+'</button>';
  },
  empty(msg,icon){
   return '<div class="mk-empty">'+(icon?'<span class="mk-empty-ico" aria-hidden="true">'+icon+'</span>':'')
    +'<span class="mk-empty-msg">'+(msg||'Nothing here yet.')+'</span></div>';
  },
  /* Long rules text: collapsed by default, never a wall of paragraphs above the controls. */
  note(title,body,open){
   return '<details class="mk-note"'+(open?' open':'')+'><summary class="mk-note-sum">'
    +(title||'How this works')+'</summary><div class="mk-note-body">'+(body||'')+'</div></details>';
  },
 };
 G.ui.k=Object.assign(G.ui.k||{},K);

 /* ================= 3. the upgrade pass =================
    Everything below improves panels that were written before the kit existed.  It is all
    best-effort: one try/catch per concern, and a row that does not match is skipped. */
 const HORSE_GLYPH=/^[\s]*(🐴|🐎|🦄|🪽|🐉|✨|🐲)/u;
 let busy=false, pending=0;

 function panels(){
  const out=[];
  try{
   for(const id of (G.ui.panels||[]))if(id){const p=document.getElementById(id);if(p)out.push(p);}
   document.querySelectorAll('.fpanel,[id$="Panel"]').forEach(p=>{if(out.indexOf(p)<0)out.push(p);});
  }catch(e){}
  return out;
 }

 /* Header + scrollable body, without rewriting a single renderer.  The header element keeps
    its identity (and stays a direct child, so #eventsPanel>b:first-child still matches);
    everything after it moves into one .mk-panel-body the chrome can scroll. */
 function chrome(p){
  try{
   if(!p||p.querySelector(':scope > .mk-panel-body'))return;
   const kids=Array.from(p.children); if(kids.length<2)return;
   let head=p.querySelector(':scope > .ph');
   if(!head){const f=kids[0];if(f&&(f.tagName==='B'||f.classList.contains('ph')))head=f;}
   if(!head)return;
   head.classList.add('mk-panel-head');
   const body=document.createElement('div'); body.className='mk-panel-body';
   let n=head.nextSibling;
   while(n){const next=n.nextSibling;body.appendChild(n);n=next;}
   if(!body.childNodes.length)return;
   p.appendChild(body);
  }catch(e){}
 }

 /* Where a row's breed key can be found without touching the renderer that made it. */
 function breedOf(row,s){
  try{
   if(row.dataset&&row.dataset.mkbreedkey)return {key:row.dataset.mkbreedkey,rarity:row.dataset.mkrarity};
   const B=T.BREEDS3||[];
   const buy=row.querySelector('[data-buyh]');
   if(buy){const b=B[+buy.dataset.buyh];if(b&&b[0])return {key:b[0],rarity:b[2]};}
   const horses=(s&&s.horses)||[];
   const st=row.querySelector('[data-st]');
   if(st){
    const m=/^(?:ride|out|eq|rn|tack|feed):(\d+)$/.exec(st.dataset.st||'');
    if(m){const h=horses[+m[1]];if(h&&h.breed){const b=B.find(x=>x[0]===h.breed);return {key:h.breed,rarity:b&&b[2],emoji:h.horn?'🦄':h.wings?'🪽':h.foal?'🐎':''};}}
   }
   const sell=row.querySelector('[data-mktsell]');
   if(sell){const h=horses[+sell.dataset.mktsell];if(h&&h.breed){const b=B.find(x=>x[0]===h.breed);return {key:h.breed,rarity:b&&b[2]};}}
   const any=row.querySelector('[data-breed]');
   if(any&&any.dataset.breed){const b=B.find(x=>x[0]===any.dataset.breed);return {key:any.dataset.breed,rarity:b&&b[2]};}
  }catch(e){}
  return null;
 }

 /* Swap the leading glyph — a bare text node in the shop, a coloured circle in the stable —
    for the painting.  The circle's colour survives as the ring's backdrop. */
 function portrait(row,info){
  try{
   const size=row.classList.contains('mk-row')?44:34;
   const html=K.thumb(info.key,{size,rarity:info.rarity,emoji:info.emoji||EMOJI_FALLBACK});
   const first=row.firstElementChild;
   if(first&&first.tagName==='SPAN'&&!first.children.length&&HORSE_GLYPH.test(first.textContent||'')){
    const holder=document.createElement('span'); holder.innerHTML=html;
    const el=holder.firstElementChild; if(!el)return false;
    const bg=first.style&&first.style.background; if(bg)el.style.background=bg;
    first.replaceWith(el); return true;
   }
   for(const n of Array.from(row.childNodes)){
    if(n.nodeType===3&&HORSE_GLYPH.test(n.nodeValue||'')){
     n.nodeValue=n.nodeValue.replace(HORSE_GLYPH,'');
     const holder=document.createElement('span'); holder.innerHTML=html;
     const el=holder.firstElementChild; if(!el)return false;
     row.insertBefore(el,row.firstChild); return true;
    }
    if(n.nodeType===1)break;                                   // only the LEADING glyph
   }
  }catch(e){}
  return false;
 }

 function sweep(){
  if(busy)return; busy=true;
  let s=null; try{s=S.fresh();}catch(e){}
  try{
   for(const p of panels()){
    chrome(p);
    let rows=[];
    try{rows=p.querySelectorAll('.evrow:not([data-mkthumb]),.mk-row:not([data-mkthumb])');}catch(e){continue;}
    rows.forEach(row=>{
     try{
      if(row.querySelector('.mk-thumb')){row.dataset.mkthumb='0';return;}
      const info=breedOf(row,s);
      if(!info||!info.key){row.dataset.mkthumb='0';return;}      // not a horse row — leave it alone
      row.dataset.mkthumb=portrait(row,info)?'1':'0';
     }catch(e){try{row.dataset.mkthumb='0';}catch(e2){}}
    });
   }
  }catch(e){}
  busy=false;
 }
 function sweepSoon(){
  if(pending)return;
  pending=requestAnimationFrame(()=>{pending=0;sweep();});
 }

 /* Every route into a panel: the G.ui entry points a package uses, and a mutation observer
    for the inline renderers (openShop, renderStable …) that never go through G. */
 try{
  for(const name of ['open','toggle','rerender','openShop','openCare','openEvents','openStable','openQuests',
                     'openOnline','openLB','openBuild','renderCare','renderStable','renderQuests','renderLB','renderMoney']){
   const fn=G.ui[name]; if(typeof fn!=='function')continue;
   G.ui[name]=function(...a){const r=fn.apply(this,a);sweepSoon();return r;};
  }
 }catch(e){}
 try{
  const obs=new MutationObserver(muts=>{
   if(busy)return;
   for(const m of muts){if(m.addedNodes&&m.addedNodes.length){sweepSoon();return;}}
  });
  const watch=()=>{try{for(const p of panels())obs.observe(p,{childList:true,subtree:true});}catch(e){}};
  watch();
  G.on('boot',()=>{watch();sweepSoon();});
  setTimeout(watch,4000);                                       // panels registered late by other packages
 }catch(e){}
 sweepSoon();
}

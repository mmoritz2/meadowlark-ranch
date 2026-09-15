/* ui2-club — the Club screen and Build mode, driven through the real page.
   Every check here asserts something a player would notice: a pane that changes when a tab is
   pressed, a name whose ink stays inside its own box, a save field that moved because a button
   was clicked, a piece that is actually in the world afterwards. Nothing asserts that a
   function exists.

   Usage:  QA_URL=http://127.0.0.1:8514 NODE_PATH=$(npm root -g) node tools/qa-ui2-club.cjs
   Server: python3 .../serve-fallback.py <worktree> <main clone> 8514                        */
const {chromium}=require('playwright');
const QA=require('./qa-platform.cjs');   // the backend comes from the platform, never baked in
const base=(process.env.QA_URL||'http://127.0.0.1:8514').replace(/\/$/,'');
const checks=[];
function check(name,ok,detail){checks.push({name,ok:!!ok,detail});console.log((ok?'PASS ':'FAIL ')+name+(detail!==undefined?' — '+JSON.stringify(detail):''));}
const t0=Date.now();
const stage=s=>console.log('… '+s+' @'+((Date.now()-t0)/1000).toFixed(1)+'s');
let browser=null;
setTimeout(async()=>{console.error('WATCHDOG: no result after 900 s');try{if(browser)await browser.close();}catch(e){}process.exit(3);},900000).unref();

const READY=()=>{try{const s=JSON.parse(render_game_to_text());return s.graphics&&s.graphics.horseReady&&!s.graphics.horseLoading;}catch(e){return false;}};

/* A save a real player would have after a fortnight: money, a named club, friends, a pinned
   notice and a few pieces already down — the empty save hides every layout bug worth finding. */
const SEED=()=>{
 try{
  const k='starRanchFable_v1', s=JSON.parse(localStorage.getItem(k));
  s.coins=99999; s.gems=900; s.playerName='Moritz'; s.club='meadowlark';
  s.clubMeta={name:'Meadowlark Riders',founder:'Moritz',motto:'Ride soft, jump clean.',created:Date.now(),pub:true};
  s.clubNotice={t:'Sunrise hack on Saturday — meet at the gate.',by:'Moritz',at:Date.now()};
  s.friends={Ada:true,Bo:true,Cleo:true};
  s.blocked={Grendel:true,Thistle:true};
  s.decor=[{id:'aaa111',t:'haybale',x:-60,z:-20,ry:0},{id:'bbb222',t:'haybale',x:-62,z:-20,ry:0},{id:'ccc333',t:'barrel',x:-64,z:-20,ry:0}];
  localStorage.setItem(k,JSON.stringify(s));
 }catch(e){}
};

async function boot(page,tag){
 await page.goto(base+'/ranch3d.html?qa=ui2-club&fresh='+Date.now(),{waitUntil:'load',timeout:150000});
 await page.waitForFunction(READY,null,{timeout:180000,polling:300});
 await page.evaluate(SEED);
 /* let the first load finish decoding its model textures before reloading: navigating away
    mid-decode makes GLTFLoader log "Couldn't load texture blob:" for the aborted images,
    which is an artefact of the harness and not a fault in the game */
 await page.waitForLoadState('networkidle',{timeout:60000}).catch(()=>{});
 await page.waitForTimeout(1500);
 await page.reload({waitUntil:'load',timeout:150000});
 await page.waitForFunction(READY,null,{timeout:180000,polling:300});
 await page.waitForTimeout(1800);
 stage(tag+' ready');
}
const openClub=p=>p.evaluate(()=>{const b=document.getElementById('onlinePanel');if(b.style.display==='flex')return;document.getElementById('netBtn').click();});
const shut=p=>p.evaluate(()=>{try{hidePanels();}catch(e){document.querySelectorAll('.fpanel,[id$="Panel"]').forEach(x=>x.style.display='none');}});

(async()=>{
 browser=await chromium.launch({headless:true,args:['--disable-background-timer-throttling',QA.ANGLE,'--enable-gpu-rasterization','--ignore-gpu-blocklist']});
 const errors=[];
 const ABORTED=/Couldn't load texture blob:/;         // a texture whose page we navigated away from
 const wire=p=>{p.on('pageerror',e=>errors.push('PAGEERROR '+e.message));
  p.on('console',m=>{if(m.type()==='error'&&!ABORTED.test(m.text()))errors.push(m.text());});
  p.on('dialog',d=>d.dismiss().catch(()=>{}));};

 /* ===================== desktop, 1280×800 ===================== */
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 wire(page);
 await boot(page,'desktop');

 check('ui2-club installed with no install error',
  await page.evaluate(()=>{const G=window.__features;return !!G&&G.installed.indexOf('ui2-club')>=0&&!G.errors.some(e=>e.id==='ui2-club');}));

 /* ---------- the club ---------- */
 await openClub(page); await page.waitForTimeout(900);

 const club=await page.evaluate(()=>{
  const P=document.getElementById('onlinePanel'), bd=P.querySelector('.mk-panel-body');
  const tabs=Array.from(P.querySelectorAll('[data-c3tab]')).map(b=>({id:b.dataset.c3tab,on:b.classList.contains('on'),label:b.textContent.trim()}));
  /* the CLUB-1 probe: does any title's ink leave its own box? */
  const spill=[];
  P.querySelectorAll('.c3-title,.evrow > b,.c3-pieceName').forEach(n=>{
   const r=n.getBoundingClientRect(); if(!r.width)return;
   const rng=document.createRange(); rng.selectNodeContents(n);
   const t=rng.getBoundingClientRect();
   if(t.right>r.right+1.5)spill.push({txt:(n.textContent||'').trim().slice(0,30),spill:Math.round(t.right-r.right),box:Math.round(r.width)});
  });
  const ids={}; ['pname','pclub','clubNameIn','clubMottoIn','noticeIn','spRideName','pidOnline','netGo','netOff','netInvite','pnameSave']
   .forEach(i=>{ids[i]=!!document.getElementById(i);});
  const heads=Array.from(P.querySelectorAll('b')).map(b=>b.textContent.replace(/\s+/g,' ').trim());
  return {tabs,spill,ids,
   buttons:P.querySelectorAll('button').length,
   thumbs:P.querySelectorAll('.mk-thumb').length, imgs:P.querySelectorAll('img').length,
   faces:P.querySelectorAll('.c3-face').length,
   panes:P.querySelectorAll('.c3-pane').length,
   idCard:!!P.querySelector('.c3-id'),
   idName:(P.querySelector('.c3-idName')||{}).textContent,
   idTop:(()=>{const c=P.querySelector('.c3-id');if(!c)return null;const pr=P.getBoundingClientRect();return Math.round(c.getBoundingClientRect().top-pr.top);})(),
   codeMasked:(P.querySelector('.c3-codeV')||{}).textContent,
   hereNow:heads.filter(t=>/riders here now/i.test(t)).length,
   notes:P.querySelectorAll('.c3-note').length,
   blockChips:P.querySelectorAll('.mk-chip').length,
   bodyH:bd?bd.clientHeight:0};
 });
 check('the club is five tabs, not one 3,157px scroll',club.tabs.length===5&&club.panes===5,club.tabs.map(t=>t.label));
 check('CLUB-1: no title ink spills out of its box (desktop)',club.spill.length===0,club.spill);
 check('every element id the game writes to still resolves',Object.values(club.ids).every(Boolean),club.ids);
 check('all 47 original buttons survived the relayout',club.buttons>=47,{buttons:club.buttons});
 check('CLUB-7: riders carry portraits, not bare emoji',club.thumbs>0&&club.imgs>0&&club.faces>0,
  {mkThumb:club.thumbs,img:club.imgs,faces:club.faces});
 check('CLUB-5/6: the club identity card is the first thing in the sheet',
  club.idCard&&/Meadowlark Riders/.test(club.idName||'')&&club.idTop!=null&&club.idTop<220,
  {name:club.idName,topOffset:club.idTop});
 check('the club code is masked until revealed',/^•+$/.test(club.codeMasked||''),{shown:club.codeMasked});
 check('CLUB-4: "Riders here now" is rendered once, not twice',club.hereNow===1,{headings:club.hereNow});
 check('CLUB-8: long prose is folded into notes',club.notes>=2,{notes:club.notes});

 /* every pane, measured with that pane actually showing */
 const paneScroll=await page.evaluate(async()=>{
  const P=document.getElementById('onlinePanel'), bd=P.querySelector('.mk-panel-body');
  const out={};
  for(const b of Array.from(P.querySelectorAll('[data-c3tab]'))){
   b.click(); await new Promise(r=>setTimeout(r,90));
   const vis=Array.from(P.querySelectorAll('.c3-pane')).filter(p=>!p.hidden);
   out[b.dataset.c3tab]={ratio:+(bd.scrollHeight/Math.max(1,bd.clientHeight)).toFixed(2),
     visible:vis.length, id:vis[0]&&vis[0].dataset.pane, text:vis[0]?(vis[0].textContent||'').replace(/\s+/g,' ').trim().length:0};
  }
  return out;
 });
 const worst=Math.max(...Object.values(paneScroll).map(v=>v.ratio));
 check('CLUB-2: no pane scrolls more than 2× its viewport (was 5.6×)',worst<=2,paneScroll);
 check('each tab shows exactly one non-empty pane',
  Object.values(paneScroll).every(v=>v.visible===1&&v.text>40),paneScroll);
 check('the tab strip routes content to the right pane',
  paneScroll.club&&paneScroll.riders&&paneScroll.rides&&paneScroll.exped&&paneScroll.chat&&
  Object.keys(paneScroll).every(k=>paneScroll[k].id===k),
  Object.keys(paneScroll).map(k=>k+'→'+paneScroll[k].id).join(' '));

 /* a real edit through the real controls: reveal the identity fields, rename the club, and
    prove the save moved and the card repainted */
 const rename=await page.evaluate(async()=>{
  const P=document.getElementById('onlinePanel');
  P.querySelector('[data-c3tab="club"]').click(); await new Promise(r=>setTimeout(r,80));
  const edit=P.querySelector('.c3-edit'), btn=P.querySelector('.c3-idEdit button');
  const before=edit.hidden;
  btn.click(); await new Promise(r=>setTimeout(r,60));
  const after=edit.hidden;
  const inp=document.getElementById('clubNameIn');
  const visible=!!(inp&&inp.getBoundingClientRect().width>0);
  inp.value='Hollowpeak Hunt';
  P.querySelector('[data-fx="clubs:name"]').click();
  await new Promise(r=>setTimeout(r,500));
  const s=window.__features.save.fresh();
  const card=document.querySelector('#onlinePanel .c3-idName');
  return {before,after,visible,saved:s.clubMeta&&s.clubMeta.name,card:card&&card.textContent};
 });
 check('✏️ Edit reveals the club-name field, and renaming writes the save',
  rename.before===true&&rename.after===false&&rename.visible&&rename.saved==='Hollowpeak Hunt',rename);
 check('the identity card repaints with the new name',/Hollowpeak Hunt/.test(rename.card||''),{card:rename.card});

 /* the ride planner: a stop chip must actually build the draft */
 const ride=await page.evaluate(async()=>{
  const P=document.getElementById('onlinePanel');
  const tab=P.querySelector('[data-c3tab="rides"]'); tab.click(); await new Promise(r=>setTimeout(r,80));
  const before=(window.__features.trail&&window.__features.trail.draft||[]).length;
  const rail=P.querySelector('[data-tr^="add:"]');
  const railScrolls=(()=>{const c=rail&&rail.parentNode;return c?c.scrollWidth>=c.clientWidth:false;})();
  if(rail)rail.click();
  await new Promise(r=>setTimeout(r,700));
  const after=(window.__features.trail&&window.__features.trail.draft||[]).length;
  const P2=document.getElementById('onlinePanel');
  P2.querySelector('[data-c3tab="exped"]').click(); await new Promise(r=>setTimeout(r,120));
  const specs=P2.querySelectorAll('.c3-pane[data-pane="exped"] .c3-chipRow .c3-pill').length;
  const cards=P2.querySelectorAll('.c3-pane[data-pane="exped"] .evrow.c3').length;
  const visible=P2.querySelectorAll('.c3-pane[data-pane="exped"] .evrow.c3 .c3-title')[0];
  return {before,after,railScrolls,specs,cards,first:visible&&visible.textContent,
    pane:(P2.querySelector('.c3-pane:not([hidden])')||{}).dataset};
 });
 check('a stop chip adds a stop to the live trail draft',ride.after===ride.before+1,ride);
 check('expeditions are cards with a typed spec strip',ride.cards>=6&&ride.specs>=18,{cards:ride.cards,chips:ride.specs,first:ride.first});

 await shut(page); await page.waitForTimeout(250);

 /* ---------- build ---------- */
 await page.evaluate(()=>document.getElementById('buildBtn').click());
 await page.waitForTimeout(1100);
 const build=await page.evaluate(()=>{
  const P=document.getElementById('buildPanel'), bd=P.querySelector('.mk-panel-body');
  const head=P.querySelector('.mk-panel-head')||P.querySelector('.ph');
  const hr=head.getBoundingClientRect();
  /* BUILD-7: no two items of the star-rules checklist may overlap */
  const chk=P.querySelector('.c3-check');
  let overlaps=0, items=0;
  if(chk){
   const rs=Array.from(chk.children).map(c=>c.getBoundingClientRect());
   items=rs.length;
   for(let i=0;i<rs.length;i++)for(let j=i+1;j<rs.length;j++){
    const a=rs[i],b=rs[j];
    if(a.left<b.right-1&&b.left<a.right-1&&a.top<b.bottom-1&&b.top<a.bottom-1)overlaps++;
   }
  }
  const strip=P.querySelector('.c3-shelf .crow');
  const arrows=Array.from(P.querySelectorAll('.c3-arrow')).map(a=>({txt:a.textContent,shown:!a.hidden}));
  const off=strip?Array.from(strip.querySelectorAll('.tabbtn')).filter(t=>{
   const r=t.getBoundingClientRect(), s=strip.getBoundingClientRect();
   return r.left>=s.right-2;
  }).map(t=>t.textContent.trim()):[];
  const spill=[];
  P.querySelectorAll('.c3-pieceName,.c3-title,.evrow > b').forEach(n=>{
   const r=n.getBoundingClientRect(); if(!r.width)return;
   const rng=document.createRange(); rng.selectNodeContents(n);
   const t=rng.getBoundingClientRect();
   if(t.right>r.right+1.5)spill.push({txt:(n.textContent||'').trim().slice(0,26),spill:Math.round(t.right-r.right)});
  });
  return {
   headH:Math.round(hr.height), headLines:Math.round(hr.height/22), headChip:!!head.querySelector('.chip'),
   ratio:+(bd.scrollHeight/Math.max(1,bd.clientHeight)).toFixed(2),
   plates:P.querySelectorAll('.c3-plate').length,
   chips:P.querySelectorAll('.mk-chip,.chip').length,
   pieces:P.querySelectorAll('[data-fx^="ranch:place:"]').length,
   groups:P.querySelectorAll('.c3-group').length,
   sets:P.querySelectorAll('.evrow.c3-set').length,
   lvlCard:!!P.querySelector('.c3-lvl'),
   lvlText:(P.querySelector('.c3-lvl')||{textContent:''}).textContent.replace(/\s+/g,' ').trim().slice(0,150),
   cant:P.querySelectorAll('.evrow.c3-piece.cant').length,
   owned:Array.from(P.querySelectorAll('.c3-owned')).map(o=>o.textContent),
   checkItems:items, overlaps, arrows, offscreen:off, spill,
   foot:!!P.querySelector('.c3-foot [data-fx="ranch:remove"]')};
 });
 check('BUILD-9: the build header is one line and carries no chip',build.headLines<=2&&!build.headChip,{h:build.headH,chip:build.headChip});
 check('BUILD-7: the star-rules checklist has zero overlapping items (was 3 pairs)',
  build.checkItems>=4&&build.overlaps===0,{items:build.checkItems,overlaps:build.overlaps});
 check('BUILD-6: every piece has a preview plate and a real chip',
  build.plates>=build.pieces&&build.pieces>0&&build.chips>build.pieces,
  {plates:build.plates,pieces:build.pieces,chips:build.chips});
 check('BUILD-4: the All shelf is grouped, not a 3,163px wall',build.groups>=6,{groups:build.groups});
 check('BUILD-4: the default shelf scrolls less than 2× its viewport (was 5.6×)',build.ratio<=2,{ratio:build.ratio});
 check('BUILD-10: the level card states the next level, not two zeros',
  build.lvlCard&&/Lv 1/.test(build.lvlText)&&/Next perk|Stall XP/.test(build.lvlText)&&!/\+0%/.test(build.lvlText),
  {text:build.lvlText});
 check('a piece already placed shows its count',build.owned.length>0,{badges:build.owned});
 check('BUILD-8: no shelf is stranded off the right edge without an arrow',
  build.offscreen.length===0||build.arrows.some(a=>a.shown),{offscreen:build.offscreen,arrows:build.arrows});
 check('no piece name spills out of its card',build.spill.length===0,build.spill);
 check('Move / Remove stay reachable in a pinned footer',build.foot);
 check('the six decor sets are a shelf of their own',build.sets>=6,{sets:build.sets});

 /* shelves still work: clicking Stable must actually change the catalogue */
 const shelf=await page.evaluate(async()=>{
  const P=document.getElementById('buildPanel');
  const before=P.querySelectorAll('[data-fx^="ranch:place:"]').length;
  const b=P.querySelector('[data-fx="ranch:cat:stable"]'); if(!b)return {err:'no stable shelf'};
  b.click(); await new Promise(r=>setTimeout(r,800));
  const P2=document.getElementById('buildPanel');
  const after=P2.querySelectorAll('[data-fx^="ranch:place:"]').length;
  const on=(P2.querySelector('.tabbtn.on[data-fx^="ranch:cat:"]')||{}).textContent;
  const inView=(()=>{const t=P2.querySelector('.tabbtn.on[data-fx^="ranch:cat:"]');const s=t&&t.parentNode;
   if(!t||!s)return false;const r=t.getBoundingClientRect(),q=s.getBoundingClientRect();return r.left>=q.left-2&&r.right<=q.right+2;})();
  return {before,after,on:(on||'').trim(),inView};
 });
 check('a shelf button still re-renders the catalogue',shelf.after>0&&shelf.after<shelf.before&&/Stable/.test(shelf.on||''),shelf);
 check('BUILD-8: the active shelf scrolls itself into view',shelf.inView,shelf);

 /* ---------- the placement HUD ---------- */
 const hud=await page.evaluate(async()=>{
  const P=document.getElementById('buildPanel');
  const b=P.querySelector('[data-fx^="ranch:place:"]'); b.click();
  await new Promise(r=>setTimeout(r,600));
  const h=document.getElementById('buildHud'), r=h.getBoundingClientRect();
  const btns=Array.from(h.querySelectorAll('[data-bh]')).map(x=>({t:x.textContent.trim(),y:Math.round(x.getBoundingClientRect().top),x:Math.round(x.getBoundingClientRect().left)}));
  const ys=btns.map(x=>x.y);
  return {w:Math.round(r.width),h:Math.round(r.height),half:Math.round(innerWidth/2),
   btns, sameRow:ys.length?Math.max(...ys)-Math.min(...ys):999,
   name:(h.querySelector('.c3-hudName')||{}).textContent,
   state:(h.querySelector('.c3-hudState')||{}).textContent,
   budget:(h.querySelector('.c3-hudBudget')||{}).textContent,
   pills:h.querySelectorAll('.c3-pill').length};
 });
 check('BUILD-2: all three HUD controls share one row',hud.sameRow<4&&hud.btns.length===3,hud.btns);
 check('the HUD names the piece and prices it',/\S/.test(hud.name||'')&&hud.pills>=2,{name:hud.name,pills:hud.pills});
 check('BUILD-12: the HUD carries a session budget',/placed/.test(hud.budget||''),{budget:hud.budget});

 /* The valley's scenery is scattered afresh on every boot — two loads of the same page differ
    by a dozen colliders — so a hard-coded "open pasture" coordinate is clear only by luck. The
    first draft of this file used (-70,-40), and a tree landing within two metres of it failed
    three checks at once and made the suite report 47/50 on one run and 50/50 on the next. Ask
    the game which spot is genuinely clear and hang the rest of the build test on that. */
 const FREE=await page.evaluate(()=>{
  const G=window.__features, t=G.ranchSys.build.type;
  for(let r=34;r<=170;r+=6)for(let k=0;k<24;k++){
   const a=k/24*Math.PI*2+r*0.7, x=Math.round(Math.cos(a)*r), z=Math.round(Math.sin(a)*r);
   if(G.ranchSys.decorOk(t,x,z)===null)return [x,z];
  }
  return null;
 });
 check('the run found a genuinely clear spot to build on',Array.isArray(FREE),{spot:FREE});

 /* BUILD-3: the refusal reason decorOk() computes must reach the screen */
 const why=await page.evaluate(async(FREE)=>{
  const G=window.__features, B=G.ranchSys.build;
  B.lastPt=[0,0];                                   // dead centre of the arena — always illegal
  await new Promise(r=>setTimeout(r,500));
  const bad=(document.querySelector('#buildHud .c3-hudState')||{}).textContent||'';
  const badCls=(document.querySelector('#buildHud .c3-hudState')||{}).className||'';
  B.lastPt=[FREE[0],FREE[1]];                       // a spot the game itself just called clear
  await new Promise(r=>setTimeout(r,500));
  const ok=(document.querySelector('#buildHud .c3-hudState')||{}).textContent||'';
  return {bad:bad.trim(),badCls,ok:ok.trim(),truth:G.ranchSys.decorOk(B.type,0,0)};
 },FREE);
 check('BUILD-3: the HUD shows the reason a spot is refused, not just a red border',
  why.bad.indexOf(why.truth)>=0&&/bad/.test(why.badCls),why);
 check('BUILD-3: a legal spot reads as legal',/place it/i.test(why.ok),{ok:why.ok});

 /* place a piece for real, then take it back with the HUD control */
 const place=await page.evaluate(async(FREE)=>{
  const G=window.__features;
  const n0=(G.save.fresh().decor||[]).length, c0=Math.floor(G.save.fresh().coins);
  G.ranchSys.placeAt(FREE[0],FREE[1]);
  await new Promise(r=>setTimeout(r,600));
  const n1=(G.save.fresh().decor||[]).length, c1=Math.floor(G.save.fresh().coins);
  const budget=(document.querySelector('#buildHud .c3-hudBudget')||{}).textContent||'';
  const undo=document.querySelector('#buildHud .c3-undo');
  const undoShown=!!undo&&!undo.hidden;
  if(undo)undo.click();
  await new Promise(r=>setTimeout(r,600));
  const n2=(G.save.fresh().decor||[]).length, c2=Math.floor(G.save.fresh().coins);
  return {n0,n1,n2,c0,c1,c2,budget,undoShown};
 },FREE);
 check('placing a piece really places it, and the HUD budget counts it',
  place.n1===place.n0+1&&place.c1<place.c0&&/1 placed/.test(place.budget),place);
 check('BUILD-12: ↩ Remove last takes the piece back out of the world',
  place.undoShown&&place.n2===place.n1-1&&place.c2>place.c1,place);

 await page.evaluate(()=>{try{window.__features.ranchSys.endBuild();}catch(e){}});
 await page.waitForTimeout(300);

 /* BUILD-11: Build was the one panel with no hotkey */
 const key=await page.evaluate(async()=>{
  try{hidePanels();}catch(e){}
  await new Promise(r=>setTimeout(r,150));
  const was=document.getElementById('buildPanel').style.display;
  document.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyB',key:'b',bubbles:true}));
  await new Promise(r=>setTimeout(r,600));
  return {was,now:document.getElementById('buildPanel').style.display};
 });
 check('BUILD-11: B opens the Build panel',key.was!=='flex'&&key.now==='flex',key);

 await shut(page);
 await page.waitForLoadState('networkidle',{timeout:30000}).catch(()=>{});
 await page.close();

 /* ===================== phone, 390×844 ===================== */
 stage('phone');
 const ph=await browser.newPage({viewport:{width:390,height:844}});
 wire(ph);
 await boot(ph,'phone');
 await openClub(ph); await ph.waitForTimeout(900);

 const pc=await ph.evaluate(()=>{
  const P=document.getElementById('onlinePanel'), bd=P.querySelector('.mk-panel-body');
  const spill=[];
  P.querySelectorAll('.c3-title,.evrow > b').forEach(n=>{
   const r=n.getBoundingClientRect(); if(!r.width)return;
   const rng=document.createRange(); rng.selectNodeContents(n);
   const t=rng.getBoundingClientRect();
   if(t.right>r.right+1.5)spill.push({txt:(n.textContent||'').trim().slice(0,30),spill:Math.round(t.right-r.right)});
  });
  const card=P.querySelector('.c3-id'), pr=P.getBoundingClientRect();
  const strip=P.querySelector('.c3-tabShell .crow');
  return {spill,ratio:+(bd.scrollHeight/Math.max(1,bd.clientHeight)).toFixed(2),
   tabs:P.querySelectorAll('[data-c3tab]').length,
   tabsFit:strip?strip.scrollWidth<=strip.clientWidth+2:false,
   tabArrow:Array.from(P.querySelectorAll('.c3-tabShell .c3-arrow')).some(a=>!a.hidden),
   idTop:card?Math.round(card.getBoundingClientRect().top-pr.top):null,
   fold:Math.round(pr.height),
   noHScroll:P.scrollWidth<=P.clientWidth+1};
 });
 check('CLUB-1: no title ink spills at 390px (was 5 of 6 expedition names)',pc.spill.length===0,pc.spill);
 check('the Clubhouse pane fits inside 2 sheet-heights on a phone',pc.ratio<=2,{ratio:pc.ratio});
 check('CLUB-6: the club name is above the fold on a phone',pc.idTop!=null&&pc.idTop<pc.fold*0.5,{top:pc.idTop,sheet:pc.fold});
 check('the club sheet never scrolls sideways',pc.noHScroll,pc);
 check('the tab strip survives at 390px, with arrows when it overflows',pc.tabs===5&&(pc.tabsFit||pc.tabArrow),pc);

 await shut(ph); await ph.waitForTimeout(200);
 await ph.evaluate(()=>document.getElementById('buildBtn').click());
 await ph.waitForTimeout(1100);
 const pb=await ph.evaluate(async()=>{
  const P=document.getElementById('buildPanel'), bd=P.querySelector('.mk-panel-body');
  const head=P.querySelector('.mk-panel-head')||P.querySelector('.ph');
  /* measure the sheet BEFORE pressing Place — startPlace hides every panel, and a hidden
     panel measures zero, which would pass these checks for the wrong reason */
  const headH=Math.round(head.getBoundingClientRect().height);
  const ratio=+(bd.scrollHeight/Math.max(1,bd.clientHeight)).toFixed(2);
  const b=P.querySelector('[data-fx^="ranch:place:"]'); b.click();
  await new Promise(r=>setTimeout(r,700));
  const h=document.getElementById('buildHud'), r=h.getBoundingClientRect();
  const btns=Array.from(h.querySelectorAll('[data-bh]')).map(x=>Math.round(x.getBoundingClientRect().top));
  return {headH, ratio,
   hudW:Math.round(r.width), hudH:Math.round(r.height), half:Math.round(innerWidth/2),
   sameRow:btns.length?Math.max(...btns)-Math.min(...btns):999,
   pageScroll:document.documentElement.scrollWidth<=innerWidth+1};
 });
 check('BUILD-1: the HUD may be wider than half the viewport at 390px (was capped at 195)',
  pb.hudW>pb.half,{width:pb.hudW,half:pb.half});
 check('BUILD-1: the HUD is no longer a six-line paragraph (was 141px)',pb.hudH<=120,{height:pb.hudH});
 check('BUILD-2: the three controls share one row on a phone',pb.sameRow<4,{dy:pb.sameRow});
 check('BUILD-9: the build header is one line on a phone (was 50px, two lines)',pb.headH>0&&pb.headH<=46,{h:pb.headH});
 check('BUILD-4: the phone catalogue scrolls less than 2× its sheet',pb.ratio>0&&pb.ratio<=2,{ratio:pb.ratio});
 check('nothing pushes the page sideways',pb.pageScroll,pb);

 await ph.evaluate(()=>{try{window.__features.ranchSys.endBuild();}catch(e){}});
 await ph.waitForTimeout(200);
 await ph.close();

 check('no console or page errors anywhere in the run',errors.length===0,errors.slice(0,6));
 await browser.close();
 const failed=checks.filter(c=>!c.ok);
 console.log(failed.length?('FAILED '+failed.length+' of '+checks.length):('ALL '+checks.length+' CHECKS PASSED'));
 process.exit(failed.length?1:0);
})().catch(e=>{console.error('FATAL',e);process.exit(2);});

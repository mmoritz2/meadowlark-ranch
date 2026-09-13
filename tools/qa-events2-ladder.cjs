/* Feature package 'events2-ladder' — headless verification.
   Boots ranch3d.html?qa=events2-ladder, waits for the horse, then drives the ladder through
   window.__features (G) and reads the results back out of the DOM a player actually looks at, the
   save on disk, the scene graph and render_game_to_text().

   Every check below is written against something a PLAYER would notice: a panel that opens with
   text in it, a horse that moves across the ground, a number on the weekly board, a ticket that
   comes back after a crash. Nothing here asserts that a function is defined.

   Usage:  QA_URL=http://127.0.0.1:8552 NODE_PATH=$(npm root -g) node tools/qa-events2-ladder.cjs */
const {chromium}=require('playwright');
const base=(process.env.QA_URL||'http://127.0.0.1:8552').replace(/\/$/,'');
const url=base+'/ranch3d.html?qa=events2-ladder&fresh='+Date.now();
const checks=[];
function check(name,ok,detail){checks.push({name,ok:!!ok,detail});console.log((ok?'PASS ':'FAIL ')+name+(detail!==undefined?' — '+JSON.stringify(detail):''));}
const t0=Date.now();
const stage=s=>console.log('… '+s+' @'+((Date.now()-t0)/1000).toFixed(1)+'s');
let browser=null;
setTimeout(async()=>{console.error('WATCHDOG: no result after 600 s');try{if(browser)await browser.close();}catch(e){}process.exit(3);},600000).unref();

(async()=>{
 browser=await chromium.launch({headless:true,args:['--disable-background-timer-throttling','--use-angle=metal','--enable-gpu-rasterization','--ignore-gpu-blocklist']});
 const page=await browser.newPage({viewport:{width:1280,height:900}});
 const errors=[];
 page.on('pageerror',e=>errors.push('PAGEERROR '+e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 page.on('dialog',d=>{d.dismiss().catch(()=>{});});
 stage('launch'); await page.goto(url,{waitUntil:'load',timeout:120000}); stage('loaded');
 await page.waitForFunction(()=>window.render_game_to_text&&(()=>{try{const s=JSON.parse(render_game_to_text());return s.graphics&&s.graphics.horseReady&&!s.graphics.horseLoading;}catch(e){return false;}})(),null,{timeout:180000,polling:250});
 stage('horseReady');
 /* the toast queue only ever holds the one on screen, so keep them all */
 await page.evaluate(()=>{const G=window.__features;window.__toasts=[];const t0=G.toast;
  G.toast=m=>{window.__toasts.push(String(m));return t0(m);};});
 const toasted=re=>page.evaluate(r=>(window.__toasts||[]).some(t=>new RegExp(r).test(t)),re);
 /* one horse good enough to enter anything, so every gate under test is the ladder's and not a level */
 await page.evaluate(()=>{const G=window.__features;
  G.save.sync(s=>{const h=s.horses[G.horse.rideIdx()];h.level=12;h.bond=100;h.needs.clean=100;for(const k in h.stats)h.stats[k]=10;});
  G.horse.reloadHorses();});

 /* ---------------------------------------------------------------- 1. install + the par --- */
 const r1=await page.evaluate(()=>{
  const G=window.__features, out={};
  out.errors=G.errors.slice();
  out.installed=G.installed.includes('events2-ladder');
  /* Every racing row used to advertise the same fabricated 56 s because eventPar fell through to
     a flat 40. The card must now agree with the clock the course actually hands out. */
  out.cards=G.tables.EVENTS3.filter(e=>e.race&&e.route&&!e.gauntlet&&!e.friendly)
   .map(e=>({id:e.id,card:+G.course.eventTimeAllowed(e,1).toFixed(1)}));
  out.distinct=new Set(out.cards.map(c=>c.card)).size;
  /* and the card must match what startCourse really allows, within a second */
  out.match=[];
  for(const id of ['rr','pp','bd']){
   const ev=G.tables.EVENTS3.find(e=>e.id===id); if(!ev)continue;
   G.course.startCourse(ev);
   const c=G.course.get();
   out.match.push({id,card:+G.course.eventTimeAllowed(ev,1).toFixed(1),real:+((c&&c.ce&&c.ce.timeAllowed)||0).toFixed(1)});
   G.course.cancelCourse();
  }
  return out;
 });
 check('the package installed with no errors',r1.installed&&!r1.errors.some(e=>e.id==='events2-ladder'),{errors:r1.errors});
 check('racing rows no longer all advertise the same time allowed',r1.distinct>=5,{distinct:r1.distinct,cards:r1.cards});
 check('the advertised time allowed is the one the course really gives',
  r1.match.length>=3&&r1.match.every(m=>Math.abs(m.card-m.real)<1),r1.match);

 /* ---------------------------------------------------------------- 2. a field on the track  */
 const r2=await page.evaluate(()=>{
  const G=window.__features, out={};
  const pp=G.tables.EVENTS3.find(e=>e.id==='pp');
  G.course.startCourse(pp);
  window.advanceTime(4200);                       // through the countdown
  const F=G.ladder.FIELD();
  out.n=F?F.rivals.length:0;
  out.named=F?F.rivals.map(r=>r.n):[];
  out.fromValley=out.named.every(n=>G.tables.NEIGHBOURS.some(([nm])=>nm===n));
  /* the rivals are IN THE WORLD, not just in a number */
  out.inScene=F?F.rivals.filter(r=>r.g&&r.g.parent===G.scene).length:0;
  out.p0=F&&F.rivals[0].g?[+F.rivals[0].g.position.x.toFixed(2),+F.rivals[0].g.position.z.toFixed(2)]:null;
  window.advanceTime(4000);
  out.p1=F&&F.rivals[0].g?[+F.rivals[0].g.position.x.toFixed(2),+F.rivals[0].g.position.z.toFixed(2)]:null;
  out.moved=out.p0&&out.p1?Math.hypot(out.p1[0]-out.p0[0],out.p1[1]-out.p0[1]):0;
  /* the HUD a player reads while riding */
  const hud=document.getElementById('ladHud');
  out.hudOn=hud.classList.contains('on');
  out.hudTxt=hud.innerText;
  out.hudNames=out.named.filter(n=>out.hudTxt.includes(n)).length;
  out.hudGap=/[-+]\d+\.\d+s/.test(out.hudTxt);
  /* standing still, three riders who left the box are ahead of you */
  let st=JSON.parse(render_game_to_text());
  out.placeBehind=st.course.place; out.field=st.course.field;
  /* jump to the last gate and you are in front of them */
  const c=G.course.get();
  c.idx=c.jumps.length-1; c.t=8;
  window.advanceTime(200);
  st=JSON.parse(render_game_to_text());
  out.placeAhead=st.course.place;
  out.rivals=(st.course.rivals||[]).length;
  G.course.cancelCourse(); window.advanceTime(80);
  out.tornDown=G.ladder.FIELD()===null&&!document.getElementById('ladHud').classList.contains('on');
  return out;
 });
 check('a solo race spawns a named field drawn from the valley',r2.n>=3&&r2.fromValley,{n:r2.n,names:r2.named});
 check('the rivals are horses in the scene, not numbers',r2.inScene===r2.n&&r2.moved>2,{inScene:r2.inScene,moved:+r2.moved.toFixed(1)});
 check('the live board names them and shows the gap in seconds',r2.hudOn&&r2.hudNames>=2&&r2.hudGap,{hud:r2.hudTxt});
 check('placing moves with the race',r2.placeBehind>1&&r2.placeAhead===1&&r2.field>=3,
  {behind:r2.placeBehind,ahead:r2.placeAhead,field:r2.field});
 check('render_game_to_text carries the field for a solo race',r2.rivals>=4,r2.rivals);
 check('the field is torn down with the course',r2.tornDown);

 /* ---------------------------------------------------------------- 3. the result card ----- */
 const r3=await page.evaluate(async()=>{
  const G=window.__features, out={};
  const pp=G.tables.EVENTS3.find(e=>e.id==='pp');
  const b=G.save.fresh(); out.c0=b.coins; out.rib0=(b.lad&&b.lad.rib.total)||0;
  G.course.startCourse(pp);
  window.advanceTime(4200);
  for(let n=0;n<60&&G.course.get();n++){
   const cc=G.course.get(); const j=cc.jumps[cc.idx]; if(!j)break;
   G.horse.player.pos.set(j.x,0,j.z); G.horse.player.speed=8; window.advanceTime(120);
  }
  out.finished=G.course.get()===null;
  /* the panel opens on its own — a player does not have to go looking for their own result */
  await new Promise(r=>setTimeout(r,700));
  const p=document.getElementById('resultPanel');
  out.open=p&&p.style.display==='flex';
  out.noDockButton=!document.getElementById('resultBtn');
  const txt=(p&&p.innerText)||'';
  out.txt=txt.slice(0,900);
  out.hasTime=/\d+\.\d+s/.test(txt);
  out.hasPlace=/finished P\d of \d/.test(txt);
  out.hasScore=txt.includes('The score')&&/Accuracy \d+%/.test(txt);
  out.hasPurse=txt.includes('Purse');
  out.hasRibbons=/ribbons won all told/.test(txt);
  out.hasRank=/racing points/.test(txt);
  out.hasNext=txt.includes('Next on the ladder');
  out.hasAgain=!!p.querySelector('[data-fx^="lad:again"]');
  out.hasRecap=txt.includes('Also this round');
  const a=G.save.fresh();
  out.rib1=(a.lad&&a.lad.rib.total)||0;
  out.lastRun=a.lastRun;
  /* ride it a second time: the per-event best in s.ribbons is capped, the running tally is not */
  const cap0=(a.ribbons||{}).pp||0;
  G.course.startCourse(pp); window.advanceTime(4200);
  for(let n=0;n<60&&G.course.get();n++){
   const cc=G.course.get(); const j=cc.jumps[cc.idx]; if(!j)break;
   G.horse.player.pos.set(j.x,0,j.z); G.horse.player.speed=8; window.advanceTime(120);
  }
  await new Promise(r=>setTimeout(r,700));
  const a2=G.save.fresh();
  out.rib2=(a2.lad&&a2.lad.rib.total)||0; out.cap0=cap0; out.cap1=(a2.ribbons||{}).pp||0;
  out.state=JSON.parse(render_game_to_text()).ladder;
  document.querySelector('#resultPanel [data-fx="close:resultPanel"]').click();
  out.closed=document.getElementById('resultPanel').style.display;
  return out;
 });
 check('finishing a round opens a results card by itself',r3.finished&&r3.open&&r3.noDockButton,{open:r3.open});
 check('the card carries the time, the placing, the score and the purse',
  r3.hasTime&&r3.hasPlace&&r3.hasScore&&r3.hasPurse,{time:r3.hasTime,place:r3.hasPlace,score:r3.hasScore,purse:r3.hasPurse,txt:r3.txt});
 check('the card carries the ribbon tally, the rank and what to ride next',r3.hasRibbons&&r3.hasRank&&r3.hasNext,
  {rib:r3.hasRibbons,rank:r3.hasRank,next:r3.hasNext});
 check('the card gathers up the finish toasts instead of leaving them to drip',r3.hasRecap,{txt:r3.txt});
 check('the card offers the round again',r3.hasAgain);
 check('the result survives on disk for the panel to reopen',r3.lastRun&&r3.lastRun.ev==='pp'&&typeof r3.lastRun.t==='number',r3.lastRun);
 check('ribbons accumulate on a second ride where the per-event badge is capped',
  r3.rib2>r3.rib1&&r3.rib1>r3.rib0&&r3.cap1===r3.cap0,{run1:r3.rib1,run2:r3.rib2,cap:[r3.cap0,r3.cap1]});
 check('render_game_to_text carries the ladder',r3.state&&r3.state.ribbons===r3.rib2&&typeof r3.state.weekLeft==='string',r3.state);
 check('the card closes',r3.closed==='none',r3.closed);

 /* ---------------------------------------------------------------- 4. the weekly board ---- */
 /* The headline bug: course-engine sets RB.gold on its own object and awardRibbons hands back a
    fresh one without it, so a gold ribbon on a featured event recorded nothing, the board always
    read 'not ranked', and Monday always settled an empty list. */
 const r4=await page.evaluate(async()=>{
  const G=window.__features, out={};
  const feat=G.course.weeklyFeatured();
  out.featured=feat.map(e=>e.id);
  /* A plain gate race can be ridden here by teleporting gate to gate; a cross-country loop or a
     twelve-fence round cannot, because both are side-crossing tests. Ride the week's race when the
     rotation gives us one and otherwise take the round as given and put the FINISH under test,
     which is where the bug lived. */
  const ev=feat.find(e=>e.race&&!e.gauntlet&&!e.xc)||feat[0];
  out.ev=ev.id; out.rode=!!(ev.race&&!ev.gauntlet&&!ev.xc);
  G.save.sync(s=>{s.weekly=s.weekly||{};s.weekly.times={};s.weekly.gold={};s.lad.wk={week:G.time.weekKey(),times:{},gold:{},score:{}};});
  G.course.startCourse(ev);
  out.started=!!G.course.get();
  window.advanceTime(4200);
  if(out.rode){
   for(let n=0;n<90&&G.course.get();n++){
    const cc=G.course.get(); const j=cc.jumps[cc.idx]; if(!j)break;
    G.horse.player.pos.set(j.x,0,j.z); G.horse.player.speed=8; window.advanceTime(120);
   }
  }
  if(G.course.get()){G.course.get().t=(G.course.get().par||40)*0.8;G.course.finishCourse();}
  await new Promise(r=>setTimeout(r,700));
  const s=G.save.fresh();
  out.gold=!!(s.ribbonGold&&s.ribbonGold[ev.id]);
  out.time=s.weekly&&s.weekly.times&&s.weekly.times[ev.id];
  out.mirror=s.lad.wk.times[ev.id];
  out.rows=G.events.weeklyRows(ev,s).length;
  out.place=G.events.myPlace(G.events.weeklyRows(ev,s));
  const rtxt=document.getElementById('resultPanel').innerText||'';
  out.card=rtxt.includes("This week's board");
  /* The card's recap is exactly what reached the toast queue this round — this harness's own spy
     sits ABOVE the package's filter and still sees the line the player never does, so the recap is
     the honest surface to read. It must announce the placing and must not deny the gold. */
  const notes=((G.ladder.last()||{}).notes)||[];
  out.tail=notes.slice(-12);
  out.denied=notes.some(t=>/only a .* gold ribbon is ranked/.test(t))||/only a .* gold ribbon is ranked/.test(rtxt);
  out.announced=notes.some(t=>/ranked #\d+ of \d+/.test(t))||/ranked #\d+ of \d+/.test(rtxt);
  out.wkNote=(G.ladder.last()||{}).wkNote;
  /* Monday: the prize ladder that could never pay now has something to settle */
  G.save.sync(x=>{x.weekly.week='1999-01-04';x.lbLast=null;G.events.settleWeek(x,true);});
  const L=G.save.fresh().lbLast;
  out.settled=L&&L.prizes?L.prizes.length:0;
  out.band=L&&L.prizes&&L.prizes[0]&&L.prizes[0].tier;
  const b4=G.save.fresh();
  G.events.claimLbPrizes();
  const af=G.save.fresh();
  out.paid=(af.keys||0)>(b4.keys||0)||af.gems>b4.gems||af.horses.length>b4.horses.length||(af.tack||[]).length>(b4.tack||[]).length;
  /* ensureWeek wipes s.weekly when the week turns; our own copy has to put the board back */
  G.save.sync(x=>{x.weekly={week:G.time.weekKey(),rib:{},claimed:{}};});
  const back=G.save.fresh();
  out.restored=back.weekly.times&&back.weekly.times[ev.id];
  return out;
 });
 check('a gold ribbon on a featured event is recorded on the weekly board',
  r4.gold&&typeof r4.time==='number'&&r4.time===r4.mirror,{gold:r4.gold,time:r4.time,mirror:r4.mirror});
 check('that time takes a place on the board instead of "not ranked yet"',r4.place>0&&r4.rows>=9,{place:r4.place,rows:r4.rows});
 check('the finish announces the placing and no longer denies the gold',r4.announced&&!r4.denied,{announced:r4.announced,denied:r4.denied,ev:r4.ev,rode:r4.rode,note:r4.wkNote,tail:r4.tail});
 check('the result card shows this week\'s board',r4.card);
 check('Monday now has something to settle and the prize ladder pays',r4.settled>=1&&r4.paid,{n:r4.settled,band:r4.band,paid:r4.paid});
 check('the board survives the week object being reset under it',r4.restored===r4.time,{restored:r4.restored,was:r4.time});

 /* ---------------------------------------------------------------- 5. the ladder screen --- */
 const r5=await page.evaluate(()=>{
  const G=window.__features, out={};
  document.getElementById('lbBtn').click();
  const tab=document.querySelector('#lbPanel [data-lbtab="ladder"]');
  out.tabExists=!!tab;
  if(tab)tab.click();
  const p=document.getElementById('lbPanel'), txt=p.innerText;
  out.txt=txt.slice(0,1200);
  out.rank=/racing points/.test(txt);
  out.nextPays=/to go\. It pays/.test(txt);
  out.tickets=/Race tickets · \d+ of \d+/.test(txt);
  out.noWall=/Nothing in the ladder is behind them/.test(txt);
  out.weekly=txt.includes("This week's featured events")&&/\d+d \d+h left/.test(txt);
  out.band=/prize ladder as things stand/.test(txt)||/not ridden/i.test(txt);
  out.judged=txt.includes('Judged class of the week');
  out.ribbons=/Ribbons won · \d+/.test(txt);
  out.champ=txt.includes('The road to the Basin Championship');
  out.rideBtns=p.querySelectorAll('[data-fx^="lad:again"]').length;
  out.whyBtns=p.querySelectorAll('[data-fx^="lad:why"]').length;
  return out;
 });
 check('a 🏆 Ladder tab exists on the Boards panel',r5.tabExists);
 check('it shows the rank and exactly what the next one pays',r5.rank&&r5.nextPays,{txt:r5.txt});
 check('it shows the one ticket book and says the ladder is not behind it',r5.tickets&&r5.noWall,{tickets:r5.tickets,noWall:r5.noWall});
 check('it shows this week\'s featured events with the time left in the week',r5.weekly,{txt:r5.txt});
 check('it shows the judged class, the ribbon tally and the championship path',r5.judged&&r5.ribbons&&r5.champ,
  {judged:r5.judged,ribbons:r5.ribbons,champ:r5.champ});
 check('every board on it can be ridden from it',r5.rideBtns>=4&&r5.whyBtns>=1,{ride:r5.rideBtns,why:r5.whyBtns});

 /* ---------------------------------------------------------------- 6. the event rows ------ */
 /* ui2-compete hides an event row's extras block when it carries no control, which hid the
    favoured traits, the reward line, the qualifier badge and the turnout preview on every row in
    the game. One button in the block keeps all of it on screen. */
 const r6=await page.evaluate(async()=>{
  const G=window.__features, out={};
  G.hidePanels();
  document.getElementById('eventsBtn').click();
  await new Promise(r=>setTimeout(r,260));
  const p=document.getElementById('eventsPanel');
  const txt=p.innerText;
  out.favours=txt.includes('favours');
  out.reward=/XP/.test(txt)&&/💎/.test(txt);
  out.qualifier=txt.includes('qualifier');
  out.fullCard=p.querySelectorAll('[data-fx^="lad:why"]').length;
  out.hiddenBlocks=Array.from(p.querySelectorAll('.c2-evExtra')).filter(n=>n.offsetHeight===0).length;
  out.extraBlocks=p.querySelectorAll('.c2-evExtra').length;
  out.ladderLine=txt.includes('Where this sits on the ladder');
  /* the info card a player reads BEFORE entering */
  const btn=p.querySelector('[data-fx="lad:why:pp"]')||p.querySelector('[data-fx^="lad:why"]');
  out.btn=!!btn;
  if(btn)btn.click();
  await new Promise(r=>setTimeout(r,200));
  const rp=document.getElementById('resultPanel');
  out.previewOpen=rp.style.display==='flex';
  const ptxt=rp.innerText;
  out.preview=ptxt.slice(0,700);
  out.pAllowed=/Time allowed \d+/.test(ptxt)||/Score to beat/.test(ptxt);
  out.pFavours=ptxt.includes('What this race favours')||ptxt.includes('What it pays');
  out.pPays=/What it pays/.test(ptxt)&&/XP/.test(ptxt)&&/💎/.test(ptxt);
  out.pRecord=ptxt.includes('Your record here');
  out.pEnter=!!rp.querySelector('[data-fx^="lad:again"]');
  G.hidePanels();
  return out;
 });
 check('the hidden per-row competition cards are on screen again',
  r6.hiddenBlocks===0&&r6.favours,{blocks:r6.extraBlocks,hidden:r6.hiddenBlocks,favours:r6.favours});
 check('the reward line and the qualifier badge are readable on the rows',r6.reward&&r6.qualifier,{reward:r6.reward,qualifier:r6.qualifier});
 check('every row carries a full-card control and the panel carries the ladder summary',r6.fullCard>=10&&r6.ladderLine,{n:r6.fullCard});
 check('the full card opens before you enter, with the allowance, the payout and your record',
  r6.previewOpen&&r6.pAllowed&&r6.pPays&&r6.pRecord&&r6.pEnter,
  {open:r6.previewOpen,allowed:r6.pAllowed,pays:r6.pPays,record:r6.pRecord,enter:r6.pEnter,txt:r6.preview});

 /* ---------------------------------------------------------------- 7. tickets + rematch --- */
 const r7=await page.evaluate(async()=>{
  const G=window.__features, out={};
  G.save.sync(s=>{s.tix={date:G.time.dateKey(),n:4};});
  const t0=G.events.tix(G.save.fresh());
  /* an ordinary solo race is free — the ladder must never be behind the ticket book */
  const pp=G.tables.EVENTS3.find(e=>e.id==='pp');
  G.course.startCourse(pp); window.advanceTime(4200);
  out.freeEntry=G.events.tix(G.save.fresh())===t0;
  G.course.cancelCourse(); window.advanceTime(80);
  /* the rematch is opt-in upside: one ticket, a faster field, double points */
  const s0=G.save.fresh(); out.pts0=s0.racing.pts;
  G.ui.dispatch('lad:rematch:pp');
  out.tixSpent=t0-G.events.tix(G.save.fresh());
  window.advanceTime(4200);
  const F=G.ladder.FIELD(), c=G.course.get();
  out.rematch=!!(c&&c.ladRematch);
  out.rivalsFast=F?F.rivals.map(r=>+r.target.toFixed(1)):[];
  for(let n=0;n<60&&G.course.get();n++){
   const cc=G.course.get(); const j=cc.jumps[cc.idx]; if(!j)break;
   G.horse.player.pos.set(j.x,0,j.z); G.horse.player.speed=8; window.advanceTime(120);
  }
  await new Promise(r=>setTimeout(r,700));
  out.pts1=G.save.fresh().racing.pts;
  out.doubled=(window.__toasts||[]).some(t=>/rematch, doubled/.test(t));
  return out;
 });
 check('an ordinary solo race still costs no ticket',r7.freeEntry);
 check('the rematch spends exactly one ticket and rides a faster field',r7.tixSpent===1&&r7.rematch,{spent:r7.tixSpent,rematch:r7.rematch});
 check('the rematch pays double placing points',r7.doubled&&r7.pts1>r7.pts0,{before:r7.pts0,after:r7.pts1});

 /* ---------------------------------------------------------------- 8. the crash --------- */
 const r8=await page.evaluate(async()=>{
  const G=window.__features, out={};
  const rr=G.tables.EVENTS3.find(e=>e.id==='rr');
  G.course.startCourse(rr); window.advanceTime(4200);
  const c=G.course.get(); c.idx=3; c.t=31.5; c.tixSpent=true;
  window.advanceTime(4000);                              // past the write throttle
  out.saved=G.save.fresh().runSaved;
  return out;
 });
 check('a round in progress is written to the save so a reload cannot eat it',
  r8.saved&&r8.saved.ev==='rr'&&r8.saved.idx===3&&r8.saved.t>=30,r8.saved);
 stage('reloading mid-round');
 await page.reload({waitUntil:'load',timeout:120000});
 await page.waitForFunction(()=>window.render_game_to_text&&(()=>{try{const s=JSON.parse(render_game_to_text());return s.graphics&&s.graphics.horseReady&&!s.graphics.horseLoading;}catch(e){return false;}})(),null,{timeout:180000,polling:250});
 stage('reloaded');
 const r8b=await page.evaluate(async()=>{
  const G=window.__features, out={};
  out.gone=G.course.get()===null;
  out.offered=!!G.save.fresh().runSaved;
  document.getElementById('eventsBtn').click();
  await new Promise(r=>setTimeout(r,260));
  const p=document.getElementById('eventsPanel');
  out.prompt=p.innerText.includes('An unfinished round');
  out.btn=!!p.querySelector('[data-fx="lad:resume"]');
  const tix0=G.events.tix(G.save.fresh());
  if(p.querySelector('[data-fx="lad:resume"]'))p.querySelector('[data-fx="lad:resume"]').click();
  await new Promise(r=>setTimeout(r,200));
  const c=G.course.get();
  out.resumed=c?{ev:c.ev.id,idx:c.idx,t:+c.t.toFixed(1)}:null;
  out.cleared=G.save.fresh().runSaved===null;
  G.course.cancelCourse(); window.advanceTime(80);
  /* and a round the player lets go hands the ticket back rather than eating it */
  G.save.sync(s=>{s.runSaved={ev:'rr',di:1,t:20,idx:2,lap:1,laps:1,faults:0,grades:[],lineOff:0,refusals:0,insp:0,tix:true,at:Date.now()};s.tix.n=2;});
  G.ui.dispatch('lad:drop');
  out.refunded=G.events.tix(G.save.fresh())-2;
  return out;
 });
 check('the round is gone after a reload but the save remembers it',r8b.gone&&r8b.offered,{gone:r8b.gone,offered:r8b.offered});
 check('the Events panel offers it back',r8b.prompt&&r8b.btn,{prompt:r8b.prompt});
 check('picking it up puts you back where you stopped',
  r8b.resumed&&r8b.resumed.ev==='rr'&&r8b.resumed.idx===3&&r8b.resumed.t>=30&&r8b.cleared,r8b.resumed);
 check('letting it go hands the ticket back',r8b.refunded===1,r8b.refunded);

 /* ---------------------------------------------------------------- 9. the championship --- */
 const r9=await page.evaluate(async()=>{
  const G=window.__features, out={};
  /* sign off all four venues the way a player would have: two ribbons at a town's own event */
  G.save.sync(s=>{s.ribbons=Object.assign(s.ribbons||{},{h1:3,a1:3,b1:3,w1:3});});
  out.qualified=G.events.champQualified(G.save.fresh()).n;
  const w2=G.tables.EVENTS3.find(e=>e.id==='w2');
  G.course.startCourse(w2);
  out.entered=!!G.course.get();
  if(!G.course.get())return out;
  window.advanceTime(4200);
  /* a twelve-fence two-lap round cannot be teleported through a side-crossing test, so the ride
     is granted and the FINISH is what is under test here */
  const c=G.course.get(); c.t=96.4;
  G.course.finishCourse();
  out.done=G.course.get()===null;
  await new Promise(r=>setTimeout(r,700));
  const s=G.save.fresh();
  out.champion=s.lad.champion;
  const txt=document.getElementById('resultPanel').innerText;
  out.card=txt.includes('The Basin Championship');
  out.standings=(txt.match(/👑|#2|#3/g)||[]).length;
  out.state=JSON.parse(render_game_to_text()).ladder.champion;
  return out;
 });
 check('the Final can be entered once the four venues are signed off',r9.qualified===4&&r9.entered,{venues:r9.qualified});
 check('the Final settles into a standings table and a recorded placing',
  r9.done&&r9.champion&&r9.champion.place>=1&&r9.card&&r9.standings>=2,{champ:r9.champion,card:r9.card});
 check('the championship result is in the save and the state dump',!!r9.state&&r9.state.place===r9.champion.place,r9.state);

 /* ---------------------------------------------------------------- 10. judged board ------ */
 const r10=await page.evaluate(()=>{
  const G=window.__features, out={};
  const jd=G.ladder.judgedOfWeek();
  out.id=jd&&jd.id; out.dressage=!!(jd&&jd.dressage);
  out.notFeatured=!G.course.weeklyFeatured().some(e=>e.id===out.id);
  /* a gold test takes a place on it, ranked by mark and not by the clock */
  G.save.sync(s=>{s.lad.wk.score={};});
  out.before=G.ladder.placeIn(G.ladder.judgedRows(jd,G.save.fresh()));
  G.ladder.writeWeekly(jd,{t:0},true,true,0.97);
  const rows=G.ladder.judgedRows(jd,G.save.fresh());
  out.after=G.ladder.placeIn(rows);
  out.desc=rows.every((r,i)=>i===0||rows[i-1].v>=r.v);
  out.rows=rows.length;
  document.getElementById('lbBtn').click();
  document.querySelector('#lbPanel [data-lbtab="ladder"]').click();
  const ltx=document.getElementById('lbPanel').innerText;
  out.shown=ltx.includes('Judged class of the week')&&ltx.includes(jd.name)&&/You \d+%/.test(ltx);
  document.getElementById('lbBtn').click();
  return out;
 });
 check('a judged class is featured every week and is not one of the four',r10.id&&r10.dressage&&r10.notFeatured,
  {id:r10.id,notFeatured:r10.notFeatured});
 check('a gold mark ranks on it, best score first',r10.before===0&&r10.after>0&&r10.desc&&r10.rows>=9,
  {before:r10.before,after:r10.after,rows:r10.rows});
 check('the judged placing is drawn on the ladder screen',r10.shown,{shown:r10.shown,place:r10.after});

 /* ---------------------------------------------------------------- 11. ribbon tiers ------ */
 const r11=await page.evaluate(()=>{
  const G=window.__features, out={};
  G.save.sync(s=>{s.lad.rib.total=80;s.lad.tiers={};});
  const b=G.save.fresh(); out.g0=b.gems; out.k0=b.keys||0; out.c0=b.coins;
  G.ui.dispatch('lad:ribtier:0');
  G.ui.dispatch('lad:ribtier:1');
  const a=G.save.fresh(); out.g1=a.gems; out.k1=a.keys||0; out.c1=a.coins;
  G.ui.dispatch('lad:ribtier:0');
  out.c2=G.save.fresh().coins;
  out.locked=(()=>{G.ui.dispatch('lad:ribtier:3');return G.save.fresh().gems===a.gems;})();
  out.board=(G.tables.BOARDS||[]).some(x=>x.k==='ribbons');
  return out;
 });
 check('the ribbon tally pays its tiers',r11.c1>r11.c0&&(r11.g1>r11.g0||r11.k1>r11.k0),
  {coins:[r11.c0,r11.c1],gems:[r11.g0,r11.g1]});
 check('a tier cannot be claimed twice and a locked one pays nothing',r11.c2===r11.c1&&r11.locked,{c1:r11.c1,c2:r11.c2});
 check('ribbons won is a valley board',r11.board);

 /* ---------------------------------------------------------------- 12. judged cards ----- */
 /* A dressage test and a showmanship class are scored on things a race has no words for, so the
    card has to speak their language too: the figure-by-figure sheet, and the turnout breakdown. */
 const r12=await page.evaluate(async()=>{
  const G=window.__features, out={};
  const ride=async id=>{
   const ev=G.tables.EVENTS3.find(e=>e.id===id);
   G.course.startCourse(ev);
   window.advanceTime(4200);
   for(let n=0;n<80&&G.course.get();n++){
    const cc=G.course.get(); const f=cc.figs&&cc.figs[cc.fi]; if(!f)break;
    const [x,z]=G.course.ARENA_LETTERS[f.at];
    if(f.circle){
     /* a circle is swept, not arrived at: ride it round the marker at a canter */
     for(let k=0;k<26;k++){
      const cur=G.course.get(); if(!cur||cur.figs[cur.fi]!==f)break;
      const a=k/26*Math.PI*2.2;
      G.horse.player.pos.set(x+Math.cos(a)*6,0,z+Math.sin(a)*6);
      G.horse.player.speed=9; window.advanceTime(70);
     }
    }else{
     G.horse.player.pos.set(x,0,z);
     G.horse.player.speed=f.gait==='halt'?0:f.gait==='walk'?1.5:f.gait==='trot'?5:9;
     window.advanceTime((f.hold?f.hold*1000:0)+900);
    }
   }
   await new Promise(r=>setTimeout(r,700));
   return document.getElementById('resultPanel').innerText||'';
  };
  const d=await ride('d1');
  out.dDone=G.course.get()===null;
  out.dSheet=d.includes('The test, figure by figure');
  out.dFigures=(d.match(/\d+\/10/g)||[]).length;
  out.dMark=/Final mark\s*\n?\s*\d+%/.test(d.replace(/\n/g,'\n'));
  out.dTxt=d.slice(0,500);
  const s2=await ride('s1');
  out.sDone=G.course.get()===null;
  out.sTurnout=/Turnout \d+%/.test(s2);
  out.sParts=['Coat & grooming','Mane & tail','Tack turnout','Manners'].filter(k=>s2.includes(k)).length;
  out.sPattern=s2.includes('The pattern');
  out.sTxt=s2.slice(0,500);
  return out;
 });
 check('a dressage test ends on its own score sheet, figure by figure',
  r12.dDone&&r12.dSheet&&r12.dFigures>=5,{sheet:r12.dSheet,figures:r12.dFigures,txt:r12.dTxt});
 check('a showmanship class ends on the turnout breakdown the judge marked',
  r12.sDone&&r12.sTurnout&&r12.sParts>=3&&r12.sPattern,{turnout:r12.sTurnout,parts:r12.sParts,txt:r12.sTxt});

 /* ---------------------------------------------------------------- done ----------------- */
 const state=await page.evaluate(()=>render_game_to_text());
 console.log('\nladder state: '+JSON.stringify(JSON.parse(state).ladder));
 const real=errors.filter(e=>!/favicon|Breed model unavailable|WebGL|GPU stall|preload|Texture marked/i.test(e));
 check('no console or page errors',real.length===0,real.slice(0,6));
 await browser.close();
 const failed=checks.filter(c=>!c.ok);
 console.log('\n'+(checks.length-failed.length)+'/'+checks.length+' checks passed in '+((Date.now()-t0)/1000).toFixed(1)+'s');
 if(failed.length){console.log('FAILED: '+failed.map(f=>f.name).join(' | '));process.exitCode=1;}
})().catch(async e=>{console.error(e);try{if(browser)await browser.close();}catch(_){}process.exit(2);});

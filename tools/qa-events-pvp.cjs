/* Feature package 'events-pvp' — headless verification.
   Boots ranch3d.html?qa=events-pvp, waits for the horse, then drives every feature in the
   package through window.__features (G) and reads the results back out of the save, the
   panels and render_game_to_text().

   Usage:  QA_URL=http://127.0.0.1:8431 NODE_PATH=$(npm root -g) node tools/qa-events-pvp.cjs */
const {chromium}=require('playwright');
const base=(process.env.QA_URL||'http://127.0.0.1:8431').replace(/\/$/,'');
const url=base+'/ranch3d.html?qa=events-pvp&fresh='+Date.now();
const checks=[];
function check(name,ok,detail){checks.push({name,ok:!!ok,detail});console.log((ok?'PASS ':'FAIL ')+name+(detail!==undefined?' — '+JSON.stringify(detail):''));}
const t0=Date.now();
const stage=s=>console.log('… '+s+' @'+((Date.now()-t0)/1000).toFixed(1)+'s');
let browser=null;
setTimeout(async()=>{console.error('WATCHDOG: no result after 600 s');try{if(browser)await browser.close();}catch(e){}process.exit(3);},600000).unref();

(async()=>{
 browser=await chromium.launch({headless:true,args:['--disable-background-timer-throttling','--use-angle=metal','--enable-gpu-rasterization','--ignore-gpu-blocklist']});
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 const errors=[];
 page.on('pageerror',e=>errors.push('PAGEERROR '+e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 page.on('dialog',d=>{d.dismiss().catch(()=>{});});
 stage('launch'); await page.goto(url,{waitUntil:'load',timeout:120000}); stage('loaded');
 await page.waitForFunction(()=>window.render_game_to_text&&(()=>{try{const s=JSON.parse(render_game_to_text());return s.graphics&&s.graphics.horseReady&&!s.graphics.horseLoading;}catch(e){return false;}})(),null,{timeout:180000,polling:250});
 stage('horseReady');
 /* every toast the package raises, kept — #toasts only ever holds the one on screen, and the
    queue drains on real timers that a headless run outpaces */
 await page.evaluate(()=>{const G=window.__features;window.__toasts=[];const t0=G.toast;
  G.toast=m=>{window.__toasts.push(String(m));return t0(m);};});
 const toasted=re=>page.evaluate(r=>(window.__toasts||[]).some(t=>new RegExp(r).test(t)),re);

 /* ---------------------------------------------------------------- 1. install ---------- */
 const r1=await page.evaluate(()=>{
  const G=window.__features, E=G&&G.events, T=G&&G.tables;
  const out={hasG:!!G,hasE:!!E,installed:G?G.installed.slice():[],errors:G?G.errors.slice():[]};
  if(!E)return out;
  const st=JSON.parse(render_game_to_text());
  out.state={racing:st.racing,arena:st.arena,champ:st.champ&&st.champ.n};
  out.evIds=T.EVENTS3.map(e=>e.id);
  out.showRows=T.EVENTS3.filter(e=>e.kind==='show').map(e=>e.id);
  out.dressRows=T.EVENTS3.filter(e=>e.dressage&&e.kind!=='show').map(e=>e.id);
  out.gtRow=T.EVENTS3.find(e=>e.gauntlet)||null;
  out.items=Object.keys(T.RACE_ITEMS);
  out.ranks=E.RACE_RANKS.length; out.ladder=E.LB_PRIZES.length; out.bundles=E.BUNDLES3.length;
  out.venues=E.CHAMP_VENUES.length; out.calls=E.FIGURE_CALLS.length; out.showParts=E.SHOW_PARTS.length;
  out.partsSum=+E.SHOW_PARTS.reduce((a,p)=>a+p.w,0).toFixed(3);
  out.raceTraits=T.EVENTS3.filter(e=>e.race&&!e.gauntlet).map(e=>[e.id,(e.traits||[]).length]);
  out.dressFigs={}; for(const id of ['d1','d2','d3','d4','d5','d6','dance','s1','s2','s3']){const f=G.course.DRESSAGE_TESTS[id];out.dressFigs[id]=f?f.length:0;}
  out.lettersOk=['d3','d4','d5','d6','dance','s1','s2','s3'].every(id=>(G.course.DRESSAGE_TESTS[id]||[]).every(f=>G.course.ARENA_LETTERS[f.at]));
  out.tix=E.tix(G.save.fresh());
  out.board=(T.BOARDS||[]).some(b=>b.k==='racing');
  return out;
 });
 check('module installed with no errors',r1.hasG&&r1.hasE&&!r1.errors.some(e=>e.id==='events-pvp'),{errors:r1.errors});
 check('three showmanship classes',r1.showRows&&r1.showRows.length===3,r1.showRows);
 check('six scored dressage tests + the dance',r1.dressRows&&r1.dressRows.length>=6&&r1.dressFigs.dance>=5,{rows:r1.dressRows,figs:r1.dressFigs});
 check('every test figure names a real arena letter',r1.lettersOk);
 check('seasonal gauntlet row exists',!!r1.gtRow&&r1.gtRow.kind==='gauntlet',r1.gtRow&&{id:r1.gtRow.id,name:r1.gtRow.name,limit:r1.gtRow.limit});
 check('six race pick-ups incl. shield/mud/bale',r1.items.length>=6&&['shield','mud','bale'].every(k=>r1.items.includes(k)),r1.items);
 check('every race advertises 1–3 favoured traits',r1.raceTraits.every(([,n])=>n>=1&&n<=3),r1.raceTraits);
 check('six racing ranks, seven-step prize ladder, four bundles',r1.ranks===6&&r1.ladder===7&&r1.bundles===4,{ranks:r1.ranks,ladder:r1.ladder,bundles:r1.bundles});
 check('four championship venues, seven figure calls, five turnout parts summing to 1',
  r1.venues===4&&r1.calls===7&&r1.showParts===5&&r1.partsSum===1,{v:r1.venues,c:r1.calls,p:r1.showParts,sum:r1.partsSum});
 /* 3 from the race book's own daily refill, plus the one the daily gift grants through
    account-economy, which the book absorbs. Assert the floor, not an exact count, so a
    package that legitimately hands out a ticket does not fail this check. */
 check('a fresh save starts with at least 3 race tickets',r1.tix>=3,r1.tix);
 check('racing points board registered',r1.board);
 check('render_game_to_text carries racing/arena/champ',!!r1.state&&r1.state.racing&&r1.state.arena,r1.state);

 /* ---------------------------------------------------------------- 2. championship ----- */
 const r2=await page.evaluate(()=>{
  const G=window.__features, E=G.events, out={};
  G.save.sync(s=>{s.ribbons={h1:3,h2:2,a1:2,b1:2};s.ribbonGold={};});
  out.three=E.champQualified(G.save.fresh()).n;
  document.getElementById('eventsBtn').click();
  const txt=document.getElementById('eventsPanel').innerText;
  out.panelQual=txt.includes('Basin Championship · qualifiers');
  out.panelKit=txt.includes('Themed kits');
  out.panelTrial=txt.includes(E.GTD.name);
  out.panelQualifier=txt.includes('qualifier');
  document.getElementById('eventsBtn').click();
  /* the Final refuses the entry */
  const w2=G.tables.EVENTS3.find(e=>e.id==='w2');
  G.save.sync(s=>{s.horses[G.horse.rideIdx()].level=12;const st=s.horses[G.horse.rideIdx()].stats;for(const k in st)st[k]=10;});
  G.horse.reloadHorses();
  G.course.startCourse(w2);
  out.lockedCourse=G.course.get()?G.course.get().ev.id:null;
  /* qualify the fourth venue */
  G.save.sync(s=>{s.ribbons.w1=2;});
  out.four=E.champQualified(G.save.fresh()).n;
  G.course.startCourse(w2);
  out.openCourse=G.course.get()?G.course.get().ev.id:null;
  G.course.cancelCourse();
  return out;
 });
 check('three venues qualified out of four',r2.three===3,r2.three);
 check('the Final is locked until all four venues are signed off',r2.lockedCourse===null,r2.lockedCourse);
 check('the Final opens on the fourth venue',r2.four===4&&r2.openCourse==='w2',{n:r2.four,course:r2.openCourse});
 check('the Events panel shows the qualifier card, the trial and the kits',r2.panelQual&&r2.panelTrial&&r2.panelKit&&r2.panelQualifier,r2);

 /* ---------------------------------------------------------------- 3. showmanship ------ */
 const r3=await page.evaluate(async()=>{
  const G=window.__features, E=G.events, out={};
  /* a badly turned-out horse */
  G.save.sync(s=>{const h=s.horses[G.horse.rideIdx()];h.needs.clean=15;h.bond=10;h.gear={};h.hair={mane:'natural',tail:'natural'};});
  G.horse.reloadHorses();
  out.low=+E.turnoutOf(G.save.fresh(),G.horse.ridden()).total.toFixed(3);
  G.course.startCourse(G.tables.EVENTS3.find(e=>e.id==='s1'));
  let c=G.course.get();
  out.lowCourse={show:!!c.show,dress:!!c.dressage,turnout:+c.turnout.toFixed(3),figs:c.figs.length,
   gaits:[...new Set(c.figs.map(f=>f.gait))]};
  G.course.cancelCourse();
  /* a well turned-out one: clean, bonded, four pieces of tack, a matching set */
  G.save.sync(s=>{
   const h=s.horses[G.horse.rideIdx()];h.needs.clean=100;h.bond=100;h.hair={mane:'braided',tail:'banged'};
   s.tack=s.tack||[];h.gear={};
   for(const sl of G.tables.GEAR_SLOTS){const it=G.horse.genGear('Legendary',sl,{set:'Champion'});s.tack.push(it);h.gear[sl]=it.id;}
  });
  G.horse.refreshTack(); G.horse.reloadHorses();
  out.high=+E.turnoutOf(G.save.fresh(),G.horse.ridden()).total.toFixed(3);
  G.course.startCourse(G.tables.EVENTS3.find(e=>e.id==='s1'));
  c=G.course.get(); out.highTurnout=+c.turnout.toFixed(3);
  /* ride the pattern: teleport to each letter, halt, hold */
  window.advanceTime(4200);
  for(let n=0;n<40&&G.course.get();n++){
   const cc=G.course.get(); const f=cc.figs[cc.fi]; if(!f)break;
   const [x,z]=G.course.ARENA_LETTERS[f.at];
   G.horse.player.pos.set(x,0,z); G.horse.player.speed=0;
   window.advanceTime((f.hold?f.hold*1000:0)+900);
  }
  await new Promise(r=>setTimeout(r,120));
  out.finished=G.course.get()===null;
  const s=G.save.fresh();
  out.bestScore=s.bestScore&&s.bestScore.s1; out.showBest=s.showBest&&s.showBest.s1;
  return out;
 });
 check('a scruffy horse scores badly on turnout',r3.low<0.5,r3.low);
 check('a groomed, tacked, bonded horse scores well',r3.high>0.9,r3.high);
 check('showmanship runs on the dressage engine at walk/halt only',
  r3.lowCourse&&r3.lowCourse.show&&r3.lowCourse.dress&&r3.lowCourse.gaits.every(g=>g==='walk'||g==='halt'),r3.lowCourse);
 check('the class finishes and records a turnout-blended score',r3.finished&&typeof r3.bestScore==='number'&&typeof r3.showBest==='number',{best:r3.bestScore,show:r3.showBest});
 check('the finish names the turnout',await toasted('[Tt]urnout .*handling'));

 /* ---------------------------------------------------------------- 4. arena ------------ */
 const r4=await page.evaluate(()=>{
  const G=window.__features, E=G.events, out={};
  E.setFreestyle(true);
  let st=JSON.parse(render_game_to_text());
  out.letters=st.arena.letters; out.mode=st.mode; out.free=st.arena.freestyle;
  out.hud=document.getElementById('courseHudTxt').textContent;
  E.callFigure();
  E.setFreestyle(false);
  out.after=JSON.parse(render_game_to_text()).arena.letters;
  /* the grandstand seat */
  const cam0=JSON.parse(render_game_to_text()).camera;
  E.setSpectate(true); window.advanceTime(1500);
  const cam1=JSON.parse(render_game_to_text()).camera;
  out.moved=Math.abs(cam1.x-cam0.x)>3||Math.abs(cam1.z-cam0.z)>3;
  out.spectating=JSON.parse(render_game_to_text()).arena.spectate;
  E.setSpectate(false);
  /* the Dance of Harmony */
  E.startDance('QA',true);
  const c=G.course.get();
  out.dance=c?c.ev.id:null; out.danceFigs=c?c.figs.length:0;
  G.course.cancelCourse();
  return out;
 });
 check('the freestyle arena puts nine letters up with no course running',r4.letters===9&&r4.mode==='free_roam'&&r4.free,{letters:r4.letters,mode:r4.mode});
 check('the freestyle HUD explains itself',/Freestyle/.test(r4.hud||''),r4.hud);
 check('a formation call is announced',await toasted('You call:'));
 check('the letters come down again',r4.after===0,r4.after);
 check('the grandstand seat moves the camera to the stand',r4.moved&&r4.spectating,{moved:r4.moved});
 check('the Dance of Harmony starts as a shared routine',r4.dance==='dance'&&r4.danceFigs===5,{id:r4.dance,figs:r4.danceFigs});

 /* ---------------------------------------------------------------- 5. gauntlet --------- */
 const r5=await page.evaluate(async()=>{
  const G=window.__features, E=G.events, out={};
  const gt=G.tables.EVENTS3.find(e=>e.gauntlet);
  const g0=G.renderer?0:0;
  G.course.startCourse(gt);
  window.advanceTime(4200);
  let st=JSON.parse(render_game_to_text());
  out.gauntlet=st.course&&st.course.gauntlet; out.total=st.course&&st.course.total;
  out.kinds=st.course&&st.course.gtKinds?[...new Set(st.course.gtKinds)]:[];
  out.hazards=st.course&&st.course.hazards;
  /* a hazard costs a second */
  const c=G.course.get(); const hz=c.hazards&&c.hazards[0];
  if(hz){const t0=c.t;G.horse.player.pos.set(hz.x,0,hz.z);G.horse.player.speed=8;window.advanceTime(120);out.hazardCost=+(G.course.get()?G.course.get().t-t0:0).toFixed(2);}
  /* over the limit and it is called off */
  G.course.get().t=(gt.limit||150)+5;
  window.advanceTime(200);
  await new Promise(r=>setTimeout(r,120));
  out.timedOut=JSON.parse(render_game_to_text()).mode;
  return out;
 });
 check('the gauntlet is a mixed loop',r5.gauntlet&&r5.total>=10&&r5.kinds.length>=3,{total:r5.total,kinds:r5.kinds});
 check('hazards are laid on the route',r5.hazards>=4,r5.hazards);
 check('hitting a hazard costs time',r5.hazardCost>=1,r5.hazardCost);
 check('the gauntlet times out at its hard limit',r5.timedOut==='free_roam',r5.timedOut);

 /* ---------------------------------------------------------------- 6. traits + a race -- */
 const r6=await page.evaluate(()=>{
  const G=window.__features, E=G.events, out={};
  const pp=G.tables.EVENTS3.find(e=>e.id==='pp');
  G.save.sync(s=>{const h=s.horses[G.horse.rideIdx()];h.gear={};for(const k in h.stats)h.stats[k]=3;h.sxp={};});
  G.horse.refreshTack(); G.horse.reloadHorses();
  out.mulLow=+E.raceTraitMul(pp,G.horse.ridden()).toFixed(4);
  G.save.sync(s=>{const h=s.horses[G.horse.rideIdx()];for(const k in h.stats)h.stats[k]=10;});
  G.horse.reloadHorses();
  out.mulHigh=+E.raceTraitMul(pp,G.horse.ridden()).toFixed(4);
  out.matches=E.traitMatches(pp,G.horse.ridden());
  /* ride it on a horse with room to improve, so the stat XP lands somewhere */
  G.save.sync(s=>{const h=s.horses[G.horse.rideIdx()];for(const k in h.stats)h.stats[k]=4;h.sxp={};});
  G.horse.reloadHorses();
  /* ride it: teleport gate to gate */
  const before=G.save.fresh();
  out.sxp0=JSON.parse(JSON.stringify(before.horses[G.horse.rideIdx()].sxp||{}));
  out.coins0=before.coins; out.btok0=before.btok||0; out.tix0=E.tix(before);
  G.course.startCourse(pp);
  const c=G.course.get(); out.traitMul=+(c.traitMul||1).toFixed(3);
  window.advanceTime(4200);
  for(let n=0;n<40&&G.course.get();n++){
   const cc=G.course.get(); const j=cc.jumps[cc.idx]; if(!j)break;
   G.horse.player.pos.set(j.x,0,j.z); G.horse.player.speed=6; window.advanceTime(120);
  }
  out.done=G.course.get()===null;
  const after=G.save.fresh();
  out.racing=after.racing; out.sxp1=after.horses[G.horse.rideIdx()].sxp||{};
  out.coins1=after.coins; out.btok1=after.btok||0; out.tix1=E.tix(after);
  return out;
 });
 check('favoured traits give a matching horse a real edge',r6.mulHigh>1.0&&r6.mulLow<=1.0001&&r6.matches.length>=1,{low:r6.mulLow,high:r6.mulHigh,matches:r6.matches});
 check('the course carries a trait multiplier',r6.traitMul>=1,r6.traitMul);
 check('finishing a race pays racing points',r6.done&&r6.racing&&r6.racing.races===1&&r6.racing.pts>=15,r6.racing);
 check('a race pays stat XP into the favoured stats',Object.keys(r6.sxp1).some(k=>(r6.sxp1[k]||0)>0),{before:r6.sxp0,after:r6.sxp1});
 check('a race pays coins',r6.coins1>r6.coins0,{before:r6.coins0,after:r6.coins1});
 check('a solo race costs no ticket',r6.tix1===r6.tix0,{before:r6.tix0,after:r6.tix1});
 check('the finish reports the racing points',await toasted('racing points'));

 /* ---------------------------------------------------------------- 7. PvP + items ------ */
 const r7=await page.evaluate(async()=>{
  const G=window.__features, E=G.events, out={};
  const tix0=E.tix(G.save.fresh());
  /* a rival's challenge arrives over the club chat */
  G.net.onMessage('srf1/qa/chat',JSON.stringify({id:'qa-rival',n:'Ada',t:'🏁 challenges you',race:{e:'pp',at:Date.now()+3000,seed:77}}));
  out.offer=E.PVP.offer?E.PVP.offer.ev.id:null; out.by=E.PVP.offer&&E.PVP.offer.by;
  E.joinPvp();
  const c=G.course.get();
  out.joined=c?{pvp:!!c.pvp,id:c.ev.id,cd:+c.cd.toFixed(1)}:null;
  out.tixSpent=tix0-E.tix(G.save.fresh());
  window.advanceTime(4200);
  /* a rival three gates ahead puts us second */
  E.PVP.rivals['Ada']={n:'Ada',i:3,t:4};
  window.advanceTime(200);
  let st=JSON.parse(render_game_to_text());
  out.place=st.course&&st.course.place; out.field=st.course&&st.course.field;
  out.hud=document.getElementById('pvpHud').textContent;
  /* the shield, then a rival's mud slick */
  G.tables.RACE_ITEMS.shield.fx();
  out.shield=JSON.parse(render_game_to_text()).player.shield;
  G.net.onMessage('srf1/qa/chat',JSON.stringify({id:'qa-rival',n:'Ada',t:'mud',race:{hit:'mud'}}));
  out.slipWhileShielded=JSON.parse(render_game_to_text()).player.slip;
  G.horse.player.shieldT=0;
  G.net.onMessage('srf1/qa/chat',JSON.stringify({id:'qa-rival',n:'Ada',t:'mud',race:{hit:'mud'}}));
  out.slip=JSON.parse(render_game_to_text()).player.slip;
  /* a bale thrown onto the track becomes a hazard */
  const hz0=(G.course.get().hazards||[]).length;
  G.net.onMessage('srf1/qa/chat',JSON.stringify({id:'qa-rival',n:'Ada',t:'bale',race:{hz:[G.horse.player.pos.x+2,G.horse.player.pos.z]}}));
  out.baleAdded=(G.course.get().hazards||[]).length-hz0;
  G.course.cancelCourse();
  window.advanceTime(80);
  /* a race quit before the gate drops hands the ticket back */
  const tixA=E.tix(G.save.fresh());
  G.net.onMessage('srf1/qa/chat',JSON.stringify({id:'qa-rival',n:'Ada',t:'again',race:{e:'pp',at:Date.now()+9000,seed:78}}));
  E.joinPvp();
  out.tixTaken=tixA-E.tix(G.save.fresh());
  out.notStarted=!G.course.get().started;
  G.course.cancelCourse();
  window.advanceTime(80);
  out.tixBack=E.tix(G.save.fresh())-(tixA-1);
  /* a friendly race takes no ticket and pays nothing */
  const t2=E.tix(G.save.fresh()), coins0=G.save.fresh().coins;
  E.startFriendly('pp');
  const f=G.course.get();
  out.friendly=f?{fr:!!f.friendly,reward:f.ev.reward,tix:E.tix(G.save.fresh())===t2}:null;
  G.course.cancelCourse();
  /* run the ticket book down */
  G.save.sync(s=>{s.tix.n=2;});
  out.spend=[E.spendTicket(),E.spendTicket(),E.spendTicket()];
  out.left=E.tix(G.save.fresh());
  G.save.sync(s=>{s.tix.n=3;});
  return out;
 });
 check('a club challenge arrives and can be joined',r7.offer==='pp'&&r7.by==='Ada'&&r7.joined&&r7.joined.pvp,{offer:r7.offer,joined:r7.joined});
 check('joining a challenge race spends one ticket',r7.tixSpent===1,r7.tixSpent);
 check('the countdown is aligned to the shared start',r7.joined&&r7.joined.cd>1&&r7.joined.cd<=4,r7.joined&&r7.joined.cd);
 check('live placement puts you behind a rival who is ahead',r7.place===2&&r7.field===1,{place:r7.place,field:r7.field});
 check('the PvP HUD shows the placing',/P2\/2/.test(r7.hud||''),r7.hud);
 check('the shield blocks a rival mud slick',r7.shield>5&&r7.slipWhileShielded===0,{shield:r7.shield,slip:r7.slipWhileShielded});
 check('an unshielded rider is slicked',r7.slip>1,r7.slip);
 check('a rival hay bale becomes a hazard on your track',r7.baleAdded===1,r7.baleAdded);
 check('a ticket comes back when the race never started',r7.tixTaken===1&&r7.tixBack===1,{taken:r7.tixTaken,back:r7.tixBack});
 check('a friendly race is free and pays nothing',r7.friendly&&r7.friendly.fr&&r7.friendly.reward===0&&r7.friendly.tix,r7.friendly);
 check('the ticket book runs out and says so',JSON.stringify(r7.spend)==='[true,true,false]'&&r7.left===0&&await toasted('No race tickets'),{spend:r7.spend,left:r7.left});

 /* ---------------------------------------------------------------- 8. ranks ------------ */
 const r8=await page.evaluate(()=>{
  const G=window.__features, E=G.events, out={};
  G.save.sync(s=>{s.racing={pts:120,races:4,wins:1,pvp:1,claimed:{}};});
  out.rank=E.rankIdx(120);
  document.getElementById('pvpBtn').click();
  const p=document.getElementById('pvpPanel');
  out.panel=p.innerText.slice(0,400);
  out.hasBtn=!!p.querySelector('[data-fx="epvp:rank:1"]');
  out.hasTix=p.innerText.includes('Race tickets');
  out.hasLadder=p.innerText.includes('Bronze Bit')&&p.innerText.includes('Basin Champion');
  out.hasItems=p.innerText.includes('Kestrel feather')&&p.innerText.includes('Hay bale');
  out.hasFriendly=p.innerText.includes('Friendly races');
  const before=G.save.fresh();
  out.c0=before.coins; out.t0=E.tix(before);
  p.querySelector('[data-fx="epvp:rank:1"]').click();
  const after=G.save.fresh();
  out.c1=after.coins; out.t1=E.tix(after); out.claimed=!!after.racing.claimed[1];
  E.claimRank(1);
  out.c2=G.save.fresh().coins;
  document.getElementById('pvpBtn').click();
  return out;
 });
 check('the Race Club panel shows tickets, the ladder, the items and friendly races',
  r8.hasTix&&r8.hasLadder&&r8.hasItems&&r8.hasFriendly,{panel:r8.panel});
 check('120 points is the Bronze Bit rank with a claim button',r8.rank===1&&r8.hasBtn,{rank:r8.rank});
 check('claiming a rank pays its coins and tickets',r8.c1-r8.c0===300&&r8.t1-r8.t0===3&&r8.claimed,{dc:r8.c1-r8.c0,dt:r8.t1-r8.t0});
 check('a rank cannot be claimed twice',r8.c2===r8.c1,{c1:r8.c1,c2:r8.c2});

 /* ---------------------------------------------------------------- 9. weekly boards ---- */
 const r9=await page.evaluate(()=>{
  const G=window.__features, E=G.events, out={};
  const wk=G.time.weekKey(), feat=G.course.weeklyFeatured();
  out.featured=feat.map(e=>e.id);
  const ev=feat[0];
  /* ridden, but no gold: not ranked */
  G.save.sync(s=>{s.weekly={week:wk,rib:{},claimed:{},times:{[ev.id]:14.2},gold:{}};});
  out.noGold=E.myPlace(E.weeklyRows(ev,G.save.fresh()));
  /* gold: ranked */
  G.save.sync(s=>{s.weekly.gold[ev.id]=true;});
  const rows=E.weeklyRows(ev,G.save.fresh());
  out.rows=rows.length; out.place=E.myPlace(rows); out.sorted=rows.every((r,i)=>i===0||rows[i-1].v<=r.v);
  /* the Boards → Week tab */
  document.getElementById('lbBtn').click();
  document.querySelector('#lbPanel [data-lbtab="week"]').click();
  const txt=document.getElementById('lbPanel').innerText;
  out.weekTab=txt.includes("This week's leaderboard events");
  out.goldRule=/gold ribbon/i.test(txt);
  out.ladderShown=txt.includes('101st–1000th');
  out.evShown=txt.includes(ev.name);
  document.getElementById('lbBtn').click();
  /* Monday: settle last week */
  G.save.sync(s=>{s.weekly.week='1999-01-04';s.lbLast=null;E.settleWeek(s,true);});
  const L=G.save.fresh().lbLast;
  out.settled=L&&L.prizes?L.prizes.length:0; out.place2=L&&L.prizes&&L.prizes[0]&&L.prizes[0].place;
  /* claim them */
  const b=G.save.fresh();
  out.k0=b.keys||0; out.g0=b.gems; out.h0=b.horses.length; out.tk0=(b.tack||[]).length;
  E.claimLbPrizes();
  const a=G.save.fresh();
  out.k1=a.keys||0; out.g1=a.gems; out.h1=a.horses.length; out.tk1=(a.tack||[]).length; out.claimed=a.lbLast.claimed;
  E.claimLbPrizes();
  out.k2=G.save.fresh().keys||0;
  out.ladderTiers=E.LB_PRIZES.map(p=>p.place);
  out.prizeFor={p1:E.prizeFor(1).label,p7:E.prizeFor(7).label,p40:E.prizeFor(40).label,p900:E.prizeFor(900).label};
  return out;
 });
 check('four events are featured each week',r9.featured&&r9.featured.length===4,r9.featured);
 check('a finish without a gold ribbon is not ranked',r9.noGold===0,r9.noGold);
 check('a gold ribbon puts you on the weekly board, sorted by time',r9.place>0&&r9.rows>=9&&r9.sorted,{place:r9.place,rows:r9.rows});
 check('the Week tab lists the leaderboard events, the gold rule and the ladder',r9.weekTab&&r9.goldRule&&r9.ladderShown&&r9.evShown,r9);
 check('the ladder is the seven-step SE ladder',JSON.stringify(r9.ladderTiers)==='[1,2,3,10,25,100,1000]',r9.ladderTiers);
 check('a place maps to the right rung',r9.prizeFor.p1==='1st'&&r9.prizeFor.p7==='4th–10th'&&r9.prizeFor.p40==='26th–100th'&&r9.prizeFor.p900==='101st–1000th',r9.prizeFor);
 check('Monday settles last week into claimable prizes',r9.settled>=1&&r9.place2>0,{n:r9.settled,place:r9.place2});
 check('claiming pays out and marks the week claimed',(r9.k1>r9.k0||r9.g1>r9.g0||r9.h1>r9.h0||r9.tk1>r9.tk0)&&r9.claimed,
  {keys:[r9.k0,r9.k1],gems:[r9.g0,r9.g1],horses:[r9.h0,r9.h1],tack:[r9.tk0,r9.tk1]});
 check('prizes cannot be claimed twice',r9.k2===r9.k1,{k1:r9.k1,k2:r9.k2});

 /* ---------------------------------------------------------------- 10. bundles --------- */
 const r10=await page.evaluate(()=>{
  const G=window.__features, E=G.events, out={};
  const b=E.BUNDLES3.find(x=>x.id==='bounty');
  G.save.sync(s=>{s.trophies=s.trophies||{};for(const id of b.need.slice(0,2))s.trophies[id]=true;s.bundles={};});
  out.partial=E.bundleHave(G.save.fresh(),b);
  E.claimBundle('bounty');
  out.blocked=!G.save.fresh().bundles.bounty;
  G.save.sync(s=>{for(const id of b.need)s.trophies[id]=true;});
  const before=G.save.fresh();
  out.h0=before.horses.length; out.tk0=(before.tack||[]).length; out.c0=before.coins; out.car0=(before.items||{}).carrot||0;
  E.claimBundle('bounty');
  const a=G.save.fresh();
  out.h1=a.horses.length; out.tk1=(a.tack||[]).length; out.c1=a.coins; out.car1=(a.items||{}).carrot||0;
  out.breed=a.horses[a.horses.length-1].breed;
  out.setPieces=(a.tack||[]).filter(t=>t.bundle==='bounty').map(t=>G.horse.gearSet(t));
  out.shirt=a.rider&&a.rider.shirt;
  out.claimedAt=!!a.bundles.bounty;
  E.claimBundle('bounty');
  const a2=G.save.fresh();
  out.h2=a2.horses.length; out.c2=a2.coins;
  out.ready=JSON.parse(render_game_to_text()).graphics.horseReady;
  return out;
 });
 check('a bundle is locked until every trophy is in',r10.partial===2&&r10.blocked,{have:r10.partial});
 check('claiming a kit grants the horse, the four set pieces, the outfit, the hamper and the coins',
  r10.h1-r10.h0===1&&r10.tk1-r10.tk0===4&&r10.c1-r10.c0===600&&r10.car1-r10.car0===20&&r10.breed==='palomino'
  &&r10.setPieces.length===4&&r10.setPieces.every(s=>s==='Coyote')&&r10.shirt==='#b34a4a',
  {dh:r10.h1-r10.h0,dt:r10.tk1-r10.tk0,dc:r10.c1-r10.c0,dcar:r10.car1-r10.car0,breed:r10.breed,sets:r10.setPieces,shirt:r10.shirt});
 check('a kit cannot be claimed twice',r10.h2===r10.h1&&r10.c2===r10.c1,{h:[r10.h1,r10.h2],c:[r10.c1,r10.c2]});
 check('the horse is still standing after the grant',r10.ready);

 /* ---------------------------------------------------------------- 11. dailies --------- */
 const r11=await page.evaluate(()=>{
  const G=window.__features, out={};
  out.dailies=G.quest.DAILYQ.filter(q=>['race','pvpwin','show','freestyle'].includes(q.type)).map(q=>q.type);
  out.achs=G.quest.ACHS.filter(a=>['champq','show95','gaunt3','rankgold','pvpwin5','bt5','bundle1','dress6'].includes(a.id)).map(a=>a.id);
  out.story=G.quest.story.list().some(m=>m.type==='champq');
  out.shopTab=(()=>{document.getElementById('shopBtn').click();const ok=!!document.querySelector('#shopPanel [data-shoptab="race"],#shopPanel [data-shop="race"],#shopPanel button');const txt=document.getElementById('shopPanel').innerText;document.getElementById('shopBtn').click();return txt.length>0;})();
  return out;
 });
 check('four new daily quests are registered',r11.dailies.length===4,r11.dailies);
 check('eight new achievements are registered',r11.achs.length===8,r11.achs);
 check('the championship mission is in the story',r11.story);

 /* ---------------------------------------------------------------- done --------------- */
 const state=await page.evaluate(()=>render_game_to_text());
 console.log('\nstate: '+state.slice(0,900)+'…');
 const real=errors.filter(e=>!/favicon|Breed model unavailable|WebGL|GPU stall/i.test(e));
 check('no console or page errors',real.length===0,real.slice(0,6));
 await browser.close();
 const failed=checks.filter(c=>!c.ok);
 console.log('\n'+(checks.length-failed.length)+'/'+checks.length+' checks passed in '+((Date.now()-t0)/1000).toFixed(1)+'s');
 if(failed.length){console.log('FAILED: '+failed.map(f=>f.name).join(' | '));process.exitCode=1;}
})().catch(async e=>{console.error(e);try{if(browser)await browser.close();}catch(_){}process.exit(2);});

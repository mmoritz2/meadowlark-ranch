/* Feature package 'seasons' — end-to-end check.
   Boots ranch3d.html?qa=seasons against a local server, waits for the horse, and drives the
   season spine through the real page: the ?season= override and its runtime twin, the
   per-season pass layers, the weekly challenges that open the gold row without a gem, the
   token wallet chip, the season store (an outfit that repaints the rider, a tint that paints
   the saddle, decor that turns up in the build catalogue, a tack set in the locker), the
   special-event card at the top of the Events panel and the season-track screen.

   Every assertion is a change a player would see: a save field, a DOM node, a table entry.

   Usage:  QA_URL=http://127.0.0.1:8511 NODE_PATH=$(npm root -g) node tools/qa-seasons.cjs */
const {chromium}=require('playwright');
const base=(process.env.QA_URL||'http://127.0.0.1:8511').replace(/\/$/,'');
const url=base+'/ranch3d.html?qa=seasons&fresh='+Date.now();
const checks=[];
function check(name,ok,detail){checks.push({name,ok:!!ok,detail});console.log((ok?'PASS ':'FAIL ')+name+(detail!==undefined?' — '+JSON.stringify(detail):''));}
const t0=Date.now();
const stage=s=>console.log('… '+s+' @'+((Date.now()-t0)/1000).toFixed(1)+'s');
let browser=null;
setTimeout(async()=>{console.error('WATCHDOG: no result after 600 s');try{if(browser)await browser.close();}catch(e){}process.exit(3);},600000).unref();

const READY=()=>window.render_game_to_text&&(()=>{try{const s=JSON.parse(render_game_to_text());return s.graphics&&s.graphics.horseReady&&!s.graphics.horseLoading;}catch(e){return false;}})();

(async()=>{
 browser=await chromium.launch({headless:true,args:['--disable-background-timer-throttling','--use-angle=metal','--enable-gpu-rasterization','--ignore-gpu-blocklist']});
 const page=await browser.newPage({viewport:{width:1280,height:900}});
 const errors=[];
 page.on('pageerror',e=>errors.push('PAGEERROR '+e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 page.on('dialog',d=>{d.dismiss().catch(()=>{});});
 stage('launch'); await page.goto(url,{waitUntil:'load',timeout:120000}); stage('loaded');
 await page.waitForFunction(READY,null,{timeout:150000,polling:250});
 stage('horseReady');

 /* ---- 0. the package installed at all ------------------------------------------------ */
 const boot=await page.evaluate(()=>{
  const G=window.__features;
  return {hasG:!!G,installed:!!G&&G.installed.indexOf('seasons')>=0,
   errs:!!G?G.errors.map(e=>e.id+': '+e.error):['no G'],
   hasSeam:!!(G&&G.seasons&&typeof G.seasons.now==='function'&&typeof G.seasons.buy==='function')};
 });
 check('package installs with no feature error',boot.hasG&&boot.installed&&boot.errs.length===0,boot.errs);
 check('G.seasons seam is exported',boot.hasSeam);

 /* ---- 1. the season override ---------------------------------------------------------- */
 const ov=await page.evaluate(()=>{
  const G=window.__features, out={};
  out.real=G.seasons.raw().def.id;
  out.sweep=['bloom','sun','ember','frost'].map(id=>{
   G.seasons.override(id);
   return {ask:id,seasons:G.seasons.now().def.id,gtime:G.time.seasonNow().def.id,
    key:G.seasons.now().key,day:G.seasons.now().day,left:G.seasons.now().daysLeft,
    items:G.seasons.items().map(i=>i.id),chal:G.seasons.challenges().map(c=>c.id),
    special:G.seasons.special().id};
  });
  out.realDay=G.seasons.raw().day;
  G.seasons.override(null);
  out.cleared=G.seasons.now().def.id;
  return out;
 });
 check('G.seasons.override re-phases every season',ov.sweep.every(r=>r.seasons===r.ask),ov.sweep.map(r=>r.ask+'→'+r.seasons));
 check('the override also moves G.time.seasonNow, so siblings agree',ov.sweep.every(r=>r.gtime===r.ask));
 check('an overridden season keeps a consistent day count',ov.sweep.every(r=>r.day===ov.realDay&&r.left>=0&&r.left<=28),{day:ov.realDay,left:ov.sweep.map(r=>r.left)});
 check('clearing the override returns to the real season',ov.cleared===ov.real,{real:ov.real,cleared:ov.cleared});
 check('each season has its own store shelf',new Set(ov.sweep.map(r=>r.items.join(','))).size===4,ov.sweep.map(r=>r.items.length));
 check('each season has its own challenges',new Set(ov.sweep.map(r=>r.chal.join(','))).size===4,ov.sweep.map(r=>r.chal[0]));
 check('each season has its own headline activity',new Set(ov.sweep.map(r=>r.special)).size===4,ov.sweep.map(r=>r.special));

 /* ---- 2. the pass: one reward table per season ---------------------------------------- */
 const pass=await page.evaluate(()=>{
  const G=window.__features, T=G.tables, out={};
  const snap=()=>({free:T.PASS_FREE.map(r=>(r.tok||0)+'/'+(r.xp||0)+'/'+(r.btok||0)).join(' '),
                   gold:T.PASS_GOLD.map(r=>(r.tok||0)+'/'+(r.xp||0)).join(' ')});
  out.byId={};
  for(const id of ['bloom','sun','ember','frost']){G.seasons.override(id);out.byId[id]=snap();}
  G.seasons.override('bloom');
  out.bloomBtok=T.PASS_FREE[4].btok;
  out.bloomTok1=T.PASS_FREE[1].tok;
  G.seasons.override('ember');
  out.emberTok0=T.PASS_FREE[0].tok;
  out.emberFree4Btok=T.PASS_FREE[4].btok;                 // bloom's stamp must have been stripped
  out.sibling={free13pet:T.PASS_FREE[13].pet,gold18pet:T.PASS_GOLD[18].pet,free19emote:T.PASS_FREE[19].emote,
   free29horse:T.PASS_FREE[29].seasonHorse,gold19horse:T.PASS_GOLD[19].seasonHorse,gold29horse:T.PASS_GOLD[29].seasonHorse,
   free29tack:T.PASS_FREE[29].tack,gold29tint:T.PASS_GOLD[29].tint,gold29gems:T.PASS_GOLD[29].g};
  out.themes=T.SEASONS.map(d=>d.id+':'+d.theme);
  out.labels={tok:G.seasons.tierLabel({tok:8}),xp:G.seasons.tierLabel({xp:200}),horse:G.seasons.tierLabel(T.PASS_FREE[29])};
  return out;
 });
 const tables=Object.keys(pass.byId).map(k=>pass.byId[k].free+'|'+pass.byId[k].gold);
 check('all four seasons pay a different thirty tiers',new Set(tables).size===4);
 check('the foal season pays breeding tokens the breeding package has not claimed',pass.bloomBtok===1&&pass.bloomTok1===4,{btok:pass.bloomBtok});
 check('a season layer is stripped when the next one is laid',pass.emberFree4Btok===undefined&&pass.emberTok0===6,{ember0:pass.emberTok0,leftover:pass.emberFree4Btok});
 check('sibling packages keep every slot they claimed',pass.sibling.free13pet==='owl'&&pass.sibling.gold18pet==='fennec'&&pass.sibling.free19emote==='guitar'&&pass.sibling.free29horse==='pass'&&pass.sibling.gold19horse==='deluxe',pass.sibling);
 check('a headline horse sits on the last tier of BOTH tracks',pass.sibling.free29horse==='pass'&&pass.sibling.gold29horse==='banner',pass.sibling);
 check('the built-in tier rewards survive the layer',pass.sibling.free29tack===true&&pass.sibling.gold29tint===true&&pass.sibling.gold29gems===20);
 check('one season carries the breeding theme',pass.themes.some(t=>t.endsWith(':breed')),pass.themes);
 check('the track screen can label every reward kind',/8 season tokens/.test(pass.labels.tok)&&/200 XP/.test(pass.labels.xp)&&/season pass horse/.test(pass.labels.horse),pass.labels);

 /* ---- 3. the weekly challenges and the token faucet ----------------------------------- */
 const chal=await page.evaluate(async()=>{
  const G=window.__features;
  G.seasons.override('bloom');
  G.save.sync(s=>{s.tokens={key:s.tokens.key,n:0};s.sn.prog={};s.sn.paid={};s.sn.weeks=0;s.vip=null;});
  const before=G.save.fresh();
  const list=G.seasons.challenges();
  const out={goldBefore:!!G.run('goldPass',G.save.fresh()),steps:[]};
  for(const c of list){
   G.quest.dailyEvt(c.type,c.goal);
   const s=G.save.fresh();
   out.steps.push({id:c.id,prog:s.sn.prog[c.id],goal:c.goal,paid:!!s.sn.paid[c.id],tok:s.tokens.n,weeks:s.sn.weeks});
  }
  const s=G.save.fresh();
  out.tokBefore=before.tokens.n; out.tokAfter=s.tokens.n;
  out.expect=list.reduce((a,c)=>a+(c.r.tok||0),0)+G.seasons.WEEK_BONUS.tok;
  out.ptsGained=(s.pass.pts||0)-(before.pass.pts||0);
  out.weeks=s.sn.weeks; out.weekDone=G.seasons.weekDone(s);
  out.goldAfter=!!G.run('goldPass',s); out.goldOpen=G.seasons.goldOpen(s); out.vip=!!(s.vip&&s.vip.until>Date.now());
  /* the chip in the wallet */
  G.money.refreshWallet();
  const el=document.getElementById('tokEl');
  out.chip={html:el?el.innerHTML:null,shown:!!el&&el.style.display!=='none',text:el?el.textContent:''};
  return out;
 });
 check('challenge progress rises from the real dailyEvt hook',chal.steps.every(s=>s.prog===s.goal&&s.paid),chal.steps.map(s=>s.id+' '+s.prog+'/'+s.goal));
 check('finishing a challenge pays season tokens',chal.tokAfter-chal.tokBefore===chal.expect,{before:chal.tokBefore,after:chal.tokAfter,expect:chal.expect});
 check('finishing a challenge pays pass points',chal.ptsGained>=200,{gained:chal.ptsGained});
 check('the completed week is banked',chal.weeks===1&&chal.weekDone,{weeks:chal.weeks});
 check('a banked week opens the gold row with no VIP and no gems',!chal.goldBefore&&chal.goldAfter&&chal.goldOpen&&!chal.vip,{before:chal.goldBefore,after:chal.goldAfter,vip:chal.vip});
 check('#tokEl is painted in the house chip shape',chal.chip.shown&&/<i>🎟️<\/i><b>\d+<\/b>/.test(chal.chip.html||''),chal.chip);

 /* ---- 3b. a FRACTIONAL emitter ------------------------------------------------------- */
 /* The checks above drive dailyEvt with the whole goal, which is not what the game sends.
    ranch3d.html:13043 reports dailyEvt('gallop',sp*dt) — speed times frame time — so the sun
    season's tally is a float, and reading it straight back out put
    "0.26892000000000005 / 12" on the challenge card. Drive it the way the game does and
    insist on what a human sees. */
 const frac=await page.evaluate(async()=>{
  const G=window.__features;
  G.seasons.override('sun');
  G.save.sync(s=>{s.sn.prog={};s.sn.paid={};});
  G.quest.dailyEvt('gallop',7.9*0.0166); G.quest.dailyEvt('gallop',8.3*0.0166);
  const p=document.getElementById('lbPanel');
  if(p.style.display==='flex')p.style.display='none';
  G.ui.openLB(); const b=p.querySelector('[data-lbtab="pass"]'); if(b)b.click();
  const m=/Twelve good gallops[^0-9]*([0-9.]+)\s*\/\s*12/.exec(p.innerText||'');
  const raw=G.save.fresh().sn.prog['su-gallop'];
  G.seasons.override('bloom');
  return {raw,shown:m?m[1]:null,digits:String(raw).length};
 });
 check('a fractional dailyEvt still shows the player a whole number',/^\d+$/.test(frac.shown||''),frac);
 check('a fractional dailyEvt does not fill the save with float noise',frac.digits<=6,{raw:frac.raw});

 /* ---- 4. the gold row on the track screen, locked then open --------------------------- */
 const openPass=async()=>page.evaluate(()=>{
  const p=document.getElementById('lbPanel');
  if(p.style.display==='flex')p.style.display='none';
  window.__features.ui.openLB();
  const b=document.querySelector('#lbPanel [data-lbtab="pass"]'); if(b)b.click();
  return document.getElementById('lbPanel').style.display;
 });
 const locked=await page.evaluate(()=>{
  const G=window.__features;
  G.save.sync(s=>{s.pass.pts=4500;s.pass.claims={};s.pass.gold={};s.sn.weeks=0;s.vip=null;s.roster.exclusives={};});
  return true;
 });
 await openPass();
 const lockedDom=await page.evaluate(()=>{
  const p=document.getElementById('lbPanel');
  return {gold29:!!p.querySelector('[data-gold="29"]'),free29:!!p.querySelector('[data-pass="29"]'),
   cards:p.querySelectorAll('.tierCard').length,locks:p.querySelectorAll('.tslot.gold.lock').length,
   text:(p.innerText||'').slice(0,4000)};
 });
 check('the track screen draws all thirty tiers',lockedDom.cards===30&&locked,{cards:lockedDom.cards});
 check('with no banked week the gold row is drawn locked',!lockedDom.gold29&&lockedDom.locks===30,{gold29:lockedDom.gold29,locks:lockedDom.locks});
 check('the free tier is claimable at tier 30',lockedDom.free29);
 check('the screen names the season, the tier and the challenges',/Season of Bloom/.test(lockedDom.text)&&/tier 30\/30/.test(lockedDom.text)&&/This week's challenges/.test(lockedDom.text),lockedDom.text.slice(0,140));

 const claimFree=await page.evaluate(async()=>{
  const G=window.__features, b0=G.save.fresh();
  document.querySelector('#lbPanel [data-pass="29"]').click();
  await new Promise(r=>setTimeout(r,250));
  const s=G.save.fresh();
  return {claimed:s.pass.claims[29],gems:s.gems-b0.gems,horses:s.horses.length-b0.horses.length,
   goldTack:!!s.goldTack,exclusives:Object.keys(s.roster.exclusives||{}),
   newBreed:s.horses.length>b0.horses.length?s.horses[s.horses.length-1].breed:null};
 });
 check('claiming free tier 30 grants the season headline horse',claimFree.claimed===1&&claimFree.horses===1&&claimFree.newBreed==='petalmane',claimFree);
 check('free tier 30 still pays its gems and the golden tack',claimFree.gems>=6&&claimFree.goldTack,{gems:claimFree.gems});

 const claimGold=await page.evaluate(async()=>{
  const G=window.__features;
  G.save.sync(s=>{s.sn.weeks=1;});
  G.ui.renderLB();
  const p=document.getElementById('lbPanel');
  const btn=p.querySelector('[data-gold="29"]');
  if(!btn)return {drawn:false};
  const b0=G.save.fresh();
  btn.click();
  await new Promise(r=>setTimeout(r,250));
  const s=G.save.fresh();
  /* the tint key is written by the INLINE passClaim from ranch3d's own seasonNow, which no
     package can re-phase — so count the keys rather than naming one */
  return {drawn:true,gold29:s.pass.gold[29],gems:s.gems-b0.gems,horses:s.horses.length-b0.horses.length,
   newBreed:s.horses.length>b0.horses.length?s.horses[s.horses.length-1].breed:null,
   tints:Object.keys(s.seasonTack||{}).length-Object.keys(b0.seasonTack||{}).length,
   vip:!!(s.vip&&s.vip.until>Date.now())};
 });
 check('a banked week draws the gold claim button',claimGold.drawn);
 check('the gold tier claims with no VIP and no gems spent',claimGold.gold29===1&&!claimGold.vip,claimGold);
 check('gold tier 30 pays its gems and a season tack tint',claimGold.gems>=20&&claimGold.tints===1,{gems:claimGold.gems,tints:claimGold.tints});
 check('gold tier 30 grants the limited banner horse',claimGold.horses===1&&claimGold.newBreed==='blossomdrake',{n:claimGold.horses,breed:claimGold.newBreed});

 /* ---- 5. the seasonal store ----------------------------------------------------------- */
 const store=await page.evaluate(async()=>{
  const G=window.__features, out={};
  G.seasons.override('bloom');
  G.save.sync(s=>{s.tokens.n=500;s.sn.store={};s.rider.shirt='#3d4a6e';});
  G.ui.openShop('season');
  const p=document.getElementById('shopPanel');
  out.header=(p.innerText||'');
  out.buttons=Array.from(p.querySelectorAll('[data-fx^="sn:buy:"]')).map(b=>b.dataset.fx);
  const click=async fx=>{const b=p.querySelector('[data-fx="'+fx+'"]');if(!b)return false;b.click();await new Promise(r=>setTimeout(r,180));return true;};

  let s0=G.save.fresh();
  out.outfitClicked=await click('sn:buy:bloom-silks');
  let s=G.save.fresh();
  out.outfit={spent:s0.tokens.n-s.tokens.n,owned:!!s.sn.store['bloom-silks'],shirt:s.rider.shirt,
   wardrobe:!!s.wardrobe.owned['sn:bloom-silks']};

  s0=s; out.tintClicked=await click('sn:buy:bloom-tint');
  s=G.save.fresh();
  out.tint={spent:s0.tokens.n-s.tokens.n,unlocked:(s.seasonTack||{}).bloom,
   saddle:s.horses[G.horse.rideIdx()].tack,want:G.tables.SEASONS.find(d=>d.id==='bloom').tint};

  s0=s; out.decorClicked=await click('sn:buy:bloom-maypole');
  s=G.save.fresh();
  const dk=G.seasons.decorKey({id:'bloom-maypole'});
  out.decor={spent:s0.tokens.n-s.tokens.n,owned:!!s.sn.store['bloom-maypole'],key:dk,
   cat:G.tables.DECOR_CAT[dk]?{price:G.tables.DECOR_CAT[dk].price,pts:G.tables.DECOR_CAT[dk].pts,cat:G.tables.DECOR_CAT[dk].cat,label:G.tables.DECOR_CAT[dk].label}:null,
   mesh:!!G.world.buildDecorMesh(dk,true)};

  s0=s; out.tackClicked=await click('sn:buy:bloom-set');
  s=G.save.fresh();
  const fresh=s.tack.slice(-4);
  out.tack={spent:s0.tokens.n-s.tokens.n,n:s.tack.length-s0.tack.length,
   sets:fresh.map(t=>G.horse.gearSet(t)),slots:fresh.map(t=>t.slot),rar:fresh.map(t=>t.rarity),
   setDef:!!G.tables.TACK_SETS.Petalfall};

  s0=s; out.payClicked=await click('sn:buy:bloom-btok');
  s=G.save.fresh();
  out.pay={spent:s0.tokens.n-s.tokens.n,btok:s.btok-s0.btok};

  /* the same button, one season later */
  G.seasons.override('sun');
  G.ui.openShop('season');
  const p2=document.getElementById('shopPanel');
  out.nextSeason={header:(p2.innerText||''),
   bloomBtnGone:!p2.querySelector('[data-fx="sn:buy:bloom-silks"]'),
   sunBtn:!!p2.querySelector('[data-fx="sn:buy:sun-duster"]')};
  G.save.sync(s=>{delete s.sn.store['bloom-maypole'];});     // un-own it so the refusal is about the SEASON, not about owning it
  const t0=G.save.fresh().tokens.n;
  out.refused=G.seasons.buy('bloom-maypole')===false;
  out.refundIntact=G.save.fresh().tokens.n===t0;
  out.decorSurvives=!!G.tables.DECOR_CAT[dk];
  out.ownedSurvives=!!G.save.fresh().sn.store['bloom-silks'];
  G.seasons.override('bloom');
  return out;
 });
 check('the season shelf names this season',/Season of Bloom · store/.test(store.header)&&store.buttons.length===5,{n:store.buttons.length});
 check('buying an outfit spends tokens and repaints the rider',store.outfit.spent===26&&store.outfit.owned&&store.outfit.shirt==='#e86aa6'&&store.outfit.wardrobe,store.outfit);
 check('buying the tint unlocks the season colour and paints the saddle',store.tint.spent===40&&store.tint.unlocked===1&&store.tint.saddle===store.tint.want,store.tint);
 check('buying decor puts a free, buildable piece in the catalogue',store.decor.spent===55&&store.decor.cat&&store.decor.cat.price===0&&store.decor.cat.pts>0&&store.decor.mesh,store.decor);
 check('buying the tack set puts four Epic pieces of that set in the locker',store.tack.spent===120&&store.tack.n===4&&store.tack.sets.every(x=>x==='Petalfall')&&store.tack.rar.every(r=>r==='Epic')&&store.tack.setDef,store.tack);
 check('a bundle pays through payReward',store.pay.spent===35&&store.pay.btok===2,store.pay);
 check('the shelf rotates when the season turns',store.nextSeason.bloomBtnGone&&store.nextSeason.sunBtn&&/Season of the Long Sun · store/.test(store.nextSeason.header),{gone:store.nextSeason.bloomBtnGone,sun:store.nextSeason.sunBtn,head:store.nextSeason.header.slice(0,60)});
 check('an out-of-season item is refused and costs nothing',store.refused&&store.refundIntact);
 check('what you bought stays yours across the turn',store.decorSurvives&&store.ownedSurvives);

 /* ---- 6. the special-event slot and its seam ------------------------------------------ */
 const special=await page.evaluate(async()=>{
  const G=window.__features, out={};
  G.seasons.override('ember');
  let sawStatus=null, sawStart=null;
  G.on('specialStatus',(id)=>{sawStatus=id;return '🧪 QA STATUS LINE';});
  G.on('specialStart',(id)=>{sawStart=id;return true;});
  const p=document.getElementById('eventsPanel');
  if(p.style.display==='flex')p.style.display='none';
  G.ui.openEvents();
  await new Promise(r=>setTimeout(r,150));                   // the hoist runs on a MutationObserver microtask
  const txt=p.innerText||'';
  const card=p.querySelector('#snSpecialCard');
  out.card={label:/Harmony Festival/.test(txt),status:/QA STATUS LINE/.test(txt),next:/Season of Frost/.test(txt),
   hoisted:!!card&&card===p.children[1],index:card?Array.prototype.indexOf.call(p.children,card):-1,
   kids:p.children.length};
  out.statusId=sawStatus;
  const n0=G.seasons.specialStarts, h0=G.seasons.specialHandled;
  const btn=p.querySelector('[data-fx="sn:special"]');
  out.hasButton=!!btn;
  if(btn){btn.click();await new Promise(r=>setTimeout(r,150));}
  out.started=G.seasons.specialStarts-n0; out.handled=G.seasons.specialHandled-h0; out.startId=sawStart;
  return out;
 });
 check('the special-event card is hoisted to the top of the Events panel',special.card.label&&special.card.hoisted,{index:special.card.index,of:special.card.kids});
 check('the card asks the specialStatus seam and prints what it is told',special.card.status&&special.statusId==='ember-festival',{id:special.statusId});
 check('the card teases the season that is coming',special.card.next);
 check('Take part fires specialStart and a sibling can claim it',special.hasButton&&special.started===1&&special.handled===1&&special.startId==='ember-festival',special);

 /* ---- 7. the headline horses, the encore notice and the state dump -------------------- */
 const misc=await page.evaluate(async()=>{
  const G=window.__features, out={};
  G.seasons.override('frost');
  const p=document.getElementById('lbPanel');
  if(p.style.display==='flex')p.style.display='none';
  G.ui.openLB();
  const b=p.querySelector('[data-lbtab="pass"]'); if(b)b.click();
  const txt=p.innerText||'';
  const SH=G.horse.roster.seasonHorses('frost');
  out.horses={pass:G.horse.breedLabel(SH.pass),deluxe:G.horse.breedLabel(SH.deluxe),banner:G.horse.breedLabel(SH.banner)};
  out.screen={pass:txt.indexOf(out.horses.pass)>=0,deluxe:txt.indexOf(out.horses.deluxe)>=0,banner:txt.indexOf(out.horses.banner)>=0,
   returning:/Returning this season/.test(txt),days:/day \d+ of 28/.test(txt),gold:/gold track is/i.test(txt)};
  out.returning=G.seasons.returning().map(r=>r.key);
  out.flag=Object.keys(G.save.fresh().flags||{}).filter(k=>k.indexOf('encore-')===0);
  const st=JSON.parse(render_game_to_text());
  out.state=st.season||null;
  out.wallet=st.wallet||null;
  G.seasons.override(null);
  return out;
 });
 check('the screen lists all three of the season\'s horses',misc.screen.pass&&misc.screen.deluxe&&misc.screen.banner,misc.horses);
 check('the screen shows the days left and the state of the gold track',misc.screen.days&&misc.screen.gold,misc.screen);
 check('a banner horse you missed is named as returning',misc.returning.length>0&&misc.screen.returning,{returning:misc.returning});
 check('the encore is announced once, on the boot pass',misc.flag.length===1,misc.flag);
 check('render_game_to_text carries o.season',!!misc.state&&typeof misc.state.tokens==='number'&&typeof misc.state.goldOpen==='boolean'&&misc.state.challenges.length===3,misc.state);

 /* ---- 7b. the package's own panel, the VR page and the link to the clothes shelf ------ */
 const panels=await page.evaluate(async()=>{
  const G=window.__features, out={};
  G.seasons.override('sun');
  G.save.sync(s=>{s.sn.weeks=1;s.vip=null;});
  G.ui.open('seasonPanel');
  const p=document.getElementById('seasonPanel');
  out.panel={shown:p&&p.style.display==='flex',cards:p?p.querySelectorAll('.tierCard').length:0,
   named:/Season of the Long Sun/.test((p&&p.innerText)||'')};
  out.vrTab=(G.ui.TABS||[]).some(t=>t[0]==='season');
  const build=G.ui.VR_BUILDERS&&G.ui.VR_BUILDERS.season;
  const rows=[]; out.vrNote=build?build(rows,G.save.fresh()):null;
  out.vrRows=rows.length;
  /* the free-path predicate, said out loud in the headset */
  out.vrOpen=/gold track is OPEN/.test(out.vrNote||'');
  G.save.sync(s=>{s.sn.weeks=0;});
  out.vrShut=/gold track is shut/.test((build?build([],G.save.fresh()):'')||'');
  G.save.sync(s=>{s.sn.weeks=1;});
  /* the link out to tack-wardrobe's clothes shelf */
  G.ui.dispatch('sn:outfits');
  await new Promise(r=>setTimeout(r,150));
  const lp=document.getElementById('lbPanel');
  out.clothes={open:lp.style.display==='flex',isStore:/Season Store/.test(lp.innerText||'')};
  G.seasons.override(null);
  return out;
 });
 check('the package has a season panel of its own that draws the track',panels.panel.shown&&panels.panel.cards===30&&panels.panel.named,panels.panel);
 check('the headset gets a season page',panels.vrTab&&typeof panels.vrNote==='string'&&panels.vrNote.split('\n').length>=5,{tab:panels.vrTab,lines:(panels.vrNote||'').split('\n').length});
 check('the headset page mirrors the free gold-path predicate both ways',panels.vrOpen&&panels.vrShut,{open:panels.vrOpen,shut:panels.vrShut});
 check('the store links out to the season clothes shelf',panels.clothes.open&&panels.clothes.isStore,panels.clothes);

 /* ---- 8. the URL override, on its own page load --------------------------------------- */
 const page2=await browser.newPage({viewport:{width:1024,height:768}});
 const errors2=[];
 page2.on('pageerror',e=>errors2.push('PAGEERROR '+e.message));
 page2.on('console',m=>{if(m.type()==='error')errors2.push(m.text());});
 page2.on('dialog',d=>{d.dismiss().catch(()=>{});});
 stage('second page (?season=frost)');
 await page2.goto(base+'/ranch3d.html?qa=seasons&season=frost&fresh='+Date.now(),{waitUntil:'load',timeout:120000});
 await page2.waitForFunction(READY,null,{timeout:150000,polling:250});
 const urlOv=await page2.evaluate(()=>{
  const G=window.__features, st=JSON.parse(render_game_to_text());
  G.ui.openShop('season');
  return {id:G.time.seasonNow().def.id,state:st.season,shelf:(document.getElementById('shopPanel').innerText||''),
   tokenKey:(G.save.fresh().tokens||{}).key,realKey:G.seasons.realKey(),snKey:(G.save.fresh().sn||{}).key};
 });
 check('?season=frost re-phases the whole game on a cold boot',urlOv.id==='frost'&&urlOv.state.id==='frost'&&urlOv.state.override==='frost',urlOv.state&&{id:urlOv.state.id,override:urlOv.state.override});
 check('the overridden shelf is the one that renders',/Season of Frost · store/.test(urlOv.shelf)&&/Frostpine hood/.test(urlOv.shelf),urlOv.shelf.replace(/\n/g,' | ').slice(0,200));
 check('bookkeeping stays on the REAL season key, so a debug URL cannot wipe a save',urlOv.tokenKey===urlOv.realKey&&urlOv.snKey===urlOv.realKey,{token:urlOv.tokenKey,sn:urlOv.snKey,real:urlOv.realKey});
 check('the second boot is clean too',errors2.length===0,errors2.slice(0,4));

 /* ---- 9. nothing broke ---------------------------------------------------------------- */
 const tail=await page.evaluate(()=>{
  const G=window.__features, s=JSON.parse(render_game_to_text());
  return {gfx:s.graphics&&s.graphics.horseReady,errs:G.errors.length,
   wallet:document.getElementById('tokEl')?document.getElementById('tokEl').innerHTML:null};
 });
 check('the game is still running after all of that',tail.gfx&&tail.errs===0,{errs:tail.errs});
 check('no console errors during the whole run',errors.length===0,errors.slice(0,6));

 await browser.close();
 const failed=checks.filter(c=>!c.ok).length;
 console.log('\n'+(checks.length-failed)+' passed, '+failed+' failed, '+((Date.now()-t0)/1000).toFixed(1)+'s');
 process.exit(failed?1:0);
})().catch(async e=>{console.error(e);try{if(browser)await browser.close();}catch(x){}process.exit(2);});

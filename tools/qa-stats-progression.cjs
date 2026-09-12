/* stats-progression package check.
   Boots ranch3d.html?qa=stats-progression, waits for the horse, then proves each feature of the
   package headlessly: per-breed stat ceilings, the level-50 cap and level/XP readout, feed bags,
   the four-tier stat-food table and shop shelf, world foraging (orchard apples), resource traders,
   stat XP from events, stackable XP multipliers, region wildlife, golden-horseshoe XP and fishing
   at the river spots.

   Usage:  QA_URL=http://127.0.0.1:8431 NODE_PATH=$(npm root -g) node tools/qa-stats-progression.cjs */
const {chromium}=require('playwright');
const base=(process.env.QA_URL||'http://127.0.0.1:8431').replace(/\/$/,'');
const url=base+'/ranch3d.html?qa=stats-progression&fresh='+Date.now();
const checks=[];
function check(name,ok,detail){checks.push({name,ok:!!ok,detail});console.log((ok?'PASS ':'FAIL ')+name+(detail!==undefined?' — '+JSON.stringify(detail):''));}
const t0=Date.now();
const stage=s=>console.log('… '+s+' @'+((Date.now()-t0)/1000).toFixed(1)+'s');
let browser=null;
setTimeout(async()=>{console.error('WATCHDOG: no result after 600 s');try{if(browser)await browser.close();}catch(e){}process.exit(3);},600000).unref();
const READY=()=>window.render_game_to_text&&(()=>{try{const s=JSON.parse(render_game_to_text());return s.graphics&&s.graphics.horseReady&&!s.graphics.horseLoading;}catch(e){return false;}})();
(async()=>{
 browser=await chromium.launch({headless:true,args:['--disable-background-timer-throttling','--use-angle=metal','--enable-gpu-rasterization','--ignore-gpu-blocklist']});
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 const errors=[];
 page.on('pageerror',e=>errors.push('PAGEERROR '+e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 page.on('dialog',d=>{d.dismiss().catch(()=>{});});
 stage('launch'); await page.goto(url,{waitUntil:'load',timeout:120000}); stage('loaded');
 await page.waitForFunction(READY,null,{timeout:150000,polling:250});
 stage('horseReady');
 const r=await page.evaluate(()=>{
  const G=window.__features, out={}, S=G.save, X=G.xp, T=G.tables, W=G.world, K=T.STAT_KEYS;
  const fresh=()=>S.fresh();
  const ri=()=>G.horse.rideIdx();
  const text=id=>(document.getElementById(id)||{}).textContent||'';
  out.installed=G.installed.includes('stats-progression'); out.errors=G.errors.slice();
  /* ---- 1. per-breed ceilings ---- */
  const varied=T.BREEDS3.filter(b=>new Set(K.map(k=>X.statCeil({breed:b[0]},k))).size>1).length;
  out.ceil={varied,total:T.BREEDS3.length,tableRows:Object.keys(T.BREED_CEIL).length,bayAccel:X.statCeil({breed:'bay'},'accel'),bayStam:X.statCeil({breed:'bay'},'stamina'),shireJump:X.statCeil({breed:'shire'},'jump')};
  /* a granted horse never starts above its ceiling */
  let clamped=null; S.sync(s=>{const h=G.horse.grantHorse(s,'chestnut',{name:'QA Pony',src:'qa',stats:{speed:10,stamina:10,jump:10,accel:10,agility:10}});clamped={speed:h.stats.speed,ceil:X.statCeil(h,'speed')};s.horses.pop();s.nextId--;});
  out.clamped=clamped;
  /* ---- 2. level cap + stat cap curve ---- */
  out.caps={l1:X.statCap({level:1}),l5:X.statCap({level:5}),l30:X.statCap({level:30}),l50:X.statCap({level:50}),max:X.MAX_LEVEL};
  S.sync(s=>{const h=s.horses[ri()];h.level=49;h.xp=0;});
  X.addXp3D(100000);
  const hMax=fresh().horses[ri()]; out.cap50={level:hMax.level,xp:hMax.xp};
  S.sync(s=>{const h=s.horses[ri()];h.level=1;h.xp=0;h.bond=10;});
  G.horse.myHorses[ri()].level=1;G.horse.myHorses[ri()].xp=0;
  /* story missions carry XP; the daily 'event' row drops a bag */
  out.questXp={storyWithXp:G.quest.STORY.filter(m=>m.reward&&m.reward.xp).length,storyN:G.quest.STORY.length,eventDailyBag:(G.quest.DAILYQ.find(q=>q.type==='event')||{}).r.bag,forageDaily:!!G.quest.DAILYQ.find(q=>q.type==='forage')};
  let paidXp=null; S.sync(s=>{const h=s.horses[ri()];const x0=h.xp;G.money.payReward(s,{xp:30,bag:'bag2'});paidXp={dx:h.xp-x0,bag2:s.items.bag2};});
  out.paidXp=paidXp;
  /* ---- care panel: level readout + per-stat caps + feed bags ---- */
  S.sync(s=>{s.items.bag3=(s.items.bag3||0)+1;});
  G.ui.openCare();
  const careTxt=text('carePanel');
  out.care={lvl:/Level 1 \/ 50/.test(careTxt),xpBonus:/XP bonus \+\d+%/.test(careTxt),perStat:document.querySelectorAll('#carePanel .cbar[title*="breed ceiling"]').length,bagBtn:!!document.querySelector('#carePanel [data-fx="sp:bag:bag3"]')};
  const before=fresh().horses[ri()], bag3Before=fresh().items.bag3;
  document.querySelector('#carePanel [data-fx="sp:bag:bag3"]').click();
  const after=fresh().horses[ri()];
  out.bag={before:{level:before.level,xp:before.xp,bag3:bag3Before},after:{level:after.level,xp:after.xp,bag3:fresh().items.bag3},lifeBag:fresh().life.bag};
  G.hidePanels();
  /* ---- 4. stat-food table ---- */
  const F=T.FOODS3; const tiers={};
  for(let t=1;t<=4;t++){const ks=Object.keys(F).filter(k=>(F[k].tier||1)===t);tiers[t]={n:ks.length,stats:new Set(ks.map(k=>F[k].stat).filter(Boolean)).size,sxp:new Set(ks.filter(k=>F[k].stat).map(k=>F[k].sxp))};tiers[t].sxp=[...tiers[t].sxp];}
  out.foods={foods:Object.keys(F).length,tiers,lbl4:T.FEED_TIER_LBL[4]};
  S.sync(s=>{const h=s.horses[ri()];h.level=1;h.xp=0;for(const k of K){h.stats[k]=3;h.sxp[k]=0;}});   // the level-ups above capped four stats; supplements only show for stats with room
  G.horse.myHorses[ri()].level=1;G.horse.myHorses[ri()].xp=0;
  G.ui.openShop('food');
  const shopTxt=text('shopPanel');
  out.shop={tierHeaders:[1,2,3,4].filter(t=>shopTxt.includes(T.FEED_TIER_LBL[t])).length,buyBtns:document.querySelectorAll('#shopPanel [data-fx^="sp:buy:"]').length,supps:document.querySelectorAll('#shopPanel [data-supp]').length,bags:/Feed bags/.test(shopTxt),traderHint:/sold by Hollis in Barleyfold/.test(shopTxt)};
  /* buying off the shelf */
  S.sync(s=>{s.coins=1000;});
  const c0=fresh().coins; document.querySelector('#shopPanel [data-fx="sp:buy:carrot:5"]').click();
  out.buy={dc:c0-fresh().coins,carrots:fresh().items.carrot};
  G.hidePanels();
  /* ---- 7. stat XP from events ---- */
  out.trains={rows:T.EVENTS3.filter(e=>Array.isArray(e.trains)&&e.trains.length===2).length,total:T.EVENTS3.length,h1:T.EVENTS3.find(e=>e.id==='h1').trains};
  G.ui.openEvents(); out.evRow=/trains/.test(text('eventsPanel')); G.hidePanels();
  S.sync(s=>{const h=s.horses[ri()];h.level=1;for(const k of K){h.stats[k]=3;h.sxp[k]=0;}});
  G.course.startCourse(T.EVENTS3.find(e=>e.id==='h1'));
  window.advanceTime(200);
  const c=G.course.get(); if(c){c.t=20;c.faults=0;c.idx=c.jumps.length;}
  G.course.finishCourse();
  const hs=fresh().horses[ri()];
  out.evXp={jump:hs.sxp.jump,agility:hs.sxp.agility,speed:hs.sxp.speed,jumpStat:hs.stats.jump};
  /* ---- 8. multipliers ---- */
  const s1=fresh(); const h1=s1.horses[ri()];
  const mLow=G.mul('xp',s1,Object.assign({},h1,{bond:10}));
  const mHigh=G.mul('xp',s1,Object.assign({},h1,{bond:100}));
  s1.perks={xp:true}; const mPerk=G.mul('xp',s1,Object.assign({},h1,{bond:10}));
  const sxpBay=G.mul('sxp',s1,{breed:'bay',bond:10},'accel'), sxpBayJump=G.mul('sxp',s1,{breed:'bay',bond:10},'jump');
  out.mul={mLow,mHigh,mPerk,sxpBay,sxpBayJump,mastery5:T.MASTERY_UNLOCKS[5]};
  let sxpApplied=null; S.sync(s=>{const h=s.horses[ri()];h.breed='bay';h.bond=10;h.sxp.accel=0;h.stats.accel=3;X.grantStatXp(s,h,'accel',20);sxpApplied=h.sxp.accel;h.breed='bay-sporthorse';});
  out.sxpApplied=sxpApplied;   // 20 × 1.25 = 25
  /* ---- 5. foraging ---- */
  const apples=W.forage.filter(f=>f.item==='apple');
  const nearOrchard=apples.filter(f=>Math.hypot(f.g.position.x-68,f.g.position.z+52)<30).length;
  out.forage={kinds:Object.keys(W.FORAGE_SPOTS).length,apples:apples.length,nearOrchard,honey:W.forage.filter(f=>f.item==='honey').length,markers:W.mapMarkers.filter(m=>m.glyph==='🍎').length};
  const ap=apples.find(f=>f.g.visible);
  const items0=fresh().items.apple||0, forage0=(fresh().life||{}).forage||0, sp0=(fresh().weekly&&fresh().weekly.sp)||fresh().sp||0;
  G.horse.player.pos.set(ap.g.position.x,0,ap.g.position.z); G.horse.player.speed=0;
  window.advanceTime(300);
  out.pick={apple:(fresh().items.apple||0)-items0,forage:((fresh().life||{}).forage||0)-forage0,hidden:!ap.g.visible};
  /* ---- 9. wildlife ---- */
  out.wild={coyote:!!W.CRITTER_DEFS.coyote,goat:!!W.CRITTER_DEFS.goat,spawned:W.critters.filter(c=>c.key==='coyote'||c.key==='goat').length};
  /* ---- 6. traders ---- */
  const marta=T.TRADERS.find(t=>t.id==='marta');
  out.traderNpc={inDefs:!!G.quest.NPC_DEFS.find(d=>d.id==='marta'),inList:!!W.npcList.find(n=>n.def.id==='marta'),n:T.TRADERS.length};
  G.horse.player.pos.set(marta.x+1.5,0,marta.z+1.5); G.horse.player.speed=0; window.advanceTime(150);
  G.openDlg();
  const dlg=document.getElementById('dlg'); out.dlg={shown:dlg.style.display,browse:/Browse Marta/.test(dlg.textContent)};
  const bb=dlg.querySelector('[data-fx="sp:trader:marta"]'); if(bb)bb.click();
  const st=text('shopPanel');
  out.traderShop={open:document.getElementById('shopPanel').style.display,header:/Marta's stall · Cottonwood/.test(st),stockRows:document.querySelectorAll('#shopPanel [data-fx^="sp:buy:"]').length,hasApple:/Apple/.test(st),hasDaikon:/Daikon/.test(st),supps:document.querySelectorAll('#shopPanel [data-supp]').length};
  const c1=fresh().coins; const ab=document.querySelector('#shopPanel [data-fx="sp:buy:strawberry:1"]'); if(ab)ab.click();
  out.traderBuy={dc:c1-fresh().coins,strawberry:fresh().items.strawberry,traders:fresh().traders};
  G.hidePanels();
  /* ---- 10. golden horseshoes ---- */
  const sh=window._shoes.find(q=>!q.got);
  S.sync(s=>{const h=s.horses[ri()];h.level=10;h.xp=0;}); G.horse.myHorses[ri()].level=10;G.horse.myHorses[ri()].xp=0;   // room for +15 without a level-up
  const xp0=fresh().horses[ri()].xp, coins0=fresh().coins;
  G.horse.player.pos.set(sh.x,0,sh.z); G.horse.player.speed=0; window.advanceTime(300);
  out.shoe={dcoins:fresh().coins-coins0,dxp:fresh().horses[ri()].xp-xp0,got:sh.got};
  /* ---- 11. fishing at the ford ---- */
  const ford=T.FISH_SPOTS.find(f=>f.id==='ford');
  out.fishSpots={n:T.FISH_SPOTS.length,things:W.things.filter(t=>t.kind==='fishspot').length,oldLake:W.things.filter(t=>t.kind==='fish').length,fordZ:ford.z,riverZ:W.riverZ(ford.x)};
  G.horse.player.pos.set(ford.x+1,0,ford.z+1); G.horse.player.speed=0; window.advanceTime(150);
  const ctx0=text('ctx');
  window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyE'}));
  const rodOn=G.scene.children.some(o=>o.children&&o.children.some(m=>m.geometry&&m.geometry.type==='CylinderGeometry')&&o.visible&&o.children.length===3);
  window.advanceTime(100); const fishing1=G.stats2.fishing()?G.stats2.fishing().bit:null;
  G.stats2.forceBite(); window.advanceTime(100);
  const fishing2=G.stats2.fishing()?G.stats2.fishing().bit:null; const ctx1=text('ctx');
  window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyE'}));
  const sv=fresh(); const fishItems=Object.keys(T.FISH).reduce((a,k)=>a+(sv.items[k]||0),0);
  out.fish={ctx0,waiting:fishing1===false,bit:fishing2===true,ctx1,caught:sv.fish.n,fordCount:sv.fish.spots.ford,fishItems,bottles:sv.fish.bottles,rodOn,rodOff:!G.stats2.fishing()};
  /* selling the catch */
  S.sync(s=>{s.items.trout=(s.items.trout||0)+2;});
  const trout0=fresh().items.trout;
  G.ui.openShop('food'); const c2=fresh().coins; const sb=document.querySelector('#shopPanel [data-fx="sp:sell:trout:1"]'); if(sb)sb.click();
  out.sell={btn:!!sb,dc:fresh().coins-c2,left:fresh().items.trout,trout0};
  G.hidePanels();
  /* ---- state hook ---- */
  const st2=JSON.parse(render_game_to_text());
  out.state=st2.progression;
  /* stable rows carry the ceiling strip */
  G.ui.openStable(); out.stable=/breed ceilings/.test(document.getElementById('stablePanel').innerHTML); G.hidePanels();
  return out;
 });
 check('package installed without error',r.installed&&r.errors.length===0,r.errors);
 check('per-breed ceilings vary per stat (≥40 breeds)',r.ceil&&r.ceil.varied>=40&&r.ceil.bayAccel===10&&r.ceil.bayStam===6&&r.ceil.shireJump===10,r.ceil);
 check('new horses are clamped to their breed ceiling',r.clamped&&r.clamped.speed===r.clamped.ceil&&r.clamped.speed<10,r.clamped);
 check('stat cap climbs with level to 10 by Lv 30; MAX_LEVEL 50',r.caps&&r.caps.l1===4&&r.caps.l5===5&&r.caps.l30===10&&r.caps.l50===10&&r.caps.max===50,r.caps);
 check('level never passes 50',r.cap50&&r.cap50.level===50&&r.cap50.xp===0,r.cap50);
 check('story missions pay XP, dailies drop bags, forage daily exists',r.questXp&&r.questXp.storyWithXp===r.questXp.storyN&&r.questXp.eventDailyBag==='bag2'&&r.questXp.forageDaily,r.questXp);
 check('payReward pays xp and bag kinds',r.paidXp&&r.paidXp.dx===30&&r.paidXp.bag2>=1,r.paidXp);
 check('care panel: Level n/50, XP bonus %, per-stat caps, feed-bag button',r.care&&r.care.lvl&&r.care.xpBonus&&r.care.perStat===5&&r.care.bagBtn,r.care);
 check('feed bag: 500 XP takes a Lv1 horse to Lv4 and is consumed',r.bag&&r.bag.after.level>=4&&r.bag.after.bag3===r.bag.before.bag3-1&&r.bag.lifeBag>=1,r.bag);
 check('food table: 4 tiers × 5 stats, one sxp per tier (6/12/24/48)',r.foods&&[1,2,3,4].every(t=>r.foods.tiers[t].stats===5&&r.foods.tiers[t].sxp.length===1)&&r.foods.tiers[1].sxp[0]===6&&r.foods.tiers[4].sxp[0]===48&&r.foods.foods>=22,r.foods);
 check('shop food tab: 4 tier headers, ≥20 buy buttons, supplements, bags, trader hints',r.shop&&r.shop.tierHeaders===4&&r.shop.buyBtns>=20&&r.shop.supps===5&&r.shop.bags&&r.shop.traderHint,r.shop);
 check('buying 5 carrots costs 25 and fills the basket',r.buy&&r.buy.dc===25&&r.buy.carrots>=5,r.buy);
 check('every event lists two trained stats; the events panel says so',r.trains&&r.trains.rows===r.trains.total&&r.trains.h1[0]==='jump'&&r.evRow,{trains:r.trains,evRow:r.evRow});
 check('finishing Cottonwood Welcome Jump grants jump + agility stat XP (not speed)',r.evXp&&r.evXp.jump>0&&r.evXp.agility>0&&r.evXp.speed===0,r.evXp);
 check('xp multipliers stack: bond 100 > bond 10, achievement perk +10%',r.mul&&r.mul.mHigh>r.mul.mLow&&Math.abs(r.mul.mHigh/r.mul.mLow-1.15)<0.01&&Math.abs(r.mul.mPerk/r.mul.mLow-1.10)<0.01,r.mul);
 check('breed trait: Quarter Horse learns acceleration 25% faster (20 → 25 sxp)',r.mul&&Math.abs(r.mul.sxpBay-1.25)<0.01&&Math.abs(r.mul.sxpBayJump-1)<0.01&&r.sxpApplied===25&&/stat XP|Breed perk/.test(r.mul.mastery5||''),{sxpApplied:r.sxpApplied,mul:r.mul});
 check('forage: 19 kinds, apples on orchard trees at Cottonwood, hives, map markers',r.forage&&r.forage.kinds>=19&&r.forage.apples>=14&&r.forage.nearOrchard===r.forage.apples&&r.forage.honey===3&&r.forage.markers===1,r.forage);
 check('picking an apple fills the basket, counts for the forage daily and hides the node',r.pick&&r.pick.apple>=1&&r.pick.forage===r.pick.apple&&r.pick.hidden,r.pick);   // two apples can hang within reach of one tree
 check('coyotes and mountain goats live in the canyon and on Hollowpeak',r.wild&&r.wild.coyote&&r.wild.goat&&r.wild.spawned===6,r.wild);
 check('five traders stand in the towns',r.traderNpc&&r.traderNpc.inDefs&&r.traderNpc.inList&&r.traderNpc.n===5,r.traderNpc);
 check('talking to Marta offers her stall',r.dlg&&r.dlg.shown==='block'&&r.dlg.browse,r.dlg);
 check('her stall lists only Cottonwood stock (apples yes, daikon no) plus supplements',r.traderShop&&r.traderShop.open==='flex'&&r.traderShop.header&&r.traderShop.hasApple&&!r.traderShop.hasDaikon&&r.traderShop.stockRows>=7&&r.traderShop.supps===5,r.traderShop);
 check('buying strawberries from Marta costs 16 and logs the trader',r.traderBuy&&r.traderBuy.dc===16&&r.traderBuy.strawberry>=1&&r.traderBuy.traders&&r.traderBuy.traders.marta>=1,r.traderBuy);
 check('golden horseshoe pays 80 coins and 15 XP',r.shoe&&r.shoe.dcoins===80&&r.shoe.dxp===15&&r.shoe.got,r.shoe);
 check('four fishing spots replace the single lake thing; river spots sit on the bank',r.fishSpots&&r.fishSpots.n===4&&r.fishSpots.things===4&&r.fishSpots.oldLake===0&&Math.abs(r.fishSpots.fordZ-r.fishSpots.riverZ)>7,r.fishSpots);
 check('fishing at Otter Ford: cast, rod shown, bite, catch lands in the basket, rod put away',r.fish&&/Fish at Otter Ford/.test(r.fish.ctx0)&&r.fish.waiting&&r.fish.bit&&/BITE/.test(r.fish.ctx1)&&r.fish.caught===1&&r.fish.fordCount===1&&(r.fish.fishItems===1||r.fish.bottles===1)&&r.fish.rodOn&&r.fish.rodOff,r.fish);
 check('selling a trout pays 70 coins',r.sell&&r.sell.btn&&r.sell.dc===70&&r.sell.left===r.sell.trout0-1,r.sell);
 check('render_game_to_text carries progression',r.state&&r.state.maxLevel===50&&r.state.ceilings&&r.state.foods>=22&&r.state.fish===1,r.state);
 check('stable rows show the breed ceiling strip',r.stable);
 check('no console/page errors',errors.length===0,errors.slice(0,5));
 await browser.close();
 const failed=checks.filter(c=>!c.ok);
 console.log(failed.length?('FAILED '+failed.length+'/'+checks.length):('ALL '+checks.length+' CHECKS PASSED'));
 process.exit(failed.length?1:0);
})().catch(e=>{console.error('FATAL',e);process.exit(2);});

/* Package check: clubs-boards.
   Boots ranch3d.html?qa=clubs-boards, waits for the horse, then drives every feature of the
   package through window.__features, the DOM and synthetic MQTT messages fed straight to
   G.net.onMessage: naming and joining a club, the roster from presence cards, the notice
   board, the chat log and mute list, the weekly club ladder on Star Points, the chest tiers
   and their published odds, the Champions chests, the club-exclusive Ember Friesian, the
   weekly event board with its rank bands, the photo contest series with club entries, past
   winners and prizes, and photo mode (film looks, world freeze, free camera).
   It finishes by mounting both exclusives to prove their authored bodies resolve.

   Usage:  QA_URL=http://127.0.0.1:8431 NODE_PATH=$(npm root -g) node tools/qa-clubs-boards.cjs */
const {chromium}=require('playwright');
const base=(process.env.QA_URL||'http://127.0.0.1:8431').replace(/\/$/,'');
const checks=[];
function check(name,ok,detail){checks.push({name,ok:!!ok,detail});console.log((ok?'PASS ':'FAIL ')+name+(detail!==undefined?' — '+JSON.stringify(detail):''));}
const t0=Date.now();
const stage=s=>console.log('… '+s+' @'+((Date.now()-t0)/1000).toFixed(1)+'s');
const READY=()=>window.render_game_to_text&&(()=>{try{const s=JSON.parse(render_game_to_text());return s.graphics&&s.graphics.horseReady&&!s.graphics.horseLoading;}catch(e){return false;}})();
const near=(a,b,tol)=>Math.abs(a-b)<=tol;
let browser=null;
setTimeout(async()=>{console.error('WATCHDOG: no result after 600 s');try{if(browser)await browser.close();}catch(e){}process.exit(3);},600000).unref();

(async()=>{
 browser=await chromium.launch({headless:true,args:['--disable-background-timer-throttling','--use-angle=metal','--enable-gpu-rasterization','--ignore-gpu-blocklist']});
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 const errors=[];
 page.on('pageerror',e=>errors.push('PAGEERROR '+e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 page.on('dialog',d=>{d.dismiss().catch(()=>{});});
 stage('launch');
 await page.addInitScript(()=>{try{
  localStorage.removeItem('starRanchFable_v1');
  localStorage.removeItem('starRanchFable_photos_v1');
 }catch(e){}});
 await page.goto(base+'/ranch3d.html?qa=clubs-boards&fresh='+Date.now(),{waitUntil:'load',timeout:120000}); stage('loaded');
 await page.waitForFunction(READY,null,{timeout:150000,polling:250}); stage('horseReady');

 /* ---------- 1. club identity, notice board, roster, chat ---------- */
 const a=await page.evaluate(()=>{
  const G=window.__features, S=G.save, C=G.clubs, N=G.net, out={};
  const st=()=>JSON.parse(render_game_to_text());
  out.installed=G.installed.includes('clubs-boards');
  out.errors=G.errors.slice();
  /* offline the whole way: point the client at a fixed room so the topic maths is real */
  N.net.club='qa-club';
  S.sync(sv=>{sv.playerName='QA';});
  const CLUB=N.net.club;

  /* -- create a named club ------------------------------------------------------- */
  document.getElementById('netBtn').click();
  const op=document.getElementById('onlinePanel');
  out.panelOpen=op.style.display;
  out.hasNameInput=!!document.getElementById('clubNameIn');
  out.hasNoticeSection=/Notice board/.test(op.textContent);
  out.hasRoster=/Roster \(/.test(op.textContent);
  out.hasChatLog=/Chat log/.test(op.textContent);
  document.getElementById('clubNameIn').value='Meadow Riders';
  G.ui.dispatch('clubs:name');
  let s=S.fresh();
  out.clubMeta={name:s.clubMeta.name,founder:s.clubMeta.founder,created:s.clubMeta.created>0};
  out.ach_club1=(G.quest.ACHS.find(x=>x.id==='club1')||{v:()=>0}).v(s);
  document.getElementById('netBtn').click(); document.getElementById('netBtn').click();
  document.getElementById('clubMottoIn').value='Ride kind, ride far';
  G.ui.dispatch('clubs:motto');
  out.motto=S.fresh().clubMeta.motto;
  G.ui.dispatch('clubs:pub'); out.pub=S.fresh().clubMeta.pub;

  /* -- notice board -------------------------------------------------------------- */
  document.getElementById('netBtn').click(); document.getElementById('netBtn').click();
  document.getElementById('noticeIn').value='Club ride Sunday at six, meet at the bridge.';
  G.ui.dispatch('clubs:pin');
  s=S.fresh(); out.pinned={t:s.clubNotice.t,by:s.clubNotice.by,at:s.clubNotice.at>0};
  out.ach_notice=(G.quest.ACHS.find(x=>x.id==='clubnotice')||{v:()=>0}).v(s);
  /* a remote notice, over-length, from another rider */
  N.onMessage('srf1/'+CLUB+'/notice',JSON.stringify({id:'zz',n:'Ann Kestrel and a very long name',t:'x'.repeat(500),at:Date.now()}));
  s=S.fresh(); out.remoteNotice={len:s.clubNotice.t.length,by:s.clubNotice.by,byLen:s.clubNotice.by.length};
  document.getElementById('netBtn').click(); document.getElementById('netBtn').click();
  out.noticeShown=/xxxx/.test(document.getElementById('onlinePanel').textContent);

  /* -- roster from presence cards ------------------------------------------------- */
  N.onMessage('srf1/'+CLUB+'/members/Ann',JSON.stringify({id:'zz',n:'Ann',sp:180,last:Date.now(),h:4}));
  N.onMessage('srf1/'+CLUB+'/members/Bo',JSON.stringify({id:'yy',n:'Bo',sp:60,last:Date.now(),h:2}));
  out.memberCount=C.memberCount();
  document.getElementById('netBtn').click(); document.getElementById('netBtn').click();
  out.rosterText=/Ann/.test(document.getElementById('onlinePanel').textContent)&&/Bo/.test(document.getElementById('onlinePanel').textContent);

  /* -- club meta arriving from the founder --------------------------------------- */
  N.onMessage('srf1/'+CLUB+'/meta',JSON.stringify({id:'zz',n:'Ann',nm:'Meadow Riders',f:'Ann',mo:'hi',at:Date.now()}));
  out.metaSeen={name:C.clubMeta.name,founder:C.clubMeta.founder};

  /* -- chat log & mute ------------------------------------------------------------ */
  const feed=document.getElementById('chatFeed');
  const before=C.clubLog.length;
  N.sendChat('hello club');
  for(let i=0;i<10;i++)N.onMessage('srf1/'+CLUB+'/chat',JSON.stringify({id:'zz',n:'Ann',t:'line '+i}));
  /* the log is fed by a MutationObserver on the ticker, so it lands one microtask later */
  return new Promise(res=>setTimeout(()=>{
   out.chat={cap:(window.__features&&window.__features.chatLines)||8,feedChildren:feed.children.length,log:C.clubLog.length-before,lastFeed:feed.lastChild.textContent};
   out.savedLog=(S.fresh().chatLog||[]).length;
   C.toggleMute('Ann');
   const muteBefore=C.clubLog.length;
   N.onMessage('srf1/'+CLUB+'/chat',JSON.stringify({id:'zz',n:'Ann',t:'you should not see this'}));
   setTimeout(()=>{
    out.muted={isMuted:C.isMuted('Ann'),grew:C.clubLog.length-muteBefore,body:!/should not see/.test(feed.textContent)};
    C.toggleMute('Ann');
    out.unmuted=!C.isMuted('Ann');
    G.hidePanels();
    res(out);
   },30);
  },30));
 });
 stage('club identity');
 check('package installed with no install errors',a.installed&&a.errors.length===0,{installed:a.installed,errors:a.errors});
 check('clubs-create-join: the club panel carries name, notice, roster and chat log',a.panelOpen==='flex'&&a.hasNameInput&&a.hasNoticeSection&&a.hasRoster&&a.hasChatLog,a);
 check('clubs-create-join: naming a club records name, founder and date',a.clubMeta.name==='Meadow Riders'&&a.clubMeta.founder==='QA'&&a.clubMeta.created,a.clubMeta);
 check('clubs-create-join: motto and directory opt-in persist',a.motto==='Ride kind, ride far'&&a.pub===true,{motto:a.motto,pub:a.pub});
 check('clubs-create-join: the founding-member achievement reads 1',a.ach_club1===1,a.ach_club1);
 check('club-notice-board: pinning writes text, author and time',a.pinned.t.indexOf('Sunday at six')>0&&a.pinned.by==='QA'&&a.pinned.at,a.pinned);
 check('club-notice-board: a remote notice is truncated to 200 chars and the name to 14',a.remoteNotice.len===200&&a.remoteNotice.byLen===14,a.remoteNotice);
 check('club-notice-board: the pinned notice renders in the panel',a.noticeShown,a.noticeShown);
 check('club-notice-board: the notice achievement reads 1',a.ach_notice===1,a.ach_notice);
 check('clubs-create-join: presence cards build a 3-rider roster',a.memberCount===3&&a.rosterText,{memberCount:a.memberCount,rosterText:a.rosterText});
 check('clubs-create-join: a retained club card names the club and its founder',a.metaSeen.name==='Meadow Riders'&&a.metaSeen.founder==='Ann',a.metaSeen);
 /* The ticker's cap is G.chatLines, which the social package raises from 8 to 30 and makes
   scrollable. With 11 messages the feed keeps min(cap, 11); the log always keeps all 11. */
 check('club-chat: the ticker keeps its line cap while the log keeps all 11',a.chat.feedChildren===Math.min(a.chat.cap,11)&&a.chat.log===11,a.chat);
 check('club-chat: the last 30 lines are written to the save',a.savedLog===11,a.savedLog);
 check('club-chat: a muted rider is dropped before the ticker and the log',a.muted.isMuted&&a.muted.grew===0&&a.muted.body&&a.unmuted,a.muted);

 /* ---------- 2. the club ladder, chests and the club horse ---------- */
 const b=await page.evaluate(()=>{
  const G=window.__features, S=G.save, C=G.clubs, N=G.net, out={};
  const st=()=>JSON.parse(render_game_to_text());
  const CLUB=N.net.club, wk=G.time.weekKey();
  /* -- the club total: mine plus every club mate's retained sp board -------------- */
  S.sync(sv=>{sv.sp={week:wk,pts:120};});
  N.lbData.sp={QA:120,Ann:80,Bo:40};
  out.total=C.clubTotal();                       // presence cards say Ann 180 / Bo 60, the retained board 80 / 40 — the higher wins
  const keep={}; for(const k of Object.keys(C.clubMembers)){keep[k]=C.clubMembers[k];delete C.clubMembers[k];}
  out.totalBoardOnly=C.clubTotal();              // board alone: 120 + 80 + 40
  for(const k of Object.keys(keep))C.clubMembers[k]=keep[k];
  out.isoWeek=C.CW();
  out.msToMonday=C.msToMonday();
  /* -- rival clubs and a real one over the global topic --------------------------- */
  N.onMessage('srf1/clubs/other-club',JSON.stringify({id:'zz',n:'Ann',nm:'Willow Bend Riders',sp:9999,mem:6,wk:C.CW()}));
  const rows=C.clubRows();
  out.rowCount=rows.length;
  out.topIsReal=rows[0].n==='Willow Bend Riders'&&rows[0].club===true;
  out.sortedDesc=rows.every((r,i)=>i===0||rows[i-1].v>=r.v);
  out.rankWithReal=C.myClubRank().rank;
  /* drop the stale-week guard test: a card from another week must be ignored */
  N.onMessage('srf1/clubs/stale-club',JSON.stringify({id:'zz',n:'Ann',nm:'Old Timers',sp:99999,mem:9,wk:'1999-01-04'}));
  out.staleIgnored=!C.clubRows().some(r=>r.n==='Old Timers');
  /* -- the directory -------------------------------------------------------------- */
  N.onMessage('srf1/dir/friendly',JSON.stringify({id:'zz',n:'Ann',nm:'Friendly Farms',mem:3,sp:400,wk:C.CW()}));
  out.dir=!!C.clubDir.friendly;
  /* -- tiers and odds ------------------------------------------------------------- */
  out.tiers=[C.chestTier(0),C.chestTier(119),C.chestTier(120),C.chestTier(300),C.chestTier(700),C.chestTier(1500),C.chestTier(99999)];
  out.oddsSum={};
  for(const t of [1,2,3,4,5])out.oddsSum[t]=C.CLUB_CHEST_LOOT[t].reduce((x,y)=>x+y.p,0);
  let k5=0; const M=4000;
  for(let i=0;i<M;i++){const r=C.rollClubChest(5);if(r.r&&r.r.k===5)k5++;}
  out.tier5KeyFreq=+(k5/M*100).toFixed(1);
  let horse=0, tok=0;
  for(let i=0;i<M;i++){const r=C.rollChampion();if(r.clubHorse)horse++;if(r.r&&r.r.btok)tok++;}
  out.champHorseFreq=+(horse/M*100).toFixed(1);
  out.champTokFreq=+(tok/M*100).toFixed(1);
  out.champCounts=[C.championCount(1),C.championCount(2),C.championCount(3),C.championCount(4),C.championCount(0)];
  /* -- a settled week, claimed from the Club tab ---------------------------------- */
  S.sync(sv=>{sv.clubWeekLast={week:'2026-W00',total:1500,rank:1,n:3,claimed:false,champClaimed:false};
   sv.stats=sv.stats||{}; sv.stats.clubChests=0; sv.stats.clubChamp=0; sv.clubHorseVoucher=0;});
  G.ui.openLB();
  const lp=document.getElementById('lbPanel');
  out.clubTabExists=!!lp.querySelector('[data-lbtab="club"]');
  lp.querySelector('[data-lbtab="club"]').click();
  out.clubTab={odds:/%/.test(lp.textContent),claimBtn:!!lp.querySelector('[data-fx="clubs:claim"]'),
   champRow:/Champions chest ×2/.test(lp.textContent),ladder:/Basin club ladder/.test(lp.textContent),
   ember:/Ember Friesian/.test(lp.textContent),monday:/Monday 00:00 UTC/.test(lp.textContent),
   tierLine:/120⭐→T2/.test(lp.textContent)};
  const w0=st().wallet, tack0=(S.fresh().tack||[]).length;
  lp.querySelector('[data-fx="clubs:claim"]').click();
  const s2=S.fresh(), w1=st().wallet;
  out.claim={claimed:s2.clubWeekLast.claimed,tier:s2.clubWeekLast.tier,chests:s2.stats.clubChests,champ:s2.stats.clubChamp,
   gained:(w1.coins-w0.coins)+(w1.gems-w0.gems)+(w1.keys-w0.keys)+(w1.dust-w0.dust)+(w1.btok-w0.btok)+((S.fresh().tack||[]).length-tack0)+(s2.clubHorseVoucher||0)};
  /* claiming twice must be a no-op */
  const w2=st().wallet;
  lp.querySelector('[data-lbtab="club"]').click();
  out.claim.secondBtn=!!lp.querySelector('[data-fx="clubs:claim"]');
  /* -- the club horse ------------------------------------------------------------- */
  S.sync(sv=>{sv.clubHorseVoucher=1;});
  const n0=S.fresh().horses.length;
  C.claimClubHorse();
  const s3=S.fresh();
  const eh=s3.horses.find(h=>h.breed===C.CLUB_HORSE);
  out.clubHorse={added:s3.horses.length-n0,voucher:s3.clubHorseVoucher,stats:eh&&eh.stats,
   ach:(G.quest.ACHS.find(x=>x.id==='clubhorse')||{v:()=>0}).v(s3)};
  out.clubHorseAgain=C.claimClubHorse()===false;
  /* -- exclusivity ---------------------------------------------------------------- */
  const row=G.tables.BREEDS3.find(x=>x[0]===C.CLUB_HORSE), prow=G.tables.BREEDS3.find(x=>x[0]===C.PHOTO_HORSE);
  out.exclusive={inTable:!!row&&!!prow,
   shop:G.horse.breedAvailable(row,'shop'),market:G.horse.breedAvailable(row,'market'),summon:G.horse.breedAvailable(row,'summon'),
   pshop:G.horse.breedAvailable(prow,'shop'),src:G.horse.breedSrc(row)};
  G.ui.openShop('horses');
  out.exclusive.shopHtml=!/Ember Friesian/.test(document.getElementById('shopPanel').textContent)&&!/Larksong/.test(document.getElementById('shopPanel').textContent);
  G.hidePanels();
  return out;
 });
 stage('ladder + chests');
 check('club-weekly-leaderboard: the club total sums every member’s Star Points',b.total===360&&b.totalBoardOnly===240,{merged:b.total,boardOnly:b.totalBoardOnly});
 check('club-weekly-leaderboard: the club week is the ISO Monday-00:00-UTC week',/^\d{4}-\d{2}-\d{2}$/.test(b.isoWeek)&&b.msToMonday>0&&b.msToMonday<=7*864e5,{isoWeek:b.isoWeek,ms:b.msToMonday});
 check('club-weekly-leaderboard: rivals plus a real club rank together, highest first',b.rowCount===10&&b.topIsReal&&b.sortedDesc&&b.rankWithReal>1,b);
 check('club-weekly-leaderboard: a card from another club week is ignored',b.staleIgnored,b.staleIgnored);
 check('clubs-create-join: the public directory records other clubs',b.dir,b.dir);
 check('club-chest-tiers: thresholds map 0/120/300/700/1500 onto tiers 1-5',JSON.stringify(b.tiers)==='[1,1,2,3,4,5,5]',b.tiers);
 check('club-chest-tiers: every tier’s published odds sum to 100%',Object.values(b.oddsSum).every(v=>v===100),b.oddsSum);
 check('club-chest-tiers: tier 5 rolls 5 keys at the published 40%',near(b.tier5KeyFreq,40,4),b.tier5KeyFreq);
 check('club-chest-tiers: the Club tab publishes the odds and the tier ladder',b.clubTab.odds&&b.clubTab.tierLine&&b.clubTab.ladder&&b.clubTab.monday,b.clubTab);
 check('champions-chests: rank 1 takes two, the rest of the top three take one, nobody else',JSON.stringify(b.champCounts)==='[2,1,1,0,0]',b.champCounts);
 check('champions-chests: the club horse rolls at the published 5% and a token at 35%',near(b.champHorseFreq,5,2)&&near(b.champTokFreq,35,4),{horse:b.champHorseFreq,tok:b.champTokFreq});
 check('champions-chests: a rank-1 week shows the ×2 Champions row',b.clubTab.champRow,b.clubTab);
 check('club-chest-tiers: collecting pays out, stamps the week and cannot be repeated',b.claim.claimed&&b.claim.chests===1&&b.claim.gained>0&&!b.claim.secondBtn,b.claim);
 check('champions-chests: the champion counter moves on a top-three week',b.claim.champ===1,b.claim.champ);
 check('club-exclusive-horse: the Ember Friesian is granted with its fixed 9/8/6/9/5 profile',b.clubHorse.added===1&&b.clubHorse.voucher===0&&JSON.stringify(b.clubHorse.stats)==='{"speed":9,"stamina":8,"jump":6,"accel":9,"agility":5}'&&b.clubHorse.ach===1,b.clubHorse);
 check('club-exclusive-horse: a second claim without a token is refused',b.clubHorseAgain,b.clubHorseAgain);
 check('club-exclusive-horse: neither exclusive is on sale anywhere',b.exclusive.inTable&&!b.exclusive.shop&&!b.exclusive.market&&!b.exclusive.summon&&!b.exclusive.pshop&&b.exclusive.shopHtml,b.exclusive);

 /* ---------- 3. the weekly event board ---------- */
 const c=await page.evaluate(()=>{
  const G=window.__features, S=G.save, C=G.clubs, N=G.net, out={};
  const evs=G.course.weeklyFeatured();
  out.featured=evs.length;
  S.sync(sv=>{sv.bestTimes=sv.bestTimes||{};sv.bestTimes[evs[0].id]=1.0;});   // an unbeatable round
  N.lbData['ev_'+evs[0].id]={Ann:40};
  const rows=C.evRows(evs[0],S.fresh());
  out.firstIsMe=rows[0].me===true;
  out.clubRowPresent=rows.some(r=>r.n==='Ann'&&r.club);
  out.ranks=C.weeklyRanks(S.fresh());
  out.bands=[C.bandFor(1).label,C.bandFor(3).label,C.bandFor(9).label,C.bandFor(400).label];
  G.ui.openLB();
  const lp=document.getElementById('lbPanel');
  out.tabExists=!!lp.querySelector('[data-lbtab="weekly"]');
  lp.querySelector('[data-lbtab="weekly"]').click();
  out.boards=lp.querySelectorAll('.bRow').length;
  out.preview=/Winner/.test(lp.textContent)&&/Podium/.test(lp.textContent)&&/Top ten/.test(lp.textContent);
  /* a settled week with a placing to claim */
  S.sync(sv=>{sv.wkRanksLast={week:'2026-W00',ranks:{[evs[0].id]:1}};sv.lbClaims=sv.lbClaims||{};delete sv.lbClaims['wr_2026-W00_'+evs[0].id];});
  lp.querySelector('[data-lbtab="weekly"]').click();
  const btn=lp.querySelector('[data-fx="clubs:wrank:'+evs[0].id+'"]');
  out.claimBtn=!!btn;
  const g0=JSON.parse(render_game_to_text()).wallet.gems;
  if(btn)btn.click();
  out.claimed={gems:JSON.parse(render_game_to_text()).wallet.gems-g0,stamped:!!(S.fresh().lbClaims||{})['wr_2026-W00_'+evs[0].id]};
  out.claimAgain=C.claimWeekRank(evs[0].id)===false;
  G.hidePanels();
  return out;
 });
 stage('weekly board');
 check('leaderboard-screens: four featured events each get a board',c.featured===4&&c.boards===4&&c.tabExists,{featured:c.featured,boards:c.boards});
 check('leaderboard-screens: a real club time joins the board and the best time leads it',c.firstIsMe&&c.clubRowPresent,c);
 check('leaderboard-screens: the rank-band reward preview is on screen',c.preview&&JSON.stringify(c.bands)==='["🥇 Winner","🥈 Podium","🏅 Top ten","🎗️ Placed"]',c.bands);
 check('leaderboard-screens: last week’s placing pays its band once',c.claimBtn&&c.claimed.gems>=6&&c.claimed.stamped&&c.claimAgain,c.claimed);

 /* ---------- 4. photo contests ---------- */
 const d=await page.evaluate(()=>{
  const G=window.__features, S=G.save, C=G.clubs, N=G.net, out={};
  const wk=G.time.weekKey(), CLUB=N.net.club;
  const px='data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==';
  C.savePhotos({week:wk,shots:[
   {id:'pA',t:Date.now(),thumb:px,m:{theme:true,wild:2,day:0.26,spd:11,wx:'rain',filter:'sepia'}},
   {id:'pB',t:Date.now()-1000,thumb:px,m:{theme:false,wild:0,day:0.5,spd:0,wx:'clear',filter:'none'}}],entry:'pB'});
  out.scoreA=C.scoreShot({theme:true,wild:2,day:0.26,spd:11,wx:'rain',filter:'sepia'}).total;
  out.scoreB=C.scoreShot({theme:false,wild:0,day:0.5,spd:0,wx:'clear',filter:'none'}).total;
  out.filmLook=C.scoreShot({filter:'warm'}).parts.find(p=>p[0].indexOf('Film look')>0)[1];
  /* a club mate's entry over MQTT */
  N.onMessage('srf1/'+CLUB+'/photo/'+wk+'/Ada',JSON.stringify({id:'zz',n:'Ada',v:90,th:null}));
  const st1=C.standings();
  out.adaIn=st1.some(r=>r.n==='Ada'&&r.v===90&&r.club);
  out.youIn=st1.some(r=>r.me);
  G.ui.openLB();
  const lp=document.getElementById('lbPanel');
  lp.querySelector('[data-lbtab="photos"]').click();
  out.tiles=lp.querySelectorAll('.shot').length;
  out.entered=lp.querySelectorAll('.shot .ent').length;
  out.prizes=/Larksong Unicorn/.test(lp.textContent)&&/Golden frame/.test(lp.textContent);
  out.pastHeading=/Past winners/.test(lp.textContent);
  out.contestNames=G.clubs.PHOTO_CONTESTS.length;
  /* switch the entry to the better shot */
  lp.querySelector('[data-fx="clubs:photo:pA"]').click();
  out.entry=C.loadPhotos().entry;
  out.place=S.fresh().wk.place;
  /* prizes: three wins unlocks the contest exclusive */
  S.sync(sv=>{sv.photoWins=3;sv.photoClaims={};sv.photoHist=[{week:'2026-W00',place:1,theme:'Winter Light',score:4}];});
  lp.querySelector('[data-lbtab="photos"]').click();
  out.pastShown=/Winter Light/.test(lp.textContent);
  out.claimable=lp.querySelectorAll('[data-fx^="clubs:pprize:"]').length;
  const n0=S.fresh().horses.length;
  lp.querySelector('[data-fx="clubs:pprize:horse"]').click();
  lp.querySelector('[data-fx="clubs:pprize:frame"]').click();
  const s=S.fresh();
  out.prizeClaim={horses:s.horses.length-n0,lark:s.horses.some(h=>h.breed===C.PHOTO_HORSE),frame:s.photoFrame,claims:Object.keys(s.photoClaims).length};
  out.prizeAgain=C.claimPhotoPrize('horse')===false;
  out.ach_photo=(G.quest.ACHS.find(x=>x.id==='photo1st')||{v:()=>0}).v(s);
  /* the week closing counts a win and banks the placing */
  S.sync(sv=>{sv.photoWins=0;sv.wk={week:'2026-W01',sp:10,photos:3,events:1,days:2,place:1};});
  G.on&&null;
  G.clubs.CW();
  window.__features.run('weekRoll',S.fresh());
  return new Promise(res=>setTimeout(()=>{const s2=S.fresh();
   out.weekClose={wins:s2.photoWins,hist:(s2.photoHist||[]).length,banked:!!s2.wkRanksLast};
   G.hidePanels(); res(out);},60));
 });
 stage('photo contests');
 check('photo-contests: the seven-part score ranks a themed golden-hour shot far above a snapshot',d.scoreA>d.scoreB+50&&d.filmLook===5,{a:d.scoreA,b:d.scoreB,film:d.filmLook});
 check('photo-contests: a club mate’s entry joins the standings beside yours',d.adaIn&&d.youIn,{ada:d.adaIn,you:d.youIn});
 check('photo-contest-ui: the gallery shows both shots with exactly one entered',d.tiles===2&&d.entered===1,{tiles:d.tiles,entered:d.entered});
 check('photo-contest-ui: tapping a shot enters it and records the placing',d.entry==='pA'&&typeof d.place==='number',{entry:d.entry,place:d.place});
 check('photo-contests: twelve named monthly contests with a prize ladder are listed',d.contestNames===12&&d.prizes,{n:d.contestNames,prizes:d.prizes});
 check('photo-contest-ui: past winners are archived and shown',d.pastHeading&&d.pastShown,{h:d.pastHeading,shown:d.pastShown});
 check('photo-contests: three wins hand over the Larksong Unicorn, once',d.prizeClaim.lark&&d.prizeClaim.horses===1&&d.prizeClaim.frame&&d.prizeAgain,d.prizeClaim);
 check('photo-contests: the champion achievement reads a win',d.ach_photo>=1,d.ach_photo);
 check('photo-contests: closing a week banks the win, the archive and the rank snapshot',d.weekClose.wins===1&&d.weekClose.hist>=1&&d.weekClose.banked,d.weekClose);

 /* ---------- 5. photo mode ---------- */
 const e1=await page.evaluate(()=>{
  const G=window.__features, out={};
  const st=()=>JSON.parse(render_game_to_text());
  out.filters=G.clubs.filters.length;
  document.getElementById('poseBtn').click();
  out.bar={filterBtns:document.getElementById('poseBar').querySelectorAll('[data-pf]').length,pause:!!document.getElementById('photoPause')};
  document.getElementById('poseBar').querySelector('[data-pf="sepia"]').click();
  out.filter=st().photo.filter;
  out.passEnabled=G.composer.passes.some(p=>p.mat&&p.enabled);
  out.passBeforeOutput=G.composer.passes.findIndex(p=>!!p.mat)===G.composer.passes.length-2;
  document.getElementById('photoPause').click();
  out.paused=st().photo.paused;
  out.before={x:st().player.x,z:st().player.z,day:st().graphics.day};
  return new Promise(res=>setTimeout(()=>{const s=st();out.posing=s.photo.posing;out.free=s.camera.free;res(out);},40));
 });
 await page.keyboard.down('ArrowUp');
 await page.evaluate(()=>window.advanceTime(2000));
 await page.keyboard.up('ArrowUp');
 const e2=await page.evaluate(()=>{
  const st=()=>JSON.parse(render_game_to_text());
  const out={after:{x:st().player.x,z:st().player.z,day:st().graphics.day}};
  out.png=document.querySelector('canvas').toDataURL('image/png').length;
  return out;
 });
 await page.keyboard.press('Escape');
 const e3=await page.evaluate(()=>{
  const st=()=>JSON.parse(render_game_to_text());
  const G=window.__features;
  const s=st();
  return {posing:s.photo.posing,free:s.camera.free,paused:s.photo.paused,
   moves:(()=>{const x0=st().player.x;return x0;})()};
 });
 await page.evaluate(()=>window.advanceTime(600));
 const e4=await page.evaluate(()=>JSON.parse(render_game_to_text()).graphics.day);
 stage('photo mode');
 check('photo-mode: six film looks and a freeze button live on the pose bar',e1.filters===6&&e1.bar.filterBtns===6&&e1.bar.pause,e1.bar);
 check('photo-mode: entering the mode takes the free camera with it',e1.posing&&e1.free,{posing:e1.posing,free:e1.free});
 check('photo-mode: a look is applied as a composer pass ahead of the output pass',e1.filter==='sepia'&&e1.passEnabled&&e1.passBeforeOutput,{filter:e1.filter,on:e1.passEnabled,order:e1.passBeforeOutput});
 check('photo-mode: the freeze holds the world still while 2 s are stepped',e1.paused&&e2.after.x===e1.before.x&&e2.after.z===e1.before.z&&e2.after.day===e1.before.day,{before:e1.before,after:e2.after});
 check('photo-mode: the canvas still reads back as a PNG',e2.png>1000,e2.png);
 check('photo-mode: Escape leaves the mode, the freeze and the free camera',!e3.posing&&!e3.free&&!e3.paused,e3);
 check('photo-mode: time runs again after leaving',e4!==e2.after.day,{paused:e2.after.day,after:e4});

 /* ---------- 6. the boot pass and the club-week roll ---------- */
 const f=await page.evaluate(()=>{
  const G=window.__features, S=G.save, C=G.clubs, out={};
  S.sync(sv=>{sv.clubWeek={week:'1999-01-04',total:888,rank:2,n:3};sv.clubWeekLast=null;});
  const closed=C.clubWeekRoll();
  const s=S.fresh();
  out.rolled=!!closed;
  out.last={total:s.clubWeekLast.total,rank:s.clubWeekLast.rank,claimed:s.clubWeekLast.claimed};
  out.fresh={week:s.clubWeek.week===C.CW(),total:s.clubWeek.total};
  C.touchClubWeek();
  out.touched=S.fresh().clubWeek.total;
  out.state=JSON.parse(render_game_to_text()).club;
  return out;
 });
 stage('week roll');
 check('club-weekly-leaderboard: Monday puts the week aside unclaimed and starts a fresh one',f.rolled&&f.last.total===888&&f.last.rank===2&&f.last.claimed===false&&f.fresh.week&&f.fresh.total===0,f);
 check('club-weekly-leaderboard: the running total is re-read after the roll',f.touched===360&&f.state.tier===3&&f.state.name==='Meadow Riders',{touched:f.touched,state:f.state});

 /* ---------- 7. the two exclusives actually render ---------- */
 stage('ride the exclusives');
 const rode=[];
 for(const key of ['emberfriesian','larksong']){
  const idx=await page.evaluate(k=>{
   const G=window.__features, sel=document.getElementById('horseSel');
   const i=G.horse.myHorses.findIndex(h=>h.breed===k);
   if(i<0)return -1;
   sel.value=String(i); sel.onchange();
   return i;
  },key);
  if(idx<0){rode.push({key,found:false});continue;}
  let ok=true;
  try{await page.waitForFunction(k=>{try{const s=JSON.parse(render_game_to_text());return s.graphics.horseBreed===k&&s.graphics.horseReady&&!s.graphics.horseLoading;}catch(e){return false;}},key,{timeout:60000,polling:250});}
  catch(e){ok=false;}
  const g=await page.evaluate(()=>{const s=JSON.parse(render_game_to_text());return {breed:s.graphics.horseBreed,model:s.graphics.horseModel,ready:s.graphics.horseReady,tris:s.graphics.triangles};});
  rode.push({key,found:true,ok,g});
 }
 check('club-exclusive-horse: the Ember Friesian mounts on an authored body and renders',rode[0].found&&rode[0].ok&&rode[0].g.tris>1000,rode[0]);
 check('photo-contests: the Larksong Unicorn mounts on an authored body and renders',rode[1].found&&rode[1].ok&&rode[1].g.tris>1000,rode[1]);

 const hard=errors.filter(x=>!/favicon|manifest|Failed to load resource|404|mqtt|broker|WebSocket/i.test(x));
 check('no console or page errors',hard.length===0,hard.slice(0,6));
 await browser.close();
 const failed=checks.filter(c2=>!c2.ok);
 console.log('\n'+(checks.length-failed.length)+'/'+checks.length+' checks passed in '+((Date.now()-t0)/1000).toFixed(1)+'s');
 if(failed.length){console.log('FAILED: '+failed.map(f2=>f2.name).join(' | '));process.exitCode=1;}
})().catch(async e=>{console.error(e);try{if(browser)await browser.close();}catch(e2){}process.exit(2);});

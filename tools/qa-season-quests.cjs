/* season-quests package check.

   There is no ?season= override and there cannot be one — seasonNow() is a module-scope
   function declaration that ten inline sites call directly — so a season is chosen by
   stubbing Date.now in addInitScript before the page loads.  Season n starts at
   SEASON_EPOCH + n*28 days and SEASONS[n%4] is bloom / sun / ember / frost.

   Three boots:
    1. bloom, day 5, a brand-new save — the four houses, the pledge and its refusal, the
       points watermark, the gauntlet bonus, a house post paying its own rider and turning
       away everybody else, Wick's first entry ridden and turned in through his dialogue,
       the 🗓️ Season quest tab, the encore notice and the read-only banner card;
    2. ember, day 10, a brand-new save — the lantern book, all four entries closed, the
       season-hunts seam actually called, the lifetime tally;
    3. frost, same browser storage as boot 2 — a player who was away for a whole season
       comes back to a cleared pledge and a fresh book, with the lifetime tally intact.

   Usage:  QA_URL=http://127.0.0.1:8513 NODE_PATH=$(npm root -g) node tools/qa-season-quests.cjs */
const {chromium}=require('playwright');
const base=(process.env.QA_URL||'http://127.0.0.1:8513').replace(/\/$/,'');
const EPOCH=Date.UTC(2026,0,5), DAY=864e5;
const at=(n,day)=>EPOCH+n*28*DAY+((day||1)-1)*DAY+3600e3;
const checks=[];
function check(name,ok,detail){checks.push({name,ok:!!ok,detail});console.log((ok?'PASS ':'FAIL ')+name+(detail!==undefined?' — '+JSON.stringify(detail):''));}
const t0=Date.now();
const stage=s=>console.log('… '+s+' @'+((Date.now()-t0)/1000).toFixed(1)+'s');
let browser=null;
setTimeout(async()=>{console.error('WATCHDOG: no result after 600 s');try{if(browser)await browser.close();}catch(e){}process.exit(3);},600000).unref();
const ARGS=['--disable-background-timer-throttling','--use-angle=metal','--enable-gpu-rasterization','--ignore-gpu-blocklist'];
const READY=()=>window.render_game_to_text&&(()=>{try{const s=JSON.parse(render_game_to_text());return s.graphics&&s.graphics.horseReady&&!s.graphics.horseLoading;}catch(e){return false;}})();

/* helpers evaluated in the page */
const H=`
 const G=window.__features, HS=G.houses, $=id=>document.getElementById(id);
 const sv=()=>G.save.fresh()||{};
 const st=()=>JSON.parse(render_game_to_text());
 const key=code=>{try{if(document.activeElement&&document.activeElement.blur)document.activeElement.blur();}catch(e){}window.dispatchEvent(new KeyboardEvent('keydown',{code}));};
 const goto2=(x,z)=>{G.horse.player.pos.set(x,0,z);G.horse.player.speed=0;window.advanceTime(140);};
 const click=sel=>{const b=document.querySelector(sel);if(!b)return false;b.click();return true;};
 const txt=id=>{const p=$(id);return p?(p.innerText||p.textContent||''):'';};
 const lbTab=id=>{G.ui.openLB();const b=document.querySelector('#lbPanel [data-lbtab="'+id+'"]');if(b)b.click();return !!b;};
 const qTab=id=>{G.ui.openQuests();const b=document.querySelector('#questPanel [data-q="tab:'+id+'"]');if(b)b.click();return !!b;};
 const post=hid=>HS.posts.find(p=>p.h.id===hid);
 const entry=i=>HS.book().entries[i];
 /* Fill the open entry by reporting the moment the game itself would report. */
 const fill=()=>{const e=entry(HS.bookState().i);if(!e)return false;
  for(let i=0;i<Math.ceil(e.goal)+2;i++)G.quest.dailyEvt(e.evt,1);
  G.ui.dispatch('house:entry');return true;};
`;
const run=(page,code)=>page.evaluate('(()=>{'+H+code+'})()');

async function open(ctx,ts,fresh,tag){
 const page=await ctx.newPage();
 await page.addInitScript(([t,clear])=>{Date.now=()=>t;if(clear){try{localStorage.clear();}catch(e){}}},[ts,!!fresh]);
 const errors=[];
 page.on('pageerror',e=>errors.push('PAGEERROR '+e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 page.on('dialog',d=>{d.dismiss().catch(()=>{});});
 await page.goto(base+'/ranch3d.html?qa=season-quests&t='+Date.now(),{waitUntil:'load',timeout:120000});
 stage(tag+' loaded');
 await page.waitForFunction(READY,null,{timeout:150000,polling:250});
 stage(tag+' horseReady');
 return {page,errors};
}

(async()=>{
 browser=await chromium.launch({headless:true,args:ARGS});
 stage('launch');

 /* ================= 1. bloom, day 5, a brand-new save ================= */
 const ctxA=await browser.newContext({viewport:{width:1280,height:800}});
 const A=await open(ctxA,at(12,5),true,'bloom');
 const r1=await run(A.page,`
  const out={};
  out.installed=G.installed.indexOf('season-quests')>=0; out.errors=G.errors.slice(); out.hasHouses=!!HS;
  out.season=HS.season().def.id; out.skey=HS.season().key; out.day=HS.season().day;
  /* the world */
  out.posts=G.world.things.filter(t=>t.kind==='housepost').length;
  out.postGround=HS.posts.every(p=>Number.isFinite(G.world.groundH(p.x,p.z)));
  out.markers=G.world.mapMarkers.filter(m=>m.glyph==='🛡️').length;
  out.wick=G.world.npcList.filter(q=>q.def&&q.def.id==='almanac').length;
  out.wickClear=(()=>{const w=HS.wick();if(!w)return false;
   return !G.world.colliders.some(c=>Math.hypot(w.def.x-c.x,w.def.z-c.z)<(c.r||0)+1.2);})();
  /* nearNPC is tested before nearThing and reaches 3.5 m, so a board inside a villager's talk
     radius is not a board at all — E goes to the villager and the post silently pays nothing.
     Villagers walk beats, so the waypoints count as much as where they happen to be standing. */
  out.postNpcGap=(()=>{const sp=[];
   for(const q of G.world.npcList)sp.push([q.g.position.x,q.g.position.z]);
   /* the rounds live on the townsfolk records, not on the NPC defs — a villager's def only
      carries the first waypoint, so checking defs alone would miss three quarters of the beat */
   for(const f of ((G.worldPkg&&G.worldPkg.townsfolk)||[]))
    if(Array.isArray(f.path))for(const w of f.path)sp.push([+w[0],+w[1]]);
   /* measured from where the RIDER ends up, a metre or so off the board, not from the board */
   return HS.posts.map(p=>({h:p.h.id,d:+Math.min.apply(null,sp.map(t=>Math.hypot(p.x+1.2-t[0],p.z+1.2-t[1]))).toFixed(2)}));})();
  /* world.js pins every non-folk NPC once, at its own install, which is before this package
     adds Wick — so he has to bring his own pin or be the one quest-giver nobody can find. */
  out.npcFamily={defs:G.quest.NPC_DEFS.filter(d=>!d.folk).length,pins:G.worldPkg.markerKinds().npc};
  out.wickPin=G.world.mapMarkers.filter(m=>m.kind==='npc'&&m.npc==='almanac').length;
  /* the pledge screen */
  out.tabOpened=lbTab('house');
  out.pledgeBtns=document.querySelectorAll('#lbPanel [data-fx^="house:pledge:"]').length;
  out.lbText=txt('lbPanel');
  /* pledge, and the refusal of a second one */
  const pts0=(sv().pass&&sv().pass.pts)||0;
  out.clicked=click('#lbPanel [data-fx="house:pledge:cottonwood"]');
  out.pledged=(sv().house||{}).id; out.pledgedPts=(sv().house||{}).pts; out.passAtPledge=pts0;
  lbTab('house'); out.secondBtn=document.querySelectorAll('#lbPanel [data-fx^="house:pledge:"]').length;
  G.ui.dispatch('house:pledge:coyote');
  out.stillMine=(sv().house||{}).id;
  /* the watermark: pass points are house points */
  G.save.sync(s=>{s.pass.pts=(s.pass.pts||0)+150;});
  out.credited=HS.credit(); out.ptsAfter=(sv().house||{}).pts;
  /* The seasonal gauntlet pays its own bonus on top. The payload is shaped exactly the way
     finishCourse emits it — the real EVENTS3 row and a real course — so every other package's
     courseFinish listener sees what it expects and nothing throws on the way past. */
  const finish=evId=>G.run('courseFinish',{c:{t:42.5,traitMatch:[]},ev:G.tables.EVENTS3.find(e=>e.id===evId),
   stars:3,RB:{rib:3,gold:false,featured:false},pay:600,dressage:false});
  const before=(sv().house||{}).pts;
  finish('gt'); out.gauntlet=(sv().house||{}).pts-before;
  const mid=(sv().house||{}).pts;
  finish('h1'); out.notGauntlet=(sv().house||{}).pts-mid;
  /* the house post: yours pays once a day, somebody else's does not pay at all */
  const tok=()=>((sv().tokens||{}).n)||0, pp=()=>((sv().pass||{}).pts)||0;
  const p1=post('cottonwood'), p2=post('barleyfold');
  const tokA=tok(), ppA=pp();
  goto2(p1.x+1.2,p1.z+1.2); out.nearPost=!!(G.world.nearThing()&&G.world.nearThing().kind==='housepost');
  key('KeyE'); out.postTok=tok()-tokA; out.postPass=pp()-ppA;
  const tokB=tok(); key('KeyE'); out.postTwice=tok()-tokB;
  goto2(p2.x+1.2,p2.z+1.2); const tokC=tok(); key('KeyE'); out.wrongPost=tok()-tokC;
  out.postLabel=G.world.nearThing()?G.world.nearThing().label():'';
  /* Wick's book: ride the first entry, then turn it in through his own dialogue */
  const e0=entry(0); out.book=HS.book().title; out.entries=HS.book().entries.length;
  out.e0={evt:e0.evt,goal:e0.goal};
  for(let i=0;i<Math.ceil(e0.goal/25)+2;i++)G.quest.dailyEvt(e0.evt,25);
  out.progFull=HS.bookState().prog>=e0.goal;
  const w=HS.wick(); goto2(w.g.position.x+1.4,w.g.position.z+1.4);
  key('KeyE'); out.dlgOpen=$('dlg').style.display==='block';
  out.dlgText=$('dlg').innerText||$('dlg').textContent;
  out.turnBtn=!!document.querySelector('#dlg [data-fx="house:entry"]');
  const c0=sv().coins, k0=tok();
  out.turned=click('#dlg [data-fx="house:entry"]');
  out.idxAfter=(sv().seasonQ||{}).idx; out.coinGain=sv().coins-c0; out.tokGain=tok()-k0;
  /* the quest tab */
  out.qTab=qTab('season'); out.qText=txt('questPanel');
  /* encores and the banner, both read from the packages that own them */
  out.enc=HS.encores().map(e=>e.label);
  out.encFlag=Object.keys(sv().flags||{}).filter(f=>f.indexOf('sq-encore-')===0);
  out.limitedRows=G.tables.SUMMON_TIERS.filter(t=>t.id==='limited').length;
  const bs=HS.bannerState(); out.banner=bs?{label:bs.row.label,pity:bs.row.pity,nodup:bs.row.nodup,featured:bs.row.featured}:null;
  /* every book, not just this season's: an entry counted off a moment the game never
     reports would be a quest a player could not finish, and it would not show up until
     that season came round three months later. */
  out.books=Object.keys(HS.BOOKS).map(k=>({k,n:HS.BOOKS[k].entries.length,
   evts:HS.BOOKS[k].entries.map(e=>e.evt),pays:HS.BOOKS[k].entries.every(e=>e.reward&&e.reward.tok>0&&e.reward.p>0)}));
  /* the state dump */
  out.state=st().house;
  return out;
 `);
 check('bloom · package installed with no install errors',r1.installed&&r1.errors.length===0,{installed:r1.installed,errors:r1.errors});
 check('bloom · Date.now stub lands on the bloom season',r1.season==='bloom'&&r1.skey==='S12'&&r1.day===5,{season:r1.season,key:r1.skey,day:r1.day});
 check('house posts · four standing in the world on solid ground',r1.posts===4&&r1.postGround,{things:r1.posts,ground:r1.postGround});
 check('house posts · four 🛡️ markers on the big map',r1.markers===4,r1.markers);
 check('almanac · Wick spawned once, clear of every collider',r1.wick===1&&r1.wickClear,{n:r1.wick,clear:r1.wickClear});
 check('house posts · every board clears the villagers\' 3.5 m talk radius, waypoints included',
   r1.postNpcGap.length===4&&r1.postNpcGap.every(p=>p.d>4.5),r1.postNpcGap);
 check('almanac · Wick carries his own map pin, so the npc family still balances',
   r1.wickPin===1&&r1.npcFamily.defs===r1.npcFamily.pins,{pin:r1.wickPin,family:r1.npcFamily});
 check('pledge · the 🛡️ Houses tab offers all four houses',r1.tabOpened&&r1.pledgeBtns===4,{tab:r1.tabOpened,btns:r1.pledgeBtns});
 check('pledge · the standing names all four houses',['House Cottonwood','House Barleyfold','House Coyote','House Hollowpeak'].every(n=>r1.lbText.indexOf(n)>=0));
 check('pledge · clicking Cottonwood writes s.house.id',r1.clicked&&r1.pledged==='cottonwood',{clicked:r1.clicked,id:r1.pledged});
 check('pledge · everything already earned this season comes with you',r1.pledgedPts===r1.passAtPledge,{pts:r1.pledgedPts,pass:r1.passAtPledge});
 check('pledge · the panel stops offering houses once you are sworn in',r1.secondBtn===0,r1.secondBtn);
 check('pledge · a second pledge to another house is refused',r1.stillMine==='cottonwood',r1.stillMine);
 check('points · 150 pass points become 150 house points',r1.credited===150&&r1.ptsAfter===r1.passAtPledge+150,{credited:r1.credited,pts:r1.ptsAfter});
 check('points · the seasonal gauntlet pays 25 a ribbon star',r1.gauntlet===75,r1.gauntlet);
 check('points · an ordinary event pays no gauntlet bonus',r1.notGauntlet===0,r1.notGauntlet);
 check('house post · standing beside it makes it the nearest thing',r1.nearPost,r1.nearPost);
 check('house post · your own pays 10🎟️ and 20 pass points',r1.postTok===10&&r1.postPass===20,{tok:r1.postTok,pass:r1.postPass});
 check('house post · a second visit the same day pays nothing',r1.postTwice===0,r1.postTwice);
 check('house post · another house\'s post pays you nothing',r1.wrongPost===0,r1.wrongPost);
 check('almanac · the bloom book is The Foaling Book, four entries',r1.book==='The Foaling Book'&&r1.entries===4,{book:r1.book,n:r1.entries});
 check('almanac · entry one counts the gallop the game already reports',r1.e0.evt==='gallop'&&r1.e0.goal===900&&r1.progFull,{e0:r1.e0,full:r1.progFull});
 check('almanac · Wick\'s dialogue opens with a turn-in button',r1.dlgOpen&&r1.turnBtn&&r1.dlgText.indexOf('The Foaling Book')>=0,{open:r1.dlgOpen,btn:r1.turnBtn});
 check('almanac · turning in advances the book and pays 220🪙 + 6🎟️',r1.turned&&r1.idxAfter===1&&r1.coinGain>=220&&r1.tokGain===6,{idx:r1.idxAfter,coins:r1.coinGain,tok:r1.tokGain});
 check('quest tab · 🗓️ Season lists the book and all four entries',r1.qTab&&r1.qText.indexOf('The Foaling Book')>=0
   &&['Walk the orchard line','Strip four winter coats','Six treats, given honestly','Two events ridden in the bloom'].every(l=>r1.qText.indexOf(l)>=0),
   {tab:r1.qTab,head:r1.qText.slice(0,60)});
 check('encores · the last three seasons\' banner horses are named as returning',r1.enc.length===3&&r1.qText.indexOf(r1.enc[0])>=0,{enc:r1.enc});
 check('encores · the return is announced once and flagged',r1.encFlag.length===1,r1.encFlag);
 check('banner · exactly one limited row — market\'s, not a second copy',r1.limitedRows===1,r1.limitedRows);
 check('banner · the season card reports market\'s own pity and no-repeat',!!r1.banner&&r1.banner.label==='The Blossom Banner'&&r1.banner.pity===10&&r1.banner.nodup===30,r1.banner);
 check('state · render_game_to_text carries the house and the book',!!r1.state&&r1.state.id==='cottonwood'&&r1.state.rank>=1&&r1.state.rank<=4&&r1.state.quest.book==='The Foaling Book',r1.state);
 {const REPORTED=new Set(['gallop','groom','feed','event','fish','trail','photo','cleanjump','pet']);
  const ok=r1.books.length===4&&['bloom','sun','ember','frost'].every(k=>r1.books.some(b=>b.k===k))
   &&r1.books.every(b=>b.n===4&&b.pays&&b.evts.every(e=>REPORTED.has(e)));
  check('almanac · all four books are four entries the game actually reports, each paying 🎟️ and pass points',ok,r1.books);}
 check('bloom · no console errors over the whole pass',A.errors.length===0,A.errors.slice(0,4));
 await A.page.close();
 await ctxA.close();

 /* ================= 2. ember, day 10: the lantern book and the hunts seam ================= */
 const ctxB=await browser.newContext({viewport:{width:1280,height:800}});
 const B=await open(ctxB,at(14,10),true,'ember');
 const r2=await run(B.page,`
  const out={};
  out.season=HS.season().def.id; out.skey=HS.season().key;
  out.book=HS.book().title; out.unlock=HS.book().unlock;
  out.labels=HS.book().entries.map(e=>e.label);
  const lim=G.tables.SUMMON_TIERS.find(t=>t.id==='limited');
  out.banner=lim?lim.label:null;
  /* Spy on the seam this package has with season-hunts, whether or not that package shipped. */
  window.__lantern=null;
  G.hunts=G.hunts||{};
  const prev=G.hunts.setOpen;
  G.hunts.setOpen=(k,v)=>{window.__lantern=[k,v];if(typeof prev==='function')try{prev(k,v);}catch(e){}};
  out.hadHunts=typeof prev==='function';
  G.ui.dispatch('house:pledge:hollowpeak');
  const c0=sv().coins, k0=((sv().tokens||{}).n)||0;
  for(let i=0;i<4;i++)fill();
  out.idx=(sv().seasonQ||{}).idx; out.unlocked=(sv().seasonQ||{}).unlocked;
  out.coinGain=sv().coins-c0; out.tokGain=(((sv().tokens||{}).n)||0)-k0;
  out.lantern=window.__lantern;
  out.life=((sv().life||{}).sqbook)||0;
  out.ach=(()=>{const a=G.quest.ACHS.find(x=>x.id==='sqbook1');return a?a.v(sv()):-1;})();
  out.housePts=(sv().house||{}).pts;
  /* stash something for the third boot: a pledge and a part-written book from this season */
  G.save.sync(s=>{s.house.pts=1234;s.seasonQ.idx=2;s.seasonQ.prog=3;});
  out.stash={house:(sv().house||{}).id,key:(sv().house||{}).key,pts:(sv().house||{}).pts,idx:(sv().seasonQ||{}).idx};
  return out;
 `);
 check('ember · the stub lands on the ember season',r2.season==='ember'&&r2.skey==='S14',{season:r2.season,key:r2.skey});
 check('ember · the ember book is The Lantern Book and it opens the lanterns',r2.book==='The Lantern Book'&&r2.unlock==='lantern',{book:r2.book,unlock:r2.unlock});
 check('ember · market\'s limited banner rotated to The Ember Banner',r2.banner==='The Ember Banner',r2.banner);
 check('almanac · all four ember entries close the book',r2.idx===4&&r2.unlocked===true,{idx:r2.idx,unlocked:r2.unlocked});
 check('almanac · closing the book pays out across all four entries',r2.coinGain>=1410&&r2.tokGain>=35,{coins:r2.coinGain,tok:r2.tokGain});
 check('seam · closing the lantern book calls G.hunts.setOpen("lantern",true)',!!r2.lantern&&r2.lantern[0]==='lantern'&&r2.lantern[1]===true,{seen:r2.lantern,siblingShipped:r2.hadHunts});
 check('almanac · the lifetime book tally and its achievement move',r2.life>=1&&r2.ach>=1,{life:r2.life,ach:r2.ach});
 check('points · the book\'s pass points reached the pledged house',r2.housePts>=180,r2.housePts);
 check('ember · no console errors over the whole pass',B.errors.length===0,B.errors.slice(0,4));
 await B.page.close();

 /* ================= 3. frost: a season away, same browser storage ================= */
 const C=await open(ctxB,at(15,3),false,'frost');
 const r3=await run(C.page,`
  const out={};
  out.season=HS.season().def.id; out.skey=HS.season().key;
  out.house=(sv().house||{}); out.q=(sv().seasonQ||{});
  out.book=HS.book().title;
  out.life=((sv().life||{}).sqbook)||0;
  out.pledgeBtns=(lbTab('house'),document.querySelectorAll('#lbPanel [data-fx^="house:pledge:"]').length);
  out.daily=G.quest.DAILYQ.filter(q=>q.type==='housepost').length;
  out.boards=G.tables.BOARDS.filter(b=>b.k==='housepts').length;
  return out;
 `);
 check('frost · the stub lands on the frost season',r3.season==='frost'&&r3.skey==='S15',{season:r3.season,key:r3.skey});
 check('frost · a season away clears the pledge and its points',r3.house.id===null&&r3.house.key==='S15'&&r3.house.pts===0,r3.house);
 check('frost · the book starts over at entry one',r3.q.key==='S15'&&r3.q.idx===0&&r3.q.unlocked===false,r3.q);
 check('frost · the frost book is The Long Night Book',r3.book==='The Long Night Book',r3.book);
 check('frost · the lifetime book tally survives the season reset',r3.life>=1,r3.life);
 check('frost · the four houses are taking riders again',r3.pledgeBtns===4,r3.pledgeBtns);
 check('ledger · one housepost daily and one house-points board, registered once',r3.daily===1&&r3.boards===1,{daily:r3.daily,boards:r3.boards});
 check('frost · no console errors over the whole pass',C.errors.length===0,C.errors.slice(0,4));
 await C.page.close();
 await ctxB.close();

 const failed=checks.filter(c=>!c.ok).length;
 console.log('\n'+(checks.length-failed)+'/'+checks.length+' checks passed'+(failed?' — '+failed+' FAILED':''));
 await browser.close();
 process.exit(failed?1:0);
})().catch(async e=>{console.error(e);try{if(browser)await browser.close();}catch(x){}process.exit(1);});

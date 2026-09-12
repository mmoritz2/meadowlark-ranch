/* Ranch package check (assets/features/ranch.js).
   Boots ranch3d.html?qa=ranch, then drives the ranch features headlessly through window.__features:
   the categorised catalogue and price-derived builder points, the star rating and its multipliers,
   land plots and buildings (caps, scene objects), move mode and wall snapping, gem decor feeding
   club points, decor sets, the public-party gate and private invites, stall bonuses, tack for any
   horse, hitching, stall cards, a second ranch bought and made home, and persistence across a reload.

   Usage:  QA_URL=http://127.0.0.1:8431 NODE_PATH=$(npm root -g) node tools/qa-ranch.cjs */
const {chromium}=require('playwright');
const base=(process.env.QA_URL||'http://127.0.0.1:8431').replace(/\/$/,'');
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
 stage('launch'); await page.goto(base+'/ranch3d.html?qa=ranch&fresh='+Date.now(),{waitUntil:'load',timeout:120000}); stage('loaded');
 await page.waitForFunction(READY,null,{timeout:150000,polling:250}); stage('horseReady');
 const r=await page.evaluate(()=>{
  const G=window.__features, A=G.ranch, R=G.ranchSys, DC=G.tables.DECOR_CAT, out={};
  const fresh=()=>G.save.fresh(), st=()=>JSON.parse(render_game_to_text());
  /* roaming riders and wild horses carry colliders, so a spot can be busy for a moment: try a few nearby */
  const tryPlace=(t,x,z,rot)=>{for(const [dx,dz] of [[0,0],[0,4],[4,0],[0,-4],[-4,0],[4,4]]){R.startPlace(t);R.build.rot=rot||0;if(!R.build.type)return {ok:false,why:'no ghost'};const why=R.decorOk(t,x+dx,z+dz);if(why&&/in the way/.test(why))continue;const ok=R.placeAt(x+dx,z+dz);return {ok,x:x+dx,z:z+dz,why};}return {ok:false,why:'busy'};};
  out.installed=G.installed.includes('ranch'); out.errors=G.errors.slice();
  /* catalogue + points */
  const keys=Object.keys(DC);
  out.cat={n:keys.length,noCat:keys.filter(k=>!DC[k].cat),seasons:keys.filter(k=>DC[k].season).length,gems:keys.filter(k=>DC[k].gems).length,indoor:keys.filter(k=>DC[k].cat==='indoor').length,build:keys.filter(k=>DC[k].cat==='build').length};
  out.pts={p120:R.decorPts({price:120}),g5:R.decorPts({gems:5}),hay:R.decorPts(DC.haybale)};
  out.state0=st().ranch;
  out.stars0={stars:A.ranchStars(fresh()),stall:R.ranchMul('stall'),board:R.ranchMul('board')};
  /* build panel meter + party gate on a fresh save */
  document.getElementById('buildBtn').click();
  const bp=document.getElementById('buildPanel');
  out.panel0={shown:bp.style.display,cbar:!!bp.querySelector('.cbar'),needs:/needs \d+ more builder points/.test(bp.textContent),tabs:[...bp.querySelectorAll('[data-buildtab]')].map(b=>b.dataset.buildtab)};
  G.hidePanels();
  document.getElementById('netBtn').click();
  const pb=document.querySelector('[data-tr="party"]'); out.partyBtn0={exists:!!pb,disabled:!!(pb&&pb.disabled)};
  G.hidePanels();
  out.party0=(R.startParty(),R.party()===null);
  /* money to build with */
  G.save.sync(s=>{s.coins=30000;s.gems=30;}); G.money.refreshWallet();
  /* place, move */
  const c0=fresh().coins; const pb1=tryPlace('bench',-36,38); out.placeBench=pb1.ok; const s1=fresh(); out.benchCost=c0-s1.coins; const bench=s1.decor.find(d=>d.t==='bench'); out.benchIn=!!bench;
  const bo=R.decorObjs.find(o=>o.d.id===bench.id); R.startMove(bo); R.build.rot=Math.PI/8; out.moved=R.placeAt(-38,40); const s2=fresh(); const b2=s2.decor.find(d=>d.id===bench.id);
  out.move={x:b2.x,z:b2.z,ry:b2.ry,coins:s2.coins-s1.coins,gx:bo.g.position.x,visible:bo.g.visible};
  /* walls snap end to end */
  const w1=tryPlace('wall',-50,42,0); out.wall1=w1.ok; R.startPlace('wall'); R.build.rot=0; out.wall2=R.placeAt(w1.x-3.2,w1.z+0.3); R.endBuild();
  const walls=fresh().decor.filter(d=>d.t==='wall'); out.walls={w1,rows:walls.map(w=>[w.x,w.z,w.ry])};
  /* gem decor feeds club points */
  const s3=fresh(); const sp0=(s3.sp&&s3.sp.pts)||0, g0=s3.gems;
  out.placeDragon=tryPlace('dragon_statue',-12,36).ok; const s4=fresh();
  out.gem={gems:g0-s4.gems,sp:((s4.sp&&s4.sp.pts)||0)-sp0,decorGems:s4.stats.decorGems,expectSp:Math.ceil(R.decorPts(DC.dragon_statue)/2)+Math.max(1,Math.floor(DC.dragon_statue.gems/10))};
  const spA=(s4.sp&&s4.sp.pts)||0; const lp=tryPlace('lantern',-42,30); const why=lp.why, okB=lp.ok; const s5=fresh(); out.coinPiece={ok:okB,why,sp:((s5.sp&&s5.sp.pts)||0)-spA,expect:Math.ceil(R.decorPts(DC.lantern)/2),decorGems:s5.stats.decorGems};
  /* a whole set */
  out.setPl=[tryPlace('dragon_banner',-14,48).ok,tryPlace('ember_brazier',-10,54).ok,tryPlace('scale_arch',-6,48).ok];
  out.sets={done:A.decorSetsDone(fresh()),list:A.setsDone(fresh()),xpMul:A.mul('xp',1)};
  /* no gems: a gem piece is refused */
  G.save.sync(s=>{s.gems=0;}); const n0=fresh().decor.length; R.startPlace('snowman'); out.noGems={ret:R.placeAt(-40,56),len:fresh().decor.length-n0}; G.save.sync(s=>{s.gems=20;}); G.money.refreshWallet();
  /* land + buildings */
  const c1=fresh().coins; out.buyL2=A.buyLand('l2'); out.buildL2=A.placeBuilding('l2','paddock'); const s6=fresh();
  out.land={cost:c1-s6.coins,t:s6.land.b.l2&&s6.land.b.l2.t,pasture:A.pastureBase(s6),obj:!!G.scene.getObjectByName('Building l2'),pos:(G.scene.getObjectByName('Building l2')||{position:{}}).position.x};
  out.unowned={ret:A.placeBuilding('l3','stable'),b:!!fresh().land.b.l3};
  A.buyLand('l3'); A.placeBuilding('l3','stable'); out.barnCap={cap:A.barnCap(fresh()),state:st().ranch.barnCap};
  A.buyLand('l7'); out.house=A.placeBuilding('l7','house'); R.startPlace('bed'); out.bedIn=R.placeAt(-82,44); R.startPlace('bed'); out.bedOut=R.placeAt(-36,45); R.endBuild();
  out.stars1={stars:A.ranchStars(fresh()),stall:R.ranchMul('stall'),state:st().ranch.stars,pts:R.ranchPts(fresh()),statePts:st().ranch.pts};
  /* party: eligible now */
  document.getElementById('buildBtn').click(); out.panel1={ready:/ready ✅/.test(bp.textContent),stars:/⭐/.test(bp.textContent)}; G.hidePanels();
  out.party1=(R.startParty(),R.party()&&{t:R.party().t,x:R.party().x,z:R.party().z});
  R.party().t=0; window.advanceTime(100); out.partyEnded=R.party()===null;
  G.net.onMessage('srf1/c/chat',JSON.stringify({id:'r1',n:'Ada',t:'party!',party:{priv:1,to:['Nobody'],x:40,z:40,len:180}})); out.privNo=R.party()===null;
  G.net.onMessage('srf1/c/chat',JSON.stringify({id:'r2',n:'Ada',t:'party!',party:{priv:1,to:[G.net.myName()],x:40,z:40,len:180,game:'💃 Dance circle'}})); out.privYes=R.party()&&{x:R.party().x,t:R.party().t,game:R.party().game};
  R.party().t=0; window.advanceTime(100);
  /* more horses for the barn */
  G.save.sync(s=>{G.horse.grantHorse(s,'bay',{name:'Bramble',src:'qa'});G.horse.grantHorse(s,'bay',{name:'Sorrel',src:'qa'});s.horses[1].out=false;s.horses[2].out=true;}); G.horse.reloadHorses();
  /* tack any horse */
  let gid=null; G.save.sync(s=>{const g=G.horse.genGear('Common','saddle');s.tack.push(g);s.horses[1].gear={saddle:g.id};gid=g.id;});
  const g0gear=JSON.stringify(fresh().horses[0].gear||{});
  A.tackFor=1; R.tackAct('off:saddle'); const s7=fresh(); out.untack={s1:s7.horses[1].gear.saddle,s0same:JSON.stringify(s7.horses[0].gear||{})===g0gear,idx:R.tackIdx(s7)};
  R.tackAct('on:'+gid); out.retack=fresh().horses[1].gear.saddle===gid;
  G.ui.openShop('tack'); out.tackSel=!!document.querySelector('[data-fxin="ranch:tackfor"]'); G.hidePanels();
  G.ui.openStable(); const sp=document.getElementById('stablePanel'); out.stable={tackBtn:!!sp.querySelector('[data-fx="ranch:tack:1"]'),hitchBtn:!!sp.querySelector('[data-fx="ranch:hitch:1"]'),header:/in the barn/.test(sp.textContent)}; G.hidePanels();
  out.stallThings=G.world.things.filter(t=>t.kind==='stall').length;
  /* hitch */
  out.postPl=tryPlace('post',-50,56).ok; const post=fresh().decor.find(d=>d.t==='post'); out.hitch=A.hitch(1,post.id); const s8=fresh(); out.hitched={h:s8.horses[1].hitch===post.id,out:s8.horses[1].out,standing:A.standing().length,posts:A.freePosts(s8).length};
  out.unhitch=A.hitch(1,null); out.unhitched=fresh().horses[1].hitch===null;
  /* stall bonus, deterministic through the seam */
  let sb=null; G.save.sync(s=>{s.horses[1].xp=0;s.horses[1].level=1;s.horses[1].stallAcc=0;s.horses[2].xp=0;s.horses[2].out=true;s.stats.stallXp=0;const got=A.stallTick(s,3600);sb={got,xp1:s.horses[1].xp,xp2:s.horses[2].xp,stallXp:s.stats.stallXp,mul:R.ranchMul('stall'),happy:s.horses[1].needs.happy};});
  out.stall=sb;
  /* a second ranch */
  const c2=fresh().coins; out.buyLoon=A.buyRanch('loon'); const s9=fresh(); out.loon={cost:c2-s9.coins,owned:s9.ranches.owned.slice(),ft:G.tables.FT.some(f=>f[3]==='ranch:loon')};
  out.home=A.setHome('loon'); const s10=fresh(); out.homeNow={home:s10.ranches.home,barn:R.BARN_ROW.n,barnX:R.BARN_ROW.x,pasture:A.pastureBase(s10),cap:A.barnCap(s10),state:st().ranch.home,px:G.horse.player.pos.x};
  /* seed the boot-time stall pass for the reload */
  G.save.sync(s=>{s.horses[1].xp=0;s.horses[1].level=1;s.horses[1].stallAcc=0;s.horses[1].out=false;s.stallLast=Date.now()-3600e3;});
  out.decorN=fresh().decor.length; out.built=Object.keys(fresh().land.b);
  return out;
 });
 check('ranch installed without error',r.installed&&r.errors.length===0,r.errors);
 check('catalogue: every piece has a category, ≥4 seasonal, gem pieces, indoor, walls/floors',r.cat.noCat.length===0&&r.cat.seasons>=4&&r.cat.gems>=4&&r.cat.indoor>=4&&r.cat.build>=3&&r.cat.n>=40,r.cat);
 check('builder points follow the price (120🪙→12, 5💎→15, hand pts kept)',r.pts.p120===12&&r.pts.g5===15&&r.pts.hay===4,r.pts);
 check('render_game_to_text carries ranch{home,owned,pts,level,stars}',r.state0&&r.state0.home==='meadowlark'&&r.state0.owned.includes('meadowlark')&&r.state0.pts===0&&r.state0.level===1&&r.state0.stars===1,r.state0);
 check('fresh ranch: 1 star, stall/board multipliers 1',r.stars0.stars===1&&r.stars0.stall===1&&r.stars0.board===1,r.stars0);
 check('build panel: .cbar meter, party requirement text, Land + Ranches tabs',r.panel0.shown==='flex'&&r.panel0.cbar&&r.panel0.needs&&r.panel0.tabs.includes('land')&&r.panel0.tabs.includes('ranches'),r.panel0);
 check('club panel party button disabled below the gate',r.partyBtn0.exists&&r.partyBtn0.disabled,r.partyBtn0);
 check('public party refused at 0 builder points',r.party0);
 check('place a bench (85🪙)',r.placeBench&&r.benchCost===85&&r.benchIn,{cost:r.benchCost});
 check('move mode: same piece, new spot, fine rotation, no charge',r.moved&&Math.abs(r.move.x+38)<0.01&&Math.abs(r.move.z-40)<0.01&&Math.abs(r.move.ry-Math.PI/8)<0.01&&r.move.coins===0&&Math.abs(r.move.gx+38)<0.01&&r.move.visible,r.move);
 check('walls snap end to end (gap < 0.05 m)',r.wall1&&r.wall2&&r.walls.rows.length===2&&Math.abs(r.walls.rows[1][0]-(r.walls.w1.x-3))<0.05&&Math.abs(r.walls.rows[1][1]-r.walls.w1.z)<0.05,r.walls);
 check('gem decor: gems spent, SP = half points + 1 per 10💎, stats.decorGems',r.placeDragon&&r.gem.gems===6&&r.gem.sp===r.gem.expectSp&&r.gem.decorGems===6,r.gem);
 check('coin decor: SP = half points, decorGems unchanged',r.coinPiece.ok&&r.coinPiece.sp===r.coinPiece.expect&&r.coinPiece.decorGems===6,r.coinPiece);
 check('dragon set completes and lifts the xp multiplier',r.setPl.every(Boolean)&&r.sets.done===1&&r.sets.list.includes('dragon')&&r.sets.xpMul>=1.05,r.sets);
 check('a gem piece is refused with no gems',r.noGems.ret===false&&r.noGems.len===0,r.noGems);
 check('buy plot l2 + paddock: 2400🪙, pasture 8→10, Building l2 in the scene',r.buyL2&&r.buildL2&&r.land.cost===2400&&r.land.t==='paddock'&&r.land.pasture===10&&r.land.obj&&isFinite(r.land.pos),r.land);
 check('a building on an unowned plot is refused',r.unowned.ret===false&&!r.unowned.b,r.unowned);
 check('stable block raises the barn cap 6→8 (and in the state dump)',r.barnCap.cap===8&&r.barnCap.state===8,r.barnCap);
 check('indoor furniture only inside a ranch house',r.house&&r.bedIn&&r.bedOut===false,{house:r.house,bedIn:r.bedIn,bedOut:r.bedOut});
 check('star rating rises with kinds, a set and a building; stall multiplier > 1; state matches',r.stars1.stars>=3&&r.stars1.stall>1&&r.stars1.state===r.stars1.stars&&r.stars1.statePts===r.stars1.pts&&r.stars1.pts>=320,r.stars1);
 check('build panel shows party ready ✅ and stars',r.panel1.ready&&r.panel1.stars,r.panel1);
 check('public party starts at the home ranch once eligible (90 s)',r.party1&&r.party1.t===90&&r.party1.x===0&&r.party1.z===5,r.party1);
 check('party winds down',r.partyEnded);
 check('private invite for someone else is ignored',r.privNo);
 check('private invite for me starts at x=40 for 180 s with the game',r.privYes&&r.privYes.x===40&&r.privYes.t===180&&/Dance/.test(r.privYes.game||''),r.privYes);
 check('un-tack a stalled horse (not the ridden one)',r.untack.s1===undefined&&r.untack.s0same&&r.untack.idx===1,r.untack);
 check('tack goes back on the stalled horse',r.retack);
 check('tack tab has the horse picker',r.tackSel);
 check('stable rows: Tack + hitch buttons, barn header',r.stable.tackBtn&&r.stable.hitchBtn&&r.stable.header,r.stable);
 check('stall cards registered as things',r.stallThings>=1,r.stallThings);
 check('hitch to a post: horse stands there, post taken',r.hitch&&r.hitched.h&&r.hitched.out===false&&r.hitched.standing===1&&r.hitched.posts===0,r.hitched);
 check('unhitch',r.unhitch&&r.unhitched);
 check('stall bonus: an hour in the barn pays XP/cheer to the stalled horse only',r.stall&&r.stall.xp1>=4&&r.stall.xp2===0&&r.stall.stallXp>0&&r.stall.got===r.stall.stallXp&&r.stall.happy>90,r.stall);
 check('buy Loon Lake Shore (6000🪙) → owned + fast travel',r.buyLoon&&r.loon.cost===6000&&r.loon.owned.includes('loon')&&r.loon.ft,r.loon);
 check('make it home: 8 stalls, pasture 10, barn row moved, state.ranch.home',r.home&&r.homeNow.home==='loon'&&r.homeNow.barn===8&&r.homeNow.barnX===82&&r.homeNow.pasture===10&&r.homeNow.cap===8&&r.homeNow.state==='loon',r.homeNow);
 /* reload: persistence + the boot-time stall pass */
 await page.waitForLoadState('networkidle',{timeout:60000}).catch(()=>{}); await page.waitForTimeout(1500);
 stage('reload'); await page.goto(base+'/ranch3d.html?qa=ranch&again='+Date.now(),{waitUntil:'load',timeout:120000});
 await page.waitForFunction(READY,null,{timeout:150000,polling:250}); stage('horseReady again');
 await page.waitForTimeout(5500);   // the package's post-boot rebuild (4.5 s) so land stalls and posts are up
 const L=await page.evaluate(()=>{const G=window.__features,A=G.ranch,R=G.ranchSys;const s=G.save.fresh();const st=JSON.parse(render_game_to_text());
  return {home:s.ranches.home,owned:s.ranches.owned,barn:R.BARN_ROW.n,barnX:R.BARN_ROW.x,decor:s.decor.length,built:Object.keys(s.land.b),obj:!!G.scene.getObjectByName('Building l2'),objL3:!!G.scene.getObjectByName('Building l3'),xp1:s.horses[1].xp,lvl1:s.horses[1].level,stallXp:s.stats.stallXp,fresh:Date.now()-s.stallLast,state:st.ranch,installed:G.installed.includes('ranch'),errors:G.errors,things:G.world.things.filter(t=>t.kind==='stall').length,ft:G.tables.FT.some(f=>f[3]==='ranch:loon'),region:!!G.tables.REGIONS.find(rg=>/Loon Lake Shore/.test(rg.name))};});
 check('reload: home ranch, ownership, buildings and decor persist',L.installed&&L.errors.length===0&&L.home==='loon'&&L.owned.includes('loon')&&L.barn===8&&L.barnX===82&&L.decor===r.decorN&&L.built.length===r.built.length&&L.obj&&L.objL3&&L.state.home==='loon'&&L.ft&&L.region,L);
 check('reload: an hour away paid stall XP at boot',(L.xp1>=4||L.lvl1>1)&&L.stallXp>0&&L.fresh<60000,{xp1:L.xp1,lvl1:L.lvl1,stallXp:L.stallXp,fresh:L.fresh});
 check('stall cards after the post-boot rebuild',L.things>=1,L.things);
 check('no console/page errors',errors.length===0,errors.slice(0,6));
 await browser.close();
 const failed=checks.filter(c=>!c.ok);
 console.log(failed.length?('FAILED '+failed.length+'/'+checks.length):('ALL '+checks.length+' CHECKS PASSED'));
 process.exit(failed.length?1:0);
})().catch(e=>{console.error('FATAL',e);process.exit(2);});

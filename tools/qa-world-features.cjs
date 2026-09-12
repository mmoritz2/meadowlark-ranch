/* Feature package 'world' — headless check.
   Boots ranch3d.html?qa=world, waits for the horse, then drives every feature of the package
   through window.__features (G) and G.worldPkg: region metadata and gating (fast travel
   blocked, soft boundary, ranch-level unlock), town arenas (a Barleyfold course lays its fences
   in Barleyfold), towns (buildings, shop doors, strolling townsfolk), bottles / sheriff badges /
   the toy unicorn and the Collection tab, map markers, the balloon and the ferry (freeze guard,
   altitude, landing), wild herds (trust, spook, carrot, following, region-exclusive coats),
   co-op taming over a stubbed club message, the trust HUD, sanctuaries and the companion.
   Prints the state dump at the end and exits 1 on any failed check or console error.

   Usage:  QA_URL=http://127.0.0.1:8431 NODE_PATH=$(npm root -g) node tools/qa-world-features.cjs
   (tools/qa-world.cjs is the older terrain validation; this one is the feature package.) */
const {chromium}=require('playwright');
const base=(process.env.QA_URL||'http://127.0.0.1:8431').replace(/\/$/,'');
const url=base+'/ranch3d.html?qa=world&fresh='+Date.now();
const checks=[];
function check(name,ok,detail){checks.push({name,ok:!!ok,detail});console.log((ok?'PASS ':'FAIL ')+name+(detail!==undefined?' — '+JSON.stringify(detail):''));}
const t0=Date.now();
const stage=s=>console.log('… '+s+' @'+((Date.now()-t0)/1000).toFixed(1)+'s');
let browser=null;
setTimeout(async()=>{console.error('WATCHDOG: no result after 900 s');try{if(browser)await browser.close();}catch(e){}process.exit(3);},900000).unref();
const ready=()=>window.render_game_to_text&&(()=>{try{const s=JSON.parse(render_game_to_text());return s.graphics&&s.graphics.horseReady&&!s.graphics.horseLoading;}catch(e){return false;}})();
(async()=>{
 browser=await chromium.launch({headless:true,args:['--disable-background-timer-throttling','--use-angle=metal','--enable-gpu-rasterization','--ignore-gpu-blocklist']});
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 const errors=[];
 page.on('pageerror',e=>errors.push('PAGEERROR '+e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 page.on('dialog',d=>{d.accept().catch(()=>{});});
 stage('launch'); await page.goto(url,{waitUntil:'load',timeout:120000}); stage('loaded');
 await page.waitForFunction(ready,null,{timeout:150000,polling:250});
 stage('horseReady');
 const ev=(fn,...args)=>page.evaluate(fn,...args);

 /* ---- install + regions + gating ---- */
 const r1=await ev(()=>{
  const G=window.__features,P=G.worldPkg,out={};
  out.installed=G.installed.includes('world'); out.errors=G.errors.slice(); out.hasPkg=!!P;
  const R=G.tables.REGIONS;
  out.meta=R.filter(r=>r.r<999).every(r=>r.id&&r.biome); out.ids=R.map(r=>r.id);
  out.barleyAt=(G.world.regionAt(215,-105)||{}).id;
  const s=G.save.fresh();
  out.saveFields=['unlocked','bottles','toyUnicorn','sanctuary','wildSeen','companion'].filter(k=>s[k]===undefined);
  out.lockedFresh=R.filter(r=>r.unlock&&!P.regionUnlocked(r,s)).map(r=>r.id);
  /* fast travel to a locked region is refused with a padlock toast */
  const pl=G.horse.player; pl.pos.set(-7,0,10); pl.speed=0;
  const btn=document.querySelector('#ftBar [data-ft="3"]');
  out.ftLockedClass=btn&&btn.classList.contains('ftLocked'); out.ftText=btn&&btn.textContent;
  btn.click();
  out.afterLockedClick={x:Math.round(pl.pos.x),lastLock:P.lastLock,toast:document.getElementById('toasts').textContent};
  /* riding in: the soft boundary turns you round at the edge */
  pl.pos.set(215,0,-105); window.advanceTime(700);
  out.pushedOut={x:Math.round(pl.pos.x),z:Math.round(pl.pos.z),region:JSON.parse(render_game_to_text()).player.region,dist:Math.round(Math.hypot(pl.pos.x-215,pl.pos.z+105))};
  /* ranch level 3 opens Barleyfold, Coyote and Hollowpeak */
  const cat=G.tables.DECOR_CAT; const best=Object.keys(cat).reduce((a,k)=>(cat[k].pts||0)>(cat[a]&&cat[a].pts||0)?k:a,Object.keys(cat)[0]);
  const need=Math.ceil(G.tables.RANCH_LEVELS[2]/(cat[best].pts||1))+1;
  G.save.sync(sv=>{sv.decor=sv.decor||[];for(let i=0;i<need;i++)sv.decor.push({t:best,x:400,z:400,r:0});});
  out.ranchLevel=P.ranchLevel(G.save.fresh());
  const news=P.ensureUnlocks(); out.unlockedNow=news.map(r=>r.id);
  out.lockedAfter=R.filter(r=>r.unlock&&!P.regionUnlocked(r)).map(r=>r.id);
  out.ftUnlockedClass=btn.classList.contains('ftLocked');
  btn.click(); out.afterOpenClick={x:Math.round(pl.pos.x),z:Math.round(pl.pos.z)};
  if(document.getElementById('bigmapWrap').style.display==='flex')window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyM'}));   // the button click bubbled to the map wrapper and opened it
  out.seasonOpenFn=typeof P.seasonOpen==='function'&&P.seasonOpen({id:'nope'})===false;
  out.lockText=P.lockText(R.find(r=>r.id==='coyote'));
  return out;
 });
 check('world installed without error',r1.installed&&r1.errors.length===0&&r1.hasPkg,{errors:r1.errors});
 check('REGIONS carry id/biome metadata; regionAt(215,-105) is barleyfold',r1.meta&&r1.barleyAt==='barleyfold',{ids:r1.ids,at:r1.barleyAt});
 check('ensure() save fields present',r1.saveFields.length===0,r1.saveFields);
 check('fresh save: Barleyfold, Coyote, Hollowpeak (+Falls) locked',['barleyfold','coyote','hollowpeak','falls'].every(k=>r1.lockedFresh.includes(k)),r1.lockedFresh);
 check('locked fast-travel button is greyed and refuses with a 🔒 toast',r1.ftLockedClass&&/🔒/.test(r1.ftText)&&r1.afterLockedClick.x===-7&&r1.afterLockedClick.lastLock==='barleyfold',r1.afterLockedClick);
 check('soft boundary pushes a rider out of a locked region',r1.pushedOut.region!=='barleyfold'&&r1.pushedOut.dist>=60,r1.pushedOut);
 check('ranch level 3 unlocks the three regions (toast + s.unlocked)',r1.ranchLevel>=3&&['barleyfold','coyote','hollowpeak'].every(k=>r1.unlockedNow.includes(k))&&r1.lockedAfter.length===0,{lvl:r1.ranchLevel,now:r1.unlockedNow,after:r1.lockedAfter});
 check('fast travel works once unlocked',!r1.ftUnlockedClass&&Math.abs(r1.afterOpenClick.x-220)<2,r1.afterOpenClick);
 check('season open week helper + lock text',r1.seasonOpenFn&&/Coyote Canyon opens/.test(r1.lockText),r1.lockText);

 /* ---- venues: a Barleyfold jumping event lays its fences in Barleyfold ---- */
 const r2=await ev(()=>{
  const G=window.__features,P=G.worldPkg,out={};
  const a1=G.tables.EVENTS3.find(e=>e.id==='a1'); out.at=a1.at;
  const v=G.tables.REGIONS.find(r=>r.id==='barleyfold').venue;
  G.horse.player.pos.set(0,0,5);
  G.course.startCourse(a1); const c=G.course.get();
  out.jump0=c&&c.jumps[0]&&{x:Math.round(c.jumps[0].x),z:Math.round(c.jumps[0].z)}; out.venue=v;
  out.playerNear=Math.round(Math.hypot(G.horse.player.pos.x-v.x,G.horse.player.pos.z-v.z));
  G.course.cancelCourse();
  out.arenas=P.ARENAS.map(a=>a.id);
  return out;
 });
 check('EVENTS3 a1 has at=Barleyfold venue and its fences are laid there (player carried over)',r2.at&&r2.jump0&&Math.hypot(r2.jump0.x-r2.venue.x,r2.jump0.z-r2.venue.z)<40&&r2.playerNear<50,r2);
 check('four town arenas built',r2.arenas.length===4,r2.arenas);

 /* ---- towns: buildings, doors, townsfolk ---- */
 const r3=await ev(()=>{
  const G=window.__features,P=G.worldPkg,out={};
  out.landmarks=P.LANDMARKS.length; out.byTown=P.TOWNS.map(t=>t.id+':'+t.buildings.length);
  out.walls=P.TOWNS.find(t=>t.id==='barleyfold').wallSegs;
  out.folk=P.townsfolk.length; out.npcDefs=G.quest.NPC_DEFS.filter(d=>d.folk).length;
  const pl=G.horse.player; pl.pos.set(47,0,-50); pl.speed=0;
  const before=P.townsfolk.map(f=>[f.x,f.z]);
  window.advanceTime(4000);
  out.moved=P.townsfolk.filter((f,i)=>Math.hypot(f.x-before[i][0],f.z-before[i][1])>0.5).length;
  /* the auction house door opens the market */
  const dr=G.world.things.find(t=>t.kind==='door'&&t.id==='cottonwood:auction');
  pl.pos.set(dr.x+dr.reach-1.2,0,dr.z); pl.speed=0; window.advanceTime(120);
  out.ctx=document.getElementById('ctx').textContent;
  window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyE'}));
  out.shop=document.getElementById('shopPanel').style.display; out.shopHasMarket=/[Mm]arket|Auction|auction|Sell|sell/.test(document.getElementById('shopPanel').textContent);
  G.hidePanels();
  out.oasis=!!P.oasis;
  return out;
 });
 check('towns: >=12 landmarks, every town has >=2 buildings, Barleyfold walls',r3.landmarks>=12&&r3.byTown.every(s=>+s.split(':')[1]>=2)&&r3.walls>20,r3);
 check('townsfolk stroll (Cottonwood\'s three moved in 4 s)',r3.folk>=8&&r3.moved>=3,{folk:r3.folk,moved:r3.moved});
 check('auction house door prompt + E opens the shop',/auction/i.test(r3.ctx)&&r3.shop==='flex',{ctx:r3.ctx,shop:r3.shop});
 check('Coyote oasis built',r3.oasis);

 /* ---- collectibles ---- */
 const r4=await ev(()=>{
  const G=window.__features,P=G.worldPkg,out={};
  const pl=G.horse.player; pl.speed=0;
  const b=P.BOTTLES[0]; pl.pos.set(b.x,0,b.z); window.advanceTime(300);
  const d=document.getElementById('dlg');
  out.bottle={dlg:d.style.display,hasNote:d.textContent.includes(b.note.slice(0,30)),saved:(G.save.fresh().bottles||[]).includes(b.id),hidden:!b.thing.visible};
  d.style.display='none';
  const s0=G.save.fresh(); const k0=s0.keys||0,g0=s0.gems;
  const pts=G.tables.COLL_SETS.badges.pts;
  for(const pt of pts){pl.pos.set(pt[0],0,pt[1]);window.advanceTime(200);}
  const s1=G.save.fresh();
  out.badges={n:(s1.sets.badges||[]).length,done:!!(s1.setsDone&&s1.setsDone.badges),dk:(s1.keys||0)-k0,dg:s1.gems-g0,pts:pts.length};
  const u=P.TOY_UNICORN; pl.pos.set(u.x,0,u.z); window.advanceTime(300);
  const s2=G.save.fresh(); out.toy={found:typeof s2.toyUnicorn==='number',dg:s2.gems-s1.gems,hidden:!P.toyMesh.visible};
  document.getElementById('dlg').style.display='none';
  G.ui.openQuests(); document.querySelector('[data-q="tab:coll"]').click();
  const txt=document.getElementById('questPanel').textContent;
  out.coll={shoes:/horseshoes/i.test(txt),bottle:/bottle/i.test(txt),badge:/badge/i.test(txt),unicorn:/unicorn/i.test(txt),sanct:/Sanctuar/i.test(txt),regions:/Regions/.test(txt),badgeCount:/8\/8/.test(txt)};
  G.hidePanels();
  out.achs=['badges8','bottles8','toyuni','regions4','balloon3','ferry3','wild5','sanct3'].filter(id=>!G.quest.ACHS.some(a=>a.id===id));
  out.dailies=['bottle','balloon','walkwild'].filter(t=>!G.quest.DAILYQ.some(q=>q.type===t));
  return out;
 });
 check('bottle: lore card opens, note shown, saved, mesh hidden',r4.bottle.dlg==='block'&&r4.bottle.hasNote&&r4.bottle.saved&&r4.bottle.hidden,r4.bottle);
 check('sheriff badges: 8 collected, set done, +2 keys',r4.badges.n===8&&r4.badges.done&&r4.badges.dk>=2&&r4.badges.dg>=5,r4.badges);
 check('toy unicorn found once (+10 gems, hidden)',r4.toy.found&&r4.toy.dg>=10&&r4.toy.hidden,r4.toy);
 check('Collection tab lists every family with region counts',Object.values(r4.coll).every(Boolean),r4.coll);
 check('achievements + dailies registered',r4.achs.length===0&&r4.dailies.length===0,{achs:r4.achs,dailies:r4.dailies});

 /* ---- map markers ---- */
 const r5=await ev(()=>{
  const G=window.__features,P=G.worldPkg,out={};
  out.kinds=P.markerKinds();
  window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyM'})); out.map=document.getElementById('bigmapWrap').style.display;
  window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyM'}));
  out.forageN=Object.keys(G.world.FORAGE_SPOTS).length; out.ftN=G.tables.FT.length;
  out.npcN=G.quest.NPC_DEFS.filter(d=>!d.folk).length; out.venueN=G.tables.EVENTS3.filter(e=>e.at||e.race||e.dressage).length;
  return out;
 });
 check('map markers: forage/venue/npc/ft/bottle/balloon/ferry/sanctuary/lock/region',r5.kinds.forage===r5.forageN&&r5.kinds.venue===r5.venueN&&r5.kinds.npc===r5.npcN&&r5.kinds.ft===r5.ftN&&r5.kinds.bottle===8&&r5.kinds.balloon===3&&r5.kinds.ferry===2&&r5.kinds.sanctuary===2&&r5.kinds.lock>=3&&r5.kinds.region>=4,r5.kinds);
 check('M toggles the big map',r5.map==='flex',r5.map);

 /* ---- balloon ---- */
 const r6=await ev(()=>{
  const G=window.__features,P=G.worldPkg,out={};
  const pl=G.horse.player; const st=P.BALLOON_STATIONS[0];
  pl.pos.set(st.x+3.5,0,st.z); pl.speed=0; window.advanceTime(120);
  out.ctx=document.getElementById('ctx').textContent;
  window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyE'}));
  const v=P.vehicle(); out.kind=v&&v.kind; if(v)v.dur=8;
  window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyW'}));
  window.advanceTime(4000);
  const st1=JSON.parse(render_game_to_text()); out.mid=st1.world.vehicle; out.speedMid=st1.player.speed;
  out.camAbove=st1.camera.y>G.world.groundH(st1.camera.x,st1.camera.z)+10;
  window.advanceTime(4600);
  window.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyW'}));
  const st2=JSON.parse(render_game_to_text()); out.after=st2.world.vehicle;
  out.landedNear=P.BALLOON_STATIONS.map(s=>Math.round(Math.hypot(pl.pos.x-s.x,pl.pos.z-s.z)));
  out.balloons=G.save.fresh().stats.balloons;
  return out;
 });
 check('balloon: prompt, E boards, mid-ride at altitude with input frozen, camera up',/balloon/i.test(r6.ctx)&&r6.kind==='balloon'&&r6.mid&&r6.mid.alt>15&&r6.speedMid===0&&r6.camAbove,r6);
 check('balloon lands at a station and counts',r6.after===null&&r6.landedNear.some(d=>d<12)&&r6.balloons===1,{near:r6.landedNear,n:r6.balloons});

 /* ---- ferry ---- */
 const r7=await ev(()=>{
  const G=window.__features,P=G.worldPkg,out={};
  const pl=G.horse.player; const d0=P.FERRY.docks[0];
  pl.pos.set(d0.x,0,d0.bz); pl.speed=0; window.advanceTime(120);
  out.ctx=document.getElementById('ctx').textContent;
  window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyE'}));
  const v=P.vehicle(); out.kind=v&&v.kind; if(v)v.dur=6;
  window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyW'}));
  window.advanceTime(3000);
  out.onRiver=Math.abs(pl.pos.z-G.world.riverZ(pl.pos.x))<4; out.speed=pl.speed; out.x=Math.round(pl.pos.x);
  window.advanceTime(3600);
  window.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyW'}));
  const d1=P.FERRY.docks[1]; out.arrived=Math.round(Math.hypot(pl.pos.x-d1.x,pl.pos.z-d1.bz)); out.veh=!!P.vehicle(); out.ferry=G.save.fresh().stats.ferry;
  return out;
 });
 check('ferry: E boards, rides the river with input ignored, lands at the far dock',/ferry/i.test(r7.ctx)&&r7.kind==='boat'&&r7.onRiver&&r7.speed===0&&r7.x>30&&!r7.veh&&r7.arrived<10&&r7.ferry===1,r7);

 /* ---- wild herds, trust HUD, carrot, following, co-op ---- */
 const r8=await ev(()=>{
  const G=window.__features,P=G.worldPkg,out={};
  out.herds=P.herds.map(h=>({id:h.def.id,n:h.members.length,within:h.members.every(m=>Math.hypot(m.pos.x-h.def.x,m.pos.z-h.def.z)<=h.def.r+6)}));
  out.exclusiveOk=P.herds.every(h=>h.members.every(m=>!m.wb.region||m.wb.region===h.def.region));
  out.anyExclusive=P.herds.some(h=>h.members.some(m=>m.wb.region));
  out.strays=G.wild&&G.wild.strays===false;
  const pl=G.horse.player;
  /* pines herd: stand by a horse, trust grows, HUD shows a bar */
  const pines=P.herds.find(h=>h.def.id==='pines'); const m=pines.members[0];
  pl.pos.set(m.pos.x+3,0,m.pos.z); pl.speed=0; pl.heading=0; window.advanceTime(3000);
  const hud=document.getElementById('tameHud');
  out.hud={display:hud.style.display,fill:parseFloat(document.getElementById('tameFill').style.width),txt:document.getElementById('tameTxt').textContent,trust:Math.round(m.trust),fled:m.flee>0};
  /* a carrot for +25 */
  G.save.sync(s=>{s.items.carrot=5;});
  pl.pos.set(m.pos.x+2.2,0,m.pos.z); window.advanceTime(60);
  const near=G.world.nearThing(); out.nearKind=near&&near.kind; out.ctx=document.getElementById('ctx').textContent;
  const t0=m.trust; window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyE'}));
  out.carrot={dTrust:Math.round(m.trust-t0),carrots:G.save.fresh().items.carrot};
  /* keep standing: she starts to follow at 50, and comes along when we move off */
  window.advanceTime(4000);
  out.follow=m.follow; out.trustNow=Math.round(m.trust);
  pl.pos.set(m.pos.x+9,0,m.pos.z+9); window.advanceTime(2500);
  out.followDist=Math.round(Math.hypot(m.pos.x-pl.pos.x,m.pos.z-pl.pos.z)); out.trustAfterWalk=Math.round(m.trust);
  out.walkDaily=(G.save.fresh().life||{}).walkwild||0;
  /* spook: gallop past another one */
  const m2=pines.members[1]; pl.pos.set(m2.pos.x+5,0,m2.pos.z); pl.speed=8; window.advanceTime(400);
  out.spook={bad:hud.classList.contains('bad'),txt:document.getElementById('tameTxt').textContent,flee:m2.flee>0};
  pl.speed=0;
  return out;
 });
 check('four herds spawn 3-4 members inside their range',r8.herds.length===4&&r8.herds.every(h=>h.n>=3&&h.within),r8.herds);
 check('region-exclusive coats stay in their region; the single stray is retired',r8.exclusiveOk&&r8.anyExclusive&&r8.strays,{ok:r8.exclusiveOk,any:r8.anyExclusive,strays:r8.strays});
 check('trust HUD: bar shown, >20% after 3 s halted',r8.hud.display==='block'&&r8.hud.fill>20&&/%/.test(r8.hud.txt)&&!r8.hud.fled,r8.hud);
 check('E offers a carrot: +25 trust, carrot spent',r8.nearKind==='wild'&&/carrot/i.test(r8.ctx)&&r8.carrot.dTrust>=24&&r8.carrot.carrots===4,{near:r8.nearKind,ctx:r8.ctx,c:r8.carrot});
 check('at 50% she follows and keeps up when you walk off, trust still rising',r8.follow&&r8.followDist<10&&r8.trustAfterWalk>=r8.trustNow&&r8.walkDaily>=5,{follow:r8.follow,dist:r8.followDist,t0:r8.trustNow,t1:r8.trustAfterWalk,walk:r8.walkDaily});
 check('galloping past spooks her: HUD goes red',r8.spook.bad&&/Spooked/.test(r8.spook.txt)&&r8.spook.flee,r8.spook);

 const r9=await ev(()=>{
  const G=window.__features,P=G.worldPkg,out={};
  const pl=G.horse.player; const coy=P.herds.find(h=>h.def.id==='coyote'); const m=coy.members[0];
  pl.pos.set(m.pos.x+3,0,m.pos.z); pl.speed=0; window.advanceTime(9000);
  out.solo={local:Math.round(m.trust),eff:Math.round(P.effTrust(m)),tamed:!!m.taming,follow:m.follow};
  /* a club mate stands with her: their trust arrives on the chat topic */
  G.net.onMessage('srf1/x/chat',JSON.stringify({id:'other1',n:'Rider9',t:'',wild:{h:'coyote',i:m.i,tr:20}}));
  window.advanceTime(60); out.hudHelpers=document.getElementById('tameSub').textContent; out.effPartial=Math.round(P.effTrust(m));
  G.net.onMessage('srf1/x/chat',JSON.stringify({id:'other1',n:'Rider9',t:'',wild:{h:'coyote',i:m.i,tr:60}}));
  window.advanceTime(200);
  out.coop={eff:Math.round(P.effTrust(m)),helpers:P.helpers(m),taming:!!m.taming};
  const d=document.getElementById('dlg'); out.dlg={shown:d.style.display,txt:d.textContent.slice(0,80),hasSanct:!!document.getElementById('wTameSanct')};
  const s0=G.save.fresh(); const c0=s0.coins;
  if(document.getElementById('wTameSanct'))document.getElementById('wTameSanct').click();
  const s1=G.save.fresh();
  out.after={sanct:(s1.sanctuary.coyote||[]).length,dc:s1.coins-c0,tamed:s1.stats.tamedWild,coop:s1.stats.coopTames,members:coy.members.length,respawn:coy.respawn.length};
  /* a finisher elsewhere: wildDone pays a helper who had built trust */
  const m3=coy.members[0]; m3.trust=30; const c1=G.save.fresh().coins;
  G.net.onMessage('srf1/x/chat',JSON.stringify({id:'other2',n:'Rider7',t:'',wildDone:{h:'coyote',i:m3.i,by:'Rider7'}}));
  out.helperPaid={dc:G.save.fresh().coins-c1,members:coy.members.length};
  out.chatSwallowed=!/Rider9/.test(document.getElementById('chatFeed')?document.getElementById('chatFeed').textContent:'');
  return out;
 });
 check('shy canyon horse: alone you cap at 60% (no tame, no follow)',r9.solo.local>=60&&r9.solo.eff===60&&!r9.solo.tamed,r9.solo);
 check('co-op: a club mate\'s trust adds up (80 then 100), HUD lists the helper, tame dialog opens',r9.effPartial===80&&/Rider9/.test(r9.hudHelpers)&&r9.coop.eff===100&&r9.coop.helpers.includes('Rider9')&&r9.coop.taming&&r9.dlg.shown==='block'&&r9.dlg.hasSanct,{partial:r9.effPartial,coop:r9.coop,hud:r9.hudHelpers,dlg:r9.dlg});
 check('release to sanctuary: +150 coins, s.sanctuary.coyote, stats, herd respawn queued',r9.after.sanct===1&&r9.after.dc>=150&&r9.after.tamed===1&&r9.after.coop===1&&r9.after.respawn===1,r9.after);
 check('wildDone from a finisher pays the helper and clears the horse',r9.helperPaid.dc>=300&&r9.helperPaid.members===r9.after.members-1&&r9.chatSwallowed,r9.helperPaid);

 /* ---- sanctuaries + companion ---- */
 const r10=await ev(()=>{
  const G=window.__features,P=G.worldPkg,out={};
  G.save.sync(s=>{s.sanctuary.pines=[{breed:'bay',body:'#8a5a2b',mane:'#332214',name:'Sage',from:'wild',at:Date.now()},{breed:'grey',body:'#b9bec6',mane:'#787f8a',name:'Reed',from:'runaway',at:Date.now()}];});
  const sc=P.SANCTUARIES[0]; P.refreshSanctuary(sc);
  let n=0; G.scene.traverse(o=>{if(o.name==='sanctuary-horse'&&Math.hypot(o.position.x-sc.x,o.position.z-sc.z)<sc.r)n++;});
  out.shown=n;
  const pl=G.horse.player; pl.pos.set(sc.x,0,sc.z+sc.r+3); pl.speed=0; window.advanceTime(120);
  out.ctx=document.getElementById('ctx').textContent;
  window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyE'}));
  const d=document.getElementById('dlg'); out.dlg={shown:d.style.display,sage:/Sage/.test(d.textContent),reed:/Reed/.test(d.textContent)}; d.style.display='none';
  /* companion: any pastured horse can be taken along and follows with push-out */
  let pid=null; G.save.sync(s=>{const h=G.horse.grantHorse(s,'bay',{name:'Pal',src:'qa'});h.out=true;h.foal=false;pid=h.id;});
  G.horse.reloadHorses();
  G.ui.openStable(); const btn=document.querySelector('#stablePanel [data-st="eq:'+(G.horse.myHorses.findIndex(h=>h.id===pid))+'"]');
  out.stableBtn=btn&&btn.textContent; if(btn)btn.click(); G.hidePanels();
  out.companion=G.save.fresh().companion===pid;
  P.findCompanion(); window.advanceTime(100);
  const a=P.companionEntry; out.entry=!!a;
  if(a){pl.pos.set(a.pos.x+30,0,a.pos.z); window.advanceTime(4000); out.followDist=Math.round(Math.hypot(a.pos.x-pl.pos.x,a.pos.z-pl.pos.z));
   out.inside=G.world.colliders.filter(c=>Math.hypot(a.pos.x-c.x,a.pos.z-c.z)<c.r).length;}
  out.steer=typeof G.world.steer==='function';
  return out;
 });
 check('sanctuary shows its released horses inside the rails; E lists them',r10.shown===2&&/Sanctuary/.test(r10.ctx)&&r10.dlg.shown==='block'&&r10.dlg.sage&&r10.dlg.reed,r10);
 check('any pastured horse can be taken along; it follows and stays out of colliders',/Take along/.test(r10.stableBtn||'')&&r10.companion&&r10.entry&&r10.followDist<12&&r10.inside===0&&r10.steer,{btn:r10.stableBtn,comp:r10.companion,entry:r10.entry,d:r10.followDist,inside:r10.inside});

 /* ---- state dump ---- */
 const st=await ev(()=>JSON.parse(render_game_to_text()));
 check('render_game_to_text carries player.region and world.*',st.world&&typeof st.player.region!=='undefined'&&Array.isArray(st.world.locked)&&Array.isArray(st.world.herds)&&st.world.landmarks>0,{region:st.player.region,keys:Object.keys(st.world||{})});
 console.log(JSON.stringify(st));

 /* ---- a legacy save without any of the new fields boots clean ---- */
 await page.evaluate(()=>{
  const legacy={v:2,ranchName:'Meadowlark Ranch',founded:Date.now()-864e5*3,coins:999,gems:9,items:{carrot:3},nextId:2,decor:[],projects:{},trophies:{},wild:null,wildTrust:0,muted:false,
   lastSeen:Date.now()-3600e3,lastDaily:'',questDate:'',quests:[],totalRaces:0,started:true,keys:2,tack:[],sets:{shells:[0,1]},fish:{n:3,bottles:1},
   horses:[{id:1,name:'Clover',breed:'bay-sporthorse',colors:{body:'#765035',mane:'#221b16'},horn:false,rainbow:false,stats:{speed:3,stamina:3,jump:3,accel:3,agility:3},sxp:{},level:1,xp:0,bond:25,needs:{hunger:90,thirst:90,clean:90,happy:90},foal:false,tack:null,out:true}],
   story:{idx:9,prog:0},companion:null};
  localStorage.setItem('starRanchFable_v1',JSON.stringify(legacy));
 });
 stage('legacy save seeded');
 await page.waitForLoadState('networkidle',{timeout:60000}).catch(()=>{}); await page.waitForTimeout(1500);
 await page.goto(base+'/ranch3d.html?qa=world&legacy='+Date.now(),{waitUntil:'load',timeout:120000}); stage('legacy loaded');
 await page.waitForFunction(ready,null,{timeout:150000,polling:250});
 stage('legacy horseReady');
 const L=await ev(()=>{const G=window.__features,P=G.worldPkg;const s=G.save.fresh();return {unlocked:s.unlocked,bottles:s.bottles,sanct:s.sanctuary,installed:G.installed.includes('world'),errs:G.errors.length,
  coyote:P.regionUnlocked(G.tables.REGIONS.find(r=>r.id==='coyote'),s),barley:P.regionUnlocked(G.tables.REGIONS.find(r=>r.id==='barleyfold'),s),shellsKept:(s.sets.shells||[]).length};});
 check('legacy save migrates: story idx 9 opens Coyote + Barleyfold, fields ensured, old sets kept',L.installed&&L.errs===0&&L.unlocked&&Array.isArray(L.bottles)&&L.sanct&&L.coyote&&L.barley&&L.shellsKept===2,L);
 check('no console/page errors',errors.length===0,errors.slice(0,6));
 await browser.close();
 const failed=checks.filter(c=>!c.ok);
 console.log(failed.length?('FAILED '+failed.length+'/'+checks.length):('ALL '+checks.length+' CHECKS PASSED'));
 process.exit(failed.length?1:0);
})().catch(e=>{console.error('FATAL',e);process.exit(2);});

/* mastery-style package check: the breed mastery ladder, per-breed perks, the compressed
   fantasy ladder, bareback riding, Wild Mode, the Mastery tab, mastery dyes, mane/tail styles,
   the Style panel with accessories, and the exclusive fantasy accessories.

   Three seeded saves are booted (a Quarter Horse family at mastery 5, nine Lipizzaners with
   the ridden one bareback, a pair of Celestial Unicorns) and one reload proves persistence.

   Usage:  QA_URL=http://127.0.0.1:8431 NODE_PATH=$(npm root -g) node tools/qa-mastery-style.cjs */
const {chromium}=require('playwright');
const base=(process.env.QA_URL||'http://127.0.0.1:8431').replace(/\/$/,'');
const checks=[];
function check(name,ok,detail){checks.push({name,ok:!!ok,detail});console.log((ok?'PASS ':'FAIL ')+name+(detail!==undefined?' — '+JSON.stringify(detail):''));}
const t0=Date.now();
const stage=s=>console.log('… '+s+' @'+((Date.now()-t0)/1000).toFixed(1)+'s');
let browser=null;
setTimeout(async()=>{console.error('WATCHDOG: no result after 900 s');try{if(browser)await browser.close();}catch(e){}process.exit(3);},900000).unref();
const COL={bay:['#8a5a2b','#332214'],meadowlight:['#143038','#7df0c4'],lipiz:['#efece4','#e0ddd4'],celestial:['#2a2350','#b79dff'],palomino:['#d9a85c','#f4e6c5']};
const FLAGS={meadowlight:{coat:'aurora',glow:true,ability:'leap'},celestial:{horn:true,coat:'galaxy',glow:true,ability:'glow'}};
function mkSave(list,extra){
 const horses=[];let id=1;
 for(const [breed,n,patch] of list)for(let i=0;i<n;i++){const f=FLAGS[breed]||{};horses.push(Object.assign({id:id++,name:breed+'-'+(i+1),breed,colors:{body:COL[breed][0],mane:COL[breed][1]},horn:!!f.horn,rainbow:false,wings:!!f.wings,dragon:false,coat:f.coat||null,ability:f.ability||null,glow:!!f.glow,
  stats:{speed:4,stamina:4,jump:4,accel:4,agility:4},sxp:{},level:3,xp:0,bond:40,needs:{hunger:90,thirst:90,clean:90,happy:90},foal:false,tack:null,out:i>0},patch||{}));}
 return Object.assign({v:2,ranchName:'Meadowlark Ranch',founded:Date.now()-864e5*9,coins:5000,gems:30,items:{carrot:10,apple:5,hay:3,pumpkin:3},nextId:id,horses,decor:[],projects:{},trophies:{},wild:null,wildTrust:0,muted:false,
  lastSeen:Date.now()-60e3,lastDaily:'',questDate:'',quests:[],totalRaces:0,started:true,keys:2,tack:[],dust:200,ridingHorseId:1},extra||{});
}
const settle=async page=>{await page.waitForLoadState('networkidle',{timeout:60000}).catch(()=>{});await page.waitForTimeout(1500);};
const READY=()=>window.render_game_to_text&&(()=>{try{const s=JSON.parse(render_game_to_text());return s.graphics&&s.graphics.horseReady&&!s.graphics.horseLoading;}catch(e){return false;}})();
async function boot(page,save,tag){
 if(save)await page.addInitScript(sv=>{if(/reload/.test(location.search))return;try{localStorage.setItem('starRanchFable_v1',JSON.stringify(sv));}catch(e){}},save);   // a reload keeps what the game wrote
 await page.goto(base+'/ranch3d.html?qa=mastery-style&'+tag+'='+Date.now(),{waitUntil:'load',timeout:120000});
 await page.waitForFunction(READY,null,{timeout:150000,polling:250});
 stage(tag+' horseReady');
}
(async()=>{
 browser=await chromium.launch({headless:true,args:['--disable-background-timer-throttling','--use-angle=metal','--enable-gpu-rasterization','--ignore-gpu-blocklist']});
 const errors=[];
 const newPage=async()=>{const ctx=await browser.newContext({viewport:{width:1280,height:800}});const page=await ctx.newPage();
  page.on('pageerror',e=>errors.push('PAGEERROR '+e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('dialog',d=>{d.dismiss().catch(()=>{});});return page;};

 /* ---------- A. a Quarter Horse family at mastery 5 --------------------------------- */
 let page=await newPage();
 await boot(page,mkSave([['bay',4],['meadowlight',1]]),'family');
 const A=await page.evaluate(()=>{
  const G=window.__features,M=G.mastery,out={},st=()=>JSON.parse(render_game_to_text());
  out.installed=G.installed.includes('mastery-style'); out.errors=G.errors.slice();
  const s0=st(); out.mastery=s0.mastery; out.riding=s0.ridingMastery; out.max=s0.masteryMax; out.perks=s0.perks; out.fantasyMax=M.maxOf('meadowlight');
  const s=G.save.fresh(),h=s.horses[0];
  out.sxpAccel=G.mul('sxp',s,h,'accel'); out.sxpSpeed=G.mul('sxp',s,h,'speed'); out.drain=G.mul('stamDrain',null,h,{});
  /* stat XP wiring: the pumpkin trains acceleration, Quick Learner is +25% */
  let sx=null; G.save.sync(sv=>{const hh=sv.horses[0];hh.stats.accel=3;hh.sxp.accel=0;G.xp.grantStatXp(sv,hh,'accel',100);sx={v:hh.stats.accel,left:hh.sxp.accel};}); out.sxpGain=sx;   // 125 XP: 50 to reach 4, 60 to reach 5, 15 left
  /* the perk table for a breed the player does not ride */
  const p3=M.computePerks(Object.assign({},s,{mastery:{},horses:[{id:91,breed:'palomino'},{id:92,breed:'palomino'},{id:93,breed:'palomino'}]}),{id:91,breed:'palomino',gear:{}});
  out.palomino={ids:p3.ids,drain:p3.drain};
  const p1=M.computePerks(Object.assign({},s,{mastery:{},horses:[{id:91,breed:'palomino'}]}),{id:91,breed:'palomino',gear:{}}); out.palomino1=p1.ids;
  out.ladder10=Object.keys(M.ladderOf('bay')).length; out.ladder5=Object.keys(M.ladderOf('celestial')).length; out.ladderEpic9=M.ladderOf('lipiz')[9].label;
  out.perkBreeds=G.tables.BREEDS3.filter(b=>M.perkRows(b[0]).length>=3).length; out.breeds=G.tables.BREEDS3.length;
  /* Care panel */
  G.ui.openCare(); const cp=document.getElementById('carePanel'); out.careText=cp.textContent; out.careStyleBtn=!!cp.querySelector('[data-care="style:open"]');
  out.careStuds=cp.querySelectorAll('[data-care^="stud:"]').length; out.careBare=cp.querySelectorAll('[data-care^="bare:"]').length; out.careWild=cp.querySelectorAll('[data-care="wild:toggle"]').length;
  out.careOldTail=cp.querySelectorAll('[data-care^="tail:"]').length;
  /* Style panel: hair */
  document.getElementById('styleBtn').click(); const sp=document.getElementById('stylePanel'); out.styleShown=sp.style.display;
  const q=sel=>sp.querySelector(sel);
  out.roachedEnabled=q('[data-fx="style:mane:roached"]')&&!q('[data-fx="style:mane:roached"]').disabled; out.braidLocked=q('[data-fx="style:mane:braid"]')&&q('[data-fx="style:mane:braid"]').disabled;
  out.maneBtns=sp.querySelectorAll('[data-fx^="style:mane:"]').length; out.tailBtns=sp.querySelectorAll('[data-fx^="style:tail:"]').length;
  q('[data-fx="style:mane:roached"]').click(); q('[data-fx="style:tail:banged"]').click();
  const s1=G.save.fresh(); out.hairSaved=s1.horses[0].hair; const L=M.LOOKS.get(G.horse.RIG()); out.lookMeshes=L&&L.hair?L.hair.meshes.length:0;
  const hs=L&&L.hair&&L.hair.materials[0].userData.hairStyle; out.uniforms=hs?{mane:hs.maneLen,tail:hs.tailLen,live:!!hs.u}:null;
  out.attrs=L&&L.hair?['hairRoot','hairRootR','hairSpan','hairPart'].filter(a=>!L.hair.meshes[0].geometry.attributes[a]):null;
  out.forcedTier2=M.setHair('mane','braid'); out.hairAfterForce=G.save.fresh().horses[0].hair.mane;
  /* dyes */
  q('[data-fx="style:tab:dye"]').click(); out.natEnabled=!q('[data-fx="style:dye:mane:#f4e6c5"]').disabled; out.boldLocked=q('[data-fx="style:dye:mane:#5affc8"]').disabled;
  const cd=G.save.fresh().coins; q('[data-fx="style:dye:mane:#f4e6c5"]').click(); out.maneDye=G.save.fresh().horses[0].colors.mane; out.coinsAfterDye=G.save.fresh().coins-cd;
  out.boldForced=M.setDye('mane','#5affc8'); out.maneAfterBold=G.save.fresh().horses[0].colors.mane;
  /* accessories */
  q('[data-fx="style:tab:acc"]').click(); out.buyBtns=sp.querySelectorAll('[data-fx^="style:buy:"]').length;
  const c0=G.save.fresh().coins; q('[data-fx="style:buy:flymask-blue"]').click(); const s2=G.save.fresh(); out.mask={coins:c0-s2.coins,owned:!!s2.accInv['flymask-blue'],worn:s2.horses[0].acc&&s2.horses[0].acc.mask};
  const d0=s2.dust; q('[data-fx="style:buy:browcharm-gold"]').click(); out.charm={dust:d0-G.save.fresh().dust,worn:G.save.fresh().horses[0].acc.brow};
  out.westLocked=q('[data-fx="style:buy:canyon-collar"]').disabled; out.dragonLocked=q('[data-fx="style:buy:drake-mask"]').disabled;
  const season=G.time.seasonNow().def.id; const off=['bloom','sun','ember','frost'].filter(x=>x!==season)[0]; const offId={bloom:'bloom-mask',sun:'sun-wraps',ember:'ember-sheet',frost:'frost-wraps'}[off]; out.seasonLocked=q('[data-fx="style:buy:'+offId+'"]').disabled;
  let maskMesh=null; G.horse.player.mesh.traverse(o=>{if(o.name==='acc:mask'&&!maskMesh)maskMesh=o;});
  if(maskMesh){const T=G.THREE;const wp=new T.Vector3();maskMesh.getWorldPosition(wp);const hb=G.horse.RIG().bones.find(b=>b.name==='head');const hp=new T.Vector3();hb.getWorldPosition(hp);out.maskDist=wp.distanceTo(hp);}
  out.stateStyle=st().style; out.stateAcc=st().acc;
  /* the mastery tab of Quests */
  G.hidePanels(); document.getElementById('questBtn').click(); document.querySelector('[data-q="tab:mastery"]').click();
  const rows=[...document.querySelectorAll('#questPanel [data-mastery]')]; out.tabRows=rows.length; out.tabFirst=rows[0]&&rows[0].textContent; out.tabHas=rows.some(r=>/Quarter Horse/.test(r.textContent)&&/5\/10/.test(r.textContent));
  /* stable badges */
  G.hidePanels(); G.ui.openStable(); out.stableBadge=document.getElementById('stablePanel').textContent.includes('🎖️5/10'); G.hidePanels();
  /* mastery-up toast on a new horse of the breed */
  G.save.sync(sv=>{G.horse.grantHorse(sv,'bay',{name:'QA Six',src:'qa'});});
  out.toast=M.lastToast(); out.masteryLv=G.save.fresh().masteryLv.bay; out.masteryAfter=st().mastery.bay;
  out.achHair=G.quest.ACHS.find(a=>a.id==='hair1').v(G.save.fresh()); out.achStyle=G.quest.ACHS.find(a=>a.id==='style3').v(G.save.fresh());
  /* a club mate wearing the same: the /pos mirror */
  G.net.onMessage('srf1/x/pos',JSON.stringify({id:'other1',n:'Ada',x:G.horse.player.pos.x+3,z:G.horse.player.pos.z+3,h:0,sp:0,b:'bay',c:{body:'#8a5a2b',mane:'#332214'},hs:{mane:'roached',tail:'natural'},ac:{mask:'flymask-blue'},bb:1,wm:0}));
  window.advanceTime(200);
  const r=G.horse.remotes.other1; out.remote=r?{styled:!!r._styleKey,saddleHidden:r.rig&&r.rig.saddle?r.rig.saddle.visible===false:null,look:!!(r.rig&&M.LOOKS.get(r.rig)),acc:r.rig&&M.LOOKS.get(r.rig)?M.LOOKS.get(r.rig).acc.length:0}:null;
  return out;
 });
 check('package installed without error',A.installed&&A.errors.length===0,A.errors);
 check('family counting: 4 Quarter Horses + 1 Meadowlight = bay mastery 5, meadowlight 1/5',A.mastery&&A.mastery.bay===5&&A.mastery.meadowlight===1&&A.riding===5&&A.max===10&&A.fantasyMax===5,{mastery:A.mastery,riding:A.riding,max:A.max,fmax:A.fantasyMax});
 check('bay perks at mastery 5: rungs 1,3,5',A.perks&&A.perks.join()==='quickStart,secondWind,quickLearner',A.perks);
 check("Quick Learner: 'sxp' factor 1.25 on accel, 1 on speed, and 100 stat XP lands as 125 (3→5, 15 left)",A.sxpAccel===1.25&&A.sxpSpeed===1&&A.sxpGain&&A.sxpGain.v===5&&A.sxpGain.left===15,{a:A.sxpAccel,s:A.sxpSpeed,gain:A.sxpGain});
 check('Free Runner at palomino mastery 3 (−25% drain), not at 1',A.palomino&&A.palomino.ids.includes('freeRunner')&&A.palomino.drain===0.75&&A.palomino1.join()==='xcCompetitor',A.palomino);
 check('ladders: 10 rungs real, 5 fantasy, Epic rung 9 adds Wild Mode; every breed has perks',A.ladder10===10&&A.ladder5===5&&/Wild Mode/.test(A.ladderEpic9)&&A.perkBreeds===A.breeds,{l10:A.ladder10,l5:A.ladder5,epic:A.ladderEpic9,perkBreeds:A.perkBreeds,breeds:A.breeds});
 check('Care panel: ladder line, perk chips, Style button, studs at 4, no bareback below 9',/Quarter Horse mastery 5\/10/.test(A.careText)&&/next at 6/.test(A.careText)&&/Quick Learner/.test(A.careText)&&A.careStyleBtn&&A.careStuds===4&&A.careBare===0&&A.careWild===0&&A.careOldTail===0,{studs:A.careStuds,bare:A.careBare,wild:A.careWild,tail:A.careOldTail});
 check('Style panel opens from the dock; 7 mane + 6 tail styles; tier I open, tier II locked at 5',A.styleShown==='flex'&&A.maneBtns===7&&A.tailBtns===6&&A.roachedEnabled&&A.braidLocked,{shown:A.styleShown,m:A.maneBtns,t:A.tailBtns,r:A.roachedEnabled,b:A.braidLocked});
 check('roached mane + banged tail: saved, shader uniforms 0.35/0.7 on styled groom meshes, root attributes present',A.hairSaved&&A.hairSaved.mane==='roached'&&A.hairSaved.tail==='banged'&&A.lookMeshes>0&&A.uniforms&&A.uniforms.mane===0.35&&A.uniforms.tail===0.7&&A.attrs&&A.attrs.length===0,{hair:A.hairSaved,meshes:A.lookMeshes,u:A.uniforms,missingAttrs:A.attrs});
 check('a forced tier-II style is refused below mastery 8',A.forcedTier2===false&&A.hairAfterForce==='roached',{forced:A.forcedTier2,mane:A.hairAfterForce});
 check('dyes: natural free at 2 (no coins), bold locked below 6 even when forced',A.natEnabled&&A.boldLocked&&A.maneDye==='#f4e6c5'&&A.coinsAfterDye===0&&A.boldForced===false&&A.maneAfterBold==='#f4e6c5',{nat:A.natEnabled,bold:A.boldLocked,mane:A.maneDye,coins:A.coinsAfterDye,forced:A.boldForced});
 check('accessories: 19 rows; fly mask 300🪙 worn; brow charm 60✨ dust; western/dragon/off-season locked',A.buyBtns>=17&&A.mask&&A.mask.coins===300&&A.mask.owned&&A.mask.worn==='flymask-blue'&&A.charm&&A.charm.dust===60&&A.charm.worn==='browcharm-gold'&&A.westLocked&&A.dragonLocked&&A.seasonLocked,{buy:A.buyBtns,mask:A.mask,charm:A.charm,w:A.westLocked,d:A.dragonLocked,s:A.seasonLocked});
 check('fly mask mesh hangs on the head bone (<0.6 units) and the state dump counts it',typeof A.maskDist==='number'&&A.maskDist<0.6&&A.stateStyle&&A.stateStyle.acc>0&&A.stateAcc&&A.stateAcc.mask==='flymask-blue',{dist:A.maskDist,style:A.stateStyle,acc:A.stateAcc});
 check('Mastery tab lists every breed with n/max, Quarter Horse at 5/10 first',A.tabRows>=44&&A.tabHas&&/5\/10/.test(A.tabFirst||''),{rows:A.tabRows,first:A.tabFirst});
 check('stable rows carry the mastery badge',A.stableBadge);
 check('mastery-up toast on a sixth Quarter Horse (rung 6: bold dyes)',/mastery 6\/10/.test(A.toast)&&A.masteryAfter===6&&A.masteryLv===6,{toast:A.toast,after:A.masteryAfter,lv:A.masteryLv});
 check('achievements see the new do and the accessories',A.achHair===1&&A.achStyle===2,{hair:A.achHair,style:A.achStyle});
 check('remote rider mirrors hair/accessory/bareback from the /pos packet',A.remote&&A.remote.styled&&A.remote.saddleHidden===true&&A.remote.look&&A.remote.acc>0,A.remote);
 /* persistence across a reload */
 await settle(page);
 await page.goto(base+'/ranch3d.html?qa=mastery-style&reload='+Date.now(),{waitUntil:'load',timeout:120000});
 await page.waitForFunction(READY,null,{timeout:150000,polling:250}); stage('reload horseReady');
 const P=await page.evaluate(()=>{const G=window.__features,M=G.mastery;window.advanceTime(1200);const st=JSON.parse(render_game_to_text());let mask=0;G.horse.player.mesh.traverse(o=>{if(o.name==='acc:mask')mask++;});const L=M.LOOKS.get(G.horse.RIG());const hs=L&&L.hair&&L.hair.materials[0].userData.hairStyle;return {hair:st.hair,acc:st.acc,mastery:st.mastery.bay,mask,mane:hs&&hs.maneLen};});
 check('reload keeps the roached mane, the mask and mastery 6',P.hair&&P.hair.mane==='roached'&&P.acc&&P.acc.mask==='flymask-blue'&&P.mastery===6&&P.mask>0&&P.mane===0.35,P);
 await settle(page); await page.context().close();

 /* ---------- B. nine Lipizzaners, bareback, Wild Mode -------------------------------- */
 page=await newPage();
 await boot(page,mkSave([['lipiz',9,null]],{}),'lipiz');
 const B=await page.evaluate(async()=>{
  const G=window.__features,M=G.mastery,out={},st=()=>JSON.parse(render_game_to_text());
  out.mastery=st().mastery.lipiz;
  /* bareback: toggle from the Care panel (rung 9) */
  G.ui.openCare(); const cp=document.getElementById('carePanel'); out.bareBtn=!!cp.querySelector('[data-care="bare:on"]'); out.wildBtn=!!cp.querySelector('[data-care="wild:toggle"]');
  window.advanceTime(100); const y0=G.horse.player.rider.g.position.y;
  cp.querySelector('[data-care="bare:on"]').click(); window.advanceTime(100);
  const y1=G.horse.player.rider.g.position.y; out.seat={y0,y1,drop:y0-y1,scale:G.horse.player.mesh.scale.x}; out.saddleHidden=G.horse.TACK().saddle.visible===false; out.stateBare=st().bareback;
  out.bareOff=!!document.getElementById('carePanel').querySelector('[data-care="bare:off"]');
  G.hidePanels();
  /* Wild Mode on the wild key */
  window.dispatchEvent(new KeyboardEvent('keydown',{code:G.key('wild')})); window.advanceTime(100);
  out.wildOn={wild:st().wild,rider:G.horse.player.rider.g.visible,saddle:G.horse.TACK().saddle.visible,bridle:G.horse.TACK().bridle.visible,saved:G.save.fresh().wildMode};
  const x0=G.horse.player.pos.x,z0=G.horse.player.pos.z; window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyW'})); window.advanceTime(2500); window.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyW'}));
  out.moved=Math.hypot(G.horse.player.pos.x-x0,G.horse.player.pos.z-z0); out.speed=st().player.speed;
  window.dispatchEvent(new KeyboardEvent('keydown',{code:G.key('wild')})); window.advanceTime(100);
  out.wildOff={wild:st().wild,rider:G.horse.player.rider.g.visible,saddle:G.horse.TACK().saddle.visible};
  /* below the gate: eight Lipizzaners */
  G.save.sync(s=>{s.horses.pop();s.mastery.lipiz=8;s.masteryLv.lipiz=8;});
  out.gate={can:M.canWild(G.save.fresh(),G.save.fresh().horses[0]),toggled:M.toggleWild(),wild:st().wild,toast:M.lastToast()};
  G.save.sync(s=>{s.horses.push(Object.assign({},s.horses[1],{id:99,name:'Nine'}));});
  out.wildAgain=M.toggleWild(); out.stateWild=st().wild; out.dailyWild=(G.save.fresh().life||{}).wild;
  return out;
 });
 check('nine Lipizzaners = mastery 9: bareback and Wild Mode rows in Care',B.mastery===9&&B.bareBtn&&B.wildBtn,{m:B.mastery,bare:B.bareBtn,wild:B.wildBtn});
 check('bareback: saddle hidden, rider seat drops ~0.10/scale, toggle shows current state',B.saddleHidden&&B.stateBare&&B.bareOff&&B.seat&&Math.abs(B.seat.drop-0.10/B.seat.scale)<0.02,B.seat);
 check('Wild Mode on: rider, saddle and bridle hidden, persisted; the horse still drives',B.wildOn&&B.wildOn.wild&&!B.wildOn.rider&&!B.wildOn.saddle&&!B.wildOn.bridle&&B.wildOn.saved&&B.moved>3,{on:B.wildOn,moved:B.moved,speed:B.speed});
 check('Wild Mode off: rider back, saddle stays hidden (bareback)',B.wildOff&&!B.wildOff.wild&&B.wildOff.rider&&!B.wildOff.saddle,B.wildOff);
 check('gate: eight Lipizzaners cannot go wild and the toast says mastery 9; nine can',B.gate&&!B.gate.can&&B.gate.toggled===false&&!B.gate.wild&&/mastery 9/.test(B.gate.toast)&&B.wildAgain===true&&B.stateWild&&B.dailyWild>=1,B.gate);
 await settle(page);
 await page.goto(base+'/ranch3d.html?qa=mastery-style&wildreload='+Date.now(),{waitUntil:'load',timeout:120000});
 await page.waitForFunction(READY,null,{timeout:150000,polling:250}); stage('wild reload horseReady');
 const W=await page.evaluate(()=>{const G=window.__features;window.advanceTime(300);const st=JSON.parse(render_game_to_text());return {wild:st.wild,rider:G.horse.player.rider.g.visible,saddle:G.horse.TACK().saddle.visible};});
 check('Wild Mode survives a reload: rider hidden after boot',W.wild&&!W.rider&&!W.saddle,W);
 await settle(page); await page.context().close();

 /* ---------- C. two Celestial Unicorns: the five-rung fantasy ladder ------------------ */
 page=await newPage();
 await boot(page,mkSave([['celestial',2]]),'celestial');
 const C=await page.evaluate(()=>{
  const G=window.__features,M=G.mastery,out={},st=()=>JSON.parse(render_game_to_text());
  out.mastery=st().mastery.celestial; out.max=st().masteryMax; out.fantasy=M.isFantasy('celestial');
  G.ui.openCare(); out.careText=document.getElementById('carePanel').textContent; G.hidePanels();
  document.getElementById('styleBtn').click(); const sp=document.getElementById('stylePanel'); sp.querySelector('[data-fx="style:tab:fx"]').click();
  const q=sel=>sp.querySelector(sel);
  out.rows=sp.querySelectorAll('[data-fx^="style:fx:"]').length; out.hairOpen=q('[data-fx="style:fx:hair:rainbow-hair"]')&&!q('[data-fx="style:fx:hair:rainbow-hair"]').disabled; out.hornLocked=!!q('[data-fx="style:fx:horn:rainbow-horn"]')&&q('[data-fx="style:fx:horn:rainbow-horn"]').disabled;
  out.noTailDye=!q('[data-fx^="style:dye:"]');
  q('[data-fx="style:fx:hair:rainbow-hair"]').click();
  const L=M.LOOKS.get(G.horse.RIG()); out.fxSaved=G.save.fresh().horses[0].fx; out.matFx=L&&L.hair?L.hair.materials.map(m=>m.userData.fx):null; out.stateFx=st().fx;
  out.forcedHorn=M.setFx('horn','rainbow-horn'); out.fxAfterForce=G.save.fresh().horses[0].fx.horn||null;
  /* two more of the same horse: rung 4, the horn */
  G.save.sync(s=>{G.horse.grantHorse(s,'celestial',{name:'Three',src:'qa'});G.horse.grantHorse(s,'celestial',{name:'Four',src:'qa'});});
  M.renderStyle(); out.hornOpen=!q('[data-fx="style:fx:horn:rainbow-horn"]').disabled; q('[data-fx="style:fx:horn:rainbow-horn"]').click();
  const horn=G.horse.player.parts&&G.horse.player.parts.horn; out.horn={fx:horn&&horn.material.userData.fx,saved:G.save.fresh().horses[0].fx.horn}; out.mastery4=st().mastery.celestial;
  out.canWild4=M.canWild(G.save.fresh(),G.save.fresh().horses[0]);
  G.save.sync(s=>{G.horse.grantHorse(s,'celestial',{name:'Five',src:'qa'});});
  out.canWild5=M.canWild(G.save.fresh(),G.save.fresh().horses[0]); out.wild=M.toggleWild(); out.stateWild=st().wild; M.toggleWild();
  out.achFx=G.quest.ACHS.find(a=>a.id==='fx1').v(G.save.fresh()); out.achMaster=G.quest.ACHS.find(a=>a.id==='mastery10').v(G.save.fresh());
  G.ui.openCare(); out.careText5=document.getElementById('carePanel').textContent;
  return out;
 });
 check('two Celestial Unicorns: mastery 2/5, a fantasy ladder',C.mastery===2&&C.max===5&&C.fantasy&&/mastery 2\/5/.test(C.careText),{m:C.mastery,max:C.max});
 check('Fantasy tab: Rainbow Mane & Tail open at 2, Rainbow Horn locked until 4, no dye rows',C.rows===2&&C.hairOpen&&C.hornLocked&&C.noTailDye,{rows:C.rows,hair:C.hairOpen,horn:C.hornLocked,noDye:C.noTailDye});
 check('rainbow hair: saved, the groom materials carry fx=rainbow, state dump shows it; forced horn refused',C.fxSaved&&C.fxSaved.hair==='rainbow-hair'&&C.matFx&&C.matFx.length>0&&C.matFx.every(f=>f==='rainbow')&&C.stateFx&&C.stateFx.hair==='rainbow-hair'&&C.forcedHorn===false&&C.fxAfterForce===null,{fx:C.fxSaved,mat:C.matFx,forced:C.forcedHorn});
 check('four of them: Rainbow Horn unlocks and recolours the horn',C.mastery4===4&&C.hornOpen&&C.horn&&C.horn.fx==='rainbow'&&C.horn.saved==='rainbow-horn',{m4:C.mastery4,open:C.hornOpen,horn:C.horn});
 check('five: Wild Mode opens on the fantasy ladder (not at four); Breed master achievement',!C.canWild4&&C.canWild5&&C.wild===true&&C.stateWild&&C.achFx===1&&C.achMaster===1&&/mastery 5\/5/.test(C.careText5),{c4:C.canWild4,c5:C.canWild5,wild:C.wild,ach:[C.achFx,C.achMaster]});
 await settle(page); await page.context().close();

 check('no console/page errors',errors.length===0,errors.slice(0,6));
 await browser.close();
 const failed=checks.filter(c=>!c.ok);
 console.log(failed.length?('FAILED '+failed.length+'/'+checks.length):('ALL '+checks.length+' CHECKS PASSED'));
 process.exit(failed.length?1:0);
})().catch(e=>{console.error('FATAL',e);process.exit(2);});

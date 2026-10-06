/* Rider Journey + personal-best ghost integration on a disposable offline save.
   One real course is completed with small player-only simulated riding steps; no
   course indices or grades are written. Historical-save fixtures separately test
   migration, rewards and chapter eligibility. Keyboard playability is tested elsewhere.
   QA_PORT=8595 PLAYWRIGHT_PATH=/path/to/playwright node tools/qa-rider-journey.cjs
   QA_JOURNEY_REWARDS_ONLY=1 skips the previously verified live-course/ghost section. */
const QA=require('./qa-platform.cjs'),fs=require('node:fs'),assert=require('node:assert/strict');
const out=process.env.QA_OUT||'/private/tmp/meadowlark-rider-journey';
const chapters=['first-partners','steady-hands','river-rhythm','trail-partners','meadowlark-champion'];
const rewards=[{coins:150,slot:'pad',set:'Silver',rarity:'Rare'},{coins:200,slot:'bridle',set:'Silver',rarity:'Rare'},{coins:250,slot:'shoes',set:'Silver',rarity:'Rare'},{coins:350,slot:'saddle',set:'Silver',rarity:'Rare'},{coins:750,slot:'saddle',set:'Aurora',rarity:'Legendary'}];
const report={checks:[],errors:[]};let browser;
const check=(ok,label,detail)=>{assert.ok(ok,label+(detail?' — '+JSON.stringify(detail):''));report.checks.push(label);console.log('PASS '+label);};
const watchdog=setTimeout(()=>{console.error('Journey QA exceeded 9 minutes');browser?.close().finally(()=>process.exit(3));},540000);watchdog.unref();
async function boot(page){
 await page.goto(QA.BASE+'/ranch3d.html?qa=rider-journey&emoji=0',{timeout:120000});
 try{await page.waitForFunction(()=>window.__features?.riderJourney&&__features.rushGhost&&document.getElementById('riderJourneyPanel')&&!document.getElementById('load'),null,{timeout:150000});}
 catch(error){report.bootFailure=await page.evaluate(()=>({features:!!window.__features,journey:!!window.__features?.riderJourney,ghost:!!window.__features?.rushGhost,panel:!!document.getElementById('riderJourneyPanel'),load:document.getElementById('load')?.textContent,errors:window.__features?.errors,ready:window.__features?.horse.RIG().ready,body:document.body.className}));await page.screenshot({path:out+'/boot-failure.png'});throw error;}
 await page.evaluate(()=>{
  const G=__features;advanceTime(0);G.save.sync(s=>{s.rider.made=true;});G.wardrobe.closeChar();G.hidePanels();G.seFrame?.settle();G.audio.setMuted(true);G.riding.releaseAll();document.activeElement?.blur();
  window.__qaStep=ms=>{const render=G.renderer.render;G.renderer.render=function(scene,camera,...rest){if(camera!==G.camera)return render.call(this,scene,camera,...rest);};try{advanceTime(ms);}finally{G.renderer.render=render;}};
  window.__qaIdle=ms=>{G.horse.player.speed=0;G.riding.releaseAll();__qaStep(ms);};
  window.__qaState=()=>{const s=G.save.fresh();return {journey:G.riderJourney.snapshot(),ghost:G.rushGhost.snapshot(),coins:s.coins,tack:s.tack.map(t=>({id:t.id,slot:t.slot,set:t.set,rarity:t.rarity,style:t.style,bonus:t.bonus})),gear:s.horses.map(h=>({id:h.id,gear:h.gear||{}}))};};
  window.__qaPasture=()=>{
   const c=G.course.get(),p=G.horse.player;if(!c?.ev?.rush)throw Error('No Rush');let n=0;
   while(G.course.get()===c&&c.idx<c.jumps.length){
    if(++n>7000)throw Error('Course traversal stalled at '+c.idx);const target=c.jumps[c.idx];if(target.kind!=='gate')throw Error('Pasture must contain only gates');
    const dx=target.x-p.pos.x,dz=target.z-p.pos.z,d=Math.hypot(dx,dz);p.heading=Math.atan2(dx,dz);p.speed=4;
    if(d){const step=Math.min(.06,d);p.pos.x+=dx/d*step;p.pos.z+=dz/d*step;}__qaStep(20);
   }
   G.riding.releaseAll();p.speed=0;return {completed:c.idx,total:c.jumps.length,result:G.ranchRush.lastResult,state:__qaState()};
  };
  __qaIdle(1500);
 });
 await page.waitForFunction(()=>__features.horse.RIG().ready&&!__features.horse.RIG().loadingBreed,null,{timeout:90000});await page.evaluate(()=>__qaIdle(1500));
}
async function shot(page,name){await page.evaluate(()=>advanceTime(0));await page.screenshot({path:out+'/'+name+'.png'});}
async function incompatibleGhost(page){
 const state=await page.evaluate(()=>{
  const G=__features;G.hidePanels();G.seFrame?.settle();__qaIdle(1800);
  G.save.sync(s=>{s.rushGhost=s.rushGhost||{version:1,enabled:true,records:{}};s.rushGhost.records['rush-pasture']={id:'rush-pasture',layout:'old-course-layout',time:30,runId:'history-ghost',step:.2,samples:Array.from({length:151},(_,i)=>[Math.round(i*20)/100,-60+i*.05,16,0,0])};s.ranchRush=s.ranchRush||{version:1,records:{}};s.ranchRush.records['rush-pasture']={plays:1,bestScore:1200,bestTime:30,bestCombo:6,splits:[],layout:'old-course-layout',lastRunId:'history-ghost'};});
  G.rushGhost.setEnabled(true);const loaded=G.rushGhost.snapshot(),started=G.ranchRush.start('rush-pasture');__qaIdle(4000);
  const ghost=G.rushGhost.snapshot(),course=G.course.get()?.ev?.id||null,native=G.horse.RIG()?.heroMotion?.state;G.course.cancelCourse();__qaStep(50);return {loaded,started,course,ghost,native};
 });report.incompatibleGhost=state;
 check(state.ghost.available.some(r=>r.id==='rush-pasture'&&r.points===151),'Historical ghost and personal best form a valid matching record',state.ghost);
 check(state.started&&state.course==='rush-pasture'&&!state.ghost.active&&!state.ghost.visible,'A valid ghost for a different saved PB layout is not played',state);
}
async function lockerRegression(page){
 const state=await page.evaluate(ids=>{
  const G=__features;G.save.sync(s=>{
   s.rescueRides={version:1,completions:1,bestTime:80,lastRunId:'history-rescue'};s.ranchRush={version:1,records:{}};
   for(const d of G.ranchRush.definitions)s.ranchRush.records[d.id]={plays:1,bestScore:d.medals.gold,bestTime:30,bestCombo:8,medal:'gold',splits:[],layout:'history',lastRunId:'history-'+d.id};
   s.roundupBest={beginner:{plays:1,penned:3,medal:'gold'},full:{plays:1,penned:5,medal:'gold'}};
  });
  const claims=ids.map(id=>G.riderJourney.claim(id));const oldId=G.save.fresh().tack.find(t=>!t.id.startsWith('journey-'))?.id;
  G.ranchSys.tackAct('on:journey-first-partners');const wore=G.save.fresh().horses[G.horse.rideIdx()].gear.pad;
  G.ranchSys.tackAct('off:pad');G.save.sync(s=>{s.coins+=2000;s.items.kit1=(s.items.kit1||0)+2;});
  G.ranchSys.tackAct('up:journey-first-partners');const upgraded=G.save.fresh().tack.find(t=>t.id==='journey-first-partners').lvl;
  const before=G.save.fresh().coins;G.ranchSys.tackAct('sell:journey-steady-hands');const after=G.save.fresh().coins,sold=!G.save.fresh().tack.some(t=>t.id==='journey-steady-hands');
  const duplicate=G.riderJourney.claim('steady-hands');let legacy=true;
  if(oldId){G.ranchSys.tackAct('on:'+oldId);const s=G.save.fresh(),item=s.tack.find(t=>t.id===oldId);legacy=s.horses[G.horse.rideIdx()].gear[item.slot]===oldId;}
  return {claims:claims.filter(Boolean).length,wore,upgraded,before,after,sold,duplicate,legacy,journey:G.riderJourney.snapshot()};
 },chapters);report.locker=state;
 check(state.claims===5,'Historical fixture can claim all five earned rewards once');
 check(state.wore==='journey-first-partners','Ordinary tack locker equips a Journey item with its full identifier');
 check(state.upgraded===2,'Ordinary tack locker upgrades a Journey item');
 check(state.sold&&state.after-state.before===200&&!state.duplicate&&state.journey.chapters[1].status==='claimed','Ordinary sale removes Journey tack without reopening its claim',state);
 check(state.legacy,'Existing tack still equips normally');
 await boot(page);const saved=await page.evaluate(()=>{const G=__features,s=G.save.fresh();return {journey:G.riderJourney.snapshot(),sold:!s.tack.some(t=>t.id==='journey-steady-hands'),level:s.tack.find(t=>t.id==='journey-first-partners')?.lvl};});
 check(saved.journey.complete&&saved.journey.claimedCount===5&&saved.sold&&saved.level===2,'All claim receipts, sold item and upgrade survive a full reload');
 await page.evaluate(()=>__features.ui.dispatch('journey:open'));await shot(page,'journey-persisted');
 check(!report.errors.length&&await page.evaluate(()=>!__features.errors.length),'Locker regression has no browser or feature errors');
}
(async()=>{
 fs.mkdirSync(out,{recursive:true});browser=await QA.chromium.launch({headless:true,args:QA.gpuArgs()});const page=await browser.newPage({viewport:{width:1280,height:850},hasTouch:true});
 await page.routeWebSocket('**',ws=>ws.close());page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!/WebSocket|net::ERR|Failed to load resource/i.test(m.text()))report.errors.push(m.text());});page.on('dialog',d=>d.dismiss());
 try{
  await boot(page);if(process.env.QA_JOURNEY_GHOST_ONLY){await incompatibleGhost(page);check(!report.errors.length,'Focused ghost compatibility test has no browser errors',report.errors);return;}if(process.env.QA_JOURNEY_LOCKER_ONLY){await lockerRegression(page);return;}const initial=await page.evaluate(()=>__qaState());
  check(!await page.evaluate(()=>__features.errors.length),'Journey and ghost packages install');
  check(initial.journey.chapters.length===5&&initial.journey.chapters[0].status==='active'&&initial.journey.chapters.slice(1).every(c=>c.status==='locked')&&!initial.journey.claimedCount,'Fresh save begins with one active chapter');
  await page.evaluate(()=>__features.ui.dispatch('journey:open'));await shot(page,'journey-fresh');await page.evaluate(()=>__features.ui.dispatch('journey:close'));
  const early=await page.evaluate(ids=>{const G=__features,b=__qaState();const responses=ids.map(id=>G.riderJourney.claim(id));return {b,responses,a:__qaState()};},chapters);
  check(early.responses.every(r=>!r)&&early.a.coins===early.b.coins&&early.a.tack.length===early.b.tack.length,'Incomplete and locked chapters cannot pay rewards');
  const forged=await page.evaluate(()=>{const G=__features,b=JSON.stringify(G.riderJourney.snapshot());G.run('rescueFinish',{id:'clover',name:'QA fixture',runId:'forged',firstCompletion:true,time:60,pay:{c:0,xp:0}});G.run('roundupFinish',{runId:'forged',name:'QA fixture',mode:'full',total:5,penned:5,medal:'gold',score:1000,time:30,remaining:30,pay:0,gems:0,keys:0});G.run('rushFinish',{runId:'forged',id:'rush-pasture',name:'QA fixture',medal:'gold',newBestTime:true,time:30,timeBonus:400,score:1200,pay:0,bestCombo:4,cleanJumps:0,perfectJumps:0,cleanGates:6,penalties:0});return {same:b===JSON.stringify(G.riderJourney.snapshot()),ghost:!!G.save.fresh().rushGhost?.records?.['rush-pasture']};});
  check(forged.same&&!forged.ghost,'Synthetic finish notifications cannot create progress or a ghost');
  // Existing result-card listeners may display a fake recap from the negative hook test.
  await page.waitForTimeout(50);await page.evaluate(()=>{const G=__features;G.hidePanels();G.seFrame?.settle();});
  const next=await page.evaluate(()=>{const G=__features;G.riderJourney.startNext();const a=G.rescueRide.snapshot().active;G.rescueRide.cancel();__qaStep(50);return a?.stage;});
  check(next==='find','Follow Journey starts the first genuine incomplete activity');
  if(!process.env.QA_JOURNEY_REWARDS_ONLY){
  await page.evaluate(()=>{const G=__features;G.hidePanels();G.seFrame?.settle();__qaIdle(1500);G.ranchRush.start('rush-pasture');__qaIdle(3600);});
  const run=await page.evaluate(()=>__qaPasture());report.firstRun={completed:run.completed,total:run.total,result:run.result,ghost:run.state.ghost};
  check(run.completed===run.total&&run.result?.id==='rush-pasture','A real course finish records Journey progress');
  check(run.state.journey.chapters[0].goals.some(g=>g.done)&&run.state.journey.chapters[0].status==='active','Pasture goal counts while the missing rescue still blocks chapter claim');
  const tape=await page.evaluate(()=>{const t=__features.save.fresh().rushGhost?.records?.['rush-pasture'];return t?{id:t.id,runId:t.runId,time:t.time,n:t.samples.length,first:t.samples[0][0],last:t.samples.at(-1)[0]}:null;});report.tape=tape;
  check(tape&&tape.runId===run.result.runId&&tape.n>=2&&tape.n<=2048&&tape.first===0&&Math.abs(tape.last-tape.time)<.011,'Genuine personal best saves a bounded complete replay',tape);
  await page.locator('#ranchRushPanel').waitFor({state:'visible',timeout:10000});await shot(page,'first-finish');
  await page.evaluate(()=>{const G=__features;G.ranchRush.start('rush-pasture');__qaIdle(4600);});
  const playback=await page.evaluate(()=>__features.rushGhost.snapshot());report.playback=playback;
  check(playback.active&&playback.position&&playback.visible&&playback.playbackTime>0,'Retry plays your saved ghost after countdown',playback);
  const later=await page.evaluate(()=>{__qaIdle(500);return __features.rushGhost.snapshot();});
  check(later.position&&Math.hypot(later.position.x-playback.position.x,later.position.z-playback.position.z)>.1,'Ghost moves along its recorded path');await shot(page,'ghost-playback');
  const cancelled=await page.evaluate(()=>{const G=__features;G.course.cancelCourse();__qaStep(50);return {ghost:G.rushGhost.snapshot(),runId:G.save.fresh().rushGhost.records['rush-pasture'].runId};});
  check(!cancelled.ghost.visible&&!cancelled.ghost.recording&&cancelled.runId===tape.runId,'Cancellation removes the live ghost and preserves its prior recording');
  await page.evaluate(()=>__features.rushGhost.setEnabled(false));await boot(page);
  check(await page.evaluate(()=>!__features.rushGhost.snapshot().enabled&&__features.rushGhost.snapshot().preference===false),'Ghost visibility preference survives reload');
  await page.evaluate(()=>{const G=__features;G.ranchRush.start('rush-pasture');__qaIdle(4600);});
  const hidden=await page.evaluate(()=>__features.rushGhost.snapshot());check(hidden.active&&!hidden.visible&&!hidden.position,'Disabled ghost stays hidden during a replay');
  await page.evaluate(()=>{__features.course.cancelCourse();__qaStep(50);__features.rushGhost.setEnabled(true);});
  }
  // Historical fixture: prior activity records exist before Journey is installed.
  await page.evaluate(()=>{const G=__features;G.save.sync(s=>{
   s.rescueRides={version:1,completions:2,bestTime:80,adopted:false,lastRunId:'history-rescue'};
   s.ranchRush={version:1,records:{}};for(const d of G.ranchRush.definitions)s.ranchRush.records[d.id]={plays:2,bestScore:d.medals.gold,bestTime:30,bestCombo:8,medal:'gold',splits:[],layout:'historical-fixture',lastRunId:'history-'+d.id};
   s.roundupBest={beginner:{plays:2,score:1400,penned:3,time:60,medal:'silver',lastRunId:'history-beginner'},full:{plays:2,score:2500,penned:5,time:70,medal:'gold',lastRunId:'history-full'}};
  });});await boot(page);
  const migrated=await page.evaluate(()=>__features.riderJourney.snapshot());report.historical=migrated;
  check(migrated.chapters[0].status==='ready'&&migrated.chapters.every(c=>c.goals.every(g=>g.done))&&!migrated.claimedCount,'Historical rescue, herd and Rush records retroactively satisfy real goals');
  // Exercise the existing rescue result renderer with a persisted-history fixture,
  // without replaying or paying another rescue merely to inspect its mobile layout.
  await page.evaluate(()=>__features.run('rescueFinish',{id:'clover',name:'Bring Clover Home',runId:'history-result-layout',time:80,pay:{c:180,xp:60},firstCompletion:true,canAdopt:true}));
  await page.locator('#rideHubPanel').waitFor({state:'visible',timeout:10000});
  for(const width of [390,320]){
   await page.setViewportSize({width,height:844});const layout=await page.locator('#rideHubPanel').evaluate(e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,scroll:e.scrollWidth,width:e.clientWidth,buttons:[...e.querySelectorAll('button')].filter(b=>b.offsetParent).map(b=>{const r=b.getBoundingClientRect();return {left:r.left,right:r.right,height:r.height};}),adopt:!!e.querySelector('[data-fx="adventure:adopt"]'),journey:!!e.querySelector('.journey-strip')};});
   check(layout.adopt&&layout.journey&&layout.left>=0&&layout.right<=width+1&&layout.scroll<=layout.width+1&&layout.buttons.every(b=>b.left>=0&&b.right<=width+1&&b.height>=40),'Rescue adoption and Journey summary fit '+width+'px',layout);await shot(page,'rescue-summary-'+width);
  }await page.setViewportSize({width:1280,height:850});await page.evaluate(()=>{__features.hidePanels();__features.seFrame?.settle();});
  const storage=await page.evaluate(()=>{
   const G=__features,b=__qaState(),original=Storage.prototype.setItem;let result;
   Storage.prototype.setItem=function(key,value){if(key===G.save.KEY)throw new DOMException('QA quota fixture','QuotaExceededError');return original.call(this,key,value);};
   try{result=G.riderJourney.claim('first-partners');}finally{Storage.prototype.setItem=original;}
   return {result,b,a:__qaState()};
  });
  check(!storage.result&&storage.a.coins===storage.b.coins&&storage.a.tack.length===storage.b.tack.length&&storage.a.journey.chapters[0].status==='ready','Failed save write cannot report a successful claim or grant tack');
  await page.evaluate(()=>__features.ui.dispatch('journey:open'));await page.locator('#riderJourneyPanel').waitFor({state:'visible'});
  await shot(page,'journey-ready');
  for(const [width,height] of [[390,844],[320,844],[667,375]]){
   await page.setViewportSize({width,height});const layout=await page.locator('#riderJourneyPanel').evaluate(e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,scroll:e.scrollWidth,width:e.clientWidth,buttons:[...e.querySelectorAll('button')].filter(b=>b.offsetParent).map(b=>{const r=b.getBoundingClientRect();return {left:r.left,right:r.right,height:r.height};})};});
   check(layout.left>=0&&layout.right<=width+1&&layout.scroll<=layout.width+1&&layout.buttons.every(b=>b.left>=0&&b.right<=width+1&&b.height>=40),'Journey panel buttons fit '+width+'×'+height,layout);await shot(page,'journey-'+width);
  }await page.setViewportSize({width:1280,height:850});
  for(let i=0;i<chapters.length;i++){
   const id=chapters[i],r=rewards[i],before=await page.evaluate(()=>__qaState());
   check(before.journey.chapters[i].status==='ready',id+' becomes claimable in order');
   await page.locator('[data-fx="journey:claim:'+id+'"]').click();
   const claimed=await page.evaluate(id=>{const G=__features,first=__qaState(),duplicate=G.riderJourney.claim(id);return {first,duplicate,after:__qaState()};},id);
   const item=claimed.first.tack.find(t=>t.id==='journey-'+id);
   check(item&&item.slot===r.slot&&item.set===r.set&&item.rarity===r.rarity&&(!['saddle','bridle'].includes(r.slot)||item.style==='western')&&claimed.first.coins===before.coins+r.coins&&claimed.first.tack.length===before.tack.length+1,id+' awards its exact promised coins and tack',item);
   check(!claimed.duplicate&&claimed.after.coins===claimed.first.coins&&claimed.after.tack.length===claimed.first.tack.length&&claimed.after.journey.claimedCount===i+1,id+' cannot be claimed twice');
   check(JSON.stringify(claimed.first.gear)===JSON.stringify(before.gear),id+' leaves equipped tack unchanged');
   if(i===0)await shot(page,'journey-claimed');
  }
  const done=await page.evaluate(()=>__qaState());check(done.journey.complete&&done.journey.claimedCount===5,'All five claimed chapters complete the Journey');await shot(page,'journey-complete');
  const equipped=await page.evaluate(()=>{
   const G=__features;G.save.sync(s=>{if(s.horses.length<2)G.horse.grantHorse(s,'bay',{name:'QA tack selection',stats:{speed:3,stamina:3,jump:3,accel:3,agility:3}});});
   const riddenId=G.horse.ridden().id,other=G.save.fresh().horses.findIndex(h=>h.id!==riddenId);G.ranch.tackFor=other;
   const before=__qaState(),statsBefore=G.xp.effStats(G.horse.ridden()),ok=G.riderJourney.equip('first-partners');
   return {riddenId,other,before,ok,after:__qaState(),statsBefore,statsAfter:G.xp.effStats(G.horse.ridden())};
  });report.equipped=equipped;
  check(equipped.ok&&equipped.after.gear.find(h=>h.id===equipped.riddenId).gear.pad==='journey-first-partners'&&JSON.stringify(equipped.after.gear[equipped.other])===JSON.stringify(equipped.before.gear[equipped.other]),'Equip reward targets the ridden horse despite another tack selection');
  check(equipped.statsAfter.jump>equipped.statsBefore.jump||equipped.statsAfter.stamina>equipped.statsBefore.stamina,'Equipped Journey tack improves actual horse stats');
  await page.evaluate(()=>__features.ui.dispatch('journey:open'));await shot(page,'journey-equipped');
  const locker=await page.evaluate(()=>{const G=__features;G.ranch.tackFor=G.horse.rideIdx();G.ranchSys.tackAct('on:journey-steady-hands');const wore=G.save.fresh().horses[G.horse.rideIdx()].gear.bridle;G.ranchSys.tackAct('off:bridle');G.save.sync(s=>{s.coins+=2000;s.items.kit1=(s.items.kit1||0)+2;});G.ranchSys.tackAct('up:journey-first-partners');return {wore,level:G.save.fresh().tack.find(t=>t.id==='journey-first-partners')?.lvl};});
  check(locker.wore==='journey-steady-hands'&&locker.level===2,'Ordinary tack locker equips and upgrades earned Journey items',locker);
  const sold=await page.evaluate(()=>{const G=__features;G.ranchSys.tackAct('sell:journey-steady-hands');const b=__qaState(),claim=G.riderJourney.claim('steady-hands');return {b,claim,a:__qaState()};});
  check(!sold.b.tack.some(t=>t.id==='journey-steady-hands')&&!sold.claim&&sold.a.coins===sold.b.coins&&sold.a.journey.chapters[1].status==='claimed','Selling reward tack does not reopen its claimed chapter');
  await boot(page);const saved=await page.evaluate(()=>__qaState());check(saved.journey.complete&&saved.journey.claimedCount===5&&!saved.tack.some(t=>t.id==='journey-steady-hands'),'Claim ledger and sold-item state survive reload');
  await incompatibleGhost(page);
  check(report.errors.length===0&&await page.evaluate(()=>!__features.errors.length),'No browser or feature errors');
 }finally{clearTimeout(watchdog);fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

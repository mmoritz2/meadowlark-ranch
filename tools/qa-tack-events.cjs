/* Exercise equipped-stat event entry through real tack actions in a disposable save.
 * Level/qualification gates and earned ribbons remain independent of equipment. */
const QA=require('./qa-platform.cjs'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const output=path.join(__dirname,'../review/tack-events');
(async()=>{
 const browser=await QA.chromium.launch({headless:true,args:QA.gpuArgs()}),page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[],report={};
 page.on('pageerror',e=>errors.push(e.message));
 const ready=()=>page.waitForFunction(()=>window.__features?.events2&&__features.course.eventOk&&__features.xp.statBreakdown&&__features.horse.RIG().ready&&!__features.horse.RIG().loadingBreed,null,{timeout:150000});
 const state=()=>page.evaluate(()=>{
  const G=__features,h=G.horse.ridden(),s=G.save.fresh(),ev=id=>G.tables.EVENTS3.find(e=>e.id===id),stats=G.xp.statBreakdown(h);
  G.events2.openCard('x2');const card=document.getElementById('ev2CardPanel').innerText.replace(/\s+/g,' ');G.hidePanels();
  return {base:{...h.stats},gear:{...h.gear},savedGear:s.horses[G.horse.rideIdx()].gear,level:h.level,stats,a2:G.course.eventOk(ev('a2'),h),x2:G.course.eventOk(ev('x2'),h),requirements:G.events2.reqLine(ev('x2'),h),ladderLock:G.ladder.entryLock(ev('x2'),s,h),card,item:s.tack.find(t=>t.id==='qa-event-pad'),coins:s.coins,kit1:s.items.kit1,ribbons:s.ribbons||{},trophies:s.trophies||{}};
 });
 const action=async command=>{await page.evaluate(()=>{const G=__features;if(G.ranch)G.ranch.tackFor=G.horse.rideIdx();G.ui.openShop('tack');});await page.evaluate(command=>{const button=document.querySelector('[data-tk="'+command+'"]');if(!button)throw Error('Missing tack action '+command);button.click();},command);};
 const jumpCost=()=>page.evaluate(()=>{
  const G=__features,p=G.horse.player,r=G.horse.RIG(),R=G.course.rideState,prior={age:r.heroJumpAge,last:R.lastJumpAge,stam:p.stam,flying:p.flying};
  p.stam=.8;p.flying=false;r.heroJumpAge=0;R.lastJumpAge=null;G.run('tick',0,0);const cost=.8-p.stam;
  r.heroJumpAge=prior.age;R.lastJumpAge=prior.last;p.stam=prior.stam;p.flying=prior.flying;return cost;
 });
 try{
  await page.goto(QA.BASE+'/ranch3d.html?qa=tack-events&v=tack-stats-1',{timeout:120000});await ready();
  await page.evaluate(()=>{
   const G=__features;advanceTime(0);G.hidePanels();G.course.cancelCourse();
   G.save.sync(s=>{s.rider=s.rider||{};s.rider.made=true;const h=s.horses[G.horse.rideIdx()];h.level=10;h.stats={speed:6,stamina:4,jump:6,accel:6,agility:6};h.gear={};s.coins=50000;s.items={...(s.items||{}),kit1:10,kit2:10,kit3:10};s.tack=[{id:'qa-event-pad',slot:'pad',rarity:'Rare',name:'Enduring QA Pad',bonus:{stamina:2},primary:'stamina',secondary:null,lvl:1,merged:0}];});
   G.wardrobe?.closeChar();G.horse.reloadHorses();G.horse.refreshTack();
  });
  report.before=await state();report.jumpCostBefore=await jumpCost();assert(!report.before.a2.ok&&!report.before.x2.ok,'Bare trained stats leave both stamina requirements locked');
  await action('on:qa-event-pad');report.equipped=await state();report.jumpCostEquipped=await jumpCost();
  assert(report.equipped.a2.ok&&!report.equipped.x2.ok,'Equipping +2 stamina unlocks the first event but not the higher requirement');
  assert.equal(report.equipped.stats.total.stamina,6);assert(/4 trained \+ 2 tack/.test(report.equipped.requirements),'Entry line explains trained + equipped total');
  report.upgrades=[];
  for(let i=0;i<2&&!report.upgrades.at(-1)?.x2.ok;i++){await action('up:qa-event-pad');report.upgrades.push(await state());}
  report.upgraded=report.upgrades.at(-1);report.jumpCostUpgraded=await jumpCost();
  assert(report.upgraded.x2.ok&&!report.upgraded.ladderLock,'Upgraded equipped stamina unlocks the higher event and its ladder entry');
  assert(report.upgraded.stats.total.stamina>report.equipped.stats.total.stamina&&report.upgraded.coins<report.equipped.coins&&report.upgraded.kit1<report.equipped.kit1,'Real upgrade spends resources and increases event stats');
  assert(/Your horse \+ equipped tack/.test(report.upgraded.card)&&/equipped tack/.test(report.upgraded.card)&&/Ride the round to earn its ribbons/.test(report.upgraded.card),'Card describes relevant equipped benefits and earned outcomes');
  assert(/✅.*Stamina 7/.test(report.upgraded.requirements),'Requirements show the newly satisfied stamina gate');
  report.eventUi=await page.evaluate(async()=>{
   const G=__features;G.ui.openEvents();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));G.events2.fixRows();
   const row=[...document.querySelectorAll('#eventsPanel .c2-ev')].find(r=>r.textContent.includes('Hollowpeak Ridge Chase'));
   const chip=row&&[...row.querySelectorAll('.c2-spec')].find(e=>e.textContent.includes('Stamina'));
   G.seEvents.openPage('x2');const badge=[...document.querySelectorAll('#sevPage .pb-req span')].find(e=>e.textContent.includes('Stamina'));
   const result={chip:chip?.textContent,barWidth:chip?.querySelector('.c2-reqBar i')?.style.width,badge:badge?.textContent,badgeReady:badge?.classList.contains('ok'),badgeTitle:badge?.title};G.hidePanels();return result;
  });
  assert(/7 total/.test(report.eventUi.chip)&&/4 trained \+ 3 tack/.test(report.eventUi.chip)&&/Training cap/.test(report.eventUi.chip),'Programme chips show equipped total and trained/tack breakdown separately from training cap');assert(report.eventUi.badgeReady&&/7 including equipped tack/.test(report.eventUi.badgeTitle),'Main event detail badge uses the same equipped total');
  await page.evaluate(()=>__features.events2.openCard('x2'));await page.locator('#ev2CardPanel').getByText('Your horse + equipped tack').scrollIntoViewIfNeeded();fs.mkdirSync(output,{recursive:true});await page.locator('#ev2CardPanel').screenshot({path:path.join(output,'event-card-equipped.png')});await page.evaluate(()=>__features.hidePanels());
  assert(Math.abs(report.jumpCostEquipped-.08)<1e-7&&Math.abs(report.jumpCostUpgraded-.05)<1e-7,'Equipped stamina crosses the real jump-cost threshold');
  report.locks=await page.evaluate(()=>{
   const G=__features,h=G.horse.ridden(),s=G.save.fresh(),ev=G.tables.EVENTS3.find(e=>e.id==='x2');
   const low={...h,level:6},elite={...h,level:7},champ=G.tables.EVENTS3.find(e=>e.champ),qualifiedStats={...h,level:20,stats:{speed:10,stamina:10,jump:10,accel:10,agility:10}};
   return {level:G.course.eventOk(ev,low),elite:G.ladder.entryLock(ev,{...s,evDiff:2},elite),champion:champ?G.ladder.entryLock(champ,s,qualifiedStats):null};
  });
  assert(!report.locks.level.ok&&report.locks.level.missing.some(m=>m[0]==='level'),'Tack does not bypass horse level');assert(report.locks.elite&&/Lv 9/.test(report.locks.elite),'Elite keeps its extra level gate');assert(report.locks.champion,'Final qualification remains required');
  report.judging=await page.evaluate(()=>{
   const G=__features,p=G.horse.player,r=G.horse.RIG(),ev=id=>G.tables.EVENTS3.find(e=>e.id===id);
   G.course.startDressage(ev('d1'));let c=G.course.get();c.done=false;c.fi=0;c.figs=[{at:'C',gait:'trot',text:'Trot test',good:0,total:0,sweep:0,lastAng:null,holdT:0,score:null}];c.ce.diff=G.course.DIFFS.find(d=>d.k==='elite');
   r.heroMotion.set('trot');p.speed=10;const gait=G.course.riddenGait();G.run('courseTick',c,.1,0);const elitePenalty=c.figs[0].total;
   G.course.cancelCourse();G.course.startDressage(ev('s3'));c=G.course.get();c.done=false;c.fi=0;c.figs=[{at:'C',gait:'trot',text:'Show trot test',good:0,total:0,sweep:0,lastAng:null,holdT:0,score:null}];c.ce.diff=G.course.DIFFS.find(d=>d.k==='open');
   r.heroMotion.set('trot');p.speed=10;const before=G.events2.state.show.rush;G.run('courseTick',c,.1,0);const rushAdded=G.events2.state.show.rush-before;
   G.course.cancelCourse();r.heroMotion.set('stand');p.speed=0;return {gait,elitePenalty,rushAdded};
  });
  assert.equal(report.judging.gait,'trot');assert.equal(report.judging.elitePenalty,0,'Faster native trot receives no wrong-gait penalty');assert.equal(report.judging.rushAdded,0,'Faster native trot receives no showmanship rush penalty');
  await action('off:pad');report.unequipped=await state();report.jumpCostUnequipped=await jumpCost();
  assert(!report.unequipped.a2.ok&&!report.unequipped.x2.ok,'Taking tack off restores the original entry locks');assert.equal(report.unequipped.stats.total.stamina,4);assert(Math.abs(report.jumpCostUnequipped-.08)<1e-7);
  await action('on:qa-event-pad');const beforeReload=await state();
  await page.reload({timeout:120000});await ready();await page.evaluate(()=>{advanceTime(0);__features.wardrobe?.closeChar();});report.reloaded=await state();
  assert(report.reloaded.x2.ok&&!report.reloaded.ladderLock&&report.reloaded.stats.total.stamina===beforeReload.stats.total.stamina,'Equipped upgraded totals and readiness persist through a page reload');
  for(const s of [report.equipped,...report.upgrades,report.unequipped,report.reloaded]){assert.deepEqual(s.base,report.before.base,'Tack never rewrites trained stats');assert.equal(s.level,report.before.level);assert.deepEqual(s.ribbons,report.before.ribbons,'Equipment earns no ribbons automatically');assert.deepEqual(s.trophies,report.before.trophies,'Equipment earns no trophies automatically');}
  assert.equal(errors.length,0,errors.join('\n'));report.passed=true;console.log(JSON.stringify({passed:true,stamina:[report.before.stats.total.stamina,report.equipped.stats.total.stamina,report.upgraded.stats.total.stamina,report.unequipped.stats.total.stamina,report.reloaded.stats.total.stamina],jumpCosts:[report.jumpCostEquipped,report.jumpCostUpgraded],locks:report.locks},null,2));
 }finally{fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,'event-readiness.json'),JSON.stringify({...report,errors},null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

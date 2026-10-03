/* Fractional tack upgrade and Horse Overview UI integration.
 * Uses an isolated browser save, real equip/upgrade actions and a reload.
 * QA_URL/QA_PORT select the local game; optional QA_OUT selects screenshots/report. */
const QA=require('./qa-platform.cjs'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const output=path.resolve(process.env.QA_OUT||path.join(__dirname,'../review/tack-stat-ui'));
const ready=()=>window.__features?.seCare&&window.__features?.xp?.statBreakdown&&window.__features.horse.RIG().ready;
(async()=>{
 const browser=await QA.chromium.launch({headless:true,args:QA.gpuArgs()});
 const page=await browser.newPage({viewport:{width:1280,height:850}}),errors=[],report={errors};
 page.on('pageerror',e=>errors.push(e.message));
 try{
  fs.mkdirSync(output,{recursive:true});
  await page.goto(QA.BASE+'/ranch3d.html?qa=tack-stat-ui',{timeout:120000});
  await page.waitForFunction(ready,null,{timeout:120000});
  const seed=await page.evaluate(()=>{
   const G=__features,ri=G.horse.rideIdx();G.ranch.tackFor=ri;let ids=[],spare;
   G.save.sync(s=>{
    s.coins=10000;s.items.kit1=3;s.horses[ri].gear={};s.rider.made=true;
    for(const k of G.tables.STAT_KEYS)s.horses[ri].stats[k]=3;
    for(const slot of ['saddle','pad']){const it=G.horse.genGear('Legendary',slot,{set:'Kestrel'});s.tack.push(it);ids.push(it.id);}
    const it=G.horse.genGear('Common','saddle');s.tack.push(it);spare=it.id;
   });
   G.wardrobe.closeChar();G.hidePanels();G.horse.refreshTack();
   for(const id of ids)G.ranchSys.tackAct('on:'+id);
   const s=G.save.fresh(),h=s.horses[ri];
   return {ids,spare,ri,before:G.xp.statBreakdown(h,s.tack),coins:s.coins,kits:s.items.kit1};
  });
  report.locker=await page.evaluate(({ids,spare})=>{
   const row=id=>document.querySelector('[data-tk="'+id+'"]').closest('.evrow');
   const summary=document.querySelector('[data-tack-stat-summary]');
   return {summary:[...summary.querySelectorAll('tbody tr')].map(e=>[...e.querySelectorAll('td')].map(c=>Number(c.textContent))),
    summaryIsProductCard:summary.classList.contains('s2-row')||!!summary.querySelector('.s2-glyph'),
    upgrade:row('up:'+ids[0]).querySelector('[data-tack-upgrade]').textContent,comparison:row('on:'+spare).querySelector('[data-tack-compare]').textContent};
  },seed);
  assert.deepEqual(report.locker.summary,['speed','stamina','jump','accel','agility'].map(k=>[seed.before.base[k],seed.before.tack[k],seed.before.total[k]]));
  assert.equal(report.locker.summaryIsProductCard,false,'stat summary remains a readable full-width table');
  assert.match(report.locker.upgrade,/\+0\.5 Speed, \+0\.25 Acceleration/);
  assert.match(report.locker.comparison,/Equipping: .*Speed -.*includes set changes/);
  await page.locator('[data-tack-stat-summary]').scrollIntoViewIfNeeded();
  await page.screenshot({path:path.join(output,'tack-locker-desktop.png')});
  const upgrade=page.locator('[data-tk="up:'+seed.ids[0]+'"]');
  assert.equal(await upgrade.count(),1,'equipped item has one upgrade action');
  await upgrade.click();
  report.upgrade=await page.evaluate(({ids,ri})=>{
   const G=__features,s=G.save.fresh(),h=s.horses[ri];G.seCare.open('horse');
   return {lvl:s.tack.find(t=>t.id===ids[0]).lvl,coins:s.coins,kits:s.items.kit1,stats:G.xp.statBreakdown(h,s.tack)};
  },seed);
  assert.equal(report.upgrade.lvl,2);
  assert.equal(report.upgrade.stats.total.speed-seed.before.total.speed,.5,'Lv2 speed gain');
  assert.equal(report.upgrade.stats.total.accel-seed.before.total.accel,.25,'Lv2 second-stat gain');
  assert.equal(report.upgrade.kits,seed.kits-1);
  assert.ok(report.upgrade.coins<seed.coins);
  const overview=async()=>page.evaluate(()=>[...document.querySelectorAll('#seOv .sv-stat')].map(e=>({
   key:e.dataset.stat,total:Number(e.querySelector('.v').textContent),equation:e.querySelector('.eq').textContent,
   cap:e.querySelector('.mx').textContent,label:e.getAttribute('aria-label'),text:e.textContent
  })));
  report.overview=await overview();
  assert.equal(report.overview.length,5);
  for(const row of report.overview){
   const b=report.upgrade.stats;
   assert.equal(row.total,b.total[row.key],row.key+' overview total');
   assert.ok(row.equation.includes('Base '+b.base[row.key]+' + '+b.tack[row.key]+' tack'));
   assert.ok(row.cap.startsWith('Training cap '));
  }
  await page.screenshot({path:path.join(output,'horse-overview-desktop.png')});
  await page.locator('[data-se="tab:equipment"]').click();
  report.equipment=await page.evaluate(()=>({
   rows:[...document.querySelectorAll('#seOv .sv-stat-table tbody tr')].map(e=>({key:e.dataset.stat,values:[...e.querySelectorAll('td')].map(c=>Number(c.textContent))})),
   text:document.getElementById('seOvBody').textContent
  }));
  for(const row of report.equipment.rows){const b=report.upgrade.stats;assert.deepEqual(row.values,[b.base[row.key],b.tack[row.key],b.total[row.key]]);}
  assert.ok(report.equipment.text.includes('matching-set bonuses:'),'active set explained');
  await page.screenshot({path:path.join(output,'equipment-desktop.png')});
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>__features.seCare.render());
  report.phone=await page.evaluate(()=>{
   const p=document.getElementById('seOvBody'),t=p.querySelector('table');
   return {client:p.clientWidth,scroll:p.scrollWidth,table:t.getBoundingClientRect().width,headers:[...t.querySelectorAll('thead th')].map(e=>e.textContent)};
  });
  assert.ok(report.phone.scroll<=report.phone.client+1,'phone equipment has no horizontal overflow');
  await page.screenshot({path:path.join(output,'equipment-phone.png')});
  await page.locator('[data-se="tab:horse"]').click();
  report.phoneOverview=await overview();
  assert.deepEqual(report.phoneOverview,report.overview,'phone keeps complete fractional stat content');
  await page.screenshot({path:path.join(output,'horse-overview-phone.png')});
  await page.evaluate(()=>{__features.seCare.close();__features.ranchSys.tackAct('off:saddle');});
  report.unequipped=await page.evaluate(()=>{
   const G=__features,s=G.save.fresh(),h=s.horses[G.horse.rideIdx()];G.seCare.open('equipment');
   return G.xp.statBreakdown(h,s.tack);
  });
  assert.equal(report.unequipped.sets.speed,0,'removing second piece removes set bonus');
  assert.ok(report.unequipped.total.speed<report.upgrade.stats.total.speed);
  await page.evaluate(id=>{__features.seCare.close();__features.ranchSys.tackAct('on:'+id);},seed.ids[0]);
  await page.reload({waitUntil:'load',timeout:120000});
  await page.waitForFunction(ready,null,{timeout:120000});
  report.reloaded=await page.evaluate(({ids,ri})=>{
   const G=__features,s=G.save.fresh(),h=s.horses[ri];G.seCare.open('horse');
   return {lvl:s.tack.find(t=>t.id===ids[0]).lvl,gear:h.gear,stats:G.xp.statBreakdown(h,s.tack)};
  },seed);
  assert.equal(report.reloaded.lvl,2);
  assert.equal(report.reloaded.gear.saddle,seed.ids[0]);
  assert.deepEqual(report.reloaded.stats,report.upgrade.stats,'equipped upgrade survives reload');
  assert.deepEqual(await overview(),report.overview,'fractional overview survives reload');
  report.errors=errors;assert.deepEqual(errors,[]);
  report.pass=true;console.log(JSON.stringify({pass:true,upgrade:report.upgrade,phone:report.phone}));
 }catch(error){report.pass=false;report.error=error.stack;throw error;}
 finally{fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

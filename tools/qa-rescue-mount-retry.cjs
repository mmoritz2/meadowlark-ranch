/* Focused integrated follow-up: finish on one horse, switch mounts while saving
   is pending, try the real Market sale handler, then save and inspect both horses.
   Only setup adds a second owned horse. The rescue uses continuous player-only
   steps, never edits Clover, and never injects objectives, rewards or progress.
   QA_PORT=8597 PLAYWRIGHT_PATH=/path/to/playwright node tools/qa-rescue-mount-retry.cjs */
const QA=require('./qa-platform.cjs'),fs=require('node:fs'),assert=require('node:assert/strict');
const out=process.env.QA_OUT||'/private/tmp/meadowlark-rescue-mount-retry',report={checks:[],errors:[],navigation:[]};
const check=(ok,label,detail)=>{assert.ok(ok,label+(detail?' — '+JSON.stringify(detail):''));report.checks.push(label);console.log('PASS '+label);};
let browser;const watchdog=setTimeout(()=>{browser?.close().finally(()=>process.exit(3));},420000);watchdog.unref();
const totalXp=h=>(h.xp||0)+Array.from({length:Math.max(0,(h.level||1)-1)},(_,i)=>50+(i+1)*50).reduce((a,b)=>a+b,0);
(async()=>{
 fs.mkdirSync(out,{recursive:true});browser=await QA.chromium.launch({headless:true,args:QA.gpuArgs()});
 const context=await browser.newContext({viewport:{width:1280,height:850},serviceWorkers:'block'});await context.routeWebSocket('**',ws=>ws.close());
 const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!/WebSocket|net::ERR|Failed to load resource/i.test(m.text()))report.errors.push(m.text());});page.on('dialog',d=>d.dismiss());
 page.on('framenavigated',frame=>{if(frame===page.mainFrame())report.navigation.push(frame.url());});page.on('crash',()=>report.errors.push('Chromium page crashed'));
 try{
  await page.goto(QA.BASE+'/ranch3d.html?qa=rescue-mount-retry&emoji=0',{timeout:120000});
  await page.waitForFunction(()=>window.__features?.rescueRide?.pendingHorseId&&!document.getElementById('load'),null,{timeout:150000});
  await page.evaluate(()=>{
   const G=__features;window.__rescueScenery={done:false,error:null};
   Promise.all([G.undergrowth.ready,G.photoscans.ready,G.worldDetails.ready,G.world.ranchBuilderArt.ready]).then(()=>{__rescueScenery.done=true;},e=>{__rescueScenery.error=String(e);});
  });
  await page.waitForFunction(()=>window.__rescueScenery?.done||window.__rescueScenery?.error,null,{timeout:150000});
  const scenery=await page.evaluate(()=>{
   const G=__features;if(__rescueScenery.error)throw Error(__rescueScenery.error);
   return {undergrowth:G.undergrowth.stats,builderModels:G.world.ranchBuilderArt.models.length,builderLoaded:G.world.ranchBuilderArt.loaded,errors:[...G.errors,...G.undergrowth.errors,...G.photoscans.errors,...G.worldDetails.errors,...G.world.ranchBuilderArt.errors]};
  });report.scenery=scenery;
  check(scenery.undergrowth.ready&&scenery.builderLoaded&&scenery.builderModels===10&&!scenery.errors.length,'Integrated woodland, photoscans, world details and all ten builder models are ready before riding',scenery);
  await page.evaluate(()=>{
   const G=__features;advanceTime(0);G.save.sync(s=>{s.rider.made=true;G.horse.grantHorse(s,'pinto',{name:'QA second mount',src:'qa',noName:true});});G.horse.reloadHorses();G.wardrobe.closeChar();G.hidePanels();G.seFrame?.settle();G.audio.setMuted(true);G.riding.releaseAll();document.activeElement?.blur();
   window.__step=ms=>{const render=G.renderer.render;G.renderer.render=function(scene,camera,...rest){if(camera!==G.camera)return render.call(this,scene,camera,...rest);};try{advanceTime(ms);}finally{G.renderer.render=render;}};
   window.__idle=ms=>{G.horse.player.speed=0;G.riding.releaseAll();__step(ms);};
   window.__move=(x,z)=>{const p=G.horse.player;for(let i=0;Math.hypot(x-p.pos.x,z-p.pos.z)>.5;i++){
    if(i>4000)throw Error('Player movement stalled');const dx=x-p.pos.x,dz=z-p.pos.z,d=Math.hypot(dx,dz),step=Math.min(.08,d);p.heading=Math.atan2(dx,dz);p.speed=1;p.pos.x+=dx/d*step;p.pos.z+=dz/d*step;__step(20);
   }__idle(100);};
   const original=Storage.prototype.setItem;window.__failWrite=false;Storage.prototype.setItem=function(key,value){if(key===G.save.KEY&&__failWrite)throw new DOMException('QA quota fixture','QuotaExceededError');return original.call(this,key,value);};
   window.__finishes=[];G.on('rescueFinish',r=>__finishes.push(r));window.__notices=[];const toast=G.toast;G.toast=(...args)=>{__notices.push(args);toast(...args);};
   window.__state=()=>{const saved=G.save.fresh();return {saved:{coins:saved.coins,horses:saved.horses.map(h=>({id:h.id,level:h.level,xp:h.xp,stats:h.stats})),rescue:saved.rescueRides},live:G.horse.myHorses.map(h=>({id:h.id,level:h.level,xp:h.xp,stats:h.stats})),riddenId:G.horse.ridden().id,pendingId:G.rescueRide.pendingHorseId(),active:G.rescueRide.snapshot().active,finishes:__finishes.length};};
   __idle(1400);
  });
  await page.waitForFunction(()=>__features.horse.RIG().ready&&!__features.horse.RIG().loadingBreed,null,{timeout:90000});await page.evaluate(()=>__idle(1200));
  check(await page.evaluate(()=>!__features.errors.length&&__features.rescueRide.start()),'Integrated game starts a real rescue with two owned horses');
  const image=await page.evaluate(()=>{__idle(500);advanceTime(0);return __features.renderer.domElement.toDataURL('image/png').split(',')[1];});fs.writeFileSync(out+'/integrated-pasture-world.png',Buffer.from(image,'base64'));
  await page.evaluate(()=>{for(let i=0;i<2;i++){const a=__features.rescueRide.snapshot().active;__move(a.target.x,a.target.z);}const a=__features.rescueRide.snapshot().active;__move(a.target.x-3,a.target.z);__idle(1200);});
  check(await page.evaluate(()=>__features.rescueRide.reassure()),'Physical clues and reassurance begin the actual escort');
  const pending=await page.evaluate(()=>{
   const G=__features,p=G.horse.player;let before=null;
   for(let i=0;i<15000;i++){
    const a=G.rescueRide.snapshot().active;if(!a)throw Error('Rescue finished before fault injection');if(a.savePending)break;
    if(a.returnStep===2&&!before){before=__state();__failWrite=true;}
    const dx=a.target.x-p.pos.x,dz=a.target.z-p.pos.z,d=Math.hypot(dx,dz);
    if(a.horse.distance<12&&d>1){const step=Math.min(.075,d);p.heading=Math.atan2(dx,dz);p.speed=2;p.pos.x+=dx/d*step;p.pos.z+=dz/d*step;}else p.speed=0;__step(20);
   }__idle(200);return {before,after:__state()};
  });report.pending=pending;const originalId=pending.before.riddenId,otherId=pending.before.saved.horses.find(h=>h.id!==originalId).id;
  check(pending.after.active?.savePending&&pending.after.pendingId===originalId&&pending.after.finishes===0,'Failed finish exposes its original horse ID and retains pending completion');
  const sale=await page.evaluate(({originalId,otherId})=>{
   const G=__features;__failWrite=false;const select=document.getElementById('horseSel');select.value=String(G.horse.myHorses.findIndex(h=>h.id===otherId));select.dispatchEvent(new Event('change',{bubbles:true}));
   G.ui.openShop('market');G.seFrame?.settle();const idx=G.save.fresh().horses.findIndex(h=>h.id===originalId),button=document.querySelector('[data-mktsell="'+idx+'"]');
   if(!button)throw Error('Original horse sale row missing');const before=__state(),disabled=button.disabled,label=button.textContent,title=button.title;button.onclick();return {before,after:__state(),disabled,label,title,notices:__notices};
  },{originalId,otherId});report.saleGuard=sale;
  check(sale.after.riddenId===otherId&&sale.disabled&&/Retry rescue save/.test(sale.label)&&/completed rescue/.test(sale.title),'Switching mounts preserves a disabled, explained sale action for the finishing horse');
  check(sale.after.saved.horses.some(h=>h.id===originalId)&&sale.after.saved.coins===sale.before.saved.coins&&JSON.stringify(sale.after.saved)===JSON.stringify(sale.before.saved),'Calling the disabled sale handler directly is also rejected by the core guard');
  await page.evaluate(()=>{__features.hidePanels();__features.seFrame?.settle();__idle(200);});
  await page.waitForFunction(()=>__features.horse.RIG().ready&&!__features.horse.RIG().loadingBreed,null,{timeout:90000});
  await page.locator('#rescueRetrySave').click();await page.locator('#rideHubPanel').waitFor({state:'visible',timeout:10000});
  const saved=await page.evaluate(()=>__state());report.confirmed=saved;
  const originalBefore=pending.before.saved.horses.find(h=>h.id===originalId),originalSaved=saved.saved.horses.find(h=>h.id===originalId),originalLive=saved.live.find(h=>h.id===originalId);
  check(saved.riddenId===otherId&&saved.pendingId===null&&!saved.active&&saved.finishes===1&&saved.saved.coins===pending.before.saved.coins+180,'Retry confirms exactly one reward after switching mounts and releases the sale guard');
  check(totalXp(originalSaved)-totalXp(originalBefore)===60&&JSON.stringify(originalLive)===JSON.stringify(originalSaved),'The original horse receives the saved XP, level and stats in its live stable entry');
  check(totalXp(saved.saved.horses.find(h=>h.id===otherId))===totalXp(pending.before.saved.horses.find(h=>h.id===otherId)),'The newly ridden horse does not receive the earlier rescue XP');
  const saleAfter=await page.evaluate(originalId=>{
   const G=__features;G.hidePanels();G.ui.openShop('market');G.seFrame?.settle();const idx=G.save.fresh().horses.findIndex(h=>h.id===originalId),button=document.querySelector('[data-mktsell="'+idx+'"]');
   if(!button)throw Error('Completed horse sale row missing');const enabled=!button.disabled;button.onclick();return {enabled,after:__state()};
  },originalId);report.saleAfter= saleAfter;
  check(saleAfter.enabled&&!saleAfter.after.saved.horses.some(h=>h.id===originalId)&&saleAfter.after.saved.coins>saved.saved.coins,'The normal Market sale works again after the rescue is durably saved');
  await page.evaluate(()=>advanceTime(0));await page.screenshot({path:out+'/confirmed-sale.png'});
  check(!report.errors.length&&await page.evaluate(()=>!__features.errors.length),'Integrated switched-mount flow has no browser or feature errors');
 }catch(e){report.failure=e.message;report.lastUrl=page.url();try{report.failedState=await page.evaluate(()=>{
  const G=window.__features;return {url:location.href,moduleRan:!!window.__gameModuleRan,features:!!G,scenery:window.__rescueScenery,loadVisible:!!document.getElementById('load'),horseReady:G?.horse?.RIG()?.ready,loadingBreed:G?.horse?.RIG()?.loadingBreed,
   undergrowthReady:G?.undergrowth?.stats?.ready,builderLoaded:G?.world?.ranchBuilderArt?.loaded,builderModelNames:(G?.world?.ranchBuilderArt?.models||[]).map(String),photoscanAssets:(G?.photoscans?.assets||[]).length,worldDetailsPlaced:(G?.worldDetails?.placed||[]).length,
   errors:[...(G?.errors||[]),...(G?.undergrowth?.errors||[]),...(G?.photoscans?.errors||[]),...(G?.worldDetails?.errors||[]),...(G?.world?.ranchBuilderArt?.errors||[])],resourcesLoaded:performance.getEntriesByType('resource').length,contextLost:G?.renderer?.getContext().isContextLost()};
 });await page.screenshot({path:out+'/failure.png',timeout:3000});}catch(_){}throw e;}
 finally{clearTimeout(watchdog);fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

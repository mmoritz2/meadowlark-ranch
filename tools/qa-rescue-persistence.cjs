/* Disposable offline acceptance test. Ride the real rescue using small player-only
   steps, then fail actual localStorage writes/reads at its finish and adoption.
   QA_PORT=8597 PLAYWRIGHT_PATH=/path/to/playwright node tools/qa-rescue-persistence.cjs */
const QA=require('./qa-platform.cjs'),fs=require('node:fs'),assert=require('node:assert/strict');
const out=process.env.QA_OUT||'/private/tmp/meadowlark-rescue-persistence';
const report={checks:[],errors:[],method:'Actual rescue controller, continuous player-only steps, real localStorage failure injection'};
const check=(ok,label,detail)=>{assert.ok(ok,label+(detail?' — '+JSON.stringify(detail):''));report.checks.push(label);console.log('PASS '+label);};
let browser;
const watchdog=setTimeout(()=>{console.error('Rescue persistence QA exceeded 8 minutes');browser?.close().finally(()=>process.exit(3));},480000);watchdog.unref();
async function boot(page){
 await page.goto(QA.BASE+'/ranch3d.html?qa=rescue-persistence&emoji=0',{timeout:120000});
 await page.waitForFunction(()=>window.__features?.rescueRide?.retrySave&&__features.rideHub&&!document.getElementById('load'),null,{timeout:150000});
 await page.evaluate(()=>{
  const G=__features;advanceTime(0);G.save.sync(s=>{s.rider.made=true;});G.wardrobe.closeChar();G.hidePanels();G.seFrame?.settle();G.audio.setMuted(true);G.riding.releaseAll();document.activeElement?.blur();
  window.__step=ms=>{const render=G.renderer.render;G.renderer.render=function(scene,camera,...rest){if(camera!==G.camera)return render.call(this,scene,camera,...rest);};try{advanceTime(ms);}finally{G.renderer.render=render;}};
  window.__idle=ms=>{G.horse.player.speed=0;G.riding.releaseAll();__step(ms);};
  window.__move=(x,z)=>{const p=G.horse.player;for(let i=0;Math.hypot(x-p.pos.x,z-p.pos.z)>.5;i++){
   if(i>4000)throw Error('Player movement stalled');const dx=x-p.pos.x,dz=z-p.pos.z,d=Math.hypot(dx,dz),step=Math.min(.08,d);p.heading=Math.atan2(dx,dz);p.speed=1;p.pos.x+=dx/d*step;p.pos.z+=dz/d*step;__step(20);
  }__idle(100);};
  window.__events={finishes:[],adoptions:[],notices:[]};G.on('rescueFinish',r=>__events.finishes.push(r));G.on('rescueAdopt',r=>__events.adoptions.push(r));
  const originalToast=G.toast;G.toast=(...args)=>{__events.notices.push(args);originalToast(...args);};
  const set=Storage.prototype.setItem,get=Storage.prototype.getItem;
  window.__failure={write:false,readAfterWrite:false,reads:0,attempts:0};
  Storage.prototype.setItem=function(key,value){if(key===G.save.KEY){__failure.attempts++;if(__failure.write)throw new DOMException('QA quota fixture','QuotaExceededError');}const result=set.call(this,key,value);if(key===G.save.KEY&&__failure.readAfterWrite)__failure.reads++;return result;};
  Storage.prototype.getItem=function(key){if(key===G.save.KEY&&__failure.reads>0){__failure.reads--;throw new DOMException('QA read fixture','SecurityError');}return get.call(this,key);};
  window.__snapshot=()=>{const save=G.save.fresh(),active=G.rescueRide.snapshot();return {rescue:active,coins:save.coins,horses:save.horses.map(h=>({id:h.id,rescueClover:h.rescueClover,level:h.level,xp:h.xp})),record:save.rescueRides,events:__events,actors:G.scene.children.filter(o=>o.name==='Clover rescue horse').length};};
  __idle(1400);
 });
 await page.waitForFunction(()=>__features.horse.RIG().ready&&!__features.horse.RIG().loadingBreed,null,{timeout:90000});
 await page.evaluate(()=>__idle(1200));
}
async function capture(page,name){await page.evaluate(()=>advanceTime(0));await page.screenshot({path:out+'/'+name+'.png'});}
(async()=>{
 fs.mkdirSync(out,{recursive:true});browser=await QA.chromium.launch({headless:true,args:QA.gpuArgs()});
 const context=await browser.newContext({viewport:{width:1280,height:850},serviceWorkers:'block'});await context.routeWebSocket('**',ws=>ws.close());
 const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!/WebSocket|net::ERR|Failed to load resource/i.test(m.text()))report.errors.push(m.text());});page.on('dialog',d=>d.dismiss());
 try{
  await boot(page);check(await page.evaluate(()=>!__features.errors.length),'All feature packages install');
  check(await page.evaluate(()=>__features.rescueRide.start()),'A real rescue starts');
  await page.evaluate(()=>{for(let i=0;i<2;i++){const a=__features.rescueRide.snapshot().active;__move(a.target.x,a.target.z);}const a=__features.rescueRide.snapshot().active;__move(a.target.x-3,a.target.z);__idle(1200);});
  check(await page.evaluate(()=>__features.rescueRide.reassure()),'Physical clues and patient approach allow reassurance');
  const pending=await page.evaluate(()=>{
   const G=__features,p=G.horse.player;let before=null;
   for(let i=0;i<15000;i++){
    const a=G.rescueRide.snapshot().active;if(!a)throw Error('Rescue finished before the fault was armed');if(a.savePending)break;
    if(a.returnStep===2&&!before){before=__snapshot();__failure.write=true;}
    const dx=a.target.x-p.pos.x,dz=a.target.z-p.pos.z,d=Math.hypot(dx,dz);
    if(a.horse.distance<12&&d>1){const step=Math.min(.075,d);p.heading=Math.atan2(dx,dz);p.speed=2;p.pos.x+=dx/d*step;p.pos.z+=dz/d*step;}else p.speed=0;
    __step(20);
   }
   __idle(200);return {before,after:__snapshot()};
  });report.failedFinish=pending;
  check(pending.after.rescue.active?.savePending&&pending.after.actors===1,'Failed finish preserves Clover and the completed mission');
  check(pending.after.coins===pending.before.coins&&JSON.stringify(pending.after.horses)===JSON.stringify(pending.before.horses)&&pending.after.record.completions===pending.before.record.completions&&!pending.after.events.finishes.length,'Failed finish grants no saved coins, XP, completion, or receipt');
  const frozen=await page.evaluate(()=>{const G=__features,b=G.rescueRide.snapshot().active;__idle(5000);const cancelled=G.rescueRide.cancel(),a=G.rescueRide.snapshot().active;return {b,a,cancelled};});
  check(!frozen.cancelled&&frozen.a.runId===frozen.b.runId&&frozen.a.elapsed===frozen.b.elapsed&&frozen.a.returnStep===3&&Number.isFinite(frozen.a.target.x),'Pending completion remains frozen with a safe home target');
  await page.locator('#rescueRetrySave').click();
  check(await page.evaluate(()=>__features.rescueRide.snapshot().active?.savePending&&!__events.finishes.length),'Explicit retry remains pending while storage fails');
  for(const [width,height] of [[390,844],[667,375]]){
   await page.setViewportSize({width,height});await page.evaluate(()=>__step(200));
   const box=await page.locator('#rescueHud').boundingBox(),button=await page.locator('#rescueRetrySave').boundingBox();
   check(box&&button&&box.x>=0&&box.x+box.width<=width+1&&box.y>=0&&box.y+box.height<=height+1&&button.height>=40,'Pending-save controls fit '+width+'×'+height,{box,button});await capture(page,'pending-'+width+'x'+height);
  }
  await page.setViewportSize({width:1280,height:850});await page.evaluate(()=>{__failure.write=false;});await page.locator('#rescueRetrySave').click();
  await page.locator('#rideHubPanel').waitFor({state:'visible',timeout:10000});
  const finished=await page.evaluate(()=>__snapshot());report.finished=finished;
  const totalXp=h=>(h.xp||0)+Array.from({length:Math.max(0,(h.level||1)-1)},(_,i)=>50+(i+1)*50).reduce((a,b)=>a+b,0);
  check(!finished.rescue.active&&finished.actors===0&&finished.events.finishes.length===1&&finished.coins===pending.before.coins+180&&finished.record.completions===pending.before.record.completions+1,'Retry saves the completion and purse exactly once, then disposes Clover');
  check(totalXp(finished.horses[0])-totalXp(pending.before.horses[0])===60&&finished.rescue.lastResult.time===frozen.a.elapsed,'Retry retains the original finish time and grants exactly 60 horse XP');
  const again=await page.evaluate(()=>({ok:__features.rescueRide.retrySave(),state:__snapshot()}));check(!again.ok&&again.state.coins===finished.coins&&again.state.events.finishes.length===1,'Repeated retry cannot pay or emit another finish');
  await page.evaluate(()=>{__failure.write=true;__events.notices=[];});await page.locator('[data-fx="adventure:adopt"]').click();
  const adoptionFailed=await page.evaluate(()=>__snapshot());
  check(adoptionFailed.horses.length===finished.horses.length&&!adoptionFailed.record.adopted&&!adoptionFailed.events.adoptions.length&&adoptionFailed.events.notices.every(args=>/could not be saved/.test(args[0])),'Failed adoption creates no horse or false acquisition notice');
  await page.evaluate(()=>{__failure.write=false;__failure.readAfterWrite=true;__events.notices=[];});await page.locator('[data-fx="adventure:adopt"]').click();
  const unconfirmed=await page.evaluate(()=>{__failure.readAfterWrite=false;return __snapshot();});
  check(unconfirmed.record.adopted&&unconfirmed.horses.filter(h=>h.rescueClover).length===1&&!unconfirmed.events.adoptions.length&&unconfirmed.events.notices.every(args=>/could not be saved/.test(args[0])),'A failed adoption read-back withholds success even when the write succeeded');
  await page.evaluate(()=>{const G=__features;G.hidePanels();G.seFrame?.settle();G.rideHub.open();});
  check(await page.locator('[data-fx="adventure:adopt"]').isVisible(),'Closing and reopening Activities preserves the unconfirmed adoption retry');
  await page.locator('[data-fx="adventure:adopt"]').click();
  const adopted=await page.evaluate(()=>({again:__features.rescueRide.adopt(),state:__snapshot()}));report.adopted=adopted;
  check(!adopted.again&&adopted.state.horses.filter(h=>h.rescueClover).length===1&&adopted.state.events.adoptions.length===1,'Retry confirms the existing adoption without granting a duplicate');
  await boot(page);const reloaded=await page.evaluate(()=>__snapshot());
  check(reloaded.record.adopted&&reloaded.horses.filter(h=>h.rescueClover).length===1&&reloaded.record.completions===finished.record.completions&&reloaded.record.bestTime===finished.record.bestTime,'Confirmed completion and one adoption survive reload');
  check(!report.errors.length&&await page.evaluate(()=>!__features.errors.length),'No browser or feature errors');
 }finally{clearTimeout(watchdog);fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

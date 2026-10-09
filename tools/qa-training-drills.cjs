/* Real keyboard steering after the arena marshal. No position, speed, cone or
   reward edits during training. A fresh local save is used; no user save touched. */
const QA=require('./qa-platform.cjs'),fs=require('node:fs'),assert=require('node:assert/strict');
const out=process.env.QA_OUT||'/private/tmp/meadowlark-training-drills',report={checks:[],errors:[]};
const check=(ok,label,detail)=>{assert.ok(ok,label+(detail?' '+JSON.stringify(detail):''));report.checks.push(label);console.log('PASS '+label);};
// Resize listeners clear the canvas after setViewportSize resolves. Let those run
// before drawing the manually stepped frame used in responsive screenshots.
async function resizeAndRender(page,width,height){
 await page.setViewportSize({width,height});
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 await page.evaluate(()=>advanceTime(0));
}
let browser;const watchdog=setTimeout(()=>{browser?.close().finally(()=>process.exit(3));},600000);watchdog.unref();
(async()=>{fs.mkdirSync(out,{recursive:true});browser=await QA.chromium.launch({headless:true,args:QA.gpuArgs()});
 const context=await browser.newContext({viewport:{width:1280,height:850},serviceWorkers:'block'});await context.routeWebSocket('**',ws=>ws.close());
 const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.on('dialog',d=>d.dismiss());
 try{
  console.log('START normal game load');await page.goto(QA.BASE+'/ranch3d.html?qa=training-drills',{waitUntil:'domcontentloaded',timeout:120000});
  await page.waitForFunction(()=>window.__features?.course?.drillState&&!document.getElementById('load')&&__features.installed.includes('training-drills'),null,{timeout:150000});
  await page.evaluate(()=>{const G=__features;window.__scenery=false;Promise.all([G.undergrowth.ready,G.photoscans.ready,G.worldDetails.ready,G.world.ranchBuilderArt.ready]).then(()=>__scenery=true);});
  await page.waitForFunction(()=>__scenery,null,{timeout:180000});console.log('Scenery ready');
  await page.evaluate(()=>{
   const G=__features;advanceTime(0);G.save.sync(s=>{s.rider.made=true;});G.wardrobe.closeChar();G.hidePanels();G.seFrame?.settle();G.audio.setMuted(true);G.riding.releaseAll();
   window.__step=ms=>{const render=G.renderer.render;G.renderer.render=function(scene,camera,...args){if(camera!==G.camera)return render.call(this,scene,camera,...args);};try{advanceTime(ms);}finally{G.renderer.render=render;}};
   window.__held={};window.__key=(code,on)=>{if(__held[code]===on)return;__held[code]=on;window.dispatchEvent(new KeyboardEvent(on?'keydown':'keyup',{code,bubbles:true}));};
   window.__release=()=>{for(const k in __held)__key(k,false);G.riding.releaseAll();};
   window.__snapshot=()=>{const s=G.save.fresh();return {drill:G.course.drillState(),horse:JSON.parse(JSON.stringify(s.horses[0])),coins:s.coins,drills:s.stats?.drills||0,pass:s.pass?.pts||0,result:s.lastTraining,position:{x:G.horse.player.pos.x,z:G.horse.player.pos.z},speed:G.horse.player.speed,heading:G.horse.player.heading,errors:G.errors,notice:document.getElementById('toast')?.textContent,rig:{ready:G.horse.RIG().ready,loading:G.horse.RIG().loadingBreed,jump:G.horse.RIG().heroJumpAge},onFoot:G.horse.player.onFoot,flying:G.horse.player.flying};};
   // Establish a distant starting location, before the training marshal.
   G.horse.player.pos.set(220,0,160);G.horse.player.speed=0;G.horse.player.heading=2;
   G.ui.openEvents();G.seEvents.openPage('__drill');G.seFrame?.settle();
  });
  await page.locator('[data-sev="drill:speed"]').click();
  const start=await page.evaluate(()=>__snapshot());report.start=start;
  check(start.drill.active&&start.drill.countdown===3&&start.drill.timeRemaining===55&&start.drill.cleared===0&&Math.hypot(start.position.x+9.5,start.position.z+12)<.01&&Math.abs(start.heading)<.01,'Training marshals from the world to the arena, facing cone one, before starting the clock',start.drill);
  check(await page.evaluate(()=>__features.world.practiceJumps.every(j=>!j.g?.visible)),'Practice fences clear the training arena');
  const held=await page.evaluate(()=>{__key('KeyW',true);__step(1500);__release();return __snapshot();});
  check(held.drill.timeRemaining===55&&held.drill.cleared===0&&Math.hypot(held.position.x-start.position.x,held.position.z-start.position.z)<.01,'The countdown holds movement and never grants a free cone');
  const paused=await page.evaluate(()=>{const G=__features;G.ui.openStable();G.seFrame?.settle();const a=G.course.drillState();__step(5000);const b=G.course.drillState();G.hidePanels();G.seFrame?.settle();return {a,b};});
  check(paused.a.countdown===paused.b.countdown&&paused.a.timeRemaining===paused.b.timeRemaining,'Opening a menu pauses countdown and training time');
  await page.evaluate(()=>{__step(1700);advanceTime(0);});await page.screenshot({path:out+'/arena-start.png'});
  for(const [width,height]of [[390,844],[667,375]]){await resizeAndRender(page,width,height);await page.screenshot({path:out+`/hud-${width}.png`});const bounds=await page.evaluate(()=>{const r=document.getElementById('drillHud').getBoundingClientRect(),button=document.getElementById('trainingEnd').getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,buttonHeight:button.height};});check(bounds.left>=0&&bounds.right<=width&&bounds.top>=0&&bounds.bottom<height-100&&bounds.buttonHeight>=44,'Training HUD and End button fit '+width+'px away from lower riding controls',bounds);}
  await page.setViewportSize({width:1280,height:850});
  const steer=async stopAt=>{
   for(let batch=0;batch<100;batch++){
    const s=await page.evaluate(stopAt=>{const G=__features,P=G.horse.player;
     for(let i=0;i<20;i++){
      const d=G.course.drillState();if(!d.active||d.cleared>=stopAt){__release();break;}if(d.countdown>0){__step(100);continue;}
      const c=d.next,angle=Math.atan2(c.x-P.pos.x,c.z-P.pos.z),delta=Math.atan2(Math.sin(angle-P.heading),Math.cos(angle-P.heading));
      __key('KeyA',delta>.055);__key('KeyD',delta<-.055);__key('KeyW',Math.abs(delta)<.8);__key('KeyS',Math.abs(delta)>1&&P.speed>1.2);__step(50);
     }return __snapshot();},stopAt);
    if(!s.drill.active||s.drill.cleared>=stopAt)return s;
   }throw Error('Keyboard riding did not reach requested training target');
  };
  const finished=await steer(8);report.finished=finished;
  check(!finished.drill.active&&finished.result?.completed&&finished.result.cleared===8,'A starter horse completes every cone through keyboard steering');
  check(finished.coins-start.coins===64&&finished.drills-start.drills===1&&finished.pass-start.pass===12&&finished.result.statXp>0,'Confirmed training saves its actual stat XP, all eight cone rewards and completion together',finished.result);
  check(await page.evaluate(()=>__features.world.practiceJumps.every(j=>j.g?.visible)),'Practice fences return after the training ride');
  check(finished.horse.stats.speed>start.horse.stats.speed||finished.horse.sxp.speed>start.horse.sxp.speed,'The trained horse has a real saved improvement');
  await page.waitForFunction(()=>document.querySelector('[data-fx="training:choose"]')?.getClientRects().length);await page.evaluate(()=>advanceTime(0));await page.screenshot({path:out+'/result-desktop.png'});
  for(const [width,height]of [[390,844],[667,375]]){await resizeAndRender(page,width,height);await page.screenshot({path:out+`/result-${width}.png`});const bounds=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:innerWidth,buttons:[...document.querySelectorAll('[data-fx^="training:"]')].filter(e=>e.getClientRects().length).map(e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,height:r.height};})}));check(bounds.scroll<=width+1&&bounds.buttons.every(b=>b.left>=-1&&b.right<=width+1&&b.height>=43),'Training result fits '+width+'px with usable controls',bounds);}
  await page.setViewportSize({width:1280,height:850});await page.locator('[data-fx="training:choose"]').click();await page.locator('[data-sev="drill:agility"]').click();await page.evaluate(()=>__step(3200));
  const partialBefore=await page.evaluate(()=>__snapshot());await steer(2);
  await page.evaluate(()=>{const G=__features,write=Storage.prototype.setItem;window.__failTraining=true;Storage.prototype.setItem=function(k,v){if(k===G.save.KEY&&__failTraining)throw new DOMException('QA training write failure','QuotaExceededError');return write.call(this,k,v);};G.course.cancelDrill();});
  const pending=await page.evaluate(()=>__snapshot());report.pending=pending;
  check(pending.drill.pending&&!pending.drill.pending.saved&&pending.coins===partialBefore.coins,'Failed partial-training save retains the earned work and awards no unconfirmed coins');
  check(await page.evaluate(()=>!__features.course.startDrill('jump')),'An unsaved result blocks starting a replacement drill');
  await page.waitForFunction(()=>document.querySelector('[data-fx="training:retry-save"]')?.getClientRects().length);
  await resizeAndRender(page,390,844);await page.screenshot({path:out+'/pending-390.png'});
  await page.evaluate(()=>__failTraining=false);await page.locator('[data-fx="training:retry-save"]').click();
  const retried=await page.evaluate(()=>{const first=__snapshot();__features.course.retryDrillSave();return {first,second:__snapshot()};});report.retried=retried;
  check(!retried.first.drill.pending&&retried.first.result?.cleared===2&&retried.first.coins-partialBefore.coins===16&&retried.first.horse.sxp.agility>partialBefore.horse.sxp.agility,'Retry saves the exact partial-cone reward and its horse training');
  check(retried.first.coins===retried.second.coins&&retried.first.horse.sxp.agility===retried.second.horse.sxp.agility,'Repeated retries never double the reward');
  check(!report.errors.length&&await page.evaluate(()=>!__features.errors.length),'Training entry, riding, results and retry have no browser or feature errors');
 }catch(e){report.failure=e.message;try{report.state=await page.evaluate(()=>typeof __snapshot==='function'?__snapshot():{});await page.screenshot({path:out+'/failure.png',timeout:5000});}catch(_){}throw e;}
 finally{clearTimeout(watchdog);fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

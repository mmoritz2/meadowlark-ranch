/* Real keyboard riding through the coached Jump drill. The normal training
 * marshal is the only relocation; no position/speed/jump proof is changed. */
const QA=require('./qa-platform.cjs'),fs=require('node:fs'),assert=require('node:assert/strict');
const out=process.env.QA_OUT||'/private/tmp/meadowlark-jump-clinic',report={checks:[],errors:[],events:[]};let browser;
function check(ok,name,data){assert.ok(ok,name+(data?' '+JSON.stringify(data):''));report.checks.push(name);console.log('PASS '+name);}
async function resize(page,w,h){await page.setViewportSize({width:w,height:h});await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await page.evaluate(()=>advanceTime(0));}
(async()=>{fs.mkdirSync(out,{recursive:true});browser=await QA.chromium.launch({headless:true,args:QA.gpuArgs()});
 const context=await browser.newContext({viewport:{width:1280,height:850},hasTouch:true,serviceWorkers:'block'});await context.routeWebSocket('**',ws=>ws.close());const page=await context.newPage();page.on('pageerror',e=>{report.errors.push(e.message);console.log('PAGE ERROR '+e.message);});
 try{
  await page.goto(QA.BASE+'/ranch3d.html?qa=jump-clinic',{waitUntil:'domcontentloaded',timeout:120000});
  await page.waitForFunction(()=>window.__features?.jumpTraining&&__features.horse.RIG().ready&&!document.getElementById('load'),null,{timeout:150000});
  await page.evaluate(()=>{const G=__features;window.__sceneReady=false;Promise.all([G.undergrowth.ready,G.photoscans.ready,G.worldDetails.ready,G.world.ranchBuilderArt.ready]).then(()=>__sceneReady=true);});await page.waitForFunction(()=>__sceneReady,null,{timeout:180000});
  await page.evaluate(()=>{const G=__features;advanceTime(0);G.save.sync(s=>{s.rider.made=true;});G.wardrobe.closeChar();G.hidePanels();G.seFrame?.settle();G.audio.setMuted(true);G.riding.releaseAll();
   window.__step=ms=>{const render=G.renderer.render;G.renderer.render=function(s,c,...a){if(c!==G.camera)return render.call(this,s,c,...a);};try{advanceTime(ms);}finally{G.renderer.render=render;}};
   window.__held={};window.__key=(code,on)=>{if(__held[code]===on)return;__held[code]=on;window.dispatchEvent(new KeyboardEvent(on?'keydown':'keyup',{code,bubbles:true}));};window.__release=()=>{for(const k in __held)__key(k,false);G.riding.releaseAll();};
   window.__snapshot=()=>{const s=G.save.fresh(),p=G.horse.player,r=G.horse.RIG();return {drill:G.course.drillState(),coins:s.coins,pass:s.pass?.pts||0,horse:JSON.parse(JSON.stringify(s.horses.find(h=>h.id===G.horse.ridden().id))),result:s.lastTraining,position:{x:p.pos.x,z:p.pos.z},heading:p.heading,speed:p.speed,height:p.y,jump:r.heroJumpAge,errors:G.errors,notice:document.getElementById('toast')?.textContent};};
   G.ui.openEvents();G.seEvents.openPage('__drill');G.seFrame?.settle();
  });
  await resize(page,390,844);await page.screenshot({path:out+'/01-choose-jump-mobile.png'});await page.locator('[data-sev="drill:jump"]').click();
  const start=await page.evaluate(()=>__snapshot());report.start=start;
  check(start.drill.activity==='jump'&&start.drill.countdown===3&&start.drill.timeRemaining===120&&start.drill.cleared===0,'Jump opens a real eight-fence clinic with a separate countdown',start.drill);
  check(await page.evaluate(()=>__features.world.practiceJumps.every(j=>!j.g.visible)&&__features.scene.getObjectByName('Meadowlark jumping clinic').children.length>4),'Old practice fences clear and the authored jumping clinic appears');
  await page.evaluate(()=>{__step(3200);advanceTime(0);});await page.screenshot({path:out+'/02-clinic-mobile.png'});
  check(await page.evaluate(()=>{const r=document.getElementById('drillHud').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.bottom<innerHeight-110&&document.getElementById('trainingHudTarget').textContent.includes('Fence');}),'Phone HUD shows the fence and leaves room for riding controls');
  await resize(page,1280,850);let jumpShot=false,pausedInFlight=false,previous='';
  for(let batch=0;batch<450;batch++){
   const s=await page.evaluate(()=>{const G=__features,p=G.horse.player;
    for(let i=0;i<10;i++){
     const d=G.course.drillState(),c=d.clinic;if(!d.active){__release();break;}if(d.countdown>0){__step(50);continue;}
     const next=d.next;if(!next)throw Error('Jump clinic has no next target');
     const angle=Math.atan2(next.x-p.pos.x,next.z-p.pos.z),delta=Math.atan2(Math.sin(angle-p.heading),Math.cos(angle-p.heading));
     __key('KeyA',delta>.07);__key('KeyD',delta<-.07);__key('ControlLeft',Math.abs(delta)>.60);__key('KeyW',Math.abs(delta)<1.10);__key('KeyS',Math.abs(delta)>1.35&&p.speed>1);
     // Intentionally ride through the first rail on the ground, then obey the
     // visible takeoff cue on retries and all subsequent jumps.
     const jump=c.misses>0&&c.inWindow&&G.horse.RIG().heroJumpAge==null;
     __key('Space',jump);__step(50);
     if(G.course.drillState().clinic?.phase==='landing')break;
    }return __snapshot();});
   const key=[s.drill.cleared,s.drill.clinic?.phase,s.drill.clinic?.misses].join(':');if(key!==previous){console.log('RIDE '+key+' '+JSON.stringify({pos:s.position,next:s.drill.next,t:s.drill.timeRemaining,height:s.height,speed:s.speed}));report.events.push({key,...s});previous=key;}
   if(s.drill.clinic?.phase==='landing'){
    if(!jumpShot){await page.evaluate(()=>advanceTime(0));await page.screenshot({path:out+'/03-real-jump.png'});jumpShot=true;}
    if(!pausedInFlight){const pause=await page.evaluate(()=>{const G=__features;__release();G.ui.openStable();G.seFrame?.settle();const a=G.course.drillState();__step(1800);const b=G.course.drillState();G.hidePanels();G.seFrame?.settle();return {a,b};});report.pause=pause;check(pause.a.timeRemaining===pause.b.timeRemaining&&pause.a.cleared===pause.b.cleared&&pause.b.clinic.phase==='landing','Opening a menu mid-jump preserves the pending landing and pauses the timer',pause);pausedInFlight=true;}
   }
   if(!s.drill.active)break;
  }
  const finished=await page.evaluate(()=>__snapshot());report.finished=finished;
  check(finished.result?.completed&&finished.result.cleared===8&&finished.result.activity==='jump','Keyboard riding clears and lands all eight jumps',finished);
  check(finished.result.clinic.misses>=1&&jumpShot,'A grounded miss is retried and actual airborne crossings are required');
  check(finished.coins-start.coins===64&&finished.pass-start.pass===12&&finished.result.statXp>0,'Eight landed jumps save the exact coins, pass points and actual horse XP',finished.result);
  check(await page.evaluate(()=>!__features.scene.getObjectByName('Meadowlark jumping clinic')&&__features.world.practiceJumps.every(j=>j.g.visible)),'Finishing removes clinic geometry and restores free practice');
  await page.waitForFunction(()=>document.querySelector('[data-fx="training:again"]')?.getClientRects().length);await page.evaluate(()=>advanceTime(0));await page.screenshot({path:out+'/04-result-desktop.png'});
  for(const [w,h] of [[390,844],[667,375]]){await resize(page,w,h);await page.screenshot({path:out+`/05-result-${w}.png`});check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1&&[...document.querySelectorAll('#trainingResultPanel button')].filter(e=>e.getClientRects().length).every(e=>e.getBoundingClientRect().height>=43)),'Jump result fits '+w+'px with touch controls');}
  check(await page.locator('[data-fx="training:again"]').isEnabled(),'Coached practice stays available at the horse’s current stat ceiling');
  await page.locator('[data-fx="training:again"]').click();check((await page.evaluate(()=>__snapshot())).drill.active,'Practice again starts the next clinic from its normal marshal');
  await page.locator('#trainingEnd').click();check(!(await page.evaluate(()=>__snapshot())).drill.active,'Ending before the first jump safely leaves training');
  check(!report.errors.length&&await page.evaluate(()=>!__features.errors.length),'No browser or feature errors during the clinic');
 }catch(e){report.failure=e.message;try{report.state=await page.evaluate(()=>typeof __snapshot==='function'?__snapshot():{});await page.screenshot({path:out+'/failure.png',timeout:5000});}catch{}throw e;}
 finally{fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

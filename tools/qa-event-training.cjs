/* Event preparation → real keyboard-ridden Jump clinic → failed save/retry →
 * same Elite event, with readiness recalculated. Disposable offline save. */
const QA=require('./qa-platform.cjs'),fs=require('node:fs'),assert=require('node:assert/strict');
const out=process.env.QA_OUT||'/private/tmp/meadowlark-event-training',report={checks:[],errors:[],events:[]};let browser;
function check(ok,name,data){assert.ok(ok,name+(data?' '+JSON.stringify(data):''));report.checks.push(name);console.log('PASS '+name);}
async function resize(page,w,h){await page.setViewportSize({width:w,height:h});await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await page.evaluate(()=>advanceTime(0));}
(async()=>{fs.mkdirSync(out,{recursive:true});browser=await QA.chromium.launch({headless:true,args:QA.gpuArgs()});
 const context=await browser.newContext({viewport:{width:1280,height:850},hasTouch:true,serviceWorkers:'block'});await context.routeWebSocket('**',ws=>ws.close());const page=await context.newPage();page.on('pageerror',e=>{report.errors.push(e.message);console.log('PAGE ERROR '+e.message);});
 try{
  console.log('Loading local game');await page.goto(QA.BASE+'/ranch3d.html?qa=event-training',{waitUntil:'domcontentloaded',timeout:120000});
  await page.waitForFunction(()=>window.__features?.jumpTraining&&__features.horse.RIG().ready&&!document.getElementById('load'),null,{timeout:150000});
  await page.evaluate(()=>{const G=__features;window.__sceneReady=false;Promise.all([G.undergrowth.ready,G.photoscans.ready,G.worldDetails.ready,G.world.ranchBuilderArt.ready]).then(()=>__sceneReady=true);});await page.waitForFunction(()=>__sceneReady,null,{timeout:180000});
  console.log('Scenery ready');await page.evaluate(()=>{const G=__features;advanceTime(0);G.save.sync(s=>{s.rider.made=true;s.unlocked={...(s.unlocked||{}),barleyfold:1};s.evDiff=2;const h=s.horses[G.horse.rideIdx()];h.name='Willow';h.level=5;h.xp=0;h.stats={speed:3,accel:3,agility:3,stamina:3,jump:2};h.sxp={speed:0,accel:0,agility:0,stamina:0,jump:39};h.gear={};s.horses.push({...structuredClone(h),id:'qa-fern',name:'Fern',level:8,stats:{speed:5,accel:5,agility:5,stamina:5,jump:5},sxp:{}});});G.horse.reloadHorses();G.wardrobe.closeChar();G.hidePanels();G.seFrame?.settle();G.audio.setMuted(true);G.riding.releaseAll();
   window.__step=ms=>{const render=G.renderer.render;G.renderer.render=function(s,c,...a){if(c!==G.camera)return render.call(this,s,c,...a);};try{advanceTime(ms);}finally{G.renderer.render=render;}};
   window.__held={};window.__key=(code,on)=>{if(__held[code]===on)return;__held[code]=on;window.dispatchEvent(new KeyboardEvent(on?'keydown':'keyup',{code,bubbles:true}));};window.__release=()=>{for(const k in __held)__key(k,false);G.riding.releaseAll();};
   window.__snapshot=()=>{const s=G.save.fresh(),p=G.horse.player,r=G.horse.RIG();return {drill:G.course.drillState(),coins:s.coins,pass:s.pass?.pts||0,horse:JSON.parse(JSON.stringify(s.horses.find(h=>h.id===G.horse.ridden().id))),result:s.lastTraining,position:{x:p.pos.x,z:p.pos.z},heading:p.heading,speed:p.speed,height:p.y,jump:r.heroJumpAge,errors:G.errors,notice:document.getElementById('toast')?.textContent};};
   G.ui.openEvents();G.seEvents.openPage('a1');G.seFrame?.settle();
  });
  await page.waitForFunction(()=>document.querySelector('[data-sev="train:jump"]')?.getClientRects().length);
  await resize(page,390,844);await page.screenshot({path:out+'/01-event-needs-jump.png'});
  check(!(await page.locator('[data-sev="ride"]').isEnabled())&&await page.locator('[data-sev="train:jump"]').isEnabled(),'The selected Elite event offers direct Jump training and retains its real entry lock');
  await page.locator('[data-sev="train:jump"]').click();
  const start=await page.evaluate(()=>__snapshot());report.start=start;
  check(start.drill.activity==='jump'&&start.drill.active&&start.drill.countdown===3,'Train Jump launches the coached clinic through its normal start gate',start.drill);
  check((await page.locator('#trainingHudHorse').innerText()).includes('Barleyfold Farm Derby'),'The training HUD keeps the event goal visible');
  await page.evaluate(()=>{__step(3200);advanceTime(0);});await page.screenshot({path:out+'/02-training-for-event.png'});
  await resize(page,1280,850);let jumpShot=false,pausedInFlight=false,previous='';
  for(let batch=0;batch<450;batch++){
   const s=await page.evaluate(()=>{const G=__features,p=G.horse.player;
    for(let i=0;i<10;i++){
     const d=G.course.drillState(),c=d.clinic;if(!d.active||d.cleared>=2){__release();break;}if(d.countdown>0){__step(50);continue;}
     const next=d.next;if(!next)throw Error('Jump clinic has no next target');
     const angle=Math.atan2(next.x-p.pos.x,next.z-p.pos.z),delta=Math.atan2(Math.sin(angle-p.heading),Math.cos(angle-p.heading));
     __key('KeyA',delta>.07);__key('KeyD',delta<-.07);__key('ControlLeft',Math.abs(delta)>.60);__key('KeyW',Math.abs(delta)<1.10);__key('KeyS',Math.abs(delta)>1.35&&p.speed>1);
     const jump=c.inWindow&&G.horse.RIG().heroJumpAge==null;
     __key('Space',jump);__step(50);
     if(G.course.drillState().clinic?.phase==='landing')break;
    }return __snapshot();});
   const key=[s.drill.cleared,s.drill.clinic?.phase,s.drill.clinic?.misses].join(':');if(key!==previous){console.log('RIDE '+key+' '+JSON.stringify({pos:s.position,next:s.drill.next,t:s.drill.timeRemaining,height:s.height,speed:s.speed}));report.events.push({key,...s});previous=key;}
   if(s.drill.clinic?.phase==='landing'){
    if(!jumpShot){await page.evaluate(()=>advanceTime(0));await page.screenshot({path:out+'/03-real-jump.png'});jumpShot=true;}
    if(!pausedInFlight){const pause=await page.evaluate(()=>{const G=__features;__release();G.ui.openStable();G.seFrame?.settle();const a=G.course.drillState();__step(1800);const b=G.course.drillState();G.hidePanels();G.seFrame?.settle();return {a,b};});report.pause=pause;check(pause.a.timeRemaining===pause.b.timeRemaining&&pause.a.cleared===pause.b.cleared&&pause.b.clinic.phase==='landing','Opening a menu mid-jump preserves the pending landing and pauses the timer',pause);pausedInFlight=true;}
   }
   if(!s.drill.active||s.drill.cleared>=2)break;
  }
  check((await page.evaluate(()=>__snapshot())).drill.cleared===2,'Keyboard riding clears two real jumps before ending the training');
  await page.evaluate(()=>{const G=__features,write=Storage.prototype.setItem;window.__failTraining=true;Storage.prototype.setItem=function(k,v){if(k===G.save.KEY&&__failTraining)throw new DOMException('QA save unavailable','QuotaExceededError');return write.call(this,k,v);};});
  await page.locator('#trainingEnd').click();
  await page.waitForFunction(()=>document.querySelector('[data-fx="training:retry-save"]')?.getClientRects().length);
  const pending=await page.evaluate(()=>__snapshot());report.pending=pending;
  check(pending.drill.pending&&!pending.drill.pending.saved&&pending.coins===start.coins,'An unconfirmed training save retains the result without paying coins');
  check(await page.locator('[data-fx="training:event"]').count()===0&&!await page.evaluate(()=>__features.trainingDrills.returnToEvent()),'Pending save cannot claim readiness or return before rewards are confirmed');
  await resize(page,390,844);await page.screenshot({path:out+'/03-event-training-pending.png'});
  await page.evaluate(()=>__failTraining=false);await page.locator('[data-fx="training:retry-save"]').click();
  await page.waitForFunction(()=>document.querySelector('[data-fx="training:event"]')?.getClientRects().length);
  const finished=await page.evaluate(()=>__snapshot());report.finished=finished;
  check(finished.result?.saved&&finished.result.cleared===2&&finished.horse.stats.jump===3&&finished.coins-start.coins===16,'Retry saves the actual Jump increase and exactly two landed-jump rewards',finished.result);
  for(const [w,h] of [[390,844],[667,375]]){await resize(page,w,h);await page.screenshot({path:out+`/04-result-${w}.png`});check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1&&[...document.querySelectorAll('#trainingResultPanel button')].filter(e=>e.getClientRects().length).every(e=>e.getBoundingClientRect().height>=43)),'Event training result fits '+w+'px with touch-sized controls');}
  await page.locator('[data-fx="training:event"]').click();
  await page.waitForFunction(()=>__features.seEvents.state.page==='a1'&&document.querySelector('[data-sev="ride"]')?.getClientRects().length);
  check(await page.evaluate(()=>__features.seEvents.state.diff===2)&&await page.locator('[data-sev="ride"]').isEnabled(),'Return restores Barleyfold Farm Derby at Elite and freshly unlocks entry');
  await resize(page,390,844);await page.screenshot({path:out+'/05-event-ready.png'});
  await resize(page,1280,850);await page.locator('[data-sev="ride"]').click();
  check(await page.evaluate(()=>__features.course.get()?.ev?.id==='a1'),'The newly ready horse enters the actual event');
  await page.evaluate(()=>{__features.course.cancelCourse();__features.hidePanels();__features.seFrame.settle();const G=__features;G.save.sync(s=>{const h=s.horses.find(h=>h.id===G.horse.ridden().id);h.level=4;h.stats.jump=4;h.stats.stamina=4;h.sxp.jump=0;h.sxp.stamina=0;});G.horse.reloadHorses();G.ui.openEvents();G.seEvents.openPage('a2');});
  await page.waitForFunction(()=>document.querySelector('.sev-preparation')?.textContent.includes('training cap'));
  check(await page.locator('[data-sev="train:jump"]').count()===0&&await page.locator('[data-sev="train:stamina"]').count()===0&&!await page.locator('[data-sev="ride"]').isEnabled(),'Capped stats do not offer a drill that cannot meet Cross Country requirements');
  await resize(page,390,844);await page.screenshot({path:out+'/06-level-cap-guidance.png'});
  await page.locator('[data-sev="prepare:myhorses"]').click();
  await page.locator('#seOv [data-se="open:stable"]').click();
  await page.locator('[data-hid="qa-fern"]').click();
  await page.locator('[data-shs="primary"]').click();
  await page.waitForFunction(()=>__features.horse.ridden().id==='qa-fern'&&document.getElementById('seOv').classList.contains('on'));
  check(await page.evaluate(()=>__features.horse.ridden().name==='Fern'),'Choosing Ride in the Stable preserves Fern and returns to preparation');
  await page.locator('[data-care-back]').click();
  await page.waitForFunction(()=>__features.seEvents.state.page==='a2'&&document.querySelector('[data-sev="ride"]')?.getClientRects().length);
  check(await page.locator('[data-sev="ride"]').isEnabled()&&await page.evaluate(()=>__features.seEvents.state.diff===2&&__features.horse.ridden().id==='qa-fern'),'A stronger owned horse keeps the selected Elite event and unlocks entry');
  await page.screenshot({path:out+'/07-new-horse-ready.png'});
  check(!report.errors.length&&await page.evaluate(()=>!__features.errors.length),'No browser or feature errors during event preparation, riding, save retry and event entry');
 }catch(e){report.failure=e.message;try{report.state=await page.evaluate(()=>typeof __snapshot==='function'?__snapshot():{});await page.screenshot({path:out+'/failure.png',timeout:5000});}catch{}throw e;}
 finally{fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

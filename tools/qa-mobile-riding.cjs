/* Disposable touch-context integration test; blocks multiplayer and external traffic. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const QA=require(process.env.QA_HELPER||'./qa-platform.cjs');
const output=process.env.QA_OUTPUT||path.join(__dirname,'../review/mobile-riding');fs.mkdirSync(output,{recursive:true});
const report={context:{width:844,height:390,hasTouch:true,isMobile:true},errors:[],gaits:[]};let browser;
(async()=>{try{
 browser=await QA.chromium.launch({headless:true,args:QA.gpuArgs()});
 const context=await browser.newContext({viewport:{width:844,height:390},deviceScaleFactor:2,isMobile:true,hasTouch:true,serviceWorkers:'block'}),page=await context.newPage();
 await page.route('**/*',r=>r.request().url().startsWith(QA.BASE)?r.continue():r.abort());
 await page.addInitScript(()=>{window.WebSocket=class{constructor(){throw Error('QA blocks multiplayer');}}});page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto(QA.BASE+'/ranch3d.html?qa=mobile-riding&emoji=0',{waitUntil:'domcontentloaded',timeout:120000});
 await page.waitForFunction(()=>window.__features?.riding&&__features.horse.RIG().ready,null,{timeout:150000});
 await page.evaluate(()=>{const G=__features;G.hidePanels();G.wardrobe?.closeChar?.();G.save.sync(s=>{if(s.rider)s.rider.made=true;});advanceTime(0);});
 const cdp=await context.newCDPSession(page),touch=(type,points)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(([id,x,y])=>({id,x,y,radiusX:5,radiusY:5,force:1}))});
 const read=()=>page.evaluate(()=>{const G=__features,r=G.horse.RIG();return{...G.riding.state(),mode:r.heroMotion.mode,phase:r.heroMotion.state.phase01,reverse:r.nativeReverse,finite:r.bones.every(b=>b.matrixWorld.elements.every(Number.isFinite)),yaw:G.world.camOrbit.yaw,dragging:G.world.camOrbit.dragging,y:G.horse.player.y};});
 const step=ms=>page.evaluate(ms=>advanceTime(ms),ms);
 const reset=()=>page.evaluate(()=>{const G=__features,p=G.horse.player;p.pos.set(0,0,0);p.heading=0;p.speed=0;p.stam=1;p.blown=false;p.boostT=0;p.y=0;p.vy=0;p.flying=false;for(const k in _k)_k[k]=false;Object.assign(_touch,{go:false,back:false,turnA:0,goA:0,backA:0,analog:false,brake:false,gal:false});G.riding.brake(false);advanceTime(30);});
 report.bounds=await page.evaluate(()=>Object.fromEntries(['stickZone','questTrack','seJump','seRidePace','seGaitDown','seGaitUp','seStop','seMount'].map(id=>{const r=document.getElementById(id).getBoundingClientRect();return[id,{x:r.x,y:r.y,w:r.width,h:r.height}]})));
 for(const[id,r]of Object.entries(report.bounds)){assert(r.x>=0&&r.y>=0&&r.x+r.w<=845&&r.y+r.h<=391,id+' inside phone');}
 const intersects=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
 assert(!intersects(report.bounds.stickZone,report.bounds.questTrack),'objective clear of joystick');assert(!intersects(report.bounds.seRidePace,report.bounds.stickZone),'pace clear of joystick');assert(!intersects(report.bounds.seJump,report.bounds.seRidePace),'jump clear of pace');
 if(!process.env.QA_FOCUS){for(const gait of ['walk','trot','canter','gallop']){
  await reset();await page.locator('#seGaitLabel').tap();await page.locator('[data-gait="'+gait+'"]').tap();
  await touch('touchStart',[[1,96,298]]);await touch('touchMove',[[1,96,240]]);
  for(let i=0;i<5;i++){await step(500);await page.evaluate(()=>__features.horse.player.pos.set(0,0,0));}
  const r=await read();report.gaits.push({choice:gait,...r});assert.equal(r.mode,gait);assert(r.finite);if(gait==='gallop')assert(r.speed>12);if(gait==='canter')assert(r.speed>6);
  await touch('touchEnd',[]);
 }
 // Real press-and-hold Stop overrides a held forward thumb.
 await touch('touchStart',[[1,96,298]]);await touch('touchMove',[[1,96,240]]);await step(500);
 const stop=report.bounds.seStop;await touch('touchStart',[[1,96,240],[2,stop.x+stop.w/2,stop.y+stop.h/2]]);await step(800);report.stop=await read();assert(report.stop.speed<.12&&report.stop.braking,'held stop brakes despite forward');await touch('touchEnd',[]);
 // Pulling the stick back first brakes, then reverses the authored walk clock.
 await reset();await touch('touchStart',[[1,96,275]]);await touch('touchMove',[[1,96,333]]);await step(900);const reverse0=await read();await step(80);report.reverse={start:reverse0,end:await read()};assert(report.reverse.end.speed<-.8&&report.reverse.end.mode==='walk'&&report.reverse.end.reverse);const phaseDelta=(report.reverse.end.phase-reverse0.phase+1)%1;assert(phaseDelta>.8,'reverse walk clock decreases');await touch('touchEnd',[]);await step(2000);assert.equal((await read()).mode,'stand');
 }
 // Camera drag is hit-tested on the canvas while a separate finger rides.
 await reset();await page.evaluate(()=>__features.riding.selectGait('trot'));await touch('touchStart',[[1,96,298]]);await touch('touchMove',[[1,96,250]]);
 report.cameraHit=await page.evaluate(()=>document.elementFromPoint(450,205)?.tagName);assert.equal(report.cameraHit,'CANVAS');
 await touch('touchStart',[[1,96,250],[2,450,205]]);await touch('touchMove',[[1,96,250],[2,530,205]]);const start=await read();await step(800);const held=await read();assert(Math.abs(held.yaw-start.yaw)<1e-6,'drag does not recenter');
 await touch('touchEnd',[]);await touch('touchStart',[[1,96,298]]);await touch('touchMove',[[1,96,250]]);await step(800);const grace=await read();assert(Math.abs(grace.yaw-held.yaw)<1e-6,'camera release grace');await step(1000);const recentered=await read();report.camera={start,held,grace,recentered};assert(Math.abs(recentered.yaw)<Math.abs(grace.yaw),'gentle recenter after grace');await touch('touchEnd',[]);
 await reset();await page.keyboard.press('[');assert.equal((await read()).selected,'walk');await page.keyboard.press(']');assert.equal((await read()).selected,'trot');await page.keyboard.down('Shift');await step(20);assert.equal((await read()).requested,'gallop');await page.keyboard.up('Shift');await step(20);assert.equal((await read()).requested,'trot');
 await page.locator('#seStop').focus();await page.keyboard.down('Space');await step(300);report.keyboardStop=await read();assert(report.keyboardStop.braking&&report.keyboardStop.mode!=='jump'&&report.keyboardStop.y===0);await page.keyboard.up('Space');await page.keyboard.press('Tab');await page.evaluate(()=>__features.riding.releaseAll());
 await touch('touchStart',[[1,96,298]]);await touch('touchMove',[[1,96,240]]);await page.evaluate(()=>{__features.riding.brake(true);__features.riding.releaseAll();});assert(await page.evaluate(()=>!_touch.go&&!_touch.back&&!_touch.analog&&!__features.riding.state().braking&&!__features.world.camOrbit.dragging));await touch('touchEnd',[]);
 await touch('touchStart',[[2,96,298]]);await touch('touchMove',[[2,96,240]]);assert(await page.evaluate(()=>_touch.go));await touch('touchEnd',[]);
 await page.locator('#seMenuBtn').tap();await page.locator('#seTiles [aria-label="Sprint"]').tap();assert(await page.evaluate(()=>_touch.spr&&__features.riding.state().selected==='gallop'));await page.evaluate(()=>__features.riding.releaseAll());
 report.guidance=await page.evaluate(async()=>{
  const G=__features,Q=G.quest,idx=Q.storyIdx(),original=Q.STORY[idx],track=document.getElementById('questTrack'),result={};
  const set=(type,extra={})=>{Q.STORY[idx]={type,goal:999,label:'Riding test task',npc:'wren',...extra};advanceTime(350);};
  set('gallop');G.riding.selectGait('walk');track.click();result.gallop=G.riding.state().selected;
  set('build');track.click();result.build=getComputedStyle(document.getElementById('buildPanel')).display;G.hidePanels();
  set('event',{ev:'h1'});track.click();await new Promise(r=>setTimeout(r,150));result.event={page:G.seEvents.state.page,on:G.seEvents.state.on,display:getComputedStyle(document.getElementById('seEv')).display,course:!!G.course.get(),stats:document.querySelector('#sevPage .pb-req')?.textContent};
  document.querySelector('#seEv [data-sev="tab:card"]').click();await new Promise(r=>setTimeout(r,120));result.fullCard=getComputedStyle(document.getElementById('ev2CardPanel')).display;
  document.querySelector('#seFrameTop [data-se="back"]').click();await new Promise(r=>setTimeout(r,150));result.back={page:G.seEvents.state.page,on:G.seEvents.state.on};
  G.hidePanels();document.getElementById('seEv').classList.remove('on');
  set('forage',{item:'lettuce',goal:Q.storyProg()+1});const candidate=G.world.forage.filter(x=>x.item==='lettuce'&&x.g.visible).sort((a,b)=>a.g.position.distanceTo(G.horse.player.pos)-b.g.position.distanceTo(G.horse.player.pos))[0];
  result.crop=G.seHud.wayTarget();result.expected=candidate?{x:candidate.g.position.x,z:candidate.g.position.z}:null;Q.questEvt('forage','lettuce');result.complete=G.seHud.wayTarget();
  Q.STORY[idx]=original;advanceTime(350);return result;
 });
 assert.equal(report.guidance.gallop,'gallop');assert.equal(report.guidance.build,'flex');assert.equal(report.guidance.event.page,'h1');assert.equal(report.guidance.event.on,true);assert.equal(report.guidance.event.course,false);assert(/\d+(?:\.\d+)?\s*\/\s*\d/.test(report.guidance.event.stats));assert.notEqual(report.guidance.fullCard,'none');assert.equal(report.guidance.back.page,'h1');assert(report.guidance.back.on);assert(report.guidance.crop?.id.startsWith('gather:'));assert.equal(report.guidance.crop.x,report.guidance.expected.x);assert.equal(report.guidance.crop.z,report.guidance.expected.z);assert.equal(report.guidance.complete.id,'wren');
 await page.screenshot({path:path.join(output,'landscape-controls.png')});
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(100);await step(50);report.portrait=await page.evaluate(()=>Object.fromEntries(['stickZone','seRidePace','seJump'].map(id=>{const r=document.getElementById(id).getBoundingClientRect();return[id,{x:r.x,y:r.y,w:r.width,h:r.height}]})));
 assert(!intersects(report.portrait.seJump,report.portrait.seRidePace));assert(!intersects(report.portrait.stickZone,report.portrait.seRidePace),'portrait stick clear of pace');await page.screenshot({path:path.join(output,'portrait-controls.png')});
 assert.deepEqual(report.errors,[]);report.passed=true;console.log(JSON.stringify({passed:true,gaits:report.gaits.map(x=>({gait:x.mode,speed:x.speed})),stop:report.stop?.speed,reverse:report.reverse?.end.speed,camera:report.camera}));
 }catch(e){report.failure=String(e.stack||e);console.error(e);process.exitCode=1;}finally{fs.writeFileSync(path.join(output,process.env.QA_FOCUS?'camera-layout-guidance.json':'controls.json'),JSON.stringify(report,null,2));await browser?.close();}})();

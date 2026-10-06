/* Disposable save and blocked WebSockets: checks riding, bonding and event preparation
 * without publishing presence or changing a player's game. No performance assertions. */
const QA=require('./qa-platform.cjs'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const out=path.resolve(process.env.QA_OUT||'/private/tmp/meadowlark-riding-life');
(async()=>{
 const browser=await QA.chromium.launch({headless:true,args:QA.gpuArgs()}),page=await browser.newPage({viewport:{width:1440,height:940}}),report={checks:[],errors:[],layouts:{}};
 const check=(value,label)=>{assert.ok(value,label);report.checks.push(label);console.log('PASS '+label);};
 const shot=name=>page.screenshot({path:path.join(out,name+'.png'),style:'#toasts{display:none!important}'});
 await page.routeWebSocket('**',ws=>ws.close());page.on('pageerror',e=>report.errors.push(e.message));page.on('dialog',d=>d.dismiss());
 try{
  fs.mkdirSync(out,{recursive:true});await page.goto(QA.BASE+'/ranch3d.html?qa=riding-life&emoji=0',{timeout:120000});
  await page.waitForFunction(()=>window.__features?.seCare&&__features.seEvents&&__features.followCam,null,{timeout:120000});
  await page.waitForFunction(()=>!document.getElementById('load'),null,{timeout:120000});
  await page.evaluate(()=>{
   const G=__features;advanceTime(0);G.save.sync(s=>{s.rider.made=true;});G.wardrobe.closeChar();G.hidePanels();G.audio.setMuted(true);document.activeElement?.blur();
   // Skip only the world frame while stepping mechanics. Menu snapshots still
   // render with their own cameras, so they cannot cache blank venue pictures.
   window.__qaStep=ms=>{const render=G.renderer.render;G.renderer.render=function(scene,camera,...rest){if(camera!==G.camera)return render.call(this,scene,camera,...rest);};try{advanceTime(ms);}finally{G.renderer.render=render;}advanceTime(0);};
   window.__qaKey=(code,on)=>window.dispatchEvent(new KeyboardEvent(on?'keydown':'keyup',{code,bubbles:true}));
   G.renderer.domElement.dataset.qa='world';__qaStep(100);
  });
  report.initial=await page.evaluate(()=>({errors:__features.errors,rig:__features.horse.RIG().modelKey,camera:JSON.parse(render_game_to_text()).followCam}));
  check(report.initial.errors.length===0,'All feature packages install');
  check(report.initial.camera.own&&!report.initial.camera.broke,'Follow camera owns the riding view');
  const canvas=page.locator('canvas[data-qa="world"]');
  const zoom0=await page.evaluate(()=>__features.followCam.state.zoom);
  await canvas.dispatchEvent('wheel',{deltaY:160});
  const zoom1=await page.evaluate(()=>__features.followCam.state.zoom);
  check(zoom1!==zoom0,'Wheel over the world adjusts the camera');
  await canvas.dispatchEvent('pointerdown',{pointerId:42,pointerType:'mouse',button:0,clientX:900,clientY:500});
  await canvas.dispatchEvent('pointermove',{pointerId:42,pointerType:'mouse',clientX:1020,clientY:515});
  await canvas.dispatchEvent('pointerup',{pointerId:42,pointerType:'mouse',button:0,clientX:1020,clientY:515});
  report.orbit=await page.evaluate(()=>{
   const G=__features,F=G.followCam.state;G.riding.selectGait('trot');__qaKey('KeyW',true);const start=F.yaw;__qaStep(700);const held=F.yaw;__qaStep(1600);const returned=F.yaw;__qaKey('KeyW',false);G.riding.releaseAll();return {start,held,returned,state:JSON.parse(render_game_to_text()).followCam};
  });
  check(Math.abs(report.orbit.start)>.05&&Math.abs(report.orbit.held-report.orbit.start)<.001,'Manual orbit is held while riding for the grace period');
  check(Math.abs(report.orbit.returned)<Math.abs(report.orbit.held),'Camera gently returns after the grace period');
  await canvas.dispatchEvent('pointerdown',{pointerId:43,pointerType:'mouse',button:0,clientX:900,clientY:500});
  await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
  check(await page.evaluate(()=>!__features.followCam.state.drag),'Losing focus releases a camera drag');
  await page.evaluate(()=>{window.dispatchEvent(new Event('focus'));__features.followCam.reset();__qaStep(100);});
  report.riding=await page.evaluate(()=>{
   const G=__features,p=G.horse.player;G.riding.releaseAll();p.pos.set(-7,0,10);p.heading=Math.PI;p.speed=0;G.riding.selectGait('trot');
   const before=JSON.parse(render_game_to_text()).rideFeedback;__qaKey('KeyW',true);__qaStep(1800);__qaKey('KeyW',false);G.riding.releaseAll();
   const after=JSON.parse(render_game_to_text()).rideFeedback;return {before,after,position:[p.pos.x,p.pos.z],speed:p.speed};
  });
  check(report.riding.after.contacts>report.riding.before.contacts,'Riding emits authored hoof contact beats');
  check(report.riding.after.dust-report.riding.before.dust<25,'Dry-soil dust is emitted per contact rather than each frame');
  report.jump=await page.evaluate(()=>{
   const G=__features,p=G.horse.player,R=G.horse.RIG();G.riding.releaseAll();p.pos.set(-7,0,10);p.speed=0;__qaStep(100);__qaKey('Space',true);__qaStep(17);__qaKey('Space',false);
   const started=R.heroMotion.mode,duration=R.profile.nativeJump.durationS;__qaStep(duration*1000-110);__qaKey('Space',true);__qaStep(17);__qaKey('Space',false);__qaStep(150);
   const feedback=JSON.parse(render_game_to_text()).rideFeedback,secondMode=R.heroMotion.mode;__qaStep(duration*1000+200);return {started,secondMode,feedback,end:R.heroMotion.mode};
  });
  check(report.jump.started==='jump','Space starts the approved native jump');
  check(report.jump.feedback.bufferedJump>=1&&report.jump.secondMode==='jump','A brief landing tap starts one buffered jump');
  check(report.jump.end!=='jump','Buffered jump does not repeat without another tap');
  await page.evaluate(()=>{
   const G=__features;G.riding.releaseAll();G.horse.player.speed=0;G.save.sync(s=>{s.horses[G.horse.rideIdx()].bond=99;s.horses[G.horse.rideIdx()].pers='social';s.items.carrot=2;});G.horse.reloadHorses();window.__qaFoalVisible=G.storyQuests.foal()?.group?.visible;G.seCare.open('feeding');__qaStep(300);
  });
  check(await page.locator('.sv-bond-card').count()===1,'Bonding shows the horse personality and milestone');
  check(await page.evaluate(()=>__features.horse.player.mesh.visible&&!__features.storyQuests.foal().group.visible),'Overview keeps the selected horse clear of the nearby story foal');
  const menuZoom=await page.evaluate(()=>__features.followCam.state.zoom);
  await page.locator('#seOvBody').dispatchEvent('wheel',{deltaY:160});
  check(await page.evaluate(()=>__features.followCam.state.zoom)===menuZoom,'Scrolling horse care does not zoom the riding camera');
  await page.locator('#seOvBody [data-se="care:pet"]').click();
  report.pet=await page.evaluate(()=>({bond:__features.save.fresh().horses[__features.horse.rideIdx()].bond,receipt:__features.seCare.state().receipt}));
  check(report.pet.bond===100&&report.pet.receipt.bond===1,'Bond receipt reports the actual capped gain');
  await page.locator('[data-se="foodstat:speed"]').click();
  check(await page.locator('.sv-food').count()>0&&await page.locator('[data-se="foodstat:speed"]').getAttribute('aria-pressed')==='true','Training treats can be filtered by stat');
  await page.locator('[data-se="foodstat:all"]').click();await page.locator('[data-se="care:carrot"]').click();
  report.feed=await page.evaluate(()=>({carrots:__features.save.fresh().items.carrot,receipt:__features.seCare.state().receipt}));
  check(report.feed.carrots===1&&report.feed.receipt.title.includes('Clover'),'Treat uses real inventory and reports actual rewards');
  await shot('bonding-desktop');
  await page.evaluate(()=>__features.seCare.close());
  check(await page.evaluate(()=>__features.storyQuests.foal().group.visible===__qaFoalVisible),'Closing Overview restores surrounding horses');
  await page.evaluate(()=>{__features.seEvents.open();__features.seEvents.openPage('h1');});
  await page.locator('[data-sev="diff:0"]').click();
  check(await page.locator('.sev-preparation').count()===1,'Event shows horse requirements and purse');
  await page.locator('[data-sev="diff:2"]').click();
  check(await page.locator('[data-sev="ride"]').isDisabled(),'Locked difficulty cannot be entered');
  await page.locator('[data-sev="diff:0"]').click();
  check(await page.locator('[data-sev="ride"]').isEnabled(),'Eligible novice event can be entered');
  await page.evaluate(()=>{document.querySelector('#sevPage .sev-main').scrollTop=160;});
  const scroll0=await page.locator('#sevPage .sev-main').evaluate(e=>e.scrollTop);
  await page.locator('[data-sev^="prepare:"]').click();
  check(await page.evaluate(()=>__features.seCare.state().open),'Prepare horse opens the horse overview');
  await page.locator('[data-care-back]').click();
  await page.waitForFunction(()=>__features.seEvents.state.page==='h1'&&document.querySelector('[data-sev^="prepare:"]')===document.activeElement);
  report.returned=await page.evaluate(()=>({page:__features.seEvents.state.page,diff:__features.seEvents.state.diff,scroll:document.querySelector('#sevPage .sev-main').scrollTop}));
  check(report.returned.diff===0&&Math.abs(report.returned.scroll-scroll0)<2,'Returning from care preserves the event, difficulty, scroll and focus');
  await page.evaluate(()=>__qaStep(400));await shot('event-desktop');
  for(const size of [{width:390,height:844},{width:320,height:568},{width:844,height:390}]){
   await page.setViewportSize(size);await page.evaluate(()=>__qaStep(17));
   report.layouts[size.width+'-event']=await page.locator('#sevPage').evaluate(e=>{const m=e.querySelector('.sev-main'),b=e.querySelector('[data-sev="ride"]'),r=b.getBoundingClientRect(),mr=m.getBoundingClientRect();return {width:m.clientWidth,scroll:m.scrollWidth,clipped:[...m.querySelectorAll('*')].filter(n=>{const q=n.getBoundingClientRect();return q.width&&(q.left<mr.left-1||q.right>mr.right+1||n.scrollWidth>n.clientWidth+1);}).map(n=>n.tagName+'.'+n.className),button:{x:r.x,y:r.y,right:r.right,bottom:r.bottom,height:r.height}};});
   const layout=report.layouts[size.width+'-event'];check(layout.clipped.length===0,'Event content and labels fit '+size.width+'px');
   check(layout.button.x>=0&&layout.button.right<=size.width+1&&layout.button.y>=0&&layout.button.bottom<=size.height+1&&layout.button.height>=44,'Event entry remains reachable at '+size.width+'×'+size.height);
   await page.locator('.sev-preparation').scrollIntoViewIfNeeded();await shot('event-'+size.width);
   await page.locator('[data-sev^="prepare:"]').click();await page.evaluate(()=>{__features.seCare.open('feeding');__qaStep(17);});
   report.layouts[size.width+'-care']=await page.locator('#seOvBody').evaluate(e=>({width:e.clientWidth,scroll:e.scrollWidth}));
   const care=report.layouts[size.width+'-care'];check(care.scroll<=care.width+1,'Bonding and food cards fit '+size.width+'px');await shot('bonding-'+size.width);
   check(await page.locator('.sv-rail').evaluate(e=>[...e.querySelectorAll('.sv-tab')].every(b=>b.scrollWidth<=b.clientWidth)),'Horse navigation labels fit '+size.width+'px');
   await page.evaluate(()=>{__features.seCare.close();__features.seEvents.open();__features.seEvents.openPage('h1');});await page.locator('[data-sev="diff:0"]').click();
  }
  await page.locator('[data-sev="ride"]').click();
  report.entry=await page.evaluate(()=>({course:!!__features.course.get(),page:__features.seEvents.state.on,errors:__features.errors}));
  check(report.entry.course&&!report.entry.page,'Enter event starts the real course and closes the menu');
  check(report.errors.length===0&&report.entry.errors.length===0,'No browser or feature runtime errors');
  report.audio=await page.evaluate(async()=>{
   const {playHoofImpact}=await import('./assets/riding-feedback.js?v=riding-life-1'),results={};
   for(const surface of ['grass','soil','wood','water']){const c=new OfflineAudioContext(1,7200,48000);playHoofImpact(c,{surface});const data=(await c.startRendering()).getChannelData(0);results[surface]={peak:Math.max(...data.map(Math.abs)),energy:data.reduce((s,v)=>s+v*v,0)};}return results;
  });
  check(Object.values(report.audio).every(a=>a.peak>0&&a.peak<1)&&report.audio.grass.energy<report.audio.wood.energy,'All four ground sounds render without clipping, with softer turf');
  await page.close();
  const phone=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
  await phone.routeWebSocket('**',ws=>ws.close());phone.on('pageerror',e=>report.errors.push(e.message));
  await phone.goto(QA.BASE+'/ranch3d.html?qa=riding-life-touch&emoji=0',{timeout:120000});
  await phone.waitForFunction(()=>window.__features?.seEvents&&!document.getElementById('load'),null,{timeout:120000});
  await phone.evaluate(()=>{const G=__features;advanceTime(0);G.save.sync(s=>{s.rider.made=true;});G.wardrobe.closeChar();G.hidePanels();G.audio.setMuted(true);G.seCare.open('feeding');advanceTime(17);});
  const treats=await phone.evaluate(()=>__features.save.fresh().items.carrot);
  await phone.locator('[data-se="care:carrot"]').tap();
  check(await phone.evaluate(()=>__features.save.fresh().items.carrot)===treats-1,'Touch tap feeds the horse once');
  await phone.evaluate(()=>{__features.seCare.close();__features.seEvents.open();__features.seEvents.openPage('h1');});
  await phone.locator('[data-sev="diff:0"]').tap();
  check((await phone.locator('.pb-guide').innerText()).includes('Tap Jump'),'Touch event instructions name the actual Jump control');
  await phone.locator('[data-sev^="prepare:"]').tap();await phone.locator('[data-care-back]').tap();
  await phone.waitForFunction(()=>__features.seEvents.state.page==='h1'&&document.querySelector('[data-sev^="prepare:"]')===document.activeElement);
  check(await phone.locator('[data-sev="ride"]').isEnabled(),'Touch preparation roundtrip returns to an eligible event');
  await phone.screenshot({path:path.join(out,'event-touch.png')});await phone.close();
  check(report.errors.length===0,'Touch browser reports no runtime errors');
  report.pass=true;console.log(JSON.stringify({pass:true,checks:report.checks.length}));
 }catch(e){report.pass=false;report.error=e.stack;await shot('failure').catch(()=>{});throw e;}
 finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

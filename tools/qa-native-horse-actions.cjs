/* Isolated save; no multiplayer traffic. Exercises the shipped menus and rigs. */
const QA=require('./qa-platform.cjs'),fs=require('node:fs'),assert=require('node:assert/strict');
const out=process.env.QA_OUT||'/private/tmp/meadowlark-horse-actions';
(async()=>{
 const browser=await QA.chromium.launch({headless:true,args:QA.gpuArgs()}),page=await browser.newPage({viewport:{width:1280,height:850}}),report={checks:[],errors:[]};
 const check=(ok,label)=>{assert.ok(ok,label);report.checks.push(label);console.log('PASS '+label);};
 await page.routeWebSocket('**',ws=>ws.close());page.on('pageerror',e=>report.errors.push(e.message));page.on('dialog',d=>d.dismiss());fs.mkdirSync(out,{recursive:true});
 try{
  await page.goto(QA.BASE+'/ranch3d.html?qa=horse-actions&emoji=0',{timeout:120000});
  await page.waitForFunction(()=>window.__features?.seCare&&__features.onFoot,null,{timeout:120000});
  await page.waitForFunction(()=>!document.getElementById('load'),null,{timeout:120000});
  await page.evaluate(()=>{
   const G=__features;advanceTime(0);G.save.sync(s=>{s.rider.made=true;s.horses[G.horse.rideIdx()].bond=100;});G.horse.reloadHorses();G.wardrobe.closeChar();G.hidePanels();G.audio.setMuted(true);G.riding.releaseAll();document.activeElement?.blur();
   const p=G.horse.player;p.pos.set(-7,0,10);p.speed=0;p.heading=0;
   window.__qaStep=ms=>{const render=G.renderer.render;G.renderer.render=function(scene,camera,...rest){if(camera!==G.camera)return render.call(this,scene,camera,...rest);};try{advanceTime(ms);}finally{G.renderer.render=render;}advanceTime(0);};
   window.__qaSide=()=>{const p=G.horse.player,T=G.THREE,cam=new T.PerspectiveCamera(38,1280/850,.05,100),h=G.onFoot.horse(),center=new T.Vector3(h?.x??p.pos.x,1.4,h?.z??p.pos.z);cam.position.copy(center).add(new T.Vector3(-5.4,.8,3.3));cam.lookAt(center);G.renderer.render(G.scene,cam);};
   __qaStep(100);
  });
  await page.waitForFunction(()=>__features.horse.RIG().ready&&__features.horse.RIG().heroMotion?.supportedActions?.length===7,null,{timeout:90000});
  check(await page.evaluate(()=>__features.errors.length===0),'Feature packages install without errors');
  if(!process.env.QA_ACTION_EXTRAS_ONLY){
  await page.evaluate(()=>__features.seCare.open('feeding'));
  await page.locator('[data-se="open:actions"]').click();
  check(await page.locator('#emotePanel [data-fx^="bpe:hem:"]').count()===7,'Horse care opens all seven supported actions');
  await page.locator('#emotePanel [data-fx="bpe:hem:rear"]').click();
  report.rear=await page.evaluate(()=>{const G=__features,r=G.horse.RIG(),p=G.horse.player;__qaStep(1600);return {state:r.heroMotion.state,emote:r.emote,rider:p.rider.g.quaternion.toArray(),finite:r.bones.every(b=>b.matrixWorld.elements.every(Number.isFinite))};});
  check(report.rear.state.action?.type==='rear'&&report.rear.finite,'Menu starts a finite native rear');
  check(Math.abs(report.rear.rider[0])>.15,'Mounted rider follows the rearing saddle');
  check(Math.abs(report.rear.state.action.timeS-report.rear.emote.t)<1e-6,'Action and UI use one clock');
  await page.evaluate(()=>{__features.hidePanels();__qaSide();});await page.screenshot({path:out+'/rear-mounted.png'});
  await page.evaluate(()=>__qaStep(2700));
  check(await page.evaluate(()=>!__features.horse.RIG().heroMotion.state.action&&!__features.horse.RIG().emote),'Rear returns to idle and clears UI');
  for(const type of ['nuzzle','toss','graze','bow','kick']){
   const row=await page.evaluate(type=>{const G=__features,r=G.horse.RIG(),accepted=G.horse.horseEmote(type);__qaStep(750);const mid=r.heroMotion.state.action;__qaStep(8000);return {accepted,mid,end:r.heroMotion.state.action,finite:r.bones.every(b=>b.matrixWorld.elements.every(Number.isFinite))};},type);
   check(row.accepted&&row.mid?.type===type&&!row.end&&row.finite,type+' starts and returns to idle on the real mount');
  }
  const interrupted=await page.evaluate(()=>{const G=__features;G.horse.horseEmote('rear');__qaStep(700);G.riding.selectGait('walk');window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyW',bubbles:true}));__qaStep(700);window.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyW',bubbles:true}));G.riding.releaseAll();const r=G.horse.RIG(),ended=!r.heroMotion.state.action;G.horse.player.speed=0;__qaStep(400);return ended;});
  check(interrupted,'Moving away safely cancels an action');
  await page.evaluate(()=>{const G=__features;G.horse.player.speed=0;G.horse.player.y=0;G.horse.player.flying=false;G.horse.horseEmote('liedown');});
  await page.waitForFunction(()=>__features.onFoot.horseActionTarget(),null,{timeout:90000});
  report.rest=await page.evaluate(()=>{const G=__features;__qaStep(3900);const state=G.onFoot.state(),courseBlocked=G.run('courseGate',{},0);G.onFoot.mount();return {state,courseBlocked,queued:G.onFoot.state()};});
  check(report.rest.state.on&&report.rest.state.horse.action?.type==='liedown','Lie down dismounts the rider and animates the parked horse');
  check(report.rest.courseBlocked,'Events wait for the horse to get up');
  check(report.rest.queued.on&&report.rest.queued.horse.departure==='mount','Mount waits for the full get-up animation');
  await page.evaluate(()=>__qaSide());await page.screenshot({path:out+'/lie-down.png'});
  await page.evaluate(()=>__qaStep(5600));
  check(await page.evaluate(()=>!__features.onFoot.on&&__features.horse.player.mesh.visible&&!__features.horse.RIG().heroMotion.state.action),'Queued mount completes after get-up');
  check(await page.evaluate(()=>!__features.run('courseGate',{},0)),'Course guard releases after the action');
  }
  await page.evaluate(()=>{const G=__features;G.save.sync(s=>{s.horses[G.horse.rideIdx()].needs.happy=70;});G.seCare.open('feeding');});await page.locator('#seOvBody [data-se="care:pet"]').click();
  check(await page.evaluate(()=>__features.horse.RIG().heroMotion.state.action?.type==='nuzzle'),'Petting plays the native nuzzle');
  await page.evaluate(()=>{__features.seCare.close();__qaStep(3500);});
  await page.evaluate(()=>__features.ui.dispatch('open:emotePanel'));
  for(const width of [390,320]){await page.setViewportSize({width,height:844});const layout=await page.locator('#emotePanel').evaluate(e=>({width:e.clientWidth,scroll:e.scrollWidth,buttons:[...e.querySelectorAll('[data-fx^="bpe:hem:"]')].map(b=>{const r=b.getBoundingClientRect();return {height:r.height,left:r.left,right:r.right};})}));check(layout.scroll<=layout.width+1&&layout.buttons.every(r=>r.left>=0&&r.right<=width+1&&r.height>=40),'Action buttons fit '+width+'px phone screen');await page.screenshot({path:out+'/actions-'+width+'.png'});}
  await page.setViewportSize({width:1280,height:850});
  for(const key of ['welsh','pegasus']){
   const index=await page.evaluate(key=>{const G=__features;G.hidePanels();G.save.sync(s=>{const h=G.horse.grantHorse(s,key,{name:'Animation review'});for(const h of s.horses)h.bond=100;});G.horse.reloadHorses();G.horse.rebuildAll();return G.horse.myHorses.findIndex(h=>h.breed===key);},key);
   await page.selectOption('#horseSel',String(index),{force:true});
   await page.waitForFunction(key=>__features.horse.RIG().modelKey===key&&__features.horse.RIG().attachedTo===__features.horse.player.mesh,key,{timeout:90000});
   const state=await page.evaluate(()=>{const G=__features,r=G.horse.RIG();G.hidePanels();G.horse.player.speed=0;__qaStep(200);const accepted=G.horse.horseEmote('rear');__qaStep(1600);return {accepted,actions:r.heroMotion.supportedActions,finite:r.bones.every(b=>b.matrixWorld.elements.every(Number.isFinite))&&G.horse.player.rider.g.matrixWorld.elements.every(Number.isFinite)};});
   check(state.accepted&&state.actions.length===7&&state.finite,key+' has all actions and a finite rider on its native rig');
   await page.evaluate(()=>__qaSide());await page.screenshot({path:out+'/rear-'+key+'.png'});await page.evaluate(()=>__qaStep(2600));
  }
  check(report.errors.length===0&&await page.evaluate(()=>__features.errors.length===0),'No browser or feature errors');
 }finally{fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});

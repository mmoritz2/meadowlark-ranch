/* Adventures acceptance checks on a disposable offline browser save.
   Player-only small scripted steps exercise real clues, calming, follower steering,
   herd pressure, and pen crossings. No actor positions, objectives, rewards, or
   progress are injected. This is simulated riding; keyboard playability is separate.
   QA_PORT=8595 PLAYWRIGHT_PATH=/path/to/playwright node tools/qa-adventures.cjs
   QA_ADVENTURE_GUARDS_ONLY=1 limits the run to landscape and flight/dismount checks. */
const QA=require('./qa-platform.cjs'),fs=require('node:fs'),assert=require('node:assert/strict');
const out=process.env.QA_OUT||'/private/tmp/meadowlark-adventures';
const report={checks:[],errors:[],method:'Player-only continuous scripted steps; real rescue and herd simulation'};
const check=(ok,label,detail)=>{assert.ok(ok,label+(detail?' — '+JSON.stringify(detail):''));report.checks.push(label);console.log('PASS '+label);};
let browser;
const watchdog=setTimeout(()=>{console.error('Adventures QA exceeded 9 minutes');browser?.close().finally(()=>process.exit(3));},540000);watchdog.unref();
async function boot(page){
 await page.goto(QA.BASE+'/ranch3d.html?qa=adventures&emoji=0',{timeout:120000});
 await page.waitForFunction(()=>window.__features?.rescueRide&&__features.roundupUI&&__features.rideHub&&!document.getElementById('load'),null,{timeout:150000});
 await page.evaluate(()=>{
  const G=__features;advanceTime(0);G.save.sync(s=>{s.rider.made=true;});G.wardrobe.closeChar();G.hidePanels();G.seFrame?.settle();G.audio.setMuted(true);G.riding.releaseAll();document.activeElement?.blur();
  window.__qaStep=ms=>{const render=G.renderer.render;G.renderer.render=function(scene,camera,...rest){if(camera!==G.camera)return render.call(this,scene,camera,...rest);};try{advanceTime(ms);}finally{G.renderer.render=render;}};
  window.__qaEvents={rescues:[],roundups:[],pens:[]};G.on('rescueFinish',r=>__qaEvents.rescues.push(r));G.on('roundupFinish',r=>__qaEvents.roundups.push(r));G.on('roundupPen',r=>__qaEvents.pens.push(r));
  window.__qaMove=(x,z,{tolerance=.5,maxSteps=2500,speed=3}={})=>{
   const p=G.horse.player;let steps=0;
   while(Math.hypot(x-p.pos.x,z-p.pos.z)>tolerance){
    if(++steps>maxSteps)throw Error('Player movement stalled '+JSON.stringify({from:[p.pos.x,p.pos.z],to:[x,z],rescue:G.rescueRide.snapshot().active}));
    const dx=x-p.pos.x,dz=z-p.pos.z,d=Math.hypot(dx,dz),step=Math.min(.1,d);p.heading=Math.atan2(dx,dz);p.speed=speed;p.pos.x+=dx/d*step;p.pos.z+=dz/d*step;__qaStep(20);
   }
   p.speed=0;G.riding.releaseAll();return steps;
  };
  window.__qaIdle=ms=>{G.horse.player.speed=0;G.riding.releaseAll();__qaStep(ms);};
  window.__qaSnapshot=()=>({rescue:G.rescueRide.snapshot(),roundup:G.roundup.state(),coins:G.save.fresh().coins,horses:G.save.fresh().horses.map(h=>({id:h.id,name:h.name,rescueClover:h.rescueClover})),events:__qaEvents});
  window.__qaBlockedEntries=()=>{
   const p=G.horse.player,before=[p.pos.x,p.pos.z],rush=G.ranchRush.start('rush-pasture');
   G.course.startCourse(G.tables.EVENTS3.find(e=>e.id==='rr'),0);
   G.course.startDressage(G.tables.EVENTS3.find(e=>G.course.DRESSAGE_TESTS[e.id]));
   G.course.startDrill('speed');G.trail.start([['A',0,0],['B',10,10]],'QA');
   document.querySelector('#ftBar [data-ft="0"]').click();
   return {rush,course:!!G.course.get(),drill:G.course.drillActive(),trail:!!G.trail.ride,moved:Math.hypot(p.pos.x-before[0],p.pos.z-before[1])};
  };
  __qaIdle(1500);
 });
 await page.waitForFunction(()=>__features.horse.RIG().ready&&!__features.horse.RIG().loadingBreed,null,{timeout:90000});
 await page.evaluate(()=>__qaIdle(1500));
}
async function screenshot(page,name){await page.evaluate(()=>advanceTime(0));await page.screenshot({path:out+'/'+name+'.png'});}
const overlap=(a,b)=>a&&b&&a.left<b.right-1&&a.right>b.left+1&&a.top<b.bottom-1&&a.bottom>b.top+1;
async function mobile(page,active=false){
 const reassuring=active&&await page.evaluate(()=>__features.rescueRide.snapshot().active?.stage==='calm');
 for(const [width,height] of reassuring?[[390,844],[320,844],[844,390],[667,375]]:[[390,844],[320,844]]){
  await page.setViewportSize({width,height});await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await page.evaluate(()=>{__qaStep(200);advanceTime(0);});
  const boxes=await page.evaluate(()=>{
   const rect=id=>{const e=document.getElementById(id);if(!e)return null;const s=getComputedStyle(e),r=e.getBoundingClientRect();return s.display==='none'||s.visibility==='hidden'||+s.opacity===0||!r.width||!r.height?null:{left:r.left,right:r.right,top:r.top,bottom:r.bottom};};
   return Object.fromEntries(['rushQuick','rescueHud','roundupGuide','seJump','seGaitDock','seRidePace','stickZone','sgFocus'].map(id=>[id,rect(id)]));
  });
  const h=boxes[active?'rescueHud':'rushQuick'];
  check(h&&h.left>=0&&h.right<=width+1&&h.top>=0&&h.bottom<=height+1&&!['seJump','seGaitDock','seRidePace','stickZone'].some(id=>overlap(h,boxes[id])),(active?'Rescue guidance':'Free riding activity entry')+' clears mobile controls at '+width+'px',boxes);
  await screenshot(page,(reassuring?'reassure':active?'rescue':'free')+'-'+width+'x'+height);
 }
 await page.setViewportSize({width:1280,height:850});
}
async function focusedGuardsAndLandscape(page){
 const faults=[];report.landscape=[];
 for(const [width,height] of [[844,390],[667,375]]){
  await page.setViewportSize({width,height});
  for(const mode of ['free','rescue','roundup']){
   const state=await page.evaluate(mode=>{
    const G=__features;G.rescueRide.cancel();G.roundup.cancel();G.hidePanels();G.seFrame?.settle();__qaIdle(1500);
    const started=mode==='rescue'?G.rescueRide.start():mode==='roundup'?G.roundup.start('beginner'):true;
    __qaIdle(mode==='roundup'?3400:200);const p=G.horse.player,before=[p.pos.x,p.pos.z];G.riding.selectGait('walk');
    document.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyW',key:'w',bubbles:true}));__qaStep(700);document.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyW',key:'w',bubbles:true}));G.riding.releaseAll();__qaStep(200);advanceTime(0);
    const rect=id=>{const e=document.getElementById(id);if(!e)return null;const s=getComputedStyle(e),r=e.getBoundingClientRect();return s.display==='none'||s.visibility==='hidden'||+s.opacity===0||!r.width||!r.height?null:{left:r.left,right:r.right,top:r.top,bottom:r.bottom};};
    return {started,moved:Math.hypot(p.pos.x-before[0],p.pos.z-before[1]),boxes:Object.fromEntries(['rushQuick','rescueHud','roundupGuide','seNavPlate','seMenuBtn','seQuickToggle','mini','wallet','seJump','seGaitDock','seRidePace','stickZone','seGoal'].map(id=>[id,rect(id)]))};
   },mode);
   check(state.started&&state.moved>.1,'Actual riding input moves in '+mode+' at '+width+'×'+height,state);
   const id={free:'rushQuick',rescue:'rescueHud',roundup:'roundupGuide'}[mode],h=state.boxes[id],hits=Object.entries(state.boxes).filter(([key,r])=>!['rushQuick','rescueHud','roundupGuide'].includes(key)&&overlap(h,r)).map(([key])=>key);
   if(!h||h.left<0||h.right>width+1||h.top<0||h.bottom>height+1||hits.length)faults.push({width,height,mode,hits,boxes:state.boxes});
   report.landscape.push({width,height,mode,...state});await screenshot(page,mode+'-'+width+'x'+height);
  }
 }
 const guards=await page.evaluate(()=>{
  const G=__features;G.roundup.cancel();G.hidePanels();G.seFrame?.settle();__qaIdle(1500);let flights=0;G.on('activityGate',kind=>{if(kind==='flight')flights++;});
  const rescue=G.rescueRide.start();document.getElementById('flyBtn').click();const rescueFlight={attempts:flights,flying:G.horse.player.flying,active:!!G.rescueRide.snapshot().active};
  const off=G.onFoot.dismount();__qaStep(200);const rescueFoot={off,on:G.onFoot.on,active:!!G.rescueRide.snapshot().active};
  G.onFoot.mount({here:true});G.rescueRide.cancel();__qaIdle(1500);const round=G.roundup.start('beginner');document.getElementById('flyBtn').click();const roundOff=G.onFoot.dismount();__qaStep(200);
  const roundup={round,attempts:flights,flying:G.horse.player.flying,off:roundOff,on:G.onFoot.on,active:G.roundup.state().active};G.roundup.cancel();return {rescue,rescueFlight,rescueFoot,roundup};
 });report.guards=guards;
 check(guards.rescue&&guards.rescueFlight.attempts===1&&!guards.rescueFlight.flying&&guards.rescueFlight.active,'Rescue flight attempt reaches activity gate and is rejected',guards.rescueFlight);
 check(guards.rescueFoot.off&&guards.rescueFoot.on&&guards.rescueFoot.active,'Rescue permits dismounting without ending the activity',guards.rescueFoot);
 check(guards.roundup.round&&guards.roundup.attempts===2&&!guards.roundup.flying&&!guards.roundup.off&&!guards.roundup.on&&guards.roundup.active,'Roundup rejects flight and dismount while keeping the herd active',guards.roundup);
 check(!report.errors.length,'Focused mobile and guard tests have no browser errors',report.errors);
 report.layoutFaults=faults;check(!faults.length,'All landscape activity panels clear movement and top controls',faults);
}
(async()=>{
 fs.mkdirSync(out,{recursive:true});browser=await QA.chromium.launch({headless:true,args:QA.gpuArgs()});
 const page=await browser.newPage({viewport:{width:1280,height:850},hasTouch:true});
 await page.routeWebSocket('**',ws=>ws.close());page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!/WebSocket|net::ERR|Failed to load resource/i.test(m.text()))report.errors.push(m.text());});page.on('dialog',d=>d.dismiss());
 try{
  await boot(page);check(await page.evaluate(()=>!__features.errors.length),'All adventure packages install');
  if(process.env.QA_ADVENTURE_GUARDS_ONLY){await focusedGuardsAndLandscape(page);return;}
  await mobile(page);
  await page.evaluate(()=>__features.rideHub.open());check(await page.locator('#rideHubPanel').isVisible(),'Unified activities hub opens');
  for(const width of [390,320]){
   await page.setViewportSize({width,height:844});
   const layout=await page.locator('#rideHubPanel').evaluate(e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,width:e.clientWidth,scroll:e.scrollWidth,buttons:[...e.querySelectorAll('button')].filter(b=>b.offsetParent).map(b=>{const r=b.getBoundingClientRect();return {action:b.dataset.fx,left:r.left,right:r.right,height:r.height};})};});
   check(layout.left>=0&&layout.right<=width+1&&layout.scroll<=layout.width+1&&layout.buttons.every(b=>b.left>=0&&b.right<=width+1&&b.height>=40),'Activity hub buttons fit '+width+'px',layout);
   await screenshot(page,'hub-'+width);
  }
  await page.setViewportSize({width:1280,height:850});
  if(process.env.QA_ADVENTURE_UI_ONLY)return;
  const before=await page.evaluate(()=>__qaSnapshot());
  await page.locator('[data-fx="adventure:rescue"]').click();
  check(await page.evaluate(()=>__features.rescueRide.snapshot().active?.stage==='find'),'Rescue button starts the real clue trail');
  check(await page.evaluate(()=>!__features.rescueRide.adopt()),'Clover cannot be adopted before a completed rescue');
  const blocked=await page.evaluate(()=>({...__qaBlockedEntries(),roundup:__features.roundup.start('beginner'),active:!!__features.rescueRide.snapshot().active}));
  check(blocked.active&&!blocked.rush&&!blocked.roundup&&!blocked.course&&!blocked.drill&&!blocked.trail&&blocked.moved===0,'Rescue blocks events, Rush, drills, trails, roundup and fast travel',blocked);
  await mobile(page,true);
  const clueRun=await page.evaluate(()=>{
   const G=__features,visited=[];for(let i=0;i<2;i++){const a=G.rescueRide.snapshot().active;__qaMove(a.target.x,a.target.z);visited.push(G.rescueRide.snapshot().active);}
   return visited;
  });
  check(clueRun[0]?.clues===1&&clueRun[1]?.clues===2&&clueRun[1]?.stage==='calm','Both clues advance only after physical proximity',clueRun);
  const reaction=await page.evaluate(()=>{
   const G=__features,before=G.rescueRide.snapshot().active.horse,at=G.rescueRide.snapshot().active.target;
   __qaMove(at.x-7,at.z,{speed:8});__qaStep(700);
   const after=G.rescueRide.snapshot().active;__qaIdle(5000);return {before,after};
  });
  check(Math.hypot(reaction.after.horse.x-reaction.before.x,reaction.after.horse.z-reaction.before.z)>.3&&reaction.after.stage==='calm','Rushing Clover causes a real retreat without skipping the trust stage',reaction);
  await page.evaluate(()=>{const a=__features.rescueRide.snapshot().active;__qaMove(a.target.x-3,a.target.z,{speed:1});__qaIdle(300);});
  const calmPause=await page.evaluate(()=>{
   const G=__features,before=G.rescueRide.snapshot().active.horse.calm;G.ui.open('questPanel');G.seFrame?.settle();__qaIdle(2200);const after=G.rescueRide.snapshot().active.horse.calm,reassured=G.rescueRide.reassure();G.hidePanels();G.seFrame?.settle();return {before,after,reassured};
  });
  check(calmPause.before===calmPause.after&&!calmPause.reassured,'Opening a menu pauses trust and rejects reassurance',calmPause);
  await page.evaluate(()=>__qaIdle(5000));
  check(await page.evaluate(()=>{const a=__features.rescueRide.snapshot().active;return a?.stage==='calm'&&a.interaction?.eligible;}),'A patient approach opens reassurance without passively completing trust');
  check(await page.evaluate(()=>{const button=document.getElementById('rescueReassure');button.focus();__qaStep(350);return document.activeElement===button&&document.getElementById('rescueReassure')===button&&!button.disabled;}),'Reassurance button keeps keyboard focus while the HUD updates');
  await screenshot(page,'ready-to-reassure');
  await mobile(page,true);
  await page.locator('#rescueReassure').click();
  check(await page.evaluate(()=>__features.rescueRide.snapshot().active?.stage==='escort'&&!__features.rescueRide.reassure()),'Reassure button earns trust exactly once and starts the real escort');
  await screenshot(page,'escort-start');
  const escort=await page.evaluate(()=>{
   const G=__features,p=G.horse.player,steps=[];let last=-1;
   for(let n=0;n<12000&&G.rescueRide.snapshot().active;n++){
    const a=G.rescueRide.snapshot().active;if(a.stage!=='escort')throw Error('Escort unexpectedly changed '+a.stage);
    if(last!==a.returnStep){steps.push({step:a.returnStep,horse:{x:a.horse.x,z:a.horse.z}});last=a.returnStep;}
    const d=Math.hypot(a.target.x-p.pos.x,a.target.z-p.pos.z);
    if(a.horse.distance<12&&d>1){const dx=a.target.x-p.pos.x,dz=a.target.z-p.pos.z,move=Math.min(.075,d);p.heading=Math.atan2(dx,dz);p.speed=2;p.pos.x+=dx/d*move;p.pos.z+=dz/d*move;}else p.speed=0;
    __qaStep(20);
   }
   p.speed=0;G.riding.releaseAll();return {steps,...__qaSnapshot()};
  });report.rescue=escort;
  check(!escort.rescue.active&&escort.rescue.records.completions===before.rescue.records.completions+1&&escort.steps.length===3,'Clover physically follows all three homeward corners',escort.rescue);
  check(escort.events.rescues.length===1&&escort.rescue.lastResult.pay.c===180&&escort.coins>=before.coins+180,'Escort emits one completion and pays its earned purse');
  await page.locator('#rideHubPanel').waitFor({state:'visible',timeout:10000});check(await page.evaluate(()=>__features.rideHub.state().mode==='rescue-result'),'Rescue opens its adoption result');
  await screenshot(page,'rescue-result');
  const adoptBefore=await page.evaluate(()=>__qaSnapshot());await page.locator('[data-fx="adventure:adopt"]').click();
  const adopted=await page.evaluate(()=>{const first=__qaSnapshot(),again=__features.rescueRide.adopt();return {first,again,after:__qaSnapshot()};});
  check(adopted.first.horses.length===adoptBefore.horses.length+1&&adopted.first.horses.filter(h=>h.rescueClover).length===1&&adopted.first.rescue.records.adopted,'Adopt button adds one real Clover to the stable');
  check(!adopted.again&&adopted.after.horses.length===adopted.first.horses.length&&adopted.after.coins===adopted.first.coins,'Repeated adoption cannot add another horse or pay again');
  await boot(page);const reloaded=await page.evaluate(()=>__qaSnapshot());
  check(reloaded.rescue.records.adopted&&reloaded.horses.filter(h=>h.rescueClover).length===1&&reloaded.rescue.records.bestTime===adopted.first.rescue.records.bestTime,'Rescue record and one-time adoption survive reload');
  const cancel=await page.evaluate(()=>{const G=__features,before=__qaSnapshot();const started=G.rescueRide.start();__qaStep(200);G.rescueRide.cancel();__qaStep(200);return {started,before,after:__qaSnapshot(),actors:G.scene.children.filter(o=>o.name==='Clover rescue horse'||o.name==='Clover rescue trail').length};});
  check(cancel.started&&!cancel.after.rescue.active&&cancel.after.coins===cancel.before.coins&&cancel.after.rescue.records.completions===cancel.before.rescue.records.completions&&!cancel.actors,'Leaving rescue removes its actors and grants no rewards');
  if(process.env.QA_ADVENTURE_RESCUE_ONLY)return;
  check(await page.evaluate(()=>__features.roundup.start('beginner')),'Gentle roundup starts immediately');
  const herdBlocked=await page.evaluate(()=>({...__qaBlockedEntries(),rescue:__features.rescueRide.start(),roundup:__features.roundup.state()}));
  check(!herdBlocked.rescue&&!herdBlocked.rush&&!herdBlocked.course&&!herdBlocked.drill&&!herdBlocked.trail&&!herdBlocked.moved&&herdBlocked.roundup.active&&herdBlocked.roundup.total===3,'Three-horse roundup excludes all other timed activities and travel',herdBlocked);
  await page.evaluate(()=>__qaIdle(3400));const herdBefore=await page.evaluate(()=>__qaSnapshot());
  const herd=await page.evaluate(()=>{
   const G=__features,p=G.horse.player;
   for(let n=0;n<16000&&G.roundup.state().active;n++){
    const s=G.roundup.state(),h=s.target;if(!h)break;const dx=s.pen.x-h.x,dz=s.pen.z-h.z,l=Math.hypot(dx,dz)||1,ux=dx/l,uz=dz/l;
    const along=(p.pos.x-h.x)*ux+(p.pos.z-h.z)*uz,side=(p.pos.x-h.x)*(-uz)+(p.pos.z-h.z)*ux;let x=h.standX,z=h.standZ;
    if(along>-5){const sign=Math.sign(side)||1;x=h.x-ux*8-uz*sign*17;z=h.z-uz*8+ux*sign*17;}
    const qx=x-p.pos.x,qz=z-p.pos.z,d=Math.hypot(qx,qz);if(d>.4){const move=Math.min(.13,d);p.heading=Math.atan2(qx,qz);p.speed=3;p.pos.x+=qx/d*move;p.pos.z+=qz/d*move;}else p.speed=0;
    __qaStep(20);
   }
   p.speed=0;G.riding.releaseAll();return __qaSnapshot();
  });report.roundup=herd;
  check(!herd.roundup.active&&herd.roundup.lastResult?.penned===3&&herd.events.pens.length===3,'Pressure and actual pen crossings bring all three horses home',herd.roundup);
  check(herd.events.roundups.length===1&&herd.coins>=herdBefore.coins+herd.roundup.lastResult.pay,'Roundup completes and pays exactly once');
  await page.locator('#roundupResultPanel').waitFor({state:'visible',timeout:10000});await screenshot(page,'roundup-result');
  const dedupe=await page.evaluate(()=>{const G=__features,before=__qaSnapshot();G.ui.open('roundupResultPanel');G.roundup.cancel();__qaStep(100);return {before,after:__qaSnapshot()};});
  check(dedupe.after.coins===dedupe.before.coins&&dedupe.after.roundup.records.beginner.plays===dedupe.before.roundup.records.beginner.plays,'Reopening results and cancelling a finished round grants nothing');
  await page.locator('[data-fx="herd:retry"]').click();
  check(await page.evaluate(()=>__features.roundup.state().active&&__features.roundup.state().total===3),'Ride again starts immediately with no cooldown');
  await page.evaluate(()=>__features.roundup.cancel());check(await page.evaluate(()=>__features.roundup.start('full')&&__features.roundup.state().total===5),'Full herd offers five horses');
  const fullCancel=await page.evaluate(()=>{const G=__features,b=G.save.fresh().coins;G.roundup.cancel();__qaStep(200);return {active:G.roundup.state().active,coins:G.save.fresh().coins,b,actors:G.scene.children.filter(o=>o.name==='Roundup horse').length};});
  check(!fullCancel.active&&fullCancel.coins===fullCancel.b,'Leaving a full herd does not pay');
  const rush=await page.evaluate(()=>{const G=__features;G.hidePanels();G.seFrame?.settle();__qaIdle(1500);const ok=G.ranchRush.start('rush-pasture'),id=G.course.get()?.ev.id;G.course.cancelCourse();return {ok,id,active:G.ranchRush.snapshot().active};});
  check(rush.ok&&rush.id==='rush-pasture'&&!rush.active,'Existing Ranch Rush remains available after adventures',rush);
  check(report.errors.length===0&&await page.evaluate(()=>!__features.errors.length),'No browser or feature errors');
 }finally{clearTimeout(watchdog);fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

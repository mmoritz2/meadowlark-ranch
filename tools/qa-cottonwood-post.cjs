/* Focused Cottonwood courier QA. Root is the sole browser/GPU runner.
   A disposable save and ONE initial placement near Wren are fixtures. After
   mission entry, both routes use Playwright keyboard events and the production
   riding loop. No player-position, mission-progress or reward edits are made.
   The second route takes the optional woodland log with a real Space jump,
   then isolates a final-save failure and retry.
   QA_PORT defaults to 8597; QA_URL, QA_OUT and QA_HEADLESS remain configurable. */
if(!process.env.QA_PORT&&!process.env.QA_URL)process.env.QA_PORT='8597';
const QA=require('./qa-platform.cjs'),fs=require('node:fs'),assert=require('node:assert/strict');
const out=process.env.QA_OUT||'/private/tmp/meadowlark-cottonwood-post';
// These are navigation intentions, not player-state mutations. A blocked leg
// fails with its sampled path; this script never teleports out of a collision.
let ROUTE;
const WOODLAND_LOG={center:[-7,-53],approach:[-16,-53],exit:[-2,-53],height:.5,halfWidth:1.7};
const report={evidence:'One synthetic initial placement, then two complete routes ridden with real Playwright keyboard controls. The first uses the road; the second uses the woodland and a physical Space jump over its log. Pickup/return use E; the first Ada exchange uses the mobile contextual touch control. No teleport or synthetic-progress completion claims.',route:null,checks:[],errors:[],console:[],featureErrors:[],routeFocus:[],path:[],runs:[]};
const check=(ok,label,detail)=>{assert.ok(ok,label+(detail?' '+JSON.stringify(detail):''));report.checks.push(label);console.log('PASS '+label);};
const same=(actual,expected,label)=>{assert.deepEqual(actual,expected,label);report.checks.push(label);console.log('PASS '+label);};
let browser,page,sim=0,phase='boot';const held=new Set();
const watchdog=setTimeout(()=>{browser?.close().finally(()=>process.exit(3));},900000);watchdog.unref();
async function keys(want=[]){const next=new Set(want);for(const k of held)if(!next.has(k)){await page.keyboard.up(k);held.delete(k);}for(const k of next)if(!held.has(k)){await page.keyboard.down(k);held.add(k);}}
async function step(ms){sim+=ms/1000;return page.evaluate(ms=>{__postStep(ms);return __postRead();},ms);}
async function read(){return page.evaluate(()=>__postRead());}
async function screenshot(name){await page.evaluate(()=>advanceTime(0));await page.screenshot({path:out+'/'+name+'.png'});}
async function focusRiding(){const size=page.viewportSize();await page.mouse.click(size.width*.72,size.height*.5);}
async function resize(width,height){await keys();await page.setViewportSize({width,height});await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await step(20);}
async function gait(name){await keys();const names=['walk','trot','canter','gallop'];for(let i=0;i<5;i++){const current=await page.evaluate(()=>__features.riding.state().selected);if(current===name)return;await page.keyboard.press(names.indexOf(current)<names.indexOf(name)?']':'[');}throw Error('Normal gait keys did not select gait '+name);}
async function halt(){await keys();for(let i=0;i<80;i++){const s=await read();if(Math.abs(s.position.speed)<.12){await keys();return s;}await keys(s.position.speed>0?['s']:[]);await step(50);}await keys();throw Error('Normal braking did not stop the horse');}
async function rideTo(x,z,label,radius=1.8){
 console.log('RIDE '+label+' '+x+','+z);let recent=[],lastSample=-Infinity;
 for(let i=0;i<1800;i++){
  const s=await read(),p=s.position,d=Math.hypot(x-p.x,z-p.z);
  if(!s.mission.active)throw Error('Courier mission ended while riding '+label+': '+JSON.stringify(s));
  if(sim-lastSample>=1){report.path.push({run:s.mission.active.runId,t:+sim.toFixed(2),leg:label,stage:s.mission.active.stage,x:p.x,z:p.z,speed:p.speed});lastSample=sim;}
  if(d<=radius){await halt();return read();}
  const a=Math.atan2(x-p.x,z-p.z),delta=Math.atan2(Math.sin(a-p.heading),Math.cos(a-p.heading));
  const wanted=[];if(delta>.06)wanted.push('a');if(delta<-.06)wanted.push('d');
  if(Math.abs(delta)<.78)wanted.push('w');else if(p.speed>1.2)wanted.push('s');
  await keys(wanted);await step(80);
  recent.push({t:sim,x:p.x,z:p.z,d});while(recent.length&&sim-recent[0].t>9)recent.shift();
  if(recent.length>90&&Math.hypot(p.x-recent[0].x,p.z-recent[0].z)<.5&&d>radius+1)throw Error('Riding is blocked on '+label+': '+JSON.stringify({target:{x,z},state:s,recent}));
 }
 await keys();throw Error('Normal controls did not reach '+label);
}
async function leg(points,name){for(const [i,p]of points.entries()){const tight=Math.abs(p[0])<8&&p[1]>-33;await gait(tight?'walk':'trot');await rideTo(p[0],p[1],name+' '+(i+1),tight?.7:1.4);}}
async function jumpLog(log){
 // A rider-control driver, not a jump/progress hook. Space must remain down
 // during a real production frame because jumping reads held input each tick.
 const [cx,cz]=log.center,[ex,ez]=log.exit,[ax,az]=log.approach;
 const length=Math.hypot(ex-ax,ez-az),ux=(ex-ax)/length,uz=(ez-az)/length;
 const coordinates=p=>({along:(p.x-cx)*ux+(p.z-cz)*uz,lateral:(p.x-cx)*uz-(p.z-cz)*ux});
 const logGround=await page.evaluate(([x,z])=>__features.world.groundH(x,z),log.center);
 const proof={log,logGround,trace:[],spacePresses:0,crossing:null,landed:false};report.woodlandJump=proof;
 await gait('walk');await rideTo(ax,az,'woodland log approach',.7);await gait('canter');
 const initial=await read();proof.before=initial;check(coordinates(initial.position).along<-2,'Woodland jump begins behind the log on its ridden approach');
 const peak=report.jumpProfile.peakTime;let spaceAt=null,previous=null,gotAir=false,photographed=false;
 for(let i=0;i<900;i++){
  const s=await read(),p=s.position,q=coordinates(p);
  if(!s.mission.active)throw Error('Mission ended during woodland jump: '+JSON.stringify(s));
  const sample={t:+sim.toFixed(3),x:p.x,z:p.z,speed:p.speed,flightY:p.flightY,footY:p.ground+p.flightY,jumpAge:p.jumpAge,grounded:p.grounded,...q};proof.trace.push(sample);
  gotAir=gotAir||p.flightY>.12;
  if(previous&&previous.along<0&&q.along>=0){const u=-previous.along/(q.along-previous.along);proof.crossing={t:previous.t+u*(sample.t-previous.t),lateral:previous.lateral+u*(q.lateral-previous.lateral),flightY:previous.flightY+u*(p.flightY-previous.flightY),footY:previous.footY+u*(sample.footY-previous.footY),speed:previous.speed+u*(p.speed-previous.speed)};}
  if(!photographed&&gotAir&&Math.abs(q.along)<.8){await screenshot('06-woodland-log-jump');photographed=true;}
  if(q.along>2.5&&gotAir&&p.flightY<.03&&p.jumpAge==null){proof.landed=true;proof.after=s;break;}
  if(q.along>Math.hypot(ex-cx,ez-cz)+3)throw Error('Horse passed the woodland exit without a confirmed jump landing');
  const angle=Math.atan2(ex-p.x,ez-p.z),delta=Math.atan2(Math.sin(angle-p.heading),Math.cos(angle-p.heading)),wanted=[];
  if(delta>.035)wanted.push('a');if(delta<-.035)wanted.push('d');if(Math.abs(delta)<.5)wanted.push('w');else if(p.speed>1.2)wanted.push('s');
  // Aim the observed native arc's peak at the log; the game remains responsible
  // for accepting Space, producing the arc and resolving the actual obstacle.
  const lead=Math.max(2.2,Math.min(7,p.speed*peak+.25));
  if(spaceAt===null&&p.speed>2.2&&q.along<0&&-q.along<=lead&&Math.abs(q.lateral)<.75&&Math.abs(delta)<.16){spaceAt=sim;proof.spacePresses++;proof.takeoff={...sample,lead};}
  if(spaceAt!==null&&sim-spaceAt<.12)wanted.push('Space');
  await keys(wanted);previous=sample;await step(40);
 }
 await halt();
 check(proof.spacePresses===1&&gotAir,'One physical Space press produces an airborne woodland jump');
 check(proof.crossing&&Math.abs(proof.crossing.lateral)<log.halfWidth&&proof.crossing.flightY>.12&&proof.crossing.footY>logGround+log.height,'The horse crosses the actual log footprint with observed jump height above its top',proof.crossing);
 check(proof.landed&&proof.after.mission.active.runId===proof.before.mission.active.runId&&proof.after.mission.active.stage==='deliver','The jump lands beyond the log with the same courier delivery active');
 check(proof.after.mission.active.elapsed>proof.before.mission.active.elapsed&&proof.after.mission.active.distance>proof.before.mission.active.distance,'Normal jumping contributes ridden time and distance');
 if(!photographed)throw Error('No rendered airborne log screenshot was captured');
}
async function ready(){
 await page.waitForFunction(()=>{const G=window.__features,R=G?.horse?.RIG?.();return G?.cottonwoodPost&&G.social?.startRide&&!document.getElementById('load')&&R?.ready&&!R.loadingBreed;},null,{timeout:180000});
 // Deferred scenery needs the normal game loop before manual stepping begins.
 await page.evaluate(()=>{const G=__features;window.__postScenery=false;window.__postSceneryError=null;Promise.all([G.undergrowth.ready,G.photoscans.ready,G.worldDetails.ready,G.world.ranchBuilderArt.ready]).then(()=>window.__postScenery=true,e=>window.__postSceneryError=String(e));});
 await page.waitForFunction(()=>window.__postScenery||window.__postSceneryError,null,{timeout:180000});
 await page.evaluate(()=>{
  if(window.__postSceneryError)throw Error(window.__postSceneryError);
  const G=__features;advanceTime(0);G.save.sync(s=>{s.rider.made=true;});G.wardrobe.closeChar();G.hidePanels();G.seFrame?.settle();G.audio.setMuted(true);G.riding.releaseAll();
  window.__postEvents={done:[],finish:[],pending:[]};window.__postToasts=[];
  G.on('trailDone',r=>{__postEvents.done.push({exped:r.exped,managed:r.managed,idx:r.idx,total:r.pts.length,t:r.t});});
  G.on('postFinish',r=>{__postEvents.finish.push(JSON.parse(JSON.stringify(r)));});
  G.on('postSavePending',r=>{__postEvents.pending.push({runId:r.runId,stage:r.stage});});
  const toast=G.toast;G.toast=function(...args){__postToasts.push(args.map(String).join(' '));return toast.apply(this,args);};
  window.__postStep=ms=>{const render=G.renderer.render;G.renderer.render=function(scene,camera,...args){if(camera!==G.camera)return render.call(this,scene,camera,...args);};try{advanceTime(ms);}finally{G.renderer.render=render;}};
  window.__postRead=()=>{const s=G.save.fresh(),P=G.horse.player,r=G.trail.ride,R=G.horse.RIG();return JSON.parse(JSON.stringify({
   mission:G.cottonwoodPost.snapshot(),position:{x:P.pos.x,z:P.pos.z,heading:P.heading,speed:P.speed,y:P.y||0,ground:G.world.groundH(P.pos.x,P.pos.z),flightY:R.heroMotion&&!P.flying?R.heroJumpExtra||0:P.y||0,jumpAge:R.heroJumpAge,grounded:R.heroMotion?.state?.grounded??P.y<=0,flying:!!P.flying},
   reward:{coins:s.coins||0,gems:s.gems||0,pass:s.pass?.pts||0,stars:s.sp?.pts||0,trails:s.stats?.trails||0,expeditions:s.stats?.expeditions||0,cottonwood:s.expDone?.cottonwood||0,records:s.cottonwoodPost},
   ride:r?{idx:r.idx,t:r.t,exped:r.exped,managed:r.managed,solo:r.soloExpedition,pts:r.pts}:null,
   events:__postEvents,dialogue:!!G.dialogue?.active,blocked:!!G.input.blocked(),toasts:__postToasts.slice(-12),featureErrors:G.errors,writeAttempts:window.__postFailedWrites||0}));};
  // The only position fixture in this script. It precedes mission creation.
  const P=G.horse.player;P.pos.set(-8,0,-12);P.heading=Math.atan2(-.5,-5.5);P.speed=0;P.y=0;P.vy=0;P.mesh.position.set(P.pos.x,G.world.groundH(P.pos.x,P.pos.z),P.pos.z);P.mesh.rotation.y=P.heading;G.followCam?.reset?.();
 });
 report.initialFixture=await read();report.jumpProfile=await page.evaluate(()=>{const profile=__features.horse.RIG().profile,record=profile?.nativeJump,samples=record?.actorLiftM||[],max=Math.max(0,...samples.map(p=>p[1])),peaks=samples.filter(p=>p[1]>=max*.995);return {kind:profile?.nativeKind||null,record:record?{durationS:record.durationS,flightStartS:record.flightStartS,flightEndS:record.flightEndS,peakLiftM:max}:null,peakTime:peaks.length?peaks.reduce((n,p)=>n+p[0],0)/peaks.length:.72};});await step(20);
}
async function start(entry){
 await keys();
 if(entry==='adventures'){
  await page.evaluate(()=>{__features.rideHub.open();__features.seFrame?.settle();});
  const card=page.locator('[data-fx="adventure:post"]');await card.scrollIntoViewIfNeeded();await screenshot('00-adventures-card');await card.click();
 }else{
  // Framing the classic list selects its view; the actual handler owns entry.
  await page.evaluate(()=>{const G=__features;G.ui.openOnline();G.seFrame?.classic('onlinePanel');G.seFrame?.settle();});
  await page.locator('[data-fx="sp:exped:cottonwood"]').click();
 }
 await step(30);await focusRiding();
 const s=await read();check(s.mission.active?.stage==='collect'&&s.ride?.solo&&s.ride.managed==='cottonwood-post','Visible '+entry+' entry creates an explicit solo courier mission');return s;
}
async function noAutomaticHandover(stage,label){
 const before=await read();await keys();await step(2000);const after=await read();
 check(after.mission.active?.stage===stage&&after.mission.active.interaction?.eligible,label+' requires a stopped explicit interaction after arriving nearby',after.mission.active);
 same(after.reward,before.reward,label+' proximity does not pay a courier reward');return after;
}
async function collect(first){
 await gait('walk');await rideTo(...ROUTE.pickup,'pass Wren without interacting',.8);
 await noAutomaticHandover('collect','Wren pickup');
 if(first)await screenshot('01-wren-pickup');
 await page.keyboard.down('e');await step(80);
 // Repeated down on the same Playwright key produces real repeated keydowns.
 for(let i=0;i<3;i++){await page.keyboard.down('e');await step(80);}
 const s=await read();await page.keyboard.up('e');
 check(s.mission.active?.stage==='pines'&&s.mission.active.carrying==='post','E explicitly collects Wren’s post');
 check(!s.dialogue&&!s.blocked,'Holding E across collection never opens Wren’s dialogue');
 if(first){
  const pause=await page.evaluate(()=>{const G=__features;G.ui.openStable();G.seFrame?.settle();const before=__postRead();__postStep(3000);const after=__postRead();G.hidePanels();G.seFrame?.settle();return {before,after};});
  same(pause.after.mission.active.elapsed,pause.before.mission.active.elapsed,'Opening a menu pauses the courier clock');
  same(pause.after.mission.active.distance,pause.before.mission.active.distance,'Opening a menu pauses the courier distance');
 }
 await gait('trot');
}
async function rideCircuit(first){
 await collect(first);await leg(ROUTE.out,'north gate to Pines');let s=await read();
 check(s.mission.active?.stage==='deliver'&&s.mission.active.carrying==='post','Riding through the actual Pines advances the mounted passage stage');
 if(first){
  await page.locator('#postRoad').click();
  const focus=await page.evaluate(()=>({id:document.activeElement?.id,tag:document.activeElement?.tagName}));report.routeFocus.push({route:'road',...focus});
  check(focus.id!=='postRoad','Pointer selection of Meadow road releases its button focus for riding');
  check((await read()).mission.active.route==='road','The first circuit selects the visible Meadow road choice');
  await leg(ROUTE.delivery,'Pines to Ada by road');
 }else{
  await page.locator('#postWoodland').click();
  const focus=await page.evaluate(()=>({id:document.activeElement?.id,tag:document.activeElement?.tagName}));report.routeFocus.push({route:'woodland',...focus});
  check(focus.id!=='postWoodland','Pointer selection of Woodland jump releases its button focus for W and Space');
  check((await read()).mission.active.route==='woodland','The second circuit selects the visible Woodland jump choice');
  const entry=ROUTE.woodland.findIndex(([x,z])=>x===-12&&z===-53);
  check(entry>=1,'Shared woodland guidance includes the surveyed log approach');
  await leg(ROUTE.woodland.slice(1,entry),'Pines to woodland approach');await jumpLog(WOODLAND_LOG);
  await leg(ROUTE.woodland.slice(entry+2),'Woodland exit to Ada');
 }
 await noAutomaticHandover('deliver','Ada exchange');
 if(first){
  await resize(390,844);await screenshot('02-ada-mobile-action');
  const b=await page.evaluate(()=>{const el=document.getElementById('ctx'),r=el.getBoundingClientRect(),hud=document.getElementById('cottonwoodPostHud').getBoundingClientRect();return {text:el.textContent,visible:!!el.getClientRects().length&&getComputedStyle(el).display!=='none',left:r.left,right:r.right,top:r.top,bottom:r.bottom,height:r.height,hud:{left:hud.left,right:hud.right,top:hud.top,bottom:hud.bottom},width:innerWidth,heightView:innerHeight};});
  report.mobileAction=b;check(b.visible&&/Exchange post/i.test(b.text)&&b.height>=44&&b.left>=0&&b.right<=390&&b.bottom<=844,'Mobile contextual action is visible and touch-sized',b);
  check(b.hud.left>=0&&b.hud.right<=390&&b.hud.top>=0&&b.hud.bottom<=b.top,'Mobile courier HUD fits above the contextual action',b);
  await page.locator('#ctx').tap();await step(40);
 }else{await page.keyboard.press('e');await step(40);}
 s=await read();check(s.mission.active?.stage==='return'&&s.mission.active.carrying==='reply'&&!s.dialogue,'Explicit Ada interaction exchanges post for reply without opening NPC dialogue');
 if(first){await screenshot('03-reply-aboard-mobile');await resize(1280,850);}
 await leg(ROUTE.home,'Ada to Wren');await noAutomaticHandover('return','Wren return');
 if(first)await screenshot('04-wren-return');return read();
}
function assertPaid(before,after,label){
 const a=after.reward,b=before.reward,r=after.mission.lastResult;
 check(!after.mission.active&&!after.ride&&r?.runId===before.mission.active.runId,label+' confirms and closes the original delivery');
 same({coins:a.coins-b.coins,gems:a.gems-b.gems,pass:a.pass-b.pass,stars:a.stars-b.stars,trails:a.trails-b.trails,expeditions:a.expeditions-b.expeditions,cottonwood:a.cottonwood-b.cottonwood},{coins:450,gems:2,pass:28,stars:6,trails:1,expeditions:1,cottonwood:1},label+' pays the exact courier reward and counters once');
 check(a.records.completions===b.records.completions+1&&a.records.receipts.some(q=>q.runId===r.runId),label+' stores a receipt and one completion');
 check(after.events.done.length===before.events.done.length+1&&after.events.finish.length===before.events.finish.length+1,label+' emits exactly one confirmed trail finish and post finish');
 const done=after.events.done.at(-1);check(done.managed==='cottonwood-post'&&done.idx===done.total&&done.t>0,label+' exposes a finished production trail for downstream goals');
 check(r.distance>=100&&r.time>=8,label+' receipt contains ridden distance and elapsed time',r);
}
(async()=>{
 const {COTTONWOOD_ROUTES}=await import('../assets/cottonwood-routes.mjs');
 ROUTE={pickup:COTTONWOOD_ROUTES.out[0],out:COTTONWOOD_ROUTES.out.slice(1),delivery:COTTONWOOD_ROUTES.road.slice(1),woodland:COTTONWOOD_ROUTES.woodland,home:COTTONWOOD_ROUTES.home.slice(1)};report.route=ROUTE;
 fs.mkdirSync(out,{recursive:true});browser=await QA.chromium.launch({headless:process.env.QA_HEADLESS!=='0',args:QA.gpuArgs()});
 const context=await browser.newContext({viewport:{width:1280,height:850},hasTouch:true,serviceWorkers:'block'});await context.routeWebSocket('**',ws=>ws.close());
 page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.on('dialog',d=>d.dismiss());
 page.on('console',message=>{if(['warning','error'].includes(message.type()))report.console.push({phase,type:message.type(),text:message.text(),location:message.location()});});
 try{
  await page.goto(QA.BASE+'/ranch3d.html?qa=cottonwood-post',{waitUntil:'domcontentloaded',timeout:120000});await ready();
  phase='road';await start('adventures');const before=await rideCircuit(true);await page.keyboard.press('e');const after=await read();assertPaid(before,after,'Normal delivery');report.runs.push({kind:'normal-road',before,after});
  await screenshot('05-confirmed-reward');
  const duplicate=await page.evaluate(()=>{const before=__postRead(),accepted=__features.cottonwoodPost.retrySave(),after=__postRead();return {before,after,accepted};});
  check(duplicate.accepted===false,'Retrying a confirmed delivery is a no-op');same(duplicate.after.reward,duplicate.before.reward,'A duplicate retry never pays again');same(duplicate.after.events,duplicate.before.events,'A duplicate retry never emits another finish');

  // Separate failure fixture: start exactly where normal riding left the horse.
  // Only the storage boundary is fault-injected, after another complete ride.
  phase='woodland';await start('legacy');const failureBefore=await rideCircuit(false);phase='save-failure';
  await page.evaluate(()=>{const key=__features.save.KEY,write=Storage.prototype.setItem;window.__postFailWrite=true;window.__postFailedWrites=0;Storage.prototype.setItem=function(k,v){if(k===key&&window.__postFailWrite){window.__postFailedWrites++;throw new DOMException('QA courier write failure','QuotaExceededError');}return write.call(this,k,v);};});
  await page.keyboard.press('e');const pending=await read();report.runs.push({kind:'save-failure',before:failureBefore,pending});
  check(pending.writeAttempts>0&&pending.mission.active?.stage==='savePending'&&pending.ride?.managed==='cottonwood-post','A real final-save failure retains the completed delivery for retry');
  same(pending.reward,failureBefore.reward,'Failed final save grants no unconfirmed reward or receipt');same(pending.events.done,failureBefore.events.done,'Failed final save emits no trail completion');
  await resize(390,844);await screenshot('06-save-pending-mobile');
  check(await page.locator('#postCancel').isDisabled(),'Pending save visibly disables ending the ride');
  const pendingBeforeClub=await read();
  await page.evaluate(()=>{const G=__features;G.ui.openOnline();G.seFrame?.classic('onlinePanel');G.seFrame?.settle();});
  const stopButton=page.locator('#onlinePanel [data-tr="stop"]');await stopButton.scrollIntoViewIfNeeded();
  const club=await page.evaluate(()=>({visible:document.getElementById('onlinePanel').getClientRects().length>0,text:document.getElementById('onlinePanel').textContent,state:__postRead()}));report.pendingClub=club;
  check(club.visible&&/Route complete\s*·\s*save pending/i.test(club.text),'Legacy Club panel renders a completed route with a pending save');
  await screenshot('06-save-pending-legacy-club');await stopButton.click();await page.evaluate(()=>__features.seFrame?.settle());
  const afterStop=await read();
  check(afterStop.mission.active?.stage==='savePending'&&afterStop.mission.active.runId===pendingBeforeClub.mission.active.runId&&afterStop.ride?.managed==='cottonwood-post','The visible legacy Stop button cannot discard a pending courier receipt');
  same(afterStop.reward,pendingBeforeClub.reward,'Opening Club and clicking Stop preserves the pending reward state');
  await page.locator('#seFrameTop [data-se="close"]').click();await step(40);
  check(!(await read()).blocked&&await page.locator('#postAction').isVisible(),'Closing legacy Club restores the pending-save action');
  await page.locator('#postAction').tap();const stillPending=await read();
  check(stillPending.mission.active?.stage==='savePending'&&stillPending.writeAttempts>pending.writeAttempts,'Retry while storage still fails remains recoverable');same(stillPending.reward,failureBefore.reward,'Repeated failed retry preserves all rewards');
  phase='save-recovery';await page.evaluate(()=>{window.__postFailWrite=false;});await page.locator('#postAction').tap();const saved=await read();assertPaid(failureBefore,saved,'Recovered delivery');report.runs.at(-1).saved=saved;await screenshot('07-recovered-reward-mobile');
  const repeated=await page.evaluate(()=>{const accepted=__features.cottonwoodPost.retrySave();return {accepted,state:__postRead()};});
  check(repeated.accepted===false,'A repeated recovered-save retry is a no-op');same(repeated.state.reward,saved.reward,'Recovered delivery reward cannot be duplicated');same(repeated.state.events,saved.events,'Recovered delivery finish cannot be duplicated');
  check(!report.errors.length&&!saved.featureErrors.length,'Both physical routes, touch exchange and save retry have no browser or feature errors');
 }catch(error){report.failure=error.message;try{await keys();report.state=await read();await screenshot('failure');}catch(captureError){report.captureError=String(captureError);}throw error;}
 finally{clearTimeout(watchdog);try{report.featureErrors=await page.evaluate(()=>window.__features?.errors||[]);}catch(error){report.featureErrorCapture=String(error);}fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});

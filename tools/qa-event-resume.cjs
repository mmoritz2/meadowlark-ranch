/* Focused saved-event recovery check, using a disposable browser context.
   This deliberately INITIALIZES midcourse progress; it is persistence/entry QA,
   not evidence that the fixture's gates were ridden or its score was earned.
   Production River Run geometry, checkpoint code, Events UI and frame loop are
   used after setup. No position/progress edits occur during the resumed ride.
   Run against the intended checkout with QA_URL/QA_PORT and optionally QA_OUT.
   QA_FOCUS=jump skips the race/reload suite and runs the same jumping case. */
const QA=require('./qa-platform.cjs'),fs=require('node:fs'),assert=require('node:assert/strict');
const focus=process.env.QA_FOCUS||'all';
const out=process.env.QA_OUT||('/private/tmp/meadowlark-event-resume'+(focus==='jump'?'-jump':''));
const report={focus,evidence:focus==='jump'?'Synthetic jumping fixture; real checkpoint and same-page API resume with no-input countdown. No reload, UI-entry or riding-completion claim.':'Synthetic midcourse fixtures; real checkpoint, page reload, visible Events resume, and no-input countdown. No riding-completion claim.',checks:[],errors:[]};
const check=(ok,label,detail)=>{assert.ok(ok,label+(detail?' '+JSON.stringify(detail):''));report.checks.push(label);console.log('PASS '+label);};
const same=(actual,expected,label)=>{assert.deepEqual(actual,expected,label);report.checks.push(label);console.log('PASS '+label);};
const earnedCheckpoint=r=>{if(!r)return null;const {at,seq,...earned}=r;return earned;};
let browser;
const watchdog=setTimeout(()=>{browser?.close().finally(()=>process.exit(3));},600000);watchdog.unref();

async function ready(page){
 await page.waitForFunction(()=>{
  const G=window.__features,R=G?.horse?.RIG?.();
  if(!G?.ladder?.checkpoint||!G.events2?.snapshotResume||!G.seEvents||document.getElementById('load')||!R?.ready||R.loadingBreed)return false;
  return true;
 },null,{timeout:180000});
 // Scenery builds on the normal live loop. Pausing at the loading curtain would
 // leave deferred world work unfinished and make screenshots unreliable.
 await page.evaluate(()=>{
  const G=__features;window.__resumeSceneryReady=false;window.__resumeSceneryError=null;
  Promise.all([G.undergrowth.ready,G.photoscans.ready,G.worldDetails.ready,G.world.ranchBuilderArt.ready])
   .then(()=>{window.__resumeSceneryReady=true;},error=>{window.__resumeSceneryError=String(error);});
 });
 await page.waitForFunction(()=>window.__resumeSceneryReady||window.__resumeSceneryError,null,{timeout:180000});
 await page.evaluate(()=>{
  if(window.__resumeSceneryError)throw Error(window.__resumeSceneryError);
  const G=__features;
  advanceTime(0);
  G.save.sync(s=>{s.rider.made=true;});G.wardrobe.closeChar();G.hidePanels();G.seFrame?.settle();G.audio.setMuted(true);G.riding.releaseAll();
  window.__resumeStep=ms=>{const render=G.renderer.render;G.renderer.render=function(scene,camera,...args){if(camera!==G.camera)return render.call(this,scene,camera,...args);};try{advanceTime(ms);}finally{G.renderer.render=render;}};
  const clone=value=>JSON.parse(JSON.stringify(value));
  window.__resumeRead=()=>{
   const c=G.course.get(),s=G.save.fresh(),P=G.horse.player;
   return {checkpoint:clone(s.runSaved||null),tickets:G.events.tix(s),position:{x:P.pos.x,z:P.pos.z,heading:P.heading,speed:P.speed},
    condition:{stam:P.stam,blown:!!P.blown,boostT:P.boostT||0,shieldT:P.shieldT||0,slipT:P.slipT||0},
    course:c?{ev:c.ev.id,idx:c.idx,t:c.t,cd:c.cd,started:!!c.started,faults:c.faults||0,off:c.ce?.off||0,
     resumedStarted:!!c.resumedStarted,runId:c.ladRunId,tixSpent:!!c.tixSpent,rematch:!!c.ladRematch,
     ce:clone({di:c.ce?.di,lap:c.ce?.lap,laps:c.ce?.laps,grades:c.ce?.grades,lineOff:c.ce?.lineOff,refusals:c.ce?.refusals,insp:c.ce?.insp}),
     discipline:G.events2.snapshotResume(c),
     rivals:(G.ladder.FIELD()?.rivals||[]).map(r=>({n:r.n,target:r.target,pen:r.pen,prog:r.prog,slowT:r.slowT,done:r.done,i:r.i})),
     items:(c.items||[]).map(i=>({visible:i.m?.visible,cd:i.cd||0})),hazards:(c.hazards||[]).map(h=>({cd:h.cd||0,seen:!!h._ev2}))}:null,
    featureErrors:G.errors.slice()};
  };
  window.__resumeStage=()=>{
   const c=G.course.get(),p=G.horse.player,W=G.world,j=c?.jumps[c.idx];if(!j)return null;
   const dx=j.x-p.pos.x,dz=j.z-p.pos.z,d=Math.hypot(dx,dz),h=j.rotY||0;
   const wallAt=(x,z)=>(W.walls||[]).some(w=>{const dx=w.x2-w.x1,dz=w.z2-w.z1,l2=dx*dx+dz*dz,t=Math.max(0,Math.min(1,l2?((x-w.x1)*dx+(z-w.z1)*dz)/l2:0));return Math.hypot(x-w.x1-dx*t,z-w.z1-dz*t)<.9;});
   let approachWalls=0;for(let s=1;s<d-3.5;s+=1)if(wallAt(p.pos.x+dx*s/d,p.pos.z+dz*s/d))approachWalls++;
   const ground=W.groundH(p.pos.x,p.pos.z),start=G.events2.state.start,R=G.events2.ringOf(c);
   const rear={x:p.pos.x-Math.sin(p.heading)*1.4,z:p.pos.z-Math.cos(p.heading)*1.4};
   // Check the physical rear against the arena ellipse independently of inRing.
   const rearRingRatio=R?((rear.x-R.x)/(R.A-.9))**2+((rear.z-R.z)/(R.B-.9))**2:0;
   return {target:c.idx,kind:j.kind,distance:d,behind:dx*Math.sin(h)+dz*Math.cos(h),offLine:Math.abs(dx*Math.cos(h)-dz*Math.sin(h)),
    headingError:Math.abs(Math.atan2(Math.sin(p.heading-h),Math.cos(p.heading-h))),facing:(Math.sin(p.heading)*dx+Math.cos(p.heading)*dz)/d,
    ground,wet:G.events2.wet(p.pos.x,p.pos.z),wall:wallAt(p.pos.x,p.pos.z),approachWalls,inRing:G.events2.inRing(R,p.pos.x,p.pos.z),rear,rearRingRatio,rearInRing:rearRingRatio<1,
    colliders:(W.colliders||[]).filter(q=>Math.hypot(p.pos.x-q.x,p.pos.z-q.z)<q.r+.4).length,
    slope:Math.max(...[[3,0],[-3,0],[0,3],[0,-3]].map(([x,z])=>Math.abs(W.groundH(p.pos.x+x,p.pos.z+z)-ground))),
    start:start?{...start}:null,startDistance:start?Math.hypot(start.x-p.pos.x,start.z-p.pos.z):null,
    firstDistance:Math.hypot(p.pos.x-c.jumps[0].x,p.pos.z-c.jumps[0].z)};
  };
 });
}

(async()=>{
 fs.mkdirSync(out,{recursive:true});browser=await QA.chromium.launch({headless:true,args:QA.gpuArgs()});
 const context=await browser.newContext({viewport:{width:1280,height:850},serviceWorkers:'block'});
 await context.routeWebSocket('**',ws=>ws.close());
 const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.on('dialog',d=>d.dismiss());
 try{
  console.log('START disposable local ranch');await page.goto(QA.BASE+'/ranch3d.html?qa=event-resume',{waitUntil:'domcontentloaded',timeout:120000});await ready(page);
  await page.evaluate(()=>{
   const G=__features;
   G.save.sync(s=>{const h=s.horses[G.horse.rideIdx()];h.level=14;h.stats=h.stats||{};for(const k of G.tables.STAT_KEYS)h.stats[k]=10;s.tix={...(s.tix||{}),n:3,at:Date.now()};});G.horse.reloadHorses();
  });
  if(focus!=='jump'){
  const fixture=await page.evaluate(()=>{
   const G=__features;
   G.course.startCourse(G.tables.EVENTS3.find(e=>e.id==='rr'),2);
   const c=G.course.get();if(c?.ev.id!=='rr')throw Error('Production River Run did not start');
   // Synthetic saved-state setup: these values were not earned by riding.
   Object.assign(c,{started:true,cd:0,idx:3,t:31.5,faults:4,tixSpent:true,ladRematch:true});
   Object.assign(G.horse.player,{stam:.12,blown:true,boostT:2.25,shieldT:1.75,slipT:.8});
   Object.assign(c.ce,{grades:['perfect','good','fault'],lineOff:2.25,refusals:1,insp:1,off:1.75});
   Object.assign(G.events2.state,{gateSum:2.15,gateN:3,hazHits:2,lastIdx:3,lastGrades:3});
   const GH=G.events2.ghosts;for(const [i,g]of GH.list.entries()){g.s=GH.fin*(.24+i*.08);g.slowT=i===0?1.25:0;g.done=false;}
   for(const [i,r]of (G.ladder.FIELD()?.rivals||[]).entries()){r.prog=.24+i*.08;r.i=Math.floor(r.prog*c.jumps.length);r.pen=i+.75;r.slowT=i===0?1.25:0;}
   const item=(c.items||[]).find(i=>i.m&&!i.pad);if(item)item.m.visible=false;
   if(c.hazards?.[0])Object.assign(c.hazards[0],{cd:2.5,_ev2:true});
   if(!G.ladder.checkpoint(c))throw Error('Production checkpoint write did not confirm');
   const saved=__resumeRead();
   G.course.cancelCourse();__resumeStep(0);G.save.sync(s=>{s.runSaved=saved.checkpoint;});
   return saved;
  });report.fixture=fixture;
  check(fixture.checkpoint?.version===2&&fixture.checkpoint.ev==='rr'&&fixture.checkpoint.idx===3&&fixture.checkpoint.di===2,'Production writer persists a versioned River Run midcourse fixture');
  check(fixture.course.discipline?.ghosts?.length>0||fixture.course.rivals.length>0,'Fixture includes a real production opponent field');
  const refused=await page.evaluate(()=>{
   const G=__features,h=G.horse.ridden(),level=h.level;h.level=1;
   const before=__resumeRead(),accepted=G.ladder.resumeRun(),after=__resumeRead();h.level=level;
   return {before,after,accepted};
  });report.refused=refused;
  check(refused.accepted===false&&refused.after.course===null,'Normal Elite entry refusal creates no course');
  same(refused.after.checkpoint,refused.before.checkpoint,'Refused entry preserves the entire saved checkpoint');
  same(refused.after.tickets,refused.before.tickets,'Refused entry neither charges nor refunds a ticket');
  const occupied=await page.evaluate(()=>{
   const G=__features;G.course.startCourse(G.tables.EVENTS3.find(e=>e.id==='h1'),1);
   const c=G.course.get();if(c?.ev.id!=='h1')throw Error('Different production course did not start');
   const before=__resumeRead(),accepted=G.ladder.resumeRun(),after=__resumeRead(),sameInstance=c===G.course.get();
   G.course.cancelCourse();__resumeStep(0);G.save.sync(s=>{s.runSaved=before.checkpoint;});return {before,after,accepted,sameInstance};
  });report.occupied=occupied;
  check(occupied.accepted===false&&occupied.sameInstance,'Resume refuses to replace an existing different course');
  same(occupied.after,occupied.before,'Refusal preserves current course progress, scoring, player staging, ticket count and checkpoint');

  console.log('RELOAD the actual page with its persisted checkpoint');await page.reload({waitUntil:'domcontentloaded',timeout:120000});await ready(page);
  const reloaded=await page.evaluate(()=>__resumeRead());report.reloaded=reloaded;
  check(reloaded.course===null,'Reload removes the in-memory course');
  same(reloaded.checkpoint,fixture.checkpoint,'The complete checkpoint survives a real page reload');
  await page.evaluate(()=>{__features.ui.openEvents();__features.seFrame?.settle();});
  await page.locator('[data-sev="resume"]').click();
  const resumed=await page.evaluate(()=>({state:__resumeRead(),stage:__resumeStage()}));report.resumed=resumed;
  const c=resumed.state.course,r=fixture.checkpoint;
  check(c?.ev==='rr'&&!c.started&&c.cd>3&&c.resumedStarted&&c.runId===r.runId,'Visible Events resume restores the original run with a fresh countdown');
  same({idx:c.idx,t:c.t,faults:c.faults,off:c.off,ce:c.ce},{idx:fixture.course.idx,t:fixture.course.t,faults:fixture.course.faults,off:fixture.course.off,ce:fixture.course.ce},'Resume restores saved progress and course-engine scoring');
  same(c.discipline,fixture.course.discipline,'Resume restores saved discipline judging and opponent progress');
  same(c.rivals,fixture.course.rivals,'Resume restores the saved opponent field');
  same(c.items,fixture.course.items,'Resume preserves used pickups and their cooldowns');
  same(c.hazards,fixture.course.hazards,'Resume preserves hazard state');
  same(resumed.state.condition,fixture.condition,'Resume preserves earned stamina, exhaustion, boost, shield and slow-down state');
  check(c.tixSpent&&c.rematch&&resumed.state.tickets===reloaded.tickets,'Resume preserves ticket ownership/rematch context without charging again');
  same(earnedCheckpoint(resumed.state.checkpoint),earnedCheckpoint(r),'Accepted resume confirms the same original run and all earned checkpoint state');
  check(resumed.state.checkpoint.seq>=r.seq,'Accepted resume retains confirmed checkpoint sequence');
  const a=resumed.stage;
  check(a.target===r.idx&&a.kind==='gate'&&a.distance>4.6&&a.behind>4.6&&a.headingError<.03&&a.facing>.85&&a.startDistance<.1&&a.firstDistance>20,'Resume stages behind the saved next gate, facing its approach, outside free-gate range',a);
  check(Number.isFinite(a.ground)&&!a.wet&&!a.wall&&!a.colliders&&!a.approachWalls&&a.slope<3,'Resumed start stands on safe ground with a clear approach',a);
  await page.evaluate(()=>advanceTime(0));await page.screenshot({path:out+'/resumed-countdown.png'});
  const counting=await page.evaluate(()=>{__resumeStep(1500);return __resumeRead();});report.counting=counting;
  check(!counting.course.started&&counting.course.cd>0&&counting.course.idx===r.idx&&counting.course.t===r.t,'Resumed countdown does not advance the saved gate or clock');
  same(counting.condition,fixture.condition,'Recovered countdown preserves saved stamina, exhaustion and effect timers at 1.5 seconds');
  same(earnedCheckpoint(counting.checkpoint),earnedCheckpoint(r),'Checkpoint remains recoverable during the resumed countdown');
  const running=await page.evaluate(()=>{__resumeStep(2500);return __resumeRead();});report.running=running;
  check(running.course.started&&running.course.idx===r.idx&&running.course.t>=r.t&&running.course.t<r.t+1,'Letting the countdown finish without riding awards no immediate free gate');
  same(running.tickets,reloaded.tickets,'The resumed start does not change ticket balance');

  const ticket=await page.evaluate(checkpoint=>{
   const G=__features;G.course.cancelCourse();__resumeStep(0);
   // Reinstall the same fixture to isolate abandoning the new countdown.
   G.save.sync(s=>{s.runSaved=checkpoint;});const before=G.events.tix(G.save.fresh());
   const accepted=G.ladder.resumeRun(),counting=G.course.get()&&!G.course.get().started;
   G.course.cancelCourse();__resumeStep(50);const afterCancel={tickets:G.events.tix(G.save.fresh()),checkpoint:G.save.fresh().runSaved};
   // Explicitly letting go of an unresumed saved round owns its one refund.
   G.save.sync(s=>{s.runSaved=checkpoint;});G.ladder.dropRun();const afterDrop=G.events.tix(G.save.fresh());
   G.ladder.dropRun();return {before,accepted,counting,afterCancel,afterDrop,afterSecondDrop:G.events.tix(G.save.fresh()),checkpoint:G.save.fresh().runSaved};
  },r);report.ticket=ticket;
  check(ticket.accepted===true&&ticket.counting&&ticket.afterCancel.tickets===ticket.before&&!ticket.afterCancel.checkpoint,'Abandoning a resumed countdown clears the run without refunding its already-used ticket');
  check(ticket.afterDrop===ticket.before+1&&ticket.afterSecondDrop===ticket.afterDrop&&!ticket.checkpoint,'Explicitly dropping an unresumed checkpoint refunds its ticket once');
  }

  // A second synthetic fixture covers a real jumping course in this same page.
  // It adds no reload and claims no ridden fences; only resume behavior is tested.
  const jumping=await page.evaluate(()=>{
   const G=__features;G.hidePanels();G.seFrame?.settle();G.riding.releaseAll();
   G.course.startCourse(G.tables.EVENTS3.find(e=>e.id==='h1'),1);
   const c=G.course.get();if(c?.ev.id!=='h1')throw Error('Production Cottonwood jumping course did not start');
   Object.assign(c,{started:true,cd:0,idx:2,t:22.25,faults:4});
   Object.assign(c.ce,{grades:['fault','refusal','good'],refusals:1,insp:0});
   Object.assign(G.events2.state,{fenceFaults:8,xcJump:31,refuseAt:{'1:1':1},lastRef:1,lastGrades:3,lastIdx:2,watch:null});
   if(!G.ladder.checkpoint(c))throw Error('Jumping checkpoint write did not confirm');
   const saved=__resumeRead();G.course.cancelCourse();__resumeStep(0);
   G.save.sync(s=>{s.runSaved=saved.checkpoint;});
   const toasts=[],resumeTrace={called:false,returned:null,error:null},originalToast=G.toast,originalResume=G.events2.resumeCourse;
   G.toast=function(...args){toasts.push(args.map(String).join(' '));return originalToast.apply(this,args);};
   G.events2.resumeCourse=function(...args){resumeTrace.called=true;try{return resumeTrace.returned=originalResume.apply(this,args);}catch(error){resumeTrace.error=String(error);throw error;}};
   let accepted=false,resumeError=null;
   try{accepted=G.ladder.resumeRun();}catch(error){resumeError=String(error);}
   finally{G.toast=originalToast;G.events2.resumeCourse=originalResume;}
   return {saved,accepted,resumed:__resumeRead(),stage:__resumeStage(),toasts,resumeTrace,resumeError};
  });report.jumping=jumping;
  await page.evaluate(()=>advanceTime(0));await page.screenshot({path:out+'/jumping-recovery.png'});
  const j=jumping.stage,jc=jumping.resumed.course,js=jumping.saved.course;
  check(jumping.accepted===true&&jc?.ev==='h1'&&jc.idx===2&&!jc.started&&jc.resumedStarted&&jc.runId===jumping.saved.checkpoint.runId,'Same-page recovery resumes the production jumping fixture at fence three',{toasts:jumping.toasts,resumeTrace:jumping.resumeTrace,error:jumping.resumeError});
  check(j.target===2&&j.kind==='fence'&&j.start?.idx===2&&j.distance+1e-6>=4&&j.behind+1e-6>=4&&j.headingError<.03&&j.facing>.8&&j.startDistance<.1,
   'Jumping recovery stages before the saved next fence, facing its approach',j);
  check(Number.isFinite(j.ground)&&j.inRing&&!j.wet&&!j.wall&&!j.colliders&&!j.approachWalls&&j.slope<3,'Jumping recovery uses safe ground and a clear approach inside its arena',j);
  check(j.rearInRing,'The horse rear, measured 1.4m behind its heading, stays inside the recovery arena',j);
  same({faults:jc.faults,grades:jc.ce.grades,refusals:jc.ce.refusals,judging:jc.discipline.judging},
   {faults:js.faults,grades:js.ce.grades,refusals:js.ce.refusals,judging:js.discipline.judging},'Jumping resume restores the known grades, refusal and eight fault points exactly');
  jumping.counting=await page.evaluate(()=>{__resumeStep(1500);return __resumeRead();});
  jumping.running=await page.evaluate(()=>{__resumeStep(2500);return __resumeRead();});
  check(!jumping.counting.course.started&&jumping.counting.course.idx===2&&jumping.counting.course.t===js.t,
   'Waiting during the resumed countdown grants no fence or elapsed course time');
  same(jumping.counting.condition,jumping.saved.condition,'Jumping countdown preserves its saved horse condition at 1.5 seconds');
  same(earnedCheckpoint(jumping.counting.checkpoint),earnedCheckpoint(jumping.saved.checkpoint),'Jumping checkpoint survives the resumed countdown');
  check(jumping.running.course.started&&jumping.running.course.idx===2,'Finishing the countdown without riding grants no free fence');
  same({faults:jumping.running.course.faults,grades:jumping.running.course.ce.grades,refusals:jumping.running.course.ce.refusals,judging:jumping.running.course.discipline.judging},
   {faults:js.faults,grades:js.ce.grades,refusals:js.ce.refusals,judging:js.discipline.judging},'Resumed jumping frames do not apply old grades or refusals twice');
  check(!report.errors.length&&await page.evaluate(()=>!__features.errors.length),'Resume scenarios produce no browser or feature errors');
 }catch(e){report.failure=e.message;try{report.failureState=await page.evaluate(()=>typeof __resumeRead==='function'?__resumeRead():{});await page.screenshot({path:out+'/failure.png',timeout:5000});}catch(_){}throw e;}
 finally{clearTimeout(watchdog);fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

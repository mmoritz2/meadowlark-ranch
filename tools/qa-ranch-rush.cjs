/* Integrated Ranch Rush QA. Uses a disposable browser save and blocks networking.
   Course progress comes from small scripted position steps through the real engine;
   Space starts the real native jump. No course indices, grades, results or jump ages
   are injected. This tests simulated crossings, not human steering/playability.
   Usage: QA_PORT=8595 PLAYWRIGHT_PATH=/path/to/playwright node tools/qa-ranch-rush.cjs */
const QA=require('./qa-platform.cjs'),fs=require('node:fs'),assert=require('node:assert/strict');
const out=process.env.QA_OUT||'/private/tmp/meadowlark-ranch-rush';
const ids=['rush-pasture','rush-river','rush-trail'];
const report={checks:[],runs:[],errors:[]};
const check=(ok,label,detail)=>{assert.ok(ok,label+(detail?' — '+JSON.stringify(detail):''));report.checks.push(label);console.log('PASS '+label);};
let browser;
const watchdog=setTimeout(()=>{console.error('Ranch Rush QA exceeded 8 minutes');browser?.close().finally(()=>process.exit(3));},480000);watchdog.unref();
async function boot(page){
 await page.goto(QA.BASE+'/ranch3d.html?qa=ranch-rush&emoji=0',{timeout:120000});
 await page.waitForFunction(()=>window.__features?.ranchRush&&__features.ranchRushUI&&!document.getElementById('load'),null,{timeout:150000});
 await page.evaluate(()=>{
  const G=__features;advanceTime(0);G.save.sync(s=>{s.rider.made=true;});G.wardrobe.closeChar();G.hidePanels();G.audio.setMuted(true);G.riding.releaseAll();document.activeElement?.blur();
  window.__qaStep=ms=>{const render=G.renderer.render;G.renderer.render=function(scene,camera,...rest){if(camera!==G.camera)return render.call(this,scene,camera,...rest);};try{advanceTime(ms);}finally{G.renderer.render=render;}};
  window.__qaFinishes=[];G.on('rushFinish',r=>__qaFinishes.push(r.runId));
  window.__qaKey=(code,down)=>window.dispatchEvent(new KeyboardEvent(down?'keydown':'keyup',{code,bubbles:true}));
  window.__qaRide=()=>{
   const c=G.course.get(),p=G.horse.player,R=G.horse.RIG(),crossings=[];
   if(!c?.ev)throw Error('No active course');
   const initialTotal=c.jumps.length;
   function stepToward(x,z,tolerance=.3,maxSteps=2000){
    let n=0;
    while(Math.hypot(x-p.pos.x,z-p.pos.z)>tolerance&&G.course.get()===c){
     if(++n>maxSteps)throw Error('Course movement stalled at '+JSON.stringify({idx:c.idx,from:[p.pos.x,p.pos.z],to:[x,z]}));
     const dx=x-p.pos.x,dz=z-p.pos.z,d=Math.hypot(dx,dz),step=Math.min(.12,d);
     p.heading=Math.atan2(dx,dz);p.speed=8;p.pos.x+=dx/d*step;p.pos.z+=dz/d*step;
     __qaStep(20);
    }
   }
   while(G.course.get()===c&&!c.done&&c.idx<c.jumps.length){
    const i=c.idx,j=c.jumps[i],before=c.ce.grades.length;
    if(j.kind==='gate')stepToward(j.x,j.z);
    else{
     const dx=Math.sin(j.rotY),dz=Math.cos(j.rotY);
     stepToward(j.x-dx*6,j.z-dz*6);
     p.heading=j.rotY;p.speed=8;__qaKey('Space',true);__qaStep(20);__qaKey('Space',false);
     const started=R.heroJumpAge!==null;
     stepToward(j.x+dx*.9,j.z+dz*.9);
     crossings.push({index:i,kind:j.kind,jumpStarted:started,grade:c.ce.grades[before],age:R.heroJumpAge});
    }
    if(c.idx===i&&G.course.get()===c)throw Error('Obstacle did not advance '+JSON.stringify({index:i,kind:j.kind,pos:[p.pos.x,p.pos.z],grade:c.ce.lastGrade}));
    if(j.kind==='gate')crossings.push({index:i,kind:'gate'});
   }
   G.riding.releaseAll();p.speed=0;
   return {initialTotal,crossings,result:G.ranchRush.snapshot().lastResult,snapshot:G.ranchRush.snapshot(),finishes:__qaFinishes.slice(),coins:G.save.fresh().coins,courseRemaining:G.course.get()?.ev?.id||null};
  };
 });
 await page.waitForFunction(()=>__features.horse.RIG().ready&&__features.horse.RIG().heroMotion,null,{timeout:90000});
}
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 browser=await QA.chromium.launch({headless:true,args:QA.gpuArgs()});
 const page=await browser.newPage({viewport:{width:1280,height:850},hasTouch:true});
 await page.routeWebSocket('**',ws=>ws.close());page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!/WebSocket|net::ERR|Failed to load resource/i.test(m.text()))report.errors.push(m.text());});page.on('dialog',d=>d.dismiss());
 try{
  await boot(page);
  check(await page.evaluate(()=>!__features.errors.length),'Feature packages install without errors');
  if(process.env.QA_RUSH_FORMAL_ONLY){
   await page.evaluate(()=>{const G=__features;G.hidePanels();G.course.startCourse(G.tables.EVENTS3.find(e=>e.id==='rr'),0);__qaStep(4000);});
   report.formal=await page.evaluate(()=>__qaRide());
   await page.locator('#resultPanel').waitFor({state:'visible',timeout:10000});
   report.formalEnd=await page.evaluate(()=>({last:__features.ladder.last(),course:__features.course.get()?.ev.id||null,panel:document.getElementById('resultPanel').style.cssText}));
   await page.evaluate(()=>advanceTime(0));await page.screenshot({path:out+'/formal.png'});
   check(await page.locator('#resultPanel').isVisible(),'Ordinary races still open their ladder result',report.formalEnd);
   check(!report.errors.length,'No browser or feature errors',report.errors);
   return;
  }
  if(process.env.QA_RUSH_STORY_ONLY){
   const index=await page.evaluate(()=>{const G=__features,i=G.quest.STORY.findIndex(m=>m.ridingAlternative&&m.type==='build');G.save.sync(s=>{s.story.idx=i;s.story.prog=1;s.story.era=2;});return i;});
   check(index>=0,'Existing builder mission is available for the riding alternative');
   await boot(page);
   const before=await page.evaluate(()=>({index:__features.quest.storyIdx(),progress:__features.quest.storyProg(),decor:JSON.stringify(__features.save.fresh().decor),guide:__features.storyGuidance.describe()}));
   check(before.index===index&&before.progress===1&&before.guide.action==='builder-ride','Partially completed builder save offers Ride instead after reload');
   await page.evaluate(()=>__features.storyGuidance.activateCurrent());
   check(await page.evaluate(()=>!!__features.course.get()?.ev?.rush),'Ride instead starts a real Ranch Rush');
   await page.evaluate(()=>__qaStep(4000));report.runs.push(await page.evaluate(()=>__qaRide()));
   const after=await page.evaluate(()=>{const G=__features,m=G.quest.STORY[G.quest.storyIdx()];return {index:G.quest.storyIdx(),progress:G.quest.storyProg(),goal:m.goal,decor:JSON.stringify(G.save.fresh().decor),guide:G.storyGuidance.describe()};});
   check(after.index===index&&after.progress===after.goal&&after.guide.action==='return','A real finish completes only the current construction mission and points to its giver');
   check(after.decor===before.decor,'Riding alternative leaves built decorations unchanged');
   check(report.errors.length===0&&await page.evaluate(()=>!__features.errors.length),'No browser or feature errors');
   return;
  }
  await page.evaluate(()=>{
   const G=__features;G.horse.ridden().level=1;G.save.sync(s=>{s.horses[G.horse.rideIdx()].level=1;s.evDiff=2;});
   G.ranchRushUI.open();
  });
  check(await page.locator('#ranchRushPanel').isVisible(),'Challenge picker opens');
  for(const id of ids){
   const started=await page.evaluate(id=>{
    const G=__features;G.ui.dispatch('rush:start:'+id);const c=G.course.get();
    return {id:c?.ev?.id,rush:c?.ev?.rush,diff:c?.ce?.diff?.k,total:c?.jumps?.length,ghosts:G.events2.ghosts.list.length,field:!!G.ladder.FIELD(),start:G.events2&&JSON.parse(render_game_to_text()).ev2?.start,active:G.ranchRush.snapshot().active};
   },id);
   check(started.id===id&&started.rush&&started.total>0,id+' starts at level 1 despite a saved Elite preference',started);
   check(!started.ghosts&&!started.field,id+' has no artificial rivals');
   check(started.start&&Number.isFinite(started.start.x)&&Number.isFinite(started.start.heading),id+' marshals to a valid first approach');
   if(id===ids[0])for(const width of [390,320]){
    await page.setViewportSize({width,height:844});await page.evaluate(()=>{__qaStep(250);advanceTime(0);});
    const boxes=await page.evaluate(()=>{
     const rect=id=>{const e=document.getElementById(id);if(!e)return null;const s=getComputedStyle(e),r=e.getBoundingClientRect();return s.display==='none'||s.visibility==='hidden'||+s.opacity===0||!r.width||!r.height?null:{left:r.left,right:r.right,top:r.top,bottom:r.bottom};};
     return Object.fromEntries(['rushHud','courseHud','countdown','ev2Call','seJump','seRidePace','stickZone'].map(id=>[id,rect(id)]));
    });
    const h=boxes.rushHud,overlap=(a,b)=>a&&b&&a.left<b.right-1&&a.right>b.left+1&&a.top<b.bottom-1&&a.bottom>b.top+1;
    check(h&&h.left>=0&&h.right<=width+1&&Object.entries(boxes).filter(([key])=>key!=='rushHud').every(([,r])=>!overlap(h,r)),'Active score HUD clears countdown and controls at '+width+'px',boxes);
    await page.screenshot({path:out+'/active-'+width+'.png'});
   }
   if(id===ids[0])await page.setViewportSize({width:1280,height:850});
   await page.evaluate(()=>{__qaStep(4000);});
   check(await page.evaluate(()=>__features.course.get()?.started),'Countdown releases the actual course');
   await page.evaluate(()=>advanceTime(0));await page.screenshot({path:out+'/'+id+'-start.png'});
   const run=await page.evaluate(()=>__qaRide());report.runs.push(run);
   check(run.crossings.length===run.initialTotal&&run.result?.id===id,id+' finishes through every real engine crossing');
   check(run.crossings.filter(r=>r.kind==='fence').every(r=>r.jumpStarted&&['perfect','good','late','early'].includes(r.grade)),id+' uses native jumps over each authored log',run.crossings);
   check(run.finishes.filter(x=>x===run.result.runId).length===1,id+' emits exactly one finish receipt');
   await page.locator('#ranchRushPanel').waitFor({state:'visible',timeout:10000});
   check(await page.locator('#ranchRushPanel').isVisible(),id+' opens its result recap');
   check(!await page.locator('#resultPanel').isVisible()&&!await page.locator('#ev2ResultPanel').isVisible(),id+' keeps competing result cards closed');
   check(await page.evaluate(()=>!__features.save.fresh().runSaved),id+' leaves no incompatible saved course');
   const stable=await page.evaluate(()=>{const G=__features,r=G.ranchRush.snapshot().lastResult;G.ranchRushUI.result(r);G.ranchRushUI.result(r);return {coins:G.save.fresh().coins,plays:G.ranchRush.snapshot().records[r.id].plays};});
   check(stable.coins===run.coins&&stable.plays===run.snapshot.records[id].plays,id+' recap reopens without paying or counting twice');
   await page.evaluate(()=>advanceTime(0));await page.screenshot({path:out+'/'+id+'-result.png'});
  }
  const before=await page.evaluate(()=>__features.ranchRush.snapshot());
  await page.evaluate(()=>__features.ui.dispatch('rush:retry'));
  check(await page.evaluate(()=>__features.course.get()?.ev?.id==='rush-trail'),'Retry immediately starts the same challenge');
  await page.evaluate(()=>__qaStep(4000));const retry=await page.evaluate(()=>__qaRide());report.runs.push(retry);
  check(retry.snapshot.records['rush-trail'].plays===before.records['rush-trail'].plays+1,'Replay counts exactly one additional run');
  check(retry.snapshot.records['rush-trail'].bestScore>=before.records['rush-trail'].bestScore&&retry.snapshot.records['rush-trail'].bestTime<=before.records['rush-trail'].bestTime,'Replay retains the better personal bests');
  await page.locator('#ranchRushPanel').waitFor({state:'visible',timeout:10000});
  const saved=await page.evaluate(()=>__features.ranchRush.snapshot().records);
  await boot(page);
  check(JSON.stringify(await page.evaluate(()=>__features.ranchRush.snapshot().records))===JSON.stringify(saved),'Personal records survive a full reload');
  const cancelled=await page.evaluate(()=>{
   const G=__features,before={coins:G.save.fresh().coins,records:JSON.stringify(G.ranchRush.snapshot().records)};
   G.ui.dispatch('rush:start:rush-pasture');__qaStep(4400);G.course.cancelCourse();__qaStep(20);
   return {before,coins:G.save.fresh().coins,records:JSON.stringify(G.ranchRush.snapshot().records),active:G.ranchRush.snapshot().active};
  });
  check(!cancelled.active&&cancelled.coins===cancelled.before.coins&&cancelled.records===cancelled.before.records,'Leaving an unfinished Rush pays nothing and keeps existing records');
  await page.evaluate(()=>__features.ranchRushUI.open());
  for(const width of [390,320]){
   await page.setViewportSize({width,height:844});
   const layout=await page.locator('#ranchRushPanel').evaluate(e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,scroll:e.scrollWidth,width:e.clientWidth,buttons:[...e.querySelectorAll('button')].filter(b=>b.offsetParent).map(b=>{const r=b.getBoundingClientRect();return {left:r.left,right:r.right,height:r.height};})};});
   check(layout.left>=0&&layout.right<=width+1&&layout.scroll<=layout.width+1&&layout.buttons.every(b=>b.left>=0&&b.right<=width+1&&b.height>=40),'Picker and controls fit '+width+'px phone',layout);
   await page.evaluate(()=>advanceTime(0));await page.screenshot({path:out+'/picker-'+width+'.png'});
  }
  await page.setViewportSize({width:1280,height:850});
  await page.evaluate(()=>{const G=__features;G.hidePanels();G.course.startCourse(G.tables.EVENTS3.find(e=>e.id==='rr'),0);__qaStep(200);});
  check(await page.evaluate(()=>__features.events2.ghosts.list.length>0||!!__features.ladder.FIELD()),'Ordinary races still create their normal field');
  report.formal=await page.evaluate(()=>{__qaStep(4000);return __qaRide();});
  check(!report.formal.courseRemaining&&report.formal.crossings.length===report.formal.initialTotal,'Ordinary race reaches its final gate');
  await page.locator('#resultPanel').waitFor({state:'visible',timeout:10000});
  check(await page.locator('#resultPanel').isVisible(),'Ordinary races still open their ladder result');
  check(report.errors.length===0&&await page.evaluate(()=>!__features.errors.length),'No browser or feature errors');
 }finally{clearTimeout(watchdog);fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

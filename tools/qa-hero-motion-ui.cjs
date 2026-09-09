/* Real controls and real-time pause/playback audit. No viewer or model edits. */
const{chromium}=require('playwright');const fs=require('node:fs'),path=require('node:path');
const out=path.resolve(process.argv[2]||'output/hero-motion-ui');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--use-angle=d3d11']});
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[],checks={},details={};
 page.setDefaultTimeout(5000);
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 const state=()=>page.evaluate(()=>JSON.parse(render_game_to_text()));
 const snap=()=>page.evaluate(()=>heroMotionQA.snapshot());
 const step=ms=>page.evaluate(ms=>advanceTime(ms),ms);
 const ready=selected=>page.waitForFunction(selected=>window.render_game_to_text&&(()=>{const s=JSON.parse(render_game_to_text());return !s.loading&&s.modelReady&&s.selected===selected})(),selected);
 const layout=()=>page.evaluate(()=>{const els=[document.querySelector('.controls'),...document.querySelectorAll('.controls button,.controls select')].filter(e=>!e.hidden),rects=els.map(e=>{const r=e.getBoundingClientRect();return{id:e.id||'controls',x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height}});return{width:innerWidth,height:innerHeight,noHorizontalOverflow:document.documentElement.scrollWidth<=innerWidth,rects,fit:rects.every(r=>r.x>=0&&r.y>=0&&r.right<=innerWidth+.5&&r.bottom<=innerHeight+.5)}});
 try{
  await page.goto('http://127.0.0.1:8431/hero-horse.html');await ready('candidate');await page.evaluate(()=>heroMotionQA.pauseRealtime(true));
  checks.allGaits=true;details.gaits=[];
  for(const gait of['stand','walk','trot','canter','gallop','jump']){await page.selectOption('#motion',gait);await step(gait==='jump'?700:600);const s=await snap();const ok=s.gait===gait&&(gait!=='jump'||!s.grounded);details.gaits.push({requested:gait,actual:s.gait,phase:s.phase01,grounded:s.grounded,ok});checks.allGaits&&=ok}
  await step(1600);checks.jumpReturnsToIdle=(await snap()).gait==='stand';
  checks.leadSelection=true;for(const gait of['canter','gallop'])for(const lead of['right','left']){await page.selectOption('#motion',gait);await step(10);await page.selectOption('#lead',lead);await step(550);checks.leadSelection&&=(await snap()).lead===lead}
  await page.click('#jump');await step(720);checks.jumpButton=(await snap()).gait==='jump'&&!(await snap()).grounded;await step(1500);
  checks.views=true;for(const view of['side','front','head']){await page.click('#'+view);checks.views&&=(await state()).view===view}
  await page.selectOption('#surface','clay');checks.surface=(await state()).surface==='clay';await page.selectOption('#surface','coat');checks.surface&&=(await state()).surface==='coat';
  await page.click('#turn');checks.turntable=(await state()).turntable;await page.click('#turn');checks.turntable&&=!(await state()).turntable;
  await page.selectOption('#motion','walk');await step(900);await page.evaluate(()=>heroMotionQA.pauseRealtime(false));
  await page.click('#pause');const paused0=await snap();await page.waitForTimeout(420);const paused1=await snap();details.pause={timeDelta:paused1.time-paused0.time,phaseDelta:paused1.phase01-paused0.phase01,distanceDelta:paused1.distanceM-paused0.distanceM};checks.pause=Object.values(details.pause).every(v=>Math.abs(v)<1e-8)&&(await page.locator('#pause').textContent())==='Play';
  await page.click('#pause');await page.waitForTimeout(420);const resumed=await snap();checks.resume=resumed.time>paused1.time+.15&&(await page.locator('#pause').textContent())==='Pause';
  async function speed(value){await page.selectOption('#playback',value);await page.waitForTimeout(80);const a=await page.evaluate(()=>({wall:performance.now(),s:heroMotionQA.snapshot()}));await page.waitForTimeout(700);const b=await page.evaluate(()=>({wall:performance.now(),s:heroMotionQA.snapshot()}));return{distance:b.s.distanceM-a.s.distanceM,wallSeconds:(b.wall-a.wall)/1000,simulationSeconds:b.s.time-a.s.time}}
  const normal=await speed('1'),half=await speed('0.5'),ratio=(half.distance/half.wallSeconds)/(normal.distance/normal.wallSeconds);details.playback={normal,half,ratio};checks.halfSpeed=ratio>.40&&ratio<.60;
  await page.evaluate(()=>heroMotionQA.pauseRealtime(true));await page.selectOption('#playback','1');await page.click('#side');details.desktop=await layout();checks.desktopFits=details.desktop.fit&&details.desktop.noHorizontalOverflow;await page.screenshot({path:path.join(out,'desktop.png')});
  await page.click('#previous');await ready('previous');checks.previousModel=(await state()).name==='Previous Quarter Horse';checks.previousHidesMotion=true;for(const id of['motion','lead','playback','pause','jump'])checks.previousHidesMotion&&=!(await page.locator('#'+id).isVisible());
  await page.click('#candidate');await ready('candidate');checks.candidateRestoresMotion=true;for(const id of['motion','lead','playback','pause','jump'])checks.candidateRestoresMotion&&=await page.locator('#'+id).isVisible();
  await page.setViewportSize({width:390,height:844});await page.click('#side');details.mobile=await layout();checks.mobileFits=details.mobile.fit&&details.mobile.noHorizontalOverflow;await page.screenshot({path:path.join(out,'mobile.png')});
  await page.selectOption('#motion','canter');await step(10);await page.selectOption('#lead','right');await step(700);checks.mobileControls=(await snap()).gait==='canter'&&(await snap()).lead==='right';
 }catch(e){errors.push(e.stack||e.message)}
 const report={checks,details,errors,pass:errors.length===0&&Object.values(checks).every(Boolean)};fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({checks,errors,playback:details.playback,pause:details.pause,pass:report.pass}));await browser.close();if(!report.pass)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});

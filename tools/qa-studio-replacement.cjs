const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const url=process.env.STUDIO_URL||'http://127.0.0.1:8431/breeds.html';
const out=path.resolve(process.argv[2]||'output/studio-replacement');
if(process.argv.includes('--skill')){
 const launch=chromium.launch.bind(chromium);
 chromium.launch=async options=>{
  const browser=await launch({...options,args:['--use-angle=d3d11']}),newPage=browser.newPage.bind(browser);
  browser.newPage=async options=>{const page=await newPage(options),goto=page.goto.bind(page);page.goto=async(...args)=>{const response=await goto(...args);await page.waitForFunction(()=>window.render_game_to_text&&JSON.parse(render_game_to_text()).modelReady&&!JSON.parse(render_game_to_text()).loading);await page.waitForTimeout(500);return response;};return page;};return browser;
 };
 process.argv=['node','web_game_playwright_client.js','--url',url,'--actions-json',JSON.stringify({steps:[{buttons:['left_mouse_button'],frames:2,mouse_x:700,mouse_y:400},{buttons:[],frames:8}]}),'--iterations','2','--pause-ms','250','--screenshot-dir',out];
 import(pathToFileURL('C:/Users/msmor/.codex/skills/develop-web-game/scripts/web_game_playwright_client.js').href);
}else{
 fs.mkdirSync(out,{recursive:true});
 (async()=>{
 const browser=await chromium.launch({headless:true,args:['--use-angle=d3d11']});
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],checks={},states=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 const state=()=>page.evaluate(()=>JSON.parse(render_game_to_text()));
 const ready=key=>page.waitForFunction(k=>window.render_game_to_text&&JSON.parse(render_game_to_text()).breed===k&&JSON.parse(render_game_to_text()).modelReady&&!JSON.parse(render_game_to_text()).loading,key,{timeout:120000});
 const select=async key=>{await page.locator('#list button[data-key="'+key+'"]').click();await ready(key);await page.waitForTimeout(100);states.push(await state());};
 await page.goto(url);await ready('artist-study');await page.waitForTimeout(300);
 checks.defaultStudy=(await state()).asset.replacementStudy===true;
 checks.studyRigControls=!(await page.locator('#ride').isVisible())&&await page.locator('#motion').isVisible()&&!(await page.locator('#lead').isVisible());
 checks.studyDefaultRest=(await state()).clip==='Rest';
 checks.allowedStudyClips=JSON.stringify(await page.locator('#motion option').evaluateAll(items=>items.map(o=>o.value)))===JSON.stringify(['stand','idle','walk']);
 checks.studyGroomFound=(await state()).groom?.meshes===4&&(await state()).hair;
 checks.visibleCredit=await page.locator('#credit').isVisible();
 checks.comparisonLink=(await page.locator('.review-link').getAttribute('href'))==='horse-art-review.html';
 await page.screenshot({path:path.join(out,'study-desktop.png')});
 await page.click('#side');await page.screenshot({path:path.join(out,'study-side.png')});
 await page.click('#head');await page.screenshot({path:path.join(out,'study-head.png')});
 checks.headFocus=(await state()).target.every((v,i)=>Math.abs(v-[.0000073,1.915271,1.063753][i])<.001);
 await page.selectOption('#surface','clay');await page.screenshot({path:path.join(out,'study-clay.png')});checks.clayHidesHair=!(await state()).hair;await page.selectOption('#surface','coat');await page.click('#groom');await page.screenshot({path:path.join(out,'study-nohair.png')});checks.hideHair=!(await state()).hair;await page.click('#groom');await page.click('#side');
 await page.click('#turn');const before=await state();await page.evaluate(()=>advanceTime(1000));const after=await state();checks.turntable=after.camera.some((v,i)=>Math.abs(v-before.camera[i])>.01);await page.click('#turn');
 await page.selectOption('#motion','idle');await page.evaluate(()=>advanceTime(200));checks.idleClip=(await state()).clip==='Idle';
 await page.selectOption('#motion','walk');await page.evaluate(()=>advanceTime(350));checks.walkClip=(await state()).clip==='Walk_InPlace';await page.screenshot({path:path.join(out,'study-walk.png')});
 await page.click('#pause');const pauseBefore=await state();await page.evaluate(()=>advanceTime(400));await page.waitForTimeout(80);const pauseAfter=await state();checks.pauseFreezes=pauseAfter.paused&&pauseBefore.clipTime===pauseAfter.clipTime;await page.click('#pause');const resumeBefore=await state();await page.evaluate(()=>advanceTime(80));checks.resumeAdvances=(await state()).clipTime!==resumeBefore.clipTime;
 const timed=await page.evaluate(()=>{const result={};for(const speed of [1,.5,.25]){document.querySelector('#playback').value=String(speed);document.querySelector('#motion').value='walk';document.querySelector('#motion').onchange();advanceTime(400);result[speed]=JSON.parse(render_game_to_text()).clipTime;}document.querySelector('#playback').value='1';return result;});
 checks.playbackSpeeds=Math.abs(timed[1]-.4)<1e-6&&Math.abs(timed[.5]-.2)<1e-6&&Math.abs(timed[.25]-.1)<1e-6;
 await page.reload();await ready('artist-study');checks.reloadRest=(await state()).clip==='Rest'&&!(await state()).paused;
 await select('hero');checks.heroControls=await page.locator('#ride').isVisible();await page.selectOption('#motion','walk');await page.evaluate(()=>advanceTime(200));checks.heroMotion=(await state()).motion==='walk';
 await select('bay');checks.earlierDistinct=(await state()).asset.file!=='rig-study/horse-rig-study.glb'&&!(await page.locator('#ride').isVisible());
 await select('artist-study');const memory1=(await state()).memory;
 await select('hero');await select('bay');await select('artist-study');const memory2=(await state()).memory;
 checks.resourcesStable=memory1.geometries===memory2.geometries&&memory1.textures===memory2.textures;
 checks.studyReset=(await state()).clip==='Rest'&&!(await page.locator('#ride').isVisible());
 await page.setViewportSize({width:390,height:844});await page.click('#side');await page.waitForTimeout(150);await page.screenshot({path:path.join(out,'study-mobile.png')});
 const fits=selector=>page.locator(selector).evaluate(el=>{const b=el.getBoundingClientRect();return b.left>=0&&b.right<=innerWidth&&b.bottom<=innerHeight;});
 checks.mobileControls=await fits('.controls');checks.mobileCredit=await fits('#credit');checks.mobileCatalog=await fits('#list');
 await page.click('#head');await page.screenshot({path:path.join(out,'study-mobile-head.png')});
 await page.goto(url+'?horse=hero');await ready('hero');checks.heroDeepLink=(await state()).breed==='hero';
 await page.goto(url+'?horse=vanner');await ready('vanner');checks.earlierDeepLink=(await state()).breed==='vanner';
 checks.noErrors=errors.length===0;
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({checks,errors,states,timed,memory1,memory2},null,2));console.log(JSON.stringify({checks,errors}));await browser.close();if(Object.values(checks).some(v=>!v))process.exitCode=1;
 })().catch(e=>{console.error(e);process.exitCode=1;});
}

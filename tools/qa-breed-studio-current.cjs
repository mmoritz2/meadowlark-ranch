/* Independent current-hero studio checks; does not mutate app code or assets. */
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const out=path.resolve(process.argv[2]||'output/breed-studio-current-qa');fs.mkdirSync(out,{recursive:true});
const expected=JSON.parse(fs.readFileSync('assets/models/hero-horse/manifest.json','utf8'));
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--use-angle=d3d11']});
 const page=await browser.newPage({viewport:{width:1500,height:940}}),errors=[],failed=[],requests=[],hashJobs=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 page.on('requestfailed',r=>failed.push({url:r.url(),error:r.failure()?.errorText}));
 page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());if(/\.glb|manifest\.json/.test(r.url()))requests.push({url:r.url(),status:r.status()});if(r.url().includes('/hero-animated.glb'))hashJobs.push(r.body().then(b=>hash(b)));});
 const state=()=>page.evaluate(()=>JSON.parse(render_game_to_text()));
 const save=name=>page.screenshot({path:path.join(out,name+'.png')});
 const ready=key=>page.waitForFunction(key=>window.render_game_to_text&&JSON.parse(render_game_to_text()).breed===key&&!JSON.parse(render_game_to_text()).loading&&JSON.parse(render_game_to_text()).status==='',key,{timeout:90000});
 await page.goto('http://127.0.0.1:8431/breeds.html?review=equine-v2');await ready('hero');await page.waitForFunction(()=>JSON.parse(render_game_to_text()).count===25);
 const initial=await state();await save('default-hero');
 const checks={defaultHero:initial.breed==='hero'&&initial.asset.current&&initial.name==='Bay sporthorse',count:initial.count===25,
  manifestIdentity:initial.asset.file===expected.file&&initial.asset.sha256===expected.sha256,
  allEightClips:JSON.stringify(initial.asset.animations.slice().sort())===JSON.stringify(expected.animationClips.slice().sort())};
 await page.click('#pause');const stillA=await page.locator('canvas').evaluate(c=>c.toDataURL());await page.waitForTimeout(220);const stillB=await page.locator('canvas').evaluate(c=>c.toDataURL());checks.pauseFreezes=stillA===stillB;
 const motions={};
 for(const gait of ['walk','trot','canter','gallop']){
  await page.selectOption('#motion',gait);await page.evaluate(()=>advanceTime(900));motions[gait]=await state();checks[gait]=motions[gait].motion===gait;
  if(['canter','gallop'].includes(gait))for(const lead of ['right','left']){await page.selectOption('#lead',lead);await page.evaluate(()=>advanceTime(200));checks[gait+'-'+lead]=(await state()).lead===lead;}
  if(gait==='walk'||gait==='gallop')await save(gait);
 }
 await page.selectOption('#playback','0.5');checks.halfSpeed=(await state()).playback===.5;await page.selectOption('#playback','1');
 await page.selectOption('#motion','jump');await page.evaluate(()=>advanceTime(780));await save('jump');checks.jump=(await state()).motion==='jump';await page.evaluate(()=>advanceTime(1800));checks.jumpReturnsIdle=(await state()).motion==='stand';
 await page.click('#head');checks.headView=(await state()).view==='head';await save('head');await page.click('#groom');checks.hairToggle=(await state()).hair===false;await save('head-no-hair');
 await page.selectOption('#surface','clay');checks.clay=(await state()).surface==='clay';await save('head-clay');await page.selectOption('#surface','wire');checks.wire=(await state()).surface==='wire';await page.selectOption('#surface','coat');await page.click('#groom');await page.click('#side');checks.sideView=(await state()).view==='body';
 const older={};for(const key of ['bay','chestnut','shire','fjord','black']){await page.locator('[data-key="'+key+'"]').click();await ready(key);older[key]=await state();await save('earlier-'+key);}
 checks.earlierModels=Object.values(older).every(s=>s.asset.current===false&&s.motion==='unrigged');
 await page.locator('[data-key="hero"]').click();await ready('hero');const restored=await state();checks.returnHero=restored.asset.sha256===expected.sha256&&restored.asset.current&&restored.motion==='stand';await save('hero-restored');
 await page.click('#turn');const beforeTurn=(await state()).camera;await page.evaluate(()=>advanceTime(500));const afterTurn=(await state()).camera;checks.turntable=(await state()).turntable&&beforeTurn.some((x,i)=>Math.abs(x-afterTurn[i])>.001);await page.click('#turn');
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(180);await save('mobile-body');await page.click('#head');await save('mobile-head');
 checks.mobileControls=await page.locator('.controls').evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=160&&r.bottom<=innerHeight;});
 await page.click('#side');await page.selectOption('#motion','jump');await page.evaluate(()=>advanceTime(780));await save('mobile-jump');await page.evaluate(()=>advanceTime(1800));
 const hashes=await Promise.all(hashJobs);checks.loadedBinaryHash=hashes.length>=2&&hashes.every(h=>h===expected.sha256);checks.noNormalErrors=errors.length===0&&failed.length===0;
 // Deliberate failure is isolated from the normal-flow error verdict.
 const retry=await browser.newPage({viewport:{width:1200,height:900}});let aborted=0;const expectedErrors=[];
 retry.on('pageerror',e=>expectedErrors.push(e.message));retry.on('console',m=>{if(m.type()==='error')expectedErrors.push(m.text());});
 await retry.route('**/hero-animated.glb*',route=>{if(!aborted++){return route.abort('failed');}return route.continue();});
 await retry.goto('http://127.0.0.1:8431/breeds.html?review=retry');await retry.waitForFunction(()=>document.querySelector('#status').textContent.includes('Select it again to retry'),null,{timeout:90000});await retry.screenshot({path:path.join(out,'intentional-load-failure.png')});
 await retry.locator('[data-key="hero"]').click();await retry.waitForFunction(()=>window.render_game_to_text&&JSON.parse(render_game_to_text()).breed==='hero'&&!JSON.parse(render_game_to_text()).loading,null,{timeout:90000});checks.failedLoadRetry=await retry.evaluate(()=>JSON.parse(render_game_to_text()).modelReady&&document.querySelector('#status').textContent==='');await retry.screenshot({path:path.join(out,'retry-success.png')});
 const report={checks,pass:Object.values(checks).every(Boolean),initial,restored,motions,older,loadedBinaryHashes:hashes,requests,errors,failed,intentionalFailureErrors:expectedErrors,visualReview:'pending'};
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({checks,pass:report.pass,errors,failed},null,2));await browser.close();if(!report.pass)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});

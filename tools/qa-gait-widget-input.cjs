/* Actual keyboard events in a disposable, disconnected game session. */
const QA=require('./qa-platform.cjs'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const out=path.resolve(process.env.QA_OUT||path.join(require('node:os').tmpdir(),'meadowlark-gait-widget-input'));
const report={fixture:{viewport:{width:1440,height:940},input:'real desktop keyboard/mouse',isolatedSave:true,webSocketsBlocked:true},checks:[],snapshots:{},errors:[],consoleErrors:[],httpErrors:[],failedRequests:[],blockedSockets:0};
let browser,page;
const check=(ok,label)=>{assert.ok(ok,label);report.checks.push(label);console.log('PASS '+label);};
async function snapshot(name){const value=await page.evaluate(()=>{const G=__features,p=G.horse.player;return {keys:{...window._k},input:G.riding.state(),speed:p.speed,position:p.pos.toArray(),jumpY:p.y,nativeMode:G.horse.RIG().heroMotion?.mode,focus:document.activeElement?.id||document.activeElement?.dataset?.gait,choices:document.getElementById('seGaitChoices').classList.contains('on'),chat:document.getElementById('chatBar').style.display};});report.snapshots[name]=value;return value;}
async function stopped(){await page.waitForFunction(()=>!window._k.KeyW&&Math.abs(__features.horse.player.speed)<.05,null,{timeout:12000});}
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 browser=await QA.chromium.launch({headless:true,args:QA.gpuArgs()});
 const context=await browser.newContext({viewport:{width:1440,height:940},serviceWorkers:'block'});
 await context.routeWebSocket('**',ws=>{report.blockedSockets++;ws.close();});
 page=await context.newPage();page.setDefaultTimeout(15000);
 page.on('pageerror',error=>report.errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')report.consoleErrors.push({text:message.text(),location:message.location()});});
  page.on('response',response=>{if(response.status()>=400)report.httpErrors.push({url:response.url(),status:response.status()});});
 page.on('requestfailed',request=>report.failedRequests.push({url:request.url(),error:request.failure()?.errorText}));
 page.on('dialog',dialog=>dialog.dismiss());
 try{
  console.log('Loading real game at '+QA.BASE);
  await page.goto(QA.BASE+'/ranch3d.html?qa=gait-widget-input',{waitUntil:'domcontentloaded',timeout:150000});
  await page.waitForFunction(()=>window.__features?.riding&&__features.horse.RIG().ready&&__features.horse.RIG().attachedTo===__features.horse.player.mesh&&!document.getElementById('load'),null,{timeout:150000});
  // Only the new context's character-creation overlay is skipped; movement and
  // all assertions below use Playwright's real keyboard and mouse APIs.
  await page.evaluate(()=>{const G=__features;G.save.sync(s=>{s.rider.made=true;});G.wardrobe?.closeChar();G.hidePanels();G.seFrame?.settle();G.audio.setMuted(true);G.riding.releaseAll();G.riding.selectGait('walk');document.activeElement?.blur();});
  await page.waitForFunction(()=>!__features.input.blocked()&&!__features.screenInput.active);
  check(await page.locator('#seGaitUp').isVisible(),'Actual riding gait controls are visible after startup');
  report.initial=await snapshot('initial');
  check(!await page.evaluate(()=>__features.errors.length),'Feature packages installed without errors');

  await page.keyboard.down('w');
  await page.waitForFunction(()=>_k.KeyW&&__features.horse.player.speed>.3);
  const moving=await snapshot('w-held');
  await page.locator('#seGaitUp').click();
  check(await page.evaluate(()=>document.activeElement.id==='seGaitUp'&&_k.KeyW),'Clicking the real gait button transfers focus while W remains held');
  await page.keyboard.up('w');await stopped();
  const released=await snapshot('w-released-over-widget');
  check(!released.keys.KeyW&&!released.input.forward&&Math.abs(released.speed)<.05,'Releasing W over the gait widget clears intent and brings the horse to a stop');
  check(Math.hypot(released.position[0]-moving.position[0],released.position[2]-moving.position[2])>0,'The test exercised a moving horse, not only a key map');

  await page.keyboard.down('w');await page.waitForFunction(()=>_k.KeyW&&__features.horse.player.speed>.3);
  const restarted=await snapshot('fresh-w-with-widget-focus');
  check(restarted.focus==='seGaitUp'&&restarted.input.forward,'Fresh W starts riding while the gait button retains focus');
  await page.keyboard.down('Shift');await page.waitForFunction(()=>__features.riding.state().requested==='gallop');
  await snapshot('shift-held-over-widget');
  await page.keyboard.up('Shift');await page.waitForFunction(()=>!_k.ShiftLeft&&__features.riding.state().requested===__features.riding.state().selected);
  const shiftReleased=await snapshot('shift-released-over-widget');
  check(!shiftReleased.keys.ShiftLeft&&shiftReleased.input.requested!=='gallop','Releasing Shift over the widget restores the selected gait');
  await page.keyboard.up('w');await stopped();

  await page.locator('#seGaitLabel').click();
  const selected=await page.evaluate(()=>[...document.querySelectorAll('#seGaitChoices button')].filter(b=>!b.hidden&&!b.disabled).map(b=>b.dataset.gait));
  await page.keyboard.press('End');
  check(await page.evaluate(()=>document.activeElement.dataset.gait)===selected.at(-1),'End focuses the last available gait');
  await page.keyboard.press('ArrowRight');
  check(await page.evaluate(()=>document.activeElement.dataset.gait)===selected[0],'ArrowRight wraps the open picker without steering');
  await page.keyboard.press('Home');await page.keyboard.press('ArrowDown');
  check(await page.evaluate(()=>document.activeElement.dataset.gait)===selected[1],'ArrowDown advances within the open picker');
  const picker=await snapshot('picker-navigation');
  check(!picker.keys.ArrowRight&&!picker.keys.ArrowDown&&Math.abs(picker.speed)<.05,'Picker arrow navigation leaves movement keys released and the horse stopped');
  await page.screenshot({path:path.join(out,'picker-keyboard.png')});
  await page.keyboard.press('Escape');
  check(await page.evaluate(()=>!document.getElementById('seGaitChoices').classList.contains('on')&&document.activeElement.id==='seGaitLabel'),'Escape closes the picker and returns focus to its button');

  await page.keyboard.press('Space');
  check(await page.evaluate(()=>document.getElementById('seGaitChoices').classList.contains('on')),'Space activates the focused picker button');
  await page.keyboard.press('Home');await page.keyboard.press('Enter');
  await page.waitForFunction(()=>__features.riding.state().selected==='walk');
  const activated=await snapshot('native-button-activation');
  check(!activated.choices&&activated.focus==='seGaitLabel','Enter chooses the focused gait and restores picker-button focus');
  check(!activated.keys.Space&&!activated.keys.Enter&&activated.nativeMode!=='jump'&&activated.jumpY===0&&activated.chat!=='flex','Space and Enter activate controls without jumping or opening chat');

  await page.locator('#seStop').focus();await page.keyboard.down('Space');
  await page.waitForFunction(()=>__features.riding.state().braking);
  check(await page.evaluate(()=>!_k.Space),'Keyboard STOP holds the brake without starting a jump');
  await page.keyboard.up('Space');await page.waitForFunction(()=>!__features.riding.state().braking);
  await snapshot('stop-released');
  check(await page.evaluate(()=>!_k.Space),'Keyboard STOP releases the brake and the Space key');
  await page.screenshot({path:path.join(out,'riding-controls-verified.png')});
  check(report.errors.length===0&&!await page.evaluate(()=>__features.errors.length),'No browser or feature runtime errors during the riding checks');
  report.passed=true;console.log(JSON.stringify({checks:report.checks.length,out,errors:report.errors}));
 }catch(error){report.failure=error.stack;console.error(error);if(page){await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});report.failureState=await page.evaluate(()=>({loading:document.getElementById('loadpct')?.textContent,featureErrors:window.__features?.errors,state:window.render_game_to_text?.()})).catch(()=>null);}process.exitCode=1;}
 finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});

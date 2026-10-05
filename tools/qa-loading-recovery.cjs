/* Actual page startup with a held, then failed module request; no renderer or save edits. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const QA=require('./qa-platform.cjs');
(async()=>{
 const browser=await QA.chromium.launch({headless:true,args:['--disable-gpu']});
 let release;
 try{
  const context=await browser.newContext({viewport:{width:844,height:390},serviceWorkers:'block'}),page=await context.newPage();
  const hold=new Promise(resolve=>{release=resolve;});let held=false,documents=0;
  await page.route('**/*',async route=>{
   const url=route.request().url();if(!url.startsWith(QA.BASE))return route.abort();
   if(route.request().isNavigationRequest())documents++;
   if(url.includes('/assets/vendor/three/build/three.module.js')){held=true;await hold;return route.abort();}
   return route.continue();
  });
  await page.goto(QA.BASE+'/ranch3d.html?qa=loader-recovery',{waitUntil:'commit'});
  await page.locator('#loadTitle').waitFor();
  assert(await page.locator('#loadRetry').isHidden());
  await page.waitForTimeout(10200);
  assert(held);assert.equal(await page.locator('#loadTitle').textContent(),'Saddling up');assert.equal(await page.locator('#load.load-failed').count(),0);
  assert(await page.locator('#loadRetry').isHidden());
  await page.locator('#loadRetry').waitFor({state:'visible',timeout:10000});
  assert.equal(await page.locator('#load.load-failed').count(),0,'a slow request must not be called a failure');
  assert.match(await page.locator('#loadHelp').textContent(),/can wait here or retry/);
  await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),'loadRetry');
  release();await page.locator('#load.load-failed').waitFor();assert.match(await page.locator('#loadpct').textContent(),/3D engine could not start/);
  if(process.env.QA_OUTPUT){fs.mkdirSync(process.env.QA_OUTPUT,{recursive:true});await page.screenshot({path:path.join(process.env.QA_OUTPUT,'loading-retry.png')});}
  await page.locator('#loadRetry').click();await page.waitForFunction(()=>document.querySelector('#load.load-failed'));assert.equal(documents,2,'retry navigates to a fresh startup');
  console.log('Real module request: still loading beyond 9s; retry offered at 15s; request failure reported; Retry reloads passed.');
 }finally{release?.();await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

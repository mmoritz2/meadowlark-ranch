const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path');
const out=process.argv[2]||'output/breed-studio-qa';fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--use-angle=d3d11']});
 const page=await browser.newPage({viewport:{width:1500,height:940}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('http://127.0.0.1:8431/breeds.html?horse=bay');
 await page.waitForFunction(()=>window.render_game_to_text&&JSON.parse(render_game_to_text()).breed==='bay'&&!JSON.parse(render_game_to_text()).loading,null,{timeout:120000,polling:200});
 const count=await page.locator('#list button').count(),state=()=>page.evaluate(()=>JSON.parse(render_game_to_text()));
 const save=async name=>page.screenshot({path:path.join(out,name+'.png')});
 await save('quarter-horse');
 await page.click('#head');const head=await state();await save('head-view');
 await page.click('#groom');const hidden=await state();await page.selectOption('#surface','clay');await save('head-anatomy');
 for(const [key,name]of [['chestnut','Shetland Pony'],['shire','Shire'],['fjord','Norwegian Fjord'],['marwari','Marwari'],['black','Friesian']]){
  await page.locator('[data-key="'+key+'"]').click();await page.waitForFunction(n=>document.querySelector('#name').textContent===n&&document.querySelector('#status').textContent==='',name,{timeout:60000,polling:200});
  await page.waitForTimeout(120);await save(key);
 }
 const changedHead=await state();await page.click('#side');const side=await state();await page.click('#groom');await page.selectOption('#surface','coat');await save('full-body');
 await page.click('#turn');const turn=await state();await page.setViewportSize({width:390,height:844});await page.click('#head');await page.waitForTimeout(200);await save('mobile-head');
 const mobile=await page.locator('.controls').evaluate(el=>{const b=el.getBoundingClientRect();return b.left>=0&&b.right<=innerWidth&&b.bottom<=innerHeight;});
 await page.click('#side');await page.selectOption('#surface','wire');await save('mobile');
 await page.click('a[href="ranch3d.html"]');await page.waitForFunction(()=>typeof render_game_to_text==='function',null,{timeout:120000,polling:300});
 const checks={count:count===25,headView:head.view==='head',hairToggle:hidden.hair===false,headFollowsBreed:changedHead.view==='head'&&changedHead.breed==='black'&&changedHead.target.some((v,i)=>Math.abs(v-head.target[i])>.02),sideReset:side.view==='body',turntable:turn.turntable,mobileControls:mobile,returnToGame:page.url().endsWith('ranch3d.html'),noErrors:errors.length===0};
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors}));await browser.close();if(Object.values(checks).some(v=>!v))process.exitCode=1;
})().catch(e=>{console.error(e);process.exit(1);});

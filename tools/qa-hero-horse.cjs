const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path');
const out=path.resolve(process.argv[2]||'output/hero-horse-review');
const onlyPrevious=process.argv.includes('--previous');
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--use-angle=d3d11']});
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],states=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 const fileOverride=process.argv.find(a=>a.startsWith('--file='))?.slice(7)||(process.argv.includes('--paint')?'hero-textured-review.glb':null);
 if(fileOverride)await page.route('**/hero-horse/manifest.json',route=>{const spec=JSON.parse(fs.readFileSync('assets/models/hero-horse/manifest.json','utf8'));Object.assign(spec,{file:fileOverride,revision:'qa-'+Date.now(),name:'Bay sporthorse',heroGroom:null,anchors:null,rigged:process.argv.includes('--rigged')});if(process.argv.includes('--groom'))Object.assign(spec,JSON.parse(fs.readFileSync('assets/models/hero-horse/hero-groom-anchors.json','utf8')),{file:fileOverride});return route.fulfill({json:spec});});
 await page.goto('http://127.0.0.1:8431/hero-horse.html?model=previous');
 const ready=key=>page.waitForFunction(k=>window.render_game_to_text&&JSON.parse(render_game_to_text()).selected===k&&JSON.parse(render_game_to_text()).modelReady&&!JSON.parse(render_game_to_text()).loading,key,{timeout:120000});
 const state=()=>page.evaluate(()=>JSON.parse(render_game_to_text()));
 for(const key of onlyPrevious?['previous']:['previous','candidate']){
  await page.click('#'+key);await ready(key);
  for(const view of ['side','front','head']){
   await page.click('#'+view);await page.waitForTimeout(100);await page.screenshot({path:path.join(out,key+'-'+view+'.png')});states.push(await state());
  }
  await page.mouse.move(1000,500);await page.mouse.down();await page.mouse.move(777,500,{steps:12});await page.mouse.up();await page.screenshot({path:path.join(out,key+'-head-opposite.png')});
  await page.click('#head');
  await page.selectOption('#surface','clay');await page.screenshot({path:path.join(out,key+'-head-clay.png')});
  await page.click('#side');await page.screenshot({path:path.join(out,key+'-side-clay.png')});await page.selectOption('#surface','coat');
  await page.mouse.move(1050,500);await page.mouse.down();await page.mouse.move(601,500,{steps:14});await page.mouse.up();await page.screenshot({path:path.join(out,key+'-side-opposite.png')});
 }
 const movement=[];if(await page.locator('#motion').isVisible())for(const gait of ['walk','trot','stand']){await page.selectOption('#motion',gait);await page.evaluate(()=>advanceTime(400));await page.click('#side');await page.screenshot({path:path.join(out,'motion-'+gait+'.png')});movement.push(await state());}
 await page.click('#turn');const before=await state();await page.evaluate(()=>advanceTime(4000));const after=await state();await page.click('#turn');
 await page.setViewportSize({width:390,height:844});await page.click('#head');await page.screenshot({path:path.join(out,'mobile-head.png')});
 const fits=await page.locator('.controls').evaluate(el=>{const b=el.getBoundingClientRect();return b.left>=0&&b.right<=innerWidth&&b.bottom<=innerHeight;});
 const checks={models:states.length===(onlyPrevious?3:6),finite:states.every(s=>s.camera.every(Number.isFinite)&&s.bounds.flat().every(Number.isFinite)),views:states.every(s=>['side','head','front'].includes(s.view)),movement:!process.argv.includes('--rigged')||movement.map(s=>s.motion).join(',')==='walk,trot,stand',turntable:before.turntable&&after.camera.some((v,i)=>Math.abs(v-before.camera[i])>.05),mobile:fits,noErrors:errors.length===0};
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({checks,errors,states,movement},null,2));console.log(JSON.stringify({checks,errors}));await browser.close();if(Object.values(checks).some(v=>!v))process.exitCode=1;
})().catch(e=>{console.error(e);process.exit(1);});

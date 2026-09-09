// Capture the rendered model in motion. This is visual QA evidence, not a
// promotional render or a substitute for checking the actual mesh.
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path');
const out=path.resolve(process.argv[2]||'output/hero-motion-review');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--use-angle=d3d11']});
 const context=await browser.newContext({viewport:{width:1280,height:900},recordVideo:{dir:out,size:{width:1280,height:900}}});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8431/hero-horse.html');await page.waitForFunction(()=>window.render_game_to_text&&JSON.parse(render_game_to_text()).modelReady&&!JSON.parse(render_game_to_text()).loading,null,{timeout:120000});
 await page.click('#side');const states=[];
 if(await page.locator('#motion').isVisible())for(const gait of ['walk','trot','stand']){await page.selectOption('#motion',gait);await page.waitForTimeout(gait==='stand'?500:4500);states.push(JSON.parse(await page.evaluate(()=>render_game_to_text())));}
 await page.click('#turn');await page.waitForTimeout(8000);await page.click('#turn');await page.click('#head');await page.waitForTimeout(1600);
 const video=page.video();await context.close();await video.saveAs(path.join(out,'horse-study.webm'));await browser.close();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({errors,states},null,2));console.log(JSON.stringify({errors,states:states.map(s=>s.motion),video:path.join(out,'horse-study.webm')}));if(errors.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exit(1);});

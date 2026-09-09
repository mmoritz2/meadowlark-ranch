const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const out=path.resolve(process.argv[2]||'output/horse-art-review-qa');
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--use-angle=d3d11']});
 const page=await browser.newPage({viewport:{width:1440,height:960}});
 const errors=[],checks=[],states=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 const state=()=>page.evaluate(()=>JSON.parse(render_game_to_text()));
 const ready=key=>page.waitForFunction(key=>{if(!window.render_game_to_text)return false;const s=JSON.parse(render_game_to_text());return s.modelReady&&!s.loading&&s.selected===key;},key,{timeout:60000});
 function check(label,pass){checks.push({label,pass});if(!pass)throw new Error(label);}
 await page.goto('http://127.0.0.1:8431/horse-art-review.html');
 for(const model of ['b2przemo','lyndon','existing']){
   await page.locator(`[data-model="${model}"]`).click();await ready(model);
   for(const view of ['quarter','side','head']){
     await page.locator(`[data-view="${view}"]`).click();await page.waitForTimeout(150);
     const s=await state();states.push(s);check(`${model} ${view} finite and grounded`,s.camera.every(Number.isFinite)&&Math.abs(s.bounds[0][1])<1e-4&&s.view===view);
     await page.screenshot({path:path.join(out,`${model}-${view}.png`)});
   }
   await page.locator('#surface').selectOption('clay');await page.waitForTimeout(150);check(`${model} clay selection`,(await state()).surface==='clay');
   if(model==='b2przemo')check('all candidate groom primitives hidden in clay',await page.evaluate(()=>{const parts=[];horseReview.scene.traverse(o=>{if(o.isMesh&&o.userData.reviewHair)parts.push(o.visible);});return parts.length>=4&&parts.every(v=>!v);}));
   await page.screenshot({path:path.join(out,`${model}-clay-head.png`)});
   await page.locator('#surface').selectOption('coat');
 }
 await page.locator('[data-model="b2przemo"]').click();await ready('b2przemo');await page.locator('[data-view="quarter"]').click();
 const before=(await state()).camera;
 await page.locator('#turn').click();await page.waitForTimeout(400);const after=(await state()).camera;check('turntable moves camera',after.some((n,i)=>Math.abs(n-before[i])>.005));await page.locator('#turn').click();
 await page.mouse.move(720,480);await page.mouse.down();await page.mouse.move(820,460,{steps:5});await page.mouse.up();check('drag orbits',((await state()).camera).some((n,i)=>Math.abs(n-after[i])>.005));
 await page.locator('[data-view="front"]').click();check('front view selected',(await state()).view==='front');await page.locator('[data-view="opposite"]').click();check('opposite side selected',(await state()).view==='opposite');
 await page.locator('#surface').selectOption('wire');check('topology mode selected',(await state()).surface==='wire');await page.locator('#surface').selectOption('coat');
 await page.setViewportSize({width:390,height:844});await page.locator('[data-view="quarter"]').click();await page.waitForTimeout(150);await page.screenshot({path:path.join(out,'mobile-quarter.png')});
 check('mobile controls stay within viewport',await page.locator('.controls').evaluate(e=>{const b=e.getBoundingClientRect();return b.left>=0&&b.right<=innerWidth&&b.bottom<=innerHeight;}));
 check('no browser errors',errors.length===0);fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({checks,errors,states},null,2));console.log(JSON.stringify({checks:checks.length,errors,out}));await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});

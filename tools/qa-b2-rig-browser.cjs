const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path');
const out=path.resolve('output/b2-rig-browser');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--use-angle=d3d11']});
 const page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('http://127.0.0.1:8431/horse-art-review.html');await page.waitForFunction(()=>window.render_game_to_text&&JSON.parse(render_game_to_text()).modelReady&&!JSON.parse(render_game_to_text()).loading);
 await page.evaluate(()=>advanceTime(0));
 const initial=await page.evaluate(()=>JSON.parse(render_game_to_text()));
 if(!initial.animations.includes('Walk_InPlace'))throw new Error('No Walk_InPlace clip');
 const snapshots=[];
 for(const view of ['side','front']){
   await page.locator(`[data-view="${view}"]`).click();
   for(const t of [0,.4,.8,1.2]){
     await page.locator('#movement').selectOption('Walk_InPlace');
     await page.evaluate(t=>advanceTime(t*1000),t);
     const state=await page.evaluate(()=>JSON.parse(render_game_to_text()));
     const bones=await page.evaluate(()=>{const points=[];horseReview.scene.updateMatrixWorld(true);horseReview.scene.traverse(o=>{if(o.isBone)points.push({name:o.name,matrix:o.matrixWorld.toArray()});});return points;});
     if(!bones.length||bones.some(b=>!b.matrix.every(Number.isFinite)))throw new Error('Invalid skeleton');
     snapshots.push({view,t,state,boneCount:bones.length});await page.screenshot({path:path.join(out,`${view}-${t.toFixed(1)}.png`)});
   }
 }
 await page.locator('#pause').click();const paused=await page.evaluate(()=>JSON.parse(render_game_to_text()).animationTime);await page.evaluate(()=>advanceTime(400));
 if((await page.evaluate(()=>JSON.parse(render_game_to_text()).animationTime))!==paused)throw new Error('Pause did not hold animation');await page.locator('#pause').click();
 await page.locator('#movement').selectOption('Idle');await page.evaluate(()=>advanceTime(500));await page.locator('[data-view="head"]').click();await page.screenshot({path:path.join(out,'idle-head.png')});
 await page.locator('#movement').selectOption('');await page.locator('[data-view="quarter"]').click();await page.screenshot({path:path.join(out,'rest-quarter.png')});
 const result={initial,snapshots,errors,pauseHolds:true};fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(result,null,2));await browser.close();if(errors.length)throw new Error(errors.join('\n'));console.log(JSON.stringify({clips:initial.animations,errors,out}));
})().catch(e=>{console.error(e);process.exit(1);});

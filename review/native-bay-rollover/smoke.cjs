const fs=require('fs'),path=require('path'),QA=require('../../tools/qa-platform.cjs');
(async()=>{const browser=await QA.chromium.launch({headless:true,args:QA.gpuArgs(['--no-sandbox'])});try{
 const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});page.on('request',r=>requests.push(r.url()));
 await page.goto(QA.BASE+'/review/native-bay-rollover/review.html');await page.waitForFunction(()=>window.retargetInspect?.().ready,null,{timeout:60000});
 const walk=await page.evaluate(()=>retargetSetPhase(.08));await page.click('#side');await page.screenshot({path:path.join(__dirname,'side.png')});
 await page.evaluate(()=>retargetSetPhase(.58));await page.click('#quarter');await page.screenshot({path:path.join(__dirname,'quarter.png')});
 const rest=await page.evaluate(()=>retargetSetClip('Rest'));const restored=await page.evaluate(()=>retargetSetClip('Target Native Walk Rollover'));const seams=await page.evaluate(()=>retargetClipSeams());
 const report={url:page.url(),errors,ignoredOutputRequests:requests.filter(u=>new URL(u).pathname.startsWith('/output/')),walk:{clip:walk.right.clip,bones:walk.right.bones,finite:walk.right.finite,leftClip:walk.left.clip},rest:{clip:rest.right.clip,bones:rest.right.bones,finite:rest.right.finite},restoredClip:restored.right.clip,seamMaxComponentDelta:Math.max(...Object.values(seams).flat().map(t=>t.maxComponentDifference))};
 report.pass=errors.length===0&&report.ignoredOutputRequests.length===0&&walk.right.bones===677&&walk.right.finite&&walk.left.clip==='Rest'&&rest.right.clip==='Rest'&&rest.right.finite&&restored.right.clip==='Target Native Walk Rollover'&&report.seamMaxComponentDelta===0;
 fs.writeFileSync(path.join(__dirname,'smoke-report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(!report.pass)process.exitCode=1;
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

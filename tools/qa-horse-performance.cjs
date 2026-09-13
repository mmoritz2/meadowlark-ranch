const QA=require('./qa-platform.cjs');
const {chromium}=QA;
const fs=require('node:fs');
(async()=>{
 /* QA.ANGLE is the platform's own GPU backend rather than a literal. This script is the
    reason the helper exists: with the Windows d3d11 backend hardcoded it measured a CPU
    rasteriser instead of the game and reported 6.5 SECONDS a frame, which looks like
    catastrophe and means nothing. See tools/qa-platform.cjs for the rest of that story. */
 const browser=await chromium.launch({headless:true,args:[QA.ANGLE,'--enable-gpu-rasterization','--ignore-gpu-blocklist','--disable-background-timer-throttling']});
 const page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(QA.BASE+'/ranch3d.html',{timeout:120000});
 await page.waitForFunction(()=>window.render_game_to_text&&JSON.parse(render_game_to_text()).graphics.horseReady&&!JSON.parse(render_game_to_text()).graphics.horseLoading,null,{timeout:120000,polling:250});
 const timing=await page.evaluate(()=>new Promise(resolve=>{
  const spans=[];let last=performance.now(),warmup=30;
  function frame(now){if(warmup>0)warmup--;else spans.push(now-last);last=now;if(spans.length<150)requestAnimationFrame(frame);else{spans.sort((a,b)=>a-b);resolve({medianMs:spans[75],p95Ms:spans[142],frames:spans.length});}}
  requestAnimationFrame(frame);
 }));
 fs.mkdirSync('output/anatomy-performance',{recursive:true});
 /* The screenshot is a keepsake, not a measurement. Playwright's default 30 s cap on it is
    easy to exceed on a busy machine once the scene is large, and losing the whole timing
    run to a missing PNG is a poor trade — so it is bounded and allowed to fail. */
 try{await page.screenshot({path:'output/anatomy-performance/riding.png',timeout:8000});}
 catch(e){console.warn('screenshot skipped:',e.message.split('\n')[0]);}
 const state=await page.evaluate(()=>JSON.parse(render_game_to_text()));
 fs.writeFileSync('output/anatomy-performance/report.json',JSON.stringify({timing,errors,state},null,2));console.log(JSON.stringify({timing,errors}));await browser.close();if(errors.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exit(1);});

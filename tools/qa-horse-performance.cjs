const {chromium}=require('playwright');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--use-angle=d3d11','--disable-background-timer-throttling']});
 const page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8431/ranch3d.html',{timeout:120000});
 await page.waitForFunction(()=>window.render_game_to_text&&JSON.parse(render_game_to_text()).graphics.horseReady&&!JSON.parse(render_game_to_text()).graphics.horseLoading,null,{timeout:120000,polling:250});
 const timing=await page.evaluate(()=>new Promise(resolve=>{
  const spans=[];let last=performance.now(),warmup=30;
  function frame(now){if(warmup>0)warmup--;else spans.push(now-last);last=now;if(spans.length<150)requestAnimationFrame(frame);else{spans.sort((a,b)=>a-b);resolve({medianMs:spans[75],p95Ms:spans[142],frames:spans.length});}}
  requestAnimationFrame(frame);
 }));
 fs.mkdirSync('output/anatomy-performance',{recursive:true});await page.screenshot({path:'output/anatomy-performance/riding.png'});
 const state=await page.evaluate(()=>JSON.parse(render_game_to_text()));
 fs.writeFileSync('output/anatomy-performance/report.json',JSON.stringify({timing,errors,state},null,2));console.log(JSON.stringify({timing,errors}));await browser.close();if(errors.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exit(1);});

/* Read-only runtime trial: substitutes one reach margin via Playwright route. */
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path');
const out=path.resolve('output/hero-motion-margin-trial');fs.mkdirSync(out,{recursive:true});
const source=fs.readFileSync(path.join(__dirname,'qa-hero-motion.cjs'),'utf8');
const {analyze}=new Function('require','process',source.slice(0,source.indexOf('(async()=>{'))+'return {analyze};')(require,{argv:[]});
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--use-angle=d3d11']});
 const original=fs.readFileSync('assets/hero-horse-motion.js','utf8'),find='distanceTo(restP[leg.fetlock])-.002,horizontal=';
 if(!original.includes(find))throw Error('Expected exact original margin absent');
 const results={};
 for(const margin of [.002,.014]){
  const folder=path.join(out,String(margin));fs.mkdirSync(folder,{recursive:true});
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  await page.route('**/assets/hero-horse-motion.js*',r=>r.fulfill({contentType:'text/javascript',body:original.replace(find,'distanceTo(restP[leg.fetlock])-'+margin+',horizontal=')}));
  await page.goto('http://127.0.0.1:8431/hero-horse.html');
  await page.waitForFunction(()=>window.heroMotionQA&&JSON.parse(render_game_to_text()).modelReady&&!JSON.parse(render_game_to_text()).loading,null,{timeout:120000});
  const baseline=await page.evaluate(()=>{heroMotionQA.pauseRealtime(true);heroMotionQA.reset();return heroMotionQA.snapshot();});
  const stable=await page.evaluate(()=>{heroMotionQA.set('walk');advanceTime(2000);return heroMotionQA.snapshot();});
  await page.click('#side');
  const frames=[],count=Math.ceil(4.05/stable.cycleHz*60),captureFrames=new Map(Array.from({length:8},(_,i)=>[Math.round(i*60/stable.cycleHz/8),i]));
  for(let i=0;i<=count;i++){
   const s=await page.evaluate(i=>{if(i)advanceTime(1000/60);return heroMotionQA.snapshot();},i);frames.push({t:i/60,...s});
   if(captureFrames.has(i))await page.screenshot({path:path.join(folder,'walk-phase-'+String(captureFrames.get(i)).padStart(2,'0')+'.png')});
  }
  const report=analyze({gait:'walk',lead:'left'},frames,baseline),heights=frames.map(s=>s.bonePositions[0][1]);
  results[margin]={...report,rootMinM:Math.min(...heights),rootMaxM:Math.max(...heights)};
  fs.writeFileSync(path.join(folder,'samples.json'),JSON.stringify(frames));await page.close();
 }
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(results,null,2));
 console.log(JSON.stringify(Object.fromEntries(Object.entries(results).map(([k,r])=>[k,{pass:r.pass,rotation:r.maxFrameBoneRotationDeg,displacement:r.maxFrameBoneDisplacementM,rootMin:r.rootMinM,rootMax:r.rootMaxM}]))));
 await browser.close();
})().catch(e=>{console.error(e);process.exitCode=1});

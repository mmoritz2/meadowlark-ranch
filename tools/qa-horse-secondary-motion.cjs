const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const QA=require('./qa-platform.cjs'),{chromium}=QA;
const variant=process.env.SECONDARY_HORSE==='bay'?'bay':'white';
const out=path.resolve('output/horse-secondary-motion',variant);fs.mkdirSync(out,{recursive:true});
const url=QA.BASE+'/review/horse-secondary-motion.html?horse='+variant;
(async()=>{
 const browser=await chromium.launch({headless:true,args:QA.gpuArgs(['--no-sandbox'])});
 try{
  const page=await browser.newPage({viewport:{width:1600,height:900},deviceScaleFactor:1});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  await page.goto(url);await page.waitForFunction(()=>typeof secondaryReviewInspect==='function'&&secondaryReviewInspect().ready,null,{timeout:60000});
  await page.click('#side');const rows=[];
  for(const speed of ['1','2']){
   await page.selectOption('#speed',speed);
   for(const phase of [.10,.35,.60]){
    const row=await page.evaluate(f=>secondaryReviewSetPhase(f),phase);rows.push({speed,phase,bones:row.originalBones,strandCount:row.strandCount,maneStrands:row.maneStrands,tailStrands:row.tailStrands,maxDeltaDegrees:row.maxDeltaDegrees,nonzeroStrands:row.nonzeroStrands,bodyQuaternionMaxComponentDelta:row.bodyQuaternionMaxComponentDelta});
    await page.screenshot({path:path.join(out,`side-${speed}x-${Math.round(phase*100)}.png`)});
   }
  }
  await page.click('#head');await page.evaluate(()=>secondaryReviewSetPhase(.35));await page.screenshot({path:path.join(out,'mane-closeup.png')});
  await page.click('#tail');await page.evaluate(()=>secondaryReviewSetPhase(.35));await page.screenshot({path:path.join(out,'tail-closeup.png')});
  const report={url,rows,errors};fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
  assert.equal(errors.length,0,errors.join('\n'));assert(rows.every(x=>x.bones===677&&x.strandCount>=20&&x.maneStrands>0&&x.tailStrands>0&&x.nonzeroStrands>=20&&x.maxDeltaDegrees>1&&x.bodyQuaternionMaxComponentDelta<1e-6));
  console.log(JSON.stringify(report));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});

const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const QA=require('../../tools/qa-platform.cjs'),{chromium}=QA;
const out=path.resolve('output/target-native-trot-audit');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const input=fs.readFileSync('review/native-horse-kit/model.glb'),candidateSha256=crypto.createHash('sha256').update(input).digest('hex');
 const browser=await chromium.launch({headless:true,args:QA.gpuArgs(['--no-sandbox'])});
 try{
  const page=await browser.newPage({viewport:{width:1500,height:900},deviceScaleFactor:1}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  await page.goto(QA.BASE+'/review/target-native-trot/audit-viewer.html');
  await page.waitForFunction(()=>window.sourceInspect?.().ready,null,{timeout:60000});
  const structure=await page.evaluate(()=>sourceStructure),rows=[];
  for(let i=0;i<256;i++)rows.push(await page.evaluate(f=>sourceSetPhase(f),i/256));
  for(const view of ['side','quarter']){
   await page.evaluate(v=>sourceSetView(v),view);
   for(let i=0;i<16;i++){
    const phase=i/16;await page.evaluate(f=>sourceSetPhase(f),phase);
    await page.screenshot({path:path.join(out,`trot-${view}-${String(Math.round(phase*1000)).padStart(3,'0')}.png`)});
   }
  }
  for(const foot of ['FL','FR','HL','HR']){
   await page.evaluate(v=>sourceSetView(v),'foot-'+foot);
   const offset=structure.intent.footOffsets[foot],duty=structure.intent.stanceFraction;
   for(const fraction of [.8,.97]){
    await page.evaluate(f=>sourceSetPhase(f),(offset+duty*fraction)%1);
    await page.screenshot({path:path.join(out,`roll-${foot}-${Math.round(fraction*100)}.png`)});
   }
  }
  const first=await page.evaluate(()=>sourceSetPhase(0)),last=await page.evaluate(()=>sourceSetTime(sourceInspect().duration-.00000001));
  fs.writeFileSync(path.join(out,'browser-report.json'),JSON.stringify({candidateSha256,structure,rows,first,last,errors},null,2)+'\n');
  console.log(JSON.stringify({candidateSha256,errors,clip:first.clip,phases:rows.length,intent:structure.intent,floor:first.groundY}));
  if(errors.length)process.exitCode=1;
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});

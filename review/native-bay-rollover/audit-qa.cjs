const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const QA=require('../../tools/qa-platform.cjs'),{chromium}=QA;
const ROOT=path.resolve(__dirname,'../..');
const out=path.join(ROOT,'output/native-bay-rollover-audit');fs.mkdirSync(out,{recursive:true});
const smoke=process.argv.includes('--smoke');
(async()=>{
 const input=fs.readFileSync(path.join(ROOT,'review/native-bay-rollover/model.glb')),candidateSha256=crypto.createHash('sha256').update(input).digest('hex');
 if(candidateSha256!=='8f622bf3b22244ba1b6a39c72e3cb1ce6f2e378bb7eb731a22caba33b2459814')throw Error('Candidate hash changed before independent audit');
 const browser=await chromium.launch({headless:true,args:QA.gpuArgs(['--no-sandbox'])});
 try{
  const page=await browser.newPage({viewport:{width:1500,height:900},deviceScaleFactor:1}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  await page.goto(QA.BASE+'/review/native-bay-rollover/audit-viewer.html');
  await page.waitForFunction(()=>window.sourceInspect?.().ready && window.sourceStructure && /Native.*Walk.*Rollover/i.test(window.sourceInspect().clip),null,{timeout:60000});
  const structure=await page.evaluate(()=>sourceStructure),rows=[];
  if(smoke){const pose=await page.evaluate(()=>sourceSetPhase(.25));const finite=pose.allBoneTransformsFinite && [...pose.bounds.min,...pose.bounds.max,...Object.values(pose.bones).flatMap(b=>[...b.p,...b.q])].every(Number.isFinite);const report={candidateSha256,originalSourceSha256:structure.originalSourceSha256,clip:pose.clip,ready:pose.ready,bones:pose.boneCount,finite,intent:structure.intent,floor:pose.groundY,errors};fs.writeFileSync(path.join(out,'review-smoke.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));if(errors.length||!finite)process.exitCode=1;return;}
  for(let i=0;i<256;i++)rows.push(await page.evaluate(f=>sourceSetPhase(f),i/256));
  for(const view of ['side','quarter']){
   await page.evaluate(v=>sourceSetView(v),view);
   for(let i=0;i<16;i++){
    const phase=i/16;await page.evaluate(f=>sourceSetPhase(f),phase);
    await page.screenshot({path:path.join(out,`walk-${view}-${String(Math.round(phase*1000)).padStart(3,'0')}.png`)});
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

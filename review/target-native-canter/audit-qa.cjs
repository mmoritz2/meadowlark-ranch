const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const QA=require('../../tools/qa-platform.cjs'),{chromium}=QA;
const ROOT=path.resolve(__dirname,'../..');
const out=path.join(ROOT,'output/target-native-canter-audit');fs.mkdirSync(out,{recursive:true});
const smoke=process.argv.includes('--smoke');
const EXPECTED_SHA='81039eb4d4c2e75ae992b78b4e6382d41bd7b302c5c4fdce75388a71901045d2';
(async()=>{
 const input=fs.readFileSync(path.join(ROOT,'review/native-horse-kit/model.glb')),candidateSha256=crypto.createHash('sha256').update(input).digest('hex');
 const preserved=JSON.parse(fs.readFileSync(path.join(ROOT,'review/native-horse-kit/preservation.json'),'utf8'));
 if(candidateSha256!==preserved.targetSha256 || preserved.inputs['output/target-native-canter/target-native-canter.glb']!==EXPECTED_SHA || !preserved.originalBinaryPrefixIdentical || !Object.values(preserved.sourceDataUnchanged).every(Boolean))throw Error('Combined-kit provenance changed; validate source and curves before another audit');
 for(const clip of ['Target Native Canter Left','Target Native Canter Right']){const check=preserved.curveChecks[clip];if(check?.channels!==82 || !check.allInputAndOutputValuesIdentical)throw Error('Canter curves do not match independently audited source');}
 const browser=await chromium.launch({headless:true,args:QA.gpuArgs(['--no-sandbox'])});
 try{
  const page=await browser.newPage({viewport:{width:1500,height:900},deviceScaleFactor:1}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  await page.goto(QA.BASE+'/review/target-native-canter/audit-viewer.html');
  await page.waitForFunction(()=>window.sourceStructure && window.sourceInspect?.().ready && /Target Native Canter/.test(window.sourceInspect().clip),null,{timeout:60000});
  const results=[];
  for(const lead of ['left','right']){
   const clip='Target Native Canter '+lead[0].toUpperCase()+lead.slice(1);
   await page.evaluate(c=>sourceSetClip(c),clip);
   const structure=await page.evaluate(()=>sourceStructure),rows=[];
   if(smoke){const pose=await page.evaluate(()=>sourceSetPhase(.25));results.push({lead,clip:pose.clip,ready:pose.ready,bones:structure.boneNames.length,inspectedBones:Object.keys(pose.bones).length,intent:structure.intent,floor:pose.groundY});continue;}
   for(let i=0;i<256;i++)rows.push(await page.evaluate(f=>sourceSetPhase(f),i/256));
   for(const view of ['side','quarter']){
    await page.evaluate(v=>sourceSetView(v),view);
    for(let i=0;i<16;i++){
     const phase=i/16;await page.evaluate(f=>sourceSetPhase(f),phase);
     await page.screenshot({path:path.join(out,`canter-${lead}-${view}-${String(Math.round(phase*1000)).padStart(3,'0')}.png`)});
    }
   }
   for(const foot of ['FL','FR','HL','HR']){
    await page.evaluate(v=>sourceSetView(v),'foot-'+foot);
    const offset=structure.intent.footOffsets[foot],duty=structure.intent.stanceFraction;
    for(const fraction of [.8,.97]){
     await page.evaluate(f=>sourceSetPhase(f),(offset+duty*fraction)%1);
     await page.screenshot({path:path.join(out,`roll-${lead}-${foot}-${Math.round(fraction*100)}.png`)});
    }
   }
   const first=await page.evaluate(()=>sourceSetPhase(0)),last=await page.evaluate(()=>sourceSetTime(sourceInspect().duration-.00000001));
   fs.writeFileSync(path.join(out,`browser-${lead}.json`),JSON.stringify({candidateSha256,independentlyAuditedCandidateSha256:EXPECTED_SHA,structure,rows,first,last,errors},null,2)+'\n');
   results.push({lead,clip:first.clip,phases:rows.length,intent:structure.intent,floor:first.groundY});
  }
  fs.writeFileSync(path.join(out,smoke?'combined-kit-smoke.json':'qa-report.json'),JSON.stringify({candidateSha256,independentlyAuditedCandidateSha256:EXPECTED_SHA,mode:smoke?'viewer-smoke':'256-phase-per-lead',errors,results},null,2)+'\n');
  console.log(JSON.stringify({candidateSha256,errors,results}));if(errors.length)process.exitCode=1;
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});

const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const QA=require('../../tools/qa-platform.cjs'),{chromium}=QA;
const out=path.resolve(__dirname,'../../output/native-bay-proof'),url=QA.BASE+'/review/bay-native-proof/review.html';
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.QA_CHROMIUM,args:QA.gpuArgs(['--no-sandbox'])});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  await page.goto(url);await page.waitForFunction(()=>JSON.parse(render_game_to_text()).modelReady,null,{timeout:60000});
  const rest=await page.evaluate(()=>({geometry:breedStudioInspect(),pose:bayReviewPose()}));
  await page.selectOption('#motion','walk');await page.click('#pause');
  const rows=[];
  for(const view of ['quarter','side']){
   if(view==='side')await page.click('#side');
   for(let i=0;i<8;i++){
    const phase=i/8,r=await page.evaluate(p=>({geometry:nativeReviewSetPhase(p),pose:bayReviewPose()}),phase);
    rows.push({view,phase,finite:r.geometry.finite,bones:r.geometry.bones,vertices:r.geometry.vertices,minY:r.geometry.bounds.min[1],maxY:r.geometry.bounds.max[1],pose:r.pose});
    await page.screenshot({path:path.join(out,`fulljoint-${view}-${i}.png`)});
   }
  }
  const cycle=await page.evaluate(()=>Array.from({length:96},(_,i)=>{const g=nativeReviewSetPhase(i/96),p=bayReviewPose();return {phase:i/96,minY:g.bounds.min[1],maxY:g.bounds.max[1],upperBackMarkerM:p.withers,hoofMinY:p.hoofMinY,bones:p.bones,maneTip:p.maneTip,tailTip:p.tailTip,finite:g.finite};}));
  const report={url,asset:JSON.parse(await page.evaluate(()=>render_game_to_text())).asset,rest,rows,cycle,errors};
  fs.writeFileSync(path.join(out,'qa-fulljoint-report.json'),JSON.stringify(report,null,2));
  assert.deepEqual(errors,[]);
  assert.equal(report.asset.nativeJoints,677);
  assert.equal(cycle.length,96);
  assert(cycle.every(x=>x.finite&&Object.values(x.hoofMinY).every(Number.isFinite)));
  console.log(JSON.stringify({asset:report.asset,minY:[Math.min(...cycle.map(x=>x.minY)),Math.max(...cycle.map(x=>x.minY))],upperBackMarkerM:[Math.min(...cycle.map(x=>x.upperBackMarkerM)),Math.max(...cycle.map(x=>x.upperBackMarkerM))],errors}));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});

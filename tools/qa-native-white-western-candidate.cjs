const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const QA=require('./qa-platform.cjs'),{chromium}=QA;
const out=path.resolve('output/native-white-western-candidate');fs.mkdirSync(out,{recursive:true});
const url=QA.BASE+'/assets/models/horse-imports/wildmesh-white-western/game/native-candidate/review.html';
const candidateDir=path.resolve('assets/models/horse-imports/wildmesh-white-western/game/native-candidate');
const metadata=JSON.parse(fs.readFileSync(path.join(candidateDir,'candidate.json'),'utf8'));
const candidate=fs.readFileSync(path.join(candidateDir,metadata.candidateFile));
assert.equal(crypto.createHash('sha256').update(candidate).digest('hex'),metadata.candidateSha256);
assert.equal(candidate.length,metadata.candidateBytes);
function summary(a){const s=[...a].sort((x,y)=>x-y);return {count:s.length,median:s[Math.floor(s.length*.5)],p95:s[Math.floor(s.length*.95)],max:s.at(-1)};}
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.QA_CHROMIUM,args:QA.gpuArgs(['--no-sandbox','--enable-precise-memory-info'])});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('favicon'))errors.push(m.text())});
  const start=Date.now();await page.goto(url);await page.waitForFunction(()=>JSON.parse(render_game_to_text()).modelReady,null,{timeout:60000});const loadMs=Date.now()-start;
  await page.selectOption('#motion','walk');await page.click('#pause');
  const rows=[];
  for(const view of ['quarter','side']){
   if(view==='side')await page.click('#side');
   for(let i=0;i<8;i++){
    const phase=i/8,record=await page.evaluate(p=>({inspection:nativeReviewSetPhase(p),metrics:nativeReviewMetrics()}),phase);
    rows.push({view,phase,minY:record.inspection.bounds.min[1],maxY:record.inspection.bounds.max[1],bones:record.inspection.bones,vertices:record.inspection.vertices,drawCalls:record.metrics.render.calls,triangles:record.metrics.render.triangles});
    await page.screenshot({path:path.join(out,`studio-native-${view}-${i}.png`)});
   }
  }
  const cycle=await page.evaluate(()=>Array.from({length:96},(_,i)=>{const r=nativeReviewSetPhase(i/96);return {phase:i/96,minY:r.bounds.min[1],finite:r.finite,bones:r.bones};}));
  await page.click('#pause');
  async function sampleFrames(n){
   await page.evaluate(total=>nativeReviewSetCrowd(total),n);
   return page.evaluate(async()=>{
    const values=[];let last=0;for(let i=0;i<150;i++)await new Promise(resolve=>requestAnimationFrame(t=>{if(last&&i>=30)values.push(t-last);last=t;resolve();}));
    return {intervals:values,metrics:nativeReviewMetrics()};
   });
  }
  const one=await sampleFrames(1),four=await sampleFrames(4);
  one.metrics.frameCpuMs=summary(one.metrics.frameCpuMs);four.metrics.frameCpuMs=summary(four.metrics.frameCpuMs);
  const report={url,loadMs,glbBytes:metadata.candidateBytes,cycle,asset:JSON.parse(await page.evaluate(()=>render_game_to_text())).asset,rows,performance:{one:{frameMs:summary(one.intervals),metrics:one.metrics},four:{frameMs:summary(four.intervals),metrics:four.metrics},environment:'Headless Chromium using the Mac Apple M1 Max ANGLE Metal renderer; Ranch scene and weaker devices still need separate review.'},errors};
  assert.equal(report.asset.nativeJoints,677);assert.deepEqual(report.asset.animations,['Horse|Horse_Idle','Horse|Horse_Walk']);
  assert(rows.every(r=>r.bones===677&&r.minY>=-.01&&r.minY<=.01));
  assert(cycle.every(r=>r.finite&&r.bones===677&&r.minY>=-.01&&r.minY<=.01));
  assert.equal(errors.length,0,errors.join('\n'));
  fs.writeFileSync(path.join(out,'studio-native-report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({loadMs,rangeMinY:[Math.min(...cycle.map(r=>r.minY)),Math.max(...cycle.map(r=>r.minY))],one:report.performance.one,four:report.performance.four,errors}));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});

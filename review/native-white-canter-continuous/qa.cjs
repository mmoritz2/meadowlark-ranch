/* Actual Three.js GLTF/browser scan of the private White fast-gait candidates. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const QA=require('../../tools/qa-platform.cjs'),{chromium}=QA;
const ROOT=path.resolve(__dirname,'../..'),OUT=path.join(ROOT,'output/native-white-canter-continuous');
const gait=(process.env.QA_GAIT||'canter').toLowerCase();if(!['canter','trot'].includes(gait))throw Error('QA_GAIT must be canter or trot');
const INPUT=path.join(__dirname,`${gait}.glb`);
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const expectedSource='fd18d9b9b22e00dc30a6fa1cfe2e135bb20f7c871df0a976706aaea2f4dff655';
(async()=>{
 if(hash(path.join(ROOT,'assets/models/horse-imports/wildmesh-white-western/game/native-candidate/native-white-western-candidate.glb'))!==expectedSource)throw Error('Immutable White input changed');
 const candidateSha256=hash(INPUT),browser=await chromium.launch({headless:true,args:QA.gpuArgs(['--no-sandbox'])});
 const errors=[],reports=[];fs.mkdirSync(OUT,{recursive:true});
 try{
  const page=await browser.newPage({viewport:{width:1500,height:900},deviceScaleFactor:1});
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  await page.goto(QA.BASE+`/review/native-white-canter-continuous/viewer.html?gait=${gait}`);
  await page.waitForFunction(()=>window.sourceStructure&&window.sourceInspect?.().ready,null,{timeout:60000});
  let structure=await page.evaluate(()=>sourceStructure);
  if(structure.originalSourceSha256!==expectedSource||structure.boneNames.length!==677||structure.clips.length!==(gait==='trot'?1:2))throw Error('White browser structure mismatch');
  for(const lead of (gait==='trot'?['Trot']:['Left','Right'])){
   const name=gait==='trot'?'Target Native Trot':'Target Native Canter '+lead;await page.evaluate(n=>sourceSetClip(n),name);structure=await page.evaluate(()=>sourceStructure);
   const rows=[];for(let i=0;i<128;i++)rows.push(await page.evaluate(f=>sourceSetPhase(f),i/128));
   const first=await page.evaluate(()=>sourceSetPhase(0));const last=await page.evaluate(()=>sourceSetTime(sourceInspect().duration-1e-8));
   const nonfinite=rows.filter(r=>!r.allBoneTransformsFinite||!Number.isFinite(r.bounds.min[1])||!Number.isFinite(r.bounds.max[1]));
   const stance={};let suspension=0,bodyMin=Infinity,bodyMax=-Infinity;
   for(const key of ['FL','FR','HL','HR'])stance[key]=[];
   for(const r of rows){bodyMin=Math.min(bodyMin,r.bounds.min[1]-r.groundY);bodyMax=Math.max(bodyMax,r.bounds.max[1]-r.groundY);let count=0;
    for(const key of ['FL','FR','HL','HR'])if(r.feet[key].stance){count++;stance[key].push(r.feet[key].minY);}
    if(count===0)suspension++;
   }
   const contact=Object.fromEntries(Object.entries(stance).map(([k,a])=>[k,{samples:a.length,minM:Math.min(...a),maxM:Math.max(...a),above10mm:a.filter(x=>x>.01).length,belowMinus10mm:a.filter(x=>x<-.01).length}]));
   const seamPositionM=Math.max(...['FL','FR','HL','HR'].map(k=>Math.hypot(...first.feet[k].centroid.map((v,i)=>v-last.feet[k].centroid[i]))));
   const keyframes=gait==='trot'?[0,.125,.375,.625,.875]:lead==='Left'?[0,.25,.5,.75]:[.125,.375,.625,.875];
   for(const view of ['side','quarter']){await page.evaluate(v=>sourceSetView(v),view);for(const f of keyframes){await page.evaluate(x=>sourceSetPhase(x),f);await page.screenshot({path:path.join(OUT,`white-${gait}-${lead.toLowerCase()}-${view}-${Math.round(f*1000)}.png`)});}}
   const report={lead,clip:first.clip,phases:rows.length,bones:structure.boneNames.length,durationS:first.duration,impliedSpeedMps:gait==='trot'?.44/(.44*.72):.5/(.4*.64),suspensionSamples:suspension,finite:nonfinite.length===0,bodyMinimumAboveFloorM:bodyMin,bodyMaximumAboveFloorM:bodyMax,contact,seamPositionM,allStanceWithin10mm:Object.values(contact).every(v=>v.above10mm===0&&v.belowMinus10mm===0),errors:[...errors]};
   fs.writeFileSync(path.join(OUT,`browser-${gait}-${lead.toLowerCase()}.json`),JSON.stringify({structure,rows,first,last,report},null,2)+'\n');reports.push(report);
  }
  const summary={candidateSha256,sourceSha256:expectedSource,errors,reports};fs.writeFileSync(path.join(OUT,`browser-summary-${gait}.json`),JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify(summary));
  if(errors.length||reports.some(r=>!r.finite||!r.allStanceWithin10mm||!r.suspensionSamples))process.exitCode=1;
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});

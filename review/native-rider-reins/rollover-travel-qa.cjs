const fs=require('node:fs'),path=require('node:path');
const QA=require('../../tools/qa-platform.cjs'),{chromium}=QA;
const HERE=__dirname,OUT=path.resolve(HERE,'../../output/native-rider-reins-review-qa'),URL=QA.BASE+'/review/native-rider-reins/review.html';fs.mkdirSync(OUT,{recursive:true});
const anchors=JSON.parse(fs.readFileSync(path.join(HERE,'anchors.json')));
const reinQA=JSON.parse(fs.readFileSync(path.join(OUT,'qa-summary.json')));

(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.QA_CHROMIUM,args:QA.gpuArgs(['--no-sandbox'])});try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(URL);await page.waitForFunction(()=>window.nativeReinsInspect?.()?.sides?.left?.hand,{timeout:60000});
 const data=await page.evaluate(anchors=>{const names=['HL','FL','HR','FR'],duty=anchors.walk.stanceFraction,cycleTravel=anchors.walk.nominalSpeedMps*anchors.walk.durationS,N=512;
  const feet=Object.fromEntries(names.map(k=>[k,[]])),supports=[],bodyMin=[],v=new nativeReinsThree.Vector3();
  function stats(pts,shiftZ=0){let lo=Infinity,hi=-Infinity,x=0,y=0,z=0;for(const p of pts){x+=p[0];y+=p[1];z+=p[2]+shiftZ;lo=Math.min(lo,p[1]);hi=Math.max(hi,p[1]);}return {minY:lo,maxY:hi,centroid:[x/pts.length,y/pts.length,z/pts.length],count:pts.length};}
  for(let i=0;i<N;i++){
   const phase=i/N,travel=nativeTravelSetCycle(phase,true);let support=0;
   for(const foot of names){const mask=anchors.soleMasks[foot],q=(phase-mask.stancePhaseOffset+1)%1;
    if(q>=duty)continue;support++;
    const u=q/duty,regime=u<.15?'heel':u>.7?'toe':'flat',shift=phase<mask.stancePhaseOffset?cycleTravel:0;
    const whole=stats(nativeTravelFootVertices(foot,'whole'),shift),active=stats(nativeTravelFootVertices(foot,regime==='flat'?'sole':regime),shift),heel=stats(nativeTravelFootVertices(foot,'heel')),toe=stats(nativeTravelFootVertices(foot,'toe'));
    feet[foot].push({phase,q,u,regime,actorZ:travel.actorZ+shift,wholeMinY:whole.minY,activeMinY:active.minY,activeCentroid:active.centroid,heelMinY:heel.minY,toeMinY:toe.minY});
   }
   supports.push(support);
   if(i%64===0){const body=nativeReinsBody();body.skeleton.update();let minY=Infinity;for(let j=0;j<body.geometry.attributes.position.count;j++){body.getVertexPosition(j,v);v.applyMatrix4(body.matrixWorld);minY=Math.min(minY,v.y);}bodyMin.push({phase,minY});}
  }
  return {feet,supports,bodyMin};
 },anchors);
 const span=(rows,fn)=>{const a=rows.map(fn);return Math.max(...a)-Math.min(...a)};
 const range=(rows,fn)=>{const a=rows.map(fn);return [Math.min(...a),Math.max(...a)]};
 const feet={};for(const [foot,rows0] of Object.entries(data.feet)){
  const rows=rows0.sort((a,b)=>a.q-b.q),regimes={};
  for(const regime of ['heel','flat','toe']){const samples=rows.filter(r=>r.regime===regime);regimes[regime]={samples:samples.length,xRangeM:span(samples,r=>r.activeCentroid[0]),yRangeM:span(samples,r=>r.activeCentroid[1]),zRangeM:span(samples,r=>r.activeCentroid[2]),startEndXZDriftM:Math.hypot(samples.at(-1).activeCentroid[0]-samples[0].activeCentroid[0],samples.at(-1).activeCentroid[2]-samples[0].activeCentroid[2]),activeMinYRangeM:range(samples,r=>r.activeMinY),wholeHoofMinYRangeM:range(samples,r=>r.wholeMinY),heelMinusToeMinYRangeM:range(samples,r=>r.heelMinY-r.toeMinY)};}
  feet[foot]={stanceSamples:rows.length,wholeHoofMinYRangeM:range(rows,r=>r.wholeMinY),regimes};
 }
 const summary={url:URL,initialCheckedKitSha256:anchors.initialCheckedKitSha256,clip:anchors.walk.clip,speedMps:anchors.walk.nominalSpeedMps,cycleTravelM:anchors.walk.nominalSpeedMps*anchors.walk.durationS,sampledPhases:512,bodyMinY8PhasesM:range(data.bodyMin,r=>r.minY),minSupportFeet:Math.min(...data.supports),supportCountHistogram:Object.fromEntries([...new Set(data.supports)].sort().map(n=>[n,data.supports.filter(x=>x===n).length])),feet,riderAndRein8Phase:{maxBootTreadGapM:reinQA.maxBootTreadGapM,maxBitFistReinAttachmentGapM:reinQA.maxAttachmentGapM,minReinClearanceFromSkinnedBodyM:reinQA.minOutsideBodyM,sourceTackComponentsIntact:reinQA.allOtherComponentsIntact},errors};
 summary.technicalPass=summary.minSupportFeet>=2&&summary.bodyMinY8PhasesM[0]>-.01&&Object.values(feet).every(f=>f.wholeHoofMinYRangeM[0]>-.01&&f.wholeHoofMinYRangeM[1]<.012&&Object.values(f.regimes).every(r=>r.samples>20&&r.xRangeM<.005&&r.zRangeM<.005&&r.activeMinYRangeM[0]>-.01&&r.activeMinYRangeM[1]<.012))&&reinQA.technicalPass&&errors.length===0;
 fs.writeFileSync(path.join(OUT,'rollover-travel-report.json'),JSON.stringify({summary,bodyMin:data.bodyMin,footRows:data.feet},null,2)+'\n');
 fs.writeFileSync(path.join(OUT,'rollover-travel-summary.json'),JSON.stringify(summary,null,2)+'\n');
 console.log(JSON.stringify(summary,null,2));if(!summary.technicalPass)process.exitCode=1;
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

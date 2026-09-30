const fs=require('node:fs'),path=require('node:path');
const QA=require('../../tools/qa-platform.cjs'),{chromium}=QA;
const OUT=path.resolve(__dirname,'../../output/native-horse-travel'),URL=QA.BASE+'/review/native-horse-travel/travel.html';
fs.mkdirSync(OUT,{recursive:true});
const anchor=JSON.parse(fs.readFileSync(path.join(__dirname,'anchors.json')));

(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.QA_CHROMIUM,args:QA.gpuArgs(['--no-sandbox'])});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(URL);
  await page.waitForFunction(()=>window.nativeTravelInspect?.().riderReady,null,{timeout:60000});
  const loaded=await page.evaluate(()=>nativeTravelInspect());
  const stance=await page.evaluate(anchors=>{
   const rows={};const N=256,frac=anchors.walk.stanceFraction;
   for(const [foot,mask] of Object.entries(anchors.soleMasks)){
    const frames=[];
    for(let j=0;j<=N;j++){
     const q=frac*j/N,unwrapped=mask.stancePhaseOffset+q;
     const pose=window.nativeTravelSetCycle(unwrapped,false);
     const vertices=window.nativeTravelSoleVertices(foot);
     let cx=0,cy=0,cz=0,lo=Infinity,hi=-Infinity;
     for(const v of vertices){cx+=v[0];cy+=v[1];cz+=v[2];lo=Math.min(lo,v[1]);hi=Math.max(hi,v[1]);}
     frames.push({q,cycle:unwrapped,actorZ:pose.actorZ,centroid:[cx/vertices.length,cy/vertices.length,cz/vertices.length],minY:lo,maxY:hi,vertices});
    }
    const first=frames[0],dx=frames.map(f=>f.centroid[0]-first.centroid[0]),dz=frames.map(f=>f.centroid[2]-first.centroid[2]);
    let maximumVertexXZDrift=0,maximumVertexXDrift=0,maximumVertexZDrift=0;
    for(const f of frames)for(let i=0;i<f.vertices.length;i++){
     const x=f.vertices[i][0]-first.vertices[i][0],z=f.vertices[i][2]-first.vertices[i][2];
     maximumVertexXZDrift=Math.max(maximumVertexXZDrift,Math.hypot(x,z));
     maximumVertexXDrift=Math.max(maximumVertexXDrift,Math.abs(x));
     maximumVertexZDrift=Math.max(maximumVertexZDrift,Math.abs(z));
    }
    rows[foot]={samples:frames.length,soleVertices:first.vertices.length,centroidXRangeM:Math.max(...dx)-Math.min(...dx),centroidZRangeM:Math.max(...dz)-Math.min(...dz),centroidEndXZDriftM:Math.hypot(dx.at(-1),dz.at(-1)),maximumVertexXZDriftM:maximumVertexXZDrift,maximumVertexXDriftM:maximumVertexXDrift,maximumVertexZDriftM:maximumVertexZDrift,stanceMinY:Math.min(...frames.map(f=>f.minY)),stanceMaxY:Math.max(...frames.map(f=>f.maxY)),actorStanceTravelM:frames.at(-1).actorZ-first.actorZ,centroidStart:first.centroid,centroidEnd:frames.at(-1).centroid,finite:frames.every(f=>f.vertices.length>0&&f.vertices.every(v=>v.every(Number.isFinite)))};
   }
   return rows;
  },anchor);
  const rider=[];
  for(const view of ['side','quarter']){
   await page.click('#'+view);
   for(let i=0;i<8;i++){
    const pose=await page.evaluate(p=>{const s=nativeTravelSetCycle(p,true);nativeTravelRender();return s;},i/8);
    rider.push({view,phase:i/8,seat:pose.seat,tack:pose.tack,rider:pose.rider,trunk1998:pose.trunk1998,feet:pose.feet});
    await page.screenshot({path:path.join(OUT,`travel-${view}-${i}.png`)});
   }
  }
  await page.click('#grip');
  const gripStudy=[];
  for(let i=0;i<8;i++){
   const row=await page.evaluate(p=>{const pose=nativeTravelSetCycle(p,true);return {phase:p,rider:pose.rider,tack:pose.tack};},i/8);
   gripStudy.push(row);
  }
  await page.evaluate(()=>{nativeTravelSetCycle(.375,true);nativeTravelRender();});
  await page.click('#side');await page.screenshot({path:path.join(OUT,'grip-study-side-375.png')});
  await page.click('#quarter');await page.screenshot({path:path.join(OUT,'grip-study-quarter-375.png')});
  await page.evaluate(()=>nativeTravelSetCycle(0,true));await page.click('#start');await page.waitForTimeout(650);const afterStart=await page.evaluate(()=>nativeTravelInspect().cycle);await page.click('#start');const atPause=await page.evaluate(()=>nativeTravelInspect().cycle);await page.waitForTimeout(250);const afterPause=await page.evaluate(()=>nativeTravelInspect().cycle);
  const hands=rider.map(r=>r.rider).filter(Boolean),gripHands=gripStudy.map(r=>r.rider);
  const summary={url:URL,modelSha256:anchor.sha256,horseBones:loaded.horseBones,riderBones:loaded.riderBones,clip:'Target Native Walk',speedMps:anchor.walk.nominalSpeedMps,stanceDurationS:anchor.walk.durationS*anchor.walk.stanceFraction,stance,visualSamples:rider.length,riderMaxSoleToTreadM:Math.max(...rider.flatMap(r=>r.rider?[r.rider.leftSoleToTreadM,r.rider.rightSoleToTreadM]:[Infinity])),riderFinite:rider.every(r=>r.rider&&[r.rider.leftSoleToTreadM,r.rider.rightSoleToTreadM,...r.seat].every(Number.isFinite)),reinGripStudy:{nativeReinVertices:[anchor.reinGripStudy.left.vertexCount,anchor.reinGripStudy.right.vertexCount],baselineHandDistanceM:[Math.min(...hands.flatMap(r=>[r.leftHandToReinM,r.rightHandToReinM])),Math.max(...hands.flatMap(r=>[r.leftHandToReinM,r.rightHandToReinM]))],reachHandDistanceM:[Math.min(...gripHands.flatMap(r=>[r.leftHandToReinM,r.rightHandToReinM])),Math.max(...gripHands.flatMap(r=>[r.leftHandToReinM,r.rightHandToReinM]))],reachElbowDegrees:[Math.min(...gripHands.flatMap(r=>[r.leftElbowDegrees,r.rightElbowDegrees])),Math.max(...gripHands.flatMap(r=>[r.leftElbowDegrees,r.rightElbowDegrees]))],approved:false,reason:'The unchanged low source reins require near-straight elbows; optional study stays off by default.'},startPause:{afterStart,atPause,afterPause,advanced:afterStart>.1,paused:Math.abs(afterPause-atPause)<.002},errors};
  summary.travelContactPass=Object.values(stance).every(s=>s.finite&&s.stanceMinY>-.01&&s.stanceMaxY<.01&&Math.abs(s.actorStanceTravelM-.4)<.0001);
  summary.technicalPass=summary.travelContactPass&&summary.riderFinite&&summary.horseBones===677&&summary.riderBones===65&&summary.startPause.advanced&&summary.startPause.paused&&errors.length===0;
  fs.writeFileSync(path.join(OUT,'qa-report.json'),JSON.stringify({summary,rider,gripStudy},null,2)+'\n');
  fs.writeFileSync(path.join(OUT,'qa-summary.json'),JSON.stringify(summary,null,2)+'\n');
  console.log(JSON.stringify({technicalPass:summary.technicalPass,travelContactPass:summary.travelContactPass,speedMps:summary.speedMps,stance,visualSamples:summary.visualSamples,riderMaxSoleToTreadM:summary.riderMaxSoleToTreadM,startPause:summary.startPause,errors}));
  if(!summary.technicalPass)process.exitCode=1;
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

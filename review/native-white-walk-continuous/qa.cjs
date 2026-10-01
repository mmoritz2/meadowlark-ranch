const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const QA=require('../../tools/qa-platform.cjs'),{chromium}=QA;
const ROOT=path.resolve(__dirname,'../..'),OUT=path.join(ROOT,'output/native-white-walk-continuous');
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const EXPECTED=JSON.parse(fs.readFileSync(path.join(__dirname,'build-report.json'))).candidateSha256;
const stats=a=>({min:Math.min(...a),max:Math.max(...a),span:Math.max(...a)-Math.min(...a)});
(async()=>{
 const candidateSha256=sha(path.join(__dirname,'model.glb'));
 if(candidateSha256!==EXPECTED)throw Error('Frozen candidate changed');
 const report=JSON.parse(fs.readFileSync(path.join(__dirname,'build-report.json')));
 const browser=await chromium.launch({headless:true,args:QA.gpuArgs(['--no-sandbox'])});
 try{
  const page=await browser.newPage({viewport:{width:1600,height:950},deviceScaleFactor:1}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  await page.goto(QA.BASE+'/review/native-white-walk-continuous/review.html');
  await page.waitForFunction(()=>window.retargetInspect?.().ready,null,{timeout:60000});
  await page.evaluate(()=>retargetSetClip('Target Native Walk Rollover'));
  const rows=[];
  for(let i=0;i<256;i++)rows.push(await page.evaluate(p=>{const r=retargetSetPhase(p);return {phase:r.phase,...r.right};},i/256));
  const seams=await page.evaluate(()=>retargetClipSeams()),first=rows[0],last=await page.evaluate(()=>retargetSetTime(1.12-1e-8).right);
  const feet={FL:'frontL',FR:'frontR',HL:'hindL',HR:'hindR'},contacts={},regions={},supportCounts={one:0,two:0,three:0,four:0,suspension:0};
  for(const r of rows){const planted=Object.keys(feet).filter(k=>((r.phase-report.footMasks[k].offset+1)%1)<report.stanceFraction).sort().join('+');const count=planted?planted.split('+').length:0;supportCounts[['suspension','one','two','three','four'][count]]++;}
  for(const [foot,key]of Object.entries(feet)){
   const q=r=>(r.phase-report.footMasks[foot].offset+1)%1,stance=rows.filter(r=>q(r)<report.stanceFraction),swing=rows.filter(r=>q(r)>=report.stanceFraction);
   contacts[foot]={wholeHoofStanceMinY:stats(stance.map(r=>r.soles[key].min[1])),wholeHoofSwingMinY:stats(swing.map(r=>r.soles[key].min[1])),stanceSamples:stance.length};
   regions[foot]={};
   for(const anchor of ['heel','sole','toe']){
    const a=stance.filter(r=>{const u=q(r)/report.stanceFraction;return anchor==='heel'?u<.15:anchor==='toe'?u>.7:u>=.15&&u<=.7});
    const points=a.map(r=>({q:q(r),point:anchor==='sole'?r.contacts[key].mean:r.edges[key][anchor].mean}));
    regions[foot][anchor]={samples:points.length,X:stats(points.map(p=>p.point[0])),ZWithNominalTravel:stats(points.map(p=>p.point[2]+p.q*report.impliedSpeedMps*report.duration))};
   }
  }
  const suspension=rows.filter(r=>Object.keys(feet).every(k=>((r.phase-report.footMasks[k].offset+1)%1)>=report.stanceFraction));
  const flight={samples:suspension.length,minimumWholeHoofY:suspension.length?Math.min(...suspension.flatMap(r=>Object.values(r.soles).map(s=>s.min[1]))):null,centralWindows:[]};
  const flightCentres=[];for(const p of flight.centralWindows)flightCentres.push(await page.evaluate(p=>{const r=retargetSetPhase(p).right;return {phase:p,soles:r.soles};},p));flight.centralSamples=flightCentres;
  for(const view of ['side','quarter'])for(const [pose,p]of [['stance',.22],['swing',.7]]){await page.evaluate(v=>retargetSetView(v),view);await page.evaluate(p=>retargetSetPhase(p),p);await page.screenshot({path:path.join(__dirname,view+'-'+pose+'.png')});}
  const loopNearDifference={};for(const k of Object.keys(first.joints))loopNearDifference[k]={position:Math.max(...first.joints[k].position.map((v,i)=>Math.abs(v-last.joints[k].position[i]))),rotationComponents:Math.max(...first.joints[k].rotation.map((v,i)=>Math.abs(v-last.joints[k].rotation[i])))};
  const finite=rows.every(r=>r.finite&&r.allBoneTransformsFinite&&r.bones===677&&[...r.bounds.min,...r.bounds.max,...r.upperBack.position,...Object.values(r.joints).flatMap(j=>[...j.position,...j.rotation])].every(Number.isFinite));
  const maxEndpointDifference=Math.max(...Object.values(seams).flatMap(tracks=>tracks.map(t=>t.maxComponentDifference))),stancePass=Object.values(contacts).every(c=>c.wholeHoofStanceMinY.min>=-.005&&c.wholeHoofStanceMinY.max<=.005);
  const summary={candidateSha256,sourceSha256:report.sourceSha256,clip:first.clip,phases:rows.length,finite,errors,nominalSpeedMps:report.impliedSpeedMps,duration:report.duration,stanceFraction:report.stanceFraction,supportCounts,contacts,regionalTravel:regions,flight,wholeBodyMinY:stats(rows.map(r=>r.bounds.min[1])),upperTrunk1998Y:stats(rows.map(r=>r.upperBack.position[1])),headY:stats(rows.map(r=>r.joints.head_019.position[1])),loop:{maxEndpointDifference,nearEndpointMaxPositionM:Math.max(...Object.values(loopNearDifference).map(x=>x.position)),nearEndpointMaxQuaternionComponent:Math.max(...Object.values(loopNearDifference).map(x=>x.rotationComponents))},stancePass,wholeBodyFloorPass:rows.every(r=>r.bounds.min[1]>=-.005),regionalPlantPass:Object.values(regions).every(foot=>Object.values(foot).every(r=>r.X.span<.005&&r.ZWithNominalTravel.span<.005)),noFlightInWalk:suspension.length===0};
  summary.rollingEdges={};
  for(const [foot,key]of Object.entries(feet)){
   const a=rows.filter(r=>((r.phase-report.footMasks[foot].offset+1)%1)<report.stanceFraction);
   const u=r=>((r.phase-report.footMasks[foot].offset+1)%1)/report.stanceFraction;
   summary.rollingEdges[foot]={earlyHeelMinYRange:stats(a.filter(r=>u(r)<.15).map(r=>r.edges[key].heel.min[1])),lateToeMinYRange:stats(a.filter(r=>u(r)>.7).map(r=>r.edges[key].toe.min[1]))};
  }
  fs.writeFileSync(path.join(OUT,'browser-report.json'),JSON.stringify({summary,rows,seams,first,last,loopNearDifference},null,2)+'\n');
  fs.writeFileSync(path.join(__dirname,'qa-summary.json'),JSON.stringify(summary,null,2)+'\n');
  console.log(JSON.stringify(summary,null,2));if(!finite||errors.length||!stancePass||!summary.wholeBodyFloorPass||!summary.regionalPlantPass||!summary.noFlightInWalk||maxEndpointDifference>1e-6)process.exitCode=1;
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});

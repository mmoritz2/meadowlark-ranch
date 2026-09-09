/* Independent browser motion audit. Requires heroMotionQA, not renderer internals.
 * Usage: node tools/qa-hero-motion.cjs output/hero-motion-audit [--no-video]
 * Numeric tolerances are game QA targets, not veterinary diagnostic standards.
 */
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path');
const args=process.argv.slice(2),out=path.resolve(args.find(a=>!a.startsWith('--'))||'output/hero-motion-audit');
const url=args.find(a=>a.startsWith('--url='))?.slice(6)||'http://127.0.0.1:8431/hero-horse.html';
const videoEnabled=!args.includes('--no-video'),FPS=60,DT=1/FPS;
const ids=['LF','RF','LH','RH'];
const limbPairs=[[13,14],[14,15],[15,16],[16,17],[17,18],[7,8],[8,9],[9,10],[10,11],[11,12],
 [28,29],[29,30],[30,31],[31,32],[23,24],[24,25],[25,26],[26,27]];
const cases=[{gait:'stand',lead:'left'},{gait:'walk',lead:'left'},{gait:'trot',lead:'left'},
  {gait:'canter',lead:'left'},{gait:'canter',lead:'right'},{gait:'gallop',lead:'left'},{gait:'gallop',lead:'right'}];
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const horizontal=(a,b)=>Math.hypot(a[0]-b[0],a[2]-b[2]);
const finite3=a=>Array.isArray(a)&&a.length===3&&a.every(Number.isFinite);
const quaternionAngle=(a,b)=>2*Math.acos(Math.min(1,Math.abs(a.reduce((s,v,i)=>s+v*b[i],0))))*180/Math.PI;
const round=n=>Number.isFinite(n)?+n.toFixed(6):n;
const keyFor=c=>c.gait+(['canter','gallop'].includes(c.gait)?'-'+c.lead:'');
const expectedFor=c=>c.gait==='walk'?['RH','RF','LH','LF']:c.gait==='trot'?['LF+RH','LH+RF']:
 c.gait==='canter'?(c.lead==='left'?['RH','LH+RF','LF']:['LH','LF+RH','RF']):
 c.gait==='gallop'?(c.lead==='left'?['RH','LH','RF','LF']:['LH','RH','LF','RF']):[];

function schemaErrors(s){
 const errors=[];
 for(const field of ['phase01','cycleHz','speedMps','distanceM'])if(!Number.isFinite(s[field]))errors.push(field+' missing/nonfinite');
 if(!Array.isArray(s.feet)||s.feet.length!==4)errors.push('four actual feet required');
 for(const id of ids){const foot=s.feet?.find(f=>f.id===id);if(!foot)errors.push(id+' absent');else{
  if(typeof foot.contact!=='boolean')errors.push(id+' contact missing');
  if(!finite3(foot.sole)||!finite3(foot.worldSole)||!Number.isFinite(foot.soleMinY))errors.push(id+' actual sole data absent');
 }}
 if(!Array.isArray(s.bonePositions)||!s.bonePositions.length||!s.bonePositions.every(finite3))errors.push('bone positions invalid');
 if(!Array.isArray(s.boneQuaternions)||s.boneQuaternions.length!==s.bonePositions?.length||
 !s.boneQuaternions.every(q=>Array.isArray(q)&&q.length===4&&q.every(Number.isFinite)))errors.push('bone quaternions invalid');
 return errors;
}

function poseDelta(a,b){
 return {positionM:Math.max(...a.bonePositions.map((p,i)=>distance(p,b.bonePositions[i]))),
 rotationDeg:Math.max(...a.boneQuaternions.map((q,i)=>quaternionAngle(q,b.boneQuaternions[i])))};
}

function analyze(c,samples,baseline){
 const errors=samples.flatMap((s,i)=>schemaErrors(s).map(e=>'frame '+i+': '+e));
 if(errors.length)return {pass:false,checks:{schema:false},errors:errors.slice(0,20)};
 let penetration=0,unitError=0,frameJump=0,rotationJump=0,aerialFrames=0,airClearance=0,cycles=0,maxReach=0,maxLengthChange=0,maxLengthChangeRatio=0;
 const reachMeasured=samples.every(s=>s.feet.every(f=>Number.isFinite(f.reachError)));
 const lengthsMeasured=baseline?.bonePositions?.length===33;
 const feet=Object.fromEntries(ids.map(id=>[id,{contactFrames:0,stanceDriftM:0,contactHeightM:0,flightClearanceM:0,stances:0}]));
 const stances=Object.fromEntries(ids.map(id=>[id,null])),events=[];
 function closeStance(id){const pts=stances[id];if(!pts)return;const f=feet[id];
  if(pts.length>=4){f.stances++;for(const a of pts)for(const b of pts)f.stanceDriftM=Math.max(f.stanceDriftM,horizontal(a,b));}stances[id]=null;
 }
 for(let i=0;i<samples.length;i++){
  const s=samples[i],prev=samples[i-1];
  if(prev){const delta=poseDelta(prev,s);frameJump=Math.max(frameJump,delta.positionM);rotationJump=Math.max(rotationJump,delta.rotationDeg);
   let phase=s.phase01-prev.phase01;if(phase<-.5)phase+=1;if(phase>=0)cycles+=phase;
  }
  unitError=Math.max(unitError,...s.boneQuaternions.map(q=>Math.abs(Math.hypot(...q)-1)));
  if(lengthsMeasured)for(const [a,b] of limbPairs){const rest=distance(baseline.bonePositions[a],baseline.bonePositions[b]);
   const change=Math.abs(distance(s.bonePositions[a],s.bonePositions[b])-rest);maxLengthChange=Math.max(maxLengthChange,change);maxLengthChangeRatio=Math.max(maxLengthChangeRatio,change/Math.max(.001,rest));}
  if(s.feet.every(f=>!f.contact)){aerialFrames++;airClearance=Math.max(airClearance,Math.min(...s.feet.map(f=>f.soleMinY)));}
  for(const f of s.feet){const m=feet[f.id];penetration=Math.max(penetration,-f.soleMinY);if(reachMeasured)maxReach=Math.max(maxReach,f.reachError);
   if(f.contact){m.contactFrames++;m.contactHeightM=Math.max(m.contactHeightM,Math.abs(f.sole[1]));
    if(!stances[f.id])stances[f.id]=[];stances[f.id].push(f.worldSole);
   }else{closeStance(f.id);m.flightClearanceM=Math.max(m.flightClearanceM,f.soleMinY);}
   if(prev&&f.contact&&!prev.feet.find(p=>p.id===f.id).contact)events.push({id:f.id,time:s.t,phase:s.phase01});
  }
 }
 ids.forEach(closeStance);
 const groups=[];const tolerance=Math.min(.034,1/Math.max(.1,samples[0].cycleHz)*.08);
 for(const e of events){const group=groups.at(-1);if(group&&e.time-group.time<=tolerance)group.ids.push(e.id);else groups.push({time:e.time,ids:[e.id]});}
 for(const g of groups)g.key=g.ids.sort().join('+');
 const expected=expectedFor(c),observed=groups.map(g=>g.key);
 const ordered=!expected.length||expected.some((_,offset)=>observed.every((v,i)=>v===expected[(i+offset)%expected.length]));
 for(const f of Object.values(feet)){f.duty=round(f.contactFrames/samples.length);for(const k of ['stanceDriftM','contactHeightM','flightClearanceM'])f[k]=round(f[k]);}
 const maxDrift=Math.max(...Object.values(feet).map(f=>f.stanceDriftM));
 const checks={schema:true,finite:true,unitQuaternions:unitError<.001,completeCycles:c.gait==='stand'||cycles>=3.99,
  footfallOrder:ordered&&(!expected.length||groups.length>=expected.length*3),
  stanceSliding:maxDrift<=.02,groundPenetration:penetration<=.01,
  contactHeight:Math.max(...Object.values(feet).map(f=>f.contactHeightM))<=.025,
  suspension:c.gait==='walk'||c.gait==='stand'?aerialFrames===0:aerialFrames>0&&airClearance>.005,
  stablePoseSteps:frameJump<.30&&rotationJump<60,
  reachableTargets:reachMeasured&&maxReach<=.02,
  stableLimbLengths:!lengthsMeasured||(maxLengthChange<=.01&&maxLengthChangeRatio<=.05)};
 return {pass:Object.values(checks).every(Boolean),checks,gait:c.gait,lead:c.lead,sampleCount:samples.length,
  cycles:round(cycles),cycleHz:samples[0].cycleHz,speedMps:samples[0].speedMps,
  maxPenetrationM:round(penetration),maxStanceDriftM:round(maxDrift),maxQuaternionNormError:round(unitError),
  maxReachErrorM:reachMeasured?round(maxReach):null,maxLimbLengthChangeM:lengthsMeasured?round(maxLengthChange):null,
  maxLimbLengthChangeRatio:lengthsMeasured?round(maxLengthChangeRatio):null,
  maxFrameBoneDisplacementM:round(frameJump),maxFrameBoneRotationDeg:round(rotationJump),aerialFrames,
  maximumAllHoofFlightClearanceM:round(airClearance),feet,expectedContactOrder:expected,observedContactOrder:observed,events};
}

async function ready(page){
 await page.goto(url);await page.waitForFunction(()=>window.heroMotionQA&&window.render_game_to_text&&
 JSON.parse(render_game_to_text()).modelReady&&!JSON.parse(render_game_to_text()).loading,null,{timeout:120000});
 await page.evaluate(()=>heroMotionQA.pauseRealtime(true));
}
const snapshot=page=>page.evaluate(()=>heroMotionQA.snapshot());
async function set(page,c){return page.evaluate(c=>{heroMotionQA.set(c.gait,{lead:c.lead,...(c.speed?{speed:c.speed}:{})});return heroMotionQA.snapshot();},c);}
async function step(page,ms){return page.evaluate(ms=>{advanceTime(ms);return heroMotionQA.snapshot();},ms);}
async function settle(page,c){await set(page,c);let s;for(let i=0;i<600;i++){s=await step(page,DT*1000);if(i>120&&!s.transitioning)return s;}throw Error('Transition failed to settle: '+keyFor(c));}

(async()=>{
 fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({headless:true,args:['--use-angle=d3d11']});
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 const report={url,createdAt:new Date().toISOString(),fps:FPS,cyclesRequested:4,tolerances:{stanceDriftM:.02,penetrationM:.01},
  interpretation:'Actual sole contacts and virtual travel are measured. Visual clip review is separately required.',gaits:{},transitions:[],determinism:{},errors};
 try{
  await ready(page);const first=await snapshot(page),contractErrors=schemaErrors(first);if(contractErrors.length)throw Error('Required diagnostics unavailable: '+contractErrors.join('; '));
  report.rigBaseline=first;
  for(const c of cases){
   await page.evaluate(()=>heroMotionQA.reset());const stable=await settle(page,c);const frames=[],name=keyFor(c);
   const frameCount=c.gait==='stand'?120:Math.ceil(4.05/stable.cycleHz*FPS);if(frameCount>2400)throw Error('Invalid cadence: '+stable.cycleHz);
   const captureFrames=new Map(Array.from({length:c.gait==='stand'?1:8},(_,i)=>[Math.round(i*FPS/Math.max(.1,stable.cycleHz)/8),i]));
   await page.click('#side');
   for(let i=0;i<=frameCount;i++){const s=i?await step(page,1000/FPS):await snapshot(page);frames.push({t:i/FPS,...s});
    if(captureFrames.has(i))await page.screenshot({path:path.join(out,name+'-phase-'+String(captureFrames.get(i)).padStart(2,'0')+'.png')});
   }
   report.gaits[name]=analyze(c,frames,first);fs.writeFileSync(path.join(out,name+'-samples.json'),JSON.stringify(frames));
   await page.click('#front');await page.screenshot({path:path.join(out,name+'-front.png')});
   await page.mouse.move(1050,500);await page.mouse.down();await page.mouse.move(601,500,{steps:14});await page.mouse.up();await page.screenshot({path:path.join(out,name+'-rear.png')});
   await page.click('#side');await page.mouse.move(1050,500);await page.mouse.down();await page.mouse.move(601,500,{steps:14});await page.mouse.up();await page.screenshot({path:path.join(out,name+'-opposite.png')});
   console.log(name+': '+JSON.stringify(report.gaits[name].checks));
  }
  // A zero-time gait command must not reset the pose. Then record the entire blend.
  const transitions=[{gait:'stand',lead:'left'},...cases.slice(1).filter(c=>c.lead==='left'),
   {gait:'canter',lead:'left'},{gait:'trot',lead:'left'},{gait:'walk',lead:'left'},{gait:'stand',lead:'left'},
   {gait:'gallop',lead:'right'},{gait:'walk',lead:'left'},{gait:'trot',lead:'left'},{gait:'stand',lead:'left'}];
  await page.evaluate(()=>heroMotionQA.reset());await settle(page,transitions[0]);
  for(let i=1;i<transitions.length;i++){
   const before=await snapshot(page),after=await set(page,transitions[i]),jump=poseDelta(before,after),frames=[];
   for(let j=0;j<120;j++)frames.push({t:j/FPS,...await step(page,1000/FPS)});
   const maxStep=Math.max(...frames.slice(1).map((s,j)=>poseDelta(frames[j],s).positionM));
   const entry={from:transitions[i-1],to:transitions[i],commandPoseJumpM:round(jump.positionM),commandRotationJumpDeg:round(jump.rotationDeg),
    maxFrameDisplacementM:round(maxStep),settled:!frames.at(-1).transitioning,
    pass:jump.positionM<=.002&&jump.rotationDeg<=.5&&maxStep<.30&&!frames.at(-1).transitioning};report.transitions.push(entry);
   fs.writeFileSync(path.join(out,'transition-'+i+'-samples.json'),JSON.stringify(frames));
  }
  // Equivalent elapsed time at three caller frame rates; integrator owns its substeps.
  const endStates={};for(const rate of [30,60,120]){await page.evaluate(()=>heroMotionQA.reset());await set(page,{gait:'trot',lead:'left'});
   for(let i=0;i<rate*3;i++)await step(page,1000/rate);endStates[rate]=await snapshot(page);}
  for(const rate of [30,120]){const d=poseDelta(endStates[60],endStates[rate]);report.determinism[rate+'vs60']={maxBoneDifferenceM:round(d.positionM),maxRotationDifferenceDeg:round(d.rotationDeg),pass:d.positionM<.005&&d.rotationDeg<.5};}
  report.automatedPass=Object.values(report.gaits).every(g=>g.pass)&&report.transitions.every(t=>t.pass)&&Object.values(report.determinism).every(d=>d.pass)&&errors.length===0;
  await context.close();
  if(videoEnabled){
   const vc=await browser.newContext({viewport:{width:1280,height:900},recordVideo:{dir:out,size:{width:1280,height:900}}}),vp=await vc.newPage();
   vp.on('pageerror',e=>errors.push(e.message));await ready(vp);await vp.click('#side');await vp.evaluate(()=>heroMotionQA.pauseRealtime(false));
   for(const c of cases.slice(1)){await set(vp,c);await vp.waitForTimeout(c.gait==='walk'?6000:4000);}
   await vp.click('#front');await set(vp,{gait:'trot',lead:'left'});await vp.waitForTimeout(3000);
   await vp.click('#side');await vp.mouse.move(1050,450);await vp.mouse.down();await vp.mouse.move(601,450,{steps:14});await vp.mouse.up();await vp.waitForTimeout(3000);
   const video=vp.video();await vc.close();await video.saveAs(path.join(out,'gaits-and-transitions.webm'));report.video='gaits-and-transitions.webm';
  }
 }catch(e){report.fatal=e.stack;report.automatedPass=false;console.error(e.stack);}
 finally{await browser.close();report.visualReview='pending';fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));}
 console.log(JSON.stringify({automatedPass:report.automatedPass,errors:errors.length,report:path.join(out,'report.json')}));
 if(!report.automatedPass)process.exitCode=1;
})().catch(e=>{console.error(e);process.exit(1);});

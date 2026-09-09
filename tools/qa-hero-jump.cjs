const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path');
const out=path.resolve(process.argv[2]||'output/hero-jump-audit');fs.mkdirSync(out,{recursive:true});
const source=fs.readFileSync(path.join(__dirname,'qa-hero-motion.cjs'),'utf8');
const {schemaErrors,poseDelta}=new Function('require','process',source.slice(0,source.indexOf('(async()=>{'))+'return {schemaErrors,poseDelta};')(require,{argv:[]});
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--use-angle=d3d11']}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:8431/hero-horse.html');
 await page.waitForFunction(()=>window.heroMotionQA&&JSON.parse(render_game_to_text()).modelReady&&!JSON.parse(render_game_to_text()).loading,null,{timeout:120000});
 const before=await page.evaluate(()=>{heroMotionQA.pauseRealtime(true);heroMotionQA.reset();return heroMotionQA.snapshot();});
 await page.click('#side');await page.evaluate(()=>heroMotionQA.set('jump'));
 const frames=[];let penetration=0,reach=0,rise=0,jump=0,rotation=0;
 const capture=new Set([0,12,24,39,48,60,69,78,96,120,150]);
 for(let i=0;i<=180;i++){
  const s=await page.evaluate(i=>{if(i)advanceTime(1000/60);return heroMotionQA.snapshot();},i);frames.push({t:i/60,...s});
  for(const f of s.feet){penetration=Math.max(penetration,-f.soleMinY);reach=Math.max(reach,f.reachError);}
  rise=Math.max(rise,s.bonePositions[0][1]-before.bonePositions[0][1]);
  if(i){const d=poseDelta(frames[i-1],s);jump=Math.max(jump,d.positionM);rotation=Math.max(rotation,d.rotationDeg);}
  if(capture.has(i))await page.screenshot({path:path.join(out,'jump-'+String(i).padStart(3,'0')+'.png')});
 }
 const events=[];for(let i=1;i<frames.length;i++)for(const foot of frames[i].feet){const p=frames[i-1].feet.find(f=>f.id===foot.id);if(p.contact!==foot.contact)events.push({t:frames[i].t,id:foot.id,type:foot.contact?'land':'lift'});}
 const time=(id,type)=>events.find(e=>e.id===id&&e.type===type)?.t;
 const allFlight=frames.filter(s=>s.feet.every(f=>!f.contact));
 const frontLift=Math.max(time('LF','lift')??Infinity,time('RF','lift')??Infinity),hindLift=Math.min(time('LH','lift')??-Infinity,time('RH','lift')??-Infinity);
 const frontLand=Math.min(time('LF','land')??Infinity,time('RF','land')??Infinity),hindLand=Math.min(time('LH','land')??-Infinity,time('RH','land')??-Infinity);
 const boundaries=[];
 for(const t of [.22,.38,1.12,1.16,1.21,1.72]){
  // A fast continuous hinge can move >2mm in .2ms. A true C0 jump remains
  // finite as the interval shrinks, so test convergence rather than velocity.
  const probes=[];
  for(const halfIntervalS of [.0001,.00001,.000001]){
   const delta=await page.evaluate(({t,halfIntervalS})=>{heroMotionQA.reset();heroMotionQA.set('jump');advanceTime((t-halfIntervalS)*1000);const before=heroMotionQA.snapshot();advanceTime(halfIntervalS*2000);return{before,after:heroMotionQA.snapshot()};},{t,halfIntervalS});
   probes.push({intervalS:2*halfIntervalS,...poseDelta(delta.before,delta.after)});
  }
  const [wide,,fine]=probes,converges=fine.positionM<.00005||fine.positionM<=wide.positionM*.05;
  boundaries.push({time:t,positionM:wide.positionM,rotationDeg:wide.rotationDeg,probes,
   pass:converges&&fine.positionM<.0002&&fine.rotationDeg<.1});
 }
 const checks={finite:frames.every(s=>schemaErrors(s).length===0),reachable:reach<=.02,noPenetration:penetration<=.01,
  clearJump:rise>.4,suspension:allFlight.length>0&&Math.max(...allFlight.map(s=>Math.min(...s.feet.map(f=>f.soleMinY))))>.1,
  frontThenHindTakeoff:frontLift<hindLift,frontThenHindLanding:frontLand<hindLand,
  returnedIdle:frames.at(-1).gait==='stand'&&!frames.at(-1).transitioning&&frames.at(-1).feet.every(f=>f.contact),
  continuous:jump<.30&&rotation<60&&boundaries.every(b=>b.pass),noErrors:errors.length===0};
 const report={checks,pass:Object.values(checks).every(Boolean),peakRootRiseM:rise,maxPenetrationM:penetration,maxReachErrorM:reach,
  maxFrameBoneDisplacementM:jump,maxFrameBoneRotationDeg:rotation,boundaries,events,errors,visualReview:'pending'};
 fs.writeFileSync(path.join(out,'samples.json'),JSON.stringify(frames));fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
 await browser.close();console.log(JSON.stringify(report));if(!report.pass)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});

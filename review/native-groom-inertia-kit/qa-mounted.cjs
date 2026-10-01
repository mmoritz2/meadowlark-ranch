// Actual local Ranch, no HTTP routes and no substitute asset/controller.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const QA=require('../../tools/qa-platform.cjs'),O=__dirname,hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const files=['ranch3d.html','assets/game-hero-horse.js','assets/native-horse-motion.js','assets/native-groom-layer.mjs','assets/frame-inertia.mjs','assets/native-groom-controls.mjs','assets/native-breed-profiles.js'];
const pins=Object.fromEntries(files.map(f=>[f,hash(fs.readFileSync(path.resolve(O,'../..',f)))]));
(async()=>{const browser=await QA.chromium.launch({headless:true,args:QA.gpuArgs()}),page=await browser.newPage({viewport:{width:1440,height:960}}),report={base:QA.BASE,unrouted:true,pins,responses:[],errors:[],horses:[],checks:{}},jobs=[];
 const save=()=>fs.writeFileSync(path.join(O,'report-after-transform.json'),JSON.stringify(report,null,2)+'\n');
 page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text())});
 page.on('response',r=>{const p=new URL(r.url()).pathname.replace(/^\//,'');if(files.includes(p))jobs.push(r.body().then(b=>report.responses.push({file:p,url:r.url(),sha256:hash(b)})));});
 try{
 await page.goto(QA.BASE+'/ranch3d.html?qa=native-groom-game-audit',{waitUntil:'load',timeout:120000});
 await page.waitForFunction(()=>window.__features?.installed?.includes('native-horses')&&JSON.parse(render_game_to_text()).graphics.horseReady,null,{timeout:120000});
 await page.evaluate(()=>{advanceTime(1);__features.ui.openShop('native-models')});
 for(const key of ['white-western','bay-western','bay-sporthorse-native'])await page.locator('[data-fx="native-horses:add:'+key+'"]').click();
 await page.evaluate(()=>__features.hidePanels());
 await page.evaluate(()=>{
  window.__groomOldMotions=[];
  window.__groomActualProbe=(geometry=false)=>{
   const G=__features,T=G.THREE,r=G.horse.RIG(),p=G.horse.player,m=r.heroMotion,layer=m.groomInertia,v=new T.Vector3(),meshes=[];r.scene.updateMatrixWorld(true);
   r.nativeRoot.traverse(o=>{if(o.isSkinnedMesh)meshes.push(o)});
   function vertices(mesh){mesh.skeleton.update();const a=new Float64Array(mesh.geometry.attributes.position.count*3);for(let i=0;i<a.length/3;i++){mesh.getVertexPosition(i,v);v.applyMatrix4(mesh.matrixWorld);a.set(v.toArray(),i*3)}return a}
   const snapshot=m.snapshot(),boot={};const rider=p.rider?.rig?.body;
   if(rider){rider.updateMatrixWorld(true);rider.skeleton.update();for(const S of ['L','R']){const sole=p.rider.sk.by['foot'+S].userData.soleContact,mean=new T.Vector3();for(const i of sole.vertices){rider.getVertexPosition(i,v);mean.add(v.applyMatrix4(rider.matrixWorld))}mean.multiplyScalar(1/sole.vertices.length);boot[S]=mean.distanceTo(G.horse.TACK().saddle.userData.stir[S].getWorldPosition(new T.Vector3()))}}
   const bridge=G.horse.nativeRiderInspect(),reins={};for(const [S,s]of Object.entries(bridge?.reins?.sides||{})){const d=(a,b)=>Math.hypot(...a.map((x,i)=>x-b[i]));reins[S]={bit:d(s.mainStart,s.bit),hand:d(s.mainEnd,s.hand)}}
   const result={model:r.modelKey,sha256:r.profile.sha256,clip:m.clip,state:snapshot,speed:p.speed,heading:p.heading,heroRate:r.heroRate,position:p.pos.toArray(),actorLocal:r.scene.position.toArray(),finite:r.bones.length===677&&r.bones.every(b=>b.matrixWorld.elements.every(Number.isFinite))&&p.rider.g.matrixWorld.elements.every(Number.isFinite),boot,reins,nonReinComponentsIntact:bridge?.reins?.nonReinComponentsIntact,meshCounts:meshes.map(o=>o.geometry.attributes.position.count).sort((a,b)=>a-b)};
   if(geometry){
    const withLayer=meshes.map(vertices),beforePhase=m.snapshot().phase01,beforeTime=m.time;
    layer.beforePose();r.nativeRoot.updateMatrixWorld(true);const source=meshes.map(vertices);let protectedDelta=0,hairDelta=0,hairChanged=0;
    for(let j=0;j<meshes.length;j++){let max=0;for(let i=0;i<source[j].length;i++)max=Math.max(max,Math.abs(source[j][i]-withLayer[j][i]));if(meshes[j].geometry.attributes.position.count===23514){hairDelta=max;for(let i=0;i<source[j].length;i+=3)if(Math.hypot(...[0,1,2].map(k=>source[j][i+k]-withLayer[j][i+k]))>1e-9)hairChanged++}else protectedDelta=Math.max(protectedDelta,max)}
    layer.afterPose(0);r.nativeRoot.updateMatrixWorld(true);const reapply=meshes.map(vertices);let reapplyDelta=0;for(let j=0;j<meshes.length;j++)for(let i=0;i<source[j].length;i++)reapplyDelta=Math.max(reapplyDelta,Math.abs(reapply[j][i]-withLayer[j][i]));
    result.geometry={protectedDeltaM:protectedDelta,hairDeltaComponentM:hairDelta,hairChangedVertices:hairChanged,reapplyDeltaM:reapplyDelta,phaseDelta:Math.abs(beforePhase-m.snapshot().phase01),controllerTimeDelta:Math.abs(beforeTime-m.time),sourceControllerUpdatesOwned:layer.snapshot().sourceControllerUpdatesOwned};
   }
   return result;
  };
 });
 for(const key of ['white-western','bay-western','bay-sporthorse-native']){
  const index=await page.evaluate(key=>__features.horse.myHorses.findIndex(h=>h.breed===key),key);await page.selectOption('#horseSel',String(index),{force:true});
  await page.waitForFunction(key=>{const G=__features,r=G.horse.RIG();return r.modelKey===key&&r.ready&&!r.loadingBreed&&r.attachedTo===G.horse.player.mesh&&G.horse.player.rider?.sk},key,{timeout:90000});
  await page.evaluate(()=>{const p=__features.horse.player;p.speed=0;p.y=0;p.vy=0;p.pos.set(-3,0,-3);p.heading=0;advanceTime(100)});
  const item={key,initial:await page.evaluate(()=>__groomActualProbe(true)),gaits:[],events:[],longFrame:null,reset:null};
  for(const gait of ['walk','trot','canterLeft','canterRight']){
   const turn=gait==='canterRight'?'ArrowRight':gait==='canterLeft'?'ArrowLeft':null;if(turn)await page.keyboard.down(turn);
   for(let j=0;j<32;j++)await page.evaluate(gait=>{const G=__features,r=G.horse.RIG(),p=G.horse.player;p.speed=.98*r.profile.nativeGaits[gait].nominalSpeedMps*r.scene.getWorldScale(new G.THREE.Vector3()).z;advanceTime(10)},gait);
   const rows=[];
   for(let j=0;j<16;j++)rows.push(await page.evaluate(({gait,j})=>{const G=__features,r=G.horse.RIG(),p=G.horse.player,record=r.profile.nativeGaits[gait],scale=r.scene.getWorldScale(new G.THREE.Vector3()).z,speed=.98*record.nominalSpeedMps*scale;
    const increment=dt=>{const n=Math.ceil(dt/(1/60)),h=dt/n;let sp=speed,sum=0;for(let k=0;k<n;k++){sp*=1-2.8*h;sum+=sp*h/(record.nominalSpeedMps*scale*record.durationS)}return sum};let lo=.001,hi=.2;for(let k=0;k<42;k++){const mid=(lo+hi)/2;if(increment(mid)<1/16)lo=mid;else hi=mid}
    p.speed=speed;const before=r.heroMotion.snapshot();advanceTime((lo+hi)/2*1000);return {before,...__groomActualProbe(true)};
   },{gait,j}));
   if(turn)await page.keyboard.up(turn);
   let covered=0;for(const row of rows){let d=row.state.phase01-row.before.phase01;if(d<-.5)d++;covered+=d}
   item.gaits.push({gait,coveredCycles:covered,rows});console.log(JSON.stringify({key,gait,cycles:covered,maxAddedDeg:Math.max(...rows.map(r=>r.state.groomInertia.maxAddedWorldAngleDeg)),maxBootM:Math.max(...rows.flatMap(r=>Object.values(r.boot)))}));
  }
  await page.evaluate(()=>{const p=__features.horse.player;p.speed=0;p.pos.set(-3,0,-3);p.heading=0;advanceTime(1200)});item.events.push({name:'stopped',sample:await page.evaluate(()=>__groomActualProbe(true))});
  await page.keyboard.down('ArrowUp');await page.keyboard.down('Shift');await page.evaluate(()=>advanceTime(3000));item.events.push({name:'start-input',sample:await page.evaluate(()=>__groomActualProbe(true))});
  await page.keyboard.down('ArrowLeft');await page.evaluate(()=>advanceTime(400));item.events.push({name:'left-turn-input',sample:await page.evaluate(()=>__groomActualProbe(true))});await page.keyboard.up('ArrowLeft');
  await page.keyboard.down('ArrowRight');await page.evaluate(()=>advanceTime(500));item.events.push({name:'right-turn-input',sample:await page.evaluate(()=>__groomActualProbe(true))});await page.keyboard.up('ArrowRight');await page.keyboard.up('ArrowUp');await page.keyboard.up('Shift');
  await page.evaluate(()=>advanceTime(3500));item.events.push({name:'stop-input',sample:await page.evaluate(()=>__groomActualProbe(true))});
  item.longFrame=await page.evaluate(()=>{const r=__features.horse.RIG(),m=r.heroMotion,before=m.snapshot();m.update(.5,{rate:.8});r.nativeRoot.updateMatrixWorld(true);const after=m.snapshot(),finite=r.bones.every(b=>b.matrixWorld.elements.every(Number.isFinite));return{before,after,finite,controllerTime:m.time}});
  item.reset=await page.evaluate(()=>{const r=__features.horse.RIG(),m=r.heroMotion;m.reset();const snapshot=m.snapshot();advanceTime(1);return{snapshot,refit:__groomActualProbe(true)}});
  const eligibility=await page.evaluate(async()=>{const G=__features,r=G.horse.RIG(),{validateNativeGroomRig}=await import('./assets/native-groom-layer.mjs?v=native-secondary-2');return{actual:validateNativeGroomRig(r).eligible,unverifiedProfileRejected:!validateNativeGroomRig({...r,profile:{...r.profile,id:'unverified'}}).eligible,dragonKindRejected:!validateNativeGroomRig({...r,profile:{...r.profile,nativeKind:'dragon'}}).eligible}});item.eligibility=eligibility;
  await page.evaluate(()=>{const G=__features,p=G.horse.player;G.camera.position.set(p.pos.x-5,G.world.groundH(p.pos.x,p.pos.z)+2.5,p.pos.z+2);G.camera.lookAt(p.mesh.getWorldPosition(new G.THREE.Vector3()).add(new G.THREE.Vector3(0,1.4,0)));G.composer.render()});await page.screenshot({path:path.join(O,key+'-after-transform-mounted.png')});
  await page.evaluate(()=>__groomOldMotions.push(__features.horse.RIG().heroMotion));report.horses.push(item);save();
 }
 // A real selection disposes each old layer; return through the shared cache.
 const whiteIndex=await page.evaluate(()=>__features.horse.myHorses.findIndex(h=>h.breed==='white-western'));await page.selectOption('#horseSel',String(whiteIndex),{force:true});await page.waitForFunction(()=>__features.horse.RIG().modelKey==='white-western'&&!__features.horse.RIG().loadingBreed&&__features.horse.RIG().ready,null,{timeout:90000});await page.evaluate(()=>advanceTime(200));
 report.switchBack=await page.evaluate(()=>({current:__groomActualProbe(true),old:__groomOldMotions.map(m=>({snapshot:m.snapshot(),helperAfterDisposeNoThrow:(()=>{try{m.groomInertia.beforePose();m.groomInertia.afterPose(3);m.groomInertia.dispose();return true}catch(e){return false}})(),updateRejects:(()=>{try{m.update(0);return false}catch(e){return /disposed/.test(e.message)}})()}))}));
 await Promise.all(jobs);
 const rows=report.horses.flatMap(h=>[h.initial,...h.gaits.flatMap(g=>g.rows),...h.events.map(e=>e.sample),h.reset.refit]),geo=rows.filter(r=>r.geometry).map(r=>r.geometry);
 report.summary={horses:report.horses.length,mountedGaitSamples:report.horses.reduce((s,h)=>s+h.gaits.reduce((n,g)=>n+g.rows.length,0),0),geometryComparisons:geo.length,maxProtectedVertexDeltaM:Math.max(...geo.map(g=>g.protectedDeltaM)),maxHairAddedComponentM:Math.max(...geo.map(g=>g.hairDeltaComponentM)),maxZeroDtReapplyDeltaM:Math.max(...geo.map(g=>g.reapplyDeltaM)),maxPhaseDelta:Math.max(...geo.map(g=>g.phaseDelta)),maxActualSkinnedBootResidualM:Math.max(...rows.flatMap(r=>Object.values(r.boot))),maxReinEndpointResidualM:Math.max(...rows.flatMap(r=>Object.values(r.reins).flatMap(Object.values))),maxAddedWorldAngleDeg:Math.max(...rows.map(r=>r.state.groomInertia.maxAddedWorldAngleDeg))};
 report.checks={allThreeEligible:report.horses.every(h=>Object.values(h.eligibility).every(Boolean)),all677Finite:rows.every(r=>r.finite&&r.state.groomInertia.finite),actualGaitsAndFullCycles:report.horses.every(h=>h.gaits.every(g=>g.coveredCycles>.99&&g.coveredCycles<1.01&&g.rows.every(r=>r.clip===({walk:'Target Native Walk Rollover',trot:'Target Native Trot',canterLeft:'Target Native Canter Left',canterRight:'Target Native Canter Right'})[g.gait]))),protectedBodyEyesTackExact:report.summary.maxProtectedVertexDeltaM===0,onlyGroomResponds:report.horses.every(h=>h.gaits.some(g=>g.rows.some(r=>r.geometry?.hairDeltaComponentM>1e-6)))&&report.summary.maxAddedWorldAngleDeg<=4.000001,restorationReapply:report.summary.maxZeroDtReapplyDeltaM<1e-10,phaseAndTimeUnchangedByLayer:geo.every(g=>g.phaseDelta===0&&g.controllerTimeDelta===0&&g.sourceControllerUpdatesOwned===0),mountedContacts:report.summary.maxActualSkinnedBootResidualM<.01&&report.summary.maxReinEndpointResidualM<1e-6&&rows.every(r=>r.nonReinComponentsIntact),realStartStopTurn:report.horses.every(h=>h.events.find(e=>e.name==='start-input').sample.speed>.1&&h.events.find(e=>e.name==='left-turn-input').sample.state.lead==='left'&&h.events.find(e=>e.name==='right-turn-input').sample.state.lead==='right'&&h.events.find(e=>e.name==='stop-input').sample.speed===0),longFramesReseed:report.horses.every(h=>h.longFrame.finite&&h.longFrame.after.groomInertia.reseededIntervals===h.longFrame.before.groomInertia.reseededIntervals+1&&h.longFrame.after.groomInertia.maxAddedWorldAngleDeg===0),resetClean:report.horses.every(h=>h.reset.snapshot.groomInertia.maxAddedWorldAngleDeg===0&&h.reset.snapshot.groomInertia.finite),disposeAndSwitchBack:report.switchBack.current.finite&&report.switchBack.current.state.groomInertia.finite&&report.switchBack.old.every(o=>o.snapshot.groomInertia.adapterDisposed&&o.helperAfterDisposeNoThrow&&o.updateRejects),loadedModulesPinned:report.responses.length>=files.length&&report.responses.every(r=>r.sha256===pins[r.file]),zeroErrors:!report.errors.length};
 console.log(JSON.stringify({summary:report.summary,checks:report.checks,errors:report.errors},null,2));save();if(!Object.values(report.checks).every(Boolean))process.exitCode=1;
 }finally{save();await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});

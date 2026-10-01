// Real Ranch transitions with only the Bay profile HTTP response routed to the private Sporthorse kit.
// This is not unrouted registration evidence; actual game motion/rider code and controlled input remain unchanged.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),QA=require('../../tools/qa-platform.cjs');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'output/native-bay-sporthorse-kit');
const here=__dirname,anchors=JSON.parse(fs.readFileSync(path.join(here,'anchors.json'))),expected=anchors.combinedKitSha256,profileRoutes=[];
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
(async()=>{const browser=await QA.chromium.launch({headless:true,args:QA.gpuArgs()}),page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[],responses=[],jobs=[];try{
 await page.route('**/assets/native-breed-profiles.js*',async route=>{
  const response=await route.fetch(),original=await response.text(),record={id:'bay-western',name:'Private Bay Sporthorse',label:'Private Bay Sporthorse',nativeKind:'horse',file:'../review/native-bay-sporthorse-kit/model.glb',sha256:expected,jointCount:677,bodyVertexCount:16159,hairVertexCount:23514,tackVertexCount:13895,nativeIdleClip:null,nativeHeadBone:'head_019',nativeSeatBone:'saddle_0333',nativeSourceSeat:anchors.sourceSeat,nativeTranslation:anchors.sourceToGameTranslation,nativeScale:1,nativeMaxSpeedMps:Math.max(...Object.values(anchors.gaits).map(r=>r.nominalSpeedMps)),nativeGaits:anchors.gaits,nativeAnchorFile:'../review/native-bay-sporthorse-kit/anchors.json',nativeCoordinateFile:'../review/native-bay-sporthorse-kit/actual-coordinates.json'};
  const replaced=original.replace(/^ 'bay-western':.*$/m," 'bay-western':{...common,...horseCredit,..."+JSON.stringify(record)+"},");if(replaced===original)throw Error('Native profile fixture did not match');
  profileRoutes.push({url:route.request().url(),originalResponseSha256:crypto.createHash('sha256').update(original).digest('hex'),routedResponseSha256:crypto.createHash('sha256').update(replaced).digest('hex'),record});await route.fulfill({response,body:replaced});
 });
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});page.on('response',r=>{if(r.url().includes('/native-horse-motion.js'))jobs.push(r.body().then(b=>responses.push({url:r.url(),sha256:crypto.createHash('sha256').update(b).digest('hex')})))});
 await page.goto(QA.BASE+'/ranch3d.html?qa=native-transitions',{waitUntil:'load',timeout:120000});await page.waitForFunction(()=>window.__features?.installed?.includes('native-horses')&&JSON.parse(render_game_to_text()).graphics.horseReady,null,{timeout:120000});
 const result=[];
 for(const breed of ['bay-western']){
  await page.evaluate(()=>__features.ui.openShop('native-models'));await page.locator('[data-fx="native-horses:add:'+breed+'"]').click();await page.evaluate(()=>__features.hidePanels());
  const index=await page.evaluate(b=>__features.horse.myHorses.findIndex(h=>h.breed===b),breed);await page.selectOption('#horseSel',String(index),{force:true});await page.waitForFunction(b=>{const G=__features,r=G.horse.RIG();return r.modelKey===b&&r.ready&&!r.loadingBreed&&r.attachedTo===G.horse.player.mesh&&G.horse.player.rider?.sk},breed,{timeout:60000});
  await page.evaluate(()=>{advanceTime(0);const p=__features.horse.player;p.speed=0;p.pos.set(-3,0,-3);p.y=0;p.vy=0;p.heading=0;});
  for(const scenario of [
   {from:'stand',to:'walk',fraction:.12},
   {from:'walk',to:'trot',fraction:.95},
   {from:'trot',to:'canterLeft',fraction:.95},
   {from:'canterLeft',to:'canterRight',fraction:.95},
   {from:'canterRight',to:'stand',fraction:0}
  ]){
   if(scenario.to==='canterRight')await page.keyboard.down('ArrowRight');else await page.keyboard.up('ArrowRight');
   const rows=[];for(let i=0;i<42;i++)rows.push(await page.evaluate(({scenario,i})=>{
    const G=__features,r=G.horse.RIG(),p=G.horse.player,T=G.THREE,record=r.profile.nativeGaits[scenario.to],scale=r.scene.getWorldScale(new T.Vector3()).z;
    const before=r.bones.map(b=>b.quaternion.clone());p.speed=record?scenario.fraction*record.nominalSpeedMps*scale:0;advanceTime(1000/120);
    const sk=p.rider.sk,body=p.rider.rig.body,boot={},v=new T.Vector3();body.updateMatrixWorld(true);body.skeleton.update();
    for(const S of ['L','R']){const sole=sk.by['foot'+S].userData.soleContact,mean=new T.Vector3();for(const id of sole.vertices){body.getVertexPosition(id,v);mean.add(v.applyMatrix4(body.matrixWorld));}mean.multiplyScalar(1/sole.vertices.length);boot[S]=mean.distanceTo(G.horse.TACK().saddle.userData.stir[S].getWorldPosition(new T.Vector3()));}
    const bridge=G.horse.nativeRiderInspect(),dist=(a,b)=>Math.hypot(...a.map((x,j)=>x-b[j])),reins={};for(const[S,s]of Object.entries(bridge.reins.sides))reins[S]={bit:dist(s.mainStart,s.bit),hand:dist(s.mainEnd,s.hand)};
    let low=Infinity,actorPlaneMin=Infinity;const actorInverse=r.scene.matrixWorld.clone().invert(),localV=new T.Vector3();const model=r.skin;model.skeleton.update();for(let id=0;id<model.geometry.attributes.position.count;id++){model.getVertexPosition(id,v);v.applyMatrix4(model.matrixWorld);low=Math.min(low,v.y);actorPlaneMin=Math.min(actorPlaneMin,localV.copy(v).applyMatrix4(actorInverse).y);}
    const ground=G.world.groundH(p.pos.x,p.pos.z),qstep=(a,b)=>2*Math.acos(Math.min(1,Math.abs(a.dot(b))/Math.sqrt(a.lengthSq()*b.lengthSq())))*180/Math.PI;
    return{timeS:(i+1)/120,state:r.heroMotion.snapshot(),clip:r.heroMotion.clip,sha256:r.profile.sha256,rate:r.heroRate,finite:r.bones.every(b=>b.matrixWorld.elements.every(Number.isFinite))&&p.rider.g.matrixWorld.elements.every(Number.isFinite),maxJointStep:Math.max(...before.map((q,j)=>qstep(q,r.bones[j].quaternion))),boot,reins,bodyFloorVsActorPlaneM:actorPlaneMin,bodyFloorVsPlayerGroundM:low-ground,nonReinComponentsIntact:bridge.reins.nonReinComponentsIntact};
   },{scenario,i}));
   result.push({breed,scenario,finalClip:rows.at(-1).clip,actualSha256:rows.at(-1).sha256,allFinite:rows.every(r=>r.finite),maxActualBootResidualM:Math.max(...rows.flatMap(r=>Object.values(r.boot))),maxReinEndpointResidualM:Math.max(...rows.flatMap(r=>Object.values(r.reins).flatMap(v=>Object.values(v)))),maxJointStep:Math.max(...rows.map(r=>r.maxJointStep)),minimumBodyFloorVsActorPlaneM:Math.min(...rows.map(r=>r.bodyFloorVsActorPlaneM)),minimumBodyFloorVsPlayerGroundM:Math.min(...rows.map(r=>r.bodyFloorVsPlayerGroundM)),completedFadeByS:rows.find(r=>!r.state.transitioning)?.timeS??null,sourceNonReinIntact:rows.every(r=>r.nonReinComponentsIntact),rows});
   if(scenario.to==='canterRight')await page.evaluate(()=>{const G=__features,p=G.horse.player;G.camera.position.set(p.pos.x-5,G.world.groundH(p.pos.x,p.pos.z)+2.6,p.pos.z+4);G.camera.lookAt(p.mesh.getWorldPosition(new G.THREE.Vector3()).add(new G.THREE.Vector3(0,1.4,0)));G.composer.render()});
   if(scenario.to==='canterRight')await page.screenshot({path:path.join(__dirname,'sporthorse-transition-mounted.png')});
  }
 }
 await Promise.all(jobs);const summary={candidateSha256:expected,actualTarget:'Bay Sporthorse',profileFixtureId:'bay-western',routedPrivateCandidate:true,profileRoutes,controllerSha256:sha(path.join(root,'assets/native-horse-motion.js')),responses,errors,unrouted:false,actualRanchControllers:true,controlledInputOnly:true,rows:result.map(x=>({...x,rows:undefined})),allFinite:result.every(r=>r.allFinite),maxBootResidualM:Math.max(...result.map(r=>r.maxActualBootResidualM)),maxReinEndpointResidualM:Math.max(...result.map(r=>r.maxReinEndpointResidualM)),sourceNonReinIntact:result.every(r=>r.sourceNonReinIntact)};summary.attachmentPass=!errors.length&&summary.allFinite&&summary.maxBootResidualM<.01&&summary.maxReinEndpointResidualM<1e-6&&summary.sourceNonReinIntact;summary.actorPlaneWithin10mm=result.every(r=>r.minimumBodyFloorVsActorPlaneM>=-.01);summary.verdict='Finite mounted attachment and real-time fading pass; transient floor-contact limits remain';fs.writeFileSync(path.join(out,'transition-ranch-report.json'),JSON.stringify({summary,result},null,2)+'\n');fs.writeFileSync(path.join(__dirname,'transition-ranch-summary.json'),JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify(summary,null,2));if(!summary.attachmentPass)process.exitCode=1;
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});

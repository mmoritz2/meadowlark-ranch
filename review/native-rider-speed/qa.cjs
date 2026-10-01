const QA=require('../../tools/qa-platform.cjs'),fs=require('fs'),path=require('path');
const out=path.resolve(process.argv[2]||'output/native-rider-speed');fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await QA.chromium.launch({headless:true,args:QA.gpuArgs()});try{
 const page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[],audioDeviceErrors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()!=='error')return;const text=m.text();if(text==='The AudioContext encountered an error from the audio device or the WebAudio renderer.')audioDeviceErrors.push(text);else errors.push(text);});
 await page.goto(QA.BASE+'/ranch3d.html?qa=native-rider-speed');await page.waitForFunction(()=>window.__features?.installed?.includes('native-horses')&&__features.horse.RIG().ready,null,{timeout:120000});
 const rows=[];
 for(const key of ['white-western','bay-western','bay-sporthorse-native']){
  await page.evaluate(key=>{const G=__features;G.save.sync(s=>G.horse.grantHorse(s,key,{src:'native-models'}));G.horse.reloadHorses();},key);
  const index=await page.evaluate(key=>__features.horse.myHorses.findIndex(h=>h.breed===key),key);await page.selectOption('#horseSel',String(index),{force:true});await page.waitForFunction(key=>{const G=__features;return G.horse.RIG().modelKey===key&&!G.horse.RIG().loadingBreed&&G.horse.player.rider?.sk;},key,{timeout:60000});
  const data=await page.evaluate(()=>{
   const G=__features,r=G.horse.RIG(),p=G.horse.player,THREE=G.THREE,scale=r.scene.getWorldScale(new THREE.Vector3()).z,max=r.profile.nativeMaxSpeedMps*scale,samples=[];
   p.pos.set(-3,0,-3);p.y=0;p.vy=0;p.heading=0;p.rider._patRun=0;p.rider._patT=9999;
   for(const fraction of [.08,.25,.6,1])for(let i=0;i<32;i++){
    p.speed=max*fraction;advanceTime(1000/120);
    const q=p.rider,contacts=G.horse.nativeRiderInspect(),boots={};
    for(const S of ['L','R']){const foot=q.sk.by['foot'+S],sole=foot.userData.soleContact,body=q.rig.body,tread=G.horse.TACK().saddle.userData.stir[S],mean=new THREE.Vector3(),v=new THREE.Vector3();body.updateMatrixWorld(true);body.skeleton.update();for(const j of sole.vertices){body.getVertexPosition(j,v);mean.add(v.applyMatrix4(body.matrixWorld));}mean.multiplyScalar(1/sole.vertices.length);boots[S]=mean.distanceTo(tread.getWorldPosition(new THREE.Vector3()));}
    samples.push({fraction,speed:p.speed,cap:max,phase:r.phase,mode:r.heroMotion.mode,pose:{...q.pose},boots,finite:q.rig.body.skeleton.bones.every(b=>b.matrixWorld.elements.every(Number.isFinite)),reins:contacts.reins});
   }
   return{key:r.modelKey,samples};
  });rows.push(data);await page.screenshot({path:path.join(out,key+'.png')});
 }
 const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
 const summary={errors,audioDeviceErrors,rows:rows.map(r=>({key:r.key,firstFrameBootGapM:Math.max(...Object.values(r.samples[0].boots)),maximumBootGapM:Math.max(...r.samples.flatMap(s=>Object.values(s.boots))),minimumLean:r.samples[0].pose.lean,maximumLean:Math.max(...r.samples.map(s=>s.pose.lean)),finite:r.samples.every(s=>s.finite),reinsAttached:r.samples.every(s=>s.reins?.nonReinComponentsIntact&&Object.values(s.reins.sides).every(x=>distance(x.mainStart,x.bit)<1e-6&&distance(x.mainEnd,x.hand)<1e-6)),speedFractions:[.08,.25,.6,1].map(f=>({fraction:f,leanMean:r.samples.filter(s=>s.fraction===f).reduce((a,s)=>a+s.pose.lean,0)/32}))}))};
 summary.nativePostureResponds=summary.rows.every(r=>r.speedFractions.at(-1).leanMean-r.speedFractions[0].leanMean>.1);
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({summary,rows},null,2)+'\n');console.log(JSON.stringify(summary));if(errors.length||!summary.nativePostureResponds||summary.rows.some(r=>!r.finite||!r.reinsAttached||r.maximumBootGapM>.01))process.exitCode=1;
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

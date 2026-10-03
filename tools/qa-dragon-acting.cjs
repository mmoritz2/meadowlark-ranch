// Measure the packaged clips on the original skinned dragon, independent of the
// curve authoring code. World-space foot anchors distinguish acting from sliding.
const QA=require('./qa-platform.cjs'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const out=path.resolve(process.argv[2]||'output/dragon-acting');fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await QA.chromium.launch({headless:true,args:QA.gpuArgs()}),page=await browser.newPage({viewport:{width:1200,height:800}}),report={checks:{},errors:[]};page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 try{
  const download=page.waitForResponse(r=>r.url().split('?')[0].endsWith('/black-dragon-motion.glb'));
  await page.goto(QA.BASE+'/review/dragon-rigging/black-motion.html?clip=DragonStand',{timeout:120000});await page.waitForFunction(()=>window.__black,null,{timeout:120000});
  report.motionHash=crypto.createHash('sha256').update(await(await download).body()).digest('hex');const file=path.join(__dirname,'../assets/models/dragon-motions/black-dragon-motion.glb');assert.equal(report.motionHash,crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'));
  report.clips=await page.evaluate(()=>{
   const a=__black,T=a.T,root=a.current.sourceScene,head=root.getObjectByName('head_022'),torso=root.getObjectByName('paunch_017'),feet=['Hand_L_0133','Hand_R_099','back_food_L_082','back_food_R_0116'].map(n=>root.getObjectByName(n)),skins=[];a.current.scene.traverse(o=>{if(o.isSkinnedMesh)skins.push(o);});
   const vec=new T.Vector3(),q=new T.Quaternion(),angular=(a,b)=>2*Math.acos(Math.min(1,Math.abs(a.reduce((s,n,i)=>s+n*b[i],0))/(Math.hypot(...a)*Math.hypot(...b))))*180/Math.PI,range=points=>[0,1,2].map(k=>Math.max(...points.map(p=>p[k]))-Math.min(...points.map(p=>p[k]))),results=[];
   for(const name of ['DragonStand','DragonFly']){
    a.select(name);const clip=a.clips.find(c=>c.name===name),n=name==='DragonStand'?240:120,rows=[];let finite=true,minSkinY=Infinity,maxFrameAngle=0,last=[];
    for(let i=0;i<=n;i++){
     a.seek(clip.duration*i/n);const center=torso.getWorldPosition(new T.Vector3()),inverse=torso.getWorldQuaternion(new T.Quaternion()).invert(),bones=a.current.body.skeleton.bones;
     const rotations=bones.map(b=>b.quaternion.toArray());finite&&=bones.every(b=>b.matrixWorld.elements.every(Number.isFinite));if(last.length)for(let k=0;k<last.length;k++)maxFrameAngle=Math.max(maxFrameAngle,angular(last[k],rotations[k]));last=rotations;
     if(i%4===0)for(const mesh of skins)for(let j=0;j<mesh.geometry.attributes.position.count;j++){mesh.getVertexPosition(j,vec);vec.applyMatrix4(mesh.matrixWorld);finite&&=vec.toArray().every(Number.isFinite);minSkinY=Math.min(minSkinY,vec.y);}
     rows.push({time:clip.duration*i/n,head:head.getWorldPosition(new T.Vector3()).toArray(),headQuaternion:head.getWorldQuaternion(new T.Quaternion()).toArray(),feet:feet.map(b=>b.getWorldPosition(new T.Vector3()).toArray()),feetRelativeTorso:feet.map(b=>b.getWorldPosition(new T.Vector3()).sub(center).applyQuaternion(inverse).toArray()),footQuaternions:feet.map(b=>inverse.clone().multiply(b.getWorldQuaternion(new T.Quaternion())).toArray())});
    }
    const footDiameters=feet.map((_,leg)=>{const pts=rows.map(r=>r.feetRelativeTorso[leg]);let d=0;for(const p of pts)for(const q of pts)d=Math.max(d,Math.hypot(...p.map((v,k)=>v-q[k])));return d;});
    const footPitch=feet.map((_,leg)=>{const qs=rows.map(r=>r.footQuaternions[leg]);let d=0;for(const p of qs)for(const q of qs)d=Math.max(d,angular(p,q));return d;});
    const shake=rows.filter(r=>r.time>=3.5&&r.time<=7.1),quiet=rows.filter(r=>r.time<3),bow=rows.filter(r=>r.time>=12.6&&r.time<=13.5),headY=pts=>pts.reduce((s,r)=>s+r.head[1],0)/pts.length;
    const end=rows.at(-1),first=rows[0],loopError=Math.max(...first.head.map((v,i)=>Math.abs(v-end.head[i])),...first.feet.flatMap((p,j)=>p.map((v,i)=>Math.abs(v-end.feet[j][i]))));
    results.push({name,duration:clip.duration,finite,joints:bonesCount(a),minimumSkinY:minSkinY,maxFrameAngle,loopError,footDiameters,footPitch,feetWorldRange:feet.map((_,leg)=>range(rows.map(r=>r.feet[leg]))),shakeHeadRange:shake.length?range(shake.map(r=>r.head)):null,bowHeadDrop:bow.length?headY(quiet)-headY(bow):null,rows});
   }
   function bonesCount(a){return a.current.body.skeleton.bones.length;}
   return results;
  });
  const idle=report.clips.find(c=>c.name==='DragonStand'),fly=report.clips.find(c=>c.name==='DragonFly');
  assert.equal(idle.duration,20);assert(idle.shakeHeadRange[0]>.25,'Neck shake must move the actual head side to side');assert(idle.bowHeadDrop>.25,'Bow must visibly lower the head');assert(idle.feetWorldRange.every(v=>Math.max(...v)<.015),'Idle feet stay planted');
  assert(fly.footDiameters.every(x=>x>.4),'Every flying foot must travel visibly relative to the torso');assert(fly.footPitch.every(x=>x>23),'Airborne ankles articulate');
  assert(report.clips.every(c=>c.finite&&c.joints===232&&c.loopError<1e-4&&c.minimumSkinY>-.035),'Native skin stays valid and above the floor, with a continuous loop');
  report.checks={visibleFlightLegs:true,ankleFlex:true,neckShake:true,bow:true,plantedIdleFeet:true,finiteOriginalSkin:true,continuousLoops:true};
  report.images=[];
  for(const [name,t,label]of [['DragonStand',0,'idle-neutral'],['DragonStand',4.4,'neck-shake-left'],['DragonStand',5,'neck-shake-right'],['DragonStand',13,'idle-bow'],['DragonStand',16,'idle-recovered'],['DragonFly',0,'flight-legs-0'],['DragonFly',.825,'flight-legs-25'],['DragonFly',1.65,'flight-legs-50'],['DragonFly',2.475,'flight-legs-75']]){
   await page.evaluate(({name,t})=>{const a=__black,T=a.T;a.select(name);a.seek(t);const flight=name==='DragonFly';a.controls.target.set(0,flight?1.7:2.3,flight?-.25:1);a.camera.position.copy(a.controls.target).add(new T.Vector3(flight?6:7.5,flight?.1:.5,flight?.9:3));a.controls.update();a.renderer.render(a.scene,a.camera);}, {name,t});const filename=label+'.png';await page.screenshot({path:path.join(out,filename)});report.images.push(filename);
  }
  assert.equal(report.errors.length,0,report.errors.join('\n'));report.checks.noBrowserErrors=true;
  console.log(JSON.stringify({checks:report.checks,flightFootDiameters:fly.footDiameters,flightAnkleDegrees:fly.footPitch,bowHeadDrop:idle.bowHeadDrop,neckShakeRange:idle.shakeHeadRange,idleFootDrift:idle.feetWorldRange,minimumY:report.clips.map(c=>c.minimumSkinY)}));
 }finally{fs.writeFileSync(path.join(out,'packaged-report.json'),JSON.stringify(report,null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

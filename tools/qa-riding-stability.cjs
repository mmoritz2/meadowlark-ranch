// Disposable browser save; exercise the real game rig, controls and renderer.
const QA=require('./qa-platform.cjs'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const out=path.resolve(process.argv[2]||'output/riding-stability');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await QA.chromium.launch({headless:true,args:QA.gpuArgs()});
 const page=await browser.newPage({viewport:{width:1280,height:850},deviceScaleFactor:2}),errors=[],report={mounts:[]};
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 const release=async()=>{for(const k of ['ArrowUp','ArrowLeft','Control','Alt','Shift','Space'])await page.keyboard.up(k);};
 try{
  await page.route('**/ranch3d.html*',async route=>{const r=await route.fetch();const body=(await r.text()).replace('const MERGE_STATS=mergeStatics();',`window.__ridingQA={driveRider,step(dt){manualStepping=true;tick(dt);},day(){dayT=.34;weather.mode='clear';weather.timer=99999;}};const MERGE_STATS=mergeStatics();`);await route.fulfill({response:r,body});});
  await page.goto(QA.BASE+'/ranch3d.html?qa=riding-stability',{waitUntil:'load',timeout:120000});
  await page.waitForFunction(()=>window.__features?.horse.RIG().ready&&__features.horse.player.rider?.sk&&!document.getElementById('load'),null,{timeout:120000});
  await page.evaluate(async()=>{const G=__features;G.save.sync(s=>s.qualityLocked=true);G.wardrobe?.closeChar();G.hidePanels();await G.photoscans.ready;await G.worldDetails.ready;advanceTime(0);G.gfx.apply('high');__ridingQA.day();});
  report.trees=await page.evaluate(()=>{
   const G=__features,p=G.horse.player; p.speed=0;p.pos.set(-40,0,32);p.heading=0;advanceTime(500);
   const retired=[],versions=()=>{const a=[];G.scene.traverse(m=>{if(m.isInstancedMesh&&/Photoscan.*tree|scan.*tree|Tree|tree/i.test(m.name))a.push([m.uuid,m.instanceMatrix.version]);});return a;};
   G.scene.traverse(m=>{if(m.userData.photoscanReplaced)retired.push({uuid:m.uuid,name:m.name,visible:m.visible,count:m.count});});
   const before=versions(),rebuilds=G.photoscans.detailRebuilds;advanceTime(2000);const after=versions();
   const modes=[];for(const tier of ['low','medium','high']){G.gfx.apply(tier);advanceTime(500);modes.push({tier,active:G.photoscans.activeTrees,distant:G.photoscans.distantTrees,retiredVisible:retired.some(r=>G.scene.getObjectByProperty('uuid',r.uuid)?.visible)});}
   return {retired,before,after,rebuilds,stationaryRebuilds:G.photoscans.detailRebuilds-rebuilds-3,modes};
  });
  assert(report.trees.retired.length>0&&report.trees.retired.every(m=>!m.visible),'Replaced seed batches are hidden');
  assert.deepEqual(report.trees.before,report.trees.after,'Stationary trees do not upload instance buffers');
  assert.equal(report.trees.stationaryRebuilds,0,'Stationary tree selection does not rebuild');
  assert(report.trees.modes.every(m=>!m.retiredVisible),'Tier changes never restore hidden legacy trees');
  assert.deepEqual(report.trees.modes.map(m=>m.active),[0,6,12],'Detail budgets survive tier changes');
  console.log('Hidden legacy trees, stationary buffers and quality transitions passed.');
  report.pose=await page.evaluate(()=>{
   const p=__features.horse.player,r=__features.horse.RIG(),R=p.rider,qa=__ridingQA,rows=[];p.flying=false;p.onFoot=false;r.heroJumpAge=null;R._air=0;
   for(const airborne of [true,false])for(let i=0;i<12;i++){p.y=airborne?1:0;qa.driveRider(4,20+i*.25,.25);rows.push({air:R._air,lean:R.pose.lean,rise:R.pose.rise});}
   const before=[R._air,R._post,R._turn,R._look,R._patT,R._patRun];qa.driveRider(4,25,0);const after=[R._air,R._post,R._turn,R._look,R._patT,R._patRun];
   p.y=0;return{rows,before,after};
  });
  assert(report.pose.rows.every(r=>r.air>=0&&r.air<=1&&Number.isFinite(r.lean)&&Number.isFinite(r.rise)),'Slow-frame jump blend stays bounded');
  assert.deepEqual(report.pose.before,report.pose.after,'A paused frame does not advance rider blend or idle timers');
  console.log('250 ms rider blending and paused pose checks passed.');
  await page.evaluate(()=>{
   window.inspectRidingContacts=()=>{
    const G=__features,p=G.horse.player,r=G.horse.RIG(),v=new G.THREE.Vector3();p.mesh.updateMatrixWorld(true);
    const boots=Object.fromEntries(['L','R'].map(S=>{const foot=p.rider.sk.by['foot'+S],sole=foot.userData.soleContact,tread=G.horse.TACK().saddle.userData.stir[S],body=p.rider.rig.body,mean=new G.THREE.Vector3();
     for(const i of sole.vertices){body.getVertexPosition(i,v);mean.add(v.applyMatrix4(body.matrixWorld));}mean.multiplyScalar(1/sole.vertices.length);return[S,mean.distanceTo(tread.getWorldPosition(v))];}));
    const reins=G.horse.nativeRiderInspect().reins,distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
    return{boots,reinGap:Math.max(...Object.values(reins.sides).flatMap(s=>[distance(s.mainStart,s.bit),distance(s.mainEnd,s.hand)])),tackIntact:reins.nonReinComponentsIntact,finite:r.bones.every(b=>b.matrixWorld.elements.every(Number.isFinite))&&p.rider.sk.list.every(b=>b.matrixWorld.elements.every(Number.isFinite)),air:p.rider._air,y:p.y,gait:r.heroMotion.mode};
   };
  });
  for(const breed of ['bay','white-western']){
   await release();const index=await page.evaluate(breed=>{const G=__features;G.save.sync(s=>G.horse.grantHorse(s,breed,{name:'Riding QA',level:30,stats:{speed:3,accel:3,stamina:3,jump:3,agility:3}}));G.horse.reloadHorses();G.horse.rebuildAll();return G.horse.myHorses.findIndex(h=>h.breed===breed);},breed);
   await page.selectOption('#horseSel',String(index),{force:true});
   await page.waitForFunction(breed=>{const G=__features,r=G.horse.RIG();return r.requestedBreed===breed&&r.ready&&!r.loadingBreed&&r.attachedTo===G.horse.player.mesh;},breed,{timeout:90000});
   const samples=[];
   for(const [name,keys] of [['idle',[]],['walk',['ArrowUp','Control']],['trot',['ArrowUp','Alt']],['gallop-turn',['ArrowUp','Shift','ArrowLeft']]]){
    await release();await page.evaluate(()=>{const G=__features,p=G.horse.player;G.hidePanels();G.wardrobe?.closeChar();p.pos.set(-40,0,32);p.heading=0;p.speed=0;p.y=0;p.vy=0;p.stam=1;p.flying=false;advanceTime(100);});
    for(const k of keys)await page.keyboard.down(k);
    const rows=await page.evaluate(()=>{const rows=[];for(let i=0;i<8;i++){__ridingQA.step(.125);rows.push(inspectRidingContacts());}return rows;});samples.push({name,rows});assert(rows.some(r=>r.gait===({idle:'stand',walk:'walk',trot:'trot','gallop-turn':'gallop'}[name])),breed+' reaches '+name);
   }
   await release();await page.evaluate(()=>{const p=__features.horse.player;p.pos.set(-40,0,32);p.heading=0;p.speed=0;p.y=0;p.vy=0;advanceTime(500);});
   await page.keyboard.down('Space');await page.evaluate(()=>__ridingQA.step(.125));await page.keyboard.up('Space');
   const jump=await page.evaluate(()=>{const rows=[];for(let i=0;i<20;i++){__ridingQA.step(.125);rows.push(inspectRidingContacts());}return rows;});samples.push({name:'jump-and-land',rows:jump});
   assert(jump.some(r=>r.gait==='jump'&&r.y>.1)&&jump.at(-1).y===0,breed+' jumps and lands with slow frames');
   const rows=samples.flatMap(s=>s.rows);report.mounts.push({breed,samples});
   assert(rows.every(r=>r.finite&&r.tackIntact&&r.air>=0&&r.air<=1),breed+' stable rider, rig and tack');
   assert(rows.every(r=>Object.values(r.boots).every(d=>d<.01)),breed+' actual skinned boot soles remain on stirrups');
   assert(rows.every(r=>r.reinGap<1e-6),breed+' reins stay attached to hands and bit');
   await page.evaluate(()=>{const G=__features,p=G.horse.player;G.camera.position.set(p.pos.x-4,G.world.groundH(p.pos.x,p.pos.z)+2.5,p.pos.z+3);G.camera.lookAt(p.mesh.position.clone().add(new G.THREE.Vector3(0,1.5,0)));G.composer.render();});
   await page.screenshot({path:path.join(out,breed+'-rider.png')});
   console.log(breed+': idle, walk, trot, turning gallop, slow-frame jump/landing and skinned contacts passed.');
  }
  report.resize=await page.evaluate(()=>({width:innerWidth,height:innerHeight,ratio:__features.renderer.getPixelRatio(),pixels:__features.renderer.domElement.width*__features.renderer.domElement.height}));
  assert(report.resize.pixels<=1650000,'High graphics respects Retina pixel budget');
  await page.setViewportSize({width:1920,height:1080});await page.evaluate(()=>advanceTime(0));
  report.largeViewport=await page.evaluate(()=>({ratio:__features.renderer.getPixelRatio(),pixels:__features.renderer.domElement.width*__features.renderer.domElement.height}));
  assert(report.largeViewport.pixels<=1650000,'Resize reapplies pixel budget');
  assert.equal(errors.length,0,errors.join('\n'));
 }finally{await release().catch(()=>{});fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({...report,errors},null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

/* Mounted dragon rig/motion regression in a disposable browser save.
 * QA_DRAGONS narrows models; no changes to the player's persistent browser save. */
const QA=require('./qa-platform.cjs'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const output=path.join(__dirname,'../review/dragon-rigging');
(async()=>{
 const browser=await QA.chromium.launch({headless:true,args:QA.gpuArgs()});
 const page=await browser.newPage({viewport:{width:1280,height:850}}),errors=[],report={models:[]};
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error'&&/Shader Error|VALIDATE_STATUS|ERROR: 0:/.test(m.text()))errors.push(m.text());});
 const capture=async(name)=>{
  fs.mkdirSync(output,{recursive:true});
  await page.evaluate(()=>{const G=__features,p=G.horse.player,r=G.horse.RIG(),box=new G.THREE.Box3().setFromObject(r.scene,true);box.union(new G.THREE.Box3().setFromObject(p.rider.g,true));const size=box.getSize(new G.THREE.Vector3()),center=box.getCenter(new G.THREE.Vector3()),radius=Math.max(size.x,size.y,size.z)*.5;const distance=radius/Math.tan(G.camera.fov*Math.PI/360)*1.6;G.camera.position.copy(center).add(new G.THREE.Vector3(1,.34,1.45).normalize().multiplyScalar(distance));G.camera.lookAt(center);G.camera.updateProjectionMatrix();G.renderer.domElement.setAttribute('data-qa-dragon-render','true');G.renderer.render(G.scene,G.camera);});
  const file=path.join(output,name+'.png');await page.locator('[data-qa-dragon-render]').screenshot({path:file});return path.basename(file);
 };
 const release=async()=>{for(const key of ['ArrowUp','Control','Alt','Shift','Space'])await page.keyboard.up(key);};
 try{
  await page.goto(QA.BASE+'/ranch3d.html?qa=dragon-rigging',{timeout:120000});
  await page.waitForFunction(()=>window.__features?.installed?.includes('native-horses')&&__features.horse.RIG().ready,null,{timeout:120000});
  report.lane=await page.evaluate(()=>{
   const G=__features;advanceTime(0);G.hidePanels();
   const wallDistance=(x,z,w)=>{const dx=w.x2-w.x1,dz=w.z2-w.z1,t=Math.max(0,Math.min(1,((x-w.x1)*dx+(z-w.z1)*dz)/(dx*dx+dz*dz)));return Math.hypot(x-w.x1-dx*t,z-w.z1-dz*t);};
   for(const heading of [0,Math.PI/2,Math.PI,-Math.PI/2])for(let x=-16;x<=12;x+=4)for(let z=-20;z<=12;z+=4){let clear=true;const heights=[];
    for(let d=0;d<=12;d+=.4){const px=x+Math.sin(heading)*d,pz=z+Math.cos(heading)*d;heights.push(G.world.groundH(px,pz));if(G.world.colliders.some(c=>Math.hypot(px-c.x,pz-c.z)<c.r+1.1)||G.world.walls.some(w=>wallDistance(px,pz,w)<1.1)){clear=false;break;}}
    if(clear&&Math.max(...heights)-Math.min(...heights)<.35){window.__dragonQaLane={x,z,heading};return window.__dragonQaLane;}
   }throw Error('No clear mounted dragon QA lane');
  });
  await page.evaluate(()=>{
   window.__dragonQaSnapshot=()=>{
    const G=__features,p=G.horse.player,r=G.horse.RIG(),rider=p.rider,tack=G.horse.TACK();
    r.scene.updateWorldMatrix(true,true);const seat=p.mesh.worldToLocal(r.nativeSeatFollower.getWorldPosition(new G.THREE.Vector3()));
    const expected=seat.clone().add(new G.THREE.Vector3(0,.11/(p.mesh.scale.x||1),-.02/(p.mesh.scale.x||1)));
    return {gait:r.heroMotion.mode,phase:r.heroMotion.state.phase01,heroRate:r.heroRate,speed:p.speed,y:p.y,flying:p.flying,nativeFlying:r.nativeFlying,
     boneCount:r.bones.length,riderFinite:Object.values(rider.sk?.by||{}).every(b=>b.matrixWorld.elements.every(Number.isFinite)),finite:r.bones.every(b=>b.matrixWorld.elements.every(Number.isFinite)),seat:seat.toArray(),riderDelta:rider.g.position.clone().sub(expected).toArray(),wingPose:r.bones.filter(b=>['w_C_L_057','w_C_R_069','w2_L_059','w2_R_071','DEF-Wing_BaseL_081','DEF-Wing_BaseR_097','DEF-Wing_Fold_1L_082','DEF-Wing_Fold_1R_098'].includes(b.name)).map(b=>({name:b.name,q:b.quaternion.toArray()})),riderPosition:rider.g.position.toArray(),riderAnchorError:rider.g.position.distanceTo(expected),riderVisible:rider.g.visible,
     saddleVisible:!!tack.saddle?.visible,bridlePresent:!!tack.bridle,bitPresent:!!tack.bitL,proceduralWingsVisible:!!p.parts.wings?.some(w=>w.visible),available:r.heroMotion.availableModes};
   };
  });
  for(const key of process.env.QA_DRAGONS?.split(',')||['black-dragon-native','european-dragon']){
   await release();
   const index=await page.evaluate(key=>{const G=__features;G.save.sync(s=>G.horse.grantHorse(s,key,{name:'Dragon Rig QA',level:30,stats:{speed:3,accel:3,stamina:3,jump:3,agility:3}}));G.horse.reloadHorses();G.horse.rebuildAll();G.hidePanels();return G.horse.myHorses.findIndex(h=>h.breed===key);},key);
   await page.selectOption('#horseSel',String(index),{force:true});
   await page.waitForFunction(key=>{const G=__features,r=G.horse.RIG();return r.requestedBreed===key&&!r.loadingBreed&&r.ready&&r.attachedTo===G.horse.player.mesh;},key,{timeout:120000});
   await page.evaluate(()=>{advanceTime(0);const G=__features,p=G.horse.player,lane=window.__dragonQaLane,h=G.horse.ridden();h.pers='relaxed';h.gear={};p.pos.set(lane.x,0,lane.z);p.heading=lane.heading;p.speed=0;p.y=0;p.vy=0;p.flying=false;p.stam=1;p.blown=false;p.boostT=0;G.hidePanels();advanceTime(500);});
   const row={key,idle:await page.evaluate(()=>__dragonQaSnapshot()),ground:[]};report.models.push(row);
   assert.equal(row.idle.boneCount,key==='black-dragon-native'?232:169,key+' native skeleton preserved');
   for(const mode of ['walk','run','fly'])assert(row.idle.available.includes(mode),key+' supports '+mode);
   for(const [modifier,gait]of [['Control','walk'],[null,'run'],['Shift','run']]){
    await release();await page.keyboard.down('ArrowUp');if(modifier)await page.keyboard.down(modifier);
    const state=await page.evaluate(()=>{const G=__features,p=G.horse.player,lane=window.__dragonQaLane;for(let i=0;i<12;i++){advanceTime(250);p.pos.set(lane.x,0,lane.z);p.heading=lane.heading;}const start=p.pos.clone();advanceTime(400);return {...__dragonQaSnapshot(),distance:p.pos.distanceTo(start)};});
    row.ground.push({modifier,...state});assert.equal(state.gait,gait,key+' '+(modifier||'W')+' mode');assert(state.speed>.2&&state.distance>.05,key+' ground travel');
   }
   assert(row.ground[1].speed>row.ground[0].speed*1.2,key+' run is faster than walk');
   assert(row.ground[2].speed>row.ground[1].speed*1.1,key+' Shift run is faster than ordinary run');
   row.groundImage=await capture(key+'-ground');
   await release();await page.evaluate(()=>advanceTime(3500));row.stop=await page.evaluate(()=>__dragonQaSnapshot());assert.equal(row.stop.gait,'stand',key+' returns to idle');
   if(key==='black-dragon-native'){await page.keyboard.down('Space');await page.evaluate(()=>advanceTime(50));await page.keyboard.up('Space');}
   else await page.locator('#flyBtn').click({force:true});
   await page.evaluate(()=>advanceTime(1800));
   row.takeoff=await page.evaluate(()=>__dragonQaSnapshot());assert(row.takeoff.flying&&row.takeoff.y>2,key+' takes off');assert.equal(row.takeoff.gait,'fly',key+' fly animation');
   const hover=await page.evaluate(()=>{const start=__dragonQaSnapshot();advanceTime(700);return {start,end:__dragonQaSnapshot()};});row.hover=hover;
   const phaseAdvance=((hover.end.phase-hover.start.phase)%1+1)%1;assert(phaseAdvance>.04,key+' flight phase advances while hovering');
   const wingDelta=Math.max(...hover.end.wingPose.map(end=>{const start=hover.start.wingPose.find(b=>b.name===end.name);return start?Math.sqrt(end.q.reduce((sum,v,i)=>sum+(v-start.q[i])**2,0)):0;}));hover.wingQuaternionDelta=wingDelta;assert(wingDelta>.02,key+' actual wing joints move while hovering');
   row.flightImage=await capture(key+'-flight');
   await page.keyboard.down('ArrowUp');const flight=await page.evaluate(()=>{const p=__features.horse.player;const start=p.pos.clone();advanceTime(1000);return {...__dragonQaSnapshot(),distance:p.pos.distanceTo(start)};});row.flight=flight;await release();
   assert(flight.flying&&flight.gait==='fly'&&flight.distance>.5,key+' flies forward');
   row.remote=await page.evaluate(key=>{
    const G=__features,p=G.horse.player,id='qa-dragon-remote';const payload={};G.run('netPos',payload,G.save.fresh(),G.horse.ridden());
    const packet={id,n:'Dragon QA',b:key,x:p.pos.x+3,z:p.pos.z,h:p.heading,sp:0,y:6,fl:1};
    const send=fields=>G.net.onMessage('srf1/qa-isolated/pos',JSON.stringify({...packet,...fields}));
    const sample=()=>{const r=G.net.remotes[id],rig=r.rig;rig.scene.updateWorldMatrix(true,true);const seat=r.parts.group.worldToLocal(rig.nativeSeatFollower.getWorldPosition(new G.THREE.Vector3()));const expected=seat.clone().add(new G.THREE.Vector3(0,.11,-.02));return {gait:rig.heroMotion.mode,flying:rig.nativeFlying,altitude:r.parts.group.position.y-G.world.groundH(r.x,r.z),seat:seat.toArray(),riderDelta:r.rider.g.position.clone().sub(expected).toArray(),riderAnchorError:r.rider.g.position.distanceTo(expected),finite:rig.bones.every(b=>b.matrixWorld.elements.every(Number.isFinite))};};
    send({});advanceTime(700);const flying=sample();send({y:0,fl:0});advanceTime(1500);const landed=sample();G.net.remotes[id].lastSeen=8;advanceTime(20);return {payload:{y:payload.y,fl:payload.fl},flying,landed};
   },key);
   assert(row.remote.payload.fl===1&&row.remote.payload.y>2,key+' local flight and altitude enter outgoing position data');
   assert(row.remote.flying.flying&&row.remote.flying.gait==='fly',key+' remote dragon uses Fly');
   assert(Math.abs(row.remote.flying.altitude-6)<.1,key+' remote flight altitude applied once');
   assert(!row.remote.landed.flying&&row.remote.landed.gait==='stand'&&Math.abs(row.remote.landed.altitude)<.05,key+' remote dragon returns to ground idle');
   assert([row.remote.flying,row.remote.landed].every(s=>s.finite&&s.riderAnchorError<.025),key+' remote native joints and rider anchor');
   row.beforeLand=await page.evaluate(()=>__dragonQaSnapshot());await page.locator('#flyBtn').click({force:true});await page.evaluate(()=>advanceTime(20));row.landStart=await page.evaluate(()=>__dragonQaSnapshot());
   assert(row.landStart.y>row.beforeLand.y-.5,key+' landing begins smoothly without ground teleport');
   row.landing=await page.evaluate(()=>{const samples=[];for(let i=0;i<65;i++){advanceTime(100);samples.push(__dragonQaSnapshot());if(!samples.at(-1).flying&&samples.at(-1).y===0)break;}return samples;});
   const landed=row.landing.at(-1);assert(!landed.flying&&landed.y===0,key+' lands');assert.notEqual(landed.gait,'fly',key+' returns to ground pose');
   const samples=[row.idle,...row.ground,row.stop,row.takeoff,hover.start,hover.end,flight,row.landStart,...row.landing];
   assert(samples.every(s=>s.finite&&s.riderFinite),key+' dragon and rider skeleton transforms finite');assert(samples.every(s=>s.riderVisible&&s.riderAnchorError<.025),key+' rider stays at animated seat');
   assert(samples.every(s=>!s.saddleVisible&&!s.bridlePresent&&!s.bitPresent&&!s.proceduralWingsVisible),key+' no duplicate horse tack or wings');
   console.log(key+': native joints, walk/run, takeoff, hover, forward flight, smooth landing and rider anchor passed');
  }
  assert.equal(errors.length,0,errors.join('\n'));
 }finally{await release().catch(()=>{});fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,process.env.QA_REPORT||'mounted-report.json'),JSON.stringify({...report,errors},null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

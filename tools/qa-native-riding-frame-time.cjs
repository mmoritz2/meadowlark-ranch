/* Delay real animation frames to exercise riding at roughly 5–8 FPS.
 * Uses a temporary browser save and live collisions; never touches player saves. */
const QA=require('./qa-platform.cjs'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const output=path.join(__dirname,'../review/native-fast-travel');
(async()=>{
 const browser=await QA.chromium.launch({headless:true,args:QA.gpuArgs()});
 const page=await browser.newPage({viewport:{width:1280,height:850}}),errors=[],report={};
 page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.addInitScript(()=>{
   const raf=window.requestAnimationFrame.bind(window),cancel=window.cancelAnimationFrame.bind(window),pending=new Map();let next=1;
   window.requestAnimationFrame=fn=>{const id=next++,entry={};pending.set(id,entry);entry.frame=raf(()=>{entry.frame=null;entry.timer=setTimeout(()=>{if(pending.delete(id))fn(performance.now());},125);});return id;};
   // The game pauses/restarts its RAF loop during mounting and controlled setup.
   // Cancel the delayed callback too, otherwise the harness creates extra loops.
   window.cancelAnimationFrame=id=>{const entry=pending.get(id);if(!entry)return;if(entry.frame!=null)cancel(entry.frame);clearTimeout(entry.timer);pending.delete(id);};
  });
  await page.goto(QA.BASE+'/ranch3d.html?qa=native-fast-frame-time',{timeout:120000});
  await page.waitForFunction(()=>window.__features?.installed?.includes('native-horses')&&__features.horse.RIG().ready,null,{timeout:120000});
  const index=await page.evaluate(()=>{
   const G=__features;G.save.sync(s=>G.horse.grantHorse(s,'bay',{name:'Low Frame Rate QA',level:30,stats:{speed:3,accel:3,stamina:3,jump:3,agility:3}}));
   G.horse.reloadHorses();G.horse.rebuildAll();G.hidePanels();return G.horse.myHorses.findIndex(h=>h.breed==='bay');
  });
  await page.selectOption('#horseSel',String(index),{force:true});
  await page.waitForFunction(()=>{const G=__features,r=G.horse.RIG();return r.requestedBreed==='bay'&&!r.loadingBreed&&r.ready&&r.attachedTo===G.horse.player.mesh;},null,{timeout:90000});
  report.lane=await page.evaluate(()=>{
   const G=__features;advanceTime(0);G.hidePanels();const h=G.horse.ridden();h.pers='relaxed';h.gear={};
   const wallDistance=(x,z,w)=>{const dx=w.x2-w.x1,dz=w.z2-w.z1,t=Math.max(0,Math.min(1,((x-w.x1)*dx+(z-w.z1)*dz)/(dx*dx+dz*dz)));return Math.hypot(x-w.x1-dx*t,z-w.z1-dz*t);};
   for(const heading of [0,Math.PI/2,Math.PI,-Math.PI/2])for(let x=-16;x<=12;x+=4)for(let z=-20;z<=12;z+=4){
    const heights=[];let clear=true;
    for(let d=0;d<=8;d+=.4){const px=x+Math.sin(heading)*d,pz=z+Math.cos(heading)*d;heights.push(G.world.groundH(px,pz));
     if(G.world.colliders.some(c=>Math.hypot(px-c.x,pz-c.z)<c.r+1.1)||G.world.walls.some(w=>wallDistance(px,pz,w)<1.1)){clear=false;break;}}
    if(clear&&Math.max(...heights)-Math.min(...heights)<.35){window.__frameQaLane={x,z,heading};return window.__frameQaLane;}
   }
   throw Error('No clear frame-time QA lane');
  });
  await page.keyboard.down('ArrowUp');await page.keyboard.down('Shift');
  report.travel=await page.evaluate(()=>new Promise(resolve=>{
   const G=__features,p=G.horse.player,r=G.horse.RIG(),lane=window.__frameQaLane,rows=[];let count=0;
   const reset=()=>{p.pos.set(lane.x,0,lane.z);p.heading=lane.heading;p.y=0;p.vy=0;p.flying=false;p.stam=1;p.blown=false;};
   reset();p.speed=0;p.boostT=0;
   G.on('tick',dt=>{
    if(rows.length>=30)return;
    if(++count>15){const along=(p.pos.x-lane.x)*Math.sin(lane.heading)+(p.pos.z-lane.z)*Math.cos(lane.heading);
     rows.push({wall:performance.now(),dt,distance:along,speed:p.speed,gait:r.heroMotion.mode,heroRate:r.heroRate,finite:r.bones.every(b=>b.matrixWorld.elements.every(Number.isFinite))});}
    // Each measured segment is actual collision-checked travel. Resetting only
    // between frames keeps the prolonged test inside the unobstructed lane.
    reset();
    if(rows.length===30){const sample=rows.slice(1),wallS=(rows.at(-1).wall-rows[0].wall)/1000,simulationS=sample.reduce((s,x)=>s+x.dt,0),distance=sample.reduce((s,x)=>s+x.distance,0);
     resolve({frames:sample.length,wallS,simulationS,ratio:simulationS/wallS,distance,wallSpeedMps:distance/wallS,meanFps:sample.length/wallS,minDt:Math.min(...sample.map(x=>x.dt)),maxDt:Math.max(...sample.map(x=>x.dt)),rows:sample});}
   });
   resumeGame();
  }));
  await page.evaluate(()=>advanceTime(0));
  assert(report.travel.maxDt>.125,'Exercise frame times longer than the old 100 ms cap');
  assert(report.travel.meanFps<8,'Exercise fewer than 8 frames per second');
  assert(report.travel.ratio>.88,'Simulation should retain elapsed wall time at low frame rates');
  assert(report.travel.wallSpeedMps>12,'Bay must really travel faster than 12 m/s at low frame rates');
  assert(report.travel.rows.every(r=>r.finite&&r.gait==='gallop'&&r.heroRate>0&&r.heroRate<=2+1e-7),'Finite gallop with bounded cadence');

  // A thin wall and a small solid obstacle lie less than one slow frame ahead.
  // End-position-only collision tests can tunnel past them at these speeds.
  for(const kind of ['wall','solid']){
   report[kind]=await page.evaluate(kind=>new Promise(resolve=>{
    const G=__features,p=G.horse.player,r=G.horse.RIG(),lane=window.__frameQaLane,dx=Math.sin(lane.heading),dz=Math.cos(lane.heading),ahead=1.25;
    const cx=lane.x+dx*ahead,cz=lane.z+dz*ahead;
    const obstacle=kind==='wall'?{x1:cx-dz*3,z1:cz+dx*3,x2:cx+dz*3,z2:cz-dx*3}:{x:cx,z:cz,r:.2};
    const list=kind==='wall'?G.world.walls:G.world.colliders;list.push(obstacle);
    const rows=[];let done=false;
    p.pos.set(lane.x,0,lane.z);p.heading=lane.heading;p.y=0;p.vy=0;p.flying=false;p.stam=1;p.blown=false;p.speed=15;p.boostT=0;r.heroJumpAge=null;r.heroJumpGrace=0;
    G.on('tick',dt=>{
     if(done)return;
     rows.push({dt,along:(p.pos.x-lane.x)*dx+(p.pos.z-lane.z)*dz,speed:p.speed,y:p.y,finite:r.bones.every(b=>b.matrixWorld.elements.every(Number.isFinite))});
     if(rows.length===8){done=true;list.splice(list.indexOf(obstacle),1);resolve({ahead,contactRadius:kind==='wall'?.65:.75,rows});}
    });
    resumeGame();
   }),kind);
   await page.evaluate(()=>advanceTime(0));
   const result=report[kind];assert(result.rows.some(r=>r.dt>.125),kind+' test uses large frame delta');
   assert(result.rows.every(r=>r.finite&&r.y===0),kind+' grounded finite horse');
   assert(Math.max(...result.rows.map(r=>r.along))<=result.ahead-result.contactRadius+.04,kind+' blocks fast horse without tunneling');
  }
  assert.equal(errors.length,0,errors.join('\n'));
  console.log(JSON.stringify({travel:{meanFps:report.travel.meanFps,simulationRatio:report.travel.ratio,wallSpeedMps:report.travel.wallSpeedMps},wall:report.wall.rows,solid:report.solid.rows}));
 }finally{
  await page.keyboard.up('ArrowUp').catch(()=>{});await page.keyboard.up('Shift').catch(()=>{});
  fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,process.env.QA_REPORT||'frame-time-report.json'),JSON.stringify({...report,errors},null,2));await browser.close();
 }
})().catch(e=>{console.error(e);process.exitCode=1;});

/* Mounted gait pace and distance regression in a temporary browser save.
 * Uses real riding keys and controlled game time; never opens the player's save.
 * QA_URL selects the checkout/deployment, QA_HORSES can narrow the horse list. */
const QA=require('./qa-platform.cjs'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const output=path.join(__dirname,'../review/native-fast-travel');
(async()=>{
 const browser=await QA.chromium.launch({headless:true,args:QA.gpuArgs()});
 const page=await browser.newPage({viewport:{width:1280,height:850}}),errors=[],report={movementPolicy:'Faster game travel with bounded visual cadence; hoof contact is not claimed to match translation.',mounts:[]};
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error'&&/Shader Error|VALIDATE_STATUS|ERROR: 0:/.test(m.text()))errors.push(m.text());});
 const release=async()=>{for(const key of ['ArrowUp','Control','Alt','Shift','Space'])await page.keyboard.up(key);};
 try{
  await page.goto(QA.BASE+'/ranch3d.html?qa=native-fast-travel',{timeout:120000});
  await page.waitForFunction(()=>window.__features?.installed?.includes('native-horses')&&__features.horse.RIG().ready,null,{timeout:120000});
  report.lane=await page.evaluate(()=>{
   const G=__features;advanceTime(0);G.hidePanels();
   // Pick an unobstructed 12 m line in the starting arena. Keep collision handling
   // active so distance is measured from actual player travel, not speed alone.
   const wallDistance=(x,z,w)=>{const dx=w.x2-w.x1,dz=w.z2-w.z1,t=Math.max(0,Math.min(1,((x-w.x1)*dx+(z-w.z1)*dz)/(dx*dx+dz*dz)));return Math.hypot(x-w.x1-dx*t,z-w.z1-dz*t);};
   for(const heading of [0,Math.PI/2,Math.PI,-Math.PI/2])for(let x=-16;x<=12;x+=4)for(let z=-20;z<=12;z+=4){
    const heights=[];let clear=true;
    for(let d=0;d<=12;d+=.4){const px=x+Math.sin(heading)*d,pz=z+Math.cos(heading)*d;heights.push(G.world.groundH(px,pz));
     if(G.world.colliders.some(c=>Math.hypot(px-c.x,pz-c.z)<c.r+1.1)||G.world.walls.some(w=>wallDistance(px,pz,w)<1.1)){clear=false;break;}}
    if(clear&&Math.max(...heights)-Math.min(...heights)<.35){window.__speedQaLane={x,z,heading};return window.__speedQaLane;}
   }
   throw Error('No clear speed QA lane in the starting arena');
  });
  async function mount(key){
   await release();
   const index=await page.evaluate(key=>{
    const G=__features;G.save.sync(s=>G.horse.grantHorse(s,key,{name:'Riding Speed QA',level:30,stats:{speed:3,accel:3,stamina:3,jump:3,agility:3}}));
    G.horse.reloadHorses();G.horse.rebuildAll();G.hidePanels();return G.horse.myHorses.findIndex(h=>h.breed===key);
   },key);
   await page.selectOption('#horseSel',String(index),{force:true});
   // Allow async attachment to run, then keep all movement on the test clock.
   await page.waitForFunction(key=>{const G=__features,r=G.horse.RIG();return r.requestedBreed===key&&!r.loadingBreed&&r.ready&&r.attachedTo===G.horse.player.mesh;},key,{timeout:90000});
   await page.evaluate(()=>{advanceTime(0);const G=__features,h=G.horse.ridden();h.pers='relaxed';h.gear={};G.hidePanels();});
  }
  async function ride(modifier,{stat=3,boost=0,sampleMs=500,stamina=1,blown=false}={}){
   await release();
   await page.evaluate(({stat,boost,stamina,blown})=>{
    const G=__features,p=G.horse.player,h=G.horse.ridden(),lane=window.__speedQaLane;
    Object.assign(h.stats,{speed:stat,accel:3,stamina:3});h.pers='relaxed';h.gear={};
    p.pos.set(lane.x,0,lane.z);p.heading=lane.heading;p.speed=0;p.y=0;p.vy=0;p.flying=false;p.stam=stamina;p.blown=blown;p.boostT=boost;
    G.hidePanels();advanceTime(20);
   },{stat,boost,stamina,blown});
   await page.keyboard.down('ArrowUp');if(modifier)await page.keyboard.down(modifier);
   const row=await page.evaluate(({sampleMs,keepExhausted})=>{
    const G=__features,p=G.horse.player,r=G.horse.RIG(),lane=window.__speedQaLane;
    // Reset position between warm-up pieces; the measured interval below is
    // continuous and stays wholly inside the clear line even at maximum pace.
    // Keep an exhaustion fixture below recovery-perk thresholds during warmup.
    // Long speed suites can earn Second Wind before reaching this final case.
    for(let i=0;i<8;i++){if(keepExhausted){p.stam=.03;p.blown=true;}advanceTime(500);p.pos.set(lane.x,0,lane.z);p.heading=lane.heading;}
    if(keepExhausted){p.stam=.03;p.blown=true;}
    const start=p.pos.clone(),startStamina=p.stam;advanceTime(sampleMs);
    const gait=r.heroMotion.mode,key=['canter','gallop'].includes(gait)?gait+'Left':gait;
    const nominal=r.profile.nativeGaits[key]?.nominalSpeedMps,scale=r.scene.getWorldScale(new G.THREE.Vector3()).z;
    return{gait,speed:p.speed,heroRate:r.heroRate,nominal,scale,sourceSpeed:nominal*scale,previousSpeed:nominal*scale*({walk:1.35,trot:1.5,canterLeft:1.6,gallopLeft:1.8}[key]||1),distance:p.pos.distanceTo(start),elapsedS:sampleMs/1000,startStamina,stamina:p.stam,blown:p.blown,
     finite:r.bones.every(b=>b.matrixWorld.elements.every(Number.isFinite)),boneCount:r.bones.length,boostRemaining:p.boostT,effectiveStats:G.xp.effStats(G.horse.ridden())};
   },{sampleMs,keepExhausted:blown});
   await release();return row;
  }
  if(process.env.QA_CASE!=='exhaustion'){
  for(const key of process.env.QA_HORSES?.split(',')||['bay','white-western','welsh']){
   await mount(key);const row={key,gaits:[]};report.mounts.push(row);
   for(const [modifier,gait]of [['Control','walk'],['Alt','trot'],[null,'canter'],['Shift','gallop']]){
    const state=await ride(modifier);row.gaits.push({modifier,...state});
    assert.equal(state.gait,gait,key+' requested '+gait);assert(state.finite,key+' finite '+gait);assert.equal(state.boneCount,677,key+' rig');
    assert(state.speed>state.previousSpeed*1.1,key+' '+gait+' should be appreciably faster than release 4420a33');
    assert(state.distance>state.previousSpeed*state.elapsedS*1.1,key+' '+gait+' actual distance must improve');
    if(gait==='canter')assert(state.speed>6,key+' canter should exceed 6 m/s');
    if(gait==='gallop')assert(state.speed>12,key+' gallop should exceed 12 m/s');
    assert(state.heroRate>0,key+' positive cadence');
    assert(state.heroRate<=2+1e-7,key+' bounded cadence');
    assert(Math.abs(state.distance/state.elapsedS-state.speed)<.06,key+' '+gait+' movement is unblocked');
    if(gait==='gallop')assert(state.stamina<state.startStamina-.01,key+' native gallop drains stamina below old numeric threshold');
   }
   row.stop=await page.evaluate(()=>{const G=__features;advanceTime(4500);const r=G.horse.RIG(),p=G.horse.player;return{speed:p.speed,gait:r.heroMotion.mode,finite:r.bones.every(b=>b.matrixWorld.elements.every(Number.isFinite))};});
   assert.equal(row.stop.speed,0,key+' stops');assert.equal(row.stop.gait,'stand',key+' standing');assert(row.stop.finite);
   await page.keyboard.down('Space');await page.evaluate(()=>advanceTime(20));await page.keyboard.up('Space');
   row.jump=await page.evaluate(()=>{const G=__features,r=G.horse.RIG(),p=G.horse.player,samples=[];
    for(let i=0;i<110;i++){advanceTime(1000/60);samples.push({gait:r.heroMotion.mode,y:p.y,finite:r.bones.every(b=>b.matrixWorld.elements.every(Number.isFinite))});}
    return{started:samples.some(s=>s.gait==='jump'),peak:Math.max(...samples.map(s=>s.y)),last:samples.at(-1),finite:samples.every(s=>s.finite)};});
   assert(row.jump.started&&row.jump.peak>.3,key+' jump takeoff');assert(row.jump.finite,key+' jump finite');assert.equal(row.jump.last.y,0,key+' jump lands');assert.equal(row.jump.last.gait,'stand',key+' one-shot jump recovery');
   console.log(key+': faster walk/trot/canter/gallop, bounded visual cadence, stamina, stop and jump passed');
  }
  await mount('bay');report.modifiers={low:await ride('Shift',{stat:1}),high:await ride('Shift',{stat:10}),boost:await ride('Shift',{stat:1,boost:10})};
  assert(report.modifiers.high.speed>report.modifiers.low.speed*1.1,'Speed stat increases native gallop');
  assert(report.modifiers.boost.speed>report.modifiers.low.speed*1.1,'Boost increases native gallop');
  for(const state of Object.values(report.modifiers)){assert.equal(state.gait,'gallop');assert(state.finite);assert(state.heroRate<=2+1e-7);assert(state.heroRate>0);}
  console.log('Native riding speed stats and boost passed');
  }
  await mount('bay');report.exhaustion=await ride('Shift',{stamina:.03,blown:true});
  report.exhaustion.canterLimit=await page.evaluate(async()=>{const {getNativeHorseCapabilities}=await import('./assets/native-horse-motion.js?v=fast-travel-1');return getNativeHorseCapabilities(__features.horse.RIG()).gaitSpeeds.canterLeft;});
  assert(report.exhaustion.blown,'Exhaustion remains active during the sample');
  assert.equal(report.exhaustion.gait,'canter','Exhausted Shift input should use a canter animation');
  assert(report.exhaustion.speed<=report.exhaustion.canterLimit+1e-6,'Exhausted horse stays at or below its canter limit');
  assert(report.exhaustion.speed>6,'Exhausted horse can still travel at a playable canter');
  assert(report.exhaustion.finite&&report.exhaustion.heroRate>0&&report.exhaustion.heroRate<=2,'Exhausted motion remains finite with bounded cadence');
  assert.equal(errors.length,0,errors.join('\n'));console.log('Exhausted Bay canter selection and speed limit passed');
 }finally{
  await release().catch(()=>{});fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,process.env.QA_REPORT||(process.env.QA_CASE==='exhaustion'?'exhaustion-report.json':'runtime-report.json')),JSON.stringify({...report,errors},null,2));await browser.close();
 }
})().catch(error=>{console.error(error);process.exitCode=1;});

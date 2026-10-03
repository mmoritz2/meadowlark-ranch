/* Real mounted tack benefits in an isolated browser save. Only tackAct is
 * exposed through a QA-only route; riding, physics, persistence and animation
 * use the production game. QA_URL selects a local checkout or deployment. */
const QA=require('./qa-platform.cjs'),fs=require('node:fs'),path=require('node:path');
const out=path.resolve(__dirname,'../review/tack-stats');
const report={base:QA.BASE,isolatedSave:true,qaOnlyInjection:['tackAct'],checks:[],errors:[]};
const check=(name,ok,detail)=>{report.checks.push({name,ok:!!ok,...(detail?{detail}:{})});console.log((ok?'PASS ':'FAIL ')+name);};
let browser;
(async()=>{
 browser=await QA.chromium.launch({headless:true,args:QA.gpuArgs()});
 const page=await browser.newPage({viewport:{width:1280,height:850}});
 page.on('pageerror',e=>report.errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error'&&/Shader Error|VALIDATE_STATUS|ERROR: 0:/.test(m.text()))report.errors.push(m.text());});
 await page.route('**/ranch3d.html*',async route=>{const response=await route.fetch(),html=await response.text(),marker='const MERGE_STATS=mergeStatics();';if(!html.includes(marker))throw Error('QA marker missing');await route.fulfill({response,body:html.replace(marker,'window.__tackQA={tackAct};'+marker)});});
 const release=async()=>{for(const key of ['ArrowUp','Control','Alt','Shift','Space'])await page.keyboard.up(key);};
 const ready=()=>page.waitForFunction(()=>window.__tackQA&&window.__features?.horse.RIG().ready&&!__features.horse.RIG().loadingBreed,null,{timeout:120000});
 async function flightSmoke(){
  const dragonIndex=await page.evaluate(()=>{const G=__features;advanceTime(0);G.wardrobe?.closeChar?.();G.hidePanels();G.save.sync(s=>{if(s.rider)s.rider.made=true;G.horse.grantHorse(s,'european-dragon',{name:'Tack Flight QA',level:30});});G.horse.reloadHorses();G.horse.rebuildAll();return G.horse.myHorses.findIndex(h=>h.name==='Tack Flight QA');});
  await page.selectOption('#horseSel',String(dragonIndex),{force:true});await page.waitForFunction(()=>{const G=__features,r=G.horse.RIG();return r.ready&&!r.loadingBreed&&r.modelKey==='european-dragon'&&r.attachedTo===G.horse.player.mesh;},null,{timeout:90000});
  await page.evaluate(()=>{const G=__features,p=G.horse.player;document.activeElement?.blur();p.pos.set(-3,0,-3);p.speed=0;p.y=0;p.vy=0;p.flying=false;p.landing=false;G.wardrobe?.closeChar?.();G.hidePanels();advanceTime(700);});
  report.beforeFlight=await page.evaluate(()=>{const G=__features,r=G.horse.RIG(),p=G.horse.player,el=document.getElementById('flyBtn'),rect=el.getBoundingClientRect();return{breed:G.horse.ridden().breed,wings:G.horse.ridden().wings,modelKey:r.modelKey,nativeCanFly:r.profile.nativeCanFly,onFoot:p.onFoot,flying:p.flying,button:el.textContent,hit:document.elementFromPoint(rect.x+rect.width/2,rect.y+rect.height/2)?.outerHTML};});
  await page.locator('#flyBtn').click({timeout:15000});report.afterFlightClick=await page.evaluate(()=>({flying:__features.horse.player.flying,flyAlt:__features.horse.player.flyAlt}));await page.evaluate(()=>advanceTime(1800));report.flight=await page.evaluate(()=>{const G=__features,r=G.horse.RIG(),p=G.horse.player;return{flying:p.flying,altitude:p.y,motion:r.heroMotion.mode,bones:r.bones.length,finite:r.bones.every(b=>b.matrixWorld.elements.every(Number.isFinite))};});check('Dragon Fly button still starts finite native flight',report.flight.flying&&report.flight.altitude>1&&report.flight.motion==='fly'&&report.flight.bones===169&&report.flight.finite);
 }
 try{
  await page.goto(QA.BASE+'/ranch3d.html?qa=tack-performance',{timeout:120000});await ready();
  if(process.env.QA_MODE==='flight'){await flightSmoke();check('No browser errors',report.errors.length===0);if(report.checks.some(c=>!c.ok))process.exitCode=1;return;}
  const index=await page.evaluate(()=>{
   advanceTime(0);const G=__features;G.wardrobe?.closeChar?.();G.hidePanels();
   G.save.sync(s=>{if(s.rider)s.rider.made=true;G.horse.grantHorse(s,'white-western',{name:'Tack Performance QA',level:30,stats:{speed:8,stamina:8,jump:8,accel:8,agility:8}});const h=s.horses.at(-1);h.pers='relaxed';h.bond=100;h.bondDay={date:new Date().toDateString(),n:100};h.gear={};h.needs={hunger:100,thirst:100,clean:100,happy:100};s.coins=1000000;s.items={...s.items,kit1:50,kit2:50,kit3:50};
    const common=(stat,slot,id,lvl=1)=>{let item;for(let n=0;n<1000;n++){item=G.horse.genGear('Common',slot);if(item.primary===stat)break;}if(item.primary!==stat)throw Error('Could not generate '+stat+' fixture');item.id=id;item.lvl=lvl;s.tack.push(item);};
    s.tack=s.tack||[];common('speed','shoes','qa-speed');common('stamina','pad','qa-stamina');common('jump','pad','qa-jump',8);
    for(const [set,prefix,level,merged]of[['Kestrel','qa-fast',1,0],['Meadowlark','qa-endurance',8,3]])for(const slot of G.tables.GEAR_SLOTS){const item=G.horse.genGear('Legendary',slot,{set,style:'western'});item.id=prefix+'-'+slot;item.lvl=level;item.merged=merged;item.bonus[item.primary]+=merged;s.tack.push(item);}
   });G.horse.reloadHorses();G.horse.rebuildAll();return G.horse.myHorses.findIndex(h=>h.name==='Tack Performance QA');
  });
  await page.selectOption('#horseSel',String(index),{force:true});
  await page.waitForFunction(()=>{const G=__features,r=G.horse.RIG();return r.ready&&!r.loadingBreed&&r.modelKey==='white-western'&&r.attachedTo===G.horse.player.mesh;},null,{timeout:90000});
  report.lane=await page.evaluate(()=>{
   advanceTime(0);const G=__features;G.wardrobe?.closeChar?.();G.hidePanels();if(G.ranch)G.ranch.tackFor=null;
   const dist=(x,z,w)=>{const dx=w.x2-w.x1,dz=w.z2-w.z1,t=Math.max(0,Math.min(1,((x-w.x1)*dx+(z-w.z1)*dz)/(dx*dx+dz*dz)));return Math.hypot(x-w.x1-dx*t,z-w.z1-dz*t);};
   for(const heading of [0,Math.PI/2,Math.PI,-Math.PI/2])for(let x=-16;x<=12;x+=4)for(let z=-20;z<=12;z+=4){const heights=[];let clear=true;for(let d=0;d<=12;d+=.4){const px=x+Math.sin(heading)*d,pz=z+Math.cos(heading)*d;heights.push(G.world.groundH(px,pz));if(G.world.colliders.some(c=>Math.hypot(px-c.x,pz-c.z)<c.r+1.1)||G.world.walls.some(w=>dist(px,pz,w)<1.1)){clear=false;break;}}if(clear&&Math.max(...heights)-Math.min(...heights)<.35){window.__tackLane={x,z,heading};return __tackLane;}}
   throw Error('No unobstructed tack QA lane');
  });
  const state=()=>page.evaluate(()=>{const G=__features,h=G.horse.ridden(),r=G.horse.RIG(),item=id=>G.save.fresh().tack.find(t=>t.id===id);return{horseId:h.id,base:{...h.stats},bond:h.bond,pers:h.pers,gear:{...h.gear},effective:G.xp.effStats(h),breakdown:G.xp.statBreakdown?.(h)||null,speedItem:item('qa-speed'),boneCount:r.bones.length,jumpDefinition:JSON.stringify(r.profile.nativeJump)};});
  const act=async command=>{await release();await page.evaluate(command=>{__tackQA.tackAct(command);__features.hidePanels();},command);};
  const bare=async()=>{for(const slot of ['saddle','pad','bridle','shoes'])await act('off:'+slot);};
  async function ride({drainSeconds=0}={}){
   await release();await page.evaluate(()=>{const G=__features,p=G.horse.player,h=G.horse.ridden(),l=__tackLane;h.bond=100;h.pers='relaxed';p.pos.set(l.x,0,l.z);p.heading=l.heading;p.speed=0;p.y=0;p.vy=0;p.flying=false;p.landing=false;p.stam=.9;p.blown=false;p.boostT=0;p.exhaustT=0;p.onFoot=false;G.hidePanels();advanceTime(20);});
   await page.keyboard.down('ArrowUp');await page.keyboard.down('Shift');
   const row=await page.evaluate(drainSeconds=>{const G=__features,p=G.horse.player,r=G.horse.RIG(),l=__tackLane;for(let n=0;n<60;n++){advanceTime(100);p.pos.set(l.x,0,l.z);p.heading=l.heading;}
    const start=p.pos.clone();advanceTime(250);const distance=p.pos.distanceTo(start),speed=p.speed;p.stam=.8;const stamina=[];for(let n=0;n<Math.round(drainSeconds*60);n++){p.pos.set(l.x,0,l.z);advanceTime(1000/60);stamina.push(p.stam);}return{speed,distance,elapsedS:.25,gait:r.heroMotion.mode,heroRate:r.heroRate,effective:G.xp.effStats(G.horse.ridden()),base:{...G.horse.ridden().stats},bond:G.horse.ridden().bond,pers:G.horse.ridden().pers,staminaStart:.8,staminaEnd:p.stam,staminaSamples:stamina,boneCount:r.bones.length,finite:r.bones.every(b=>b.matrixWorld.elements.every(Number.isFinite))};},drainSeconds);await release();return row;
  }
  await bare();report.fixture=await state();report.speed={bare:await ride()};
  await act('on:qa-speed');report.speed.level1=await ride();report.beforeUpgrade=await state();await act('up:qa-speed');report.afterUpgrade=await state();report.speed.level2=await ride();
  check('Every first upgrade adds a primary stat benefit',report.afterUpgrade.speedItem.lvl===2&&report.afterUpgrade.effective.speed>report.beforeUpgrade.effective.speed);
  check('Speed tack increases actual gallop travel at the horse breed cap (8)',report.speed.level1.speed>report.speed.bare.speed+.05&&report.speed.level1.distance>report.speed.bare.distance+.01);
  check('Upgrading equipped speed tack increases actual travel again',report.speed.level2.speed>report.speed.level1.speed+.025&&report.speed.level2.distance>report.speed.level1.distance+.005);
  for(let n=0;n<4;n++)await act('on:qa-speed');report.repeated=await state();check('Repeated equip does not stack bonuses',JSON.stringify(report.repeated.effective)===JSON.stringify(report.afterUpgrade.effective));
  await bare();report.speed.unequipped=await ride();check('Unequipping restores baseline speed and distance',Math.abs(report.speed.unequipped.speed-report.speed.bare.speed)<.015&&Math.abs(report.speed.unequipped.distance-report.speed.bare.distance)<.015);
  for(const slot of ['saddle','pad','bridle','shoes'])await act('on:qa-fast-'+slot);report.speed.highBefore=await ride();await act('up:qa-fast-saddle');report.speed.highAfter=await ride();
  check('Upgrades still improve travel above the trained-stat cap',report.speed.highBefore.effective.speed>20&&report.speed.highAfter.speed>report.speed.highBefore.speed+.02&&report.speed.highAfter.distance>report.speed.highBefore.distance+.005);
  await bare();report.stamina={bare:await ride({drainSeconds:2})};await act('on:qa-stamina');report.stamina.geared=await ride({drainSeconds:2});check('Stamina tack reduces actual gallop drain',report.stamina.geared.staminaEnd>report.stamina.bare.staminaEnd+.001&&report.stamina.geared.staminaEnd<.8);
  await bare();for(const slot of ['saddle','pad','bridle','shoes'])await act('on:qa-endurance-'+slot);report.stamina.legendary=await ride({drainSeconds:2});const st=report.stamina.legendary;check('Maximum legal Legendary stamina gear cannot regenerate while galloping',st.effective.stamina>40&&st.staminaEnd<.8-1e-6&&st.staminaSamples.every((x,i,a)=>i===0||x<=a[i-1]+1e-10));
  async function jump({removeMidair=false}={}){
   await release();await page.evaluate(()=>{const G=__features,p=G.horse.player,r=G.horse.RIG(),l=__tackLane;p.pos.set(l.x,0,l.z);p.heading=l.heading;p.speed=0;p.y=0;p.vy=0;p.flying=false;p.stam=.9;p.blown=false;p.boostT=0;r.heroMotion.reset();r.heroJumpAge=null;r.heroJumpExtra=0;r.heroJumpHeld=false;G.hidePanels();advanceTime(700);});
   await page.keyboard.down('Space');await page.evaluate(()=>advanceTime(1000/120));await page.keyboard.up('Space');
   return page.evaluate(removeMidair=>{const G=__features,r=G.horse.RIG(),p=G.horse.player,samples=[],clip=r.heroMotion.mixer._actions.map(a=>a.getClip()).find(c=>c.name===r.profile.nativeJump.clip);let hash=2166136261;for(const t of clip.tracks)for(const values of [t.times,t.values])for(const byte of new Uint8Array(values.buffer,values.byteOffset,values.byteLength))hash=Math.imul(hash^byte,16777619)>>>0;for(let n=0;n<240;n++){if(removeMidair&&n===10){__tackQA.tackAct('off:pad');G.hidePanels();}advanceTime(1000/120);samples.push({time:r.heroMotion.time,gait:r.heroMotion.mode,clip:r.heroMotion.clip,y:p.y,finite:r.bones.every(b=>b.matrixWorld.elements.every(Number.isFinite))});}return{peak:Math.max(...samples.map(s=>s.y)),last:samples.at(-1),started:samples.some(s=>s.gait==='jump'),clipHash:hash,clipDuration:clip.duration,definition:JSON.stringify(r.profile.nativeJump),finite:samples.every(s=>s.finite),samples};},removeMidair);
  }
  await bare();report.jump={bare:await jump()};await act('on:qa-jump');report.jump.geared=await jump();check('Jump tack raises the native actor lift',report.jump.geared.peak>report.jump.bare.peak*1.025);
  report.jump.removedMidair=await jump({removeMidair:true});report.jump.unequipped=await jump();check('Jump height is captured at takeoff',Math.abs(report.jump.removedMidair.peak-report.jump.geared.peak)<.003);check('Unequipping restores the next jump height',Math.abs(report.jump.unequipped.peak-report.jump.bare.peak)<.003);
  check('Jump gear preserves source clips and landing baseline',Object.values(report.jump).every(j=>j.started&&j.finite&&j.last.y===0&&j.last.gait==='stand'&&j.clipHash===report.jump.bare.clipHash&&j.definition===report.jump.bare.definition));
  await act('on:qa-speed');report.beforeReload=await state();await page.reload({waitUntil:'load',timeout:120000});await ready();await page.waitForFunction(()=>__features.horse.ridden().name==='Tack Performance QA'&&__features.horse.RIG().modelKey==='white-western',null,{timeout:90000});report.afterReload=await state();check('Equipped upgrade persists across reload without stacking',report.afterReload.horseId===report.beforeReload.horseId&&report.afterReload.gear.shoes==='qa-speed'&&report.afterReload.speedItem.lvl===2&&JSON.stringify(report.afterReload.effective)===JSON.stringify(report.beforeReload.effective));
  check('Base stats, personality and bond remain fixed through tack changes',Object.values(report.speed).every(s=>JSON.stringify(s.base)===JSON.stringify(report.fixture.base)&&s.pers===report.fixture.pers&&s.bond===report.fixture.bond));
  check('Actual movement stays unblocked and finite',Object.values(report.speed).every(s=>s.finite&&s.boneCount===677&&Math.abs(s.distance/.25-s.speed)<.08));
  await flightSmoke();
  check('No browser errors',report.errors.length===0);
 }finally{await release().catch(()=>{});fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,process.env.QA_REPORT||'performance-report.json'),JSON.stringify(report,null,2));await browser.close();browser=null;}
 if(report.checks.some(c=>!c.ok))process.exitCode=1;
})().catch(error=>{report.failure=error.stack;fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,process.env.QA_REPORT||'performance-report.json'),JSON.stringify(report,null,2));console.error(error);process.exitCode=1;});

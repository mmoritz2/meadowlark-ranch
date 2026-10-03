// Exercise the real catalog, mounted controls, save reload, herd and remote rigs.
// The browser context is disposable; no player save is touched.
const QA=require('./qa-platform.cjs'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const out=path.resolve(process.argv[2]||'output/dragon-roster');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await QA.chromium.launch({headless:true,args:QA.gpuArgs()}),page=await browser.newPage({viewport:{width:1120,height:800}});
 const report={checks:{},dragons:[],errors:[]};page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 const snapshot=()=>page.evaluate(()=>{const G=__features,r=G.horse.RIG(),p=G.horse.player;return {key:r.modelKey,base:r.profile.dragonBaseModel||r.modelKey,kind:r.profile.nativeKind,joints:r.bones.length,motion:r.heroMotion?.mode,phase:r.heroMotion?.state.phase01,flying:!!p.flying,altitude:p.y,finite:r.bones.every(b=>b.matrixWorld.elements.every(Number.isFinite)),breath:G.horse.breathInspect(),palette:r.materials.filter(m=>m.userData.dragonPalette).map(m=>({name:m.name,body:m.userData.dragonPalette.body.value.getHexString(),accent:m.userData.dragonPalette.accent.value.getHexString()})),oldWings:!!p.parts.wings?.some(w=>w.visible),oldCrest:!!p.parts.crest?.visible,horseTack:!!G.horse.TACK().saddle?.visible};});
 const capture=async name=>{await page.evaluate(()=>{const G=__features,p=G.horse.player,r=G.horse.RIG();r.scene.updateWorldMatrix(true,true);const box=new G.THREE.Box3().setFromObject(r.scene,true);box.union(new G.THREE.Box3().setFromObject(p.rider.g,true));const size=box.getSize(new G.THREE.Vector3()),center=box.getCenter(new G.THREE.Vector3()),d=Math.max(size.x,size.y,size.z,4)*1.15;G.camera.position.copy(center).add(new G.THREE.Vector3(-1,.3,.85).normalize().multiplyScalar(d));G.camera.lookAt(center);G.renderer.domElement.setAttribute("data-qa-dragon-render","true");G.renderer.render(G.scene,G.camera);});await page.locator('[data-qa-dragon-render]').screenshot({path:path.join(out,name+'.png')});};
 try{
  await page.goto(QA.BASE+'/ranch3d.html?qa=dragon-roster',{timeout:120000});await page.waitForFunction(()=>window.__features?.installed?.includes('native-horses')&&__features.horse.RIG().ready,null,{timeout:120000});
  const roster=await page.evaluate(()=>{advanceTime(0);const G=__features;G.hidePanels();const rows=G.tables.BREEDS3.filter(b=>b[7]?.dragon),keys=rows.map(b=>b[0]).concat(['black-dragon-native','european-dragon']);G.save.sync(s=>{for(const key of keys){G.horse.grantHorse(s,key,{name:'Saved '+key,level:23});const h=s.horses.at(-1);h.hitch='qa';h.out=false;h.egg=false;} });G.horse.reloadHorses();return {keys,legacy:rows.length,before:G.save.fresh().horses.map(h=>({id:h.id,breed:h.breed,name:h.name,level:h.level,stats:h.stats})),profiles:rows.map(b=>({key:b[0],native:G.horse.breedModels.profile(b[0]).nativeDragon,kind:G.horse.breedModels.profile(b[0]).nativeKind}))};});
  report.roster=roster;assert.equal(roster.legacy,13);assert(roster.profiles.every(p=>p.native&&p.kind!=='horse'));report.checks.allLegacyDragonsMapped=true;
  for(const key of process.env.QA_DRAGONS?.split(',')||roster.keys){
   const i=await page.evaluate(key=>__features.horse.myHorses.findIndex(h=>h.breed===key),key);await page.selectOption('#horseSel',String(i),{force:true});
   await page.waitForFunction(key=>{const G=__features,r=G.horse.RIG();return r.modelKey===key&&r.ready&&!r.loadingBreed&&r.attachedTo===G.horse.player.mesh;},key,{timeout:120000});
   await page.evaluate(()=>{const G=__features,p=G.horse.player;document.activeElement?.blur();p.pos.set(-3,0,-3);p.heading=0;p.speed=0;p.flying=false;p.landing=false;p.y=0;p.vy=0;G.hidePanels();advanceTime(700);});
   const row={key,idle:await snapshot()};report.dragons.push(row);
   assert(row.idle.finite&&[169,232].includes(row.idle.joints));assert(!row.idle.oldWings&&!row.idle.oldCrest&&!row.idle.horseTack);assert(row.idle.breath.anchored);
   await page.keyboard.down('b');await page.evaluate(()=>advanceTime(300));row.breath=await snapshot();assert(row.breath.breath.active&&row.breath.breath.particles>0);await capture(key+'-breath');await page.keyboard.up('b');await page.evaluate(()=>advanceTime(50));assert(!(await snapshot()).breath.active);
   await page.locator('#flyBtn').click({force:true});await page.evaluate(()=>advanceTime(1800));row.flight=await snapshot();assert(row.flight.flying&&row.flight.altitude>1&&row.flight.motion==='fly');
   await page.keyboard.down('b');await page.evaluate(()=>advanceTime(300));row.flightBreath=await snapshot();assert(row.flightBreath.breath.active&&row.flightBreath.breath.particles>0&&row.flightBreath.finite);await page.keyboard.up('b');
   if(['emberdrake','stormdrake','polarisdrake'].includes(key))await capture(key+'-flight');
   await page.locator('#flyBtn').click({force:true});await page.evaluate(()=>advanceTime(6000));row.landed=await snapshot();assert(!row.landed.flying&&row.landed.altitude===0&&row.landed.motion==='stand');
   assert(!row.landed.breath.active);report.checks[key]=true;console.log(key+': native rig, elemental breath, flight and landing passed');
  }
  report.checks.saveIdentityPreserved=await page.evaluate(before=>{const G=__features;G.horse.reloadHorses();return before.every(h=>{const now=G.horse.myHorses.find(x=>x.id===h.id);return now&&now.breed===h.breed&&now.name===h.name&&now.level===h.level&&JSON.stringify(now.stats)===JSON.stringify(h.stats);});},roster.before);assert(report.checks.saveIdentityPreserved);
  // Pointer hold and release, with the new European Dragon selected.
  await page.locator('#breathBtn').dispatchEvent('pointerdown');await page.evaluate(()=>advanceTime(150));assert((await snapshot()).breath.active);await page.locator('#breathBtn').dispatchEvent('pointerup');await page.evaluate(()=>advanceTime(50));assert(!(await snapshot()).breath.active);report.checks.pointerBreath=true;
  // Existing saved dragons in the pasture also instantiate the replacement rigs.
  await page.evaluate(()=>{const G=__features;G.save.sync(s=>{for(const h of s.horses)if(['emberdrake','stormdrake'].includes(h.breed)){delete h.hitch;h.out=true;}});G.horse.reloadHorses();G.horse.rebuildAll();advanceTime(300);});
  await page.waitForFunction(()=>{const G=__features;return ['emberdrake','stormdrake'].every(key=>G.horse.herd().some(e=>G.horse.myHorses[e.idx]?.breed===key&&e.rig?.profile.nativeDragon));},null,{timeout:60000});
  report.checks.pastureReplacements=await page.evaluate(()=>__features.horse.herd().filter(e=>['emberdrake','stormdrake'].includes(__features.horse.myHorses[e.idx]?.breed)).every(e=>e.rig.nativeBreath&&!e.rig.nativeFantasy&&e.rig.bones.length!==677));assert(report.checks.pastureReplacements);
  for(const key of ['emberdrake','stormdrake']){
   const remote=await page.evaluate(key=>{const G=__features,id='qa-replacement-'+key;G.net.onMessage('srf1/qa-isolated/pos',JSON.stringify({id,n:'Dragon QA',b:key,x:1,z:1,h:0,sp:0,y:6,fl:1}));advanceTime(600);const r=G.net.remotes[id];return {key:r.rig.key,native:r.rig.profile.nativeDragon,motion:r.rig.heroMotion.mode,bones:r.rig.bones.length,palette:!!r.rig.materials.find(m=>m.userData.dragonPalette)};},key);assert(remote.native&&remote.motion==='fly'&&remote.palette);report.checks[key+'Remote']=true;
  }
  // Horse and pegasus profiles still use their horse rigs.
  report.checks.horsesUnchanged=await page.evaluate(()=>['bay-sporthorse','pegasus'].every(key=>{const p=__features.horse.breedModels.profile(key);return p.nativeKind==='horse'&&!p.nativeDragon;}));assert(report.checks.horsesUnchanged);
  report.checks.noBrowserErrors=report.errors.length===0;assert(report.checks.noBrowserErrors,report.errors.join('\n'));
 }finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

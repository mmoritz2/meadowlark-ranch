// Real, unrouted Ranch and Studio integration check. No replacement motion or
// injected HTML: every sample reads the model and controller used by the game.
if(process.env.QA_BASE_URL&&!process.env.QA_URL)process.env.QA_URL=process.env.QA_BASE_URL;
const QA=require('./qa-platform.cjs'),fs=require('node:fs'),path=require('node:path');
const out=path.resolve(process.argv[2]||'output/native-game-qa');fs.mkdirSync(out,{recursive:true});
const models={
 'white-western':{bones:677,body:16159,modes:['rest','stand','walk','trot','canter']},
 'bay-western':{bones:677,body:16159,modes:['rest','walk']},
 'black-dragon-native':{bones:232,body:22292,modes:['rest','stand']},
 'european-dragon':{bones:169,body:21050,modes:['rest','stand','sit','walk','run','fly']}
};
(async()=>{
 const browser=await QA.chromium.launch({headless:true,args:QA.gpuArgs()}),context=await browser.newContext({viewport:{width:1440,height:960}});
 const report={base:QA.BASE,unrouted:true,checks:{},studio:[],ranch:[],errors:[]};
 const watch=(page,surface)=>{page.on('pageerror',e=>report.errors.push({surface,kind:'pageerror',text:e.message}));page.on('console',m=>{if(m.type()==='error')report.errors.push({surface,kind:'console',text:m.text()});});};
 try{
  if(process.env.QA_SURFACE!=='ranch'){
  const studio=await context.newPage();watch(studio,'studio');
  await studio.goto(QA.BASE+'/breeds.html?horse=white-western&qa=native-game',{waitUntil:'load',timeout:120000});
  for(const[key,expected]of Object.entries(models)){
   if(key!=='white-western')await studio.locator('#list button[data-key="'+key+'"]').click();
   await studio.waitForFunction(key=>{if(!window.render_game_to_text)return false;const s=JSON.parse(render_game_to_text());return s.breed===key&&s.modelReady&&!s.loading;},key,{timeout:60000});
   const options=await studio.locator('#motion option').evaluateAll(xs=>xs.map(x=>x.value));
   const samples=[];
   for(const mode of expected.modes){await studio.selectOption('#motion',mode);await studio.evaluate(()=>advanceTime(160));samples.push({mode,text:await studio.evaluate(()=>JSON.parse(render_game_to_text())),pose:await studio.evaluate(()=>breedStudioInspect())});}
   if(expected.modes.includes('canter')){await studio.selectOption('#lead','right');await studio.evaluate(()=>advanceTime(160));samples.push({mode:'canterRight',text:await studio.evaluate(()=>JSON.parse(render_game_to_text())),pose:await studio.evaluate(()=>breedStudioInspect())});}
   await studio.click('#side');await studio.screenshot({path:path.join(out,key+'-studio.png')});
   report.studio.push({key,options,samples});
   report.checks[key+'Studio']=JSON.stringify(options)===JSON.stringify(expected.modes)&&samples.every(s=>s.pose.finite&&s.pose.bones===expected.bones&&s.pose.asset.nativeBreed&&s.pose.meshes.some(m=>m.skinned&&m.vertices===expected.body))&&samples.every(s=>s.mode==='rest'||s.text.clip);
   console.log(JSON.stringify({surface:'studio',key,pass:report.checks[key+'Studio']}));
  }
  // Switch back through the same cached model without disposing shared geometry.
  await studio.locator('#list button[data-key="white-western"]').click();await studio.waitForFunction(()=>JSON.parse(render_game_to_text()).breed==='white-western'&&!JSON.parse(render_game_to_text()).loading);
  report.checks.studioSwitchBack=(await studio.evaluate(()=>breedStudioInspect())).finite;
  await studio.close();
  }
  const ranch=await context.newPage();watch(ranch,'ranch');
  await ranch.goto(QA.BASE+'/ranch3d.html?qa=native-game',{waitUntil:'load',timeout:120000});
  await ranch.waitForFunction(()=>window.__features?.installed?.includes('native-horses')&&JSON.parse(render_game_to_text()).graphics.horseReady,{timeout:120000});
  const before=await ranch.evaluate(()=>{advanceTime(1);const G=__features,s=G.save.fresh();G.ui.openShop('native-models');return{count:s.horses.length,coins:s.coins,gems:s.gems,ridden:G.horse.ridden().id,rows:G.tables.BREEDS3.filter(b=>b[7].nativeModelChoice).map(b=>({key:b[0],coins:b[3],gems:b[4],random:G.horse.breedAvailable(b,'summon')}))};});
  for(const key of Object.keys(models))await ranch.locator('[data-fx="native-horses:add:'+key+'"]').click();
  const after=await ranch.evaluate(()=>{const G=__features,s=G.save.fresh();return{count:s.horses.length,coins:s.coins,gems:s.gems,ridden:G.horse.ridden().id};});
  report.acquisition={before,after};report.checks.freeOptIn=after.count===before.count+4&&before.ridden===after.ridden&&before.coins===after.coins&&before.gems===after.gems&&before.rows.length===4&&before.rows.every(r=>r.coins===0&&r.gems===0&&!r.random);
  await ranch.evaluate(()=>__features.hidePanels());
  for(const[key,expected]of Object.entries(models)){
   const index=await ranch.evaluate(key=>__features.horse.myHorses.findIndex(h=>h.breed===key),key);await ranch.selectOption('#horseSel',String(index),{force:true});
   await ranch.waitForFunction(key=>{const r=__features.horse.RIG();return r.modelKey===key&&r.ready&&!r.loadingBreed&&r.attachedTo===__features.horse.player.mesh;},key,{timeout:60000});
   await ranch.waitForFunction(()=>!!__features.horse.player.rider?.sk,{timeout:60000});
   await ranch.evaluate(()=>{const G=__features,p=G.horse.player;p.speed=0;p.y=0;p.vy=0;p.heading=0;p.pos.set(-3,0,-3);advanceTime(200);});
   const inspect=()=>ranch.evaluate(()=>{const G=__features,r=G.horse.RIG(),p=G.horse.player,meshes=[],v=new G.THREE.Vector3();let finite=r.bones.every(b=>b.matrixWorld.elements.every(Number.isFinite));r.scene.updateMatrixWorld(true);r.scene.traverse(m=>{if(!m.isSkinnedMesh)return;m.skeleton.update();const n=m.geometry.attributes.position.count;for(const i of [0,Math.floor(n/2),n-1]){m.getVertexPosition(i,v);finite&&=v.toArray().every(Number.isFinite);}meshes.push({name:m.name,vertices:n,visible:m.visible});});return{model:r.modelKey,bones:r.bones.length,finite,meshes,motion:r.heroMotion.mode,clip:r.heroMotion.clip,state:r.heroMotion.snapshot(),profile:{hash:r.profile.sha256,max:r.profile.nativeMaxSpeedMps,gaits:Object.keys(r.profile.nativeGaits)},position:p.pos.toArray(),local:r.scene.position.toArray(),scale:r.scene.getWorldScale(new G.THREE.Vector3()).toArray(),speed:p.speed,y:p.y,vy:p.vy,skinnedBoots:Object.fromEntries(['L','R'].map(S=>{const foot=p.rider?.sk?.by?.['foot'+S],sole=foot?.userData.soleContact,tread=G.horse.TACK().saddle?.userData.stir?.[S],body=p.rider?.rig?.body;if(!sole?.vertices?.length||!tread||!body)return[S,null];body.updateMatrixWorld(true);body.skeleton.update();const mean=new G.THREE.Vector3(),q=new G.THREE.Vector3();for(const i of sole.vertices){body.getVertexPosition(i,q);mean.add(q.applyMatrix4(body.matrixWorld));}mean.multiplyScalar(1/sole.vertices.length);return[S,mean.distanceTo(tread.getWorldPosition(new G.THREE.Vector3()))];})),boots:Object.fromEntries(['L','R'].map(S=>{const foot=p.rider?.sk?.by?.['foot'+S],sole=foot?.userData.soleContact,tread=G.horse.TACK().saddle?.userData.stir?.[S];return[S,sole&&tread?new G.THREE.Vector3().copy(sole.point).applyMatrix4(foot.matrixWorld).distanceTo(tread.getWorldPosition(new G.THREE.Vector3())):null];})),flying:!!p.flying,nativeRider:G.horse.nativeRiderInspect?.()||null,rider:{skinned:!!p.rider.sk,finite:p.rider.g.matrixWorld.elements.every(Number.isFinite)},tack:G.horse.TACK().saddle?.userData.nativeAnchorCarrier||false};});
   const idle=await inspect();await ranch.keyboard.down('ArrowUp');await ranch.keyboard.down('Shift');
   await ranch.evaluate(()=>advanceTime(3000));
   const travel=await ranch.evaluate(()=>{const G=__features,p=G.horse.player,r=G.horse.RIG(),start=p.pos.clone(),local=r.scene.position.clone();let expected=0,max=0;for(let i=0;i<60;i++){advanceTime(1000/60);expected+=p.speed/60;max=Math.max(max,p.speed);}return{expected,distance:p.pos.distanceTo(start),localTravel:r.scene.position.distanceTo(local),max};});
   const moving=await inspect();await ranch.keyboard.down('Space');await ranch.evaluate(()=>advanceTime(350));await ranch.keyboard.up('Space');const jump=await inspect();
   await ranch.keyboard.up('ArrowUp');await ranch.keyboard.up('Shift');if(key==='european-dragon'){await ranch.keyboard.press('KeyF');}await ranch.evaluate(()=>advanceTime(1500));
   await ranch.evaluate(()=>{const G=__features,p=G.horse.player;G.camera.position.set(p.pos.x-5,G.world.groundH(p.pos.x,p.pos.z)+2.6,p.pos.z+4);G.camera.lookAt(p.mesh.getWorldPosition(new G.THREE.Vector3()).add(new G.THREE.Vector3(0,1.4,0)));G.composer.render();});
   await ranch.screenshot({path:path.join(out,key+'-ranch.png')});
   report.ranch.push({key,idle,moving,jump,travel});
   const cap=idle.profile.max*idle.scale[2];
   report.checks[key+'Ranch']=[idle,moving,jump].every(s=>s.model===key&&s.finite&&s.bones===expected.bones&&s.rider.skinned&&s.rider.finite&&s.meshes.some(m=>m.vertices===expected.body))&&travel.max<=cap+1e-6&&Math.abs(travel.distance-travel.expected)<.015&&travel.localTravel<1e-7&&(key==='european-dragon'?jump.flying&&jump.clip==='Fly':jump.y===0&&jump.vy===0)&&(key.includes('western')?idle.tack&&idle.meshes.some(m=>m.vertices===13895&&m.visible):true);
   if(key.includes('western')){const phases=[idle,moving,jump],distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));report.checks[key+'Contacts']=phases.every(s=>Object.values(s.skinnedBoots).every(d=>Number.isFinite(d)&&d<.01)&&s.nativeRider?.reins?.nonReinComponentsIntact&&Object.values(s.nativeRider.reins.sides).every(r=>distance(r.mainStart,r.bit)<1e-6&&distance(r.mainEnd,r.hand)<1e-6));}
   console.log(JSON.stringify({surface:'ranch',key,pass:report.checks[key+'Ranch'],travel}));
  }
  await ranch.evaluate(()=>{__features.ui.openStable();document.querySelector('#stablePanel [data-st="hero"]').click();});
  await ranch.waitForFunction(()=>__features.horse.RIG().modelKey==='bay-sporthorse'&&!__features.horse.RIG().loadingBreed,{timeout:60000});
  report.legacyBay=await ranch.evaluate(()=>{advanceTime(200);const r=__features.horse.RIG();return{key:r.modelKey,bones:r.bones.length,artist:!!r.profile.artistBreed,finite:r.bones.every(b=>b.matrixWorld.elements.every(Number.isFinite)),motion:r.heroMotion?.mode};});
  report.checks.legacyBay=report.legacyBay.key==='bay-sporthorse'&&report.legacyBay.artist&&report.legacyBay.finite;
  // Use the real Take along action, then observe the actual pasture/companion
  // entities. Clear arena positions avoid testing a one-off fence relocation.
  await ranch.evaluate(()=>{const G=__features,i=G.horse.myHorses.findIndex(h=>h.breed==='black-dragon-native');G.ui.openStable();document.querySelector('#stablePanel [data-st="eq:'+i+'"]').click();G.hidePanels();advanceTime(600);});
  await ranch.waitForFunction(()=>{const G=__features;return ['black-dragon-native','bay-western'].every(key=>G.horse.herd().some(e=>G.horse.myHorses[e.idx]?.breed===key&&e.rig?.profile?.nativeBreed));},{timeout:60000});
  report.nativeWorld=await ranch.evaluate(()=>{const G=__features,p=G.horse.player,entries=G.horse.herd().filter(e=>['black-dragon-native','bay-western'].includes(G.horse.myHorses[e.idx]?.breed));p.pos.set(-3,0,-3);p.speed=0;p.y=0;p.heading=0;const stats=entries.map(e=>{const key=G.horse.myHorses[e.idx].breed;e.pos.set(key==='bay-western'?-12:-9,0,-3);e.rest=0;e.tx=e.pos.x+5;e.tz=e.pos.z;return{e,key,start:e.pos.clone(),distance:0,maxStep:0,maxWsp:0};});for(let n=0;n<60;n++){const prev=stats.map(s=>s.e.pos.clone());advanceTime(1000/60);for(let i=0;i<stats.length;i++){const s=stats[i],step=s.e.pos.distanceTo(prev[i]);s.distance+=step;s.maxStep=Math.max(s.maxStep,step);s.maxWsp=Math.max(s.maxWsp,s.e.wsp||0);}}return stats.map(s=>({key:s.key,companion:G.worldPkg.companionEntry===s.e,distance:s.distance,maxSpeedFromTravel:s.maxStep*60,maxWsp:s.maxWsp,cap:s.e.rig.profile.nativeMaxSpeedMps*s.e.parts.group.getWorldScale(new G.THREE.Vector3()).z,finite:s.e.rig.bones.every(b=>b.matrixWorld.elements.every(Number.isFinite))}));});
  report.checks.nativeWorld=report.nativeWorld.length===2&&report.nativeWorld.every(s=>s.finite&&s.maxWsp<=s.cap+1e-6&&s.maxSpeedFromTravel<=s.cap+.005)&&report.nativeWorld.some(s=>s.key==='black-dragon-native'&&s.companion&&s.distance<1e-7);
  report.checks.noUnexpectedErrors=report.errors.length===0;
 }finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({checks:report.checks,errors:report.errors}));await browser.close();}
 if(Object.values(report.checks).some(v=>!v))process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});

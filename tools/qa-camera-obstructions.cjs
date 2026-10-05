// Use a disposable save and the actual installed camera hooks, not just the
// collision helper: the old hook reintroduced wall clipping after resolving it.
const QA=require('./qa-platform.cjs'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const out=path.resolve(process.argv[2]||'output/camera-obstructions');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await QA.chromium.launch({headless:true,args:QA.gpuArgs()});
 const page=await browser.newPage({viewport:{width:988,height:859}}),errors=[],report={};
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 try{
  await page.route('**/ranch3d.html*',async route=>{const r=await route.fetch();await route.fulfill({response:r,body:(await r.text()).replace('const MERGE_STATS=mergeStatics();',`window.__cameraQA={step(dt){manualStepping=true;tick(dt);},day(){dayT=.34;weather.mode='clear';weather.timer=99999;}};const MERGE_STATS=mergeStatics();`)});});
  await page.goto(QA.BASE+'/ranch3d.html?qa=camera-obstructions',{timeout:120000});
  await page.waitForFunction(()=>window.__features?.horse.RIG().ready&&__features.horse.player.rider?.sk&&!document.getElementById('load'),null,{timeout:120000});
  await page.evaluate(async()=>{const G=__features;G.save.sync(s=>s.qualityLocked=true);G.wardrobe?.closeChar();G.hidePanels();await G.photoscans.ready;await G.worldDetails.ready;advanceTime(0);G.gfx.apply('high');__cameraQA.day();});
  for(const breed of ['bay','black-dragon-native','frostdrake']){
   const idx=await page.evaluate(breed=>{const G=__features;G.save.sync(s=>G.horse.grantHorse(s,breed,{name:'Camera QA',level:30}));G.horse.reloadHorses();G.horse.rebuildAll();return G.horse.myHorses.findIndex(h=>h.breed===breed);},breed);
   await page.selectOption('#horseSel',String(idx),{force:true});
   await page.waitForFunction(breed=>{const G=__features,r=G.horse.RIG();return r.requestedBreed===breed&&r.ready&&!r.loadingBreed&&r.attachedTo===G.horse.player.mesh;},breed,{timeout:90000});
   report[breed]=await page.evaluate(breed=>{
    const G=__features,p=G.horse.player,q=__cameraQA,rows=[];
    for(const flying of breed==='bay'?[false]:[false,true])for(const yaw of [0,Math.PI/2]){
     p.pos.set(-40,0,32);p.heading=0;p.speed=0;p.flying=flying;p.y=flying?14:0;p.vy=0;
     G.followCam.reset();G.followCam.state.zoom=.62;G.followCam.state.yaw=yaw;q.day();
     // Settle normal simulation/camera hooks without drawing 30 unused frames.
     const render=G.renderer.render;G.renderer.render=()=>{};
     try{for(let i=0;i<30;i++)q.step(.1);}finally{G.renderer.render=render;}q.step(0);
     const position=G.camera.position.toArray(),camera=JSON.parse(render_game_to_text()).followCam;
     const buffers=[G.composer.renderTarget1,G.composer.renderTarget2].map(rt=>{
      const data=new Uint16Array(rt.width*rt.height*4);G.renderer.readRenderTargetPixels(rt,0,0,rt.width,rt.height,data);
      let invalid=0;for(let i=0;i<data.length;i++)if(i%4!==3&&(data[i]&0x7c00)===0x7c00)invalid++;
      return invalid;
     });rows.push({flying,yaw,position,camera,buffers,glError:G.renderer.getContext().getError()});
    }return rows;
   },breed);
   assert(report[breed].every(r=>r.position.every(Number.isFinite)&&r.camera.own&&!r.camera.broke),'Active camera remains valid for '+breed);
   assert(report[breed].every(r=>r.buffers.every(n=>n===0)&&r.glError===0),'No invalid rendered pixels or WebGL error for '+breed);
   if(breed==='bay')assert(report[breed][0].camera.dist<4.5,'Horse close zoom remains available');
   else assert(report[breed].every(r=>r.camera.dist>5),'Dragon close zoom stays outside its body');
   await page.screenshot({path:path.join(out,breed+'.png')});
   console.log(breed+': ground/flight close zoom and rendered buffers passed');
  }
  // Switch back to a horse before testing a solid wall across the camera arm.
  const bay=await page.evaluate(()=>__features.horse.myHorses.findIndex(h=>h.breed==='bay'));
  await page.selectOption('#horseSel',String(bay),{force:true});
  await page.waitForFunction(()=>__features.horse.RIG().requestedBreed==='bay'&&__features.horse.RIG().attachedTo===__features.horse.player.mesh);
  report.wall=await page.evaluate(()=>{
   const G=__features,T=G.THREE,p=G.horse.player,q=__cameraQA,gy=G.world.groundH(-40,32);
   p.pos.set(-40,0,32);p.heading=0;p.speed=0;p.flying=false;p.y=0;p.vy=0;G.followCam.reset();G.followCam.state.zoom=1;
   const wall=new T.Mesh(new T.BoxGeometry(10,9,.2),new T.MeshStandardMaterial({color:0x161616,side:T.DoubleSide}));
   wall.position.set(-40,gy+4.5,29);G.scene.add(wall);G.world.followCamera.register(wall);q.step(.016);
   G.followCam.state.placed=true;G.followCam.state.occ=1;G.camera.position.set(-40,gy+3,25);
   const inspect=height=>{const origin=new T.Vector3(p.pos.x,G.world.groundH(p.pos.x,p.pos.z)+height,p.pos.z),dir=G.camera.position.clone().sub(origin);
    return {hits:new T.Raycaster(origin,dir.clone().normalize(),0,dir.length()).intersectObject(wall).length,position:G.camera.position.toArray()};};
   const riding=[];for(let i=0;i<20;i++){q.step(1/60);riding.push(inspect(1.45));}
   p.pos.set(-40,0,24);G.onFoot.dismount();p.pos.set(-40,0,24);q.step(.1);
   // Walking smoothing still holds the old eye when the subject moves to the
   // opposite side of a wall (also happens at corners and after fast travel).
   p.pos.set(-40,0,32);p.heading=0;p.speed=0;const walking=[];
   for(let i=0;i<20;i++){q.step(1/60);walking.push(inspect(1.22));}
   return {riding,walking,onFoot:G.onFoot.on};
  });
  assert(report.wall.onFoot,'Walking camera was active');
  for(const mode of ['riding','walking'])assert(report.wall[mode].every(r=>r.hits===0),mode+' final camera never leaves a solid wall across the sightline');
  await page.screenshot({path:path.join(out,'wall-clearance.png')});
  assert.equal(errors.length,0,errors.join('\n'));console.log('Riding and walking: all 40 final sightlines clear');
 }finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({...report,errors},null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

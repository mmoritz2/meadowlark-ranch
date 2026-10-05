// Verify the extra sinking backdrop is absent and the remaining tree silhouette
// stays planted while the rider crosses the old 95–150 m shrink band.
const QA=require('./qa-platform.cjs'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const out=path.resolve(process.argv[2]||'output/grounded-woodland');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await QA.chromium.launch({headless:true,args:QA.gpuArgs()});
 try{
  const page=await browser.newPage({viewport:{width:1180,height:800}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.route('**/ranch3d.html*',async route=>{const r=await route.fetch();await route.fulfill({response:r,body:(await r.text()).replace('const MERGE_STATS=mergeStatics();',`window.__woodQA={THREE,scene,camera,renderer,composer,G,player,groundH,
   backdrop:typeof farForest==='undefined'?null:farForest,
   step(dt){manualStepping=true;tick(dt);},day(){dayT=.34;weather.mode='clear';weather.timer=99999;}};const MERGE_STATS=mergeStatics();`)});});
  await page.addInitScript(()=>{let seed=928471;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};});
  await page.goto(QA.BASE+'/ranch3d.html?qa=grounded-woodland',{timeout:120000});
  await page.waitForFunction(()=>window.__woodQA?.G.horse.RIG().ready&&!document.getElementById('load'),null,{timeout:120000});
  await page.evaluate(async()=>{const q=__woodQA;q.G.save.sync(s=>s.qualityLocked=true);q.G.wardrobe?.closeChar();q.G.hidePanels();await q.G.photoscans.ready;await q.G.worldDetails.ready;advanceTime(0);q.day();q.G.gfx.apply('high');});
  const silhouette=await page.evaluate(()=>{
   const q=__woodQA,T=q.THREE;let source=q.backdrop?.pines;
   if(!source)q.scene.traverse(o=>{if(!source&&o.name==='Scanned distant tree views | mature-pine')source=o;});
   if(!source)throw Error('No mature woodland view');
   const geo=source.geometry.clone();geo.computeBoundingBox();const b=geo.boundingBox;
   geo.translate(0,-b.min.y,0);geo.scale(6/(b.max.y-b.min.y),6/(b.max.y-b.min.y),6/(b.max.y-b.min.y));
   const tree=new T.InstancedMesh(geo,source.material,1);tree.setMatrixAt(0,new T.Matrix4());tree.instanceMatrix.needsUpdate=true;
   const scene=new T.Scene();scene.environment=q.scene.environment;scene.add(tree,new T.HemisphereLight(0xffffff,0x777766,2));
   const sun=new T.DirectionalLight(0xffffff,3);sun.position.set(-3,8,5);scene.add(sun);
   const cam=new T.OrthographicCamera(-5,5,7,-1,.1,40);cam.position.set(0,0,18);cam.lookAt(0,0,0);
   const rt=new T.WebGLRenderTarget(256,256),previous=q.renderer.getRenderTarget(),color=q.renderer.getClearColor(new T.Color()),alpha=q.renderer.getClearAlpha();
   const rows=[];try{
    q.renderer.setClearColor(0,0);
    for(const distance of[80,95,110,125,150,180]){
     q.player.pos.set(distance,0,0);q.renderer.setRenderTarget(rt);q.renderer.render(scene,cam);
     const pixels=new Uint8Array(256*256*4);q.renderer.readRenderTargetPixels(rt,0,0,256,256,pixels);
     let count=0,minY=256,maxY=-1;for(let y=0;y<256;y++)for(let x=0;x<256;x++)if(pixels[(y*256+x)*4+3]>127){count++;minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
     rows.push({distance,count,minY,maxY});
    }
   }finally{q.renderer.setRenderTarget(previous);q.renderer.setClearColor(color,alpha);rt.dispose();geo.dispose();tree.dispose();}
   return rows;
  });
  const riding=[];
  await page.evaluate(()=>{const q=__woodQA,p=q.player;p.pos.set(-40,0,-52);p.heading=Math.PI;p.speed=0;p.y=0;p.vy=0;p.flying=false;p.stam=1;q.G.followCam.reset();q.step(0);});
  await page.keyboard.down('ArrowUp');
  for(let sample=0;sample<4;sample++){
   riding.push(await page.evaluate(()=>{const q=__woodQA;for(let i=0;i<24;i++)q.step(1/30);return{position:q.player.pos.toArray(),camera:q.camera.position.toArray(),mounted:!q.G.onFoot.on};}));
   await page.screenshot({path:path.join(out,'riding-'+sample+'.png')});
  }
  await page.keyboard.up('ArrowUp');
  const state=await page.evaluate(()=>{
   const q=__woodQA,backdrops=[];q.scene.traverse(o=>{if(o.name.startsWith('Scanned far forest'))backdrops.push(o.name);});
   const modes=[];for(const tier of['low','medium','high']){q.G.gfx.apply(tier);q.G.photoscans.update();q.step(0);modes.push({tier,detailed:q.G.photoscans.activeTrees,distant:q.G.photoscans.distantTrees});}
   return{backdrop:!!q.backdrop,backdrops,trees:q.G.photoscans.trees,mature:q.G.photoscans.matureTrees,modes,errors:q.G.photoscans.errors,featureErrors:q.G.errors,glError:q.renderer.getContext().getError()};
  });
  const checks={extraBackdropRemoved:!state.backdrop&&!state.backdrops.length,woodlandRemains:state.trees>1000&&state.mature>100,
   fullHeightAtEveryDistance:silhouette.every(r=>r.count>300&&r.count===silhouette[0].count&&r.minY===silhouette[0].minY&&r.maxY===silhouette[0].maxY),
   mountedRide:riding.every(r=>r.mounted&&[...r.position,...r.camera].every(Number.isFinite))&&Math.hypot(riding.at(-1).position[0]-riding[0].position[0],riding.at(-1).position[2]-riding[0].position[2])>1,
   forestAcrossGraphicsModes:state.modes.every(m=>m.distant>1000)&&state.modes[0].detailed===0&&state.modes[2].detailed>0,
   noAssetErrors:!state.errors.length,noFeatureErrors:!state.featureErrors.length,noBrowserErrors:!errors.length,webGLValid:state.glError===0};
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({checks,silhouette,riding,state,errors},null,2));
  for(const[k,v]of Object.entries(checks))console.log((v?'PASS ':'FAIL ')+k);console.log(JSON.stringify({silhouette,state}));
  assert(Object.values(checks).every(Boolean),'Grounded woodland regression failed');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

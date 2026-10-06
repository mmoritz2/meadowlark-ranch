// Visual acceptance for the woodland, meadow and arena-entry model pass.
const QA=require('./qa-platform.cjs'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const out=path.resolve(process.argv[2]||'output/landscape-models');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await QA.chromium.launch({headless:true,args:QA.gpuArgs()});
 try{
  const page=await browser.newPage({viewport:{width:1180,height:800},deviceScaleFactor:1}),errors=[];
  await page.route('**/api/me',r=>r.fulfill({contentType:'application/json',body:'null'}));
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.route('**/ranch3d.html*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace('const MERGE_STATS=mergeStatics();',`window.__landQA={THREE,scene,camera,renderer,composer,G,player,groundH,nearGrass,TACK,
   step(dt){manualStepping=true;tick(dt);},day(){dayT=.34;weather.mode='clear';weather.timer=99999;}};const MERGE_STATS=mergeStatics();`)});});
  await page.addInitScript(()=>{let seed=928471;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};});
  await page.goto(QA.BASE+'/ranch3d.html?qa=landscape-models',{timeout:120000});
  await page.waitForFunction(()=>window.__landQA?.G.horse.RIG().ready&&!document.getElementById('load'),null,{timeout:120000});
  await page.evaluate(async()=>{
   const q=__landQA;q.G.save.sync(s=>s.qualityLocked=true);q.G.wardrobe?.closeChar();q.G.hidePanels();await q.G.photoscans.ready;await q.G.worldDetails.ready;await q.G.world.ranchBuilderArt.ready;advanceTime(0);q.day();q.G.gfx.apply('high');
  });
  const tree=await page.evaluate(()=>__landQA.G.photoscans.treePositions.filter(t=>t.source==='mature-pine'&&t.height>8).sort((a,b)=>Math.hypot(a.x+35,a.z+70)-Math.hypot(b.x+35,b.z+70))[0]);
  assert(tree,'Mature tree must be placed');
  const shots=[
   {name:'ranch-entrance',eye:[7,2.8,29],look:[0,2.4,20]},
   {name:'pasture-ground',eye:[-95,2.7,36],look:[-120,1.6,-15],relative:true},
   {name:'mature-pine',eye:[tree.x+8,3,tree.z+10],look:[tree.x,tree.height*.55,tree.z],relative:true,at:[tree.x+3,tree.z+3]},
   {name:'thaw-margin',eye:[-90,5,-115],look:[-154,1,-202],relative:true},
  ];
  const village=await page.evaluate(()=>{
   const q=__landQA,root=q.G.worldPkg.LANDMARKS.find(s=>s.id==='cottonwood:clubhouse').grp;root.updateMatrixWorld(true);
   return {name:'cottage-front',eye:root.localToWorld(new q.THREE.Vector3(4.6,2.6,7.2)).toArray(),look:root.localToWorld(new q.THREE.Vector3(0,2.4,0)).toArray()};
  });shots.push(village);
  const rows=[];
  for(const c of shots){
   const row=await page.evaluate(c=>{
    const q=__landQA,eye=c.eye.slice(),look=c.look.slice();
    if(c.relative){eye[1]+=q.groundH(eye[0],eye[2]);look[1]+=q.groundH(look[0],look[2]);}
    q.player.pos.set(c.at?.[0]??eye[0],0,c.at?.[1]??eye[2]);q.player.speed=0;q.G.followCam.reset();q.day();
    const render=q.renderer.render;q.renderer.render=()=>{};try{for(let i=0;i<35;i++)q.step(.1);}finally{q.renderer.render=render;}
    q.player.mesh.visible=false;const reins=q.scene.getObjectByName('Native leather split reins');if(reins)reins.visible=false;for(const o of Object.values(q.TACK||{}))if(o?.isObject3D)o.visible=false;
    q.camera.position.set(...eye);q.camera.lookAt(...look);q.G.waterReflections.update(performance.now()+100);q.composer.render();
    const rt=q.composer.readBuffer,w=Math.floor(rt.width),h=Math.floor(rt.height),pixels=new Uint16Array(w*h*4);q.renderer.readRenderTargetPixels(rt,0,0,w,h,pixels);let invalid=0;
    for(let i=0;i<pixels.length;i++)if(i%4!==3&&(pixels[i]&0x7c00)===0x7c00)invalid++;
    return {invalid,image:q.renderer.domElement.toDataURL().split(',')[1],glError:q.renderer.getContext().getError()};
   },c);
   fs.writeFileSync(path.join(out,c.name+'.png'),Buffer.from(row.image,'base64'));delete row.image;rows.push({name:c.name,...row});
  }
  // Traverse the opening through real keyboard input and ordinary movement.
  // Only reset at the start of each pass; the simulation must carry the mount.
  const riding=[];
  for(const direction of[-1,1]){
   await page.evaluate(direction=>{
    const q=__landQA,p=q.player;q.G.hidePanels();q.G.wardrobe?.closeChar();
    p.pos.set(0,0,direction<0?26:14);p.heading=direction<0?Math.PI:0;p.speed=0;p.y=0;p.vy=0;p.flying=false;p.stam=1;
    p.mesh.visible=true;for(const o of Object.values(q.TACK||{}))if(o?.isObject3D)o.visible=true;
    q.G.followCam.reset();q.step(0);
   },direction);
   await page.keyboard.down('ArrowUp');await page.keyboard.down('Control');
   riding.push(await page.evaluate(direction=>{
    const q=__landQA,p=q.player,rows=[],render=q.renderer.render;q.renderer.render=()=>{};
    try{for(let i=0;i<420;i++){q.step(1/30);rows.push({x:p.pos.x,z:p.pos.z,speed:p.speed,camera:q.camera.position.toArray()});if(direction<0?p.pos.z<15:p.pos.z>25)break;}}
    finally{q.renderer.render=render;}q.step(0);
    return {direction,mounted:!q.G.onFoot.on,rows};
   },direction));
   await page.keyboard.up('ArrowUp');await page.keyboard.up('Control');
  }
  const state=await page.evaluate(async()=>{
   const q=__landQA,T=q.THREE,{meadowCoverWeight,hasMeadowCover}=await import('./assets/meadow-biomes.js');
   const entry=q.scene.getObjectByName('Arena | timber and stone entrance');entry.updateMatrixWorld(true);
   let blocked=0;for(const x of[-2,-1,0,1,2])for(const y of[.5,1.5,2.5]){
    const ray=new T.Raycaster(new T.Vector3(x,y,17),new T.Vector3(0,0,1),0,6);if(ray.intersectObject(entry,true).length)blocked++;
   }
   const size=new T.Box3().setFromObject(entry).getSize(new T.Vector3()).toArray();
   const tiers=[];for(const tier of['low','medium','high']){q.G.gfx.apply(tier);q.G.photoscans.update();tiers.push({tier,trees:q.G.photoscans.activeTrees,triangles:q.G.photoscans.activeTreeTriangles,budget:q.G.photoscans.treeTriangleBudget});}
   // Former bare pasture must contain actual drawn grass instances, not only a
   // changed shader parameter. Relocate the travelling ring with its normal tick.
   q.nearGrass.tick(1,-95,36);const matrix=new T.Matrix4(),v=new T.Vector3();let pastureTufts=0,coreTufts=0;
   for(let i=0;i<q.nearGrass.near.count;i++){q.nearGrass.near.getMatrixAt(i,matrix);v.setFromMatrixPosition(matrix);if(matrix.elements[0]===0&&matrix.elements[5]===0)continue;
    if(Math.hypot(v.x+95,v.z-36)<8)pastureTufts++;}
   q.nearGrass.tick(1,-160,-210);
   for(let i=0;i<q.nearGrass.near.count;i++){q.nearGrass.near.getMatrixAt(i,matrix);v.setFromMatrixPosition(matrix);if(matrix.elements[0]===0&&matrix.elements[5]===0)continue;if(Math.hypot(v.x+160,v.z+210)<20)coreTufts++;}
   const scans=q.G.photoscans,details=q.G.worldDetails;let depthWritingLabels=0,gardens=0,gardenFlowers=0;
   q.scene.traverse(o=>{if(o.isSprite&&o.material.depthWrite)depthWritingLabels++;if(o.name==='Cottage | living window boxes'){gardens++;for(const child of o.children)gardenFlowers+=child.count||1;}});
   return {depthWritingLabels,gardens,gardenFlowers,tiers,blocked,size,entryParts:entry.children[0].userData.builderArt?.parts,pastureTufts,coreTufts,
    cover:{ranch:meadowCoverWeight(0,0),pasture:meadowCoverWeight(-95,36),winter:meadowCoverWeight(-160,-210),canyon:meadowCoverWeight(-220,130),stable:hasMeadowCover(-95,36)===hasMeadowCover(-95,36)},
    scans:{assets:scans.assets,errors:scans.errors,matureTrees:scans.matureTrees,stoneTriangles:scans.groundStoneTriangles,views:scans.normalMappedViews},
    details:{grass:details.grassClumps,errors:details.errors},featureErrors:q.G.errors};
  });
  const checks={
   labelsCannotCutPaths:state.depthWritingLabels===0,instancedGardensComplete:state.gardens===10&&state.gardenFlowers===280,
   matureTreesPlaced:state.scans.matureTrees>100,newTreeAndViewsLoaded:state.scans.assets.includes('pine_tree_01')&&state.scans.views===6&&state.scans.assets.includes('island_tree_01'),
   boundedTreeGeometry:state.tiers.every(t=>t.triangles<=t.budget)&&state.tiers[0].trees===0,
   scannedGroundStone:state.scans.stoneTriangles>100&&state.scans.stoneTriangles<=300,
   scannedGrassClumps:state.details.grass>20,
   pastureHasRealGrass:state.pastureTufts>200,snowCoreStaysClear:state.coreTufts===0,
   biomeCoverage:state.cover.ranch===1&&state.cover.pasture>.5&&state.cover.winter===0&&state.cover.canyon===0,
   detailedEntry:state.entryParts>50&&state.size[0]>7&&state.size[1]>4,
   entryRideCorridorClear:state.blocked===0,
   mountedEntryTraversal:riding.every(pass=>pass.mounted&&(pass.direction<0?pass.rows.at(-1).z<15:pass.rows.at(-1).z>25)&&pass.rows.every(r=>Math.abs(r.x)<.1&&r.camera.every(Number.isFinite))),
   finitePixels:rows.every(r=>r.invalid===0),webGLValid:rows.every(r=>r.glError===0),
   noAssetErrors:!state.scans.errors.length&&!state.details.errors.length,noFeatureErrors:!state.featureErrors.length,noBrowserErrors:!errors.length,
  };
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({checks,rows,riding,state,errors},null,2));
  for(const [name,ok]of Object.entries(checks))console.log((ok?'PASS ':'FAIL ')+name);console.log(JSON.stringify(state));
  assert(Object.values(checks).every(Boolean),'Landscape acceptance failed');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),QA=require('./qa-platform.cjs');
const out=path.resolve(process.argv[2]||'output/woodland-trails');fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await QA.chromium.launch({headless:true,args:QA.gpuArgs()});try{
 const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await page.route('**/api/me',r=>r.fulfill({contentType:'application/json',body:'null'}));
 await page.route('**/ranch3d.html*',async r=>{const res=await r.fetch();await r.fulfill({response:res,body:(await res.text()).replace('const MERGE_STATS=mergeStatics();',`window.__qa={THREE,scene,camera,renderer,composer,G,player,groundH,TACK,nearGrass,step(dt){manualStepping=true;tick(dt)},day(){dayT=.34;weather.mode='clear';weather.timer=99999}};const MERGE_STATS=mergeStatics();`)});});
 await page.addInitScript(()=>{let seed=928471;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};});
 await page.goto(QA.BASE+'/ranch3d.html?qa=woodland',{timeout:120000});
 await page.waitForFunction(()=>window.__qa?.G.horse.RIG().ready&&!document.getElementById('load'),null,{timeout:120000});
 await page.evaluate(async()=>{const q=__qa;q.G.save.sync(s=>s.qualityLocked=true);q.G.wardrobe?.closeChar();q.G.hidePanels();await q.G.photoscans.ready;await q.G.worldDetails.ready;advanceTime(0);q.day();q.G.gfx.apply('high');});
 const state=await page.evaluate(()=>{
  const q=__qa,P=q.G.worldPaths,W=q.G.world,scan=q.G.photoscans,tr=P.tracks.find(t=>t.id==='clover'),pos=P.surface.geometry.attributes.position;
  let surfaceError=0;for(let i=0;i<pos.count;i++)surfaceError=Math.max(surfaceError,Math.abs(pos.getY(i)-W.groundH(pos.getX(i),pos.getZ(i))-.055));
  const start=tr.pts[0],end=tr.pts.at(-1),highfell=P.tracks.find(t=>t.id==='highfell');
  let minClearance=Infinity;for(const p of tr.pts)for(const c of W.colliders)if(!c.decor&&c.r>=.3)minClearance=Math.min(minClearance,Math.hypot(p[0]-c.x,p[1]-c.z)-c.r);
  let oldPlantsOnRoad=0;const matrix=new q.THREE.Matrix4(),point=new q.THREE.Vector3();
  for(const mesh of[...['scrub','juni','sage','brack','reed','tuft','petal'].map(k=>q.G.floraPkg.bank[k]?.im),W.seedGrass].filter(Boolean))for(let i=0;i<mesh.instanceMatrix.count;i++){mesh.getMatrixAt(i,matrix);if(Math.abs(matrix.determinant())<1e-8)continue;point.setFromMatrixPosition(matrix);if(P.trackDist(point.x,point.z)<4.4)oldPlantsOnRoad++;}
  let woodlandLeafTriangles=0;q.scene.traverse(o=>{if(o.name.startsWith('Photoscan woodland-broadleaf')&&/leaves/.test(o.material.name))woodlandLeafTriangles=o.geometry.index.count/3});
  return {length:tr.len,points:tr.pts.length,startGap:W.pathDist(...start),endGap:Math.min(...highfell.pts.map(p=>Math.hypot(p[0]-end[0],p[1]-end[1]))),minCreekGap:Math.min(...tr.pts.map(p=>Math.abs(p[0]-W.streamX(p[1])))),surfaceError,minClearance,
   oldPlantsOnRoad,clearedPlants:P.clearedPlantInstances,pathStoneTriangles:scan.pathStoneTriangles,trees:scan.woodlandCanopies,leafTriangles:woodlandLeafTriangles,groveTrees:scan.trailTrees.length,
   treeClearances:scan.trailTrees.map(t=>({road:P.trackDist(t.x,t.z),water:Math.abs(t.x-W.streamX(t.z)),trunk:W.colliders.some(c=>c.trunk&&c.x===t.x&&c.z===t.z)})),
   signs:P.signs.filter(s=>s.name==='sign:cloverfork'||s.name==='sign:cloverwest').length,
   errors:[...q.G.errors,...scan.errors,...q.G.worldDetails.errors]};
 });
 const riding=[];
 // Steer toward successive path samples while the normal keyboard-driven horse
 // simulation advances. There are no position writes after the starting point.
 for(const reverse of[false,true]){
  await page.evaluate(reverse=>{const q=__qa,p=q.player,pts=q.G.worldPaths.tracks.find(t=>t.id==='clover').pts.slice();if(reverse)pts.reverse();p.pos.set(pts[0][0],0,pts[0][1]);p.heading=Math.atan2(pts[1][0]-pts[0][0],pts[1][1]-pts[0][1]);p.speed=0;p.y=0;p.vy=0;p.flying=false;p.stam=1;p.mesh.visible=true;for(const o of Object.values(q.TACK||{}))if(o?.isObject3D)o.visible=true;q.G.followCam.reset();q.day();q.step(0)},reverse);
  await page.keyboard.down('ArrowUp');await page.keyboard.down('Control');
  riding.push(await page.evaluate(reverse=>{
   const q=__qa,p=q.player,pts=q.G.worldPaths.tracks.find(t=>t.id==='clover').pts.slice();if(reverse)pts.reverse();let index=1,maxDeviation=0,finiteCamera=true;const rows=[],render=q.renderer.render;q.renderer.render=()=>{};
   try{for(let i=0;i<6000&&index<pts.length;i++){
    const target=pts[index];if(Math.hypot(target[0]-p.pos.x,target[1]-p.pos.z)<1.6){index++;continue;}
    p.heading=Math.atan2(target[0]-p.pos.x,target[1]-p.pos.z);q.step(1/30);
    maxDeviation=Math.max(maxDeviation,q.G.worldPaths.trackDist(p.pos.x,p.pos.z));finiteCamera&&=q.camera.position.toArray().every(Number.isFinite);
    if(i%120===0)rows.push({index,x:p.pos.x,z:p.pos.z,speed:p.speed});
   }}finally{q.renderer.render=render;}
   return {reverse,finished:index===pts.length,index,total:pts.length,maxDeviation,finiteCamera,mounted:!q.G.onFoot.on,rows};
  },reverse));
  await page.keyboard.up('ArrowUp');await page.keyboard.up('Control');console.log('Traversed',reverse?'west to east':'east to west',riding.at(-1).finished);
 }
 const tiers=await page.evaluate(()=>{
  const q=__qa,scan=q.G.photoscans,tree=scan.treePositions.find(t=>t.kind==='woodland'),rows=[],render=q.renderer.render;q.renderer.render=()=>{};
  try{for(const tier of['low','medium','high']){q.G.gfx.apply(tier);q.player.pos.set(tree.x+3,0,tree.z+3);q.player.speed=0;for(let i=0;i<8;i++)q.step(.1);let detailedWoodland=0;q.scene.traverse(o=>{if(o.name.startsWith('Photoscan woodland-broadleaf')&&o.count)detailedWoodland+=o.count;});rows.push({tier,triangles:scan.activeTreeTriangles,budget:scan.treeTriangleBudget,detailedWoodland});}}finally{q.renderer.render=render;}return rows;
 });
 const views=[{name:'clover-hill',at:.31,look:8},{name:'woodland-trail',at:.7,look:7}];
 const pixels=[];
 for(const view of views){const shot=await page.evaluate(view=>{
  const q=__qa,tr=q.G.worldPaths.tracks.find(t=>t.id==='clover'),i=Math.floor((tr.pts.length-1)*view.at),a=tr.pts[i],b=tr.pts[Math.min(i+view.look,tr.pts.length-1)];
  q.player.pos.set(a[0],0,a[1]);q.player.heading=Math.atan2(b[0]-a[0],b[1]-a[1]);q.player.speed=0;q.day();q.G.followCam.reset();const render=q.renderer.render;q.renderer.render=()=>{};try{for(let i=0;i<30;i++)q.step(.1)}finally{q.renderer.render=render;}
  q.player.mesh.visible=true;if(q.player.rider?.g)q.player.rider.g.visible=true;q.G.waterReflections.update(performance.now()+100);q.composer.render();
  const rt=q.composer.readBuffer,pixels=new Uint16Array(rt.width*rt.height*4);q.renderer.readRenderTargetPixels(rt,0,0,rt.width,rt.height,pixels);let invalid=0;for(let i=0;i<pixels.length;i++)if(i%4!==3&&(pixels[i]&0x7c00)===0x7c00)invalid++;
  return {invalid,gl:q.renderer.getContext().getError(),image:q.renderer.domElement.toDataURL('image/webp',.94).split(',')[1]};
 },view);fs.writeFileSync(path.join(out,view.name+'.webp'),Buffer.from(shot.image,'base64'));delete shot.image;pixels.push(shot);}
 const checks={connectedBridleway:state.length>200&&state.startGap<.5&&state.endGap<.001,groundedRibbon:state.surfaceError<.001,dryTrail:state.minCreekGap>=12-1e-6,
  populatedWoodland:state.trees>250&&state.leafTriangles===232168,trailGroves:state.groveTrees>5&&state.treeClearances.every(p=>p.road>5.5&&p.water>10&&p.trunk),wayfinding:state.signs===2,
  clearTrailSurface:state.oldPlantsOnRoad===0&&state.clearedPlants>0,scannedBoundaries:state.pathStoneTriangles===240,newTreeBudgets:tiers.every(t=>t.triangles<=t.budget)&&tiers[0].detailedWoodland===0&&tiers[2].detailedWoodland>0,rideBothDirections:riding.every(p=>p.finished&&p.mounted&&p.maxDeviation<3.5&&p.finiteCamera),validRendering:pixels.every(p=>p.invalid===0&&p.gl===0),noErrors:!state.errors.length&&!errors.length};
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({checks,state,riding,tiers,pixels,errors},null,2));console.log(JSON.stringify({checks,state,riding:riding.map(({rows,...p})=>p),pixels,errors}));assert(Object.values(checks).every(Boolean),'Woodland trail acceptance failed');
 }finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});

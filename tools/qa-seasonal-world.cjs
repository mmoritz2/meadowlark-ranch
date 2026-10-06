const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const QA=require('./qa-platform.cjs');
const out=path.resolve(process.argv[2]||'output/seasonal-world');fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await QA.chromium.launch({headless:true,args:QA.gpuArgs()});try{
 const page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('**/api/me',r=>r.fulfill({contentType:'application/json',body:'null'}));
 await page.route('**/ranch3d.html*',async r=>{const res=await r.fetch();await r.fulfill({response:res,body:(await res.text()).replace('const MERGE_STATS=mergeStatics();',`window.__qa={THREE,scene,camera,renderer,composer,G,player,groundH,TACK,step(dt){manualStepping=true;tick(dt)},day(){dayT=.34;weather.mode='clear';weather.timer=99999}};const MERGE_STATS=mergeStatics();`)});});
 await page.addInitScript(()=>{let seed=928471;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};});
 await page.goto(QA.BASE+'/ranch3d.html?qa=regions',{timeout:120000});await page.waitForFunction(()=>window.__qa?.G.horse.RIG().ready&&!document.getElementById('load'),null,{timeout:120000});
 await page.evaluate(async()=>{const q=__qa;q.G.save.sync(s=>s.qualityLocked=true);q.G.wardrobe?.closeChar();q.G.hidePanels();await q.G.photoscans.ready;await q.G.worldDetails.ready;await q.G.world.ranchBuilderArt.ready;advanceTime(0);});
 const cases=[{name:'amberwood',eye:[249,3.6,-213],look:[303,12,-308],route:'barley',along:.72},{name:'amberwood-canopy',eye:[289,18,-224],look:[324,7,-310]},{name:'pine-trail',eye:[-106,2,-127],look:[-162,8,-201]},{name:'canyon',eye:[-202,2.2,151],look:[-253,6,179]},{name:'willowmere',eye:[236,3.5,246],look:[314,7,308]}];
 for(const tier of ['medium','low'])cases.push({...cases[0],name:'amberwood-'+tier,tier});
 const layout=await page.evaluate(()=>JSON.stringify(__qa.G.photoscans.treePositions));
 const rows=[];
 for(const view of cases){const row=await page.evaluate(v=>{
  const q=__qa;if(v.route){const pts=q.G.worldPaths.tracks.find(t=>t.id===v.route).pts;const at=Math.floor((pts.length-1)*v.along),a=pts[at],b=pts[Math.min(pts.length-1,at+8)];v.eye=[a[0],2.7,a[1]];v.look=[b[0],3.0,b[1]];}q.G.gfx.apply(v.tier||'high');q.day();q.player.pos.set(v.eye[0],0,v.eye[2]);q.player.speed=0;q.G.followCam.reset();
  const render=q.renderer.render;q.renderer.render=()=>{};try{for(let i=0;i<30;i++)q.step(.1);}finally{q.renderer.render=render;}
  q.player.mesh.visible=false;for(const o of Object.values(q.TACK||{}))if(o?.isObject3D)o.visible=false;const reins=q.scene.getObjectByName('Native leather split reins');if(reins)reins.visible=false;
  q.camera.position.set(v.eye[0],q.groundH(v.eye[0],v.eye[2])+v.eye[1],v.eye[2]);q.camera.lookAt(v.look[0],q.groundH(v.look[0],v.look[2])+v.look[1],v.look[2]);
  for(let i=0;i<12;i++)q.composer.render();
  const p=q.G.photoscans;return {name:v.name,tier:v.tier||'high',activeTrees:p.activeTrees,treeTriangles:p.activeTreeTriangles,treeBudget:p.treeTriangleBudget,gl:q.renderer.getContext().getError(),errors:[...q.G.errors,...p.errors],quarterTrees:p.replacedQuarterTrees,seasonalTrees:p.treePositions.filter(t=>t.tint!=='ffffff').length,willowScans:p.treePositions.filter(t=>t.kind==='willow').length,image:q.renderer.domElement.toDataURL('image/webp',.95).split(',')[1]};
 },view);fs.writeFileSync(path.join(out,view.name+'.webp'),Buffer.from(row.image,'base64'));delete row.image;rows.push(row);console.log(JSON.stringify(row));}
 const checks=await page.evaluate(before=>{
  const q=__qa,p=q.G.photoscans,trees=p.treePositions;
  return {stableLayout:before===JSON.stringify(trees),seasonalCanopy:trees.filter(t=>t.tint!=='ffffff').length>200,
   evergreenConifers:trees.filter(t=>t.source.includes('pine')).every(t=>t.tint==='ffffff'),
   tintStaysInRegion:trees.filter(t=>Math.hypot(t.x-300,t.z+300)>=145).every(t=>t.tint==='ffffff'),
   oldMaplesRetired:q.G.quartersPkg.scanTrees.length>0&&q.G.quartersPkg.scanTrees.every(t=>!t.root.visible),
   marshCardsReplaced:trees.filter(t=>t.kind==='willow').length>20,
   trailsClear:trees.every(t=>q.G.worldPaths.trackDist(t.x,t.z)>=3.7&&q.G.world.pathDist(t.x,t.z)>=3.2),
   treesCleared:p.roadClearedTrees,snagsCleared:p.roadClearedSnags};
 },layout);
 checks.noBrowserErrors=!errors.length;checks.withinBudgets=rows.every(r=>r.gl===0&&!r.errors.length&&r.treeTriangles<=r.treeBudget);
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({checks,rows,errors},null,2));console.log(JSON.stringify(checks));
 assert(Object.values(checks).every(Boolean),'Regional rendering failed');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});

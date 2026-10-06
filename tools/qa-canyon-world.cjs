const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const QA=require('./qa-platform.cjs');
const out=path.resolve(process.argv[2]||'output/canyon-world');fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await QA.chromium.launch({headless:true,args:QA.gpuArgs()});try{
 const page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('**/api/me',r=>r.fulfill({contentType:'application/json',body:'null'}));
 await page.route('**/ranch3d.html*',async r=>{const res=await r.fetch();await r.fulfill({response:res,body:(await res.text()).replace('const MERGE_STATS=mergeStatics();',`window.__qa={THREE,scene,camera,renderer,composer,G,player,groundH,TACK,step(dt){manualStepping=true;tick(dt)},day(){dayT=.34;weather.mode='clear';weather.timer=99999}};const MERGE_STATS=mergeStatics();`)});});
 await page.addInitScript(()=>{let seed=928471;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};});
 await page.goto(QA.BASE+'/ranch3d.html?qa=regions',{timeout:120000});await page.waitForFunction(()=>window.__qa?.G.horse.RIG().ready&&!document.getElementById('load'),null,{timeout:120000});
 await page.evaluate(async()=>{const q=__qa;q.G.save.sync(s=>s.qualityLocked=true);q.G.wardrobe?.closeChar();q.G.hidePanels();await q.G.photoscans.ready;await q.G.worldDetails.ready;await q.G.world.ranchBuilderArt.ready;advanceTime(0);});
 const view={name:'canyon',eye:[-202,2.2,151],look:[-253,6,179]};
 const cases=['high','medium','low'].map(tier=>({...view,name:tier==='high'?'canyon':'canyon-'+tier,tier}));

 const rows=[];
 for(const view of cases){const row=await page.evaluate(v=>{
  const q=__qa;q.G.gfx.apply(v.tier||'high');q.day();q.player.pos.set(v.eye[0],0,v.eye[2]);q.player.speed=0;q.G.followCam.reset();
  const render=q.renderer.render;q.renderer.render=()=>{};try{for(let i=0;i<30;i++)q.step(.1);}finally{q.renderer.render=render;}
  q.player.mesh.visible=false;for(const o of Object.values(q.TACK||{}))if(o?.isObject3D)o.visible=false;const reins=q.scene.getObjectByName('Native leather split reins');if(reins)reins.visible=false;
  q.camera.position.set(v.eye[0],q.groundH(v.eye[0],v.eye[2])+v.eye[1],v.eye[2]);q.camera.lookAt(v.look[0],q.groundH(v.look[0],v.look[2])+v.look[1],v.look[2]);
  for(let i=0;i<12;i++)q.composer.render();
  const p=q.G.photoscans;return {name:v.name,tier:v.tier||'high',activeTrees:p.activeTrees,treeTriangles:p.activeTreeTriangles,treeBudget:p.treeTriangleBudget,gl:q.renderer.getContext().getError(),errors:[...q.G.errors,...p.errors],quarterTrees:p.replacedQuarterTrees,seasonalTrees:p.treePositions.filter(t=>t.tint!=='ffffff').length,willowScans:p.treePositions.filter(t=>t.kind==='willow').length,image:q.renderer.domElement.toDataURL('image/webp',.95).split(',')[1]};
 },view);fs.writeFileSync(path.join(out,view.name+'.webp'),Buffer.from(row.image,'base64'));delete row.image;rows.push(row);console.log(JSON.stringify(row));}
 const checks=await page.evaluate(()=>{
  const q=__qa,root=q.scene.getObjectByName('Oasis | feather palms'),p=root.userData.oasisPalms;
  const bank=q.scene.getObjectByName('Oasis | grounded shoreline');
  return {detailedPalms:p.palms.length===7&&p.triangles<12000,castsShadows:root.children.every(m=>m.castShadow),
   palmCollisions:p.palms.every(t=>q.G.world.colliders.some(c=>Math.hypot(c.x-t.x,c.z-t.z)<.01&&c.trunk)),
   terrainShoreline:!!bank&&bank.receiveShadow};
 });
 checks.noBrowserErrors=!errors.length;checks.withinBudgets=rows.every(r=>r.gl===0&&!r.errors.length&&r.treeTriangles<=r.treeBudget);
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({checks,rows,errors},null,2));console.log(JSON.stringify(checks));
 assert(Object.values(checks).every(Boolean),'Regional rendering failed');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});

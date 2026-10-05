const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),QA=require('./qa-platform.cjs');
const out=path.resolve(process.env.QA_OUTPUT||'output/intro-chalk-collisions');fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await QA.chromium.launch({headless:true,args:QA.gpuArgs()});try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 // The static preview has no account server; use a signed-out account fixture.
 await page.route('**/api/me',route=>route.fulfill({contentType:'application/json',body:'null'}));
 await page.addInitScript(()=>{let seed=712761;Math.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);});
 await page.route('**/ranch3d.html*',async route=>{const r=await route.fetch();await route.fulfill({response:r,body:(await r.text()).replace('const MERGE_STATS=mergeStatics();',`window.__qa={THREE,scene,camera,renderer,composer,G,keys,player,groundH,step(dt){manualStepping=true;tick(dt)},day(v=.30){dayT=v;weather.mode='clear';weather.timer=99999}};const MERGE_STATS=mergeStatics();`)});});
 await page.goto(QA.BASE+'/ranch3d.html?qa=intro-chalk-collisions',{timeout:120000});await page.waitForFunction(()=>window.__qa?.G.horse.RIG().ready&&!document.getElementById('load'),null,{timeout:120000});
 await page.evaluate(async()=>{const q=__qa;q.G.wardrobe?.closeChar();q.G.hidePanels();q.G.save.sync(s=>s.qualityLocked=true);await q.G.photoscans.ready;await q.G.worldDetails.ready;await q.G.world.ranchBuilderArt.ready;advanceTime(0);q.day();q.step(.01);});
 const result=await page.evaluate(async()=>{
  const q=__qa,T=q.THREE,W=q.G.world,down=q.G.vistas.chalkDown,s=down.site,{createSolidWorld,recordSolidPart}=await import('./assets/solid-collisions.js?v=solid-world-1');
  const heightError=[],mare=down.root.getObjectByName('Chalk Mare | ground cutting'),p=mare.geometry.attributes.position;
  for(let i=0;i<p.count;i+=7)heightError.push(p.getY(i)-W.groundH(p.getX(i),p.getZ(i)));
  const f=Math.atan2(s.x,s.z),ax=Math.cos(f),az=-Math.sin(f),ox=Math.sin(f),oz=Math.cos(f),surface=[];
  for(let u=-s.len/2;u<=s.len/2;u+=8)for(const t of[0,.15,.30,.5,.75,1]){
   const x=s.x+ax*u+ox*(t-.5)*s.depth,z=s.z+az*u+oz*(t-.5)*s.depth;surface.push({x,z,height:W.groundH(x,z),base:W.terrainH(x,z),surface:down.heightAt(x,z),edge:t===0||t===1||u===-s.len/2});
  }
  const world=createSolidWorld({THREE:T}),shelter=W.ranchBuilderArt.create('shelter');world.register(shelter);
  const open={x:0,z:2.5};for(let i=0;i<15;i++){open.z-=.15;world.resolve(open,{bottom:.38,top:2.3,radius:.55});}
  const wall={x:2.2,z:0};world.resolve(wall,{bottom:.38,top:2.3,radius:.55});
  const placed=q.G.ranchSys.spawnDecor({id:'qa-collision-piece',t:'wall',x:350,z:100,ry:.35});
  const registered=W.solidWorld.hasParts(placed.g),before=W.solidWorld.stats();
  const contacts=()=>{const p={x:placed.g.position.x,z:placed.g.position.z};return W.solidWorld.resolve(p,{bottom:W.groundH(p.x,p.z)+.38,top:W.groundH(p.x,p.z)+2.65,radius:.55});};
  const placedHit=contacts();placed.g.position.x=354;W.solidWorld.register(placed.g,{primitives:true});const movedHit=contacts();
  const old={x:350,z:100},oldHit=W.solidWorld.resolve(old,{bottom:W.groundH(350,100)+.38,top:W.groundH(350,100)+2.65,radius:.55});
  q.G.ranchSys.removeDecor(placed);const removed={x:354,z:100},removedHit=W.solidWorld.resolve(removed,{bottom:W.groundH(354,100)+.38,top:W.groundH(354,100)+2.65,radius:.55});
  // Exercise the game's movement loop against a thin wall, not just the solver.
  const fixture=new T.Group();fixture.position.set(350,W.groundH(350,100),100);q.scene.add(fixture);
  recordSolidPart(T,fixture,new T.BoxGeometry(6,5,.1),new T.MeshStandardMaterial(),new T.Matrix4().makeTranslation(0,2.5,0));W.solidWorld.register(fixture);
  q.player.pos.set(350,0,104);q.player.heading=Math.PI;q.player.y=0;q.player.flying=false;q.player.speed=8;q.keys.KeyW=true;
  const render=q.renderer.render;q.renderer.render=()=>{};try{for(let i=0;i<80;i++)q.step(.05);}finally{q.renderer.render=render;q.keys.KeyW=false;}
  const rideStop=q.player.pos.z;W.solidWorld.unregister(fixture);q.scene.remove(fixture);
  const start=performance.now();for(let i=0;i<600;i++){const pos={x:-18+i%20*.3,z:-20};W.solidWorld.resolve(pos,{bottom:.38,top:2.65,radius:.55});}const msPerResolve=(performance.now()-start)/600;
  const docks=[];q.scene.traverse(o=>{if(o.userData.sceneryArt?.kind==='dock'){const pos=o.getWorldPosition(new T.Vector3());docks.push({ground:W.groundH(pos.x,pos.z),deck:pos.y});}});
  return {heightError:{min:Math.min(...heightError),max:Math.max(...heightError)},surface,figure:down.stats,collision:before,registered,placedHit,movedHit,oldHit,removedHit,open,wall,rideStop,msPerResolve,docks,
   treesOnDown:q.G.photoscans.treePositions.filter(p=>q.G.vistas.clearZones.some(f=>f(p.x,p.z))).length,errors:q.G.errors,scanErrors:[...q.G.photoscans.errors,...q.G.worldDetails.errors]};
 });
 const checks={chalkGrounded:result.heightError.min>=.018&&result.heightError.max<.03,terrainMatches:result.surface.every(p=>p.height>=p.base&&(!Number.isFinite(p.surface)||Math.abs(p.height-p.surface)<(p.edge?.005:.001))),edgeJoins:result.surface.filter(p=>p.edge).every(p=>Math.abs(p.height-p.base)<.001),shelterEntrance:result.open.z<.5,shelterWall:result.wall.x>2.5,placed:result.registered&&result.placedHit>0&&result.movedHit>0,oldAndRemovedClear:result.oldHit===0&&result.removedHit===0,movementStops:result.rideStop>=100.60&&result.rideStop<102,docksSupported:result.docks.length>0&&result.docks.every(d=>Math.abs(d.ground-d.deck)<.01),noTreesOnDown:result.treesOnDown===0,noErrors:errors.length===0&&result.errors.length===0&&result.scanErrors.length===0};
 console.log(JSON.stringify({checks,result,errors},null,2));fs.writeFileSync(path.join(out,'world-qa.json'),JSON.stringify({checks,result,errors},null,2));
 for(const close of[false,true]){const img=await page.evaluate(close=>{const q=__qa,s=q.G.vistas.SCARP,f=Math.atan2(s.x,s.z),ox=Math.sin(f),oz=Math.cos(f),distance=close?46:88,x=s.x-ox*distance,z=s.z-oz*distance;q.player.pos.set(x,0,z);q.player.speed=0;q.step(.01);q.player.mesh.visible=false;q.camera.position.set(x,q.groundH(x,z)+(close?4:3),z);q.camera.lookAt(s.x,q.groundH(s.x,s.z)-s.h*.25,s.z);q.composer.render();return q.renderer.domElement.toDataURL('image/webp',.92).split(',')[1];},close);fs.writeFileSync(path.join(out,close?'chalk-close.webp':'chalk-viewpoint.webp'),Buffer.from(img,'base64'));}
 assert(Object.values(checks).every(Boolean),'World integration checks failed');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});

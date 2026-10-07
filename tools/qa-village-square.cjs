// Focused native-GPU and mounted-clearance checks for Cottonwood's larger landmarks.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),QA=require('./qa-platform.cjs');
const layoutOnly=process.argv.includes('--layout-only');
const out=path.resolve(process.argv[2]||'output/village-square');fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await QA.chromium.launch({headless:true,args:QA.gpuArgs()});try{
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await page.route('**/api/me',r=>r.fulfill({contentType:'application/json',body:'null'}));
 await page.route('**/ranch3d.html*',async r=>{const res=await r.fetch();await r.fulfill({response:res,body:(await res.text()).replace('const MERGE_STATS=mergeStatics();',`window.__villageQA={THREE,scene,camera,renderer,composer,G,player,groundH,TACK,nearGrass,npcCharacters,keys,step(dt){manualStepping=true;tick(dt)},day(t=.34,rain=false){dayT=t;weather.mode=rain?'rain':'clear';weather.timer=99999}};const MERGE_STATS=mergeStatics();`)});});
 await page.addInitScript(seed=>{Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};},Number(process.env.QA_SEED||928471));
 await page.goto(QA.BASE+'/ranch3d.html?qa=village-square',{timeout:120000});await page.waitForFunction(()=>window.__villageQA?.G.horse.RIG().ready&&!document.getElementById('load'),null,{timeout:120000});
 await page.evaluate(async()=>{const q=__villageQA;q.G.save.sync(s=>s.qualityLocked=true);q.G.wardrobe?.closeChar();q.G.hidePanels();await q.G.photoscans.ready;await q.G.worldDetails.ready;advanceTime(0);});
 console.log('Village ready');const rows=[];
 for(const c of layoutOnly?[]:[{name:'store',id:'store',eye:[4,4.7,8.5]},{name:'clubhouse',id:'clubhouse',eye:[6,5.3,11]},{name:'inn',id:'inn',eye:[4,4.7,10]},
  {name:'village-street',eye:[32,3,-33],look:[48,4,-64]},{name:'square',eye:[45,2.7,-41],look:[51,3,-65]},{name:'aerial',eye:[67,65,-10],look:[47,0,-54]},{name:'village-skyline',eye:[85,4,-150],look:[20,5,-35]},
  {name:'store-rain',id:'store',eye:[4,4.7,8.5],rain:true},{name:'store-night',id:'store',eye:[4,4.7,8.5],time:0},
  {name:'store-medium',id:'store',eye:[4,4.7,8.5],tier:'medium'},{name:'store-low',id:'store',eye:[4,4.7,8.5],tier:'low'}]){
  const row=await page.evaluate(async c=>{const q=__villageQA,T=q.THREE;q.G.gfx.apply(c.tier||'high');
   let eye=new T.Vector3(...c.eye),look=new T.Vector3(...(c.look||[0,3.8,0]));
   if(c.id){const root=q.G.worldPkg.LANDMARKS.find(l=>l.id==='cottonwood:'+c.id).grp;eye=root.localToWorld(eye);look=root.localToWorld(look);}else{eye.y+=q.groundH(eye.x,eye.z);look.y+=q.groundH(look.x,look.z);}
   q.player.pos.set(eye.x,0,eye.z);q.player.speed=0;const render=q.renderer.render;q.renderer.render=()=>{};
   try{for(let i=0;i<210;i++){q.day(c.time??.34,c.rain);q.step(1/30);q.scene.onBeforeRender();}
    for(let i=0;i<180&&q.npcCharacters.stats().pending;i++){q.step(.016);await new Promise(r=>setTimeout(r,30));}
   }finally{q.renderer.render=render;}
   q.player.mesh.visible=false;for(const o of Object.values(q.TACK||{}))if(o?.isObject3D)o.visible=false;
   const reins=q.scene.getObjectByName('Native leather split reins');if(reins)reins.visible=false;
   q.camera.position.copy(eye);q.camera.lookAt(look);q.G.waterReflections.update(performance.now()+100);q.composer.render();
   const rt=q.composer.readBuffer,p=new Uint16Array(Math.floor(rt.width)*Math.floor(rt.height)*4);q.renderer.readRenderTargetPixels(rt,0,0,Math.floor(rt.width),Math.floor(rt.height),p);let invalid=0,minAlphaBits=65535;for(let i=0;i<p.length;i++){if(i%4===3)minAlphaBits=Math.min(minAlphaBits,p[i]);else if((p[i]&0x7c00)===0x7c00)invalid++;}
   return {name:c.name,invalid,minAlphaBits,gl:q.renderer.getContext().getError(),image:q.renderer.domElement.toDataURL('image/webp',.96).split(',')[1]};
  },c);fs.writeFileSync(path.join(out,c.name+'.webp'),Buffer.from(row.image,'base64'));delete row.image;rows.push(row);console.log(c.name);
 }
 const state=await page.evaluate(()=>{const q=__villageQA,T=q.THREE,W=q.G.world,courts=q.G.villageCourts,buildings=[];
  const wallDistance=(x,z,w)=>{const dx=w.x2-w.x1,dz=w.z2-w.z1,t=Math.max(0,Math.min(1,((x-w.x1)*dx+(z-w.z1)*dz)/(dx*dx+dz*dz||1)));return Math.hypot(x-w.x1-t*dx,z-w.z1-t*dz);};
  for(const l of q.G.worldPkg.LANDMARKS.filter(l=>l.grp?.userData.architecture?.kind==='townhouse')){
   const root=l.grp,a=root.userData.architecture,collisions=[];
   for(let z=a.depth/2+2.8;z>a.depth/2+(a.store?-.5:.85);z-=.15){
    const p=root.localToWorld(new T.Vector3(0,0,z)),ground=q.groundH(p.x,p.z),position={x:p.x,z:p.z};
    if(W.solidWorld.resolve(position,{bottom:ground+.38,top:ground+2.65,radius:.55})||W.walls.some(w=>wallDistance(p.x,p.z,w)<.65))collisions.push({x:p.x,z:p.z});
   }
   let soilGrass=0;const matrix=new T.Matrix4(),p=new T.Vector3();q.nearGrass.tick(1,root.position.x,root.position.z);
   for(const im of[q.nearGrass.near,q.nearGrass.meadowDistance.mesh,q.nearGrass.lupin])for(let i=0;i<im.count;i++){
    im.getMatrixAt(i,matrix);if(Math.abs(matrix.determinant())<1e-8)continue;p.setFromMatrixPosition(matrix);if(courts.contains(p.x,p.z,-.05))soilGrass++;
   }
   const door=W.things.find(t=>t.id===l.id),garden=root.getObjectByName('Cottage | living window boxes');
   buildings.push({id:l.id,x:l.x,z:l.z,architecture:a,collisions,soilGrass,interaction:!!door&&door.x===l.x&&door.z===l.z&&typeof door.use==='function',gardenPlants:garden?.children.reduce((n,o)=>n+(o.count||0),0)||0});
  }
  const hedge=q.scene.getObjectByName('worldPaths:leaves'),m=new T.Matrix4(),v=new T.Vector3();let hedgesInCourts=0;
  for(let i=0;i<hedge.count;i++){hedge.getMatrixAt(i,m);if(Math.abs(m.determinant())<1e-8)continue;v.setFromMatrixPosition(m);if(courts.contains(v.x,v.z,.9))hedgesInCourts++;}
  const walkHits=[];
  for(const shopWalk of q.G.worldPkg.townsfolk.filter(f=>f.def.id.startsWith('cw_')))for(let j=0;j<shopWalk.path.length;j++){
   const a=shopWalk.path[j],b=shopWalk.path[(j+1)%shopWalk.path.length],n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.15);
   for(let i=0;i<=n;i++){const x=a[0]+(b[0]-a[0])*i/n,z=a[1]+(b[1]-a[1])*i/n,g=q.groundH(x,z),pos={x,z};
    if(W.solidWorld.resolve(pos,{bottom:g+.2,top:g+1.9,radius:.36})||W.walls.some(w=>wallDistance(x,z,w)<.4)||W.colliders.some(c=>!c.precise&&Math.hypot(x-c.x,z-c.z)<c.r+.36))walkHits.push({id:shopWalk.def.id,x,z});}
  }
  const p=courts.mesh.geometry.attributes.position;let groundError=0;for(let i=0;i<p.count;i++)groundError=Math.max(groundError,Math.abs(p.getY(i)-q.groundH(p.getX(i),p.getZ(i))-.055));
  const routeHits=[];for(const [start,end]of[[[28,-30],[44,-46]],[[44,-46],[50,-53]]]){
   const n=Math.ceil(Math.hypot(end[0]-start[0],end[1]-start[1])/.4);for(let i=0;i<=n;i++){
    const x=start[0]+(end[0]-start[0])*i/n,z=start[1]+(end[1]-start[1])*i/n,g=q.groundH(x,z),pos={x,z};
    if(W.solidWorld.resolve(pos,{bottom:g+.38,top:g+2.65,radius:.55}))routeHits.push({x,z});
   }
  }
  q.player.pos.set(28,0,-30);q.player.heading=Math.atan2(16,-16);q.player.speed=0;q.player.y=0;q.player.vy=0;q.player.flying=false;q.G.followCam.reset();q.keys.KeyW=true;
  const oldRender=q.renderer.render;q.renderer.render=()=>{};let steps=0;
  try{for(;steps<360;steps++){q.day();q.step(1/30);if(Math.hypot(q.player.pos.x-28,q.player.pos.z+30)>20)break;}}finally{q.keys.KeyW=false;q.renderer.render=oldRender;}
  const ride={distance:Math.hypot(q.player.pos.x-28,q.player.pos.z+30),x:q.player.pos.x,z:q.player.pos.z,steps,finite:Number.isFinite(q.player.pos.x+q.player.pos.z+q.camera.position.length())};
  const allPaths=[[[28,-30],[44,-46],[50,-53],[53,-57],[75,-64]],[[48,-44],[48,-60]],[[49,-59],[60,-58],[63,-68],[76,-68],[76,-69.5]]];
  const squareRouteHits=[],unpaved=[],matrixErrors=[];
  for(const route of allPaths)for(let j=1;j<route.length;j++){
   const a=route[j-1],b=route[j],n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.2);
   for(let i=0;i<=n;i++){const x=a[0]+(b[0]-a[0])*i/n,z=a[1]+(b[1]-a[1])*i/n,g=q.groundH(x,z),pos={x,z};
    if(W.solidWorld.resolve(pos,{bottom:g+.38,top:g+2.65,radius:.55})||W.colliders.some(c=>!c.precise&&Math.hypot(x-c.x,z-c.z)<c.r+.55)||W.walls.some(w=>wallDistance(x,z,w)<.65))squareRouteHits.push({x,z});
    if(!courts.contains(x,z,.15))unpaved.push({x,z});
   }
  }
  const fountainHit=W.colliders.some(c=>Math.hypot(c.x-53.8,c.z+49)<.01&&c.r>1.5),gardenHits=courts.gardens.map(b=>{const p={x:b.x,z:b.z},g=q.groundH(b.x,b.z);return W.solidWorld.resolve(p,{bottom:g+.1,top:g+1.8,radius:.4})>0;});
  const plots=q.G.worldPkg.LANDMARKS.filter(l=>l.id.startsWith('cottonwood:')).map(l=>({id:l.id,x:l.x,z:l.z,width:l.grp.userData.architecture.width}));
  q.G.gfx.apply('high');const mounted=[];
  for(const route of allPaths){
   q.player.pos.set(route[0][0],0,route[0][1]);q.player.y=q.player.vy=q.player.speed=0;q.player.flying=false;q.G.followCam.reset();q.keys.KeyW=true;
   let wi=1,steps=0,maxGroundError=0,minCameraHeight=Infinity;q.renderer.render=()=>{};
   try{for(;steps<1800&&wi<route.length;steps++){
    const target=route[wi],d=Math.hypot(target[0]-q.player.pos.x,target[1]-q.player.pos.z);if(d<.65){wi++;continue;}
    q.player.heading=Math.atan2(target[0]-q.player.pos.x,target[1]-q.player.pos.z);q.day();q.step(1/30);
    maxGroundError=Math.max(maxGroundError,Math.abs(q.player.mesh.position.y-q.groundH(q.player.pos.x,q.player.pos.z)));
    minCameraHeight=Math.min(minCameraHeight,q.camera.position.y-q.groundH(q.camera.position.x,q.camera.position.z));
   }}finally{q.renderer.render=oldRender;q.keys.KeyW=false;}
   mounted.push({waypoints:wi,total:route.length,steps,maxGroundError,minCameraHeight,end:q.player.pos.toArray()});
  }
  return {villageTrees:q.G.photoscans.treePositions.filter(t=>t.kind==='village'),mounted,squareRouteHits,unpaved,fountainHit,gardenHits,plots,squareGardenPlants:q.G.worldDetails.squareGardenPlants,buildings,groundError,routeHits,ride,hedgesInCourts,walkHits,courtTriangles:courts.mesh.geometry.index.count/3,courts:courts.zones.length,clearedPlants:courts.cleared,
   gardens:q.G.worldDetails.townhouseGardens,featureErrors:q.G.errors,assetErrors:[...q.G.worldDetails.errors,...q.G.photoscans.errors]};
 });
 const checks={opaqueScene:rows.every(r=>r.minAlphaBits>=15358),shadeTrees:state.villageTrees.length===3,mountedAllStreets:state.mounted.every(r=>r.waypoints===r.total&&r.maxGroundError<.1&&r.minCameraHeight>.1),squareRoutesClear:state.squareRouteHits.length===0,continuousPaving:state.unpaved.length===0,fountainCollision:state.fountainHit,gardenCollisions:state.gardenHits.every(Boolean),plantedSquare:state.squareGardenPlants>90,fixedPlots:JSON.stringify(state.plots.map(p=>[p.x,p.z]))===JSON.stringify([[34,-57],[76,-74],[33,-43],[47,-66]]),threeLandmarks:state.buildings.length===3,twoStoreyGeometry:state.buildings.every(b=>b.architecture.storeys===2&&b.architecture.roofStyle==='hipped-clay'),
  geometryBudget:state.buildings.every(b=>b.architecture.triangles<12000&&b.architecture.drawCalls<=16),
  clearDoorApproaches:state.buildings.every(b=>b.collisions.length===0),clearVillageRoute:state.routeHits.length===0,mountedVillageTravel:state.ride.distance>19.5&&state.ride.finite,
  plantedFacades:state.gardens===3&&state.buildings.every(b=>b.gardenPlants===24),interactionsPreserved:state.buildings.every(b=>b.interaction),
  allTownWalksClear:state.walkHits.length===0,hedgesRespectEntrances:state.hedgesInCourts===0,connectedSquare:state.courts===12&&state.courtTriangles>300&&state.courtTriangles<25000,groundedPaving:state.groundError<.001,
  noGrassThroughPaving:state.buildings.every(b=>b.soilGrass===0),finitePixels:rows.every(r=>r.invalid===0),validWebGL:rows.every(r=>r.gl===0),
  noErrors:errors.length===0&&state.featureErrors.length===0&&state.assetErrors.length===0};
 if(layoutOnly)for(const key of ['opaqueScene','finitePixels','validWebGL'])delete checks[key];
 if(!layoutOnly){const mountedImage=await page.evaluate(()=>{
  const q=__villageQA;q.G.gfx.apply('high');q.player.pos.set(45,0,-43);q.player.heading=Math.PI;q.player.y=q.player.vy=q.player.speed=0;q.G.followCam.reset();q.player.mesh.visible=true;
  for(const o of Object.values(q.TACK||{}))if(o?.isObject3D)o.visible=true;const reins=q.scene.getObjectByName('Native leather split reins');if(reins)reins.visible=true;
  const old=q.renderer.render;q.renderer.render=()=>{};try{for(let i=0;i<90;i++){q.day();q.step(1/30);}}finally{q.renderer.render=old;}
  q.composer.render();return q.renderer.domElement.toDataURL('image/webp',.96).split(',')[1];
 });fs.writeFileSync(path.join(out,'mounted-square.webp'),Buffer.from(mountedImage,'base64'));}
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({checks,rows,state,errors},null,2));console.log(JSON.stringify({checks,mounted:state.mounted,routeHits:state.squareRouteHits,walkHits:state.walkHits,groundError:state.groundError,errors}));assert(Object.values(checks).every(Boolean),'Village square acceptance failed');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

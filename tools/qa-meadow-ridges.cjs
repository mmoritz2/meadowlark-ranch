// Landscape composition acceptance: actual terrain, surviving trunks, water and
// mounted travel. Debug controls exist only in the test's intercepted response.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),QA=require('./qa-platform.cjs');
const out=path.resolve(process.argv[2]||'output/meadow-ridges');fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await QA.chromium.launch({headless:true,args:QA.gpuArgs()});try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('**/api/me',r=>r.fulfill({contentType:'application/json',body:'null'}));
 await page.route('**/ranch3d.html*',async r=>{const res=await r.fetch();await r.fulfill({response:res,body:(await res.text()).replace('const MERGE_STATS=mergeStatics();',`window.__qa={THREE,scene,camera,renderer,composer,G,player,groundH,terrainH,riverZ,riverLevel,streamX,streamLevel,BR_A,BR_B,keys,TACK,step(dt){manualStepping=true;tick(dt)},day(){dayT=.34;weather.mode='clear';weather.timer=99999}};const MERGE_STATS=mergeStatics();`)});});
 await page.addInitScript(()=>{let seed=928471;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};});
 await page.goto(QA.BASE+'/ranch3d.html?qa=meadow-ridges',{timeout:120000});await page.waitForFunction(()=>window.__qa?.G.horse.RIG().ready&&!document.getElementById('load'),null,{timeout:120000});
 await page.evaluate(async()=>{const q=__qa;q.G.save.sync(s=>s.qualityLocked=true);q.G.wardrobe?.closeChar();q.G.hidePanels();await q.G.photoscans.ready;await q.G.worldDetails.ready;advanceTime(0);q.G.gfx.apply('high');q.day();});
 const state=await page.evaluate(async()=>{
  const q=__qa,T=q.THREE,W=q.G.world,P=q.G.photoscans,{MEADOW_OPENINGS,inMeadowOpening}=await import('./assets/pastoral-fields.mjs?v=meadow-ridges-1');
  const terrain=q.scene.getObjectByName('Pasture terrain');terrain.updateMatrixWorld(true);const points=[];
  for(let x=-350;x<=350;x+=35)for(let z=-350;z<=350;z+=35){const px=x+.37,pz=z+.61,hit=new T.Raycaster(new T.Vector3(px,200,pz),new T.Vector3(0,-1,0)).intersectObject(terrain)[0];points.push(hit?Math.abs(hit.point.y-q.terrainH(px,pz)):Infinity);}
  const openings=MEADOW_OPENINGS.map(c=>({...c,trees:P.treePositions.filter(t=>Math.hypot((t.x-c.x)/c.rx,(t.z-c.z)/c.rz)<.5).length}));
  const removed=P.meadowClearings||[],ghostTrunks=removed.filter(t=>W.colliders.some(c=>c.r<=1.2&&Math.hypot(c.x-t.x,c.z-t.z)<.15)),ghostCamera=removed.filter(t=>W.forestPoints.some(c=>Math.hypot(c.x-t.x,c.z-t.z)<.15));
  const river=[],creek=[];for(let x=-440;x<=440;x+=4)river.push(q.riverLevel(x)-q.terrainH(x,q.riverZ(x)));for(let z=-300;z<156;z+=3)creek.push(q.streamLevel(z)-q.terrainH(q.streamX(z),z));
  const routes=q.G.worldPaths.tracks.map(t=>({id:t.id,grade:Math.max(...t.pts.slice(1).map((p,i)=>Math.abs(q.groundH(...p)-q.groundH(...t.pts[i]))/(Math.hypot(p[0]-t.pts[i][0],p[1]-t.pts[i][1])||1)))}));
  return {terrainError:Math.max(...points),terrainSamples:points.length,openings,removed,ghostTrunks,ghostCamera,treesInOpenings:P.treePositions.filter(t=>inMeadowOpening(t.x,t.z)),totalTrees:P.treePositions.length,riverDepth:Math.min(...river),creekDepth:Math.min(...creek),routes,featureErrors:[...q.G.errors,...P.errors]};
 });
 console.log('Landscape loaded',JSON.stringify({trees:state.totalTrees,clearings:state.openings.length,removed:state.removed.length,terrainError:state.terrainError}));
 const rides=await page.evaluate(()=>{
  const q=__qa,p=q.player,render=q.renderer.render,result=[];q.renderer.render=()=>{};
  const clover=q.G.worldPaths.tracks.find(t=>t.id==='clover').pts;
  const paths=[{id:'clover-up',points:clover.slice(15,51)},{id:'clover-down',points:clover.slice(15,51).reverse()}, {id:'bridge',points:[[0,q.BR_A-4],[0,q.BR_A],[0,q.BR_B],[0,q.BR_B+4]]}];
  try{for(const route of paths){
   const pts=route.points;p.pos.set(pts[0][0],0,pts[0][1]);p.y=0;p.vy=0;p.speed=0;p.flying=false;p.onFoot=false;p.stam=1;q.G.riding.selectGait('canter');q.G.followCam.reset();q.keys.KeyW=true;
   let next=1,travel=0,stepHeight=0,contact=0,finite=true,lastY=q.groundH(p.pos.x,p.pos.z),lo=lastY,hi=lastY;
   for(let i=0;i<1200&&next<pts.length;i++){
    const target=pts[next],dx=target[0]-p.pos.x,dz=target[1]-p.pos.z;if(Math.hypot(dx,dz)<1.0){next++;continue;}
    p.heading=Math.atan2(dx,dz);const x=p.pos.x,z=p.pos.z;q.step(1/30);const y=q.groundH(p.pos.x,p.pos.z);travel+=Math.hypot(p.pos.x-x,p.pos.z-z);stepHeight=Math.max(stepHeight,Math.abs(y-lastY));lastY=y;lo=Math.min(lo,y);hi=Math.max(hi,y);
    contact=Math.max(contact,Math.abs(p.mesh.position.y-y));finite&&=[p.pos.x,p.pos.z,p.mesh.position.y,p.mesh.rotation.x].every(Number.isFinite);
   }
   q.keys.KeyW=false;result.push({id:route.id,reached:next===pts.length,travel,stepHeight,contact,finite,relief:hi-lo,end:[p.pos.x,p.pos.z],target:pts.at(-1)});
  }}finally{q.keys.KeyW=false;q.renderer.render=render;}return result;
 });
 const views=[{name:'clover-overlook',eye:[85,3,-150],look:[32,4,-66]},{name:'clover-ridge',eye:[32,2.3,-122],look:[60,2,-175]},{name:'eastern-fields',eye:[149,3,17],look:[209,3,52]},{name:'north-meadow',eye:[25,2.6,214],look:[70,3,260]}];
 const frames=[];
 for(const v of views){const data=await page.evaluate(async v=>{
  const q=__qa;q.player.pos.set(v.eye[0],0,v.eye[2]);q.player.speed=0;q.day();const render=q.renderer.render;q.renderer.render=()=>{};try{for(let i=0;i<25;i++)q.step(.1);for(let i=0;i<120&&q.G.world.npcCharacters.stats().pending;i++){q.step(.016);await new Promise(r=>setTimeout(r,40));}}finally{q.renderer.render=render;}
  q.player.mesh.visible=false;for(const o of Object.values(q.TACK||{}))if(o?.isObject3D)o.visible=false;const reins=q.scene.getObjectByName('Native leather split reins');if(reins)reins.visible=false;
  q.camera.position.set(v.eye[0],q.groundH(v.eye[0],v.eye[2])+v.eye[1],v.eye[2]);q.camera.lookAt(v.look[0],q.groundH(v.look[0],v.look[2])+v.look[1],v.look[2]);q.composer.render();
  const rt=q.composer.readBuffer,w=Math.floor(rt.width),h=Math.floor(rt.height),px=new Uint16Array(w*h*4);q.renderer.readRenderTargetPixels(rt,0,0,w,h,px);let invalid=0;for(let i=0;i<px.length;i++)if(i%4!==3&&(px[i]&0x7c00)===0x7c00)invalid++;
  return {image:q.renderer.domElement.toDataURL('image/webp',.94).split(',')[1],invalid,gl:q.renderer.getContext().getError()};
 },v);fs.writeFileSync(path.join(out,v.name+'.webp'),Buffer.from(data.image,'base64'));delete data.image;frames.push({name:v.name,...data});console.log(v.name,JSON.stringify(data));}
 const checks={terrainMatchesRiding:state.terrainError<.0001&&state.terrainSamples>400,openPastures:state.openings.length===5&&state.removed.length>15&&state.treesInOpenings.length===0,removedTrunksStayRemoved:!state.ghostTrunks.length&&!state.ghostCamera.length,woodlandRetained:state.totalTrees>1500,riverAndCreekBelowWater:state.riverDepth>.25&&state.creekDepth>.20,meadowBridlewayGrade:state.routes.find(r=>r.id==='clover').grade<.60,mountedHillAndBridgeTravel:rides.every(r=>r.reached&&r.finite&&r.stepHeight<.4&&r.contact<.15),hillRideHasRelief:rides.slice(0,2).every(r=>r.relief>4),validMeadowPixels:frames.every(f=>f.invalid===0&&f.gl===0),noErrors:!errors.length&&!state.featureErrors.length};
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({checks,state,rides,frames,errors},null,2));console.log(JSON.stringify({checks,rides}));assert(Object.values(checks).every(Boolean),'Meadow composition acceptance failed');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

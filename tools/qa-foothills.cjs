// Native-GPU review: connected outer terrain, woodland, haze and protected riding ground.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),QA=require('./qa-platform.cjs');
const baseline=process.env.QA_FOOTHILLS_BASELINE==='1';
const out=path.resolve(process.argv[2]||'output/foothills');fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await QA.chromium.launch({headless:true,args:QA.gpuArgs()});try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error(e.message)});page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await page.route('**/api/me',r=>r.fulfill({contentType:'application/json',body:'null'}));
 await page.route('**/ranch3d.html*',async r=>{const res=await r.fetch();await r.fulfill({response:res,body:(await res.text()).replace('const MERGE_STATS=mergeStatics();',`window.__edgeQA={THREE,scene,camera,renderer,composer,G,player,groundH,terrainH,keys,TACK,FALLS,step(dt){manualStepping=true;tick(dt)},day(t=.34,rain=false){dayT=t;weather.mode=rain?'rain':'clear';weather.timer=99999}};const MERGE_STATS=mergeStatics();`)});});
 await page.addInitScript(()=>{let seed=928471;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};});
 await page.goto(QA.BASE+'/ranch3d.html?qa=foothills',{timeout:120000});await page.waitForFunction(()=>window.__edgeQA?.G.horse.RIG().ready&&!document.getElementById('load'),null,{timeout:120000});
 await page.evaluate(async()=>{const q=__edgeQA;q.G.save.sync(s=>{s.qualityLocked=true;s.unlocked=s.unlocked||{};for(const r of q.G.tables.REGIONS)if(r.unlock)s.unlocked[r.id]=true;});q.G.wardrobe?.closeChar();q.G.hidePanels();await q.G.photoscans.ready;await q.G.worldDetails.ready;await q.G.worldPkg.oasisReady;advanceTime(0);q.day();q.G.gfx.apply('high');q.fallsModule=await import('./assets/falls-landscape.js?v=alpine-range-1');q.wildHabitatErrors=[];q.reviewVisibility=[q.player.mesh,...Object.values(q.TACK||{}),q.scene.getObjectByName('Native leather split reins')].filter(o=>o?.isObject3D).map(o=>[o,o.visible]);
  q.read=rt=>{const w=Math.floor(rt.width),h=Math.floor(rt.height),p=new Uint16Array(w*h*4);q.renderer.readRenderTargetPixels(rt,0,0,w,h,p);let invalid=0,minAlpha=1;for(let i=0;i<p.length;i+=4){minAlpha=Math.min(minAlpha,q.THREE.DataUtils.fromHalfFloat(p[i+3]));if([0,1,2].some(c=>(p[i+c]&0x7c00)===0x7c00))invalid++;}return{invalid,minAlpha};};
 });console.log('Countryside ready');

 const rows=[];for(const c of[
  {name:'northern-range',eye:[-135,90,-195],look:[-158,20,-480]},
  {name:'north-boundary',eye:[-145,5,-428],look:[-180,24,-690],relative:true},
  {name:'west-boundary',eye:[-429,4,0],look:[-800,36,0],relative:true},
  {name:'east-boundary',eye:[429,4,-32],look:[750,35,-80],relative:true},
  {name:'south-boundary',eye:[0,4,429],look:[50,35,820],relative:true},
  {name:'marsh-distance',eye:[300,7,332],look:[540,28,580],relative:true},
  {name:'canyon-distance',eye:[-217,32,148],look:[-720,50,170]},
  {name:'aerial',eye:[0,260,360],look:[0,10,-300]},
  {name:'north-night',eye:[-145,5,-428],look:[-180,24,-690],relative:true,time:0},
  {name:'west-sunset',eye:[-429,4,0],look:[-800,36,0],relative:true,time:.78},
  {name:'west-rain',eye:[-429,4,0],look:[-800,36,0],relative:true,rain:true},
  {name:'west-medium',eye:[-429,4,0],look:[-800,36,0],relative:true,tier:'medium'},
  {name:'west-low',eye:[-429,4,0],look:[-800,36,0],relative:true,tier:'low'}
 ]){const row=await page.evaluate(c=>{const q=__edgeQA;q.G.gfx.apply(c.tier||'high');q.player.pos.set(c.eye[0],0,c.eye[2]);q.player.speed=q.player.y=q.player.vy=0;q.player.flying=false;const render=q.renderer.render;q.renderer.render=()=>{};
  try{for(let i=0;i<100;i++){q.day(c.time??.34,c.rain);q.step(1/30);}}finally{q.renderer.render=render;}
  for(const [o]of q.reviewVisibility)o.visible=false;
  if(c.relative)c.eye[1]+=q.groundH(c.eye[0],c.eye[2]);q.camera.position.set(...c.eye);q.camera.lookAt(...c.look);q.G.waterReflections.update(performance.now()+100);
  let source;const pass=q.composer.passes[0],original=pass.render;pass.render=function(renderer,write,read,...rest){original.call(this,renderer,write,read,...rest);source=q.read(read);};try{q.composer.render();}finally{pass.render=original;}
  const cv=document.createElement('canvas');cv.width=q.renderer.domElement.width;cv.height=q.renderer.domElement.height;const ctx=cv.getContext('2d');ctx.drawImage(q.renderer.domElement,0,0);const pixels=ctx.getImageData(0,0,cv.width,cv.height).data;let partial=0;for(let i=3;i<pixels.length;i+=4)if(pixels[i]!==255)partial++;
  return{name:c.name,source,partial,buffers:[q.composer.renderTarget1,q.composer.renderTarget2].map(q.read),gl:q.renderer.getContext().getError(),image:q.renderer.domElement.toDataURL('image/webp',.96).split(',')[1]};
 },c);fs.writeFileSync(path.join(out,c.name+'.webp'),Buffer.from(row.image,'base64'));delete row.image;rows.push(row);console.log(c.name);}
 const state=await page.evaluate(()=>{const q=__edgeQA,L=q.G.world.outerLandscape,ground=[];for(let z=-420;z<=420;z+=35)for(let x=-420;x<=420;x+=35)if(Math.hypot(x,z)<445)ground.push([x,z,q.groundH(x,z)]);
  const r=q.renderer.render;q.renderer.render=()=>{};let maxError=0,maxRadius=0,minCamera=Infinity;try{q.player.pos.set(-420,0,0);q.player.heading=-Math.PI/2;q.player.speed=q.player.y=q.player.vy=0;q.player.flying=false;q.keys.KeyW=true;for(let i=0;i<240;i++){q.day();q.step(1/30);maxRadius=Math.max(maxRadius,Math.hypot(q.player.pos.x,q.player.pos.z));maxError=Math.max(maxError,Math.abs(q.player.mesh.position.y-q.groundH(q.player.pos.x,q.player.pos.z)));minCamera=Math.min(minCamera,q.camera.position.y-q.groundH(q.camera.position.x,q.camera.position.z));}}finally{q.keys.KeyW=false;q.renderer.render=r;}
  let landscape=null;if(L){const p=L.mesh.geometry.attributes.position,idx=L.mesh.geometry.index;const seam=[],below=[],normal=L.mesh.geometry.attributes.normal;
   for(let i=0;i<L.edgeCount;i++){const x=p.getX(i),z=p.getZ(i);seam.push(Math.abs(p.getY(i)-q.terrainH(x,z)));}
   for(let i=0;i<p.count;i++)below.push(Math.hypot(p.getX(i),p.getZ(i)));
   landscape={...L.stats,seamError:Math.max(...seam),nearest:Math.min(...below),finite:Object.values(L.mesh.geometry.attributes).every(a=>Array.from(a.array).every(Number.isFinite)),minNormalY:Math.min(...Array.from({length:normal.count},(_,i)=>normal.getY(i))),visible:L.mesh.visible,shadow:L.mesh.castShadow,static:!L.mesh.matrixAutoUpdate,retiredDisc:!q.scene.getObjectByName('Horizon ground disc')?.visible};}
  return {landscape,ground,ride:{maxError,maxRadius,minCamera},featureErrors:q.G.errors,assetErrors:[...q.G.photoscans.errors,...q.G.worldDetails.errors]};
 });
 fs.writeFileSync(path.join(out,'ground.json'),JSON.stringify(state.ground));
 const checks={opaqueSource:rows.every(r=>r.source.minAlpha>=1-1/2048),opaqueScreen:rows.every(r=>r.partial===0),finitePixels:rows.every(r=>r.source.invalid===0&&r.buffers.every(b=>b.invalid===0)),validWebGL:rows.every(r=>r.gl===0),ridingContact:state.ride.maxError<.001,boundaryPreserved:state.ride.maxRadius<=455.001,cameraAboveGround:state.ride.minCamera>.1,noErrors:!errors.length&&!state.featureErrors.length&&!state.assetErrors.length};
 if(!baseline){Object.assign(checks,{connectedSeam:state.landscape?.seamError<.001,outsideRidingArea:state.landscape?.nearest>=499.99,boundedGeometry:state.landscape?.triangles<100000&&state.landscape?.triangles>10000,woodlandBudget:state.landscape?.woodlandTrees>250&&state.landscape?.woodlandTriangles<9000&&state.landscape?.woodlandDraws<=12,staticLandscape:state.landscape?.static&&!state.landscape?.shadow,finiteLandscape:state.landscape?.finite&&state.landscape?.minNormalY>0,discRetired:state.landscape?.retiredDisc});
 const expected=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/foothills-protected-ground.json'),'utf8'));state.groundError=Math.max(...expected.map((p,i)=>Math.abs(p[2]-state.ground[i][2])));checks.protectedGround=state.groundError<.001;}
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({baseline,checks,rows,state,errors},null,2));console.log(JSON.stringify({checks,landscape:state.landscape,ride:state.ride,errors}));assert(Object.values(checks).every(Boolean),'Foothills acceptance failed');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

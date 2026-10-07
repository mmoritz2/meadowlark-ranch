// Oasis terrain, riding, transparency and attribution checks; GPU timings are diagnostic.
const fs=require('fs'),path=require('path');
const assert=require('node:assert/strict'),QA=require('./qa-platform.cjs');
const out=path.resolve(process.argv[2]||'output/oasis-riding');fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await QA.chromium.launch({headless:true,args:QA.gpuArgs()});try{
const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});const errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
await page.route('**/api/me',r=>r.fulfill({contentType:'application/json',body:'null'}));
await page.route('**/ranch3d.html*',async r=>{const res=await r.fetch();await r.fulfill({response:res,body:(await res.text()).replace('const MERGE_STATS=mergeStatics();',`window.__qa={THREE,scene,camera,renderer,composer,G,player,groundH,TACK,keys,nearGrass,npcCharacters,step(dt){manualStepping=true;tick(dt)},day(){dayT=.34;weather.mode='clear';weather.timer=99999}};const MERGE_STATS=mergeStatics();`)});});
await page.addInitScript(()=>{let seed=928471;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};});
await page.goto(QA.BASE+'/ranch3d.html?qa=world',{timeout:120000});
await page.waitForFunction(()=>window.__qa?.G.horse.RIG().ready&&!document.getElementById('load'),null,{timeout:120000});
await page.evaluate(async()=>{const q=__qa;q.G.save.sync(s=>{s.qualityLocked=true;s.unlocked=s.unlocked||{};for(const rg of q.G.tables.REGIONS)if(rg.unlock)s.unlocked[rg.id]=true;});q.G.wardrobe?.closeChar();q.G.hidePanels();await q.G.photoscans.ready;await q.G.worldDetails.ready;await q.G.worldPkg.oasisReady;await q.G.world.ranchBuilderArt.ready;advanceTime(0);q.day();q.G.gfx.apply('high');});
const oasisDiagnostics=await page.evaluate(async()=>{
 const q=__qa,T=q.THREE,o=q.G.worldPkg.oasis,terrain=q.scene.getObjectByName('Pasture terrain'),bank=q.scene.getObjectByName('Oasis | grounded shoreline');q.scene.updateMatrixWorld(true);
 const contacts=[];for(let i=0;i<20;i++){const a=i*2.39996,r=5+i%5,x=o.x+Math.cos(a)*r,z=o.z+Math.sin(a)*r,ray=new T.Raycaster(new T.Vector3(x,100,z),new T.Vector3(0,-1,0));const t=ray.intersectObject(terrain)[0],b=ray.intersectObject(bank)[0];contacts.push({x,z,terrainError:t?Math.abs(t.point.y-q.groundH(x,z)):Infinity,bankError:b&&t?Math.abs(b.point.y-t.point.y-.012):Infinity});}
 q.player.pos.set(o.x,0,o.z-15);q.player.heading=0;q.player.speed=0;q.player.y=0;q.player.vy=0;q.player.flying=false;q.G.followCam.reset();q.keys.KeyW=true;
 const render=q.renderer.render;q.renderer.render=()=>{};let steps=0,maxBodyOffset=0,lowest=Infinity,highest=-Infinity;const trace=[];
 try{for(;steps<300;steps++){q.day();q.step(1/30);const ground=q.groundH(q.player.pos.x,q.player.pos.z);lowest=Math.min(lowest,ground);highest=Math.max(highest,ground);maxBodyOffset=Math.max(maxBodyOffset,Math.abs(q.player.mesh.position.y-ground));if(steps%10===0)trace.push({x:q.player.pos.x,z:q.player.pos.z,ground,body:q.player.mesh.position.y});if(q.player.pos.z>=o.z+14)break;}}finally{q.keys.KeyW=false;q.renderer.render=render;}
 const ride={steps,end:q.player.pos.toArray(),travel:q.player.pos.z-(o.z-15),maxBodyOffset,lowest,highest,trace};
 q.G.ui.open('settingsPanel');const link=document.querySelector('#settingsPanel a[href="credits.html"]');const creditLink=!!link&&link.getBoundingClientRect().height>0;const creditHTML=await(await fetch('./credits.html')).text();q.G.hidePanels();
 const performanceRows=[],opacity=[];q.player.pos.set(-200,0,166);q.player.speed=0;
 const {oasisContainsWater}=await import('./assets/oasis-art.js?v=living-oasis-1');
 q.nearGrass.invalidate();q.nearGrass.tick(0,-200,166);q.scene.updateMatrixWorld(true);
 const dryCoverIntrusions=[],matrix=new T.Matrix4(),point=new T.Vector3();
 for(const key of ['near','flow','fern','rock','lupin']){const im=q.nearGrass[key];for(let i=0;i<im.count;i++){im.getMatrixAt(i,matrix);if(Math.abs(matrix.determinant())<1e-8)continue;point.setFromMatrixPosition(matrix).applyMatrix4(im.matrixWorld);if(oasisContainsWater(point.x,point.z))dryCoverIntrusions.push({key,x:point.x,z:point.z});}}
 const sol=q.G.worldPkg.townsfolk.find(f=>f.def.id==='cc_sol');let solDry=!!sol;
 if(sol)for(let j=0;j<sol.path.length;j++){const a=sol.path[j],b=sol.path[(j+1)%sol.path.length];for(let k=0;k<=50;k++)if(oasisContainsWater(a[0]+(b[0]-a[0])*k/50,a[1]+(b[1]-a[1])*k/50,1))solDry=false;}

 for(const tier of['high','medium','low']){
  q.G.gfx.apply(tier);const draw=q.renderer.render;q.renderer.render=()=>{};try{for(let i=0;i<60;i++){q.day();q.step(1/30);q.scene.onBeforeRender();}}finally{q.renderer.render=draw;}
  q.player.mesh.visible=false;q.camera.position.set(-200,q.groundH(-200,166)+1.8,166);q.camera.lookAt(-200,q.groundH(-200,154)+1.3,154);
  const on=[],off=[],ref=q.G.world.waterMaterial.userData.reflection;
  for(let i=0;i<8;i++)for(const enabled of[true,false]){const start=performance.now();if(enabled)q.G.waterReflections.update(performance.now()+1000+i*200);else ref.amount.value=0;q.composer.render();q.renderer.getContext().finish();if(i>1)(enabled?on:off).push(performance.now()-start);}
  on.sort((a,b)=>a-b);off.sort((a,b)=>a-b);performanceRows.push({tier,withReflectionRefreshMedianMs:on[3],withoutReflectionRefreshMedianMs:off[3],reflectionSupported:tier==='high'});
  const pass=q.composer.passes[0],orig=pass.render;let minAlpha=1,invalid=0;
  pass.render=function(renderer,write,read,...rest){orig.call(this,renderer,write,read,...rest);const w=Math.floor(read.width),h=Math.floor(read.height),p=new Uint16Array(w*h*4);renderer.readRenderTargetPixels(read,0,0,w,h,p);for(let i=0;i<p.length;i+=4){minAlpha=Math.min(minAlpha,T.DataUtils.fromHalfFloat(p[i+3]));if([0,1,2].some(c=>(p[i+c]&0x7c00)===0x7c00))invalid++;}};
  try{q.composer.render();}finally{pass.render=orig;}const cv=document.createElement('canvas');cv.width=q.renderer.domElement.width;cv.height=q.renderer.domElement.height;const ctx=cv.getContext('2d');ctx.drawImage(q.renderer.domElement,0,0);const pixels=ctx.getImageData(0,0,cv.width,cv.height).data;let partial=0;for(let i=3;i<pixels.length;i+=4)if(pixels[i]!==255)partial++;opacity.push({tier,minAlpha,invalid,partial});
 }
 q.G.gfx.apply('high');
 const labels=[];q.scene.traverse(o=>{if(o.material?.name==='World | floating label')labels.push([o,o.visible]);});
 let reflectionPasses=0,reflectedLabels=0;const draw=q.renderer.render;
 q.renderer.render=function(scene,camera){if(camera!==q.camera&&q.renderer.getRenderTarget()?.texture.name==='Nearby water reflection'){reflectionPasses++;for(const [label] of labels)if(label.visible)reflectedLabels++;}return draw.call(this,scene,camera);};
 try{q.G.waterReflections.update(performance.now()+2000);}finally{q.renderer.render=draw;}
 const labelsRestored=labels.every(([label,visible])=>label.visible===visible);
 const checks={dryPond:dryCoverIntrusions.length===0,solStaysOnBank:solDry,physicalReflections:labels.length>0&&reflectionPasses===1&&reflectedLabels===0&&labelsRestored,...{oasisTerrainMatches:contacts.every(p=>p.terrainError<.001),shoreTrianglesConform:contacts.every(p=>p.bankError<.001),riddenBasinCrossing:ride.travel>=29&&ride.steps<300&&Math.abs(ride.end[0]-o.x)<2&&ride.maxBodyOffset<.3,visibleArtCredits:creditLink&&creditHTML.includes('Next Spring')&&creditHTML.includes('https://creativecommons.org/licenses/by/4.0/'),opaqueOasis:opacity.every(p=>p.minAlpha>=1-1/2048&&p.partial===0&&p.invalid===0)}};
 return {checks,contacts,ride,performanceRows,opacity,dryCoverIntrusions,solDry,reflectionPasses,reflectedLabels,labelsRestored};
});fs.writeFileSync(path.join(out,'oasis-diagnostics.json'),JSON.stringify(oasisDiagnostics,null,2));console.log('Oasis diagnostics',JSON.stringify(oasisDiagnostics));assert(Object.values(oasisDiagnostics.checks).every(Boolean),'Oasis riding, shoreline, attribution or opacity failed');

}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

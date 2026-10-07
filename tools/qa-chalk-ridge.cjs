// Review the visible hill, its actual sun shadow, riding contact and unaffected routes.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process'),QA=require('./qa-platform.cjs');
const out=path.resolve(process.env.QA_OUTPUT||'output/chalk-ridge');fs.mkdirSync(out,{recursive:true});
const baseline=process.env.QA_CHALK_BASELINE;
(async()=>{const browser=await QA.chromium.launch({headless:true,args:QA.gpuArgs()});try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('**/api/me',r=>r.fulfill({contentType:'application/json',body:'null'}));
 await page.addInitScript(()=>{let seed=712761;Math.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);});
 if(baseline)for(const file of ['assets/chalk-down.js','assets/terrain-realism.js','assets/features/world-vistas.js','assets/features/index.js']){
  const body=execFileSync('git',['show',baseline+':'+file],{encoding:'utf8'});await page.route('**/'+file+'*',r=>r.fulfill({contentType:'text/javascript',body}));
 }
 await page.route('**/ranch3d.html*',async r=>{const response=await r.fetch(),body=baseline?execFileSync('git',['show',baseline+':ranch3d.html'],{encoding:'utf8'}):await response.text();
  await r.fulfill({response,body:body.replace('const MERGE_STATS=mergeStatics();',`window.__qa={THREE,scene,camera,renderer,composer,G,keys,player,groundH,PATHS,TACK,sun,step(dt){manualStepping=true;tick(dt)},day(t=.30,rain=false){dayT=t;weather.mode=rain?'rain':'clear';weather.timer=99999}};const MERGE_STATS=mergeStatics();`)});
 });
 await page.goto(QA.BASE+'/ranch3d.html?qa=chalk-ridge',{timeout:120000});await page.waitForFunction(()=>window.__qa?.G.horse.RIG().ready&&!document.getElementById('load'),null,{timeout:120000});
 await page.evaluate(async()=>{const q=__qa;q.G.save.sync(s=>{s.qualityLocked=true;s.unlocked=s.unlocked||{};for(const r of q.G.tables.REGIONS)if(r.unlock)s.unlocked[r.id]=true;});q.G.wardrobe?.closeChar();q.G.hidePanels();await q.G.photoscans.ready;await q.G.worldDetails.ready;await q.G.world.ranchBuilderArt.ready;advanceTime(0);q.G.gfx.apply('high');q.day();q.step(.01);
  q.frame=(u,t)=>{const s=q.G.vistas.SCARP,f=Math.atan2(s.x,s.z);return [s.x+Math.cos(f)*u+Math.sin(f)*(t-.5)*s.depth,s.z-Math.sin(f)*u+Math.cos(f)*(t-.5)*s.depth];};
  q.read=rt=>{const width=Math.floor(rt.width),height=Math.floor(rt.height),pixels=new Uint16Array(width*height*4);q.renderer.readRenderTargetPixels(rt,0,0,width,height,pixels);let invalid=0,minAlpha=1;for(let i=0;i<pixels.length;i+=4){minAlpha=Math.min(minAlpha,q.THREE.DataUtils.fromHalfFloat(pixels[i+3]));if([0,1,2].some(c=>(pixels[i+c]&0x7c00)===0x7c00))invalid++;}return{invalid,minAlpha,width,height};};
 });
 const protectedGround=await page.evaluate(()=>{const q=__qa,samples=[],add=(x,z)=>samples.push([x,z,q.groundH(x,z)]);
  for(const line of [...q.PATHS,...Object.values(q.G.tables.RACE_ROUTES).filter(Array.isArray)])for(let i=1;i<line.length;i++){
   const a=line[i-1],b=line[i];if(!Array.isArray(a)||!Array.isArray(b))continue;const count=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/3));for(let k=0;k<=count;k++)add(a[0]+(b[0]-a[0])*k/count,a[1]+(b[1]-a[1])*k/count);
  }
  for(const slot of Object.values(q.G.ranch.SLOTS||{}))for(const dx of[-6,0,6])for(const dz of[-6,0,6])add(slot.x+dx,slot.z+dz);
  return {site:q.G.vistas.SCARP,samples};
 });
 if(baseline){fs.writeFileSync(path.join(out,'protected-ground.json'),JSON.stringify({revision:baseline,...protectedGround},null,2));console.log('Recorded '+protectedGround.samples.length+' protected samples');return;}
 const before=JSON.parse(fs.readFileSync(process.env.QA_CHALK_PROTECTED||path.join(__dirname,'fixtures/chalk-protected-ground.json'),'utf8'));
 const state=await page.evaluate(before=>{const q=__qa,T=q.THREE,down=q.G.vistas.chalkDown,ground=down.root.getObjectByName('vista:chalkscarp'),p=ground.geometry.attributes.position,index=ground.geometry.index,normal=ground.geometry.attributes.normal;
  ground.updateMatrixWorld(true);const skin=[];for(let i=0;i<index.count;i+=Math.max(3,Math.floor(index.count/180/3)*3)){const ids=[index.getX(i),index.getX(i+1),index.getX(i+2)],x=ids.reduce((n,j)=>n+p.getX(j),0)/3,z=ids.reduce((n,j)=>n+p.getZ(j),0)/3;const hit=new T.Raycaster(new T.Vector3(x,120,z),new T.Vector3(0,-1,0)).intersectObject(ground)[0];skin.push(hit?Math.abs(hit.point.y-q.groundH(x,z)):Infinity);}
  let bad=0,maxGrade=0;for(let i=0;i<p.count;i++){if(![p.getX(i),p.getY(i),p.getZ(i),normal.getX(i),normal.getY(i),normal.getZ(i)].every(Number.isFinite))bad++;maxGrade=Math.max(maxGrade,Math.hypot(normal.getX(i),normal.getZ(i))/Math.max(.001,Math.abs(normal.getY(i))));}
  const crests=[];for(let u=-40;u<=40;u+=4){let height=-Infinity,t=0;for(let k=0;k<=112;k++){const [x,z]=q.frame(u,k/112),y=down.heightAt(x,z)-q.G.world.terrainH(x,z);if(y>height){height=y;t=k/112;}}crests.push({u,t,height});}
  const protectedError=before.samples.reduce((max,[x,z,y])=>Math.max(max,Math.abs(q.groundH(x,z)-y)),0);
  return {site:down.site,skinSamples:skin.length,maxSkinError:Math.max(...skin),bad,maxGrade,crests,protectedSamples:before.samples.length,protectedError,sharedMaterial:ground.material===q.scene.getObjectByName('Pasture terrain').material,castsShadow:ground.castShadow,receivesShadow:ground.receiveShadow,featureErrors:q.G.errors,assetErrors:[...q.G.photoscans.errors,...q.G.worldDetails.errors]};
 },before);
 const rides=await page.evaluate(()=>{const q=__qa,rides=[],render=q.renderer.render;q.renderer.render=()=>{};try{
  for(const reverse of[false,true]){const points=Array.from({length:31},(_,i)=>q.frame(0,-.06+i/30*1.12));if(reverse)points.reverse();q.player.pos.set(points[0][0],0,points[0][1]);q.player.speed=0;q.player.y=q.player.vy=0;q.player.flying=false;q.G.followCam.reset();q.keys.KeyW=true;let wi=1,steps=0,maxOffset=0,minCameraHeight=Infinity,maxStep=0,last=q.player.pos.clone();const trace=[];
   for(;steps<3000&&wi<points.length;steps++){const p=points[wi],distance=Math.hypot(p[0]-q.player.pos.x,p[1]-q.player.pos.z);if(distance<1.1){wi++;continue;}q.player.heading=Math.atan2(p[0]-q.player.pos.x,p[1]-q.player.pos.z);q.day();q.step(1/30);maxOffset=Math.max(maxOffset,Math.abs(q.player.mesh.position.y-q.groundH(q.player.pos.x,q.player.pos.z)));minCameraHeight=Math.min(minCameraHeight,q.camera.position.y-q.groundH(q.camera.position.x,q.camera.position.z));maxStep=Math.max(maxStep,q.player.pos.distanceTo(last));last.copy(q.player.pos);if(steps%90===0)trace.push(q.player.pos.toArray());}
   q.keys.KeyW=false;rides.push({reverse,waypoints:wi,total:points.length,steps,maxOffset,minCameraHeight,maxStep,trace});
  }
 }finally{q.keys.KeyW=false;q.renderer.render=render;}return rides;});console.log('Hill rides finished');
 const rows=[];for(const view of[
  {name:'viewpoint',u:0,t:-.66,height:3}, {name:'close',u:0,t:-.11,height:4},
  {name:'reverse',u:-20,t:1.14,height:8,shadow:true}, {name:'ridge',u:52,t:.40,height:9},
  {name:'medium',u:0,t:-.66,height:3,tier:'medium'}, {name:'low',u:0,t:-.66,height:3,tier:'low'},
  {name:'rain',u:0,t:-.66,height:3,rain:true}, {name:'golden',u:0,t:-.66,height:3,time:.23}, {name:'night',u:0,t:-.66,height:3,time:0}
 ]){const row=await page.evaluate(async view=>{const q=__qa,ground=q.G.vistas.chalkDown.root.getObjectByName('vista:chalkscarp'),[x,z]=q.frame(view.u,view.t),s=q.G.vistas.SCARP;
  q.G.gfx.apply(view.tier||'high');q.player.pos.set(x,0,z);q.player.speed=0;q.player.y=q.player.vy=0;q.player.flying=false;const render=q.renderer.render;q.renderer.render=()=>{};try{for(let i=0;i<70;i++){q.day(view.time??.30,view.rain);q.step(1/30);q.scene.onBeforeRender();}}finally{q.renderer.render=render;}
  q.player.mesh.visible=false;for(const o of Object.values(q.TACK||{}))if(o?.isObject3D)o.visible=false;const reins=q.scene.getObjectByName('Native leather split reins');if(reins)reins.visible=false;
  q.camera.position.set(x,q.groundH(x,z)+view.height,z);q.camera.lookAt(s.x,q.groundH(s.x,s.z)-s.h*.25,s.z);
  const read=()=>{const c=document.createElement('canvas');c.width=q.renderer.domElement.width;c.height=q.renderer.domElement.height;const ctx=c.getContext('2d');ctx.drawImage(q.renderer.domElement,0,0);return ctx.getImageData(0,0,c.width,c.height).data;};
  let source;const pass=q.composer.passes[0],original=pass.render;pass.render=function(renderer,write,read,...rest){original.call(this,renderer,write,read,...rest);source=q.read(read);};try{q.composer.render();}finally{pass.render=original;}
  const on=read(),image=q.renderer.domElement.toDataURL('image/webp',.95).split(',')[1];let partial=0;for(let i=3;i<on.length;i+=4)if(on[i]!==255)partial++;
  let shadowPixels=0,shadowSum=0;
  if(view.shadow){const callback=q.scene.onBeforeRender;q.scene.onBeforeRender=()=>{};try{ground.castShadow=false;q.renderer.shadowMap.needsUpdate=true;q.sun.shadow.needsUpdate=true;q.composer.render();const off=read();for(let i=0;i<on.length;i+=4){const d=((off[i]-on[i])+(off[i+1]-on[i+1])+(off[i+2]-on[i+2]))/3;if(d>5){shadowPixels++;shadowSum+=d;}}}finally{ground.castShadow=true;q.renderer.shadowMap.needsUpdate=true;q.sun.shadow.needsUpdate=true;q.scene.onBeforeRender=callback;}}
  return {name:view.name,source,partial,buffers:[q.composer.renderTarget1,q.composer.renderTarget2].map(q.read),shadowPixels,shadowMean:shadowSum/Math.max(1,shadowPixels),gl:q.renderer.getContext().getError(),image};
 },view);fs.writeFileSync(path.join(out,view.name+'.webp'),Buffer.from(row.image,'base64'));delete row.image;rows.push(row);console.log(view.name);}
 const checks={sameSite:JSON.stringify(state.site)===JSON.stringify(before.site),protectedGround:state.protectedSamples>100&&state.protectedError<.001,visibleSurface:state.skinSamples>100&&state.maxSkinError<.03,finiteGeometry:!state.bad,sharedPasture:state.sharedMaterial,unevenRidgeline:Math.max(...state.crests.map(p=>p.t))-Math.min(...state.crests.map(p=>p.t))>.05,riddenBothDirections:rides.every(r=>r.waypoints===r.total),hoofContact:rides.every(r=>r.maxOffset<.35),ridingCamera:rides.every(r=>r.minCameraHeight>.1),terrainShadows:state.castsShadow&&state.receivesShadow&&rows.find(r=>r.name==='reverse').shadowPixels>1000,opaqueSource:rows.every(r=>r.source.minAlpha>=1-1/2048),opaqueScreen:rows.every(r=>r.partial===0),finitePixels:rows.every(r=>r.source.invalid===0&&r.buffers.every(b=>b.invalid===0)),validWebGL:rows.every(r=>r.gl===0),noErrors:!errors.length&&!state.featureErrors.length&&!state.assetErrors.length};
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({checks,state,rides,rows,errors},null,2));console.log(JSON.stringify({checks,state,rides}));assert(Object.values(checks).every(Boolean),'Chalk ridge acceptance failed');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

// Native-GPU review of flowing water, bounded spray, day/night response and camera clearance.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),QA=require('./qa-platform.cjs');
const out=path.resolve(process.argv[2]||'output/cascade-effects');fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await QA.chromium.launch({headless:true,args:QA.gpuArgs()});try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error(e.message)});page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await page.route('**/api/me',r=>r.fulfill({contentType:'application/json',body:'null'}));
 await page.route('**/ranch3d.html*',async r=>{const res=await r.fetch();await r.fulfill({response:res,body:(await res.text()).replace('const MERGE_STATS=mergeStatics();',`window.__cascadeQA={THREE,scene,camera,renderer,composer,G,player,groundH,terrainH,keys,TACK,FALLS,step(dt){manualStepping=true;tick(dt)},day(t=.34,rain=false){dayT=t;weather.mode=rain?'rain':'clear';weather.timer=99999}};const MERGE_STATS=mergeStatics();`)});});
 await page.addInitScript(()=>{let seed=928471;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};});
 await page.goto(QA.BASE+'/ranch3d.html?qa=cascade-effects',{timeout:120000});await page.waitForFunction(()=>window.__cascadeQA?.G.horse.RIG().ready&&!document.getElementById('load'),null,{timeout:120000});
 await page.evaluate(async()=>{const q=__cascadeQA;q.G.save.sync(s=>{s.qualityLocked=true;s.unlocked=s.unlocked||{};for(const r of q.G.tables.REGIONS)if(r.unlock)s.unlocked[r.id]=true;});q.G.wardrobe?.closeChar();q.G.hidePanels();await q.G.photoscans.ready;await q.G.worldDetails.ready;await q.G.worldPkg.oasisReady;advanceTime(0);q.day();q.G.gfx.apply('high');q.fallsModule=await import('./assets/falls-landscape.js?v=alpine-range-1');q.wildHabitatErrors=[];q.reviewVisibility=[q.player.mesh,...Object.values(q.TACK||{}),q.scene.getObjectByName('Native leather split reins')].filter(o=>o?.isObject3D).map(o=>[o,o.visible]);
  q.read=rt=>{const w=Math.floor(rt.width),h=Math.floor(rt.height),p=new Uint16Array(w*h*4);q.renderer.readRenderTargetPixels(rt,0,0,w,h,p);let invalid=0,minAlpha=1;for(let i=0;i<p.length;i+=4){minAlpha=Math.min(minAlpha,q.THREE.DataUtils.fromHalfFloat(p[i+3]));if([0,1,2].some(c=>(p[i+c]&0x7c00)===0x7c00))invalid++;}return{invalid,minAlpha};};
 });console.log('Falls ready');
 const rows=[];for(const c of[
  {name:'impact-close',eye:[-148,1.1,-227],look:[-150,2,-234.4]},
  {name:'spray-side',eye:[-144,1.5,-232],look:[-150,1.3,-234.4]},
  {name:'inside-spray',eye:[-150,.65,-233.9],look:[-151,2,-235]},
  {name:'impact-night',eye:[-148,1.1,-227],look:[-150,2,-234.4],time:0},
  {name:'impact-rain',eye:[-148,1.1,-227],look:[-150,2,-234.4],rain:true},
  {name:'impact-low',eye:[-148,1.1,-227],look:[-150,2,-234.4],tier:'low'},
  {name:'ribbon',eye:[335,6.5,81],look:[342,5,67]},
  {name:'ribbon-night',eye:[335,6.5,81],look:[342,5,67],time:0}

 ]){const row=await page.evaluate(c=>{const q=__cascadeQA;q.G.gfx.apply(c.tier||'high');q.player.pos.set(c.eye[0],0,c.eye[2]);q.player.speed=0;q.player.y=q.player.vy=0;q.player.flying=false;const render=q.renderer.render;q.renderer.render=()=>{};
  try{for(let i=0;i<150;i++){q.day(c.time??.34,c.rain);q.step(1/30);for(const h of q.G.worldPkg.herds)for(const m of h.members)if(!q.fallsModule.fallsAllowsHorse(m.pos.x,m.pos.z))q.wildHabitatErrors.push(m.pos.toArray());q.scene.onBeforeRender();}}finally{q.renderer.render=render;}
  q.player.mesh.visible=false;for(const o of Object.values(q.TACK||{}))if(o?.isObject3D)o.visible=false;const reins=q.scene.getObjectByName('Native leather split reins');if(reins)reins.visible=false;
  if(c.relative){c.eye[1]+=q.groundH(c.eye[0],c.eye[2]);c.look[1]+=q.groundH(c.look[0],c.look[2]);}
  q.camera.position.set(...c.eye);q.camera.lookAt(...c.look);q.G.waterReflections.update(performance.now()+100);
  let source;const pass=q.composer.passes[0],original=pass.render;pass.render=function(renderer,write,read,...rest){original.call(this,renderer,write,read,...rest);source=q.read(read);};try{q.composer.render();}finally{pass.render=original;}
  const cv=document.createElement('canvas');cv.width=q.renderer.domElement.width;cv.height=q.renderer.domElement.height;const ctx=cv.getContext('2d');ctx.drawImage(q.renderer.domElement,0,0);const pixels=ctx.getImageData(0,0,cv.width,cv.height).data;let partial=0;for(let i=3;i<pixels.length;i+=4)if(pixels[i]!==255)partial++;
  return{name:c.name,source,partial,buffers:[q.composer.renderTarget1,q.composer.renderTarget2].map(q.read),gl:q.renderer.getContext().getError(),reflection:{...q.G.waterReflections.state,level:q.G.world.waterMaterial.userData.reflection.level.value},image:q.renderer.domElement.toDataURL('image/webp',.96).split(',')[1]};
 },c);fs.writeFileSync(path.join(out,c.name+'.webp'),Buffer.from(row.image,'base64'));delete row.image;rows.push(row);console.log(c.name);}
 const effects=await page.evaluate(async()=>{
  const q=__cascadeQA,T=q.THREE,A=q.G.world.waterfallArt,F=q.FALLS.effects;
  const ribbon=q.G.waterPkg,ribbonIntrusions=[],matrix=new T.Matrix4();q.scene.traverse(o=>{if(!o.isInstancedMesh||!['flora_tuft','flora_petal','flora_brack','Living pasture grass'].includes(o.name))return;for(let i=0;i<o.count;i++){o.getMatrixAt(i,matrix);if(Math.abs(matrix.determinant())>1e-9&&ribbon.excludesPlants(matrix.elements[12],matrix.elements[14]))ribbonIntrusions.push(o.name);}});
  const names=F.meshes.map(o=>o.name),matrices=F.meshes.map(o=>o.instanceMatrix.version);
  const {createWaterfallEffects}=await import('./assets/waterfall-effects.js?v=living-cascades-1');
  const clock={value:0},fx=createWaterfallEffects({THREE:T,time:clock,x:0,z:0,top:8,bottom:0,width:2,run:3});
  const sc=new T.Scene();sc.background=new T.Color('#1c363d');sc.add(fx.group);
  const cam=new T.PerspectiveCamera(55,1.6,.1,300);cam.position.set(0,3,12);cam.lookAt(0,3,1);
  const rt=new T.WebGLRenderTarget(480,300),old=q.renderer.getRenderTarget();
  function draw(){q.renderer.setRenderTarget(rt);q.renderer.render(sc,cam);const p=new Uint8Array(480*300*4);q.renderer.readRenderTargetPixels(rt,0,0,480,300,p);return p;}
  fx.group.visible=false;const empty=draw();fx.group.visible=true;
  const rows=[],images=[];let first;
  for(const t of[0,.4,1.1,3.7,91.2]){clock.value=t;const px=draw();if(!first)first=px;let changed=0,motion=0,partial=0;for(let i=0;i<px.length;i+=4){if([0,1,2].some(c=>Math.abs(px[i+c]-empty[i+c])>2))changed++;if([0,1,2].some(c=>Math.abs(px[i+c]-first[i+c])>2))motion++;if(px[i+3]!==255)partial++;}rows.push({t,changed,motion,partial});
   const cv=document.createElement('canvas');cv.width=480;cv.height=300;const ctx=cv.getContext('2d'),data=ctx.createImageData(480,300);for(let y=0;y<300;y++)data.data.set(px.subarray((299-y)*480*4,(300-y)*480*4),y*480*4);ctx.putImageData(data,0,0);images.push(cv.toDataURL('image/webp',.98).split(',')[1]);}
  cam.position.set(0,3,240);cam.lookAt(0,3,1);const far=draw();let distantPixels=0;for(let i=0;i<far.length;i+=4)if([0,1,2].some(c=>far[i+c]!==empty[i+c]))distantPixels++;
  q.renderer.setRenderTarget(old);rt.dispose();fx.meshes.forEach(o=>{o.geometry.dispose();o.material.dispose();});
  const day=[];for(const time of[.34,0]){const render=q.renderer.render;q.renderer.render=()=>{};try{for(let i=0;i<120;i++){q.day(time);q.step(1/30);}}finally{q.renderer.render=render;}day.push({time,tints:F.materials.map(m=>m.color.toArray())});}
  return {ribbonIntrusions,ribbonEffects:[ribbon.fallEffects.stats,ribbon.toeEffects.stats],allNormal:A.mistMaterials.every(m=>m.blending===T.NormalBlending),legacyRibbonRemoved:!ribbon.fallDrops&&!ribbon.fallMist,names,stats:F.stats,rows,images,distantPixels,unchangedMatrices:matrices.every((v,i)=>v===F.meshes[i].instanceMatrix.version),normalBlending:F.materials.every(m=>m.blending===T.NormalBlending),nightTint:day[1].tints,dayTint:day[0].tints,legacyRemoved:!q.FALLS.drops&&!q.FALLS.mist,gl:q.renderer.getContext().getError()};
 });
 effects.images.forEach((im,i)=>fs.writeFileSync(path.join(out,'isolated-'+i+'.webp'),Buffer.from(im,'base64')));delete effects.images;
 const checks={clearRibbonWater:!effects.ribbonIntrusions.length,ribbonParticles:effects.ribbonEffects.length===2&&effects.ribbonEffects.reduce((n,e)=>n+e.triangles,0)<500,ribbonNightGuard:effects.allNormal&&effects.legacyRibbonRemoved,opaqueWorld:rows.every(r=>r.partial===0&&r.source.minAlpha>=1-1/2048),finiteWorld:rows.every(r=>r.source.invalid===0&&r.buffers.every(b=>b.invalid===0)),validWebGL:rows.every(r=>r.gl===0)&&effects.gl===0,particleMotion:effects.rows.every(r=>r.changed>100)&&effects.rows.slice(1).every(r=>r.motion>80),opaqueParticles:effects.rows.every(r=>r.partial===0),distanceFade:effects.distantPixels===0,staticInstanceBuffers:effects.unchangedMatrices,dayNightTint:effects.nightTint.every((c,i)=>c.reduce((a,b)=>a+b,0)<effects.dayTint[i].reduce((a,b)=>a+b,0)*.4),noAdditiveGlow:effects.normalBlending,legacyRemoved:effects.legacyRemoved,boundedParticles:effects.stats.triangles<=600&&effects.stats.draws===3,noErrors:!errors.length};
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({checks,rows,effects,errors},null,2));console.log(JSON.stringify({checks,effects,errors}));assert(Object.values(checks).every(Boolean),'Waterfall effects acceptance failed');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

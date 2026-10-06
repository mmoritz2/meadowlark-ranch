const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),QA=require('./qa-platform.cjs'),{execFileSync}=require('child_process');
const out=path.resolve(process.argv[2]||'output/visible-shadows');fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await QA.chromium.launch({headless:true,args:QA.gpuArgs(['--mute-audio'])});try{
 const page=await browser.newPage({viewport:{width:1180,height:800},deviceScaleFactor:1}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await page.route('**/api/me',r=>r.fulfill({contentType:'application/json',body:'null'}));
 if(process.env.QA_SHADOW_BASELINE)for(const file of ['assets/world-photoscans.js','assets/meadow-cover.js','assets/features/index.js','assets/features/world-atmosphere.js']){const body=execFileSync('git',['show','HEAD:'+file],{encoding:'utf8'});await page.route('**/'+file+'*',r=>r.fulfill({contentType:'text/javascript',body}));}
 await page.route('**/ranch3d.html*',async r=>{const res=await r.fetch();await r.fulfill({response:res,body:(process.env.QA_SHADOW_BASELINE?execFileSync('git',['show','HEAD:ranch3d.html'],{encoding:'utf8'}):await res.text()).replace('const MERGE_STATS=mergeStatics();',`window.__qa={THREE,scene,camera,renderer,composer,G,player,groundH,TACK,sun,hemi,step(dt){manualStepping=true;tick(dt)},day(value=.34,rain=false){dayT=value;weather.mode=rain?'rain':'clear';weather.timer=99999}};const MERGE_STATS=mergeStatics();`)});});
 await page.addInitScript(()=>{let seed=928471;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};});
 await page.goto(QA.BASE+'/ranch3d.html?qa=shadows',{timeout:120000});
 await page.waitForFunction(()=>window.__qa?.G.horse.RIG().ready&&!document.getElementById('load'),null,{timeout:120000});
 await page.evaluate(async()=>{const q=__qa;q.G.save.sync(s=>s.qualityLocked=true);q.G.wardrobe?.closeChar();q.G.hidePanels();await q.G.photoscans.ready;await q.G.worldDetails.ready;await q.G.world.ranchBuilderArt.ready;advanceTime(0);});
 const rows=[];
 for(const tier of['high','medium','low'])for(const name of['woodland','village','hill']){
  const row=await page.evaluate(async({tier,name})=>{
   const q=__qa,p=q.player,T=q.THREE;const views={woodland:{p:[-55,46,-.4]},village:{p:[42,-44,2],eye:[29,3,-32],look:[65,4,-70]},hill:{p:[78,-151,2.8],eye:[78,1.7,-151],look:[46,2,-58]}};const v=views[name];
   q.G.gfx.apply(tier);q.day();p.pos.set(v.p[0],0,v.p[1]);p.heading=v.p[2];p.speed=0;p.y=0;p.vy=0;p.flying=false;q.G.followCam.reset();
   const render=q.renderer.render;q.renderer.render=()=>{};try{for(let i=0;i<35;i++)q.step(.1)}finally{q.renderer.render=render;}
   p.mesh.visible=!v.eye;for(const o of Object.values(q.TACK||{}))if(o?.isObject3D)o.visible=!v.eye;const reins=q.scene.getObjectByName('Native leather split reins');if(reins)reins.visible=!v.eye;
   if(v.eye){const eye=v.eye.slice(),look=v.look.slice();eye[1]+=q.groundH(eye[0],eye[2]);look[1]+=q.groundH(look[0],look[2]);q.camera.position.set(...eye);q.camera.lookAt(...look);}
   for(let i=0;i<12;i++)q.composer.render();
   const callback=q.scene.onBeforeRender;q.scene.onBeforeRender=()=>{};
   const read=async()=>{const image=new Image();image.src=q.renderer.domElement.toDataURL();await image.decode();const c=document.createElement('canvas');c.width=image.width;c.height=image.height;const ctx=c.getContext('2d');ctx.drawImage(image,0,0);return ctx.getImageData(0,0,c.width,c.height).data;};
   // Toggle the per-object receiveShadow uniform. Disabling shadowMap.enabled
   // alone leaves cached material programs sampling their previous shadow map.
   const receivers=[];q.scene.traverse(o=>{if(o.isMesh&&o.receiveShadow)receivers.push(o);});
   let on,off,image;try{q.composer.render();on=await read();image=q.renderer.domElement.toDataURL('image/webp',.94).split(',')[1];for(const o of receivers)o.receiveShadow=false;q.composer.render();off=await read();}finally{for(const o of receivers)o.receiveShadow=true;q.scene.onBeforeRender=callback;}
   let shadowPixels=0,shadowDifference=0,maxDifference=0;for(let i=0;i<on.length;i+=4){const difference=((off[i]-on[i])+(off[i+1]-on[i+1])+(off[i+2]-on[i+2]))/3;if(difference>5){shadowPixels++;shadowDifference+=difference;maxDifference=Math.max(maxDifference,difference);}}
   const caster={views:0,detailed:0,horse:0};q.scene.traverse(o=>{if(!o.visible||!o.castShadow)return;if(o.name.startsWith('Scanned distant tree views'))caster.views+=o.count;if(o.name.startsWith('Photoscan ')&&/pine|broadleaf/.test(o.name))caster.detailed+=o.count;});p.mesh.traverse(o=>{if(o.isMesh&&o.visible&&o.castShadow)caster.horse++;});
   const c=q.sun.shadow.camera;return {tier,name,shadowPixels,meanShadowDifference:shadowDifference/(shadowPixels||1),maxDifference,caster,map:q.sun.shadow.mapSize.x,span:c.right-c.left,target:q.sun.target.position.toArray(),ground:q.groundH(p.pos.x,p.pos.z),grassReceives:q.G.world.nearGroundCover.meadowDistance.mesh.receiveShadow,image,gl:q.renderer.getContext().getError()};
  },{tier,name});fs.writeFileSync(path.join(out,`${name}-${tier}.webp`),Buffer.from(row.image,'base64'));delete row.image;rows.push(row);console.log(JSON.stringify(row));
 }
 const checks={allTiersCastTreeShadows:rows.every(r=>r.caster.views>100),grassReceivesShadows:rows.every(r=>r.grassReceives),visibleWorldShadows:rows.every(r=>r.shadowPixels>3000&&r.meanShadowDifference>8),horseCastsShadow:rows.every(r=>r.caster.horse>0),hillShadowFollowsGround:rows.filter(r=>r.name==='hill').every(r=>Math.abs(r.target[1]-r.ground)<.15),highQualityResolution:rows.filter(r=>r.tier==='high').every(r=>r.map===4096),worldCoverage:rows.every(r=>r.span>=100),noWebGLErrors:rows.every(r=>r.gl===0),noBrowserErrors:!errors.length};
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({checks,rows,errors},null,2));console.log(JSON.stringify(checks));if(!process.env.QA_SHADOW_BASELINE)assert(Object.values(checks).every(Boolean),'Visible shadow acceptance failed');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});

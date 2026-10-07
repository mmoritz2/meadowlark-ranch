// Cloud sampling and atmosphere regression with settled weather captures.
// QA_SKY_BASELINE=1 captures HEAD for a before/after comparison without gating.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const ROOT=path.resolve(__dirname,'..'),QA=require('./qa-platform.cjs');
const out=path.resolve(process.argv[2]||'output/sky-world'),baseline=process.env.QA_SKY_BASELINE==='1';fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await QA.chromium.launch({headless:true,args:QA.gpuArgs()});try{
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await page.route('**/api/me',r=>r.fulfill({contentType:'application/json',body:'null'}));
 if(baseline)for(const file of ['assets/pastoral-sky.js','assets/features/world-atmosphere.js']){const body=execFileSync('git',['show','HEAD:'+file],{cwd:ROOT,encoding:'utf8'});await page.route('**/'+file+'*',r=>r.fulfill({contentType:'text/javascript',body}));}
 await page.route('**/ranch3d.html*',async r=>{const res=await r.fetch();await r.fulfill({response:res,body:(await res.text()).replace('const MERGE_STATS=mergeStatics();',`window.__skyQA={THREE,scene,camera,renderer,composer,G,player,groundH,sky,sun,hemi,TACK,step(dt){manualStepping=true;tick(dt)},day(value=.34,rain=false){dayT=value;weather.mode=rain?'rain':'clear';weather.timer=99999}};const MERGE_STATS=mergeStatics();`)});});
 await page.addInitScript(()=>{let seed=928471;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};});
 await page.goto(QA.BASE+'/ranch3d.html?qa=sky-world',{timeout:120000});await page.waitForFunction(()=>window.__skyQA?.G.horse.RIG().ready&&!document.getElementById('load'),null,{timeout:120000});
 await page.evaluate(async()=>{const q=__skyQA;q.G.save.sync(s=>s.qualityLocked=true);q.G.wardrobe?.closeChar();q.G.hidePanels();await q.G.photoscans.ready;await q.G.worldDetails.ready;advanceTime(0);});
 console.log('World ready');const rows=[];
 for(const c of [{name:'day',time:.34,tier:'high'},{name:'low',time:.34,tier:'low'},{name:'dawn',time:.15,tier:'high'},{name:'sunset',time:.82,tier:'high'},{name:'night',time:0,tier:'high'},{name:'rain',time:.34,tier:'high',rain:true}]){
  const row=await page.evaluate(c=>{const q=__skyQA;q.G.gfx.apply(c.tier);q.player.pos.set(85,0,-150);q.player.speed=0;
   const render=q.renderer.render;q.renderer.render=()=>{};try{for(let i=0;i<210;i++){q.day(c.time,c.rain);q.step(1/30);q.scene.onBeforeRender();}}finally{q.renderer.render=render;}
   q.player.mesh.visible=false;for(const o of Object.values(q.TACK||{}))if(o?.isObject3D)o.visible=false;const reins=q.scene.getObjectByName('Native leather split reins');if(reins)reins.visible=false;
   q.camera.position.set(85,q.groundH(85,-150)+4,-150);q.camera.lookAt(20,q.groundH(20,-35)+5,-35);q.G.waterReflections.update(performance.now()+100);q.composer.render();
   const rt=q.composer.readBuffer,px=new Uint16Array(Math.floor(rt.width)*Math.floor(rt.height)*4);q.renderer.readRenderTargetPixels(rt,0,0,Math.floor(rt.width),Math.floor(rt.height),px);let invalid=0;for(let i=0;i<px.length;i++)if(i%4!==3&&(px[i]&0x7c00)===0x7c00)invalid++;
   const state={};q.G.run('state',state);
   return {name:c.name,invalid,clock:state.atmos,fog:q.scene.fog.color.toArray(),key:q.sun.intensity,fill:q.hemi.intensity,skySteps:q.sky.material.uniforms.cloudSteps.value,gl:q.renderer.getContext().getError(),image:q.renderer.domElement.toDataURL('image/webp',.95).split(',')[1]};
  },c);fs.writeFileSync(path.join(out,c.name+'.webp'),Buffer.from(row.image,'base64'));delete row.image;rows.push(row);console.log(c.name,JSON.stringify(row));
 }
 const isolated=await page.evaluate(()=>{
  const q=__skyQA,T=q.THREE,renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(640,400);renderer.outputColorSpace=T.SRGBColorSpace;
  const scene=new T.Scene(),sky=q.sky.clone(),mat=q.sky.material.clone();sky.material=mat;scene.add(sky);const u=mat.uniforms;
  u.day.value=1;u.night.value=0;u.rain.value=0;u.golden.value=0;u.time.value=123;u.zenith.value.set('#559ec0');u.horizon.value.set('#b9d6df');u.sunPosition.value.set(.5,.7,-.3).normalize();
  const camera=new T.PerspectiveCamera(58,1.6,.1,1e6);camera.position.set(85,8,-150);camera.lookAt(-50,95,90);const rt=new T.WebGLRenderTarget(640,400),result=[];
  for(const steps of [5,8,12]){
   u.cloudSteps.value=steps;renderer.setRenderTarget(rt);renderer.render(scene,camera);const data=new Uint8Array(640*400*4);renderer.readRenderTargetPixels(rt,0,0,640,400,data);
   // Laplacian variation also counts real cloud edges. Isolated outliers beyond
   // every neighbour distinguish pixel jitter from coherent wispy detail.
   let grain=0,spikes=0,isolatedSpikes=0;const l=(x,y)=>(data[(y*640+x)*4]+data[(y*640+x)*4+1]+data[(y*640+x)*4+2])/3;
   for(let y=1;y<399;y++)for(let x=1;x<639;x++){const d=Math.abs(l(x,y)-(l(x-1,y)+l(x+1,y)+l(x,y-1)+l(x,y+1))/4);grain+=d;if(d>8)spikes++;const c=l(x,y),ns=[l(x-1,y),l(x+1,y),l(x,y-1),l(x,y+1)];if(c>Math.max(...ns)+4||c<Math.min(...ns)-4)isolatedSpikes++;}
   result.push({steps,grain:grain/(638*398),spikes,isolatedSpikes});renderer.setRenderTarget(null);renderer.render(scene,camera);result.at(-1).image=renderer.domElement.toDataURL('image/webp',.96).split(',')[1];
  }
  q.day(0);q.scene.onBeforeRender();const midnight={};q.G.run('state',midnight);q.day(1e-7);q.scene.onBeforeRender();const after={};q.G.run('state',after);
  rt.dispose();mat.dispose();renderer.dispose();renderer.forceContextLoss();return {rows:result,midnight:midnight.atmos,after:after.atmos};
 });for(const row of isolated.rows){fs.writeFileSync(path.join(out,'sky-only-'+row.steps+'.webp'),Buffer.from(row.image,'base64'));delete row.image;}
 const checks={finiteRenderedPixels:rows.every(r=>r.invalid===0),validWebGL:rows.every(r=>r.gl===0),noErrors:!errors.length,midnightUsesNight:isolated.midnight.night===1&&isolated.midnight.day===0,clockContinuousAtMidnight:Math.abs(isolated.midnight.elev-isolated.after.elev)<.01,stableCloudSampling:isolated.rows.every(r=>r.isolatedSpikes===0),nightFogDim:rows.find(r=>r.name==='night').fog.every(c=>c<.035),visibleMoonlitWorld:rows.find(r=>r.name==='night').fill>.5};
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({baseline,checks,rows,isolated,errors},null,2));console.log(JSON.stringify({checks,isolated}));if(!baseline)assert(Object.values(checks).every(Boolean),'Sky and atmosphere acceptance failed');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

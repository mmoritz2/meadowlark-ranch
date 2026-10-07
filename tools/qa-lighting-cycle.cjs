// A simulation step owns the atmosphere. Drawing extra cameras must not change it.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),QA=require('./qa-platform.cjs');
const out=path.resolve(process.argv[2]||'output/lighting-cycle');fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await QA.chromium.launch({headless:true,args:QA.gpuArgs()});try{
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await page.route('**/api/me',r=>r.fulfill({contentType:'application/json',body:'null'}));
 await page.route('**/ranch3d.html*',async r=>{const res=await r.fetch();await r.fulfill({response:res,body:(await res.text()).replace('const MERGE_STATS=mergeStatics();',`window.__lightQA={THREE,scene,camera,renderer,composer,G,player,groundH,sky,sun,hemi,TACK,keys,step(dt){manualStepping=true;tick(dt)},day(value=.34,rain=false){dayT=value;weather.mode=rain?'rain':'clear';weather.timer=99999}};const MERGE_STATS=mergeStatics();`)});});
 await page.addInitScript(()=>{let seed=928471;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};});
 await page.goto(QA.BASE+'/ranch3d.html?qa=lighting-cycle',{timeout:120000});await page.waitForFunction(()=>window.__lightQA?.G.horse.RIG().ready&&!document.getElementById('load'),null,{timeout:120000});
 await page.evaluate(async()=>{const q=__lightQA;q.G.save.sync(s=>{s.qualityLocked=true;s.unlocked=s.unlocked||{};for(const r of q.G.tables.REGIONS)if(r.unlock)s.unlocked[r.id]=true;});q.G.wardrobe?.closeChar();q.G.hidePanels();await q.G.photoscans.ready;await q.G.worldDetails.ready;advanceTime(0);
  q.snapshot=()=>{let mist,marshMist;q.scene.traverse(o=>{if(o.material?.name==='Atmosphere | ground mist')mist=o;if(o.material?.name==='Willowmere | water mist')marshMist=o;});return{fog:q.scene.fog.color.toArray(),density:q.scene.fog.density,key:q.sun.intensity,sun:q.sun.color.toArray(),fill:q.hemi.intensity,sky:q.sky.material.uniforms.horizon.value.toArray(),mist:mist?.material.color.toArray(),marshMist:marshMist?.material.color.toArray()};};
  q.withoutDrawing=fn=>{const render=q.renderer.render;q.renderer.render=()=>{};try{return fn();}finally{q.renderer.render=render;}};
 });console.log('Lighting world ready');
 const timing=await page.evaluate(()=>{const q=__lightQA;q.G.gfx.apply('high');q.player.pos.set(321,0,300);
  const samples=q.withoutDrawing(()=>{q.day(.34);q.step(0);const day=q.snapshot();q.day(0);q.step(0);const instantNight=q.snapshot();for(let i=0;i<120;i++){q.day(0);q.step(1/30);}const settledNight=q.snapshot();q.day(.34);q.step(0);const instantDay=q.snapshot();return{day,instantNight,settledNight,instantDay};});
  q.camera.position.set(325,10,301.3);q.camera.lookAt(319.9,10,305.3);
  q.withoutDrawing(()=>{q.day(0);q.step(0);});const before=q.snapshot();for(let i=0;i<6;i++)q.composer.render();const after=q.snapshot();
  const seen=[],original=q.renderer.render;q.renderer.render=function(scene,camera){if(scene===q.scene)seen.push({reflection:camera!==q.camera,state:q.snapshot()});return original.apply(this,arguments);};
  try{q.G.waterReflections.update(performance.now()+1000);q.composer.render();}finally{q.renderer.render=original;}
  const rates=q.withoutDrawing(()=>[15,30,60].map(fps=>{q.day(0);q.step(0);q.day(.34);q.step(0);for(let i=0;i<fps*2;i++){q.day(.34,true);q.step(1/fps);}return{fps,...q.snapshot()};}));
  const wrap=q.withoutDrawing(()=>{q.day(.9999);q.step(0);const before=q.snapshot();q.day(.0001);q.step(0);return{before,after:q.snapshot()};});
  return{samples,before,after,seen,rates,wrap};
 });
 const views=[
  ...[{name:'day',time:.34},{name:'night',time:0},{name:'dawn',time:.15},{name:'sunset',time:.82},{name:'rain',time:.34,rain:true},{name:'night-low',time:0,tier:'low'},{name:'night-medium',time:0,tier:'medium'}].map(v=>({...v,eye:[325,10,301.3],look:[319.9,10,305.3]})),
  {name:'marsh-shore-night',eye:[302,5,307],look:[319,4,300],time:0},
  {name:'village-night',eye:[85,8,-150],look:[20,10,-35],time:0},
  {name:'meadow-night',eye:[-60,4,56],look:[-53,3,39],time:0,riding:true},
  {name:'snow-night',eye:[-128,7,-209],look:[-150,12,-239],time:0},
  {name:'frostpine-night',eye:[-287,8,-313],look:[-305,12,-353],time:0},
  {name:'canyon-night',eye:[-205,10,160],look:[-248,12,127],time:0},
 ];const rows=[];
 for(const v of views){const row=await page.evaluate(async v=>{const q=__lightQA;q.G.gfx.apply(v.tier||'high');q.player.pos.set(v.eye[0],0,v.eye[2]);q.player.speed=q.player.y=q.player.vy=0;q.player.onFoot=q.player.flying=false;
  q.withoutDrawing(()=>{for(let i=0;i<90;i++){q.day(v.time,v.rain);q.step(1/30);}});
  const draw=q.renderer.render;q.renderer.render=()=>{};try{let settled=0;for(let i=0;i<180;i++){q.day(v.time,v.rain);q.step(.016);settled=q.G.world.npcCharacters.stats().pending?0:settled+1;if(settled>=2)break;await new Promise(r=>setTimeout(r,40));}}finally{q.renderer.render=draw;}
  q.player.mesh.visible=!!v.riding;for(const o of Object.values(q.TACK||{}))if(o?.isObject3D)o.visible=!!v.riding;const reins=q.scene.getObjectByName('Native leather split reins');if(reins)reins.visible=!!v.riding;
  if(!v.riding){q.camera.position.set(...v.eye);q.camera.lookAt(...v.look);}q.G.waterReflections.update(performance.now()+1000);q.composer.render();
  const rt=q.composer.readBuffer,w=Math.floor(rt.width),h=Math.floor(rt.height),pixels=new Uint16Array(w*h*4);q.renderer.readRenderTargetPixels(rt,0,0,w,h,pixels);let invalid=0,minAlpha=65535;for(let i=0;i<pixels.length;i+=4){if([0,1,2].some(c=>(pixels[i+c]&0x7c00)===0x7c00))invalid++;minAlpha=Math.min(minAlpha,pixels[i+3]);}
  return{name:v.name,invalid,minAlpha,state:q.snapshot(),gl:q.renderer.getContext().getError(),image:q.renderer.domElement.toDataURL('image/webp',.95).split(',')[1]};
 },v);fs.writeFileSync(path.join(out,v.name+'.webp'),Buffer.from(row.image,'base64'));delete row.image;rows.push(row);console.log(v.name);}
 const riding=await page.evaluate(()=>{const q=__lightQA;return q.withoutDrawing(()=>{q.player.pos.set(-55,0,46);q.player.heading=-.4;q.player.speed=q.player.y=q.player.vy=0;q.player.stam=1;q.keys.KeyW=true;const start=q.player.pos.clone();let groundError=0,maxStep=0,finite=true;try{for(let i=0;i<150;i++){const prev=q.player.pos.clone();q.day(0);q.step(1/30);groundError=Math.max(groundError,Math.abs(q.player.mesh.position.y-q.groundH(q.player.pos.x,q.player.pos.z)));maxStep=Math.max(maxStep,prev.distanceTo(q.player.pos));finite&&=[...q.camera.position.toArray(),...q.player.pos.toArray()].every(Number.isFinite);}}finally{q.keys.KeyW=false;}return{distance:start.distanceTo(q.player.pos),groundError,maxStep,finite,errors:q.G.errors};});});
 const distance=(a,b)=>Math.max(...a.map((v,i)=>Math.abs(v-b[i]))),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),ref=timing.seen.filter(s=>s.reflection),main=timing.seen.filter(s=>!s.reflection),s=timing.samples;
 const checks={
  immediateNightFog:s.instantNight.fog.every(v=>v<.01),simulationOnlyFog:distance(s.instantNight.fog,s.settledNight.fog)<.0001,
  immediateDayFog:distance(s.day.fog,s.instantDay.fog)<.0001,nightMistTint:s.instantNight.mist.every(v=>v<.02),nightMarshMistTint:s.instantNight.marshMist.every(v=>v<.02),
  renderDoesNotAdvanceLighting:same(timing.before,timing.after),reflectionCaptured:ref.length>0&&main.length>0,sharedReflectionLighting:timing.seen.every(v=>same(v.state,timing.before)),
  frameRateIndependentFog:timing.rates.every(r=>distance(r.fog,timing.rates[0].fog)<.002&&Math.abs(r.density-timing.rates[0].density)<.00001),
  midnightContinuous:distance(timing.wrap.before.fog,timing.wrap.after.fog)<.0001,
  allNightViewsDim:rows.filter(r=>r.name.includes('night')).every(r=>r.state.fog.every(v=>v<.035)),daylightRetained:rows.find(r=>r.name==='day').state.fog.every(v=>v>.1),
  moonlightRetained:rows.filter(r=>r.name.includes('night')).every(r=>r.state.fill>.5&&r.state.key>.5),
  finitePixels:rows.every(r=>!r.invalid),opaqueOutput:rows.every(r=>r.minAlpha>=15300),webGL:rows.every(r=>!r.gl),
  nightRiding:riding.distance>3&&riding.groundError<.01&&riding.maxStep<.5&&riding.finite,noErrors:!errors.length&&!riding.errors.length};
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({checks,timing,rows,riding,errors},null,2));console.log(JSON.stringify({checks,riding}));assert(Object.values(checks).every(Boolean),'Lighting cycle acceptance failed');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});

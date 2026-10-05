// Actual WebGL checks, including an identical-frame contact-shading comparison.
// Run with the local preview server and PLAYWRIGHT_PATH if needed on this host.
const QA=require('./qa-platform.cjs'),fs=require('node:fs'),path=require('node:path');
const out=path.resolve(process.argv[2]||'output/world-finish');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await QA.chromium.launch({headless:true,args:QA.gpuArgs()});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
  page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});
  page.on('console',m=>{if(m.type()==='error'){errors.push(m.text());console.error(m.text().slice(0,1600));}});
  await page.route('**/ranch3d.html*',async route=>{
   const response=await route.fetch(),html=await response.text();
   await route.fulfill({response,body:html.replace('const MERGE_STATS=mergeStatics();',`window.__finishQA={THREE,scene,camera,renderer,composer,worldFinish,RIG,player,G,groundH,sky,
     day(v,rain=false){dayT=v;weather.mode=rain?'rain':'clear';weather.timer=99999;},
     place(x,z,h=0){player.pos.set(x,0,z);player.heading=h;player.speed=0;player.y=0;camYaw=.24;camPitch=.27;camDist=camDistSm=6.2;},
     shot(p,t){camera.position.set(...p);camera.lookAt(...t);renderer.info.reset();G.waterReflections.update(performance.now()+100);composer.render();},quality:applyQuality};
     const MERGE_STATS=mergeStatics();`)});
  });
  await page.goto(QA.BASE+'/ranch3d.html?qa=world-finish',{waitUntil:'load',timeout:120000});
  await page.waitForFunction(()=>window.__finishQA?.RIG.ready&&!__finishQA.RIG.loadingBreed,null,{timeout:120000});
  await page.waitForFunction(()=>!document.getElementById('load'),null,{timeout:90000});
  await page.waitForTimeout(2500);
  await page.evaluate(async()=>{
   const q=__finishQA;
   q.G.wardrobe?.closeChar();q.G.hidePanels();
   // Prevent the adaptive watchdog changing quality while boot textures compile.
   q.G.save.sync(s=>{s.qualityLocked=true;});q.quality('high');
   await q.G.worldDetails.ready;
   await q.G.photoscans.ready;
  });
  await page.waitForTimeout(2000);
  await page.evaluate(()=>{__finishQA.G.wardrobe?.closeChar();__finishQA.day(.34);advanceTime(1000);});
  console.log('World loaded; capturing views.');
  const save=async name=>{
   const b64=await page.evaluate(()=>__finishQA.renderer.domElement.toDataURL().split(',')[1]);
   fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(b64,'base64'));
  };
  const views=[
   ['ranch',[0,16,Math.PI],[5,3.8,26],[-12,2,-13]],
   ['stable',[-21,-11,0],[-24,2.1,-7],[-16,2.1,-14]],
   ['meadow',[-42,35,2],[-33,2.9,46],[-74,3,-2]],
   ['river',[12,112,0],[16,2.8,110],[-10,0,128]],
  ];
  for(const [name,at,p,t] of views){
   await page.evaluate(a=>{const q=__finishQA;q.place(...a);q.day(.34);advanceTime(1100);},at);
   await page.evaluate(({p,t})=>__finishQA.shot(p,t),{p,t});await save(name);
  }
  const scanViews=await page.evaluate(()=>{
    const q=__finishQA,tree=q.G.photoscans.treePositions.slice().sort((a,b)=>Math.hypot(a.x+50,a.z-30)-Math.hypot(b.x+50,b.z-30))[0];
    const rock=q.G.worldOutcrops.placed[0];
    const fir=q.G.photoscans.treePositions.filter(t=>t.kind==='pine').sort((a,b)=>Math.hypot(a.x+50,a.z-30)-Math.hypot(b.x+50,b.z-30))[0];
    return [
      ['scanned-woodland',[tree.x+10,tree.z+10,0],[tree.x+12,q.groundH(tree.x+12,tree.z+16)+3.2,tree.z+16],[tree.x,q.groundH(tree.x,tree.z)+tree.height*.48,tree.z]],
      ['scanned-fir',[fir.x+5,fir.z+6,0],[fir.x+8,q.groundH(fir.x+8,fir.z+12)+2.8,fir.z+12],[fir.x,q.groundH(fir.x,fir.z)+fir.height*.47,fir.z]],
      ['scanned-outcrop',[rock.x+10,rock.z+10,0],[rock.x+10,q.groundH(rock.x+10,rock.z+14)+2.2,rock.z+14],[rock.x,q.groundH(rock.x,rock.z)+1.8,rock.z]],
    ];
  });
  for(const [name,at,p,t] of scanViews){
   await page.evaluate(a=>{const q=__finishQA;q.place(...a);q.day(.34);advanceTime(1100);q.G.photoscans.update();},at);
   await page.evaluate(({p,t})=>__finishQA.shot(p,t),{p,t});await save(name);
  }
  const ao=await page.evaluate(async()=>{
   const q=__finishQA;q.place(0,16,Math.PI);q.day(.34);advanceTime(600);
   q.camera.position.set(5,3.8,26);q.camera.lookAt(-12,2,-13);
   const before=q.scene.onBeforeRender;q.scene.onBeforeRender=()=>{};
   const pixels=async()=>{
    const image=new Image();image.src=q.renderer.domElement.toDataURL();await image.decode();
    const c=document.createElement('canvas');c.width=360;c.height=225;const ctx=c.getContext('2d');ctx.drawImage(image,0,0,360,225);
    return ctx.getImageData(0,0,360,225).data;
   };
   q.worldFinish.pass.enabled=false;q.composer.render();const off=await pixels();
   q.worldFinish.pass.enabled=true;q.composer.render();const on=await pixels();q.scene.onBeforeRender=before;
   let difference=0,brightness=0,darkened=0;
   for(let i=0;i<on.length;i+=4){for(let k=0;k<3;k++){difference+=Math.abs(on[i+k]-off[i+k]);brightness+=on[i+k];}if(off[i]+off[i+1]+off[i+2]-on[i]-on[i+1]-on[i+2]>6)darkened++;}
   return {meanDifference:difference/(on.length*.75),meanBrightness:brightness/(on.length*.75),darkenedPixels:darkened};
  });
  await save('contact-shading');
  const modes=[];
  for(const [name,day,rain] of [['golden-hour',.80,false],['night',0,false],['rain',.34,true]]){
   await page.evaluate(({day,rain})=>{const q=__finishQA;q.place(0,16,Math.PI);q.day(day,rain);advanceTime(2500);q.shot([5,3.8,26],[-12,2,-13]);},{day,rain});
   await save(name);
  }
  for(const tier of ['low','medium','high']){
   modes.push(await page.evaluate(tier=>{
    const q=__finishQA;q.quality(tier);q.day(.34);advanceTime(450);q.G.photoscans.update();
    return {tier,ao:q.worldFinish.pass.enabled,samples:q.worldFinish.pass.uniforms.sampleCount.value,depth:!!q.composer.readBuffer.depthTexture,reflection:q.G.waterReflections.state.active,scanTrees:q.G.photoscans.activeTrees,cloudSteps:q.sky.material.uniforms.cloudSteps.value};
   },tier));await save(tier);
  }
  await page.setViewportSize({width:900,height:650});await page.evaluate(()=>advanceTime(100));
  const frames=await page.evaluate(async()=>{
   const q=__finishQA;q.place(-42,35,2);q.G.photoscans.update();q.day(.34);
   const deltas=[];let last=performance.now();resumeGame();
   for(let i=0;i<75;i++){await new Promise(requestAnimationFrame);const now=performance.now();if(i>12)deltas.push(now-last);last=now;}
   advanceTime(0);deltas.sort((a,b)=>a-b);
   return {viewport:[innerWidth,innerHeight],medianMs:deltas[Math.floor(deltas.length*.5)],p95Ms:deltas[Math.floor(deltas.length*.95)]};
  });
  const state=await page.evaluate(()=>{
   const q=__finishQA,gl=q.renderer.getContext();
   return {size:q.worldFinish.pass.uniforms.resolution.value.toArray(),canvas:[q.renderer.domElement.width,q.renderer.domElement.height],
    details:{placed:q.G.worldDetails.placed,skipped:q.G.worldDetails.skipped,errors:q.G.worldDetails.errors,understory:q.G.worldDetails.understory},
    reflections:q.G.waterReflections.state,
    scans:{...q.G.photoscans,ready:undefined,update:undefined},
    groundSource:q.scene.getObjectByName('Pasture terrain').material.map.image.currentSrc,
    wet:q.scene.getObjectByName('Pasture terrain').material.userData.wetWeather.value,
    gpu:gl.getParameter(gl.RENDERER),programs:q.renderer.info.programs.length,glError:gl.getError(),featureErrors:q.G.errors};
  });
  const checks={noRenderErrors:!errors.length,noFeatureErrors:!state.featureErrors.length,
   contactShadingVisible:ao.meanDifference>.10&&ao.darkenedPixels>200,
   imageExposed:ao.meanBrightness>35&&ao.meanBrightness<220,
   lowBypassesAO:modes[0].ao===false,mediumReducesSamples:modes[1].samples===6,highUsesFullSamples:modes[2].samples===12,
   resizeMatchesCanvas:state.size.every((v,i)=>v===state.canvas[i]),
   noAssetFailures:!state.details.errors.length,photoscansPlaced:state.details.placed.length>0,
   scannedUnderstory:state.details.understory>100,highReflectsWater:state.reflections.renders>0,
   lowDisablesReflections:!modes[0].reflection,mediumDisablesReflections:!modes[1].reflection,webGLValid:state.glError===0,
   eightAssetsLoaded:state.scans.assets.length===8&&!state.scans.errors.length,
   bouldersReplaced:state.scans.rocks===74,scannedOutcrops:state.scans.outcrops>0,
   forestDetailsPlaced:state.scans.saplings>10&&state.scans.logs>0&&state.scans.cliffs>0,
   lowUsesTreeFallback:modes[0].scanTrees===0,mediumTreeBudget:modes[1].scanTrees<=6,
   highTreeBudget:modes[2].scanTrees>0&&modes[2].scanTrees<=12,
   sameModelDistantTrees:state.scans.distantTrees>100,
   scannedConifers:state.scans.conifers>100,normalMappedTrees:state.scans.normalMappedViews===5,
   noSinkingBackdrop:!state.scans.farForestViews,cloudQualityBudget:modes.map(m=>m.cloudSteps).join()==='5,8,12',
   pastureGroundActive:state.groundSource.includes('pasture/grass_diff')};
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({checks,errors,ao,modes,frames,state},null,2));
  for(const [k,v]of Object.entries(checks))console.log((v?'PASS ':'FAIL ')+k);
  console.log(JSON.stringify({ao,placed:state.details.placed.length,programs:state.programs}));
  console.log(JSON.stringify({frames,scans:{...state.scans,treePositions:undefined}}));
  if(Object.values(checks).some(v=>!v))process.exitCode=1;
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

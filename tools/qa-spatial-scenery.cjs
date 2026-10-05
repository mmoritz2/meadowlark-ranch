// One settled world, frozen animation, exact source batches toggled against the
// production spatial cells. Measures draw/triangle submissions and pixel changes,
// not frame rate or iOS performance. Every context uses isolated storage.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const QA=require('./qa-platform.cjs'),root=path.resolve(__dirname,'..');
const out=path.resolve(process.argv[2]||'output/spatial-scenery');fs.mkdirSync(out,{recursive:true});
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.glb':'model/gltf-binary','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{
 const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 fs.readFile(file,(error,data)=>{if(error){res.writeHead(404).end();return;}res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(data);});
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
 const browser=await QA.chromium.launch({headless:true,args:QA.gpuArgs()});
 const context=await browser.newContext({viewport:{width:844,height:390},deviceScaleFactor:2,isMobile:true,hasTouch:true,serviceWorkers:'block'});
 const page=await context.newPage(),errors=[],failed=[],external=[];let closing=false;
 page.on('pageerror',e=>{if(!closing)errors.push(e.message);});page.on('console',m=>{if(!closing&&m.type()==='error')errors.push(m.text());});
 page.on('requestfailed',r=>{if(!closing)failed.push({url:r.url(),error:r.failure()?.errorText});});
 page.on('response',r=>{if(!closing&&r.status()>=400)failed.push({url:r.url(),status:r.status()});});
 try{
  await page.addInitScript(()=>{
   window.__spatialQA=[];let seed=0x481241;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
   window.WebSocket=class{constructor(){throw Error('Unexpected socket in isolated scenery test');}};
  });
  await page.route('**/*',async route=>{
   const url=route.request().url();if(/^https?:/.test(url)&&!url.startsWith(base+'/')){external.push(url);return route.abort();}
   const file=new URL(url).pathname;
   if(file==='/ranch3d.html'){
    let body=fs.readFileSync(path.join(root,'ranch3d.html'),'utf8');
    body=body.replace("let quality=(save&&save.quality)||'high';","let quality='medium';");
    body=body.replace('const MERGE_STATS=mergeStatics();',"window.__sceneQA={G,THREE,renderer,scene,camera,composer,RIG,ranchBuilderArt};G.save.sync(s=>{s.quality='medium';s.qualityLocked=true;});const MERGE_STATS=mergeStatics();");
    return route.fulfill({status:200,contentType:'text/html',body});
   }
   if(file==='/assets/spatial-instances.js'){
    let body=fs.readFileSync(path.join(root,file),'utf8').replace('export function partitionStaticInstances(','function buildSpatialCells(');
    body+='\nexport function partitionStaticInstances(...args){const cells=buildSpatialCells(...args);window.__spatialQA.push({source:args[1],cells});return cells;}';
    return route.fulfill({status:200,contentType:'text/javascript',body});
   }
   return route.continue();
  });
  await page.goto(base+'/ranch3d.html?qa=spatial-scenery',{waitUntil:'domcontentloaded',timeout:120000});
  await page.waitForFunction(()=>{
   if(document.querySelector('#load.load-failed'))throw Error('Engine startup failed');
   const q=window.__sceneQA;return q?.RIG.ready&&q.RIG.attachedTo===q.G.horse.player.mesh&&q.ranchBuilderArt.loaded&&window.__spatialQA.some(b=>b.source.name==='foliage_stump')&&window.__spatialQA.some(b=>b.source.name.startsWith('Frostpine'));
  },null,{timeout:120000});
  await page.evaluate(async()=>{await Promise.all([__sceneQA.G.photoscans.ready,__sceneQA.G.worldDetails.ready]);advanceTime(0);});
  await page.waitForFunction(()=>!__sceneQA.G.world.npcCharacters?.stats().pending,null,{timeout:45000});
  const setup=await page.evaluate(()=>{
   const q=__sceneQA,gl=q.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');
   window.__frozenCamera={position:q.camera.position.clone(),quaternion:q.camera.quaternion.clone()};
   __spatialQA.forEach(b=>b.parent=b.cells[0]?.parent);
   return {gpu:gl.getParameter(ext?ext.UNMASKED_RENDERER_WEBGL:gl.RENDERER),batches:__spatialQA.map(b=>({name:b.source.name,instances:b.source.count,cells:b.cells.length})),errors:{models:q.ranchBuilderArt.errors,photoscans:q.G.photoscans.errors,details:q.G.worldDetails.errors,features:q.G.errors}};
  });
  assert.ok(!/swiftshader|llvmpipe/i.test(setup.gpu));
  assert.ok(setup.batches.some(b=>b.name==='foliage_cactus'));assert.ok(setup.batches.some(b=>b.name==='foliage_stump'));
  const results=[];
  for(const quality of ['medium','high'])for(const view of ['arrival','cactus-close','sapling-close']){
   await page.evaluate(({quality,view})=>{
    const q=__sceneQA;q.G.gfx.apply(quality);q.G.photoscans.update();
    if(view==='arrival'){q.camera.position.copy(__frozenCamera.position);q.camera.quaternion.copy(__frozenCamera.quaternion);}
    else{
     const b=__spatialQA.find(b=>view==='cactus-close'?b.source.name==='foliage_cactus':b.source.name.startsWith('Frostpine'));
     const matrix=new q.THREE.Matrix4(),target=new q.THREE.Vector3();b.source.getMatrixAt(0,matrix);target.setFromMatrixPosition(matrix).add(new q.THREE.Vector3(0,1,0));
     q.camera.position.copy(target).add(new q.THREE.Vector3(9,4.5,12));q.camera.lookAt(target);
    }
    q.camera.updateMatrixWorld(true);
    __spatialQA.forEach(b=>{b.source.castShadow=b.cells[0]?.castShadow??b.source.castShadow;});
   },{quality,view});
   for(const mode of ['baseline','cells']){
    const capture=await page.evaluate(mode=>{
     const q=__sceneQA;
     for(const b of __spatialQA){
      if(mode==='baseline'){b.cells.forEach(c=>c.removeFromParent());b.parent.add(b.source);}
      else{b.source.removeFromParent();b.parent.add(...b.cells);}
     }
     const draw=()=>{q.renderer.info.reset();if(q.G.gfx.bloom())q.composer.render(0);else q.renderer.render(q.scene,q.camera);};
     draw();draw(); // Settle shader compilation and render-target state, no game tick.
     const rows=new Map(),original=q.renderer.renderBufferDirect;
     q.renderer.renderBufferDirect=function(camera,scene,geometry,material,object,group){
      if(object.name.startsWith('foliage_')||object.name.startsWith('Frostpine | scanned')){
       const key=object.name,row=rows.get(key)||{name:key,calls:0,triangles:0};row.calls++;
       const available=geometry.index?.count||geometry.attributes.position?.count||0,start=Math.max(geometry.drawRange.start,group?.start||0),end=Math.min(available,geometry.drawRange.start+geometry.drawRange.count,group?group.start+group.count:Infinity);
       row.triangles+=Math.max(0,end-start)*(object.isInstancedMesh?object.count:1)/3;rows.set(key,row);
      }
      return original.apply(this,arguments);
     };
     try{draw();}finally{q.renderer.renderBufferDirect=original;}
     const gl=q.renderer.getContext(),pixels=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
     let comparison=null;
     if(mode==='baseline')window.__baselinePixels=pixels;
     else{
      let changed=0,over2=0,maxDelta=0;for(let i=0;i<pixels.length;i+=4){let delta=0;for(let k=0;k<3;k++)delta=Math.max(delta,Math.abs(pixels[i+k]-__baselinePixels[i+k]));if(delta)changed++;if(delta>2)over2++;maxDelta=Math.max(maxDelta,delta);}
      comparison={pixels:pixels.length/4,changedPixels:changed,pixelsOverTwoLevels:over2,maxChannelDelta:maxDelta};
     }
     return {totals:{...q.renderer.info.render},scenery:[...rows.values()],comparison,png:q.renderer.domElement.toDataURL('image/png').split(',')[1],oldBatchesAttached:__spatialQA.filter(b=>!!b.source.parent).length};
    },mode);
    fs.writeFileSync(path.join(out,`${quality}-${view}-${mode}.png`),Buffer.from(capture.png,'base64'));delete capture.png;
    const row={quality,view,mode,...capture};results.push(row);console.log(JSON.stringify(row));
   }
  }
  const report={kind:'same settled desktop scene, frozen simulation; no FPS/iPhone performance claim',viewport:[844,390],dpr:2,setup,results,errors,failed,external};
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2)+'\n');
  assert.equal(errors.length,0);assert.equal(failed.length,0);assert.equal(external.length,0);for(const list of Object.values(setup.errors))assert.equal(list.length,0);
  for(const r of results.filter(r=>r.mode==='cells')){assert.equal(r.oldBatchesAttached,0);assert.ok(r.comparison.pixelsOverTwoLevels/r.comparison.pixels<.001,`${r.quality}/${r.view}: visible pixel difference needs inspection`);}
 }finally{closing=true;await context.close();await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});

// Controlled browser-only loading comparison. It does not measure iOS performance.
// Run after other GPU tests finish. Each case gets isolated storage/cache and the
// same seeded world, Medium preset, viewport, renderer backend, and local server.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const QA=require('./qa-platform.cjs');
const root=path.resolve(__dirname,'..'),out=path.resolve(process.argv[2]||'output/loading-budget');fs.mkdirSync(out,{recursive:true});
const cases=(process.env.QA_LOAD_CASES||'eager,deferred,deferred,eager').split(',');
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.glb':'model/gltf-binary','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{const rel=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=path.resolve(root,'.'+rel);if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(file,(error,bytes)=>{if(error){res.writeHead(404).end();return;}res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.setHeader('Cache-Control','no-store');res.end(bytes);});});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 const browser=await QA.chromium.launch({headless:true,args:QA.gpuArgs()});const results=[];
 try{
  for(const [index,mode] of cases.entries()){
   assert.ok(['eager','deferred'].includes(mode));
   const context=await browser.newContext({viewport:{width:844,height:390},deviceScaleFactor:2,isMobile:true,hasTouch:true,serviceWorkers:'block'}),page=await context.newPage();
   let closing=false;
   const errors=[],failed=[],external=[];page.on('pageerror',e=>{if(!closing)errors.push(e.message);});page.on('console',m=>{if(!closing&&m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(!closing&&r.status()>=400)failed.push({url:r.url(),status:r.status()});});page.on('requestfailed',r=>{if(!closing)failed.push({url:r.url(),error:r.failure()?.errorText});});
   await page.route('**/*',async route=>{
    const url=route.request().url();if(/^https?:/.test(url)&&!url.startsWith(base+'/')){external.push(url);return route.abort();}
    if(new URL(url).pathname==='/ranch3d.html'){
     let html=fs.readFileSync(path.join(root,'ranch3d.html'),'utf8');
     assert.equal((html.match(/deferModels\s*:\s*(true|false)/g)||[]).length,1,'Expected one integrated builder loading gate');
     html=html.replace(/deferModels\s*:\s*(true|false)/,'deferModels:'+(mode==='deferred'));
     html=html.replace("let quality=(save&&save.quality)||'high';","let quality='medium';");
     html=html.replace('const MERGE_STATS=mergeStatics();',"window.__loadingQA={G,renderer,scene,camera,composer,worldFinish,RIG,ranchBuilderArt};G.save.sync(s=>{s.quality='medium';s.qualityLocked=true;});const MERGE_STATS=mergeStatics();");
     return route.fulfill({status:200,contentType:'text/html',body:html});
    }
    if(new URL(url).pathname==='/assets/ranch-builder-art.js'){
     const text=fs.readFileSync(path.join(root,'assets/ranch-builder-art.js'),'utf8');
     assert.ok(text.includes('state.startLoading=()=>modelLoad.start();'));
     return route.fulfill({status:200,contentType:'text/javascript',body:text.replace('state.startLoading=()=>modelLoad.start();','state.startLoading=()=>{const q=window.__loadingQA,t=window.__loadingTrace;t.builderStart??=performance.now();t.horseAttachedAtBuilderStart??=!!(q?.RIG.ready&&q.RIG.attachedTo===q.G.horse.player.mesh);return modelLoad.start();};')});
    }
    return route.continue();
   });
   await page.addInitScript(()=>{
    performance.setResourceTimingBufferSize(4000);
    let seed=0x481241;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    window.__loadingTrace={builderStart:null,horseReady:null,builderReady:null,socketAttempts:[],frameGaps:[]};
    window.WebSocket=class{constructor(url){window.__loadingTrace.socketAttempts.push(String(url));throw Error('Unexpected socket during isolated loading test');}};
    let previousFrame=0;
    const record=()=>{const q=window.__loadingQA,t=window.__loadingTrace,now=performance.now();if(previousFrame)t.frameGaps.push({at:now,ms:now-previousFrame});previousFrame=now;if(q){if(q.RIG.ready&&q.RIG.attachedTo===q.G.horse.player.mesh)t.horseReady??=now;if(q.ranchBuilderArt.loaded)t.builderReady??=now;}if(!t.horseReady||!t.builderReady)requestAnimationFrame(record);};requestAnimationFrame(record);
   });
   console.log('Loading case '+(index+1)+'/'+cases.length+': '+mode);
   try{
    await page.goto(base+'/ranch3d.html?qa=loading-budget',{waitUntil:'domcontentloaded',timeout:120000});
    await page.waitForFunction(()=>{if(document.querySelector('#load.load-failed'))throw Error('Engine startup reported a failure');return __loadingTrace.horseReady&&__loadingTrace.builderReady;},null,{timeout:180000});
    await page.evaluate(async()=>{await Promise.all([__loadingQA.G.photoscans.ready,__loadingQA.G.worldDetails.ready]);});
    const sample=await page.evaluate(()=>{
     const q=__loadingQA,gl=q.renderer.getContext(),debug=gl.getExtension('WEBGL_debug_renderer_info');return {trace:__loadingTrace,quality:q.G.gfx.get(),models:[...q.ranchBuilderArt.models].sort(),modelErrors:q.ranchBuilderArt.errors,featureErrors:q.G.errors,photoscanErrors:q.G.photoscans.errors,
      resources:performance.getEntriesByType('resource').map(r=>({path:new URL(r.name).pathname,startMs:r.startTime,endMs:r.responseEnd,bytes:r.decodedBodySize})),
      gpu:gl.getParameter(debug?debug.UNMASKED_RENDERER_WEBGL:gl.RENDERER)};
    });
    const scanIds=['wine_barrel_01','wooden_picnic_table','planter_box_01','wooden_lantern_01','tree_stump_01','flower_gazania','wild_rooibos_bush','tree_small_02','pine_sapling_small','rock_moss_set_01'];
    const builderPaths=scanIds.map(id=>'/assets/models/world/'+(['tree_small_02','pine_sapling_small','rock_moss_set_01'].includes(id)?'realism/':'builder/')+id+'.glb');
    sample.catalogueBeforeHorse=sample.resources.filter(r=>builderPaths.includes(r.path)&&r.startMs<sample.trace.horseReady);
    sample.catalogueBytes=builderPaths.reduce((n,p)=>n+fs.statSync(path.join(root,p)).size,0);
    sample.mode=mode;sample.index=index;sample.errors=[...errors];sample.failed=[...failed];sample.external=[...external];
    results.push(sample);fs.writeFileSync(path.join(out,'loading-results.json'),JSON.stringify({kind:'desktop browser loading fixture; not device performance evidence',viewport:[844,390],dpr:2,preset:'medium',backend:QA.GPU,results},null,2)+'\n');
    assert.equal(sample.quality,'medium');assert.ok(!/swiftshader|llvmpipe/i.test(sample.gpu),'Software rasterizer invalidates GPU timing');assert.equal(sample.models.length,10);assert.equal(sample.modelErrors.length,0);assert.equal(errors.length,0);assert.equal(failed.length,0);assert.equal(external.length,0);assert.equal(sample.trace.socketAttempts.length,0);assert.equal(sample.featureErrors.length,0);
    if(mode==='deferred')assert.equal(sample.trace.horseAttachedAtBuilderStart,true,'Catalogue starts only after the horse has attached in this fixture');
    console.log(JSON.stringify({mode,horseReadyMs:Math.round(sample.trace.horseReady),builderStartMs:Math.round(sample.trace.builderStart),builderReadyMs:Math.round(sample.trace.builderReady),catalogueRequestsBeforeHorse:sample.catalogueBeforeHorse.length}));
    if(mode==='deferred'&&process.env.QA_LOAD_TREE_AUDIT==='1'){
     await page.evaluate(async()=>{await Promise.all([__loadingQA.G.photoscans.ready,__loadingQA.G.worldDetails.ready]);__loadingQA.G.hidePanels();advanceTime(0);});
     const draw=await page.evaluate(()=>{
      const q=__loadingQA,rows=new Map(),original=q.renderer.renderBufferDirect;
      q.renderer.renderBufferDirect=function(camera,scene,geometry,material,object,group){const key=object.name||object.type,old=rows.get(key)||{name:key,calls:0,triangles:0};old.calls++;const available=geometry.index?.count||geometry.attributes.position?.count||0,start=Math.max(geometry.drawRange.start,group?.start||0),end=Math.min(available,geometry.drawRange.start+geometry.drawRange.count,group?group.start+group.count:Infinity);if(object.isMesh)old.triangles+=Math.max(0,end-start)*(object.isInstancedMesh?object.count:1)/3;rows.set(key,old);return original.apply(this,arguments);};
      try{advanceTime(16);}finally{q.renderer.renderBufferDirect=original;}
      return {totals:{...q.renderer.info.render},calls:[...rows.values()].sort((a,b)=>b.triangles-a.triangles),scans:{active:q.G.photoscans.activeTrees,total:q.G.photoscans.trees},programs:q.renderer.info.programs.length};
     });
     fs.writeFileSync(path.join(out,'draw-breakdown-'+index+'.json'),JSON.stringify(draw,null,2)+'\n');await page.screenshot({path:path.join(out,'trees-'+index+'.png')});
    }
   }catch(error){
    let state;try{state=await page.evaluate(()=>({trace:{...window.__loadingTrace,frameGaps:undefined},horse:window.__loadingQA?.RIG.ready,builder:window.__loadingQA?.ranchBuilderArt.loaded,load:document.getElementById('load')?.textContent}));}catch{}
    fs.writeFileSync(path.join(out,'failure-'+index+'.json'),JSON.stringify({mode,message:error.message,errors,failed,external,state},null,2)+'\n');throw error;
   }finally{closing=true;await context.close();}
  }
 }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});

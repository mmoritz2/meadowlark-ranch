// Isolated desktop Chromium cold loads; request ordering and timings, not mobile FPS.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const QA=require('./qa-platform.cjs'),root=path.resolve(__dirname,'..'),out=process.env.QA_OUT||'/private/tmp/meadowlark-horse-startup',ref=process.env.QA_STARTUP_REF||'2e6a238';fs.mkdirSync(out,{recursive:true});
const compared=['ranch3d.html','assets/undergrowth.js','assets/ranch-world-details.js','assets/world-photoscans.js','assets/breed-models.js'];
const baseline=new Map(compared.map(file=>['/'+file,execFileSync('git',['show',ref+':'+file],{cwd:root,maxBuffer:8*1024*1024})]));
const cases=(process.env.QA_STARTUP_CASES||'baseline,candidate,candidate,baseline').split(',');
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.glb':'model/gltf-binary','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp'};
let mode;const server=http.createServer((req,res)=>{const rel=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=path.resolve(root,'.'+rel);if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}const send=(err,body)=>{if(err){res.writeHead(404).end();return;}if(rel==='/ranch3d.html'){body=body.toString().replace('const MERGE_STATS=mergeStatics();','window.__startupQA={G,RIG,ranchBuilderArt};const MERGE_STATS=mergeStatics();');}res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.setHeader('Cache-Control','no-store');res.end(body);};if(mode==='baseline'&&baseline.has(rel))send(null,baseline.get(rel));else fs.readFile(file,send);});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
 const browser=await QA.chromium.launch({headless:true,args:QA.gpuArgs()}),results=[];
 try{for(const [index,variant]of cases.entries()){
  mode=variant;assert(['baseline','candidate'].includes(mode));console.log('START '+mode+' '+index);
  const context=await browser.newContext({viewport:{width:1280,height:850},deviceScaleFactor:1,serviceWorkers:'block'}),page=await context.newPage(),errors=[],failed=[];let closing=false;
  page.on('pageerror',e=>{if(!closing)errors.push(e.message)});page.on('response',r=>{if(!closing&&r.status()>=400&&!new URL(r.url()).pathname.startsWith('/api/'))failed.push({url:r.url(),status:r.status()});});
  await page.routeWebSocket('**',ws=>ws.close());
  await page.addInitScript(()=>{
   performance.setResourceTimingBufferSize(6000);let seed=0x481241;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
   const t=window.__startupTrace={attached:null,curtainGone:null,longTasks:[]};new PerformanceObserver(list=>{for(const e of list.getEntries())t.longTasks.push({start:e.startTime,duration:e.duration})}).observe({type:'longtask',buffered:true});
   const record=()=>{const q=window.__startupQA,now=performance.now();if(q&&q.RIG.ready&&!q.RIG.loadingBreed&&q.RIG.attachedTo===q.G.horse.player.mesh)t.attached??=now;if(t.attached&&!document.getElementById('load'))t.curtainGone??=now;if(!t.curtainGone)requestAnimationFrame(record);};requestAnimationFrame(record);
  });
  try{
   await page.goto(base+'/ranch3d.html?qa=horse-startup',{waitUntil:'domcontentloaded',timeout:120000});
   await page.waitForFunction(()=>window.__startupTrace.curtainGone,null,{timeout:240000});
   const result=await page.evaluate(()=>{const {G,RIG}=__startupQA,gl=G.renderer.getContext(),debug=gl.getExtension('WEBGL_debug_renderer_info');return {trace:__startupTrace,breed:RIG.modelKey,gpu:gl.getParameter(debug?debug.UNMASKED_RENDERER_WEBGL:gl.RENDERER),quality:G.gfx.get(),featureErrors:G.errors,resources:performance.getEntriesByType('resource').map(r=>({path:new URL(r.name).pathname,start:r.startTime,end:r.responseEnd,bytes:r.decodedBodySize}))};});
   Object.assign(result,{mode,index,errors,failed});result.optionalBeforeHorse=result.resources.filter(r=>r.start<result.trace.attached&&(/\/models\/world\/(undergrowth|builder|realism)\//.test(r.path)||/\/models\/world\/(fern_02|shrub_03|shrub_04)\.glb/.test(r.path)));
   result.longTaskMsBeforeHorse=result.trace.longTasks.filter(t=>t.start<result.trace.attached).reduce((n,t)=>n+t.duration,0);
   results.push(result);fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({reference:ref,kind:'Controlled local desktop cold-load comparison; default graphics, 1280x850 DPR1; no mobile performance claim',results},null,2));
   console.log(JSON.stringify({mode,horseAttachedMs:Math.round(result.trace.attached),curtainGoneMs:Math.round(result.trace.curtainGone),longTaskMs:Math.round(result.longTaskMsBeforeHorse),optionalRequestsBeforeHorse:result.optionalBeforeHorse.length,optionalBytesBeforeHorse:result.optionalBeforeHorse.reduce((n,r)=>n+r.bytes,0),gpu:result.gpu,errors,failed}));
   assert(!/swiftshader|llvmpipe/i.test(result.gpu));assert.equal(errors.length,0);assert.equal(failed.length,0);assert.equal(result.featureErrors.length,0);
   if(process.env.QA_STARTUP_SCENERY==='1'&&mode==='candidate'){
    await page.evaluate(async()=>{await Promise.all([__features.undergrowth.ready,__features.photoscans.ready,__features.worldDetails.ready,__features.world.ranchBuilderArt.ready]);});
    result.scenery=await page.evaluate(()=>({undergrowth:__features.undergrowth.stats,errors:[...__features.undergrowth.errors,...__features.photoscans.errors,...__features.worldDetails.errors,...__features.world.ranchBuilderArt.errors],builderModels:[...__features.world.ranchBuilderArt.models]}));
    fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({reference:ref,results},null,2));assert(result.scenery.undergrowth.ready);assert.equal(result.scenery.errors.length,0);assert.equal(result.scenery.builderModels.length,10);
    await page.evaluate(()=>{__features.hidePanels();advanceTime(0)});await page.screenshot({path:path.join(out,'scenery-'+index+'.png')});
   }
  }finally{closing=true;await context.close();}
 }}finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1});

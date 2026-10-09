/* Real game recovery checks in disposable browser contexts. Use an existing local
 * server via QA_URL/QA_PORT. This is functional QA, not a performance benchmark.
 * Browser-only source instrumentation injects a deliberate installation error;
 * no saved game, production source, or approved asset is changed. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const QA=require('./qa-platform.cjs');
const out=process.env.QA_OUT||path.join(os.tmpdir(),'meadowlark-horse-arrival');
const cases=(process.env.QA_ARRIVAL_CASES||'held,fetch-failure,install-failure').split(',');
const holdMs=Number(process.env.QA_ARRIVAL_HOLD_MS||35000);
const horsePath='/review/native-trot-reference-kit/white/model.glb';
const optionalPath=p=>/^\/assets\/models\/world\/(?:builder\/|realism\/|undergrowth\/|props\/|(?:fern_02|shrub_03|shrub_04)\.glb)/.test(p);
assert(holdMs>30000,'the held request must outlast both old 20s/30s fallback gates');
for(const name of cases)assert(['held','fetch-failure','install-failure'].includes(name),'unknown case '+name);
fs.mkdirSync(out,{recursive:true});

function replaceOnce(source,needle,replacement){
 assert.equal(source.split(needle).length,2,'QA source hook must match exactly once: '+needle);
 return source.replace(needle,replacement);
}
function instrument(html,installFailure){
 if(installFailure)html=replaceOnce(html,' initGameHero(THREE,RIG);',
  " window.__arrivalTrace.installFault=true;window.__arrivalTrace.partialReady=RIG.ready;throw Error('QA deliberate horse installation failure');initGameHero(THREE,RIG);");
 return replaceOnce(html,'const MERGE_STATS=mergeStatics();',`
 window.__arrivalQA={G,RIG,HORSE_ARRIVAL};
 HORSE_ARRIVAL.ready.then(outcome=>{window.__arrivalTrace.outcome=outcome;window.__arrivalTrace.settledAt=performance.now();});
 Promise.all([G.undergrowth.ready,G.photoscans.ready,G.worldDetails.ready,G.world.ranchBuilderArt.ready])
  .then(()=>{window.__arrivalTrace.sceneryComplete=true;},error=>{window.__arrivalTrace.sceneryError=String(error);});
 const MERGE_STATS=mergeStatics();`);
}
// Catch changed hook boundaries before opening a browser rather than throwing
// from an asynchronous route handler halfway through recovery checks.
instrument(fs.readFileSync(path.join(__dirname,'..','ranch3d.html'),'utf8'),true);
async function snapshot(page){
 return page.evaluate(()=>{
  const q=window.__arrivalQA,t=window.__arrivalTrace;
  if(!q)return {trace:t};
  const {G,RIG,HORSE_ARRIVAL}=q,selected=G.horse.ridden()?.breed||'bay';
  return {trace:t,selected,model:RIG.modelKey,ready:!!RIG.ready,loading:!!RIG.loadingBreed,
   attached:RIG.attachedTo===G.horse.player.mesh,gateSettled:HORSE_ARRIVAL.settled,
   loadVisible:!!document.getElementById('load'),failureVisible:!!document.querySelector('#load.load-failed'),
   retryVisible:!!document.getElementById('loadRetry')&&!document.getElementById('loadRetry').hidden,
   builderLoaded:G.world.ranchBuilderArt.loaded,builderModels:[...G.world.ranchBuilderArt.models],
   plantStats:G.undergrowth.stats,featureErrors:G.errors,
   sceneryErrors:[...G.world.ranchBuilderArt.errors,...G.photoscans.errors,...G.worldDetails.errors,...G.undergrowth.errors],
   woodlandSettled:!!G.photoscans.woodlandEdge.settled};
 });
}
async function healthy(page){
 await page.waitForFunction(()=>window.__arrivalTrace?.outcome?.status==='ready'&&!document.getElementById('load'),null,{timeout:240000});
 const state=await snapshot(page);
 assert(state.ready&&!state.loading&&state.attached,'healthy selected horse is installed and attached');
 assert.equal(state.model,state.selected,'fresh fixture selected breed must be the attached model');
 assert.equal(state.failureVisible,false);assert.deepEqual(state.featureErrors,[]);
 return state;
}
async function sceneryReady(page){
 await page.waitForFunction(()=>window.__arrivalTrace?.sceneryComplete||window.__arrivalTrace?.sceneryError,null,{timeout:240000});
 const state=await snapshot(page);
 assert.equal(state.trace.sceneryError,undefined);assert.equal(state.trace.sceneryComplete,true);
 assert.equal(state.builderLoaded,true);assert.equal(state.builderModels.length,10);
 assert.equal(state.plantStats.ready,true);assert.equal(state.woodlandSettled,true);
 assert.deepEqual(state.sceneryErrors,[]);return state;
}
async function renderScenery(page,file){
 await page.evaluate(()=>{
  const G=window.__arrivalQA.G;
  G.wardrobe?.closeChar();G.hidePanels();
  window.advanceTime(0);
 });
 assert.equal(await page.evaluate(()=>document.body.classList.contains('se-char-open')),false,'Character screen must not obscure scenery evidence');
 await page.screenshot({path:path.join(out,file)});
}

(async()=>{
 const browser=await QA.chromium.launch({headless:true,args:QA.gpuArgs()});
 const report={kind:'Functional desktop Chromium arrival/recovery checks; no timing or phone-performance claim',base:QA.BASE,cases:[]};
 const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
 try{
  for(const mode of cases){
   console.log('START '+mode);
   const context=await browser.newContext({viewport:{width:1280,height:850},serviceWorkers:'block'});
   const page=await context.newPage(),requests=[],errors=[],httpFailures=[],requestFailures=[],requestDocuments=new WeakMap();
   const result={mode,errors,httpFailures,requestFailures};report.cases.push(result);
   let documents=0,closed=false,release,markHeld;
   const hold=new Promise(resolve=>{release=resolve;});
   const heldStarted=new Promise(resolve=>{markHeld=resolve;});
   page.on('pageerror',error=>{if(!closed)errors.push(error.message);});
   page.on('response',response=>{
    const p=new URL(response.url()).pathname;
    if(!closed&&response.status()>=400&&!p.startsWith('/api/'))httpFailures.push({path:p,status:response.status(),document:requestDocuments.get(response.request())??documents});
   });
   page.on('requestfailed',request=>{if(!closed)requestFailures.push({path:new URL(request.url()).pathname,error:request.failure()?.errorText,document:requestDocuments.get(request)??documents});});
   await page.routeWebSocket('**',socket=>socket.close());
   await page.addInitScript(()=>{
    window.__arrivalTrace={outcome:null,installFault:false,sceneryComplete:false};
    performance.setResourceTimingBufferSize(6000);
   });
   await page.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url());
    if(url.origin!==new URL(QA.BASE).origin)return route.abort();
    if(request.isNavigationRequest()&&url.pathname==='/ranch3d.html'){
     documents++;
     const response=await route.fetch();
     const html=instrument(await response.text(),mode==='install-failure'&&documents===1);
     return route.fulfill({response,body:html});
    }
    requestDocuments.set(request,documents);requests.push({path:url.pathname,document:documents,at:Date.now()});
    if(url.pathname===horsePath&&documents===1){
     if(mode==='fetch-failure')return route.abort('failed');
     if(mode==='held'){markHeld();await hold;if(closed)return;}
    }
    return route.continue();
   });
   try{
    await page.goto(QA.BASE+'/ranch3d.html?qa=horse-arrival-'+mode,{waitUntil:'domcontentloaded',timeout:120000});
    await page.waitForFunction(()=>!!window.__arrivalQA,null,{timeout:120000});
    if(mode==='held'){
     await Promise.race([heldStarted,new Promise((_,reject)=>setTimeout(()=>reject(Error('selected base request was not held')),30000))]);
     const files=await page.evaluate(()=>{
      const G=__arrivalQA.G,profile=G.horse.breedModels.profile(G.horse.ridden()?.breed||'bay');
      const url=file=>new URL(file,new URL('./assets/breed-models.js',location.href)).pathname;
      return {base:url(profile.file),parallel:[profile.nativeVariant?.file,profile.nativeVariant?.coat?.file,profile.motionFile].filter(Boolean).map(url)};
     });
     assert.equal(files.base,horsePath);assert.equal(files.parallel.length,3,'selected shape, coat and motion are all required');
     await page.waitForTimeout(holdMs);
     result.held=await snapshot(page);result.parallelFiles=files.parallel;
     assert.equal(result.held.gateSettled,false);assert.equal(result.held.trace.outcome,null);
     assert.equal(result.held.loading,true);assert.equal(result.held.failureVisible,false);
     assert.equal(result.held.retryVisible,true,'slow connection offers Retry without a false failure');
     result.optionalWhileHeld=requests.filter(r=>r.document===1&&optionalPath(r.path));
     assert.deepEqual(result.optionalWhileHeld,[],'optional scenery cannot start at the former 20s/30s deadlines');
     for(const file of files.parallel)assert(requests.some(r=>r.document===1&&r.path===file),'independent selected dependency starts while base is held: '+file);
     await page.screenshot({path:path.join(out,'held-past-timeouts.png')});
     release();result.healthy=await healthy(page);result.scenery=await sceneryReady(page);
     await renderScenery(page,'healthy-scenery.png');
    }else{
     await page.waitForFunction(()=>window.__arrivalTrace?.outcome?.status==='failed'&&document.querySelector('#load.load-failed'),null,{timeout:240000});
     result.failed=await snapshot(page);
     assert.equal(result.failed.ready,false);assert.equal(result.failed.loading,false);
     assert.equal(result.failed.retryVisible,true);assert.equal(result.failed.loadVisible,true);
     assert.equal(result.failed.trace.installFault,mode==='install-failure');
     if(mode==='install-failure')assert.equal(result.failed.trace.partialReady,true,'fault occurs after the real rig was assigned ready:true');
     assert.match(await page.locator('#loadpct').textContent(),/horse could not finish loading/i);
     await page.waitForFunction(()=>performance.getEntriesByType('resource').some(r=>/\/models\/world\/builder\//.test(r.name)),null,{timeout:60000});
     result.optionalAfterFailure=requests.filter(r=>r.document===1&&optionalPath(r.path));
     assert(result.optionalAfterFailure.length>0,'failure releases the optional scenery waiters');
     await page.screenshot({path:path.join(out,mode+'-retry.png')});
     await Promise.all([page.waitForURL(url=>url.pathname==='/ranch3d.html',{waitUntil:'domcontentloaded'}),page.locator('#loadRetry').click()]);
     await page.waitForFunction(()=>window.__arrivalQA&&window.__arrivalTrace?.outcome?.status==='ready',null,{timeout:240000});
     result.recovered=await healthy(page);assert.equal(documents,2,'Retry performs a fresh, healthy startup');
     if(mode==='install-failure'){
      result.scenery=await sceneryReady(page);
      await renderScenery(page,'recovered-scenery.png');
     }
    }
    assert.deepEqual(errors,[],'installation failure is caught rather than becoming an uncaught page error');
    assert.deepEqual(httpFailures,[],'no missing production asset');
    const unexpected=requestFailures.filter(r=>!(mode==='fetch-failure'&&r.document===1&&r.path===horsePath)&&!(r.document===1&&mode!=='held'&&/ERR_ABORTED/.test(r.error||''))&&!r.path.startsWith('/api/'));
    assert.deepEqual(unexpected,[],'only deliberate failure or requests cancelled by Retry may fail');
    result.passed=true;result.documents=documents;save();console.log('PASS '+mode);
   }catch(error){
    result.error=error.stack;
    try{result.failureState=await snapshot(page);await page.screenshot({path:path.join(out,mode+'-unexpected.png')});}catch{}
    save();throw error;
   }finally{closed=true;release();await context.close();}
  }
 }finally{await browser.close();save();}
 console.log('Horse arrival recovery passed: '+out);
})().catch(error=>{console.error(error);process.exitCode=1;});

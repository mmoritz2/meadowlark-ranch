/* Focused Studio entry regression: real current catalog plus prepared catalog
 * injected into fresh localhost responses. Never activates prepared defaults. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),QA=require('./qa-platform.cjs');
const root=path.resolve(__dirname,'..'),out=path.join(root,'output/studio-entry-qa');
const files=['breeds.html','assets/breed-models.js','assets/models/artist-breeds/manifest.json','assets/models/horse-imports/prepared-manifest.json'];
const hashes=()=>Object.fromEntries(files.map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,f))).digest('hex')]));
const catalogs={current:'assets/models/artist-breeds/manifest.json',prepared:'assets/models/horse-imports/prepared-manifest.json'};
const queries={default:'',unknown:'?horse=does-not-exist',hero:'?horse=hero',legacyStudy:'?horse=artist-study'};
let browser;
(async()=>{
 fs.mkdirSync(out,{recursive:true});const before=hashes(),samples=[];
 browser=await QA.chromium.launch({headless:true,executablePath:process.env.QA_CHROMIUM||undefined,args:QA.gpuArgs()});
 for(const [catalog,file]of Object.entries(catalogs)){
  const manifest=JSON.parse(fs.readFileSync(path.join(root,file))),expected=['bay-sporthorse','bay'].find(k=>manifest.breeds[k]?.file&&manifest.breeds[k].available!==false);
  for(const [entry,query]of Object.entries(queries)){
   const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],blocked=[],requests=[];
   page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
   page.on('request',r=>requests.push(new URL(r.url()).pathname));
   await page.route('**/*',route=>{const u=new URL(route.request().url());if(['blob:','data:'].includes(u.protocol)||u.hostname==='127.0.0.1')return route.continue();blocked.push(u.href);return route.abort();});
   if(catalog==='prepared')await page.route('**/breeds.html*',route=>{
    const html=fs.readFileSync(path.join(root,'breeds.html'),'utf8'),call='createBreedLibrary({THREE,GLTFLoader,clone})';
    if(!html.includes(call))throw Error('Expected unchanged shipping catalog call');
    return route.fulfill({contentType:'text/html',body:html.replace(call,"createBreedLibrary({THREE,GLTFLoader,clone,manifestURL:new URL('./assets/models/horse-imports/prepared-manifest.json',location.href)})")});
   });
   await page.goto(QA.BASE+'/breeds.html'+query,{waitUntil:'load',timeout:120000});
   await page.waitForFunction(()=>window.render_game_to_text&&JSON.parse(render_game_to_text()).modelReady&&!JSON.parse(render_game_to_text()).loading,null,{timeout:120000});
   const initial=await page.evaluate(()=>({state:JSON.parse(render_game_to_text()),geometry:breedStudioInspect(),credit:document.getElementById('credit').textContent,count:document.getElementById('count').textContent,rows:[...document.querySelectorAll('#list button')].map(b=>({key:b.dataset.key,disabled:b.disabled})),reviewLink:document.querySelector('.review-link').getAttribute('href'),url:location.href}));
   await page.screenshot({path:path.join(out,catalog+'-'+entry+'.png')});
   await page.locator('#motion').selectOption('walk');await page.evaluate(()=>advanceTime(850));
   const walking=await page.evaluate(()=>({state:JSON.parse(render_game_to_text()),geometry:breedStudioInspect()}));
   const restQ=initial.geometry.animation.localQuaternions,walkQ=walking.geometry.animation.localQuaternions;
   const source=manifest.breeds[expected],pending=Object.entries(manifest.breeds).filter(([,s])=>s.available===false).map(([k])=>k).sort();
   const checks={availableExplicitDefault:initial.state.breed===expected&&initial.state.asset.sha256===source.sha256&&initial.state.modelReady&&initial.state.status==='',queryCanonicalized:new URL(initial.url).searchParams.get('horse')===expected,noMissingStudyRow:!initial.rows.some(r=>r.key==='artist-study'),honestCatalogCount:initial.count===Object.keys(manifest.breeds).length+' game horses'+(pending.length?' · '+pending.length+' being prepared':''),pendingRowsPreserved:JSON.stringify(initial.rows.filter(r=>r.disabled).map(r=>r.key).sort())===JSON.stringify(pending),sourceReviewLink:initial.reviewLink==='horse-import-review.html',sourceSpecificCredit:initial.credit.includes(source.sourceAuthor||source.creator||source.artist||'b2przemo')&&initial.credit.includes(source.license||'CC BY 3.0'),finiteBodyAndGroom:initial.geometry.finite&&walking.geometry.finite&&walking.geometry.vertices>0,walkControlStillDeforms:walking.state.motion==='walk'&&restQ&&walkQ&&restQ.some((q,i)=>q.some((v,j)=>Math.abs(v-walkQ[i][j])>.001)),noAbsentLegacyAssetFetch:!requests.some(u=>/horse-candidates\/.*rig-study|models\/hero-horse/.test(u)),noPageOrShaderErrors:errors.length===0,noExternalRequests:blocked.length===0};
   samples.push({catalog,entry,expected,checks,errors,blocked,requests,initial,walking});console.log(JSON.stringify({catalog,entry,checks,errors}));await page.close();
  }
 }
 const after=hashes(),checks={eightFocusedEntries:samples.length===8,allEntryChecksPass:samples.every(s=>Object.values(s.checks).every(Boolean)),shippingDefaultsAndCatalogsUnmodified:JSON.stringify(before)===JSON.stringify(after)};
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({checks,before,after,preparedCatalogInjectedOnly:true,defaultCatalogActivated:false,samples},null,2)+'\n');
 console.log(JSON.stringify({checks}));await browser.close();if(Object.values(checks).some(v=>!v))process.exitCode=1;
})().catch(async e=>{console.error(e);if(browser)await browser.close();process.exitCode=1;});

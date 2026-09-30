/* Focused portrait QA against actual ui-kit and Studio modules. A fresh browser
 * uses localhost-only test responses. Prepared Studio runs the shipping default;
 * only the legacy Studio case explicitly injects its earlier catalog.
 * Usage: PLAYWRIGHT_PATH=... QA_CHROMIUM=... QA_PORT=8531
 *        node tools/qa-breed-portraits.cjs
 */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),QA=require('./qa-platform.cjs');
const root=path.resolve(__dirname,'..'),out=path.join(root,'output/breed-portrait-qa');
const catalogs={legacy:'assets/models/artist-breeds/manifest.json',prepared:'assets/models/horse-imports/prepared-manifest.json'};
const read=rel=>JSON.parse(fs.readFileSync(path.join(root,rel),'utf8'));
const hash=rel=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,rel))).digest('hex');
const files=['assets/breed-portraits.js','assets/features/ui-kit.js','assets/breed-models.js','breeds.html',...Object.values(catalogs),'assets/models/horse-imports/thumbnails/render-validation.json'];
const hashes=()=>Object.fromEntries(files.map(f=>[f,hash(f)]));
const manifests=Object.fromEntries(Object.entries(catalogs).map(([k,v])=>[k,read(v)]));
const availableCount=Object.values(manifests.prepared.breeds).filter(r=>r.available).length,pendingCount=Object.values(manifests.prepared.breeds).filter(r=>!r.available).length;
const thumbReport=read('assets/models/horse-imports/thumbnails/render-validation.json');
const records=new Map(thumbReport.records.map(r=>[r.key,r]));
const mapping=read('assets/models/horse-imports/replacement-plan.json').identityMapping;
const rows=mapping.map(m=>[m.id,m.name,'Common',0,0,'#ffffff','#ffffff',{body:m.currentFoundation}]);
rows.push(['qa-body-probe','QA body fallback','Common',0,0,'#ffffff','#ffffff',{body:'bay'}]);
const unknown=['qa-missing-portrait','qa-body-probe'];
const legacyExpected={aether:'aether',unicorn:'unicorn',thoroughbred:'thoro',clydesdale:'clyde','quarter-horse':'stock',hero:'bay-sporthorse',petalmane:'bay','qa-body-probe':'bay','qa-missing-portrait':null};
let browser;

function harness(catalog){
 const keys=catalog==='prepared'?[...Object.keys(manifests.prepared.breeds),...unknown]:Object.keys(legacyExpected);
 return `<!doctype html><html><head><meta charset="utf-8"><title>Isolated portrait QA</title><style>#portraits{display:flex;flex-wrap:wrap;gap:5px} .mk-thumb-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}</style></head><body><div id="portraits"></div><script type="module">
 import {install} from '/assets/features/ui-kit.js?portrait-qa';
 let release,loaded=false;const manifestReady=new Promise((resolve,reject)=>{release=()=>fetch('/${catalogs[catalog]}',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Catalog HTTP '+r.status);return r.json();}).then(m=>{loaded=true;resolve(m);return m;}).catch(reject);});
 const G={horse:{breedModels:{manifestReady}},tables:{BREEDS3:${JSON.stringify(rows)}},save:{fresh:()=>({horses:[]})},ui:{panels:[]},on(){}};
 install(G);const keys=${JSON.stringify(keys)};document.getElementById('portraits').innerHTML=keys.map(k=>G.ui.k.thumb(k,{size:40,rarity:'Mythic'})).join('');
 const originals=[...document.querySelectorAll('[data-mkbreed]')];
 const snapshot=()=>originals.map(span=>{const img=span.querySelector('img');return {key:span.dataset.mkbreed,connected:span.isConnected,url:img?.getAttribute('src')||null,complete:!!img&&img.complete&&img.naturalWidth>0,width:img?.naturalWidth||0,images:span.querySelectorAll('img').length};});
 window.__portraitQA={release,snapshot,ready:false,loaded:()=>loaded,repeated:k=>{const d=document.createElement('div');d.innerHTML=G.ui.k.thumb(k);return d.querySelector('img')?.getAttribute('src')||null;}};
 window.__portraitQA.ready=true;
 </script></body></html>`;
}

async function pageFor(context){
 const page=await context.newPage(),evidence={errors:[],external:[],missing:[],requests:[]};
 page.on('pageerror',e=>evidence.errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')evidence.errors.push(m.text());});
 page.on('request',r=>{evidence.requests.push(r.url());const u=new URL(r.url());if(!['blob:','data:'].includes(u.protocol)&&u.origin!==new URL(QA.BASE).origin)evidence.external.push(u.href);});
 page.on('response',r=>{if(r.status()>=400)evidence.missing.push({url:r.url(),status:r.status()});});
 return {page,evidence};
}

async function loadImages(page,selector){
 return page.evaluate(async selector=>{
  const imgs=[...document.querySelectorAll(selector)].filter(i=>i.getAttribute('src'));
  return Promise.all(imgs.map(img=>{img.loading='eager';return new Promise(resolve=>{
   let done=false;const finish=ok=>{if(done)return;done=true;clearTimeout(timer);resolve({url:img.getAttribute('src'),ok,width:img.naturalWidth});};
   const timer=setTimeout(()=>finish(false),20000);
   if(img.complete){finish(img.naturalWidth>0);return;}
   img.addEventListener('load',()=>finish(img.naturalWidth>0),{once:true});img.addEventListener('error',()=>finish(false),{once:true});
  });}));
 },selector);
}

function preparedURL(key,url){
 const r=records.get(key),spec=manifests.prepared.breeds[key];
 if(!r||!spec?.available||!url)return false;
 const u=new URL(url,QA.BASE+'/');
 return u.pathname==='/assets/models/horse-imports/thumbnails/'+r.file&&r.modelSha256===spec.sha256&&u.searchParams.get('build')===r.sha256;
}

function legacyURL(key,url){
 const expected=legacyExpected[key];if(!expected)return !url;
 return !!url&&new URL(url,QA.BASE+'/').pathname==='/assets/breed-thumbnails/'+expected+'.webp';
}

async function uiKitCase(context,catalog){
 const {page,evidence}=await pageFor(context);
 await page.route('**/__qa-breed-portraits.html*',r=>r.fulfill({contentType:'text/html',body:harness(catalog)}));
 await page.goto(QA.BASE+'/__qa-breed-portraits.html?catalog='+catalog,{waitUntil:'load',timeout:60000});
 await page.waitForFunction(()=>window.__portraitQA?.ready);
 const initial=await page.evaluate(()=>__portraitQA.snapshot());
 const promiseGated=await page.evaluate(()=>!__portraitQA.loaded());
 await page.evaluate(()=>__portraitQA.release());
 await page.waitForFunction(([c,n])=>{const s=__portraitQA.snapshot();return c==='prepared'?s.filter(x=>x.url).length===n:s.filter(x=>x.url).length>=8;},[catalog,availableCount],{timeout:30000});
 const images=await loadImages(page,'#portraits img');
 const final=await page.evaluate(()=>__portraitQA.snapshot());
 const repeated=await page.evaluate(keys=>Object.fromEntries(keys.map(k=>[k,__portraitQA.repeated(k)])),final.map(s=>s.key));
 const available=final.filter(s=>manifests.prepared.breeds[s.key]?.available),pending=final.filter(s=>manifests.prepared.breeds[s.key]?.available===false),unmapped=final.filter(s=>unknown.includes(s.key));
 const checks={actualUiKitInstalled:true,asynchronousCatalogGated:promiseGated,existingSpansRefreshedInPlace:final.length===initial.length&&final.every(s=>s.connected&&s.images<=1),allPresentImagesLoaded:images.length>0&&images.every(i=>i.ok),repeatThumbMatchesExistingSpans:final.every(s=>repeated[s.key]===s.url),noMissingImages:evidence.missing.length===0,noPageErrors:evidence.errors.length===0,noExternalRequests:evidence.external.length===0};
 if(catalog==='prepared')Object.assign(checks,{noPrematureSubstitute:initial.every(s=>!s.url),allAvailableExactModelAndImageHashes:available.length===availableCount&&available.every(s=>preparedURL(s.key,s.url)),allPendingWithoutSubstitutes:pending.length===pendingCount&&pending.every(s=>!s.url),unknownBodyAliasWithoutSubstitute:unmapped.length===unknown.length&&unmapped.every(s=>!s.url)});
 else Object.assign(checks,{explicitLegacyLongformAndBodyFallbackRetained:final.every(s=>legacyURL(s.key,s.url)),unknownWithoutImage:final.find(s=>s.key==='qa-missing-portrait')?.url===null});
 await page.screenshot({path:path.join(out,'ui-kit-'+catalog+'.png')});await page.close();return {catalog,checks,initial,final,images,...evidence};
}

async function studioCase(context,catalog){
 const {page,evidence}=await pageFor(context);
 if(catalog==='legacy')await page.route('**/breeds.html*',route=>{
  const html=fs.readFileSync(path.join(root,'breeds.html'),'utf8'),call='createBreedLibrary({THREE,GLTFLoader,clone})';assert.ok(html.includes(call),'Expected shipping catalog call');
  return route.fulfill({contentType:'text/html',body:html.replace(call,"createBreedLibrary({THREE,GLTFLoader,clone,manifestURL:new URL('./assets/models/artist-breeds/manifest.json',location.href)})")});
 });
 await page.goto(QA.BASE+'/breeds.html?horse=bay-sporthorse',{waitUntil:'load',timeout:120000});
 await page.waitForFunction(()=>window.render_game_to_text&&JSON.parse(render_game_to_text()).modelReady&&!JSON.parse(render_game_to_text()).loading,null,{timeout:120000});
 await page.waitForFunction(([c,n])=>c==='prepared'?[...document.querySelectorAll('#list .breed-thumb')].filter(i=>i.getAttribute('src')).length===n:[...document.querySelectorAll('#list .breed-thumb')].some(i=>i.getAttribute('src')),[catalog,availableCount],{timeout:30000});
 const images=await loadImages(page,'#list .breed-thumb');
 const sidebar=await page.evaluate(()=>[...document.querySelectorAll('#list button')].map(b=>{const i=b.querySelector('.breed-thumb');return {key:b.dataset.key,disabled:b.disabled,url:i?.getAttribute('src')||null,hidden:!!i?.hidden,width:i?.naturalWidth||0};}));
 const state=await page.evaluate(()=>JSON.parse(render_game_to_text())),manifest=manifests[catalog],pending=Object.keys(manifest.breeds).filter(k=>manifest.breeds[k].available===false).sort();
 const checks={actualStudioSidebar:true,modelReady:state.modelReady&&state.breed==='bay-sporthorse',sidebarIncludesExactCatalog:sidebar.length===Object.keys(manifest.breeds).length&&sidebar.every(s=>manifest.breeds[s.key]),pendingRowsPreserved:JSON.stringify(sidebar.filter(s=>s.disabled).map(s=>s.key).sort())===JSON.stringify(pending),allPresentImagesLoaded:images.length>0&&images.every(i=>i.ok),noMissingAssets:evidence.missing.length===0,noPageErrors:evidence.errors.length===0,noExternalRequests:evidence.external.length===0};
 const requestedCatalogs=evidence.requests.filter(url=>Object.values(catalogs).some(file=>new URL(url).pathname==='/'+file));
 if(catalog==='prepared')Object.assign(checks,{shippingPreparedDefaultRequested:requestedCatalogs.some(url=>new URL(url).pathname==='/'+catalogs.prepared)&&!requestedCatalogs.some(url=>new URL(url).pathname==='/'+catalogs.legacy),allAvailableExactPreparedPortraits:sidebar.filter(s=>!s.disabled).length===availableCount&&sidebar.filter(s=>!s.disabled).every(s=>!s.hidden&&preparedURL(s.key,s.url)),allPendingPortraitsAbsent:sidebar.filter(s=>s.disabled).every(s=>s.hidden&&!s.url)});
 else Object.assign(checks,{explicitLegacyCatalogRequested:requestedCatalogs.some(url=>new URL(url).pathname==='/'+catalogs.legacy)&&!requestedCatalogs.some(url=>new URL(url).pathname==='/'+catalogs.prepared),explicitLegacyExactPortraitsRetained:sidebar.every(s=>s.url&&new URL(s.url,QA.BASE+'/').pathname==='/assets/breed-thumbnails/'+s.key+'.webp')});
 await page.screenshot({path:path.join(out,'studio-'+catalog+'.png')});await page.close();return {catalog,checks,state,sidebar,images,...evidence};
}

(async()=>{
 const local=new URL(QA.BASE);assert.equal(local.protocol,'http:');assert.equal(local.hostname,'127.0.0.1','Use a fresh isolated localhost server');
 fs.mkdirSync(out,{recursive:true});const before=hashes(),blocked=[];
 browser=await QA.chromium.launch({headless:true,executablePath:process.env.QA_CHROMIUM||undefined,args:QA.gpuArgs()});
 const context=await browser.newContext({viewport:{width:1440,height:1000}});
 await context.route('**/*',route=>{const u=new URL(route.request().url());if(['blob:','data:'].includes(u.protocol)||u.origin===local.origin)return route.continue();blocked.push(u.href);return route.abort();});
 const kit=[],studio=[];for(const catalog of ['legacy','prepared'])kit.push(await uiKitCase(context,catalog));for(const catalog of ['legacy','prepared'])studio.push(await studioCase(context,catalog));
 const after=hashes(),checks={fourFocusedActualUiCases:kit.length===2&&studio.length===2,allCaseChecksPass:[...kit,...studio].every(s=>Object.values(s.checks).every(Boolean)),localhostOnly:blocked.length===0,shippingDefaultsAndInputsUnmodified:JSON.stringify(before)===JSON.stringify(after)};
 const report={schemaVersion:2,scope:'Two actual ui-kit installations with delayed legacy/prepared manifest promises, one explicit legacy Studio sidebar and the unmodified shipping prepared Studio sidebar; only each Studio default model is loaded.',freshIsolatedProfile:true,legacyCatalogInjectedOnly:true,preparedCatalogInjected:false,defaultCatalogActivated:true,checks,before,after,kit,studio,blockedExternalRequests:blocked,passed:Object.values(checks).every(Boolean)};
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({checks,kit:kit.map(s=>({catalog:s.catalog,checks:s.checks})),studio:studio.map(s=>({catalog:s.catalog,checks:s.checks})),report:'output/breed-portrait-qa/report.json'},null,2));await browser.close();if(!report.passed)process.exitCode=1;
})().catch(async e=>{console.error(e);if(browser)await browser.close();process.exitCode=1;});

/* Finite deployment cache regression. Runs the saved service worker in a VM;
 * no browser, network, catalog activation, or asset modification is involved. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),out=path.join(root,'output/imported-cache-qa');
const origin='https://meadowlark-cache.test',source=fs.readFileSync(path.join(root,'sw.js'),'utf8');
const sourceSha256=crypto.createHash('sha256').update(source).digest('hex');
const shaA='a'.repeat(64),shaB='b'.repeat(64),samples=[],checks={};

function harness(){
 const stores=new Map(),listeners=new Map(),network=[];let offline=false;
 function cacheFor(name){
  if(!stores.has(name))stores.set(name,new Map());
  const store=stores.get(name);
  return {async put(request,response){store.set(request.url,response.clone());},async match(request,options={}){
   const url=typeof request==='string'?new URL(request,origin).href:request.url;
   if(!options.ignoreSearch)return store.get(url)?.clone();
   const key=new URL(url);key.search='';
   for(const [stored,response]of store){const candidate=new URL(stored);candidate.search='';if(candidate.href===key.href)return response.clone();}
  }};
 }
 const caches={async open(name){return cacheFor(name);},async keys(){return [...stores.keys()];},async delete(name){return stores.delete(name);},async match(request,options){
  for(const name of stores.keys()){const response=await cacheFor(name).match(request,options);if(response)return response;}
 }};
 const self={location:{origin},addEventListener(type,handler){listeners.set(type,handler);},skipWaiting(){},clients:{async claim(){}}};
 async function fetch(request){
  network.push({url:request.url,cache:request.cache,method:request.method});
  if(offline)throw new TypeError('Simulated offline');
  const response=new Response('network:'+request.url,{status:200,headers:{'Content-Type':'application/octet-stream'}});
  // Node-created Responses report "default". Real same-origin network responses
  // have "basic" type; retain native body/clone behavior and model that metadata.
  Object.defineProperty(response,'type',{value:'basic'});return response;
 }
 const context=vm.createContext({self,caches,fetch,URL,Request,Response});
 vm.runInContext(source,context,{filename:'sw.js',timeout:1000});
 return {stores,network,get cacheName(){return vm.runInContext('CACHE',context);},setOffline(value){offline=value;},
  async seed(url,body,name){await cacheFor(name||this.cacheName).put(new Request(url),new Response(body));},
  async dispatch(url,options={}){
   let promise,intercepted=false;listeners.get('fetch')({request:new Request(url,options),respondWith(value){intercepted=true;promise=Promise.resolve(value);}});
   if(!intercepted)return {intercepted:false};
   try{const response=await promise;await new Promise(resolve=>setImmediate(resolve));return {intercepted:true,body:await response.text(),status:response.status};}
   catch(error){await new Promise(resolve=>setImmediate(resolve));return {intercepted:true,rejected:true,error:String(error)};}
  },async activate(){let pending;listeners.get('activate')({waitUntil(value){pending=value;}});await pending;}
 };
}

async function run(){
 const h=harness();checks.cacheRevisionIsV4=h.cacheName==='meadowlark-v4';
 for(const extension of ['glb','mkr','webp']){
  const prefix=origin+'/assets/models/horse-imports/cache-test.'+extension,oldURL=prefix+'?build='+shaA,newURL=prefix+'?build='+shaB;
  await h.seed(oldURL,'old-'+extension);h.setOffline(true);
  const different=await h.dispatch(newURL);
  checks[extension+'DifferentRevisionNeverFallsBack']=different.rejected===true;
  samples.push({case:extension+' different revision offline',oldURL,newURL,result:different});
  await h.seed(newURL,'same-'+extension);
  const exact=await h.dispatch(newURL);checks[extension+'ExactRevisionLoadsOffline']=exact.body==='same-'+extension&&!exact.rejected;
  samples.push({case:extension+' exact revision offline',url:newURL,result:exact});
 }
 await h.seed(origin+'/breeds.html','offline-studio');
 const page=await h.dispatch(origin+'/breeds.html');checks.ordinaryOfflinePageLoads=page.body==='offline-studio';samples.push({case:'offline page',result:page});
 h.setOffline(false);
 for(const name of ['prepared-manifest.json','thumbnails/index.json','thumbnails/render-validation.json','candidates/example/game/profile.json']){
  const url=origin+'/assets/models/horse-imports/'+name+'?build='+shaB;
  const start=h.network.length,result=await h.dispatch(url,{cache:'force-cache'}),request=h.network[start];
  checks['jsonNoCache:'+name]=request?.url===url&&request.cache==='no-cache'&&result.status===200;
  samples.push({case:'JSON revalidation',request,result});
 }
 for(const extension of ['glb','mkr','webp']){
  const url=origin+'/assets/models/horse-imports/network-success.'+extension+'?build='+shaB;
  const result=await h.dispatch(url),store=h.stores.get(h.cacheName);
  checks[extension+'NetworkSuccessCachedExactURL']=result.body==='network:'+url&&store.has(url)&&!store.has(url.split('?')[0]);
  h.setOffline(true);const offline=await h.dispatch(url);h.setOffline(false);
  checks[extension+'NetworkCacheLoadsOffline']=offline.body==='network:'+url;
  samples.push({case:extension+' network then offline',url,network:result,offline});
 }
 const external=await h.dispatch('https://unrelated-cache.test/asset.glb'),post=await h.dispatch(origin+'/save',{method:'POST'});
 checks.crossOriginAndMutationsUnintercepted=!external.intercepted&&!post.intercepted;
 await h.seed(origin+'/legacy.glb','legacy','meadowlark-v3');await h.seed(origin+'/old.glb','old','meadowlark-v2');
 await h.activate();checks.activationPurgesOlderCaches=JSON.stringify([...h.stores.keys()])===JSON.stringify(['meadowlark-v4']);
 checks.savedWorkerUnmodified=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'sw.js'))).digest('hex')===sourceSha256;
 const report={scope:'Actual saved service-worker handlers in Node VM; native Request/Response bodies and clones, finite browser Cache/fetch substitutes. No real network/browser/model QA.',worker:'sw.js',sourceSha256,cacheName:h.cacheName,checks,allChecksPass:Object.values(checks).every(Boolean),samples,networkRequests:h.network,remainingCaches:[...h.stores.keys()],defaultCatalogActivated:false};
 fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({sourceSha256,cacheName:h.cacheName,checks,allChecksPass:report.allChecksPass}));
 if(!report.allChecksPass)process.exitCode=1;
}
run().catch(error=>{console.error(error);process.exitCode=1;});

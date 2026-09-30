/* Render actual prepared Studio models. This never activates a partial roster or
 * uses a signed-in browser/profile. Missing approved sources get no substitute. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const QA=require('./qa-platform.cjs');
const root=path.resolve(__dirname,'..'),base=path.join(root,'assets/models/horse-imports');
const manifestPath=path.join(base,'prepared-manifest.json');
const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
const favoriteKey='white-western';
const thumbnailCatalog=structuredClone(manifest);
thumbnailCatalog.breeds[favoriteKey]={...manifest.preferredWhiteWestern,sourceCandidate:'wildmesh-white-western'};
const keys=process.env.HORSE_THUMB_KEYS?.split(',')||[
 ...Object.entries(manifest.breeds).filter(([,row])=>row.available).map(([key])=>key),favoriteKey
];
const out=path.join(base,'thumbnails');
const hash=data=>crypto.createHash('sha256').update(data).digest('hex');
const injection=String.raw`
window.__renderImportedThumbnail=async key=>{
 await select(key);
 if(loading||selectedKey!==key||!horse)throw Error('Requested thumbnail model did not load: '+key);
 paused=true;controls.autoRotate=false;controls.resetMotion();
 motion.set('stand');accessories.prepare();motion.update(0);accessories.update(0);
 if(key==='white-western')configureSourceTack(THREE,instance,{enabled:true,style:'western'});
 ring.visible=false;scene.fog=null;renderer.setPixelRatio(1);renderer.setSize(640,480);
 camera.aspect=640/480;camera.updateProjectionMatrix();framing=Math.max(1,1.18/camera.aspect);
 headView=false;
 const bounds=breedStudioInspect().bounds;
 controls.target.fromArray(bounds.min).add(new THREE.Vector3().fromArray(bounds.max)).multiplyScalar(.5);
 const direction=new THREE.Vector3(-.72,.13,.69).normalize();
 const right=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),direction).normalize();
 const up=new THREE.Vector3().crossVectors(direction,right),point=new THREE.Vector3();
 const tanV=Math.tan(THREE.MathUtils.degToRad(camera.fov*.5));let distance=1.4;
 horse.updateMatrixWorld(true);
 horse.traverse(mesh=>{if(!mesh.isMesh||!mesh.visible)return;const positions=mesh.geometry.attributes.position;
  for(let i=0;i<positions.count;i++){mesh.getVertexPosition(i,point);point.applyMatrix4(mesh.matrixWorld).sub(controls.target);
   const depth=point.dot(direction);distance=Math.max(distance,depth+Math.abs(point.dot(right))/(tanV*camera.aspect*.88),depth+Math.abs(point.dot(up))/(tanV*.86));}
 });
 controls.minDistance=.1;controls.maxDistance=distance*2;
 camera.position.copy(controls.target).addScaledVector(direction,distance*1.025);
 camera.lookAt(controls.target);draw();
 const geometry=breedStudioInspect(),state=JSON.parse(render_game_to_text());
 const blob=await new Promise(resolve=>renderer.domElement.toBlob(resolve,'image/webp',.92));
 if(!blob||blob.type!=='image/webp')throw Error('WebP rendering unavailable');
 return{geometry,state,bytes:Array.from(new Uint8Array(await blob.arrayBuffer()))};
};`;
let browser;
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 browser=await QA.chromium.launch({headless:true,executablePath:process.env.QA_CHROMIUM||undefined,args:QA.gpuArgs()});
 const page=await browser.newPage({viewport:{width:640,height:480},deviceScaleFactor:1});
 const errors=[],blocked=[],records=[];
 page.on('pageerror',error=>errors.push(error.message));
 page.on('console',message=>{if(message.type()==='error'&&!message.text().includes('net::ERR_FAILED'))errors.push(message.text());});
 await page.route('**/*',route=>{
  const url=new URL(route.request().url());
  if(['data:','blob:'].includes(url.protocol)||url.hostname==='127.0.0.1')return route.continue();
  blocked.push(url.origin+url.pathname);return route.abort();
 });
 await page.route('**/prepared-manifest.json*',route=>route.fulfill({contentType:'application/json',body:JSON.stringify(thumbnailCatalog)}));
 await page.route('**/breeds.html*',route=>{
  let html=fs.readFileSync(path.join(root,'breeds.html'),'utf8');
  html=html.replace('createBreedLibrary({THREE,GLTFLoader,clone})',"createBreedLibrary({THREE,GLTFLoader,clone,manifestURL:new URL('./assets/models/horse-imports/prepared-manifest.json',location.href)})");
  html=html.replace('</head>','<style>main{display:block}aside,.caption,.controls,.hint,#status{display:none!important}#stage{width:640px;height:480px}</style></head>');
  html=html.replace('</script></body>',injection+'\n</script></body>');
  return route.fulfill({contentType:'text/html',body:html});
 });
 await page.goto(QA.BASE+'/breeds.html?horse=bay',{waitUntil:'load',timeout:120000});
 await page.waitForFunction(()=>window.__renderImportedThumbnail&&JSON.parse(render_game_to_text()).modelReady&&!JSON.parse(render_game_to_text()).loading,null,{timeout:120000});
 for(const key of keys){
  const profile=thumbnailCatalog.breeds[key];
  if(!profile?.available)throw Error('Approved source unavailable: '+key);
  const rendered=await page.evaluate(key=>window.__renderImportedThumbnail(key),key);
  const projected=rendered.geometry.projected;
  if(rendered.state.asset.sha256!==profile.sha256||!rendered.geometry.finite||projected.left<-1.01||projected.right>1.01||projected.top>1.01||projected.bottom<-1.01)throw Error('Incorrect source or cropped model: '+key);
  const data=Buffer.from(rendered.bytes);
  fs.writeFileSync(path.join(out,key+'.webp'),data);
  records.push({key,file:key+'.webp',width:640,height:480,bytes:data.length,sha256:hash(data),modelSha256:profile.sha256,sourceCandidate:profile.sourceCandidate,sourceUrl:profile.sourceUrl,creator:profile.creator||profile.sourceAuthor,license:profile.license,projectedBounds:projected});
  console.log(JSON.stringify({key,bytes:data.length}));
 }
 if(errors.length||blocked.length)throw Error('Renderer produced page errors or external requests: '+JSON.stringify({errors,blocked}));
 const expectedKeys=[...Object.entries(manifest.breeds).filter(([,row])=>row.available).map(([key])=>key),favoriteKey];
 const complete=keys.length===expectedKeys.length&&new Set(keys).size===keys.length&&expectedKeys.every(key=>keys.includes(key));
 const runtimeSourceSha256=Object.fromEntries(['breeds.html','assets/breed-models.js','assets/equine-fantasy.js','assets/features/horse-roster.js','assets/features/new-breeds.js','assets/feather-wing-material.js','assets/game-hero-horse.js','assets/artist-horse-motion.js','assets/dragon-horse-motion.js','assets/feather-wing-motion.js','assets/hero-horse-coat.js','assets/artist-horse-features.js','assets/protected-horse-resource.js','assets/fjord-horse-motion.js'].map(file=>[file,hash(fs.readFileSync(path.join(root,file)))]));
 const report={schemaVersion:1,scope:'Ordinary Three.js renders of prepared source models, with authored game adaptation materials. No generative image tools.',preparedManifestSha256:hash(fs.readFileSync(manifestPath)),runtimeSourceSha256,pose:'Standing idle; native folded wings and source western tack on the preferred white horse.',siteActivated:false,completeAvailableCatalog:complete,availableIdentityCount:manifest.availableIdentityCount,pendingIdentities:manifest.pendingIdentities,preferredWhiteWesternIncluded:keys.includes(favoriteKey),errors,blockedExternalRequests:blocked,records,visualReview:'Rendered files require visual inspection; geometric framing and exact model hashes passed.'};
 fs.writeFileSync(path.join(out,'render-validation.json'),JSON.stringify(report,null,2)+'\n');
 fs.writeFileSync(path.join(out,'index.json'),JSON.stringify(keys,null,2)+'\n');
 await browser.close();
 console.log(JSON.stringify({rendered:records.length,completeAvailableCatalog:complete}));
})().catch(async error=>{console.error(error);if(browser)await browser.close();process.exitCode=1;});

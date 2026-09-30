/* Fresh, isolated localhost-only verification. Inject the review catalog through
 * a served response; never activate an incomplete catalog in the real site. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),QA=require('./qa-platform.cjs');
const root=path.resolve(__dirname,'..'),label=(process.env.SITE_QA_LABEL||'').replace(/[^a-z0-9-]/g,''),out=path.join(root,'output','imported-site'+(label?'-'+label:'')+'-qa');fs.mkdirSync(out,{recursive:true});
const catalog=JSON.parse(fs.readFileSync(process.env.HORSE_QA_MANIFEST||path.join(root,'assets/models/horse-imports/prepared-manifest.json')));
const keys=process.env.HORSE_QA_KEYS==='available'
 ?Object.entries(catalog.breeds).filter(([,row])=>row.available).map(([key])=>key)
 :process.env.HORSE_QA_KEYS?.split(',')||['bay','shire','suffolk','unicorn','pegasus','alicorn','emberdrake','lumen'];
const injection=String.raw`
window.__importedSiteQA={
 async switch(key,style='english'){
  const row=BREEDS3.find(b=>b[0]===key);if(!row)throw Error('Missing game identity '+key);
  const h=myHorses[rideIdx];Object.assign(h,{breed:key,colors:{body:row[5],mane:row[6]},horn:!!row[7].horn,wings:!!row[7].wings,dragon:!!row[7].dragon,coat:row[7].coat||null,saddleStyle:style,bareback:false,mark:undefined,mark2:null});
  player.flying=false;player.y=0;player.vy=0;rebuildAll();await requestPlayerBreed(key);advanceTime(120);return this.state();
 },
 state(){const bootContacts=[];if(TACK.saddle?.visible&&player.rider?.rig){const body=player.rider.mesh;body.skeleton.update();for(const S of ['L','R']){const contact=player.rider.sk.by['foot'+S].userData.soleContact,tread=TACK.saddle.userData.stir?.[S];if(!contact||!tread)continue;const sole=new THREE.Vector3();for(const i of contact.vertices){const p=body.getVertexPosition(i,new THREE.Vector3());body.localToWorld(p);sole.add(p);}sole.multiplyScalar(1/contact.vertices.length);const target=tread.getWorldPosition(new THREE.Vector3());bootContacts.push({side:S,errorM:sole.distanceTo(target),verticalM:sole.y-target.y,samples:contact.samples});}}return{key:RIG.modelKey,requested:RIG.requestedBreed,loading:RIG.loadingBreed,ready:RIG.ready,bones:RIG.bones.length,physicalScale:player.mesh.scale.x,innerScale:RIG.scene.scale.x,assetSha256:RIG.profile.sha256,source:RIG.profile.sourceCandidate,nativeTack:!!RIG.nativeTack?.enabled,sourceTackVisibility:RIG.scene.children.filter(o=>RIG.profile.sourceTackMeshes?.includes(o.name)).map(o=>({name:o.name,visible:o.visible})),wingComponents:RIG.wingMotions?.length||0,finite:RIG.bones.every(b=>b.matrixWorld.elements.every(Number.isFinite)),bootContacts,seat:riderSeat(),motion:RIG.heroMotion.snapshot()};},
 pose(gait,lead='left',seconds=1.2,flight=false){
  const r=RIG;r.heroMotion.reset();r.heroMotion.set(gait,{lead});r.heroJumpAge=null;
  player.flying=flight;player.y=flight?3:0;player.mesh.position.set(0,player.y,0);player.mesh.rotation.set(0,0,0);player.speed=r.heroMotion.gaits[gait]?.speed||0;
  Object.assign(player.rider,{_air:0,_post:0,_patRun:0,_patT:99});
  for(let i=0;i<Math.ceil(seconds*120);i++){const input={flying:flight,altitude:flight?3:0,verticalSpeed:0,speedMps:flight?6:player.speed};r.heroMotion.setFlight?.(input);r.heroMotion.update(1/120);r.phase=r.heroMotion.state.phase01;r.heroJumpAge=gait==='jump'?i/120:null;for(const wing of r.wingMotions||[]){wing.follow();wing.motion.setFlight(input);wing.motion.update(1/120);}TACK.saddle.position.copy(breedSeat());trackHead();driveRider(player.speed,i/120,1/120);}
  this.render();return this.state();
 },
 render(){
  scene.children.forEach(o=>o.visible=o.isLight||o===player.mesh||o===this.floor);
  if(!this.floor){this.floor=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshStandardMaterial({color:0x777e78,roughness:.9}));this.floor.rotation.x=-Math.PI/2;this.floor.receiveShadow=true;scene.add(this.floor);}
  this.floor.visible=true;scene.background=new THREE.Color(0xcbd2cc);scene.fog.density=0;dayT=.34;player.mesh.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(RIG.scene),size=box.getSize(new THREE.Vector3()),distance=Math.max(4.8,size.x*.65);camera.position.set(distance,player.y+distance*.52,distance);camera.lookAt(0,player.y+1.6,0);renderer.info.reset();composer.render();
 },
 customCoat(){const h=myHorses[rideIdx];configureArtistCustomization(RIG,{...h,mark:'star'});this.render();return{key:RIG.modelKey,protectedResource:!!RIG.profile.protectedResource,embeddedNeutralLoaded:!!RIG.neutralCoatMap,actualBodyMapIsEmbeddedNeutral:RIG.skin.material.map===RIG.neutralCoatMap};},
 bareback(){myHorses[rideIdx].bareback=true;dressSaddle();trackHead();this.render();return this.state();},
 cloneCheck(){const asset=BREED_MODELS.get(RIG.modelKey),a=BREED_MODELS.instantiate(asset),b=BREED_MODELS.instantiate(asset);const initial=b.bones[5].quaternion.clone();a.bones[5].rotation.x+=.4;const independent=a.bones[5]!==b.bones[5]&&b.bones[5].quaternion.equals(initial)&&a.skin.material!==b.skin.material&&a.skin.geometry===b.skin.geometry;const wingsIndependent=!a.components.length||a.components[0].scene!==b.components[0].scene;disposeMountedRig(a);disposeMountedRig(b);return{independent,wingsIndependent};}
};
const MERGE_STATS=mergeStatics();`;
let browser;
(async()=>{
 browser=await QA.chromium.launch({headless:true,executablePath:process.env.QA_CHROMIUM||undefined,args:QA.gpuArgs()});const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[],warnings=[],blocked=[],modelRequests=[];
 page.on('request',r=>{const u=new URL(r.url());if(u.pathname.includes('/horse-imports/'))modelRequests.push(u.pathname);});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('net::ERR_FAILED'))errors.push(m.text());if(m.type()==='warning'){warnings.push(m.text());console.log('Warning: '+m.text());}});
 await page.route('**/*',route=>{const u=new URL(route.request().url());if(['blob:','data:'].includes(u.protocol)||u.hostname==='127.0.0.1')return route.continue();blocked.push(u.origin+u.pathname);return route.abort();});
 if(process.env.HORSE_QA_MANIFEST)await page.route('**/prepared-manifest.json*',route=>route.fulfill({contentType:'application/json',body:JSON.stringify(catalog)}));
 await page.route('**/ranch3d.html*',route=>{let html=fs.readFileSync(path.join(root,'ranch3d.html'),'utf8');if(process.env.QA_SHIPPING_DEFAULT!=='true')html=html.replace('createBreedLibrary({THREE,GLTFLoader,clone:skeletonClone})',"createBreedLibrary({THREE,GLTFLoader,clone:skeletonClone,manifestURL:new URL('./assets/models/horse-imports/prepared-manifest.json',location.href)})");html=html.replace('const MERGE_STATS=mergeStatics();',injection);return route.fulfill({contentType:'text/html',body:html});});
 await page.goto(QA.BASE+'/ranch3d.html?qa=imported',{waitUntil:'load',timeout:120000});
 await page.waitForFunction(()=>window.__importedSiteQA&&window.__features?.horse.RIG().ready&&!__features.horse.RIG().loadingBreed,null,{timeout:120000});
 await page.evaluate(()=>advanceTime(0));await page.waitForFunction(()=>__features.horse.player.rider?.mesh,null,{timeout:60000});
 const samples=[];
 for(const key of keys){
  await page.evaluate(k=>__importedSiteQA.switch(k),key);
  for(const gait of ['stand','walk','gallop','jump']){const s=await page.evaluate(g=>__importedSiteQA.pose(g,'left',g==='jump'?.82:1.2),gait);samples.push({key,gait,state:s});if(gait==='stand'||gait==='jump')await page.screenshot({path:path.join(out,key+'-'+gait+'.png')});}
  if(['pegasus','alicorn','emberdrake'].includes(key)){const s=await page.evaluate(()=>__importedSiteQA.pose('stand','left',1.2,true));samples.push({key,gait:'flight',state:s});await page.screenshot({path:path.join(out,key+'-flight.png')});}
  if(['bay','lipiz','camargue'].includes(key)){await page.evaluate(k=>__importedSiteQA.switch(k,'western'),key);const s=await page.evaluate(()=>__importedSiteQA.pose('walk'));samples.push({key,gait:'western',state:s});await page.screenshot({path:path.join(out,key+'-western.png')});samples.push({key,gait:'bareback',state:await page.evaluate(()=>__importedSiteQA.bareback())});}
  if(['fjord-sculpt','pastel-unicorn'].includes(catalog.breeds[key].sourceCandidate)){const custom=await page.evaluate(()=>__importedSiteQA.customCoat());samples.push({key,gait:'protected-custom-coat',custom});await page.screenshot({path:path.join(out,key+'-custom-coat.png')});}
  samples.push({key,gait:'clone-isolation',...await page.evaluate(()=>__importedSiteQA.cloneCheck())});console.log(JSON.stringify({key,done:true}));
 }
 const poses=samples.filter(s=>s.state),checks={noErrors:errors.length===0,requestedIdentitiesLoaded:poses.every(s=>s.state.key===s.key&&!s.state.loading),finite:poses.every(s=>s.state.finite),measuredPhysicalScale:poses.every(s=>s.state.physicalScale===1&&s.state.innerScale===1),nativeWingsOnWingedHorses:poses.filter(s=>['pegasus','alicorn'].includes(s.key)).every(s=>s.state.wingComponents===1),privateSkeletonsAndMaterials:samples.filter(s=>s.gait==='clone-isolation').every(s=>s.independent&&s.wingsIndependent),bootSolesWithin8mmOfTread:poses.filter(s=>s.gait!=='bareback').every(s=>s.state.bootContacts.length===2&&s.state.bootContacts.every(c=>c.errorM<=.008)),sourceWesternTack:poses.filter(s=>s.gait==='western').every(s=>s.state.nativeTack===true),barebackHidesSourceGear:poses.filter(s=>s.gait==='bareback').every(s=>s.state.nativeTack===false)};
 const protectedSamples=samples.filter(s=>s.gait==='protected-custom-coat'),plainProtectedRequests=modelRequests.filter(u=>/\/(fjord-sculpt|pastel-unicorn)\/game\//.test(u)&&!u.endsWith('.mkr'));
 checks.embeddedProtectedNeutralCoats=protectedSamples.every(s=>s.custom.protectedResource&&s.custom.embeddedNeutralLoaded&&s.custom.actualBodyMapIsEmbeddedNeutral);
 checks.noPlaintextProtectedModelRequests=plainProtectedRequests.length===0;
 checks.protectedModelsActuallyFetched=protectedSamples.every(s=>modelRequests.some(u=>u.endsWith('/'+catalog.breeds[s.key].file)));
 const fileSha256=Object.fromEntries(['ranch3d.html','assets/breed-models.js','assets/game-hero-horse.js','assets/rider-model.js','assets/artist-horse-motion.js','assets/dragon-horse-motion.js','assets/feather-wing-motion.js','assets/feather-wing-material.js','assets/equine-fantasy.js','assets/fjord-horse-motion.js','assets/protected-horse-resource.js','assets/models/horse-imports/prepared-manifest.json'].map(file=>[file,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')]));
 const report={checks,errors,warnings,fileSha256,shippingDefaultCatalogUsed:process.env.QA_SHIPPING_DEFAULT==='true',modelRequests:[...new Set(modelRequests)],plainProtectedRequests,identityKeys:keys,blockedExternalRequests:[...new Set(blocked)],samples,full80CatalogActivated:false,visualReview:'PNG inspection required; automated geometry/material checks alone do not certify mounted appearance'};fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));if(process.env.HORSE_QA_KEYS==='available')fs.writeFileSync(path.join(out,'all-available-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({checks,errors,warnings}));await browser.close();if(Object.values(checks).some(v=>!v))process.exitCode=1;
})().catch(async e=>{console.error(e);if(browser)await browser.close();process.exitCode=1;});

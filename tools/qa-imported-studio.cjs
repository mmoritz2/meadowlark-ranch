/* Test the actual Studio in a fresh localhost-only browser. The prepared catalog
 * is injected into this response; the incomplete default catalog stays unchanged. */
const fs=require('node:fs'),path=require('node:path'),QA=require('./qa-platform.cjs');
const root=path.resolve(__dirname,'..'),label=(process.env.STUDIO_QA_LABEL||'').replace(/[^a-z0-9-]/g,''),out=path.join(root,'output','imported-studio'+(label?'-'+label:'')+'-qa');
const catalog=JSON.parse(fs.readFileSync(process.env.HORSE_QA_MANIFEST||path.join(root,'assets/models/horse-imports/prepared-manifest.json')));
const keys=process.env.HORSE_QA_KEYS==='available'?Object.entries(catalog.breeds).filter(([,s])=>s.available).map(([key])=>key):process.env.HORSE_QA_KEYS?.split(',')||['bay','vanner','percheron','shire','clyde','suffolk','unicorn','pegasus','alicorn','emberdrake','lumen'];
const injection=String.raw`
window.__importedStudioQA={
 async select(key){await select(key);return this.inspect();},
 pose(gait,lead='left',ms=900){motion.set(gait,{lead});advanceTime(ms);return this.inspect();},
 advance(ms=900){advanceTime(ms);frameBody();return this.inspect();},
 wings(){accessories.toggle();advanceTime(1300);frameBody();return this.inspect();},
 inspect(){
  const rendered=JSON.parse(render_game_to_text()),geometry=breedStudioInspect(),allMeshes=[],materials=[];
  horse.traverse(o=>{if(o.isMesh){allMeshes.push({name:o.name,visible:o.visible,nativeWing:!!o.userData.nativeFeatherWing});for(const m of Array.isArray(o.material)?o.material:[o.material])materials.push({name:m.name,map:!!m.map,normalMap:!!m.normalMap,roughnessMap:!!m.roughnessMap});}});
  const cached=lib.get(selectedKey),bodyMaterial=instance.skin.material,original=cached.skin.material,registeredArtwork=window.__studioArtworkRegistrations?.[selectedKey]||null;
  const wingMembraneMaterials=[];horse.traverse(mesh=>{if(mesh.isMesh&&mesh.name==='DragonWingMembrane')for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material])wingMembraneMaterials.push(material.name);});
  return {rendered,geometry,allMeshes,materials,registeredArtwork,bodyMaterial:{name:bodyMaterial.name,color:bodyMaterial.color.getHexString(),transparent:bodyMaterial.transparent,opacity:bodyMaterial.opacity,animatedShader:typeof bodyMaterial.userData.update==='function'},wingMembraneMaterials,sourceBodyGeometryRetained:instance.skin.geometry===cached.skin.geometry,sourceBodyMapRetained:bodyMaterial.map===original.map,gameplayInstallerCalls:window.__studioGameplayInstallerCalls||0,credit:document.getElementById('credit').textContent,scale:horse.scale.toArray(),sourceHornCount:allMeshes.filter(m=>/horn/i.test(m.name)&&m.name!=='UnicornHorn').length,proceduralHorn:!!horse.getObjectByName('UnicornHorn'),proceduralWings:!!horse.getObjectByName('FantasyWings'),proceduralDragonCrest:!!horse.getObjectByName('ArtistDragonCrest'),pendingRows:[...document.querySelectorAll('#list button:disabled')].map(b=>b.dataset.key),wingButton:{label:document.getElementById('wings').textContent,pressed:document.getElementById('wings').getAttribute('aria-pressed')},movementDisabled:document.getElementById('motion').disabled};
 }
};`;
let browser;
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 browser=await QA.chromium.launch({headless:true,executablePath:process.env.QA_CHROMIUM||undefined,args:QA.gpuArgs()});
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],blocked=[],samples=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('net::ERR_FAILED'))errors.push(m.text());});
 await page.route('**/*',route=>{const u=new URL(route.request().url());if(['blob:','data:'].includes(u.protocol)||u.hostname==='127.0.0.1')return route.continue();blocked.push(u.origin+u.pathname);return route.abort();});
 if(process.env.HORSE_QA_MANIFEST)await page.route('**/prepared-manifest.json*',route=>route.fulfill({contentType:'application/json',body:JSON.stringify(catalog)}));
 await page.route('**/breeds.html*',route=>{
  let html=fs.readFileSync(path.join(root,'breeds.html'),'utf8');
  if(process.env.QA_SHIPPING_DEFAULT!=='true')html=html.replace('createBreedLibrary({THREE,GLTFLoader,clone})',"createBreedLibrary({THREE,GLTFLoader,clone,manifestURL:new URL('./assets/models/horse-imports/prepared-manifest.json',location.href)})");
  html=html.replace('</script></body>',injection+'\n</script></body>');
  return route.fulfill({contentType:'text/html',body:html});
 });
 // Observe the actual feature artwork inputs without installing game systems.
 await page.route('**/assets/equine-fantasy.js*',route=>{
  let source=fs.readFileSync(path.join(root,'assets/equine-fantasy.js'),'utf8'),call='export function registerFantasyAppearance(key,appearance){';
  if(!source.includes(call))throw Error('Expected fantasy appearance registry');
  source=source.replace(call,call+"if(key&&appearance){(window.__studioArtworkRegistrations||(window.__studioArtworkRegistrations={}))[key]=JSON.parse(JSON.stringify(appearance));}");
  return route.fulfill({contentType:'text/javascript',body:source});
 });
 for(const file of ['horse-roster.js','new-breeds.js'])await page.route('**/assets/features/'+file+'*',route=>{
  let source=fs.readFileSync(path.join(root,'assets/features',file),'utf8'),call='export function install(G){';
  if(!source.includes(call))throw Error('Expected feature game installer: '+file);
  source=source.replace(call,call+"window.__studioGameplayInstallerCalls=(window.__studioGameplayInstallerCalls||0)+1;throw Error('Studio must not install gameplay');");
  return route.fulfill({contentType:'text/javascript',body:source});
 });
 await page.goto(QA.BASE+'/breeds.html?horse=shire',{waitUntil:'load',timeout:120000});
 await page.waitForFunction(()=>window.__importedStudioQA&&JSON.parse(render_game_to_text()).modelReady&&!JSON.parse(render_game_to_text()).loading,null,{timeout:120000});
 for(const key of keys){
  if(!catalog.breeds[key]?.available)throw Error('Requested unavailable source '+key);
  const rest=await page.evaluate(k=>__importedStudioQA.select(k),key);samples.push({key,pose:'rest',state:rest});
  await page.screenshot({path:path.join(out,key+'-rest.png')});
  for(const [gait,ms]of [['walk',850],['gallop',850],['jump',800]])samples.push({key,pose:gait,state:await page.evaluate(([g,t])=>__importedStudioQA.pose(g,'left',t),[gait,ms])});
  if(rest.rendered.wings){await page.locator('#wings').click();const flight=await page.evaluate(()=>__importedStudioQA.advance(1300));samples.push({key,pose:'flight',state:flight});await page.screenshot({path:path.join(out,key+'-flight.png')});
   if(await page.locator('#groom').isVisible()){await page.locator('#groom').click();samples.push({key,pose:'source-wing-hair-toggle',state:await page.evaluate(()=>__importedStudioQA.inspect())});await page.locator('#groom').click();}
   await page.locator('#wings').click();samples.push({key,pose:'ground-control',state:await page.evaluate(()=>__importedStudioQA.advance(900))});
  }
  console.log(JSON.stringify({key,done:true}));
 }
 const rest=samples.filter(s=>s.pose==='rest'),all=samples.map(s=>s.state),pending=Object.entries(catalog.breeds).filter(([,s])=>s.available===false).map(([key])=>key).sort();
 const checks={
  noPageOrShaderErrors:errors.length===0,
  requestedSourcesLoaded:samples.every(s=>s.state.rendered.breed===s.key&&!s.state.rendered.loading&&s.state.rendered.asset.sha256===catalog.breeds[s.key].sha256),
  sourceSpecificCredits:rest.every(s=>s.state.credit.includes(catalog.breeds[s.key].sourceAuthor||catalog.breeds[s.key].creator||catalog.breeds[s.key].artist||'b2przemo')&&s.state.credit.includes(catalog.breeds[s.key].license)),
  physicalMetresNotScaledAgain:all.every(s=>s.scale.every(v=>v===1)&&s.rendered.asset.fitScale===catalog.breeds[s.rendered.breed].fitScale),
  allPosedVerticesFinite:all.every(s=>s.geometry.finite&&s.geometry.vertices>0),
  completeRestFraming:rest.every(s=>{const p=s.state.geometry.projected;return p.left>=-1.01&&p.right<=1.01&&p.top<=1.01&&p.bottom>=-1.01;}),
  nativeFeaturesWithoutProceduralDuplicates:all.every(s=>{const p=catalog.breeds[s.rendered.breed];return (!p.nativeHorn||!s.proceduralHorn)&&(!p.nativeWings||!s.proceduralWings)&&(!p.nativeDragonBody||!s.proceduralDragonCrest);}),
  articulatedSourceWingComponents:rest.filter(s=>catalog.breeds[s.key].wingComponent).every(s=>s.state.rendered.wings?.native&&s.state.rendered.wings.components===1&&s.state.allMeshes.some(m=>m.nativeWing)),
  registeredArtworkUsesExactSourceThemes:rest.filter(s=>s.state.registeredArtwork).every(s=>{const a=s.state.registeredArtwork,p=catalog.breeds[s.key],expected=a.body?'PearlCoat_'+s.key:'EquineFantasy_'+a.theme+(a.dragon&&!p.nativeDragonBody?'_scales':'');return s.state.bodyMaterial.name===expected&&(!a.theme||s.state.bodyMaterial.animatedShader)&&(!p.nativeDragonBody||!a.theme||s.state.wingMembraneMaterials.every(name=>name==='EquineFantasy_'+a.theme));}),
  allAvailableRegisteredArtworkCovered:keys.length!==Object.values(catalog.breeds).filter(s=>s.available).length||rest.filter(s=>s.state.registeredArtwork).length===(await page.evaluate(()=>Object.keys(window.__studioArtworkRegistrations||{}))).filter(k=>catalog.breeds[k]?.available).length,
  sourceBodyGeometryAndMapsRetained:all.every(s=>s.sourceBodyGeometryRetained&&s.sourceBodyMapRetained),
  standaloneArtworkWithoutGameplay:all.every(s=>s.gameplayInstallerCalls===0),
  lumenProfileFallbackPreserved:rest.filter(s=>s.key==='lumen').every(s=>s.state.bodyMaterial.name==='PearlCoat_lumen'&&s.state.bodyMaterial.transparent&&s.state.bodyMaterial.opacity===.84),
  hairToggleKeepsNativeWings:samples.filter(s=>s.pose==='source-wing-hair-toggle').every(s=>s.state.allMeshes.filter(m=>m.nativeWing).every(m=>m.visible)),
  genuineFlightAndGroundControls:samples.filter(s=>s.pose==='flight').every(s=>s.state.rendered.wings.open&&s.state.wingButton.pressed==='true'&&s.state.wingButton.label==='Ground pose'&&s.state.movementDisabled)&&samples.filter(s=>s.pose==='ground-control').every(s=>!s.state.rendered.wings.open&&s.state.wingButton.pressed==='false'&&s.state.wingButton.label==='Flight pose'&&!s.state.movementDisabled),
  liveGaitsActuallyDeform:samples.filter(s=>s.pose==='walk').every(s=>{const a=rest.find(r=>r.key===s.key).state.geometry.animation.localQuaternions,b=s.state.geometry.animation.localQuaternions;return a&&b&&a.some((q,i)=>q.some((v,j)=>Math.abs(v-b[i][j])>.001));}),
  unavailableSourcesDisabled:all.every(s=>JSON.stringify(s.pendingRows.sort())===JSON.stringify(pending)),
  onlyLocalRequests:blocked.length===0
 };
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({checks,errors,blockedExternalRequests:[...new Set(blocked)],preparedCatalogInjectedOnly:process.env.QA_SHIPPING_DEFAULT!=='true',shippingDefaultCatalogUsed:process.env.QA_SHIPPING_DEFAULT==='true',incompleteDefaultCatalogActivated:false,registeredArtworkIdentities:rest.filter(s=>s.state.registeredArtwork).map(s=>s.key),samples,visualReview:'Actual rendered screenshots require separate inspection; numeric checks do not certify all motion transitions or mounted tack.'},null,2)+'\n');
 console.log(JSON.stringify({checks,errors}));await browser.close();if(Object.values(checks).some(v=>!v))process.exitCode=1;
})().catch(async e=>{console.error(e);if(browser)await browser.close();process.exitCode=1;});

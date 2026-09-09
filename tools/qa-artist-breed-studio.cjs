const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),sharp=require('sharp');
const url='http://127.0.0.1:8431/breeds.html';
const out=path.resolve(process.argv[2]||'output/artist-breed-studio');
const quick=process.argv.includes('--quick'),thumbnails=process.argv.includes('--thumbnails'),only=process.argv.find(a=>a.startsWith('--only='))?.slice(7).split(',');
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--use-angle=d3d11']});
 const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
 const errors=[],checks={},states=[],captures=[],motionSamples=[];
 page.on('pageerror',e=>errors.push(e.stack||e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 const state=()=>page.evaluate(()=>JSON.parse(render_game_to_text()));
 const inspect=()=>page.evaluate(()=>breedStudioInspect());
 const ready=key=>page.waitForFunction(k=>window.render_game_to_text&&JSON.parse(render_game_to_text()).breed===k&&JSON.parse(render_game_to_text()).modelReady&&!JSON.parse(render_game_to_text()).loading,key,{timeout:120000});
 const select=async key=>{await page.locator('#list button[data-key="'+key+'"]').click();await ready(key);await page.waitForTimeout(80);};
 const capture=async(key,view)=>{const filename=key+'-'+view+'.png';await page.screenshot({path:path.join(out,filename)});captures.push(filename);};
 await page.goto(url);await ready('artist-study');
 const initial=await state();checks.approvedStudy=initial.asset.sha256==='8e3004247f3010df216a3a19ae825fd91f6650f83c853016a0df9280a967e629'&&initial.clip==='Rest';checks.studyNotRideable=!(await page.locator('#ride').isVisible());
 const manifest=await page.evaluate(()=>fetch('./assets/models/artist-breeds/manifest.json').then(r=>r.json()));
 const allKeys=Object.keys(manifest.breeds),keys=only|| (quick?['bay','chestnut','black','shire','fjord']:allKeys);
 await page.waitForFunction(n=>document.querySelectorAll('#list button').length===n,allKeys.length+1);
 checks.catalogCoverage=(await state()).count===allKeys.length+1;checks.roster45=quick||allKeys.length===45;
 const thumbKeys=[];
 async function thumbnail(key){
  const details=await inspect(),r=details.projected,box=await page.locator('canvas').boundingBox();
  const x=Math.max(0,Math.floor((r.left+1)*.5*box.width)-20),y=Math.max(0,Math.floor((1-r.top)*.5*box.height)-20),right=Math.min(box.width,Math.ceil((r.right+1)*.5*box.width)+20),bottom=Math.min(box.height,Math.ceil((1-r.bottom)*.5*box.height)+20);
  const image=await page.locator('canvas').screenshot(),dest=path.resolve('assets/breed-thumbnails/'+key+'.webp');
  await sharp(image).extract({left:x,top:y,width:Math.max(1,right-x),height:Math.max(1,bottom-y)}).resize(240,160,{fit:'contain',background:'#d8d9d2'}).webp({quality:83}).toFile(dest);thumbKeys.push(key);
 }
 await page.click('#side');if(thumbnails)await thumbnail('artist-study');
 for(const key of keys){
  await select(key);await page.click('#side');const s=await state(),d=await inspect();
  states.push({state:s,details:d});checks[key+'_asset']=s.asset.artistBreed===true&&s.asset.file===manifest.breeds[key].file&&s.asset.bodyMesh==='HorseBody';checks[key+'_geometry']=d.finite&&d.bones===40&&d.bounds.min[1]>-.01&&d.bounds.max[1]>.7;checks[key+'_ride']=(await page.locator('#ride').getAttribute('href')).includes('inspect-breed='+key);
  if(quick||only||['bay','chestnut','shire','fjord','black','sunset','marwari','vanner','akhal','unicorn','pegasus','frostdrake'].includes(key)){await capture(key,'side');await page.click('#front');await capture(key,'front');await page.click('#head');await capture(key,'head');await page.click('#side');}
  if(thumbnails)await thumbnail(key);
  if(!quick){for(const gait of ['stand','walk','trot','canter','gallop','jump']){await page.selectOption('#motion',gait);await page.evaluate(()=>advanceTime(350));const moved=await inspect();checks[key+'_'+gait]=moved.finite&&moved.bones===40;motionSamples.push({key,gait,finite:moved.finite,bounds:moved.bounds,feet:moved.animation?.feet});if(['chestnut','shire','sunset','fjord'].includes(key)&&['trot','canter','jump'].includes(gait))await capture(key,gait);}}
  console.log(JSON.stringify({key,finite:d.finite,bones:d.bones,height:d.bounds.size[1],geometry:s.asset.geometryHash}));
 }
 if(thumbnails){const index=path.resolve('assets/breed-thumbnails/index.json'),old=JSON.parse(fs.readFileSync(index,'utf8'));fs.writeFileSync(index,JSON.stringify([...new Set([...old,...thumbKeys])],null,2));}
 if(!quick&&!only){
  await select('sunset');await page.fill('#breed-search','shire');checks.search=JSON.stringify(await page.locator('#list button:visible').evaluateAll(b=>b.map(o=>o.dataset.key)))===JSON.stringify(['shire']);await page.fill('#breed-search','');
  await page.selectOption('#motion','canter');await page.selectOption('#lead','right');await page.evaluate(()=>advanceTime(600));checks.rightLead=(await state()).lead==='right';
  await page.click('#pause');const before=await inspect();await page.evaluate(()=>advanceTime(600));const after=await inspect();checks.pause=before.animation.time===after.animation.time;await page.click('#pause');await page.evaluate(()=>advanceTime(200));checks.resume=(await inspect()).animation.time>after.animation.time;
  await page.selectOption('#surface','clay');checks.clayHidesHair=!(await state()).hair;await capture('sunset','clay');await page.selectOption('#surface','coat');await page.click('#groom');checks.hairToggle=!(await state()).hair;await page.click('#groom');
  await select('pegasus');await page.click('#wings');checks.wingsOpen=(await state()).wings.open;await capture('pegasus','open-wings');await page.click('#wings');checks.wingsFold=!(await state()).wings.open;
  await select('artist-study');checks.studyPreserved=(await state()).asset.sha256===initial.asset.sha256;const memoryBefore=(await state()).memory;for(const key of ['pegasus','unicorn','frostdrake','kestrel','artist-study'])await select(key);const memoryAfter=(await state()).memory;checks.repeatedSelectionMemory=memoryBefore.geometries===memoryAfter.geometries&&memoryBefore.textures===memoryAfter.textures;
  await page.setViewportSize({width:390,height:844});await page.click('#side');await capture('study','mobile');
  checks.mobileControls=await page.locator('.controls').evaluate(el=>{const b=el.getBoundingClientRect();return b.left>=0&&b.right<=innerWidth&&b.bottom<=innerHeight;});
  await page.goto(url+'?horse=hero');await ready('bay-sporthorse');checks.legacyHeroLink=(await state()).asset.artistBreed===true;
  const physical=states.filter(r=>!manifest.breeds[r.state.breed].fantasy&&!manifest.breeds[r.state.breed].theme&&!['aether','sunspear','meadowlight','tempest','eclipse','glacier','unicorn','pegasus','celestial','ember','frost','aurora','phoenix','shadowmare','kestrel','frostdrake','emberdrake','amethyst','stormdrake','verdant'].includes(r.state.breed));checks.distinctPhysicalShapes=physical.length===25&&new Set(physical.map(r=>r.state.asset.geometryHash)).size===25;
 }
 checks.noErrors=errors.length===0;
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({checks,errors,states,captures,motionSamples},null,2));
 console.log(JSON.stringify({checks,errors}));await browser.close();if(Object.values(checks).some(v=>!v))process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});

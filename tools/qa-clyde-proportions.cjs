const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path');
const out=path.resolve(process.argv[3]||'output/clyde-proportions-qa');fs.mkdirSync(out,{recursive:true});
const beforeDir=process.argv[2];
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--use-angle=d3d11']});
 const errors=[],states=[];
 const watch=page=>{page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});page.on('console',m=>{if(m.type()==='error'){errors.push(m.text());console.error(m.text());}});};
 for(const version of beforeDir?['before','after']:['after']){
  const page=await browser.newPage({viewport:{width:1500,height:940}});watch(page);
  await page.route('**/breeds.html',r=>r.fulfill({contentType:'text/html',body:fs.readFileSync('breeds.html','utf8').replace('window.advanceTime=ms=>{',`window.__headFront=()=>{controls.resetMotion();controls.autoRotate=false;controls.target.set(0,1.6,.6);camera.position.set(0,1.8,4.4);controls.update();renderer.render(scene,camera);};window.advanceTime=ms=>{`)}));
  if(version==='before'){
   await page.route('**/models/breeds/manifest.json',r=>r.fulfill({contentType:'application/json',body:fs.readFileSync(path.join(beforeDir,'manifest.json'))}));
   await page.route('**/models/breeds/clyde.glb*',r=>r.fulfill({contentType:'model/gltf-binary',body:fs.readFileSync(path.join(beforeDir,'clyde.glb'))}));
  }
  await page.goto('http://127.0.0.1:8431/breeds.html');
  await page.waitForFunction(()=>window.render_game_to_text&&!JSON.parse(render_game_to_text()).loading,null,{timeout:90000,polling:200});
  await page.locator('[data-key="clyde"]').click();
  await page.waitForFunction(()=>JSON.parse(render_game_to_text()).breed==='clyde'&&!JSON.parse(render_game_to_text()).loading,null,{timeout:90000,polling:200});
  await page.click('#side');await page.waitForTimeout(200);
  await page.screenshot({path:path.join(out,version+'-side.png')});
  await page.selectOption('#surface','clay');await page.waitForTimeout(100);
  await page.screenshot({path:path.join(out,version+'-clay.png')});
  await page.evaluate(()=>__headFront());await page.waitForTimeout(100);
  await page.screenshot({path:path.join(out,version+'-front-clay.png')});
  await page.selectOption('#surface','coat');await page.waitForTimeout(100);
  await page.screenshot({path:path.join(out,version+'-front.png')});
  states.push({version,...JSON.parse(await page.evaluate(()=>render_game_to_text()))});
  await page.close();
 }
 const page=await browser.newPage({viewport:{width:1440,height:960}});watch(page);
 await page.route('**/ranch3d.html*',route=>route.fulfill({contentType:'text/html',body:fs.readFileSync('ranch3d.html','utf8').replace('const MERGE_STATS=mergeStatics();',`window.__clydeQA={RIG,player,TACK,
  mount:async()=>{const b=BREEDS3.find(b=>b[0]==='clyde');Object.assign(myHorses[rideIdx],{breed:'clyde',colors:{body:b[5],mane:b[6]},coat:null,dragon:false,horn:false,wings:false});rebuildAll();await requestPlayerBreed('clyde');dayT=.34;weather.mode='clear';weather.timer=9999;player.pos.set(0,0,8);player.heading=Math.PI;},
  view:()=>{const h=groundH(player.pos.x,player.pos.z);camera.position.set(player.pos.x+4.4,h+2.4,player.pos.z+3.5);camera.lookAt(player.pos.x,h+1.4,player.pos.z);renderer.info.reset();composer.render();},
  fit:()=>({model:RIG.modelKey,bones:RIG.bones.length,scale:player.mesh.scale.x,head:RIG.headBone?.position.toArray(),saddle:TACK.saddle.position.toArray(),bridle:TACK.bridle.position.toArray(),finite:RIG.bones.every(b=>b.matrixWorld.elements.every(Number.isFinite))&&TACK.bridle.matrixWorld.elements.every(Number.isFinite)})};const MERGE_STATS=mergeStatics();`)}));
 await page.goto('http://127.0.0.1:8431/ranch3d.html',{waitUntil:'load',timeout:90000});
 await page.waitForFunction(()=>window.__clydeQA?.RIG.ready,null,{timeout:90000,polling:200});
 await page.evaluate(async()=>{await __clydeQA.mount();advanceTime(600);__clydeQA.view();});
 await page.screenshot({path:path.join(out,'ridden.png')});
 const start=JSON.parse(await page.evaluate(()=>render_game_to_text()));
 await page.keyboard.down('ArrowUp');await page.evaluate(()=>advanceTime(1000));await page.keyboard.up('ArrowUp');
 const moved=JSON.parse(await page.evaluate(()=>render_game_to_text()));
 await page.keyboard.down('Space');await page.evaluate(()=>advanceTime(200));await page.keyboard.up('Space');
 const jumped=JSON.parse(await page.evaluate(()=>render_game_to_text()));await page.evaluate(()=>__clydeQA.view());await page.screenshot({path:path.join(out,'jump.png')});
 await page.evaluate(()=>advanceTime(1800));const landed=JSON.parse(await page.evaluate(()=>render_game_to_text()));const fit=await page.evaluate(()=>__clydeQA.fit());
 const checks={clydesdale:fit.model==='clyde',moves:Math.hypot(moved.player.x-start.player.x,moved.player.z-start.player.z)>.5,jumps:jumped.jumping,lands:!landed.jumping,rigAndTackFinite:fit.finite&&fit.bones===33,noErrors:!errors.length};
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({checks,errors,fit,states},null,2));console.log(JSON.stringify({checks,errors,fit}));
 await browser.close();if(Object.values(checks).some(v=>!v))process.exitCode=1;
})().catch(e=>{console.error(e);process.exit(1);});

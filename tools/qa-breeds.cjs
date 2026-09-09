const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path');
const out=path.resolve(process.argv[2]||'output/breed-qa');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--use-angle=d3d11','--disable-background-timer-throttling']});
 const page=await browser.newPage({viewport:{width:1440,height:960}});
 const errors=[],warnings=[];page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});page.on('console',m=>{if(m.type()==='error'){errors.push(m.text());console.error(m.text());}if(m.type()==='warning')warnings.push(m.text());});
 const preview=!fs.existsSync('assets/models/breeds/manifest.json');
 if(preview)await page.route('**/models/breeds/manifest.json',r=>{const m=JSON.parse(fs.readFileSync('assets/models/breeds/preview-manifest.json','utf8'));for(const k of Object.keys(m.aliases||{}))delete m.aliases[k];m.aliases={bay:'thoro',black:'shire',grey:'sunset',palomino:'thoro',pinto:'thoro',haflinger:'chestnut'};r.fulfill({contentType:'application/json',body:JSON.stringify(m)});});
 await page.route('**/ranch3d.html*',route=>{
  const html=fs.readFileSync('ranch3d.html','utf8').replace('const MERGE_STATS=mergeStatics();',`window.__breedQA={THREE,RIG,player,BREED_MODELS,scene,camera,renderer,composer,herd,applyQuality,
   switch:async key=>{const b=BREEDS3.find(x=>x[0]===key);const h=myHorses[rideIdx];Object.assign(h,{breed:key,colors:{body:b[5],mane:b[6]},horn:!!b[7].horn,wings:!!b[7].wings,dragon:!!b[7].dragon,coat:b[7].coat||null});rebuildAll();await requestPlayerBreed(key);},
   start:()=>{dayT=.34;weather.mode='clear';weather.timer=9999;player.pos.set(0,0,8);player.heading=Math.PI;},
   view:()=>{const h=groundH(player.pos.x,player.pos.z);camera.position.set(player.pos.x+4.2,h+2.1,player.pos.z+3.5);camera.lookAt(player.pos.x,h+1.1,player.pos.z);renderer.info.reset();composer.render();},
   studio:angle=>{scene.children.forEach(o=>o.visible=o.isLight||o===player.mesh);if(!window.__floor){window.__floor=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshStandardMaterial({color:0x52645e,roughness:.9}));window.__floor.rotation.x=-Math.PI/2;window.__floor.receiveShadow=true;scene.add(window.__floor);}window.__floor.visible=true;scene.background=new THREE.Color(0x80938e);scene.fog.density=0;player.mesh.position.set(0,0,0);player.mesh.rotation.set(0,0,0);player.rider.g.visible=false;for(const t of[TACK.saddle,TACK.bridle])if(t)t.visible=false;RIG.bones.forEach((b,i)=>b.quaternion.copy(RIG.restQ[i]));player.mesh.updateMatrixWorld(true);camera.position.set(...(angle==='side'?[4.1,1.22,0]:[3.2,1.7,3.1]));camera.lookAt(0,.95,.05);renderer.info.reset();composer.render();},
   state:()=>({expected:BREED_MODELS.resolve(RIG.requestedBreed),model:RIG.modelKey,requested:RIG.requestedBreed,loading:RIG.loadingBreed,bones:RIG.bones?.length,scale:player.mesh.scale.x,seat:TACK.saddle?.position.toArray(),vertices:RIG.skin?.geometry.attributes.position.count,groom:RIG.groom?.stats,bounds:new THREE.Box3().setFromObject(RIG.scene).getSize(new THREE.Vector3()).toArray(),finite:RIG.bones?.every(b=>b.matrixWorld.elements.every(Number.isFinite))}),
  };const MERGE_STATS=mergeStatics();`);
  route.fulfill({contentType:'text/html',body:html});
 });
 await page.goto('http://127.0.0.1:8431/ranch3d.html',{waitUntil:'load',timeout:120000});
 await page.waitForFunction(()=>window.__breedQA?.RIG.ready&&!window.__breedQA.RIG.loadingBreed,null,{timeout:120000,polling:250});
 const save=async name=>{await page.screenshot({path:path.join(out,name+'.png')});};
 await page.evaluate(()=>{__breedQA.start();advanceTime(600);__breedQA.view();});await save('riding');
 const initial=JSON.parse(await page.evaluate(()=>render_game_to_text()));
 await page.keyboard.down('ArrowUp');await page.evaluate(()=>advanceTime(1000));await page.keyboard.up('ArrowUp');
 const moved=JSON.parse(await page.evaluate(()=>render_game_to_text()));
 await page.keyboard.down('Space');await page.evaluate(()=>advanceTime(200));await page.keyboard.up('Space');
 const jumped=JSON.parse(await page.evaluate(()=>render_game_to_text()));await save('jump');await page.evaluate(()=>advanceTime(1600));
 const landed=JSON.parse(await page.evaluate(()=>render_game_to_text()));
 const keys=preview?['chestnut','sunset','thoro','shire']:await page.evaluate(()=>Object.keys(__breedQA.BREED_MODELS.manifest.breeds));
 const states=[];
 if(!preview){
  await page.route('**/models/breeds/clyde.glb*',async route=>{await new Promise(r=>setTimeout(r,700));await route.continue();});
  await page.route('**/models/breeds/akhal.glb*',async route=>{await new Promise(r=>setTimeout(r,250));await route.continue();});
  await page.evaluate(async()=>{const a=__breedQA;await Promise.all([a.switch('clyde'),a.switch('akhal'),a.switch('lipiz')]);});
  states.push({key:'cold-network-switch',...await page.evaluate(()=>__breedQA.state())});
 }
 for(const key of keys){
  await page.evaluate(async k=>{await __breedQA.switch(k);advanceTime(100);},key);
  states.push({key,...await page.evaluate(()=>__breedQA.state())});
  if(['bay','chestnut','sunset','thoro','shire','fjord','black','marwari','vanner'].includes(key))for(const angle of ['side','quarter']){await page.evaluate(a=>__breedQA.studio(a),angle);await save(key+'-'+angle);}
 }
 if(!preview){
  await page.evaluate(async()=>{const a=__breedQA;await Promise.all([a.switch('chestnut'),a.switch('shire'),a.switch('fjord')]);});
  states.push({key:'rapid-switch',...await page.evaluate(()=>__breedQA.state())});
  for(const key of ['aether','sunspear','unicorn','pegasus','emberdrake']){await page.evaluate(async k=>{await __breedQA.switch(k);advanceTime(200);},key);states.push({key,...await page.evaluate(()=>__breedQA.state())});await save(key);}
 }
 const isolated=await page.evaluate(()=>{const lib=__breedQA.BREED_MODELS,asset=lib.get('bay'),a=lib.instantiate(asset),b=lib.instantiate(asset);const before=b.bones[5].quaternion.clone();a.bones[5].rotation.x+=.5;return a.bones[5]!==b.bones[5]&&b.bones[5].quaternion.equals(before)&&a.skin.geometry===b.skin.geometry;});
 const checks={moves:Math.hypot(moved.player.x-initial.player.x,moved.player.z-initial.player.z)>.5,jumps:jumped.jumping,lands:!landed.jumping,finite:states.every(s=>s.finite&&s.bones===33&&s.seat.every(Number.isFinite)),models:states.every(s=>s.model===s.expected),coverage:preview||keys.length===24,skeletonsIndependent:isolated,noErrors:!errors.length};
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({preview,errors,warnings,checks,states},null,2));console.log(JSON.stringify({preview,errors,warnings,checks,models:states.map(s=>({key:s.key,model:s.model}))}));
 await browser.close();if(Object.values(checks).some(v=>!v))process.exitCode=1;
})().catch(e=>{console.error(e);process.exit(1);});

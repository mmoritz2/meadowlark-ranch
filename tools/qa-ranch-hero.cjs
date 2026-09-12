const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path');
const out=path.resolve(process.argv[2]||'output/ranch-hero-qa');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--disable-background-timer-throttling','--use-angle=metal','--enable-gpu-rasterization','--ignore-gpu-blocklist']});
 const page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[];
 page.on('pageerror',e=>{errors.push(e.message);console.error(e.message)});page.on('console',m=>{if(m.type()==='error'){errors.push(m.text());console.error(m.text())}});
 await page.route('**/ranch3d.html*',route=>route.fulfill({contentType:'text/html',body:fs.readFileSync('ranch3d.html','utf8').replace('const MERGE_STATS=mergeStatics();',`window.__heroQA={THREE,RIG,player,TACK,BREED_MODELS,scene,renderer,camera,myHorses,adoptBaySporthorse,
  start(){dayT=.34;weather.mode='clear';weather.timer=9999;player.pos.set(-3,0,-3);player.heading=0;},
  fenceStart(){const j=jumps[0];player.speed=4.8;player.y=0;player.vy=0;player.heading=j.rotY;player.pos.set(j.x-Math.sin(j.rotY)*3.6,0,j.z-Math.cos(j.rotY)*3.6);j.prevSide=-1;RIG.heroJumpAge=null;RIG.heroMotion.reset();return {x:j.x,z:j.z,rotY:j.rotY,jumpsBefore:JSON.parse(localStorage.starRanchFable_v1).stats?.jumps||0};},
  view(angle='quarter'){const h=groundH(player.pos.x,player.pos.z);camera.position.set(player.pos.x+(angle==='side'?5.2:4.6),h+2.4,player.pos.z+(angle==='side'?0:4));camera.lookAt(player.pos.x,h+1.5,player.pos.z);composer.render();},
  state(){return {breed:myHorses[rideIdx].breed,model:RIG.modelKey,groom:RIG.groom?.stats,motion:RIG.heroMotion?.mode,phase:RIG.phase,jumpAge:RIG.heroJumpAge,jumpExtra:RIG.heroJumpExtra,gameY:player.y,meshY:player.mesh.position.y,ground:groundH(player.pos.x,player.pos.z),seat:TACK.saddle?.position.toArray(),rider:player.rider.g.position.toArray(),bridle:TACK.bridle?.position.toArray(),head:player.mesh.worldToLocal(RIG.bones[6].getWorldPosition(new THREE.Vector3())).toArray(),finite:RIG.bones.every(b=>b.matrixWorld.elements.every(Number.isFinite)),feet:RIG.heroMotion?.snapshot().feet};}
 };const MERGE_STATS=mergeStatics();`)}));
 await page.goto('http://127.0.0.1:8431/ranch3d.html?adopt=bay-sporthorse&v=hero-ranch-1',{waitUntil:'load',timeout:120000});
 await page.waitForFunction(()=>window.__heroQA?.RIG.modelKey==='bay-sporthorse'&&!__heroQA.RIG.loadingBreed,{},{timeout:120000});
 await page.evaluate(async()=>{await __heroQA.RIG.groom.ready;__heroQA.start();advanceTime(800);});
 const states=[];
 async function capture(name){await page.evaluate(()=>__heroQA.view());states.push({name,...await page.evaluate(()=>__heroQA.state())});await page.screenshot({path:path.join(out,name+'.png')});}
 await capture('idle');
 await page.keyboard.down('ArrowUp');await page.evaluate(()=>advanceTime(800));await capture('canter');
 await page.keyboard.down('Shift');await page.evaluate(()=>advanceTime(1400));await capture('gallop');
 await page.keyboard.up('Shift');await page.keyboard.up('ArrowUp');await page.evaluate(()=>advanceTime(2200));
 await page.keyboard.down('Space');await page.evaluate(()=>advanceTime(200));await page.keyboard.up('Space');await capture('gather');
 await page.evaluate(()=>advanceTime(550));await capture('jump-apex');
 await page.evaluate(()=>advanceTime(600));await capture('landing');
 await page.evaluate(()=>advanceTime(1400));await capture('recovered');
 const fence=await page.evaluate(()=>__heroQA.fenceStart());
 await page.keyboard.down('ArrowUp');await page.keyboard.down('Space');await page.evaluate(()=>advanceTime(200));await page.keyboard.up('Space');
 await page.evaluate(()=>advanceTime(550));await capture('fence-apex');
 await page.evaluate(()=>advanceTime(150));
 const crossing=await page.evaluate(()=>({x:__heroQA.player.pos.x,z:__heroQA.player.pos.z,y:__heroQA.player.y,toasts:document.querySelector('#toasts').textContent,jumps:JSON.parse(localStorage.starRanchFable_v1).stats?.jumps||0}));
 await page.keyboard.up('ArrowUp');await page.evaluate(()=>advanceTime(1800));
 await page.click('#stableBtn');await page.screenshot({path:path.join(out,'stable.png')});
 const before=await page.evaluate(()=>{const s=JSON.parse(localStorage.starRanchFable_v1);return {count:s.horses.length,coins:s.coins,gems:s.gems,id:s.ridingHorseId}});
 await page.click('[data-st="hero"]');await page.evaluate(()=>advanceTime(200));
 const after=await page.evaluate(()=>{const s=JSON.parse(localStorage.starRanchFable_v1);return {count:s.horses.length,coins:s.coins,gems:s.gems,id:s.ridingHorseId}});
 await page.reload({waitUntil:'load',timeout:120000});await page.waitForFunction(()=>window.__heroQA?.RIG.modelKey==='bay-sporthorse'&&!__heroQA.RIG.loadingBreed,{},{timeout:120000});
 const final=await page.evaluate(()=>__heroQA.state());
 const checks={noErrors:!errors.length,model:states.every(s=>s.model==='bay-sporthorse'),finite:states.every(s=>s.finite),groom:states.every(s=>s.groom?.triangles>0),moves:states.some(s=>s.motion==='gallop'),jumpHeight:states.find(s=>s.name==='jump-apex').gameY>.85,landed:states.at(-1).gameY===0,selectionPersists:final.breed==='bay-sporthorse',adoptIdempotent:JSON.stringify(before)===JSON.stringify(after),headTack:states.every(s=>Math.hypot(...s.head.map((x,i)=>x-s.bridle[i]))<.001)};
 checks.landed=states.find(s=>s.name==='recovered').gameY===0;
 checks.fenceCrossing=(crossing.x-fence.x)*Math.sin(fence.rotY)+(crossing.z-fence.z)*Math.cos(fence.rotY)>0&&crossing.y>.45&&crossing.jumps===fence.jumpsBefore+1;
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({checks,errors,states,before,after,fence,crossing},null,2));console.log(JSON.stringify({checks,errors}));
 await browser.close();if(Object.values(checks).some(x=>!x))process.exitCode=1;
})().catch(e=>{console.error(e);process.exit(1)});

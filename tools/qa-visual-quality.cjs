const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path');
const out=path.resolve(process.argv[2]||'output/visual-quality');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--use-angle=d3d11','--disable-background-timer-throttling']});
 const page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await page.route('**/ranch3d.html*',route=>route.fulfill({contentType:'text/html',body:fs.readFileSync('ranch3d.html','utf8').replace('const MERGE_STATS=mergeStatics();',`window.__artQA={THREE,scene,camera,renderer,RIG,player,groundH,
  place(x,z,heading=0){player.pos.set(x,0,z);player.heading=heading;player.speed=0;player.y=0;camYaw=.24;camPitch=.27;camDist=camDistSm=6.2;dayT=.34;weather.mode='clear';weather.timer=99999;},
  shot(p,t){camera.position.set(...p);camera.lookAt(...t);composer.render();},
  orbit(a){camYaw=a;},
  cameraState(){return {position:camera.position.toArray(),target:camLook.toArray(),player:player.pos.toArray(),cameraClear:typeof followCamera==='undefined'?null:followCamera.isClear(camLook,camera.position),obstacles:typeof followCamera==='undefined'?0:followCamera.obstacleCount};}
 };const MERGE_STATS=mergeStatics();`)}));
 await page.goto('http://127.0.0.1:8431/ranch3d.html?adopt=bay-sporthorse',{waitUntil:'load',timeout:120000});
 await page.waitForFunction(()=>window.__artQA?.RIG.modelKey==='bay-sporthorse'&&!__artQA.RIG.loadingBreed,null,{timeout:120000});
 await page.evaluate(async()=>{await __artQA.RIG.groom.ready;advanceTime(100);});await page.waitForTimeout(2500);
 const shots=[['arena',[-3,-3,0],[2.2,2.7,2],[-3,1.5,-3]],['arrival',[0,16,Math.PI]],['stall-camera',[-27.5,-8.5,Math.PI]],['barn-camera',[-10,-14,Math.PI/2]]];
 const states=[];
 for(const [name,at,p,t] of shots){await page.evaluate(a=>{__artQA.place(...a);advanceTime(1600);},at);
  if(p)await page.evaluate(({p,t})=>__artQA.shot(p,t),{p,t});
  states.push({name,...await page.evaluate(()=>__artQA.cameraState())});
  await page.screenshot({path:path.join(out,name+'.png')});
 }
 const orbits=[];
 if(process.argv.includes('--camera-checks')){
  for(const at of [[-27.5,-8.5,Math.PI],[-10,-14,Math.PI/2],[37,-50,0],[0,8,0]]){
   await page.evaluate(a=>{__artQA.place(...a);advanceTime(1000);},at);
   for(let i=0;i<12;i++){
    await page.evaluate(i=>{__artQA.orbit(i*Math.PI/6);advanceTime(400);},i);
    orbits.push(await page.evaluate(()=>__artQA.cameraState()));
   }
  }
 }
 const checks={noErrors:!errors.length,orbitsClear:orbits.every(s=>s.cameraClear),cameraFinite:orbits.every(s=>s.position.every(Number.isFinite))};
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({checks,errors,states,orbits},null,2));console.log(JSON.stringify({checks,errors,states,orbitCount:orbits.length}));await browser.close();if(Object.values(checks).some(x=>!x))process.exitCode=1;
})().catch(e=>{console.error(e);process.exit(1)});

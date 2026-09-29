const QA=require('./qa-platform.cjs');
const {chromium}=QA,fs=require('node:fs'),path=require('node:path');
const out=path.resolve(process.argv[2]||'output/visual-quality');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,args:[QA.ANGLE,'--disable-background-timer-throttling']});
 const page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await page.route('**/ranch3d.html*',route=>route.fulfill({contentType:'text/html',body:fs.readFileSync('ranch3d.html','utf8').replace('const MERGE_STATS=mergeStatics();',`window.__artQA={THREE,scene,camera,renderer,RIG,player,groundH,
  place(x,z,heading=0){player.pos.set(x,0,z);player.heading=heading;player.speed=0;player.y=0;camYaw=.24;camPitch=.27;camDist=camDistSm=6.2;dayT=.34;weather.mode='clear';weather.timer=99999;},
  shot(p,t){camera.position.set(...p);camera.lookAt(...t);composer.render();},
  orbit(a){camYaw=a;},
  cameraState(){return {position:camera.position.toArray(),target:camLook.toArray(),player:player.pos.toArray(),cameraClear:typeof followCamera==='undefined'?null:followCamera.isClear(camLook,camera.position),obstacles:typeof followCamera==='undefined'?0:followCamera.obstacleCount};}
 };const MERGE_STATS=mergeStatics();`)}));
 await page.goto(QA.BASE+'/ranch3d.html?adopt=bay-sporthorse',{waitUntil:'load',timeout:120000});
 await page.waitForFunction(()=>window.__artQA?.RIG.modelKey==='bay-sporthorse'&&!__artQA.RIG.loadingBreed,null,{timeout:120000});
 await page.evaluate(async()=>{await __artQA.RIG.groom.ready;advanceTime(100);});await page.waitForTimeout(2500);
 /* A fresh profile opens the Character screen over everything, so every shot below was a photograph of that screen.
    Close it the way the player does before the first shot. */
 /* closeChar when the page exposes the packages (?qa), else Escape, which the wardrobe owns while its screen is up (it
    also gives back the screen's own GL context); taking the class off is only the last resort. */
 const charOn=()=>page.evaluate(()=>{const c=document.getElementById('seChar');return !!(c&&c.classList.contains('on'));});
 /* The screen opens on the first frame after the loading curtain lifts, which can be well after the horse is ready: wait for
    the curtain, then give the screen a few seconds to appear before deciding there is nothing to close. */
 await page.waitForFunction(()=>!document.getElementById('load'),null,{timeout:90000,polling:250}).catch(()=>{});
 for(let i=0;i<24&&!(await charOn());i++)await page.waitForTimeout(250);
 if(await charOn())await page.evaluate(()=>{const w=window.__features&&window.__features.wardrobe;if(w&&w.closeChar)w.closeChar();});
 if(await charOn())await page.keyboard.press('Escape');
 if(await charOn())await page.evaluate(()=>document.getElementById('seChar').classList.remove('on'));
 const charClosed=!(await charOn());
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
 const checks={characterScreenClosed:charClosed&&!(await charOn()),shotsTaken:states.length===shots.length&&shots.every(([name])=>fs.existsSync(path.join(out,name+'.png'))),
  cameraStatesFinite:states.every(s=>s.position.every(Number.isFinite)),noErrors:!errors.length,orbitsClear:orbits.every(s=>s.cameraClear),cameraFinite:orbits.every(s=>s.position.every(Number.isFinite))};
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({checks,errors,states,orbits},null,2));console.log(JSON.stringify({checks,errors,states,orbitCount:orbits.length}));
 /* PASS/FAIL, one line a check, so tools/qa-suite.cjs runs and tallies this script with the rest. */
 for(const [k,v] of Object.entries(checks))console.log((v?'PASS ':'FAIL ')+k+(k==='noErrors'&&!v?' — '+JSON.stringify(errors.slice(0,5)):''));
 await browser.close();if(Object.values(checks).some(x=>!x))process.exitCode=1;
})().catch(e=>{console.error(e);console.log('FAIL qa-visual-quality ran to the end — '+String(e&&e.message||e).split('\n')[0]);process.exit(1)});

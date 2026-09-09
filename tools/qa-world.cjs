/* Run against a local game server: node tools/qa-world.cjs [url].
   Debug access is injected only into the Playwright response, never the shipped game. */
const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const url=process.argv[2]||'http://127.0.0.1:8431/ranch3d.html';
const out=path.resolve('output/world-validation');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--use-angle=d3d11','--disable-background-timer-throttling']});
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('**/ranch3d.html*',async route=>{
  const response=await route.fetch();const html=await response.text();
  const marker='const MERGE_STATS=mergeStatics();';
  if(!html.includes(marker))throw Error('Game QA injection point is missing');
  await route.fulfill({response,body:html.replace(marker,`window.__qa={THREE,scene,camera,renderer,composer,RIG,terrainH,groundH,riverZ,riverLevel,streamX,streamLevel,BR_A,BR_B,BRIDGE_Y,
   travel:(x,z,h=0)=>{player.pos.set(x,0,z);player.heading=h;player.speed=0;player.y=0;},
   day:v=>{dayT=v;weather.mode='clear';weather.timer=1e6;},quality:applyQuality,
   view:(p,t)=>{camera.position.set(...p);camera.lookAt(...t);renderer.info.reset();composer.render();}};`+marker)});
 });
 await page.goto(url,{waitUntil:'load',timeout:120000});
 await page.waitForFunction(()=>window.__qa?.RIG.ready,null,{polling:250,timeout:120000});
 await page.waitForTimeout(2500);await page.evaluate(()=>{__qa.day(.38);advanceTime(500);});
 const terrain=await page.evaluate(()=>{
  const q=__qa,T=q.THREE,mesh=q.scene.getObjectByName('Pasture terrain');
  const ray=new T.Raycaster(),down=new T.Vector3(0,-1,0);let maxError=0,n=0;
  mesh.updateMatrixWorld(true);
  for(let x=-295;x<=295;x+=59)for(let z=-270;z<=270;z+=54){
   ray.set(new T.Vector3(x+.37,100,z+.61),down);const hit=ray.intersectObject(mesh)[0];
   if(!hit)throw Error(`Missing terrain at ${x},${z}`);
   maxError=Math.max(maxError,Math.abs(hit.point.y-q.terrainH(x+.37,z+.61)));n++;
  }
  const river=[];
  for(let x=-480;x<=480;x+=5)river.push({x,water:q.riverLevel(x),bed:q.terrainH(x,q.riverZ(x))});
  return {samples:n,maxError,riverMonotonic:river.every((p,i)=>i===0||p.water<river[i-1].water),
   minChannelDepth:Math.min(...river.map(p=>p.water-p.bed))};
 });
 await page.evaluate(()=>{__qa.travel(0,__qa.BR_A-5,0);advanceTime(100);});
 const crossing=[];await page.keyboard.down('ArrowUp');
 for(let i=0;i<36;i++){
  await page.evaluate(()=>advanceTime(160));
  crossing.push(JSON.parse(await page.evaluate(()=>render_game_to_text())).player);
 }
 await page.keyboard.up('ArrowUp');
 const bridge=await page.evaluate(()=>({end:__qa.BR_B,start:__qa.BR_A}));
 const checks={terrainMatchesMesh:terrain.maxError<.002,riverFlowsDownhill:terrain.riverMonotonic,
   channelBelowWater:terrain.minChannelDepth>.25,bridgeCrossed:crossing.at(-1).z>bridge.end+1,
   bridgeHeightFinite:crossing.every(p=>Number.isFinite(p.y)),
   noGroundingJumps:crossing.every((p,i)=>!i||Math.abs(p.y-crossing[i-1].y)<.55)};
 const save=async name=>{const data=await page.evaluate(()=>__qa.renderer.domElement.toDataURL().split(',')[1]);fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(data,'base64'));};
 await page.evaluate(()=>{const q=__qa;q.travel(0,120,0);advanceTime(100);q.view([19,7,142],[0,1,119]);});await save('bridge');
 for(const [name,day] of [['day',.38],['dusk',.92],['night',0]]){
  await page.evaluate(v=>{__qa.day(v);__qa.travel(-38,27,2);advanceTime(1800);},day);await save(name);
 }
 for(const tier of ['low','medium','high']){
  await page.evaluate(t=>{__qa.quality(t);__qa.day(.38);advanceTime(100);},tier);await save(tier);
 }
 const frames=await page.evaluate(async()=>{
  const deltas=[];let last=performance.now();resumeGame();
  for(let i=0;i<90;i++){await new Promise(requestAnimationFrame);const now=performance.now();if(i>10)deltas.push(now-last);last=now;}
  advanceTime(0);deltas.sort((a,b)=>a-b);return {medianMs:deltas[Math.floor(deltas.length*.5)],p95Ms:deltas[Math.floor(deltas.length*.95)]};
 });
 const report={checks,errors,terrain,bridge:{...bridge,first:crossing[0],last:crossing.at(-1)},frames};
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 await browser.close();if(errors.length||Object.values(checks).some(v=>!v))process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});

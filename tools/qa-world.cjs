/* Run against a local game server: node tools/qa-world.cjs [url].
   Debug access is injected only into the Playwright response, never the shipped game. */
const QA=require('./qa-platform.cjs');
const {chromium}=QA;
const fs=require('node:fs');
const path=require('node:path');
const url=process.argv[2]||QA.BASE+'/ranch3d.html?qa=world&emoji=0';   // ?qa exposes window.__features, which the layout checks and the Character screen close use
const out=path.resolve('output/world-validation');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--disable-background-timer-throttling',QA.ANGLE,'--enable-gpu-rasterization','--ignore-gpu-blocklist']});
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
 await page.waitForTimeout(2500);
 /* A fresh profile opens the Character screen over the game, and with it up the arrow keys drive the screen, not the horse:
    the bridge crossing below measured a horse standing still. Close it the way the player does. */
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
 await page.evaluate(async()=>{await window.__features?.photoscans?.ready;});
 await page.evaluate(()=>{__qa.day(.38);advanceTime(500);});
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
 /* The world as laid out: town arenas off every ranch a player can own, race legs off every build plot, nothing this
    package placed at install standing on a course, the Chalk Mare sited on fixed ground and nothing built across her
    viewing stone, and the lake's bottle off the race lines. Measured on the booted world, not on the source. */
 const layout=await page.evaluate(()=>{
  const G=window.__features,W=G.world,T=G.tables,R=G.ranch,P=G.worldPkg,V=G.vistas||{};
  const sd=(px,pz,ax,az,bx,bz)=>{const dx=bx-ax,dz=bz-az,l2=dx*dx+dz*dz||1e-6;let u=((px-ax)*dx+(pz-az)*dz)/l2;u=u<0?0:u>1?1:u;return Math.hypot(ax+dx*u-px,az+dz*u-pz);};
  const loops=new Set(T.EVENTS3.filter(e=>e&&(e.xc||e.gauntlet||e.kind==='gauntlet')).map(e=>e.route));
  const used=new Set(T.EVENTS3.map(e=>e.route).filter(Boolean));
  const legs=[];for(const k of used){const L=T.RACE_ROUTES[k];if(!Array.isArray(L))continue;for(let i=0;i<L.length-(loops.has(k)?0:1);i++)legs.push([k,i+1,L[i],L[(i+1)%L.length]]);}
  const plotHits=[];for(const [k,i,a,b] of legs)for(const sid in R.SLOTS){const q=R.SLOTS[sid],d=sd(q.x,q.z,a[0],a[1],b[0],b[1]);if(d<7.5)plotHits.push(k+i+':'+sid+'@'+d.toFixed(1));}
  const venueHits=[];for(const a of P.ARENAS){const inEl=(x,z,p)=>((x-a.x)/(20+p))**2+((z-a.z)/(15+p))**2<1||(Math.abs(x-a.x)<7+p&&z>a.z+18-p&&z<a.z+26+p);
   for(const sid in R.SLOTS){const q=R.SLOTS[sid];for(const [ox,oz] of [[0,0],[-6,-6],[6,-6],[-6,6],[6,6]])if(inEl(q.x+ox,q.z+oz,2)){venueHits.push(a.id+':'+sid);break;}}
   for(const r of R.RANCHES){const pa=r.past,b=r.barn;let hit=false;for(let x=pa.x1;x<=pa.x2&&!hit;x+=2)for(let z=pa.z1;z<=pa.z2&&!hit;z+=2)if(inEl(x,z,2))hit=true;for(let z=b.z0;z<=b.z0+b.step*b.n&&!hit;z+=1)if(inEl(b.x,z,2))hit=true;if(hit)venueHits.push(a.id+':'+r.id);}}
  let lo=1e9,hi=-1e9;const cw=P.ARENAS.find(a=>a.id==='cottonwood');for(const f of [0,0.5,1])for(let k=0;k<24;k++){const th=k/24*Math.PI*2,h=W.groundH(cw.x+Math.cos(th)*20*f,cw.z+Math.sin(th)*15*f);lo=Math.min(lo,h);hi=Math.max(hi,h);}
  const stone=W.things.find(t=>t.kind==='vista'&&t.id==='chalkmare');
  const stoneWall=stone?Math.min(...W.walls.map(w=>sd(stone.x,stone.z,w.x1,w.z1,w.x2,w.z2)),1e9):-1;
  const b8=P.BOTTLES.find(b=>b.id==='b8');const b8d=Math.min(...legs.map(([k,i,a,b])=>sd(b8.x,b8.z,a[0],a[1],b[0],b[1])));
  return {plotHits,venueHits,cottonwood:[cw.x,cw.z],cottonwoodFall:+(hi-lo).toFixed(2),conflicts:P.courseConflicts||[],scarp:V.SCARP?[V.SCARP.x,V.SCARP.z,!!V.SCARP.sited]:null,stone:stone?[stone.x,stone.z]:null,stoneWall:+stoneWall.toFixed(1),b8d:+b8d.toFixed(1)};
 });
 const checks={terrainMatchesMesh:terrain.maxError<.002,riverFlowsDownhill:terrain.riverMonotonic,
   channelBelowWater:terrain.minChannelDepth>.25,bridgeCrossed:crossing.at(-1).z>bridge.end+1,
   bridgeHeightFinite:crossing.every(p=>Number.isFinite(p.y)),
   noGroundingJumps:crossing.every((p,i)=>!i||Math.abs(p.y-crossing[i-1].y)<.55),
   characterScreenClosed:charClosed&&!(await charOn()),
   raceLegsClearOfPlots:layout.plotHits.length===0,townArenasOffRanches:layout.venueHits.length===0,
   cottonwoodRingUnderMetreAndAHalf:layout.cottonwoodFall<1.5,nothingPlacedOnACourse:layout.conflicts.length===0,
   chalkMareOnFixedGround:!!(layout.scarp&&layout.scarp[2]),nothingBuiltThroughTheViewingStone:layout.stoneWall>2,
   lakeBottleOffTheRaceLines:layout.b8d>6};
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
 const report={checks,errors,terrain,bridge:{...bridge,first:crossing[0],last:crossing.at(-1)},layout,frames};
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 /* One line per check in the fleet's PASS/FAIL protocol, so tools/qa-suite.cjs picks this script up and tallies it. */
 for(const [k,v] of Object.entries(checks))console.log((v?'PASS ':'FAIL ')+k);
 console.log((errors.length?'FAIL ':'PASS ')+'no page errors'+(errors.length?' — '+JSON.stringify(errors.slice(0,5)):''));
 await browser.close();if(errors.length||Object.values(checks).some(v=>!v))process.exitCode=1;
})().catch(e=>{console.error(e);console.log('FAIL qa-world ran to the end — '+String(e&&e.message||e).split('\n')[0]);process.exit(1);});   // exit: an open browser would otherwise keep node alive for ever

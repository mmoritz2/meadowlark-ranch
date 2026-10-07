// Ride the production horse toward, around and over an authored chest.
const fs=require('node:fs'),path=require('node:path');
const QA=require('./qa-platform.cjs');
const out=path.resolve(process.argv[2]||'output/discovery-riding');fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await QA.chromium.launch({headless:true,args:QA.gpuArgs()});try{
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await page.route('**/api/me',r=>r.fulfill({contentType:'application/json',body:'null'}));
 await page.route('**/ranch3d.html*',async r=>{const res=await r.fetch();await r.fulfill({response:res,body:(await res.text()).replace('const MERGE_STATS=mergeStatics();',`window.__propQA={THREE,scene,camera,renderer,composer,G,player,things,groundH,TACK,keys,step(dt){manualStepping=true;tick(dt)},day(t=.34,rain=false){dayT=t;weather.mode=rain?'rain':'clear';weather.timer=99999}};const MERGE_STATS=mergeStatics();`)});});
 await page.addInitScript(()=>{let seed=928471;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};});
 await page.goto(QA.BASE+'/ranch3d.html?qa=discovery',{timeout:120000});await page.waitForFunction(()=>window.__propQA?.G.horse.RIG().ready&&!document.getElementById('load'),null,{timeout:120000});
 await page.evaluate(async()=>{const q=__propQA;q.G.save.sync(s=>{s.qualityLocked=true;s.unlocked=s.unlocked||{};for(const r of q.G.tables.REGIONS)if(r.unlock)s.unlocked[r.id]=true;});q.G.wardrobe?.closeChar();q.G.hidePanels();await q.G.photoscans.ready;await q.G.worldDetails.ready;await q.G.world.ranchBuilderArt.ready;advanceTime(0);q.G.gfx.apply('high');});console.log('Discovery ready');

 const rows=await page.evaluate(()=>{const q=__propQA,T=q.THREE,t=q.things.find(t=>t.kind==='chest'&&t.id==='pines'),rows=[];t.g.updateWorldMatrix(true,true);const render=q.renderer.render;q.renderer.render=()=>{};
 try{for(const mode of ['approach','around','jump']){q.G.input.reset();q.G.riding.releaseAll();q.G.riding.selectGait(mode==='jump'?'canter':'walk');const start=t.g.localToWorld(new T.Vector3(mode==='around'?-1.5:0,0,mode==='jump'?3:2.2));q.player.pos.copy(start);q.player.heading=t.g.rotation.y+Math.PI;q.player.speed=q.player.y=q.player.vy=0;q.player.flying=false;q.player.onFoot=false;q.player.stam=1;q.G.followCam.reset();q.keys.KeyW=true;q.keys.Space=mode==='jump';let minZ=Infinity,maxY=0,maxGroundError=0,finite=true;const samples=[];
 for(let i=0;i<120;i++){q.day();q.step(1/30);if(i===0)q.keys.Space=false;const p=t.g.worldToLocal(q.player.pos.clone());minZ=Math.min(minZ,p.z);maxY=Math.max(maxY,q.player.y);maxGroundError=Math.max(maxGroundError,Math.abs(q.player.mesh.position.y-q.groundH(q.player.pos.x,q.player.pos.z)-q.player.y));finite=finite&&q.player.mesh.matrixWorld.elements.every(Number.isFinite);if(i%10===0)samples.push({x:p.x,z:p.z,y:q.player.y,speed:q.player.speed});}rows.push({mode,minZ,maxY,maxGroundError,finite,samples});q.keys.KeyW=false;q.keys.Space=false;}}
 finally{q.renderer.render=render;q.G.riding.releaseAll();}return rows;});
 const checks={approachStopped:rows[0].minZ>.85,aroundCleared:rows[1].minZ<-.9,jumpCleared:rows[2].minZ<-.9&&rows[2].maxY>.1,groundContact:rows.every(r=>r.maxGroundError<.001),finite:rows.every(r=>r.finite),noErrors:!errors.length};fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({rows,checks,errors},null,2));console.log(JSON.stringify({checks,rows,errors}));require('node:assert/strict')(Object.values(checks).every(Boolean),'Chest riding checks failed');

}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

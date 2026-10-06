/* Records a genuine keyboard-controlled Rush and visually checks a slower replay.
   Never writes player transforms, course indices, grades, or rewards. Disposable save; no WebSockets. */
const QA=require('./qa-platform.cjs'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const out=process.env.QA_OUT||path.join(os.tmpdir(),'meadowlark-ghost-keyboard');fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await QA.chromium.launch({headless:true,args:QA.gpuArgs()}),page=await browser.newPage({viewport:{width:1280,height:850}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.routeWebSocket('**',ws=>ws.close());
try{
 await page.goto(QA.BASE+'/ranch3d.html?qa=ghost-keyboard');await page.waitForFunction(()=>window.__features?.rushGhost&&!document.getElementById('load'),null,{timeout:150000});
 await page.evaluate(()=>{const G=__features;advanceTime(0);G.save.sync(s=>s.rider.made=true);G.wardrobe.closeChar();G.hidePanels();G.audio.setMuted(true);G.riding.releaseAll();window.step=ms=>{const render=G.renderer.render;G.renderer.render=function(s,c,...a){if(c!==G.camera)return render.call(this,s,c,...a)};try{advanceTime(ms)}finally{G.renderer.render=render}};step(200);});
 await page.waitForFunction(()=>__features.horse.RIG().ready&&!__features.horse.RIG().loadingBreed,null,{timeout:90000});
 assert.equal(await page.evaluate(()=>__features.ranchRush.start('rush-pasture')),true);await page.evaluate(()=>{step(4000);__features.riding.selectGait('canter')});
 let finish=null;
 for(let batch=0;batch<60;batch++){
  const state=await page.evaluate(()=>{
   const G=__features,P=G.horse.player,c=G.course.get();if(!c)return {done:true,result:G.ranchRush.lastResult,ghost:G.rushGhost.snapshot()};
   window.held=window.held||{};const key=(code,on)=>{if(held[code]!==on){held[code]=on;document.dispatchEvent(new KeyboardEvent(on?'keydown':'keyup',{code,key:code==='KeyW'?'w':code==='KeyA'?'a':code==='KeyD'?'d':'s',bubbles:true}))}};
   for(let i=0;i<30&&G.course.get()===c;i++){
    const j=c.jumps[c.idx];if(!j)break;
    const angle=Math.atan2(j.x-P.pos.x,j.z-P.pos.z),delta=Math.atan2(Math.sin(angle-P.heading),Math.cos(angle-P.heading));
    key('KeyA',delta>.045);key('KeyD',delta<-.045);key('KeyW',Math.abs(delta)<.7);key('KeyS',Math.abs(delta)>1.05&&P.speed>1.5);step(50);
   }
   return {done:!G.course.get(),index:c.idx,total:c.jumps.length,time:c.t,ghost:G.rushGhost.snapshot(),result:G.ranchRush.lastResult};
  });
  if(state.done){finish=state;break;}if(batch%10===0)console.log('recording',batch,state.index,state.time,state.ghost.recordedSamples);
 }
 assert.ok(finish?.result,'Keyboard ride reaches the real finish');assert.equal(finish.ghost.available.length,1,'Accepted fastest ride stores a replay');assert.ok(finish.ghost.available[0].points>30);
 const before=await page.evaluate(()=>JSON.stringify(__features.save.fresh().rushGhost.records));
 // The earlier automated key events leave screen-input's held-key safety latch set.
 // A real release is required before another run, just as for a player leaving a menu.
 for(const key of ['w','a','d','s'])await page.keyboard.up(key);
 await page.evaluate(()=>{__features.riding.releaseAll();window.held={};__features.rushGhost.setEnabled(true);});
 assert.equal(await page.evaluate(()=>__features.ranchRush.start('rush-pasture')),true);
 await page.evaluate(()=>{step(3200);__features.riding.selectGait('walk')});await page.keyboard.down('w');
 const playback=[];
 for(let i=0;i<4;i++){
  await page.evaluate(()=>step(1000));await page.evaluate(()=>advanceTime(0));const state=await page.evaluate(()=>({...__features.rushGhost.snapshot(),player:{x:__features.horse.player.pos.x,z:__features.horse.player.pos.z,speed:__features.horse.player.speed}}));playback.push(state);
  await page.screenshot({path:path.join(out,'ghost-replay-'+i+'.png')});
 }
 await page.keyboard.up('w');assert.ok(playback.some(s=>s.active?.visible&&s.position),'Own prior ride is visibly moving on the retry');
 assert.ok(playback[0].position&&playback[3].position&&Math.hypot(playback[0].position.x-playback[3].position.x,playback[0].position.z-playback[3].position.z)>2,'Ghost follows the recorded trajectory');
 assert.ok(Math.hypot(playback[0].player.x-playback[3].player.x,playback[0].player.z-playback[3].player.z)>1,'The slower retry also uses real riding movement');
 await page.evaluate(()=>{__features.course.cancelCourse();step(50)});
 assert.equal(await page.evaluate(()=>JSON.stringify(__features.save.fresh().rushGhost.records)),before,'Cancelled slower retry preserves the genuine best');
 const cleanup=await page.evaluate(()=>({ghost:__features.rushGhost.snapshot(),nodes:__features.scene.children.filter(o=>o.name==='Ranch Rush | your personal best').length}));
 assert.equal(cleanup.nodes,0);assert.equal(cleanup.ghost.active,null);assert.equal(errors.length,0);
 const report={method:'Keyboard steering only after normal marshal; slower keyboard retry',finish,playback,cleanup,errors};fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser.close()}
})().catch(error=>{console.error(error);process.exit(1)});

/* Complete Clover's route with ordinary riding keys after the normal mission marshal.
   Does not write position, heading, NPC state, rescue progress, or rewards. */
const QA=require('./qa-platform.cjs'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const out=process.env.QA_OUT||path.join(os.tmpdir(),'meadowlark-rescue-keyboard');fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await QA.chromium.launch({headless:true,args:QA.gpuArgs()}),p=await browser.newPage({viewport:{width:1280,height:850}}),errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error'&&/feature |hook /.test(m.text()))errors.push(m.text())});await p.routeWebSocket('**',ws=>ws.close());
try{await p.goto(QA.BASE+'/ranch3d.html?qa=rescue-keyboard');await p.waitForFunction(()=>window.__features?.rideHub&&!document.getElementById('load'),null,{timeout:150000});
await p.evaluate(()=>{const G=__features;advanceTime(0);G.save.sync(s=>s.rider.made=true);G.wardrobe.closeChar();G.hidePanels();G.audio.setMuted(true);G.riding.releaseAll();window.step=ms=>{const fn=G.renderer.render;G.renderer.render=function(s,c,...a){if(c!==G.camera)return fn.call(this,s,c,...a)};try{advanceTime(ms)}finally{G.renderer.render=fn}};step(200)});
await p.waitForFunction(()=>__features.horse.RIG().ready&&!__features.horse.RIG().loadingBreed,null,{timeout:90000});
await p.locator('#rushChoose').click();await p.evaluate(()=>advanceTime(0));await p.screenshot({path:path.join(out,'activities.png')});await p.locator('[data-fx="adventure:rescue"]').click();
let lastStage='',final,previous=null,stuck=0,reassured=false,farKeyChecked=false;
await p.evaluate(()=>{window.__rescueE=[];window.addEventListener('keydown',e=>{if(e.code==='KeyE')__rescueE.push({prevented:e.defaultPrevented,repeat:e.repeat});});});
for(let batch=0;batch<180;batch++){
 final=await p.evaluate(()=>{const G=__features,P=G.horse.player;window.held=window.held||{};const key=(code,on)=>{if(held[code]!==on){held[code]=on;window.dispatchEvent(new KeyboardEvent(on?'keydown':'keyup',{code,bubbles:true}))}};
  for(let i=0;i<30;i++){
   const a=G.rescueRide.snapshot().active;if(!a)break;
   if(a.stage==='calm'&&a.interaction?.eligible){for(const code of ['KeyA','KeyD','KeyW','KeyS'])key(code,false);break;}
   const t=a.horse.waiting?{x:a.horse.x,z:a.horse.z}:a.target,distance=Math.hypot(t.x-P.pos.x,t.z-P.pos.z),angle=Math.atan2(t.x-P.pos.x,t.z-P.pos.z),delta=Math.atan2(Math.sin(angle-P.heading),Math.cos(angle-P.heading));
   const halt=a.stage==='calm'?distance<4:a.stage==='escort'?distance<3:distance<1.5;
   G.riding.selectGait(a.stage==='find'&&distance>14?'canter':a.stage==='escort'&&distance>12&&a.horse.distance<14?'trot':'walk');
   key('KeyA',!halt&&delta>.04);key('KeyD',!halt&&delta<-.04);key('KeyW',!halt&&Math.abs(delta)<.7);key('KeyS',(halt||Math.abs(delta)>1)&&P.speed>1.2);step(50);
  }
  return {rescue:G.rescueRide.snapshot(),player:{x:P.pos.x,z:P.pos.z,speed:P.speed},body:document.body.className};
 });
 const a=final.rescue.active,stage=a?`${a.stage}-${a.clues}-${a.returnStep}`:'finished';
 if(a?.stage==='calm'&&!a.interaction?.inReach&&!farKeyChecked){
  await p.keyboard.press('e');const last=await p.evaluate(()=>__rescueE.at(-1));assert.equal(last?.prevented,false,'E outside Clover’s reach must remain available to the world');farKeyChecked=true;
 }
 if(a?.stage==='calm'&&a.interaction?.eligible&&!reassured){
  for(const [width,height] of [[390,844],[320,844],[844,390],[667,375]]){
   await p.setViewportSize({width,height});await p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await p.evaluate(()=>{step(250);advanceTime(0)});
   const layout=await p.evaluate(()=>{
    const rect=id=>{const e=document.getElementById(id);if(!e||!e.offsetWidth||!e.offsetHeight)return null;const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,height:r.height};};
    return {hud:rect('rescueHud'),action:rect('rescueReassure'),controls:['seRidePace','seJump','stickZone','mini','seMenuBtn','wallet'].map(rect).filter(Boolean)};
   });
   const h=layout.hud;assert(h&&h.left>=0&&h.right<=width+1&&h.top>=0&&h.bottom<=height+1,'Reassurance HUD fits '+width+'x'+height);
   assert(layout.action?.height>=44,'Reassure action is thumb-sized');
   assert(!layout.controls.some(r=>h.left<r.right-1&&h.right>r.left+1&&h.top<r.bottom-1&&h.bottom>r.top+1),'Reassurance HUD clears riding controls at '+width+'x'+height);
   await p.screenshot({path:path.join(out,`reassure-${width}x${height}.png`)});
  }
  await p.setViewportSize({width:1280,height:850});await p.evaluate(()=>advanceTime(0));await p.screenshot({path:path.join(out,'reassure-ready.png')});
  await p.keyboard.down('e');assert.equal(await p.evaluate(()=>__features.rescueRide.snapshot().active?.stage),'escort','Physical E key starts the escort');
  await p.keyboard.down('e');await p.keyboard.up('e');
  const last=await p.evaluate(()=>__rescueE.slice(-2));assert(last.every(e=>e.prevented)&&last[1].repeat,'Held reassurance stays owned after the stage changes');
  reassured=true;console.log('PASS nearby E reassurance, held-key ownership, distant world E, and four mobile layouts');
 }

 if(stage!==lastStage){lastStage=stage;console.log(batch,stage,JSON.stringify(final));await p.evaluate(()=>advanceTime(0));await p.screenshot({path:path.join(out,stage+'.png')});}
 if(!a)break;
 const pos=final.player;if(a.stage!=='calm'&&pos.speed>2&&previous&&Math.hypot(pos.x-previous.x,pos.z-previous.z)<.1)stuck++;else stuck=0;previous=pos;
 if(stuck>=4){await p.evaluate(()=>advanceTime(0));await p.screenshot({path:path.join(out,'blocked.png')});throw new Error('Physical route blocked at '+JSON.stringify(final));}
 if(batch%30===0)console.log('progress',batch,JSON.stringify(final));
}
await p.evaluate(()=>{__features.riding.releaseAll();advanceTime(0)});await p.waitForTimeout(150);await p.evaluate(()=>advanceTime(0));await p.screenshot({path:path.join(out,'homecoming.png')});
const report={method:'Steering keyboard events through the real controller; physical Playwright E reassurance; no position/actor/progress injection',reassured,farKeyChecked,...final,errors};fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));assert.equal(errors.length,0);assert.ok(final.rescue.lastResult,'Clover must physically come home through normal riding controls');assert.equal(final.rescue.records.completions,1);assert(reassured&&farKeyChecked);
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});

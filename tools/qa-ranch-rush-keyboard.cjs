/* Steers through every Rush with ordinary keyboard inputs after the game's marshal.
   Never writes position, heading, speed, jump age, grades or course progress.
   Detects physical route blockers that scripted crossing tests cannot. */
const QA=require('./qa-platform.cjs');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const out=process.env.QA_OUT||path.join(os.tmpdir(),'meadowlark-rush-keyboard');fs.mkdirSync(out,{recursive:true});
(async()=>{const b=await QA.chromium.launch({headless:true,args:QA.gpuArgs()}),p=await b.newPage({viewport:{width:1280,height:850}});const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.routeWebSocket('**',w=>w.close());
try{await p.goto(QA.BASE+'/ranch3d.html?qa=rush-keyboard');await p.waitForFunction(()=>window.__features?.ranchRushUI&&!document.getElementById('load'),null,{timeout:150000});
await p.evaluate(()=>{const G=__features;advanceTime(0);G.save.sync(s=>s.rider.made=true);G.wardrobe.closeChar();G.hidePanels();G.audio.setMuted(true);G.riding.releaseAll();window.step=ms=>{let f=G.renderer.render;G.renderer.render=function(scene,cam,...a){if(cam!==G.camera)return f.call(this,scene,cam,...a)};try{advanceTime(ms)}finally{G.renderer.render=f}};step(200)});
await p.evaluate(()=>advanceTime(0));await p.screenshot({path:path.join(out,'free.png')});await p.locator('#rushChoose').click();await p.evaluate(()=>advanceTime(0));await p.screenshot({path:path.join(out,'picker.png')});
let results=[];
for(const id of (process.env.RUSH_IDS||'rush-pasture,rush-river,rush-trail').split(',')){await p.evaluate(()=>__features.ranchRushUI.open());await p.locator(`[data-fx="rush:start:${id}"]`).click();await p.evaluate(()=>{step(4000);__features.riding.selectGait('canter')});await p.waitForFunction(()=>__features.horse.RIG().heroMotion&&__features.horse.RIG().ready,null,{timeout:90000});
let ended=false;
for(let batch=0;batch<50;batch++){
 const state=await p.evaluate(()=>{
  const G=__features,P=G.horse.player,c=G.course.get();if(!c)return {done:true,result:G.ranchRush.lastResult};
  window.held=window.held||{};const key=(code,on)=>{if(held[code]===on)return;held[code]=on;window.dispatchEvent(new KeyboardEvent(on?'keydown':'keyup',{code,bubbles:true}))};
  let maxSpeed=0;
  for(let n=0;n<40&&G.course.get()===c;n++){
   const j=c.jumps[c.idx];if(!j)break;let x=j.x,z=j.z;
   if(j.kind==='fence'){
    const sn=Math.sin(j.rotY),cs=Math.cos(j.rotY),along=(P.pos.x-j.x)*sn+(P.pos.z-j.z)*cs,lateral=(P.pos.x-j.x)*cs-(P.pos.z-j.z)*sn;
    if(along< -8&&Math.abs(lateral)>1){x-=sn*8;z-=cs*8;}
   }
   const angle=Math.atan2(x-P.pos.x,z-P.pos.z),delta=Math.atan2(Math.sin(angle-P.heading),Math.cos(angle-P.heading));
   key('KeyA',delta>.045);key('KeyD',delta<-.045);key('KeyW',Math.abs(delta)<.7);key('KeyS',Math.abs(delta)>1.05&&P.speed>1.5);
   const distance=Math.hypot(j.x-P.pos.x,j.z-P.pos.z);key('Space',j.kind==='fence'&&distance<Math.max(4,Math.abs(P.speed)*.8)&&Math.abs(delta)<.18&&G.horse.RIG().heroJumpAge==null);
   step(50);maxSpeed=Math.max(maxSpeed,P.speed);
  }
  return {done:!G.course.get(),index:c.idx,total:c.jumps.length,position:[P.pos.x,P.pos.z],speed:P.speed,maxSpeed,elapsed:c.t,grades:c.ce.grades,active:G.ranchRush.snapshot().active,result:G.ranchRush.lastResult};
 });
 if(batch===2||batch===8){await p.evaluate(()=>advanceTime(0));await p.screenshot({path:path.join(out,`${id}-${batch}.png`)});}
 if(state.done){ended=true;results.push({id,method:'Keyboard input only after course marshal',...state});break;}
 if(batch%10===0)console.log(id,batch,JSON.stringify(state));
 }
 if(!ended){results.push({id,failed:true,state:await p.evaluate(()=>__features.ranchRush.snapshot())});break;}
 await p.evaluate(()=>{__features.riding.releaseAll();window.held={}});await p.waitForTimeout(100);await p.evaluate(()=>advanceTime(0));await p.screenshot({path:path.join(out,`${id}-result.png`)});
}
console.log(JSON.stringify({results,errors},null,2));fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({results,errors},null,2));
assert.equal(errors.length,0,'No browser errors');for(const r of results){assert.ok(!r.failed&&r.result?.id===r.id,r.id+' must finish with keyboard steering');assert.equal(r.result.gates+r.result.cleanJumps,r.total,r.id+' clears every gate and log');}
}finally{await b.close()}})().catch(e=>{console.error(e);process.exit(1)});

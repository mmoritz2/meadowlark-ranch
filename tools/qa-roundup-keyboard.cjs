/* Keyboard-driven herding smoke test. Reads live horse positions, never writes them,
   course progress, rewards, player position or heading. Uses a disposable offline save. */
const QA=require('./qa-platform.cjs'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const out=process.env.QA_OUT||path.join(os.tmpdir(),'meadowlark-roundup-keyboard');fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await QA.chromium.launch({headless:true,args:QA.gpuArgs()}),p=await browser.newPage({viewport:{width:1280,height:850}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.routeWebSocket('**',ws=>ws.close());
try{await p.goto(QA.BASE+'/ranch3d.html?qa=roundup-keyboard');await p.waitForFunction(()=>window.__features?.roundup&&!document.getElementById('load'),null,{timeout:150000});
await p.evaluate(async()=>{const G=__features;advanceTime(0);G.save.sync(s=>s.rider.made=true);G.wardrobe.closeChar();G.hidePanels();G.audio.setMuted(true);G.riding.releaseAll();window.step=ms=>{const fn=G.renderer.render;G.renderer.render=function(s,c,...a){if(c!==G.camera)return fn.call(this,s,c,...a)};try{advanceTime(ms)}finally{G.renderer.render=fn}};if(!G.roundupUI)(await import('./assets/features/roundup-upgrade.js?qa=1')).install(G);step(200);});
await p.waitForFunction(()=>__features.horse.RIG().ready&&!__features.horse.RIG().loadingBreed,null,{timeout:90000});
assert.equal(await p.evaluate(()=>__features.roundup.start('beginner')),true);
await p.evaluate(()=>step(3300));
let result;
for(let batch=0;batch<140;batch++){
 result=await p.evaluate(()=>{
  const G=__features,P=G.horse.player;window.held=window.held||{};const key=(code,on)=>{if(held[code]!==on){held[code]=on;document.dispatchEvent(new KeyboardEvent(on?'keydown':'keyup',{code,key:code==='KeyW'?'w':code==='KeyA'?'a':code==='KeyD'?'d':'s',bubbles:true}))}};
  for(let i=0;i<20;i++){
   const s=G.roundup.state();if(!s.active)break;
   const h=s.target;if(!h)break;
   const dx=s.pen.x-h.x,dz=s.pen.z-h.z,l=Math.hypot(dx,dz),ux=dx/l,uz=dz/l;
   const pdx=P.pos.x-h.x,pdz=P.pos.z-h.z,along=pdx*ux+pdz*uz,side=pdx*(-uz)+pdz*ux;
   let x=h.standX,z=h.standZ;
   // Approach around the outside if ahead of the loose horse, so it is not chased away from its pen.
   if(along>-5){const sign=Math.sign(side)||1;x=h.x-ux*8-uz*sign*17;z=h.z-uz*8+ux*sign*17;}
   const distance=Math.hypot(x-P.pos.x,z-P.pos.z),angle=Math.atan2(x-P.pos.x,z-P.pos.z),delta=Math.atan2(Math.sin(angle-P.heading),Math.cos(angle-P.heading));
   G.riding.selectGait(distance>15?'trot':'walk');
   key('KeyA',delta>.035);key('KeyD',delta<-.035);key('KeyW',Math.abs(delta)<.6&&distance>.8);key('KeyS',Math.abs(delta)>1&&P.speed>1.2);
   step(50);
  }
  return {state:G.roundup.state(),player:{x:P.pos.x,z:P.pos.z,speed:P.speed},result:G.roundup.state().lastResult};
 });
 if(batch===3||batch===20){await p.evaluate(()=>advanceTime(0));await p.screenshot({path:path.join(out,'herding-'+batch+'.png')});}
 if(!result.state.active)break;
 if(batch%20===0)console.log(batch,JSON.stringify({time:result.state.timeLeft,penned:result.state.penned,target:result.state.target,player:result.player}));
}
await p.evaluate(()=>{__features.riding.releaseAll();advanceTime(0)});await p.waitForTimeout(100);await p.screenshot({path:path.join(out,'result.png')});
const report={method:'Keyboard inputs only after normal roundup marshal',...result,errors};fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));assert.equal(errors.length,0);assert.equal(result.state.active,false);assert.equal(result.result?.penned,3,'Beginner herd must be brought home using ordinary riding controls');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});

/* On foot (assets/features/on-foot.js): getting off the horse and walking about.

   Boots the game and does what a player does: the saddle button to get off, W to walk, Shift to
   jog, Space (nothing: she cannot jump), the whistle to call the horse over, E at the horse to get
   back on, F off and on again, the saddle button from thirty metres (whistle, then up when it
   arrives), a different horse picked while on foot (up on the new one), and the Horse Overview on
   foot (it shows the parked horse, and RIDE gets her up).

   Usage:  QA_PORT=8431 NODE_PATH=$(npm root -g) node tools/qa-on-foot.cjs */
const QA=require('./qa-platform.cjs');
const {chromium}=QA;
const url=QA.BASE+'/ranch3d.html?qa=on-foot&fresh='+Date.now();
const checks=[];
function check(name,ok,detail){checks.push({name,ok:!!ok,detail});console.log((ok?'PASS ':'FAIL ')+name+(detail!==undefined?' — '+JSON.stringify(detail):''));}
let browser=null;
setTimeout(async()=>{console.error('WATCHDOG: no result after 400 s');try{if(browser)await browser.close();}catch(e){}process.exit(3);},400000).unref();
(async()=>{
 browser=await chromium.launch({headless:true,args:['--disable-background-timer-throttling',QA.ANGLE,'--enable-gpu-rasterization','--ignore-gpu-blocklist']});
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 const errors=[];
 page.on('pageerror',e=>errors.push('PAGEERROR '+e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 page.on('dialog',d=>{d.dismiss().catch(()=>{});});
 await page.goto(url,{waitUntil:'load',timeout:120000});
 await page.waitForFunction(()=>window.render_game_to_text&&(()=>{try{const s=JSON.parse(render_game_to_text());return s.graphics&&s.graphics.horseReady&&!s.graphics.horseLoading;}catch(e){return false;}})(),null,{timeout:180000,polling:250});
 const r=await page.evaluate(async()=>{
  const G=window.__features,out={},p=G.horse.player,F=G.onFoot,T=G.THREE;
  const frames=n=>new Promise(res=>{let k=0;const f=()=>{if(++k>=n)res();else requestAnimationFrame(f);};requestAnimationFrame(f);});
  const wait=ms=>new Promise(res=>setTimeout(res,ms));
  const key=(c,d)=>window.dispatchEvent(new KeyboardEvent(d?'keydown':'keyup',{code:c,key:c,bubbles:true}));
  const tap=async c=>{key(c,true);await frames(2);key(c,false);await frames(2);};
  const inScene=o=>{let q=o;while(q){if(q===G.scene)return true;q=q.parent;}return false;};
  const d2=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
  out.installed=G.installed.includes('on-foot')&&!!F&&!!document.getElementById('seMount');
  out.errors=G.errors.slice();
  await frames(20);
  /* 1. off */
  const at0={x:p.pos.x,z:p.pos.z};
  document.getElementById('seMount').click(); await frames(10);
  const hs=F.horse(), W=F.walker();
  out.off={on:F.on,flag:p.onFoot===true,body:document.body.classList.contains('on-foot'),horse:!!hs,horseAtStop:hs?+d2(hs,at0).toFixed(2):null,
   riderInWalker:!!(W&&p.rider&&p.rider.g.parent===W),meshHidden:p.mesh.visible===false,walkerShown:!!(W&&W.visible&&inScene(W)),
   stepped:+d2(p.pos,at0).toFixed(2),prompt:G.world.things.some(t=>t.kind==='mount'),
   jumpHidden:(()=>{const e=document.getElementById('seJump');return !e||getComputedStyle(e).display==='none';})()};
  /* 2. walk, jog, and no jump */
  const a0={x:p.pos.x,z:p.pos.z};
  key('KeyW',true); await wait(1400); await frames(2);
  out.walk={moved:+d2(p.pos,a0).toFixed(2),speed:+p.speed.toFixed(2),horseStayed:+d2(F.horse(),hs).toFixed(2)};
  key('ShiftLeft',true); await wait(1200); await frames(2);
  out.jog={speed:+p.speed.toFixed(2)};
  key('Space',true); await wait(500); out.jog.y=p.y; key('Space',false);
  key('ShiftLeft',false); key('KeyW',false); await wait(900); await frames(2);
  out.stop={speed:+p.speed.toFixed(2)};
  const cam=G.camera, Wn=F.walker();
  out.cam={dist:+Math.hypot(cam.position.x-Wn.position.x,cam.position.z-Wn.position.z).toFixed(2),above:+(cam.position.y-Wn.position.y).toFixed(2)};
  /* the rider really is standing: her hips well above her boots, both boots on the ground */
  { const R=p.rider,B=R.sk.by,h=new T.Vector3(),fl=new T.Vector3(),fr=new T.Vector3();
    B.hips.getWorldPosition(h);B.footL.getWorldPosition(fl);B.footR.getWorldPosition(fr);
    const gy=G.world.groundH(p.pos.x,p.pos.z);
    out.stand={hips:+(h.y-gy).toFixed(2),footL:+(fl.y-gy).toFixed(2),footR:+(fr.y-gy).toFixed(2)}; }
  /* 3. the whistle calls the parked horse to her */
  const far0=+d2(F.horse(),p.pos).toFixed(2);
  await tap('KeyH'); out.call={far0,calling:F.state().calling};
  for(let i=0;i<40&&F.state().calling;i++)await wait(150);
  out.call.after=+d2(F.horse(),p.pos).toFixed(2); out.call.done=!F.state().calling;
  /* 4. E at the horse: back in the saddle */
  const horseGroup=F.horse().group, nCols=()=>G.world.colliders.filter(c=>c.onFoot).length;
  await frames(4); await tap('KeyE'); await frames(6);
  out.onE={on:F.on,flag:!!p.onFoot,riderOnMount:!!(p.rider&&p.rider.g.parent===p.mesh),meshShown:p.mesh.visible!==false,
   horseGone:!inScene(horseGroup),cols:nCols(),prompt:G.world.things.some(t=>t.kind==='mount'),body:document.body.classList.contains('on-foot')};
  /* 5. F off and F on again */
  await tap('KeyF'); await frames(6); const fOff=F.on;
  await tap('KeyF'); await frames(6);
  out.f={off:fOff,onAgain:!F.on};
  /* 6. the saddle button from thirty metres: she whistles, it comes, she is up */
  document.getElementById('seMount').click(); await frames(6);
  const hz=F.horse(); p.pos.x=hz.x+22; p.pos.z=hz.z+20; await frames(6);
  document.getElementById('seMount').click(); await frames(4);
  out.far={calling:F.state().calling,dist0:+d2(F.horse(),p.pos).toFixed(1)};
  for(let i=0;i<80&&F.on;i++)await wait(150);
  out.far.mounted=!F.on;
  /* 7. a different horse chosen while on foot: she goes straight up on it */
  G.save.sync(s=>{G.horse.grantHorse(s,'palomino');}); G.horse.reloadHorses(); await frames(20);
  document.getElementById('seMount').click(); await frames(8);
  const ri0=G.horse.rideIdx(), other=G.horse.myHorses.findIndex((h,i)=>i!==ri0&&!h.foal);
  const sel=document.getElementById('horseSel'); sel.value=String(other); sel.onchange(); await frames(20);
  out.swap={other,ride:G.horse.rideIdx(),mounted:!F.on,riderOnMount:!!(p.rider&&p.rider.g.parent===p.mesh),meshShown:p.mesh.visible!==false};
  /* 8. the Horse Overview on foot shows the horse she left, and RIDE puts her up */
  document.getElementById('seMount').click(); await frames(8);
  const hv=F.horse(); p.pos.x=hv.x+6; p.pos.z=hv.z+6; await frames(6);
  document.getElementById('careBtn').click(); await frames(30);
  const ov=G.seCare&&G.seCare.state().open;
  const camToHorse=Math.hypot(cam.position.x-hv.x,cam.position.z-hv.z), camToHer=Math.hypot(cam.position.x-p.pos.x,cam.position.z-p.pos.z);
  /* and it is looking at the horse, not at her: the angle off the lens axis to each */
  const fw=new T.Vector3(); cam.getWorldDirection(fw);
  const off=(x,z)=>{const v=new T.Vector3(x-cam.position.x,0,z-cam.position.z).normalize();const f=new T.Vector3(fw.x,0,fw.z).normalize();return Math.acos(Math.max(-1,Math.min(1,v.dot(f))))*180/Math.PI;};
  const angHorse=off(hv.x,hv.z), angHer=off(p.pos.x,p.pos.z);
  document.querySelector('#seOv [data-se="ride"]').click(); await frames(10);
  out.overview={open:ov,camToHorse:+camToHorse.toFixed(1),camToHer:+camToHer.toFixed(1),angHorse:+angHorse.toFixed(1),angHer:+angHer.toFixed(1),mounted:!F.on,closed:!G.seCare.state().open};
  return out;
 });
 check('on-foot installed, no package errors',r.installed&&r.errors.length===0,{errors:r.errors});
 check('the saddle button gets her off: rider in her own group, horse parked where she stopped, mount hidden, jump button hidden',
  r.off.on&&r.off.flag&&r.off.body&&r.off.horse&&r.off.horseAtStop<0.05&&r.off.riderInWalker&&r.off.meshHidden&&r.off.walkerShown&&r.off.stepped>0.8&&r.off.stepped<1.4&&r.off.prompt&&r.off.jumpHidden,r.off);
 check('W walks her at walking pace and the horse stays put',r.walk.moved>1.2&&r.walk.speed>1.2&&r.walk.speed<1.6&&r.walk.horseStayed<0.05,r.walk);
 check('Shift jogs, Space does not jump, and she stops when the keys come up',r.jog.speed>2.6&&r.jog.speed<3.4&&r.jog.y===0&&Math.abs(r.stop.speed)<0.1,{jog:r.jog,stop:r.stop});
 check('she is standing: hips about a metre up, both boots on the ground',r.stand.hips>0.7&&r.stand.hips<1.15&&Math.min(r.stand.footL,r.stand.footR)>0.03&&Math.max(r.stand.footL,r.stand.footR)<0.2,r.stand);
 check('the camera follows her on foot from a few metres back',r.cam.dist>2&&r.cam.dist<4.5&&r.cam.above>1&&r.cam.above<2.6,r.cam);
 check('the whistle brings the parked horse to her',r.call.calling&&r.call.done&&r.call.after<r.call.far0&&r.call.after<3.4,r.call);
 check('E at the horse puts her back in the saddle and clears the parked horse away',!r.onE.on&&!r.onE.flag&&r.onE.riderOnMount&&r.onE.meshShown&&r.onE.horseGone&&r.onE.cols===0&&!r.onE.prompt&&!r.onE.body,r.onE);
 check('F gets her off and back on',r.f.off&&r.f.onAgain,r.f);
 check('the saddle button from thirty metres whistles the horse over and puts her up when it arrives',r.far.calling&&r.far.dist0>25&&r.far.mounted,r.far);
 check('picking another horse while on foot puts her straight up on it',r.swap.other>=0&&r.swap.ride===r.swap.other&&r.swap.mounted&&r.swap.riderOnMount&&r.swap.meshShown,r.swap);
 check('the Horse Overview on foot frames the parked horse, and RIDE gets her up',r.overview.open&&r.overview.angHorse<25&&r.overview.angHorse<r.overview.angHer&&r.overview.camToHorse<12&&r.overview.mounted&&r.overview.closed,r.overview);
 check('no page errors',errors.length===0,errors.slice(0,5));
 const bad=checks.filter(c=>!c.ok).length;
 console.log(bad?('FAILED '+bad+'/'+checks.length):('passed '+checks.length+'/'+checks.length));
 await browser.close(); process.exit(bad?1:0);
})().catch(async e=>{console.error(e);try{if(browser)await browser.close();}catch(x){}process.exit(2);});

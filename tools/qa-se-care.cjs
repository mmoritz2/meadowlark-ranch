/* The Horse Overview (assets/features/se-care.js).

   Boots the game, opens the overview the way a player does — the care button on the HUD — and
   proves what the screen is for: it opens full-screen over the real horse with the rider stepped
   out of shot and the camera on her, every tab draws, feeding from it goes through the game's own
   care code, My Horses switches the ridden horse, and closing it puts the rider, the camera and
   the HUD back. And that it took nothing away: G.ui.openCare still opens the old care panel with
   its buttons, which the rest of the game and the other suites rely on.

   Usage:  QA_PORT=8431 NODE_PATH=$(npm root -g) node tools/qa-se-care.cjs */
const QA=require('./qa-platform.cjs');
const {chromium}=QA;
const url=QA.BASE+'/ranch3d.html?qa=se-care&fresh='+Date.now();
const checks=[];
function check(name,ok,detail){checks.push({name,ok:!!ok,detail});console.log((ok?'PASS ':'FAIL ')+name+(detail!==undefined?' — '+JSON.stringify(detail):''));}
let browser=null;
setTimeout(async()=>{console.error('WATCHDOG: no result after 300 s');try{if(browser)await browser.close();}catch(e){}process.exit(3);},300000).unref();
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
  const G=window.__features,out={},frames=n=>new Promise(res=>{let k=0;const f=()=>{if(++k>=n)res();else requestAnimationFrame(f);};requestAnimationFrame(f);});
  const ov=document.getElementById('seOv'),p=G.horse.player,cam=G.camera;
  out.installed=G.installed.includes('se-care')&&!!ov&&!!G.seCare;
  out.errors=G.errors.slice();
  /* a second horse, so there is somebody to switch to */
  G.save.sync(s=>{G.horse.grantHorse(s,'grey');}); G.horse.reloadHorses(); await frames(10);
  const fov0=cam.fov, rider0=!!(p.rider&&p.rider.g&&p.rider.g.visible);
  /* 1. the care button opens it */
  document.getElementById('careBtn').click(); await frames(30);
  const care=document.getElementById('carePanel');
  out.open={on:ov.classList.contains('on'),state:G.seCare.state().open,body:document.body.classList.contains('se-ov-open'),
   oldPanel:care.style.display,riderHidden:!!(p.rider&&p.rider.g&&!p.rider.g.visible),fov:cam.fov,
   camDist:+Math.hypot(cam.position.x-p.pos.x,cam.position.z-p.pos.z).toFixed(2),
   name:(document.querySelector('#seOv .sv-name')||{}).textContent||'',stats:document.querySelectorAll('#seOv .sv-stat').length,
   hudHidden:(()=>{const e=document.getElementById('seHudRoot');return !e||getComputedStyle(e).display==='none';})()};
  /* 2. every tab draws something */
  out.tabs={};
  for(const b of document.querySelectorAll('#seOv .sv-tab')){b.click();await frames(2);const id=b.dataset.se.split(':')[1];
   out.tabs[id]={on:b.classList.contains('on'),body:(document.getElementById('seOvBody').textContent||'').trim().length};}
  /* 3. feeding goes through the game's own care code */
  document.querySelector('#seOv [data-se="tab:feeding"]').click(); await frames(2);
  const c0=(G.save.fresh().items||{}).carrot|0;
  const btn=document.querySelector('#seOv [data-se="care:carrot"]');
  if(btn){btn.click();await frames(5);}
  out.feed={button:!!btn,before:c0,after:(G.save.fresh().items||{}).carrot|0};
  /* 4. My Horses switches the ridden horse */
  document.querySelector('#seOv [data-se="tab:myhorses"]').click(); await frames(2);
  const ri0=G.horse.rideIdx(), cards=document.querySelectorAll('#seOv .sv-horse').length, rideBtns=[...document.querySelectorAll('#seOv [data-se^="ride:"]')];
  const target=rideBtns.length?+rideBtns[0].dataset.se.split(':')[1]:-1;
  if(rideBtns.length){rideBtns[0].click();await frames(40);}
  const s1=G.save.fresh();
  out.switch={cards,before:ri0,target,after:G.horse.rideIdx(),
   stillOpen:G.seCare.state().open,tab:G.seCare.state().tab,nameNow:((document.querySelector('#seOv .sv-name')||{}).textContent||'').replace('✎','').trim(),
   expect:s1.horses[G.horse.rideIdx()]&&s1.horses[G.horse.rideIdx()].name,riderHidden:!!(p.rider&&p.rider.g&&!p.rider.g.visible)};
  /* 5. Escape closes it and everything comes back */
  window.dispatchEvent(new KeyboardEvent('keydown',{code:'Escape',key:'Escape',bubbles:true})); await frames(10);
  out.closed={on:ov.classList.contains('on'),body:document.body.classList.contains('se-ov-open'),fov:cam.fov,fov0,
   rider:!!(p.rider&&p.rider.g&&p.rider.g.visible),rider0};
  /* 6. the old care panel is untouched */
  G.ui.openCare(); await frames(3);
  out.old={shown:care.style.display,cares:care.querySelectorAll('[data-care]').length,overlay:ov.classList.contains('on')};
  G.hidePanels();
  return out;
 });
 check('se-care installed, no package errors',r.installed&&r.errors.length===0,{errors:r.errors});
 check('the care button opens the Horse Overview full-screen, not the old panel',r.open.on&&r.open.state&&r.open.body&&r.open.oldPanel!=='flex',r.open);
 check('it frames the real horse: rider out of shot, camera on her at a portrait lens, HUD hidden',r.open.riderHidden&&Math.abs(r.open.fov-36)<0.5&&r.open.camDist>2.5&&r.open.camDist<14&&r.open.hudHidden,r.open);
 check('the Horse tab shows her name and the five stats',r.open.name.length>0&&r.open.stats===5,{name:r.open.name,stats:r.open.stats});
 check('all seven tabs draw',Object.keys(r.tabs).length===7&&Object.values(r.tabs).every(t=>t.on&&t.body>10),r.tabs);
 check('feeding a carrot from it goes through the game\'s care code',r.feed.button&&r.feed.after===r.feed.before-1,r.feed);
 check('My Horses switches the ridden horse and shows her',r.switch.cards>=2&&r.switch.target>=0&&r.switch.after===r.switch.target&&r.switch.after!==r.switch.before
  &&r.switch.stillOpen&&r.switch.tab==='horse'&&r.switch.nameNow===r.switch.expect&&r.switch.riderHidden,r.switch);
 check('Escape closes it and gives back the rider, the lens and the HUD',!r.closed.on&&!r.closed.body&&Math.abs(r.closed.fov-r.closed.fov0)<0.5&&r.closed.rider===r.closed.rider0,r.closed);
 check('G.ui.openCare still opens the old care panel with its buttons',r.old.shown==='flex'&&r.old.cares>3&&!r.old.overlay,r.old);
 check('no page errors',errors.length===0,errors.slice(0,5));
 const bad=checks.filter(c=>!c.ok).length;
 console.log(bad?('FAILED '+bad+'/'+checks.length):('passed '+checks.length+'/'+checks.length));
 await browser.close(); process.exit(bad?1:0);
})().catch(async e=>{console.error(e);try{if(browser)await browser.close();}catch(x){}process.exit(2);});

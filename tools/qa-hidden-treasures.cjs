/* The golden horseshoes (assets/features/hidden-treasures.js).

   Boots the game and proves: there are twelve, eight on the tops of rocks (well above the ground at
   their feet, so a climb is needed) and four out in water deep enough to swim; riding up to one does
   not pick it up (only on foot) but says how to reach it; on foot, beside one, she picks it up — it
   pays coins and gems, the count goes up, the horseshoe goes — and standing there longer pays
   nothing more; the three achievements are registered; the state says how many are found; and the
   find is in the save.

   Usage:  QA_PORT=8431 NODE_PATH=$(npm root -g) node tools/qa-hidden-treasures.cjs */
const QA=require('./qa-platform.cjs');
const {chromium}=QA;
const url=QA.BASE+'/ranch3d.html?qa=hidden-treasures&fresh='+Date.now();
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
 await page.waitForFunction(()=>{const R=window.__features.horse.player.rider;return R&&R.sk;},null,{timeout:60000,polling:250});
 const r=await page.evaluate(async()=>{
  const G=window.__features,p=G.horse.player,F=G.onFoot,W=G.world,out={};
  const frames=n=>new Promise(res=>{let k=0;const f=()=>{if(++k>=n)res();else requestAnimationFrame(f);};requestAnimationFrame(f);});
  const wait=ms=>new Promise(res=>setTimeout(res,ms));
  const toasts=[]; { const orig=G.toast; G.toast=m=>{toasts.push(String(m));return orig(m);}; }   // what the game says, as it says it
  const tEl=()=>toasts.join(' | ');
  out.installed=G.installed.includes('hidden-treasures')&&!!G.treasures;
  const spots=G.treasures.spots();
  const rocks=spots.filter(s=>s.kind==='rock'), water=spots.filter(s=>s.kind==='water');
  out.count={all:spots.length,rocks:rocks.length,water:water.length,
   rockRise:rocks.map(s=>+(s.y-W.groundH(s.x,s.z)).toFixed(2)),waterDepth:water.map(s=>+((F.waterAt(s.x,s.z)||{depth:0}).depth).toFixed(2))};
  /* on horseback beside the lake one: not picked up, and a hint */
  const lake=water.find(s=>s.id==='lake')||water[0];
  const s0=G.save.fresh(), c0=s0.coins, g0=s0.gems!=null?s0.gems:null;
  p.pos.x=lake.x+1.8; p.pos.z=lake.z; await frames(4); p.pos.x=lake.x+1.8; p.pos.z=lake.z; await wait(500);
  out.riding={found:G.treasures.spots().find(s=>s.id===lake.id).found,hint:/get off/i.test(tEl())};
  /* on foot, into the lake to it */
  F.dismount(); await frames(4);
  p.pos.x=lake.x; p.pos.z=lake.z; p.speed=0; await frames(3); p.pos.x=lake.x; p.pos.z=lake.z; await wait(700); await frames(2);
  const s1=G.save.fresh();
  out.foot={found:G.treasures.spots().find(s=>s.id===lake.id).found,coins:s1.coins-c0,gems:g0!=null?s1.gems-g0:null,mode:F.state().mode,
   hidden:(()=>{let g=null;G.scene.traverse(o=>{if(o.name==='Treasure | golden horseshoe'&&Math.abs(o.position.x-lake.x)<0.01&&Math.abs(o.position.z-lake.z)<0.01)g=o;});return g?!g.visible:null;})(),
   saved:!!(s1.treasure&&s1.treasure.found&&s1.treasure.found[lake.id])};
  await wait(900);
  out.again={coins:G.save.fresh().coins-c0};
  out.state=JSON.parse(render_game_to_text()).treasures;
  out.achs=['treasure12','climb5','swim100'].filter(id=>G.quest.ACHS.some(a=>a.id===id));
  return out;
 });
 check('hidden-treasures installed',r.installed);
 check('twelve golden horseshoes: eight high on rocks (a climb up) and four in water deep enough to swim',
  r.count.all===12&&r.count.rocks===8&&r.count.water===4&&r.count.rockRise.every(v=>v>1.4)&&r.count.waterDepth.every(v=>v>0.72),r.count);
 check('riding up to one does not pick it up, and says to get off',!r.riding.found&&r.riding.hint,r.riding);
 check('on foot beside one she picks it up: coins and gems paid, the horseshoe gone, the find saved',
  r.foot.found&&r.foot.coins===120&&(r.foot.gems===null||r.foot.gems===2)&&r.foot.hidden===true&&r.foot.saved,r.foot);
 check('standing there longer pays nothing more',r.again.coins===120,r.again);
 check('the state counts the finds, and the three achievements are registered',r.state&&r.state.found===1&&r.state.total===12&&r.achs.length===3,{state:r.state,achs:r.achs});
 check('no page errors',errors.length===0,errors.slice(0,5));
 const bad=checks.filter(c=>!c.ok).length;
 console.log(bad?('FAILED '+bad+'/'+checks.length):('passed '+checks.length+'/'+checks.length));
 await browser.close(); process.exit(bad?1:0);
})().catch(async e=>{console.error(e);try{if(browser)await browser.close();}catch(x){}process.exit(2);});

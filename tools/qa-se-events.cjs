/* The menus in the reference's frame (assets/features/se-frame.js) and Riding Events rebuilt as its
   towns and ticket carousel (assets/features/se-events.js).

   Boots the game and proves: the ☰ menu is a full screen of parchment tiles with the places to go,
   and its Events tile opens the new Events screen; that screen stands in for the events panel (the
   panel is open underneath, hidden, so every way in arrives here); it lists the towns, a card for
   every event plus the roundup and the drills at home, and arrows move the carousel; the pictures of
   the venues arrive; an event's page draws its course (five numbered fences for the Welcome Jump)
   and offers the three difficulties; Ride starts that event at that difficulty through the game's
   own entry button; the week's sheet claims a prize tier through the game's own claim; "All events"
   shows the full programme itself, framed; and a menu with tabs (the Journey) is framed with its
   tabs down the left and the shared strip across the top.

   Usage:  QA_PORT=8431 NODE_PATH=$(npm root -g) node tools/qa-se-events.cjs */
const QA=require('./qa-platform.cjs');
const {chromium}=QA;
const url=QA.BASE+'/ranch3d.html?qa=se-events&fresh='+Date.now();
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
 await page.waitForTimeout(1500);
 await page.evaluate(()=>{const c=document.getElementById('seChar');if(c&&c.classList.contains('on')&&window.__features.wardrobe)window.__features.wardrobe.closeChar();});
 const r=await page.evaluate(async()=>{
  const G=window.__features,$=id=>document.getElementById(id),out={};
  const wait=ms=>new Promise(res=>setTimeout(res,ms));
  const until=async(f,ms)=>{const t0=Date.now();while(Date.now()-t0<ms){try{if(f())return true;}catch(e){}await wait(80);}return false;};
  const vis=el=>{if(!el)return false;const cs=getComputedStyle(el),r=el.getBoundingClientRect();return cs.display!=='none'&&cs.visibility!=='hidden'&&r.width>0&&r.height>0;};   // fixed elements have no offsetParent
  out.installed=['se-frame','se-events'].every(id=>G.installed.includes(id))&&!!G.seFrame&&!!G.seEvents;
  /* the ☰ menu */
  $('seMenuBtn').click(); await wait(250);
  const menu=$('seMenu'), rect=menu.getBoundingClientRect();
  const tiles=[...menu.querySelectorAll('.se-tiles>button')].filter(vis).map(b=>b.dataset.semT);
  out.menu={full:rect.width>=innerWidth-2&&rect.height>=innerHeight-2,tiles,feat:!!menu.querySelector('.se-tiles>button.sem-feat'),bar:!!menu.querySelector('.sem-badge #semLv')};
  menu.querySelector('.se-tiles>[data-sem-main="events"]').click();
  await until(()=>G.seEvents.state.on,3000);
  const P=$('eventsPanel'), ev=$('seEv');
  out.cover={screen:vis(ev),panelOpen:P.style.display==='flex',panelHidden:getComputedStyle(P).opacity==='0',menuClosed:!menu.classList.contains('on'),hudHidden:getComputedStyle($('seHudRoot')).visibility==='hidden'};
  /* towns and cards */
  const towns=G.seEvents.towns(), T=G.tables, all=T.EVENTS3.filter(e=>!e.friendly).length;
  out.towns={names:towns.map(t=>t.name),cards:towns.reduce((a,t)=>a+t.evs.length,0),want:all+2,home:(towns.find(t=>t.name==='Meadowlark Ranch')||{evs:[]}).evs.map(e=>e.id)};
  const tabBtn=[...ev.querySelectorAll('.sev-tab')].find(b=>/cottonwood/i.test(b.textContent)); tabBtn.click(); await wait(150);
  const cards=()=>[...ev.querySelectorAll('.sev-card')];
  const cur=()=>{const c=cards().find(c=>c.style.getPropertyValue('--o').trim()==='0');return c&&c.dataset.ev;};
  const c0=cur(); window.dispatchEvent(new KeyboardEvent('keydown',{code:'ArrowRight',key:'ArrowRight',bubbles:true})); await wait(150); const c1=cur();
  window.dispatchEvent(new KeyboardEvent('keydown',{code:'ArrowLeft',key:'ArrowLeft',bubbles:true})); await wait(150); const c2=cur();
  out.carousel={town:G.seEvents.state.townName,n:cards().length,c0,c1,c2,tickets:ev.querySelectorAll('.sev-card .sev-tk>svg').length,rings:ev.querySelectorAll('.sev-card .sev-ring').length};
  out.photos=await until(()=>[...ev.querySelectorAll('.sev-photo img')].some(i=>i.classList.contains('se-snapped')&&i.naturalWidth>0),6000);
  /* the Welcome Jump's page */
  G.seEvents.openPage('h1'); await wait(100);
  const mapOk=await until(()=>{const s=$('sevCourse');return s&&s.querySelectorAll('circle').length>=5;},6000);
  out.page={open:ev.classList.contains('page'),map:mapOk,fences:$('sevCourse')?$('sevCourse').querySelectorAll('circle').length:0,diffs:ev.querySelectorAll('.sev-diff').length,
   title:ev.querySelector('.sev-ptitle')&&ev.querySelector('.sev-ptitle').textContent,ride:!!ev.querySelector('[data-sev="ride"]:not([disabled])')};
  /* Escape on the page goes back to the carousel, the screen stays */
  window.dispatchEvent(new KeyboardEvent('keydown',{code:'Escape',key:'Escape',bubbles:true})); await wait(150);
  out.escBack={page:ev.classList.contains('page'),on:G.seEvents.state.on};
  /* Ride at Novice: the programme's own entry button starts the course */
  G.seEvents.openPage('h1'); await wait(80);
  ev.querySelector('[data-sev="diff:0"]').click(); await wait(80);
  ev.querySelector('[data-sev="ride"]').click();
  const started=await until(()=>!!G.course.get(),4000);
  const c=G.course.get();
  out.ride={started,ev:c&&(c.ev?c.ev.id:c.id),diff:G.save.fresh().evDiff,screenGone:!G.seEvents.state.on};
  try{G.course.cancelCourse();}catch(e){}
  await until(()=>!G.course.get(),3000); await wait(300);
  /* the week's prize tier, claimed through the game's own claim */
  G.save.sync(s=>{s.weekly=s.weekly||{};s.weekly.rib=Object.assign({},s.weekly.rib,{h1:4});s.weekly.claimed={};});
  $('eventsBtn').click(); await until(()=>G.seEvents.state.on,3000); await wait(200);
  const coins0=G.save.fresh().coins;
  ev.querySelector('[data-sev="week"]').click(); await wait(150);
  const sheetOpen=ev.classList.contains('sheet'), claim=ev.querySelector('[data-sev="wk:0"]');
  if(claim)claim.click(); await wait(400);
  const s1=G.save.fresh();
  out.week={sheetOpen,claim:!!claim,claimed:!!(s1.weekly&&s1.weekly.claimed&&s1.weekly.claimed[0]),coins:s1.coins-coins0,featured:ev.querySelectorAll('.sev-fe>div').length};
  ev.querySelector('[data-sev="sheetx"]').click(); await wait(100);
  /* All events: the programme itself, framed */
  ev.querySelector('[data-sev="classic"]').click(); await wait(250);
  out.classic={framed:P.classList.contains('se-fr'),visible:getComputedStyle(P).opacity!=='0',screen:G.seEvents.state.on,strip:vis($('seFrameTop'))};
  window.dispatchEvent(new KeyboardEvent('keydown',{code:'Escape',key:'Escape',bubbles:true})); await wait(250);
  out.closed={panel:P.style.display,screen:G.seEvents.state.on,hud:getComputedStyle($('seHudRoot')).visibility};
  /* a menu with tabs, framed */
  $('questBtn').click(); await wait(300);
  const Q=$('questPanel'), tabs=[...Q.querySelectorAll('.mk-panel-body>.crow>.tabbtn')];
  out.frame={framed:Q.classList.contains('se-fr'),tabsLeft:Q.classList.contains('se-fr-tabs'),split:tabs.length>3&&tabs.every(b=>b.dataset.seL),col:tabs[0]?Math.round(tabs[0].getBoundingClientRect().left):null,
   title:$('seFrameTop').querySelector('.se-ttl-b').textContent,strip:vis($('seFrameTop'))};
  window.dispatchEvent(new KeyboardEvent('keydown',{code:'Escape',key:'Escape',bubbles:true})); await wait(250);
  out.frameClosed={panel:Q.style.display,strip:vis($('seFrameTop'))};
  return out;
 });
 check('se-frame and se-events installed',r.installed);
 check('the ☰ menu is a full screen of parchment tiles with the places to go',r.menu.full&&r.menu.feat&&r.menu.bar&&['Market','My Horses','Events','Journey','Season Pass','Horse Care','Leaderboards','Riding Club'].every(t=>r.menu.tiles.includes(t)),r.menu);
 check('its Events tile opens the new Events screen, standing in for the events panel (open underneath, hidden)',r.cover.screen&&r.cover.panelOpen&&r.cover.panelHidden&&r.cover.menuClosed&&r.cover.hudHidden,r.cover);
 check('the towns, and a card for every event plus the roundup and the drills at home',r.towns.names.length>=5&&r.towns.names.includes('Cottonwood')&&r.towns.cards===r.towns.want&&r.towns.home.includes('__roundup')&&r.towns.home.includes('__drill'),r.towns);
 check('each card is a ticket and a ring; the arrow keys move the carousel',r.carousel.town==='Cottonwood'&&r.carousel.n>=3&&r.carousel.tickets===r.carousel.n&&r.carousel.rings===r.carousel.n&&r.carousel.c1&&r.carousel.c1!==r.carousel.c0&&r.carousel.c2===r.carousel.c0,r.carousel);
 check('the venue photographs arrive',r.photos);
 check('an event\'s page draws its course (five numbered fences for the Welcome Jump) and offers the three difficulties',r.page.open&&r.page.map&&r.page.fences===5&&r.page.diffs===3&&/show jumping/i.test(r.page.title||'')&&r.page.ride,r.page);
 check('Escape on the page goes back to the carousel',!r.escBack.page&&r.escBack.on,r.escBack);
 check('Ride starts that event at that difficulty through the game\'s own entry button',r.ride.started&&r.ride.ev==='h1'&&r.ride.diff===0&&r.ride.screenGone,r.ride);
 check('the week\'s sheet claims a prize tier through the game\'s own claim',r.week.sheetOpen&&r.week.claim&&r.week.claimed&&r.week.coins>=200&&r.week.featured>=1,r.week);
 check('"All events" shows the full programme itself, framed, and Escape closes everything',r.classic.framed&&r.classic.visible&&!r.classic.screen&&r.classic.strip&&r.closed.panel==='none'&&!r.closed.screen&&r.closed.hud!=='hidden',{classic:r.classic,closed:r.closed});
 check('a menu with tabs is framed: tabs down the left, the shared strip across the top',r.frame.framed&&r.frame.tabsLeft&&r.frame.split&&r.frame.col===0&&r.frame.title==='My Journey'&&r.frame.strip&&r.frameClosed.panel==='none'&&!r.frameClosed.strip,{frame:r.frame,closed:r.frameClosed});
 check('no page errors',errors.length===0,errors.slice(0,5));
 const bad=checks.filter(c=>!c.ok).length;
 console.log(bad?('FAILED '+bad+'/'+checks.length):('passed '+checks.length+'/'+checks.length));
 await browser.close(); process.exit(bad?1:0);
})().catch(async e=>{console.error(e);try{if(browser)await browser.close();}catch(x){}process.exit(2);});

/* The Market in the reference's layout (assets/features/se-market.js).

   Opens the Market the way a player does (the MARKET hexagon) and proves: it goes full screen with
   the bar across the top showing the real coins and gems; the tab strip has become a left column of
   the game's own tab buttons in groups (Offers, Horses, Catalog, Rider, Ranches, Currencies), none
   of them hidden, and a click on one is still the game's tab click; the rows are a grid of cards,
   several to a line on a wide screen; the Character entry opens the Character screen and closing
   that screen comes back to the Market on the same tab; the Character tile is in the ☰ menu; and
   closing the Market takes the full-screen classes away again.

   Usage:  QA_PORT=8431 NODE_PATH=$(npm root -g) node tools/qa-se-market.cjs */
const QA=require('./qa-platform.cjs');
const {chromium}=QA;
const url=QA.BASE+'/ranch3d.html?qa=se-market&fresh='+Date.now();
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
 await page.evaluate(()=>{const G=window.__features;G.save.sync(s=>{s.coins=4321;s.gems=55;});G.money.refreshWallet();});
 /* 1. open it with a real click on the hexagon */
 await page.click('#shopBtn'); await page.waitForTimeout(500);
 const a=await page.evaluate(()=>{
  const P=document.getElementById('shopPanel'),r=P.getBoundingClientRect(),top=document.getElementById('seMkTop');
  const side=P.querySelector('.se-mk-side'),btns=[...P.querySelectorAll('.se-mk-side [data-shoptab]')].filter(b=>b.dataset.shoptab!=='close');
  const rows=[...P.querySelectorAll(':scope>.s2-row')].slice(0,8).map(e=>e.getBoundingClientRect());
  const firstTop=rows.length?Math.round(rows[0].top):null, perLine=rows.filter(q=>Math.round(q.top)===firstTop).length;
  return {cls:P.classList.contains('se-mk'),body:document.body.classList.contains('se-market-open'),full:Math.round(r.width)>=1270&&Math.round(r.height)>=790,
   top:!!top&&getComputedStyle(top).display!=='none',coins:(document.getElementById('seMkCoins')||{}).textContent,gems:(document.getElementById('seMkGems')||{}).textContent,
   groups:[...P.querySelectorAll('.se-mk-gh')].map(h=>h.textContent),tabs:btns.length,hidden:btns.filter(b=>{const q=b.getBoundingClientRect();return !(q.width>0&&q.height>0)||getComputedStyle(b).display==='none';}).length,
   sideLeft:side?Math.round(side.getBoundingClientRect().left):null,char:!!P.querySelector('.se-mk-side [data-semk="character"]'),perLine,rows:P.querySelectorAll(':scope>.s2-row').length,
   cardTall:rows.length?Math.round(rows[0].height):0};
 });
 check('the MARKET hexagon opens it full screen with the top bar and the real coins and gems',a.cls&&a.body&&a.full&&a.top&&a.coins==='4,321'&&a.gems==='55',a);
 check('the tabs are a left column in groups, none hidden',a.sideLeft===0&&a.groups.join('|')==='Offers|Horses|Catalog|Rider|Ranches|Currencies'&&a.tabs>=19&&a.hidden===0,{groups:a.groups,tabs:a.tabs,hidden:a.hidden,left:a.sideLeft});
 check('the rows are a grid of picture cards, several to a line',a.rows>5&&a.perLine>=3&&a.cardTall>150,{rows:a.rows,perLine:a.perLine,tall:a.cardTall});
 /* 2. a click on a column entry is still the game's own tab click */
 await page.click('#shopPanel [data-shoptab="pets"]'); await page.waitForTimeout(400);
 const b=await page.evaluate(()=>{const P=document.getElementById('shopPanel');return {on:(P.querySelector('[data-shoptab].on')||{}).dataset?.shoptab,cls:P.classList.contains('se-mk'),grouped:P.querySelectorAll('.se-mk-gh').length};});
 check('a column entry opens its tab, and the layout holds across the re-render',b.on==='pets'&&b.cls&&b.grouped===6,b);
 /* 3. Character and back */
 await page.click('#shopPanel [data-semk="character"]'); await page.waitForTimeout(900);
 const c1=await page.evaluate(()=>({char:document.getElementById('seChar').classList.contains('on'),shop:document.getElementById('shopPanel').style.display}));
 await page.keyboard.press('Escape'); await page.waitForTimeout(600);
 const c2=await page.evaluate(()=>({char:document.getElementById('seChar').classList.contains('on'),shop:document.getElementById('shopPanel').style.display,tab:(document.querySelector('#shopPanel [data-shoptab].on')||{}).dataset?.shoptab}));
 check('the Character entry opens the Character screen, and closing it comes back to the Market on the same tab',c1.char&&c1.shop==='none'&&!c2.char&&c2.shop==='flex'&&c2.tab==='pets',{c1,c2});
 /* 4. closing the Market */
 await page.click('#seMkTop [data-mt="close"]'); await page.waitForTimeout(300);
 const d=await page.evaluate(()=>({shop:document.getElementById('shopPanel').style.display,cls:document.getElementById('shopPanel').classList.contains('se-mk'),body:document.body.classList.contains('se-market-open')}));
 check('the close button shuts it and takes the full-screen classes away',d.shop==='none'&&!d.cls&&!d.body,d);
 /* 5. the ☰ menu tile */
 const e=await page.evaluate(async()=>{const b=document.getElementById('charBtn');const inMenu=!!(b&&b.closest('#seTiles'));const m=document.getElementById('seMenuBtn');if(m)m.click();await new Promise(r=>setTimeout(r,300));
  const vis=b&&b.getBoundingClientRect().width>0;if(b)b.click();await new Promise(r=>setTimeout(r,700));return {exists:!!b,inMenu,vis,opened:document.getElementById('seChar').classList.contains('on')};});
 check('the Character tile is in the ☰ menu and opens the Character screen',e.exists&&e.inMenu&&e.vis&&e.opened,e);
 check('no page errors',errors.length===0,errors.slice(0,5));
 const bad=checks.filter(c=>!c.ok).length;
 console.log(bad?('FAILED '+bad+'/'+checks.length):('passed '+checks.length+'/'+checks.length));
 await browser.close(); process.exit(bad?1:0);
})().catch(async e=>{console.error(e);try{if(browser)await browser.close();}catch(x){}process.exit(2);});

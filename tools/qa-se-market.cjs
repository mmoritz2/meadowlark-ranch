/* Live Market integration: menu entry, grouped desktop navigation, original tab actions,
   search and the original star-tier filter, readable mobile catalog, Character return,
   and clean exit. The lightweight qa-market-navigation.cjs covers fixture edge cases.
   Usage: QA_PORT=8431 NODE_PATH=$(npm root -g) node tools/qa-se-market.cjs
   Add QA_STATIC=1 to serve the checkout through a GitHub Pages fixture origin. */
const QA=require('./qa-platform.cjs');
const {chromium}=QA;
const staticOrigin=process.env.QA_STATIC==='1'?'https://market-preview.github.io':null;
const url=(staticOrigin||QA.BASE)+'/ranch3d.html?qa=se-market&fresh='+Date.now();
const STANDARD_GROUPS={offers:['wallet','season','race','doors'],horses:['horses','summon','market','breed'],catalog:['catalog','tack','pets','food','style','recipes'],character:['outfit','prestige'],ranches:['ranches','furniture'],currencies:['purchases','gems']};
const STANDARD_LABELS=['Offers','Horses','Catalog','Rider','Ranches','Currencies'];
const checks=[];
function check(name,ok,detail){checks.push({name,ok:!!ok,detail});console.log((ok?'PASS ':'FAIL ')+name+(detail!==undefined?' — '+JSON.stringify(detail):''));}
let browser=null;
setTimeout(async()=>{console.error('WATCHDOG: no result after 300 s');try{if(browser)await browser.close();}catch(e){}process.exit(3);},300000).unref();
(async()=>{
 browser=await chromium.launch({headless:true,args:['--disable-background-timer-throttling',QA.ANGLE,'--enable-gpu-rasterization','--ignore-gpu-blocklist']});
 const page=await browser.newPage({viewport:{width:1280,height:800},serviceWorkers:'block'});
 if(staticOrigin)await page.route(staticOrigin+'/**',async route=>{
  const target=new URL(route.request().url());
  const response=await route.fetch({url:QA.BASE+target.pathname+target.search});
  await route.fulfill({response});
 });
 const apiRequests=[];
 page.on('request',request=>{if(new URL(request.url()).pathname.startsWith('/api/'))apiRequests.push(request.url());});
 const errors=[];
 page.on('pageerror',e=>errors.push('PAGEERROR '+e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 page.on('dialog',d=>{d.dismiss().catch(()=>{});});
 await page.goto(url,{waitUntil:'load',timeout:120000});
 await page.waitForFunction(()=>window.render_game_to_text&&(()=>{try{const s=JSON.parse(render_game_to_text());return s.graphics&&s.graphics.horseReady&&!s.graphics.horseLoading;}catch(e){return false;}})(),null,{timeout:180000,polling:250});
 await page.evaluate(()=>{const G=window.__features;G.save.sync(s=>{s.coins=4321;s.gems=55;});G.money.refreshWallet();});
 /* 1. Open the visible Market destination through the main menu. */
 await page.click('#seMenuBtn');await page.click('#seTiles [data-sem-main="market"]'); await page.waitForTimeout(500);
 const a=await page.evaluate(()=>{
  const P=document.getElementById('shopPanel'),r=P.getBoundingClientRect(),top=document.getElementById('seMkTop');
  const side=P.querySelector('.se-mk-side'),btns=[...P.querySelectorAll('.se-mk-side [data-shoptab]')].filter(b=>b.dataset.shoptab!=='close');
  const rows=[...P.querySelectorAll(':scope>.s2-row')].slice(0,8).map(e=>e.getBoundingClientRect());
  const firstTop=rows.length?Math.round(rows[0].top):null, perLine=rows.filter(q=>Math.round(q.top)===firstTop).length;
  return {cls:P.classList.contains('se-mk'),body:document.body.classList.contains('se-market-open'),full:Math.round(r.width)>=1270&&Math.round(r.height)>=790,
   top:!!top&&getComputedStyle(top).display!=='none',coins:(document.getElementById('seMkCoins')||{}).textContent,gems:(document.getElementById('seMkGems')||{}).textContent,
   groups:[...P.querySelectorAll('.se-mk-gh')].map(h=>h.textContent),groupIds:[...P.querySelectorAll('[data-se-group-toggle]')].map(h=>h.dataset.seGroupToggle),entries:btns.map(b=>({id:b.dataset.shoptab,group:b.dataset.seGroup})),pickerValues:[...P.querySelectorAll('#seMkBrowse option')].map(o=>o.value),expanded:P.querySelectorAll('[data-se-group-toggle][aria-expanded="true"]').length,pickerTabs:P.querySelectorAll('#seMkBrowse option').length,tabs:btns.length,hidden:btns.filter(b=>{const q=b.getBoundingClientRect();return !(q.width>0&&q.height>0)||getComputedStyle(b).display==='none';}).length,
   sideLeft:side?Math.round(side.getBoundingClientRect().left):null,char:!!P.querySelector('.se-mk-side [data-semk="character"]'),perLine,rows:P.querySelectorAll(':scope>.s2-row').length,
   cardTall:rows.length?Math.round(rows[0].height):0};
 });
 check('the main menu opens Market full screen with its top bar and real balances',a.cls&&a.body&&a.full&&a.top&&a.coins==='4,321'&&a.gems==='55',a);
 const known=new Set(Object.values(STANDARD_GROUPS).flat()),extra=a.entries.filter(e=>!known.has(e.id));
 const expectedGroups=[...STANDARD_LABELS,...(extra.length?['More']:[])];
 const groupedCorrectly=a.entries.every(e=>e.group===(Object.entries(STANDARD_GROUPS).find(([,ids])=>ids.includes(e.id))?.[0]||'more'));
 const pickerMatches=a.entries.every(e=>a.pickerValues.includes(e.id))&&new Set(a.pickerValues).size===a.entries.length+1&&a.pickerValues.includes('@character');
 check('six standard departments and any added tabs remain grouped and reachable',a.sideLeft===0&&a.groups.join('|')===expectedGroups.join('|')&&a.tabs>=19&&a.hidden>0&&a.expanded===1&&groupedCorrectly&&pickerMatches,{groups:a.groups,extras:extra,tabs:a.tabs,hidden:a.hidden,expanded:a.expanded,pickerTabs:a.pickerTabs,left:a.sideLeft});
 for(const group of a.groupIds){
  const header=page.locator('#shopPanel [data-se-group-toggle="'+group+'"]');
  if(await header.getAttribute('aria-expanded')!=='true')await header.click();
  const visible=await page.evaluate(()=>[...document.querySelectorAll('.se-mk-side [data-shoptab]')].filter(b=>b.getBoundingClientRect().height>0).map(b=>b.dataset.shoptab).sort());
  const expected=a.entries.filter(e=>e.group===group).map(e=>e.id).sort();
  check('expanding '+group+' exposes every original tab in that department',visible.join('|')===expected.join('|')&&expected.length>0,{expected,visible});
 }
 check('the rows are a grid of picture cards, several to a line',a.rows>5&&a.perLine>=3&&a.cardTall>150,{rows:a.rows,perLine:a.perLine,tall:a.cardTall});
 /* 2. a click on a column entry is still the game's own tab click */
 await page.click('#shopPanel [data-se-group-toggle="catalog"]');
 await page.click('#shopPanel [data-shoptab="pets"]'); await page.waitForTimeout(400);
 const b=await page.evaluate(()=>{const P=document.getElementById('shopPanel');return {on:(P.querySelector('[data-shoptab].on')||{}).dataset?.shoptab,cls:P.classList.contains('se-mk'),groups:[...P.querySelectorAll('.se-mk-gh')].map(h=>h.textContent),tabs:[...P.querySelectorAll('.se-mk-side [data-shoptab]')].filter(b=>b.dataset.shoptab!=='close').map(b=>b.dataset.shoptab).sort()};});
 check('a column entry opens its tab, and the layout holds across the re-render',b.on==='pets'&&b.cls&&b.groups.join('|')===expectedGroups.join('|')&&b.tabs.join('|')===a.entries.map(e=>e.id).sort().join('|'),b);
 /* 3. Character and back */
 await page.click('#shopPanel [data-se-group-toggle="character"]');
 await page.click('#shopPanel [data-semk="character"]'); await page.waitForTimeout(900);
 const c1=await page.evaluate(()=>({char:document.getElementById('seChar').classList.contains('on'),shop:document.getElementById('shopPanel').style.display}));
 await page.keyboard.press('Escape'); await page.waitForTimeout(600);
 const c2=await page.evaluate(()=>({char:document.getElementById('seChar').classList.contains('on'),shop:document.getElementById('shopPanel').style.display,tab:(document.querySelector('#shopPanel [data-shoptab].on')||{}).dataset?.shoptab}));
 check('the Character entry opens the Character screen, and closing it comes back to the Market on the same tab',c1.char&&c1.shop==='none'&&!c2.char&&c2.shop==='flex'&&c2.tab==='pets',{c1,c2});
 /* 4. Mobile catalog keeps source star-tier semantics and one filter surface. */
 await page.setViewportSize({width:390,height:844});
 await page.selectOption('#seMkBrowse','horses');await page.waitForTimeout(350);
 const mobile=await page.evaluate(()=>{
  const p=document.getElementById('shopPanel'),rows=[...p.querySelectorAll('.s2-row')],img=p.querySelector('.mk-thumb-img');
  return {top:rows[0]?.getBoundingClientRect().top,overflow:p.scrollWidth-p.clientWidth,filters:p.querySelectorAll('#seMkRarity').length,
   oldFilters:[...p.querySelectorAll('.se-mk-native-filter')].filter(e=>e.getBoundingClientRect().height>0).length,fit:img&&getComputedStyle(img).objectFit};
 });
 check('mobile catalog fits the screen with one rarity control and uncropped portraits',mobile.top<=350&&mobile.overflow<2&&mobile.filters===1&&mobile.oldFilters===0&&mobile.fit==='contain',mobile);
 await page.selectOption('#seMkRarity','2');await page.waitForTimeout(350);
 const tier=await page.evaluate(()=>({value:document.getElementById('seMkRarity').value,source:document.querySelector('[data-fx="roster:stars:2"]')?.classList.contains('on')}));
 check('the rarity dropdown invokes the original star-tier action',tier.value==='2'&&tier.source,tier);
 await page.fill('#seMkSearch','not-a-real-horse-qa');
 check('search has a clear empty state',await page.locator('.se-mk-empty').isVisible());
 await page.click('.se-mk-empty button');await page.waitForTimeout(350);
 const reset=await page.evaluate(()=>({query:document.getElementById('seMkSearch').value,rarity:document.getElementById('seMkRarity').value,shown:document.querySelectorAll('.s2-row:not(.se-mk-filtered)').length}));
 check('reset clears search and star tier together',!reset.query&&reset.rarity==='0'&&reset.shown>5,reset);
 /* 5. closing the Market */
 await page.click('#seMkTop [data-mt="close"]'); await page.waitForTimeout(300);
 const d=await page.evaluate(()=>({shop:document.getElementById('shopPanel').style.display,cls:document.getElementById('shopPanel').classList.contains('se-mk'),body:document.body.classList.contains('se-market-open')}));
 check('the close button shuts it and takes the full-screen classes away',d.shop==='none'&&!d.cls&&!d.body,d);
 /* 6. The main menu's visible Rider destination still opens Character. */
 await page.click('#seMenuBtn');
 const rider=page.locator('#seTiles [data-sem-main="character"]');
 const visible=await rider.isVisible();await rider.click();
 await page.waitForFunction(()=>document.getElementById('seChar')?.classList.contains('on'));
 const e=await page.evaluate(()=>({exists:!!document.getElementById('charBtn'),opened:document.getElementById('seChar').classList.contains('on')}));
 check('the main menu Rider destination opens Character',visible&&e.exists&&e.opened,{visible,...e});
 if(staticOrigin)check('GitHub Pages mode makes no account API requests',await page.evaluate(()=>window.__features.commerce?.isStaticStore===true)&&apiRequests.length===0,apiRequests);
 check('no page errors',errors.length===0,errors.slice(0,5));
 const bad=checks.filter(c=>!c.ok).length;
 console.log(bad?('FAILED '+bad+'/'+checks.length):('passed '+checks.length+'/'+checks.length));
 await browser.close(); process.exit(bad?1:0);
})().catch(async e=>{console.error(e);try{if(browser)await browser.close();}catch(x){}process.exit(2);});

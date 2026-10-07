// Static GitHub Pages store coverage. All browser requests are served from this
// isolated fixture; no real website, account service, or saved browser is used.
const {chromium,ANGLE}=require('./qa-platform.cjs');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const files=new Set(['store.html','assets/store.js','assets/store.css','assets/commerce-client.js','assets/store-catalog.mjs','assets/features/commerce.js','assets/store-tack.mjs','assets/tack-collection.mjs','assets/tack-collection-art.mjs','assets/premium-tack.mjs','assets/paid-tack-access.mjs']);
(async()=>{
  const {PRODUCTS}=await import('../server/catalog.mjs');
  const browser=await chromium.launch({headless:true,...(process.env.QA_BROWSER?{executablePath:process.env.QA_BROWSER}:{}),args:[ANGLE,'--ignore-gpu-blocklist']});
  try {
    for(const prefix of ['/meadowlark-ranch/','/']){
      const origin='https://meadowlark-fixture.github.io',base=origin+prefix;
      const context=await browser.newContext({viewport:{width:1360,height:900},serviceWorkers:'block'}),page=await context.newPage();
      const requests=[],unexpected=[],errors=[];
      page.on('pageerror',error=>errors.push(error.message));
      page.on('request',request=>requests.push(request.url()));
      await context.route('**/*',async route=>{
        const url=new URL(route.request().url()),relative=url.pathname.slice(prefix.length);
        if(url.origin!==origin||!url.pathname.startsWith(prefix)||(!files.has(relative)&&!['fixture.html','ranch3d.html'].includes(relative))){
          unexpected.push(url.href);return route.abort();
        }
        if(relative==='fixture.html'||relative==='ranch3d.html')return route.fulfill({contentType:'text/html',body:'<!doctype html><html><body><h1>Isolated ranch fixture</h1></body></html>'});
        const contentType=relative.endsWith('.html')?'text/html':relative.endsWith('.css')?'text/css':'text/javascript';
        return route.fulfill({contentType,body:fs.readFileSync(path.join(root,relative))});
      });
      await page.goto(base+'store.html?checkout=success&session_id=cs_test_fixture');
      await page.locator('body.static-preview').waitFor();
      assert.equal(await page.locator('#store-badge').textContent(),'Store preview');
      assert.match(await page.locator('#store-notice').textContent(),/Purchases coming soon/);
      assert.equal(await page.getByRole('tab').count(),4);
      assert.equal(await page.locator('form,[data-product],[data-reward],[data-tack-checkout]').count(),0);
      assert.equal(await page.locator('.product').count(),Object.keys(PRODUCTS).length);
      for(const product of Object.values(PRODUCTS)){
        const card=page.locator('.product').filter({has:page.getByRole('heading',{name:product.name,exact:true,includeHidden:true})});
        assert.equal(await card.count(),1);
        assert.match(await card.locator('.price').textContent(),new RegExp('\\$'+(product.cents/100).toFixed(2).replace('.','\\.')));
        assert.equal(await card.locator('button').count(),0);
      }
      assert.doesNotMatch(await page.locator('body').innerText(),/Sign in|cloud backup|test cards|Test checkout|Create an account/i);
      await page.getByRole('tab',{name:'Gems',exact:true}).focus();
      await page.keyboard.press('End');assert.equal(await page.getByRole('tab',{name:'VIP passes'}).getAttribute('aria-selected'),'true');
      await page.keyboard.press('ArrowRight');assert.equal(await page.getByRole('tab',{name:'Discover',exact:true}).getAttribute('aria-selected'),'true');
      await page.keyboard.press('ArrowLeft');assert.equal(await page.getByRole('tab',{name:'VIP passes'}).getAttribute('aria-selected'),'true');
      await page.keyboard.press('Home');await page.getByRole('tab',{name:'Gems',exact:true}).click();
      await page.locator('.store-details summary').click();
      assert.match(await page.locator('.store-details p').innerText(),/separate account balance/);
      await page.getByRole('button',{name:'Explore VIP passes'}).click();
      assert.equal(await page.getByRole('tab',{name:'VIP passes'}).getAttribute('aria-selected'),'true');
      assert.match(await page.locator('#vip-note').innerText(),/when purchases launch/);
      await page.getByRole('tab',{name:'Gems',exact:true}).click();
      await page.locator('.store-details summary').click();
      if(prefix!=='/')await page.screenshot({path:'/tmp/meadowlark-static-store-desktop.png',fullPage:true});
      for(const width of [390,320]){
        await page.setViewportSize({width,height:844});
        for(const name of ['Discover','Tack · 127 pieces','Gems','VIP passes']){
          await page.getByRole('tab',{name,exact:true}).click();
          assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`${name} overflow at ${width}px`);
        }
      }
      await page.setViewportSize({width:390,height:844});await page.getByRole('tab',{name:'Gems',exact:true}).click();
      if(prefix!=='/')await page.screenshot({path:'/tmp/meadowlark-static-store-mobile.png',fullPage:true});
      await page.getByRole('tab',{name:'Tack · 127 pieces',exact:true}).click();
      const pictured=new Set();for(let i=0;i<11;i++){for(const id of await page.locator('[data-tack-piece]').evaluateAll(cards=>cards.map(c=>c.dataset.tackPiece)))pictured.add(id);if(await page.locator('#tack-next').isDisabled())break;await page.locator('#tack-next').click();}assert.equal(pictured.size,127);
      assert.equal(await page.locator('a.back').getAttribute('href'),'ranch3d.html');
      await page.locator('a.back').click();await page.waitForURL(base+'ranch3d.html');
      // Exercise the game feature without booting the 3D world. It must neither
      // schedule account refreshes nor register a focus refresh in preview mode.
      await page.goto(base+'fixture.html');
      const game=await page.evaluate(async()=>{
        const module=await import('./assets/features/commerce.js');
        const client=await import('./assets/commerce-client.js');
        const originalInterval=window.setInterval,originalListen=window.addEventListener;
        let intervals=0,focusListeners=0,walletRefreshes=0,tab,section;
        window.setInterval=()=>{intervals++;return 1;};
        window.addEventListener=function(type,...args){if(type==='focus')focusListeners++;return originalListen.call(this,type,...args);};
        const actions={};
        const G={ui:{action:(name,callback)=>actions[name]=callback,shopTab:value=>tab=value,onlineSection:callback=>section=callback()},money:{refreshWallet:()=>walletRefreshes++}};
        try{module.install(G);}finally{window.setInterval=originalInterval;window.addEventListener=originalListen;}
        const ranch={v:2,ranchName:'Unchanged preview ranch',horses:[{id:1}],gems:77};localStorage.setItem('starRanchFable_v1',JSON.stringify(ranch));
        const account=await client.refreshAccount();
        let blocked;try{await client.api('checkout',{product:'gems_40'});}catch(error){blocked=error.status;}
        window.__storeAction=actions.store;
        return {intervals,focusListeners,walletRefreshes,tab:tab.render(),tabLabel:tab.label,section,isStatic:G.commerce.isStaticStore,label:G.commerce.storeLabel,paid:G.commerce.paidVipUntil(),account,blocked,ranch:JSON.parse(localStorage.getItem('starRanchFable_v1'))};
      });
      assert.equal(game.intervals,0);assert.equal(game.focusListeners,0);assert.equal(game.walletRefreshes,0);
      assert.equal(game.isStatic,true);assert.equal(game.label,'Ranch store');assert.equal(game.tabLabel,'Ranch store');
      assert.equal(game.paid,0);assert.equal(game.account,null);assert.equal(game.blocked,503);
      assert.match(game.tab,/Ranch store/);assert.match(game.tab,/Online preview/);assert.match(game.tab,/checkout and accounts are not available/);assert.doesNotMatch(game.tab+game.section,/Sign in|cloud|test cards/i);
      assert.equal(game.ranch.gems,77);
      await page.evaluate(()=>window.__storeAction());await page.waitForURL(base+'store.html');
      await page.locator('body.static-preview').waitFor();
      assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('starRanchFable_v1')).gems),77);
      assert.deepEqual(unexpected,[]);assert.deepEqual(errors,[]);
      assert.equal(requests.some(url=>/\/api\/|checkout\.stripe\.com/.test(url)),false);
      console.log('PASS static preview, draft catalog, four-tab keyboard navigation, mobile layout, no account controls/requests, game navigation at '+prefix);
      await context.close();
    }
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});

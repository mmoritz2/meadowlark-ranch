// Isolated browser + in-memory accounts. No real Stripe account or user saves are used.
const {chromium,ANGLE}=require('./qa-platform.cjs');
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
  const {Commerce,createCommerceServer}=await import('../server/commerce.mjs');
  let checkout;
  const service=new Commerce({dbPath:':memory:',stripeKey:'sk_test_browser_fixture',webhookSecret:'whsec_browser_fixture',fetchImpl:async(url,opts)=>{
    if(opts.method==='POST'){
      const fields=new URLSearchParams(opts.body),id=fields.get('client_reference_id');
      checkout={id:'cs_test_browser_fixture',livemode:false,mode:'payment',status:'complete',payment_status:'paid',client_reference_id:id,metadata:{order_id:id},amount_total:Number(fields.get('line_items[0][price_data][unit_amount]')),currency:'usd',payment_intent:'pi_browser_fixture',url:'https://checkout.stripe.com/c/pay/cs_test_browser_fixture'};
    }
    return {ok:true,json:async()=>checkout};
  }});
  const server=createCommerceServer(service);
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  service.origin='http://127.0.0.1:'+server.address().port;
  let browser;
  try{
    browser=await chromium.launch({headless:true,args:[ANGLE,'--ignore-gpu-blocklist']});
    const context=await browser.newContext({viewport:{width:1360,height:1000}}),page=await context.newPage();
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await context.route('https://checkout.stripe.com/**',route=>route.fulfill({contentType:'text/html',body:'<h1>Isolated Stripe checkout fixture</h1>'}));
    await page.goto(service.origin+'/store.html');
    await page.getByRole('button',{name:'Create an account',exact:true}).click();
    await page.getByLabel('Username',{exact:true}).fill('browser_rider');
    await page.getByLabel('Password',{exact:false}).fill('isolated-browser-passphrase');
    await page.getByRole('button',{name:'Create account',exact:true}).click();
    await page.locator('#account').waitFor({state:'visible'});
    assert.equal((await page.locator('#recovery-code').textContent()).length,43);
    await page.getByRole('button',{name:'I’ve saved my code'}).click();
    await page.evaluate(()=>localStorage.setItem('starRanchFable_v1',JSON.stringify({v:2,ranchName:'Browser test ranch',horses:[{id:1,name:'Clover'}],gems:7})));
    await page.getByRole('tab',{name:'Your account',exact:true}).click();
    await page.locator('#cloud-section summary').click();
    await page.getByRole('button',{name:'Back up this ranch'}).click();await page.getByRole('button',{name:'Back up ranch',exact:true}).click();
    await page.locator('#message').filter({hasText:'Ranch backed up to your account.'}).waitFor();
    await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('starRanchFable_v1'));s.ranchName='Changed ranch';localStorage.setItem('starRanchFable_v1',JSON.stringify(s));});
    await page.getByRole('button',{name:'Restore cloud ranch'}).click();await page.getByRole('button',{name:'Restore ranch',exact:true}).click();
    await page.locator('#message').filter({hasText:'Ranch restored.'}).waitFor();
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('starRanchFable_v1')).ranchName),'Browser test ranch');
    await page.getByRole('button',{name:'Undo last restore'}).click();await page.getByRole('button',{name:'Undo restore',exact:true}).click();
    await page.locator('#message').filter({hasText:'Previous ranch restored.'}).waitFor();
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('starRanchFable_v1')).ranchName),'Changed ranch');
    console.log('PASS registration, recovery code, cloud backup, restore and undo');
    await page.getByRole('tab',{name:'Gems',exact:true}).click();
    await page.getByRole('button',{name:'$2.99 · Test checkout',exact:true}).click();
    await page.waitForURL('https://checkout.stripe.com/**');
    await page.goto(service.origin+'/store.html?checkout=success&session_id=cs_test_browser_fixture');
    await page.locator('#balance').filter({hasText:/^40$/}).waitFor();
    await page.getByRole('tab',{name:'VIP passes',exact:true}).click();
    await page.getByRole('button',{name:'32 gems',exact:true}).click();await page.getByRole('button',{name:'Activate VIP',exact:true}).click();
    await page.locator('#balance').filter({hasText:/^8$/}).waitFor();
    assert.match(await page.locator('#vip-status').textContent(),/active until/);
    fs.mkdirSync('output/commerce',{recursive:true});
    await page.screenshot({path:'output/commerce/store-desktop.png',fullPage:true});
    await page.setViewportSize({width:390,height:844});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.screenshot({path:'output/commerce/store-mobile.png',fullPage:true});
    console.log('PASS test checkout return, purchased gem balance, VIP redemption and mobile layout');
    await page.evaluate(()=>localStorage.removeItem('starRanchFable_v1'));
    await page.setViewportSize({width:1280,height:800});
    await page.goto(service.origin+'/ranch3d.html?qa=commerce',{waitUntil:'domcontentloaded',timeout:120000});
    await page.waitForFunction(()=>window.__features?.installed?.includes('commerce'),null,{timeout:150000});
    const state=await page.evaluate(()=>{
      const G=window.__features,s=G.save.fresh();G.ui.openShop('purchases');
      return {vip:G.money.isVIP(s),paid:G.commerce.paidVipUntil()>Date.now(),localPaid:s.paidVipUntil||s.premium||s.commerce||null,errors:G.errors};
    });
    assert.equal(state.vip,true);assert.equal(state.paid,true);assert.equal(state.localPaid,null);assert.deepEqual(state.errors,[]);
    await page.getByRole('button',{name:'Browse the store',exact:true}).click();await page.waitForURL('**/store.html');
    await page.locator('#account').waitFor({state:'visible'});
    assert.equal(await page.locator('#balance').textContent(),'8');
    await page.getByRole('tab',{name:'Your account',exact:true}).click();
    await page.getByRole('button',{name:'Sign out',exact:true}).click();await page.locator('#auth').waitFor({state:'visible'});
    await page.reload();await page.locator('#guest').waitFor({state:'visible'});
    assert.deepEqual(errors,[]);
    console.log('PASS game boot, paid VIP benefits, game shop link, retained wallet, logout and reload');
    console.log('Screenshots: output/commerce/store-desktop.png and store-mobile.png');
  }finally{
    if(browser)await browser.close();
    await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});service.close();
  }
})().catch(e=>{console.error(e);process.exitCode=1;});

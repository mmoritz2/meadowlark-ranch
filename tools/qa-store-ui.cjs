// Store-only regression coverage: isolated browser, in-memory database, and fake Stripe.
const {chromium,ANGLE}=require('./qa-platform.cjs');
const assert=require('node:assert/strict');
(async()=>{
  const {Commerce,createCommerceServer}=await import('../server/commerce.mjs');
  let checkout, paymentConfirmed=true;
  const service=new Commerce({dbPath:':memory:',stripeKey:'sk_test_store_fixture',webhookSecret:'whsec_store_fixture',fetchImpl:async(url,opts)=>{
    if(opts.method==='POST'){
      const fields=new URLSearchParams(opts.body),id=fields.get('client_reference_id');
      checkout={id:'cs_test_store_fixture',livemode:false,mode:'payment',status:'complete',payment_status:'paid',client_reference_id:id,metadata:{order_id:id},amount_total:Number(fields.get('line_items[0][price_data][unit_amount]')),currency:'usd',payment_intent:'pi_store_fixture',url:'https://checkout.stripe.com/c/pay/cs_test_store_fixture'};
    }
    return {ok:true,json:async()=>({...checkout,payment_status:paymentConfirmed?'paid':'unpaid'})};
  }});
  const server=createCommerceServer(service);let browser;
  try {
    await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
    service.origin='http://127.0.0.1:'+server.address().port;
    browser=await chromium.launch({headless:true,...(process.env.QA_BROWSER?{executablePath:process.env.QA_BROWSER}:{}),args:[ANGLE,'--ignore-gpu-blocklist']});
    const context=await browser.newContext({viewport:{width:1360,height:1000}}),page=await context.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await context.route('https://checkout.stripe.com/**',route=>route.fulfill({contentType:'text/html',body:'<h1>Fake checkout</h1>'}));
    await page.goto(service.origin+'/store.html');
    await page.locator('#guest').waitFor({state:'visible'});
    assert.equal(await page.locator('.product:visible').count(),3);
    assert.equal(await page.locator('#panel-account').isVisible(),false);
    await page.getByRole('tab',{name:'Gems',exact:true}).focus();await page.keyboard.press('ArrowRight');
    assert.equal(await page.getByRole('tab',{name:'VIP passes'}).getAttribute('aria-selected'),'true');
    assert.equal(await page.locator('.product:visible').count(),1);
    await page.keyboard.press('End');assert.equal(await page.getByRole('tab',{name:'Your account'}).getAttribute('aria-selected'),'true');
    await page.keyboard.press('Home');
    await page.getByRole('button',{name:'Create an account',exact:true}).click();
    assert.equal(await page.locator('#panel-account').isVisible(),true);
    await page.getByLabel('Username',{exact:true}).fill('store_rider');
    await page.getByLabel('Password',{exact:false}).fill('isolated-store-passphrase');
    await page.getByRole('button',{name:'Create account',exact:true}).click();
    await page.locator('#account').waitFor({state:'visible'});
    const recoveryCode=await page.locator('#recovery-code').textContent();assert.equal(recoveryCode.length,43);
    await page.getByRole('button',{name:'I’ve saved my code'}).click();
    assert.equal(await page.locator('#panel-gems').isVisible(),true);
    await page.screenshot({path:'/tmp/meadowlark-store-cleanup-desktop.png',fullPage:true});
    for(const width of [390,320]){
      await page.setViewportSize({width,height:844});
      for(const name of ['Gems','VIP passes','Your account']){
        await page.getByRole('tab',{name,exact:true}).click();
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`${name} overflow at ${width}px`);
      }
    }
    await page.setViewportSize({width:390,height:844});await page.getByRole('tab',{name:'Gems',exact:true}).click();
    await page.screenshot({path:'/tmp/meadowlark-store-cleanup-mobile.png',fullPage:true});
    await page.setViewportSize({width:1360,height:1000});await page.getByRole('tab',{name:'Your account'}).click();
    assert.equal(await page.locator('#cloud-upload').isVisible(),false);
    await page.locator('#cloud-section summary').click();
    await page.evaluate(()=>localStorage.setItem('starRanchFable_v1',JSON.stringify({v:2,ranchName:'Store test ranch',horses:[{id:1,name:'Clover'}],gems:7})));
    await page.getByRole('button',{name:'Back up this ranch'}).click();await page.getByRole('button',{name:'Cancel',exact:true}).click();
    await page.locator('#cloud-upload:not([disabled])').waitFor({state:'visible'});
    assert.equal(await page.evaluate(()=>document.activeElement.id),'cloud-upload');
    await page.getByRole('button',{name:'Back up this ranch'}).click();await page.getByRole('button',{name:'Back up ranch',exact:true}).click();
    await page.locator('#message').filter({hasText:'Ranch backed up to your account.'}).waitFor();
    await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('starRanchFable_v1'));s.ranchName='Changed ranch';localStorage.setItem('starRanchFable_v1',JSON.stringify(s));});
    await page.getByRole('button',{name:'Restore cloud ranch'}).click();await page.getByRole('button',{name:'Restore ranch',exact:true}).click();
    await page.locator('#message').filter({hasText:'Ranch restored.'}).waitFor();
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('starRanchFable_v1')).ranchName),'Store test ranch');
    await page.getByRole('button',{name:'Undo last restore'}).click();await page.getByRole('button',{name:'Undo restore',exact:true}).click();
    await page.locator('#message').filter({hasText:'Previous ranch restored.'}).waitFor();
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('starRanchFable_v1')).ranchName),'Changed ranch');
    console.log('PASS compact tabs, keyboard navigation, mobile layout, registration, backup, restore, undo and confirmation focus');
    await page.getByRole('tab',{name:'Gems',exact:true}).click();
    await page.getByRole('button',{name:'$2.99 · Test checkout',exact:true}).click();await page.waitForURL('https://checkout.stripe.com/**');
    paymentConfirmed=false;
    await page.goto(service.origin+'/store.html?checkout=success&session_id=cs_test_store_fixture&view=keep');
    await page.locator('#message').filter({hasText:'Payment has not been confirmed'}).waitFor();
    await page.getByRole('button',{name:'Refresh balance'}).click();
    await page.locator('#refresh:not([disabled])').waitFor({state:'visible'});
    assert.match(await page.locator('#message').textContent(),/Payment has not been confirmed/);
    paymentConfirmed=true;await page.getByRole('button',{name:'Refresh balance'}).click();
    await page.locator('#message').filter({hasText:'Test purchase delivered'}).waitFor();
    assert.equal(new URL(page.url()).search,'?view=keep');
    await page.locator('#balance').filter({hasText:/^40$/}).waitFor();
    await page.getByRole('tab',{name:'VIP passes'}).click();
    await page.getByRole('button',{name:'32 gems',exact:true}).click();await page.getByRole('button',{name:'Activate VIP',exact:true}).click();
    await page.locator('#balance').filter({hasText:/^8$/}).waitFor();
    assert.match(await page.locator('#vip-status').textContent(),/active until/);
    assert.match(await page.locator('[data-reward-hint="vip_month"]').textContent(),/24 more purchased gems needed/);
    console.log('PASS pending payment stays visible on refresh, delivered status, query preservation, checkout and VIP redemption');
    const user=service.one('SELECT id FROM users WHERE username=?','store_rider');service.run('DELETE FROM sessions WHERE user_id=?',user.id);
    await page.getByRole('button',{name:'Refresh balance'}).click();
    await page.locator('#auth').waitFor({state:'visible'});
    assert.equal(await page.locator('#account').isVisible(),false);
    assert.match(await page.locator('#message').textContent(),/session ended/);
    await page.getByLabel('Username',{exact:true}).fill('store_rider');await page.getByLabel('Password',{exact:false}).fill('isolated-store-passphrase');
    await page.locator('#auth-submit').click();await page.locator('#account').waitFor({state:'visible'});
    await page.addInitScript(()=>{Storage.prototype.getItem=function(){throw new DOMException('Blocked by browser','SecurityError');};});
    await page.reload();await page.locator('#account').waitFor({state:'visible'});
    assert.equal(await page.locator('#balance').textContent(),'8');assert.deepEqual(errors,[]);
    console.log('PASS expired sessions recover cleanly and blocked local storage does not break wallet/store');
    // A separate anonymous context exercises connection recovery without touching the user profile.
    const offline=await browser.newContext(),offlinePage=await offline.newPage();
    await offline.route('**/api/catalog',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Temporarily unavailable.'})}));
    await offlinePage.goto(service.origin+'/store.html');await offlinePage.getByRole('button',{name:'Try again'}).waitFor({state:'visible'});
    await offline.unroute('**/api/catalog');await offlinePage.getByRole('button',{name:'Try again'}).click();await offlinePage.locator('#guest').waitFor({state:'visible'});
    assert.equal(await offlinePage.locator('#retry').isVisible(),false);await offline.close();
    console.log('PASS service connection retry');
  } finally {
    if(browser)await browser.close();
    await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});service.close();
  }
})().catch(e=>{console.error(e);process.exitCode=1;});

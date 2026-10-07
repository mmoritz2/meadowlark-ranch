import {api, isStaticStore} from './commerce-client.js';
import {PRODUCTS, REWARDS} from './store-catalog.mjs';
import {createTackStore} from './store-tack.mjs?v=native-store-20261007';
const $ = id => document.getElementById(id);
const SAVE = 'starRanchFable_v1', BACKUP = 'meadowlark_before_cloud_restore';
const params=new URLSearchParams(location.search),initialTab=['discover','tack','gems','vip','account'].includes(params.get('tab'))?params.get('tab'):'discover';
let catalog, account, authMode = 'login', working = false, cardsBuilt = false, afterAuthTab = initialTab==='account'?'discover':initialTab, activeTab = initialTab;
const allProducts=()=>[...(catalog?.products||[]),...(catalog?.premiumTack?.products||[])];
const checkoutRequests = new Map(), redeemRequests = new Map();
const money = cents => new Intl.NumberFormat('en-US', {style:'currency',currency:'USD'}).format(cents / 100);
const date = t => new Date(t).toLocaleString();
const message = (text, error = false) => { $('message').textContent = text; $('message').classList.toggle('error', error); };
function node(tag, text, cls) {const e = document.createElement(tag); if (text !== undefined) e.textContent = text; if (cls) e.className = cls; return e;}
function clearAccount() {
  account = null; checkoutRequests.clear(); redeemRequests.clear();
  $('recovery-code').textContent = ''; $('recovery-result').hidden = true;
  $('cloud-section').open = false; $('history-section').open = false;
}
async function run(fn) {
  if (working) return;
  const trigger = document.activeElement;
  working = true; render();
  try {await fn();} catch(e) {
    if (e.status === 401 && account) {clearAccount(); showAuth('login');}
    // Another tab can change the wallet or cloud revision. Update before the next explicit attempt.
    if (e.status === 409 && account) {try {await loadAccount();} catch {}}
    message(e.message, true);
  } finally {
    working = false; render();
    if ((document.activeElement === document.body || !document.activeElement?.getClientRects().length) && trigger?.isConnected && !trigger.disabled && trigger.getClientRects().length) trigger.focus({preventScroll:true});
  }
}
function ask(title, text, action) {
  $('confirm-title').textContent = title; $('confirm-text').textContent = text; $('confirm-yes').textContent = action;
  const d = $('confirm-dialog'); d.returnValue = ''; d.showModal();
  return new Promise(resolve => d.addEventListener('close', () => resolve(d.returnValue === 'yes'), {once:true}));
}
async function loadAccount() {
  try {account = await api('me');} catch(e) {if (e.status === 401) clearAccount(); else throw e;}
}
function selectTab(name, focus = false) {
  if (isStaticStore && !['discover','tack','gems','vip'].includes(name)) name='discover';
  activeTab = name;document.body.dataset.storeTab=name;
  if (!isStaticStore) $('guest').hidden = !catalog || !!account || name === 'account';
  for (const tab of document.querySelectorAll('[data-tab]')) {
    const selected = tab.dataset.tab === name;
    tab.setAttribute('aria-selected', String(selected)); tab.tabIndex = selected ? 0 : -1;
    $(tab.getAttribute('aria-controls')).hidden = !selected;
    if (selected && focus) tab.focus();
  }
}
function showAuth(mode, returnTab = activeTab==='account'?afterAuthTab:activeTab) {
  afterAuthTab = returnTab; setAuth(mode); selectTab('account'); render();
  $('auth-form').elements.username.focus({preventScroll:true});
  $('auth').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',block:'nearest'});
}
function buyProduct(id){
  if(isStaticStore)return;
  const p=allProducts().find(p=>p.id===id);if(!p)return;
  if(!account){showAuth('login',p.tack?'tack':p.days?'vip':'gems');return;}
  if(!catalog.checkoutEnabled||account.wallet.held||(p.tack&&account.tack?.some(t=>t.product===id)))return;
  run(async()=>{
    if(!checkoutRequests.has(id))checkoutRequests.set(id,crypto.randomUUID());
    try{const result=await api('checkout',{product:id,requestId:checkoutRequests.get(id)});const url=new URL(result.url);if(url.origin!=='https://checkout.stripe.com')throw Error('Unexpected checkout address.');location.assign(url.href);}
    catch(error){if(error.status===409)checkoutRequests.delete(id);throw error;}
  });
}
const tackStore=createTackStore({document,isStatic:isStaticStore,getCatalog:()=>catalog,getAccount:()=>account,isWorking:()=>working,buyProduct,selectTab,params});
function buildCards() {
  if (!catalog || cardsBuilt) return;
  cardsBuilt = true;
  catalog.products.forEach((p, i) => {
    const card=node('article',undefined,'product'+(p.days?' vip':''));
    const art=node('div',undefined,'product-illustration'); art.setAttribute('aria-hidden','true');
    if(p.days) art.append(node('span','♛','crown')); else for(let n=0;n<=Math.min(i,2);n++) art.append(node('span',undefined,'gem'));
    const amount=node('div',String(p.gems || p.days)+' ','amount'); amount.append(node('span',p.days?'days of VIP':'gems'));
    const buy=isStaticStore?node('p','Available at launch','product-coming-soon'):node('button');
    if (!isStaticStore) {
    buy.dataset.product=p.id;
    buy.addEventListener('click',()=>buyProduct(p.id));
    }
    card.append(art,node('h3',p.name),amount,node('p',money(p.cents)+' USD · sample price','price'),buy);
    $(p.days?'vip-products':'products').append(card);
  });
  if (isStaticStore) return;
  catalog.rewards.forEach(r=>{
    const card=node('div',undefined,'reward'),button=node('button',r.gems+' gems'),hint=node('small');
    button.dataset.reward=r.id; hint.dataset.rewardHint=r.id;
    button.addEventListener('click',()=>run(async()=>{
      if(!await ask('Activate '+r.name+'?', 'Spend '+r.gems+' purchased gems? This pass will be added to your account immediately.', 'Activate VIP'))return;
      if(!redeemRequests.has(r.id))redeemRequests.set(r.id,crypto.randomUUID());
      await api('redeem',{reward:r.id,requestId:redeemRequests.get(r.id)});
      redeemRequests.delete(r.id);await loadAccount();message(r.name+' activated. Return to the ranch to enjoy your benefits.');
    }));
    card.append(node('b',r.name),hint,button); $('rewards').append(card);
  });
}
function render() {
  tackStore.render();
  $('auth').hidden = !catalog || !!account;
  $('guest').hidden = !catalog || !!account || activeTab === 'account';
  $('account').hidden = !account;
  for (const id of ['account-tools','redeem-section','cloud-section','history-section']) $(id).hidden = !account;
  for (const id of ['auth-submit','switch-auth','recover-auth','show-login','show-register','refresh','logout','cloud-upload','cloud-download','local-undo','retry']) $(id).disabled = working;
  $('auth-form').setAttribute('aria-busy', String(working));
  if (account) {
    $('username').textContent = account.user.username;
    $('balance').textContent = account.wallet.gems.toLocaleString();
    $('vip-status').textContent = account.wallet.held ? 'Paid VIP is paused while your account is on hold.' : account.wallet.vipUntil > Date.now() ? 'Paid VIP active until ' + date(account.wallet.vipUntil) : 'No paid VIP pass active.';
    $('hold-status').hidden = !account.wallet.held;
    $('cloud-summary').textContent = account.cloud.updated ? 'Backup saved' : 'No backup yet';
    $('cloud-status').textContent = account.cloud.updated ? 'Last cloud backup: ' + date(account.cloud.updated) : 'No cloud backup yet.';
    $('cloud-download').disabled = working || !account.cloud.revision;
    // Browser storage may be unavailable even though the account service works.
    try {$('local-undo').hidden = !localStorage.getItem(BACKUP);} catch {$('local-undo').hidden = true;}
    const entries = account.orders.filter(o => o.fulfilled).map(o => {
      const li=node('li'); li.append(node('b', allProducts().find(p=>p.id===o.product)?.name || o.product),node('span',money(o.cents)+' · '+date(o.fulfilled)+(o.refunded?' · refunded '+money(o.refunded):''))); return li;
    });
    $('history').replaceChildren(...(entries.length ? entries : [node('li','Your completed purchases will appear here.')]));
  }
  if (!catalog) return;
  buildCards(); $('checkout-note').hidden = catalog.checkoutEnabled;
  for (const buy of document.querySelectorAll('[data-product]')) {
    const p=catalog.products.find(item=>item.id===buy.dataset.product);
    buy.textContent=!account?'Sign in to buy':!catalog.checkoutEnabled?'Checkout coming soon':money(p.cents)+' · Test checkout';
    buy.disabled=working || (!!account && (!catalog.checkoutEnabled || account.wallet.held));
  }
  for (const button of document.querySelectorAll('[data-reward]')) {
    const r=catalog.rewards.find(item=>item.id===button.dataset.reward), balance=account?.wallet.gems || 0;
    button.disabled=working || !account || account.wallet.held || balance<r.gems;
    document.querySelector('[data-reward-hint="'+r.id+'"]').textContent=account?.wallet.held?'Account on hold':balance<r.gems?(r.gems-balance)+' more purchased gems needed':'Ready to activate';
  }
}
function setAuth(mode) {
  authMode=mode;
  $('auth-title').textContent=mode==='register'?'Your next chapter starts here.':mode==='recover'?'Get back to your ranch.':'Welcome back, rider.';
  $('auth-submit').textContent=mode==='register'?'Create account':mode==='recover'?'Reset password':'Sign in';
  $('switch-auth').textContent=mode==='login'?'Create an account':'Back to sign in';
  $('recover-auth').hidden=mode!=='login';$('recovery-label').hidden=mode!=='recover';
  $('auth-form').elements.recoveryCode.required=mode==='recover';
  $('auth-form').elements.recoveryCode.disabled=mode!=='recover';
  $('auth-form').elements.password.autocomplete=mode==='login'?'current-password':'new-password';
}
function showStaticPreview() {
  document.body.classList.add('static-preview');
  document.title = 'Store preview · Meadowlark';
  $('store-badge').textContent = 'Store preview';
  $('store-notice').replaceChildren(node('b','Purchases coming soon.'),node('span','Browse every tack piece and try on any look. Premium sets, gem packs and VIP display draft prices; purchases are not available here.'));
  $('store-notice').classList.add('preview-notice');
  for (const id of ['guest','account','recovery-result','tab-account','panel-account','redeem-section','confirm-dialog']) $(id).remove();
  document.querySelector('.status-row').remove();
  document.querySelector('#panel-gems h2').textContent = 'Explore gem packs.';
  document.querySelector('#panel-gems .section-heading p').textContent = 'Planned gem packs for optional VIP passes.';
  document.querySelector('#panel-gems .quiet-note').textContent = 'Draft prices · USD';
  document.querySelector('#panel-gems .store-details p').textContent = 'At launch, purchased gems will be a separate account balance for VIP passes. Gems earned while playing will stay in the game’s current shops. Nothing on this preview page changes your ranch or its balances.';
  document.querySelector('#panel-vip .section-heading p').textContent = 'Planned one-time VIP passes, with no automatic renewal.';
  document.querySelector('.vip-benefits .eyebrow').textContent = 'PLANNED VIP BENEFITS';
  $('vip-note').textContent = 'Paid VIP will become available when purchases launch. You can keep playing and earning rewards in the ranch today.';
  catalog = {checkoutEnabled:false, products:Object.entries(PRODUCTS).map(([id,p])=>({id,...p,currency:'usd'})), rewards:Object.entries(REWARDS).map(([id,r])=>({id,...r}))};
  buildCards();tackStore.render();
}
if (isStaticStore) showStaticPreview();
for (const tab of document.querySelectorAll('[data-tab]')) {
  tab.onclick=()=>selectTab(tab.dataset.tab);
  tab.onkeydown=e=>{
    const tabs=[...document.querySelectorAll('[data-tab]')],index=tabs.indexOf(tab);
    const next=e.key==='ArrowRight'?(index+1)%tabs.length:e.key==='ArrowLeft'?(index+tabs.length-1)%tabs.length:e.key==='Home'?0:e.key==='End'?tabs.length-1:-1;
    if(next<0)return;e.preventDefault();selectTab(tabs[next].dataset.tab,true);
  };
}
$('show-vip').onclick=()=>selectTab('vip',true);
for(const button of document.querySelectorAll('[data-store-section]'))button.onclick=()=>selectTab(button.dataset.storeSection,true);
selectTab(initialTab);
if (!isStaticStore) {
$('show-login').onclick=()=>showAuth('login');
$('show-register').onclick=()=>showAuth('register');
$('show-account').onclick=()=>selectTab('account',true);
$('switch-auth').onclick=()=>setAuth(authMode==='login'?'register':'login');
$('recover-auth').onclick=()=>setAuth('recover');
$('auth-form').onsubmit=e=>{e.preventDefault();run(async()=>{
  const body=Object.fromEntries(new FormData(e.target));
  const result=await api(authMode,body);account=result;e.target.reset();
  if(result.recoveryCode){$('recovery-code').textContent=result.recoveryCode;$('recovery-result').hidden=false;}
  selectTab(afterAuthTab,true);
  if(result.recoveryCode)$('recovery-result').focus();
  message('Signed in as '+account.user.username+'.');await reconcileReturn();
});};
$('recovery-done').onclick=()=>{$('recovery-code').textContent='';$('recovery-result').hidden=true;$('tab-'+activeTab).focus({preventScroll:true});};
$('refresh').onclick=()=>run(async()=>{
  await loadAccount();
  if(!account){showAuth('login');message('Your session ended. Sign in to see your purchases.');return;}
  if(!await reconcileReturn())message('Account refreshed.');
});
$('logout').onclick=()=>run(async()=>{
  await api('logout',{});clearAccount();setAuth('login');message('Signed out. Your purchases are safe in your account.');
});
$('cloud-upload').onclick=()=>run(async()=>{
  let save;try{save=JSON.parse(localStorage.getItem(SAVE));}catch{}
  if(!save?.horses?.length)throw Error('Play the ranch in this browser first, then come back to save it.');
  if(!await ask('Back up this ranch?', 'Save '+(save.ranchName||'this ranch')+' with '+save.horses.length+' horses to '+account.user.username+'? This replaces that account’s previous cloud backup.', 'Back up ranch'))return;
  await api('save',{save,revision:account.cloud.revision});await loadAccount();message('Ranch backed up to your account.');
});
$('cloud-download').onclick=()=>run(async()=>{
  const cloud=await api('save');
  if(!await ask('Restore your cloud ranch?', 'Restore '+(cloud.save.ranchName||'your ranch')+' with '+cloud.save.horses.length+' horses, saved '+date(cloud.updated)+'? This replaces the ranch in this browser.', 'Restore ranch'))return;
  const old=localStorage.getItem(SAVE);if(old)localStorage.setItem(BACKUP,old);else localStorage.removeItem(BACKUP);
  localStorage.setItem(SAVE,JSON.stringify(cloud.save));account.cloud={revision:cloud.revision,updated:cloud.updated};message('Ranch restored. Close any other ranch tabs, then return to the game.');
});
$('local-undo').onclick=()=>run(async()=>{
  if(!await ask('Undo the last restore?','Replace this browser’s ranch with the backup kept just before your last cloud restore?','Undo restore'))return;
  const old=localStorage.getItem(BACKUP);if(!old)throw Error('No local backup is available.');localStorage.setItem(SAVE,old);localStorage.removeItem(BACKUP);message('Previous ranch restored. Return to the game.');
});
async function reconcileReturn() {
  const params=new URLSearchParams(location.search), id=params.get('session_id');
  if(!account || !id || params.get('checkout')!=='success')return false;
  const result=await api('reconcile',{sessionId:id});await loadAccount();
  if(result.fulfilled){
    const url=new URL(location.href);url.searchParams.delete('checkout');url.searchParams.delete('session_id');
    history.replaceState(null,'',url.pathname+url.search+url.hash);if(params.get('tab')==='tack')selectTab('tack');message('Test purchase delivered to your account.');
  } else message('Payment has not been confirmed yet. Refresh your balance in a moment.');
  return true;
}
async function loadStore() {
  $('retry').hidden=true;
  try {
    catalog=await api('catalog');await loadAccount();message('');
    if(new URLSearchParams(location.search).get('checkout')==='cancelled')message('Checkout cancelled. No purchases were added.');
    await reconcileReturn();
  } catch(e) {$('retry').hidden=!!account;throw e;}
}
$('retry').onclick=()=>run(loadStore);
setAuth('login');
await run(loadStore);
}

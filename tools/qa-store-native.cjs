// Public/native storefront coverage. No browser, network, Stripe or real saves.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const html=fs.readFileSync(require.resolve('../store.html'),'utf8'),source=fs.readFileSync(require.resolve('../assets/store.js'),'utf8');
let checks=0;const check=(v,m)=>{assert(v,m);checks++;};
function fixtureDOM(){
 const ids=new Map();let document;
 const matchSimple=(e,selector)=>{const data=selector.match(/^\[([^=\]]+)(?:="([^"]+)")?\]$/);if(data)return e.getAttribute(data[1])!==null&&(data[2]===undefined||e.getAttribute(data[1])===data[2]);if(selector[0]==='#')return e.id===selector.slice(1);if(selector[0]==='.')return e.className.split(/\s+/).includes(selector.slice(1));return e.tagName===selector.toLowerCase();};
 const matches=(el,selector)=>{const parts=selector.trim().split(/\s+/);if(!matchSimple(el,parts.pop()))return false;let p=el.parent;while(parts.length){const next=parts.pop();while(p&&!matchSimple(p,next))p=p.parent;if(!p)return false;p=p.parent;}return true;};
 class Element{
  constructor(tag='div'){this.tagName=tag.toLowerCase();this.children=[];this.attrs={};this.dataset={};this.className='';this.listeners={};this.style={setProperty(){}};this.hidden=false;this.disabled=false;this.value='';this._text='';this.isConnected=false;this.classList={add:(...names)=>{this.className=[...new Set([...this.className.split(/\s+/),...names])].filter(Boolean).join(' ');},remove:name=>{this.className=this.className.split(/\s+/).filter(x=>x!==name).join(' ');},toggle:(name,on)=>{const has=this.className.split(/\s+/).includes(name);if(on??!has)this.classList.add(name);else this.classList.remove(name);}};}
  set id(value){this._id=value;ids.set(value,this);}get id(){return this._id;}
  set textContent(value){this._text=String(value);for(const c of this.children)c.connect(false);this.children=[];}get textContent(){return this._text+this.children.map(c=>c.textContent).join('');}
  set innerHTML(value){this._text=String(value);this.children=[];}get innerHTML(){return this._text;}
  setAttribute(k,v){this.attrs[k]=String(v);if(k==='id')this.id=v;if(k==='class')this.className=v;if(k==='hidden')this.hidden=true;if(k==='value')this.value=v;if(k.startsWith('data-'))this.dataset[k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=v;}
  getAttribute(k){if(k==='id')return this.id||null;if(k==='class')return this.className;if(k.startsWith('data-')){const value=this.dataset[k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())];return value===undefined?null:value;}return this.attrs[k]??null;}
  removeAttribute(k){delete this.attrs[k];}connect(value){this.isConnected=value;for(const c of this.children)c.connect(value);}
  append(...children){for(let c of children){if(typeof c==='string'){const t=new Element('#text');t.textContent=c;c=t;}c.parent=this;this.children.push(c);c.connect(this.isConnected);}}
  replaceChildren(...children){for(const c of this.children)c.connect(false);this.children=[];this._text='';this.append(...children);}
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(e=>e!==this);this.connect(false);}
  descendants(){return this.children.flatMap(e=>[e,...e.descendants()]);}
  querySelectorAll(selector){return this.descendants().filter(e=>selector.split(',').some(s=>matches(e,s)));}querySelector(s){return this.querySelectorAll(s)[0]||null;}
  contains(e){while(e){if(e===this)return true;e=e.parent;}return false;}
  addEventListener(name,fn){this.listeners[name]=fn;}getClientRects(){return this.hidden||!this.isConnected?[]:[{}];}focus(){document.activeElement=this;}scrollIntoView(){}reset(){}
  get options(){return this.children.filter(c=>c.tagName==='option');}
 }
 const root=new Element('html');root.connect(true);const stack=[root],voids=new Set(['meta','link','input','br','img','hr','source']);
 const clean=html.replace(/<script[\s\S]*?<\/script>/g,'').replace(/<!--[\s\S]*?-->/g,'');
 for(const token of clean.matchAll(/<\/?[a-z][^>]*>|[^<]+/gi)){
  const text=token[0];if(text.startsWith('</')){if(stack.length>1)stack.pop();continue;}if(!text.startsWith('<')){stack.at(-1)._text+=text;continue;}
  const name=text.match(/^<([a-z0-9-]+)/i)[1];const el=new Element(name);for(const attr of text.slice(name.length+1).matchAll(/([\w-]+)(?:="([^"]*)")?/g))el.setAttribute(attr[1],attr[2]??'');stack.at(-1).append(el);if(!voids.has(name))stack.push(el);
 }
 document={body:root.querySelector('body'),activeElement:null,getElementById:id=>ids.get(id)?.isConnected?ids.get(id):null,createElement:t=>new Element(t),querySelectorAll:s=>root.querySelectorAll(s),querySelector:s=>root.querySelector(s)};document.activeElement=document.body;
 ids.get('auth-form').elements=Object.fromEntries(['username','password','recoveryCode'].map(name=>[name,root.descendants().find(e=>e.getAttribute('name')===name)]));
 return {document,ids,Element};
}
(async()=>{
 const C=await import('../assets/tack-collection.mjs'),T=await import('../assets/store-tack.mjs'),P=await import('../assets/store-catalog.mjs');
 check(T.filterStoreTack().length===127,'public catalog contains every tack piece');
 check(T.filterStoreTack({kind:'coins'}).length===100&&T.filterStoreTack({kind:'free'}).length===3&&T.filterStoreTack({kind:'premium'}).length===24,'currency filters show honest counts');
 check(T.publicTackProducts().length===6&&T.publicTackProducts().every(p=>p.tack.pieceIds.length===4),'six complete premium looks');
 for(const piece of C.TACK_PIECES){const links=T.tackStoreLinks({item:piece.id,collection:piece.collectionId},'https://fixture.github.io/meadowlark-ranch/assets/store-tack.mjs');check(new URL(links.studio).pathname==='/meadowlark-ranch/tack-studio.html'&&new URL(links.studio).searchParams.get('item')===piece.id&&new URL(links.boutique).searchParams.get('collection')===piece.collectionId,'all 127 exact piece/collection links preserve project subpath');}
 for(const prefix of ['/meadowlark-ranch/','/']){
  const {document,ids}=fixtureDOM(),requests=[],navigations=[];
  const location={hostname:'fixture.github.io',href:'https://fixture.github.io'+prefix+'store.html?checkout=success&session_id=cs_test_fixture',search:'?checkout=success&session_id=cs_test_fixture',assign:u=>navigations.push(u)};
  const ctx=vm.createContext({document,location,isStaticStore:true,createTackStore:T.createTackStore,publicTackProducts:T.publicTackProducts,PRODUCTS:P.PRODUCTS,REWARDS:P.REWARDS,URL,URLSearchParams,Intl,console,crypto:{randomUUID},api:async(...args)=>{requests.push(args);throw Error('Static API call');},matchMedia:()=>({matches:true})});
  const code=source.replace(/^import .*;\n/gm,'');const ctrl=await vm.runInContext('(async()=>{'+code+';return {selectTab,buyProduct,tackStore};})()',ctx);
  check(requests.length===0,'static initial success-query page never calls account or payment APIs');
  check(!document.getElementById('tab-account')&&!document.getElementById('auth-form')&&!document.getElementById('confirm-dialog'),'account forms and transaction dialog removed from static DOM');
  check(document.querySelectorAll('[data-tab]').length===4&&ids.get('tab-discover').getAttribute('aria-selected')==='true','Discover is default with four public tabs');
  check(ids.get('store-notice').textContent.includes('Purchases coming soon'),'availability clearly stated');
  const filters=ids.get('tack-filter-options');filters.open=true;filters.listeners.keydown({key:'Escape',preventDefault(){}});
  check(filters.open===false&&document.activeElement===filters.querySelector('summary'),'Escape closes the filter panel and returns focus to its control');
  check(document.querySelectorAll('[data-product],[data-reward],[data-tack-checkout]').length===0,'no static payment or redemption controls');
  check(ids.get('store-sets').children.length===6,'six set picture cards visible');
  check(ids.get('tack-item-grid').children.every(c=>c.querySelector('.catalog-art')?.innerHTML.includes('<svg')),'every catalog card has a real SVG picture');
  const seen=new Set();let pages=0;
  do{for(const card of ids.get('tack-item-grid').children)seen.add(card.dataset.tackPiece);pages++;if(ids.get('tack-next').disabled)break;ids.get('tack-next').onclick();}while(pages<20);
  check(seen.size===127&&pages===11,'all 127 pictured cards reachable through 11 manageable pages');
  ids.get('tack-kind').value='free';ids.get('tack-kind').listeners.change();check(ids.get('tack-item-grid').children.length===3&&ids.get('tack-result-count').textContent==='1–3 of 3 pieces','free filter shows only three originals');
  ids.get('tack-search').value='not-a-piece';ids.get('tack-search').listeners.input();check(!ids.get('tack-empty').hidden,'empty search has clear reset');ids.get('tack-reset-empty').onclick();check(ids.get('tack-item-grid').children.length===12,'empty reset restores browsing');
  ctrl.tackStore.openLook('tack_starlight');check(ids.get('tack-look-detail').textContent.includes('Purchases coming soon')&&ids.get('tack-look-detail').querySelectorAll('figure').length===4,'static set detail lists four pictures and no fake checkout');
  ctrl.buyProduct('gems_40');ctrl.buyProduct('tack_starlight');check(requests.length===0&&navigations.length===0,'direct static checkout entry remains inert');
  const end={key:'End',preventDefault(){}};ids.get('tab-discover').onkeydown(end);check(ids.get('tab-vip').getAttribute('aria-selected')==='true','End skips removed account tab');
  ids.get('tab-vip').onkeydown({key:'ArrowRight',preventDefault(){}});check(ids.get('tab-discover').getAttribute('aria-selected')==='true','tab navigation wraps to Discover');
 }
 // Same component supports a real test backend only when it advertises the product.
 const {document,ids}=fixtureDOM();let account=null,catalog={checkoutEnabled:true},working=false;const buys=[];
 const tack=T.createTackStore({document,isStatic:false,getCatalog:()=>catalog,getAccount:()=>account,isWorking:()=>working,buyProduct:id=>buys.push(id),selectTab(){},params:new URLSearchParams('product=tack_rainbow')});
 check(document.querySelectorAll('[data-tack-checkout]').length===0,'old local backend does not invent premium checkout support');
 catalog.premiumTack={products:T.publicTackProducts()};tack.render();let buy=document.querySelector('[data-tack-checkout]');check(buy.textContent==='Sign in to buy','guest action requires account when backend advertises set');
 account={wallet:{held:false},tack:[]};tack.render();buy=document.querySelector('[data-tack-checkout]');check(buy.textContent==='$3.99 · Test checkout','test price and purchase mode explicit');buy.listeners.click();check(buys[0]==='tack_rainbow','checkout delegates exact server product ID');
 working=true;tack.render();check(document.querySelector('[data-tack-checkout]').disabled,'busy checkout disabled');working=false;account.wallet.held=true;tack.render();check(document.querySelector('[data-tack-checkout]').disabled,'held wallet cannot buy');
 account.wallet.held=false;account.tack=[{product:'tack_rainbow'}];tack.render();check(!document.querySelector('[data-tack-checkout]')&&document.querySelector('[data-tack-action]').textContent.includes('Choose a horse & equip'),'owned set goes to equip and cannot be bought twice');

 // Run the actual local controller: a reconnect must never repeat a transaction.
 async function localStore(fault){
  const {document,ids}=fixtureDOM(),calls=[],navigations=[];
  const player={user:{id:'test-player',username:'Rider'},wallet:{gems:40,vipUntil:0,held:false},cloud:{revision:0,updated:0},orders:[],tack:[]};
  const catalog={products:Object.entries(P.PRODUCTS).map(([id,p])=>({id,...p})),rewards:Object.entries(P.REWARDS).map(([id,p])=>({id,...p})),premiumTack:{products:T.publicTackProducts()},checkoutEnabled:true};
  let fail=fault;
  const api=async(path,body)=>{calls.push({path,body});if(path==='catalog')return catalog;if(path==='me')return player;if(path==='checkout'){if(fail)throw fail;return {url:'https://checkout.stripe.com/c/pay/cs_test_fixture'};}throw Error('Unexpected API request '+path);};
  const ctx=vm.createContext({document,location:{hostname:'localhost',href:'http://localhost/store.html',search:'',assign:u=>navigations.push(u)},isStaticStore:false,createTackStore:T.createTackStore,PRODUCTS:P.PRODUCTS,REWARDS:P.REWARDS,URL,URLSearchParams,Intl,console,crypto:{randomUUID},api,matchMedia:()=>({matches:true}),localStorage:{getItem:()=>null}});
  const ctrl=await vm.runInContext('(async()=>{'+source.replace(/^import .*;\n/gm,'')+';return {buyProduct,checkoutRequests,run};})()',ctx);
  return {ctrl,ids,calls,navigations,player,setFailure:value=>{fail=value;},settle:()=>new Promise(resolve=>setImmediate(resolve))};
 }
 for(const fault of [new TypeError('Failed to fetch'),Object.assign(new Error('aborted'),{name:'AbortError'}),Object.assign(new Error('expired'),{name:'TimeoutError'})]){
  const f=await localStore(fault),before=JSON.stringify(f.player);
  f.ctrl.buyProduct('tack_starlight');f.ctrl.buyProduct('tack_starlight');await f.settle();
  let purchases=f.calls.filter(c=>c.path==='checkout');
  check(purchases.length===1,'double click while buying creates only one checkout request');
  check(!f.ids.get('retry').hidden&&/reconnect/i.test(f.ids.get('message').textContent),'purchase-time offline and timeout errors expose reconnect guidance');
  check(f.ids.get('message').textContent!==fault.message,'network errors use player-facing guidance');
  const requestId=purchases[0].body.requestId;
  check(f.ctrl.checkoutRequests.get('tack_starlight')===requestId,'uncertain checkout retains its idempotency key');
  f.setFailure(null);await f.ids.get('retry').onclick();
  check(f.calls.filter(c=>c.path==='checkout').length===1&&f.navigations.length===0,'Reconnect reads catalog/account without replaying checkout or navigating');
  check(f.ids.get('retry').hidden&&f.ids.get('message').textContent.includes('no purchase was retried'),'successful reconnect removes recovery control and reports that no purchase was retried');
  check(JSON.stringify(f.player)===before,'recovery preserves the account, wallet and save state');
  f.ctrl.buyProduct('tack_starlight');await f.settle();purchases=f.calls.filter(c=>c.path==='checkout');
  check(purchases.length===2&&purchases[1].body.requestId===requestId,'a later explicit purchase retries the same request, preventing duplicate order creation');
  check(f.navigations.length===1&&new URL(f.navigations[0]).origin==='https://checkout.stripe.com','only an explicit successful checkout navigates to Stripe');
 }
 const rejected=await localStore(Object.assign(new Error('This account is on hold.'),{status:403}));
 rejected.ctrl.buyProduct('tack_starlight');await rejected.settle();
 check(rejected.ids.get('message').textContent==='This account is on hold.'&&rejected.ids.get('retry').hidden,'ordinary server errors remain intact instead of suggesting reconnection');
 check(!fs.readFileSync(require.resolve('../assets/store-tack.mjs'),'utf8').includes('weekly-horses'),'no retired weekly horse runtime dependency');
 console.log(`Native storefront QA passed: ${checks} checks; 127 illustrated items, 6 sets, static zero-API controls and backend-gated local checkout.`);
})().catch(error=>{console.error(error);process.exitCode=1;});

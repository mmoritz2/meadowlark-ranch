/* Feature-module scaffold check.
   Boots ranch3d.html?qa=features against a local server, waits for the horse, and proves the
   scaffold contract: window.__features exists, every FEATURES entry installed without error,
   the shared save fields are present, hooks fire, registries splice into the renderers, and
   render_game_to_text carries the new keys. Prints the state dump at the end.

   Usage:  QA_URL=http://127.0.0.1:8431 NODE_PATH=$(npm root -g) node tools/qa-features.cjs
   Server: python3 tools/serve-preview.py   (127.0.0.1:8431)
   Every feature package copies this shape as tools/qa-<pkg>.cjs. */
const {chromium}=require('playwright');
const base=(process.env.QA_URL||'http://127.0.0.1:8431').replace(/\/$/,'');
const url=base+'/ranch3d.html?qa=features&fresh='+Date.now();
const checks=[];
function check(name,ok,detail){checks.push({name,ok:!!ok,detail});console.log((ok?'PASS ':'FAIL ')+name+(detail!==undefined?' — '+JSON.stringify(detail):''));}
const t0=Date.now();
const stage=s=>console.log('… '+s+' @'+((Date.now()-t0)/1000).toFixed(1)+'s');
let browser=null;
setTimeout(async()=>{console.error('WATCHDOG: no result after 600 s');try{if(browser)await browser.close();}catch(e){}process.exit(3);},600000).unref();
(async()=>{
 browser=await chromium.launch({headless:true,args:['--disable-background-timer-throttling','--use-angle=metal','--enable-gpu-rasterization','--ignore-gpu-blocklist']});
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 const errors=[];
 page.on('pageerror',e=>errors.push('PAGEERROR '+e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 page.on('dialog',d=>{d.dismiss().catch(()=>{});});
 stage('launch'); await page.goto(url,{waitUntil:'load',timeout:120000}); stage('loaded');
 await page.waitForFunction(()=>window.render_game_to_text&&(()=>{try{const s=JSON.parse(render_game_to_text());return s.graphics&&s.graphics.horseReady&&!s.graphics.horseLoading;}catch(e){return false;}})(),null,{timeout:150000,polling:250});
 stage('horseReady');
 const r=await page.evaluate(()=>{
  console.log('qa: evaluate start');
  const G=window.__features, out={};
  out.hasG=!!G;
  if(!G)return out;
  out.installed=G.installed.slice(); out.errors=G.errors.slice();
  out.hasHooks=['on','run','off','addMul','mul'].every(k=>typeof G[k]==='function');
  out.groups=['save','money','xp','quest','tables','horse','world','net','time','course','ui'].filter(k=>!G[k]);
  const s=G.save.fresh();
  out.saveFields=['items','stats','life','flags','mig','pid','dust','inbox','btok','tokens','doors','perks','mastery','wardrobe','codes','seenBuild','friends','blocked','rider','keymap','a11y','story'].filter(k=>s[k]===undefined);
  out.pid=s.pid; out.storyV=s.story&&s.story.v;
  const h=s.horses[0];
  out.horseFields=['traits','variant','blood','hair','acc','fx','sex','bondDay','trait','lineage'].filter(k=>h[k]===undefined);
  /* hooks + multipliers */
  let ticks=0; G.on('tick',()=>{ticks++;});
  G.addMul('xp',()=>2);
  const lvl0=G.horse.ridden().level, xp0=G.horse.ridden().xp;
  G.xp.addXp3D(10);
  const h1=G.save.fresh().horses[G.horse.rideIdx()];
  out.xpMul={before:xp0,after:h1.xp,level:h1.level,lvl0};
  /* rewards */
  let paid=null; G.save.sync(sv=>{const g0=sv.gems,c0=sv.coins,k0=sv.keys;G.money.payReward(sv,{c:5,g:2,k:1,dust:3,btok:1,items:{carrot:2}});paid={dc:sv.coins-c0,dg:sv.gems-g0,dk:sv.keys-k0,dust:sv.dust,btok:sv.btok,carrot:sv.items.carrot};});
  out.paid=paid; out.rewardLabel=G.money.rewardLabel({c:5,g:2,k:1});
  /* stat xp */
  let sxp=null; G.save.sync(sv=>{const hh=sv.horses[0];const v0=hh.stats.speed;const R=G.xp.grantStatXp(sv,hh,'speed',1000);sxp={v0,v1:hh.stats.speed,cap:R.cap,ceil:G.xp.statCeil(hh,'speed')};});
  out.sxp=sxp;
  G.tables.BREED_CEIL['bay-sporthorse']={speed:4};
  out.ceilOverride=G.xp.statCeil(G.horse.ridden(),'speed');
  delete G.tables.BREED_CEIL['bay-sporthorse'];
  /* grantHorse + foal hooks */
  let gh=0,fl=0; G.on('grantHorse',()=>{gh++;}); G.on('foal',()=>{fl++;});
  let n0=0,n1=0,foal=null; G.save.sync(sv=>{n0=sv.horses.length;G.horse.grantHorse(sv,'bay',{name:'QA Horse',src:'qa'});const a=sv.horses[0],b=sv.horses[sv.horses.length-1];foal=G.horse.makeFoal(sv,a,b,{src:'qa'});n1=sv.horses.length;});
  out.grant={n0,n1,gh,fl,foalIsFoal:foal&&foal.foal,lineage:foal&&foal.lineage};
  /* breed sources */
  const kestrel=G.tables.BREEDS3.find(b=>b[0]==='kestrel');
  out.kestrel={src:G.horse.breedSrc(kestrel),shop:G.horse.breedAvailable(kestrel,'shop'),summon:G.horse.breedAvailable(kestrel,'summon'),market:G.horse.breedAvailable(kestrel,'market')};
  const bay=G.tables.BREEDS3.find(b=>b[0]==='bay'); out.bayShop=G.horse.breedAvailable(bay,'shop');
  /* panel + dock + section + action registries */
  let acted=null;
  G.ui.action('qa',(args)=>{acted=args.slice();});
  G.ui.panel({id:'qaPanel',title:'QA',dock:{label:'🧪 QA',after:'questBtn',pip:()=>3},hotkey:'KeyJ',render(p,s){return '<div class="ph">QA panel '+(s.pid||'')+'</div><button data-fx="qa:go:7">go</button><button data-fx="close">x</button>';},vr:{tab:'qa',label:'QA',build(rows){return 'qa';}}});
  G.ui.careSection((s,h)=>'<div id="qaCareSect">care-section-'+h.name+'</div>');
  G.ui.shopTab({id:'qatab',label:'🧪 Tab',render(s,h){return '<div id="qaShopTab">shop-tab</div>';}});
  G.ui.questTab({id:'qaq',label:'Q',render(s){return '<div id="qaQuestTab">quest-tab</div>';}});
  G.ui.lbTab({id:'qal',label:'L',render(s){return '<div id="qaLbTab">lb-tab</div>';}});
  G.ui.eventCard(()=>'<div id="qaEventCard">event-card</div>');
  G.ui.stableRow((h,i)=>'<i class="qaStableRow"></i>');
  G.ui.onlineSection(()=>'<div id="qaOnline">online</div>');
  G.ui.open('qaPanel');
  const panel=document.getElementById('qaPanel');
  out.panel={exists:!!panel,cls:panel&&panel.className,shown:panel&&panel.style.display,text:panel&&panel.textContent.slice(0,40),btn:!!document.getElementById('qaBtn'),btnParent:document.getElementById('qaBtn')&&document.getElementById('qaBtn').parentNode.id,prev:document.getElementById('qaBtn')&&document.getElementById('qaBtn').previousElementSibling.id,pip:document.getElementById('qaBtn')&&(document.getElementById('qaBtn').querySelector('.pip')||{}).textContent,vrTab:G.ui.TABS.some(t=>t[0]==='qa')};
  panel.querySelector('[data-fx="qa:go:7"]').click();
  out.acted=acted;
  panel.querySelector('[data-fx="close"]').click();
  out.closed=panel.style.display;
  G.ui.openCare(); out.careSect=!!document.getElementById('qaCareSect');
  G.ui.openShop('qatab'); out.shopTab=!!document.getElementById('qaShopTab');
  G.ui.renderQuests(); out.questTabBtn=!!document.querySelector('[data-q="tab:qaq"]');
  G.ui.openEvents(); out.eventCard=!!document.getElementById('qaEventCard');
  G.ui.openStable(); out.stableRows=document.querySelectorAll('.qaStableRow').length;
  G.ui.openOnline(); out.online=!!document.getElementById('qaOnline');
  G.hidePanels();
  out.hiddenAll=G.ui.panels.every(id=>document.getElementById(id).style.display==='none');
  /* hotkey toggles the panel */
  window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyJ'}));   // the game listens on window; a document dispatch would bubble there too and toggle twice
  out.hotkeyOpened=panel.style.display;
  G.hidePanels();
  /* key hook swallows */
  let swallowed=false; const kf=G.on('key',e=>{if(e.code==='KeyZ'){swallowed=true;return true;}}); window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyZ'})); G.off('key',kf); out.keyHook=swallowed;
  /* tables / world helpers */
  const ft0=G.tables.FT.length; G.world.addFT(['🧪 QA spot',3,3]); out.ft={n:G.tables.FT.length-ft0,btn:document.querySelectorAll('#ftBar [data-ft]').length===G.tables.FT.length};
  const rg0=G.tables.REGIONS.length; G.world.addRegion({name:'🧪 QA zone',x:5000,z:5000,r:5}); out.region={added:G.tables.REGIONS.length-rg0,catchAllLast:G.tables.REGIONS[G.tables.REGIONS.length-1].r>=999,at:G.world.regionAt(0,0)&&G.world.regionAt(0,0).name};
  const t0=G.world.things.length; let used=false; G.world.addThing({kind:'qa',id:'qa1',x:G.horse.player.pos.x,z:G.horse.player.pos.z,g:null,label:()=>'🧪 QA thing (E)',use:()=>{used=true;}});
  window.advanceTime(100); const ctx=document.getElementById('ctx').textContent; window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyE'}));
  out.thing={added:G.world.things.length-t0,ctx,used}; G.world.things.pop();
  const npc0=G.world.npcList.length; G.world.addNPC({id:'qanpc',name:'QA Tester',icon:'🧪',x:900,z:900,idle:'hi'}); out.npc={added:G.world.npcList.length-npc0,def:G.quest.NPC_DEFS.some(d=>d.id==='qanpc')};
  const b0=G.tables.BOARDS.length; G.world.addBoard({k:'qa_board',g:'hobby',label:'QA',rate:1,val:s=>42}); out.board={added:G.tables.BOARDS.length-b0};
  G.world.mapMarkers.push({x:1,z:1,glyph:'🧪',label:'QA'}); G.world.miniMarkers.push({x:1,z:1});
  /* quests */
  const d0=G.quest.DAILYQ.length; G.quest.addDaily({type:'qa',icon:'🧪',label:'QA',goal:1,r:{c:1}}); out.daily=G.quest.DAILYQ.length-d0;
  const a0=G.quest.ACHS.length; G.quest.addAch({id:'qa1',icon:'🧪',label:'QA',desc:'qa',v:s=>1,goal:1,r:{c:1}}); out.ach=G.quest.ACHS.length-a0;
  const st0=G.quest.STORY.length; G.quest.story.append([{label:'QA',text:'qa',type:'qa',goal:1,reward:{c:1}}]); out.story=G.quest.STORY.length-st0;
  let de=null; G.on('dailyEvt',(t,v)=>{de=[t,v];}); G.quest.dailyEvt('qa',1); out.dailyHook=de;
  /* multipliers on the ride hook */
  let rideSeen=false; G.on('ride',R=>{rideSeen=true;R.target=0;}); window.advanceTime(50); out.rideHook=rideSeen;
  /* net */
  G.net.subscribe('qa'); out.netSub=G.net.subs.includes('qa'); out.netPublishOffline=G.net.publish('qa',{a:1});
  let msg=null; G.on('message',(topic,m)=>{if(topic.endsWith('/qa')){msg=m;return true;}}); G.net.onMessage('srf1/x/qa',JSON.stringify({id:'other',v:9})); out.netMsg=msg&&msg.v;
  let chat=null; G.on('chat',(m,nm)=>{chat=nm;return true;}); G.net.onMessage('srf1/x/chat',JSON.stringify({id:'other',n:'Rider9',t:'hi'})); out.chatHook=chat;
  out.isoWeek=G.time.isoWeekKey(Date.UTC(2026,8,11)); // Friday 2026-09-11 -> Monday 2026-09-07
  window.advanceTime(200); out.ticks=ticks;   // 12 fixed 1/60 s steps, each a full render: kept small so a loaded machine still finishes
  const state=JSON.parse(render_game_to_text());
  out.state={keys:['build','pid','story','net','features'].filter(k=>state[k]===undefined),walletKeys:Object.keys(state.wallet),horseKeys:Object.keys(state.horse)};
  let stHook=false; G.on('state',o=>{o.qa=1;stHook=true;}); out.stateHook=JSON.parse(render_game_to_text()).qa===1&&stHook;
  return out;
 });
 check('window.__features exists',r.hasG);
 check('all 16 packages installed without error',r.installed&&r.installed.length===16&&r.errors.length===0,{installed:r.installed,errors:r.errors});
 check('event bus + multipliers',r.hasHooks);
 check('context groups present',r.groups&&r.groups.length===0,r.groups);
 check('ensureCore save fields',r.saveFields&&r.saveFields.length===0,{missing:r.saveFields,pid:r.pid,storyV:r.storyV});
 check('horse ensures',r.horseFields&&r.horseFields.length===0,r.horseFields);
 check('xp multiplier applied (10 xp x2 x ranch)',r.xpMul&&(r.xpMul.after-r.xpMul.before===20||r.xpMul.level>r.xpMul.lvl0),r.xpMul);
 check('payReward pays c/g/k/dust/btok/items',r.paid&&r.paid.dc===5&&r.paid.dg===2&&r.paid.dk===1&&r.paid.dust===3&&r.paid.btok>=1&&r.paid.carrot>=2,r.paid);
 check('rewardLabel',r.rewardLabel==='5🪙 2💎 1🗝️',r.rewardLabel);
 check('grantStatXp caps at level/breed ceiling',r.sxp&&r.sxp.v1===r.sxp.cap&&r.sxp.v1>r.sxp.v0,r.sxp);
 check('BREED_CEIL overrides statCeil',r.ceilOverride===4,r.ceilOverride);
 check('grantHorse + makeFoal fire hooks',r.grant&&r.grant.n1===r.grant.n0+2&&r.grant.gh===1&&r.grant.fl===1&&r.grant.foalIsFoal,r.grant);
 check('Kestrel is story-only (no shop/market/summon leak)',r.kestrel&&r.kestrel.src==='story'&&!r.kestrel.shop&&!r.kestrel.summon&&!r.kestrel.market&&r.bayShop,r.kestrel);
 check('G.ui.panel creates panel + dock button after questBtn + pip + VR tab',r.panel&&r.panel.exists&&r.panel.cls==='fpanel'&&r.panel.shown==='flex'&&r.panel.btn&&r.panel.btnParent==='dock'&&r.panel.prev==='questBtn'&&r.panel.pip==='3'&&r.panel.vrTab,r.panel);
 check('data-fx dispatch',r.acted&&r.acted[0]==='go'&&r.acted[1]==='7',r.acted);
 check('close action',r.closed==='none',r.closed);
 check('care section spliced',r.careSect);
 check('shop tab registered',r.shopTab);
 check('quest tab registered',r.questTabBtn);
 check('event card spliced',r.eventCard);
 check('stable rows spliced',r.stableRows>=1,r.stableRows);
 check('online section spliced',r.online);
 check('hidePanels covers registered panels',r.hiddenAll);
 check('panel hotkey toggles',r.hotkeyOpened==='flex',r.hotkeyOpened);
 check('key hook swallows',r.keyHook);
 check('addFT rebuilds the bar',r.ft&&r.ft.n===1&&r.ft.btn,r.ft);
 check('addRegion keeps the catch-all last',r.region&&r.region.added===1&&r.region.catchAllLast,r.region);
 check('addThing label/use',r.thing&&r.thing.added===1&&/QA thing/.test(r.thing.ctx)&&r.thing.used,r.thing);
 check('addNPC',r.npc&&r.npc.added===1&&r.npc.def,r.npc);
 check('addBoard',r.board&&r.board.added===1);
 check('addDaily/addAch/story.append',r.daily===1&&r.ach===1&&r.story===1,{daily:r.daily,ach:r.ach,story:r.story});
 check('dailyEvt hook',r.dailyHook&&r.dailyHook[0]==='qa',r.dailyHook);
 check('ride hook runs',r.rideHook);
 check('net subscribe/publish/onMessage/chat hooks',r.netSub&&r.netPublishOffline===false&&r.netMsg===9&&r.chatHook==='Rider9',{sub:r.netSub,pub:r.netPublishOffline,msg:r.netMsg,chat:r.chatHook});
 check('isoWeekKey is the Monday',r.isoWeek==='2026-09-07',r.isoWeek);
 check('tick hook fires per frame',r.ticks>=10,r.ticks);
 check('render_game_to_text base additions',r.state&&r.state.keys.length===0&&r.state.walletKeys.includes('keys')&&r.state.walletKeys.includes('dust')&&r.state.horseKeys.includes('bond'),r.state);
 check('state hook appends',r.stateHook);
 console.log(await page.evaluate(()=>render_game_to_text()));
 /* A returning player: a legacy save shape (array friends, breedVoucher, tackRoom, no pid)
    must boot through the migration pass and come out with the shared fields migrated. */
 await page.evaluate(()=>{
  const legacy={v:2,ranchName:'Meadowlark Ranch',founded:Date.now()-864e5*3,coins:999,gems:9,items:{carrot:3},nextId:2,decor:[],projects:{},trophies:{},wild:null,wildTrust:0,muted:false,
   lastSeen:Date.now()-3600e3,lastDaily:'',questDate:'',quests:[],totalRaces:0,started:true,keys:2,tack:[],
   horses:[{id:1,name:'Clover',breed:'bay-sporthorse',colors:{body:'#765035',mane:'#221b16'},horn:false,rainbow:false,stats:{speed:3,stamina:3,jump:3,accel:3,agility:3},sxp:{},level:1,xp:0,bond:25,needs:{hunger:90,thirst:90,clean:90,happy:90},foal:false,tack:null}],
   breedVoucher:true,tackRoom:'2026-36',friends:['Ann','Bo'],story:{idx:3,prog:1}};
  localStorage.setItem('starRanchFable_v1',JSON.stringify(legacy));
 });
 stage('legacy save seeded'); await page.goto(base+'/ranch3d.html?qa=features&legacy='+Date.now(),{waitUntil:'load',timeout:120000}); stage('legacy loaded');
 await page.waitForFunction(()=>window.render_game_to_text&&(()=>{try{const s=JSON.parse(render_game_to_text());return s.graphics&&s.graphics.horseReady&&!s.graphics.horseLoading;}catch(e){return false;}})(),null,{timeout:150000,polling:250});
 stage('legacy horseReady');
 const L=await page.evaluate(()=>{const G=window.__features;const s=G.save.fresh();return {btok:s.btok,voucher:s.breedVoucher,door:s.doors&&s.doors.tackroom,tackRoom:s.tackRoom,friends:s.friends,pid:s.pid,story:s.story,coins:s.coins,horses:s.horses.length,installed:G.installed.length,net:JSON.parse(render_game_to_text()).net,lineage:s.horses[0].lineage};});
 check('legacy save migrates (btok, doors.tackroom, friends{}, pid, story.v)',L.btok===1&&L.voucher===undefined&&L.door==='2026-36'&&L.tackRoom===undefined&&L.friends&&L.friends.Ann===true&&L.friends.Bo===true&&/^MR-/.test(L.pid)&&L.story.idx===3&&L.story.v===1&&L.horses===1&&L.installed===16&&L.lineage,L);
 check('no console/page errors',errors.length===0,errors.slice(0,5));
 await browser.close();
 const failed=checks.filter(c=>!c.ok);
 console.log(failed.length?('FAILED '+failed.length+'/'+checks.length):('ALL '+checks.length+' CHECKS PASSED'));
 process.exit(failed.length?1:0);
})().catch(e=>{console.error('FATAL',e);process.exit(2);});

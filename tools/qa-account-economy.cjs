/* Package check: account-economy.
   Boots ranch3d.html?qa=account-economy, waits for the horse, then drives every feature of the
   package through window.__features and the DOM: Player ID + export/import, gift codes, the
   inbox and news, the settings screen (audio, graphics, controls remap, accessibility, codes,
   account), the touch emote strip, the Enter chat hotkey, the currency overview, race tickets
   and double stakes, the gem exchange, double-gem weekends, the welcome week, Ranch Prestige
   (perks, shop, event bonus) and the Star Point sources. A second load seeds a veteran save
   with a pending letter and a closed week, then imports the first ranch's save code.

   Usage:  QA_URL=http://127.0.0.1:8431 NODE_PATH=$(npm root -g) node tools/qa-account-economy.cjs */
const {chromium}=require('playwright');
const base=(process.env.QA_URL||'http://127.0.0.1:8431').replace(/\/$/,'');
const checks=[];
function check(name,ok,detail){checks.push({name,ok:!!ok,detail});console.log((ok?'PASS ':'FAIL ')+name+(detail!==undefined?' — '+JSON.stringify(detail):''));}
const t0=Date.now();
const stage=s=>console.log('… '+s+' @'+((Date.now()-t0)/1000).toFixed(1)+'s');
const READY=()=>window.render_game_to_text&&(()=>{try{const s=JSON.parse(render_game_to_text());return s.graphics&&s.graphics.horseReady&&!s.graphics.horseLoading;}catch(e){return false;}})();
let browser=null;
setTimeout(async()=>{console.error('WATCHDOG: no result after 600 s');try{if(browser)await browser.close();}catch(e){}process.exit(3);},600000).unref();
(async()=>{
 browser=await chromium.launch({headless:true,args:['--disable-background-timer-throttling','--use-angle=metal','--enable-gpu-rasterization','--ignore-gpu-blocklist']});
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 const errors=[];
 page.on('pageerror',e=>errors.push('PAGEERROR '+e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 page.on('dialog',d=>{d.dismiss().catch(()=>{});});
 stage('launch');
 await page.addInitScript(()=>{try{localStorage.removeItem('starRanchFable_v1');}catch(e){}});   // a brand-new ranch
 await page.goto(base+'/ranch3d.html?qa=account-economy&fresh='+Date.now(),{waitUntil:'load',timeout:120000}); stage('loaded');
 await page.waitForFunction(READY,null,{timeout:150000,polling:250}); stage('horseReady');
 const r=await page.evaluate(()=>{
  const G=window.__features, A=G.account, S=G.save, out={};
  const st=()=>JSON.parse(render_game_to_text());
  const sv=()=>S.fresh();
  out.installed=G.installed.includes('account-economy'); out.errors=G.errors.slice();
  /* player id + build + boot grants */
  let s=sv(); out.pid=s.pid; out.statePid=st().pid; out.build=st().build; out.seenBuild=s.seenBuild; out.tickets=s.tickets; out.welcomeDay=s.welcome.day;
  out.netId=G.net.net.id;
  /* inbox: the news letter is waiting, the dock button sits after Quests, the pip counts it */
  const ib=document.getElementById('inboxBtn');
  out.inboxBtn={exists:!!ib,prev:ib&&ib.previousElementSibling.id,pip:ib&&(ib.querySelector('.pip')||{}).textContent};
  ib.click(); const ip=document.getElementById('inboxPanel');
  out.inboxOpen={shown:ip.style.display,hasNews:/inbox, the settings/i.test(ip.textContent),claimBtn:!!ip.querySelector('[data-fx^="inbox:claim:news-"]')};
  let c0=st().wallet.coins,g0=st().wallet.gems; const gm=A.gemMul();
  ip.querySelector('[data-fx^="inbox:claim:news-"]').click();
  out.newsClaim={dc:st().wallet.coins-c0,dg:st().wallet.gems-g0,gm,claimed:!!sv().inbox.find(x=>x.id.startsWith('news-')).claimed};
  /* news tab */
  ip.querySelector('[data-fx="acct:itab:news"]').click();
  const sn=G.time.seasonNow();
  out.news={rows:ip.querySelectorAll('.qrow').length,season:ip.textContent.includes(sn.def.name),x2:/double-gem/i.test(ip.textContent)};
  G.hidePanels();
  /* welcome week */
  G.ui.openQuests(); const qp=document.getElementById('questPanel');
  const wtab=qp.querySelector('[data-q="tab:welcome"]'); out.welcomeTab=!!wtab; if(wtab)wtab.click();
  const wd=qp.querySelector('[data-fx="acct:welcome:0"]'); out.welcomeDay0={open:!!wd,text:qp.textContent.includes('first week')};
  c0=st().wallet.coins;g0=st().wallet.gems; if(wd)wd.click();
  s=sv(); out.welcomeClaim={dc:st().wallet.coins-c0,dg:st().wallet.gems-g0,claimed:!!s.welcome.claimed[0],day1Locked:!qp.querySelector('[data-fx="acct:welcome:1"]')};
  G.hidePanels();
  /* settings: button in the system tray, codes */
  const sb=document.getElementById('settingsBtn'); out.settingsBtn={exists:!!sb,parent:sb&&sb.parentNode.id};
  sb.click(); const sp=document.getElementById('settingsPanel'); out.settingsOpen=sp.style.display;
  sp.querySelector('[data-fx="acct:stab:codes"]').click();
  const ci=document.getElementById('codeIn'); ci.value='MEADOWLARK'; sp.querySelector('[data-fx="acct:redeem"]').click();
  s=sv(); out.code={stamped:typeof s.codes.MEADOWLARK==='number',letter:!!s.inbox.find(x=>x.id==='code-MEADOWLARK'&&!x.claimed)};
  c0=st().wallet.coins; G.inbox.claim('code-MEADOWLARK'); out.code.dc=st().wallet.coins-c0;
  const toasts=()=>document.getElementById('toasts').textContent;
  ci.value='MEADOWLARK'; sp.querySelector('[data-fx="acct:redeem"]').click(); out.code.again=A.redeemCode('MEADOWLARK')===false;
  c0=st().wallet.coins; out.code.lower=A.redeemCode('meadowlark')===false&&st().wallet.coins===c0;
  out.code.bad=A.redeemCode('NOPE-123')===false;
  /* settings: accessibility */
  sp.querySelector('[data-fx="acct:stab:access"]').click();
  sp.querySelector('[data-fx="acct:textScale:1.3"]').click();
  sp.querySelector('[data-fx="acct:cb:deutan"]').click();
  sp.querySelector('[data-fx="acct:contrast"]').click();
  s=sv(); out.a11y={scale:document.documentElement.style.getPropertyValue('--ui-scale'),saved:s.a11y.textScale,cb:document.body.classList.contains('cb-deutan'),contrast:document.body.classList.contains('hi-contrast'),savedCb:s.a11y.cb};
  sp.querySelector('[data-fx="acct:textScale:1"]').click(); sp.querySelector('[data-fx="acct:cb:none"]').click(); sp.querySelector('[data-fx="acct:contrast"]').click();
  /* settings: graphics */
  sp.querySelector('[data-fx="acct:stab:gfx"]').click();
  sp.querySelector('[data-fx="acct:quality:low"]').click();
  s=sv(); out.gfx={q:st().graphics.quality,saved:s.quality,locked:s.qualityLocked,bloomOff:G.gfx.bloom()===false};
  sp.querySelector('[data-fx="acct:quality:high"]').click();
  /* settings: audio */
  sp.querySelector('[data-fx="acct:stab:audio"]').click();
  const vol=sp.querySelector('[data-fxin="acct:vol"]'); vol.value='40'; vol.dispatchEvent(new Event('change'));
  out.audio={vol:G.audio.vol(),saved:sv().sfxVol};
  const wasMuted=G.audio.muted(); sp.querySelector('[data-fx="acct:mute"]').click(); out.audio.muteToggled=G.audio.muted()!==wasMuted&&sv().muted===G.audio.muted(); sp.querySelector('[data-fx="acct:mute"]').click();
  /* settings: controls remap — Quests from J to Z, then back */
  sp.querySelector('[data-fx="acct:stab:controls"]').click();
  out.controls={rows:sp.querySelectorAll('[data-fx^="acct:remap:"]').length,fixed:sp.textContent.includes('Ride forward')};
  sp.querySelector('[data-fx="acct:remap:quests"]').click();
  window.dispatchEvent(new KeyboardEvent('keydown',{code:'Semicolon'}));
  s=sv(); out.remap={saved:s.keymap.quests};
  G.hidePanels();
  window.dispatchEvent(new KeyboardEvent('keydown',{code:'Semicolon'})); out.remap.zOpens=document.getElementById('questPanel').style.display; G.hidePanels();
  window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyJ'})); out.remap.jDead=document.getElementById('questPanel').style.display; G.hidePanels();
  A.remapKey('quests','KeyJ'); out.remap.cleared=sv().keymap.quests===undefined;
  window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyJ'})); out.remap.jBack=document.getElementById('questPanel').style.display; G.hidePanels();
  out.remap.clash=A.remapKey('shop','KeyJ')===false&&A.remapKey('quests','KeyZ')===false&&sv().keymap.quests===undefined;   // J is Quests, Z is Wild mode
  /* Enter opens the chat bar */
  window.dispatchEvent(new KeyboardEvent('keydown',{code:'Enter'}));
  out.chat={bar:document.getElementById('chatBar').style.display,focus:document.activeElement&&document.activeElement.id};
  document.activeElement.blur(); document.getElementById('chatBar').style.display='none';
  /* gem exchange + gem-spend star points */
  S.sync(x=>{x.gems=40;}); G.money.refreshWallet();
  let k0=sv().keys; A.buyGem('key'); s=sv(); out.gemKey={dk:s.keys-k0,gems:s.gems,sp:((s.sp||{}).src||{}).gems||0};
  A.buyGem('ticket'); s=sv(); out.gemTicket={gems:s.gems,tickets:s.tickets,spGems:((s.sp||{}).src||{}).gems||0,spPts:(s.sp||{}).pts||0};
  G.hidePanels();
  /* star points: a daily quest claim, the umbrella, a tack level, a foraged truffle */
  const q=G.quest.todayDaily()[0]; const spBefore=(sv().sp||{}).pts||0;
  S.sync(x=>{x.dq=x.dq||{};x.dq.date=new Date().toDateString();x.dq.prog=x.dq.prog||{};x.dq.claimed=x.dq.claimed||{};x.dq.prog[q.type]=q.goal;});
  /* The total ⭐ a claim pays is not ours alone — the base game also pays ⭐ for the stat and
     level the quest's XP reward buys — so the ledger's own 'daily' line is what we assert. */
  G.quest.claimDaily(q.type); s=sv(); out.spDaily={d:((s.sp||{}).src||{}).daily||0,all:((s.sp||{}).pts||0)-spBefore,src:((s.sp||{}).src||{}).daily,prestigeDeeds:s.prestige.pts};
  /* Sibling packages add their own dailies through addDaily, so the umbrella tally is
     10⭐ per daily on the board today, not a fixed three. */
  out.dailyN=G.quest.todayDaily().length;
  S.sync(x=>{for(const qq of G.quest.todayDaily())x.dq.claimed[qq.type]=true;x.dq.umbrella=true;}); A.walletWatch(); s=sv(); out.spUmb={src:((s.sp||{}).src||{}).umbrella,daily:((s.sp||{}).src||{}).daily,want:10*out.dailyN};
  S.sync(x=>{x.tack=x.tack||[];x.tack.push({id:'qa-rare',slot:'saddle',rarity:'Rare',name:'QA saddle',bonus:{speed:1},lvl:1});}); A.walletWatch();
  S.sync(x=>{x.tack.find(t=>t.id==='qa-rare').lvl=2;}); A.walletWatch(); s=sv(); out.spTack=((s.sp||{}).src||{}).tack;
  S.sync(x=>{x.items.truffle=(x.items.truffle||0)+1;}); G.quest.dailyEvt('carrots',1); s=sv(); out.spForage=((s.sp||{}).src||{}).forage;
  /* prestige: 10 stalls (400 builder pts) + 40 ribbons (120) + 4 trophies (100) = 620 -> level 4.
     Mastery is cleared first: a fresh ranch already carries a breed mastery point from the
     starter horse (10 prestige points), and that would make the arithmetic here drift. */
  S.sync(x=>{x.mastery={};x.decor=[];for(let i=0;i<10;i++)x.decor.push({id:'q'+i,t:'stall',x:0,z:0,ry:0});x.ribbonTotal=40;x.trophies={a:1,b:1,c:1,d:1};});
  G.money.refreshWallet(); s=sv();
  out.prestige={pts:A.prestigePts(s)-s.prestige.pts,deeds:s.prestige.pts,lvl:A.prestigeLevel(s),state:st().prestige.lvl,p10:A.hasPerk(s,'pasture10'),gold:A.hasPerk(s,'gold'),ev:A.eventMul(s),savedLvl:s.prestige.lvl,title:A.titleOf(s)};
  G.ui.openLB(); const lp=document.getElementById('lbPanel'); const pt=lp.querySelector('[data-lbtab="prestige"]'); out.prestige.tab=!!pt; if(pt)pt.click();
  out.prestige.text=/Ten horses out in the pasture/.test(lp.textContent)&&/✅ Prestige 4/.test(lp.textContent)&&/🔒 Prestige 5/.test(lp.textContent);
  lp.querySelector('[data-lbtab="week"]').click(); out.spBreakdown=/Where the Star Points came from/.test(lp.textContent)&&/dailies/.test(lp.textContent);
  lp.querySelector('[data-lbtab="pass"]').click(); out.passX2=/Double-gem weekend/.test(lp.textContent);
  G.hidePanels();
  /* prestige 7: the shop opens, level-8 rows stay locked, a helmet is worn */
  G.ui.openShop('prestige'); const shp=document.getElementById('shopPanel');
  out.pshop={lockedChip:/opens at Prestige 7/i.test(shp.textContent),buyBtns:shp.querySelectorAll('[data-fx^="acct:pbuy:"]').length};
  S.sync(x=>{x.prestige.pts=1000;x.coins=5000;}); G.money.refreshWallet(); s=sv();
  out.pshop.lvl7=A.prestigeLevel(s);
  G.ui.openShop('prestige');
  const helm=shp.querySelector('[data-fx="acct:pbuy:gildedHelmet"]'), trough=shp.querySelector('[data-fx="acct:pbuy:gildedTrough"]');
  out.pshop.rows={helmetOn:helm&&!helm.disabled,troughLocked:trough&&trough.disabled,n:shp.querySelectorAll('[data-fx^="acct:pbuy:"]').length};
  c0=st().wallet.coins; helm.click(); s=sv(); out.pshop.bought={dc:st().wallet.coins-c0,owned:s.prestige.owned.gildedHelmet,helmet:s.rider.helmet};
  G.hidePanels();
  /* event bonus (+25% at prestige 6+) and double stakes */
  s=sv(); out.evMul=A.eventMul(s);
  c0=st().wallet.coins; G.run('courseFinish',{c:{},ev:{name:'QA',reward:100},stars:3,RB:{},pay:100,dressage:false}); out.evBonus={dc:st().wallet.coins-c0};
  G.ui.openEvents(); const ep=document.getElementById('eventsPanel'); out.evCard={tickets:/Race tickets/.test(ep.textContent),bonus:/Prestige bonus/.test(ep.textContent)};
  S.sync(x=>{x.tickets=1;}); G.ui.openEvents();G.ui.openEvents(); ep.querySelector('[data-fx="acct:stake"]').click(); s=sv(); out.stake={on:s.stake,text:/Double stakes are ON/.test(document.getElementById('eventsPanel').textContent)};
  G.hidePanels();
  c0=st().wallet.coins;g0=st().wallet.gems; G.run('courseFinish',{c:{},ev:{name:'QA',reward:100},stars:3,RB:{},pay:100,dressage:false}); s=sv();
  out.stakeFinish={dc:st().wallet.coins-c0,dg:st().wallet.gems-g0,tickets:s.tickets,stake:s.stake};
  /* double-gem weekends: season day 13 (a Saturday) doubles, day 3 does not */
  const EPOCH=Date.UTC(2026,0,5);
  out.x2={sat:A.gemMul(EPOCH+12*864e5+12*3600e3),wed:A.gemMul(EPOCH+2*864e5+12*3600e3),sun28:A.gemMul(EPOCH+27*864e5+3600e3),state:st().wallet.gemMul,live:A.gemMul()};
  let granted=0; S.sync(x=>{granted=G.money.grantGems(x,1);}); out.x2.grant=granted;
  out.x2.next=A.nextBonus()>Date.now()-864e5;
  /* money panel: the overview and the free-income baseline */
  document.getElementById('coinEl').parentElement.click(); const mp=document.getElementById('moneyPanel');
  out.money=['Every currency','Prestige','Cosmetic dust','Star Points','Builder points','Breeding tokens','Race tickets','Gems today','Keys this week','Silver Key is'].filter(t=>!mp.textContent.includes(t));
  G.hidePanels();
  /* online panel: player id, version */
  G.ui.openOnline(); const op=document.getElementById('onlinePanel');
  out.online={pid:(document.getElementById('pidOnline')||{}).textContent,ver:op.textContent.includes('v'+st().build)};
  G.hidePanels();
  /* touch emote strip */
  const te=document.getElementById('tEmote'), bar=document.getElementById('tEmoteBar');
  te.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true}));
  out.touch={btn:!!te,inTouch:te&&te.parentNode.id==='touch',emotes:bar.querySelectorAll('[data-emo]').length,open:bar.classList.contains('on')};
  bar.querySelector('[data-emo="rear"]').click(); out.touch.closed=!bar.classList.contains('on');
  /* wallet hud */
  S.sync(x=>{x.dust=7;x.btok=2;x.tickets=3;}); G.money.refreshWallet();
  out.hud={dust:document.getElementById('dustEl').textContent,btok:document.getElementById('btokEl').textContent,ticket:document.getElementById('ticketEl').textContent};
  /* export */
  out.blob=A.exportBlob(); out.blobOk=(()=>{try{const o=JSON.parse(decodeURIComponent(escape(atob(out.blob))));return o.pid===out.pid&&Array.isArray(o.horses)&&o.ww===undefined;}catch(e){return false;}})();
  out.importBad=A.importBlob('not a save')===false;
  out.horseName=st().horse.name;
  const o=st(); out.stateKeys=['prestige','inbox','welcome','a11y'].filter(k=>o[k]===undefined); out.walletKeys=['gemMul','sp','tickets','spSrc'].filter(k=>o.wallet[k]===undefined);
  return out;
 });
 check('package installed without error',r.installed&&r.errors.length===0,r.errors);
 check('Player ID MR-xxxxxxxx in save, state and the net id',/^MR-[A-Z0-9]{8}$/.test(r.pid)&&r.statePid===r.pid&&r.netId==='p'+r.pid.slice(3).toLowerCase(),{pid:r.pid,netId:r.netId});
 check('build id + seenBuild stamped + daily ticket + welcome day 1 on a fresh ranch',/^\d{4}\.\d{2}\.\d{2}$/.test(r.build)&&r.seenBuild===r.build&&r.tickets===1&&r.welcomeDay===1,{build:r.build,seen:r.seenBuild,tickets:r.tickets,welcomeDay:r.welcomeDay});
 check('inbox dock button after Quests with a pip',r.inboxBtn.exists&&r.inboxBtn.prev==='questBtn'&&+r.inboxBtn.pip>=1,r.inboxBtn);
 check('inbox opens with the news letter',r.inboxOpen.shown==='flex'&&r.inboxOpen.hasNews&&r.inboxOpen.claimBtn,r.inboxOpen);
 check('news letter claim pays 150🪙 3💎 (×gemMul) once',r.newsClaim.dc===150&&r.newsClaim.dg===3*r.newsClaim.gm&&r.newsClaim.claimed,r.newsClaim);
 check('news tab lists the season, the double-gem weekend and the builds',r.news.rows>=6&&r.news.season&&r.news.x2,r.news);
 check('welcome tab: day 1 open, claim pays 100🪙 2💎, day 2 locked',r.welcomeTab&&r.welcomeDay0.open&&r.welcomeDay0.text&&r.welcomeClaim.dc===100&&r.welcomeClaim.dg===2*r.newsClaim.gm&&r.welcomeClaim.claimed&&r.welcomeClaim.day1Locked,{tab:r.welcomeTab,d0:r.welcomeDay0,claim:r.welcomeClaim});
 check('settings button in the system tray opens the panel',r.settingsBtn.exists&&r.settingsBtn.parent==='sysBtns'&&r.settingsOpen==='flex',r.settingsBtn);
 check('gift code: stamped, delivered to the inbox, pays 500🪙, single-use, case-sensitive, invalid rejected',r.code.stamped&&r.code.letter&&r.code.dc===500&&r.code.again&&r.code.lower&&r.code.bad,r.code);
 check('accessibility: text scale, colour-blind class, high contrast applied + saved',r.a11y.scale==='1.3'&&r.a11y.saved===1.3&&r.a11y.cb&&r.a11y.contrast&&r.a11y.savedCb==='deutan',r.a11y);
 check('graphics: quality low applied, saved, locked, bloom off',r.gfx.q==='low'&&r.gfx.saved==='low'&&r.gfx.locked&&r.gfx.bloomOff,r.gfx);
 check('audio: volume 40% + mute toggle through the settings screen',Math.abs(r.audio.vol-0.4)<1e-9&&Math.abs(r.audio.saved-0.4)<1e-9&&r.audio.muteToggled,r.audio);
 check('controls tab lists every remappable key plus the fixed riding keys',r.controls.rows>=18&&r.controls.fixed,r.controls);
 check('remap Quests J→; live, back to default, clashes refused',r.remap.saved==='Semicolon'&&r.remap.zOpens==='flex'&&r.remap.jDead!=='flex'&&r.remap.cleared&&r.remap.jBack==='flex'&&r.remap.clash,r.remap);
 check('Enter opens the chat bar and focuses the input',r.chat.bar==='flex'&&r.chat.focus==='chatIn',r.chat);
 check('gem exchange: key for 8💎, ticket for 3💎, 1⭐ per 10💎 spent',r.gemKey.dk===1&&r.gemKey.gems===32&&r.gemKey.sp===0&&r.gemTicket.gems===29&&r.gemTicket.tickets===2&&r.gemTicket.spGems===1,{key:r.gemKey,ticket:r.gemTicket});
 check('star points: daily quest 10 (+5 deeds), umbrella 40, 10 per daily on the board',r.spDaily.d===10&&r.spDaily.src===10&&r.spDaily.all>=10&&r.spDaily.prestigeDeeds>=5&&r.spUmb.src===40&&r.spUmb.daily===r.spUmb.want,{daily:r.spDaily,umb:r.spUmb,dailies:r.dailyN});
 check('star points: Rare tack level = 3, foraged truffle = 4',r.spTack===3&&r.spForage===4,{tack:r.spTack,forage:r.spForage});
 check('prestige level 4 from 620 points, pasture10 on, gold off, no event bonus yet',r.prestige.pts===620&&r.prestige.lvl===4&&r.prestige.state===4&&r.prestige.p10&&!r.prestige.gold&&r.prestige.ev===1.1&&r.prestige.savedLvl===4&&r.prestige.title==='Ribbon rider',r.prestige);
 check('prestige tab shows perks with ✅/🔒; week tab shows the SP breakdown; pass tab the x2 weekend',r.prestige.tab&&r.prestige.text&&r.spBreakdown&&r.passX2,{tab:r.prestige.tab,text:r.prestige.text,sp:r.spBreakdown,x2:r.passX2});
 check('prestige shop locked at 4, open at 7 with level-8 rows locked, helmet bought and worn',r.pshop.lockedChip&&r.pshop.buyBtns===0&&r.pshop.lvl7===7&&r.pshop.rows.helmetOn&&r.pshop.rows.troughLocked&&r.pshop.rows.n===8&&r.pshop.bought.dc===-900&&r.pshop.bought.owned===1&&r.pshop.bought.helmet==='#ffd166',r.pshop);
 check('event bonus +25% at prestige 7 pays on courseFinish',r.evMul===1.25&&r.evBonus.dc===25,{mul:r.evMul,bonus:r.evBonus});
 check('events card shows tickets + bonus; double stakes toggles and doubles the next event (+1💎)',r.evCard.tickets&&r.evCard.bonus&&r.stake.on&&r.stake.text&&r.stakeFinish.dc===125&&r.stakeFinish.dg===1*r.newsClaim.gm&&r.stakeFinish.tickets===0&&r.stakeFinish.stake===false,{card:r.evCard,stake:r.stake,finish:r.stakeFinish});
 check('double-gem weekend: day 13 and 28 ×2, day 3 ×1, grantGems honours it, state carries it',r.x2.sat===2&&r.x2.sun28===2&&r.x2.wed===1&&r.x2.state===r.x2.live&&r.x2.grant===r.x2.live&&r.x2.next,r.x2);
 check('money panel: nine currencies + free-income baseline',r.money.length===0,r.money);
 check('online panel shows the Player ID and the build',r.online.pid===r.pid&&r.online.ver,r.online);
 check('touch emote strip: 🦄 button in #touch, five emotes, opens and closes',r.touch.btn&&r.touch.inTouch&&r.touch.emotes===5&&r.touch.open&&r.touch.closed,r.touch);
 check('wallet HUD paints dust, breeding tokens and tickets',/7/.test(r.hud.dust)&&/2/.test(r.hud.btok)&&/3/.test(r.hud.ticket),r.hud);
 check('export blob round-trips (no ledger), bad import refused',r.blobOk&&r.importBad,{ok:r.blobOk,bad:r.importBad,len:r.blob.length});
 check('render_game_to_text carries prestige/inbox/welcome/a11y + wallet gemMul/sp/tickets',r.stateKeys.length===0&&r.walletKeys.length===0,{state:r.stateKeys,wallet:r.walletKeys});
 /* Page 2: a veteran ranch on an older build, with a letter waiting and a closed week. A new
    context (its own localStorage), seeded once so the import reload below is not overwritten. */
 const page2=await browser.newPage({viewport:{width:1280,height:800}});
 page2.on('pageerror',e=>errors.push('PAGEERROR2 '+e.message));
 page2.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 page2.on('dialog',d=>{d.dismiss().catch(()=>{});});
 await page2.addInitScript(()=>{
  if(sessionStorage.getItem('qaSeeded'))return; sessionStorage.setItem('qaSeeded','1');
  const legacy={v:2,ranchName:'Meadowlark Ranch',founded:Date.now()-10*864e5,coins:999,gems:9,items:{carrot:3},nextId:2,decor:[],projects:{},trophies:{},wild:null,wildTrust:0,muted:false,
   lastSeen:Date.now()-3600e3,lastDaily:'',questDate:'',quests:[],totalRaces:0,started:true,keys:2,tack:[],seenBuild:'2000.01.01',
   horses:[{id:1,name:'Juniper',breed:'bay-sporthorse',colors:{body:'#765035',mane:'#221b16'},horn:false,rainbow:false,stats:{speed:3,stamina:3,jump:3,accel:3,agility:3},sxp:{},level:1,xp:0,bond:25,needs:{hunger:90,thirst:90,clean:90,happy:90},foal:false,tack:null}],
   inbox:[{id:'t1',t:Date.now()-1000,from:'QA',title:'Test letter',body:'seventy-five coins',r:{c:75},claimed:false}],
   wk:{week:'2000-01-03',sp:10,photos:0,events:0,days:3,lastDay:''}};
  localStorage.setItem('starRanchFable_v1',JSON.stringify(legacy));
 });
 stage('veteran save seeded');
 /* let the first page finish decoding its model textures before closing it — leaving mid-load makes
    GLTFLoader log "Couldn't load texture blob:" for the aborted images, which is not a game error */
 await page.waitForLoadState('networkidle',{timeout:60000}).catch(()=>{}); await page.waitForTimeout(2500); await page.close();
 await page2.goto(base+'/ranch3d.html?qa=account-economy&legacy='+Date.now(),{waitUntil:'load',timeout:120000}); stage('veteran loaded');
 await page2.waitForFunction(READY,null,{timeout:150000,polling:250}); stage('veteran horseReady');
 await page2.waitForFunction(()=>/What's new/.test(document.getElementById('toasts').textContent)||JSON.parse(render_game_to_text()).inbox.letters>=3,null,{timeout:30000,polling:300}).catch(()=>{});
 const L=await page2.evaluate(()=>{
  const G=window.__features, S=G.save, st=()=>JSON.parse(render_game_to_text()); const s=S.fresh(); const out={};
  out.welcome={day:s.welcome.day,vet:!!s.welcome.vet,tab:!!document.querySelector('[data-q="tab:welcome"]')};
  out.seenBuild=s.seenBuild===st().build; out.letters=s.inbox.map(x=>x.id);
  out.wkLast=!!(s.wkLast&&!s.wkLast.claimed);
  out.pip=(document.getElementById('inboxBtn').querySelector('.pip')||{}).textContent;
  G.ui.open('inboxPanel'); const ip=document.getElementById('inboxPanel');
  out.rows=ip.querySelectorAll('.inboxRow').length; out.ready=/Ready to collect/.test(ip.textContent)&&/wages/.test(ip.textContent);
  const c0=st().wallet.coins; ip.querySelector('[data-fx="inbox:claim:t1"]').click();
  out.claim={dc:st().wallet.coins-c0,claimed:!!S.fresh().inbox.find(x=>x.id==='t1').claimed,pipAfter:(document.getElementById('inboxBtn').querySelector('.pip')||{}).textContent};
  out.weekLetter=ip.querySelector('[data-fx="open:lbPanel"]')!==null;
  out.horse=st().horse.name; out.pid=s.pid;
  return out;
 });
 check('veteran ranch: welcome track skipped, no welcome tab',L.welcome.day===7&&L.welcome.vet&&!L.welcome.tab,L.welcome);
 check('older build: seenBuild stamped, news letter + week letter delivered',L.seenBuild&&L.letters.some(x=>x.startsWith('news-'))&&L.letters.some(x=>x.startsWith('week-'))&&L.wkLast,{seen:L.seenBuild,letters:L.letters,wk:L.wkLast});
 check('pip counts letters + the wages shortcut; test letter claim pays 75🪙 and the pip drops',+L.pip>=3&&L.rows>=3&&L.ready&&L.claim.dc===75&&L.claim.claimed&&+L.claim.pipAfter===+L.pip-1&&L.weekLetter,{pip:L.pip,rows:L.rows,ready:L.ready,claim:L.claim,week:L.weekLetter});
 /* Import the first ranch's save code into this browser: confirm, reload, same pid and horse. */
 await page2.waitForLoadState('networkidle',{timeout:60000}).catch(()=>{}); await page2.waitForTimeout(2500);   // same: settle before the import reload
 await page2.evaluate(blob=>{window.confirm=()=>true;window.__features.account.importBlob(blob);},r.blob);
 await page2.waitForFunction(()=>!location.search.includes('legacy'),null,{timeout:20000}).catch(()=>{});
 await page2.waitForLoadState('load',{timeout:120000}).catch(()=>{});
 await page2.waitForFunction(READY,null,{timeout:150000,polling:250}); stage('imported horseReady');
 const I=await page2.evaluate(()=>{const o=JSON.parse(render_game_to_text());const s=JSON.parse(localStorage.getItem('starRanchFable_v1'));return {pid:o.pid,horse:o.horse.name,helmet:s.rider&&s.rider.helmet,claimed:!!(s.inbox||[]).find(x=>x.id==='code-MEADOWLARK'&&x.claimed)};});
 check('import restores the first ranch (pid, horse, worn helmet, claimed letters)',I.pid===r.pid&&I.horse===r.horseName&&I.helmet==='#ffd166'&&I.claimed,I);
 check('no console/page errors',errors.length===0,errors.slice(0,5));
 await browser.close();
 const failed=checks.filter(c=>!c.ok);
 console.log(failed.length?('FAILED '+failed.length+'/'+checks.length):('ALL '+checks.length+' CHECKS PASSED'));
 process.exit(failed.length?1:0);
})().catch(e=>{console.error('FATAL',e);process.exit(2);});

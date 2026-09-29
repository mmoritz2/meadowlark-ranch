/* My Journey rebuilt as a hub of picture cards (assets/features/se-journey.js).

   Boots the game and proves: the ☰ Journey tile opens the hub, standing in for the quest panel (the panel is open
   underneath, hidden, so every way in arrives here); the cards run in the reference's order (the main story tall on
   the left, then the disciplines, the ranch, the daily jobs, the side stories and a featured story), each with a
   drawn picture; the main story card spans both rows and the first screen holds it and three columns, the rest
   scrolling sideways under a scrollbar; the figures are the game's own (the story's percentage and missions, the
   ranch level, the welcome gifts), and the ☰ tile's pip is the hub's claim count; nothing on it is an emoji; the strip
   reads "My Journey" with the wallet. A quest card opens the old list itself, framed, on its tab, and Back comes
   here; "All quests" opens the list where it was; the Season Pass tile and a tab clicked from outside land on the
   list on that tab; closing the list and opening the Journey again shows the hub; claims under the hub repaint it
   once, not ten times; the Journey key, G.ui.openQuests() and an inbox row's open:questPanel all land on the hub (the
   key again closes it), and the very first open through open:questPanel renders the list underneath; a discipline card opens its next event in Riding Events, Back goes to the carousel and then
   here, Escape closes everything; the ranch card opens Build and Back comes here; the arrow keys move between cards
   and the horse stays still; a course starting, or another menu opening, closes it. The Season Pass tile, the quest
   board and a villager's tab land on the list every time, not only the first, and the hub keeps its scroll across
   such a trip; Riding Events' own key brings Riding Events up on top of the hub; real arrow keys do not scroll the
   row by themselves; Enter still opens a card after a mouse drag that ended off the row; the Ladder and All events
   trips from Riding Events keep the way back to the hub, and closing ends it; the ☰ pip is the game's own sum of
   what waits; a message sits in the strip, on no card; no subtitle is cut off.
   Then on a well-progressed save: the foal story is the featured card and wears NEW, the story card reads 34% and 20
   of 59 missions, the pips count what is waiting, the ☰ tile reads 9+, the racing card opens the ladder when a rank
   prize is waiting, a NEW card stops saying so once tapped, and the season's special card opens its event. With the
   emoji cleaner running it shows no emoji either. On a 390x844 touch phone the row becomes a two-column grid that
   scrolls down, no card overlapping another, the strip's title whole, the All quests bar at the bottom, and a tap on
   a card opens its tab, every subtitle whole, the story's shade soft, a message over the All quests bar, and the
   special's ribbon keeps its days left; on an 844x390 phone held sideways the two rows fit, every title whole, the
   scrollbar shown, a message in the strip, the cut-off column fading, and the ribbon's days whole.

   Usage:  QA_PORT=8432 NODE_PATH=$(npm root -g) node tools/qa-se-journey.cjs */
const QA=require('./qa-platform.cjs');
const {chromium}=QA;
const checks=[];
function check(name,ok,detail){checks.push({name,ok:!!ok,detail});console.log((ok?'PASS ':'FAIL ')+name+(detail!==undefined?' — '+JSON.stringify(detail):''));}
let browser=null;
setTimeout(async()=>{console.error('WATCHDOG: no result after 560 s');try{if(browser)await browser.close();}catch(e){}process.exit(3);},560000).unref();
const errors=[];
async function newPage(opts,tag){
 const ctx=await browser.newContext(opts); const page=await ctx.newPage();
 page.on('pageerror',e=>errors.push(tag+' PAGEERROR '+e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(tag+' '+m.text());});
 page.on('dialog',d=>{d.dismiss().catch(()=>{});});
 return {ctx,page};
}
async function boot(page,q){
 await page.goto(QA.BASE+'/ranch3d.html?qa='+q+'&fresh='+Date.now(),{waitUntil:'load',timeout:120000});
 await page.waitForFunction(()=>window.render_game_to_text&&(()=>{try{const s=JSON.parse(render_game_to_text());return s.graphics&&s.graphics.horseReady&&!s.graphics.horseLoading;}catch(e){return false;}})(),null,{timeout:180000,polling:250});
 await page.waitForTimeout(1500);
 await page.evaluate(()=>{const c=document.getElementById('seChar');if(c&&c.classList.contains('on')&&window.__features.wardrobe)window.__features.wardrobe.closeChar();});
}
/* helpers every evaluate starts with */
const PRE=`
 const G=window.__features,$=id=>document.getElementById(id),wait=ms=>new Promise(r=>setTimeout(r,ms));
 const until=async(f,ms)=>{const t0=Date.now();while(Date.now()-t0<ms){try{if(f())return true;}catch(e){}await wait(80);}return false;};
 const vis=el=>{if(!el)return false;const cs=getComputedStyle(el),r=el.getBoundingClientRect();return cs.display!=='none'&&cs.visibility!=='hidden'&&r.width>0&&r.height>0;};
 const key=async(code,k)=>{window.dispatchEvent(new KeyboardEvent('keydown',{code,key:k||code,bubbles:true,cancelable:true}));await wait(140);};
 const hub=()=>$('seJy').classList.contains('on')&&G.seJourney.state.on;
 const Q=$('questPanel'), tab=()=>{const b=Q.querySelector('.tabbtn.on[data-q^="tab:"]');return b?b.dataset.q.slice(4):null;};
 const J=()=>JSON.parse(render_game_to_text());
 const card=id=>$('seJy').querySelector('[data-card="'+id+'"]');
 const openHub=async()=>{G.hidePanels();await wait(200);$('seMenuBtn').click();await wait(300);const t=$('seMenu').querySelector('.se-tiles>[data-sem-main="journey"]');
  const pip=t&&t.querySelector('.pip')?t.querySelector('.pip').textContent:null;if(t)t.click();await until(hub,3000);await wait(250);return pip;};
 const RE=new RegExp(window.__noEmoji.SEQ,'u');
 const shown=el=>{if(!el||!el.getClientRects().length)return false;for(let e=el;e&&e!==document.documentElement;e=e.parentElement){const cs=getComputedStyle(e);if(cs.display==='none'||cs.visibility==='hidden'||cs.opacity==='0'||parseFloat(cs.fontSize)===0)return false;}return true;};
 const emoji=()=>{const o=[],root=$('seJy');const tw=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);for(let n=tw.nextNode();n;n=tw.nextNode()){const e=n.parentElement;if(e&&RE.test(n.nodeValue)&&shown(e))o.push(n.nodeValue.trim().slice(0,40));}
  for(const el of root.querySelectorAll('[title],[aria-label]'))for(const a of ['title','aria-label']){const v=el.getAttribute(a);if(v&&RE.test(v))o.push('@'+a+' '+v.slice(0,40));}return o;};
 const pipTxt=n=>n>9?'9+':String(n);
 /* what is waiting to be claimed, summed here from the game's own modules and not from the hub's figures */
 const indep=()=>{const s=G.save.fresh(),n={};
  n.welcome=G.account.welcomeReady(s)||0;
  const td=G.quest.todayDaily(),N=G.storyQuests.DAILY_N||6,dq=(s.dq&&s.dq.date===new Date().toDateString())?s.dq:{prog:{},claimed:{}};
  n.daily=td.filter(q=>((dq.prog||{})[q.type]||0)>=q.goal&&!(dq.claimed||{})[q.type]).length+(Object.keys(dq.claimed||{}).length>=N&&!dq.umbrella?1:0);
  n.ach=G.quest.ACHS.filter(a=>{if((s.achClaims||{})[a.id])return false;try{return a.v(s)>=a.goal;}catch(e){return false;}}).length;
  const act=(s.side&&s.side.active)||{}; n.side=Object.keys(act).filter(id=>{const q=G.storyQuests.SIDE_BY[id];return q&&(act[id].p||0)>=q.goal;}).length;
  const bk=G.houses.bookState(s); n.almanac=bk.cur&&bk.prog>=bk.cur.goal?1:0;
  const pts=(s.racing&&s.racing.pts)||0,ri=G.events.rankIdx(pts),rc=(s.racing&&s.racing.claimed)||{}; n.rank=0; for(let k=1;k<=ri;k++)if(!rc[k])n.rank++;
  const wk=G.time.weekKey(),tot=G.social.coopTotal(),cc=s.coopClaims||{}; n.coop=G.social.COOP_GOALS.filter(g=>tot>=g.goal&&!cc[wk+':'+g.id]).length;
  const m=G.quest.STORY[G.quest.storyIdx()]; n.story=m&&G.quest.storyProg()>=m.goal?1:0;
  n.sum=Object.keys(n).reduce((a,k)=>a+n[k],0); return n;};
 const Rc=e=>e.getBoundingClientRect(), hit=(a,b)=>a.left<b.right-0.5&&b.left<a.right-0.5&&a.top<b.bottom-0.5&&b.top<a.bottom-0.5;
 const onScreen=r=>r.right>0&&r.left<innerWidth&&r.bottom>0&&r.top<innerHeight;
 /* a two-line message put where the game puts its messages, measured without its entrance animation */
 const toastAt=()=>{const t=document.createElement('div');t.className='toast';t.style.animation='none';t.textContent='A mystery package was spotted by the old mill. Find it before the week is out!';
  $('toasts').replaceChildren(t);const r=Rc(t);const o={rect:[r.left,r.top,r.right,r.bottom].map(Math.round),cards:[...$('seJy').querySelectorAll('.sjy-card')].filter(c=>{const q=Rc(c);return onScreen(q)&&hit(q,r);}).map(c=>c.dataset.card),
   plates:[...$('seJy').querySelectorAll('.sjy-plate')].filter(p=>{const q=Rc(p);return onScreen(q)&&hit(q,r);}).map(p=>p.parentElement.dataset.card)};t.remove();return o;};
 /* subtitles cut off: one line that overflows, or two lines that do */
 const cutSubs=()=>[...$('seJy').querySelectorAll('.sjy-s')].filter(x=>getComputedStyle(x).display!=='none'&&x.getClientRects().length&&(getComputedStyle(x).whiteSpace==='nowrap'?x.scrollWidth>x.clientWidth+1:x.scrollHeight>x.clientHeight+1)).map(x=>x.parentElement.parentElement.dataset.card+': '+x.textContent);
 /* a save where the season's special is the featured card: the welcome week done, no foal story */
 const veteran=()=>G.save.sync(s=>{s.welcome={day:7,last:new Date().toDateString(),claimed:{0:1,1:1,2:1,3:1,4:1,5:1,6:1}};delete s.foalq;});
 const ribbon=()=>{const b=card('special')&&card('special').querySelector(':scope>.sjy-ban');if(!b)return null;const r=Rc(b);
  return {text:b.innerText.trim(),whole:b.scrollWidth<=b.clientWidth+1,pips:[...$('seJy').querySelectorAll('.sjy-pip')].filter(p=>hit(Rc(p),r)).length};};
`;
/* a save well along: story at mission 20, side quests on the go, welcome day 3, an almanac entry ready, dailies done,
   bottles and badges, a foal just born into the foal story, landmarks, ribbons, racing points, builder points, mastery,
   hunt pieces, and horses of several breeds */
const SEED=`
 const SQ=G.storyQuests, today=G.quest.todayDaily();
 const sideIds=SQ.SIDEQ.filter(q=>q.tier===1).slice(0,5).map(q=>q.id);
 const B=G.houses.bookState().B, liveHunt=G.hunts.live()[0];
 for(const b of ['unicorn','black','bay','chestnut','grey','pegasus'])try{G.save.sync(sv=>G.horse.grantHorse(sv,b,{src:'qa'}));}catch(e){}
 G.save.sync(s=>{
  s.story.idx=20; s.story.prog=0; s.story.era=2; s.story.name='Luna';
  s.side.active={[sideIds[0]]:{p:SQ.SIDE_BY[sideIds[0]].goal,at:Date.now()},[sideIds[1]]:{p:0,at:Date.now()}};
  s.side.done={[sideIds[2]]:true,[sideIds[3]]:true,[sideIds[4]]:true}; s.side.n=3;
  s.welcome={day:3,last:new Date().toDateString(),claimed:{0:1}};
  s.seasonQ.idx=1; s.seasonQ.prog=B.entries[1].goal;
  s.dq={date:new Date().toDateString(),prog:{[today[0].type]:today[0].goal,[today[1].type]:today[1].goal},claimed:{[today[1].type]:1},roll:today.map(q=>q.type)};
  s.bottles=G.worldPkg.BOTTLES.slice(0,2).map(b=>b.id); s.sets=Object.assign({},s.sets,{badges:[0,1,2]}); s.toyUnicorn=Date.now();
  const foal=s.horses.find(h=>h.breed==='chestnut')||s.horses[s.horses.length-1]||s.horses[0];
  s.foalq={idx:0,prog:0,active:foal&&foal.id,started:Date.now()};
  s.vistas={larkspur:1,harrier:1};
  s.ribbons=Object.assign({},s.ribbons,{h1:4,a2:2,rr:3,d1:1}); s.ribbonsBy=Object.assign({},s.ribbonsBy,{'h1:open':4,'h1:novice':2,'a2:open':2,'rr:open':3,'d1:novice':1});
  s.racing.pts=320; s.builderBonus=400; s.streakN=4;
  s.mastery=Object.assign({},s.mastery,{'bay-sporthorse':3});
  if(liveHunt){s.hunt=s.hunt||{};s.hunt.got=Object.assign({},s.hunt.got,{[liveHunt]:['x1','x2','x3']});}
 });
`;
(async()=>{
 browser=await chromium.launch({headless:true,args:['--disable-background-timer-throttling',QA.ANGLE,'--enable-gpu-rasterization','--ignore-gpu-blocklist']});

 /* ================================ desktop 1280x800, a new save ================================ */
 const {ctx:dctx,page}=await newPage({viewport:{width:1280,height:800}},'desktop');
 await boot(page,'se-journey');
 const r=await page.evaluate(new Function('return (async()=>{'+PRE+`
  const out={};
  out.d1={installed:G.installed.includes('se-journey'),api:!!G.seJourney,root:!!$('seJy'),cover:!!(G.seFrame.covers&&G.seFrame.covers.questPanel)};
  /* D2: the ☰ tile */
  const tilePip=await openHub();
  const s=G.save.fresh(), st=J();
  out.d2={screen:vis($('seJy'))&&$('seJy').classList.contains('on'),panel:Q.style.display,covered:Q.classList.contains('se-covered'),opacity:getComputedStyle(Q).opacity,framed:G.seFrame.framed(),
   hud:getComputedStyle($('seHudRoot')).visibility,menu:$('seMenu').classList.contains('on'),state:!!(st.seJourney&&st.seJourney.on),covers:st.seFrame.covers};
  /* D3: the cards */
  const cards=[...$('seJy').querySelectorAll('.sjy-rail>.sjy-card')];
  out.d3={order:cards.map(c=>c.dataset.card),feat:G.seJourney.state.feat,n:cards.length,art:cards.filter(c=>{const g=c.querySelector('.sjy-pic>svg');return g&&g.children.length>0;}).length};
  /* D4: geometry */
  const rail=$('sjyRail'), R=e=>e.getBoundingClientRect(), gap=parseFloat(getComputedStyle(rail).rowGap)||0;
  const big=R(card('story')), sm=R(card('jump'));
  const inside=c=>{const b=R(c);return b.left>=0&&b.right<=innerWidth&&b.top>=0&&b.bottom<=innerHeight;};
  const tr=$('sjyTrack'), th=tr.firstElementChild;
  out.d4={bigH:Math.round(big.height),want:Math.round(2*sm.height+gap),first7:cards.slice(0,7).every(inside),first7ids:cards.slice(0,7).filter(inside).map(c=>c.dataset.card),
   overflow:rail.scrollWidth>rail.clientWidth,sw:rail.scrollWidth,cw:rail.clientWidth,thumb:Math.round(th.getBoundingClientRect().width),track:Math.round(tr.getBoundingClientRect().width),trackShown:!tr.classList.contains('none')};
  rail.scrollLeft=rail.scrollWidth; await wait(300);
  out.d4.lastVisible=inside(cards[cards.length-1]); out.d4.thumbMoved=Math.round(th.getBoundingClientRect().left-tr.getBoundingClientRect().left)>0;
  rail.scrollLeft=0; await wait(200);
  /* D5: the figures */
  const bigB=card('story').querySelector('.sjy-big>b'), bigE=card('story').querySelector('.sjy-big>em');
  const wp=card('welcome')&&card('welcome').querySelector(':scope>.sjy-pip');
  out.d5={pct:bigB&&bigB.textContent,wantPct:Math.round(G.storyQuests.storyPct())+'%',em:bigE&&bigE.textContent,wantEm:G.quest.storyIdx()+' of '+G.quest.STORY.length+' missions',
   ranch:card('ranch').querySelector('.sjy-s').textContent,wantRanch:'Level '+G.ranchSys.ranchLevel(s),welcomePip:wp?+wp.textContent:0,wantWelcome:G.account.welcomeReady(s),
   tilePip,pips:G.seJourney.state.pips,indep:indep(),xc:card('xc').querySelector('.sjy-s').textContent};
  /* D6: no emoji */
  out.d6=emoji();
  /* D7: the strip */
  const strip=$('seJy').querySelector('.se-strip'), tb=strip.querySelector('.se-ttl-b');
  out.d7={title:tb.textContent,clipped:tb.scrollWidth>tb.clientWidth+1,coins:strip.querySelector('[data-se-pill="coins"] b').textContent,wantCoins:G.seFrame.fmt(s.coins),
   back:!!strip.querySelector('[data-se="back"]'),close:!!strip.querySelector('[data-se="close"]')};
  /* D8: a quest card opens its tab in the framed list; Back comes here */
  card('side').click(); await wait(400);
  out.d8={cls:Q.className,tab:tab(),hub:$('seJy').classList.contains('on'),title:$('seFrameTop').querySelector('.se-ttl-b').textContent,framed:G.seFrame.framed()};
  $('seFrameTop').querySelector('[data-se="back"]').click(); await until(hub,2000); await wait(200);
  out.d8.back={hub:hub(),covered:Q.classList.contains('se-covered'),tab:tab(),panel:Q.style.display};
  /* D9: All quests */
  $('seJy').querySelector('.sjy-foot [data-sjy="all"]').click(); await wait(350);
  out.d9={framed:G.seFrame.framed(),hub:hub(),tab:tab()};
  $('seFrameTop').querySelector('[data-se="back"]').click(); await until(hub,2000); await wait(200);
  out.d9.back=hub();
  /* D10: a tab opened from outside lands on the list on that tab */
  G.hidePanels(); await wait(250); $('seMenuBtn').click(); await wait(300);
  $('seMenu').querySelector('.se-tiles>[data-sem-main="season"]').click(); await until(()=>G.seFrame.framed()==='questPanel'&&tab()==='season',2000); await wait(100);
  out.d10={season:{framed:G.seFrame.framed(),cls:Q.className,tab:tab(),hub:hub()}};
  G.hidePanels(); await wait(250);
  G.ui.openQuests(); const sb=Q.querySelector('[data-q="tab:side"]'); if(sb)sb.click();
  const t0=Date.now(); await until(()=>G.seFrame.framed()==='questPanel'&&tab()==='side',1500);
  out.d10.board={framed:G.seFrame.framed(),tab:tab(),hub:hub(),ms:Date.now()-t0};
  /* D11: close the list, then open the Journey: the hub */
  $('seFrameTop').querySelector('[data-se="close"]').click(); await wait(300);
  const closed=Q.style.display;
  $('questBtn').click(); await until(hub,2000); await wait(200);
  out.d11={closed,hub:hub(),framed:G.seFrame.framed()};
  /* D12: re-renders under the hub repaint it once */
  const p0=G.seJourney.state.paints;
  G.save.sync(sv=>{const q=G.quest.todayDaily()[0];sv.dq=sv.dq||{};if(sv.dq.date!==new Date().toDateString()){sv.dq.date=new Date().toDateString();sv.dq.prog={};sv.dq.claimed={};}sv.dq.prog=sv.dq.prog||{};sv.dq.prog[q.type]=q.goal;});
  for(let i=0;i<10;i++)G.ui.renderQuests();
  await wait(300);
  const dp=card('daily').querySelector(':scope>.sjy-pip');
  out.d12={pip:dp?dp.textContent:null,hub:hub(),paints:G.seJourney.state.paints-p0,state:(J().seJourney.cards.find(c=>c.id==='daily')||{}).ready};
  /* D13: a discipline card opens its next event; Back to the carousel, Back again here; Escape closes all */
  const next=G.seJourney.figures().jump.next;
  card('jump').click(); await until(()=>G.seEvents.state.on&&G.seEvents.state.page,3000); await wait(150);
  out.d13={events:G.seEvents.state.on,page:G.seEvents.state.page,next,hub:hub()};
  const eb=()=>$('seEv').querySelector('.se-strip [data-se="back"]');
  eb().click(); await wait(250); out.d13.back1={page:G.seEvents.state.page,events:G.seEvents.state.on};
  eb().click(); await until(hub,2000); await wait(200); out.d13.back2={hub:hub(),events:G.seEvents.state.on,panel:Q.style.display};
  card('jump').click(); await until(()=>G.seEvents.state.on&&G.seEvents.state.page,3000); await wait(150);
  await key('Escape'); out.d13.esc1={page:G.seEvents.state.page,events:G.seEvents.state.on};
  await key('Escape'); await wait(400);
  out.d13.esc2={hub:hub(),events:G.seEvents.state.on,q:Q.style.display,e:$('eventsPanel').style.display};
  /* D14: the ranch card opens Build; Back comes here */
  await openHub();
  card('ranch').click(); await until(()=>G.seFrame.framed()==='buildPanel',2000); await wait(150);
  out.d14={framed:G.seFrame.framed(),hub:hub()};
  $('seFrameTop').querySelector('[data-se="back"]').click(); await until(hub,2000); await wait(200);
  out.d14.back=hub();
  /* D15: the keys */
  if(document.activeElement&&document.activeElement.blur)document.activeElement.blur();
  const seq=[]; for(const k of ['ArrowRight','ArrowRight','ArrowDown','ArrowRight']){await key(k);seq.push(document.activeElement&&document.activeElement.dataset?document.activeElement.dataset.card||null:null);}
  await key('KeyW','w');
  out.d15={seq,w:!!(window._k&&window._k.KeyW),hub:hub()};
  await key('Escape'); await wait(250);
  out.d15.esc={hub:hub(),panel:Q.style.display,screen:document.body.classList.contains('se-screen-open')};
  /* the other ways in: the Journey key (a second press closes it), G.ui.openQuests(), an inbox row's open:questPanel */
  const jk=(G.key&&G.key('quests'))||'KeyJ';
  await key(jk); await until(hub,1500); const j1=hub();
  await key(jk); await wait(300); const j2=hub(), j2p=Q.style.display;
  G.ui.openQuests(); await until(hub,1500); const oq=hub(); G.hidePanels(); await wait(250);
  G.ui.dispatch('open:questPanel'); await until(hub,1500); const fx=hub(); G.hidePanels(); await wait(250);
  out.opn={jk,j1,j2,j2p,oq,fx};
  /* D16: a course starting closes it */
  await openHub();
  const h1=G.tables.EVENTS3.find(e=>e.id==='h1'); try{G.course.startCourse(h1);}catch(e){out.d16err=String(e);}
  await wait(400);
  out.d16={started:!!G.course.get(),hub:hub(),panel:Q.style.display};
  try{G.course.cancelCourse();}catch(e){}
  await until(()=>!G.course.get(),3000); await wait(400);
  /* D17: another menu opening closes it */
  await openHub();
  $('stableBtn').click(); await wait(400);
  out.d17={hub:hub(),panel:Q.style.display};
  G.hidePanels(); await wait(250);
  return out;
 })()`));
 check('se-journey installed: the API, its screen and its cover on the quest panel',r.d1.installed&&r.d1.api&&r.d1.root&&r.d1.cover,r.d1);
 check('the ☰ Journey tile opens the hub, standing in for the quest panel (open underneath, hidden), nothing framed, the HUD down',
  r.d2.screen&&r.d2.panel==='flex'&&r.d2.covered&&r.d2.opacity==='0'&&r.d2.framed===null&&r.d2.hud==='hidden'&&!r.d2.menu&&r.d2.state&&r.d2.covers.includes('questPanel'),r.d2);
 check('the cards run story, jump, daily, cross country, side, ranch, then the featured welcome week; each has its picture',
  r.d3.order.slice(0,7).join()==='story,jump,daily,xc,side,ranch,welcome'&&r.d3.feat==='welcome'&&r.d3.n>=18&&r.d3.art===r.d3.n,r.d3);
 check('the main story spans both rows; it and three columns fit the first screen; the rest scrolls sideways under a scrollbar, the last card reachable',
  Math.abs(r.d4.bigH-r.d4.want)<=3&&r.d4.first7&&r.d4.overflow&&r.d4.trackShown&&r.d4.thumb<r.d4.track&&r.d4.lastVisible&&r.d4.thumbMoved,r.d4);
 check('the figures are the game\'s own: story percent and missions, ranch level, welcome gifts, and the ☰ tile\'s pip is the hub\'s count and the game\'s own sum',
  r.d5.pct===r.d5.wantPct&&r.d5.em===r.d5.wantEm&&r.d5.ranch.includes(r.d5.wantRanch)&&r.d5.welcomePip===r.d5.wantWelcome&&r.d5.wantWelcome>0&&r.d5.tilePip===(r.d5.pips>9?'9+':String(r.d5.pips))
  &&r.d5.tilePip===(r.d5.indep.sum>9?'9+':String(r.d5.indep.sum))&&r.d5.pips===r.d5.indep.sum&&/^Next: /.test(r.d5.xc)&&r.d5.xc.toLowerCase()!=='next: cross country',r.d5);
 check('no emoji in the hub\'s text, titles or labels (the package\'s own output, no-emoji not running)',r.d6.length===0,r.d6.slice(0,6));
 check('the strip reads My Journey in full, with the coins, Back and Close',r.d7.title==='My Journey'&&!r.d7.clipped&&r.d7.coins===r.d7.wantCoins&&r.d7.back&&r.d7.close,r.d7);
 check('a quest card opens the old list itself, framed, on its tab; Back returns to the hub with the panel covered again',
  /se-fr/.test(r.d8.cls)&&/se-fr-tabs/.test(r.d8.cls)&&r.d8.tab==='side'&&!r.d8.hub&&r.d8.title==='My Journey'&&r.d8.back.hub&&r.d8.back.covered&&r.d8.back.tab==='side'&&r.d8.back.panel==='flex',r.d8);
 check('"All quests" opens the list on the tab it was on; Back returns to the hub',r.d9.framed==='questPanel'&&!r.d9.hub&&r.d9.tab==='side'&&r.d9.back,r.d9);
 check('the Season Pass tile, and a tab clicked from outside, land on the list on that tab',
  r.d10.season.framed==='questPanel'&&r.d10.season.tab==='season'&&!r.d10.season.hub&&r.d10.board.framed==='questPanel'&&r.d10.board.tab==='side'&&!r.d10.board.hub&&r.d10.board.ms<=400,r.d10);
 check('closing the list and opening the Journey again shows the hub, not the list',r.d11.closed==='none'&&r.d11.hub&&r.d11.framed===null,r.d11);
 check('ten re-renders of the panel under the hub repaint it at most three times; a finished daily shows its pip',r.d12.pip==='1'&&r.d12.hub&&r.d12.paints>=1&&r.d12.paints<=3&&r.d12.state===1,r.d12);
 check('a discipline card opens its next event in Riding Events; Back goes to the carousel, Back again to the hub; Escape closes everything',
  r.d13.events&&r.d13.page===r.d13.next&&!!r.d13.next&&!r.d13.hub&&r.d13.back1.page===null&&r.d13.back1.events&&r.d13.back2.hub&&!r.d13.back2.events&&r.d13.back2.panel==='flex'
  &&r.d13.esc1.page===null&&r.d13.esc1.events&&!r.d13.esc2.hub&&!r.d13.esc2.events&&r.d13.esc2.q==='none'&&r.d13.esc2.e==='none',r.d13);
 check('the ranch card opens Build, framed; Back returns to the hub',r.d14.framed==='buildPanel'&&!r.d14.hub&&r.d14.back,r.d14);
 check('the arrow keys move between cards by where they sit; the horse does not walk; Escape closes the hub and the frame',
  r.d15.seq.join()==='story,jump,daily,side'&&!r.d15.w&&r.d15.hub&&!r.d15.esc.hub&&r.d15.esc.panel==='none'&&!r.d15.esc.screen,r.d15);
 check('the Journey key opens the hub and a second press closes it; G.ui.openQuests() and open:questPanel land on the hub',
  r.opn.j1&&!r.opn.j2&&r.opn.j2p==='none'&&r.opn.oq&&r.opn.fx,r.opn);
 check('a course starting closes the hub',r.d16.started&&!r.d16.hub&&r.d16.panel==='none',r.d16);
 check('another menu opening closes the hub',!r.d17.hub&&r.d17.panel==='none',r.d17);

 /* a real Enter press on a focused card opens it, and on the focused All quests button presses that */
 {const f=await page.evaluate(new Function('return (async()=>{'+PRE+`
   await openHub(); if(document.activeElement&&document.activeElement.blur)document.activeElement.blur();
   for(const k of ['ArrowRight','ArrowRight','ArrowDown'])await key(k);
   return document.activeElement&&document.activeElement.dataset?document.activeElement.dataset.card:null;})()`));
  await page.keyboard.press('Enter'); await page.waitForTimeout(450);
  const e1=await page.evaluate(()=>{const Q=document.getElementById('questPanel'),b=Q.querySelector('.tabbtn.on[data-q^="tab:"]');return {framed:window.__features.seFrame.framed(),tab:b?b.dataset.q.slice(4):null};});
  const e2=await page.evaluate(new Function('return (async()=>{'+PRE+`
   $('seFrameTop').querySelector('[data-se="back"]').click(); await until(hub,2000); await wait(200);
   const a=$('seJy').querySelector('.sjy-foot [data-sjy="all"]'); a.focus(); return {hub:hub(),focused:document.activeElement===a};})()`));
  await page.keyboard.press('Enter'); await page.waitForTimeout(450);
  const e3=await page.evaluate(()=>({framed:window.__features.seFrame.framed(),hub:window.__features.seJourney.state.on}));
  await page.evaluate(()=>window.__features.hidePanels()); await page.waitForTimeout(250);
  check('a real Enter on a focused card opens it; on the focused All quests button it presses that',f==='daily'&&e1.framed==='questPanel'&&e1.tab==='daily'&&e2.hub&&e2.focused&&e3.framed==='questPanel'&&!e3.hub,{f,e1,e2,e3});}

 /* the routes that open the list on a tab, used twice over: the second time the list is already on that tab */
 {const x=await page.evaluate(new Function('return (async()=>{'+PRE+`
   const o={}, esc=async()=>{await key('Escape');await wait(300);};
   const land=async t=>{await until(()=>G.seFrame.framed()==='questPanel'&&tab()===t,2000);await wait(150);return {framed:G.seFrame.framed(),tab:tab(),hub:hub()};};
   /* scrolled along first: the board opens the list on its tab in the same moment as the panel, before the hub is up */
   await openHub(); $('sjyRail').scrollLeft=300; await wait(150); const sc0=$('sjyRail').scrollLeft; G.hidePanels(); await wait(250);
   G.ui.dispatch('sq:board'); o.board1=await land('side'); await esc();
   await openHub(); await wait(250); o.scroll={before:sc0,after:$('sjyRail').scrollLeft}; $('sjyRail').scrollLeft=0; G.hidePanels(); await wait(250);
   G.ui.dispatch('sq:board'); o.board2=await land('side'); await esc();
   const pass=async()=>{$('seMenuBtn').click();await wait(300);$('seMenu').querySelector('.se-tiles>[data-sem-main="season"]').click();return land('season');};
   o.pass1=await pass(); await esc(); o.pass2=await pass(); await esc();
   G.ui.dispatch('sq:tab:story'); o.tab1=await land('story'); await esc(); G.ui.dispatch('sq:tab:story'); o.tab2=await land('story'); await esc();
   return o;})()`));
  const ok=(v,t)=>v.framed==='questPanel'&&v.tab===t&&!v.hub;
  check('the Season Pass tile, the quest board and a villager\'s tab land on the list on their tab every time, not only the first',
   ok(x.pass1,'season')&&ok(x.pass2,'season')&&ok(x.board1,'side')&&ok(x.board2,'side')&&ok(x.tab1,'story')&&ok(x.tab2,'story'),x);
  check('the hub is scrolled where it was after a trip to a tab opened from outside',x.scroll.before>100&&Math.abs(x.scroll.after-x.scroll.before)<=2,x.scroll);}

 /* Riding Events' own key, pressed while the hub is up, brings Riding Events up on top */
 {await page.evaluate(new Function('return (async()=>{'+PRE+`await openHub();})()`));
  await page.keyboard.press('u');
  await page.waitForFunction(()=>window.__features.seEvents.state.on,null,{timeout:6000,polling:100}).catch(()=>{}); await page.waitForTimeout(400);
  const u=await page.evaluate(()=>{const G=window.__features,e=document.elementFromPoint(innerWidth/2,innerHeight/2);return {events:G.seEvents.state.on,hub:G.seJourney.state.on,q:document.getElementById('questPanel').style.display,top:!!(e&&e.closest('#seEv')),hubOn:document.getElementById('seJy').classList.contains('on')};});
  await page.evaluate(()=>window.__features.hidePanels()); await page.waitForTimeout(300);
  check('Riding Events opened by its key while the hub is up comes up on top, and the hub closes',u.events&&!u.hub&&!u.hubOn&&u.q==='none'&&u.top,u);}

 /* real arrow keys move the focus and do not scroll the row by themselves */
 {await page.evaluate(new Function('return (async()=>{'+PRE+`await openHub();if(document.activeElement&&document.activeElement.blur)document.activeElement.blur();$('sjyRail').scrollLeft=0;await wait(100);})()`));
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight'); await page.waitForTimeout(450);
  const a=await page.evaluate(()=>({left:document.getElementById('sjyRail').scrollLeft,focus:document.activeElement&&document.activeElement.dataset?document.activeElement.dataset.card:null}));
  await page.evaluate(()=>window.__features.hidePanels()); await page.waitForTimeout(250);
  check('real arrow keys move between cards without scrolling the row as well',a.focus==='jump'&&a.left===0,a);}

 /* a mouse drag along the row that ends over the foot, then the keyboard: Enter still opens the focused card */
 {const pos=await page.evaluate(new Function('return (async()=>{'+PRE+`await openHub();$('sjyRail').scrollLeft=0;await wait(100);
   const c=Rc(card('daily')),f=Rc($('seJy').querySelector('.sjy-foot'));return {x:c.left+c.width/2,y:c.top+c.height/2,fx:f.left+f.width*0.3,fy:f.top+f.height/2};})()`));
  await page.mouse.move(pos.x,pos.y); await page.mouse.down(); await page.mouse.move(pos.x-60,pos.y,{steps:5}); await page.mouse.move(pos.fx,pos.fy,{steps:6}); await page.mouse.up(); await page.waitForTimeout(250);
  const dragged=await page.evaluate(()=>{const r=document.getElementById('sjyRail');const o={hub:window.__features.seJourney.state.on,left:r.scrollLeft};if(document.activeElement&&document.activeElement.blur)document.activeElement.blur();r.scrollLeft=0;return o;});
  await page.waitForTimeout(150);
  for(const k of ['ArrowRight','ArrowRight','ArrowDown'])await page.keyboard.press(k);
  await page.waitForTimeout(250);
  const fc=await page.evaluate(()=>document.activeElement&&document.activeElement.dataset?document.activeElement.dataset.card:null);
  await page.keyboard.press('Enter'); await page.waitForTimeout(450);
  const e=await page.evaluate(()=>{const Q=document.getElementById('questPanel'),b=Q.querySelector('.tabbtn.on[data-q^="tab:"]');return {framed:window.__features.seFrame.framed(),tab:b?b.dataset.q.slice(4):null,hub:window.__features.seJourney.state.on};});
  await page.evaluate(()=>window.__features.hidePanels()); await page.waitForTimeout(250);
  check('after a mouse drag that ends off the row, Enter on a focused card still opens it',dragged.hub&&dragged.left>=40&&fc==='daily'&&e.framed==='questPanel'&&e.tab==='daily'&&!e.hub,{dragged,fc,e});}

 /* the events screen's own trips (its Ladder, All events) keep the way back to the hub; closing ends it */
 {const v=await page.evaluate(new Function('return (async()=>{'+PRE+`
   const o={}, eb=()=>$('seEv').querySelector('.se-strip [data-se="back"]'), sev=k=>$('seEv').querySelector('[data-sev="'+k+'"]');
   const toCarousel=async()=>{await openHub();card('jump').click();await until(()=>G.seEvents.state.on&&G.seEvents.state.page,3000);await wait(150);eb().click();await wait(300);};
   await toCarousel(); sev('ladder').click(); await until(()=>G.seFrame.framed()==='lbPanel',3000); await wait(200); o.ladder=G.seFrame.framed();
   $('seFrameTop').querySelector('[data-se="back"]').click(); await until(()=>G.seEvents.state.on,3000); await wait(350); o.carousel=G.seEvents.state.on&&!G.seEvents.state.page;
   eb().click(); await until(hub,2000); await wait(200); o.home=hub();
   await toCarousel(); sev('classic').click(); await until(()=>G.seFrame.framed()==='eventsPanel',3000); await wait(200); o.all=G.seFrame.framed();
   $('seFrameTop').querySelector('[data-se="back"]').click(); await until(()=>G.seEvents.state.on,3000); await wait(350); o.carousel2=G.seEvents.state.on;
   eb().click(); await until(hub,2000); await wait(200); o.home2=hub();
   await toCarousel(); sev('ladder').click(); await until(()=>G.seFrame.framed()==='lbPanel',3000); await wait(200);
   $('seFrameTop').querySelector('[data-se="close"]').click(); await wait(600);
   await key('KeyU','u'); await until(()=>G.seEvents.state.on,4000); await wait(300); o.later=G.seEvents.state.on;
   eb().click(); await wait(500); o.laterBack={hub:hub(),events:G.seEvents.state.on,q:Q.style.display};
   G.hidePanels(); await wait(250); return o;})()`));
  check('Riding Events\' Ladder and All events keep the way back: Back, Back returns to the hub; closed, Riding Events opened later closes to the world',
   v.ladder==='lbPanel'&&v.carousel&&v.home&&v.all==='eventsPanel'&&v.carousel2&&v.home2&&v.later&&!v.laterBack.hub&&!v.laterBack.events&&v.laterBack.q==='none',v);}

 /* the look: a message goes in the strip, never on a card; no subtitle is cut off */
 {const w=await page.evaluate(new Function('return (async()=>{'+PRE+`await openHub();await wait(200);
   const first=Math.min(...[...$('seJy').querySelectorAll('.sjy-card')].map(c=>Rc(c).top));
   const o={toast:toastAt(),firstTop:Math.round(first),stripBottom:Math.round(Rc($('seJy').querySelector('.se-strip')).bottom),cut:cutSubs()};
   G.hidePanels(); await wait(200); return o;})()`));
  check('a message while the hub is up sits in the strip between the title and the wallet, on no card',w.toast.cards.length===0&&w.toast.rect[3]<=w.firstTop&&w.toast.rect[1]<w.stripBottom,w);
  check('no subtitle is cut off on a new save at 1280x800',w.cut.length===0,w.cut);}

 /* ================================ desktop, a well-progressed save ================================ */
 await page.evaluate(new Function('return (async()=>{'+PRE+SEED+'})()'));
 await boot(page,'se-journey-b');
 const b=await page.evaluate(new Function('return (async()=>{'+PRE+`
  const out={};
  const tilePip=await openHub();
  const st=J().seJourney, C=id=>st.cards.find(c=>c.id===id)||{};
  const big=card('story');
  out.s1={feat:st.feat,foalNew:C('foal').isNew,foalBadge:!!card('foal').querySelector(':scope>.sjy-new'),pct:big.querySelector('.sjy-big>b').textContent,em:big.querySelector('.sjy-big>em').textContent,storyNew:C('story').isNew,
   pips:{daily:C('daily').ready,side:C('side').ready,welcome:C('welcome').ready,race:C('race').ready,season:C('season').ready,ach:C('ach').ready},order:st.order.slice(0,8)};
  out.s2={tilePip,indep:indep(),cut:cutSubs(),special:card('special').querySelector('.sjy-s').textContent};
  /* S3: rank prizes waiting: the racing card opens the ladder */
  card('race').click(); await until(()=>G.seFrame.framed()==='lbPanel',2500); await wait(250);
  const lt=$('lbPanel').querySelector('[data-lbtab="ladder"]');
  out.s3={framed:G.seFrame.framed(),ladder:!!(lt&&lt.classList.contains('claimBtn')),hub:hub()};
  $('seFrameTop').querySelector('[data-se="back"]').click(); await until(hub,2000); await wait(200); out.s3.back=hub();
  /* S4: a NEW card stops saying so once tapped */
  card('foal').click(); await wait(400);
  out.s4={tab:tab(),framed:G.seFrame.framed()};
  $('seFrameTop').querySelector('[data-se="back"]').click(); await until(hub,2000); await wait(250);
  let mem=null; try{mem=JSON.parse(localStorage.getItem('mk_sjy')||'null');}catch(e){}
  out.s4.back=hub(); out.s4.badge=!!card('foal').querySelector(':scope>.sjy-new'); out.s4.isNew=(J().seJourney.cards.find(c=>c.id==='foal')||{}).isNew; out.s4.seen=!!(mem&&mem.seen&&mem.seen.foal);
  /* S5: the season's special card opens its event */
  const sp=G.seasons.special(), fig=G.seJourney.figures().special;
  out.s5={id:sp.id,title:card('special').querySelector('.sjy-t').textContent,ban:!!card('special').querySelector('.sjy-ban'),figId:fig.id};
  card('special').click(); await wait(600);
  out.s5.after={events:!!(G.seEvents&&G.seEvents.state.on),page:G.seEvents&&G.seEvents.state.page,hub:hub()};
  G.hidePanels(); await wait(250);
  out.emoji=[]; await openHub(); out.emoji=emoji(); G.hidePanels(); await wait(200);
  return out;
 })()`));
 check('seeded: the foal story is the featured card and wears NEW; the story reads 34% and 20 of 59 missions, NEW; the pips count what waits',
  b.s1.feat==='foal'&&b.s1.foalNew&&b.s1.foalBadge&&b.s1.pct==='34%'&&b.s1.em==='20 of 59 missions'&&b.s1.storyNew&&b.s1.pips.daily>=1&&b.s1.pips.side===1&&b.s1.pips.welcome===2&&b.s1.pips.race===2&&b.s1.pips.season===1&&b.s1.pips.ach>=1
  &&b.s1.order.slice(0,8).join()==='story,jump,daily,xc,side,ranch,foal,welcome',b.s1);
 check('seeded: the ☰ Journey tile reads 9+, and the game itself has more than nine things waiting',b.s2.tilePip==='9+'&&b.s2.indep.sum>9,{tilePip:b.s2.tilePip,indep:b.s2.indep});
 check('seeded: no subtitle is cut off; the season special\'s reads without its dash clause',b.s2.cut.length===0&&b.s2.special.length>0&&!/[—–]/.test(b.s2.special),{cut:b.s2.cut,special:b.s2.special});
 check('seeded: with rank prizes waiting the racing card opens the ladder; Back returns to the hub',b.s3.framed==='lbPanel'&&b.s3.ladder&&!b.s3.hub&&b.s3.back,b.s3);
 check('seeded: a NEW card stops saying so once tapped (remembered per viewer)',b.s4.tab==='foal'&&b.s4.framed==='questPanel'&&b.s4.back&&!b.s4.badge&&!b.s4.isNew&&b.s4.seen,b.s4);
 {const x=b.s5,a=x.after;const ok=x.id==='sun-roundup'?(a.events&&a.page==='__roundup'):x.id==='frost-trials'?(a.events&&a.page==='gt'):!a.hub;
  check('seeded: the season\'s special card (not featured, no ribbon) opens its event',x.figId===x.id&&!x.ban&&x.title.length>0&&ok,x);}
 check('seeded: no emoji in the hub',b.emoji.length===0,b.emoji.slice(0,6));
 await dctx.close();

 /* ================================ with the emoji cleaner running ================================ */
 {const {ctx,page:p}=await newPage({viewport:{width:1280,height:800}},'emoji0');
  await p.goto(QA.BASE+'/ranch3d.html?qa=se-journey-e0&emoji=0&fresh='+Date.now(),{waitUntil:'load',timeout:120000});
  await p.waitForFunction(()=>window.render_game_to_text&&(()=>{try{const s=JSON.parse(render_game_to_text());return s.graphics&&s.graphics.horseReady&&!s.graphics.horseLoading;}catch(e){return false;}})(),null,{timeout:180000,polling:250});
  await p.waitForTimeout(1500);
  await p.evaluate(()=>{const c=document.getElementById('seChar');if(c&&c.classList.contains('on')&&window.__features.wardrobe)window.__features.wardrobe.closeChar();});
  const e=await p.evaluate(new Function('return (async()=>{'+PRE+`
   /* the first open of the session through open:questPanel, which shows the panel without rendering it */
   const hadTabs=!!Q.querySelector('.tabbtn');
   G.ui.dispatch('open:questPanel'); await until(hub,2000); await wait(300);
   const first={hadTabs,hub:hub(),tabs:!!Q.querySelector('.tabbtn'),cards:$('seJy').querySelectorAll('.sjy-card').length};
   await openHub(); await wait(400);
   const o={first,hub:hub(),noEmoji:G.installed.includes('no-emoji'),emoji:emoji(),coin:!!Q.querySelector('i.noe-coin')};
   G.hidePanels(); await wait(200); return o;
  })()`));
  check('the first open through open:questPanel shows the hub with its cards and the list rendered underneath',e.first.hub&&e.first.tabs&&e.first.cards>=18,e.first);
  check('with the emoji cleaner running: the hub shows no emoji and the panel underneath is still cleaned',e.hub&&e.noEmoji&&e.emoji.length===0&&e.coin,e);
  await ctx.close();}

 /* ================================ a 390x844 touch phone ================================ */
 {const {ctx,page:p}=await newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true,deviceScaleFactor:2},'phone');
  await boot(p,'se-journey-phone');
  const q=await p.evaluate(new Function('return (async()=>{'+PRE+`
   const o={};
   await openHub(); await wait(300);
   o.p1={hub:hub(),emoji:emoji()};
   const rail=$('sjyRail'), cs=getComputedStyle(rail), cards=[...rail.querySelectorAll(':scope>.sjy-card')], R=e=>e.getBoundingClientRect();
   const inner=rail.clientWidth-parseFloat(cs.paddingLeft)-parseFloat(cs.paddingRight);
   const c1=R(cards[1]),c2=R(cards[2]);
   o.p2={sw:rail.scrollWidth,cw:rail.clientWidth,sh:rail.scrollHeight,ch:rail.clientHeight,bigW:Math.round(R(cards[0]).width),inner:Math.round(inner),
    pair:Math.abs(c1.top-c2.top)<2&&c2.left>c1.right};
   const rects=cards.map(c=>R(c)); let hits=[];
   for(let i=0;i<rects.length;i++)for(let j=i+1;j<rects.length;j++){const a=rects[i],b=rects[j];if(a.left<b.right-0.5&&b.left<a.right-0.5&&a.top<b.bottom-0.5&&b.top<a.bottom-0.5)hits.push(cards[i].dataset.card+'/'+cards[j].dataset.card);}
   o.p3={minPic:Math.round(Math.min(...cards.slice(1).map(c=>R(c.querySelector('.sjy-pic')).height))),hits};
   const strip=$('seJy').querySelector('.se-strip'), tb=strip.querySelector('.se-ttl-b');
   o.p4={title:tb.textContent,clipped:tb.scrollWidth>tb.clientWidth+1,right:Math.round(R(tb).right),coin:Math.round(R(strip.querySelector('[data-se-pill="coins"]')).left)};
   const foot=$('seJy').querySelector('.sjy-foot'), fr=R(foot);
   const sr=R(card('story'));
   o.p7={cut:cutSubs(),shade:getComputedStyle(card('story').querySelector('.sjy-big')).backgroundImage.slice(0,15),art:card('story').dataset.art,toast:toastAt(),storyBottom:Math.round(sr.bottom),footTop:Math.round(fr.top)};
   rail.scrollTop=rail.scrollHeight; await wait(300);
   o.p5={foot:vis(foot),footBottom:Math.round(fr.bottom),vh:innerHeight,track:vis($('sjyTrack')),lastBottom:Math.round(R(cards[cards.length-1]).bottom),footTop:Math.round(fr.top),all:vis(foot.querySelector('[data-sjy="all"]'))};
   rail.scrollTop=0; await wait(200);
   G.hidePanels(); await wait(200); veteran(); await openHub(); await wait(300);
   card('special').scrollIntoView({block:'center'}); await wait(300);
   o.p8={feat:G.seJourney.state.feat,ribbon:ribbon()};
   G.hidePanels(); await wait(200); await openHub(); await wait(200); rail.scrollTop=0; await wait(150);
   return o;
  })()`));
  await p.tap('#seJy [data-card="daily"]'); await p.waitForTimeout(450);
  const t1=await p.evaluate(()=>{const Q=document.getElementById('questPanel'),b=Q.querySelector('.tabbtn.on[data-q^="tab:"]');return {framed:window.__features.seFrame.framed(),tab:b?b.dataset.q.slice(4):null,hub:window.__features.seJourney.state.on};});
  await p.tap('#seFrameTop [data-se="back"]'); await p.waitForTimeout(600);
  const t2=await p.evaluate(()=>({hub:window.__features.seJourney.state.on&&document.getElementById('seJy').classList.contains('on'),covered:document.getElementById('questPanel').classList.contains('se-covered')}));
  await p.evaluate(()=>window.__features.hidePanels());
  check('phone: the hub opens from the ☰ tile, no emoji',q.p1.hub&&q.p1.emoji.length===0,q.p1);
  check('phone: the cards are a two-column grid that scrolls down, not sideways; the story card full width',q.p2.sw<=q.p2.cw+1&&q.p2.sh>q.p2.ch&&Math.abs(q.p2.bigW-q.p2.inner)<=2&&q.p2.pair,q.p2);
  check('phone: every picture has its height and no card overlaps another',q.p3.minPic>=100&&q.p3.hits.length===0,q.p3);
  check('phone: the strip\'s title is whole and ends before the coin pill',q.p4.title==='My Journey'&&!q.p4.clipped&&q.p4.right<=q.p4.coin,q.p4);
  check('phone: the All quests bar sits at the bottom, no scrollbar track; the last card clears it',q.p5.foot&&q.p5.all&&Math.abs(q.p5.footBottom-q.p5.vh)<=1&&!q.p5.track&&q.p5.lastBottom<=q.p5.footTop,q.p5);
  check('phone: a tap on the daily card opens the Daily tab framed; a tap on Back returns to the hub',t1.framed==='questPanel'&&t1.tab==='daily'&&!t1.hub&&t2.hub&&t2.covered,{t1,t2});
  check('phone: every subtitle is whole (two lines where it needs them); the story\'s shade is soft on every side and its picture drawn for the phone',
   q.p7.cut.length===0&&/^radial/.test(q.p7.shade)&&/:p$/.test(q.p7.art),{cut:q.p7.cut,shade:q.p7.shade,art:q.p7.art});
  check('phone: a message sits just over the All quests bar, not over the story card',!q.p7.toast.cards.includes('story')&&q.p7.toast.rect[1]>=q.p7.storyBottom&&q.p7.toast.rect[3]<=q.p7.footTop+1,q.p7.toast);
  check('phone: the featured special\'s ribbon shows the days left whole, and no pip sits on it',q.p8.feat==='special'&&!!q.p8.ribbon&&q.p8.ribbon.whole&&/(\d+ days? left|last day)/i.test(q.p8.ribbon.text)&&q.p8.ribbon.pips===0,q.p8);
  await ctx.close();}

 /* ================================ an 844x390 phone held sideways ================================ */
 {const {ctx,page:p}=await newPage({viewport:{width:844,height:390},hasTouch:true,isMobile:true,deviceScaleFactor:2},'landscape');
  await boot(p,'se-journey-land');
  const l=await p.evaluate(new Function('return (async()=>{'+PRE+`
   await openHub(); await wait(300);
   const rail=$('sjyRail'), cards=[...rail.querySelectorAll(':scope>.sjy-card')], R=e=>e.getBoundingClientRect();
   const foot=$('seJy').querySelector('.sjy-foot'), pb=R(foot).height;
   const tops=[...new Set(cards.slice(1).map(c=>Math.round(R(c).top)))];
   const o={vw:innerWidth,vh:innerHeight,rows:tops.length,limit:Math.round(innerHeight-pb),maxBottom:Math.round(Math.max(...cards.map(c=>R(c).bottom))),
    clipped:[...$('seJy').querySelectorAll('.sjy-t')].filter(t=>t.scrollHeight>t.clientHeight+1||t.scrollWidth>t.clientWidth+1).map(t=>t.textContent),
    track:vis($('sjyTrack'))&&!$('sjyTrack').classList.contains('none'),emoji:emoji()};
   o.toast=toastAt(); o.cut=cutSubs(); o.fade0=rail.classList.contains('more');
   rail.scrollLeft=rail.scrollWidth; await wait(300); o.fadeEnd=rail.classList.contains('more'); rail.scrollLeft=0; await wait(150);
   G.hidePanels(); await wait(200); veteran(); await openHub(); await wait(300);
   card('special').scrollIntoView({inline:'center'}); await wait(300);
   o.vet={feat:G.seJourney.state.feat,ribbon:ribbon(),clipped:[...$('seJy').querySelectorAll('.sjy-t')].filter(t=>t.scrollHeight>t.clientHeight+1||t.scrollWidth>t.clientWidth+1).map(t=>t.textContent)};
   G.hidePanels(); await wait(200); return o;
  })()`));
  check('landscape phone: two rows, every card above the scrollbar',l.rows===2&&l.maxBottom<=l.limit,l);
  check('landscape phone: no card title is cut',l.clipped.length===0,l.clipped);
  check('landscape phone: the scrollbar track is shown; no emoji',l.track&&l.emoji.length===0,{track:l.track,emoji:l.emoji});
  check('landscape phone: a message sits in the strip, on no card; the story\'s chapter is whole',l.toast.cards.length===0&&l.cut.length===0,{toast:l.toast,cut:l.cut});
  check('landscape phone: the column cut by the right edge fades while the row runs on, and not at its end',l.fade0&&!l.fadeEnd,{fade0:l.fade0,fadeEnd:l.fadeEnd});
  check('landscape phone: the featured special\'s ribbon shows the days left whole, no pip on it, no title cut',l.vet.feat==='special'&&!!l.vet.ribbon&&l.vet.ribbon.whole&&/(\d+ days? left|last day)/i.test(l.vet.ribbon.text)&&l.vet.ribbon.pips===0&&l.vet.clipped.length===0,l.vet);
  await ctx.close();}

 check('no page errors',errors.length===0,errors.slice(0,6));
 const bad=checks.filter(c=>!c.ok).length;
 console.log(bad?('FAILED '+bad+'/'+checks.length):('passed '+checks.length+'/'+checks.length));
 await browser.close(); process.exit(bad?1:0);
})().catch(async e=>{console.error(e);try{if(browser)await browser.close();}catch(x){}process.exit(2);});

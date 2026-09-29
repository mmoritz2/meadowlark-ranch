/* My Horses rebuilt as portrait cards (assets/features/se-horses.js).

   Boots the game and proves: the ☰ My Horses tile opens the new screen, which stands in for the stable
   panel (open underneath, hidden, so every way in arrives here); its strip reads "My Horses (N total)"
   with the coins and gems; the starter's breed has its heading, a ten-node mastery track with the
   shield on 1 and the starter's card (level crest, stars, RIDING) and a Get Horse card; the starter's
   coat banner chooses the coat through story-quests' own buttons; more horses give more sections (five
   nodes for a fantasy breed, the Aether counting towards the Friesian, a FOAL tag); the cards are
   SE-sized inside the column, the list scrolls, and each card's head arrives as the horse's own
   portrait with the renderer left as it was; a card opens the drawer with its tiles; Favourite,
   Pasture, Rename and Ride go through the game; Details goes to the Horse Overview and its Back comes
   back here (its Close does not), a foal's Details to the horse sheet and back, Get Horse to the
   Market and back, the Full list to the framed old list and back; Pets opens its sheet; the hero proxy
   is the only data-st of ours and a real click on it adopts or rides the Bay sporthorse, the same one
   each time; Escape peels search, drawer, screen in that order; the keys do not walk the horse and N
   toggles; a course start and another menu close it; a barn stall's highlight opens that horse; a
   story-reward note shows; nothing we draw is an emoji; the dim is as strong as the contrast needs;
   every tile goes where it should (the sheet and the family tree framed and back, Tack to the Market and
   back, Whistle, Take along, Hitch at a post), a foal's gold button follows, an egg has only the tiles
   that make sense, the last node's popover keeps its width, a story breed's Get Horse says how in a
   sentence, a 14-letter name fits its card and the panel title, the foot summary is whole with the panel
   open, a stall highlight is used once, and after a click the arrow keys give up the focus so Enter
   presses the gold button.
   Then a 390x844 touch phone (the title fits, three columns, the track fits, the drawer is a bottom
   sheet with 44 px targets, the tight foot and its More sheet, toasts clear of the foot and of the More
   sheet, the title with a very big purse) and an 844x390 landscape phone (the drawer's buttons on
   screen, the picture beside the facts and not too tall, the first row of tiles in view, a tight foot).

   Usage:  QA_PORT=8432 QA_URL=http://127.0.0.1:8432 NODE_PATH=$(npm root -g) node tools/qa-se-horses.cjs */
const QA=require('./qa-platform.cjs');
const {chromium}=QA, fs=require('node:fs'), path=require('node:path');
const OUT=path.resolve('output/se-horses-qa'); fs.mkdirSync(OUT,{recursive:true});
const checks=[];
function check(name,ok,detail){checks.push({name,ok:!!ok,detail});console.log((ok?'PASS ':'FAIL ')+name+(detail!==undefined?' — '+JSON.stringify(detail):''));}
let browser=null;
setTimeout(async()=>{console.error('WATCHDOG: no result after 480 s');try{if(browser)await browser.close();}catch(e){}process.exit(3);},480000).unref();
const BOOT=async(page,url)=>{
 await page.goto(url,{waitUntil:'load',timeout:120000});
 await page.waitForFunction(()=>window.render_game_to_text&&(()=>{try{const s=JSON.parse(render_game_to_text());return s.graphics&&s.graphics.horseReady&&!s.graphics.horseLoading;}catch(e){return false;}})(),null,{timeout:180000,polling:250});
 await page.waitForTimeout(1500);
 await page.evaluate(()=>{const c=document.getElementById('seChar');if(c&&c.classList.contains('on')&&window.__features.wardrobe)window.__features.wardrobe.closeChar();});
 /* helpers every evaluate below uses */
 await page.evaluate(()=>{
  const $=id=>document.getElementById(id);
  const wait=ms=>new Promise(res=>setTimeout(res,ms));
  const until=async(f,ms)=>{const t0=Date.now();while(Date.now()-t0<ms){try{if(f())return true;}catch(e){}await wait(80);}return false;};
  const vis=el=>{if(!el)return false;const cs=getComputedStyle(el),r=el.getBoundingClientRect();return cs.display!=='none'&&cs.visibility!=='hidden'&&r.width>0&&r.height>0;};
  const R=e=>{if(typeof e==='string')e=document.querySelector(e);if(!e)return null;const cs=getComputedStyle(e),r=e.getBoundingClientRect();return cs.display==='none'||cs.visibility==='hidden'||r.width<1?null:r;};
  const key=(code,k)=>window.dispatchEvent(new KeyboardEvent('keydown',{code,key:k||code,bubbles:true}));
  const esc=()=>key('Escape');
  const st=()=>JSON.parse(render_game_to_text()).seHorses;
  const G=window.__features, sv=()=>G.save.fresh();
  const RE=new RegExp(window.__noEmoji.SEQ,'u');
  const shown=el=>{if(!el||!el.getClientRects().length)return false;for(let e=el;e&&e!==document.documentElement;e=e.parentElement){const cs=getComputedStyle(e);if(cs.display==='none'||cs.visibility==='hidden'||cs.opacity==='0'||parseFloat(cs.fontSize)===0)return false;}return true;};
  const emoji=()=>{const o=[],root=$('seHs');const tw=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);for(let n=tw.nextNode();n;n=tw.nextNode()){const e=n.parentElement;if(!e||['SCRIPT','STYLE'].includes(e.tagName))continue;if(RE.test(n.nodeValue)&&shown(e))o.push(n.nodeValue.trim().slice(0,30));}
   for(const el of root.querySelectorAll('[title],[placeholder],[aria-label]'))for(const a of ['title','placeholder','aria-label']){const v=el.getAttribute(a);if(v&&RE.test(v)&&shown(el))o.push('@'+a+' '+v.slice(0,30));}return o;};
  const open=async()=>{if(!G.seHorses.state.on){$('stableBtn').click();await until(()=>G.seHorses.state.on,3000);await wait(250);}};
  const cardOf=(sel)=>document.querySelector(sel);
  window.__qh={$,wait,until,vis,R,key,esc,st,G,sv,emoji,open,cardOf};
 });
};

(async()=>{
 browser=await chromium.launch({headless:true,args:['--disable-background-timer-throttling',QA.ANGLE,'--enable-gpu-rasterization','--ignore-gpu-blocklist']});
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 const errors=[];
 page.on('pageerror',e=>errors.push('PAGEERROR '+e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 page.on('dialog',d=>{d.dismiss().catch(()=>{});});
 await BOOT(page,QA.BASE+'/ranch3d.html?qa=se-horses&fresh='+Date.now());   // no &emoji=0: the no-emoji package is not installed, so our own output has to be clean
 /* The frame watchdog is kept out of this run (qualityLocked, as a tier picked by hand). On a loaded machine it steps the
    graphics down with this screen closed as well (2-second windows of 67-113 ms a frame measured at load 18, the screen shut),
    and on Low the portraits rightly stop. Check 7 still proves our own code leaves the tier as it was. */
 await page.evaluate(()=>window.__qh.G.save.sync(s=>{s.qualityLocked=true;}));

 /* ---------------- 1-4 and 25a: a new save ---------------- */
 const a=await page.evaluate(async()=>{
  const {$,wait,until,vis,st,G,sv,emoji}=window.__qh, out={};
  out.installed=G.installed.includes('se-horses')&&!!G.seHorses;
  $('seMenuBtn').click(); await wait(300);
  $('seMenu').querySelector('.se-tiles>[data-sem-main="horses"]').click();
  await until(()=>G.seHorses.state.on,3000); await wait(400);
  const P=$('stablePanel'), gs=JSON.parse(render_game_to_text());
  out.cover={screen:vis($('seHs')),panelFlex:P.style.display==='flex',covered:P.classList.contains('se-covered'),opacity:getComputedStyle(P).opacity,hud:getComputedStyle($('seHudRoot')).visibility,covers:gs.seFrame.covers,framed:G.seFrame.framed()};
  const s=sv(), strip=$('seHs').querySelector('.se-strip');
  out.title={t:strip.querySelector('.se-ttl-b').textContent,coin:strip.querySelector('[data-se-pill="coins"] b').textContent,want:G.seFrame.fmt(s.coins)};
  const sec=document.querySelectorAll('section.shs-sec[data-breed="bay-sporthorse"]'), s0=sec[0], c=s0&&s0.querySelector('.shs-card[data-hid]');
  out.starter={n:sec.length,head:s0&&s0.querySelector('.shs-bh').textContent,label:G.horse.breedLabel('bay-sporthorse'),nodes:s0&&s0.querySelectorAll('.shs-node').length,shields:s0&&s0.querySelectorAll('.shs-shield').length,
   m:s0&&s0.querySelector('.shs-shield').dataset.m,name:c&&c.querySelector('.shs-nm').textContent,want:s.horses[0].name,lv:c&&c.querySelector('.shs-lv').textContent.trim(),stars:c&&c.querySelectorAll('.shs-stars i').length,
   ride:!!(c&&c.querySelector('.shs-tag.ride')),get:s0&&s0.querySelectorAll('.shs-card.get').length,favHint:!!document.querySelector('.shs-sec.fav .shs-hint'),cards:st().cards};
  out.emojiCoat=emoji();
  /* the coat banner, through story-quests' own buttons */
  const bs=[...document.querySelectorAll('#seHs [data-shs^="coat:"]')]; out.coat={buttons:bs.length,banner:!!document.querySelector('.shs-coat'),title:(document.querySelector('.shs-coat b')||{}).textContent,line:(document.querySelector('.shs-coat>span')||{}).textContent};
  if(bs[1])bs[1].click();
  out.coat.gone=await until(()=>!document.querySelector('.shs-coat'),800);
  out.coat.fx=document.querySelectorAll('[data-fx^="sq:coat:"]').length; out.coat.chosen=!!(sv().starterCoat&&sv().starterCoat.chosen);
  return out;
 });
 await page.screenshot({path:path.join(OUT,'desk-fresh.png')});
 check('se-horses installed',a.installed);
 check('1. the ☰ My Horses tile opens the screen over the stable panel (open, covered, invisible), HUD down, nothing framed',a.cover.screen&&a.cover.panelFlex&&a.cover.covered&&a.cover.opacity==='0'&&a.cover.hud==='hidden'&&a.cover.covers.includes('stablePanel')&&a.cover.framed===null,a.cover);
 check('2. the strip reads "My Horses (1 total)" and the coin pill shows the coins',a.title.t==='My Horses (1 total)'&&a.title.coin===a.title.want,a.title);
 check('3. the starter\'s breed: heading with (Mastery 1), 9 nodes and the shield on 1, the starter\'s card (Lv 1, 2 stars, RIDING), a Get Horse card, the favourites hint',
  a.starter.n===1&&a.starter.head.includes(a.starter.label)&&a.starter.head.includes('(Mastery 1)')&&a.starter.nodes===9&&a.starter.shields===1&&a.starter.m==='1'&&a.starter.name===a.starter.want&&a.starter.lv==='1'&&a.starter.stars===2&&a.starter.ride&&a.starter.get===1&&a.starter.favHint&&a.starter.cards===1,a.starter);
 check('4. the coat banner (title and line) chooses the coat through story-quests\' own buttons and goes',a.coat.buttons===3&&a.coat.banner&&/coat/i.test(a.coat.title||'')&&(a.coat.line||'').length>5&&a.coat.gone&&a.coat.fx===0&&a.coat.chosen,a.coat);
 check('25a. no emoji in what we draw (with the coat banner up)',a.emojiCoat.length===0,a.emojiCoat);

 /* ---------------- 5-7: many horses; geometry; portraits ---------------- */
 const b=await page.evaluate(async()=>{
  const {$,wait,until,st,G,sv}=window.__qh, out={};
  const add=[['bay'],['bay'],['black'],['aether'],['pegasus'],['chestnut',{foal:true}],['unicorn']];
  G.save.sync(s=>{for(const [k,o] of add)G.horse.grantHorse(s,k,Object.assign({src:'qa'},o||{}));const bl=s.horses.find(h=>h.breed==='black');if(bl)bl.name='Maple';});
  G.horse.reloadHorses();
  out.grew=await until(()=>st().title==='My Horses (8 total)',1500);
  const S=st(), sec=k=>S.sections.find(x=>x.breed===k)||{};
  out.sections={title:S.title,bay:sec('bay').cards,black:sec('black'),blackM:G.xp.masteryOf(sv(),'black'),aether:sec('aether').max,pegasus:sec('pegasus').max,unicorn:sec('unicorn').max,
   foalTag:!!document.querySelector('.shs-sec[data-breed="chestnut"] .shs-tag.foal'),cards:S.cards};
  /* geometry */
  const cards=[...document.querySelectorAll('#seHs .shs-card')].map(c=>c.getBoundingClientRect()), W=innerWidth;
  out.geo={w:Math.round(cards[0].width),ratio:+(cards[0].height/cards[0].width).toFixed(3),inside:cards.every(r=>r.left>=W*0.14-2&&r.right<=W*0.86+2),
   minL:Math.round(Math.min(...cards.map(r=>r.left))),maxR:Math.round(Math.max(...cards.map(r=>r.right))),scrollW:document.documentElement.scrollWidth<=innerWidth};
  G.save.sync(s=>{const L=['percheron','grey','thoro','bay','black','chestnut','appaloosa','bay','grey','pegasus','unicorn','aether'];for(const k of L)G.horse.grantHorse(s,k,{src:'qa'});});
  G.horse.reloadHorses(); await until(()=>st().title==='My Horses (20 total)',1500); await wait(200);
  const m=$('shsMain'); out.scroll={sh:m.scrollHeight,ch:m.clientHeight};
  return out;
 });
 /* a real wheel over the list scrolls it */
 await page.mouse.move(640,420); await page.mouse.wheel(0,500); await page.waitForTimeout(500);
 const sc=await page.evaluate(()=>{const m=document.getElementById('shsMain');const t=m.scrollTop;m.scrollTop=0;return t;});
 check('5. more horses: "(8 total)", Quarter Horse ×2, Friesian at the Aether-counted mastery with 10 nodes, fantasy breeds with 5, a FOAL tag, 8 breed cards',
  b.grew&&b.sections.bay===2&&b.sections.black.M===b.sections.blackM&&b.sections.blackM===2&&b.sections.black.max===10&&b.sections.aether===5&&b.sections.pegasus===5&&b.sections.unicorn===5&&b.sections.foalTag&&b.sections.cards===8,b.sections);
 check('6. cards SE-sized (95-110 px, 1.29 tall) inside the 14%-86% column, no sideways scroll; the list scrolls with the wheel',
  b.geo.w>=95&&b.geo.w<=110&&Math.abs(b.geo.ratio-1.294)<=0.04&&b.geo.inside&&b.geo.scrollW&&b.scroll.sh>b.scroll.ch&&sc>0,{geo:b.geo,scroll:b.scroll,wheel:sc});
 const gfx0=await page.evaluate(()=>window.__qh.G.gfx.get());
 const c7=await page.evaluate(async()=>{
  const {$,wait,until,st,G,sv}=window.__qh, out={}, t0=Date.now();
  $('shsMain').scrollTop=0; await wait(300);
  const inView=()=>{const m=$('shsMain').getBoundingClientRect();return [...document.querySelectorAll('#seHs .shs-card[data-hid]')].filter(c=>{const r=c.getBoundingClientRect();return r.bottom>m.top&&r.top<m.bottom&&!c.querySelector('.shs-tag.egg');});};
  out.all=await until(()=>{const L=inView();return L.length&&L.every(c=>{const im=c.querySelector('img.shs-img');return im&&im.classList.contains('got')&&/^(blob|data):/.test(im.getAttribute('src')||'');});},20000);
  out.ms=Date.now()-t0; out.n=inView().length;
  const s=sv(), uni=s.horses.find(h=>h.breed==='unicorn'), blk=s.horses.find(h=>h.breed==='black');
  G.seHorses.select(uni.id); await until(()=>!!G.seHorses.portrait(uni.id),10000);
  G.seHorses.select(blk.id); await until(()=>!!G.seHorses.portrait(blk.id),10000);
  const mean=async url=>{if(!url)return null;const im=new Image();im.src=url;await im.decode();const c=document.createElement('canvas');c.width=60;c.height=75;const x=c.getContext('2d');x.drawImage(im,0,0,60,75);const d=x.getImageData(0,0,60,75).data;let r=0,g=0,b=0;for(let i=0;i<d.length;i+=4){r+=d[i];g+=d[i+1];b+=d[i+2];}const n=d.length/4;return [r/n,g/n,b/n];};
  const mu=await mean(G.seHorses.portrait(uni.id)), mb=await mean(G.seHorses.portrait(blk.id));
  out.dist=mu&&mb?Math.round(Math.hypot(mu[0]-mb[0],mu[1]-mb[1],mu[2]-mb[2])):null;
  const P=st().portraits; out.failed=P.failed; out.done=P.done; out.log=P.log;
  await wait(400);
  const r=G.renderer, v=new G.THREE.Vector4(); r.getViewport(v);
  out.renderer={scissor:r.getScissorTest(),vz:v.z,vw:v.w,iw:innerWidth,ih:innerHeight,dpr:r.getPixelRatio()};
  $('seHs').querySelector('[data-shs="drclose"]').click(); await wait(300);
  return out;
 });
 const gfx1=await page.evaluate(()=>window.__qh.G.gfx.get());
 console.log('   portraits: '+c7.n+' cards in view in '+c7.ms+' ms; stages (build, model wait, compile, tick wait, shot) '+JSON.stringify(c7.log));
 check('7. every card in view shows its own portrait (blob) within 20 s, none failed, the renderer restored, the graphics tier unchanged, and a unicorn looks unlike a black Friesian',
  c7.all&&c7.failed===0&&!c7.renderer.scissor&&(c7.renderer.dpr!==1||(c7.renderer.vz===c7.renderer.iw&&c7.renderer.vw===c7.renderer.ih))&&gfx0===gfx1&&c7.dist>40,{all:c7.all,ms:c7.ms,n:c7.n,failed:c7.failed,renderer:c7.renderer,gfx:[gfx0,gfx1],dist:c7.dist});

 /* ---------------- 8-12: the drawer and its actions ---------------- */
 await page.evaluate(()=>{const c=document.querySelector('.shs-sec[data-breed="bay"] .shs-card[data-hid]');c.scrollIntoView({block:'center'});});
 await page.waitForTimeout(300);
 await page.click('.shs-sec[data-breed="bay"] .shs-card[data-hid]');
 await page.waitForTimeout(400);
 const d=await page.evaluate(async()=>{
  const {$,wait,until,vis,st,G,sv}=window.__qh, out={};
  const c=document.querySelector('.shs-sec[data-breed="bay"] .shs-card[data-hid]'), id=+c.dataset.hid, s=sv(), h=s.horses.find(x=>x.id===id), dr=$('shsDr');
  out.id=id;
  out.drawer={vis:vis(dr)&&getComputedStyle(dr).visibility!=='hidden',state:st().drawer,name:dr.querySelector('.shs-dr-h b').textContent,want:h.name,
   chips:[...dr.querySelectorAll('[data-shs^="act:"]')].map(b=>b.dataset.shs),pri:dr.querySelector('[data-shs="primary"]').textContent,sec:dr.querySelector('.shs-dr-foot [data-shs="secondary"]').textContent};
  /* favourite */
  dr.querySelector('[data-shs="act:fav"]').click(); await wait(250);
  out.fav={saved:sv().horses.find(x=>x.id===id).fav===true,inFav:!!document.querySelector('.shs-sec.fav .shs-card[data-hid="'+id+'"]'),both:[...document.querySelectorAll('.shs-card[data-hid="'+id+'"]')].filter(x=>x.classList.contains('sel')).length};
  $('shsDr').querySelector('[data-shs="act:fav"]').click(); await wait(250);
  out.fav.cleared=!('fav' in sv().horses.find(x=>x.id===id))&&!!document.querySelector('.shs-sec.fav .shs-hint');
  /* pasture */
  const locT=()=>{const e=document.querySelector('.shs-sec[data-breed="bay"] .shs-card[data-hid="'+id+'"] .shs-loc');return e&&e.title;};
  const o0=!!sv().horses.find(x=>x.id===id).out, t0=locT();
  $('shsDr').querySelector('[data-shs="act:out"]').click(); await wait(500);
  out.out={before:o0,after:!!sv().horses.find(x=>x.id===id).out,t0,t1:locT()};
  /* rename, over the screen */
  $('shsDr').querySelector('[data-shs="rename"]').click(); await wait(250);
  const dlg=$('dlg'); out.rename={dlg:dlg.style.display==='block'&&vis(dlg),z:[+getComputedStyle(dlg).zIndex,+getComputedStyle($('seHs')).zIndex]};
  const inp=$('nameIn'); if(inp){inp.value='Rowan2';} const ok=$('dlgBtn'); if(ok)ok.click();
  await until(()=>(document.querySelector('.shs-sec[data-breed="bay"] .shs-card[data-hid="'+id+'"] .shs-nm')||{}).textContent==='Rowan2',2500);   // the game rebuilds the world before it re-renders the list (a busy machine takes a while)
  out.rename.card=(document.querySelector('.shs-sec[data-breed="bay"] .shs-card[data-hid="'+id+'"] .shs-nm')||{}).textContent;
  out.rename.on=st().on;
  return out;
 });
 await page.screenshot({path:path.join(OUT,'desk-drawer.png')});
 check('8. a real click on a Quarter Horse card opens the drawer on it, with Favourite, Pasture, Tack, Sheet and Family tree, Ride and Details',
  d.drawer.vis&&d.drawer.state&&d.drawer.name===d.drawer.want&&['act:fav','act:out','act:tack','act:sheet','act:tree'].every(k=>d.drawer.chips.includes(k))&&d.drawer.pri==='Ride'&&d.drawer.sec==='Details',d.drawer);
 check('9. Favourite saves h.fav, puts the horse in Favourites (both copies selected), and clears again',d.fav.saved&&d.fav.inFav&&d.fav.both===2&&d.fav.cleared,d.fav);
 check('10. Pasture flips the saved turnout through the row\'s own button, and the card\'s place icon follows',d.out.before!==d.out.after&&d.out.t0!==d.out.t1,d.out);
 check('11. Rename opens the name dialog above the screen and renames the card; the screen stays',d.rename.dlg&&d.rename.z[0]>d.rename.z[1]&&d.rename.card==='Rowan2'&&d.rename.on,d.rename);
 const e=await page.evaluate(async id=>{
  const {$,wait,until,st,G,sv}=window.__qh, out={};
  $('shsDr').querySelector('[data-shs="primary"]').click();
  await until(()=>sv().ridingHorseId===id&&!st().on,3000); await wait(200);
  out.ride={riding:sv().ridingHorseId===id,on:st().on,panel:$('stablePanel').style.display};
  /* Details (the Overview) and its Back and Close */
  await window.__qh.open(); G.seHorses.select(id); await wait(300);
  out.pri=$('shsDr').querySelector('[data-shs="primary"]').textContent;
  $('shsDr').querySelector('[data-shs="primary"]').click(); await wait(500);
  out.ov={on:$('seOv').classList.contains('on'),screen:st().on};
  $('seOv').querySelector('[data-se="close"][title="Back"]').click();
  out.back=await until(()=>st().on&&st().sel===id,1200); out.backSel=st().sel;
  $('shsDr').querySelector('[data-shs="primary"]').click(); await wait(500);
  $('seOv').querySelector('[data-se="close"][title="Close"]').click(); await wait(900);
  out.closeStays=!st().on&&!$('seOv').classList.contains('on');
  return out;
 },d.id);
 check('12. Ride rides that horse through the row\'s own button and closes the screen and the panel',e.ride.riding&&!e.ride.on&&e.ride.panel==='none',e.ride);
 check('13. the ridden horse\'s Details opens the Horse Overview; its Back comes back here on that horse, its Close does not',e.pri==='Details'&&e.ov.on&&!e.ov.screen&&e.back&&e.closeStays,e);

 /* ---------------- 14-18 ---------------- */
 const f=await page.evaluate(async()=>{
  const {$,wait,until,vis,st,G,sv}=window.__qh, out={};
  await window.__qh.open();
  const foal=sv().horses.find(h=>h.foal&&!h.egg); G.seHorses.select(foal.id); await wait(300);
  const dr=$('shsDr'); out.foal={pri:dr.querySelector('[data-shs="primary"]').textContent,ride:[...dr.querySelectorAll('button')].some(b=>/^ride$/i.test(b.textContent.trim()))};
  dr.querySelector('.shs-dr-foot [data-shs="secondary"]').click(); await wait(500);
  out.foal.sheet=$('sheetPanel').classList.contains('se-fr')&&$('sheetPanel').style.display==='flex';
  $('seFrameTop').querySelector('[data-se="back"]').click();
  out.foal.back=await until(()=>st().on&&st().sel===foal.id,1500);
  /* Get Horse, the Market, and back */
  $('shsDr').querySelector('[data-shs="drclose"]').click(); await wait(200);
  const idx=G.tables.BREEDS3.findIndex(r=>r[0]==='bay');
  document.querySelector('.shs-card.get[data-shs="get:bay"]').click();
  const sp=$('shopPanel'), rowOf=()=>{const btn=sp.querySelector('[data-buyh="'+idx+'"]');return btn&&btn.closest('.evrow');};
  await until(()=>{const r=rowOf();return sp.style.display==='flex'&&!!r&&/outline/.test(r.getAttribute('style')||'');},2000); await wait(100);   // outlined in the next frame, which a busy machine delays
  const row=rowOf(); out.get={flex:sp.style.display==='flex',outlined:!!(row&&/outline/.test(row.getAttribute('style')||'')),screen:st().on};
  $('seMkTop').querySelector('[data-mt="close"][title="Back"]').click();
  out.get.back=await until(()=>st().on,1500);
  /* the Full list, framed, and back */
  $('seHs').querySelector('[data-shs="classic"]').click(); await wait(400);
  out.classic={framed:$('stablePanel').classList.contains('se-fr'),title:$('seFrameTop').querySelector('.se-ttl-b').textContent,screen:st().on};
  $('seFrameTop').querySelector('[data-se="back"]').click();
  out.classic.back=await until(()=>st().on,1500);
  /* Pets */
  $('seHs').querySelector('[data-shs="pets"]').click(); await wait(250);
  const m=$('shsModal'); out.pets={open:st().modal==='pets'&&vis(m),none:/No pets yet/.test(m.textContent),market:!!m.querySelector('[data-shs="petmarket"]')};
  out.emojiModal=window.__qh.emoji();
  window.__qh.esc(); await wait(250); out.pets.closed=st().modal===null&&st().on;
  /* the hero proxy */
  const hero=document.querySelector('[data-st="hero"]');
  out.hero={ours:!!(hero&&hero.closest('#seHs')),dataSt:document.querySelectorAll('#seHs [data-st]').length,dataFx:document.querySelectorAll('#seHs [data-fx]').length,
   ride:!!(document.querySelector('[data-st^="ride:"]')&&document.querySelector('[data-st^="ride:"]').closest('#stablePanel')),count:sv().horses.length,bay:(sv().horses.find(h=>h.breed==='bay-sporthorse'&&!h.foal)||{}).id};
  return out;
 });
 check('14. a foal has no Ride (its gold button is Follow me); its Details opens the horse sheet, framed, and Back comes back on the foal',f.foal.pri==='Follow me'&&!f.foal.ride&&f.foal.sheet&&f.foal.back,f.foal);
 check('15. Get Horse opens the Market on the Quarter Horse, outlined; the Market\'s Back comes back here',f.get.flex&&f.get.outlined&&!f.get.screen&&f.get.back,f.get);
 check('16. the Full list shows the old list, framed as "My Horses"; its Back comes back here',f.classic.framed&&f.classic.title==='My Horses'&&!f.classic.screen&&f.classic.back,f.classic);
 check('17. Pets opens its sheet ("No pets yet" and a Market button); Escape closes it and the screen stays',f.pets.open&&f.pets.none&&f.pets.market&&f.pets.closed,f.pets);
 await page.click('[data-st="hero"]'); await page.waitForTimeout(600);
 const h1=await page.evaluate(()=>({count:window.__qh.sv().horses.length,id:window.__qh.sv().ridingHorseId,on:window.__qh.st().on}));
 await page.evaluate(()=>window.__qh.open()); await page.waitForTimeout(300);
 await page.click('[data-st="hero"]'); await page.waitForTimeout(600);
 const h2=await page.evaluate(()=>({count:window.__qh.sv().horses.length,id:window.__qh.sv().ridingHorseId,on:window.__qh.st().on}));
 check('18. the hero proxy is our only data-st (no data-fx), the first in the page; two real clicks ride the same Bay sporthorse, no new horse',
  f.hero.ours&&f.hero.dataSt===1&&f.hero.dataFx===0&&f.hero.ride&&h1.count===f.hero.count&&h2.count===f.hero.count&&h1.id===f.hero.bay&&h2.id===f.hero.bay&&!h1.on,{hero:f.hero,h1,h2});

 /* ---------------- 28-37: every tile, the foal and egg buttons, the popover, long names, the stall ---------------- */
 const x=await page.evaluate(async()=>{
  const {$,wait,until,vis,st,G,sv,esc}=window.__qh, out={};
  G.save.sync(s=>{s.decor=s.decor||[];if(!s.decor.some(d=>d.id==='qapost1'))s.decor.push({id:'qapost1',t:'post',x:30,z:30,r:0});   // a free hitching post
   for(const h of s.horses)if(!h.foal)h.out=false;                                                                                        // room in the pasture
   G.horse.grantHorse(s,'kestrel',{src:'qa'}); G.horse.grantHorse(s,'petalmane',{src:'qa'}); G.horse.grantHorse(s,'pegasus',{src:'qa',foal:true}); const e=s.horses[s.horses.length-1]; e.egg=true; e.eggWarm=1; e.eggLaid=Date.now()-3600e3; e.name='Pip';
   s.petList=['dog','cat'];});
  G.horse.reloadHorses(); await wait(400);
  await window.__qh.open();
  const H=()=>sv().horses, ri=()=>G.horse.rideIdx(), sel=async id=>{G.seHorses.select(id);await wait(250);}, chip=k=>$('shsDr').querySelector('[data-shs="act:'+k+'"]'), pri=()=>$('shsDr').querySelector('[data-shs="primary"]');
  const i=H().findIndex((h,k)=>k!==ri()&&h.breed==='bay'&&!h.foal), id=H()[i].id; out.i=i;
  await sel(id);
  /* the horse sheet and the family tree, framed, and back on the same horse */
  chip('sheet').click(); await wait(500); out.sheet={framed:G.seFrame.framed()}; $('seFrameTop').querySelector('[data-se="back"]').click(); out.sheet.back=await until(()=>st().on&&st().sel===id,1500);
  chip('tree').click(); await wait(500); out.tree={framed:G.seFrame.framed()}; $('seFrameTop').querySelector('[data-se="back"]').click(); out.tree.back=await until(()=>st().on&&st().sel===id,1500);
  /* Tack: the Market's tack tab for this horse, and its Back */
  chip('tack').click(); await wait(600); out.tack={shop:$('shopPanel').style.display==='flex',tackFor:G.ranch&&G.ranch.tackFor,want:i,on:st().on};
  const tb=$('seMkTop')&&$('seMkTop').querySelector('[data-mt="close"][title="Back"]'); if(tb)tb.click(); out.tack.back=await until(()=>st().on&&st().sel===id,1500);
  /* Whistle on and off */
  chip('whistle').click(); await wait(400); out.wh={set:sv().whistleHorse===id,on:chip('whistle').classList.contains('on')}; chip('whistle').click(); await wait(400); out.wh.off=sv().whistleHorse!==id;
  /* out to the pasture, Take along on and off */
  if(!H()[i].out){chip('out').click();await wait(500);}
  out.eq={chip:!!chip('eq')};
  if(chip('eq')){chip('eq').click();await wait(500);out.eq.comp=sv().companion===id;out.eq.loc=(document.querySelector('.shs-sec[data-breed] .shs-card[data-hid="'+id+'"] .shs-loc')||{}).title;chip('eq').click();await wait(500);out.eq.off=sv().companion!==id;}
  /* back in the barn, Hitch and Unhitch at the post */
  if(H()[i].out){chip('out').click();await wait(500);}
  out.hitch={chip:chip('hitch')&&chip('hitch').textContent.trim()};
  if(chip('hitch')){chip('hitch').click();await wait(600);out.hitch.saved=H()[i].hitch||null;out.hitch.label=chip('hitch')&&chip('hitch').textContent.trim();chip('hitch').click();await wait(600);out.hitch.after=H()[i].hitch||null;}
  /* a foal's gold button: Follow me, then Following, then off */
  const foal=H().find(h=>h.foal&&!h.egg); await sel(foal.id);
  out.foal={pri0:pri().textContent}; pri().click(); await wait(500); out.foal.comp=sv().companion===foal.id; out.foal.pri1=pri()&&pri().textContent; if(pri())pri().click(); await wait(500); out.foal.off=sv().companion!==foal.id;
  /* an egg: no pasture, take along, tack, whistle or hitch; its gold button warms */
  const egg=H().find(h=>h.egg&&h.foal); await sel(egg.id);
  out.egg={chips:[...$('shsDr').querySelectorAll('[data-shs^="act:"]')].map(b=>b.dataset.shs),pri:pri().textContent};
  /* the mastery popover near the right end keeps its width inside the column; Escape takes it first */
  const tr=document.querySelector('.shs-sec[data-breed="bay"] .shs-track'), nodes=tr.querySelectorAll('.shs-node'), last=nodes[nodes.length-1]; last.scrollIntoView({block:'center'}); await wait(150);
  last.click(); await wait(200);
  const pop=document.querySelector('#seHs .shs-pop'), pr=pop&&pop.getBoundingClientRect(), cr=$('shsCol').getBoundingClientRect();
  out.pop={shown:!!pop,w:pr&&Math.round(pr.width),h:pr&&Math.round(pr.height),inside:!!pr&&pr.left>=cr.left-1&&pr.right<=cr.right+1,text:pop&&pop.textContent};
  esc(); await wait(200); out.pop.escGone=!document.querySelector('#seHs .shs-pop')&&st().on&&st().drawer;
  /* Get Horse on a story breed says how to get one in our own words */
  $('shsDr').querySelector('[data-shs="drclose"]').click(); await wait(200);
  const gk=document.querySelector('.shs-card.get[data-shs="get:kestrel"]'); gk.scrollIntoView({block:'center'}); gk.click(); await wait(250);
  out.story={modal:st().modal,text:$('shsModal').textContent,journey:!!$('shsModal').querySelector('[data-shs="journey"]')}; esc(); await wait(200);
  /* long names: a 14-letter name fits its card plate and the panel's title, without an ellipsis */
  G.save.sync(s=>{s.horses[i].name='Moonlight Star';}); G.seHorses.paint(); await wait(150); await sel(id);
  const sp=document.querySelector('.shs-sec[data-breed] .shs-card[data-hid="'+id+'"] .shs-nm>span'), nb=$('shsDr').querySelector('.shs-dr-h b');
  out.names={card:sp.textContent,cardFits:sp.scrollWidth<=sp.clientWidth+1,title:nb.textContent,titleFits:nb.scrollWidth<=nb.clientWidth+1&&nb.scrollHeight<=nb.clientHeight+1};
  /* the foot's summary with the panel open: whole (the short form if need be), or the tight foot */
  await wait(300); const sm=$('shsFoot').querySelector('.shs-sum'), shownSpan=sm&&[...sm.children].find(e=>e.getClientRects().length);
  out.sum={tight:$('seHs').classList.contains('tight'),text:shownSpan?shownSpan.textContent:null,fits:!!shownSpan&&shownSpan.getBoundingClientRect().width<=sm.clientWidth+1};
  /* a barn stall's highlight is used once: opening the panel again without a new visit leaves the panel closed */
  G.hidePanels(); await wait(250); G.ranch.openCard(2);
  out.stall={first:await until(()=>st().drawer&&st().sel===H()[2].id,800)};
  G.hidePanels(); await wait(250); $('stablePanel').style.display='flex'; await until(()=>st().on,1000); await wait(300);
  out.stall.again={on:st().on,drawer:st().drawer,sel:st().sel};
  /* the Care button on a needy horse's panel: the Overview's feeding tab, and its Back comes back on that horse */
  G.save.sync(s=>{const h=s.horses[i];h.needs=Object.assign({},h.needs||{},{hunger:10});});
  await sel(id); const care=$('shsDr').querySelector('[data-shs="care"]'); out.care={btn:!!care};
  if(care){care.click();await wait(700);out.care.ov=$('seOv').classList.contains('on');out.care.tab=(G.seCare.state&&G.seCare.state()||{}).tab||null;out.care.on=st().on;
   const cb=$('seOv').querySelector('[data-se="close"][title="Back"]'); if(cb)cb.click(); out.care.back=await until(()=>st().on&&st().sel===id,1800);}
  G.save.sync(s=>{s.horses[i].needs.hunger=90;});
  /* Pets: Follow makes the pet follow and the sheet says so; a second tap lets it go */
  if(!st().on){G.ui.openStable();await wait(400);} if(st().drawer)$('shsDr').querySelector('[data-shs="drclose"]').click(); await wait(150);
  $('seHs').querySelector('[data-shs="pets"]').click(); await wait(250);
  const pf=$('shsModal').querySelector('[data-shs="pet:dog"]'); out.pets={btn:!!pf};
  if(pf){pf.click();await wait(400);out.pets.active=G.pets&&G.pets.active&&G.pets.active();out.pets.following=[...$('shsModal').querySelectorAll('.shs-mrow')].some(r=>/Following/.test(r.textContent));out.pets.modal=st().modal;
   const pf2=$('shsModal').querySelector('[data-shs="pet:dog"]'); if(pf2)pf2.click(); await wait(400); out.pets.after=G.pets&&G.pets.active&&G.pets.active();}
  out.emojiPets=window.__qh.emoji(); esc(); await wait(200);
  /* Get Horse on a season breed: Season Pass closes this screen and opens the quest panel on the season */
  const gs=document.querySelector('.shs-card.get[data-shs="get:petalmane"]'); gs.scrollIntoView({block:'center'}); gs.click(); await wait(250);
  const sb=$('shsModal').querySelector('[data-shs="season"]'); out.season={modal:st().modal,btn:!!sb};
  if(sb){sb.click();await until(()=>$('questPanel').style.display==='flex',2000);await wait(300);out.season.on=st().on;out.season.quest=$('questPanel').style.display;}
  G.hidePanels(); await wait(250);
  out.emoji=window.__qh.emoji();
  G.hidePanels(); await wait(250);
  /* shut the screen while a picture is being made, again and again: nothing throws, and on the next open the pictures still come */
  const fresh=[]; G.save.sync(s=>{for(const k of ['grey','thoro','appaloosa','percheron','black']){G.horse.grantHorse(s,k,{src:'qa'});fresh.push(s.horses[s.horses.length-1].id);}}); G.horse.reloadHorses(); await wait(300);
  for(const [n,id2] of fresh.entries()){G.ui.openStable(); await wait(20); G.seHorses.select(id2); await wait([0,40,120,300,700][n]); G.hidePanels(); await wait(60);}
  await wait(600); G.ui.openStable(); await wait(200);
  out.reopen={got:await until(()=>fresh.every(id2=>!!G.seHorses.portrait(id2))||(G.seHorses.select(fresh.find(id2=>!G.seHorses.portrait(id2))),false),40000),failed:st().portraits.failed};
  G.hidePanels(); await wait(250);
  return out;
 });
 check('43. shutting the screen while a picture is being made, five times at different moments, throws nothing and the pictures still come on the next open',x.reopen.got&&x.reopen.failed===0,x.reopen);
 check('28. the Sheet and Family tree tiles open them framed, and Back comes back on the same horse',x.sheet.framed==='sheetPanel'&&x.sheet.back&&x.tree.framed==='treePanel'&&x.tree.back,{sheet:x.sheet,tree:x.tree});
 check('29. the Tack tile opens the Market\'s tack for that horse, and its Back comes back on the same horse',x.tack.shop&&x.tack.tackFor===x.tack.want&&!x.tack.on&&x.tack.back,x.tack);
 check('30. the Whistle tile sets and clears the whistle horse',x.wh.set&&x.wh.on&&x.wh.off,x.wh);
 check('31. out in the pasture, Take along makes it follow (the card says so) and lets it go',x.eq.chip&&x.eq.comp&&x.eq.loc==='Following you'&&x.eq.off,x.eq);
 check('32. in the barn, Hitch ties it to the free post (the tile reads Hitched) and unhitches it',!!x.hitch.saved&&x.hitch.label==='Hitched'&&x.hitch.after===null,x.hitch);
 check('33. a foal\'s gold button follows (Follow me, then Following) and lets go; an egg has only Favourite, Sheet and Family tree, and Warm egg',
  x.foal.pri0==='Follow me'&&x.foal.comp&&x.foal.pri1==='Following'&&x.foal.off&&JSON.stringify(x.egg.chips)===JSON.stringify(['act:fav','act:sheet','act:tree'])&&x.egg.pri==='Warm egg',{foal:x.foal,egg:x.egg});
 check('34. the last mastery node\'s popover keeps its width (not a narrow column) inside the column; Escape closes it first',x.pop.shown&&x.pop.w>=150&&x.pop.h<=80&&x.pop.inside&&/Mastery/.test(x.pop.text||'')&&x.pop.escGone,x.pop);
 check('35. Get Horse on a story breed explains it in a sentence, with a way to My Journey',x.story.modal==='info'&&/is earned in the story/.test(x.story.text)&&x.story.journey,x.story);
 check('36. a 14-letter name fits its card and the panel title with no ellipsis; the foot summary is whole with the panel open',x.names.cardFits&&x.names.titleFits&&x.names.card==='Moonlight Star'&&(x.sum.tight||x.sum.fits),{names:x.names,sum:x.sum});
 check('37. a barn stall opens that horse once; opening the panel again later does not bring the old stall horse back',x.stall.first&&x.stall.again.on&&!x.stall.again.drawer&&x.stall.again.sel===null,x.stall);
 check('39. the Care button on a needy horse opens the Overview\'s feeding tab, and its Back comes back on that horse',x.care.btn&&x.care.ov&&!x.care.on&&x.care.back&&x.care.tab==='feeding',x.care);
 check('40. Pets: Follow makes the pet follow and the sheet says Following; a second tap lets it go',x.pets.btn&&x.pets.active==='dog'&&x.pets.following&&x.pets.modal==='pets'&&x.pets.after!=='dog',x.pets);
 check('41. Get Horse on a season breed offers the Season Pass, which closes this screen and opens the quest panel',x.season.modal==='info'&&x.season.btn&&!x.season.on&&x.season.quest==='flex',x.season);
 check('25c. no emoji in what we draw (tiles, popover, story sheet, pets)',x.emoji.length===0&&x.emojiPets.length===0,{emoji:x.emoji,pets:x.emojiPets});
 /* Breed Studio opens in a new tab */
 await page.evaluate(()=>window.__qh.open()); await page.waitForTimeout(250);
 const [studioTab]=await Promise.all([page.waitForEvent('popup',{timeout:8000}).catch(()=>null),page.click('#seHs .shs-foot [data-shs="studio"]').catch(()=>null)]);
 const studioUrl=studioTab?studioTab.url():null; if(studioTab)await studioTab.close().catch(()=>{});
 check('42. Breed Studio opens the studio page in a new tab',!!studioUrl&&/breeds\.html/.test(studioUrl),studioUrl);
 await page.evaluate(()=>window.__qh.G.hidePanels()); await page.waitForTimeout(250);

 /* ---------------- 38: arrow keys after a click, then Enter presses the panel's gold button ---------------- */
 await page.evaluate(()=>window.__qh.open()); await page.waitForTimeout(250);
 const kc=await page.evaluate(()=>{const c=[...document.querySelectorAll('.shs-sec[data-breed="bay"] .shs-card[data-hid]')];c[0].scrollIntoView({block:'center'});return c.slice(0,2).map(e=>+e.dataset.hid);});
 await page.waitForTimeout(200);
 await page.click('.shs-sec[data-breed="bay"] .shs-card[data-hid="'+kc[0]+'"]'); await page.waitForTimeout(300);
 await page.keyboard.press('ArrowRight'); await page.waitForTimeout(300);
 const k1=await page.evaluate(()=>({sel:window.__qh.st().sel,pri:(document.querySelector('#shsDr [data-shs="primary"]')||{}).textContent,focusIn:document.getElementById('seHs').contains(document.activeElement)}));
 await page.keyboard.press('Enter'); await page.waitForTimeout(900);
 const k2=await page.evaluate(()=>({riding:window.__qh.sv().ridingHorseId,on:window.__qh.st().on}));
 check('38. after a click, ArrowRight moves to the next horse and gives up the focus, so Enter presses its gold Ride',k1.sel===kc[1]&&k1.pri==='Ride'&&!k1.focusIn&&k2.riding===kc[1]&&!k2.on,{kc,k1,k2});

 /* ---------------- 19-26 ---------------- */
 await page.evaluate(()=>window.__qh.open()); await page.waitForTimeout(200);
 await page.click('#seHs [data-shs="search"]'); await page.waitForTimeout(150);
 await page.fill('#shsQ','Map'); await page.waitForTimeout(250);
 const g=await page.evaluate(async()=>{
  const {$,wait,until,vis,st,G,sv,esc,key}=window.__qh, out={};
  const shownCards=[...document.querySelectorAll('#seHs .shs-card[data-hid]')].map(c=>c.dataset.hid);
  const want=sv().horses.filter(h=>(h.name+' '+G.horse.breedLabel(h.breed)+' '+(G.horse.roster.variantLabel(h)||'')).toLowerCase().includes('map')).map(h=>String(h.id));
  out.search={shown:shownCards,want,fav:!!document.querySelector('.shs-sec.fav'),get:document.querySelectorAll('.shs-card.get').length,q:st().search};
  esc(); await wait(250); out.search.after={q:st().search,on:st().on};
  const c=document.querySelector('.shs-sec[data-breed] .shs-card[data-hid]'); c.click(); await wait(250); out.esc={drawer:st().drawer};
  esc(); await wait(250); out.esc.drawerAfter=st().drawer; out.esc.on1=st().on;
  esc(); await wait(300); out.esc.on2=st().on; out.esc.panel=$('stablePanel').style.display;
  /* 20. keys do not move the horse; N toggles */
  await window.__qh.open();
  const t0=Date.now(); while(Date.now()-t0<500){window.dispatchEvent(new KeyboardEvent('keydown',{code:'ArrowUp',key:'ArrowUp',bubbles:true,repeat:Date.now()-t0>30}));await wait(40);}
  window.dispatchEvent(new KeyboardEvent('keyup',{code:'ArrowUp',key:'ArrowUp',bubbles:true}));
  out.keys={speed:G.horse.player.speed,on:st().on};
  key('KeyN','n'); await wait(300); out.keys.n1=st().on;
  key('KeyN','n'); await wait(400); out.keys.n2=st().on;
  /* 21. a course start closes it */
  G.course.startCourse(G.tables.EVENTS3[0],1); await wait(400);
  out.course={on:st().on,panel:$('stablePanel').style.display};
  try{G.course.cancelCourse();}catch(e){} await until(()=>!G.course.get(),3000); await wait(300);
  /* 22. another menu */
  await window.__qh.open(); $('eventsBtn').click(); await wait(400);
  out.other={on:st().on,ev:G.seEvents.state.on}; G.hidePanels(); await wait(250);
  /* 23. a barn stall's E: open, then outline the row, in one go */
  G.hidePanels(); G.ui.openStable();
  const ev=document.querySelector('#stablePanel [data-fx="ranch:tack:2"]').closest('.evrow'); ev.style.outline='2px solid #77905b';
  await until(()=>st().drawer&&st().sel===sv().horses[2].id,500);
  out.stall={drawer:st().drawer,sel:st().sel,want:sv().horses[2].id};
  out.emojiDrawer=window.__qh.emoji();
  G.hidePanels(); await wait(250);
  /* 24. the story-reward note */
  G.hidePanels(); G.ui.renderStable(); $('stablePanel').style.display='flex';
  const n=document.createElement('p'); n.textContent='Kestrel is earned as a story reward.'; n.setAttribute('role','status'); $('stablePanel').prepend(n);
  await until(()=>{const x=document.querySelector('#seHs .shs-note');return x&&/story reward/.test(x.textContent);},500);
  out.note=(document.querySelector('#seHs .shs-note')||{}).textContent||'';
  out.emojiNote=window.__qh.emoji();
  /* 26. the dim */
  const cs=getComputedStyle(document.querySelector('#seHs .shs-dim')), bg=cs.backgroundColor.match(/[\d.]+/g)||[], bf=cs.backdropFilter||cs.webkitBackdropFilter||'';
  out.dim={alpha:+(bg[3]==null?1:bg[3]),filter:bf};
  return out;
 });
 await page.screenshot({path:path.join(OUT,'desk-note.png')});
 await page.evaluate(()=>window.__qh.G.hidePanels());
 check('19. search shows only matching horses (no favourites, no Get Horse); Escape clears it, then closes the drawer, then the screen and the panel',
  JSON.stringify(g.search.shown.slice().sort())===JSON.stringify(g.search.want.slice().sort())&&g.search.want.length>0&&!g.search.fav&&g.search.get===0&&g.search.q==='Map'&&g.search.after.q===''&&g.search.after.on&&g.esc.drawer&&!g.esc.drawerAfter&&g.esc.on1&&!g.esc.on2&&g.esc.panel==='none',{search:g.search,esc:g.esc});
 check('20. the arrow keys do not walk the horse behind the screen; N closes it and N opens it again',g.keys.speed===0&&g.keys.on&&!g.keys.n1&&g.keys.n2,g.keys);
 check('21. a course start closes the screen and the stable panel',!g.course.on&&g.course.panel==='none',g.course);
 check('22. another menu opening closes it (the Events screen comes up)',!g.other.on&&g.other.ev,g.other);
 check('23. a barn stall\'s highlighted row opens the drawer on that horse',g.stall.drawer&&g.stall.sel===g.stall.want,g.stall);
 check('24. a story-reward note on the panel shows as a notice',/story reward/.test(g.note),g.note);
 check('25b. no emoji in what we draw (drawer open, a sheet open, the notice up)',g.emojiDrawer.length===0&&f.emojiModal.length===0&&g.emojiNote.length===0,{drawer:g.emojiDrawer,modal:f.emojiModal,note:g.emojiNote});
 check('26. the dim is at least as strong as the contrast table needs',g.dim.alpha>=0.45&&/brightness\(0\.74\)/.test(g.dim.filter),g.dim);
 check('27. no page errors or console errors (desktop)',errors.length===0,errors.slice(0,5));

 /* ---------------- a touch phone, 390x844 ---------------- */
 const phErr=[];
 const ph=await (await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true})).newPage();
 ph.on('pageerror',e=>phErr.push('PHONE PAGEERROR '+e.message)); ph.on('console',m=>{if(m.type()==='error')phErr.push('PHONE '+m.text());});
 ph.on('dialog',d=>{d.dismiss().catch(()=>{});});
 await BOOT(ph,QA.BASE+'/ranch3d.html?qa=se-horses-phone&fresh='+Date.now());
 await ph.tap('#seMenuBtn'); await ph.waitForTimeout(350);
 await ph.tap('#seMenu .se-tiles>[data-sem-main="horses"]'); await ph.waitForTimeout(600);
 const p1=await ph.evaluate(async()=>{
  const {$,wait,until,R,st,G,sv}=window.__qh, out={};
  out.on=st().on;
  const strip=$('seHs').querySelector('.se-strip'), tb=strip.querySelector('.se-ttl-b'), coin=strip.querySelector('[data-se-pill="coins"]'), cb=coin.querySelector('b');
  out.title={t:tb.textContent,fits:tb.scrollWidth<=tb.clientWidth+1,right:Math.round(tb.getBoundingClientRect().right),coin:Math.round(coin.getBoundingClientRect().left),count:cb.scrollWidth<=cb.clientWidth+1};
  G.save.sync(s=>{for(const k of ['bay','bay','black','aether','pegasus','unicorn'])G.horse.grantHorse(s,k,{src:'qa'});}); G.horse.reloadHorses();
  await until(()=>st().cards>=7,1500); await wait(300);
  const cs=[...document.querySelectorAll('#seHs .shs-sec[data-breed="bay"] .shs-card')].slice(0,3).map(c=>c.getBoundingClientRect()), colR=$('shsCol').getBoundingClientRect();
  out.grid={tops:cs.map(r=>Math.round(r.top)),ws:cs.map(r=>+r.width.toFixed(1)),col:[Math.round(colR.left),Math.round(colR.right)],over:document.documentElement.scrollWidth<=innerWidth};
  const tr=document.querySelector('.shs-sec[data-breed] .shs-track'), nodes=[...tr.querySelectorAll('.shs-node,.shs-shield')].map(n=>n.getBoundingClientRect().right);
  out.track={last:Math.round(Math.max(...nodes)),col:Math.round(colR.right)};
  return out;
 });
 await ph.tap('.shs-sec[data-breed="bay"] .shs-card[data-hid]'); await ph.waitForTimeout(500);
 await ph.screenshot({path:path.join(OUT,'phone-sheet.png')});
 const p2=await ph.evaluate(async()=>{
  const {$,wait,until,R,st,G}=window.__qh, out={};
  const dr=$('shsDr').getBoundingClientRect();
  out.sheet={drawer:st().drawer,bottom:Math.round(dr.bottom),top:Math.round(dr.top),ih:innerHeight,
   small:[...document.querySelectorAll('#shsDr .shs-chip,#shsDr .shs-dr-foot button')].map(b=>b.getBoundingClientRect()).filter(r=>r.width<44||r.height<44).map(r=>[Math.round(r.width),Math.round(r.height)])};
  G.toast('Test note'); await wait(400);
  out.toastSheet=Math.round($('toasts').getBoundingClientRect().top);
  return out;
 });
 await ph.tap('#seHs .shs-sheetdim',{position:{x:195,y:100}}); await ph.waitForTimeout(400);
 const p3=await ph.evaluate(async()=>{
  const {$,wait,until,R,st,G}=window.__qh, out={};
  out.closed=!st().drawer;
  const root=$('seHs'), foot=$('shsFoot').getBoundingClientRect();
  out.foot={tight:root.classList.contains('tight'),hero:!!R(root.querySelector('.shs-hero')),more:!!R(root.querySelector('[data-shs="more"]')),sum:!!R(root.querySelector('.shs-sum')),
   heroH:Math.round((root.querySelector('.shs-hero')||{getBoundingClientRect:()=>({height:0})}).getBoundingClientRect().height)};
  out.toast=Math.round($('toasts').getBoundingClientRect().bottom); out.footTop=Math.round(foot.top);
  root.querySelector('[data-shs="more"]').click(); await wait(300);
  const m=$('shsModal'); out.more={open:st().modal==='more',rows:['pets','classic','studio'].every(k=>!!m.querySelector('[data-shs="'+k+'"]')),bottom:Math.round(m.getBoundingClientRect().bottom)};
  out.emoji=window.__qh.emoji();
  /* a toast while the sheet is up goes to the top, off its rows */
  G.toast('A note over the More sheet');   // toasts queue one at a time: whichever is showing is measured
  const showing=()=>[...document.querySelectorAll('#toasts>*')].find(t=>{const r=t.getBoundingClientRect();return r.height>4&&getComputedStyle(t).display!=='none';});
  await until(()=>!!showing(),12000); await wait(300);
  const tr=showing(), trr=tr&&tr.getBoundingClientRect(), mr=m.getBoundingClientRect(), tcs=getComputedStyle($('toasts'));
  out.toastModal={cls:document.body.classList.contains('shs-msheet'),top:Math.round(parseFloat(tcs.top)),seen:!!trr,bottom:trr&&Math.round(trr.bottom),modalTop:Math.round(mr.top),text:tr&&tr.textContent.slice(0,40)};
  out.toastModal.clear=out.toastModal.cls&&out.toastModal.top<0.25*innerHeight&&(!trr||trr.bottom<=mr.top+1);
  window.__qh.esc(); await wait(200);
  /* a very big purse: the title steps down, and never shows an ellipsis */
  const tb=$('seHs').querySelector('.se-ttl-b');
  out.purse=[];
  for(const [c,g] of [[150000,2500],[1234567,98765],[99999999,999999]]){G.save.sync(s=>{s.coins=c;s.gems=g;});G.run('wallet',G.save.fresh());await wait(200);
   const svg=root.querySelector('.se-strip .se-ttl>svg');out.purse.push({c,g,fits:tb.scrollWidth<=tb.clientWidth+1,text:tb.getClientRects().length>0,icon:!!svg&&getComputedStyle(svg).display!=='none',cls:['tt','tt2','tt3'].filter(k=>root.classList.contains(k)).join(' ')});}
  G.save.sync(s=>{s.coins=325;s.gems=7;});G.run('wallet',G.save.fresh());
  return out;
 });
 await ph.screenshot({path:path.join(OUT,'phone-list.png')});
 check('phone 1. the ☰ tile opens the screen',p1.on,p1.on);
 check('phone 2. the strip title reads "My Horses", fits, and stops before the coin pill, whose count is not clipped',p1.title.t==='My Horses'&&p1.title.fits&&p1.title.right<=p1.title.coin&&p1.title.count,p1.title);
 check('phone 3. three columns of 105-125 px cards on one row inside the column, no sideways scroll',
  Math.max(...p1.grid.tops)-Math.min(...p1.grid.tops)<=1&&Math.max(...p1.grid.ws)-Math.min(...p1.grid.ws)<=1&&p1.grid.ws.every(w=>w>=105&&w<=125)&&p1.grid.col[0]>=10&&p1.grid.col[1]<=380&&p1.grid.over,p1.grid);
 check('phone 4. the mastery track fits the column',p1.track.last<=p1.track.col+1,p1.track);
 check('phone 5. a card opens a bottom sheet (to the bottom, under 85% tall) with every tile and both buttons at least 44x44; the dim closes it',
  p2.sheet.drawer&&Math.abs(p2.sheet.bottom-p2.sheet.ih)<=1&&p2.sheet.top>=0.15*p2.sheet.ih&&p2.sheet.small.length===0&&p3.closed,{sheet:p2.sheet,closed:p3.closed});
 check('phone 6. the foot is tight: the hero and More, no summary; More opens a sheet with Pets, Full list and Breed Studio',p3.foot.tight&&p3.foot.hero&&p3.foot.more&&!p3.foot.sum&&p3.foot.heroH>=44&&p3.more.open&&p3.more.rows,{foot:p3.foot,more:p3.more});
 check('phone 7. toasts sit above the foot, and at the top while the sheet is open',p3.toast<=p3.footTop&&p2.toastSheet<0.25*844,{toast:p3.toast,footTop:p3.footTop,sheetTop:p2.toastSheet});
 check('phone 7b. a toast while the More sheet is up sits above the sheet, not on its rows',p3.toastModal.clear,p3.toastModal);
 check('phone 2b. with a very big purse the title steps down (then the barn alone) and never shows an ellipsis',p3.purse.every(p=>p.fits&&(p.text||p.icon)),p3.purse);
 check('phone: no emoji in what we draw',p3.emoji.length===0,p3.emoji);
 check('phone 8. no page errors',phErr.length===0,phErr.slice(0,5));

 /* ---------------- a landscape phone, 844x390 ---------------- */
 const lsErr=[];
 const ls=await (await browser.newContext({viewport:{width:844,height:390},hasTouch:true,isMobile:true})).newPage();
 ls.on('pageerror',e=>lsErr.push('LAND PAGEERROR '+e.message)); ls.on('console',m=>{if(m.type()==='error')lsErr.push('LAND '+m.text());});
 ls.on('dialog',d=>{d.dismiss().catch(()=>{});});
 await BOOT(ls,QA.BASE+'/ranch3d.html?qa=se-horses-land&fresh='+Date.now());
 const l=await ls.evaluate(async()=>{
  const {$,wait,until,R,st,G,sv}=window.__qh, out={};
  G.save.sync(s=>{for(const k of ['bay','black','unicorn'])G.horse.grantHorse(s,k,{src:'qa'});}); G.horse.reloadHorses();
  await window.__qh.open(); await wait(200);
  document.querySelector('.shs-sec[data-breed="bay"] .shs-card[data-hid]').click(); await wait(500);
  const pri=$('shsDr').querySelector('[data-shs="primary"]').getBoundingClientRect(), pic=$('shsDr').querySelector('.shs-dr-pic').getBoundingClientRect();
  Object.assign(out,{on:st().on,drawer:st().drawer,priBottom:Math.round(pri.bottom),picH:Math.round(pic.height),ih:innerHeight,tight:$('seHs').classList.contains('tight'),over:document.documentElement.scrollWidth<=innerWidth,mainH:$('shsMain').clientHeight});
  const body=$('shsDr').querySelector('.shs-dr-body').getBoundingClientRect(), chips=[...$('shsDr').querySelectorAll('.shs-chip')].map(c=>c.getBoundingClientRect()), dw=$('shsDr').getBoundingClientRect().width;
  out.tiles={firstRow:chips.length?Math.round(chips[0].bottom):null,bodyBottom:Math.round(body.bottom),picW:Math.round(pic.width),dw:Math.round(dw),picTop:Math.round(pic.top),lineTop:Math.round(($('shsDr').querySelector('.shs-line')||pic).getBoundingClientRect().top)};
  return out;
 });
 await ls.screenshot({path:path.join(OUT,'land-drawer.png')});
 check('landscape 1. the drawer\'s gold button is on screen and its picture under 45% of the height',l.on&&l.drawer&&l.priBottom<=l.ih&&l.picH<=0.45*l.ih,l);
 check('landscape 2. the foot is tight',l.tight,l.tight);
 check('landscape 3. no sideways scroll',l.over,l.over);
 check('landscape 4. the list keeps more than 150 px of height',l.mainH>150,l.mainH);
 check('landscape 5. the panel puts the picture beside the facts, and the first row of tiles shows without scrolling',l.tiles.picW<l.tiles.dw*0.5&&Math.abs(l.tiles.lineTop-l.tiles.picTop)<24&&l.tiles.firstRow!=null&&l.tiles.firstRow<=l.tiles.bodyBottom+1,l.tiles);
 check('landscape: no page errors',lsErr.length===0,lsErr.slice(0,5));

 const bad=checks.filter(c=>!c.ok).length;
 console.log(bad?('FAILED '+bad+'/'+checks.length):('passed '+checks.length+'/'+checks.length));
 await browser.close(); process.exit(bad?1:0);
})().catch(async e=>{console.error(e);try{if(browser)await browser.close();}catch(x){}process.exit(2);});

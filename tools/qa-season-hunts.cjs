/* season-hunts package check.
   Boots ranch3d.html?qa=season-hunts four times — once per season — and drives the package the
   way a player would: rides onto a hidden egg and checks the wallet, sweeps a whole hunt and
   checks the set bonus, finds a stray on the bounty board, settles her, leads her to the post
   and takes the money, and watches the wild coats swap over when the season turns.

   There is no ?season= override and one cannot be added without an inline edit (seasonNow is a
   module-scope function declaration consulted at ten inline call sites), so the season is chosen
   by freezing Date.now in an init script before the page loads. SEASON_EPOCH is 2026-01-05 and a
   season is 28 days, so season n starts at EPOCH + n*28 days and SEASONS[n%4] is
   bloom / sun / ember / frost.

   Usage:  QA_URL=http://127.0.0.1:8512 NODE_PATH=$(npm root -g) node tools/qa-season-hunts.cjs
   Server: python3 qa/serve-fallback.py <worktree> <main clone> 8512 */
const {chromium}=require('playwright');
const QA=require('./qa-platform.cjs');   // the backend comes from the platform, never baked in
const base=(process.env.QA_URL||'http://127.0.0.1:8512').replace(/\/$/,'');
const EPOCH=Date.UTC(2026,0,5), DAY=864e5;
const seasonAt=(n,day)=>EPOCH+n*28*DAY+((day||10)-1)*DAY+3600e3;
const SEASONS={bloom:12,sun:13,ember:14,frost:15};          // n%4 === 0,1,2,3
const checks=[];
function check(name,ok,detail){checks.push({name,ok:!!ok,detail});console.log((ok?'PASS ':'FAIL ')+name+(detail!==undefined?' — '+JSON.stringify(detail):''));}
const t0=Date.now();
const stage=s=>console.log('… '+s+' @'+((Date.now()-t0)/1000).toFixed(1)+'s');
let browser=null;
setTimeout(async()=>{console.error('WATCHDOG: no result after 600 s');try{if(browser)await browser.close();}catch(e){}process.exit(3);},600000).unref();

const READY=()=>window.render_game_to_text&&(()=>{try{const s=JSON.parse(render_game_to_text());return s.graphics&&s.graphics.horseReady&&!s.graphics.horseLoading;}catch(e){return false;}})();

async function open(season,errors){
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 page.on('pageerror',e=>errors.push(season+' PAGEERROR '+e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(season+' '+m.text());});
 page.on('dialog',d=>{d.dismiss().catch(()=>{});});
 await page.addInitScript(t=>{Date.now=()=>t;},seasonAt(SEASONS[season],10));
 await page.goto(base+'/ranch3d.html?qa=season-hunts&fresh='+Date.now(),{waitUntil:'load',timeout:120000});
 await page.waitForFunction(READY,null,{timeout:150000,polling:250});
 /* Every region open: world.js's soft boundary carries you back out of a locked region within a
    quarter of a second, and three of the eight hunt zones sit inside one. */
 await page.evaluate(()=>{const G=window.__features;G.save.sync(s=>{s.unlocked=s.unlocked||{};for(const rg of G.tables.REGIONS)if(rg.id)s.unlocked[rg.id]=Date.now();});});
 return page;
}
const travel=(page,x,z)=>page.evaluate(([x,z])=>{const p=window.__features.horse.player;p.pos.set(x,0,z);p.speed=0;p.y=0;},[x,z]);
const step=(page,ms)=>page.evaluate(m=>advanceTime(m),ms);
const wallet=page=>page.evaluate(()=>{const s=window.__features.save.fresh();return {c:s.coins,g:s.gems,k:s.keys||0,tok:(s.tokens&&s.tokens.n)||0};});

(async()=>{
 browser=await chromium.launch({headless:true,args:['--disable-background-timer-throttling',QA.ANGLE,'--enable-gpu-rasterization','--ignore-gpu-blocklist']});
 const errors=[];

 /* ============================ 1. bloom: the egg hunt, and the bounty ============================ */
 stage('bloom: launch');
 let page=await open('bloom',errors);
 stage('bloom: ready');
 const boot=await page.evaluate(()=>{
  const G=window.__features,W=G.world,P=G.hunts;
  return {installed:G.installed.indexOf('season-hunts')>=0,errors:G.errors,hasHunts:!!P,
   season:G.time.seasonNow().def.id,live:P.live(),seed:P.seedOf('egg'),
   expectSeed:'egg|'+G.time.seasonNow().key+'|'+G.time.isoWeekKey(),
   board:W.things.filter(t=>t.kind==='bountyboard').length,
   huntPins:W.mapMarkers.filter(m=>m.kind==='hunt').length,
   miniSparks:W.miniMarkers.filter(m=>m.col==='#f2a0c8').length};
 });
 check('package installs with no error',boot.installed&&boot.errors.length===0,boot.errors);
 check('G.hunts is exported',boot.hasHunts);
 check('stubbed clock lands in the bloom season',boot.season==='bloom',boot.season);
 check('only the bloom hunt is live',boot.live.length===1&&boot.live[0]==='egg',boot.live);
 check('the week seed is season+ISO week',boot.seed===boot.expectSeed,[boot.seed,boot.expectSeed]);

 const eggs=await page.evaluate(()=>{
  const G=window.__features,W=G.world,items=G.hunts.items('egg');
  return items.map(i=>({i:i.i,zone:i.zone,x:Math.round(i.x),z:Math.round(i.z),
   float:+(i.g.position.y-W.groundH(i.x,i.z)).toFixed(2),
   river:+Math.abs(i.z-W.riverZ(i.x)).toFixed(1),
   inColl:W.colliders.some(c=>Math.hypot(c.x-i.x,c.z-i.z)<(c.r||1)+1.2),
   r:Math.round(Math.hypot(i.x,i.z))}));
 });
 check('twelve eggs are hidden in the world',eggs.length===12,eggs.length);
 check('every egg sits on the ground (no floating, no sinking)',eggs.every(e=>Math.abs(e.float)<0.35),eggs.map(e=>e.float));
 check('no egg is in the river',eggs.every(e=>e.river>=11),eggs.map(e=>e.river).filter(v=>v<11));
 check('no egg is inside a collider',eggs.every(e=>!e.inColl));
 check('every egg is inside the rideable basin',eggs.every(e=>e.r<=428),eggs.map(e=>e.r).filter(v=>v>428));
 const quarters=['amberwood','willowmere','frostpine','ochre'];
 check('the hunt reaches all four new quarters',quarters.every(q=>eggs.some(e=>e.zone===q)),eggs.map(e=>e.zone));
 check('a map pin marks each quarter that still holds something',boot.huntPins>=8,boot.huntPins);
 check('minimap sparks exist for the live hunt',boot.miniSparks===12,boot.miniSparks);

 const reseeded=await page.evaluate(()=>{const P=window.__features.hunts;
  const before=P.items('egg').map(i=>Math.round(i.x)+','+Math.round(i.z));
  P.reseed();
  return {before,after:P.items('egg').map(i=>Math.round(i.x)+','+Math.round(i.z))};});
 check('the same week re-lays the hunt in the same twelve places',reseeded.before.join('|')===reseeded.after.join('|'),
  reseeded.before.filter((v,i)=>v!==reseeded.after[i]));

 stage('bloom: pick one up');
 const w0=await wallet(page);
 const first=await page.evaluate(()=>{const i=window.__features.hunts.items('egg')[0];return [i.x,i.z];});
 await travel(page,first[0],first[1]);
 await step(page,600);
 const w1=await wallet(page);
 const after1=await page.evaluate(()=>{const s=window.__features.save.fresh();
  return {got:(s.hunt.got.egg||[]).length,life:(s.life&&s.life.hunt)||0,hidden:!window.__features.hunts.items('egg')[0].g.visible};});
 check('riding onto an egg picks it up',after1.got===1&&after1.hidden,after1);
 check('the egg pays 40 coins',w1.c-w0.c===40,[w0.c,w1.c]);
 check('the egg pays 5 season tokens — the faucet the season store was missing',w1.tok-w0.tok===5,[w0.tok,w1.tok]);
 check('the find is tallied for the daily and the club board',after1.life===1,after1.life);

 stage('bloom: the bounty board');
 const bs=await page.evaluate(()=>{const G=window.__features,P=G.hunts;
  return {n:P.bounties().length,names:P.bounties().map(b=>b.name),
   pins:G.world.mapMarkers.filter(m=>m.kind==='bounty'&&!m.hidden()).length,
   post:P.post(),postThing:G.world.things.some(t=>t.kind==='bountyboard'),
   zones:P.bounties().map(b=>b.zone.id),
   rough:P.bounties().map(b=>Math.round(Math.hypot(b.mark.x-b.pos.x,b.mark.z-b.pos.z)))};});
 check('three horses are loose on the board',bs.n===3,bs.n);
 check('no two strays share a name',new Set(bs.names).size===3,bs.names);
 check('every stray has strayed out of the home basin',bs.zones.every(z=>z!=='core'),bs.zones);
 check('each stray has a map pin',bs.pins===3,bs.pins);
 check('the pin is a guess until you get near — forty to seventy metres out',bs.rough.every(v=>v>=39&&v<=71),bs.rough);
 check('the bounty board stands in the world as a thing you press E at',bs.postThing&&boot.board===1,[bs.postThing,boot.board]);
 const boardTxt=await page.evaluate(()=>{window.__features.hunts.openBoard();const d=document.getElementById('dlg');const t=d.innerText;d.style.display='none';return t;});
 check('the board names each stray, its region and its reward',bs.names.every(n=>boardTxt.indexOf(n)>=0)&&/pays/.test(boardTxt),boardTxt.slice(0,120));

 stage('bloom: track and catch a stray');
 let bpos=await page.evaluate(()=>{const b=window.__features.hunts.bounties()[0];return [b.pos.x,b.pos.z];});
 await travel(page,bpos[0]+140,bpos[1]);            // ride in from 140 m: the sign should appear, the pin should sharpen
 await step(page,400);
 const far=await page.evaluate(()=>{const b=window.__features.hunts.bounties()[0];
  return {found:!!b.found,sign:!!(b.sign&&b.sign.visible),prints:b.sign?b.sign.children.length:0,
   pinOff:Math.round(Math.hypot(b.mark.x-b.pos.x,b.mark.z-b.pos.z))};});
 check('hoofprints are laid on the ground when you get within tracking range',far.sign&&far.prints===5,far);
 check('the map pin is still a guess at 140 m',!far.found&&far.pinOff>5,far);
 for(let i=0;i<14;i++){
  bpos=await page.evaluate(()=>{const b=window.__features.hunts.bounties()[0];return [b.pos.x,b.pos.z];});
  await travel(page,bpos[0]+1.5,bpos[1]);
  await step(page,500);
 }
 const caught=await page.evaluate(()=>{const b=window.__features.hunts.bounties()[0];
  return {settle:Math.round(b.settle),haltered:!!b.haltered,found:!!b.found,tracked:!!b.tracked,
   pinOff:Math.round(Math.hypot(b.mark.x-b.pos.x,b.mark.z-b.pos.z)),name:b.name,
   thing:window.__features.world.things.some(t=>t.kind==='bounty')};});
 check('standing quiet beside a stray settles her and gets a halter on',caught.haltered,caught);
 check('the map pin snaps to her real position once you are close',caught.found&&caught.pinOff<=1,caught);
 check('she is a thing in the world you can press E at',caught.thing);

 stage('bloom: lead her home');
 const followed=await page.evaluate(async()=>{
  const G=window.__features,b=G.hunts.bounties()[0],p=G.horse.player;
  const d0=Math.hypot(b.pos.x-p.pos.x,b.pos.z-p.pos.z);
  p.pos.set(p.pos.x+30,0,p.pos.z);p.speed=0;
  advanceTime(4000);
  return {d0:+d0.toFixed(1),d1:+Math.hypot(b.pos.x-p.pos.x,b.pos.z-p.pos.z).toFixed(1)};
 });
 check('a haltered stray follows you instead of standing there',followed.d1<12,followed);
 const w3=await wallet(page);
 const pay=await page.evaluate(()=>{
  const G=window.__features,b=G.hunts.bounties()[0],P=G.hunts.post(),p=G.horse.player;
  p.pos.set(P.x+3,0,P.z+3);p.speed=0;b.pos.set(P.x+6,0,P.z+6);
  advanceTime(400);
  const shown=document.getElementById('dlg').style.display==='block'&&!!document.getElementById('huntPay');
  const expect=Object.assign({},b.pay), name=b.name, sid='stray_'+b.i;
  if(document.getElementById('huntPay'))document.getElementById('huntPay').click();
  return {shown,expect,name,sid};
 });
 check('leading her to the post offers the hand-over',pay.shown,pay);
 const w4=await wallet(page);
 const paid=await page.evaluate(()=>{const G=window.__features,s=G.save.fresh();
  return {done:s.bounty.done.length,home:s.bounty.home,life:(s.life&&s.life.bounty)||0,
   pins:G.world.mapMarkers.filter(m=>m.kind==='bounty'&&!m.hidden()).length,
   open:G.hunts.bounties().length,
   hers:G.world.things.filter(t=>t.kind==='bounty'&&t.bounty&&t.bounty.done).length};});
 check('handing a stray over pays the board reward',w4.c-w3.c===pay.expect.c&&w4.tok-w3.tok===pay.expect.tok,[w3,w4,pay.expect]);
 check('the save records the stray as brought in',paid.done===1&&paid.home===1&&paid.life===1,paid);
 check('her map pin and her body leave the world',paid.pins===2&&paid.open===2&&paid.hers===0,paid);

 stage('bloom: sweep the rest');
 const wS=await wallet(page);                 // the bounty payout landed in between, so re-baseline
 for(let i=1;i<12;i++){
  const at=await page.evaluate(k=>{const it=window.__features.hunts.items('egg')[k];return [it.x,it.z];},i);
  await travel(page,at[0],at[1]);
  await step(page,260);
 }
 const w2=await wallet(page);
 const swept=await page.evaluate(()=>{const s=window.__features.save.fresh();
  return {got:(s.hunt.got.egg||[]).length,done:!!s.hunt.done.egg,sets:s.hunt.sets,
   left:window.__features.hunts.items('egg').filter(i=>!i.got).length,
   pinsLeft:window.__features.world.mapMarkers.filter(m=>m.kind==='hunt'&&m.hunt==='egg'&&!m.hidden()).length};});
 check('all twelve can be found',swept.got===12&&swept.left===0,swept);
 check('the full set pays its bonus once',swept.done&&swept.sets===1,swept);
 check('the remaining eleven eggs pay 440 coins',w2.c-wS.c===440,[wS.c,w2.c]);
 check('the remaining eleven eggs pay 55 season tokens',w2.tok-wS.tok===55,[wS.tok,w2.tok]);
 check('the ladder and the set bonus pay gems (1 at eight + 2 for the set)',w2.g-wS.g===3,[wS.g,w2.g]);
 check('the ladder and the set bonus pay keys (1 at four + 1 for the set)',w2.k-wS.k===2,[wS.k,w2.k]);
 check('a swept quarter drops its map pin',swept.pinsLeft===0,swept.pinsLeft);

 const panel=await page.evaluate(()=>{const G=window.__features;G.ui.openQuests();
  const tab=document.querySelector('#questPanel [data-q="tab:hunts"]');
  if(tab)tab.click();
  return {tabs:[...document.querySelectorAll('#questPanel [data-q^="tab:"]')].map(b=>b.dataset.q.slice(4)),
   txt:document.getElementById('questPanel').innerText};});
 check('a Hunts tab is registered on the Quests panel',panel.tabs.indexOf('hunts')>=0,panel.tabs);
 check('the Hunts tab names this season\'s hunt, the board and the wild coats',
  /Blossom Egg Hunt/.test(panel.txt)&&/Bounty board/.test(panel.txt)&&/Blossom Pinto/.test(panel.txt),panel.txt.slice(0,200));
 /* Draw the world map for real: it is the only thing that calls every marker's hidden(save),
    and a marker that throws there takes the whole map down. */
 await page.keyboard.press('KeyM');
 await page.waitForTimeout(300);
 const map=await page.evaluate(()=>{const w=document.getElementById('bigmapWrap');
  const px=document.getElementById('bigmap').getContext('2d').getImageData(0,0,560,560).data;
  let ink=0;for(let i=3;i<px.length;i+=4000)if(px[i])ink++;
  return {open:w.style.display==='flex',ink};});
 await page.keyboard.press('KeyM');
 check('the world map draws with the hunt and bounty pins on it',map.open&&map.ink>0,map);

 const bloomState=await page.evaluate(()=>JSON.parse(render_game_to_text()).hunt);
 check('render_game_to_text carries o.hunt',!!bloomState&&bloomState.season==='bloom',bloomState&&bloomState.season);
 check('o.hunt reports the live hunt and the locked one',bloomState.live.length===1&&bloomState.locked.indexOf('lantern')>=0,
  {live:bloomState.live.map(h=>h.id),locked:bloomState.locked});
 check('o.hunt reports the bounty board',bloomState.bounty.home===1&&bloomState.bounty.open.length===2,bloomState.bounty);
 const mkt0=await page.evaluate(()=>{const G=window.__features,B=G.tables.BREEDS3;
  const f=k=>B.find(x=>x[0]===k);
  return {pintoMarket:G.horse.breedAvailable(f('pinto'),'market'),pintoShop:G.horse.breedAvailable(f('pinto'),'shop'),
   appMarket:G.horse.breedAvailable(f('appaloosa'),'market'),coats:G.hunts.wildCoats()};});
 check('bloom puts the Blossom Pinto and the Orchard Cream into the wild table',mkt0.coats.join()==='Blossom Pinto,Orchard Cream',mkt0.coats);
 check('a season region coat takes its breed off the auction block',mkt0.pintoMarket===false,mkt0);
 check('…but the shop still sells it, so nobody is blocked',mkt0.pintoShop===true,mkt0);
 check('a breed with no season coat on it is untouched',mkt0.appMarket===true,mkt0);
 await page.close();

 /* ============================ 2. ember: the gated lantern hunt ============================ */
 stage('ember: launch');
 page=await open('ember',errors);
 stage('ember: ready');
 const locked=await page.evaluate(()=>{const G=window.__features,P=G.hunts;
  return {season:G.time.seasonNow().def.id,open:P.isOpen('lantern'),live:P.live(),
   things:G.world.things.filter(t=>t.kind==='hunt-lantern').length,
   status:G.run('specialStatus','lantern'),
   state:JSON.parse(render_game_to_text()).hunt.locked};});
 check('the ember season is up',locked.season==='ember',locked.season);
 check('the lantern hunt starts locked — the questline lights it',locked.open===false&&locked.live.length===0,locked);
 check('nothing is placed while it is locked',locked.things===0,locked.things);
 check('the locked status is what the special-event card shows',/🔒/.test(locked.status||''),locked.status);
 const opened=await page.evaluate(()=>{const G=window.__features,W=G.world;
  const ok=G.hunts.setOpen('lantern',true);
  const items=G.hunts.items('lantern');
  return {ok,n:items.length,things:W.things.filter(t=>t.kind==='hunt-lantern').length,
   float:items.map(i=>+(i.g.position.y-W.groundH(i.x,i.z)).toFixed(2)),
   river:items.map(i=>+Math.abs(i.z-W.riverZ(i.x)).toFixed(1)),
   quarters:['amberwood','willowmere','frostpine','ochre'].every(q=>items.some(i=>i.zone===q)),
   status:G.run('specialStatus','lantern')};});
 check('season-quests can light the lanterns through setOpen',opened.ok&&opened.n===15&&opened.things===15,opened);
 check('every lantern stands on the ground',opened.float.every(v=>Math.abs(v)<0.35),opened.float);
 check('no lantern is in the river',opened.river.every(v=>v>=11),opened.river.filter(v=>v<11));
 check('the lanterns reach all four new quarters too',opened.quarters);
 check('the unlocked status stops saying locked',!/🔒/.test(opened.status||''),opened.status);
 const lw0=await wallet(page);
 for(let i=0;i<15;i++){
  const at=await page.evaluate(k=>{const it=window.__features.hunts.items('lantern')[k];return [it.x,it.z];},i);
  await travel(page,at[0],at[1]);
  await step(page,260);
 }
 const lw1=await wallet(page);
 const lsw=await page.evaluate(()=>{const s=window.__features.save.fresh();return {got:(s.hunt.got.lantern||[]).length,done:!!s.hunt.done.lantern};});
 check('all fifteen lanterns can be gathered',lsw.got===15&&lsw.done,lsw);
 check('fifteen lanterns pay 90 season tokens',lw1.tok-lw0.tok===90,[lw0.tok,lw1.tok]);
 check('fifteen lanterns pay 450 coins',lw1.c-lw0.c===450,[lw0.c,lw1.c]);
 check('the lantern ladder and set pay 4 gems (1 at ten + 3 for the set)',lw1.g-lw0.g===4,[lw0.g,lw1.g]);
 const relocked=await page.evaluate(()=>{const G=window.__features;G.hunts.setOpen('lantern',false);
  return {things:G.world.things.filter(t=>t.kind==='hunt-lantern').length,live:G.hunts.live()};});
 check('closing the festival takes the lanterns out of the world again',relocked.things===0&&relocked.live.length===0,relocked);
 await page.close();

 /* ============================ 3. sun: the honey run and the western coats ============================ */
 stage('sun: launch');
 page=await open('sun',errors);
 stage('sun: ready');
 const sun=await page.evaluate(()=>{const G=window.__features,W=G.world,P=G.hunts,B=G.tables.BREEDS3;
  const f=k=>B.find(x=>x[0]===k);
  const items=P.items('honey');
  return {season:G.time.seasonNow().def.id,live:P.live(),eggs:W.things.filter(t=>t.kind==='hunt-egg').length,
   n:items.length,float:items.map(i=>+(i.g.position.y-W.groundH(i.x,i.z)).toFixed(2)),
   quarters:['amberwood','willowmere','frostpine','ochre'].every(q=>items.some(i=>i.zone===q)),
   coats:P.wildCoats(),
   wild:G.tables.WILD_BREEDS.filter(w=>w.region==='coyote').map(w=>w.variant),
   appMarket:G.horse.breedAvailable(f('appaloosa'),'market'),appShop:G.horse.breedAvailable(f('appaloosa'),'shop'),
   pintoMarket:G.horse.breedAvailable(f('pinto'),'market'),
   herds:(G.worldPkg.WILD_HERDS||[]).length,strays:G.wild.strays,
   wildThings:W.things.filter(t=>t.kind==='wild').length,
   coatMarks:P.coatMarks().filter(c=>c.label).map(c=>c.herd+':'+c.label)};});
 check('the sun season swaps the hunt over to the honey run',sun.season==='sun'&&sun.live.join()==='honey'&&sun.n===14,sun.live);
 check('last season\'s eggs are gone from the world',sun.eggs===0,sun.eggs);
 check('every honey pot stands on the ground',sun.float.every(v=>Math.abs(v)<0.35),sun.float);
 check('the honey run reaches all four new quarters',sun.quarters);
 check('the Long-Sun Dun runs with the canyon herd only in this season',sun.wild.indexOf('Long-Sun Dun')>=0,sun.wild);
 check('bloom\'s coats are gone',sun.coats.indexOf('Blossom Pinto')<0,sun.coats);
 check('the canyon breed is off the auction block while its coat is out',sun.appMarket===false&&sun.appShop===true,sun);
 check('last season\'s market block is lifted',sun.pintoMarket===true,sun.pintoMarket);
 check('a herd carrying a season coat is called out on the big map',sun.coatMarks.length>=1,sun.coatMarks);
 /* world.js already ships the herds, the co-op taming, the sanctuaries, the balloons and the
    ferry — this package only weights the coats, so assert its work is untouched. */
 check('world.js\'s four wild herds are untouched',sun.herds===4,sun.herds);
 check('the old single stray is still retired',sun.strays===false,sun.strays);
 check('the herds are still populated',sun.wildThings>=12,sun.wildThings);
 await page.close();

 /* ============================ 4. frost: the bells and the coat swap ============================ */
 stage('frost: launch');
 page=await open('frost',errors);
 stage('frost: ready');
 const frost=await page.evaluate(()=>{const G=window.__features,W=G.world,P=G.hunts,B=G.tables.BREEDS3;
  const f=k=>B.find(x=>x[0]===k);
  const items=P.items('frostbell');
  return {season:G.time.seasonNow().def.id,live:P.live(),n:items.length,
   float:items.map(i=>+(i.g.position.y-W.groundH(i.x,i.z)).toFixed(2)),
   quarters:['amberwood','willowmere','frostpine','ochre'].every(q=>items.some(i=>i.zone===q)),
   coats:P.wildCoats(),greyMarket:G.horse.breedAvailable(f('grey'),'market'),
   appMarket:G.horse.breedAvailable(f('appaloosa'),'market'),
   honey:W.things.filter(t=>t.kind==='hunt-honey').length,
   starts:(G.run('specialStart','frost'),G.hunts.starts)};});
 check('the frost season rings thirteen bells out',frost.season==='frost'&&frost.live.join()==='frostbell'&&frost.n===13,frost.live);
 check('every frost bell stands on the ground',frost.float.every(v=>Math.abs(v)<0.35),frost.float);
 check('the bells reach all four new quarters',frost.quarters);
 check('the frost coats replace the sun coats',frost.coats.join()==='Rimefall Silver,Frostpine Fjord',frost.coats);
 check('the snowfield breed is off the auction block now instead',frost.greyMarket===false&&frost.appMarket===true,frost);
 check('the honey pots are gone',frost.honey===0,frost.honey);
 check('seasons.js can start this season\'s activity through the specialStart hook',frost.starts>=1,frost.starts);
 await page.close();

 check('no console errors across all four boots',errors.length===0,errors.slice(0,6));
 const failed=checks.filter(c=>!c.ok).length;
 console.log('\n'+(checks.length-failed)+' passed, '+failed+' failed, '+((Date.now()-t0)/1000).toFixed(1)+'s');
 await browser.close();
 process.exit(failed?1:0);
})().catch(async e=>{console.error('FATAL',e);try{if(browser)await browser.close();}catch(x){}process.exit(2);});

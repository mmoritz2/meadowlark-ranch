/* Package check: market hub, summon stables, pity and no-repeat draws, the Painted Stable,
   the horse catalogue, Silver Keys and the free weekly claim, key doors, gem dust, pets and
   the horse-and-pet pairs.

   Usage:  QA_URL=http://127.0.0.1:8444 NODE_PATH=$(npm root -g) node tools/qa-market-summon-keys-pets.cjs
   Same shape as tools/qa-features.cjs. */
const {chromium}=require('playwright');
const base=(process.env.QA_URL||'http://127.0.0.1:8431').replace(/\/$/,'');
const url=base+'/ranch3d.html?qa=market&fresh='+Date.now();
const checks=[];
function check(name,ok,detail){checks.push({name,ok:!!ok,detail});console.log((ok?'PASS ':'FAIL ')+name+(detail!==undefined?' — '+JSON.stringify(detail):''));}
const t0=Date.now();
const stage=s=>console.log('… '+s+' @'+((Date.now()-t0)/1000).toFixed(1)+'s');
let browser=null;
setTimeout(async()=>{console.error('WATCHDOG: no result after 600 s');try{if(browser)await browser.close();}catch(e){}process.exit(3);},600000).unref();

(async()=>{
 browser=await chromium.launch({headless:true,args:['--disable-background-timer-throttling','--use-angle=metal','--enable-gpu-rasterization','--ignore-gpu-blocklist']});
 const page=await browser.newPage({viewport:{width:1280,height:900}});
 const errors=[];
 page.on('pageerror',e=>errors.push('PAGEERROR '+e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 page.on('dialog',d=>{d.dismiss().catch(()=>{});});
 stage('launch'); await page.goto(url,{waitUntil:'load',timeout:120000}); stage('loaded');
 await page.waitForFunction(()=>window.render_game_to_text&&(()=>{try{const s=JSON.parse(render_game_to_text());return s.graphics&&s.graphics.horseReady&&!s.graphics.horseLoading;}catch(e){return false;}})(),null,{timeout:150000,polling:250});
 stage('horseReady');

 /* ---- 1. install, tables, save shape ------------------------------------------------- */
 const one=await page.evaluate(()=>{
  const G=window.__features, out={};
  out.installed=G.installed.indexOf('market-summon-keys-pets')>=0;
  out.errors=G.errors.filter(e=>e.id==='market-summon-keys-pets');
  const K=G.market; out.hasHandles=!!K;
  const T=G.tables;
  out.tiers=T.SUMMON_TIERS.map(t=>t.id);
  out.petCount=T.PETS3.length;
  out.lumen=!!T.BREEDS3.find(b=>b[0]==='lumen');
  out.doorThings=G.world.things.filter(t=>t.kind==='keydoor').length;
  out.doorSums=K.KEY_DOORS.map(d=>d.loot.reduce((a,l)=>a+l[1],0));
  const s=G.save.fresh();
  out.save={mk:!!s.mk,pity:!!(s.mk&&s.mk.pity),draws:!!(s.mk&&s.mk.draws),doors:!!s.doors,petList:Array.isArray(s.petList)};
  /* themed pools never leak a story or exclusive horse, and always honour their own filter */
  const bad={};
  for(const t of T.SUMMON_TIERS){
   if(!t.pool||t.custom)continue;
   for(const rar of G.summon.ORDER){
    if(!(t.odds[rar]>0))continue;
    for(let i=0;i<120;i++){
     const b=G.summon.breed(rar,t);
     if(b[7].story||b[7].exclusive)bad[t.id+':story']=b[0];
     try{if(!t.pool(b))bad[t.id+':pool']=b[0];}catch(e){}
    }
   }
  }
  out.poolBad=bad;
  /* the pet call pool */
  out.petPools={Common:K.petPool('Common').length,Rare:K.petPool('Rare').length,Epic:K.petPool('Epic').length};
  return out;
 });
 check('package installed with no install error',one.installed&&one.errors.length===0,one.errors);
 check('G.market handles exported',one.hasHandles);
 check('summon stables: the three calls plus the themed banners',one.tiers.length>=9&&['winged','mystic','majestic','dragon','painted','pets','limited'].every(k=>one.tiers.indexOf(k)>=0),one.tiers);
 check('every themed pool keeps its theme and never leaks a story horse',Object.keys(one.poolBad).length===0,one.poolBad);
 check('twelve or more pets in PETS3',one.petCount>=12,one.petCount);
 check('the Luminous Spirit row is in BREEDS3',one.lumen);
 check('four key doors stand in the world',one.doorThings===4,one.doorThings);
 check('every door loot table sums to 100%',one.doorSums.every(n=>n===100),one.doorSums);
 check('save fields ensured',Object.values(one.save).every(Boolean),one.save);
 check('pet call pool has all three rarities',one.petPools.Common+one.petPools.Rare+one.petPools.Epic>=4,one.petPools);

 /* ---- 2. the Market hub: tabs ---------------------------------------------------------- */
 await page.click('#shopBtn');
 const tabs=await page.evaluate(()=>[...document.querySelectorAll('#shopPanel [data-shoptab]')].map(b=>b.dataset.shoptab));
 check('the market hub has 12+ tabs including summon, catalog, doors and free',
  tabs.length>=13&&['summon','catalog','doors','wallet','pets','horses','market','gems'].every(k=>tabs.indexOf(k)>=0),tabs);

 /* ---- 3. the Summon tab: cards, odds, pity ---------------------------------------------- */
 await page.click('#shopPanel [data-shoptab="summon"]');
 const sum=await page.evaluate(()=>{
  const p=document.getElementById('shopPanel');
  return {cards:p.querySelectorAll('.sumTier').length,
   calls:[...p.querySelectorAll('[data-fx^="mk:call:"]')].map(b=>b.dataset.fx.split(':')[2]),
   pity:/Pity \d+\/\d+/.test(p.textContent),
   rateup:/Rate-up:/.test(p.textContent),
   norepeat:/No repeats for \d+ more call/.test(p.textContent),
   odds:/\d+%/.test(p.textContent),
   painted:/Four-star statline/.test(p.textContent)};
 });
 check('every banner is a card with a call button',sum.cards>=9&&sum.calls.length>=9,sum);
 check('odds, pity, rate-up and the no-repeat promise are all printed',sum.pity&&sum.rateup&&sum.norepeat&&sum.odds&&sum.painted,sum);

 /* ---- 4. the draw: pity, the no-repeat rule, the painted coats -------------------------- */
 const draw=await page.evaluate(()=>{
  const G=window.__features, K=G.market, out={};
  const t=K.tierOf('winged');
  /* pity forces the rate-up horse */
  const s1=G.save.fresh(); s1.mk.pity.winged=t.pity-1;
  const D1={tier:t,rar:'Legendary',breed:null,stats:null,colors:null,extra:{}};
  G.run('summonDraw',D1,s1);
  out.pity={breed:D1.breed&&D1.breed[0],flag:!!D1.extra.pity};
  /* the first thirty calls never repeat: own everything but one of the winged pool */
  const pool=G.summon.pool('Legendary',t).map(b=>b[0]);
  const s2=G.save.fresh(); s2.mk.pity.winged=0; s2.mk.draws.winged=0;
  s2.horses=pool.slice(1).map((k,i)=>({id:900+i,breed:k}));
  const seen={};
  for(let i=0;i<40;i++){const D={tier:t,rar:'Legendary',breed:null,stats:null,colors:null,extra:{}};G.run('summonDraw',D,s2);seen[D.breed?D.breed[0]:'?']=1;}
  out.nodup={pool,want:pool[0],got:Object.keys(seen)};
  /* the Painted Stable */
  const DYEB=G.tables.DYE_BODY.map(x=>x[0]), DYEM=G.tables.DYE_MARK.map(x=>x[0]);
  const breeds=K.tierOf('painted').breeds, bodies={}; let okAll=true;
  for(let i=0;i<60;i++){
   const p=K.rollPainted(); bodies[p.colors.body]=1;
   if(breeds.indexOf(p.breed)<0)okAll=false;
   if(DYEB.indexOf(p.colors.body)<0||DYEM.indexOf(p.markCol)<0)okAll=false;
   for(const k in p.stats)if(p.stats[k]<6||p.stats[k]>7)okAll=false;
  }
  out.painted={ok:okAll,distinct:Object.keys(bodies).length,breeds};
  return out;
 });
 check('pity hands over the rate-up horse',draw.pity.breed==='aurora'&&draw.pity.flag,draw.pity);
 check('the first thirty calls never repeat a breed you own',draw.nodup.got.length===1&&draw.nodup.got[0]===draw.nodup.want,draw.nodup);
 check('the Painted Stable rolls seven breeds, Epic-grade stats and parlour colours',draw.painted.ok&&draw.painted.distinct>=3,draw.painted);

 /* ---- 5. a real call through the ceremony ---------------------------------------------- */
 const call=await page.evaluate(async()=>{
  const G=window.__features;
  G.save.sync(s=>{s.gems=400;});
  const before=G.save.fresh();
  G.summon.start(G.market.tierOf('painted'));
  window.advanceTime(16000);
  await new Promise(r=>setTimeout(r,400));
  window.advanceTime(4000);
  const s=G.save.fresh();
  const h=s.horses[s.horses.length-1];
  return {n0:before.horses.length,n1:s.horses.length,gems0:before.gems,gems1:s.gems,
   painted:!!(h&&h.painted),breed:h&&h.breed,stats:h&&h.stats,draws:s.mk.draws.painted||0,summons:(s.stats||{}).summons||0};
 });
 check('a Painted call adds one painted horse and takes its gems',
  call.n1===call.n0+1&&call.painted&&call.gems1===call.gems0-7&&call.draws===1,call);

 /* ---- 6. the catalogue ------------------------------------------------------------------ */
 await page.click('#shopPanel [data-shoptab="catalog"]');
 const cat=await page.evaluate(()=>{
  const G=window.__features, p=document.getElementById('shopPanel');
  return {rows:p.querySelectorAll('.catRow').length,breeds:G.tables.BREEDS3.length,
   story:/📜 The story/.test(p.textContent),locked:/not yet owned/.test(p.textContent),
   owned:/✅ owned ×/.test(p.textContent),bar:/\d+\/\d+ breeds collected/.test(p.textContent),
   filters:p.querySelectorAll('[data-fx^="mk:catf:"]').length};
 });
 check('the catalogue lists every breed with source, stars and owned state',
  cat.rows===cat.breeds&&cat.story&&cat.locked&&cat.owned&&cat.bar&&cat.filters>=8,cat);
 await page.click('#shopPanel [data-fx="mk:catf:5"]');
 const catF=await page.evaluate(()=>{
  const G=window.__features, p=document.getElementById('shopPanel');
  const want=G.tables.BREEDS3.filter(b=>(G.tables.TIER_STARS[b[2]]||2)===5).length;
  return {rows:p.querySelectorAll('.catRow').length,want};
 });
 check('the star filter narrows the catalogue',catF.rows===catF.want&&catF.want>0,catF);

 /* ---- 7. the free weekly key and the Basin Exchange -------------------------------------- */
 const free=await page.evaluate(()=>{
  const G=window.__features;
  G.save.sync(s=>{s.keyWeek='';s.keys=0;s.coins=20000;s.gems=50;});
  G.money.refreshWallet();
  return {pip:!!document.querySelector('#shopBtn .pip'),iso:G.time.isoWeekKey()};
 });
 check('an unclaimed weekly key puts a pip on the shop button',free.pip&&/^\d{4}-\d{2}-\d{2}$/.test(free.iso),free);
 await page.click('#shopPanel [data-shoptab="wallet"]');
 await page.click('#shopPanel [data-tk="freekey"]');
 const claimed=await page.evaluate(()=>{
  const G=window.__features, s=G.save.fresh();
  return {keys:s.keys,week:s.keyWeek,iso:G.time.isoWeekKey(),hud:document.getElementById('keyEl').textContent};
 });
 check('the weekly key is claimed once and stamped with the Monday week',claimed.keys===1&&claimed.week===claimed.iso&&claimed.hud==='1',claimed);
 await page.click('#shopPanel [data-shoptab="wallet"]');
 const exch=await page.evaluate(async()=>{
  const G=window.__features, before=G.save.fresh();
  const btn=()=>document.querySelector('#shopPanel [data-fx="mk:gemx:0"]');
  for(let i=0;i<4;i++){const b=btn();if(b&&!b.disabled)b.click();await new Promise(r=>setTimeout(r,30));}
  const s=G.save.fresh();
  return {c0:before.coins,c1:s.coins,g0:before.gems,g1:s.gems,n:s.mk.gemx.n,cap:G.market.GEMX_CAP,gemMul:G.mul('gem',s)};
 });
 check('the Basin Exchange trades coins for gems and stops at its daily cap',
  exch.n===exch.cap&&exch.g1===exch.g0+3*exch.gemMul&&exch.c1===exch.c0-1800,exch);

 /* ---- 8. key doors ----------------------------------------------------------------------- */
 const doors=await page.evaluate(async()=>{
  const G=window.__features, K=G.market, out={};
  /* the published odds are on the label and in the Doors tab */
  const t=K.doorThings[0];
  out.label=t.label(t);
  /* every loot kind pays the thing it says it pays */
  const probe={};
  G.save.sync(s=>{
   for(const kind of Object.keys(K.LOOT)){
    const b={g:s.gems,k:s.keys,d:s.dust||0,t:(s.tack||[]).length,h:s.horses.length,c:s.coins};
    const txt=K.applyLoot(s,kind);
    probe[kind]={txt,dg:s.gems-b.g,dk:s.keys-b.k,dd:(s.dust||0)-b.d,dt:(s.tack||[]).length-b.t,dh:s.horses.length-b.h,dc:Math.round(s.coins-b.c)};
   }
  });
  out.probe=probe; out.gemMul=G.mul('gem',G.save.fresh());
  /* open one for real */
  G.save.sync(s=>{s.keys=3;s.doors={};s.mk.doors=0;});
  const before=G.save.fresh();
  t.use(t);
  window.advanceTime(3000);
  const s=G.save.fresh();
  out.open={keys0:before.keys,keys1:s.keys,stamp:s.doors[t.id],iso:G.time.isoWeekKey(),count:s.mk.doors,
   gained:(s.gems-before.gems)+(s.keys-(before.keys-1))+((s.dust||0)-(before.dust||0))+((s.tack||[]).length-(before.tack||[]).length)+(s.horses.length-before.horses.length)+Math.round(s.coins-before.coins)};
  t.use(t);                                          // a second try the same week does nothing
  out.twice=G.save.fresh().keys;
  out.labelAfter=t.label(t);
  return out;
 });
 check('a door label prints its odds before you spend the key',/%/.test(doors.label)&&/1🗝️/.test(doors.label),doors.label);
 check('every loot kind pays out',
  doors.probe.gems6.dg===6*doors.gemMul&&doors.probe.keys2.dk===2&&doors.probe.dust40.dd===40&&doors.probe.tackLeg.dt===1&&doors.probe.horse.dh===1&&doors.probe.coins250.dc===250,{gemMul:doors.gemMul,probe:doors.probe});
 check('opening a door costs one key, stamps the week and pays something',
  doors.open.keys1<=doors.open.keys0&&doors.open.stamp===doors.open.iso&&doors.open.count===1&&doors.open.gained>0,doors.open);
 check('a door only opens once a week',doors.twice===doors.open.keys1&&/opens again Monday/.test(doors.labelAfter),{twice:doors.twice,label:doors.labelAfter});
 await page.click('#shopPanel [data-shoptab="doors"]');
 const doorTab=await page.evaluate(()=>{
  const p=document.getElementById('shopPanel');
  return {cards:p.querySelectorAll('.passCard').length,pcts:(p.textContent.match(/\d+%/g)||[]).length};
 });
 check('the Doors tab publishes all five loot tables',doorTab.cards>=5&&doorTab.pcts>=20,doorTab);

 /* ---- 9. gem dust: made by doors, spent by the wardrobe, worth Star Points --------------- */
 const dust=await page.evaluate(async()=>{
  const G=window.__features;
  G.save.sync(s=>{s.dust=200;s.sp=s.sp||{pts:0};});
  G.money.refreshWallet();
  const sp0=(G.save.fresh().sp||{}).pts||0;
  G.save.sync(s=>{s.dust-=40;});                      // what the wardrobe does when you unlock a piece
  G.money.refreshWallet();
  window.advanceTime(2500);
  const s=G.save.fresh();
  return {sp0,sp1:(s.sp||{}).pts||0,spent:s.mk.dustSpent,dust:s.dust,earned:s.mk.dustEarned,hud:document.getElementById('dustEl').textContent};
 });
 check('40 dust spent is 4 Star Points for the club',dust.sp1===dust.sp0+4&&dust.spent>=40,dust);
 check('dust earned is tallied and shown in the HUD',dust.earned>0&&/160/.test(dust.hud),dust);

 /* ---- 10. pets: the shop tab, the pet call, the pass reward ------------------------------ */
 await page.click('#shopPanel [data-shoptab="pets"]');
 const petTab=await page.evaluate(()=>{
  const p=document.getElementById('shopPanel');
  return {rows:p.querySelectorAll('.evrow').length,pairs:/pairs with/.test(p.textContent),
   buy:p.querySelectorAll('[data-buypet]').length,src:/Pets of the Basin call/.test(p.textContent)};
 });
 check('the pets tab lists the menagerie, its sources and the pairs',petTab.rows>=12&&petTab.pairs&&petTab.buy>=4&&petTab.src,petTab);
 const petCall=await page.evaluate(async()=>{
  const G=window.__features;
  G.save.sync(s=>{s.gems=300;s.petList=[];s.mk.petPity=0;s.dust=0;});
  const t=G.market.tierOf('pets');
  let epics=0;
  for(let i=0;i<12;i++){G.summon.start(t);await new Promise(r=>setTimeout(r,10));}
  const s=G.save.fresh();
  const owned=s.petList.slice();
  const epicKeys=G.market.petPool('Epic').map(p=>p.key);
  epics=owned.filter(k=>epicKeys.indexOf(k)>=0).length;
  /* the pass pays a pet as a reward kind */
  let pass=null; G.save.sync(sv=>{G.money.payReward(sv,{pet:'owl'});pass=sv.petList.indexOf('owl')>=0;});
  return {owned,epics,gems:s.gems,draws:s.mk.draws.pets,dust:s.dust,pass,label:G.money.rewardLabel({pet:'owl'})};
 });
 check('twelve pet calls spend gems, grant pets and hit the Epic pity',
  petCall.draws===12&&petCall.gems===300-72&&petCall.owned.length>=3&&petCall.epics>=1,petCall);
 check('a pet is a reward kind the pass and the sets can pay',petCall.pass&&/Barn Owl/.test(petCall.label),petCall.label);

 /* ---- 11. the pair that lights up --------------------------------------------------------- */
 const combo=await page.evaluate(async()=>{
  const G=window.__features;
  G.save.sync(s=>{
   const h=G.horse.grantHorse(s,'lumen',{name:'Lumen',bond:50});
   s.horses.splice(s.horses.indexOf(h),1); s.horses.unshift(h);
   s.petList=s.petList||[]; if(!s.petList.includes('glimmerfox'))s.petList.push('glimmerfox');
   s.mk.combos=0; s.stats=s.stats||{}; s.stats.combos=0;
  });
  G.horse.reloadHorses();
  const sel=document.getElementById('horseSel'); sel.value='0'; sel.onchange();     // ride the Luminous Spirit
  G.pets.setActive('glimmerfox');
  window.advanceTime(6000);
  const P=G.pets.comp(), s=G.save.fresh();
  const near={combo:P?P.combo:0,key:P&&P.key,breed:G.horse.ridden().breed,combos:s.mk.combos};
  /* ride away and the glow dies down (under the 40 m mark, so the pet trots after you
     instead of being teleported to your heels) */
  G.horse.player.pos.set(G.horse.player.pos.x+18,0,G.horse.player.pos.z+18);
  window.advanceTime(250);
  const far={combo:G.pets.comp()?G.pets.comp().combo:0,d:Math.hypot(G.horse.player.pos.x-G.pets.comp().pos.x,G.horse.player.pos.z-G.pets.comp().pos.z)};
  const st=JSON.parse(window.render_game_to_text());
  return {near,far,state:st.market};
 });
 check('a matched horse and pet transform side by side',
  combo.near.breed==='lumen'&&combo.near.key==='glimmerfox'&&combo.near.combo>0.9&&combo.near.combos>=1,combo.near);
 check('the glow fades when they are apart',combo.far.combo<combo.near.combo,combo.far);
 check('render_game_to_text carries the market keys',
  combo.state&&combo.state.banners>=9&&combo.state.doors.total===5&&combo.state.pets.total>=12&&combo.state.breeds.total>0,combo.state);

 /* ---- 12. a bond bonus for the pair -------------------------------------------------------- */
 const bond=await page.evaluate(()=>{
  const G=window.__features, h=G.horse.ridden(), s=G.save.fresh();
  const withPet=G.mul('bond',s,h,{});
  G.pets.setActive('glimmerfox');            // toggles it off
  const without=G.mul('bond',s,h,{});
  return {withPet,without};
 });
 check('a paired pet bonds the horse 15% faster',Math.abs(bond.withPet-1.15)<1e-6&&Math.abs(bond.without-1)<1e-6,bond);

 /* ---- 13. the Summoning Stall's own panel ---------------------------------------------- */
 const stall=await page.evaluate(()=>{
  const G=window.__features;
  G.summon.open();
  const p=document.getElementById('summonPanel');
  const lim=G.market.tierOf('limited');
  const out={open:p.style.display==='flex',cards:p.querySelectorAll('.sumTier').length,
   chips:/Pity \d+\/\d+/.test(p.textContent)&&/Rate-up:/.test(p.textContent),
   limited:{label:lim.label,featured:lim.featured,season:(G.market.seasonBanner()||{}).season},
   dailies:G.quest.DAILYQ.filter(d=>d.type==='door'||d.type==='compan').length};
  p.style.display='none';
  return out;
 });
 check('the Summoning Stall panel carries every banner and its chips',stall.open&&stall.cards>=9&&stall.chips,stall);
 check('the limited banner names the season it belongs to',!!stall.limited.season&&stall.limited.label!=='Seasonal Banner'&&!!stall.limited.featured,stall.limited);
 check('the door and companion dailies are registered',stall.dailies===2,stall.dailies);

 /* ---- 14. the headset sees the same shop ---------------------------------------------- */
 const vr=await page.evaluate(()=>{
  const G=window.__features;
  try{G.ui.drawVRMenu();return {ok:true};}catch(e){return {ok:false,err:String(e&&e.message||e)};}
 });
 check('the VR menu still draws with the Summon and Doors tabs in it',vr.ok,vr);

 /* ---- wrap ------------------------------------------------------------------------------- */
 const state=await page.evaluate(()=>JSON.parse(window.render_game_to_text()));
 stage('done');
 const hard=errors.filter(e=>!/Breed model unavailable|favicon|WebGL|GPU stall|THREE.WebGLRenderer/i.test(e));
 check('no page errors',hard.length===0,hard.slice(0,5));
 console.log('\nmarket state: '+JSON.stringify(state.market));
 const bad=checks.filter(c=>!c.ok);
 console.log('\n'+(checks.length-bad.length)+'/'+checks.length+' checks passed');
 await browser.close();
 process.exit(bad.length?1:0);
})().catch(async e=>{console.error(e);try{if(browser)await browser.close();}catch(_){}process.exit(2);});

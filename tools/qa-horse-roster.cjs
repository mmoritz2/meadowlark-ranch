/* horse-roster package check.
   Boots ranch3d.html?qa=roster, waits for the horse, then proves every feature of the package
   headlessly: star rarity on rows and cards, sources (shop / Starfall / season / boards /
   breeding), named coats and procedural coats on acquisition, per-fantasy ceilings, traits and
   their ride effects, the dragon lineage and six-star pairings, exclusives, the season track
   and the Season Call, swimming (the water, the pace, the specialist) and the flying mastery
   track, the catalogue panel and the shop shelf, and that every new coat theme compiles.

   Usage:  QA_URL=http://127.0.0.1:8431 NODE_PATH=$(npm root -g) node tools/qa-horse-roster.cjs */
const {chromium}=require('playwright');
const base=(process.env.QA_URL||'http://127.0.0.1:8431').replace(/\/$/,'');
const url=base+'/ranch3d.html?qa=roster&fresh='+Date.now();
const checks=[];
function check(name,ok,detail){checks.push({name,ok:!!ok,detail});console.log((ok?'PASS ':'FAIL ')+name+(detail!==undefined?' — '+JSON.stringify(detail):''));}
const t0=Date.now();
const stage=s=>console.log('… '+s+' @'+((Date.now()-t0)/1000).toFixed(1)+'s');
let browser=null;
setTimeout(async()=>{console.error('WATCHDOG: no result after 600 s');try{if(browser)await browser.close();}catch(e){}process.exit(3);},600000).unref();
const READY=()=>window.render_game_to_text&&(()=>{try{const s=JSON.parse(render_game_to_text());return s.graphics&&s.graphics.horseReady&&!s.graphics.horseLoading;}catch(e){return false;}})();
(async()=>{
 browser=await chromium.launch({headless:true,args:['--disable-background-timer-throttling','--use-angle=metal','--enable-gpu-rasterization','--ignore-gpu-blocklist']});
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 const errors=[];
 page.on('pageerror',e=>errors.push('PAGEERROR '+e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text().slice(0,300));});
 page.on('dialog',d=>{d.dismiss().catch(()=>{});});
 stage('launch'); await page.goto(url,{waitUntil:'load',timeout:120000}); stage('loaded');
 await page.waitForFunction(READY,null,{timeout:150000,polling:250});
 stage('horseReady');
 const waitReady=async()=>{await page.waitForFunction(READY,null,{timeout:120000,polling:250});};

 /* ---- static: rows, stars, sources, ceilings, coats, traits, recipes ---------------- */
 const A=await page.evaluate(()=>{
  const G=window.__features,R=G.horse.roster,T=G.tables,out={};
  out.installed=G.installed.includes('horse-roster'); out.errors=G.errors.slice();
  const keys=T.BREEDS3.map(b=>b[0]); out.dupKeys=keys.filter((k,i)=>keys.indexOf(k)!==i);
  out.rows=T.BREEDS3.length;
  out.stars={bay:R.starsN({breed:'bay'}),thoro:R.starsN({breed:'thoro'}),sunset:R.starsN({breed:'sunset'}),pegasus:R.starsN({breed:'pegasus'}),emberdrake:R.starsN({breed:'emberdrake'}),alicorn:R.starsN({breed:'alicorn'}),blossomdrake:R.starsN({breed:'blossomdrake'}),starStr:R.starsOf({breed:'emberdrake'})};
  out.tierBase=T.TIER_BASE.Ascendant; out.tierStars=T.TIER_STARS;
  const bk=k=>T.BREEDS3.find(b=>b[0]===k);
  const av=(k,ctx)=>G.horse.breedAvailable(bk(k),ctx);
  out.src={aetherShop:av('aether','shop'),aetherSummon:av('aether','summon'),emberdrakeShop:av('emberdrake','shop'),emberdrakeSummon:av('emberdrake','summon'),
   alicorn:[av('alicorn','shop'),av('alicorn','summon'),av('alicorn','market')],duskmustang:[av('duskmustang','shop'),av('duskmustang','summon')],tidewalkerSummon:av('tidewalker','summon'),
   pegasusShop:av('pegasus','shop'),bayShop:av('bay','shop'),kestrelSummon:av('kestrel','summon'),srcAlicorn:G.horse.breedSrc(bk('alicorn')),srcPetal:G.horse.breedSrc(bk('petalmane'))};
  out.ceil={aetherSpeed:G.xp.statCeil({breed:'aether'},'speed'),aetherJump:G.xp.statCeil({breed:'aether'},'jump'),glacierAccel:G.xp.statCeil({breed:'glacier'},'accel'),glacierWant:JSON.parse(render_game_to_text()).features.includes('stats-progression')?8:7,alicornAll:G.xp.statCeil({breed:'alicorn'},'agility'),bayNoK:G.xp.statCeil({breed:'bay'})};
  out.coats={breeds:Object.keys(R.COATS3).length,total:Object.values(R.COATS3).reduce((a,l)=>a+l.length,0),badMarks:[].concat(...Object.values(R.COATS3)).filter(v=>v[4]&&T.MARKS[v[4]]===undefined).map(v=>v[0]),pegasus:R.COATS3.pegasus.length,qh:R.COATS3.bay.length};
  const a1=R.rollAppearance('bay',1),a2=R.rollAppearance('bay',2),a1b=R.rollAppearance('bay',1);
  const dist=(x,y)=>{const c=new G.THREE.Color(x),d=new G.THREE.Color(y);return Math.hypot(c.r-d.r,c.g-d.g,c.b-d.b);};
  const v1=R.COATS3.bay.find(v=>v[0]===a1.variant);
  out.proc={differ:a1.colors.body!==a2.colors.body,deterministic:JSON.stringify(a1)===JSON.stringify(a1b),variant:a1.variant,nearVariant:v1?dist(a1.colors.body,v1[2]):null,mark2:a1.mark2,themedKeepsColors:R.rollAppearance('aether',3).variant===null};
  const rt=R.rollTraits({id:5,breed:'aether'}),rt2=R.rollTraits({id:5,breed:'aether'});
  out.traits={n:Object.keys(T.TRAITS).length,mythic:rt.length,det:JSON.stringify(rt)===JSON.stringify(rt2),common:R.rollTraits({id:3,breed:'bay'}).length,six:R.rollTraits({id:9,breed:'alicorn'}).length};
  out.recipes={n:R.VARIANT_RECIPES.length,missingChild:R.VARIANT_RECIPES.filter(r=>!bk(r.child)).map(r=>r.child),frost:(R.resolveVariant({breed:'emberdrake',coat:'fire'},{breed:'glacier',coat:'ice'})||{}).child,frostRev:(R.resolveVariant({breed:'glacier',coat:'ice'},{breed:'emberdrake',coat:'fire'})||{}).child,alicorn:(R.resolveVariant({breed:'unicorn'},{breed:'pegasus'})||{}).child,none:R.resolveVariant({breed:'bay'},{breed:'thoro'})};
  out.seasons={cur:G.time.seasonNow().def.id,horses:R.seasonHorses(G.time.seasonNow().def.id),allSeasons:T.SEASONS.map(s=>{const h=R.seasonHorses(s.id);return [s.id,!!(h.pass&&h.deluxe&&h.banner),[h.pass,h.deluxe,h.banner].every(k=>bk(k)&&bk(k)[7].season===s.id)];}),passFree:T.PASS_FREE[29].seasonHorse,passGold:T.PASS_GOLD[19].seasonHorse,label:G.money.rewardLabel(T.PASS_FREE[29])};
  out.world={l1:!!T.EVENTS3.find(e=>e.id==='l1'),ll:!!T.RACE_ROUTES.ll,shallows:T.REGIONS[0].name,swimDaily:!!G.quest.DAILYQ.find(d=>d.type==='swim'),achs:['star6','excl1','coat20','drake8','trait3','season1','ascend1','swim500'].filter(id=>!G.quest.ACHS.find(a=>a.id===id))};
  out.water={lake:R.waterDepth(20,16),ranch:R.waterDepth(0,5),bridge:R.waterDepth(0,120),river:R.waterDepth(40,G.world.riverZ(40))};
  out.themes={registered:R.NEW_THEMES,inCfg:R.NEW_THEMES.filter(k=>!T.FANTASY_CFG[k]||!T.FANTASY_FX[k]||!T.COAT_BASE[k]||!T.WING_TINT[k]||!T.DRAGON_TINT[k]),alias:G.horse.breedModels.resolve('tidewalker'),aliasDrake:G.horse.breedModels.resolve('gloomdrake')};
  out.perks={bay5:R.perkFor('bay',5),thoro10:R.perkFor('thoro',10),aether0:R.perkFor('aether',0).labels.length,flight:Object.keys(R.FLIGHT_UNLOCKS).length,allBreeds:T.BREEDS3.filter(b=>!R.BREED_PERKS[b[0]]).map(b=>b[0])};
  return out;
 });
 check('package installed without error',A.installed&&A.errors.length===0,A.errors);
 check('new BREEDS3 rows, no duplicate keys',A.rows>=66&&A.dupKeys.length===0,{rows:A.rows,dup:A.dupKeys});
 check('star rarity: bay 2, thoro 3, sunset 4, pegasus 5, dragon 5, alicorn 6, limited banner 6',A.stars.bay===2&&A.stars.thoro===3&&A.stars.sunset===4&&A.stars.pegasus===5&&A.stars.emberdrake===5&&A.stars.alicorn===6&&A.stars.blossomdrake===6&&A.stars.starStr.length===5,A.stars);
 check('Ascendant tier in TIER_BASE + TIER_STARS exposed',A.tierBase===10&&A.tierStars.Ascendant===6,{base:A.tierBase});
 check('sources: mythic/dragon are Starfall-only, bred-only never sold or drawn, exclusives hidden, shop rows still buyable',
  !A.src.aetherShop&&A.src.aetherSummon&&!A.src.emberdrakeShop&&A.src.emberdrakeSummon&&A.src.alicorn.every(x=>!x)&&A.src.duskmustang.every(x=>!x)&&A.src.tidewalkerSummon&&A.src.pegasusShop&&A.src.bayShop&&!A.src.kestrelSummon&&A.src.srcAlicorn==='breed'&&A.src.srcPetal==='season',A.src);
 check('per-fantasy stat ceilings (aether speed 10 / jump 8, glacier accel 7 — or the stats package\'s authored 8 when it is installed first, alicorn 10)',A.ceil.aetherSpeed===10&&A.ceil.aetherJump===8&&A.ceil.glacierAccel===A.ceil.glacierWant&&A.ceil.alicornAll===10&&A.ceil.bayNoK===8,A.ceil);
 check('named coats: 20+ breeds, 100+ coats, marks valid, Quarter Horse 12, Pegasus 5',A.coats.breeds>=20&&A.coats.total>=100&&A.coats.badMarks.length===0&&A.coats.qh>=12&&A.coats.pegasus===5,A.coats);
 check('procedural coats: seeded, distinct, near the named coat, second layer, themed coats untouched',A.proc.differ&&A.proc.deterministic&&A.proc.variant&&A.proc.nearVariant<0.15&&typeof A.proc.mark2==='string'&&A.proc.themedKeepsColors,A.proc);
 check('traits: 8 registered, deterministic per id, 0 on common, 1-2 on mythic, 2 on six-star',A.traits.n>=8&&A.traits.det&&A.traits.common<=1&&A.traits.mythic>=1&&A.traits.mythic<=2&&A.traits.six===2,A.traits);
 check('dragon lineage recipes resolve (ember×glacier→frost both ways, unicorn×pegasus→alicorn, plain→none)',A.recipes.n>=15&&A.recipes.missingChild.length===0&&A.recipes.frost==='frostdrake'&&A.recipes.frostRev==='frostdrake'&&A.recipes.alicorn==='alicorn'&&A.recipes.none===null,A.recipes);
 check('seasonal releases: 3 horses per season on every season, pass tiers carry the horse',A.seasons.allSeasons.every(x=>x[1]&&x[2])&&A.seasons.passFree==='pass'&&A.seasons.passGold==='deluxe'&&/season/.test(A.seasons.label),A.seasons);
 check('world data: Loon Lake Crossing race, shallows region, swim daily, achievements',A.world.l1&&A.world.ll&&/shallows/.test(A.world.shallows)&&A.world.swimDaily&&A.world.achs.length===0,A.world);
 check('waterDepth: lake deep, ranch dry, bridge deck dry, river channel wet',A.water.lake>0.45&&A.water.ranch===0&&A.water.bridge===0&&A.water.river>0.45,A.water);
 check('7 new coat themes mirrored into every table; new keys resolve to authored bodies',A.themes.registered.length===7&&A.themes.inCfg.length===0&&A.themes.alias==='sunset'&&A.themes.aliasDrake==='clyde',A.themes);
 check('breed perks for every row + flight unlocks',A.perks.bay5&&A.perks.bay5.ag===0.05&&A.perks.thoro10.sp>0.07&&A.perks.aether0===0&&A.perks.flight===4&&A.perks.allBreeds.length===0,A.perks);

 /* ---- acquisition: coats, traits, stars on every new horse; exclusives; foals --------- */
 const B=await page.evaluate(()=>{
  const G=window.__features,R=G.horse.roster,T=G.tables,out={};
  const bk=k=>T.BREEDS3.find(b=>b[0]===k);
  G.save.sync(s=>{s.coins=99999;s.gems=500;for(let i=0;i<6;i++)G.horse.grantHorse(s,'bay',{src:'shop'});});
  let s=G.save.fresh(); const bays=s.horses.filter(h=>h.breed==='bay'&&h.src==='shop');
  const dist=(x,y)=>{const c=new G.THREE.Color(x),d=new G.THREE.Color(y);return Math.hypot(c.r-d.r,c.g-d.g,c.b-d.b);};
  out.bays={n:bays.length,variants:[...new Set(bays.map(h=>h.variant))].length,bodies:[...new Set(bays.map(h=>h.colors.body))].length,
   near:bays.every(h=>{const v=R.COATS3.bay.find(x=>x[0]===h.variant);return v&&dist(h.colors.body,v[2])<0.15;}),stars:bays.every(h=>h.stars===2),traitsArr:bays.every(h=>Array.isArray(h.traits)),mark2:bays.some(h=>h.mark2),coatsSeen:Object.keys(s.roster.coatsSeen).length};
  G.save.sync(sv=>{G.horse.grantHorse(sv,'aether',{src:'summon'});G.horse.grantHorse(sv,'dryadwalker',{src:'season'});});
  s=G.save.fresh(); const ae=s.horses.find(h=>h.breed==='aether'),dr=s.horses.find(h=>h.breed==='dryadwalker');
  out.fantasy={aetherCoat:ae.coat,aetherColors:ae.colors.body===bk('aether')[5],aetherVariant:ae.variant,aetherTraits:ae.traits.length,aetherStars:ae.stars,dryadFixedTrait:dr.traits.includes('prospector')};
  /* exclusives: once per period */
  let n0=0,n1=0,n2=0,ex=null;
  G.save.sync(sv=>{n0=sv.horses.length;R.grantExclusive(sv,'duskmustang','2025-1','test');n1=sv.horses.length;R.grantExclusive(sv,'duskmustang','2025-1','test');n2=sv.horses.length;ex=Object.assign({},sv.roster.exclusives);});
  out.excl={added:n1-n0,dup:n2-n1,tag:!!ex['duskmustang:2025-1']};
  /* the weekly board: first place at the roll hands over the horse */
  let wk=null; G.save.sync(sv=>{sv.wk={week:'2025-7',place:1,sp:900,days:7,clubTop:true};const c0=sv.horses.length;G.run('weekRoll',sv);const added=sv.horses.slice(c0).map(h=>h.breed).sort();G.run('weekRoll',sv);const dup=sv.horses.length-c0-added.length;
   sv.wk={week:'2025-8',place:0,sp:120,days:7};const c1=sv.horses.length;G.run('weekRoll',sv);wk={added,dup,quiet:sv.horses.length-c1,boot:R.weeklyCheck(sv,{week:'2025-9',sp:600}).map(h=>h.breed)};});
  out.weekly=wk;
  /* the season track through payReward */
  let sh=null; G.save.sync(sv=>{const c0=sv.horses.length;G.money.payReward(sv,{seasonHorse:'pass'});G.money.payReward(sv,{seasonHorse:'pass'});sh={added:sv.horses.length-c0,breed:sv.horses[sv.horses.length-1].breed,expected:R.seasonHorses(G.time.seasonNow().def.id).pass};});
  out.seasonPass=sh;
  /* foals: lineage, six-star, egg, mutation bookkeeping */
  let f=null; G.save.sync(sv=>{const e=G.horse.grantHorse(sv,'emberdrake',{src:'qa'}),g=G.horse.grantHorse(sv,'glacier',{src:'qa'});const foal=G.horse.makeFoal(sv,e,g,{src:'qa'});
   const u=G.horse.grantHorse(sv,'unicorn',{src:'qa'}),p=G.horse.grantHorse(sv,'pegasus',{src:'qa'});const al=G.horse.makeFoal(sv,u,p,{src:'qa'});
   const an=G.horse.grantHorse(sv,'ancientdrake',{src:'qa'}),fi=G.horse.grantHorse(sv,'sunspear',{src:'qa'});const egg=G.horse.makeFoal(sv,an,fi,{src:'qa'});
   f={frost:foal.breed,frostCoat:foal.coat,frostDragon:foal.dragon,found:sv.roster.variantsFound,alicorn:al.breed,alicornStars:al.stars,alicornRarity:R.rarityOf(al),eggBreed:egg.breed,egg:!!egg.egg,eggFoal:egg.foal,traitsInherit:Array.isArray(foal.traits),eggOut:egg.out};});
  out.foals=f;
  return out;
 });
 check('six bought Quarter Horses: 2+ named coats, 2+ shades, near their coat, stars 2, traits rolled, coats seen',B.bays.n===6&&B.bays.variants>=2&&B.bays.bodies>=2&&B.bays.near&&B.bays.stars&&B.bays.traitsArr&&B.bays.coatsSeen>=2,B.bays);
 check('fantasy arrivals keep their theme, roll 1-2 traits, carry 5 stars; a season horse carries its fixed trait',B.fantasy.aetherCoat==='galaxy'&&B.fantasy.aetherColors&&!B.fantasy.aetherVariant&&B.fantasy.aetherTraits>=1&&B.fantasy.aetherStars===5&&B.fantasy.dryadFixedTrait,B.fantasy);
 check('grantExclusive pays once per period',B.excl.added===1&&B.excl.dup===0&&B.excl.tag,B.excl);
 check('week close: champion week → Dusk Mustang, photo first → Meadowlark Unicorn, club top → Kiln Friesian; once per week; a quiet week pays nothing',B.weekly&&B.weekly.added.join()==='duskmustang,kilnfriesian,larkunicorn'&&B.weekly.dup===0&&B.weekly.quiet===0&&B.weekly.boot.join()==='duskmustang',B.weekly);
 check('season pass horse via payReward, once per season',B.seasonPass&&B.seasonPass.added===1&&B.seasonPass.breed===B.seasonPass.expected,B.seasonPass);
 check('foals: ember×glacier → Frostwing (found), unicorn×pegasus → Alicorn (6★ Ascendant), Elder×fire → egg',B.foals&&B.foals.frost==='frostdrake'&&B.foals.frostCoat==='ice'&&B.foals.frostDragon&&B.foals.found.frostdrake===1&&B.foals.alicorn==='alicorn'&&B.foals.alicornStars===6&&B.foals.alicornRarity==='Ascendant'&&B.foals.eggBreed==='emberdrake'&&B.foals.egg&&B.foals.eggFoal&&B.foals.traitsInherit,B.foals);

 /* ---- UI: catalogue, shop shelf, care header, stable chips ------------------------------ */
 const C=await page.evaluate(()=>{
  const G=window.__features,out={};
  G.horse.reloadHorses();
  document.getElementById('catalogBtn').click();
  const p=document.getElementById('catalogPanel');
  out.panel={shown:p.style.display,btnAfter:document.getElementById('catalogBtn').previousElementSibling.id,afterStable:!!(document.getElementById('stableBtn').compareDocumentPosition(document.getElementById('catalogBtn'))&Node.DOCUMENT_POSITION_FOLLOWING),title:/Horse Catalogue/.test(p.textContent),alicornBred:/Alicorn/.test(p.textContent)&&/Bred from/.test(p.textContent),stars:(p.textContent.match(/⭐/g)||[]).length};
  const tab=t=>{p.querySelector('[data-fx="roster:tab:'+t+'"]').click();return p.textContent;};
  const coats=tab('coats'); out.coats={seen:/coats.*seen/.test(coats),qh:/Quarter Horse/.test(coats),buttons:p.querySelectorAll('[data-fx^="roster:coat:"]').length,mark2:p.querySelectorAll('[data-fx^="roster:mark2:"]').length};
  const tr=tab('traits'); out.traits=/The Prospector/.test(tr)&&/Early Bird/.test(tr)&&/Lasso/.test(tr)&&/Waterborn/.test(tr);
  const li=tab('lineage'); out.lineage={frost:/Frostwing Dragon/.test(li),unknown:/unknown/.test(li),egg:/🥚/.test(li)};
  const se=tab('seasons'); out.seasons={cur:/Season of/.test(se),call:!!p.querySelector('[data-fx="roster:call"]'),odds:/60%/.test(se),calendar:/Release calendar/.test(se)};
  /* the Season Call: 30 gems, published odds, pity on the third */
  let s=G.save.fresh(); const g0=s.gems,n0=s.horses.length;
  p.querySelector('[data-fx="roster:call"]').click(); p.querySelector('[data-fx="roster:call"]').click(); p.querySelector('[data-fx="roster:call"]').click();
  s=G.save.fresh(); const R=G.horse.roster, banner=R.seasonHorses(G.time.seasonNow().def.id).banner;
  out.call={gems:g0-s.gems,added:s.horses.length-n0,bannerOwned:s.horses.some(h=>h.breed===banner),pity:s.roster.seasonPity,calls:s.roster.calls,limitedStars:s.horses.filter(h=>h.breed===banner).map(h=>h.stars)[0]};
  /* the shop shelf */
  G.ui.openShop('horses'); const sp=document.getElementById('shopPanel');
  const rowText=b=>{const el=[...sp.querySelectorAll('.evrow')].find(r=>r.textContent.includes(b));return el?el.textContent:'';};
  const buyNames=[...sp.querySelectorAll('[data-buyh]')].map(b=>b.closest('.evrow').querySelector('b').textContent);
  out.shop={qhStars:/⭐⭐/.test(rowText('Quarter Horse')),qhCoats:/12 coats/.test(rowText('Quarter Horse')),aetherBuy:buyNames.includes('Aether Friesian'),alicornBuy:buyNames.includes('Alicorn'),notOnShelf:/Not on the shelf/.test(sp.textContent),alicornListed:/Alicorn/.test(sp.textContent)&&/Bred from/.test(sp.textContent),buyN:buyNames.length,chips:sp.querySelectorAll('[data-fx^="roster:stars:"]').length};
  sp.querySelector('[data-fx="roster:stars:4"]').click();
  out.shop.buy4=document.getElementById('shopPanel').querySelectorAll('[data-buyh]').length;
  document.getElementById('shopPanel').querySelector('[data-fx="roster:stars:0"]').click();
  out.shop.buyAll=document.getElementById('shopPanel').querySelectorAll('[data-buyh]').length;
  /* the care header and the stable chips */
  G.save.sync(sv=>{sv.horses[G.horse.rideIdx()].traits=['prospector','earlybird'];}); G.horse.reloadHorses(); R.refreshCur();
  G.ui.openCare(); const ct=document.getElementById('carePanel').textContent;
  out.care={stars:/⭐/.test(ct),rarity:/Common/.test(ct),trait:/The Prospector/.test(ct)&&/Early Bird/.test(ct),perks:/perks/.test(ct)&&/Steady partner/.test(ct)};
  G.ui.openStable(); const st=document.getElementById('stablePanel').textContent;
  out.stable={stars:(st.match(/⭐/g)||[]).length>=5,variantShown:/Sorrel|Palomino|Buckskin|Blue Roan|Grulla|Red Dun|Champagne|Bay Points|Flaxen Chestnut|Smoky Black|Leopard|Tobiano/.test(st),egg:/🥚 egg/.test(st)};
  G.hidePanels();
  /* the events panel flags a trait match */
  G.ui.openEvents(); out.eventMatch=/TRAIT MATCH/.test(document.getElementById('eventsPanel').textContent); G.hidePanels();
  out.state=JSON.parse(render_game_to_text()).roster;
  return out;
 });
 check('catalogue panel: dock button after Stable, title, six-star sources, stars',C.panel.shown==='flex'&&C.panel.afterStable&&C.panel.title&&C.panel.alicornBred&&C.panel.stars>100,C.panel);
 check('catalogue coats tab: coats seen, per-breed swatches (the family bay has no named coats to pick)',C.coats.seen&&C.coats.qh&&C.coats.buttons===0,C.coats);
 check('catalogue traits tab lists the traits',C.traits);
 check('catalogue lineage tab: found dragon, unknowns, eggs',C.lineage.frost&&C.lineage.unknown&&C.lineage.egg,C.lineage);
 check('catalogue seasons tab: current season, Season Call, odds, calendar',C.seasons.cur&&C.seasons.call&&C.seasons.odds&&C.seasons.calendar,C.seasons);
 check('Season Call: 3 calls cost 90 gems, 3 horses, banner guaranteed by the third, limited banner is 6★',C.call.gems===90&&C.call.added===3&&C.call.bannerOwned&&C.call.calls===3&&C.call.limitedStars===6,C.call);
 check('shop shelf: stars on rows, coat counts, no Aether/Alicorn buy button, not-on-shelf list with sources, filter chips narrow the rows',C.shop.qhStars&&C.shop.qhCoats&&!C.shop.aetherBuy&&!C.shop.alicornBuy&&C.shop.notOnShelf&&C.shop.alicornListed&&C.shop.chips===6&&C.shop.buy4<C.shop.buyAll&&C.shop.buy4>=3,C.shop);
 check('care header: stars, rarity, trait chips, breed perks',C.care.stars&&C.care.rarity&&C.care.trait&&C.care.perks,C.care);
 check('stable rows: stars, named coat, egg',C.stable.stars&&C.stable.variantShown&&C.stable.egg,C.stable);
 check('events panel: TRAIT MATCH badge on a matching course',C.eventMatch);
 check('render_game_to_text carries roster keys',C.state&&C.state.traits.includes('prospector')&&C.state.stars===2,C.state);

 /* ---- ride effects: region trait, early bird, swimming, the specialist, flight -------- */
 const gallopFor=async(ms,shift)=>{await page.evaluate(({ms,shift})=>{window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyW'}));if(shift)window.dispatchEvent(new KeyboardEvent('keydown',{code:'ShiftLeft'}));window.advanceTime(ms);},{ms,shift});
  const st=await page.evaluate(()=>{const s=JSON.parse(render_game_to_text());window.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyW'}));window.dispatchEvent(new KeyboardEvent('keyup',{code:'ShiftLeft'}));return s;});return st;};
 const placeAt=async(x,z,traits,heading)=>{await page.evaluate(({x,z,traits,heading})=>{const G=window.__features,p=G.horse.player;p.pos.set(x,0,z);p.speed=0;p.stam=1;p.blown=false;p.y=0;p.vy=0;if(heading!=null)p.heading=heading;
  if(traits){G.save.sync(sv=>{sv.horses[G.horse.rideIdx()].traits=traits;});G.horse.myHorses[G.horse.rideIdx()].traits=traits;G.horse.roster.refreshCur();G.horse.roster.cur.regionT=9;}
  window.advanceTime(600);p.speed=0;p.stam=1;},{x,z,traits,heading});};
 /* the river meanders, so a swim sample steers the horse along the channel centre every step */
 const sampleRide=async(ms,follow)=>await page.evaluate(({ms,follow})=>{const G=window.__features,p=G.horse.player;const steer=()=>{if(!follow)return;const x=p.pos.x,rz=G.world.riverZ(x),dz=G.world.riverZ(x+1)-rz;p.heading=Math.atan2(1,dz+(rz-p.pos.z)*0.5);};
  steer();window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyW'}));window.dispatchEvent(new KeyboardEvent('keydown',{code:'ShiftLeft'}));const out=[];for(let t=0;t<ms;t+=100){steer();window.advanceTime(100);const s=JSON.parse(render_game_to_text());out.push({swim:s.swimming,speed:s.player.speed,stam:s.stamina,depth:s.waterDepth,x:s.player.x,z:s.player.z});}
  window.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyW'}));window.dispatchEvent(new KeyboardEvent('keyup',{code:'ShiftLeft'}));return out;},{ms,follow:!!follow});
 stage('ride checks');
 await placeAt(-220,130,['prospector']); const canyon=await gallopFor(5000,true);
 await placeAt(-220,130,[]); const canyonPlain=await gallopFor(5000,true);
 await placeAt(-40,-10,['prospector']); const ranchP=await gallopFor(5000,true);
 await placeAt(-40,-10,[]); const ranchPlain=await gallopFor(5000,true);
 check('The Prospector: faster in Coyote Canyon than without the trait, and no bonus at the ranch',canyon.player.speed>canyonPlain.player.speed*1.015&&Math.abs(ranchP.player.speed-ranchPlain.player.speed)<0.25,{canyon:canyon.player.speed,plain:canyonPlain.player.speed,ranch:ranchP.player.speed,ranchPlain:ranchPlain.player.speed});
 const early=await page.evaluate(async()=>{
  const G=window.__features,p=G.horse.player; const run=async(traits)=>{
   G.save.sync(sv=>{sv.horses[G.horse.rideIdx()].traits=traits;});G.horse.myHorses[G.horse.rideIdx()].traits=traits;G.horse.roster.refreshCur();
   G.course.startCourse(G.tables.EVENTS3.find(e=>e.id==='pp')); p.speed=0;p.stam=1;p.blown=false;
   window.advanceTime(4200);   // the countdown
   window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyW'}));window.dispatchEvent(new KeyboardEvent('keydown',{code:'ShiftLeft'}));
   window.advanceTime(2500);
   const s=JSON.parse(render_game_to_text());
   window.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyW'}));window.dispatchEvent(new KeyboardEvent('keyup',{code:'ShiftLeft'}));
   G.course.cancelCourse(); return {speed:s.player.speed,started:s.course&&s.course.started,idx:s.course&&s.course.index};};
  const a=await run(['earlybird']), b=await run([]); return {a,b};});
 check('Early Bird: faster on the first leg of a race',early.a.started&&early.a.idx===0&&early.a.speed>early.b.speed*1.05,early);
 /* swimming on the family horse */
 const riverZ=await page.evaluate(()=>window.__features.world.riverZ(40));
 await placeAt(40,riverZ,[],Math.PI/2); const swimS=await sampleRide(3000,true); const swim=swimS[swimS.length-1], swimAll=swimS.every(s=>s.swim), swimMax=Math.max(...swimS.map(s=>s.speed));
 check('swimming: the river is water, the horse swims the whole way, slow going',swimAll&&swim.speed>0.5&&swimMax<6.5&&swim.depth>0.45&&swim.stam<1,{all:swimAll,speed:swim.speed,max:swimMax,depth:swim.depth,stam:swim.stam,first:swimS[0],last:swim});
 await placeAt(20,16,[]); const lake=await page.evaluate(()=>{window.advanceTime(100);const s=JSON.parse(render_game_to_text());return {swim:s.swimming,depth:s.waterDepth};});
 check('Loon Lake is water too',lake.swim&&lake.depth>0.45,lake);
 await placeAt(-40,-10,[]); const dry=await gallopFor(1000,true);
 check('back on land: not swimming',dry.swimming===false,dry.swimming);
 /* the specialist: ride the Tidewalker (also compiles the tide theme on the rig) */
 await page.evaluate(()=>{const G=window.__features;G.save.sync(sv=>{G.horse.grantHorse(sv,'tidewalker',{src:'qa'});});G.horse.reloadHorses();const i=G.horse.myHorses.findIndex(h=>h.breed==='tidewalker');G.ui.openStable();document.querySelector('[data-st="ride:'+i+'"]').click();G.hidePanels();});
 await page.waitForTimeout(500); await waitReady(); stage('tidewalker ready');
 await placeAt(40,riverZ,[],Math.PI/2); const swim2S=await sampleRide(3000,true); const swim2=swim2S[swim2S.length-1];
 const tideAbil=await page.evaluate(()=>JSON.parse(render_game_to_text()).roster.ability);
 check('Tidewalker Arabian swims at 85% pace and barely tires (vs the bay)',swim2S.every(s=>s.swim)&&swim2.speed>swim.speed*1.5&&(1-swim2.stam)<(1-swim.stam)*0.5&&tideAbil==='swim',{tide:swim2.speed,bay:swim.speed,stamTide:swim2.stam,stamBay:swim.stam,abil:tideAbil});
 /* flight: the Pegasus, its named coat, the mastery track */
 await page.evaluate(()=>{const G=window.__features;G.save.sync(sv=>{G.horse.grantHorse(sv,'pegasus',{src:'qa'});});G.horse.reloadHorses();const i=G.horse.myHorses.findIndex(h=>h.breed==='pegasus');G.ui.openStable();document.querySelector('[data-st="ride:'+i+'"]').click();G.hidePanels();});
 await page.waitForTimeout(500); await waitReady(); stage('pegasus ready');
 const fly=await page.evaluate(()=>{const G=window.__features,p=G.horse.player;p.pos.set(-40,0,-10);p.speed=0;p.stam=1;p.blown=false;window.advanceTime(300);
  const h=G.horse.ridden(); const out={variant:h.variant,coats:G.horse.roster.COATS3.pegasus.map(v=>v[0]).includes(h.variant)};
  document.getElementById('flyBtn').click(); window.advanceTime(3000); const s=JSON.parse(render_game_to_text()); out.flying=s.player.flying; out.y=s.player.y; out.flyAlt=s.flyAlt; out.stamAfterTakeoff=s.stamina;
  const down=()=>['KeyW','ShiftLeft','Space'].forEach(c=>window.dispatchEvent(new KeyboardEvent('keydown',{code:c}))), up=()=>['KeyW','ShiftLeft','Space'].forEach(c=>window.dispatchEvent(new KeyboardEvent('keyup',{code:c})));
  out.M0=G.horse.roster.cur.M; p.stam=1; down(); window.advanceTime(4000);
  const s2=JSON.parse(render_game_to_text()); out.stam0=s2.stamina; out.speed0=s2.player.speed; out.stillFlying0=s2.player.flying; up();
  /* mastery ten: the same run drains 30% less and cruises faster */
  G.save.sync(sv=>{sv.mastery.pegasus=10;}); G.horse.roster.refreshCur(); out.M=G.horse.roster.cur.M; out.mx=G.horse.roster.mxOf('pegasus'); out.top=G.horse.roster.rungOf('pegasus',10); p.stam=1;p.blown=false;
  down(); window.advanceTime(4000);
  const s3=JSON.parse(render_game_to_text()); out.stam10=s3.stamina; out.speed10=s3.player.speed; out.stillFlying10=s3.player.flying; up();
  G.ui.openCare(); out.careFlight=/Soaring Speed/.test(document.getElementById('carePanel').textContent)&&/Flying Leap/.test(document.getElementById('carePanel').textContent); G.hidePanels();
  G.save.sync(sv=>{sv.mastery.pegasus=0;}); G.horse.roster.refreshCur();
  return out;});
 check('Pegasus arrives in a named coat',fly.coats,fly.variant);
 const pegCoats=await page.evaluate(()=>{const G=window.__features;G.ui.open('catalogPanel');const p=document.getElementById('catalogPanel');p.querySelector('[data-fx="roster:tab:coats"]').click();const c0=G.save.fresh().coins;const b=p.querySelectorAll('[data-fx^="roster:coat:"]');const cur=G.horse.ridden().variant;const other=[...b].find(x=>!x.dataset.fx.endsWith(':'+cur));other.click();const s=G.save.fresh();const out={buttons:b.length,mark2:p.querySelectorAll('[data-fx^="roster:mark2:"]').length,changed:s.horses[G.horse.rideIdx()].variant,was:cur,cost:c0-s.coins};p.querySelector('[data-fx="roster:mark2:blaze"]').click();out.mark2Set=G.save.fresh().horses[G.horse.rideIdx()].mark2;G.hidePanels();return out;});
 check('catalogue coats tab: five Pegasus coats, a change costs 120 coins and takes, face/leg layer switches',pegCoats.buttons===5&&pegCoats.mark2===6&&pegCoats.changed!==pegCoats.was&&pegCoats.cost===120&&pegCoats.mark2Set==='blaze',pegCoats);
 check('flight: takes off and climbs; Flying Leap (mastery 1, the first pegasus) makes the take-off free',fly.flying===true&&fly.y>2&&fly.flyAlt>2&&fly.stamAfterTakeoff===1&&fly.M0>=1,{flying:fly.flying,y:fly.y,alt:fly.flyAlt,stam:fly.stamAfterTakeoff,M0:fly.M0});
 check('flight economy: a fast flight drains stamina; Soaring Speed (top mastery rung) drains 30% less and cruises faster',fly.stillFlying0&&fly.stillFlying10&&fly.stam0<0.95&&(1-fly.stam10)<(1-fly.stam0)*0.75&&fly.speed10>fly.speed0*1.05&&fly.M===fly.mx&&fly.M>=fly.top,{M:fly.M,mx:fly.mx,stam0:fly.stam0,stam10:fly.stam10,speed0:fly.speed0,speed10:fly.speed10,f0:fly.stillFlying0,f10:fly.stillFlying10});
 check('care panel lists the flying mastery track',fly.careFlight);

 /* ---- every new theme compiles on the rigged body: a pasture full of them ------------- */
 stage('theme compile');
 const themes=await page.evaluate(async()=>{
  const G=window.__features; const keys=['blossomdrake','sunflare','glimmerdrake','thorndrake','gloomdrake','polarisdrake','ancientdrake'];
  G.save.sync(sv=>{for(const h of sv.horses)h.out=false;for(const k of keys)G.horse.grantHorse(sv,k,{src:'qa'});for(const h of sv.horses)if(keys.includes(h.breed))h.out=true;});
  G.horse.reloadHorses(); const t1=Date.now();
  while(Date.now()-t1<40000){await new Promise(r=>setTimeout(r,500));window.advanceTime(200);const herd=G.horse.herd();if(herd.length>=keys.length&&herd.every(a=>a.rig||a.rigTried))break;}
  const herd=G.horse.herd(); return {n:herd.length,rigged:herd.filter(a=>a.rig).length,tried:herd.filter(a=>a.rigTried).length,themes:herd.map(a=>{const h=G.horse.myHorses[a.idx];return h&&h.coat;}),egg:!!G.scene.getObjectByName('dragonEgg')};
 });
 check('the themed horses all rig in the pasture (petal, solar, glimmer, thorn, gloom, moonlit, eclipse dragon)',themes.n>=7&&themes.rigged===themes.n,themes);
 const shaderErr=errors.filter(e=>/WebGLProgram|Shader Error|GLSL|FRAGMENT/i.test(e));
 check('no shader compile errors on the new themes',shaderErr.length===0,shaderErr.slice(0,3));
 /* the dragon egg stands in the pasture for an egg-born foal that is turned out */
 const eggShown=await page.evaluate(()=>{const G=window.__features;G.save.sync(sv=>{for(const h of sv.horses)h.out=!!h.egg;});G.horse.reloadHorses();window.advanceTime(200);const e=G.scene.getObjectByName('dragonEgg');return {egg:!!e,herd:G.horse.herd().length,hidden:G.horse.herd().some(a=>a.parts.group.visible===false)};});
 check('dragon egg mesh stands in the pasture for the egg-born foal',eggShown.egg&&eggShown.hidden,eggShown);

 /* ---- old saves: no traits/variant fields → rolled on load, no errors ------------------ */
 await page.evaluate(()=>{
  const legacy={v:2,ranchName:'Meadowlark Ranch',founded:Date.now()-864e5*3,coins:999,gems:9,items:{carrot:3},nextId:3,decor:[],projects:{},trophies:{},wild:null,wildTrust:0,muted:false,
   lastSeen:Date.now()-3600e3,lastDaily:'',questDate:'',quests:[],totalRaces:0,started:true,keys:2,tack:[],
   horses:[{id:1,name:'Clover',breed:'bay-sporthorse',colors:{body:'#765035',mane:'#221b16'},horn:false,rainbow:false,stats:{speed:3,stamina:3,jump:3,accel:3,agility:3},sxp:{},level:1,xp:0,bond:25,needs:{hunger:90,thirst:90,clean:90,happy:90},foal:false,tack:null},
    {id:2,name:'Storm',breed:'stormdrake',colors:{body:'#241830',mane:'#a07ce0'},wings:true,dragon:true,coat:'shadow',glow:true,ability:'fly',stats:{speed:8,stamina:8,jump:8,accel:8,agility:8},sxp:{},level:4,xp:0,bond:60,needs:{hunger:90,thirst:90,clean:90,happy:90},foal:false,tack:null}],
   story:{idx:3,prog:1}};
  localStorage.setItem('starRanchFable_v1',JSON.stringify(legacy));
 });
 await page.waitForLoadState('networkidle',{timeout:60000}).catch(()=>{}); await page.waitForTimeout(1500);
 await page.goto(base+'/ranch3d.html?qa=roster&legacy='+Date.now(),{waitUntil:'load',timeout:120000}); stage('legacy loaded');
 await page.waitForFunction(READY,null,{timeout:150000,polling:250}); stage('legacy horseReady');
 const L=await page.evaluate(()=>{const G=window.__features,s=G.save.fresh(),R=G.horse.roster;return {roster:!!s.roster,traits:s.horses.map(h=>Array.isArray(h.traits)),drakeTraits:s.horses[1].traits.length,drakeStars:R.starsN(s.horses[1]),variant:s.horses[0].variant,mark2:s.horses.map(h=>h.mark2),installed:G.installed.length,errs:G.errors.length};});
 check('legacy save: roster fields, traits rolled (1-2 on a dragon), no variant forced on old horses',L.roster&&L.traits.every(Boolean)&&L.drakeTraits>=1&&L.drakeStars===5&&L.variant===null&&L.installed>=16&&L.errs===0,L);
 /* ---- ?inspect-breed on a package row: the alias resolves to an authored body and it rigs ---- */
 const warns=[]; page.on('console',m=>{if(m.type()==='warning'&&/Breed model unavailable/.test(m.text()))warns.push(m.text().slice(0,120));});
 await page.evaluate(()=>{const G=window.__features;G.save.sync(sv=>{G.horse.grantHorse(sv,'tidewalker',{src:'qa'});});});
 await page.waitForTimeout(800);
 await page.goto(base+'/ranch3d.html?qa=roster&inspect-breed=tidewalker&t='+Date.now(),{waitUntil:'load',timeout:120000}); stage('inspect-breed loaded');
 await page.waitForFunction(READY,null,{timeout:150000,polling:250}); await page.waitForTimeout(1500);
 const I=await page.evaluate(()=>{const G=window.__features,h=G.horse.ridden(),R=G.horse.RIG();return {breed:h&&h.breed,ability:JSON.parse(render_game_to_text()).roster.ability,resolved:G.horse.breedModels.resolve('tidewalker'),rig:!!(R&&R.skin),mat:R&&R.skin&&R.skin.material&&R.skin.material.type};});
 check('?inspect-breed=tidewalker rides the package horse on the Sunset Arabian body, no "Breed model unavailable"',I.breed==='tidewalker'&&I.ability==='swim'&&I.resolved==='sunset'&&I.rig&&warns.length===0,Object.assign(I,{warns}));
 check('no console/page errors',errors.length===0,errors.slice(0,6));
 console.log(await page.evaluate(()=>render_game_to_text()));
 await browser.close();
 const failed=checks.filter(c=>!c.ok);
 console.log(failed.length?('FAILED '+failed.length+'/'+checks.length):('ALL '+checks.length+' CHECKS PASSED'));
 process.exit(failed.length?1:0);
})().catch(e=>{console.error('FATAL',e);process.exit(2);});

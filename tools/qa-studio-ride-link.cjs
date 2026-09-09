/* Isolated existing-save test: Studio link -> adopt/select -> reload/repeat. */
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path');
const out=path.resolve(process.argv[2]||'output/studio-ride-link-qa');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--use-angle=d3d11']}),page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[],failed=[];
 let generation=0;const requestGenerations=new Map();
 page.on('request',r=>requestGenerations.set(r,generation));
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('requestfailed',r=>failed.push({url:r.url(),error:r.failure()?.errorText,startedGeneration:requestGenerations.get(r),failedGeneration:generation,navigationCancelled:r.failure()?.errorText==='net::ERR_ABORTED'&&requestGenerations.get(r)<generation}));
 await page.goto('http://127.0.0.1:8431/breeds.html?horse=hero&review=ride-link');
 await page.waitForFunction(()=>window.render_game_to_text&&JSON.parse(render_game_to_text()).breed==='hero'&&!JSON.parse(render_game_to_text()).loading,null,{timeout:90000});
 const seed=await page.evaluate(()=>{
  const horse=(id,name,breed)=>({id,name,breed,colors:{body:'#875335',mane:'#241a12'},horn:false,wings:false,dragon:false,coat:null,stats:{speed:3,stamina:3,jump:3,accel:3,agility:3},sxp:{},gear:{},level:2,xp:15,bond:45,needs:{hunger:90,thirst:90,clean:90,happy:90},foal:false,tack:null});
  const s={v:2,ranchName:'Existing QA Ranch',founded:Date.now()-86400000,coins:4321,gems:17,items:{carrot:10,apple:2,hay:3},nextId:12,horses:[horse(7,'Existing Clover','bay'),horse(11,'Existing Rowan','shire')],decor:[],projects:{},trophies:{},wild:null,wildTrust:0,muted:true,lastSeen:Date.now(),lastDaily:new Date().toDateString(),streakLast:new Date().toDateString(),streakN:1,questDate:'',quests:[],totalRaces:0,started:true,tack:[],keys:1,ridingHorseId:7};
  localStorage.setItem('starRanchFable_v1',JSON.stringify(s));localStorage.setItem('mlrHinted','1');return s;
 });
 const rideVisible=await page.locator('#ride').isVisible(),href=await page.locator('#ride').getAttribute('href');
 await page.locator('[data-key="shire"]').click();await page.waitForFunction(()=>JSON.parse(render_game_to_text()).breed==='shire'&&!JSON.parse(render_game_to_text()).loading);const hiddenForEarlier=await page.locator('#ride').isHidden();
 await page.locator('[data-key="hero"]').click();await page.waitForFunction(()=>JSON.parse(render_game_to_text()).breed==='hero'&&!JSON.parse(render_game_to_text()).loading);generation++;await page.click('#ride');
 const ready=()=>page.waitForFunction(()=>window.render_game_to_text&&JSON.parse(render_game_to_text()).horse?.breed==='bay-sporthorse'&&JSON.parse(render_game_to_text()).graphics.horseModel==='bay-sporthorse'&&!JSON.parse(render_game_to_text()).graphics.horseLoading,null,{timeout:120000});
 const snap=()=>page.evaluate(()=>({state:JSON.parse(render_game_to_text()),save:JSON.parse(localStorage.getItem('starRanchFable_v1')),url:location.href}));
 await ready();await page.waitForLoadState('networkidle',{timeout:30000});const adopted=await snap();await page.screenshot({path:path.join(out,'riding-approved-horse.png')});
 await page.click('#stableBtn');await page.screenshot({path:path.join(out,'existing-stable-plus-hero.png')});
 generation++;await page.reload({waitUntil:'domcontentloaded',timeout:120000});await ready();await page.waitForLoadState('networkidle',{timeout:30000});const reloaded=await snap();
 generation++;await page.goto('http://127.0.0.1:8431/breeds.html?horse=hero&review=ride-repeat');await page.waitForFunction(()=>window.render_game_to_text&&JSON.parse(render_game_to_text()).breed==='hero'&&!JSON.parse(render_game_to_text()).loading,null,{timeout:90000});generation++;await page.click('#ride');await ready();await page.waitForLoadState('networkidle',{timeout:30000});const repeated=await snap();
 const oneHero=s=>s.horses.filter(h=>h.breed==='bay-sporthorse'&&!h.foal).length===1;
 const preserved=s=>seed.horses.every(h=>s.horses.some(n=>n.id===h.id&&n.name===h.name&&n.breed===h.breed&&n.level===h.level));
 const chosen=s=>s.horses.find(h=>h.id===s.ridingHorseId)?.breed==='bay-sporthorse';
 const checks={rideVisible,hiddenForEarlier,correctLink:href.includes('adopt=bay-sporthorse'),approvedModel:adopted.state.graphics.horseModel==='bay-sporthorse'&&adopted.state.graphics.horseAttached,
  appendedOne:adopted.save.horses.length===seed.horses.length+1&&oneHero(adopted.save),existingHorsesPreserved:[adopted,reloaded,repeated].every(r=>preserved(r.save)),
  noCost:[adopted,reloaded,repeated].every(r=>r.save.coins===seed.coins&&r.save.gems===seed.gems),selectionPersists:[adopted,reloaded,repeated].every(r=>chosen(r.save)),
  noDuplicates:[reloaded,repeated].every(r=>r.save.horses.length===adopted.save.horses.length&&oneHero(r.save)),sameSelectedId:adopted.save.ridingHorseId===reloaded.save.ridingHorseId&&adopted.save.ridingHorseId===repeated.save.ridingHorseId,
  queryConsumed:[adopted,reloaded,repeated].every(r=>!new URL(r.url).searchParams.has('adopt')),noApplicationErrors:errors.length===0};
 const report={checks,pass:Object.values(checks).every(Boolean),seed,adopted,reloaded,repeated,errors,failed};fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({checks,pass:report.pass,errors,failed},null,2));await browser.close();if(!report.pass)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});

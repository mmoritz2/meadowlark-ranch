// Isolated save/identity/async-selection regression test. Never opens user browser data.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path');
const out=path.resolve('output/hero-compat-qa');fs.mkdirSync(out,{recursive:true});
const fields=['id','name','breed','colors','horn','wings','dragon','coat','stats','sxp','gear','level','xp','bond','foal','tack'];
const projection=h=>Object.fromEntries(fields.map(k=>[k,h[k]]));
const horse=(id,name,breed,body,mane,extra={})=>({id,name,breed,colors:{body,mane},horn:false,wings:false,dragon:false,coat:null,stats:{speed:5,stamina:4,jump:6,accel:3,agility:4},sxp:{speed:9},gear:{},level:5,xp:17,bond:63,needs:{hunger:90,thirst:90,clean:90,happy:90},foal:false,tack:null,out:false,...extra});
const seed={v:2,ranchName:'Compatibility QA',founded:Date.now(),coins:713,gems:29,items:{carrot:10,apple:2,hay:3},nextId:44,horses:[horse(41,'Original Bay','bay','#8a5a2b','#332214'),horse(42,'Original Draft','shire','#3a3530','#1d1a17'),horse(43,'Original Ember','emberdrake','#3a1410','#ff8a3a',{wings:true,dragon:true,coat:'fire'})],ridingHorseId:42,quality:'low',decor:[],projects:{},trophies:{},wild:null,wildTrust:0,muted:true,lastSeen:Date.now(),lastDaily:new Date().toDateString(),questDate:'',quests:[],totalRaces:0,started:true,tack:[],keys:1};
const injection=`window.__compatQA={THREE,RIG,player,BREED_MODELS,scene,camera,renderer,composer,rigCalibrate,poseRigBones,initGameHero,
 select:key=>{const i=myHorses.findIndex(h=>h.breed===key);if(i<0)throw Error('Unknown owned horse '+key);sel.value=String(i);sel.onchange();},
 adopt:adoptBaySporthorse,
 saved:()=>freshSave(),
 state:()=>({breed:myHorses[rideIdx].breed,id:myHorses[rideIdx].id,model:RIG.modelKey,requested:RIG.requestedBreed,loading:RIG.loadingBreed,ready:RIG.ready,hero:!!RIG.profile?.hero,heroMotion:!!RIG.heroMotion,bones:RIG.bones?.length,wingCount:player.parts.wings?.length||0,wingVisible:player.parts.wings?.every(w=>w.visible),breathDisplay:document.getElementById('breathBtn').style.display,finite:RIG.bones?.every(b=>b.matrixWorld.elements.every(Number.isFinite))}),
 view:()=>{dayT=.34;weather.mode='clear';weather.timer=9999;player.pos.set(0,0,8);player.heading=Math.PI;advanceTime(16);const h=groundH(player.pos.x,player.pos.z);camera.position.set(player.pos.x+4.2,h+2.1,player.pos.z+3.5);camera.lookAt(player.pos.x,h+1.1,player.pos.z);composer.render();}
};const MERGE_STATS=mergeStatics();`;
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--use-angle=d3d11','--disable-background-timer-throttling']});
 const context=await browser.newContext({viewport:{width:1280,height:900}});
 const page=await context.newPage(),errors=[],warnings=[],requests=[];
 const report={checks:{},states:{},errors,warnings,requests};
 page.on('pageerror',e=>{errors.push(e.message);console.log('PAGE ERROR',e.message)});
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());if(m.type()==='warning')warnings.push(m.text());});
 await context.addInitScript(s=>{if(!localStorage.getItem('__compatSeed')){localStorage.setItem('starRanchFable_v1',JSON.stringify(s));localStorage.setItem('__compatSeed','1');}},seed);
 await page.route('**/ranch3d.html*',r=>r.fulfill({contentType:'text/html',body:fs.readFileSync('ranch3d.html','utf8').replace('const MERGE_STATS=mergeStatics();',injection)}));
 await page.route('**/models/hero-horse/*.glb*',async r=>{requests.push({url:r.request().url(),delayedMs:900});await new Promise(f=>setTimeout(f,900));await r.continue();});
 const ready=async key=>{await page.waitForFunction(k=>window.__compatQA?.state().breed===k&&__compatQA.state().ready&&!__compatQA.state().loading&&__compatQA.state().requested===k,null===key?null:key,{timeout:120000,polling:100});await page.evaluate(()=>advanceTime(16));return page.evaluate(()=>__compatQA.state());};
 try{
  await page.goto('http://127.0.0.1:8431/ranch3d.html?qa=hero-compat',{waitUntil:'load',timeout:120000});
  report.states.initial=await ready('shire');
  const savedInitial=await page.evaluate(()=>__compatQA.saved());
  report.checks.existingStableUnchanged=JSON.stringify(savedInitial.horses.map(projection))===JSON.stringify(seed.horses.map(projection));
  report.checks.savedSelectionRestored=report.states.initial.id===42&&report.states.initial.model==='shire';
  report.identity=await page.evaluate(async()=>{const l=__compatQA.BREED_MODELS;await l.manifestReady;return {catalogCount:Object.keys(l.manifest.breeds).length,catalogIncludesHero:Object.hasOwn(l.manifest.breeds,'bay-sporthorse'),resolved:Object.fromEntries(['bay','shire','emberdrake','bay-sporthorse'].map(k=>[k,l.resolve(k)]))};});
  report.checks.separateHeroIdentity=report.identity.catalogCount===24&&!report.identity.catalogIncludesHero&&JSON.stringify(report.identity.resolved)===JSON.stringify({bay:'bay',shire:'shire',emberdrake:'legacy','bay-sporthorse':'bay-sporthorse'});
  await page.evaluate(()=>__compatQA.select('bay'));report.states.bay=await ready('bay');
  report.checks.oldBayPreserved=report.states.bay.model==='bay'&&!report.states.bay.hero&&!report.states.bay.heroMotion;
  report.adoptionTransaction=await page.evaluate(()=>{const before=__compatQA.saved();__compatQA.adopt();const after=__compatQA.saved();__compatQA.select('bay');__compatQA.select('emberdrake');return {before:{coins:before.coins,gems:before.gems,count:before.horses.length},after:{coins:after.coins,gems:after.gems,count:after.horses.length}};});
  report.states.raceLatest=await ready('emberdrake');
  await page.waitForFunction(()=>!!__compatQA.BREED_MODELS.get('bay-sporthorse'),null,{timeout:120000,polling:100});
  await page.waitForTimeout(150);
  report.states.raceAfterHeroLoaded=await page.evaluate(()=>__compatQA.state());
  report.checks.latestSelectionWins=report.states.raceAfterHeroLoaded.breed==='emberdrake'&&report.states.raceAfterHeroLoaded.model==='legacy'&&!report.states.raceAfterHeroLoaded.heroMotion;
  report.checks.dragonKeepsIdentity=report.states.raceAfterHeroLoaded.wingCount===2&&report.states.raceAfterHeroLoaded.wingVisible&&report.states.raceAfterHeroLoaded.breathDisplay!=='none';
  await page.evaluate(()=>__compatQA.view());await page.screenshot({path:path.join(out,'old-dragon.png')});
  await page.evaluate(()=>__compatQA.select('bay-sporthorse'));report.states.hero=await ready('bay-sporthorse');
  report.checks.heroUsesNewRig=report.states.hero.model==='bay-sporthorse'&&report.states.hero.hero&&report.states.hero.heroMotion&&report.states.hero.bones===33;
  report.isolation=await page.evaluate(()=>{
   const {BREED_MODELS:l,rigCalibrate,poseRigBones,THREE,RIG}=__compatQA;
   return ['bay','bay-sporthorse','legacy'].map(key=>{
    const asset=l.get(key),a=l.instantiate(asset),b=l.instantiate(asset),baseline=b.bones.map(b=>b.quaternion.toArray()),cached=asset.skin.skeleton.bones.map(b=>b.quaternion.toArray());
    rigCalibrate(a);rigCalibrate(b);a.bones[5].rotation.x+=.5;a.scene.updateMatrixWorld(true);
    const result={key,separate:a.bones.every((x,i)=>x!==b.bones[i]),unchanged:baseline.every((q,i)=>q.every((v,j)=>v===b.bones[i].quaternion.toArray()[j])),cachedUnchanged:cached.every((q,i)=>q.every((v,j)=>v===asset.skin.skeleton.bones[i].quaternion.toArray()[j])),geometryShared:a.skin.geometry===b.skin.geometry,calibrationIndependent:a.legs!==RIG.legs&&b.legs!==RIG.legs&&a.legs!==b.legs};
    for(const root of[a.scene,b.scene]){const skeletons=new Set();root.traverse(o=>{if(o.skeleton)skeletons.add(o.skeleton)});skeletons.forEach(s=>s.dispose());}
    return result;
   });
  });
  report.checks.independentSkeletons=report.isolation.every(x=>x.separate&&x.unchanged&&x.cachedUnchanged&&x.calibrationIndependent);
  const afterAdopt=await page.evaluate(()=>__compatQA.saved());
  report.checks.adoptionPreservesOldHorses=JSON.stringify(afterAdopt.horses.filter(h=>h.id<44).map(projection))===JSON.stringify(seed.horses.map(projection));
  report.checks.adoptionAddsOneFree=afterAdopt.horses.length===4&&report.adoptionTransaction.before.coins===report.adoptionTransaction.after.coins&&report.adoptionTransaction.before.gems===report.adoptionTransaction.after.gems&&afterAdopt.horses.at(-1).breed==='bay-sporthorse';
  await page.evaluate(()=>{__compatQA.adopt();__compatQA.select('shire');});report.states.selectedOldAfterHero=await ready('shire');
  await page.reload({waitUntil:'load',timeout:120000});report.states.reloadedOld=await ready('shire');
  report.checks.oldSelectionPersistsAfterHero=report.states.reloadedOld.id===42&&report.states.reloadedOld.model==='shire'&&!report.states.reloadedOld.hero;
  report.savedFinal=await page.evaluate(()=>__compatQA.saved());
  report.checks.repeatAdoptionDoesNotDuplicate=report.savedFinal.horses.length===4;
  report.checks.allStatesFinite=Object.values(report.states).every(s=>s.finite&&s.bones===33);
  report.checks.noErrors=!errors.length;
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({checks:report.checks,states:report.states,isolation:report.isolation,errors,warnings: warnings.length},null,2));
 }finally{await browser.close();}
 if(Object.values(report.checks).some(v=>!v))process.exitCode=1;
})().catch(e=>{console.error(e);process.exit(1);});

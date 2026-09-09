// Isolated browser fixture: never connects to the user's browser or saved stable.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path');
const out=path.resolve(process.argv[2]||'output/artist-ranch-qa');fs.mkdirSync(out,{recursive:true});
const flightOnly=process.argv.includes('--flight-only');
const injection=`window.__artistQA={THREE,RIG,player,TACK,BREED_MODELS,scene,renderer,camera,composer,
 roster:()=>BREEDS3.map(b=>({id:b[0],name:b[1],options:b[7]})),
 select(key){const b=BREEDS3.find(b=>b[0]===key);if(!b)throw Error(key);Object.assign(myHorses[0],{breed:key,colors:{body:b[5],mane:b[6]},horn:false,wings:false,dragon:false,coat:null,rainbow:false,...b[7]});sel.value='0';sel.onchange();},
 start(){dayT=.34;weather.mode='clear';weather.timer=9999;player.pos.set(-3,0,-3);player.heading=0;player.speed=0;player.y=0;player.vy=0;},
 view(){const h=groundH(player.pos.x,player.pos.z)+player.y;camera.position.set(player.pos.x+4.6,h+2.6,player.pos.z+3.2);camera.lookAt(player.pos.x,h+1.4,player.pos.z);composer.render();},
 state(){const head=RIG.bones?.find(b=>b.name==='head');return {breed:myHorses[rideIdx].breed,model:RIG.modelKey,requested:RIG.requestedBreed,loading:RIG.loadingBreed,ready:RIG.ready,artist:!!RIG.profile?.artistBreed,file:RIG.profile?.file,bones:RIG.bones?.length,bodyName:RIG.skin?.name,rotation:RIG.scene?.rotation.toArray(),finite:RIG.bones?.every(b=>b.matrixWorld.elements.every(Number.isFinite)),groom:RIG.groom?.stats,motion:RIG.heroMotion?.mode||RIG.artistMotion?.mode,feet:(RIG.heroMotion||RIG.artistMotion)?.snapshot().feet,gameY:player.y,ground:groundH(player.pos.x,player.pos.z),seat:TACK.saddle?.position.toArray(),rider:player.rider?.g.position.toArray(),bridle:TACK.bridle?.position.toArray(),head:head?player.mesh.worldToLocal(head.getWorldPosition(new THREE.Vector3())).toArray():null,wingCount:player.parts.wings?.length||0,horn:!!player.parts.horn?.visible,breath:document.getElementById('breathBtn').style.display!=='none'};}
};const MERGE_STATS=mergeStatics();`;
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--use-angle=d3d11','--disable-background-timer-throttling']});
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],warnings=[],states=[],checks={},requests=[];
 const report={checks,errors,warnings,states,requests};
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());if(m.type()==='warning')warnings.push(m.text());});
 page.on('request',r=>{if(/\.glb(?:\?|$)/.test(r.url()))requests.push(r.url());});
 await page.route('**/ranch3d.html*',r=>r.fulfill({contentType:'text/html',body:fs.readFileSync('ranch3d.html','utf8').replace('const MERGE_STATS=mergeStatics();',injection)}));
 const ready=async key=>{await page.waitForFunction(k=>window.__artistQA?.state().ready&&!__artistQA.state().loading&&(!k||__artistQA.state().breed===k)&&(!k||__artistQA.state().requested===k),key,{timeout:120000});await page.evaluate(()=>advanceTime(16));return page.evaluate(()=>__artistQA.state());};
 const capture=async name=>{await page.evaluate(()=>__artistQA.view());await page.screenshot({path:path.join(out,name+'.png')});};
 try{
  await page.goto('http://127.0.0.1:8431/ranch3d.html?qa=artist-breeds',{waitUntil:'load',timeout:120000});await ready();await page.evaluate(()=>{__artistQA.start();advanceTime(200);});
  report.initialSave=await page.evaluate(()=>{const s=JSON.parse(localStorage.starRanchFable_v1);return{count:s.horses.length,coins:s.coins,gems:s.gems,id:s.ridingHorseId};});
  report.roster=await page.evaluate(()=>__artistQA.roster());
  for(const breed of report.roster.filter(b=>!flightOnly||b.id==='emberdrake')){
   await page.evaluate(key=>__artistQA.select(key),breed.id);await ready(breed.id);await page.evaluate(()=>advanceTime(180));const state=await page.evaluate(()=>__artistQA.state());states.push(state);
   checks[breed.id+' uses artist rig']=state.artist&&state.bones===40&&state.finite&&!state.loading;
   checks[breed.id+' exact identity']=state.model===breed.id;
   checks[breed.id+' forward orientation']=Math.abs(state.rotation[1])<1e-6;
   if(breed.options.wings)checks[breed.id+' wings']=state.wingCount===2;
   if(breed.options.horn)checks[breed.id+' horn']=state.horn;
   if(breed.options.dragon)checks[breed.id+' breath']=state.breath;
   if(['bay-sporthorse','chestnut','black','vanner','fjord','shire','unicorn','pegasus','emberdrake','eclipse'].includes(breed.id))await capture(breed.id+'-mounted');
   console.log(breed.id,JSON.stringify({model:state.model,artist:state.artist,bones:state.bones,motion:state.motion}));
  }
  await page.evaluate(()=>{__artistQA.select('bay-sporthorse');__artistQA.start();});await ready('bay-sporthorse');
  report.motion=[];
  const motionCapture=async name=>{report.motion.push({name,...await page.evaluate(()=>__artistQA.state())});await capture(name);};
  await page.keyboard.down('ArrowUp');await page.evaluate(()=>advanceTime(900));await motionCapture('ride-canter');
  await page.keyboard.down('Shift');await page.evaluate(()=>advanceTime(1400));await motionCapture('ride-gallop');await page.keyboard.up('Shift');await page.keyboard.up('ArrowUp');await page.evaluate(()=>advanceTime(2000));
  await page.keyboard.down('Space');await page.evaluate(()=>advanceTime(180));await page.keyboard.up('Space');await page.evaluate(()=>advanceTime(500));await motionCapture('ride-jump');await page.evaluate(()=>advanceTime(2000));await motionCapture('ride-landed');
  checks.canGallop=report.motion.some(s=>s.motion==='gallop');checks.jumps=report.motion.find(s=>s.name==='ride-jump').gameY>.6;checks.lands=report.motion.at(-1).gameY===0;checks.motionFinite=report.motion.every(s=>s.finite);
  await page.evaluate(()=>{__artistQA.select('emberdrake');__artistQA.start();});await ready('emberdrake');
  await page.click('#flyBtn');await page.keyboard.down('ArrowUp');await page.evaluate(()=>advanceTime(2000));await page.keyboard.up('ArrowUp');
  report.flight=await page.evaluate(()=>({flying:__artistQA.player.flying,y:__artistQA.player.y,open:__artistQA.player.parts.wings[0].userData.open,...__artistQA.state()}));await capture('dragon-flight');
  checks.dragonFlies=report.flight.flying&&report.flight.y>1&&report.flight.open>.8&&report.flight.finite&&report.flight.artist;
  await page.keyboard.down('b');await page.evaluate(()=>advanceTime(350));await page.keyboard.up('b');await capture('dragon-breath');
  await page.click('#flyBtn');await page.evaluate(()=>advanceTime(6000));report.flightLanding=await page.evaluate(()=>({flying:__artistQA.player.flying,y:__artistQA.player.y,finite:__artistQA.state().finite}));checks.dragonLands=!report.flightLanding.flying&&report.flightLanding.y===0&&report.flightLanding.finite;
  report.finalSave=await page.evaluate(()=>{const s=JSON.parse(localStorage.starRanchFable_v1);return{count:s.horses.length,coins:s.coins,gems:s.gems,id:s.ridingHorseId};});
  checks.stableCountPreserved=report.initialSave.count===report.finalSave.count;checks.selectedIdPreserved=report.initialSave.id===report.finalSave.id;
  checks.rosterComplete=states.length===(flightOnly?1:45);checks.noRejectedHorseDownloads=requests.filter(u=>u.includes('/models/')&&!u.includes('rider')).every(u=>u.includes('/artist-breeds/')||!/(horse_showcase|hero-horse|\/breeds\/)/.test(u));
  checks.noErrors=errors.length===0;
 }catch(e){report.failure=e.stack;console.error(e);checks.completed=false;}
 finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));await browser.close();}
 console.log(JSON.stringify({checks,errors,warnings}));if(Object.values(checks).some(v=>!v))process.exitCode=1;
})();

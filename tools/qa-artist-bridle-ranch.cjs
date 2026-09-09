// Actual ranch integration in an isolated browser, without touching user saves.
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path');
const out=path.resolve(process.argv[2]||'output/artist-bridle-ranch');fs.mkdirSync(out,{recursive:true});
const injection=`window.__bridleQA={
 select(key){const h=myHorses[0],b=BREEDS3.find(b=>b[0]===key),o=b[7]||{};Object.assign(h,{breed:key,colors:{body:b[5],mane:b[6]},horn:!!o.horn,wings:!!o.wings,dragon:!!o.dragon,coat:o.coat||null,foal:false});delete h.mark;delete h.markCol;delete h.tailCol;sel.value='0';sel.onchange();},
 setup(){advanceTime(0);player.pos.set(0,0,0);player.y=0;player.speed=0;player.heading=0;player.mesh.position.set(0,0,0);player.mesh.rotation.set(0,0,0);hidePanels();scene.children.forEach(o=>o.visible=o.isLight||o===player.mesh||o===reinL||o===reinR);scene.background=new THREE.Color('#d4d9d2');scene.fog.density=0;dayT=.34;},
 pose(gait){RIG.heroMotion.reset();RIG.heroJumpAge=null;const speed={stand:0,walk:1.25,trot:3.25,canter:4.7,gallop:7.35,jump:0}[gait];if(gait==='jump')startGameHeroJump(RIG);for(let i=0;i<40;i++){driveRig(speed,true,i/80,1/80);driveRider(speed,i/80);}player.mesh.updateMatrixWorld(true);},
 view(angle){scene.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(TACK.bridle),target=box.getCenter(new THREE.Vector3()),height=box.getSize(new THREE.Vector3()).y;camera.fov=32;camera.updateProjectionMatrix();const dir=new THREE.Vector3(angle==='front'?0:angle==='side'?1:1,.07,angle==='side'?0:angle==='front'?1:.95).normalize();camera.position.copy(target).addScaledVector(dir,Math.max(1,height*2.9));camera.lookAt(target);renderer.render(scene,camera);},
 state(){if(!RIG.ready||RIG.loadingBreed||!TACK.bridle)return {ready:false,breed:RIG.modelKey};scene.updateMatrixWorld(true);const br=TACK.bridle,h=RIG.bones.find(b=>b.name==='head');let matrixError=0,bitError=0;for(let i=0;i<16;i++)matrixError=Math.max(matrixError,Math.abs(br.matrixWorld.elements[i]-h.matrixWorld.elements[i]));for(const [i,bit] of [TACK.bitL,TACK.bitR].entries())bitError=Math.max(bitError,bit.getWorldPosition(new THREE.Vector3()).distanceTo(br.localToWorld(br.userData.bitOffsets[i].clone())));return{breed:RIG.modelKey,ready:RIG.ready&&!RIG.loadingBreed,artistBridle:!!br.userData.artistBridle,matrixError,bitError,finite:br.children.every(o=>!o.geometry||Array.from(o.geometry.attributes.position.array).every(Number.isFinite)),fallbackRays:br.userData.fit?.fallbackRays,mode:RIG.heroMotion?.mode};}
};const MERGE_STATS=mergeStatics();`;
(async()=>{let browser;const report={checks:{},errors:[],states:[]};
 try{
  browser=await chromium.launch({headless:!process.argv.includes('--headed'),args:['--use-angle=d3d11']});const page=await browser.newPage({viewport:{width:1000,height:850}});
  page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
  await page.addInitScript(()=>addEventListener('error',e=>{window.__qaStartupError=e.message;}));
  await page.route('**/ranch3d.html*',r=>r.fulfill({contentType:'text/html',body:fs.readFileSync('ranch3d.html','utf8').replace('const MERGE_STATS=mergeStatics();',injection)}));
  await page.goto('http://127.0.0.1:8431/ranch3d.html?qa=bridle',{waitUntil:'load',timeout:90000});
  const ready=async key=>{await page.waitForFunction(k=>window.__qaStartupError||window.__bridleQA&&__bridleQA.state().ready&&(!k||__bridleQA.state().breed===k),key,{timeout:60000});const error=await page.evaluate(()=>window.__qaStartupError);if(error)throw Error(error);};await ready();
  await page.addStyleTag({content:'body>div,body>nav{visibility:hidden!important}'});
  for(const key of (process.env.BRIDLE_KEYS||'bay-sporthorse,thoro,chestnut,grey,shire,amethyst').split(',')){
   await page.evaluate(k=>__bridleQA.select(k),key);await ready(key);await page.evaluate(()=>__bridleQA.setup());
   for(const gait of key==='thoro'?['stand','walk','trot','canter','gallop','jump']:['stand']){
    await page.evaluate(g=>__bridleQA.pose(g),gait);const state=await page.evaluate(()=>__bridleQA.state());report.states.push({...state,gait});report.checks[key+'_'+gait]=state.artistBridle&&state.finite&&state.matrixError<1e-5&&state.bitError<1e-5;
    for(const angle of gait==='stand'?['side','front','quarter']:['quarter']){await page.evaluate(a=>__bridleQA.view(a),angle);await page.screenshot({path:path.join(out,key+'-'+gait+'-'+angle+'.png')});}
   }
  }
  report.checks.noErrors=report.errors.length===0;
 }catch(e){report.failure=e.stack;report.checks.completed=false;console.error(e);}
 finally{if(browser)await browser.close();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));}
 console.log(JSON.stringify(report));if(Object.values(report.checks).some(v=>!v))process.exitCode=1;
})();

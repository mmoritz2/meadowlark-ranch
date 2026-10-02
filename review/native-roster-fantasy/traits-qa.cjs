const QA=require('../../tools/qa-platform.cjs'),assert=require('assert/strict'),fs=require('fs');
(async()=>{const browser=await QA.chromium.launch({headless:true,args:QA.gpuArgs()}),page=await browser.newPage({viewport:{width:1200,height:850}}),errors=[],rows=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
try{
 await page.goto(QA.BASE+'/ranch3d.html?qa=native-traits',{timeout:120000});await page.waitForFunction(()=>window.__features?.installed?.includes('native-horses'),null,{timeout:90000});
 for(const [key,traits] of [['bay',{wings:true}],['unicorn',{horn:false}],['pegasus',{horn:true}]]){
  const index=await page.evaluate(key=>{const G=__features;G.save.sync(s=>G.horse.grantHorse(s,key,{name:'Trait QA'}));G.horse.reloadHorses();G.horse.rebuildAll();G.hidePanels();return G.horse.myHorses.findIndex(h=>h.breed===key)},key);
  await page.selectOption('#horseSel',String(index),{force:true});await page.waitForFunction(key=>__features.horse.RIG().modelKey===key&&__features.horse.RIG().attachedTo===__features.horse.player.mesh,key,{timeout:90000});
  const report=await page.evaluate(async({key,traits})=>{const G=__features,r=G.horse.RIG(),h=G.horse.ridden(),{syncNativeHorseFantasy}=await import('/assets/native-horse-fantasy.js?v=native-roster-1');
   const old=r.nativeFantasy,oldRoot=old?.horn||old?.wingMount;Object.assign(h,traits);syncNativeHorseFantasy({THREE:G.THREE,rig:r,horse:h});G.horse.applyCoat();
   const current=r.nativeFantasy,mat=r.skin.material,materialCount=r.materials.length;for(let i=0;i<5;i++)syncNativeHorseFantasy({THREE:G.THREE,rig:r,horse:h});
   return{key,bones:r.bones.length,horn:!!current?.horn,wings:!!current?.pair,oldRemoved:!oldRoot||!oldRoot.parent,sameController:r.nativeFantasy===current,sameMaterial:r.skin.material===mat,materialCount,afterCount:r.materials.length,bodyMaterial:r.skin.material.name};
  },{key,traits});
  assert.equal(report.bones,677);assert.equal(report.horn,key==='pegasus');assert.equal(report.wings,key!=='unicorn');assert(report.oldRemoved&&report.sameController&&report.sameMaterial);assert.equal(report.materialCount,report.afterCount);
  if(key==='bay'){await page.keyboard.down('Space');await page.evaluate(()=>advanceTime(100));await page.keyboard.up('Space');await page.evaluate(()=>advanceTime(1500));report.flight=await page.evaluate(()=>{const G=__features,r=G.horse.RIG();return{flying:G.horse.player.flying,open:r.nativeFantasy.openness,visible:r.nativeFantasy.pair.every(w=>w.visible&&w.parent.visible)}});assert(report.flight.flying&&report.flight.open>.9&&report.flight.visible);}
  rows.push(report);console.log(report);
 }
 assert.equal(errors.length,0,errors.join('\n'));
}finally{fs.writeFileSync(__dirname+'/traits-verification.json',JSON.stringify({errors,rows},null,2));await browser.close();}
console.log('PASS individual fantasy traits');})().catch(e=>{console.error(e);process.exitCode=1});

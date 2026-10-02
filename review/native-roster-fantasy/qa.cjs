const QA=require('../../tools/qa-platform.cjs'),assert=require('assert/strict'),fs=require('fs');
(async()=>{const browser=await QA.chromium.launch({headless:true,args:QA.gpuArgs()}),page=await browser.newPage({viewport:{width:1440,height:950}}),errors=[],rows=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
try{
 for(const key of ['unicorn','pegasus','emberdrake']){
  await page.goto(QA.BASE+'/breeds.html?horse='+key+'&gait=canter',{timeout:120000});await page.waitForFunction(key=>window.render_game_to_text&&JSON.parse(render_game_to_text()).breed===key&&!JSON.parse(render_game_to_text()).loading,key,{timeout:90000});
  const result=await page.evaluate(()=>({state:JSON.parse(render_game_to_text()),inspect:breedStudioInspect()}));assert(result.state.asset.nativeBreed,key+' new model');assert.equal(result.inspect.bones,677);assert(result.inspect.finite);
  if(key!=='unicorn'){await page.locator('#wings').click();await page.evaluate(()=>advanceTime(1200));assert((await page.evaluate(()=>JSON.parse(render_game_to_text()))).wings.open);}
  await page.screenshot({path:__dirname+'/'+key+'-studio.png'});rows.push({surface:'studio',key,result});
 }
 await page.goto(QA.BASE+'/ranch3d.html?qa=native-fantasy',{timeout:120000});await page.waitForFunction(()=>window.__features?.installed?.includes('native-horses'),null,{timeout:90000});
 for(const key of ['unicorn','pegasus','emberdrake','alicorn','opaline']){
  const index=await page.evaluate(key=>{const G=__features;G.save.sync(s=>G.horse.grantHorse(s,key,{name:'Fantasy QA'}));G.horse.reloadHorses();G.horse.rebuildAll();G.hidePanels();return G.horse.myHorses.findIndex(h=>h.breed===key)},key);assert(index>=0,key+' granted');
  await page.selectOption('#horseSel',String(index),{force:true});await page.waitForFunction(key=>__features.horse.RIG().modelKey===key&&__features.horse.RIG().attachedTo===__features.horse.player.mesh,key,{timeout:90000});
  const before=await page.evaluate(()=>{const G=__features,r=G.horse.RIG(),f=r.nativeFantasy;G.hidePanels();G.horse.player.pos.set(-3,0,-3);G.horse.player.y=0;G.horse.player.speed=0;G.horse.player.flying=false;return{nativeRoster:r.profile.nativeRoster,bones:r.bones.length,key:r.modelKey,horn:!!f?.horn,wings:!!f?.pair,dragon:f?.appearance.dragon,hornParent:f?.horn?.parent?.name,wingParent:f?.wingMount?.parent?.name,appearance:f?.appearance.theme,coat:r.skin.material.name,localHorn:f?.horn?.position.toArray(),localWings:f?.wingMount?.position.toArray()};});
  assert(before.nativeRoster,key+' native roster');assert.equal(before.bones,677);if(['unicorn','alicorn','opaline'].includes(key)){assert(before.horn,key+' horn');assert.equal(before.hornParent,'head_019');}if(['pegasus','emberdrake','alicorn'].includes(key)){assert(before.wings,key+' wings');assert.equal(before.wingParent,'spine_04_012');}
  await page.keyboard.down('ArrowUp');await page.keyboard.down('Shift');await page.evaluate(()=>advanceTime(3000));await page.keyboard.up('Shift');await page.keyboard.up('ArrowUp');
  const after=await page.evaluate(()=>{const G=__features,r=G.horse.RIG(),f=r.nativeFantasy;return{mode:r.heroMotion.mode,finite:r.bones.every(b=>b.matrixWorld.elements.every(Number.isFinite)),localHorn:f?.horn?.position.toArray(),localWings:f?.wingMount?.position.toArray(),wingVisible:f?.pair?.every(w=>w.visible&&w.parent.visible),openness:f?.openness};});
  assert(after.finite);assert.equal(after.mode,'gallop');assert.deepEqual(after.localHorn,before.localHorn,key+' horn remains bound');assert.deepEqual(after.localWings,before.localWings,key+' wing root remains bound');
  let flight=null;if(before.wings){await page.keyboard.down('Space');await page.evaluate(()=>advanceTime(100));await page.keyboard.up('Space');await page.evaluate(()=>advanceTime(1600));flight=await page.evaluate(()=>{const G=__features,r=G.horse.RIG();return{flying:G.horse.player.flying,openness:r.nativeFantasy.openness,beat:r.nativeFantasy.beat,visible:r.nativeFantasy.pair.every(w=>w.visible&&w.parent.visible),finite:r.bones.every(b=>b.matrixWorld.elements.every(Number.isFinite))}});assert(flight.flying&&flight.openness>.9&&flight.visible&&flight.finite,key+' flight wings');}
  rows.push({surface:'ranch',key,before,after,flight});console.log(key+' passes native model, adornments, gallop and '+(flight?'flight':'horn binding'));
 }
 assert.equal(errors.length,0,errors.join('\n'));
}finally{fs.writeFileSync(__dirname+'/verification.json',JSON.stringify({errors,rows},null,2));await browser.close();}
console.log('PASS fantasy integration');})().catch(e=>{console.error(e);process.exitCode=1});

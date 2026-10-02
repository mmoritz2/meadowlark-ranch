const QA=require('./qa-platform.cjs'),fs=require('fs'),path=require('path'),assert=require('assert/strict');
(async()=>{
 const b=await QA.chromium.launch({headless:true,args:QA.gpuArgs()}),p=await b.newPage({viewport:{width:1440,height:950}}),rows=[],errors=[];
 p.on('pageerror',e=>{errors.push(e.message);console.log('page error',e.message)});p.on('console',m=>{if(m.type()==='error')console.log(m.text())});
 const out=path.join(__dirname,'../review/native-complete-gaits');
 try{
  await p.goto(QA.BASE+'/ranch3d.html?qa=native-game',{timeout:120000});
  await p.waitForFunction(()=>window.__features?.installed?.includes('native-horses'),null,{timeout:90000});
  console.log('Game initialized');
  for(const key of (process.env.QA_HORSES?.split(',')||['white-western','bay-western','bay-sporthorse-native','bay','welsh','shire','pegasus'])){
   // This Playwright context has a temporary save, separate from the user's game.
   const index=await p.evaluate(key=>{const G=__features;G.save.sync(s=>G.horse.grantHorse(s,key,{name:'Motion QA'}));G.horse.reloadHorses();G.horse.rebuildAll();G.hidePanels();return G.horse.myHorses.findIndex(h=>h.breed===key)},key);
   console.log('Select',key,index);await p.selectOption('#horseSel',String(index),{force:true});
   await p.waitForFunction(key=>__features.horse.RIG().modelKey===key&&__features.horse.RIG().attachedTo===__features.horse.player.mesh,key,{timeout:90000});
   await p.evaluate(()=>{const G=__features;G.hidePanels();const p=G.horse.player;p.pos.set(-3,0,-3);p.speed=0;p.heading=0;advanceTime(200)});
   const modes=[];await p.keyboard.down('ArrowUp');
   for(const [modifier,expected]of [['Control','walk'],['Alt','trot'],[null,'canter'],['Shift','gallop']]){
    if(modifier)await p.keyboard.down(modifier);await p.evaluate(()=>advanceTime(4500));
    const state=await p.evaluate(()=>{const r=__features.horse.RIG();return{mode:r.heroMotion.mode,state:r.heroMotion.state,profile:r.profile.nativeGaits,finite:r.bones.every(b=>b.matrixWorld.elements.every(Number.isFinite))}});
    const wanted=expected;
    assert.equal(state.mode,wanted,key+' '+modifier);assert(state.finite);modes.push({modifier,state});if(modifier)await p.keyboard.up(modifier);
   }
   await p.keyboard.up('ArrowUp');
   if(key==='pegasus'){
    await p.keyboard.down('Space');await p.evaluate(()=>advanceTime(100));await p.keyboard.up('Space');
    const flying=await p.evaluate(()=>__features.horse.player.flying);assert(flying,'Pegasus flight');rows.push({key,modes,flying});
   }else{
    await p.keyboard.down('Space');await p.evaluate(()=>advanceTime(10));await p.keyboard.up('Space');
    const samples=[];
    for(let i=0;i<115;i++){await p.evaluate(()=>advanceTime(1000/60));samples.push(await p.evaluate(()=>{const G=__features,r=G.horse.RIG();return{mode:r.heroMotion.mode,y:G.horse.player.y,finite:r.bones.every(b=>b.matrixWorld.elements.every(Number.isFinite)),rider:G.horse.nativeRiderInspect?.()}}));}
    assert(samples.some(s=>s.mode==='jump'&&s.y>.3),key+' takeoff');assert.equal(samples.at(-1).y,0,key+' landing');assert(samples.every(s=>s.finite));rows.push({key,modes,peak:Math.max(...samples.map(s=>s.y)),last:samples.at(-1)});
   }
   console.log(key+' mounted gaits and '+(key==='pegasus'?'flight':'jump')+' passed');
  }
  assert.equal(errors.length,0,errors.join('\n'));
 }finally{fs.writeFileSync(path.join(out,process.env.QA_REPORT||'production-ranch-report.json'),JSON.stringify({errors,rows},null,2));await b.close()}
})().catch(e=>{console.error(e);process.exitCode=1});

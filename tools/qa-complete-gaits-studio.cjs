const QA=require('./qa-platform.cjs'),fs=require('fs'),path=require('path'),assert=require('assert/strict');
const out=path.join(__dirname,'../review/native-complete-gaits');
(async()=>{
 const b=await QA.chromium.launch({headless:true,args:QA.gpuArgs()}),p=await b.newPage({viewport:{width:1440,height:950}}),errors=[],rows=[];
 p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'../assets/models/artist-breeds/manifest.json')));
 const keys=process.env.QA_HORSES?.split(',')||[...new Set(Object.values(manifest.breeds).map(s=>s.file.replace('.glb',''))),'white-western','bay-western','bay-sporthorse-native','pegasus','unicorn','european-dragon','black-dragon-native'];
 try{
  await p.goto(QA.BASE+'/breeds.html?horse='+keys[0],{timeout:120000});
  for(const key of keys){
   if(key!==keys[0])await p.locator('#list button[data-key="'+key+'"]').click();
   await p.waitForFunction(k=>window.render_game_to_text&&JSON.parse(render_game_to_text()).breed===k&&!JSON.parse(render_game_to_text()).loading,key,{timeout:90000});
   const modes=await p.locator('#motion option').evaluateAll(nodes=>nodes.map(n=>n.value));
   if(!['european-dragon','black-dragon-native'].includes(key))for(const required of ['walk','trot','canter','gallop','jump'])assert(modes.includes(required),key+' missing '+required);
   for(const mode of modes.filter(x=>x!=='rest'&&x!=='sit')){
    await p.selectOption('#motion',mode);await p.evaluate(()=>advanceTime(650));
    const row=await p.evaluate(()=>({state:JSON.parse(render_game_to_text()),inspect:breedStudioInspect()}));
    assert(row.inspect.finite,key+' '+mode+' nonfinite');assert.equal(row.state.motion,mode,key+' mode');
    rows.push({key,mode,bones:row.inspect.bones,bounds:row.inspect.bounds,animation:row.inspect.animation,asset:row.state.asset});
    if(['white-western','bay','welsh','shire','pegasus'].includes(key)&&['canter','gallop','jump'].includes(mode))await p.screenshot({path:path.join(out,`${key}-production-${mode}.png`)});
    if(mode==='jump'){await p.evaluate(()=>advanceTime(2000));const end=await p.evaluate(()=>breedStudioInspect());assert.notEqual(end.animation.gait,'jump');assert.equal(end.animation.bodyLiftM,0);}
   }
   console.log(key+': '+modes.join(', '));
  }
  assert.equal(errors.length,0,errors.join('\n'));
 }finally{fs.writeFileSync(path.join(out,process.env.QA_REPORT||'production-studio-report.json'),JSON.stringify({errors,rows},null,2));await b.close()}
 console.log('PASS '+keys.length+' models / '+rows.length+' motion checks');
})().catch(e=>{console.error(e);process.exitCode=1});

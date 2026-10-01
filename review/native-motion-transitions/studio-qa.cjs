// Exercise the actual Studio controls and public time hook, without routing.
const fs=require('node:fs'),path=require('node:path'),QA=require('../../tools/qa-platform.cjs');
(async()=>{
 const browser=await QA.chromium.launch({headless:true,args:QA.gpuArgs()}),errors=[],rows=[];
 try{
  const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(QA.BASE+'/breeds.html?horse=white-western&qa=transition-clock',{waitUntil:'load',timeout:120000});
  for(const breed of ['white-western','bay-western']){
   if(breed!=='white-western')await page.locator('#list button[data-key="'+breed+'"]').click();
   await page.waitForFunction(key=>JSON.parse(render_game_to_text()).breed===key&&!JSON.parse(render_game_to_text()).loading,breed,{timeout:60000});
   rows.push(...await page.evaluate(breed=>{
    const rows=[],movement=document.querySelector('#motion'),playback=document.querySelector('#playback');
    const set=mode=>{movement.value=mode;movement.dispatchEvent(new Event('change'));};
    for(const rate of [1,.5,.25]){
     playback.value=String(rate);set('rest');advanceTime(1000);set('walk');
     const initial=breedStudioInspect().animation;advanceTime(190);
     const before=breedStudioInspect().animation;advanceTime(10);
     const after=breedStudioInspect().animation,text=JSON.parse(render_game_to_text());
     rows.push({breed,rate,initial,before,after,clipTime:text.clipTime,expectedClipTime:.2*rate,
      pass:initial.transitioning&&before.transitioning&&Math.abs(before.transitionElapsedS-.19)<1e-8&&!after.transitioning&&after.activeActions===1&&Math.abs(text.clipTime-.2*rate)<1e-6});
    }
    return rows;
   },breed));
  }
  const summary={base:QA.BASE,unrouted:true,actualStudioControls:true,errors,rows,pass:!errors.length&&rows.every(r=>r.pass)};
  fs.writeFileSync(path.join(__dirname,'studio-summary.json'),JSON.stringify(summary,null,2)+'\n');
  console.log(JSON.stringify(summary));if(!summary.pass)process.exitCode=1;
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

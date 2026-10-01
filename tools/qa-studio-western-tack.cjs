/* Visual check of native Western tack in the isolated Breed Studio rebuild. */
const fs=require('node:fs'),path=require('node:path'),QA=require('./qa-platform.cjs');
const out=path.resolve(__dirname,'../output/studio-western-tack');
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const browser=await QA.chromium.launch({headless:true,executablePath:process.env.QA_CHROMIUM||undefined,args:QA.gpuArgs()});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('net::ERR_FAILED'))errors.push(m.text());});
  await page.route('**/*',r=>{const url=new URL(r.request().url());return ['data:','blob:'].includes(url.protocol)||url.hostname==='127.0.0.1'?r.continue():r.abort();});
  await page.goto(QA.BASE+'/breeds.html?horse=lipiz',{waitUntil:'load',timeout:120000});
  const ready=key=>page.waitForFunction(k=>window.render_game_to_text&&JSON.parse(render_game_to_text()).breed===k&&!JSON.parse(render_game_to_text()).loading,key,{timeout:120000});
  await ready('lipiz');
  const capture=async(name)=>{await page.locator('#side').click();await page.locator('#stage').screenshot({path:path.join(out,name+'.png')});return page.evaluate(()=>({state:JSON.parse(render_game_to_text()),button:{hidden:document.querySelector('#source-tack').hidden,pressed:document.querySelector('#source-tack').getAttribute('aria-pressed'),text:document.querySelector('#source-tack').textContent}}));};
  const lipizOn=await capture('lipiz-western-on');
  await page.locator('#source-tack').click();const lipizOff=await capture('lipiz-western-off');
  await page.locator('button[data-key="camargue"]').click();await ready('camargue');const camargueOff=await capture('camargue-western-off');
  await page.locator('#source-tack').click();const camargueOn=await capture('camargue-western-on');
  await page.locator('button[data-key="shire"]').click();await ready('shire');const shire=await capture('shire-no-western-toggle');
  const checks={lipizDefaultsOn:lipizOn.state.sourceTack&&lipizOn.button.pressed==='true',lipizCanHide:!lipizOff.state.sourceTack&&lipizOff.button.pressed==='false',camargueDefaultsOff:!camargueOff.state.sourceTack&&camargueOff.button.pressed==='false',camargueCanShow:camargueOn.state.sourceTack&&camargueOn.button.pressed==='true',nonSourceTackHorseHidesToggle:shire.button.hidden&&!shire.state.sourceTack,noErrors:errors.length===0};
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({checks,errors,lipizOn,lipizOff,camargueOff,camargueOn,shire},null,2));
  console.log(JSON.stringify({checks,errors}));
  if(Object.values(checks).some(ok=>!ok))process.exitCode=1;
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

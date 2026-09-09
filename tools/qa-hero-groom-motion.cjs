const{chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path');
const out=path.resolve('output/hero-groom-motion');
(async()=>{const browser=await chromium.launch({headless:true,args:['--use-angle=d3d11']});const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});await page.goto('http://127.0.0.1:8431/output/hero-groom-motion/');await page.waitForFunction(()=>window.render_game_to_text&&JSON.parse(render_game_to_text()).ready,null,{timeout:120000});
const checks=await page.evaluate(()=>testGroomMotion());await page.screenshot({path:path.join(out,'rest.png')});
await page.evaluate(()=>{setMotion(8,.8);advanceTime(2400)});await page.screenshot({path:path.join(out,'gallop-turn.png')});const moving=await page.evaluate(()=>JSON.parse(render_game_to_text()));
await page.evaluate(()=>{setMotion(0,0);advanceTime(6000)});await page.screenshot({path:path.join(out,'settled.png')});const settled=await page.evaluate(()=>JSON.parse(render_game_to_text()));
await page.evaluate(()=>resetMotion());await page.screenshot({path:path.join(out,'reset.png')});const disposal=await page.evaluate(()=>testGroomDispose());
const report={checks,disposal,moving,settled,errors};fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));await browser.close();if(errors.length||Object.entries(checks).some(([k,v])=>typeof v==='boolean'&&!v)||Object.values(disposal).some(v=>!v)||settled.motion.activity!==0)process.exitCode=1;
})().catch(e=>{console.error(e);process.exit(1)});

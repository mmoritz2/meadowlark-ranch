/* Assemble unchanged QA frame captures and extract real-time video frames.
 * Usage: node tools/review-hero-motion.cjs output/hero-motion-audit-v2
 */
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const out=path.resolve(process.argv[2]||'output/hero-motion-audit-v2');
(async()=>{
 const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1600,height:1220}});
 for(const gait of ['walk','trot','canter-left','canter-right','gallop-left','gallop-right']){
  const files=Array.from({length:8},(_,i)=>path.join(out,gait+'-phase-'+String(i).padStart(2,'0')+'.png'));if(files.some(f=>!fs.existsSync(f)))continue;
  const cards=files.map((f,i)=>'<figure><img src="data:image/png;base64,'+fs.readFileSync(f).toString('base64')+'"><figcaption>'+gait+' • stride phase sample '+i+'/8</figcaption></figure>');
  await page.setContent('<style>*{box-sizing:border-box}body{margin:0;padding:12px;background:#eee9df;font:17px Arial;color:#24352c}main{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}figure{margin:0;background:#fff}img{display:block;width:100%}figcaption{padding:8px}</style><main>'+cards.join('')+'</main>');
  await page.waitForFunction(()=>[...document.images].every(i=>i.complete));await page.locator('main').screenshot({path:path.join(out,gait+'-phase-sheet.png')});
 }
 const jumpFrames=fs.readdirSync(out).filter(f=>/^jump-\d+\.png$/.test(f)).sort();
 if(jumpFrames.length){
  const cards=jumpFrames.map(f=>'<figure><img src="data:image/png;base64,'+fs.readFileSync(path.join(out,f)).toString('base64')+'"><figcaption>Jump '+(Number(f.match(/\d+/)[0])/60).toFixed(2)+' s</figcaption></figure>');
  await page.setContent('<style>*{box-sizing:border-box}body{margin:0;padding:12px;background:#eee9df;font:17px Arial;color:#24352c}main{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}figure{margin:0;background:#fff}img{display:block;width:100%}figcaption{padding:8px}</style><main>'+cards.join('')+'</main>');
  await page.waitForFunction(()=>[...document.images].every(i=>i.complete));await page.locator('main').screenshot({path:path.join(out,'jump-phase-sheet.png')});
 }
 const movie=path.join(out,'gaits-and-transitions.webm');
 if(fs.existsSync(movie)){
  const cache=path.join(process.env.LOCALAPPDATA,'ms-playwright');
  const binary=fs.readdirSync(cache).filter(n=>n.startsWith('ffmpeg-')).map(n=>path.join(cache,n,'ffmpeg-win64.exe')).find(fs.existsSync);
  if(!binary)throw Error('Playwright ffmpeg unavailable; video frames were not decoded');
  const times=[3,3.3,3.6,3.9,9,9.2,9.4,9.6,20,20.16,20.32,20.48],images=[];
  for(const t of times){const output=path.join(out,'clip-'+t.toFixed(2)+'.png');
   const result=spawnSync(binary,['-hide_banner','-loglevel','error','-y','-ss',String(t),'-i',movie,'-frames:v','1','-update','1',output],{windowsHide:true});
   if(result.status!==0)throw Error('Video extraction failed: '+result.stderr.toString());images.push('data:image/png;base64,'+fs.readFileSync(output).toString('base64'));
  }
  await page.setContent('<canvas id="c" width="1600" height="930"></canvas>');
  // Timeline positions intentionally span different moments of the recorded run.
  // Labels are video timestamps, not claimed normalized gait phases.
  await page.evaluate(async({images,times})=>{
   const c=document.querySelector('canvas'),ctx=c.getContext('2d');
   ctx.fillStyle='#eee9df';ctx.fillRect(0,0,c.width,c.height);ctx.font='18px Arial';
   for(let i=0;i<times.length;i++){
    const v=new Image();v.src=images[i];await v.decode();
    const x=(i%4)*400,y=Math.floor(i/4)*310;ctx.drawImage(v,160,150,960,640,x,y,400,266.667);ctx.fillStyle='#24352c';ctx.fillText('Real-time clip '+times[i].toFixed(2)+' s',x+8,y+291);
   }
  },{images,times});
  await page.locator('#c').screenshot({path:path.join(out,'recorded-motion-sheet.png')});
 }
 await browser.close();console.log(out);
})().catch(e=>{console.error(e);process.exitCode=1});

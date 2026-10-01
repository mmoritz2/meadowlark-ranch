const fs=require('node:fs'),path=require('node:path'),QA=require('../../tools/qa-platform.cjs');
const out=path.resolve(__dirname,'../../output/native-bay-kit');fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await QA.chromium.launch({headless:true,args:QA.gpuArgs()});try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(QA.BASE+'/review/native-bay-kit/review.html');await page.waitForFunction(()=>window.nativeKitInspect?.().ready,null,{timeout:60000});
 const summary={url:page.url(),errors,gaits:{}};
 for(const gait of ['walk','trot','canterLeft','canterRight','rest']){
  await page.evaluate(k=>nativeKitSetClip(k),gait);
  const rows=await page.evaluate(()=>Array.from({length:32},(_,i)=>nativeKitSetPhase(i/32)));
  summary.gaits[gait]={clip:rows[0].clip,duration:rows[0].duration,nativeBones:rows[0].nativeBones,modelSha256:rows[0].modelSha256,allFinite:rows.every(r=>r.finite),bodyMinRange:[Math.min(...rows.map(r=>r.bodyMinY)),Math.max(...rows.map(r=>r.bodyMinY))],stanceWholeHoofMinimum:gait==='rest'?null:[Math.min(...rows.flatMap(r=>Object.values(r.feet).filter(f=>f.stance).map(f=>f.minY))),Math.max(...rows.flatMap(r=>Object.values(r.feet).filter(f=>f.stance).map(f=>f.minY)))]};
  if(gait!=='rest'){await page.click('#side');await page.evaluate(()=>nativeKitSetPhase(.7));await page.screenshot({path:path.join(out,gait+'-side.png')});await page.click('#quarter');await page.evaluate(()=>nativeKitSetPhase(.375));await page.screenshot({path:path.join(out,gait+'-quarter.png')});}
 }
 summary.pass=!errors.length&&Object.values(summary.gaits).every(g=>g.nativeBones===677&&g.allFinite)&&['walk','trot','canterLeft','canterRight'].every(k=>summary.gaits[k].bodyMinRange[0]>-.005&&summary.gaits[k].stanceWholeHoofMinimum[0]>-.005&&summary.gaits[k].stanceWholeHoofMinimum[1]<.01);
 fs.writeFileSync(path.join(out,'qa-summary.json'),JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify(summary,null,2));if(!summary.pass)throw Error('Combined native preview failed');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

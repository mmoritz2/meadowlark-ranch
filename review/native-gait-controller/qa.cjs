const fs=require('node:fs'),path=require('node:path'),QA=require('../../tools/qa-platform.cjs');
const out=path.resolve(__dirname,'../../output/native-gait-controller');fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await QA.chromium.launch({headless:true,args:QA.gpuArgs()});try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(QA.BASE+'/review/native-gait-controller/qa.html');await page.waitForFunction(()=>!!window.controllerQA,null,{timeout:60000});
 const result=await page.evaluate(()=>controllerQA());result.browserErrors=errors;
 fs.writeFileSync(path.join(out,'qa-summary.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));if(errors.length||result.failures.length)throw Error('Native gait controller failed');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

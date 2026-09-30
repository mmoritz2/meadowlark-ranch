const fs=require('node:fs'),path=require('node:path'),QA=require('../../tools/qa-platform.cjs');
fs.mkdirSync(path.resolve(__dirname,'../../output/native-horse-controller'),{recursive:true});
(async()=>{const browser=await QA.chromium.launch({headless:true,args:QA.gpuArgs()});try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(QA.BASE+'/review/native-horse-controller/qa.html');
 await page.waitForFunction(()=>!!window.controllerQA,null,{timeout:60000});
 const result=await page.evaluate(()=>controllerQA());result.browserErrors=errors;
 fs.writeFileSync(path.resolve(__dirname,'../../output/native-horse-controller/qa-summary.json'),JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify(result,null,2));if(errors.length||result.failures.length)throw new Error('Native controller integration failed');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

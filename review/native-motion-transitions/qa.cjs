const fs=require('fs'),path=require('path'),crypto=require('crypto'),QA=require('../../tools/qa-platform.cjs');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'output/native-motion-transitions');fs.mkdirSync(out,{recursive:true});
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
(async()=>{const browser=await QA.chromium.launch({headless:true,args:QA.gpuArgs(['--no-sandbox'])});try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await page.goto(QA.BASE+'/review/native-motion-transitions/review.html');await page.waitForFunction(()=>window.transitionReady,null,{timeout:120000});
 const scenarios=[];
 for(const breed of ['white-western','bay-western'])for(const s of [
 {from:'stand',to:'walk',phase:.2,rate:.12},
 {from:'walk',to:'stand',phase:.35,rate:.12},
 {from:'walk',to:'trot',phase:.43,rate:1},
 {from:'trot',to:'canter',phase:.3,rate:1},
 {from:'canter',fromLead:'left',to:'canter',toLead:'right',phase:.58,rate:1},
 {from:'trot',to:'rest',phase:.15,rate:.5},
 {from:'walk',to:'trot',interrupt:'stand',phase:.8,rate:.25}
 ])scenarios.push({breed,scenario:s});
 scenarios.push({breed:'black-dragon-native',scenario:{from:'stand',to:'rest',phase:.3,rate:1}},{breed:'european-dragon',scenario:{from:'walk',to:'run',phase:.2,rate:1}},{breed:'european-dragon',scenario:{from:'run',to:'fly',phase:.6,rate:.2}},{breed:'european-dragon',scenario:{from:'fly',to:'stand',phase:.3,rate:.2}});
 const rows=[];for(const s of scenarios){const pair={...s};for(const version of ['before','after'])pair[version]=await page.evaluate(a=>transitionRun(a.version,a.breed,a.scenario),{...s,version});rows.push(pair);console.log(JSON.stringify({breed:s.breed,from:s.scenario.from,to:s.scenario.to,instantBefore:pair.before.instantJointStep,instantAfter:pair.after.instantJointStep,floor:pair.after.minimumFloorM,afterMaxFrame:pair.after.maxFrameJointStep,finish:pair.after.transitionFinishS}));}
 const summary={controllerSha256:hash(path.join(root,'assets/native-horse-motion.js')),baselineSha256:hash(path.join(__dirname,'before-controller.mjs')),errors,actualFadeSeconds:.2,frameSeconds:1/120,allFinite:rows.every(p=>p.after.finite),allActorTransformsUnchanged:rows.every(p=>p.after.actorUnchanged),maxInstantBefore:Math.max(...rows.map(p=>p.before.instantJointStep)),maxInstantAfter:Math.max(...rows.map(p=>p.after.instantJointStep)),maxHorseInstantAfter:Math.max(...rows.filter(p=>p.breed.includes('western')).map(p=>p.after.instantJointStep)),creatorDragonBehaviorPreserved:rows.filter(p=>!p.breed.includes('western')).every(p=>Math.abs(p.before.minimumFloorM-p.after.minimumFloorM)<1e-8&&Math.abs(p.before.instantJointStep-p.after.instantJointStep)<1e-6),worstHorseFloorM:Math.min(...rows.filter(p=>p.breed.includes('western')).map(p=>p.after.minimumFloorM)),rows:rows.map(p=>({...p,before:{...p.before,rows:undefined},after:{...p.after,rows:undefined}}))};
 fs.writeFileSync(path.join(out,'browser-report.json'),JSON.stringify({summary,rows},null,2)+'\n');fs.writeFileSync(path.join(__dirname,'qa-summary.json'),JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify({...summary,rows:undefined}));if(errors.length||!summary.allFinite||!summary.allActorTransformsUnchanged)process.exitCode=1;
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});

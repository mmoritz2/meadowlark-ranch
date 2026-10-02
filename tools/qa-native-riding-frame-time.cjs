/* Delay animation frames to exercise10–20fps real-time movement without player saves. */
const QA=require('./qa-platform.cjs'),assert=require('assert/strict'),fs=require('fs'),path=require('path');
(async()=>{const b=await QA.chromium.launch({headless:true,args:QA.gpuArgs()}),p=await b.newPage({viewport:{width:1280,height:850}}),errors=[];p.on('pageerror',e=>errors.push(e.message));try{
 await p.addInitScript(()=>{const raf=window.requestAnimationFrame.bind(window);window.requestAnimationFrame=fn=>raf(()=>setTimeout(()=>fn(performance.now()),25));});
 await p.goto(QA.BASE+'/ranch3d.html?qa=native-frame-time',{timeout:120000});
 await p.waitForFunction(()=>window.__features?.horse.RIG().ready,null,{timeout:90000});
 const result=await p.evaluate(()=>new Promise(resolve=>{let count=0;const rows=[];__features.on('tick',(dt)=>{if(++count>8&&rows.length<36){rows.push({wall:performance.now(),dt});if(rows.length===36){const sample=rows.slice(1),wallS=(rows.at(-1).wall-rows[0].wall)/1000,simulationS=sample.reduce((s,r)=>s+r.dt,0);resolve({frames:sample.length,wallS,simulationS,ratio:simulationS/wallS,meanFps:sample.length/wallS,minDt:Math.min(...sample.map(r=>r.dt)),maxDt:Math.max(...sample.map(r=>r.dt)),finite:__features.horse.RIG().bones.every(b=>b.matrixWorld.elements.every(Number.isFinite))});}}});}));
 assert(result.maxDt>.055,'Exercise frame times longer than old50ms cap');assert(result.ratio>.88,'Simulation should retain real elapsed time at10–20fps');assert(result.finite);assert.equal(errors.length,0,errors.join('\n'));console.log(JSON.stringify(result));fs.writeFileSync(path.join(__dirname,'../review/native-riding-speed/frame-time-report.json'),JSON.stringify({...result,errors},null,2));
}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});

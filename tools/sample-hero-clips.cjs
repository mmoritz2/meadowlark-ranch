// Sample the actual rendered controller; the Python exporter consumes local
// bone transforms, so Blender and glTF playback use the same authored poses.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const output=path.resolve(process.argv[2]||'output/hero-animation-clips/samples.json');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--use-angle=d3d11']});
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8431/hero-horse.html');
 await page.waitForFunction(()=>window.heroMotionQA&&heroMotionQA.snapshot(),null,{timeout:120000});
 await page.evaluate(()=>heroMotionQA.pauseRealtime(true));
 const source='hero-rigged-v2.glb',sourceBytes=fs.readFileSync(path.join('assets/models/hero-horse',source));
 const result={version:1,fps:60,source,sourceSha256:crypto.createHash('sha256').update(sourceBytes).digest('hex'),bones:Array.from({length:33},(_,i)=>'bone_'+i),clips:[]};
 const cases=[['idle','stand','left'],['walk','walk','left'],['trot','trot','left'],['canter-left','canter','left'],['canter-right','canter','right'],['gallop-left','gallop','left'],['gallop-right','gallop','right'],['jump','jump','left']];
 for(const [name,gait,lead]of cases){
  const clip=await page.evaluate(async({name,gait,lead})=>{
   heroMotionQA.reset();heroMotionQA.set(gait,{lead});let initial=heroMotionQA.snapshot();
   if(gait!=='stand'&&gait!=='jump')advanceTime(2000/initial.cycleHz);
   initial=heroMotionQA.snapshot();const duration=gait==='stand'?8:gait==='jump'?2.3:1/initial.cycleHz,count=Math.ceil(duration*60),frames=[];
   for(let i=0;i<=count;i++){
    const at=Math.min(duration,i/60),before=Math.min(duration,(i-1)/60);
    if(i)advanceTime((at-before)*1000);const s=heroMotionQA.snapshot();
    frames.push({time:at,rotations:s.localQuaternions.flat(),translations:s.localPositions.flat()});
   }
   return{name,loop:gait!=='jump',duration,lead,speedMps:initial.speedMps,rootMotion:'in-place; translate forward at speedMps',frames};
  },{name,gait,lead});
  result.clips.push(clip);console.log(name+': '+clip.frames.length+' frames / '+clip.duration.toFixed(3)+'s');
 }
 await browser.close();if(errors.length)throw Error(errors.join('\n'));
 fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(result));
 console.log(output);
})().catch(e=>{console.error(e);process.exit(1);});

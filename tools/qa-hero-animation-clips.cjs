/** Load real baked clips in Three.js and exercise every joint through a mixer. */
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path');
const out=path.resolve('output/hero-animation-clips'),model=path.resolve(process.argv[2]||'assets/models/hero-horse/hero-animated.glb');
const source=path.resolve(process.argv[3]||'assets/models/hero-horse/hero-rigged-v2.glb');
const expected=['idle','walk','trot','canter-left','canter-right','gallop-left','gallop-right','jump'];
function read(file){const raw=fs.readFileSync(file);let offset=12,doc,bin;while(offset<raw.length){const n=raw.readUInt32LE(offset),type=raw.readUInt32LE(offset+4),data=raw.subarray(offset+8,offset+8+n);if(type===0x4e4f534a)doc=JSON.parse(data);if(type===0x004e4942)bin=data;offset+=8+n}return{doc,bin}}
(async()=>{
 fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'index.html'),'<!doctype html><script type="importmap">{"imports":{"three":"/assets/vendor/three/build/three.module.js"}}</script><title>Animation clip validation</title>');
 const a=read(source),b=read(model),checks={sourceBytesPreserved:b.bin.subarray(0,a.bin.length).equals(a.bin),sourceDefinitionsPreserved:['nodes','meshes','materials','images','textures','samplers','skins','scenes'].every(k=>JSON.stringify(a.doc[k])===JSON.stringify(b.doc[k]))};
 const browser=await chromium.launch({headless:true}),page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await page.goto('http://127.0.0.1:8431/output/hero-animation-clips/');
 const result=await page.evaluate(async url=>{
  const THREE=await import('three'),{GLTFLoader}=await import('/assets/vendor/three/examples/jsm/loaders/GLTFLoader.js');
  const asset=await new GLTFLoader().loadAsync(url),mixer=new THREE.AnimationMixer(asset.scene),bones=[];asset.scene.traverse(o=>{if(o.isBone)bones.push(o)});const byName=Object.fromEntries(bones.map(b=>[b.name,b]));
  const reports=[];for(const clip of asset.animations){
   mixer.stopAllAction();const action=mixer.clipAction(clip);action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();let finite=true,maxKeyError=0;
   for(const fraction of [0,.125,.25,.5,.75,.875,1]){
    mixer.setTime(clip.duration*fraction);asset.scene.updateMatrixWorld(true);
    finite&&=bones.every(b=>[...b.position.toArray(),...b.quaternion.toArray(),...b.matrixWorld.elements].every(Number.isFinite));
   }
   for(const index of [0,Math.floor(clip.tracks[0].times.length/2),clip.tracks[0].times.length-1]){
    action.reset().play();mixer.setTime(clip.tracks[0].times[index]);
    for(const track of clip.tracks){const suffix=track.name.endsWith('.quaternion')?'quaternion':'position';const name=track.name.slice(0,-suffix.length-1),bone=byName[name],n=track.getValueSize(),target=Array.from(track.values.slice(index*n,(index+1)*n));if(!bone)throw new Error('Unknown animated bone '+name);const actual=bone[suffix].toArray();const sign=suffix==='quaternion'&&actual.reduce((sum,v,i)=>sum+v*target[i],0)<0?-1:1;for(let j=0;j<n;j++)maxKeyError=Math.max(maxKeyError,Math.abs(actual[j]*sign-target[j]))}
   }
   const paths=clip.tracks.map(t=>t.name),targets=new Set(paths.map(n=>n.replace(/\.(position|quaternion)$/,'')));
   reports.push({name:clip.name,duration:clip.duration,tracks:clip.tracks.length,bones:targets.size,frames:clip.tracks[0].times.length,finite,maxKeyError,trackDataFinite:clip.tracks.every(t=>Array.from(t.times).every(Number.isFinite)&&Array.from(t.values).every(Number.isFinite))});
  }
  return{boneCount:bones.length,clips:reports};
 },'/'+path.relative(process.cwd(),model).split(path.sep).join('/')+'?qa='+Date.now());
 Object.assign(checks,{eightNamedClips:result.clips.length===8&&expected.every(name=>result.clips.some(c=>c.name===name)),jointCount:result.boneCount===33,channelCounts:result.clips.every(c=>c.tracks===66&&c.bones===33),finite:result.clips.every(c=>c.finite&&c.trackDataFinite),keyPlaybackMatches:result.clips.every(c=>c.maxKeyError<1e-5),noErrors:errors.length===0});
 const report={checks,...result,errors};fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));await browser.close();if(Object.values(checks).some(v=>!v))process.exitCode=1;
})().catch(e=>{console.error(e);process.exit(1)});

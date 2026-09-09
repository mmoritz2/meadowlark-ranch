// CPU-only verification of real exported breed geometry and the bridle's bind-space attachment.
const fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const out=path.resolve(process.argv[2]||'output/artist-bridle-cpu');fs.mkdirSync(out,{recursive:true});
const url=p=>pathToFileURL(path.resolve(p)).href;
const dataModule=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
async function cpuLoader(){
 const three=url('assets/vendor/three/build/three.module.js');
 const utils=dataModule(fs.readFileSync('assets/vendor/three/examples/jsm/utils/BufferGeometryUtils.js','utf8').replace("from 'three'",`from '${three}'`));
 const source=fs.readFileSync('assets/vendor/three/examples/jsm/loaders/GLTFLoader.js','utf8').replace("from 'three'",`from '${three}'`).replace("from '../utils/BufferGeometryUtils.js'",`from '${utils}'`);
 return {THREE:await import(three),GLTFLoader:(await import(dataModule(source))).GLTFLoader};
}
function geometryOnlyGLB(file){
 const b=fs.readFileSync(file),jsonLength=b.readUInt32LE(12),g=JSON.parse(b.subarray(20,20+jsonLength).toString());
 for(const mesh of g.meshes||[])for(const primitive of mesh.primitives)delete primitive.material;
 const text=Buffer.from(JSON.stringify(g)),padded=Buffer.alloc(Math.ceil(text.length/4)*4,32);text.copy(padded);
 const binary=b.subarray(20+jsonLength),result=Buffer.alloc(20+padded.length+binary.length);
 result.writeUInt32LE(0x46546c67,0);result.writeUInt32LE(2,4);result.writeUInt32LE(result.length,8);result.writeUInt32LE(padded.length,12);result.writeUInt32LE(0x4e4f534a,16);padded.copy(result,20);binary.copy(result,20+padded.length);
 return result.buffer.slice(result.byteOffset,result.byteOffset+result.byteLength);
}
(async()=>{
 const bridleSource=fs.readFileSync('assets/artist-horse-bridle.js','utf8'),moduleSha256=require('node:crypto').createHash('sha256').update(bridleSource).digest('hex');
 const {THREE,GLTFLoader}=await cpuLoader(),{createArtistBridle}=await import(dataModule(bridleSource)),{createArtistMotion}=await import(url('assets/artist-horse-motion.js'));
 const manifest=JSON.parse(fs.readFileSync('assets/models/artist-breeds/manifest.json','utf8')),loader=new GLTFLoader(),reports=[],checks={},failures=[];
 const gameSource=fs.readFileSync('ranch3d.html','utf8'),trackStart=gameSource.indexOf('function trackHead(){'),trackEnd=gameSource.indexOf('\nTACK.saddle=buildSaddle()',trackStart);if(trackStart<0||trackEnd<0)throw Error('Production trackHead not found');const createTrackHead=new Function('RIG','player','TACK','_hv','THREE','fitArtistFeatures',gameSource.slice(trackStart,trackEnd)+';return trackHead;');
 const seen=new Set();
 for(const [key,spec] of Object.entries(manifest.breeds)){
  if(seen.has(spec.file))continue;seen.add(spec.file);
  const gltf=await new Promise((resolve,reject)=>loader.parse(geometryOnlyGLB(path.resolve('assets/models/artist-breeds',spec.file)),'',resolve,reject));
  let skin;gltf.scene.traverse(o=>{if(o.isSkinnedMesh&&o.name==='HorseBody')skin=o;});if(!skin)throw Error('No body: '+key);
  const bones=skin.skeleton.bones,head=bones.find(b=>b.name==='head'),restQ=bones.map(b=>b.quaternion.clone());
  const mount=new THREE.Group(),parent=new THREE.Group();parent.add(mount);mount.add(gltf.scene);gltf.scene.scale.setScalar(spec.fitScale);gltf.scene.position.y=spec.fitY;
  const rig={scene:gltf.scene,skin,bones,profile:spec,fitScale:spec.fitScale,fitY:spec.fitY,key};gltf.scene.updateWorldMatrix(true,true);
  const bridle=createArtistBridle(THREE,rig);mount.add(bridle);rig.attachedTo=mount;rig.restQ=restQ;const bitL=new THREE.Object3D(),bitR=new THREE.Object3D();mount.add(bitL,bitR);const trackHead=createTrackHead(rig,{mesh:mount,parts:{}},{bridle,bitL,bitR},new THREE.Vector3(),THREE,()=>{});
  const report={key,vertices:0,finite:true,maxFollowError:0,maxBitError:0,poses:0,rawBitsError:null,rawStrapError:0,fallbackRays:bridle.userData.fit.fallbackRays,sectionCount:bridle.userData.fit.sectionCount};
  for(const strip of bridle.userData.fit.rawPaths){const mesh=bridle.getObjectByName(strip.name),attr=mesh?.geometry?.attributes.position;if(!attr||attr.count!==strip.points.length*4)throw Error('Invalid strap topology '+key+' '+strip.name);const bind=new THREE.Matrix4().fromArray(bridle.userData.fit.bindToHead);for(let i=0;i<strip.points.length;i++){const actual=new THREE.Vector3();for(let j=0;j<4;j++)actual.add(new THREE.Vector3().fromBufferAttribute(attr,i*4+j));actual.multiplyScalar(.25);const expected=new THREE.Vector3(...strip.points[i]).applyMatrix4(bind);report.rawStrapError=Math.max(report.rawStrapError,actual.distanceTo(expected));}}
  // Check the actual strip mesh centerlines as well as their fit metadata, in
  // native metres. The brow must join the interior of each cheek, not its bit.
  const paths=new Map(bridle.userData.fit.rawPaths.map(p=>[p.name,p.points])),headToBind=new THREE.Matrix4().fromArray(bridle.userData.fit.bindToHead).invert();
  const center=(name,i)=>{const attr=bridle.getObjectByName(name).geometry.attributes.position,p=new THREE.Vector3();for(let j=0;j<4;j++)p.add(new THREE.Vector3().fromBufferAttribute(attr,i*4+j));return p.multiplyScalar(.25).applyMatrix4(headToBind);};
  report.junctions=[];
  for(const side of ['Left','Right']){
   const cheekName=side+' cheekpiece',cheek=paths.get(cheekName);
   for(const bandName of ['Crownpiece','Browband']){
    const band=paths.get(bandName),bandIndex=side==='Left'?band.length-1:0,target=new THREE.Vector3(...band[bandIndex]);
    let cheekIndex=0;if(bandName==='Browband'){let nearest=Infinity;for(let i=1;i<cheek.length-1;i++){const d=target.distanceToSquared(new THREE.Vector3(...cheek[i]));if(d<nearest){nearest=d;cheekIndex=i;}}}
    const rawErrorM=target.distanceTo(new THREE.Vector3(...cheek[cheekIndex])),geometryErrorM=center(bandName,bandIndex).distanceTo(center(cheekName,cheekIndex));
    report.junctions.push({band:bandName,side,cheekIndex,rawErrorM,geometryErrorM});
    checks[key+'_'+side+'_'+bandName+'_junction']=rawErrorM<.001&&geometryErrorM<.001&&(bandName==='Crownpiece'||cheekIndex>0&&cheekIndex<cheek.length-1);
   }
  }
  report.bitSides=bridle.userData.fit.rawBits.map(p=>p[0]);checks[key+'_uncrossedBits']=report.bitSides.length===2&&report.bitSides[0]<0&&report.bitSides[1]>0;
  bridle.traverse(o=>{const p=o.geometry?.attributes.position;if(p){report.vertices+=p.count;for(let i=0;i<p.array.length;i++)report.finite&&=Number.isFinite(p.array[i]);}});
  const motion=createArtistMotion({THREE,root:gltf.scene,skin,heightM:spec.heightM});
  for(const setup of ['adult','transformed-foal']){
   if(setup==='adult'){parent.position.set(0,0,0);parent.rotation.set(0,0,0);parent.scale.setScalar(1);mount.position.set(0,0,0);mount.rotation.set(0,0,0);mount.scale.setScalar(spec.withersM/1.45);}
   else{parent.position.set(31.3,1.6,-14.9);parent.rotation.set(.07,-.43,.03);parent.scale.setScalar(1.18);mount.position.set(4.1,-.12,7.4);mount.rotation.set(-.03,1.36,.05);mount.scale.setScalar(spec.withersM/1.45*.65);}
   for(const gait of ['stand','walk','trot','canter','gallop','jump']){
    motion.reset();motion.set(gait);
    for(let sample=0;sample<9;sample++){
     if(sample)motion.update(.16);gltf.scene.updateWorldMatrix(true,true);bridle.userData.follow(head,bones,restQ,gltf.scene,mount);trackHead();parent.updateMatrixWorld(true);
     for(let i=0;i<16;i++){report.finite&&=Number.isFinite(bridle.matrixWorld.elements[i]);report.maxFollowError=Math.max(report.maxFollowError,Math.abs(bridle.matrixWorld.elements[i]-head.matrixWorld.elements[i]));}
     for(const [bitIndex,offset] of (bridle.userData.bitOffsets||[]).entries()){const p=Array.isArray(offset)?new THREE.Vector3(...offset):offset.clone(),expected=p.clone().applyMatrix4(head.matrixWorld),actual=[bitL,bitR][bitIndex].getWorldPosition(new THREE.Vector3());report.maxBitError=Math.max(report.maxBitError,expected.distanceTo(actual));}
     report.poses++;
    }
   }
  }
  const rawBits=bridle.userData.fit?.rawBits;
  if(rawBits){const hidx=bones.indexOf(head),inverse=skin.skeleton.boneInverses[hidx],bind=skin.bindMatrix;let e=0;for(let i=0;i<rawBits.length;i++){const p=Array.isArray(rawBits[i])?new THREE.Vector3(...rawBits[i]):rawBits[i].clone();p.applyMatrix4(bind).applyMatrix4(inverse);const offset=bridle.userData.bitOffsets[i];e=Math.max(e,p.distanceTo(Array.isArray(offset)?new THREE.Vector3(...offset):offset));}report.rawBitsError=e;}
  checks[key+'_finite']=report.finite&&report.vertices>100;checks[key+'_follow']=report.maxFollowError<1e-6;checks[key+'_bits']=bridle.userData.bitOffsets?.length===2&&report.maxBitError<1e-6;if(rawBits)checks[key+'_bindBits']=report.rawBitsError<1e-6;checks[key+'_bindStraps']=report.rawStrapError<1e-6;checks[key+'_namedJoints']=bones.some(b=>b.name==='neckupper')&&bones.some(b=>b.name==='earL');
  reports.push(report);console.log(JSON.stringify(report));
  bridle.traverse(o=>{o.geometry?.dispose();if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();});
 }
 checks.physical25=reports.length===25;checks.poses2700=reports.reduce((n,r)=>n+r.poses,0)===2700;
 for(const [check,pass] of Object.entries(checks))if(!pass)failures.push(check);
 const result={checks,failures,reports,poseCount:reports.reduce((n,r)=>n+r.poses,0),productionTrackHead:true,moduleSha256,moduleUnchanged:bridleSource===fs.readFileSync('assets/artist-horse-bridle.js','utf8')};fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({passed:Object.keys(checks).length-failures.length,total:Object.keys(checks).length,failures,moduleSha256,moduleUnchanged:result.moduleUnchanged}));if(failures.length||!result.moduleUnchanged)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});

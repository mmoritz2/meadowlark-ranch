// Actual AnimationMixer playback, separate from live IK contact validation.
// Inspect every source hoof-surface vertex (not only the solver's sole samples)
// at240Hz, including times between the baked keyframes. Includes the original
// detailed draft foundation as well as all five physical draft derivatives.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{pathToFileURL}=require('node:url');
const repo=path.resolve(__dirname,'../..'),out=path.join(repo,'assets/models/horse-imports/bluemesh-draft/game/breeds');
const mod=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
(async()=>{
 const three=pathToFileURL(path.join(repo,'assets/vendor/three/build/three.module.js')).href,THREE=await import(three);
 const utils=mod(fs.readFileSync(path.join(repo,'assets/vendor/three/examples/jsm/utils/BufferGeometryUtils.js'),'utf8').replace("from 'three'",`from '${three}'`));
 const text=fs.readFileSync(path.join(repo,'assets/vendor/three/examples/jsm/loaders/GLTFLoader.js'),'utf8').replace("from 'three'",`from '${three}'`).replace("from '../utils/BufferGeometryUtils.js'",`from '${utils}'`),{GLTFLoader}=await import(mod(text));
 const rows=[],point=new THREE.Vector3();
 const jobs=[{id:'draft-foundation',folder:path.join(out,'../../work/canonical-rig'),profileFile:'draft-profile.json'},...['vanner','percheron','shire','clyde','suffolk'].map(id=>({id,folder:path.join(out,id),profileFile:'profile.json'}))];
 for(const {id,folder,profileFile} of jobs){
  const profile=JSON.parse(fs.readFileSync(path.join(folder,profileFile))),bake=JSON.parse(fs.readFileSync(path.join(folder,'animation-bake-report.json'))),original=fs.readFileSync(path.join(folder,profile.file)),hash=crypto.createHash('sha256').update(original).digest('hex');
  if(hash!==profile.sha256)throw Error('Model hash mismatch: '+id);
  const length=original.readUInt32LE(12),doc=JSON.parse(original.subarray(20,20+length));for(const mesh of doc.meshes)for(const primitive of mesh.primitives)delete primitive.material;
  const json=Buffer.from(JSON.stringify(doc)),pad=Buffer.alloc(Math.ceil(json.length/4)*4,32);json.copy(pad);const bin=original.subarray(28+length),bytes=Buffer.alloc(28+pad.length+bin.length);bytes.writeUInt32LE(0x46546c67);bytes.writeUInt32LE(2,4);bytes.writeUInt32LE(bytes.length,8);bytes.writeUInt32LE(pad.length,12);bytes.writeUInt32LE(0x4e4f534a,16);pad.copy(bytes,20);bytes.writeUInt32LE(bin.length,20+pad.length);bytes.writeUInt32LE(0x004e4942,24+pad.length);bin.copy(bytes,28+pad.length);
  const gltf=await new Promise((resolve,reject)=>new GLTFLoader().parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'',resolve,reject));gltf.scene.updateMatrixWorld(true);
  const skin=gltf.scene.getObjectByName('HorseBody'),bones=skin.skeleton.bones,pos=skin.geometry.attributes.position,si=skin.geometry.attributes.skinIndex,sw=skin.geometry.attributes.skinWeight,norm=n=>n.replace(/[.\s]/g,'');
  const feet=['FL','FR','HL','HR'].map(prefix=>{
   const hoof=bones.find(b=>norm(b.name)===prefix+'hoof').getWorldPosition(new THREE.Vector3()),legIds=bones.map((bone,index)=>norm(bone.name).startsWith(prefix)&&!norm(bone.name).endsWith('IK')?index:-1).filter(index=>index>=0),indices=[];
   for(let i=0;i<pos.count;i++){point.fromBufferAttribute(pos,i).applyMatrix4(skin.matrixWorld);if(point.y>hoof.y+.01||Math.hypot(point.x-hoof.x,point.z-hoof.z)>.15)continue;let owned=0;for(let k=0;k<4;k++)if(legIds.includes(si.getComponent(i,k)))owned+=sw.getComponent(i,k);if(owned>=.75)indices.push(i);}
   if(!indices.length)throw Error('No original hoof surface: '+id+'/'+prefix);return {leg:prefix,indices};
  });
  const mixer=new THREE.AnimationMixer(gltf.scene),row={id,modelSha256:hash,bakeRateHz:bake.fps,sampleRateHz:240,hoofSurfaceCounts:feet.map(f=>({leg:f.leg,vertices:f.indices.length})),clips:[],minHoofY:Infinity};
  for(const clip of gltf.animations){mixer.stopAllAction();const action=mixer.clipAction(clip);action.reset().setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();const count=Math.ceil(clip.duration*240),times=clip.tracks[0].times,data={name:clip.name,duration:clip.duration,samples:count+1,minHoofY:Infinity,minHoofYAtKeyTimes:Infinity,legs:Object.fromEntries(feet.map(f=>[f.leg,Infinity]))};
   for(let i=0;i<=count;i++){const time=Math.min(i/240,clip.duration),atKeyTime=times.some(t=>Math.abs(t-time)<1e-6);mixer.setTime(time);gltf.scene.updateMatrixWorld(true);skin.skeleton.update();for(const foot of feet)for(const index of foot.indices){point.fromBufferAttribute(pos,index);skin.applyBoneTransform(index,point);point.applyMatrix4(skin.matrixWorld);data.legs[foot.leg]=Math.min(data.legs[foot.leg],point.y);if(atKeyTime)data.minHoofYAtKeyTimes=Math.min(data.minHoofYAtKeyTimes,point.y);if(point.y<data.minHoofY){data.minHoofY=point.y;data.worst={time,atKeyTime,leg:foot.leg,vertex:index,point:point.toArray()};}}}
   row.clips.push(data);row.minHoofY=Math.min(row.minHoofY,data.minHoofY);
  }
  row.checks={allNineClips:row.clips.length===9,allFourSourceHoofSurfaces:feet.length===4,actualBakedHoofPenetrationWithin6mm:row.minHoofY>-.006};rows.push(row);console.log(id,row.minHoofY,row.checks.actualBakedHoofPenetrationWithin6mm);
 }
 const report={method:'Site-vendored Three GLTFLoader and actual AnimationMixer LINEAR/slerp playback, every source hoof-surface vertex with≥.75 leg ownership near its rest hoof, at240Hz through all9 clips. Tests actual baked interpolation separately from live sole-landmark contact; excludes source groom/tack/tail surfaces.',bodies:rows,checks:{allFiveBodiesChecked:rows.filter(row=>row.id!=='draft-foundation').length===5,draftFoundationChecked:rows.some(row=>row.id==='draft-foundation'),everyBakedHoofPasses6mm:rows.every(row=>Object.values(row.checks).every(Boolean))}};
 fs.writeFileSync(path.join(out,'baked-ground-validation.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report.checks));if(!Object.values(report.checks).every(Boolean))throw Error('Actual baked hoof playback exceeds6mm ground tolerance');
})().catch(error=>{console.error(error);process.exitCode=1;});

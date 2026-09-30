/* Bake reusable clips from the inspected numerical game rig. This uses no
 * generative tools and never opens or modifies the original licensed source. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const source=p=>fs.readFileSync(path.join(root,p),'utf8');
const threeUrl=pathToFileURL(path.join(root,'assets/vendor/three/build/three.module.js')).href;
const THREE=await import(threeUrl);
const dataUrl=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const utilsUrl=dataUrl(source('assets/vendor/three/examples/jsm/utils/BufferGeometryUtils.js').replace("from 'three'",`from '${threeUrl}'`));
const loaderUrl=dataUrl(source('assets/vendor/three/examples/jsm/loaders/GLTFLoader.js').replace("from 'three'",`from '${threeUrl}'`).replace("from '../utils/BufferGeometryUtils.js'",`from '${utilsUrl}'`));
const {GLTFLoader}=await import(loaderUrl);
const {createDragonMotion}=await import(pathToFileURL(path.join(root,'assets/dragon-horse-motion.js')).href);
const base=path.join(root,'assets/models/horse-imports/black-dragon/game');
const profile=JSON.parse(fs.readFileSync(path.join(base,'profile.json')));
const bytes=fs.readFileSync(path.join(base,'dragon.glb'));
const jsLength=bytes.readUInt32LE(12),doc=JSON.parse(bytes.subarray(20,20+jsLength)),binOffset=20+jsLength;
if(doc.animations?.length)throw new Error('Run rig-imported-dragon.py first to rebuild the derivative before rebaking clips.');
let binary=Buffer.from(bytes.subarray(binOffset+8,binOffset+8+bytes.readUInt32LE(binOffset)));
const loader=new GLTFLoader();loader.register(parser=>({name:'CLIP_BAKE_GEOMETRY_ONLY',loadTexture(){return Promise.resolve(new THREE.Texture());}}));
const gltf=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
let skin;gltf.scene.traverse(o=>{if(o.name==='HorseBody')skin=o;});
if(!skin?.isSkinnedMesh||skin.skeleton.bones.length!==68)throw new Error('Actual 68-joint dragon rig required');
const motion=createDragonMotion({THREE,root:gltf.scene,skin,heightM:profile.heightM,profile});
const append=(values,type,columns)=>{
 const padding=(4-binary.length%4)%4;binary=Buffer.concat([binary,Buffer.alloc(padding)]);
 const data=Buffer.from(new Float32Array(values).buffer),view=doc.bufferViews.length;
 doc.bufferViews.push({buffer:0,byteOffset:binary.length,byteLength:data.length});binary=Buffer.concat([binary,data]);
 const accessor={bufferView:view,componentType:5126,count:values.length/columns,type};
 if(type==='SCALAR'){accessor.min=[Math.min(...values)];accessor.max=[Math.max(...values)];}
 doc.accessors.push(accessor);return doc.accessors.length-1;
};
const ease=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
const definitions=[
 {name:'Rest',gait:'rest',duration:1,loop:true},
 {name:'Idle',gait:'stand',duration:8,loop:true},
 {name:'Walk',gait:'walk',duration:2/motion.gaits.walk.hz,loop:true},
 {name:'Trot',gait:'trot',duration:2/motion.gaits.trot.hz,loop:true},
 {name:'Canter_Left',gait:'canter',lead:'left',duration:2/motion.gaits.canter.hz,loop:true},
 {name:'Canter_Right',gait:'canter',lead:'right',duration:2/motion.gaits.canter.hz,loop:true},
 {name:'Gallop_Left',gait:'gallop',lead:'left',duration:2/motion.gaits.gallop.hz,loop:true},
 {name:'Gallop_Right',gait:'gallop',lead:'right',duration:2/motion.gaits.gallop.hz,loop:true},
 {name:'Jump',gait:'jump',duration:1.75},
 {name:'Takeoff',flight:'takeoff',duration:1.15},
 {name:'Fly',flight:'flight',duration:1/1.35*2,loop:true},
 {name:'Land',flight:'land',duration:2}
];
const validations=[];doc.animations=[];
for(const spec of definitions){
 motion.reset();motion.set(spec.gait||'stand',{lead:spec.lead||'left'});
 if(spec.flight==='flight'||spec.flight==='land')for(let i=0;i<180;i++){motion.setFlight({flying:true,altitude:3,verticalSpeed:0,speedMps:6});motion.update(1/120);}
 else if(spec.loop&&spec.gait!=='rest'){const settleSeconds=Math.max(2,3/(motion.gaits[spec.gait].hz||.5)),steps=Math.ceil(settleSeconds*240);for(let i=0;i<steps;i++)motion.update(1/240);}
 const sampleHz=spec.flight||['rest','stand'].includes(spec.gait)?60:240,frames=Math.ceil(spec.duration*sampleHz),dt=spec.duration/frames,times=[],poses=[];
 for(let i=0;i<=frames;i++){
  const age=i*dt;
  if(spec.flight==='takeoff')motion.setFlight({flying:true,altitude:3*ease(age/1.15),verticalSpeed:4,speedMps:4});
  if(spec.flight==='flight')motion.setFlight({flying:true,altitude:3,verticalSpeed:0,speedMps:6});
  if(spec.flight==='land')motion.setFlight({flying:age<.95,altitude:age<.95?3*(1-ease(age/.95)):0,verticalSpeed:age<.95?-2:0,speedMps:3});
  motion.update(i===0?0:dt);const snap=motion.snapshot();
  if(!snap.localPositions.flat().every(Number.isFinite)||!snap.localQuaternions.flat().every(Number.isFinite))throw new Error(spec.name+' nonfinite sample');
  times.push(age);poses.push(snap);
 }
 // Loop three settled locomotion periods before capture. Keep the exact
 // anatomical trajectory; only noncontact secondary joints receive a seam.
 // Interpolating arbitrary foot/root poses at the seam can penetrate ground.
 const firstPose=poses[0],lastPose=poses.at(-1),loopAnatomicalDelta=spec.loop?Math.max(...skin.skeleton.bones.map((bone,b)=>/^ear/.test(bone.name)&&!spec.flight?0:Math.max(...lastPose.localPositions[b].map((v,k)=>Math.abs(v-firstPose.localPositions[b][k])),1-Math.abs(new THREE.Quaternion().fromArray(lastPose.localQuaternions[b]).dot(new THREE.Quaternion().fromArray(firstPose.localQuaternions[b])))))):0;
 if(spec.loop&&!spec.flight&&loopAnatomicalDelta>1e-5)throw new Error(spec.name+' unstable anatomical loop closure '+loopAnatomicalDelta);
 if(spec.loop){const first=poses[0];for(let i=0;i<poses.length;i++){const weight=ease((times[i]-(spec.duration-.16))/.16);if(!weight)continue;for(let b=0;b<skin.skeleton.bones.length;b++){if(!spec.flight&&!/^ear/.test(skin.skeleton.bones[b].name))continue;const p=new THREE.Vector3().fromArray(poses[i].localPositions[b]).lerp(new THREE.Vector3().fromArray(first.localPositions[b]),weight);const q=new THREE.Quaternion().fromArray(poses[i].localQuaternions[b]).slerp(new THREE.Quaternion().fromArray(first.localQuaternions[b]),weight);poses[i].localPositions[b]=p.toArray();poses[i].localQuaternions[b]=q.toArray();}}}
 const input=append(times,'SCALAR',1),animation={name:spec.name,samplers:[],channels:[],extras:{loop:!!spec.loop,generatedBy:'bake-imported-dragon-clips.mjs',motionKind:'actual dragon anatomical core and real wings',sampleHz}};
 let maxQuaternionNormError=0;
 for(let b=0;b<skin.skeleton.bones.length;b++){
  const translations=poses.flatMap(p=>p.localPositions[b]),quaternions=[];let previous=null;
  for(const pose of poses){const q=new THREE.Quaternion().fromArray(pose.localQuaternions[b]);maxQuaternionNormError=Math.max(maxQuaternionNormError,Math.abs(q.length()-1));if(previous&&previous.dot(q)<0)q.set(-q.x,-q.y,-q.z,-q.w);quaternions.push(...q.toArray());previous=q;}
  for(const [values,type,columns,targetPath]of [[translations,'VEC3',3,'translation'],[quaternions,'VEC4',4,'rotation']]){
   const sampler=animation.samplers.length;animation.samplers.push({input,output:append(values,type,columns),interpolation:'LINEAR'});animation.channels.push({sampler,target:{node:doc.skins[0].joints[b],path:targetPath}});
  }
 }
 doc.animations.push(animation);validations.push({name:spec.name,duration:spec.duration,frames:frames+1,joints:68,loop:!!spec.loop,sampleHz,loopAnatomicalDelta,maxQuaternionNormError,finite:true});
}
const codeSha=crypto.createHash('sha256').update(source('assets/dragon-horse-motion.js')).digest('hex');
doc.extras.bakedGameClips={version:1,motionCodeSha256:codeSha,clips:validations};
binary=Buffer.concat([binary,Buffer.alloc((4-binary.length%4)%4)]);doc.buffers[0].byteLength=binary.length;
let json=Buffer.from(JSON.stringify(doc));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);
const header=Buffer.alloc(12),jh=Buffer.alloc(8),bh=Buffer.alloc(8);header.write('glTF');header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+binary.length,8);jh.writeUInt32LE(json.length);jh.writeUInt32LE(0x4e4f534a,4);bh.writeUInt32LE(binary.length);bh.writeUInt32LE(0x004e4942,4);
const output=Buffer.concat([header,jh,json,bh,binary]),sha256=crypto.createHash('sha256').update(output).digest('hex');fs.writeFileSync(path.join(base,'dragon.glb'),output);
profile.sha256=sha256;profile.clips=validations.map(c=>c.name);profile.gaitImplementation='assets/dragon-horse-motion.js around the40-joint anatomical ground solver plus28 real source wing joints';profile.motionStatus='Live grounded and flight motions with twelve playable baked clips; offline gait, rider envelope and ordinary render reviews; browser integration pending';profile.motionValidation='motion-qa.json';profile.clipValidation='clip-validation.json';fs.writeFileSync(path.join(base,'profile.json'),JSON.stringify(profile,null,2)+'\n');
const report=JSON.parse(fs.readFileSync(path.join(base,'conversion.json')));report.gameSha256=sha256;report.bakedClips={motionCodeSha256:codeSha,clips:validations};report.animations='Source Scene retained in immutable original; twelve independently baked game clips from anatomical and dragon flight motion';fs.writeFileSync(path.join(base,'conversion.json'),JSON.stringify(report,null,2)+'\n');
fs.writeFileSync(path.join(base,'clip-validation.json'),JSON.stringify({gameSha256:sha256,motionCodeSha256:codeSha,clips:validations,originalSourceModified:false,generativeToolsUsed:false,noAI:true},null,2)+'\n');
console.log(JSON.stringify({sha256,bytes:output.length,clips:profile.clips,validations}));

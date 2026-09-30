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
const {createFeatherWingMotion}=await import(pathToFileURL(path.join(root,'assets/feather-wing-motion.js')).href);
const base=path.join(root,'assets/models/horse-imports/cgcookie-wings/game');
const profile=JSON.parse(fs.readFileSync(path.join(base,'profile.json')));
const bytes=fs.readFileSync(path.join(base,'wings.glb'));
const jsLength=bytes.readUInt32LE(12),doc=JSON.parse(bytes.subarray(20,20+jsLength)),binOffset=20+jsLength;
if(doc.animations?.length)throw new Error('Run rig-cgcookie-wings.py first to rebuild the derivative before rebaking clips.');
let binary=Buffer.from(bytes.subarray(binOffset+8,binOffset+8+bytes.readUInt32LE(binOffset)));
const loader=new GLTFLoader();loader.register(parser=>({name:'CLIP_BAKE_GEOMETRY_ONLY',loadTexture(){return Promise.resolve(new THREE.Texture());}}));
const gltf=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
let skin;gltf.scene.traverse(o=>{if(!skin&&o.isSkinnedMesh)skin=o;});
if(!skin?.isSkinnedMesh||skin.skeleton.bones.length!==105)throw new Error('Actual 105-joint feather-wing rig required');
const motion=createFeatherWingMotion({THREE,root:gltf.scene,profile});
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
 {name:'Rest',rest:true,duration:1,loop:true},
 {name:'Folded_Idle',duration:4,loop:true},
 {name:'Takeoff',flight:'takeoff',duration:1.15},
 {name:'Fly',flight:'flight',duration:2/1.31,loop:true},
 {name:'Land',flight:'land',duration:2}
];
const validations=[];doc.animations=[];
for(const spec of definitions){
 motion.reset();if(spec.rest)motion.setRest(true);
 if(spec.flight==='flight'||spec.flight==='land')for(let i=0;i<180;i++){motion.setFlight({flying:true,altitude:3,verticalSpeed:0,speedMps:6});motion.update(1/120);}
 else if(spec.loop&&!spec.rest)for(let i=0;i<120;i++)motion.update(1/120);
 const frames=Math.ceil(spec.duration*30),dt=spec.duration/frames,times=[],poses=[];
 for(let i=0;i<=frames;i++){
  const age=i*dt;
  if(spec.flight==='takeoff')motion.setFlight({flying:true,altitude:3*ease(age/1.15),verticalSpeed:4,speedMps:4});
  if(spec.flight==='flight')motion.setFlight({flying:true,altitude:3,verticalSpeed:0,speedMps:6});
  if(spec.flight==='land')motion.setFlight({flying:age<.95,altitude:age<.95?3*(1-ease(age/.95)):0,verticalSpeed:age<.95?-2:0,speedMps:3});
  motion.update(i===0?0:dt);const snap=motion.snapshot();
  if(!snap.localPositions.flat().every(Number.isFinite)||!snap.localQuaternions.flat().every(Number.isFinite))throw new Error(spec.name+' nonfinite sample');
  times.push(age);poses.push(snap);
 }
 // Smoothly close the loop's small secondary breathing/tail differences. The
 // locomotion periods contain exactly two complete gait cycles.
 if(spec.loop){const first=poses[0];for(let i=0;i<poses.length;i++){const weight=ease((times[i]-(spec.duration-.16))/.16);if(!weight)continue;for(let b=0;b<skin.skeleton.bones.length;b++){const p=new THREE.Vector3().fromArray(poses[i].localPositions[b]).lerp(new THREE.Vector3().fromArray(first.localPositions[b]),weight);const q=new THREE.Quaternion().fromArray(poses[i].localQuaternions[b]).slerp(new THREE.Quaternion().fromArray(first.localQuaternions[b]),weight);poses[i].localPositions[b]=p.toArray();poses[i].localQuaternions[b]=q.toArray();}}}
 const input=append(times,'SCALAR',1),animation={name:spec.name,samplers:[],channels:[],extras:{loop:!!spec.loop,generatedBy:'bake-cgcookie-wing-clips.mjs',motionKind:'actual neutral CGCookie feather wing pair'}};
 let maxQuaternionNormError=0;
 for(let b=0;b<skin.skeleton.bones.length;b++){
  const translations=poses.flatMap(p=>p.localPositions[b]),quaternions=[];let previous=null;
  for(const pose of poses){const q=new THREE.Quaternion().fromArray(pose.localQuaternions[b]);maxQuaternionNormError=Math.max(maxQuaternionNormError,Math.abs(q.length()-1));if(previous&&previous.dot(q)<0)q.set(-q.x,-q.y,-q.z,-q.w);quaternions.push(...q.toArray());previous=q;}
  for(const [values,type,columns,targetPath]of [[translations,'VEC3',3,'translation'],[quaternions,'VEC4',4,'rotation']]){
   const sampler=animation.samplers.length;animation.samplers.push({input,output:append(values,type,columns),interpolation:'LINEAR'});animation.channels.push({sampler,target:{node:doc.skins[0].joints[b],path:targetPath}});
  }
 }
 doc.animations.push(animation);validations.push({name:spec.name,duration:spec.duration,frames:frames+1,joints:105,loop:!!spec.loop,maxQuaternionNormError,finite:true});
}
const codeSha=crypto.createHash('sha256').update(source('assets/feather-wing-motion.js')).digest('hex');
doc.extras.bakedGameClips={version:1,motionCodeSha256:codeSha,clips:validations};
binary=Buffer.concat([binary,Buffer.alloc((4-binary.length%4)%4)]);doc.buffers[0].byteLength=binary.length;
let json=Buffer.from(JSON.stringify(doc));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);
const header=Buffer.alloc(12),jh=Buffer.alloc(8),bh=Buffer.alloc(8);header.write('glTF');header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+binary.length,8);jh.writeUInt32LE(json.length);jh.writeUInt32LE(0x4e4f534a,4);bh.writeUInt32LE(binary.length);bh.writeUInt32LE(0x004e4942,4);
const output=Buffer.concat([header,jh,json,bh,binary]),sha256=crypto.createHash('sha256').update(output).digest('hex');fs.writeFileSync(path.join(base,'wings.glb'),output);
profile.sha256=sha256;profile.clips=validations.map(c=>c.name);profile.gaitImplementation='assets/feather-wing-motion.js: source wing chains and96 real feather fan joints, chest-mounted component';profile.motionStatus='Live folding, feather fanning and flight stages with five playable component clips; body flight wrapper provided; mounted host and rider review tracked separately';profile.motionValidation='motion-qa.json';profile.clipValidation='clip-validation.json';fs.writeFileSync(path.join(base,'profile.json'),JSON.stringify(profile,null,2)+'\n');
const report=JSON.parse(fs.readFileSync(path.join(base,'conversion.json')));report.gameSha256=sha256;report.bakedClips={motionCodeSha256:codeSha,clips:validations};report.animations='Original source has no actions; five independently baked articulated wing component clips';fs.writeFileSync(path.join(base,'conversion.json'),JSON.stringify(report,null,2)+'\n');
fs.writeFileSync(path.join(base,'clip-validation.json'),JSON.stringify({gameSha256:sha256,motionCodeSha256:codeSha,clips:validations,originalSourceModified:false,generativeToolsUsed:false,sourceZipPreserved:true},null,2)+'\n');
console.log(JSON.stringify({sha256,bytes:output.length,clips:profile.clips,validations}));

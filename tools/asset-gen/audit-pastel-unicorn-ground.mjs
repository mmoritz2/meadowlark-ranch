// Exact all-vertex finite Mixer audit, batching identical skin ownership only.
// Every selected source vertex is still evaluated at every 240Hz sample. Direct
// affine skin arithmetic is cross-checked with Three.getVertexPosition per frame.
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),base=path.join(root,'assets/models/horse-imports/pastel-unicorn/game');
const profile=JSON.parse(fs.readFileSync(path.join(base,'profile.json'))),bytes=fs.readFileSync(path.join(base,profile.file)),sha=crypto.createHash('sha256').update(bytes).digest('hex');
if(sha!==profile.sha256)throw Error('Animated SHA mismatch');
const threeURL=pathToFileURL(path.join(root,'assets/vendor/three/build/three.module.js')).href,THREE=await import(threeURL),module=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const utils=module(fs.readFileSync(path.join(root,'assets/vendor/three/examples/jsm/utils/BufferGeometryUtils.js'),'utf8').replace("from 'three'",`from '${threeURL}'`));
const loaderURL=module(fs.readFileSync(path.join(root,'assets/vendor/three/examples/jsm/loaders/GLTFLoader.js'),'utf8').replace("from 'three'",`from '${threeURL}'`).replace("from '../utils/BufferGeometryUtils.js'",`from '${utils}'`)),{GLTFLoader}=await import(loaderURL),loader=new GLTFLoader();
loader.register(()=>({name:'CONTACT_GEOMETRY_ONLY',loadTexture(){return Promise.resolve(new THREE.Texture());}}));
const gltf=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),''),mixer=new THREE.AnimationMixer(gltf.scene),point=new THREE.Vector3(),samples=[];
gltf.scene.updateMatrixWorld(true);
gltf.scene.traverse(mesh=>{
 const groom=/^HorseGroom/.test(mesh.name);if(!mesh.isSkinnedMesh||(!/^HorseBody/.test(mesh.name)&&!groom))return;
 const p=mesh.geometry.attributes.position,j=mesh.geometry.attributes.skinIndex,w=mesh.geometry.attributes.skinWeight,groups=new Map();let selected=0;
 for(let i=0;i<p.count;i++){
  if(!groom&&p.getY(i)>=.35)continue;selected++;
  const joints=[j.getX(i),j.getY(i),j.getZ(i),j.getW(i)],weights=[w.getX(i),w.getY(i),w.getZ(i),w.getW(i)],key=joints.join(',')+'/'+weights.join(',');
  let group=groups.get(key);if(!group){group={joints,weights,list:[],indices:[]};groups.set(key,group);}
  point.fromBufferAttribute(p,i).applyMatrix4(mesh.bindMatrix);group.list.push(point.x,point.y,point.z);group.indices.push(i);
 }
 const compiled=[...groups.values()].map(g=>({...g,positions:Float64Array.from(g.list),indices:g.indices}));for(const g of compiled)delete g.list;
 if(selected)samples.push({mesh,groom,groups:compiled,selected});
});
let maxReferenceError=0;const A=new THREE.Matrix4(),coeff=new Float64Array(4),rows=[];
for(const clip of gltf.animations){
 mixer.stopAllAction();const action=mixer.clipAction(clip);action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();
 const row={clip:clip.name,duration:clip.duration,frames:0,minLowerLegY:Infinity,minTailY:null,worstTime:0,nonfinite:false};
 for(let frame=0;frame<=Math.ceil(clip.duration*240);frame++){
  const time=Math.min(frame/240,clip.duration);mixer.setTime(time);gltf.scene.updateMatrixWorld(true);row.frames++;
  for(const sample of samples){const mesh=sample.mesh;mesh.skeleton.update();A.multiplyMatrices(mesh.matrixWorld,mesh.bindMatrixInverse);const ae=A.elements,bones=mesh.skeleton.boneMatrices;
   for(let gi=0;gi<sample.groups.length;gi++){const group=sample.groups[gi];coeff.fill(0);coeff[3]=ae[13];
    for(let influence=0;influence<4;influence++){const weight=group.weights[influence];if(!weight)continue;const off=group.joints[influence]*16;
     for(let col=0;col<4;col++)coeff[col]+=weight*(ae[1]*bones[off+col*4]+ae[5]*bones[off+col*4+1]+ae[9]*bones[off+col*4+2]);
    }
    const pp=group.positions;let minimum=Infinity;
    for(let v=0;v<pp.length;v+=3){const y=coeff[0]*pp[v]+coeff[1]*pp[v+1]+coeff[2]*pp[v+2]+coeff[3];if(!Number.isFinite(y))row.nonfinite=true;if(y<minimum)minimum=y;}
    if(sample.groom)row.minTailY=row.minTailY===null?minimum:Math.min(row.minTailY,minimum);else if(minimum<row.minLowerLegY){row.minLowerLegY=minimum;row.worstTime=time;}
    // Reference multiple ownership groups at every time, not only the bind pose.
    if(gi===0||gi===sample.groups.length-1||gi===Math.floor(sample.groups.length/2)){
     mesh.getVertexPosition(group.indices[0],point);mesh.localToWorld(point);const y=coeff[0]*pp[0]+coeff[1]*pp[1]+coeff[2]*pp[2]+coeff[3];maxReferenceError=Math.max(maxReferenceError,Math.abs(y-point.y));
    }
   }
  }
 }
 rows.push(row);console.log(JSON.stringify({completed:clip.name,minBody:row.minLowerLegY,minGroom:row.minTailY,maxReferenceError}));
}
const checks={allNineStoredClips:rows.length===9,finite:rows.every(r=>!r.nonfinite),lowerLegWithin6mm:rows.every(r=>r.minLowerLegY>=-.006),longTailWithin6mm:rows.every(r=>r.minTailY===null||r.minTailY>=-.006),batchedSkinMatchesActualThree:maxReferenceError<2e-6};
const report={id:'pastel-unicorn',animatedSha256:sha,sampleHz:240,actualAnimationMixer:true,everySelectedVertexEverySample:true,method:'All actual groom/lower-leg vertices; exact identical skin ownership batching, affine deformed positions cross-checked against Three.getVertexPosition throughout every clip.',maxReferenceErrorM:maxReferenceError,checks,passed:Object.values(checks).every(Boolean),selectedSurfaces:samples.map(s=>({mesh:s.mesh.name,vertices:s.selected,ownershipGroups:s.groups.length,selection:s.groom?'Every actual source-derived groom vertex.':'Original raw lower-leg surfaces below .35m.'})),rows};
fs.writeFileSync(path.join(base,'baked-ground-validation.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,checks}));if(!report.passed)process.exitCode=1;

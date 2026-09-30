// Actual stored AnimationMixer playback, including between-key deformation.
// Source-neutral CPU geometry evaluation; no texture/image edits or browser auth.
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),id='arabian-sculpt';
if(!['ikkiz-unicorn','horse-skeleton','arabian-sculpt','fjord-sculpt','pastel-unicorn'].includes(id))throw Error('Expected a registered canonical imported rig');
const base=path.join(root,'assets/models/horse-imports',id,'game'),profile=JSON.parse(fs.readFileSync(path.join(base,'profile.json'))),bytes=fs.readFileSync(path.join(base,profile.file)),sha=crypto.createHash('sha256').update(bytes).digest('hex');
if(sha!==profile.sha256)throw Error('Animated file/hash mismatch');
const threeURL=pathToFileURL(path.join(root,'assets/vendor/three/build/three.module.js')).href,THREE=await import(threeURL),module=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const utils=module(fs.readFileSync(path.join(root,'assets/vendor/three/examples/jsm/utils/BufferGeometryUtils.js'),'utf8').replace("from 'three'",`from '${threeURL}'`));
const loaderURL=module(fs.readFileSync(path.join(root,'assets/vendor/three/examples/jsm/loaders/GLTFLoader.js'),'utf8').replace("from 'three'",`from '${threeURL}'`).replace("from '../utils/BufferGeometryUtils.js'",`from '${utils}'`)),{GLTFLoader}=await import(loaderURL),loader=new GLTFLoader();
loader.register(()=>({name:'CONTACT_GEOMETRY_ONLY',loadTexture(){return Promise.resolve(new THREE.Texture());}}));
const gltf=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),''),mixer=new THREE.AnimationMixer(gltf.scene),point=new THREE.Vector3(),samples=[];
gltf.scene.updateMatrixWorld(true);
const newSource=['arabian-sculpt','fjord-sculpt','pastel-unicorn'].includes(id);
gltf.scene.traverse(mesh=>{const groom=mesh.name==='HorseGroom_ogon'||newSource&&/Groom|mane|tail|feather/i.test(mesh.name+' '+mesh.parent?.name);if(!mesh.isSkinnedMesh||(!/^HorseBody/.test(mesh.name)&&!groom))return;const vertices=[],p=mesh.geometry.attributes.position,limit=Infinity;for(let i=0;i<p.count;i++)if(p.getY(i)<limit)vertices.push(i);if(vertices.length)samples.push({mesh,vertices,groom});});
if(!samples.some(s=>s.mesh.name==='HorseBody'))throw Error('No actual body surface');
const rows=[];
for(const clip of gltf.animations){mixer.stopAllAction();const action=mixer.clipAction(clip);action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();const row={clip:clip.name,duration:clip.duration,frames:0,minBodyY:Infinity,minTailY:null,worstTime:0,nonfinite:false};
 for(let i=0;i<=Math.ceil(clip.duration*240);i++){const time=Math.min(i/240,clip.duration);mixer.setTime(time);gltf.scene.updateMatrixWorld(true);row.frames++;for(const sample of samples)for(const index of sample.vertices){sample.mesh.getVertexPosition(index,point);sample.mesh.localToWorld(point);if(!point.toArray().every(Number.isFinite))row.nonfinite=true;if(sample.groom)row.minTailY=row.minTailY===null?point.y:Math.min(row.minTailY,point.y);else if(point.y<row.minBodyY){row.minBodyY=point.y;row.worstTime=time;}}}
 rows.push(row);
}
const checks={allNineStoredClips:rows.length===9,finite:rows.every(r=>!r.nonfinite),wholeBodyWithin6mm:rows.every(r=>r.minBodyY>=-.006),longTailWithin6mm:rows.every(r=>r.minTailY===null||r.minTailY>=-.006)};
const report={id,animatedSha256:sha,sampleHz:240,checks,passed:Object.values(checks).every(Boolean),selectedSurfaces:samples.map(s=>({mesh:s.mesh.name,vertices:s.vertices.length,selection:s.groom?(newSource?'Every actual source-derived groom vertex.':'Actual tail fibers below .60m.'):'Every actual source-derived game body vertex, including sculpted high tail.'})),rows};
fs.writeFileSync(path.join(base,'full-surface-baked-ground-validation.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));if(!report.passed)process.exitCode=1;

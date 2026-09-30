/* Offline numerical rig QA using the exact vendored Three loader and motion
 * code. Texture stubs are strictly for geometry: this does not certify visual
 * appearance, shader compatibility or rendered flight quality. */
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
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
const loader=new GLTFLoader();
loader.register(parser=>({name:'DRAGON_GEOMETRY_ONLY',loadTexture(index){return Promise.resolve(new THREE.Texture());}}));
const bytes=fs.readFileSync(path.join(base,'dragon.glb'));
const gltf=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
let skin;gltf.scene.traverse(o=>{if(o.name==='HorseBody')skin=o;});
if(!skin?.isSkinnedMesh)throw new Error('Actual dragon body missing');
gltf.scene.updateMatrixWorld(true);
const motion=createDragonMotion({THREE,root:gltf.scene,skin,heightM:profile.heightM,profile});
const failures=[];
function requireResult(ok,message){if(!ok)failures.push(message);}
const poseFiles=[];
function writePose(name){
 if(!process.argv.includes('--write-poses'))return;
 const jsLength=bytes.readUInt32LE(12),doc=JSON.parse(bytes.subarray(20,20+jsLength)),binOffset=20+jsLength;
 let binary=Buffer.from(bytes.subarray(binOffset+8,binOffset+8+bytes.readUInt32LE(binOffset)));
 const append=(values,type,columns)=>{
  binary=Buffer.concat([binary,Buffer.alloc((-binary.length)%4+4).subarray(0,(4-binary.length%4)%4)]);
  const data=Buffer.from(new Float32Array(values).buffer),view=doc.bufferViews.length;
  doc.bufferViews.push({buffer:0,byteOffset:binary.length,byteLength:data.length});binary=Buffer.concat([binary,data]);
  const entry={bufferView:view,componentType:5126,count:values.length/columns,type};
  if(type==='VEC3'){entry.min=[0,1,2].map(k=>{let value=Infinity;for(let i=k;i<values.length;i+=3)value=Math.min(value,values[i]);return value;});entry.max=[0,1,2].map(k=>{let value=-Infinity;for(let i=k;i<values.length;i+=3)value=Math.max(value,values[i]);return value;});}
  doc.accessors.push(entry);return doc.accessors.length-1;
 };
 const meshes=[];gltf.scene.traverse(o=>{if(o.isSkinnedMesh)meshes.push(o);});
 const temp=new THREE.Vector3(),normal=new THREE.Vector3(),matrix=new THREE.Matrix4(),blend=new THREE.Matrix4(),nmat=new THREE.Matrix3();
 for(let mi=0;mi<doc.meshes.length;mi++){
  const mesh=meshes.find(o=>o.name===doc.meshes[mi].name),geo=mesh.geometry,positions=[],normals=[],tangents=[];
  for(let i=0;i<geo.attributes.position.count;i++){
   mesh.getVertexPosition(i,temp);mesh.localToWorld(temp);positions.push(...temp.toArray());
   blend.elements.fill(0);
   for(let k=0;k<4;k++){
    const bone=geo.attributes.skinIndex.getComponent(i,k),weight=geo.attributes.skinWeight.getComponent(i,k);if(!weight)continue;
    matrix.multiplyMatrices(mesh.skeleton.bones[bone].matrixWorld,mesh.skeleton.boneInverses[bone]);
    for(let c=0;c<16;c++)blend.elements[c]+=matrix.elements[c]*weight;
   }
   nmat.setFromMatrix4(blend);normal.fromBufferAttribute(geo.attributes.normal,i).applyMatrix3(nmat).normalize();normals.push(...normal.toArray());
   if(geo.attributes.tangent){normal.fromBufferAttribute(geo.attributes.tangent,i).applyMatrix3(nmat).normalize();tangents.push(...normal.toArray(),geo.attributes.tangent.getW(i));}
  }
  const p=doc.meshes[mi].primitives[0];p.attributes.POSITION=append(positions,'VEC3',3);p.attributes.NORMAL=append(normals,'VEC3',3);
  if(tangents.length)p.attributes.TANGENT=append(tangents,'VEC4',4);
  delete p.attributes.JOINTS_0;delete p.attributes.WEIGHTS_0;
 }
 delete doc.skins;delete doc.animations;
 doc.nodes=doc.meshes.map((m,i)=>({name:m.name,mesh:i}));doc.scenes=[{name:'Review-only actual dragon '+name,nodes:doc.nodes.map((_,i)=>i)}];doc.scene=0;
 doc.extras.reviewPose={name,staticMeshForOrdinaryRendering:true,motionSnapshot:motion.snapshot()};
 binary=Buffer.concat([binary,Buffer.alloc((4-binary.length%4)%4)]);doc.buffers[0].byteLength=binary.length;
 let json=Buffer.from(JSON.stringify(doc));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);
 const header=Buffer.alloc(12),jh=Buffer.alloc(8),bh=Buffer.alloc(8);header.write('glTF');header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+binary.length,8);jh.writeUInt32LE(json.length);jh.writeUInt32LE(0x4e4f534a,4);bh.writeUInt32LE(binary.length);bh.writeUInt32LE(0x004e4942,4);
 const directory='/private/tmp/horse-import-tools/dragon-rig-qa';fs.mkdirSync(directory,{recursive:true});const filename=path.join(directory,name+'.glb');fs.writeFileSync(filename,Buffer.concat([header,jh,json,bh,binary]));poseFiles.push(filename);
}
const meshBounds=()=>{const box=new THREE.Box3(),point=new THREE.Vector3();gltf.scene.traverse(o=>{if(o.isSkinnedMesh){for(let i=0;i<o.geometry.attributes.position.count;i++){o.getVertexPosition(i,point);o.localToWorld(point);box.expandByPoint(point);}}});return {min:box.min.toArray(),max:box.max.toArray(),size:box.getSize(new THREE.Vector3()).toArray()};};
function riderWingClearance(){
 const seat=profile.anchors.saddle[0],index=skin.skeleton.bones.findIndex(b=>b.name==='spine'),bone=skin.skeleton.bones[index],bind=new THREE.Matrix4().multiplyMatrices(bone.matrixWorld,skin.skeleton.boneInverses[index]).multiply(skin.bindMatrix),box=new THREE.Box3();
 for(const x of [-.25,.25])for(const y of [seat[1]+.10,seat[1]+1.12])for(const z of [seat[2]-.25,seat[2]+.25])box.expandByPoint(new THREE.Vector3(x,y,z).applyMatrix4(bind));
 let intersections=0,vertices=0;const triangle=new THREE.Triangle(),meshes=[];gltf.scene.traverse(o=>{if(o.isSkinnedMesh)meshes.push(o);});
 for(const mesh of meshes){
  const g=mesh.geometry,points=[],owns=[];
  for(let i=0;i<g.attributes.position.count;i++){
   const point=new THREE.Vector3();mesh.getVertexPosition(i,point);mesh.localToWorld(point);points.push(point);let w=0;
   for(let k=0;k<4;k++)if(/^wing/.test(mesh.skeleton.bones[g.attributes.skinIndex.getComponent(i,k)].name))w+=g.attributes.skinWeight.getComponent(i,k);
   owns.push(w>.7);if(w>.7&&box.containsPoint(point))vertices++;
  }
  for(let i=0;i<g.index.count;i+=3){const ids=[0,1,2].map(k=>g.index.getX(i+k));if(ids.filter(j=>owns[j]).length<2)continue;triangle.set(...ids.map(j=>points[j]));if(box.intersectsTriangle(triangle))intersections++;}
 }
 return{intersections,vertices,riderEnvelope:{min:box.min.toArray(),max:box.max.toArray()}};
}
if(process.argv.includes('--optimize-fold')){
 const results=[];
 for(const shoulder of [1.20,1.38,1.52,1.68])for(const elbow of [1.75,2.10,2.40,2.70])for(const wrist of [.35,.70,1.05,1.40]){
  profile.dragonRig.fold={shoulder,elbow,wrist,webScale:1};motion.set('rest');motion.update(0);motion.reset();const bounds=meshBounds(),clearance=riderWingClearance();
  results.push({fold:profile.dragonRig.fold,bounds,clearance,score:clearance.intersections*8+bounds.size[0]+Math.max(0,bounds.max[1]-3.25)*4});
 }
 results.sort((a,b)=>a.score-b.score);profile.dragonRig.fold=results[0].fold;
 fs.writeFileSync(path.join(base,'fold-optimization.json'),JSON.stringify({best:results[0],alternatives:results.slice(1,10)},null,2)+'\n');
 fs.writeFileSync(path.join(base,'profile.json'),JSON.stringify(profile,null,2)+'\n');console.log('FOLD_OPTIMIZATION',JSON.stringify(results[0]));
}

if(process.argv.includes('--optimize-spatial')){
 const ranges={shoulder:[.4,2.9],elbow:[1.0,3.8],wrist:[-1,3.5],shoulderRoll:[-.7,.7],elbowRoll:[-1.4,1.4],wristRoll:[-1.4,1.4],shoulderPitch:[-.6,.6],elbowPitch:[-.9,.9],wristPitch:[-.9,.9]};
 let seed=93147;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const meshes=[];gltf.scene.traverse(o=>{if(o.isSkinnedMesh)meshes.push(o);});
 const selected=[];for(const m of meshes){const g=m.geometry;for(let i=0;i<g.attributes.position.count;i++){let w=0;for(let k=0;k<4;k++)if(/^wing/.test(m.skeleton.bones[g.attributes.skinIndex.getComponent(i,k)].name))w+=g.attributes.skinWeight.getComponent(i,k);if(w>.05&&i%2===0)selected.push([m,i]);}}
 const seat=profile.anchors.saddle[0],riderBox=new THREE.Box3(new THREE.Vector3(-.28,seat[1]+.08,seat[2]-.32),new THREE.Vector3(.28,seat[1]+1.15,seat[2]+.32)),point=new THREE.Vector3();
 const results=[];
 function assess(fold){
  profile.dragonRig.fold=fold;motion.set('rest');motion.update(0);motion.reset();const box=new THREE.Box3();let collisions=0;
  for(const [mesh,i] of selected){mesh.getVertexPosition(i,point);mesh.localToWorld(point);box.expandByPoint(point);if(riderBox.containsPoint(point))collisions++;}
  const width=box.max.x-box.min.x,height=box.max.y,length=box.max.z-box.min.z;
  const score=width+Math.max(height-3.4,0)*12+Math.max(0,-box.min.y)*25+Math.max(length-10.5,0)*3+Math.max(box.max.z-.95,0)*15+collisions*1.5;
  const r={fold:{...fold},score,bounds:{min:box.min.toArray(),max:box.max.toArray(),size:box.getSize(new THREE.Vector3()).toArray()},sampledRiderVertices:collisions};results.push(r);return r;
 }
 assess(profile.dragonRig.fold);
 for(let i=0;i<1400;i++){const fold={webScale:1};for(const [k,[lo,hi]]of Object.entries(ranges))fold[k]=lo+(hi-lo)*random();assess(fold);}
 results.sort((a,b)=>a.score-b.score);let best=results[0];
 for(let pass=0;pass<20;pass++){let changed=false;const step=Math.pow(.78,pass)*.38;for(const key of Object.keys(ranges))for(const sign of [-1,1]){const fold={...best.fold};fold[key]=Math.max(ranges[key][0],Math.min(ranges[key][1],fold[key]+sign*step));const r=assess(fold);if(r.score<best.score){best=r;changed=true;}}if(!changed&&pass>8)break;}
 results.sort((a,b)=>a.score-b.score);const audited=[];
 for(const r of results.slice(0,32)){profile.dragonRig.fold=r.fold;motion.set('rest');motion.update(0);motion.reset();const bounds=meshBounds(),clearance=riderWingClearance();audited.push({...r,bounds,clearance,fullScore:r.score+clearance.intersections*.8});}
 audited.sort((a,b)=>a.fullScore-b.fullScore);profile.dragonRig.fold=audited[0].fold;
 fs.writeFileSync(path.join(base,'fold-spatial-optimization.json'),JSON.stringify({best:audited[0],alternatives:audited.slice(1,10)},null,2)+'\n');fs.writeFileSync(path.join(base,'profile.json'),JSON.stringify(profile,null,2)+'\n');console.log('SPATIAL_FOLD_OPTIMIZATION',JSON.stringify(audited[0]));
}
const gaits=[];
for(const [gait,lead]of [['stand','left'],['walk','left'],['trot','left'],['canter','left'],['canter','right'],['gallop','left'],['gallop','right'],['jump','left']]){
 motion.reset();motion.set(gait,{lead});let maxSoleError=0,maxReachError=0,minSoleY=0,maxJointLengthError=0,finite=true;
 const bones=skin.skeleton.bones,parents=bones.map(b=>bones.indexOf(b.parent)),lengths=bones.map(b=>b.position.length());
 const reachByFoot={};
 for(let i=0;i<240;i++){
  motion.update(1/120);const s=motion.snapshot();finite&&=s.localPositions.flat().every(Number.isFinite)&&s.localQuaternions.flat().every(Number.isFinite);
  for(let j=0;j<bones.length;j++)if(parents[j]>=0&&/^(FL|FR|HL|HR)/.test(bones[j].name)&&!bones[j].name.endsWith('IK'))maxJointLengthError=Math.max(maxJointLengthError,Math.abs(bones[j].position.length()-lengths[j]));
  for(const foot of s.feet){maxSoleError=Math.max(maxSoleError,new THREE.Vector3(...foot.sole).distanceTo(new THREE.Vector3(...foot.targetSole)));maxReachError=Math.max(maxReachError,foot.reachError);reachByFoot[foot.id]=Math.max(reachByFoot[foot.id]||0,foot.reachError);minSoleY=Math.min(minSoleY,foot.soleMinY);}
 }
 const result={gait,lead,finite,maxSoleError,maxReachError,reachByFoot,minSoleY,maxJointLengthError};gaits.push(result);
 requireResult(finite,gait+' nonfinite transforms');requireResult(maxSoleError<.004,gait+' sole error>'+maxSoleError);requireResult(maxReachError<.055,gait+' unreachable stride>'+maxReachError);requireResult(minSoleY>-.002,gait+' claw penetration>'+minSoleY);requireResult(maxJointLengthError<.003,gait+' changes anatomical limb length>'+maxJointLengthError);
}
motion.reset();motion.set('rest');motion.update(0);const restBounds=meshBounds();writePose('source-rest-open');
motion.reset();motion.update(0);const foldedBounds=meshBounds();writePose('ground-folded');
requireResult(foldedBounds.size[0]<restBounds.size[0]*.6,'ground wing fold does not reduce span enough');
const flight=[];
for(const [seconds,flying,altitude,verticalSpeed,speedMps]of [[.20,true,.3,2,2],[1.1,true,1.5,2,4],[2.4,true,4,0,6],[3.2,true,1,-1,3],[3.6,false,0,0,0]]){
 const target=seconds,dt=1/120;while(motion.snapshot().time<target-dt/2){motion.setFlight({flying,altitude,verticalSpeed,speedMps});motion.update(dt);}
 const snap=motion.snapshot(),bounds=meshBounds();flight.push({seconds,stage:snap.flightStage,open:snap.wingOpen,tips:snap.wingTips,bounds});requireResult(snap.localPositions.flat().every(Number.isFinite)&&snap.localQuaternions.flat().every(Number.isFinite),'flight nonfinite transforms');
 if(seconds===2.4)writePose('flight');if(seconds===3.2)writePose('landing');
}
const transitionClearance=[];
motion.reset();
for(let i=0;i<360;i++){
 const age=i/120,flying=age<2.2,altitude=flying?Math.min(3,age*2):0;
 motion.setFlight({flying,altitude,verticalSpeed:flying?(age>1.5?-1:2):0,speedMps:5});motion.update(1/120);
 if(i%4===0||i===359){const clearance=riderWingClearance(),bounds=meshBounds(),stage=motion.snapshot().flightStage;transitionClearance.push({age,stage,clearance,groundMin:bounds.min[1]+altitude});requireResult(clearance.intersections===0,'wing intersects rider at '+age+'s '+stage);requireResult(bounds.min[1]+altitude>-.015,'wing/dragon ground penetration at '+age+'s '+stage);}
}
motion.reset();motion.update(1/120);const pausedBefore=motion.snapshot();for(let i=0;i<20;i++)motion.update(0);const pausedAfter=motion.snapshot();
const pausedPoseDelta=Math.max(...pausedBefore.localPositions.flat().map((x,i)=>Math.abs(x-pausedAfter.localPositions.flat()[i])),...pausedBefore.localQuaternions.flat().map((x,i)=>Math.abs(x-pausedAfter.localQuaternions.flat()[i])));
requireResult(pausedPoseDelta<1e-12,'zero-dt animation accumulates transforms');
const bakedClips=[];
const mixer=new THREE.AnimationMixer(gltf.scene);
for(const clip of gltf.animations){
 const action=mixer.clipAction(clip);action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();
 let finite=true,maxQuaternionNormError=0;
 for(let i=0;i<=15;i++){mixer.setTime(clip.duration*i/15);gltf.scene.updateMatrixWorld(true);skin.skeleton.update();for(const b of skin.skeleton.bones){finite&&=b.position.toArray().every(Number.isFinite)&&b.quaternion.toArray().every(Number.isFinite);maxQuaternionNormError=Math.max(maxQuaternionNormError,Math.abs(b.quaternion.length()-1));}}
 const bounds=meshBounds();action.stop();mixer.stopAllAction();bakedClips.push({name:clip.name,duration:clip.duration,tracks:clip.tracks.length,finite,maxQuaternionNormError,endBounds:bounds});requireResult(finite&&maxQuaternionNormError<1e-5,clip.name+' invalid playable clip');
}
requireResult(gltf.animations.length===12||(!process.argv.includes('--dense-clips')&&gltf.animations.length===0),'expected twelve playable dragon clips');
// Measure the real skinned claw/foot geometry between baked quaternion keys.
// Canonical joint transforms being finite do not establish surface contact.
const denseClipContact=[];
if(process.argv.includes('--dense-clips')){
 const limbVertices=[],g=skin.geometry,temp=new THREE.Vector3(),allSurfaces=[];gltf.scene.traverse(o=>{if(o.isSkinnedMesh)allSurfaces.push(o);});
 for(let i=0;i<g.attributes.position.count;i++){
  let owner='',weight=0;
  for(const side of ['FL','FR','HL','HR']){
   let w=0;for(let k=0;k<4;k++){const name=skin.skeleton.bones[g.attributes.skinIndex.getComponent(i,k)].name.replace(/[.\s]/g,'');if(name.startsWith(side)&&!name.endsWith('IK'))w+=g.attributes.skinWeight.getComponent(i,k);}
   if(w>weight){weight=w;owner=side;}
  }
  if(weight>.5)limbVertices.push([i,owner]);
 }
 for(const clip of gltf.animations.filter(c=>!['Takeoff','Fly','Land'].includes(c.name))){
  mixer.stopAllAction();const action=mixer.clipAction(clip);action.reset();action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();
  let minY=Infinity,worst=null,finite=true,surfaceMinY=Infinity,surfaceWorst=null;const fps=240,steps=Math.ceil(clip.duration*fps),perLimb={FL:Infinity,FR:Infinity,HL:Infinity,HR:Infinity};
  for(let step=0;step<=steps;step++){
   const t=Math.min(step/fps,clip.duration);mixer.setTime(t);gltf.scene.updateMatrixWorld(true);skin.skeleton.update();
   for(const [vertex,owner]of limbVertices){skin.getVertexPosition(vertex,temp);skin.localToWorld(temp);finite&&=Number.isFinite(temp.y);perLimb[owner]=Math.min(perLimb[owner],temp.y);if(temp.y<minY){minY=temp.y;worst={time:t,vertex,limb:owner,position:temp.toArray()};}}
   if(process.argv.includes('--full-surface'))for(const mesh of allSurfaces)for(let vertex=0;vertex<mesh.geometry.attributes.position.count;vertex++){mesh.getVertexPosition(vertex,temp);mesh.localToWorld(temp);finite&&=Number.isFinite(temp.y);if(temp.y<surfaceMinY){surfaceMinY=temp.y;surfaceWorst={time:t,mesh:mesh.name,vertex,position:temp.toArray()};}}
  }
  action.stop();mixer.stopAllAction();const entry={name:clip.name,duration:clip.duration,sampleHz:fps,samples:steps+1,ownedActualLimbVertices:limbVertices.length,minY,perLimb,worst,finite,...(process.argv.includes('--full-surface')?{surfaceMinY,surfaceWorst}:{} )};denseClipContact.push(entry);
  requireResult(finite&&minY>=-.002,clip.name+' dense actual claw geometry penetration '+minY+' at '+worst?.time);if(process.argv.includes('--full-surface'))requireResult(surfaceMinY>=-.002,clip.name+' whole actual surface penetration '+surfaceMinY+' at '+surfaceWorst?.time);
 }
}

const report={gameSha256:crypto.createHash('sha256').update(bytes).digest('hex'),motionCodeSha256:crypto.createHash('sha256').update(source('assets/dragon-horse-motion.js')).digest('hex'),denseClipContact,groundCoreCodeSha256:crypto.createHash('sha256').update(source('assets/artist-horse-motion.js')).digest('hex'),bakedClips,transitionClearance,pausedPoseDelta,source:'original3DHaupt actualdragon',numericalOnly:true,texturesAssessed:false,visualReview:'pending',gaits,restBounds,foldedBounds,flight,reviewOnlyPoseFiles:poseFiles,failures,passed:failures.length===0};
fs.writeFileSync(path.join(base,'motion-qa.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
if(failures.length)process.exitCode=1;

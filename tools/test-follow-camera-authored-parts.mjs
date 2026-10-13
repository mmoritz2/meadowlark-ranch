import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {dirname,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {normalizeAuthoredCameraSource} from './authored-camera-source-guard.cjs';
import {normalizeMeadowReliefWallSource} from './meadow-relief-wall-source-guard.cjs';
import {normalizeReviewedGuideSource,normalizeReviewedRuntimeSource} from './reviewed-riding-source-guard.cjs';

const root=process.env.MEADOWLARK_TEST_ROOT||resolve(dirname(fileURLToPath(import.meta.url)),'..');
const contract=JSON.parse(readFileSync(new URL('./fixtures/follow-camera-d5b9441/contract.json',import.meta.url),'utf8'));
const cameraPath=process.env.FOLLOW_CAMERA_MODULE||resolve(root,'assets/follow-camera.js');
const THREE=await import(pathToFileURL(resolve(root,'assets/vendor/three/build/three.module.js')));
const {createRanchArchitecture}=await import(pathToFileURL(resolve(root,'assets/ranch-architecture.js')));
const {createFollowCamera}=await import(pathToFileURL(cameraPath));
const additionalMainGuard=process.env.CAMERA_MAIN_NORMALIZER||resolve(dirname(fileURLToPath(import.meta.url)),'grass-arch-source-guard.cjs');
const normalizeAdditionalMain=existsSync(additionalMainGuard)?
 (await import(pathToFileURL(additionalMainGuard))).normalizeGrassArchSource:(s=>s);
assert(!process.env.CAMERA_MAIN_NORMALIZER||existsSync(additionalMainGuard),'explicit additional main adapter must be present');
assert.equal(typeof normalizeAdditionalMain,'function','explicit additional main adapter must exist');
const legacySource=readFileSync(new URL('./fixtures/follow-camera-d5b9441/follow-camera.js',import.meta.url),'utf8');
const {createFollowCamera:createLegacyCamera}=await import('data:text/javascript;base64,'+Buffer.from(legacySource).toString('base64'));
const scalarV2Source=readFileSync(new URL('./fixtures/follow-camera-d5b9441/scalar-v2-follow-camera.js',import.meta.url),'utf8');
const {createFollowCamera:createScalarCamera}=await import('data:text/javascript;base64,'+Buffer.from(scalarV2Source).toString('base64'));
const arch=createRanchArchitecture({THREE,loadTextures:false});
const v=a=>new THREE.Vector3(...a);
const hash=x=>createHash('sha256').update(x).digest('hex');
function partsSnapshot(model){return JSON.stringify(model.userData.solidParts);}
function geometrySnapshot(model){const h=createHash('sha256');model.traverse(m=>{if(!m.isMesh)return;h.update(m.name);if(m.geometry.index)h.update(Buffer.from(m.geometry.index.array.buffer));for(const [name,a]of Object.entries(m.geometry.attributes)){h.update(name);h.update(Buffer.from(a.array.buffer));}});return h.digest('hex');}
// Independent two-sided rendered triangles, rather than the camera's boxes.
function firstTriangle(model,origin,end){
 const direction=end.clone().sub(origin),length=direction.length();
 if(length<1e-8)return null;
 const ray=new THREE.Ray(origin,direction.normalize()),a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),at=new THREE.Vector3();let best=null;
 model.traverse(m=>{
  if(!m.isMesh||!m.geometry||m.material?.transparent&&m.material.opacity<.7)return;
  const g=m.geometry,p=g.attributes.position,ix=g.index,count=ix?ix.count:p.count;
  for(let i=0;i<count;i+=3){
   a.fromBufferAttribute(p,ix?ix.getX(i):i).applyMatrix4(m.matrixWorld);
   b.fromBufferAttribute(p,ix?ix.getX(i+1):i+1).applyMatrix4(m.matrixWorld);
   c.fromBufferAttribute(p,ix?ix.getX(i+2):i+2).applyMatrix4(m.matrixWorld);
   if(!ray.intersectTriangle(a,b,c,false,at))continue;
   const distance=origin.distanceTo(at);
   if(distance>1e-7&&distance<length-1e-7&&(!best||distance<best.distance))best={distance,name:m.name,point:at.toArray()};
  }
 });return best;
}
function rigFor(model,ground=0){model.updateWorldMatrix(true,true);const rig=createFollowCamera({THREE,groundHeight:()=>ground});rig.register(model);return rig;}
function clearResolve(model,rig,origin,end,label){const out=new THREE.Vector3(),fraction=rig.resolve(origin,end,out);assert.equal(fraction,1,label+' preserves the complete clear sightline');assert(out.distanceTo(end)<1e-8,label+' preserves desired camera');assert.equal(firstTriangle(model,origin,out),null,label+' has no independent rendered triangle hit');}
function blockedResolve(model,rig,origin,end,label){assert(firstTriangle(model,origin,end),label+' actually crosses a rendered surface');const out=new THREE.Vector3(),fraction=rig.resolve(origin,end,out);assert(fraction>0&&fraction<.99,label+' stops before the surface');assert(origin.distanceTo(out)>.15,label+' does not collapse onto subject');assert.equal(firstTriangle(model,origin,out),null,label+' resolved sightline misses every rendered triangle');return out;}
function house(yaw=0){const model=arch.buildOutbuilding({width:4.6,depth:3.2,height:3.4,animatedDoorOpening:{width:1,height:1.9}});model.position.set(13,5,-26);model.rotation.y=yaw;model.updateWorldMatrix(true,true);return model;}
const local=(model,p)=>model.localToWorld(v(p));

test('pinned legacy render-batch registration genuinely misses the recorded opaque barn wall',()=>{
 assert.equal(hash(legacySource),contract.sourceHashes['assets/follow-camera.js']);
 const model=arch.buildBarn();model.position.fromArray(contract.barn.position);model.updateWorldMatrix(true,true);
 const origin=v(contract.player.position);origin.y+=contract.subjectLookOffsetY;const end=v(contract.camera.position);
 const rig=createLegacyCamera({THREE,groundHeight:()=>0});rig.register(model);
 assert(firstTriangle(model,origin,end),'recorded camera-to-subject line crosses actual rendered architecture');
 assert(rig.isClear(origin,end),'legacy merged bounds incorrectly report the line clear');
 const out=new THREE.Vector3();assert.equal(rig.resolve(origin,end,out),1);assert(firstTriangle(model,origin,out),'legacy resolved camera remains occluded');
});

test('native ranch audit reproduces interior-to-exterior occlusion and retracts behind the actual wall',()=>{
 const model=arch.buildBarn();model.position.fromArray(contract.barn.position);model.rotation.y=contract.barn.rotationY;const rig=rigFor(model);
 const origin=v(contract.player.position);origin.y+=contract.subjectLookOffsetY;
 const end=v(contract.camera.position);
 const before=firstTriangle(model,origin,end);assert(before);assert(/siding|ironwork|window|joinery/.test(before.name),before.name);
 const out=blockedResolve(model,rig,origin,end,'recorded ranch interior');
 assert(out.x<-12.7,'camera stays on the subject side of the barn east wall');
 assert(rig.obstacleCount>model.children.length,'authored pieces replace enclosing render-batch boxes');
 // This placement is deliberately a forced interior reproduction, not a claim
 // that the riding collision controller admits this route into a closed barn.
 for(let i=0;i<240;i++)rig.frame(origin,end,out,1/60);
 assert.equal(firstTriangle(model,origin,out),null,'settled orbit keeps an actual interior sightline');
});

test('barn sheltered bays remain open while inset doors, side walls, roof and cross-beam block',()=>{
 const model=arch.buildBarn(),rig=rigFor(model);
 for(const x of[-2.23,0,2.23])clearResolve(model,rig,v([x,1.6,2.45]),v([x,1.6,4.5]),'sheltered bay '+x);
 blockedResolve(model,rig,v([.35,1.4,2.45]),v([.35,1.4,.3]),'closed inset door');
 blockedResolve(model,rig,v([0,1.1,-1]),v([5,1.1,-1]),'barn side wall');
 blockedResolve(model,rig,v([.37,1.6,.4]),v([.37,7,.4]),'barn roof');
 blockedResolve(model,rig,v([.38,2.6,2.695]),v([.38,4.1,2.695]),'porch cross-beam');
});

test('authored open doorway remains clear after translation and oblique rotations; walls and roof still stop',()=>{
 for(const yaw of[0,.63,Math.PI/4,1.4,-.72]){
  const model=house(yaw),rig=rigFor(model,5),origin=local(model,[0,1.3,0]),end=local(model,[0,1.3,4]);
  clearResolve(model,rig,origin,end,'open doorway at yaw '+yaw);
  clearResolve(model,rig,end,origin,'open doorway reversed at yaw '+yaw);
  blockedResolve(model,rig,origin,local(model,[0,1.3,-4]),'rear wall at yaw '+yaw);
  blockedResolve(model,rig,origin,local(model,[4,1.3,0]),'side wall at yaw '+yaw);
  blockedResolve(model,rig,local(model,[.2,1.3,.25]),local(model,[.2,7,.25]),'house roof at yaw '+yaw);
 }
});

test('door approach and departure retain visible translated/rotated sightlines through smoothing',()=>{
 for(const yaw of[0,.63])for(const sign of[-1,1]){
  const model=house(yaw),rig=rigFor(model,5),p=new THREE.Vector3(),desired=new THREE.Vector3(),safe=new THREE.Vector3(),actual=local(model,[0,1.4,3.8]),last=actual.clone();let maxStep=0;
  for(let i=0;i<220;i++){
   const z=sign>0?-.8+i/219*3.4:2.6-i/219*3.4;p.copy(local(model,[0,1.3,z]));desired.copy(local(model,[0,1.4,z+2.8]));
   rig.frame(p,desired,safe,1/60);actual.lerp(safe,1-Math.exp(-5/60));rig.resolve(p,actual,actual);
   if(i%11===0||i===219)assert.equal(firstTriangle(model,p,actual),null,'door sweep sees subject through actual triangles');
   if(i)maxStep=Math.max(maxStep,actual.distanceTo(last));last.copy(actual);
  }
  assert(maxStep<.45,`yaw ${yaw}, direction ${sign}: camera step ${maxStep}m`);
 }
});

test('nested authored models and nonuniform parent transforms retain their own clear door and solid walls',()=>{
 const parent=new THREE.Group();parent.position.set(-33,4,18);parent.rotation.y=-.38;parent.scale.set(1.25,1.1,.9);
 const model=house(.63);model.position.set(4,0,-6);parent.add(model);parent.updateWorldMatrix(true,true);
 const rig=rigFor(parent,4),origin=local(model,[0,1.3,0]),end=local(model,[0,1.3,4]);
 clearResolve(parent,rig,origin,end,'nested scaled doorway');
 blockedResolve(parent,rig,origin,local(model,[0,1.3,-4]),'nested scaled rear wall');
 const barn=arch.buildBarn();barn.position.set(24,0,-8);parent.add(barn);parent.updateWorldMatrix(true,true);
 const combined=rigFor(parent,4);
 assert(combined.obstacleCount>rig.obstacleCount,'sibling authored root is independently registered');
 blockedResolve(parent,combined,local(barn,[0,1.1,-1]),local(barn,[5,1.1,-1]),'nested barn wall');
});

test('old unannotated meshes preserve wall fallback and translucent exclusion',()=>{
 const rig=createFollowCamera({THREE,groundHeight:()=>0}),wall=new THREE.Mesh(new THREE.BoxGeometry(6,5,.2),new THREE.MeshBasicMaterial());wall.position.set(0,2.5,-3);rig.register(wall);
 const transparent=new THREE.Mesh(new THREE.BoxGeometry(9,6,.2),new THREE.MeshBasicMaterial({transparent:true,opacity:.4}));transparent.position.set(0,3,-1);rig.register(transparent);
 assert.equal(rig.obstacleCount,1);
 const p=v([0,1.6,0]),out=new THREE.Vector3();rig.resolve(p,v([0,2.6,-6]),out);assert(out.z>-2.6&&out.z<-2.4);wall.updateWorldMatrix(true,true);assert.equal(firstTriangle(wall,p,out),null);
});

test('camera registration preserves authored models and consumes no seeded UUID/RNG values',()=>{
 const models=[arch.buildBarn(),house(.63)],before=models.map(m=>[partsSnapshot(m),geometrySnapshot(m)]),original=Math.random;let calls=0;
 Math.random=()=>{calls++;return .5;};
 try{for(const model of models){const rig=createFollowCamera({THREE,groundHeight:()=>0});rig.register(model);rig.resolve(v([0,1.6,0]),v([0,3,-6]),new THREE.Vector3());}assert.equal(calls,0,'no resource UUID or scene RNG consumption');}finally{Math.random=original;}
 assert.deepEqual(models.map(m=>[partsSnapshot(m),geometrySnapshot(m)]),before,'registration does not mutate actual solidParts or rendered vertex/index buffers');
});

test('indexed camera conservatively matches scalar V2 at negative cells, exact boundaries, transformed parts and wide fallback',()=>{
 assert.equal(hash(scalarV2Source),contract.scalarV2SHA256,'unmodified scalar V2 oracle');
 const scene=new THREE.Group(),walls=new THREE.Group(),identity=new THREE.Matrix4();
 const part=(min,max,matrix=identity)=>({min,max,matrix:matrix.toArray()});
 walls.userData.solidParts=[
  part([-.1,0,-4],[.1,5,4],new THREE.Matrix4().makeTranslation(-12.4,0,-12)),
  part([-.1,0,-4],[.1,5,4],new THREE.Matrix4().makeTranslation(12.4,0,12)),
  // Expanded footprint covers >256 grid cells and must take wide fallback.
  part([-200,4,-200],[200,4.2,200]),
  part([-.1,0,-2],[.1,3,2],new THREE.Matrix4().compose(v([-24.4,0,24]),new THREE.Quaternion().setFromEuler(new THREE.Euler(.11,.63,-.07)),v([1.2,1.1,.9])))
 ];scene.add(walls);
 for(const [x,z,yaw]of[[-36,-24,.63],[-12,24,-.72],[24,-36,Math.PI/4]]){const m=house(yaw);m.position.set(x,0,z);m.scale.set(1.25,1.1,.9);scene.add(m);}
 const indexed=rigFor(scene),scalar=createScalarCamera({THREE,groundHeight:()=>0});scalar.register(scene);assert.equal(indexed.obstacleCount,scalar.obstacleCount);
 const pairs=[
  [[-12,1.6,-12],[-14,1.6,-12]], [[-12,1.6,-12],[-10,1.6,-12]],
  [[12,1.6,12],[14,1.6,12]], [[12,1.6,12],[10,1.6,12]],
  [[-24,1.6,24],[-26,1.6,24]], [[-48,1.6,-48],[48,1.6,48]],
  [[0,1.6,0],[0,8,0]], [[-192,1.6,-192],[-192,8,-192]],
  [[-204,1.6,-204],[-204,8,-204]], [[12,1.6,12],[12,-3,12]]
 ];
 for(const m of scene.children.filter(x=>x.userData.architecture))for(const direction of[[0,1.3,4],[4,1.3,0],[0,1.3,-4],[.2,7,.25]])pairs.push([local(m,[0,1.3,0]).toArray(),local(m,direction).toArray()]);
 let seed=3219464359;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 for(let i=0;i<480;i++)pairs.push([[(rand()-.5)*96,.8+rand()*4,(rand()-.5)*96],[(rand()-.5)*96,.8+rand()*7,(rand()-.5)*96]]);
 const a=new THREE.Vector3(),b=new THREE.Vector3();
 for(const [from,to]of pairs){const p=v(from),q=v(to),fa=indexed.resolve(p,q,a),fb=scalar.resolve(p,q,b);assert(Math.abs(fa-fb)<1e-12,'grid and scalar fraction agree '+JSON.stringify({from,to,indexed:fa,scalar:fb,indexedPoint:a.toArray(),scalarPoint:b.toArray()}));assert(a.distanceTo(b)<1e-10,'grid and scalar point agree');assert.equal(indexed.isClear(p,q),scalar.isClear(p,q));}
 // Preserved orbit choices, swept origin prediction and radius smoothing must
 // also agree when one segment visits multiple cells containing the same box.
 for(let i=0;i<360;i++){
  const p=v([-36+i*.012,1.3,-24+Math.sin(i*.012)*.5]),q=v([p.x+4.2,2.5,p.z+2.6]);
  const fa=indexed.frame(p,q,a,1/60),fb=scalar.frame(p,q,b,1/60);assert(Math.abs(fa-fb)<1e-12);assert(a.distanceTo(b)<1e-10,'indexed frame equals scalar V2 frame');
 }
});

test('existing orbit/frame/input and builder/collision source contracts remain exact',()=>{
 const source=readFileSync(cameraPath,'utf8');const tail=source.slice(source.indexOf(' function resolve('));assert.equal(hash(tail),contract.unchangedResolveFrameAndReturnSHA256,'resolve/frame/orbit behavior remains byte-for-byte');
 for(const name of['assets/ranch-architecture.js','assets/solid-collisions.js','assets/features/course-guide.js','tools/test-follow-camera.mjs','tools/test-follow-camera-input.mjs'])assert.equal(hash(name==='assets/features/course-guide.js'?normalizeReviewedGuideSource(readFileSync(resolve(root,name),'utf8'),name):readFileSync(resolve(root,name))),contract.sourceHashes[name],name+' remains unchanged');
});

test('exact frozen runtime and one import reversal reject camera drift without changing historical main assertions',()=>{
 assert.equal(hash(readFileSync(cameraPath)),contract.reviewedRuntimeSHA256['assets/follow-camera.js'],'complete reviewed runtime camera body');
 const guard=readFileSync(new URL('./authored-camera-source-guard.cjs',import.meta.url));assert.equal(hash(guard),contract.guardSHA256);
 const main=normalizeReviewedRuntimeSource(normalizeMeadowReliefWallSource(readFileSync(process.env.CAMERA_MAIN_SOURCE||resolve(root,'ranch3d.html'),'utf8'),'ranch3d.html'),'ranch3d.html');
 assert.equal(main.split(contract.cameraCache.after).length-1,1,'main imports the reviewed camera runtime exactly once');
 const normalized=normalizeAuthoredCameraSource(main,'ranch3d.html');
 // For a combined GrassArch/camera main, its normalizer supplies the remaining
 // precise grass reversals before this same complete d5 body hash is tested.
 const complete=normalizeAdditionalMain(normalized,'ranch3d.html');
 assert.equal(hash(complete),contract.baselineMainSHA256,'entire d5 main restored by exact declared camera/grass literals');
 const {before,after}=contract.cameraCache,current=normalized.replace(before,after);
 assert.throws(()=>normalizeAuthoredCameraSource(current+'\n// duplicate '+after,'ranch3d.html'));
 assert.throws(()=>normalizeAuthoredCameraSource(current.replace(after,"'./assets/follow-camera.js?v=unreviewed-camera-change'"),'ranch3d.html'));
 assert.throws(()=>normalizeAuthoredCameraSource(current+'\n// mixed '+before,'ranch3d.html'));
 const drift=normalizeAuthoredCameraSource(current+'\n// unrelated runtime drift','ranch3d.html');assert.throws(()=>assert.equal(hash(drift),hash(normalized)),'unrelated body drift is retained and rejected by whole-body hashes');
 assert.equal(normalizeAuthoredCameraSource('unchanged module','assets/world-photoscans.js'),'unchanged module');
});

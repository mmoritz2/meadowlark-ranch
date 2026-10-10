// Actual current-production collar vs a sparse candidate; no browser/network.
// Usage: node tools/qa-native-collar-candidate.mjs CANDIDATE_DIR [shire,percheron,clyde]
// Geometry diagnostics are not proof of visible strap continuity/occlusion.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {register} from 'node:module';
import {createHash} from 'node:crypto';
const ROOT=fileURLToPath(new URL('../',import.meta.url)).replace(/\/$/,'');
const url=path=>pathToFileURL(ROOT+'/'+path).href;
const threeURL=url('assets/vendor/three/build/three.module.js');
register('data:text/javascript,'+encodeURIComponent(`export async function resolve(specifier,context,next){if(specifier==='three')return {url:${JSON.stringify(threeURL)},shortCircuit:true};return next(specifier,context);}`),import.meta.url);
const CoreTHREE=await import(threeURL);
const THREE={...CoreTHREE,TextureLoader:class{async loadAsync(){return new CoreTHREE.Texture();}}};
const {GLTFLoader}=await import(url('assets/vendor/three/examples/jsm/loaders/GLTFLoader.js'));
const {clone}=await import(url('assets/vendor/three/examples/jsm/utils/SkeletonUtils.js'));
const {createBreedLibrary}=await import(url('assets/breed-models.js'));
const {initGameHero}=await import(url('assets/game-hero-horse.js'));
const {applyNativeCollarAttachment}=await import(url('assets/native-collar-attachment.js'));
const {validateNativeGroomRig}=await import(url('assets/native-groom-layer.mjs'));
const {createNativeTackModes}=await import(url('assets/native-rider.js'));
const {createTackCollection}=await import(url('assets/tack-collection-models.js'));
const {TACK_PIECES}=await import(url('assets/tack-collection.mjs'));
const ranges=[[0,43],[76,196],[426,531],[754,976],[3348,3428],[3601,3823],[4053,4158],[5369,5393],[5517,5690],[5826,5999],[7416,7646],[8356,8586],[9508,9738],[9782,9802],[9810,9855],[9892,10064],[11392,11412],[11522,11542],[12073,12224]];
const collar=id=>ranges.some(([a,b])=>id>=a&&id<=b);
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const typedBytes=a=>new Uint8Array(a.buffer,a.byteOffset,a.byteLength);
function geometryHash(g){const h=createHash('sha256');for(const [name,a]of Object.entries(g.attributes)){h.update(name);h.update(typedBytes(a.array));}h.update(typedBytes(g.index.array));return h.digest('hex');}
const originalFetch=globalThis.fetch;
globalThis.fetch=async input=>{const u=new URL(input);assert.equal(u.protocol,'file:','No network access');return new Response(await readFile(fileURLToPath(u)));};
class GeometryLoader extends GLTFLoader{
 async loadAsync(input){
  const bytes=await readFile(fileURLToPath(new URL(input))),length=bytes.readUInt32LE(12),doc=JSON.parse(bytes.subarray(20,20+length));
  doc.materials=(doc.materials||[]).map(m=>({name:m.name,doubleSided:m.doubleSided,pbrMetallicRoughness:{baseColorFactor:[.4,.3,.2,1],roughnessFactor:.7,metallicFactor:0}}));
  delete doc.images;delete doc.textures;delete doc.samplers;doc.extensionsUsed=(doc.extensionsUsed||[]).filter(x=>!x.includes('texture'));doc.extensionsRequired=(doc.extensionsRequired||[]).filter(x=>!x.includes('texture'));
  let json=Buffer.from(JSON.stringify(doc));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);const bin=bytes.subarray(20+length),out=Buffer.alloc(20+json.length+bin.length);
  out.writeUInt32LE(0x46546c67,0);out.writeUInt32LE(2,4);out.writeUInt32LE(out.length,8);out.writeUInt32LE(json.length,12);out.writeUInt32LE(0x4e4f534a,16);json.copy(out,20);bin.copy(out,20+json.length);
  return this.parseAsync(out.buffer.slice(out.byteOffset,out.byteOffset+out.byteLength),'');
 }
}
const candidateDir=resolve(process.argv[2]||ROOT+'/review/draft-front-check/attachment-preview');
const horseIds=(process.argv[3]||'shire,percheron,clyde').split(',');
const outPath=process.env.COLLAR_QA_OUT||candidateDir+'/current-validation.json';
const library=createBreedLibrary({THREE,GLTFLoader:GeometryLoader,clone});
const meshesIn=root=>{const out=[];root.traverse(m=>{if(m.isSkinnedMesh)out.push(m);});return out;};
const world=(m,i,out=new THREE.Vector3())=>m.localToWorld(m.getVertexPosition(i,out));
const worlds=m=>Array.from({length:m.geometry.attributes.position.count},(_,i)=>world(m,i));
const mm=n=>n*1000;
function connectedComponents(g){
 const n=g.attributes.position.count,p=Array.from({length:n},(_,i)=>i),find=i=>p[i]===i?i:p[i]=find(p[i]);
 const join=(a,b)=>{a=find(a);b=find(b);if(a!==b)p[Math.max(a,b)]=Math.min(a,b);};
 for(let i=0;i<g.index.count;i+=3){const a=g.index.getX(i),b=g.index.getX(i+1),c=g.index.getX(i+2);join(a,b);join(b,c);}
 const by=new Map();for(let i=0;i<n;i++){const r=find(i);if(!by.has(r))by.set(r,[]);by.get(r).push(i);}
 const components=[...by.values()].sort((a,b)=>a[0]-b[0]),labels=[];components.forEach((ids,id)=>ids.forEach(v=>labels[v]=id));return {components,labels};
}
function nearbyPairs(points,ids,others,tolerance,filter=()=>true){
 const buckets=new Map(),key=(x,y,z)=>x+','+y+','+z;
 for(const j of others){const p=points[j],k=key(Math.floor(p.x/tolerance),Math.floor(p.y/tolerance),Math.floor(p.z/tolerance));if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push(j);}
 const seen=new Set(),pairs=[];
 for(const i of ids){const p=points[i],x=Math.floor(p.x/tolerance),y=Math.floor(p.y/tolerance),z=Math.floor(p.z/tolerance);
  for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(let dz=-1;dz<=1;dz++)for(const j of buckets.get(key(x+dx,y+dy,z+dz))||[]){
   if(i===j||!filter(i,j)||p.distanceTo(points[j])>tolerance)continue;const k=Math.min(i,j)+','+Math.max(i,j);if(!seen.has(k)){seen.add(k);pairs.push([i,j]);}
  }
 }return pairs;
}
function maxRecord(value,prior,context){return !prior||value>prior.value?{value,...context}:prior;}
function measuredNormal(mesh,id){
 const g=mesh.geometry,n=new THREE.Vector3().fromBufferAttribute(g.attributes.normal,id),linear=new THREE.Matrix4();linear.elements.fill(0);const tmp=new THREE.Matrix4();
 for(let k=0;k<4;k++){const j=g.attributes.skinIndex.getComponent(id,k),w=g.attributes.skinWeight.getComponent(id,k);if(!w)continue;tmp.multiplyMatrices(mesh.skeleton.bones[j].matrixWorld,mesh.skeleton.boneInverses[j]);for(let a=0;a<16;a++)linear.elements[a]+=tmp.elements[a]*w;}
 linear.premultiply(mesh.bindMatrixInverse).multiply(mesh.bindMatrix);
 const a=new THREE.Matrix3().setFromMatrix4(linear),det=a.determinant();n.applyMatrix3(a).applyMatrix3(new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld));
 assert(n.toArray().every(Number.isFinite)&&n.lengthSq()>1e-16,'Finite nondegenerate animated skin normal');return {n:n.normalize(),det};
}
function clipHash(rig){const h=createHash('sha256');for(const c of rig.animations){h.update(c.name+':'+c.duration);for(const t of c.tracks){h.update(t.name);h.update(typedBytes(t.times));h.update(typedBytes(t.values));}}return h.digest('hex');}
const report={version:1,createdAt:new Date().toISOString(),repository:ROOT,reference:'Current production attachment through the unmodified breed loader',limitations:['Textures omitted; no rendered visibility assertion.','Seam/contact/deformation maxima are diagnostic, not pass thresholds.','Exact body and hard protected tack invariants are asserted.'],horses:[],failures:[]};
await library.manifestReady;
for(const horse of horseIds){
 const started=performance.now();let row={horse};report.horses.push(row);
 try{
  const meta=JSON.parse(await readFile(candidateDir+'/'+horse+'.json','utf8')),buffer=await readFile(candidateDir+'/'+horse+'.bin');
  const asset=await library.load(horse),plain=library.instantiate(asset),live=library.instantiate(asset),actor=new THREE.Group(),peerActor=new THREE.Group();actor.add(live.scene);peerActor.add(plain.scene);actor.updateMatrixWorld(true);peerActor.updateMatrixWorld(true);
  const variant=live.profile.nativeVariant,production=await readFile(new URL(variant.file,pathToFileURL(ROOT+'/assets/native-roster.js')));
  assert(variant.tackAttachment&&plain.nativeContacts.tack.geometry.userData.nativeCollarAttachment,'Reference must include current production attachment');
  assert.equal(digest(production),variant.sha256,'Actual current production binary SHA');
  assert(buffer.subarray(0,728256).equals(production.subarray(0,728256)),'Candidate cannot change the body or base morph blocks');
  if(meta.previewSha256)assert.equal(digest(buffer),meta.previewSha256,'Candidate file integrity');
  assert.equal(meta.baselineSha256,variant.sha256,'Candidate must name the exact current production attachment, not only its morph prefix');
  const baseline=live.nativeContacts.tack.geometry,hash=geometryHash(baseline),record=meta.record,ids=new Set(new Uint16Array(buffer.buffer,buffer.byteOffset+record.vertexIds.byteOffset,record.vertexCount));
  for(const i of ids)assert(collar(i),'Hard protected non-collar tack cannot be selected: '+i);
  assert.equal(plain.nativeContacts.tack.geometry,baseline,'Current instances initially share prepared immutable geometry');
  const nonTackBefore=meshesIn(live.nativeRoot).filter(m=>m!==live.nativeContacts.tack).map(m=>[m,geometryHash(m.geometry)]);
  const inverseBinds=JSON.stringify(live.skin.skeleton.boneInverses.map(m=>m.elements));
  const clipBefore=clipHash(live),binds=JSON.stringify(live.bones.map(b=>[b.name,b.position.toArray(),b.quaternion.toArray(),b.scale.toArray()]));
  applyNativeCollarAttachment({THREE,mesh:live.nativeContacts.tack,record,binary:buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.byteLength),profile:live.profile});
  const changed=live.nativeContacts.tack.geometry;assert.notEqual(changed,baseline);assert.equal(geometryHash(baseline),hash);assert.equal(clipHash(live),clipBefore);assert.equal(JSON.stringify(live.bones.map(b=>[b.name,b.position.toArray(),b.quaternion.toArray(),b.scale.toArray()])),binds);
  for(const name of Object.keys(baseline.attributes)){const a=baseline.attributes[name],b=changed.attributes[name];for(let i=0;i<a.count;i++)if(!ids.has(i)||!['position','normal','skinIndex','skinWeight'].includes(name))for(let k=0;k<a.itemSize;k++)assert.equal(a.array[i*a.itemSize+k],b.array[i*b.itemSize+k],horse+' protected '+name+'/'+i);}
  assert.deepEqual(changed.index.array,baseline.index.array);assert.equal(JSON.stringify(live.skin.skeleton.boneInverses.map(m=>m.elements)),inverseBinds,'Inverse binds unchanged');for(const [m,h]of nonTackBefore)assert.equal(geometryHash(m.geometry),h,'Non-tack geometry preserved from before candidate application');
  const lm=meshesIn(live.nativeRoot),pm=meshesIn(plain.nativeRoot);assert.equal(lm.length,pm.length);
  for(let mi=0;mi<lm.length;mi++)if(lm[mi]!==live.nativeContacts.tack)assert.equal(geometryHash(lm[mi].geometry),geometryHash(pm[mi].geometry),'Every non-tack attribute is byte-exact');
  const rest=worlds(plain.nativeContacts.tack),current=worlds(live.nativeContacts.tack),{components,labels}=connectedComponents(baseline);
  const collarIds=rest.map((_,i)=>i).filter(collar),hardIds=rest.map((_,i)=>i).filter(i=>!collar(i));
  const seamPairs=nearbyPairs(rest,collarIds,collarIds,.00002);
  const boundaryPairs=nearbyPairs(rest,collarIds,hardIds,.003);
  const edges=[],triangles=[],seenEdge=new Set();for(let ti=0;ti<baseline.index.count;ti+=3){const tri=[0,1,2].map(k=>baseline.index.getX(ti+k));if(!tri.some(i=>ids.has(i)))continue;triangles.push(tri);for(let k=0;k<3;k++){const a=tri[k],b=tri[(k+1)%3],key=Math.min(a,b)+','+Math.max(a,b);if(!seenEdge.has(key)){seenEdge.add(key);edges.push([a,b]);}}}
  row={...row,productionSha256:variant.sha256,productionAttachmentVertices:variant.tackAttachment.vertexCount,candidateSha256:digest(buffer),candidateName:meta.candidate,immutableMorphSha256:digest(production.subarray(0,728256)),motionSha256:live.profile.motionSha256,actualClipHash:clipBefore,candidateVertices:ids.size,changedIslands:[...new Set([...ids].map(i=>labels[i]))],hardProtectedVertices:hardIds.length,poseCount:0,standingMaxChangeMm:mm(Math.max(...[...ids].map(i=>rest[i].distanceTo(current[i])))),coincidentPairCount:seamPairs.length,hardEndpointPairCount:boundaryPairs.length,regions:{},poses:[],maxima:{},normal:{minimumWeightedDeterminant:Infinity,maxAngleChangeDegrees:0}};report.horses[report.horses.length-1]=row;
  // Rest movement is reported, not forbidden: a lower-support correction may
  // intentionally move collar-only leather while retaining hard saddle contacts.
  for(const rig of [plain,live]){assert.equal(rig.bones.length,677);assert(validateNativeGroomRig(rig).eligible);initGameHero(THREE,rig);assert.equal(rig.heroMotion.groomInertia.validation.controls,58);}
  const protectedIds=rest.map((_,i)=>i).filter(i=>!ids.has(i));
  for(const [mode,lead]of [['rest','left'],['walk','left'],['trot','left'],['canter','left'],['canter','right'],['gallop','left'],['gallop','right'],['jump','left']]){
   for(const rig of [live,plain]){rig.heroMotion.reset();rig.heroMotion.set(mode,{lead});rig.heroMotion.update(.25,{rate:0});rig.scene.updateMatrixWorld(true);rig.heroMotion.finishGroomPose();rig.scene.updateMatrixWorld(true);}
   const duration=mode==='rest'?0:mode==='jump'?live.profile.nativeJump.durationS:live.profile.nativeGaits[['canter','gallop'].includes(mode)?mode+(lead==='right'?'Right':'Left'):mode].durationS;
   const steps=mode==='rest'?0:mode==='gallop'?96:16,phases=steps?Array.from({length:steps+1},(_,i)=>i/steps):[0];let at=0;
   for(const phase of phases){
    while(at<duration*phase-1e-9){const dt=Math.min(1/120,duration*phase-at);for(const rig of [live,plain]){rig.heroMotion.update(dt,{rate:1});rig.scene.updateMatrixWorld(true);rig.heroMotion.finishGroomPose();rig.scene.updateMatrixWorld(true);}at+=dt;}
    actor.updateMatrixWorld(true);peerActor.updateMatrixWorld(true);row.poseCount++;const context={mode,lead,phase},stats={...context,actualPhase:live.heroMotion.state.phase01,seamGapCurrentMm:0,seamGapCandidateMm:0,seamGrowthMm:0,endpointGapCurrentMm:0,endpointGapCandidateMm:0,endpointGrowthMm:0,endpointDriftMm:0,selectedMovementMm:0,edgeLengthChangeMm:0,edgeStretchRatio:1,triangleAreaRelativeChange:0,triangleNormalChangeDegrees:0};
    const old=worlds(plain.nativeContacts.tack),now=worlds(live.nativeContacts.tack);
    for(let mi=0;mi<lm.length;mi++){const a=lm[mi],b=pm[mi];assert.equal(a.name,b.name);const samples=a===live.nativeContacts.tack?protectedIds:Array.from({length:a.geometry.attributes.position.count},(_,i)=>i);for(const i of samples){const p=a===live.nativeContacts.tack?now[i]:world(a,i),q=a===live.nativeContacts.tack?old[i]:world(b,i);assert(p.toArray().every(Number.isFinite));const d=p.distanceTo(q);assert(d<1e-9,horse+' '+mode+' '+phase+' protected animation '+a.name+'/'+i);}}
    for(const i of ids){assert(now[i].toArray().every(Number.isFinite));const d=mm(now[i].distanceTo(old[i]));stats.selectedMovementMm=Math.max(stats.selectedMovementMm,d);const r=row.regions[labels[i]]??={vertices:components[labels[i]].length,selectedVertices:components[labels[i]].filter(i=>ids.has(i)).length,maxAnimatedMovementMm:0,maxRestMovementMm:0};r.maxAnimatedMovementMm=Math.max(r.maxAnimatedMovementMm,d);r.maxRestMovementMm=Math.max(r.maxRestMovementMm,mm(rest[i].distanceTo(current[i])));const a=measuredNormal(live.nativeContacts.tack,i),b=measuredNormal(plain.nativeContacts.tack,i);row.normal.minimumWeightedDeterminant=Math.min(row.normal.minimumWeightedDeterminant,a.det);row.normal.maxAngleChangeDegrees=Math.max(row.normal.maxAngleChangeDegrees,a.n.angleTo(b.n)*180/Math.PI);}
    for(const [i,j]of seamPairs){const before=mm(old[i].distanceTo(old[j])),after=mm(now[i].distanceTo(now[j]));stats.seamGapCurrentMm=Math.max(stats.seamGapCurrentMm,before);stats.seamGapCandidateMm=Math.max(stats.seamGapCandidateMm,after);const growth=after-before;if(growth>stats.seamGrowthMm){stats.seamGrowthMm=growth;stats.worstSeam=[i,j];}}
    for(const [i,j]of boundaryPairs){const before=mm(old[i].distanceTo(old[j])),after=mm(now[i].distanceTo(now[j]));stats.endpointGapCurrentMm=Math.max(stats.endpointGapCurrentMm,before);stats.endpointGapCandidateMm=Math.max(stats.endpointGapCandidateMm,after);const growth=after-before;if(growth>stats.endpointGrowthMm){stats.endpointGrowthMm=growth;stats.worstEndpoint=[i,j];}stats.endpointDriftMm=Math.max(stats.endpointDriftMm,mm(now[i].distanceTo(old[i])));}
    for(const [i,j]of edges){const a=old[i].distanceTo(old[j]),b=now[i].distanceTo(now[j]),delta=mm(Math.abs(b-a));if(delta>stats.edgeLengthChangeMm){stats.edgeLengthChangeMm=delta;stats.worstEdge={ids:[i,j],island:labels[i],beforeMm:mm(a),afterMm:mm(b)};}if(a>.0001&&b/a>stats.edgeStretchRatio){stats.edgeStretchRatio=b/a;stats.worstStretchEdge={ids:[i,j],island:labels[i],beforeMm:mm(a),afterMm:mm(b)};}}
    for(const [i,j,k]of triangles){const a=old[j].clone().sub(old[i]).cross(old[k].clone().sub(old[i])),b=now[j].clone().sub(now[i]).cross(now[k].clone().sub(now[i]));if(a.length()>.00000001){const change=Math.abs(b.length()/a.length()-1),details={ids:[i,j,k],island:labels[i],beforeAreaMm2:a.length()*500000,afterAreaMm2:b.length()*500000};if(change>stats.triangleAreaRelativeChange){stats.triangleAreaRelativeChange=change;stats.worstAreaTriangle=details;}if(b.length()>.00000001){const degrees=a.angleTo(b)*180/Math.PI;if(degrees>stats.triangleNormalChangeDegrees){stats.triangleNormalChangeDegrees=degrees;stats.worstNormalTriangle=details;}}}}
    row.poses.push(stats);for(const key of ['seamGapCurrentMm','seamGapCandidateMm','seamGrowthMm','endpointGapCurrentMm','endpointGapCandidateMm','endpointGrowthMm','endpointDriftMm','selectedMovementMm','edgeLengthChangeMm','edgeStretchRatio','triangleAreaRelativeChange','triangleNormalChangeDegrees'])row.maxima[key]=maxRecord(stats[key],row.maxima[key],{...context,pair:key.startsWith('seam')?stats.worstSeam:key.startsWith('endpoint')?stats.worstEndpoint:undefined,geometry:key==='edgeLengthChangeMm'?stats.worstEdge:key==='edgeStretchRatio'?stats.worstStretchEdge:key==='triangleAreaRelativeChange'?stats.worstAreaTriangle:key==='triangleNormalChangeDegrees'?stats.worstNormalTriangle:undefined});
   }
  }
  for(const rig of [plain,live]){rig.heroMotion.reset();rig.scene.updateMatrixWorld(true);}
  const classic=Object.fromEntries(TACK_PIECES.filter(p=>p.collectionId==='classicwestern').map(p=>[p.slot,p]));assert.deepEqual(Object.keys(classic).sort(),['bridle','pad','saddle']);
  const kits=[plain,live].map((rig,i)=>createTackCollection({THREE,rig,mount:i?actor:peerActor,equippedDesigns:classic}));assert.deepEqual(kits[1].stats.nativeFoundation,kits[0].stats.nativeFoundation);for(const kit of kits)for(const slot of Object.keys(classic))assert(kit.stats.pieces[slot].sourceTriangles>0,'Actual classic source '+slot+' enabled');
  row.nativeFoundation=kits[1].stats.nativeFoundation;
  for(let cycle=0;cycle<2;cycle++)for(const state of [{bareback:true,wild:false},{bareback:false,wild:true},{bareback:false,wild:false}])for(const kit of kits)kit.update(0,state);
  for(const kit of kits)kit.dispose();assert.equal(live.nativeContacts.tack.geometry,changed);assert.equal(plain.nativeContacts.tack.geometry,baseline);
  const modes=createNativeTackModes({THREE,rig:live,mount:actor}),before=geometryHash(changed);modes.setMode('bareback');const visible=new Set(live.nativeContacts.tack.geometry.index.array);assert([...ids].every(i=>!visible.has(i)),'Bareback hides full selected collar');modes.setMode('wild');assert.equal(live.nativeContacts.tack.visible,false);modes.setMode('saddled');modes.dispose();assert.equal(live.nativeContacts.tack.geometry,changed);assert.equal(geometryHash(changed),before);assert.equal(geometryHash(baseline),hash);
  for(const rig of [plain,live]){rig.heroMotion.dispose();rig.groom?.dispose();}
  row.passed=true;row.seconds=(performance.now()-started)/1000;console.log(JSON.stringify({...row,poses:undefined,regions:undefined}));
 }catch(error){row.passed=false;row.error=String(error.stack||error);report.failures.push({horse,error:row.error});console.error(horse,row.error);}
}
globalThis.fetch=originalFetch;report.passed=report.failures.length===0;await mkdir(resolve(outPath,'..'),{recursive:true});await writeFile(outPath,JSON.stringify(report,null,2)+'\n');console.log('REPORT '+outPath);if(!report.passed)process.exitCode=1;

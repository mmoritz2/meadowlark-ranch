// Exercise the site gait solver on a canonical40 rig, then append sampled
// anatomical tracks without re-exporting its art. --fps 120 is the default;
// integer rates from40 to480 control dense keys and require Mixer playback QA.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const{pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'../..');
const opts={folder:'assets/models/horse-imports/bluemesh-draft/work/canonical-rig',rig:'draft-canonical-rig.glb',profile:'draft-profile.json',output:'draft-canonical-animated.glb','audit-only':'false',fps:'120'};
for(let i=2;i<process.argv.length;i++){const key=process.argv[i].replace(/^--/,'');if(!(key in opts)||!process.argv[i+1])throw Error('Usage: node bake-canonical-horse-motion.cjs [--folder candidate/work/folder --rig rig.glb --profile profile.json --output animated.glb --fps 120]');opts[key]=process.argv[++i];}
const bakeFPS=Number(opts.fps);if(!Number.isInteger(bakeFPS)||bakeFPS<40||bakeFPS>480)throw Error('Bake fps must be an integer between40 and480');
const out=path.resolve(root,opts.folder);if(!out.startsWith(path.join(root,'assets/models')+path.sep)||out.split(path.sep).includes('source'))throw Error('Output must be a derived model folder, never a source directory');
for(const key of ['rig','profile','output'])if(path.basename(opts[key])!==opts[key])throw Error('File arguments must be basenames');
if(opts.rig===opts.output)throw Error('Animated output must differ from original rig');
const url=p=>pathToFileURL(path.join(root,p)).href,mod=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
async function cpuLoader(){const three=url('assets/vendor/three/build/three.module.js'),utils=mod(fs.readFileSync(path.join(root,'assets/vendor/three/examples/jsm/utils/BufferGeometryUtils.js'),'utf8').replace("from 'three'",`from '${three}'`));const text=fs.readFileSync(path.join(root,'assets/vendor/three/examples/jsm/loaders/GLTFLoader.js'),'utf8').replace("from 'three'",`from '${three}'`).replace("from '../utils/BufferGeometryUtils.js'",`from '${utils}'`);return{THREE:await import(three),GLTFLoader:(await import(mod(text))).GLTFLoader};}
function readGLB(file){const b=fs.readFileSync(file),len=b.readUInt32LE(12);if(b.readUInt32LE(0)!==0x46546c67||b.readUInt32LE(8)!==b.length)throw Error('Incomplete GLB');return{b,g:JSON.parse(b.subarray(20,20+len).toString()),bin:b.subarray(28+len)};}
function encoded(g,bin){const text=Buffer.from(JSON.stringify(g)),pad=Buffer.alloc(Math.ceil(text.length/4)*4,32);text.copy(pad);const result=Buffer.alloc(28+pad.length+bin.length);result.writeUInt32LE(0x46546c67,0);result.writeUInt32LE(2,4);result.writeUInt32LE(result.length,8);result.writeUInt32LE(pad.length,12);result.writeUInt32LE(0x4e4f534a,16);pad.copy(result,20);result.writeUInt32LE(bin.length,20+pad.length);result.writeUInt32LE(0x004e4942,24+pad.length);bin.copy(result,28+pad.length);return result;}
function geometryOnly(g,bin){const d=structuredClone(g);for(const m of d.meshes)for(const p of m.primitives)delete p.material;const b=encoded(d,bin);return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);}
(async()=>{
 const file=path.join(out,opts.rig),{b,g,bin}=readGLB(file),hash=crypto.createHash('sha256').update(b).digest('hex'),profile=JSON.parse(fs.readFileSync(path.join(out,opts.profile)));
 if(hash!==profile.rigSha256&&hash!==profile.sha256)throw Error('Canonical rig hash mismatch');
 const{THREE,GLTFLoader}=await cpuLoader(),motionFile=path.join(root,'assets/artist-horse-motion.js'),motionHash=crypto.createHash('sha256').update(fs.readFileSync(motionFile)).digest('hex'),{createArtistMotion}=await import(url('assets/artist-horse-motion.js'));
 const gltf=await new Promise((resolve,reject)=>new GLTFLoader().parse(geometryOnly(g,bin),'',resolve,reject));gltf.scene.updateMatrixWorld(true);let skin;const skins=[];gltf.scene.traverse(o=>{if(o.isSkinnedMesh){skins.push(o);if(o.name==='HorseBody')skin=o;}});if(!skin)throw Error('Real BlueMesh HorseBody missing');
 const createMotion=profile.motionKind==='fjord'?(await import(url('assets/fjord-horse-motion.js'))).createFjordMotion:createArtistMotion;
 const motion=createMotion({THREE,root:gltf.scene,skin,heightM:profile.heightM,profile}),names=g.skins[0].joints.map(i=>g.nodes[i].name),bones=skin.skeleton.bones;
 if(names.length!==40||bones.length!==40)throw Error('Anatomical40 contract mismatch');
 const normalized=n=>n.replace(/[.\s]/g,''),order=names.map(n=>bones.findIndex(b=>normalized(b.name)===normalized(n)));if(order.some(i=>i<0))throw Error('Joint name mismatch');
 const canonical=['ROOT','pelvis','spine','chest','neck.lower','neck.upper','head','jaw','ear.L','ear.R','tail.1','tail.2','tail.3','tail.4',...['FL','FR'].flatMap(p=>['scapula','upperarm','forearm','cannon','pastern','hoof'].map(n=>p+'.'+n)),...['HL','HR'].flatMap(p=>['thigh','shin','cannon','pastern','hoof'].map(n=>p+'.'+n)),...['FL','FR','HL','HR'].map(p=>p+'.IK')];
 if(canonical.some(n=>!names.includes(n)))throw Error('Incomplete canonical anatomical rig');
 const jointOrder=new Map(g.skins[0].joints.map((n,i)=>[n,i]));for(const [i,n] of g.nodes.entries())for(const child of n.children||[])if(jointOrder.has(i)&&jointOrder.has(child)&&jointOrder.get(i)>=jointOrder.get(child))throw Error('Rig must be ordered parent before child');
 const rest=bones.map(b=>b.getWorldPosition(new THREE.Vector3())),parents=bones.map(b=>bones.indexOf(b.parent));
 const gaitAudit=[];let allFinite=true,maxSkinWeightError=0,maxQuaternionNormError=0;
 for(const o of skins){const w=o.geometry.attributes.skinWeight;for(let i=0;i<w.count;i++){let sum=0;for(let j=0;j<4;j++)sum+=w.getComponent(i,j);maxSkinWeightError=Math.max(maxSkinWeightError,Math.abs(sum-1));}}
 for(const gait of ['stand','walk','trot','canter','gallop','jump'])for(const lead of (['canter','gallop'].includes(gait)?['left','right']:['left'])){
  motion.reset();motion.set(gait,{lead});const row={gait,lead,samples:360,maxSoleTargetErrorM:0,maxReachErrorM:0,minSoleY:Infinity,maxLimbBoneLengthDeltaM:0,contactStates:[],maxWorldStanceDriftM:0,contactCounts:{LF:0,RF:0,LH:0,RH:0},contactPatterns:[]};let lastFeet=null;const patterns=new Set();
  for(let i=0;i<360;i++){motion.update(1/120);const s=motion.snapshot();const finite=s.localPositions.flat().every(Number.isFinite)&&s.localQuaternions.flat().every(Number.isFinite);allFinite&&=finite;
   for(const q of s.localQuaternions)maxQuaternionNormError=Math.max(maxQuaternionNormError,Math.abs(Math.hypot(...q)-1));
   for(let j=0;j<bones.length;j++){const parent=parents[j];if(parent<0||!/^(FL|FR|HL|HR)/.test(bones[j].name)||bones[j].name.endsWith('IK'))continue;const now=new THREE.Vector3(...s.bonePositions[j]).distanceTo(new THREE.Vector3(...s.bonePositions[parent])),old=rest[j].distanceTo(rest[parent])*s.metresPerUnit;row.maxLimbBoneLengthDeltaM=Math.max(row.maxLimbBoneLengthDeltaM,Math.abs(now-old));}
   if(i>65&&!s.transitioning){const ids=s.feet.filter(f=>f.contact).map(f=>f.id).sort();patterns.add(ids.join(','));for(const id of ids)row.contactCounts[id]++;}
   for(const f of s.feet){row.maxSoleTargetErrorM=Math.max(row.maxSoleTargetErrorM,new THREE.Vector3(...f.sole).distanceTo(new THREE.Vector3(...f.targetSole)));row.maxReachErrorM=Math.max(row.maxReachErrorM,f.reachError);row.minSoleY=Math.min(row.minSoleY,f.soleMinY);const previous=lastFeet?.find(x=>x.id===f.id);if(i>65&&previous?.contact&&f.contact&&!s.transitioning){row.maxWorldStanceDriftM=Math.max(row.maxWorldStanceDriftM,Math.hypot(f.worldSole[0]-previous.worldSole[0],f.worldSole[2]-previous.worldSole[2]));}}
   if(i%30===0)row.contactStates.push({t:(i+1)/120,feet:s.feet.filter(f=>f.contact).map(f=>f.id)});lastFeet=s.feet;
  }row.contactPatterns=[...patterns].sort();gaitAudit.push(row);
 }
 const sourceMeshNodes=g.nodes.filter(n=>n.mesh!==undefined),sourceMeshNodeCount=sourceMeshNodes.length;
 const sourceSkinnedPrimitiveCount=sourceMeshNodes.reduce((count,node)=>count+g.meshes[node.mesh].primitives.length,0);
 const allMeshNodesHaveSkin=sourceMeshNodes.every(node=>node.skin!==undefined&&g.meshes[node.mesh].primitives.every(p=>p.attributes.JOINTS_0!==undefined&&p.attributes.WEIGHTS_0!==undefined));
 const locomotion=gaitAudit.filter(r=>['walk','trot','canter','gallop'].includes(r.gait));
 const checks={allTransformsFinite:allFinite,quaternionsNormalized:maxQuaternionNormError<1e-5,weightsNormalized:maxSkinWeightError<1e-5,allNamed40:true,allFourSolesRecognized:true,allSourceMeshNodesSkinned:allMeshNodesHaveSkin&&skins.length===sourceSkinnedPrimitiveCount,soleFollowsTarget:gaitAudit.every(r=>r.maxSoleTargetErrorM<.004),noHoofGroundPenetration:gaitAudit.every(r=>r.minSoleY>-.004),targetReachErrorWithin6mm:gaitAudit.every(r=>r.maxReachErrorM<.006),limbLengthVariationWithin6mm:gaitAudit.every(r=>r.maxLimbBoneLengthDeltaM<.006),stanceFeetPlanted:gaitAudit.every(r=>r.maxWorldStanceDriftM<.008),allFourFeetCycleStanceAndSwing:locomotion.every(r=>Object.values(r.contactCounts).every(n=>n>0&&n<294)),walkAlwaysSupported:gaitAudit.filter(r=>r.gait==='walk').every(r=>!r.contactPatterns.includes('')),trotUsesDiagonalSupport:gaitAudit.filter(r=>r.gait==='trot').every(r=>r.contactPatterns.every(p=>['','LF,RH','LH,RF'].includes(p))&&r.contactPatterns.includes('LF,RH')&&r.contactPatterns.includes('LH,RF')),gallopHasSuspension:gaitAudit.filter(r=>r.gait==='gallop').every(r=>r.contactPatterns.includes('')),jumpHasFlight:gaitAudit.find(r=>r.gait==='jump').contactPatterns.includes('')};
 const failures=Object.entries(checks).filter(([k,v])=>!v).map(([k])=>k);
 const candidateMotionHash=profile.motionKind==='fjord'?crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'assets/fjord-horse-motion.js'))).digest('hex'):null;
 const audit={rigSha256:hash,motionModuleSha256:motionHash,candidateMotionModuleSha256:candidateMotionHash,method:'CPU site-vendored GLTFLoader + unchanged createArtistMotion, with declared candidate motion wrapper when present; actual HorseBody skin and soles; 120Hz stand/walk/trot/both canter leads/both gallop leads/jump',checks,failures,maxSkinWeightError,maxQuaternionNormError,sourceMeshNodeCount,sourceSkinnedPrimitiveCount,skinnedMeshCount:skins.length,gaits:gaitAudit};
 fs.writeFileSync(path.join(out,'motion-validation.json'),JSON.stringify(audit,null,2));console.log(JSON.stringify({checks,failures,gaits:gaitAudit.map(({contactStates,...r})=>r)}));
 if(failures.length)throw Error('Functional motion checks failed; do not bake/certify');
 if(opts['audit-only']==='true'){console.log(JSON.stringify({auditOnly:true,clipsBaked:false,motionModuleSha256:motionHash}));return;}
 const clips=[];
 const pose=()=>({p:order.map(i=>bones[i].position.toArray()),q:order.map(i=>bones[i].quaternion.toArray())});
 motion.set('rest');clips.push({name:'Rest',loop:true,duration:1,frames:[{time:0,...pose()},{time:1,...pose()}]});
 for(const spec of [{name:'Idle',gait:'stand',duration:8},{name:'Walk',gait:'walk'},{name:'Trot',gait:'trot'},{name:'Canter_Left',gait:'canter',lead:'left'},{name:'Canter_Right',gait:'canter',lead:'right'},{name:'Gallop_Left',gait:'gallop',lead:'left'},{name:'Gallop_Right',gait:'gallop',lead:'right'},{name:'Jump',gait:'jump',duration:1.72,loop:false}]){
  motion.reset();motion.set(spec.gait,{lead:spec.lead||'left'});const duration=spec.duration||1/motion.gaits[spec.gait].hz;
  if(spec.gait!=='jump')for(let i=0;i<Math.ceil((.6+2*duration)*120);i++)motion.update(1/120);
  const frames=[{time:0,...pose()}],count=Math.ceil(duration*bakeFPS);let previous=0;
  for(let i=1;i<=count;i++){const t=Math.min(i/bakeFPS,duration);motion.update(t-previous);frames.push({time:t,...pose()});previous=t;}
  const before=Math.max(...frames[0].q.flatMap((v,j)=>v.map((x,k)=>Math.abs(x-frames.at(-1).q[j][k]))));
  if(spec.loop!==false){
   // Time-driven ears and breathing need a smooth cyclic correction, not a
   // last-frame discontinuity. Correct their measured endpoint drift across
   // the full loop with zero-slope quintic ease; locomotion already cycles.
   const corrections=names.map((_,j)=>new THREE.Quaternion(...frames[0].q[j]).multiply(new THREE.Quaternion(...frames.at(-1).q[j]).invert()));
   const positionDrift=names.map((_,j)=>frames.at(-1).p[j].map((x,k)=>x-frames[0].p[j][k]));
   for(const frame of frames){const u=frame.time/duration,e=u*u*u*(10+u*(-15+6*u));for(let j=0;j<40;j++){frame.p[j]=frame.p[j].map((x,k)=>x-positionDrift[j][k]*e);const correction=new THREE.Quaternion().slerp(corrections[j],e);frame.q[j]=new THREE.Quaternion(...frame.q[j]).premultiply(correction).normalize().toArray();}}
   frames.at(-1).p=structuredClone(frames[0].p);frames.at(-1).q=structuredClone(frames[0].q);
  }
  clips.push({...spec,duration,loop:spec.loop!==false,frames,endpointMaxQuaternionDifferenceBeforeClosure:before});
 }
 let chunks=[bin],length=bin.length;const d=structuredClone(g);d.animations=[];
 function accessor(values,type){const width={SCALAR:1,VEC3:3,VEC4:4}[type],flat=values.flat(),array=Buffer.alloc(flat.length*4);flat.forEach((v,i)=>{if(!Number.isFinite(v))throw Error('Nonfinite bake');array.writeFloatLE(v,i*4);});const offset=length;chunks.push(array);length+=array.length;const vi=d.bufferViews.length;d.bufferViews.push({buffer:0,byteOffset:offset,byteLength:array.length});const a={bufferView:vi,componentType:5126,count:flat.length/width,type};if(type==='SCALAR'){a.min=[Math.min(...flat)];a.max=[Math.max(...flat)];}const ai=d.accessors.length;d.accessors.push(a);return ai;}
 const clipReports=[];
 for(const clip of clips){const animation={name:clip.name,samplers:[],channels:[],extras:{loop:clip.loop,authorship:`Meadowlark Ranch anatomical solver, sampled at ${bakeFPS} Hz; these clips are newly authored for the converted rig`}};const times=accessor(clip.frames.map(f=>f.time),'SCALAR');
  for(let j=0;j<40;j++)for(const track of ['translation','rotation']){const key=track==='translation'?'p':'q',values=clip.frames.map(f=>f[key][j]);if(key==='q')for(let i=1;i<values.length;i++)if(values[i].reduce((sum,v,k)=>sum+v*values[i-1][k],0)<0)values[i]=values[i].map(x=>-x);const output=accessor(values,key==='p'?'VEC3':'VEC4'),sampler=animation.samplers.length;animation.samplers.push({input:times,output,interpolation:'LINEAR'});animation.channels.push({sampler,target:{node:g.skins[0].joints[j],path:track}});}
  d.animations.push(animation);clipReports.push({name:clip.name,duration:clip.duration,loop:clip.loop,frames:clip.frames.length,endpointMaxQuaternionDifferenceBeforeClosure:clip.endpointMaxQuaternionDifferenceBeforeClosure||0,loopEndpointForcedEquivalent:clip.loop});
 }
 const finalBin=Buffer.concat(chunks);d.buffers[0].byteLength=finalBin.length;const final=encoded(d,finalBin),finalPath=path.join(out,opts.output);fs.writeFileSync(finalPath,final);
 const finalHash=crypto.createHash('sha256').update(final).digest('hex');profile.rigSha256=hash;profile.file=opts.output;profile.sha256=finalHash;profile.clips=clips.map(c=>c.name);profile.animationBakeFPS=bakeFPS;profile.motionStatus='all six live gait modes validated; nine own baked anatomical clips';profile.motionValidation='motion-validation.json';fs.writeFileSync(path.join(out,opts.profile),JSON.stringify(profile,null,2));
 const selected=clips.filter(c=>['Rest','Walk','Trot','Canter_Left','Gallop_Left','Jump'].includes(c.name)).map(c=>{const frame=c.frames[Math.min(c.frames.length-1,Math.round((c.name==='Jump'?.78:c.duration*.28)*bakeFPS))];return{name:c.name,time:frame.time,positions:frame.p,quaternions:frame.q};});
 fs.writeFileSync(path.join(out,'review-poses.json'),JSON.stringify({rigSha256:hash,animatedSha256:finalHash,names,poses:selected},null,2));
 const report={sourceRigSha256:hash,animatedSha256:finalHash,sourceBINPrefixPreserved:finalBin.subarray(0,bin.length).equals(bin),geometryMaterialsTexturesSkinsAndNodeDefinitionsUnchanged:JSON.stringify(d.meshes)===JSON.stringify(g.meshes)&&JSON.stringify(d.materials)===JSON.stringify(g.materials)&&JSON.stringify(d.images)===JSON.stringify(g.images)&&JSON.stringify(d.skins)===JSON.stringify(g.skins)&&JSON.stringify(d.nodes)===JSON.stringify(g.nodes),motionModuleSha256:motionHash,candidateMotionModuleSha256:candidateMotionHash,fps:bakeFPS,clips:clipReports};fs.writeFileSync(path.join(out,'animation-bake-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({file:finalPath,bytes:final.length,sha256:finalHash,clips:clipReports}));
})().catch(e=>{console.error(e);process.exitCode=1;});

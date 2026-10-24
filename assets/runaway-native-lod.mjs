import {createNativeHorseMotion,nativeHorseSpeedLimits} from './native-horse-motion.js?v=runaway-native-lod-1';
import {nativeGroomFacade,disposeMountedRig} from './game-hero-horse.js?v=horse-realism-20261020a-native-riding-locks-1';
import {configureNativeCustomization} from './native-horse-customization.js?v=world-presentations-1';
import {worldHorseCanDress} from './world-horse-lifecycle.mjs?v=ranch-actors-2';
import {withHorseVisualRandom,worldHorseWantsFull,morphPackedBytes} from './world-horse-lod.mjs?v=runaway-native-lod-1';

// Explicit three-owner visual approximation. Gameplay and its random stream stay
// in the original host. Private preparation never drains the live groom queues.
const signature=p=>[p.id,p.sha256,p.nativeVariant?.sha256,p.file,p.fitScale].join('|');
const materialCopy=m=>{const c=m.clone();c.onBeforeCompile=m.onBeforeCompile;c.customProgramCacheKey=m.customProgramCacheKey;return c;};
const materials=m=>Array.isArray(m)?m:[m];
const sameColors=(a,b)=>a?.body===b?.body&&a?.mane===b?.mane;
const finite=n=>Number.isFinite(n);
const localFrame=o=>[...o.position.toArray(),...o.quaternion.toArray(),...o.scale.toArray()];
const sameFrame=(o,a)=>localFrame(o).every((v,i)=>Object.is(v,a[i]));
export function warmRunawayNativeViews({THREE:T,renderer,views,realScene,colorTarget=null}){
 return withHorseVisualRandom('strict-runaway-warm',()=>{
  const vp=new T.Vector4(),sc=new T.Vector4(),clear=new T.Color();
  const saved={target:renderer.getRenderTarget(),cube:renderer.getActiveCubeFace(),mip:renderer.getActiveMipmapLevel(),viewport:renderer.getViewport(vp).clone(),scissor:renderer.getScissor(sc).clone(),scissorTest:renderer.getScissorTest(),clear:renderer.getClearColor(clear).clone(),alpha:renderer.getClearAlpha(),auto:renderer.autoClear,xr:renderer.xr.enabled,shadows:renderer.shadowMap.enabled,shadowAuto:renderer.shadowMap.autoUpdate,shadowNeeds:renderer.shadowMap.needsUpdate};
  // Ordinary render targets always select LinearSRGB in this Three revision.
  // Default-framebuffer SRGB therefore needs the real framebuffer, covered and
  // scissored to8x8; the final stock world draw still precedes curtain release.
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(55,1,.01,30),target=colorTarget?new T.WebGLRenderTarget(8,8,{type:colorTarget.texture.type,samples:colorTarget.samples||0}):null;
  if(target)target.texture.colorSpace=colorTarget.texture.colorSpace;scene.environment=realScene?.environment||null;scene.fog=realScene?.fog||null;camera.position.set(0,2,7);camera.lookAt(0,1,0);
  const lights=[];realScene?.traverseVisible(o=>{if(!o.isLight)return;const c=o.clone();c.position.copy(o.position);c.quaternion.copy(o.quaternion);if(c.shadow){c.shadow.mapSize.set(8,8);c.shadow.camera.near=.1;c.shadow.camera.far=30;if(c.isDirectionalLight){c.position.set(3,7,4);c.shadow.camera.left=c.shadow.camera.bottom=-5;c.shadow.camera.right=c.shadow.camera.top=5;c.target.position.set(0,1,0);}c.shadow.camera.updateProjectionMatrix();if(c.target)scene.add(c.target);}scene.add(c);lights.push(c);});
  try{
   if(!lights.some(l=>l.isDirectionalLight&&l.castShadow))throw Error('Current directional shadow warm context missing');
   renderer.xr.enabled=false;renderer.shadowMap.enabled=true;renderer.shadowMap.autoUpdate=true;renderer.shadowMap.needsUpdate=true;renderer.autoClear=true;renderer.setRenderTarget(target);renderer.setViewport(0,0,8,8);renderer.setScissor(0,0,8,8);renderer.setScissorTest(true);
   for(const view of views){scene.add(view.group);for(const m of view.group.children){m.morphTargetInfluences.fill(0);m.morphTargetInfluences[4]=1;}renderer.render(scene,camera);view.group.removeFromParent();}
   if(renderer.getContext().getError())throw Error('Runaway color/depth warm failed');
  }finally{
   for(const v of views)v.group.removeFromParent();for(const l of lights){l.shadow?.map?.dispose();l.shadow?.mapPass?.dispose();}target?.dispose();renderer.xr.enabled=saved.xr;renderer.shadowMap.enabled=saved.shadows;renderer.shadowMap.autoUpdate=saved.shadowAuto;renderer.shadowMap.needsUpdate=saved.shadowNeeds;renderer.autoClear=saved.auto;renderer.setRenderTarget(saved.target,saved.cube,saved.mip);renderer.setViewport(saved.viewport);renderer.setScissor(saved.scissor);renderer.setScissorTest(saved.scissorTest);renderer.setClearColor(saved.clear,saved.alpha);
  }
 });
}
export async function bakeRunawayNativeTemplate({THREE:T,asset,instantiate,maxTextureSize=16384,yieldCovered=async()=>{},checkCovered=()=>true}={}){
 if(asset?.key!=='bay'||asset.profile?.nativeKind!=='horse'||!asset.profile.nativeBreed||asset.profile.family==='fantasy')throw Error('Exact native bay required');
 const ownedGeometry=[],ownedMaterials=[],rows=[];let rig=null,samples=0,steps=0;
 const construct=fn=>withHorseVisualRandom('strict-runaway-bay-prepare',fn);
 try{
  construct(()=>{
   rig=instantiate(asset);rig.nativeMotion=rig.heroMotion=createNativeHorseMotion({THREE:T,root:rig.nativeRoot,clips:rig.animations,profile:rig.profile,deferGroom:false});
   rig.groom=nativeGroomFacade({THREE:T,scene:rig.scene,skin:rig.skin,mount:rig.scene,profile:rig.profile,deferUpdate:false});
   if(!rig.groom.flowing)throw Error('Actual flowing groom required');
   rig.scene.updateMatrixWorld(true);
   rig.scene.traverse(mesh=>{
    if(!mesh.isSkinnedMesh||[rig.profile.tackVertexCount,5092].includes(mesh.geometry.attributes.position.count))return;
    const g=mesh.geometry,geometry=new T.BufferGeometry();ownedGeometry.push(geometry);
    for(const [name,a]of Object.entries(g.attributes))if(!['skinIndex','skinWeight'].includes(name))geometry.setAttribute(name,a.clone());
    if(g.attributes.position.count===rig.profile.hairVertexCount&&!geometry.attributes.nativeTailDye){
     const mask=new Float32Array(g.attributes.position.count),J=g.attributes.skinIndex,W=g.attributes.skinWeight;
     for(let i=0;i<mask.length;i++)for(let k=0;k<4;k++)if(/tail/i.test(mesh.skeleton.bones[J.getComponent(i,k)].name))mask[i]+=W.getComponent(i,k);
     geometry.setAttribute('nativeTailDye',new T.BufferAttribute(mask,1));
    }
    if(g.index)geometry.setIndex(g.index.clone());geometry.groups=g.groups.map(q=>({...q}));geometry.morphTargetsRelative=false;geometry.morphAttributes={position:[],normal:[]};
    const material=Array.isArray(mesh.material)?mesh.material.map(materialCopy):materialCopy(mesh.material);ownedMaterials.push(...materials(material));
    rows.push({source:mesh,geometry,material,name:mesh.name,matrix:mesh.matrixWorld.clone(),sourceBounds:(g.boundingBox||new T.Box3().setFromBufferAttribute(g.attributes.position)).clone(),userData:{...mesh.userData,nativeWorldHorseLOD:true}});
   });
  });
  if(!rows.some(r=>r.source===rig.skin)||!rows.some(r=>r.source.geometry.attributes.position.count===rig.profile.hairVertexCount))throw Error('Incomplete native body/eyes/hair rows');
  const motion=rig.nativeMotion,point=new T.Vector3(),normal=new T.Vector3(),joint=new T.Matrix4(),weighted=new T.Matrix4(),linear=new T.Matrix3();
  async function advance(seconds,rate=1){
   const count=Math.ceil(seconds*60),dt=seconds/count;
   for(let i=0;i<count;i++){if(!checkCovered())throw Error('Preparation left loading curtain');motion.update(dt,{rate});rig.groom.update(dt,motion.state);steps++;if(i%8===7)await yieldCovered();}
  }
  function sample(){
   if(!checkCovered())throw Error('Preparation left loading curtain');rig.scene.updateMatrixWorld(true);const done=new Set();
   for(const row of rows){const mesh=row.source;if(!mesh.matrixWorld.equals(row.matrix))throw Error('Animated source mesh frame unsupported');if(!done.has(mesh.skeleton)){mesh.skeleton.update();done.add(mesh.skeleton);}
    const n=mesh.geometry.attributes.position.count,p=new Float32Array(n*3),v=new Float32Array(n*3),J=mesh.geometry.attributes.skinIndex,W=mesh.geometry.attributes.skinWeight;
    for(let i=0;i<n;i++){mesh.getVertexPosition(i,point).toArray(p,i*3);weighted.elements.fill(0);for(let k=0;k<4;k++){joint.fromArray(mesh.skeleton.boneMatrices,J.getComponent(i,k)*16);const w=W.getComponent(i,k);for(let c=0;c<16;c++)weighted.elements[c]+=joint.elements[c]*w;}weighted.premultiply(mesh.bindMatrixInverse).multiply(mesh.bindMatrix);linear.setFromMatrix4(weighted);normal.fromBufferAttribute(mesh.geometry.attributes.normal,i).applyMatrix3(linear).normalize().toArray(v,i*3);}
    if(!p.every(finite)||!v.every(finite))throw Error('Nonfinite runtime groom sample');row.geometry.morphAttributes.position.push(new T.BufferAttribute(p,3));row.geometry.morphAttributes.normal.push(new T.BufferAttribute(v,3));
   }samples++;
  }
  // Four actual walk phases after two settled cycles, plus actual native stand.
  // Graze/actions always use full; this is a five-target visual approximation.
  const duration=rig.profile.nativeGaits.walk.durationS;
  motion.set('walk',{speedMps:1.2});await advance(duration*2);sample();
  for(let i=1;i<4;i++){await advance(duration/4);sample();}
  motion.set('stand',{speedMps:0});await advance(.5);sample();
  let baseBytes=0,morphBytes=0,packedBytes=0,triangles=0,vertices=0;
  for(const row of rows){row.geometry.computeBoundingBox();row.geometry.computeBoundingSphere();for(const a of Object.values(row.geometry.attributes))baseBytes+=a.array.byteLength;baseBytes+=row.geometry.index?.array.byteLength||0;for(const a of [...row.geometry.morphAttributes.position,...row.geometry.morphAttributes.normal])morphBytes+=a.array.byteLength;packedBytes+=morphPackedBytes(row.geometry.attributes.position.count,5,maxTextureSize);triangles+=(row.geometry.index?.count||row.geometry.attributes.position.count)/3;vertices+=row.geometry.attributes.position.count;delete row.source;}
  const result={key:'bay',signature:signature(asset.profile),sourceLocal:localFrame(rig.scene),profile:{...rig.profile},rows,duration,targets:5,baseBytes,morphBytes,packedBytes,residentBytes:2*baseBytes+2*morphBytes+2*packedBytes,triangles,vertices,samples,steps,flowingFrames:rig.groom.stats.flowing.frames,dispose(){for(const g of ownedGeometry)g.dispose();for(const m of ownedMaterials)m.dispose();}};return result;
 }catch(error){for(const g of ownedGeometry)g.dispose();for(const m of ownedMaterials)m.dispose();throw error;}
 finally{if(rig)disposeMountedRig(rig);}
}

export function createRunawayNativeLOD({THREE:T,models,instantiate,worldLOD,renderer,camera,player,fullDress,fullTick,isCovered,viewSafe,colors,getDefinition=()=>null,realScene,colorTarget=null,ownersReady=()=>Promise.resolve(),enabled=false,timeoutMs=20000,yieldCovered=()=>new Promise(resolve=>requestAnimationFrame(resolve)),warmViews=warmRunawayNativeViews}={}){
 const owners=new Map(),pool=[];let template=null,lease=null,disposed=false,settled=false,status='preparing',error=null,enabledNow=!!enabled,epoch=0;
 const start=performance.now();let deadline=start+90000;const stats={preparationMs:0,fullTicks:0,farTicks:0,wakes:0,parks:0,failures:0};
 const covered=()=>!disposed&&!settled&&isCovered()&&performance.now()<deadline;
 const clearView=view=>{view.group.removeFromParent();view.appearance?.nativeCustomization?.dispose();for(const m of view.materials)m.dispose();};
 function makeView(color,index){return withHorseVisualRandom('strict-runaway-view-'+index,()=>{
  const group=new T.Group(),owned=[];group.name='Strict sampled native bay runaway';group.userData.nativeWorldHorseLOD=true;group.userData.nativeRunawayLOD=true;let skin=null;
  let appearance=null;try{for(const row of template.rows){const material=Array.isArray(row.material)?row.material.map(materialCopy):materialCopy(row.material);owned.push(...materials(material));const mesh=new T.Mesh(row.geometry,material);mesh.name='Runaway far '+row.name;mesh.userData={...row.userData,nativeRunawayLOD:true};mesh.matrixAutoUpdate=false;mesh.matrix.copy(row.matrix);mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=true;mesh.customDepthMaterial=new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking});owned.push(mesh.customDepthMaterial);mesh.customDistanceMaterial=new T.MeshDistanceMaterial();owned.push(mesh.customDistanceMaterial);group.add(mesh);if(row.geometry.attributes.position.count===template.profile.bodyVertexCount)skin=mesh;}
  if(!skin)throw Error('Far bay body absent');appearance={scene:group,skin,baseMat:skin.material,profile:{...template.profile},materials:owned};
  const bounds=skin.geometry.boundingBox;skin.geometry.boundingBox=template.rows.find(r=>r.geometry===skin.geometry).sourceBounds;
  try{configureNativeCustomization({THREE:T,rig:appearance,horse:{breed:'bay',colors:color,id:1},defaults:getDefinition('bay')});}finally{skin.geometry.boundingBox=bounds;}
  return{group,materials:owned,appearance,color:{...color},owner:null};}catch(error){appearance?.nativeCustomization?.dispose();for(const m of owned)m.dispose();throw error;}
 });}
 const ready=Promise.resolve().then(async()=>{
  const token=epoch;let timer;
  try{
   // Do not take ownership of a normal breed download/parser/constructor.
   // Existing actors request bay naturally; a missed covered deadline stays full.
   const residentDeadline=start+timeoutMs;let asset;
   while(!(asset=models.get('bay'))){if(!covered()||performance.now()>=residentDeadline)throw Error('Natural bay not resident before covered deadline');await yieldCovered();}
   await Promise.race([Promise.resolve().then(ownersReady),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Owner readiness timeout')),Math.max(0,deadline-performance.now()));})]);clearTimeout(timer);
   deadline=Math.min(deadline,performance.now()+15000);
   if(token!==epoch||!covered()||asset?.key!=='bay'||models.resolve('bay')!=='bay')throw Error('Exact bay not ready under curtain');
   // The old manager owns the aggregate cache ceiling, including this lease.
   const estimate=worldLOD.estimateTemplateBytes(asset,5);lease=worldLOD.reserveExternal('strict-runaway-bay',estimate);if(!lease)throw Error('Shared horse template budget unavailable');
   template=await bakeRunawayNativeTemplate({THREE:T,asset,instantiate,maxTextureSize:renderer.capabilities.maxTextureSize,yieldCovered,checkCovered:covered});
   if(token!==epoch||!covered()||!lease.resize(template.residentBytes))throw Error('Prepared horse template exceeds shared budget');
   for(let i=0;i<3;i++){if(!covered())throw Error('View preparation left curtain');pool.push(makeView(colors[i],i));}
   if(!covered())throw Error('Template warm left curtain');warmViews({THREE:T,renderer,views:pool,realScene,colorTarget:typeof colorTarget==='function'?colorTarget():colorTarget});status='ready';
  }catch(cause){error=String(cause?.message||cause);status='retained-full';stats.failures++;for(const view of pool)clearView(view);pool.length=0;template?.dispose();template=null;lease?.release();lease=null;}
  finally{clearTimeout(timer);settled=true;stats.preparationMs=performance.now()-start;}
  return api;
 });
 function snapshotOwner(s){return{skinId:s.rig.skin.id,groupId:s.parts.group.id,mode:s.mode,breed:'bay',templateKey:template?.key||null,phase:s.phase,gait:s.gait,parked:s.mode==='far',detached:s.rig.scene.parent===null,fullTicks:s.fullTicks,farTicks:s.farTicks,scale:s.parts.group.scale.toArray(),reason:s.reason};}
 function wake(s,reason,rebase=true){
  if(s.mode!=='far')return;s.view.group.removeFromParent();if(s.rig.scene.parent===null)s.parts.group.add(s.rig.scene);
  s.rig.scene.updateWorldMatrix(true,false);s.rig.scene.updateMatrixWorld(true);
  if(rebase){s.rig.groom?.reset();
  if(['walk','stand','rest'].includes(s.rig.heroMotion.mode)&&!s.rig.heroMotion.action&&!s.rig.heroMotion.blocksTravel)s.rig.heroMotion.rebaseVisualLoop(s.gait,s.phase,s.speed);
  // One bounded reseed/materialization sample, never a skipped-time replay.
  // This direct per-owner call also completes an immediate photo shutter wake.
  s.rig.scene.updateWorldMatrix(true,false);s.rig.scene.updateMatrixWorld(true);
  s.rig.groom?.flowing?.update(1/120,s.rig.heroMotion.state,{finalizedPose:true});s.rig.groom?.feathers?.update(1/120,s.rig.heroMotion.state);}
  s.rig.phase=s.phase;s.mode='full';s.reason=reason;stats.wakes++;
 }
 function forceFull(reason='explicit-view'){for(const s of [...owners.values()]){if(s.ent.rig!==s.rig||s.ent.parts!==s.parts)discard(s.ent);else wake(s,reason,s.rig.heroMotion===s.motion&&s.rig.groom===s.groom);}}
 function setEnabled(value){enabledNow=!!value;if(!enabledNow)forceFull('disabled');}
 function release(ent){const s=owners.get(ent);if(!s)return;if(ent.rig!==s.rig||ent.parts!==s.parts){discard(ent);return;}wake(s,'release');s.view.owner=null;owners.delete(ent);}
 function discard(ent){const s=owners.get(ent);if(!s)return;s.view.group.removeFromParent();if(ent.rig===s.rig&&ent.parts===s.parts&&s.rig.scene.parent===null)s.parts.group.add(s.rig.scene);s.view.owner=null;owners.delete(ent);}
 function update(ent,speed,dt,t,graze=0){
  if(disposed){if(worldHorseCanDress(ent,ent.parts)&&!ent.done&&ent.parts.group.parent){fullDress(ent,ent.parts,ent.colors,{});if(ent.rig)fullTick(ent,speed,dt,t,graze);}return;}
  if(!worldHorseCanDress(ent,ent.parts)||ent.done||!ent.parts.group.parent){discard(ent);return;}
  let dressed=false,s=owners.get(ent);if(s&&(s.parts!==ent.parts||s.rig!==ent.rig)){discard(ent);s=null;}
  if(!s){fullDress(ent,ent.parts,ent.colors,{});dressed=true;const rig=ent.rig,view=pool.find(v=>!v.owner&&sameColors(v.color,ent.colors));
   if(template&&view&&rig?.key==='bay'&&typeof rig.heroMotion?.rebaseVisualLoop==='function'&&rig.groom?.flowing&&signature(rig.profile)===template.signature&&sameFrame(rig.scene,template.sourceLocal)&&ent.parts.group.userData.breed==='bay'&&ent.parts.group.scale.equals(new T.Vector3(1,1,1))){view.owner=ent;const proof=[];rig.scene.traverse(o=>{if(o.isMesh)proof.push([o,o.geometry,o.material]);});s={ent,rig,parts:ent.parts,view,proof,motion:rig.heroMotion,groom:rig.groom,mode:'full',phase:rig.phase||0,gait:'stand',speed:0,fullTicks:0,farTicks:0,reason:'captured',limits:nativeHorseSpeedLimits(rig.profile,Math.abs(rig.scene.scale.x))};owners.set(ent,s);}
  }
  if(!s){if(ent.rig)fullTick(ent,speed,dt,t,graze);return;}
  const m=s.rig.heroMotion,p=s.parts.group,valid=ent.rig===s.rig&&m===s.motion&&s.rig.groom===s.groom&&s.proof.every(([o,g,mat])=>o.geometry===g&&o.material===mat)&&signature(s.rig.profile)===template?.signature&&sameFrame(s.rig.scene,template.sourceLocal)&&p.scale.x===1&&p.scale.y===1&&p.scale.z===1&&sameColors(ent.colors,s.view.color)&&finite(ent.x)&&finite(ent.z)&&finite(dt)&&dt>=0&&dt<=.20;
  const unsafe=!enabledNow||status!=='ready'||!viewSafe()||!m||ent.caught||ent.calm>0||ent.rider||ent.interacting||speed<0||speed>1.2+1e-7||!['walk','stand','rest'].includes(m.mode)||m.action||m.blocksTravel||m.transitioning||s.rig.nativeFlying||s.rig.nativeReverse;
  const distance=Math.hypot(ent.x-player.pos.x,ent.z-player.pos.z),cameraDistance=Math.hypot(ent.x-camera.position.x,p.position.y-camera.position.y,ent.z-camera.position.z),pixels=2.1/(Math.max(1,cameraDistance)*Math.tan(camera.fov*Math.PI/360))*renderer.domElement.height/2;
  if(!valid||unsafe||worldHorseWantsFull(s.mode,{distance,projectedHeight:pixels,interacting:false})){
   wake(s,!valid?'owner-changed':unsafe?'full-policy':'near',valid);if(!dressed)fullDress(ent,ent.parts,ent.colors,{});if(ent.rig!==s.rig){discard(ent);if(ent.rig)fullTick(ent,speed,dt,t,graze);return;}fullTick(ent,speed,dt,t,graze);stats.fullTicks++;s.fullTicks++;s.phase=s.rig.phase||0;s.gait=m?.mode==='walk'?'walk':'stand';s.speed=speed;return;
  }
  if(s.mode!=='far'){s.rig.scene.removeFromParent();p.add(s.view.group);s.mode='far';s.phase=s.rig.phase||0;stats.parks++;}
  const moving=speed>.02,rate=moving?Math.min(2,speed/s.limits.gaitSpeeds.walk*s.limits.gaitRates.walk):1;s.gait=moving?'walk':'stand';s.speed=speed;
  const duration=moving?template.duration:(s.rig.profile.nativeIdleClip?T.AnimationClip.findByName(s.rig.animations,s.rig.profile.nativeIdleClip)?.duration||1:1);s.phase=(s.phase+dt*rate/duration)%1;
  const u=s.phase*4,a=Math.floor(u)%4,b=(a+1)%4,f=u-Math.floor(u);
  for(const mesh of s.view.group.children){const weights=mesh.morphTargetInfluences;weights.fill(0);if(moving){weights[a]=1-f;weights[b]=f;}else weights[4]=1;}
  stats.farTicks++;s.farTicks++;
 }
 const api={ready,get settled(){return settled;},update,release,forceFull,setEnabled,inspect:()=>({status,error,enabled:enabledNow,ready:status==='ready',settled,...stats,lastBuildMs:stats.preparationMs,bakeCount:template?1:0,pending:settled?0:1,cacheBytes:worldLOD.stats().cacheBytes,template:template?{key:template.key,signature:template.signature,bytes:template.residentBytes,targets:template.targets,vertices:template.vertices,samples:template.samples,flowingFrames:template.flowingFrames}:null,owners:[...owners.values()].map(snapshotOwner),fullActors:[...owners.values()].filter(s=>s.mode==='full').length,farActors:[...owners.values()].filter(s=>s.mode==='far').length,sharedCache:worldLOD.stats()}),dispose(){if(disposed)return;disposed=true;epoch++;forceFull('disposed');owners.clear();for(const v of pool)clearView(v);pool.length=0;template?.dispose();template=null;lease?.release();lease=null;}};
 return api;
}

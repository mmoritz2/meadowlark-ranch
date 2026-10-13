import {createNativeHorseMotion} from './native-horse-motion.js?v=equestrian-style-20261012';
import {disposeMountedRig} from './game-hero-horse.js?v=equestrian-style-20261012';
import {configureNativeCustomization} from './native-horse-customization.js?v=world-presentations-1';
import {worldHorseCanDress} from './world-horse-lifecycle.mjs?v=ranch-actors-2';
export const WORLD_HORSE_LOD_VERSION='native-world-pose-1';
let visualEpoch=0;
const disposeTemplateResources=(geometries,materials)=>()=>{for(const g of geometries)g.dispose();for(const m of materials)m.dispose();};
const TAU=Math.PI*2, smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*x*(10+x*(-15+6*x));};
export function withHorseVisualRandom(seed,fn){
 const previous=Math.random;let value=2166136261;for(const c of String(seed))value=Math.imul(value^c.charCodeAt(0),16777619);
 Math.random=()=>{value=(value+0x6d2b79f5)|0;let z=Math.imul(value^value>>>15,1|value);z^=z+Math.imul(z^z>>>7,61|z);return((z^z>>>14)>>>0)/4294967296;};
 try{if(fn.constructor.name==='AsyncFunction')throw Error('Visual construction must be synchronous');return fn();}finally{Math.random=previous;}
}
const cloneMaterial=m=>{const copy=m.clone();copy.onBeforeCompile=m.onBeforeCompile;copy.customProgramCacheKey=m.customProgramCacheKey;return copy;};
export function morphPackedBytes(count,targets,maxTextureSize=16384){const width=Math.min(count*2,maxTextureSize),height=Math.ceil(count*2/width);return width*height*4*4*targets;}
export function estimateWorldHorseTemplateBytes(asset,maxTextureSize=16384){
 let base=0,morph=0,packed=0;asset.scene.traverse(mesh=>{if(!mesh.isSkinnedMesh||[asset.profile.tackVertexCount,5092].includes(mesh.geometry.attributes.position.count))return;const g=mesh.geometry,n=g.attributes.position.count;for(const [name,a]of Object.entries(g.attributes))if(!['skinIndex','skinWeight'].includes(name))base+=a.array.byteLength;base+=g.index?.array.byteLength||0;if(n===asset.profile.hairVertexCount&&!g.attributes.nativeTailDye)base+=n*4;morph+=n*3*4*2*6;packed+=morphPackedBytes(n,6,maxTextureSize);});return 2*base+2*morph+2*packed;
}
const safeTemplateAsset=asset=>asset?.profile?.nativeKind==='horse'&&asset.profile.family!=='fantasy'&&!asset.profile.nativeVariant?.groom?.uprightCrest&&!asset.profile.nativeVariant?.groom?.equestrian;
export function poseEnvelope(phase){return smooth(phase/.24)*(1-smooth((phase-.68)/.32));}
export function worldHorseWantsFull(previous,{distance,projectedHeight=0,interacting=false}){
 if(interacting)return true;
 return previous==='full'?distance<80||projectedHeight>24:distance<58||projectedHeight>32;
}
function maskHair(THREE,mesh,profile){
 if(mesh.geometry.attributes.nativeTailDye||mesh.geometry.attributes.position.count!==profile.hairVertexCount&&!mesh.userData.nativeEquestrianGroom)return;
 const ids=mesh.geometry.attributes.skinIndex,weights=mesh.geometry.attributes.skinWeight,mask=new Float32Array(ids.count);
 for(let i=0;i<mask.length;i++)for(let j=0;j<4;j++)if(/tail/i.test(mesh.skeleton.bones[ids.getComponent(i,j)]?.name||''))mask[i]+=weights.getComponent(i,j);
 const lashes=mesh.geometry.attributes.nativeEquestrianLash;if(lashes)for(let i=0;i<mask.length;i++)if(lashes.getX(i)>0)mask[i]=-1;
 return new THREE.BufferAttribute(mask,1);
}
/* Samples the actual approved controller. Each plain mesh retains the native
 * source mesh's static transform, UVs and authored normal direction formula. */
export function bakeWorldHorsePoses({THREE,asset,instantiate,maxTextureSize=16384}){
 return withHorseVisualRandom(asset.key+'|'+WORLD_HORSE_LOD_VERSION+'|'+(++visualEpoch),()=>{
  let rig=instantiate(asset);if(!rig.profile.nativeBreed||rig.profile.nativeKind!=='horse')throw Error('Far horse requires an approved native equine');
  const motion=createNativeHorseMotion({THREE,root:rig.nativeRoot,clips:rig.animations,profile:rig.profile});rig.nativeMotion=motion;
  const sources=[];rig.scene.traverse(o=>{if(o.isSkinnedMesh&&![rig.profile.tackVertexCount,5092].includes(o.geometry.attributes.position.count)){sources.push(o);}});
  const geometries=[],materials=[];let result;
  try{
   const rows=sources.map(mesh=>{
    const geometry=new THREE.BufferGeometry();geometries.push(geometry);
    for(const [name,attribute]of Object.entries(mesh.geometry.attributes))if(!['skinIndex','skinWeight'].includes(name))geometry.setAttribute(name,attribute.clone());
    const hairMask=maskHair(THREE,mesh,rig.profile);if(hairMask)geometry.setAttribute('nativeTailDye',hairMask);
    if(mesh.geometry.index)geometry.setIndex(mesh.geometry.index.clone());geometry.groups=mesh.geometry.groups.map(g=>({...g}));geometry.morphTargetsRelative=false;
    geometry.morphAttributes={position:[],normal:[]};
    const material=Array.isArray(mesh.material)?mesh.material.map(cloneMaterial):cloneMaterial(mesh.material);materials.push(...(Array.isArray(material)?material:[material]));
    return{source:mesh,geometry,material,name:mesh.name,matrix:null,sourceBounds:(mesh.geometry.boundingBox||new THREE.Box3().setFromBufferAttribute(mesh.geometry.attributes.position)).clone(),userData:{...mesh.userData,nativeWorldHorseLOD:true}};
   });
   const point=new THREE.Vector3(),normal=new THREE.Vector3(),matrix=new THREE.Matrix4(),weighted=new THREE.Matrix4(),linear=new THREE.Matrix3(),v=new THREE.Vector3();
   function sample(){rig.scene.updateMatrixWorld(true);const done=new Set();for(const row of rows){const mesh=row.source;if(!done.has(mesh.skeleton)){mesh.skeleton.update();done.add(mesh.skeleton);}const count=mesh.geometry.attributes.position.count,p=new Float32Array(count*3),n=new Float32Array(count*3),indices=mesh.geometry.attributes.skinIndex,weights=mesh.geometry.attributes.skinWeight;
    for(let i=0;i<count;i++){
     mesh.getVertexPosition(i,point);point.toArray(p,i*3);weighted.elements.fill(0);
     for(let j=0;j<4;j++){matrix.fromArray(mesh.skeleton.boneMatrices,indices.getComponent(i,j)*16);const w=weights.getComponent(i,j);for(let k=0;k<16;k++)weighted.elements[k]+=matrix.elements[k]*w;}
     weighted.premultiply(mesh.bindMatrixInverse).multiply(mesh.bindMatrix);linear.setFromMatrix4(weighted);normal.fromBufferAttribute(mesh.geometry.attributes.normal,i).applyMatrix3(linear).normalize().toArray(n,i*3);
    }
    row.geometry.morphAttributes.position.push(new THREE.BufferAttribute(p,3));row.geometry.morphAttributes.normal.push(new THREE.BufferAttribute(n,3));
   }}
   const duration=rig.profile.nativeGaits.walk.durationS;
   motion.set('walk',{speedMps:rig.profile.nativeGaits.walk.nominalSpeedMps});motion.update(duration,{rate:1});sample();
   for(let i=1;i<4;i++){motion.update(duration/4,{rate:1});sample();}
   motion.set('rest');motion.update(1);sample();
   if(!motion.startAction('graze',{elapsedS:rig.profile.nativeActionGrazeDurationS?rig.profile.nativeActionGrazeDurationS*.4:2.88}))throw Error('Approved graze action missing');motion.update(.22);sample();
   rig.scene.updateMatrixWorld(true);
   let baseBytes=0,morphBytes=0,packedBytes=0,triangles=0,vertices=0;
   for(const row of rows){row.matrix=row.source.matrixWorld.clone();row.geometry.computeBoundingBox();row.geometry.computeBoundingSphere();for(const a of Object.values(row.geometry.attributes))baseBytes+=a.array.byteLength;baseBytes+=row.geometry.index?.array.byteLength||0;for(const arrays of Object.values(row.geometry.morphAttributes))for(const a of arrays)morphBytes+=a.array.byteLength;packedBytes+=morphPackedBytes(row.geometry.attributes.position.count,6,maxTextureSize);triangles+=(row.geometry.index?.count||row.geometry.attributes.position.count)/3;vertices+=row.geometry.attributes.position.count;delete row.source;}
   result={key:asset.key,profile:{...rig.profile},rows,duration,nominalSpeedMps:rig.profile.nativeGaits.walk.nominalSpeedMps*rig.scene.scale.x,baseBytes,morphBytes,packedBytes,residentBytes:2*baseBytes+2*morphBytes+2*packedBytes,triangles,vertices,targets:6,materials,geometryCount:rows.length,dispose:disposeTemplateResources(geometries,materials)};
  }catch(error){for(const g of geometries)g.dispose();for(const m of materials)m.dispose();throw error;}finally{disposeMountedRig(rig);rig=null;}
  return result;
 });
}
/* Prewarm Three's real morph texture under the visual RNG. An isolated scene
 * writes only into its own target; every renderer state this function changes
 * is restored before the caller's frame can continue. */
export function warmWorldHorsePoses({THREE,renderer,template}){
 return withHorseVisualRandom('warm|'+template.key,()=>{
  const viewport=new THREE.Vector4(),scissor=new THREE.Vector4(),clear=new THREE.Color(),state={target:renderer.getRenderTarget(),cube:renderer.getActiveCubeFace(),mip:renderer.getActiveMipmapLevel(),viewport:renderer.getViewport(viewport).clone(),scissor:renderer.getScissor(scissor).clone(),scissorTest:renderer.getScissorTest(),clear:renderer.getClearColor(clear).clone(),alpha:renderer.getClearAlpha(),auto:renderer.autoClear,xr:renderer.xr.enabled,shadows:renderer.shadowMap.enabled};
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(55,1,.01,30),target=new THREE.WebGLRenderTarget(8,8);camera.position.set(0,2,7);camera.lookAt(0,1,0);scene.add(new THREE.AmbientLight(0xffffff,1));
  for(const row of template.rows){const mesh=new THREE.Mesh(row.geometry,row.material);mesh.matrixAutoUpdate=false;mesh.matrix.copy(row.matrix);mesh.frustumCulled=false;mesh.morphTargetInfluences[4]=1;scene.add(mesh);}
  try{renderer.xr.enabled=false;renderer.shadowMap.enabled=false;renderer.autoClear=true;renderer.setRenderTarget(target);renderer.setViewport(0,0,8,8);renderer.setScissorTest(false);renderer.render(scene,camera);if(renderer.getContext().getError())throw Error('Native far morph prewarm failed');}
  finally{renderer.setRenderTarget(state.target,state.cube,state.mip);renderer.setViewport(state.viewport);renderer.setScissor(state.scissor);renderer.setScissorTest(state.scissorTest);renderer.setClearColor(state.clear,state.alpha);renderer.autoClear=state.auto;renderer.xr.enabled=state.xr;renderer.shadowMap.enabled=state.shadows;target.dispose();}
 });
}
export function createWorldHorseLOD({THREE,models,instantiate,renderer,camera,player,fullDress,fullTick,undress,getFallback,getDefinition,budgetBytes=64*1024*1024,maxEntries=2}){
 const cache=new Map(),actors=new Map(),pending=new Map(),modelPending=new Map(),failures=new Map();let reservedBytes=0,bakeCount=0,evictions=0,rejected=0,lastBuildMs=0;
 const api={update,release,fullReady,resumeFull,loadFull,supportsBreed,stats,actors:()=>Array.from(actors.values()).map(s=>({ent:s.ent,group:s.parts.group,representation:s.mode,requestedBreed:s.breed,template:s.entry?.template.key||null,standIn:!!s.entry&&s.entry.template.key!==models.resolve(s.breed)}))};
 function supportsBreed(breed){const profile=models.profile?.(breed)||models.get(breed)?.profile;return profile?.nativeKind==='horse'&&profile.family!=='fantasy';}
 const cacheKey=asset=>asset.key+'|'+asset.profile.nativeVariant?.sha256+'|'+asset.profile.file+'|'+WORLD_HORSE_LOD_VERSION;
 function currentBytes(){return Array.from(cache.values()).reduce((n,e)=>n+e.template.residentBytes,0);}
 function request(asset){const key=cacheKey(asset);if(cache.has(key))return cache.get(key);if(pending.has(key)||performance.now()<(failures.get(key)||0))return null;
  if(cache.size+pending.size>=maxEntries){const old=Array.from(cache.values()).filter(e=>!e.refs).sort((a,b)=>a.used-b.used)[0];if(old){old.template.dispose();cache.delete(old.key);evictions++;}else{rejected++;return null;}}
  const estimate=estimateWorldHorseTemplateBytes(asset,renderer.capabilities.maxTextureSize);if(currentBytes()+reservedBytes+estimate>budgetBytes){rejected++;return null;}reservedBytes+=estimate;
  const promise=Promise.resolve().then(()=>{
   const start=performance.now(),template=bakeWorldHorsePoses({THREE,asset,instantiate,maxTextureSize:renderer.capabilities.maxTextureSize});
   if(currentBytes()+template.residentBytes>budgetBytes){template.dispose();throw Error('Far horse cache budget exceeded');}
   try{warmWorldHorsePoses({THREE,renderer,template});}catch(error){template.dispose();throw error;}const entry={key,template,refs:0,used:performance.now()};cache.set(key,entry);bakeCount++;lastBuildMs=performance.now()-start;return entry;
  }).catch(error=>{failures.set(key,performance.now()+6000);console.warn('Far native horse preparation',asset.key,error);return null;}).finally(()=>{pending.delete(key);reservedBytes-=estimate;});pending.set(key,promise);return null;
 }
 function clearVisual(state){if(state.group){state.group.removeFromParent();state.appearance?.nativeCustomization?.dispose();for(const m of state.materials)m.dispose();state.group=null;}if(state.entry){state.entry.refs--;state.entry.used=performance.now();state.entry=null;}}
 function release(ent){const state=actors.get(ent);if(!state)return;state.request=null;clearVisual(state);actors.delete(ent);ent.worldHorseLOD=null;}
 function createFar(state,entry){clearVisual(state);withHorseVisualRandom('actor|'+state.breed+'|'+(++visualEpoch),()=>{
  const group=new THREE.Group();group.name='Approved native far horse';group.userData.nativeWorldHorseLOD=true;const materials=[];let skin=null;
  for(const row of entry.template.rows){const material=Array.isArray(row.material)?row.material.map(cloneMaterial):cloneMaterial(row.material);materials.push(...(Array.isArray(material)?material:[material]));const mesh=new THREE.Mesh(row.geometry,material);mesh.name='Native far '+row.name;mesh.userData={...row.userData};mesh.matrixAutoUpdate=false;mesh.matrix.copy(row.matrix);mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=true;mesh.customDepthMaterial=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking});mesh.customDistanceMaterial=new THREE.MeshDistanceMaterial();materials.push(mesh.customDepthMaterial,mesh.customDistanceMaterial);group.add(mesh);if(row.geometry.attributes.position.count===entry.template.profile.bodyVertexCount)skin=mesh;}
  const profile={...entry.template.profile,nativeRoster:true};const appearance={scene:group,skin,baseMat:skin.material,profile,materials};const flags=getDefinition?.(state.breed)?.[7]||{};
  const bounds=skin.geometry.boundingBox;skin.geometry.boundingBox=entry.template.rows.find(row=>row.geometry===skin.geometry).sourceBounds;
  try{configureNativeCustomization({THREE,rig:appearance,horse:{breed:state.breed,colors:state.colors,mark:state.opts.mark??flags.mark,markCol:state.opts.markCol||flags.markCol,id:state.opts.seed||state.ent.name||1},defaults:null});}finally{skin.geometry.boundingBox=bounds;}
  state.parts.group.traverse(o=>{if(o.isMesh)o.visible=false;});if(state.ent.rig)undress(state.ent);state.parts.group.scale.setScalar(1);state.parts.group.add(group);state.group=group;state.materials=materials;state.appearance=appearance;state.entry=entry;entry.refs++;state.mode='far';state.ent.worldHorseLOD=state;pose(state,0,state.lastSpeed||0,state.lastGraze||0);
 });}
 function pose(state,dt,speed,graze){if(!state.group)return;const template=state.entry.template;state.clock=(state.clock||0)+dt;state.phase=((state.phase||0)+dt*Math.min(1.35,Math.max(.35,Math.abs(speed)/Math.max(.01,template.nominalSpeedMps)))/template.duration)%1;
  const walk=Math.min(1,Math.abs(speed)/.22),targetGraze=graze>0&&walk<.05?poseEnvelope((state.clock/7.2)%1):0;state.walkMix+=(walk-state.walkMix)*(1-Math.exp(-dt*9));state.grazeMix+=(targetGraze-state.grazeMix)*(1-Math.exp(-dt*4));const w=state.phase*4,lo=Math.floor(w)%4,hi=(lo+1)%4,f=w-Math.floor(w);
  state.group.traverse(mesh=>{if(!mesh.isMesh)return;const weights=mesh.morphTargetInfluences;weights.fill(0);weights[lo]=(1-f)*state.walkMix;weights[hi]+=f*state.walkMix;weights[4]=(1-state.walkMix)*(1-state.grazeMix);weights[5]=(1-state.walkMix)*state.grazeMix;});
 }
 function constructFull(ent,parts,colors,opts){return withHorseVisualRandom('full|'+(opts.breed||'bay')+'|'+(++visualEpoch),()=>{const result=fullDress(ent,parts,colors,opts),rig=ent.rig;if(rig&&!rig.worldLODResourcesReady){const skeletons=new Set();rig.materials=rig.materials||[];rig.scene.traverse(mesh=>{if(mesh.isSkinnedMesh&&mesh.skeleton)skeletons.add(mesh.skeleton);if(!mesh.isMesh)return;if(mesh.customDepthMaterial===undefined){mesh.customDepthMaterial=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking});rig.materials.push(mesh.customDepthMaterial);}if(mesh.customDistanceMaterial===undefined){mesh.customDistanceMaterial=new THREE.MeshDistanceMaterial();rig.materials.push(mesh.customDistanceMaterial);}});for(const skeleton of skeletons)if(!skeleton.boneTexture)skeleton.computeBoneTexture();rig.worldLODResourcesReady=true;}return result;});}
 function resumeFull(ent,parts,colors,opts){const state=actors.get(ent);if(!state||state.parts!==parts)return false;if(state.wantsFull&&worldHorseCanDress(ent,parts))constructFull(ent,parts,colors,opts);return true;}
 function loadFull(breed){return models.load(breed,fn=>withHorseVisualRandom('load-full|'+breed+'|'+(++visualEpoch),fn));}
 function fullReady(ent){const state=actors.get(ent);if(!state||!state.wantsFull||!ent.rig||!state.group)return;const motion=ent.rig.nativeMotion;if(motion&&state.lastSpeed>.2){motion.set('walk',{speedMps:state.lastSpeed});motion.update(state.entry.template.duration*(1+state.phase),{rate:1});}else if(motion&&state.lastGraze>0){motion.startAction('graze',{elapsedS:Math.max(0,(state.clock%7.2)-.22)});motion.update(.22);}
  const phase=state.phase,clock=state.clock;release(ent);state.mode='full';state.phase=phase;state.clock=clock;actors.set(ent,state);ent.worldHorseLOD=state;
 }
 function update(ent,parts,colors,opts,speed,dt,t,graze){
  if(!worldHorseCanDress(ent,parts)){release(ent);return;}
  let state=actors.get(ent);if(state&&state.parts!==parts){release(ent);state=null;}if(!state){state={ent,parts,colors,opts,breed:opts.breed||parts.group.userData.breed||'bay',mode:ent.rig?'full':'waiting',phase:(Number(ent.phase)||0)/TAU%1,clock:0,walkMix:Math.abs(speed)>.2?1:0,grazeMix:0,entry:null,group:null,materials:[],request:null};actors.set(ent,state);ent.worldHorseLOD=state;}state.colors=colors;state.opts=opts;state.lastSpeed=speed;state.lastGraze=graze;
  const position=ent.pos||parts.group.position,distance=Math.hypot(position.x-player.pos.x,position.z-player.pos.z),cameraDistance=Math.hypot(position.x-camera.position.x,position.z-camera.position.z),projectedHeight=2.1/(Math.max(1,cameraDistance)*Math.tan(camera.fov*Math.PI/360))*renderer.domElement.height/2;
  const wantsFull=worldHorseWantsFull(state.mode,{distance,projectedHeight,interacting:!!opts.interacting});state.wantsFull=wantsFull;
  if(wantsFull){constructFull(ent,parts,colors,opts);if(ent.rig){fullReady(ent);state.mode='full';fullTick(ent,speed,dt,t,graze);return;}}
  const own=models.get(state.breed),fallback=getFallback?.(),asset=safeTemplateAsset(own)?own:safeTemplateAsset(fallback)?fallback:null;if(asset){
   let entry=request(asset)||state.entry;if(!entry&&cache.size)entry=cache.values().next().value;if(entry&&(!state.group||state.entry!==entry)&&!wantsFull)createFar(state,entry);
   if(!models.get(state.breed)&&models.loadVisual&&!state.request&&performance.now()>(state.retryAt||0)&&cache.size+pending.size+modelPending.size<maxEntries){const token={parts};state.request=token;const load=models.loadVisual(state.breed,fn=>withHorseVisualRandom('load|'+state.breed,fn));modelPending.set(state.breed,load);load.then(()=>{if(actors.get(ent)===state&&state.request===token){state.request=null;state.retryAt=performance.now()+6000;}},()=>{if(actors.get(ent)===state&&state.request===token){state.request=null;state.retryAt=performance.now()+6000;}}).finally(()=>modelPending.delete(state.breed));}
  }
  if(state.group){pose(state,dt,speed,graze);return;}
  if(ent.rig)fullTick(ent,speed,dt,t,graze);
 }
 function stats(){return{version:WORLD_HORSE_LOD_VERSION,budgetBytes,maxEntries,cacheBytes:currentBytes(),reservedBytes,bakeCount,evictions,rejected,lastBuildMs,pending:pending.size,modelPending:modelPending.size,actors:actors.size,farActors:Array.from(actors.values()).filter(s=>s.mode==='far').length,fullActors:Array.from(actors.values()).filter(s=>s.mode==='full').length,entries:Array.from(cache.values()).map(e=>({key:e.key,profile:e.template.profile.id,refs:e.refs,vertices:e.template.vertices,triangles:e.template.triangles,targets:e.template.targets,baseBytes:e.template.baseBytes,morphBytes:e.template.morphBytes,packedCPUBytes:e.template.packedBytes,packedGPUBytes:e.template.packedBytes,residentBytes:e.template.residentBytes}))};}
 return api;
}

/* Real GLTFLoader + packed draft shapes. No browser, network or saved game. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {register} from 'node:module';
import {createHash} from 'node:crypto';
const root=process.cwd(),threeURL=pathToFileURL(path.join(root,'assets/vendor/three/build/three.module.js')).href;
register('data:text/javascript,'+encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return {url:${JSON.stringify(threeURL)},shortCircuit:true};return n(s,c);}`));
const THREE=await import(threeURL),{GLTFLoader}=await import('../assets/vendor/three/examples/jsm/loaders/GLTFLoader.js'),{clone}=await import('../assets/vendor/three/examples/jsm/utils/SkeletonUtils.js');
const {createBreedLibrary}=await import('../assets/breed-models.js'),{validateNativeGroomRig,createNativeGroomLayer}=await import('../assets/native-groom-layer.mjs'),{configureNativeCustomization}=await import('../assets/native-horse-customization.js'),{syncNativeHorseFantasy}=await import('../assets/native-horse-fantasy.js');
const {createNativeHorseActionClips}=await import('../assets/native-horse-actions.mjs');
const {NEW_BREEDS}=await import('../assets/features/horse-roster.js');
const hash=x=>createHash('sha256').update(x).digest('hex');
const source='review/native-trot-reference-kit/white/model.glb',sourceHash=hash(fs.readFileSync(source));
let checks=0;const check=(ok,label)=>{assert(ok,label);checks++;};
class FileLoader extends GLTFLoader{
 constructor(manager){super(manager);this.register(()=>({name:'CPU_TEXTURE_PIXELS',loadTexture(index){const t=new THREE.Texture();t.name='original texture '+index;return Promise.resolve(t);}}));}
 async loadAsync(url){const u=new URL(url);assert.equal(u.protocol,'file:');const b=fs.readFileSync(u);return this.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');}
}
const cpuTHREE={...THREE,TextureLoader:class{async loadAsync(url){assert.equal(new URL(url).protocol,'file:');return new THREE.Texture();}}},previousFetch=global.fetch;
global.fetch=async url=>{const u=new URL(url);assert.equal(u.protocol,'file:');const b=fs.readFileSync(u);return{ok:true,json:async()=>JSON.parse(b.toString()),arrayBuffer:async()=>b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength)};};
const library=createBreedLibrary({THREE:cpuTHREE,GLTFLoader:FileLoader,clone}),report=[];
const meshes=scene=>{const out=[];scene.traverse(o=>{if(o.isSkinnedMesh)out.push(o);});return out;};
const material=mesh=>Array.isArray(mesh.material)?mesh.material[0]:mesh.material;
const shader=()=>({uniforms:{},vertexShader:THREE.ShaderLib.physical.vertexShader,fragmentShader:THREE.ShaderLib.physical.fragmentShader});
const vector=new THREE.Vector3(),peerVector=new THREE.Vector3();
function world(mesh,i,out){mesh.getVertexPosition(i,out);return mesh.localToWorld(out);}
const fingerprint=rig=>hash(Buffer.concat(meshes(rig.scene).flatMap(m=>Object.values(m.geometry.attributes).map(a=>Buffer.from(a.array.buffer,a.array.byteOffset,a.array.byteLength)))));
const hero=fs.readFileSync('assets/game-hero-horse.js','utf8'),start=hero.indexOf('export function nativeGroomFacade('),end=hero.indexOf('// The approved groom',start);assert(start>=0&&end>start);
const facadeFactory=new Function('createNativeDraftFeathers',hero.slice(start,end).replace('export function','function')+';return nativeGroomFacade;')(()=>null);
try{
 await library.manifestReady;
 library.register(NEW_BREEDS.find(row=>row[0]==='rimewalker'));
 const rime=library.profile('rimewalker');assert.equal(rime.nativeVariant.id,'percheron');
 for(const key of ['percheron','shire','clyde']){
  const asset=await library.load(key),rig=library.instantiate(asset),peer=library.instantiate(asset),all=meshes(rig.scene),hair=all.find(m=>m.geometry.attributes.position.count===23514),lock=all.find(m=>m.userData.nativeEquestrianGroom),spec=rig.profile.nativeVariant.groom.equestrian;
  check(!!lock&&all.length===6,key+' original five skins plus one lock skin');check(lock.geometry.attributes.position.count===1892&&lock.geometry.index.count===11112,key+' bounded20closedlocks');
  check(spec.maneLocks===12&&spec.forelockLocks===3&&spec.tailLocks===5,key+' intended distinct sculpted locks');
  check(lock.skeleton.bones.every((b,i)=>b===hair.skeleton.bones[i]),key+' same677source bone objects');check(validateNativeGroomRig(rig).eligible,key+' actual loader enables original groom inertia');
  const attrs=lock.geometry.attributes,donors=attrs.nativeEquestrianSourceVertex,sourceAttrs=hair.geometry.attributes;
  for(let i=0;i<donors.count;i++)for(let c=0;c<4;c++){assert.equal(attrs.skinIndex.getComponent(i,c),sourceAttrs.skinIndex.getComponent(donors.getX(i),c));assert.equal(attrs.skinWeight.getComponent(i,c),sourceAttrs.skinWeight.getComponent(donors.getX(i),c));}
  checks++;const edges=new Map(),index=lock.geometry.index;let minimumArea=Infinity;
  rig.scene.updateMatrixWorld(true);
  for(let t=0;t<index.count;t+=3){const ids=[index.getX(t),index.getX(t+1),index.getX(t+2)],points=ids.map(i=>world(lock,i,new THREE.Vector3()));const area=points[1].clone().sub(points[0]).cross(points[2].clone().sub(points[0])).length()*.5;minimumArea=Math.min(minimumArea,area);for(let k=0;k<3;k++){const e=[ids[k],ids[(k+1)%3]].sort((a,b)=>a-b).join(',');edges.set(e,(edges.get(e)||0)+1);}}
  check([...edges.values()].every(n=>n===2),key+' every surface edge has two incident faces');check(minimumArea>1e-11,key+' no degenerate closed-lock triangles');
  for(const a of Object.values(attrs))check(a.array.every(Number.isFinite),key+' finite '+a.itemSize+'-componentattribute');
  const donor=donors.getX(0),weight=attrs.skinWeight.getX(0),bind=lock.bindMatrix.clone(),lockProfile=rig.profile;
  const reject=(label,mutate,restore)=>{try{mutate();check(!validateNativeGroomRig(rig).eligible,label);}finally{restore();}assert(validateNativeGroomRig(rig).eligible);};
  reject('corrupt donor rejected',()=>donors.setX(0,65535),()=>donors.setX(0,donor));reject('altered skin weights rejected',()=>attrs.skinWeight.setX(0,weight+.01),()=>attrs.skinWeight.setX(0,weight));reject('foreign profile rejected',()=>rig.profile={...rig.profile,nativeVariant:{...rig.profile.nativeVariant,id:'fjord'}},()=>rig.profile=lockProfile);reject('changed bind rejected',()=>lock.bindMatrix.elements[12]+=.1,()=>lock.bindMatrix.copy(bind));
  const facade=facadeFactory({THREE,scene:rig.scene,skin:rig.skin,profile:rig.profile});facade.mane.visible=false;check(!hair.visible&&!lock.visible&&all.filter(m=>m!==hair&&m!==lock).every(m=>m.visible),key+' Hair off removes both groom layers only');facade.tail.visible=true;check(hair.visible&&lock.visible,key+' Hair on restores both');
  const originalHairColor=material(hair).color.clone(),originalLockColor=material(lock).color.clone();
  rig.key='rimewalker';rig.profile={...rig.profile,nativeRosterAppearance:rime.nativeRosterAppearance};
  syncNativeHorseFantasy({THREE,rig,horse:{coat:'ice'}});check(material(hair).color.equals(new THREE.Color('#8fd0ec'))&&material(lock).color.equals(material(hair).color),'same-instance Rimewalker ice tints cards and locks together');
  syncNativeHorseFantasy({THREE,rig,horse:{coat:null}});check(material(lock).color.equals(material(hair).color),'ordinary theme-off preserves same breed mane on both layers');
  rig.key=key;rig.profile=lockProfile;syncNativeHorseFantasy({THREE,rig,horse:{coat:null}});check(material(hair).color.equals(originalHairColor)&&material(lock).color.equals(originalLockColor),'removing fantasy restores exact individual materials');
  const natural={id:key,breed:key,colors:{body:'#8a5a2b',mane:'#332214'},mark:'none',markCol:'#f2ece0'},row=[key,key,0,0,0,natural.colors.body,natural.colors.mane,{}];
  const dyes=configureNativeCustomization({THREE,rig,horse:{...natural,colors:{...natural.colors,mane:'#cc6688'},tailCol:'#6677cc'},defaults:row});check(dyes.hair.length===2,'saved dye recognizes original and added hair');
  for(const entry of dyes.hair){const m=entry.materials[0],s=shader();m.onBeforeCompile(s);check(s.uniforms.nrMane.value.equals(new THREE.Color('#cc6688'))&&s.uniforms.nrTail.value.equals(new THREE.Color('#6677cc')),'distinct chosen mane and tail colors survive');check(s.fragmentShader.includes('step(-.5,nrTailMask)'),'negative lash mask excludes saved dyes');}
  const lashes=hair.geometry.attributes.nativeEquestrianLash,tailMask=hair.geometry.attributes.nativeTailDye;check(lashes.array.filter(v=>v===1).length>100,'actual eyelash islands classified');for(let i=0;i<lashes.count;i++)if(lashes.getX(i))assert.equal(tailMask.getX(i),-1);checks++;
  const hairShader=shader();material(hair).onBeforeCompile(hairShader);check(hairShader.uniforms.eqLashColor.value.equals(new THREE.Color('#30231c')),'dark lash pigment remains unchanged under pink dye');
  dyes.dispose();
  const before=fingerprint(rig),peerBefore=fingerprint(peer),layer=createNativeGroomLayer({THREE,rig}),mixer=new THREE.AnimationMixer(rig.nativeRoot),peerMixer=new THREE.AnimationMixer(peer.nativeRoot),peerAll=meshes(peer.scene),peerLock=peerAll.find(m=>m.userData.nativeEquestrianGroom);check(!!layer,key+' real58control inertia layer');
  const restDistances=Array.from(donors.array,(d,i)=>world(lock,i,new THREE.Vector3()).distanceTo(world(hair,d,new THREE.Vector3())));
  let maxInertia=0,maxStretch=0,minHairY=Infinity,maxProtected=0,time=0;
  const host=new THREE.Group(),peerHost=new THREE.Group();host.add(rig.scene);peerHost.add(peer.scene);
  for(const gait of ['walk','trot','canterLeft','canterRight','gallopLeft','gallopRight']){
   const clip=THREE.AnimationClip.findByName(asset.animations,rig.profile.nativeGaits[gait].clip),a=mixer.clipAction(clip),pa=peerMixer.clipAction(clip);a.play();pa.play();
   for(let frame=0;frame<32;frame++){const dt=clip.duration/32;time+=dt;layer.beforePose();mixer.update(dt);peerMixer.update(dt);for(const h of [host,peerHost]){h.position.z=time*.9;h.rotation.y=.08*Math.sin(time*2);h.updateMatrixWorld(true);}layer.afterPose(dt);host.updateMatrixWorld(true);
    if(frame%4)continue;
    for(let i=0;i<donors.count;i++){world(lock,i,vector);world(peerLock,i,peerVector);assert(vector.toArray().every(Number.isFinite));maxInertia=Math.max(maxInertia,vector.distanceTo(peerVector));minHairY=Math.min(minHairY,vector.y);const distance=vector.distanceTo(world(hair,donors.getX(i),peerVector));maxStretch=Math.max(maxStretch,distance/Math.max(.002,restDistances[i]));assert(distance<.55,'donor-bound lock remains attached');}
    for(let m=0;m<all.length;m++){if(all[m]===hair||all[m]===lock)continue;for(let i=0;i<all[m].geometry.attributes.position.count;i+=67)maxProtected=Math.max(maxProtected,world(all[m],i,vector).distanceTo(world(peerAll[m],i,peerVector)));}
   }layer.beforePose();a.stop();pa.stop();rig.nativeRoot.updateMatrixWorld(true);peer.nativeRoot.updateMatrixWorld(true);layer.reset();
  }
  const actionBundle=createNativeHorseActionClips({THREE,root:rig.nativeRoot,profile:rig.profile}),actions=[];
  for(const id of ['toss','graze','liedown']){
   const spec=actionBundle.actions[id],clip=THREE.AnimationClip.findByName(actionBundle.clips,spec.clip),a=mixer.clipAction(clip),pa=peerMixer.clipAction(clip),frames=Math.ceil(clip.duration*60),metrics={id,sampledPoses:0,maxDonorDistanceM:0,maxDonorStretch:0,maxInertiaM:0,minHairY:Infinity};
   for(const action of [a,pa]){action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.reset().play();}
   for(let frame=0;frame<=frames;frame++){
    const dt=frame===0?0:clip.duration/frames;layer.beforePose();mixer.update(dt);peerMixer.update(dt);host.updateMatrixWorld(true);peerHost.updateMatrixWorld(true);layer.afterPose(dt);host.updateMatrixWorld(true);
    if(frame%12&&frame!==frames)continue;metrics.sampledPoses++;
    for(let i=0;i<donors.count;i++){
     world(lock,i,vector);world(peerLock,i,peerVector);assert(vector.toArray().every(Number.isFinite),key+' '+id+' finite closed-lock vertex');
     metrics.maxInertiaM=Math.max(metrics.maxInertiaM,vector.distanceTo(peerVector));metrics.minHairY=Math.min(metrics.minHairY,vector.y);
     const distance=vector.distanceTo(world(hair,donors.getX(i),peerVector));metrics.maxDonorDistanceM=Math.max(metrics.maxDonorDistanceM,distance);metrics.maxDonorStretch=Math.max(metrics.maxDonorStretch,distance/Math.max(.002,restDistances[i]));
    }
    for(let m=0;m<all.length;m++){if(all[m]===hair||all[m]===lock)continue;for(let i=0;i<all[m].geometry.attributes.position.count;i+=67)maxProtected=Math.max(maxProtected,world(all[m],i,vector).distanceTo(world(peerAll[m],i,peerVector)));}
   }
   layer.beforePose();a.stop();pa.stop();rig.nativeRoot.updateMatrixWorld(true);peer.nativeRoot.updateMatrixWorld(true);layer.reset();
   check(metrics.maxDonorDistanceM<.55&&metrics.maxDonorStretch<2,key+' '+id+' closed locks remain attached to animated donors');check(metrics.maxInertiaM<.14,key+' '+id+' bounded added hair motion');check(metrics.minHairY>-.004,key+' '+id+' new locks clear action ground');actions.push(metrics);
  }
  check(maxInertia>.00001&&maxInertia<.14,key+' locks inherit bounded actual hair inertia');check(maxStretch<2,key+' no exploding lock-to-donor span');check(minHairY>.02,key+' new locks clear gait ground');check(maxProtected<1e-9,key+' no body/eyes/tack motion added');
  layer.dispose();mixer.uncacheRoot(rig.nativeRoot);peerMixer.uncacheRoot(peer.nativeRoot);check(fingerprint(rig)===before&&fingerprint(peer)===peerBefore,'motion never mutates meshes or weights');
  report.push({key,shape:rig.profile.nativeVariant.sha256,minimumArea,maxInertiaM:maxInertia,maxDonorStretch:maxStretch,minHairY,maxProtectedDeltaM:maxProtected,actions});
 }
 check(hash(fs.readFileSync(source))===sourceHash,'source GLB unchanged');
 console.log(JSON.stringify({checks,report},null,2));console.log('Equestrian groom: actual loader, closed donor-bound surfaces, strict rejection, Hair visibility, fantasy restore, separate dyes/dark lashes and actual gait/action inertia passed.');
}finally{global.fetch=previousFetch;}

/* Approved artist-derived breed assets. Geometry/textures are cached; skeletons
 * and materials are private to each mounted horse. Native axes: +Z forward, +Y up. */
import {fillOutTail,fillOutMane} from './horse-hair-volume.js';
import {NATIVE_BREED_PROFILES,nativeBreedProfile} from './native-breed-profiles.js?v=native-hoof-flex-1';
export function createBreedLibrary({THREE, GLTFLoader, clone}) {
  const base=new URL('./models/artist-breeds/',import.meta.url),pending=new Map(),ready=new Map(),files=new Map();
  let manifest=null,revision='';
  const manager=new THREE.LoadingManager();
  manager.setURLModifier(url=>{if(!revision||!url.startsWith(base.href))return url;const u=new URL(url);u.searchParams.set('build',revision);return u.href;});
  const loader=new GLTFLoader(manager);
  const manifestReady=fetch(new URL('manifest.json',base),{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error(`Artist breed catalog HTTP ${r.status}`);return r.json();}).then(m=>{m={...m,breeds:{...m.breeds,...NATIVE_BREED_PROFILES}};let hash=2166136261;for(const c of JSON.stringify(m))hash=Math.imul(hash^c.charCodeAt(0),16777619);revision=(hash>>>0).toString(16);manifest=m;return m;});
  manifestReady.catch(()=>{});
  /* Feature packages add breed rows without touching the model manifest: alias(key, foundation) maps a new
   * roster key onto an authored body, consulted after the manifest's own aliases. */
  const extraAliases={};
  function alias(key,to){if(key&&to)extraAliases[key]=to;return extraAliases;}
  function resolve(key='bay') {if(nativeBreedProfile(key)||manifest?.breeds?.[key])return key;const seen=new Set();while((manifest?.aliases?.[key]||extraAliases[key])&&!seen.has(key)){seen.add(key);key=manifest?.aliases?.[key]||extraAliases[key];}return manifest?.breeds?.[key]?key:'bay';}
  function profile(key){return nativeBreedProfile(key)||manifest?.breeds?.[resolve(key)]||null;}
  function bodyIn(scene,spec){let body=null;scene.traverse(o=>{if(o.isSkinnedMesh&&(spec?.nativeBreed?o.geometry.attributes.position.count===spec.bodyVertexCount:o.name===spec?.bodyMesh||o.name==='HorseBody'||/^Artist_body/.test(o.name)))body=o;});return body;}
  function nativeBone(root,name){return root.getObjectByName(name)||root.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(name));}
  function prepareNative(gltf,key,spec){
    const nativeRoot=gltf.scene,skins=[];nativeRoot.traverse(o=>{if(o.isSkinnedMesh)skins.push(o);});
    if(!skins.length||skins.some(o=>o.skeleton.bones.length!==spec.jointCount))throw new Error(`Invalid native ${spec.jointCount}-joint rig: ${key}`);
    const skin=bodyIn(nativeRoot,spec);if(!skin)throw new Error(`Native body missing: ${key}`);
    const names=new Set((gltf.animations||[]).map(c=>c.name));for(const clip of [spec.nativeIdleClip,spec.nativeSitClip,...Object.values(spec.nativeGaits||{}).map(r=>r.clip)].filter(Boolean))if(!names.has(clip))throw new Error(`Native clip missing: ${clip}`);
    if(spec.nativeRemoveFloor){const floor=nativeRoot.getObjectByName(spec.nativeRemoveFloor);if(floor){if(floor.isSkinnedMesh)throw new Error('Native source floor unexpectedly skinned');floor.removeFromParent();}}
    if(spec.nativeDarkAppearance)for(const mesh of skins){const darken=m=>{if(!['Game_dragon','Game_dragon.001'].includes(m.name))return m;const tint=m.clone();tint.color.multiplyScalar(.16);tint.opacity=1;tint.transparent=false;tint.depthWrite=true;tint.metalness=Math.min(tint.metalness,.12);tint.roughness=Math.max(tint.roughness,.62);if('transmission'in tint)tint.transmission=0;if('clearcoat'in tint)tint.clearcoat=Math.min(tint.clearcoat,.15);if('specularIntensity'in tint)tint.specularIntensity=Math.min(tint.specularIntensity,.35);return tint;};mesh.material=Array.isArray(mesh.material)?mesh.material.map(darken):darken(mesh.material);}
    nativeRoot.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;}});
    const scene=new THREE.Group(),normalization=new THREE.Group();scene.name='Native actor '+key;scene.userData.nativeBreed=true;normalization.name='Native normalization';normalization.position.fromArray(spec.nativeTranslation);normalization.scale.setScalar(spec.nativeScale);normalization.add(nativeRoot);scene.add(normalization);scene.updateMatrixWorld(true);
    const authored={...JSON.parse(JSON.stringify(spec)),heightM:0,anchors:{}};const bbox=new THREE.Box3().setFromObject(scene);authored.heightM=bbox.max.y-bbox.min.y;
    const seat=new THREE.Vector3().fromArray(spec.nativeSourceSeat);nativeRoot.localToWorld(seat);authored.anchors.saddle=[seat.toArray()];const head=nativeBone(nativeRoot,spec.nativeHeadBone);if(head)authored.anchors.head=[head.getWorldPosition(new THREE.Vector3()).toArray()];
    const asset={key,scene,nativeRoot,skin,profile:authored,fitScale:1,fitY:0,baseMat:skin.material,animations:gltf.animations||[]};ready.set(key,asset);return asset;
  }
  function prepare(gltf,key,spec){
    const scene=gltf.scene,skin=bodyIn(scene,spec);
    if(!skin||!skin.skeleton.bones.some(b=>b.name==='head')||!skin.skeleton.bones.some(b=>b.name.replace('.','')==='FLhoof'))throw new Error(`Invalid authored breed rig: ${key}`);
    scene.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;}});
    scene.updateMatrixWorld(true);skin.geometry.computeBoundingBox();
    const bbox=new THREE.Box3().setFromObject(scene),withersM=Number(spec.withersM)||1.55;
    const fitScale=Number.isFinite(spec.fitScale)?spec.fitScale:1.45/withersM,fitY=Number.isFinite(spec.fitY)?spec.fitY:-bbox.min.y*fitScale;
    const authored={...spec,id:key,artistBreed:true,hero:false,withersM,heightM:spec.heightM||bbox.max.y-bbox.min.y,anchors:JSON.parse(JSON.stringify(spec.anchors||{}))};
    const saddle=authored.anchors.saddle?.[0];
    if(saddle){let surface=-Infinity;const p=skin.geometry.attributes.position;for(let i=0;i<p.count;i++)if(Math.abs(p.getX(i)-saddle[0])<.055&&Math.abs(p.getZ(i)-saddle[2])<.075)surface=Math.max(surface,p.getY(i));if(Number.isFinite(surface))authored.anchors.saddle=[[saddle[0],surface+.008,saddle[2]]];}
    /* Fuller tails and manes (horse-hair-volume.js): the authored strands reshaped. Here,
     * after the fit has been measured and once per file, so every horse cloned from this model
     * shares the one spread geometry and the fit is exactly what it was. */
    scene.traverse(o=>{if(o.isSkinnedMesh&&o!==skin&&(o.name===spec.hairMesh||o.parent?.name===spec.hairMesh||/strand|groom/i.test(o.name))){fillOutTail(THREE,o);fillOutMane(THREE,o,skin);}});
    const asset={key,scene,skin,profile:authored,fitScale,fitY,baseMat:skin.material,animations:gltf.animations||[]};ready.set(key,asset);return asset;
  }
  async function load(requested='bay'){
    await manifestReady;const key=resolve(requested);if(ready.has(key))return ready.get(key);
    if(!pending.has(key)){const spec=manifest.breeds[key];if(!spec)throw new Error(`Missing authored breed: ${requested}`);const url=new URL(spec.file,spec.nativeBreed?import.meta.url:base);url.searchParams.set('build',spec.sha256||revision);if(!files.has(url.href))files.set(url.href,loader.loadAsync(url.href).catch(e=>{files.delete(url.href);throw e;}));pending.set(key,files.get(url.href).then(g=>spec.nativeBreed?prepareNative(g,key,spec):prepare(g,key,spec)).catch(e=>{pending.delete(key);throw e;}));}
    return pending.get(key);
  }
  function instantiate(asset){
    const scene=clone(asset.scene),materials=[],copies=new Map();
    const copy=m=>{if(!copies.has(m)){const next=m.clone();copies.set(m,next);materials.push(next);}return copies.get(m);};
    scene.traverse(o=>{if(o.isMesh)o.material=Array.isArray(o.material)?o.material.map(copy):copy(o.material);});
    const skin=bodyIn(scene,asset.profile);scene.scale.setScalar(asset.fitScale);scene.position.set(0,asset.fitY,0);scene.rotation.set(0,0,0);
    const boneMap=Object.fromEntries(skin.skeleton.bones.map(b=>[b.name.replace(/[.\s]/g,''),b]));
    const inst={...asset,scene,skin,bones:skin.skeleton.bones,boneMap,materials,baseMat:skin.material};
    if(asset.profile.nativeBreed){
      inst.nativeRoot=scene.children[0].children[0];scene.updateMatrixWorld(true);
      const seatBone=nativeBone(inst.nativeRoot,asset.profile.nativeSeatBone);if(!seatBone)throw new Error('Native seat bone missing: '+asset.key);
      const seat=new THREE.Vector3().fromArray(asset.profile.nativeSourceSeat);inst.nativeRoot.localToWorld(seat);inst.nativeSeatFollower=new THREE.Object3D();inst.nativeSeatFollower.name='Native seat contact';inst.nativeSeatFollower.position.copy(seatBone.worldToLocal(seat));seatBone.add(inst.nativeSeatFollower);
      let tack=null;scene.traverse(o=>{if(o.isSkinnedMesh&&o.geometry.attributes.position.count===asset.profile.tackVertexCount)tack=o;});
      inst.nativeContacts={tack,seatFollower:inst.nativeSeatFollower,sourceSeat:[...asset.profile.nativeSourceSeat],sourceToGameTranslation:[...asset.profile.nativeTranslation],nativeScale:asset.profile.nativeScale,tackVertexCount:asset.profile.tackVertexCount||0,treadRanges:{left:[2792,2845],right:[2716,2769]},bitRanges:{left:[7894,8124],right:[6954,7184]}};
    }
    return inst;
  }
  function mountPoint(asset,point){if(!Array.isArray(point))return null;if(Array.isArray(point[0]))point=point[0];if(point.length!==3||!point.every(Number.isFinite))return null;return new THREE.Vector3(point[0]*asset.fitScale,point[1]*asset.fitScale+asset.fitY,point[2]*asset.fitScale);}
  return {load,resolve,profile,instantiate,mountPoint,alias,nativeProfiles:NATIVE_BREED_PROFILES,get:key=>ready.get(resolve(key)),get manifest(){return manifest;},manifestReady};
}

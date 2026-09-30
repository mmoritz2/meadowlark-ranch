/* Approved artist-derived breed assets. Geometry/textures are cached; skeletons
 * and materials are private to each mounted horse. Native axes: +Z forward, +Y up. */
import {fillOutTail,fillOutMane} from './horse-hair-volume.js';
import {applyFeatherWingMaterial} from './feather-wing-material.js';
import {loadProtectedHorseResource} from './protected-horse-resource.js';
export function createBreedLibrary({THREE, GLTFLoader, clone,manifestURL=new URL('./models/horse-imports/prepared-manifest.json',import.meta.url)}) {
  manifestURL=new URL(manifestURL,import.meta.url);
  const base=new URL('./',manifestURL),pending=new Map(),ready=new Map(),files=new Map(),componentProfiles=new Map();
  let manifest=null,revision='';
  const manager=new THREE.LoadingManager();
  manager.setURLModifier(url=>{if(!revision||!url.startsWith(base.href))return url;const u=new URL(url);u.searchParams.set('build',revision);return u.href;});
  const loader=new GLTFLoader(manager);
  function loadFile(url,spec){
    const key=url.href;if(!files.has(key)){
      const protection=spec.protectedResource;
      const task=protection?loadProtectedHorseResource({loader,url:key,keyBase64:protection.keyBase64,expectedSha256:spec.sha256}):loader.loadAsync(key);
      files.set(key,task.catch(e=>{files.delete(key);throw e;}));
    }
    return files.get(key);
  }
  const manifestReady=fetch(manifestURL,{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error(`Artist breed catalog HTTP ${r.status}`);return r.json();}).then(m=>{let hash=2166136261;for(const c of JSON.stringify(m))hash=Math.imul(hash^c.charCodeAt(0),16777619);revision=(hash>>>0).toString(16);manifest=m;return m;});
  manifestReady.catch(()=>{});
  /* Feature packages add breed rows without touching the model manifest: alias(key, foundation) maps a new
   * roster key onto an authored body, consulted after the manifest's own aliases. */
  const extraAliases={};
  function alias(key,to){if(key&&to)extraAliases[key]=to;return extraAliases;}
  function resolve(key='bay') {if(manifest?.breeds?.[key])return key;const seen=new Set();while((manifest?.aliases?.[key]||extraAliases[key])&&!seen.has(key)){seen.add(key);key=manifest?.aliases?.[key]||extraAliases[key];}if(manifest?.requireExplicitMapping&&!manifest?.breeds?.[key])throw new Error('Unmapped imported breed: '+key);return manifest?.breeds?.[key]?key:'bay';}
  function profile(key){return manifest?.breeds?.[resolve(key)]||null;}
  function bodyIn(scene,spec){let body=null;scene.traverse(o=>{if(o.isSkinnedMesh&&(o.name===spec?.bodyMesh||o.name==='HorseBody'||/^Artist_body/.test(o.name)))body=o;});return body;}
  async function prepare(gltf,key,spec){
    const scene=gltf.scene,skin=bodyIn(scene,spec);
    if(!skin||!skin.skeleton.bones.some(b=>b.name==='head')||!skin.skeleton.bones.some(b=>b.name.replace('.','')==='FLhoof'))throw new Error(`Invalid authored breed rig: ${key}`);
    scene.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;}});
    scene.updateMatrixWorld(true);skin.geometry.computeBoundingBox();
    const bbox=new THREE.Box3().setFromObject(scene),withersM=Number(spec.withersM)||1.55;
    const fitScale=Number.isFinite(spec.fitScale)?spec.fitScale:1.45/withersM,fitY=Number.isFinite(spec.fitY)?spec.fitY:-bbox.min.y*fitScale;
    const authored={...spec,id:key,artistBreed:true,hero:false,withersM,heightM:spec.heightM||bbox.max.y-bbox.min.y,anchors:JSON.parse(JSON.stringify(spec.anchors||{}))};
    let neutralCoatMap=null;
    if(spec.protectedResource&&spec.neutralCoatFile)throw new Error('Protected horse cannot use an external neutral coat: '+key);
    if(spec.protectedResource?.neutralCoatTexture!==undefined){
      const index=spec.protectedResource.neutralCoatTexture;
      if(!Number.isSafeInteger(index)||index<0)throw new Error('Invalid embedded neutral coat: '+key);
      neutralCoatMap=await gltf.parser.getDependency('texture',index);neutralCoatMap.colorSpace=THREE.SRGBColorSpace;neutralCoatMap.flipY=false;
    }else if(spec.neutralCoatFile)authored.neutralCoatURL=new URL(spec.neutralCoatFile,new URL(spec.file,base)).href;
    const saddle=authored.anchors.saddle?.[0];
    if(saddle&&!spec.preserveSaddleAnchor){let surface=-Infinity;const p=skin.geometry.attributes.position;for(let i=0;i<p.count;i++)if(Math.abs(p.getX(i)-saddle[0])<.055&&Math.abs(p.getZ(i)-saddle[2])<.075)surface=Math.max(surface,p.getY(i));if(Number.isFinite(surface))authored.anchors.saddle=[[saddle[0],surface+.008,saddle[2]]];}
    /* Fuller tails and manes (horse-hair-volume.js): the authored strands reshaped. Here,
     * after the fit has been measured and once per file, so every horse cloned from this model
     * shares the one spread geometry and the fit is exactly what it was. */
    if(!spec.preserveSourceGroom&&!spec.preserveAuthoredHair)scene.traverse(o=>{if(o.isSkinnedMesh&&o!==skin&&(o.name===spec.hairMesh||o.parent?.name===spec.hairMesh||/strand|groom/i.test(o.name))){fillOutTail(THREE,o);fillOutMane(THREE,o,skin);}});
    const components=[];
    if(spec.wingComponent){
      const c=spec.wingComponent,url=new URL(c.file,base),profileURL=new URL(c.profileFile,base);
      url.searchParams.set('build',c.sha256||revision);
      if(!files.has(url.href))files.set(url.href,loader.loadAsync(url.href).catch(e=>{files.delete(url.href);throw e;}));
      if(!componentProfiles.has(profileURL.href))componentProfiles.set(profileURL.href,fetch(profileURL,{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error(`Wing profile HTTP ${r.status}`);return r.json();}).catch(e=>{componentProfiles.delete(profileURL.href);throw e;}));
      const [w,p]=await Promise.all([files.get(url.href),componentProfiles.get(profileURL.href)]);
      components.push({kind:'featherWings',scene:w.scene,profile:p});
    }
    const asset={key,scene,skin,profile:authored,fitScale,fitY,baseMat:skin.material,neutralCoatMap,animations:gltf.animations||[],components};ready.set(key,asset);return asset;
  }
  async function load(requested='bay'){
    await manifestReady;const key=resolve(requested);if(ready.has(key))return ready.get(key);
    if(!pending.has(key)){const spec=manifest.breeds[key];if(!spec)throw new Error(`Missing authored breed: ${requested}`);if(spec.available===false||!spec.file)throw new Error(`Approved source download pending: ${requested}`);const url=new URL(spec.file,base);url.searchParams.set('build',spec.sha256||revision);pending.set(key,loadFile(url,spec).then(g=>prepare(g,key,spec)).catch(e=>{pending.delete(key);throw e;}));}
    return pending.get(key);
  }
  function instantiate(asset){
    const scene=clone(asset.scene),materials=[],copies=new Map();
    const copy=m=>{if(!copies.has(m)){const next=m.clone();copies.set(m,next);materials.push(next);}return copies.get(m);};
    scene.traverse(o=>{if(o.isMesh)o.material=Array.isArray(o.material)?o.material.map(copy):copy(o.material);});
    const skin=bodyIn(scene,asset.profile);scene.scale.setScalar(asset.fitScale);scene.position.set(0,asset.fitY,0);scene.rotation.set(0,0,0);
    const boneMap=Object.fromEntries(skin.skeleton.bones.map(b=>[b.name.replace(/[.\s]/g,''),b]));
    const components=(asset.components||[]).map(component=>{
      const wing=clone(component.scene),frame=new THREE.Group();frame.name='SourceFeatherWingMount';frame.matrixAutoUpdate=false;
      wing.traverse(o=>{if(o.isMesh){o.material=Array.isArray(o.material)?o.material.map(copy):copy(o.material);o.userData.nativeFeatherWing=true;o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;}});
      const appearance=applyFeatherWingMaterial({THREE,root:wing,profile:component.profile});materials.push(...appearance.materials);
      wing.scale.setScalar(asset.profile.withersM/component.profile.referenceWithersM);frame.add(wing);scene.add(frame);
      const chest=boneMap.chest,chestIndex=skin.skeleton.bones.indexOf(chest),anchor=asset.profile.anchors.withers?.[0];
      if(!chest||!anchor)throw new Error('Feather host lacks chest/withers anchors: '+asset.key);
      const rootInverse=new THREE.Matrix4(),bindDelta=new THREE.Matrix4(),translation=new THREE.Matrix4().makeTranslation(...anchor);
      function follow(){scene.updateWorldMatrix(true,true);rootInverse.copy(scene.matrixWorld).invert();bindDelta.multiplyMatrices(rootInverse,chest.matrixWorld).multiply(skin.skeleton.boneInverses[chestIndex]).multiply(skin.bindMatrix);frame.matrix.copy(bindDelta).multiply(translation);frame.matrixWorldNeedsUpdate=true;frame.updateWorldMatrix(true,true);}
      follow();return {...component,scene:wing,frame,follow,appearance};
    });
    return {...asset,scene,skin,bones:skin.skeleton.bones,boneMap,materials,components,baseMat:skin.material};
  }
  function mountPoint(asset,point){if(!Array.isArray(point))return null;if(Array.isArray(point[0]))point=point[0];if(point.length!==3||!point.every(Number.isFinite))return null;return new THREE.Vector3(point[0]*asset.fitScale,point[1]*asset.fitScale+asset.fitY,point[2]*asset.fitScale);}
  return {load,resolve,profile,instantiate,mountPoint,alias,get:key=>ready.get(resolve(key)),get manifest(){return manifest;},manifestReady};
}

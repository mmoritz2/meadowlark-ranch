/* Approved artist-derived breed assets. Geometry/textures are cached; skeletons
 * and materials are private to each mounted horse. Native axes: +Z forward, +Y up. */
export function createBreedLibrary({THREE, GLTFLoader, clone}) {
  const base=new URL('./models/artist-breeds/',import.meta.url),pending=new Map(),ready=new Map(),files=new Map();
  let manifest=null,revision='';
  const manager=new THREE.LoadingManager();
  manager.setURLModifier(url=>{if(!revision||!url.startsWith(base.href))return url;const u=new URL(url);u.searchParams.set('build',revision);return u.href;});
  const loader=new GLTFLoader(manager);
  const manifestReady=fetch(new URL('manifest.json',base),{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error(`Artist breed catalog HTTP ${r.status}`);return r.json();}).then(m=>{let hash=2166136261;for(const c of JSON.stringify(m))hash=Math.imul(hash^c.charCodeAt(0),16777619);revision=(hash>>>0).toString(16);manifest=m;return m;});
  manifestReady.catch(()=>{});
  /* Feature packages add breed rows without touching the model manifest: alias(key, foundation) maps a new
   * roster key onto an authored body, consulted after the manifest's own aliases. */
  const extraAliases={};
  function alias(key,to){if(key&&to)extraAliases[key]=to;return extraAliases;}
  function resolve(key='bay') {if(manifest?.breeds?.[key])return key;const seen=new Set();while((manifest?.aliases?.[key]||extraAliases[key])&&!seen.has(key)){seen.add(key);key=manifest?.aliases?.[key]||extraAliases[key];}return manifest?.breeds?.[key]?key:'bay';}
  function profile(key){return manifest?.breeds?.[resolve(key)]||null;}
  function bodyIn(scene,spec){let body=null;scene.traverse(o=>{if(o.isSkinnedMesh&&(o.name===spec?.bodyMesh||o.name==='HorseBody'||/^Artist_body/.test(o.name)))body=o;});return body;}
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
    const asset={key,scene,skin,profile:authored,fitScale,fitY,baseMat:skin.material,animations:gltf.animations||[]};ready.set(key,asset);return asset;
  }
  async function load(requested='bay'){
    await manifestReady;const key=resolve(requested);if(ready.has(key))return ready.get(key);
    if(!pending.has(key)){const spec=manifest.breeds[key];if(!spec)throw new Error(`Missing authored breed: ${requested}`);const url=new URL(spec.file,base);url.searchParams.set('build',spec.sha256||revision);if(!files.has(url.href))files.set(url.href,loader.loadAsync(url.href).catch(e=>{files.delete(url.href);throw e;}));pending.set(key,files.get(url.href).then(g=>prepare(g,key,spec)).catch(e=>{pending.delete(key);throw e;}));}
    return pending.get(key);
  }
  function instantiate(asset){
    const scene=clone(asset.scene),materials=[],copies=new Map();
    const copy=m=>{if(!copies.has(m)){const next=m.clone();copies.set(m,next);materials.push(next);}return copies.get(m);};
    scene.traverse(o=>{if(o.isMesh)o.material=Array.isArray(o.material)?o.material.map(copy):copy(o.material);});
    const skin=bodyIn(scene,asset.profile);scene.scale.setScalar(asset.fitScale);scene.position.set(0,asset.fitY,0);scene.rotation.set(0,0,0);
    const boneMap=Object.fromEntries(skin.skeleton.bones.map(b=>[b.name.replace(/[.\s]/g,''),b]));
    return {...asset,scene,skin,bones:skin.skeleton.bones,boneMap,materials,baseMat:skin.material};
  }
  function mountPoint(asset,point){if(!Array.isArray(point))return null;if(Array.isArray(point[0]))point=point[0];if(point.length!==3||!point.every(Number.isFinite))return null;return new THREE.Vector3(point[0]*asset.fitScale,point[1]*asset.fitScale+asset.fitY,point[2]*asset.fitScale);}
  return {load,resolve,profile,instantiate,mountPoint,alias,get:key=>ready.get(resolve(key)),get manifest(){return manifest;},manifestReady};
}

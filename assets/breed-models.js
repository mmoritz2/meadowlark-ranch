/* Immutable rest-pose assets. Each mounted horse receives its own skeleton and
 * materials; changing the player's breed can never change a nearby horse. */
export function createBreedLibrary({THREE, GLTFLoader, clone}) {
  const base = new URL('./models/breeds/', import.meta.url);
  const loader = new GLTFLoader();
  const pending = new Map(), ready = new Map();
  let manifest = null;
  const manifestReady = fetch(new URL('manifest.json', base)).then(r => {
    if (!r.ok) throw new Error(`Breed catalog HTTP ${r.status}`);
    return r.json();
  }).then(m => { manifest = m; return m; });
  // Startup reports the error through load(); avoid an unhandled background rejection.
  manifestReady.catch(() => {});
  function resolve(key = 'bay') {
    if (key === 'legacy') return key;
    if (/^(frostdrake|emberdrake|amethyst|stormdrake|verdant)$/.test(key)) return 'legacy';
    const seen = new Set();
    while (manifest?.aliases?.[key] && !seen.has(key)) { seen.add(key); key = manifest.aliases[key]; }
    return manifest?.breeds?.[key] ? key : 'bay';
  }
  function profile(key) { return manifest?.breeds?.[resolve(key)] || null; }
  function prepare(scene, key, spec) {
    let skin = null;
    scene.traverse(o => {
      if (o.isSkinnedMesh && (!skin || o.geometry.attributes.position.count > skin.geometry.attributes.position.count)) skin = o;
      if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; }
    });
    if (!skin || skin.skeleton.bones.length !== 33) throw new Error(`Invalid horse skeleton: ${key}`);
    const geo = skin.geometry, si = geo.attributes.skinIndex, sw = geo.attributes.skinWeight;
    const region = new Float32Array(si.count);
    for (let v = 0; v < si.count; v++) {
      let bone = si.getX(v), weight = sw.getX(v);
      for (let c = 1; c < 4; c++) if (sw.getComponent(v,c) > weight) { weight = sw.getComponent(v,c); bone = si.getComponent(v,c); }
      region[v] = bone === 20 || bone === 21 ? 1 : 0;
    }
    geo.setAttribute('aRegion', new THREE.BufferAttribute(region, 1));
    geo.computeBoundingBox();
    skin.material.vertexColors = false;
    scene.updateMatrixWorld(true);
    const bbox = new THREE.Box3().setFromObject(scene);
    const fitScale = Number.isFinite(spec?.fitScale) ? spec.fitScale : 1.85 / Math.max(.1,bbox.max.y-bbox.min.y);
    const fitY = Number.isFinite(spec?.fitY) ? spec.fitY : -bbox.min.y * fitScale;
    const asset = { key, scene, skin, profile: spec || {}, fitScale, fitY, baseMat: skin.material };
    ready.set(key, asset);
    return asset;
  }
  async function load(requested) {
    if (requested !== 'legacy') await manifestReady;
    const key = resolve(requested);
    if (ready.has(key)) return ready.get(key);
    if (!pending.has(key)) {
      const spec = manifest?.breeds?.[key];
      const url = key === 'legacy' ? new URL('../horse_showcase_rigged.glb', base) : new URL(spec.file, base);
      const job = loader.loadAsync(url.href).then(g => prepare(g.scene,key,spec)).catch(e => { pending.delete(key); throw e; });
      pending.set(key,job);
    }
    return pending.get(key);
  }
  function instantiate(asset) {
    const scene = clone(asset.scene);
    let skin = null;
    scene.traverse(o => { if (o.isSkinnedMesh && (!skin || o.geometry.attributes.position.count > skin.geometry.attributes.position.count)) skin = o; });
    scene.scale.setScalar(asset.fitScale);
    scene.position.set(0,asset.fitY,0);
    scene.rotation.set(0,-Math.PI/2,0);
    return {...asset,scene,skin,bones:skin.skeleton.bones};
  }
  function mountPoint(asset, point) {
    if (!Array.isArray(point)) return null;
    if (Array.isArray(point[0])) point = point[0];
    if (point.length !== 3 || !point.every(Number.isFinite)) return null;
    // glTF +X forward becomes mount +Z forward.
    return new THREE.Vector3(-point[2]*asset.fitScale,point[1]*asset.fitScale+asset.fitY,point[0]*asset.fitScale);
  }
  return {load, resolve, profile, instantiate, mountPoint, get:key => ready.get(resolve(key)),
    get manifest(){ return manifest; }, manifestReady};
}

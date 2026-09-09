/* Original pastoral environment art. All geometry and foliage are authored here;
   no imagery or models from the reference game are bundled. */
const TAU = Math.PI * 2;
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };

function ridgeProfile(a, phase) {
  // Whole-number harmonics close the ring without a seam. Broad asymmetric
  // shoulders replace a collection of recognisable, evenly spaced cones.
  const peak = Math.max(0, Math.cos(a * 7 + phase * 0.4)) ** 7;
  return 0.50 + 0.19 * Math.sin(a * 3 + phase)
    + 0.12 * Math.sin(a * 5 - phase * 0.8)
    + 0.075 * Math.sin(a * 9 + phase * 1.9)
    + 0.040 * Math.sin(a * 19 - phase)
    + 0.022 * Math.sin(a * 37 + phase * 0.3) + peak * 0.13;
}

function hash2(x, z) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(z | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function noise2(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz), b = hash2(ix + 1, iz), c = hash2(ix, iz + 1), d = hash2(ix + 1, iz + 1);
  return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
}
function terrainNoise(x, z) {
  return noise2(x, z) * 0.56 + noise2(x * 2.1 + 17, z * 2.1 - 8) * 0.28
    + noise2(x * 4.3 - 5, z * 4.3 + 31) * 0.16;
}

export function installBackdrop({ THREE, scene }) {
  const group = new THREE.Group();
  group.name = 'Pastoral mountain backdrop';
  const configs = [
    { inner: 1300, crest: 1700, outer: 2280, height: 340, phase: 0.65,
      low: '#617684', high: '#8b979f', snow: true },
    { inner: 920, crest: 1230, outer: 1670, height: 190, phase: 2.7,
      low: '#4d625b', high: '#6b7870', snow: false },
    { inner: 725, crest: 910, outer: 1210, height: 112, phase: 4.2,
      low: '#354936', high: '#64704d', snow: false },
  ];
  for (const cfg of configs) {
    const segments = 512, rings = 32;
    const vertices = [], colors = [], indices = [];
    const low = new THREE.Color(cfg.low), high = new THREE.Color(cfg.high);
    const rock = new THREE.Color('#77796f'), snow = new THREE.Color('#c5cfd1');
    const c = new THREE.Color();
    const crestT = (cfg.crest - cfg.inner) / (cfg.outer - cfg.inner);
    for (let j = 0; j <= rings; j++) {
      const t = j / rings;
      for (let i = 0; i <= segments; i++) {
        const a = (i / segments) * TAU;
        const localCrest = crestT + Math.sin(a * 5 + cfg.phase) * 0.068
          + Math.sin(a * 13 - cfg.phase) * 0.024;
        const shoulder = t <= localCrest ? t / localCrest : (1 - t) / (1 - localCrest);
        const profile = Math.pow(Math.max(0, shoulder), 1.14);
        const silhouette = ridgeProfile(a, cfg.phase);
        const radius = cfg.inner + t * (cfg.outer - cfg.inner)
          + Math.sin(a * 4 + cfg.phase) * 56 * Math.sin(Math.PI * t);
        const x = Math.cos(a) * radius, z = Math.sin(a) * radius;
        const warp = terrainNoise(x * 0.004 + cfg.phase * 10, z * 0.004) * 26;
        const erosion = 1 - Math.abs(terrainNoise(x * 0.014 + warp, z * 0.014 - warp) * 2 - 1);
        const spurs = Math.pow(Math.abs(Math.sin(a * 34 + warp * 0.12 + t * 3)), 1.4);
        const broken = (erosion - 0.58) * cfg.height * 0.10 * Math.sin(Math.PI * t);
        const folds = (spurs - 0.5) * cfg.height * 0.028 * profile;
        const y = -15 + profile * cfg.height * silhouette + broken + folds;
        vertices.push(x, y, z);
        const variation = terrainNoise(x * 0.04, z * 0.04);
        c.copy(low).lerp(high, clamp(profile * 0.56 + variation * 0.22));
        c.multiplyScalar(0.76 + erosion * 0.16 + spurs * 0.08);
        c.lerp(rock, smooth(0.42, 0.95, profile) * (0.16 + (1 - erosion) * 0.4));
        // The northern massif alone carries snow. Broken patches on the high
        // shoulders preserve a natural rock/snow boundary, without a second cap mesh.
        if (cfg.snow) {
          const northern = smooth(-0.08, 0.6, -Math.sin(a));
          const patch = smooth(0.54, 0.78, profile * silhouette + variation * 0.05);
          c.lerp(rock, profile * 0.16);
          c.lerp(snow, northern * patch * 0.8);
        }
        colors.push(c.r, c.g, c.b);
      }
    }
    const row = segments + 1;
    for (let j = 0; j < rings; j++) for (let i = 0; i < segments; i++) {
      const p = j * row + i;
      indices.push(p, p + 1, p + row, p + 1, p + row + 1, p + row);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const normals = geometry.getAttribute('normal'), colorAttribute = geometry.getAttribute('color');
    // Exposed faces stay rocky; soil and vegetation gather on gentler shoulders.
    for (let i = 0; i < normals.count; i++) {
      const steep = 1 - Math.abs(normals.getY(i));
      c.fromBufferAttribute(colorAttribute, i).lerp(rock, smooth(0.3, 0.7, steep) * 0.28);
      colorAttribute.setXYZ(i, c.r, c.g, c.b);
    }
    geometry.computeBoundingSphere();
    const material = new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 1, metalness: 0, envMapIntensity: 0.55,
      // Use the scene's day/night fog colour but attenuate its depth below.
      // Full exponential fog would erase the ridge at this viewing distance.
      fog: true,
      side: THREE.DoubleSide,
    });
    material.onBeforeCompile = shader => {
      shader.vertexShader = 'varying vec3 vRidgePosition;\n' + shader.vertexShader.replace(
        '#include <begin_vertex>', '#include <begin_vertex>\nvRidgePosition = position;');
      shader.fragmentShader = `varying vec3 vRidgePosition;
float ridgeHash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
float ridgeNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
 return mix(mix(mix(ridgeHash(i),ridgeHash(i+vec3(1,0,0)),f.x),mix(ridgeHash(i+vec3(0,1,0)),ridgeHash(i+vec3(1,1,0)),f.x),f.y),
 mix(mix(ridgeHash(i+vec3(0,0,1)),ridgeHash(i+vec3(1,0,1)),f.x),mix(ridgeHash(i+vec3(0,1,1)),ridgeHash(i+vec3(1,1,1)),f.x),f.y),f.z);}
` + shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
 float geological = ridgeNoise(vRidgePosition * 0.035);
 float fissures = ridgeNoise(vRidgePosition * vec3(0.10,0.025,0.10));
 float strata = sin((vRidgePosition.y + geological * 8.0) * 0.42);
 diffuseColor.rgb *= 0.86 + geological * 0.13 + fissures * 0.03 + strata * 0.007;`);
      shader.fragmentShader = shader.fragmentShader.replace('#include <fog_fragment>', `
#ifdef USE_FOG
 #ifdef FOG_EXP2
  float ridgeFog = 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth * 0.14);
 #else
  float ridgeFog = smoothstep(fogNear, fogFar, vFogDepth) * 0.62;
 #endif
 gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, min(0.65, ridgeFog));
#endif`);
    };
    material.customProgramCacheKey = () => 'eroded-ridge-v2';
    const ridge = new THREE.Mesh(geometry, material);
    ridge.name = cfg.snow ? 'Distant northern massif' : 'Wooded rolling ridgeline';
    ridge.castShadow = false;
    ridge.receiveShadow = false;
    group.add(ridge);
  }
  scene.add(group);
  return group;
}

const foliageTextures = new Map();
const foliageAtlasObservers = new Set();
export function onFoliageAtlasReady(callback) {
  foliageAtlasObservers.add(callback);
  return () => foliageAtlasObservers.delete(callback);
}
const foliageMaterials = new Map();
export function getFoliageTexture(THREE, species = 'oak') {
  if (foliageTextures.has(species)) return foliageTextures.get(species);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const c = canvas.getContext('2d');
  let seed = 48271;
  const rand = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const pine = species === 'pine' || species === 'snowpine';
  const birch = species === 'birch';
  const blossom = species === 'blossom';
  const leaf = (x, y, angle, length, width) => {
    c.save();
    c.translate(x, y);
    c.rotate(angle);
    const gradient = c.createLinearGradient(-width, -length, width, length);
    gradient.addColorStop(0, birch ? '#b2c184' : '#a6b579');
    gradient.addColorStop(0.45, birch ? '#96ad6d' : '#8da265');
    gradient.addColorStop(0.56, '#7f955b');
    gradient.addColorStop(1, '#62774a');
    c.fillStyle = gradient;
    c.beginPath();
    c.moveTo(0, -length);
    // Pointed serrated birch leaves and the lobes of an oak. Leaf size here is
    // 5–12 cm once a full twig card occupies about 70 cm of world space.
    const steps = birch ? 13 : 11;
    for (let side = 0; side < 2; side++) for (let j = 1; j <= steps; j++) {
      const t = side === 0 ? j / steps : 1 - j / steps;
      const shape = Math.pow(Math.sin(Math.PI * t), birch ? 0.8 : 0.58);
      const lobes = birch ? (j % 2 ? 0.88 : 1.06) : 0.77 + 0.24 * Math.cos(t * Math.PI * 10);
      c.lineTo((side === 0 ? 1 : -1) * width * shape * lobes, -length + t * length * 2);
    }
    c.closePath();
    c.fill();
    c.strokeStyle = 'rgba(214,224,166,0.44)';
    c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(0, -length * 0.92); c.lineTo(0, length * 0.9); c.stroke();
    c.lineWidth = 0.7;
    for (let j = 1; j < 6; j++) for (const side of [-1, 1]) {
      const y0 = -length + j * length * 0.32;
      c.beginPath(); c.moveTo(0, y0 + length * 0.13);
      c.lineTo(side * width * Math.sin(j / 6 * Math.PI) * 0.82, y0 - length * 0.1); c.stroke();
    }
    c.restore();
  };
  const stems = [
    [[253,482],[244,259],[247,76]],
    [[254,438],[154,328],[61,208]],
    [[250,354],[351,280],[430,170]],
    [[244,250],[167,178],[103,87]],
    [[249,240],[321,149],[355,49]],
  ];
  for (let branch = 0; branch < stems.length; branch++) {
    const [p0, p1, p2] = stems[branch];
    c.strokeStyle = pine ? '#706b46' : '#766c49';
    c.lineWidth = branch === 0 ? 3.8 : 2.5;
    c.beginPath(); c.moveTo(...p0); c.quadraticCurveTo(...p1, ...p2); c.stroke();
    const count = pine ? 46 : 7;
    for (let i = 1; i <= count; i++) {
      const t = i / (count + 1), u = 1 - t;
      const x = u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0];
      const y = u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1];
      const dx = 2 * u * (p1[0] - p0[0]) + 2 * t * (p2[0] - p1[0]);
      const dy = 2 * u * (p1[1] - p0[1]) + 2 * t * (p2[1] - p1[1]);
      const a = Math.atan2(dx, -dy);
      for (const side of [-1, 1]) {
        const angle = a + side * (0.68 + rand() * 0.34);
        const length = pine ? 17 + rand() * 22 : 19 + rand() * 17;
        const offset = pine ? 0 : length * 0.57;
        const lx = x + Math.sin(angle) * offset, ly = y - Math.cos(angle) * offset;
        if (pine) {
          c.strokeStyle = ['#6f805b','#82966b','#9cac84'][i % 3];
          c.lineWidth = 4.4 + rand() * 1.8;
          c.beginPath(); c.moveTo(x,y);
          c.lineTo(x + Math.sin(angle) * length, y - Math.cos(angle) * length); c.stroke();
        } else leaf(lx, ly, angle, length, birch ? length * 0.44 : length * 0.47);
        if (blossom && i % 3 === 1) {
          c.fillStyle = ['#dec9c0','#ecdcd2','#cbaea5'][i % 3];
          for (let k = 0; k < 5; k++) {
            c.beginPath();c.ellipse(lx+Math.sin(k*TAU/5)*6,ly+Math.cos(k*TAU/5)*6,5,7,k*TAU/5,0,TAU);c.fill();
          }
        }
      }
    }
  }
  const pixels = c.getImageData(0, 0, 512, 512);
  // Preserve pale leaf colour under transparent texels. Canvas uploads zero
  // those RGB values, creating dark outlines after mip filtering; a DataTexture
  // retains the colour gutter while alpha continues to describe the leaf edge.
  for (let i = 0; i < pixels.data.length; i += 4) if (pixels.data[i + 3] < 18) {
    pixels.data[i] = 127; pixels.data[i + 1] = 149; pixels.data[i + 2] = 91;
  }
  const texture = new THREE.DataTexture(new Uint8Array(pixels.data.buffer), 512, 512, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.flipY = true;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  texture.name = 'Original botanical ' + species + ' twig spray';
  foliageTextures.set(species, texture);
  return texture;
}

export function loadFoliageAtlas({ THREE, url, species: targets = ['oak', 'birch'] }) {
  // Called only once the ComfyUI-authored atlas exists. Procedural textures keep
  // the scene usable throughout the asynchronous image load.
  new THREE.TextureLoader().load(url, texture => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    texture.name = 'Original photoreal leafy branch atlas';
    texture.userData.photographicFoliage = true;
    for (const species of targets) {
      foliageTextures.set(species, texture);
      for (const material of foliageMaterials.get(species) || []) {
        material.map = texture;
        const pine = species === 'pine' || species === 'snowpine';
        material.color.set(pine ? '#dce3d4' : species === 'birch' ? '#e4e7d7' : '#dbe0cd');
        material.alphaTest = pine ? 0.30 : 0.40;
        if (material.userData.depthMat) {
          material.userData.depthMat.map = texture;
          material.userData.depthMat.alphaTest = material.alphaTest;
          material.userData.depthMat.needsUpdate = true;
        }
        material.needsUpdate = true;
      }
    }
    for (const observer of foliageAtlasObservers) observer(targets);
  }, undefined, error => console.warn('Foliage atlas kept procedural fallback', error));
}

export function tuneFoliage({ THREE, material, geometry, species = 'oak' }) {
  const pine = species === 'pine' || species === 'snowpine';
  if (geometry && !geometry.userData.pastoralNormals) {
    geometry.computeBoundingBox();
    const box = geometry.boundingBox;
    const center = box.getCenter(new THREE.Vector3());
    center.y = box.min.y + (box.max.y - box.min.y) * 0.38;
    const p = geometry.getAttribute('position'), n = geometry.getAttribute('normal');
    const v = new THREE.Vector3(), original = new THREE.Vector3();
    const colors = new Float32Array(p.count * 3);
    const radius = Math.max(box.max.x - box.min.x, box.max.z - box.min.z) * 0.5;
    // Bend and scale the existing cards without increasing triangle count. Each
    // twig remains anchored on its branch; the tips twist away from one plane.
    for (let i = 0; i + 3 < p.count; i += 4) {
      const cx = (p.getX(i) + p.getX(i + 1)) * 0.5;
      const cy = (p.getY(i) + p.getY(i + 1)) * 0.5;
      const cz = (p.getZ(i) + p.getZ(i + 1)) * 0.5;
      const width = Math.hypot(p.getX(i + 1)-p.getX(i),p.getY(i + 1)-p.getY(i),p.getZ(i + 1)-p.getZ(i));
      const bend = width * (0.06 + hash2(i, p.count) * 0.07);
      for (let j = 0; j < 4; j++) {
        const tip = j > 1 ? (j === 2 ? bend : -bend * 0.45) : 0;
        const scale = pine ? 1.18 : 0.9;
        p.setXYZ(i+j,cx+(p.getX(i+j)-cx)*scale+n.getX(i+j)*tip,
          cy+(p.getY(i+j)-cy)*scale+n.getY(i+j)*tip,
          cz+(p.getZ(i+j)-cz)*scale+n.getZ(i+j)*tip);
      }
    }
    p.needsUpdate = true;
    // Mix local twig lighting with the whole canopy. Lower branches and the
    // crown interior remain darker; outer sunlit leaves still read individually.
    if (p && n) for (let i = 0; i < p.count; i++) {
      original.fromBufferAttribute(n, i);
      v.set(p.getX(i) - center.x, (p.getY(i) - center.y) * 0.7, p.getZ(i) - center.z);
      v.y = Math.max(v.y, v.length() * 0.14);
      v.normalize();
      if (original.dot(v) < 0) original.negate();
      v.lerp(original, 0.28).normalize();
      n.setXYZ(i, v.x, v.y, v.z);
      const radial = Math.hypot(p.getX(i) - center.x, p.getZ(i) - center.z) / Math.max(0.1, radius);
      const upper = (p.getY(i) - box.min.y) / Math.max(0.1, box.max.y - box.min.y);
      const shade = 0.57 + 0.25 * clamp(radial) + 0.18 * clamp(upper);
      const variation = hash2(Math.floor(p.getX(i) * 4),Math.floor(p.getZ(i) * 4));
      colors[i * 3] = shade * (0.94 + variation * 0.06);
      colors[i * 3 + 1] = shade;
      colors[i * 3 + 2] = shade * (0.91 + variation * 0.09);
    }
    if (n) n.needsUpdate = true;
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    geometry.userData.pastoralNormals = true;
  }
  if (!material || material.userData.pastoralFoliage) return;
  material.userData.pastoralFoliage = true;
  material.roughness = 1;
  material.vertexColors = true;
  material.envMapIntensity = 0.85;
  material.alphaTest = pine ? 0.20 : 0.34;
  material.alphaToCoverage = true;
  material.map = getFoliageTexture(THREE, species);
  const palettes = {oak:'#adb58e',birch:'#bbc6a5',blossom:'#c5c4ac',pine:'#9daf98',snowpine:'#b4c3b7'};
  material.color.set(palettes[species] || palettes.oak);
  if (material.map.userData.photographicFoliage) {
    material.color.set(pine ? '#dce3d4' : species === 'birch' ? '#e4e7d7' : '#dbe0cd');
    material.alphaTest = pine ? 0.30 : 0.40;
  }
  if (!foliageMaterials.has(species)) foliageMaterials.set(species, new Set());
  foliageMaterials.get(species).add(material);
  if (material.userData.depthMat) material.userData.depthMat.map = material.map;
  if (material.userData.depthMat) {
    material.userData.depthMat.alphaTest = material.alphaTest;
    material.userData.depthMat.needsUpdate = true;
  }
  const previousCompile = material.onBeforeCompile;
  const previousKey = material.customProgramCacheKey.bind(material);
  const key = previousKey();
  const albedoMean = new THREE.Color(pine ? '#5b7048' : '#89975e');
  material.onBeforeCompile = function (shader, renderer) {
    previousCompile.call(this, shader, renderer);
    // The source atlas already has bright veins/needle edges baked into its
    // colour. Repeating those highlights across a crown makes every twig look
    // outlined, even at roughness 1. Compress only this texture contrast; retain
    // the alpha silhouette, canopy vertex shading, and the scene's lighting.
    shader.uniforms.uFoliageAlbedoMean = {value:albedoMean};
    shader.fragmentShader = 'uniform vec3 uFoliageAlbedoMean;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>',
      THREE.ShaderChunk.map_fragment.replace('diffuseColor *= sampledDiffuseColor;',
        `float foliageCoverage = smoothstep(0.30, 0.92, sampledDiffuseColor.a);\n sampledDiffuseColor.rgb = mix(uFoliageAlbedoMean, sampledDiffuseColor.rgb, ${pine ? '0.48' : '0.72'} * foliageCoverage);\n diffuseColor *= sampledDiffuseColor;`));
    // Three flips DoubleSide normals away from the light on rear-facing cards.
    // Keep the authored canopy normals on both sides to model diffuse light
    // through thin leaves; this avoids black checkerboarding without emissive foliage.
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <normal_fragment_begin>',
      '#include <normal_fragment_begin>\n#ifdef DOUBLE_SIDED\nnormal *= faceDirection;\n#endif'
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <alphatest_fragment>',
      // Leaves can pass across a chase camera on a narrow trail. Alpha coverage
      // dissolves just the nearest cards while keeping opaque depth ordering.
      'diffuseColor.a *= smoothstep(0.5, 2.6, length(vViewPosition));\n#include <alphatest_fragment>'
    );
  };
  material.customProgramCacheKey = () => key + '|botanical-foliage-v5-' + (pine ? 'needle' : 'leaf');
  material.needsUpdate = true;
}

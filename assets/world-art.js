/* Original pastoral environment art. All geometry and foliage are authored here;
   no imagery or models from the reference game are bundled. */
const TAU = Math.PI * 2;
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };

function ridgeProfile(a, phase) {
  // Whole-number harmonics close the ring without a seam. Broad asymmetric
  // shoulders replace a collection of recognisable, evenly spaced cones.
  return 0.58 + 0.19 * Math.sin(a * 3 + phase)
    + 0.12 * Math.sin(a * 5 - phase * 0.8)
    + 0.075 * Math.sin(a * 9 + phase * 1.9)
    + 0.028 * Math.sin(a * 19 - phase)
    + 0.018 * Math.sin(a * 37 + phase * 0.3);
}

export function installBackdrop({ THREE, scene }) {
  const group = new THREE.Group();
  group.name = 'Pastoral mountain backdrop';
  const configs = [
    { inner: 1300, crest: 1700, outer: 2280, height: 395, phase: 0.65,
      low: '#728f9c', high: '#97a9b2', snow: true },
    { inner: 920, crest: 1230, outer: 1670, height: 238, phase: 2.7,
      low: '#536f65', high: '#778a7b', snow: false },
    { inner: 725, crest: 910, outer: 1210, height: 138, phase: 4.2,
      low: '#4b673d', high: '#758458', snow: false },
  ];
  for (const cfg of configs) {
    const segments = 320, rings = 12;
    const vertices = [], colors = [], indices = [];
    const low = new THREE.Color(cfg.low), high = new THREE.Color(cfg.high);
    const rock = new THREE.Color('#858d8c'), snow = new THREE.Color('#c8d8df');
    const c = new THREE.Color();
    const crestT = (cfg.crest - cfg.inner) / (cfg.outer - cfg.inner);
    for (let j = 0; j <= rings; j++) {
      const t = j / rings;
      const shoulder = t <= crestT ? t / crestT : (1 - t) / (1 - crestT);
      const profile = Math.pow(Math.max(0, shoulder), 0.94);
      for (let i = 0; i <= segments; i++) {
        const a = (i / segments) * TAU;
        const silhouette = ridgeProfile(a, cfg.phase);
        const radius = cfg.inner + t * (cfg.outer - cfg.inner)
          + Math.sin(a * 4 + cfg.phase) * 25 * Math.sin(Math.PI * t);
        const folds = Math.sin(a * 17 + t * 4 + cfg.phase)
          * Math.sin(Math.PI * t) * cfg.height * 0.021;
        const y = -15 + profile * cfg.height * silhouette + folds;
        vertices.push(Math.cos(a) * radius, y, Math.sin(a) * radius);
        const variation = 0.5 + 0.5 * Math.sin(a * 31 + t * 7 + cfg.phase);
        c.copy(low).lerp(high, clamp(profile * 0.7 + variation * 0.13));
        c.multiplyScalar(0.88 + 0.12 * Math.sin(a * 11 + t * 14) ** 2);
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
    geometry.computeBoundingSphere();
    const material = new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 1, metalness: 0, envMapIntensity: 0.55,
      side: THREE.DoubleSide,
    });
    const ridge = new THREE.Mesh(geometry, material);
    ridge.name = cfg.snow ? 'Distant northern massif' : 'Wooded rolling ridgeline';
    ridge.castShadow = false;
    ridge.receiveShadow = false;
    group.add(ridge);
  }
  scene.add(group);
  return group;
}

let broadleafTexture;
function makeBroadleafTexture(THREE) {
  if (broadleafTexture) return broadleafTexture;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const c = canvas.getContext('2d');
  let seed = 48271;
  const rand = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  // Overlapping rounded leaves create a readable canopy mass. The old seven
  // thin leaves per card left high-contrast twig skeletons against the sky.
  for (let i = 0; i < 33; i++) {
    const a = i * 2.39996;
    const distance = Math.sqrt((i + 0.3) / 33) * 80;
    const x = 128 + Math.cos(a) * distance;
    const y = 126 + Math.sin(a) * distance * 0.89;
    const length = 26 + rand() * 14;
    const width = 17 + rand() * 8;
    c.save();
    c.translate(x, y);
    c.rotate(a * 0.6 + rand());
    const gradient = c.createLinearGradient(-width, -length, width, length);
    gradient.addColorStop(0, '#e6edc8');
    gradient.addColorStop(0.5, '#cad9a8');
    gradient.addColorStop(1, '#a7bd86');
    c.fillStyle = gradient;
    c.beginPath();
    c.ellipse(0, 0, width, length, 0, 0, TAU);
    c.fill();
    c.strokeStyle = 'rgba(247,249,216,0.24)';
    c.lineWidth = 1.8;
    c.beginPath(); c.moveTo(0, -length * 0.75); c.lineTo(0, length * 0.75); c.stroke();
    c.restore();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.name = 'Original broadleaf canopy clusters';
  broadleafTexture = texture;
  return texture;
}

export function tuneFoliage({ THREE, material, geometry, species = 'oak' }) {
  if (geometry && !geometry.userData.pastoralNormals) {
    geometry.computeBoundingBox();
    const box = geometry.boundingBox;
    const center = box.getCenter(new THREE.Vector3());
    center.y = box.min.y + (box.max.y - box.min.y) * 0.38;
    const p = geometry.getAttribute('position'), n = geometry.getAttribute('normal');
    const v = new THREE.Vector3();
    // Whole-canopy normals keep the mass round and readable. Leaves still have
    // wind motion, alpha silhouettes and direct illumination.
    if (p && n) for (let i = 0; i < p.count; i++) {
      v.set(p.getX(i) - center.x, (p.getY(i) - center.y) * 0.48, p.getZ(i) - center.z);
      v.y = Math.max(v.y, v.length() * 0.38);
      v.normalize();
      n.setXYZ(i, v.x, v.y, v.z);
    }
    if (n) n.needsUpdate = true;
    geometry.userData.pastoralNormals = true;
  }
  if (!material || material.userData.pastoralFoliage) return;
  material.userData.pastoralFoliage = true;
  material.roughness = 1;
  material.envMapIntensity = 0.8;
  material.alphaTest = 0.38;
  material.alphaToCoverage = true;
  if (species === 'oak' || species === 'birch') {
    material.map = makeBroadleafTexture(THREE);
    material.color.set(species === 'birch' ? '#b2ce78' : '#a2bf66');
    if (material.userData.depthMat) material.userData.depthMat.map = material.map;
  }
  if (material.userData.depthMat) {
    material.userData.depthMat.alphaTest = material.alphaTest;
    material.userData.depthMat.needsUpdate = true;
  }
  const previousCompile = material.onBeforeCompile;
  const previousKey = material.customProgramCacheKey.bind(material);
  const key = previousKey();
  material.onBeforeCompile = function (shader, renderer) {
    previousCompile.call(this, shader, renderer);
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
      'diffuseColor.a *= smoothstep(0.4, 2.3, length(vViewPosition));\n#include <alphatest_fragment>'
    );
  };
  material.customProgramCacheKey = () => key + '|pastoral-foliage-v2';
  material.needsUpdate = true;
}

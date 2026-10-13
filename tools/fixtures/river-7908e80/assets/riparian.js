/* Original riverbank habitat, in metres. Curved leaf ribbons and small weathered
   solids are instanced in irregular patches; no billboard blobs or cattail caps.
   The caller owns the graded river and supplies its exact visible ground sampler. */
const TAU = Math.PI * 2;
const GROUP_NAME = 'Riverbank habitat';
const SEED = 9283011;
const TRIANGLE_BUDGET = 60000;
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const rngFrom = seed => {
  let state = seed >>> 0;
  return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
};
const hash = n => { let h = Math.imul(n | 0, 374761393); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
const noise = n => { const i = Math.floor(n), t = n - i, f = t * t * (3 - 2 * t); return hash(i) * (1 - f) + hash(i + 1) * f; };

function geometryWriter(THREE) {
  const positions = [], colors = [], uvs = [], indices = [];
  const color = new THREE.Color();
  const vertex = (p, c, u, v) => {
    positions.push(p.x, p.y, p.z); colors.push(c.r, c.g, c.b); uvs.push(u, v);
    return positions.length / 3 - 1;
  };
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  // A tapered, bowed strip has an actual botanical silhouette at every angle.
  const blade = (base, azimuth, height, reach, width, tint, segments = 5, droop = .08) => {
    const start = positions.length / 3, ca = Math.cos(azimuth), sa = Math.sin(azimuth);
    const side = V(-sa, 0, ca), low = new THREE.Color(tint).multiplyScalar(.72);
    const tip = new THREE.Color(tint).lerp(new THREE.Color('#9b9d70'), .20);
    for (let j = 0; j <= segments; j++) {
      const t = j / segments;
      const outward = reach * t * t;
      const p = base.clone().add(V(ca * outward, height * (t - droop * t * t * t), sa * outward));
      const edge = width * Math.sin(Math.PI * (.12 + t * .88)) * (1 - t * .76);
      color.copy(low).lerp(tip, Math.sqrt(t));
      vertex(p.clone().addScaledVector(side, -edge), color, 0, t);
      vertex(p.clone().addScaledVector(side, edge), color, 1, t);
    }
    for (let j = 0; j < segments; j++) {
      const i = start + j * 2; indices.push(i, i + 1, i + 2, i + 1, i + 3, i + 2);
    }
  };
  const branch = (points, radii, tint, sides = 5, wood = false) => {
    const start = positions.length / 3, c = new THREE.Color(tint);
    for (let j = 0; j < points.length; j++) {
      const tangent = points[Math.min(j + 1, points.length - 1)].clone()
        .sub(points[Math.max(j - 1, 0)]).normalize();
      const right = V(0, 1, 0).cross(tangent);
      if (right.lengthSq() < .001) right.set(1, 0, 0);
      right.normalize(); const forward = tangent.clone().cross(right).normalize();
      for (let k = 0; k <= sides; k++) {
        const a = k / sides * TAU;
        const radius = radii[j] * (1 + Math.sin(a * 3 + j * .6) * .12);
        const p = points[j].clone().addScaledVector(right, Math.cos(a) * radius)
          .addScaledVector(forward, Math.sin(a) * radius);
        color.copy(c).multiplyScalar(.86 + .13 * Math.cos(a * 2 + j * .2));
        // A narrow strip through one siding board supplies fine longitudinal wood
        // grain, avoiding the board seams in the full source image.
        vertex(p, color, wood ? .115 + k / sides * .042 : k / sides,
          wood ? j / (points.length - 1) * .90 : j / (points.length - 1));
      }
    }
    const row = sides + 1;
    for (let j = 0; j < points.length - 1; j++) for (let k = 0; k < sides; k++) {
      const i = start + j * row + k; indices.push(i, i + 1, i + row, i + 1, i + row + 1, i + row);
    }
    // Broken timber ends are capped; the tips of narrow live stems do not need it.
    if (wood) for (const ring of [0, points.length - 1]) {
      color.copy(c).multiplyScalar(.76);
      const center = vertex(points[ring], color, .14, ring ? .9 : 0);
      for (let k = 0; k < sides; k++) {
        const i = start + ring * row + k;
        if (ring) indices.push(center, i, i + 1); else indices.push(center, i + 1, i);
      }
    }
  };
  const finish = () => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); g.setIndex(indices);
    g.computeVertexNormals(); g.computeBoundingSphere(); return g;
  };
  return { blade, branch, finish, V };
}

function makeSedge(THREE) {
  const b = geometryWriter(THREE), r = rngFrom(SEED + 23);
  for (let i = 0; i < 9; i++) {
    const a = i * 2.39996 + r() * .3;
    b.blade(b.V((r() - .5) * .07, 0, (r() - .5) * .07), a,
      .26 + r() * .29, .15 + r() * .22, .012 + r() * .013,
      i % 5 === 0 ? '#818366' : '#73815a', 5, .14);
  }
  return b.finish();
}

function makeReed(THREE) {
  const b = geometryWriter(THREE), r = rngFrom(SEED + 67);
  for (let i = 0; i < 3; i++) {
    const a = i * 2.39996, h = .64 + r() * .32;
    const root = b.V(Math.cos(a) * .065, 0, Math.sin(a) * .065);
    const lean = b.V(Math.cos(a) * .075, 0, Math.sin(a) * .075);
    const points = [0, .38, .74, 1].map(t => root.clone().addScaledVector(lean, t * t).add(b.V(0, h * t, 0)));
    b.branch(points, [.010, .008, .005, .0016], '#829067', 4);
    for (let j = 0; j < 3; j++) {
      const t = .20 + j * .21, base = root.clone().addScaledVector(lean, t * t).add(b.V(0, h * t, 0));
      b.blade(base, a + (j % 2 ? .8 : -1.9), .14 + r() * .13,
        .17 + r() * .19, .010 + r() * .009, '#6f8059', 4, .30);
    }
  }
  return b.finish();
}

function makePebble(THREE) {
  const g = new THREE.SphereGeometry(1, 7, 4), p = g.getAttribute('position'), uv = g.getAttribute('uv');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const variation = 1 + Math.sin(x * 4.3 + z * 3.1 + y * 2.7) * .13;
    p.setXYZ(i, x * variation, (y + 1) * .32, z * variation * .77);
    // Top projection samples a small rock patch. Sphere-pole UVs would collapse
    // the sedimentary lines into rings and make a pebble resemble a wood slice.
    uv.setXY(i, .28 + x * .14, .30 + z * .14);
  }
  g.computeVertexNormals(); g.computeBoundingSphere(); return g;
}

function makeDriftwood(THREE) {
  const b = geometryWriter(THREE);
  const p = [b.V(-.55, .045, -.035), b.V(-.29, .051, -.024), b.V(0, .069, .006), b.V(.28, .063, .026), b.V(.55, .049, .048)];
  b.branch(p, [.031, .045, .040, .028, .014], '#b4ae9e', 6, true);
  b.branch([p[1], b.V(-.16, .076, -.15), b.V(.06, .053, -.26)], [.024, .015, .003], '#aaa596', 5, true);
  b.branch([p[3], b.V(.31, .095, .17), b.V(.44, .072, .25)], [.015, .009, .002], '#bdb3a0', 5, true);
  return b.finish();
}

export function installRiparian({ THREE, scene, terrainH, riverZ, riverLevel, pathDist }) {
  if (!THREE || !scene || [terrainH, riverZ, riverLevel, pathDist].some(f => typeof f !== 'function'))
    throw new TypeError('installRiparian requires THREE, scene and terrain/river/path samplers');
  const existing = scene.getObjectByName(GROUP_NAME);
  if (existing?.userData.riparian) return existing.userData.riparian;

  const group = new THREE.Group(); group.name = GROUP_NAME;
  const texture = (file, color = false) => {
    if (typeof document === 'undefined') return null;
    const t = new THREE.TextureLoader().load('assets/textures/realism/' + file);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
    if (color) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  const wind = { value: 0 };
  const leafMaterial = name => {
    const m = new THREE.MeshStandardMaterial({ name, vertexColors: true, side: THREE.DoubleSide,
      roughness: .93, metalness: 0, envMapIntensity: .65 });
    m.onBeforeCompile = sh => {
      sh.uniforms.uRiparianTime = wind;
      sh.vertexShader = 'uniform float uRiparianTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
        vec3 bankRoot = vec3(instanceMatrix[3]);
        float bankBend = max(0.0, position.y);
        float bankPhase = bankRoot.x * .31 + bankRoot.z * .27;
        transformed.x += sin(uRiparianTime * .91 + bankPhase) * bankBend * bankBend * .026;
        transformed.z += cos(uRiparianTime * .73 + bankPhase) * bankBend * bankBend * .014;
        #endif`);
    };
    m.customProgramCacheKey = () => 'riparian-curved-blade-v1';
    return m;
  };
  const prototypes = {
    sedges: { geometry: makeSedge(THREE), material: leafMaterial('Riparian | arching sedges') },
    reeds: { geometry: makeReed(THREE), material: leafMaterial('Riparian | branched reed grass') },
    pebbles: { geometry: makePebble(THREE), material: new THREE.MeshStandardMaterial({
      name: 'Riparian | sediment pebbles', map: texture('rock_albedo.jpg', true),
      normalMap: texture('rock_normal.jpg'), normalScale: new THREE.Vector2(.15, .15),
      color: '#ffffff', roughness: .94, metalness: 0, envMapIntensity: .48 }) },
    driftwood: { geometry: makeDriftwood(THREE), material: new THREE.MeshStandardMaterial({
      name: 'Riparian | washed timber', map: texture('siding_albedo.jpg', true),
      color: '#d5d0c3', vertexColors: true, roughness: .97, metalness: 0, envMapIntensity: .50 }) },
  };
  for (const p of Object.values(prototypes)) p.triangles = (p.geometry.index?.count || p.geometry.getAttribute('position').count) / 3;
  const bins = new Map(), r = rngFrom(SEED), up = new THREE.Vector3(0, 1, 0);
  const position = new THREE.Vector3(), scale = new THREE.Vector3(), matrix = new THREE.Matrix4();
  const q = new THREE.Quaternion(), yawQ = new THREE.Quaternion(), normal = new THREE.Vector3(), col = new THREE.Color();
  const zAxis = new THREE.Vector3(0, 0, 1);
  const stats = { seed: SEED, clusters: 0, sedges: 0, reeds: 0, pebbles: 0, driftwood: 0,
    triangles: 0, drawCalls: 0, materials: 4, rejected: 0, budgetSkipped: 0,
    minWaterClearance: Infinity, minBankDistance: Infinity, maxBankDistance: 0,
    minBridgeDistance: Infinity, minPathDistance: Infinity, range: [-490, 490] };

  const add = (kind, x, z, size, angle, variation = 1) => {
    const p = prototypes[kind], rd = Math.abs(z - riverZ(x));
    const y = terrainH(x, z), water = riverLevel(x), pd = pathDist(x, z);
    const bridgeMargin = kind === 'driftwood' ? 5.1 : 4.35;
    if (!Number.isFinite(y) || !Number.isFinite(water) || !Number.isFinite(pd) ||
        Math.abs(x) > 490 || Math.abs(x) < bridgeMargin || rd < 4.6 || rd > 10 || y <= water + .08 || pd < 2.35) {
      stats.rejected++; return false;
    }
    const dx = (terrainH(x + .15, z) - terrainH(x - .15, z)) / .30;
    const dz = (terrainH(x, z + .15) - terrainH(x, z - .15)) / .30;
    if (!Number.isFinite(dx) || !Number.isFinite(dz) || Math.hypot(dx, dz) > (kind === 'driftwood' ? .55 : 1.5)) {
      stats.rejected++; return false;
    }
    if (stats.triangles + p.triangles > TRIANGLE_BUDGET) { stats.budgetSkipped++; return false; }
    q.identity(); yawQ.setFromAxisAngle(up, angle);
    if (kind === 'pebbles') {
      normal.set(-dx, 1, -dz).normalize(); q.setFromUnitVectors(up, normal).multiply(yawQ);
      scale.set(size * (1 + variation * .35), size * (.90 + variation * .35), size);
      const colors = ['#dedbd2', '#d0cbbd', '#c0beb2', '#aea99c', '#b7b8ae'];
      col.set(colors[Math.floor(r() * colors.length)]);
    } else if (kind === 'driftwood') {
      const ax = Math.cos(angle), az = -Math.sin(angle);
      const slope = Math.atan(dx * ax + dz * az);
      q.copy(yawQ).multiply(new THREE.Quaternion().setFromAxisAngle(zAxis, slope));
      scale.set(size, size * (.76 + variation * .2), size);
      col.setRGB(.77 + variation * .15, .77 + variation * .13, .73 + variation * .14);
    } else {
      q.copy(yawQ); scale.set(size * (.85 + variation * .20), size, size);
      col.setRGB(.86 + variation * .14, .89 + variation * .11, .81 + variation * .13);
    }
    position.set(x, y, z); matrix.compose(position, q, scale);
    const key = `${Math.floor((x + 500) / 125)}:${kind}`;
    if (!bins.has(key)) bins.set(key, { kind, matrices: [], colors: [] });
    const bin = bins.get(key); bin.matrices.push(matrix.clone()); bin.colors.push(col.clone());
    stats[kind]++; stats.triangles += p.triangles;
    stats.minWaterClearance = Math.min(stats.minWaterClearance, y - water);
    stats.minBankDistance = Math.min(stats.minBankDistance, rd); stats.maxBankDistance = Math.max(stats.maxBankDistance, rd);
    stats.minBridgeDistance = Math.min(stats.minBridgeDistance, Math.abs(x)); stats.minPathDistance = Math.min(stats.minPathDistance, pd);
    return true;
  };

  // Near-game patches are authored first, so the fixed triangle budget thins the
  // remote river ends if needed rather than reducing detail around the bridge.
  const stations = Array.from({ length: 113 }, (_, i) => i - 56).sort((a, b) => Math.abs(a) - Math.abs(b) || a - b);
  for (const station of stations) for (const bank of [-1, 1]) {
    const x0 = station * 8.6 + (r() - .5) * 5.5;
    if (Math.abs(x0) < 7) continue;
    const habitat = noise(x0 * .033 + (bank > 0 ? 27 : 81));
    const near = 1 - clamp((Math.abs(x0) - 230) / 150);
    if (r() > (.38 + .59 * near) * (.40 + habitat * .76)) continue;
    const rd0 = 5.15 + r() * 3.45, spread = 1.25 + r() * 1.6;
    let placed = false;
    // Low sedge fans collect on the upper lip, in loose patches rather than rows.
    for (let j = 0, n = 2 + Math.floor(r() * 3); j < n; j++) {
      const x = x0 + (r() - .5) * spread * 2;
      const z = riverZ(x) + bank * (rd0 + (r() - .5) * 1.4);
      placed = add('sedges', x, z, .65 + r() * .72, r() * TAU, r()) || placed;
    }
    // Small mixed sediment has the greatest density at the water-side edge.
    for (let j = 0, n = 4 + Math.floor(r() * 5); j < n; j++) {
      const x = x0 + (r() - .5) * spread * 2.8;
      const z = riverZ(x) + bank * (4.70 + r() * 3.3);
      placed = add('pebbles', x, z, .025 + r() ** 2 * .105, r() * TAU, r()) || placed;
    }
    if (r() < .52 && habitat > .28) {
      const x = x0 + (r() - .5) * 1.7;
      placed = add('reeds', x, riverZ(x) + bank * (4.9 + r() * 1.3), .7 + r() * .44, r() * TAU, r()) || placed;
    }
    if (r() < .085 && habitat < .78) {
      const x = x0 + (r() - .5) * 2.4, direction = Math.atan2(riverZ(x + 1) - riverZ(x - 1), 2);
      placed = add('driftwood', x, riverZ(x) + bank * (5.3 + r() * 2.0), .7 + r() * .65,
        -direction + (r() - .5) * .7, r()) || placed;
    }
    if (placed) stats.clusters++;
  }

  for (const [key, bin] of bins) {
    const p = prototypes[bin.kind], mesh = new THREE.InstancedMesh(p.geometry, p.material, bin.matrices.length);
    mesh.name = `Riverbank | ${bin.kind} | ${key.split(':')[0]}`;
    bin.matrices.forEach((m, i) => { mesh.setMatrixAt(i, m); mesh.setColorAt(i, bin.colors[i]); });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.castShadow = bin.kind === 'driftwood'; mesh.receiveShadow = true;
    if (bin.kind === 'sedges' || bin.kind === 'reeds') mesh.onBeforeRender = () => { wind.value = performance.now() * .001; };
    mesh.computeBoundingBox(); mesh.computeBoundingSphere();
    group.add(mesh); stats.drawCalls++;
  }
  for (const key of ['minWaterClearance', 'minBankDistance', 'maxBankDistance', 'minBridgeDistance', 'minPathDistance'])
    stats[key] = Number.isFinite(stats[key]) ? Math.round(stats[key] * 1000) / 1000 : null;
  group.userData.riparian = Object.freeze(stats); scene.add(group);
  return group.userData.riparian;
}

/**
 * Original, deterministic breed grooms. Geometry is built in the horse skin's
 * rest coordinates (+X nose, +Y up, +Z across), then bound to its existing rig.
 * A lock has a closed elliptical section, a curved centreline, and a fine tip;
 * there are no alpha cards and no second skeleton to maintain.
 *
 * profile.anchors.{crest,tail}: arrays of rest-space [x,y,z] points.
 * profile.groom: style string or {style,maneLength,maneVolume,tailLength,feathering}.
 * Length/volume values are multipliers; feathering is 0..1.
 */
const grooveTextures = new WeakMap();

function random(seed) {
  let n = 2166136261;
  for (const c of String(seed)) n = Math.imul(n ^ c.charCodeAt(0), 16777619);
  return () => { n += 0x6D2B79F5; let x = n; x = Math.imul(x ^ x >>> 15, x | 1); x ^= x + Math.imul(x ^ x >>> 7, x | 61); return ((x ^ x >>> 14) >>> 0) / 4294967296; };
}

function grooveTexture(THREE) {
  if (grooveTextures.has(THREE)) return grooveTextures.get(THREE);
  const w = 128, h = 128, data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = x / w, v = y / h;
    const nx = .23 * Math.sin(u * Math.PI * 38 + .22 * Math.sin(v * Math.PI * 2))
      + .12 * Math.sin(u * Math.PI * 74 + .14 * Math.sin(v * Math.PI * 4));
    const ny = .025 * Math.cos(v * Math.PI * 2 + u * Math.PI * 6);
    const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny)), i = (y * w + x) * 4;
    data[i] = Math.round((nx * .5 + .5) * 255); data[i + 1] = Math.round((ny * .5 + .5) * 255);
    data[i + 2] = Math.round((nz * .5 + .5) * 255); data[i + 3] = 255;
  }
  const t = new THREE.DataTexture(data, w, h);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.needsUpdate = true;
  t.name = 'Original fine longitudinal hair grooves'; grooveTextures.set(THREE, t); return t;
}

export function createBreedGroom({ THREE, skin, bones = skin?.skeleton?.bones, mount,
  profile = {}, maneColor = '#30221a', tailColor = maneColor, featherColor, seed } = {}) {
  if (!THREE || !skin?.isSkinnedMesh || !bones?.length) throw new Error('Breed groom requires a skinned horse and its bones.');
  const breed = [profile.id, profile.breed, profile.name].filter(Boolean).join(' ').toLowerCase();
  const settings = profile.groom && typeof profile.groom === 'object' ? profile.groom : { style: profile.groom };
  const breedStyle = /fjord/.test(breed) ? 'upright' : /shire|clyde|gypsy|vanner/.test(breed) ? 'heavy' : /friesian|andalusian|lusitano/.test(breed) ? 'wavy' : 'natural';
  const requested = settings.style;
  const style = requested === 'long' ? (breedStyle === 'heavy' ? 'heavy' : 'wavy') : requested === 'sparse' ? 'natural' : requested || breedStyle;
  const upright = style === 'upright', wavy = style === 'wavy', heavy = style === 'heavy';
  const rng = random(seed ?? breed ?? 'horse'), V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const invBind = skin.bindMatrix.clone().invert();
  const rest = bones.map((b, i) => new THREE.Vector3().setFromMatrixPosition(
    new THREE.Matrix4().multiplyMatrices(invBind, skin.skeleton.boneInverses[i].clone().invert())));
  const stature = clamp(rest[5].distanceTo(rest[4]) / .368, .78, 1.28);
  const length = clamp(settings.maneLength ?? (requested === 'sparse' ? .78 : 1), .6, 1.45), volume = clamp(settings.maneVolume ?? (requested === 'sparse' ? .78 : 1), .7, 1.3);
  const tailLength = clamp(settings.tailLength ?? 1, .75, 1.18);
  const feathering = clamp(settings.feathering ?? (heavy ? 1 : /friesian/.test(breed) ? .35 : 0), 0, 1);
  const anchorArray = name => (profile.anchors?.[name] || []).map(p => Array.isArray(p) ? V(...p) : V(p.x, p.y, p.z));
  let crest = anchorArray('crest');
  if (crest.length < 2) {
    // Fallback samples the upper neck of the rest mesh. New breed assets provide
    // explicit anatomical anchors, avoiding their ears and removed solid mane.
    const p = skin.geometry.attributes.position;
    for (let k = 0; k <= 17; k++) {
      const x = rest[5].x - .01 - k / 17 * (rest[5].x - rest[4].x + .26);
      let y = -Infinity, z = 0;
      for (let i = 0; i < p.count; i++) if (Math.abs(p.getX(i) - x) < .025 && Math.abs(p.getZ(i)) < .13 && p.getY(i) > y) { y = p.getY(i); z = p.getZ(i); }
      if (Number.isFinite(y)) crest.push(V(x, y - .018, z * .25));
    }
  }
  if (crest.length < 2) crest = [rest[5].clone().add(V(0, .11, 0)), rest[4].clone().add(V(-.1, .13, 0))];
  // Every anchor must run poll -> withers, even when a caller supplied the reverse.
  if (crest[0].x < crest[crest.length - 1].x) crest.reverse();
  const crestCurve = new THREE.CatmullRomCurve3(crest, false, 'centripetal');
  let tailAnchors = anchorArray('tail');
  if (tailAnchors.length < 2) {
    tailAnchors = [19, 20, 21, 22].filter(i => rest[i]).map(i => rest[i].clone());
    const last = tailAnchors.at(-1), before = tailAnchors.at(-2);
    tailAnchors.push(last.clone().add(last.clone().sub(before).multiplyScalar(.91)));
  }
  const tailCurve = new THREE.CatmullRomCurve3(tailAnchors, false, 'centripetal');
  const buffers = () => ({ p: [], uv: [], color: [], pale: [], si: [], sw: [], index: [], seams: [], locks: 0 });
  const maneData = buffers(), tailData = buffers(), featherData = buffers();

  const nearestWeights = (point, candidates) => {
    const selected = candidates.filter(i => rest[i]).map(i => [i, 1 / Math.max(.012, point.distanceTo(rest[i])) ** 4])
      .sort((a, b) => b[1] - a[1]).slice(0, 2);
    const sum = selected.reduce((s, p) => s + p[1], 0);
    return { indices: [selected[0][0], selected[1]?.[0] || 0, 0, 0], weights: [selected[0][1] / sum, (selected[1]?.[1] || 0) / sum, 0, 0] };
  };
  const tailWeights = point => {
    let best = Infinity, result;
    for (let i = 19; i < 22; i++) {
      const a = rest[i], b = rest[i + 1], ab = b.clone().sub(a);
      const t = clamp(point.clone().sub(a).dot(ab) / ab.lengthSq(), 0, 1);
      const d = point.distanceToSquared(a.clone().addScaledVector(ab, t));
      if (d < best) { best = d; result = { indices: [i, i + 1, 0, 0], weights: [1 - t, t, 0, 0] }; }
    }
    return result;
  };

  function lock(out, points, width, { sides = 5, rows = 10, flat = .36, shade = .9, pale = 0, weights, twist = 0, wideAxis, full = false } = {}) {
    const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
    const frames = curve.computeFrenetFrames(rows, false), start = out.p.length / 3;
    const phase = rng() * Math.PI * 2;
    for (let r = 0; r <= rows; r++) {
      const t = r / rows, c = curve.getPoint(t), tangent = frames.tangents[r];
      let f = frames.normals[r], b = frames.binormals[r];
      if (wideAxis) {
        const projected = wideAxis.clone().addScaledVector(tangent, -wideAxis.dot(tangent));
        if (projected.lengthSq() > .001) { f = projected.normalize(); b = new THREE.Vector3().crossVectors(tangent, f).normalize(); }
      }
      // Narrow roots disappear into the surface, mid-lock volume overlaps its
      // neighbours, and the last two rings end in a fine irregular hair tip.
      const taper = full ? (.90 - .18 * t) * Math.pow(1 - t, .24) + .012
        : Math.pow(1 - t, .64) * (.68 + .48 * Math.sin(Math.PI * Math.min(1, t * 2))) + .018;
      const half = width * .5 * taper;
      const wt = typeof weights === 'function' ? weights(c, t) : weights;
      for (let s = 0; s <= sides; s++) {
        const theta = s / sides * Math.PI * 2 + twist * t;
        const ripple = 1 + .075 * Math.sin(t * Math.PI * 5 + phase + theta * 2);
        const p = c.clone().addScaledVector(f, Math.cos(theta) * half * ripple)
          .addScaledVector(b, Math.sin(theta) * half * flat * ripple);
        out.p.push(p.x, p.y, p.z); out.uv.push(s / sides, t * (1.1 + phase * .07));
        const value = shade * (.94 + .06 * Math.sin(theta + .6)) * (1 - .075 * t);
        out.color.push(value, value, value); out.pale.push(pale);
        out.si.push(...wt.indices); out.sw.push(...wt.weights);
      }
      out.seams.push([start + r * (sides + 1), start + r * (sides + 1) + sides]);
    }
    for (let r = 0; r < rows; r++) for (let s = 0; s < sides; s++) {
      const a = start + r * (sides + 1) + s, b = a + sides + 1;
      out.index.push(a, a + 1, b, a + 1, b + 1, b);
    }
    // Close the root and tip; tapered strips stay solid from every view.
    for (let s = 1; s < sides - 1; s++) {
      out.index.push(start, start + s + 1, start + s);
      const end = start + rows * (sides + 1); out.index.push(end, end + s, end + s + 1);
    }
    out.locks++;
  }

  const maneLengthAt = t => ((wavy ? .34 : heavy ? .31 : .215) + (wavy ? .14 : .10) * Math.sin(t * Math.PI)) * length * stature;
  function flowPoint(t, u, l, side = 1, phase = 0) {
    const p = crestCurve.getPoint(clamp(t, 0, 1));
    const wave = (wavy ? .014 : .004) * Math.sin(u * Math.PI * 2.4 + t * 7 + phase) * Math.sin(u * Math.PI);
    p.x += -l * .10 * u + wave;
    p.y -= l * u + .006 * stature;
    p.z += side * stature * (.123 * Math.sin(u * Math.PI * .5) + .018 * Math.sin(u * Math.PI)) + wave * .35;
    return p;
  }
  if (!upright) {
    // A thin, CLOSED organic volume gives the mane its continuous mass. Its
    // curved surface follows the neck; shorter, uneven hems remain beneath the
    // longer individual wisps. It is neither a flat sheet nor an alpha curtain.
    const cols = 30, rows = 8, start = maneData.p.length / 3;
    for (let face = 0; face < 2; face++) for (let c = 0; c <= cols; c++) {
      const t = c / cols, l = maneLengthAt(t) * (.77 + .035 * Math.sin(t * 31) + .022 * Math.sin(t * 73));
      const wt = nearestWeights(crestCurve.getPoint(t), [3, 4, 5]);
      for (let r = 0; r <= rows; r++) {
        const u = r / rows, p = flowPoint(t, u, l);
        const thickness = (.005 + .007 * Math.sin(u * Math.PI)) * stature * Math.sin(Math.PI * (.06 + t * .88));
        p.z += (face ? -1 : 1) * thickness;
        const shade = .91 + .035 * Math.sin(t * 71 + u * 2.3) + .018 * Math.sin(t * 179);
        maneData.p.push(p.x, p.y, p.z); maneData.uv.push(t * 5.7, u * 1.2);
        maneData.color.push(shade, shade, shade); maneData.pale.push(0);
        maneData.si.push(...wt.indices); maneData.sw.push(...wt.weights);
      }
    }
    const plane = (cols + 1) * (rows + 1), ix = (face, c, r) => start + face * plane + c * (rows + 1) + r;
    for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
      const a = ix(0, c, r), b = ix(0, c + 1, r), d = a + 1, e = b + 1;
      maneData.index.push(a, d, b, d, e, b);
      const a2 = a + plane, b2 = b + plane, d2 = d + plane, e2 = e + plane;
      maneData.index.push(a2, b2, d2, d2, b2, e2);
    }
    for (let c = 0; c < cols; c++) for (const r of [0, rows]) {
      const a = ix(0, c, r), b = ix(0, c + 1, r), d = ix(1, c, r), e = ix(1, c + 1, r);
      if (!r) maneData.index.push(a, b, d, b, e, d); else maneData.index.push(a, d, b, b, d, e);
    }
    for (let r = 0; r < rows; r++) for (const c of [0, cols]) {
      const a = ix(0, c, r), b = a + 1, d = ix(1, c, r), e = d + 1;
      if (!c) maneData.index.push(a, d, b, b, d, e); else maneData.index.push(a, b, d, b, e, d);
    }
    maneData.locks++;
  }
  const nMane = upright ? 68 : wavy ? 88 : heavy ? 82 : 80;
  for (let i = 0; i < nMane; i++) {
    const t = clamp((i + (rng() - .5) * .95) / (nMane - 1), 0, 1), root = crestCurve.getPoint(t);
    const wt = nearestWeights(root, [3, 4, 5]), side = upright && i % 2 ? -1 : 1;
    root.y -= .007 * stature; root.z += (rng() - .5) * .014 * stature;
    const shade = .89 + rng() * .10;
    if (upright) {
      const h = (.065 + .068 * Math.sin(t * Math.PI)) * length * stature;
      const edge = i % 3 !== 0; root.z += edge ? (i % 2 ? 1 : -1) * .019 : 0;
      lock(maneData, [root, root.clone().add(V(-.008, h * .65, side * .014)), root.clone().add(V(-.017, h, side * .013))],
        (.023 + rng() * .008) * volume * stature, { rows: 4, sides: 4, flat: .35, shade, pale: edge ? 1 : 0, weights: wt, wideAxis: V(1, 0, 0) });
    } else {
      const fine = i % 5 === 0, l = maneLengthAt(t) * (.84 + rng() * .27), phase = rng() * Math.PI * 2;
      const drift = (rng() - .5) * .028 * stature, surfaceOffset = (.003 + rng() * .016) * stature, points = [];
      for (let k = 0; k <= 5; k++) {
        const u = k / 5, p = flowPoint(t, u, l, 1, phase);
        p.x += drift * u; p.z += surfaceOffset * Math.sin(u * Math.PI * .8);
        points.push(p);
      }
      lock(maneData, points, (fine ? .007 + rng() * .004 : .018 + rng() * .009) * volume * stature,
        { rows: 6, sides: 4, flat: .14 + rng() * .12, shade, weights: wt, twist: (rng() - .5) * .25, wideAxis: V(1, 0, 0) });
    }
  }

  // A narrow layered forelock follows the poll and forehead, staying clear of eyes.
  const poll = crestCurve.getPoint(0);
  for (let i = 0; i < (upright ? 9 : 17); i++) {
    const z = (i - (upright ? 4 : 8)) * .005 * stature, root = poll.clone().add(V(.016, -.005, z));
    const l = (upright ? .13 : wavy ? .25 : .19) * stature * (.80 + rng() * .27);
    lock(maneData, [root, root.clone().add(V(l * .30, .009, z * .1)), root.clone().add(V(l * .7, -l * .40, z * .40)), root.clone().add(V(l * .93, -l * .88, z * .55))],
      .015 * volume * stature, { rows: 5, sides: 4, flat: .20, shade: .9 + rng() * .09, pale: upright && i % 3 !== 0 ? 1 : 0, weights: nearestWeights(root, [5, 6]), wideAxis: V(0, 0, 1) });
  }

  // Tail locks share the articulated dock, following the actual rest tail curve.
  // Offset envelopes widen gradually and converge into unequal, freely hanging tips.
  // Three overlapping softly lobed inner volumes carry the tail mass. Numerous
  // finer strands on the outside vary in length, width, phase and final spread.
  for (let j = 0; j < 3; j++) {
    const points = [];
    for (let k = 0; k <= 6; k++) {
      const u = k / 6, p = tailCurve.getPoint(Math.min(1, u * tailLength * (.88 + j * .028)));
      p.z += (j - 1) * .021 * stature + Math.sin(u * 4.6 + j) * .009 * u;
      p.x -= .011 * j * u + .025 * u * u; points.push(p);
    }
    lock(tailData, points, (.101 - j * .013) * volume * stature,
      { rows: 12, sides: 7, flat: .70, shade: .92 + j * .015, weights: tailWeights, full: true });
  }
  const nTail = wavy ? 72 : heavy ? 68 : 64;
  for (let i = 0; i < nTail; i++) {
    const angle = i * Math.PI * (3 - Math.sqrt(5)) + (rng() - .5) * .5, layer = .76 + rng() * .28;
    const reach = (.80 + rng() * .22) * tailLength, points = [], phase = rng() * Math.PI * 2;
    const fine = i % 5 === 0, lean = (rng() - .5) * .034 * stature;
    for (let k = 0; k <= 6; k++) {
      const t = k / 6, onCurve = tailCurve.getPoint(Math.min(1, t * reach));
      if (t * reach > 1) onCurve.y -= (t * reach - 1) * .8 * stature;
      const radius = (.024 + .034 * Math.sin(t * Math.PI * .83)) * layer * volume * stature;
      const wave = Math.sin(t * Math.PI * (wavy ? 3.1 : 1.8) + phase) * (wavy ? .017 : .009) * t;
      onCurve.z += Math.cos(angle + .12 * Math.sin(t * 3 + phase)) * radius + wave + lean * t * t;
      onCurve.x += Math.sin(angle) * radius * .78 - t * t * .025 * stature + wave * .35;
      if (k === 0) onCurve.y += (rng() - .5) * .02 * stature;
      points.push(onCurve);
    }
    lock(tailData, points, (fine ? .005 + rng() * .004 : .013 + rng() * .009) * volume * stature,
      { rows: 8, sides: 4, flat: .26, shade: .90 + rng() * .09, weights: tailWeights, twist: (rng() - .5) * .45 });
  }

  if (feathering > .02) {
    const nFeather = Math.round(9 + feathering * 13);
    for (const [bone, before, hoof] of [[11, 10, 12], [17, 16, 18], [26, 25, 27], [31, 30, 32]]) {
      if (!rest[bone] || !rest[hoof]) continue;
      const centre = rest[bone], hoofPoint = rest[hoof], wt = { indices: [bone, before, 0, 0], weights: [.82, .18, 0, 0] };
      const hoofWidth = (.036 + .038 * feathering) * stature;
      for (let i = 0; i < nFeather; i++) {
        const a = i / nFeather * Math.PI * 2 + rng() * .23, drop = (.085 + feathering * .13) * stature * (.78 + rng() * .29);
        const radial = V(Math.cos(a), 0, Math.sin(a));
        const root = centre.clone().addScaledVector(radial, hoofWidth * .65).add(V(0, (.04 + feathering * .035 + rng() * .028) * stature, 0));
        const end = root.clone().addScaledVector(radial, hoofWidth * (.70 + rng() * .4));
        end.x += .02 * stature; end.y = Math.max(hoofPoint.y - .045 * stature, root.y - drop);
        lock(featherData, [root, root.clone().addScaledVector(radial, hoofWidth * .34).add(V(0, -drop * .43, 0)), end],
          (.029 + .022 * feathering) * stature, { rows: 4, sides: 4, flat: .42, shade: .78 + rng() * .20, weights: wt, wideAxis: V(-Math.sin(a), 0, Math.cos(a)) });
      }
    }
  }

  const paleColor = new THREE.Color(settings.paleColor || '#dfd4b6');
  function material(color, name) {
    const m = new THREE.MeshPhysicalMaterial({ color, roughness: .72, metalness: 0, vertexColors: true,
      normalMap: grooveTexture(THREE), normalScale: new THREE.Vector2(.24, .12),
      anisotropy: .42, anisotropyRotation: Math.PI * .5, specularIntensity: .35, sheen: .12, sheenRoughness: .8 });
    m.name = name; m.userData.paleColor = paleColor;
    m.onBeforeCompile = shader => {
      shader.uniforms.groomPaleColor = { value: paleColor };
      shader.vertexShader = 'attribute float groomPale; varying float vGroomPale;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvGroomPale = groomPale;');
      shader.fragmentShader = 'uniform vec3 groomPaleColor; varying float vGroomPale;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, groomPaleColor * vColor.rgb, vGroomPale);');
    };
    m.customProgramCacheKey = () => 'breed-groom-closed-locks-v1'; return m;
  }
  const meshes = [];
  function make(data, color, name) {
    if (!data.locks) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(data.p, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(data.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(data.color, 3));
    g.setAttribute('groomPale', new THREE.Float32BufferAttribute(data.pale, 1));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(data.si, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(data.sw, 4));
    g.setIndex(data.index); g.computeVertexNormals();
    // UVs wrap around each lock. Average duplicated seam normals so that a
    // highlight travels continuously around the closed hair cross-section.
    const normal = g.attributes.normal;
    for (const [a, b] of data.seams) {
      const n = V(normal.getX(a) + normal.getX(b), normal.getY(a) + normal.getY(b), normal.getZ(a) + normal.getZ(b)).normalize();
      normal.setXYZ(a, n.x, n.y, n.z); normal.setXYZ(b, n.x, n.y, n.z);
    }
    g.computeBoundingSphere();
    const mesh = new THREE.SkinnedMesh(g, material(color, name)); mesh.name = name;
    mesh.position.copy(skin.position); mesh.quaternion.copy(skin.quaternion); mesh.scale.copy(skin.scale);
    mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
    skin.parent.add(mesh); mesh.bind(skin.skeleton, skin.bindMatrix); meshes.push(mesh); return mesh;
  }
  const mane = make(maneData, maneColor, `${breed || style} sculpted mane and forelock`);
  const tail = make(tailData, tailColor, `${breed || style} articulated flowing tail`);
  const feathers = make(featherData, featherColor ?? (/friesian/.test(breed) ? maneColor : '#e2d7c6'), `${breed || style} pastern feathering`);
  const stats = { style, locks: maneData.locks + tailData.locks + featherData.locks,
    triangles: (maneData.index.length + tailData.index.length + featherData.index.length) / 3,
    drawCalls: meshes.length, feathering, coordinateSpace: 'skin-local rest, X nose / Y up / Z across' };
  return { mane, tail, feathers, meshes, stats,
    setColors(colors = {}) {
      if (colors.maneColor !== undefined) mane.material.color.set(colors.maneColor);
      if (colors.tailColor !== undefined) tail.material.color.set(colors.tailColor);
      if (colors.featherColor !== undefined && feathers) feathers.material.color.set(colors.featherColor);
      if (colors.paleColor !== undefined) paleColor.set(colors.paleColor);
    },
    // Existing skeletal tail and neck motion drives every lock, including shadows.
    update() {},
    dispose() { for (const m of meshes) { m.removeFromParent(); m.geometry.dispose(); m.material.dispose(); } }
  };
}

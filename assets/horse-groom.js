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
  const restPosition = skin.geometry.attributes.position;
  // Exact upward-facing triangle intersections keep roots on the surface.
  // A compact X/Z grid avoids ray-testing the entire horse for every lock.
  const topCell=.03*stature, topGrid=new Map(), skinIndex=skin.geometry.index;
  const minTopX=Math.min(...crest.map(p=>p.x))-.06*stature;
  const maxTopX=Math.max(...crest.map(p=>p.x))+.38*stature;
  const minTopY=Math.min(...crest.map(p=>p.y))-.18*stature;
  const minTopZ=Math.min(...crest.map(p=>p.z))-.12*stature;
  const maxTopZ=Math.max(...crest.map(p=>p.z))+.12*stature;
  const topKey=(x,z)=>`${x},${z}`, nTop=skinIndex?skinIndex.count:restPosition.count;
  for(let k=0;k<nTop;k+=3){
    const ids=[0,1,2].map(j=>skinIndex?skinIndex.getX(k+j):k+j);
    const xs=ids.map(i=>restPosition.getX(i)),ys=ids.map(i=>restPosition.getY(i)),zs=ids.map(i=>restPosition.getZ(i));
    if(Math.max(...xs)<minTopX||Math.min(...xs)>maxTopX||Math.max(...ys)<minTopY||Math.max(...zs)<minTopZ||Math.min(...zs)>maxTopZ)continue;
    const dx=xs[1]-xs[0],dz=zs[1]-zs[0],ex=xs[2]-xs[0],ez=zs[2]-zs[0],det=dx*ez-ex*dz;
    if(Math.abs(det)<1e-10)continue;
    const tri=[xs[0],zs[0],dx,dz,ex,ez,ys[0],ys[1]-ys[0],ys[2]-ys[0],1/det];
    const x0=Math.floor(Math.max(minTopX,Math.min(...xs))/topCell),x1=Math.floor(Math.min(maxTopX,Math.max(...xs))/topCell);
    const z0=Math.floor(Math.max(minTopZ,Math.min(...zs))/topCell),z1=Math.floor(Math.min(maxTopZ,Math.max(...zs))/topCell);
    for(let x=x0;x<=x1;x++)for(let z=z0;z<=z1;z++){const key=topKey(x,z);if(!topGrid.has(key))topGrid.set(key,[]);topGrid.get(key).push(tri);}
  }
  const meshTop=(p,ceiling=Infinity)=>{
    let top=-Infinity;
    for(const t of topGrid.get(topKey(Math.floor(p.x/topCell),Math.floor(p.z/topCell)))||[]){
      const x=p.x-t[0],z=p.z-t[1],u=(x*t[5]-t[4]*z)*t[9],v=(t[2]*z-x*t[3])*t[9];
      if(u<-.0001||v<-.0001||u+v>1.0001)continue;
      const y=t[6]+u*t[7]+v*t[8];
      if(y<ceiling&&Math.abs(y-p.y)<.22*stature)top=Math.max(top,y);
    }
    return Number.isFinite(top)?top:p.y;
  };
  // Enough samples to follow a newly sculpted crest between authored landmarks.
  const authoredCrest = new THREE.CatmullRomCurve3(crest, false, 'centripetal');
  crest = Array.from({length:25},(_,i)=>authoredCrest.getPoint(i/24));
  for (let i=0;i<crest.length;i++) {
    const c=crest[i];
    c.y = meshTop(c,i<3?c.y+.012*stature:Infinity) + .003 * stature;
  }
  const crestCurve = new THREE.CatmullRomCurve3(crest, false, 'centripetal');
  let tailAnchors = anchorArray('tail');
  if (tailAnchors.length < 2) {
    tailAnchors = [19, 20, 21, 22].filter(i => rest[i]).map(i => rest[i].clone());
    const last = tailAnchors.at(-1), before = tailAnchors.at(-2);
    tailAnchors.push(last.clone().add(last.clone().sub(before).multiplyScalar(.91)));
  }
  const tailCurve = new THREE.CatmullRomCurve3(tailAnchors, false, 'centripetal');
  // Bury the first hair rings slightly inside the anatomical dock. The offset
  // fades immediately, so the exit closes without inflating the visible tail.
  const dockInset=tailAnchors[0].clone().sub(tailAnchors[1]).normalize()
    .multiplyScalar(clamp(settings.dockInset??.024,0,.05)*stature);
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

  function lock(out, points, width, { sides = 5, rows = 10, flat = .36, shade = .9, pale = 0, weights, twist = 0, wideAxis, full = false, rootShade = 1 } = {}) {
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
      const endFade = 1 - THREE.MathUtils.smoothstep(t, .72, 1);
      const taper = full === 'soft' ? (.76 + .22 * Math.sin(t * Math.PI)) * Math.pow(1 - t, .22) * endFade + .008
        : full === 'plume' ? (.28 + .78 * Math.sin(Math.PI * Math.pow(t, .76))) * (1 - THREE.MathUtils.smoothstep(t, .83, 1)) + .012
        : full === 'trimmed' ? .88 - .25 * t : full ? (.90 - .18 * t) * Math.pow(1 - t, .24) + .012
        : Math.pow(1 - t, .64) * (.68 + .48 * Math.sin(Math.PI * Math.min(1, t * 2))) + .018;
      const half = width * .5 * taper;
      const wt = typeof weights === 'function' ? weights(c, t) : weights;
      for (let s = 0; s <= sides; s++) {
        const theta = s / sides * Math.PI * 2 + twist * t;
        const ripple = 1 + .075 * Math.sin(t * Math.PI * 5 + phase + theta * 2);
        const p = c.clone().addScaledVector(f, Math.cos(theta) * half * ripple)
          .addScaledVector(b, Math.sin(theta) * half * flat * ripple);
        out.p.push(p.x, p.y, p.z); out.uv.push(s / sides, t * (1.1 + phase * .07));
        const value = shade * (.96 + .04 * Math.sin(theta + .6)) * (1 - .025 * t) * THREE.MathUtils.lerp(rootShade, 1, THREE.MathUtils.smoothstep(t, 0, .38));
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

  const maneLengthAt = t => ((wavy ? .29 : heavy ? .27 : .185) + (wavy ? .17 : .10) * Math.sin(t * Math.PI)) * length * stature;
  // Project the inner groom just outside this breed's own neck surface. A fixed
  // side offset buried fine strands in the wider Shire neck and left bald gaps.
  const surfaceCell = .024 * stature, sideGrid = new Map(), skinPosition = skin.geometry.attributes.position;
  const gridKey = (x, y) => `${x},${y}`;
  const minCrestX = Math.min(...crest.map(p => p.x)) - .15 * stature, maxCrestX = Math.max(...crest.map(p => p.x)) + .045 * stature;
  for (let i = 0; i < skinPosition.count; i++) {
    const x = skinPosition.getX(i), y = skinPosition.getY(i), z = skinPosition.getZ(i);
    if (x < minCrestX || x > maxCrestX || y < rest[4].y - .40 * stature) continue;
    const key = gridKey(Math.floor(x / surfaceCell), Math.floor(y / surfaceCell));
    if (!sideGrid.has(key) || z > sideGrid.get(key)) sideGrid.set(key, z);
  }
  const surfaceZ = p => {
    const gx = p.x / surfaceCell - .5, gy = p.y / surfaceCell - .5, bx = Math.floor(gx), by = Math.floor(gy);
    let total = 0, weight = 0, envelope = -Infinity;
    for (let dx = -1; dx <= 2; dx++) for (let dy = -1; dy <= 2; dy++) {
      const z = sideGrid.get(gridKey(bx + dx, by + dy)); if (z === undefined) continue;
      const w = 1 / (.30 + (gx - bx - dx) ** 2 + (gy - by - dy) ** 2);
      total += z * w; weight += w; envelope = Math.max(envelope, z);
    }
    return weight ? Math.max(total / weight, envelope - .006 * stature) : -Infinity;
  };
  function flowPoint(t, u, l, side = 1, phase = 0) {
    const p = crestCurve.getPoint(clamp(t, 0, 1));
    const wave = (wavy ? .038 : .018) * Math.sin(u * Math.PI * 2.1 + t * 5.2 + phase) * Math.sin(u * Math.PI);
    p.x += -l * .24 * u + wave;
    p.y -= l * u + .006 * stature;
    p.z += side * stature * (.12 * Math.sin(u * Math.PI * .5) + .026 * Math.sin(u * Math.PI)) + wave * .46;
    if (side > 0 && u > .001) p.z = Math.max(p.z, surfaceZ(p) + .021 * stature);
    return p;
  }
  if (!upright) {
    // A thin, CLOSED organic volume gives the mane its continuous mass. Its
    // curved surface follows the neck; shorter, uneven hems remain beneath the
    // longer individual wisps. It is neither a flat sheet nor an alpha curtain.
    const cols = 30, rows = 12, start = maneData.p.length / 3;
    for (let face = 0; face < 2; face++) for (let c = 0; c <= cols; c++) {
      const t = c / cols, l = maneLengthAt(t) * (.43 + .085 * Math.sin(t * 21) + .035 * Math.sin(t * 47));
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
      maneData.index.push(a, b, d, d, b, e);
      const a2 = a + plane, b2 = b + plane, d2 = d + plane, e2 = e + plane;
      maneData.index.push(a2, d2, b2, d2, e2, b2);
    }
    for (let c = 0; c < cols; c++) for (const r of [0, rows]) {
      const a = ix(0, c, r), b = ix(0, c + 1, r), d = ix(1, c, r), e = ix(1, c + 1, r);
      if (!r) maneData.index.push(a, d, b, b, d, e); else maneData.index.push(a, b, d, b, e, d);
    }
    for (let r = 0; r < rows; r++) for (const c of [0, cols]) {
      const a = ix(0, c, r), b = a + 1, d = ix(1, c, r), e = d + 1;
      if (!c) maneData.index.push(a, b, d, b, e, d); else maneData.index.push(a, d, b, b, d, e);
    }
    maneData.locks++;
  }
  const nMane = upright ? 84 : wavy ? 96 : heavy ? 90 : 84;
  for (let i = 0; i < nMane; i++) {
    const t = upright ? clamp(((i % 28)+(rng()-.5)*.64)/27,0,1) : clamp((i + (rng() - .5) * .95) / (nMane - 1), 0, 1), root = crestCurve.getPoint(t);
    const wt = nearestWeights(root, [3, 4, 5]), side = upright && i % 2 ? -1 : 1;
    root.y -= .007 * stature; root.z += (rng() - .5) * .014 * stature;
    const shade = .89 + rng() * .10;
    if (upright) {
      const layer = Math.floor(i / 28), edge = layer !== 1;
      const h = (.063 + .067 * Math.sin(t * Math.PI)) * length * stature * (edge ? .77 : 1);
      root.z += (layer - 1) * .018 * stature;
      lock(maneData, [root, root.clone().add(V(-.008, h * .65, 0)), root.clone().add(V(-.017, h, 0))],
        (.040+rng()*.014) * volume * stature, { rows: 4, sides: 4, flat: .38, shade, pale: edge ? 1 : 0, weights: wt, wideAxis: V(1, 0, 0), full: 'trimmed' });
    } else {
      const fine = i % 6 === 0, l = maneLengthAt(t) * (.57 + rng() * .60), phase = Math.floor(i / 7) * .55 + (rng() - .5) * .35;
      const drift = (rng() - .5) * .064 * stature, surfaceOffset = (.012 + rng() * .022) * stature, points = [];
      for (let k = 0; k <= 7; k++) {
        const u = k / 7, p = flowPoint(t, u, l, 1, phase);
        p.x += drift * u * u; p.z += surfaceOffset * Math.sin(u * Math.PI * .8);
        points.push(p);
      }
      lock(maneData, points, (fine ? .010 + rng() * .006 : .029 + rng() * .019) * volume * stature,
        { rows: 8, sides: 4, flat: .24 + rng() * .15, shade, weights: wt, twist: (rng() - .5) * .65, wideAxis: V(1, 0, 0), full: fine ? false : 'soft', rootShade: .88 });
    }
  }

  // A narrow layered forelock follows the poll and forehead, staying clear of eyes.
  const poll = anchorArray('poll')[0] || crestCurve.getPoint(0), eyes = anchorArray('eyes');
  const eyeCentre = eyes.length ? eyes.reduce((p,q)=>p.add(q),V()).multiplyScalar(1/eyes.length) : poll.clone().add(V(.18,-.16,0));
  const brow = eyeCentre.clone(); brow.x += .012 * stature; brow.y += .048 * stature;
  const foreheadY = p => meshTop(p,poll.y+.002*stature)+.003*stature;
  for (let i = 0; i < (upright ? 9 : 26); i++) {
    const across=(rng()-.5)*.080*stature, root=poll.clone().add(V(-.007,0,across*.55)), points=[];
    const reach=(upright?.58:.76)+rng()*(upright?.22:.34), lean=(rng()-.5)*.04*stature;
    for(let k=0;k<=5;k++){const u=k/5,p=root.clone().lerp(brow,u*reach);p.z+=across*u+lean*Math.sin(u*Math.PI);p.y=foreheadY(p)+Math.sin(u*Math.PI)*.002*stature;points.push(p);}
    lock(maneData,points,(.015+rng()*.012)*volume*stature,
      {rows:6,sides:4,flat:.28,shade:.9+rng()*.09,pale:upright&&Math.abs(across)>.018*stature?1:0,weights:nearestWeights(root,[5,6]),wideAxis:V(0,0,1),full:'soft',rootShade:.85});
  }

  // Tail locks share the articulated dock, following the actual rest tail curve.
  // Offset envelopes widen gradually and converge into unequal, freely hanging tips.
  // Three overlapping softly lobed inner volumes carry the tail mass. Numerous
  // finer strands on the outside vary in length, width, phase and final spread.
  for (let j = 0; j < 3; j++) {
    const points = [];
    for (let k = 0; k <= 6; k++) {
      const u = k / 6, p = tailCurve.getPoint(Math.min(1, u * tailLength * (.88 + j * .028)));
      p.addScaledVector(dockInset,Math.exp(-u*10));
      p.z += (j - 1) * .035 * stature * Math.sin(u*Math.PI*.85) + Math.sin(u * 4.6 + j) * .015 * u;
      p.x -= .013 * j * u + .043 * u * u; points.push(p);
    }
    lock(tailData, points, (.205 - j * .024) * volume * stature,
      { rows: 12, sides: 7, flat: .70, shade: .91 + j * .015, weights: tailWeights, full: 'plume' });
  }
  const nTail = wavy || heavy ? 84 : 76;
  for (let i = 0; i < nTail; i++) {
    const angle = i * Math.PI * (3 - Math.sqrt(5)) + (rng() - .5) * .5, layer = .76 + rng() * .28;
    const reach = (.69 + rng() * .35) * tailLength, points = [], phase = Math.floor(i/8)*.45+(rng()-.5)*.4;
    const fine = i % 6 === 0, lean = (rng() - .5) * .065 * stature;
    for (let k = 0; k <= 8; k++) {
      const t = k / 8, onCurve = tailCurve.getPoint(Math.min(1, t * reach));
      onCurve.addScaledVector(dockInset,Math.exp(-t*10));
      if (t * reach > 1) onCurve.y -= (t * reach - 1) * .8 * stature;
      const radius = (.026 + .080 * Math.sin(t * Math.PI * .88)) * layer * volume * stature;
      const wave = Math.sin(t * Math.PI * (wavy ? 2.8 : 1.7) + phase) * (wavy ? .026 : .018) * t;
      onCurve.z += Math.cos(angle + .12 * Math.sin(t * 3 + phase)) * radius + wave + lean * t * t;
      onCurve.x += Math.sin(angle) * radius * .78 - t * t * .045 * stature + wave * .65;
      // Root caps share one recessed exit; irregularity begins below the dock.
      if(k===0)rng(); // Keep the existing deterministic strand/feather sequence.
      points.push(onCurve);
    }
    lock(tailData, points, (fine ? .009 + rng() * .006 : .026 + rng() * .017) * volume * stature,
      { rows: 10, sides: 4, flat: .32, shade: .87 + rng() * .12, weights: tailWeights, twist: (rng() - .5) * .7,full:fine?false:'soft',rootShade:.85 });
  }

  if (feathering > .02) {
    const nFeather = Math.round(32 + feathering * 48), innerCount=Math.round(4+6*feathering);
    for (const [bone, before, hoof] of [[11, 10, 12], [17, 16, 18], [26, 25, 27], [31, 30, 32]]) {
      if (!rest[bone] || !rest[hoof]) continue;
      const centre = rest[bone], hoofPoint = rest[hoof], wt = { indices: [bone, before, 0, 0], weights: [.82, .18, 0, 0] };
      const hoofWidth = (.036 + .038 * feathering) * stature;
      for (let i = 0; i < nFeather; i++) {
        const dense=i<innerCount;let a=i<nFeather*.76 ? Math.PI+(rng()-.5)*Math.PI*(dense?.92:1.02) : rng()*Math.PI*2;
        if(Math.cos(a)>.15&&rng()<.6)a=Math.PI-a;
        const back=(1-Math.cos(a))*.5, drop = (.065+feathering*.115)*(.34+back*.82)*stature*(.64+rng()*.46)*(dense?.76:1);
        const radial = V(Math.cos(a), 0, Math.sin(a));
        const root = centre.clone().addScaledVector(radial, hoofWidth*(.55+rng()*.18)).add(V(0,(-.013+back*.024+Math.pow(rng(),1.6)*(.036+back*.065))*stature,0));
        const end = root.clone().addScaledVector(radial, hoofWidth*(.25+rng()*.42));
        end.x += (.024-back*.04)*stature; end.y = Math.max(hoofPoint.y-.012*stature,root.y-drop);
        const m1=root.clone().addScaledVector(radial,hoofWidth*.32).add(V(-.008*back,-drop*.32,0));
        const m2=root.clone().lerp(end,.74).addScaledVector(radial,hoofWidth*.18).add(V(.007,-.008,0));
        lock(featherData,[root,m1,m2,end],(dense?.030+rng()*.010:.007+rng()*.007)*stature,
          {rows:dense?5:3,sides:dense?5:3,flat:dense?.32:.28,shade:(dense?.78:.87)+rng()*.11,weights:wt,wideAxis:V(-Math.sin(a),0,Math.cos(a)),full:'soft',rootShade:.65});
      }
    }
  }

  const paleColor = new THREE.Color(settings.paleColor || '#dfd4b6');
  function material(color, name) {
    const m = new THREE.MeshPhysicalMaterial({ color, roughness: .72, metalness: 0, vertexColors: true,
      normalMap: grooveTexture(THREE), normalScale: new THREE.Vector2(.18, .09),
      anisotropy: .64, anisotropyRotation: Math.PI * .5, specularIntensity: .38, sheen: .18, sheenRoughness: .72 });
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
  const feathers = make(featherData, featherColor ?? (/friesian/.test(breed) ? maneColor : '#c9bfad'), `${breed || style} pastern feathering`);
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

import {RESIDENT_BOULDER_ENVELOPE as E} from './snowpeak-boulder-envelope.mjs?v=snowpeak-boulder-contact-1';
// Pure numeric seating of a closed scanned boulder against the caller's actual
// piecewise-linear terrain. No Three objects, global RNG, geometry mutation,
// source placement constants, ray samples, or substitute floor are used.
const F = Math.fround;
const finite = Number.isFinite;
const fail = message => { throw new TypeError(message); };
// Deterministic complexity limits apply BEFORE each visibility allocation.
// They bound intermediate polygons as well as retained union pieces. Exceeding
// a limit rejects this optional model seat; it does not relax geometry/area.
const VISIBILITY_LIMITS = Object.freeze({polygonVertices:64, transientPieces:2048, coveredPieces:2048, piecesPerSubtraction:64, candidateSet:2048, gridReferences:16384, sourceFacets:5000, candidateVisits:200000, candidatePairs:100000, cutterEdges:200000, clipInputVertices:2000000, generatedVertices:1000000});
class VisibilityBudgetError extends RangeError {
  constructor(kind,value,budget) {
    super(`Boulder visible-area resource budget exceeded: ${kind} ${value} > ${VISIBILITY_LIMITS[kind]}; retain original model`);
    this.resourceBound=true;this.budget={kind,value,limits:{...VISIBILITY_LIMITS},counters:{...budget.counters},maxima:{...budget.maxima}};
  }
}
function visibilityBudget() {
  const budget={counters:{},maxima:{}};
  budget.check=(kind,value)=>{budget.maxima[kind]=Math.max(budget.maxima[kind]||0,value);if(value>VISIBILITY_LIMITS[kind])throw new VisibilityBudgetError(kind,value,budget);};
  budget.bump=(kind,n=1)=>{const value=(budget.counters[kind]||0)+n;budget.counters[kind]=value;budget.check(kind,value);};
  return budget;
}

function bounds(position) {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < position.length; i++) {
    const v = position[i]; if (!finite(v)) fail('Nonfinite boulder position');
    const a = i % 3; lo[a] = Math.min(lo[a], v); hi[a] = Math.max(hi[a], v);
  }
  return {lo, hi, size: hi.map((v, i) => v - lo[i])};
}

function signedArea(poly) {
  if (poly.length < 3) return 0;
  const a = poly[0]; let sum = 0;
  for (let i = 1; i < poly.length - 1; i++) {
    const b = poly[i], c = poly[i + 1];
    sum += (b[0] - a[0]) * (c[2] - a[2]) - (c[0] - a[0]) * (b[2] - a[2]);
  }
  return sum / 2;
}

function halfClip(poly, side, budget = null) {
  if (!poly.length) return [];
  budget?.check('polygonVertices',poly.length);
  budget?.bump('clipInputVertices',poly.length+1);
  const out = []; let prior = poly[poly.length - 1], dp = side(prior);
  const append=p=>{budget?.check('polygonVertices',out.length+1);budget?.bump('generatedVertices');out.push(p);};
  for (const p of poly) {
    const dc = side(p);
    if ((dp >= 0) !== (dc >= 0)) {
      const t = dp / (dp - dc);
      append([prior[0] + t * (p[0] - prior[0]), prior[1] + t * (p[1] - prior[1]), prior[2] + t * (p[2] - prior[2])]);
    }
    if (dc >= 0) append(p);
    prior = p; dp = dc;
  }
  return out.length >= 3 && Math.abs(signedArea(out)) > 0 ? out : [];
}

function subtract(poly, cutter, budget) {
  budget.check('polygonVertices',poly.length);budget.check('polygonVertices',cutter.length);
  const result = []; let inside = poly;
  for (let i = 0; i < cutter.length && inside.length; i++) {
    budget.bump('cutterEdges');
    const a = cutter[i], b = cutter[(i + 1) % cutter.length];
    const side = p => (b[0] - a[0]) * (p[2] - a[2]) - (b[2] - a[2]) * (p[0] - a[0]);
    const outside = halfClip(inside, p => -side(p), budget);
    if (outside.length) {budget.check('piecesPerSubtraction',result.length+1);result.push(outside);}
    inside = halfClip(inside, side, budget);
  }
  return result;
}

function plane(tri) {
  const [a, b, c] = tri;
  const det = (b[0] - a[0]) * (c[2] - a[2]) - (c[0] - a[0]) * (b[2] - a[2]);
  if (det === 0) return null;
  const A = ((b[1] - a[1]) * (c[2] - a[2]) - (c[1] - a[1]) * (b[2] - a[2])) / det;
  const B = ((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])) / det;
  return [A, B, a[1] - A * a[0] - B * a[2]];
}

const boxOf = p => [Math.min(...p.map(v => v[0])), Math.min(...p.map(v => v[2])), Math.max(...p.map(v => v[0])), Math.max(...p.map(v => v[2]))];
const overlap = (a, b) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
function gridKeys(box, cell, visit) {
  for (let ix = Math.floor(box[0] / cell), ex = Math.floor(box[2] / cell); ix <= ex; ix++)
    for (let iz = Math.floor(box[1] / cell), ez = Math.floor(box[3] / cell); iz <= ez; iz++) visit(`${ix},${iz}`);
}

function triangles(position, index) {
  const out = [];
  for (let i = 0; i < index.length; i += 3) {
    let tri = [0, 1, 2].map(k => Array.from(position.subarray(index[i + k] * 3, index[i + k] * 3 + 3)));
    const p = plane(tri); if (!p) continue;
    if (signedArea(tri) < 0) tri = [tri[0], tri[2], tri[1]];
    out.push({tri, plane: p, box: boxOf(tri), face: i / 3});
  }
  return out;
}

function gridConfig({heights, segments, step, originX, originZ}) {
  if (!(heights instanceof Float32Array) || !Number.isInteger(segments) || segments < 1 || heights.length !== (segments + 1) ** 2 || !(step > 0) || !finite(step + originX + originZ)) fail('Actual finite canonical Float32 grid required');
  return {heights, segments, step, originX, originZ, size: segments + 1, cells: new Map()};
}

function eachCanonicalIntersection(poly, grid, visit) {
  const {step, segments, originX, originZ, heights: h, size} = grid, box = boxOf(poly);
  if (box[0] < originX || box[1] < originZ || box[2] > originX + segments * step || box[3] > originZ + segments * step) throw new RangeError('Entire boulder footprint must lie in actual canonical grid');
  const ix0 = Math.max(0, Math.floor((box[0] - originX) / step)), ix1 = Math.min(segments - 1, Math.floor((box[2] - originX) / step));
  const iz0 = Math.max(0, Math.floor((box[1] - originZ) / step)), iz1 = Math.min(segments - 1, Math.floor((box[3] - originZ) / step));
  for (let iz = iz0; iz <= iz1; iz++) for (let ix = ix0; ix <= ix1; ix++) {
    const key = iz * segments + ix;
    let cells = grid.cells.get(key);
    if (!cells) {
      const x = ix * step + originX, z = iz * step + originZ, n = iz * size + ix;
      const a = h[n], b = h[n + 1], c = h[n + size], d = h[n + size + 1];
      if (![a, b, c, d].every(finite)) fail('Nonfinite canonical terrain cell');
      cells = [[[x, a, z], [x + step, b, z], [x, c, z + step]], [[x + step, b, z], [x + step, d, z + step], [x, c, z + step]]].map(tri => ({tri, plane: plane(tri)}));
      grid.cells.set(key, cells);
    }
    for (let half = 0; half < 2; half++) {
      let clipped = poly; const cell = cells[half].tri;
      for (let k = 0; k < 3 && clipped.length; k++) {
        const p = cell[k], q = cell[(k + 1) % 3];
        clipped = halfClip(clipped, v => (q[0] - p[0]) * (v[2] - p[2]) - (q[2] - p[2]) * (v[0] - p[0]));
      }
      if (clipped.length) visit(clipped, cells[half].plane, [ix, iz, half]);
    }
  }
}

function worldPoint(p, m) {
  return [m[0] * p[0] + m[8] * p[2] + m[12], m[5] * p[1] + m[13], m[2] * p[0] + m[10] * p[2] + m[14]];
}

function clearance(polys, matrix, grid) {
  let minimum = Infinity, maximum = -Infinity, witness = null, intersections = 0, vertices = 0;
  for (const {face, poly} of polys) eachCanonicalIntersection(poly.map(p => worldPoint(p, matrix)), grid, (p, t, owner) => {
    intersections++;
    for (const v of p) {
      const ground = t[0] * v[0] + t[1] * v[2] + t[2], gap = v[1] - ground; vertices++;
      minimum = Math.min(minimum, gap);
      if (gap > maximum) { maximum = gap; witness = {face, canonicalFace: owner, point: v.slice(), ground}; }
    }
  });
  if (!finite(minimum + maximum)) fail('No actual boulder/terrain intersections');
  return {minimum, maximum, witness, intersections, vertices};
}

function validateMatrix(m) {
  if (!m || m.length !== 16 || !Array.from(m).every(finite)) fail('Finite boulder world matrix required');
  const s = m[5], eps = Math.max(1, Math.abs(s)) * 1e-10;
  if (!(s > 0) || [m[1], m[3], m[4], m[6], m[7], m[9], m[11], m[15] - 1, m[0] - m[10], m[8] + m[2], Math.hypot(m[0], m[2]) - s].some(v => Math.abs(v) > eps)) fail('Boulder must retain positive uniform scale and yaw-only world transform');
  return s;
}

function validateGeometry(position, index, label) {
  if (!(position instanceof Float32Array) || position.length < 9 || position.length % 3 || !index || !index.length || index.length % 3 || index.length > 300000) fail(`${label} indexed Float32 geometry required`);
  const count = position.length / 3;
  for (const i of index) if (!Number.isInteger(i) || i < 0 || i >= count) fail(`${label} index outside position buffer`);
  return bounds(position);
}

// A conservative admission measure: exact union of projected facet portions
// at least 5cm above terrain, stopped as soon as the required area is proven.
// This is neither sparse plan sampling nor a circle/mesh parity certificate.
function proveVisibleArea(tris, matrix, grid, requiredArea) {
  const budget=visibilityBudget();
  const covered = [], cells = new Map(), cell = Math.max(.1, Math.sqrt(requiredArea));
  let area = 0, clippedFacets = 0;
  for (const t of tris) {
    budget.bump('sourceFacets');
    let done = false;
    eachCanonicalIntersection(t.tri.map(p => worldPoint(p, matrix)), grid, (poly, terrain) => {
      if (done) return;
      const visible = halfClip(poly, p => p[1] - (terrain[0] * p[0] + terrain[1] * p[2] + terrain[2]) - .05, budget);
      if (!visible.length) return;
      clippedFacets++;
      const candidates = new Set(), box = boxOf(visible);
      gridKeys(box, cell, k => { for (const j of cells.get(k) || []) {budget.bump('candidateVisits');candidates.add(j);budget.check('candidateSet',candidates.size);} });
      let pieces = [visible];
      for (const j of candidates) {
        budget.bump('candidatePairs');
        const old = covered[j]; if (!overlap(box, old.box)) continue;
        const next = [];
        for (const p of pieces) for (const q of subtract(p, old.poly, budget)) if (Math.abs(signedArea(q)) > 1e-12) {budget.check('transientPieces',next.length+1);next.push(q);}
        pieces = next;
        if (!pieces.length) break;
      }
      for (const p of pieces) {
        const nextBox = boxOf(p), i = covered.length;
        budget.check('coveredPieces',covered.length+1);covered.push({poly: p, box: nextBox}); area += Math.abs(signedArea(p));
        gridKeys(nextBox, cell, k => { budget.bump('gridReferences');if (!cells.has(k)) cells.set(k, []); cells.get(k).push(i); });
      }
      if (area >= requiredArea) done = true;
    });
    if (area >= requiredArea) return {accepted: true, provenAreaLowerBound: area, requiredArea, clippedFacets, unionPieces: covered.length, completeUnion: false, heightThreshold: .05};
  }
  return {accepted: false, provenAreaLowerBound: area, requiredArea, clippedFacets, unionPieces: covered.length, completeUnion: true, heightThreshold: .05};
}

/** Returns transform parameters only. Apply, in order, translate(-cx,-minY,-cz),
 * scale(q,q,q), translate(0,localYShift,0) to a private Float32 geometry clone.
 * All source buffers and the original Mesh/world matrix remain unchanged.
 * Throws on invalid input; callers should retain the original model on failure.
 */
export function planSnowpeakBoulderSeating({sourcePositions, sourceIndex, scanPositions, scanIndex, matrixWorld, heights, segments = 512, step = 1000 / 512, originX = -500, originZ = -500, burial = .025}) {
  const original = validateGeometry(sourcePositions, sourceIndex, 'Original boulder'), scan = validateGeometry(scanPositions, scanIndex, 'Resident scan');
  const scale = validateMatrix(matrixWorld), grid = gridConfig({heights, segments, step, originX, originZ});
  if (!(burial >= .005 && burial <= .1)) fail('Boulder burial must be between 5mm and 100mm');
  const q = Math.max(original.size[0], original.size[2]) / Math.max(scan.size[0], scan.size[2]);
  if (!(q > 0 && q < 100) || !(original.size[1] > 0) || !(scan.size[1] > 0)) fail('Degenerate boulder extent');
  const cx = (scan.lo[0] + scan.hi[0]) / 2, cz = (scan.lo[2] + scan.hi[2]) / 2;
  const normalized = new Float32Array(scanPositions.length);
  for (let i = 0; i < normalized.length; i += 3) {
    normalized[i] = F(F(scanPositions[i] - cx) * q);
    normalized[i + 1] = F(F(scanPositions[i + 1] - scan.lo[1]) * q);
    normalized[i + 2] = F(F(scanPositions[i + 2] - cz) * q);
  }
  if (normalized.length !== E.position.length || scanIndex.length !== E.index.length) fail('Resident scan source changed; lower-envelope packet is not applicable');
  for (let i = 0; i < normalized.length; i++) if (!Object.is(normalized[i], E.position[i])) fail('Resident normalized Float32 geometry differs from lower-envelope source');
  for (let i = 0; i < scanIndex.length; i++) if (scanIndex[i] !== E.index[i]) fail('Resident source topology differs from lower-envelope source');
  const tris = triangles(normalized, scanIndex), initialPlanes = new Map(tris.map(t => [t.face, t.plane]));
  const pieces = [];
  for (let i = 0; i < E.faces.length; i++) {
    const face = E.faces[i], p = initialPlanes.get(face), poly = [];
    for (let j = E.offsets[i]; j < E.offsets[i + 1]; j++) {
      const x = E.xz[j * 2], z = E.xz[j * 2 + 1]; poly.push([x, p[0] * x + p[1] * z + p[2], z]);
    }
    pieces.push({face, poly});
  }
  const arrangement = {pieces, comparisons: 0};
  const before = clearance(arrangement.pieces, matrixWorld, grid);
  // Ten micrometres keeps the numerical arrangement tolerance and Float32
  // translation error inside the requested burial, rather than claiming exact
  // arithmetic. The actual post-Float32 facet bound below must still pass.
  let localYShift = (-before.maximum - burial - .00001) / scale;
  const shifted = normalized.slice();
  for (let i = 1; i < shifted.length; i += 3) shifted[i] = F(normalized[i] + localYShift);
  const shiftedTris = triangles(shifted, scanIndex), byFace = new Map(shiftedTris.map(t => [t.face, t.plane]));
  // XZ remains byte exact. At every XZ covered by an old lower-envelope piece,
  // the true new lower envelope is <= the shifted height of that same face.
  // Thus clipping these shifted source-face planes gives a conservative upper
  // bound even if a Float32 rounding tie changes which face is lowest.
  const shiftedPieces = arrangement.pieces.map(({face, poly}) => {
    const p = byFace.get(face);
    return {face, poly: poly.map(v => [v[0], p[0] * v[0] + p[1] * v[2] + p[2], v[2]])};
  });
  const after = clearance(shiftedPieces, matrixWorld, grid);
  if (after.maximum > -burial + 1e-7) throw new RangeError('Actual Float32 translated lower-surface bound failed requested burial');
  const all = clearance(shiftedTris.map(t => ({face: t.face, poly: t.tri})), matrixWorld, grid);
  const requiredArea = .02 * Math.max(original.size[0], original.size[2]) ** 2 * scale ** 2;
  let visibility;
  try {visibility=proveVisibleArea(shiftedTris,matrixWorld,grid,requiredArea);}
  catch(error) {
    if(!error.resourceBound)throw error;
    visibility={accepted:false,resourceBound:true,reason:error.message,budget:error.budget,provenAreaLowerBound:0,requiredArea,clippedFacets:null,unionPieces:null,completeUnion:false,heightThreshold:.05};
  }
  const minimumVisibleHeight = Math.max(original.size[1], scan.size[1] * q) * scale * .25;
  const accepted = visibility.accepted && all.maximum >= minimumVisibleHeight;
  return {profile: 'snowpeak-boulder-canonical-seating-1', accepted,
    status: visibility.resourceBound ? 'RETAIN_ORIGINAL_VISIBILITY_RESOURCE_BUDGET_EXCEEDED' : accepted ? 'NUMERIC_SEATING_AND_MINIMUM_VISIBILITY_PASS_REQUIRES_NATIVE_ART_REVIEW' : 'RETAIN_ORIGINAL_SCAN_WOULD_BE_NEAR_INVISIBLE',
    ...(visibility.resourceBound?{resourceBound:true,reason:visibility.reason}:{}),
    localScale: q, centerXZ: [cx, cz], sourceMinY: scan.lo[1], localYShift,
    metrics: {originalVertices: sourcePositions.length / 3, scanVertices: scanPositions.length / 3, scanTriangles: scanIndex.length / 3, lowerEnvelopePolygons: arrangement.pieces.length, arrangementComparisons: arrangement.comparisons, before, afterConservativeUpperBound: after, actualAllFacetGap: all, visibility, minimumVisibleHeight, burial, numericalReserve: .00001, rootScale: scale,
      method: 'Offline resident-geometry projected facet arrangement, actual normalized Float32 source/topology checked, clipped against every overlapped actual canonical terrain triangle; no sparse contact samples',
      contactScope: 'Numeric seating only; separate transaction must register actual replaced geometry and retire the old approximate circle atomically; no radial/mesh parity claim'}};
}

/**
 * Validation-only distance oracle for the canonical terrain triangles.
 *
 * This deliberately does not reuse the production swept-sphere equations. It
 * measures a finite segment against each candidate triangle using a ray/face
 * intersection, both endpoint/triangle distances, and all three finite
 * segment/edge distances. THREE supplies the ray and point/triangle routines;
 * the finite segment/segment routine below is a closest-points calculation.
 * Allocation is intentional here: this module is not part of the camera loop.
 */

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

/** Squared distance between two finite segments, including degenerate ones. */
function segmentSegmentDistanceSquared(p, q, aPoint, bPoint) {
  const ux = q.x - p.x;
  const uy = q.y - p.y;
  const uz = q.z - p.z;
  const vx = bPoint.x - aPoint.x;
  const vy = bPoint.y - aPoint.y;
  const vz = bPoint.z - aPoint.z;
  const wx = p.x - aPoint.x;
  const wy = p.y - aPoint.y;
  const wz = p.z - aPoint.z;
  const uu = ux * ux + uy * uy + uz * uz;
  const vv = vx * vx + vy * vy + vz * vz;
  const uv = ux * vx + uy * vy + uz * vz;
  const uw = ux * wx + uy * wy + uz * wz;
  const vw = vx * wx + vy * wy + vz * wz;
  let s = 0;
  let t = 0;

  if (uu === 0 && vv === 0) {
    return wx * wx + wy * wy + wz * wz;
  }
  if (uu === 0) {
    t = clamp01(vw / vv);
  } else if (vv === 0) {
    s = clamp01(-uw / uu);
  } else {
    const determinant = uu * vv - uv * uv;
    // A nonpositive result also covers roundoff in the parallel case. Starting
    // with s=0 is valid there; the subsequent endpoint clamping finds the
    // closest pair on the finite segments.
    if (determinant > 0) s = clamp01((uv * vw - uw * vv) / determinant);
    t = (uv * s + vw) / vv;
    if (t < 0) {
      t = 0;
      s = clamp01(-uw / uu);
    } else if (t > 1) {
      t = 1;
      s = clamp01((uv - uw) / uu);
    }
  }

  const dx = wx + s * ux - t * vx;
  const dy = wy + s * uy - t * vy;
  const dz = wz + s * uz - t * vz;
  return dx * dx + dy * dy + dz * dz;
}

function requireFinitePoint(point, name) {
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y) || !Number.isFinite(point.z)) {
    throw new TypeError(`${name} must have finite x, y, and z coordinates`);
  }
}

/**
 * Return the minimum segment/terrain distance within a certified candidate box.
 *
 * Grid rows run along +Z and columns along +X. Each cell uses the anti-diagonal
 * split: triangle 0 is (00, 10, 01), i.e. local u+v<=1; triangle 1 is
 * (10, 11, 01). Heights are read afresh on every invocation.
 *
 * candidateBound defaults to 1 world unit. We scan all cells intersecting the
 * segment's entire XZ bounding box expanded by that amount, with NO Y reject.
 * Every excluded triangle is at least candidateBound away in X or Z alone.
 * Consequently:
 *   - distance is the exact minimum among the scanned triangles;
 *   - exact=true means that minimum is also the global terrain minimum;
 *   - distanceLowerBound is ALWAYS a valid global lower bound, even if distance
 *     is Infinity because no cell was scanned;
 *   - candidateBound: Infinity requests the exact global minimum unconditionally.
 *
 * A clearance proof should inspect distanceLowerBound, not an uncertified
 * distance greater than candidateBound. owner identifies the scanned minimum.
 */
export function canonicalSegmentDistance(
  { THREE, heights, segments, step, originX = 0, originZ = 0 },
  origin,
  end,
  { candidateBound = 1 } = {},
) {
  if (!THREE?.Vector3 || !THREE?.Triangle || !THREE?.Ray) {
    throw new TypeError('THREE must provide Vector3, Triangle, and Ray');
  }
  if (!Number.isInteger(segments) || segments < 1 || !Number.isFinite(step) || step <= 0) {
    throw new RangeError('segments must be a positive integer and step must be positive and finite');
  }
  if (!Number.isFinite(originX) || !Number.isFinite(originZ)) {
    throw new RangeError('terrain origin must be finite');
  }
  const stride = segments + 1;
  if (!heights || heights.length < stride * stride) {
    throw new RangeError('heights must contain the complete (segments + 1) squared grid');
  }
  if (!(candidateBound >= 0) || (candidateBound !== Infinity && !Number.isFinite(candidateBound))) {
    throw new RangeError('candidateBound must be nonnegative and finite, or Infinity');
  }
  requireFinitePoint(origin, 'origin');
  requireFinitePoint(end, 'end');

  const startPoint = new THREE.Vector3(origin.x, origin.y, origin.z);
  const endPoint = new THREE.Vector3(end.x, end.y, end.z);
  const direction = endPoint.clone().sub(startPoint);
  const segmentLength = direction.length();
  if (segmentLength !== 0) direction.multiplyScalar(1 / segmentLength);
  const ray = new THREE.Ray(startPoint, direction);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const triangle = new THREE.Triangle(a, b, c);
  const closest = new THREE.Vector3();
  const hit = new THREE.Vector3();

  let minCellX = 0;
  let minCellZ = 0;
  let maxCellX = segments - 1;
  let maxCellZ = segments - 1;
  if (candidateBound !== Infinity) {
    minCellX = Math.max(0, Math.floor((Math.min(origin.x, end.x) - candidateBound - originX) / step));
    minCellZ = Math.max(0, Math.floor((Math.min(origin.z, end.z) - candidateBound - originZ) / step));
    maxCellX = Math.min(segments - 1, Math.floor((Math.max(origin.x, end.x) + candidateBound - originX) / step));
    maxCellZ = Math.min(segments - 1, Math.floor((Math.max(origin.z, end.z) + candidateBound - originZ) / step));
  }

  let bestSquared = Infinity;
  let owner = null;
  let candidateCells = 0;
  let candidateTriangles = 0;

  function inspectTriangle(cellX, cellZ, triangleIndex, indexA, indexB, indexC) {
    candidateTriangles += 1;
    let distanceSquared = Infinity;
    if (segmentLength !== 0 && ray.intersectTriangle(a, b, c, false, hit)) {
      const along = (hit.x - startPoint.x) * direction.x
        + (hit.y - startPoint.y) * direction.y
        + (hit.z - startPoint.z) * direction.z;
      if (along >= 0 && along <= segmentLength) distanceSquared = 0;
    }
    if (distanceSquared !== 0) {
      triangle.closestPointToPoint(startPoint, closest);
      distanceSquared = startPoint.distanceToSquared(closest);
      triangle.closestPointToPoint(endPoint, closest);
      distanceSquared = Math.min(
        distanceSquared,
        endPoint.distanceToSquared(closest),
        segmentSegmentDistanceSquared(startPoint, endPoint, a, b),
        segmentSegmentDistanceSquared(startPoint, endPoint, b, c),
        segmentSegmentDistanceSquared(startPoint, endPoint, c, a),
      );
    }
    if (distanceSquared < bestSquared) {
      bestSquared = distanceSquared;
      owner = { cellX, cellZ, triangle: triangleIndex, indices: [indexA, indexB, indexC] };
    }
  }

  for (let cellZ = minCellZ; cellZ <= maxCellZ; cellZ += 1) {
    const z0 = originZ + cellZ * step;
    for (let cellX = minCellX; cellX <= maxCellX; cellX += 1) {
      candidateCells += 1;
      const x0 = originX + cellX * step;
      const i00 = cellZ * stride + cellX;
      const i10 = i00 + 1;
      const i01 = i00 + stride;
      const i11 = i01 + 1;
      const h00 = heights[i00];
      const h10 = heights[i10];
      const h01 = heights[i01];
      const h11 = heights[i11];
      if (![h00, h10, h01, h11].every(Number.isFinite)) {
        throw new RangeError(`nonfinite terrain height in cell (${cellX}, ${cellZ})`);
      }

      a.set(x0, h00, z0);
      b.set(x0 + step, h10, z0);
      c.set(x0, h01, z0 + step);
      inspectTriangle(cellX, cellZ, 0, i00, i10, i01);

      a.set(x0 + step, h10, z0);
      b.set(x0 + step, h11, z0 + step);
      c.set(x0, h01, z0 + step);
      inspectTriangle(cellX, cellZ, 1, i10, i11, i01);
    }
  }

  const distance = Math.sqrt(bestSquared);
  const allCellsScanned = minCellX === 0 && minCellZ === 0
    && maxCellX === segments - 1 && maxCellZ === segments - 1;
  return {
    distance,
    owner,
    exact: allCellsScanned || (Number.isFinite(distance) && distance <= candidateBound),
    distanceLowerBound: Math.min(distance, candidateBound),
    candidateBound,
    outsideCandidateLowerBound: allCellsScanned ? Infinity : candidateBound,
    candidateCells,
    candidateTriangles,
    candidateBounds: { minCellX, maxCellX, minCellZ, maxCellZ },
  };
}

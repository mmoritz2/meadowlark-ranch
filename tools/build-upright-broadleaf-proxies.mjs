// Rebuild conservative upright broadleaf wood boxes; exact final model SHA and semantic wood role.
// Same Sutherland-Hodgman clip-to-cell algorithm as build-woodland-wood-proxies.mjs.
// Run: node tools/build-upright-broadleaf-proxies.mjs
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

export const SOURCE_FILE = 'assets/models/world/realism/upright_broadleaf_01.glb';
export const SOURCE_SHA = '5393f0c370b385920b840850881d4fbb25afc965f3e1dc24bda596572476b538';
const SOURCE_HEIGHT = 9.425189882516861;
const SOURCE_FOOT = -.24277201294898987;
const CELL_SIDE = .15, PADDING = .011, ROUND = 1e6;

function readGLB(raw) {
  if (raw.length < 20 || raw.readUInt32LE(0) !== 0x46546c67 ||
      raw.readUInt32LE(4) !== 2 || raw.readUInt32LE(8) !== raw.length) {
    throw Error('Invalid GLB header');
  }
  let json, bin;
  for (let offset = 12; offset < raw.length;) {
    const length = raw.readUInt32LE(offset), type = raw.readUInt32LE(offset + 4);
    const end = offset + 8 + length;
    if (end > raw.length) throw Error('Invalid GLB chunk');
    const chunk = raw.subarray(offset + 8, end);
    if (type === 0x4e4f534a) json = JSON.parse(chunk.toString('utf8'));
    if (type === 0x004e4942) bin = chunk;
    offset = end;
  }
  if (!json || !bin) throw Error('Missing GLB JSON/BIN');
  if (json.nodes.length !== 1 || json.nodes[0].mesh !== 0 ||
      json.nodes[0].matrix || json.nodes[0].translation ||
      json.nodes[0].rotation || json.nodes[0].scale) {
    throw Error('Unexpected source transform: contact table requires the identity frame');
  }
  function accessor(id) {
    const a = json.accessors[id], view = json.bufferViews[a?.bufferView];
    const components = {SCALAR: 1, VEC3: 3}[a?.type];
    const format = {5126: ['readFloatLE', 4], 5125: ['readUInt32LE', 4],
      5123: ['readUInt16LE', 2]}[a?.componentType];
    if (!view || !components || !format || a.sparse || a.normalized || view.buffer !== 0) {
      throw Error('Unsupported source accessor');
    }
    const offset = (view.byteOffset || 0) + (a.byteOffset || 0);
    const stride = view.byteStride || components * format[1];
    if (stride < components * format[1] ||
        offset + (a.count - 1) * stride + components * format[1] > bin.length) {
      throw Error('Invalid source accessor bounds');
    }
    const rows = [];
    for (let i = 0; i < a.count; i++) {
      const row = [];
      for (let c = 0; c < components; c++) {
        row.push(bin[format[0]](offset + i * stride + c * format[1]));
      }
      rows.push(row);
    }
    return rows;
  }
  return {json, accessor};
}

// Sutherland-Hodgman clipping. A triangle may contribute to several XYZ cells;
// each cell encloses its actual clipped fragments rather than a whole branch.
function clip(poly, axis, cut, above) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const ai = above ? a[axis] >= cut : a[axis] <= cut;
    const bi = above ? b[axis] >= cut : b[axis] <= cut;
    if (ai) out.push(a);
    if (ai !== bi) {
      const t = (cut - a[axis]) / (b[axis] - a[axis]);
      out.push(a.map((v, k) => v + (b[k] - v) * t));
    }
  }
  return out;
}

export function buildUprightBroadleafWoodProxies(raw) {
  const sourceSha256 = crypto.createHash('sha256').update(raw).digest('hex');
  if (sourceSha256 !== SOURCE_SHA) throw Error('Unexpected Upright Broadleaf source SHA');
  const {json, accessor} = readGLB(raw), cells = new Map(), parts = [];
  let triangles = 0, fragments = 0;
  for (const primitive of json.meshes[0].primitives) {
    const material = json.materials[primitive.material];
    if (material.name !== 'upright_hybrid_tree_small_02_trunk') continue;
    if ((primitive.mode ?? 4) !== 4) throw Error('Opaque source is not triangles');
    const vertices = accessor(primitive.attributes.POSITION);
    const indices = accessor(primitive.indices).flat();
    if (indices.length % 3) throw Error('Incomplete source triangle');
    parts.push({material: material.name, triangles: indices.length / 3, vertices: vertices.length});
    triangles += indices.length / 3;
    for (let i = 0; i < indices.length; i += 3) {
      const tri = indices.slice(i, i + 3).map(j => {
        if (!Number.isInteger(j) || j < 0 || j >= vertices.length) throw Error('Invalid source index');
        return vertices[j];
      });
      if (tri.some(p => p.length !== 3 || p.some(v => !Number.isFinite(v)))) {
        throw Error('Nonfinite opaque source triangle');
      }
      const lo = [0, 1, 2].map(a => Math.floor(Math.min(...tri.map(p => p[a])) / CELL_SIDE));
      const hi = [0, 1, 2].map(a => Math.floor(Math.max(...tri.map(p => p[a])) / CELL_SIDE));
      for (let x = lo[0]; x <= hi[0]; x++) for (let y = lo[1]; y <= hi[1]; y++) {
        for (let z = lo[2]; z <= hi[2]; z++) {
          const cell = [x, y, z];
          let poly = tri;
          for (let a = 0; a < 3 && poly.length; a++) {
            poly = clip(poly, a, cell[a] * CELL_SIDE, true);
            if (poly.length) poly = clip(poly, a, (cell[a] + 1) * CELL_SIDE, false);
          }
          if (poly.length < 3) continue;
          fragments++;
          const key = cell.join(',');
          const box = cells.get(key) || {cell, min: [Infinity, Infinity, Infinity],
            max: [-Infinity, -Infinity, -Infinity]};
          for (const p of poly) for (let a = 0; a < 3; a++) {
            box.min[a] = Math.min(box.min[a], p[a]);
            box.max[a] = Math.max(box.max[a], p[a]);
          }
          cells.set(key, box);
        }
      }
    }
  }
  const exactBoxes = [...cells.values()]
    .sort((a, b) => a.cell[0] - b.cell[0] || a.cell[1] - b.cell[1] || a.cell[2] - b.cell[2])
    .map(b => ({min: b.min.map(v => v - PADDING), max: b.max.map(v => v + PADDING)}));
  const boxes = exactBoxes.map(b => ({min: b.min.map(v => Math.floor(v * ROUND) / ROUND),
    max: b.max.map(v => Math.ceil(v * ROUND) / ROUND)}));
  if (triangles !== 1705 || boxes.length !== 1060 || parts.length !== 1) {
    throw Error('Unexpected opaque source topology/table count');
  }
  for (const b of boxes) for (let a = 0; a < 3; a++) {
    if (!Number.isFinite(b.min[a] + b.max[a]) || b.max[a] <= b.min[a] ||
        b.max[a] - b.min[a] > CELL_SIDE + 2 * PADDING + 2 / ROUND + 1e-10) {
      throw Error('Invalid fitted contact box');
    }
  }
  return {sourceSha256, sourceHeight: SOURCE_HEIGHT, cellSide: CELL_SIDE,
    padding: PADDING, parts, triangles, fragments, exactBoxes, boxes};
}

export function formatUprightBroadleafWoodProxies(data) {
  return `// Conservative wood contact table; no rendering geometry or random draws.
// CommonTree_3 wood: Quaternius, CC0-1.0, Stylized Nature MegaKit Standard.
// Original photographed leaf geometry: Tree Small 02, Rico Cilliers / Poly Haven, CC0-1.0.
// Tileable Bark Brown 02: Rob Tuytel / Poly Haven, CC0-1.0.
// Model rebuild: python3 tools/asset-gen/build-upright-broadleaf.py --source-archive /path/to/standard.zip
// Source: ${SOURCE_FILE}, SHA-256 ${data.sourceSha256}.
// Rebuild table: node tools/build-upright-broadleaf-proxies.mjs
// All 1,705 wood-role triangles, all heights; leaf material excluded by role, not alphaMode.
// .15-source-unit XYZ clipped fragments, ${data.padding} padding, rounded OUTWARD to six decimals.
// Padding keeps every fragment above the solid registry .02 m world-height minimum at authored scales.
// Pass COMPLETE union-foot-normalized tree matrix to a persistent solidParts owner.
export const UPRIGHT_HYBRID_WOOD_SOURCE_SHA=${JSON.stringify(data.sourceSha256)};
export const UPRIGHT_HYBRID_WOOD_SOURCE_HEIGHT=${SOURCE_HEIGHT};
export const UPRIGHT_HYBRID_WOOD_SOURCE_FOOT=${SOURCE_FOOT};
export const UPRIGHT_HYBRID_WOOD_CELL_SIDE=${data.cellSide};
export const UPRIGHT_HYBRID_WOOD_PADDING=${data.padding};
export const UPRIGHT_HYBRID_WOOD_BOXES=[
${data.boxes.map(b => '  {min:' + JSON.stringify(b.min) + ',max:' + JSON.stringify(b.max) + '},').join('\n')}
];
`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let root = fileURLToPath(new URL('../', import.meta.url)), output;
  for (let i = 2; i < process.argv.length; i++) {
    if (process.argv[i] === '--root' && process.argv[i + 1]) root = path.resolve(process.argv[++i]);
    else if (process.argv[i] === '--output' && process.argv[i + 1]) output = path.resolve(process.argv[++i]);
    else throw Error('Usage: node tools/build-upright-broadleaf-proxies.mjs [--root ROOT] [--output FILE]');
  }
  output ||= path.join(root, 'assets/upright-broadleaf-wood-proxies.mjs');
  const data = buildUprightBroadleafWoodProxies(fs.readFileSync(path.join(root, SOURCE_FILE)));
  fs.writeFileSync(output, formatUprightBroadleafWoodProxies(data));
  console.log(JSON.stringify({file: output, boxes: data.boxes.length, triangles: data.triangles,
    clippedFragments: data.fragments, sourceSha256: data.sourceSha256}));
}

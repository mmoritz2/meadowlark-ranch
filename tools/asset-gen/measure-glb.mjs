#!/usr/bin/env node
/* measure-glb.mjs — what a GLB actually costs.
 *
 * Dependency-free. Parses the GLB container by hand (12-byte header, then chunks:
 * uint32 length, uint32 type, payload) so it runs anywhere node runs, with no npm
 * install and no three.js. Reports per file: bytes on disk, triangles, draw calls,
 * accessor elements, every embedded image with its real pixel dimensions and codec,
 * and the glTF extensions declared.
 *
 * The point is to make "this barrel is 2.7 MB" into "this barrel is 2.7 MB because
 * it carries a 2048x2048 uncompressed PNG and 33,810 un-welded vertices".
 *
 *   node tools/asset-gen/measure-glb.mjs assets/models            # table
 *   node tools/asset-gen/measure-glb.mjs assets/models --json     # machine readable
 *   node tools/asset-gen/measure-glb.mjs a.glb b.glb              # named files
 *
 * Image dimensions come from the codec headers directly: PNG IHDR, JPEG SOFn,
 * WebP VP8/VP8L/VP8X, KTX2 level 0. An unknown codec is reported as such rather
 * than guessed at.
 */

import {readFileSync, statSync, readdirSync} from 'node:fs';
import {join, basename, extname, relative} from 'node:path';
import {createHash} from 'node:crypto';

/* ---------- GLB container ---------- */

const GLB_MAGIC = 0x46546c67;  // 'glTF'
const CHUNK_JSON = 0x4e4f534a; // 'JSON'
const CHUNK_BIN  = 0x004e4942; // 'BIN\0'

function readGLB(buf) {
  if (buf.length < 12) throw new Error('too short to be a GLB');
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  if (dv.getUint32(0, true) !== GLB_MAGIC) throw new Error('not a GLB (bad magic)');
  const version = dv.getUint32(4, true);
  const total = dv.getUint32(8, true);
  let off = 12, json = null, bin = null;
  while (off + 8 <= buf.length) {
    const len = dv.getUint32(off, true);
    const type = dv.getUint32(off + 4, true);
    const start = off + 8;
    if (start + len > buf.length) break;                 // truncated chunk; stop rather than throw
    if (type === CHUNK_JSON && json === null) json = JSON.parse(buf.subarray(start, start + len).toString('utf8'));
    else if (type === CHUNK_BIN && bin === null) bin = buf.subarray(start, start + len);
    off = start + len + ((4 - (len % 4)) % 4);           // chunks are 4-byte aligned
  }
  if (!json) throw new Error('no JSON chunk');
  return {version, declaredLength: total, json, bin};
}

/* ---------- image codecs: real dimensions, not the glTF mimeType's word for it ---------- */

function imageInfo(bytes) {
  const n = bytes.length;
  const u32be = o => (bytes[o] << 24 | bytes[o + 1] << 16 | bytes[o + 2] << 8 | bytes[o + 3]) >>> 0;
  const u32le = o => (bytes[o] | bytes[o + 1] << 8 | bytes[o + 2] << 16 | bytes[o + 3] << 24) >>> 0;

  // PNG: 8-byte signature then the IHDR chunk, which is always first.
  if (n > 24 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    const bitDepth = bytes[24], colorType = bytes[25];
    const channels = {0: 1, 2: 3, 3: 1, 4: 2, 6: 4}[colorType] ?? 0;
    return {codec: 'png', width: u32be(16), height: u32be(20), bitDepth, colorType, channels};
  }
  // JPEG: walk the marker segments to the frame header (SOF0/1/2/…, excluding DHT/JPG/DAC).
  if (n > 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let o = 2;
    while (o + 9 < n) {
      if (bytes[o] !== 0xff) { o++; continue; }
      const m = bytes[o + 1];
      if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { o += 2; continue; }
      const seg = (bytes[o + 2] << 8) | bytes[o + 3];
      const isSOF = m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc;
      if (isSOF) return {
        codec: 'jpeg',
        height: (bytes[o + 5] << 8) | bytes[o + 6],
        width: (bytes[o + 7] << 8) | bytes[o + 8],
        bitDepth: bytes[o + 4], channels: bytes[o + 9],
      };
      o += 2 + seg;
    }
    return {codec: 'jpeg', width: 0, height: 0};
  }
  // WebP: RIFF container, then one of the three VP8 flavours.
  if (n > 30 && bytes.subarray(0, 4).toString('latin1') === 'RIFF' && bytes.subarray(8, 12).toString('latin1') === 'WEBP') {
    const fourcc = bytes.subarray(12, 16).toString('latin1');
    if (fourcc === 'VP8 ') {   // lossy: 10-byte frame tag then 14-bit w/h
      return {codec: 'webp', variant: 'lossy',
        width: ((bytes[26] | bytes[27] << 8) & 0x3fff), height: ((bytes[28] | bytes[29] << 8) & 0x3fff)};
    }
    if (fourcc === 'VP8L') {   // lossless: 1 signature byte then 14+14 bits, minus one
      const b = u32le(21);
      return {codec: 'webp', variant: 'lossless', width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1};
    }
    if (fourcc === 'VP8X') {   // extended: 24-bit canvas size, minus one
      return {codec: 'webp', variant: 'extended',
        width: (bytes[24] | bytes[25] << 8 | bytes[26] << 16) + 1,
        height: (bytes[27] | bytes[28] << 8 | bytes[29] << 16) + 1};
    }
    return {codec: 'webp', variant: fourcc.trim(), width: 0, height: 0};
  }
  // KTX2: 12-byte identifier, then vkFormat/typeSize/pixelWidth/pixelHeight.
  if (n > 40 && bytes[0] === 0xab && bytes.subarray(1, 7).toString('latin1') === 'KTX 20') {
    return {codec: 'ktx2', vkFormat: u32le(12), width: u32le(20), height: u32le(24)};
  }
  if (n > 12 && bytes.subarray(4, 12).toString('latin1') === 'ftypavif') return {codec: 'avif', width: 0, height: 0};
  return {codec: 'unknown', width: 0, height: 0};
}

/* ---------- glTF accounting ---------- */

const COMPONENT_BYTES = {5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4};
const TYPE_COMPONENTS = {SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16};

function measure(path) {
  const buf = readFileSync(path);
  const bytes = buf.length;
  const sha256 = createHash('sha256').update(buf).digest('hex');
  let parsed;
  try { parsed = readGLB(buf); }
  catch (e) { return {file: basename(path), path, bytes, sha256, error: e.message}; }

  const {json, bin} = parsed;
  const acc = json.accessors || [], views = json.bufferViews || [];
  const meshes = json.meshes || [], images = json.images || [];

  // Triangles and primitives. A primitive is one draw call and — importantly for this
  // repo — one mesh/material pair, which is what placeFoliage() picks the first of.
  let tris = 0, prims = 0, meshCount = meshes.length;
  for (const m of meshes) for (const p of (m.primitives || [])) {
    prims++;
    const mode = p.mode === undefined ? 4 : p.mode;
    const count = p.indices !== undefined ? (acc[p.indices]?.count || 0)
                                          : (acc[p.attributes?.POSITION]?.count || 0);
    if (mode === 4) tris += count / 3;
    else if (mode === 5 || mode === 6) tris += Math.max(0, count - 2);
  }

  // Accessor elements: the honest measure of vertex-data bulk, independent of index reuse.
  let accElements = 0, accBytes = 0;
  for (const a of acc) {
    accElements += a.count || 0;
    accBytes += (a.count || 0) * (TYPE_COMPONENTS[a.type] || 0) * (COMPONENT_BYTES[a.componentType] || 0);
  }

  // Images: resolve the bufferView (or the data: URI) and read the real header.
  const imgs = images.map((img, i) => {
    let data = null;
    if (img.bufferView !== undefined && bin) {
      const bv = views[img.bufferView];
      if (bv) data = bin.subarray(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength);
    } else if (typeof img.uri === 'string' && img.uri.startsWith('data:')) {
      const c = img.uri.indexOf('base64,');
      if (c >= 0) data = Buffer.from(img.uri.slice(c + 7), 'base64');
    }
    const info = data ? imageInfo(data) : {codec: (img.mimeType || 'external').replace('image/', ''), width: 0, height: 0};
    return {index: i, name: img.name || '', mimeType: img.mimeType || '', bytes: data ? data.length : 0, ...info};
  });
  const imageBytes = imgs.reduce((s, x) => s + x.bytes, 0);

  return {
    file: basename(path), path, bytes, sha256,
    meshes: meshCount, primitives: prims, triangles: Math.round(tris),
    accessors: acc.length, accessorElements: accElements, accessorBytes: accBytes,
    materials: (json.materials || []).length,
    textures: (json.textures || []).length,
    images: imgs, imageCount: imgs.length, imageBytes,
    animations: (json.animations || []).length,
    joints: (json.skins || []).reduce((s, sk) => s + (sk.joints || []).length, 0),
    extensionsUsed: json.extensionsUsed || null,
    extensionsRequired: json.extensionsRequired || null,
    generator: json.asset?.generator || '',
  };
}

/* ---------- presentation ---------- */

const kb = n => (n / 1024).toFixed(0);
const mb = n => (n / 1048576).toFixed(2);
const pad = (s, w, right) => right ? String(s).padStart(w) : String(s).padEnd(w);

function imageSummary(r) {
  if (!r.images.length) return '-';
  // Collapse identical entries: "2048x2048 png" x3 reads better than three rows.
  const counts = new Map();
  for (const im of r.images) {
    const key = `${im.width}x${im.height} ${im.codec}${im.variant ? '/' + im.variant : ''}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts].map(([k, n]) => n > 1 ? `${n}x ${k}` : k).join(', ');
}

function table(rows) {
  const head = ['file', 'MB', 'tris', 'accessor elems', 'meshes/prims', 'images', 'image MB', 'extensions'];
  const body = rows.map(r => r.error
    ? [r.file, mb(r.bytes), 'ERR: ' + r.error, '', '', '', '', '']
    : [r.file, mb(r.bytes), r.triangles.toLocaleString(), r.accessorElements.toLocaleString(),
       `${r.meshes}/${r.primitives}`, imageSummary(r), mb(r.imageBytes),
       r.extensionsUsed ? r.extensionsUsed.join(' ') : '(none)']);
  const w = head.map((h, i) => Math.max(h.length, ...body.map(b => String(b[i]).length)));
  const right = [false, true, true, true, true, false, true, false];
  const line = c => w.map((x, i) => c.repeat(x)).join('-+-');
  const out = [];
  out.push(head.map((h, i) => pad(h, w[i], right[i])).join(' | '));
  out.push(line('-'));
  for (const b of body) out.push(b.map((c, i) => pad(c, w[i], right[i])).join(' | '));
  out.push(line('-'));
  const tb = rows.reduce((s, r) => s + r.bytes, 0);
  const ti = rows.reduce((s, r) => s + (r.imageBytes || 0), 0);
  const tt = rows.reduce((s, r) => s + (r.triangles || 0), 0);
  out.push([pad(`TOTAL (${rows.length} files)`, w[0]), pad(mb(tb), w[1], true), pad(tt.toLocaleString(), w[2], true),
            pad('', w[3]), pad('', w[4]), pad('', w[5]), pad(mb(ti), w[6], true), ''].join(' | '));
  return out.join('\n');
}

/* ---------- entry ---------- */

function collect(target) {
  const st = statSync(target);
  if (st.isFile()) return [target];
  const out = [];
  const walk = d => {
    for (const e of readdirSync(d, {withFileTypes: true})) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (extname(e.name).toLowerCase() === '.glb') out.push(p);
    }
  };
  walk(target);
  return out.sort();
}

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const targets = args.filter(a => !a.startsWith('--'));
if (!targets.length) {
  console.error('usage: node tools/asset-gen/measure-glb.mjs <file-or-dir> [...] [--json]');
  process.exit(2);
}
const files = targets.flatMap(collect);
const rows = files.map(measure);
if (asJson) console.log(JSON.stringify(rows, null, 2));
else {
  console.log(table(rows));
  console.log('');
  const noExt = rows.filter(r => !r.error && !r.extensionsUsed).length;
  const bigImg = rows.flatMap(r => r.images || []).filter(i => i.width >= 2048).length;
  const pngBytes = rows.flatMap(r => r.images || []).filter(i => i.codec === 'png').reduce((s, i) => s + i.bytes, 0);
  console.log(`${noExt}/${rows.length} files declare no glTF extension at all (no Draco, no meshopt, no KTX2, no WebP).`);
  console.log(`${bigImg} embedded image(s) are 2048px or larger. Uncompressed PNG accounts for ${mb(pngBytes)} MB.`);
}

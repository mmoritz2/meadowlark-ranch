#!/usr/bin/env node
/* optimize-glb.mjs — make a GLB cost what it should, without changing how it loads.
 *
 * Every model in assets/models came out of image-to-3D and was written straight to
 * disk: no glTF extension of any kind, one uncompressed 2048x2048 PNG per prop, and
 * vertex data that was never welded. barrel_textured.glb was 2.7 MB for a barrel.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO — and why
 * --------------------------------------------
 * ranch3d.html constructs a bare `new GLTFLoader()`. It never calls setDRACOLoader,
 * setMeshoptDecoder or setKTX2Loader. So Draco, EXT_meshopt_compression and KTX2/Basis
 * are all unavailable: a file using them would fail to parse in the actual game, no
 * matter how well it compresses. The two things three.js r160 DOES decode with zero
 * configuration are EXT_texture_webp (auto-registered as a loader plugin) and
 * KHR_mesh_quantization (handled in GLTFLoader's own extension switch). Those are the
 * two levers this script pulls. See ASSET_PIPELINE.md for the exact ranch3d.html lines
 * that would unlock the others.
 *
 * ORDER, AND WHY IT IS THAT ORDER
 *   1. prune      drop unreferenced accessors, materials, textures and empty nodes
 *                 first, so nothing downstream spends effort on data nobody uses.
 *   2. dedup      collapse byte-identical accessors, meshes, textures and materials.
 *   3. weld       merge vertices that are identical within tolerance and build an
 *                 index. Image-to-3D output is un-indexed soup; this is where the
 *                 33,810 loose accessor elements in a 6,000-triangle barrel go.
 *   4. quantize   (opt-in, --quantize) float32 -> int16/int8 vertex attributes.
 *   5. texture    resize to a sane maximum, then re-encode as WebP. This is the whole
 *                 ball game for the props: ~90% of each prop file is one PNG.
 *
 * SAFETY RAIL FOR placeFoliage()
 * ranch3d.html's placeFoliage() takes the FIRST mesh it finds and its material, then
 * builds an InstancedMesh from that single geometry. Anything that splits, reorders or
 * merges meshes would silently change which prop you get. So `join`, `palette`,
 * `flatten` and `simplify` are NOT in this pipeline, and the script refuses to write a
 * file whose mesh/primitive count or first-mesh name changed. --quantize is off by
 * default for the same reason: it moves the dequantization scale onto the node
 * transform, which placeFoliage discards. See the checkFirstMesh() guard below.
 *
 * USAGE
 *   cd tools/asset-gen && npm install          # pins gltf-transform + sharp
 *   node optimize-glb.mjs ../../assets/models/barrel_textured.glb --out /tmp/try
 *   node optimize-glb.mjs ../../assets/models --props --in-place
 *   node optimize-glb.mjs ../../assets/models --max-texture 512 --quality 80 --out /tmp/try
 *
 * FLAGS
 *   --out <dir>        write beside the originals in <dir> (default: dry run only)
 *   --in-place         overwrite the source files (a .bak is NOT kept; use git)
 *   --max-texture <n>  longest texture edge after resize (default 1024)
 *   --quality <n>      WebP quality 1-100 (default 92)
 *   --near-lossless    WebP near-lossless mode; larger, for textures that band
 *   --quantize         enable KHR_mesh_quantization (see the warning above)
 *   --props            only the *_textured.glb props, not artist-breeds/
 *   --breeds           only artist-breeds/
 *   --manifest <file>  write a JSON before/after record (sizes + SHA-256)
 */

import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS, EXTTextureWebP, KHRMeshQuantization} from '@gltf-transform/extensions';
import {prune, dedup, weld, quantize, textureCompress, TextureResizeFilter} from '@gltf-transform/functions';
import sharp from 'sharp';
import {readFileSync, writeFileSync, mkdirSync, statSync, readdirSync, existsSync} from 'node:fs';
import {join, basename, dirname, extname, resolve} from 'node:path';
import {createHash} from 'node:crypto';

/* ---------- args ---------- */

const argv = process.argv.slice(2);
const flag = n => argv.includes('--' + n);
const val = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const targets = argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && ['--out', '--max-texture', '--quality', '--manifest'].includes(argv[i - 1])));

const OPT = {
  out: val('out', null),
  inPlace: flag('in-place'),
  maxTexture: parseInt(val('max-texture', '1024'), 10),
  quality: parseInt(val('quality', '92'), 10),
  nearLossless: flag('near-lossless'),
  quantize: flag('quantize'),
  manifest: val('manifest', null),
};

if (!targets.length) { console.error('usage: node optimize-glb.mjs <file-or-dir> [...] [--out dir | --in-place]'); process.exit(2); }

/* ---------- file selection ---------- */

function collect(target) {
  const st = statSync(target);
  if (st.isFile()) return [target];
  const out = [];
  const walk = d => {
    for (const e of readdirSync(d, {withFileTypes: true})) {
      const p = join(d, e.name);
      if (e.isDirectory()) { if (!flag('props')) walk(p); }
      else if (extname(e.name).toLowerCase() === '.glb') out.push(p);
    }
  };
  walk(target);
  return out.sort();
}
let files = targets.flatMap(collect);
if (flag('props')) files = files.filter(f => basename(f).endsWith('_textured.glb'));
if (flag('breeds')) files = files.filter(f => f.includes('artist-breeds'));

/* ---------- the loader-compatibility guard ---------- */

/* placeFoliage() reads the first mesh in traversal order. If an optimisation step
   changes which mesh that is, or how many there are, the prop silently becomes a
   different prop. Compare the shape of the document before and after and refuse the
   write rather than ship a file that loads into the wrong thing. */
function meshFingerprint(doc) {
  const root = doc.getRoot();
  const meshes = root.listMeshes();
  const skins = root.listSkins();
  return {
    meshCount: meshes.length,
    primCount: meshes.reduce((s, m) => s + m.listPrimitives().length, 0),
    meshNames: meshes.map(m => m.getName() || '(unnamed)'),
    firstMeshName: meshes[0] ? (meshes[0].getName() || '(unnamed)') : null,
    firstMaterialName: meshes[0]?.listPrimitives()[0]?.getMaterial()?.getName() ?? null,
    nodeCount: root.listNodes().length,
    // Rigged assets: one shared skin driving every mesh is the whole point. quantize()
    // splits it per-mesh, which leaves the mane and tail on their own skeletons while
    // the game animates only the body's bone map — a silent, severe visual break that
    // the mesh counts alone do not catch. Caught here instead.
    skinCount: skins.length,
    jointCounts: skins.map(s => s.listJoints().length),
    animationCount: root.listAnimations().length,
  };
}
function checkFirstMesh(before, after) {
  const problems = [];
  if (before.meshCount !== after.meshCount) problems.push(`mesh count ${before.meshCount} -> ${after.meshCount}`);
  if (before.primCount !== after.primCount) problems.push(`primitive count ${before.primCount} -> ${after.primCount}`);
  if (before.firstMeshName !== after.firstMeshName) problems.push(`first mesh "${before.firstMeshName}" -> "${after.firstMeshName}"`);
  if (before.firstMaterialName !== after.firstMaterialName) problems.push(`first material "${before.firstMaterialName}" -> "${after.firstMaterialName}"`);
  if (before.meshNames.join('|') !== after.meshNames.join('|')) problems.push(`mesh order/names changed: [${before.meshNames}] -> [${after.meshNames}]`);
  if (before.skinCount !== after.skinCount) problems.push(`skin count ${before.skinCount} -> ${after.skinCount} (a shared skeleton was split; the rig will not drive every mesh)`);
  if (before.jointCounts.join(',') !== after.jointCounts.join(',')) problems.push(`joints per skin [${before.jointCounts}] -> [${after.jointCounts}]`);
  if (before.animationCount !== after.animationCount) problems.push(`animation count ${before.animationCount} -> ${after.animationCount}`);
  return problems;
}

/* Bounding box of the first mesh's POSITION, in the mesh's own space. placeFoliage
   scales props by target_height / bbox_height, so a *uniform* change is harmless but a
   change in aspect ratio is not. Report both so --quantize can be judged, not guessed. */
function firstMeshBBox(doc) {
  const prim = doc.getRoot().listMeshes()[0]?.listPrimitives()[0];
  const pos = prim?.getAttribute('POSITION');
  if (!pos) return null;
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity], el = [0, 0, 0];
  for (let i = 0; i < pos.getCount(); i++) {
    pos.getElement(i, el);
    for (let k = 0; k < 3; k++) { if (el[k] < min[k]) min[k] = el[k]; if (el[k] > max[k]) max[k] = el[k]; }
  }
  return {min, max, size: [max[0] - min[0], max[1] - min[1], max[2] - min[2]]};
}

/* ---------- pipeline ---------- */

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const sha = b => createHash('sha256').update(b).digest('hex');
const mb = n => (n / 1048576).toFixed(3);

async function optimise(path) {
  const srcBytes = readFileSync(path);
  const doc = await io.read(path);

  const before = meshFingerprint(doc);
  const bboxBefore = firstMeshBBox(doc);

  const steps = [
    prune({keepAttributes: false, keepLeaves: false, keepSolidTextures: false}),
    dedup(),
    // tolerance 0 = merge only bit-identical vertices. Anything looser moves geometry,
    // which is a modelling decision, not a compression one.
    weld({tolerance: 0}),
  ];
  if (OPT.quantize) {
    doc.createExtension(KHRMeshQuantization).setRequired(true);
    steps.push(quantize({
      quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12,
      quantizeColor: 8, quantizeWeight: 8,
    }));
  }
  steps.push(textureCompress({
    encoder: sharp,
    targetFormat: 'webp',
    resize: [OPT.maxTexture, OPT.maxTexture],
    resizeFilter: TextureResizeFilter.LANCZOS3,
    quality: OPT.quality,
    nearLossless: OPT.nearLossless,
    effort: 90,
  }));

  await doc.transform(...steps);
  // textureCompress registers EXT_texture_webp; three.js r160 auto-registers the
  // matching loader plugin, but it must not be *required* or a browser without WebP
  // would throw instead of falling back.
  for (const ext of doc.getRoot().listExtensionsUsed()) {
    if (ext.extensionName === EXTTextureWebP.EXTENSION_NAME) ext.setRequired(false);
  }

  const after = meshFingerprint(doc);
  const bboxAfter = firstMeshBBox(doc);
  const problems = checkFirstMesh(before, after);

  const outBytes = Buffer.from(await io.writeBinary(doc));

  // Aspect-ratio drift of the first mesh, which is the number placeFoliage cares about.
  let aspectDrift = null;
  if (bboxBefore && bboxAfter) {
    const rb = bboxBefore.size.map(v => v / (bboxBefore.size[1] || 1));
    const ra = bboxAfter.size.map(v => v / (bboxAfter.size[1] || 1));
    aspectDrift = Math.max(...rb.map((v, i) => Math.abs(v - ra[i])));
  }

  return {
    file: basename(path), path,
    bytesBefore: srcBytes.length, bytesAfter: outBytes.length,
    sha256Before: sha(srcBytes), sha256After: sha(outBytes),
    ratio: outBytes.length / srcBytes.length,
    before, after, problems, aspectDrift,
    buffer: outBytes,
  };
}

/* ---------- run ---------- */

const results = [];
for (const f of files) {
  process.stdout.write(basename(f).padEnd(28));
  let r;
  try { r = await optimise(f); }
  catch (e) { console.log('FAILED: ' + e.message); results.push({file: basename(f), path: f, error: e.message}); continue; }

  const pct = (100 * (1 - r.ratio)).toFixed(1);
  let line = `${mb(r.bytesBefore).padStart(8)} MB -> ${mb(r.bytesAfter).padStart(8)} MB  (-${pct}%)`;
  if (r.aspectDrift !== null && r.aspectDrift > 1e-3) line += `  aspect drift ${r.aspectDrift.toExponential(2)}`;
  console.log(line);

  if (r.problems.length) {
    console.log('  !! REFUSED — the document changed shape in a way the game depends on:');
    for (const p of r.problems) console.log('     ' + p);
    results.push({...r, buffer: undefined, written: null});
    continue;
  }

  let written = null;
  if (OPT.inPlace) { writeFileSync(f, r.buffer); written = f; }
  else if (OPT.out) {
    const rel = r.path.includes('artist-breeds') ? join('artist-breeds', r.file) : r.file;
    const dest = join(OPT.out, rel);
    mkdirSync(dirname(dest), {recursive: true});
    writeFileSync(dest, r.buffer);
    written = dest;
  }
  results.push({...r, buffer: undefined, written});
}

const ok = results.filter(r => !r.error && !r.problems?.length);
const tb = ok.reduce((s, r) => s + r.bytesBefore, 0);
const ta = ok.reduce((s, r) => s + r.bytesAfter, 0);
console.log('');
console.log(`${ok.length} file(s): ${mb(tb)} MB -> ${mb(ta)} MB  (-${(100 * (1 - ta / tb)).toFixed(1)}%, ${mb(tb - ta)} MB saved)`);
console.log(`settings: maxTexture=${OPT.maxTexture} quality=${OPT.quality} nearLossless=${OPT.nearLossless} quantize=${OPT.quantize}`);
if (!OPT.out && !OPT.inPlace) console.log('DRY RUN — nothing written. Pass --out <dir> or --in-place.');

if (OPT.manifest) {
  mkdirSync(dirname(resolve(OPT.manifest)), {recursive: true});
  writeFileSync(OPT.manifest, JSON.stringify({
    generatedAt: new Date().toISOString(),
    settings: OPT, totals: {bytesBefore: tb, bytesAfter: ta},
    files: results,
  }, null, 2));
  console.log('manifest: ' + OPT.manifest);
}

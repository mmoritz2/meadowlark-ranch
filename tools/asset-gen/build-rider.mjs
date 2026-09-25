#!/usr/bin/env node
/* build-rider.mjs — the rider's models, from Quaternius' free CC0 packs, cut down to what the game loads.
 *
 * SOURCES (all CC0 1.0, https://quaternius.com — the free [Standard] zips from quaternius.itch.io)
 *   Universal Base Characters [Standard]              the bodies (Superhero_Female / _Male), eyes, brows, hairstyles
 *   Universal Animation Library [Standard]             idle, walk, jog, sit ... on the same 65-bone skeleton
 *   Modular Character Outfits - Fantasy [Standard]     the Peasant and Ranger outfits, made for those bodies
 *
 * WHAT COMES OUT (assets/models/rider/)
 *   rider-f.glb, rider-m.glb   body + eyes + brows, skinned. Only POSITION/NORMAL/TEXCOORD_0/JOINTS_0/WEIGHTS_0
 *                              survive: the sources carry five UV sets and three colour sets for their engine
 *                              shaders, all of it dead weight here (the colour sets are solid white).
 *   rider-hair.glb             every hairstyle and both brows as plain meshes in the Head bone's own space.
 *                              They are weighted 100% to Head in the sources (checked below, and the build
 *                              refuses otherwise), so a skin buys nothing: the game hangs them on the bone.
 *   outfit-<name>-<f|m>.glb    each outfit, still skinned to the same skeleton (same bind as the body).
 *   rider-anims.glb            the skeleton and the clips the game plays, no mesh. Scale tracks go, and every
 *                              translation track but the pelvis: the clips were made on a taller mannequin,
 *                              and bone translations would stretch her into its proportions.
 *
 * Textures are resized and re-encoded as WebP, which three's GLTFLoader decodes with no setup. Nothing here
 * uses Draco, meshopt or KTX2 — ranch3d.html's loader has no decoders for them (see optimize-glb.mjs).
 *
 * USAGE
 *   cd tools/asset-gen && npm install
 *   node build-rider.mjs <ubc-dir> <ual-dir> <mco-dir> ../../assets/models/rider
 *   (each dir is the unzipped pack's top folder, e.g. "Universal Base Characters[Standard]")
 */
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {prune, dedup, resample, textureCompress, mergeDocuments} from '@gltf-transform/functions';
import sharp from 'sharp';
import {readFileSync, writeFileSync, mkdirSync, existsSync, statSync} from 'node:fs';
import {join, dirname, basename} from 'node:path';

const [UBC, UAL, MCO, OUT] = process.argv.slice(2);
if (!OUT) { console.error('usage: node build-rider.mjs <ubc-dir> <ual-dir> <mco-dir> <out-dir>'); process.exit(2); }
mkdirSync(OUT, {recursive: true});
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const KEEP_ATTR = new Set(['POSITION', 'NORMAL', 'TEXCOORD_0', 'JOINTS_0', 'WEIGHTS_0']);

/* The packs' .gltf files point at a few images that are not beside them (T_Eye_Normal_png.png for one).
   Look for each image beside the file, then in the pack's Textures folders; drop it if it is nowhere. */
async function readFixed(path, texDirs = []) {
  const json = JSON.parse(readFileSync(path, 'utf8'));
  const dir = dirname(path), resources = {};
  for (const b of json.buffers || []) if (b.uri) resources[b.uri] = new Uint8Array(readFileSync(join(dir, decodeURI(b.uri))));
  const find = uri => {
    const names = [uri, uri.replace(/_png\.png$/, '.png')];
    for (const d of [dir, ...texDirs]) for (const n of names) { const p = join(d, decodeURI(n)); if (existsSync(p)) return p; }
    return null;
  };
  const dead = new Set();
  (json.images || []).forEach((im, i) => {
    if (!im.uri) return;
    const p = find(im.uri);
    if (p) resources[im.uri] = new Uint8Array(readFileSync(p)); else { dead.add(i); console.warn('  (no file for image', im.uri + ', dropped)'); }
  });
  if (dead.size) {   // textures whose image is missing, and every material slot that used them
    const deadTex = new Set((json.textures || []).map((t, i) => dead.has(t.source) ? i : -1).filter(i => i >= 0));
    for (const m of json.materials || []) {
      for (const k of ['normalTexture', 'occlusionTexture', 'emissiveTexture']) if (m[k] && deadTex.has(m[k].index)) delete m[k];
      const pbr = m.pbrMetallicRoughness || {};
      for (const k of ['baseColorTexture', 'metallicRoughnessTexture']) if (pbr[k] && deadTex.has(pbr[k].index)) delete pbr[k];
    }
  }
  return io.readJSON({json, resources});
}
async function readGLB(path) { return io.read(path); }

function stripAttributes(doc) {
  for (const mesh of doc.getRoot().listMeshes()) for (const prim of mesh.listPrimitives())
    for (const sem of prim.listSemantics()) if (!KEEP_ATTR.has(sem)) prim.setAttribute(sem, null);
}
/* Size per texture by what it is for: the body and the clothes get 1024, the eyes 256, small maps 512. */
async function squeeze(doc, sizes) {
  for (const tex of doc.getRoot().listTextures()) {
    const name = (tex.getURI() || tex.getName() || '').toLowerCase();
    let max = sizes.default;
    for (const [re, n] of sizes.rules) if (re.test(name)) { max = n; break; }
    tex.setExtras({...tex.getExtras(), maxSize: max});
  }
  const bySize = {};
  for (const tex of doc.getRoot().listTextures()) { const m = tex.getExtras().maxSize; (bySize[m] = bySize[m] || []).push(tex); }
  for (const [max, list] of Object.entries(bySize)) {
    const names = new Set(list.map(t => t.getURI() || t.getName()));
    await doc.transform(textureCompress({encoder: sharp, targetFormat: 'webp', resize: [+max, +max], quality: 88,
      pattern: new RegExp('^(' + [...names].map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')$')}));
  }
}
async function finish(doc, file) {
  await doc.transform(prune({keepAttributes: false, keepLeaves: false}), dedup());
  const out = join(OUT, file);
  await io.write(out, doc);
  console.log('wrote', file, (statSync(out).size / 1048576).toFixed(2), 'MB');
}

/* ------------------------------------------------------------------ bodies ------------ */
const UBC_BASE = join(UBC, 'Base Characters', 'Godot - UE'), UBC_TEX = join(UBC, 'Base Characters', 'Textures');
async function body(src, file) {
  const doc = await readFixed(join(UBC_BASE, src), [UBC_TEX]);
  stripAttributes(doc);
  for (const m of doc.getRoot().listMaterials()) {
    /* skin reads as skin with a flat roughness; the roughness map was a 3 MB PNG for a few percent */
    if (/Superhero/.test(m.getName())) { m.setMetallicRoughnessTexture(null); m.setRoughnessFactor(0.62); m.setMetallicFactor(0); }
    if (/Eye/.test(m.getName())) { m.setNormalTexture(null); m.setMetallicRoughnessTexture(null); m.setRoughnessFactor(0.25); m.setMetallicFactor(0); }
    if (/Hair/.test(m.getName())) { m.setMetallicRoughnessTexture(null); m.setRoughnessFactor(0.55); m.setMetallicFactor(0); }
  }
  await squeeze(doc, {default: 1024, rules: [[/eye/, 256], [/hair.*normal/, 512]]});
  await finish(doc, file);
}

/* ------------------------------------------------------------------ hair -------------- */
const HAIR_DIR = join(UBC, 'Hairstyles', 'Rigged to Head Bone', 'glTF (Godot -Unreal)'), HAIR_TEX = join(UBC, 'Hairstyles', 'Textures');
const HAIRS = ['Hair_Long', 'Hair_Buns', 'Hair_SimpleParted', 'Hair_BuzzedFemale', 'Hair_Buzzed', 'Hair_Beard', 'Eyebrows_Female', 'Eyebrows_Regular'];
function mat4MulPoint(m, p, w) {   // column-major glTF matrix
  const x = p[0], y = p[1], z = p[2];
  return [m[0] * x + m[4] * y + m[8] * z + m[12] * w, m[1] * x + m[5] * y + m[9] * z + m[13] * w, m[2] * x + m[6] * y + m[10] * z + m[14] * w];
}
async function hair() {
  let doc = null;
  for (const h of HAIRS) {
    const d = await readFixed(join(HAIR_DIR, h + '.gltf'), [HAIR_TEX, UBC_TEX]);
    stripAttributes(d);
    /* bake each mesh into Head space: v_head = IBM(Head) * v_bind, and refuse anything not 100% Head */
    for (const node of d.getRoot().listNodes()) {
      const mesh = node.getMesh(), skin = node.getSkin(); if (!mesh || !skin) continue;
      const joints = skin.listJoints(), hi = joints.findIndex(j => j.getName() === 'Head');
      const ibm = skin.getInverseBindMatrices(), M = []; for (let k = 0; k < 16; k++) M.push(ibm.getArray()[hi * 16 + k]);
      for (const prim of mesh.listPrimitives()) {
        const J = prim.getAttribute('JOINTS_0'), W = prim.getAttribute('WEIGHTS_0'), j = [0, 0, 0, 0], w = [0, 0, 0, 0];
        for (let i = 0; i < J.getCount(); i++) { J.getElement(i, j); W.getElement(i, w);
          for (let k = 0; k < 4; k++) if (w[k] > 0.001 && j[k] !== hi) throw new Error(h + ': vertex ' + i + ' is weighted to ' + joints[j[k]].getName()); }
        const P = prim.getAttribute('POSITION'), N = prim.getAttribute('NORMAL'), e = [0, 0, 0];
        const pa = new Float32Array(P.getCount() * 3), na = new Float32Array(N.getCount() * 3);
        for (let i = 0; i < P.getCount(); i++) { P.getElement(i, e); pa.set(mat4MulPoint(M, e, 1), i * 3); }
        for (let i = 0; i < N.getCount(); i++) { N.getElement(i, e); const v = mat4MulPoint(M, e, 0), l = Math.hypot(...v) || 1; na.set([v[0] / l, v[1] / l, v[2] / l], i * 3); }
        /* fresh accessors: the sources share one buffer view between meshes, and we are rewriting in place */
        prim.setAttribute('POSITION', d.createAccessor().setType('VEC3').setArray(pa).setBuffer(P.getBuffer()));
        prim.setAttribute('NORMAL', d.createAccessor().setType('VEC3').setArray(na).setBuffer(N.getBuffer()));
        prim.setAttribute('JOINTS_0', null); prim.setAttribute('WEIGHTS_0', null);
      }
      node.setSkin(null); node.setMatrix([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]); node.setName(h); mesh.setName(h);
      const scene = d.getRoot().listScenes()[0];
      if (node.getParentNode()) node.getParentNode().removeChild(node);
      scene.addChild(node);
    }
    for (const n of d.getRoot().listNodes()) if (!n.getMesh()) n.dispose();   // the armature: nothing hangs off it now
    for (const s of d.getRoot().listSkins()) s.dispose();
    for (const m of d.getRoot().listMaterials()) { m.setMetallicRoughnessTexture(null); m.setRoughnessFactor(0.55); m.setMetallicFactor(0); }
    if (!doc) doc = d; else mergeDocuments(doc, d);
  }
  /* one scene, one buffer */
  const scenes = doc.getRoot().listScenes(), main = scenes[0];
  for (const s of scenes.slice(1)) { for (const n of s.listChildren()) { s.removeChild(n); main.addChild(n); } s.dispose(); }
  const buffers = doc.getRoot().listBuffers();
  for (const acc of doc.getRoot().listAccessors()) acc.setBuffer(buffers[0]);
  for (const b of buffers.slice(1)) b.dispose();
  await squeeze(doc, {default: 1024, rules: [[/normal/, 512]]});
  await finish(doc, 'rider-hair.glb');
}

/* ------------------------------------------------------------------ outfits ----------- */
const MCO_OUT = join(MCO, 'Exports', 'glTF (Godot-Unreal)', 'Outfits'), MCO_TEX = ['Base', 'Peasant', 'Ranger', 'Ranger/Base Chars'].map(d => join(MCO, 'Textures', d));
async function outfit(src, file) {
  const doc = await readFixed(join(MCO_OUT, src), MCO_TEX);
  stripAttributes(doc);
  for (const m of doc.getRoot().listMaterials()) if (/Regular/.test(m.getName())) { m.setMetallicRoughnessTexture(null); m.setRoughnessFactor(0.62); m.setMetallicFactor(0); }
  await squeeze(doc, {default: 1024, rules: [[/orm/, 512], [/regular.*normal/, 512]]});
  await finish(doc, file);
}

/* ------------------------------------------------------------------ animation --------- */
const CLIPS = ['Idle_Loop', 'Idle_Talking_Loop', 'Walk_Loop', 'Jog_Fwd_Loop', 'Sprint_Loop', 'Sitting_Idle_Loop', 'Driving_Loop',
  'Interact', 'PickUp_Table', 'Fixing_Kneeling', 'Dance_Loop', 'Jump_Start', 'Jump_Loop', 'Jump_Land', 'Crouch_Idle_Loop'];
async function anims() {
  const doc = await readGLB(join(UAL, 'Unreal-Godot', 'UAL1_Standard.glb'));
  const root = doc.getRoot();
  /* an animation's samplers outlive it, still holding their accessors, so take them down with it */
  for (const a of root.listAnimations()) if (!CLIPS.includes(a.getName())) { a.listChannels().forEach(c => c.dispose()); a.listSamplers().forEach(s => s.dispose()); a.dispose(); }
  for (const a of root.listAnimations()) for (const ch of a.listChannels()) {
    const path = ch.getTargetPath(), name = ch.getTargetNode()?.getName();
    if (path === 'scale' || (path === 'translation' && name !== 'pelvis')) { const s = ch.getSampler(); ch.dispose(); s.dispose(); }
  }
  for (const node of root.listNodes()) if (node.getMesh()) { node.setMesh(null); node.setSkin(null); }
  for (const m of root.listMeshes()) m.dispose();
  for (const m of root.listMaterials()) m.dispose();
  await doc.transform(resample({tolerance: 1e-4}));
  /* the skin goes with the mesh, so keep the joints alive by hand: prune would otherwise eat every bone
     no channel touches (the leaf bones), and the game wants the whole named hierarchy to bind against */
  await doc.transform(prune({keepLeaves: true, keepAttributes: false}), dedup());
  /* and anything else only the root still refers to (a 3.7 MB file once carried 280 KB of motion) */
  for (const acc of root.listAccessors()) if (!acc.listParents().some(p => p.propertyType !== 'Root')) acc.dispose();
  const missing = CLIPS.filter(c => !root.listAnimations().some(a => a.getName() === c));
  if (missing.length) throw new Error('clips missing from the library: ' + missing.join(', '));
  const out = join(OUT, 'rider-anims.glb'); await io.write(out, doc);
  console.log('wrote rider-anims.glb', (statSync(out).size / 1048576).toFixed(2), 'MB,', root.listAnimations().length, 'clips');
}

await body('Superhero_Female_FullBody.gltf', 'rider-f.glb');
await body('Superhero_Male_FullBody.gltf', 'rider-m.glb');
await hair();
await outfit('Female_Peasant.gltf', 'outfit-peasant-f.glb');
await outfit('Female_Ranger.gltf', 'outfit-ranger-f.glb');
await outfit('Male_Peasant.gltf', 'outfit-peasant-m.glb');
await outfit('Male_Ranger.gltf', 'outfit-ranger-m.glb');
await anims();
writeFileSync(join(OUT, 'LICENSE.txt'), [
  'The models, textures and animations in this folder are by Quaternius (https://quaternius.com),',
  'released under CC0 1.0 Universal (public domain): https://creativecommons.org/publicdomain/zero/1.0/',
  '',
  'From the free [Standard] versions of: Universal Base Characters, Universal Animation Library,',
  'Modular Character Outfits - Fantasy. Cut down for the web by tools/asset-gen/build-rider.mjs.',
  ''].join('\n'));
console.log('done');

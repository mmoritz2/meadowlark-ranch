/* Optimise a Poly Haven .gltf into a single-mesh, single-material .glb that the
   game's placeFoliage() path can consume unchanged.

   Constraints that drive every choice here:
   - placeFoliage does `new GLTFLoader()` with NO DRACOLoader / MeshoptDecoder / KTX2Loader,
     so Draco, EXT_meshopt_compression and KTX2 would all fail to decode at runtime.
     The vendored GLTFLoader does support EXT_texture_webp with no extra setup, so WebP
     is the only compression lever available. Verified against
     assets/vendor/three/examples/jsm/loaders/GLTFLoader.js.
   - placeFoliage takes `src.geometry` and ignores the node's world matrix, so every
     node transform must be baked into the geometry -> flatten() before join().
   - placeFoliage takes the FIRST mesh and ONE material, so the file must reduce to
     exactly one mesh with one material -> join().
   - placeFoliage forces mat.roughness=0.9 and mat.metalness=0, which makes Poly Haven's
     packed ARM (AO/rough/metal) map largely redundant. Dropping it and the occlusion
     map is the single biggest size win and costs almost nothing visually on a prop
     you gallop past.
*/
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { flatten, join, weld, simplify, dedup, prune, resample, textureCompress } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import fs from 'node:fs';

const [, , input, output, targetTrisArg, texSizeArg, errArg, weldArg] = process.argv;
const targetTris = Number(targetTrisArg || 4000);
const texSize = Number(texSizeArg || 512);
const simplifyError = Number(errArg || 0.008);
const weldTol = Number(weldArg || 0);

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(input);
const root = doc.getRoot();

const countTris = () => {
  let t = 0;
  for (const m of root.listMeshes())
    for (const p of m.listPrimitives()) {
      const i = p.getIndices();
      t += (i ? i.getCount() : p.getAttribute('POSITION').getCount()) / 3;
    }
  return Math.round(t);
};
const before = countTris();

// Bake node transforms down, then collapse every same-material primitive into one mesh.
await doc.transform(flatten(), dedup(), join({ keepNamed: false }));

// Decimate to the project's ~6k-triangle prop budget. meshoptimizer's simplifier keeps
// the silhouette, which is what actually matters for a rock read at 30 m.
const ratio = Math.min(1, targetTris / before);
if (ratio < 0.98) {
  await doc.transform(
    weld({ tolerance: weldTol }),
    simplify({ simplifier: MeshoptSimplifier, ratio, error: simplifyError, lockBorder: false })
  );
}

// Drop the ARM/occlusion maps the runtime overrides anyway; keep baseColor + normal.
for (const mat of root.listMaterials()) {
  mat.setOcclusionTexture(null);
  mat.setMetallicRoughnessTexture(null);
  mat.setMetallicFactor(0);
  mat.setRoughnessFactor(1);
  // BLEND on an InstancedMesh has no reliable draw order. MASK is correct for foliage.
  if (mat.getAlphaMode() === 'BLEND') {
    mat.setAlphaMode('MASK');
    mat.setAlphaCutoff(0.4);
  }
}
await doc.transform(prune(), dedup());

/* Resize + WebP, via textureCompress so that EXT_texture_webp is actually declared in
   extensionsUsed/Required. Writing image/webp bytes without the extension produces a file
   that three.js happens to accept (it hands the blob to the browser, which decodes WebP
   natively) but that is invalid glTF and fails any strict validator or viewer. Normal maps
   get a smaller budget and higher quality, because WebP's chroma subsampling makes a mess
   of packed XY normals. */
await doc.transform(
  textureCompress({
    encoder: sharp, targetFormat: 'webp', slots: /normalTexture/,
    resize: [Math.min(texSize, 256), Math.min(texSize, 256)], quality: 92,
  }),
  textureCompress({
    encoder: sharp, targetFormat: 'webp', slots: /baseColorTexture/,
    resize: [texSize, texSize], quality: 82,
  })
);

await doc.transform(prune(), dedup());
await io.write(output, doc);

const after = countTris();
const meshes = root.listMeshes().length;
const mats = root.listMaterials().length;
const prims = root.listMeshes().reduce((n, m) => n + m.listPrimitives().length, 0);
console.log(JSON.stringify({
  file: output.split('/').pop(),
  trisBefore: before, trisAfter: after,
  meshes, prims, materials: mats,
  bytes: fs.statSync(output).size,
  extensions: root.listExtensionsUsed().map((e) => e.extensionName),
  images: root.listTextures().map((t) => ({ mime: t.getMimeType(), kb: +(t.getImage().byteLength / 1024).toFixed(1) })),
  alphaMode: root.listMaterials().map((m) => m.getAlphaMode()),
  doubleSided: root.listMaterials().map((m) => m.getDoubleSided()),
}));

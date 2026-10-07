# Individual woodland plants

Nearby bracken, scrub, yard ferns, and natural woody shrubs now use eight rooted plant shapes rather than stretched branch cards or a flattened collection of sample models. This pass uses four individual [Fern 02](https://polyhaven.com/a/fern_02) specimens (scanned by Rob Tuytel, modeled by Rico Cilliers), two original three-shoot arrangements of [Shrub 03](https://polyhaven.com/a/shrub_03) (Rico Cilliers), and the complete B/C specimens of the existing [Wild Rooibos Bush](https://polyhaven.com/a/wild_rooibos_bush) builder scan (James Ray Cock / Jenelle van Heerden). All three source assets are [CC0](https://polyhaven.com/license). Source URLs, authors, original hashes and final hashes are in `assets/models/world/undergrowth/sources.json`.

The older fern/shrub GLBs combined several plants at their gallery offsets and omitted the separate alpha mask. The new packed files retain each original mesh independently, remove gallery translations, and combine the official alpha image with base color. Fern and shoot geometry is not decimated. Base color is 1K lossless RGBA WebP, with retained normal and ARM maps at 512px. Rooibos reuses the existing builder GLB, merging all primitives of each chosen specimen at runtime. No launcher or third-party executable is required.

Full models cost 784–6,309 triangles each. Low/medium/high quality allows at most 100,000/240,000/480,000 native plant triangles, inside 10/15/21 metres. Selection uses actual mixed model costs and a common radius, with complementary opaque dither across the final three metres. Eight albedo/object-normal views per model retain distant silhouettes; they stop at 85/110/135 metres. The PNG tiles are 256px per view, and every tile has transparent edges. The selection origin and instance lists advance together. Roots stay fixed while tips sway and bend away from the rider; world-space parting directions are transformed into each plant's local rotation.

Natural planting positions are retained. Fern footprints are capped at 1.30m and woody/shoot footprints at 1.15m, and the roots sample the existing ground height. Nearby woody shrubs cast alpha-cutout shadows at medium/high quality with the same deformation and LOD discard in their depth material. Fern and shoot detail is omitted from water reflection draws. Cold/dry plants retain their former models and appearance, and user-placed builder decorations are unchanged. Decorative undergrowth keeps its prior brush-through behavior; this pass does not add riding barriers or alter terrain or water geometry.

Rebuild packed assets with `python3 tools/asset-gen/build-undergrowth.py /path/to/original-downloads` (each model directory contains its glTF, buffer, maps, and `downloads.json`). Bake matching views with `QA_PORT=8457 PLAYWRIGHT_PATH=/path/to/playwright node tools/asset-gen/bake-undergrowth.cjs` against the preview server. Both stages retain source provenance.

Validate with:

```sh
node --test tools/test-undergrowth.mjs
QA_PORT=8457 PLAYWRIGHT_PATH=/path/to/playwright node tools/qa-undergrowth.cjs /path/to/evidence
QA_PORT=8457 PLAYWRIGHT_PATH=/path/to/playwright node tools/qa-country-world.cjs /path/to/country-evidence
QA_PORT=8457 PLAYWRIGHT_PATH=/path/to/playwright node tools/qa-willowmere.cjs /path/to/riding-evidence
```

The focused checks cover model/atlas hashes, original sites, roots and proportions, normalized normals, actual quality budgets, relocation/return, far culling, opaque finite HDR output in all three LOD states, and 505 protected riding-height samples. Country and Willowmere checks cover broader scenery and mounted routes. Inspect sunny riding views, close leaves, rain and night. This milestone does not establish a mobile frame rate or complete visual parity with Star Equestrian. Snow repetition, biome transitions, regional composition, and some legacy props still need work.

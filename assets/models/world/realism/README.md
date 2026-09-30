# Poly Haven environment assets

Downloaded directly from Poly Haven on **2026-09-30**. The models are free under
[CC0 1.0](https://polyhaven.com/license), including commercial use and redistribution.
These are Poly Haven's scanned/authored assets, not generated substitutes or
assets extracted from another game.

| Asset | Author(s) | Runtime geometry |
| --- | --- | ---: |
| [Tree Small 02](https://polyhaven.com/a/tree_small_02) | Rico Cilliers | 123,891 triangles |
| [Pine Sapling Small](https://polyhaven.com/a/pine_sapling_small) | Rob Tuytel, Rico Cilliers | 49,410 across three saplings |
| [Rock Moss Set 01](https://polyhaven.com/a/rock_moss_set_01) | Kless Gyzen | 26,993 across six rocks |
| [Rock Face 02](https://polyhaven.com/a/rock_face_02) | Dario Barresi, Rico Cilliers | 8,496 |
| [Dead Tree Trunk 02](https://polyhaven.com/a/dead_tree_trunk_02) | Jenelle van Heerden, Rico Cilliers | 8,498 |
| [Namaqualand Cliff 02](https://polyhaven.com/a/namaqualand_cliff_02) | Dario Barresi, Rico Cilliers | 23,998 |

`manifest.json` records every source URL, source SHA-256, creator, license, output
SHA-256, geometry budget and processing step. Downloads are checked against the
MD5 published by the official API before conversion. Original downloads are
cached outside the repository; all runtime models and textures are local.

The conversion retains all materials and original PBR channels. Foliage gets
the author's separate transparency mask, alpha testing and wind that also affects
shadows. Geometry budgets are assigned per material to preserve the crowns.
Color and normals use 1024px WebP, packed surface maps 512px. Colors are not given
the older library's painterly grade. No runtime geometry decoder is required.

`assets/world-photoscans.js` replaces 74 scattered boulders and the existing
30 meadow outcrops. It preserves the outcrop mesh references used for climbing.
Oak/birch replacements include both the original scatter and the biome package's
copses, retaining their collision positions and Amberwood's autumn tint.
Nearby placements use the detailed tree, with at most 12 on High and
6 on Medium. Distant trees and Low/VR use eight-view albedo impostors baked from
the same model, with live lighting and alpha-tested silhouettes. The original
geometry stays available if the model or atlas cannot load. Spatial batches
support view and shadow culling. Saplings and fallen timber
respect roads, race routes, water, interactables and existing colliders.
The exact number of plant/log placements depends on the world's random scatter.

Rebuild from the repository root, with `tools/asset-gen/package.json` dependencies
installed (or `GLTF_PIPELINE_MODULES` pointing to a compatible `node_modules`):

```sh
python3 tools/asset-gen/fetch-world-realism.py tree_small_02 pine_sapling_small rock_moss_set_01 rock_face_02 dead_tree_trunk_02 namaqualand_cliff_02
node tools/asset-gen/build-world-realism.mjs tree_small_02 pine_sapling_small rock_moss_set_01 rock_face_02 dead_tree_trunk_02 namaqualand_cliff_02
node tools/asset-gen/bake-world-tree.cjs
```

The atlas bake requires the local preview server and Playwright. Its camera
layout and SHA-256 are in `tree-impostor.json`; the eight views add only 328 KiB.
The six GLBs total about 16.5 MiB. Khronos validation reports zero errors; the
normal maps use Three.js's generated tangent space, which produces the validator's
standard missing-authored-tangents warnings. Rendering is verified in the game.

The final September 30 visual run passed all rendering/asset/tier checks and
covered 1,749 replacement tree placements, 74 boulders, 30 outcrops, 131 saplings,
32 logs and 18 rock-face additions in that generated world. High at 900×650
measured roughly 50 ms median / 67 ms p95 per frame on this development machine.
That is a performance limit, not a 60 fps claim. Counts and timings vary with
scatter, view, graphics mode and hardware. Full reports and screenshots are in
`output/world-photoscans-final/` after running `tools/qa-world-finish.cjs`.

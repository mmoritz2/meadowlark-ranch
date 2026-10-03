# Poly Haven environment assets

Downloaded directly from Poly Haven on **2026-09-30** and **2026-10-03**. The models are free under
[CC0 1.0](https://polyhaven.com/license), including commercial use and redistribution.
These are Poly Haven's scanned/authored assets, not generated substitutes or
assets extracted from another game.

| Asset | Author(s) | Runtime geometry |
| --- | --- | ---: |
| [Tree Small 02](https://polyhaven.com/a/tree_small_02) | Rico Cilliers | 123,891 triangles |
| [Fir Sapling Medium](https://polyhaven.com/a/fir_sapling_medium) | Rico Cilliers, Rob Tuytel | 401,578 across three firs |
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
Color and normals use 1024px WebP, packed surface maps 512px.
Fir needles are fitted to textured quads individually before border-preserving
simplification: all 157,056 original needle ribbons remain represented. This
avoids the sparse crowns produced by global simplification of disconnected leaves. Colors are not given
the older library's painterly grade. No runtime geometry decoder is required.

`assets/world-photoscans.js` replaces 74 scattered boulders and the existing
30 meadow outcrops. It preserves the outcrop mesh references used for climbing.
Oak/birch and conifer replacements include both the original scatter and the
biome package's copses, retaining their collision positions and Amberwood's autumn
tint. Three scanned fir variants replace the oversized procedural needle sprays.
Nearby placements use the detailed tree, with at most 12 on High and
6 on Medium. Distant trees and Low/VR use eight-view albedo and object-normal impostors baked
from the same models, with live lighting and alpha-tested silhouettes. The
far forest shares these views, with its original near-rider distance fade. High
quality also enables alpha-tested shadows for nearby distant-tree batches. The original
geometry stays available if the model or atlas cannot load. Spatial batches
support view and shadow culling. Saplings and fallen timber
respect roads, race routes, water, interactables and existing colliders.
The exact number of plant/log placements depends on the world's random scatter.

Rebuild from the repository root, with `tools/asset-gen/package.json` dependencies
installed (or `GLTF_PIPELINE_MODULES` pointing to a compatible `node_modules`):

```sh
python3 tools/asset-gen/fetch-world-realism.py tree_small_02 fir_sapling_medium pine_sapling_small rock_moss_set_01 rock_face_02 dead_tree_trunk_02 namaqualand_cliff_02
node tools/asset-gen/build-world-realism.mjs tree_small_02 fir_sapling_medium pine_sapling_small rock_moss_set_01 rock_face_02 dead_tree_trunk_02 namaqualand_cliff_02
node tools/asset-gen/bake-world-tree.cjs
```

The atlas bake requires the local preview server and Playwright. Camera framing,
eight view counts and SHA-256 hashes are recorded in `tree-impostors.json`.
The eight albedo/normal atlases total 8.1 MiB; the seven GLBs total 43.7 MiB.
These remain additional first-load downloads, then use the browser cache.
The October 3 fir asset passes Khronos validation with zero errors and nine
missing-authored-tangents warnings; Three.js generates its tangent space.

Run `tools/qa-world-finish.cjs` against the preview server to exercise actual WebGL
rendering, model loading, tree budgets, lit distant forests, cloud quality levels,
water reflections, contact shading, exposure, and resize handling. It captures
matching ranch, meadow, river, woodland and fir views plus daylight, golden-hour,
night and rain, and measures frame time. Reports and screenshots for this update
are in `output/world-cinematic-detail/final/` on the development checkout.

The October 3 rendering run passed all 28 checks. That generated world included
2,554 replacement trees (819 conifers) plus 4,160 distant forest placements.
At High, 900×650, frame time was 35.4 ms median / 41.8 ms p95 on the development
machine, compared with 36.3 / 40.0 ms before this update. These short samples
include random world scatter; they show comparable cost, not a 60 fps guarantee.

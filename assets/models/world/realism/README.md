# Poly Haven environment assets

Downloaded directly from Poly Haven on **2026-09-30**, **2026-10-03** **2026-10-05** and **2026-10-06**. The models are free under
[CC0 1.0](https://polyhaven.com/license), including commercial use and redistribution.
These are Poly Haven's scanned/authored assets, not generated substitutes or
assets extracted from another game.

| Asset | Author(s) | Runtime geometry |
| --- | --- | ---: |
| [Jacaranda Tree](https://polyhaven.com/a/jacaranda_tree) | Rico Cilliers, Rob Tuytel | 258,718; all 116,084 leaves retained |
| [Island Tree 01](https://polyhaven.com/a/island_tree_01) | Rob Tuytel, Rico Cilliers | 104,150; all 44,168 leaves retained |
| [Tree Small 02](https://polyhaven.com/a/tree_small_02) | Rico Cilliers | 123,891 triangles |
| [Fir Sapling Medium](https://polyhaven.com/a/fir_sapling_medium) | Rico Cilliers, Rob Tuytel | 401,578 across three firs |
| [Pine Tree 01](https://polyhaven.com/a/pine_tree_01) | Rob Tuytel, Rico Cilliers | 90,650; one mature specimen |
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
The mature pine replaces a deterministic portion of tall conifers. Nearby placements use detailed trees, with at most
12 / 1.8 million triangles on High and 6 / 750,000 triangles on Medium. Distant trees and Low/VR use eight-view albedo and object-normal impostors baked
from the same models, with live lighting and alpha-tested silhouettes. High
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
The ten albedo/normal atlases total 11.0 MiB; the eight GLBs total 49.0 MiB.
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

## October 5 mature woodland and ground detail

`pine_tree_01.glb` retains the first authored mature specimen from the source
collection. The source's 401,342 individual needle meshes are converted to 9,590
crossed twig cards fitted into 4,795 occupied canopy cells. Cards use the author's
photographed twig and transparency mask. Branches, cones and trunk remain separate
geometry. Constant white vertex colors are removed; normals use 8-bit quantization
and UVs 12-bit. The file explicitly requires `KHR_mesh_quantization`; positions
stay floating point so collection placement does not alter the tree's proportions.
The runtime GLB is 5.35 MiB, compared with the 914 MiB complete source download.

The detailed tree's twig material uses a linear RGB exposure multiplier of
`[1.7, 2.1, 1.5]` to fit the daylight pasture. The same multiplier is applied before
baking its distant views; bark retains its source color. This does not replace
the original texture files or make foliage emit light. Detailed foliage uses
softened canopy normals and reduced normal-map strength. The safe filtered-normal
fallback from the black-rectangle fix remains in place for all distant trees.

`ground-stone.json` is a 240-triangle LOD of the first Rock Moss Set 01 scan. It
shares the existing rock texture channels and replaces the travelling ground-cover
spheres. Source attribution and license are embedded in the JSON.

```sh
python3 tools/asset-gen/fetch-world-realism.py pine_tree_01
node --max-old-space-size=8192 tools/asset-gen/build-world-realism.mjs pine_tree_01
node tools/asset-gen/bake-world-tree.cjs pine_tree_01
node tools/asset-gen/build-ground-stone.mjs
```

Khronos validation reports zero errors and four missing-authored-tangents warnings
for the mature pine. Three.js generates tangent space from derivatives. The model
and every albedo/normal atlas hash are checked against the manifests. See
`docs/landscape-models-2026-10-05.md` for visual and gameplay acceptance results.

## Background tree removal

The extra background forest (up to 4,160 instances) was removed after the player reported
trees sinking into the ground. Its distance shader scaled entire trees toward
their bases between 150 and 95 metres from the rider. Both the generated fallback
and the scanned replacement used that effect. The extra layer, runtime texture
bakes and distance-scaling shader path are now removed. The ordinary woodland
retains its detailed trees and matching distant views at a fixed planted scale.

Verification: `tools/qa-grounded-woodland.cjs` passed nine checks, including a
keyboard-driven mounted ride, all graphics tiers, and an identical rendered tree
silhouette at rider distances from 80 to 180 metres. The 14-check black-rectangle
regression also passes, with no invalid source or postprocessed pixels.


## October 6 lowland canopy

`island_tree_01.glb` supplies an additional spreading broadleaf crown around the
pastures and village. Every source leaf is a 24-triangle connected component.
Each is fitted to a two-triangle card using its own UVs, averaged normal and
position; all 44,168 leaves remain. Bark and branches are simplified separately.
The model has 104,150 triangles, three materials and nine textures, and occupies
9,036,864 bytes. Khronos validation reports zero errors and three source tangent
warnings; Three.js derives tangent space at render time.

The two additional view atlases are generated from this exact optimized tree.
The existing High/Medium detailed-tree triangle limits remain 1.8M/750K, and Low
continues to use fixed-position distant views. No shrinking or sinking transition
is added. Colder woods retain firs and pines; the lowlands mix the new spreading
crown with the earlier slimmer broadleaf. Source URLs and checksums are in the
manifest alongside the earlier assets.

```sh
python3 tools/asset-gen/fetch-world-realism.py island_tree_01
node tools/asset-gen/build-world-realism.mjs island_tree_01
node tools/asset-gen/bake-world-tree.cjs island_tree_01
```


## October 6 woodland groves and Clover Hill

`jacaranda_tree.glb` adds a taller, fuller green broadleaf crown to warm lowland
groves. Seven authored leaf shapes are fitted individually to textured quads,
retaining all 116,084 leaves and the source UVs, positions and orientations.
The resulting tree has 258,718 triangles, three materials and nine textures.
Normals use 8-bit quantization; in-range UVs use 12 bits. Source PBR textures and
alpha masks are retained. The 16.23 MiB GLB and its 3.41 MiB eight-view albedo and
normal atlases are hosted with the game. Khronos validation reports zero errors
and three source missing-tangent warnings; Three.js derives tangent space.

The new tree replaces selected lowland groves and frames the Clover Hill
bridleway with additional small groups. Existing planted tree positions stay
fixed. Heights stay fixed as the rider moves, and the High/Medium detailed-tree
limits remain 1.8 million/750,000 triangles. Low uses matching distant views.
New trunks are registered only after the complete tree assets load successfully.
The small 240-triangle scanned ground stone also replaces the untextured
icosahedra used for roadside stone courses and cairns.

```sh
python3 tools/asset-gen/fetch-world-realism.py jacaranda_tree
node --max-old-space-size=8192 tools/asset-gen/build-world-realism.mjs jacaranda_tree
node tools/asset-gen/bake-world-tree.cjs jacaranda_tree
```

See `tools/qa-woodland-trails.cjs` for mounted traversal in both directions,
new-tree quality budgets, path grounding, cleared vegetation, and finite GPU
pixels. The broader landscape and rendering checks cover all graphics tiers,
weather, portrait view and the previous black-rectangle regressions.


### Broadleaf canopy depth (October 2026)

The three broadleaf models retain their original geometry and licensed textures.
`assets/canopy-shading.js` estimates sky occlusion from their actual leaf area in
an approximately 44-cell-wide voxel field with twelve upper-hemisphere samples.
This runs once when each scan loads. The resulting per-vertex shade is used by
both the full-detail material and `bake-world-tree.cjs` when it creates the eight
distant albedo views. There is no added runtime shadow pass or leaf geometry.
The original alpha silhouettes and normal atlases are unchanged. A shared linear
RGB leaf multiplier `[0.82, 1, 0.66]` gives the summer pasture a greener pigment;
the existing autumn pigment system still runs independently.

Regenerate all three matching views with:

```sh
node tools/asset-gen/bake-world-tree.cjs tree_small_02 island_tree_01 jacaranda_tree
```

`tree-impostors.json` records the updated hashes and canopy-field measurements.
`qa-woodland-trails.cjs` compares those measurements with the runtime, checks the
actual shade attributes, and rides the woodland route in both directions.


## October 8 village and riverside crags

The village skyline and adjoining river outcrop use ten complete boulder pieces
from the existing Rock Moss Set 01, replacing three generated mesas and five
thin pillars. Uniform transforms preserve the photographed forms; the low
vertices sit at least 0.16 metres below the sampled terrain. A shared material
adds neutral weathering and the existing world-space mineral detail texture.
The original source GLB and its PBR maps are unchanged; no new model download
is required.

The actual transformed triangles provide body collision and supporting height.
The original circles remain for road layout; they stop acting as coarse player
barriers only after the scanned surfaces register successfully. A single ground
sampler skips the detailed index outside those circles. Ground cover avoids
exposed rock surfaces instead of planting shrubs and loose stones on their faces.

## Clover woodland edge contacts

The authored eight-tree edge reuses Tree Small 02's resident young/mature foliage, materials and view atlases. Its compact contact table in `assets/woodland-edge-wood-proxies.mjs` is an original derivative of the same CC0 asset by Rico Cilliers. It includes opaque trunk and branch geometry at every height; leaves remain soft. `node tools/build-woodland-wood-proxies.mjs` regenerates 929 source-local boxes from the pinned source GLB. The generator clips triangles to 0.15-unit cells, pads bounds by 0.007, and rounds outward. These conservative contacts can extend slightly beyond individual twigs; they do not enclose a whole crown in one obstacle.

The added trees share the existing visual detail budget. The connected lower edge uses the existing shrub/fern sources and undergrowth detail budgets, with authored heights preserved through the one-time capture. No additional texture or model download is needed.

# Scanned ground materials

Three free [Poly Haven CC0](https://polyhaven.com/license) surface sets, fetched
from the official API on 2026-09-30:

| Surface | Source | Creators |
| --- | --- | --- |
| Pasture | [Leafy Grass](https://polyhaven.com/a/leafy_grass), photographed 2 m tile | Charlotte Baglioni |
| Soil under trees and worn ground | [Forest Ground 04](https://polyhaven.com/a/forest_ground_04) | Rob Tuytel, Rico Cilliers |
| Exposed stone | [Rock Boulder Cracked](https://polyhaven.com/a/rock_boulder_cracked) | Dario Barresi, Dimitrios Savva |

All three retain the original color. `_diff` is sRGB; `_nor_gl` and `_arm` are
linear data. ARM packs ambient occlusion, roughness and metalness in RGB.
The game combines these with terrain slope, woodland cover, weather and trail
wear. Normal sampling follows the pasture albedo's stochastic offsets.

Runtime WebP textures use 2048px albedo, 1024px normals and 512px ARM. About
7.2 MiB total, reduced from 37 MiB of source JPEGs. `manifest.json` includes
source and output hashes and exact conversion settings. Original maps remain
in `/tmp/meadowlark-ground-sources` during the build, outside the repository.

```sh
python3 tools/asset-gen/fetch-ground-scans.py
node tools/asset-gen/compress-ground-scans.mjs
```

The converter uses the dependencies in `tools/asset-gen/package.json`, or an
existing dependency directory supplied through `GLTF_PIPELINE_MODULES`.

Pine bark diffuse, OpenGL normal and roughness maps are also extracted unchanged
from the locally hosted `pine_sapling_small.glb` (Poly Haven, Rob Tuytel and Rico
Cilliers, CC0). They are shared by the botanical pine trunks and branches. See
`assets/models/world/realism/manifest.json` for the original download provenance.

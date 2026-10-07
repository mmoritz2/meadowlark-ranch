# Regional standing deadwood

The old `world-flora` snag used five straight tubes (44 triangles) repeated across four outer regions and their transitions. `deadwood-art.js` replaces every still-visible snag instance after the source models and compact geometry catalog have loaded. The cleared road/meadow sites stay cleared, and the fallback remains visible if loading fails.

Two already shipped CC0 Poly Haven assets provide the woody geometry and PBR surfaces:

- [Island Tree 01](https://polyhaven.com/a/island_tree_01), Rob Tuytel and Rico Cilliers.
- [Tree Small 02](https://polyhaven.com/a/tree_small_02), Rico Cilliers.

The original source provenance, processing and asset hashes remain in `assets/models/world/realism/manifest.json`. The derived `deadwood-lods.json` records its exact source GLB hashes, source material names, vertex attributes, indices and authored transforms. No textures or new external models are downloaded at runtime beyond those already used by the living trees. Leaf primitives are excluded.

`build-deadwood-lods.mjs` keeps all existing woody source geometry for close views and builds a compact solid mesh for distance. Both levels use the same origin and height normalization. The distant trees do not rotate to face the camera, shrink, or disappear at a culling radius. Instance selection has distance hysteresis, and near models are capped at 24 on High, 12 on Medium, and zero on Low. Every tier retains all tree sites.

Original trunk locations and 0.5 m collision radii stay intact. The root flare is fit inside that footprint, and its base is seated 4 cm below the terrain surface. Source branching and bark provide irregular silhouettes and shading. Materials remain opaque and use the original albedo, normal, roughness and ambient occlusion maps.

```sh
GLTF_PIPELINE_MODULES=/path/to/node_modules node tools/asset-gen/build-deadwood-lods.mjs
QA_PORT=8457 PLAYWRIGHT_PATH=/path/to/playwright node tools/qa-deadwood.cjs /path/to/evidence
```

The focused test checks actual instance coverage in all tiers, unchanged sites, finite geometry and pixels, usable normals, opaque surfaces/output, matching near/far footing, trunk collisions, and real mounted approaches from both sides. Regional and weather screenshots require visual inspection as well. This does not establish mobile performance or replace the separately authored Thunder Oak landmark.

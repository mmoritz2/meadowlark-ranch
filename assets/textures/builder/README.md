# Ranch builder surface scans

Five [CC0 Poly Haven](https://polyhaven.com/license) PBR texture sets:
coated pine, weathered brown planks, brown leather, rough linen, and reed thatch.
The reed fibers provide close-up hay-bale surface detail; loose fibers are geometry.

Original photographed albedo, OpenGL normals, and packed AO/roughness/metalness
are retained. Albedo is 2K, normals 1K, and packed maps 512px. Source URLs, authors,
source hashes, output hashes, and dimensions are recorded in `manifest.json`.

These are physically mapped over individual boards and furniture parts. Grain runs
along each timber's longest axis; normal and roughness channels use identical UVs.
The code uses sRGB only for albedo, and linear color space for normal/ARM maps.

Reproduce with `tools/asset-gen/fetch-builder-materials.py`, then
`tools/asset-gen/build-builder-assets.mjs`. Source JPEGs stay in `/tmp` and the
self-contained WebP runtime copies are served locally.

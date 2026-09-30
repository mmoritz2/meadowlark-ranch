# Scanned ranch builder props

Seven local glTF models from [Poly Haven](https://polyhaven.com/), licensed
[CC0](https://polyhaven.com/license). `manifest.json` records the authors, exact
source URLs, downloaded SHA256 hashes, final hashes, and triangle counts.

The original albedo, normal, roughness, metalness, and ambient occlusion channels
are retained. The flower and shrub assets include their author's separate alpha
mask. No painterly color grading is applied. Color and normal images are 1K;
packed material maps are 512px WebP. Geometry has no runtime compression decoder.
The plant files contain several complete variants; the game uses one whole
variant, including all of its material primitives.

- Wine Barrel 01 → barrel
- Wooden Picnic Table → picnic table
- Planter Box 01 → flower planter
- Wooden Lantern 01 → lantern post, oil lamp, stall lamp
- Tree Stump 01 → stump seat
- Flower Gazania → planters and flower beds
- Wild Rooibos Bush → hedge

Reproduce with `tools/asset-gen/fetch-world-realism.py` and
`tools/asset-gen/build-builder-assets.mjs`. Downloads are checked against the
official API checksums. Only models, buffers, and images are downloaded; no
third-party executable content is loaded in the game.

`assets/ranch-builder-art.js` supplies all 55 decor entries and the paddock,
training ring, and well. Structural house/stable/shed models use the existing
architecture module with the shared new wood grain. Geometry and texture resources
are shared between identical pieces. Previews use the same geometry with separate
translucent materials. Model loading upgrades existing previews and placed objects
in place, preserving their transforms and saved IDs. Planted broadleaf trees use a
full scan up close and an albedo impostor beyond 28 m.

This is a detailed browser-game asset pass. It does not imply that the whole game
or every procedural seasonal ornament is photorealistic. Profiling large player
ranches and additional specialist art remain useful future work.

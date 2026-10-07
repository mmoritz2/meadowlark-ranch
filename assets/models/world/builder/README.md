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


## Connected roadside props (October 2026)

`assets/roadside-prop-geometry.mjs` authors an original timber bench with four
rounded seat slats, a reclined two-board back, joined bearers and braces, and
forged bolt heads with washers. The 44 parts have 50 measured attachment points.
Its 2,944 triangles stay inside the existing 0.85 m roadside collision circle.
Individual board cuts use the existing CC0 coated-pine and weathered-plank maps
at their original physical grain scales; iron reuses the builder material.

The four feet fit the actual ground on the CPU. A real ring at 0.16 m limits
fitting to the lower legs, leaving seats, upper supports, joinery and their grain
fixed. Normals follow the terrain deformation's inverse transpose. Three
world-space material batches draw all roadside benches without a custom vertex
shader or recurring deformation work.

`assets/fingerpost-geometry.mjs` creates closed, 70 mm thick arrow boards with
9 mm bevels, iron straps that enter the existing posts, and attached fasteners.
Each destination retains its original direction and height. A two-face canvas
atlas keeps both faces readable; photographed timber normals and roughness use
separate metre-scaled grain coordinates. Boards cast and receive shadows.

The shared course cleanup sees the original bench rows before replacements
finish. Built sites, root poses, post/cap rows, route waypoints and collision
arrays stay fixed. Extra Three resources are constructed after seeded world
and model loading, including the second course sweep. These are original models
using already licensed local textures; no Star Equestrian assets are copied.

`tools/test-roadside-props.mjs` checks closed geometry, actual joinery,
metre-scaled UVs, collider footprints, terrain contact and independently measured
fitting normals. `tools/test-fingerpost-geometry.mjs` checks watertight arrows,
forward face atlases, grain charts and physical support contact.
`tools/qa-roadside-props.cjs` captures a revision-pinned main baseline and the
new native GPU views, compares every tree/collision/route state, measures draw
cost, and rides the Frostpine route in both directions across all graphics tiers.

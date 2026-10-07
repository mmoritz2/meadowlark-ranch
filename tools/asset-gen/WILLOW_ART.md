# Willowmere willows

`assets/willow-art.js` builds original weeping willow meshes for the six existing Willowmere tree sites. Curved scaffold limbs carry 216 pendant shoots and 9,396 individually folded, narrow leaves per tree. Two deterministic variants provide different branch spacing and hanging curtains. The geometry uses solid leaf outlines rather than rectangular foliage cards.

The bark albedo, normal and roughness maps reuse the locally hosted **CC0 Pine Sapling Small** textures by Rob Tuytel and Rico Cilliers ([Poly Haven](https://polyhaven.com/a/pine_sapling_small)). Existing provenance and texture source hashes remain in `assets/models/world/realism/manifest.json`. The willow geometry and leaf surface treatment are original; no external character, model, or new texture download is required.

The old willow generator remains as a loading fallback and consumes the same seeded random sequence. Its six roots are kept separate from merged settlement geometry, then hidden only after the detailed replacement is ready. Tree positions, orientations, one-metre trunk collision radii, regional building sites, and interactions remain unchanged. Terrain fitting seats the root flare on the local ground. The camera registers only the solid bole, so hanging foliage is not treated as a wall.

The two crown levels retain every leaf and identical bounds. Distance geometry removes the centre fold triangles without deleting leaves. Quality and distance select the near version with six metres of hysteresis. The complete six-tree contribution is capped below 650,000 triangles and reserved inside the existing living-tree budget. Wood and leaves cast and receive shadows; pendant movement is shared by the visible and shadow geometry. This bounds geometry work but does not certify mobile frame rates.

```sh
QA_PORT=8457 PLAYWRIGHT_PATH=/path/to/playwright node tools/qa-willows.cjs /path/to/evidence
```

The focused acceptance run checks six-site replacement, grounded roots, unchanged placement, outward and finite normals, both crown levels, graphics budgets, opaque render output, shadows, mounted approaches to each trunk, and WebGL/feature errors. Day, rain, night, backlit, bark and canopy-interior views also need visual inspection. Nearby marsh buildings, boardwalk construction, water shapes and the separate Thunder Oak landmark are outside this change.

# Cottonwood orchard

The twelve authored fruit-tree sites in `stats-progression.js` retain their original positions and apple-picking anchors. The old nested procedural trees serve as the loading fallback, then `world-photoscans.js` replaces them with the existing **Island Tree 01** scan by Rob Tuytel and Rico Cilliers (CC0): <https://polyhaven.com/a/island_tree_01>. The original source, local GLB processing and hashes are in `assets/models/world/realism/manifest.json`.

`orchard-art.js` attaches twelve original apple pairs to spaced points on the scan's branch geometry. It reuses the game's botanical apple geometry, with a dimpled shoulder, tapered body and red/green skin variation. Fruit geometry is merged into three shared template meshes, then joins the same instanced near-tree and eight-view distant-tree pipeline as the crown. The full template has 104,150 scan triangles plus 8,544 fruit triangles. Detailed trees, including their fruit, remain inside the existing 750,000/1,800,000 medium/high tree budgets. The low tier uses the matching baked model.

A prototype placed 3D apples over the old distant tree atlas. That looked detached from branches when the card rotated. The release instead bakes the complete fruit-bearing tree, so both geometry and fruit switch detail together. `orchard_apple_views.webp` and `orchard_apple_normals.webp` are derived from the existing licensed scan plus original fruit geometry. They introduce no additional GLB download. The source tree's sky-occlusion calculation runs before fruit is added in both runtime and bake, preserving the shared canopy material. The baker preserves vertex colours for fruit surfaces.

The orchard grass mask is shared by the near, middle and far grass layers. It changes vegetation height, not terrain or riding height, and includes the isolated tree beside the inn. Trunks retain their 0.5 m collision radius and now have a finite height matching the 3.8–4.08 m crowns.

```sh
QA_PORT=8457 PLAYWRIGHT_PATH=/path/to/playwright node tools/asset-gen/bake-world-tree.cjs orchard_apple
node --test tools/test-forage-art.mjs
QA_PORT=8457 PLAYWRIGHT_PATH=/path/to/playwright node tools/qa-village-square.cjs /path/to/evidence --orchard-review
QA_PORT=8457 PLAYWRIGHT_PATH=/path/to/playwright node tools/qa-country-world.cjs /path/to/evidence
```

Inspect the close, distant, low/medium/high, backlit, rain, night and mounted images. The village test also verifies every orchard site survives exactly once in each LOD, tree triangle budgets, short grass, the fourteen pickup nodes and their unchanged anchors, a real mounted apple pickup and respawn, trunk collisions, clear village/NPC routes and all three mounted inn arches. Desktop validation does not establish mobile performance.

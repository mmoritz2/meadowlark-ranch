# Countryside world pass — 6 October 2026

Reference: [Foxie Ventures' official Star Equestrian gallery](https://www.foxieventures.com/star-equestrian/), particularly its countryside screenshot. The observed direction is broadleaf woods, green meadow foregrounds, readable earth trails and settlements framed by hills. The scene remains original Meadowlark content; no reference-game assets were copied.

## Changes

- Spreading CC0 Poly Haven broadleaf crowns replace a deterministic portion of lowland trees. Smaller deciduous trees, conifer woods and autumn tinting remain. The model is optimized by fitting **every one of its 44,168 leaves** to its original UV rectangle rather than deleting scattered leaves. Bark, roots and branches retain their photographed materials.
- Four lowland ranges have lower, rounder silhouettes, more vegetation colour and greater atmospheric separation. Northern mountain landmarks retain their bearings and peaks. The surrounding ridge rings are softer and less visually dominant.
- Fine grass blades have more coverage without additional instances or triangles. Turf is greener, and leaf litter is concentrated nearer trunks instead of spreading brown discs across the meadow.
- Cottonwood cottages use three restrained plaster/shutter palettes, real window-box joinery and flowers. Barns and working outbuildings retain timber. The obsolete field of opaque wheat cones that intersected village buildings and streets is removed.
- Roadside hedge lobes use textured leaf sprays instead of opaque green rock geometry. Remaining older scattered boulders use the shared weathered geology model and ground contact.
- Clear weather has more blue-sky gaps; rain, night, collision surfaces and riding controls retain their behavior.

## Verification

Native Metal browser run, reproducible seed `928471`:

- `qa-country-world.cjs`: seven checks passed. 1,422 new broadleaf canopy placements, 671 botanical hedge lobes and four cottage window gardens. High used 12 detailed trees / 1,357,253 triangles, Medium six / 624,900, Low zero detailed trees. Existing budgets are 1.8M / 750K. Tree layout stays fixed across graphics changes.
- `qa-render-artifacts.cjs`: all 14 checks passed across ten views including three graphics settings, portrait, rain, night and sunset. No invalid source or postprocess pixels, WebGL errors, asset failures or console errors. Degenerate-normal and injected invalid-bloom fixtures passed.
- `qa-intro-chalk-collisions.cjs`: all 11 checks passed, including actual mounted movement stopping at a thin wall, shelter entrance clearance, moving/removing builder walls, supported dock decks and Chalk Mare surface/collision alignment.
- `qa-landscape-models.cjs`: 16 checks passed after incorporating the latest main branch, including riding through the ranch entry in both directions, six tree view variants, pasture cover and clear snowfields.
- `test-solid-collisions.mjs`: seven tests passed.
- New GLB: Khronos validator reports zero errors and three source tangent-space warnings; Three.js derives tangent space during rendering.

Six game-rendered views and matching earlier views are retained in the development evidence folder `output/equestrian-world/`. Models and view atlases are local runtime files; provenance and hashes are in `assets/models/world/realism/manifest.json` and `tree-impostors.json`.

These checks establish this pass's visual and functional behavior on the development machine. They do not establish parity with another studio's entire game, sustained performance on physical phones, or App Store release readiness. Existing procedural NPCs, more distant regional props and remaining world-art consistency need further work.

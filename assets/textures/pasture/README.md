# Pasture surface

[Grass 004](https://ambientcg.com/view?id=Grass004), by ambientCG / Lennart Demes,
downloaded from the official source on 2026-10-02. This is an authored PBR
material, not a photogrammetry scan. The [CC0 license](https://docs.ambientcg.com/license/)
allows use and redistribution in this game.

The 1.4 m tile contains continuous fine grass. It replaces leaf litter as the
open pasture surface; Poly Haven's forest-floor scan still covers wooded ground.
The original color is preserved. Color uses sRGB; normal and packed ARM use
linear data. ARM contains ambient occlusion, roughness, and zero metalness.

Runtime files total approximately 2.5 MiB: 2048px color, 1024px OpenGL normal,
512px ARM. Source and output hashes are in `manifest.json`. Rebuild with
`tools/asset-gen/build-pasture-material.mjs` after extracting the official
Grass004_2K-JPG archive's Color, NormalGL, AmbientOcclusion and Roughness JPGs
to `/tmp/meadowlark-pasture-source`.


## Shared field surface

The terrain reuses the authored grass maps with deterministic quarter-turn
sampling. Albedo and normal coordinates match; decoded normal directions account
for the existing negative-X ground tangent. Detailed terrain still uses four
samples per map, and the cheaper outer-ground path remains one sample.

The existing 1024² terrain mask now packs grazing in blue, alongside woodland
cover in red and walked ground in green. The cached grazing field comes from the
same `meadowGrazingAt` profile used by planted grass. Short field interiors have a
restrained greener tint; woodland skirts extend 30% beyond the existing core
radius, capped at 6.5 metres, while preserving every existing core texel. Grazing,
maintained yards and paths, and Cottonwood reservations suppress only new skirts.
No terrain heights, placed vegetation, routes, collision data, draw calls or GPU
textures are added. The new blue-driven tint is excluded from outer terrain.

Run `node --test tools/test-meadow-landcover.mjs` for grazing orientation and mask
channel/core preservation checks. Native visual comparisons cover fields, wooded
margins, rain and winter, with High/Medium/Low rendering and mounted route checks.

## Planted pasture

Static meadow tussocks now share the grazing profile used by travelling grass.
A final pass in `features/world-flora.js` measures actual transformed plant
height and scales eligible tussocks toward 0.26–0.34 metres in grazed interiors.
The west meadow retains its taller sward response. Water margins and dry/cold
vegetation retain their existing treatment. Counts, roots, colours, and the
seeded planting stream stay unchanged.

The fuller near grass mixes low bowed leaves with taller curved blades using
the existing 70-triangle geometry budget. It retains the original source roots,
materials, textures, wind and quality transitions.

Run `node --test tools/test-meadow-tufts.mjs tools/test-mixed-sward-production.mjs`
for grazing continuity, meadow margins, plant geometry and source/budget checks.

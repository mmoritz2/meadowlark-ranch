# Curved pasture leaves and shoreline reeds

This pass uses original procedural geometry in `assets/meadow-cover.js` and `assets/reed-beds.js`. No external model, texture, or animation was downloaded. The visual reference is Foxie Ventures' official [field riding image](https://www.foxieventures.com/wp-content/uploads/2023/01/Field-Ride-Into-A-Huge-Open-World.jpg), linked from its [Star Equestrian overview](https://www.foxieventures.com/star-equestrian/). Short grazed interiors, taller margins, narrow bending leaves, and readable waterside plants inform the work. Meadowlark retains its own world layout and original art.

Nearby grass has eight tapered, twisting ribbon leaves per tuft, with three length segments and shaded roots. Each tuft costs 40 triangles (previously 36); middle-distance tufts retain their previous 12/18/24-triangle quality budgets. The travelling near window packs only live grass and reed instances into the draw list. Empty positions on paths, buildings, water and snow no longer submit zero-scale grass. This reduces work in sparse areas but does not promise that every meadow view costs less: a completely planted window can submit up to 1,881,600 grass triangles instead of the previous fixed 1,693,440. Existing grazing, plant exclusion, height and colour fields remain in place. VR halves the live grass count and restores it correctly after relocation.

The bulrush has nine curved leaves, three round stems, two brown seed heads and fine spikes, totaling 315 triangles. River/lake reeds use this geometry in the existing local window. Nearby Amberwood and Willowmere reeds use the same model at their original positions and scale; the existing cards remain farther away. A four-metre complementary dither transition uses opaque coverage to avoid transparent rectangles in HDR output. The instance lists and transition origin advance together, so small player movements cannot reveal a missing near batch. Wind moves the tips while leaving roots fixed.

Settlement reed detail is capped at 80/180/320 instances and 16/24/32 metres for low/medium/high quality. Far reeds stop at 150 metres. At most two settlement reed draws are active; the native part costs at most 100,800 triangles. Willowmere's deck and deep-water exclusions are applied before the new layer captures its placements. Ordinary near/middle grass, flowers, scrub and legacy seed cover are also excluded from the Amberwood mill pond; its dedicated sedge sites remain. This changes vegetation only, leaving water, terrain and riding heights intact. The old quarter fade handler cannot turn the replaced cards back on. Plant geometry is decorative and does not introduce new collision barriers.

Run:

```sh
node --test tools/test-ground-cover.mjs
QA_PORT=8457 PLAYWRIGHT_PATH=/path/to/playwright node tools/qa-ground-cover.cjs /path/to/evidence
QA_PORT=8457 PLAYWRIGHT_PATH=/path/to/playwright node tools/qa-country-world.cjs /path/to/country-evidence
QA_PORT=8457 PLAYWRIGHT_PATH=/path/to/playwright node tools/qa-willowmere.cjs /path/to/riding-evidence
```

The focused checks cover nondegenerate geometry, finite normalized normals, placement retention, quality caps, relocation/return, VR restoration, shoreline/deck grounding, finite opaque HDR pixels through reed transitions, and 505 protected riding-height samples. The country suite checks grazing patterns and clear paths; the Willowmere suite traverses all twelve mounted boardwalk routes. Inspect meadow, lake, mill-pond and marsh views at all quality levels, including rain and night. These checks do not certify a mobile frame rate or complete visual parity with the reference. Generic branch-card scrub and broader biome transitions remain separate art work.

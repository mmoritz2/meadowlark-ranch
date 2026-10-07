# Coyote Canyon dry foothills

This pass replaces independently painted circular sand, seed-grass and local-cover boundaries with one irregular dry-soil weight. The intent is a green river corridor and an olive/straw foothill margin around the existing sandstone basin, informed by the varied fields and planted margins in [Foxie Ventures’ official Star Equestrian reference](https://www.foxieventures.com/star-equestrian/) and its [field-riding image](https://www.foxieventures.com/wp-content/uploads/2023/01/Field-Ride-Into-A-Huge-Open-World.jpg). It uses original project rules and the already credited CC0 plant scans; no reference-game assets are included.

`assets/biome-weights.mjs` owns the JavaScript and GLSL versions of the same weight: a 96–172 m dry band around (-220,130), warped by three deterministic sine terms. River moisture suppresses the band within 9 m of the existing channel and fades through 20 m. Raised Chalk relief fades drought from 0.12 to 1.7 m. `chalkDown.reliefAt` samples the same relief triangles the ground shader receives.

The weight drives ground albedo, meadow coverage, grass growth/color, local flowers/stones and scanned undergrowth choices. Static soft cover receives a deterministic final thinning/shortening/tint pass after all seeded planting. Its original desert-core plants remain intact, with treatment fading out before full dryness. Cold, autumn, marsh and badland plants retain their previous rules.

The 9,500-blade seed layer deliberately retains **legacy acceptance** through `hasSeedMeadowCover`. Visual rejection and new sizes happen after the original random draws. This preserves the later terrain-decoration and collision placement stream. No height, route, cliff contour, tree or cactus placement code changes in this pass.

## Validation

Run CPU checks with `node tools/test-dry-foothills.mjs`, `node tools/test-pastoral-fields.mjs`, `node tools/test-undergrowth.mjs` and `node tools/test-ground-cover.mjs`. The new rules check unchanged seed acceptance and previous growth/palette outside the band. `tools/qa-biome-weights.cjs` compares actual native-GPU GLSL weights against JavaScript, including moisture/relief endpoints.

`tools/qa-dry-belt.cjs` uses a deterministic published baseline and checks protected heights, complete primitive-valued legacy collider/wall signatures, unchanged route points, native plant budgets, stable return, source opacity, finite HDR buffers, and mounted traversal of the riverwest **transition segment** in both directions. The runtime-sited Chalk view also tests raised turf where unsuppressed dryness would otherwise be present. Country, Chalk and canyon checks validate nearby systems. For a fresh Chalk comparison, record the published build with `QA_CHALK_BASELINE`, then pass the resulting protected-ground file as `QA_CHALK_PROTECTED`; the historical fixture predates later ridge work.

## Cost and remaining work

The shader reuses one weight per fragment. Plant sampling exits outside 190 m; samples in the band add three warp sine terms and one channel sine. No new assets are downloaded, and native near/far triangle budgets remain unchanged. Wider wet-bank grass can increase visible grass instances compared with the old circular exclusion. Mobile frame rate is not verified.

This is a landscape-transition pass, not visual parity. Distant ridge color/composition, snow repetition, remaining legacy dry/cold plants and smaller props still need work. Baseline full riverwest travel also exposes an older obstruction on the canyon approach beyond the tested transition segment; track that separately instead of reporting the whole road clear. Low-sun material highlights and horse-tail facets remain visible in the baseline images.

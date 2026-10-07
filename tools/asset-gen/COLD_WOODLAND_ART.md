# Northern woodland and winter ground

The cold regions used adult pine and young fir scans at nearly the same height, with independently selected silhouettes. Frostpine also retained green pasture and flowers over its snowy footing. This pass groups mature trees into groves, lowers young regeneration, and clears summer cover from the existing winter cores.

## Reference and assets

The [official Star Equestrian countryside image](https://www.foxieventures.com/wp-content/uploads/2023/01/Field-Ride-Into-A-Huge-Open-World.jpg) informs vegetation grouping, clear riding sightlines, and the separation of foreground cover from pale distant relief. It does not establish a matching snowy game region. Hollowpeak, Frostpine, and the alpine range keep Meadowlark’s original geography. No reference artwork or proprietary game model is bundled.

The replacement snow albedo is [Snow 02 by Rob Tuytel](https://polyhaven.com/a/snow_02), published under [Poly Haven’s CC0 licence](https://polyhaven.com/license). The original 2K JPEG download was checked against the provider’s MD5, then converted to 2K WebP at quality 93. Source and output hashes, author, dimensions, and the photographed two-metre extent are recorded in `assets/textures/cold/manifest.json`. Shader exposure multiplies the photo’s measured linear albedo by 1.85 with a 0.98 cap, bringing its mean from 0.380 to 0.703 while preserving grain. The file itself remains unchanged. Existing CC0 `pine_tree_01` and three `fir_sapling_medium` sources and their matching eight-view atlases remain in use.

## Runtime behavior

`cold-woodland.mjs` provides compact climate envelopes and deterministic age/cover profiles without consuming the world random stream. Adult groves rise above shorter fir regeneration. Ground elevation and slope reduce shelter on exposed sites. Narrower adult crowns and the same placement matrix are used by detailed models, distant views, and shadow depth. Trunk X/Z, yaw, original route clearings, and colliders retain their existing values. Outside the cold influence, source models, height, and width remain exact.

The existing `terrainSnow` texture slot is replaced, retaining four blended samples on high/medium and two on low. Small grain uses a physical 2.25m scale; broad snow relief uses bounded 0.14m continuous wind cells. Analytic normals replace grass relief beneath powder on all graphics tiers. Frostpine’s existing mineral/lichen mixture determines its partial powder normal weight. Thaw margins expose irregular litter/mineral islands without changing climate footprints or riding geometry. The outer landscape retains its geometry, shader coverage, and normal logic but samples the new albedo too.

Winter cover filters the completed flora banks after seeded planting/collision calls. Flowers disappear inside winter support, turf/bracken stop in snowy cores, and evergreen scrub/reeds become sparse and low. Travelling and seeded grass retain deterministic placement streams and use the same compact winter support. Existing repeated green near-ground sprays are reduced in density and size.

The texture remains one slot, but its resolution increases from 512 to 2048 pixels. A full RGBA8 mip chain is approximately 21.33MiB versus 1.33MiB, an increase of about 20MiB. This pass does not establish phone frame rate or total GPU memory use. Tree geometry budgets remain 1.8 million high/750,000 medium; low uses distant views.

## Validation

All 26 focused CPU tests pass. They verify compact deterministic profiles, age hierarchy, matching licensed atlases, actual winter-bank outside matrices/colors, snow gradient bounds and continuity, independent finite differences, shader/resource/vertex invariants, and the outer landscape.

`qa-cold-woodland.cjs` captured 13 matched native GPU views covering snow/forest/thaw, mounted Frostpine travel, meadow/dry controls, graphics tiers, rain, golden light, and night. The initial baseline was 512a71a. After merging the current main revision ec12fc6, a fresh baseline of that revision retained the newer rider lashes and tack stall, including its collider. The exact merged native capture was rechecked against this baseline only after auditing SHA-256 hashes of all seven changed runtime files; the recheck copies the original images unchanged and does not substitute a new render. All 31 acceptance checks pass, and the images were inspected.

Terrain, geology, landmarks, routes, solid registrations, tree sites/yaw/roots, LOD matrices, and non-cold models remain exact against current main. Both Frostpine route directions complete with zero horse-ground error, camera clearance above 1.28m, and route deviation below 0.66m. Winter cover, texture slots, finite opaque HDR buffers, and WebGL errors also pass. Baseline winter-cover assertions are intentionally bypassed to measure the pre-existing summer plants; acceptance of the changed world requires their absence from winter cores.

## Remaining differences

This is a winter-coherence milestone, not complete visual parity. The station nursery saplings, some alpine summit planting, foreground props/signs, stylized water motion, horse-tail facets/roaming overlaps, and selected low-sun highlights still need work. Cold/dry legacy models are not all replaced. Mobile performance remains unverified.

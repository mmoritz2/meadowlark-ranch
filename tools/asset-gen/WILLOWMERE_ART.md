# Willowmere settlement and marsh

The original four stilt-house plots now use `buildMarshHouse` in `assets/ranch-architecture.js`: horizontal clapboard courses, recessed windows, slatted shutters, painted trim, slate roofs, gutters, stone chimneys, and a covered Eel House veranda. `assets/willowmere-art.js` builds individual timber planks, piles, cross braces, rails, framed lamps and connected landings. Model parts are merged by material after capturing narrow collision shapes.

These are original meshes. The visual reference is the material layering and defined joinery in Foxie Ventures’ [official ranch image](https://www.foxieventures.com/wp-content/uploads/2023/01/Ranch-Build-Your-Ranch.jpg), linked from the [Star Equestrian page](https://www.foxieventures.com/star-equestrian/). This is a new Meadowlark settlement, not a reproduction of a location or extracted game assets.

Existing locally hosted surfaces are reused: CC0 Poly Haven `weathered_brown_planks` and `coated_pine` from `assets/textures/builder/manifest.json`, CC0 `roof_slates_03` from `assets/textures/village/manifest.json`, and the previously generated siding/stone maps documented in `RANCH_ARCHITECTURE.md`. No new download or launcher is required.

## Ground and water

`assets/willowmere-landscape.js` uses the original seven pool centres to form an irregular smooth union at a single water elevation. The surrounding terrain lattice is shaped into a shallow basin; the same vertex heights feed visible terrain and riding. Existing willow roots and the boathouse bank retain their ground. Wet earth feathers into the bank, and water edges fade into the terrain. The shared reflection system chooses the local marsh elevation. Mist has feathered edges and lower opacity.

The old walk was decorative slabs approximately 67 cm above the horse’s walking surface. Each new plank deck and its height sampler now use the same plane. Routes widen the main promenade and join all four porches and the boathouse front. Physical rails leave junctions open. Collision proxies preserve timber rotations; a diagonal beam must not be reduced to its axis-aligned bounding box. Camera proxies cover narrow tall piles and house surfaces, not the entire walkway.

Dry ground cover is cleared from new decks and water and excluded from subsequent detail placement. The three residents move onto their porches; boats that conflict with the new boardwalk move to nearby open water. Their identities, dialogue, shop actions and regional site identities remain unchanged. House, pool and willow locations are recorded before the terrain changes. Marsh materials are allocated lazily to preserve the pre-existing seeded placement stream.

## Acceptance

```sh
QA_PORT=8457 PLAYWRIGHT_PATH=/path/to/playwright node tools/qa-willowmere.cjs /path/to/evidence
QA_PORT=8457 PLAYWRIGHT_PATH=/path/to/playwright node tools/qa-willows.cjs /path/to/evidence
QA_PORT=8457 PLAYWRIGHT_PATH=/path/to/playwright node tools/qa-country-world.cjs /path/to/evidence
```

The settlement check raycasts visible deck tops and the terrain, sweeps mounted clearance, rides each access route in both directions, checks grounded residents and boat clearance, inspects finite geometry and normals, and verifies render targets in daylight, rain, night and graphics tiers. Screenshots require visual inspection. Triangle/draw limits bound the added geometry but do not certify mobile frame rates.

The three residents reuse the existing loaded character system. Remaining limitations include the regional heron models, mast and smoke effects, willow foliage close to the arrival camera, distant terrain composition and overall mobile performance. The scenery is not visually identical to Star Equestrian.

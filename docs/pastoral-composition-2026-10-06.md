# Pastoral world composition — 6 October 2026

The visual reference is Foxie Ventures’ official [Star Equestrian countryside screenshot](https://www.foxieventures.com/wp-content/uploads/2023/01/Field-Ride-Into-A-Huge-Open-World.jpg), linked from its [game page](https://www.foxieventures.com/star-equestrian/). The target qualities are rolling foreground terrain, dense grass, violet flower colonies, layered woodland and legible village approaches. This is a closer original interpretation, not an exact reproduction or a claim of equivalent overall production quality.

## Changes

- Four compact, smooth meadow rises enter the same sampled terrain used by rendering and riding. Town, arena, home pasture and Chalk Mare footprints are protected, and river/stream grading still runs after the added relief.
- Taller curved grass with a greener colour ramp replaces the cropped near-field lawn. Maintained yard and trail margins stay short.
- A bounded 216 m grass window carries blade silhouettes into the middle distance. It adds one instanced draw, updates only entering 12 m cells and has 4/6/8 blades per tuft at low/medium/high quality. World-cell hashes preserve placements on return visits. This layer is hidden in VR.
- Eight authored flower colonies use original 146-triangle 3D lupins with green palmate foliage and lavender cupped flowers. More distant flower banks have stronger violet/pink colour and denser planting.
- Canyon formations are lower with tapered, broken crowns. Their existing ground footprints remain, and collision heights follow the new dimensions.
- Fair-weather skies have more blue openings and high cloud streaks; slightly stronger distance haze separates landscape layers.
- Both original and secondary roads reject the denser cover. Main import versions are updated for returning visitors.

## Validation

Evidence is stored in `output/pastoral-composition/` outside the disposable worktree.

- 11 Node checks: smooth bounded rises, protected footprints, continuous flower masks, finite plant geometry/normals and existing collision solver cases.
- Country-world browser acceptance: raycast terrain versus the riding sampler at 20 new hill points; grounded flower/grass instances; main and secondary road clearance; repeatable placements; adaptive grass budget; tree budgets and stable anchors; cottages; no browser, asset or WebGL errors.
- 16 landscape checks, including real keyboard-driven mounted traversal through the ranch entrance in both directions.
- 11 world integration checks, including builder placement/movement/removal, mounted wall collision, docks and continuous Chalk Mare terrain.
- 14 native-GPU rendering checks over 10 views, including all quality levels, day/night/rain, portrait, the previous black-box camera, neutral tree normals and deliberately injected invalid bloom pixels.
- Matching before/after world captures plus a normal mounted-camera meadow view.

The high-quality distant grass budget is 933,120 triangles (699,840 medium; 466,560 when switching to low in the high-quality boot). A low-quality boot allocates fewer instances. Render regression frames ranged from 8.56 to 13.35 million triangles across all passes. These are geometry limits, not a frame-rate or physical-phone performance certification.

The existing character, village and regional asset styles remain mixed; this pass improves field composition and botanical detail rather than claiming full visual parity with the reference game.

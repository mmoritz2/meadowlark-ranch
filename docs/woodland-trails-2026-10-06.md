# Clover Hill and woodland art — October 6, 2026

The lowland landscape now mixes taller, fuller green crowns into coherent groves.
A signed Clover Hill bridleway connects the Cottonwood–Barleyfold road to Highfell
Road, climbing the existing meadow rise and keeping village views open. Short
stone and hedge field boundaries frame the climb. The trail also appears on the
minimap. Its sampled test world measures 268.1 metres; final bends can vary with
the world's existing randomized obstacles.

## Models and placement

- Poly Haven's [Jacaranda Tree](https://polyhaven.com/a/jacaranda_tree), by Rico
  Cilliers with guidance from Rob Tuytel, is redistributed under CC0. The local
  manifest contains official download URLs, source hashes and runtime hashes.
- All 116,084 authored leaves survive as individually fitted textured quads.
  The runtime model has 258,718 triangles. Three materials retain the source PBR
  textures and leaf masks. The GLB is 16.23 MiB; eight-view albedo and normal
  atlases add 3.41 MiB to the first download.
- The repeatable test world contains 475 of these crowns, including 10 new trail
  trees. Nearby detailed models share the existing 1.8M/750K High/Medium triangle
  budgets; Low uses matching fixed-position views. No distance scaling is used.
- New grove trunks respect the creek, paths, race routes, existing trees and
  buildings. Their colliders are committed only after all tree views load.
- Roadside stones now use the existing 240-triangle rock scan with a neutralized
  stone tint. Timber uses the builder's photographed weathered material.

The road distance query now measures actual segments, including stretched samples
where obstacle avoidance has moved the road. Existing soft planting is cleared
from the completed road ribbons; 897 instances were cleared in the test world.
Later scan shrubs, saplings and logs use the same road-clearance query.

## Acceptance

Reports and screenshots are saved under the development checkout's ignored
`output/woodland-trail/` directory.

- `node --test tools/test-pastoral-fields.mjs tools/test-solid-collisions.mjs tools/test-village-architecture.mjs`: 13 passed.
- `tools/qa-woodland-trails.cjs`: 12 passed. Normal keyboard input advanced the
  mounted horse along all 102 path samples in both directions; only heading was
  steered by the harness, with no position writes after each starting point.
  Maximum deviation from the ribbon centre was 1.25 m. Camera coordinates stayed
  finite. New trees exercised all three quality tiers, including detailed models.
- `tools/qa-country-world.cjs`: 15 passed, including ground/render agreement,
  clear grass on roads, fixed tree layouts, geometry budgets and cottage gardens.
- `tools/qa-landscape-models.cjs`: 18 passed, including arena entrance riding in
  both directions and loading all seven tree variants.
- `tools/qa-render-artifacts.cjs`: 15 passed, covering the original failing view,
  all quality tiers, rain, day/night, portrait dimensions, neutral tree normals,
  invalid bloom input and label depth-writing regressions.
- Khronos glTF validation: zero errors and three source missing-tangent warnings.
  Three.js derives tangent space when rendering. Model and atlas bytes match the
  SHA-256 values recorded in both manifests.

## Performance sample

A sequential native-Metal comparison at High quality, 900×650, used the same
seed, camera positions and loaded assets. The meadow median/p95 changed from
54.6/57.5 ms to 51.4/54.4 ms; Clover Hill changed from 50.0/54.3 ms to
50.1/52.9 ms. The sample shows comparable frame cost, not a 60 fps claim. The
record is `output/woodland-trail/performance.json`. Clover Hill's detailed-tree
geometry was 1,731,348 triangles, below the unchanged 1.8M limit.

The update preserves the current wardrobe and Ranch Rush gameplay commits. It is
an art and trail update; it does not claim visual parity with a shipped AAA title
or mobile-store certification.

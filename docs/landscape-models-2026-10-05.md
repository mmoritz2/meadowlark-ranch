# Landscape and model pass — October 5, 2026

This pass improves woodland silhouettes, vegetation scale, terrain transitions and
arrival architecture. It builds on the NPC, mission and spatial-culling update
from `0b0109e` and the touch-builder guidance in `5f886eb`, preserving both
and the earlier black-rectangle fix.

## Changes visible in the world

- A real mature Poly Haven pine replaces a portion of the enlarged saplings.
  Its asymmetric crown, branch structure and matching eight-view distant model
  give the conifer forest a mature shape. The CC0 source is credited in
  `assets/models/world/realism/README.md`; source downloads are not shipped.
- Fine grass blades keep the previous tuft triangle count. A deterministic
  transition replaces circular grass exclusions that left green pasture bare.
  Scanned grass clumps add variation along existing trail gardens.
- Ground-cover stones use a 240-triangle moss-rock scan with existing PBR maps.
  The snowy region retains its winter core and gains a broken thaw margin.
- The arena entrance uses 57 timber, stone, cedar and iron parts with a clear
  riding opening. The direction sign is grounded beside the approach.
- Detailed trees now have triangle limits as well as count limits: 1.8 million /
  12 on High, 750,000 / 6 on Medium, and distant views on Low or VR. Selection
  hysteresis remains in place to avoid switching trees on every riding frame.

The seeded acceptance world contains 476 mature pine placements and 68 scanned
grass clumps. Other randomly generated worlds vary. The former bare pasture
sample contains 644 nearby grass tufts; the winter-core sample contains none.

## Review and verification

Visual review covers the gateway, pasture, mature tree, snow transition, ranch,
river, woodland and day/night/rain settings. A sparse early pine conversion was
rejected; the final model uses photographed twig clusters fitted to the source
canopy. The model is 90,650 triangles and 5.35 MiB. Khronos glTF validation reports
zero errors and four missing-tangent warnings; Three.js derives tangent space.
All runtime model and tree-atlas hashes match the provenance manifests.

The reproducible checks are:

- `tools/qa-landscape-models.cjs`: actual drawn grass, biome margins, loaded
  models, tree triangle budgets, entry clearance, and real keyboard-driven mounted
  passes through the entrance in both directions. It also reads rendered pixels.
- `tools/qa-render-artifacts.cjs`: source and postprocessing buffers at the
  previous failure view, three graphics tiers, weather, night and portrait size;
  neutral-normal and injected-NaN/infinity regression fixtures.
- `tools/qa-camera-obstructions.cjs`: horse and two dragon camera configurations,
  flight, and 40 final riding/walking sightlines past a solid wall.
- `tools/qa-world-finish.cjs`: exposure, contact shading, scanned scenery,
  reflections, cloud budgets, resizing and a short native-GPU frame-time sample.
- `mobile/scripts/stage.mjs`, `verify.mjs`, and `smoke.cjs`: asset inclusion,
  offline loading, save persistence and pause/resume in the staged browser build.

The combined build passed all 16 landscape checks, all 14 render-artifact checks,
all 28 world-finish checks, and the mounted/flight/walking camera checks. No tested
scene contained invalid source or postprocessed pixels, asset failures, browser
errors or WebGL errors. The gateway was ridden from z=26 to below z=15 and back
from z=14 to above z=25, keeping the mount on the center line without teleporting.

At High quality and a 900×650 viewport, the final short native-Metal sample measured
35.2 ms median / 45.8 ms p95. This is roughly 28 fps median on the development
machine, not evidence of stable 60 fps or phone performance. It remains a release
optimization target. Tree geometry stayed inside the per-tier triangle limits.

The staged mobile browser check passed offline loading, save reload, graphics
persistence and pause/resume with held controls released; it reported no browser
errors, failed requests or external requests.

The iOS development stage contains 669 files / 567.1 MiB; all staged hashes and
relative imports pass verification. The bundle retains the approved horse hashes.

Evidence is retained under `output/landscape-model-polish/` in the primary
working checkout. Tests use disposable browser saves, not the player's save.

## Release scope

This is a graphics and scenery update, not an assertion of parity with a shipped
commercial game or an App Store release. The iOS development bundle includes the
new assets. Physical-device performance, signing, branding and the existing
release gates in `mobile/release-status.json` remain unverified. No release gate
was marked complete by this pass.

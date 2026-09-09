# Ranch building geometry

`assets/ranch-architecture.js` builds original timber ranch structures with
physical wall openings, recessed glazing, timber sash/mullions, stone sills,
foundation courses, door boards/braces/ironwork, corner joinery, closed roof
gables, roof fascia/soffits/ridge caps, gutter troughs and downspouts. Cottage
chimneys have flashing, courses, capstones and recessed flues. Details are
batched by material so the barn uses 12 draws and a cottage 13 draws.

The source uses the ComfyUI-generated material files in
`assets/textures/realism/`: `siding_{albedo,normal,roughness}.jpg` and
`roof_{albedo,normal,roughness}.jpg`. UVs cover 2.4 metres per siding tile and
1.8 metres per shingle tile. All panels retain that scale when split around
windows. Texture/material objects are shared across the factory's buildings.

## Integration in ranch3d.html

```js
import {createRanchArchitecture} from './assets/ranch-architecture.js';
// Initialize after the existing glowPanes array:
const ranchArchitecture = createRanchArchitecture({THREE, glowPanes});
```

Replace only the main barn's local geometry construction:

```js
const b = ranchArchitecture.buildBarn();
b.position.set(-16, 0, -14);
scene.add(b);
// Keep existing nearby hay, trough, triggers and collision definitions.
```

Replace only the cottage's local geometry construction:

```js
function cottage(x, z, rot) {
  const b = ranchArchitecture.buildCottage();
  b.position.set(x, groundH(x, z), z);
  b.rotation.y = rot;
  scene.add(b);
}
```

The barn retains its 7 × 5.5 metre wall footprint, 4.2 metre eave height and
6.05 metre ridge. Cottages retain their 3.4 × 2.8 metre wall footprint, 2.4 metre
eave height and 3.42 metre ridge. The cottage door is now 1.98 metres high.
The helper creates local groups and never mutates scene placement, collisions,
navigation, quests or saved data. Shared interior window materials are registered
with the game's existing day/night `glowPanes` mechanism.

Optional additive detail for the existing run-in shelter:

```js
ranchArchitecture.detailRunIn(sh); // before its existing placement/scene.add
```

This adds support posts/braces and fascia while preserving the open entrance.
Calling it a second time returns the same detail group without duplication.
`sidingMaterial` and `roofMaterial` are exposed if callers explicitly choose to
resurface other known building meshes.

## Verification

```powershell
node --check assets/ranch-architecture.js
node tools/asset-gen/check-ranch-architecture.mjs
```

The geometry check verifies finite vertex attributes, glazing recessed behind
the wall plane using raycasts, solid wall areas and idempotent shelter details.
Results are saved in `output/architecture-review/validation.json`.

The isolated browser review at `output/architecture-review/index.html` loads
the real material assets. The web-game Playwright client rendered and inspected
`output/architecture-review/capture/shot-0.png` with no browser errors. Barn and
cottage together contain 8,192 triangles; the review floor adds two.

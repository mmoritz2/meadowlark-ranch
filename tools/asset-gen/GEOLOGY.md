# Canyon and boulder geometry

`assets/geology.js` provides deterministic, original sedimentary formations.
The material uses the local `realism/rock_{albedo,normal,roughness}.jpg` maps at
3.2 metres per tile. Albedo remains grey-taupe with restrained mineral tint;
there are no orange painted bands or separate olive-coloured lids.

Mesas have asymmetric eroded outlines, vertically continuous clefts, uneven
bedding thickness, offset rock benches, closed irregular plateaus and an apron
of debris. Cliff, top, apron and fragments share one geometry/material, so each
formation costs one draw call. Boulders use bevelled fractured blocks rather
than noisy spheres. Helpers do not create or modify collision objects.

## API

```js
import {createGeology} from './assets/geology.js';
const geology = createGeology({THREE, scene, groundH});

const mesa = geology.makeMesa(radius, height, seed);
const spire = geology.makeHoodoo(radius, height, seed);
const rock = geology.makeBoulder(radius, seed);
```

These return objects with their base at local Y=0 and do not add them to the
scene. Boulders have a small intentional ground overlap. For placement on
uneven terrain:

```js
geology.groundAt(mesa, x, z); // conforms lower vertices and sets position
scene.add(mesa);
// Equivalently, creation + conformity + scene.add in one call:
geology.placeMesa(x, z, radius, height, seed);
geology.placeHoodoo(x, z, radius, height, seed);
```

`groundAt` is idempotent and supports repositioning from saved reference
coordinates. It bends only the foundation/talus region; the upper cliff keeps
its authored shape. Pure `makeBoulder` can use `{grounded:false}` as a third
argument when a caller specifically needs a centre-based mesh.

## Existing generation sites to replace

1. **Coyote Canyon's rocks block**, identified by `const CX=CANYON.x` and
   `let mesas=0,hoodoos=0`: replace each six-ring `stack(...)` call with
   `placeMesa(...)` or `placeHoodoo(...)`. Keep `okRock`, terrain/path clearance,
   dimensions, count limits and collider additions. Remove the superseded
   `P/C/I`, `BANDS`, `bandAt`, `stack` and final merged `rg2/rocks` assembly.
   The former stack consumed 108 RNG calls per formation. If exact previous
   seeded world positions are desired, consume that many `rnd()` calls after
   each replacement, or precompute existing positions before creating geometry.
2. **Four zones of Kestrel Basin mesa loop**, identified by `redRockMat` and
   `for(let i=0;i<8;i++)`: replace the `CylinderGeometry`, cone skirt and cap
   construction with `placeMesa(x,z,rad,hgt,seed)`. Keep the river clearance and
   collider. Do not carry over the old `hgt*.36` or `hgt*.84` position offsets;
   helpers use a ground-level origin.
3. **Procedurally jittered boulders loop**: replace its icosahedron deformation
   with `makeBoulder(s,seed)` and position at `(x,groundH(x,z),z)`. Keep collider
   sizes and placement checks. Hollowpeak Falls has a separate 16-boulder pool
   loop which can use the same helper.
4. **Generated prop boulders** remain a distinct `FOLIAGE.boulder`/`placeFoliage`
   path. Replacing only the procedural boulder loop leaves the old glossy GLB
   props in the meadow. They can be replaced with helper geometry or instanced
   from a small set of helper variants while preserving existing transforms.

## Cost and validation

- Example 10 m radius, 18 m high mesa: 13,080 triangles, one draw call.
- Example 1.8 m radius, 10 m high spire: 4,968 triangles, one draw call.
- Boulder: 192 triangles, one draw call.
- Material/texture resources are shared across all helper outputs.

Run `node tools/asset-gen/check-geology.mjs` for finite-attribute, seeded
determinism, upward-facing closed-top raycast, terrain-contact and idempotent
grounding checks. Results are in `output/geology-review/validation.json`.

The web-game Playwright client rendered the local material review page at
`output/geology-review/index.html`. The inspected screenshot is
`output/geology-review/capture/shot-0.png`; no browser errors were reported.

## Hollowpeak waterfall cliff

`makeWaterfallCliff({width, lip, foot, seed, notchWidth})` creates two solid,
asymmetric rock shoulders, their irregular closed crowns, a recessed source
ledge, deep back/end surfaces and merged fallen stones. `width` is the **full**
width; the existing waterfall's `WID` constant is its half-width.

Replace only the old `cp/cc/ci` cliff grid through `scene.add(cliff)` with:

```js
const cliff = geology.makeWaterfallCliff({width: WID*2, lip, foot, seed: 9031});
cliff.position.set(FX, foot, FZ);
scene.add(cliff);
```

Retain the collider loop and the existing falling-water, foam, pool and mist
code. `lip` and `foot` are the existing absolute world elevations, but the helper
returns local geometry whose Y=0 corresponds to `foot`. The central gap is 6.4 m
wide near the source and broadens toward the plunge pool; the water sheet at
local Z=0.45..2.85 remains in front of the recessed source rock.

The 34 m wide review asset uses 15,768 triangles and one material/draw call.
`node tools/asset-gen/check-waterfall-cliff.mjs` verifies finite data, 95
unobstructed water-sheet sample points, front/back surface winding, roughly 9 m
of actual rock depth and a closed upward-facing top. The inspected browser
review is `output/waterfall-review/capture/shot-0.png`; the test reconstructs
the existing water dimensions to show alignment and reported no browser errors.

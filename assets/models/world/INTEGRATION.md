# Placing these models in the world — the glue that is still missing

Nothing in this commit is wired into the game. These are files plus provenance; a feature
package has to place them, and this package does not own one. Here is exactly what that
package needs to do, written from measurements taken with the models loaded into the running
scene.

## Which package

**`assets/features/world-quarters.js`** is the natural owner and is currently an empty stub
(`export function install(G){}`), so it is free. `world-flora.js` owns natural scatter and
`world-paths.js` owns routes; yard dressing belongs with the quarters that are being built.

`install(G)` receives the game object, and `G.scene`, `G.THREE` and `G.camera` are on it, so a
package can load and add models without touching `ranch3d.html`.

## Do **not** route these through `placeFoliage`

`placeFoliage(name)` at `ranch3d.html:4134` is the existing GLB path, and it is the wrong one
here, for three separate reasons:

1. **It takes the first mesh only.** `let src=null; g.scene.traverse(o=>{if(o.isMesh&&!src)src=o;})`.
   Nine of these twelve are a single mesh with a single material and would survive that;
   `wooden_picnic_table` (2 meshes), `wooden_lantern_01` (2, the second is the glass) and
   `modular_wooden_pier` (3) would silently lose parts.
2. **It rescales everything to a fixed height** via `FOLIAGE_H[name]/h`. These models are
   already in correct real-world metres — a 0.87 m barrel, a 2.24 × 3.02 m picnic table, a
   19 m pier — and must be placed at scale 1.
3. **It sinks props into the ground** by `0.06 * FOLIAGE_H[name] * s`, which is right for a
   shrub and wrong for a crate.

## What the placement code needs to do

```js
const g   = await new Promise((ok, no) =>
  new GLTFLoader().load('assets/models/world/props/wine_barrel_01.glb', ok, undefined, no));
const root = g.scene;

// the same material treatment placeFoliage applies, and for the same reason:
// these are PBR photoscans and the game is a soft, low-spec, unlit-ish look
root.traverse(o => { if (o.isMesh) {
  o.material.roughness = Math.max(o.material.roughness ?? 1, 0.9);
  o.material.metalness = Math.min(o.material.metalness ?? 0, 0.05);
  o.castShadow = true; o.receiveShadow = true;
}});

const box = new THREE.Box3().setFromObject(root);   // before any transform
root.scale.setScalar(1);                            // real metres — never rescale by height
root.position.set(x, groundH(x, z) - box.min.y, z); // sit on the ground, do not sink
root.rotation.y = yaw;                              // see the table below
scene.add(root);
```

`groundH(x, z)` is the analytic ground height used everywhere else in `ranch3d.html`. A
package that cannot reach it can raycast straight down against the `Pasture terrain` mesh;
that is what the verification harness did and the two agree.

Add a collider for anything a horse should not ride through —
`colliders.push({x, z, r})` with `r` from the table — otherwise the player rides through the
picnic table.

## Per-model facing and footprint

Poly Haven has no consistent forward axis, so each model needs its own yaw. Sizes are the
measured world-space bounding box, in metres, at scale 1.

| model | size X × Y × Z | yaw notes | collider r |
|---|---|---|---|
| `wine_barrel_01` | 0.74 × 0.87 × 0.75 | radially symmetric, any yaw | 0.40 |
| `wooden_crate_01` | 0.82 × 0.35 × 0.40 | long axis is **X** | 0.45 |
| `wooden_crate_02` | 0.53 × 0.46 × 1.16 | long axis is **Z** | 0.60 |
| `wooden_bucket_01` | 0.36 × 0.55 × 0.34 | any yaw; handle arcs over X | 0.20 |
| `wooden_bucket_02` | 0.61 × 0.35 × 0.61 | any yaw | 0.32 |
| `wooden_ladder` | 0.96 × 1.33 × 0.50 | A-frame; opens across **X**, so yaw π/2 to face a wall | 0.50 |
| `wooden_picnic_table` | 2.24 × 0.74 × 3.02 | benches run along **Z** | 1.40 |
| `planter_box_01` | 0.90 × 0.42 × 0.41 | long axis is **X**; put the long face out | 0.45 |
| `wooden_lantern_01` | 0.22 × 0.52 × 0.23 | any yaw; 2 materials, the second is glass | none |
| `watering_can_metal_01` | 0.19 × 0.19 × 0.45 | spout points **+Z** | none |
| `stone_fire_pit` | 1.45 × 0.38 × 1.43 | any yaw | 0.75 |
| `buildings/modular_wooden_pier` | 3.05 × 7.51 × 19.02 | deck runs along **Z**; it is a **modular** span — tile it along Z and sink the piles to the waterbed | per-pile |

Nine of the twelve are one mesh with one material, so they can be instanced with
`THREE.InstancedMesh` exactly the way `placeFoliage` does — that is the right approach for
barrels, crates and buckets, which will be repeated across the map. The picnic table, lantern
and pier must be added as ordinary `Group`s.

## Budget

All twelve together are 2.6 MB and 11 000 triangles. Load them lazily, the way
`ranch3d.html:4160` already defers foliage until the mount is up, so they do not compete with
the horse for bandwidth on the loading screen.

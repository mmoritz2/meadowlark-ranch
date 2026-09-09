# Original hero horse strands

`strand-atlas.png` is a 2048 × 1024 RGBA atlas with eight vertical clump variants.
The first six contain about 260 fine hairs each. Column 6 is lighter density;
column 7 contains sparse flyaways. Root density reduces into staggered fine
tips. Transparent RGB is filled with neutral strand color to avoid matte rims.
No photography, generated model, or external horse asset was used for this map.

Reproduce the bitmap with:

```powershell
node assets/textures/horse-hair/generate-atlas.cjs
```

The deterministic seed is 704821. The script uses Playwright's browser canvas
on CPU. `atlas.json` records alpha coverage at the runtime cutoff. The preview
composites the RGBA over sage gray; it is not used by the game.

## Integration

```js
import {createHeroHorseGroom} from './assets/hero-horse-groom.js';
const groom = await createHeroHorseGroom({
  THREE, skin, bones: skin.skeleton.bones, profile,
  maneColor: '#302820', tailColor: '#302820', seed: 'hero-bay'
});
```

The asynchronous factory waits for the shared texture before attaching either
mesh. It returns `mane`, `tail`, `meshes`, `stats`, `setColors`, and `dispose`.
It does not change the source body or remove authored solid hair. Source mane
and tail hair should be removed before fitting this groom.

`profile.anchors` (or explicit `anchors`) is in the source skin's rest space:
X forward, Y up, Z lateral. Required arrays: `crest` from poll to withers and
`tail` from dock to tip. Optional `poll`, `eyes` (pair), and `muzzle` improve
forelock placement. The source geometry and anchors must share coordinates.

For an unrigged hero, omit `skin` and supply `mount`, `anchors`, and optionally
`surfaceMesh` with geometry in that mount's local coordinates. It returns normal
Mesh objects. For a differently indexed skeleton, supply `boneMap` (or
`profile.groomBones`) with `neck`, `head`, and `tail` arrays of bone indices or
names. The default is the ranch's 33-bone rig: neck 3/4/5, head 5/6, tail 19–22.

`profile.heroGroom` accepts `scale`, `maneLength`, and `tailLength` multipliers.
`scale` adjusts hair dimensions; it does not move supplied anatomical anchors.
An explicit `scale` is used identically for static and skinned horses. Only
profiles without `scale` derive stature from the rig's neck length. The finished
hero uses `scale: 0.82`, `maneLength: 0.9`, and `tailLength: 1.16`.
No animation loop or separate skeleton is required; skinned hair shares the
horse's skeleton and bind matrix. Static hair follows its mount transform.

Both meshes use alpha-tested, depth-writing materials with fine-strand cutouts.
Custom depth and point-light distance materials use the same texture and alpha
cutoff, so shadows follow the cutouts. Texture is shared; geometry and materials
are owned by the returned groom and released by `dispose`.

Current bay groom: 274 cards, 10,472 triangles, two draw calls. Tests and close
views are in `output/hero-hair-qa/`; the original `horse-groom.js` is preserved.

The finished hero prototype's rig and surface-fit checks are in
`output/hero-rig-qa/`. `verify-groom.cjs` verifies identical static/skinned rest
hair positions, normalized weights, all five skinned meshes at rest, and finite
neck/dock motion. The forelock projects its full width onto the raised forehead
from between the ears. This fit work does not remove the remaining source neck
flap or improve the painted coat; the generated body is still an art prototype.

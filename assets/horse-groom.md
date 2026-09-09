# Breed groom geometry

`createBreedGroom` in `horse-groom.js` creates an original deterministic groom in
the source horse's rest coordinates: X forward, Y up, Z across. It shares the
horse's existing 33-bone skeleton and bind matrix. No image downloads, alpha
cards, extra skeleton, or runtime GPU simulation are required.

```js
const groom = createBreedGroom({
  THREE, skin, bones, mount, profile,
  maneColor, tailColor, featherColor, seed
});
```

The return value contains `mane`, `tail`, optional `feathers`, `meshes`, `stats`,
`setColors`, `update`, and `dispose`. Existing neck and tail animation moves the
groom; `update` is intentionally empty. Each part is one skinned draw call.

## Shape controls

`profile.groom` may be a style string or an object with `style`, `maneLength`,
`maneVolume`, `tailLength`, `feathering`, and `paleColor`. Length and volume are
multipliers; feathering is from zero to one. Optional `dockInset` controls how
far the first hair rings sit inside the dock (default 0.024 source units, scaled
to stature). It fades immediately and adds no visible root volume.
Styles include natural, wavy, heavy,
and upright. Manifest aliases `long` and `sparse` are supported.

`profile.anchors.crest` runs from poll to withers and `anchors.tail` from dock to
tip, both arrays of skin-local rest points. `poll` and paired `eyes` landmarks
shape the forelock. The actual rest mesh is sampled so hair remains outside a
breed's wider neck and larger forehead. Source geometry should omit its old
solid mane and tail hair.

Crest and forehead roots use exact barycentric intersections with nearby rest
triangles, indexed in a small X/Z grid. This lets hair settle both upward and
downward when anatomy changes without following the ear cups. The forelock
follows the skull closely instead of bridging between raised landmarks.

## Current construction

- A short irregular inner mane volume supports overlapping curved locks. Their
  length, lateral drift, curl phase, depth, and taper vary independently. The
  inner volume ends well above the silhouette, avoiding a straight curtain hem.
- Tail locks follow the articulated dock and expand into a fuller plume. Fine
  outer wisps end at different heights and travel along different curves.
- Draft feathering concentrates behind the fetlocks. Staggered roots, short
  inner tufts, and many narrow outer hairs replace a uniform ankle cuff.
- The upright Fjord groom keeps pale outer rows around a continuous dark center.
- A small shared procedural normal texture provides longitudinal strand detail;
  geometry carries the silhouette and close-range volume.

Default feather color is muted cream for draft breeds and the mane color for
Friesians. Body color does not reliably encode white socks. An explicit
`featherColor` overrides all four feet.

## Verification

The dedicated rest-pose harness is `output/horse-groom-review/index.html` and
accepts `model`, `breed`, `manifest`, `side`, `rear`, `light`, `groomonly`, and `pose` query
parameters. `render_game_to_text` reports geometry counts, finite positions,
and skin-weight error. Screenshots are generated with the installed
`develop-web-game/scripts/web_game_playwright_client.js` and visually inspected.
Use `focus=dock` or `focus=head` for anchor-centered closeups of a candidate
model; `manifest` should point to that candidate's matching landmark file.
The soft-flow revision's Shire groom is 24,510 triangles and three draw calls;
the most expensive supported style/feather combination remains below 25,000.

Generation uses only deterministic JavaScript geometry. The module is the
complete reproducible source; no intermediate external model is required.

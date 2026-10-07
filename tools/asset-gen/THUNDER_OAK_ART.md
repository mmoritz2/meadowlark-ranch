# Thunder Oak

`assets/thunder-oak-art.js` replaces the original landmark's straight primitive trunks and foliage spheres with original curved geometry. Two open-sided stems have recessed, closed lightning scars. Eleven terrain-fitted root buttresses and curved scaffold limbs support the dead crown and one surviving leafy bough. There are 2,700 solid lobed leaf outlines, with matching deformation in the colour and shadow passes. Twelve cloth ribbons use the same wind clock.

The three local bark maps are **Bark Brown 02** by Rob Tuytel, released under [Poly Haven's CC0 licence](https://polyhaven.com/license). The [asset page](https://polyhaven.com/a/bark_brown_02) identifies a one-metre texture scale. Source metadata, verified download MD5s, SHA-256 hashes, conversion dimensions and local output hashes are in `assets/textures/landmarks/manifest.json`. The original 1K JPEG maps were converted to 1K WebP at quality 93. Shrine timber and stone reuse existing ranch-builder materials. Tree, leaf, root, ribbon and stone geometry is original.

The visual comparison used Foxie Ventures' official [Star Equestrian overview](https://www.foxieventures.com/star-equestrian/) and its [open-world riding image](https://www.foxieventures.com/wp-content/uploads/2023/01/Field-Ride-Into-A-Huge-Open-World.jpg): visible bark, varied branch silhouettes and foliage gaps were relevant qualities. This is Meadowlark's existing lightning-struck landmark, not a recreation of a location or asset from that game.

The old generator remains as a loading fallback and retains its random sequence and landmark positioning. Only a complete replacement hides it. A 6.8-metre planting exclusion prevents later forest passes from filling the split with another tree. The label, map marker, arrival reward and readable story remain at their original location. The shrine retains its three original post locations.

Physics uses short trunk/root segments and transformed shrine parts. Camera proxies cover low solid wood and shrine objects, not the full crown's bounding box. Render and physics geometry share the sampled terrain. Detailed leaves are used within 72 metres on high quality and 45 on medium, with six metres of hysteresis; low quality and XR use the simplified outline. Both levels keep every leaf and identical bounds. The entire wood/leaf contribution is reserved inside the living-tree budget. This constrains geometry work; it is not a mobile frame-rate certification.

```sh
QA_PORT=8457 PLAYWRIGHT_PATH=/path/to/playwright node tools/qa-thunder-oak.cjs /path/to/evidence
QA_PORT=8457 PLAYWRIGHT_PATH=/path/to/playwright node tools/qa-country-world.cjs /path/to/regression-evidence
```

Acceptance covers finite geometry and unit normals, outward-facing bark and scars, sealed split edges, matching leaf bounds, graphics budgets, opaque materials and HDR output, colour/shadow wind materials, narrow camera clearance, four actual mounted approaches and a ride alongside the shrine. Inspect the front, split, reverse, leaf, shrine, route, rain, night, backlit, low/medium quality and mounted views. The countryside regression covers the wider tree budget and landscape. This change does not finish the distant hills, remaining settlement dressing, or broader world-art goal.

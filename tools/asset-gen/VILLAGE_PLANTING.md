# Cottonwood planting

`assets/village-planting.js` authors two compact plant forms for the public square:

- A branching columnar evergreen, with a tapered trunk, ascending shoots, curved needle sprays, and stable seeded variation. Three fixed trees use two instanced draws and 22,500 triangles. Their trunk positions and collisions are preserved; heights are 8.7–10.2 m. These always-visible crowns are included in the nearby tree triangle budget.
- Rounded flowering borders in the four existing raised beds. Sixty-four overlapping crowns use 2,432 small flowers and dense lower leaves, in one draw and 83,456 triangles. Crowns reach roughly 0.95–1.10 m above the ground, including the raised soil. Instance bounds stay within the beds with a small leaf overhang. The original whole periwinkle specimens remain in the window boxes.

The geometry is original. Evergreen sprays reuse `assets/textures/realism/foliage_needle_rgba.png`, whose generation and matte processing are documented in the adjacent manifest. The flower/leaf shapes sample the existing Poly Haven **Periwinkle Plant** albedo, normal, and ARM atlas. That source is by Amal Kumar, CC0: <https://polyhaven.com/a/periwinkle_plant>. Source hashes and the existing GLB processing are in `assets/models/world/gardens/manifest.json`. No extra model or texture files are downloaded for this change.

The new border has no source vertex-color attribute; its cloned scan material explicitly disables vertex colors. Retaining the scan's vertex-color setting made a prototype render black. Both types use the existing opaque alpha-to-coverage handling. Evergreen shadow geometry follows the same small wind deformation as its visible geometry.

Run the native-GPU scene, mounted routes, and garden views with:

```sh
QA_PORT=8457 PLAYWRIGHT_PATH=/path/to/playwright node tools/qa-village-square.cjs /path/to/evidence --garden-review
QA_PORT=8457 PLAYWRIGHT_PATH=/path/to/playwright node tools/qa-country-world.cjs /path/to/evidence
```

The focused review includes close and distant views, low/medium/high graphics, rain, night, backlighting, finite rendered pixels and opaque canvas output. It also checks actual material/attribute compatibility, finite geometry, foliage extent, visible/cast shadow flags, trunk collisions, every village street and NPC route, plus mounted entries through all three inn arches. Inspect the rendered images as well as the JSON checks. Desktop checks do not establish mobile performance.

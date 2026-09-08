# Groomed horse asset — September 2026

`horse_showcase_rigged.glb` is a Blender refinement of the project's existing
`horse_textured_rigged.glb`. The original file is preserved.

The main problem was baked illumination in the original albedo: hard white
reflections and black muscle bands made the horse look metallic even with a
rough material. The new 2048 px albedo was baked from an **emission shader** in
Blender 5.2, so it contains material color rather than studio lighting. It has a
natural chestnut coat, cream mane/tail, clean socks, and dark hooves and muzzle.
Original atlas chroma supplies the mane and forehead markings; anatomical vertex
masks prevent body highlights and shadows from becoming coat markings. A new
1024 px tangent normal adds subtle coat grain instead of reinforcing the old
painted shadows. Smooth face shading is enabled; the existing anatomical mesh
and UV layout are preserved rather than subdivided.

## Deliverables

- `assets/models/horse_showcase_rigged.glb`: self-contained game asset, about 5.9 MB.
- `assets/models/horse_showcase.blend`: editable source, packed maps, masks,
  original atlas, natural coat material, and studio camera/lights for review.
- `assets/textures/horse_natural_albedo.png`: emission-baked chestnut albedo.
- `assets/textures/horse_natural_normal.png`: fine coat tangent normal.
- `output/horse-review/horse-original.png` and `horse-refined.png`: comparable
  studio renders. Side views are also included.
- `output/horse-review/validation.json`: compatibility check results.

## Integration

Use the new GLB for both preload and GLTFLoader. If the game overwrites its normal
map, switch that reference to `horse_natural_normal.png` with `flipY=false`.
Recommended material: roughness 0.72, metallic 0, clearcoat 0.06,
clearcoat roughness 0.6, normal scale approximately 0.45.

The new body albedo's linear luminance is approximately 0.14. The existing coat
recolor shader's 0.42 divisor should become 0.14. Cream markings have luminance
around 0.63 and dark details around 0.024; a body recolor mask such as
`smoothstep(.045,.09,L)*(1.-smoothstep(.38,.54,L))` preserves both.

## Rebuild and validation

Run from the repository root:

```powershell
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' --background --factory-startup --python tools/asset-gen/refine_horse.py
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' --background --factory-startup --python tools/asset-gen/validate_horse.py
```

The pipeline uses an isolated background scene; it never opens or modifies the
user's Blender session. Export selection excludes Blender's hidden Icosphere
bone-display helper and the review studio. Original glTF joint transforms and
inverse bind matrices are copied back after export to eliminate bone-roll
round-trip drift through Blender.

Validated by importing both shipping GLBs into Blender:

- All 33 joint names, order and parents match.
- Bind matrices match exactly.
- Maximum vertex position difference: 0.000000477 units.
- Maximum skin weight difference: 0.000000119.
- Both assets contain 40,000 triangles. Export splits 29 vertices at attribute
  seams (26,087 to 26,116), without adding polygons or changing the shape.

This improves the existing surface and material fidelity. It does not replace
the generated horse's anatomy, solid mane geometry, or procedural animation
with a production sculpt and authored gait library. Runtime hair and tack remain
the game's responsibility.

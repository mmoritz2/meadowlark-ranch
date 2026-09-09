# Original environment materials — realism pass

Generated locally with the existing ComfyUI FLUX.2 dev fp8mixed pipeline on
September 8, 2026. These assets use realistic timber, stone, and woodland detail
in a coherent maintained-ranch palette. No downloaded game materials are used.

## Runtime files and calibration

Each material has 1024 x 1024 JPEG files named `<name>_albedo.jpg`,
`<name>_normal.jpg`, and `<name>_roughness.jpg`.

| Name | Surface | Patch size | Mean albedo sRGB | Normal scale | Roughness mean |
| --- | --- | --- | --- | --- | --- |
| `siding` | Off-white painted vertical timber | 2.4 x 2.4 m | 192, 188, 174 | 0.48 | 0.86 |
| `roof` | Weathered charcoal-brown cedar shakes | 1.8 x 1.8 m | 92, 87, 75 | 0.52 | 0.92 |
| `rock` | Grey-taupe sedimentary limestone | 3.2 x 3.2 m | 135, 132, 119 | 0.70 | 0.94 |
| `forest_floor` | Brown earth and fine leaf litter | 2.0 x 2.0 m | 108, 96, 70 | 0.42 | 0.97 |

Use `THREE.SRGBColorSpace` for albedo and `THREE.NoColorSpace` for normal and
roughness. Share the same UV repeat, rotation, wrapping and anisotropy between a
material's three maps. Use neutral white material color and `roughness: 1` when
binding the roughness map. Normal scale values above are starting points for the
generated conservative detail maps, not world-space displacement amplitudes.

Siding boards run vertically in the image. Cedar shingle courses run
horizontally. Retain that orientation in architecture UVs. Sedimentary rock
layers should read mostly horizontally on vertical cliff faces, so a world-space
or triplanar mapping is preferable to stretching a square over an entire hill.
Forest-floor leaf fragments are authored at 2 metres per tile and should remain
small underfoot. If stochastic offsets are used, apply the same sample positions
to albedo and normal textures.

## Foliage card

`foliage_branch_rgba.png` is an original non-tiling 1024px leaf-and-twig spray for
foliage cards, with a true alpha channel. It was generated against white and
extracted using white-distance, chroma, and dark-foreground tests to suppress
neutral specimen shadows. Tiny-hole cleanup and a one-pixel feather keep the
edge crisp. Transparent gutters and partial edge pixels are filled with nearby
opaque leaf color to prevent white or black mip halos. The original
white-background generation remains in `source/`.

Use sRGB, `ClampToEdgeWrapping`, `DoubleSide`, and an alpha-test material; start
with `alphaTest: 0.40` and use the same map for the depth/shadow material.
`foliage_branch_preview.jpg` shows the card against a checkerboard.

`foliage_needle_rgba.png` is the corresponding dense conifer spray for pine and
spruce foliage. It has 45% foreground coverage to retain density through mipmaps,
and a calibrated mean opaque sRGB of approximately 88, 108, 66. A bright neutral
pixel veto runs after mask cleanup, and a separate trusted needle-color mask
supplies every gutter and contaminated edge color to avoid white rims. Use the same alpha-test, shadow
map, color-space and gutter conventions. `foliage_needle_preview.jpg` and
`foliage_needle.manifest.json` record the finished card and its generation;
`foliage_needle_dark_preview.jpg` checks the silhouette against a dark background.
Reproduce it with `tools/asset-gen/gen_foliage_needle.py` (or `--finish-only`).

## Reproduction

From the project root, with the local ComfyUI server idle on port 8188:

```powershell
& 'C:\Users\msmor\Documents\ComfyUI\.venv\Scripts\python.exe' tools/asset-gen/gen_realism_materials.py siding roof rock forest_floor
& 'C:\Users\msmor\Documents\ComfyUI\.venv\Scripts\python.exe' tools/asset-gen/gen_foliage_branch.py
```

The environment-material runner performs generation and finishing in sequence;
it saves each runtime set as soon as its GPU job completes. Add `--finish-only`
to either command to rebuild its runtime files from saved PNGs without using the
GPU. Existing pastoral and original game textures are preserved.

- `manifest.json`: prompts, seeds, patch sizes, palette calibration, image hashes,
  luminance, texture-boundary statistics and runtime paths.
- `foliage_branch.manifest.json`: foliage prompt, seed, alpha method and coverage.
- `source/`: original unmodified ComfyUI PNGs and their embedded metadata.
- `tools/asset-gen/workflows/realism/`: exact API graphs and successful histories.
- `material_preview.jpg`: all four materials in one contact sheet.
- `*_tile_preview.jpg`: each material repeated in a 2 x 2 grid for visual QA.

The material albedos receive a restrained color balance and periodic
low-frequency boundary correction. Normal and roughness are conservative
albedo-derived detail estimates, not measured scans; large geometry, contact
shadows and silhouette relief come from the scene meshes and lighting.

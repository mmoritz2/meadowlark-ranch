# Dry ground material

[Sandy Gravel 02](https://polyhaven.com/a/sandy_gravel_02), by Dario Barresi at Poly Haven, replaces the terrain's grid-pattern sand with photographed granular soil. The downloadable maps are [CC0](https://polyhaven.com/license), including commercial use and redistribution. The source tile covers **2.53 × 2.53 metres**; Poly Haven displays its rounded width as 2.5 m.

Only two textures ship at runtime:

| File | Treatment | Size |
| --- | --- | --- |
| `sandy_gravel_02_diff_1k.jpg` | Original, unchanged 1024² sRGB albedo | 947,222 bytes |
| `sandy_gravel_02_surface.png` | 1024² linear RGBA8 data; lossless packing | 2,805,291 bytes |

The packed PNG stores **R = normal X, G = normal Y, B = roughness, A = ambient occlusion**. These are unchanged decoded bytes from the official OpenGL normal R/G and ARM G/R channels. Decode normal XY with `value * 2 - 1`. Alpha is data, not transparency; use `THREE.NoColorSpace` and `premultiplyAlpha=false`. Metalness remains zero. Normal Z is omitted because the terrain relief consumes only XY; other normal consumers must reconstruct Z.

Albedo and packed data must use identical world UVs. Apply the matching rotation to normal XY in the terrain's retained tangent convention. Exposure and biome tint are shader settings, not alterations to the source files. The packed data replaces separate normal and ARM samplers so this pass adds only one runtime sampler.

## Reproduce

Use Python with **Pillow 11.3.0**. Download the exact three 1K JPGs listed under `source_files` in `manifest.json` into a local source directory. The official normal and ARM JPGs are build inputs; they are not additional runtime assets.

```sh
python3 tools/pack-dry-ground.py --source /path/to/dry-sand-source --output /path/to/dry-ground
```

The tool checks every source SHA256, official MD5, byte size and image dimensions before writing anything. It emits the original diffuse, the packed PNG and `manifest.json`, including provenance, physical scale and runtime hashes. It also checks the packed PNG against the reference hash and verifies every decoded channel byte. No resizing, recolouring, inversion or generated texture content is involved.

The two runtime textures total **3,752,513 bytes**. Do not confuse this with the three source JPGs' 2,952,910 bytes. PNG stores the packed data losslessly; it does not remove compression already present in the source JPGs.

## Visual scope

The reviewed dry-rocky view loses the conspicuous sand grid and gains fine warm grit. This is a terrain material pass; placement, geometry and riding physics are outside its scope. A pale straight-edged polygon at the mound/route join in the dry-grain view remains unresolved; the available comparison does not establish whether it predates this change. The palm-obscured plaza and grass-only riverbank captures do not establish exposed sandy-bank quality.

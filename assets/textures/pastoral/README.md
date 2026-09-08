# Pastoral terrain material set

Original assets generated locally with ComfyUI FLUX.2 dev, 1024 x 1024, 24 Euler
steps, guidance 3.5, September 8, 2026. The game-reference images were used only
to guide the art direction; no reference-game images or textures are included.

| Material | Albedo | Detail normal | Roughness | Mean sRGB |
| --- | --- | --- | --- | --- |
| Spring meadow and clover | `meadow_albedo.jpg` | `meadow_normal.jpg` | `meadow_roughness.jpg` | 125, 152, 76 |
| Warm earthen bridleway | `bridleway_albedo.jpg` | `bridleway_normal.jpg` | `bridleway_roughness.jpg` | 184, 160, 124 |
| Cream arena footing | `arena_albedo.jpg` | `arena_normal.jpg` | `arena_roughness.jpg` | 204, 190, 157 |

The `source/` PNGs are untouched ComfyUI outputs with metadata. The runtime JPEGs
have a restrained palette balance and low-frequency periodic boundary correction.
Normal and roughness maps are conservative detail estimates derived from the
albedo; they are not scanned or physically measured surface data.

## Three.js integration

Use `SRGBColorSpace` for albedo only. Normal and roughness textures use
`NoColorSpace`; set their wrapping, repeat, and anisotropy to match the albedo.
Good starting normal scales are `(0.28, 0.28)` for earth and `(0.20, 0.20)` for
arena footing. Set material roughness to 1 when using the roughness texture.

The old meadow shader has a 2.35 multiplier to recover a nearly black source
texture, plus an asynchronous swap to `grass_albedo.jpg`. Remove that override
and recovery multiplier together when switching to `meadow_albedo.jpg`. The new
meadow has mean linear luminance 0.286, so a multiplier near 1.0 is the useful
starting point. Terrain vertex colors can continue to tint the material.

If retaining stochastic/offset sampling for meadow albedo, either apply the same
offset blending to its normal map or retain the independent procedural ground
bump: directly sampled detail normals otherwise do not match the offset albedo.

The earth and arena tiles have intentionally restrained detail and do not need a
compensating tint. Avoid stretching one tile over a whole arena: match the chosen
repeat in all three texture channels. The cream arena grain remains useful at
roughly 4 to 5 metres per repeat; the earthen trail at 2 to 3 metres per repeat.

## Reproduction and inspection

From the project root, use the two scripts documented in
`tools/asset-gen/README.md`: `gen_pastoral_materials.py` followed by
`finish_pastoral_materials.py`. `manifest.json` records the final settings, source
hashes, colors, and seam measurements. Exact API graphs and successful run
histories are under `tools/asset-gen/workflows/pastoral/`.

`material_preview.jpg` is a contact sheet. Each `*_tile_preview.jpg` repeats the
material in a 2 x 2 grid for seam inspection. Final JPEG seam steps measured
0.54 to 0.70 times the ordinary adjacent-pixel variation, so the texture wrap
does not introduce a larger brightness step than the surface's own fine detail.

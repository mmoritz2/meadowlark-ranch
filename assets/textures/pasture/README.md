# Pasture surface

[Grass 004](https://ambientcg.com/view?id=Grass004), by ambientCG / Lennart Demes,
downloaded from the official source on 2026-10-02. This is an authored PBR
material, not a photogrammetry scan. The [CC0 license](https://docs.ambientcg.com/license/)
allows use and redistribution in this game.

The 1.4 m tile contains continuous fine grass. It replaces leaf litter as the
open pasture surface; Poly Haven's forest-floor scan still covers wooded ground.
The original color is preserved. Color uses sRGB; normal and packed ARM use
linear data. ARM contains ambient occlusion, roughness, and zero metalness.

Runtime files total approximately 2.5 MiB: 2048px color, 1024px OpenGL normal,
512px ARM. Source and output hashes are in `manifest.json`. Rebuild with
`tools/asset-gen/build-pasture-material.mjs` after extracting the official
Grass004_2K-JPG archive's Color, NormalGL, AmbientOcclusion and Roughness JPGs
to `/tmp/meadowlark-pasture-source`.

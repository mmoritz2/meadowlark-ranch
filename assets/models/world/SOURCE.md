# World props and structures — licensed source library

Twelve authored models from **Poly Haven**, licensed **CC0 1.0 Universal**. Source:
https://polyhaven.com/license . The licence page was read from the primary source on
**2026-09-14** and explicitly permits redistribution, which is what a public repository
that deploys to GitHub Pages requires:

> Our assets are all licensed as CC0, which is effectively Public Domain even in
> jurisdictions that do not support the Public Domain. [...] You can use our assets for any
> purpose, including commercial work. You do not need to give credit or attribution when
> using them (although it is appreciated). You can redistribute them, share them around,
> include them when sharing your own work, or even in a product you sell.

No attribution is required. Poly Haven and the individual scan authors are credited in
`manifest.json` and in README.md anyway, in keeping with how this repository already treats
b2przemo.

These are derivative works: the base-colour maps are graded to this game's palette, and the
meshes are decimated, texture-resized, WebP-compressed and vertex-quantized. Every original
downloaded file is recorded by SHA-256 in `manifest.json` alongside the SHA-256 of the
shipped GLB, so any file here can be re-derived from the named Poly Haven download and
checked.

## What is here

`props/` — eleven yard and stable props. `buildings/` — one structure, and an explanation
of why there is only one (`buildings/README.md`).

| file | original polys | shipped tris | meshes / materials | size (m) | shipped |
|---|---|---|---|---|---|
| props/wine_barrel_01.glb | 10 820 | 2 464 | 1 / 1 | 0.74 × 0.87 × 0.75 | 162 KB |
| props/wooden_crate_01.glb | 6 576 | 616 | 1 / 1 | 0.82 × 0.35 × 0.40 | 96 KB |
| props/wooden_crate_02.glb | 5 176 | 523 | 1 / 1 | 0.53 × 0.46 × 1.16 | 100 KB |
| props/wooden_bucket_01.glb | 5 116 | 637 | 1 / 1 | 0.36 × 0.55 × 0.34 | 102 KB |
| props/wooden_bucket_02.glb | 7 252 | 751 | 1 / 1 | 0.61 × 0.35 × 0.61 | 124 KB |
| props/wooden_ladder.glb | 8 492 | 1 444 | 1 / 1 | 0.96 × 1.33 × 0.50 | 146 KB |
| props/wooden_picnic_table.glb | 10 210 | 561 | 2 / 2 | 2.24 × 0.74 × 3.02 | 390 KB |
| props/planter_box_01.glb | 8 094 | 358 | 1 / 1 | 0.90 × 0.42 × 0.41 | 99 KB |
| props/wooden_lantern_01.glb | 8 321 | 914 | 2 / 2 | 0.22 × 0.52 × 0.23 | 147 KB |
| props/watering_can_metal_01.glb | 11 837 | 720 | 1 / 1 | 0.19 × 0.19 × 0.45 | 136 KB |
| props/stone_fire_pit.glb | 3 887 | 612 | 1 / 1 | 1.45 × 0.38 × 1.43 | 131 KB |
| buildings/modular_wooden_pier.glb | 84 780 | 1 652 | 3 / 3 | 3.05 × 7.51 × 19.02 | 1 053 KB |

Total **2.6 MB** for twelve models. The same twelve packed straight from the Poly Haven
download, with no processing, are **34.6 MB** — a 12× reduction. For scale, the nine
image-to-3D foliage props already in `assets/models/` are 28 MB between them, and a single
one of them (`haybale_textured.glb`, 4.5 MB) is nearly twice the size of this whole library.

Models are in **real-world metres** and need no unit scaling. `+Y` is up; there is no
consistent facing axis, so each model needs its own yaw (see `manifest.json`).

## How they were made

```
python3 tools/fetch-polyhaven.py 1k <asset> ...          # download the 1k glTF + textures
python3 tools/grade-photoscan.py <src-dir> <out-dir>     # grade the base-colour maps
npx @gltf-transform/cli optimize in.gltf out.glb \
  --compress quantize --texture-compress webp \
  --texture-size 512 --simplify-error 0.012 --instance false
```

**The grade is not optional.** Poly Haven photoscans are markedly warmer and darker than
this game's timber, which sits pale and near-neutral — roughly RGB(200, 200, 196) in sun.
Dropped in raw, the props read as imports from a different, darker game: this was checked by
putting them in the scene beside the procedural barn and looking at the result. The grade
(`saturation 0.60, black lift 0.18, gamma 0.93`, base-colour maps only) closes that gap while
keeping enough micro-contrast that oak still reads as oak and iron as iron. A stronger grade
(`0.45 / 0.30 / 0.88`) was also tried and over-bleaches: material identity is lost.

Two other settings matter and were found the hard way:

- **No Draco, no meshopt.** Nothing in this repository configures `DRACOLoader`,
  `MeshoptDecoder` or `KTX2Loader`, so a GLB compressed with either would fail to load with
  no obvious cause. Only `KHR_mesh_quantization` and `EXT_texture_webp` are used; the
  vendored three.js r160 `GLTFLoader` supports both natively.
- **Simplification has to be per-asset.** A blanket `--simplify-error 0.012` collapsed
  `wicker_basket_01` into a flat scribble, because its value is in fine woven geometry. That
  asset was dropped rather than shipped broken; anything with thin repeated structure needs
  its own budget or `--simplify false`.

## What was rejected, and why

All of these are CC0 and could legally be shipped. They were rejected on looks, after being
placed in the scene next to the procedural barn and screenshotted:

| asset | reason |
|---|---|
| `street_lamp_02` | modern municipal luminaire on a plain pole; reads as a car park |
| `large_iron_gate` | ornate estate/cemetery ironwork, wrong next to white post-and-rail |
| `Lantern_01` | oversized Victorian gas lamp on a wall bracket |
| `old_tyre` | near-black; the darkest object in the frame by a wide margin |
| `metal_jerrycan_green` | modern, dark, reads as a black blob at prop distance |
| `CheeseBox_01` | a branded steamer trunk, not a farm crate; over-saturated |
| `painted_wooden_bench` | oxblood red, far outside this game's palette |
| `hand_truck` | modern sack truck |
| `horse_statue_01` | a 20 cm ornament, not the landmark the name suggests |
| `wooden_barrels_01` | 7× the size of `wine_barrel_01` for the same job, and darker |
| `wicker_basket_01` | fine weave does not survive decimation or prop distance |
| `vintage_oil_lamp` | too small to read in play; not verified at close range |

# World models — sourced from Poly Haven, not generated

Every file here is a **photoscan from [Poly Haven](https://polyhaven.com/)**, licensed **CC0 1.0
Universal**, adapted for this game by decimation and texture compression. They are kept apart from
`../` deliberately: everything in the parent directory was generated locally by this project's own
image-to-3D pipeline, and nothing in this directory was. The separation IS the provenance.

The licence was read from the primary source at <https://polyhaven.com/license> on **2026-09-14**,
not from a badge or an aggregator:

> Our assets are all licensed as CC0, which is effectively Public Domain even in jurisdictions that
> do not support the Public Domain. [...] You can use our assets for any purpose, including
> commercial work. You do not need to give credit or attribution when using them (although it is
> appreciated). You can redistribute them, share them around, include them when sharing your own
> work, or even in a product you sell.

Attribution is not required. It is given anyway in README.md, in keeping with how this repository
already credits b2przemo for the horse mesh.

Assembled from two records written independently — one for the nature scans, one for the props and
structures — so the licence reasoning appears twice below. Both halves are kept in full rather than
summarised, because the per-asset detail is the point of the file.

---

## Part one — nature

Every file in this directory is a **photoscan from [Poly Haven](https://polyhaven.com/)**, licensed
**CC0 1.0 Universal**, adapted for this game by decimation and texture compression. They are kept
apart from `../` on purpose: everything in the parent directory was generated locally by this
project's own image-to-3D pipeline, and nothing in this directory was. The separation is the
provenance.

## Licence

Read from the primary source at <https://polyhaven.com/license> on **2026-09-14**, not from a
badge or an aggregator:

> Our assets are all licensed as CC0, which is effectively Public Domain even in jurisdictions that
> do not support the Public Domain. [...] You can use our assets for any purpose, including
> commercial work. You do not need to give credit or attribution when using them (although it is
> appreciated). You can redistribute them, share them around, include them when sharing your own
> work, or even in a product you sell.

Redistribution is explicitly permitted, which is what makes these safe to commit to a public
repository that deploys to GitHub Pages. Attribution is **not** required — the credits below are
given anyway, because that is how this repository has treated b2przemo's horse and it costs
nothing.

Other sources were considered and rejected. **Quaternius** is no longer CC0: `quaternius.com/license.html`
now imposes a Quaternius Asset License v1.0 that forbids redistributing the assets themselves, which
is exactly what a public clone of this repo would do — many third-party articles still call it CC0
and are out of date. **Poly Pizza** still serves those same Quaternius models labelled "Public Domain
(CC0)", which is a live demonstration of why an aggregator's badge is not a licence.

## Credits

| Asset | Creator(s) | Published |
|---|---|---|
| Namaqualand Boulder 03 | Jenelle van Heerden (modeling), Dario Barresi (photography) | 2024-10-08 |
| Rock 07 | Jenelle van Heerden | 2024-02-06 |
| Tree Stump 01 | Rob Tuytel | 2023-07-05 |
| Shrub 03 | Rico Cilliers | 2024-02-06 |
| Shrub 04 | Rico Cilliers | 2024-02-06 |
| Fern 02 | Rob Tuytel (scanning), Rico Cilliers (modeling) | 2022-05-27 |
| Grass Medium 02 | Rico Cilliers | 2024-02-06 |

## What is here

Downloaded 2026-09-14 in glTF 1k form (`.gltf` + `.bin` + 1024px JPEG maps) from
`https://dl.polyhaven.org/file/ph-assets/Models/gltf/1k/<asset>/<asset>_1k.gltf`. Each asset page is
`https://polyhaven.com/a/<asset>`. `manifest.json` carries the exact download URL, the creators, the
licence, the SHA-256 of every shipped `.glb` **and** of every original source file, so the chain can
be re-verified without trusting this file.

| File | KB | Triangles (source → shipped) | Alpha | Intended height | SHA-256 (first 16) |
|---|---:|---|---|---:|---|
| `namaqualand_boulder_03.glb` | 174 | 64,826 → 4,000 | opaque | 1.6 m | `c3e564b996b4524b` |
| `rock_07.glb` | 176 | 14,844 → 3,500 | opaque | 0.6 m | `32d07c910acb9922` |
| `tree_stump_01.glb` | 236 | 41,046 → 4,995 | opaque | 0.7 m | `fa666881196fe51b` |
| `shrub_03.glb` | 225 | 8,287 → 5,999 | mask | 0.55 m | `4eeaea44a0e4cc67` |
| `shrub_04.glb` | 246 | 27,327 → 5,852 | mask | 0.45 m | `def8cf92dd0de568` |
| `fern_02.glb` | 165 | 6,232 → 4,999 | mask | 0.55 m | `b3b026a310b9b391` |
| `grass_medium_02.glb` | 228 | 7,842 → 6,000 | mask | 0.45 m | `ca765549c5971d41` |

1.49 MB for all seven. For scale, the single existing `../stump_textured.glb` is 3.78 MB, and
`../flowerbush_textured.glb` alone is 4.28 MB. Every file passes `gltf-transform validate` with
zero errors.

The original downloads are **not** committed. They are CC0 and permanently re-fetchable from the
URLs in `manifest.json`, and their SHA-256s are recorded there, so committing 16 MB of JPEG to a
repository that is already 577 MB bought nothing. Re-download and compare against
`originalSha256` to verify.

## Why they look like this

Three constraints shaped every file, and all three come from `placeFoliage()` in `ranch3d.html`:

1. **One mesh, one material.** `placeFoliage` walks the glTF, keeps the *first* mesh it finds and
   that mesh's single material, and instances it. Anything multi-material is silently truncated to
   whichever primitive happened to be first. So each file here is flattened and joined down to
   exactly one mesh with one material. Assets that could not reduce that far were rejected, not
   shipped broken.
2. **Node transforms must be baked.** `placeFoliage` takes `src.geometry` and never reads the node's
   world matrix, so any rotation or scale living on a glTF node would be thrown away. `flatten()`
   bakes it into the vertices first.
3. **No geometry compression is available.** `placeFoliage` constructs a bare `new GLTFLoader()` with
   no `DRACOLoader`, no `MeshoptDecoder` and no `KTX2Loader`. The vendored loader supports those
   extensions but each needs a decoder registered on the instance, so a Draco or meshopt file would
   fail to load at runtime. `EXT_texture_webp` needs nothing — the browser decodes it — so WebP is
   the only compression lever, and it is the one used.

Beyond that: the packed ARM (AO/roughness/metalness) map is dropped, because `placeFoliage` forces
`roughness=0.9` and `metalness=0` over the top of it anyway; base colour is 512px WebP and normals
256px; and `BLEND` alpha is rewritten to `MASK`, because blended transparency on an `InstancedMesh`
has no reliable draw order.

Rebuild any of them with:

```
node assets/models/world/build-world-props.mjs <downloaded>.gltf <out>.glb <targetTris> <texSize>
```

## Honest notes on scale

These are photoscans of real plants and real rocks, and their native proportions are nothing like
the generated props in `../`. `placeFoliage` applies a single *uniform* scale derived from
`FOLIAGE_H[name] / height`, so a flat wide scan blows up sideways when it is stretched to a tall
prop's height. `shrub_03` is 0.40 m tall and 1.37 m wide natively; at `FOLIAGE_H.bush` (1.9 m) it
would become a six-metre weed. The `intendedHeightM` in `manifest.json` is the height each asset was
actually built for, and it is what any caller should use — not the existing `bush` or `boulder`
entries.

At those heights, the plants here are **ground detail**, 0.45–0.55 m: weeds, ferns and grass tufts
that sit *under* the existing 1.9 m `makeNaturalShrub()` bushes rather than replacing them. Only
`namaqualand_boulder_03` is a like-for-like replacement for something the game already draws.

## What was rejected, and why

These were downloaded, built, put in the scene and looked at before being dropped. Recording them
here so nobody spends the afternoon again.

- **Trees — all of them.** Poly Haven's trees are archviz assets, not game assets. `pine_tree_01` is
  **958 MB** of geometry at the 1k texture tier; `fir_tree_01` 487 MB; `jacaranda_tree` 215 MB;
  `tree_small_02` 101 MB. The smallest real broadleaf, `island_tree_02`, is 46 MB and **1,072,213
  triangles** in three materials. Decimated to 8,125 triangles it keeps a beautiful gnarled trunk
  and loses its canopy completely — the leaves become sparse floating specks and you see sky through
  the crown. Side by side, the game's existing Weber–Penn generated tree has a markedly better
  canopy, and it costs no download at all. Do not replace the trees with these.
- **`tree_stump_02`.** 62,345 triangles of splintered rotten wood, all of the detail in geometry
  rather than texture. At the project's ~5k budget it decimates into a smooth featureless brown
  dome that reads as a mud mound, not a stump. Rejected on looks, not on licence.
- **`boulder_01`.** meshoptimizer will not decimate it: it stops at 54,122 of 66,122 triangles
  regardless of weld tolerance (tried up to 0.01) or error bound (tried up to 0.5), leaving a
  2.28 MB file. The photogrammetry has per-face vertex splits that weld cannot merge.
  `namaqualand_boulder_03` and `rock_07` cover the same need at ~175 KB each.
- **`wild_rooibos_bush`.** Three materials (twigs / leaves / trunk) with no shared atlas, so
  `placeFoliage` would silently render only the first primitive. Would need texture atlasing to
  become usable; not attempted.

The existing `../stump_textured.glb` was *not* replaced. Put beside `tree_stump_01` at the same
0.7 m, the generated one is the better object for its job: it reads immediately as a freshly cut
stump — bark, radial cut face, root flares — where the photoscan is a low collapsed mound of rot.
`tree_stump_01` is here as a different object for forest floors, not as a replacement.

---

## Part two — props and structures

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

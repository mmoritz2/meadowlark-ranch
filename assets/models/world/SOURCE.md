# World nature props — sourced, not generated

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

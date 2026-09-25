# GLB measurement and recompression

Everything under `assets/models/` came out of the image-to-3D pipeline and was written
straight to disk. No file declared a single glTF extension: no Draco, no meshopt, no
KTX2, no WebP. Every prop carried one uncompressed 2048x2048 PNG. `barrel_textured.glb`
was 2.7 MB for a barrel.

This directory now holds two scripts that make that measurable and fixable:

| script | what it does | dependencies |
| --- | --- | --- |
| `measure-glb.mjs` | prints bytes, triangles, accessor elements, every embedded image with its real pixel size and codec, and the extensions declared | none — plain node |
| `optimize-glb.mjs` | prune / dedupe / weld / resize / WebP, with a guard that refuses to write a file whose structure the game depends on | `npm install` here |

```
node tools/asset-gen/measure-glb.mjs assets/models              # the evidence table
node tools/asset-gen/measure-glb.mjs assets/models --json       # same, machine readable

cd tools/asset-gen && npm install
node optimize-glb.mjs ../../assets/models --props --out /tmp/try   # dry run to a temp dir
node optimize-glb.mjs ../../assets/models --props --in-place \
     --max-texture 1024 --quality 92 --manifest ../../assets/models/OPTIMIZATION.json
```

`measure-glb.mjs` parses the GLB container by hand (12-byte header, then length/type
chunks) and reads PNG IHDR, JPEG SOFn, WebP VP8/VP8L/VP8X and KTX2 headers directly, so
it reports the image dimensions that are actually in the file rather than whatever the
glTF `mimeType` claims. It needs no npm install, which matters for a check you want to
still run in two years.

## Result of the September 2026 pass

Twelve prop and rig models, re-encoded at `--max-texture 1024 --quality 92`:

| file | before | after | saving |
| --- | ---: | ---: | ---: |
| barrel_textured.glb | 2.692 MB | 0.300 MB | -88.8% |
| boulder_textured.glb | 3.057 MB | 0.272 MB | -91.1% |
| bush_textured.glb | 3.041 MB | 0.278 MB | -90.9% |
| cactus_textured.glb | 1.922 MB | 0.182 MB | -90.5% |
| cactus2_textured.glb | 2.425 MB | 0.223 MB | -90.8% |
| flowerbush_textured.glb | 4.081 MB | 0.685 MB | -83.2% |
| haybale_textured.glb | 4.518 MB | 0.590 MB | -86.9% |
| stump_textured.glb | 3.607 MB | 0.362 MB | -90.0% |
| trough_textured.glb | 3.205 MB | 0.323 MB | -89.9% |
| rider_seat_textured.glb | 2.444 MB | 0.490 MB | -79.9% |
| saddle2_textured.glb | 2.102 MB | 0.390 MB | -81.4% |
| saddle_en_textured.glb | 2.092 MB | 0.347 MB | -83.4% |
| **total** | **35.185 MB** | **4.443 MB** | **-87.4%** |

`assets/models` as a whole went from 243 MB to 212 MB; the part of it the game actually
downloads went from about 47 MB a session to about 16 MB. Geometry is byte-for-byte
unchanged — same triangle counts, same vertex counts, same bounding boxes, same mesh
names and order. Only the texture encoding moved.

Every before and after SHA-256 is in `assets/models/OPTIMIZATION.json`, written by the
same command that produced the files.

## Why WebP and not Draco, meshopt or KTX2

`ranch3d.html` builds a bare loader in three places — `placeFoliage()` at :4134, the
saddle loader at :5742, the rider loader at :7773 — plus `assets/breed-models.js:8` for
the breeds:

```js
new GLTFLoader().load('assets/models/'+name+'_textured.glb', …)
```

It never calls `setDRACOLoader`, `setMeshoptDecoder` or `setKTX2Loader`, and
`assets/vendor/three/examples/jsm/loaders/` contains exactly one file, `GLTFLoader.js` —
no `DRACOLoader.js`, no `meshopt_decoder.module.js`, no `KTX2Loader.js`, and no `.wasm`
anywhere under `assets/vendor/`. A file compressed with any of those three would fail to
parse in the real game no matter how well it compressed on disk.

Two things three.js r160 decodes with **zero** configuration:

- **`EXT_texture_webp`** — `GLTFTextureWebPExtension` is auto-registered in the
  `GLTFLoader` constructor (r160, the register block at GLTFLoader.js:82-172). Nothing to
  install, nothing to call. This is the lever that was pulled.
- **`KHR_mesh_quantization`** — handled in `GLTFLoader`'s own `extensionsUsed` switch.
  Available, but see the warning below.

The WebP extension is written as **used, not required**, so a browser without WebP
support falls back to the PNG path instead of throwing. Every browser that can run this
game has had WebP since 2020, but the fallback costs nothing.

### If you ever do want Draco or meshopt

It is not a one-line change. It needs a vendored decoder **and** an edit at each of the
four loader sites. For meshopt, the smaller of the two:

1. vendor `three/examples/jsm/libs/meshopt_decoder.module.js` into
   `assets/vendor/three/examples/jsm/libs/`
2. `import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';` beside
   the existing GLTFLoader import at ranch3d.html:589
3. replace each `new GLTFLoader()` with `new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)`
   at :4134, :5742 and :7773, and pass a configured loader into `createBreedLibrary`

Draco is the same shape plus a ~200 KB wasm decoder and `setDRACOLoader`. Whether that
is worth it depends entirely on the breeds — see below — because the props' geometry is
now only about 150 KB each and Draco would save a fraction of that while adding a decoder
to the critical path.

## Settings, and how they were chosen

`--max-texture 1024 --quality 92` was picked by rendering every prop at close range
before and after and diffing the pixels, not by taste. The harness loads each prop
through the page's own import map, reproduces exactly what `placeFoliage()` does, and
renders it in a fixed studio so two runs differ only by the asset bytes.

| setting | total | mean PSNR | worst prop |
| --- | ---: | ---: | --- |
| 2048px, WebP q92 | 6.41 MB | 50.7 dB | trough 43.7 dB |
| **1024px, WebP q92** | **4.44 MB** | **46.9 dB** | **haybale 37.9 dB** |
| 512px, WebP q92 | 3.53 MB | 41.6 dB | trough 30.9 dB |

512 is too far. The hay bale's straw strands visibly blur together and the trough drops
to 30.9 dB, below the point where a difference stops being invisible. 2048 is fine but
buys 4 dB nobody will see on an instanced background barrel, and costs four times the
GPU memory — a 2048 RGBA texture is 16 MB resident, plus mips, and there are twelve of
them. 1024 keeps the straw, the stump's growth rings and the barrel's stave grain intact
at a framing far closer than the game ever shows.

Note what is *not* in the pipeline: `join`, `palette`, `flatten` and `simplify`. All four
can change how many meshes a document has or which one comes first, and `placeFoliage()`
takes the **first mesh it finds** and builds the InstancedMesh from that one geometry and
material. `optimize-glb.mjs` fingerprints mesh count, primitive count, mesh names and
order, skin count, joints per skin and animation count before and after, and refuses to
write the file if any of them moved.

## What was deliberately left alone

**The 25 breed horses (145 MB).** These are the expensive files, but they are not a
compression problem. Each one is 167,220 triangles and 891,000 accessor elements with a
single 1024px coat PNG — the texture is 0.8 MB of a 5.9 MB file. Re-encoding the texture
alone saves 13%, which does not justify rewriting 145 MB of git objects.

`--quantize` does far better (bay.glb: 5.783 MB -> 3.225 MB, -44.2%) and
`KHR_mesh_quantization` needs no decoder — but it **splits the single shared 40-joint
skin into six separate 40-joint skins**, one per mesh. The game builds its bone map from
`skin.skeleton.bones` of the body mesh alone, so the mane, tail and eyes would stop
following the skeleton the body is animated by. `optimize-glb.mjs` now refuses that
outright; try it and see:

```
node optimize-glb.mjs ../../assets/models/artist-breeds/bay.glb --out /tmp/x --quantize
  !! REFUSED — the document changed shape in a way the game depends on:
     skin count 1 -> 6 (a shared skeleton was split; the rig will not drive every mesh)
```

There is also a provenance cost: `assets/models/artist-breeds/manifest.json` records a
SHA-256 for all 45 breed entries, and `breed-models.js` uses it as the cache-buster in
every request. Rewriting the GLBs invalidates all 45 and would need the manifest and
`tools/validate-breed-assets.py` regenerated in the same pass.

The real lever on the breeds is not compression at all. 167,220 triangles is roughly four
times what a browser-game horse needs; a decimation pass in Blender with the rig intact
would halve the file and the GPU cost together. That is a modelling change, not a
recompression, and it belongs in `build-artist-breeds.py`.

**`horse_showcase_rigged.glb` (5.63 MB) and `horse_textured_rigged.glb` (1.91 MB).**
Neither is referenced by `ranch3d.html`, any module under `assets/`, or any feature
package — only by the authoring scripts in this directory. They are pipeline sources, so
degrading them would be actively wrong. They are also 7.5 MB the repo carries and the
game never serves.

## Something to fix in ranch3d.html (not an asset problem)

`bush_textured.glb` and `flowerbush_textured.glb` are fetched on every session and then
thrown away. `placeFoliage()` is called for both at :4162, builds their InstancedMesh, and
then :4151 declines to add it:

```js
if(name!=='bush'&&name!=='flowerbush'&&name!=='boulder')scene.add(inst);
```

`boulder` is fine — it is excluded from the scene but still reached through `PROP_SRC` by
the decor catalogue (`DECOR_CAT.boulder.prop`). `bush` and `flowerbush` are not in the
decor catalogue and `PROP_SRC` is read nowhere else; the shrubs you actually see come from
`plantNaturalShrubs()`, which is procedural. That was 7.1 MB of dead download per session
before this pass and is 0.96 MB now. Dropping those two names from the `startFoliage`
list at :4162 would remove it entirely.

## Provenance

**No third-party asset was added to this repository by this pass.** Every `.glb` under
`assets/models/` is the same asset it was: the same geometry, the same texture image,
re-encoded. The props remain locally generated work; the breeds remain derived from
b2przemo's CC BY 3.0 mesh recorded in `assets/models/artist-breeds/SOURCE.md`, and were
not modified at all.

`assets/models/OPTIMIZATION.json` records, per file, the SHA-256 before and after, the
byte counts, the settings used, and the structural fingerprint that was checked. It is
generated by the `--manifest` flag, so it is reproducible rather than hand-written.

The tools are build-time dependencies only — nothing from them ships in the game. Licences
read from each package's own published `LICENSE` file in `node_modules`, not from a
directory listing:

| package | version | licence | text checked |
| --- | --- | --- | --- |
| `@gltf-transform/core` / `-functions` / `-extensions` | 4.5.0 | MIT | `LICENSE.md`: "The MIT License (MIT) — Copyright (c) 2024 Don McCurdy" |
| `sharp` | 0.34.5 | Apache-2.0 | `LICENSE`: "Apache License Version 2.0, January 2004" |
| `@img/sharp-libvips-*` (sharp's native libvips) | 1.2.4 | LGPL-3.0-or-later | `package.json` `license` field |

The libvips LGPL matters only if libvips binaries were redistributed; they are a local
dev dependency, `tools/asset-gen/node_modules/` is gitignored, and no part of it is
served by GitHub Pages.

## The rider (`assets/models/rider/`, `build-rider.mjs`)

The rider is a third-party character, added on purpose: Quaternius' **CC0 1.0** (public domain)
packs, from the free *[Standard]* downloads at quaternius.itch.io, no payment:

| pack | used for |
| --- | --- |
| Universal Base Characters [Standard] | the two bodies (`rider-f.glb`, `rider-m.glb`), eyes, brows, hairstyles (`rider-hair.glb`) |
| Universal Animation Library [Standard] | the clips she walks and stands with (`rider-anims.glb`), on the same 65-bone skeleton |
| Modular Character Outfits – Fantasy [Standard] | the Peasant and Ranger outfits (`outfit-*.glb`); the Peasant boots are also the riding kit's boots |

Each zip was listed before it was unpacked (models, textures and licence text only), and the
licence text in each pack reads CC0 1.0 Universal. `assets/models/rider/LICENSE.txt` records
it beside the files.

`build-rider.mjs` makes the web files from the unzipped packs:

    node build-rider.mjs "<Universal Base Characters[Standard]>" "<Universal Animation Library[Standard]>" \
      "<Modular Character Outfits - Fantasy[Standard]>" ../../assets/models/rider

It keeps only POSITION/NORMAL/TEXCOORD_0/JOINTS_0/WEIGHTS_0 (the sources carry five UV sets and
three colour sets for their engine shaders, the colour sets solid white), resizes textures to
1024 (eyes 256, small maps 512) and re-encodes them as WebP, bakes the hairstyles into the Head
bone's space (they are weighted 100% to it; the build refuses otherwise), and keeps 15 clips with
their rotation tracks and the pelvis translation only (the clips were made on a taller mannequin).
Result: the default rider is about 2.5 MB (body 0.74, hair 0.58, clips 0.49, and the Peasant file
0.72 for the riding kit's boots); the other outfit and the second body load only when worn. Everything else about her — the painted riding kit, the helmet,
the drawn-back hairstyles, the seat — is built at runtime by `assets/rider-model.js`.

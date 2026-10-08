# Native horse appearance roster

Run `python3 tools/native-roster/build.py` from the repository. This needs the
existing Python NumPy, Pillow and SciPy packages and reads the pinned, tracked
White Western native foundation. No network, Blender, downloaded source, or
previous private working directory is a build dependency.

The output is `assets/models/native-roster/manifest.json`, 25 compact appearance
buffers, 25 original-UV coat textures, the original white neutral coat, and a
numerical build report. The output is deterministic in a fixed Pillow/WebP
environment. `--only bay,shire` merges only the selected entries into the full
manifest and numerical report; it never publishes an incomplete roster. It
requires an existing complete manifest/report pinned to the same source. For a
shape-only update, run:

```
python3 tools/native-roster/build.py --only percheron,shire,clyde --geometry-only
```

This leaves every coat/neutral texture and every unselected buffer byte-identical.
The builder checks those hashes before finishing. The three draft foundations
also serve their existing aliases, including Belgian, Suffolk, Glacier and
Tempest; aliases keep their own colors and fantasy appearance.

The 677 original joints, skin weights, inverse binds, mesh topology, material
slots, source UVs and approved animations remain unchanged. Every variant uses
the White Western full native body as the source and its complete gait package
at runtime. The model is not reduced to the older 40-joint artist-body rig.

The builder evaluates each skinned source surface in normalized standing world
space. A smooth regional cage changes the barrel, quarters, neck, head and ears.
The inverse of each unchanged weighted rest skin operator converts these small
surface edits back into the original mesh coordinate system. The full body
below 0.65 source metres retains exact original positions and normals for all
non-draft foundations. Percheron, Shire and Clydesdale additionally receive
surface-only limb crosssection changes described below. The rig and articulated limb
proportions are intentionally shared. Uniform outer actor scale provides each
breed's selected height, from a 1.02 m Shetland to a 1.82 m Shire. These are game
art choices, not measurements of every individual or breed standards.

All five source surfaces use the same cage, keeping the eyes and original tack
aligned. The seat point is transformed by that cage and is recorded per variant.
The saddle, bits, stirrups and reins still require a mounted runtime check.
Source hair cards keep all their original topology and skin influences, with
whole-card mane/tail length changes. This preserves moving grooming controls.
This buffer builder supplies no new fetlock feather geometry; the Fjord has a shortened existing
card mane rather than a newly sculpted upright mane. Distinct upper-body shape,
height, coat pattern and grooming do not imply independently authored leg rigs,
breed-specific gaits, or anatomically unique skeletons.

Each mesh record contains signed little-endian Int16 `positionDelta` and
`normalDelta` arrays. Both have `byteOffset`, scalar element `count` and `scale`.
Apply `sourceAttribute[i] + int16[i] * scale` into cloned Float32 attributes.
The source geometry must remain shared and immutable. Vertex counts uniquely
identify the five original meshes. Indices, skin weights and UVs are untouched.
Normals may be normalized after decoding. The builder reports actual world
quantization error and asserts it remains below 0.02 mm. All deltas on protected
vertices are exactly zero, including after quantization.

## Draft surface shapes

`DRAFT_SHAPES` in `build.py` contains the native art overrides, independently of
the older conformation settings used by other build tools. Percheron has the
broadest quarters and a compact muscular neck; Shire keeps its taller actor,
long arch and longer head; Clydesdale has a longer, somewhat lighter frame.
The chest/barrel/quarters, neck and head all grow by regional amounts. Saddle,
girth, stirrup and bridle surfaces share that same smooth cage, and the transformed
seat is recorded in the manifest so mounted contacts follow the new tack.

Rear contour version 2 is an explicit **body-only** exception to the shared
cage. The initial wide cage carried almost full hip width down through the
lower haunch while also lowering that surface, producing boxy rear walls and
an abrupt corner above the hind legs. `DRAFT_REAR_CONTOUR` eases the added width
and depth back toward the original thigh while keeping the upper hip broad.
Its rear mask blends from zero at source Z=-0.36 m to full at -0.67 m. The
added width keeps 26% of its original gain below Y=0.88 m, easing to 100% by
1.48 m. The vertical depth offset keeps 12% below Y=1.00 m, easing to 100% by
1.50 m. These factors affect the cage's added deformation, not the source
horse's actual width or height. They preserve the full upper-quarter mass and
leave the chest, neck, source leg centers and lower-leg geometry intact.
The rear correction does not run on the mane/tail, eyes, either tack mesh or
seat point, preserving their reviewed fit. Normals use the corrected body's
Jacobian. `draftShape.rearContour` records the parameters, and
`draftRearProfile` reports displayed widths and mean heights at repeatable
source-height sections against the first broad draft cage.

The source standing pose is asymmetric, so each of its four limbs has a separate
measured X/Z centerline rather than a mirrored arbitrary center. Hooves gain
42% (Percheron), 50% (Shire), or 46% (Clydesdale) in horizontal width and depth.
The cannon remains slimmer than the knee/hock and muscular upper limb; the
radial offset fades into the body from 0.82–1.10 source metres. No lower-limb Y
coordinate or bone center is moved by the ideal cage, and no limb is lengthened.

The single lowest source sole-contact vertex is pinned exactly. All other sole
vertices start at least 0.137 mm higher and are widened with their hoof wall,
avoiding a narrow sole beneath an enlarged hoof. A weighted hoof center makes
the sum of X/Z offsets zero for each hoof's source vertices below 0.14 m. Int16
encoding introduces only micrometre-scale center/Y error, checked independently;
the pinned contact keeps the decoded standing floor exactly zero. The manifest
records centerlines, factors, fade range and protected contact threshold. The
build report records width gains against the earlier native draft directions,
each hoof's center error, lower-leg Y error, Jacobian bounds and floor.

Draft Western tack also has shorter fenders to keep the existing human rider's
legs within reach of the wider saddle. Only the 13,895-vertex tack mesh is
tailored: complete iron components rise 4 cm on Percheron, 12 cm on Shire, and
5 cm on Clydesdale in displayed actor metres, equally on both sides. The source
lift divides by the variant's actor scale. Fender shortening fades from full
lift at source Y=1.20 m to zero at 1.60 m, preserving the upper saddle joins.
Selected connected components occupy the measured fender region; the girth,
bridle, separate saddle mesh and seat point are excluded. Normals follow the
same transform's Jacobian. Tread contact IDs 2792–2845 and 2716–2769 remain
unchanged and move with the complete irons, so the runtime bridge still reads
their true skinned positions. `draftShape.stirrupTailoring` and the numerical
report identify the components, lift and actual decoded tread height change.

At runtime, `assets/native-draft-feathers.js` adds four private, bone-attached
silky hair meshes to Shire and Clydesdale instances, including Tempest. Their
strand roots follow the measured widened lower-leg surface. Percheron, Belgian
and Suffolk keep clean legs. The groom facade owns their Hair visibility and
idempotent disposal; these strands do not alter the source skin or animation.

Coat masks are rasterized through the native body's unchanged UVs, using actual
standing surface coordinates. They retain the original artist's white coat
detail and add the ranch's existing palette, dapples, spots, patches, dorsal
stripes, blazes and stockings. The runtime should set these texture maps to sRGB
and `flipY=false`. `hairColorLinear` can be assigned directly to linear material
RGB; `hairColorSrgb` is available for interfaces. `neutralcoat.png` is byte-exact
source image 0, allowing custom colors without recoloring the default pattern.

Run `python3 tools/native-roster/validate.py` for an independent decode check of
all 25 buffers, exact protected lower-body positions/normals (with the explicit
draft radial exception), source identity,
distinct body shapes, standing floor and texture dimensions. Run
`NODE_PATH=/path/to/node_modules QA_PORT=8584 node tools/native-roster/render-thumbnails.cjs`
against the local project server to refresh the real catalog thumbnails. The
renderer uses the production Studio loader and reads the feature package's
actual extra-breed rows/themes, so feature aliases receive their own game coat
and fantasy appearance. It asserts finite full native rigs and uncropped bounds.

Credit: WildMesh 3D, *Horse — Realistic 3D Model DEMO FREE*,
https://sketchfab.com/3d-models/horse-realistic-3d-model-demo-free-65d6a70a6721495f938c93e80a5998e4,
CC BY-NC 4.0: https://creativecommons.org/licenses/by-nc/4.0/.
The appearance derivatives and animations are adaptations; the original
noncommercial license remains applicable.

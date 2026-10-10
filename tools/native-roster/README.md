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
This buffer builder supplies no new fetlock feather geometry. The Fjord now
uses shortened original cards around a small continuous skinned crest and
forelock; see the grooming section below. Distinct upper-body shape,
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

Front contour version 3 rounds the lower chest into the forearms while keeping
the broad upper shoulders and the reviewed rear contour. `DRAFT_FRONT_CONTOUR`
blends from zero at source Z=0.12 m to full at 0.35 m. The added width keeps 50%
of its original gain below Y=0.90 m, easing to 100% by 1.38 m; the added vertical
depth offset keeps 40% below Y=0.92 m, also reaching 100% by 1.38 m. These are
reductions of the cage's added deformation, not reductions of the original
horse's dimensions. The correction is zero below the protected leg region,
above 1.38 m and behind the chest.

The same front field follows 70 complete breastcollar and center tie-down
islands (2,404 vertices) in the original Western tack mesh. It excludes the
irons, fenders, girth, bridle, reins and separate saddle. The builder checks
disjointness from the rider's protected head/rein component IDs and the iron
selection. Selected saddle-edge islands touch other saddle parts only above
Y=1.388 m: the correction has already vanished there. A 3 mm source-boundary
check guards those joins. Normals use the field's Jacobian, and unchanged tack
coefficients and scales are compared with the previous compatible buffer.
The original native collar already has some gaps and animated overlap; this
transform does not claim perfect skin contact. Browser checks compare the
actual skinned leather against that baseline. `draftShape.frontContour` records
the parameters and selection, `draftBreastcollar` reports the boundary and tack
preservation checks, and `draftFrontProfile` compares displayed chest sections
with the reviewed version 2 shape.

The source standing pose is asymmetric, so each of its four limbs has a separate
measured X/Z centerline rather than a mirrored arbitrary center. Hooves gain
42% (Percheron), 50% (Shire), or 46% (Clydesdale) in lateral width.
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

Leg contour version 4 retains that broad lateral hoof shape while returning
the low toe/heel depth to its source envelope. The extra forward/back shape
eases back in between source Y=0.15–0.28 m. This prevents enlarged toe and heel
surfaces from sweeping through the ground during the unchanged native trot.
`DRAFT_LEG_CONTOUR` smoothly reduces added lateral/depth gains around each
limb's actual named pastern and knee/hock joints, read from the asymmetric
native rest pose. The added lateral gain keeps 35% at a hinge; the added depth
gain reaches zero there. This changes the added draft shape, preserving the
original limb surface, joints, weights, lengths and animation. The correction
fades out by Y=1.10 m; upper-body positions/normals and all four non-body meshes
remain exactly equal to the reviewed prior release. Coats and all 22 non-draft
buffers are unchanged.

`node tools/test-native-draft-leg-deformation.mjs` compares 81 production Trot
poses with the identical source pose. It checks 5,694 lower-leg triangles for
new severe collapse, actual hoof-floor penetration, retained broad hoof width,
source weights/binds/clips and Belgian/Suffolk foundation mapping. The corrected
three foundations add no severe lower-leg collapse in these samples, and their
lowest hoof skin is about 1.5–1.6 mm below the floor, matching the source's small
existing error. Upper-leg/chest diagnostics remain separate; this test does not
claim that all inherited source deformation is removed. The feather test also
samples the newly fitted Shire, Clydesdale and Tempest hairs through Trot.

For visual review, open `review/native-draft-legs/review.html`. The visible
controls provide exact cycle phases, fixed front/side/rear views, leg close-up,
hair visibility and a sculpture surface using the production loader and motion.
Check both standing and moving poses; numerical tests do not replace this check.

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
silky hair meshes to Shire, Clydesdale and Vanner instances, including aliases
such as Tempest and Rosebloom. Vanner uses 72 overlapping locks per leg with a
denser undercoat; Shire's 56 and Clydesdale's 62 retain their approved shapes.
Vanner's alpha-aware front/side collar coverage is 69–81%, with four draw calls.
Across 328 real gait poses its feathers clear the floor by at least 30.9 mm
and stirrup treads by 353.9 mm; standing sole clearance is 50.5 mm. All follow
sampled skin and native joints. Their
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


## Regional head refinements

The merged builder retains the version3 front/breastcollar contour and version2
rear contour described above. The head field is additive and independent: it
uses the same compact smooth deformation on body, eyes, hair and bridle, in a
local frame measured from the slightly turned source head. It does not move
joints, alter weights/binds/topology, change limb lengths, or touch the saddle
seat and tread regions. Normals follow the combined field's Jacobian.

`HEAD_FAMILIES`, `HEAD_PROFILE_FAMILIES` and `HEAD_OVERRIDES` document every
coefficient in `build.py`; each selected manifest row also records them under
`headShape`. Width coefficients are local mask strengths, not a percentage
change to the whole head. Forehead/cheek/muzzle widths, muzzle length, nasal
bridge and throatlatch each have their own compact region.

| Family | Profiles | Maximum additional displayed head displacement |
| --- | --- | --- |
| Refined | Arabian (`sunset`), Akhal-Teke | 10.83 mm / 8.97 mm |
| Stock | Quarter (`bay`), Paint, Appaloosa | 5.04–5.13 mm |
| Pony | Icelandic, Fjord | 9.86 mm / 6.93 mm |
| Draft | Percheron, Shire, Clydesdale | 3.62–4.38 mm |

The Arabian has a modest dish and more refined muzzle; the Akhal keeps a
straight narrow face. Stock heads gain a little forehead/jaw substance. Pony
muzzles are shorter and broader. Draft heads retain their substantial existing
shape with restrained cheek and bridge refinements. The source identity is
preserved; these are not independently authored heads or new skeletons.

Run `python3 tools/native-roster/qa-head-shapes.py` for the decoded field and
contact checks. It samples 84 actual native walk/trot/left-canter/right-canter
poses per revised foundation, checks shared eye/bridle deformation, seat and
stirrup preservation, protected limbs, finite normals through the full decoder,
and bounded head displacement. `head-validation.json` records the result.
Quantized nonfacial positions differ from the pre-head target by at most 20 µm.
Front/side/quarter closeups and mounted runtime review still decide appearance;
these numerical tests do not certify visual gait or perfect leather contact.

## Native Fjord groom and runtime feathers

`groom.py:shape_fjord_groom` places 212 shortened original mane cards in coherent
fringe lanes around a rounded upright crest and trims 66 forelock cards into a
tidy hanging tuft. Mane rise is about 2–11 source centimetres. The 194 tail
cards keep the previous 1.06
length treatment; 76 eyelash islands remain untrimmed. Every card retains source
UVs, topology, skin weights and inertial hair bones, and its transformed normals
use the affine inverse transpose. A separate 1,562-vertex, 3,120-triangle crest
fills the gaps between shortened cards with one continuous rounded surface.
It reuses the original skeleton and each recorded mane/forelock donor's exact
skin influences; the five original mesh topologies and animation tracks stay intact.

`groom.uprightCrest.colorCards` records 278 contiguous mane/forelock islands;
`groom.uprightCrest.shell` stores the additive surface and donor indices.
`assets/native-fjord-groom.js` gives both pale outer hair and a dark center,
with restrained strand detail. Tail and eyelashes are excluded, and saved
player mane dyes can override the style. The continuous crest adds one draw
call and follows the same Hair visibility control as the original cards.
`python3 tools/native-roster/qa-groom.py` checks original-source geometry,
attachment, card roles and the packed additive surface. The runtime groom
validator retains the original five-mesh audit and only accepts a bounded
Fjord crest whose bones, binds and donor influences match the original hair.

`node tools/test-native-fjord-groom-motion.mjs` advances 1,377 frames and checks
183 full-skin poses across rest, idle, gaits, jumping and settling. Groom inertia
leaves body, eyes, feet and tack identical to the same-pose no-inertia comparator.
The new crest's extra inertial excursion is at most 4.4 mm; original crest cards
move at most 35.8 mm extra, with their span differing by at most 11.3 mm from
the authored pose. Hair remains at least 127 mm above the local ground. The
test also rejects malformed added skins, checks Hair visibility, and verifies
reset, disposal and source immutability. These bounds complement visual review.

Shire, Clydesdale and Vanner feathers remain runtime additions in
`assets/native-draft-feathers.js`, fitted to sampled lower-leg skin and attached
to the native pastern bones. They are disposed with the groom facade. Vanner's
fuller lower-leg fringe does not claim new knee-length skinned feathering.

## Browser portrait capture

Open `review/horse-quality/capture.html` in the app browser and press Start.
The visible page uses the production native library, current materials, groom,
registered fantasy/alias appearances, source Western tack and a consistent
standing pose. It fits all visible geometry inside a640×480 frame, checks the
677-joint skin and finite bounds, and offers a ZIP with WebPs, merged thumbnail
index and provenance. Dragons and the artist study are excluded and their old
files/index entries are retained. A stopped/failed batch is explicitly marked
partial. The ZIP contains only safe relative asset paths and never edits a game
save. This path needs no injected browser evaluator or shell browser launcher.

Credit: WildMesh 3D, *Horse — Realistic 3D Model DEMO FREE*,
https://sketchfab.com/3d-models/horse-realistic-3d-model-demo-free-65d6a70a6721495f938c93e80a5998e4,
CC BY-NC 4.0: https://creativecommons.org/licenses/by-nc/4.0/.
The appearance derivatives and animations are adaptations; the original
noncommercial license remains applicable.

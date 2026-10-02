# Native horse appearance roster

Run `python3 tools/native-roster/build.py` from the repository. This needs the
existing Python NumPy, Pillow and SciPy packages and reads the pinned, tracked
White Western native foundation. No network, Blender, downloaded source, or
previous private working directory is a build dependency.

The output is `assets/models/native-roster/manifest.json`, 25 compact appearance
buffers, 25 original-UV coat textures, the original white neutral coat, and a
numerical build report. The output is deterministic in a fixed Pillow/WebP
environment. `--only bay,shire` creates a partial manifest for isolated review.

The 677 original joints, skin weights, inverse binds, mesh topology, material
slots, source UVs and approved animations remain unchanged. Every variant uses
the White Western full native body as the source and its complete gait package
at runtime. The model is not reduced to the older 40-joint artist-body rig.

The builder evaluates each skinned source surface in normalized standing world
space. A smooth regional cage changes the barrel, quarters, neck, head and ears.
The inverse of each unchanged weighted rest skin operator converts these small
surface edits back into the original mesh coordinate system. The full body
below 0.65 source metres retains exact original positions and normals, preserving
the accepted lower-leg/hoof shapes and animation. The rig and articulated limb
proportions are intentionally shared. Uniform outer actor scale provides each
breed's selected height, from a 1.02 m Shetland to a 1.82 m Shire. These are game
art choices, not measurements of every individual or breed standards.

All five source surfaces use the same cage, keeping the eyes and original tack
aligned. The seat point is transformed by that cage and is recorded per variant.
The saddle, bits, stirrups and reins still require a mounted runtime check.
Source hair cards keep all their original topology and skin influences, with
whole-card mane/tail length changes. This preserves moving grooming controls.
No new fetlock feather geometry is supplied; the Fjord has a shortened existing
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
lower-body vertices are exactly zero, including after quantization.

Coat masks are rasterized through the native body's unchanged UVs, using actual
standing surface coordinates. They retain the original artist's white coat
detail and add the ranch's existing palette, dapples, spots, patches, dorsal
stripes, blazes and stockings. The runtime should set these texture maps to sRGB
and `flipY=false`. `hairColorLinear` can be assigned directly to linear material
RGB; `hairColorSrgb` is available for interfaces. `neutralcoat.png` is byte-exact
source image 0, allowing custom colors without recoloring the default pattern.

Run `python3 tools/native-roster/validate.py` for an independent decode check of
all 25 buffers, exact protected lower-body positions/normals, source identity,
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

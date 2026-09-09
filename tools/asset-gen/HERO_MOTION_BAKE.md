# Hero animation baking

`bake_hero_motion.py` packages approved runtime poses. It does not invent motion,
change the rig, or re-export any mesh or texture. The final model's original BIN
chunk remains an exact prefix of the new animation GLB.

## Sample format

The sampler writes one JSON object with:

- `version`: `1`.
- `fps`: `60`.
- `source`: `hero-rigged-v2.glb`.
- `sourceSha256`: hash of the exact rig used for sampling (recommended).
- `bones`: `bone_0` through `bone_32`, in source skin-joint order.
- `clips`: eight named clip objects: `idle`, `walk`, `trot`, `canter-left`,
  `canter-right`, `gallop-left`, `gallop-right`, and `jump`.

Each clip has `name`, `loop`, `duration` in seconds, and `frames`. Every frame
contains `time` in seconds, `rotations` as 132 flat floats (XYZW per bone), and
`translations` as 99 flat floats (XYZ per bone). Nested arrays per bone are also
accepted. Translations can be omitted only when they should remain at the exact
source rest translations.

These are **local bone transforms in raw glTF/Three.js coordinates**, not world
positions, delta rotations, Blender Euler angles, or viewer-fit coordinates.
Sample at `i / 60` from zero and include a final sample at the exact duration. A
shorter final interval is allowed when duration is not divisible by 1/60.

The seven gait/idle clips loop. Their final sampled transforms must already
match their first transforms within 0.001 radians and 0.0001 raw translation
units. The exporter makes accepted endpoints exact, normalizes small quaternion
rounding drift, and aligns quaternion hemispheres between consecutive frames.
It rejects a visible seam instead of concealing it with an invented pose. Jump
does not loop. If the runtime applies a jump arc to a parent mount, the sampler
must fold the arc into bone_0 translation so it is represented by the 33-bone
clip; the exporter does not sample or animate the viewer mount.

## Commands

```powershell
python tools/asset-gen/bake_hero_motion.py --describe-source
python tools/asset-gen/bake_hero_motion.py output/hero-motion-samples.json --blend assets/models/hero-horse/hero-animated.blend
```

The default output is `assets/models/hero-horse/hero-animated.glb`, and the source
`hero-rigged-v2.glb` is never overwritten. Every clip has 66 channels: rotation
and translation for each of the 33 joints, including the joints that also skin
the eyes. Input timestamps are shared between the clip's samplers. Tracks use
LINEAR interpolation (the glTF loader uses quaternion slerp for rotations).

The sibling `.animations.json` report records source/sample/output hashes,
durations, frame/channel counts, source-byte preservation, normalized output
quaternion error and hemisphere continuity. Optional Blender output imports the
new clips at 60 fps as editable named actions, preserving them with fake users;
the `.actions.json` report lists their frame ranges. This DCC file is an editing
source, while the byte-preserving GLB remains the distributable model.

## Current exported library

The v3 controller samples produced `hero-animated.glb` and
`hero-animated.blend`. The GLB retains 13,758,732 source BIN bytes unchanged.

| Clip | Seconds | Samples |
| --- | ---: | ---: |
| idle | 8.000000 | 481 |
| walk | 0.980392 | 60 |
| trot | 0.645161 | 40 |
| canter-left / canter-right | 0.568182 each | 36 each |
| gallop-left / gallop-right | 0.471698 each | 30 each |
| jump | 2.300000 | 139 |

`tools/qa-hero-animation-clips.cjs` independently loads every clip in Three.js,
checks 66 tracks over 33 bones, exercises intermediate poses, and checks actual
mixer playback against the encoded keyframes. The current report passes with
zero key playback error and no browser errors. The source rig remains
`c6826bf3805f541d72115d29fe33b37591d423167126c7a256244f9360485acf`.

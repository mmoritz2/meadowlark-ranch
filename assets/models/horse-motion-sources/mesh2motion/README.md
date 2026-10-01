# Mesh2Motion horse motion reference — private evaluation

The user was shown the [official gallery](https://app.mesh2motion.org/) and
[horse source directory](https://github.com/Mesh2Motion/mesh2motion-assets/tree/main/rigs/horse)
before acquisition. The unchanged `horse-animations.glb` is pinned to repository
commit `c5b0b6c821dbf2fa1dfe49590a6f431fd9f707ce`; its SHA-256 is
`c6f890c307e457b9aa7cceda1fbc1e39f8e6723ef340f23e3e667e122673b51c`.
The official assets license is retained in `LICENSE.txt`; details and source
URLs are in `provenance.json`.

This 1,087,132-byte file has one mesh, one 56-joint skin and 14 clips:
Death, Eating, Head_But, Idle, Kick, lay_to_idle, Rear, Rest_Pose, Run,
Sleep, Trot, Turn_Left, Turn_Right, and Walk. The sample model is stylized.
It is a motion reference, not an approved replacement for the realistic horse.
Run must not be renamed Canter or Gallop without a specific gait review.

The [official project](https://mesh2motion.org/) identifies its source models,
rigs and animations as hand-made and CC0. The CC0 motion source does not change
the CC BY-NC 4.0 license on the realistic WildMesh horse used as a retargeting
target. Source-gait review and retargeting experiments are private; no roster,
production manifest or deployment uses this source yet.

The [source audit](../../../../review/mesh2motion-source/README.md) found useful Walk and Run body/head/tail motion, but the clip labeled Trot is a lateral pace. Source soles penetrate the rest floor by up to 31 mm in Walk, 57 mm in the pace, and 36 mm in Run; all three clips have a discontinuous native loop. These need correction and a separate target-model review before gameplay use. The source has no mane joint chain.

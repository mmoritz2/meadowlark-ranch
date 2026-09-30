# White Western horse: native gait review

Open [the combined preview](review.html) on the local project server. It contains the realistic white Western horse the user selected, its original appearance and tack, all 677 skin joints, creator Idle/Walk, and four separate target-authored clips. The preview exposes the rebuilt slow Walk, slow Trot, both slow Canter leads, and creator Idle. It does not install this model in the Ranch or substitute missing faster gaits.

| Study | Footfalls | Nominal travel speed | Independent regional contact drift |
| --- | --- | ---: | ---: |
| Refined slow Walk | Four beats, no suspension | 0.54945 m/s | ≤0.032 mm |
| Slow Trot | Alternating diagonal pairs and brief suspension | 1.38889 m/s | ≤0.606 mm |
| Canter, both leads | Three beats and suspension | 1.953125 m/s | ≤2.53 mm |

All four target clips retain the upright source standing proportions, folding recovery limbs, heel-to-toe hoof rollover, moving torso/head/neck, and layered mane/tail response. Each was independently sampled at 256 phases with fixed original hoof groups and ground, multiangle playback, and actual skinned geometry. No gross crouch, joint inversion, skin collapse, or tack detachment appeared. These are useful private motion milestones, not final naturalism or all-breed approval.

The Walk still holds maximum carpal flexion for about 193 ms, roughly half its short swing, then unfolds briskly. The Trot has a shorter folded apex, about 45–68 ms, and conspicuous head response: about 101 mm vertical head-pivot motion versus 41 mm upper-trunk motion. Canter has a short stride, about 124 mm head-pivot travel versus 54 mm trunk motion, brief leading carpal holds of 40/65 ms, and disclosed scapular/hock bounds. Native rest foot placements differ between sides, so mirrored lead roles do not establish equal absolute reach. Joint bounds remain disclosed. Transitions, steering, gallop, jumping, real high-speed groom simulation, and full rider fit remain unfinished. The separate [mounted rollover-Walk study](../native-rider-reins/README.md) connects leather reins to the original bit rings and relaxed fists, seats boots against the real stirrup treads, and checks traveled heel/flat/toe contact. Its checks cover this slow Walk only. The earlier [travel/rider study](../native-horse-travel/README.md) stays frozen with its initial hand/rein and lateral-slip blockers.

The [Walk record](../target-native-walk-rollover/REVIEW.md), [independent Walk audit](../target-native-walk-rollover/independent-REVIEW.md), [Trot record](../target-native-trot/REVIEW.md), [independent Trot audit](../target-native-trot/independent-REVIEW.md) and [Canter record and independent audit](../target-native-canter/README.md) preserve exact input hashes, measurements, bounds, references and sampled playback. The earlier [slow Walk](../target-native-walk/README.md) stays frozen for comparison. The separate [measured gait controller](../native-gait-controller/README.md) now checks exact playback and forward travel for all four target clips; it does not smooth transitions.

`model.glb` SHA-256 is **49ade015b21fa531be05bc92ed042ec0dc4c2f96aabfc40b48f1fe280f292206**. The [combination record](preservation.json) verifies identical nodes, meshes, skins, materials, images, textures, original binary prefix and creator clips. All 82 channels of each new gait have input and output arrays identical to their independently audited files; only accessor offsets and IDs are remapped when combining. The [gallery check](qa-summary.json) verifies all four new clips and Idle load on the complete rig with finite poses and correct contact height.

To reproduce from a clean review checkout, run the preserved builders first, then combine their generated outputs:

```sh
python3 review/target-native-walk-rollover/build.py
python3 review/target-native-trot/build.py
python3 review/target-native-canter/build.py
python3 review/native-horse-kit/combine.py
NODE_PATH=/Users/mbphome/.npm-global/lib/node_modules QA_PORT=8577 node review/native-horse-kit/qa.cjs
```

Builders write to ignored `output/`; the gallery check loads the saved `review/native-horse-kit/model.glb`. The model/rig/tack come from [WildMesh 3D's realistic horse demo](https://sketchfab.com/3d-models/horse-realistic-3d-model-demo-free-65d6a70a6721495f938c93e80a5998e4), **CC BY-NC 4.0**. The target's existing license and credit remain applicable to authored derivatives. No new model was downloaded for these studies.

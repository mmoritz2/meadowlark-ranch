# White Western horse: native Walk and Trot review

Open [the combined preview](review.html) on the local project server. It contains the realistic white Western horse the user selected, its original appearance and tack, all 677 skin joints, creator Idle/Walk, and two separate target-authored gait studies. The preview exposes the rebuilt slow Walk, slow Trot, and creator Idle. It does not install this model in the Ranch or substitute missing faster gaits.

| Study | Footfalls | Nominal travel speed | Independent regional contact drift |
| --- | --- | ---: | ---: |
| Refined slow Walk | Four beats, no suspension | 0.54945 m/s | ≤0.032 mm |
| Slow Trot | Alternating diagonal pairs and brief suspension | 1.38889 m/s | ≤0.606 mm |

Both retain the upright source standing proportions, folding recovery limbs, heel-to-toe hoof rollover, moving torso/head/neck, and layered mane/tail response. Each was independently sampled at 256 phases with fixed original hoof groups and ground, multiangle playback, and actual skinned geometry. No gross crouch, joint inversion, skin collapse, or tack detachment appeared. These are useful private motion milestones, not final naturalism or all-breed approval.

The Walk still holds maximum carpal flexion for about 193 ms, roughly half its short swing, then unfolds briskly. The Trot has a shorter folded apex, about 45–68 ms, and conspicuous head response: about 101 mm vertical head-pivot motion versus 41 mm upper-trunk motion. Joint bounds remain disclosed. Transitions, steering, faster gaits, jumping, real high-speed groom simulation, and full rider fit remain unfinished. The separate [travel/rider study](../native-horse-travel/README.md) uses the earlier frozen Walk and records the hand/rein and lateral-slip blockers; it does not establish riding on these updated clips.

The [Walk record](../target-native-walk-rollover/REVIEW.md), [independent Walk audit](../target-native-walk-rollover/independent-REVIEW.md), [Trot record](../target-native-trot/REVIEW.md), and [independent Trot audit](../target-native-trot/independent-REVIEW.md) preserve exact input hashes, measurements, bounds, references and sampled playback. The earlier [slow Walk](../target-native-walk/README.md) stays frozen for comparison.

`model.glb` SHA-256 is **552dd455873020cba95f7087d513358fd7dd26b27406e8cc36ce7c6b0da8d3e4**. The [combination record](preservation.json) verifies identical nodes, meshes, skins, materials, images, textures, original binary prefix and creator clips. All 82 channels of each new gait have input and output arrays identical to their independently audited files; only accessor offsets and IDs are remapped when combining. The [gallery check](qa-summary.json) verifies both clips and Idle load on the complete rig with finite poses and correct contact height.

To reproduce from a clean review checkout, run the preserved builders first, then combine their generated outputs:

```sh
python3 review/target-native-walk-rollover/build.py
python3 review/target-native-trot/build.py
python3 review/native-horse-kit/combine.py
NODE_PATH=/Users/mbphome/.npm-global/lib/node_modules QA_PORT=8577 node review/native-horse-kit/qa.cjs
```

Builders write to ignored `output/`; the gallery check loads the saved `review/native-horse-kit/model.glb`. The model/rig/tack come from [WildMesh 3D's realistic horse demo](https://sketchfab.com/3d-models/horse-realistic-3d-model-demo-free-65d6a70a6721495f938c93e80a5998e4), **CC BY-NC 4.0**. The target's existing license and credit remain applicable to authored derivatives. No new model was downloaded for these studies.

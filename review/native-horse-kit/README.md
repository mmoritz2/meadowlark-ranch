# White Western horse: revised native motion

This is the same realistic White Western horse used by the game's free model choice. Its original 677-joint rig, skin, materials, groom and Western tack are preserved. The new Walk, Trot and both Canter leads replace the earlier clips that had abrupt recovery bends. Creator Idle/Walk remain intact; the creator Walk is only exposed for review.

| Gait | Largest previous/new limb step | Nominal travel |
| --- | --- | --- |
| Walk | 12.058° → 4.888° per 8.75 ms | 0.54945 m/s |
| Trot | 12.183° → 4.735° per 5.625 ms | 1.38889 m/s |
| Canter left | 7.037° → 4.814° per 5 ms | 1.953125 m/s |
| Canter right | 15.923° → 4.763° per 5 ms | 1.953125 m/s |

Each gait preserves upright proportions, heel-to-toe contact, body/head/neck response and mane/tail motion. Independently solved loop endpoints recur before export; the Walk has periodic cubic tangents. Dense actual GLTF scans check fixed original hoof groups, floor, regional travel and all native joints. Trot has a small floor crossing below 0.9 mm and low suspension clearance; limb limits and a regular body rhythm remain. These are incremental continuity improvements, not all-breed or final naturalism approval. Gallop and jump are unavailable; gait-switch smoothing is separate work.

The actual Ranch and Studio passed `tools/qa-native-game.cjs` without model routes or injected motion. Independent actual mounted Walk/Trot checks cover a full cycle per gait: original tack remained intact, all bones/rider stayed finite, skinned boots seated within 0.568 micrometres and reins retained their bit/fist endpoints. Both Canter leads were also checked with the real mounted code in a private routed candidate.

`model.glb` SHA256: **fa797ad07137af09b1824cabe8737a530206804fcee2ab3a526ac12be1f08fc1**. [Combination evidence](preservation.json) checks unchanged native scene fields, source binary prefix, source clips and exact arrays of all 82 channels per authored gait.

The builders and saved inputs are [Walk](../native-white-walk-continuous/README.md), [periodic Trot](../native-white-trot-periodic/README.md), [Canter](../native-white-canter-continuous/README.md) and [combination script](../native-white-continuous-kit/combine.py). Builders emit ignored output; validate and save each candidate before combining. The combined output is `output/native-white-final-kit/model.glb`. Earlier motion studies remain historical evidence.

Original artwork: [WildMesh 3D realistic horse demo](https://sketchfab.com/3d-models/horse-realistic-3d-model-demo-free-65d6a70a6721495f938c93e80a5998e4), CC BY-NC 4.0. No new source model was downloaded.

# European Dragon rig audit

The existing creator rig has 169 joints, five skinned meshes and five native clips: Idle Stand, Idle Sit, Walk, Run and Fly. It faces the game's +Z direction. No new model was downloaded, and no mesh, skin weights, material or joint animation was altered.

`european-dragon-grounded.glb` replaces only Walk and Run with the same source clips plus one actor-root vertical translation. At the existing scale 1.45 and Y offset .03, the original four foot groups passed below the floor by 1.45 cm while walking and 5.64 cm while running. A 120 Hz sample of 1,782 skinned foot vertices adds the smallest lift needed for a 3 mm floor margin. All original joint tracks are copied exactly. The Run lift continues across the loop seam for 33.85 ms, matching its final height and descent instead of introducing a new 2.60 cm body snap. Idle Sit's feet are already above the floor; its small negative overall bound comes from the tail, so that clip is unchanged.

A separate GLTFLoader verification sampled each corrected clip at 301 phases. All 169 bones and skinned foot positions remained finite. Minimum foot clearance was 2.87 mm for Walk and 1.19 mm for Run, including samples between correction keys. The creator's stride shape, timing and horizontal foot sliding remain unchanged. These are grounding corrections, not newly authored gaits or solved terrain foot IK.

The original Fly clip includes its own roughly 1.5 m body lift, with the seat around 2.28–2.48 m before gameplay flight altitude. Its full wing span is approximately 5.33 m at the existing display scale. Animation crossfades and gameplay takeoff/landing should blend this existing lift rather than add another source pose jump.

The source seat follows `DEF-Spine002_04`; the head is `DEF-neck004_012` after GLTFLoader sanitizes names. Primary wing joints are `DEF-Wing_BaseL_081` and `DEF-Wing_BaseR_097`. The seat marker alone lies 1.6–3.3 cm below the animated back in Walk/Run/Stand, 5.3–5.8 cm in Fly, and 7.5–7.9 cm in Sit. The game's existing 11 cm rider offset accommodates this; applying the horse bareback reduction would put the rider too low. Preserve seat X motion as well as Y/Z.

Evidence: `european-grounding-verification.json`, `european-grounding-report.json`, `european-source-audit.json`, `european-seat-audit.json`, and the grounded walk/run images. The magenta marker in the images shows the raw seat follower, before the rider's offset.

Reproduce from the repository root with a local server and Playwright available via NODE_PATH:

```sh
QA_URL=http://127.0.0.1:8584 node tools/dragon-motions/european-grounding.cjs
QA_URL=http://127.0.0.1:8584 node tools/dragon-motions/european-verify.cjs
QA_URL=http://127.0.0.1:8584 node tools/dragon-motions/european-audit.cjs
QA_URL=http://127.0.0.1:8584 node tools/dragon-motions/european-seat-audit.cjs
```

The source and correction hashes are recorded in `european-grounding-report.json`. Original attribution and license remain on the source model profile.

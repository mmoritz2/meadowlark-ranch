# Native horse gait transitions

White and Bay now blend between their existing native clips over 0.20 seconds of real time. The game still owns actor travel. The release also updates the Ranch/Studio import versions and passes the Studio playback rate separately from elapsed seconds; no model, skin, bind, clip, registry, rider or terrain data was edited.

Frozen controller SHA-256: `2f44f6641225c9ab2d8b102b188da48fe9f45538211f0fb50d3a7808ad04edb6`.

The exact deployed baseline is preserved in `before-controller.mjs` (SHA `7abe98c83c8173e198c55fedd845e6823fb5be0fd2be040b63cc9743ed0820d4`). The final White kit is `fa797ad07137af09b1824cabe8737a530206804fcee2ab3a526ac12be1f08fc1`; Bay is `d7a02ea2e6cc4355a5a71b67b79af627e41ea8312157b4ff080faff42fadacef`. Provenance and licenses remain in those kit studies and source records.

The public `update(dt)` API still works for the Studio. The game calls `update(dt,{rate})`: the mixer advances by actual seconds, and the target action's time scale controls gait playback. Outgoing actions retain their previous playback rate during the blend. Five-degree smootherstep weights begin and end with zero weight velocity/acceleration. Interrupted transitions start from current weights. Zero-weight actions are stopped after the blend.

New horse actions align normalized cycle phase to the authored FL touchdown; canter lead changes preserve the shared torso phase. Both `footOffsets` and `offsets` profile fields are supported. This phase rule does not enforce every hoof's plant during the blend.

A constant rest action reads original default values through the original clip bindings. It addresses the complete native animated track union, including head, groom and tack helpers. Bay's `stand` aliases this rest target: it returns `clip:null`, `phase01:0`, `restFallback:true`. No creator idle was invented. An explicit `reset()` or disposal restores the original source transforms.

Smooth transitions are restricted to `nativeKind:'horse'`. Creator dragons keep the prior immediate clip switching and source playback behavior. A trial European Walk→Run blend increased an existing source dip by about31 mm; that blend was removed. Final QA confirms the dragon pose steps and floor samples equal the baseline.

Run the local checks from the repository root:

```sh
NODE_PATH=/Users/mbphome/.npm-global/lib/node_modules QA_PORT=8584 node review/native-motion-transitions/qa.cjs
NODE_PATH=/Users/mbphome/.npm-global/lib/node_modules QA_PORT=8584 node review/native-motion-transitions/mounted-qa.cjs
NODE_PATH=/Users/mbphome/.npm-global/lib/node_modules QA_PORT=8584 node review/native-motion-transitions/studio-qa.cjs
NODE_PATH=/Users/mbphome/.npm-global/lib/node_modules QA_PORT=8584 node tools/qa-native-game.cjs output/native-game-transitions-qa
```

`review.html` is the browser test harness. `qa-summary.json` and `mounted-summary.json` contain compact evidence; full sampled rows are regenerated under ignored `output/native-motion-transitions/`. The two mounted PNGs show the actual unrouted Ranch with original Western equipment and its rider bridge. Read `REVIEW.md` for the contact limits.

`studio-summary.json` checks actual Studio controls at normal, half and quarter playback speed: a fade remains active at190 ms and finishes at200 ms while clip time advances at the chosen rate. `integration-summary.json` records the actual unrouted four-model Ranch/Studio checks, including free acquisition, rider attachments, motion/travel caps, unchanged legacy Bay and native companions.

# Preserved-body horse motion

The runtime uses the existing body GLBs plus a compact, named-channel motion bundle for each body. `assets/models/horse-motions/manifest.json` enables those curves; the native three use `assets/native-complete-gaits.js`. Do not point every breed at the White mesh.

To obtain a full source for new retarget work using only committed assets:

```sh
python3 tools/native-gaits/reconstruct-reference.py
python3 tools/native-gaits/retarget-reference.py --body bay --source review/native-complete-gaits/reconstructed/model.glb --clip 'Target Native Trot'
```

`--all --jobs 2` fits all 25 body files. Available source clip names are retained in `authoring-reference.provenance.json`. NumPy and SciPy are required. The reconstruction keeps the exact shipped native body rest/skin and exact approved animation arrays; it changes the container layout and file hash only.

`retarget-reference.py` preserves local bone lengths, geometry and binds, reflects the reference into the target's anatomical left/right convention, and fits the skinned hoof surface. It outputs per-body motion GLBs and measured reports under `review/native-complete-gaits/roster/`. Jump requires the sibling metadata written by the reconstruction tool; the runtime must apply the separate actor-lift curve exactly once.

`package-motion.py` copies curves verbatim into a motion-only GLB. `publish-roster.py` assembles the release from reviewed private authoring outputs and normalizes older Jump batch clocks when needed. Its `--partial` option is only for local integration work. A full publication requires the reviewed native Gallop source/contracts and both leads for every target.

Native Bay/Sport Walk stays in its original live body file. Those Walk curves and their existing baseline companion tracks form one compatible pair. Their new override bundles must not replace Walk with an earlier authoring version that lacks the distal tracks.

Validation: `tools/qa-native-complete-controller.mjs`, `tools/qa-complete-gaits-studio.cjs`, and `tools/qa-complete-gaits-ranch.cjs`. The browser tests use the shared QA platform helper and an isolated save. See the asset README for attribution and the limits of the flat-floor checks.

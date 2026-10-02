# White late-recovery and backward hoof fold

Frozen `model.glb`: `b188f5ea0c985c673c678daebf5e36daa1147a18693cec15ecc1bca439740a07`.

The two stages use the untouched White488 kit. Stage one advances only ten Trot front-leg quaternion curves through a monotone late-swing phase map, producing exact intermediate `f8d688b660fbb841bfc168e86a9fa1d7bb3a92de2ad8ea87f79062a2fe0fa81d`. This brings the near-vertical cannon and hanging hoof into late recovery earlier. Stage two adds a maximum 30° front fetlock/pastern fold and 12° independent hoof fold during middle recovery in Walk, Trot and both Canters. The delayed quintic window is swing fraction .12→.46→.86. No additional timing change, hind-leg edit, root lift, translation or global gait solve is included.

The original 677 joints, source rest hierarchy, five meshes, weights, inverse binds, materials, images and binary prefix remain exact. The layered audit retains 3,552 original curves outside the permitted ten Trot fore and other-gait distal controls. Four `Native Foreleg Baseline | <gait>` companion clips carry exact phase-stage f1 curves plus source-default static f2 values. They are inputs for the runtime clearance gate rather than playable gaits. All stance key rows remain unchanged; casting default f2 values to float32 can introduce nanometre skin differences.

## Reproduction

From the repository root, with Python, NumPy and SciPy:

```sh
python3 review/native-trot-reference-kit/white/build.py /private/tmp/white-reference-fold-repro.glb
python3 review/native-trot-reference-kit/white/audit.py
```

The wrapper generates the phase intermediate in a temporary directory, checks its exact SHA, folds it, then checks the exact final SHA. Its checked-in inputs are `review/native-white-head-kit/model.glb` and `tools/asset-gen/rig_hero_horse.py`; there is no private pilot, ignored model or failed Bay dependency. `build-phase.py` and `build-fold.py` retain the frozen algorithms with portable paths and output arguments. Omitting the wrapper output argument regenerates this folder's model and reports. A clean temporary reproduction produced byte-exact b188. Original producer evidence remains preserved in the separate phase/fold pilot folders.

## Actual runtime evidence

`normal-rate-qa.json` records one complete cycle per gait at 60 fps and rate1 after two warm-up cycles, using the actual production controller and clearance helper. All677 joints are finite, zero browser errors, protected body/head/neck/groom/tack comparisons against the phase-stage source are exactly zero, and there are zero steady fallbacks. `gate-contact-delta.json` records no added negative depth in those samples. At Trot FL phase .6976, the gated current12°/6° hoof pitch is −65.34° and this candidate is −89.34°; whole-hoof clearance rises from147.81 to194.34mm. These are middle-swing poses, separate from the reference photo's late recovery.

`current-live-transition-qa.json` compares the actual gated current6a and final b188 across130 rest/gait/lead switches at30/60 fps and eight starting phases. It passes with zero added negative depth, zero body/head/saddle and phase delta, and zero per-case fallback increments. The existing worst transition floor minimum is −16.026mm in both versions; this model does not repair that inherited blend penetration. The helper measured p95 0.10ms/max0.40ms in this local browser run. The frozen helper SHA is `c96101951681c195e31cc07cdfc3bf525800e238f5760ef4499131caf7dcd8fa`.

The parent kit owns the original-source transition checks, mounted game proof and release decision. Its final public side-by-side report checks all three models and all four gaits, real clearance gates, matched phase, playback/view controls and13 exact response/model pins. See `../comparison-qa.json` and `../white-western-peak-comparison.png`.

The backward toe tuck is clearly visible. Walk recovery remains brisk: the normal-rate maximum local step is12.34°/16.67ms versus9.06° in the source; authored f1 maximum is5.238°/8.75ms. Faster all-bone normal-rate maxima remain the inherited carpus/hock values. Source Trot and Canter f1 tracks retain LINEAR interpolation and derivative joins; full fast-gait C1 is not claimed. Short strides, inherited joint caps, uneven rest placement and broader naturalism remain outside this correction. `curve-audit.json` preserves exact float32 step/rate/join figures. Direct unrestricted blending of the folded curves is unapproved; use the checked runtime gate.

Appearance, original rig and Western tack: [WildMesh 3D realistic horse demo](https://sketchfab.com/3d-models/horse-realistic-3d-model-demo-free-65d6a70a6721495f938c93e80a5998e4), [CC BY-NC4.0](https://creativecommons.org/licenses/by-nc/4.0/). Motion additions are project-authored, source-informed visual choices rather than measured physiological amplitude limits. Upstream source credit and gait provenance remain in the original kit/profile.

# Native Bay refined slow Walk

[Open the saved review](review.html): the original standing pose is on the left and the authored Walk on the right. The selector can also show the right-hand standing pose. The viewer loads only the adjacent [model.glb](model.glb), compact [build report](build-report.json), and repository Three.js files; it does not require ignored Bay comparison models. Two representative views are [side](side.png) and [quarter](quarter.png).

This is a **narrow private slow-Walk study**, with four beats, no flight, target-specific limb solving, heel/toe rollover and folded recovery. Independent 256-phase checks passed contact and preservation; the held fore-leg fold still has mechanical timing. See [the scoped verdict](REVIEW.md) and independent reports in this folder. This does not approve a breed, rider, faster gait, terrain, controller integration or the full roster.

## Source and preserved data

The Bay cage fit and static preparation derive from [WildMesh 3D's realistic horse demo](https://sketchfab.com/3d-models/horse-realistic-3d-model-demo-free-65d6a70a6721495f938c93e80a5998e4), under [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/). The original 677 joints, meshes, skin influences, native inverse binds, materials, images, Western tack and default standing pose are preserved. The static Bay input has zero clips; this GLB adds one independently authored clip, `Target Native Walk Rollover`. No new model was downloaded.

- Input `output/native-bay-preparation/native-bay-rest.glb` SHA-256: `6110fb3bcfe6ba6660c9c05d67269bc800d19706fab54db29633003d87f0a6a3`.
- Saved [model.glb](model.glb) SHA-256: `8f622bf3b22244ba1b6a39c72e3cb1ce6f2e378bb7eb731a22caba33b2459814`.

The Bay body is a nonuniform fit, so its actual pivots, skin and inverse binds are solved rather than copying White quaternion tracks. The above-floor trunk comparison ratio is 0.8496868094. The 1.12-second cycle, 65% duty and ±0.169937 m stroke imply **0.4668608843 m/s** nominal travel. Anatomical `_l` is FL/HL at positive X; the older Bay review's camera labels were reversed. [Native masks](native-foot-masks.json) contain the exact rest vertex IDs and definitions.

## Reproduction

Run from the repository root with Python 3, NumPy and SciPy. The builder also imports the tracked `tools/asset-gen/rig_hero_horse.py` and adjacent [joint reference](native-walk-joint-reference.json). It pins the prepared input hash and writes generated files under ignored `output/native-bay-rollover/`.

If the prepared static input is absent, regenerate it with the existing tracked fitting/preparation chain; there is no need to copy another 14 MB source into this folder:

```sh
python3 review/bay-native-proof/build.py
python3 review/bay-native-proof/build-fulljoint.py
python3 review/native-bay-walk/prepare.py
python3 review/native-bay-rollover/build.py
```

The first two scripts require the existing tracked native White asset, Bay rig input, breed profiles and asset generation modules, as described in [the Bay fitting proof](../bay-native-proof/README.md). The preparation removes creator clips while preserving the fitted default Bay skin. The authored Walk never copies the creator's crouching Walk.

Serve the repository on `127.0.0.1:8577`, open `review/native-bay-rollover/review.html`, and run the bounded saved-viewer smoke if needed:

```sh
NODE_PATH=/Users/mbphome/.npm-global/lib/node_modules QA_PORT=8577 node review/native-bay-rollover/smoke.cjs
```

The source [build.py](build.py) is unchanged from the frozen bake and still writes ignored output. [build-report.json](build-report.json) omits only per-frame rows; the complete original report remains in ignored output. [qa-summary.json](qa-summary.json) preserves the author's original 64-phase candidate check, which compared against the earlier Bay Walk before the saved viewer was made independent of that generated file. The saved viewer smoke checks readiness, finite standing/Walk poses, both views and the exact loop endpoints; it does not repeat the gait audit.

The inspector exposes `retargetSetClip('Target Native Walk Rollover')`, `retargetSetClip('Rest')`, `retargetSetPhase(fraction)`, `retargetInspect()` and `retargetClipSeams()`. The fixed body vertex1998 marker is trunk-weighted, not a proven anatomical withers point.

The inherited artwork and tack remain unchanged, including the high broad neck, dark narrow forelegs, bright eye and bulky saddle. The preserved [refinement plan](refinement-plan.md) describes the target-specific prerequisites for later Bay gaits; it does not authorize or contain those gaits.

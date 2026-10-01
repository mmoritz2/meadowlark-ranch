# White distal swing correction package

`model.glb` is the exact companion-enabled White candidate SHA-256 `6aee1b94a4d5b1c8f7580569ba32ca6248c0a4c29b4b3e26d790fb4ac53d562e`. Its immutable source is `../../native-white-head-kit/model.glb`, SHA `488a3382f9c2f44dc69ccdfe935a032a03dae768e794088aaf9fa04ad045f81f`. The producer's first Walk pilot and all-gait folded reference remain unchanged in `../../native-front-hoof-flex/`.

This model adds a maximum 12° fetlock/pastern and 6° independent hoof fold during middle front swing, to Walk, Trot and both Canters. The quintic lobe is zero until swing fraction .12, peaks at .46, and returns to zero at .86. Only four native distal quaternion channels per checked gait change; original stance keys, source default rest, all 677 joints/parents, weights/inverse binds, body/head/neck/groom, Western tack, materials/textures and original binary prefix are preserved.

Four `Native Foreleg Baseline | <original gait>` companion clips contain exact original `fingers_01` curves and static original `fingers_02` bindings. The runtime gate in the parent kit uses those source curves as mixer inputs and applies the extra fold only with actual sole clearance. The companion clips are not playable gaits. Direct folded-main blending was rejected after adding up to 11.35 mm penetration; see the retained parent rejection report. The parent gate's separate transition/mounted reports determine integration approval.

## Reproduction and evidence

From the repository root, with Python, NumPy and SciPy:

```sh
python3 review/native-front-hoof-kit/white/build.py review/native-white-head-kit/model.glb 488a3382f9c2f44dc69ccdfe935a032a03dae768e794088aaf9fa04ad045f81f /private/tmp/white-foreflex-repro.glb
python3 review/native-front-hoof-kit/white/audit.py
```

Omitting the three builder arguments uses the immutable source and writes this folder's `model.glb`, `model-report.json` and `model-pitch-keys.json`. The checked-in `tools/asset-gen/rig_hero_horse.py` is the only repository helper; there is no ignored/failed model prerequisite. `build.py` is the frozen producer algorithm with package-relative path defaults only. Its output is byte-identical to the producer's model. Saved `build-report.json` retains the producer's original evidence paths and actual hashes; `manifest.json` supplies portable package paths.

`steady-qa.json` preserves the actual 4×256-phase summary and exact/near-loop samples. The full paired GLTF results remain in `../../native-front-hoof-flex/all-gaits-browser-qa.json`. `companion-preservation.json` proves all 3,576 prior sampler arrays and the folded reference's entire binary prefix unchanged, permitting that evidence to carry to the companion-enabled package. `steady-contact-delta.json` gives the precise added-depth comparison rather than the runner's loose −5 mm flag. `curve-audit.json` reports every checked track's keyed steps/rates and normalized tangent joins. `foot-masks.json` fixes the original sole/whole-hoof/toe/heel IDs; all strict fore sole vertices are 100% `fingers_02`-weighted.

Actual steady checks had no errors, all 677 finite, body/head/neck/tack and all other local transforms exactly unchanged, fore stance-center error ≤1.30 nm and added whole-hoof penetration ≤1.06 nm. Fore swing patches stayed ≥0.670 mm above the canonical flat floor. The inherited Trot stance dip reaches −0.868 mm and remains unchanged. The canonical actor translation is `[-6.225790382362317e-9, 0.0047147771075021355, -1.6744842715166992]`; raw-source Y is not the game floor.

Walk and new hoof channels retain zero cubic tangent joins. White Trot/Canter source `fingers_01` curves remain LINEAR with inherited derivative jumps; complete fast-gait C1 is not claimed. Global keyed maxima are unchanged from the source, up to 4.888° per authored interval. Side captures show matched peak recovery before/after for all four gaits; independent steady geometry/quarter views are in `../../native-white-foreflex-diagnosis/`. These snapshots are geometry evidence and do not imply that a natural full-speed mounted release has been reviewed.

Appearance, full source rig and Western tack: [WildMesh 3D realistic horse demo](https://sketchfab.com/3d-models/horse-realistic-3d-model-demo-free-65d6a70a6721495f938c93e80a5998e4), [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/). The project authored this restrained distal correction. Source attribution/license and previous gait provenance remain in the immutable source chain/profile; no download or source rig reduction occurred here.

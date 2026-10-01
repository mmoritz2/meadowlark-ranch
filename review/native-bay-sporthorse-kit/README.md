# Bay Sporthorse cubic gait kit

This separate kit preserves the checked Sporthorse Walk and Trot and replaces the earlier LINEAR Canters with the checked periodic cubic pair. The old `../native-bay-sporthorse-mounted/` model and evidence remain intact. The kit itself supplies no creator Idle, Gallop or Jump. It is a bounded mounted/contact milestone, with the motion and art limits in [REVIEW.md](REVIEW.md).

Frozen [model.glb](model.glb) SHA-256: `d3e18fdc3926b22a9215f796f59cc6dccf044f5c2ae68a04385251e55947c272` (33,902,428 bytes). Immutable Sporthorse rest: `8f7f83e9669dc063dcb38455f8658369774ec0ce9b9eb81c2e7742e7d013d6a8`.

| Input | SHA-256 | Nominal ground speed |
| --- | --- | ---: |
| Walk | `512697ed36c8edb92cb31555e672026bb552d1f97d366d9afe9ac88b92e2dbf5` | 0.501090804 m/s |
| Trot | `6a14a61b3c99e529ddd25afba7a905d9b87fdc2b31160868ff00d1c778e6a557` | 1.266646199 m/s |
| Cubic Canter pair | `0162dd10be27992ae53c18772ad49eb29e2dffcb434b4521a7c849e3642429fe` | 1.781221217 m/s |

Each of the four clips has 82 CUBICSPLINE tracks. [preservation.json](preservation.json) verifies the original approved rest's nodes, five meshes, 677-joint skins/binds/materials/maps and binary prefix, plus every source animation input/output value and interpolation mode. The combiner changes accessor references only. [independent-kit-check.json](independent-kit-check.json) confirms the curve preservation separately.

The saved [viewer](review.html) uses the production `assets/native-horse-motion.js` factory, existing 65-bone rider library and `assets/native-rider.js` bridge. It supplies external nominal travel for the review. Seeking a cycle sets the active clip time for inspection; that seek is not transition evidence. The runtime horse controller is pose-only. [anchors.json](anchors.json) and [actual-coordinates.json](actual-coordinates.json) remeasure this target's native rest seat, treads, bits and hoof masks. Source seat is `[-0.0001730646301,1.582938121683,-4.1551310e-9]`; source-to-game translation is `[0.0001730646301,-8.5502384e-9,4.1551310e-9]`. No White game-space seat was copied.

Reproduce from the repository root using Python 3 with NumPy/SciPy:

```sh
python3 review/native-breed-targets/build.py bay-sporthorse
python3 review/native-bay-sporthorse-walk/build.py
python3 review/native-bay-sporthorse-trot/build.py
python3 review/native-bay-sporthorse-canter/build.py
python3 review/native-bay-sporthorse-canter/stage.py
python3 review/native-bay-sporthorse-canter-cubic/cubicize.py
python3 review/native-bay-sporthorse-kit/combine.py
python3 review/native-bay-sporthorse-kit/analyze.py
```

The Walk builder writes its candidate under ignored output; copy that exact model to its saved study after verifying the pinned SHA. Canter `stage.py` preserves its LINEAR input for cubic reproduction. Trot writes its saved candidate. [dependency-check.json](dependency-check.json) pins auxiliary inputs: native GLB helper, original White native kit/anchor reference, Sporthorse geometry-only NPZ/coat/input, original joint-range reference and compact gait reports. The native source GLB is already tracked. No rejected Bay animation or ignored baseline is a hard dependency. The target input's archived absolute geometry-reference path is provenance only; the builder reads the saved NPZ instead.

Serve the project root on 8584, then run:

```sh
NODE_PATH=/Users/mbphome/.npm-global/lib/node_modules QA_PORT=8584 node review/native-bay-sporthorse-kit/qa.cjs
NODE_PATH=/Users/mbphome/.npm-global/lib/node_modules QA_PORT=8584 node review/native-bay-sporthorse-kit/ranch-mounted-qa.cjs
NODE_PATH=/Users/mbphome/.npm-global/lib/node_modules QA_PORT=8584 node review/native-bay-sporthorse-kit/transitions-qa.cjs
```

The two Ranch scripts route only the Bay native profile HTTP response to this private candidate. They exercise the actual production rider, motion and player controller, but are explicitly **routed fixture evidence** under `bay-western`. They are separate from new-ID unrouted registration evidence. Full rows stay under ignored output. Compact reports pin model and loaded controller responses. [integration-summary.json](integration-summary.json), supplied by the integration owner, records the later actual unrouted game registration check.

The upstream WildMesh 3D source remains [CC BY-NC 4.0](../../assets/models/horse-imports/wildmesh-white-western/provenance.json), with [source inventory and attribution](../../assets/models/horse-imports/README.md). No new model was downloaded for this kit.

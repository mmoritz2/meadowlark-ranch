# Private White Walk head timing trial

One bounded neck/head-only trial is frozen at `output/native-white-walk-head-pilot/model.glb`, SHA-256 **488a3382f9c2f44dc69ccdfe935a032a03dae768e794088aaf9fa04ad045f81f**. It is a private timing/contact study, **not a claim that the complete Walk or torso dynamics are realistic**. No production asset, profile, controller or other horse was edited.

The input is the current full native 677-joint White kit, SHA-256 **fa797ad07137af09b1824cabe8737a530206804fcee2ab3a526ac12be1f08fc1**. Only the Walk's six rotation tracks `neck_01_014` through `neck_05_018` and `head_019` change. All 3,562 other tracks across its six clips remain bit-exact, including every limb, pelvis/spine, hair, tail, tack and other gait track. Original scene/node/mesh/skin/material/map data, original accessor/view prefix, joint order, inverse binds and binary prefix are exact. No reduced rig or leg re-solve is used.

[Loscher et al. (2016)](https://pmc.ncbi.nlm.nih.gov/articles/PMC5136594/) studied head/withers timing in walking warmbloods and the energetic effect of relative head–neck motion. The trial uses that work as a qualitative timing basis: two head cycles per stride, opposite the trunk's two-cycle component. The source model's joint origins are motion **proxies**, unlike the paper's optical markers; its slow configured travel, upright neck posture and breed/art geometry also differ. This is not a fit to a measured breed-specific displacement range.

At each original 128-key Walk pose the builder reconstructs every current animated parent transform. It then solves one bounded sagittal neck-pitch variable against a modest 70 mm head-origin span while deriving each selected local quaternion from the current parent and original world-rest orientation. Global neck pitch fractions are 0.45, 0.60, 0.75, 0.90, 1.00 and head 0.85; common pitch stays between −6.90° and +7.77°. The fixed head-height target also compensates inherited trunk translation at the head. It **does not remove or correct the trunk's four-cycle bob**. Periodic normalized cubic tangents retain smooth endpoint velocities.

## Actual GLTF comparison

Both input and candidate were loaded through Three.js and sampled at 256 phases of the unchanged 1.12 s, 0.54945 m/s Walk. Full-cycle side and quarter frames show a clearer gradual neck/head rise and fall, while the original high head carriage, slow short step and torso rhythm remain. The original mane/tail geometry stays attached and responds to its native parents. An ignored side GIF uses 16 evenly spaced actual GLTF poses at 70 ms/frame, giving the original 1.12 s cadence.

| Proxy/result | Current Walk | Private trial |
| --- | --- | --- |
| Head world-origin vertical span | 41.408 mm | 69.983 mm |
| Trunk world-origin vertical span | 18.936 mm | 18.936 mm, unchanged |
| Head/trunk second-harmonic phase | −35.398° | +179.999993° |
| Corresponding stride offset | 4.92% | 25.00% |
| Head second-harmonic amplitude | 17.799 mm | 35.000 mm |
| Head fourth-harmonic amplitude | 6.108 mm | approximately 0.000020 mm |

The trunk's **fourth-harmonic amplitude remains 6.001 mm**, larger than its 5.099 mm second harmonic. This phase result therefore describes the opposing **second-harmonic components**, not a repaired two-cycle torso. A coupled body/leg solve would be a separate change.

All 677 bone transforms are finite with no browser errors. Every tested hoof min/max/center and trunk origin matches the current Walk **exactly** at every phase. Stance whole-hoof minima remain +0.741 to +1.311 mm above the fixed floor. All source groom 23,514 vertices and their animation channels are preserved; 243 fixed sampled groom vertices respond to the changed native neck, with at most 103 mm difference from the old Walk. That displacement is not independent hair physics or an attachment gap.

The six changed tracks have zero measured normalized cubic internal/loop tangent mismatch. An independently recomputed analytic phase-1 pose using the original end-pose parents matches the candidate phase-0 quaternions within **0.00000261°**; this is not merely copied endpoint evidence. Their largest authored interval is 0.416° per 8.75 ms, with maximum dense local rate **47.64°/s**. Original limb continuity limits are unchanged.

## Private mounted check

A test-only HTTP profile response pointed the White choice to this private candidate. The actual Ranch gait/travel/rider/rein controllers were used, with controlled player speed and 64 time increments covering **0.999999996 cycles** after settling. Production files were unchanged. The loaded native motion controller was SHA-256 **2f44f6641225c9ab2d8b102b188da48fe9f45538211f0fb50d3a7808ad04edb6**. This is a routed private result, not an unrouted released-game claim or a transition/first-frame test.

Actual skinned boot soles stay within **0.565 μm** of the stirrup treads; dynamic rein endpoints stay within **2.63e−15 m** of bit and hand anchors. Non-rein source tack remains intact, all bones/rider transforms are finite, and there are no browser errors. For 1,405 fixed majority-neck-weight body triangles, the rendered main rein outer-edge and centerline segments have **zero surface intersections** over those 64 phases. The nearest sampled gap is 83.3 mm on the left and 84.1 mm on the right. This is a bounded surface/segment check, not exhaustive rein triangle/volume, hair collision, contact force or transition validation.

The clearer nod is a narrow improvement worth direct visual comparison. Source posture/art, original leg motion and four-cycle body bob prevent a blanket naturalism approval. No other breed's neck curves were transplanted from this White trial.

## Reproduction and evidence

`build.py` needs NumPy/SciPy and the repository GLB helper. Its default pinned input is the tracked `review/native-horse-kit/model.glb` (`fa797ad…`), preserved separately from the new head kit. An optional source argument must match the same SHA-256; an ignored cache is only a local backup, not a clean-checkout dependency. `curve-audit.py` reads and verifies the tracked original kit. The producer inputs and candidate remain separate; the frozen candidate was not rebaked after QA.

`qa.cjs` requires the checkout server on port 8584 and the repository Playwright runtime. `mounted-qa.cjs` uses a private profile fixture and real Ranch controls. `build-summary.json`, `qa-summary.json`, `curve-audit.json`, `mounted-summary.json` and fixed `contact-method.json` preserve concise evidence. Full measurements, solver targets, source cache, 32 captures, full-cycle sheets and nominal-speed GIFs remain in ignored output. `review.html` is a side-by-side current/trial viewer at normal cadence.

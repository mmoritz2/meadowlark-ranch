# Private realistic horse retarget: blocked

This experiment transfers the free CC0 Mesh2Motion horse's **Walk**, source-named **Trot**, and **Run** onto the original WildMesh realistic white horse and Western tack. Source Trot is a lateral pace, so the viewer calls it **Pace reference (source Trot)**. None of these clips is approved for gameplay. Run is not advertised as canter or gallop.

## What is preserved

The original 677-joint native skin, per-vertex weights, inverse binds, node hierarchy, meshes, materials, images, and texture bytes remain unchanged. Both creator clips remain present. `preservation-checks.json` confirms all original binary bytes are the candidate's unchanged prefix. Only new animation accessors/tracks and private-review metadata are appended.

Both source and target use +Y up and +Z forward after original scene transforms. Their local bone axes differ. The bake transfers each mapped source segment's world orientation delta from its default standing pose to the corresponding target segment's original world orientation, then solves target local rotations through the original parent hierarchy. Neck deltas interpolate across the target's longer chain. Unsupported corrective and tack nodes retain their original local transform and follow their original parent. Original reins follow head/neck; saddle follows spine; breeching follows hips. Side and quarter images show tack following those parts, but rider fit and tack collision have not been validated.

The new clips add small periodic rotations to 90 native hair detail controls (not all are strongly weighted), preserving the groom mesh and hierarchy. This is an experimental procedural layer, not creator-authored hair animation. Stronger realistic groom response still needs review. Original creator clips remain unaffected.

## Why the proof failed

Raw orientation transfer looked more upright, but its forefeet penetrated up to 31mm and its hindfeet failed to touch down (Walk minima 25/43mm; Run minima 178/86mm). A single bounded sagittal leg-chain fit tried to follow source sole trajectories while preserving terminal foot orientation and clamping source floor penetration. The corrections hit their ±45.8° limits and still missed the trajectories by **233mm Walk, 173mm pace reference, and 196mm Run**.

Ground minima alone hid the failure: after fitting, every Walk hoof reaches near the floor at some point, but the right hind is still 236mm above it during a source near-ground phase. In 96 sampled phases, the right hind exceeds the 15mm contact tolerance during 55 of 65 source near-ground Walk phases. Both Run hindfeet fail all their source near-ground phases. `contact-verdict.json` records all four soles. The near-ground mask selects source sole minimum <25mm at the corresponding shifted source time (target time +1/30s, with a final-frame loop bridge); the target tolerance is ±15mm around its fixed ground. This proxy is not proof of a planted foot, but the large residuals clearly fail contact. This proof does **not** pass contacts or stride and should not replace a Ranch horse.

The original default-pose proportions and source stride differ enough that preserving all joints does not establish a suitable animation. This pass does not solve the user's entire motion complaint: Walk head's local rotation changes only about 0.4°, while much of its visible head motion comes from the moving neck; native source Run has nearly constant pelvis/spine local rotations with translation-based body bob. Motion needs a more complete authoring pass.

## Verification

- 96 phases per new clip plus original Idle; 32 side/quarter snapshots; zero browser errors; 677 joints and finite geometry throughout.
- Fixed hoof masks contain 316/317 front vertices and 257/278 hind vertices; all masks are nonempty. Metrics use actual skinned vertex positions, not bone points or whole-model minimum bounds.
- Body marker is original skin vertex **1998**, weighted 76.1% spine04, 12.2% chest slider, 6.3% spine03, 5.5% neck slider. It is a fixed upper-back marker, **not anatomically verified withers**. Idle Y1.740–1.743m; new Walk Y1.673–1.718m. A 2–7cm drop remains.
- First-key source hold is shifted out and a final one-frame wrap bridge is added. Every baked new track's first and last values match exactly; The regenerated `output/mesh2motion-retarget/qa-report.json` also records phase 0, .99, and .99999 under `seamPoses`. This closes the original pose discontinuity at the wrap; endpoint equality does not establish smooth angular velocity or certify the gait.

## Reproduce privately

Keep the registered Mesh2Motion source and original WildMesh candidate present. Run the source audit to generate `output/mesh2motion-source-qa/report.json` first, then:

```
python3 review/mesh2motion-retarget/build.py
NODE_PATH=/Users/mbphome/.npm-global/lib/node_modules QA_PORT=8577 node review/mesh2motion-retarget/qa.cjs
```

Open `http://127.0.0.1:8577/review/mesh2motion-retarget/review.html`. The 27MB failed candidate GLB remains ignored/private. No roster, manifest, production asset, live checkout, or public deployment was changed.

Representative views: `M-M-Walk-side-0.png` shows the fitted Walk stance; `M-M-Walk-quarter-4.png` shows the leg/body/tack proportions; `M-M-Run-side-4.png` shows the unapproved Run pose. The fit improved some floor contacts but is not a uniformly better animation than the raw pass. The raw screenshots were not preserved as a separate viewer/candidate, so no exact-frame visual before/after claim is made.

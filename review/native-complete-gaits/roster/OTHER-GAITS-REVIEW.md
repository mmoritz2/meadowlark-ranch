# Existing breed body Walk, Canter and Jump audit

The 25 existing Artist40 body meshes pass this bounded authored-motion audit for Walk, both Canter leads and Jump. This is a geometry/playback result; it does not claim finished naturalism, terrain contact, mounted transitions or a new realistic body model.

`qa-other-gaits.cjs` loaded each unchanged original `assets/models/artist-breeds/<body>.glb` and the separate generated motion file through the actual GLTF loader. It used a raw Three mixer to inspect the clip without transition blending. Each of the 100 body/clip cases includes 129 phases, the true endpoint, valid nonempty fixed whole-hoof/sole/toe/heel masks, all 40 joint matrices, nine full-body skin scans, and ordinary 60 fps mixer playback. No request routing was used. Every fetched body/motion response hash matched its disk file. The original body SHA also matches the recorded build input.

| Clip | Lowest whole-hoof margin | Largest authored joint step | Endpoint rotation difference |
| --- | ---: | ---: | ---: |
| Walk | +0.9958 mm | 4.902° / 8.750 ms, Iceland FR forearm | 0.0000096° |
| Canter Left | +0.9922 mm | 4.760° / 5.000 ms, Sunset HL shin | 0.0000119° |
| Canter Right | +0.9915 mm | 5.336° / 5.000 ms, Clyde HL shin | 0.0001550° |
| Jump | +0.9990 mm | 7.763° / 12.891 ms, Sunset FR pastern | 0.0002101° |

All cases remained finite with zero page errors. The lowest sampled full-body point is +0.9918 mm. Every looping clip completed at least two actual playback wraps; every Jump clamped at its endpoint and returned external lift to zero. Maximum keyed contact residual across the builds is 0.0156 mm, and the maximum IK correction is 20.60° within the existing ±31.51° solver bound.

All output curves are LINEAR. The largest loop first/last secant velocity difference is 329.22°/s. The small un-copied pose closure is useful, but it is not C1 continuity. Fast recovery remains brisk. These limits should remain visible in release notes and later motion work.

The source references are approved White Trot/head-tail kit `84641a03…` for Walk, native Canter `32fb7bd2…` for both leads, and native Jump `d7e14d14…`. The separate clips preserve each original Artist40 skin, rest hierarchy, mesh, inverse binds and proportions. `audit-curves.py` independently reads the float32 GLBs and original body hashes; it does not trust the builder's continuity summaries.

## Jump timing caveat

These 25 Jump files were emitted by workers that had imported the earlier tool before physical timing scaling was added. Their height is correctly scaled by target size, but their current reports retain 1.65 s duration and gravity `9.81 * ratio`. The geometry audit used those exact reported lift pairs and records every affected target under `jumpTimingPendingNormalization`. Final packaging must multiply all Jump curve and metadata times by `sqrt(ratio)` and restore gravity to 9.81 m/s². The updated standalone tool does this for future builds. This time scaling does not alter pose or clearance at a matched normalized phase; actual packed runtime checks remain separate.

## Visual evidence and limits

Side and quarter captures for Welsh, Shire, Sunset Arabian and Friesian retain the distinct original body appearance. Sampled Walk, Canter and airborne Jump poses show articulated limbs, foreleg tuck and raised hindlegs without gross inversion, collapsed skin or visible tearing. Actual mixer-advanced normal-speed WebPs and eight-phase sheets are saved for Welsh and Shire. The public preview camera clips the Shire head at the highest Jump; this is a capture framing limit, not evidence about head skin quality. The Walk remains a short slow-walk reference. Artist40 mane topology and original body detail remain unchanged; this work does not provide the source677 groom system or a hair-physics claim.

The QA captures use raw clip playback while the public dropdown stays on its initially loaded Trot value. The filenames and sheet labels identify the actual tested clips. Ground is a fixed flat actor-local plane. World travel/terrain, entry-speed Jump sliding, arbitrary transition blends, fantasy equipment and mounted rider fit require final runtime validation.

## Reproduce

From the repository root, with the local server running and Playwright available:

```sh
OPENBLAS_NUM_THREADS=1 python3 review/native-complete-gaits/roster/audit-curves.py
NODE_PATH=/path/to/node_modules QA_PORT=8584 node review/native-complete-gaits/roster/qa-other-gaits.cjs
```

Reports: `other-gaits-browser-batch.json`, `other-gaits-browser-summary.json`, `other-gaits-curve-batch.json`. Contact sheets: `other-gaits-side-sheet.png`, `other-gaits-quarter-sheet.png`; representative playback and full-cycle sheets are in `welsh/` and `shire/`.

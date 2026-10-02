# Approved Trot transferred to the existing breed roster

All 25 distinct artist breed bodies now have target-specific, motion-only `trot.glb` files. Existing bodies, skins, inverse binds, full 40-joint hierarchies, textures and breed proportions remain unchanged. This transfers the approved motion; it does not replace the artist bodies with the realistic WildMesh body.

`tools/native-gaits/retarget-reference.py` maps source world rotation deltas to each target's original rest orientation, reflects anatomical sides correctly, and adjusts native target limb rotations using the actual skinned whole-hoof minimum and fixed sole centroid in Z. Source torso/head/tail pose stays fixed during the limb solve. Bone translations and scales remain original except a small source-derived root body offset. The source is the user-approved `84641a03…` White Trot, including its wider stride, strong backward hoof tuck, reduced head bob and moderate tail sway.

The corrected method warms two complete cycles before recording 129 poses. It retains the independently solved final endpoint, rather than copying the first pose to conceal a first-frame IK seed mismatch. Source samples are cached per worker. Reproduce the Trot batch with at most two workers:

```sh
OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1 python3 tools/native-gaits/retarget-reference.py \
  --all --jobs 2 --frames 128 --clip 'Target Native Trot' \
  --source review/native-trot-polish-pilot/model.glb
```

`trot-batch-summary.json` records per-target hashes, scale ratios and solve residuals. The largest authored stance-fit residual is 0.0256 mm. Every original body file still matches its source SHA. Maximum limb correction is 19.51°, within the deliberately bounded ±31.51° correction range.

`qa-batch.cjs` loads each actual body and separate motion GLB through the public private-review fixture, without routing responses. At 256 phases per body, all 40 joint transforms and fixed hoof samples are finite, with no browser errors. All 50 loaded GLB response hashes match their respective files. The lowest whole-hoof sample is +0.9055 mm above the fixed rest floor across all 25 targets; 16 full-body samples per target are also above floor (+0.9928 mm minimum). Each target completes two normal-speed loop wraps during 90 actual 60 fps mixer updates. These checks are recorded in `trot-browser-batch.json` and `trot-browser-summary.json`.

Welsh Mountain Pony, Shire, Sunset Arabian and Friesian have side/quarter captures and normal-speed WebPs. The sampled views retain upright body proportions and visible backward hoof folding, without gross joint inversion, skin collapse or tearing. Groom appearance and the original artist geometry remain limits; this is not a new asset-quality or groom-physics approval.

`trot-curve-batch.json` independently parses the final float32 curves. Maximum uncopied loop pose drift is 0.0000203°. The largest authored step is 5.305° over 5.625 ms (Chestnut right fore cannon), about 943°/s. The largest first/last secant velocity difference is 186.3°/s. These LINEAR curves preserve the approved source's brisk recovery; continuous derivatives and a new naturalism approval are not claimed. Runtime transition/contact behaviour, mounted equipment, world-travel planting and terrain require separate game checks.

Run the actual browser audit from the repository root with the local review server:

```sh
NODE_PATH=$(npm root -g) QA_PORT=8584 node review/native-complete-gaits/roster/qa-batch.cjs
```

The retarget tool also names `Horse|Horse_Idle` as `idle.glb`, Walk Rollover as `walk.glb`, and Canter/Jump clips by their lower-case names. Future Jump transfer scales pose timing by the square root of body size and external actor-lift height by body size, preserving the 9.81 m/s² reference parabola; its metadata records the time scale. Those separate gait outputs and game integration belong to the parent team's tasks.

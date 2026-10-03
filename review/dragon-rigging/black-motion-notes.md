# Black Dragon native motion

The original 3DHaupt model, creator `Scene` animation, all 232 joints, geometry,
skin weights, inverse bind matrices and textures are unchanged. The new file
`assets/models/dragon-motions/black-dragon-motion.glb` contains only four local
animation clips authored for those original joints.

| Clip | Duration | Source speed | Fitted speed at original .56245 scale |
| --- | ---: | ---: | ---: |
| DragonStand | 3.00 s | 0 | 0 |
| DragonWalk | 1.35 s | 1.369863 m/s | .7705 m/s |
| DragonRun | .78 s | 3.821499 m/s | 2.1494 m/s |
| DragonFly | 1.65 s | 12 m/s | 6.7498 m/s |

Ground movement uses a four-beat walk and diagonal-pair run, with fixed-height
stance feet, lifted swing feet and analytical two-link limb solves. The source
feet are separate root children; matched foot translation/rotation tracks keep
them attached to the solved lower limbs. Breathing, neck and tail motion are
included. Ground wings gather behind the shoulders. Flight has shoulder beats,
lagging outer fingers and tucked limbs. Flight speed is controller metadata;
there is no forward root motion or baked flight altitude in the clip.

The source rig is an artistic dragon rig, not a horse rig. These new motions are
locally authored game animations, not additional creator motions. The source's
very long wing fingers retain a broad gathered silhouette on the ground; they
are not resculpted. No mesh edits or new assets were downloaded.

## Reproduction and evidence

- `python3 tools/dragon-motions/build-black-dragon.py` (NumPy and SciPy)
- `NODE_PATH=<Playwright modules> node tools/dragon-motions/qa-black-dragon.cjs`
  with a local HTTP server on port 8584, or `QA_URL` set to another root.
- `assets/models/dragon-motions/black-dragon-motion.json` contains source/output
  hashes, exact clip metadata, authored tracks and bone anchors.
- `black-runtime-report.json` independently loads the packaged motion in Three.js
  and samples the actual skinned model at 49 phases per clip. All 232 joint
  matrices and every displayed skinned vertex are finite. All loop endpoint
  errors are zero. Ground skin clearance minimum is -0.056 mm (source rounding);
  flight minimum clearance is +172 mm before the actor's flight altitude.
- Twelve quarter-cycle images were rendered. Run and both wing extrema were
  visually inspected. `black-DragonRun-0.25.png`, `black-DragonFly-0.png` and
  `black-DragonFly-0.5.png` show the most useful poses.

The original creator source and license attribution remain in the existing
Black Dragon model profile. New motion does not change the source license.

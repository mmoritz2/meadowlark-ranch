# Bay native Trot with continuous playback

The frozen candidate passes the narrowly defined contact, diagonal-footfall, suspension, source-preservation and motion-continuity gates. It is a slow short-stride jog study with low aerial clearance and brisk regular recovery; it does not approve athletic trot, terrain, rider transitions or the whole roster.

`model.glb` SHA256 is `39a19a52bc45bb3dabb15e37b1f08c9deb35c3ee17cbe2834d1f9200a23cc4c4`. The immutable input is `../native-bay-rollover/rest.glb`, SHA256 `6110fb3bcfe6ba6660c9c05d67269bc800d19706fab54db29633003d87f0a6a3`. Every original default-rest node, five meshes, 677-joint skin, weight, inverse bind, material/map/image, scene and binary prefix is preserved. Only one `Target Native Trot` clip and derivative metadata are appended.

The builder rederives actual Bay pivots, rest skin and anatomical hoof masks instead of copying White quaternions. The above-floor trunk-marker ratio is `.8496868094412634`; marker1998 is spine/chest weighted and is not claimed to be anatomical withers. `_l` is anatomical FL/HL at positive X. Whole-hoof masks use a `.19*ratio` height cut, strict sole masks use their own minimum+7 mm, and toe/heel patches are rest-Z quartiles with ties included. Whole skinned hoof minima constrain the floor, while regional mean Z controls travel through heel/flat/toe contact.

The retained `.72 s` period, `.44` duty and `.1869310981 m` halfstroke imply `1.1801205687 m/s` stance backflow. FL+HR alternate with FR+HL; aerial windows are `.44–.50` and `.94–1`. The revised fore/hind lift is `.0934655490/.0849686809 m`, with a symmetric quartic arc `16u²(1−u)²`. A toe→sole→heel swing-anchor blend and a42° free-hoof pitch peak at mid-swing remove abrupt anchor/early-lift demands. Fore/hock/stifle swing biases are32/−22/8°. Body/head/groom response remains visible and upright; lateral body roll is zero. These are authored choices for this target, not measurements of a particular horse.

Two warm-up cycles seed the recorded128-phase cycle. The solve retains contact residual weight100 and bias.9, adds actual local quaternion second-difference weight4 across each chain and terminal, and a soft actual-joint step barrier above4.5° at weight75. An uncopied next phase-zero solve agrees within `.0000077°`. The verified recurring values then receive periodic glTF `CUBICSPLINE` tangents, projected into the quaternion tangent plane; both internal-key and loop derivatives join exactly after normalization. Key count remains128 intervals; smoothing is not obtained by increasing samples or reducing playback speed.

Float32 inspection reports largest authored limb interval `4.515°/5.625 ms`,73.1% below the failed first Bay Trot. Dense normalized-cubic sampling reports peak local angular speed862°/s and acceleration124,947°/s²; these remain brisk values and are kinematic estimates, not force or physiological measurements. Torso/neck/head maxima are.222° per interval and39.6°/s; groom.360° and64.1°/s. Analytic normalized quaternion velocity differences at every key and at the loop seam are zero. Fore carpal correction peaks66.33°, so its old70° cap holds are eliminated. Fore scapula−14° still holds191.25 ms each; the RH+20° hock bound also remains disclosed. Bounds are authored corrections, not physiological limits.

The author's1024-phase actual Three/GLTF scan has all677 transforms finite, zero browser errors, all-mesh minimum `+.748 mm`, stance whole-hoof minima `+.748–4.594 mm`,451+451 intended diagonal samples and122 aerial samples. Regional traveled anchor Z span is at most `.724 mm`; X is stable to floating precision. Aerial gaps are low, approximately4–8 mm at central-window samples. Whole-body/hoof minima are checked throughout the cubic interpolation, not merely at keys. Exact endpoints and genuine recurring-solve agreement are separate from the analytic C1 check. Fixed vertex-patch travel checks do not guarantee one contact point across every rolling edge or uneven ground.

Independent review confirms the narrow pass: upright body, progressive folded recovery and rollover, intact head/groom/tack, correct diagonals and low suspension. It explicitly retains the brisk recovery,191.25 ms shoulder holds and source art limits. Default Bay sculpture, narrow dark forelegs, bulky neck/tack, inherited eyes and coarse groom have not been modified to conceal motion defects. Mounted gait-switch blending is a separate gate.

Regenerate from repository root:

```sh
python3 review/native-bay-trot-continuous/build.py
python3 review/native-bay-trot-continuous/step-audit.py
QA_PORT=8584 NODE_PATH=/Users/mbphome/.npm-global/lib/node_modules node review/native-bay-trot-continuous/qa.cjs
```

The builder requires NumPy/SciPy, `tools/asset-gen/rig_hero_horse.py`, its sibling reference/helper and the pinned static input. `continuity-tools.py` contains reusable acceleration, step-barrier and periodic-cubic packing functions. `step-audit.py` reads exact float32 samples and normalized Hermite curves at8 substeps per key interval, including derivatives at the seam. `qa.cjs` uses the existing local Three/Playwright runtime and a repository HTTP server. Full-grid rows remain ignored output. `review.html` loads the saved model/report and compares default rest with normal-speed playback. Failed-attempt metadata records why physical target changes were needed; those earlier binaries are not dependencies.

Source horse: WildMesh3D, [Horse realistic3D model demo](https://sketchfab.com/3d-models/horse-realistic-3d-model-demo-free-65d6a70a6721495f938c93e80a5998e4), CC BY-NC4.0. Bay preparation and new animation are project-authored derivatives. This folder itself does not activate or release the gait.

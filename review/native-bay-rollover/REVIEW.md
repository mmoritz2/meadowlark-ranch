# Bay refined slow Walk: narrow private study

This candidate passes the bounded standing, contact, closed-loop and visual study. It is a separately solved slow Walk for the existing Bay body, not breed approval or a complete gait package. The original native Bay meshes, 677-joint skin, inverse binds, materials, textures, Western tack and default standing pose are unchanged. No roster or production file was changed.

Input `native-bay-rest.glb` SHA-256: `6110fb3bcfe6ba6660c9c05d67269bc800d19706fab54db29633003d87f0a6a3`.
Candidate `bay-native-walk-rollover.glb` SHA-256: `8f622bf3b22244ba1b6a39c72e3cb1ce6f2e378bb7eb731a22caba33b2459814`.
The Bay fitting/preparation chain derives from [WildMesh 3D's realistic horse demo](https://sketchfab.com/3d-models/horse-realistic-3d-model-demo-free-65d6a70a6721495f938c93e80a5998e4), licensed [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/). No additional source was acquired.

## Authored behavior

The clip starts from the high default standing pose and solves the actual Bay pivots and skinned hoof vertices. Bay is a nonuniform fit; copying the White quaternion tracks would not preserve contact. White refined-Walk timing, duty, heel/toe angles and body/groom logic are reused as authoring prescriptions, then Bay limb chains are solved independently.

The fixed trunk comparison vertex 1998 above-floor ratio is `0.8496868094412634` (Bay 1.479197 m versus White 1.740873 m). The resulting half-stroke is 0.169937 m and swing lift 0.076472 m. A 1.12-second stride with 65% stance gives **0.4668608843 m/s** nominal forward travel from stance backflow. This is a slow walk; a faster controller must not use the same timing without matching travel.

Footfalls are LH → LF → RH → RF at offsets 0, .25, .5, .75, with two or three supporting limbs and no aerial phase. Anatomical FL/HL are native `_l` at positive X; the older Bay review used reversed camera labels. Early heel contact begins at −5° pitch, flat stance follows, and late stance rolls onto the toe up to +13°. Swing hoof pitch reaches +35°; explicit fore and hind folding biases replace the earlier rigid hoof/straight recovery. No lateral torso roll is applied because the contact solve is sagittal.

The torso stays high with modest periodic motion, visible neck/head response, 51 original groom detail controls and a restrained native tail-base layer. These are authored loops, not physical hair simulation or rider-fit approval.

## Contact and preservation evidence

The standing probe passed before the gait bake. All 128 authoring samples fitted the vertical and regional stride goal within 5 mm; worst errors were 0.559 mm vertical and 0.187 mm along the stride. The author's 64-phase browser check had zero errors, finite geometry and all 677 joints, with all stance minima within 10 mm and identical first/last track values.

The independent 256-phase audit found:

- Whole-body floor clearance **+0.894 to +1.022 mm**; intended-stance whole-hoof minima **+0.894 to +1.207 mm**.
- Correct four-beat support and no flight. No gross crouch, limb inversion, skin collapse or tack detachment in full-cycle side/quarter and foot views.
- At the stated nominal travel, regional heel/flat/toe contact drift in XZ **≤0.0353 mm**. Each regional interval is checked separately; switching the contact patch is part of rollover.
- Geometric swing flexion maxima: fore FL **54.77°**, FR **53.03°**; hind hocks **70.03°**, **72.66°**. Fore recovery folds visibly more than the earlier Bay slow-Walk proof.
- Trunk vertex1998 stays **1.4724–1.4887 m** around its 1.4792 m default height. Head world Y range is **33.3 mm**, or **21.5 mm** relative to that trunk marker. Groom controls move.
- Original nodes, meshes, skins, materials, images, textures, samplers, scenes and binary prefix are preserved. The static input had zero clips; exactly one authored clip was appended.

Vertex1998 is a fixed comparison marker, not a proven anatomical withers point. Its weights are spine04 76.1%, chest slider 12.2%, spine03 6.3% and neck slider 5.5%.

Masks are derived from the actual default Bay skin and nearest anatomical distal marker in XZ. The author's broad low-hoof cutoff is `0.19 × ratio = 0.16144049 m`; strict sole IDs use each hoof's own minimum plus **7 mm, unscaled**. Heel/toe subsets use the lower/upper rest-Z quartiles. Contact height is +1 mm and the ±10 mm stance gate is also unscaled. The independent audit used a narrower `0.115 × ratio` broad mask and recovered the same four strict sole sets. Quantile ties add one extra fore toe vertex in the author sets (FL 3860, FR 14264); this difference is recorded rather than silently equated.

## Remaining limits

Both fore carpal corrections touch +45° for 22/128 samples, **192.5 ms** each, about half the 392 ms swing. The held folded apex and brisk unfolding remain visibly mechanical. Fore scapula corrections touch −10° for 34/36 samples (297.5/315 ms); hind hocks touch −35° for 17/19 samples (148.75/166.25 ms). Other limb correction caps are not reached. These are per-joint corrections relative to the native rest, not anatomical joint angles.

The existing Bay artwork has a broad high neck, narrow dark forelegs, a bright inherited eye and bulky Western tack. It was preserved, not redesigned. The proof uses fixed rest vertex patches and a level floor; it does not establish terrain adaptation, rider fit, Trot/Canter/Gallop/Jump, blending, production travel integration or approval across breeds.

The bounded candidate is frozen. No additional leg tuning was performed after independent review.

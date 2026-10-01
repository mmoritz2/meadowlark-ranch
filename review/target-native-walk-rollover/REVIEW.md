# Private slow Walk rollover refinement

This candidate passes as a narrow private slow-Walk study. It improves the frozen realistic slow-Walk proof with heel-to-toe movement, an angled swing hoof, and folded limb recovery. Own and independent contact, travel, and loop checks pass; the independent side/quarter review is recorded separately before broader acceptance. The original frozen slow-Walk output is unchanged. No production asset or roster is edited.

Candidate: `target-native-walk-rollover.glb`, SHA-256 `73053f039395f3dc5b728ebf8f89b1f9676da018745dca46b1104fc59a5a80b7`. Regenerate with `python3 output/target-native-walk-rollover/build.py`; open `/output/target-native-walk-rollover/review.html`. The viewer labels are “Original walk” and “Rebuilt slow walk.” The left is the creator's original Walk; the right is this candidate.

## Behavior and scope

The four-beat LH/LF/RH/RF offsets remain 0/0.25/0.5/0.75, with 65% stance and a 1.12-second cycle. There are two or three intended supporting legs throughout, with no aerial phase. The stance stroke remains 0.40 m, giving **0.54945 m/s** nominal travel from stance backflow. This remains a slow-Walk proof, not the game's previous faster travel speed.

The original high default standing pose is the body baseline. Pelvis bob is ±6 mm and the original proof's restrained sagittal torso, neck, and head response is retained. Global lateral body roll is zero; this pass solves sagittal plants, so it avoids lateral sliding from an uncompensated body roll. All original meshes, Western tack, 677 skin joints, inverse binds, weights, material/texture data and creator Idle/Walk clips are preserved, verified in `preservation-checks.json`.

Hoof placement starts with a −5-degree heel-first pitch, settles flat, then rolls +13 degrees onto the toe during late stance. Swing pitch changes freely through a +35-degree peak and returns for heel placement. Both fore and hind swing lift are 9 cm, with an early smooth flight peak. Recovery uses a conservative +24-degree carpal bias and −18-degree hock / +6-degree stifle bias rather than minimizing every limb angle. The original mane/tail detail layer and lagged 2.6-degree tail-base yaw / 0.8-degree pitch remain responsive.

The floor is fixed from the unchanged default skin at Y = −0.0047147771075021355 m. Low hoof masks are chosen once in rest. The solve uses the actual whole hoof patch minimum and a fixed heel, sole, or toe centroid appropriate to the contact phase. Raised heel/sole vertices during rollover are intentional. It does not force every sole vertex flat or choose a new patch based on current floor proximity.

## Own verification

The standing contact recovery probe passes. On the 128 authored key phases, worst whole-patch height-fit error is 0.459 mm and worst active-anchor Z error is 0.145 mm. The original binary prefix and all original geometry, rig, appearance, animations, accessors and buffer views match exactly.

The separate actual-GLTF browser scan at 128 phases reports zero errors, finite masks/poses, all 677 bones, exact copied first/last animation keys, and no intended stance minimum outside ±10 mm. Whole-hoof stance minima above the normalized fixed floor are FL 0.953–1.114 mm, FR 0.959–1.077 mm, HL 0.929–1.090 mm, HR 0.914–1.169 mm. Complete body minimum stays at least +0.914 mm. Upper-trunk skin marker 1998 remains Y 1.733–1.752 m versus creator Walk 1.617–1.649 m in this viewer. Marker 1998 is a fixed trunk-weighted comparison point, not a certified anatomical withers landmark.

`walk-side-0.png` shows fore recovery, hanging swing hoof and high torso; `walk-quarter-4.png` shows the corresponding quarter view and attached Western tack. Own side/quarter captures span eight phases each. The independent sixteen-phase side/quarter sequence reports no gross crouch, joint inversion, skin collapse or Western tack detachment. These visual samples and floor checks do not prove the full naturalism of the gait.

## Independent measured refinement

A separate 256-phase actual-skin audit reports no errors, no aerial phase, two/three-leg support throughout, and complete body minima +0.911 to +1.019 mm above the original fixed floor. Intended whole-hoof stance minima are FL 0.951–1.124 mm, FR 0.956–1.220 mm, HL 0.926–1.090 mm, HR 0.911–1.169 mm. Late rollover raises heels roughly 5–28 mm above toes; the active toe remains the near-floor edge.

At the stated 0.54945 m/s actor travel, active heel/sole/toe centroids stay within a regional horizontal span of 0.032 mm. These are centroid proxies and regimes are evaluated separately: a heel rotating upward after toe breakover is no longer the planted anchor. There is no lateral body roll.

The previous **frozen authored Walk**, not the creator Walk shown at left in this viewer, had fore swing geometric flexion maxima 16.4/14.3 degrees. This refinement reaches 54.7/53.1 degrees, showing a substantial folded fore recovery. Hind geometric maxima rise from 51.5/62.0 to 69.2/72.0 degrees. These are bone-center segment angles, not clinical joint ROM. Body motion remains almost identical to the frozen proof: upper-trunk excursion 19.3 mm, head 41.4 mm, pelvis 12.0 mm. Head relative to the trunk moves about 27.7 mm. See the independent contact sheets, sampled cycle GIFs and full reports in `output/target-native-walk-rollover-audit/`.

## Bounded joint corrections and remaining limits

Fore rest-relative sagittal bounds are clavicle ±10 degrees, upper arm ±30, lower arm ±38, and carpus −12/+45. Hind bounds are hip ±30, stifle ±40, hock −35/+20. These controls are model-space corrections, not clinical joint ROM. They are Walk-specific bounds; the Trot candidate's 70-degree carpal cap was not copied.

Per-joint cap results are preserved in `per-joint-caps.json`. Clavicle −10 degrees is reached for 34/36 fore key frames out of 128. Each carpus reaches +45 degrees for 22 key frames, roughly 193 ms (about half the short recovery interval); each hock reaches −35 degrees for 18 frames, roughly 158 ms. The maximum local correction is 45 degrees. Upper arm/lower arm/hip/stifle caps are not reached. This longer folded-joint plateau remains a mechanical limitation even while the upper chain and hanging hoof continue moving. No further widening or trajectory tuning is planned for this bounded candidate. Floor accuracy alone does not prove realistic swing, toe roll, acceleration or transitions. Regional planted-anchor travel passes at the stated 0.54945 m/s; playback review is still needed before replacing the frozen proof.

## Provenance

The preserved target comes from the registered [WildMesh realistic horse demo](https://sketchfab.com/3d-models/horse-realistic-3d-model-demo-free-65d6a70a6721495f938c93e80a5998e4), under CC BY-NC 4.0. Its existing attribution/license applies. This is authored on the original target and is independent of the failed source-pace transfer. Rollover direction and contact handling follow the primary references already recorded with the Trot proof and its independent audit.

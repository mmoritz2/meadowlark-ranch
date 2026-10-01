# Private authored slow Trot

This is a narrow, useful slow-Trot proof for the realistic white Western horse. It passes the measured diagonal support, fixed-floor hoof contact, loop closure, and regional planted-anchor checks. It preserves the original appearance and all 677 skin joints. It is not approval of the complete gait package, every breed, or the live game.

The frozen candidate is `target-native-trot.glb`, SHA-256 `64c2c8a0501d90573065465db4ff4f14c958d0dd2f655521a02c8e7b2f635113`. Regenerate with `python3 output/target-native-trot/build.py`; open `/output/target-native-trot/review.html`. The left horse shows its original walk and the right shows the authored slow Trot. Original frozen slow-Walk files are unchanged.

## Authored behavior

The new clip starts from this target's default high standing pose. It does not retime the old crouching Walk or reuse the imported source's lateral pace. FL+HR and FR+HL alternate at offsets 0 and 0.5, with 44% stance and two 6% suspension intervals. The 0.72-second cycle has a 0.44-meter stance stroke, implying 1.3889 m/s forward travel when paired with that stance backflow. This should be labeled a slow Trot/jog, not a working or extended Trot. Suspension at this low speed is an illustrative authored choice; a very slow Western jog may remain grounded.

Hooves transition through an 8-degree heel-first placement, a flat middle support, and 22-degree late heel lift about the toe. Swing pasterns hang at a changing pitch rather than remaining world-flat. The solver fits the actual whole hoof patch's minimum height and the active heel, sole, or toe centroid. It does not force raised heel vertices flat. Fore swing lift is 14 cm and hind lift 12 cm, with an early flight peak. Fore carpal flex bias and hind hock/stifle bias produce visibly folded recovery limbs.

The pelvis rises into suspension and lowers in diagonal midstance. Small sagittal torso, neck, and head rotations preserve the high body. There is no lateral body roll in this pass, so a sagittal plant solve does not introduce lateral slipping. Fifty-one original weighted mane/tail detail controls have layered phase-lagged motion; the tail base adds restrained yaw and pitch. Original tack follows the native hierarchy, and the captured side/quarter poses show it attached.

## Verified evidence

`preservation-checks.json` confirms identical original nodes, meshes, skins, inverse-bind/vertex data, materials, textures, images, scenes, original animations, accessors, buffer views, and original binary prefix. The candidate only appends authored tracks and metadata.

Own 128-phase browser QA and independent 256-phase QA report no browser errors, finite poses, and all 677 bones. Independent intended support is 113 samples for each diagonal pair and 30 airborne samples. Whole hoof minima during intended stance are 0.925–4.424 mm above the fixed original floor; whole-body minimum remains at least +0.925 mm. The authored first and last keys are identical, with no orientation or position loop snap.

The independent forward-travel check applies the stated 1.3889 m/s. It measures the active anchor within each heel-strike, flat, or toe-breakover region, avoiding the deliberate change from heel to sole to toe. Worst regional horizontal span is 0.606 mm at HR heel strike; toe-breakover spans are about 0.04–0.06 mm. Lateral spans are below 0.001 mm in this no-roll candidate. Raised heel travel across rollover is expected and is not counted as planted toe sliding.

Independent geometric flexion, measured as 180 degrees minus the segment interior angle, reaches 79.6/78.1 degrees at the fore carpals and 83.9/86.0 degrees at the hind hocks. This is visible articulation rather than an endpoint-only contact result. Torso marker 1998 stays high; this fixed trunk-weighted vertex is a comparison marker, not a proven anatomical withers point. See `trot-side-1.png` for folded fore recovery and `trot-quarter-4.png` for a diagonal/upright view. Independent full results and contact sheets are in `output/target-native-trot-audit/`.

## Limits and joint bounds

The solver uses target-native chain axes and bounded rest-relative sagittal corrections. Fore bounds are scapula ±14 degrees, upper arm ±35, lower arm ±45, and carpus −15/+70; hind bounds are hip ±35, stifle ±50, and hock −50/+20. These are local rest-relative controls, not direct anatomical ROM. The creator's original Walk already reaches roughly 52–58 degrees of local carpal correction; the wider Trot swing bound was deliberately chosen to fold recovery rather than make a straight fast walk.

Bounds are touched and must remain disclosed. Of 128 baked frames, clavicle −14 degrees is reached in 46/47 fore frames; the +70-degree carpal bound itself is reached for FL 12 frames and FR about 8–9 frames, approximately 45–68 ms. Some hind bounds are also touched. These plateaus can make recovery look held at maximum flexion. The independent per-joint counts are preserved in `per-joint-caps.json`. No bounds were widened after this successful contact pass, and no biomechanical validation is claimed. The head pivot has about 101 mm vertical excursion versus about 41 mm for the upper-trunk marker, and its trough leads pelvis midstance by about 46 ms. This is visible authored response, but its amplitude and lead still require a visual acceptance decision. The gait still needs real-time visual review, transitions, speed matching, and the remaining faster gaits before roster integration.

## Provenance and references

The appearance/rig comes from the registered [WildMesh realistic horse demo](https://sketchfab.com/3d-models/horse-realistic-3d-model-demo-free-65d6a70a6721495f938c93e80a5998e4), under CC BY-NC 4.0. Its existing license/provenance applies to the preserved target. This pilot's motion is authored on that target; the Mesh2Motion pace transfer is not used.

Primary research supplied during independent audit guided the qualitative timing: [trunk/head motion during diagonal midstance](https://pmc.ncbi.nlm.nih.gov/articles/PMC9657284/), [heel lift and toe breakover](https://pmc.ncbi.nlm.nih.gov/articles/PMC7259550/), [carpal swing and stance motion](https://pubmed.ncbi.nlm.nih.gov/15656494/), and [early hoof-flight elevation](https://pubmed.ncbi.nlm.nih.gov/9259814/). These guide the proof; they do not certify this asset's animation as measured equine biomechanics.

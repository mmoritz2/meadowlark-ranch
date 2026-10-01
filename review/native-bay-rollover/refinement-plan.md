# Bay motion refinement prerequisites

**Finding:** reuse the white gait timing and parameterized contact/roll logic, then solve each pose on the Bay target. Directly copying white animation angles cannot retain exact Bay contacts. No gait was authored during this audit.

Input is `native-bay-rest.glb` (SHA `6110fb3bcfe6ba6660c9c05d67269bc800d19706fab54db29633003d87f0a6a3`), compacted from the native full-joint Bay cage fit. It has zero clips. Keep the full-joint source and frozen older Bay Walk as references; do not overwrite them or silently reintroduce the creator's low Walk.

## What is compatible

- All 677 joint IDs, order, parent links and local rotations/scales match the registered white native source. Anatomical chain names, sagittal axis handling and weighted groom controls can be reused.
- All five meshes retain white topology, vertex counts, joint indices and weights. Bay positions differ on all five meshes; its cage-fitted Western tack, coat and hair must remain unchanged during motion authoring.
- Bay inverse binds and local pivot translations belong to the Bay fit. Joint-head deviation from uniformly wrapper-scaled white is median **26.3 mm**, maximum **99.9 mm**. Fore segment length ratios range **0.820–0.878**, hind **0.825–0.859**, so one scale factor does not reproduce all limb reach.
- Old prepared-mask names are camera labels: `frontLeft`/`hindLeft` map to native `_r`. New authoring must use anatomical **FL/HL = `_l`**, positive X, and **FR/HR = `_r`**, negative X. Recompute masks from actual Bay rest skin and native distal markers; do not transplant camera-label assignments or white toe/heel IDs.

## Initial size-scaled seeds

Use above-floor trunk marker 1998, rather than raw world Y: Bay/white ratio **0.8496868094**. The old Bay pilot used raw-Y ratio 0.8519942501; the difference is small but arises from differing floor origins. Marker 1998 is a fixed trunk-weighted probe, not a verified withers landmark.

| Study | Cycle / duty | Half stroke | Fore / hind lift | Implied travel speed |
|---|---|---:|---:|---:|
| Refined Walk | 1.12 s / .65 | .16994 m | .07647 / .07647 m | .46686 m/s |
| Diagonal Trot | .72 s / .44 | .18693 m | .11896 / .10196 m | 1.18012 m/s |
| Canter leads | .64 s / .40 | .21242 m | .12745 / .11896 m | 1.65954 m/s |

These are unapproved starting targets. Keep angular bounds and gait phases as initial white-method settings, but solve Bay-native chains and report every cap touch. Scale meter-valued stroke/lift/body translations and lead-center offsets; use Bay rest world orientation for torso/neck/head and hoof rotation goals. Keep body roll zero until planted feet are solved in 3D.

## Bounded implementation order

1. Freeze the Bay input hash and derive fixed floor, anatomical whole-hoof patches, strict low soles and rest-Z toe/heel subsets from Bay skin. Validate nonempty finite masks and a standing contact recovery before authoring.
2. Author **one separate refined Walk candidate first**, retaining .65 duty, four beats, no air and white rollover/fold prescription. Preserve every original Bay mesh/skin/bind/material/node/texture array and binary prefix. Record actual speed, masks, source hash, standing probe and per-joint caps.
3. Make one actual-GLTF full-cycle contact/loop scan and side/quarter review, including toe/heel edge contact, whole-body floor and nominal-speed regional X/Z plants. Dark coat and narrow leg silhouette need clear lighting; retained bright eye/bulky tack/broad neck are appearance limits, not animation fixes. Compare with both the frozen Bay Walk and preferred white horse.
4. Only after that narrow pass, prepare separate Trot and both Canter leads using their actual gait phase definitions. Repeat Bay-native contact/reach review per gait; do not infer faster-gait approval from Walk or assume white cap durations carry over. Preserve mirrored footfall roles while disclosing native rest-placement asymmetry.

Rider fit, speed transitions and four-horse runtime performance remain later integration checks. This plan makes no breed/roster approval and changes no production asset.

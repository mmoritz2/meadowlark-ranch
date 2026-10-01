# Private horse secondary-motion review

Open `horse-secondary-motion.html?horse=white` from a localhost server rooted at the repository. The `?horse=bay` option loads the ignored experimental full-rig Bay file from `output/native-bay-proof/native-bay-prototype.glb`, if that file exists. Both panels use the same creator Walk at the same phase. The right panel alone adds local rotations to weighted mane and tail detail joints. Use Side view, Mane close-up, and Tail close-up while the walk plays. `2× Walk` accelerates that clip for motion inspection; it is not a new trot, canter, or gallop.

## Measured cause of the current stiffness

The previous Bay game GLB has 40 joints and nine baked clips. Its gait-specific upper-body local rotation excursion is tiny:

| Baked clip | Spine | Lower neck | Head | Pelvis | Chest |
| --- | ---: | ---: | ---: | ---: | ---: |
| Walk | 0.11° | 0.64° | 0.92° | 0° | 0° |
| Trot | 0.12° | 0.83° | 0.75° | 0° | 0° |
| Canter | 0.62–0.63° | 1.34–1.77° | 0.85–0.97° | 0° | 0° |
| Gallop | 0.51–0.72° | 1.33–2.34° | 0.85–1.02° | 0° | 0° |

The original WildMesh creator Walk instead changes pelvis by 17.5°, first spine joint by 11.5°, first neck joint by 11.7°, and head by 8.35°. Those are excursions from the first keyed orientation, not absolute anatomical joint angles. Its 677-joint rig includes a separate skinned Hair mesh with 23,514 vertices. Many mane and tail detail joints have animation channels but essentially constant local rotations in Walk, which explains why the body moves while the hair hangs rigidly.

## Prototype and limits

The review layer identifies 51 original, meaningfully weighted hair joints: 28 mane/forelock and 23 tail joints. It rotates each strand at a different phase, with smaller root and larger tip motion and a seamless integer-period walk loop. At 1×, the largest individual additive change is 3.1–4.2° across sampled phases; at 2× it is 3.9–5.4°. It resets every hair joint to its base local rotation before adding the current frame, avoiding accumulation on bones omitted by the source clip. The creator body, head, neck, leg, and tack transforms stay unchanged. This is a visual study, not a gait or physics implementation.

The same layer runs on the native-rig Bay proof because that proof retains the original 677 names, skin indices, and hair mesh. It cannot repair the old 40-joint Bay exports, where detailed strand weights were merged away. It also cannot repair the Bay's crouched walk or create missing fast gaits; those require body-motion and contact authoring on the retained native rig. Other sourced horses need their own groom bones or a separately validated groom simulation. A universal tail sway on four collapsed joints will not reproduce the original strand movement.

`tools/qa-horse-secondary-motion.cjs` captures the comparison at six speed/phase combinations and separate mane/tail close-ups. On both white and native Bay proof, it verified 677 bones, 51 responsive strands, exact component equality for sampled pelvis/spine/neck/head/tail-root quaternions between panels, and zero browser errors. Screenshots and JSON reports are under ignored `output/horse-secondary-motion/{white,bay}/`.

# Native white horse travel and rider harness — private

Open [`travel.html`](travel.html) on the local project server. It runs the
frozen white 677-joint horse's **`Target Native Walk` only**, at the clip's
measured **0.549450549 m/s** travel speed. Start/Pause, Reset, side/quarter
views, camera follow, rider visibility, contact markers, and a cycle scrubber
are included. No missing gait is substituted with a faster Walk. The viewer is
a flat-floor inspection tool, not the Ranch controller or roster integration.

`prepare.py` reads `review/target-native-walk/model.glb` (SHA-256
`dcec158d30a7bab814b4aaaeeb07dff95fc54d4dbe71db704858928fe2c904ec`),
its fixed hoof masks, and the existing WildMesh source-tack geometry report.
It identifies original indexed tack components: 54 skinned vertices in each
Western stirrup tread (components 91/89), and the two original bit rings
(209/205). These four parts register against the game's previously measured
tack contacts with a maximum translation residual below **0.00004 mm**. The
source frame has +Y up, +Z forward, floor at **−0.004714777 m**, and original
saddle seat at approximately **(0, 1.738081712, 1.674484272) m**. Adding
`(0, +0.004714777, −1.674484272) m` makes the floor zero and puts the saddle
seat at local Z=0. The 677-joint graph, mesh, weights, binds, and original
Western tack are loaded unchanged. Exact component/sole vertex IDs and the
normalizer are in [`anchors.json`](anchors.json).

The 1.12-second clip moves each planted foot backward 0.40 m over a 65% stance.
The harness applies 0.40 m of forward **actor** travel during that same stance;
the animation mixer never receives world travel. Browser QA sampled every
original skinned sole vertex at **257 points across each hoof's full stance**,
including the endpoint. It measured traveled world positions, not just
in-place height:

| Hoof | Sole vertices | Sole centroid forward range | Centroid sideways range | Greatest same-vertex XZ shift from stance start | Stance sole height |
| --- | ---: | ---: | ---: | ---: | ---: |
| Hind left | 74 | 0.14 mm | 9.79 mm | 5.42 mm | −0.60 to +6.50 mm |
| Front left | 115 | 0.12 mm | 4.92 mm | 4.92 mm | −0.14 to +6.76 mm |
| Hind right | 65 | 0.12 mm | 9.85 mm | 5.45 mm | −1.23 to +5.70 mm |
| Front right | 104 | 0.35 mm | 4.90 mm | 4.90 mm | −0.77 to +6.87 mm |

Forward sliding is very small at this exact speed; **sideways motion remains**,
especially at the hind hooves. It likely comes from the body roll coupled with
the gait's sagittal-only limb solve. These measurements do not establish
fully realistic planted feet, toe/heel rollover, steering, acceleration, or
uneven-ground contact. The contact threshold pass in [`qa-summary.json`](qa-summary.json)
is a technical check, not an aesthetic approval.

The harness loads the game's existing **65-bone Quaternius CC0 rider** through
`assets/rider-model.js`, seats her on the original native saddle, and uses the
game's role-leg IK with each boot's **measured skinned sole vertices** against
the **measured native stirrup tread vertices**. Across eight Walk phases, the
boot-sole/tread centers differ by under 0.001 mm. This confirms the IK target
calculation, but the full body, saddle pressure, reins, and riding posture
remain visual review gates. QA captured eight side and eight quarter poses;
representative [`side`](travel-side-3.png) and [`quarter`](travel-quarter-3.png)
stills are saved here. The remaining captures are generated under
`output/native-horse-travel/` by the QA command.
The start/pause control passed browser QA with zero console or page errors.

The unchanged source reins hang low. In the relaxed rider pose, her hands are
**19.4–20.9 cm** from the nearest original inner-rein vertices by the saddle.
`prepare.py` records exact original candidate sets (12 left, 10 right)
weighted to the native `reins_01_inner_*` controls. The optional **Rein grip
study** button uses arm IK to reduce hand-to-rein distance to 2.0–11.2 mm, but
the elbows open to **161.6–172.8°**; the right arm is almost straight. The
side and quarter test images are [`grip-study-side-375.png`](grip-study-side-375.png)
and [`grip-study-quarter-375.png`](grip-study-quarter-375.png). This strained
option stays **off by default** and is not approved. A separate native-rein
control experiment can test whether the original rein curve can rise toward
the relaxed hands while the bit and saddle attachments remain fixed.

Reproduce privately from the worktree root with a local static server:

```sh
python3 review/native-horse-travel/prepare.py
NODE_PATH=/Users/mbphome/.npm-global/lib/node_modules QA_PORT=8577 node review/native-horse-travel/qa.cjs
```

The saved concise result is [`qa-summary.json`](qa-summary.json). The full
generated QA report and phase captures are written under
`output/native-horse-travel/`.
The preview uses WildMesh 3D's realistic horse and original Western tack under
**CC BY-NC 4.0**, and Quaternius' rider under **CC0**. No production model,
roster entry, shared controller, or live site was changed. The harness is one
slow Walk proof; faster gaits, four-horse frame time, rider hands, and user
visual approval remain open.

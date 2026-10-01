# Mesh2Motion original horse source audit

Private source-only motion study. **Useful motion reference, not gameplay approved.** Walk and Run have distinct leg, torso, head, and tail motion. The clip called **Trot is a lateral pace**, hoof contact needs correction, and native playback has a loop snap. The source body is a simple horse and is not a proposed replacement for the realistic white Western horse.

Viewer: `http://127.0.0.1:8577/review/mesh2motion-source/viewer.html`

## Scope and method

- Unchanged `assets/models/horse-motion-sources/mesh2motion/horse-animations.glb`; one skinned mesh, 56 joints, 14 clips. No grounding, retargeting, pose edits, extra movement, or model scale adjustment.
- 96 equally spaced phases per Rest_Pose, Idle, Walk, Trot, Run; eight captures per clip from both side and quarter views; 80 screenshots. Browser errors: zero. Regenerate full measurements and captures under `output/mesh2motion-source-qa/` with `qa.cjs` from the checkout root. Six representative captures are preserved here.
- Source world axes: +Y up; +Z forward; anatomical `_l` limbs are +X, `_r` −X. Rest source mesh height is 2.033587 m. The exported root has an approximately −90° X rotation.
- Fixed floor **Y = 0.000419129 m**, the lowest skinned mesh point in Rest_Pose at t=0.05 s. The floor never follows the animated horse.
- Four fixed sole masks, each 20 vertex IDs: sum of weights to front `front_leg_foot_[l/r]` + `front_leg_leaf_[l/r]`, or rear `back_leg_toe_[l/r]` + `back_leg_leaf_[l/r]`, must exceed 0.20. Sort those candidates by Rest_Pose world Y, then retain the lowest 30%. Exact IDs are in `output/mesh2motion-source-qa/report.json → structure.footVertices`.
- Sole height is the lowest animated world Y of each fixed mask, minus fixed floor. It is an approximate skinned sole measurement, not a claim that the foot is planted. In-place backflow requires matched game translation before foot sliding can be assessed.

## Ground contact

Sole ranges in millimeters relative to fixed Rest_Pose floor:

| Clip | FL | FR | HL | HR |
|---|---:|---:|---:|---:|
| Walk | −20 to 165 | −31 to 222 | 5 to 180 | −5 to 122 |
| Trot (pace) | −57 to 187 | −47 to 293 | −25 to 124 | −15 to 122 |
| Run | −22 to 316 | −36 to 229 | −11 to 480 | −19 to 620 |

Lowest full-mesh point ranges: Walk −31 to +3 mm; Trot −57 to +75 mm; Run −36 to +141 mm. The positive minima in fast clips include intended airborne phases; they do not mean every hoof should be shifted down. Idle also penetrates the fixed floor by about 8–9 mm.

### The source Trot is a pace

Using sole minimum <25 mm as a near-ground proxy, the lateral left pair contact windows are FL phases 0.542–0.875 and HL 0.448–0.885. The lateral right pair FR and HR both have near-ground phases 0.000–0.396. This same-side pairing is clearly visible in the original screenshots; it is not a left/right naming ambiguity because front and hind `_l` both lie at +X. Do not label this unchanged motion as a realistic trot. A private correction could rephase the hind limbs by half a cycle, but that needs its own body/hip/contact review.

Run has a distinct extended/collected stride and substantial tail movement. It is one generic Run source, not a separately authored canter and gallop pair. The source includes no Jump clip.

## Torso, head, and tail

Source world joint Y ranges in meters:

| Joint | Rest | Walk | Trot (pace) | Run |
|---|---:|---:|---:|---:|
| hips | 1.305 | 1.278–1.315 | 1.224–1.309 | 1.333–1.411 |
| spine_3 | 1.312 | 1.264–1.301 | 1.225–1.284 | 1.188–1.273 |
| spine_4 (neck base) | 1.386 | 1.319–1.355 | 1.324–1.365 | 1.254–1.333 |
| head pivot | 1.756 | 1.587–1.623 | 1.678–1.777 | 1.574–1.652 |

Walk lowers the neck base by roughly 3–7 cm from Rest_Pose and lowers the head; the simple source does not show the severe low belly posture of the rejected white Walk. This is a visual judgment of the source body, not proof that transferring it will fix a different horse.

Local angular excursion through a cycle: Walk hips 9.6°, spine_4 4.3°, head 2.2°, tail_1 5.2°; Trot head 10.6°, tail_1 19.0°, tail_4 58.1°; Run head 10.1°, tail_1 23.1°, tail_4 68.6°. The tail has a dedicated chain. There is no separate mane joint chain in the source; realistic mane movement still needs the detailed target groom layer.

## Loop caveat

All clip keys begin at **1/30 s**, not zero. Nominal durations: Walk 0.966667 s, Trot 0.700000 s, Run 0.433333 s. The last key does not equal the first. Largest first-to-last local angular differences are Walk 10.53° at `front_leg_ankle_r`, Trot 29.18° at `front_leg_ankle_r`, and Run 30.25° at `front_leg_lower_l`. Hip translation seams are 0.73, 8.86, and 3.43 mm respectively.

Unmodified Three.js playback snaps on wrap and holds the first pose for the initial 33 ms. For a candidate bake, shift source keys back by 1/30 s and append the first pose at the original nominal duration, creating a final one-frame interpolation interval. Merely shortening the clip by 1/30 s leaves a hard seam. Check the resulting motion visually and preserve the original source alongside any correction.

## Verdict

Continue a private realistic-white-horse retarget pilot using Walk and Run as reference. Treat the labeled Trot as a pace until explicitly corrected and checked. Native source contact, loop continuity, mane motion, realistic target anatomy, tack fit, and game travel speed remain release gates. Zero browser errors and finite skinned geometry do not approve the gait.

## Reproduce the audit

Run a local static server at port 8577 from the checkout root, then:

```sh
NODE_PATH=/Users/mbphome/.npm-global/lib/node_modules QA_PORT=8577 node review/mesh2motion-source/qa.cjs
```

The browser harness samples finite geometry and nonempty sole masks. Its successful exit does not certify gait quality; contact and loop findings above remain blockers.

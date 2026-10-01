# White horse target-authored slow Walk proof

**Result: the bounded standing/contact/loop proof passes. Visual realism remains a review gate; this is not approval for a complete horse gait package or the 80-horse roster.**

The private viewer compares the original crouching Walk against a new slow Walk authored around the realistic white horse's original standing proportions. It preserves all original mesh bytes, textures, Western tack, inverse binds, per-vertex weights, and 677-joint skin. The original creator clips remain unchanged. `preservation-checks.json` verifies those properties against the registered native candidate.

## Motion

The new clip uses lateral four-beat order LH/LF/RH/RF, 65% stance, a 1.12s cycle, a 0.40m total hoof stroke, and a 0.09m swing lift. Its stance backflow implies **0.549m/s travel**, so it must not be played at the game's existing 2m/s walk speed. Root translation is zero for this in-place comparison. The pelvis has a restrained ±6mm bob, and torso, neck, and head controls have small periodic rotations. The original low Walk posture is not used.

Actual target skinned sole masks, not bone points, define the fixed ground and foot goals. Forelimbs use the original clavicle/scapular segment plus three distal segments; hindlimbs use their native three-segment chains. Scapular corrections stay within 10°, other solved corrections within 25°. Some controls touch these bounds, so the builder's conservative `authoredGridPass` flag remains false; this is explicitly recorded rather than widening the bounds again. Contact tolerances and target trajectories pass independently despite that flag.

The hoof/pastern's original world orientation is retained while fitting, so toe rollover and dangling during swing are not fully authored. The fore swing remains fairly straight. These are visual realism limitations, not solved by the floor test. There are no trot, canter, gallop, jump, rider, or Ranch-scene approvals.

Fine groom motion uses 51 original strongly weighted mane/tail controls. A separate tail-only layer adds 2.6° global yaw and 0.8° pitch to the original main tail-base control; the downstream native tail chain and groom follow it. This final layer leaves every previously baked leg/body track and accessor unchanged. It is recorded by `add-tail.py` and independently audited.

## Verification

- First confirmed the original standing skin could reach the fixed floor using the native graph with negligible corrections.
- Own browser scan: 128 phases, 84 intended-stance samples per hoof, 16 side/quarter views, zero browser errors, all 677 skin joints finite.
- Intended-stance sole bounds across all four feet: **−1.23 to +6.83mm** relative to the fixed floor. Every sampled sole point satisfies ±10mm; no empty masks. Independent auditor repeated the contact scan at 256 phases.
- Original skin vertex1998 is a fixed upper-back comparison marker, weighted about 76% spine04/12% chest slider/6% spine03/5% neck slider. It is not anatomically verified withers. Rebuilt Walk marker Y is **1.733–1.752m**, versus original Walk **1.617–1.649m** in the same viewer. The low crouch is removed from this proof.
- New clip's first/last track values match exactly. Trajectory positions/velocities are continuous through the swing/stance boundaries; cubic swing forward motion matches stance's backward endpoint velocity.
- Side and quarter snapshots show the tack following the original body/head parent chains and no egregious leg inversion. Tack collision and rider fit still require dedicated review.

Contact QA was recorded before the tail-only addition, then the independent auditor verified every pre-existing track remained identical and captured final tail views. No leg solve or cap tuning followed the final 10° scapular pass.

## Reproduce privately

```
python3 review/target-native-walk/build.py
python3 review/target-native-walk/add-tail.py
NODE_PATH=/Users/mbphome/.npm-global/lib/node_modules QA_PORT=8577 node review/target-native-walk/qa.cjs
```

Run the tail script once after a fresh build. The final private asset is `output/target-native-walk/target-native-walk.glb`, SHA256 `dcec158d30a7bab814b4aaaeeb07dff95fc54d4dbe71db704858928fe2c904ec`. Open `http://127.0.0.1:8577/review/target-native-walk/review.html`. Existing production files and roster were not changed.

Appearance, original rig, and Western tack: [WildMesh 3D realistic horse demo](https://sketchfab.com/3d-models/horse-realistic-3d-model-demo-free-65d6a70a6721495f938c93e80a5998e4), CC BY-NC 4.0. New private Walk curves are authored by this project, not supplied by Mesh2Motion or WildMesh.

The frozen final asset is preserved here as `model.glb` for a working review without regenerating. The build scripts regenerate their private candidate under ignored `output/target-native-walk/`; replace the preserved review model and metadata only after independent review.

Independent review and summaries are preserved beside this file. Their full sampled pose reports and the separate audit viewer remain under ignored `output/target-native-walk-audit/`. Final tail stills and the track identity check are preserved here.

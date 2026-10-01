# Bay rebuilt slow Walk — private first-pass review

**Verdict:** the experimental Bay clip passes the measured stance-contact and
loop checks, and it does not show the creator Walk's persistent low torso/head.
It is **not approved for roster use**. Several limb poses still read stiff in
the side view, the dark coat makes joint action hard to judge, and mane motion
is subtle. This is one slow Walk, with no faster-gait, rider-fit, four-horse
performance, or gameplay review.

Open [the interactive reviewer](../../output/native-bay-preparation/review-walk.html) on a local server, or examine
the eight [side](../../output/native-bay-preparation/bay-walk-side-0.png) and eight
[quarter](../../output/native-bay-preparation/bay-walk-quarter-0.png) phase captures. The browser reviewer exposes
`bayWalkSetPhase(f)`, `bayWalkInspect()`, and `bayWalkClipSeams()` for repeatable
inspection. The GLB is [bay-target-native-walk.glb](../../output/native-bay-preparation/bay-target-native-walk.glb).

## Target and method

`native-bay-rest.glb` is the static Bay fit of WildMesh 3D's realistic horse,
with 677 original joints, skin influence arrays, bind matrices, five skinned
meshes, source materials, and Western tack. `bake-bay-walk.py` adapts the frozen
target-native builder in `output/target-native-walk/build.py` (SHA-256
`c5bfda47a4cae4ca51aee74076485bf99c6744639d2a548ad03641f90f562c9a`).
It solves against **Bay skinned sole patches and Bay joint pivots**, not the
white model's recorded joint angles or the creator's crouching Walk.

The spine-weighted comparison vertex 1998 stands at 1.479197 m on Bay versus
1.736158 m on the white source, a ratio of 0.851994. This scales the authored
half-stride to 0.170399 m, swing lift to 0.076679 m, and pelvis bob to
0.005112 m. The 1.12-second four-beat cycle uses 65% stance and preserves the
standing body shape. The solve caps fore scapular correction at 10° and other
limb corrections at 25°. A second pass, `add-bay-tail.py`, appends 2.6°
native tail-base sway and 0.8° pitch; it leaves all existing leg and body
track accessors intact. Fifty-one original groom-detail joints also receive
small periodic motion.

First regenerate the full-joint Bay input using [the Bay fitting proof](../bay-native-proof/README.md) if `output/native-bay-proof/native-bay-fulljoint.glb` is absent. Then rebuild in this order from the worktree root:

```sh
python3 review/native-bay-walk/prepare.py
python3 review/native-bay-walk/bake-bay-walk.py
python3 review/native-bay-walk/add-bay-tail.py
node output/native-bay-preparation/qa-walk.cjs
```

The final private GLB SHA-256 is
`3e99bd37ea0d11ce5c51db0109a6af17a7575330a24e71410131f421115b56c5`.
The build report confirms its original node, mesh, skin, material, image,
texture, and scene records match the static target, and the original binary
buffer is an exact prefix of the animated file. The file adds one clip named
`Target Native Walk`; it does not replace the Bay skin or binds.

## Contact and posture checks

Chromium replayed 128 and 256 evenly spaced phases, checking every original
sole-patch vertex through skinning against the fixed Bay floor. At 256 phases,
each hoof has 167 stance samples. Bounds below are the lowest and highest
skinned sole vertices across those stance samples; 0 mm is the floor.

| Hoof | Stance sole range | Outside ±10 mm |
| --- | ---: | ---: |
| Hind left | −0.42 to +6.63 mm | 0 |
| Front left | +0.21 to +6.51 mm | 0 |
| Hind right | −1.04 to +6.00 mm | 0 |
| Front right | −0.45 to +7.68 mm | 0 |

The 128-phase run gives the same verdict. All tested transforms are finite,
the 0→1 loop seam matches exactly, the browser raised no errors, and all four
feet pass the provisional ±10 mm stance threshold. Vertex 1998 ranges
1.472–1.489 m over the cycle, close to the 1.479 m standing position. The
head joint moves vertically about 3.3 cm; neck and spine move about 1.8 and
1.6 cm. Native hair-detail rotations and tail-base rotation vary through the
cycle. This answers the earlier *numerically static* head/neck/tail concern,
although their visible motion still needs aesthetic evaluation at playback.

The offline 128-frame authoring grid **does not pass its stricter angle-bound
gate**: bound hits occur on 7 hind-left, 23 front-left, 5 hind-right, and 45
front-right frames; 20 of those are stance frames. Contact remains within the
range above, but repeated limiting, especially at the front right, may explain
the mechanical poses. Do not treat the contact pass as proof of anatomical
quality.

## Visual notes and release blockers

In the sixteen sampled side/quarter stills, the Bay remains upright and the
Western tack stays attached. Hooves visibly alternate support and swing;
some airborne hooves are expected because they are in swing. The near forelegs
overlap in profile, and several fore/hind poses look straight or mechanically
bent. The dark coat hides their silhouettes. The head/neck motion is modest,
and the fine strand mane is hard to read at this scale. The tail moves, but
its long strands and tack still need live review. The horse's bright eye,
broad neck, narrow forelegs, and bulky saddle are inherited mesh-level
limitations. Check the model at 1× playback before approving any visual claim.

Before roster integration: visually refine the angle-limited limb poses and
toe/heel sole roll, have the user assess the Bay beside the preferred white
horse, author and review faster gaits with more leg/body/hair response, check
rider/tack fit and four-horse frame time, and confirm the model's **CC BY-NC
4.0** restriction fits the game's intended use. No production file or site
was changed by this pilot.

This folder preserves the method, summaries, and two representative captures. The full candidate, raw pose reports, and complete interactive viewers remain in ignored `output/native-bay-preparation/`; nothing here activates a roster horse.

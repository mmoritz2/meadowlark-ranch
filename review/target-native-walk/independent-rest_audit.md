# Native target rest-rig audit

Original unchanged white Western GLB: `assets/models/horse-imports/wildmesh-white-western/game/native-candidate/native-white-western-candidate.glb`. This is a rest-rig diagnosis, not approval of the pending authored Walk.

Detailed world transforms, local axes, segment lengths, native body sole masks, skin weights, and mesh bounds are in `rig-rest.json`.

## Actual limb dimensions and constraints

The source GLB is +Y up, +Z forward. Anatomical `_l` limbs have positive X and `_r` limbs negative X. The fixed default-rest body floor is **Y −0.004714777 m**. Other skinned meshes are above that floor.

| Chain | Native segments to pastern (m) | Total (m) | Rest root–pastern distance (m) | Unconstrained flat-floor Z shift from rest (m) |
|---|---|---:|---:|---|
| Fore left | upperarm→lowerarm 0.327713; lowerarm→hand 0.448221; hand→fingers01 0.364194 | 1.140128 | 1.110676 | −0.146 to +0.454 |
| Fore right | 0.327713; 0.448226; 0.364194 | 1.140133 | 1.116122 | −0.0856 to +0.633 |
| Hind left | upperleg→lowerleg 0.440363; lowerleg→foot 0.385519; foot→toes01 0.430995 | 1.256877 | 1.181873 | −0.312 to +0.586 |
| Hind right | 0.440363; 0.385519; 0.430996 | 1.256878 | 1.191115 | −0.448 to +0.359 |

These are geometric upper limits with fixed root and retained original world pastern orientation. The reachable sphere uses the sum of segment lengths and the original vertical/lateral root-to-pastern separation. Anatomical limits and a 25° correction limit shrink them further. They are not blanket approvals of all points inside the sphere.

The fore three-joint chain is nearly straight in the default pose; the right fore hoof starts farther behind its shoulder than the left. A symmetric ±0.20 m stride about the original rest sole fails at the rear end of the right fore stance and partly at the left. Retaining the old source's much larger z excursions made this worse. A ground clamp alone cannot solve an unreachable endpoint; it produces residual contact errors, limit saturation, or a forced crouch.

The native fore `clavicle_[l/r]` is a real useful fourth pivot above `upperarm`, with a **0.37330 m** segment to the upperarm shoulder. Include small controlled clavicle/scapular motion for a longer fore stance, or constrain the rearward fore excursion to ≤0.08 m for an initial proof. Do not lower the whole trunk just to force the fore endpoint to the floor.

The hind three-joint locus can geometrically support ±0.20 m, although knee/stifle and hock fold direction still need visual checks. The native fore pastern chain is `hand → fingers01 → fingers02`; the last segment is 0.121803 m. The hind pastern chain is `foot → toes01 → toes02`; the last segment is 0.107605 m. Sole skin is dominated by fingers02/toes02, with smaller fingers01/toes01 weighting. Native helper slider joints have small hind sole weights; preserving the rig keeps them available.

Most major leg pivots have their local −Z nearly aligned with world +X. A solver that converts world X rotations through each current parent orientation respects native roll. Rotating arbitrary local X as a knee axis would be wrong here.

## Floor and native sole masks

To isolate each rest hoof in the body mesh (16,159 vertices), find the closest fingers02/toes02 marker in rest X/Z, then retain body vertices within 0.115 m of the global rest floor. That broad mask contains only the native distal hoof/pastern weighting. A stricter contact mask can retain the lowest vertices within 7 mm of each hoof's own rest minimum; do not reselect animated vertices by height each frame.

| Hoof | Broad native hoof vertex count | Rest minimum Y (m) | Difference above fixed floor |
|---|---:|---:|---:|
| FL | 316 | −0.000964 | 3.75 mm |
| FR | 317 | −0.002677 | 2.04 mm |
| HL | 257 | −0.004715 | 0 mm |
| HR | 278 | −0.004223 | 0.49 mm |

Most fore sole weight is `fingers02` (~285 accumulated weights) and `fingers01` (~31–32). Hind sole is mostly `toes02` (~241–260), then `toes01` (~15–18). This supports toe/pastern orientation control but also means the actual skinned sole—not a bare bone origin—must define contact.

## Body markers

Vertex **1931 is a neck-crest marker**, default world `[−0.0148, 1.8478, 2.1729]`. It is weighted 40.0% neck01, 32.9% neck02, 16.1% neck03, and 11.0% spine04. Its vertical movement must not be reported as anatomical withers height.

Vertex **1998 is an upper-trunk marker**, default world `[−0.0162, 1.7362, 1.9760]`, weighted 76.1% spine04, 12.2% chest helper, 6.3% spine03, and 5.5% neck helper. It is useful for detecting trunk sink, but has not been independently identified as the exact anatomical withers either. Track spine/pelvis world movement and this fixed trunk vertex alongside whole-body screenshots.

## Planned Walk timing critique

The proposed stance starts **LH 0.00 → LF 0.25 → RH 0.50 → RF 0.75** form a valid evenly spaced lateral four-beat walking order. A 65% stance fraction gives overlapping support appropriate for a walk. Native labels agree with that ordering.

A symmetric 0.40 m rearward sole travel over 65% of a 1.12 s loop implies approximately **0.55 m/s** stance backflow in raw source units. A game moving at another speed or scale will visibly slide. Reduce stride or match actor translation after the static private contact test passes. A slow proof can use a shorter fore stride while testing scapular participation, but unequal effective fore/hind backflow would then need correction before game use.

Release check pending: full-cycle four soles during the exact authored stance windows; side and quarter knee/hock/pastern shapes; floor and trunk height; torso/head responsiveness; attached Western tack and groom. No production edits or source downloads.

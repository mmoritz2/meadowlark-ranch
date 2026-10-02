# Existing breed body collected Gallop audit

The approved native collected Gallop reference is `e4b79a8449ac2dc9b4e2673ba40f066ed35640bcd14f4de88c674fb17d5f00a9`. Each original Artist40 body receives a target-specific motion-only Left and Right clip; its mesh, rest hierarchy, proportions and inverse binds remain untouched. This audit covers authored geometry and ordinary playback on a fixed floor. Final game transitions, travel, terrain and mounted controls are separate checks.

Left Gallop is complete: all 25 bodies passed 129 actual GLTF/skinned phases, nonempty validated whole-hoof/sole/toe/heel masks, all 40 finite joints, nine full-body samples, endpoint checks and at least two ordinary 60 fps playback wraps. Every original body and motion response matched its disk SHA. Whole-hoof floor margin was at least +0.99384 mm, and the full-body sample minimum was +0.99453 mm. Page errors: zero.

Right Gallop is complete: all 25 bodies passed the same actual skin, finite, response-pin and normal-playback checks. Whole-hoof floor margin was at least +0.99432 mm, and full-body sample minimum was +0.99547 mm. Both independent 129-phase target-hierarchy pole audits found no opposite-rest-bend fore elbows across any of the 50 body/lead cases. All build reports pin the same approved source SHA. The combined result is in `gallop-browser-summary.json`.

The Left independent float32 curve audit confirms all original body SHA values still match the builder inputs. Maximum authored step is 5.1168° per 5.078 ms, Chestnut FL cannon (~1007.6°/s). The maximum un-copied pose closure is 0.0000101°, and the loop first/last secant velocity mismatch is 108.9°/s. The retarget clips use LINEAR interpolation; the native reference's cubic continuity does not imply C1 continuity for these sampled outputs. Brisk recovery remains a limit. Maximum Left IK correction is 15.32° and keyed contact residual is 0.00622 mm. Right maximum step is 6.6287° per 5.078 ms, Clyde HL cannon (~1305.4°/s); un-copied closure is at most 0.0001645°, and its worst loop secant mismatch is 113.7°/s. Right maximum correction is 15.02° and keyed stance residual is 0.00577 mm. No C1 claim is made for either sampled LINEAR output.

Welsh, Shire, Sunset Arabian and Friesian side/quarter views show a connected lowered neck, folded forelegs and backward hoof tuck, retaining their original body appearance. The sampled views show no gross collapse, opposite-bend elbow or visible tearing. Actual mixer-advanced normal-speed WebPs and cycle sheets are saved for Welsh and Shire. This is a collected Gallop appearance, with source nominal speed 3.5 m/s scaled by each body ratio; it is not an extended racing Gallop or a new source677 groom system.

The raw-clip fixture starts from the public Trot view, then plays the generated Gallop through a separate Three mixer. The public dropdown consequently stays on Trot in the captures. Filenames, sheet labels and response pins identify the actual Gallop input. No request routing was used.

## Reproduce

With the local server running, from the repository root:

```sh
NODE_PATH=/path/to/node_modules QA_PORT=8584 QA_GAITS=gallop-left QA_OUTPUT_PREFIX=gallop-left node review/native-complete-gaits/roster/qa-other-gaits.cjs
NODE_PATH=/path/to/node_modules QA_PORT=8584 QA_GAITS=gallop-right QA_OUTPUT_PREFIX=gallop-right node review/native-complete-gaits/roster/qa-other-gaits.cjs
OPENBLAS_NUM_THREADS=1 QA_CURVE_PREFIX=gallop-left python3 review/native-complete-gaits/roster/audit-curves.py gallop-left
OPENBLAS_NUM_THREADS=1 QA_CURVE_PREFIX=gallop-right python3 review/native-complete-gaits/roster/audit-curves.py gallop-right
```

The browser runner waits for each body/clip JSON to exist, permitting QA to overlap the build. It records output hashes and does not modify the source models. Reports are `gallop-{left,right}-browser-{batch,summary}.json` and `gallop-{left,right}-curve-batch.json`.

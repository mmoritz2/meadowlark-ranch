# Mounted production Gallop check

Passed the actual unrouted Ranch on port 8584 using its keyboard controls and temporary browser saves. All five selected mounts reached Walk, Trot, Canter and Gallop with finite bone transforms and no browser errors.

| Mount | Jump peak | End height |
|---|---:|---:|
| white-western | 0.785 m | 0.000 m |
| bay | 0.627 m | 0.000 m |
| welsh | 0.485 m | 0.000 m |
| shire | 0.745 m | 0.000 m |

Pegasus retained its flight toggle. The other four mounts completed the one-shot jump and returned to stand on the ground.

The main report is `../production-gallop-ranch-report.json`, produced by `tools/qa-complete-gaits-ranch.cjs` with the five-mount filter. This confirms runtime controls, animation selection, finite poses, takeoff and recovery. It does not add a new all-terrain contact or numerical artist-rider boot fitting claim.

The separate `qa-mounted-gallop-captures.cjs` captures White and Welsh from side and quarter views at the same Gallop phase. Other pasture horses are hidden only for the screenshot renders to keep the mounted subject visible; the actual source model, rider, tack, runtime and save persistence are unchanged. An event/NPC horse remains in part of the foreground, so these captures provide game context rather than unobstructed anatomical close-ups. Capture state and actual response hashes are in `mounted-gallop-captures-report.json`.

No production files or animation sources were changed by this check.

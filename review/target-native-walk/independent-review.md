# Independent authored native Walk review

**A useful narrow slow-Walk contact milestone, not approval for all gaits or the full horse roster.** The realistic white Western horse retains its upright original standing body, native 677-joint rig, groom, and tack. Four-beat stepping is visible. The source Walk's severe low trunk posture is absent from the reviewed side/quarter poses.

Final candidate SHA-256: `dcec158d30a7bab814b4aaaeeb07dff95fc54d4dbe71db704858928fe2c904ec`. Contact-audited input SHA-256: `fbca0c840e48abebcd328fd57eeafc49f3b33c1489f78d5fad224ac6646fbb0f`, preserved locally as `contact-audited-input.glb`. The final tail-only addition preserves all 81 previous authored animation tracks and every previous binary byte exactly; it adds only the native tail01 rotation channel. `tail-track-identity.json` records the independent comparison, so the completed contact/body samples still apply.

## Independent browser check

`viewer.html` loads the candidate independently of the author's viewer. `qa.cjs` scans **256 phases**, including the halfway interpolation phases of the authored 128-frame grid, and captures eight side and eight quarter poses. **Zero browser errors.** Raw samples: `browser-report.json`; summary: `summary.json`. The earlier 8° scapular-limit attempt is preserved in `initial-8degree/` and is not the final contact result.

The floor is fixed to the unchanged default native skinned body rest minimum, **Y −0.004714777 m**. No animated re-grounding or per-phase sole selection occurs. Native fixed distal hoof groups are first classified by rest X/Z proximity to their fingers02/toes02 marker and rest Y ≤ global floor +0.115 m. Each strict contact mask then retains vertices within **7 mm of that hoof's own rest minimum**. Strict mask counts: FL115, FR104, HL74, HR65. Exact IDs are in `browser-report.json → structure.footVertices` and `rig-rest.json` records the broader native groups and weights.

Authored stance masks, not source near-ground guesses, define contact: LH begins phase 0; LF 0.25; RH 0.5; RF 0.75. Each stance lasts 65% of the 1.12 s cycle. This is a valid lateral four-beat walk with overlapping support.

### All four stance soles

Ranges include every strict sole vertex across the explicit stance samples. Each limb has 167 of 256 sampled phases in stance.

| Hoof | Lowest stance sole vertex | Highest stance sole vertex |
|---|---:|---:|
| FL | −0.14 mm | +6.71 mm |
| FR | −0.77 mm | +6.83 mm |
| HL | −0.60 mm | +6.44 mm |
| HR | −1.23 mm | +5.66 mm |

All stance vertices remain within ±10 mm of the fixed rest floor, including interpolated phases. Swing sole upper points reach roughly 96 mm, consistent with the authored 90 mm lift plus the finite sole thickness. The first/last body/head quaternions close continuously.

This contact success followed adding the native clavicle/scapular pivot to each fore chain. With the original rigid shoulder, especially FR's nearly extended native foreleg, the requested symmetric stride was outside the reachable floor locus. `REST_AUDIT.md` explains actual segment lengths, axes, asymmetry, and why the earlier source-trajectory three-joint solve failed.

## Motion and appearance

- The body stays upright in side and quarter captures. Upper-trunk marker 1998 moves **19.4 mm vertically** through the cycle; pelvis vertical excursion is 12 mm. Head pivot moves **41.5 mm vertically** and roughly32 mm fore/aft; neck-crest marker 1931 moves 20.4 mm vertically. Movement exists, but it remains restrained at this slow speed.
- Marker1931 is mostly neck skin and must never be called anatomical withers. Marker1998 is mostly spine04, useful as a fixed upper-trunk marker, but is not certified as exact anatomical withers either.
- No gross inverted carpus/hock or severely folded limb is visible in the 16 captured poses. Fore swing remains fairly straight and low. The pastern world orientation is retained across the cycle, so the proof omits toe rollover at lift-off and a freely hanging/rotating hoof during swing. These are limitations of its current realism, even though its sole height passes.
- Western saddle, breastplate, reins, and stirrups stay attached in the sampled views. Rider fit and game interactions are untested.
- 51 original strongly weighted groom detail controls receive periodic motion. Mane/tail detail movement is present but restrained for a slow Walk. The final addition gives the main tail base a phase-lagged 2.6° yaw and 0.8° pitch, while retaining downstream native rest rotations. Four final phases from side and quarter views were checked with zero errors (`tail-browser-report.json`, `final-tail-*.png`); the sway remains modest and does not swing into the tack or legs in these poses.

## Limits that remain

The author respects the chosen 10° fore scapular and 25° other joint correction bounds, but some phases touch them: FL 25/128 authored frames, FR 45/128, HL 7/128, HR 0/128. Consequently its strict `authoredGridPass` flag remains false under the extra “no bound touch” condition. Numerical contact accuracy does not prove adequate anatomical range margin.

±0.20m stance travel over 65% of 1.12 s implies approximately **0.55 m/s** actor translation in raw model units. The viewer is in-place; matching game speed/scale and proving foot placement during actual travel remain untested. There is no authored Trot, Canter, Gallop, Jump, transition set, rider pass, or per-breed conformation proof in this milestone.

Final scope: one private realistic-white-horse slow-Walk proof. No shared/production files or source downloads were changed by this auditor.

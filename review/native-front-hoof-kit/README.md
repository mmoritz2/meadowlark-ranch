# Front hoof articulation

White Western, Bay Western and Bay Sporthorse now fold the front pastern and hoof during the lifted part of Walk, Trot and both Canter leads. The same original 677-joint meshes, skins, textures, body/head motion and Western tack remain in use. [Compare the animation](review.html), including the original published versions, at the same stride phase.

Each authored gait adds up to 12 degrees at each front fingers01 joint and 6 degrees at fingers02. This is an animation choice, not a measured physiological range. The Walk fold peaks around limb phase 0.811; the delayed ordering is informed by [Hodson, Clayton and Lanovaz's walking kinematics study](https://beva.onlinelibrary.wiley.com/doi/abs/10.2746/042516400777032237). Faster-gait amplitudes and timing are authored choices. Original Canter lead differences remain.

The model also contains four small original-distal companion clips. The main game mixer plays the original distal curves alongside the unchanged remaining animation. [The hoof layer](../../assets/native-hoof-flex.mjs) samples the authored folded curves at the same active-action times and weights. It adds only four local quaternion changes, easing in as the original hoof rises from 12 to 35 mm above its canonical floor. Each horse has separately measured bone-local hulls of its rigid hoof vertices. The layer does not advance a second mixer, move joints or lift the horse.

The direct folded-only crossfade was rejected because it added up to 11.35 mm of penetration in a stop/start transition. [That failure](rejected-fold-only-transition-qa.json) remains recorded. The gated version preserves the baseline contact trajectory in the tested transitions. A safety fallback restores only the source distal pose for an untested clearance failure; no fallback occurred in the release checks.

Validation:

- [390 transitions at 30/60 fps](transition-qa.json), 7,410 paired frames across all three horses: phase and protected torso/head/saddle matrices unchanged, maximum added penetration 1.17 nm from numerical roundoff, full authored fold present, fallback count zero. The helper's measured desktop p95 was 0.10 ms; no mobile performance claim.
- [Actual mounted Ranch](mounted-qa.json): 192 gait samples, 213 complete skin comparisons, start/stop/steering, finite joints, existing hair restoration unchanged, boot contact residual at most 3.67 micrometres, rein endpoints unchanged, all checks passed.
- [Independent lifecycle](layer-lifecycle.json), [rigid-hull verification](rigid-hoof-hull-verification.json), [five-model game integration](game-integration-qa.json) and [before/after preview](preview-qa.json) passed.
- Per-model build, source-preservation and steady-gait records are in [White](white/README.md), [Bay](bay/README.md) and [Sporthorse](sporthorse/README.md). Original linear fast-gait curves remain linear; this does not certify the entire gait as C1.

The original WildMesh model credit and CC BY-NC 4.0 terms remain in the native profiles and per-model documentation. No new source was downloaded.

This is a distal motion improvement. The short stride, existing gait-transition floor dips (down to roughly 16 mm in the tested baseline), remaining breed replacements and other naturalism work remain unresolved. Publication and exact live byte checks are recorded in release-verification.json after deployment.

To repeat the checks, serve the repository and use QA_PORT or QA_URL, with the project's Playwright runtime available. The root scripts check transitions, the mounted game and the comparison preview. [Runtime hashes](runtime-hashes.json) pin the tested implementation.

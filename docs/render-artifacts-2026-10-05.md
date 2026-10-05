# Black rectangles and environment polish — 5 October 2026

The intermittent black rectangles came from non-finite tree lighting, amplified by bloom. They were reproducible with a stationary camera; the camera-obstruction changes alone could not address this fault.

## Reproduction and diagnosis

Use `tools/qa-render-artifacts.cjs` against a local preview. The original failing frame used seed 928471, a 988 × 859 viewport at DPR 2, High quality, camera position `[-28,5,-52]`, and target `[-90,25,-260]`. The graphics budget produces a 1377 × 1197 framebuffer.

On native Metal, four invalid pixels appeared immediately after RenderPass. Pixel raycasts identified the broadleaf scanned-tree impostor. Bloom expanded those pixels to 1,290,816 invalid pixels, producing the large stepped black rectangles.

The normal atlas is linearly filtered. At some leaf boundaries its decoded vector cancels to zero, so unconditionally normalizing it produces undefined lighting. `tree-impostors.js` now checks the squared vector length and uses an upward canopy normal for degenerate samples. With this change alone, the same scene rendered with zero invalid pixels before or after the original bloom pass.

A separate `render-safety.js` guard rejects non-finite or overflowing HDR samples before bloom's bright-area extraction. This contains future bad source pixels instead of spreading them through every blur level; it does not replace fixing the faulty source material.

## Visual changes

- Post-tone-mapping FXAA smooths fine foliage and grass edges. Existing MSAA, depth shading and reflection settings remain active. The vendored FXAAShader comes from the official Three.js r160 source, matching this project's Three.js version and MIT license.
- Clear-weather clouds have more blue gaps, transitioning to thicker overcast in rain.
- 216 scanned gazania plants form small drifts around ranch and trail approaches. They reuse the existing licensed builder model, use four of its smaller mesh variants, are instanced and distance-culled, and avoid paths, courses, arena, water and building slots.

## Verification

`tools/qa-render-artifacts.cjs` reads the scene **before bloom**, both composer buffers, and synthetic GPU fixtures. It covers the failing camera, adjacent directions, all three quality levels, golden hour, night, rain, a close trail view and portrait resizing. It also renders an exact zero-length decoded normal and injects NaN/infinity into an HDR target to confirm bloom contains the damage without removing ordinary light.

All 14 regression checks passed on native Metal, including zero invalid world pixels, correct FXAA resizing, no asset/browser/feature errors, and plant clearance. A deliberately malformed input retained its two local invalid pixels while all eleven bloom intermediate targets stayed finite.

This fixes a reproduced rendering defect and improves specific parts of the environment. It is not a claim of AAA quality, universal device coverage, or that every remaining visual defect is solved.

The existing `tools/qa-world-finish.cjs` also passed all 28 checks for contact shading, water reflections, scanned scenery, quality budgets and resizing. Its native-Metal 900 × 650 preview measured 28.7 ms median and 31.3 ms p95 frame time in that test scene; this is a desktop observation, not a mobile performance guarantee. `tools/test-render-budget.mjs`, JavaScript syntax checks and `git diff --check` passed.

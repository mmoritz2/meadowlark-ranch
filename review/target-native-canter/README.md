# Private two-lead Canter evidence

This folder preserves the native white Western horse's slow, short-stride Canter pilot and its independent audit. It passes as a limited private motion study. It does not establish final naturalism, measured collected/working Canter, other breeds, faster gaits, transitions or rider fit.

Open [the audit viewer](audit-viewer.html) through a local repository server. It reads [the combined native-horse kit](../native-horse-kit/model.glb) and exposes the unchanged clips `Target Native Canter Left` and `Target Native Canter Right`. The original independently scanned Canter GLB had SHA-256 `81039eb4d4c2e75ae992b78b4e6382d41bd7b302c5c4fdce75388a71901045d2`. The combined kit's [preservation report](../native-horse-kit/preservation.json) confirms the original model data and both 82-channel Canter curves match that candidate; its whole-file hash differs because it also contains the Walk and Trot studies. Preserved numeric snapshots below refer to the original Canter file, not a second scan of the kit.

The pilot uses a 0.64-second period, 0.40 stance duty and a 0.50-meter stance stroke, implying 1.953125 m/s travel. Left touchdown order is RH → LH+FR → FL; right is LH → RH+FL → FR, followed by explicit suspension. Runtime travel must match that nominal speed. Native asymmetric rest centers remain; long scapular bound plateaus, brief leading carpal/hock plateaus and conspicuous periodic head motion remain disclosed.

The saved evidence is compact:

- [Author review](REVIEW.md), build metadata, native joint reference, preservation checks, per-joint cap report and own QA summary.
- [Independent review](independent-REVIEW.md) and [primary-source basis](independent-PRE_BAKE.md), one 256-phase summary per lead, regional travel/body/cap/loop metrics and the original QA provenance summary.
- One 16-pose side GIF per lead and two selected stills: left quarter at phase .250 and right side at .938. GIFs replay sampled poses at the authored period; they are not high-frame-rate recordings.
- Reusable independent viewer, fixed rig-rest masks, groom reference, scan, summary and metrics helpers. Raw phase scans, solve dumps, GLBs and redundant captures stay in ignored `output/`.

## Regeneration

Run from the repository root. The original registered native asset must exist at `assets/models/horse-imports/wildmesh-white-western/game/native-candidate/native-white-western-candidate.glb`; its existing attribution and license continue to apply. The builder requires Python 3, NumPy, SciPy, `tools/asset-gen/rig_hero_horse.py` and the sibling `native-walk-joint-reference.json`.

```sh
python3 review/target-native-canter/build.py
```

The saved solver writes `output/target-native-canter/target-native-canter.glb` and a full ignored `build-report.json`. It does not write the tracked review folder or update the combined kit. The saved compact report omits `leads.Left.frames` and `leads.Right.frames` only; fixed foot masks, timing, bounds, standing probe and fit summaries remain intact. Rebuild the combined kit separately using its documented process when deliberately changing any motion.

The scan helper requires the repository's `tools/qa-platform.cjs`, its Playwright/Chromium runtime and a local repository HTTP server. `QA_PORT` selects the server port. If Playwright is globally installed, set `NODE_PATH` to its global module directory, or use `PLAYWRIGHT_PATH` as supported by the QA helper. A smoke check selects both leads and reports readiness/provenance without repeating the phase audit:

```sh
QA_PORT=8577 node review/target-native-canter/audit-qa.cjs --smoke
```

A deliberate full rerun samples 256 phases per lead into ignored `output/target-native-canter-audit/`. It validates the current combined-kit hash against its preservation report and requires both Canter curves to match the independently audited source. The metrics helper also requires the builder's full ignored report for individual bound phases:

```sh
QA_PORT=8577 node review/target-native-canter/audit-qa.cjs
python3 review/target-native-canter/audit-summarize.py left
python3 review/target-native-canter/audit-summarize.py right
python3 review/target-native-canter/audit-metrics.py
```

These commands write ignored output only. Copy reviewed results into this folder deliberately; they do not overwrite the preserved original audit snapshots.

The preserved viewer smoke check passed for both leads with zero browser errors on combined-kit SHA-256 `49ade015b21fa531be05bc92ed042ec0dc4c2f96aabfc40b48f1fe280f292206`; the floor remained −0.004714777107501428 m. The original 512-phase audit was not repeated because both Canter curves and source data were verified unchanged.

# Independent Bay review method

The preserved result is one 256-phase scan of frozen candidate SHA-256 `8f622bf3b22244ba1b6a39c72e3cb1ce6f2e378bb7eb731a22caba33b2459814`, from unchanged static Bay rest source `6110fb3bcfe6ba6660c9c05d67269bc800d19706fab54db29633003d87f0a6a3`. The tracked `model.glb` is the same candidate; rebasing the viewer does not change or reapprove its curves. No full rescan is required for that byte-identical copy.

Open `audit-viewer.html` from a local repository server. It reads `./model.glb`, fixed independent `rig-rest.json` and depth-two Three.js imports. The original rest floor and anatomical masks stay fixed; explicit HL/FL/HR/FR quarter-cycle starts define stance, rather than current hoof height. Actual travel speed is .4668608843 m/s. The independent report retains the upper-trunk/neck marker caveats, cap plateaus, brisk unfolding and existing Bay art limits.

The independent files are `independent-REVIEW.md`, `independent-summary.json`, `independent-motion-metrics.json`, `independent-preservation-checks.json`, one sampled side GIF, the audit viewer/scripts and rig-rest/groom references. Raw scans, full solve dumps, redundant stills and additional previews remain in ignored `output/native-bay-rollover-audit/`. The saved side GIF replays 16 poses in 1.12 seconds and does not establish high-frame-rate acceleration quality.

Run helpers from the repository root. Python helpers need NumPy and `tools/asset-gen/rig_hero_horse.py`; browser checks need `tools/qa-platform.cjs`, Playwright/Chromium and a local repository HTTP server. Set `QA_PORT` or `QA_URL`, plus `NODE_PATH`/`PLAYWRIGHT_PATH` if the browser package is globally installed.

```sh
QA_PORT=8577 node review/native-bay-rollover/audit-qa.cjs --smoke
```

The smoke check confirms the correct clip, all 677 finite native bone transforms, complete body bounds and zero browser errors without repeating the scan. A deliberate regeneration uses:

```sh
python3 review/native-bay-rollover/audit-derive-rest.py
QA_PORT=8577 node review/native-bay-rollover/audit-qa.cjs
python3 review/native-bay-rollover/audit-summarize.py
python3 review/native-bay-rollover/audit-metrics.py
```

All generated files go to ignored output. The rest helper can evaluate the frozen tracked model's default rest because its original source nodes, skin, geometry and binary prefix were verified unchanged; it keeps the original static-source hash in provenance. The metrics helper additionally needs the author's full regenerated `output/native-bay-rollover/build-report.json` for bound-hit phases. These helpers do not replace preserved tracked snapshots automatically.

Preservation smoke passed: correct `Target Native Walk Rollover` clip, all 677 finite bone transforms, fixed original Bay floor and zero browser errors. `independent-smoke-summary.json` records that check; the 256-phase scan was not repeated.

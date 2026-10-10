# Lower draft breastcollar continuity — 2026-10-10

The lower V of the Shire, Percheron and Clydesdale breastcollar disappeared behind the raised foreleg in left gallop at 25%. This revision routes that existing leather slightly higher across the chest. It retains the previous 70% shoulder attachment and adds a bounded standing-space lift of up to 60 mm and 12 mm forward before actor scale. A smooth field fades out before the upper shoulder and saddle anchors. Derivative breeds inherit their foundation fit.

The source body, all 677 bones, native clips, skin influences, UVs, indices, saddle, fenders, stirrups, bridle and reins stay unchanged. The current v5 morph prefix is preserved byte for byte. The newly merged hindquarter refinement is retained, including its protected 13,929-vertex front/lower/upper surface gate. Only sparse collar position and normal attributes change; there is no new animation or per-frame solver.

## Evidence and limits

- `shire-before.jpg` / `shire-after.jpg`, and the matching Percheron/Clyde pairs, show the original gap and the revised front view at left gallop 25%. The before images use the previous v4 body; the final after images use v5. `upstream-v5-compatibility.json` independently verifies the 12,094 front body vertices and all nonbody input geometry are identical between those versions.
- `installed-browser.json` confirms the final **Current build** production path for all three foundations, without candidate injection: exact built SHA, 677 bones, finite pose/groom and no browser errors.
- `production-preview-browser.json` records the exact v5 preview SHA, native phase, 677-bone model and finite groom state for each final after image.
- `runtime-validation.json` compares two independent instances of the actual current production loader before installation: 280 poses per foundation, 840 total. It checks every protected animated vertex, original clips/binds, seam and endpoint diagnostics, native groom controls, actual classic Western tack, bareback/wild visibility and private geometry cleanup.
- `built-byte-validation.json` confirms all three installed buffers exactly match their reviewed previews and retain the v5 prefixes; all 22 other breed records/buffers are unchanged. The standalone generator reproduces the three complete authoring NPZs byte for byte. `inherited-thigh-validation.json` retains the actual-gait source-relative thigh checks.
- `validator-tests.json` exercises accepted routes and corrupted fields, inverse solves, normals, masks, influences and protected tack IDs. `provenance.json` pins the source, native motion, prior attachment, v5 morph prefix, authoring NPZ and preview bytes.
- `shire-gallop-left55-candidate.jpg`, `shire-gallop-left55-quarter-candidate.jpg`, `shire-gallop-right45-candidate.jpg` and `shire-trot56-candidate.jpg` are additional historical v4-front visual checks of the candidate. Their front geometry is unchanged in v5.

The main V is visibly continuous at the reviewed break and additional extreme poses. Minor lower-center tie clipping and local hardware/trim stretching remain. Numerical nearest-triangle signed distances are diagnostics, not penetration-depth measurements: a raised foreleg can replace the chest as the nearest triangle. This is a bounded continuity improvement, not a claim of zero intersection or stretch.

## Reproduce and validate

The three authoring snapshots and the original 514-vertex shoulder basis live in `tools/native-roster/collar-attachments/`. The generator uses the pinned v5 morph prefix and source/motion assets; it writes to a chosen output directory and never edits production by itself. Desired standing positions and inverse-transpose normals are stored separately from their inverse-solved runtime values. The independent validator rederives the bounded field and checks those targets with a 20-micrometre tolerance.

```sh
python3 tools/native-roster/author-lower-route.py --out /tmp/collar-authoring
python3 tools/test-native-collar-route.py
node tools/test-native-collar-attachment.mjs
python3 tools/native-roster/build.py --only percheron,shire,clyde --geometry-only
python3 tools/native-roster/validate.py
node tools/test-native-draft-thigh-deformation.mjs
python3 review/draft-collar-route/check-v5-compatibility.py
```

For a **new candidate**, pack and run the comparison before installing it, while the currently released attachment is still the reference:

```sh
python3 review/draft-front-check/pack_attachment.py /tmp/collar-authoring/shire.npz --breed shire
python3 review/draft-front-check/pack_attachment.py /tmp/collar-authoring/percheron.npz --breed percheron
python3 review/draft-front-check/pack_attachment.py /tmp/collar-authoring/clyde.npz --breed clyde
node tools/qa-native-collar-candidate.mjs review/draft-front-check/attachment-preview shire,percheron,clyde
```

The candidate metadata must identify the exact current full production SHA, including its attachment. Prefix equality alone does not identify the reference. Comparing an already installed candidate to itself is a loader smoke test, not before/after evidence. Rendered front and quarter views remain required; the headless comparison does not assert visibility.

See [the original shoulder attachment review](../draft-front-check/README.md) for the earlier fit and its retained limitations.

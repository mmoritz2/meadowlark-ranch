# Draft front and collar review — 2026-10-10

Shire, Percheron and Clydesdale breastcollars lost visible sections inside the shoulders during trot/canter. Moving the standing strap outward did not solve the different body/tack deformation. The released improvement uses a fitted four-influence shoulder attachment at 70% strength on 514 existing vertices per draft foundation. Derivatives inherit the same foundation attachment.

The original 728256-byte morph prefix is preserved exactly. Body shape, skeleton, animations, UVs, indices, center tie, metal ring 224, saddle endpoints, fenders, stirrup treads, bridle and reins keep their data. Standing collar surface and normal direction are preserved; each prepared breed receives private geometry before instantiation. The change adds 25700 bytes per draft and no per-frame solver.

## Evidence

- `shire-before.jpg` / `shire-after.jpg`: same front-quarter trot 25% pose, clay body with natural leather. The shoulder strap stays visibly continuous in the updated view.
- `front-review.json`: earlier baseline front inspection.
- `production-browser.json`: final three foundations loaded through the production decoder;514-vertex attachment marker,677 bones, finite native pose and no page errors. Both front quarters, standing, trot, canter, gallop and jump were also visually inspected during selection.
- `runtime-validation.json`:48 poses per foundation through the actual native motion controller. Every unselected animated vertex has zero difference; standing collar error is below 0.00025 mm. Groom controls, source tack partitions, bareback/wild mode and disposal retain their behavior.
- `offline-validation.json`:64 encoded native poses plus 97 held-out gallop poses per foundation. Main-leather negative samples roughly halve, without seam growth or saddle endpoint drift.
- `attachment-provenance.json`: source, motion, base morph and authoring hashes; standing normals, endpoint and influence checks.

The actual production loader also passes `qa-tack-native.mjs --optional --horses=shire,percheron,clyde`, including new/classic/mixed collection tack and support contacts. The independent roster validator passes all 25 foundations, and the existing head-shape gate passes all 10 reviewed heads.

## Limits

This improves visible shoulder-strap continuity; it does not eliminate all penetration. On the held-out gallop samples the worst signed inner-face overlap increases from 20.0→25.4 mm for Shire,18.9→23.8 mm for Percheron and 19.0→21.3 mm for Clydesdale, while the number of overlapping samples roughly halves. Lower-anchor clipping and some small strap/ornament stretching remain. The 70% blend was chosen because it retained the visible front improvement with substantially less stretching than a full attachment. Numerical contact measurements include inner leather faces and are not a substitute for rendered inspection.

## Repeat the checks

Run from the repository with the existing Python/Node dependencies:

```sh
python 3 tools/native-roster/build.py --only percheron,shire,clyde --geometry-only
python 3 tools/native-roster/validate.py
python 3 tools/native-roster/qa-head-shapes.py
node tools/test-native-collar-attachment.mjs
node tools/qa-tack-native.mjs --optional --horses=shire,percheron,clyde
python 3 review/draft-front-check/pack_attachment.py tools/native-roster/collar-attachments/shire.npz --breed shire
python 3 review/draft-front-check/pack_attachment.py tools/native-roster/collar-attachments/percheron.npz --breed percheron
python 3 review/draft-front-check/pack_attachment.py tools/native-roster/collar-attachments/clyde.npz --breed clyde
node tools/qa-native-collar-candidate.mjs review/draft-front-check/attachment-preview shire,percheron,clyde
python 3 review/draft-front-check/build.py
python 3 -m http.server 18799 --bind 127.0.0.1
```

Open `http://127.0.0.1:18799/review/draft-front-check/index.html`. Use **Current build** for the installed attachment; **Candidate** is only for a matching pre-attachment baseline. The local fixture fixes production native-controller clip phases, provides contrasting surfaces and emits a visible report. It does not touch game saves or multiplayer. Generated preview binaries and HTML are ignored.

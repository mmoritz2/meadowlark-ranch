# Independent slow-Walk rollover audit

**Verdict: pass as a narrow private white-horse Walk study.** This improves the frozen earlier Walk's straight fore swings and rigid flat-hoof orientation, while keeping its upright body and conservative speed. The side/quarter pose sequence shows recognizable folding/forward recovery, toe rollover, and attached Western tack without gross joint inversion, mesh collapse or body crouching. The fore carpus holds a folded apex for roughly half of swing, then unfolds briskly; that mechanical timing remains a material limit. This is not approval of final naturalism, all breeds, faster gaits or rider fit.

Candidate `../target-native-walk-rollover/target-native-walk-rollover.glb`, SHA256 **73053f039395f3dc5b728ebf8f89b1f9676da018745dca46b1104fc59a5a80b7**. One independent Three.js scan sampled **256 uniform phases**, with **0 browser errors**, 16 phases × side/quarter full-horse captures, and two late-stance closeups for each hoof. An earlier browser startup stopped before phase sampling because the mesh became ready before viewer initialization; the readiness wait was corrected. No candidate changes or repeat phase scan occurred.

`browser-report.json` retains the raw pass; `summary.json` / `motion-metrics.json` retain the calculations. `metrics.py` compares the already captured old Walk, so the baseline was not retested. `cycle-side.gif` and `cycle-quarter.gif` replay the 16 captured poses at the authored 1.12-second period. They are sampled previews, not high-frame-rate motion capture.

## Floor, masks and support

**Floor Y = −0.004714777107501428 m**, from all 16,159 original body-skin vertices in unchanged default rest before animation. It stays fixed; no animated geometry is moved to hide contact errors. Whole-body minima include the complete body and all four hooves. Hair/tack are inspected visually, not included in body extrema.

Broad hoof groups are fixed by nearest native distal marker in rest XZ and rest Y < floor + 0.115 m: FL/FR/HL/HR **316/317/257/278** vertices. Strict sole groups retain vertices within each hoof's own rest minimum + **7 mm**, giving **115/104/74/65** vertices. These strict sets match the author; fixed lower/upper rest-Z quartiles form heel/toe groups (ceil counts **29/26/19/17**), differing by a few tied vertices from the author's quantile groups. Neither floor nor vertex membership follows current height. Skin evaluation uses the native skeleton plus each mesh's world transform.

Stance uses authored masks: **LH 0, LF .25, RH .5, RF .75**, duty **.65**, period **1.12 s**. Every sampled phase has two or three intended stance feet; there is **no flight**. The entire animated body minimum stays **+0.911 to +1.019 mm** over the fixed floor.

| Hoof | Whole-hoof stance minimum above floor | Late heel above grounded toe | New swing geometric flex maximum | Earlier Walk maximum |
|---|---:|---:|---:|---:|
| FL | 0.951–1.124 mm | 7.21–27.91 mm | 54.66° | 16.42° |
| FR | 0.956–1.220 mm | 5.00–26.57 mm | 53.08° | 14.31° |
| HL | 0.926–1.090 mm | 7.70–27.33 mm | 69.16° | 51.46° |
| HR | 0.911–1.169 mm | 5.34–25.01 mm | 71.97° | 61.96° |

Heel strike lifts the toe by ~3–12 mm; late stance lifts the heel while the toe stays near the floor. The closeups show this rollover without forcing the whole sole flat. Fore `hand_*` carpus bends rearward; hind `foot_*` hock bends in the correct opposite sagittal direction. These bone-center geometric angles are not clinical joint ROM.

## Travel, loops and remaining motion limits

The 0.40-m stance backflow over 0.728 s implies **0.549450549 m/s**, about **1.98 km/h**: a deliberately slow walk. Add actor travel `Z += speed × duration × unwrapped limb phase` to each fixed contact-centroid trajectory. Within heel-strike, flat and toe-breakover regimes, maximum XZ range is **0.032 mm**; late toe ranges are **0.015–0.025 mm**. These centroids are contact proxies, not individual physical contact points. Whole-stance heel movement reaches 3.6 mm because the heel legitimately rises and rotates after lift. Runtime speed must match the authored backflow.

Per-joint cap inspection distinguishes **clavicle −10°** hits (FL 34/128, FR 36/128) from **carpus +45°** hits (22/128 on each forelimb, ~192.5 ms). That fore apex is ~49% of the 392-ms swing. Hind hock −35° caps occur 18/128 phases per hind limb. These caps produce a held folded segment followed by faster unfolding; the result is an improvement over the nearly straight earlier swing, but not a claim of finished natural timing. Fore local quaternion steps peak at ~3.96° per 4.375 ms; this is sampling evidence of brisk recovery, not a measured physiological limit.

First/last carpus/hock orientation seams are ≤0.0000025° and hoof centroid seams <0.00003 mm. Pose closure does not establish smooth acceleration. Upper-trunk marker **1998** moves **19.34 mm Y**, head pivot **41.41 mm**, pelvis **12.00 mm**; these are essentially preserved from the earlier Walk. Head relative to trunk moves **27.73 mm**. Body and neck/head respond modestly while maintaining standing height. Marker **1931 is neck crest**, not withers; 1998 is an upper-trunk probe, not a certified withers landmark. Both are copied before any hoof loops.

Mane detail joints move ~2.6° locally; tail root ~5.2°, weighted distal tail controls ~4.0–4.4°, distal tail travel ~55 mm forward/back. This is restrained authored response, not high-speed hair simulation. Saddle, breastplate, reins and stirrups remain attached in the inspected sequence. Rider fit was not assessed. Preserve the old Walk as baseline and show this improved slow-Walk study before treating it as the final horse motion.

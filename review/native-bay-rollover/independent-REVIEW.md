# Independent refined Bay Walk audit

**Verdict: pass as a narrow private Bay slow-Walk study.** The candidate retains an upright standing body, anatomical four-beat support with no flight, actual fore/hind folding, heel/toe rollover, gentle axial/groom response and attached Western tack. The 193-ms fore carpal apex and 149–166-ms hock plateaus remain mechanical, with brisk unfolding. This is not approval of final naturalism, all breeds, faster gaits, transitions or rider fit.

Original static Bay source `output/native-bay-preparation/native-bay-rest.glb` has SHA-256 **6110fb3bcfe6ba6660c9c05d67269bc800d19706fab54db29633003d87f0a6a3**. Frozen candidate `output/native-bay-rollover/bay-native-walk-rollover.glb` has SHA-256 **8f622bf3b22244ba1b6a39c72e3cb1ce6f2e378bb7eb731a22caba33b2459814**. One independent Three.js pass sampled **256 phases**, with **zero browser errors**, 16 side and 16 quarter captures plus eight late-stance hoof closeups. The preserved side GIF replays those sampled poses at the authored period; they are not high-frame-rate recordings. No model downloads, production edits, reauthoring or additional phase scans were performed.

## Native rest, anatomy and masks

The Bay keeps the white source's 677-joint graph and skin weighting but has its own nonuniform cage-fitted vertices, translations and inverse binds. The solver therefore uses actual Bay reach. Anatomical **FL/HL are native `_l`, positive X**; FR/HR are `_r`, negative X. The older preparation's `frontLeft`/`hindLeft` strings were camera labels assigned to `_r`; those labels are not transplanted into this audit.

Fixed original all-body floor is **Y = −1.7011527533861148e−9 m**, effectively zero. It is derived before animation from all **16,159** original body-skin vertices and remains unchanged. Actual complete body extrema include the body and all four hooves; hair/tack are visually inspected separately. The candidate's nodes, meshes, skins, materials, images, textures, samplers, scenes and original binary prefix are unchanged (`independent-preservation-checks.json`). Skin marker **1998 is an upper-trunk probe**, not certified withers; marker **1931 is neck crest**. Each marker vector is saved before any hoof loops.

Independent low-hoof groups use the nearest anatomical distal marker in rest XZ, with rest Y < floor + **.115 × .8496868094 = .09771398 m**. FL/FR/HL/HR contain **320/320/260/281** vertices. Strict sole groups within each hoof's own original minimum + **7 mm** contain **121/115/84/78** and match the author exactly. Sorted-rest-Z lower/upper quartiles form fixed heel/toe groups of **31/29/21/20** vertices. Author quantiles include one additional tied toe vertex per fore hoof (FL 3860, FR 14264); heel and hind toe groups match. The author's broader lower-foot solver patch uses .19 × the same size ratio. Membership and floor are never reselected by current height.

## Four-beat support, contact and travel

The explicit agreed masks use **1.12 s**, duty **.65**, and touchdown starts **HL 0 / FL .25 / HR .5 / FR .75**. Every phase has two or three supporting hooves, with **zero airborne samples**. Low swing vertices are not classified as planted merely because they are near the floor. Complete body minimum remains **+0.894 to +1.022 mm** above the original floor throughout the cycle.

| Hoof | Explicit-stance whole-hoof minimum |
|---|---:|
| FL | +0.943–1.142 mm |
| FR | +0.949–1.201 mm |
| HL | +0.912–1.106 mm |
| HR | +0.894–1.207 mm |

The stance stroke is **±.16993736 m**; .728 s of stance implies nominal **.4668608843 m/s**, with .52288419 m actor travel per cycle. Regional contact proxies use `XYZ_world = XYZ_inplace + [0,0,speed × duration × unwrapped limb phase]`. Heel strike, flat support and late toe breakover remain within **.0353 mm XZ range** at that speed. Centroid proxies are not individual physical contact points; centroid Y movement is not sole-minimum height. Whole-stance heel travel after heel lift is intentionally excluded from planted-heel sliding.

Late rollover raises heels **4.3–23.8 mm above toes**, which remain near the floor. Initial strike raises toes **2.5–9.6 mm above heels**. The original sole wedge means the flat heel/toe minima need not be numerically identical. Actual skin minima and the eight closeups show partial-sole contact without forcing the full sole flat or shifting the whole body/floor.

## Articulation, body, groom and limits

Swing bone-center geometric flexion reaches **FL 54.77° / FR 53.03°**, hock **HL 70.03° / HR 72.66°**; sagittal fore and hind bending have opposite signs, as expected from their native chains. These are geometric measurements, not clinical joint ROM. The previous Bay builder held terminal hoof orientation at the original world rest rotation and fitted sole mean height throughout stance. This refined candidate adds heel-first placement, toe breakover, early folded recovery and whole-patch minimum-height fitting, preserving the same original upright target.

The fore **carpus +45°** cap occurs in **22/128 frames each**, or **192.5 ms**—about half of the .392-s swing. Scapula **−10°** touches persist **34/36 frames** (297.5/315 ms); hock **−35°** persists **17/19 frames** (148.75/166.25 ms). Other upper/lower limb caps are not reached. The held apex and rapid final unfolding are visible limitations; good floor contact does not certify natural recovery. First/last pivot seams are under .000003°, hoof-centroid seams under .000017 mm. Fore adjacent steps reach **3.83° per 4.375 ms**; closure does not establish smooth acceleration.

Upper-trunk marker 1998 stays **1.47240–1.48872 m** high around original rest **1.47920 m**, a **16.32-mm** Y range. There is no global crouch. Head pivot moves **33.30 mm Y / 25.67 mm Z**; head relative to trunk moves **21.47 mm Y**. Neck crest moves **17.04 mm Y / 12.05 mm Z**. These gentle Walk responses are independent of the torso, though periodic and restrained. Weighted mane controls move **2.60–2.66°**, main tail root **5.20°**, distal tail controls **4.04–4.37°**. Groom is responsive without claiming physical hair simulation.

All 32 side/quarter poses show intact knee/hock contours and no gross skin crumple, inversion, repeated crouch or tack detachment. Saddle, stirrups, breastplate and reins remain attached. The dark lower-leg silhouette, broad fitted neck, bright eye and bulky Western tack are retained appearance limits; this audit approves none of those artistic choices. Rider fit was not tested.

`audit-derive-rest.py`, `audit-viewer-module.mjs`, `audit-qa.cjs`, `audit-summarize.py` and `audit-metrics.py` preserve the method. The tracked independent viewer reads the byte-identical `model.glb` in this folder. Independent report names preserve the original output audit; full scans and solve dumps are not tracked. Raw scans and redundant captures remain output-only. Preserve the limited candidate and show playback before any broader use; faster Bay gaits need their own actual-native solve and review.

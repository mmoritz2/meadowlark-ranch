# Independent native Trot audit

**Verdict: useful private true-diagonal Trot milestone on the original realistic white horse.** The candidate keeps the upright body, visibly articulates carpus/hock, adds torso/neck/head and groom response, and passes the bounded contact/roll checks below. This is not approval of all breeds, faster gaits, rider fit, or final naturalistic timing. Its short, high-stepping swing and conspicuous periodic head response still deserve user playback review.

Audited input: `../target-native-trot/target-native-trot.glb`, SHA256 **64c2c8a0501d90573065465db4ff4f14c958d0dd2f655521a02c8e7b2f635113**. One independent Three.js pass sampled **256 uniform phases**, including authored-key interpolation, with **0 browser errors**, 16 phases × side/quarter views, and two late-stance closeups per hoof. Full results are `browser-report.json`, `summary.json`, `travel-contact.json`, `timing-contact.json`, and `author-per-joint-caps.json`. `cycle-side.gif` / `cycle-quarter.gif` replay the 16 captured poses at the authored 0.72-second period; these sampled previews are not a high-frame-rate motion capture.

## Fixed geometry and contact definitions

The original 677-joint skin is evaluated with `applyBoneTransform` followed by mesh world transformation. **Floor Y = −0.004714777107501428 m**, determined from all 16,159 body vertices in the unchanged default pose before animation. It never follows the animated body. Whole-body extrema include the entire body skin and all four hooves, rather than only a low/near-ground subset. Hair/tack are inspected visually and are not included in this body's floor-extrema statistic.

Independent broad hoof groups were fixed in default rest: nearest native distal hoof marker in XZ and rest Y < floor + 0.115 m. FL/FR/HL/HR contain **316/317/257/278** vertices. Strict sole groups retain vertices within **7 mm of that hoof's own rest minimum**, giving **115/104/74/65** vertices; these strict sets exactly match the author's sets. The lowest/highest rest-Z quartiles of each strict set are fixed heel/toe groups (ceil counts 29/26/19/17). Author quantile masks include a few extra tied-Z vertices. No groups are reselected by current proximity to the floor.

Stance is the **authored mask**, not an inference from low vertex height: FL+HR offset 0; FR+HL offset 0.5; duty 0.44; cycle 0.72 s. Intended diagonal pair patterns occur 113 + 113 of 256 samples; the other **30 samples (11.72%)** are suspension. Actual complete body minima during suspension are **+1.71 to +22.21 mm** over the fixed floor. Complete body minima throughout the cycle are **+0.925 to +22.21 mm**: no body penetration in this pass.

| Hoof | Stance whole-hoof minimum above floor | Late breakover heel above toe | Swing carpus/hock geometric maximum |
|---|---:|---:|---:|
| FL | 0.958–1.241 mm | 13.53–46.98 mm | 79.63° |
| FR | 0.934–1.207 mm | 11.48–46.77 mm | 78.08° |
| HL | 0.946–1.119 mm | 13.70–44.16 mm | 83.89° |
| HR | 0.925–4.424 mm | 11.34–43.35 mm | 85.97° |

Heel strike lifts the toe; late stance lifts the heel while the toe remains near the floor. Closeups confirm that geometry rather than requiring every sole vertex to stay flat. The slightly higher HR strike remains a 4.42-mm gap, not penetration. Correct fore flexion is rearward at native `hand_*`; hind hock flexion has the opposite signed sagittal direction at `foot_*`. No gross joint inversion or skin collapse appears in the side/quarter sequence. These bone-center geometric angles are **not clinical three-dimensional joint ROM**.

## Ground travel and timing

The 0.44-m stance stroke over 0.3168 s implies **1.3888889 m/s**, approximately 5 km/h. For each fixed contact centroid, add actor travel `Z += speed × 0.72 × unwrapped limb phase`. Within heel-strike / flat / toe-breakover regimes, maximum XZ range is **0.606 mm** (HR heel strike); late toe ranges are **0.039–0.060 mm**. The other heels/flat groups are below 0.086 mm. These centroid proxies are not a single physical contact vertex. Whole-stance heel movement reaches ~9.6 mm because it legitimately rotates after heel lift; counting that as planted-heel sliding would be wrong. Runtime travel must match this nominal speed.

The reported **46/47 bound-hit frames are clavicle −14° caps**, not a carpus held at 70° for 36% of the cycle. The actual 70° carpus plateau is FL 12/128 frames (~67.5 ms) and FR 8–9/128 (~45–51 ms). Actual geometric flexion stays within ~0.6° during this brief folded apex, then unfolds. Some mechanical stiffness remains plausible there, but the captured sequence shows a brief folded swing rather than a long frozen carpus. Largest adjacent fore local angular step at 256 phases is 2.92°; the loop step is 0.48°/1.50°. First/last local orientation seams are below 0.000006°, and hoof centroid seams below 0.00002 mm. Pose continuity does not certify smooth acceleration.

Pelvis rises/falls **36.0 mm**, lowest at phase 0.21875, close to diagonal midstance 0.22, and highest at 0.46875 in suspension. Fixed upper-trunk skin marker **1998** moves 40.85 mm vertically, while head pivot moves 101.17 mm; head relative to upper trunk moves 60.52 mm. Head minimum phase 0.15625 leads pelvis by ~45 ms. The body/head are responsive and the standing posture is retained, but the head oscillation is conspicuous and more periodic than a captured natural performance. Marker **1931 is neck crest**, not withers; marker 1998 is an upper-trunk probe, not a certified anatomical withers landmark. Both vectors are saved independently before hoof loops.

Mane detail joints show 4.8–4.9° local angular excursion; tail root ~8.0°, weighted distal tail controls ~6.4–7.1°, with distal tail motion ~111 mm forward/back. They are no longer frozen. The captured mane response remains restrained; this gait-specific authored motion does not establish realistic high-speed groom simulation. Saddle, reins, stirrups, and breastplate stay attached without gross detachment in the inspected sequence. Rider fit was not tested.

The primary carpal, breakover and torso phase studies informing this audit are linked in [the primary reference note](independent-PRE_BAKE.md). Their observations support anatomical direction and timing criteria; they do not validate this animation's visual quality. Preserve this candidate as a narrow private Trot study and show its motion before broader use.

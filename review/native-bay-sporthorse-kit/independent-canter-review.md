# Independent native Bay Sporthorse cubic Canter audit

Candidate `0162dd10be27992ae53c18772ad49eb29e2dffcb434b4521a7c849e3642429fe`; original native rest `8f7f83e9669dc063dcb38455f8658369774ec0ce9b9eb81c2e7742e7d013d6a8`. One bounded real Three.GLTF audit: 256 phases per lead, fixed original source hoof masks and floor, 32 side and 32 quarter poses per lead. No producer files changed.

All 677 joints were finite, with no browser errors. Original source nodes, geometry, skins, binds, maps and binary prefix remain unchanged. All 164 authored channel values and time arrays are bit-exact against the prior LINEAR Canter; only interpolation/tangents change.

Left lead has full-body clearance +0.813 mm and stance whole-hoof minima +0.813 to +4.024 mm; right +0.797 mm and +0.797 to +2.402 mm. Both have the intended trailing-hind → opposite-hind/trailing-fore → leading-fore sequence and 30 of 256 suspension samples. Fixed heel/flat/toe regional XZ drift at nominal 1.781221217 m/s is at most 0.556 mm left and 0.306 mm right. These regional anchors are rest-selected and advected at the nominal speed; centroid Y is separate from the actual whole-hoof minimum.

Normalized cubic quaternion tangent joins are exactly equal internally; cyclic tangent differences are below 0.000017 degrees/s. Dense sampled local joint speed remains brisk: 994.5 degrees/s left and 968.6 right. Authored maximum 5 ms step values are unchanged at 4.780/4.775 degrees. C1 continuity removes the earlier velocity discontinuity, but does not establish C2, biomechanical forces or naturalism.

Full-cycle side/quarter poses show an upright body, progressive knee/hock recovery, native mane/tail and head/neck response, and attached original Western tack. The high held neck, short regular stride, cap-held scapular shapes, quick folding, bright eyes, card groom and bulky tack remain visible limits. No gross crumpling or source asset detachment appeared. This is a narrow private contact/interpolation pass, not final realistic animation approval or mounted clearance evidence.

Method helpers and raw phases are in the parent audit output folder. `summary.json`, `cubic-review.json`, `key-preservation.json`, contact sheets and nominal-cycle GIFs retain the evidence.

# Sporthorse kit: bounded mounted review

The frozen cubic kit passes the measured mounted attachment and full-cycle checks. Its source pose curves and full native skin remain intact. This closes the earlier LINEAR Canter velocity-join issue for this target; brisk recovery, cap plateaus and visible art limits remain.

Model SHA `d3e18fdc3926b22a9215f796f59cc6dccf044f5c2ae68a04385251e55947c272`; loaded native motion controller SHA `2f44f6641225c9ab2d8b102b188da48fe9f45538211f0fb50d3a7808ad04edb6`. Original source-rest skin and all four 82-track animation curves/interpolation modes passed both producer and independent preservation checks. The prior LINEAR mounted study is preserved separately.

The private routed actual-Ranch pass covered 64 time steps spanning one complete cycle per gait, through the real game controller and 65-bone rider. Cycle coverage was 0.99999996–1.00000002. Every 677-joint transform stayed finite, with zero browser errors, all original non-rein equipment intact and all samples settled after the 0.20-second gait blend. Actual skinned boot soles remained within 3.094 µm of moving stirrup treads; bit/fist ribbon endpoints stayed within 2.844e−15 m. The native profile response alone was routed to this Sporthorse model/seat/speeds; this is not an unrouted breed-registration pass.

| Settled cycle | Actor-plane body minimum | Highest all-body floor minimum |
| --- | ---: | ---: |
| Walk | +0.715 mm | +1.174 mm |
| Trot | +0.766 mm | +3.374 mm |
| Canter left | +0.814 mm | +36.160 mm |
| Canter right | +0.798 mm | +36.198 mm |

The right-lead steering cycle reaches−7.598 mm relative to terrain height at the horse center, despite a positive actor-plane floor margin. Those comparisons include steering orientation and center-terrain height, not per-hoof terrain. No terrain IK or hidden lift was added.

A separate routed actual-Ranch transition sample tested stand→walk at rate0.12, walk→trot, trot→left Canter, opposite lead and stand. All fades finished at 0.20 seconds of real time, including low-rate Walk. All horse/rider transforms remained finite, equipment stayed attached, maximum boot residual was 3.056 µm and rein endpoint gap2.599e−15 m. Final stand returns `clip:null`, reflecting the actual default-rest fallback. Worst actor-plane body floor during a blend was−9.910 mm at Walk→Trot; opposite lead reached−9.015 mm locally and−17.451 mm relative to center terrain. These sampled actor-plane transitions meet the 10 mm band but do not establish fixed foot planting, all-phase transition contact or terrain adaptation.

The saved viewer checked64 phases per gait with the production motion factory and rider bridge: all other 276 tack components stayed intact, only 1640 display-rein triangles were replaced on a cloned geometry, ribbon widths remained 19 mm, no sampled ribbon center entered the neck, and minimum sampled neck clearance was 35.993 mm. Boot residual was 2.808 µm. This static seeking pass is separate from real-time transition evidence.

Independent upstream cubic Canter QA checked 256 phases per lead: correct lead footfalls and suspension, positive whole-body/stance hoof floor margins, normalized internal quaternion tangent continuity and cyclic tangent differences below 0.000017°/s. The actual maximum authored 5 ms steps stay 4.780°/4.775°; dense local speeds remain about994.5°/s left and968.6°/s right. C1 repair removes the earlier join jump while preserving all keyed values; it does not establish C2 continuity or biomechanical forces.

Side/quarter captures show the body upright, clear swing folding, head/neck and groom response, rider seated and original tack attached. The held high neck, short regular stride, cap-held scapular poses, brisk folding, bright eyes, card groom, bulky tack and comparatively stiff rider upper body remain visible. No gross crouch, skin collapse or tack detachment appeared. This is a narrow mounted/contact milestone, not finished full-speed naturalism, Gallop, Jump or whole-roster approval.

Captures: [Walk side](walk-side.png), [Trot quarter](trot-quarter.png), [right Canter quarter](canter-right-quarter.png), [actual routed Ranch left Canter](ranch-canter-left.png). Reports: [full-cycle Ranch](ranch-mounted-summary.json), [real-time transitions](transition-ranch-summary.json), [saved viewer](viewer-qa-summary.json), [independent Canter review](independent-canter-review.md). The integration owner supplies a separate actual unrouted new-ID summary.

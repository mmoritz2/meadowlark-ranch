# Hero horse motion reference and acceptance

The user has approved the current horse's appearance. This work reviews rigging and animation only. LF/RF = left/right fore; LH/RH = left/right hind. One cycle is one complete stride of the same limb, not one beat.

## Reliable footfalls

| Gait | Contact order | Support requirement |
|---|---|---|
| Walk | RH → RF → LH → LF, repeated | Four separated beats; no suspension |
| Trot | RH+LF → LH+RF, repeated | Alternating diagonal pairs; aerial intervals |
| Left canter | RH → LH+RF → LF → flight | Three beats; left fore leads |
| Right canter | LH → RH+LF → RF → flight | Mirror of left lead |
| Left gallop | RH → LH → RF → LF → flight | Four distinct beats; left fore leads |
| Right gallop | LH → RH → LF → RF → flight | Mirror of left lead |

The University of Kentucky's Ashley Griffin gives these sequences in [Walk](https://horses.extension.org/horse-walk/), [Trot](https://horses.extension.org/horse-trot/), [Canter](https://horses.extension.org/horse-canter/) and [Gallop](https://horses.extension.org/horse-gallop/). Gayle Leith, DVM, describes stance as ground contact, swing as absence of contact, and the presence/absence of suspension in [University of Arizona equine gait teaching slides](https://opentextbooks.library.arizona.edu/app/uploads/sites/274/2023/11/Horse-Gaits.pdf).

## Timing: evidence versus animation choices

An original 20-horse sensor study reported mean stride rates of 0.83, 1.30 and 1.61 Hz for walk/trot/canter, with stance durations of about 758, 313 and 260 ms. The corresponding stride durations were 1.21, 0.78 and 0.63 seconds. These are cohort observations, not universal breed constants. [Original study, Table 1](https://www.mdpi.com/1424-8220/24/24/8170).

Royal Veterinary College researchers measured eight Icelandic horses over a range of speeds: stance duration and duty factor decrease as speed rises, and leading/trailing limbs need not share identical stance duration. Therefore a faster gait should not simply increase the frequency of one unchanged sine-wave pose. [Robilliard, Pfau and Wilson, 2007](https://journals.biologists.com/jeb/article/210/2/187/17107/Gait-characterisation-and-classification-in-horses).

Useful **initial animation settings**, to tune from clips rather than call biological targets: walk 0.9 Hz/62% duty, trot 1.4 Hz/42%, canter 1.7 Hz with limb-specific duty around 32–42%, gallop 2.1 Hz with roughly 25–30% duty. Walk impacts can begin at normalized phases 0/.25/.50/.75; trot diagonal impacts at 0/.50. Canter/gallop require unequal contact spacings and their own lead-dependent schedules. Do not use these initial rates as fixed pass/fail bounds.

## Independent acceptance rubric

1. Record at least three complete settled cycles per gait, plus left and right canter/gallop, at 60 samples/second. Confirm footfall order, diagonal timing, absence of walk suspension, and actual airborne intervals in running gaits. Exclude transition strides from steady-state cadence tests.
2. Measure **actual skinned hoof sole landmarks**, not only IK target coordinates. During planted stance, compensate for virtual travel in a treadmill preview: horizontal drift should remain within 2 cm per stance, and sole penetration within 1 cm. These are engineering tolerances for the game, not clinical standards. Assess heel-to-toe roll separately; it may move a sole-center marker while its active contact point stays planted.
3. Check finite bone transforms, unit quaternions, stable bone lengths, sensible knee/hock folding, and attached hooves/eyes/groom. Check front/rear views for leg crossing or lateral buckling and side views for joint inversion.
4. Exercise stand→walk→trot→canter→gallop and reverse transitions, both leads, and rapid changes. No phase reset snap, planted-foot teleport or root-height pop. A transition may change cadence but must preserve continuous motion.
5. Check loop seam and equivalent one-second stepping at 30/60/120 Hz. View complete real-time clips and selected slow-motion contact frames. Numerical passes do not replace visible weight transfer, head/neck balance and coherent body motion.

## QA data contract

Expose deterministic time stepping plus a pause for realtime animation. The audit needs gait/lead/phase/rate, per-hoof contact flags and **actual** sole positions, virtual world travel (for a treadmill), and bone world positions/quaternions. Missing diagnostics must be reported as unmeasured, not passed. Archive full frame samples, transition samples, screenshots, clips and errors under the requested output directory.

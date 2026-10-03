# Black Dragon separated wings and flowing flight tail

The former ground fold swept both inner wing membranes across the spine. The
new pose aims the original wing-finger chains rearward on their respective
sides, preserving bone lengths, skin weights, meshes and the source model.

The flight tail now carries a shallow arc behind the body with progressive
lag along its four original weighted joints. One 3.30-second tail wave spans
two unchanged 1.65-second wingbeats. Ground legs, body and tail tracks remain
unchanged.

The legacy horse tail-swish hook now skips Black Dragon. It previously added
extra rotations after the dragon clips, pushing the long tail through the
ground and distorting its flight arc.

Black Dragon landing controls request a ground-pose blend below 0.45 m while
physics continues descending. The 0.8-second blend gathers the wings through
touchdown. Pitch levels toward the terrain, and a cancelled landing or a low
hover returns to full wing motion. Multiplayer packets include the landing
request so remote riders see the same gathering pose.
The final descent eases more slowly during the fold. Intermediate rotations
of the long wing fingers can reach below the feet even when both endpoint
poses clear the floor. A temporary normalization lift, based on actual flight
blend weight and available altitude, keeps these poses clear. Its 0.55 m
quadratic envelope covers the measured 0.4363 m requirement; it also carries
the rider and remains continuous when the landing is cancelled.

Validation includes actual skinned wing separation in all four clips and
1,088 flight-to-ground blend poses, tail motion over 121 browser samples,
controller cancellation and low-hover checks, and mounted landing/rider tests.
Source skin and all 232 joints are preserved. The European Dragon and horse
motion assets are unchanged.

Reproduction tools: `tools/dragon-motions/audit-black-wings.py`,
`tools/dragon-motions/qa-black-flight-tail.cjs`,
`tools/qa-dragon-wing-tail.cjs`, and `tools/qa-dragon-controller.mjs`.

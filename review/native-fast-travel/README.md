# Substantially faster ranch travel

Release 4420a33 still derived all travel from short collected-stride contact
speeds. A normal Bay horse cantered at 2.86 m/s and galloped at 5.34 m/s. Higher
speeds reached the source-based cap regardless of input or stats.

This update uses explicit gameplay targets: walk 2, trot 4.2, canter 7.5 and
gallop 15 m/s. Stature changes those targets by at most -10%/+8%, so a pony can
still cross the map at a useful pace. Speed stats, personality and boost hooks
adjust the targets within a 35% speed headroom. Canter/gallop selection, stamina,
exhaustion, stopping and jump recovery remain connected to gameplay speed.

The preserved collected-stride animation runs at bounded cadence (maximum 2×).
Original poses, hoof-fold curves and measured clip metadata are retained.
Travel at these higher speeds is deliberately not an exact hoof-contact match;
there can be sliding until a separate extended-stride animation is ready. This
release does not claim a rebuilt racing gallop. Creator dragons retain their
existing source-animation policy.

Real-time frame deltas up to 250 ms are consumed; long stalls are still bounded.
Player acceleration uses exponential damping for consistent response across
frame rates. Movement, turning and obstacle/fence collision checks advance in
steps of at most 0.3 m, preventing fast travel from skipping narrow obstacles.

Verification:

- `tools/qa-native-complete-controller.mjs`: source poses/metadata retained,
  bounded visual cadence, broad pony speed parity, gait selection, leads and
  one-shot jump recovery.
- `tools/qa-native-riding-speed.cjs`: actual keyboard travel at all four gaits
  on Bay, White Western and Welsh; stats, boost, stamina, stop and jump.
- `tools/qa-native-riding-frame-time.cjs`: actual wall-clock travel with delayed
  frames, plus thin-wall and solid-obstacle collision protection.

`runtime-report.json` and `frame-time-report.json` contain the browser evidence.

`exhaustion-report.json` verifies that a tired horse holding Shift uses a canter
pose and stays below its canter speed limit, with finite motion.

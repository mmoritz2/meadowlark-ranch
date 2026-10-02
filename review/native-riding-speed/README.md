# Faster riding on the realistic horses

The previous runtime treated each collected animation's measured stance speed as
an absolute gameplay ceiling. A Bay horse topped out near 1.79 m/s at canter and
2.97 m/s at gallop, and the 1× playback clamp prevented any extra travel from
remaining synchronized with the feet.

The riding policy now increases the base cadence and travel together: walk
1.35×, trot 1.5×, canter 1.6× and gallop 1.8×. Horse speed stats, personality,
ride hooks and boosts can vary that pace within a 2× ceiling. The original clip
poses, hoof flex, measured stride metadata and jump clock are preserved. A
requested trot stays a trot when boosted; deceleration keeps a faster gait until
the selected slower gait can support the current travel speed. Dragon source
clips keep their existing speed policy.

Stamina drain and the exhausted-horse cap use the native canter threshold, so
they also work on small ponies. Real-time frame deltas up to 100 ms are consumed
instead of discarding time below 20 fps; longer stalls remain bounded. This does
not raise rendering frame rate.

These remain collected strides. This change is bounded faster playback, not an
extended racing gallop or a new set of longer-stride animations.

Verification:

- `node tools/qa-native-complete-controller.mjs`: gait/lead transitions, matching
  animation time and travel rate, actor scale, boost ceiling, dragon policy and
  one-shot jump recovery.
- `NODE_PATH=<playwright modules> QA_URL=http://127.0.0.1:8584 node tools/qa-native-riding-speed.cjs`:
  actual keyboard walk/trot/canter/gallop and measured distance for Bay, White
  Western and Welsh Pony; speed stats, boost, stamina, stopping and jumping.
- `runtime-report.json`: browser verification output from the command above.
- `tools/qa-native-riding-frame-time.cjs` and `frame-time-report.json`: at about
  15 fps, 2.325 seconds of game time elapsed over 2.329 seconds of wall time
  (99.8%). The previous 50 ms cap would discard time at that frame rate.
- `visual-report.json`: mounted White Western quarter-cycle gallop poses at
  the faster riding pace, retaining the approved hoof fold and rider fit.

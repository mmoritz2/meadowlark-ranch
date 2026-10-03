# Black Dragon flight tail

The new flight tail stays carried behind the body in a shallow rising arc. A small sideways and vertical wave reaches each successive segment later, completing one 3.30-second cycle over two wingbeats. Segment targets are measured independently, so the rotations do not accumulate into a whip.

Only the original four weighted tail joints are changed: `tail_1_04`, `tail_2_05`, `tail_3_06` and `ik_ACT_tail_5_07`. The helper changes rotations only. It does not change geometry, skin weights, bone hierarchy, tail joint translations or grounded tail animation. The detached Blender controls have no body skin weights and are left alone.

`black_dragon_tail.py` exposes `apply_flight_tail(doc, phase, turn)` for the motion builder. `phase` is a complete tail cycle, while the builder samples wings and body over two beats. All endpoint rotations and their analytic velocities are periodic.

Validation:

- The helper was sampled at 121 phases against 1,130 strongly tail-weighted source vertices. The maximum angle between adjacent tail segments was 6.78 degrees, and the loop endpoint difference was zero.
- The final packaged GLB was separately loaded in the browser. All 232 bones and sampled tail skin positions stayed finite across 121 phases; the loop endpoint difference was zero. The final tail-tip travel range was 0.797 m sideways and 0.671 m vertically, including the body's wingbeat motion.
- Side and overhead screenshots were inspected at 0%, 25%, 50% and 75%. The carried-back arc stays continuous without sharp bends. Side shots deliberately frame the tail closely; the high wing stroke extends beyond the top edge.

Reproduce from the repository root:

```sh
PYTHONDONTWRITEBYTECODE=1 python3 tools/dragon-motions/qa-black-dragon-tail.py
QA_URL=http://127.0.0.1:8584 node tools/dragon-motions/qa-black-flight-tail.cjs
```

The browser check needs Playwright available through NODE_PATH. Reports and screenshots are in this directory. This is authored periodic secondary motion, not a real-time physical tail simulation.

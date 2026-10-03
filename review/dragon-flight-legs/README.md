# Black Dragon flight leg motion

The four feet previously held fixed targets throughout flight. The new clip
adds a relaxed, staggered recovery around the existing carried tuck. Native
shoulder/hip and elbow/knee joints follow solved foot paths, with a delayed
ankle curl. One complete leg cycle spans two wingbeats (3.30 seconds).

Front feet travel 23.6 cm vertically and 20.2 cm fore/aft; hind feet travel
19.1 cm vertically and 18.0 cm fore/aft. The feet curl through 12–15 degrees.
The original joint hierarchy, skin weights and source model are unchanged.

All three ground clips are byte-identical to the preceding motion bundle.
Only 16 limb/foot tracks changed in DragonFly; wing, torso, neck and tail
tracks retain their exact preceding values. Numerical build checks confirm
finite skin coordinates, closed loops and negligible IK reach error.

The source comparison and limb measurements are recorded in preservation.json
and motion-ranges.json. The packaged model is checked in the browser by
`tools/dragon-motions/qa-black-flight-legs.cjs`; the mounted flight/landing
regression uses `tools/qa-dragon-flight-legs.cjs`.

Browser validation sampled 121 poses from the served GLB and checked all 232
joints and 23,142 skin vertices. Each ankle traces a 28–32 cm path relative to
the torso. Upper/lower limb rotations and foot angles vary, with staggered
left/right and front/back timing. Loop endpoint position error is zero.
Eight close side and front-quarter frames were visually inspected.

The mounted game also passes after integration with the latest scenery update:
all four feet move relative to the torso during hover, the tail keeps its slow
wave, wings gather before touchdown, and low-hover cancellation and remote
landing remain correct. Rider attachment stays aligned and all poses are
finite. Minimum sampled skin clearance is within 0.06 mm of source precision.

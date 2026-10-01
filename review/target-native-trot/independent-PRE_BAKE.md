# Native Trot and hoof-roll audit basis

Private audit scope: preserve the realistic white horse, original skin, and Western tack; check an authored true Trot rather than speeding up Walk or transferring the mislabeled Mesh2Motion pace. No new model acquisition or production changes.

## Primary evidence used

The in-vivo study of Warmblood, Iberian, and Icelandic horses found that trot's head, upper back, and pelvis rise/fall together twice per stride. They are lowest around diagonal midstance and highest near push-off into suspension. Breed and speed affect amplitude and timing, so this is a phase reference, not a requirement to impose one measured amplitude on every model. [2022: Timing of Vertical Head, Withers and Pelvis Movements](https://pmc.ncbi.nlm.nih.gov/articles/PMC9657284/).

A three-dimensional carpal study measured much more flexion/extension during swing than stance: swing range 76±13°, stance 15±6°. Its small sample is a useful warning against applying the slow-Walk's uniform 25° correction cap to a Trot swing; it does not certify a chosen animation angle. [2004: Three-dimensional carpal kinematics of trotting horses](https://pubmed.ncbi.nlm.nih.gov/15656494/).

An instrumented hoof study defines breakover as heel lift followed by rotation around the toe, ending at hoof-off. Thus a rolling hoof legitimately raises rear sole vertices while toe contact persists. [Tijssen et al., 2020: Automatic detection of break-over phase onset](https://pmc.ncbi.nlm.nih.gov/articles/PMC7259550/). A forceplate/video study in sound horses measured roughly 39–42ms of breakover under its tested shoe conditions; this supports a short late-stance transition, not rotation throughout all stance. [Eliashar et al., 2002](https://pubmed.ncbi.nlm.nih.gov/11902761/).

## Native rig implications

- +Y is up, +Z forward; native anatomical `_l` is +X and `_r` −X. Stance pairs must be **FL+HR**, then **FR+HL**, half a cycle apart.
- Keep the previously verified floor **Y −0.004714777 m** fixed. Use fixed native full hoof masks and strict sole groups classified in default rest pose. Rotating the hoof does not justify reselecting vertices or changing the floor.
- The fore carpus is `hand_*`, between `lowerarm_*` and `fingers01_*`. Positive rotation around world X bends its distal cannon rearward. The fore pastern/toe controls are `fingers01_*` and `fingers02_*`; most actual hoof vertices follow fingers02.
- The hind hock is `foot_*`, between `lowerleg_*` and `toes01_*`; from its native rest vectors, negative world X flexes the hock while positive rotation tends to straighten it. The hind pastern/toe controls are `toes01_*` and `toes02_*`.
- Positive hoof pitch around world X raises the rear heel relative to the forward toe. Achieving grounded toe roll requires compensating limb/pastern location from actual skinned vertices; rotating about a pastern joint alone moves the toe through the floor.
- Four-joint fore solving should retain modest native scapular participation; the almost extended rest fore chain otherwise cannot reach a long backward stance locus. Meaningful carpal/hock flexion needs an anatomical bias or joint-pole target, because least-angle endpoint fitting can produce straight swinging stilts even with perfect sole height.

The independent pass will sample 256 phases, including authored-grid interpolation, inspect both diagonal support windows and suspension, and capture multiple angles. It will report actual toe/heel and whole-hoof minimum, carpus/hock shape, fixed trunk/head motion, groom, tack, and the nominal travel speed implied by stance backflow. Passing contact alone is not a realism verdict.

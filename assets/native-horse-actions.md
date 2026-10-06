# Native horse action authoring

`native-horse-actions.mjs` creates original one-shot Nuzzle, Head toss, Graze,
Rear, Bow, Kick and Lie down curves for the existing WildMesh 677-joint horse.
They begin and end at the original rest pose. The module adds animation tracks;
it does not edit geometry, skin weights, inverse binds, joint lengths, or the
approved gait and jump assets. Dragons and other skeletons return no actions.

The authoring frame is the source horse's +Y up, +Z forward frame. Neck and body
rotations are converted through actual parent transforms. Rear, bow and kick
support contacts use sampled skinned sole surfaces, a constrained sagittal
least-squares fit, and a bounded anatomical folding bias. Bow continues the
previous contact solution to avoid changing IK branches. Grounded resting
poses fold named thigh/shin/cannon and foreleg segments onto one another, lower
the torso, and lift the hanging tail. Body, low tack and tail skin bounds keep the folded
pose above its rest floor. A small additional clearance (about 4cm on the
Western tack) keeps the skinned girth/breast strap out of the ground; this is
not a cloth simulation or terrain-aware resting-body collision solve. Lie down is marked `dismountedOnly`.

The rising sequence extends the forelegs and lifts the chest first, followed
by the hindquarter push; it is not the lowering sequence played backward.
This ordering follows the description of rising in Rutgers Equine Science
Center's [Care for the Older Horse: Diet and Health](https://esc.rutgers.edu/fact_sheet/care-for-the-older-horse-diet-and-health/).
The exact timing, joint angles and stylization are authored for this model.
The front feet make staggered contact during recovery: one front sole supports
the chest while the other is briefly lifted (about 6 cm in the source pose).
Tests require one supporting front sole within 2 cm of the floor and neither
front sole more than 8 cm high at the chest-lift checkpoint.

The controller owns one-shot playback and return to idle. The gameplay actor
must not add the legacy procedural emote lift/pitch to these curves. Existing
groom inertia remains responsible for secondary hair response. Prepared clips
are cached by **geometry identity and rest-joint signature**; different breed
conformations cannot reuse another mesh's body-clearance fit.

The game starts these actions from a halt. Moving away cancels a mounted action
through the normal blend; lying down uses the parked horse after dismounting.
Mounting, calling and event entry wait through its get-up. Mounted actions share
a sequence and elapsed time with peers. Parked-horse actions currently remain
local, because the multiplayer actor does not yet represent the parked clone.

Run `node tools/test-native-horse-actions.mjs`. It constructs real skeletons and
skins from the committed GLBs without rendering, checks unchanged rest/skin
inputs and exact rest endpoints, rejects large adjacent quaternion changes,
and samples the complete body, hair and tack surface through all actions. It
also applies all 25 committed conformation buffers and checks those meshes.
These flat-floor measurements complement, and do not replace, mounted and
on-foot visual review with the game's runtime groom and rider controllers.

These are newly authored game poses, not clips extracted from Star Equestrian
or direct transfers from the stylized Mesh2Motion source. The target model's
existing WildMesh attribution and license continue to apply.

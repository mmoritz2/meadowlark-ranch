# Separate folded Black Dragon wings

The old ground pose rotated the whole wing root rearward. Inner membrane
fingers crossed the spine, causing the two folded wings to look like one.
The replacement aims each existing finger segment into a rearward folded
chain on its own side. No bone translations, bone scales, geometry, skin
weights, textures or inverse bind matrices are modified.

The source model retains all 232 joints. The original creator `Scene` idle
remains unchanged. `DragonStand`, `DragonWalk` and `DragonRun` keep their prior
clip durations and byte-identical animation values outside the wing subtrees.
`DragonFly` is now 3.30 seconds with two unchanged-frequency 1.65-second wing
beats, allowing the separately documented tail motion to flow more slowly.

The generated motion bundle SHA256 is
`d779f9ddf4419260a4b2b2771440de5d370d83aa430de51b7a38f12203a99d06`.

## Verification

`black-wing-separation.json` samples the packaged GLB, not an authoring preview:

- 132 poses across the four clips.
- 1,088 quaternion-blended flight-to-ground poses across 16 flight phases,
  four ground phases and 17 blend weights.
- Both the separate 272-vertex membrane skin and the 22,292-vertex body skin.
  A left/right wing vertex is identified by more than half its original skin
  weight belonging to the corresponding wing subtree.
- No classified wing vertex crosses the spine plane at any sampled pose.
  The smallest fitted gap between the left and right classified wing surfaces
  is 17.95 cm during a transition. Root attachment vertices remain part of
  the original torso/wing connection.
- All measured skinned coordinates are finite. The independent builder skin
  check retains the original ground clearance and flight feet remain clear.
- Ground animation values outside wing joints 96–125 are exactly equal to
  the prior motion package.

Actual packaged-model front, rear, top and side views were rendered and
visually inspected: `black-fold-front.png`, `black-fold-rear.png`,
`black-fold-top.png`, and `black-fold-side.png`. The wings remain distinct,
with a clear central back corridor and compact rearward finger folds.

Rebuild with `python3 tools/dragon-motions/build-black-dragon.py`.
Run the separation audit with
`python3 tools/dragon-motions/audit-black-wings.py --baseline previous-motion.glb`.
Omit `--baseline` if only separation needs validation. Capture the four views
with `NODE_PATH=<Playwright modules> node tools/dragon-motions/qa-black-wing-views.cjs`
and the integration checkout served on port 8584 (or set `QA_URL`).

The runtime landing transition timing is tested separately in the mounted-game
review. This asset retains the same four clip names; no extra landing clip is
required.

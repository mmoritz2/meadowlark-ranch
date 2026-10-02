# Realistic pet models

`manifest.json` lists the realistic model for each pet key. It lists the fox,
the fennec and the glimmer fox (all three from `fox.glb`, the Animated Fox), the
dog and the corgi (both from `shiba.glb`), the cat, the piglet and the goat (these
five walked by the bone-driven gait described below), among others; every pet it
does not list is drawn by `assets/features/pet-models.js`. When an entry has a file,
`assets/pet-library.js` loads it the first time that pet moves, and the drawn pet
stays on screen until the model is ready, and for good if it fails.

## Adding a model (after the owner has approved and downloaded it)

1. Inspect it and write the game copy (textures down to 1024 when a resizer is
   available):

       node tools/prepare-pet-glb.mjs <download.glb|scene.gltf> --key fox

   This writes `assets/models/pets/fox.glb` and prints a suggested manifest
   entry, with the clip map guessed from the clip names.
2. Paste the entry into `pets` in `manifest.json`, check the clip map (add
   licence, creator and source links), and add a row to `ATTRIBUTION.md`.
3. Look at it in the game: `ranch3d.html` with that pet following you.

## Entry fields

    "fox": {
      "available": true,
      "file": "fox.glb", "bytes": 0, "sha256": "...",
      "license": "CC-BY-4.0", "licenseUrl": "...", "creator": "...", "creatorUrl": "...",
      "sourceUrl": "...", "restrictions": [],
      "fit": {"height": 0.52, "scale": null, "yawDeg": null, "rotateDeg": [0,0,0],
              "groundOffset": 0, "offset": [0,0,0], "groundCurves": true},
      "clips": {"idle": "Idle", "walk": {"name": "Walk", "speed": 1, "strideM": 0.6},
                "run": "Run", "sit": "Sit", "fly": {"name": "Fly", "hz": 2.5, "glideAt": 0.3},
                "jump": {"name": "Take 001", "from": 2.0, "to": 3.1}},
      "bones": {"head": "Head", "neck": "Neck"},
      "materials": {"roughness": 0.85, "sheen": 0.4, "sheenRoughness": 0.6, "envMapIntensity": 0.5,
                    "byName": {"Eyes": {"roughness": 0.05, "clearcoat": 1}}},
      "tint": null
    },
    "glimmerfox": {"base": "fox", "fit": {"height": 0.56},
                   "tint": {"dark": "#7b7ff0", "mid": "#bfe9ff", "light": "#ffffff", "emissive": "#8fe8ff", "emissiveIntensity": 0.3}}

- `fit.height` defaults to the pet's in-game height; `yawDeg` defaults to
  facing the head bone towards +Z (glTF's own forward when there is no head bone).
- Clip states the game drives: idle, walk, trot, run, hop, swim, sit, lie, eat,
  jump, takeoff, fly, glide, land. Missing ones fall back: run to trot or walk
  sped up, hop to run or walk with the drawn hop's arc, swim to walk, glide to the
  fly clip held with its wings spread, takeoff and land to fly, sit/lie/eat/jump
  to idle, idle to the walk's first frame. A flying pet (duck, chick, owl) needs a
  fly clip or it stays drawn.
- `from`/`to` (seconds) cut one state out of a single long take.
- `restOnly: true` is for a model that can only rest (the Animated Fox is a
  sitting fox): it dissolves in, sitting where the pet stopped once it has
  turned to face you, plays its idle or sit clip, keeps the heading it sat with,
  and dissolves out where it sat when the pet moves off; the drawn pet does all
  the moving. Its `sit` and `idle` can name the same clip.
- `ears: {scale, radius, splayDeg, sides:[{base, tip}, ...]}` grows the ears in the vertex
  shader around their moving roots (the fennec from the fox). Points are in the
  file's scene frame (what the loader shows before fitting); `radius` is the
  ear's half-width at its root; `splayDeg` turns each grown ear out, away from the
  other. The shadow keeps the small ears.
- A model with no skeleton whose clip is a vertex cache (one morph target per
  frame) plays like any other clip and is measured in its posed shape. Prepare
  it with `--morph-every 2 --morph-loop 1 --quantize-morph` (fewer frames, a
  closed loop, byte offsets): the fox went from 17.5 MB to 3.5 MB.
- `speed` scales a clip's playback; `strideM` is the ground a walk or run cycle
  covers, used to match the legs to the pet's speed (measured from the clip's own
  travel when it has some).

## Bone-driven gait (`boneGait`), for rigged models without walk, trot or run clips

The dog, corgi, cat, piglet and goat are rigged but have no gait clips (the piglet
has a walk only). `assets/pet-library.js` walks them with their own bones, the way
the drawn pets (`quadGait` in `assets/features/pet-models.js`) and the horses
(`assets/artist-horse-motion.js`) walk: over the pose the idle clip gives, each
foot is planted where it lands (in the world, so a turn or a change of pace does
not drag it), swept back under the body, lifted and carried forward; a two-bone
solve on the upper and lower leg puts the ankle on that point; the foot keeps its
angle on the ground and curls in the air; the body dips, bobs and (at the gallop)
rocks, and is lowered when a foot could not otherwise reach; the spine bends into
turns, the neck nods against the step and the tail swings. Stride, duty factor and
leg order are the game's own (walk, trot, gallop), the stride length comes from the
leg length and the cadence from how fast the pet really covers the ground.

    "boneGait": {
      "legs": {"fl": ["L_shoulder_jnt", "L_elbow_jnt", "L_wrist_jnt"],
               "fr": ["R_shoulder_jnt", "R_elbow_jnt", "R_wrist_jnt"],
               "hl": ["L_hip_jnt", "L_knee_jnt", "L_ankle_jnt"],
               "hr": ["R_hip_jnt", "R_knee_jnt", "R_ankle_jnt"]},
      "body": "COG_jnt", "spine": ["spine_1_jnt", "chest_jnt"], "neck": ["neck_base_jnt"],
      "head": "head_jnt", "tail": ["tail_1_jnt", "tail_2_jnt"],
      "reach": 1, "lift": 1, "cadence": 1, "bob": 1, "over": []
    }

- `legs`: front left, front right, hind left, hind right, each `[upper, lower, foot]`
  from the body down (a longer list is allowed; the last three are used). The upper
  and lower bones bend to put the foot bone's root (wrist or hock) on the ground
  point; the foot bone and everything below it keep their angle. Left and right
  only set the order of the footfalls.
- `body`: the bone that carries all four legs (defaults to their lowest common
  ancestor); it dips and bobs. `spine`, `neck`, `tail`: lists; `head`: one bone.
- Bone names match exactly, as three.js sanitises them, or as the shortest bone
  whose name starts with the given one once case and punctuation are dropped
  (`"R_hip_jnt"` finds `R_hip_jnt.14_012`, `"thigh.B.L"` finds `thigh.B.L_028`).
  A missing bone fails the load, so the drawn pet stays.
- The gait walks the states (walk, trot, run) that have no clip; `over` lists
  states to walk by bones even when a clip exists. Its body pose is the idle clip
  (or `"idle": "@rest"`, the model's own bind pose, when it has no idle clip).
- `reach` scales the stride length, `lift` the foot lift, `cadence` the fastest
  stepping rate (a short-legged corgi steps faster), `bob` the body bob.
- `inst.gait.feet()` gives each foot's point, where it is and whether it is on the
  ground; `inst.info().gait` the current gait (QA reads both).

Other fields added with it:

- `"boneScale": {"L_elbow_jnt": 0.82, "L_ear_base_jnt": 1.4}` scales bones on top of
  the clips (the corgi's short legs and big ears, the goat kid's larger head). Use
  uniform scales on leg bones so the gait's joint maths stays exact; the fit and the
  ground are measured with the scales applied.
- `"tint": {"deep", "dark", "mid", "light"}`: `deep` is an optional fourth colour for
  the darkest texels (eyes, nose), so `dark` can be a coat colour. The tint is laid
  over the texture and the vertex colours (the piglet is painted by vertex colours).
  `"tintSkip": ["material name"]` leaves a material (the cat's eyes) untinted.
- `"autorig": {...}` (or `true`): the loaded file is first given to the function
  exported by `assets/pet-autorig.js` (`autorig` or the default export), as
  `{THREE, clone, gltf, scene, animations, entry, key, options}` on its own copy of
  the file; it returns `{scene, animations}` or changes that copy in place, and the
  result is then fitted like any other model. A missing module, a throw or a result
  with no mesh fails the load, so the drawn pet stays.
  What `assets/pet-autorig.js` reads from `autorig` (the fox, fennec, glimmer fox,
  lamb, snow hare and bunny use it): `template` (`quadruped` or `hare`);
  `forward` (the way the animal faces in the file's scene frame, else the long axis
  with the head at its higher end); `joints` (scene-frame points `hips spine chest
  neck head nose`, `shoulderL elbowL wristL toeL`, `hipL kneeL hockL toeHL`, `tail1
  tail2 tail3 tailTip`; a left joint alone is mirrored), else found by analysing a
  standing animal (the lamb); `standingBind` (the bind pose is the neutral stance:
  the hare's crouch, the lamb's stand; without it a model with listed joints is
  stood up from its bind pose, as the sitting fox is, and its bind pose becomes
  its `sit` clip); `neck`/`head`/`tail: {deg}` (carriage when stood up), `headTilt`
  (degrees, a standing bind's head), `hipK`/`shoulderK` (share of the leg's reach),
  `radii` (bone thickness per group, share of the torso's length), `grow: {bone:
  factor}` (the lamb's bigger head, baked into the bind shape), `ears` (the fennec's,
  as the old shader ears but grown in the geometry), `crop: {belowY, box, colour:
  {belowY, maxLum, minWarm, darkLum}}` (a scan's pedestal cut by height and by its
  texture colour; the cut vertices are dropped so the fit never measures them), `level: {pitchDeg, rollDeg,
  pivot}` (a scan that stood on a slope turned level about its hips, listed joints with it), `faceZ` (the scan
  turned about the vertical so it faces +Z, listed joints with it, so the library measures its real length and
  width; use with `"fit": {"yawDeg": 0}`), `soles: {y, dome, rings, rimSmooth}` (everything below that height in the
  levelled frame cut away, every crossing triangle cut cleanly along it, the rim smoothed along itself, and each
  opening closed by a sole in the fur colour just above it: rings of points, or for an outline that folds back on
  itself (a hind paw with the haunch's underside) a mesh of small pieces, lifted `dome` into the paw and weighted like
  skin, so the sole bends with the leg: the snow hare's and bunny's feet), `headYawDeg` (a scan whose head is turned
  to one side made to face forward, half of it in the neck; + turns it to the animal's left), `blend: {thigh,
  upper, neck, ...}` (near its joint a bone of that group shares its hold with its parent, so the hare's haunch
  bends instead of folding like a flap), `smooth` (weight smoothing passes), `hopHind`, `hopStride`, `hopFlex`
  (the hop: hind feet push together, the back stretches then arches, the front paws land first; every paw on the
  grass sweeps back at one rate), `boundStride`, `boundFlex` (the hare's gallop), `gait: {walk|trot|run:
  {T, duty, stride, lift, ...}}`. It writes the clips `autorig.idle`, `autorig.walk`,
  `autorig.trot`, `autorig.run`, `autorig.sit` (a sitting bind), `autorig.hop`
  (the hare's, mapped to `run` so the game adds its own hop arc) and `autorig.bound` (the hare's gallop, mapped to
  its own state `bound`: `assets/features/pet-models.js` blends it in over the hop from 5 to 9 m/s on the same hop
  phase and lowers the hop's arc); a hare's clips are raised over their paws wherever the crouch would press the
  body under the grass. `userData.autorig.hopSweep`/`boundSweep` (the planted paws' travel per hop cycle, in the
  scan's metres) tell the game how far to move a real hare while its feet are down, so its paws do not slide. Each
  gait clip moves its root one stride, which the library measures as `strideM`. Bones are
  named `ar_<joint>`. `tools/qa-pet-autorig.cjs` checks them (`QA_PARKED=1 PETS=snowhare,bunny` tests parked
  hares with the page's copy of the manifest switched on).
- `tools/prepare-pet-glb.mjs` also takes `--keep clipA,clipB` (exactly these clips),
  `--jpeg 85` (every texture no material blends by alpha stored as a JPEG),
  `--specgloss` (a KHR_materials_pbrSpecularGlossiness material, which three.js r160
  no longer reads, turned into metallic-roughness) and `--lean` (animation channels
  that never change are dropped). The Shiba went from 16.0 MB to 3.8 MB with
  `--keep "0|sitting_0,0|standing_0" --jpeg 85 --lean`, the goat from 29.9 MB to
  3.7 MB with `--jpeg 74 --lean`.

## The raccoon (`"autorig": {"template": "raccoon"}`)

`raccoon.glb` is Pigcraft's 1.89-million-triangle scan of a walking raccoon, cut down to
20,000 triangles: the 19 pieces joined, welded on position and texture coordinate and
simplified with meshoptimizer (normals and texture coordinates counted, so the texture's
many small charts keep their shape), turned 13 degrees so the body lies along +Z, the
colour texture at 2048 and the normal map at 1024 (JPEG), the roughness map replaced by one
value, the normal map's strength at 0.25 (at full strength its noisy normals, from a texture atlas
of thousands of small pieces, caught the game's rim light and frosted the fur with white flecks).
`tools/shrink-raccoon.mjs` makes it again from the original download (it needs
`@gltf-transform/core`, `meshoptimizer` and ImageMagick; see its header).

The `raccoon` template is the quadruped one with the raccoon's own defaults (each can be
set on any quadruped): `radii` for a deep furry body, short legs and a big head that turns
as one piece (the mask does not stretch); its own `gait` (a short-stepping plantigrade walk
with a crouch, a trot, a bounding gallop with a working back; the trot and gallop strides are
long for the short legs, 1.7 and 3.0 leg lengths a cycle, and the gallop's crouch, pitch and
back flex small, with `backF` moving the front paws' step back under the chest, so the low
shoulders never drop far enough for a reaching foreleg to lie flat); `stance` (a scan caught
mid-stride stands square: each pair of paws side by side at the pair's mean place, both
feet pointing straight ahead; `{dzF, dzH, width}` adjust it); `poles: "quadruped"` (elbows
back and knees forward whatever the bind shows); `tailChain` (each vertex is held by the
tail bones or the hind leg bones, never both, so the thick tail and the haunch do not drag
each other); and `sit` for a standing bind (`{hipK, flexK, frontK, hindZ}`: the hips joint
at `hipK` of its standing height, the back raised and curled until the front legs stand
straight under the chest, the hind feet flat beside the belly, the tail laid behind on the
grass, baked over the grass so nothing sinks). Its clips are baked with their own contact
with the grass, so its entry has `"groundCurves": false`. It runs beside a horse at 4 to 16
m/s, far faster than a raccoon's own pace, so its entry also has `"game": {"realGait":
{"trot": [1.0, 1.8], "run": [2.6, 3.8], "rateHi": 4.2}}`: it gallops from 2.6 m/s and may
step up to 4.2 times its clip's own rate (the game's default, 2.6, let its legs keep up with
only 5.6 m/s, and its planted paws slid about half the body's speed). `tools/qa-pet-autorig.cjs`
checks its build (low and long, short legs, arched back), its tail chain and its sit as well
as the checks every autorigged pet gets, among them, for every autorigged pet that is not a
hare, how well its paws hold the grass in the game beside a walking and a galloping horse.

## Birds (`"autorig": {"template": "bird"}`), the owl

`assets/pet-autorig.js` hands a bird to `assets/pet-bird-rig.js`, which turns a static
scan into a flying pet: it bakes the scan into the bird's frame (`forward` in the scene
frame, `crop.belowY` cuts the perch away), turns the head to face forward
(`headTwistDeg`, a twist spread down the neck from `neck.base` to `neck.head`), draws a
pair of feathered wings feather by feather (painted golden buff and barred above, white
below, fitted at the shoulders; `wing.length` is one wing, shoulder to tip, in the scan's
metres), builds 20 bones (`ab_root`, `ab_body`, `ab_chest`, `ab_neck1`,
`ab_neck2`, `ab_head`, `ab_tail1-2`, `ab_thigh/shank/foot` L and R, `ab_wing/wing2/wing3`
L and R) and writes the clips `bird.idle`, `bird.hop` (as `walk`: both feet together,
planted through the stance), `bird.takeoff`, `bird.fly`, `bird.glide` and `bird.land`.
At rest the grafted wings fold away under the scan's own folded wings. `joints`, `hop:
{T, stride, height}` and `fly: {hz, pitch}` override the defaults. The takeoff starts
with the push itself (the game lifts the bird on the first frame), and the land clip ends
folded and standing, the pose the idle starts from; both keep their root motion
(`"rootMotion": "keep"` in the clip map).

`"game"` in an entry tunes the pet in the game for its real body
(`assets/features/pet-models.js`): `skim` is the speed (m/s) above which a winged pet
takes to the air to keep up (the owl, 0.55: it flies low rather than hop fast),
`realGait` its gait speeds and top cadence (`rateHi`), and `glow: [flat, rim]` how much
of the pair glow washes the whole body and how much lights its rim (default 0.25 and
1.6). A bird with both takeoff and land clips gets its own handling there: a takeoff
snaps in and climbs from the grass, a skim is a short flight (takeoff, fly, land clips,
never a standing or hopping pose in the air), the landing's flare and wing fold follow
the height left, the hop is all or nothing, and the look at you is kept within 0.9 rad
on top of the idle's own head turns.

`tools/qa-pet-owl.cjs` checks it (it switches a parked owl on in its own copy of the
manifest; `QA_OWL_SHIPPED=1` tests the manifest as shipped; `SHOTS=<dir>` saves
pictures and every measured frame).

## Small birds: the duckling and the chick

The duckling (`duck`, a static AI scan lying on its belly) goes through the same bird rig
with these extra options: `meshName` (its meshes are `duck-body`, `duck-wings`,
`duck-legs`, `duck-eyes`); `stand: {lift, round}` (the cut belly rounded and the body
lifted onto drawn legs); `legs: {drawn, r, toes, spread, colors}` (legs and three-toed
webbed feet drawn and skinned by the rig); `tint` (the scan repainted by place on the bird,
the texture's detail kept: yellow, olive crown, `nape`, eye stripe, back, spots, bill);
`eyes: {at, r, sink}` (glossy eyes set on the scan's surface); `headRound: {c, ext, k, front,
smooth, crown, nape}` (a boxy head rounded off behind; `smooth` passes of smoothing over the
back and top of the head, `crown` and `nape` a dome from behind and a softer ledge over the
neck, the face, eyes and bill not moved); `neckFill: {y, w, z}` (a neck pinched thinner than the
head widened between two heights, so the head sits on a short thick neck);
`wing.style: "stub"` (a short downy paddle painted olive with a pale patch, instead of
flight feathers; `wing.chord` its width, `wing.flyScale` how much larger it opens in the
air); `tint.backFront` (the olive back stops at the shoulders, never wrapping onto the
breast) and `tint.detail: {all, under, front, back, flatBelow}` (how much of the scan's
own light and dark is kept over the new colour: the streaked belly, breast and back are
laid on nearly flat); `walk: "waddle"` with `waddle: {T, stride, roll, yaw, lift, bob,
crouch, lean}` (the clip `bird.waddle`) and `run` (the same, quicker and lower: `bird.run`,
mapped to the game's `run`). Each foot of the waddle and the run is put on the ground in
three dimensions: the target is a point of the bird's own unturned frame, carried into the
rolled, swayed and pitched body, the leg swung out to it at the hip and bent in its own
plane, and the foot turned back flat and pointing ahead, so the body's roll never moves a
planted sole or twists its toes. Each foot is down half the cycle, the stride is centred
under the hip, and the swing lifts the foot before it reaches forward. `idle.look` (a
smaller head turn than the owl's); `down` (a soft light at the silhouette).

The bird rig's root bone is never turned: a pose's `root` entry is the root's offset only.
(It was once baked as a rotation too, which rolled the duckling a little further each
step of the waddle and snapped it back at the loop: that, not the game, was the waddle's
skating. The owl's hop and flight had the same small roll and yaw; both are gone.)

The chick (`chick`, kenchoo's rigged chick) uses `"rigged": true`: its own skeleton and its
own idle are kept, and `bird.scurry`, `bird.run`, `bird.takeoff`, `bird.fly` and
`bird.land` are posed on its own bones (`bones` names them, left side only; `scurry` and
`run: {T, stride, lift, bob, lean, crouch}`; `fly: {hz, amp, raise, scap, pitch,
wingScale}`: `pitch` + tips the body forward and the stubs then beat about the tipped
body's own long axis, `scap` is the share of the raise the scapula takes, the legs are
tucked). `reweight: [{from, to, above, xBelow}]` mends the file's skin weights: kenchoo's
chick has about 260 vertices high on the rump weighted to the left knee and hip, which
pulled a thin spike out of the rump on every left stride and in any forward tilt; they go
to `Root_M`. Its skin is repainted as yellow down with a sheen (`down`), and
`down.shells: {n, len, density, droop, far}` draws fine strands of down standing off the
skin: `n` copies of the skin pushed out along the normal, cut to strands by a cellular
pattern fixed to the bind pose, none on the legs, beak or eyes, and dropped beyond `far`
metres from the camera (the outer layers first).

`"game"` for both: `skim` 3.6 with `skimHold` 0.4 (they walk, then run, beside a walking
horse and never run faster than 3.6 m/s, which their legs can step; they take to the air only
after running 0.4 m further than their legs can cover at 3.6 m/s, and only beside a horse
faster than 2.9 m/s or when more than 6 m behind, so a galloping horse has them flying beside
it; once up they fly at least 1.2 s), `turn` 16 (how fast, in rad/s, the pet swings round, so
it does not crab sideways on planted feet; a pet with `turn` faces the way it moves down to
0.12 m/s, steps a short slow shuffle backwards with its clips reversed, and stays at its spot
until the spot is 0.32 m away) and `realGait` (the duckling's run from 1.0 to 1.8 m/s, the
chick's from 0.7 to 1.3 m/s, both with `rateHi` 3.5 and `hzHi` 12, a cap of 12 strides a
second so the legs never strobe). A pet walked by its own clips steps by the ground it
actually covers in the direction it faces, with the stride its legs show this frame
(including a clip still fading out); teleports and nudges are not walked. `"skim": false`
would keep a pet on the ground except when the horse flies. The walk clips are long (`T` 0.5
and 0.4) so the game's slowest cadence, half the clip's own, still matches a slow walk of
about 0.2 m/s without the feet sliding; the clips are driven by the stride, so `T` does not
change how fast they step.

`tools/qa-pet-birds.cjs` checks both (`PETS=duck` or `PETS=chick` for one; a parked bird is
switched on in the page's copy of the manifest, `QA_BIRDS_SHIPPED=1` tests it as shipped;
`SHOTS=<dir>` saves pictures and the measured frames). Its gait checks measure the soles
(each foot's lowest vertices), not the ankle bone: in the library each foot must be down at
least 35% of the walk and the run cycle, a planted sole must slide under 15% of the travel
and wander under 10% of the stride, and the swing must lift it 6% to 20% of the hip's
height; in the game each sole within 8 mm of the terrain under it must slide under 15% of
the body's travel, on flat ground and on a slope. A stretch check poses every clip at 8
phases and fails on any skin edge over 4 times its idle length (the chick's old rump spike
measured 66 to 99 times).

Status: both stay parked (`"available": false`).
- The chick looks right (downy close up, a chick at riding distance) and its clips pass
  every check, but in the game its feet still slide at times: the follow logic sometimes
  moves the pet faster than the speed that drives its stride (bursts of 1 to 1.3 m/s while
  the declared speed stays at 0.6), and a dash over 4 m/s flaps it up for a moment. Two
  of the last three runs failed the in-game slide check (20% and 25%; the third 11.5%).
  The fix is in `assets/features/pet-models.js` `driveReal`: advance a clip gait's phase by
  the distance the pet really covers (as bone-walked bodies already do with `R.mv`).
- The duckling's rig passes every check, but the AI scan's head is flat-topped and
  box-like seen head on and from behind, there is still a faint ledge where the chin meets
  the neck, and the body's texture is smeared in places. Rig work cannot fix that; a
  better duckling scan can. It has the same in-game slide bursts as the chick.

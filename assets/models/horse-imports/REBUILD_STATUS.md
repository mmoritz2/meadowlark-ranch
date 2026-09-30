# Horse and dragon rebuild status

This branch is an isolated art and motion review. The live site was rolled back
after the imported roster failed visual review. Nothing in this branch is ready
to replace the public stable as a whole.

The latest [white-horse motion kit](../../../review/native-horse-kit/README.md)
preserves two independently checked private studies: refined slow Walk with
hoof rollover and a true diagonal slow Trot. Both retain the native 677-joint
skin and upright proportions with responsive body/head/groom. Walk's folded
apex remains held too long; Trot's head response remains conspicuous. Full
naturalism, faster gaits, rider/rein fit and the remaining roster are still open.
The [native travel study](../../../review/native-horse-travel/README.md) and
[clip controller](../../../review/native-horse-controller/README.md) preserve
measured speed and rider/stirrup integration evidence without activating it in
the game.

## What failed

- The 80 imported identities point to 36 distinct body resource paths (38
  rigged resources when separate components and studies are counted), many
  driven by a shared 40-joint horse gait solver. The leg motion, weight transfer and hoof contact
  are visibly poor, especially in faster gaits. Passing numerical joint and
  ground checks did not make the animation believable.
- The approved WildMesh white Western source has a much richer 677-joint rig and
  creator-authored Idle and Walk. Its source Walk still fails the low-posture review. The converted 40-joint variants discarded that animation
  and merged the source skin weights. Restoring native motion to breed variants
  requires rebuilding their skins against the full rig, then visual review.
- The current Fjord, Arabian and pastel unicorn foundations also need static art
  work. An Iceland-derived Fjord body looked more anatomical, but attempts to
  make its cropped two-tone mane from existing cards looked artificial. No
  browser-only foundation experiment is a roster replacement.
- A 168-frame Breed Studio audit across all 36 body paths and six extra fantasy
  variants found a roster-wide stiff walk, crumpled wings on the 13 black-dragon
  identities, weak Arabian/Fjord/pastel foundations, and flat feather wings.
  See [the visual review](../../../tools/qa-roster-visual-review.md) for family
  counts, representative frames, and the limits of the capture.
- User review of the experimental Bay also identified a low crouching torso,
  rigid mane and tail at speed, and nearly still torso, head and neck. These
  are release blockers in addition to leg geometry. The current imported groom
  facade has no independent update and the 40-joint solver uses very small
  secondary joint angles; both need a full-cycle visual check at each gait.
- A full-rig Bay proof kept the creator Walk and all 677 joints, restoring
  visible body/head movement, but reproduced the low posture. In the Bay proof,
  the pelvis joint drops 5–11 cm and a trunk spine joint drops 8–10 cm from
  Idle across the Walk; the head joint drops 21–25 cm. The same low carriage
  appears in the intact white source. A previously cited body vertex is mostly
  neck-weighted and must not be used as a withers measurement. A private global
  lift and leg IK trial then left planted hooves hovering or penetrating the
  ground. A second pelvis/spine/neck curve-bias correction improved posture,
  but 164 of 278 source-planted hoof samples still hovered more than 1 cm
  after an offline stance solve. The source motion needs a deeper correction;
  see the
  [Bay rig proof](../../../review/bay-native-proof/README.md) and
  [Walk correction failure](../../../review/walk-correction-failure/README.md).
- The original 3DHaupt dragon has a 232-joint skin and a creator idle clip, but
  no source walk, run or flight clips. The earlier 68-joint horse conversion
  discarded source animation and folded the wings poorly.

## Preserved review candidates

- The intact [white Western horse](wildmesh-white-western/game/native-candidate/README.md)
  is available for private review with its 677-joint source rig, materials,
  tack and creator Idle/Walk. Its Walk crouches too low and is not approved for
  gameplay. Faster gaits are unsupported until authored and approved; rider
  mounting and Ranch performance are untested. A separate
  [mane/tail study](../../../review/horse-secondary-motion.md) tests 51 detail
  joints without changing the creator body motion.
- The original 3DHaupt dragon is available for private review with its 232-joint
  native rig and sole creator idle. Its 2K display candidate preserves the source
  rig and animation; the charcoal material treatment is only an in-memory preview.
- The free [European Dragon](https://sketchfab.com/3d-models/european-dragon-82f393a2e6c048ad80c171ce3b3a7b87)
  is a separate candidate with 169 joints and five creator clips (Idle Stand,
  Idle Sit, Walk, Run, Fly). The original is retained locally; a candidate GLB
  reduces six textures from 4K to 2K while preserving rig, mesh and animation
  payloads. Walk quality and flight framing still need approval. Its source,
  license, creator records and hashes are in
  [provenance.json](european-dragon/provenance.json).
- The Studio now exposes the approved native Western tack on eligible horses;
  the white Lipizzaner derivative shows it by default in this branch.
- The previously shown Mesh2Motion horse motion source is acquired for private
  evaluation: 56-joint source rig, 14 clips including Walk, Trot and Run, with
  its pinned CC0 license and hash preserved in
  [the source record](../horse-motion-sources/mesh2motion/README.md). Its sample
  model is stylized; a realistic-white-horse retarget is a separate unapproved
  experiment. The [source gait audit](../../../review/mesh2motion-source/README.md)
  found that the source Trot is a lateral pace, and all three gait clips need
  hoof-contact and loop-seam correction. No native Canter or Gallop is supplied
  by this source. The [realistic white retarget trial](../../../review/mesh2motion-retarget/README.md)
  preserved all original meshes, skin weights, binds and 677 joints, and closed
  the new loop endpoints. It still failed intended contact: the Walk right hind
  exceeded a 15mm tolerance in 55 of 65 source near-ground samples, and both Run
  hindfeet failed all corresponding samples. The fitted failed GLB stays in
  ignored output; no roster asset or manifest uses it.

Open [the private review landing page](../../../review/index.html) through the local
preview server to compare the source-rig white horse and both dragons. These
preview files are not the public stable and do not offer approved ride movement.
The [motion source shortlist](MOTION_SOURCE_SHORTLIST.md) records other free
gait references shown to the user and whether they have been downloaded.

Before release, each claimed gait needs a complete multi-angle cycle review,
hoof-contact and torso-height checks, visibly responsive but anatomically
believable mane/tail and head/neck/torso motion, rider/tack checks, acceptable
browser performance, accurate
breed-specific silhouettes, and source/credit verification. Do not infer those
conditions from clip presence or automated numerical checks alone.

## Target-authored slow Walk milestone

The [white Western horse slow Walk](../../../review/target-native-walk/README.md)
now uses its original standing proportions, all 677 skin joints, and separate
body/head/neck/groom/tail motion. In 256-phase independent checks every stance
sole stays within −1.23 to +6.83mm of its fixed ground; the trunk remains upright.
This is a private 0.55m/s Walk proof. Its fore swing stays rather straight, hoof
rollover is missing, some IK bounds are touched, and rider/game travel/faster
gaits are untested. A Bay pilot also passes contact but still has mechanical
limb poses. Neither proof is approval for the full 80-identity roster.

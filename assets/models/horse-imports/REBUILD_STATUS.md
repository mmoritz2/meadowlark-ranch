# Horse and dragon rebuild status

This branch is an isolated art and motion review. The live site was rolled back
after the imported roster failed visual review. Nothing in this branch is ready
to replace the public stable as a whole.

## What failed

- The 80 imported identities point to 36 distinct body resource paths (38
  rigged resources when separate components and studies are counted), many
  driven by a shared 40-joint horse gait solver. The leg motion, weight transfer and hoof contact
  are visibly poor, especially in faster gaits. Passing numerical joint and
  ground checks did not make the animation believable.
- The approved WildMesh white Western source has a much richer 677-joint rig and
  creator-authored Idle and Walk. Its source Walk keeps a hoof on the floor over
  16 measured phases. The converted 40-joint variants discarded that animation
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
- The original 3DHaupt dragon has a 232-joint skin and a creator idle clip, but
  no source walk, run or flight clips. The earlier 68-joint horse conversion
  discarded source animation and folded the wings poorly.

## Preserved review candidates

- The intact [white Western horse](wildmesh-white-western/game/native-candidate/README.md)
  is available for private review with its 677-joint source rig, materials,
  tack and creator Idle/Walk. Faster gaits are unsupported until authored and
  approved; rider mounting and Ranch performance are untested.
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

Open [the private review landing page](../../../review/index.html) through the local
preview server to compare the source-rig white horse and both dragons. These
preview files are not the public stable and do not offer approved ride movement.

Before release, each claimed gait needs a complete multi-angle cycle review,
hoof-contact and rider/tack checks, acceptable browser performance, accurate
breed-specific silhouettes, and source/credit verification. Do not infer those
conditions from clip presence or automated numerical checks alone.

# Realistic pet model attribution

These credits cover the licensed source models used for the realistic pets and
their Meadowlark Ranch adaptations. The list of models the game loads is
[manifest.json](manifest.json); each model's verified record sits next to it as
`<key>.provenance.json`. Original creators are credited for their source art;
Meadowlark Ranch authored the changes described below. The downloaded originals
are kept unchanged outside the published files.

One model is in the game so far: the Animated Fox, used for the fox, the fennec
and the glimmer fox. Every other pet is drawn by the game itself
(assets/features/pet-models.js), with no third-party art.

| Pet | Original asset | Creator | License | Verified public provenance |
| --- | --- | --- | --- | --- |
| Fox, Fennec, Glimmer fox | [Animated Fox](https://sketchfab.com/3d-models/animated-fox-f49753fad99c47b69bdfe80907c7e4f9) | [igor-lir](https://sketchfab.com/igor-lir) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | [Record](fox.provenance.json) |
| Lamb (lamb.glb) | [Animated Sheep](https://sketchfab.com/3d-models/animated-sheep-b99698502dea4905b916fce0bcf2dfc0) | [igor-lir](https://sketchfab.com/igor-lir) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | download receipt, sha256 f7b6d31a36eb3d3e5a9dddf4069af1f470e2d11eb3cc8e66cff65717ff74d762 |
| Snow hare, Bunny (snowhare.glb) | [Arctic Hare](https://sketchfab.com/3d-models/arctic-hare-48caf8a64509421b9d8845e8b95bdac1) | [Carnegie Museum of Natural History (CMP Innovation Studio)](https://sketchfab.com/cmp_innovation_studio) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | download receipt, sha256 359169d82963e2efa4b9ad644d4c440d26ccece657e66e09735f80c8eb82afe8 |
| Emberling (emberling.glb) | [European Dragon](https://sketchfab.com/3d-models/european-dragon-82f393a2e6c048ad80c171ce3b3a7b87) | [Regina Cachoa (ReginaCachoa)](https://sketchfab.com/ReginaCachoa) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | [Record](emberling.provenance.json) |
| Puppy (golden-cream) and Corgi (red-and-white, short legs, big ears), both shiba.glb | [Animated Dog Shiba Inu](https://sketchfab.com/3d-models/animated-dog-shiba-inu-9abfce885a834399b2c3ccaed51cd474) | [quander](https://sketchfab.com/quander) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | Source file sha256 ed5f9c0b... in manifest.json ("source") |
| Kitten, grey (cat.glb) | [Bicolor Cat](https://sketchfab.com/3d-models/bicolor-cat-e623a618ca344a8393d7ba4d63ec23cf) | [kenchoo](https://sketchfab.com/kenchoo), after "Fripouille" by guillaume.bolis | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | Source file sha256 baf23535... in manifest.json ("source") |
| Piglet (piglet.glb) | [Piglet](https://sketchfab.com/3d-models/piglet-8343f141936f4c799ed980a3c7c3ae27) | [sgrosjean](https://sketchfab.com/sgrosjean) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | Source file sha256 79e393fe... in manifest.json ("source") |
| Goat kid (goat.glb) | [Goat](https://sketchfab.com/3d-models/goat-5d7431517b634f4e9e8c0f3729cd9c59) | [GerardoA400](https://sketchfab.com/GerardoA400) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | Source file sha256 27805596... in manifest.json ("source") |
| Mossglow Fawn (mossfawn.glb) | [Fawn_A1](https://sketchfab.com/3d-models/fawn-a1-b6cf4d29b8e2478e9c00f5e17d02c957) | [Assets_Animated](https://sketchfab.com/Assets_Animated) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | [Record](mossfawn.provenance.json) |
| Canyon Wyvern (wyvern.glb) | [Prowler Dragon Variant Rig](https://sketchfab.com/3d-models/prowler-dragon-variant-rig-7ee71aaf323d426bbbdf28d73d55bbd9) | [DM-913 (SuperKapoo913)](https://sketchfab.com/SuperKapoo913) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | [Record](wyvern.provenance.json) |

Credit line: "Animated Fox" by igor-lir (https://sketchfab.com/igor-lir), CC BY 4.0,
adapted (given a skeleton, stood up and walked by Meadowlark Ranch's autorig, scaled,
recoloured) for Meadowlark Ranch.

Credit lines (dog, corgi, cat, piglet, goat):
"Animated Dog Shiba Inu" by quander (https://sketchfab.com/quander), CC BY 4.0, adapted
(recoloured golden-cream for the puppy; recoloured, legs shortened and ears enlarged for
the corgi; scaled; textures to 1024 JPEG; clips trimmed to standing and sitting; walked,
trotted and galloped by the game's bone gait) for Meadowlark Ranch.
"Bicolor Cat" by kenchoo (https://sketchfab.com/kenchoo), after "Fripouille" by
guillaume.bolis, CC BY 4.0, adapted (recoloured grey, scaled, textures to 1024 JPEG,
walked by the game's bone gait) for Meadowlark Ranch.
"Piglet" by sgrosjean (https://sketchfab.com/sgrosjean), CC BY 4.0, adapted (material
converted to metallic-roughness, recoloured pink, scaled, trotted and galloped by the
game's bone gait) for Meadowlark Ranch.
"Goat" by GerardoA400 (https://sketchfab.com/GerardoA400), CC BY 4.0, adapted (scaled down
to a kid with a larger head, textures to 1024 JPEG, walked by the game's bone gait) for
Meadowlark Ranch.

<!-- One row per model, for example:
| Fox, Glimmer fox | [Model title](https://sketchfab.com/3d-models/...) | [Creator name](https://sketchfab.com/creator) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | [Record](fox.provenance.json) |
-->

Allowed licences: CC0, CC BY 3.0 or 4.0, and CC BY-NC 4.0 only when the entry
carries the `noncommercial` restriction. Editorial, store-only or engine-locked
licences are not used. A source marked NoAI is never passed through AI tools.

## Changes made by Meadowlark Ranch

For each model, list what was changed. The usual set, when it applies:

- normalised to metres, facing +Z, feet on the ground, at the pet's in-game size
  (the chick and the duckling are larger than life so they read from the saddle);
- kept only the clips the game uses and renamed them to its states (idle, walk,
  run, hop, swim, sit, takeoff, fly, glide, land); the clips' own travel (root
  motion) is removed at load because the game moves the pet itself;
- textures resized to at most 1024 pixels;
- materials given the game's rim light and the market's pair glow;
- the glimmer fox is the fox model recoloured by brightness to its pale blue coat
  with a soft glow; it inherits the fox model's licence and credit.

### Animated Fox (fox.glb)

The download is a sitting red fox whose single clip (a 5.6 s idle: breathing,
looking round, the tail) is baked as one morph target per frame, with no
skeleton. Meadowlark Ranch made these changes:

- kept every second frame of the 134 (the in-between is blended), eased the
  last second back onto the first frame so the idle loops, and stored the
  frames as normalised bytes (KHR_mesh_quantization): 17.5 MB to 3.5 MB;
- texture kept at its own 512 pixels, with mipmaps turned on;
- scaled to each pet's size and turned to face +Z at load; given sheen, the
  game's rim light and the market's pair glow;
- given a skeleton at load by assets/pet-autorig.js (Meadowlark Ranch's own
  code): 21 bones fitted to the sitting fox, smooth skin weights, and the
  vertex-cache frames set aside; the fox is stood up from its sitting pose and
  walks, trots, gallops and idles with clips the autorig writes (paws planted by
  IK), and sits in its own sitting pose;
- the fennec is the fox 0.42 m tall, recoloured by brightness to a sand-cream
  coat, with its ears grown 1.85 times and splayed out in the geometry;
- the glimmer fox is the fox 0.56 m tall, recoloured to pale icy blue with a
  soft glow, beside the game's own halo and sparkles.

The original download (sha256
7dc77a9962b9946bcfbc1d994782c55290ae220af75487c6ef881be2200e33f8,
17,523,344 bytes) is kept unchanged outside the published files.

### Animated Sheep (lamb.glb), the Lamb

Credit line: "Animated Sheep" by igor-lir (https://sketchfab.com/igor-lir), CC BY 4.0,
adapted (vertex-cache animation removed, given a skeleton and walked by Meadowlark
Ranch's autorig, head enlarged and scaled to a lamb) for Meadowlark Ranch.

- the baked vertex-cache walk (one morph target per frame) removed: 6.7 MB to
  0.9 MB; texture kept at its own 512 pixels, with mipmaps turned on;
- given a skeleton at load by assets/pet-autorig.js, found by analysing the
  standing sheep's shape (body axis, four leg columns, belly, head, tail), with
  smooth skin weights; walks, trots, gallops and idles with clips the autorig
  writes; the head enlarged 1.18 times in the geometry and the whole scaled to
  a 0.6 m lamb.

The original download (sha256
f7b6d31a36eb3d3e5a9dddf4069af1f470e2d11eb3cc8e66cff65717ff74d762,
6,700,772 bytes) is kept unchanged outside the published files.

### Arctic Hare (snowhare.glb), the Snow hare and the Bunny

Credit line: "Arctic Hare" by Carnegie Museum of Natural History (CMP Innovation
Studio), CC BY 4.0, adapted (pedestal removed, given a skeleton and a hop by Meadowlark
Ranch's autorig, texture to 1024, scaled) for Meadowlark Ranch. The bunny is the same
model recoloured cream and scaled to 0.38 m. Both entries are parked for now
(`"available": false` in manifest.json), so the game still draws its own snow hare and
bunny; the file ships so they can be switched on once the feet are fixed.

- a museum scan of a real specimen on a rock: the texture resized from 4096 to
  1024 pixels (3.6 MB to 1.2 MB); at load the rock is cut away by its colour
  and height;
- given a skeleton at load by assets/pet-autorig.js, fitted to the crouching
  hare, with smooth skin weights; it idles (breathing, a head turn, the tail)
  and hops with a clip the autorig writes, in step with the game's own hop arc.

The original download (sha256
359169d82963e2efa4b9ad644d4c440d26ccece657e66e09735f80c8eb82afe8,
3,566,448 bytes) is kept unchanged outside the published files.

### European Dragon (emberling.glb), the Emberling

Credit line: "European Dragon" by Regina Cachoa (https://sketchfab.com/ReginaCachoa),
CC BY 4.0, adapted (scaled to a baby, retextured to 1024, clips trimmed, ember glow)
for Meadowlark Ranch.

- kept its five clips (Fly, Walk, Run, Idle Stand renamed Idle, Idle Sit renamed
  Sit) and dropped the animation keys that never move or that a straight line
  between their neighbours reproduces (2,509 channels to 553);
- six 4096-pixel textures resized to 1024 and stored as JPEG: 28.7 MB to 3.1 MB;
- scaled to 0.6 m (a baby dragon beside the horse), facing +Z, feet on the ground;
  a faint warm emissive on the body, the game's rim light and pair glow;
- the game adds a glow under its throat and belly, sneeze sparks and smoke, and an
  ember trail in the air; it flies with its own Fly clip.

Original download: european_dragon.glb, 28,712,836 bytes, sha256
27571241712334db4f05d65623ad627024d57730554a74b7902029c9c95fd5f5 (kept unchanged
outside the published files).

### Fawn_A1 (mossfawn.glb), the Mossglow Fawn

Credit line: "Fawn_A1" by Assets_Animated (https://sketchfab.com/Assets_Animated),
CC BY 4.0, adapted (scaled, retextured to 1024, clips trimmed, glowing spots and
fireflies) for Meadowlark Ranch.

- kept four of its nine clips (Walk, Run, Idle, Swim, renamed from Fawn_A_*) and
  dropped the animation keys that never move or that a straight line between their
  neighbours reproduces (1,118 channels to 223);
- three 2048-pixel textures resized to 1024; the colour map kept as PNG for the
  fur-edge cutouts (alpha blend changed to an alpha test at 0.5, so it needs no
  sorting), the normal map stored as JPEG, and the emissive map (a copy of the
  colour map) dropped: 20.4 MB to 2.4 MB;
- scaled to 0.72 m, facing +Z, feet on the ground; given sheen, the game's rim
  light and pair glow;
- the game adds soft glowing spots along its back, fireflies round it and petals
  from its hooves when it bounds.

Original download: fawn_a1.glb, 20,392,576 bytes, sha256
967be65a9ad8a2578caef196020c7c4f0c88db2c6f9e8c56c69dad9061278638 (kept unchanged
outside the published files).

### Prowler Dragon Variant Rig (wyvern.glb), the Canyon Wyvern

Credit line: "Prowler Dragon Variant Rig" by DM-913 (https://sketchfab.com/SuperKapoo913),
CC BY 4.0, adapted (scaled, retextured to 1024, hidden rig shapes removed, a flight
and an idle animated by Meadowlark Ranch) for Meadowlark Ranch.

- removed the fifteen invisible rig-control shapes (a fully transparent material)
  that shipped in the file;
- kept its Walk; its Landing and PoseLib clips were used only as reference and
  are not shipped;
- a looping Fly clip authored by Meadowlark Ranch: the wings spread as in the first
  frame of the Landing clip, the body held level as in the Walk, and the wings
  flapped at the shoulder with the elbow and the hand following a little later;
- an Idle authored by Meadowlark Ranch from the first frame of the Walk: the chest
  breathing, the neck and the tail swaying;
- four 2048-pixel textures resized to 1024 (the colour map kept as PNG for its
  alpha cutouts, the others JPEG), redundant animation keys dropped: 17.0 MB to
  3.4 MB;
- scaled to 0.55 m at the shoulder, facing +Z, feet on the ground.

Original download: prowler_dragon_variant_rig.glb, 17,004,720 bytes, sha256
04483a45971dc5f015763d4d4109ef977852537967eab9e0e89e2ab7be504e4f (kept unchanged
outside the published files).

## Restrictions

- Noncommercial sources are flagged with `"restrictions": ["noncommercial"]` in
  the manifest entry, and derivatives such as the glimmer fox inherit the
  restrictions of the model they are made from.

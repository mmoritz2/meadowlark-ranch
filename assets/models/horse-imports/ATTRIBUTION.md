# Imported horse asset attribution

These credits cover the nine acquired source assets and their Meadowlark Ranch
adaptations. Current acquisition and publication status is recorded in
[README.md](README.md) and [the prepared catalog](prepared-manifest.json).
Original creators are credited for their source art; Meadowlark Ranch authored
the changes described below. The preserved originals remain unchanged.

| Original asset | Creator | License | Verified public provenance |
| --- | --- | --- | --- |
| [HORSE - Realistic 3D Model (DEMO FREE)](https://sketchfab.com/3d-models/horse-realistic-3d-model-demo-free-65d6a70a6721495f938c93e80a5998e4) | [WildMesh 3D](https://sketchfab.com/WildMesh_3D) | [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/) | [Record](wildmesh-white-western/provenance.json) |
| [HORSE [DRAFT HORSE]](https://sketchfab.com/3d-models/horse-draft-horse-725065392aad4b04b7a172f8cd965497) | [BlueMesh](https://sketchfab.com/VapTor) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | [Record](bluemesh-draft/provenance.json) |
| [Unicorn (of Jill Janus)](https://blendswap.com/blend/11586) | ikkiz | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | [Record](ikkiz-unicorn/provenance.json) |
| [CGC Classic: Feathery Wing](https://blendswap.com/blend/21839) | CG Cookie / David Ward | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | [Record](cgcookie-wings/provenance.json) |
| [Horse Skeleton](https://sketchfab.com/3d-models/horse-skeleton-eaca504567604e879b8ab2cf2763025e) | [Diego Luján García](https://sketchfab.com/diegoluga) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | [Record](horse-skeleton/provenance.json) |
| [Black Dragon with Idle Animation](https://sketchfab.com/3d-models/black-dragon-with-idle-animation-fb0053a2e59b43868e934c239bf4eb36) | [3DHaupt](https://sketchfab.com/dennish2010) | [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/), plus the creator listing's **NoAI** restriction | [Record](black-dragon/provenance.json) |
| [Arabian Horse](https://pinshape.com/items/114373-3d-printed-arabian-horse) | [jesusrhino](https://pinshape.com/users/2550443-jesusrhino) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | [Record](arabian-sculpt/provenance.json) |
| [Fjord Pony Horse](https://www.cgtrader.com/free-3d-print-models/art/sculpture/fjord-pony-horse) | [TheBigWolfy](https://www.cgtrader.com/designers/thebigwolfy) | [CGTrader Royalty Free License, NoAI](https://www.cgtrader.com/pages/terms-and-conditions) | [Record](fjord-sculpt/provenance.json) |
| [unicorn](https://www.cgtrader.com/free-3d-models/animal/mammal/unicorn-3f699121-8562-436d-a0a3-9c130380790c) | [maryna287887](https://www.cgtrader.com/designers/maryna287887) | [CGTrader Royalty Free License, NoAI](https://www.cgtrader.com/pages/terms-and-conditions) | [Record](pastel-unicorn/provenance.json) |

The four Sketchfab originals embed their creator, source and Creative Commons
license metadata. The ikkiz and CG Cookie/David Ward archives include bundled
license documents establishing CC BY 3.0. The public records identify the
verified original filenames, sizes and SHA-256 hashes without local download paths.

## Changes made by Meadowlark Ranch

- **WildMesh 3D:** converted the detailed body, eyes, groom and western equipment
  to an anatomical 40-joint game rig. Preserved source UV detail and material maps,
  and kept the preferred white western appearance available. Authored distinct
  breed proportions, regional head/neck/body/limb shapes, groom changes, coats and
  saddle/bridle contacts for the breed derivatives. Added new ground locomotion
  and jump clips. The original demo's Idle and Walk remain in the original asset;
  this use does not include the creator's paid animation package.
- **BlueMesh:** normalized physical scale, reposed and rebound the source body,
  eyes and groom to anatomical 40-joint rigs. Corrected detached source eye
  placement and skin ownership across UV seams. Authored five distinct draft
  conformations, coat variants and grooming adjustments, plus new locomotion and
  jump clips. Source normal/roughness/metallic and eye maps retain their source
  detail; new coat atlases are identified as adaptations.
- **ikkiz:** converted the source body and horn from the legacy Blender scene,
  reposed the derivative and authored a 40-joint anatomical rig and new motions.
  Baked original diffuse colours in the existing UVs and simplified eye glass.
  Converted evaluated mane, tail, ear hair, feathering and eyelashes to tapered
  crossed ribbons with reduced child density and path sampling. The longest
  tail fiber ends were lifted smoothly by up to 65 mm for ground clearance.
  Packed flow/bump images were not treated as colour maps. The source file and
  strand roots remain unchanged.
- **CG Cookie / David Ward:** mirrored the actual wing into a paired component,
  preserved the long feather geometry and gave each feather a rigid joint on a
  105-joint game rig. Authored fold, takeoff, flight and landing motion and attached
  the wings to the horse's chest/withers transform. The original archive lacks
  `wing_alphamap.png` and `wing_texturemap.jpg`; the game uses newly authored
  feather materials. The 1,000 source down strands were omitted because their
  placement could not be verified. These limitations are retained in the
  [component documentation](cgcookie-wings/game/README.md).
- **Diego Luján García:** normalized the source anatomy to physical metres,
  skinned its real bone surfaces to a new 40-joint anatomical rig and corrected
  rib, fetlock and hock attachment ownership. Authored locomotion, jump and
  spectral material/effect adaptations. The original source is a static,
  unskinned anatomy model with no animation clips.
- **3DHaupt:** normalized the genuine dragon to physical metres and omitted its
  decorative showcase floor. Preserved source body/wing topology, UVs, material
  definitions and texture content, with conventional resizing of large textures.
  Rebound the body to forty anatomical joints while retaining twenty-eight source
  wing joints. Adapted low claw weights for floor contact and authored ground,
  jump, wing fold, takeoff, flight and landing motions. The original Scene clip
  remains in the preserved acquisition. Conversion, image resizing, skin
  evaluation, animation baking and rendering used ordinary numerical tools;
  no generative AI asset or image tools were used for this NoAI source.
- **jesusrhino:** adapted the prancing Arabian sculpture to a standing game bind
  using mirrored planted-side forequarter and hind-limb surfaces from the same
  source. Ordinary voxel joining, local fairing and topology reduction repaired
  fused moving surfaces; exact original vertices and facial detail are not claimed.
  The head, torso and high-tail morphology remain source-derived. Omitted the
  separate display base, normalized to 1.50 m at the withers, authored new UVs,
  copper/dark-tail paint and 630 fine mane/tail strands, and added an anatomical
  40-joint rig with nine clips baked at 120 Hz. The original OBJ has no painted
  maps or separate groom. Its rounded upper-hip depression and sculpted surface
  relief remain documented source-adaptation limits.
- **TheBigWolfy:** reduced the genuine 12,963,748-triangle Fjord sculpture with
  ordinary numerical mesh tools and retained all 109,999 faces of the game LOD.
  Fitted it uniformly to 1.42 m at the withers and authored UVs, dun/dorsal-stripe,
  hoof, muzzle and eye paint. The upright mane and long tail are original sculpted
  geometry, with newly authored two-tone paint. Added an anatomical 40-joint rig,
  nine 120 Hz clips and a clearance adjustment that rotates the actual tail only
  when needed during motion; the source-derived rest shape remains unchanged.
  Original STL bytes are preserved.
- **maryna287887:** normalized the source unicorn to 1.60 m at the withers,
  preserving original body, horn, eye and mouth geometry, UVs, material definitions
  and all fourteen encoded source images. Adapted native Blender weight ownership
  to an anatomical 40-joint rig and authored nine 120 Hz clips. Recovered actual
  scene particle groom as ribbons, retaining sampled paths and root UV colour
  while reducing child density; lower fur receives at most 2.77 mm of floor
  clearance adjustment. Ribbon shading and reduced density are explicit game
  adaptations, rather than identical offline fiber rendering. The large Alembic
  caches were preserved but were not needed for conversion.

## Restrictions and combined assets

WildMesh 3D and 3DHaupt assets retain **noncommercial** use restrictions.
The dragon also retains the creator listing's separate **NoAI** restriction.
These restrictions continue to apply to the source art within adapted models,
including recolours, fantasy effects and combined winged horses. The remaining
five Creative Commons sources use the attribution licenses linked above; credit and adaptation
statements remain attached to their copies and derivatives.

A Pegasus or alicorn using CG Cookie/David Ward wings requires credit for both
the body source and the wing source. Its body license remains applicable: a
WildMesh-based winged horse retains CC BY-NC 4.0 even though the wing component
uses CC BY 3.0. Body and component sources are recorded separately in the
prepared catalog.

All nine approved originals are acquired and preserved. Candidate conversion,
mounted integration and publication are separate checks; their current status
is recorded in the import README and prepared catalog.

The two CGTrader assets retain Royalty Free incorporated-product and NoAI terms.
Their game derivatives use the proprietary encrypted resource format with
embedded buffers, maps and any custom-coat image. Runtime keys and decrypted
memory remain discoverable; this is an extraction safeguard rather than strong
client DRM. Actual Fjord and pastel-unicorn packages have focused local Ranch
and Studio validation; final complete-roster activation and publication are
recorded separately. Ordinary
numerical mesh, paint, skinning, baking and rendering tools are used for these
sources; no generative AI asset or image tools are used. Actual adaptation and
publication status remain in [catalog.json](catalog.json).

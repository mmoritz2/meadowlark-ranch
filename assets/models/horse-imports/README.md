# Approved horse imports

User approved starting the shortlisted horses on 29 September 2026. The preferred
appearance is **WildMesh 3D's white horse with brown western tack**, not the
fdoss001 pinto horse. Candidate records are in `catalog.json`; the complete
existing roster is covered in `roster-plan.json`.
The plan covers **80 identities**: 45 in the base manifest and 35 added by the
active feature packages, including seasonal, club, summoning and breeding horses.
There are 31 real horse identities and 49 fantasy identities. The pre-replacement
roster used 25 authored body models. Each feature alias is resolved to its actual body.

## Rigging progress

`replacement-plan.json` assigns all 80 existing identities to the nine approved
sources. All nine originals are acquired, all 80 identities have explicit available
mappings, and the Ranch and Studio now use the imported catalog by default.
The complete local 80-identity Ranch and Studio runs pass, with no page errors or
startup warnings. The resource preflight confirms 38 unique animated resources
and 81 actual-model portraits, including the preferred white western horse.
Commit/push and live publication are tracked separately from these local checks.

| Source | Current derivative | Remaining work |
| --- | --- | --- |
| WildMesh western horse | Preserved source art on a 40-joint rig; 25 distinct body variants for 44 identities; nine clips baked at 120 Hz | Local mounted and site checks pass; live publication verification |
| BlueMesh draft | Corrected eyes, source body/groom, five distinct bodies on 40-joint rigs and nine clips baked at 120 Hz | Local mounted and site checks pass; live publication verification |
| ikkiz unicorn | Source body/horn, five actual legacy groom path sets, source diffuse colour bakes, 40-joint rig and nine clips baked at 120 Hz | Local mounted and site checks pass; live publication verification |
| Diego Luján García skeleton | Actual source bone surfaces on a 40-joint anatomical rig, corrected rib/fetlock/hock attachments and nine clips baked at 120 Hz | Current rendered poses and local mounted spectral checks pass; live publication verification |
| 3DHaupt dragon | Genuine dragon anatomy, 68 joints, twelve clips and articulated wing fold/flight | Live and stored motion, whole-surface floor clearance and local mounted/flight checks pass; live publication verification |
| CG Cookie/David Ward wings | Genuine long feathers on a paired 105-joint component with newly authored feather materials | Local mounted fold/flight and cleanup checks pass; original maps and verified down feathers remain absent |
| jesusrhino Arabian | Same-sculpt standing-limb adaptation, continuous voxel/fairing joins, source head/torso/high-tail morphology, new paint and fine groom, 40 joints and nine 120 Hz clips | Candidate floor/pose and complete-roster local mounted/Studio checks pass; live publication verification |
| TheBigWolfy Fjord | Actual sculpture LOD, original upright mane/tail, new dun paint, 40 joints, nine 120 Hz clips and source-rest-preserving tail clearance | Actual lowerbody/allgroom/whole-hoof and protected Ranch/Studio checks pass; live publication verification |
| maryna287887 pastel unicorn | Original body/horn/maps and source-native sampled groom on a 40-joint rig with nine 120 Hz clips | Source-fidelity/dense floor/pose and protected Ranch/Studio checks pass; live publication verification |

The shared motion solver is frozen at SHA-256
`2e8f59448248aa947261f2587d47786eb3ef15ceef1a93281d970af4280b3594`.
The White foundation, all 25 WildMesh bodies, all five BlueMesh bodies, unicorn
and skeleton have refreshed 120 Hz clips and passing actual AnimationMixer
hoof-surface playback checks sampled at 240 Hz, with a 6 mm ground tolerance.
Earlier 60 Hz results are historical and do not certify these final clips.
Dragon uses an explicit wider claw contact envelope. Its actual skinned surfaces
pass dense stored-clip floor checks, including wings and tail during jump crouch.

The earlier `integration-validation.json` checkpoint records local mounted checks for 70
identities: stand, walk, gallop, jump, native flight where applicable, private
skeleton/material instances, physical scale applied once and actual boot soles
within 8 mm of the stirrup treads. Western tack and bareback visibility also pass.
Separate checks cover 15 actual herd, barn, foal, story and remote-player contexts;
the physical grey yearling is correctly scaled to 0.78. That Studio run checks all 70
available models and keeps the ten pending rows disabled. Its one texture-upload
warning is historical; the corrected focused Fjord/pastel runs report no errors or
startup warnings. These local checks
do not establish mobile performance or fidelity to Star Equestrian's proprietary rig.
The subsequent full 80-identity runs pass twelve Ranch checks and eighteen Studio
checks with no errors or warnings. The earlier pending lists and 70-model reports
are historical evidence, rather than the current catalog state.
Some frozen per-body conversion and batch review records still describe the
earlier pre-integration checkpoint. Use `integration-validation.json` for the
current mounted status; unresolved original-source import/animation comparisons
remain separate from the reviewed game derivatives.

The standalone Studio explicitly registers the same feature artwork as the ranch,
without installing gameplay rows or hooks. Exact parity covers eleven theme
definitions and 26 appearance registrations; a subsequent complete 70-model Studio
run passes eighteen checks. All 21 available feature fantasy entries have inspected
previews and their intended themes. Eight current/prepared Studio entry checks
pass for default, unknown, `hero` and `artist-study` URLs. Retired review pages now
redirect to the available Studio or approved white western source preview, with
both routes verified free of missing assets and external requests.

The 81 thumbnails under `thumbnails/` are ordinary renders of the actual model
hashes, including the preferred white western horse. The imported shipping catalog
uses them through the shared portrait resolver. The generated BlueMesh UV
position cache is an ignored rebuild intermediate, not a runtime dependency.
The shared portrait loader now follows the active catalog in both Studio and game
lists. Focused checks loaded all 70 prepared portraits with exact image hashes;
the ten pending identities and unmapped keys receive no substitute. Current
catalog aliases still work, and existing list spans refresh after metadata loads.
Offline caching keeps exact build queries and revalidates JSON metadata; its
seventeen focused policy checks pass. These presentation changes leave the nine
previously tested mounted runtime files unchanged.
Run `python3 tools/validate-imported-assets.py` for the local resource preflight.
Before activation, use `python3 tools/validate-imported-assets.py --require-complete`;
that mode requires all 80 approved identities, exact unique portrait/index coverage,
and current model, image, catalog and render dependency hashes. Complete
renders record fourteen appearance/motion/delivery input files. The earlier 71-image
report is a historical snapshot; complete publication requires 81 portraits for
all 80 identities and the preferred white western horse, plus 38 unique animated
models including the preferred source and wing component. The gate refuses partial
catalogs and stale image/runtime hashes. The two CGTrader derivatives require
protected incorporated delivery or broader creator permission. Their licenses
permit game use with extraction safeguards; plaintext public GLBs remain excluded.
`remaining-source-review.json`
records the primary terms and the current implementation inference. The full
activation gate also refuses unresolved publication delivery reviews.
The `.mkr` delivery implementation uses authenticated AES-256-GCM encryption and
in-memory glTF loading. Its thirty-five checks preserve the complete skeleton GLB,
BlueMesh geometry/animation buffer views, actual map bytes and embedded neutral-coat
image, and verify production library loading, private clones, browser rendering
and rejection of malformed resources. Demo bundles remain in ignored QA output;
actual Fjord and pastel-unicorn packages now also pass focused Ranch/Studio checks,
including embedded neutral coats, private clones, physical metre scale and no
plaintext model/map requests. Final complete-roster checks remain separate.
Runtime keys remain discoverable. External neutral-coat URLs are unsupported;
the packer now embeds a supplied local neutral image. `protected-resource-prototype-validation.json` is delivery evidence,
not a license certification or new-horse compatibility proof.

## Current acquisition state

All nine approved candidates now have verified, registered original
source files. Acquisition and static inspection do not establish game compatibility.

The preferred WildMesh white horse has been acquired and registered. Its original
GLB is `wildmesh-white-western/source/horse_-_realistic_3d_model_demo_free.glb`;
`wildmesh-white-western/source/receipt.json` records its 27,314,652 bytes and SHA-256
`743fd70ec937dde1aa550afde17eeb506ca538933e291eca41d2fa8d5ffb20ea`.
The receipt and original file hash have been checked against each other.
Inspection found five meshes, 82,426 triangles from accessor counts, one skin
with 677 joints, five embedded PNG images and two named clips:
`Horse|Horse_Idle` and `Horse|Horse_Walk`. Both original clips have been visually
reviewed in the local source preview. The adapted foundation and 25 physical
breed derivatives now have anatomical 40-joint rigs and nine newly authored
clips, including both leads, gallop and jump. Their rig, contact, interpolation
and sampled pose checks pass, as do the local mounted/site integration checks.
This acquisition does not include the paid package's advertised 100+ animations.

The ikkiz white unicorn has also been acquired, registered and safely extracted.
Its original ZIP is `ikkiz-unicorn/source/Unicorn of Jill Janus.zip` (18,800,692
bytes), with SHA-256
`7becb0fbd08d90c11ddd82386707ef1051a12a8cdadaf29258598ee55a4e7b1b`.
The extracted model is a compressed Blender 2.69 file. Inspection in Blender
4.5.14 confirmed a 45-bone rig, 9,753 body base polygons, five legacy hair systems,
seven material networks, two packed 3,072 × 3,072 images and no original action
clips. Embedded text was not loaded or executed, and the two shape-key drivers
were removed before linking the review scene. The original source is unchanged.
The genuine Cycles source render in `ikkiz-unicorn/review/source-preview.png` has
been visually reviewed; it uses reduced subdivision and mane/tail density.
A unicorn GLB derivative now exists under `ikkiz-unicorn/game/`. Conversion uses
the real evaluated legacy hair cache for mane, tail, ear hair, leg feathering and
eyelashes, expressed as tapered crossed ribbons with explicitly reduced child
density. Original diffuse colours were baked in the existing UVs; packed bump/
flow maps were not incorrectly used as colour. The native horn remains a separate
mesh. The source was reposed in memory to REST, and the old neck constraint cycle
was removed only from the derivative. Its 40-joint rig and nine newly authored
clips pass sole/weight/reach/gait checks and actual 240 Hz playback checks of
the refreshed 120 Hz stored clips, including the source long tail. Local mounted
and site checks pass. Reports are under `ikkiz-unicorn/game/`.
The bundled license was preserved as
`ikkiz-unicorn/source/LICENSE-BUNDLED.html` and readable text, and establishes
**CC BY 3.0**, with credit to **ikkiz**.

The CG Cookie/David Ward feathery wing component has been acquired, registered
and safely extracted. `cgcookie-wings/source/CGC Classic Feathery Wing.zip`
contains 699,303 bytes, with SHA-256
`cf713fa956ec331b5c7e63425e38f7a4666e8a5e9754b2d5d4bd1c778ae2aecb`.
Its extracted `wing_042810.blend` is a compressed Blender 2.52 source. The bundled
license was preserved as `cgcookie-wings/source/LICENSE-BUNDLED.html` and readable
text and establishes **CC BY 3.0**. Blender 4.5.14 opened the source with automatic
script execution disabled. Static inspection confirmed a four-bone wing rig,
no animation actions or drivers, 48 face-instanced feathers and a 1,000-strand
downy hair system. The source references unpacked `wing_alphamap.png` and
`wing_texturemap.jpg`, which are absent from the archive. A neutral component GLB
has been generated, and its offline render after re-import has been visually reviewed.
That preview retains the source scale and four-joint skin, with 48 baked long
feather instances, two meshes and 3,248 triangles. It uses neutral materials,
omits all 1,000 downy hairs because their placement could not be verified, and
contains no animation clips. The conversion report is
`cgcookie-wings/review/preview-conversion.json`. The separate game component
under `cgcookie-wings/game/` binds the actual feathers to a paired 105-joint rig
with authored fold/flight clips. Numerical component and White/unicorn host
checks pass, as do combined mounted/browser fold and flight checks. Newly authored
analytic materials add tapered vanes, quills and barb shading on the actual source
feather cards, without changing their source positions, skin or articulation.
Private appearance resources dispose once during release, cancellation and load
failure; shared source geometry and textures remain intact. The absent original
texture maps, unverified down feathers, sparse long feathers and smooth shoulder
shapes remain fidelity limitations. The component alone is not a complete
Pegasus or alicorn.

The BlueMesh draft GLB, `bluemesh-draft/source/horse_draft_horse.glb`, has been
acquired and registered (43,540,368 bytes). Inspection found eight meshes,
200,080 triangles, a **60-joint skin**, three embedded 4,096 × 4,096 PNG images and no animation
clips. It declares no extensions or external dependencies. This original rig
and its static pose are distinct from the adapted game rigs.
A genuine Blender preview is saved as `bluemesh-draft/review/preview.png`, with
its render report beside it. The full horse is visible; two detached dark spheres
from the original `Sphere` mesh remain visible in Blender's imported pose.
Original-source browser comparison remains pending. The derivative corrects
the detached source eye placement and builds five distinct bodies on canonical
40-joint rigs with nine newly authored clips each. Bind, actual deformed-surface,
live gait/contact and dense stored-clip hoof checks pass, as do the local
mounted/site checks. The original source files are unchanged.

The horse skeleton GLB, `horse-skeleton/source/horse_skeleton.glb`, has been
acquired and registered (3,515,808 bytes). Inspection found 47 meshes and 135,451
triangles, with no skins, animation clips or embedded images. It declares no
extensions or external dependencies. A separate derivative now binds the genuine
bone surfaces to an anatomical 40-joint rig with nine newly authored 120 Hz clips;
live gait and actual stored-clip surface checks pass. Rendered moving poses were
reviewed after correcting the rib cage, fetlock and hock attachment pivots and
fragment ownership. Small gaps between original separate anatomical pieces
remain. Local mounted spectral and site checks pass.
Its genuine Blender preview in `horse-skeleton/review/preview.png` is fully framed
and visually reviewed, with no detached pieces visible. The report is beside it;
this is a static view and does not establish browser fidelity or runtime motion.

The 3DHaupt dragon GLB, `black-dragon/source/black_dragon_with_idle_animation.glb`,
has been acquired and registered (67,688,656 bytes). Inspection found four meshes,
37,998 triangles including a 12-triangle source ground plane, a 232-joint skin,
nine embedded images (six PNG and three JPEG) and one `Scene` clip lasting about
22.4667 seconds. It uses four material extensions and has no external dependencies.
An unchanged copy is prepared for review. Its original textured appearance was
visually reviewed in the browser; `Scene` playback and rig behavior remain pending.
The detailed report is `black-dragon/review/source-static-inspection.json`.
Its embedded metadata confirms the author, original title/source and CC BY-NC 4.0;
the NoAI restriction is retained separately from the creator listing.
A genuine native Blender render is preserved in `black-dragon/review/preview.png`
as diagnostic evidence. Its exact evaluated vertex bounds disagree with the
original Three `Scene` at time zero, so native import pose fidelity is unresolved.
This PNG does not certify the original animation pose. The source GLB, review GLB
and receipt remain unchanged; browser animation review and import correction are
still required. See `black-dragon/review/offline-render.json` for the comparison.

All three direct GLBs have unchanged copies prepared for original-source browser
review. The draft and skeleton still need that source comparison, and the dragon
needs original animation playback review. These original previews are separate
from the anatomical game derivatives described above. Each acquired source has
a private SHA-256 receipt in its candidate's `source/` directory; the filenames,
byte counts, verified hashes and inspection facts are in the catalog.
After user sign-in on 30 September 2026, the Arabian horse and separate base OBJ,
Fjord STL, and pastel unicorn GLB, Blender scene, texture and Alembic archives were
downloaded and registered with immutable per-file receipts. The Fjord STL has
12,963,748 triangles. The unicorn GLB has 11 meshes, 32,162 triangles and 14 embedded
maps, with no skin/actions; its scene also supplies native groom and original
body weights. Only selected scene/map members have been extracted so far.

Raw source files stay under `<candidate-id>/source/`, are ignored by Git, and are
never loaded by the game. Keep the original archive, included license, creator
credit and SHA-256 receipt. Listing claims and inspected source facts are stored
separately in candidate metadata.

Each acquired candidate also has a prepared public `<candidate-id>/provenance.json`
with its original filename, byte count, SHA-256, creator, source/license links
and restrictions. Those public records were checked against the preserved
originals and private receipts. They omit download paths, user names, import
time zones and private receipt paths. The source review page reads only these
sanitized records and the prepared review descriptor; it does not fetch anything
from ignored `source/` folders. All nine public records identify acquired sources;
game conversion status remains separate from acquisition.

## Register an acquired source

Download through the original listing after signing in, then register the file:

```sh
python3 tools/asset-gen/register-horse-import.py --candidate wildmesh-white-western --file /absolute/path/to/download.zip
```

The registration tool checks the file, keeps the original and writes a receipt.
It refuses incomplete `.crdownload`, `.part`, `.partial` and `.download` files or
files inside unfinished `.download` directories.
It does not extract archives, execute Blender scripts, infer a complete gait
library from a listing, or mark a model as ready for the game. To inspect an
existing GLB without registering it:

```sh
python3 tools/asset-gen/register-horse-import.py --inspect-only --file assets/models/artist-breeds/lipiz.glb
```

To extract registered asset data into a separate work directory:

```sh
python3 tools/asset-gen/extract-horse-import.py --candidate wildmesh-white-western
```

The extraction tool checks the receipt hash and preserves the original source.
It rejects unsafe paths and symlinks, skips executable/script files and refuses
to overwrite different content. Extracted files stay under the candidate's
`work/extracted/` directory with a separate extraction report. Default archive
limits are 4 GiB of uncompressed data, 20,000 entries and a 1,000:1 compression
ratio, configurable through CLI options. Extraction does not certify game readiness.

## Conversion and integration

1. Inspect original topology, texture dependencies, armature, skin weights,
   animation clips and license. Retain the original unmodified.
2. Convert a copy to a self-contained GLB. Blender sources must be opened with
   automatic script execution disabled. The official macOS arm64 Blender
   4.5.14 LTS application is available for this session on a read-only temporary
   mount. Its archive SHA-256 matches the vendor checksum, and deep, strict
   code-signature validation passed outside the restricted sandbox. The tool
   receipt is `/private/tmp/horse-import-tools/provenance.json`; it has not been
   installed system-wide.
3. Normalize +Z forward / +Y up, measure the body and define saddle, poll, muzzle,
   tail and wing attachment anchors. Preserve source tack where usable.
4. Either retarget to the existing 40-joint anatomical rig, or build a dedicated
   runtime adapter. The current loader requires a `HorseBody` skinned mesh and
   named horse joints; rig presence alone is insufficient.
5. Review neutral pose, head detail, mane/tail, tack fit, walk, trot, canter,
   gallop, jump and rider placement in the browser. Winged/dragon candidates also
   need folding, takeoff, flight and landing review. Measure geometry, draw calls,
   file size and memory before replacing an existing asset.
6. Update the playable catalog only after the converted asset and its motion
   pass review. Validate all 80 existing identities, including feature aliases,
   against the prepared replacement manifest before publishing.

## License records

WildMesh's white horse and the selected 3DHaupt dragon are **CC BY-NC 4.0**.
Attribution and noncommercial restrictions remain attached to them; the dragon
also has a NoAI restriction. They are not unrestricted commercial assets.

BlueMesh's draft and Diego Luján García's skeleton use **CC BY 4.0**.
The acquired ikkiz unicorn uses **CC BY 3.0**, as established by its bundled
license. Credit "Unicorn (of Jill Janus)" to ikkiz, link the source and license,
and identify changes when adapting it. The CG Cookie/David Ward wing's bundled
license likewise establishes **CC BY 3.0**; retain that credit, source link and
license link and identify adaptations. The Arabian listing links its attribution
license to CC BY 4.0; both exact OBJ originals have now been inspected.
CGTrader assets retain their Royalty Free License and NoAI terms. Do not run
NoAI sources through generative AI tools.

The [fdoss001 all-gaits upload](https://blendswap.com/blend/28627) declares CC0.
Two [Ailuros comments](https://blendswap.com/blend/28627#comments) attribute its
base mesh to [Tarnyloo's horse](https://blendswap.com/blend/17172), whose listing
displays CC-BY without a version. The mesh match, creator confirmation and an
explicit base/contribution license split remain unverified, so the package stays
held. [BlendSwap](https://blendswap.com/3d-mcp-api/docs) identifies licenses as
unverified uploader declarations. The upload's CC0 tag does not establish an
unrestricted underlying mesh.

## Coverage limits

The free candidates are foundations, components and sculptures. They do not
supply an independently downloaded, superior model for every real breed.
The completed WildMesh and BlueMesh breed adaptations have distinct measured
proportions, coats, groom and anatomical rigs; their source and authoring reports
remain explicit. All nine approved sources are acquired; sculpture/unicorn
adaptations are documented with their source-specific limits. Fantasy appearance,
rider/tack fit and final integrated gameplay
are reviewed separately from source acquisition and numerical rig checks.

Public deployment includes the complete runtime resource closure, portraits, credit and validation metadata. Original source previews and diagnostic PNGs remain local and are excluded from the publication file list to keep the existing GitHub Pages build within its hosting limit. `horse-import-review.html` links the nine approved sources to their rigged game adaptations in the Breed Studio. Its original-source review descriptors are preserved locally in `work/offline-source-review.json`.

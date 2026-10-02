# Realistic models across the ranch roster

The previous release fitted the new movement to the older breed bodies. This
release replaces those bodies with derivatives of the approved realistic White
Western horse and its complete 677-joint rig. The three explicit realistic
horse choices and the two creator dragon models remain available.

The 25 horse foundations have distinct upper-body shapes, heights, coats and
grooming. All 83 horse entries in the actual game roster, including feature
aliases and fantasy horses, resolve to their own named profiles and use the
complete native horse movement. The two creator dragons keep their source
clips. No new third-party model was downloaded.

The articulated leg proportions and approved hoof motion are shared. This is a
family of realistic breed variants, not 83 separately sourced horse models.
Breed-specific gaits, independently sculpted limb anatomy and new fetlock
feathering are not included. Legacy additive emotes authored for the older
40-joint bodies are not applied to the native skeleton.

## Reproduction and verification

- `tools/native-roster/README.md`: deterministic geometry/coat build, preserved
  data, original attribution and derivative limitations.
- `assets/models/native-roster/validation.json`: independently decoded shape
  buffers, exact protected lower-body vertices and finite normals.
- `runtime-report.json`: all 85 roster identities, nine representative mounted
  horses, private materials, saved markings and independent mane/tail dye.
- `../native-complete-gaits/native-roster-studio-full.json`: 32 models and 183
  actual browser movement checks, including jump recovery.
- `../native-complete-gaits/native-roster-mounted.json`: walk/trot/canter/gallop
  keyboard controls and jump/flight on Quarter Horse, Shetland, Shire and Pegasus.
- `../native-roster-fantasy/verification.json`: actual mounted fantasy coat,
  horn, wing attachment and flight checks.
- `assets/models/native-roster/thumbnail-review.json`: 58 actual model portraits.
- `style-report.json` and `style-dye-report.json`: native mane/tail classification,
  six accessory slots, saved hair dyes with mastery effects, and style reset.
- `../native-roster-fantasy/traits-verification.json`: inherited wings and horns,
  explicit trait removal, and repeat customization without duplicate attachments.
- `performance-report.json`: six native ranch actors, correct pony/foal sizes and
  bareback/wild tack hiding. The measured high-quality 1440×950 run averaged
  roughly 20 fps while other browser QA was active; this is not an isolated
  before/after performance comparison.

Native source geometry is cloned before applying a breed's compact shape data.
Each horse gets a private skeleton and materials. The shared source, motions,
weights and inverse binds are preserved, and actor height is applied once.
Existing stable IDs and saves select the replacement automatically.

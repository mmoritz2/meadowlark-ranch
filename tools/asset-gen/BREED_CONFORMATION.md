# Breed conformation authoring specification

Audited 8 September 2026 against `BREEDS3` in `ranch3d.html`. The actual roster has **44 IDs: 24 foundation breed/type entries and 20 fantasy variants**. The older comment claiming 23 is stale. This document and [breed-conformation.json](breed-conformation.json) describe the same model plan; the JSON holds the full regional targets and source mappings.

## Identity and units

Keep saved IDs intact. `bay` is Quarter Horse, `chestnut` is Shetland, `palomino` is Mustang, `grey` is Andalusian, `black` is Friesian, `pinto` is Paint, and `sunset` is Arabian. These legacy coat-like keys do not mean those animals share anatomy.

Every foundation entry needs its own recognizable rest mesh. Sharing topology, UVs, shaders and animation code is practical; giving them identical geometry with different materials or one global scale is insufficient. **The regional multipliers in the JSON are art-direction starting points, not published anatomical measurements.** Apply them to a corrected neutral horse, inspect the result, and preserve smooth anatomical junctions.

The Paint, Quarter Horse, Appaloosa and Australian Stock Horse populations can overlap strongly in appearance. Their separate game models should depict plausible different individuals, not invent a claim that a specific face uniquely identifies every member. Mustang is a diverse feral population; our selected ranch-type exemplar is one interpretation. Friesian Sporthorse is a crossbred sport type; the selected longer-legged, lighter-framed example is an explicit design choice. [APHA breed description](https://apha.com/registration/the-breed/), [BLM brochure](https://www.blm.gov/sites/blm.gov/files/wildhorse_adoption_brochure.pdf)

Height is measured **ground to withers**, with hooves on the same plane. Hand notation is not decimal: 15.2 hh means 62 inches, or 1.5748 m. Final height is applied once. Existing `size` values must not scale the calibrated model a second time. Pony rider, saddle, stirrup and camera placement need their own attachment adjustments.

## Working silhouettes

Ranges are not all registry requirements. Read each JSON `height.range_basis`: some are explicit standard/typical ranges, while others are clearly marked authoring envelopes. Targets select one representative adult rather than implying a population average.

| Saved ID | Roster label | Target withers m | Reference / working envelope m | Decisive model check |
|---|---|---:|---|---|
| `bay` | Quarter Horse | 1.52 | 1.420–1.630 | Broader rump than thoro, clean limbs; short broad face |
| `chestnut` | Shetland Pony | 1.02 | 0.864–1.070 | Much shorter than welsh; pony body and short legs remain after normalizing height |
| `palomino` | Palomino Mustang | 1.45 | 1.321–1.524 | Less massive rump than bay, slightly longer face; no claim these distinguish all mustangs |
| `haflinger` | Haflinger | 1.45 | 1.372–1.524 | Fuller body than iceland but longer legs than shetland; not an obese miniature draft |
| `grey` | Dapple Grey Andalusian | 1.60 | 1.540–1.720 | Subconvex face versus Arabian dish; less hair and less mass than black |
| `black` | Friesian | 1.64 | 1.575–1.650 | Proud neck and flowing hair silhouette; less draft mass than shire |
| `pinto` | Paint Horse | 1.55 | 1.420–1.650 | Separate individual sculpture from bay in head/neck/barrel; coat alone cannot imply a universal breed anatomy |
| `appaloosa` | Appaloosa | 1.54 | 1.420–1.630 | Longer leaner head than bay, smoother less bulky haunch; optional mottled skin/white sclera supports identity |
| `sunset` | Sunset Arabian | 1.50 | 1.448–1.549 | Mild dish is visible in profile without extreme distortion; high tail root and arch remain in silhouette |
| `iceland` | Icelandic Horse | 1.38 | 1.300–1.450 | Longer-legged and longer-backed than shetland; full shaggy mane without draft feather |
| `welsh` | Welsh Mountain Pony | 1.19 | 1.067–1.219 | More refined neck/head than chestnut and visibly taller; never a 1.4 m Section B labeled Mountain Pony |
| `stock` | Australian Stock Horse | 1.55 | 1.473–1.676 | Less heavy haunch/chest than bay, more body substance than thoro; differentiation is chosen exemplar variation |
| `fjord` | Norwegian Fjord | 1.42 | 1.372–1.473 | Two-tone standing mane and broad neck must be geometry; broader than haflinger |
| `morgan` | Morgan | 1.52 | 1.448–1.575 | More compact and muscular than Arabian, face less dished; upright neck instead of stock carriage |
| `thoro` | Thoroughbred | 1.66 | 1.626–1.727 | Leggier and narrower than bay; racehorse lean not emaciated |
| `knab` | Knabstrupper | 1.64 | 1.490–1.700 | Warmblood-like frame separate from stock Appaloosa; spots are secondary to frame |
| `vanner` | Gypsy Vanner | 1.50 | 1.372–1.575 | Most all-around feather and mane; much shorter than shire, body substantially broader than pinto |
| `marwari` | Marwari | 1.58 | 1.500–1.630 | Inward ear curves must survive frontal 128 px crop; convex profile and high carriage distinguish from Arabian |
| `lipiz` | Lipizzaner | 1.56 | 1.530–1.580 | More compact/short-legged than grey; crest and round haunch, not simply a white Friesian |
| `sport` | Friesian Sporthorse | 1.68 | 1.550–1.750 | Lighter crest/barrel and less feather than black, longer limbs; explicit game individual design |
| `akhal` | Akhal-Teke | 1.59 | 1.499–1.626 | Distinct length and narrowness without weakness; metallic sheen remains nonmetallic horse hair |
| `percheron` | Percheron | 1.73 | 1.676–1.803 | Clean leg silhouette and shorter stronger neck separate from feathered drafts |
| `shire` | Shire | 1.82 | 1.680–1.930 | Tallest exemplar; long convex face plus back-of-leg feather, not enlarged Percheron |
| `clyde` | Clydesdale | 1.78 | 1.727–1.829 | More leggy than percheron, flatter face than shire; white stockings cannot substitute for feather geometry |

The small ponies need the largest correction to existing scale assumptions: UK Shetlands are capped at 1.07 m, and Welsh Mountain Section A at 1.219 m. A similarly proportioned adult riding horse reduced only to 82–86% does not meet either visual target. [Shetland standard](https://www.shetlandponystudbooksociety.co.uk/about-the-breed/breed-standard/), [Welsh Section A standard](https://www.wpcs.uk.com/welsh-mountain-pony)

For draft feather, follow distribution as well as length: modern SHSA guidance places fine Shire hair behind the cannon and around the pastern; Vanner hair can cover the lower limb from knee/hock over the hoof. Clydesdale has plentiful silky feather and a flat face. Percheron needs a clean-legged silhouette. [SHSA standard](https://www.shirehorsesociety.com.au/documents/standard.pdf), [GVHS standard](https://vanners.org/wp-content/uploads/2016/02/Breed-Standard-GVHS-November-24-2019.pdf), [Clydesdale Society](https://clydesdalehorsesociety.com/chs-information/the-clydesdale-today), [PHAOA](https://percheronhorse.org/percheron-disposition-and-characteristics/)

## Fantasy foundations

The six named breed variants inherit the corresponding real body: Aether → Friesian, Sunspear → Arabian, Meadowlight → Quarter Horse, Tempest → Clydesdale, Eclipse → Thoroughbred, Glacier → Percheron.

The remaining mappings are deliberate original character choices, recorded for every ID in JSON: unicorn/celestial → Andalusian; pegasus/aurora → sporthorse; ember/phoenix → Arabian; frost → Lipizzaner; shadowmare/amethyst → Friesian; kestrel → Morgan; frostdrake → Percheron; emberdrake → Thoroughbred; stormdrake → Clydesdale; verdant → Australian Stock Horse. Preserve the established fantasy coats, horns, wings and gameplay. Fantasy appendages must attach to each body’s actual landmarks.

## Current visual baseline inspected

Inspected `output/horse-review/horse-refined-side.png` and `output/world-controls/horse.png` directly. These show one anatomical body with improved surface treatment, rather than an established set of distinct breed sculptures.

The studio side view still shows a thick solid mane with repeated triangular hanging points, a broad ribbon-like tail, simplified ear rims, little nostril cavity depth, broad undefined facial planes, and soft transitions around knee/fetlock/pastern. The game view shows added hair cards, but the solid mane silhouette and sharp coat highlights remain conspicuous. These observations concern these captures; they are not a claim about new models that have not yet been rendered.

The next model pass must improve the actual head, hair silhouette, joints and hoof forms in addition to breed proportions. Coat patterns cannot conceal unchanged geometry during acceptance.

## Visual acceptance gates

1. **Geometry identity:** export all 24 foundation meshes, with distinct asset IDs and genuinely different vertex positions after removing global scale. Check that changes affect body, head/neck and limbs, not just one dimension. For closely related stock exemplars, use subtle coherent individual differences, not exaggerated fake breed traits.
2. **Silhouette sheet:** render all 24 in matte neutral gray, no mane accessories, tack or coat patterns, same orthographic camera and neutral pose. Provide one sheet at equal physical scale and a second normalized by withers height. The major pony, light, stock, baroque and draft forms must remain distinct in both. The per-row checks above must pass at 256-pixel horse height.
3. **Head sheet:** frontal and profile crops at the same head scale for Arabian, Quarter Horse, Thoroughbred, Andalusian, Marwari, Akhal-Teke, Shetland and Shire. Confirm real nostril openings, separate lip contour, eyelids around recessed eye globes, ear pinna thickness/interior and continuous jaw/throat transition. Marwari tips curve inward; they must not be two straight triangles tilted together. Arabian dish stays moderate.
4. **Hoof and limb anatomy:** four separate lower limbs, readable knee versus hock, fetlock behind cannon, sloping pastern into hoof wall, coronary band, rounded front toe and heel volume. No single tapered tube ending in a rounded block. Hair cannot be used to hide broken leg anatomy.
5. **Hair at near distance:** replace the dominant solid mane teeth and tail ribbon silhouette with layered directional strands/cards or groom geometry. Preserve scalp attachment and avoid floating cutouts. Include full, sparse, upright and feathered hair profiles; render front, side and rear in backlight to expose card artifacts. Random lengths alone do not create different mane styles.
6. **Sculpt and shading:** shoulder blade, pectoral division, elbow, gaskin and haunch should read through geometry and soft shading without painted black channels. Smooth shoulders into neck, and limbs into torso. Coat stays nonmetallic even on Akhal-Teke; a broad satin highlight is sufficient. Inspect black, gray and chestnut under one daylight setup.
7. **Rig and attachments:** stand, walk, trot, canter, jump and turn each family. Retarget/rest bones must follow new lengths. No bent stance caused by reused inverse-bind matrices, collapsed jaw, candy-wrapper legs or stretching hair roots. Hooves land near the ground rather than sliding through it. Check saddle contact and stirrup clearance on both pony and draft extremes.
8. **Runtime coverage:** spawn every saved roster ID; named fantasy variants retain their inherited conformation. All mappings resolve without silent fallback to a generic model. Test existing save loading and foal scaling. Measure geometry counts, memory and camera-distance LOD behavior before increasing every animal’s detail.
9. **Evidence:** retain neutral sheets, closeups, in-game daylight captures and error logs with model hashes. Compare with the baseline above under matching camera/light/pose. A model is improved only after these images support that conclusion; do not claim it exceeds Star Equestrian without a direct comparable visual assessment.

## Sources and interpretation boundaries

Sources are breed associations, their original standards mirrored by an affiliated association, FEIF, BLM, the Jockey Club and AMNH’s authored conformation exhibit. Documents have different publication dates; these were consulted on the audit date and are not represented as every registry’s newest rulebook. Unspecified details, selected heights, numeric regional multipliers and fantasy assignments are art choices. More detailed conformation text is stored once per foundation in JSON to avoid confusing fantasy variants with distinct natural breeds.

- `aqha`: [AQHA conformation chart (hosted by Italian Quarter Horse association)](https://www.aiqh.eu/wp-content/uploads/2022/01/American-Quarter-Horse-Conformation-Chart.pdf)
- `shetland`: [Shetland Pony Stud-Book Society breed standard](https://www.shetlandponystudbooksociety.co.uk/about-the-breed/breed-standard/)
- `mustang`: [Bureau of Land Management wild horse adoption brochure](https://www.blm.gov/sites/blm.gov/files/wildhorse_adoption_brochure.pdf)
- `haflinger`: [American Haflinger Registry judges packet](https://haflingerregistry.com/wp-content/uploads/2023/03/JudgesPacket.pdf)
- `andalusian`: [ANCCE PRE conformational characteristics](https://www.ancce.es/en/contenido/morfologia-del-pre)
- `friesian`: [FHANA Friesian conformation and performance](https://fhana.com/the-friesian-horse/articles/friesian-conformation-and-performance/)
- `paint`: [American Paint Horse Association breed description](https://apha.com/registration/the-breed/)
- `appaloosa`: [Appaloosa Horse Club 2025 handbook breed standard](https://sub.appaloosa.com/pdfs/rulebook25_1.pdf)
- `arabian`: [Arabian Horse Association conformation and breed standard](https://hrsweb.arabianhorses.org/discover/arabian-horses/)
- `arabian_height`: [AHA conformation education notebook](https://arabianhorses.org/.content/judges-stewards/js-docs/JS_NB_Conformation.pdf)
- `icelandic`: [FEIF breeding goals and assessment](https://www.feif.org/raise/)
- `icelandic_build`: [FEIF strong back, loins, legs and joints](https://www.feif.org/2020/10/07/about-the-weight-of-a-rider/)
- `welsh`: [Welsh Pony and Cob Society Section A standard](https://www.wpcs.uk.com/welsh-mountain-pony)
- `stock`: [Australian Stock Horse Society events handbook and Standard of Excellence](https://ashs.com.au/media/1908/eventshandbookwebversionmar2020v2-compressed.pdf)
- `fjord`: [Norwegian Fjord Horse Registry breed standard](https://www.nfhr.com/catalog/index.php?breedstd=1)
- `morgan`: [American Morgan Horse Association ideal Morgan](https://www.morganhorse.com/about-morgan/ideal-morgan/)
- `thoroughbred`: [The Jockey Club about the Thoroughbred](https://www.thejockeyclub.co.uk/the-racing/racing-explained/racehorses/all-about-the-thoroughbred/)
- `thoroughbred_height`: [American Museum of Natural History Thoroughbred conformation exhibit](https://www.amnh.org/explore/ology/zoology/all-about-horses/thoroughbred)
- `knabstrupper`: [Knabstrupperforeningen for Danmark 2024 purebred horse breeding program, pages 6–7](https://knabstrupper.dk/cms/Clubknab/ClubImages/Avl%20og%20sport%20dokumenter/Avlsprogrammer%202024/2024%20UK%20Breeding%20Program%20PUREBRED%20Knabstrupper%20Horse%20FINAL%20updated%2020240120.pdf)
- `vanner`: [Gypsy Vanner Horse Society breed standard, November 2019](https://vanners.org/wp-content/uploads/2016/02/Breed-Standard-GVHS-November-24-2019.pdf)
- `marwari`: [Indigenous Horse Society of India Marwari character statement](https://www.horseindian.in/marwaricharacter.htm)
- `lipizzan`: [German Lipizzan breed association standard](https://lipizzanerpferd.de/en/)
- `sporthorse`: [Friesian Sporthorse Association history and breeding intent](https://www.friesiansporthorseassociation.com/FriesianSporthorseHistory.html) — Search-index excerpt available; page returned 502. No precise conformation or height rule inferred from inaccessible content.
- `akhal`: [Akhal-Teke Association of America breed standard](https://akhal-teke.org/the-breed/breed-standard/)
- `percheron`: [Percheron Horse Association of America disposition and characteristics](https://percheronhorse.org/percheron-disposition-and-characteristics/)
- `shire`: [Shire Horse Society Australia breed standard, 2015](https://www.shirehorsesociety.com.au/documents/standard.pdf)
- `clydesdale`: [Clydesdale Horse Society the Clydesdale today](https://clydesdalehorsesociety.com/chs-information/the-clydesdale-today)


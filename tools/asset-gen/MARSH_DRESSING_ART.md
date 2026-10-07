# Willowmere dressing and chimney plumes

`assets/marsh-dressing.js` builds original art for the existing Willowmere lamp mast, drying net and four herons. It also supplies view-facing smoke to all five existing settlement chimney emitters. No new downloaded asset is required.

The mast has a terrain-seated stone cairn, timber pole, forged collars, bolts, climbing irons, guy anchors and turnbuckles. A six-pane lantern has an enclosed burner, reflector, vented cap and an animated heron weather vane. The mantle brightens after dusk; a short-range, non-shadowing point light is restricted to nearby high-quality views. The net consists of open sagging cords and hanging weights rather than a translucent rectangle.

Each heron has an original curved neck, folded wings with layered primaries, split bill, eye stripe and crest, articulated legs and four toes per foot. Three bones give the head and neck quiet idle movement while the feet remain planted. All four share geometry and one vertex-colour material. A small procedural feather variation adds surface detail without a downloaded texture. Bird roots are moved only as far as needed to find shallow shore clear of decks and solid props; the old bird had stood through the arrival boardwalk. All four remain in Willowmere with their original headings.

The old generators still consume their original seeded random values and remain available as fallbacks. Replacement construction occurs after all four regional sites are chosen. Region identities, house sites, mast X/Z and heading, and chimney origins remain unchanged. The mast's vertical origin is corrected to the current terrain: the older foundation had been buried by the marsh terrain patch. Thin guy cables and net cords do not form broad invisible walls. Collision uses the actual low foundation, pole and posts; camera obstruction covers only the pole and net posts.

Timber, stone and cord reuse the ranch-builder materials and locally hosted **CC0 Poly Haven** maps. Their provenance remains in `assets/textures/builder/manifest.json` and `assets/textures/scanned/manifest.json` (weathered brown planks, rough linen and rock boulder cracked). Metal, bird plumage and glass materials are original.

The visual comparison used Foxie Ventures' official [ranch image](https://www.foxieventures.com/wp-content/uploads/2023/01/Ranch-Build-Your-Ranch.jpg), linked from its [Star Equestrian overview](https://www.foxieventures.com/star-equestrian/). Legible structural details, separate materials, and grounded props inform this pass. These are Meadowlark's own marsh landmarks and wildlife, not reproduced Star Equestrian assets or locations.

Smoke uses 18 instanced quads per chimney, rebuilt to face the current render camera in the vertex shader. This also works in reflection renders. Each puff has a noisy soft edge, gradual birth/death opacity and coherent drift. Colour and opacity darken at night; no crossed panels or shared sharp rectangular silhouette remains. The five sources total 180 triangles. Plumes stop drawing beyond 320 metres; herons stop drawing beyond 145 metres. This bounds geometry work but does not certify a mobile frame rate.

```sh
QA_PORT=8457 PLAYWRIGHT_PATH=/path/to/playwright node tools/qa-marsh-dressing.cjs /path/to/evidence
QA_PORT=8457 PLAYWRIGHT_PATH=/path/to/playwright node tools/qa-willowmere.cjs /path/to/settlement-evidence
QA_PORT=8457 PLAYWRIGHT_PATH=/path/to/playwright node tools/qa-country-world.cjs /path/to/regression-evidence
```

The focused run measures geometry/skin weights, animated head displacement versus stationary toes, current terrain grounding, shore depth, deck clearance, original chimney origins, smoke motion/culling, camera bounds, mounted mast collision, night/day lantern output, and finite opaque HDR buffers. Inspect the close model views, smoke from the side and inside, rain, night and quality levels. Close bird model reviews hide the following herd only so it does not park directly in the inspection camera; riding and settlement regression views keep gameplay actors. The settlement suite verifies all twelve mounted route traversals and exact agreement between visible decks/terrain and the riding sampler.

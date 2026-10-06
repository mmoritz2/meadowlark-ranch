# Equestrian village art pass — 6 October 2026

The visual reference is Foxie Ventures' official Star Equestrian countryside and ranch screenshots:
https://www.foxieventures.com/star-equestrian/

This pass uses original architecture and the project's existing licensed Poly Haven materials and plant/tree scans. No screenshots or extracted game assets are shipped.

## Changes

- Cottage footprints stay 3.4 × 2.8 metres. Roofs rise to 4.55 metres, with a front dormer, recessed circular loft lights, slate, dressed stone courses, shutters, painted panel doors, a door canopy, twin chimney pots and flagstone approaches.
- Four planter anchors per cottage drive placement of scanned flowers. The original Cottonwood houses and feature-package cottages all receive gardens, including builder-created cottage models present at installation.
- Petal & Pail and Summit Lodge have plaster and stone exteriors with painted shopfront panels and striped awnings. The original interaction IDs and door openings remain.
- Tree species follow spatial groves. Slender scans around Cottonwood open up the streets and rooftop silhouettes. Existing tree positions, anchored height placement and detail budgets remain in use.
- Architecture continues to batch per material while retaining individual collision parts. A cottage is 5,784 triangles in 14 material batches; no new asset download is needed.

- Transparent name labels and chat bubbles no longer write depth. Their invisible pixels previously punched rectangular gaps in paths rendered later. A native GPU fixture compares the fixed material with a negative control that reproduces the error.

## Validation

Focused geometry tests cover all four cottage variants, unobstructed recessed front/dormer/loft glazing, finite attributes, geometry limits, an open shop doorway, mounted awning clearance, solid walls and roofs. Existing terrain and collision tests cover continuous slopes, protected yards and movement barriers.

Browser evidence is saved under `output/equestrian-village/` in the primary checkout. `qa-country-world.cjs` now includes close-up cottage and shop views and checks that every instantiated cottage has its complete garden. Native GPU checks cover the former black-box view, quality tiers, weather, portrait layout and invalid bloom input. Mounted traversal uses real keyboard input through the ranch entrance.

This is a village and woodland composition improvement, not a claim of visual parity with Star Equestrian or App Store certification.

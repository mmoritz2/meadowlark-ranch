# River Road West canyon approach

The old waypoint relaxation left a 28.16m connecting segment through two seeded canyon mesas. Mounted forward travel stalled there, and reverse travel was pushed up to 8.76m away from the road. Point clearance alone also produced folded road triangles at sharp bends.

This pass surveys complete segments against the existing solid circles, authored model parts, riverbank and actual terrain grade. Deterministic bounded A* repairs only blocked spans, then verifies line-of-sight simplification and linear resampling. Endpoints, other routes and existing geology remain fixed. No random placement stream is consumed.

The canyon section is a four-metre bridleway, varying by at most 6%, rather than the former roughly six-metre cart road. A 3.2m centreline allowance around solid circles and a 2.4m precise-model footprint leave room for the surface and rider. Bounded bevel joins form one road stroke; overlapping source strips are clipped before emission. Ground height is sampled at every surviving vertex. All projected faces point upward and have nonsingular texture coordinates. Other roads retain their existing builder. A separate Riverwest vertex mask derives verge coverage and end fade from the nearest verified segment of the complete stroke. This prevents a clipped internal strip edge from fading a triangular hole inside a joined road; gravel/rut UVs remain valid and other road masks are unchanged.

The surface retains the ranch's existing photographed mineral soil maps, wheel wear, feathered verges and received sun shadows. Agave and ocotillo clearance uses transformed geometry bounds unioned across high/low templates, including every allocated quality slot. This changes decorative matrices only, leaving actual tree/cactus/model collision footprints intact.

## Verification

- `node --test tools/test-route-clearance.mjs tools/test-road-ribbon.mjs tools/test-solid-collisions.mjs`
- Native GPU: `tools/qa-riverwest.cjs`, with a 911eb78 baseline and the same deterministic world seed.
- Full mounted walk in both directions, continuous final precise-solid corridor and rendered mesh-edge samples, analytic complete triangle-circle clearance, projected winding, UV determinants, dry-bank/grade and decorative plant bounds.
- Preserve sampled terrain, mesa/spire geometry and transforms, canyon field geometry, pre-road colliders/walls, six other route point arrays and both route endpoints.
- Ten views: bridge junction, both canyon approaches, overhead, close trail, mounted high/medium/low, rain and golden hour. Source and post-process buffers are checked for finite pixels and an opaque world pass.
- Wider country-world acceptance covers vegetation, protected terrain, scanned foliage, village surfaces, geometry budgets and quality transitions.

Evidence and exact release results are saved under the primary workspace's `output/equestrian-visual-goal/riverwest-*` directories. No external models or reference artwork were added. Construction and geometry cost are recorded in the native acceptance report; mobile frame rate is not established by these desktop checks.

The broader visual goal remains active. Distant skyline composition, other biome transitions, legacy cold vegetation, snow repetition and some horse/prop details still need comparison work.

## Release result

All 24 focused native checks, 26 wider world checks and 23 CPU checks passed. The road is 257.15m long. Forward/reverse mounted travel completed in 3563/3565 simulation frames, with maximum lateral deviation 0.762m and zero ground-height error. All six other route point arrays, both endpoints, sampled ground, prior solids and seeded formation geometry/transforms match 911eb78.

The final stroke has 6,049 triangles and 4,929 indexed vertices. It remains in the shared single road draw. The native minimum coarse-solid surface clearance is 1.126m; 54,748 rendered-edge samples have zero precise-part contacts, and the after-ready 2.4m centre footprint is clear. Every road face and UV determinant passed at Float32 precision. The former interior-mask case is exercised at 56 vertices; their minimum alpha is .9796, and duplicate XZ vertices have identical coverage alpha. The cleanup removed seven decorative agaves.

Construction is paid once at install. The isolated route fixture's ribbon construction took 68.4ms in the CPU check, and the native bounded route search took 298.4ms. These are development-machine results rather than a mobile performance claim.

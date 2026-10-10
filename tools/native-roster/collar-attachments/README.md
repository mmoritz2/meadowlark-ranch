# Reviewed draft breastcollar authoring

The current Shire/Clydesdale snapshots contain 966 collar vertices and Percheron contains 962. They retain the prior four-influence, 70% shoulder attachment and route the lower V upward with a bounded static field. The original 514-vertex NPZs and their index are preserved in `prior-70percent/` as generator inputs.

`index.json` pins each snapshot to the source GLB, native motion and exact v5 morph prefix. Its `standingRoute` specifies the reviewed 60 mm lift, 12 mm forward offset and fixed fade region before actor scale. Each NPZ includes independent desired `standingTarget`/`standingNormal`, `routeMask` and prior skin influences alongside the five packed runtime arrays. `collar_attachment.py` appends only vertex IDs, raw position/normal and skin indices/weights. The original five-mesh morph prefix is never requantized.

Reproduce the authoring into a separate directory with `python3 tools/native-roster/author-lower-route.py --out /tmp/collar-authoring`. The generator checks source, motion, prior input and prefix hashes. `collar_validation.py` independently derives the route and normal Jacobian, checks the inverse-solved targets and preserves unrouted anchors. Legacy snapshots without a standing route retain the original rest-preservation validation.

See [the lower-route evidence](../../../review/draft-collar-route/README.md) and [the historical shoulder-fit review](../../../review/draft-front-check/README.md). Changing source anatomy, native motion, skin influences or the protected morph prefix requires new review. No per-frame solver is introduced. Minor lower-center tie clipping and local trim stretch remain.

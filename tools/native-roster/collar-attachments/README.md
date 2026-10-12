# Reviewed draft breastcollar authoring

The current three draft snapshots contain the 2,404 reviewed breastcollar and center-tie vertices. They retain the prior four-influence, 70% shoulder attachment and route the lower V upward with a bounded static field. The original 514-vertex NPZs and their index are preserved in `prior-70percent/` as generator inputs.

`index.json` pins each snapshot to the source GLB, native motion and exact version 7 morph prefix. The old 514-vertex shoulder weights are retained, but their positions and
normals are inverse-solved onto the source-restored shoulder surface before routing. Only the reviewed collar islands follow this field; headstall, reins, fenders, irons and separate saddle remain unchanged.
This preserves the new proportions instead of restoring old collar geometry.
Its `standingRoute` specifies the reviewed 60 mm lift, 12 mm forward offset and fixed fade region before actor scale. Each NPZ includes independent desired `standingTarget`/`standingNormal`, `routeMask`, `sourceRestoreMask` and prior skin influences alongside the five packed runtime arrays. `collar_attachment.py` appends only vertex IDs, raw position/normal and skin indices/weights. The original five-mesh morph prefix is never requantized.

Reproduce the authoring into a separate directory with `python3 tools/native-roster/author-lower-route.py --out /tmp/collar-authoring`. Use `--morph-dir` to validate a staged morph directory before promoting a new
cage. The generator checks source, motion, prior input and prefix hashes; it
never changes production files. Repeated authoring must reproduce the installed
NPZ hashes exactly. `collar_validation.py` independently reconstructs the source-restoration field, transported authored normals and lower-route normal Jacobian, checks the inverse-solved targets and preserves every vertex outside the authorized sparse islands. Legacy snapshots without a standing route retain the original rest-preservation validation.

See [the lower-route evidence](../../../review/draft-collar-route/README.md) and [the historical shoulder-fit review](../../../review/draft-front-check/README.md). Changing source anatomy, native motion, skin influences or the protected morph prefix requires new review. No per-frame solver is introduced. Minor lower-center tie clipping and local trim stretch remain.

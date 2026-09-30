# White Western native-rig candidate

This private Breed Studio review keeps WildMesh 3D's original 677-joint skin, body, hair, Western tack, and creator Idle/Walk animation curves. The GLB's legacy specular-glossiness material declarations were translated to equivalent PBR declarations so the bundled browser renderer displays the original white coat and tack. No geometry, skin weights, joint transforms, animation curves, textures, or binary payload were changed. [candidate.json](candidate.json) records hashes, license, validation, and release status. The creator Walk moves the body, neck, and head, but lowers the torso too far for the user's game standard; it remains a motion reference, not an approved gait.

Serve this checkout locally and open [review.html](review.html). The review shows only creator Idle and Walk. It is not connected to the game roster or Ranch and has no mounted rider or faster gaits. Review images and measurements can be regenerated with `node tools/qa-native-white-western-candidate.cjs` while the local server runs; set `QA_PORT` or `QA_URL` for a non-default server.

[The side-by-side hair study](../../../../../../review/horse-secondary-motion.html?horse=white) adds small delayed motion to the original mane and tail strands for comparison. It does not correct the Walk's low body path.

The 25 WildMesh breed derivatives keep exactly the original five mesh vertex counts, triangle indices, and UV layouts, but their weights were merged into a 40-joint game rig. A full-rig conversion should first pilot one Bay shape, then batch the rest only after visual acceptance:

1. Rebuild the Bay body, groom and tack at the existing breed-cage vertex positions, retaining the original per-vertex 677-joint weights in the same vertex order. Fit all 677 rest joint origins and orientations through that cage and regenerate inverse bind matrices; the current 40-joint weights cannot recover them.
2. Transform the creator Walk relative to the fitted bind pose. The source Walk contains 546 translation and 546 rotation channels, so appending it unchanged to a fitted skeleton would snap many joints back to the source positions. Preserve creator timing and test world-space joint trajectories before reducing or resampling any channels.
3. Compare native source and Bay through the full cycle from side and quarter views. Check each hoof's stance height and sliding, limb deformation, mane and tack motion, saddle-seat movement, rider fit, transitions from Idle, and one-versus-multiple-horse performance. Repeat on a short, tall and draft foundation before considering all 25 shapes.

Trot, canter, gallop, and jump still need separately approved authored motion. No candidate from this folder is a Ranch replacement yet.

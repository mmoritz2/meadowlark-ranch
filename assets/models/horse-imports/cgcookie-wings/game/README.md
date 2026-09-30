# Approved real feather wing pair

The component uses CG Cookie / David Ward's acquired feathery wing, licensed [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/). The original ZIP, extracted Blend, receipt, and audited preview remain unchanged. This derivative contains the genuine wing body and 48 long-feather instances on each side, uniformly fitted and mirrored into a +Z-forward, +Y-up pair. It has 6,496 source triangles and 105 joints: a mounting root, four source wing joints per side, and 96 rigid individual feather fan joints.

The original color and alpha image maps are absent. The unverified legacy down strands are omitted. The game loader adds newly authored analytic vanes, quills and barb shading to the actual long feather cards, with matching cutout shadow materials. Source positions, indices, normals, skin values and articulation remain unchanged; private material-coordinate geometry is released without disposing shared source geometry or textures. Sparse feathers and smooth wing shaft/root shapes remain visible. This adaptation does not reproduce the unavailable original textured/downy appearance. Original wing-body UVs are retained; the audited baked long-feather preview contains no UVs. No generative image or asset tools are used.

Individual feathers stay rigid as their source wing anatomy folds and flaps. In the ground fold they trail along the flanks, with long feathers kept on the exterior of the host torso. The source-extended span is 6.08 m at the reference raw withers scale; the selected folded span is 1.3323 m. The source-open pose remains available through the Rest clip and the component's setRest(true) API.

The five component clips are Rest, Folded_Idle, Takeoff, Fly, and Land. Live motion is in assets/feather-wing-motion.js. createFeatherWingMotion({THREE,root:wingGltf.scene,profile:wingProfile}) provides setFlight({flying,altitude,verticalSpeed,speedMps}), update(dt), reset(), snapshot(), and setRest(bool). Update with elapsed physical time, not the ground gait speed multiplier.

The same module exports createFeatheredHorseMotion({THREE,root:host.scene,skin:host.skin,heightM:host.profile.heightM,profile:host.profile}). It preserves the shared forty-joint ground solver and adds altitude-based leg tuck, launch, landing extension, and head/neck settling. Its set(gait,{lead,speed}), setTurn(), update(), reset(), snapshot(), gaits, size, and state follow the anatomical core contract. setFlight() accepts the same physical state as the wing component. A zero-dt refresh restores the pre-overlay pose and cannot accumulate another flight pose.

Attach wingGltf.scene as a child of the host scene. After the body motion, compute the wing's local matrix in this order:

```text
inverse(host.scene.matrixWorld)
  * chest.matrixWorld
  * host.skin.skeleton.boneInverses[chestIndex]
  * host.skin.bindMatrix
  * Translation(host.profile.anchors.withers[0])
  * UniformScale(host.profile.withersM / wingProfile.referenceWithersM)
```

The referenceWithersM is 1.7869539753502213. The matrix follows the raw withers anchor through the chest bind delta, preserving host mount transforms and uniform physical sizing. Set matrixAutoUpdate=false or decompose the matrix into the wing scene's position/quaternion/scale. Then update the wing component using the same flight state as its host. Original source names may be sanitized by GLTFLoader; the adapters normalize dots/spaces.

motion-qa.json checks the isolated actual skin, source-open and folded bounds, sampled flight/rider envelopes, ground clearance, paused update stability, and playable clips. host-motion-qa.json checks both loaded WildMesh and ikkiz bodies with forty-joint air poses, both gait leads, chest-following wings, and a spine-following rider torso envelope. Exact Three-evaluated combined body/wing poses are baked to static review meshes before ordinary Blender CPU rendering. Local mounted fold/flight, transformed-parent attachment, native component visibility and private appearance cleanup checks have subsequently passed; current site evidence is recorded in `../../integration-validation.json`. Shipping activation still waits for the complete roster.

Rebuild in order:

```sh
python3 tools/asset-gen/rig-cgcookie-wings.py
node tools/bake-cgcookie-wing-clips.mjs
node tools/qa-cgcookie-wings.mjs --write-poses
node tools/qa-feathered-hosts.mjs --write-poses
```

The clip bake refuses to append another set of tracks to an already animated derivative. Source hashes, output hashes, motion code hashes, actual clip playback, and inherited missing-map/down-strand limitations are recorded beside the asset.

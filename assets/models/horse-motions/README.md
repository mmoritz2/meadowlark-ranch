# Horse motion bundles

These files add fitted animation to the existing horse bodies and skins. They do not replace the model geometry, coat, bone hierarchy, bind matrices, or proportions.

The reference is the user-approved White Western trot polish (`84641a03ff1adeec2c24e49b7120efdd750524c268cd1691da6f92e4bc6824b6`), including its stronger backward forehoof fold, wider stride, quieter head, and more active tail. Each of the 25 artist body models receives its own fitted 40-joint curves. The three Western horses retain their 677-joint rigs and existing Walk treatment. Fantasy aliases share their foundation body's motion. Creator dragon clips remain separate.

Jump is one shot. Its clip poses the skeleton; `nativeJump.actorLiftM` moves the actor once using the same clock. Height scales with body size and time scales with its square root, retaining 9.81 m/s² flight acceleration. The controller blends back to the previous gait after landing. Ground gaits use per-body stance travel speeds and support both canter leads.

## Attribution

Original artist horse bodies: [Horse by b2przemo](https://blendswap.com/blend/13903), [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/). Existing body provenance is in `../artist-breeds/SOURCE.md`.

Western source and reference motion: [HORSE – Realistic 3D Model (DEMO FREE) by WildMesh 3D](https://sketchfab.com/3d-models/horse-realistic-3d-model-demo-free-65d6a70a6721495f938c93e80a5998e4), [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/). Adaptations include the authored limb cycles, hoof articulation, torso/head/tail motion, jump and target-specific retargeting. The motion adaptations retain the source's noncommercial restriction. Full source attribution is in `../horse-imports/ATTRIBUTION.md`.

## Authoring and validation

`tools/native-gaits/retarget-reference.py` fits reference world rotations to the target rest orientation, then solves target-specific skinned hoof contact without changing bone lengths. `package-motion.py` copies named animation channels into compact motion-only GLBs. `publish-roster.py` assembles the catalog from reviewed build outputs. Per-bundle provenance records the input clip hashes. `reconstruct-reference.py` rebuilds a full reference model from the committed body and compact `authoring-reference.glb`, preserving its rest transforms and approved curves. See `tools/native-gaits/README.md` for the retarget commands.

Run `node tools/qa-native-complete-controller.mjs` for controller behavior. `QA_PORT=8584 node tools/qa-complete-gaits-studio.cjs` and `QA_PORT=8584 node tools/qa-complete-gaits-ranch.cjs` exercise the real loaders, skins and game controls in an isolated browser context. Playwright must be resolvable in Node's module path.

Ground contact checks cover a level floor and declared gait travel speeds. Jump clips were tested for takeoff, flight, landing and return to gait; arbitrary entry-speed contact and clearance over every course obstacle are not guaranteed by those checks. Retargeted curves use LINEAR interpolation; position continuity does not imply continuous joint angular velocity.

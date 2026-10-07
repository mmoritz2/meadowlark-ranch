# Resident distance views

Forty resident identities, baked from the same dressed characters used by the nearby NPC system. These views replace the old primitive bodies when a full animated character is outside the nearby rig budget. Quest IDs, interaction roots, names and walking routes remain owned by the world.

## Source and attribution

The source bodies, outfit meshes and animations are Quaternius Universal Base Characters, Modular Character Outfits - Fantasy, and Universal Animation Library, using the free Standard versions already shipped in `../rider/`. They were released under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/); see [the source notice](../rider/LICENSE.txt) and [Quaternius](https://quaternius.com). The updated heads derive from [Blender Studio Human Base Meshes](https://www.blender.org/download/demo-files/#assets), credited to Julien Kaspar / Blender Studio and community contributors, also CC0. Their original provenance is in `../rider/stylized-heads-provenance.json`. Clothing treatments, hair, face materials and resident appearance recipes come from this project's existing rider modules. No Star Equestrian assets are included.

`manifest.json` records the source file hashes, each appearance recipe, dimensions, poses, PNG sizes and SHA-256 hashes. The eighty PNGs are loaded by proximity rather than all at startup. A recipe mismatch retains the original fallback instead of displaying an incorrect resident.

## Representation

Each identity has eight horizontal views in 64 x 128 pixel tiles. Nineteen stationary residents use one standing pose; twenty-one roaming residents also use two opposite walking phases. The atlases contain unlit albedo and posed world-space normals, allowing daylight, night, fog and weather to light the distant figures. Walking phases are simplified distance animation; nearby residents still use their full skeletons and native animations.

One resident uses one camera-facing quad, two triangles and one draw call. The current render radius is 150 metres. Full characters retain the existing limit of twelve, 55 metre build radius and 85 metre keep radius. Distant views do not cast shadows. They are intentionally low resolution for distant use; a detached camera very close to a resident far from the player can reveal that limitation.

Texture pairs load around the player after horse startup, with two pairs loading concurrently. Unused profiles are evicted toward a 20 MiB estimated GPU texture target, including mipmaps. Nearby profiles remain pinned, so this is a soft target if a future crowded location needs more; it is not a hard cap on total game memory. Stale queued requests are discarded after leaving an area. Asset failures retain the original fallback without per-frame retry loops.

The material uses the shared opaque MSAA coverage path and guards neutral baked normals to avoid invalid HDR values or transparent holes. The existing world movement bob is disabled for both detailed and baked residents so grounded feet remain stable.

## Regeneration and verification

Serve the repository over HTTP, set `QA_PORT` to that server and `PLAYWRIGHT_PATH` to an available Playwright package, then run from the repository root:

```sh
node tools/asset-gen/bake-npc-distance.cjs
node --test tools/test-npc-characters.mjs tools/test-npc-impostors.mjs
node tools/qa-npc-distance.cjs /tmp/resident-distance-review
```

Regeneration always processes the entire catalogue in `tools/asset-gen/npc-distance-definitions.json`. Keep those definitions synchronized with the world when adding residents. It renders through the production character materials, grounds the boots for each pose, and rejects a tile if any silhouette touches its edge. Do not use a partial bake to replace the manifest.

The world acceptance script checks settlement travel, eviction and return, nearby rig restoration, day/night/rain, high/low quality, identity preservation, all asset hashes, 32 isolated normal/coverage cases, HDR validity, WebGL errors, and the protected terrain fixture. Run the mounted riding regression separately when changing the per-frame integration:

```sh
node tools/qa-discovery-riding.cjs /tmp/resident-riding-review
```

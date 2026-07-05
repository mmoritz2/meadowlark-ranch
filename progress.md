Original prompt: can you look at this and fix every single error

Notes:
- Initial inspection found a static 3D web game centered on ranch3d.html with existing uncommitted changes and generated assets.

Progress:
- Vendored local Three.js/MQTT browser files and patched ranch3d.html to avoid CDN startup loads. Added render_game_to_text for browser diagnostics.
- Added a controlled module loader: HTTP/localhost runs the game, file:// shows a local-server instruction instead of CORS errors.
- Verified with Playwright on http://127.0.0.1:8017/ranch3d.html; final run produced output/web-game-final/shot-0.png and state-0.json with no errors JSON.
- Verified in the in-app browser: the game HUD rendered and browser logs reported no warnings/errors.
- Removed the dead remote sample-bird loader and updated README text so startup has no CDN dependency.

- Applied the 3d-prompt-collection playbook (github.com/petergpt/3d-prompt-collection): true day/night cycle with golden hour, dusk, moon + stars; windows/floodlights that light up at dusk; fireflies at night; butterflies with forage behavior; leaping river fish; and a 🎚️ Low/Med/High graphics-quality button (pixel ratio, shadows, bloom, grass, clouds) persisted to the save.
- Debug helpers: window._setDay(0..1) to set time of day (0=midnight, 0.5=noon), window._life for ambient-agent state.
- Added seamless-SDF procedural critters (technique from x.com/TimJayas/status/2073250825858892241): blobBody() shrink-wraps an icosphere onto a smooth-min SDF of JSON-defined primitives (blended vertex colors + SDF-gradient normals); one gait system (walk4/walk2/hop/float/fly); 18 wildlife agents (bunny/deer/sheep/chicken/duck/bluebird) with wander/graze/flee states, blinking, night roosting (deer crepuscular). window._critters for diagnostics.

- Goal pass (better-than-Star-Equestrian): friend invite links (Club panel button copies ?club=CODE URL; opening it auto-joins), daily golden-horseshoe hunt (replaced the old one-time 12-shoe system; legacy finds still count via stats), wildlife photo rewards/quest (frustum check in photoBtn), mythic stardust trails (TRAIL_COL per coat), contact shadows under critters.
- Testing gotcha: BOTH the Launch preview and occluded Chrome windows suspend rAF entirely (0 fps; setTimeout throttled too). Workaround: patch requestAnimationFrame into a queue, force one native frame via screenshot, then pump frames manually with busy-waits (see session notes). node --check on the extracted gameModule catches syntax errors the custom loader swallows silently.

- Terrain realism pass: rawH now has bigger rolling hills, ridged crests, bluff plateaus with cliff faces (bluff band tuned via measured vnoise percentiles — freq 0.011, band 0.425-0.445), and the Willowbrook stream (streamX/STREAM_JOIN) carved + water strip + reeds; ground vertex colors add slope-rock/crest/bank tints; 256-seg mesh. Horse coats: dapples + roughnessMap sheen. New capture helper: ?shot=x,y,z,tx,ty,tz[,day] pins the camera (works with headless Chrome --screenshot).
- Gotcha: headless Chrome renders the scene much DARKER than real browsers (PMREM env appears black under SwiftShader) — do not tune colors/lighting from headless captures; use them for geometry/layout only.

- Real 3D trees: ported SeedThree's Weber-Penn geometry layer (github.com/SkyeShark/SeedThree, MIT) inline — wpSkeleton/wpBranchGeo (parallel-transport frames)/wpLeafGeo (base-anchored phyllotactic leaf cards, dome normals) + species params for oak/birch(beech)/blossom(maple)/pine(ponderosa), 2 variants each, instanced with leaf wind sway (treeWinds) and MeshDepthMaterial alpha shadows; bushes/cacti stay GLB; quality-low trims tree instance counts. SeedThree repo cloned at Desktop\SeedThree for reference.

- Ground de-tiled: gmat's onBeforeCompile now does 4-tap stochastic no-tile sampling (per-block random UV offsets, bilinear-blended) + macro variation — the visible texture grid is gone.
- Rider rebuilt: the auto-skinned GLB rider (rider_rigged.glb, "mushroom disc" breeches) is RETIRED. makeRider is now a fully articulated segmented figure (torso/neck/head/shoulders/elbows/hips/knees joints, J struct) with a baked riding pose; driveRider animates the player's joints live (leg blend, posting, two-point over jumps, head look-into-turn, breathing, rein hands). NPC/club riders share the same figure. Seat constants RID2_Y/RID2_Z; legacy procedural-mount drive gated behind !USE_GEN_TACK.

TODOs:
- If direct file:// gameplay is required later, the game will need a true bundled non-module build plus a GLB loading strategy that avoids browser file-origin restrictions.
- Further repo-inspired ideas not yet done: LOD for distant objects, era/time slider UI, autonomous NPC routines beyond looping riders.

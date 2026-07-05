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

TODOs:
- If direct file:// gameplay is required later, the game will need a true bundled non-module build plus a GLB loading strategy that avoids browser file-origin restrictions.
- Further repo-inspired ideas not yet done: LOD for distant objects, era/time slider UI, autonomous NPC routines beyond looping riders.

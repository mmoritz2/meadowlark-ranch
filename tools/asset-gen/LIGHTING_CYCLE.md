# Lighting cycle and night haze

The game's `lighting` event runs after the base day-cycle block and before shadow updates, water reflections and the main camera. `world-atmosphere.js` applies its grade at this point, once per simulation step. Its former `scene.onBeforeRender` hook could advance smoothing once per camera, leave its fog state stale when simulation advanced without drawing, and be skipped by the reflection renderer.

Exponential smoothing uses elapsed simulation time. First load and clock jumps larger than 0.02 of the cycle immediately select the current palette; ordinary time progression, weather and region changes remain smooth. The midnight wrap uses circular clock distance. This prevents a dark sky appearing above retained daylight haze during photo-time jumps or simulation-only updates. Repeated renders cannot change fog or lights.

Atmospheric ground sheets, the older valley mist, and Willowmere's six water-mist banks receive the time-of-day sky tint. `G.atmos.registerMist(material)` lets a regional effect use the shared tint. The snow region blends toward the night horizon after dark rather than adding a neutral white haze. Sun, hemisphere, terrain geometry, materials, shadow coverage and riding collision remain otherwise governed by their existing systems. No geometry or texture downloads are added.

## Diagnostic correction

The previous model review's bright night hills were not evidence that the hills stayed bright throughout ordinary nighttime play. That review advanced the simulation with drawing suppressed, while the old atmosphere only advanced in the rendering callback. A fully settled baseline showed dark hill silhouettes. This pass fixes the timing mismatch and the independently visible glowing ground/water mist; it does not claim to have replaced the mountain models.

## Verification

```sh
QA_PORT=8457 PLAYWRIGHT_PATH=/path/to/playwright node tools/qa-lighting-cycle.cjs /path/to/lighting-evidence
QA_PORT=8457 PLAYWRIGHT_PATH=/path/to/playwright node tools/qa-sky-world.cjs /path/to/sky-evidence
QA_PORT=8457 PLAYWRIGHT_PATH=/path/to/playwright node tools/qa-country-world.cjs /path/to/country-evidence
```

The focused suite checks simulation-only day/night changes, repeated-camera stability, matching main/reflection lighting, weather interpolation at 15/30/60 simulation steps per second, midnight continuity, mist tint, finite opaque output, quality tiers, and a mounted nighttime route. Images cover clear day, dawn, sunset, rain, nighttime marsh, village, meadow, Hollowpeak, Frostpine and canyon. This checks lighting consistency, not a mobile frame-rate target.

The existing mountain silhouettes, broad biome transitions, foreground vegetation and character detail remain separate visual work. The scene is not claimed to be identical to the reference game.

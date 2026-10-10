# Local night-riding visual review

Serve the authoritative checkout on the dedicated port:

```sh
python3 -m http.server 18798 --bind 127.0.0.1
```

Open [the visual review](http://127.0.0.1:18798/review/night-riding/), then click **Boot visual review**. The wrapper loads the actual production `ranch3d.html` at roughly 1280 × 720 in a wide browser window. All fixture controls are outside the game iframe.

The origin must be `localhost:18798` or `127.0.0.1:18798`. Boot creates only a disposable save with the exact `night-riding-qa-owned` marker and `qaNightRiding.owned: true`. It refuses unrelated storage without deleting it. An existing marked save with online identity or club data is also refused. The seed has no player name or club and does not connect to multiplayer. The normal engine creates its starter horse.

After the native horse and world scenery are ready, choose **Midnight**, **Dawn**, **Noon**, or **Dusk**; **Low**, **Medium**, or **High** graphics; and a fixed viewpoint. Pasture stages at `(-55, -15)` facing the roundup pen, the woodland trail at `(-14, -41)` facing the pines, and Cottonwood approach at `(27, -31)` facing the village. **Pasture · opposite facing** keeps the same pasture position and turns the rider 180 degrees to compare the moon-facing counterpart. **Reset viewpoint** restores that framing. **Walk forward for 2 seconds** dispatches ordinary W input at walk gait; **Stop riding** releases it.

**Review horse** retains the existing owned starter and offers **White Western** (`white-western`) and **Shire** (`shire`). The two additional choices are granted only when first selected, through the production `G.horse.grantHorse` callback into this marked disposable save; existing owned examples are reused and confirmed by readback. The fixture then reloads the owned roster and uses the production horse selector, waiting for the selected native rig to attach. It does not overwrite the starter or alter any horse coat/material to obtain a desired image. Review grants can affect this disposable save through normal acquisition hooks; they are not gameplay reward evidence.

These are visual fixtures: explicit viewpoint staging is permitted only to compare rendering. It proves no travel, mission, herding, or other gameplay outcomes. Time is held through the existing `_setDay` helper every 50 ms (midnight `0`, dawn `.16`, noon `.5`, dusk `.84`); the production animation/render loop keeps running. There is no `advanceTime`, simulation pause, arbitrary code endpoint, or lighting override. Dawn/dusk follow the game's sun-elevation cycle rather than civil clock labels.

The diagnostic JSON shows requested/current day, graphics tier, animation frame count, camera/player framing, nearby/directional/hemisphere light colors and intensities, fog, atmosphere state, feature errors, and whether a network connection unexpectedly exists. It does not expose the save or player identifiers. Selecting graphics uses `G.gfx.apply`; selecting a viewpoint resets the production riding camera. Some scenery density is chosen at boot, so live quality changes compare the normal graphics switch rather than three independently booted geometry populations.

For baseline/changed comparisons, use the same viewport, time, quality, and viewpoint; wait briefly for the normal camera to settle before capturing. Scenery placement can differ after a reload. The completed visual inspection and its limits are recorded below.


## Completed browser evidence

The [sanitized visual report](visual-report.json) contains compact diagnostics from the local before/after, noon, trail, walk, dawn, dusk, village, White Western, and Shire captures. Raw reports remain at `/private/tmp/night-riding-*.json`; no save or player identity is included.

- **Midnight, Low, pasture:** the browser inspection found the bay distinct against its surroundings after the change, versus the near-black baseline. The White Western retained coat detail.
- **Midnight, High, woodland trail** and **Midnight, Medium, village:** both riding views were readable. Dawn, noon, and dusk were also inspected.
- **Normal movement:** the two-second W/walk control moved the rider **3.9278 m**, from `(-14, -41)` to `(-16.69198, -43.86023)`, while animation and the normal game loop continued. This is a movement check, not a performance benchmark.
- **Shire:** the opposite-facing pasture view was partly occluded by a barn/rock. A separate High-quality native Shire trail capture is included in `night-riding-shire-trail.json`, with the actual `shire` model confirmed and no errors; the obstructed pasture image alone is not proof of a clear shaded-side view.

The main midnight before/after captures use the same player and camera coordinates, but procedural scenery varies between reloads. These are visual comparisons, **not pixel-aligned image tests**. Noon light colors, fog grade, and exposure matched, with fog-density differences only at floating-point rounding scale. The small noon sun-intensity difference follows the moving cloud field. Source review found no added lights or exposure change; all captured exposures were `1`.

Every included report has an empty runtime-error list, an empty feature-error list, and `networkConnected: false`. **18/18 existing related tests passed**, recorded in `/private/tmp/night-riding-tests.log`. This review makes no performance or physical mobile-device claim, and the staged viewpoints do not establish gameplay outcomes.


After these captures, incoming terrain and eyelash changes from `18acd40` were merged. Another **18/18 terrain tests passed** (`/private/tmp/night-riding-merged-tests.log`), in addition to the 18 related tests above. Lighting code was unchanged by this follow-up. The final rendered **Low-pasture and trail smoke check passed** on the reloaded merged candidate with the native Shire: grass and path remained readable, its coat outline and white feet were visible, and the sky stayed dark. Compact diagnostics from `night-riding-merged-pasture.json` and `night-riding-merged-trail.json` are included in the bundle; both report no runtime/feature errors and no network connection. These merged captures supplement the earlier lighting comparisons.

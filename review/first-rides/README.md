# First partners: rescue → ride → first reward

## Why this changed

The existing research in `docs/star-equestrian-evidence-2026-10-05.md` identifies a staged opening ride and a clear next goal as useful patterns. The current ranch instead named both the starter and the rescued pinto Clover, then made Roundup the rescue-result primary action even though the first journey chapter requires Pasture Dash.

New starters are now Bramble; existing names are preserved. A confirmed rescued horse can be selected directly from Homecoming or Activities by saved ID plus the rescue marker. The handoff confirms persistence and waits for the correct attached model before returning to riding. The result offers the actual next journey goal or an earned reward; it never starts a course automatically.

## Reproduce with real gameplay

From the repository, run:

```sh
python3 review/first-rides/serve.py
```

Open `http://127.0.0.1:18800/review/first-rides/`. This dedicated offline server supplies a required verification header, refuses the MQTT client script, and uses a connect-src policy excluding external sockets. Blocking the script is necessary because production otherwise creates a club code before attempting its socket connection. Production networking is unchanged.

The fixture refuses unmarked localStorage and saves with a club identity. On an empty origin it writes only `first-rides-qa-owned`; production creates all save fields. A character name created through the genuine local onboarding is allowed on later boots of this owned origin. No saves are deleted. Use a fresh browser profile for another empty-origin run.

Click **Boot first rides**, fill the real rider name, and click **Saddle up!**. The iframe URL uses `review=first-rides&diagnostics=qa`: the existing diagnostic exposure recognizes the substring, while neither the parsed QA value nor `qa=` onboarding suppression is present. The former `qa=first-rides` URL was rejected as a genuine onboarding test because it skipped the creator; no success claim relies on that run.

Horse readiness and removal of the actual loading curtain enable fixture controls. Optional scenery promises are reported individually rather than blocking the playable game indefinitely.

## Controls and isolation

- Proxies mirror only visible, enabled production buttons: `adventure:`, `journey:`, `rush:`, character save, the two quick activity buttons, reassurance, save retry and adventure cancellation. Each click rechecks the actual button. There is no arbitrary-selector or code endpoint.
- W/A/D/S buttons generate ordinary key events for bounded wall-clock durations. The gait select uses the production riding control.
- **Drive active rescue route** follows the published mission target through normal keys. It stops for the operator to click the real **Reassure Clover** button, then escorts her along the actual ridden line.
- **Drive active Pasture Dash** follows the active production course's six gate positions through ordinary movement. The course engine recognizes all crossings and awards its own result.
- Neither driver changes position, heading, simulation time, course index, trust, rewards, or save progress. Production activity entry may perform its normal start positioning.
- Menus, background state and pending saves release input. A route blocked by scenery may require manual steering. An unexpected live network connection ends the client and stops this offline test.

These drivers exercise normal movement and completion logic; they are not a substitute for a human usability study. The test reports actual rescue/journey/Rush state, mount identity/readiness, scenery status, errors and a compact save summary. It does not export a full save or online identity.

## Automated checks

```sh
node --test tools/test-rescue-adopted-mount.mjs tools/test-rescue-homecoming.mjs tools/test-rescue-rides.mjs tools/test-rider-journey.mjs
```

Coverage includes model delay/timeout/retry, wrong or detached rigs, persistence failures, renamed/sold horses, stale rosters, active-ride gates, on-foot entry, reopening Activities while a mount is pending, truthful later-chapter goals, once-only adoption/rewards, and explicit tack equip.

## Browser evidence

Recorded JSON and images in this directory document the playtest. The rescue was completed with normal wall-time inputs and explicit reassurance, then adopted and ridden as horse ID 2 (pinto). Bramble remained ID 1. The selection and rescue records survived a production reload. Further course/reward outcomes are recorded in `playtest-results.json`.

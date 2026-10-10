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

- Proxies mirror only visible production buttons and preserve their disabled state: `adventure:`, `journey:`, `rush:`, `herd:`, character save, the two quick activity buttons, reassurance, save retry and adventure cancellation. Each click rechecks the actual button. The `herd:` scope mirrors visible roundup result controls for saving, riding again, changing difficulty, choosing an activity, or closing the result; it does not provide a direct roundup API or arbitrary-selector/code endpoint.
- W/A/D/S buttons generate ordinary key events for bounded wall-clock durations. **Jump · Space** sends a short ordinary Space press; production decides whether the mounted horse can jump. The gait select uses the production riding control.
- **Drive active rescue route** follows the published mission target through normal keys. It stops for the operator to click the real **Reassure Clover** button, then escorts her along the actual ridden line.
- **Drive active Ranch Rush** requires a course already started through the actual UI. It follows gates and low logs in Pasture Dash, River Run or Trailblazer with ordinary riding keys and production gait selection. With **Jump assistance** on (the default), it asks for a jump with a short Space press when the actual visible course-guide cue says `perfect` or `good`. It does not assign jump age, height or a grade. Assistance off permits an ordinary grounded approach to a log; the driver stops after the first actual refusal rather than repeatedly driving into it. Turn assistance back on and click Drive again to exercise recovery.
- Rush recovery follows only the production guide's published `recovery()` target. It steers around the rail or back to the approach, then turns into line as requested by that guide. A blocked recovery with no target stops input for manual inspection; the fixture never teleports a rider or changes the course. New refusals, unexpected course changes, menus/background state and a sustained physical stall also stop the Rush driver. The actual course clock may keep running after keys are released, according to production behavior.
- **Drive active beginner roundup** requires an already active solo beginner roundup started through production UI. It follows the published horse/pressure target with ordinary W/A/D/S events and production gait selection, using walk near the target and trot for longer approaches. It circles behind a horse when needed, releases input during countdowns, menus or pending saves, and stops when the activity ends. Full and shared herd sessions are outside this driver’s scope.
- **Herd spacing** compares rider steering aims. Value `9` follows the unchanged published gold-ring position; obstacles may make that marker differ from exactly nine metres. Value `7.5` aims closer only when the rider is already behind the horse and near its approach line. It changes the rider’s aiming point, not the production marker or horse pressure rule. Both choices use real collision handling; a selected spacing is not a guarantee of a clear path.
- None of the drivers directly changes rider or loose-horse position/heading, horse speed, simulation time, course index, pen counts, trust, rewards, or save progress. They generate riding inputs; production owns horse motion, elapsed time, crossings and completion. Production activity entry may perform its normal start positioning.
- Menus, background state and pending saves release input. A route blocked by scenery may require manual steering. An unexpected live network connection ends the client and stops this offline test.

These drivers exercise normal movement and completion logic; they are not a human usability study or evidence that a new player finds the controls intuitive. The report includes actual rescue/journey/Rush/roundup state, mount identity/readiness, driver status/aim, scenery status, errors and a compact save summary. It does not export a full save or online identity.

`roundupTrace` records up to 250 diagnostic samples for the current roundup run, restarting when its run ID changes. Samples are taken when reported game elapsed time advances by at least 0.75 seconds, rather than advancing that clock. Each row contains elapsed time, penned count, target horse name/position, pressure cue, rider-to-horse distance, reported horse speed, approach-blocked state, and rider position/speed. It lets a reviewer distinguish spacing, steering, stalls and obstacle effects from an actual pen crossing. Recording a row never moves a horse or awards progress.

`rushTrace` retains up to 300 compact observations for the most recently observed production Rush course. It records reported course elapsed time without advancing it, checkpoint index/kind/position, signed approach distance and lateral offset, the actual jump cue, recovery phase/target, rider position/speed/height, read-only native jump age, actual grades/refusals, assistance setting and input events. Rows are added at course/cue/grade/jump-state changes, explicit fixture input events, or at least half a reported game second apart. Final grades remain available through the retained course observation when the live course closes. A Space-request row is evidence of an input request; only the course engine's grade and result prove a crossing. These fixture controls do not establish that River Run or Trailblazer is playable until a real wall-time run is recorded.

## Automated checks

```sh
node --test tools/test-rescue-adopted-mount.mjs tools/test-rescue-homecoming.mjs tools/test-rescue-rides.mjs tools/test-rider-journey.mjs
```

Coverage includes model delay/timeout/retry, wrong or detached rigs, persistence failures, renamed/sold horses, stale rosters, active-ride gates, on-foot entry, reopening Activities while a mount is pending, truthful later-chapter goals, once-only adoption/rewards, and explicit tack equip.

## Browser evidence

Recorded JSON and images in this directory document the playtest. The rescue was completed with normal wall-time inputs and explicit reassurance, then adopted and ridden as horse ID 2 (pinto). Bramble remained ID 1. The selection and rescue records survived a production reload. Further course/reward outcomes are recorded in `playtest-results.json`.

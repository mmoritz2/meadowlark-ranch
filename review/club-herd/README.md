# Two-client club herd review

This review runs two independent production ranch clients against the existing MQTT transport. Each origin has its own disposable anonymous save. The parent receives reports through an origin- and source-checked `postMessage` exchange; it does not read the guest frame across origins or inject network packets.

Serve the same checkout in two terminals:

```sh
python3 -m http.server 18796 --bind 127.0.0.1
```

```sh
python3 -m http.server 18797 --bind 127.0.0.1
```

Open [the parent review](http://127.0.0.1:18796/review/club-herd/review.html). It generates a private `qah-…` club code, keeps it in the URL, and derives two distinct QA network IDs from it. Keep the same hostname on both ports. An explicit `?code=qah-…` may contain 6–20 lowercase letters/digits after the prefix, at most 24 characters overall.

## Normal UI sequence

The parent shows stable **QA Host** and **QA Guest** control groups above the client frames. These mirror the wrapper buttons and the production herd buttons that are currently visible, with their actual labels and disabled states. Use these controls if browser automation cannot focus the cross-origin guest. A click sends a fixed, source/origin/club-code checked request; the wrapper finds the exact still-visible and enabled button and invokes its DOM `click()` handler. Game actions are restricted to the known `clubherd:` controls plus the live HUD Leave button. There is no controller-command, state-mutation, arbitrary-selector, or code-evaluation endpoint. A stale or disabled control is refused and recorded as the last click.

1. Click **Load client wrappers**. Boot each wrapper with its visible **Boot QA client** button. For lower GPU load, let the first client finish loading before booting the second.
2. Boot writes only a marked QA seed before loading the production engine. The seeded `pid` is `ID:` plus the desired network ID without its initial `p`, matching the production ID derivation. The fixed names are **QA Host** and **QA Guest**, quality is Low, both members are recorded under the same private club, and the founder is the host ID. The starter horse is created normally by the game.
3. The production engine normally connects automatically because the anonymous QA name is already set. Use **Connect** if needed. Each report must show a distinct expected ID, the same club room, and `net.connected: true`.
4. Click **Open club** in each wrapper. In the host game's Ride Together view, click **Host herd drive**. In the guest game, click the actual **Join** button and then **Ready**. Hosting marks the host ready. The wrappers never call Host, Join, Ready, or Start on the controller.
5. Select **Joined and ready** in the parent and click **Verify visible reports**. Both reports must show the same lobby with the two actual ready riders, and the host must be able to start.
6. Click **Start herd drive** in the host game. The controller stages each consenting rider. Close any remaining menu with the game's controls. Ride manually, or use **Drive with keys** in each wrapper. Select **Both riding and herd movement**, wait for several report samples, and verify.
7. To inspect pause, use **Open club** on the host. This releases its driver keys and opens the normal game screen. Select **Host pause reaches guest** and verify the shared paused state. Close the game's screen before continuing.
8. To inspect leave, use the actual in-game **Leave** / **End herd drive** controls. To exercise a lost transport, use a wrapper's **Disconnect MQTT** button instead: it ends that real MQTT client, leaving the production controller to handle the interruption. Allow the heartbeat timeout to settle, then select **Both left / disconnected** and verify. Inspect the guest's intermediate `waitingForHost` state in the live reports when disconnecting the host.
9. A full completion is optional for the initial check. If both riders physically bring all five horses home, select **Completed shared record** and verify that both clients saved the same result. Do not interpret the joining, movement, or pause checks as proof of completion.

The parent reports a pass for the **selected phase only**. It retains at most 180 one-second samples per client and 20 verification results. Movement checks use samples from the current shared session only. The live-frame comparison allows less than 3 m of interpolated position difference and less than 2 s of elapsed difference; it is a bounded transport/interpolation check, not exact simultaneous frame equality.

## Input and evidence boundaries

The optional host driver steers behind the currently selected horse. The guest driver approaches a flank behind its selected horse. Both dispatch ordinary W/A/S/D events and choose walk or trot through the existing riding API, on a 100 ms wall-time interval. They release controls when menus, photo mode, host pause, or loss of the herd blocks riding. **Stop keys** releases all held inputs.

Neither driver teleports the player, changes horse positions, sets pen counts, assigns elapsed time, calls `advanceTime`, fabricates participants, or sends synthetic herd messages. The only player staging is the production controller's accepted Start. The fixture does not promise that either driver can complete every randomized obstacle layout.

Each visible client report includes the production network identity/connection, `G.roundup.shared.state()`, the controller snapshot, player position, target/pressure guidance, driver target, feature errors, and captured uncaught errors after boot. Persisted data is restricted to the owned QA marker, that QA club's membership projection, and its separate herd-record summary. No full ranch save is exposed. The parent may request a report with the allowlisted `club-herd-qa-request` / `report` message or relay a fixed UI click with `club-herd-qa-command`, always for this exact code and expected source/origin. Reports include the current permitted buttons and the latest click result; there is no command-evaluation endpoint.

## Save and network isolation

The host wrapper accepts only localhost port **18796** and the guest only **18797**. Existing storage is accepted only with the exact `club-herd-qa-owned` marker and a ranch save containing `qaHerd.owned: true`. It refuses unrelated storage and never deletes it. For a refusal, keep that storage intact and use a fresh browser profile on these dedicated origins. Published-game and other-port saves are separate.

A later run may reuse the owned anonymous QA save, but replaces its QA identity and private club metadata for the selected room before loading the engine. It never imports user data. `pub: false` keeps the QA club out of public listings; the existing MQTT broker is still the real transport. Only the fixed QA names and owned anonymous game state are used.

## Regression coverage

```sh
node --test tools/test-club-herd-protocol.mjs tools/test-shared-roundup-core.mjs tools/test-club-herd-controller.mjs tools/test-club-herd-ui.mjs
```

The focused protocol, core, controller, and UI suites passed **90/90** checks. The wider related regression run passed **327/327**. The UI suite executes the real installer with a small DOM fixture; the other suites cover admission, shared physics, save confirmation, replay handling, startup, packet ordering, and cleanup. Local logs are `/private/tmp/club-herd-focused.log` and `/private/tmp/club-herd-regression.log`. Currency non-award is covered by regressions; wallet changes were not measured in this browser run.

## Completed browser evidence

The [sanitized evidence bundle](browser-report.json) preserves each scenario's check labels/results and compact client state, plus both saved receipts. The raw local reports remain under `/private/tmp/club-herd-{lobby,moving,pause,finished,left,disconnected}-report.json`; no full save is included in the repository bundle.

Two independently booted production clients joined the same private QA club through the actual UI and real MQTT connection. Parent proxy controls dispatched clicks to the visible production buttons. After accepted Start, both riders used ordinary keyboard movement and walk/trot gait controls in real wall time, without position, pen-count, or elapsed-time patches.

| Scenario | Verified result |
| --- | --- |
| Join and Ready | 9/9 checks; both real riders ready in the same lobby and host allowed to start. |
| Riding | 11/11 checks; both riders moved, with five host horses and four guest horses measurably changing position in the sampled interval. Maximum sampled position difference was 1.9665 m and clock difference 0.7677 s, within the stated interpolation tolerance. |
| Host menu pause | 10/10 checks; both clients paused at 48.7789 s. The browser operator also confirmed the stopwatch stayed fixed across samples. |
| Five-horse completion | 6/6 checks; both saved the same run in **138.57 s**, each with **plays: 1** and **one receipt**. |
| Free ride | 6/6 checks; both shared cores and current sessions cleared, while each retained its one completed receipt. |
| Live disconnect | 6/6 checks after a second drive reached about 2.3 s and the guest's actual MQTT client was ended. The guest reported connection loss; the host reported disconnected teammates. Both released their herd and kept plays/receipt count at one. |

Completed run: `pqahbbe4f0741c224e3fh-mv2ib2nr-reixb`. Both participants were the fixed anonymous **QA Host** and **QA Guest**. Exported reports contained no feature or uncaught runtime errors.

The result and action controls were visually inspected and reachable at a **390 × 844 browser viewport**. Screenshot evidence remains local, outside the repository: with base directory `/private/tmp`, the relative filenames are `club-herd-complete.jpg`, `club-herd-phone-result.jpg`, `club-herd-phone-actions.jpg`, and `club-herd-pause.jpg`. No binary screenshots were added.

## Issues corrected and remaining limits

The initial two-client startup exposed a renderer delay that could exhaust the ordinary peer timeout before the guest finished staging. Startup now holds the countdown, stopwatch, and herd physics until every admitted guest supplies its first valid input, with a bounded 30-second failure path. The normal disconnect timeout starts after staging is released. The completed browser run used this correction; delayed staging and timeout edges also have focused regressions.

Review also found that a host leaving immediately after completion could strand a guest that missed the final frame. The host now retains the terminal frame with QoS 1; the guest makes bounded recovery requests and validates the recovered frame before saving. Source regressions exercise dropped final delivery, host exit, duplicate delivery, and exhausted recovery. The successful live completion confirms the normal path, not deliberate packet loss.

The cross-origin browser automation could not reliably focus the guest's nested controls. The fixture's fixed, checked UI proxies resolved that test limitation by invoking the same actual visible button handlers; they do not call herd-controller commands.

This evidence does **not** claim testing on a physical mobile device or an authenticated/authoritative multiplayer server. Night-time gameplay looked quite dark during the run; a lighting follow-up is outside this feature's scope.

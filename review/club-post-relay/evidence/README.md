# Cottonwood relay acceptance evidence

A normal two-client private-club road ride completed through W/A/D/S and ordinary gait selection, with explicit post collection, Offer/Accept twice, Ada exchange, and Wren delivery. Both real clients saved the same 660.27 s / 288.19 m receipt with two handoffs, exactly one play each. Both normal reloads retained that exact receipt and count. No identity, membership, horse, position, simulation-time, ownership, completion or reward fields were injected.

The time includes deliberate operator inspection and waiting. This is a functional ride, not a speed benchmark or human enjoyment study. The successful run used one explicit driver restart after a held-key release and explicit Stop controls before both handoffs. Subsequent fixture-only regressions cover the keyup-cache repair and holding during a pending handoff. They do not replace a future uninterrupted driver run.

Both actors rode home to Wren. The retained receipt projections are the authoritative save/readback evidence. The public JSON replaces anonymous test rider IDs and the private room code with role aliases; raw diagnostics stay local. These projections cannot be replayed as protocol packets.

## Scope of the artifacts

- `relay-ready.json` is the first normal club/lobby setup, before an abandoned pilot; it is not the successful run's session identifier.
- `relay-post-offered.json` captures an offer that the old review driver invalidated by moving; the subsequent explicit stopped Offer/Accept is captured by `relay-post-passed.json` at state revision 7.
- `relay-post-passed.json`, `relay-ada-exchanged.json`, `relay-reply-before-offer.json`, `relay-reply-passed.json`, and `relay-finished-saved.json` follow the completed run.
- `relay-persisted-reload.json` proves matching saved receipts and one play after both ordinary reloads. The production feature and post-boot runtime error projections are empty. The browser logged MQTT close messages during reload and an iframe XR permission warning; this is not an error-free-browser claim.
- `relay-remote-pouch-fixed.json` comes from a separate short inspection after normal reload. Both actual engines reported one visible parcel with the same courier owner: local on one client and attached to the real remote rig on the other. Remote rigs do not have the local-player `ready` field; the UI now checks their actual attached scene. This is engine attachment evidence, not a pixel-level visual proof. The later screenshot missed the active relay state and is excluded.
- `relay-phone-lobby-full.png` and `relay-phone-result.png` show the actual 390×844 lobby and saved result. Lobby buttons measured 44 px high and the card had no horizontal overflow. Further landscape/handoff and physical-device usability remain useful follow-up checks.
- `focused-checks.tap`: 91 passing Node test entries for protocol, actual queued two-client controller, UI/core finish, mounted loading, and existing club compatibility. The club-rides entry also contains its 20 checks.
- The separate `tools/test-club-post-relay-review-*.cjs` tests cover exact receipt matching, automatic reporting coalescing, held-key recovery and handoff holding.
- `loading-live-verification.json`: the earlier independently published loading fix's three live files matched commit 317a50d exactly after Pages run 38280351284 succeeded. Relay release verification will be recorded separately.

The two earlier pilots were not recorded: permissive gate/bend marker radii exposed early corner cutting, and the old review key cache could miss a brief production release. All surveyed relay pins now use 0.8 m reach. The final road circuit passed those paths; no collision shapes were removed or player motion forced. Woodland/native jumps, role-swapped full trips, stale/reordered actions, one-sided save failures and final-frame recovery have source/controller tests; the complete physical browser circuit used the road and host-first roles only.

This proves a working cooperative delivery loop. It does not prove Star Equestrian parity, native App Store readiness, server-authenticated multiplayer authority, physical-phone performance or subjective enjoyment.

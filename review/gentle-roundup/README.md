# Gentle Roundup: readable pressure and room to learn

Validated against baseline `fea3743` plus this change on 2026-10-10. This continues the genuine first-rides save: rescue Clover, ride her through Pasture Dash, bring the runaways home, then claim and equip the next Journey reward.

## What changed

Beginner horses now respond at walking pace with a continuous distance-dependent speed curve. A selected horse has a visible ring and a named HUD target; both rings turn green only when the rider is guiding it toward home. Crowding, turning and blocked paths have distinct truthful cues. Each pen crossing briefly announces the horse by name before handing off to the next.

The beginner limit is 150 seconds, with the existing 65% gold rule giving a 97.5-second target. The first clean ring-following attempt took 113.11 seconds, leaving only 6.89 seconds under the former 120-second limit. The new allowance gives that same time 36.89 seconds of recovery room. Full and shared herd speeds and behavior are preserved.

Rewards remain 540 coins, one gem, 18 pass points and 12 star points for all three horses. Remaining-time scoring means a complete run at the same elapsed time receives 150 extra score points under the longer limit; old medals are not recalculated and old records, receipts and Journey claims are preserved.

## Real browser results

The dedicated offline first-rides fixture generated ordinary W/A/D/S input and production gait selection. Production owned every horse position, elapsed time, collision, pen crossing, payout and save. Activity starts, reward claims and tack equip used the actual visible game buttons. The fixture did not inject progress or connect to multiplayer.

| Ride | Timer | Full herd | Elapsed | Medal | Saved |
| --- | ---: | ---: | ---: | --- | --- |
| Follow the gold ring | 120 s | 3/3 | 113.11 s | Silver | Yes |
| Closer safe steering aim | 150 s | 3/3 | 106.33 s | Silver | Yes |

Both rides had zero browser/feature errors. The second result left 43.67 seconds and improved the saved best time. Neither sampled trace reported crowding or a blocked path. The first completion unlocked Steady Hands; its Silver bridle was claimed and explicitly equipped through the real game screens. After a production reload, the 106.33-second best, two completed plays, claimed chapter and equipped bridle remained intact, and River Rhythm was the next chapter.

These are normal-input driver runs, not human usability evidence. The 97.5-second gold target is **not yet verified by a physical gold completion**. The closer attempt missed it by 8.83 seconds. The timing audit contains explicitly labeled projections from the first ride, not proof of gold. No whole-game quality parity claim follows from these checks.

- `playtest-results.json`: actual results, trace samples, earned tack and after-reload state.
- `riding.jpg`: actual HUD and world during the second ride.
- `result.jpg`: actual second result and saved reward.
- `earned-bridle.jpg`: actual Journey claim/equip state.
- `timing-audit.json`: first-run timing analysis and its limits.
- `tests.tap`: 212 passing checks, no failures.

## Reproduce

Follow `../first-rides/README.md` to run the isolated server and create or resume its owned test save. Start **Round up 3 horses** through Activities, choose a herd spacing, then click **Drive active beginner roundup**. Inspect the result and reload to check persistence. This driver does not cover full/shared herd playability.

```sh
node --test tools/test-roundup-pressure.mjs tools/test-roundup-approach.mjs tools/test-roundup-steering.mjs tools/test-roundup-completion.mjs tools/test-roundup-rewards.mjs tools/test-roundup-presentation.mjs tools/test-roundup-hud.mjs tools/test-shared-roundup-core.mjs tools/test-club-herd-controller.mjs tools/test-club-herd-protocol.mjs tools/test-club-herd-ui.mjs tools/test-club-rally.mjs tools/test-rider-journey.mjs
```

Coverage includes continuous pressure, warning precedence, real core steering/collisions and target handoff, full/shared behavior, stable focused HUD controls, exact gold boundary, pending-save retry, once-only payouts and old 120-second records surviving a new 150-second finish. An independent read-only review found no material regression.

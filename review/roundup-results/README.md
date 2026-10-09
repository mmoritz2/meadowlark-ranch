# Roundup result and retry review

This fixture runs the production ranch on the dedicated `http://127.0.0.1:18795` origin. It exercises a gentle roundup through keyboard-driven riding, then deliberately blocks its first completion payment so the pending result and visible save retry can be inspected.

## Run through the browser UI

From the repository root, serve the checkout:

```sh
python3 -m http.server 18795 --bind 127.0.0.1
```

Open [the review page](http://127.0.0.1:18795/review/roundup-results/review.html) in a normal browser. Keep the same tab open through the pending-save test.

1. Click **Load isolated ranch**. The fixture creates a disposable ranch, places its story cursor on the production roundup objective, and reloads so the live cursor matches the saved state. It opens Activities.
2. In the game, choose **Round up 3 horses**. Once the roundup starts, click the review page's **Ride the roundup** button.
3. Let the driver ride. It dispatches ordinary W/A/S/D keyboard events, trots between positioning targets more than 8 m away, and walks when close behind a horse. Production movement, herding pressure, pen crossings, countdown, and timer determine the outcome. The fixture steps the production game clock while steering; it never assigns or patches elapsed time, remaining time, or the time limit. It does not teleport the rider, reposition herd members, assign penned counts, or invoke completion directly.
4. At the finish, inspect the game's pending result. Click **Verify pending save** on the review page. This checks that the deliberately rejected completion write has not awarded money, records, pass points, weekly progress, or story progress.
5. Click **Allow saving** on the review page, then **Retry save** in the game's result panel. Finally click **Verify saved result** on the review page to check the durable receipt, displayed reward amounts, one successful completion write, record count, penned count, and live/saved story agreement.
6. Use **390 × 844**, **667 × 375**, and **960 × 600** to inspect the actual HUD and pending/saved result panels at those iframe sizes. These controls resize the game viewport; they do not themselves assert visual quality.

The report on the right records checks and failures. A `PASSED` status belongs to that completed browser run only. The optional [save inspection page](http://127.0.0.1:18795/review/roundup-results/save-check.html) displays the marked fixture's persisted reward and progress fields.

## Save isolation and payment baseline

The fixture refuses to boot outside `localhost:18795` or `127.0.0.1:18795`. Use the `127.0.0.1` URL consistently: browser storage is scoped to an exact origin, including hostname and port.

It will not overwrite an unrelated save. An origin containing storage is accepted only when both its `roundup-qa-owned` marker is `anonymous disposable roundup QA` and its ranch save has `qaRoundup: true`. Subsequent runs may reuse that marked QA save. If boot refuses an unrelated save, leave it intact and use a fresh browser profile for this dedicated origin. Published-game saves and saves on other ports are separate.

The rider is anonymous and its network client is disconnected. The fixture deliberately changes the story objective only in this owned QA save. It does not need an account or alter a player's live ranch.

Ordinary route collectibles can change the wallet while the rider is approaching or herding. Therefore the failed-save comparison and reward delta use the persisted baseline captured **immediately before the first blocked completion write**, not the earlier start-of-ride wallet. The report retains both `before` and `beforeCompletion` to make that distinction visible.

The storage fault targets the new receipt for this exact `runId`; ordinary earlier save writes are not rejected. The first completion attempt throws before storage is updated. **Allow saving** removes that targeted fault, and the player-facing **Retry save** performs the production retry. Ambiguous writes that succeed before throwing, unreadable confirmation, and repeated retries are covered by the focused regression suite below.

## Approach and obstacle corrections

The physical review exposed a pressure marker that could point outside a playable guiding position, and a horse that stalled against shelter/tree geometry. The production fixes now select bounded positions behind the target horse, inside its pressure radius, with a clear approach from the rider. If no candidate is usable, the HUD hides the ring and asks the rider to circle for a clear route.

A pressured horse now checks its proposed path and can take a consistent detour around an obstacle while staying in the half-plane away from the rider. Collider, wall, and native solid-geometry checks remain in force. Captured-coordinate regressions cover the shelter stall and escape; final whole-herd browser evidence is tracked separately below.

## Focused regressions

Run the six focused suites from the repository root (78 tests):

```sh
node --test \
  tools/test-roundup-approach.mjs \
  tools/test-roundup-steering.mjs \
  tools/test-roundup-rewards.mjs \
  tools/test-roundup-completion.mjs \
  tools/test-roundup-presentation.mjs \
  tools/test-roundup-hud.mjs
```

- Approach selection: 14 tests for pressure-zone positioning, clear rider paths, bounded candidates, obstacle contacts, and blocked approaches.
- Production steering: 5 tests for the captured shelter escape, a continuing walk-pressure route around the cluster, unchanged unobstructed movement, consistent detour sides, and preserved wall/solid contacts.
- Reward rules: 18 tests for valid finish proof, durable receipts, failed/ambiguous writes, retries, and independent best medal/score/time records.
- Production completion integration: 14 tests using extracted production functions, including actual finish-gate logic, retained actors during pending saves, partial timeouts, cancellation, pause guards, weekly/pass/progress credit, and story recovery without replaying a claimed successor.
- Result guidance: 23 tests for gold targets, paused/pending language, and next-attempt advice.
- Actual HUD installation: 4 tests for stable button identity and focus across live updates, pending-result reopening, handlers using current state before the next paint, and clear blocked-approach guidance.

All 78 focused tests passed. The broader related regression run also passed 164 tests.

The integration fixtures prove that a saved full-herd gold result is retained and recognized by Rider Journey, including the equal-rounded-score medal case. Those are synthetic state fixtures executing production code; they are **not** evidence of physically riding a five-horse gold roundup. The browser fixture above rides the three-horse gentle mode and reports whether it brought everyone home or reached the real time limit.

## Browser results

- A physical partial roundup brought **1 of 3 horses** home. Its injected payment failure and visible save retry passed **19 checks**.
- With corrected steering, the walk-driven run brought **2 of 3 horses** home at the production **120 s** limit. Its save/retry verification also passed **19 checks**.
- The final normal-keyboard trot/walk run, **`mv1a7mft-j6myc7`**, brought **all 3 horses** home in **80.75 s** (displayed as **80.8 s**), with the final steering code loaded. It earned **silver**, **1,096 points**, **540 coins**, **1 gem**, **18 pass points**, and **12 Star Points**. Story objective 49 advanced from **0 to 3**.

The final run passed **19 of 19 checks** after the deliberately failed completion write and the actual **Retry save** action. It recorded **one successful completion write** and **no feature/runtime hook errors**. The compact [browser report](browser-report.json) retains the final receipt, check labels/results, errors, and responsive inspection dimensions; it omits the full save and earlier receipt history.

The saved result was inspected at **390 × 844**: scroll width was **390 px**, there was no horizontal overflow, main buttons were **46 px** high, and Journey buttons were **44 px** high. At **667 × 375**, the lower result buttons were reachable by scrolling.

These browser results establish a physically completed three-horse gentle roundup and its save/retry path. They do not claim a physically completed five-horse gold round; that reward and Journey behavior is covered by the production-core fixtures above.

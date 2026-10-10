# Ranch Rush: retry the log, keep the ride

Baseline: `1cfb568`. This change helps a rider recover from a low-log refusal or missed approach during casual Ranch Rush. The course guide publishes a clear route around the rail or back to the approach, then asks the rider to face the log. The riding HUD prioritizes that route and the actual takeoff cue over a previous score flash. A horse already jumping is told to stay straight.

Casual Rush remains active after three refusals so the rider can learn the jump and finish. Refusals still reset the chain and count as penalties. Formal events retain their existing third-refusal elimination rule. The recovery guide changes only its route and presentation; the course engine still owns crossings, grades, penalties and completion.

## Recorded River Runs

The same ordinary-input run deliberately approached checkpoint 3 without Space three times. Each refusal released the fixture keys; after the third, the real course was still active at that checkpoint. Turning jump assistance on and resuming followed the production recovery route. The two real log grades were **perfect** and **good**, with all six gates clean.

The result was **silver, 1,363 points in 95.46 seconds**, with **three retained penalties** and a recorded **147-coin course payout**. River Rhythm then became claimable. Its actual claim awarded the recorded 250 coins and Leaping Silver Shoes of Stamina; the shoes were explicitly equipped, and Journey advanced to Trail Partners.

A production reload preserved the silver record, time, score, one play and the same run ID. River Rhythm stayed claimed, its shoes stayed owned and equipped, and Trail Partners stayed current. The observed diagnostics contained no browser or feature errors and no live network connection.

A second real River Run (`mv2q03dh-1-bphalg`) approached the first log, retained one refusal, then moved grounded past its plane beside the rail end (observed across +.517 m, lateral 3.333 m; no jump active). The log stayed uncredited at checkpoint 3. Ordinary-input recovery subsequently produced **good/good** log grades and finished **8/8 checkpoints**, earning **bronze, 1,313 points and 147 coins**. The prior **silver, 1,363 points / 95.46 s** best remained intact, and the saved River play count became 2. Its receipt time **1,787.98s includes about 29 minutes idle during the separate front audit**; it is not representative completion performance.

That second run used already-loaded browser code from before the latest gradual-movement recovery-cache fix. It verifies the observed grounded side-skim/no-credit/recovery behavior in that build; it does not browser-verify the new cache branch. The separate final-code run below verifies that branch. The merged regression TAP records 72 passing tests with zero failures.

A third run (`mv2r8fvw-1-zqlzum`) used the final reviewed recovery code. After one real refusal, slow ordinary Walk inputs moved beside and past the log while grounded. The cached guide updated its approach path during small movements, then switched to **around**, targeting `(32.868272,107.818019)`. Checkpoint 3, the one refusal and the absence of jump credit all stayed intact. The rider then recovered through ordinary input, earned **good/perfect** log grades and finished all eight checkpoints with six clean gates.

That final result was **silver, 1,400 points and 147 coins**, with one retained penalty. Play count became 3 and best score became 1,400; the prior **95.46 s best time and its splits remained unchanged**. Receipt **190.05 s includes manual inspection pauses**, so this is a correctness check, not a speed claim. The recorded module hashes identify the unchanged booted course guide, event discipline and Rush UI code; they do not claim a complete replay after later rider/terrain changes.

A fresh boot of merged build `79c9c45` then confirmed the saved **three plays, 1,400-point best score, 95.46 s best time and original best-time splits**, with the final run ID retained. River Rhythm remained claimed, its shoes remained owned and equipped, and Trail Partners remained current. No browser or feature errors were observed. This confirms persistence after the merge; the riding replay above still identifies its three reviewed modules.

| Evidence | What it shows |
| --- | --- |
| `river-first-refusal.json` / `.jpg` | First real refusal and the published return-to-approach target |
| `river-third-refusal.json` / `.jpg` | Three refusals; the same course remains active at checkpoint 3 |
| `river-recovered-finish.json` / `.jpg` | Actual log grades, gates, penalties and saved course result |
| `river-earned-shoes.json` / `.jpg` | Claimed River Rhythm reward, explicit equip and next chapter |
| `river-reloaded.json` | Persisted first-run record, claim and equipped shoes after reload |
| `river-side-skim-start.json` / `.jpg` | Grounded past the log beside its end, checkpoint still uncredited |
| `river-side-skim-finish.json` / `.jpg` | Ordinary-input recovery, real good/good jumps, second receipt and preserved best |
| `river-final-refusal.json` | Final-code first real refusal at the same first log |
| `river-final-side-skim.json` / `.jpg` | Slow grounded side movement updates approach to around without credit |
| `river-final-finish.json` / `.jpg` | Final-code good/perfect recovery, real receipt and preserved best time |
| `river-final-reloaded.json` | Merged-build fresh boot preserves plays, score, best time, claim and equipment |
| `trail-merged-finish.json` / `.jpg` | One actual merged-build Trailblazer, real grades/result and next Journey goal |
| `playtest-results.json` | Compact findings and explicit verification status |
| `validation.tap` | Final merged 72-test batch on `79c9c45`, zero failures |

The evidence JSON files retain selected relevant diagnostic fields, trace transitions and source hashes. They do not contain a full save or online identity. Result time comes from the actual Ranch Rush receipt; the retained course observation is only a diagnostic snapshot.

## Reproduce through ordinary gameplay

1. Run `python3 review/first-rides/serve.py` and open `http://127.0.0.1:18800/review/first-rides/`. Use an empty or already marked fixture-owned origin; unrelated saves and club identities are refused.
2. Boot and complete the genuine production onboarding. Start River Run through its actual visible production button. Starting an activity performs production's normal start positioning.
3. Set **Jump assistance** to **Off · test refusal** and click **Drive active Ranch Rush**. The wrapper dispatches normal W/A/D/S inputs and selects a production gait. It stops after a real refusal. Resume twice with assistance off to obtain three genuine refusals without ending the casual course.
4. Set assistance to **Use real jump cue** and resume. The driver follows `G.courseGuide.recovery()` targets and sends a short ordinary Space press when `jumpCue()` says good or perfect. It stops for blocked recovery, an unexpected course, a new refusal, UI/background interruption or a physical stall. Manual controls and **Jump · Space** remain available.
5. Inspect the actual result, claim the earned Journey reward and explicitly equip it through production buttons. Reload, then inspect the saved River record and Journey ownership/equipment state.

The fixture does not write rider position, heading, speed, simulation time, jump age, course index, grades, penalties, rewards or save progress. Its only save-related write is the disposable-origin marker. Normal gameplay owns motion and elapsed time; no accelerated clock or fabricated crossing was used in this run.

## Merged Trailblazer smoke

One ordinary-input Trailblazer run on merged build `79c9c45` completed **10/10 checkpoints** in a recorded **50.77 seconds**. Its actual log grades were **early/good/good**; seven gates were clean and the one early-jump penalty remained. The saved result was **silver, 2,034 points and 189 coins**, with one Trailblazer play. Journey marked its Trailblazer goal done and directed the rider to the remaining full-roundup goal of five horses. No browser or feature errors were observed.

This is one offline run with the existing mount and input driver. It establishes that this longer course completed on the merged build; it is not a claim about all breeds, touch-only play, multiplayer or human usability.

## Focused validation and limits

The recorded test batch covers ordinary jump cues, wrong-side/post-skimming recovery geometry, obstruction checks, guide caching, no backward-crossing credit, retained Rush penalties, formal elimination, score receipts and Journey claim/equip persistence. To repeat that batch:

```sh
node --test tools/test-event-guidance.mjs tools/test-event-resume.mjs tools/test-follow-camera-input.mjs tools/test-follow-camera.mjs tools/test-ranch-rush.mjs tools/test-rider-journey.mjs tools/test-rush-recovery.mjs tools/test-rush-refusal.mjs tools/test-rush-riding-cue.mjs
```

The grounded side skim is observed in the second run, with its earlier-code limitation, and the final third run separately verifies the reviewed gradual-movement cache behavior. This evidence covers three offline River Runs on the saved pinto mount. One merged-build Trailblazer smoke run is recorded separately above. All breeds, touch-only play and multiplayer remain untested, and an input driver is not a human usability study.

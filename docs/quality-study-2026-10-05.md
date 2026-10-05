# Meadowlark playability study — 5 October 2026

Research ran from 12:10:25 to 13:11:08 UTC (07:10–08:11 Chicago), completing
the requested hour while implementation and testing proceeded in parallel.
The [18-source evidence record](star-equestrian-evidence-2026-10-05.md) separates
official claims, inspected footage, captions and recommendations. Code presence
is not evidence of equal quality.

## Method

Reviewed official Foxie Ventures material, sampled actual gameplay videos in
the browser, and compared them with Meadowlark's running game and source at
`ee58c7b`. Video timestamps below identify inspected material; they do not imply
every second of every video was watched. The installed Star Equestrian app did
not produce a running window after supported launch attempts, so direct play
was not achieved. No reference game assets were copied or new horse models
downloaded.

## Observed differences and this implementation

| Area | Evidence | Meadowlark change or remaining gap |
| --- | --- | --- |
| Riding control | Gait arrows, a readable current pace and a separate jump control appear in mounted gameplay at 4:01 of [GG Reloaded's playthrough](https://www.youtube.com/watch?v=NE-bk5UszIw). | Explicit walk/trot/canter/gallop selection, held stop and deliberate backward walk. The old touch input could only vary canter speed. Existing fast travel tuning and approved horse assets are preserved. |
| Camera and phone layout | The same playthrough leaves room to read the route ahead. Direct Meadowlark inspection showed a very close riding view; landscape phone QA found a 300 px joystick overlapping objectives and offscreen buttons. | Wider default camera, protected camera dragging and release grace, compact landscape controls with safe-area positioning. Actual device performance is still unverified. |
| Objectives | First-time footage uses one short active instruction and a visible destination: [Green Horse Games, 2:50–4:16](https://www.youtube.com/watch?v=kdqLgeEOlGs). | Collection markers resolve to available matching food. Action tasks no longer point prematurely to the giver. The existing quest pill provides a next action and opens the relevant existing screen. Completed tasks still return to the giver. |
| Event preparation | [Showmanship guide, 5:00–8:00](https://www.youtube.com/watch?v=qYfrcLgOjRY) shows horse suitability and the expected routine before entry. | The existing event mathematics are reused: horse name, actual/required stats and trained/tack contributions become visible on touch. Full card opens the existing detailed discipline card. Meadowlark's showmanship rules remain different. |
| Course feedback | GG Reloaded at 4:49 shows course timing, fence count, a route line and obstacle marker. [Seasonal gameplay, 35:42](https://www.youtube.com/watch?v=pY5vMbekkno) shows immediate jump timing feedback. | Meadowlark already has route chevrons and timing bands in `course-guide.js`. A duplicate guide was not added. Full event feel and fault tuning need a separate playtest. |
| Newer dressage | [May 2026 dressage footage, 10:43–11:45 and 16:38](https://www.youtube.com/watch?v=yj9k1tgFzrc) shows a mounted arena routine and separate horse-match/performance results. | This newer event differs from the older social dressage trailer and Meadowlark's riding controls. Matching the discipline name does not mean matching its mechanics or quality. |
| Art and motion | Official [dressage trailer, 0:18](https://www.youtube.com/watch?v=cdpjYxFk82k) shows consistent horse/rider silhouettes in formation. [Pegasus trailer, 0:18 and 0:26](https://www.youtube.com/watch?v=qXro5Mxw950) shows separated wings and an airborne leg pose. | These are animation/art references, not rig data or proof of a particular input system. This change preserves the user's approved models. A full art, animation-transition and performance pass remains necessary. |
| World and social space | Official [Ranch Party trailer, 0:06 and 0:15](https://www.youtube.com/watch?v=AQBgRJ8-V8g) shows a clear exterior path and social interior. | Meadowlark needs coherent route composition and measured crowded-scene performance. This promotional clip does not establish the game's build-placement controls. |

## System depth that a matching screen does not provide

Star Equestrian combines exploration/story, horse collection and progression,
competition, ranch building and social activity. Its official description is a
useful scope reference, not an acceptance test for Meadowlark.
[Official game page](https://www.foxieventures.com/star-equestrian/),
[current features](https://starequestrian.com/).

The developer interview describes iteration with horse enthusiasts, separate
gaits and free camera control, and deliberately optional care. The relevant
lesson is to validate how the existing ride feels. Meadowlark already disables
passive needs decay; reimplementing that would not address the reported problem.
The interview also describes beta players requesting features that already
existed because the tutorial had not exposed them, and a deliberately easier
opening horse. Discoverability and starter handling matter independently of
the number of systems implemented.
[Foxie developer interview](https://www.themanequest.com/blog/2023/3/29/we-wanted-to-build-a-horse-game-that-people-could-be-passionate-about-the-inspirations-research-and-future-plans-behind-star-equestrian).

Club pages and reward counters are not an authenticated multiplayer service.
Meadowlark's current web protocol uses a public broker and client-maintained
roles. Server identity, authoritative progression, moderation operations and
reliable reporting are still substantial work. Native development therefore
starts offline. The web club behavior is unchanged by this release.

## iOS development foundation

The [mobile project](../mobile/README.md) prepares a self-contained local bundle,
an iOS project, durable-save handling and lifecycle hooks. Browser smoke tests
can establish local asset availability; they cannot establish WKWebView,
physical iPhone performance, signing, or Apple approval.

Two existing source assets require particular release attention: the WildMesh
horse foundation and Black Dragon retain noncommercial restrictions. Their
derivatives retain those source restrictions. Existing attribution does not
establish permission for a commercial release. The exact intended distribution
must be cleared or approved replacement art selected before release.
[Recorded asset credits](../assets/models/horse-imports/ATTRIBUTION.md),
[CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/).

Apple reviews originality, lasting app functionality, privacy and social-content
handling. Packaging this web game is only one engineering step. Current SDK,
signing, physical-device acceptance, final branding and published support/privacy
information are tracked as open gates in
[release-status.json](../mobile/release-status.json).
[Apple review guidelines](https://developer.apple.com/app-store/review/guidelines/).

## Validation record

- Four real touch-selected paces reached approximately 2.10 / 4.41 / 7.88 /
  15.75 m/s with the starter test fixture. Holding Stop reduced 15.75 m/s to
  0.059 m/s in 0.8 seconds with forward input still held. Backing up reached
  -1.17 m/s with the authored walk playing backward and 677 finite joint
  transforms. Top speeds were not reduced.
- Camera drag held its angle while moving and through the release grace period,
  then resumed following. Stop's focused keyboard controls did not also jump.
  Landscape 844 × 390 and portrait layouts were inspected in a desktop browser
  with touch emulation, not on an actual iPhone.
- Fresh-session touch-only check reached character setup, riding to Wren,
  naming the foal, claiming the mission and selecting Gallop through the task
  instruction. It recorded 6.11 m of actual travel and 4.43 / 300 m of quest
  progress, with no keyboard movement, scripted quest completion or page
  errors. This is not a completed prologue or full first-course test.
- Collection targets, completion returning to the giver, Gallop/Build shortcuts,
  event detail visibility and Full card/back navigation were checked. Event
  preparation displays actual entry stats, including trained/tack contributions;
  its level requirement follows the selected difficulty.
- A traced first-session queue contained thirteen startup messages. Deferring
  promotional/discovery notices at their publishers reduced it to five welcome,
  story and earned-reward messages. One-time notice flags remain unconsumed in
  the prologue. A before/after comparison preserved 325 coins, 7 gems, 30 pass
  points, four tickets, calendar/welcome day one and the 150-coin/3-gem inbox
  gift. The first task's instruction fit its 312 × 43 px touch layout. No page
  errors occurred. The earlier apparent stuck toast was queued late; its actual
  visible lifetime was 3.11 seconds, so no timer workaround was introduced.
- Eight native save-core tests passed, including interrupted/corrupt writes,
  ordering, reload barriers and a reset arriving during an older write. Staged
  browser smoke passed asset loading, the approved horse, primary panels, save
  reload, input release and rendering pause/resume with no page/resource errors
  or external requests. Existing named saves opened without a WebSocket.
- The local bundle preserves the pinned approved horse body hashes. It remains
  approximately 559 MiB with conservative legacy assets included. It has not
  been archived or run through the native Filesystem plugin on a device.

Baseline high-quality browser profiling on a desktop Metal GPU measured a
10.3-second cold hero load, about 129 MiB of encoded resource content and a
33.4 ms median frame interval over ten seconds. These identify optimization
work; they are not physical-phone benchmarks or evidence of performance parity.

## Second playability pass

A fresh, isolated touch session completed the prologue, entered the available
Novice Welcome Jump through the Events screen, rode all five fences, received
one finish ribbon plus 158 coins and 4 gems, and closed the result to resume
riding. Naming, claiming and riding used the real UI. No teleport, edited
progress or debug completion was used. Reload preserved the earned save.
This branches to an available event after the prologue; the intervening
builder and food chapters have not had the same complete acceptance run.
The round was not a clean win, and its time includes long inspection pauses.

The playthrough produced these implemented corrections:

- The Gallop selector remains tappable beside Wren's Talk prompt. The first
  gallop objective guides a new rider through the actual south gate.
- Hay and its collision boundary were moved away from Wren's direct exit.
  A matching opening in the north rails, posts, kickboards and collision wall
  permits walking to the old stall. Both routes passed actual touch riding.
- Conversations use a readable bottom panel, hide riding controls, stop held
  input and keep keyboard focus inside. Name entry and quest callbacks are
  preserved. A key held through closing must be released before riding resumes.
  Actual attempts to use the former joystick area caused zero travel while
  talking. Browser checks cover Tab, Enter, Space, Escape, focus restoration,
  held-key repeat and both phone orientations.
- Event instructions, the horse's current/required stats and entry-lock reason
  sit with the Ride control. Jump cues now use the actual forward crossing
  and fence width; race gates, reversing and missed approaches cannot display
  a false green jump cue. Result suggestions use the same entry locks as Ride.
- The final fence grade is priced before rewards and the score snapshot,
  fixing omitted last-fence points and false clean-round credit. Fence and
  time faults have separate labels; refusal chips are no longer duplicated.
  Refusal instructions name the touch or keyboard control in use.
- Loading no longer declares failure at nine seconds or reveals a placeholder
  horse at twelve seconds. A slow connection retains its loading stage and
  offers Retry; a real failed module or horse request reports a failure.
  An actual held/aborted module request verified the slow, failed and retry
  paths. Optional scenery model requests are deferred behind the player horse,
  with a twenty-second fallback. The previous seven-second fallback started
  scenery just before the horse was ready in the controlled loading fixture;
  the longer fallback lets the normal horse-ready trigger take precedence.

The functional run used desktop Chromium/Metal at 844 × 390, DPR 2, with touch
input and isolated storage; it is not a physical iPhone performance result.
No page errors occurred. Focused regression tests cover cue geometry, entry
locks, final-fence rewards, first-gallop guidance, deferred loading and loading
recovery. Approved horse bodies and gait files were not changed.

The final controlled Medium-quality loading run confirmed zero catalogue
requests before the horse attached, followed by all ten original scenery
models loading without request, model, feature or page errors. This proves
request priority, not an FPS gain or a general loading-time improvement.
Integrated dialogue and event preparation fit both 844 × 390 and 390 × 844
viewports. After incorporating main's latest rendering fixes, the combined
game passed the same phone layout smoke test. Its iOS development bundle was
resynced and all 660 file hashes,
relative imports and save/lifecycle seams verified; the approved horse hashes
remain intact. Native device execution is still unverified.

## Next quality milestones

1. Extend the touch acceptance run through the builder and food story chapters,
   then complete a clean competition win and repeat across disciplines. Verify
   prompts, navigation, rewards and return paths with normal play.
2. Profile low, medium and high quality on actual supported iPhones/iPads.
   Measure cold start, frame time, memory, sustained heat and battery behavior;
   establish the supported-device floor before choosing a performance target.
3. Give the world a consistent art direction and clear riding routes. Audit
   horse/rider scale, tack contact, transitions, camera collisions and silhouettes
   across the approved roster in the same lighting and terrain.
4. Build authenticated, authoritative club progression and moderation before
   enabling public social play in the native app. Existing club screens and a
   public messaging broker do not satisfy this requirement.
5. Resolve the recorded asset rights and complete the native release gates,
   including original branding, support/privacy pages, age rating, signing,
   device acceptance and App Review submission.

This is a tested foundation and a research-backed work order, not a claim that
Meadowlark now matches Star Equestrian or is ready for the App Store.

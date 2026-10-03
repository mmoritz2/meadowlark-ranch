# Native dragon motion

These motion bundles target the approved dragons' original skeletons. They do
not contain replacement geometry, textures, skin weights or inverse bind matrices.

- **Black Dragon:** [3DHaupt's Black Dragon with Idle Animation](https://sketchfab.com/3d-models/black-dragon-with-idle-animation-fb0053a2e59b43868e934c239bf4eb36), CC BY-NC 4.0, with the listing's NoAI restriction retained. The 232-joint source model and creator Scene clip remain unchanged. Meadowlark Ranch authored DragonStand, DragonWalk, DragonRun and DragonFly using numerical limb solving, joint curves, skin evaluation and ordinary rendering. The new motion folds each wing on its own side of the body, flexes the legs and feet, and animates the neck, tail and wing fingers. Flight carries the tail in a gentle arc with one slow wave over two wingbeats. Its four legs flex visibly around the carried tuck with staggered recovery and trailing foot motion. The 20-second standing sequence includes quiet breathing, a side-to-side neck shake, a slow bow with a brief hold, and recovery. Idle feet stay planted; the original walk and run tracks are unchanged. No generative image or asset tools were used.
- **European Dragon:** [Regina Cachoa's listing](https://sketchfab.com/3d-models/european-dragon-82f393a2e6c048ad80c171ce3b3a7b87), embedded author Nonexistent 101, CC BY 4.0. The original 169-joint model and five creator animations remain preserved. The Walk and Run replacements keep their original joint tracks and add only measured vertical scene correction to prevent feet penetrating the floor. Creator stand, sit and flight remain unchanged.

The Ranch blends between these poses, follows the animated seat, and controls
actual ascent/descent. Takeoff and landing use blended ground/flight poses;
there are no separate authored jump or takeoff/landing clips. Hovering keeps a
full wingbeat even with no forward travel. The Black Dragon begins gathering its
wings during the final 45 cm of a requested landing, using a 0.8-second blend
that continues through touchdown. Cancelling the landing restores the flight
pose smoothly; hovering near the ground does not trigger the fold.

Ground controls: Ctrl+W walk, W run, Shift+W faster run. Space or Fly takes off;
Space climbs, Shift descends, W flies forward, and Land requests a gradual
descent. Press the landing button again to cancel descent.

Travel is intentionally fast game movement (up to 10 m/s running and 20 m/s
flight), with bounded animation cadence. Source stride metadata is preserved;
foot contact is not matched to these faster travel distances.

Build/audit tools are under `tools/dragon-motions/`. Black Dragon source measurements are in the adjacent JSON file; European
grounding measurements and both bundle hashes are recorded in the review reports. Controller and
mounted regression tools are `tools/qa-dragon-controller.mjs` and
`tools/qa-dragon-rigging.cjs`; evidence is under `review/dragon-rigging/`.

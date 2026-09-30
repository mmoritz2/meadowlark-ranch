# Native clip controller integration prototype

This private bridge preserves the realistic horse's complete 677-joint native animation. It is not installed in the game. Only creator Idle, original rest, and the [contact-reviewed slow Walk](../target-native-walk/README.md) are enabled. Unsupported gaits raise an explicit error rather than changing to another clip.

The .40 m stance stroke over 65% of a 1.12-second cycle implies **.549450549 m/s** at native scale. Actor travel stays outside the AnimationMixer root and uses that exact speed; actor/parent scaling also affects the reported world speed and distance. The game's existing 2.1 m/s Walk threshold does not fit this measured slow gait.

Changing to Idle or rest restores every saved native bone transform first, preventing Walk-only head, mane, tail, and leg tracks from leaving Idle in a partially animated pose. Start and stop are immediate here. Gait transitions, turning contact, and Ranch integration remain unfinished.

The local browser integration check compares all 677 native bone poses against direct source-clip playback, verifies exact travel distance, rotated and scaled travel, restored Idle/rest, disposal, and rejection of unavailable gaits. The saved [result](qa-summary.json) has no failures or browser errors. It establishes playback correctness; the separate forward-travel and rider preview measures actual hoof contact and equipment fit. The slow Walk still has sideways sole movement of approximately 5 mm in front and 10 mm behind and lacks natural hoof rollover.

Run from the review checkout with its local server active:

```sh
NODE_PATH=/Users/mbphome/.npm-global/lib/node_modules QA_PORT=8577 node review/native-horse-controller/qa.cjs
```

The command writes generated output under `output/native-horse-controller/`. Source model credits and the target's noncommercial license remain in the [horse review](../target-native-walk/README.md); new animation code does not change that license.

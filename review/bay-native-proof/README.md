# Bay 677-joint motion proof — failed visual gate

This is a **private, unapproved experiment**. The Bay body is fitted to the
[WildMesh 3D white Western horse](https://sketchfab.com/3d-models/horse-realistic-3d-model-demo-free-65d6a70a6721495f938c93e80a5998e4)
rig, retaining 677 joints, original skin influences and the creator's Idle and
Walk clips. The source is CC BY-NC 4.0. No new source media were downloaded for
this proof, and no public roster or deployment was changed.

The fit works technically: all rest joint positions match their target within
`1e-7` source units, the original default-pose skin operator is preserved, and
1,092 translation channels are shifted to follow the new rest positions.
Browser QA sampled 96 Walk phases plus 16 side/quarter captures: all geometry
was finite, with 677 bones and zero browser errors. These checks do **not**
establish a good gait.

The Walk still crouches and folds a foreleg/hock unnaturally. A fixed upper-back
surface marker is **1.578 m in Idle** and **1.445–1.507 m during Walk**, a
roughly 6–13 cm drop. This marker is only a same-vertex comparison, not an
official withers measurement. The same low source motion appears on the white
horse. Lowest individual hoof points in the Bay proof range down to 9.5 mm
below ground; these values alone cannot validate foot contact. The native
source has no Trot, Canter, Gallop or Jump clips.

Representative frames: [Idle side](fulljoint-idle-side.png),
[Walk phase 0 side](fulljoint-side-0.png),
[Walk phase 0.5 side](fulljoint-side-4.png). If the ignored generated GLB is
present, [open the interactive proof](review.html) and inspect the full cycle.

To regenerate in this isolated branch, run `python3 review/bay-native-proof/build.py`
then `python3 review/bay-native-proof/build-fulljoint.py`. Both write ignored
files under `output/native-bay-proof/`. They require the tracked native white
candidate, Bay rig input, breed profiles, existing asset-generation modules,
and NumPy. Serve the repository at `127.0.0.1:8577` and run
`NODE_PATH=/Users/mbphome/.npm-global/lib/node_modules QA_PORT=8577 node review/bay-native-proof/qa.cjs`
to regenerate the browser report and screenshots. The viewer's internal
`withers` property labels this fixed upper-back marker; the QA script records
it as `upperBackMarkerM`.

This fitting method may be useful after better motion is authored or licensed.
It must not be treated as a replacement horse gait.

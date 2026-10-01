# White Walk height correction — failed visual gate

This private study used the already acquired [WildMesh 3D white Western horse](https://sketchfab.com/3d-models/horse-realistic-3d-model-demo-free-65d6a70a6721495f938c93e80a5998e4)
and its original 677-joint Walk. It changed a review pose only: lift the horse
and try to return each hoof to the source path with a damped leg-chain solve.
No source GLB, roster, or public site was changed; no new model was downloaded.
The source remains CC BY-NC 4.0.

**Verdict: blocked.** At the best tested target, 115 of 278 baseline
planted-hoof samples hovered more than 1 cm. The worst lifted hoof floated
4.3 cm, while another penetrated 1.5 cm; the leg solver missed a target by up
to 5.1 cm. Side and quarter views still showed stretched, unsupported legs.
All 96 sampled poses had finite geometry and zero browser errors, which does
not make the gait believable.

The source Walk itself lowers the pelvis joint 4.6–11.1 cm, a trunk spine joint
8.4–10.5 cm, the lower neck 5.4–11.2 cm, and the head 21.9–26.3 cm versus
Idle across 96 phases. A formerly cited body vertex (index 1931) is mostly
weighted to the neck; it cannot measure withers or trunk height. A global lift
partly compensates the neck droop by raising the feet, leaving the hunched
outline. A further Idle-leg blend increased penetration and target error.
A separate spine-weighted trunk vertex (index 1998) was 1.481 m in Idle and
1.375–1.403 m during the source Walk. The attempted lift only brought it to
1.411–1.458 m, while losing hoof contact. Neither vertex has been validated
as an anatomical withers marker.

Compare [original Walk phase 0](original-walk-0.png) with
[lifted phase 0](lifted-walk-0.png), and [original half-cycle](original-walk-half.png)
with [lifted half-cycle](lifted-walk-half.png). The ignored local experiment,
including its viewer and full report, is under `output/native-walk-correction/`
in this isolated checkout. A usable Walk needs separately corrected pelvis,
spine, and neck motion with reauthored stance mechanics and direct skinned-hoof
contact checks. The separate mane/tail prototype was not validated on this
failed body correction. Its per-frame solver also required hundreds of
677-joint matrix updates; any future fix should be baked offline and checked
for browser performance before integration.

A second private test removed part of the source Walk's constant pelvis,
spine, and neck pose bias while keeping its cyclic motion. The head and trunk
posture improved, but a one-pass offline solve of three leg joints against
actual skinned hoof soles still left **164 of 278** source-planted samples more
than 1 cm high (worst 3.23 cm). The trunk marker remained 1.423–1.451 m against
1.481 m in Idle. The [side view at phase 0](curve-stance-0.png) and
[half-cycle](curve-stance-half.png) still show unsupported hooves, especially
behind. Its full ignored report is under `output/native-curve-repair/`.
This second trial is blocked too; neither pose is ready to become a Ranch gait.

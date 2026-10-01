# Focused transition review

The bounded transition change passes pose continuity, actual-time blending, finite-transform and mounted attachment checks. It is an improvement over instant gait resets. It does not pass a universal planted-hoof or strict10 mm floor test at every transition phase.

Final controller SHA: `2f44f6641225c9ab2d8b102b188da48fe9f45538211f0fb50d3a7808ad04edb6`. Both saved browser reports match this exact response body. No request routing was used.

## Actual native asset check

Four preserved models were loaded through the real breed loader. Eighteen before/after cases sampled48 steps at120 Hz, including White/Bay stand↔walk at rate0.12, walk→trot, trot→canter, canter lead change, trot→default rest, and an interrupted blend. Horse set() has zero immediate joint angle change, compared with up to65.295° in the baseline horse cases. Ordinary source motion continues during the following frames; the largest sampled horse step afterward is7.569°/8.333 ms, not a claim that source gaits are slower than their existing rates.

Every sampled transform was finite. Actor position and orientation stayed unchanged. Every uninterrupted horse fade finished at0.20 s, including rate0.12; an interruption at0.075 s finished at0.275 s. Final active action count is1. Bay default-rest/stand output retains `clip:null` and `restFallback:true`.

The isolated original-rest low-vertex floor set includes all skinned meshes whose default vertices lie below0.25 m. It observed transient floor penetration up to7.613 mm. This is a sampled low-region check, not a full cycle or all-vertex certification.

All final creator-dragon cases equal the deployed baseline's pose jump and floor result. European source Walk→Run still has a56.422 mm floor dip in this sample; the rejected universal blend's87.029 mm dip is absent. This task makes no dragon ground-contact approval.

## Actual mounted Ranch

The real catalog added and mounted White and Bay. Forty-two120 Hz input steps per scenario drove the actual game motion, player movement, rider fitting and original tack. Ten scenarios covered slow walk, trot, canter, opposite lead and stand. The controller response was recorded by URL and SHA.

All677 horse joints and rider transforms stayed finite. Original non-rein equipment remained intact. Actual skinned boot-sole means stayed within3.787 µm of the moving stirrup treads. Dynamic rein endpoints stayed within2.627e−15 m of the moving bit and hands. Every fade finished at0.20 s. Bay stopped in default rest with no source clip name.

Floor limits are recorded separately:

| Check | Worst observed |
| --- | ---: |
| White walk→trot, body minimum in actor plane | −10.724 mm |
| White lead change, actor plane | −9.987 mm |
| White lead change, terrain height at horse center | −20.307 mm |
| Bay walk→trot, actor plane | −9.226 mm |
| Bay lead change, actor plane | −8.537 mm |
| Bay lead change, terrain height at horse center | −16.484 mm |

The mounted test evaluates every body vertex; actor-plane values remove external steering orientation and translation. Center-terrain comparisons also include steering tilt and the terrain under the actor center, rather than per-hoof terrain. No terrain IK, extra actor travel, automatic body lift or hidden floor correction was added. White's10.724 mm transient narrowly exceeds the prior10 mm contact tolerance. The report labels mounted attachment as passing and the strict actor-plane floor band as failing.

Blending two valid limb poses is not a contact-constrained transition solver. Foot planting may slide or briefly dip during the0.20 s blend. This is a narrow release improvement to gait switching, with these limits preserved; it is not whole-roster naturalism approval.

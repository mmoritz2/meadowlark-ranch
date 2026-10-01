# White Western Canter continuity revision

The original full native White rig, skin, Western tack and groom remain unchanged. Both separately authored Canter leads use warm bounded joint solves, blended airborne hoof anchors and a gradual lift ramp. Largest exported limb steps are 4.814° left and 4.763° right per 5 ms, compared with the previous 7.037°/15.923°. The independently generated loop closes within 0.000005°.

Candidate SHA256: `a63cf46de007b0906aff307cdee82e044c3441b8fa5c56fbd809d2a0f95dd820`.

Independent 512-phase browser checks per lead found all 677 joints finite, zero errors, three-beat support with suspension, stance hoof gaps 0.769–4.271 mm and regional planted-foot drift ≤0.610 mm at 1.953125 m/s. Actual mounted game code was checked at 64 phases per lead: skinned boots remained seated to within 0.743 micrometres and reins retained bit/fist endpoints. The mounted candidate used a private routed combined asset; the saved production kit is separately checked without routes.

This improves continuity and contact; it is not all-breed or final naturalism approval. Short stride and limb-bound plateaus remain, and transitions, gallop and jumps are separate work.

`build.py` writes `output/native-white-canter-continuous/canter.glb`. The saved candidate is used by the combined White kit. `audit-preservation.py` compares native source data and curves, and `qa.cjs` scans the saved model through `viewer.html` on the local HTTP server. Original WildMesh source/credit and CC BY-NC 4.0 apply.

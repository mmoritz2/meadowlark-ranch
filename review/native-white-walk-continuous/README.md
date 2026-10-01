# White Western Walk continuity revision

Private revised motion on the original WildMesh full native rig, skin, materials, Western tack and groom. No replacement source was downloaded.

The original rollover Walk's largest exported limb step was 12.058 degrees per 8.75 ms. This revision uses a symmetric quartic 45 mm hoof lift with zero endpoint velocity, gradually blends toe/sole/heel anchors while airborne, keeps the original high torso, and regularizes actual local joint rotation changes and acceleration. After six warm cycles, the independently solved next-cycle pose differs by 0.000001038 degrees. Only after this recurrence check are tiny numerical endpoint differences closed, with periodic cubic quaternion/translation tangents.

Final candidate SHA256: `a6c048b0607388df079e4d69b7a226a86df073e7978fb9b563c4cd862e94bc22`. Original source: `fd18d9b9b22e00dc30a6fa1cfe2e135bb20f7c871df0a976706aaea2f4dff655`. Native 677 joints, five skinned source parts and all source binary data are unchanged.

Exported largest authored limb interval is 4.888 degrees per 8.75 ms (558.6 degrees/s interval average). Browser 256-phase rendering reports all 677 finite joints, zero errors, no Walk flight, stance gaps below 5 mm, whole-body floor above 0, and less than 5 mm drift for each planted heel/sole/toe region at 0.54945 m/s. The gait retains body/head/neck and groom motion. Reports include exact float32 curves and actual skinned contacts between keys.

This is an incremental motion improvement, not a claim that all breeds, transitions, faster riding, gallop or jumps are finished. Limb limits are still reached during part of the stride; mounted/full-speed review is separate.

Rebuild: `PYTHONDONTWRITEBYTECODE=1 python3 review/native-white-walk-continuous/build.py`, then copy the emitted model/report from `output/native-white-walk-continuous/` to this folder and run `audit-steps.py` and `qa.cjs` with the local review server.

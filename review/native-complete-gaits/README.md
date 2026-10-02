# Complete horse motion rollout

The approved White Western Trot was fitted to every existing horse foundation. The 25 artist body files remain unchanged; their 45 catalog profiles and fantasy aliases receive fitted 40-joint motion. Three Western horses retain their complete 677-joint rigs. Runtime assets, source attribution, and rebuild directions are in `assets/models/horse-motions/` and `tools/native-gaits/`.

Current verified motions: standing/idle, Walk, approved Trot, Canter with both leads, and one-shot Jump. Gallop remains private authoring work until the visible stride and limb continuity pass.

Validation includes actual GLTF-loader skinning of all 25 Trot curves and 100 Walk/Canter/Jump cases; all were finite and retained their original body hashes. Runtime Jump clips use body-scaled height and sqrt-scaled duration. Mounted native three, Quarter Horse, Welsh and Shire passed gait input and jump/landing recovery; Pegasus retained flight. The creature dragons retain their original clips.

The authoring curve/contact reports live in `roster/`; `production-ranch-report.json` and `release-verification.json` record the game checks. Motion-only bundles retain input clip hashes. Rejected solver variants, duplicate full GLBs and temporary screenshots are excluded from the commit.

These are flat-ground checks and normal-speed visual reviews. They do not certify every obstacle, arbitrary jump entry speed, terrain-contact correction or continuously differentiable retarget curves.

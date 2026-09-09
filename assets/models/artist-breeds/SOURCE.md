# Authored breed library

Original horse mesh and UVs by **b2przemo**, licensed **Creative Commons Attribution 3.0**. Source: https://blendswap.com/blend/13903 . Original license, author and distribution archive are retained in `../horse-candidates/b2przemo/SOURCE.md` and its `source/` directory.

These are derivative works: breed conformation cages, adapted rest joints, coats, groom variations and lower-leg feather by this project. The approved original GLB is preserved unchanged and recorded by SHA-256 in the manifest. The 24 real breed bodies have different regional geometry, not only different colors. The additional Bay Sporthorse has its own athletic conformation. Fantasy identities inherit the named real foundation, with fantasy materials and appendages supplied by the game.

Rebuild with Blender 5.2: `blender --background --disable-autoexec --python tools/asset-gen/build-artist-breeds.py`. Each GLB has an editable `.blend`, coat PNG and profile JSON. `-- --only bay,black` builds selected breeds. `-- --missing` resumes missing builds. All models are +Z forward / +Y up, have a 40-joint named skeleton and neutral Rest and gentle Idle. Runtime movement is fitted to the new rest joints. Fast-gait art quality needs motion review; clip names or joint counts alone do not establish quality.

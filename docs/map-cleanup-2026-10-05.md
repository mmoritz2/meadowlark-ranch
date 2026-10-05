# Map cleanup — 5 October 2026

The ranch now has shorter maintained grass, open approaches, quieter meadow color variation and smaller, less saturated wildflower patches. The decorative flora pass removes about 49% of its instances in the seeded visual review (35,262 to 17,862); this is a planting count, not an FPS claim. Trees, gameplay pickups and destinations are retained.

Ranch and regional bridleways share existing soil albedo, normal and roughness maps. Slower width variation and feathered shoulders replace jagged pale ribbons. Nine samples across each ranch track follow the collision surface with a 2.5 cm offset. Approach paths fade out at the arena's sand footing. Small ground stones are seated using their actual geometry bounds.

Scanned tree materials now preserve alpha coverage on multisampled render targets, with the existing opaque cutout behavior on single-sample targets. Unreliable partially covered atlas normals have less influence on lighting; finite-normal guards remain. Tree replacement honors cleared seed matrices and hidden individual tree roots.

Integrated on top of `567224a`, preserving the mature woodland, thaw margins, stone scans and timber entry already on main. No new assets were downloaded for this pass. Horse models, motion, speeds, route centerlines and collision surfaces were not edited.

## Verification

- Native Metal render checks at arrival, ranch, pasture, river, Highfell and River Road West, including High/Medium/Low modes: no browser, feature, asset or WebGL errors; zero nonfinite HDR pixels.
- All ranch road vertices remain within 0.025004 m of ground; no nonzero road alpha inside the protected arena ellipse.
- High/Low flora fixtures retain byte-identical tree transforms/colors and the same colliders and forest points.
- All five tree atlases pass isolated MSAA and single-sample rendering. Coverage fixture produces partial edge pixels only when MSAA is active; single-sample silhouette is unchanged. No NaN/Infinity pixels.
- Syntax and whitespace checks pass. A separate fresh portrait viewport checks phone camera sizing; this is desktop browser emulation, not physical-device testing.

Local screenshots and machine-readable evidence are under `/private/tmp/meadowlark-map-cleanup/`. The final check uses a signed-out account stub on the local static server; the public GitHub Pages build already disables the account API there.

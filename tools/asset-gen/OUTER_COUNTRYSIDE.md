# Continuous outer countryside

The flat horizon disc left a level green gap between the riding terrain and the
backdrop mountains. It is replaced by an original, continuous ring of rolling
foothills. The first ring copies every edge vertex, colour and normal of the
existing 1000 m terrain; progressively coarser bands continue to 1700 m from the
world centre. The riding height field, boundary and collision data are unchanged.

Clustered woodland continues across the foothills using the existing CC0 Poly
Haven eight-angle, normal-mapped tree atlases. Tree roots are sampled from the
actual terrain triangles. Northern groves use conifers, and dry western slopes
have fewer trees. Snow, grass and canyon materials extend the existing regions.
The terrain and trees share the distant mountain haze, blended at the inner seam.
The opaque foliage and finite-normal guards remain active.

Composition reference: Foxie Ventures' official field image,
https://www.foxieventures.com/wp-content/uploads/2023/01/Field-Ride-Into-A-Huge-Open-World.jpg
used to compare overlapping terrain and grouped woodland. This geometry is
original. No Star Equestrian assets or new texture downloads are included.

## Cost and validation

The landscape uses 20,992 triangles, 11,791 vertices and one draw. Its 1,930 tree
instances add 3,860 triangles and ten draws, with three cloned materials sharing
existing atlas textures. These distant trees do not use the nearby full-model
budget. No geometry is animated or rebuilt per frame.

Three unit checks cover the original terrain remaining unchanged, continuous
annulus coverage without gaps or inverted triangles, and roots matching the
actual surface. The native-GPU foothills review checks 13 views including night,
sunset, rain and all three graphics tiers. It compares 505 protected ground
samples to unmodified ac91310, rides into the existing world boundary, and checks
finite, opaque render targets and WebGL/asset errors. The country-world regression
covers existing meadows, village, roads, planting budgets and graphics tiers.

The baseline and first art trials are kept in the task's output directory. The
first trial was lowered after review because its hills crowded the mountain
skyline. This remains scenery outside the existing riding area, with the same
455 m movement boundary. Distant mountains and aerial planting remain simplified;
small regional props, waterfall spray and NPC presentation still need work to
approach the reference. Mobile frame time and memory have not been verified.

Final local result: all 45 checks passed (3 unit, 16 focused landscape, 26 country
regression), with 29 captured views. The 505 protected heights and mounted
hoof/ground offset differ by zero; the shared outer seam differs by less than
0.000001 m. The mounted boundary check remains at 455 m and the camera stays
at least 2.57 m above the sampled riding ground. No asset, feature or WebGL errors
were reported. The country regression also includes the newer main-branch rider
and Ember Friesian changes.

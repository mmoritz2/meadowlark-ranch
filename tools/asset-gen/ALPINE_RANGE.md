# Hollowpeak northern divide

The old waterfall stood on an isolated mound in a flat, visibly tiled snowfield.
Five unequal overlapping shoulders now connect its rear catchment to a northern
ridgeline. The range is part of the existing 512-cell terrain height field, shared
by the visible ground and riding height. It reuses the existing CC0 Poly Haven
marble cliff maps and their world-space normal mapping; no new downloads are required.

The unchanged waterfall channel, basins and approach are surrounded by protected
height masks. The Frostpine route and settlement have broad clear corridors. The
same terrain triangles carry the rock material and cast the range's shadows.
Cliff collision contours extend around the new faces with finite flight clearance.

Snow coverage continues over the new range, lies on shallow slopes and leaves
steep rock exposed. Rotated, offset-blended samples suppress the old diamond
texture repeat. High/medium use four snow samples; low uses two. All tiers reuse
the same existing texture. Snowy ridge trees use the existing scanned fir/pine
library, and grass/flowers are cleared from the new snow cover. Smaller, less
frequent foreground shoots leave more of the original snowfield visible.

Composition reference: Foxie Ventures' official open-world field image,
https://www.foxieventures.com/wp-content/uploads/2023/01/Field-Ride-Into-A-Huge-Open-World.jpg
used to compare overlapping terrain, clear riding spaces and background depth.
The new landforms are original, not extracted from Star Equestrian.

## Validation

`tools/test-falls-landscape.mjs` checks ground/rock triangle agreement, water
clearance, protected approach and settlement points, finite collision clearance,
and the connected northern divide.

`tools/qa-mountain-falls.cjs` records 17 views including the full range, ridge,
western trail, snowfield, mounted approach, graphics tiers, rain and night. It
compares 556 protected ground samples and 3,575 broad terrain samples to the
previous deployed build, checks reflections and finite opaque render targets,
and rides all 45 points of the Frostpine trail.

`tools/qa-alpine-safety.cjs` rides into a new ridge collision boundary and checks
that the extended snowfield has conifers and no meadow grass/flower instances.
The country-world regression covers existing meadows, village, roads and tree
budgets across graphics tiers. Its replacement-tree check expects scanned conifers
on the extended snowfield and scanned broadleaf trees at the remaining blossom
sites; the retired procedural canopies and trunks must stay hidden.

The older falls fixture's first 18 trail points still matched the deployed build,
but its final endpoint differed by 4.68 m before this change. Its track data was
recaptured from unmodified bf4f26d; its 556 protected ground samples and race course
were retained. The baseline ride completed all 45 waypoints. The broad terrain
fixture also comes from bf4f26d.

This remains an incremental landscape improvement. The distant world rim,
waterfall spray, small regional props, some vegetation and character detail still
differ substantially from the reference. Mobile performance is not verified.

Final local validation: 5 terrain unit tests, 27 alpine checks with 17 views,
4 focused collision/planting checks, and 26 country checks with 16 views passed.
The 556 protected approach samples and sampled settlement ground have zero
height change. The range rises by at most 39.79 m in the broad baseline sample;
its rock skin has 11,984 triangles and the combined falls/range has 288 barriers.
The mounted trail completes all 45 waypoints with zero hoof/ground offset.
All reviewed render targets were finite and opaque, with no WebGL or asset errors.

# Living cascades

Hollowpeak's fine parallel water strands and glowing mist puffs made its waterfall
look detached from the rock. Ribbon Falls also retained additive droplets that
stayed bright at night, and dry grass crossed its lower chute.

Both falls now share layered, broken flow with a faster stretched pattern toward
the bottom. Independent layer phases prevent the two thin surfaces from drawing
identical streaks. Lit foam forms irregular bubble patches at the landings; an
initial concentric-ring version was rejected after close-up review, followed by
a radial-advection trial whose stretching was also removed.

The falling droplets, impact spray and rising mist have distinct motion and
lifetime fades. Particles face the active camera, including the reflection camera,
fade close to the lens and disappear in the distance. Their tint comes from the
existing atmosphere lighting phase, so mist and droplets dim with the landscape
at night. They use normal transparency instead of additive glow. The old CPU
particle updates, repeated instance-buffer uploads and temporary frame objects
are removed. The shared water clock now drives all paths in the vertex shader.

Hollowpeak uses 294 particles / 588 triangles / three draws. Ribbon's upper drop
uses 122 particles / 244 triangles / three draws, and its lower landing uses
82 particles / 164 triangles / two draws. All buffers remain static. Bounding
spheres enclose the complete motion; no new texture or model downloads are needed.
The existing fall meshes, terrain heights, rock shapes, source channels, pools,
water levels, collision barriers and riding routes remain intact. Retired random
placement draws are retained so later scenery keeps its previous layout.

Ribbon's dry planting is excluded from the actual chute width. Existing static
cover is cleared there, and the dynamic grass and clutter use the same footprint.
The revised feature index retains the newer club-horse collection from main.

## Reference and validation

The broader world direction uses the official Star Equestrian gallery at
https://www.foxieventures.com/star-equestrian/ as the quality reference. These
water effects are original procedural work, judged against the prior deployed
Meadowlark views. No Star Equestrian art, models or textures are included.

`tools/qa-waterfall-effects.cjs` captures eight close and regional views, including
inside the spray, rain, low graphics and both falls at night. It also renders the
particles in isolation at five times. It checks actual pixel motion, opaque
compositing, finite world buffers, distance fade, unchanged instance buffers,
night tint, bounded geometry, removal of old glowing effects and a clear chute.

`tools/qa-mountain-falls.cjs` covers the full mountain and both water reflections,
556 protected ground samples, the 45-waypoint mounted approach, rock/water
clearance, cliff collision and camera safety. The country-world regression covers
existing meadows, village, roads, planting budgets and graphics tiers.

The effects improve coherence and motion but are still a real-time approximation.
The low-resolution terrain silhouette and simplified Ribbon rock forms remain
visible at close range. Far trees, regional props and some character presentation
still differ from the reference. Mobile performance remains unverified.

Final local validation: 68 checks passed (15 focused effects, 27 mountain/riding,
26 country regression), with 41 world views and five isolated animation frames.
All 3,575 compared terrain samples and every captured world track are unchanged.
The mounted route completes 45/45 waypoints with zero hoof/ground offset. The
checked render targets remain finite and opaque; no WebGL, asset or feature
errors were reported. Ribbon's checked dry-cover batches have no chute intrusions.

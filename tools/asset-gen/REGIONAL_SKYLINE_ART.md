# Regional skyline and valley views

The former three complete mountain belts made village, meadow and canyon views share a similar wall of blue-green hills. This pass authors a directional horizon: pale northern relief, broken warm western shelves, low pastoral shoulders, and open southwest/eastern saddles. The six named massifs retain their compass positions and horizontal footprints, but apply the same relief envelope per vertex so broad side summits cannot close the new valleys.

The visual reference is Foxie Ventures’ official [open-world meadow screenshot](https://www.foxieventures.com/wp-content/uploads/2023/01/Field-Ride-Into-A-Huge-Open-World.jpg), inspected on 7 October 2026. It supports open meadow sightlines, separated woodland groups and pale distant relief. All new landscape geometry, profiles and material changes are original. No reference-game pixels, models or map data are bundled. This milestone does not establish visual identity with the complete reference game.

`regional-landscape.mjs` owns the periodic authored sectors, dimensionless height/morphology/woodland controls, and matching shader weights. Shader windows use shortest-circle arithmetic; operational atan inputs avoid repeated angular trigonometry. Ring geometry uses distinct alpine flanks, dry shelves and round green shoulders; all layers share open valley bearings. Named peaks use their actual world vertex bearings, preserving names/compass bearings and fixed XZ positions. The guide reports the resulting heights. Optional regional mineral treatment suppresses grass/grove modulation on warm dry faces, and every duplicate wrap vertex shares its position, colour and normal. Static geometry adds no tick hook or render pass.

The outer annulus retains 20,992 triangles, 11,791 vertices, the original index layout and exact first three position/colour bands. The source riding terrain and its edge colours/normals remain untouched. Beyond the seam, regional relief, roughness, colour and tree density blend together. Woodland roots use barycentric samples of the actual emitted triangles and existing atlases. Only the cloned outer material receives the compass climate extension; the riding material retains its local biomes and texture resources.

Landscape consumers share one versioned surface module and its texture cache. The native preservation comparator caught an initial duplicated-cache import that consumed extra UUID random values before basin scattering. Matching the geology import restored the original random sequence. Changes to module tags must preserve this singleton relationship.

Validation commands (use the platform helper and one GPU job at a time):

```sh
node --test tools/test-regional-landscape.mjs tools/test-regional-backdrop.mjs tools/test-outer-landscape.mjs
QA_SKYLINE_BASELINE=1 node tools/qa-regional-skyline.cjs output/skyline-before
node tools/qa-regional-skyline.cjs output/skyline-release
```

The native harness intercepts the exact `efa02cb` published runtime for its baseline, then compares full terrain attributes, 505 ground samples, eight nearby landmarks, geology transforms/geometry, pre-road solids, 2,618 basin trees, all seven routes, final collision registry and exact outer edge data. It checks actual emitted angular elevations for southwest/east/west openings while retaining recognizable northern relief. Browser response hashes verify the tested JavaScript modules against the working tree. Full mounted canyon travel runs in both directions. Eleven matching region/quality/weather views validate source-buffer opacity, finite HDR pixels, WebGL and game/asset errors. Geometry remains 264,832 triangles across the three rings, six massifs and outer ground. Mobile frame rate is not established by these desktop native-GPU checks.

Remaining art work includes cold-region tree species and thaw transitions, smaller props, foreground coherence, foliage silhouette quality and selected low-sun highlights. These are separate from this skyline milestone.

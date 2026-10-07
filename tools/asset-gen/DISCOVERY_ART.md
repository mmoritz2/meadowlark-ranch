# Discovery prop art

`assets/discovery-art.js` replaces the twelve four-box treasure chests and twenty
primitive collectibles with original, shared model templates. The treasure tables,
IDs, tiers, collection indices, payouts, and three-day chest refill remain in use.

Chests have individual weathered boards, a curved nine-stave lid, an open interior,
skids, metal bands, rivets, ring handles, a lock and keyhole. Iron, brass, and teal
with brass distinguish the three tiers. Each placed chest has its own rear hinge;
its geometry and materials are shared with the other chests of that tier. The
existing open pose and saved-state restoration rotate that hinge instead of
sinking a solid lid into the chest body.

Collectibles use a ribbed scallop shell, a barred feather with a curved shaft,
a five-point quartz cluster, and a glass seed jar with packed seeds, a stopper,
neck cord and wheat label. They retain their hovering, rotating pickup behavior.
The jar uses ordinary blended glass, not physical refraction or transmission.

The models reuse the ranch builder's existing weathered timber and rough linen
maps. The photographed surfaces are CC0 Poly Haven assets, with authors, source
URLs and hashes in `assets/textures/builder/manifest.json`. All prop geometry and
vertex coloring are original. No downloaded model, additional texture, external
asset host, or proprietary Star Equestrian artwork is introduced.

## Placement and collision

A single stable body proxy per chest provides collision without moving a collider
with the open lid. It covers the body up to 0.53 m; the decorative curved lid and
small handles do not add collision parts. Ordinary riding can go around the chest
and jumping can clear it. Rendering and collision share the chest's world transform.

Six authored placements change, with saved IDs and collection indices preserved:

| Prop | Previous x,z | Updated x,z | Reason |
| --- | --- | --- | --- |
| Lake chest | 27,22 | 27,20 | Clear a fence |
| Bridge chest | 6,118 | 6,116 | Gentler ground |
| Mesa chest | -215,95 | -215,89 | Dry riverbank |
| Snowpeak chest | -175,-240 | -177,-238 | Clear the steep rock slope |
| Farbank chest | 150,150 | 150,146 | Gentler ground |
| Third canyon crystal | -260,120 | -260,126 | Dry riverbank |

The world terrain and riding height sampler are unchanged. Map and interaction
locations continue to come from the same treasure tables.

## Geometry budget

| Shared template | Triangles | Draws per visible copy |
| --- | ---: | ---: |
| Iron chest | 5,996 | 5 |
| Brass chest | 6,388 | 6 |
| Teal/brass chest | 7,268 | 6 |
| Shell | 3,372 | 1 |
| Feather | 400 | 1 |
| Crystal cluster | 240 | 2 |
| Seed jar | 8,684 | 4 |

Templates batch parts by material and use ordinary frustum culling. The seed jar
is the most detailed collectible because its contents are geometry. These props
have no distance LOD; mobile GPU performance has not been measured.

## Validation

`tools/qa-discovery-art.cjs` boots the production world with the native GPU helper.
It checks geometry and normal validity, shared templates with independent hinges,
collision/side clearance/jump height, dry and level sites, rewards and repeat-use
protection, refill expiry, collection completion and a real saved-state reload.
It compares 505 riding-ground samples against the protected terrain fixture.
Nine rendered views cover all model types, the new bank and mountain sites,
three graphics tiers, rain, and night, including finite HDR buffers and opaque
scene coverage. Before/after close-ups and every chest site are reviewed separately.
`tools/qa-discovery-riding.cjs` drives the real mounted horse toward the Pines
chest, around its side, and over it with a jump.

The discovery acceptance run passed all 20 checks with no browser, asset,
feature or WebGL errors. All 505 protected ground samples are unchanged.
The scene uses 25 shared discovery geometries and eight shared materials;
individual lids remain independently poseable. The mounted route suite also
passed all six checks: forward blocking, clear-side travel, jumping, ground
contact, finite transforms and no browser errors. Its clear-side route uses
the left of the Pines chest; the right passes through another existing obstacle.

This is a prop-art improvement. Regional composition, some background models,
characters, and terrain transitions still differ from Star Equestrian.

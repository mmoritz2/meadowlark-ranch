# Buildings — why there is only one file in here

This folder was created to hold authored buildings: a barn and stable block, a farmhouse, a
timber lodge and sawmill, a boathouse and stilt huts, a mountain hut, a desert trading post
and windmill, a watermill, a bridge. It contains one jetty structure. That is not an
oversight; it is the finding.

## No cleared source has buildings

**Poly Haven (CC0, redistribution explicitly permitted — the only licence posture that is
unambiguously safe for a public repo that anyone can clone).** Its whole model library is 521
assets, of which exactly **14** are under `Architecture/*`:

```
large_castle_door            modular_chainlink_fence      rollershutter_door
modular_factory_facade       gate_latch_01                rollershutter_window_01
modular_urban_apartments_facade  large_iron_gate          rollershutter_window_02
modular_fort_01              modular_fire_escape          rollershutter_window_03
stone_fire_pit               modular_wooden_pier
```

Not one of them is a building. Two are urban facade kits, one is a stone fortification, four
are roller shutters, two are gates, one is a fire escape, one is a chainlink fence. The only
usable structure for this game's world is `modular_wooden_pier` — jetty piles and deck, which
is genuinely right for the marsh quarter. It is shipped here.

**Sketchfab** is the one cleared source that actually has barns, stables, paddock fencing and
show jumps at the right realism level. Its search API works unauthenticated, so candidates can
be shortlisted — but the download endpoint does not:

```
GET https://api.sketchfab.com/v3/models/<uid>/download
→ 401 {"detail":"Authentication credentials were not provided."}
```

Downloading requires an account and an OAuth token. Creating accounts is outside what this
agent may do, so no Sketchfab asset could be fetched, let alone verified.

**Blendswap** — the source of this project's own horse — is the same story. `GET
/blend/13903/download` returns `200 text/html`: a sign-in page, not a file. Downloads need an
account (5/day on the free tier).

**Kenney** and **KayKit** are properly CC0 and do have barns, sheds and fences. They were
rejected on looks, not licence: both are flat-shaded low-poly on a single gradient atlas.
Dropped beside this game's photographic shingle roof, board-and-batten siding and naturalistic
oaks, they would read as placeholder art and widen the gap with Star Equestrian rather than
close it.

**Poly Pizza** is an aggregator whose per-model licence label is its own assertion about a
third-party upload, not the creator's current terms — it still serves Quaternius models
labelled "Public Domain (CC0)" while Quaternius's own site now imposes the QAL v1.0, which
forbids redistributing the assets themselves. **Quaternius** is therefore out entirely.

## The procedural barn does not need replacing

This is worth saying plainly, because the premise of the job was that the buildings are
"competent programmer-art" and that authored ones would be the single biggest lever.

Looked at closely in-engine, `Meadowlark timber barn` is not boxes. It has board-and-batten
siding with real grain and knot variation, a cedar shingle roof with individually varied
shingles, a ridge cap and a proper eave overhang, white fascia and corner trim, recessed
six-pane windows with mullions and a genuine reveal, a plank door with strap hinges on a
sliding barn-door track, two lantern sconces, a foundation course and a downpipe. In the
comparison screenshots it is the best-looking object in the frame — better than the game's own
image-to-3D barrels, which are the most obviously "imported" thing on screen.

A stylised low-poly barn would be a clear downgrade. A photoscanned one would need the same
palette grade as everything else here before it could sit beside this one. The honest lever on
"it doesn't look like Star Equestrian" is not the barn; it is the forecourt around it, which is
bare, and the characters, which are capsules.

## If the owner wants real buildings

Two routes, both needing a decision the agent could not make:

1. **Sketchfab with an account.** CC BY is perfectly compatible with this repo — it already
   ships a CC BY 3.0 horse with a SOURCE.md and a SHA-256 — but note the "licence and
   attribution must follow the asset everywhere it is used" clause: credit has to be reachable
   from inside the running game, not only in README.md. Archive the original download beside
   each asset; Sketchfab is now run by KitBash SF Operations LLC and its longevity is not
   assured.
2. **Author them, as the repo already does.** The barn, stables and cottages here were built
   procedurally with ComfyUI materials and they are good. Extending that generator to a
   sawmill, boathouse, mountain hut and trading post would cost less than sourcing, grading and
   licence-clearing twelve third-party buildings, and would guarantee they match.

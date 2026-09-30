# Isolated horse roster visual gate (2026-09-30)

`node tools/qa-roster-visual-gate.cjs` captured the actual Breed Studio at rest (side and quarter) and walk (side at 250 ms, quarter at 550 ms). The report has 168 successful captures, zero page errors and zero blocked external requests in `output/roster-visual-gate/report.json`. Samples are one representative of each distinct physical body path, plus Pegasus, Alicorn, Opaline, Emberdrake, Tidedrake and Gloomdrake. The snapshots are an art review, not proof that the entire gait cycle is sound. This audit did not compare against Star Equestrian originals.

The manifest has **80 roster identities and 36 distinct body resource paths** (`breeds[*].file`). The 36 count includes protected `.mkr` body resources; it excludes separate feather-wing component, the standalone artist study, original source files, and the evaluated European Dragon. Family counts are:

| Source family | Identities | Distinct body paths |
| --- | ---: | ---: |
| WildMesh white Western horse | 44 | 25 |
| Arabian sculpt | 6 | 1 |
| BlueMesh draft | 8 | 5 |
| Fjord sculpt | 2 | 1 |
| Ikkiz unicorn | 4 | 1 |
| Pastel unicorn | 2 | 1 |
| Black dragon | 13 | 1 |
| Horse skeleton | 1 | 1 |

## Release blockers, highest impact first

1. **Shared movement still reads as a synthetic high-step rather than a believable walk.** Sampled WildMesh, draft, Arabian, Fjord, unicorn and skeleton bodies show stiff foreleg reach, sharply bent/crossed hind legs, limited torso weight shift and inconsistent ground contact. All imported Studio horses use the `createArtistMotion` core directly or through wrappers, so this is roster-wide until each family passes a full-cycle visual check. Compare `output/roster-visual-gate/bay-rest-side.png` with `bay-walk-quarter.png`, and `shire-walk-quarter.png`, `fjord-walk-quarter.png`.
2. **The 13 black-dragon identities share a broken rest silhouette.** The converted dragon crouches low with its native wing membranes layered over the head/back, while walk exposes wide overlapping wings and strained planted forelimbs. `emberdrake-rest-side.png`, `emberdrake-walk-quarter.png`, `frostdrake-rest-side.png`. Emberdrake, Tidedrake and Gloomdrake confirm this is a shared body/rig issue, not a single color.
3. **Several source bodies are visibly below the requested realistic standard before animation.** The six Arabian-family identities share a peach, nearly untextured sculpt, rigid elevated tail and tiny sparse mane (`sunset-rest-side.png`). Two Fjord identities share a smooth toy-like body and sawtooth vertical mane (`fjord-rest-side.png`). The two pastel-unicorn identities show mottled/pockmarked skin and sparse transparent hair/tail (`celestial-rest-side.png`, `opaline-rest-side.png`). The Suffolk Punch has a visibly blocky fringe and harsh coat/groom transition (`suffolk-rest-side.png`).
4. **Feathered fantasy horses need wing art treatment.** Pegasus and Alicorn rest views show flat translucent shard-like wings that nearly disappear against the light background; Phoenix shows conspicuously orange, rigid blades. Those examples use the same separate wing component also assigned to Aurora and Ashwing (five identities total), so check each before release. `pegasus-rest-side.png`, `alicorn-rest-side.png`, `phoenix-rest-side.png`.
5. **Some identity and material claims overstate differentiation/readability.** The 44 WildMesh-derived identities come from one approved source and 25 body files; Bay, Morgan, Thoroughbred and Hanover remain nearly the same silhouette in the contact sheet. Several pale coats and the glowing Luminous Spirit skeleton have weak contrast in the Studio (`lumen-rest-side.png`). Breed-specific conformation claims need side-by-side review at rest. `contact-bodies-1-rest-side.jpg` and `contact-bodies-2-rest-side.jpg` provide the comparison.

The white Lipizzaner derivative with Western tack is a promising static presentation (`lipiz-rest-side.png`), but its walk retains the shared movement defect (`lipiz-walk-quarter.png`). None of these captures supports publishing the replacement roster yet.

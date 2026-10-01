# Three private Walk head-timing extensions

The Bay Western, Bay Sporthorse and Icelandic pilots extend the frozen White neck/head-only method using each target's own native rest transforms and animated parents. Each produces two head-origin oscillations per stride, opposite that target's measured trunk second harmonic. These are bounded private timing studies, not natural-gait or production approval.

| Target | Current / new head-origin span | Unchanged trunk-origin span | New n2 head/trunk phase | Walk reference speed |
|---|---:|---:|---:|---:|
| Bay Western | 33.30 / 59.01 mm | 15.98 mm | 180.000° | 0.4669 m/s |
| Bay Sporthorse | 37.70 / 63.67 mm | 17.26 mm | 180.000° | 0.5011 m/s |
| Icelandic private target | 32.16 / 52.87 mm | 14.96 mm | 180.000° | 0.4217 m/s |

The input/source hashes and candidate hashes are pinned in `config.json`, `manifest.json` and each target's `build-summary.json`. Bay and Sporthorse source kits are tracked files; the Icelandic source kit is a local private study and is not required for release reproduction. Candidate binaries and full measurement/frame dumps are under ignored `output/native-walk-head-batch/{bay,sporthorse,iceland}/`. The pilot preserves input kits, frozen White pilot files and source appearance. A subsequent integration copies only Bay/Sporthorse candidates into separate runtime kit folders and updates their profile paths/cache chain; the Icelandic target is not registered.

## Method and preservation

The standing `spine_04_012` world origin above the untouched source skinned body floor sets each target's size ratio relative to tracked White `review/native-horse-kit/model.glb` (FA797…); multiplying White's 70 mm target by that ratio gives 59.03, 63.68 and 52.88 mm targets. This is a reproducible size proxy, not a claim about exact breed anatomy or anatomical withers height. The head and trunk measurements likewise use `head_019` and `spine_04_012` origins rather than optical anatomical markers.

At the 128 original Walk keys, the builder reconstructs the complete source pose, measures its own trunk n2 phase and solves one common sagittal neck pitch against the analytic opposed head-height target. Native rest world rotations receive pitch fractions .45/.60/.75/.90/1.0 for neck1–5 and .85 for the head. Locals are rebuilt through each actual animated parent rotation. The solve is bounded to ±12°; Bay's actual range is −7.54…+8.40°, Sporthorse −6.88…+7.78° and Icelandic −6.90…+7.81°. Bay's own proportions require slightly more than the White pilot's ±8° bracket.

Exactly six Walk quaternion output accessors change. Every other animation sampler and its arrays (322 tracks per kit), clip timing, static nodes, meshes, source materials/maps, skins, inverse binds, original accessors/views and original binary prefix remain exact. All 677 native joints, five source mesh topologies, 23,514 groom vertices and original Western tack remain present. Only appended rotation output data is added; no target fitting, limb solve, gait retiming, torso or groom animation track editing occurs.

Each changed curve uses periodic projected CUBICSPLINE tangents. Independent phase-1 solves from the untouched source end-pose parents agree with candidate phase 0 within 2.92×10⁻⁶ degrees across all models. Normalized internal and loop tangent differences are zero. Changed-track maximum key steps are 0.450°/0.416°/0.418° per 8.75 ms; dense maxima are 51.53/47.65/47.82°/s. These checks concern the six new curves and preserve existing limb limitations. C1 does not certify acceleration or whole-gait naturalism.

## Actual GLTF and mounted checks

`qa.cjs` samples actual Three.js GLTF playback at 256 phases per target. All native transforms are finite, with zero page/console errors. Every tested whole-hoof minimum, maximum and center and the trunk world origin agree exactly with the original kit at every phase. Fixed source-rest lower-hoof masks are defined in each `contact-method.json`: source body floor, broad rest height `.19 m × standing proxy ratio`, nearest native distal marker in XZ, strict sole own minimum +7 mm, and original +Z toe/heel quartiles. No animated low-vertex reselection or body-floor cropping is used.

| Target | Whole-hoof authored stance minima | All-skinned-mesh floor minimum | Maximum groom sample change from original Walk |
|---|---:|---:|---:|
| Bay Western | +0.688…+1.364 mm | +0.688 mm | 85.36 mm |
| Bay Sporthorse | +0.715…+1.363 mm | +0.715 mm | 92.62 mm |
| Icelandic | +0.670…+1.350 mm | +0.670 mm | 75.46 mm |

Groom differences measure native parent response at 243 fixed samples, not attachment error or hair physics. Mane follows the revised neck pose; the source tail and groom channels are unchanged.

`mounted-qa.cjs` routes only the tested profile response to the private candidate and exercises actual Ranch catalog selection, riding, source tack contacts and production rider/rein bridge. Each 64-step run covers one actual steady Walk cycle after settling. Bay and Sporthorse retain their registered profile coordinates. Icelandic is an explicitly private Bay profile fixture using its own kit, seat, gait speeds, anchor file and actual target coordinates; this does not register or release Icelandic.

All three loaded controller SHA `2f44f6641225c9ab2d8b102b188da48fe9f45538211f0fb50d3a7808ad04edb6`, the expected exact candidate, finite native/rider poses and zero errors. Maximum actual skinned boot-to-stirrup residuals are 3.36/2.76/4.95 µm. Rein endpoints match current bit/hand targets to numerical precision; non-rein tack components remain intact. The bit origins move with the revised head (about 10–12 cm Y span, depending on target and side).

Actual rendered rein outer edges and inspected centerline segments intersect none of the 1,405 fixed majority-neck-weight triangles at the 64 mounted phases. Minimum sampled rein/neck gaps are 72.94/74.70/70.59 mm. This is a bounded segment/surface check, not exhaustive rein volume or hair collision, terrain/transition quality or contact force testing.

## Visual verdict and limits

Paired side and quarter frames retain the original bodies, source groom and equipment. The new head curve produces a gradual, visible two-beat nod with no captured neck break, detached bit or tack. Normal-duration side/quarter GIFs use 16 phases ×70 ms = the original 1.12 s stride. The high carried source posture remains, and the neck/groom can still read as rigid artist geometry rather than physical tissue/hair.

The trunk's dominant four-cycle component is unchanged (n4 amplitudes 5.10/5.47/4.61 mm versus n2 4.26/4.64/4.20 mm). The new head is opposed to its n2 component, not to every instantaneous trunk movement. Changing the coupled body and limb dynamics is a separate task. These studies do not repair all gaits, transitions, all breeds, mounted clearance under every state or missing fantasy motion.

The qualitative timing basis is [Loscher et al., 2016](https://pmc.ncbi.nlm.nih.gov/articles/PMC5136594/), on head/neck dynamics in walking horses. Its anatomical measurements are not treated as exact requirements for these artist models or joint-origin proxies.

## Reproduce and view

From the repository root, with Python NumPy/SciPy and the existing Node Playwright runtime:

```sh
python3 review/native-walk-head-batch/build.py
python3 review/native-walk-head-batch/curve-audit.py bay
python3 review/native-walk-head-batch/curve-audit.py sporthorse
NODE_PATH=/Users/mbphome/.npm-global/lib/node_modules node review/native-walk-head-batch/qa.cjs bay
NODE_PATH=/Users/mbphome/.npm-global/lib/node_modules node review/native-walk-head-batch/mounted-qa.cjs bay
```

The default builder runs only Bay and Sporthorse from tracked inputs. Repeat the last two commands with `sporthorse`. Browser scripts expect the existing root server at port 8584. Viewer URL is `/review/native-walk-head-batch/review.html?horse=bay` (or `sporthorse`). The public selector offers Bay and Sporthorse only. An Icelandic query is allowed only on a local host and uses optional private assets; on a public host it falls back to Bay. For Bay/Sporthorse it compares the immutable tracked input kit with the byte-identical tracked runtime head kit, so the saved page works without ignored output files. Browser QA and curve audits verify regenerated ignored candidates against their pinned hashes. Full browser/mounted reports, paired phase frames and normal-duration GIFs remain ignored; concise summaries and two preview images per target are preserved here.

Icelandic is optional local evidence. Its `config.json` entry and saved summaries pin the private input/hash; explicit `build.py iceland`, `curve-audit.py iceland` and browser checks need the untracked private `review/native-iceland-kit/model.glb` plus its coordinates/anchors. None of those private assets is a dependency of the published Bay/Sporthorse kits or their reproduction. Do not treat the private Bay profile fixture as production registration.

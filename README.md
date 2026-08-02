# Meadowlark Ranch 🐴

A cozy open-world horse game that runs in a browser tab. Ride across a 1000×1000
open world, care for and breed your horses, jump courses, and — on a headset —
ride the same world in VR.

Built from scratch in **one HTML file, no build step, no CDN**: clone it, serve the
folder, and it runs.

**▶️ [Play it in your browser](https://mmoritz2.github.io/meadowlark-ranch/)**

![Riding in the arena at Meadowlark Ranch](docs/screenshots/gameplay.png)

## Run it

```bash
python -m http.server 8431
```

Then open <http://127.0.0.1:8431/>. Your ranch auto-saves to `localStorage`.

**Ride** with `W`/`↑`, steer with `A`/`D`, `Shift` to gallop, `Space` to jump —
or use the on-screen controls on a phone. Drag to orbit, scroll to zoom.

For VR, serve over HTTPS (WebXR requires a secure origin) and press **Ride in VR**:

```bash
python serve-vr.py
```

## What's in it

| | |
|---|---|
| **World** | ~1000×1000 units of ridged hills, cliffs, a carved river with a bridge, a stream, wheat fields, desert canyon, and a snowline — one continuous mesh, coloured by slope and altitude |
| **Horses** | 19 breeds from ponies to winged mythics; care, bonding, XP and levels; breeding that blends both parents' coats; foals that grow up over real time |
| **Riding** | Speed-dependent gaits, jumping, show-jumping courses and cross-country flag races with timing, faults and trophies |
| **Living world** | Day/night with dusk window lights and fireflies, weather with rain and rainbows, wild horses to tame, NPC riders, and procedural wildlife |
| **VR** | Full WebXR mode — ride from the saddle, with a world-space UI you operate with the controllers |
| **Multiplayer** | Share a club code over MQTT to ride the same world, chat, and compare leaderboards |

<p align="center">
  <img src="docs/screenshots/arena.png" width="49%" alt="The ranch arena">
  <img src="docs/screenshots/meadow.png" width="49%" alt="Riding out into the meadow">
</p>

## How it's built

Everything renders with [Three.js](https://threejs.org) (vendored, no network calls
at startup). The interesting parts are the systems written on top of it:

- **Procedural everything.** Grass, bark, water, terrain, clouds and coats are drawn
  in code to canvases or sculpted from math, so the download stays small and the
  world can be re-generated rather than authored.
- **Real branching trees.** A Weber–Penn style generator grows trunks, branches and
  leaf clusters, then bakes them into instanced meshes.
- **Seamless creatures.** Wildlife is defined as JSON primitives, shrink-wrapped into
  a single watertight skin with a smooth-minimum SDF, and animated by a shared gait
  system — so a new animal is a data file, not new code.
- **A no-tile ground shader.** Stochastic per-block UV offsets, bilinearly blended,
  kill the repeating-texture grid across the whole world.
- **Skeletal animation on a generated mesh.** The player's mount is a rigged GLB
  driven bone-by-bone: gait-correct footfall timing for walk, trot and gallop, plus
  a jump tuck, all posed as quaternions about calibrated local axes.
- **VR built for comfort, not just for support.** The camera rig chases the horse
  through a critically-damped filter — fast horizontally, slow vertically — so
  collision push-out and landing jolts never reach the player's head, and a shader
  vignette closes in with speed to keep peripheral optical flow from arguing with
  the inner ear.
- **Performance.** Instanced foliage and critters, a graphics-quality selector, and
  foveated rendering in VR.

### The art pipeline

The horse, foliage and props under `assets/models/` were generated locally rather
than bought: a reference image per asset, then image-to-3D, then texture baking, then
auto-rigging for the animated ones. `tools/asset-gen/` holds the scripts that drive it.

## Honest limitations

- The rider is a stylised procedural figure, not a production character rig.
- Multiplayer uses a public MQTT broker — fine for a demo, not a game service.
- `ranch3d.html` is deliberately one large file. It is organised in sections, but it
  is a single-author codebase, not a module structure a team would share.
- Terrain collision is height-field based, so very steep cliffs can be climbed.

## Credits

Original code and generated art. Three.js and MQTT.js are vendored under their own
licenses in `assets/vendor/`. Built as a personal project by
[@mmoritz2](https://github.com/mmoritz2).

Inspired by **Star Equestrian** and **Horse Riding Tales** (Foxie Ventures) — the games
that got me interested in how a cozy horse world holds a player's attention. This is an
independent from-scratch project, not affiliated with or derived from them; any
resemblance is genre admiration, and all code and assets here are my own.

`DEVELOPMENT.md` is the full build log, including what didn't work the first time.

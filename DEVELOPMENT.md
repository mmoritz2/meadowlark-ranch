# Star Ranch Fable — Development Log 🐴✨

A behind-the-scenes summary of how this game was built: what's in it, what
worked, what fought back, and what still needs love. Written to be readable
even if you're not a programmer.

---

## What this is

A cozy, open-world **3D horse-ranch game** that runs entirely in a web browser
from a single HTML file. It was inspired by the gameplay of *Star Equestrian*
by Foxie Ventures, but every line of code and every piece of art here is
**original and built from scratch** — no assets, models, or code were copied
from that game. The whole point was to make a version with **no ads, no energy
timers, and no paywalls**: everything is earnable just by playing.

It started as a small 2D canvas game, became a 3D Three.js world, and then the
2D version was retired entirely — now everything lives in the one 3D world.

---

## How it's built (the short version)

- **One file does almost everything:** `ranch3d.html` (~4,500 lines) contains
  the entire game — HTML, CSS, and the JavaScript game engine.
- **3D engine:** [Three.js](https://threejs.org) r160, vendored under
  `assets/vendor/three/` so the game can boot without a CDN request.
- **Everything is procedurally generated.** There are almost no image files.
  The grass, bark, water, horse coats, terrain, clouds — all of it is drawn in
  code onto canvases and turned into textures, or sculpted from math.
- **The horses are math, not models.** Each horse is built from "lofted"
  tube/curve geometry (the body and neck are swept shapes) plus blob shapes for
  the head features, assembled and animated joint-by-joint every frame.
- **Your ranch saves automatically** to the browser's `localStorage` under the
  key `starRanchFable_v1`. No account needed.
- **Multiplayer** runs over a free public MQTT message broker
  (`broker.emqx.io`) — players who join the same "club code" share a world,
  see each other ride, chat, and share leaderboards.

`index.html` is just a friendly redirect into `ranch3d.html`.

---

## Features that made it in

**The world (Evervale)**
- A large rolling open world (~1000×1000 units) with value-noise hills, a
  carved river with an arched wooden bridge, wheat fields, lavender, boulders,
  and forests.
- Distinct biome zones with their own ground: Bronco Canyon (sand + red mesas),
  Witberg (snow), Agricola (farmland), plus the home meadow.
- Snow-capped, craggy mountains on the horizon, drifting clouds, weather
  (rain + rainbows), birds, and ambient sound.
- A **full day/night cycle**: dawn, noon, golden hour, dusk, and a moonlit
  starry night — with sky-matched fog, a real moon, cottage windows and arena
  floodlights that switch on at dusk, and **fireflies** that come out after dark
  (birds and butterflies roost for the night).
- **Living ambient wildlife**: butterflies that actually forage — flying
  flower-clump to flower-clump, stopping to sip — and river fish that leap
  with a splash ring when you ride near the water.
- **Procedural blob critters** (seamless SDF bodies): bunnies, deer, sheep,
  chickens, ducks, and bluebirds live across Evervale. Each species is ~15
  lines of JSON; its primitive shapes are fused into ONE seamless mesh by
  shrink-wrapping an icosphere onto a smooth-min SDF (blended vertex colours,
  SDF-gradient normals — no visible seams). One gait system animates
  4-legged walks, 2-legged waddles, bunny hops, duck floating, and bird
  flight; they wander, graze, blink, wag tails, flee from galloping riders,
  and sleep at night (deer stay out through dusk).
- A fenced **Home Pasture** where your whole herd grazes and wanders (unlimited
  horses).

**Riding & movement**
- Full third-person riding: walk, trot, gallop, jump, with smoothed motion,
  banking into turns, terrain-following pitch, and dust kick-up.
- Realistic-feel jumping (early versions felt like the moon — see below).
- **Pegasus flight:** a real sustained flight mode — take off, hold to climb,
  release to hover at altitude, dive to land. Wings flap and the horse banks
  and pitches.
- Collision detection against barns, fences, rocks (fences are jumpable).
- A mini-map and a **fast-travel** menu to hop between zones.

**Your horses**
- A detailed, hand-tuned procedural horse model with mane, tail, ears, bridle,
  saddle, and per-breed coat colors.
- Real breeds (Quarter Horse, Friesian, Appaloosa, Andalusian, etc.), plus
  draft breeds (**Shire & Clydesdale** with feathered legs).
- **Fantasy breeds** with glowing magical coats and special abilities:
  Celestial Unicorn (galaxy coat), Ember Runner (fire, *Swift*), Frost Stallion
  (ice, *Leap*), Aurora Pegasus & Phoenix (winged flight), Shadow Mare.
  Abilities actually change gameplay (faster gallop / higher jump / flight).
- Foals that **gambol around, follow you**, and **grow up** over real time.
- **Wings (and coats) are now hereditary** — breed a winged horse and the foal
  reliably inherits wings, generation after generation, even across club
  breeding with friends.

**Pets** 🐾
- Adopt a Puppy, Fox Kit, Kitten, or Bunny from the shop. Your active pet
  trots along beside you everywhere, legs scampering and tail wagging.

**Care & progression**
- Feed / water / groom / pet your horse; needs decay gently over real time
  (even while away) and care builds bond ❤️ and XP.
- A live **status card** with need bars and one-tap quick-care buttons.
- **Stable** panel to view, rename, switch which horse you ride, and pick which
  foal/pet follows you.
- **Daily quests**, an **achievements** system, a **login streak**, a
  **Star Pass** with tiered rewards, daily **photo competitions**, mystery
  packages, and a golden turtle.
- **Daily golden horseshoe hunt:** 10 horseshoes hide in new spots every day
  (they glint on the minimap when you ride close); find them all for a gem
  bonus. **Wildlife photography:** snap deer, bunnies, ducks & co. with the
  camera for coins, daily quests, and an achievement.
- **Mythic stardust trails:** fantasy-coat horses (fire, galaxy, ice, aurora,
  shadow) stream matching sparkles when they gallop or fly.

**Events & competition**
- Show-jumping courses and cross-country flag-gate races that loop out across
  the world and back to the arena, with trophies, star ratings, prize money,
  and training XP.
- Lots of **leaderboards** (distance, jumps, trophies, etc.) with milestone
  rewards.

**Shop & breeding**
- Shop tabs for Horses, **Pets**, Food, Tack (saddle colors), Breeding, and
  rider Outfit customization.
- Breed two of your own horses, or **breed with a club mate's horse** — foals
  blend both parents' coats.

**Multiplayer & social**
- Real-time shared worlds via club codes; see other riders, **chat** with
  emotes and speech bubbles, a friends system, and **viewable player profiles**
  with their club records.
- **Friend invites:** one button copies an invite link — anyone who opens it
  rides straight into your club (the `?club=CODE` URL auto-joins).
- Change your rider name; everyone shows their own name.

**UI polish**
- A consistent, rounded, glassy HUD with blur, hover/press animations, badges
  on actionable buttons, and animated panels.

---

## What worked well

- **Single-file, no-build approach.** Being able to just open the file (or
  serve it locally) made iteration extremely fast and the game trivially
  shareable. No dependencies to break.
- **Procedural generation** kept the whole game to a few hundred KB with no
  asset pipeline, and made things like recoloring coats or biomes easy.
- **localStorage saving** "just works" and survives reloads — your herd is
  always waiting.
- **MQTT for multiplayer** turned out to be a surprisingly clean way to get
  real shared worlds and even shared leaderboards (using "retained" messages)
  with zero backend to host.
- The **realism look-development pass** (atmosphere, lighting, color grading,
  matte coats, real sky) made the single biggest jump in how the game *feels*,
  far more than any individual model change.

---

## What didn't work the first time (the honest part)

Game feel is hard, and a lot of this was iterative. The notable battles:

- **The horse's head.** This took many rounds. Early heads were a "spike"
  buried in the neck, then a giant flat "blade" face. The fix was rebuilding
  the neck-to-muzzle as one continuous swept curve and then compressing the
  face proportions — plus discovering that an idle animation was also forcing
  the head to an old hard-coded angle.
- **"Moon jumping."** The first jump physics floated for ~0.7s like low
  gravity. Fixed by retuning launch velocity and using different rise vs. fall
  gravity, plus a landing impact (dust, dip, sound).
- **The NaN "poison" bug.** A smoothing line referenced its own previous value;
  once it ever became `NaN`, it stayed `NaN` forever and silently corrupted the
  reins and rotations. Fixed by guarding every smoothed value with a finite
  check. (Diagnosed by walking the 3D scene graph to find which objects had
  `NaN` positions.)
- **Upside-down roofs.** A sign error flipped the cottage and barn roofs into
  V-shaped valleys instead of gables. Required rebuilding the roof slabs.
- **The Pegasus that wouldn't land.** Flight altitude used `flyAlt || 6`, and
  because `0` is "falsy" in JavaScript, the moment altitude hit exactly zero it
  snapped back up to 6 — so the horse bounced instead of landing. Classic
  zero-is-falsy trap; fixed with an explicit type check.
- **"Everything looks fake / cartoonish."** The first looks were oversaturated
  and washed out by a beige fog. The fix wasn't one thing — it was a combined
  pass: sky-matched atmospheric fog, a real blue sky gradient, warmer key light
  + cooler fill, desaturated natural greens, softened ground tiling, and matte
  (non-plastic) horse coats.
- **Stale browser cache.** The local server sends no cache headers, so the
  browser kept serving an old copy of the file and "new" features looked
  missing. Worked around by always reloading with a `?fresh=N` cache-buster.
- **Edits drifting between sessions.** Because an automated improvement loop
  edits the file continuously, exact code anchors would shift between turns.
  The lesson, applied repeatedly: always re-search for the exact text right
  before editing.

---

## Known limitations & what still needs improving

**Visuals**
- **Trees** are still fairly low-poly / billboard-ish and are the weakest part
  of the landscape up close. They deserve fuller, more varied 3D canopies.
- **Grass** blades can read as flat "cardboard" cutouts at some angles, and the
  bright green doesn't always match the more muted ground.
- **Horses are stylized, not photoreal.** The body is smooth and lacks real
  muscle definition, fur shading, and finer leg/hoof detail. Faces are much
  better than they were but still simple.
- Distant mountains are intentionally hazy (aerial perspective) but can look a
  little flat depending on sun position.
- No screen-space ambient occlusion or contact shadows beyond a simple blob,
  so objects can feel slightly "floaty."

**Systems & gameplay**
- **Pets** are cosmetic companions only — they don't yet have abilities,
  feeding/care, or variety beyond four types, and only one follows at a time.
- **Abilities** are currently simple stat tweaks (speed/jump/flight/glow);
  there's room for flashier effects (particle trails, dashes, ground effects).
- **Club breeding** can only see a remote horse's wings and coat (those are
  broadcast); other genetics (horn, exact stats) aren't fully shared.
- **Sound** is all synthesized beeps/tones — there's no real recorded music or
  rich SFX.
- **Events/quests** could use more variety and longer story content.

**Technical / infrastructure**
- **Saves are local-only.** Your ranch is tied to this browser on this computer
  — there's no cloud sync or account, so clearing browser data loses progress
  and you can't continue on another device.
- **Multiplayer uses a free public broker** with no authentication. It's great
  for playing with friends, but: anyone could in principle join a club code,
  leaderboards are trust-based (no anti-cheat), and the broker could rate-limit
  or go down. A proper backend would be needed for anything serious.
- **Performance:** a 🎚️ graphics-quality button (High/Medium/Low) now scales
  pixel ratio, shadow-map size, bloom, grass density, and cloud count — but
  there's still no true level-of-detail system for distant objects.
- **Mobile** has on-screen touch controls but the layout and performance aren't
  specifically tuned for small screens.
- **Accessibility:** no colorblind options, remappable keys, text scaling, or
  reduced-motion mode.
- It's **one enormous file**, which is convenient but hard to navigate and test
  in pieces. There are no automated tests — verification is done by running the
  game and looking at it.

---

## How to run it

1. Open `ranch3d.html` directly in a modern browser, **or** serve the folder:
   ```
   python3 -m http.server 8431
   ```
   then visit `http://localhost:8431/ranch3d.html`.
2. Your ranch auto-saves in the browser. To play with a friend, both join the
   same **club code** in the Club menu.

**Controls:** W/↑ ride · A/D steer · Shift gallop · Space jump (hold to fly on a
Pegasus) · drag to orbit the camera · 📷 for photos · or use the on-screen
buttons on touch devices.

---

## Rough roadmap ideas

- Fuller, more natural trees and denser, better-matched grass.
- More muscle/shading detail on the horse models.
- Particle trails and showier effects for fantasy abilities.
- Pet variety, pet care, and pet perks.
- A graphics-quality / settings menu and LOD for performance.
- Optional cloud save / cross-device continue.
- More story, quests, and event types; richer audio.

---

*Built collaboratively with Claude (Anthropic). All game code and art are
original; the game is inspired by, but contains no assets from, Star Equestrian.*

# Star Equestrian: what it has, what Meadowlark has, what to build

Research notes, 4 September 2026. Star Equestrian is Foxie Ventures' open-world horse
MMO (iOS, Android, PC). Everything below is from public sources listed at the end. This
is a *feature* study: Meadowlark Ranch is an independent from-scratch game and borrows
ideas the way every horse game borrows from the genre, never assets, names, or story.

## Star Equestrian in one paragraph

You return to riding after an injury and search Evervale for your lost horse Snowdrop,
across regions (Heartside, the Redwood, Agricola, Bronco, Witberg), riding a growing
collection of horses through hundreds of story and side quests, daily quests, show
jumping and cross country events, multiplayer races, trail rides with friends, and a
ranch you build and decorate. Horses have five stats levelled by feeding, tack carries
stat bonuses and upgrades, breeds have mastery levels and personalities, and clubs race
for weekly leaderboard chests. Seasonal live events (Bronco bounty hunting, the Dragon
Trials, the Festival of Harmony with dressage) rotate on top.

## System by system

| System | Star Equestrian | Meadowlark today | Gap |
|---|---|---|---|
| Horse stats | Five: acceleration, agility, jump, speed, stamina. Each levelled independently, capped by horse level (max at level 50); breed sets the ceiling per stat. Stats change handling: responsiveness, acceleration, turning. | Three: speed, stamina, jump. Level and XP. | Add acceleration and agility; per-stat levelling with caps; stats drive handling. |
| Feeding | Foraged food picked up in the world, each item gives XP to one stat (lettuce, turnip, truffle, daikon → agility; pumpkin, lemon, orange, zucchini → acceleration…). Five feed tiers. Supplements bought with gold. Feeding is optional, never a chore. | Carrot, apple, hay: hunger, bond, happy, generic XP. Carrots grow in the meadow. | Forage items across regions mapped to stats; feed tiers; a supplements shelf. |
| Tack | Saddle, saddle pad, bridle, horseshoes slots. Rarity gives up to three stat bonuses. Upgrade with gold, merge spare tack into the main piece. Legendary sets. Freely swapped between horses. | Tack is a saddle colour. | A tack inventory with four slots, rarity, bonuses, upgrade and merge; sets. |
| Care | No mandatory brushing or hoof-picking by design; dirtiness exists and is balanced. | Hunger, thirst, clean, happy needs that decay; groom, water, pet. | Keep ours (players like it), keep it light. |
| Bonding | Riding, petting, feeding raise bond; unlocks petting animations and tricks (faster sprint, sliding stop). | Bond 0–100, milestones. | Bond unlocks: tricks and a sliding stop; horse emotes at bond tiers. |
| Mastery | Per breed: each horse of a breed owned raises mastery to 10; cosmetic unlocks at 2, 4, 6, 8 (hairstyles, colours), bareback at 9; bonus XP, stamina. | None. | Breed mastery with mane and tail styles and small perks. |
| Personalities | Aloof, Energetic, Alert, Challenging, Social, Relaxed. | None. | Six personalities with visible behaviour and small gameplay effects. |
| Breeding | "Advanced genetics", non-fantasy horses, unique coat combos, foals raised then grown; fantasy horses only via breeding. | Breed tab; coats blend both parents; foals grow over real time. | Markings genetics (dominant/recessive), rare fantasy outcomes. |
| Wild horses | Bronco bounty event: track loose horses, earn trust, guide them to a sanctuary. | Wild horses roam; walk up slowly, stay close to tame. | Runaway roundup event; sanctuary. |
| Quests | Hundreds; main story with clue-gathering detective side quests; daily quests worth 10 gems each plus an umbrella quest; Star Points. | 8 story missions with Grandpa Wren; 14 daily types; achievements; milestones. | A real story arc in chapters per region; NPC side quests; umbrella daily. |
| Events | Show jumping (line riding: shortcuts penalised) and cross country (stamina management, "inspiring jumps" reward well-timed jumps); ribbons per completion (up to 4); 4 weekly leaderboard events (2 XC, 2 SJ), top 1,000 rewarded; PvP races with items. | 15 events: 8 show-jumping courses, 6 races, Twilight Cup; faults, timing, trophies; club races and leaderboards over MQTT. | Ribbons, a stamina bar in XC, inspiring-jump timing bonus, line-riding penalties, weekly rotation with prizes, race items. |
| Clubs | Clubs earn Star Points weekly (ribbons, horse levels, stat levels, decor spend); top 100 clubs get Club and Champions chests. Moderated chat. | Private club codes, chat with emotes and speech bubbles, race leaderboards. | Star Points and weekly club chests. |
| Ranch | Buy land plots, place stables, pastures and decor "Sims-style"; builder points from placed items; ranch levels unlock perks for you and stalled horses; horses populate pastures; hitching posts; three ranches (Family, Green Valley, Sea Breeze) with stall limits; ranch parties for friends. | Fixed ranch, herd grazes the pasture. | A build mode with a catalogue, builder points, ranch levels with perks; parties. |
| World | Evervale: forests, towns, Western outposts; collectibles (golden horseshoe, message in a bottle, sheriff's badge, toy unicorn); chest map; Silver Key doors; resource traders; fishing. | Kestrel Basin: ranch, pasture, Cottonwood, Barleyfold, Coyote Canyon, Hollowpeak, Loon Lake; horseshoes to find; fast travel. | Treasure chests with a map, key doors, collectible sets, a fishing spot. |
| Social | Trail rides and expeditions created with friends; dressage formations with friends, spectate from grandstands; emotes (8 rider, horse emotes: rear, kick, lay down, bow, nuzzle, head toss); ranch parties. | Chat emotes, shared races. | Trail-ride creator, horse emotes, party mode. |
| Camera | Free camera for exploration and photos; UI hide requested. | Photo button with daily themes. | Free camera with UI hidden. |
| Customisation | Rider hair, clothing, skin; male or female rider; horse mane and tail combos; English and Western saddles. | Outfit tab, VR outfits; rider mesh recolours coat and breeches. | Mane and tail styles (via mastery), Western saddle. |
| Fantasy | Friesian Pegasus in five coats; fantasy breeds only via breeding. | Unicorns, pegasus, six mythic coats with abilities. | Ahead. |
| VR | None. | Full WebXR with reins. | Ahead. |
| Monetisation | Gems, gold, silver keys (loot), VIP pass; the thing players complain about most. | Coins and gems earned in play; no purchases. | Stay free. Give Silver Keys away. |

## What players praise and complain about

Praised: fluid controls and menus, animations, no ads, riding with friends, the ranch.
Complained about: money (banner horses costing hundreds of dollars for a chance), the
story running out after 20–25 hours with no main-quest updates, crashes in races,
shallow ranch interaction ("I can build stalls but cannot take the tack off in them").

Those complaints are the opportunity: a free game whose story keeps going, whose ranch
you can actually use, and whose horses feel different from each other.

## The backlog, in build order

Each item ships on its own commit, verified in a headless capture and a console check
before it goes live.

1. **Five-stat horses and stat food.** Acceleration and agility join speed, stamina and
   jump. Each stat levels on its own from food, capped by horse level; breed sets the
   ceilings. Forage grows by region (lettuce and daikon in the meadow, pumpkins at
   Barleyfold, oranges in the canyon, truffles under the pines) and each feeds one stat.
   Stats drive the ride: acceleration is how fast you reach a gallop, agility how tight
   you turn, stamina how long a gallop holds.
2. **Tack that matters.** Four slots (saddle, pad, bridle, shoes), rarity with up to
   three bonuses, upgrade with coins, merge spares. Silver Keys open a tack chest.
3. **Story, book two.** A mystery arc of our own across every region, in chapters, with
   clue-gathering side quests from Mia, Theo and the villagers, and an umbrella daily.
4. **Ranch building.** A catalogue of stables, fences, troughs, planters and lights to
   place on the home ranch; builder points; ranch levels with perks for stalled horses.
5. **Personalities, mastery, horse emotes.** Six personalities with behaviour; breed
   mastery with mane and tail styles; rear, bow, lay down, nuzzle, head toss on demand.
6. **Weekly events and club points.** Ribbons per run, four rotating weekly events with
   prize tiers, Star Points for clubs and a weekly club chest.
7. **Cross country stamina, inspiring jumps, line riding, race items.**
8. **Treasure map, chests, key doors, collectible sets, fishing at Loon Lake.**
9. **Trail-ride creator, ranch parties, seasonal roundup event, free camera.**

## Sources

- Foxie Ventures, Star Equestrian page: https://www.foxieventures.com/star-equestrian/
- Foxie Ventures, "Exciting New Additions to Star Equestrian": https://www.foxieventures.com/exciting-new-additions-to-star-equestrian/
- Official site feature list: https://starequestrian.com/
- Web store (Star VIP, gems, Silver Key): https://shop.starequestrian.com/
- App Store listing and version history: https://apps.apple.com/us/app/star-equestrian-horse-ranch/id1635888697
- The Mane Quest, early-access impressions: https://www.themanequest.com/blog/2023/3/10/star-equestrian-a-new-free-to-play-mobile-horse-mmo-early-access-impressions
- The Mane Quest, developer interview: https://www.themanequest.com/blog/2023/3/29/we-wanted-to-build-a-horse-game-that-people-could-be-passionate-about-the-inspirations-research-and-future-plans-behind-star-equestrian
- The Mane Quest, PC release recap: https://www.themanequest.com/blog/2024/2/16/horse-game-updates-recap-star-equestrian-on-pc-new-breeds-in-rival-stars-and-dlcs-for-horse-tales-emerald-valley-ranch
- Star Equestrian Wiki (Fandom): Horse Stats, Horse Feed, Feeding XP, Tack, Legendary, Mastery, Horse Personalities, Ranches, Family Ranch, Club Leaderboards, Leaderboard, Market, Royal Stable, Friesian Pegasus, Fish, collectibles pages. https://star-equestrian.fandom.com/

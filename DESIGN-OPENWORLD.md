# The Hollow Crown — Open World Mode + UI Refresh (restructured brief)

Sean's ask, restructured: "Add an option to make the D&D game completely open
world with infinite generation, random enemies, different areas like caves,
forests, dungeons and structures — and make the UI look less generic and more
fun. Test the game."

## Mode choice
- Title screen offers TWO modes side by side: **⚔️ Campaign** (the existing
  hand-made story, unchanged) and **🌍 Endless Realm — Open World** (new).
- Character creation is shared; the chosen mode decides where the hero lands
  and which rules for maps, rests and respawns apply. Saves remember the mode.

## Endless Realm (open world)
- **Infinite, deterministic world.** The surface is generated from a world
  seed by pure functions of world (x, y) — value-noise elevation/moisture/
  temperature + per-chunk points of interest. It never "ends", the same
  coordinates always produce the same terrain, and only a 32×20 window around
  the hero is materialised at a time (the camera follows, hero stays centred).
- **Biomes / areas:** Emerald Plains, Whispering Forest, Sunbaked Desert,
  Snowy Pines, Rocky Highlands, lakeshores & rivers — each with its own ground,
  tree/rock density, colour palette in the renderer, and encounter table.
- **Structures & points of interest** (roughly one per 18×18 chunk):
  villages (walk-in houses, plaza, villagers, a merchant, an innkeeper —
  villages are safe havens, set your "home", and allow Long Rests),
  cave entrances, dungeon doors, ruined towers, ancient ruins, bandit camps
  and shrines. Caves / dungeons / towers / ruins open into **procedurally
  generated interior maps** (caverns by drunkard's-walk; dungeons/towers as
  connected rooms) with themed monsters, chests and a way back out. Interior
  layouts are deterministic per POI, so cleared/chest state persists.
- **Random enemies:** stepping through the wild can trigger ambushes —
  frequency is capped (a breather between fights), the mix follows the biome,
  and both group size and toughness scale with distance from spawn ("Danger"
  rating shown in the UI) so walking further out stays threatening at the
  level cap of 8.
- **Goals without a story:** a rotating **Bounty board** (defeat N creatures →
  gold + XP, then a harder bounty), discovery toasts/XP for finding new
  biomes and POIs, and a world panel showing biome, coordinates, danger,
  places discovered and creatures defeated.
- **Death in the Realm:** the Dawn returns you to your home village (last
  village visited, or the spawn camp) at half HP for a 10% gold tithe — the
  campaign keeps its Emberford-temple rule.
- **Long Rests in the Realm:** at a village (or inside one of its houses);
  Short Rests anywhere, as in the campaign.

## UI refresh ("less generic, more fun")
- Title screen: layered night-sky gradient, drifting sparkles, glowing crown,
  and two illustrated mode cards instead of a plain button stack.
- In game: gradient top bar with pill buttons, parchment-and-gold panels,
  gradient HP/XP bars, a framed "storybook" map with a soft vignette, a
  location banner showing place/biome + coordinates + danger, coloured log
  lines, and rounded, lifted buttons throughout. Layout, panel structure and
  natural proportions stay exactly as they were (Sean's calibration: natural,
  not artificially big; high contrast, low clutter).

## Testing
- Headless: generation determinism, spawn passability, every interior type
  reachable start→exit with encounters/chests on passable tiles, surface
  walking + camera window rebuild, POI enter/leave round-trip, random
  encounter trigger + victory + bounty progress, save/continue in both modes,
  campaign regression (creation → Emberford → mill fight still works).
- Browser playtest on the live Pages build: create a hero in each mode, walk
  the Realm, enter a cave/dungeon, fight, rest at a village, screenshot-check
  the new UI.

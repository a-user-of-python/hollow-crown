# The Hollow Crown

A 2D single-player web RPG that runs the real **Dungeons & Dragons 2024 ("5.5")** rules,
built from the **SRD 5.2.1** (CC-BY 4.0, Wizards of the Coast LLC).

**Play: https://a-user-of-python.github.io/hollow-crown/**

## What it is

- Full character creation: all **12 SRD classes**, **9 species**, **4 backgrounds**,
  Ability scores your way — **Standard Array, 27-point Point Buy, or rolling 4d6 and
  dropping the lowest die** (the classic method) — plus 2024 background ability boosts,
  class skill choices, starting spells.
- A real rules engine: d20 tests with advantage/disadvantage, crits, **Weapon Mastery**
  (Cleave, Graze, Nick, Push, Sap, Slow, Topple, Vex), grapple/shove as saving throws,
  spell slots (full / half / pact magic), concentration, death saving throws, Short and
  Long Rests (2024 rules), Heroic Inspiration, Exhaustion, XP levelling 1 → 8,
  subclass at 3, ASI/Feat at 4 and 8.
- Turn-based tactical combat on the standard **5-foot grid**: movement, actions,
  bonus actions, reactions and opportunity attacks, conditions, enemy AI.
- Three-panel screen: party quick-info (HP / XP / spell slots) on the left, the play
  grid in the centre, quests and context on the right. Menus for Character, Inventory,
  Spells, Progression (class feature tree), the Armoury (every weapon & armour with
  its real numbers), Journal and a monster Codex.
- An original six-chapter campaign, *The Hollow Crown*: the river town of Emberford,
  a drowned chapel, a bandit wood, a hobgoblin mine, the siege of the Pale Harvest,
  and the Royal Crypts — with two companions, side quests, shops, dialogue skill
  checks, and a final choice with two endings.
- **The Endless Realm — a completely open-world mode.** Pick it on the title screen
  and the game generates an infinite world around you as you walk: plains, forests,
  deserts, snowfields, highlands and lakeshores, with villages (shops, inns, safe
  Long Rests, a home the Dawn returns you to), caves, dungeons, towers and ruins
  with generated interiors, bandit camps, shrines, random ambushes whose danger
  grows with distance from the start, discovery rewards, and an endless bounty
  board. The world is deterministic — the same world seed always builds the
  same world.
- Saves automatically to your browser (localStorage). No blood or gore.

## Files

- `index.html` — screens and layout
- `css/style.css` — styling
- `js/data.js` — SRD 5.2.1 data: classes, species, backgrounds, weapons, armour, spells, monsters
- `js/campaign.js` — the original campaign: maps, NPCs, dialogues, quests, shops
- `js/game.js` — rules engine, exploration, combat, menus, and the Endless Realm generator
- `DESIGN.md` — the design brief the game was built from
- `DESIGN-OPENWORLD.md` — the brief for the Endless Realm mode and the UI refresh

## Licensing

The story, characters, places, maps and code of The Hollow Crown are © the author —
all rights reserved; viewing only, no use or redistribution without written permission.

Dungeons & Dragons rules content is drawn from the System Reference Document 5.2.1,
© Wizards of the Coast LLC, used under the Creative Commons Attribution 4.0
International License (CC-BY 4.0). This is an unofficial fan work, not affiliated
with or endorsed by Wizards of the Coast.

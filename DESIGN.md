# THE HOLLOW CROWN — Regenerated Design Prompt

> This is the improved prompt generated from Sean's brief (2026-11-18), used as the
> build basis for this game. Sean's original asks are all preserved; the gaps a real
> D&D game needs (dice engine, rests, death saves, initiative, dialogue skill checks,
> shops, companions, saving) were added deliberately.

## The Prompt

Build **The Hollow Crown**, a single-player **2D top-down web RPG** that runs the real
**Dungeons & Dragons 2024 ("5.5") rules** from the SRD 5.2.1 (CC-BY 4.0, attribution
included), published on GitHub Pages as plain HTML/CSS/JS files — no build step, no
server, saves in localStorage.

### Screen layout (three areas, always visible in play)
- **Left panel — Character quick info:** portrait token, name/class/level, HP bar with
  current/max, XP bar with progress to next level, AC, speed, gold, and **spell slots**
  shown as pips per spell level (plus Hit Dice and Heroic Inspiration).
- **Centre — The play field:** the active location rendered on the standard D&D
  **5-foot square grid**, top-down 2D. Free exploration movement out of combat;
  turn-based tactical combat on the same grid in combat.
- **Right panel — Right-now info:** active quests with current objectives, the combat
  turn order during fights, context actions for whatever you are standing next to,
  and the scrolling game log.

### Menus (top bar, each one built from the actual 2024 rules data)
- **Character Sheet** — abilities, modifiers, saving throws, all 18 skills, passive
  Perception, proficiencies, species/background traits.
- **Inventory** — weapons, armour, gear, consumables; equip/unequip with live AC
  recalculation; use potions; gold and weight-light management.
- **Spells** — known/prepared spells, per-level slots, cast out of combat where legal
  (healing), full rules text for every spell.
- **Progression (skill tree)** — a level-by-level tree of the character's class
  features showing unlocked vs upcoming, subclass branch at level 3, and the
  level-up flow (HP roll-or-average, Ability Score Improvement or a Feat at 4 and 8).
- **Armoury** — the complete available weapons and armour of the game with damage,
  properties, **2024 Weapon Mastery** effects, AC values and prices.
- **Journal** — main quest, side quests, completed quests, and story recap.
- **Codex** — monsters encountered, with their real stat-block numbers once fought.

### Rules engine (non-negotiable — this is what makes it D&D and not a lookalike)
- d20 tests: ability checks, saving throws, attack rolls; advantage/disadvantage
  (cancel, never stack); critical hits double damage dice; nat 20/1 rules.
- Action economy: Action, Bonus Action, Reaction (opportunity attacks), movement
  in 5-ft squares up to Speed; Dash/Disengage/Dodge/Hide/Ready.
- Weapon Mastery properties in combat: Cleave, Graze, Nick, Push, Sap, Slow, Topple, Vex.
- Grapple/Shove as saving throws (DC 8 + Str mod + Proficiency) — the 2024 way.
- Spellcasting: real slot tables (full / half / pact magic), spell save DC =
  8 + ability mod + PB, concentration checks, cantrip scaling at 5/11/17,
  2024 spell values (Cure Wounds 2d8, Healing Word 2d4 Bonus Action, new Counterspell).
- Conditions with real effects (Prone, Poisoned, Stunned, Frightened, Restrained…).
- Death saving throws at 0 HP; Short Rest (spend Hit Dice) and Long Rest (full
  recovery, all Hit Dice back — 2024 rule); Exhaustion as in 2024.
- XP levelling 1 → 8 over the campaign; subclass at 3 for every class; ASI/Feat at 4, 8.
- Skill checks in dialogue and exploration (Persuasion, Insight, Perception,
  Stealth, Athletics…) with visible rolls — success and failure both move the story.

### Character creation
Class first (all **12 SRD classes**), then Origin (**9 SRD species**, **4 SRD
backgrounds** with their +2/+1 ability increases, skill proficiencies and Origin
feat), ability scores by Standard Array assignment, name and alignment. Two
recruitable companions join during the story (a Cleric and a Rogue) — the player
controls the whole party in combat.

### The campaign — "The Hollow Crown" (original story)
A full original campaign of **six chapters**, built to take several hours: the river
kingdom of Aldermere, the shattered Hollow Crown whose shards bind the loyalty of
the war-dead, and **Vespera Thane, the Pale Shepherdess** — a former royal chaplain
raising the Ashen Host so "no living child marches to war again." The player races
her to the Crown's three shards across a mill town under goblin raid, a drowned
chapel, a bandit-held wood, a hobgoblin mine, the siege of Emberford, and the royal
crypts. Main quest chain plus side quests in every hub, shops, secrets, and a final
choice: destroy the Crown or claim it (two endings). No blood or gore; school/work
appropriate throughout, in line with Sean's standing rule.

### Tech
Vanilla HTML/CSS/JS in multiple files (`js/data.js` = SRD data, `js/campaign.js` =
story/maps/quests, `js/game.js` = engine + UI), canvas for the grid, DOM for panels.
Runs from GitHub Pages; also works opened as local files. High contrast, low clutter,
natural proportions (Sean's vision rules).
